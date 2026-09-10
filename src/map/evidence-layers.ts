import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { TIER_ORDER, type EvidenceTier } from '../evidence/evidence.ts'
import { EFFECT_RING, FALLOUT_FILL, FALLOUT_LINE, HUE, INFERRED_RING, LINE, MODELLED_FILL, POINT } from '../evidence/grammar.ts'
import { ensureReachHatch, REACH_HATCH } from './hatch.ts'
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
    // A plume's contours fade outward with their H+1 dose rate, so the far tail
    // reads as the faint thing it is; the blast rings keep the full tint, which
    // is stronger than it was because at the old value they barely showed. The
    // plume stops are scaled by the same factor the tint went up by, so the
    // plumes look exactly as they did.
    paint: {
      // The plume is a different kind of thing from a blast ring — the days
      // after rather than the moment — and until it had a hue of its own the
      // two were the same red at different opacities and could not be told
      // apart at a glance. A contour carries a dose; a ring does not.
      'fill-color': ['case', ['has', 'dose'], FALLOUT_FILL, MODELLED_FILL],
      'fill-opacity': ['case', ['has', 'dose'], ['interpolate', ['linear'], ['log10', ['max', 0.1, ['get', 'dose']]], -1, 0.143, 0, 0.2, 1, 0.343, 2, 0.486, 3, 0.571], 1],
    },
  })
  // The contours want an edge only in the sense that a step in the wash should
  // be findable — a drawn line makes the plume look like a chart of itself and
  // loses the soft shape a spreading thing should have. So it is a blurred
  // glow at the boundary rather than a stroke, and there is one of them: the
  // areas source carries the contours on both the compact and the full path,
  // and edging the rings source as well drew every one of them twice.
  map.addLayer({
    id: 'ev-areas-plume-edge',
    type: 'line',
    source: SOURCES.areas,
    filter: ['has', 'dose'],
    paint: { 'line-color': FALLOUT_LINE, 'line-width': 1.4, 'line-blur': 2.5, 'line-opacity': 0.2 },
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
  // A reach: the ground something must already be over. Hatched, faintly, so it
  // reads as an area of ground rather than as an effect.
  map.addSource('ev-reach', { type: 'geojson', data: empty() })
  ensureReachHatch(map)
  map.addLayer({ id: 'ev-reach-fill', type: 'fill', source: 'ev-reach', paint: { 'fill-pattern': REACH_HATCH, 'fill-opacity': 0.5 } })
  // Rings: uncertainty rings (inferred) and effect rings (modelled) as outlines.
  map.addLayer({
    id: 'ev-rings-inferred',
    type: 'line',
    source: SOURCES.rings,
    filter: ['all', ['==', ['get', 'evidence'], 'inferred'], ['!', ['has', 'dose']]],
    paint: { 'line-color': INFERRED_RING, 'line-width': 1, 'line-dasharray': [1, 2] },
  })
  // The effect rings are what the reader is looking at, so they get a line of
  // their own rather than borrowing the modelled-track grammar: a soft glow
  // underneath to lift them off a lit basemap, and the ring itself over it.
  map.addLayer({
    id: 'ev-rings-aggregate',
    type: 'line',
    source: SOURCES.rings,
    filter: ['==', ['get', 'aggregate'], true],
    paint: { 'line-color': EFFECT_RING.color, 'line-width': 1.1, 'line-opacity': 0.75 },
  })
  map.addLayer({
    id: 'ev-rings-modelled-glow',
    type: 'line',
    source: SOURCES.rings,
    filter: ['all', ['==', ['get', 'evidence'], 'modelled'], ['!', ['has', 'dose']], ['!', ['has', 'aggregate']]],
    paint: { 'line-color': EFFECT_RING.glow, 'line-width': EFFECT_RING.width * 3, 'line-blur': 3 },
  })
  map.addLayer({
    id: 'ev-rings-modelled',
    type: 'line',
    source: SOURCES.rings,
    filter: ['all', ['==', ['get', 'evidence'], 'modelled'], ['!', ['has', 'dose']], ['!', ['has', 'aggregate']]],
    paint: { 'line-color': EFFECT_RING.color, 'line-width': EFFECT_RING.width },
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
