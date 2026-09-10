import type { Track } from '../engine/track.ts'
import type { VehicleKind } from '../studies/study.ts'
import type { EvidenceTier } from '../evidence/evidence.ts'
import { HUE, LINE } from '../evidence/grammar.ts'

/**
 * CPU side of the WebGL track layer: turns timed tracks into vertex buffers.
 *
 * Every track is densified once into a static buffer of mercator vertices, each
 * carrying the time the track reaches it. A frame at study time `t` is then an
 * index list selecting the flown segments, a small buffer of "head" segments
 * from the last flown vertex to the current position, and one point per moving
 * vehicle. Nothing is re-tiled; the map only re-draws.
 */

export type Rgba = [number, number, number, number]

export interface TrackSpec {
  id: string
  track: Track
  /** Tier of the route, which colours and dashes the line. */
  route: EvidenceTier
  /** Tier of the vehicle itself, which colours the moving mark. */
  evidence: EvidenceTier
  side: 'attacker' | 'defender'
  vehicle: VehicleKind
  reveal: 'full' | 'progressive'
}

/** Floats per line vertex: x, y, altitude (m), r, g, b, a, distance, dash on, dash period, width, time (s). */
export const LINE_STRIDE = 12
/** Floats per point vertex: x, y, altitude (m), r, g, b, a, shape (0 ring, 1 aircraft), heading (radians clockwise from north). */
export const POINT_STRIDE = 9

export interface PreparedTrack {
  spec: TrackSpec
  /** Index of the first vertex in the scene's static buffer. */
  first: number
  count: number
  times: Float64Array
  /** Mercator x, y per point, unwrapped across the antimeridian. */
  merc: Float64Array
  /** Cumulative mercator distance per point, for dashing. */
  dist: Float64Array
  /** Height above the surface per point, metres. */
  alt: Float64Array
  line: Rgba
  vehicle: Rgba
  shape: number
  dash: [number, number]
  width: number
}

export interface TrackScene {
  vertices: Float32Array
  tracks: PreparedTrack[]
  /** Upper bound on line segments in any frame, including head segments. */
  segmentCapacity: number
}

export interface TrackFrame {
  indices: Uint32Array
  indexCount: number
  /** Flown segments of the highlighted tracks, drawn again without the fade. */
  highlight: Uint32Array
  highlightCount: number
  heads: Float32Array
  headVertexCount: number
  points: Float32Array
  pointCount: number
}

const MAX_LAT = 89.9

/** Web mercator in [0, 1] on both axes, with longitude left unwrapped so lines stay continuous. */
export function mercator(lng: number, lat: number): [number, number] {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
  const x = (lng + 180) / 360
  const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))) / 360
  return [x, y]
}

export function parseRgba(color: string): Rgba {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(color)
  if (!m) throw new Error(`not an rgba colour: ${color}`)
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, m[4] === undefined ? 1 : Number(m[4])]
}

const DEFENDER: Rgba = [HUE.effect[0] / 255, HUE.effect[1] / 255, HUE.effect[2] / 255, 0.95]

/** Vehicle stroke colour, matching the GeoJSON vehicle layer: red for the defender, else the tier hue. */
export function vehicleColor(tier: EvidenceTier, side: 'attacker' | 'defender'): Rgba {
  if (side === 'defender') return DEFENDER
  const g = tier === 'documented' || tier === 'inferred' || tier === 'modelled' ? LINE[tier] : LINE.reconstructed
  return parseRgba(g.color)
}

/** Dash pattern in screen pixels per tier. Every tier is now drawn solid and told apart by colour; the pair stays for the shader's sake. */
export function dashFor(_tier: EvidenceTier): [number, number] {
  return [0, 0]
}

export function prepareTracks(specs: TrackSpec[]): TrackScene {
  const tracks: PreparedTrack[] = []
  let total = 0
  const geometries = specs.map((spec) => spec.track.timedGeometry())
  for (const g of geometries) total += g.length
  const vertices = new Float32Array(total * LINE_STRIDE)
  let first = 0
  let segmentCapacity = 0
  specs.forEach((spec, k) => {
    const g = geometries[k]
    const count = g.length
    const times = new Float64Array(count)
    const merc = new Float64Array(count * 2)
    const dist = new Float64Array(count)
    const alt = new Float64Array(count)
    const line = parseRgba(LINE[spec.route].color)
    const dash = dashFor(spec.route)
    const width = LINE[spec.route].width
    let d = 0
    for (let i = 0; i < count; i += 1) {
      const [x, y] = mercator(g[i].position[0], g[i].position[1])
      if (i > 0) d += Math.hypot(x - merc[(i - 1) * 2], y - merc[(i - 1) * 2 + 1])
      times[i] = g[i].time
      merc[i * 2] = x
      merc[i * 2 + 1] = y
      dist[i] = d
      alt[i] = g[i].altitude ?? 0
      writeLineVertex(vertices, (first + i) * LINE_STRIDE, x, y, alt[i], line, d, dash, width, times[i])
    }
    tracks.push({ spec, first, count, times, merc, dist, alt, line, vehicle: vehicleColor(spec.evidence, spec.side), shape: spec.vehicle === 'aircraft' ? 1 : 0, dash, width })
    first += count
    segmentCapacity += count // count - 1 flown segments plus one head segment
  })
  return { vertices, tracks, segmentCapacity }
}

