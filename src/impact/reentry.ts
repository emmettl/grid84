import { initialBearing, type LngLat } from '../geo/geodesy.ts'
import { slerpLngLat } from '../models/ballistic.ts'
import { destinationPoint } from '../geo/sector.ts'
import { Track } from '../engine/track.ts'
import type { Rgba, TrackSpec } from '../map/track-scene.ts'
import type { Attempt } from './run.ts'

/**
 * The last minute.
 *
 * A mark appearing on the ground is not an arrival. What the terminal phase
 * looks like from above is a thing coming down out of the sky on a bearing, at
 * a steep angle, very fast — and the bearing is not arbitrary: a weapon fired
 * from the American missile fields at a Russian one comes in over the pole,
 * and so does one fired the other way. That is a fact about great circles at
 * high latitudes and it is worth being able to see.
 *
 * What is drawn is the last hundred and twenty kilometres of altitude and
 * nothing before it. The whole flight is the ballistic model's business and
 * the atlas draws it; here the camera is forty kilometres across and the rest
 * of the trajectory is off the edge of the world.
 *
 * Everything here is modelled and stated:
 *
 *  - Reentry is taken to begin at 120 km, which is the altitude the literature
 *    generally uses for the start of the reentry phase.
 *  - The path is drawn straight. A real reentry vehicle is on a ballistic arc
 *    that drag bends slightly in the last few seconds; over this short a leg
 *    the difference would not be a pixel, and a straight line does not pretend
 *    to an aerodynamic model this engine does not have.
 *  - The angle is 23 degrees from the vertical, which is about what a
 *    minimum-energy intercontinental trajectory gives. A depressed or lofted
 *    shot arrives at a different angle and this does not model either.
 *  - The azimuth is the reverse bearing at the target of a great circle from
 *    the firing side's own missile fields. It is the direction the thing comes
 *    from, not a claim about which launcher fired it.
 */

/**
 * How high the drawn leg starts, by default.
 *
 * This length is a drawing convention and not a fact about the weapon. Reentry
 * properly begins around 120 km, and a leg drawn from there would stand three
 * times the height of the frame on every engagement this screen shows — the
 * camera here is between two and forty kilometres across. So the caller says
 * how much altitude fits its frame and the leg is drawn over that.
 *
 * The angle is the part that is modelled, and it does not change with the
 * length: whatever height the leg starts at, it comes down at 23 degrees from
 * the vertical, and the ground it covers follows from that.
 */
export const DEFAULT_ALTITUDE_METRES = 15_000
/** From the vertical, degrees: about a minimum-energy intercontinental arrival. */
export const REENTRY_ANGLE_DEG = 23
/** Seconds of flight in the drawn leg. */
export const REENTRY_SECONDS = 45

/** How far across the ground a leg of this height runs, at the arrival angle. */
export function groundRunMetres(altitudeMetres: number): number {
  return altitudeMetres * Math.tan((REENTRY_ANGLE_DEG * Math.PI) / 180)
}

/**
 * Where each side's warheads come from, for the azimuth and nothing else.
 * These are the centres of the two countries' land-based missile country —
 * the American northern plains and the Volga–Urals fields — and they are here
 * to point the arrow, not to name a launcher.
 */
export const LAUNCH_REGIONS: Record<'us' | 'su', LngLat> = {
  us: [-104, 45.5],
  su: [49, 53],
}

/** The bearing the warhead arrives from, degrees clockwise from north. */
export function arrivalBearing(impact: LngLat, side: 'us' | 'su'): number {
  return initialBearing(impact, LAUNCH_REGIONS[side])
}

/**
 * The drawn leg: from 120 km up, back along the arrival bearing, down to where
 * the warhead actually lands — which is the impact point and not the aim
 * point, because a miss misses from the beginning and not at the end.
 */
export function reentryTrack(attempt: Attempt, side: 'us' | 'su', options: { altitudeMetres?: number; segments?: number } = {}): Track {
  const altitude = options.altitudeMetres ?? DEFAULT_ALTITUDE_METRES
  const segments = options.segments ?? 24
  const downrange = groundRunMetres(altitude)
  const bearing = arrivalBearing(attempt.impact, side)
  const entry = destinationPoint(attempt.impact, bearing, downrange)
  const waypoints = []
  for (let i = 0; i <= segments; i += 1) {
    const f = i / segments
    /*
     * Interpolated along the great circle from the entry point to the impact,
     * rather than walked back out along the reverse bearing: an azimuth turns
     * as it runs, and over fifty kilometres at these latitudes walking back
     * the way it came lands a few hundred metres from where it started. A few
     * hundred metres is exactly the quantity this screen is about.
     */
    waypoints.push({
      position: slerpLngLat(entry, attempt.impact, f),
      time: f * REENTRY_SECONDS,
      altitude: altitude * (1 - f),
    })
  }
  return new Track(waypoints)
}

/**
 * A warhead that does not go off still arrives. About one in ten does not, and
 * on the ground the difference between the two is total — one leaves a crater
 * and the other leaves a hole with a warhead in it. So a dud comes down the
 * same path in grey: the flight happened, the detonation did not.
 */
export const DUD_LINE: Rgba = [0.72, 0.76, 0.79, 0.75]
export const DUD_MARK: Rgba = [0.82, 0.85, 0.88, 0.9]

/**
 * Wider than a study's tracks. There is one of these on the screen at a time
 * and it is the event, not one line in a thousand; at the tier's own 1.2
 * pixels it read as a scratch on a dark map.
 */
export const REENTRY_LINE_WIDTH = 2.4

/** The spec the track layer draws it from. */
export function reentrySpec(attempt: Attempt, side: 'us' | 'su', id: string, altitudeMetres?: number): TrackSpec {
  const dud = !attempt.arrived
  return {
    id,
    track: reentryTrack(attempt, side, { altitudeMetres }),
    route: 'modelled',
    evidence: 'reconstructed',
    side: 'attacker',
    vehicle: 'missile',
    reveal: 'progressive',
    lineWidth: REENTRY_LINE_WIDTH,
    ...(dud ? { lineColor: DUD_LINE, markColor: DUD_MARK } : {}),
  }
}
