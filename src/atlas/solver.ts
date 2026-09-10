import { haversineMetres, initialBearing, type LngLat } from '../geo/geodesy.ts'
import { boostedTrajectory, boostProfileFor, type BoostProfile } from '../models/ballistic.ts'
import { airReachMetres, boostWindow, SPACE_LAYERS, spaceChance } from '../models/boost-intercept.ts'
import { describeLandUse, type LandUse } from './landuse.ts'
import { radiusForPsi } from '../models/casualties.ts'
import { lethalRadiusMetres, singleShotKill } from '../models/lethality.ts'
import { laydown } from '../wopr/union.ts'
import { adversaryFor, type Adversary } from './adversary.ts'
import { FORCES, POWERS, type ForceSite, type Power } from './forces.ts'
import type { AtlasTarget } from './target.ts'

/**
 * The heuristic solver behind the atlas strike: what the place is, who
 * would strike it, with what, how many, and where the aim points fall.
 * Every step returns the line it would print, so the console can show its
 * reasoning as it goes. Nothing here is doctrine; it is a stated rule.
 */

/** Population within rings around the target, from the 2025 grid. */
export interface Profile {
  /** Cumulative population within each radius, metres → people. */
  within: Record<number, number>
  gridName: string
}

export const PROFILE_RINGS = [2_000, 5_000, 10_000, 20_000, 30_000]

export type Category = 'URBAN-INDUSTRIAL' | 'MILITARY' | 'AIRFIELD' | 'PORT' | 'COMMAND' | 'INDUSTRY' | 'INFRASTRUCTURE' | 'TOWN' | 'RURAL'

export interface Classification {
  category: Category
  /** Whether the ground itself was read, or only the geocoder's tag and the population grid. */
  ground: 'land use' | 'tag and density'
  /** The radius the urban area extends to, metres, by density; zero for a point target. */
  urbanRadiusMetres: number
  population: number
  /** Countervalue targets are struck for their population; counterforce and infrastructure targets as points, hard ones on the surface. */
  countervalue: boolean
  hard: boolean
  reason: string
}

/** People per square kilometre above which an annulus still counts as the urban area. */
const URBAN_DENSITY = 800

function densityOfAnnulus(profile: Profile, inner: number, outer: number): number {
  const people = (profile.within[outer] ?? 0) - (profile.within[inner] ?? 0)
  const areaKm2 = (Math.PI * (outer * outer - inner * inner)) / 1e6
  return areaKm2 > 0 ? people / areaKm2 : 0
}

/**
 * What is this, and is it worth a weapon?
 *
 * Three things are asked in order. What does OpenStreetMap call the point
 * itself — a barracks, an aerodrome, a refinery. What is the ground around
 * it actually used for, which is the land-use answer and the only one of
 * the three that can tell a works from a housing estate. And how many
 * people are on it, which decides whether it is struck as an area at all.
 *
 * The tag is asked first, because a tag that says `military=naval_base` is
 * a statement about this place and not an inference from its surroundings.
 * Where the tag says nothing useful the ground decides, and where the
 * ground is not known the density decides, as it did before.
 */
