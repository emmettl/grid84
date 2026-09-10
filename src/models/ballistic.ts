import { EARTH_RADIUS_METRES, haversineMetres, type LngLat } from '../geo/geodesy.ts'

/**
 * Minimum-energy ballistic trajectory over a non-rotating spherical Earth
 * with no atmosphere after burnout. This is the textbook Keplerian solution
 * and it gives the right order of magnitude for flight time and apogee; it
 * is not a guidance model. Fidelity ceiling: point mass, impulsive burn.
 */
const MU = 3.986004418e14 // m^3/s^2

export interface BallisticPlan {
  rangeMetres: number
  /** Central angle between launch and target, radians. */
  centralAngle: number
  /** Burnout speed for the minimum-energy ellipse, m/s. */
  burnoutSpeed: number
  /** Flight-path angle at burnout above horizontal, radians. */
  flightPathAngle: number
  /** Time from burnout to impact, seconds. */
  flightSeconds: number
  /** Apogee height above the surface, metres. */
  apogeeMetres: number
}

export function minimumEnergyTrajectory(from: LngLat, to: LngLat): BallisticPlan {
  const R = EARTH_RADIUS_METRES
  const range = haversineMetres(from, to)
  const psi = range / R // central angle
  const half = psi / 2
  // Minimum-energy: flight-path angle γ = (π/2 − ψ/2)/2 = π/4 − ψ/4.
  const gamma = Math.PI / 4 - psi / 4
  // Velocity from the range equation with Q = v²R/μ: tan(ψ/2) = Q sinγ cosγ / (1 − Q cos²γ).
  // For minimum energy Q = 2 sin(ψ/2) / (1 + sin(ψ/2)).
  const Q = (2 * Math.sin(half)) / (1 + Math.sin(half))
  const v = Math.sqrt((Q * MU) / R)
  // Orbital elements of the transfer ellipse.
  const energy = (v * v) / 2 - MU / R
  const a = -MU / (2 * energy)
  const h = R * v * Math.cos(gamma)
  const e = Math.sqrt(1 - (h * h) / (MU * a))
  const apogee = a * (1 + e) - R
  // Time of flight via eccentric anomaly between the two surface crossings.
  const cosE = (1 - R / a) / e
  const E = Math.acos(Math.max(-1, Math.min(1, cosE))) // eccentric anomaly at impact (symmetric)
  const n = Math.sqrt(MU / (a * a * a))
  const tof = (2 * (Math.PI - E + e * Math.sin(E))) / n
  return { rangeMetres: range, centralAngle: psi, burnoutSpeed: v, flightPathAngle: gamma, flightSeconds: tof, apogeeMetres: apogee }
}

/**
 * Waypoints along the arc from launch to impact with height above the surface,
 * for drawing the trajectory rather than its ground track. Time is taken as
 * linear in the eccentric-anomaly fraction, which is the model's simplification.
 */
export function ballisticWaypoints(from: LngLat, to: LngLat, launchTime: number, arrivalTime: number, segments = 24): Array<{ position: LngLat; time: number; altitude: number }> {
  const plan = minimumEnergyTrajectory(from, to)
  const out: Array<{ position: LngLat; time: number; altitude: number }> = []
  for (let i = 0; i <= segments; i += 1) {
    const f = i / segments
    out.push({ position: slerpLngLat(from, to, f), time: launchTime + f * (arrivalTime - launchTime), altitude: Math.max(0, heightAt(plan, f)) })
  }
  return out
}

