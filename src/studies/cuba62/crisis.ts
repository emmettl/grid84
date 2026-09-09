import { Track, timeByGroundSpeed } from '../../engine/track.ts'
import type { EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import { haversineMetres, type LngLat } from '../../geo/geodesy.ts'
import type { Launcher, Target } from '../../models/allocation.ts'
import { hash01 } from '../../models/attrition.ts'
import { forceForOption } from '../siop62/alert-force.ts'
import { enactStrike, type StrikeResult } from '../strike.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import orderOfBattle from '../../../data/cuba62/order-of-battle-1962.json'
import urbanFile from '../../../data/cuba62/us-southeast-1962.json'

/**
 * The Cuban missile crisis gone hot. Act one and two on one clock: the air
 * strike the Joint Chiefs pressed for, the R-12 regiments firing on Florida
 * and the south-east in the case Moscow's order is broken or overtaken, the
 * FKR regiment on Guantánamo, and a week later the landings and the Lunas.
 * Act three is the general war, the SIOP//62 force a year on and generated
 * by a month at DEFCON 2, reached by the variant switch.
 */

interface Site {
  side: 'us' | 'su'
  id: string
  name: string
  kind: string
  lon: number
  lat: number
  launchers?: number
  missiles?: number
  warheads?: number
  yieldKt?: number
  note: string
  evidence: string
  positionEvidence: string
  source: string
}

const OOB = orderOfBattle as unknown as {
  date: string
  documented: {
    r12: { regiments: number; launchers: number; missiles: number; warheads: number; yieldKt: number; rangeKm: number; readinessMinutes: number; source: string }
    r14: { launchersPlanned: number; missiles: number; warheads: number; source: string }
    fkr: { regiments: number; launchers: number; warheads: number; yieldKt: number; rangeKm: number; source: string }
    luna: { battalions: number; launchers: number; warheads: number; yieldKt: number; rangeKm: number; source: string }
    il28: { aircraft: number; bombs: number; yieldKt: number; source: string }
    troops: { anadyr: number; cia: number; source: string }
    oplan312: { sorties: number; source: string }
    oplan316: { troops: number; source: string }
    sac: { defcon: number; from: string; to: string; b52Airborne: string; source: string }
  }
  sites: Site[]
}
const URBAN = urbanFile as unknown as { rule: string; source: string; targets: Array<{ lon: number; lat: number; population: number }> }
const D = OOB.documented
const SITES = OOB.sites
const site = (id: string) => SITES.find((s) => s.id === id)!

const DAY = 86_400
const HOUR = 3_600
/** The landings of OPLAN 316 follow the air strike by a week. */
const LANDING = 7 * DAY
/** Fraction of R-12 launchers surviving the first strike, an inference: the planners could not promise to get them all. */
const STRIKE_SURVIVAL = 0.5
const FIGHTER_MS = 900_000 / 3_600
const FKR_MS = 900_000 / 3_600
const RELEASE: Provenance = { source: 'Fursenko and Naftali, One Hell of a Gamble (1997)', method: 'Moscow\'s order of 22 October forbade nuclear use without instruction; the counterfactual assumes it is broken or overtaken, as the drafts of 8 September and the Banes shootdown of 27 October make plausible' }

function tier(s: string): EvidenceTier {
  return s === 'documented' || s === 'reconstructed' || s === 'inferred' || s === 'modelled' || s === 'withheld' ? s : 'inferred'
}

function siteEntity(s: Site): Entity {
  const strength =
    s.kind === 'irbm' ? `R-12 · ${s.launchers} LAUNCHERS · ${s.missiles} MISSILES · ${s.warheads} WARHEADS OF ${(s.yieldKt ?? 0) / 1_000} MT`
    : s.kind === 'irbm-empty' ? `R-14 · ${s.launchers} LAUNCHERS PLANNED · NO MISSILES · WARHEADS AT MARIEL`
    : s.kind === 'cruise' ? `FKR-1 · ${s.launchers} LAUNCHERS · ${s.warheads} WARHEADS OF ${s.yieldKt} KT`
    : s.kind === 'luna' ? `LUNA · ${s.launchers} LAUNCHERS · ${s.warheads} WARHEADS OF ${s.yieldKt} KT`
    : s.kind === 'bomber' ? `IL-28 · ${s.launchers} AIRCRAFT · ${s.warheads} BOMBS OF ${s.yieldKt} KT`
    : s.kind.toUpperCase()
  return {
    kind: 'site',
    id: s.id,
    name: s.name,
    designation: strength,
    label: s.kind !== 'airbase' || s.id === 'homestead' || s.id === 'macdill',
    position: [s.lon, s.lat],
    evidence: s.kind === 'irbm-empty' ? 'withheld' : tier(s.evidence),
    provenance: { source: s.source, method: s.note },
    facts: [{ label: 'What is here', value: s.note, evidence: tier(s.evidence), provenance: { source: s.source } }, { label: 'Position', value: 'Read from the modern map', evidence: tier(s.positionEvidence), provenance: { source: 'Photon geocoding of the town; sea positions and beaches hand-set' } }],
  }
}
/** The R-12 regiments as launchers: a first salvo at readiness one, a second from the reloads. */
function r12Launchers(): Launcher[] {
  const out: Launcher[] = []
  for (const s of SITES.filter((x) => x.kind === 'irbm')) {
    const survivors = Array.from({ length: s.launchers ?? 0 }, (_, i) => hash01(`${s.id}:launcher:${i}`) < STRIKE_SURVIVAL).filter(Boolean).length
    out.push({ id: `${s.id}-salvo1`, name: `${s.name} · first salvo`, kind: 'irbm', position: [s.lon, s.lat], weapons: survivors, weaponsPerVehicle: 1, rangeMetres: D.r12.rangeKm * 1_000, yieldKt: D.r12.yieldKt, reactionSeconds: D.r12.readinessMinutes * 60 })
    const reloads = Math.min(survivors, (s.missiles ?? 0) - (s.launchers ?? 0))
    out.push({ id: `${s.id}-salvo2`, name: `${s.name} · reloads`, kind: 'irbm', position: [s.lon, s.lat], weapons: reloads, weaponsPerVehicle: 1, rangeMetres: D.r12.rangeKm * 1_000, yieldKt: D.r12.yieldKt, reactionSeconds: 3.5 * HOUR })
  }
  return out
}

function r12Targets(): Target[] {
  const bases: Target[] = SITES.filter((s) => s.side === 'us' && s.kind === 'airbase').map((s, i) => ({ id: `t-${s.id}`, name: s.name, priority: i, position: [s.lon, s.lat] as LngLat, maxWeapons: 1 }))
  const capital = site('washington')
  const urban: Target[] = URBAN.targets.map((c, i) => ({ id: `t-urban-${i}`, name: `Urban area ${c.lat.toFixed(1)}°N ${Math.abs(c.lon).toFixed(1)}°W`, priority: 100 + i, position: [c.lon, c.lat] as LngLat, maxWeapons: 1 }))
  return [...bases, { id: 't-washington', name: capital.name, priority: 50, position: [capital.lon, capital.lat], maxWeapons: 2 }, ...urban]
}

function cubaCategory(t: Target): string {
  return t.id === 't-washington' ? 'CAPITAL' : t.id.startsWith('t-urban') ? 'URBAN AREA · 1962 GRID' : 'OPLAN 312 AIR BASE'
}

function regionalStudy(): Study {
  const entities: Entity[] = SITES.map(siteEntity)
  const events: StudyEvent[] = []
  const usBases = SITES.filter((s) => s.side === 'us' && s.kind === 'airbase')
  const sovietTargets = SITES.filter((s) => s.side === 'su')

  // OPLAN 312: the air strike as strike packages from each Florida base to each Soviet site; conventional, so no effect is drawn.
  let n = 0
  for (const b of usBases) {
    for (const t of sovietTargets) {
      if (haversineMetres([b.lon, b.lat], [t.lon, t.lat]) > 1_200_000) continue
      n += 1
      const there = haversineMetres([b.lon, b.lat], [t.lon, t.lat]) / FIGHTER_MS
      entities.push({
        kind: 'track',
        id: `312-${n}`,
        name: `${b.name} → ${t.name}`,
        designation: 'OPLAN 312 STRIKE PACKAGE · CONVENTIONAL',
        label: false,
        side: 'attacker',
        track: new Track([
          { position: [b.lon, b.lat], time: -there },
          { position: [t.lon, t.lat], time: 0 + hash01(`312:${n}`) * 600 },
          { position: [b.lon, b.lat], time: there + 900 },
        ]),
        reveal: 'progressive',
        evidence: 'reconstructed',
        provenance: { source: D.oplan312.source, method: `${D.oplan312.sorties.toLocaleString('en-GB')} sorties on the first day (documented); which base struck which site is reconstructed` },
        route: { evidence: 'reconstructed', provenance: { source: 'Straight out and back at fighter speed' } },
        facts: [],
      })
    }
  }

  // The R-12 regiments, in the case the order is broken or overtaken.
  const r12 = enactStrike({
    prefix: 'r12',
    side: 'defender',
    launchers: r12Launchers(),
    targets: r12Targets(),
    allocation: { maxWeaponsPerTarget: 1, order: ['irbm'] },
    attrition: { reliability: { icbm: 0.75, irbm: 0.75, slbm: 0.75, bomber: 0.85 }, penetration: 1, note: 'R-12 reliability 0.75, inferred from the liquid-fuel missiles of its generation' },
    allocationRule: { source: 'Rule', method: 'The OPLAN 312 air bases first, one weapon each, then Washington with two, then the most populous cells of the 1962 grid within 2,000 km; no Soviet target list for the regiments is in the record' },
    vehicle: { evidence: 'inferred', provenance: RELEASE },
    route: { cruise: { source: 'Great circle' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: cubaCategory,
    targetFacts: (t) => (t.id.startsWith('t-urban') ? [{ label: 'Why this target', value: `One of the most populous cells of the south-east on the 1962 grid: ${URBAN.rule}`, evidence: 'modelled', provenance: { source: URBAN.source } }] : [{ label: 'Why this target', value: t.id === 't-washington' ? 'The capital, inside the R-12\'s reach from San Cristóbal' : 'A base OPLAN 312 flew from', evidence: 'documented', provenance: { source: D.oplan312.source } }]),
  })
  entities.push(...r12.entities)

  // The eastern FKR regiment on Guantánamo and the carrier in the Windward Passage; the western one on the landing fleet a week later.
  const fkrEast = site('fkr-east')
  const fkrWest = site('fkr-west')
  const fkr = enactStrike({
    prefix: 'fkr',
    side: 'defender',
    launchers: [
      { id: 'fkr-east-l', name: fkrEast.name, kind: 'bomber', position: [fkrEast.lon, fkrEast.lat], weapons: 4, weaponsPerVehicle: 1, rangeMetres: D.fkr.rangeKm * 1_000, yieldKt: D.fkr.yieldKt, reactionSeconds: 20 * 60, speedMs: FKR_MS },
      { id: 'fkr-west-l', name: fkrWest.name, kind: 'bomber', position: [fkrWest.lon, fkrWest.lat], weapons: 4, weaponsPerVehicle: 1, rangeMetres: D.fkr.rangeKm * 1_000, yieldKt: D.fkr.yieldKt, reactionSeconds: LANDING + 2 * HOUR, speedMs: FKR_MS },
    ],
    targets: [
      { id: 't-guantanamo', name: site('guantanamo').name, priority: 0, position: [site('guantanamo').lon, site('guantanamo').lat], maxWeapons: 2 },
      { id: 't-cv-independence', name: site('cv-independence').name, priority: 1, position: [site('cv-independence').lon, site('cv-independence').lat], maxWeapons: 2 },
      { id: 't-beach-east', name: site('beach-east').name, priority: 2, position: [site('beach-east').lon, site('beach-east').lat], maxWeapons: 2 },
      { id: 't-beach-west', name: site('beach-west').name, priority: 3, position: [site('beach-west').lon, site('beach-west').lat], maxWeapons: 2 },
    ],
    allocation: { maxWeaponsPerTarget: 2, order: ['bomber'] },
    attrition: { reliability: { icbm: 0.8, irbm: 0.8, slbm: 0.8, bomber: 0.8 }, penetration: 0.9, note: 'FKR reliability 0.8 and penetration 0.9 against a base and a fleet without warning; inferred' },
    allocationRule: { source: 'Rule', method: 'Four of the eastern regiment\'s forty warheads on Guantánamo and the carrier in the Windward Passage in the first hour; four of the western regiment\'s on the landing beaches a week later; the rest held' },
    vehicle: { evidence: 'documented', provenance: { source: D.fkr.source, method: 'The regiments and their warheads are documented; their use is the counterfactual' } },
    route: { cruise: { source: 'Straight line at cruise speed' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: (t) => (t.id.includes('beach') ? 'OPLAN 316 BEACH' : t.id.includes('cv') ? 'CARRIER GROUP' : 'NAVAL BASE'),
  })
  entities.push(...fkr.entities)

  // The Lunas with the regiments nearest the beaches, on the landing.
  const lunas = SITES.filter((s) => s.kind === 'luna')
  const luna = enactStrike({
    prefix: 'luna',
    side: 'defender',
    launchers: lunas.map((s) => ({ id: `${s.id}-l`, name: s.name, kind: 'irbm' as const, position: [s.lon, s.lat] as LngLat, weapons: s.warheads ?? 0, weaponsPerVehicle: 1, rangeMetres: 60_000, yieldKt: D.luna.yieldKt, reactionSeconds: LANDING + 3 * HOUR })),
    targets: [
      { id: 't-beach-east-l', name: site('beach-east').name, priority: 0, position: [site('beach-east').lon, site('beach-east').lat], maxWeapons: 4 },
      { id: 't-beach-west-l', name: site('beach-west').name, priority: 1, position: [site('beach-west').lon, site('beach-west').lat], maxWeapons: 4 },
    ],
    allocation: { maxWeaponsPerTarget: 4, order: ['irbm'] },
    attrition: { reliability: { icbm: 0.9, irbm: 0.9, slbm: 0.9, bomber: 0.9 }, penetration: 1, note: 'Luna reliability 0.9; inferred' },
    allocationRule: { source: 'Rule', method: 'The battalions within 60 km of a beach fire up to four rockets at it after the landing; the Holguín battalion is out of reach and holds' },
    vehicle: { evidence: 'documented', provenance: { source: D.luna.source, method: 'Twelve warheads on six launchers are documented; their use is the counterfactual, and their movement to the beaches is inferred' } },
    route: { cruise: { source: 'Straight line' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: () => 'OPLAN 316 BEACH',
  })
  entities.push(...luna.entities)

  // The landings themselves, as tracks from the carriers' side of the Straits to the beaches.
  for (const [id, beach] of [['landing-east', 'beach-east'], ['landing-west', 'beach-west']] as const) {
    const b = site(beach)
    entities.push({
      kind: 'track',
      id,
      name: `OPLAN 316 landing force → ${b.name}`,
      designation: `${D.oplan316.troops.toLocaleString('en-GB')} TROOPS IN THE PLAN · LANDING ON D+7`,
      label: id === 'landing-east',
      side: 'attacker',
      track: new Track(timeByGroundSpeed([[b.lon, 24.6], [b.lon, b.lat]], LANDING - 6 * HOUR, 6)),
      reveal: 'progressive',
      evidence: 'documented',
      provenance: { source: D.oplan316.source, method: 'The plan is documented; the beaches and the day are the study\'s reading of it' },
      route: { evidence: 'inferred', provenance: { source: 'Straight in from the Straits at convoy speed' } },
      facts: [],
    })
  }

  events.push(
    { time: -DAY, text: 'TRIGGER (COUNTERFACTUAL): THE EXECUTIVE COMMITTEE ORDERS OPLAN 312 FOR DAWN · THE JOINT CHIEFS PRESSED FOR THE STRIKE ON THE 27TH AND 28TH (DOCUMENTED)' },
    { time: -DAY + 1, text: `SAC AT DEFCON ${D.sac.defcon} SINCE ${D.sac.from.toUpperCase()} · ${D.sac.b52Airborne.toUpperCase().replace('OF THE FORCE', 'OF THE B-52s')} AIRBORNE (DOCUMENTED)` },
    { time: 0, text: `OPLAN 312: ${D.oplan312.sorties.toLocaleString('en-GB')} SORTIES ON THE MISSILE SITES, AIRFIELDS AND SAM SITES (DOCUMENTED PLAN) · WHICH LAUNCHERS SURVIVE IS INFERRED AT ONE HALF`, camera: { center: [-82.5, 23.5], zoom: 6, durationMs: 4_000 } },
    { time: 20 * 60, text: 'FKR REGIMENT AT MAYARÍ ARRIBA FIRES ON GUANTÁNAMO AND THE CARRIER IN THE WINDWARD PASSAGE (COUNTERFACTUAL · WEAPONS DOCUMENTED)', camera: { center: [-75.5, 20.3], zoom: 7, durationMs: 4_000 } },
    { time: D.r12.readinessMinutes * 60, text: `R-12 REGIMENTS FIRE AT READINESS ONE · ${r12.summary.weapons} MISSILES IN TWO SALVOES · MOSCOW'S ORDER BROKEN OR OVERTAKEN (COUNTERFACTUAL)`, camera: { center: [-82, 30], zoom: 4.2, durationMs: 5_000 } },
    { time: r12.summary.firstDetonation, text: 'FIRST DETONATION ON THE UNITED STATES' },
    { time: 3.5 * HOUR, text: 'RELOADS FIRED FROM THE SURVIVING LAUNCHERS (READINESS FOUR: THREE HOURS TWENTY-FIVE MINUTES, DOCUMENTED)' },
    { time: LANDING - 6 * HOUR, text: `OPLAN 316: THE LANDING FORCE CLOSES THE BEACHES EAST AND WEST OF HAVANA · ${D.oplan316.troops.toLocaleString('en-GB')} TROOPS IN THE PLAN (DOCUMENTED)`, camera: { center: [-82.4, 23.1], zoom: 8, durationMs: 5_000 } },
    { time: LANDING + 2 * HOUR, text: 'WESTERN FKR REGIMENT ON THE LANDING FLEET · LUNAS ON THE BEACHES (COUNTERFACTUAL · WEAPONS DOCUMENTED)' },
    { time: LANDING + 6 * HOUR, text: 'THE GENERAL WAR IS THE NEXT STUDY: SWITCH TO SIOP-63' },
  )
  const summary = { r12: r12.summary, fkr: fkr.summary, luna: luna.summary }
  return {
    id: 'cuba-62',
    title: 'CUBA · OCTOBER 1962',
    subtitle: `The crisis gone hot · ${D.r12.launchers} R-12 launchers, ${D.fkr.warheads} FKR and ${D.luna.warheads} Luna warheads in Cuba · the air strike, the regiments, Guantánamo, the beaches`,
    bounds: { start: -DAY - HOUR, end: LANDING + 12 * HOUR },
    view: { center: [-81, 26], zoom: 4 },
    populationGrid: 'popc_1962',
    exposureWorkers: 2,
    sides: {
      attacker: { name: 'United States · OPLAN 312 and 316, conventional' },
      defender: { name: 'Soviet forces in Cuba · United States dead' },
    },
    variants: variants('regional'),
    omissions: [
      'No order to fire was given in October 1962; every Soviet launch here is the counterfactual, and the weapons behind it are documented',
      `Troops: ${D.troops.anadyr.toLocaleString('en-GB')} in the Anadyr record against about ${D.troops.cia.toLocaleString('en-GB')} in the crisis literature and 10,000 to 12,000 in the CIA's estimate at the time`,
      `R-12 warheads at 1 Mt after Norris and Kristensen; the missile record gives 1.0 to 2.3 Mt`,
      `Launchers surviving the air strike are inferred at one half by hash; ${summary.r12.weapons} of ${D.r12.missiles} missiles fly`,
      'The R-12 regiments have no documented targets; the air bases, the capital and the most populous cells of the 1962 grid are a stated rule',
      'The air strike and the landings are drawn as movements without effects; the conventional battle is not modelled',
      'Soviet air defence, the SA-2 sites and the MiG-21 regiment are not drawn; the strike packages fly and return',
      'The R-14 sites are drawn as withheld: warheads landed, no missiles',
      'No American casualty estimate for a regional exchange from Cuba is in the record; the readout is the engine\'s sum over HYDE 1962 with no period figure beside it',
    ],
    events,
    entities,
  }
}

function variants(current: 'regional' | 'general'): Study['variants'] {
  return {
    label: 'Act',
    current,
    items: [
      { id: 'regional', label: 'Cuba and Florida', href: '#/study/cuba-62' },
      { id: 'general', label: 'SIOP-63 general war', href: '#/study/cuba-62/general' },
    ],
  }
}

/** Act three: the SIOP//62 force a year on, generated by a month at DEFCON 2, with the Cuban sites and the trigger chain in front of it. */
function generalStudy(): Study {
  const base = forceForOption(14).study
  const cubaSites = SITES.map(siteEntity).map((e) => ({ ...e, id: `cuba-${e.id}` }))
  return {
    ...base,
    id: 'cuba-62-general',
    title: 'SIOP-63 · GENERAL WAR',
    subtitle: `Counterfactual · the SIOP//62 force a year on, fully generated after a month at DEFCON ${D.sac.defcon} · ${base.subtitle.replace(/^Option 14 · 14 hours of preparation · /, '')}`,
    populationGrid: 'popc_1962',
    variants: variants('general'),
    events: [
      { time: -2, text: 'THE WEEK BEFORE: OPLAN 312, THE R-12 REGIMENTS ON FLORIDA, GUANTÁNAMO, THE LANDINGS AND THE LUNAS (THE FIRST ACT OF THIS STUDY)' },
      { time: -1, text: `SAC AT DEFCON 2 FROM ${D.sac.from.toUpperCase()} TO ${D.sac.to.toUpperCase()}, THE ONLY TIME · ${D.sac.b52Airborne.toUpperCase().replace('OF THE FORCE', 'OF THE B-52s')} AIRBORNE · THE GENERATED FORCE OF OPTION 14 STANDS FOR IT (DOCUMENTED POSTURE, RECONSTRUCTED FORCE)` },
      ...base.events,
    ],
    entities: [...cubaSites, ...base.entities],
    omissions: [
      'SIOP-63 was in force from 1 July 1962 with five attack options; its target list is withheld, and the 1956 list with the 1961 order of battle at option 14 stands for it',
      'The order of battle is that of 15 July 1961 generated to option 14; by October 1962 SAC had more Atlas and the first Titan and Minuteman, which this does not add',
      ...base.omissions,
    ],
  }
}

let regional: Study | null = null
let general: Study | null = null

export function cubaRegional(): Study {
  regional ??= regionalStudy()
  return regional
}

export function cubaGeneral(): Study {
  general ??= generalStudy()
  return general
}

export function cubaSummary(): { r12: StrikeResult['summary']; fkr: StrikeResult['summary']; luna: StrikeResult['summary'] } {
  const study = cubaRegional()
  const count = (prefix: string) => study.entities.filter((e) => e.kind === 'effect' && e.id.startsWith(`${prefix}-e-`)).length
  const weapons = (prefix: string) => study.entities.filter((e) => e.kind === 'track' && e.id.startsWith(`${prefix}-s-`)).length
  const summary = (prefix: string): StrikeResult['summary'] => ({ weapons: weapons(prefix), sorties: weapons(prefix), delivered: 0, lostReliability: 0, lostPenetration: 0, targetsCovered: count(prefix), unassigned: 0, megatons: 0, firstDetonation: 0, lastDetonation: 0, penetration: 1, vehicles: 0 })
  return { r12: summary('r12'), fkr: summary('fkr'), luna: summary('luna') }
}

export const CUBA_DOCUMENTED = D
