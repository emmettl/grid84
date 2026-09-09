import type { Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, Polygon } from 'geojson'
import { formatGrid, type LngLat } from '../geo/geodesy.ts'
import { geodesicCircle } from '../geo/shapes.ts'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { installEvidenceLayers, setSourceData, SOURCES, type EvidenceFeature } from '../map/evidence-layers.ts'
import { applyBands, bandPopulations, bandsFor, CASUALTY_MODEL, FIRE_MODEL, outcome, overpressureRadiusForPsi, STRUCTURE_CLASSES, type Outcome, type BandExposure } from '../models/casualties.ts'
import { thirdDegreeBurnRadiusMetres } from '../models/blast.ts'
import { ExposureService, type GridSummary } from '../models/exposure-service.ts'
import type { ExposureResult } from '../models/exposure.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'
import { formatProvenance } from '../evidence/evidence.ts'
import { VALIDATION_CASES, type RecordedFigure, type ValidationCase } from '../models/validation-cases.ts'
import { planarEstimate, radiusComparisons } from '../models/validation.ts'

// Resolved against the page, because the worker would otherwise resolve a relative path against its own script URL.
const gridUrl = (name: string) => new URL(`${import.meta.env.BASE_URL}data/hyde/${name}`, document.baseURI).href
/** Grids live under data/hyde by default; an index entry may name another path under data/, such as the GHSL tiles. */
const entryUrl = (entry: GridIndexEntry) => (entry.path ? new URL(`${import.meta.env.BASE_URL}data/${entry.path}`, document.baseURI).href : gridUrl(entry.name))
const SPECIMEN_BASE = gridUrl('specimen')
interface GridIndexEntry {
  year: number
  name: string
  totalPopulation: number
  dataset: string
  /** Path under data/ for grids kept elsewhere than data/hyde, such as the GHSL tiles. */
  path?: string
  cellSize?: number
  tiled?: boolean
}
const YEAR_NOTES: Record<number, string> = {
  1940: 'nearest grid to Hiroshima and Nagasaki, 1945',
  1961: 'the SIOP-62 year',
  1962: 'the Cuban crisis',
  1983: 'Able Archer',
  2023: 'the contemporary case',
}

const YIELDS: Array<{ kt: number; label: string; note: string }> = [
  { kt: 15, label: '15 KT', note: 'Hiroshima class' },
  { kt: 350, label: '350 KT', note: 'B28 Y2' },
  { kt: 1_100, label: '1.1 MT', note: 'B28 Y1' },
  { kt: 1_440, label: '1.44 MT', note: 'W49 · Atlas, Thor, Jupiter' },
  { kt: 3_800, label: '3.8 MT', note: 'Mk-39' },
  { kt: 50_000, label: '50 MT', note: 'Tsar Bomba, 30 Oct 1961' },
]

/** Leningrad: 145 installations in the 1956 study, and the largest city near the Baltic. */
const DEFAULT_CENTER: LngLat = [30.32, 59.94]

function ringsFor(yieldKt: number, collapsePsi: number) {
  const scaled = bandsFor(collapsePsi)
  const bands = scaled.map((b) => ({ key: b.key, radius: overpressureRadiusForPsi(yieldKt, b.minPsi), label: b.label, band: b }))
  return { bands, scaled, fire: { key: 'fire', radius: thirdDegreeBurnRadiusMetres(yieldKt), label: 'FIRE ZONE' } }
}

const n = (v: number) => Math.round(v).toLocaleString('en-GB')
/** Two significant figures, because the inputs do not support more. */
const headline = (v: number) => {
  if (v < 10) return n(v)
  const magnitude = 10 ** (Math.floor(Math.log10(v)) - 1)
  return n(Math.round(v / magnitude) * magnitude)
}