export function classify(target: AtlasTarget, profile: Profile, land?: LandUse | null): Classification {
  const key = target.osmKey
  const value = target.osmValue
  const population = profile.within[30_000] ?? 0
  const within10 = profile.within[10_000] ?? 0
  // Walk out ring by ring while the annulus stays urban.
  let urban = 0
  let prev = 0
  for (const r of PROFILE_RINGS) {
    const d = densityOfAnnulus(profile, prev, r)
    if (d >= URBAN_DENSITY) urban = r
    else break
    prev = r
  }
  const ground: Classification['ground'] = land && land.mappedKm2 > 0 ? 'land use' : 'tag and density'
  const role = (category: Category, countervalue: boolean, hard: boolean, reason: string): Classification => ({ category, ground, urbanRadiusMetres: countervalue ? urban : 0, population, countervalue, hard, reason })
  if (key === 'military' || value === 'military' || value === 'barracks' || value === 'naval_base') return role('MILITARY', false, true, `OPENSTREETMAP TAGS IT ${key}=${value} · COUNTERFORCE · SURFACE BURST ON A HARD POINT`)
  if (key === 'aeroway' || value === 'aerodrome' || value === 'airport') return role('AIRFIELD', false, false, `OPENSTREETMAP TAGS IT ${key}=${value} · THE RUNWAYS ARE THE AIM POINT`)
  if (value === 'port' || value === 'harbour' || value === 'harbor' || key === 'harbour') return role('PORT', false, false, `OPENSTREETMAP TAGS IT ${key}=${value} · THE QUAYS AND THE TOWN BEHIND THEM`)
  if (key === 'power' || value === 'plant' || value === 'nuclear' || value === 'refinery' || value === 'dam') return role('INFRASTRUCTURE', false, true, `OPENSTREETMAP TAGS IT ${key}=${value} · A SURFACE BURST TO BE SURE OF THE STRUCTURE`)
  if (value === 'industrial' || key === 'industrial' || value === 'factory' || value === 'works') return role('INDUSTRY', false, false, `OPENSTREETMAP TAGS IT ${key}=${value} · INDUSTRIAL FLOOR SPACE`)
  if (value === 'government' || value === 'parliament' || value === 'palace' || value === 'ministry' || value === 'embassy') return role('COMMAND', false, false, `OPENSTREETMAP TAGS IT ${key}=${value} · LEADERSHIP`)

  // The ground itself, where the tag said nothing useful. A barracks or an
  // airfield that the geocoder called a suburb is still a barracks or an
  // airfield, and a works is not a housing estate however many people the
  // grid puts around it.
  if (land && land.mappedKm2 > 0) {
    const built = land.shares.residential + land.shares.commercial + land.shares.industrial
    if (land.militaryKm2 >= MILITARY_GROUND_KM2 || land.shares.military >= 0.2) return role('MILITARY', false, true, `${land.militaryKm2.toFixed(1)} KM² OF MILITARY LAND ON THE GROUND · COUNTERFORCE · SURFACE BURST ON A HARD POINT`)
    if (land.aerodromeKm2 >= AERODROME_GROUND_KM2) return role('AIRFIELD', false, false, `${land.aerodromeKm2.toFixed(1)} KM² OF AERODROME ON THE GROUND · THE RUNWAYS ARE THE AIM POINT`)
    if (land.shares.industrial >= 0.3 && land.industrialKm2 >= 1 && within10 < 150_000) return role('INDUSTRY', false, false, `${Math.round(land.shares.industrial * 100)}% OF THE MAPPED GROUND IS INDUSTRIAL · INDUSTRIAL FLOOR SPACE, NOT THE PEOPLE`)
    if (built >= 0.4 && (urban >= 5_000 || within10 >= 150_000)) return role('URBAN-INDUSTRIAL', true, false, `${Math.round(built * 100)}% OF THE MAPPED GROUND IS BUILT ON · ${Math.round(within10).toLocaleString('en-GB')} WITHIN 10 KM · COUNTERVALUE`)
    if (land.shares.farmland + land.shares.green >= 0.7 && within10 < 40_000) return role('RURAL', false, false, `${Math.round((land.shares.farmland + land.shares.green) * 100)}% OF THE MAPPED GROUND IS FIELD OR WOOD · ${Math.round(within10).toLocaleString('en-GB')} WITHIN 10 KM · STRUCK AS A POINT IF AT ALL`)
  }

  if (urban >= 5_000 || within10 >= 300_000) return role('URBAN-INDUSTRIAL', true, false, `DENSITY ABOVE ${URBAN_DENSITY} PER KM² OUT TO ${Math.round(urban / 1000)} KM · ${Math.round(within10).toLocaleString('en-GB')} WITHIN 10 KM · COUNTERVALUE`)
  if (within10 >= 40_000) return role('TOWN', true, false, `${Math.round(within10).toLocaleString('en-GB')} WITHIN 10 KM · A TOWN, STRUCK AS AN AREA`)
  return role('RURAL', false, false, `${Math.round(within10).toLocaleString('en-GB')} WITHIN 10 KM · NO URBAN AREA · STRUCK AS A POINT`)
}

/** Military land on the ground that makes a place a military target whatever the geocoder called it, square kilometres. */
export const MILITARY_GROUND_KM2 = 0.8
/** The same for an aerodrome: a strip and its apron. */
export const AERODROME_GROUND_KM2 = 0.5

export interface DeliveryOption {
  site: ForceSite
  distanceMetres: number
  flightSeconds: number
  route: 'ballistic' | 'cruise'
  inRange: boolean
  /** The boost profile a ballistic option flies; null for aircraft. */
  boost: BoostProfile | null
}

const CRUISE_SPEED_MS = 240

/** Time from launch to the target for an air-delivered weapon: the carrier to its release point, the missile the rest. */
export function cruiseFlightSeconds(site: ForceSite, distanceMetres: number): number {
  const standoff = (site.standoffKm ?? 0) * 1_000
  const carrier = site.carrierSpeedMs !== undefined && site.carrierSpeedMs > 0
  // Release as far out as the missile allows, after the climb-out; a boat fires from where it sits.
  const leg = carrier ? Math.max(distanceMetres - standoff, Math.min(150_000, distanceMetres / 3)) : 0
  return leg / (carrier ? (site.carrierSpeedMs as number) : CRUISE_SPEED_MS) + (distanceMetres - leg) / (site.missileSpeedMs ?? CRUISE_SPEED_MS)
}

