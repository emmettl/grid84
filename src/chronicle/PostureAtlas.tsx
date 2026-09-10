import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { sectorRing } from '../geo/sector.ts'
import { formatProvenance } from '../evidence/evidence.ts'
import postureFile from '../../data/chronicle/posture.json'

/**
 * The posture atlas: the forces where they stood at each epoch the studies
 * built, scrubbed by date. A site is drawn as a disc whose area is the
 * weapons its study counted there, by that study's rules, and keeps the
 * tier and source the study gave it.
 */

interface PostureSite {
  id: string
  name: string
  side: 'us' | 'su' | 'nk'
  kind: string
  lon: number
  lat: number
  weapons: number
  vehicles: number | null
  unit: string | null
  evidence: string
  positionEvidence: string
  source: string
  note: string
  /** A radar's field of view: the faces' centre bearing and width, and the range of the class. */
  coverage?: { bearingDeg: number; widthDeg: number; rangeKm: number; evidence: string; note: string }
}

interface Epoch {
  year: number
  label: string
  scope: 'strategic' | 'theatre'
  study: string
  studyName: string
  sides: Record<string, string>
  sites: PostureSite[]
  totals: Record<string, { sites: number; weapons: number; byKind: Record<string, number> }>
  caveat?: string
}

const POSTURE = postureFile as unknown as { note: string; epochs: Epoch[] }
const EPOCHS = POSTURE.epochs
const SOURCE_ID = 'posture-sites'
const COVERAGE_ID = 'posture-coverage'
const RADAR_ID = 'posture-radars'
const fmt = (v: number) => v.toLocaleString('en-GB')
const KIND_LABEL: Record<string, string> = { icbm: 'ICBM', irbm: 'IRBM / MRBM', slbm: 'Boats at sea', 'slbm-port': 'Boats in port', bomber: 'Aircraft', cruise: 'Cruise missiles', tactical: 'Tactical', command: 'Command', sensor: 'Warning', interceptor: 'Interceptors', carrier: 'Carriers', base: 'Bases', beach: 'Beaches' }

/** A radar glyph for the symbol layer: a dish arc over a stem, in the side's colour. */
function radarImage(size: number, stroke: string): ImageData | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const c = size / 2
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1.5, size / 14)
  ctx.lineCap = 'round'
  // The dish: an arc open to the upper right.
  ctx.beginPath()
  ctx.arc(c, c, size * 0.32, Math.PI * 0.95, Math.PI * 1.55)
  ctx.stroke()
  // The beam: two shorter arcs beyond it.
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.arc(c, c, size * 0.44, Math.PI * 1.1, Math.PI * 1.4)
  ctx.stroke()
  ctx.globalAlpha = 1
  // The stem and the feed.
  ctx.beginPath()
  ctx.moveTo(c, c)
  ctx.lineTo(c, size * 0.86)
  ctx.moveTo(c - size * 0.16, size * 0.86)
  ctx.lineTo(c + size * 0.16, size * 0.86)
  ctx.stroke()
  ctx.fillStyle = stroke
  ctx.beginPath()
  ctx.arc(c, c, size * 0.07, 0, Math.PI * 2)
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

function coverageFeatures(e: Epoch, ids: Set<string> | 'all') {
  return {
    type: 'FeatureCollection' as const,
    features: e.sites
      .filter((s) => s.coverage && (ids === 'all' || ids.has(s.id)))
      .map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [sectorRing([s.lon, s.lat], s.coverage!.bearingDeg, s.coverage!.widthDeg, s.coverage!.rangeKm * 1_000).map((p) => [p[0], p[1]])] },
        properties: { id: s.id, side: s.side },
      })),
  }
}

function radarFeatures(e: Epoch) {
  return {
    type: 'FeatureCollection' as const,
    features: e.sites
      .filter((s) => s.coverage)
      .map((s) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] }, properties: { id: s.id, side: s.side } })),
  }
}

function features(e: Epoch) {
  return {
    type: 'FeatureCollection' as const,
    features: e.sites.filter((s) => !s.coverage).map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
      properties: { id: s.id, side: s.side, kind: s.kind, weapons: s.weapons, radius: 4 + Math.sqrt(Math.max(0, s.weapons)) * 1.1, evidence: s.evidence },
    })),
  }
}

