import { Marker, type GeoJSONSource } from 'maplibre-gl'
import type { AtlasTarget } from '../atlas/target.ts'
import type { Boundary } from '../atlas/boundary.ts'
import { ALARM_HATCH, ensureAlarmHatch } from './hatch.ts'
import { designate, type Designation } from '../atlas/designation.ts'
import { haversineMetres, initialBearing, type LngLat } from '../geo/geodesy.ts'
import { ORBITAL_ZOOM, planDescent, TERRAIN_MIN_ZOOM } from './descent.ts'
import { createBaseMap } from './base.ts'

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
  /** Draw the target's boundary and float its name above it; null clears the boundary but keeps the label. */
  showBoundary(target: AtlasTarget, boundary: Boundary | null): void
  destroy(): void
}

/** Where the globe hangs before the first fix. */
const STANDBY_CENTER: LngLat = [8.54, 47.38]
/** One full rotation in standby takes this long. */
const STANDBY_ROTATION_MS = 240_000

export function createAtlas(container: HTMLElement, options: AtlasOptions): Atlas {
  const reducedMotion = options.reducedMotion ?? false
  const map = createBaseMap(container, { center: STANDBY_CENTER, zoom: ORBITAL_ZOOM })

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

  let label: Marker | null = null
  const ensureBoundaryLayers = () => {
    if (map.getSource('atlas-boundary')) return
    ensureAlarmHatch(map)
    map.addSource('atlas-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'atlas-boundary-fill', type: 'fill', source: 'atlas-boundary', paint: { 'fill-pattern': ALARM_HATCH, 'fill-opacity': 0.28 } })
    map.addLayer({ id: 'atlas-boundary-line', type: 'line', source: 'atlas-boundary', paint: { 'line-color': '#ff8a1f', 'line-width': 2, 'line-opacity': 0.95 } })
    map.addLayer({ id: 'atlas-boundary-line-dark', type: 'line', source: 'atlas-boundary', paint: { 'line-color': '#0a0602', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.9 } })
  }
  map.on('load', () => {
    ensureBoundaryLayers()
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

  const showBoundary = (target: AtlasTarget, boundary: Boundary | null) => {
    if (destroyed) return
    // The label floats above the target at once; the outline waits for the style if it is not yet up.
    label?.remove()
    const el = document.createElement('div')
    el.className = 'atlas-target-label'
    el.innerHTML = '<span class="atlas-target-name"></span><span class="atlas-target-kind"></span>'
    ;(el.firstChild as HTMLElement).textContent = target.name
    ;(el.lastChild as HTMLElement).textContent = boundary ? (boundary.kind === 'polygon' ? 'BOUNDARY · OPENSTREETMAP' : 'EXTENT · GEOCODER') : 'TARGET'
    label = new Marker({ element: el, anchor: 'bottom', offset: [0, -14] }).setLngLat([target.position[0], target.position[1]]).addTo(map)
    const draw = () => {
      if (destroyed) return
      ensureBoundaryLayers()
      const source = map.getSource('atlas-boundary') as GeoJSONSource | undefined
      source?.setData({ type: 'FeatureCollection', features: boundary ? boundary.rings.map((ring) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring.map((p) => [p[0], p[1]])] }, properties: { kind: boundary.kind } })) : [] })
    }
    if (map.isStyleLoaded()) draw()
    else map.once('load', draw)
  }

  return {
    acquire,
    showBoundary,
    destroy() {
      label?.remove()
      destroyed = true
      spinning = false
      map.remove()
    },
  }
}
