import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
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
const fmt = (v: number) => v.toLocaleString('en-GB')
const KIND_LABEL: Record<string, string> = { icbm: 'ICBM', irbm: 'IRBM / MRBM', slbm: 'Boats at sea', 'slbm-port': 'Boats in port', bomber: 'Aircraft', cruise: 'Cruise missiles', tactical: 'Tactical', command: 'Command', sensor: 'Warning', interceptor: 'Interceptors', carrier: 'Carriers', base: 'Bases', beach: 'Beaches' }

function features(e: Epoch) {
  return {
    type: 'FeatureCollection' as const,
    features: e.sites.map((s) => ({
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
      map.on('click', 'posture-discs', (ev: MapMouseEvent & { features?: Array<{ properties: Record<string, unknown> }> }) => {
        const id = ev.features?.[0]?.properties?.id
        if (typeof id === 'string') setSelectedId(id)
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
    const source = mapRef.current?.getSource(SOURCE_ID) as GeoJSONSource | undefined
    source?.setData(features(epoch))
  }, [epoch, ready])
  const pick = (i: number) => {
    setIndex(i)
    setSelectedId(null)
  }

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
              <p className="provenance-source">{formatProvenance({ source: selected.source })}</p>
            </>
          ) : (
            <p className="log-empty">Select a disc. Every site keeps the tier and the source its study gave it.</p>
          )}
          <details className="sources">
            <summary>Sources and methods</summary>
            <p className="provenance-method">{POSTURE.note}</p>
            <p className="provenance-method">Built by `scripts/build-posture-epochs.py` from the five orders of battle: 1961 from the SIOP//62 study (unit lists, Sagan for the Soviet totals), 1962 from Norris and Kristensen's Cuban order of battle, 1973 from the DEFCON 3 study's unit histories and the Databook, 1983 from the Able Archer study's theatre forces, 1991 from the Nuclear Notebook's end-of-year tables spread over the wings and divisions the unit histories name, 2024 from the Nuclear Notebook. The gaps between epochs are the chronicle's own work still to do.</p>
          </details>
        </section>
      </div>
    </div>
  )
}