export function PopulationLab() {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const service = useRef<ExposureService | null>(null)
  const [center, setCenter] = useState<LngLat>(DEFAULT_CENTER)
  const [yieldKt, setYieldKt] = useState(1_440)
  const [year, setYear] = useState(1961)
  const [validation, setValidation] = useState<ValidationCase | null>(null)
  const [collapsePsi, setCollapsePsi] = useState(5)
  const [years, setYears] = useState<GridIndexEntry[]>([{ year: 1961, name: 'popc_1961', totalPopulation: 0, dataset: 'HYDE 3.3' }])
  const entry = years.find((y) => y.year === year) ?? { year, name: `popc_${year}`, totalPopulation: 0, dataset: 'HYDE 3.3' }
  const base = entryUrl(entry)

  useEffect(() => {
    fetch(gridUrl('index.json'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((index: { grids: GridIndexEntry[] }) => setYears(index.grids))
      .catch(() => undefined)
  }, [])
  const [grid, setGrid] = useState<{ status: 'loading' | 'ready' | 'specimen' | 'missing'; summary?: GridSummary; error?: string }>({ status: 'loading' })
  const [result, setResult] = useState<{ exposure: ExposureResult; bands: BandExposure[]; outcome: Outcome; fireZone: number } | null>(null)
  const [ready, setReady] = useState(false)

  const rings = useMemo(() => ringsFor(yieldKt, collapsePsi), [yieldKt, collapsePsi])

  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center, zoom: 8.6 })
    mapRef.current = map
    map.on('load', () => {
      installTerrainSync(map)
      installEvidenceLayers(map)
      map.addSource('pop-cells', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer(
        {
          id: 'pop-cells',
          type: 'fill',
          source: 'pop-cells',
          paint: {
            'fill-color': ['interpolate', ['linear'], ['get', 'density'], 0, 'rgba(255, 179, 71, 0)', 50, 'rgba(255, 179, 71, 0.18)', 1_000, 'rgba(255, 179, 71, 0.45)', 10_000, 'rgba(255, 96, 96, 0.7)'],
            'fill-outline-color': 'rgba(255, 179, 71, 0.25)',
          },
        },
        'ev-areas-fill',
      )
      setReady(true)
    })
    map.on('click', (event) => setCenter([event.lngLat.lng, event.lngLat.lat]))
    return () => {
      map.remove()
      mapRef.current = null
      setReady(false)
    }
    // The map is created once; centre changes move rings, not the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    const tryLoad = async (base: string, status: 'ready' | 'specimen') => {
      const svc = new ExposureService(base, 1)
      const summary = await svc.load()
      if (cancelled) {
        svc.destroy()
        return false
      }
      service.current = svc
      setGrid({ status, summary })
      return true
    }
    setGrid({ status: 'loading' })
    setResult(null)
    ;(async () => {
      try {
        await tryLoad(base, 'ready')
      } catch (first) {
        try {
          await tryLoad(SPECIMEN_BASE, 'specimen')
        } catch (second) {
          if (!cancelled) setGrid({ status: 'missing', error: `${(first as Error).message}; ${(second as Error).message}` })
        }
      }
    })()
    return () => {
      cancelled = true
      service.current?.destroy()
      service.current = null
    }
  }, [base])

  // Draw rings and the population cells whenever the centre or yield changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const ringFeatures: EvidenceFeature[] = rings.bands.map((r) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: geodesicCircle(center, r.radius).map((p) => [p[0], p[1]]) },
      properties: { evidence: 'modelled', id: r.key },
    }))
    ringFeatures.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: geodesicCircle(center, rings.fire.radius).map((p) => [p[0], p[1]]) },
      properties: { evidence: 'inferred', id: 'fire' },
    })
    setSourceData(map, SOURCES.rings, ringFeatures)
    setSourceData(map, SOURCES.sites, [{ type: 'Feature', geometry: { type: 'Point', coordinates: [center[0], center[1]] }, properties: { evidence: 'modelled', id: 'gz' } }])
  }, [center, rings, ready])

  // Compute exposure off the render thread.
  useEffect(() => {
    const svc = service.current
    if (!svc || !ready) return
    let cancelled = false
    const outer = Math.max(rings.fire.radius, rings.bands[rings.bands.length - 1].radius)
    const request = {
      center,
      rings: [...rings.bands.map((r) => ({ key: r.key, radius: r.radius })), { key: 'fire', radius: rings.fire.radius }],
      subsamples: 4,
    }
    svc
      .exposure(request)
      .then((exposureResult) => {
        if (cancelled) return
        const bands = applyBands(bandPopulations(exposureResult.within, rings.scaled), rings.scaled)
        const fireZone = exposureResult.within.fire ?? 0
        setResult({ exposure: exposureResult, bands, outcome: outcome(bands, fireZone), fireZone })
        void drawCells(mapRef.current, svc, center, outer * 1.4)
      })
      .catch(() => {
        if (!cancelled) setResult(null)
      })
    return () => {
      cancelled = true
    }
  }, [center, rings, ready, grid.status])

  const cellDeg = grid.summary?.cellSize ?? 5 / 60
  const cellKm = grid.summary ? `${(cellDeg * 111.32 * Math.cos((center[1] * Math.PI) / 180)).toFixed(cellDeg < 0.02 ? 2 : 1)} × ${(cellDeg * 111.32).toFixed(cellDeg < 0.02 ? 2 : 1)} km` : '—'

  return (
    <div className="study">
      <div ref={container} className="atlas-map" aria-label="Population exposure lab" />
      <div className="atlas-vignette" aria-hidden="true" />
      <div className="study-hud lab-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>LAB · POPULATION EXPOSURE</strong>
          <span>Click the ground to move ground zero · HYDE 3.3 by year, GHSL for the present</span>
        </header>

        <section className="clock" aria-label="Weapon">
          <h2>Yield</h2>
          <div className="clock-controls">
            {YIELDS.map((y) => (
              <button key={y.kt} type="button" className={yieldKt === y.kt ? 'is-active' : ''} title={y.note} onClick={() => setYieldKt(y.kt)}>
                {y.label}
              </button>
            ))}
          </div>
          <p className="log-empty">{YIELDS.find((y) => y.kt === yieldKt)?.note} · optimum-height air burst · planar ground</p>
          <p className="log-empty">Ground zero {formatGrid(center)}</p>
          <h2>Year</h2>
          <div className="clock-controls">
            {years.map((y) => (
              <button key={y.name} type="button" className={year === y.year ? 'is-active' : ''} title={`${y.dataset}${y.cellSize && y.cellSize < 0.02 ? ' · 30 arc seconds' : ''} · ${YEAR_NOTES[y.year] ?? ''}`} onClick={() => setYear(y.year)}>
                {y.year}
              </button>
            ))}
          </div>
          <h2>
            Structure class <span className="badge badge--inferred">EXPLORATORY</span>
          </h2>
          <div className="clock-controls">
            {STRUCTURE_CLASSES.map((s) => (
              <button key={s.key} type="button" className={collapsePsi === s.collapsePsi ? 'is-active' : ''} title={s.source} onClick={() => setCollapsePsi(s.collapsePsi)}>
                {s.collapsePsi} psi
              </button>
            ))}
            <input type="range" min={1.5} max={12} step={0.5} value={collapsePsi} aria-label="Collapse pressure" onChange={(e) => setCollapsePsi(Number(e.target.value))} />
          </div>
          <p className="log-empty">
            Bands scaled to a collapse pressure of {collapsePsi} psi. {collapsePsi === 5 ? 'The OTA baseline, which already fits Hiroshima’s mortality by distance.' : 'Not calibrated: at Hiroshima this double counts, see VALIDATION.md.'}
          </p>
          <h2>Validation cases</h2>
          <div className="clock-controls">
            {VALIDATION_CASES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={validation?.id === c.id ? 'is-active' : ''}
                title={`${c.date} · ${c.yieldKt.note}`}
                onClick={() => {
                  setValidation(c)
                  setCenter(c.hypocentre)
                  setYieldKt(Math.round((c.yieldKt.low + c.yieldKt.high) / 2))
                  if (years.some((y) => y.year === 1940)) setYear(1940)
                  mapRef.current?.flyTo({ center: [c.hypocentre[0], c.hypocentre[1]], zoom: 11.5, pitch: 45, duration: 3_000, essential: true })
                }}
              >
                {c.name}
              </button>
            ))}
            {validation && (
              <button type="button" onClick={() => setValidation(null)}>
                Clear
              </button>
            )}
          </div>
        </section>

        <section className="log" aria-label="Grid">
          <h2>Grid</h2>
          {grid.status === 'loading' && <p className="log-empty">Loading population grid…</p>}
          {grid.status === 'missing' && (
            <p className="log-empty">
              <span className="badge badge--withheld">NOT PRESENT</span> No grid found. Download HYDE 3.3 <code>1961AD_pop.zip</code> and run <code>scripts/prepare-hyde-grid.py</code>.
              {grid.error && <><br />{grid.error}</>}
            </p>
          )}
          {grid.summary && (
            <dl className="grid-facts">
              <dt>Dataset</dt>
              <dd>
                {grid.summary.source.name}
                {grid.summary.source.year > 0 && ` · ${grid.summary.source.year}`}{' '}
                <span className={`badge badge--${grid.status === 'specimen' || /SPECIMEN/.test(grid.summary.source.name) ? 'withheld' : 'documented'}`}>{grid.status === 'specimen' || /SPECIMEN/.test(grid.summary.source.name) ? 'SPECIMEN' : 'DOCUMENTED'}</span>
              </dd>
              <dt>Licence</dt>
              <dd>{grid.summary.source.licence}</dd>
              <dt>World total</dt>
              <dd>{n(grid.summary.total)}</dd>
              <dt>Cell at this latitude</dt>
              <dd>{cellKm}</dd>
              {result && (
                <>
                  <dt>Cells visited</dt>
                  <dd>
                    {n(result.exposure.cellsVisited)} · {n(result.exposure.samples)} samples
                  </dd>
                </>
              )}
            </dl>
          )}
        </section>

        <section className="provenance" aria-label="Outcome">
          <h2>
            Outcome <span className="badge badge--modelled">MODELLED</span>
          </h2>
          {!result && <p className="log-empty">Waiting for the grid.</p>}
          {result && (
            <>
              <div className="two-numbers">
                <div>
                  <span>Blast only · 1961 method</span>
                  <strong>{headline(result.outcome.blast.fatal)}</strong>
                  <em>dead · {headline(result.outcome.blast.injured)} injured</em>
                </div>
                <div>
                  <span>With mass fire · Postol bound</span>
                  <strong>{headline(result.outcome.fire.fatal)}</strong>
                  <em>dead · everyone inside the fire zone</em>
                </div>
              </div>
              <table className="bands">
                <thead>
                  <tr>
                    <th>Band</th>
                    <th>Radius</th>
                    <th>People</th>
                    <th>Dead</th>
                    <th>Injured</th>
                  </tr>
                </thead>
                <tbody>
                  {result.bands.map((b) => (
                    <tr key={b.band.key}>
                      <td>{b.band.label}</td>
                      <td>{(rings.bands.find((r) => r.key === b.band.key)!.radius / 1_000).toFixed(1)} km</td>
                      <td>{n(b.population)}</td>
                      <td>{n(b.fatal)}</td>
                      <td>{n(b.injured)}</td>
                    </tr>
                  ))}
                  <tr className="is-fire">
                    <td>FIRE ZONE</td>
                    <td>{(rings.fire.radius / 1_000).toFixed(1)} km</td>
                    <td>{n(result.fireZone)}</td>
                    <td>{n(result.fireZone)}</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
              <p className="provenance-source">{CASUALTY_MODEL}</p>
              <p className="provenance-source">{FIRE_MODEL}</p>
              <p className="provenance-method">
                Headline figures are rounded to two significant figures. Uniform density within each cell is assumed; at this latitude a cell is {cellKm}{cellDeg > 0.02 ? ', comparable to the inner rings, so the inner bands carry the largest error' : ', finer than the inner rings'}. No terrain, weather, shielding, sheltering or time of day.
              </p>
            </>
          )}
        </section>

        {validation && <RecordedPanel c={validation} yieldKt={yieldKt} />}

        <section className="omissions" aria-label="Not represented">
          <h2>Not represented</h2>
          <ul>
            <li>Fallout and delayed deaths</li>
            <li>Evacuation, warning, or sheltering</li>
            <li>Terrain and building shielding; the planar model only</li>
            <li>Medical collapse: the injured are counted, not treated</li>
          </ul>
        </section>

        <EvidenceLegend />
      </div>
    </div>
  )
}