/** The least distance a system can be flown: about an eighth of its reach for a ballistic missile, nothing for aircraft. */
export function minimumRangeMetres(site: ForceSite): number {
  if (site.kind === 'bomber') return 0
  return site.rangeKm * 1_000 * 0.12
}

export type Loading = 'deployed' | 'full'

/** The site as the loading posture has it: the deployed load the Notebook gives, or the missile's capacity. */
export function loaded(site: ForceSite, loading: Loading): ForceSite {
  return loading === 'full' && site.warheadsPerMissileFull && site.warheadsPerMissileFull > site.warheadsPerMissile ? { ...site, warheadsPerMissile: site.warheadsPerMissileFull } : site
}

export function deliveryOptions(power: Power, position: LngLat, loading: Loading = 'deployed'): DeliveryOption[] {
  const out: DeliveryOption[] = []
  for (const raw of FORCES) {
    if (raw.side !== power) continue
    const site = loaded(raw, loading)
    const distanceMetres = haversineMetres(site.position, position)
    // A ballistic missile has a minimum range as well as a maximum: an ICBM cannot be flown across a border.
    const inRange = distanceMetres <= site.rangeKm * 1_000 && distanceMetres >= minimumRangeMetres(site)
    const route = site.kind === 'bomber' ? 'cruise' : 'ballistic'
    const boost = route === 'ballistic' ? boostProfileFor(site.kind, site.rangeKm * 1_000, site.propellant, distanceMetres) : null
    const flightSeconds = route === 'cruise' ? cruiseFlightSeconds(site, distanceMetres) : boost ? boostedTrajectory(site.position, position, boost).totalSeconds : 0
    out.push({ site, distanceMetres, flightSeconds, route, inRange, boost })
  }
  // In range first, ballistic before cruise, then the shortest flight.
  return out.sort((a, b) => Number(b.inRange) - Number(a.inRange) || Number(a.route === 'cruise') - Number(b.route === 'cruise') || a.flightSeconds - b.flightSeconds)
}

export interface Sizing {
  warheads: number
  missiles: number
  yieldKt: number
  burst: 'air' | 'surface'
  /** The 5 psi radius of one weapon at the chosen burst, metres. */
  r5: number
  aimPoints: LngLat[]
  reason: string
}

/** The damage expectancy a planner asks of a point target: the chance at least one warhead kills it. */
export const DAMAGE_EXPECTANCY = 0.9
/** The most warheads one strike lays down, whatever the area asks. */
export const MAX_WARHEADS = 48
/** A salvo from one launch point; a larger strike calls on more points. */
export const MISSILES_PER_SITE = 4

/**
 * How many weapons a target draws. A point target takes as many warheads on
 * its one aim point as the kill probability needs to reach the damage
 * expectancy, up to the system's load; an urban area takes enough 5 psi
 * discs to tile it, up to the ceiling, laid down in a sunflower.
 */
export function sizeWeapon(cls: Classification, site: ForceSite, center: LngLat, wantFallout: boolean): Sizing {
  const yieldKt = site.yieldKt
  const burst: 'air' | 'surface' = cls.hard || wantFallout ? 'surface' : 'air'
  const r5 = radiusForPsi(yieldKt, 5, burst)
  let warheads = 1
  let reason: string
  let aimPoints: LngLat[]
  if (cls.countervalue && cls.urbanRadiusMetres > 0) {
    const needed = Math.ceil((cls.urbanRadiusMetres * cls.urbanRadiusMetres) / (r5 * r5))
    warheads = Math.max(1, Math.min(MAX_WARHEADS, needed))
    reason = `5 PSI RADIUS OF ${yieldKt >= 1000 ? `${(yieldKt / 1000).toFixed(1)} MT` : `${yieldKt} KT`} AT ${burst.toUpperCase()} BURST IS ${(r5 / 1000).toFixed(1)} KM · URBAN AREA ${Math.round(cls.urbanRadiusMetres / 1000)} KM · ${needed} DISC${needed > 1 ? 'S' : ''} TO TILE IT${needed > MAX_WARHEADS ? ` · CAPPED AT ${MAX_WARHEADS}` : ''}`
    aimPoints = laydown(center, warheads, yieldKt, burst === 'surface' ? radiusForPsi(yieldKt, 5, 'surface') * 1.6 : undefined)
  } else if (cls.countervalue) {
    reason = `A TOWN INSIDE ONE 5 PSI DISC OF ${(r5 / 1000).toFixed(1)} KM · ONE WEAPON`
    aimPoints = [center]
  } else {
    // A point: enough warheads on the one aim point for the damage expectancy, given the CEP and the reliability.
    const psi = HARDNESS[cls.category]
    const per = site.reliability * singleShotKill(yieldKt, site.cepMetres, psi)
    const cap = loadCap(site)
    const needed = per >= DAMAGE_EXPECTANCY ? 1 : per <= 0.01 ? cap : Math.ceil(Math.log(1 - DAMAGE_EXPECTANCY) / Math.log(1 - per))
    warheads = Math.max(1, Math.min(cap, needed))
    const de = 1 - (1 - per) ** warheads
    reason = `A POINT TARGET AT ${psi} PSI · ${Math.round(per * 100)}% PER WARHEAD AS FIRED (CEP ${site.cepMetres} M) · DAMAGE EXPECTANCY ${Math.round(DAMAGE_EXPECTANCY * 100)}% ASKED · ${warheads} WARHEAD${warheads > 1 ? 'S' : ''} ON THE ONE AIM POINT GIVE${warheads > 1 ? '' : 'S'} ${Math.round(de * 100)}%${needed > cap ? ` · SHORT OF IT WITHIN ${cap} FROM THIS SYSTEM` : ''}${cls.hard ? ' · ON THE SURFACE' : ''}`
    aimPoints = [center]
  }
  const missiles = Math.ceil(warheads / site.warheadsPerMissile)
  return { warheads, missiles, yieldKt, burst, r5, aimPoints, reason }
}

