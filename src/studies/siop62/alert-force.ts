import { Track } from '../../engine/track.ts'
import type { Provenance } from '../../evidence/evidence.ts'
import type { LngLat } from '../../geo/geodesy.ts'
import { allocate, megatons, type Launcher, type Sortie, type Target } from '../../models/allocation.ts'
import { ATTRITION_MODEL, calibrate, DOCUMENTED_ASSURANCE, fate, RELIABILITY } from '../../models/attrition.ts'
import { minimumEnergyTrajectory } from '../../models/ballistic.ts'
import { BLAST_MODEL, promptEffects } from '../../models/blast.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import orderOfBattle from '../../../data/siop62/order-of-battle-1961.json'
import targetFile from '../../../data/siop62/targets-1956-priority.json'
import airfieldFile from '../../../data/siop62/airfields-1956-priority.json'

/**
 * SIOP//62 alert force enactment: option 1, the 1,004 delivery systems and
 * about 1,685 weapons that could launch on fifteen minutes' warning, from
 * the documented order of battle of mid-1961 to the 1956 study's
 * highest-priority complexes. The launchers and the totals are documented;
 * the strengths on each base are reconstructed by stated rules; every
 * assignment of a weapon to a target is inferred.
 */
const SAGAN: Provenance = { source: 'Sagan 1987', locator: 'briefing pp. 48–49; Table 1, 15 July 1961', url: 'https://archive.org/details/SIOP62TheNuclearWarPlanBriefingToPresidentKennedy' }
const EBB798: Provenance = { source: 'National Security Archive EBB 798', locator: '1961 estimate: 80 million Soviet dead from the alert force', url: 'https://nsarchive.gwu.edu/briefing-book/nuclear-vault/2022-07-14/long-classified-us-estimates-nuclear-war-casualties-during' }

interface RawLauncher {
  id: string
  name: string
  kind: string
  lon: number
  lat: number
  wing?: string
  note?: string
  aircraft?: number
  weapons?: number
  yieldKt?: number
  evidence: string
  positionEvidence: string
  source: string
  geocoded?: string
}

const REACTION_FIXED = 15 * 60
const REACTION_SEA = 2 * 3_600
const B52_MS = 845_000 / 3_600
const B47_MS = 800_000 / 3_600
const TACTICAL_MS = 900_000 / 3_600
const MACE_MS = 1_040_000 / 3_600

/** Documented SAC aircraft weapons on alert, 15 July 1961; the bomber bases are scaled to carry it. */
const SAC_AIRCRAFT_WEAPONS_ON_ALERT = 1_212

