import { EARTH_RADIUS_METRES, type LngLat } from './geodesy.ts'

/** Geodesic circle as a closed ring of [lon, lat] points. */
export function geodesicCircle(center: LngLat, radiusMetres: number, steps = 96): LngLat[] {
  const toRad = Math.PI / 180
  const toDeg = 180 / Math.PI
  const [lon0, lat0] = [center[0] * toRad, center[1] * toRad]
  const d = radiusMetres / EARTH_RADIUS_METRES
  const ring: LngLat[] = []
  for (let i = 0; i <= steps; i += 1) {
    const brg = (i / steps) * 2 * Math.PI
    const lat = Math.asin(Math.sin(lat0) * Math.cos(d) + Math.cos(lat0) * Math.sin(d) * Math.cos(brg))
    const lon = lon0 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat0), Math.cos(d) - Math.sin(lat0) * Math.sin(lat))
    ring.push([lon * toDeg, lat * toDeg])
  }
  return ring
}
