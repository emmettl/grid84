import { haversineMetres, initialBearing, type LngLat } from '../geo/geodesy.ts'
import { minimumEnergyTrajectory } from '../models/ballistic.ts'
import { radiusForPsi } from '../models/casualties.ts'
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

export function classify(target: AtlasTarget, profile: Profile): Classification {
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
  const role = (category: Category, countervalue: boolean, hard: boolean, reason: string): Classification => ({ category, urbanRadiusMetres: countervalue ? urban : 0, population, countervalue, hard, reason })
  if (key === 'military' || value === 'military' || value === 'barracks' || value === 'naval_base') return role('MILITARY', false, true, `OPENSTREETMAP TAGS IT ${key}=${value} · COUNTERFORCE · SURFACE BURST ON A HARD POINT`)
  if (key === 'aeroway' || value === 'aerodrome' || value === 'airport') return role('AIRFIELD', false, false, `OPENSTREETMAP TAGS IT ${key}=${value} · THE RUNWAYS ARE THE AIM POINT`)
  if (value === 'port' || value === 'harbour' || value === 'harbor' || key === 'harbour') return role('PORT', false, false, `OPENSTREETMAP TAGS IT ${key}=${value} · THE QUAYS AND THE TOWN BEHIND THEM`)
  if (key === 'power' || value === 'plant' || value === 'nuclear' || value === 'refinery' || value === 'dam') return role('INFRASTRUCTURE', false, true, `OPENSTREETMAP TAGS IT ${key}=${value} · A SURFACE BURST TO BE SURE OF THE STRUCTURE`)
  if (value === 'industrial' || key === 'industrial' || value === 'factory' || value === 'works') return role('INDUSTRY', false, false, `OPENSTREETMAP TAGS IT ${key}=${value} · INDUSTRIAL FLOOR SPACE`)
  if (value === 'government' || value === 'parliament' || value === 'palace' || value === 'ministry' || value === 'embassy') return role('COMMAND', false, false, `OPENSTREETMAP TAGS IT ${key}=${value} · LEADERSHIP`)
  if (urban >= 5_000 || within10 >= 300_000) return role('URBAN-INDUSTRIAL', true, false, `DENSITY ABOVE ${URBAN_DENSITY} PER KM² OUT TO ${Math.round(urban / 1000)} KM · ${Math.round(within10).toLocaleString('en-GB')} WITHIN 10 KM · COUNTERVALUE`)
  if (within10 >= 40_000) return role('TOWN', true, false, `${Math.round(within10).toLocaleString('en-GB')} WITHIN 10 KM · A TOWN, STRUCK AS AN AREA`)
  return role('RURAL', false, false, `${Math.round(within10).toLocaleString('en-GB')} WITHIN 10 KM · NO URBAN AREA · STRUCK AS A POINT`)
}

export interface DeliveryOption {
  site: ForceSite
  distanceMetres: number
  flightSeconds: number
  route: 'ballistic' | 'cruise'
  inRange: boolean
}

const CRUISE_SPEED_MS = 240

/** Time from launch to the target for an air-delivered weapon: the carrier to its release point, the missile the rest. */
export function cruiseFlightSeconds(site: ForceSite, distanceMetres: number): number {
  const standoff = (site.standoffKm ?? 0) * 1_000
  const leg = Math.max(0, distanceMetres - standoff)
  const carrier = site.carrierSpeedMs && site.carrierSpeedMs > 0 ? site.carrierSpeedMs : CRUISE_SPEED_MS
  return leg / carrier + (distanceMetres - leg) / (site.missileSpeedMs ?? CRUISE_SPEED_MS)
}

