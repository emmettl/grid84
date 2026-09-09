import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { advance, formatStudyTime, type ClockState } from '../engine/clock.ts'
import { formatProvenance, TIER_LABEL, type Evidenced } from '../evidence/evidence.ts'
import { geodesicCircle } from '../geo/shapes.ts'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { installEvidenceLayers, setSourceData, SOURCES, type EvidenceFeature } from '../map/evidence-layers.ts'
import { TrackLayer } from '../map/track-layer.ts'
import { prepareTracks, type TrackSpec } from '../map/track-scene.ts'
import { applyBands, bandPopulations, OTA_BANDS, outcome, radiusForPsi, type Burst, type Outcome } from '../models/casualties.ts'
import { SURFACE_BLAST_MODEL, thirdDegreeBurnRadiusMetres } from '../models/blast.ts'
import { acuteMortality, plume } from '../models/fallout.ts'
import { ExposureService } from '../models/exposure-service.ts'
import { EvidenceLegend } from './EvidenceLegend.tsx'
import type { Entity, LabelAnchor, Study } from './study.ts'

const RATES = [1, 10, 60, 600, 3_600]
/** Studies with more tracks than this draw them through the WebGL layer instead of GeoJSON sources. */
export const GL_TRACK_THRESHOLD = 100

function Badge({ evidence }: { evidence: Evidenced['evidence'] }) {
  return <span className={`badge badge--${evidence}`}>{TIER_LABEL[evidence]}</span>
}

function staticFeatures(study: Study) {
  const paths: EvidenceFeature[] = []
  const sites: EvidenceFeature[] = []
  const rings: EvidenceFeature[] = []
  for (const e of study.entities) {
    if (e.kind === 'track') {
      if (e.reveal === 'full') paths.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: e.track.geometry().map((p) => [p[0], p[1]]) }, properties: { evidence: e.route.evidence, id: e.id } })
    } else if (e.kind === 'site') {
      sites.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.position[0], e.position[1]] }, properties: { evidence: e.evidence, id: e.id } })
      if (e.uncertaintyMetres) {
        rings.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: geodesicCircle(e.position, e.uncertaintyMetres).map((p) => [p[0], p[1]]) },
          properties: { evidence: e.evidence === 'withheld' ? 'withheld' : 'inferred', id: `${e.id}-ring` },
        })
      }
    }
  }
  return { paths, sites, rings }
}

function effectRings(e: Entity & { kind: 'effect' }, burst: Burst) {
  if (burst === 'air') return e.effects.rings
  // Surface burst: overpressure rings shrink to the contact-burst radii; thermal and fireball rings are kept as drawn.
  return e.effects.rings.map((r) => (r.key.startsWith('psi') ? { ...r, radius: radiusForPsi(e.effects.yieldKt, Number(r.key.slice(3)), 'surface') } : r))
}

function trackSpecs(study: Study): TrackSpec[] {
  const specs: TrackSpec[] = []
  for (const e of study.entities) {
    if (e.kind === 'track') specs.push({ id: e.id, track: e.track, route: e.route.evidence, evidence: e.evidence, side: e.side ?? 'attacker', reveal: e.reveal })
  }
  return specs
}

