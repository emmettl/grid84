import { EARTH_RADIUS_METRES, haversineMetres, type LngLat } from '../geo/geodesy.ts'

/** Spherical linear interpolation along the great circle between two points. */
export function slerp(a: LngLat, b: LngLat, f: number): LngLat {
  const toRad = Math.PI / 180
  const [lon1, lat1] = [a[0] * toRad, a[1] * toRad]
  const [lon2, lat2] = [b[0] * toRad, b[1] * toRad]
  const d = haversineMetres(a, b) / EARTH_RADIUS_METRES
  if (d < 1e-9) return a
  const A = Math.sin((1 - f) * d) / Math.sin(d)
  const B = Math.sin(f * d) / Math.sin(d)
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
  const z = A * Math.sin(lat1) + B * Math.sin(lat2)
  return [Math.atan2(y, x) / toRad, Math.atan2(z, Math.hypot(x, y)) / toRad]
}

/** Densify a great-circle leg into `n` segments for rendering; MapLibre draws straight lines in projection. */
export function greatCirclePoints(a: LngLat, b: LngLat, n = 64): LngLat[] {
  const points: LngLat[] = []
  for (let i = 0; i <= n; i += 1) points.push(slerp(a, b, i / n))
  return unwrapAntimeridian(points)
}

/** Keep consecutive longitudes continuous across ±180 so the line does not wrap around the globe. */
export function unwrapAntimeridian(points: LngLat[]): LngLat[] {
  const out: LngLat[] = []
  let offset = 0
  for (let i = 0; i < points.length; i += 1) {
    const [lon, lat] = points[i]
    if (i > 0) {
      const prev = out[i - 1][0]
      const candidate = lon + offset
      if (candidate - prev > 180) offset -= 360
      else if (candidate - prev < -180) offset += 360
    }
    out.push([lon + offset, lat])
  }
  return out
}

export interface Waypoint {
  position: LngLat
  /** Seconds relative to H-hour at which the track is here. */
  time: number
}

/** A timed path. Position at any time is the great-circle interpolation between its waypoints. */
export class Track {
  readonly waypoints: Waypoint[]
  constructor(waypoints: Waypoint[]) {
    if (waypoints.length < 2) throw new Error('a track needs at least two waypoints')
    this.waypoints = [...waypoints].sort((p, q) => p.time - q.time)
  }
  get start(): number {
    return this.waypoints[0].time
  }
  get end(): number {
    return this.waypoints[this.waypoints.length - 1].time
  }
  /** Position at `time`, or null when the track is not yet, or no longer, in motion. */
  positionAt(time: number): LngLat | null {
    if (time < this.start || time > this.end) return null
    for (let i = 1; i < this.waypoints.length; i += 1) {
      const p = this.waypoints[i - 1]
      const q = this.waypoints[i]
      if (time <= q.time) {
        const span = q.time - p.time
        return span === 0 ? q.position : slerp(p.position, q.position, (time - p.time) / span)
      }
    }
    return this.waypoints[this.waypoints.length - 1].position
  }
  /** Fraction of the whole track elapsed at `time`, clamped to [0, 1]. */
  progressAt(time: number): number {
    return Math.max(0, Math.min(1, (time - this.start) / (this.end - this.start)))
  }
  /**
   * The part of the path travelled by `time`, ending at the current position.
   * Cuts the densified geometry by fraction of point index, which is exact for a
   * single leg and approximate across legs of unequal length.
   */
  geometryUntil(time: number): LngLat[] {
    const here = this.positionAt(time)
    if (!here) return time > this.end ? this.geometry() : []
    if (this.waypoints.length === 2) {
      // Single leg: densify only the part flown, with points in proportion to its length.
      const start = this.waypoints[0].position
      const metres = haversineMetres(start, here)
      const n = Math.max(2, Math.min(64, Math.ceil(metres / 250_000)))
      return greatCirclePoints(start, here, n)
    }
    const all = this.geometry()
    const n = Math.floor(this.progressAt(time) * (all.length - 1))
    return unwrapAntimeridian([...all.slice(0, n + 1), here])
  }

  /**
   * The densified path with the time the track reaches every point, for
   * renderers that reveal it progressively. Legs are cut at about one point per
   * 250 km, never fewer than two segments nor more than 64, and the time within a
   * leg follows the fraction of arc, which is how `positionAt` moves along it.
   */
  timedGeometry(): Waypoint[] {
    const out: Waypoint[] = []
    for (let i = 1; i < this.waypoints.length; i += 1) {
      const p = this.waypoints[i - 1]
      const q = this.waypoints[i]
      const metres = haversineMetres(p.position, q.position)
      const n = Math.max(2, Math.min(64, Math.ceil(metres / 250_000)))
      const leg = greatCirclePoints(p.position, q.position, n)
      for (let j = i === 1 ? 0 : 1; j <= n; j += 1) out.push({ position: leg[j], time: p.time + ((q.time - p.time) * j) / n })
    }
    const positions = unwrapAntimeridian(out.map((w) => w.position))
    return out.map((w, k) => ({ position: positions[k], time: w.time }))
  }

  /** The path densified along great circles, for drawing. */
  geometry(): LngLat[] {
    const points: LngLat[] = []
    for (let i = 1; i < this.waypoints.length; i += 1) {
      const leg = greatCirclePoints(this.waypoints[i - 1].position, this.waypoints[i].position)
      points.push(...(i === 1 ? leg : leg.slice(1)))
    }
    return unwrapAntimeridian(points)
  }
}

/** Build waypoint times from a constant ground speed, starting at `startTime`. */
export function timeByGroundSpeed(positions: LngLat[], startTime: number, metresPerSecond: number): Waypoint[] {
  const out: Waypoint[] = [{ position: positions[0], time: startTime }]
  for (let i = 1; i < positions.length; i += 1) {
    const leg = haversineMetres(positions[i - 1], positions[i])
    out.push({ position: positions[i], time: out[i - 1].time + leg / metresPerSecond })
  }
  return out
}
