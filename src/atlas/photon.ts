import type { AtlasTarget } from './target.ts'

/** Photon is komoot's open OpenStreetMap geocoder. Public instance, no key, fair-use rate limits. */
export const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/'

interface PhotonProperties {
  osm_id?: unknown
  osm_type?: unknown
  osm_key?: unknown
  osm_value?: unknown
  name?: unknown
  street?: unknown
  housenumber?: unknown
  postcode?: unknown
  city?: unknown
  state?: unknown
  country?: unknown
  countrycode?: unknown
  extent?: unknown
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

export function parsePhotonResponse(json: unknown): AtlasTarget[] {
  if (!json || typeof json !== 'object') return []
  const features = (json as { features?: unknown }).features
  if (!Array.isArray(features)) return []
  const targets: AtlasTarget[] = []
  for (const feature of features) {
    const target = parseFeature(feature)
    if (target) targets.push(target)
  }
  return targets
}

function parseFeature(feature: unknown): AtlasTarget | null {
  if (!feature || typeof feature !== 'object') return null
  const { geometry, properties } = feature as {
    geometry?: { coordinates?: unknown }
    properties?: PhotonProperties
  }
  const coordinates = geometry?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  const [longitude, latitude] = coordinates
  if (!isFiniteNumber(longitude) || !isFiniteNumber(latitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null

  const p = properties ?? {}
  const rawId = typeof p.osm_id === 'number' ? p.osm_id : Number(p.osm_id)
  const osmId = Number.isFinite(rawId) ? rawId : 0
  const osmType = text(p.osm_type) ?? '?'

  const street = text(p.street)
  const houseNumber = text(p.housenumber)
  const address = street ? [street, houseNumber].filter(Boolean).join(' ') : undefined
  const city = text(p.city)
  const state = text(p.state)
  const country = text(p.country)
  const name = text(p.name) ?? address ?? city ?? country ?? 'UNNAMED TARGET'

  const settlement = [text(p.postcode), city !== name ? city : undefined].filter(Boolean).join(' ')
  const label = [
    address !== name ? address : undefined,
    settlement || undefined,
    state !== city && state !== name ? state : undefined,
    country !== name ? country : undefined,
  ]
    .filter(Boolean)
    .join(', ')

  const extent =
    Array.isArray(p.extent) && p.extent.length === 4 && p.extent.every(isFiniteNumber)
      ? ([p.extent[0], p.extent[1], p.extent[2], p.extent[3]] as const)
      : undefined

  return {
    id: `${osmType}:${osmId || `${longitude},${latitude}`}`,
    osmId,
    osmType,
    osmKey: text(p.osm_key) ?? 'unknown',
    osmValue: text(p.osm_value) ?? 'unknown',
    name,
    label,
    countryCode: (text(p.countrycode) ?? 'XX').toUpperCase(),
    postcode: text(p.postcode),
    position: [longitude, latitude],
    extent,
  }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export interface SearchOptions {
  signal?: AbortSignal
  endpoint?: string
  limit?: number
  /** Injectable for tests. */
  fetch?: typeof fetch
}

export async function searchPhoton(query: string, options: SearchOptions = {}): Promise<AtlasTarget[]> {
  const q = query.trim()
  if (!q) return []
  const url = new URL(options.endpoint ?? PHOTON_ENDPOINT)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(options.limit ?? 6))
  url.searchParams.set('lang', 'en')
  const doFetch = options.fetch ?? fetch
  const response = await doFetch(url, { signal: options.signal })
  if (!response.ok) throw new Error(`Geocoder responded ${response.status}`)
  return parsePhotonResponse(await response.json())
}
