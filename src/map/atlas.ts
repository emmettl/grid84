import { Marker, type GeoJSONSource } from 'maplibre-gl'
import type { AtlasTarget } from '../atlas/target.ts'
import type { Boundary } from '../atlas/boundary.ts'
import { installTargetBounds, setTargetBounds } from './target-bounds.ts'
import { geodesicCircle } from '../geo/shapes.ts'
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
  /** Put an aim point on the globe as the console works it out: a mark, its CEP ring and a label that comes into being. */
  addAimPoint(point: AimPointMark): void
  clearAimPoints(): void
  destroy(): void
}

export interface AimPointMark {
  index: number
  position: LngLat
  cepMetres: number
  label: string
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
  const aims: AimPointMark[] = []
  let aimLabels: Marker[] = []
  const ensureAimLayers = () => {
    if (map.getSource('atlas-aims')) return
    map.addSource('atlas-aims', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'atlas-aims-cep', type: 'line', source: 'atlas-aims', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': 'rgba(255, 138, 31, 0.55)', 'line-width': 1, 'line-dasharray': [2, 2] } })
    map.addLayer({ id: 'atlas-aims-point', type: 'circle', source: 'atlas-aims', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 3.2, 'circle-color': '#ff8a1f', 'circle-stroke-color': '#0a0602', 'circle-stroke-width': 1.5 } })
  }
  const drawAims = () => {
    if (destroyed) return
    ensureAimLayers()
    const source = map.getSource('atlas-aims') as GeoJSONSource | undefined
    source?.setData({
      type: 'FeatureCollection',
      features: aims.flatMap((a) => [
        { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [a.position[0], a.position[1]] }, properties: { index: a.index } },
        { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: geodesicCircle(a.position, a.cepMetres).map((p) => [p[0], p[1]]) }, properties: { index: a.index } },
      ]),
    })
  }
  const ensureBoundaryLayers = () => installTargetBounds(map)
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
    clearAimPoints()
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
      setTargetBounds(map, boundary ? boundary.rings : [], boundary?.kind)
    }
    if (map.isStyleLoaded()) draw()
    else map.once('load', draw)
  }

  const addAimPoint = (point: AimPointMark) => {
    if (destroyed) return
    aims.push(point)
    // The mark that says a place has been chosen rather than merely found:
    // four brackets closing on it and a ring collapsing into it, once, as the
    // console prints the line that puts it there. The study draws the same
    // mark for the same reason, and this is the half of it the reader sees
    // first — before anything flies, while the plan is still being written.
    if (!reducedMotion) {
      const r = document.createElement('div')
      r.className = 'aim-reticle'
      r.setAttribute('aria-hidden', 'true')
      r.innerHTML = '<span class="aim-reticle-ring"></span><i></i><i></i><i></i><i></i>'
      const mark = new Marker({ element: r, anchor: 'center' }).setLngLat([point.position[0], point.position[1]]).addTo(map)
      window.setTimeout(() => mark.remove(), 2_050)
    }
    const el = document.createElement('div')
    el.className = 'atlas-aim-label'
    el.textContent = point.label
    aimLabels.push(new Marker({ element: el, anchor: point.index % 2 === 0 ? 'left' : 'right', offset: [point.index % 2 === 0 ? 8 : -8, 0] }).setLngLat([point.position[0], point.position[1]]).addTo(map))
    if (map.isStyleLoaded()) drawAims()
    else map.once('load', drawAims)
  }
  const clearAimPoints = () => {
    aims.length = 0
    for (const m of aimLabels) m.remove()
    aimLabels = []
    if (map.isStyleLoaded()) drawAims()
  }

  return {
    acquire,
    showBoundary,
    addAimPoint,
    clearAimPoints,
    destroy() {
      for (const m of aimLabels) m.remove()
      label?.remove()
      destroyed = true
      spinning = false
      map.remove()
    },
  }
}