export function deliveryOptions(power: Power, position: LngLat): DeliveryOption[] {
  const out: DeliveryOption[] = []
  for (const site of FORCES) {
    if (site.side !== power) continue
    const distanceMetres = haversineMetres(site.position, position)
    const inRange = distanceMetres <= site.rangeKm * 1_000
    const route = site.kind === 'bomber' ? 'cruise' : 'ballistic'
    const flightSeconds = route === 'cruise' ? cruiseFlightSeconds(site, distanceMetres) : minimumEnergyTrajectory(site.position, position).flightSeconds
    out.push({ site, distanceMetres, flightSeconds, route, inRange })
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

/** How many weapons a target draws: enough 5 psi discs to tile the urban area, capped at two missiles' loads; hard points take one on the surface. */
export function sizeWeapon(cls: Classification, site: ForceSite, center: LngLat, wantFallout: boolean): Sizing {
  const yieldKt = site.yieldKt
  const burst: 'air' | 'surface' = cls.hard || wantFallout ? 'surface' : 'air'
  const r5 = radiusForPsi(yieldKt, 5, burst)
  const cap = loadCap(site)
  let warheads = 1
  let reason: string
  if (cls.countervalue && cls.urbanRadiusMetres > 0) {
    const needed = Math.ceil((cls.urbanRadiusMetres * cls.urbanRadiusMetres) / (r5 * r5))
    warheads = Math.max(1, Math.min(cap, needed))
    reason = `5 PSI RADIUS OF ${yieldKt >= 1000 ? `${(yieldKt / 1000).toFixed(1)} MT` : `${yieldKt} KT`} AT ${burst.toUpperCase()} BURST IS ${(r5 / 1000).toFixed(1)} KM · URBAN AREA ${Math.round(cls.urbanRadiusMetres / 1000)} KM · ${needed} DISC${needed > 1 ? 'S' : ''} TO TILE IT${needed > cap ? ` · CAPPED AT ${cap} BY ${site.warheadsPerMissile >= 6 ? "ONE MISSILE'S LOAD" : "TWO MISSILES' LOADS"}` : ''}`
  } else if (cls.countervalue) {
    reason = `A TOWN INSIDE ONE 5 PSI DISC OF ${(r5 / 1000).toFixed(1)} KM · ONE WEAPON`
  } else {
    reason = `A POINT TARGET · ONE WEAPON${cls.hard ? ' ON THE SURFACE' : ''}`
  }
  const missiles = Math.ceil(warheads / site.warheadsPerMissile)
  const aimPoints = laydown(center, warheads, yieldKt, burst === 'surface' ? radiusForPsi(yieldKt, 5, 'surface') * 1.6 : undefined)
  return { warheads, missiles, yieldKt, burst, r5, aimPoints, reason }
}

/** How many warheads one strike may draw from a system: a heavy missile's full load, or two loads of a lighter one, never more than twelve. */
export function loadCap(site: ForceSite): number {
  return site.warheadsPerMissile >= 6 ? site.warheadsPerMissile : Math.max(1, Math.min(12, site.warheadsPerMissile * 2))
}

/** The fraction of the urban area the cap of this system would put under 5 psi; one for a point target. */
export function coverageOf(cls: Classification, site: ForceSite, wantFallout: boolean): number {
  if (!cls.countervalue || cls.urbanRadiusMetres <= 0) return 1
  const burst: 'air' | 'surface' = cls.hard || wantFallout ? 'surface' : 'air'
  const r5 = radiusForPsi(site.yieldKt, 5, burst)
  const cap = loadCap(site)
  return Math.min(1, (cap * r5 * r5) / (cls.urbanRadiusMetres * cls.urbanRadiusMetres))
}

export interface StrikePlan {
  target: AtlasTarget
  adversary: Adversary
  classification: Classification
  options: DeliveryOption[]
  delivery: DeliveryOption
  sizing: Sizing
  bearingDeg: number
  lines: string[]
}

const fmtKm = (m: number) => `${Math.round(m / 1000).toLocaleString('en-GB')} KM`
const fmtMin = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} H` : `${Math.round(s / 60)} MIN`)

export type DeliveryPreference = 'best' | 'missile' | 'aircraft'

export function planStrike(target: AtlasTarget, profile: Profile, override?: Power, wantFallout = true, prefer: DeliveryPreference = 'best'): StrikePlan | { failure: string; lines: string[] } {
  const lines: string[] = []
  const classification = classify(target, profile)
  lines.push(`TARGET IDENTIFIED · ${classification.category} · ${classification.reason}`)
  const heuristic = adversaryFor(target.countryCode, target.position)
  const adversary: Adversary = override && override !== heuristic.power ? { power: override, reason: `SET BY THE READER; THE RULE SAID ${POWERS[heuristic.power].name.toUpperCase()}`, basis: 'doctrine' } : heuristic
  lines.push(`ADVERSARY · ${POWERS[adversary.power].name.toUpperCase()} · ${adversary.reason}${adversary.basis === 'proximity' ? ' · A FALLBACK, NOT A DOCTRINE' : ''}`)
  const options = deliveryOptions(adversary.power, target.position)
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
  // Sized for effect: each option's load against the area, then the shortest flight among those that cover it best.
  const scored = pool.map((o) => ({ o, coverage: coverageOf(classification, o.site, wantFallout) }))
  const bestCoverage = Math.max(...scored.map((x) => x.coverage))
  for (const { o, coverage } of scored.slice(0, 5)) lines.push(`DELIVERY OPTION · ${o.site.system.toUpperCase()} · ${o.site.name.toUpperCase()} · ${fmtKm(o.distanceMetres)} · ${fmtMin(o.flightSeconds)}${o.route === 'cruise' && o.site.standoffKm ? ` · RELEASE ${fmtKm(Math.min(o.distanceMetres, o.site.standoffKm * 1000))} OUT` : ''} · ${o.site.warheadsPerMissile} × ${o.site.yieldKt} KT${classification.countervalue && classification.urbanRadiusMetres > 0 ? ` · COVERS ${Math.round(coverage * 100)}% OF THE AREA` : ''}`)
  const delivery = scored.filter((x) => x.coverage >= bestCoverage - 1e-9).sort((a, b) => a.o.flightSeconds - b.o.flightSeconds)[0].o
  lines.push(`SELECTED · ${delivery.site.system.toUpperCase()} FROM ${delivery.site.name.toUpperCase()} · ${classification.countervalue && classification.urbanRadiusMetres > 0 ? `THE LOAD THAT COVERS MOST OF THE AREA (${Math.round(bestCoverage * 100)}%), THEN THE SHORTEST FLIGHT` : 'THE SHORTEST FLIGHT IN RANGE'} · ${fmtMin(delivery.flightSeconds)}`)
  const sizing = sizeWeapon(classification, delivery.site, target.position, wantFallout)
  lines.push(`WEAPON SIZED FOR EFFECT · ${sizing.reason}`)
  lines.push(`LAYDOWN · ${sizing.warheads} WARHEAD${sizing.warheads > 1 ? 'S' : ''} OF ${sizing.yieldKt} KT ON ${sizing.missiles} MISSILE${sizing.missiles > 1 ? 'S' : ''} · ${sizing.warheads > 1 ? `AIM POINTS IN A SUNFLOWER SPACED SO THE 5 PSI DISCS MEET` : 'ONE AIM POINT AT THE CENTRE'} · ${sizing.burst.toUpperCase()} BURST${sizing.burst === 'surface' && classification.countervalue ? ' SO THE FALLOUT IS DRAWN; DOCTRINE WOULD AIRBURST A CITY, WHICH THE READOUT CAN SHOW' : ''}`)
  const bearingDeg = initialBearing(delivery.site.position, target.position)
  return { target, adversary, classification, options, delivery, sizing, bearingDeg, lines }
}
