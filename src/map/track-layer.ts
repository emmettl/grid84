import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl'
import { HUE } from '../evidence/grammar.ts'
import { allocateFrame, buildFrame, LINE_STRIDE, mercator, POINT_STRIDE, type TrackFrame, type TrackScene } from './track-scene.ts'

/**
 * A MapLibre custom layer that draws every track and vehicle of a study from
 * two vertex buffers, on the globe and on the mercator plane alike.
 *
 * MapLibre's GeoJSON sources re-tile all their geometry on every update, which
 * is the bottleneck for enactments with more than a few hundred tracks. Here the
 * flown geometry is static on the GPU; each study tick only rewrites an index
 * list and a few kilobytes of head segments and vehicle positions.
 *
 * Projection is delegated to MapLibre's own `projectTile`, supplied through the
 * shader prelude in the render arguments, so the layer follows the globe and
 * its transition to mercator without knowing which is current.
 */

export const TRACK_LAYER_ID = 'ev-tracks-gl'

/** Vehicle mark in CSS pixels: dark fill, tier-coloured ring and a faint halo, as in the GeoJSON layer. */
const MARK = { fill: 3, ring: 5, halo: 10 }
/** At most this many offset passes thicken the one-pixel GL lines. */
const MAX_PASSES = 5

interface Program {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation | null>
}

interface Variant {
  line: Program
  point: Program
  flash: Program
  lineVao: WebGLVertexArrayObject
  headVao: WebGLVertexArrayObject
  pointVao: WebGLVertexArrayObject
  flashVao: WebGLVertexArrayObject
}

/** A detonation's flash: a radial burst of white that expands and fades over a moment of wall time, whatever the clock rate. */
interface Flash {
  x: number
  y: number
  /** Size of the burst at its widest, CSS pixels. */
  size: number
  /** performance.now() when it began. */
  start: number
}
const FLASH_MS = 1_400
/** Floats per flash vertex: x, y, size, age. */
const FLASH_STRIDE = 4

/**
 * Project a mercator position at a height in metres. MapLibre's prelude gives
 * `projectTileFor3D` under both projections, metres above the sphere on the
 * globe and metres through the custom-layer matrix on the plane, but the
 * globe version does not clip behind the horizon, so the clipping z of the
 * elevated sphere position is applied here as the surface version does it.
 */
const PROJECT_3D = `
vec4 project3d(vec2 pos, float alt) {
  vec4 p = projectTileFor3D(pos, alt);
#ifdef GLOBE
  vec3 sphere = projectToSphere(pos) * (1.0 + alt / GLOBE_RADIUS);
  float clipZ = globeComputeClippingZ(sphere) * p.w;
  p.z = mix(0.0, clipZ, clamp((u_projection_transition - 0.2) / 0.8, 0.0, 1.0));
#endif
  return p;
}`

const LINE_VERTEX = (prelude: string, define: string) => `#version 300 es
${prelude}
${define}
in vec2 a_pos;
in float a_alt;
in vec4 a_color;
in float a_dist;
in vec2 a_dash;
in float a_width;
uniform vec2 u_step;
uniform vec2 u_dir;
uniform float u_frac;
uniform float u_dpr;
out vec4 v_color;
out float v_dist;
out vec2 v_dash;
${PROJECT_3D}
void main() {
  gl_Position = project3d(a_pos, a_alt);
  vec2 offset = u_dir * u_frac * max(a_width * u_dpr - 1.0, 0.0) * u_step;
  gl_Position.xy += offset * gl_Position.w;
  v_color = a_color;
  v_dist = a_dist;
  v_dash = a_dash;
}`