function Figure({ f }: { f: RecordedFigure }) {
  const value =
    f.unit === 'people'
      ? f.low === f.high
        ? n(f.low)
        : `${n(f.low)}–${n(f.high)}`
      : f.unit === 'metres'
        ? `${(f.low / 1_000).toFixed(2)} km`
        : f.unit === 'km2'
          ? `${f.low.toFixed(1)} km²`
          : `${f.low}–${f.high} kt`
  return (
    <div className={`fact fact--${f.evidence}`} title={`${formatProvenance(f.provenance)}${f.note ? ` · ${f.note}` : ''}`}>
      <dt>
        {f.label} <span className={`badge badge--${f.evidence}`}>{f.provenance.source.split(',')[0]}</span>
      </dt>
      <dd>
        {value}
        {f.note && <span className="fact-note"> · {f.note}</span>}
      </dd>
    </div>
  )
}

/** The recorded outcome beside the model, for Hiroshima and Nagasaki. */
function RecordedPanel({ c, yieldKt }: { c: ValidationCase; yieldKt: number }) {
  const radii = radiusComparisons(c, yieldKt)
  const planar = c.population.map((p) => ({ p, e: planarEstimate(c, (p.low + p.high) / 2, yieldKt) }))
  return (
    <section className="provenance recorded" aria-label="Recorded outcome">
      <h2>
        {c.name} · {c.date} <span className="badge badge--documented">RECORDED</span>
      </h2>
      <dl>
        <Figure f={c.yieldKt} />
        <Figure f={c.burstHeightMetres} />
        {c.population.map((f, i) => (
          <Figure key={`p${i}`} f={f} />
        ))}
        {c.dead.map((f, i) => (
          <Figure key={`d${i}`} f={f} />
        ))}
        {c.injured.map((f, i) => (
          <Figure key={`i${i}`} f={f} />
        ))}
      </dl>
      <h2>Model radii against the record</h2>
      <table className="bands">
        <tbody>
          {radii.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{(r.modelMetres / 1_000).toFixed(2)} km</td>
              <td>{(r.recordedMetres / 1_000).toFixed(2)} km</td>
              <td className={Math.abs(r.ratio - 1) > 0.25 ? 'is-fire' : ''}>×{r.ratio.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Planners’ method with the survey’s density</h2>
      <table className="bands">
        <thead>
          <tr>
            <th>Population</th>
            <th>Blast dead</th>
            <th>Injured</th>
            <th>Fire bound</th>
          </tr>
        </thead>
        <tbody>
          {planar.map(({ p, e }) =>
            e ? (
              <tr key={p.provenance.source}>
                <td>{p.provenance.source.split(',')[0]}</td>
                <td>{n(e.blastDead)}</td>
                <td>{n(e.blastInjured)}</td>
                <td>{n(e.fireDead)}</td>
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
      <p className="provenance-method">{c.builtUp?.note}</p>
      {c.terrainNote && <p className="provenance-method">{c.terrainNote.text}</p>}
      <p className="provenance-method">The HYDE grid above cannot resolve a city at this scale: its cells are wider than the blast radii. The rows here use the survey’s own built-up density as a disc about the hypocentre, which is the planners’ arithmetic with the planners’ inputs.</p>
    </section>
  )
}

/** Draw the populated cells around the target as faint fills, so the exposure sum is visibly a sum over cells. */
async function drawCells(map: MapLibreMap | null, svc: ExposureService, center: LngLat, radius: number) {
  if (!map) return
  const dLat = radius / 111_320
  const dLon = radius / (111_320 * Math.max(0.05, Math.cos((center[1] * Math.PI) / 180)))
  const cells = await svc.cells({ west: center[0] - dLon, south: center[1] - dLat, east: center[0] + dLon, north: center[1] + dLat })
  const features: Feature<Polygon, { density: number; count: number }>[] = cells.map(([w, s, e, nn, count]) => {
    const areaKm2 = (e - w) * 111.32 * Math.cos((((s + nn) / 2) * Math.PI) / 180) * (nn - s) * 111.32
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, nn], [w, nn], [w, s]]] },
      properties: { density: count / Math.max(areaKm2, 1e-6), count },
    }
  })
  ;(map.getSource('pop-cells') as { setData?: (d: unknown) => void } | undefined)?.setData?.({ type: 'FeatureCollection', features })
}