function buildLaunchers(): { launchers: Launcher[]; alertFraction: number; bomberWeaponsNominal: number } {
  const raw = (orderOfBattle as { launchers: RawLauncher[] }).launchers
  const bombers = raw.filter((l) => l.kind === 'b52' || l.kind === 'b52h' || l.kind === 'b47' || l.kind === 'b47r')
  const nominal = bombers.reduce((s, l) => s + (l.aircraft ?? 0) * (l.kind.startsWith('b52') ? 2 : 1), 0)
  const sacNominal = bombers.filter((l) => l.kind !== 'b47r').reduce((s, l) => s + (l.aircraft ?? 0) * (l.kind.startsWith('b52') ? 2 : 1), 0)
  const alertFraction = SAC_AIRCRAFT_WEAPONS_ON_ALERT / sacNominal
  const launchers: Launcher[] = []
  for (const l of raw) {
    const position: LngLat = [l.lon, l.lat]
    if (l.kind === 'b52' || l.kind === 'b52h') {
      launchers.push({ id: l.id, name: l.name, kind: 'bomber', position, weapons: Math.round((l.aircraft ?? 0) * 2 * alertFraction), weaponsPerVehicle: 2, rangeMetres: Infinity, yieldKt: 1_100, reactionSeconds: REACTION_FIXED, speedMs: B52_MS })
    } else if (l.kind === 'b47' || l.kind === 'b47r') {
      launchers.push({ id: l.id, name: l.name, kind: 'bomber', position, weapons: Math.round((l.aircraft ?? 0) * 1 * alertFraction), weaponsPerVehicle: 1, rangeMetres: l.kind === 'b47r' ? 4_500_000 : Infinity, yieldKt: 1_100, reactionSeconds: REACTION_FIXED, speedMs: B47_MS })
    } else if (l.kind === 'icbm') {
      launchers.push({ id: l.id, name: l.name, kind: 'icbm', position, weapons: l.weapons ?? 0, weaponsPerVehicle: 1, rangeMetres: 14_000_000, yieldKt: l.yieldKt ?? 1_440, reactionSeconds: REACTION_FIXED })
    } else if (l.kind === 'irbm') {
      launchers.push({ id: l.id, name: l.name, kind: 'irbm', position, weapons: l.weapons ?? 0, weaponsPerVehicle: 1, rangeMetres: 2_400_000, yieldKt: l.yieldKt ?? 1_440, reactionSeconds: REACTION_FIXED })
    } else if (l.kind === 'slbm') {
      launchers.push({ id: l.id, name: l.name, kind: 'slbm', position, weapons: l.weapons ?? 0, weaponsPerVehicle: 1, rangeMetres: 2_200_000, yieldKt: l.yieldKt ?? 600, reactionSeconds: REACTION_SEA })
    } else if (l.kind === 'tactical') {
      launchers.push({ id: l.id, name: l.name, kind: 'bomber', position, weapons: l.weapons ?? 0, weaponsPerVehicle: 1, rangeMetres: 1_800_000, yieldKt: l.yieldKt ?? 70, reactionSeconds: REACTION_FIXED, speedMs: TACTICAL_MS })
    } else if (l.kind === 'cruise') {
      launchers.push({ id: l.id, name: l.name, kind: 'bomber', position, weapons: l.weapons ?? 0, weaponsPerVehicle: 1, rangeMetres: 2_000_000, yieldKt: l.yieldKt ?? 1_100, reactionSeconds: REACTION_FIXED, speedMs: MACE_MS })
    }
  }
  return { launchers, alertFraction, bomberWeaponsNominal: nominal }
}

/** Priority offset that places every complex after every airfield: the study's first task is the Air Power Battle. */
const COMPLEX_AFTER_AIRFIELDS = 10_000

export interface TargetMeta {
  kind: 'airfield' | 'complex'
  categories?: string[]
}
export const TARGET_META: Record<string, TargetMeta> = {}

function buildTargets(): Target[] {
  const airfields = (airfieldFile as { targets: Array<{ be: string; priority: number; name: string; lat: number; lon: number }> }).targets.map((a) => {
    TARGET_META[`a-${a.be}`] = { kind: 'airfield' }
    return { id: `a-${a.be}`, name: a.name, priority: a.priority, position: [a.lon, a.lat] as LngLat }
  })
  const complexes = (targetFile as { targets: Array<{ complex: string; priority: number; name: string; lat: number; lon: number; categoryNames?: string[] }> }).targets.map((t) => {
    TARGET_META[`t-${t.complex}`] = { kind: 'complex', categories: t.categoryNames }
    return { id: `t-${t.complex}`, name: t.name, priority: t.priority + COMPLEX_AFTER_AIRFIELDS, position: [t.lon, t.lat] as LngLat }
  })
  return [...airfields, ...complexes]
}

export interface AlertForceSummary {
  launchers: number
  weapons: number
  delivered: number
  lostReliability: number
  lostPenetration: number
  penetration: number
  sorties: number
  targetsCovered: number
  airfieldsCovered: number
  complexesCovered: number
  megatons: number
  alertFraction: number
  bomberVehicles: number
}

function slerpTo(a: LngLat, b: LngLat, f: number): LngLat {
  const t = new Track([
    { position: a, time: 0 },
    { position: b, time: 1 },
  ])
  return t.positionAt(Math.max(0, Math.min(1, f))) ?? a
}

function sortieTiming(launcher: Launcher, sortie: Sortie, target: Target): { launch: number; arrival: number; route: 'ballistic' | 'cruise' } {
  const launch = launcher.reactionSeconds
  if (launcher.kind === 'bomber') {
    const speed = launcher.speedMs ?? B52_MS
    return { launch, arrival: launch + sortie.distanceMetres / speed, route: 'cruise' }
  }
  const plan = minimumEnergyTrajectory(launcher.position, target.position)
  return { launch, arrival: launch + plan.flightSeconds, route: 'ballistic' }
}

