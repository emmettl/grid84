import type { Map as MapLibreMap } from 'maplibre-gl'
import { fetchWindAloft } from '../atlas/wind.ts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatGrid, type LngLat } from '../geo/geodesy.ts'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { installEvidenceLayers, setSourceData, SOURCES, type EvidenceFeature } from '../map/evidence-layers.ts'
import { ExposureService, type GridSummary } from '../models/exposure-service.ts'
import { acuteMortality, FALLOUT_MODEL, plume } from '../models/fallout.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'

const gridUrl = (name: string) => new URL(`${import.meta.env.BASE_URL}data/hyde/${name}`, document.baseURI).href

interface Preset {
  id: string
  name: string
  center: LngLat
  yieldKt: number
  fission: number
  year: number
  note: string
}

const PRESETS: Preset[] = [
  { id: 'anadyr', name: 'Anadyr · W49', center: [177.467, 64.733], yieldKt: 1_440, fission: 0.5, year: 1961, note: 'The SIOP//62 proof target as a contact surface burst; W49 fission fraction not published, 50% assumed' },
  { id: 'leningrad', name: 'Leningrad · Mk-39', center: [30.32, 59.94], yieldKt: 3_800, fission: 0.5, year: 1961, note: '1956 complex with 145 installations; Mk-39 3.8 Mt, fission fraction assumed' },
  { id: 'bravo', name: 'Castle Bravo', center: [165.27, 11.7], yieldKt: 15_000, fission: 0.67, year: 1950, note: '1 March 1954, Bikini; 15 Mt with about two thirds fission per Glasstone §9.104; Rongelap lay about 100 miles downwind' },
]

const YIELDS = [15, 350, 1_100, 1_440, 3_800, 15_000, 50_000]

const n = (v: number) => Math.round(v).toLocaleString('en-GB')
const headline = (v: number) => {
  if (v < 10) return n(v)
  const magnitude = 10 ** (Math.floor(Math.log10(v)) - 1)
  return n(Math.round(v / magnitude) * magnitude)
}

