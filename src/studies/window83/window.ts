import type { Evidenced, EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import { haversineMetres, type LngLat } from '../../geo/geodesy.ts'
import { destinationPoint } from '../../geo/sector.ts'
import type { Launcher, Target } from '../../models/allocation.ts'
import { hash01 } from '../../models/attrition.ts'
import { minimumEnergyTrajectory } from '../../models/ballistic.ts'
import { singleShotKill } from '../../models/lethality.ts'
import { enactStrike, launcherSite, type StrikeAttrition } from '../strike.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import orderOfBattle from '../../../data/window83/order-of-battle-1983.json'
import suUrban from '../../../data/window83/su-urban-1983.json'
import usUrban from '../../../data/window83/us-urban-1983.json'

/**
 * The window of vulnerability, 1983. A Soviet counterforce strike as the
 * West feared it, two warheads on every American silo and submarine
 * warheads on the bomber bases with ten minutes' warning, and the two
 * answers the posture allowed: ride it out and launch what survives, or
 * launch under attack on the radar's confirmation so the warheads land on
 * empty silos. The clock is the point. Nothing in the record says the
 * Soviet Union planned this; the strike is drawn from the Western estimates
 * that shaped the posture, and every mark says so.
 */

interface RawSite {
  side: 'us' | 'su'
  id: string
  name: string
  kind: 'icbm' | 'bomber' | 'slbm' | 'slbm-port'
  lon: number
  lat: number
  missiles?: number
  weapons?: number
  weaponsPerVehicle?: number
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
}

const RAW = (orderOfBattle as { sites: RawSite[] }).sites
const RULES = (orderOfBattle as unknown as { rules: { siloPsi: number; accuracy: Record<string, { cepMetres: number; yieldKt: number }> & { source: string }; usBombers: { groundAlert: number } } }).rules
const MIN = 60
const DATABOOK: Provenance = { source: 'Cochran, Arkin and Hoenig, Nuclear Weapons Databook vol. 1 (1984); vol. 4 (1989)' }
const NITZE: Provenance = { source: 'Nitze, "Deterring Our Deterrent," Foreign Policy 25 (1976–77); Team B, Soviet Strategic Objectives (1976); Bunn and Tsipis, "The Uncertainties of a Preemptive Nuclear Attack," Scientific American (November 1983)' }

/** The warning clock, in seconds after the Soviet launch. */
const T = {
  detect: 30,
  radar: 10 * MIN,
  conference: 13 * MIN,
  decision: 20 * MIN,
  launchUnderAttack: 22 * MIN,
  rideOutLaunch: 40 * MIN,
  bomberScramble: 15 * MIN,
  sovietSecond: 50 * MIN,
}

function tier(s: string): EvidenceTier {
  return s === 'documented' || s === 'reconstructed' || s === 'inferred' || s === 'modelled' || s === 'withheld' ? s : 'inferred'
}
const weaponsOf = (l: RawSite) => l.weapons ?? (l.aircraft ?? 0) * (l.weaponsPerAircraft ?? 0)
const fmt = (v: number) => Math.round(v).toLocaleString('en-GB')

// --- Sites -------------------------------------------------------------------

function designationOf(l: RawSite): string {
  if (l.kind === 'icbm') return `${l.squadrons?.map((s) => `${s.missiles} ${s.version.toUpperCase()}`).join(' + ') ?? l.missiles} · ${weaponsOf(l)} WARHEADS`
  if (l.kind === 'bomber') return `${l.model} · ${l.aircraft} AIRCRAFT · ${weaponsOf(l)} WEAPONS`
  if (l.kind === 'slbm') return `${l.boats} BOATS ON PATROL · ${l.missiles} MISSILES · ${weaponsOf(l)} WARHEADS`
  return `${l.boats} BOATS IN PORT · ${l.missiles} MISSILES`
}

function siteOf(l: RawSite): Entity {
  const launcher: Launcher = { id: l.id, name: l.name, kind: l.kind === 'slbm-port' ? 'slbm' : l.kind, position: [l.lon, l.lat], weapons: weaponsOf(l), weaponsPerVehicle: 1, rangeMetres: Infinity, yieldKt: l.yieldKt ?? 0, reactionSeconds: 0 }
  return launcherSite(launcher, {
    side: l.side === 'us' ? 'attacker' : 'defender',
    designation: designationOf(l),
    evidence: tier(l.evidence),
    provenance: { source: l.source, method: l.note },
    positionEvidence: tier(l.positionEvidence),
    label: l.kind !== 'bomber',
    facts: [{ label: 'Strength', value: designationOf(l).toLowerCase(), evidence: tier(l.evidence), provenance: { source: l.source, method: l.note } }],
  })
}

/** The command sites a counterforce strike would take with the silos. */
const COMMAND: Array<{ id: string; name: string; position: LngLat; note: string }> = [
  { id: 'offutt', name: 'Offutt AFB · SAC headquarters', position: [-95.91, 41.12], note: 'The command post and the Looking Glass airborne alternate' },
  { id: 'cheyenne', name: 'Cheyenne Mountain · NORAD', position: [-104.85, 38.74], note: 'Where the warning is assessed' },
  { id: 'pentagon', name: 'The Pentagon · National Military Command Center', position: [-77.06, 38.87], note: 'The national command' },
  { id: 'raven-rock', name: 'Raven Rock · alternate command center', position: [-77.42, 39.73], note: 'The alternate' },
  { id: 'mount-weather', name: 'Mount Weather · continuity of government', position: [-77.89, 39.06], note: 'The civil relocation site' },
]

/** A wing's silos as points: fifteen flights of ten spread within about sixty kilometres of the base, by rule. */
function siloField(base: LngLat, count: number): LngLat[] {
  const out: LngLat[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i += 1) {
    const r = 8_000 + 52_000 * Math.sqrt((i + 0.5) / count)
    out.push(destinationPoint(base, ((i * golden * 180) / Math.PI) % 360, r))
  }
  return out
}

interface Silo {
  id: string
  wing: RawSite
  version: string
  warheads: number
  yieldKt: number
  position: LngLat
}

function silos(): Silo[] {
  const out: Silo[] = []
  for (const w of RAW.filter((r) => r.side === 'us' && r.kind === 'icbm')) {
    const total = w.squadrons?.reduce((s, q) => s + q.missiles, 0) ?? 0
    const points = siloField([w.lon, w.lat], total)
    let k = 0
    for (const q of w.squadrons ?? []) {
      for (let i = 0; i < q.missiles; i += 1) {
        out.push({ id: `${w.id}-silo-${k + 1}`, wing: w, version: q.version, warheads: q.warheads, yieldKt: q.yieldKt, position: points[k] })
        k += 1
      }
    }
  }
  return out
}

// --- Forces -------------------------------------------------------------------

const MISSILES: StrikeAttrition = { reliability: { icbm: 0.85, irbm: 0.85, slbm: 0.85, bomber: 0.85 }, penetration: 1, note: 'Missiles at 0.85 reliability, the Databook\'s working figure; no defence on either side under the ABM treaty' }
const US_BOMBER_ATTRITION: StrikeAttrition = { reliability: { icbm: 0.85, irbm: 0.85, slbm: 0.85, bomber: 0.85 }, penetration: 0.6, note: 'Bombers 0.85 working and 0.6 through Soviet air defence, inferred' }

function sovietLaunchers(kinds: 'first' | 'second'): Launcher[] {
  const out: Launcher[] = []
  for (const l of RAW.filter((r) => r.side === 'su')) {
    const position: LngLat = [l.lon, l.lat]
    if (l.kind === 'icbm') {
      for (const s of l.squadrons ?? []) {
        const heavy = s.version === 'SS-18' || s.version === 'SS-19'
        if ((kinds === 'first') !== heavy) continue
        out.push({ id: `${l.id}-${s.version.toLowerCase()}`, name: `${l.name} (${s.version})`, kind: 'icbm', position, weapons: s.missiles * s.warheads, weaponsPerVehicle: s.warheads, rangeMetres: 13_000_000, yieldKt: s.yieldKt, reactionSeconds: kinds === 'first' ? 0 : T.sovietSecond })
      }
    } else if (l.kind === 'slbm') {
      const forward = /Yankee/.test(l.name)
      if ((kinds === 'first') !== forward) continue
      out.push({ id: l.id, name: l.name, kind: 'slbm', position, weapons: weaponsOf(l), weaponsPerVehicle: l.weaponsPerVehicle ?? 1, rangeMetres: forward ? 2_400_000 : 8_000_000, yieldKt: l.yieldKt ?? 1_000, reactionSeconds: kinds === 'first' ? 0 : T.sovietSecond })
    }
  }
  return out
}

function usFixedTargets(): { silos: Target[]; bases: Target[]; command: Target[] } {
  const siloTargets: Target[] = silos().map((s, i) => ({ id: s.id, name: `${s.wing.name.split(' · ')[0]} silo ${s.id.split('-silo-')[1]}`, priority: i, position: s.position, maxWeapons: 2 }))
  const bases: Target[] = RAW.filter((r) => r.side === 'us' && (r.kind === 'bomber' || r.kind === 'slbm-port')).map((l, i) => ({ id: `base-${l.id}`, name: l.name, priority: 2_000 + i, position: [l.lon, l.lat] as LngLat, maxWeapons: 4 }))
  const command: Target[] = COMMAND.map((c, i) => ({ id: `cmd-${c.id}`, name: c.name, priority: 1_500 + i, position: c.position, maxWeapons: 3 }))
  return { silos: siloTargets, bases, command }
}

function urban(prefix: string, file: { targets: Array<{ lon: number; lat: number; population: number }> }): Target[] {
  return file.targets.map((c, i) => ({ id: `${prefix}-city-${i}`, name: `Urban area ${Math.abs(c.lat).toFixed(1)}°${c.lat >= 0 ? 'N' : 'S'} ${Math.abs(c.lon).toFixed(1)}°${c.lon >= 0 ? 'E' : 'W'}`, priority: 5_000 + i, position: [c.lon, c.lat] as LngLat, maxWeapons: Math.max(2, Math.min(12, Math.ceil(c.population / 150_000))) }))
}

function sovietTargets(): Target[] {
  const forces: Target[] = RAW.filter((r) => r.side === 'su' && r.kind !== 'slbm').map((l, i) => ({ id: `su-${l.id}`, name: l.name, priority: l.kind === 'icbm' ? i : 100 + i, position: [l.lon, l.lat] as LngLat, maxWeapons: l.kind === 'icbm' ? Math.max(2, l.missiles ?? 0) : 6 }))
  const moscow: Target = { id: 'su-moscow', name: 'Moscow · the General Staff', priority: 50, position: [37.62, 55.75], maxWeapons: 6 }
  return [...forces, moscow, ...urban('su', suUrban)]
}

const CATEGORY = (t: Target) => (t.id.includes('-city-') ? 'URBAN' : t.id.includes('silo') ? 'SILO' : t.id.startsWith('cmd-') ? 'COMMAND' : 'FORCES')

type Posture = 'ride' | 'launch'

function build(posture: Posture): Study {
  const entities: Entity[] = RAW.map(siteOf)
  const events: StudyEvent[] = []
  const field = silos()
  const { silos: siloTargets, bases, command } = usFixedTargets()
  for (const c of COMMAND) {
    entities.push({ kind: 'site', id: `cmd-${c.id}`, name: c.name, designation: 'COMMAND', label: true, position: c.position, evidence: 'documented', provenance: { source: 'Blair (1985); the Databook', method: c.note }, facts: [] })
  }
  for (const s of field) {
    entities.push({ kind: 'site', id: s.id, name: `${s.wing.name.split(' · ')[0]} silo ${s.id.split('-silo-')[1]}`, designation: `SILO · ${s.version.toUpperCase()}`, label: false, position: s.position, evidence: 'reconstructed', provenance: { ...DATABOOK, method: 'Fifteen flights of ten within about sixty kilometres of the base, placed by rule; the real silo positions are public but not transcribed here' }, facts: [] })
  }

  // The Soviet first strike: boats off the coasts on the bases and command with ten minutes' warning, the heavy ICBMs on the silos.
  const slbm = enactStrike({
    prefix: 'su-slbm',
    side: 'defender',
    launchers: sovietLaunchers('first').filter((l) => l.kind === 'slbm'),
    targets: [...bases, ...command],
    allocation: { maxWeaponsPerTarget: 4 },
    attrition: MISSILES,
    allocationRule: { ...NITZE, method: 'The forward Yankees on the bomber bases, the submarine ports and the command sites within their reach, up to four warheads each; the short flight is the point' },
    vehicle: { evidence: 'inferred', provenance: { ...DATABOOK, method: 'Five Yankee boats forward off the coasts, an inference from the patrol pattern' } },
    route: { cruise: { source: 'No bombers' }, ballistic: { source: 'Minimum-energy trajectory; a depressed trajectory would be shorter still' } },
    targetCategory: CATEGORY,
    targetFacts: () => [{ label: 'Why this target', value: 'The bombers on alert must be caught on the ground; a submarine off the coast gives them ten minutes', evidence: 'inferred', provenance: NITZE }],
  })
  const icbm = enactStrike({
    prefix: 'su-icbm',
    side: 'defender',
    launchers: sovietLaunchers('first').filter((l) => l.kind === 'icbm'),
    targets: [...siloTargets, ...bases.map((b) => ({ ...b, maxWeapons: 2 })), ...command.map((c) => ({ ...c, maxWeapons: 2 }))],
    allocation: { maxWeaponsPerTarget: 2 },
    attrition: MISSILES,
    allocationRule: { ...NITZE, method: `Two warheads on every silo from the SS-18 and SS-19 fields, the bases and command sites again behind the boats; the rest of the force held back. The silos are ${RULES.siloPsi.toLocaleString('en-GB')} psi and the warheads ${RULES.accuracy['SS-18'].yieldKt} kt at ${RULES.accuracy['SS-18'].cepMetres} m and ${RULES.accuracy['SS-19'].yieldKt} kt at ${RULES.accuracy['SS-19'].cepMetres} m` },
    vehicle: { evidence: 'inferred', provenance: { ...DATABOOK, method: 'The SS-18 Mod 4 and SS-19 fields as the Databook counts them' } },
    route: { cruise: { source: 'No bombers' }, ballistic: { source: 'Minimum-energy trajectory' } },
    mirv: { footprintMetres: 200_000 },
    targetCategory: CATEGORY,
    targetFacts: (t) => [{ label: 'Why this target', value: t.id.includes('silo') ? 'A Minuteman or Titan silo; two warheads is the counterforce rule of the estimates' : 'A base or command site, struck again behind the boats', evidence: 'inferred', provenance: NITZE }],
  })
  entities.push(...slbm.entities, ...icbm.entities)

  // Which silos survive: the single-shot kill rule with the engine's draw, per warhead that arrives.
  const p18 = singleShotKill(RULES.accuracy['SS-18'].yieldKt, RULES.accuracy['SS-18'].cepMetres, RULES.siloPsi)
  const p19 = singleShotKill(RULES.accuracy['SS-19'].yieldKt, RULES.accuracy['SS-19'].cepMetres, RULES.siloPsi)
  const survivors: Silo[] = []
  let struck = 0
  for (const s of field) {
    const fa = icbm.firstArrival[s.id]
    if (!fa) {
      survivors.push(s)
      continue
    }
    struck += 1
    const p = fa.yieldKt >= 550 ? p19 : p18
    const pSurvive = (1 - p) ** fa.weapons
    if (hash01(`window83:silo:${s.id}`) < pSurvive) survivors.push(s)
  }
  const firstSiloArrival = Math.min(...field.map((s) => icbm.firstArrival[s.id]?.time ?? Infinity))
  const firstSlbmArrival = slbm.summary.firstDetonation

  // The American answer: the silos that fire, the boats at sea, the alert bombers that got off.
  const icbmLaunch = posture === 'launch' ? T.launchUnderAttack : T.rideOutLaunch
  const firing = posture === 'launch' ? field : survivors
  const usLaunchers: Launcher[] = firing.map((s) => ({ id: `${s.id}-l`, name: `${s.wing.name.split(' · ')[0]} silo ${s.id.split('-silo-')[1]}`, kind: 'icbm', position: s.position, weapons: s.warheads, weaponsPerVehicle: s.warheads, rangeMetres: 13_000_000, yieldKt: s.yieldKt, reactionSeconds: icbmLaunch }))
  for (const l of RAW.filter((r) => r.side === 'us' && r.kind === 'slbm')) usLaunchers.push({ id: l.id, name: l.name, kind: 'slbm', position: [l.lon, l.lat], weapons: weaponsOf(l), weaponsPerVehicle: l.weaponsPerVehicle ?? 8, rangeMetres: 7_400_000, yieldKt: l.yieldKt ?? 100, reactionSeconds: icbmLaunch })
  let bombersLost = 0
  let bombersOff = 0
  for (const l of RAW.filter((r) => r.side === 'us' && r.kind === 'bomber')) {
    const hit = slbm.firstArrival[`base-${l.id}`]
    const alert = Math.round(weaponsOf(l) * RULES.usBombers.groundAlert)
    if (hit && hit.time < T.bomberScramble) {
      bombersLost += alert
      continue
    }
    bombersOff += alert
    usLaunchers.push({ id: `${l.id}-alert`, name: `${l.name} (alert)`, kind: 'bomber', position: [l.lon, l.lat], weapons: alert, weaponsPerVehicle: l.weaponsPerAircraft ?? 8, rangeMetres: Infinity, yieldKt: l.yieldKt ?? 1_100, reactionSeconds: T.bomberScramble, speedMs: 845_000 / 3_600 })
  }
  const answer = enactStrike({
    prefix: 'us',
    side: 'attacker',
    launchers: usLaunchers,
    targets: sovietTargets(),
    allocation: { maxWeaponsPerTarget: 3 },
    attrition: (sorties) => (sorties.some((s) => s.kind === 'bomber') ? US_BOMBER_ATTRITION : MISSILES),
    allocationRule: { source: 'The SIOP of 1983 is withheld; the categories of NUWEP as a rule', method: `Soviet missile fields, bomber fields, ports and Moscow first, then the ${suUrban.targets.length} most populous cells of the 1983 grid with two to twelve weapons by population, nearest launcher first` },
    vehicle: { evidence: 'inferred', provenance: { ...DATABOOK, method: posture === 'launch' ? `Every silo launches at H+${T.launchUnderAttack / MIN} on the radar's confirmation, before the warheads arrive; the boats at sea with them; the alert bombers from the bases the boats did not reach` : `The ${survivors.length} silos that survived launch at H+${T.rideOutLaunch / MIN}; the boats at sea with them; the alert bombers from the bases the boats did not reach` } },
    route: { cruise: { source: 'Great circle at cruise speed; tankers not modelled' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: CATEGORY,
    targetFacts: (t) => [{ label: 'Why this target', value: t.id.includes('-city-') ? 'One of the most populous cells of the 1983 grid, standing in for the urban-industrial category; the list is withheld' : 'A documented element of the Soviet strategic force or its command', evidence: t.id.includes('-city-') ? 'modelled' : 'documented', provenance: t.id.includes('-city-') ? { source: (suUrban as { source: string }).source, method: (suUrban as { rule: string }).rule } : DATABOOK }],
  })
  entities.push(...answer.entities)

  // What the Soviet Union kept back: the older fields and the boats in the bastions, on the cities.
  const second = enactStrike({
    prefix: 'su-2',
    side: 'defender',
    launchers: sovietLaunchers('second'),
    targets: [...urban('us', usUrban), ...bases.map((b) => ({ ...b, maxWeapons: 2 }))],
    allocation: { maxWeaponsPerTarget: 3 },
    attrition: MISSILES,
    allocationRule: { ...NITZE, method: `The SS-11, SS-13 and SS-17 fields and the Deltas in the bastions at H+${T.sovietSecond / MIN}, on the ${usUrban.targets.length} most populous cells of the 1983 grid with two to twelve weapons by population; the estimates never said what the reserve was for, and this is the assured-destruction reading` },
    vehicle: { evidence: 'inferred', provenance: { ...DATABOOK, method: 'The force not spent on the silos, launched before the American warheads arrive' } },
    route: { cruise: { source: 'No bombers' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: CATEGORY,
    targetFacts: () => [{ label: 'Why this target', value: 'One of the most populous cells of the 1983 grid; there is no Soviet target list in the record', evidence: 'modelled', provenance: { source: (usUrban as { source: string }).source } }],
  })
  entities.push(...second.entities)

  // The warning clock.
  const minutes = (s: number) => `H+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`
  events.push({ time: 0, text: `SOVIET LAUNCH · ${fmt(icbm.summary.weapons)} ICBM WARHEADS AT THE SILOS, BASES AND COMMAND · ${fmt(slbm.summary.weapons)} FROM THE BOATS OFF THE COASTS · ${fmt(icbm.summary.unassigned + slbm.summary.unassigned)} HELD BACK (INFERRED, AS THE ESTIMATES FEARED)`, camera: { center: [60, 55], zoom: 2.2, durationMs: 4_000 } })
  events.push({ time: T.detect, text: 'DEFENSE SUPPORT PROGRAM SATELLITES SEE THE BOOSTERS · NORAD BEGINS ASSESSMENT (BLAIR)' })
  events.push({ time: firstSlbmArrival, text: `${minutes(firstSlbmArrival)} · FIRST SUBMARINE WARHEADS ARRIVE ON THE COASTAL BASES · ${fmt(bombersLost)} ALERT BOMBER WEAPONS CAUGHT ON THE GROUND, ${fmt(bombersOff)} AWAY FROM THE INTERIOR BASES (MODELLED)`, camera: { center: [-95, 40], zoom: 3, durationMs: 4_000 } })
  events.push({ time: T.radar, text: `${minutes(T.radar)} · BMEWS AND PAVE PAWS CONFIRM THE TRACKS · THE MISSILE ATTACK CONFERENCE (BLAIR)` })
  events.push({ time: T.conference, text: `${minutes(T.conference)} · THE PRESIDENT ON THE LINE · ${Math.round((firstSiloArrival - T.conference) / 60)} MINUTES BEFORE THE FIRST WARHEADS ON THE SILOS` })
  if (posture === 'launch') {
    events.push({ time: T.decision, text: `${minutes(T.decision)} · LAUNCH UNDER ATTACK ORDERED · ${Math.round((firstSiloArrival - T.decision) / 60)} MINUTES TO SPARE (THE POSTURE'S ANSWER)` })
    events.push({ time: T.launchUnderAttack, text: `${minutes(T.launchUnderAttack)} · ${fmt(field.length)} SILOS EMPTY · ${fmt(answer.summary.weapons)} AMERICAN WEAPONS ON ${fmt(answer.summary.targetsCovered)} SOVIET TARGETS (INFERRED)`, camera: { center: [-100, 45], zoom: 3, durationMs: 3_000 } })
    events.push({ time: firstSiloArrival, text: `${minutes(firstSiloArrival)} · SOVIET WARHEADS ARRIVE ON EMPTY SILOS` })
  } else {
    events.push({ time: T.decision, text: `${minutes(T.decision)} · THE PRESIDENT RIDES IT OUT · THE SILOS WAIT` })
    events.push({ time: firstSiloArrival, text: `${minutes(firstSiloArrival)} · SOVIET WARHEADS ARRIVE ON THE SILOS · ${fmt(struck)} STRUCK, ${fmt(survivors.length)} OF ${fmt(field.length)} SURVIVE (SINGLE-SHOT KILL ${Math.round(p18 * 100)}% PER SS-18 WARHEAD, MODELLED)`, camera: { center: [-100, 45], zoom: 3, durationMs: 3_000 } })
    events.push({ time: T.rideOutLaunch, text: `${minutes(T.rideOutLaunch)} · THE SURVIVORS LAUNCH · ${fmt(answer.summary.weapons)} AMERICAN WEAPONS ON ${fmt(answer.summary.targetsCovered)} SOVIET TARGETS (INFERRED)` })
  }
  events.push({ time: T.sovietSecond, text: `${minutes(T.sovietSecond)} · THE SOVIET RESERVE LAUNCHES AT THE CITIES · ${fmt(second.summary.weapons)} WEAPONS (INFERRED)` })
  events.push({ time: answer.summary.firstDetonation, text: 'FIRST AMERICAN DETONATION IN THE SOVIET UNION' })
  events.push({ time: second.summary.firstDetonation, text: 'FIRST SOVIET WARHEADS ON THE CITIES' })
  const last = Math.max(answer.summary.lastDetonation, second.summary.lastDetonation, icbm.summary.lastDetonation)
  events.push({ time: last, text: 'LAST DETONATION · OUTCOME CALCULATION COMPLETE WHEN THE SUM FINISHES' })
  events.sort((a, b) => a.time - b.time)

  const variants: Study['variants'] = {
    label: 'Posture',
    current: posture,
    items: [
      { id: 'ride', label: 'Ride it out', href: '#/study/window-83' },
      { id: 'launch', label: 'Launch under attack', href: '#/study/window-83/launch' },
    ],
  }
  return {
    id: `window-83-${posture}`,
    title: posture === 'launch' ? 'THE WINDOW · LAUNCH UNDER ATTACK' : 'THE WINDOW · RIDE IT OUT',
    subtitle: `A Soviet counterforce strike of 1983 as the West feared it · ${fmt(icbm.summary.weapons + slbm.summary.weapons)} warheads · ${posture === 'launch' ? `every silo empty at H+${T.launchUnderAttack / MIN}` : `${fmt(survivors.length)} of ${fmt(field.length)} silos survive`} · ${fmt(answer.summary.weapons)} American weapons answer · every assignment inferred`,
    bounds: { start: -5 * MIN, end: (Math.ceil(last / 3_600) + 1) * 3_600 },
    startTime: -2 * MIN,
    view: { center: [-30, 55], zoom: 1.5 },
    populationGrid: 'ghsl/popc_1985',
    exposureWorkers: 4,
    sides: {
      attacker: { name: 'American answer · Soviet dead' },
      defender: { name: 'Soviet strikes · American dead' },
    },
    variants,
    omissions: [
      'Nothing in the record says the Soviet Union planned this. The strike is drawn from the Western estimates that shaped the posture: two warheads per silo from the heavy fields, the forward boats on the bombers and command',
      `Silo survival is the single-shot kill rule of the accuracy lab with the engine's draw: ${Math.round(p18 * 100)} per cent per SS-18 warhead and ${Math.round(p19 * 100)} per SS-19 against ${RULES.siloPsi.toLocaleString('en-GB')} psi, two warheads each; fratricide, which the estimates argued over, is not modelled and would raise the survivors`,
      `The warning clock is Blair's (Strategic Command and Control, 1985): detection within the minute, radar confirmation at ten, a decision by twenty, the first warheads at ${Math.round(firstSiloArrival / 60)} by the geometry. Launch under attack leaves the president ${Math.round((firstSiloArrival - T.decision) / 60)} minutes to spare`,
      'Fratricide and the uncertainties Bunn and Tsipis set out (1983) are why the survivors here are not the estimates\' few: with the open literature\'s accuracy, two warheads kill about two silos in three, and the rest fire',
      'Silo positions are placed by rule around each base; the real positions are public and could replace them',
      'The alert bombers are a third of the force; those at bases the boats reach inside fifteen minutes are lost on the ground, the rest fly. Tankers and Soviet air defence are one penetration number',
      'No target list of 1983 is in the record on either side: the American answer and the Soviet reserve strike follow the categories as rules, and the cities are the most populous cells of the 1983 grid',
      `Attrition: ${MISSILES.note}; ${US_BOMBER_ATTRITION.note}`,
      'Population exposure is a union over the 1985 grid, each person counted once in the most severe band that reaches them',
    ],
    events,
    entities,
  }
}

const cache = new Map<Posture, Study>()
export function window83(posture: Posture): Study {
  let s = cache.get(posture)
  if (!s) {
    s = build(posture)
    cache.set(posture, s)
  }
  return s
}

/** For tests and the brief: how the survival arithmetic comes out before the study is drawn. */
export function windowArithmetic() {
  const p18 = singleShotKill(RULES.accuracy['SS-18'].yieldKt, RULES.accuracy['SS-18'].cepMetres, RULES.siloPsi)
  const flight = minimumEnergyTrajectory([59.53, 50.76], [-101.34, 48.42]).flightSeconds
  return { p18, twoShots: 1 - (1 - p18) ** 2, flightMinutes: flight / 60, silos: silos().length, decisionMinutes: T.decision / 60, launchMinutes: T.launchUnderAttack / 60, coast: haversineMetres([-65, 33], [-80.4, 25.5]) / 1_000 }
}

export type { Evidenced }
