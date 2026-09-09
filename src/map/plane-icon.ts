/**
 * One aircraft silhouette for both renderers: the WebGL layer evaluates it as
 * a signed distance in the fragment shader, the GeoJSON symbol layer rasterises
 * it once per tier colour. The outline is drawn nose up in a unit square, y
 * down as on screen, and is mirrored about the fuselage.
 */
const RIGHT_SIDE: Array<[number, number]> = [
  [0, -1.0],
  [0.09, -0.72],
  [0.09, -0.22],
  [0.92, 0.3],
  [0.92, 0.44],
  [0.09, 0.2],
  [0.09, 0.56],
  [0.4, 0.82],
  [0.4, 0.94],
  [0.07, 0.86],
  [0, 1.0],
]

/** The closed outline, clockwise from the nose. */
export const PLANE_OUTLINE: Array<[number, number]> = [...RIGHT_SIDE, ...RIGHT_SIDE.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number])]

/** Fraction of the point sprite's half-size the silhouette spans. */
export const PLANE_SCALE = 0.85

/** The outline as a GLSL constant array plus a polygon signed-distance function, for the point fragment shader. */
export function planeGlsl(): string {
  const n = PLANE_OUTLINE.length
  const verts = PLANE_OUTLINE.map(([x, y]) => `vec2(${x.toFixed(3)}, ${y.toFixed(3)})`).join(', ')
  return `
const int PLANE_N = ${n};
const vec2 PLANE[PLANE_N] = vec2[PLANE_N](${verts});
float sdPlane(vec2 p) {
  float d = dot(p - PLANE[0], p - PLANE[0]);
  float s = 1.0;
  int j = PLANE_N - 1;
  for (int i = 0; i < PLANE_N; i++) {
    vec2 e = PLANE[j] - PLANE[i];
    vec2 w = p - PLANE[i];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= PLANE[i].y, p.y < PLANE[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
    j = i;
  }
  return s * sqrt(d);
}`
}

/**
 * Rasterise the silhouette for MapLibre's symbol layer: `size` device pixels
 * square, filled with `fill` and outlined in `ink`. Returns null where there
 * is no canvas, as in tests.
 */
export function planeImage(size: number, fill: string, ink: string): ImageData | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const half = size / 2
  const scale = half * PLANE_SCALE
  ctx.beginPath()
  PLANE_OUTLINE.forEach(([x, y], i) => {
    const px = half + x * scale
    const py = half + y * scale
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = Math.max(1, size / 22)
  ctx.strokeStyle = ink
  ctx.lineJoin = 'round'
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}
