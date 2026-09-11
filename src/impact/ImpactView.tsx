import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { formatBearing, formatGrid, type LngLat } from '../geo/geodesy.ts'
import { useFold } from '../hud/collapse.ts'
import { geodesicCircle } from '../geo/shapes.ts'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { installEvidenceLayers, setSourceData, SOURCES, type EvidenceFeature } from '../map/evidence-layers.ts'
import { TrackLayer } from '../map/track-layer.ts'
import { prepareTracks } from '../map/track-scene.ts'
import { arrivalBearing, REENTRY_SECONDS, reentrySpec } from './reentry.ts'
import { SYSTEMS } from '../models/lethality.ts'
import { attemptLabel, engage, RELIABILITY, rng, type Attempt, type Engagement, type RunOptions } from './run.ts'
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
/** How long the drawn reentry takes on screen: the last 120 km of altitude. */
const TRACK_MS = 1_500
/** How long the answer stands before the next warhead. */
const DWELL_MS = 1_100
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
  const layerRef = useRef<TrackLayer | null>(null)

  const [weaponId, setWeaponId] = useState<string | null>(null)
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [allowance, setAllowance] = useState(3)
  const [running, setRunning] = useState(true)
  // What the run is set to is set once and then watched, so it folds away and
  // gives the map back the screen — on a phone it starts folded.
  const fold = useFold('impact')
  const [current, setCurrent] = useState<Engagement | null>(null)
  const [shown, setShown] = useState(0)
  /** The warhead in the air: its number in the engagement, and where it is coming from. */
  const [incoming, setIncoming] = useState<{ index: number; bearing: number; altitudeMetres: number } | null>(null)
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
      const layer = new TrackLayer('impact-tracks-gl')
      layer.setFade({ enabled: false })
      map.addLayer(layer)
      layerRef.current = layer
      pad()
    })
    window.addEventListener('resize', pad)
    return () => {
      window.removeEventListener('resize', pad)
      sync?.(true)
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // The loop: fly to a target, spend warheads on it one at a time, move on.
  useEffect(() => {
    if (!running) return
    let timer = 0
    let raf = 0
    let cancelled = false

    /**
     * Frame the engagement rather than the place. What has to be legible is
     * the lethal radius against the spread of the misses, so the camera takes
     * whichever of the two is larger and puts about five of it across the
     * canvas — which is close enough to the ground to see runways at a
     * dockyard and far enough out to see a three-kilometre miss.
     */
    const spanOf = (e: Engagement) => Math.max(e.attempts[0].lethalRadiusMetres, e.weapon.cepMetres, e.target.extentMetres / 2) * 5
    /*
     * How much of the descent is drawn. A reentry vehicle really does come
     * down almost vertically, so a leg is about two and a half times taller
     * than it is long: drawn from any great height it would stand well off the
     * top of the frame. A quarter of the frame's width of altitude is as much
     * as fits and still reads as falling.
     */
    const legAltitude = (e: Engagement) => spanOf(e) / 4

    /*
     * The camera sits over the point the warhead actually lands, not the point
     * it was aimed at. That way the impact, the ring it throws and the last of
     * the track are all in the middle of the screen, and the miss reads as
     * what it is: the aim point sitting off to one side of the thing that
     * happened. Between warheads it slides to the next one.
     */
    const frame = (e: Engagement, a: Attempt, duration: number) => {
      const map = mapRef.current
      if (!map) return
      const width = map.getCanvas().clientWidth || 1_000
      const zoom = Math.max(4, Math.min(15, Math.log2((40_075_017 * Math.cos((a.impact[1] * Math.PI) / 180) * width) / (512 * spanOf(e)))))
      map.flyTo({ center: [a.impact[0], a.impact[1]], zoom, pitch: 45, duration, essential: true })
    }

    const draw = (e: Engagement, upTo: number) => {
      const map = mapRef.current
      if (!map) return
      const ring = (centre: LngLat, metres: number) => geodesicCircle(centre, metres).map((p) => [p[0], p[1]])
      const landed = e.attempts.slice(0, upTo)
      const rings: EvidenceFeature[] = [
        // The circular error, around the aim point: the promise the weapon makes.
        { type: 'Feature', geometry: { type: 'LineString', coordinates: ring(e.target.position, e.weapon.cepMetres) }, properties: { evidence: 'inferred', id: 'cep' } },
        // A dud throws no ring, because nothing happened.
        ...landed
          .map((a, i) => ({ a, i }))
          .filter(({ a }) => a.arrived)
          .map(({ a, i }) => ({
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
          properties: { evidence: a.arrived ? ('modelled' as const) : ('inferred' as const), id: `impact-${i}` },
        })),
      ])
    }

    /**
     * The warhead comes down. A mark appearing on the ground is not an
     * arrival: the thing is drawn falling out of the sky on the bearing it
     * would actually come from, and the ring is not drawn until it lands.
     */
    const flight = (e: Engagement, a: Attempt, done: () => void) => {
      const layer = layerRef.current
      if (!layer) {
        done()
        return
      }
      layer.setScene(prepareTracks([reentrySpec(a, e.weapon.side, `rv-${run.next}`, legAltitude(e))]))
      /*
       * Wind it back before the first frame. A new scene inherits whatever
       * time the layer was last set to, which was the end of the last warhead's
       * flight, so the whole track flashed up complete for one frame and then
       * started again from nothing.
       */
      layer.setTime(0)
      const startedAt = performance.now()
      const step = () => {
        if (cancelled) return
        const elapsed = performance.now() - startedAt
        layer.setTime(Math.min(1, elapsed / TRACK_MS) * REENTRY_SECONDS)
        if (elapsed >= TRACK_MS) done()
        else raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }

    const begin = () => {
      if (cancelled) return
      const e = engage(optionsRef.current, run.gen, run.index)
      run.index += 1
      setCurrent(e)
      setShown(0)
      setIncoming(null)
      draw(e, 0)
      layerRef.current?.setScene(prepareTracks([]))
      frame(e, e.attempts[0], FLY_MS)
      let shot = 0
      const fire = () => {
        if (cancelled) return
        shot += 1
        const a = e.attempts[shot - 1]
        setIncoming({ index: shot, bearing: arrivalBearing(a.impact, e.weapon.side), altitudeMetres: legAltitude(e) })
        flight(e, a, () => land(e, a, shot))
      }
      const land = (engagement: Engagement, a: Attempt, shot_: number) => {
        if (cancelled) return
        const label = attemptLabel(a)
        setShown(shot_)
        setIncoming(null)
        draw(engagement, shot_)
        setTally((t) => ({ ...t, warheads: t.warheads + 1, hits: t.hits + (label === 'HIT' ? 1 : 0), duds: t.duds + (label === 'DUD' ? 1 : 0) }))
        setLines((prev) => {
          const id = run.next
          run.next += 1
          const text = `${engagement.weapon.name.split(' · ')[0].toUpperCase()} AT ${engagement.target.name.toUpperCase()} · ${label === 'DUD' ? `${m(a.missMetres)} FROM THE AIM POINT AND DID NOT GO OFF` : `${m(a.missMetres)} FROM THE AIM POINT, ${m(a.lethalRadiusMetres)} NEEDED`}`
          return [...prev, { id, label, text }].slice(-LOG_KEEP)
        })
        if (shot_ < engagement.attempts.length) {
          frame(engagement, engagement.attempts[shot_], DWELL_MS)
          timer = window.setTimeout(fire, DWELL_MS)
        } else {
          // The engagement is counted when it is over. Counting it at the
          // start would put the answer in the headline before the warheads
          // had landed, which is the one thing this screen must not do.
          setTally((t) => ({ ...t, engagements: t.engagements + 1, destroyed: t.destroyed + (engagement.destroyed ? 1 : 0) }))
          timer = window.setTimeout(begin, HOLD_MS)
        }
      }
      timer = window.setTimeout(fire, FLY_MS)
    }

    begin()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
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

  // While a warhead is in the air the readout holds its breath: the answer
  // is not shown until the thing has landed.
  const attempt = incoming === null && current && shown > 0 ? current.attempts[shown - 1] : null
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
                    <th scope="row">
                      Warhead {incoming ? incoming.index : Math.max(1, shown)} of {current.attempts.length}
                    </th>
                    <td>{incoming ? m(incoming.altitudeMetres) : attempt ? m(attempt.missMetres) : '…'}</td>
                    <td className="wopr-dim">
                      {incoming
                        ? `reentry, coming in from ${formatBearing(incoming.bearing)}`
                        : attempt
                          ? attempt.arrived
                            ? `from the aim point${attempt.hit ? ', inside the radius' : ', outside it'}`
                            : `from the aim point, and did not go off · ${pct(1 - RELIABILITY)} of them do not`
                          : 'in flight'}
                    </td>
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
          <div className={`panel-fold${fold.folded ? ' is-folded' : ''}`}>
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
          </div>
          <div className="clock-controls">
            <button type="button" className={`panel-fold-toggle${fold.folded ? '' : ' is-active'}`} aria-expanded={!fold.folded} onClick={fold.toggle}>
              {fold.folded ? 'Set up' : 'Hide the controls'}
            </button>
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
          <div className={`panel-fold${fold.folded ? ' is-folded' : ''}`}>
          {category && <p className="wopr-line wopr-line--plan">{CATEGORIES.find((c) => c.id === category)!.line}</p>}
          <p className="wopr-line wopr-dim">
            Not a target list. The cities and the airfields are the 1956 SAC study’s, which is the one released document of its kind and is one-sided because the release is; everything else is a representative installation of its class, and no state’s plan is claimed for any of it. Hardness is the accuracy lab’s class figure and is modelled. Reliability is {pct(RELIABILITY)}, and it covers the whole chain — a missile that fails to launch, one that fails in flight, and a warhead that arrives and does not go off. All three are drawn here as the third, in grey, because it is the one of them you could stand next to.
          </p>
          </div>
        </div>
      </section>
    </div>
  )
}