export function FalloutLab() {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const service = useRef<ExposureService | null>(null)
  const [preset, setPreset] = useState<Preset>(PRESETS[0])
  const [center, setCenter] = useState<LngLat>(PRESETS[0].center)
  const [yieldKt, setYieldKt] = useState(PRESETS[0].yieldKt)
  const [fission, setFission] = useState(PRESETS[0].fission)
  const [windMph, setWindMph] = useState(15)
  const [bearing, setBearing] = useState(90)
  const [shear, setShear] = useState(15)
  const [terrain, setTerrain] = useState(1)
  const [windNote, setWindNote] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [hours, setHours] = useState(96)
  const [year, setYear] = useState(PRESETS[0].year)
  const [grid, setGrid] = useState<{ status: 'loading' | 'ready' | 'missing'; summary?: GridSummary }>({ status: 'loading' })
  const [exposure, setExposure] = useState<Record<string, number> | null>(null)
  const [ready, setReady] = useState(false)

  const contours = useMemo(() => plume({ center, yieldKt, fissionFraction: fission, windMph, downwindBearingDeg: bearing, untilHours: hours, shearDeg: shear, terrainFactor: terrain }), [center, yieldKt, fission, windMph, bearing, hours, shear, terrain])

  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center, zoom: 7.2, pitch: 30 })
    mapRef.current = map
    map.on('load', () => {
      installTerrainSync(map)
      installEvidenceLayers(map)
      setReady(true)
    })
    map.on('click', (e) => {
      setPreset({ id: 'custom', name: 'Custom', center: [e.lngLat.lng, e.lngLat.lat], yieldKt, fission, year, note: 'Burst placed by hand' })
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
    let cancelled = false
    setGrid({ status: 'loading' })
    const svc = new ExposureService(gridUrl(`popc_${year}`), 1)
    svc
      .load()
      .then((summary) => {
        if (cancelled) return
        service.current = svc
        setGrid({ status: 'ready', summary })
      })
      .catch(() => {
        if (!cancelled) setGrid({ status: 'missing' })
      })
    return () => {
      cancelled = true
      svc.destroy()
      if (service.current === svc) service.current = null
    }
  }, [year])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const outward = [...contours].reverse()
    const areas: EvidenceFeature[] = outward.map((c) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [c.ring.map((p) => [p[0], p[1]])] }, properties: { evidence: 'modelled', id: c.key } }))
    const lines: EvidenceFeature[] = contours.map((c) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: c.ring.map((p) => [p[0], p[1]]) }, properties: { evidence: 'modelled', id: `${c.key}-line` } }))
    setSourceData(map, SOURCES.areas, areas)
    setSourceData(map, SOURCES.rings, lines)
    setSourceData(map, SOURCES.sites, [{ type: 'Feature', geometry: { type: 'Point', coordinates: [center[0], center[1]] }, properties: { evidence: 'modelled', id: 'gz' } }])
  }, [contours, center, ready])

  useEffect(() => {
    const svc = service.current
    if (!svc || grid.status !== 'ready') return
    let cancelled = false
    svc
      .polygons(contours.map((c) => ({ key: c.key, ring: c.ring })))
      .then((r) => {
        if (!cancelled) setExposure(r.within)
      })
      .catch(() => {
        if (!cancelled) setExposure(null)
      })
    return () => {
      cancelled = true
    }
  }, [contours, grid.status])

  const applyPreset = (p: Preset) => {
    setPreset(p)
    setCenter(p.center)
    setYieldKt(p.yieldKt)
    setFission(p.fission)
    setYear(p.year)
    mapRef.current?.flyTo({ center: [p.center[0], p.center[1]], zoom: p.yieldKt > 5_000 ? 6 : 7.2, pitch: 30, duration: 3_000, essential: true })
  }

  // Deaths: population in each annulus between contours, at that annulus's mid-plume dose.
  const rows = contours.map((c, i) => {
    const inner = i > 0 ? (exposure?.[contours[i - 1].key] ?? 0) : 0
    const within = exposure?.[c.key] ?? 0
    const band = Math.max(0, within - inner)
    return { c, within, band, dead: band * c.mortalityMid }
  })
  const totalDead = rows.reduce((s, r) => s + r.dead, 0)
  const outer = rows[rows.length - 1]

  return (
    <div className="study">
      <div ref={container} className="atlas-map" aria-label="Fallout lab" />
      <div className="atlas-vignette" aria-hidden="true" />
      <div className="study-hud lab-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>LAB · FALLOUT PLUME</strong>
          <span>Contact surface burst · idealized early fallout under a chosen wind</span>
        </header>

        <section className="clock" aria-label="Burst and wind">
          <h2>Case</h2>
          <div className="clock-controls">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={preset.id === p.id ? 'is-active' : ''} title={p.note} onClick={() => applyPreset(p)}>
                {p.name}
              </button>
            ))}
          </div>
          <p className="log-empty">{preset.note}</p>
          <p className="log-empty">Ground zero {formatGrid(center)} · click the ground to move it</p>
          <h2>Yield</h2>
          <div className="clock-controls">
            {YIELDS.map((y) => (
              <button key={y} type="button" className={yieldKt === y ? 'is-active' : ''} onClick={() => setYieldKt(y)}>
                {y >= 1_000 ? `${y / 1_000} MT` : `${y} KT`}
              </button>
            ))}
          </div>
          <h2>
            Fission fraction {Math.round(fission * 100)}% <span className="badge badge--inferred">ASSUMED</span>
          </h2>
          <input type="range" min={0.1} max={1} step={0.05} value={fission} aria-label="Fission fraction" onChange={(e) => setFission(Number(e.target.value))} />
          <h2>
            Wind {windMph} mph towards {String(bearing).padStart(3, '0')}° <span className="badge badge--inferred">CHOSEN</span>
          </h2>
          <input type="range" min={5} max={45} step={1} value={windMph} aria-label="Effective wind speed" onChange={(e) => setWindMph(Number(e.target.value))} />
          <input type="range" min={0} max={359} step={1} value={bearing} aria-label="Downwind bearing" onChange={(e) => setBearing(Number(e.target.value))} />
          <div className="clock-controls">
            <button
              type="button"
              disabled={fetching}
              title="Open-Meteo's forecast at 850, 700 and 500 hPa over the next twelve hours, vector-averaged, its spread as shear"
              onClick={() => {
                setFetching(true)
                fetchWindAloft(center)
                  .then((w) => {
                    setWindMph(Math.max(5, Math.min(45, Math.round(w.mph))))
                    setBearing(Math.round((w.fromDeg + 180) % 360))
                    setShear(Math.round(w.shearDeg))
                    setWindNote(w.live ? `${w.source}: from ${Math.round(w.fromDeg)}° at ${Math.round(w.mph)} mph, shear ${Math.round(w.shearDeg)}°` : w.source)
                  })
                  .finally(() => setFetching(false))
              }}
            >
              {fetching ? 'Fetching the wind aloft…' : 'The wind aloft now'}
            </button>
          </div>
          {windNote && <p className="log-empty">{windNote}</p>}
          <h2>
            Shear {shear}° <span className="badge badge--modelled">MODELLED</span>
          </h2>
          <input type="range" min={15} max={90} step={1} value={shear} aria-label="Directional shear of the carrying winds" onChange={(e) => setShear(Number(e.target.value))} />
          <h2>
            Surface factor {terrain.toFixed(2)} <span className="badge badge--documented">§9.95</span>
          </h2>
          <input type="range" min={0.5} max={1} step={0.05} value={terrain} aria-label="Fraction of the idealized dose rate a real surface gives" onChange={(e) => setTerrain(Number(e.target.value))} />
          <h2>Dose accumulated to H+{hours} h</h2>
          <input type="range" min={1} max={336} step={1} value={hours} aria-label="Hours after burst" onChange={(e) => setHours(Number(e.target.value))} />
        </section>

        <section className="log" aria-label="Grid">
          <h2>Population</h2>
          {grid.status === 'loading' && <p className="log-empty">Loading population grid…</p>}
          {grid.status === 'missing' && <p className="log-empty">No grid for {year}.</p>}
          {grid.summary && (
            <dl className="grid-facts">
              <dt>Dataset</dt>
              <dd>
                {grid.summary.source.name} · {grid.summary.source.year} <span className="badge badge--documented">DOCUMENTED</span>
              </dd>
              <dt>Under the 1 rad/hr contour</dt>
              <dd>{exposure ? n(outer.within) : '…'}</dd>
              <dt>Acute deaths, no shelter</dt>
              <dd>
                {exposure ? headline(totalDead) : '…'} <span className="badge badge--inferred">INFERRED</span>
              </dd>
            </dl>
          )}
          <p className="log-empty">Deaths take each band at its mid-plume dose from arrival to H+{hours} h and Table 12.108 mortality, with everyone outdoors on a smooth plane. Real surfaces give 0.7 of the dose in the open and 0.5 to 0.6 in rough terrain; any shelter, less.</p>
        </section>

        <section className="provenance" aria-label="Contours">
          <h2>
            Unit-time contours <span className="badge badge--modelled">MODELLED</span>
          </h2>
          <table className="bands">
            <thead>
              <tr>
                <th>H+1 rads/hr</th>
                <th>Downwind</th>
                <th>Width</th>
                <th>Arrives</th>
                <th>Dose to H+{hours}</th>
                <th>People</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, band }) => (
                <tr key={c.key}>
                  <td>{n(c.radsPerHour)}</td>
                  <td>{(c.downwindMetres / 1_000).toFixed(0)} km</td>
                  <td>{(c.maxWidthMetres / 1_000).toFixed(1)} km</td>
                  <td>{c.arrivalMidHours < 1 ? `${Math.round(c.arrivalMidHours * 60)} min` : `${c.arrivalMidHours.toFixed(1)} h`}</td>
                  <td className={acuteMortality(c.doseMidRads) > 0 ? 'is-fire' : ''}>{n(c.doseMidRads)} rads</td>
                  <td>{exposure ? n(band) : '…'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="provenance-source">{FALLOUT_MODEL}</p>
          <p className="provenance-method">Table 9.93 gives each contour’s downwind distance, maximum width and ground-zero width as a·W^b for a 15 mph wind; §9.94 scales dose rates by the fission fraction; §9.97 scales distances by wind speed; dose accumulates as the integral of t^-1.2 from arrival. The cigar between those dimensions is a drawing convention for Fig. 9.93. Glasstone calls these idealized and says real patterns are irregular.</p>
        </section>

        <section className="omissions" aria-label="Not represented">
          <h2>Not represented</h2>
          <ul>
            <li>Real winds: shear, turning with height, weather; the pattern is a cigar under one wind</li>
            <li>Rain-out and terrain roughness; the smooth-plane values are upper values</li>
            <li>Shelter, evacuation, decontamination</li>
            <li>Air bursts: no significant early fallout (§9.48); the SIOP//62 proof assumed one</li>
            <li>Late effects: cancers, and doses after the chosen hour</li>
          </ul>
        </section>

        <EvidenceLegend />
      </div>
    </div>
  )
}
