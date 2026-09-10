import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { TIER_ORDER, type EvidenceTier } from '../evidence/evidence.ts'
import { HUE, INFERRED_RING, LINE, MODELLED_FILL, POINT } from '../evidence/grammar.ts'
import { planeImage } from './plane-icon.ts'

/**
 * Sources and layers that draw evidenced geometry in the tier grammar.
 * Features carry an `evidence` property; each tier gets its own layer so
 * the dash patterns stay static, which MapLibre requires.
 */
export const SOURCES = {
  paths: 'ev-paths',
  sites: 'ev-sites',
  rings: 'ev-rings',
  areas: 'ev-areas',
  vehicles: 'ev-vehicles',
  flashes: 'ev-flashes',
} as const

export type EvidenceFeature = Feature<Geometry, { evidence: EvidenceTier; id: string; [key: string]: unknown }>

const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] })

export function installEvidenceLayers(map: MapLibreMap): void {
  for (const id of Object.values(SOURCES)) map.addSource(id, { type: 'geojson', data: empty() })

  // Modelled areas: faint fill under everything else.
  map.addLayer({
    id: 'ev-areas-fill',
    type: 'fill',
    source: SOURCES.areas,
    // A plume's contours fade outward with their H+1 dose rate, so the far tail reads as the faint thing it is; other areas keep the full tint.
    paint: { 'fill-color': MODELLED_FILL, 'fill-opacity': ['case', ['has', 'dose'], ['interpolate', ['linear'], ['log10', ['max', 0.1, ['get', 'dose']]], -1, 0.25, 0, 0.35, 1, 0.6, 2, 0.85, 3, 1], 1] },
  })
  for (const tier of TIER_ORDER) {
    const g = LINE[tier]
    map.addLayer({
      id: `ev-paths-${tier}`,
      type: 'line',
      source: SOURCES.paths,
      filter: ['==', ['get', 'evidence'], tier],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': g.color,
        'line-width': g.width,
        'line-opacity': g.opacity,
        'line-blur': g.blur,
        ...(g.dasharray ? { 'line-dasharray': g.dasharray } : {}),
      },
    })
  }
  // Rings: uncertainty rings (inferred) and effect rings (modelled) as outlines.
  map.addLayer({
    id: 'ev-rings-inferred',
    type: 'line',
    source: SOURCES.rings,
    filter: ['==', ['get', 'evidence'], 'inferred'],
    paint: { 'line-color': INFERRED_RING, 'line-width': 1, 'line-dasharray': [1, 2] },
  })
  map.addLayer({
    id: 'ev-rings-modelled',
    type: 'line',
    source: SOURCES.rings,
    filter: ['==', ['get', 'evidence'], 'modelled'],
    paint: { 'line-color': LINE.modelled.color, 'line-width': LINE.modelled.width },
  })
  map.addLayer({
    id: 'ev-rings-withheld',
    type: 'line',
    source: SOURCES.rings,
    filter: ['==', ['get', 'evidence'], 'withheld'],
    paint: { 'line-color': POINT.withheld.strokeColor, 'line-width': 1, 'line-dasharray': [2, 1] },
  })
  for (const tier of TIER_ORDER) {
    const g = POINT[tier]
    map.addLayer({
      id: `ev-sites-${tier}`,
      type: 'circle',
      source: SOURCES.sites,
      filter: ['==', ['get', 'evidence'], tier],
      paint: {
        'circle-radius': g.radius,
        'circle-color': g.color,
        'circle-stroke-color': g.strokeColor,
        'circle-stroke-width': g.strokeWidth,
        'circle-opacity': g.opacity,
        'circle-stroke-opacity': g.opacity,
      },
    })
  }
  map.addLayer({
    id: 'ev-vehicles',
    type: 'circle',
    source: SOURCES.vehicles,
    filter: ['!=', ['get', 'vehicle'], 'aircraft'],
    paint: {
      'circle-radius': 4,
      'circle-color': '#050410',
      'circle-stroke-color': ['case', ['==', ['get', 'side'], 'defender'], 'rgba(255, 96, 96, 0.95)', ['match', ['get', 'evidence'], 'documented', LINE.documented.color, 'inferred', LINE.inferred.color, 'modelled', LINE.modelled.color, LINE.reconstructed.color]],
      'circle-stroke-width': 2,
    },
  })
  // Detonation marks for compact effects: radius grows with the 5 psi ring and the mark fades with age.
  map.addLayer({
    id: 'ev-flashes-glow',
    type: 'circle',
    source: SOURCES.flashes,
    paint: {
      'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 2, 6, 6, 14, 10, 40],
      'circle-color': 'rgba(255, 96, 96, 0.18)',
      'circle-blur': 1,
    },
  })
  map.addLayer({
    id: 'ev-flashes',
    type: 'circle',
    source: SOURCES.flashes,
    paint: {
      'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 2, 2.5, 6, 6, 10, 18],
      'circle-color': ['interpolate', ['linear'], ['get', 'age'], 0, '#ffffff', 60, 'rgba(255, 96, 96, 0.95)', 3600, 'rgba(255, 96, 96, 0.55)'],
      'circle-stroke-color': ['case', ['==', ['get', 'side'], 'defender'], 'rgba(255, 179, 71, 0.95)', 'rgba(255, 96, 96, 0.9)'],
      'circle-stroke-width': 1,
    },
  })
  map.addLayer({
    id: 'ev-vehicles-glow',
    type: 'circle',
    source: SOURCES.vehicles,
    paint: { 'circle-radius': 10, 'circle-color': 'rgba(141, 250, 255, 0.12)', 'circle-blur': 1 },
  })
  // Aircraft: a silhouette per tier colour, turned to the track's heading.
  const ink = `rgb(${HUE.ink[0]}, ${HUE.ink[1]}, ${HUE.ink[2]})`
  const fills: Array<[string, string]> = [...TIER_ORDER.map((t): [string, string] => [t, LINE[t].color]), ['defender', 'rgba(255, 96, 96, 0.95)']]
  for (const [name, fill] of fills) {
    const image = planeImage(44, fill, ink)
    if (image && !map.hasImage(`plane-${name}`)) map.addImage(`plane-${name}`, image, { pixelRatio: 2 })
  }
  map.addLayer({
    id: 'ev-vehicles-air',
    type: 'symbol',
    source: SOURCES.vehicles,
    filter: ['==', ['get', 'vehicle'], 'aircraft'],
    layout: {
      'icon-image': ['case', ['==', ['get', 'side'], 'defender'], 'plane-defender', ['concat', 'plane-', ['get', 'evidence']]],
      'icon-rotate': ['coalesce', ['get', 'heading'], 0],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  })
}

export function setSourceData(map: MapLibreMap, id: string, features: EvidenceFeature[]): void {
  const source = map.getSource(id) as GeoJSONSource | undefined
  source?.setData({ type: 'FeatureCollection', features })
}
