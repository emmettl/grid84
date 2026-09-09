// Geodesic helpers on a spherical Earth. Good to ~0.3% for range and bearing,
// which is well inside the ceremony budget and honest enough for a readout.

export type LngLat = readonly [longitude: number, latitude: number]

export const EARTH_RADIUS_METRES = 6_371_008.8

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180
const toDegrees = (radians: number): number => (radians * 180) / Math.PI

export function haversineMetres(from: LngLat, to: LngLat): number {
  const [lon1, lat1] = from
  const [lon2, lat2] = to
  const φ1 = toRadians(lat1)
  const φ2 = toRadians(lat2)
  const Δφ = toRadians(lat2 - lat1)
  const Δλ = toRadians(lon2 - lon1)
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Initial great-circle bearing from `from` towards `to`, in degrees clockwise from north, 0 ≤ b < 360. */
export function initialBearing(from: LngLat, to: LngLat): number {
  const [lon1, lat1] = from
  const [lon2, lat2] = to
  const φ1 = toRadians(lat1)
  const φ2 = toRadians(lat2)
  const Δλ = toRadians(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const bearing = toDegrees(Math.atan2(y, x))
  return ((bearing % 360) + 360) % 360
}

export function formatRange(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '—'
  if (metres < 1_000) return `${Math.round(metres)} M`
  const km = metres / 1_000
  if (km < 100) return `${km.toFixed(1)} KM`
  return `${Math.round(km).toLocaleString('en-GB')} KM`
}

export function formatBearing(degrees: number): string {
  const normalized = ((Math.round(degrees) % 360) + 360) % 360
  return `${String(normalized).padStart(3, '0')}°`
}

/** Decimal-degree grid reference with hemisphere letters, e.g. `47.3769 N · 008.5417 E`. */
export function formatGrid([longitude, latitude]: LngLat): string {
  const lat = `${Math.abs(latitude).toFixed(4).padStart(7, '0')} ${latitude >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(longitude).toFixed(4).padStart(8, '0')} ${longitude >= 0 ? 'E' : 'W'}`
  return `${lat} · ${lon}`
}

export function formatElevation(metres: number): string {
  return `${Math.round(metres).toLocaleString('en-GB')} M ASL`
}