/** How many warheads one strike may draw from a system: a heavy missile's full load, or two loads of a lighter one, never more than twelve. */
export function loadCap(site: ForceSite): number {
  return site.warheadsPerMissile >= 6 ? site.warheadsPerMissile : Math.max(1, Math.min(12, site.warheadsPerMissile * 2))
}

/** How many missiles the sites of one system in range can put up together, a salvo each. */
function capacityOf(system: string, options: DeliveryOption[]): number {
  return options.filter((o) => o.inRange && o.site.system === system).length * MISSILES_PER_SITE
}

/**
 * How well an option answers the target: for an urban area, the fraction of
 * it the system's sites in range could put under 5 psi together, up to the
 * ceiling; for a point, the damage expectancy one load of the system
 * achieves against its hardness. One for a town.
 */
export function scoreOf(cls: Classification, o: DeliveryOption, options: DeliveryOption[], wantFallout: boolean): number {
  const burst: 'air' | 'surface' = cls.hard || wantFallout ? 'surface' : 'air'
  if (cls.countervalue && cls.urbanRadiusMetres > 0) {
    const r5 = radiusForPsi(o.site.yieldKt, 5, burst)
    const available = Math.min(MAX_WARHEADS, capacityOf(o.site.system, options) * o.site.warheadsPerMissile)
    return Math.min(1, (available * r5 * r5) / (cls.urbanRadiusMetres * cls.urbanRadiusMetres))
  }
  if (cls.countervalue) return 1
  const per = o.site.reliability * singleShotKill(o.site.yieldKt, o.site.cepMetres, HARDNESS[cls.category])
  return 1 - (1 - per) ** loadCap(o.site)
}

/** Kept for the labs and tests: the fraction of the urban area one strike from this system alone would cover. */
export function coverageOf(cls: Classification, site: ForceSite, wantFallout: boolean): number {
  if (!cls.countervalue || cls.urbanRadiusMetres <= 0) return 1
  const burst: 'air' | 'surface' = cls.hard || wantFallout ? 'surface' : 'air'
  const r5 = radiusForPsi(site.yieldKt, 5, burst)
  return Math.min(1, (loadCap(site) * r5 * r5) / (cls.urbanRadiusMetres * cls.urbanRadiusMetres))
}

/** A salvo from one launch point, its launch held back so its warheads arrive with the others'. */
export interface Salvo {
  option: DeliveryOption
  missiles: number
  warheads: number
  launchDelaySeconds: number
}

/** Spread the missiles over the sites of the chosen system nearest first, a salvo each, and stagger the launches for a common arrival. */
export function planSalvos(primary: DeliveryOption, options: DeliveryOption[], missiles: number, warheadsPerMissile: number, totalWarheads: number): Salvo[] {
  const sites = [primary, ...options.filter((o) => o.inRange && o.site.system === primary.site.system && o.site.id !== primary.site.id).sort((a, b) => a.flightSeconds - b.flightSeconds)]
  const salvos: Salvo[] = []
  let left = missiles
  let warheadsLeft = totalWarheads
  for (const o of sites) {
    if (left <= 0) break
    const n = Math.min(MISSILES_PER_SITE, left)
    const w = Math.min(warheadsLeft, n * warheadsPerMissile)
    salvos.push({ option: o, missiles: n, warheads: w, launchDelaySeconds: 0 })
    left -= n
    warheadsLeft -= w
  }
  const arrival = Math.max(...salvos.map((x) => x.option.flightSeconds))
  for (const x of salvos) x.launchDelaySeconds = Math.round(arrival - x.option.flightSeconds)
  return salvos
}

