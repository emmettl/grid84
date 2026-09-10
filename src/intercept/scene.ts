import { Track } from '../engine/track.ts'
import type { LngLat } from '../geo/geodesy.ts'
import { haversineMetres } from '../geo/geodesy.ts'
import type { TrackSpec } from '../map/track-scene.ts'
import { ballisticWaypoints, minimumEnergyTrajectory, slerpLngLat } from '../models/ballistic.ts'
import { absentee, attempt, reachMetres, window as boostWindow, type Attempt, type Engagement, type Phase } from '../models/intercept.ts'
import { FORCES, type ForceSite } from '../atlas/forces.ts'
import us from '../../data/winter/us-2023.json'

/**
 * One engagement on the globe: a real launcher, a real city, a real
 * interceptor site, and whatever the arithmetic says happens between them.
 *
 * The launch points are the order of battle the atlas already carries. The
 * targets are the most populous cells of the 2025 grid in the United
 * States, the same list the winter mode marks its fires with. The two
 * interceptor sites are the ones the ground-based system is deployed at,
 * which are not secret.
 */

export interface InterceptorSite {
  id: string
  name: string
  position: LngLat
  note: string
}

/** The two sites the American midcourse system is deployed at. */
export const INTERCEPTOR_SITES: InterceptorSite[] = [
  { id: 'greely', name: 'Fort Greely, Alaska', position: [-145.74, 63.95], note: 'Forty of the forty-four ground-based interceptors' },
  { id: 'vandenberg', name: 'Vandenberg, California', position: [-120.52, 34.75], note: 'The remaining four' },
]

const CITIES = (us as { targets: Array<{ lon: number; lat: number; population: number }> }).targets

export interface Scenario {
  id: string
  name: string
  /** Which force the threat comes from. */
  power: ForceSite['side']
  note: string
}

export const SCENARIOS: Scenario[] = [
  { id: 'nk', name: 'North Korea', power: 'nk', note: 'The case the ground-based system was built for: a handful of missiles, no decoys assumed' },
  { id: 'cn', name: 'China', power: 'cn', note: 'A force with decoys and numbers, and no defence has ever been sized for it' },
  { id: 'ru', name: 'Russia', power: 'ru', note: 'The force the treaties were written about instead of defending against' },
]

export interface Shot {
  from: ForceSite
  to: LngLat
  toPopulation: number
  site: InterceptorSite
  phase: Phase
  /** Seconds from launch to arrival, and the moment the intercept is attempted. */
  flightSeconds: number
  interceptSeconds: number
  interceptPoint: LngLat
  interceptAltitudeMetres: number
  engagement: Engagement
  attempt: Attempt
  specs: TrackSpec[]
  /** How long the whole thing runs for, seconds of scene time. */
  span: number
}

/** Where in the flight each phase is engaged, as a fraction of the way there. */
const PHASE_FRACTION: Record<Phase, number> = { boost: 0.04, midcourse: 0.55, glide: 0.5, terminal: 0.97 }

export interface ShotOptions {
  scenario: Scenario
  phase: Phase
  decoys: number
  constellation: number
  /** Seconds the booster burns, for the boost case. */
  burnSeconds: number
}

/**
 * Build one engagement. The threat flies a minimum-energy arc from a real
 * launcher to a real city; the interceptor flies its own arc from its site
 * to wherever the threat will be when it gets there. Whether it kills is
 * the model's, not the drawing's.
 */
export function shot(options: ShotOptions, gen: () => number): Shot {
  const launchers = FORCES.filter((f) => f.side === options.scenario.power && (f.kind === 'icbm' || f.kind === 'slbm'))
  const from = launchers[Math.floor(gen() * launchers.length)] ?? FORCES[0]
  const city = CITIES[Math.floor(gen() * Math.min(60, CITIES.length))]
  const to: LngLat = [city.lon, city.lat]
  const plan = minimumEnergyTrajectory(from.position, to)
  const flightSeconds = plan.flightSeconds
  const fraction = PHASE_FRACTION[options.phase]
  const interceptSeconds = flightSeconds * fraction
  const interceptPoint = slerpLngLat(from.position, to, fraction)
  const threat = ballisticWaypoints(from.position, to, 0, flightSeconds, 40)
  const interceptAltitudeMetres = threat.reduce((best, w) => (Math.abs(w.time - interceptSeconds) < Math.abs(best.time - interceptSeconds) ? w : best), threat[0]).altitude

  // The interceptor: the nearest site, flying its own arc to arrive at the same moment.
  const site = [...INTERCEPTOR_SITES].sort((a, b) => haversineMetres(a.position, interceptPoint) - haversineMetres(b.position, interceptPoint))[0]
  const interceptorFlight = Math.min(interceptSeconds * 0.8, 600)
  const launchAt = Math.max(0, interceptSeconds - interceptorFlight)
  const interceptorWaypoints = ballisticWaypoints(site.position, interceptPoint, launchAt, interceptSeconds, 24)

  const engagement = engagementFor(options, interceptSeconds)
  const result = attempt(engagement, gen)

  const specs: TrackSpec[] = [
    {
      id: 'threat',
      // A kill stops the threat at the intercept point; anything else lets it arrive.
      track: new Track((result.outcome === 'killed' ? threat.filter((w) => w.time <= interceptSeconds) : threat).map((w) => ({ position: w.position, time: w.time, altitude: w.altitude }))),
      route: 'modelled',
      evidence: 'reconstructed',
      side: 'attacker',
      vehicle: 'missile',
      reveal: 'progressive',
    },
  ]
  if (engagement.expectedShooters === undefined || result.outcome !== 'no shot') {
    specs.push({
      id: 'interceptor',
      track: new Track(interceptorWaypoints.map((w) => ({ position: w.position, time: w.time, altitude: w.altitude }))),
      route: 'modelled',
      evidence: 'modelled',
      side: 'defender',
      vehicle: 'missile',
      reveal: 'progressive',
    })
  }

  return {
    from,
    to,
    toPopulation: city.population,
    site,
    phase: options.phase,
    flightSeconds,
    interceptSeconds,
    interceptPoint,
    interceptAltitudeMetres,
    engagement,
    attempt: result,
    specs,
    span: result.outcome === 'killed' ? interceptSeconds + 30 : flightSeconds,
  }
}

/**
 * The engagement's own numbers, per phase. The tracking figures are round
 * and are stated as modelled; what they are not is a probability taken from
 * a test range and applied to a war.
 */
export function engagementFor(options: ShotOptions, interceptSeconds: number): Engagement {
  if (options.phase === 'boost') {
    const w = boostWindow(options.burnSeconds)
    const reach = reachMetres(w, 5_000)
    return {
      phase: 'boost',
      expectedShooters: absentee(reach, options.constellation, 500_000).expected,
      divertMs: 150,
      handoverSeconds: Math.max(2, w.availableSeconds / 4),
      closingSpeedMs: 5_000,
      trackErrorMetres: 40,
      timingErrorSeconds: 0.02,
    }
  }
  if (options.phase === 'terminal') {
    return { phase: 'terminal', decoys: 0, divertMs: 200, handoverSeconds: 4, closingSpeedMs: 3_000, trackErrorMetres: 15, timingErrorSeconds: 0.004 }
  }
  return {
    phase: 'midcourse',
    decoys: options.decoys,
    divertMs: 150,
    handoverSeconds: Math.min(20, interceptSeconds / 40),
    closingSpeedMs: 10_000,
    trackErrorMetres: 20,
    timingErrorSeconds: 0.008,
  }
}
