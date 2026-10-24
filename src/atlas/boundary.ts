import type { LngLat } from '../geo/geodesy.ts'
import type { AtlasTarget } from './target.ts'

/**
 * The target's boundary from OpenStreetMap: Nominatim's lookup of the
 * feature Photon named, with its polygon. Relations and ways carry one;
 * a node does not, and then the geocoder's extent stands in as a box.
 * One request per acquisition, cached; Nominatim's usage policy asks for
 * a referer, which the browser sends.
 */
export interface Boundary {
  rings: LngLat[][]
  kind: 'polygon' | 'extent'
  source: string
}

export const NOMINATIM_LOOKUP = 'https://nominatim.openstreetmap.org/lookup'

const cache = new Map<string, Boundary | null>()

/** Outer rings of a GeoJSON Polygon or MultiPolygon, as [lon, lat] pairs; other geometries give none. */
export function ringsOf(geometry: unknown): LngLat[][] {
  const g = geometry as { type?: string; coordinates?: unknown } | null
  if (!g || !g.coordinates) return []
  const ring = (r: unknown): LngLat[] => (Array.isArray(r) ? r.filter((p): p is number[] => Array.isArray(p) && p.length >= 2).map((p) => [p[0], p[1]] as LngLat) : [])
  if (g.type === 'Polygon') return [ring((g.coordinates as unknown[])[0])].filter((r) => r.length >= 4)
  if (g.type === 'MultiPolygon') return (g.coordinates as unknown[][]).map((poly) => ring(poly[0])).filter((r) => r.length >= 4)
  return []
}

export function extentRing(extent: readonly [number, number, number, number]): LngLat[] {
  const [west, north, east, south] = extent
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ]
}

export async function fetchBoundary(target: AtlasTarget, signal?: AbortSignal): Promise<Boundary | null> {
  if (signal?.aborted) return null
  if (cache.has(target.id)) return cache.get(target.id) ?? null
  const boundary = await (async (): Promise<Boundary | null> => {
    const letter = target.osmType.charAt(0).toUpperCase()
    if (['N', 'W', 'R'].includes(letter) && letter !== 'N') {
      try {
        const q = new URLSearchParams({ osm_ids: `${letter}${target.osmId}`, polygon_geojson: '1', format: 'jsonv2' })
        const r = await fetch(`${NOMINATIM_LOOKUP}?${q}`, { signal, headers: { Accept: 'application/json' } })
        if (r.ok) {
          const rows = (await r.json()) as Array<{ geojson?: unknown }>
          const rings = ringsOf(rows[0]?.geojson)
          if (rings.length > 0) return { rings, kind: 'polygon', source: 'OpenStreetMap via Nominatim, the feature the geocoder named' }
        }
      } catch {
        // fall through to the extent
      }
    }
    if (signal?.aborted) return null
    if (target.extent) return { rings: [extentRing(target.extent)], kind: 'extent', source: 'The geocoder\'s bounding box; the feature has no polygon or it could not be fetched' }
    return null
  })()
  // An aborted acquisition must not leave a cached fallback for a later visit.
  if (!signal?.aborted) cache.set(target.id, boundary)
  return boundary
}

/** Own one acquisition at a time, including when a fetch ignores cancellation. */
export function createBoundaryLoader(fetcher = fetchBoundary) {
  let current: AbortController | null = null
  const cancel = () => {
    current?.abort()
    current = null
  }
  return {
    cancel,
    async load(target: AtlasTarget, apply: (boundary: Boundary | null) => void): Promise<void> {
      cancel()
      const request = new AbortController()
      current = request
      const boundary = await fetcher(target, request.signal)
      if (current === request && !request.signal.aborted) apply(boundary)
    },
  }
}
