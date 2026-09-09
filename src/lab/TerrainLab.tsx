import type { CanvasSource, Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { formatGrid, type LngLat } from '../geo/geodesy.ts'
import { geodesicCircle } from '../geo/shapes.ts'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { installEvidenceLayers, setSourceData, SOURCES, type EvidenceFeature } from '../map/evidence-layers.ts'
import { TERRAIN_TILES_URL } from '../map/style.ts'
import { thirdDegreeBurnRadiusMetres } from '../models/blast.ts'
import { overpressureRadiusForPsi } from '../models/casualties.ts'
import type { TerrainRequest, TerrainResponse } from '../models/terrain.worker.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'

const N = 224

interface Preset {
  id: string
  name: string
  center: LngLat
  yieldKt: number
  hob: number
  note: string
  /** Recorded devastated area for the check, km², with its source. */
  recordedAreaKm2?: { value: number; source: string }
}

const PRESETS: Preset[] = [
  { id: 'nagasaki', name: 'Nagasaki', center: [129.8636, 32.7737], yieldKt: 21, hob: 503, note: '9 Aug 1945 · 21 kt (Malik 1985) · 503 m (RERF) · the valley case', recordedAreaKm2: { value: 1.8 * 2.589988, source: 'USSBS: about 1.8 square miles of near-complete devastation' } },
  { id: 'hiroshima', name: 'Hiroshima', center: [132.4536, 34.3955], yieldKt: 15, hob: 600, note: '6 Aug 1945 · 15 kt (Malik 1985) · 600 m (RERF) · the flat case', recordedAreaKm2: { value: 4.4 * 2.589988, source: 'USSBS: 4.4 square miles almost completely burned out' } },
  { id: 'tsar', name: 'Tsar Bomba', center: [54.98, 73.81], yieldKt: 50_000, hob: 4_000, note: '30 Oct 1961 · about 50 Mt · about 4 km · Sukhoy Nos, Novaya Zemlya; coordinates and height as commonly published, not yet sourced here' },
]

type View = 'shadow' | 'wave' | 'factor'

function boxCoordinates(center: LngLat, sizeMetres: number): [[number, number], [number, number], [number, number], [number, number]] {
  const half = sizeMetres / 2
  const dLat = half / 111_320
  const dLon = half / (111_320 * Math.cos((center[1] * Math.PI) / 180))
  const west = center[0] - dLon
  const east = center[0] + dLon
  const north = center[1] + dLat
  const south = center[1] - dLat
  return [[west, north], [east, north], [east, south], [west, south]]
}

export function TerrainLab() {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const canvas = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const worker = useRef<Worker | null>(null)
  const prepared = useRef<(TerrainResponse & { type: 'prepared' }) | null>(null)
  const factorRef = useRef<Float32Array | null>(null)
  const frameRef = useRef<Float32Array | null>(null)
  const viewRef = useRef<View>('shadow')
  const [preset, setPreset] = useState<Preset>(PRESETS[0])
  const [center, setCenter] = useState<LngLat>(PRESETS[0].center)
  const [yieldKt, setYieldKt] = useState(PRESETS[0].yieldKt)
  const [hob, setHob] = useState(PRESETS[0].hob)
  const [view, setView] = useState<View>('shadow')
  const [status, setStatus] = useState<string>('Preparing terrain…')
  const [info, setInfo] = useState<{ dx: number; minHeight: number; maxHeight: number; burstHeight: number; stats: Record<string, { visibleFraction: number; cells: number }> } | null>(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<Record<string, { visibleFraction: number; meanFactor: number }> | null>(null)
  const [ready, setReady] = useState(false)

  const r5 = overpressureRadiusForPsi(yieldKt, 5)
  const r2 = overpressureRadiusForPsi(yieldKt, 2)
  const fire = thirdDegreeBurnRadiusMetres(yieldKt)
  const size = Math.max(4_000, r2 * 3.2)
  const radii = { psi5: r5, psi2: r2, fire }

  useEffect(() => {
    if (!container.current) return
    canvas.current.width = N
    canvas.current.height = N
    const map = createBaseMap(container.current, { center, zoom: 11.6, pitch: 55, bearing: -20 })
    mapRef.current = map
    map.on('load', () => {
      installTerrainSync(map)
      installEvidenceLayers(map)
      map.addSource('shock', { type: 'canvas', canvas: canvas.current, coordinates: boxCoordinates(center, size), animate: true })
      map.addLayer({ id: 'shock', type: 'raster', source: 'shock', paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0 } }, 'ev-areas-fill')
      setReady(true)
    })
    map.on('click', (e) => {
      setPreset({ id: 'custom', name: 'Custom', center: [e.lngLat.lng, e.lngLat.lat], yieldKt, hob, note: 'Burst placed by hand' })
      setCenter([e.lngLat.lng, e.lngLat.lat])
    })
    return () => {
      map.remove()
      mapRef.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    viewRef.current = view
    paint()
    // paint reads refs only; it is not a reactive dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // Prepare terrain whenever burst, yield or height changes.
  useEffect(() => {
    if (!ready) return
    worker.current?.terminate()
    const w = new Worker(new URL('../models/terrain.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    prepared.current = null
    factorRef.current = null
    frameRef.current = null
    setDone(null)
    setInfo(null)
    setProgress(0)
    setStatus('Fetching terrain tiles…')
    const map = mapRef.current
    if (map) {
      ;(map.getSource('shock') as CanvasSource | undefined)?.setCoordinates(boxCoordinates(center, size))
      const rings: EvidenceFeature[] = [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: geodesicCircle(center, r5).map((p) => [p[0], p[1]]) }, properties: { evidence: 'modelled', id: 'r5' } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: geodesicCircle(center, r2).map((p) => [p[0], p[1]]) }, properties: { evidence: 'modelled', id: 'r2' } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: geodesicCircle(center, fire).map((p) => [p[0], p[1]]) }, properties: { evidence: 'inferred', id: 'fire' } },
      ]
      setSourceData(map, SOURCES.rings, rings)
      setSourceData(map, SOURCES.sites, [{ type: 'Feature', geometry: { type: 'Point', coordinates: [center[0], center[1]] }, properties: { evidence: 'modelled', id: 'burst' } }])
    }
    w.onmessage = (event: MessageEvent<TerrainResponse>) => {
      const m = event.data
      if (m.type === 'error') {
        setStatus(`Failed: ${m.message}`)
        return
      }
      if (m.type === 'prepared') {
        prepared.current = m
        setInfo({ dx: m.dx, minHeight: m.minHeight, maxHeight: m.maxHeight, burstHeight: m.burstHeight, stats: m.stats })
        setStatus('Terrain ready · line-of-sight shadow computed')
        paint()
        return
      }
      if (m.type === 'frame') {
        frameRef.current = m.field
        setProgress(m.step / m.totalSteps)
        if (viewRef.current === 'wave') paint()
        return
      }
      if (m.type === 'done') {
        factorRef.current = m.factor
        setDone(m.stats)
        setStatus('Run complete · terrain factor is peak with terrain over peak on flat ground')
        setView('factor')
      }
    }
    const request: TerrainRequest = { type: 'prepare', id: 1, center: [center[0], center[1]], sizeMetres: size, n: N, hob, tileUrl: TERRAIN_TILES_URL, radii }
    w.postMessage(request)
    return () => {
      w.terminate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, center, yieldKt, hob])

  function run() {
    const w = worker.current
    if (!w || !prepared.current) return
    setView('wave')
    setStatus('Running the wave over the terrain and over flat ground…')
    const request: TerrainRequest = { type: 'run', id: 2, travelMetres: size * 0.6, frameEvery: 3 }
    w.postMessage(request)
  }

  function paint() {
    const p = prepared.current
    if (!p) return
    const ctx = canvas.current.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(N, N)
    const d = img.data
    const mode = viewRef.current
    if (mode === 'shadow') {
      for (let i = 0; i < N * N; i += 1) {
        const o = i * 4
        if (p.blockers[i]) {
          d[o] = 141
          d[o + 1] = 250
          d[o + 2] = 255
          d[o + 3] = 230
        } else if (!p.visible[i]) {
          d[o] = 5
          d[o + 1] = 4
          d[o + 2] = 16
          d[o + 3] = 170
        } else {
          d[o + 3] = 0
        }
      }
    } else if (mode === 'wave') {
      const f = frameRef.current
      if (!f) return
      let max = 1e-6
      for (let i = 0; i < f.length; i += 1) {
        const a = Math.abs(f[i])
        if (a > max) max = a
      }
      for (let i = 0; i < N * N; i += 1) {
        const o = i * 4
        const v = f[i] / max
        const a = Math.min(1, Math.abs(v) * 3)
        if (v > 0) {
          d[o] = 255
          d[o + 1] = 179
          d[o + 2] = 71
        } else {
          d[o] = 141
          d[o + 1] = 250
          d[o + 2] = 255
        }
        d[o + 3] = Math.round(a * 235)
        if (p.blockers[i]) {
          d[o] = 141
          d[o + 1] = 250
          d[o + 2] = 255
          d[o + 3] = 200
        }
      }
    } else {
      const f = factorRef.current
      if (!f) return
      // Report the factor only out to a little beyond the 2 psi ring, where the statistics are taken.
      const limit = (r2 * 1.25) / p.dx
      for (let i = 0; i < N * N; i += 1) {
        const o = i * 4
        const cx = (i % N) - N / 2
        const cy = Math.floor(i / N) - N / 2
        if (cx * cx + cy * cy > limit * limit) {
          d[o + 3] = 0
          continue
        }
        const lg = Math.log2(Math.max(0.05, Math.min(8, f[i])))
        const a = Math.min(1, Math.abs(lg) * 0.9)
        if (lg > 0) {
          d[o] = 255
          d[o + 1] = 96
          d[o + 2] = 96
        } else {
          d[o] = 60
          d[o + 1] = 140
          d[o + 2] = 255
        }
        d[o + 3] = Math.round(a * 220)
        if (p.blockers[i]) {
          d[o] = 141
          d[o + 1] = 250
          d[o + 2] = 255
          d[o + 3] = 200
        }
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  const applyPreset = (p: Preset) => {
    setPreset(p)
    setCenter(p.center)
    setYieldKt(p.yieldKt)
    setHob(p.hob)
    mapRef.current?.flyTo({ center: [p.center[0], p.center[1]], zoom: p.yieldKt > 5_000 ? 8.5 : 11.6, pitch: 55, bearing: -20, duration: 3_000, essential: true })
  }

  const km2 = (r: number, fraction: number) => (Math.PI * r * r * fraction) / 1e6
  const pct = (v: number) => `${Math.round(v * 100)}%`

  return (
    <div className="study">
      <div ref={container} className="atlas-map" aria-label="Terrain shock lab" />
      <div className="atlas-vignette" aria-hidden="true" />
      <div className="study-hud lab-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>LAB · TERRAIN SHOCK</strong>
          <span>Blast over real ground · shadow, wave, terrain factor</span>
        </header>

        <section className="clock" aria-label="Burst">
          <h2>Case</h2>
          <div className="clock-controls">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={preset.id === p.id ? 'is-active' : ''} title={p.note} onClick={() => applyPreset(p)}>
                {p.name}
              </button>
            ))}
          </div>
          <p className="log-empty">{preset.note}</p>
          <p className="log-empty">
            Burst {formatGrid(center)} · {yieldKt >= 1_000 ? `${(yieldKt / 1_000).toFixed(yieldKt >= 10_000 ? 0 : 2)} Mt` : `${yieldKt} kt`} · HOB {hob} m · click the ground to move it
          </p>
          <h2>Height of burst</h2>
          <input type="range" min={100} max={yieldKt > 5_000 ? 8_000 : 2_000} step={10} value={hob} aria-label="Height of burst" onChange={(e) => setHob(Number(e.target.value))} />
          <h2>View</h2>
          <div className="clock-controls">
            {(['shadow', 'wave', 'factor'] as View[]).map((v) => (
              <button key={v} type="button" className={view === v ? 'is-active' : ''} onClick={() => setView(v)} disabled={v === 'factor' && !done}>
                {v}
              </button>
            ))}
            <button type="button" onClick={run} disabled={!info}>
              RUN WAVE
            </button>
          </div>
          {progress > 0 && progress < 1 && <p className="log-empty">Front at {pct(progress)} of the box</p>}
        </section>

        <section className="log" aria-label="Terrain">
          <h2>Terrain</h2>
          <p className="log-empty">{status}</p>
          {info && (
            <dl className="grid-facts">
              <dt>Tiles</dt>
              <dd>AWS Terrain Tiles · Terrarium · resampled to {info.dx.toFixed(0)} m cells · {N} × {N}</dd>
              <dt>Ground</dt>
              <dd>
                {info.minHeight.toFixed(0)} to {info.maxHeight.toFixed(0)} m ASL · burst at {info.burstHeight.toFixed(0)} m ASL
              </dd>
              <dt>Visible from the burst</dt>
              <dd>
                within 5 psi {pct(info.stats.psi5.visibleFraction)} · within 2 psi {pct(info.stats.psi2.visibleFraction)} · within fire radius {pct(info.stats.fire.visibleFraction)}
              </dd>
              <dt>Unshadowed 5 psi area</dt>
              <dd>
                {km2(r5, info.stats.psi5.visibleFraction).toFixed(1)} km² of {km2(r5, 1).toFixed(1)} km²
                {preset.recordedAreaKm2 && (
                  <>
                    {' '}
                    · recorded {preset.recordedAreaKm2.value.toFixed(1)} km² <span className="fact-note">({preset.recordedAreaKm2.source})</span>
                  </>
                )}
              </dd>
              {done && (
                <>
                  <dt>Mean terrain factor</dt>
                  <dd>
                    within 5 psi ×{done.psi5.meanFactor.toFixed(2)} · within 2 psi ×{done.psi2.meanFactor.toFixed(2)}
                  </dd>
                </>
              )}
            </dl>
          )}
        </section>

        <section className="provenance" aria-label="Fidelity">
          <h2>
            Fidelity <span className="badge badge--modelled">MODELLED</span>
          </h2>
          <dl>
            <div className="fact fact--modelled">
              <dt>Shadow</dt>
              <dd>Straight line from the burst point to a 2 m eye at each cell against the terrain. Exact for the thermal flash; a first cut for the direct blast, which also diffracts.</dd>
            </div>
            <div className="fact fact--inferred">
              <dt>Wave</dt>
              <dd>A linear acoustic wave on a 2D grid at 340 m/s. Terrain faces that block the line of sight are hard reflectors; everything else is open. Diffraction and reflection emerge; the shock’s nonlinearity, its Mach stem and the third dimension do not.</dd>
            </div>
            <div className="fact fact--inferred">
              <dt>Terrain factor</dt>
              <dd>Peak amplitude with terrain divided by peak amplitude on flat ground, cell by cell. Red above one, blue below. A pattern, not a pressure.</dd>
            </div>
            <div className="fact fact--documented">
              <dt>Why it matters</dt>
              <dd>USSBS on Nagasaki: “the uneven terrain of the city confined the maximum intensity of damage to the valley over which the bomb exploded.” The planar model overstates Nagasaki’s devastated area by about two.</dd>
            </div>
          </dl>
        </section>

        <section className="omissions" aria-label="Not represented">
          <h2>Not represented</h2>
          <ul>
            <li>Shock nonlinearity, Mach stem formation, the negative phase</li>
            <li>Vertical structure: the wave is two-dimensional</li>
            <li>Buildings, vegetation, structure class</li>
            <li>Thermal shadowing by smoke and dust after the flash</li>
          </ul>
        </section>

        <EvidenceLegend />
      </div>
    </div>
  )
}
