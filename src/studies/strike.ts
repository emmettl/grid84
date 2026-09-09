import { Track, type Waypoint } from '../engine/track.ts'
import type { Evidenced, EvidenceTier, Provenance } from '../evidence/evidence.ts'
import { haversineMetres } from '../geo/geodesy.ts'
import { allocate, megatons, type AllocationOptions, type Launcher, type Sortie, type SystemKind, type Target } from '../models/allocation.ts'
import { fate } from '../models/attrition.ts'
import { ballisticWaypoints, minimumEnergyTrajectory } from '../models/ballistic.ts'
import { BLAST_MODEL, promptEffects } from '../models/blast.ts'
import type { Entity, FalloutAssumption } from './study.ts'

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
  /** Attrition, or a function of the allocated sorties for calibration against a documented assurance. */
  attrition: StrikeAttrition | ((sorties: Sortie[]) => StrikeAttrition)
  /**
   * Cruise routes other than the straight great circle, such as through a
   * refuelling area; returns the waypoints from launch to arrival and the
   * provenance of that route, or null for the default.
   */
  cruiseRoute?: (launcher: Launcher, target: Target, launch: number, arrival: number) => { waypoints: Waypoint[]; provenance: Provenance } | null
  /** How the allocation was decided, for the provenance panel. */
  allocationRule: Provenance
  /** Tier and provenance of the vehicles' existence and posture. */
  vehicle: Evidenced
  /** Provenance of the routes: the great circle or the trajectory model. */
  route: { cruise: Provenance; ballistic: Provenance }
  /** Extra facts per struck target; the designation prefix names the target's category. */
  targetFacts?: (target: Target) => Array<Evidenced & { label: string; value: string }>
  targetCategory?: (target: Target) => string
  /** Burst height per target and, for surface bursts, the plume assumptions; default air. */
  burstFor?: (target: Target) => { burst: 'air' | 'surface'; fallout?: FalloutAssumption }
  /**
   * How warheads share a vehicle. A missile's reentry vehicles must fall within
   * the footprint of the first target chosen for it; a bomber's weapons go to
   * targets within a leg of each other; the bus splits after this fraction of
   * the flight. Defaults 300 km, 600 km and 0.12.
   */
  mirv?: { footprintMetres?: number; bomberLegMetres?: number; splitFraction?: number }
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
  /** The bomber penetration probability used, calibrated or given. */
  penetration: number
  /** Missiles and aircraft flown, as opposed to warheads carried. */
  vehicles: number
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

interface VehicleGroup {
  launcher: Launcher
  sorties: Sortie[]
}

/**
 * Group a launcher's allocated warheads into vehicles. Each vehicle starts
 * from the next unplaced warhead and takes the nearest others whose targets
 * lie within the footprint of its first, up to the launcher's load.
 */
export function groupVehicles(sorties: Sortie[], launcherById: Record<string, Launcher>, targetById: Record<string, Target>, footprintMetres: number, bomberLegMetres: number): VehicleGroup[] {
  const byLauncher = new Map<string, Sortie[]>()
  for (const s of sorties) {
    const list = byLauncher.get(s.launcherId) ?? []
    list.push(s)
    byLauncher.set(s.launcherId, list)
  }
  const out: VehicleGroup[] = []
  for (const [launcherId, list] of byLauncher) {
    const launcher = launcherById[launcherId]
    const load = Math.max(1, Math.floor(launcher.weaponsPerVehicle))
    if (load === 1) {
      for (const s of list) out.push({ launcher, sorties: [s] })
      continue
    }
    const limit = launcher.kind === 'bomber' ? bomberLegMetres : footprintMetres
    const remaining = [...list]
    while (remaining.length) {
      const seed = remaining.shift()!
      const seedPos = targetById[seed.targetId].position
      const near = remaining
        .map((s, i) => ({ i, d: haversineMetres(seedPos, targetById[s.targetId].position) }))
        .filter((x) => x.d <= limit)
        .sort((a, b) => a.d - b.d)
        .slice(0, load - 1)
        .map((x) => x.i)
        .sort((a, b) => b - a)
      const group = [seed]
      for (const i of near) group.push(remaining.splice(i, 1)[0])
      out.push({ launcher, sorties: group })
    }
  }
  return out
}

const fmtYield = (kt: number) => (kt >= 1_000 ? `${(kt / 1_000).toFixed(kt >= 10_000 ? 0 : 2)} MT` : `${kt} KT`)

