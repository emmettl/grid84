import { Track, timeByGroundSpeed } from '../../engine/track.ts'
import type { Evidenced, EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import type { LngLat } from '../../geo/geodesy.ts'
import type { Launcher, SystemKind, Target } from '../../models/allocation.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import { enactStrike, launcherSite, type StrikeAttrition, type StrikeResult } from '../strike.ts'
import orderOfBattle from '../../../data/defcon3/order-of-battle-1973.json'
import alertFile from '../../../data/defcon3/alert-1973.json'
import giantFile from '../../../data/defcon3/alert-1969.json'
import citiesFile from '../../../data/defcon3/us-cities-1970.json'
import urbanFile from '../../../data/defcon3/us-urban-1973.json'
import { haversineMetres } from '../../geo/geodesy.ts'
import targetFile from '../../../data/siop62/targets-1956-priority.json'

/**
 * DEFCON 3, 24 to 25 October 1973. Two studies from one order of battle:
 * the posture, a ladder of documented messages climbed on the clock of one
 * night with the forces of both sides drawn where they stood; and the
 * execution, what the plan of the day would have done with that force had
 * the ladder been climbed to the top. Nobody came close, and the second
 * study says so on its readout.
 */

interface RawLauncher {
  side: 'us' | 'su'
  id: string
  name: string
  kind: 'icbm' | 'bomber' | 'slbm' | 'slbm-port'
  lon: number
  lat: number
  missiles?: number
  weapons?: number
  aircraft?: number
  weaponsPerAircraft?: number
  yieldKt?: number
  boats?: number
  model?: string
  squadrons?: Array<{ missiles: number; version: string; warheads: number; yieldKt: number }>
  note: string
  evidence: string
  positionEvidence: string
  source: string
  geocoded: string
}

const RAW = (orderOfBattle as { launchers: RawLauncher[]; rules: { b52: { groundAlert: number } } }).launchers
const RULES = (orderOfBattle as { rules: { b52: { groundAlert: number }; ssbn: { note: string } } }).rules
const ALERT = alertFile as unknown as {
  title: string
  zero: string
  zeroNote: string
  steps: Array<{ hours: number; text: string; evidence: string; source: string; camera?: { center: [number, number]; zoom: number }; action?: string }>
  movements: { 'guam-recall': { from: [number, number]; aircraft: number; speedKmh: number; note: string }; 'sixth-fleet': Array<{ id: string; name: string; from: [number, number]; to: [number, number]; speedKmh: number; note: string }> }
  sources: string[]
}

const GIANT = giantFile as unknown as {
  title: string
  zeroNote: string
  steps: Array<{ days: number; text: string; evidence: string; source: string; camera?: { center: [number, number]; zoom: number }; action?: string }>
  giantLance: { aircraft: number; perSortie: number; vigilHours: number; waves: number; bases: Array<{ id: string; name: string; lon: number; lat: number; evidence: string; source: string }>; orbit: { name: string; points: Array<[number, number]>; evidence: string; source: string }; speedKmh: number }
  naval: Array<{ id: string; name: string; lon: number; lat: number }>
  sources: string[]
}

const DATABOOK: Provenance = { source: 'Cochran, Arkin and Hoenig, Nuclear Weapons Databook vol. 1 (1984); vol. 4 (1989)' }
const OTA: Provenance = { source: 'Office of Technology Assessment, The Effects of Nuclear War (1979)', locator: 'Case 4, a large attack on military and economic targets: 155 to 165 million American and 50 to 100 million Soviet dead, for the force of the late 1970s' }

const REACTION_FIXED = 15 * 60
/** Bombers not on ground alert generate over three hours (reconstructed from the DEFCON ladder's own pace). */
const GENERATION = 3 * 3_600
const B52_MS = 845_000 / 3_600
const FB111_MS = 1_000_000 / 3_600
const TU95_MS = 750_000 / 3_600
/** Soviet launch on warning: twenty-five minutes after the first American launches, an inference from the doctrine entering service in the decade. */
const SOVIET_LOW = 25 * 60
const SOVIET_SLBM_PATROL = 15 * 60
const SOVIET_BOMBERS = 3_600

function tier(s: string): EvidenceTier {
  return s === 'documented' || s === 'reconstructed' || s === 'inferred' || s === 'modelled' || s === 'withheld' ? s : 'inferred'
}

const weaponsOf = (l: RawLauncher) => l.weapons ?? (l.aircraft ?? 0) * (l.weaponsPerAircraft ?? 0)

function designationOf(l: RawLauncher): string {
  if (l.kind === 'icbm') {
    const versions = l.squadrons?.map((s) => `${s.missiles} ${s.version}`).join(' + ') ?? `${l.missiles}`
    return `${versions} · ${weaponsOf(l)} WARHEADS`
  }
  if (l.kind === 'bomber') return `${l.model} · ${l.aircraft} AIRCRAFT · ${weaponsOf(l)} WEAPONS`
  if (l.kind === 'slbm') return `${l.boats} BOATS ON PATROL · ${l.missiles} MISSILES · ${weaponsOf(l)} WARHEADS`
  return `${l.boats} BOATS IN PORT · ${l.missiles} MISSILES`
}

function siteOf(l: RawLauncher): Entity {
  const side = l.side === 'us' ? 'attacker' : 'defender'
  const launcher: Launcher = { id: l.id, name: l.name, kind: l.kind === 'slbm-port' ? 'slbm' : l.kind, position: [l.lon, l.lat], weapons: weaponsOf(l), weaponsPerVehicle: 1, rangeMetres: Infinity, yieldKt: l.yieldKt ?? 0, reactionSeconds: 0 }
  return launcherSite(launcher, {
    side,
    designation: designationOf(l),
    evidence: tier(l.evidence),
    provenance: { source: l.source, method: l.note },
    positionEvidence: tier(l.positionEvidence),
    label: l.kind !== 'bomber' || l.side === 'su',
    facts: [
      { label: 'Strength', value: designationOf(l).toLowerCase(), evidence: tier(l.evidence), provenance: { source: l.source, method: l.note } },
      ...(l.squadrons ? l.squadrons.map((s) => ({ label: s.version, value: `${s.missiles} missiles, ${s.warheads} warhead${s.warheads > 1 ? 's' : ''} of ${s.yieldKt >= 1_000 ? `${s.yieldKt / 1_000} Mt` : `${s.yieldKt} kt`} each`, evidence: 'documented' as const, provenance: DATABOOK })) : []),
    ],
  })
}

/** The forces as launchers for the allocation model, split into alert and generated parts where the posture says so. */
function usLaunchers(): Launcher[] {
  const out: Launcher[] = []
  for (const l of RAW.filter((r) => r.side === 'us')) {
    const position: LngLat = [l.lon, l.lat]
    if (l.kind === 'icbm') {
      for (const s of l.squadrons ?? []) {
        out.push({ id: `${l.id}-${s.version.replace(/\s+/g, '').toLowerCase()}`, name: `${l.name} (${s.version})`, kind: 'icbm', position, weapons: s.missiles * s.warheads, weaponsPerVehicle: s.warheads, rangeMetres: 13_000_000, yieldKt: s.yieldKt, reactionSeconds: REACTION_FIXED })
      }
    } else if (l.kind === 'bomber') {
      const speed = l.model?.startsWith('FB') ? FB111_MS : B52_MS
      const total = weaponsOf(l)
      const alert = Math.round(total * RULES.b52.groundAlert)
      out.push({ id: `${l.id}-alert`, name: `${l.name} (alert)`, kind: 'bomber', position, weapons: alert, weaponsPerVehicle: l.weaponsPerAircraft ?? 4, rangeMetres: Infinity, yieldKt: l.yieldKt ?? 1_100, reactionSeconds: REACTION_FIXED, speedMs: speed })
      out.push({ id: `${l.id}-generated`, name: `${l.name} (generated)`, kind: 'bomber', position, weapons: total - alert, weaponsPerVehicle: l.weaponsPerAircraft ?? 4, rangeMetres: Infinity, yieldKt: l.yieldKt ?? 1_100, reactionSeconds: GENERATION, speedMs: speed })
    } else if (l.kind === 'slbm') {
      const perMissile = l.missiles ? Math.max(1, Math.round(weaponsOf(l) / l.missiles)) : 1
      out.push({ id: l.id, name: l.name, kind: 'slbm', position, weapons: weaponsOf(l), weaponsPerVehicle: perMissile, rangeMetres: 4_600_000, yieldKt: l.yieldKt ?? 200, reactionSeconds: REACTION_FIXED })
    }
  }
  return out
}

function sovietLaunchers(): Launcher[] {
  const out: Launcher[] = []
  for (const l of RAW.filter((r) => r.side === 'su')) {
    const position: LngLat = [l.lon, l.lat]
    if (l.kind === 'icbm') out.push({ id: l.id, name: l.name, kind: 'icbm', position, weapons: weaponsOf(l), weaponsPerVehicle: 1, rangeMetres: 13_000_000, yieldKt: l.yieldKt ?? l.squadrons?.[0]?.yieldKt ?? 1_000, reactionSeconds: SOVIET_LOW })
    else if (l.kind === 'bomber') out.push({ id: l.id, name: l.name, kind: 'bomber', position, weapons: weaponsOf(l), weaponsPerVehicle: l.weaponsPerAircraft ?? 2, rangeMetres: Infinity, yieldKt: l.yieldKt ?? 1_000, reactionSeconds: SOVIET_BOMBERS, speedMs: TU95_MS })
    else if (l.kind === 'slbm') out.push({ id: l.id, name: l.name, kind: 'slbm', position, weapons: weaponsOf(l), weaponsPerVehicle: 1, rangeMetres: 2_400_000, yieldKt: l.yieldKt ?? 1_000, reactionSeconds: SOVIET_SLBM_PATROL })
    // Boats in port are days from launch range and do not fire.
  }
  return out
}

/** NUWEP-74's categories applied to what the map has: Soviet nuclear forces first, then the 1956 complexes as the urban-industrial geography. */
function sovietTargets(): Target[] {
  const forces: Target[] = RAW.filter((r) => r.side === 'su' && r.kind !== 'slbm').map((l, i) => ({
    id: `su-${l.id}`,
    name: l.name,
    priority: l.kind === 'icbm' ? i : 100 + i,
    position: [l.lon, l.lat] as LngLat,
    maxWeapons: l.kind === 'icbm' ? (l.missiles ?? 0) : 6,
  }))
  const complexes: Target[] = (targetFile as { targets: Array<{ complex: string; priority: number; name: string; lat: number; lon: number }> }).targets.map((t) => ({ id: `t-${t.complex}`, name: t.name, priority: 1_000 + t.priority, position: [t.lon, t.lat] as LngLat, maxWeapons: 3 }))
  return [...forces, ...complexes]
}

function usTargets(): Target[] {
  const forces: Target[] = RAW.filter((r) => r.side === 'us' && r.kind !== 'slbm').map((l, i) => ({
    id: `us-${l.id}`,
    name: l.name,
    priority: l.kind === 'icbm' ? i : 100 + i,
    position: [l.lon, l.lat] as LngLat,
    maxWeapons: l.kind === 'icbm' ? (l.missiles ?? 0) : 6,
  }))
  // Urban targets: the most populous cells of the 1973 grid, named after the nearest 1970-census city when one is within 30 km.
  const named = (citiesFile as { cities: Array<{ name: string; population1970: number; lon: number; lat: number }> }).cities
  const urban: Target[] = (urbanFile as { targets: Array<{ lon: number; lat: number; population: number }> }).targets.map((c, i) => {
    const position: LngLat = [c.lon, c.lat]
    const near = named.map((n) => ({ n, d: haversineMetres(position, [n.lon, n.lat]) })).sort((a, b) => a.d - b.d)[0]
    const name = near && near.d < 30_000 ? near.n.name : `Urban area ${c.lat.toFixed(1)}°N ${Math.abs(c.lon).toFixed(1)}°W`
    return { id: `us-city-${i}`, name, priority: 50 + i, position, maxWeapons: Math.max(2, Math.min(12, Math.ceil(c.population / 150_000))) }
  })
  return [...forces, ...urban]
}

const US_ATTRITION: StrikeAttrition = { reliability: { icbm: 0.8, irbm: 0.8, slbm: 0.8, bomber: 0.85 }, penetration: 0.7, note: 'Solid-fuel missiles at 0.8, bombers 0.85 working and 0.7 through the PVO of 1973; all inferred' }
const SOVIET_ATTRITION: StrikeAttrition = { reliability: { icbm: 0.75, irbm: 0.75, slbm: 0.7, bomber: 0.85 }, penetration: 0.6, note: 'Liquid-fuel missiles at 0.75, Yankee boats 0.7, bombers 0.85 working and 0.6 through North American air defence; all inferred' }

const TARGET_CATEGORY = (t: Target) => (t.id.startsWith('su-') || t.id.startsWith('us-') ? (t.id.includes('city') ? 'URBAN-INDUSTRIAL' : 'NUCLEAR FORCES') : 'URBAN-INDUSTRIAL · 1956 COMPLEX')

function strikes(): { us: StrikeResult; su: StrikeResult } {
  const us = enactStrike({
    prefix: 'us',
    side: 'attacker',
    launchers: usLaunchers(),
    targets: sovietTargets(),
    allocation: { maxWeaponsPerTarget: 3 },
    attrition: US_ATTRITION,
    allocationRule: { source: 'NUWEP-74 categories as a rule', method: 'Soviet nuclear forces first, one weapon per silo and six per bomber field or port, then the 1956 complexes as the urban-industrial geography with up to three each; nearest launcher in range, missiles before bombers. No SIOP-4 assignment is in the record' },
    vehicle: { evidence: 'inferred', provenance: { source: 'Order of battle of 24 October 1973', method: 'Wing strengths from unit histories and the Databook; a third of the bombers on alert, the rest generated in three hours' } },
    route: { cruise: { source: 'Great circle at cruise speed; tankers not modelled' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: TARGET_CATEGORY,
    targetFacts: (t) => (t.id.startsWith('t-') ? [{ label: 'Why this target', value: 'A 1956 complex standing in for the urban-industrial category of 1974; the 1973 list is withheld', evidence: 'inferred', provenance: { source: 'SAC AWRS 1959 (June 1956), city list, as proxy' } }] : [{ label: 'Why this target', value: 'A documented element of the Soviet strategic force', evidence: 'documented', provenance: DATABOOK }]),
  })
  const su = enactStrike({
    prefix: 'su',
    side: 'defender',
    launchers: sovietLaunchers(),
    targets: usTargets(),
    allocation: { maxWeaponsPerTarget: 3 },
    attrition: SOVIET_ATTRITION,
    allocationRule: { source: 'Launch on warning as a rule', method: `One weapon per American silo, six per bomber base, then the 150 most populous cells of the 1973 grid with two to twelve weapons each by population; the Soviet plan is not in the record, and the weapons left over are held back rather than given invented targets. Urban cells: ${(urbanFile as { rule: string }).rule}` },
    vehicle: { evidence: 'inferred', provenance: { source: 'Order of battle of 24 October 1973', method: 'Launcher totals by type from the missile records spread evenly over the documented fields; the strategic force launches on warning twenty-five minutes after the first American launches, an inference' } },
    route: { cruise: { source: 'Great circle at cruise speed' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: TARGET_CATEGORY,
    targetFacts: (t) => (t.id.startsWith('us-city') ? [{ label: 'Why this target', value: 'One of the 150 most populous cells of the HYDE 1973 grid, standing in for the Soviet urban-industrial list that is not in the record; named after the nearest 1970-census city when one is within 30 km', evidence: 'modelled', provenance: { source: (urbanFile as { source: string }).source, method: (urbanFile as { rule: string }).rule } }] : [{ label: 'Why this target', value: 'A documented element of the American strategic force', evidence: 'documented', provenance: DATABOOK }]),
  })
  return { us, su }
}

const SOURCES = ALERT.sources.join('; ')

function variants(current: 'posture' | 'execute' | 'giant'): Study['variants'] {
  return {
    label: 'Study',
    current,
    items: [
      { id: 'posture', label: '1973 posture', href: '#/study/defcon3-73' },
      { id: 'execute', label: 'Execute SIOP-4', href: '#/study/defcon3-73/execute' },
      { id: 'giant', label: '1969 readiness test', href: '#/study/defcon3-73/1969' },
    ],
  }
}

/** The 1969 secret readiness test: the same engine, no crisis, an alert as a signal. */
function giantLanceStudy(): Study {
  const day = 86_400
  const g = GIANT.giantLance
  const entities: Entity[] = RAW.filter((r) => r.side === 'us').map(siteOf)
  for (const n of GIANT.naval) {
    entities.push({ kind: 'site', id: `naval-${n.id}`, name: n.name, designation: 'SHIPS MOVED · POSITION INFERRED', position: [n.lon, n.lat], evidence: 'inferred', provenance: { source: 'NSA EBB 81', method: 'The movements are documented by sea area; the positions are the areas\' centres' }, facts: [] })
  }
  const events: StudyEvent[] = GIANT.steps.map((st) => ({ time: st.days * day, text: `${st.text} (${st.evidence.toUpperCase()})`, camera: st.camera ? { center: st.camera.center, zoom: st.camera.zoom, durationMs: 5_000 } : undefined }))
  const start = (GIANT.steps.find((st) => st.action === 'giant-lance')?.days ?? 16) * day
  const speed = (g.speedKmh * 1_000) / 3_600
  const orbit = g.orbit.points
  let n = 0
  for (let wave = 0; wave < g.waves; wave += 1) {
    for (let k = 0; k < g.perSortie; k += 1) {
      const base = g.bases[k % g.bases.length]
      const origin: LngLat = [base.lon, base.lat]
      const takeoff = start + wave * g.vigilHours * 3_600 + k * 600
      // Out to the orbit, round it as many times as the vigil allows, and home.
      const outbound = haversineMetres(origin, orbit[0]) / speed
      const lap = orbit.reduce((sum, p, i) => sum + haversineMetres(p, orbit[(i + 1) % orbit.length]), 0) / speed
      const laps = Math.max(1, Math.floor((g.vigilHours * 3_600 - 2 * outbound) / lap))
      const positions: LngLat[] = [origin]
      for (let l = 0; l < laps; l += 1) positions.push(...orbit.map((p) => p as LngLat))
      positions.push(orbit[0] as LngLat, origin)
      n += 1
      entities.push({
        kind: 'track',
        id: `giant-${n}`,
        name: `${base.name.split(' · ')[0]} · Giant Lance sortie ${n}`,
        designation: `B-52 · NUCLEAR-ARMED · ${g.orbit.name.toUpperCase()} · WAVE ${wave + 1}`,
        vehicle: 'aircraft',
        label: k === 0,
        side: 'attacker',
        track: new Track(timeByGroundSpeed(positions, takeoff, speed)),
        reveal: 'progressive',
        evidence: base.evidence === 'documented' ? 'documented' : 'reconstructed',
        provenance: { source: base.source, method: `${g.aircraft} aircraft in sorties of ${g.perSortie}, ${g.vigilHours}-hour vigils (documented); this aircraft's base and timing are ${base.evidence === 'documented' ? 'the wing named in the record' : 'reconstructed'}` },
        route: { evidence: 'reconstructed', provenance: { source: g.orbit.source } },
        facts: [],
      })
    }
  }
  return {
    id: 'defcon3-73-giant',
    title: 'READINESS TEST · OCTOBER 1969',
    subtitle: `${GIANT.title} · an alert with no crisis, designed to be seen · ${g.aircraft} B-52s over Alaska on the last four days`,
    bounds: { start: -day, end: 21 * day },
    view: { center: [-100, 50], zoom: 1.6 },
    sides: { attacker: { name: 'United States' }, defender: { name: 'Soviet Union' } },
    variants: variants('giant'),
    omissions: [
      GIANT.zeroNote,
      'The sites are the order of battle of 1973; in 1969 the Minuteman wings were the same, the bomber force larger and the missiles older, and the sites carry that note',
      'Which sorties flew which day is not in the released record; three waves of six from 26 October are drawn from the totals',
      'The naval movements are documented by sea area only',
      'Nothing is drawn on the Soviet side because nothing was observed: the alert\'s purpose was to be seen, and the record has no sign it was read as intended',
      `Sources: ${GIANT.sources.join('; ')}`,
    ],
    events,
    entities,
  }
}

function postureStudy(): Study {
  const entities: Entity[] = RAW.map(siteOf)
  const events: StudyEvent[] = []
  for (const step of ALERT.steps) {
    events.push({ time: step.hours * 3_600, text: `${step.text} (${step.evidence.toUpperCase()})`, camera: step.camera ? { center: step.camera.center, zoom: step.camera.zoom, durationMs: 5_000 } : undefined })
  }
  // The seventy-five B-52s home from Guam, split evenly over the five B-52D wings; destinations inferred.
  const recall = ALERT.movements['guam-recall']
  const recallStart = (ALERT.steps.find((s) => s.action === 'guam-recall')?.hours ?? 1.2) * 3_600
  const dWings = RAW.filter((r) => r.side === 'us' && r.kind === 'bomber' && r.model === 'B-52D' && r.id !== 'andersen-43')
  dWings.forEach((w, i) => {
    const positions: LngLat[] = [recall.from, [w.lon, w.lat]]
    entities.push({
      kind: 'track',
      id: `recall-${i}`,
      name: `Andersen → ${w.name}`,
      designation: `${Math.round(recall.aircraft / dWings.length)} B-52D · RECALLED FROM GUAM`,
      vehicle: 'aircraft',
      label: i === 0,
      side: 'attacker',
      track: new Track(timeByGroundSpeed(positions, recallStart + i * 600, (recall.speedKmh * 1_000) / 3_600)),
      reveal: 'progressive',
      evidence: 'documented',
      provenance: { source: 'FRUS 1969–76 vol. XXV doc. 269', method: `${recall.note}` },
      route: { evidence: 'reconstructed', provenance: { source: 'Great circle at cruise speed; the recall took days in fact, flown here as one wave' } },
      facts: [],
    })
  })
  const fleetStart = (ALERT.steps.find((s) => s.action === 'sixth-fleet')?.hours ?? 1.4) * 3_600
  for (const m of ALERT.movements['sixth-fleet']) {
    entities.push({
      kind: 'track',
      id: m.id,
      name: m.name,
      designation: m.note.toUpperCase(),
      label: true,
      side: 'attacker',
      vehicle: 'ship',
      track: new Track(timeByGroundSpeed([m.from, m.to], fleetStart, (m.speedKmh * 1_000) / 3_600)),
      reveal: 'progressive',
      evidence: 'documented',
      provenance: { source: 'FRUS 1969–76 vol. XXV doc. 269', method: m.note },
      route: { evidence: 'reconstructed', provenance: { source: 'Positions on the night read from the memorandum; the tracks between them are straight lines at fleet speed' } },
      facts: [],
    })
  }
  return {
    id: 'defcon3-73',
    title: 'DEFCON 3 · OCTOBER 1973',
    subtitle: `The posture held on the night of 24 to 25 October 1973 · ${RAW.filter((r) => r.side === 'us').length} American and ${RAW.filter((r) => r.side === 'su').length} Soviet strategic sites · every step a documented message`,
    bounds: { start: -3_600, end: 36 * 3_600 },
    view: { center: [-30, 50], zoom: 1.6 },
    sides: { attacker: { name: 'United States' }, defender: { name: 'Soviet Union' } },
    variants: variants('posture'),
    omissions: [
      `${ALERT.zeroNote}; the dates and times are from the Foreign Relations volume's own headings`,
      'Which bombers went to the pads, which boats sailed and which crews were recalled are not in the released record hour by hour; the sites show their strength, not their state',
      'The Soviet strategic force is drawn where it stood and did not change readiness; the airborne divisions on alert since 11 October are not drawn',
      'The Sixth Fleet stood down on 17 November; the clock stops at thirty-six hours',
      `Sources: ${SOURCES}`,
    ],
    events,
    entities,
  }
}

function executeStudy(): Study {
  const { us, su } = strikes()
  const entities: Entity[] = [...RAW.map(siteOf), ...us.entities, ...su.entities]
  const events: StudyEvent[] = [
    { time: 0, text: `EXECUTION ORDER · SIOP-4 WITH THE FORCE OF 24 OCTOBER 1973 · ${us.summary.weapons.toLocaleString('en-GB')} WEAPONS ASSIGNED TO ${us.summary.targetsCovered.toLocaleString('en-GB')} TARGETS · ${us.summary.unassigned.toLocaleString('en-GB')} HELD BACK FOR WANT OF A TARGET ON THE INFERRED LIST` },
    { time: 1, text: 'NO ORDER WAS GIVEN ON THE NIGHT. THIS IS THE PLAN THE POSTURE STOOD BEHIND, ENACTED (COUNTERFACTUAL)' },
    { time: REACTION_FIXED, text: `H+15 MIN · MINUTEMAN, TITAN, POLARIS AND POSEIDON LAUNCH · ALERT BOMBERS LEAVE (${Math.round(RULES.b52.groundAlert * 100)}% OF THE FORCE, RECONSTRUCTED)` },
    { time: SOVIET_SLBM_PATROL + 1, text: 'YANKEE BOATS ON PATROL FIRE FROM EAST OF BERMUDA AND OFF THE PACIFIC COAST (INFERRED TIMING)' },
    { time: REACTION_FIXED + SOVIET_LOW, text: `SOVIET LAUNCH ON WARNING · ${su.summary.weapons.toLocaleString('en-GB')} WEAPONS ON ${su.summary.targetsCovered} TARGETS (DOCTRINE ENTERING SERVICE; TIMING INFERRED)` },
    { time: GENERATION, text: 'GENERATED BOMBERS LEAVE AFTER THREE HOURS (RECONSTRUCTED)' },
    { time: us.summary.firstDetonation, text: 'FIRST AMERICAN DETONATION' },
    { time: su.summary.firstDetonation, text: 'FIRST SOVIET DETONATION ON THE UNITED STATES' },
    { time: Math.max(us.summary.lastDetonation, su.summary.lastDetonation), text: 'LAST DETONATION · OUTCOME CALCULATION COMPLETE WHEN THE SUM FINISHES' },
  ].sort((a, b) => a.time - b.time)
  const end = (Math.ceil(Math.max(us.summary.lastDetonation, su.summary.lastDetonation) / 3_600) + 1) * 3_600
  return {
    id: 'defcon3-73-execute',
    title: 'SIOP-4 · EXECUTED',
    subtitle: `Counterfactual · the force of 24 October 1973 · ${us.summary.weapons.toLocaleString('en-GB')} American and ${su.summary.weapons.toLocaleString('en-GB')} Soviet weapons · every assignment inferred`,
    bounds: { start: -600, end },
    view: { center: [-30, 55], zoom: 1.5 },
    populationGrid: 'ghsl/popc_1975',
    exposureWorkers: 4,
    outcomeReference: { label: 'OTA 1979, large attack, Soviet dead', value: 100_000_000, source: `${OTA.source}: ${OTA.locator}` },
    sides: {
      attacker: { name: 'United States' },
      defender: { name: 'Soviet strike · United States dead', reference: { label: 'OTA 1979, large attack, American dead', value: 155_000_000, source: OTA.source } },
    },
    variants: variants('execute'),
    omissions: [
      'No execution order was given in October 1973; this is the plan behind the posture, enacted as a counterfactual',
      'No SIOP-4 target list is in the record. Targets are the documented Soviet nuclear forces and the 1956 complexes standing in for the urban-industrial category of NUWEP-74, and every mark says so',
      'No Soviet target list is in the record either. The American urban targets are the 150 most populous cells of the 1973 grid by a stated rule, so the Soviet strike is a model of a plan, not a plan',
      `Attrition: ${US_ATTRITION.note}; Soviet side, ${SOVIET_ATTRITION.note}`,
      'Soviet launch on warning is an inference from the doctrine entering service in the decade; a Soviet force that rode out the attack would lose most of its silos and change the picture',
      'Bomber routing: great circles at cruise speed; tankers, the Arctic routes and the PVO are not modelled beyond the penetration number',
      'MIRVed missiles carry their warheads on one bus that splits after post-boost, each warhead to a target within 300 km of the first; the footprint and the split are rules, not the missiles\' own guidance',
      'Yields per system are the Databook figures; SRAM loads for the B-52 are not counted',
      'The OTA figures are for the force of 1979 against an unwarned population, and are the nearest documented reference',
      'Population exposure is computed per target with the largest weapon for the log; the headline is a union over the grid, each person counted once in the most severe band that reaches them',
    ],
    events,
    entities,
  }
}

let posture: Study | null = null
let execute: Study | null = null
let giant: Study | null = null

export function defcon3Giant(): Study {
  giant ??= giantLanceStudy()
  return giant
}

export function defcon3Posture(): Study {
  posture ??= postureStudy()
  return posture
}

export function defcon3Execute(): Study {
  execute ??= executeStudy()
  return execute
}

export function defcon3Summary(): { us: StrikeResult['summary']; su: StrikeResult['summary'] } {
  const { us, su } = strikes()
  return { us: us.summary, su: su.summary }
}

export const DEFCON3_DOCUMENTED = {
  usIcbm: 1_054,
  sovietIcbmCeiling: 1_618,
  usWarheadsEstimate: 7_000,
  sovietWarheadsEstimate: 2_200,
  provenance: { source: 'Kristensen and Norris, "Global nuclear weapons inventories, 1945–2013," Bulletin of the Atomic Scientists (2013); SALT I Interim Agreement' } as Provenance,
}

export type { SystemKind, Evidenced }
