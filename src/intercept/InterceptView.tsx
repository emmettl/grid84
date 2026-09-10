import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { TrackLayer } from '../map/track-layer.ts'
import { prepareTracks } from '../map/track-scene.ts'
import { chances, rng, type Outcome, type Phase } from '../models/intercept.ts'
import { INTERCEPTOR_SITES, SCENARIOS, shot, type Shot } from './scene.ts'

/**
 * The loop.
 *
 * The lab beside this one has the tables and the reasons; a table does not
 * make you feel a probability. So this flies the thing: a real launcher, a
 * real city, a real interceptor site, one engagement at a time, and a tally
 * that keeps count. Most of them fail, and each one says which of the four
 * reasons it failed for.
 *
 * Nothing here is a probability of kill borrowed from a test range. The
 * outcome of each attempt is drawn from the same arithmetic the lab draws:
 * whether anything was in reach, which object it went for, and whether the
 * kill vehicle could null the error in the time it had.
 */

const SECONDS_PER_SHOT = 8
const LOG_KEEP = 60

const OUTCOME_LABEL: Record<Outcome, string> = { killed: 'HIT', missed: 'MISS', 'wrong object': 'MISS', 'no shot': 'MISS' }

export function InterceptView() {
  const container = useRef<HTMLDivElement>(null)
  const terminal = useRef<HTMLElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const layerRef = useRef<TrackLayer | null>(null)
  const logRef = useRef<HTMLOListElement>(null)

  const [scenarioId, setScenarioId] = useState('nk')
  const [phase, setPhase] = useState<Phase>('midcourse')
  const [decoys, setDecoys] = useState(9)
  const [constellation, setConstellation] = useState(1_500)
  const [running, setRunning] = useState(true)
  const [current, setCurrent] = useState<Shot | null>(null)
  const [tally, setTally] = useState<Record<Outcome, number>>({ killed: 0, missed: 0, 'wrong object': 0, 'no shot': 0 })
  const [lines, setLines] = useState<Array<{ id: number; outcome: Outcome; text: string }>>([])

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]
  const options = useMemo(() => ({ scenario, phase, decoys: phase === 'midcourse' ? decoys : 0, constellation, burnSeconds: 180 }), [scenario, phase, decoys, constellation])
  const state = useRef({ gen: rng(1), next: 1, startedAt: 0, shot: null as Shot | null })
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const attempts = tally.killed + tally.missed + tally['wrong object'] + tally['no shot']
  const analytic = useMemo(() => {
    const probe = shot(options, rng(99))
    return chances(probe.engagement)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  // The globe, turning, with the tracks on the studies' own layer.
  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center: [-140, 55], zoom: 1.6 })
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
      const layer = new TrackLayer('intercept-tracks-gl')
      layer.setFade({ enabled: false })
      map.addLayer(layer)
      layerRef.current = layer
      pad()
      const turn = () => {
        if (!map.isMoving()) {
          const c = map.getCenter()
          map.jumpTo({ center: [c.lng + 0.012, c.lat] })
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
      layerRef.current = null
    }
  }, [])

  // The loop: one engagement every few seconds, drawn as it flies.
  useEffect(() => {
    if (!running) return
    let frame = 0
    const fire = () => {
      const s = shot(optionsRef.current, state.current.gen)
      state.current.shot = s
      state.current.startedAt = performance.now()
      setCurrent(s)
      setTally((t) => ({ ...t, [s.attempt.outcome]: t[s.attempt.outcome] + 1 }))
      setLines((prev) => {
        const id = state.current.next
        state.current.next += 1
        const text = `${s.from.name.split(' · ')[0].toUpperCase()} AT A CITY OF ${s.toPopulation.toLocaleString('en-GB')} · ${s.attempt.reason}`
        return [...prev, { id, outcome: s.attempt.outcome, text }].slice(-LOG_KEEP)
      })
      layerRef.current?.setScene(prepareTracks(s.specs))
    }
    fire()
    const step = () => {
      const s = state.current.shot
      if (s && layerRef.current) {
        const elapsed = (performance.now() - state.current.startedAt) / 1_000
        layerRef.current.setTime((elapsed / SECONDS_PER_SHOT) * s.span)
        if (elapsed >= SECONDS_PER_SHOT) fire()
      }
      frame = window.setTimeout(step, 50)
    }
    frame = window.setTimeout(step, 50)
    return () => window.clearTimeout(frame)
  }, [running])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length])

  const reset = () => {
    setTally({ killed: 0, missed: 0, 'wrong object': 0, 'no shot': 0 })
    setLines([])
    state.current.gen = rng(Math.floor(Math.random() * 1e6))
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`
  const leaked = attempts - tally.killed

  return (
    <div className="wopr intercept">
      <div ref={container} className="atlas-map" aria-label="The engagement" />
      <div className="atlas-vignette" aria-hidden="true" />
      <section ref={terminal} className="wopr-terminal" aria-live="polite">
        <header className="wopr-head">
          <p className="wopr-line wopr-line--title">INTERCEPT · {phase.toUpperCase()} PHASE · {scenario.name.toUpperCase()}</p>
          <p className="wopr-line">
            {phase === 'midcourse' ? `${decoys} DECOYS PER WARHEAD` : phase === 'boost' ? `${constellation.toLocaleString('en-GB')} INTERCEPTORS IN ORBIT` : 'ONE BATTERY OVER THE TARGET'} · INTERCEPTORS AT {INTERCEPTOR_SITES.map((s) => s.name.split(',')[0].toUpperCase()).join(' AND ')}
          </p>
        </header>

        <div className="wopr-figure">
          <p className="wopr-line wopr-line--big">
            {leaked} THROUGH · {tally.killed} STOPPED
          </p>
          <p className="wopr-line">
            {attempts} ATTEMPT{attempts === 1 ? '' : 'S'} · {attempts > 0 ? pct(tally.killed / attempts) : '—'} STOPPED · THE ARITHMETIC SAYS {pct(analytic.killed)}
          </p>
          <table className="wopr-objectives">
            <tbody>
              <tr className={tally['no shot'] > 0 ? 'is-fire' : ''}>
                <th scope="row">Nothing in reach</th>
                <td>{tally['no shot']}</td>
                <td className="wopr-dim">{pct(analytic['no shot'])} expected · the absentee problem</td>
              </tr>
              <tr className={tally['wrong object'] > 0 ? 'is-fire' : ''}>
                <th scope="row">Went for a decoy</th>
                <td>{tally['wrong object']}</td>
                <td className="wopr-dim">{pct(analytic['wrong object'])} expected · nothing in vacuum tells them apart</td>
              </tr>
              <tr>
                <th scope="row">Missed</th>
                <td>{tally.missed}</td>
                <td className="wopr-dim">{pct(analytic.missed)} expected · could not null the error in time</td>
              </tr>
              <tr>
                <th scope="row">Killed</th>
                <td>{tally.killed}</td>
                <td className="wopr-dim">{pct(analytic.killed)} expected · hitting a bullet with a bullet, which works</td>
              </tr>
            </tbody>
          </table>
          {current && (
            <p className="wopr-line wopr-line--plan">
              {current.from.system.toUpperCase()} FROM {current.from.name.split(' · ')[0].toUpperCase()} · {Math.round(current.flightSeconds / 60)} MIN OF FLIGHT · ENGAGED AT {Math.round(current.interceptAltitudeMetres / 1_000).toLocaleString('en-GB')} KM BY {current.site.name.split(',')[0].toUpperCase()}
            </p>
          )}
        </div>

        <ol ref={logRef} className="wopr-log" aria-label="Attempts">
          {lines.map((l, i) => (
            <li key={l.id} className={`wopr-log-line ${l.outcome === 'killed' ? 'wopr-log-line--best' : 'wopr-log-line--mark'}${i === lines.length - 1 ? ' is-new' : ''}`}>
              <span className="wopr-log-at">{OUTCOME_LABEL[l.outcome]}</span>
              <span className="wopr-log-text">{l.text}</span>
            </li>
          ))}
        </ol>

        <p className="wopr-note">
          No probability of kill is taken from any test range. Each attempt is drawn from the arithmetic of <a href="#/lab/intercept">the intercept lab</a>: whether anything was within reach when the missile lifted, which of the objects on the same trajectory it went for, and whether the kill vehicle could null the error in the seconds it had. The launchers are the atlas's order of battle, the cities the most populous cells of the 2025 grid, and the two interceptor sites the ones the system is deployed at.
        </p>
      </section>

      <div className="wopr-controls">
        <div className="wopr-group">
          <span className="wopr-dim">Threat</span>
          {SCENARIOS.map((s) => (
            <button key={s.id} type="button" className={s.id === scenarioId ? 'is-active' : ''} title={s.note} onClick={() => { setScenarioId(s.id); reset() }}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="wopr-group">
          <span className="wopr-dim">Phase</span>
          {(['boost', 'midcourse', 'terminal'] as Phase[]).map((p) => (
            <button key={p} type="button" className={p === phase ? 'is-active' : ''} onClick={() => { setPhase(p); reset() }}>
              {p}
            </button>
          ))}
        </div>
        {phase === 'midcourse' && (
          <div className="wopr-group">
            <span className="wopr-dim">Decoys per warhead</span>
            {[0, 4, 9].map((d) => (
              <button key={d} type="button" className={d === decoys ? 'is-active' : ''} onClick={() => { setDecoys(d); reset() }}>
                {d}
              </button>
            ))}
          </div>
        )}
        {phase === 'boost' && (
          <div className="wopr-group">
            <span className="wopr-dim">Interceptors in orbit</span>
            {[200, 1_500, 4_600].map((n) => (
              <button key={n} type="button" className={n === constellation ? 'is-active' : ''} onClick={() => { setConstellation(n); reset() }}>
                {n.toLocaleString('en-GB')}
              </button>
            ))}
          </div>
        )}
        <div className="wopr-group">
          <button type="button" className={running ? 'is-active' : ''} onClick={() => setRunning((r) => !r)}>
            {running ? 'Hold' : 'Run'}
          </button>
          <button type="button" onClick={reset}>
            Clear the tally
          </button>
          <a className="wopr-exit" href="#/lab/intercept">
            THE LAB
          </a>
          <a className="wopr-exit" href="#/">
            EXIT
          </a>
        </div>
      </div>
    </div>
  )
}