const LINE_FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_color;
in float v_dist;
in vec2 v_dash;
uniform float u_world_size;
out vec4 fragColor;
void main() {
  if (v_dash.y > 0.0) {
    float px = mod(v_dist * u_world_size, v_dash.y);
    if (px > v_dash.x) discard;
  }
  fragColor = vec4(v_color.rgb * v_color.a, v_color.a);
}`

const POINT_VERTEX = (prelude: string, define: string) => `#version 300 es
${prelude}
${define}
in vec2 a_pos;
in float a_alt;
in vec4 a_color;
uniform float u_size;
out vec4 v_color;
${PROJECT_3D}
void main() {
  gl_Position = project3d(a_pos, a_alt);
  gl_PointSize = u_size;
  v_color = a_color;
}`

const FLASH_VERTEX = (prelude: string, define: string) => `#version 300 es
${prelude}
${define}
in vec2 a_pos;
in float a_size;
in float a_age;
uniform float u_dpr;
out float v_age;
${PROJECT_3D}
void main() {
  gl_Position = project3d(a_pos, 0.0);
  // Fast out of the fireball, then a slow spread as it dims.
  float grow = 1.0 - pow(1.0 - a_age, 3.0);
  gl_PointSize = a_size * u_dpr * (0.15 + 0.85 * grow);
  v_age = a_age;
}`

const FLASH_FRAGMENT = `#version 300 es
precision highp float;
in float v_age;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  // White core going warm at the rim; the whole burst fades with age and the core faster than the rim.
  float core = smoothstep(0.55, 0.0, d);
  float rim = smoothstep(1.0, 0.35, d);
  float fade = 1.0 - v_age;
  float a = (core * 0.9 + rim * 0.45) * fade * fade;
  vec3 rgb = mix(vec3(1.0, 0.62, 0.45), vec3(1.0, 0.98, 0.92), core);
  fragColor = vec4(rgb * a, a);
}`

const POINT_FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_color;
uniform float u_size;
uniform float u_dpr;
uniform vec3 u_ink;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * u_size / u_dpr;
  float aa = 0.75;
  if (d < ${MARK.fill.toFixed(1)}) {
    float edge = smoothstep(${MARK.fill.toFixed(1)}, ${MARK.fill.toFixed(1)} - aa, d);
    vec3 rgb = mix(v_color.rgb, u_ink, edge);
    fragColor = vec4(rgb * v_color.a, v_color.a);
  } else if (d < ${MARK.ring.toFixed(1)}) {
    float a = v_color.a * smoothstep(${MARK.ring.toFixed(1)}, ${MARK.ring.toFixed(1)} - aa, d);
    fragColor = vec4(v_color.rgb * a, a);
  } else if (d < ${MARK.halo.toFixed(1)}) {
    float a = 0.12 * (1.0 - (d - ${MARK.ring.toFixed(1)}) / ${(MARK.halo - MARK.ring).toFixed(1)});
    fragColor = vec4(v_color.rgb * a, a);
  } else {
    discard;
  }
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('could not create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`shader failed to compile: ${log}`)
  }
  return shader
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string, uniforms: string[]): Program {
  const program = gl.createProgram()
  if (!program) throw new Error('could not create program')
  const vs = compile(gl, gl.VERTEX_SHADER, vertex)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`program failed to link: ${log}`)
  }
  const locations: Record<string, WebGLUniformLocation | null> = {}
  for (const name of uniforms) locations[name] = gl.getUniformLocation(program, name)
  return { program, uniforms: locations }
}

const PROJECTION_UNIFORMS = ['u_projection_matrix', 'u_projection_fallback_matrix', 'u_projection_tile_mercator_coords', 'u_projection_clipping_plane', 'u_projection_transition']

function asFloat32(m: ArrayLike<number>): Float32Array {
  return m instanceof Float32Array ? m : new Float32Array(m)
}

/** Column-major 4×4 times a column vector. */
function mul(m: Float32Array, p: [number, number, number, number]): [number, number, number, number] {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12] * p[3],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13] * p[3],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14] * p[3],
    m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] * p[3],
  ]
}

export class TrackLayer implements CustomLayerInterface {
  readonly id = TRACK_LAYER_ID
  readonly type = 'custom' as const
  readonly renderingMode = '2d' as const

  private map: MapLibreMap | null = null
  private gl: WebGL2RenderingContext | null = null
  private variants = new Map<string, Variant>()
  private staticBuffer: WebGLBuffer | null = null
  private indexBuffer: WebGLBuffer | null = null
  private headBuffer: WebGLBuffer | null = null
  private pointBuffer: WebGLBuffer | null = null
  private scene: TrackScene | null = null
  private frame: TrackFrame | null = null
  private flashes: Flash[] = []
  private flashBuffer: WebGLBuffer | null = null
  /** The projection of the last frame drawn, kept so labels can be lifted to a track's height on the CPU. */
  private view: { main: Float32Array; fallback: Float32Array; transition: number; globe: boolean; width: number; height: number } | null = null
  private sceneDirty = false
  private frameDirty = false
  private time = 0

  setScene(scene: TrackScene): void {
    this.scene = scene
    this.frame = allocateFrame(scene)
    this.sceneDirty = true
    this.variants.forEach((v) => this.deleteVariant(v))
    this.variants.clear()
    this.setTime(this.time)
  }

  /** Begin a detonation flash at a position; `size` is the burst's width in CSS pixels. */
  flash(lng: number, lat: number, size: number): void {
    const [x, y] = mercator(lng, lat)
    this.flashes.push({ x, y, size, start: performance.now() })
    this.map?.triggerRepaint()
  }

  setTime(time: number): void {
    this.time = time
    if (this.scene && this.frame) {
      buildFrame(this.scene, time, this.frame)
      this.frameDirty = true
    }
    this.map?.triggerRepaint()
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    this.map = map
    this.gl = gl
    this.staticBuffer = gl.createBuffer()
    this.indexBuffer = gl.createBuffer()
    this.headBuffer = gl.createBuffer()
    this.pointBuffer = gl.createBuffer()
    this.flashBuffer = gl.createBuffer()
    this.sceneDirty = true
    this.frameDirty = true
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext): void {
    this.variants.forEach((v) => this.deleteVariant(v))
    this.variants.clear()
    for (const b of [this.staticBuffer, this.indexBuffer, this.headBuffer, this.pointBuffer, this.flashBuffer]) if (b) gl.deleteBuffer(b)
    this.staticBuffer = this.indexBuffer = this.headBuffer = this.pointBuffer = this.flashBuffer = null
    this.map = null
    this.gl = null
  }

  private deleteVariant(v: Variant): void {
    const gl = this.gl
    if (!gl) return
    gl.deleteProgram(v.line.program)
    gl.deleteProgram(v.point.program)
    gl.deleteProgram(v.flash.program)
    gl.deleteVertexArray(v.lineVao)
    gl.deleteVertexArray(v.headVao)
    gl.deleteVertexArray(v.pointVao)
    gl.deleteVertexArray(v.flashVao)
  }

  private lineVao(gl: WebGL2RenderingContext, program: WebGLProgram, buffer: WebGLBuffer, index: WebGLBuffer | null): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('could not create vertex array')
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const stride = LINE_STRIDE * 4
    const attr = (name: string, size: number, offset: number) => {
      const loc = gl.getAttribLocation(program, name)
      if (loc < 0) return
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4)
    }
    attr('a_pos', 2, 0)
    attr('a_alt', 1, 2)
    attr('a_color', 4, 3)
    attr('a_dist', 1, 7)
    attr('a_dash', 2, 8)
    attr('a_width', 1, 10)
    if (index) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index)
    gl.bindVertexArray(null)
    return vao
  }

  private pointVao(gl: WebGL2RenderingContext, program: WebGLProgram, buffer: WebGLBuffer): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('could not create vertex array')
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const stride = POINT_STRIDE * 4
    const pos = gl.getAttribLocation(program, 'a_pos')
    const alt = gl.getAttribLocation(program, 'a_alt')
    const color = gl.getAttribLocation(program, 'a_color')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(alt)
    gl.vertexAttribPointer(alt, 1, gl.FLOAT, false, stride, 8)
    gl.enableVertexAttribArray(color)
    gl.vertexAttribPointer(color, 4, gl.FLOAT, false, stride, 12)
    gl.bindVertexArray(null)
    return vao
  }

  private flashVao(gl: WebGL2RenderingContext, program: WebGLProgram, buffer: WebGLBuffer): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('could not create vertex array')
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const stride = FLASH_STRIDE * 4
    const attr = (name: string, size: number, offset: number) => {
      const loc = gl.getAttribLocation(program, name)
      if (loc < 0) return
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4)
    }
    attr('a_pos', 2, 0)
    attr('a_size', 1, 2)
    attr('a_age', 1, 3)
    gl.bindVertexArray(null)
    return vao
  }

  private variant(gl: WebGL2RenderingContext, shaderData: CustomRenderMethodInput['shaderData']): Variant {
    const cached = this.variants.get(shaderData.variantName)
    if (cached) return cached
    const line = link(gl, LINE_VERTEX(shaderData.vertexShaderPrelude, shaderData.define), LINE_FRAGMENT, [...PROJECTION_UNIFORMS, 'u_step', 'u_dir', 'u_frac', 'u_dpr', 'u_world_size'])
    const point = link(gl, POINT_VERTEX(shaderData.vertexShaderPrelude, shaderData.define), POINT_FRAGMENT, [...PROJECTION_UNIFORMS, 'u_size', 'u_dpr', 'u_ink'])
    const flash = link(gl, FLASH_VERTEX(shaderData.vertexShaderPrelude, shaderData.define), FLASH_FRAGMENT, [...PROJECTION_UNIFORMS, 'u_dpr'])
    const v: Variant = {
      line,
      point,
      flash,
      lineVao: this.lineVao(gl, line.program, this.staticBuffer!, this.indexBuffer),
      headVao: this.lineVao(gl, line.program, this.headBuffer!, null),
      pointVao: this.pointVao(gl, point.program, this.pointBuffer!),
      flashVao: this.flashVao(gl, flash.program, this.flashBuffer!),
    }
    this.variants.set(shaderData.variantName, v)
    return v
  }

  private setProjection(gl: WebGL2RenderingContext, p: Program, data: CustomRenderMethodInput['defaultProjectionData']): void {
    const u = p.uniforms
    gl.uniformMatrix4fv(u.u_projection_matrix, false, asFloat32(data.mainMatrix))
    if (u.u_projection_fallback_matrix) gl.uniformMatrix4fv(u.u_projection_fallback_matrix, false, asFloat32(data.fallbackMatrix))
    if (u.u_projection_tile_mercator_coords) gl.uniform4fv(u.u_projection_tile_mercator_coords, data.tileMercatorCoords)
    if (u.u_projection_clipping_plane) gl.uniform4fv(u.u_projection_clipping_plane, data.clippingPlane)
    if (u.u_projection_transition) gl.uniform1f(u.u_projection_transition, data.projectionTransition)
  }

  /**
   * Screen offset in CSS pixels from a position on the surface to the same
   * position at `altitude` metres, under the projection last drawn. Mirrors
   * the shader's `projectTileFor3D` on the CPU; null before the first frame.
   */
  screenOffset(lng: number, lat: number, altitude: number): [number, number] | null {
    const v = this.view
    if (!v) return null
    const [x, y] = mercator(lng, lat)
    const ground = this.toScreen(v, x, y, 0)
    const lifted = this.toScreen(v, x, y, altitude)
    if (!ground || !lifted) return null
    return [lifted[0] - ground[0], lifted[1] - ground[1]]
  }

  private toScreen(v: NonNullable<typeof this.view>, x: number, y: number, alt: number): [number, number] | null {
    let clip: [number, number, number, number]
    if (v.globe) {
      const sx = x * 2 * Math.PI + Math.PI
      const t = Math.exp(Math.PI - y * 2 * Math.PI)
      const t2 = t * t
      const sinSy = (t2 - 1) / (t2 + 1)
      const cosSy = (2 * t) / (t2 + 1)
      const scale = 1 + alt / 6_371_008.8
      const globe = mul(v.main, [Math.sin(sx) * cosSy * scale, sinSy * scale, Math.cos(sx) * cosSy * scale, 1])
      if (v.transition > 0.999) clip = globe
      else {
        const flat = mul(v.fallback, [x, y, alt, 1])
        const k = v.transition
        clip = [flat[0] + (globe[0] - flat[0]) * k, flat[1] + (globe[1] - flat[1]) * k, flat[2] + (globe[2] - flat[2]) * k, flat[3] + (globe[3] - flat[3]) * k]
      }
    } else {
      clip = mul(v.main, [x, y, alt, 1])
    }
    if (clip[3] <= 0) return null
    return [((clip[0] / clip[3] + 1) / 2) * v.width, ((1 - clip[1] / clip[3]) / 2) * v.height]
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const scene = this.scene
    const frame = this.frame
    const map = this.map
    if (!map || !this.staticBuffer || !this.indexBuffer || !this.headBuffer || !this.pointBuffer || !this.flashBuffer) return
    if (scene && frame) this.renderTracks(gl, options, scene, frame)
    else this.rememberView(gl, options)
    this.renderFlashes(gl, options)
  }

  private rememberView(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const dpr = window.devicePixelRatio || 1
    const pd = options.defaultProjectionData
    this.view = { main: asFloat32(pd.mainMatrix), fallback: asFloat32(pd.fallbackMatrix), transition: pd.projectionTransition, globe: /globe/i.test(options.shaderData.variantName), width: gl.drawingBufferWidth / dpr, height: gl.drawingBufferHeight / dpr }
  }

  private renderFlashes(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const now = performance.now()
    this.flashes = this.flashes.filter((f) => now - f.start < FLASH_MS)
    if (!this.flashes.length || !this.flashBuffer) return
    const data = new Float32Array(this.flashes.length * FLASH_STRIDE)
    this.flashes.forEach((f, i) => {
      data[i * FLASH_STRIDE] = f.x
      data[i * FLASH_STRIDE + 1] = f.y
      data[i * FLASH_STRIDE + 2] = f.size
      data[i * FLASH_STRIDE + 3] = Math.min(1, (now - f.start) / FLASH_MS)
    })
    gl.bindBuffer(gl.ARRAY_BUFFER, this.flashBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    const v = this.variant(gl, options.shaderData)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.DEPTH_TEST)
    gl.useProgram(v.flash.program)
    this.setProjection(gl, v.flash, options.defaultProjectionData)
    gl.uniform1f(v.flash.uniforms.u_dpr, window.devicePixelRatio || 1)
    gl.bindVertexArray(v.flashVao)
    gl.drawArrays(gl.POINTS, 0, this.flashes.length)
    gl.bindVertexArray(null)
    // Keep drawing while any flash is alive.
    this.map?.triggerRepaint()
  }

  private renderTracks(gl: WebGL2RenderingContext, options: CustomRenderMethodInput, scene: TrackScene, frame: TrackFrame): void {
    const map = this.map!
    if (this.sceneDirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.staticBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, scene.vertices, gl.STATIC_DRAW)
      this.sceneDirty = false
    }
    if (this.frameDirty) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, frame.indices.subarray(0, frame.indexCount), gl.DYNAMIC_DRAW)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.headBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, frame.heads.subarray(0, frame.headVertexCount * LINE_STRIDE), gl.DYNAMIC_DRAW)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, frame.points.subarray(0, frame.pointCount * POINT_STRIDE), gl.DYNAMIC_DRAW)
      this.frameDirty = false
    }
    const v = this.variant(gl, options.shaderData)
    const dpr = window.devicePixelRatio || 1
    const worldSize = 512 * 2 ** map.getZoom()
    const pd = options.defaultProjectionData
    this.view = { main: asFloat32(pd.mainMatrix), fallback: asFloat32(pd.fallbackMatrix), transition: pd.projectionTransition, globe: /globe/i.test(options.shaderData.variantName), width: gl.drawingBufferWidth / dpr, height: gl.drawingBufferHeight / dpr }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.STENCIL_TEST)

    // Lines: the flown segments, then the heads, thickened by offset passes along x and y.
    if (frame.indexCount > 0 || frame.headVertexCount > 0) {
      const p = v.line
      gl.useProgram(p.program)
      this.setProjection(gl, p, options.defaultProjectionData)
      gl.uniform2f(p.uniforms.u_step, 2 / gl.drawingBufferWidth, 2 / gl.drawingBufferHeight)
      gl.uniform1f(p.uniforms.u_dpr, dpr)
      gl.uniform1f(p.uniforms.u_world_size, worldSize)
      let widest = 1
      for (const t of scene.tracks) widest = Math.max(widest, t.width)
      const passes = Math.min(MAX_PASSES, Math.max(1, Math.ceil(widest * dpr) - 1))
      const draw = () => {
        if (frame.indexCount > 0) {
          gl.bindVertexArray(v.lineVao)
          gl.drawElements(gl.LINES, frame.indexCount, gl.UNSIGNED_INT, 0)
        }
        if (frame.headVertexCount > 0) {
          gl.bindVertexArray(v.headVao)
          gl.drawArrays(gl.LINES, 0, frame.headVertexCount)
        }
      }
      gl.uniform2f(p.uniforms.u_dir, 0, 0)
      gl.uniform1f(p.uniforms.u_frac, 0)
      draw()
      for (let k = 1; k <= passes; k += 1) {
        const frac = k / passes
        gl.uniform1f(p.uniforms.u_frac, frac)
        gl.uniform2f(p.uniforms.u_dir, 1, 0)
        draw()
        gl.uniform2f(p.uniforms.u_dir, 0, 1)
        draw()
      }
    }

    if (frame.pointCount > 0) {
      const p = v.point
      gl.useProgram(p.program)
      this.setProjection(gl, p, options.defaultProjectionData)
      gl.uniform1f(p.uniforms.u_size, MARK.halo * 2 * dpr)
      gl.uniform1f(p.uniforms.u_dpr, dpr)
      gl.uniform3f(p.uniforms.u_ink, HUE.ink[0] / 255, HUE.ink[1] / 255, HUE.ink[2] / 255)
      gl.bindVertexArray(v.pointVao)
      gl.drawArrays(gl.POINTS, 0, frame.pointCount)
    }
    gl.bindVertexArray(null)
  }
}
