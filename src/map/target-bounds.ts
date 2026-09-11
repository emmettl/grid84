import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { LngLat } from '../geo/geodesy.ts'
import { ALARM_HATCH, ensureAlarmHatch } from './hatch.ts'

/**
 * The bounds of the target: hatched in the warning livery, black and orange,
 * so that the outline is never mistaken for another neutral line on a map
 * already full of them. It is the one mark on this engine that is not drawn in
 * the evidence grammar, because it is not evidence — it is the answer to
 * "which thing is being aimed at", and it should read as a stencil laid over
 * the world rather than as something found in it.
 *
 * The atlas draws it around the feature the geocoder named, from
 * OpenStreetMap's own polygon. The terminal phase draws it around the target's
 * class extent, because its targets come from lists of coordinates and have no
 * polygon to fetch. Both want the same grammar, so both come here.
 */

export const TARGET_BOUNDS_SOURCE = 'atlas-boundary'

export function installTargetBounds(map: MapLibreMap): void {
  if (map.getSource(TARGET_BOUNDS_SOURCE)) return
  ensureAlarmHatch(map)
  map.addSource(TARGET_BOUNDS_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'atlas-boundary-fill', type: 'fill', source: TARGET_BOUNDS_SOURCE, paint: { 'fill-pattern': ALARM_HATCH, 'fill-opacity': 0.28 } })
  map.addLayer({ id: 'atlas-boundary-line', type: 'line', source: TARGET_BOUNDS_SOURCE, paint: { 'line-color': '#ff8a1f', 'line-width': 2, 'line-opacity': 0.95 } })
  // The dark dashes ride over the orange, so the edge reads as hazard tape at
  // any zoom and against any basemap.
  map.addLayer({ id: 'atlas-boundary-line-dark', type: 'line', source: TARGET_BOUNDS_SOURCE, paint: { 'line-color': '#0a0602', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.9 } })
}

/** Replace the drawn bounds. An empty list clears them. */
export function setTargetBounds(map: MapLibreMap, rings: LngLat[][], kind = 'polygon'): void {
  const source = map.getSource(TARGET_BOUNDS_SOURCE) as GeoJSONSource | undefined
  source?.setData({
    type: 'FeatureCollection',
    features: rings.map((ring) => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [ring.map((p) => [p[0], p[1]])] },
      properties: { kind },
    })),
  })
}
