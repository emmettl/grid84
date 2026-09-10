import { Track } from '../engine/track.ts'
import type { LngLat } from '../geo/geodesy.ts'
import type { TrackSpec } from '../map/track-scene.ts'
import { ballisticWaypoints, minimumEnergyTrajectory } from '../models/ballistic.ts'
import type { Posture1983 } from '../studies/window83/window.ts'
import type { Plan } from './model.ts'

/**
 * What the globe shows while the machine searches: salvos from the plan
 * under evaluation, flown as real minimum-energy trajectories rather than
 * drawn as lines on the ground. The arc a warhead takes is most of the
 * argument of 1983 — how long the other side has to decide — so it is worth
 * seeing it leave the atmosphere and come back down.
 *
 * Both sides' boats are here as well as their silos, because the boats are
 * the short-flight-time half of the problem: a Yankee on patrol in the
 * western Atlantic is fifteen minutes from the bomber bases, where a
 * missile out of a Kazakh field is thirty from anywhere. The solver has
 * always counted them; this draws them.
 */

export interface SalvoOptions {
  /** How many trajectories to draw at once. */
  count: number
  /** Seconds over which the launches are spread. */
  spread: number
  gen: () => number
}

interface Source {
  from: LngLat
  to: LngLat
  side: 'attacker' | 'defender'
  kind: 'icbm' | 'slbm'
  label: string
}

const pick = <T,>(xs: T[], gen: () => number): T | null => (xs.length === 0 ? null : xs[Math.floor(gen() * xs.length)])

/** Every launch the plan permits, as a pool to draw salvos from. */
function sources(posture: Posture1983, plan: Plan, gen: () => number): Source[] {
  const out: Source[] = []
  const forward = posture.sovietBoats.filter((b) => b.forward)
  const bastion = posture.sovietBoats.filter((b) => !b.forward)
  const suTargets = plan.sovietRule === 'countervalue' ? posture.usCities : plan.sovietRule === 'counterforce' ? posture.siloTargets : gen() < 0.5 ? posture.usCities : posture.siloTargets
  const usTargets = plan.usRule === 'countervalue' ? posture.sovietCities : plan.usRule === 'counterforce' ? posture.sovietForces : gen() < 0.5 ? posture.sovietCities : posture.sovietForces
  if (plan.sovietOption >= 0.05) {
    // The heavy fields on the American forces and cities; the forward boats on the bomber bases and the command, which is what they are forward for.
    for (let i = 0; i < 3; i += 1) {
      const from = pick(posture.sovietHeavy, gen)
      const to = pick(suTargets, gen)
      if (from && to) out.push({ from: from.position, to: to.position, side: 'attacker', kind: 'icbm', label: 'SS-18/19' })
    }
    const boat = pick(forward, gen)
    const base = pick([...posture.usBases, ...posture.usCommand], gen)
    if (boat && base) out.push({ from: boat.position, to: base.position, side: 'attacker', kind: 'slbm', label: 'R-27 · Yankee, western Atlantic' })
    // The bastion boats are the reserve, and they are held for the cities.
    const held = pick(bastion, gen)
    const city = pick(posture.usCities, gen)
    if (held && city && gen() < 0.5) out.push({ from: held.position, to: city.position, side: 'attacker', kind: 'slbm', label: 'R-29 · Delta, Barents bastion' })
  }
  if (plan.usOption >= 0.05) {
    for (let i = 0; i < 2; i += 1) {
      const from = pick(posture.silos, gen)
      const to = pick(usTargets, gen)
      if (from && to) out.push({ from: from.position, to: to.position, side: 'defender', kind: 'icbm', label: 'Minuteman' })
    }
    for (let i = 0; i < 2; i += 1) {
      const from = pick(posture.usSlbmAtSea, gen)
      const to = pick(usTargets, gen)
      if (from && to) out.push({ from: from.position, to: to.position, side: 'defender', kind: 'slbm', label: 'Poseidon/Trident on patrol' })
    }
  }
  return out
}

/**
 * A salvo of trajectories, staggered over the spread, each flown on its own
 * minimum-energy ellipse: apogee where the range puts it, flight time as
 * the range gives it. The whole thing lasts the longest flight plus the
 * spread, which is what the caller runs its clock over.
 */
export function salvo(posture: Posture1983, plan: Plan, options: SalvoOptions): { specs: TrackSpec[]; span: number } {
  const specs: TrackSpec[] = []
  let span = 0
  const pool = sources(posture, plan, options.gen)
  for (let i = 0; i < options.count && pool.length > 0; i += 1) {
    const s = pool[Math.floor(options.gen() * pool.length)]
    const plan83 = minimumEnergyTrajectory(s.from, s.to)
    const launch = options.gen() * options.spread
    const arrival = launch + plan83.flightSeconds
    span = Math.max(span, arrival)
    const waypoints = ballisticWaypoints(s.from, s.to, launch, arrival, 32)
    specs.push({
      id: `wopr-${i}`,
      track: new Track(waypoints.map((w) => ({ position: w.position, time: w.time, altitude: w.altitude }))),
      route: 'modelled',
      evidence: s.side === 'attacker' ? 'reconstructed' : 'reconstructed',
      side: s.side,
      vehicle: 'missile',
      reveal: 'progressive',
    })
  }
  return { specs, span }
}
