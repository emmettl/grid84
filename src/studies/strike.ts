import { Track } from '../engine/track.ts'
import type { Evidenced, EvidenceTier, Provenance } from '../evidence/evidence.ts'
import type { LngLat } from '../geo/geodesy.ts'
import { allocate, megatons, type AllocationOptions, type Launcher, type Sortie, type SystemKind, type Target } from '../models/allocation.ts'
import { fate } from '../models/attrition.ts'
import { ballisticWaypoints, minimumEnergyTrajectory } from '../models/ballistic.ts'
import { BLAST_MODEL, promptEffects } from '../models/blast.ts'
import type { Entity } from './study.ts'

/**
 * One side's strike, enacted: allocation by a stated rule, a timed track per
 * weapon, attrition by deterministic hash, and one compact effect per target
 * at the first delivered arrival. The SIOP//62 alert force grew its own
 * version of this with 1956-specific facts; this is the general form the
 * later studies share. Every sortie it produces is inferred, and says so.
 */

export interface StrikeAttrition {
  reliability: Record<SystemKind, number>
  /** Probability a working bomber gets through. */
  penetration: number
  note: string
}

export interface StrikeOptions {
  /** Prefix for entity ids, so two strikes can share a study. */
  prefix: string
  side: 'attacker' | 'defender'
  launchers: Launcher[]
  targets: Target[]
  allocation: AllocationOptions
  attrition: StrikeAttrition
  /** How the allocation was decided, for the provenance panel. */
  allocationRule: Provenance
  /** Tier and provenance of the vehicles' existence and posture. */
  vehicle: Evidenced
  /** Provenance of the routes: the great circle or the trajectory model. */
  route: { cruise: Provenance; ballistic: Provenance }
  /** Extra facts per struck target; the designation prefix names the target's category. */
  targetFacts?: (target: Target) => Array<Evidenced & { label: string; value: string }>
  targetCategory?: (target: Target) => string
}

export interface FirstArrival {
  time: number
  yieldKt: number
  weapons: number
  kinds: Set<SystemKind>
}

export interface StrikeSummary {
  weapons: number
  sorties: number
  delivered: number
  lostReliability: number
  lostPenetration: number
  targetsCovered: number
  unassigned: number
  megatons: number
  firstDetonation: number
  lastDetonation: number
}

export interface StrikeResult {
  entities: Entity[]
  sorties: Sortie[]
  firstArrival: Record<string, FirstArrival>
  summary: StrikeSummary
}

export function sortieTiming(launcher: Launcher, sortie: Sortie, target: Target): { launch: number; arrival: number; route: 'ballistic' | 'cruise' } {
  const launch = launcher.reactionSeconds
  if (launcher.kind === 'bomber') {
    const speed = launcher.speedMs ?? 230
    return { launch, arrival: launch + sortie.distanceMetres / speed, route: 'cruise' }
  }
  const plan = minimumEnergyTrajectory(launcher.position, target.position)
  return { launch, arrival: launch + plan.flightSeconds, route: 'ballistic' }
}

const fmtYield = (kt: number) => (kt >= 1_000 ? `${(kt / 1_000).toFixed(kt >= 10_000 ? 0 : 2)} MT` : `${kt} KT`)