export function buildAlertForce(): { study: Study; summary: AlertForceSummary } {
  const { launchers, alertFraction } = buildLaunchers()
  const targets = buildTargets()
  const result = allocate(launchers, targets, { maxWeaponsPerTarget: 2 })
  const launcherById = Object.fromEntries(launchers.map((l) => [l.id, l]))
  const targetById = Object.fromEntries(targets.map((t) => [t.id, t]))
  const raw = Object.fromEntries((orderOfBattle as { launchers: RawLauncher[] }).launchers.map((l) => [l.id, l]))

  const entities: Entity[] = []
  const events: StudyEvent[] = []

  // Launcher sites, labelled.
  for (const l of launchers) {
    if (l.weapons === 0) continue
    const r = raw[l.id]
    entities.push({
      kind: 'site',
      id: l.id,
      name: l.name,
      designation: `${l.kind.toUpperCase()} · ${l.weapons} WEAPONS ON ALERT`,
      // Only the missile and theatre sites are labelled at globe zoom; bomber bases keep their marks.
      label: l.kind !== 'bomber' || (r.kind !== 'b52' && r.kind !== 'b52h' && r.kind !== 'b47' && r.kind !== 'b47r'),
      position: l.position,
      evidence: r.evidence === 'documented' ? 'documented' : 'inferred',
      provenance: { source: r.source, method: r.wing ?? r.note },
      facts: [
        { label: 'Weapons on alert', value: String(l.weapons), evidence: r.evidence === 'documented' && l.kind !== 'bomber' ? 'documented' : 'reconstructed', provenance: { source: 'Rule', method: l.kind === 'bomber' ? `Base strength × ${l.weaponsPerVehicle} weapons × alert fraction ${alertFraction.toFixed(2)}, the fraction chosen so SAC bases carry the documented 1,212 aircraft weapons` : 'Table 1, 15 July 1961' } },
        { label: 'Position', value: r.geocoded ?? 'hand-set', evidence: r.positionEvidence as 'documented' | 'reconstructed' | 'inferred', provenance: { source: 'Modern map' } },
      ],
    })
  }

  // Attrition: reliability and penetration, calibrated to the documented average assurance.
  const calibration = calibrate(result.sorties, DOCUMENTED_ASSURANCE)
  let delivered = 0
  let lostReliability = 0
  let lostPenetration = 0

  // Sorties as tracks; lost sorties end where they are lost. One effect per target at first delivered arrival.
  const firstArrival: Record<string, { time: number; yieldKt: number; weapons: number; kinds: Set<string> }> = {}
  let index = 0
  for (const s of result.sorties) {
    const l = launcherById[s.launcherId]
    const t = targetById[s.targetId]
    const timing = sortieTiming(l, s, t)
    index += 1
    const sortieId = `s-${index}`
    const f = fate(`${s.launcherId}:${s.targetId}:${index}`, s.kind, calibration.penetration)
    if (f.delivered) delivered += 1
    else if (f.cause === 'reliability') lostReliability += 1
    else lostPenetration += 1
    const endFraction = f.delivered ? 1 : (f.lostAtFraction ?? 0)
    const endTime = timing.launch + (timing.arrival - timing.launch) * Math.max(endFraction, 0.001)
    const endPosition: LngLat = f.delivered ? t.position : slerpTo(l.position, t.position, endFraction)
    entities.push({
      kind: 'track',
      id: sortieId,
      name: `${l.name} → ${t.name}`,
      designation: `${l.kind.toUpperCase()} · ${s.yieldKt >= 1_000 ? `${(s.yieldKt / 1_000).toFixed(2)} MT` : `${s.yieldKt} KT`}${f.delivered ? '' : ` · LOST (${f.cause?.toUpperCase()})`}`,
      label: false,
      track: new Track([
        { position: l.position, time: timing.launch },
        { position: endPosition, time: endTime },
      ]),
      reveal: 'progressive',
      evidence: 'inferred',
      provenance: { source: 'Allocation rule', method: 'Highest-priority targets first, nearest launcher in range, missiles before bombers; not a documented assignment' },
      route: { evidence: timing.route === 'ballistic' ? 'modelled' : 'reconstructed', provenance: { source: timing.route === 'ballistic' ? 'Minimum-energy trajectory' : 'Great circle at cruise speed, no refuelling' } },
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
    entities.push({
      kind: 'effect',
      id: `e-${targetId}`,
      name: t.name,
      designation: `${TARGET_META[targetId]?.kind === 'airfield' ? 'AIRFIELD' : 'COMPLEX'} · PRIORITY ${t.priority % COMPLEX_AFTER_AIRFIELDS} · ${fa.weapons} WEAPON${fa.weapons > 1 ? 'S' : ''} · ${[...fa.kinds].join('/').toUpperCase()}`,
      label: false,
      compact: true,
      center: t.position,
      time: fa.time,
      effects: promptEffects(fa.yieldKt),
      burst: 'air',
      evidence: 'modelled',
      provenance: { source: BLAST_MODEL },
      facts: [
        { label: '1956 priority', value: `${t.priority % COMPLEX_AFTER_AIRFIELDS} on the ${TARGET_META[targetId]?.kind === 'airfield' ? 'airfield' : 'complex'} list`, evidence: 'documented', provenance: { source: TARGET_META[targetId]?.kind === 'airfield' ? 'SAC AWRS 1959 (June 1956), airfield list, section 6' : 'SAC AWRS 1959 (June 1956), city list' } },
        ...(TARGET_META[targetId]?.categories?.length ? [{ label: 'Categories', value: TARGET_META[targetId].categories!.join(' · '), evidence: 'documented' as const, provenance: { source: 'Category code list, section 3' } }] : []),
        { label: 'Weapons assigned', value: `${fa.weapons}, largest ${fa.yieldKt >= 1_000 ? `${(fa.yieldKt / 1_000).toFixed(2)} Mt` : `${fa.yieldKt} kt`}`, evidence: 'inferred', provenance: { source: 'Allocation rule' } },
        { label: 'Exposure', value: 'Computed once per target with the largest weapon; overlapping weapons are not double counted', evidence: 'modelled', provenance: { source: 'Method' } },
      ],
    })
  }

  // Events: the documented sequence, and the waves as they leave.
  const byKind = (k: string) => result.sorties.filter((s) => s.kind === k).length
  events.push({ time: 0, text: `EXECUTION ORDER · OPTION 1 · ALERT FORCE · ${result.weaponsAssigned.toLocaleString('en-GB')} WEAPONS ON ${result.targetsCovered.toLocaleString('en-GB')} TARGETS · AIR POWER BATTLE FIRST (ALLOCATION INFERRED)` })
  events.push({ time: 1, text: 'SEQUENCE: BALLISTIC MISSILES · FORWARD AREAS · CONUS FORCES (DOCUMENTED)' })
  events.push({ time: REACTION_FIXED, text: `H+15 MIN · FIXED BASES LAUNCH · ${byKind('icbm')} ICBM · ${byKind('irbm')} IRBM · ${byKind('bomber')} BOMBER AND THEATRE SORTIES` })
  events.push({ time: REACTION_SEA, text: `H+2 H · POLARIS ON STATION LAUNCH · ${byKind('slbm')} MISSILES` })
  events.push({ time: REACTION_FIXED + 1, text: `DELIVERY ASSURANCE ${Math.round(DOCUMENTED_ASSURANCE * 100)}% (DOCUMENTED AVERAGE) · ${delivered} DELIVERED · ${lostReliability} RELIABILITY LOSSES · ${lostPenetration} LOST IN PENETRATION (MODELLED)` })
  const arrivals = Object.values(firstArrival).map((f) => f.time).sort((a, b) => a - b)
  if (arrivals.length) {
    events.push({ time: arrivals[0], text: 'FIRST DETONATION' })
    events.push({ time: arrivals[Math.floor(arrivals.length / 2)], text: 'HALF OF THE TARGETS STRUCK' })
    events.push({ time: arrivals[arrivals.length - 1], text: 'LAST DETONATION · OUTCOME CALCULATION COMPLETE WHEN THE SUM FINISHES' })
  }

  const summary: AlertForceSummary = {
    launchers: launchers.filter((l) => l.weapons > 0).length,
    weapons: result.weaponsAssigned,
    delivered,
    lostReliability,
    lostPenetration,
    penetration: calibration.penetration,
    sorties: result.sorties.length,
    targetsCovered: result.targetsCovered,
    airfieldsCovered: Object.keys(firstArrival).filter((id) => id.startsWith('a-')).length,
    complexesCovered: Object.keys(firstArrival).filter((id) => id.startsWith('t-')).length,
    megatons: megatons(result.sorties),
    alertFraction,
    bomberVehicles: Math.round(result.sorties.filter((s) => s.kind === 'bomber').length / 1.5),
  }

  const study: Study = {
    id: 'siop62-alert',
    title: 'SIOP//62 · ALERT FORCE',
    subtitle: `Option 1 · ${summary.weapons.toLocaleString('en-GB')} weapons from ${summary.launchers} launch sites to ${summary.airfieldsCovered} airfields and ${summary.complexesCovered} complexes · every assignment inferred`,
    bounds: { start: -600, end: 16 * 3_600 },
    view: { center: [60, 62], zoom: 1.5 },
    populationGrid: 'popc_1961',
    exposureWorkers: 4,
    outcomeReference: { label: 'JCS estimate, 1961, alert force, Soviet dead', value: 80_000_000, source: `${EBB798.source}: 80 million, 37 percent of the population` },
    omissions: [
      'Every weapon-to-target assignment is an illustration by a stated rule; no assignment is in the record',
      'Bomber refuelling and routing: great circles at cruise speed',
      `Attrition is statistical: ${ATTRITION_MODEL}; reliabilities ${Object.entries(RELIABILITY).map(([k, v]) => `${k} ${v.value} (${v.evidence})`).join(', ')}; bomber penetration solved as ${calibration.penetration.toFixed(2)}`,
      'Non-all-weather forces, 22 percent of the force carrying 16 percent of the weapons, had a further planning factor the briefing does not state',
      'Soviet air defence and any Soviet response',
      'Airfields: a first-pass transcription reads about half of the 1,100 in the release; the Air Power Battle is under-represented by that much',
      'Yields: Mk-28 class assumed for bombers; the alert-force megatonnage check is on the readout',
      'Population exposure is per target with the largest weapon; overlapping targets are summed, so cities within reach of several targets are counted more than once',
    ],
    events,
    entities,
  }
  return { study, summary }
}

export const ALERT_FORCE = buildAlertForce()

/** The documented figures the enactment should be read against. */
export const ALERT_FORCE_DOCUMENTED = {
  systems: 1_004,
  weapons: 1_685,
  megatons: 1_798,
  tableWeapons: 1_530,
  provenance: SAGAN,
}

export function alertForceCheck(): Array<{ label: string; enacted: string; documented: string }> {
  const s = ALERT_FORCE.summary
  const fmt = (v: number) => Math.round(v).toLocaleString('en-GB')
  return [
    { label: 'Weapons launched', enacted: fmt(s.weapons), documented: `${fmt(ALERT_FORCE_DOCUMENTED.weapons)} (briefing) · ${fmt(ALERT_FORCE_DOCUMENTED.tableWeapons)} (Table 1)` },
    { label: 'Megatons', enacted: fmt(s.megatons), documented: fmt(ALERT_FORCE_DOCUMENTED.megatons) },
    { label: 'Weapons delivered', enacted: `${fmt(s.delivered)} (${fmt(s.lostReliability)} reliability, ${fmt(s.lostPenetration)} penetration losses)`, documented: `assurance averaged ${Math.round(DOCUMENTED_ASSURANCE * 100)}% (JSTPS history); bomber penetration solved as ${s.penetration.toFixed(2)}` },
    { label: 'Targets covered', enacted: `${fmt(s.targetsCovered)} (${s.airfieldsCovered} airfields, ${s.complexesCovered} complexes)`, documented: '1,060 DGZs in the full plan, about 800 of them military; the alert force struck the highest-priority ones' },
    { label: 'Launch sites', enacted: fmt(s.launchers), documented: '112 bases in the plan' },
  ]
}