export function slerpLngLat(a: LngLat, b: LngLat, f: number): LngLat {
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

/** Height above the surface at fraction f of the flight (0 launch, 1 impact), metres. Symmetric arc. */
export function heightAt(plan: BallisticPlan, f: number): number {
  const R = EARTH_RADIUS_METRES
  const v = plan.burnoutSpeed
  const energy = (v * v) / 2 - MU / R
  const a = -MU / (2 * energy)
  const h = R * v * Math.cos(plan.flightPathAngle)
  const e = Math.sqrt(1 - (h * h) / (MU * a))
  const cosE0 = (1 - R / a) / e
  const E0 = Math.acos(Math.max(-1, Math.min(1, cosE0)))
  // Eccentric anomaly runs from E0 (launch, before apogee) through π (apogee) to 2π − E0 (impact).
  const E = E0 + f * (2 * Math.PI - 2 * E0)
  return a * (1 - e * Math.cos(E)) - R
}

/**
 * The powered phase. A missile does not leave the pad at burnout speed: it
 * climbs under thrust for one to five minutes, reaching burnout some tens
 * to hundreds of kilometres up and downrange, and only then coasts on the
 * ellipse. The profiles here are round figures from the open literature by
 * class and propellant, stated as reconstructed; the boost phase is the
 * only window a boost-phase interceptor has, which is why it is drawn.
 */
export interface BoostProfile {
  burnoutSeconds: number
  burnoutAltitudeMetres: number
  burnoutDownrangeMetres: number
  label: string
}

export type Propellant = 'solid' | 'liquid'

/**
 * The profile follows the system's class, its reach, not the distance of one
 * flight: a heavy burns its stages out whether it flies two thousand
 * kilometres or eight; only the burnout downrange is held inside the flight.
 */
export function boostProfileFor(kind: 'icbm' | 'slbm' | 'irbm' | 'bomber', classRangeMetres: number, propellant: Propellant = 'solid', distanceMetres = classRangeMetres): BoostProfile | null {
  if (kind === 'bomber') return null
  const rangeMetres = Number.isFinite(classRangeMetres) ? classRangeMetres : 12_000_000
  let profile: BoostProfile
  if (rangeMetres < 1_000_000) profile = { burnoutSeconds: 60, burnoutAltitudeMetres: 40_000, burnoutDownrangeMetres: 60_000, label: 'short-range, single stage' }
  else if (rangeMetres < 3_000_000) profile = { burnoutSeconds: 110, burnoutAltitudeMetres: 100_000, burnoutDownrangeMetres: 180_000, label: 'medium-range' }
  else if (rangeMetres < 5_500_000 && kind === 'irbm') profile = { burnoutSeconds: 150, burnoutAltitudeMetres: 150_000, burnoutDownrangeMetres: 280_000, label: 'intermediate-range' }
  else if (propellant === 'liquid') profile = { burnoutSeconds: 300, burnoutAltitudeMetres: 250_000, burnoutDownrangeMetres: 600_000, label: 'liquid-fuelled, three stages' }
  else profile = { burnoutSeconds: 180, burnoutAltitudeMetres: 200_000, burnoutDownrangeMetres: 400_000, label: kind === 'slbm' ? 'solid, submarine-launched' : 'solid, three stages' }
  // A short flight cannot spend most of its range under power.
  const downrange = Math.min(profile.burnoutDownrangeMetres, Math.max(1, distanceMetres) * 0.4)
  return { ...profile, burnoutDownrangeMetres: downrange }
}

export interface BoostedPlan {
  boost: BoostProfile
  burnoutPoint: LngLat
  /** The coast from burnout to impact. */
  free: BallisticPlan
  rangeMetres: number
  totalSeconds: number
}

/** Boost to the burnout point along the great circle, then the minimum-energy coast over the rest of the range. */
export function boostedTrajectory(from: LngLat, to: LngLat, boost: BoostProfile): BoostedPlan {
  const rangeMetres = haversineMetres(from, to)
  const f = rangeMetres > 0 ? boost.burnoutDownrangeMetres / rangeMetres : 0
  const burnoutPoint = slerpLngLat(from, to, Math.min(0.9, f))
  const free = minimumEnergyTrajectory(burnoutPoint, to)
  return { boost, burnoutPoint, free, rangeMetres, totalSeconds: boost.burnoutSeconds + free.flightSeconds }
}

/**
 * Waypoints for the whole flight: the powered climb, steep and slow at
 * first (downrange grows as the square of time, height a little faster
 * than linearly), then the coast from burnout altitude down to impact.
 */
export function boostedWaypoints(from: LngLat, to: LngLat, boost: BoostProfile, launchTime: number, segments = 24): Array<{ position: LngLat; time: number; altitude: number }> {
  const plan = boostedTrajectory(from, to, boost)
  const out: Array<{ position: LngLat; time: number; altitude: number }> = []
  const powered = 6
  for (let i = 0; i < powered; i += 1) {
    const u = i / powered
    out.push({ position: slerpLngLat(from, plan.burnoutPoint, u * u), time: launchTime + u * boost.burnoutSeconds, altitude: boost.burnoutAltitudeMetres * u ** 1.6 })
  }
  const burnoutTime = launchTime + boost.burnoutSeconds
  const arrival = launchTime + plan.totalSeconds
  for (let i = 0; i <= segments; i += 1) {
    const f = i / segments
    // The coast starts at burnout altitude and ends on the surface; the ellipse's own height rides on top.
    out.push({ position: slerpLngLat(plan.burnoutPoint, to, f), time: burnoutTime + f * (arrival - burnoutTime), altitude: Math.max(0, heightAt(plan.free, f) + boost.burnoutAltitudeMetres * (1 - f)) })
  }
  return out
}