export function enactStrike(o: StrikeOptions): StrikeResult {
  const result = allocate(o.launchers, o.targets, o.allocation)
  const launcherById = Object.fromEntries(o.launchers.map((l) => [l.id, l]))
  const targetById = Object.fromEntries(o.targets.map((t) => [t.id, t]))
  const entities: Entity[] = []
  const firstArrival: Record<string, FirstArrival> = {}
  let delivered = 0
  let lostReliability = 0
  let lostPenetration = 0
  let index = 0
  for (const s of result.sorties) {
    const l = launcherById[s.launcherId]
    const t = targetById[s.targetId]
    const timing = sortieTiming(l, s, t)
    index += 1
    const id = `${o.prefix}-s-${index}`
    const f = fate(`${o.prefix}:${s.launcherId}:${s.targetId}:${index}`, s.kind, o.attrition.penetration, o.attrition.reliability)
    if (f.delivered) delivered += 1
    else if (f.cause === 'reliability') lostReliability += 1
    else lostPenetration += 1
    const endFraction = f.delivered ? 1 : Math.max(f.lostAtFraction ?? 0, 0.001)
    const endTime = timing.launch + (timing.arrival - timing.launch) * endFraction
    const full = new Track(
      timing.route === 'ballistic'
        ? ballisticWaypoints(l.position, t.position, timing.launch, timing.arrival)
        : [
            { position: l.position, time: timing.launch },
            { position: t.position, time: timing.arrival },
          ],
    )
    const endPosition: LngLat = f.delivered ? t.position : (full.positionAt(endTime) ?? l.position)
    const endAltitude = f.delivered ? 0 : full.altitudeAt(endTime)
    entities.push({
      kind: 'track',
      id,
      name: `${l.name} → ${t.name}`,
      designation: `${l.kind.toUpperCase()} · ${fmtYield(s.yieldKt)}${f.delivered ? '' : ` · LOST (${f.cause?.toUpperCase()})`}`,
      label: false,
      side: o.side,
      track: f.delivered ? full : new Track([...full.waypoints.filter((w) => w.time < endTime), { position: endPosition, time: endTime, altitude: endAltitude }]),
      reveal: 'progressive',
      evidence: o.vehicle.evidence,
      provenance: { ...o.vehicle.provenance, method: `${o.vehicle.provenance.method ? `${o.vehicle.provenance.method}. ` : ''}Assignment: ${o.allocationRule.method ?? o.allocationRule.source}` },
      route: { evidence: timing.route === 'ballistic' ? 'modelled' : 'reconstructed', provenance: timing.route === 'ballistic' ? o.route.ballistic : o.route.cruise },
      facts: [],
    })
    if (!f.delivered) continue
    const fa = firstArrival[s.targetId]
    if (!fa) firstArrival[s.targetId] = { time: timing.arrival, yieldKt: s.yieldKt, weapons: 1, kinds: new Set([l.kind]) }
    else {
      fa.time = Math.min(fa.time, timing.arrival)
      fa.yieldKt = Math.max(fa.yieldKt, s.yieldKt)
      fa.weapons += 1
      fa.kinds.add(l.kind)
    }
  }
  for (const [targetId, fa] of Object.entries(firstArrival)) {
    const t = targetById[targetId]
    const category = o.targetCategory?.(t) ?? 'TARGET'
    entities.push({
      kind: 'effect',
      id: `${o.prefix}-e-${targetId}`,
      name: t.name,
      designation: `${category} · ${fa.weapons} WEAPON${fa.weapons > 1 ? 'S' : ''} · ${[...fa.kinds].join('/').toUpperCase()} · LARGEST ${fmtYield(fa.yieldKt)}`,
      label: false,
      compact: true,
      side: o.side,
      center: t.position,
      time: fa.time,
      effects: promptEffects(fa.yieldKt),
      burst: 'air',
      evidence: 'modelled',
      provenance: { source: BLAST_MODEL },
      facts: [
        ...(o.targetFacts?.(t) ?? []),
        { label: 'Weapons assigned', value: `${fa.weapons}, largest ${fmtYield(fa.yieldKt).toLowerCase()}`, evidence: 'inferred', provenance: o.allocationRule },
        { label: 'Exposure', value: 'Computed once per target with the largest weapon; overlapping weapons are not double counted', evidence: 'modelled', provenance: { source: 'Method' } },
      ],
    })
  }
  const arrivals = Object.values(firstArrival)
    .map((f) => f.time)
    .sort((a, b) => a - b)
  const available = o.launchers.reduce((s, l) => s + l.weapons, 0)
  return {
    entities,
    sorties: result.sorties,
    firstArrival,
    summary: {
      weapons: result.weaponsAssigned,
      sorties: result.sorties.length,
      delivered,
      lostReliability,
      lostPenetration,
      targetsCovered: result.targetsCovered,
      unassigned: available - result.weaponsAssigned,
      megatons: megatons(result.sorties),
      firstDetonation: arrivals[0] ?? 0,
      lastDetonation: arrivals[arrivals.length - 1] ?? 0,
    },
  }
}

/** A site entity for a launcher, with the facts the order of battle records. */
export function launcherSite(l: Launcher, o: { side: 'attacker' | 'defender'; designation: string; evidence: EvidenceTier; provenance: Provenance; positionEvidence: EvidenceTier; label?: boolean; facts?: Array<Evidenced & { label: string; value: string }> }): Entity {
  return {
    kind: 'site',
    id: l.id,
    name: l.name,
    designation: o.designation,
    label: o.label,
    position: l.position,
    evidence: o.evidence,
    provenance: o.provenance,
    facts: [...(o.facts ?? []), { label: 'Position', value: 'Read from the modern map', evidence: o.positionEvidence, provenance: { source: 'Photon geocoding of the base or town name; patrol areas hand-set' } }],
  }
}
