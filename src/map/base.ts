import { Map as MapLibreMap } from 'maplibre-gl'
import type { LngLat } from '../geo/geodesy.ts'
import { TERRAIN_MIN_ZOOM } from './descent.ts'
import { createAtlasStyle } from './style.ts'

export interface BaseMapOptions {
  center: LngLat
  zoom: number
  pitch?: number
  bearing?: number
}

/** One MapLibre map with the Grid/84 style. The atlas, the studies and the labs all start here. */
export function createBaseMap(container: HTMLElement, options: BaseMapOptions): MapLibreMap {
  const map = new MapLibreMap({
    container,
    style: createAtlasStyle(),
    center: [options.center[0], options.center[1]],
    zoom: options.zoom,
    pitch: options.pitch ?? 0,
    bearing: options.bearing ?? 0,
    maxPitch: 70,
    attributionControl: { compact: true },
    canvasContextAttributes: { antialias: true },
  })
  // Dev-only handle for inspecting the live map from the browser console.
  if (import.meta.env.DEV) Object.assign(window, { __grid84: map })
  return map
}

/**
 * Terrain is meaningful below the orbital threshold and conflicts with the
 * globe above it. Returns a function that applies the rule for the current
 * zoom, so callers can also force it off before flying back to orbit.
 */
export function installTerrainSync(map: MapLibreMap): (force?: boolean) => void {
  let enabled = false
  const sync = (force?: boolean) => {
    const wanted = force ?? map.getZoom() >= TERRAIN_MIN_ZOOM
    if (wanted === enabled) return
    enabled = wanted
    map.setTerrain(wanted ? { source: 'terrain', exaggeration: 1 } : null)
  }
  map.on('zoomend', () => sync())
  return sync
}
