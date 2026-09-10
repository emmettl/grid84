import type { LngLat } from '../geo/geodesy.ts'

/**
 * What the ground under a target actually is.
 *
 * Until now the console identified a target from the geocoder's own tag and
 * then from population density: OpenStreetMap says this node is
 * `military=airfield`, or it says nothing and the grid says four thousand
 * people a square kilometre. Both are thin. A tag describes the point that
 * was geocoded, not the square kilometre around it, and density cannot tell
 * a refinery from a housing estate.
 *
 * OpenStreetMap also holds what the land is used for, polygon by polygon,
 * and that is the thing a targeteer actually wants: how much of this ground
 * is industrial, how much is housing, whether there is an aerodrome or a
 * barracks on it. So the console asks Overpass for the land-use polygons
 * within a couple of kilometres and measures their areas.
 *
 * It is a live service and it is slow and it fails, so nothing depends on
 * it: when it does not answer in time the classifier falls back to the tag
 * and the density, and the readout says which of the two it used.
 *
 * The HYDE land-use grids the studies carry cannot do this. They are
 * agricultural: cropland, grazing, pasture, rangeland and rice, with no
 * built-up class at all, which is fine for a harvest and useless for a
 * target.
 */

export const OVERPASS = 'https://overpass-api.de/api/interpreter'

export type LandClass = 'residential' | 'industrial' | 'commercial' | 'military' | 'transport' | 'farmland' | 'green' | 'water' | 'other'

/** Which OpenStreetMap land-use value belongs to which class. */
const CLASSES: Record<string, LandClass> = {
  residential: 'residential',
  industrial: 'industrial',
  port: 'industrial',
  quarry: 'industrial',
  landfill: 'industrial',
  commercial: 'commercial',
  retail: 'commercial',
  institutional: 'commercial',
  education: 'commercial',
  military: 'military',
  railway: 'transport',
  farmland: 'farmland',
  farmyard: 'farmland',
  orchard: 'farmland',
  vineyard: 'farmland',
  allotments: 'farmland',
  meadow: 'green',
  grass: 'green',
  forest: 'green',
  recreation_ground: 'green',
  village_green: 'green',
  cemetery: 'green',
  basin: 'water',
  reservoir: 'water',
}

export interface LandUse {
  radiusMetres: number
  /**
   * Area of the land-use polygons that touch the circle, square kilometres.
   * Overpass returns whole polygons, so this can exceed the circle's own
   * area and is not a fraction of it; what matters is the mix, not the size.
   */
  mappedKm2: number
  /** Share of the mapped area by class. */
  shares: Record<LandClass, number>
  /** Areas worth naming outright, square kilometres. */
  aerodromeKm2: number
  militaryKm2: number
  industrialKm2: number
  /** The largest named thing on the ground, for the readout to quote. */
  largest: { name: string; klass: LandClass; km2: number } | null
  source: string
}

interface OverpassElement {
  type: string
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
  members?: Array<{ type: string; role: string; geometry?: Array<{ lat: number; lon: number }> }>
}

/**
 * Area of a ring in square kilometres, by the shoelace formula on a local
 * equirectangular projection. Over a couple of kilometres the distortion is
 * far below the accuracy of the polygons themselves.
 */
export function ringAreaKm2(ring: Array<{ lat: number; lon: number }>, atLat: number): number {
  if (ring.length < 3) return 0
  const k = Math.cos((atLat * Math.PI) / 180)
  const mx = 111.32 * k
  const my = 110.574
  let sum = 0
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    sum += a.lon * mx * (b.lat * my) - b.lon * mx * (a.lat * my)
  }
  return Math.abs(sum) / 2
}

const EMPTY_SHARES: Record<LandClass, number> = { residential: 0, industrial: 0, commercial: 0, military: 0, transport: 0, farmland: 0, green: 0, water: 0, other: 0 }