/** Timed geometry for the GeoJSON sources. `tracks` is false when the WebGL layer draws vehicles and flown paths. */
function timedFeatures(study: Study, time: number, burst: Burst, selectedId: string | null, tracks: boolean) {
  const vehicles: EvidenceFeature[] = []
  const rings: EvidenceFeature[] = []
  const areas: EvidenceFeature[] = []
  const paths: EvidenceFeature[] = []
  const flashes: EvidenceFeature[] = []
  /** True when something drawn here changes continuously with time, such as a spreading plume. */
  let animated = false
  for (const e of study.entities) {
    if (e.kind === 'track') {
      if (!tracks) continue
      const p = e.track.positionAt(time)
      if (p) vehicles.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p[0], p[1]] }, properties: { evidence: e.evidence, id: e.id, side: e.side ?? 'attacker' } })
      if (e.reveal === 'progressive') {
        const flown = e.track.geometryUntil(time)
        if (flown.length > 1) paths.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: flown.map((q) => [q[0], q[1]]) }, properties: { evidence: e.route.evidence, id: e.id } })
      }
    } else if (e.kind === 'effect' && time >= e.time) {
      if (e.compact && e.id !== selectedId) {
        // One mark per detonation, radius from the 5 psi ring so it scales with yield; rings only when selected.
        const r5 = drawnRadius(e, burst, 'psi5')
        flashes.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.center[0], e.center[1]] }, properties: { evidence: 'modelled', id: e.id, radiusMetres: r5, age: time - e.time, side: e.side ?? 'attacker' } })
        continue
      }
      const drawn = effectRings(e, burst)
      for (const ring of drawn) {
        const coords = geodesicCircle(e.center, ring.radius).map((p) => [p[0], p[1]])
        rings.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { evidence: 'modelled', id: `${e.id}-${ring.key}` } })
      }
      const outer = drawn.reduce((a, b) => (b.radius > a.radius ? b : a))
      areas.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [geodesicCircle(e.center, outer.radius).map((p) => [p[0], p[1]])] }, properties: { evidence: 'modelled', id: `${e.id}-area` } })
      if (burst === 'surface' && e.fallout) {
        animated = true
        const hoursSince = (time - e.time) / 3_600
        const contours = plume({ center: e.center, yieldKt: e.effects.yieldKt, fissionFraction: e.fallout.fissionFraction, windMph: e.fallout.windMph, downwindBearingDeg: e.fallout.downwindBearingDeg, untilHours: e.fallout.untilHours, reachedHours: hoursSince })
        for (const c of [...contours].reverse()) {
          areas.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [c.ring.map((p) => [p[0], p[1]])] }, properties: { evidence: 'modelled', id: `${e.id}-plume-${c.key}` } })
          rings.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c.ring.map((p) => [p[0], p[1]]) }, properties: { evidence: 'modelled', id: `${e.id}-plume-${c.key}-line` } })
        }
      }
    }
  }
  return { vehicles, rings, areas, paths, flashes, animated }
}

function drawnRadius(e: Entity & { kind: 'effect' }, burst: Burst, key: string): number {
  const ring = effectRings(e, burst).find((r) => r.key === key)
  return ring ? ring.radius : 0
}

function labelOffset(anchor: LabelAnchor): [number, number] {
  switch (anchor) {
    case 'left':
      return [10, 0]
    case 'right':
      return [-10, 0]
    case 'top':
      return [0, 12]
    case 'bottom':
      return [0, -12]
    case 'bottom-left':
      return [6, -8]
    case 'top-left':
      return [6, 8]
  }
}

function labelElement(entity: Entity, onSelect: (id: string) => void): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `ev-label ev-label--${entity.evidence}`
  el.innerHTML = `<span class="ev-label-name"></span><span class="ev-label-designation"></span>`
  ;(el.firstChild as HTMLElement).textContent = entity.name
  ;(el.lastChild as HTMLElement).textContent = entity.designation
  el.addEventListener('click', (event) => {
    event.stopPropagation()
    onSelect(entity.id)
  })
  return el
}

