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
