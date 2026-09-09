import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { advance, formatStudyTime, type ClockState } from '../engine/clock.ts'
import { formatProvenance, TIER_LABEL, type Evidenced } from '../evidence/evidence.ts'
import { geodesicCircle } from '../geo/shapes.ts'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { installEvidenceLayers, setSourceData, SOURCES, type EvidenceFeature } from '../map/evidence-layers.ts'
import { EvidenceLegend } from './EvidenceLegend.tsx'
import type { Entity, LabelAnchor, Study } from './study.ts'

const RATES = [1, 10, 60, 600]

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

function timedFeatures(study: Study, time: number) {
  const vehicles: EvidenceFeature[] = []
  const rings: EvidenceFeature[] = []
  const areas: EvidenceFeature[] = []
  const paths: EvidenceFeature[] = []
  for (const e of study.entities) {
    if (e.kind === 'track') {
      const p = e.track.positionAt(time)
      if (p) vehicles.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p[0], p[1]] }, properties: { evidence: e.evidence, id: e.id } })
      if (e.reveal === 'progressive') {
        const flown = e.track.geometryUntil(time)
        if (flown.length > 1) paths.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: flown.map((q) => [q[0], q[1]]) }, properties: { evidence: e.route.evidence, id: e.id } })
      }
    } else if (e.kind === 'effect' && time >= e.time) {
      for (const ring of e.effects.rings) {
        const coords = geodesicCircle(e.center, ring.radius).map((p) => [p[0], p[1]])
        rings.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { evidence: 'modelled', id: `${e.id}-${ring.key}` } })
      }
      const outer = e.effects.rings[e.effects.rings.length - 1]
      areas.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [geodesicCircle(e.center, outer.radius).map((p) => [p[0], p[1]])] }, properties: { evidence: 'modelled', id: `${e.id}-area` } })
    }
  }
  return { vehicles, rings, areas, paths }
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
  /** Sources are rewritten only when the clock moves, and once on first paint. */
  const primed = useRef(false)
  const initialClock: ClockState = { time: Math.max(study.bounds.start, -600), playing: false, rate: 60 }
  const clockRef = useRef<ClockState>(initialClock)
  const [clock, setClock] = useState<ClockState>(initialClock)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const statics = useMemo(() => staticFeatures(study), [study])
  const selected = study.entities.find((e) => e.id === selectedId) ?? null

  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center: study.view.center, zoom: study.view.zoom })
    mapRef.current = map
    const labels = markers.current
    map.on('load', () => {
      terrainSync.current = installTerrainSync(map)
      installEvidenceLayers(map)
      setSourceData(map, SOURCES.paths, statics.paths)
      setSourceData(map, SOURCES.sites, statics.sites)
      for (const e of study.entities) {
        const position = e.kind === 'site' ? e.position : e.kind === 'effect' ? e.center : null
        if (!position) continue
        const anchor = e.kind === 'site' ? (e.labelAnchor ?? 'left') : 'left'
        const marker = new Marker({ element: labelElement(e, setSelectedId), anchor, offset: labelOffset(anchor) }).setLngLat([position[0], position[1]])
        if (e.kind === 'site') marker.addTo(map)
        markers.current.set(e.id, marker)
      }
      for (const e of study.entities) {
        if (e.kind !== 'track') continue
        const anchor = e.labelAnchor ?? 'left'
        const marker = new Marker({ element: labelElement(e, setSelectedId), anchor, offset: labelOffset(anchor) })
        markers.current.set(e.id, marker)
      }
      setReady(true)
    })
    map.on('click', () => setSelectedId(null))
    return () => {
      labels.forEach((m) => m.remove())
      labels.clear()
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [study, statics])

  useEffect(() => {
    if (!ready) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1_000)
      last = now
      const previous = clockRef.current
      const next = advance(previous, dt, study.bounds)
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
      if (map && (changed || !primed.current)) {
        primed.current = true
        const timed = timedFeatures(study, next.time)
        setSourceData(map, SOURCES.vehicles, timed.vehicles)
        setSourceData(map, SOURCES.rings, [...statics.rings, ...timed.rings])
        setSourceData(map, SOURCES.areas, timed.areas)
        setSourceData(map, SOURCES.paths, [...statics.paths, ...timed.paths])
        for (const e of study.entities) {
          const marker = markers.current.get(e.id)
          if (!marker) continue
          if (e.kind === 'track') {
            const p = e.track.positionAt(next.time)
            if (p) {
              marker.setLngLat([p[0], p[1]])
              if (!marker.getElement().isConnected) marker.addTo(map)
            } else if (marker.getElement().isConnected) marker.remove()
          } else if (e.kind === 'effect') {
            const due = next.time >= e.time
            if (due && !marker.getElement().isConnected) marker.addTo(map)
            else if (!due && marker.getElement().isConnected) marker.remove()
          }
        }
      }
      if (changed) setClock(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [ready, study, statics])

  const setClockState = (patch: Partial<ClockState>) => {
    clockRef.current = { ...clockRef.current, ...patch }
    primed.current = false
    setClock(clockRef.current)
  }

  const log = study.events.filter((e) => e.time <= clock.time).sort((a, b) => b.time - a.time)

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
                terrainSync.current?.(false)
                mapRef.current?.flyTo({ center: [study.view.center[0], study.view.center[1]], zoom: study.view.zoom, pitch: 0, bearing: 0, duration: 2_000, essential: true })
              }}
            >
              RESET
            </button>
          </div>
          <input
            type="range"
            min={study.bounds.start}
            max={study.bounds.end}
            step={1}
            value={clock.time}
            aria-label="Scrub study time"
            onChange={(event) => setClockState({ time: Number(event.target.value), playing: false })}
          />
          <div className="clock-bounds">
            <span>{formatStudyTime(study.bounds.start)}</span>
            <span>{formatStudyTime(study.bounds.end)}</span>
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
