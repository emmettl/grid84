import { Track, type Waypoint } from '../../engine/track.ts'
import type { Evidenced, EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import type { LngLat } from '../../geo/geodesy.ts'
import { pointInRing } from '../../geo/polygon.ts'
import type { Launcher, Target } from '../../models/allocation.ts'
import { hash01 } from '../../models/attrition.ts'
import { boostedTrajectory, boostedWaypoints, boostProfileFor, type Propellant } from '../../models/ballistic.ts'
import { BLAST_MODEL, promptEffects } from '../../models/blast.ts'
import { enactStrike, launcherSite, type StrikeAttrition, type StrikeResult } from '../strike.ts'
import type { Entity, FalloutAssumption, Study, StudyEvent } from '../study.ts'
import orderOfBattle from '../../../data/72-minutes/order-of-battle-2024.json'
import scenarioFile from '../../../data/72-minutes/scenario.json'
import outlineFile from '../../../data/72-minutes/russia-outline.json'
import usUrban from '../../../data/72-minutes/us-urban-2023.json'
import ruUrban from '../../../data/72-minutes/ru-urban-2023.json'
import nkUrban from '../../../data/72-minutes/nk-urban-2023.json'
import citiesFile from '../../../data/72-minutes/cities-2024.json'
import { haversineMetres } from '../../geo/geodesy.ts'

/**
 * Seventy-two minutes. A modern scenario on the forces of 2024 and the
 * population of 2025, after Jacobsen's Nuclear War: A Scenario and Bigelow's
 * A House of Dynamite. Nothing that happens here is in any record: the
 * machinery is documented, the sequence is a published fiction, and every
 * scenario event says which book it comes from. The study's own claim is the
 * arithmetic: flight times, what can be seen and shot, whose territory an
 * American missile crosses on its way to Korea, and who lives under the
 * warheads at the end.
 */

interface RawSite {
  side: 'us' | 'ru' | 'nk'
  id: string
  name: string
  kind: 'icbm' | 'bomber' | 'slbm' | 'slbm-port' | 'interceptor' | 'sensor' | 'command'
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
  interceptors?: number
  squadrons?: Array<{ missiles: number; version: string; warheads: number; yieldKt: number }>
  note: string
  evidence: string
  positionEvidence: string
  source: string
}

interface Step {
  minutes: number
  text: string
  evidence: string
  camera?: { center: [number, number]; zoom: number }
}

const RAW = (orderOfBattle as { sites: RawSite[] }).sites
const RULES = (orderOfBattle as { rules: { gmd: { interceptors: number; testHits: number; tests: number; salvo: number }; deployedStrategic: { us: number; ru: number; source: string } } }).rules
const S = scenarioFile as unknown as {
  film: { title: string; source: string; zeroNote: string; launch: [number, number]; launchNote: string; target: { name: string; position: [number, number] }; yieldKt: number; yieldNote: string; minutesToImpactAtDetection: number; interceptors: number; steps: Step[] }
  book: {
    title: string
    source: string
    zeroNote: string
    hwasong: { from: string; target: { name: string; position: [number, number] }; yieldKt: number; flightMinutes: number }
    slbm: { from: [number, number]; fromNote: string; target: { name: string; position: [number, number] }; yieldKt: number; launchMinute: number; surface: boolean }
    interceptors: number
    usCounter: { orderMinute: number; icbmLaunchMinute: number; minuteman: number; tridentLaunchMinute: number; tridentMissiles: number; tridentWarheadsPerMissile: number; tridentYieldKt: number; warheads: number }
    russia: { readMinute: number; orderMinute: number; icbmLaunchMinute: number; slbmLaunchMinute: number; warheadsClaimed: number; slbmMissilesClaimed: number }
    usAnswer: { orderMinute: number; launchMinute: number; aimPointsClaimed: number }
    endMinute: number
    washingtonClaim: { label: string; value: number }
    steps: Step[]
  }
  gmd: { site: string; testHits: number; tests: number; salvoClaim: number; filmClaim: number; source: string }
  sources: string[]
}
const OUTLINE = (outlineFile as unknown as { ring: Array<[number, number]>; source: string }).ring
const OUTLINE_SOURCE = (outlineFile as unknown as { source: string }).source

const MIN = 60
const BOOK: Provenance = { source: S.book.source }
const FILM: Provenance = { source: S.film.source }
const NOTEBOOK: Provenance = { source: 'Nuclear Notebook 2024 (Kristensen, Korda, Johns and Knight); FAS Status of World Nuclear Forces' }

function tier(s: string): EvidenceTier {
  return s === 'documented' || s === 'reconstructed' || s === 'inferred' || s === 'modelled' || s === 'withheld' ? s : 'inferred'
}
const fmtYield = (kt: number) => (kt >= 1_000 ? `${kt / 1_000} MT` : `${kt} KT`)
const hhmm = (seconds: number) => {
  const sign = seconds < 0 ? '-' : '+'
  const s = Math.abs(Math.round(seconds))
  return `H${sign}${String(Math.floor(s / 3_600)).padStart(2, '0')}:${String(Math.floor((s % 3_600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const weaponsOf = (l: RawSite) => l.weapons ?? (l.aircraft ?? 0) * (l.weaponsPerAircraft ?? 0)
const site = (id: string) => RAW.find((r) => r.id === id)!
const positionOf = (id: string): LngLat => [site(id).lon, site(id).lat]

// --- The forces on the map ---------------------------------------------------

function designationOf(l: RawSite): string {
  if (l.kind === 'icbm') return `${l.squadrons?.map((s) => `${s.missiles} ${s.version.toUpperCase()}`).join(' + ') ?? l.missiles} · ${weaponsOf(l)} WARHEADS`
  if (l.kind === 'bomber') return `${l.model} · ${l.aircraft} AIRCRAFT · NOT ON ALERT`
  if (l.kind === 'slbm') return `${l.boats} BOAT${l.boats === 1 ? '' : 'S'} ON PATROL · ${l.missiles} MISSILES · ${weaponsOf(l)} WARHEADS`
  if (l.kind === 'slbm-port') return `${l.boats} BOAT${l.boats === 1 ? '' : 'S'} IN PORT · ${l.missiles} MISSILES`
  if (l.kind === 'interceptor') return `${l.interceptors} INTERCEPTORS · ${RULES.gmd.testHits} HITS IN ${RULES.gmd.tests} TESTS`
  if (l.kind === 'sensor') return 'EARLY WARNING'
  return 'COMMAND'
}

function siteOf(l: RawSite): Entity {
  const side = l.side === 'us' ? 'attacker' : 'defender'
  const provenance = { source: l.source, method: l.note }
  if (l.kind === 'icbm' || l.kind === 'bomber' || l.kind === 'slbm' || l.kind === 'slbm-port') {
    const launcher: Launcher = { id: l.id, name: l.name, kind: l.kind === 'slbm-port' ? 'slbm' : l.kind, position: [l.lon, l.lat], weapons: weaponsOf(l), weaponsPerVehicle: 1, rangeMetres: Infinity, yieldKt: l.yieldKt ?? 0, reactionSeconds: 0 }
    return launcherSite(launcher, {
      side,
      designation: designationOf(l),
      evidence: tier(l.evidence),
      provenance,
      positionEvidence: tier(l.positionEvidence),
      label: l.kind !== 'bomber' || l.side !== 'us',
      facts: [
        { label: 'Strength', value: designationOf(l).toLowerCase(), evidence: tier(l.evidence), provenance },
        ...(l.squadrons ? l.squadrons.map((s) => ({ label: s.version, value: `${s.missiles} launchers, ${s.warheads} warhead${s.warheads > 1 ? 's' : ''} of ${s.yieldKt >= 1_000 ? `${s.yieldKt / 1_000} Mt` : `${s.yieldKt} kt`} each`, evidence: 'reconstructed' as const, provenance: NOTEBOOK })) : []),
      ],
    })
  }
  return {
    kind: 'site',
    id: l.id,
    name: l.name,
    designation: designationOf(l),
    label: l.kind !== 'sensor',
    position: [l.lon, l.lat],
    evidence: tier(l.evidence),
    provenance,
    facts: [{ label: 'Role', value: l.note, evidence: tier(l.evidence), provenance }],
  }
}

// --- One missile, one warhead ------------------------------------------------

interface Missile {
  id: string
  name: string
  designation: string
  from: LngLat
  to: LngLat
  launch: number
  yieldKt: number
  side: 'attacker' | 'defender'
  provenance: Provenance
  routeProvenance: Provenance
  surface?: FalloutAssumption
  /** Sets the boost profile; the North Korean heavies burn liquid. Default solid. */
  propellant?: Propellant
  targetName: string
  targetFacts?: Array<Evidenced & { label: string; value: string }>
  /** The vehicle is destroyed here and nothing arrives. */
  interceptedAt?: number
}

/** The flight with its boost phase: the class profile for the range and propellant, then the coast. */
function flightPlan(from: LngLat, to: LngLat, propellant: Propellant = 'solid') {
  const range = haversineMetres(from, to)
  const boost = boostProfileFor('icbm', range, propellant) as NonNullable<ReturnType<typeof boostProfileFor>>
  return boostedTrajectory(from, to, boost)
}

function cutAt(waypoints: Waypoint[], endTime: number): Waypoint[] {
  const full = new Track(waypoints)
  const at = full.positionAt(endTime) ?? waypoints[0].position
  return [...waypoints.filter((w) => w.time < endTime), { position: at, time: endTime, altitude: full.altitudeAt(endTime) }]
}

function missile(m: Missile): { entities: Entity[]; arrival: number; track: Track } {
  const plan = flightPlan(m.from, m.to, m.propellant)
  const arrival = m.launch + plan.totalSeconds
  const waypoints = boostedWaypoints(m.from, m.to, plan.boost, m.launch)
  const track = new Track(waypoints)
  const entities: Entity[] = [
    {
      kind: 'track',
      id: m.id,
      name: m.name,
      designation: m.interceptedAt ? `${m.designation} · INTERCEPTED ${hhmm(m.interceptedAt)}` : m.designation,
      label: true,
      side: m.side,
      vehicle: 'missile',
      track: m.interceptedAt ? new Track(cutAt(waypoints, m.interceptedAt)) : track,
      reveal: 'progressive',
      evidence: 'inferred',
      provenance: m.provenance,
      route: { evidence: 'modelled', provenance: m.routeProvenance },
      facts: [
        { label: 'Flight time', value: `${Math.round(plan.totalSeconds / 60)} minutes over ${Math.round(plan.rangeMetres / 1_000).toLocaleString('en-GB')} km: burnout at ${plan.boost.burnoutSeconds} s, ${Math.round(plan.boost.burnoutAltitudeMetres / 1_000)} km up (${plan.boost.label}), then a minimum-energy coast with apogee ${Math.round(plan.free.apogeeMetres / 1_000).toLocaleString('en-GB')} km`, evidence: 'modelled', provenance: m.routeProvenance },
      ],
    },
  ]
  if (!m.interceptedAt) {
    entities.push({
      kind: 'effect',
      id: `${m.id}-e`,
      name: m.targetName,
      designation: `${m.targetName.toUpperCase()} · ${fmtYield(m.yieldKt)} · ${m.surface ? 'SURFACE' : 'AIR'} BURST`,
      label: true,
      side: m.side,
      center: m.to,
      time: arrival,
      effects: promptEffects(m.yieldKt),
      burst: m.surface ? 'surface' : 'air',
      fallout: m.surface,
      deliveredBy: [m.id],
      evidence: 'modelled',
      provenance: { source: BLAST_MODEL },
      facts: m.targetFacts ?? [],
    })
  }
  return { entities, arrival, track }
}

// --- Interceptors ------------------------------------------------------------

interface Shot {
  launch: number
  hit: boolean
  /** Failed on the pad; drawn as no flight. */
  dud?: boolean
}

/** Ground-based interceptors from Fort Greely against one incoming track; each flies to where the target will be when it gets there. */
function interceptors(prefix: string, incoming: Track, shots: Shot[], provenance: Provenance): { entities: Entity[]; hitAt: number | null } {
  const greely = positionOf(S.gmd.site)
  const entities: Entity[] = []
  let hitAt: number | null = null
  shots.forEach((shot, i) => {
    const id = `${prefix}-gbi-${i + 1}`
    if (shot.dud) {
      entities.push({
        kind: 'track',
        id,
        name: `Interceptor ${i + 1} · Fort Greely`,
        designation: `GBI ${i + 1} · FAILED TO LEAVE THE SILO`,
        label: false,
        side: 'attacker',
        vehicle: 'missile',
        track: new Track([{ position: greely, time: shot.launch, altitude: 0 }, { position: greely, time: shot.launch + 1, altitude: 0 }]),
        reveal: 'progressive',
        evidence: 'inferred',
        provenance,
        route: { evidence: 'modelled', provenance: { source: 'No flight' } },
        facts: [],
      })
      return
    }
    // Where the incoming will be when the interceptor arrives: iterate the flight time.
    let meet = shot.launch + 8 * MIN
    for (let k = 0; k < 4; k += 1) {
      const p = incoming.positionAt(Math.min(meet, incoming.end - 1)) ?? incoming.waypoints[incoming.waypoints.length - 1].position
      meet = shot.launch + flightPlan(greely, p).totalSeconds
    }
    const at = Math.min(meet, incoming.end - 30)
    const p = incoming.positionAt(at)!
    // The interceptor boosts too: a three-stage solid booster's profile for its range, cut where the meeting falls.
    const ownPlan = flightPlan(greely, p)
    const own = cutAt(boostedWaypoints(greely, p, ownPlan.boost, shot.launch), at)
    // Lift the end of the arc to the incoming's height so the meeting is drawn where it happens.
    const targetAlt = incoming.altitudeAt(at)
    const lifted = own.map((w) => {
      const f = (w.time - shot.launch) / (at - shot.launch)
      return { ...w, altitude: (w.altitude ?? 0) + f * f * targetAlt }
    })
    const hit = shot.hit && hitAt === null
    if (hit) hitAt = at
    entities.push({
      kind: 'track',
      id,
      name: `Interceptor ${i + 1} · Fort Greely`,
      designation: `GBI ${i + 1} · ${hit ? 'HIT' : shot.hit ? 'NOT NEEDED' : 'MISS'} ${hhmm(at)}`,
      label: hit,
      side: 'attacker',
      vehicle: 'missile',
      track: new Track(lifted),
      reveal: 'progressive',
      evidence: 'inferred',
      provenance,
      route: { evidence: 'modelled', provenance: { source: 'Minimum-energy arc to the point where the incoming will be, lifted to its height at the meeting' } },
      facts: [{ label: 'Outcome', value: hit ? 'Hit' : 'Miss', evidence: 'inferred', provenance }],
    })
  })
  return { entities, hitAt }
}

type Fate = 'film' | 'record' | 'claim'

/** The fate of each shot under a variant: as filmed, drawn at the test record, or as the salvo claim would have it. */
function shotsFor(fate: Fate, count: number, firstLaunch: number, seed: string, dudFirst: boolean): { shots: Shot[]; probability: number; note: string } {
  const p = RULES.gmd.testHits / RULES.gmd.tests
  const shots: Shot[] = []
  for (let i = 0; i < count; i += 1) {
    const launch = firstLaunch + i * 30
    if (fate === 'film') shots.push({ launch, hit: false, dud: dudFirst && i === 0 })
    else if (fate === 'claim') shots.push({ launch, hit: true })
    else shots.push({ launch, hit: hash01(`${seed}:gbi:${i}`) < p })
  }
  const flown = fate === 'film' && dudFirst ? count - 1 : count
  const probability = fate === 'claim' ? RULES.gmd.salvo : fate === 'film' ? S.gmd.filmClaim : 1 - (1 - p) ** flown
  const note =
    fate === 'film'
      ? `As filmed: one interceptor fails on the pad, the other misses; the film gives the pair ${Math.round(S.gmd.filmClaim * 100)} per cent`
      : fate === 'claim'
        ? `The Missile Defense Agency's claim: ${Math.round(RULES.gmd.salvo * 100)} per cent for a salvo of ${RULES.gmd.salvo === 0.97 ? 'four' : 'the salvo'}, assuming independent shots; drawn as a hit`
        : `Each shot at the test record, ${RULES.gmd.testHits} in ${RULES.gmd.tests}; ${count} shots give ${Math.round(probability * 100)} per cent, and the engine's deterministic draw decides`
  return { shots, probability, note }
}

// --- Forces as launchers and targets -----------------------------------------

const MISSILE_ATTRITION: StrikeAttrition = { reliability: { icbm: 0.9, irbm: 0.9, slbm: 0.9, bomber: 0.85 }, penetration: 1, note: 'Missiles at 0.9 reliability, inferred; no defence is credited against a salvo, since 44 interceptors do not bear on a thousand warheads' }
const TARGET_CATEGORY = (t: Target) => (t.id.includes('-city-') ? 'URBAN' : t.id.includes('-icbm-') ? 'MISSILE FIELD' : 'FORCES AND COMMAND')

const CITIES = (citiesFile as { cities: Array<{ country: string; name: string; lon: number; lat: number }> }).cities

/** A grid cell named after the nearest listed city within thirty kilometres, else by its coordinates. */
function cellName(country: string, position: LngLat): string {
  let best: { name: string; d: number } | null = null
  for (const c of CITIES) {
    if (c.country !== country) continue
    const d = haversineMetres(position, [c.lon, c.lat])
    if (!best || d < best.d) best = { name: c.name, d }
  }
  if (best && best.d < 30_000) return best.name
  return `Urban area ${Math.abs(position[1]).toFixed(1)}°${position[1] >= 0 ? 'N' : 'S'} ${Math.abs(position[0]).toFixed(1)}°${position[0] >= 0 ? 'E' : 'W'}`
}

function urbanTargets(prefix: string, file: { targets: Array<{ lon: number; lat: number; population: number }> }, maxByPopulation: boolean): Target[] {
  const seen = new Map<string, number>()
  return file.targets.map((c, i) => ({
    id: `${prefix}-city-${i}`,
    name: (() => {
      const base = cellName(prefix, [c.lon, c.lat])
      const k = (seen.get(base) ?? 0) + 1
      seen.set(base, k)
      return k === 1 ? base : `${base} · cell ${k}`
    })(),
    priority: 500 + i,
    position: [c.lon, c.lat] as LngLat,
    maxWeapons: maxByPopulation ? Math.max(2, Math.min(12, Math.ceil(c.population / 150_000))) : 3,
  }))
}

function forceTargets(side: 'us' | 'ru' | 'nk'): Target[] {
  return RAW.filter((r) => r.side === side && r.kind !== 'slbm').map((l, i) => ({
    id: `${side}-${l.kind}-${l.id}`,
    name: l.name,
    priority: l.kind === 'icbm' ? i : l.kind === 'command' ? 50 + i : 100 + i,
    position: [l.lon, l.lat] as LngLat,
    maxWeapons: l.kind === 'icbm' ? Math.max(2, l.missiles ?? 0) : l.kind === 'sensor' ? 2 : 6,
  }))
}

function minutemanLaunchers(missilesWanted: number, reaction: number, idSuffix: string): Launcher[] {
  const wings = RAW.filter((r) => r.side === 'us' && r.kind === 'icbm')
  const total = wings.reduce((s, w) => s + (w.missiles ?? 0), 0)
  let left = missilesWanted
  return wings.map((w, i) => {
    const share = i === wings.length - 1 ? left : Math.round(((w.missiles ?? 0) / total) * missilesWanted)
    left -= share
    return { id: `${w.id}-${idSuffix}`, name: w.name, kind: 'icbm' as const, position: [w.lon, w.lat] as LngLat, weapons: share, weaponsPerVehicle: 1, rangeMetres: 13_000_000, yieldKt: w.squadrons?.[0]?.yieldKt ?? 300, reactionSeconds: reaction }
  })
}

function tridentLaunchers(reaction: number, idSuffix: string, lessMissilesFrom?: { id: string; missiles: number }): Launcher[] {
  return RAW.filter((r) => r.side === 'us' && r.kind === 'slbm').map((l) => {
    const missiles = (l.missiles ?? 0) - (lessMissilesFrom && lessMissilesFrom.id === l.id ? lessMissilesFrom.missiles : 0)
    return { id: `${l.id}-${idSuffix}`, name: l.name, kind: 'slbm' as const, position: [l.lon, l.lat] as LngLat, weapons: missiles * (l.weaponsPerVehicle ?? 4), weaponsPerVehicle: l.weaponsPerVehicle ?? 4, rangeMetres: 11_000_000, yieldKt: l.yieldKt ?? 90, reactionSeconds: reaction }
  })
}

function russianLaunchers(icbmReaction: number, slbmReaction: number): Launcher[] {
  const out: Launcher[] = []
  for (const l of RAW.filter((r) => r.side === 'ru')) {
    const position: LngLat = [l.lon, l.lat]
    if (l.kind === 'icbm') {
      for (const s of l.squadrons ?? []) out.push({ id: `${l.id}-${s.version.replace(/\s+/g, '-').toLowerCase()}`, name: `${l.name} (${s.version})`, kind: 'icbm', position, weapons: s.missiles * s.warheads, weaponsPerVehicle: s.warheads, rangeMetres: 13_000_000, yieldKt: s.yieldKt, reactionSeconds: icbmReaction })
    } else if (l.kind === 'slbm' || l.kind === 'slbm-port') {
      out.push({ id: l.id, name: l.name, kind: 'slbm', position, weapons: weaponsOf(l), weaponsPerVehicle: l.weaponsPerVehicle ?? 4, rangeMetres: 9_500_000, yieldKt: l.yieldKt ?? 100, reactionSeconds: slbmReaction })
    }
    // Bombers are not on alert and could not arrive inside the book's clock.
  }
  return out
}

// --- Overflight --------------------------------------------------------------

interface Crossing {
  id: string
  time: number
  position: LngLat
}

/** Where and when each ballistic arc's ground track first enters Russian territory. */
function crossings(entities: Entity[]): Crossing[] {
  const out: Crossing[] = []
  for (const e of entities) {
    if (e.kind !== 'track' || e.route.evidence !== 'modelled') continue
    const t = e.track
    for (let time = t.start; time <= t.end; time += 15) {
      const p = t.positionAt(time)
      if (p && pointInRing(p, OUTLINE)) {
        out.push({ id: e.id, time, position: p })
        break
      }
    }
  }
  return out.sort((a, b) => a.time - b.time)
}

// --- Studies -----------------------------------------------------------------

const VARIANT_ITEMS = [
  { id: 'film', label: 'As filmed', href: '#/study/72-minutes' },
  { id: 'record', label: 'Test record', href: '#/study/72-minutes/record' },
  { id: 'claim', label: 'Salvo claim', href: '#/study/72-minutes/claim' },
  { id: 'salvo', label: 'Seventeen missiles', href: '#/study/72-minutes/salvo' },
  { id: 'book', label: 'Jacobsen · 72 minutes', href: '#/study/72-minutes/jacobsen' },
]
const variants = (current: string): Study['variants'] => ({ label: 'Act', current, items: VARIANT_ITEMS })

const stepEvents = (steps: Step[], camera = true): StudyEvent[] => steps.map((st) => ({ time: st.minutes * MIN, text: `${st.text} (${st.evidence.toUpperCase()} · SCENARIO)`, camera: camera && st.camera ? { center: st.camera.center, zoom: st.camera.zoom, durationMs: 4_000 } : undefined }))

const COMMON_OMISSIONS = [
  'Nothing in this study is in any record. The forces are as counted in 2024; the sequence is a published scenario and every scenario event names its book on the mark',
  `Deployed strategic warheads as the record counts them: United States ${RULES.deployedStrategic.us.toLocaleString('en-GB')}, Russia ${RULES.deployedStrategic.ru.toLocaleString('en-GB')} (${RULES.deployedStrategic.source})`,
  'Early-warning satellites are not placed; detection is drawn as an event at the moment the scenario gives',
  `Interceptors: ${RULES.gmd.interceptors} in all, ${RULES.gmd.testHits} hits in ${RULES.gmd.tests} tests; the film's number, the agency's and the record are the variants`,
  'Blast, fire and fallout by the methods of the other studies on the 2025 grid; no sheltering, no medical care, no reactor inventory at the plant',
]

/** Act one: the film's single missile, on a nineteen-minute clock from detection. */
function filmStudy(fate: Fate): Study {
  const f = S.film
  const plan = flightPlan(f.launch, f.target.position, 'liquid')
  const launch = f.minutesToImpactAtDetection * MIN - plan.totalSeconds
  const incoming = missile({
    id: 'film-icbm',
    propellant: 'liquid',
    name: `Unattributed missile → ${f.target.name}`,
    designation: `ICBM · ORIGIN NOT ATTRIBUTED · ${fmtYield(f.yieldKt)} BORROWED`,
    from: f.launch,
    to: f.target.position,
    launch,
    yieldKt: f.yieldKt,
    side: 'defender',
    provenance: { ...FILM, method: f.launchNote },
    routeProvenance: { source: 'Minimum-energy trajectory; the film gives nineteen minutes from detection, which fixes the launch' },
    targetName: f.target.name,
    targetFacts: [{ label: 'Yield', value: f.yieldNote, evidence: 'inferred', provenance: FILM }],
  })
  const firstShot = 5 * MIN
  const { shots, probability, note } = shotsFor(fate, f.interceptors, firstShot, 'film', fate === 'film')
  const gbi = interceptors('film', incoming.track, shots, { ...FILM, method: note })
  const final = gbi.hitAt !== null ? missile({ ...incomingSpec(f, launch), interceptedAt: gbi.hitAt }) : incoming
  const entities: Entity[] = [...RAW.filter((r) => r.side === 'us').map(siteOf), ...final.entities, ...gbi.entities]
  const events: StudyEvent[] = [
    { time: launch, text: `A BALLISTIC MISSILE LEAVES THE SEA OF JAPAN · NOT IN THE FILM, PLACED ${Math.round(-launch / MIN)} MINUTES BEFORE THE RADAR SEES IT BY THE FLIGHT TIME (INFERRED)` },
    ...stepEvents(f.steps.filter((st) => st.minutes >= 0 && !(fate !== 'film' && st.minutes === 5))),
    { time: firstShot, text: `INTERCEPTORS LEAVE FORT GREELY · ${note.toUpperCase()}` },
    ...(gbi.hitAt !== null
      ? [{ time: gbi.hitAt, text: `INTERCEPT · THE WARHEAD IS DESTROYED OVER THE PACIFIC ${hhmm(gbi.hitAt)} (${Math.round(probability * 100)}% UNDER THIS VARIANT)`, camera: { center: incoming.track.positionAt(gbi.hitAt) ?? f.launch, zoom: 3, durationMs: 3_000 } }]
      : [{ time: incoming.arrival, text: `${f.target.name.toUpperCase()} · ${fmtYield(f.yieldKt)} AIR BURST · THE FILM NEVER SHOWS THIS; THE YIELD IS BORROWED FROM THE BOOK` }]),
  ].sort((a, b) => a.time - b.time)
  return {
    id: `72-minutes-${fate}`,
    title: 'SEVENTY-TWO MINUTES · A HOUSE OF DYNAMITE',
    subtitle: `One unattributed missile at ${f.target.name}, ${f.minutesToImpactAtDetection} minutes on the clock · ${f.interceptors} interceptors from Fort Greely · ${VARIANT_ITEMS.find((v) => v.id === fate)?.label.toLowerCase()} · every event a scenario`,
    bounds: { start: launch - 2 * MIN, end: incoming.arrival + 10 * MIN },
    startTime: -MIN,
    view: { center: [-150, 50], zoom: 2 },
    populationGrid: 'ghsl/popc_2025',
    exposureWorkers: 2,
    sides: { attacker: { name: 'United States' }, defender: { name: 'The missile · American dead' } },
    variants: variants(fate),
    omissions: [
      `${f.zeroNote} (${f.source})`,
      `Interceptor fate: ${note}`,
      f.yieldNote,
      'The film ends before the president decides and before the missile arrives; the engine runs the last minute so the arithmetic is on the map, and says on the mark that the film never shows it',
      ...COMMON_OMISSIONS,
    ],
    events,
    entities,
  }
}

function incomingSpec(f: typeof S.film, launch: number): Missile {
  return {
    id: 'film-icbm',
    propellant: 'liquid',
    name: `Unattributed missile → ${f.target.name}`,
    designation: `ICBM · ORIGIN NOT ATTRIBUTED · ${fmtYield(f.yieldKt)} BORROWED`,
    from: f.launch,
    to: f.target.position,
    launch,
    yieldKt: f.yieldKt,
    side: 'defender',
    provenance: { ...FILM, method: f.launchNote },
    routeProvenance: { source: 'Minimum-energy trajectory; the film gives nineteen minutes from detection, which fixes the launch' },
    targetName: f.target.name,
  }
}

/** Act two: the book's seventy-two minutes, with the three strikes allocated by rule against the 2025 grid. */
function bookStudy(): Study {
  const b = S.book
  const entities: Entity[] = RAW.map(siteOf)
  const events: StudyEvent[] = stepEvents(b.steps)

  // The first missile and the four interceptors, which the book has miss.
  const hwasong = missile({
    id: 'book-hwasong',
    propellant: 'liquid',
    name: `Sunan → ${b.hwasong.target.name}`,
    designation: `HWASONG-17 · ${fmtYield(b.hwasong.yieldKt)} · THE BOOK'S WARHEAD`,
    from: positionOf(b.hwasong.from),
    to: b.hwasong.target.position,
    launch: 0,
    yieldKt: b.hwasong.yieldKt,
    side: 'defender',
    provenance: { ...BOOK, method: `The book's one megaton; North Korea's largest test was about 250 kt` },
    routeProvenance: { source: `Minimum-energy trajectory; the book gives ${b.hwasong.flightMinutes} minutes` },
    targetName: b.hwasong.target.name,
    targetFacts: [{ label: b.washingtonClaim.label, value: b.washingtonClaim.value.toLocaleString('en-GB'), evidence: 'inferred', provenance: BOOK }],
  })
  const shots = shotsFor('film', b.interceptors, 8 * MIN, 'book', false)
  const gbi = interceptors('book', hwasong.track, shots.shots, { ...BOOK, method: 'All four miss in the book' })
  const p = RULES.gmd.testHits / RULES.gmd.tests
  const fourMiss = (1 - p) ** b.interceptors
  entities.push(...hwasong.entities, ...gbi.entities)
  events.push({ time: hwasong.arrival, text: `${b.hwasong.target.name.toUpperCase()} · ${fmtYield(b.hwasong.yieldKt)} AIR BURST · THE BOOK COUNTS A MILLION DEAD WITHIN MINUTES; THE READOUT SUMS THE GRID`, camera: { center: b.hwasong.target.position, zoom: 8, durationMs: 4_000 } })
  events.push({ time: 8 * MIN + 30, text: `FOUR INTERCEPTORS MISS AS THE BOOK HAS IT · AT THE TEST RECORD FOUR MISSES HAPPEN ${(fourMiss * 100).toFixed(1)}% OF THE TIME` })

  // The submarine's missile on the plant.
  const slbm = missile({
    id: 'book-slbm',
    name: `Submarine off California → ${b.slbm.target.name}`,
    designation: `SLBM · ${fmtYield(b.slbm.yieldKt)} · SURFACE BURST · THE BOOK'S SUBMARINE`,
    from: b.slbm.from,
    to: b.slbm.target.position,
    launch: b.slbm.launchMinute * MIN,
    yieldKt: b.slbm.yieldKt,
    side: 'defender',
    provenance: { ...BOOK, method: `${b.slbm.fromNote}. North Korea's one missile submarine, a rebuilt Romeo-class hull with a 1,900 km missile, could not be here; this is the scenario's weakest step` },
    routeProvenance: { source: 'Minimum-energy trajectory over the short range' },
    surface: { fissionFraction: 0.5, windMph: 15, downwindBearingDeg: 70, untilHours: 48, provenance: { source: 'Prevailing westerlies on the central California coast, inferred; the plant\'s reactor inventory, which is the book\'s contamination, is not modelled' } },
    targetName: b.slbm.target.name,
    targetFacts: [{ label: 'The plant', value: 'The book\'s contamination of California and Nevada comes from the reactor inventory, not the weapon; only the weapon\'s own fallout is drawn', evidence: 'inferred', provenance: BOOK }],
  })
  entities.push(...slbm.entities)
  events.push({ time: slbm.arrival, text: `${b.slbm.target.name.toUpperCase()} · ${fmtYield(b.slbm.yieldKt)} SURFACE BURST · THE WEAPON'S PLUME ON THE DAY'S WIND; THE REACTOR NOT MODELLED` })

  // The American counterstrike on North Korea: 50 Minuteman III and 8 Trident II.
  const c = b.usCounter
  const nebraska = RAW.find((r) => r.id === 'ssbn-pacific-west')!
  const usOnNk = enactStrike({
    prefix: 'us-nk',
    side: 'attacker',
    launchers: [
      ...minutemanLaunchers(c.minuteman, c.icbmLaunchMinute * MIN, 'nk'),
      { id: 'nebraska', name: 'USS Nebraska · Trident II', kind: 'slbm', position: [nebraska.lon, nebraska.lat], weapons: c.tridentMissiles * c.tridentWarheadsPerMissile, weaponsPerVehicle: c.tridentWarheadsPerMissile, rangeMetres: 11_000_000, yieldKt: c.tridentYieldKt, reactionSeconds: c.tridentLaunchMinute * MIN },
    ],
    targets: [...forceTargets('nk'), ...urbanTargets('nk', nkUrban, false)],
    allocation: { maxWeaponsPerTarget: 3 },
    attrition: MISSILE_ATTRITION,
    allocationRule: { source: 'The book\'s counts as a rule', method: `${c.warheads} warheads: North Korea's launch sites and command first, then the most populous cells of the 2023 grid with up to three each; the book names no target list` },
    vehicle: { evidence: 'inferred', provenance: { ...BOOK, method: `${c.minuteman} Minuteman III from the three wings in proportion to their strength, launched at minute ${c.icbmLaunchMinute}; ${c.tridentMissiles} Trident II from the Nebraska with four W88 each at minute ${c.tridentLaunchMinute}` } },
    route: { cruise: { source: 'No bombers' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: TARGET_CATEGORY,
    targetFacts: (t) => [{ label: 'Why this target', value: t.id.includes('-city-') ? 'One of the most populous cells of the 2023 grid; the book names no list' : 'A documented North Korean site', evidence: t.id.includes('-city-') ? 'modelled' : 'documented', provenance: t.id.includes('-city-') ? { source: (nkUrban as { source: string }).source, method: (nkUrban as { rule: string }).rule } : NOTEBOOK }],
  })
  entities.push(...usOnNk.entities)

  // The geometry the book's turn rests on: the Minuteman arcs cross the Russian Far East.
  const cross = crossings(usOnNk.entities.filter((e) => e.kind === 'track' && e.id.startsWith('us-nk')))
  const arcs = usOnNk.entities.filter((e) => e.kind === 'track' && !e.id.includes('-rv')).length
  if (cross.length > 0) {
    const first = cross[0]
    entities.push({
      kind: 'site',
      id: 'overflight',
      name: 'Overflight of Russian territory',
      designation: `${cross.length} OF ${arcs} AMERICAN ARCS CROSS RUSSIAN TERRITORY · FIRST ${hhmm(first.time)}`,
      label: true,
      position: first.position,
      uncertaintyMetres: 100_000,
      evidence: 'reconstructed',
      provenance: { source: 'The great circle from the Minuteman fields to Korea, against a coarse outline of Russia', method: OUTLINE_SOURCE },
      facts: [{ label: 'What this is', value: 'The one part of the book\'s central turn that is simply geometry: a missile from the northern United States bound for Korea passes over the Russian Far East, and Russian early warning would see it do so', evidence: 'reconstructed', provenance: BOOK }],
    })
    events.push({ time: first.time, text: `THE FIRST MINUTEMAN GROUND TRACK ENTERS RUSSIAN TERRITORY ${hhmm(first.time)} · ${cross.length} OF ${arcs} ARCS WILL (GEOMETRY, RECONSTRUCTED)`, camera: { center: first.position, zoom: 3, durationMs: 4_000 } })
  }

  // Russia's answer: the whole force the book launches, allocated against American forces and cities.
  const r = b.russia
  const ruOnUs = enactStrike({
    prefix: 'ru',
    side: 'defender',
    launchers: russianLaunchers(r.icbmLaunchMinute * MIN, r.slbmLaunchMinute * MIN),
    targets: [...forceTargets('us'), ...urbanTargets('us', usUrban, true)],
    allocation: { maxWeaponsPerTarget: 3 },
    attrition: MISSILE_ATTRITION,
    allocationRule: { source: 'Counterforce first, then cities by population, as a rule', method: `American missile fields (one weapon per silo), bomber bases, ports, interceptor sites, radars and command, then the ${usUrban.targets.length} most populous cells of the 2023 grid with two to twelve weapons each by population. The book says about ${r.warheadsClaimed.toLocaleString('en-GB')} warheads and ${r.slbmMissilesClaimed} submarine missiles; the engine launches the counted force` },
    vehicle: { evidence: 'inferred', provenance: { ...BOOK, method: `Every ICBM division at minute ${r.icbmLaunchMinute}, every boat at sea and in port at minute ${r.slbmLaunchMinute}, as the book has it; bombers cannot arrive inside the clock and are not flown` } },
    route: { cruise: { source: 'No bombers' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: TARGET_CATEGORY,
    targetFacts: (t) => [{ label: 'Why this target', value: t.id.includes('-city-') ? 'One of the most populous cells of the 2023 grid, standing in for a plan that is not in any record' : 'A documented element of the American strategic force or its warning and command', evidence: t.id.includes('-city-') ? 'modelled' : 'documented', provenance: t.id.includes('-city-') ? { source: (usUrban as { source: string }).source, method: (usUrban as { rule: string }).rule } : NOTEBOOK }],
  })
  entities.push(...ruOnUs.entities)

  // The American answer on Russia with what is left.
  const a = b.usAnswer
  const usOnRu = enactStrike({
    prefix: 'us-ru',
    side: 'attacker',
    launchers: [...minutemanLaunchers(400 - c.minuteman, a.launchMinute * MIN, 'ru'), ...tridentLaunchers(a.launchMinute * MIN, 'ru', { id: 'ssbn-pacific-west', missiles: c.tridentMissiles })],
    targets: [...forceTargets('ru'), ...urbanTargets('ru', ruUrban, true)],
    allocation: { maxWeaponsPerTarget: 3 },
    attrition: MISSILE_ATTRITION,
    allocationRule: { source: 'OPLAN 8010 as a rule; the plan itself is withheld', method: `Russian missile fields, ports, bomber bases, radars and command first, then the ${ruUrban.targets.length} most populous cells of the 2023 grid with two to twelve weapons each. The book says ${a.aimPointsClaimed} aim points` },
    vehicle: { evidence: 'inferred', provenance: { ...BOOK, method: `The ${400 - c.minuteman} Minuteman III not already fired and every Trident at sea less the Nebraska's eight, launched at minute ${a.launchMinute}; the bombers cannot arrive inside the clock and are not flown` } },
    route: { cruise: { source: 'No bombers' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: TARGET_CATEGORY,
    targetFacts: (t) => [{ label: 'Why this target', value: t.id.includes('-city-') ? 'One of the most populous cells of the 2023 grid; the real target list is withheld' : 'A documented element of the Russian strategic force or its warning and command', evidence: t.id.includes('-city-') ? 'modelled' : 'documented', provenance: t.id.includes('-city-') ? { source: (ruUrban as { source: string }).source, method: (ruUrban as { rule: string }).rule } : NOTEBOOK }],
  })
  entities.push(...usOnRu.entities)

  const strikes: Array<[string, StrikeResult]> = [['UNITED STATES ON NORTH KOREA', usOnNk], ['RUSSIA ON THE UNITED STATES', ruOnUs], ['UNITED STATES ON RUSSIA', usOnRu]]
  for (const [name, s] of strikes) {
    events.push({ time: s.summary.firstDetonation, text: `FIRST DETONATION · ${name} · ${s.summary.weapons.toLocaleString('en-GB')} WEAPONS ON ${s.summary.targetsCovered} TARGETS, ${s.summary.unassigned} HELD FOR WANT OF A TARGET` })
    events.push({ time: s.summary.lastDetonation, text: `LAST DETONATION · ${name}` })
  }
  events.push({ time: c.icbmLaunchMinute * MIN, text: `MINUTEMAN LAUNCH FROM THREE WINGS · ${c.minuteman} MISSILES AT NORTH KOREA · THEIR ARCS CROSS THE RUSSIAN FAR EAST (BOOK)`, camera: { center: [-110, 50], zoom: 2.5, durationMs: 3_000 } })
  events.push({ time: c.tridentLaunchMinute * MIN, text: `USS NEBRASKA FIRES ${c.tridentMissiles} TRIDENT II · ${c.tridentMissiles * c.tridentWarheadsPerMissile} W88 (BOOK)` })
  events.push({ time: r.icbmLaunchMinute * MIN, text: `RUSSIAN ICBM LAUNCH · ${ruOnUs.summary.weapons.toLocaleString('en-GB')} WEAPONS IN ALL · THE BOOK SAYS ABOUT ${r.warheadsClaimed.toLocaleString('en-GB')} (BOOK)` })
  events.push({ time: r.slbmLaunchMinute * MIN, text: `RUSSIAN SUBMARINES FIRE FROM THE BASTIONS AND FROM PORT (BOOK)` })
  events.push({ time: a.launchMinute * MIN, text: `MINUTEMAN AND TRIDENT LAUNCH AT RUSSIA · ${usOnRu.summary.weapons.toLocaleString('en-GB')} WEAPONS ON ${usOnRu.summary.targetsCovered} TARGETS · THE BOOK SAYS ${a.aimPointsClaimed} AIM POINTS (BOOK)` })
  events.sort((x, y) => x.time - y.time)
  const last = Math.max(usOnNk.summary.lastDetonation, ruOnUs.summary.lastDetonation, usOnRu.summary.lastDetonation)
  return {
    id: '72-minutes-book',
    title: 'SEVENTY-TWO MINUTES · JACOBSEN',
    subtitle: `The book's clock on the forces of 2024 · ${(usOnNk.summary.weapons + usOnRu.summary.weapons).toLocaleString('en-GB')} American and ${ruOnUs.summary.weapons.toLocaleString('en-GB')} Russian weapons · every event a scenario, every assignment inferred`,
    bounds: { start: -5 * MIN, end: (Math.ceil(last / MIN) + 10) * MIN },
    startTime: -2 * MIN,
    view: { center: [-30, 55], zoom: 1.5 },
    populationGrid: 'ghsl/popc_2025',
    exposureWorkers: 4,
    sides: {
      attacker: { name: 'United States strikes · North Korean and Russian dead' },
      defender: { name: 'Strikes on the United States · American dead' },
    },
    variants: variants('book'),
    omissions: [
      `${b.zeroNote}. ${b.source}`,
      `The book's minute marks are taken from published summaries and must be checked against the text; the four interceptor misses, the submarine off California, the Russian misread and the unanswered hotline are scenario events`,
      `Four misses at the test record happen ${(fourMiss * 100).toFixed(1)} per cent of the time; the book's turn rests on a three-in-a-hundred event`,
      'No target list is in any record: the book gives counts, the engine allocates by stated rules against the documented forces and the most populous cells of the 2023 grid',
      `Attrition: ${MISSILE_ATTRITION.note}`,
      'Bombers on all sides are not flown: none is on alert and none could arrive inside the clock',
      'The Diablo Canyon reactor inventory, the book\'s high-altitude burst and its artillery on Seoul are not modelled; nuclear winter is out of the engine\'s scope',
      `Overflight: ${OUTLINE_SOURCE}`,
      ...COMMON_OMISSIONS,
      `Sources: ${S.sources.join('; ')}`,
    ],
    events,
    entities,
  }
}

/** The shot exchange on the map: every North Korean launcher fires at a city, the interceptors engage what they can in salvos of four at the test record, and the rest arrive. */
function salvoStudy(): Study {
  const gmd = RULES.gmd
  const launch = 0
  const nk = RAW.filter((r) => r.side === 'nk' && r.kind === 'icbm')
  const launchers: Launcher[] = nk.map((l) => ({ id: l.id, name: l.name, kind: 'icbm', position: [l.lon, l.lat], weapons: l.missiles ?? 0, weaponsPerVehicle: 1, rangeMetres: 13_000_000, yieldKt: l.squadrons?.[0]?.yieldKt ?? 250, reactionSeconds: launch }))
  const total = launchers.reduce((n, l) => n + l.weapons, 0)
  const cities = urbanTargets('us', usUrban, false).slice(0, total).map((t) => ({ ...t, maxWeapons: 1 }))
  const strike = enactStrike({
    prefix: 'salvo',
    side: 'defender',
    launchers,
    targets: cities,
    allocation: { maxWeaponsPerTarget: 1 },
    attrition: { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: 1 }, penetration: 1, note: 'Every missile flies; the interceptors are the only attrition, so the exchange is seen whole' },
    allocationRule: { source: 'One warhead per city, the most populous first', method: `${total} launchers, one warhead each at the 2017 test yield, against the ${total} most populous cells of the 2023 grid` },
    vehicle: { evidence: 'inferred', provenance: { source: 'The seventeen launchers of the 2024 order of battle, all fired at once', method: 'A salvo the defence was sized for: no decoys, no submarine' } },
    route: { cruise: { source: 'No bombers' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: () => 'URBAN',
    targetFacts: () => [{ label: 'Why this target', value: 'One of the most populous cells of the 2023 grid; there is no North Korean target list in any record', evidence: 'modelled', provenance: { source: (usUrban as { source: string }).source } }],
  })
  // The defence: four shots per object while the stock lasts, in the order the missiles were launched.
  // The defence cannot tell which object is bound where, so the order of engagement is the order of detection, which the engine draws.
  const tracks = strike.entities.filter((e): e is Extract<Entity, { kind: 'track' }> => e.kind === 'track').sort((a, b) => hash01(`salvo:order:${a.id}`) - hash01(`salvo:order:${b.id}`))
  const perObject = gmd.salvo
  const engaged = Math.min(tracks.length, Math.floor(gmd.interceptors / perObject))
  const p = gmd.testHits / gmd.tests
  const entities: Entity[] = [...RAW.filter((r) => r.side === 'us').map(siteOf), ...RAW.filter((r) => r.side === 'nk').map(siteOf)]
  const events: StudyEvent[] = [
    { time: launch, text: `${total} MISSILES LEAVE NORTH KOREA AT ONCE · ONE WARHEAD EACH AT THE 2017 TEST YIELD · THE CITIES BY POPULATION (INFERRED)`, camera: { center: [-170, 50], zoom: 2, durationMs: 3_000 } },
    { time: launch + 3 * MIN, text: `FORT GREELY ENGAGES THE FIRST ${engaged} OBJECTS WITH ${perObject} SHOTS EACH · ${gmd.interceptors} INTERCEPTORS, ${gmd.testHits} HITS IN ${gmd.tests} TESTS · THE REST ARE NOT ENGAGED` },
  ]
  let killed = 0
  const through: string[] = []
  tracks.forEach((t, i) => {
    const effect = strike.entities.find((e) => e.kind === 'effect' && e.name === t.name.split(' → ')[1])
    if (i < engaged) {
      const shots: Shot[] = []
      for (let k = 0; k < perObject; k += 1) shots.push({ launch: launch + 5 * MIN + i * 20 + k * 30, hit: hash01(`salvo:${t.id}:${k}`) < p })
      const g = interceptors(`salvo-${i + 1}`, t.track, shots, { source: 'The test record, one deterministic draw per shot', method: `Each shot at ${Math.round(p * 100)} per cent; the engine's draw decides` })
      entities.push(...g.entities)
      if (g.hitAt !== null) {
        killed += 1
        entities.push({ ...t, designation: `${t.designation} · INTERCEPTED ${hhmm(g.hitAt)}`, track: new Track(cutAt(t.track.waypoints, g.hitAt)) })
        events.push({ time: g.hitAt, text: `INTERCEPT · ${t.name.split(' → ')[1].toUpperCase()} SPARED ${hhmm(g.hitAt)}` })
        return
      }
    }
    entities.push(t)
    if (effect) {
      entities.push(effect)
      through.push(effect.name)
    }
  })
  events.push({ time: strike.summary.firstDetonation, text: `THE FIRST WARHEAD ARRIVES · ${through.length} OF ${total} THROUGH, ${killed} KILLED, ${total - engaged} NEVER ENGAGED` })
  events.push({ time: strike.summary.lastDetonation, text: `LAST ARRIVAL · ${through.slice(0, 6).map((n) => n.toUpperCase()).join(', ')}${through.length > 6 ? ` AND ${through.length - 6} MORE` : ''}` })
  events.sort((a, b) => a.time - b.time)
  return {
    id: '72-minutes-salvo',
    title: 'SEVENTY-TWO MINUTES · THE SHOT EXCHANGE',
    subtitle: `${total} missiles at ${total} cities against ${gmd.interceptors} interceptors at the test record · ${through.length} through · every event a scenario`,
    bounds: { start: -2 * MIN, end: strike.summary.lastDetonation + 10 * MIN },
    startTime: -MIN,
    view: { center: [-150, 50], zoom: 2 },
    populationGrid: 'ghsl/popc_2025',
    exposureWorkers: 2,
    sides: { attacker: { name: 'United States' }, defender: { name: 'The salvo · American dead' } },
    variants: variants('salvo'),
    omissions: [
      `The map form of the defence lab: the arithmetic of ${gmd.interceptors} interceptors in salvos of ${perObject} against ${total} objects, drawn. See the lab at #/lab/defence for the curve`,
      'No decoys: the case the defence was sized for. With the balloons of the 2000 countermeasures report the interceptors would engage a tenth of the objects',
      'Every missile flies and none fails, so the interceptors are the only attrition; the reliability of the missiles themselves is not modelled here',
      'The interceptors engage objects in the order they are detected, which the engine draws, because the defence cannot tell which object is bound for which city',
      'The targets are the most populous cells of the 2023 grid, one warhead each; there is no North Korean target list in any record',
      ...COMMON_OMISSIONS,
    ],
    events,
    entities,
  }
}

const cache = new Map<string, Study>()

export function seventyTwoMinutes(variant: 'film' | 'record' | 'claim' | 'salvo' | 'book'): Study {
  let s = cache.get(variant)
  if (!s) {
    s = variant === 'book' ? bookStudy() : variant === 'salvo' ? salvoStudy() : filmStudy(variant)
    cache.set(variant, s)
  }
  return s
}