export function StudyView({ study }: { study: Study }) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef<Map<string, Marker>>(new Map())
  const terrainSync = useRef<((force?: boolean) => void) | null>(null)
  const trackLayer = useRef<TrackLayer | null>(null)
  /** Sources are rewritten only when the clock moves, and once on first paint. */
  const primed = useRef(false)
  const exposureService = useRef<ExposureService | null>(null)
  const computed = useRef<Set<string>>(new Set())
  const [outcomes, setOutcomes] = useState<Record<string, Outcome & { grid: string }>>({})
  const [burst, setBurst] = useState<Burst>('air')
  const burstRef = useRef<Burst>('air')
  const falloutComputed = useRef<Set<string>>(new Set())
  const [falloutOutcomes, setFalloutOutcomes] = useState<Record<string, { under1: number; dead: number; grid: string }>>({})
  const [gridName, setGridName] = useState<string | null>(null)
  const effectCount = useMemo(() => study.entities.filter((e) => e.kind === 'effect').length, [study])
  const sums = useMemo(() => {
    const sideOf: Record<string, 'attacker' | 'defender'> = {}
    const totals = { attacker: 0, defender: 0 }
    for (const e of study.entities) {
      if (e.kind !== 'effect') continue
      const side = e.side ?? 'attacker'
      sideOf[e.id] = side
      totals[side] += 1
    }
    const forSide = (side: 'attacker' | 'defender') => {
      const values = Object.entries(outcomes)
        .filter(([id]) => sideOf[id] === side)
        .map(([, o]) => o)
      return {
        computed: values.length,
        total: totals[side],
        blastDead: values.reduce((s, o) => s + o.blast.fatal, 0),
        blastInjured: values.reduce((s, o) => s + o.blast.injured, 0),
        fireDead: values.reduce((s, o) => s + o.fire.fatal, 0),
      }
    }
    return { all: Object.keys(outcomes).length, attacker: forSide('attacker'), defender: forSide('defender') }
  }, [outcomes, study])
  const aggregate = { ...sums.attacker, computed: sums.all }
  const defence = sums.defender
  const bounds = burst === 'surface' && study.surfaceBounds ? study.surfaceBounds : study.bounds
  const boundsRef = useRef(bounds)
  useEffect(() => {
    boundsRef.current = bounds
  }, [bounds])
  const initialClock: ClockState = { time: Math.max(study.bounds.start, -600), playing: false, rate: 60 }
  const clockRef = useRef<ClockState>(initialClock)
  const [clock, setClock] = useState<ClockState>(initialClock)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedRef = useRef<string | null>(null)
  useEffect(() => {
    selectedRef.current = selectedId
    primed.current = false
  }, [selectedId])
  const [ready, setReady] = useState(false)

  const statics = useMemo(() => staticFeatures(study), [study])
  const glTracks = useMemo(() => study.entities.filter((e) => e.kind === 'track').length > GL_TRACK_THRESHOLD, [study])
  const selected = study.entities.find((e) => e.id === selectedId) ?? null

  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center: study.view.center, zoom: study.view.zoom })
    mapRef.current = map
    const labels = markers.current
    map.on('load', () => {
      terrainSync.current = installTerrainSync(map)
      installEvidenceLayers(map)
      if (glTracks) {
        const layer = new TrackLayer()
        layer.setScene(prepareTracks(trackSpecs(study)))
        map.addLayer(layer, 'ev-vehicles-glow')
        trackLayer.current = layer
      } else {
        setSourceData(map, SOURCES.paths, statics.paths)
      }
      setSourceData(map, SOURCES.sites, statics.sites)
      for (const e of study.entities) {
        if (e.label === false) continue
        const position = e.kind === 'site' ? e.position : e.kind === 'effect' ? e.center : null
        if (!position) continue
        const anchor = e.kind === 'site' ? (e.labelAnchor ?? 'left') : 'left'
        const marker = new Marker({ element: labelElement(e, setSelectedId), anchor, offset: labelOffset(anchor) }).setLngLat([position[0], position[1]])
        if (e.kind === 'site') marker.addTo(map)
        markers.current.set(e.id, marker)
      }
      for (const e of study.entities) {
        if (e.kind !== 'track' || e.label === false) continue
        const anchor = e.labelAnchor ?? 'left'
        const marker = new Marker({ element: labelElement(e, setSelectedId), anchor, offset: labelOffset(anchor) })
        markers.current.set(e.id, marker)
      }
      setReady(true)
    })
    map.on('click', (event) => {
      const hits = map.queryRenderedFeatures(event.point, { layers: ['ev-flashes'] })
      const id = hits[0]?.properties?.id
      setSelectedId(typeof id === 'string' ? id : null)
    })
    return () => {
      labels.forEach((m) => m.remove())
      labels.clear()
      map.remove()
      mapRef.current = null
      trackLayer.current = null
      setReady(false)
    }
  }, [study, statics, glTracks])

  // Population grid for outcome calculation, loaded once per study in a worker.
  useEffect(() => {
    if (!study.populationGrid) return
    const base = new URL(`${import.meta.env.BASE_URL}data/hyde/${study.populationGrid}`, document.baseURI).href
    const service = new ExposureService(base, study.exposureWorkers ?? 1)
    exposureService.current = service
    if (import.meta.env.DEV) Object.assign(window, { __grid84Exposure: service })
    service
      .load()
      .then((summary) => {
        if (exposureService.current === service) setGridName(`${summary.source.name} ${summary.source.year}`)
      })
      .catch((error) => {
      // A destroyed service rejects its load; only clear the ref if it is still ours.
      if (exposureService.current !== service) return
      console.warn('population grid unavailable', error)
      exposureService.current = null
    })
    return () => {
      service.destroy()
      exposureService.current = null
    }
  }, [study])

  useEffect(() => {
    if (!ready) return
    let frame = 0
    let last = performance.now()
    let lastSources = 0
    let lastPanel = 0
    let lastFlashes = 0
    let flashesKey = ''
    let ringsKey = ''
    const perf = { ticks: 0, updateMs: 0, maxUpdateMs: 0, renderer: glTracks ? 'webgl' : 'geojson' }
    if (import.meta.env.DEV) Object.assign(window, { __grid84Perf: perf })
    const tick = (now: number) => {
      // Slow frames must not slow the study clock: allow up to a second of wall time per frame.
      const dt = Math.min(1, (now - last) / 1_000)
      last = now
      const previous = clockRef.current
      const next = advance(previous, dt, boundsRef.current)
      const changed = next !== previous
      clockRef.current = next
      const map = mapRef.current
      if (map && changed) {
        // Camera moves fire when the running clock crosses their event; scrubbing does not fly.
        for (const event of study.events) {
          if (event.camera && previous.time < event.time && next.time >= event.time) {
            const c = event.camera
            map.flyTo({ center: [c.center[0], c.center[1]], zoom: c.zoom, pitch: c.pitch ?? 0, bearing: c.bearing ?? 0, duration: c.durationMs ?? 4_000, essential: true })
          }
        }
      }
      // Cheap when unchanged; keeps terrain honest even if MapLibre never reports the fly-to ending.
      if (map) terrainSync.current?.()
      // Map sources are rewritten at most about fifteen times a second; the readout about ten.
      const refreshSources = !primed.current || now - lastSources > 66
      let updated = false
      const updateStart = performance.now()
      if (map && (changed || !primed.current) && refreshSources) {
        primed.current = true
        lastSources = now
        updated = true
        const timed = timedFeatures(study, next.time, burstRef.current, selectedRef.current, !glTracks)
        if (glTracks) {
          trackLayer.current?.setTime(next.time)
        } else {
          setSourceData(map, SOURCES.vehicles, timed.vehicles)
          setSourceData(map, SOURCES.paths, [...statics.paths, ...timed.paths])
        }
        // Rings and areas only change with selection, burst mode or a spreading plume; flashes age slowly.
        const nextRingsKey = `${timed.rings.length}:${timed.areas.length}:${selectedRef.current}:${burstRef.current}:${timed.animated ? next.time : ''}`
        if (nextRingsKey !== ringsKey) {
          ringsKey = nextRingsKey
          setSourceData(map, SOURCES.rings, [...statics.rings, ...timed.rings])
          setSourceData(map, SOURCES.areas, timed.areas)
        }
        const nextFlashesKey = `${timed.flashes.length}:${selectedRef.current}`
        if (nextFlashesKey !== flashesKey || now - lastFlashes > 500) {
          flashesKey = nextFlashesKey
          lastFlashes = now
          setSourceData(map, SOURCES.flashes, timed.flashes)
        }
        for (const e of study.entities) {
          const marker = markers.current.get(e.id)
          if (e.kind === 'track') {
            if (!marker) continue
            const p = e.track.positionAt(next.time)
            if (p) {
              marker.setLngLat([p[0], p[1]])
              if (!marker.getElement().isConnected) marker.addTo(map)
            } else if (marker.getElement().isConnected) marker.remove()
          } else if (e.kind === 'effect') {
            const due = next.time >= e.time
            if (marker) {
              if (due && !marker.getElement().isConnected) marker.addTo(map)
              else if (!due && marker.getElement().isConnected) marker.remove()
            }
            const service = exposureService.current
            if (due && service && service.grid && !computed.current.has(e.id)) {
              computed.current.add(e.id)
              const yieldKt = e.effects.yieldKt
              const mode = burstRef.current
              const rings = [...OTA_BANDS.map((b) => ({ key: b.key, radius: radiusForPsi(yieldKt, b.minPsi, mode) })), { key: 'fire', radius: thirdDegreeBurnRadiusMetres(yieldKt) }]
              const gridName = `${service.grid.source.name} · ${service.grid.source.year}`
              service
                .exposure({ center: e.center, rings, subsamples: 4 })
                .then((result) => {
                  const bands = applyBands(bandPopulations(result.within))
                  setOutcomes((prev) => ({ ...prev, [e.id]: { ...outcome(bands, result.within.fire ?? 0), grid: gridName } }))
                })
                .catch((error) => {
                  console.warn('exposure failed', error)
                  computed.current.delete(e.id)
                })
            }
            // Fallout outcome once the plume has had its full time to fall.
            if (burstRef.current === 'surface' && e.fallout && service && service.grid && next.time >= e.time + e.fallout.untilHours * 3_600 && !falloutComputed.current.has(e.id)) {
              falloutComputed.current.add(e.id)
              const f = e.fallout
              const contours = plume({ center: e.center, yieldKt: e.effects.yieldKt, fissionFraction: f.fissionFraction, windMph: f.windMph, downwindBearingDeg: f.downwindBearingDeg, untilHours: f.untilHours })
              const gridName = `${service.grid.source.name} · ${service.grid.source.year}`
              service
                .polygons(contours.map((c) => ({ key: c.key, ring: c.ring })))
                .then((r) => {
                  let dead = 0
                  for (let i = 0; i < contours.length; i += 1) {
                    const inner = i > 0 ? (r.within[contours[i - 1].key] ?? 0) : 0
                    const band = Math.max(0, (r.within[contours[i].key] ?? 0) - inner)
                    dead += band * acuteMortality(contours[i].doseMidRads)
                  }
                  setFalloutOutcomes((prev) => ({ ...prev, [e.id]: { under1: r.within[contours[contours.length - 1].key] ?? 0, dead, grid: gridName } }))
                })
                .catch((error) => {
                  console.warn('fallout exposure failed', error)
                  falloutComputed.current.delete(e.id)
                })
            }
          }
        }
      }
      if (updated && import.meta.env.DEV) {
        // Dev-only counters for the main-thread cost of a source update, readable as window.__grid84Perf.
        const ms = performance.now() - updateStart
        perf.ticks += 1
        perf.updateMs += ms
        perf.maxUpdateMs = Math.max(perf.maxUpdateMs, ms)
      }
      if (changed && (now - lastPanel > 100 || !next.playing)) {
        lastPanel = now
        setClock(next)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [ready, study, statics, glTracks])

  const setClockState = (patch: Partial<ClockState>) => {
    clockRef.current = { ...clockRef.current, ...patch }
    primed.current = false
    setClock(clockRef.current)
  }

  const fmt = (v: number) => {
    if (v < 10) return Math.round(v).toLocaleString('en-GB')
    const magnitude = 10 ** (Math.floor(Math.log10(v)) - 1)
    return (Math.round(v / magnitude) * magnitude).toLocaleString('en-GB')
  }
  // Per-target outcome lines only for small studies; a large one reports through the aggregate panel.
  const outcomeEvents = study.entities.flatMap((e) => {
    if (e.kind !== 'effect' || effectCount > 20) return []
    const o = outcomes[e.id]
    if (!o) return []
    return [
      { time: e.time + 2, text: `OUTCOME · ${e.name.toUpperCase()} · BLAST ONLY (1961 METHOD): ${fmt(o.blast.fatal)} DEAD · ${fmt(o.blast.injured)} INJURED (MODELLED)`, entityId: e.id },
      { time: e.time + 3, text: `OUTCOME · ${e.name.toUpperCase()} · WITH MASS FIRE (POSTOL BOUND): ${fmt(o.fire.fatal)} DEAD (MODELLED)`, entityId: e.id },
    ]
  })
  const falloutEvents = study.entities.flatMap((e) => {
    if (e.kind !== 'effect' || !e.fallout || burst !== 'surface') return []
    const f = e.fallout
    const lines = [{ time: e.time + 4, text: `FALLOUT · CONTACT SURFACE BURST · PLUME UNDER ${f.windMph} MPH WIND TOWARDS ${String(f.downwindBearingDeg).padStart(3, '0')}° · FISSION ${Math.round(f.fissionFraction * 100)}% (ASSUMED)`, entityId: e.id }]
    const o = falloutOutcomes[e.id]
    if (o) lines.push({ time: e.time + f.untilHours * 3_600, text: `OUTCOME · FALLOUT TO H+${f.untilHours} H · ${fmt(o.under1)} UNDER 1 RAD/HR · ${fmt(o.dead)} ACUTE DEATHS, NO SHELTER (INFERRED)`, entityId: e.id })
    return lines
  })
  const log = [...study.events, ...outcomeEvents, ...falloutEvents].filter((e) => e.time <= clock.time).sort((a, b) => b.time - a.time)
  const hasSurfaceOption = study.entities.some((e) => e.kind === 'effect' && e.fallout)
  const switchBurst = (mode: Burst) => {
    burstRef.current = mode
    setBurst(mode)
    setClockState({ time: Math.max(study.bounds.start, -600), playing: false })
    computed.current.clear()
    falloutComputed.current.clear()
    setOutcomes({})
    setFalloutOutcomes({})
    terrainSync.current?.(false)
    mapRef.current?.flyTo({ center: [study.view.center[0], study.view.center[1]], zoom: study.view.zoom, pitch: 0, bearing: 0, duration: 2_000, essential: true })
  }

  return (
    <div className="study">
      <div ref={container} className="atlas-map" aria-label={`${study.title} globe`} />
      <div className="atlas-vignette" aria-hidden="true" />
      <div className="study-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>{study.title}</strong>
          <span>{study.subtitle}</span>
        </header>

        <section className="clock" aria-label="Study clock">
          <div className="clock-time">{formatStudyTime(clock.time)}</div>
          <div className="clock-controls">
            <button type="button" className={clock.playing ? 'is-active' : ''} onClick={() => setClockState({ playing: !clock.playing })}>
              {clock.playing ? 'HOLD' : 'RUN'}
            </button>
            {RATES.map((rate) => (
              <button key={rate} type="button" className={clock.rate === rate ? 'is-active' : ''} onClick={() => setClockState({ rate })}>
                {rate}×
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setClockState({ time: Math.max(study.bounds.start, -600), playing: false })
                computed.current.clear()
                falloutComputed.current.clear()
                setOutcomes({})
                setFalloutOutcomes({})
                terrainSync.current?.(false)
                mapRef.current?.flyTo({ center: [study.view.center[0], study.view.center[1]], zoom: study.view.zoom, pitch: 0, bearing: 0, duration: 2_000, essential: true })
              }}
            >
              RESET
            </button>
          </div>
          {hasSurfaceOption && (
            <div className="clock-controls">
              <span className="clock-label">Burst</span>
              {(['air', 'surface'] as Burst[]).map((mode) => (
                <button key={mode} type="button" className={burst === mode ? 'is-active' : ''} onClick={() => switchBurst(mode)}>
                  {mode}
                </button>
              ))}
            </div>
          )}
          <input
            type="range"
            min={bounds.start}
            max={bounds.end}
            step={1}
            value={clock.time}
            aria-label="Scrub study time"
            onChange={(event) => setClockState({ time: Number(event.target.value), playing: false })}
          />
          <div className="clock-bounds">
            <span>{formatStudyTime(bounds.start)}</span>
            <span>{formatStudyTime(bounds.end)}</span>
          </div>
        </section>

        <section className="log" aria-label="Event log" aria-live="polite">
          <h2>Log</h2>
          {log.length === 0 && <p className="log-empty">Nothing yet. Run the clock.</p>}
          <ol>
            {log.map((e, i) => (
              <li key={`${e.time}-${e.text}`} className={i === 0 ? 'is-latest' : ''}>
                <time>{formatStudyTime(e.time)}</time>
                <button type="button" onClick={() => e.entityId && setSelectedId(e.entityId)} disabled={!e.entityId}>
                  {e.text}
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="provenance" aria-label="Selected entity">
          {selected ? (
            <>
              <h2>
                {selected.name} <Badge evidence={selected.evidence} />
              </h2>
              <p className="provenance-designation">{selected.designation}</p>
              <p className="provenance-source">{formatProvenance(selected.provenance)}</p>
              {selected.provenance.method && <p className="provenance-method">{selected.provenance.method}</p>}
              {selected.provenance.withheldUnder && <p className="provenance-method">Withheld: {selected.provenance.withheldUnder}</p>}
              {selected.kind === 'track' && (
                <p className="provenance-source">
                  Route <Badge evidence={selected.route.evidence} /> {formatProvenance(selected.route.provenance)}
                  {selected.route.provenance.method && <> · {selected.route.provenance.method}</>}
                </p>
              )}
              {selected.kind === 'effect' && burst === 'surface' && (
                <p className="provenance-method">Surface burst: overpressure radii by {SURFACE_BLAST_MODEL}. {selected.fallout?.provenance.method}</p>
              )}
              {selected.kind === 'effect' && falloutOutcomes[selected.id] && (
                <div className="two-numbers">
                  <div>
                    <span>Under the 1 rad/hr contour</span>
                    <strong>{fmt(falloutOutcomes[selected.id].under1)}</strong>
                    <em>people · {falloutOutcomes[selected.id].grid}</em>
                  </div>
                  <div>
                    <span>Acute fallout deaths, no shelter</span>
                    <strong>{fmt(falloutOutcomes[selected.id].dead)}</strong>
                    <em>to H+{selected.fallout?.untilHours} h · Table 12.108</em>
                  </div>
                </div>
              )}
              {selected.kind === 'effect' && outcomes[selected.id] && (
                <div className="two-numbers">
                  <div>
                    <span>Blast only · 1961 method</span>
                    <strong>{fmt(outcomes[selected.id].blast.fatal)}</strong>
                    <em>dead · {fmt(outcomes[selected.id].blast.injured)} injured · {outcomes[selected.id].grid}</em>
                  </div>
                  <div>
                    <span>With mass fire · Postol bound</span>
                    <strong>{fmt(outcomes[selected.id].fire.fatal)}</strong>
                    <em>dead · everyone inside the fire zone</em>
                  </div>
                </div>
              )}
              <dl>
                {selected.facts.map((fact) => (
                  <div key={fact.label} className={`fact fact--${fact.evidence}`} title={`${formatProvenance(fact.provenance)}${fact.provenance.method ? ` · ${fact.provenance.method}` : ''}${fact.provenance.withheldUnder ? ` · ${fact.provenance.withheldUnder}` : ''}`}>
                    <dt>
                      {fact.label} <Badge evidence={fact.evidence} />
                    </dt>
                    <dd className={fact.evidence === 'withheld' ? 'is-withheld' : ''}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <>
              <h2>Provenance</h2>
              <p className="log-empty">Select a mark or a log line. Every mark on this page traces to a source.</p>
            </>
          )}
        </section>

        {effectCount > 1 && (
          <section className="aggregate" aria-label="Aggregate outcome">
            <h2>
              Outcome calculation <span className="badge badge--modelled">MODELLED</span>
            </h2>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={effectCount} aria-valuenow={aggregate.computed}>
              <div style={{ width: `${(100 * aggregate.computed) / effectCount}%` }} />
            </div>
            <p className="log-empty">
              {aggregate.computed} of {effectCount} detonations summed over {gridName ?? 'the population grid'}
            </p>
            <div className="two-numbers">
              <div>
                <span>Blast only · 1961 method</span>
                <strong>{fmt(aggregate.blastDead)}</strong>
                <em>dead · {fmt(aggregate.blastInjured)} injured</em>
              </div>
              <div>
                <span>With mass fire · Postol bound</span>
                <strong>{fmt(aggregate.fireDead)}</strong>
                <em>dead</em>
              </div>
            </div>
            {study.outcomeReference && (
              <p className="provenance-source">
                {study.outcomeReference.label}: {fmt(study.outcomeReference.value)} · {study.outcomeReference.source}
              </p>
            )}
            {study.sides && defence.total > 0 && (
              <>
                <h2>
                  {study.sides.defender.name} <span className="badge badge--inferred">INFERRED</span>
                </h2>
                <p className="log-empty">
                  {defence.computed} of {defence.total} detonations
                </p>
                <div className="two-numbers">
                  <div>
                    <span>Blast only · 1961 method</span>
                    <strong>{fmt(defence.blastDead)}</strong>
                    <em>dead · {fmt(defence.blastInjured)} injured</em>
                  </div>
                  <div>
                    <span>With mass fire · Postol bound</span>
                    <strong>{fmt(defence.fireDead)}</strong>
                    <em>dead</em>
                  </div>
                </div>
                {study.sides.defender.reference && (
                  <p className="provenance-source">
                    {study.sides.defender.reference.label}: {fmt(study.sides.defender.reference.value)} · {study.sides.defender.reference.source}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        <section className="omissions" aria-label="Not computed">
          <h2>Not represented</h2>
          <ul>
            {study.omissions.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>

        <EvidenceLegend />
      </div>
    </div>
  )
}
