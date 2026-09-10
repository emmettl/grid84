import type { AtlasTarget } from './target.ts'
import { NOMINATIM_LOOKUP } from './boundary.ts'

/**
 * A target from its OpenStreetMap id, for a shared strike link: Nominatim's
 * lookup, one request, mapped to the same shape Photon gives. The id is
 * the geocoder's `N123` / `W123` / `R123`.
 */
export function parseOsmRef(ref: string): { letter: 'N' | 'W' | 'R'; id: number } | null {
  const m = /^([NWR])(\d{1,12})$/i.exec(ref.trim())
  if (!m) return null
  return { letter: m[1].toUpperCase() as 'N' | 'W' | 'R', id: Number(m[2]) }
}

export function osmRefOf(target: AtlasTarget): string | null {
  const letter = target.osmType.charAt(0).toUpperCase()
  if (!['N', 'W', 'R'].includes(letter) || !target.osmId) return null
  return `${letter}${target.osmId}`
}

interface NominatimRow {
  osm_type?: string
  osm_id?: number
  lat?: string
  lon?: string
  category?: string
  type?: string
  name?: string
  display_name?: string
  boundingbox?: string[]
  address?: Record<string, string>
}

export function targetFromNominatim(row: NominatimRow): AtlasTarget | null {
  const lon = Number(row.lon)
  const lat = Number(row.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !row.osm_id) return null
  const letter = (row.osm_type ?? 'node').charAt(0).toUpperCase()
  const a = row.address ?? {}
  const name = row.name || row.display_name?.split(',')[0] || 'UNNAMED TARGET'
  const city = a.city ?? a.town ?? a.village
  const label = [city && city !== name ? city : undefined, a.state && a.state !== name && a.state !== city ? a.state : undefined, a.country && a.country !== name ? a.country : undefined].filter(Boolean).join(', ')
  const bb = row.boundingbox?.map(Number)
  const extent = bb && bb.length === 4 && bb.every((v) => Number.isFinite(v)) ? ([bb[2], bb[1], bb[3], bb[0]] as const) : undefined
  // Nominatim's category for an administrative area is 'boundary'; the atlas reads it as the place it is.
  const osmKey = row.category === 'boundary' ? 'place' : (row.category ?? 'unknown')
  const osmValue = row.category === 'boundary' ? 'city' : (row.type ?? 'unknown')
  return { id: `${letter}:${row.osm_id}`, osmId: row.osm_id, osmType: letter, osmKey, osmValue, name, label, countryCode: (a.country_code ?? 'xx').toUpperCase(), postcode: a.postcode, position: [lon, lat], extent }
}

export async function lookupTarget(ref: string, signal?: AbortSignal): Promise<AtlasTarget | null> {
  const parsed = parseOsmRef(ref)
  if (!parsed) return null
  const q = new URLSearchParams({ osm_ids: `${parsed.letter}${parsed.id}`, format: 'jsonv2', addressdetails: '1' })
  const r = await fetch(`${NOMINATIM_LOOKUP}?${q}`, { signal, headers: { Accept: 'application/json' } })
  if (!r.ok) return null
  const rows = (await r.json()) as NominatimRow[]
  return rows[0] ? targetFromNominatim(rows[0]) : null
}

/** The shareable hash for a strike: the target's OSM id and the console's choices. */
export function strikeHash(target: AtlasTarget, choices: { adversary?: string | null; delivery?: string | null; loading?: string | null }): string | null {
  const ref = osmRefOf(target)
  if (!ref) return null
  const q = new URLSearchParams()
  if (choices.adversary) q.set('adversary', choices.adversary)
  if (choices.delivery && choices.delivery !== 'best') q.set('delivery', choices.delivery)
  if (choices.loading && choices.loading !== 'deployed') q.set('loading', choices.loading)
  const query = q.toString()
  return `#/atlas/strike/${ref}${query ? `?${query}` : ''}`
}

export function parseStrikeHash(hash: string): { ref: string; adversary: string | null; delivery: string | null; loading: string | null } | null {
  const m = /^#\/atlas\/strike\/([NWRnwr]\d+)(?:\?(.*))?$/.exec(hash)
  if (!m) return null
  const q = new URLSearchParams(m[2] ?? '')
  return { ref: m[1].toUpperCase(), adversary: q.get('adversary'), delivery: q.get('delivery'), loading: q.get('loading') }
}
