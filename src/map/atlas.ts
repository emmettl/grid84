import { Map as MapLibreMap } from 'maplibre-gl'
import type { AtlasTarget } from '../atlas/target.ts'
import { designate, type Designation } from '../atlas/designation.ts'
import { haversineMetres, initialBearing, type LngLat } from '../geo/geodesy.ts'
import { ORBITAL_ZOOM, planDescent, TERRAIN_MIN_ZOOM } from './descent.ts'
import { createAtlasStyle } from './style.ts'

export interface AcquisitionReport {
  target: AtlasTarget
  designation: Designation
  /** Previous acquired target, or null on the first fix. */
  from: AtlasTarget | null
  rangeMetres: number | null
  bearing: number | null
  /** Terrain elevation at the target, once the terrain tiles have loaded. */
  elevationMetres: number | null
}

export type AtlasPhase =
  | { kind: 'standby' }
  | { kind: 'descending'; target: AtlasTarget; designation: Designation }
  | { kind: 'acquired'; report: AcquisitionReport }

export interface AtlasOptions {
  onPhase: (phase: AtlasPhase) => void
  reducedMotion?: boolean
}

export interface Atlas {
  acquire(target: AtlasTarget): void
  destroy(): void
}

/** Where the globe hangs before the first fix. */
const STANDBY_CENTER: LngLat = [8.54, 47.38]
/** One full rotation in standby takes this long. */
const STANDBY_ROTATION_MS = 240_000

export function createAtlas(container: HTMLElement, options: AtlasOptions): Atlas {
  const reducedMotion = options.reducedMotion ?? false
  const map = new MapLibreMap({
    container,
    style: createAtlasStyle(),
    center: [STANDBY_CENTER[0], STANDBY_CENTER[1]],
    zoom: ORBITAL_ZOOM,
    maxPitch: 70,
    attributionControl: { compact: true },
    canvasContextAttributes: { antialias: true },
  })

  // Dev-only handle for inspecting the live map from the browser console.
  if (import.meta.env.DEV) Object.assign(window, { __grid84: map })

  let previous: AtlasTarget | null = null
  let acquisition = 0
  let spinning = !reducedMotion
  let terrainEnabled = false
  let destroyed = false

  const spin = () => {
    if (!spinning || destroyed) return
    const center = map.getCenter()
    map.easeTo({
      center: [center.lng + 90, center.lat],
      duration: STANDBY_ROTATION_MS / 4,
      easing: (t: number) => t,
      essential: true,
    })
  }
  const stopSpinning = () => {
    if (!spinning) return
    spinning = false
    map.stop()
  }

  const syncTerrain = () => {
    const wanted = map.getZoom() >= TERRAIN_MIN_ZOOM
    if (wanted === terrainEnabled) return
    terrainEnabled = wanted
    map.setTerrain(wanted ? { source: 'terrain', exaggeration: 1 } : null)
  }

  map.on('load', () => {
    spin()
    map.on('moveend', () => {
      if (spinning) spin()
    })
    map.on('zoomend', syncTerrain)
  })
  for (const event of ['mousedown', 'touchstart', 'wheel'] as const) map.on(event, stopSpinning)

  const acquire = (target: AtlasTarget) => {
    if (destroyed) return
    const token = ++acquisition
    stopSpinning()
    const designation = designate(target)
    const from = previous
    const report: AcquisitionReport = {
      target,
      designation,
      from,
      rangeMetres: from ? haversineMetres(from.position, target.position) : null,
      bearing: from ? initialBearing(from.position, target.position) : null,
      elevationMetres: null,
    }
    previous = target
    options.onPhase({ kind: 'descending', target, designation })

    // Hold the globe on the way up; terrain returns once we are low enough for it to matter.
    if (terrainEnabled) {
      terrainEnabled = false
      map.setTerrain(null)
    }

    const origin = from?.position ?? ([map.getCenter().lng, map.getCenter().lat] as const)
    const plan = planDescent(origin, target)

    const settle = () => {
      if (token !== acquisition || destroyed) return
      syncTerrain()
      options.onPhase({ kind: 'acquired', report })
      if (!terrainEnabled) return
      map.once('idle', () => {
        if (token !== acquisition || destroyed) return
        const elevation = map.queryTerrainElevation([target.position[0], target.position[1]])
        if (typeof elevation === 'number' && Number.isFinite(elevation)) {
          options.onPhase({ kind: 'acquired', report: { ...report, elevationMetres: elevation } })
        }
      })
    }

    if (reducedMotion) {
      map.jumpTo({ center: [plan.center[0], plan.center[1]], zoom: plan.zoom, pitch: plan.pitch, bearing: plan.bearing })
      settle()
      return
    }
    map.once('moveend', settle)
    map.flyTo({
      center: [plan.center[0], plan.center[1]],
      zoom: plan.zoom,
      pitch: plan.pitch,
      bearing: plan.bearing,
      duration: plan.duration,
      minZoom: plan.minZoom,
      essential: true,
    })
  }

  return {
    acquire,
    destroy() {
      destroyed = true
      spinning = false
      map.remove()
    },
  }
}
