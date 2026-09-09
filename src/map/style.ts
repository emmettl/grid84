import type { StyleSpecification } from 'maplibre-gl'

/**
 * The Grid/84 style. Factual substrate from OpenStreetMap via OpenFreeMap's
 * OpenMapTiles vector tiles; terrain from the AWS Terrain Tiles (Mapzen
 * Terrarium encoding). No label layers: ordinary map labels are beneath it.
 */
export const ATLAS_TILES_URL = 'https://tiles.openfreemap.org/planet'
export const TERRAIN_TILES_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

export const PALETTE = {
  ink: '#050410',
  cyan: '#8dfaff',
  amber: '#ffb347',
  green: '#7dff9a',
  land: '#0c1a2a',
  water: '#03070f',
  structure: '#0b1d2b',
} as const

const cyan = (alpha: number) => `rgba(141, 250, 255, ${alpha})`
const amber = (alpha: number) => `rgba(255, 179, 71, ${alpha})`

export function createAtlasStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Grid/84',
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#010107',
      'horizon-color': '#0a1c33',
      'fog-color': PALETTE.ink,
      'fog-ground-blend': 0.7,
      'horizon-fog-blend': 0.85,
      'sky-horizon-blend': 0.6,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    light: { anchor: 'viewport', color: PALETTE.cyan, intensity: 0.35, position: [1.15, 210, 30] },
    sources: {
      atlas: { type: 'vector', url: ATLAS_TILES_URL },
      // Two DEM sources from the same tiles: MapLibre renders better when hillshade and 3D terrain do not share one.
      terrain: {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES_URL],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: 'Terrain: Mapzen, AWS Terrain Tiles',
      },
      relief: {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES_URL],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': PALETTE.land } },
      {
        id: 'relief',
        type: 'hillshade',
        source: 'relief',
        paint: {
          'hillshade-shadow-color': '#02020a',
          'hillshade-highlight-color': cyan(0.32),
          'hillshade-accent-color': cyan(0.18),
          'hillshade-exaggeration': 0.55,
          'hillshade-illumination-anchor': 'map',
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'atlas',
        'source-layer': 'water',
        paint: { 'fill-color': PALETTE.water },
      },
      {
        id: 'coast',
        type: 'line',
        source: 'atlas',
        'source-layer': 'water',
        paint: {
          'line-color': cyan(0.45),
          'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 6, 1, 12, 1.4],
        },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'atlas',
        'source-layer': 'waterway',
        minzoom: 9,
        paint: {
          'line-color': 'rgba(60, 140, 220, 0.55)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.2, 18, 3],
        },
      },
      {
        id: 'frontier',
        type: 'line',
        source: 'atlas',
        'source-layer': 'boundary',
        filter: ['all', ['<=', ['get', 'admin_level'], 2], ['==', ['get', 'maritime'], 0]],
        paint: {
          'line-color': cyan(0.4),
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 8, 1.2],
          'line-dasharray': [3, 2],
        },
      },
      {
        id: 'conduit-minor',
        type: 'line',
        source: 'atlas',
        'source-layer': 'transportation',
        minzoom: 12,
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track', 'path', 'living_street', 'pedestrian']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': cyan(0.28),
          'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 12, 0.3, 15, 1, 18, 3],
        },
      },
      {
        id: 'conduit-secondary',
        type: 'line',
        source: 'atlas',
        'source-layer': 'transportation',
        minzoom: 8,
        filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': cyan(0.55),
          'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 0.3, 12, 1, 16, 2.5, 18, 5],
        },
      },
      {
        id: 'conduit-major-glow',
        type: 'line',
        source: 'atlas',
        'source-layer': 'transportation',
        minzoom: 5,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': cyan(0.22),
          'line-blur': 4,
          'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5, 1.5, 10, 4, 14, 8, 18, 18],
        },
      },
      {
        id: 'conduit-major',
        type: 'line',
        source: 'atlas',
        'source-layer': 'transportation',
        minzoom: 5,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': cyan(0.9),
          'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5, 0.4, 10, 1.2, 14, 2.5, 18, 6],
        },
      },
      {
        id: 'rail',
        type: 'line',
        source: 'atlas',
        'source-layer': 'transportation',
        minzoom: 7,
        filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'service'], 'yard']],
        paint: {
          'line-color': amber(0.75),
          'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 7, 0.4, 12, 1, 16, 2, 18, 3.5],
        },
      },
      {
        id: 'transit',
        type: 'line',
        source: 'atlas',
        'source-layer': 'transportation',
        minzoom: 11,
        filter: ['==', ['get', 'class'], 'transit'],
        paint: {
          'line-color': amber(0.55),
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 1.8],
          'line-dasharray': [4, 2],
        },
      },
      {
        id: 'footprint',
        type: 'line',
        source: 'atlas',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'line-color': cyan(0.5),
          'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.3, 17, 1],
        },
      },
      {
        id: 'structure',
        type: 'fill-extrusion',
        source: 'atlas',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': PALETTE.structure,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.85],
          'fill-extrusion-vertical-gradient': true,
        },
      },
    ],
  }
}