export function enactStrike(o: StrikeOptions): StrikeResult {
  const result = allocate(o.launchers, o.targets, o.allocation)
  const attrition = typeof o.attrition === 'function' ? o.attrition(result.sorties) : o.attrition
  const launcherById = Object.fromEntries(o.launchers.map((l) => [l.id, l]))
  const targetById = Object.fromEntries(o.targets.map((t) => [t.id, t]))
  const entities: Entity[] = []
  const firstArrival: Record<string, FirstArrival> = {}
  let delivered = 0
  let lostReliability = 0
  let lostPenetration = 0
  const arrive = (targetId: string, time: number, yieldKt: number, kind: SystemKind) => {
    const fa = firstArrival[targetId]
    if (!fa) firstArrival[targetId] = { time, yieldKt, weapons: 1, kinds: new Set([kind]) }
    else {
      fa.time = Math.min(fa.time, time)
      fa.yieldKt = Math.max(fa.yieldKt, yieldKt)
      fa.weapons += 1
      fa.kinds.add(kind)
    }
  }
  const provenance = { ...o.vehicle.provenance, method: `${o.vehicle.provenance.method ? `${o.vehicle.provenance.method}. ` : ''}Assignment: ${o.allocationRule.method ?? o.allocationRule.source}` }
  const track = (id: string, name: string, designation: string, waypoints: Waypoint[], route: 'ballistic' | 'cruise', routeProvenance: Provenance): Entity => ({
    kind: 'track',
    id,
    name,
    designation,
    label: false,
    side: o.side,
    track: new Track(waypoints),
    reveal: 'progressive',
    evidence: o.vehicle.evidence,
    provenance,
    route: { evidence: route === 'ballistic' ? 'modelled' : 'reconstructed', provenance: routeProvenance },
    facts: [],
  })
  /** Cut a path at `endTime`, ending where the vehicle was lost. */
  const cut = (waypoints: Waypoint[], endTime: number): Waypoint[] => {
    const full = new Track(waypoints)
    const at = full.positionAt(endTime) ?? waypoints[0].position
    return [...waypoints.filter((w) => w.time < endTime), { position: at, time: endTime, altitude: full.altitudeAt(endTime) }]
  }

  const footprint = o.mirv?.footprintMetres ?? 300_000
  const bomberLeg = o.mirv?.bomberLegMetres ?? 600_000
  const splitFraction = o.mirv?.splitFraction ?? 0.12
  const vehicles = groupVehicles(result.sorties, launcherById, targetById, footprint, bomberLeg)
  let index = 0
  for (const v of vehicles) {
    const l = v.launcher
    index += 1
    const id = `${o.prefix}-s-${index}`
    const f = fate(`${o.prefix}:${l.id}:${v.sorties.map((s) => s.targetId).join('+')}:${index}`, l.kind, attrition.penetration, attrition.reliability)
    const launch = l.reactionSeconds
    if (l.kind === 'bomber') {
      // One aircraft visits its targets in turn; the first leg may go through a refuelling area.
      const speed = l.speedMs ?? 230
      const first = targetById[v.sorties[0].targetId]
      const directArrival = launch + haversineMetres(l.position, first.position) / speed
      const custom = o.cruiseRoute?.(l, first, launch, directArrival) ?? null
      const waypoints: Waypoint[] = custom ? [...custom.waypoints] : [{ position: l.position, time: launch }, { position: first.position, time: directArrival }]
      const arrivals: Array<{ sortie: Sortie; time: number }> = [{ sortie: v.sorties[0], time: waypoints[waypoints.length - 1].time }]
      for (let i = 1; i < v.sorties.length; i += 1) {
        const prev = targetById[v.sorties[i - 1].targetId]
        const next = targetById[v.sorties[i].targetId]
        const time = waypoints[waypoints.length - 1].time + haversineMetres(prev.position, next.position) / speed
        waypoints.push({ position: next.position, time })
        arrivals.push({ sortie: v.sorties[i], time })
      }
      const end = waypoints[waypoints.length - 1].time
      const endTime = f.delivered ? end : launch + (end - launch) * Math.max(f.lostAtFraction ?? 0, 0.001)
      const names = v.sorties.map((s) => targetById[s.targetId].name).join(' → ')
      const weapons = v.sorties.length
      entities.push(track(id, `${l.name} → ${names}`, `${l.kind.toUpperCase()} · ${weapons} WEAPON${weapons > 1 ? 'S' : ''} · ${fmtYield(v.sorties[0].yieldKt)}${f.delivered ? '' : ` · LOST (${f.cause?.toUpperCase()})`}`, f.delivered ? waypoints : cut(waypoints, endTime), 'cruise', custom ? custom.provenance : o.route.cruise))
      for (const a of arrivals) {
        if (f.delivered || a.time <= endTime) {
          delivered += 1
          arrive(a.sortie.targetId, a.time, a.sortie.yieldKt, l.kind)
        } else if (f.cause === 'reliability') lostReliability += 1
        else lostPenetration += 1
      }
      continue
    }
    // Ballistic: a single arc, or a bus that splits into its reentry vehicles after post-boost.
    const seed = targetById[v.sorties[0].targetId]
    const seedPlan = minimumEnergyTrajectory(l.position, seed.position)
    const seedArrival = launch + seedPlan.flightSeconds
    const boost = ballisticWaypoints(l.position, seed.position, launch, seedArrival)
    if (!f.delivered) {
      // A missile that fails at launch takes every warhead with it.
      lostReliability += v.sorties.length
      entities.push(track(id, `${l.name} → ${seed.name}`, `${l.kind.toUpperCase()} · ${v.sorties.length > 1 ? `${v.sorties.length} RV · ` : ''}${fmtYield(v.sorties[0].yieldKt)} · LOST (RELIABILITY)`, cut(boost, launch + (seedArrival - launch) * 0.001), 'ballistic', o.route.ballistic))
      continue
    }
    if (v.sorties.length === 1) {
      entities.push(track(id, `${l.name} → ${seed.name}`, `${l.kind.toUpperCase()} · ${fmtYield(v.sorties[0].yieldKt)}`, boost, 'ballistic', o.route.ballistic))
      delivered += 1
      arrive(seed.id, seedArrival, v.sorties[0].yieldKt, l.kind)
      continue
    }
    const splitTime = launch + (seedArrival - launch) * splitFraction
    const boostTrack = new Track(boost)
    const busWaypoints = cut(boost, splitTime)
    entities.push(track(id, `${l.name} → ${v.sorties.map((s) => targetById[s.targetId].name).join(', ')}`, `${l.kind.toUpperCase()} · BUS · ${v.sorties.length} RV OF ${fmtYield(v.sorties[0].yieldKt)}`, busWaypoints, 'ballistic', o.route.ballistic))
    v.sorties.forEach((s, k) => {
      const t = targetById[s.targetId]
      const own = ballisticWaypoints(l.position, t.position, launch, launch + minimumEnergyTrajectory(l.position, t.position).flightSeconds)
      const ownTrack = new Track(own)
      // From the split the vehicle leaves the bus's arc for its own over the next quarter of the flight.
      const blendEnd = splitTime + (ownTrack.end - launch) * 0.25
      const waypoints: Waypoint[] = []
      for (const w of own) {
        if (w.time <= splitTime) continue
        const wgt = w.time >= blendEnd ? 1 : (w.time - splitTime) / (blendEnd - splitTime)
        const b = boostTrack.positionAt(w.time)
        const ba = boostTrack.altitudeAt(w.time)
        if (!b || wgt >= 1) waypoints.push(w)
        else waypoints.push({ position: [b[0] + (w.position[0] - b[0]) * wgt, b[1] + (w.position[1] - b[1]) * wgt], time: w.time, altitude: ba + ((w.altitude ?? 0) - ba) * wgt })
      }
      const start = boostTrack.positionAt(splitTime) ?? l.position
      waypoints.unshift({ position: start, time: splitTime, altitude: boostTrack.altitudeAt(splitTime) })
      entities.push(track(`${id}-rv${k + 1}`, `${l.name} → ${t.name}`, `RV ${k + 1} OF ${v.sorties.length} · ${fmtYield(s.yieldKt)}`, waypoints, 'ballistic', o.route.ballistic))
      delivered += 1
      arrive(t.id, ownTrack.end, s.yieldKt, l.kind)
    })
  }
  for (const [targetId, fa] of Object.entries(firstArrival)) {
    const t = targetById[targetId]
    const category = o.targetCategory?.(t) ?? 'TARGET'
    const burst = o.burstFor?.(t) ?? { burst: 'air' as const }
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
      burst: burst.burst,
      fallout: burst.fallout,
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
      penetration: attrition.penetration,
      vehicles: vehicles.length,
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
