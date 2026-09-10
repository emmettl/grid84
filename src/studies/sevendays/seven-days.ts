import type { EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import { haversineMetres, type LngLat } from '../../geo/geodesy.ts'
import type { Launcher, Target } from '../../models/allocation.ts'
import { enactStrike, launcherSite } from '../strike.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import planFile from '../../../data/seven-days/plan-1979.json'

/**
 * Seven Days to the River Rhine. The Warsaw Pact exercise plan of 1979 that
 * Poland declassified in 2005: it assumes NATO uses nuclear weapons first,
 * on the Vistula, and answers with a nuclear counter-offensive westward.
 * Both halves are drawn, in that order, because the order is the argument.
 *
 * The western cities are the ones named in the release. The Polish half is
 * the plan's own premise and not a NATO document; the cities there are
 * Poland's largest of the period, standing for a premise the plan states
 * without a list this repository has transcribed. Everything else, the
 * weapons, the garrisons, the assignment, is inferred and says so.
 */

interface City {
  name: string
  lon: number
  lat: number
  country: string
  note: string
}

interface LauncherSpec {
  system: string
  name: string
  warheads: number
  yieldKt: number
  rangeKm: number
  lon: number
  lat: number
  note: string
}

const PLAN = planFile as unknown as {
  year: number
  source: string
  forceSource: string
  note: string
  west: City[]
  poland: City[]
  launchers: LauncherSpec[]
}

const RELEASE: Provenance = { source: PLAN.source }
const FORCE: Provenance = { source: PLAN.forceSource, method: 'Garrisons and holdings of the theatre systems of 1979 as the open literature gives them; the assignment of any of them to any of these cities is inferred' }

const MIN = 60
/** The plan's clock: the assumed strike leaves at H-hour, and the answer follows what it does, not the other way about. */
const T = { natoStrike: 0, decisionAfterArrival: 20 * MIN }

/** The premise's weapons: what the plan assumed would fall on Poland. Yields and numbers are inferred. */
const NATO_YIELD_KT = 200
const NATO_WEAPONS_PER_CITY = 2

function cityTargets(cities: City[], prefix: string): Target[] {
  return cities.map((c, i) => ({ id: `${prefix}-${i}`, name: c.name, priority: i, position: [c.lon, c.lat] as LngLat, maxWeapons: 3 }))
}

/**
 * The premise's delivery. Pershing 1a could not reach the Vistula, which is
 * why Pershing II was later wanted; in 1979 the alliance's means of striking
 * Poland was strike aviation. The F-111 wings in England stand for it, and
 * they stand for an attack the plan asserts and no NATO document describes.
 */
function natoLaunchers(): Launcher[] {
  const per = Math.ceil((PLAN.poland.length * NATO_WEAPONS_PER_CITY) / 2)
  const wing = (id: string, name: string, position: LngLat): Launcher => ({
    id, name, kind: 'bomber', position, weapons: per, weaponsPerVehicle: 2, rangeMetres: 2_400_000, yieldKt: NATO_YIELD_KT, reactionSeconds: 0,
    speedMs: 260, cruiseAltitudeMetres: 11_000, weaponAltitudeMetres: 100, descendAtMetres: 500_000,
  })
  return [
    wing('nato-heyford', 'RAF Upper Heyford · 20th Tactical Fighter Wing (F-111E)', [-1.24, 51.94]),
    wing('nato-lakenheath', 'RAF Lakenheath · 48th Tactical Fighter Wing (F-111F)', [0.56, 52.41]),
  ]
}

function pactLaunchers(releaseAt: number): Launcher[] {
  return PLAN.launchers.map((l, i) => ({
    id: `pact-${i}`,
    name: `${l.name} (${l.system})`,
    kind: l.system.startsWith('Su-') || l.system.startsWith('Tu-') ? ('bomber' as const) : l.rangeKm >= 1_000 ? ('irbm' as const) : ('irbm' as const),
    position: [l.lon, l.lat] as LngLat,
    weapons: l.warheads,
    weaponsPerVehicle: l.system.startsWith('SS-20') ? 3 : 1,
    rangeMetres: l.rangeKm * 1_000,
    yieldKt: l.yieldKt,
    reactionSeconds: releaseAt,
    propellant: 'solid' as const,
    ...(l.system.startsWith('Su-') || l.system.startsWith('Tu-')
      ? { speedMs: 250, cruiseAltitudeMetres: 11_000, weaponAltitudeMetres: 150, descendAtMetres: 400_000 }
      : {}),
  }))
}

export function sevenDaysArithmetic() {
  const pactWarheads = PLAN.launchers.reduce((a, l) => a + l.warheads, 0)
  return {
    west: PLAN.west.length,
    poland: PLAN.poland.length,
    pactWarheads,
    natoWarheads: PLAN.poland.length * NATO_WEAPONS_PER_CITY,

    neutral: PLAN.west.filter((c) => c.country === 'AT').map((c) => c.name),
  }
}

function cityFacts(t: Target) {
  const city = PLAN.west.find((c) => c.name === t.name)
  return [
    { label: 'Why this target', value: city?.note || 'Named in the reporting of the 2005 release', evidence: 'reconstructed' as EvidenceTier, provenance: RELEASE },
    ...(city?.country === 'AT' ? [{ label: 'Neutral', value: 'Austria was neutral, by treaty and by the constitutional law of 1955. The plan names Vienna anyway', evidence: 'reconstructed' as EvidenceTier, provenance: RELEASE }] : []),
  ]
}

export function sevenDays(): Study {
  const a = sevenDaysArithmetic()
  const westTargets = cityTargets(PLAN.west, 'west')
  const polandTargets = cityTargets(PLAN.poland, 'pl')

  // Act one: the premise. The plan begins by assuming it has already been struck.
  const premise = enactStrike({
    prefix: 'nato',
    side: 'defender',
    launchers: natoLaunchers(),
    targets: polandTargets,
    allocation: { maxWeaponsPerTarget: NATO_WEAPONS_PER_CITY },
    attrition: { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: 1 }, penetration: 1, note: 'No attrition on either side: the plan is an assertion about intentions, not an estimate of what would arrive' },
    allocationRule: { ...RELEASE, method: `The plan asserts a NATO nuclear attack on the Vistula valley that wrecks Poland. Which places it named is not transcribed here, so ${NATO_WEAPONS_PER_CITY} weapons of ${NATO_YIELD_KT} kt fall on each of Poland's largest cities of the period, a stated rule` },
    vehicle: { evidence: 'inferred', provenance: { source: 'Pershing 1a and the American theatre stockpile in West Germany, 1979', method: 'Standing for a strike the Warsaw Pact plan asserts and no NATO document describes' } },
    route: { cruise: { source: 'Not used' }, ballistic: { source: 'Minimum-energy trajectory with a boost phase' } },
    targetCategory: () => 'URBAN-INDUSTRIAL',
    burstFor: () => ({ burst: 'air' as const }),
    targetFacts: () => [{ label: 'Whose assumption', value: 'This half of the study is the Warsaw Pact plan\'s premise, not a NATO plan. It is what the exercise told its own officers to expect', evidence: 'withheld' as EvidenceTier, provenance: RELEASE }],
  })

  const premiseArrival = Math.min(...Object.values(premise.firstArrival).map((f) => f.time))
  const premiseLast = Math.max(...Object.values(premise.firstArrival).map((f) => f.time))
  // The answer follows the premise: the plan's officers are told what has happened to them and then told what to do about it.
  const releaseAt = Math.round(premiseLast + T.decisionAfterArrival)

  // Act two: the answer, westward, on the cities the release names. Aviation takes the near targets and the
  // missiles the deep ones, which is how the theatre forces were divided; the division here is by distance and is inferred.
  const all = pactLaunchers(releaseAt)
  const air = all.filter((l) => l.kind === 'bomber')
  const rockets = all.filter((l) => l.kind !== 'bomber')
  const front: LngLat = [10.5, 51.5]
  const near = westTargets.filter((t) => haversineMetres(front, t.position) < 500_000)
  const deep = westTargets.filter((t) => !near.includes(t))
  const airStrike = enactStrike({
    prefix: 'pact-air',
    side: 'attacker',
    launchers: air,
    targets: near,
    allocation: { maxWeaponsPerTarget: 2 },
    attrition: { reliability: { icbm: 0.9, irbm: 0.9, slbm: 0.9, bomber: 0.85 }, penetration: 0.5, note: 'Theatre strike aviation into NATO air defences: half through, inferred' },
    allocationRule: { ...RELEASE, method: 'The nearer cities to the strike aviation, the deeper ones to the missiles: a division by distance, inferred' },
    vehicle: { evidence: 'reconstructed', provenance: FORCE },
    route: { cruise: { source: 'Great circles at the profile\'s altitude', method: 'Low level for the run in, the profile the Su-24 was built for' }, ballistic: { source: 'Not used' } },
    targetCategory: () => 'URBAN-INDUSTRIAL',
    burstFor: () => ({ burst: 'air' as const }),
    targetFacts: (t) => cityFacts(t),
  })
  const answer = enactStrike({
    prefix: 'pact',
    side: 'attacker',
    launchers: rockets,
    targets: deep,
    allocation: { maxWeaponsPerTarget: 3 },
    attrition: { reliability: { icbm: 0.9, irbm: 0.9, slbm: 0.9, bomber: 0.85 }, penetration: 0.7, note: 'Nine missiles in ten away, seven aircraft in ten through; inferred' },
    allocationRule: { ...RELEASE, method: 'The cities are those named in the reporting of the release. Which system was assigned to which is not in the public account and is inferred here by range and by what was nearest' },
    vehicle: { evidence: 'reconstructed', provenance: FORCE },
    route: { cruise: { source: 'Great circles at the profile\'s altitude', method: 'Theatre strike aviation at low level, the profile the Su-24 was built for' }, ballistic: { source: 'Minimum-energy trajectory with a boost phase' } },
    targetCategory: () => 'URBAN-INDUSTRIAL',
    burstFor: () => ({ burst: 'air' as const }),
    targetFacts: (t) => cityFacts(t),
  })

  const arrivals = [...Object.values(answer.firstArrival), ...Object.values(airStrike.firstArrival)].map((f) => f.time)
  const answerFirst = Math.min(...arrivals)
  const answerLast = Math.max(...arrivals)

  const entities: Entity[] = [
    ...PLAN.launchers.map((l, i) =>
      launcherSite(all[i], {
        side: 'attacker',
        designation: `${l.system.toUpperCase()} · ${l.warheads} WARHEADS · ${l.yieldKt} KT`,
        evidence: 'reconstructed',
        provenance: { ...FORCE, method: l.note || FORCE.method },
        positionEvidence: 'inferred',
        label: true,
      }),
    ),
    ...premise.entities,
    ...answer.entities,
    ...airStrike.entities,
  ]

  const events: StudyEvent[] = [
    { time: -5 * MIN, text: 'THE EXERCISE OPENS WITH ITS OWN PREMISE: NATO HAS DECIDED TO USE NUCLEAR WEAPONS FIRST, ON THE VISTULA', camera: { center: [19, 52], zoom: 6, fit: PLAN.poland.map((c) => [c.lon, c.lat] as LngLat), durationMs: 2_500 } },
    { time: T.natoStrike, text: `THE ASSUMED NATO STRIKE LEAVES · ${a.natoWarheads} WEAPONS OF ${NATO_YIELD_KT} KT FOR POLAND · THE PLAN PUTS THE POLISH DEAD AT ABOUT TWO MILLION` },
    { time: premiseArrival, text: 'POLAND IS STRUCK · THIS IS THE HALF OF THE STUDY THAT IS AN ASSERTION, NOT A DOCUMENT', camera: { center: [19, 52], zoom: 6.5, fit: PLAN.poland.map((c) => [c.lon, c.lat] as LngLat), durationMs: 2_500 } },
    { time: Math.round(premiseLast + T.decisionAfterArrival / 2), text: 'THE ANSWER IS NOT A DECISION IN THIS PLAN. IT IS THE NEXT PARAGRAPH', camera: { center: [12, 51], zoom: 4, durationMs: 3_000 } },
    { time: releaseAt, text: `THE COUNTER-OFFENSIVE · ${answer.summary.weapons + airStrike.summary.weapons} WARHEADS RELEASED OF ${a.pactWarheads} IN THE THEATRE · MISSILES ON THE DEEP TARGETS, AVIATION ON THE NEAR ONES` },
    { time: answerFirst, text: 'FIRST WEAPONS DOWN IN THE WEST' },
    { time: answerLast, text: `THE CITIES THE PLAN NAMES ARE STRUCK · INCLUDING ${a.neutral.join(', ').toUpperCase()}, IN A NEUTRAL COUNTRY`, camera: { center: [10, 50], zoom: 6, fit: PLAN.west.map((c) => [c.lon, c.lat] as LngLat), durationMs: 3_000 } },
    { time: answerLast + 20 * MIN, text: 'SEVEN DAYS TO THE RHINE BEGINS HERE. THE PLAN DOES NOT SAY WHAT THE STRATEGIC FORCES DO NEXT, AND THAT IS THE POINT OF IT' },
  ]

  return {
    id: 'seven-days-1979',
    title: 'SEVEN DAYS TO THE RIVER RHINE',
    subtitle: `The Warsaw Pact exercise plan of 1979, declassified by Poland in 2005 · its premise on ${a.poland} Polish cities, its answer on the ${a.west} the release names · ${a.pactWarheads} warheads`,
    bounds: { start: -5 * MIN, end: answerLast + 30 * MIN },
    startTime: -5 * MIN,
    view: { center: [14, 51], zoom: 4 },
    entities,
    events,
    omissions: [
      'The primary document is public in Poland and is not transcribed here. The western cities are those named in the reporting of the 2005 release; the plan\'s full target list, its weapon numbers and its yields are not drawn from the document',
      'The Polish half is the plan\'s own premise. No NATO document describes the attack it assumes, and the cities struck here are Poland\'s largest of the period under a stated rule, not a list',
      'Yields are inferred by system: 150 kt on the SS-20, a megaton on the SS-4, 500 kt on the SS-12, 100 on the Scud, 350 on the aircraft. The plan\'s own figures are not in the public account',
      'The garrisons are the open literature\'s and the assignment of any unit to any city is inferred',
      'No conventional operations: the seven days of the title are a ground campaign this study does not draw',
      'No NATO response to the answer. The plan does not describe one, and that silence is the study\'s subject',
    ],
    populationGrid: 'popc_1976',
    exposureWorkers: 2,
    sides: { attacker: { name: 'The Warsaw Pact' }, defender: { name: 'NATO and Poland' } },
    links: [
      { label: 'Able Archer 83: the exercise that looked like this from the other side', href: '#/study/able-archer-83' },
      { label: 'Britain: Square Leg and the home front', href: '#/study/britain-80' },
      { label: 'The chronicle: posture and doctrine since 1945', href: '#/chronicle' },
      { label: 'Sources and attribution', href: '#/sources' },
    ],
  }
}
