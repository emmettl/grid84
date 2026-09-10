/**
 * Boost-phase interception, the arithmetic. An interceptor must reach the
 * booster before burnout: detection takes about a minute, a decision some
 * seconds more, and what is left times the interceptor's closing speed is
 * the radius it must already be inside when the missile lifts. A space
 * layer's chance is then how many of its interceptors that circle holds:
 * the constellation spread over the sphere at its altitude, the expected
 * number inside the reach, and one minus the Poisson zero for at least
 * one. Round figures, stated as modelled; the Brilliant Pebbles and
 * Golden Dome cases of the defence lab give the constellation sizes.
 */
import { EARTH_RADIUS_METRES } from '../geo/geodesy.ts'

export interface BoostWindow {
  burnoutSeconds: number
  detectSeconds: number
  decideSeconds: number
  /** Seconds the interceptor has to fly. */
  availableSeconds: number
}

export interface SpaceLayer {
  name: string
  interceptors: number
  altitudeMetres: number
  /** Closing speed of a space-based interceptor toward the booster, m/s. */
  closingMs: number
}

export interface AirLayer {
  name: string
  /** Speed of an air-launched boost-phase interceptor, m/s. */
  missileMs: number
}

export const DETECT_SECONDS = 60
export const DECIDE_SECONDS = 30

export const SPACE_LAYERS: SpaceLayer[] = [
  { name: 'Brilliant Pebbles as proposed (4,600)', interceptors: 4_600, altitudeMetres: 500_000, closingMs: 5_000 },
  { name: 'A space layer of a thousand', interceptors: 1_000, altitudeMetres: 500_000, closingMs: 5_000 },
  { name: 'A space layer of two hundred', interceptors: 200, altitudeMetres: 500_000, closingMs: 5_000 },
]

export const AIR_LAYER: AirLayer = { name: 'An aircraft loitering with a hypersonic interceptor', missileMs: 1_500 }

export function boostWindow(burnoutSeconds: number, detectSeconds = DETECT_SECONDS, decideSeconds = DECIDE_SECONDS): BoostWindow {
  return { burnoutSeconds, detectSeconds, decideSeconds, availableSeconds: Math.max(0, burnoutSeconds - detectSeconds - decideSeconds) }
}

/** The ground radius an interceptor of this closing speed can cover in the window. */
export function reachMetres(window: BoostWindow, closingMs: number): number {
  return window.availableSeconds * closingMs
}

export interface SpaceChance {
  layer: SpaceLayer
  reachMetres: number
  /** Interceptors expected inside the reach at the moment of launch. */
  expected: number
  /** Chance at least one is there. */
  chance: number
}

export function spaceChance(window: BoostWindow, layer: SpaceLayer): SpaceChance {
  const reach = reachMetres(window, layer.closingMs)
  const shell = EARTH_RADIUS_METRES + layer.altitudeMetres
  // The reach as a cap of the shell: its area over the shell's, times the constellation.
  const fraction = Math.min(1, (reach * reach) / (4 * shell * shell))
  const expected = layer.interceptors * fraction
  return { layer, reachMetres: reach, expected, chance: 1 - Math.exp(-expected) }
}

/** How far the aircraft must loiter from the launch point, at most. */
export function airReachMetres(window: BoostWindow, layer: AirLayer = AIR_LAYER): number {
  return reachMetres(window, layer.missileMs)
}