/** Each aim point with its offset from the centre and the reason it is there. */
export function describeAimPoints(sizing: Sizing, center: LngLat): Array<{ index: number; position: LngLat; distanceMetres: number; bearingDeg: number; reason: string }> {
  return sizing.aimPoints.map((p, i) => {
    const distanceMetres = haversineMetres(center, p)
    const bearingDeg = distanceMetres > 1 ? initialBearing(center, p) : 0
    const reason = i === 0 ? 'THE CENTRE · THE DENSEST TWO KILOMETRES · THE GEOCODER\'S POINT' : `THE NEXT DISC OUTWARD ON THE SUNFLOWER · ${(distanceMetres / 1000).toFixed(1)} KM AT ${Math.round(bearingDeg).toString().padStart(3, '0')}° · ITS 5 PSI EDGE MEETS ITS NEIGHBOURS'`
    return { index: i, position: p, distanceMetres, bearingDeg, reason }
  })
}

/** The overpressure a target category is taken to fail at, psi: the lethality lab's ladder. */
export const HARDNESS: Record<Category, number> = { 'URBAN-INDUSTRIAL': 5, TOWN: 5, RURAL: 5, INDUSTRY: 15, PORT: 15, AIRFIELD: 25, COMMAND: 50, INFRASTRUCTURE: 100, MILITARY: 1_000 }

export interface Kill {
  psi: number
  cepMetres: number
  lethalRadiusMetres: number
  sspk: number
  reliability: number
  /** Probability one warhead as fired kills its aim point: reliability times the single-shot kill. */
  perWarhead: number
  /** Expected aim points killed of those assigned. */
  expected: number
  line: string
}

export function killProbability(cls: Classification, site: ForceSite, sizing: Sizing): Kill {
  const psi = HARDNESS[cls.category]
  const lethal = lethalRadiusMetres(sizing.yieldKt, psi)
  const sspk = singleShotKill(sizing.yieldKt, site.cepMetres, psi)
  const perWarhead = site.reliability * sspk
  const onePoint = sizing.aimPoints.length === 1 && sizing.warheads > 1
  const expected = onePoint ? 1 - (1 - perWarhead) ** sizing.warheads : perWarhead * sizing.warheads
  const line = `KILL PROBABILITY · ${cls.category} TAKEN AT ${psi} PSI · LETHAL RADIUS ${(lethal / 1000).toFixed(1)} KM AGAINST A CEP OF ${site.cepMetres} M · SINGLE-SHOT ${Math.round(sspk * 100)}% · RELIABILITY ${Math.round(site.reliability * 100)}% · ${Math.round(perWarhead * 100)}% PER WARHEAD AS FIRED · ${onePoint ? `${sizing.warheads} ON THE ONE AIM POINT GIVE ${Math.round(expected * 100)}% DAMAGE EXPECTANCY` : `${expected.toFixed(1)} OF ${sizing.warheads} AIM POINTS EXPECTED KILLED`}${sspk > 0.99 ? ' · ACCURACY IS NO LONGER THE QUESTION AT THIS YIELD' : ''}`
  return { psi, cepMetres: site.cepMetres, lethalRadiusMetres: lethal, sspk, reliability: site.reliability, perWarhead, expected, line }
}

export interface StrikePlan {
  target: AtlasTarget
  adversary: Adversary
  classification: Classification
  options: DeliveryOption[]
  delivery: DeliveryOption
  sizing: Sizing
  /** The launch points called on, with their salvos and launch delays; the first is the primary delivery. */
  salvos: Salvo[]
  kill: Kill
  bearingDeg: number
  lines: string[]
}

