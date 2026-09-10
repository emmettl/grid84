import { EARTH_RADIUS_METRES, type LngLat } from './geodesy.ts'

const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

/** The point `metres` along a great circle from `from` on an initial bearing, degrees clockwise from north. */
export function destinationPoint(from: LngLat, bearingDeg: number, metres: number): LngLat {
  const δ = metres / EARTH_RADIUS_METRES
  const θ = toRad(bearingDeg)
  const φ1 = toRad(from[1])
  const λ1 = toRad(from[0])
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  const φ2 = Math.asin(Math.max(-1, Math.min(1, sinφ2)))
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1)
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2
  const λ2 = λ1 + Math.atan2(y, x)
  return [((toDeg(λ2) + 540) % 360) - 180, toDeg(φ2)]
}

/**
 * A radar's coverage as a ring: a sector of the given width centred on a
 * bearing, out to the range, closed back through the site. A width of 360
 * or more is the full circle. The ring is built from short great-circle
 * steps so it stays honest on the globe; the longitudes are unwrapped so a
 * sector across the antimeridian stays in one piece.
 */
export function sectorRing(center: LngLat, bearingDeg: number, widthDeg: number, rangeMetres: number, steps = 48): LngLat[] {
  const full = widthDeg >= 360
  const half = full ? 180 : widthDeg / 2
  const ring: LngLat[] = []
  if (!full) ring.push(center)
  for (let i = 0; i <= steps; i += 1) {
    const b = bearingDeg - half + (i / steps) * (full ? 360 : widthDeg)
    ring.push(destinationPoint(center, b, rangeMetres))
  }
  if (!full) ring.push(center)
  else ring.push(ring[0])
  // Unwrap: keep every longitude within 180° of the site's, so a sector across the antimeridian stays in one piece and the closing point is the site itself.
  for (let i = 0; i < ring.length; i += 1) {
    let lng = ring[i][0]
    while (lng - center[0] > 180) lng -= 360
    while (lng - center[0] < -180) lng += 360
    ring[i] = [lng, ring[i][1]]
  }
  return ring
}