/** Read an Overpass answer into areas by class. Exported so the test can feed it a fixture. */
export function readLandUse(elements: OverpassElement[], centre: LngLat, radiusMetres: number): LandUse {
  const areas: Record<LandClass, number> = { ...EMPTY_SHARES }
  let aerodromeKm2 = 0
  let militaryKm2 = 0
  let largest: LandUse['largest'] = null
  for (const el of elements) {
    const tags = el.tags ?? {}
    const rings: Array<Array<{ lat: number; lon: number }>> = []
    if (el.geometry) rings.push(el.geometry)
    for (const m of el.members ?? []) if (m.role === 'outer' && m.geometry) rings.push(m.geometry)
    const km2 = rings.reduce((a, r) => a + ringAreaKm2(r, centre[1]), 0)
    if (km2 <= 0) continue
    const aerodrome = tags.aeroway === 'aerodrome'
    const military = tags.landuse === 'military' || tags.military !== undefined
    const klass: LandClass = military ? 'military' : aerodrome ? 'transport' : (CLASSES[tags.landuse ?? ''] ?? 'other')
    areas[klass] += km2
    if (aerodrome) aerodromeKm2 += km2
    if (military) militaryKm2 += km2
    const name = tags.name ?? ''
    if (name && (!largest || km2 > largest.km2)) largest = { name, klass, km2 }
  }
  const mappedKm2 = Object.values(areas).reduce((a, b) => a + b, 0)
  const shares = { ...EMPTY_SHARES }
  for (const k of Object.keys(areas) as LandClass[]) shares[k] = mappedKm2 > 0 ? areas[k] / mappedKm2 : 0
  return {
    radiusMetres,
    mappedKm2,
    shares,
    aerodromeKm2,
    militaryKm2,
    industrialKm2: areas.industrial,
    largest,
    source: 'OpenStreetMap land use via Overpass',
  }
}

const cache = new Map<string, LandUse | null>()

/**
 * Ask Overpass what the ground is. One request per target, cached, with a
 * short timeout: nothing waits on it and nothing breaks without it.
 */
export async function fetchLandUse(centre: LngLat, radiusMetres = 2_500, signal?: AbortSignal, timeoutMs = 9_000): Promise<LandUse | null> {
  const key = `${centre[0].toFixed(3)},${centre[1].toFixed(3)},${radiusMetres}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const around = `(around:${Math.round(radiusMetres)},${centre[1].toFixed(5)},${centre[0].toFixed(5)})`
  const query = `[out:json][timeout:20];(way["landuse"]${around};relation["landuse"]${around};way["aeroway"="aerodrome"]${around};relation["aeroway"="aerodrome"]${around};way["military"]${around};relation["military"]${around};);out geom;`
  const timer = new AbortController()
  const stop = setTimeout(() => timer.abort(), timeoutMs)
  signal?.addEventListener('abort', () => timer.abort())
  try {
    const r = await fetch(OVERPASS, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: timer.signal })
    if (!r.ok) throw new Error(String(r.status))
    const body = (await r.json()) as { elements?: OverpassElement[] }
    const out = readLandUse(body.elements ?? [], centre, radiusMetres)
    cache.set(key, out)
    return out
  } catch {
    // Overpass is busy, or slow, or the network is not there. The classifier has a fallback and says it is using it.
    cache.set(key, null)
    return null
  } finally {
    clearTimeout(stop)
  }
}

/** A one-line description of the ground, for the console. */
export function describeLandUse(l: LandUse): string {
  const parts = (Object.entries(l.shares) as Array<[LandClass, number]>)
    .filter(([, v]) => v >= 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k.toUpperCase()} ${Math.round(v * 100)}%`)
  return `${parts.join(' · ')} · ${l.mappedKm2.toFixed(1)} KM² OF MAPPED GROUND AROUND A ${(l.radiusMetres / 1000).toFixed(1)} KM CIRCLE${l.largest ? ` · LARGEST: ${l.largest.name.toUpperCase()}` : ''}`
}
