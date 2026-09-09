import type { EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import type { LngLat } from '../../geo/geodesy.ts'
import type { Launcher, Target } from '../../models/allocation.ts'
import { hash01 } from '../../models/attrition.ts'
import { enactStrike, type StrikeResult } from '../strike.ts'
import type { Entity, FalloutAssumption, Study, StudyEvent } from '../study.ts'
import sitesFile from '../../../data/britain/sites-1980.json'
import urban1983 from '../../../data/britain/uk-urban-1983.json'
import urban1950 from '../../../data/britain/uk-urban-1950.json'
import defcon3 from '../../../data/defcon3/order-of-battle-1973.json'
import ableArcher from '../../../data/able-archer/order-of-battle-1983.json'

/**
 * Protect and Survive: Britain. Square Leg's attack of 19 September 1980 as
 * the record lets it be drawn: the totals, the timing and the wind are
 * documented, the bomb plot is withheld, so the weapons fall by a stated
 * rule on the categories Campbell and Openshaw describe, and the plumes go
 * north on the exercise's southerly wind over the 1983 grid. The readout
 * carries the Home Office's figures and Openshaw's beside the engine's. The
 * second act is Strath's ten bombs of 1955 on the 1950 grid.
 */

interface Site {
  kind: 'target' | 'rghq' | 'roc'
  category?: 'airfield' | 'naval' | 'port' | 'command'
  id: string
  name: string
  lon: number
  lat: number
  evidence: string
  positionEvidence: string
  source: string
  note: string
}

const SITES_FILE = sitesFile as unknown as {
  documented: {
    weapons: { campbell: number; later: number; megatonsCampbell: number; megatonsLater: number; groundBursts: number; airBursts: number; openshawPlot: number; yieldRangeKt: [number, number]; source: string }
    timing: { firstStrike: string; secondStrike: string; source: string }
    wind: { from: string; source: string }
    innerLondon: { struck: boolean; source: string }
    homeOffice1982: { blastDead: number; radiationDead: number; severelyInjured: number; uninjured: number; source: string }
    openshaw1983: { dead: number; seriouslyInjured: number; uninjured: number; source: string }
    strath1955: { bombs: number; yieldMt: number; dead: number; casualties: number; seriouslyInjured: number; source: string }
  }
  sites: Site[]
}
const D = SITES_FILE.documented
const SITES = SITES_FILE.sites
const URBAN83 = urban1983 as unknown as { rule: string; source: string; targets: Array<{ lon: number; lat: number; population: number }> }
const URBAN50 = urban1950 as unknown as { rule: string; source: string; targets: Array<{ lon: number; lat: number; population: number }> }

interface Field {
  side: string
  id: string
  name: string
  kind: string
  lon: number
  lat: number
  squadrons?: Array<{ version: string }>
}
const FIELDS = (defcon3 as unknown as { launchers: Field[] }).launchers.filter((l) => l.side === 'su' && l.kind === 'icbm' && l.squadrons?.[0]?.version === 'SS-11' && l.lon < 60)
const LRA = (defcon3 as unknown as { launchers: Field[] }).launchers.filter((l) => l.side === 'su' && l.kind === 'bomber')
const SS20 = (ableArcher as unknown as { sites: Array<{ side: string; kind: string; id: string; name: string; lon: number; lat: number }> }).sites.filter((s) => s.side === 'wp' && s.kind === 'ss20')

const HOUR = 3_600
const DAY = 86_400
/** The exercise's southerly wind blows the plumes north; the speed is the study's assumption. */
const WIND: FalloutAssumption = { fissionFraction: 0.5, windMph: 15, downwindBearingDeg: 0, untilHours: 48, provenance: { source: D.wind.source, method: 'Southerly wind documented; 15 mph, a fission fraction of one half and forty-eight hours of deposition are the study\'s assumptions, the last from the Home Office\'s own stay-at-home period' } }
const GROUND_KT = 1_000
const AIR_KT = 2_000
/** The central London cell, which the exercise left unstruck. */
const INNER_LONDON: LngLat = [-0.1251, 51.5416]

function tier(s: string): EvidenceTier {
  return s === 'documented' || s === 'reconstructed' || s === 'inferred' || s === 'modelled' || s === 'withheld' ? s : 'inferred'
}

function siteEntity(s: Site): Entity {
  return {
    kind: 'site',
    id: s.id,
    name: s.name,
    designation: s.kind === 'rghq' ? 'REGIONAL GOVERNMENT HEADQUARTERS' : s.kind === 'roc' ? 'ROC GROUP CONTROL · FALLOUT PLOTTED HERE' : `${(s.category ?? 'target').toUpperCase()} · ON THE PLOT? WITHHELD`,
    label: s.kind === 'rghq' || ['faslane', 'northwood', 'corsham', 'fylingdales', 'lakenheath', 'greenham'].includes(s.id),
    position: [s.lon, s.lat],
    evidence: s.kind === 'target' ? 'withheld' : tier(s.evidence),
    provenance: { source: s.source, method: s.note },
    facts: [
      { label: 'What is here', value: s.note, evidence: tier(s.evidence), provenance: { source: s.source } },
      { label: 'Position', value: 'Read from the modern map', evidence: tier(s.positionEvidence), provenance: { source: 'Photon geocoding; some hand-set' } },
    ],
  }
}

/** The western SS-11 fields of the 1973 order of battle, standing for the strategic force of 1980; the launch time puts the arrivals in the documented window. */
function squareLegLaunchers(): Launcher[] {
  const out: Launcher[] = []
  for (const f of FIELDS) {
    out.push({ id: `${f.id}-ground`, name: `${f.name} · ground bursts`, kind: 'icbm', position: [f.lon, f.lat], weapons: 20, weaponsPerVehicle: 1, rangeMetres: 12_000_000, yieldKt: GROUND_KT, reactionSeconds: -11 * 60 })
  }
  // The second strike drifts in from 13:00 to 15:00: the SS-20 garrisons and a Northern Fleet patrol area in four waves.
  const waves = [HOUR, HOUR + 40 * 60, HOUR + 80 * 60, 3 * HOUR - 10 * 60]
  waves.forEach((t, i) => {
    for (const g of SS20) out.push({ id: `${g.id}-air-${i}`, name: `${g.name} · air bursts, wave ${i + 1}`, kind: 'irbm', position: [g.lon, g.lat], weapons: 3, weaponsPerVehicle: 1, rangeMetres: 5_000_000, yieldKt: AIR_KT, reactionSeconds: t - 12 * 60 })
    out.push({ id: `northern-fleet-air-${i}`, name: `Northern Fleet patrol · Norwegian Sea · air bursts, wave ${i + 1}`, kind: 'slbm', position: [2.0, 70.0], weapons: 6, weaponsPerVehicle: 1, rangeMetres: 4_000_000, yieldKt: AIR_KT, reactionSeconds: t - 8 * 60 })
  })
  return out
}

function squareLegTargets(): Target[] {
  const order: Record<string, number> = { naval: 0, command: 1, airfield: 2, port: 3 }
  const military: Target[] = SITES.filter((s) => s.kind === 'target').map((s, i) => ({ id: `g-${s.id}`, name: s.name, priority: (order[s.category ?? 'port'] ?? 4) * 100 + i, position: [s.lon, s.lat] as LngLat, maxWeapons: s.category === 'naval' || s.category === 'command' ? 2 : 1 }))
  const cities: Target[] = URBAN83.targets
    .filter((c) => Math.abs(c.lon - INNER_LONDON[0]) > 0.01 || Math.abs(c.lat - INNER_LONDON[1]) > 0.01)
    .map((c, i) => ({ id: `a-urban-${i}`, name: `Urban area ${c.lat.toFixed(1)}°N ${Math.abs(c.lon).toFixed(1)}°${c.lon < 0 ? 'W' : 'E'}`, priority: 1_000 + i, position: [c.lon, c.lat] as LngLat, maxWeapons: 1 }))
  return [...military, ...cities]
}

const isGround = (t: Target) => t.id.startsWith('g-')

function squareLeg(): { strikes: StrikeResult[]; ground: number; air: number } {
  // Ground bursts on the military categories up to the documented 69; air bursts on the cities up to the documented 62; two strikes so neither borrows the other's targets.
  const targets = squareLegTargets()
  const launchers = squareLegLaunchers()
  const groundLaunchers = launchers.filter((l) => l.id.endsWith('-ground'))
  const airLaunchers = launchers.filter((l) => !l.id.endsWith('-ground'))
  let groundBudget = D.weapons.groundBursts
  let airBudget = D.weapons.airBursts
  for (const l of groundLaunchers) {
    const take = Math.min(l.weapons, groundBudget)
    l.weapons = take
    groundBudget -= take
  }
  for (const l of airLaunchers) {
    const take = Math.min(l.weapons, airBudget)
    l.weapons = take
    airBudget -= take
  }
  const common = {
    attrition: { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: 1 }, penetration: 1, note: 'The exercise counted the weapons that arrived; no attrition is applied' },
    allocationRule: { source: 'Rule, from the documented totals', method: `${D.weapons.groundBursts} ground bursts of 1 Mt on the naval bases, command sites, airfields and ports the record names, two on the naval and command sites, one elsewhere; ${D.weapons.airBursts} air bursts of 2 Mt on the most populous cells of the 1983 grid with inner London left out, as the exercise left it. The plot itself is withheld` },
    vehicle: { evidence: 'reconstructed' as const, provenance: { source: D.weapons.source, method: 'The totals, the yield range and the timing are documented; the launchers are the western fields of the 1973 order of battle and the SS-20 garrisons of 1983, standing for the force of 1980' } },
    route: { cruise: { source: 'Great circle' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: (t: Target) => (isGround(t) ? `GROUND BURST · ${SITES.find((s) => `g-${s.id}` === t.id)?.category?.toUpperCase() ?? 'TARGET'}` : 'AIR BURST · CITY'),
    targetFacts: (t: Target) => (isGround(t) ? [{ label: 'Why this target', value: 'In the categories Square Leg struck; whether it was on the withheld plot is not known', evidence: 'withheld' as const, provenance: { source: D.weapons.source } }] : [{ label: 'Why this target', value: `A populous cell of the 1983 grid: ${URBAN83.rule}`, evidence: 'modelled' as const, provenance: { source: URBAN83.source } }]),
    burstFor: (t: Target) => (isGround(t) ? { burst: 'surface' as const, fallout: WIND } : { burst: 'air' as const }),
  }
  const ground = enactStrike({ ...common, prefix: 'slg', side: 'attacker', launchers: groundLaunchers, targets: targets.filter(isGround), allocation: { maxWeaponsPerTarget: 2, order: ['icbm'] } })
  const air = enactStrike({ ...common, prefix: 'sla', side: 'attacker', launchers: airLaunchers, targets: targets.filter((t) => !isGround(t)), allocation: { maxWeaponsPerTarget: 1, order: ['irbm', 'slbm'] } })
  return { strikes: [ground, air], ground: D.weapons.groundBursts - groundBudget, air: D.weapons.airBursts - airBudget }
}

function variants(current: 'square-leg' | 'strath'): Study['variants'] {
  return {
    label: 'Act',
    current,
    items: [
      { id: 'square-leg', label: 'Square Leg, 1980', href: '#/study/britain-80' },
      { id: 'strath', label: 'Strath, 1955', href: '#/study/britain-80/strath' },
    ],
  }
}

function squareLegStudy(): Study {
  const { strikes, ground, air } = squareLeg()
  const entities: Entity[] = [...SITES.map(siteEntity), ...strikes.flatMap((s) => s.entities)]
  const events: StudyEvent[] = [
    { time: -HOUR, text: 'SQUARE LEG · 11 TO 25 SEPTEMBER 1980 · TRANSITION TO WAR EXERCISED BY THE MINISTRY AND THE HOME OFFICE · THE ATTACK ON THE 19TH (DOCUMENTED)' },
    { time: -30 * 60, text: `THE BOMB PLOT IS WITHHELD: THE 2009 AND 2011 REQUESTS REFUSED, THE 1980 WRITTEN ANSWER DECLINES TO NAME TARGETS · ${ground} GROUND AND ${air} AIR BURSTS FALL HERE BY A STATED RULE (WITHHELD · RECONSTRUCTED)` },
    { time: 60, text: `12:01 · FIRST STRIKE BEGINS · GROUND BURSTS ON THE AIRFIELDS, NAVAL BASES, COMMAND SITES AND PORTS · ${D.timing.firstStrike.toUpperCase()} (DOCUMENTED TIMING)`, camera: { center: [-2, 53.5], zoom: 5.2, durationMs: 4_000 } },
    { time: 10 * 60, text: '12:10 · FIRST STRIKE ENDS · THE PLUMES BEGIN TO MOVE NORTH ON THE SOUTHERLY WIND (WIND DOCUMENTED, SPEED ASSUMED)' },
    { time: HOUR, text: `13:00 · SECOND STRIKE · AIR BURSTS ON THE CITIES, DRIFTING IN UNTIL 15:00 · INNER LONDON NOT STRUCK (DOCUMENTED)` },
    { time: 3 * HOUR, text: '15:00 · THE ATTACK IS OVER · 205 MT IN CAMPBELL\'S COUNT, 280.5 IN THE LATER ONE (DOCUMENTED, DISAGREEING)' },
    { time: 48 * HOUR, text: `H+48 H · THE STAY-AT-HOME PERIOD ENDS · HOME OFFICE 1982: ${(D.homeOffice1982.blastDead / 1e6).toFixed(1)} MILLION BLAST DEAD, ${(D.homeOffice1982.radiationDead / 1e6).toFixed(1)} MILLION RADIATION DEAD · OPENSHAW 1983: ${(D.openshaw1983.dead / 1e6).toFixed(0)} MILLION DEAD (DOCUMENTED, DISAGREEING)` },
  ]
  return {
    id: 'britain-80',
    title: 'PROTECT AND SURVIVE · BRITAIN',
    subtitle: `Square Leg, 19 September 1980 · ${ground} ground and ${air} air bursts by the documented totals · the plot withheld, the plumes on the exercise's own wind`,
    bounds: { start: -HOUR, end: 4 * HOUR },
    surfaceBounds: { start: -HOUR, end: 3 * DAY },
    defaultBurst: 'surface',
    view: { center: [-2.5, 54.5], zoom: 4.8 },
    populationGrid: 'ghsl/popc_1985',
    exposureWorkers: 3,
    outcomeReference: { label: 'Home Office estimate, 1982, blast dead', value: D.homeOffice1982.blastDead, source: `${D.homeOffice1982.source}; radiation dead ${(D.homeOffice1982.radiationDead / 1e6).toFixed(1)} million. Openshaw, Steadman and Greene 1983: ${(D.openshaw1983.dead / 1e6).toFixed(0)} million dead in all` },
    sides: { attacker: { name: 'Soviet strike · British dead' }, defender: { name: 'No answer drawn' } },
    variants: variants('square-leg'),
    omissions: [
      'The bomb plot is withheld. Every target here is in a category the record names or a populous cell of the grid; whether any particular site was on the plot is not known, and each mark says so',
      `The totals disagree: ${D.weapons.campbell} weapons and ${D.weapons.megatonsCampbell} Mt in Campbell's count, ${D.weapons.later} and ${D.weapons.megatonsLater} in the later one, ${D.weapons.openshawPlot} strikes in the plot Openshaw worked from; Campbell's ground and air split is used`,
      'Yields are 1 Mt on the ground bursts and 2 Mt on the air bursts, inside the documented 500 kt to 3 Mt; the plot\'s own yields are withheld',
      `Wind: southerly, documented; ${WIND.windMph} mph, a fission fraction of one half and 48 hours of deposition assumed`,
      'The launchers are the western SS-11 fields of 1973 and the SS-20 garrisons of 1983 standing for the force of 1980; the exercise did not say where its weapons came from',
      'Britain\'s own forces, the Polaris boats and the Vulcans, are not drawn; the exercise was about the home front',
      'The Home Office, Openshaw and this engine make different shelter and evacuation assumptions; the readout gives all three and resolves none',
      'The blast and fire headlines are a union over the grid, each person counted once; the fallout figure still sums the plumes separately, so people under more than one plume are counted more than once',
      'Northern Ireland: no plot was released and none is drawn',
    ],
    events,
    entities,
  }
}

/** Strath, 1955: ten hydrogen bombs of 10 Mt at night on the ten largest cities of the 1950 grid, ground bursts, which was the report's revolutionary finding. */
function strathStudy(): Study {
  const cities = URBAN50.targets.slice(0, D.strath1955.bombs)
  const targets: Target[] = cities.map((c, i) => ({ id: `s-${i}`, name: `City ${c.lat.toFixed(1)}°N ${Math.abs(c.lon).toFixed(1)}°${c.lon < 0 ? 'W' : 'E'}`, priority: i, position: [c.lon, c.lat] as LngLat, maxWeapons: 1 }))
  const launchers: Launcher[] = LRA.map((f, i) => ({ id: f.id, name: `${f.name} · Tu-16 and Tu-4`, kind: 'bomber' as const, position: [f.lon, f.lat] as LngLat, weapons: i < 2 ? 3 : 2, weaponsPerVehicle: 1, rangeMetres: 6_000_000, yieldKt: D.strath1955.yieldMt * 1_000, reactionSeconds: -4 * HOUR + hash01(`strath:${f.id}`) * HOUR, speedMs: 800_000 / 3_600 }))
  const wind: FalloutAssumption = { ...WIND, downwindBearingDeg: 90, provenance: { source: 'Assumption', method: 'A westerly wind at 15 mph, the prevailing one; Strath\'s own wind is not in the summary' } }
  const strike = enactStrike({
    prefix: 'st',
    side: 'attacker',
    launchers,
    targets,
    allocation: { maxWeaponsPerTarget: 1, order: ['bomber'] },
    attrition: { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: 1 }, penetration: 1, note: 'Strath assumed the bombs arrived; no attrition' },
    allocationRule: { source: D.strath1955.source, method: 'Ten bombs of 10 Mt; the report\'s targets are not in the public summary, so the ten most populous cells of the 1950 grid stand for them' },
    vehicle: { evidence: 'reconstructed', provenance: { source: D.strath1955.source, method: 'Bombers of Long Range Aviation from the fields of the 1973 order of battle, standing for the Tu-16 and Tu-4 force of 1955' } },
    route: { cruise: { source: 'Great circle at cruise speed' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: () => 'GROUND BURST · 10 MT · CITY',
    targetFacts: () => [{ label: 'Why this target', value: `One of the ten most populous cells of the 1950 grid: ${URBAN50.rule}`, evidence: 'modelled', provenance: { source: URBAN50.source } }],
    burstFor: () => ({ burst: 'surface', fallout: wind }),
  })
  const entities: Entity[] = [...SITES.filter((s) => s.kind === 'rghq').map(siteEntity), ...strike.entities]
  return {
    id: 'britain-80-strath',
    title: 'STRATH · 1955',
    subtitle: 'Ten hydrogen bombs of 10 Mt at night on the 1950 grid · the state\'s first look at fallout, classified until 2002',
    bounds: { start: -5 * HOUR, end: 2 * HOUR },
    surfaceBounds: { start: -5 * HOUR, end: 3 * DAY },
    defaultBurst: 'surface',
    view: { center: [-2.5, 54.5], zoom: 4.8 },
    populationGrid: 'popc_1950',
    exposureWorkers: 2,
    outcomeReference: { label: 'Strath report, 1955, dead', value: D.strath1955.dead, source: `${D.strath1955.source}: ${(D.strath1955.casualties / 1e6).toFixed(0)} million casualties, up to ${(D.strath1955.dead / 1e6).toFixed(0)} million dead, ${(D.strath1955.seriouslyInjured / 1e6).toFixed(0)} million seriously injured` },
    sides: { attacker: { name: 'Soviet strike · British dead' }, defender: { name: 'No answer drawn' } },
    variants: variants('strath'),
    omissions: [
      'Strath\'s ten targets are not in the public summary; the ten most populous cells of 1950 stand for them',
      'The bombers are drawn from the 1973 fields; the 1955 force flew from the same western districts in older aircraft',
      'The wind is assumed westerly; the report\'s fallout findings are quoted on the readout, its wind is not',
      'The regional headquarters drawn are the 1980s configuration; the war rooms of 1955 were under construction',
    ],
    events: [
      { time: -5 * HOUR, text: 'STRATH, 1955: A LIMITED ATTACK OF TEN HYDROGEN BOMBS OF 10 MT AT NIGHT, WITHOUT PREPARATION (DOCUMENTED)' },
      { time: -4 * HOUR, text: 'LONG RANGE AVIATION LEAVES ITS FIELDS · NO WARNING ASSUMED (RECONSTRUCTED)' },
      { time: strike.summary.firstDetonation, text: 'FIRST DETONATION' },
      { time: strike.summary.lastDetonation, text: `LAST DETONATION · "FALLOUT, COMBINED WITH THE VAST EXPLOSIVE POWER OF THE HYDROGEN BOMB, PRESENTS PROBLEMS OF A REVOLUTIONARY CHARACTER" (DOCUMENTED)` },
      { time: 48 * HOUR, text: 'H+48 H · STRATH: 16 MILLION CASUALTIES, UP TO 12 MILLION DEAD, 13 MILLION NEEDING SHELTER FOR A WEEK · LONDON ALONE 4 MILLION CASUALTIES (DOCUMENTED)' },
    ],
    entities,
  }
}

let squareLegBuilt: Study | null = null
let strathBuilt: Study | null = null

export function britainSquareLeg(): Study {
  squareLegBuilt ??= squareLegStudy()
  return squareLegBuilt
}

export function britainStrath(): Study {
  strathBuilt ??= strathStudy()
  return strathBuilt
}

export const BRITAIN_DOCUMENTED = D
export type { Provenance }
