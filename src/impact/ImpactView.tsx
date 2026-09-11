import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { formatGrid, type LngLat } from '../geo/geodesy.ts'
import { geodesicCircle } from '../geo/shapes.ts'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { installEvidenceLayers, setSourceData, SOURCES, type EvidenceFeature } from '../map/evidence-layers.ts'
import { SYSTEMS } from '../models/lethality.ts'
import { attemptLabel, engage, RELIABILITY, rng, type Engagement, type RunOptions } from './run.ts'
import { CATEGORIES, targetsIn, type CategoryId } from './targets.ts'

/**
 * The terminal phase.
 *
 * The accuracy lab has the curves: a lethal radius, a circular error, and the
 * integral of one over the other. A curve does not make you feel a
 * probability. So this flies it — a real weapon at a real installation, the
 * camera down on the ground where you can see what the thing is, the warhead
 * landing where the distribution puts it, and the answer in the form the
 * answer actually takes, which is HIT or MISS.
 *
 * Fire enough of them and the tally goes to the lab's own number. That is the
 * point of having both: the single-shot kill probability is not a property of
 * a weapon, it is what happens when you keep firing.
 *
 * Nothing here is a target list. The cities and the airfields are the 1956 SAC
 * study's, which is the one released document of its kind; everything else is
 * a representative installation of its class, and the readout says so.
 */

const FLY_MS = 1_600
const SHOT_MS = 2_100
const HOLD_MS = 1_400
const LOG_KEEP = 60

const m = (v: number) => (v >= 10_000 ? `${(v / 1_000).toFixed(0)} km` : v >= 1_000 ? `${(v / 1_000).toFixed(1)} km` : `${Math.round(v)} m`)
const pct = (v: number) => `${(100 * v).toFixed(v < 0.1 ? 1 : 0)}%`
const kt = (v: number) => (v >= 1_000 ? `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)} MT` : `${v} KT`)

interface LogLine {
  id: number
  label: 'HIT' | 'MISS' | 'DUD'
  text: string
}