export function PostureAtlas() {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [shown, setShown] = useState<Set<string> | 'all'>(new Set())
  const shownRef = useRef<Set<string> | 'all'>(shown)
  const epoch = EPOCHS[index]
  const selected = useMemo(() => epoch.sites.find((s) => s.id === selectedId) ?? null, [epoch, selectedId])

  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center: [-30, 50], zoom: 1.6 })
    mapRef.current = map
    let sync: ((force?: boolean) => void) | null = null
    map.on('load', () => {
      sync = installTerrainSync(map)
      map.addSource(SOURCE_ID, { type: 'geojson', data: features(EPOCHS[0]) })
      map.addLayer({
        id: 'posture-glow',
        type: 'circle',
        source: SOURCE_ID,
        paint: { 'circle-radius': ['*', ['get', 'radius'], 1.8], 'circle-color': ['match', ['get', 'side'], 'us', 'rgba(141, 250, 255, 0.10)', 'rgba(255, 96, 96, 0.10)'], 'circle-blur': 1 },
      })
      map.addLayer({
        id: 'posture-discs',
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['match', ['get', 'side'], 'us', 'rgba(141, 250, 255, 0.28)', 'rgba(255, 96, 96, 0.28)'],
          'circle-stroke-color': ['match', ['get', 'side'], 'us', 'rgba(141, 250, 255, 0.95)', 'rgba(255, 96, 96, 0.95)'],
          'circle-stroke-width': ['case', ['==', ['get', 'evidence'], 'documented'], 1.6, 1],
        },
      })
      // Coverage fans beneath the discs, the radar glyphs above them.
      map.addSource(COVERAGE_ID, { type: 'geojson', data: coverageFeatures(EPOCHS[0], new Set()) })
      map.addLayer(
        {
          id: 'posture-coverage-fill',
          type: 'fill',
          source: COVERAGE_ID,
          paint: { 'fill-color': ['match', ['get', 'side'], 'us', 'rgba(141, 250, 255, 0.10)', 'rgba(255, 96, 96, 0.10)'] },
        },
        'posture-glow',
      )
      map.addLayer(
        {
          id: 'posture-coverage-line',
          type: 'line',
          source: COVERAGE_ID,
          paint: { 'line-color': ['match', ['get', 'side'], 'us', 'rgba(141, 250, 255, 0.5)', 'rgba(255, 96, 96, 0.5)'], 'line-width': 1, 'line-dasharray': [2, 3] },
        },
        'posture-glow',
      )
      map.addSource(RADAR_ID, { type: 'geojson', data: radarFeatures(EPOCHS[0]) })
      const usGlyph = radarImage(40, 'rgb(141, 250, 255)')
      const suGlyph = radarImage(40, 'rgb(255, 96, 96)')
      if (usGlyph) map.addImage('radar-us', usGlyph, { pixelRatio: 2 })
      if (suGlyph) map.addImage('radar-su', suGlyph, { pixelRatio: 2 })
      map.addLayer({
        id: 'posture-radars',
        type: 'symbol',
        source: RADAR_ID,
        layout: { 'icon-image': ['case', ['==', ['get', 'side'], 'us'], 'radar-us', 'radar-su'], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': 0.9 },
      })
      map.on('click', 'posture-discs', (ev: MapMouseEvent & { features?: Array<{ properties: Record<string, unknown> }> }) => {
        const id = ev.features?.[0]?.properties?.id
        if (typeof id === 'string') setSelectedId(id)
      })
      map.on('click', 'posture-radars', (ev: MapMouseEvent & { features?: Array<{ properties: Record<string, unknown> }> }) => {
        const id = ev.features?.[0]?.properties?.id
        if (typeof id !== 'string') return
        setSelectedId(id)
        setShown((prev) => {
          const next = prev === 'all' ? new Set<string>() : new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      })
      map.on('mouseenter', 'posture-radars', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'posture-radars', () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('mouseenter', 'posture-discs', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'posture-discs', () => {
        map.getCanvas().style.cursor = ''
      })
      setReady(true)
    })
    return () => {
      sync?.(true)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    ;(map?.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(features(epoch))
    ;(map?.getSource(RADAR_ID) as GeoJSONSource | undefined)?.setData(radarFeatures(epoch))
  }, [epoch, ready])
  useEffect(() => {
    shownRef.current = shown
    if (!ready) return
    ;(mapRef.current?.getSource(COVERAGE_ID) as GeoJSONSource | undefined)?.setData(coverageFeatures(epoch, shown))
  }, [shown, epoch, ready])
  const pick = (i: number) => {
    setIndex(i)
    setSelectedId(null)
    setShown(new Set())
  }
  const radars = epoch.sites.filter((s) => s.coverage).length

  const sides = Object.entries(epoch.sides)
  return (
    <div className="study posture">
      <div ref={container} className="atlas-map" aria-label="Posture atlas" />
      <div className="atlas-vignette" aria-hidden="true" />
      <div className="study-hud lab-hud posture-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas · Chronicle</span>
          <strong>POSTURE · {epoch.label.toUpperCase()}</strong>
          <span>The forces where they stood · {epoch.scope === 'theatre' ? 'a theatre picture, not comparable with the strategic epochs' : 'the strategic forces'}</span>
        </header>

        <section className="clock" aria-label="Epoch">
          <h2>Epoch</h2>
          <div className="clock-time">{epoch.year}</div>
          <input type="range" min={0} max={EPOCHS.length - 1} step={1} value={index} aria-label="Epoch" onChange={(ev) => pick(Number(ev.target.value))} />
          <div className="clock-controls clock-controls--variants" role="group" aria-label="Epochs">
            {EPOCHS.map((e, i) => (
              <button key={e.year} type="button" className={i === index ? 'is-active' : ''} onClick={() => pick(i)}>
                {e.year}
              </button>
            ))}
          </div>
          {radars > 0 && (
            <div className="clock-controls" role="group" aria-label="Radar coverage">
              <span className="clock-label">Radars</span>
              <button type="button" className={shown === 'all' ? 'is-active' : ''} onClick={() => setShown((prev) => (prev === 'all' ? new Set<string>() : 'all'))}>
                {shown === 'all' ? 'Hide coverage' : `Show all ${radars}`}
              </button>
            </div>
          )}
          <p className="log-empty">
            Disc area is the weapons counted at the site, by the rules of the study or the table that built the epoch.{' '}
            {epoch.study ? <a href={epoch.study}>Open {epoch.studyName}</a> : 'No study stands on this epoch: it is the start of the drawdown, drawn from the Notebook\'s end-of-year tables.'}
            {epoch.caveat ? ` ${epoch.caveat}.` : ''}
          </p>
        </section>

        <section className="log posture-totals" aria-label="Totals">
          <h2>Weapons by side</h2>
          <table className="bands">
            <thead>
              <tr>
                <th>Side</th>
                <th>Sites</th>
                <th>Weapons</th>
                <th>By kind</th>
              </tr>
            </thead>
            <tbody>
              {sides.map(([id, name]) => {
                const t = epoch.totals[id]
                if (!t) return null
                return (
                  <tr key={id} className={id === 'us' ? '' : 'is-fire'}>
                    <td>{name}</td>
                    <td>{fmt(t.sites)}</td>
                    <td>{fmt(t.weapons)}</td>
                    <td>
                      {Object.entries(t.byKind)
                        .filter(([, w]) => w > 0)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, w]) => `${KIND_LABEL[k] ?? k} ${fmt(w)}`)
                        .join(' · ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section className="provenance" aria-label="Selected site">
          <h2>Site</h2>
          {selected ? (
            <>
              <p className="provenance-designation">
                {selected.name} <span className={`badge badge--${selected.evidence}`}>{selected.evidence.toUpperCase()}</span>
              </p>
              <p className="provenance-source">
                {KIND_LABEL[selected.kind] ?? selected.kind} · {fmt(selected.weapons)} weapons{selected.vehicles ? ` · ${fmt(selected.vehicles)} ${selected.unit ?? ''}` : ''} · position {selected.positionEvidence}
              </p>
              {selected.note && <p className="provenance-method">{selected.note}</p>}
              {selected.coverage && (
                <p className="provenance-method">
                  Field of view: {selected.coverage.widthDeg >= 360 ? 'all round' : `${selected.coverage.widthDeg}° centred on ${String(selected.coverage.bearingDeg).padStart(3, '0')}°`}, to about {selected.coverage.rangeKm.toLocaleString('en-GB')} km <span className={`badge badge--${selected.coverage.evidence}`}>{selected.coverage.evidence.toUpperCase()}</span>. {selected.coverage.note}. Click the glyph to show or hide it; the fan is the horizon the radar watches, drawn on the ground, not the volume it sees.
                </p>
              )}
              <p className="provenance-source">{formatProvenance({ source: selected.source })}</p>
            </>
          ) : (
            <p className="log-empty">Select a disc, or a radar glyph to lay its coverage on the map. Every site keeps the tier and the source its study gave it.</p>
          )}
          <details className="sources">
            <summary>Sources and methods</summary>
            <p className="provenance-method">{POSTURE.note}</p>
            <p className="provenance-method">Built by `scripts/build-posture-epochs.py` from the orders of battle: 1956 from the Databook's fleet totals over the wings the unit lists name, 1961 from the SIOP//62 study (unit lists, Sagan for the Soviet totals), 1962 from Norris and Kristensen's Cuban order of battle, 1973 from the DEFCON 3 study's unit histories and the Databook, 1983 from the Able Archer study's theatre forces, 1991 from the Nuclear Notebook's end-of-year tables spread over the wings and divisions the unit histories name, 2024 from the Nuclear Notebook. The gaps between epochs are the chronicle's own work still to do.</p>
          </details>
        </section>
      </div>
    </div>
  )
}
