import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { famine, FOOD, type LivestockPolicy, type WastePolicy } from '../models/famine.ts'
import { harvest } from '../models/harvest.ts'
import { ozoneColumn, ultraviolet, OZONE } from '../models/ozone.ts'
import { burnedAreaKm2, FUEL_LOADS, referenceFuel, SOOT_CASES, sootForFuel, SOOT_CHAIN } from '../models/soot.ts'
import { bandOf, injectionWeights, runWinter } from '../models/winter.ts'
import { impactPoints, impactSummary } from './impacts.ts'
import { report } from './report.ts'
import { bandPolygons, WORLD_POPULATION, ZONAL } from './zonal.ts'

/**
 * The years after. The globe turns, banded by how cold each latitude has
 * become; the column beside it follows the chain from the fires to the
 * famine, month by month, at about a month a second.
 *
 * Everything on the page comes out of the models. The controls are the
 * places where the published work itself is uncertain or where a decision
 * would be made: how much fuel a city holds, which is the whole argument
 * between Toon's group and Reisner's; and what the world does with its
 * animals, its waste and its ships, which is the argument Xia's paper
 * makes about whether a famine is survivable.
 */

const MONTHS = 180
const MONTH_MS = 620
const LOG_KEEP = 60

const pc = (v: number) => `${Math.round(v * 100)}%`
const people = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)} bn` : v >= 1e6 ? `${(v / 1e6).toFixed(0)} M` : Math.round(v).toLocaleString('en-GB'))

export function WinterView() {
  const container = useRef<HTMLDivElement>(null)
  const terminal = useRef<HTMLElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const logRef = useRef<HTMLOListElement>(null)
  const [caseId, setCaseId] = useState('global-150')
  const [fuel, setFuel] = useState<number | null>(null)
  const [livestock, setLivestock] = useState<LivestockPolicy>('partial')
  const [waste, setWaste] = useState<WastePolicy>('unchanged')
  const [trade, setTrade] = useState(false)
  const [month, setMonth] = useState(0)
  const [running, setRunning] = useState(true)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const sootCase = useMemo(() => SOOT_CASES.find((c) => c.id === caseId) ?? SOOT_CASES[SOOT_CASES.length - 1], [caseId])
  const fuelLoad = fuel ?? referenceFuel(sootCase)
  const sootTg = useMemo(() => sootForFuel(sootCase, fuelLoad), [sootCase, fuelLoad])
  const frames = useMemo(
    () => runWinter({ sootTg, injection: injectionWeights(ZONAL, sootCase.sources), zonal: ZONAL, months: MONTHS, startMonth: 4 }),
    [sootTg, sootCase],
  )
  const years = useMemo(() => harvest(frames, ZONAL), [frames])
  const hunger = useMemo(() => famine(years, ZONAL, { livestock, waste, trade }), [years, livestock, waste, trade])
  const lines = useMemo(() => report({ sootCase, fuelGPerCm2: fuelLoad, sootTg, frames, harvest: years, famine: hunger, population: WORLD_POPULATION }), [sootCase, fuelLoad, sootTg, frames, years, hunger])
  const shown = useMemo(() => lines.filter((l) => l.month <= month).slice(-LOG_KEEP), [lines, month])

  const frame = frames[Math.min(month, frames.length - 1)]
  const year = Math.max(1, Math.min(years.length, Math.ceil(month / 12)))
  const harvested = years[year - 1]
  const worst = useMemo(() => hunger.reduce((a, b) => (b.withoutFood > a.withoutFood ? b : a), hunger[0]), [hunger])
  const tropics = bandOf(ZONAL, 5)
  const impacts = useMemo(() => impactSummary(caseId), [caseId])

  // The globe, turning, with a band per ten degrees of latitude.
  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center: [20, 35], zoom: 1.5 })
    mapRef.current = map
    let sync: ((force?: boolean) => void) | null = null
    let spin = 0
    const pad = () => {
      const w = terminal.current?.getBoundingClientRect().width ?? 0
      const phone = window.innerWidth <= 700
      const top = phone ? Math.round(window.innerHeight * 0.42) : 0
      const left = phone ? 0 : Math.round(w + 32)
      map.setPadding({ top, left, right: 0, bottom: 0 })
      const diameter = Math.min(window.innerWidth - left, window.innerHeight - top) * 0.94
      map.setZoom(Math.max(1.2, Math.min(3.4, Math.log2((diameter * Math.PI) / 512))))
    }
    map.on('load', () => {
      sync = installTerrainSync(map)
      map.addSource('winter-bands', { type: 'geojson', data: bandPolygons() })
      // The cold, as a wash over the band; and the soot above it, which is what causes the cold.
      map.addLayer({
        id: 'winter-cold',
        type: 'fill',
        source: 'winter-bands',
        paint: {
          'fill-color': ['interpolate', ['linear'], ['get', 'anomaly'], -30, 'rgb(226, 232, 255)', -18, 'rgb(126, 168, 255)', -8, 'rgb(58, 108, 214)', -2, 'rgb(24, 52, 120)', 0, 'rgb(10, 20, 46)'],
          'fill-opacity': ['interpolate', ['linear'], ['get', 'anomaly'], -20, 0.6, -6, 0.42, -0.3, 0.12, 0, 0],
        },
      })
      map.addLayer({
        id: 'winter-soot',
        type: 'fill',
        source: 'winter-bands',
        paint: {
          'fill-color': 'rgb(28, 22, 18)',
          'fill-opacity': ['interpolate', ['linear'], ['get', 'tau'], 0, 0, 0.3, 0.18, 1.5, 0.5, 4, 0.72],
        },
      })
      // Where the weapons landed: white while the cities burn, an ember afterwards.
      map.addSource('winter-impacts', { type: 'geojson', data: impactPoints('global-150') })
      map.addLayer({
        id: 'winter-impacts-glow',
        type: 'circle',
        source: 'winter-impacts',
        paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 1, 3, 5, 9], 'circle-color': 'rgba(255, 214, 170, 0.5)', 'circle-blur': 1, 'circle-opacity': 0 },
      })
      map.addLayer({
        id: 'winter-impacts',
        type: 'circle',
        source: 'winter-impacts',
        paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 1, 1.1, 5, 3.4], 'circle-color': '#ffffff', 'circle-opacity': 0 },
      })
      pad()
      const turn = () => {
        if (!map.isMoving()) {
          const c = map.getCenter()
          map.jumpTo({ center: [c.lng + 0.018, c.lat] })
        }
        spin = requestAnimationFrame(turn)
      }
      spin = requestAnimationFrame(turn)
    })
    window.addEventListener('resize', pad)
    return () => {
      window.removeEventListener('resize', pad)
      cancelAnimationFrame(spin)
      sync?.(true)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // The bands take the state of the month on show.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !frame) return
    const source = map.getSource('winter-bands') as GeoJSONSource | undefined
    if (!source) return
    const data = bandPolygons()
    data.features.forEach((f, i) => {
      const land = ZONAL.bands[i].landKm2 / ZONAL.bands[i].areaKm2
      f.properties = { band: i, anomaly: frame.landAnomaly[i] * land + frame.seaAnomaly[i] * (1 - land), tau: frame.opticalDepth[i] }
    })
    source.setData(data)
  }, [frame])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource('winter-impacts') as GeoJSONSource | undefined
    if (source) source.setData(impactPoints(caseId))
  }, [caseId])

  // The marks are white while the cities are burning and a dull ember after.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('winter-impacts')) return
    const burning = Math.max(0, 1 - month / 3)
    map.setPaintProperty('winter-impacts', 'circle-opacity', 0.35 + 0.65 * burning)
    map.setPaintProperty('winter-impacts', 'circle-color', burning > 0.15 ? '#ffffff' : 'rgb(255, 206, 168)')
    map.setPaintProperty('winter-impacts-glow', 'circle-opacity', 0.15 + 0.85 * burning)
  }, [month])

  // The clock: about a month a second, and it stops at the end.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setMonth((m) => {
        if (m >= MONTHS) {
          setRunning(false)
          return m
        }
        return m + 1
      })
    }, MONTH_MS)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [shown.length])

  const restart = (next?: { caseId?: string; fuel?: number | null }) => {
    if (next?.caseId !== undefined) setCaseId(next.caseId)
    if (next?.fuel !== undefined) setFuel(next.fuel)
    setMonth(0)
    setRunning(true)
  }

  const uv = frame ? ultraviolet(sootTg, frame.month, frame.opticalDepth[tropics]) : OZONE.baselineIndex
  const famineDead = worst?.withoutFood ?? 0

  return (
    <div className="wopr winter">
      <div ref={container} className="atlas-map" aria-label="The world by latitude" />
      <div className="atlas-vignette" aria-hidden="true" />
      <section ref={terminal} className="wopr-terminal" aria-live="polite">
        <header className="wopr-head">
          <p className="wopr-line wopr-line--title">THE YEARS AFTER · WHAT FOLLOWS THE WEAPONS</p>
          <p className="wopr-line">
            {sootCase.label.toUpperCase()} · {sootCase.weapons.toLocaleString('en-GB')} × {sootCase.yieldKt} KT · {sootTg < 1 ? sootTg.toFixed(2) : sootTg.toFixed(0)} TG OF SOOT
          </p>
          <p className="wopr-line wopr-dim">
            {impacts.cities.toLocaleString('en-GB')} CITIES MARKED · {people(impacts.population)} IN THE CELLS THEMSELVES · {impacts.regions.join(', ').toUpperCase()}
          </p>
          <p className="wopr-line">
            MONTH {String(month).padStart(3, '0')} · YEAR {Math.floor(month / 12) + 1}
            {running && <span className="wopr-cursor" />}
          </p>
        </header>

        <div className="wopr-figure">
          <p className="wopr-line wopr-line--big">{people(famineDead)} WITHOUT FOOD</p>
          <table className="wopr-objectives winter-ledger">
            <tbody>
              <tr>
                <th scope="row">The weapons</th>
                <td>{people(sootCase.directFatalities)}</td>
                <td className="wopr-dim">blast, fire and the first fallout</td>
              </tr>
              <tr className="is-fire">
                <th scope="row">Without food</th>
                <td>{people(famineDead)}</td>
                <td className="wopr-dim">at the worst of it, {worst ? `year ${worst.year}` : ''}. Not a death toll: it is the number the food cannot keep alive, and there is nowhere else for it to come from</td>
              </tr>
              <tr>
                <th scope="row">Ratio</th>
                <td>{sootCase.directFatalities > 0 ? `${(famineDead / sootCase.directFatalities).toFixed(0)}×` : '—'}</td>
                <td className="wopr-dim">for every one the weapons kill</td>
              </tr>
            </tbody>
          </table>
          <p className="wopr-line wopr-dim">
            SURFACE {frame ? frame.globalAnomaly.toFixed(1) : '0.0'} K · LAND {frame ? frame.landAnomalyMean.toFixed(1) : '0.0'} K · SUN {frame ? pc(frame.sunlightMean) : '100%'} · RAIN {frame ? pc(frame.precipitation) : '100%'} · HARVEST {harvested ? pc(harvested.fraction) : '100%'} · OZONE {pc(ozoneColumn(sootTg, month))} · UV {uv.toFixed(0)}
          </p>
        </div>

        <ol ref={logRef} className="wopr-log" aria-label="The chain">
          {shown.map((l, i) => (
            <li key={`${l.month}-${i}`} className={`wopr-log-line wopr-log-line--${l.kind}${i === shown.length - 1 ? ' is-new' : ''}`}>
              <span className="wopr-log-at">{`Y${Math.floor(l.month / 12) + 1}M${String(l.month % 12).padStart(2, '0')}`}</span>
              <span className="wopr-log-text">{l.text}</span>
            </li>
          ))}
        </ol>

        <p className="wopr-note">
          A zonal energy-balance model over the HYDE grids, fitted to Robock 2007, Coupe 2019, Toon 2019, Xia 2022 and Bardeen 2021. It does not model the injured who die without hospitals, the water, the disease, the killing over what is left, or anything at all about how a society behaves when it is starving. Those are larger than what is counted here.
        </p>
      </section>

      <div className="wopr-controls winter-controls">
        <div className="wopr-group">
          <span className="wopr-dim">Exchange</span>
          {SOOT_CASES.map((c) => (
            <button key={c.id} type="button" className={c.id === caseId ? 'is-active' : ''} onClick={() => restart({ caseId: c.id, fuel: null })} title={`${c.note || c.source}`}>
              {c.sootTg} Tg
            </button>
          ))}
        </div>

        <div className="wopr-group winter-fuel">
          <span className="wopr-dim">Fuel in the cities · {fuelLoad.toFixed(1)} g/cm² over {Math.round(burnedAreaKm2(sootCase) / 1_000).toLocaleString('en-GB')} thousand km²</span>
          <input
            type="range"
            min={0.1}
            max={60}
            step={0.1}
            value={fuelLoad}
            aria-label="Areal fuel loading"
            onChange={(e) => {
              setFuel(Number(e.target.value))
              setMonth(0)
              setRunning(true)
            }}
          />
          <button type="button" className={fuel === null ? 'is-active' : ''} onClick={() => restart({ fuel: null })}>
            As published
          </button>
        </div>

        <div className="wopr-group">
          <span className="wopr-dim">Livestock</span>
          {(['business-as-usual', 'partial', 'none'] as LivestockPolicy[]).map((l) => (
            <button key={l} type="button" className={l === livestock ? 'is-active' : ''} onClick={() => setLivestock(l)}>
              {l === 'business-as-usual' ? 'Fed as now' : l === 'partial' ? 'Half the feed to people' : 'Eat the herds'}
            </button>
          ))}
        </div>

        <div className="wopr-group">
          <span className="wopr-dim">Waste</span>
          {(['unchanged', 'halved', 'eliminated'] as WastePolicy[]).map((w) => (
            <button key={w} type="button" className={w === waste ? 'is-active' : ''} onClick={() => setWaste(w)}>
              {w === 'unchanged' ? `${Math.round(FOOD.householdWaste * 100)}% thrown away` : w === 'halved' ? 'Halved' : 'None'}
            </button>
          ))}
          <button type="button" className={trade ? 'is-active' : ''} onClick={() => setTrade((t) => !t)}>
            {trade ? 'Food still crosses borders' : 'No trade'}
          </button>
        </div>

        <div className="wopr-group">
          <button type="button" className={running ? 'is-active' : ''} onClick={() => setRunning((r) => !r)}>
            {running ? 'Hold' : month >= MONTHS ? 'Again' : 'Run'}
          </button>
          <input type="range" min={0} max={MONTHS} value={month} aria-label="Month" onChange={(e) => { setMonth(Number(e.target.value)); setRunning(false) }} />
          <button type="button" onClick={() => restart()}>
            Restart
          </button>
          <button type="button" className={sourcesOpen ? 'is-active' : ''} onClick={() => setSourcesOpen((o) => !o)}>
            The argument
          </button>
          <a className="wopr-exit" href="#/">
            EXIT
          </a>
        </div>

        {sourcesOpen && (
          <div className="winter-argument">
            <p className="wopr-line wopr-line--title">HOW MUCH FUEL IS IN A CITY</p>
            <p className="wopr-line wopr-dim">
              Every number on this page hangs off this one, because below about {SOOT_CHAIN.firestormFuelGPerCm2} g/cm² a fire does not organise into a firestorm, and without a firestorm the smoke never gets above the weather. Move the slider and watch the soot.
            </p>
            <table className="wopr-objectives">
              <tbody>
                {FUEL_LOADS.map((f) => (
                  <tr key={f.label} className={Math.abs(f.gPerCm2 - fuelLoad) < 0.6 ? 'is-fire' : ''}>
                    <th scope="row">
                      <button type="button" className="winter-fuel-pick" onClick={() => restart({ fuel: f.gPerCm2 })}>
                        {f.label}
                      </button>
                    </th>
                    <td>{f.gPerCm2} g/cm²</td>
                    <td className="wopr-dim">{f.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="wopr-line wopr-dim">
              The National Academies reviewed all of it in 2025 and declined to say who was right, finding the fire models and the urban fuel surveys both inadequate. Hiroshima's own fuel loading is published at 3.9, at 10 and at 16 by three different authorities.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