export function ImpactView() {
  const container = useRef<HTMLDivElement>(null)
  const terminal = useRef<HTMLElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const logRef = useRef<HTMLOListElement>(null)

  const [weaponId, setWeaponId] = useState<string | null>(null)
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [allowance, setAllowance] = useState(3)
  const [running, setRunning] = useState(true)
  const [current, setCurrent] = useState<Engagement | null>(null)
  const [shown, setShown] = useState(0)
  const [tally, setTally] = useState({ engagements: 0, destroyed: 0, warheads: 0, hits: 0, duds: 0 })
  const [lines, setLines] = useState<LogLine[]>([])

  const options: RunOptions = useMemo(() => ({ weaponId, category, allowance }), [weaponId, category, allowance])
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  /*
   * The draw is seeded, so a run can be repeated; the seed is new on each
   * visit and on each clear, so it is not the same run every time. Clearing
   * the tally changes the seed, which remounts the loop with a fresh walk.
   */
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6))
  const run = useRef({ gen: rng(seed), next: 1, index: 0 }).current

  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center: [37.62, 55.75], zoom: 11, pitch: 45 })
    mapRef.current = map
    let sync: ((force?: boolean) => void) | null = null
    const pad = () => {
      const width = terminal.current?.getBoundingClientRect().width ?? 0
      const phone = window.innerWidth <= 700
      map.setPadding({ top: phone ? Math.round(window.innerHeight * 0.46) : 0, left: phone ? 0 : Math.round(width + 32), right: 0, bottom: 0 })
    }
    map.on('load', () => {
      sync = installTerrainSync(map)
      installEvidenceLayers(map)
      pad()
    })
    window.addEventListener('resize', pad)
    return () => {
      window.removeEventListener('resize', pad)
      sync?.(true)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // The loop: fly to a target, spend warheads on it one at a time, move on.
  useEffect(() => {
    if (!running) return
    let timer = 0
    let cancelled = false

    /**
     * Frame the engagement rather than the place. What has to be legible is
     * the lethal radius against the spread of the misses, so the camera takes
     * whichever of the two is larger and puts about five of it across the
     * canvas — which is close enough to the ground to see runways at a
     * dockyard and far enough out to see a three-kilometre miss.
     */
    const frame = (e: Engagement) => {
      const map = mapRef.current
      if (!map) return
      const span = Math.max(e.attempts[0].lethalRadiusMetres, e.weapon.cepMetres, e.target.extentMetres / 2) * 5
      const width = map.getCanvas().clientWidth || 1_000
      const zoom = Math.max(4, Math.min(15, Math.log2((40_075_017 * Math.cos((e.target.position[1] * Math.PI) / 180) * width) / (512 * span))))
      map.flyTo({ center: [e.target.position[0], e.target.position[1]], zoom, pitch: 45, duration: FLY_MS, essential: true })
    }

    const draw = (e: Engagement, upTo: number) => {
      const map = mapRef.current
      if (!map) return
      const ring = (centre: LngLat, metres: number) => geodesicCircle(centre, metres).map((p) => [p[0], p[1]])
      const landed = e.attempts.slice(0, upTo)
      const rings: EvidenceFeature[] = [
        // The circular error, around the aim point: the promise the weapon makes.
        { type: 'Feature', geometry: { type: 'LineString', coordinates: ring(e.target.position, e.weapon.cepMetres) }, properties: { evidence: 'inferred', id: 'cep' } },
        ...landed.map((a, i) => ({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: ring(a.impact, a.lethalRadiusMetres) },
          properties: { evidence: 'modelled' as const, id: `lethal-${i}`, ...(i < landed.length - 1 ? { aggregate: true } : {}) },
        })),
      ]
      setSourceData(map, SOURCES.rings, rings)
      setSourceData(map, SOURCES.sites, [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [e.target.position[0], e.target.position[1]] }, properties: { evidence: 'documented', id: 'aim' } },
        ...landed.map((a, i) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [a.impact[0], a.impact[1]] },
          properties: { evidence: 'modelled' as const, id: `impact-${i}` },
        })),
      ])
    }

    const begin = () => {
      if (cancelled) return
      const e = engage(optionsRef.current, run.gen, run.index)
      run.index += 1
      setCurrent(e)
      setShown(0)
      draw(e, 0)
      frame(e)
      let shot = 0
      const fire = () => {
        if (cancelled) return
        shot += 1
        const a = e.attempts[shot - 1]
        const label = attemptLabel(a)
        setShown(shot)
        draw(e, shot)
        setTally((t) => ({ ...t, warheads: t.warheads + 1, hits: t.hits + (label === 'HIT' ? 1 : 0), duds: t.duds + (label === 'DUD' ? 1 : 0) }))
        setLines((prev) => {
          const id = run.next
          run.next += 1
          const text = `${e.weapon.name.split(' · ')[0].toUpperCase()} AT ${e.target.name.toUpperCase()} · ${label === 'DUD' ? 'DID NOT ARRIVE' : `${m(a.missMetres)} FROM THE AIM POINT, ${m(a.lethalRadiusMetres)} NEEDED`}`
          return [...prev, { id, label, text }].slice(-LOG_KEEP)
        })
        if (shot < e.attempts.length) {
          timer = window.setTimeout(fire, SHOT_MS)
        } else {
          // The engagement is counted when it is over. Counting it at the
          // start would put the answer in the headline before the warheads
          // had landed, which is the one thing this screen must not do.
          setTally((t) => ({ ...t, engagements: t.engagements + 1, destroyed: t.destroyed + (e.destroyed ? 1 : 0) }))
          timer = window.setTimeout(begin, HOLD_MS + SHOT_MS)
        }
      }
      timer = window.setTimeout(fire, FLY_MS)
    }

    begin()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, seed])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length])

  const reset = () => {
    setTally({ engagements: 0, destroyed: 0, warheads: 0, hits: 0, duds: 0 })
    setLines([])
    const fresh = Math.floor(Math.random() * 1e6)
    run.gen = rng(fresh)
    run.index = 0
    run.next = 1
    setSeed(fresh)
  }

  const attempt = current && shown > 0 ? current.attempts[shown - 1] : null
  const label = attempt ? attemptLabel(attempt) : null
  const pool = category ? targetsIn(category).length : CATEGORIES.reduce((s, c) => s + targetsIn(c.id).length, 0)

  return (
    <div className="wopr intercept impact">
      <div ref={container} className="atlas-map" aria-label="The terminal phase" />
      <div className="atlas-vignette" aria-hidden="true" />
      <section ref={terminal} className="wopr-terminal" aria-live="polite">
        <header className="wopr-head">
          <p className="wopr-line wopr-line--title">TERMINAL PHASE · {category ? CATEGORIES.find((c) => c.id === category)!.name.toUpperCase() : 'EVERY KIND OF TARGET'}</p>
          <p className="wopr-line">
            {weaponId ? SYSTEMS.find((s) => s.id === weaponId)!.name.toUpperCase() : 'EVERY SYSTEM IN THE LAB'} · {pool} PLACES ON THE LIST · UP TO {allowance} WARHEAD{allowance === 1 ? '' : 'S'} EACH
          </p>
        </header>

        <div className="wopr-figure">
          <p className="wopr-line wopr-line--big">
            {tally.destroyed} DESTROYED · {tally.engagements - tally.destroyed} SURVIVED
          </p>
          <p className="wopr-line">
            {tally.warheads} WARHEAD{tally.warheads === 1 ? '' : 'S'} SPENT · {tally.warheads > 0 ? pct(tally.hits / tally.warheads) : '—'} OF THEM WORKED
            {current ? ` · THE ARITHMETIC SAYS ${pct(current.singleShot)} FOR THIS ONE` : ''}
          </p>

          {current && (
            <>
              <p className={`impact-stamp${label ? ` impact-stamp--${label.toLowerCase()}` : ''}`}>{label ?? 'INBOUND'}</p>
              <table className="wopr-objectives">
                <tbody>
                  <tr>
                    <th scope="row">Target</th>
                    <td>{current.target.name}</td>
                    <td className="wopr-dim">
                      {current.target.hardness.name} · fails at {current.target.hardness.psi.toLocaleString('en-GB')} psi · {formatGrid(current.target.position)}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Weapon</th>
                    <td>{current.weapon.name}</td>
                    <td className="wopr-dim">
                      {kt(current.weapon.yieldKt)} · CEP {m(current.weapon.cepMetres)} · {current.weapon.guidance.toLowerCase()}, {current.weapon.year}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Lethal radius</th>
                    <td>{m(current.attempts[0].lethalRadiusMetres)}</td>
                    <td className="wopr-dim">the ground range at which {current.target.hardness.psi.toLocaleString('en-GB')} psi is reached</td>
                  </tr>
                  <tr className={attempt && !attempt.hit ? 'is-fire' : ''}>
                    <th scope="row">Warhead {Math.max(1, shown)} of {current.attempts.length}</th>
                    <td>{attempt ? (attempt.arrived ? m(attempt.missMetres) : '—') : '…'}</td>
                    <td className="wopr-dim">{attempt ? (attempt.arrived ? `from the aim point${attempt.hit ? ', inside the radius' : ', outside it'}` : `did not arrive · ${pct(1 - RELIABILITY)} of them do not`) : 'in flight'}</td>
                  </tr>
                </tbody>
              </table>
              <p className="wopr-line wopr-line--plan">{current.target.note}</p>
            </>
          )}

          <ol className="wopr-log" ref={logRef}>
            {lines.map((l) => (
              <li key={l.id} className={`impact-line impact-line--${l.label.toLowerCase()}`}>
                <strong>{l.label}</strong> {l.text}
              </li>
            ))}
          </ol>
        </div>

        <div className="wopr-controls">
          <label className="field">
            <span>Target type</span>
            <select value={category ?? ''} onChange={(e) => { setCategory((e.target.value || null) as CategoryId | null); reset() }}>
              <option value="">Anything · wander the list</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {targetsIn(c.id).length}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Weapon</span>
            <select value={weaponId ?? ''} onChange={(e) => { setWeaponId(e.target.value || null); reset() }}>
              <option value="">Any system · draw one each time</option>
              {SYSTEMS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.year}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Warheads per target</span>
            <input type="number" min={1} max={8} value={allowance} onChange={(e) => { setAllowance(Math.max(1, Math.min(8, Number(e.target.value)))); reset() }} />
          </label>
          <div className="clock-controls">
            <button type="button" className={running ? 'is-active' : ''} onClick={() => setRunning((r) => !r)}>
              {running ? 'Hold' : 'Run'}
            </button>
            <button type="button" onClick={reset}>
              Clear the tally
            </button>
            <a className="front-button front-button--quiet" href="#/lab/accuracy">
              The lab
            </a>
          </div>
          {category && <p className="wopr-line wopr-line--plan">{CATEGORIES.find((c) => c.id === category)!.line}</p>}
          <p className="wopr-line wopr-dim">
            Not a target list. The cities and the airfields are the 1956 SAC study’s, which is the one released document of its kind and is one-sided because the release is; everything else is a representative installation of its class, and no state’s plan is claimed for any of it. Hardness is the accuracy lab’s class figure and is modelled. Reliability is {pct(RELIABILITY)}.
          </p>
        </div>
      </section>
    </div>
  )
}