const fmtKm = (m: number) => `${Math.round(m / 1000).toLocaleString('en-GB')} KM`
const fmtMin = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} H` : `${Math.round(s / 60)} MIN`)

export type DeliveryPreference = 'best' | 'missile' | 'aircraft'

/**
 * How far below the best an option may score and still be drawn. A planner
 * with fifteen systems that all reach a city does not run the same one
 * every time: the choice among near-equals falls out of alert states,
 * maintenance, the day's readiness and whatever else is going on, none of
 * which is knowable here. So among the options within this much of the
 * best, one is drawn on a seed made from the target's own name, which
 * keeps a shared link reproducing exactly what its sender saw.
 */
export const NEAR_ENOUGH = 0.9

/** A small deterministic hash, so the same target draws the same profile every time. */
export function seedOf(text: string, variant = 0): number {
  let h = 2166136261 ^ variant
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

export function planStrike(target: AtlasTarget, profile: Profile, override?: Power, wantFallout = true, prefer: DeliveryPreference = 'best', loading: Loading = 'deployed', site?: string, variant = 0, land?: LandUse | null): StrikePlan | { failure: string; lines: string[] } {
  const lines: string[] = []
  const classification = classify(target, profile, land)
  lines.push(`TARGET IDENTIFIED · ${classification.category} · ${classification.reason}`)
  lines.push(land && land.mappedKm2 > 0 ? `GROUND READ · ${describeLandUse(land)} · OPENSTREETMAP LAND USE` : 'GROUND NOT READ · OVERPASS DID NOT ANSWER IN TIME · THE TAG AND THE POPULATION GRID DECIDE')
  const heuristic = adversaryFor(target.countryCode, target.position)
  const adversary: Adversary = override && override !== heuristic.power ? { power: override, reason: `SET BY THE READER; THE RULE SAID ${POWERS[heuristic.power].name.toUpperCase()}`, basis: 'doctrine' } : heuristic
  lines.push(`ADVERSARY · ${POWERS[adversary.power].name.toUpperCase()} · ${adversary.reason}${adversary.basis === 'proximity' ? ' · A FALLBACK, NOT A DOCTRINE' : ''}`)
  const options = deliveryOptions(adversary.power, target.position, loading)
  if (loading === 'full') lines.push('FULL LOADING · EVERY MISSILE AT ITS CAPACITY, NOT THE DEPLOYED LOAD THE NOTEBOOK GIVES')
  const reachable = options.filter((o) => o.inRange)
  if (reachable.length === 0) {
    const nearest = options[0]
    return { failure: `NO ${POWERS[adversary.power].name.toUpperCase()} SYSTEM REACHES ${target.name.toUpperCase()}${nearest ? ` · NEAREST ${nearest.site.system.toUpperCase()} AT ${fmtKm(nearest.distanceMetres)} AGAINST A RANGE OF ${fmtKm(nearest.site.rangeKm * 1000)}` : ''}`, lines }
  }
  // Missiles before aircraft unless the reader asks for the air leg: a bomber's hours are otherwise the option of last resort.
  const missiles = reachable.filter((o) => o.route === 'ballistic')
  const aircraft = reachable.filter((o) => o.route === 'cruise')
  let pool = reachable
  if (prefer === 'aircraft' && aircraft.length > 0) {
    pool = aircraft
    lines.push(`AIR DELIVERY ASKED FOR · ${aircraft.length} STANDOFF OPTION${aircraft.length > 1 ? 'S' : ''} IN RANGE`)
  } else if (prefer === 'aircraft') {
    lines.push('AIR DELIVERY ASKED FOR · NONE IN RANGE · MISSILES CONSIDERED')
    pool = missiles.length > 0 ? missiles : reachable
  } else if (missiles.length > 0) {
    pool = missiles
    if (missiles.length < reachable.length) lines.push(`${reachable.length - missiles.length} AIRCRAFT AND CRUISE OPTION${reachable.length - missiles.length > 1 ? 'S' : ''} SET ASIDE WHILE A MISSILE REACHES`)
  }
  // Sized for effect: each option scored against the target, an area by the coverage its system's sites in range can put up together, a point by the damage expectancy one load achieves; then the shortest flight among the best.
  const area = classification.countervalue && classification.urbanRadiusMetres > 0
  const point = !classification.countervalue
  const scored = pool.map((o) => ({ o, score: scoreOf(classification, o, options, wantFallout) }))
  const best = Math.max(...scored.map((x) => x.score))
  for (const { o, score } of scored.slice(0, 5)) lines.push(`DELIVERY OPTION · ${o.site.system.toUpperCase()} · ${o.site.name.toUpperCase()} · ${fmtKm(o.distanceMetres)} · ${fmtMin(o.flightSeconds)}${o.route === 'cruise' && o.site.standoffKm ? ` · RELEASE ${fmtKm(Math.min(o.site.standoffKm * 1000, o.distanceMetres))} OUT` : ''} · ${o.site.warheadsPerMissile} × ${o.site.yieldKt} KT · CEP ${o.site.cepMetres} M${area ? ` · COVERS ${Math.round(score * 100)}% OF THE AREA WITH ${capacityOf(o.site.system, options)} MISSILES FROM ${options.filter((x) => x.inRange && x.site.system === o.site.system).length} SITE${options.filter((x) => x.inRange && x.site.system === o.site.system).length > 1 ? 'S' : ''}` : point ? ` · ONE LOAD GIVES ${Math.round(score * 100)}% DAMAGE EXPECTANCY` : ''}`)
  // Every option that comes near the best is a real choice a planner could
  // make; which one is taken is drawn on the target's own seed rather than
  // always falling to the same silo field.
  const shortlist = scored.filter((x) => x.score >= best * NEAR_ENOUGH - 1e-9).sort((a, b) => a.o.flightSeconds - b.o.flightSeconds)
  const named = site ? shortlist.find((x) => x.o.site.id === site) ?? scored.find((x) => x.o.site.id === site) : undefined
  const drawn = shortlist[Math.min(shortlist.length - 1, Math.floor(seedOf(`${target.osmType}${target.osmId}${target.name}`, variant) * shortlist.length))]
  const delivery = (named ?? drawn ?? shortlist[0]).o
  const why = area ? `COVERS ${Math.round(scored.find((x) => x.o === delivery)!.score * 100)}% OF THE AREA` : point ? `${Math.round(scored.find((x) => x.o === delivery)!.score * 100)}% DAMAGE EXPECTANCY` : 'IN RANGE'
  lines.push(`SELECTED · ${delivery.site.system.toUpperCase()} FROM ${delivery.site.name.toUpperCase()} · ${why} · ${fmtMin(delivery.flightSeconds)}${named ? ' · NAMED BY THE LINK' : shortlist.length > 1 ? ` · DRAWN FROM ${shortlist.length} OPTIONS WITHIN ${Math.round((1 - NEAR_ENOUGH) * 100)}% OF THE BEST, ON THIS TARGET'S OWN SEED` : ' · THE ONLY OPTION AT THIS SCORE'}`)
  const sizing = sizeWeapon(classification, delivery.site, target.position, wantFallout)
  lines.push(`WEAPON SIZED FOR EFFECT · ${sizing.reason}`)
  const salvos = planSalvos(delivery, options, sizing.missiles, delivery.site.warheadsPerMissile, sizing.warheads)
  const carried = salvos.reduce((a, x) => a + x.warheads, 0)
  if (carried < sizing.warheads) {
    lines.push(`ONLY ${carried} OF ${sizing.warheads} WARHEADS CAN BE PUT UP BY THE ${salvos.length} SITE${salvos.length > 1 ? 'S' : ''} IN RANGE · THE LAYDOWN IS CUT TO WHAT FLIES`)
    sizing.warheads = carried
    sizing.missiles = salvos.reduce((a, x) => a + x.missiles, 0)
    if (sizing.aimPoints.length > 1) sizing.aimPoints = sizing.aimPoints.slice(0, carried)
  }
  lines.push(`LAYDOWN · ${sizing.warheads} WARHEAD${sizing.warheads > 1 ? 'S' : ''} OF ${sizing.yieldKt} KT ON ${sizing.missiles} ${delivery.route === 'cruise' ? (sizing.missiles > 1 ? 'AIRCRAFT, A FLIGHT' : 'AIRCRAFT') : `MISSILE${sizing.missiles > 1 ? 'S' : ''}`} · ${sizing.aimPoints.length > 1 ? `AIM POINTS IN A SUNFLOWER SPACED SO THE 5 PSI DISCS MEET` : sizing.warheads > 1 ? 'ALL ON THE ONE AIM POINT' : 'ONE AIM POINT AT THE CENTRE'} · ${sizing.burst.toUpperCase()} BURST${sizing.burst === 'surface' && classification.countervalue ? ' SO THE FALLOUT IS DRAWN; DOCTRINE WOULD AIRBURST A CITY, WHICH THE READOUT CAN SHOW' : ''}`)
  if (salvos.length > 1) {
    const arrival = Math.max(...salvos.map((x) => x.option.flightSeconds))
    lines.push(`SALVOS · ${salvos.map((x) => `${x.option.site.name.split(' · ')[0].toUpperCase()} ${x.missiles} ${delivery.route === 'cruise' ? 'AIRCRAFT' : `MISSILE${x.missiles > 1 ? 'S' : ''}`} (${x.warheads})`).join(' · ')} · LAUNCHES HELD ${salvos.map((x) => `${x.launchDelaySeconds} S`).join(' / ')} SO EVERY WARHEAD ARRIVES AT H+${Math.round(arrival / 60)} MIN`)
  }
  const kill = killProbability(classification, delivery.site, sizing)
  lines.push(kill.line)
  const bearingDeg = initialBearing(delivery.site.position, target.position)
  const aims = describeAimPoints(sizing, target.position)
  for (const a of aims.slice(0, 6)) lines.push(`AIM POINT ${a.index + 1} · ${a.reason}`)
  if (aims.length > 6) lines.push(`AIM POINTS ${7} TO ${aims.length} · THE SAME RULE, FURTHER OUT`)
  const release = delivery.site.standoffKm !== undefined ? Math.min(delivery.site.standoffKm * 1_000, delivery.distanceMetres - Math.min(150_000, delivery.distanceMetres / 3)) : 0
  const approach = delivery.route === 'cruise' ? `${delivery.site.standoffKm && delivery.site.carrierSpeedMs ? `THE AIRCRAFT RELEASES ${Math.round(release / 1000).toLocaleString('en-GB')} KM OUT, AT THE EDGE OF THE ${delivery.site.system.split(' with ')[1]?.toUpperCase() ?? 'MISSILE'}'S ${delivery.site.standoffKm.toLocaleString('en-GB')} KM REACH, AND TURNS FOR HOME; THE MISSILES COME IN LOW` : delivery.site.standoffKm ? 'CRUISE MISSILES FROM THE LAUNCHER, LOW' : 'A GRAVITY BOMB: THE AIRCRAFT MUST REACH THE TARGET ITSELF'}` : sizing.missiles > 0 && delivery.site.warheadsPerMissile > 1 ? 'THE BUS SEPARATES AFTER TWELVE PER CENT OF THE FLIGHT AND EACH WARHEAD TAKES ITS OWN ARC TO ITS AIM POINT' : 'ONE WARHEAD PER MISSILE ON A MINIMUM-ENERGY ARC'
  lines.push(`APPROACH · FROM ${Math.round(((bearingDeg + 180) % 360)).toString().padStart(3, '0')}° · ${approach}`)
  if (delivery.route === 'cruise' && delivery.site.standoffNote) {
    lines.push(`STANDOFF · ${delivery.site.standoffKm?.toLocaleString('en-GB')} KM · ${delivery.site.standoffEvidence?.toUpperCase() ?? 'INFERRED'} · ${delivery.site.standoffNote.toUpperCase()}`)
  } else if (delivery.route === 'cruise') {
    lines.push('STANDOFF · NONE · THIS AIRCRAFT CARRIES A GRAVITY BOMB AND MUST REACH THE TARGET THROUGH WHATEVER DEFENDS IT')
  }
  if (delivery.route === 'cruise' && delivery.site.cruiseAltitudeMetres !== undefined) {
    const c = delivery.site
    lines.push(`PROFILE · CARRIER AT ${Math.round((c.cruiseAltitudeMetres ?? 0) / 1000)} KM${c.descendAtMetres ? `, TO THE DECK ${Math.round(c.descendAtMetres / 1000)} KM OUT` : ''} · ${c.standoffKm ? `WEAPON AT ${c.weaponAltitudeMetres !== undefined && c.weaponAltitudeMetres < 1_000 ? `${c.weaponAltitudeMetres} M, TERRAIN-FOLLOWING UNDER THE RADAR HORIZON: THE ARGUMENT MADE FOR THE CRUISE MISSILE IN THE 1980S IS THAT A DEFENCE BUILT AGAINST BOMBERS AT HEIGHT CANNOT SEE IT COMING` : `${Math.round((c.weaponAltitudeMetres ?? 0) / 1000)} KM, HIGH AND FAST INSTEAD`}` : 'THE BOMB FALLS FROM THE AIRCRAFT'}`)
  }
  if (delivery.boost) {
    const b = delivery.boost
    lines.push(`BOOST · ${b.label.toUpperCase()} · BURNOUT AT +${b.burnoutSeconds} S, ${Math.round(b.burnoutAltitudeMetres / 1000)} KM UP, ${Math.round(b.burnoutDownrangeMetres / 1000)} KM DOWNRANGE · THE SATELLITES SEE THE PLUME WITHIN A MINUTE · A BOOST-PHASE INTERCEPTOR HAS ${Math.max(0, b.burnoutSeconds - 60)} S TO CLOSE ON A BOOSTER OVER ${POWERS[adversary.power].name.toUpperCase()}; AFTER BURNOUT THERE IS ONLY THE BUS AND ITS ${sizing.warheads > 1 ? 'WARHEADS' : 'WARHEAD'}`)
    const w = boostWindow(b.burnoutSeconds)
    const chances = SPACE_LAYERS.map((l) => spaceChance(w, l))
    lines.push(`BOOST-PHASE DEFENCE · ${w.availableSeconds} S AFTER DETECTION AND DECISION · A SPACE INTERCEPTOR MUST ALREADY BE WITHIN ${Math.round(chances[0].reachMetres / 1000).toLocaleString('en-GB')} KM OF ${delivery.site.name.split(' · ')[0].toUpperCase()} · ${chances.map((c) => `${c.layer.name.toUpperCase()}: ${c.expected.toFixed(1)} EXPECTED, ${Math.round(c.chance * 100)}% CHANCE OF ONE`).join(' · ')} · AN AIRCRAFT WOULD HAVE TO LOITER WITHIN ${Math.round(airReachMetres(w) / 1000)} KM, OVER ${POWERS[adversary.power].name.toUpperCase()}`)
  }
  return { target, adversary, classification, options, delivery, sizing, salvos, kill, bearingDeg, lines }
}