export function allocateFrame(scene: TrackScene): TrackFrame {
  return {
    indices: new Uint32Array(scene.segmentCapacity * 2),
    indexCount: 0,
    highlight: new Uint32Array(scene.segmentCapacity * 2),
    highlightCount: 0,
    heads: new Float32Array(scene.tracks.length * 2 * LINE_STRIDE),
    headVertexCount: 0,
    points: new Float32Array(scene.tracks.length * POINT_STRIDE),
    pointCount: 0,
  }
}

/** Number of points reached by `time`: the first index whose time exceeds it. */
function reached(times: Float64Array, time: number): number {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= time) lo = mid + 1
    else hi = mid
  }
  return lo
}

function writeLineVertex(out: Float32Array, o: number, x: number, y: number, alt: number, color: Rgba, dist: number, dash: [number, number], width: number, time: number): void {
  out[o] = x
  out[o + 1] = y
  out[o + 2] = alt
  out[o + 3] = color[0]
  out[o + 4] = color[1]
  out[o + 5] = color[2]
  out[o + 6] = color[3]
  out[o + 7] = dist
  out[o + 8] = dash[0]
  out[o + 9] = dash[1]
  out[o + 10] = width
  out[o + 11] = time
}

/** Fill `frame` for study time `time`. Buffers are reused; only the counts change. */
export function buildFrame(scene: TrackScene, time: number, frame: TrackFrame, highlight?: Set<string>): TrackFrame {
  let ic = 0
  let hv = 0
  let pc = 0
  let hc = 0
  const { indices, heads, points } = frame
  for (const t of scene.tracks) {
    const progressive = t.spec.reveal === 'progressive'
    const k = progressive ? reached(t.times, time) : t.count
    const lit = highlight?.has(t.spec.id) ?? false
    for (let i = 0; i + 1 < k; i += 1) {
      indices[ic] = t.first + i
      indices[ic + 1] = t.first + i + 1
      ic += 2
      if (lit) {
        frame.highlight[hc] = t.first + i
        frame.highlight[hc + 1] = t.first + i + 1
        hc += 2
      }
    }
    const p = t.spec.track.positionAt(time)
    if (!p) continue
    let [x, y] = mercator(p[0], p[1])
    const altitude = t.spec.track.altitudeAt(time)
    if (progressive && k >= 1 && k < t.count) {
      // Head segment from the last reached vertex to the current position, kept on the same side of the antimeridian.
      const lx = t.merc[(k - 1) * 2]
      const ly = t.merc[(k - 1) * 2 + 1]
      while (x - lx > 0.5) x -= 1
      while (x - lx < -0.5) x += 1
      const d = t.dist[k - 1] + Math.hypot(x - lx, y - ly)
      writeLineVertex(heads, hv * LINE_STRIDE, lx, ly, t.alt[k - 1], t.line, t.dist[k - 1], t.dash, t.width, t.times[k - 1])
      writeLineVertex(heads, (hv + 1) * LINE_STRIDE, x, y, altitude, t.line, d, t.dash, t.width, time)
      hv += 2
    }
    const o = pc * POINT_STRIDE
    points[o] = x
    points[o + 1] = y
    points[o + 2] = altitude
    points[o + 3] = t.vehicle[0]
    points[o + 4] = t.vehicle[1]
    points[o + 5] = t.vehicle[2]
    points[o + 6] = t.vehicle[3]
    points[o + 7] = t.shape
    const heading = t.shape > 0 ? t.spec.track.headingAt(time) : null
    points[o + 8] = heading == null ? 0 : (heading * Math.PI) / 180
    pc += 1
  }
  frame.indexCount = ic
  frame.highlightCount = hc
  frame.headVertexCount = hv
  frame.pointCount = pc
  return frame
}
