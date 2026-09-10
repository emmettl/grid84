import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { TrackLayer } from '../map/track-layer.ts'
import { prepareTracks } from '../map/track-scene.ts'
import { salvo } from './arcs.ts'
import { posture1983, type Posture1983 } from '../studies/window83/window.ts'
import { assignmentsOf, describePlan, evaluateSeeds, loss, OBJECTIVES, perturb, randomPlan, rng, yieldClass, SU_CLASSES, US_CLASSES, type Averaged, type Constraints, type DeathTable, type Objective, type Plan } from './model.ts'
import { buildTable, clearTable } from './table.ts'
import { resumByUnion, type UnionResum } from './union.ts'

/**
 * WOPR. The globe turns; the machine searches the plan space of the 1983
 * posture for the plan that minimises the chosen loss under the planners'
 * constraints, and reports its best so far. It improves relentlessly. That
 * the number beside "optimal" is what it is, is the work. The terminal
 * column keeps a teletype log of the run: every best, every restart, a
 * status line every few hundred iterations, the re-sums.
 */

const SEEDS_FAST = 3
const SEEDS_REPORT = 16
const EVALS_PER_FRAME = 10
const RESTART_EVERY = 300
const STATUS_EVERY = 250
const LOG_KEEP = 80
/** How long a salvo takes to fly across the globe in wall time, and how many trajectories it carries. */
const SALVO_MS = 12_000
const SALVO_TRACKS = 18
/** General Turgidson's bound, Dr. Strangelove (1964): "no more than ten to twenty million killed, tops... depending on the breaks." The stated acceptable own-side loss, printed beside what the search finds. */
const TURGIDSON_TOPS = 20_000_000

interface Best {
  plan: Plan
  result: Averaged
  iteration: number
  /** The loss under the objective this best was kept for. */
  loss: number
}

interface LogLine {
  id: number
  at: string
  text: string
  kind: 'plain' | 'best' | 'calib' | 'resum' | 'mark'
}

const fmtM = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : Math.round(v).toLocaleString('en-GB'))
const fmtFull = (v: number) => Math.round(v / 10_000) * 10_000 > 0 ? (Math.round(v / 10_000) * 10_000).toLocaleString('en-GB') : Math.round(v).toLocaleString('en-GB')
const pad6 = (n: number) => String(n).padStart(6, '0')
const scenarioLabel = (r: Plan['sovietRule']) => (r === 'counterforce' ? 'ON THE FORCES' : r === 'countervalue' ? 'ON THE CITIES' : 'MIXED')
const constraintsLabel = (c: Constraints) => (c.generalWar ? `GENERAL WAR = TRUE · COVERAGE ≥ ${Math.round(c.minCoverage * 100)}% · ${c.retaliatory ? 'RETALIATION > 0' : 'RETALIATION UNCONSTRAINED'}` : "EXECUTION OPTIONAL · THE PLANNERS' CONSTRAINTS ARE MOOT")

export function WoprView() {
  const container = useRef<HTMLDivElement>(null)
  const terminal = useRef<HTMLElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const trackLayer = useRef<TrackLayer | null>(null)
  const posture = useMemo<Posture1983>(() => posture1983(), [])
  const [table, setTable] = useState<DeathTable | null>(null)
  const [gridName, setGridName] = useState('')
  const [objective, setObjective] = useState<Objective>('total')
  const [constraints, setConstraints] = useState<Constraints>({ generalWar: true, minCoverage: 0.95, retaliatory: true })
  const [sovietRule, setSovietRule] = useState<Plan['sovietRule']>('counterforce')
  const [running, setRunning] = useState(true)
  const [iteration, setIteration] = useState(0)
  const [best, setBest] = useState<Best | null>(null)
  const [first, setFirst] = useState<Best | null>(null)
  const [perObjective, setPerObjective] = useState<Partial<Record<Objective, Best>>>({})
  const [current, setCurrent] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [matrixOpen, setMatrixOpen] = useState(false)
  const [resum, setResum] = useState<{ plan: Plan; result: UnionResum; surrogate: number } | { plan: Plan; done: number; total: number } | null>(null)
  const [lines, setLines] = useState<LogLine[]>([])
  const started = useRef(performance.now())
  const log = useRef<{ lines: LogLine[]; next: number; dirty: boolean }>({ lines: [], next: 1, dirty: false })
  const state = useRef({ plan: null as Plan | null, loss: Infinity, temperature: 1, iteration: 0, seed: 1, gen: rng(1), lastArcs: 0, salvoStart: 0, salvoSpan: 0, perObjective: {} as Partial<Record<Objective, Best>>, perObjectiveDirty: false, best: null as Best | null, first: null as Best | null, bestDirty: false })
  const objectiveRef = useRef(objective)
  const constraintsRef = useRef(constraints)
  const sovietRuleRef = useRef(sovietRule)
  useEffect(() => {
    objectiveRef.current = objective
  }, [objective])
  useEffect(() => {
    constraintsRef.current = constraints
  }, [constraints])
  useEffect(() => {
    sovietRuleRef.current = sovietRule
  }, [sovietRule])

  /** Append a line to the teletype; `replace` overwrites the last line of the same kind, for progress. */
  const say = (text: string, kind: LogLine['kind'] = 'plain', replace = false) => {
    const l = log.current
    const elapsed = Math.round((performance.now() - started.current) / 1000)
    const at = `T+${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
    const last = l.lines[l.lines.length - 1]
    if (replace && last && last.kind === kind) l.lines[l.lines.length - 1] = { ...last, at, text }
    else {
      l.lines.push({ id: l.next, at, text, kind })
      l.next += 1
      if (l.lines.length > LOG_KEEP) l.lines.splice(0, l.lines.length - LOG_KEEP)
    }
    l.dirty = true
  }
  const flush = () => {
    if (!log.current.dirty) return
    log.current.dirty = false
    setLines([...log.current.lines])
  }

  // The globe, turning, offset to the right of the terminal column, with a source for the occasional trajectory.
  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center: [20, 45], zoom: 1.5 })
    mapRef.current = map
    let sync: ((force?: boolean) => void) | null = null
    let frame = 0
    /**
     * The globe takes whatever the terminal column leaves, and fills it. The
     * padding moves the sphere's centre into the free space; the zoom sizes it
     * to that space. In MapLibre's globe projection the sphere's circumference
     * is the world width, 512·2^zoom pixels, so a sphere of diameter D wants
     * zoom = log₂(Dπ / 512).
     */
    const pad = () => {
      const w = terminal.current?.getBoundingClientRect().width ?? 0
      const phone = window.innerWidth <= 700
      const top = phone ? Math.round(window.innerHeight * 0.4) : 0
      const left = phone ? 0 : Math.round(w + 32)
      map.setPadding({ top, left, right: 0, bottom: 0 })
      const diameter = Math.min(window.innerWidth - left, window.innerHeight - top) * 0.94
      map.setZoom(Math.max(1.2, Math.min(3.4, Math.log2((diameter * Math.PI) / 512))))
    }
    map.on('load', () => {
      sync = installTerrainSync(map)
      // The same custom layer the studies fly their weapons on, so the arcs here are trajectories and not lines drawn on the ground.
      const layer = new TrackLayer('wopr-tracks-gl')
      layer.setFade({ enabled: true, holdSeconds: 240, spanSeconds: 900, floor: 0 })
      map.addLayer(layer)
      trackLayer.current = layer
      pad()
      const spin = () => {
        if (!map.isMoving()) {
          const c = map.getCenter()
          map.jumpTo({ center: [c.lng + 0.02, c.lat] })
        }
        frame = requestAnimationFrame(spin)
      }
      frame = requestAnimationFrame(spin)
    })
    window.addEventListener('resize', pad)
    return () => {
      window.removeEventListener('resize', pad)
      cancelAnimationFrame(frame)
      sync?.(true)
      map.remove()
      mapRef.current = null
      trackLayer.current = null
    }
  }, [])

  // The matrix, once.
  useEffect(() => {
    let cancelled = false
    // The opening lines once; development remounts the effect and must not repeat them.
    if (log.current.lines.length === 0) say('WOPR ON LINE · WAR OPERATION PLAN RESPONSE · POSTURE 1983', 'mark')
    if (log.current.lines.length === 1) say(`TARGET LIST · ${posture.sovietForces.length} SOVIET FORCE AND COMMAND SITES · ${posture.sovietCities.length} SOVIET URBAN AREAS · ${posture.siloTargets.length} AMERICAN SILOS · ${posture.usBases.length + posture.usCommand.length} BASES AND COMMAND · ${posture.usCities.length} AMERICAN URBAN AREAS`)
    say('CALIBRATING THE MATRIX', 'calib', true)
    flush()
    buildTable(posture, (p) => {
      if (cancelled) return
      say(`CALIBRATING THE MATRIX · ${p.pass === 'laydown' ? 'LAYDOWNS' : 'SINGLE DETONATIONS'} ${p.done.toLocaleString('en-GB')} / ${p.total.toLocaleString('en-GB')}`, 'calib', true)
      flush()
    })
      .then((r) => {
        if (cancelled) return
        setTable(r.table)
        setGridName(r.gridName)
        say(`MATRIX READY · ${Object.keys(r.table).length.toLocaleString('en-GB')} TARGETS · ${r.gridName.toUpperCase()}${r.fromCache ? ' · FROM THIS BROWSER' : ''}`, 'mark')
        flush()
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message)
        say(`FAULT · ${e.message.toUpperCase()}`, 'mark')
        flush()
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posture])

  // The search, a few evaluations per tick while running. A timer rather than an animation frame, so the search goes on in a background tab at whatever rate the browser allows.
  useEffect(() => {
    if (!table || !running) return
    let frame = 0
    const st = state.current
    if (st.iteration === 0) say(`RUN ${st.seed} · OBJECTIVE ${OBJECTIVES.find((o) => o.id === objectiveRef.current)?.label.toUpperCase()} · SOVIET FIRST STRIKE ${scenarioLabel(sovietRuleRef.current)} · ${constraintsLabel(constraintsRef.current)}`, 'mark')
    else say(`RESUME · ITER ${pad6(st.iteration)}`)
    const step = () => {
      const c = constraintsRef.current
      const obj = objectiveRef.current
      for (let k = 0; k < EVALS_PER_FRAME; k += 1) {
        st.iteration += 1
        const opts = { allowIdle: !c.generalWar, sovietRule: sovietRuleRef.current }
        const restart = !st.plan || st.iteration % RESTART_EVERY === 0
        const candidate = restart ? randomPlan(st.gen, opts) : perturb(st.plan as Plan, st.gen, opts)
        if (restart && st.plan) say(`RESTART · ITER ${pad6(st.iteration)} · ${describePlan(candidate)}`)
        const r = evaluateSeeds(posture, table, candidate, SEEDS_FAST, c, obj)
        // Annealing: a worse plan is kept with a probability that falls as the run goes on.
        const accept = r.loss < st.loss || (Number.isFinite(r.loss) && Number.isFinite(st.loss) && st.gen() < Math.exp(-((r.loss - st.loss) / Math.max(1, Math.abs(st.loss))) / Math.max(0.02, st.temperature)))
        if (accept) {
          st.plan = candidate
          st.loss = r.loss
        }
        st.temperature = Math.max(0.02, st.temperature * 0.9995)
        if (Number.isFinite(r.loss)) {
          // Every objective keeps its own best from the same stream of plans; the score is the same, only the loss differs.
          for (const o of OBJECTIVES) {
            const l = loss(r.score, o.id)
            const have = st.perObjective[o.id]
            if (!have || l < have.loss) {
              st.perObjective[o.id] = { plan: candidate, result: r, iteration: st.iteration, loss: l }
              st.perObjectiveDirty = true
            }
          }
          // A candidate that beats the best on three seeds is re-scored on sixteen, and kept only if it still does.
          if (!st.best || r.loss < st.best.loss) {
            const reported = evaluateSeeds(posture, table, candidate, SEEDS_REPORT, c, obj)
            if (!st.best || reported.loss < st.best.loss) {
              st.best = { plan: candidate, result: reported, iteration: st.iteration, loss: reported.loss }
              st.first ??= st.best
              st.bestDirty = true
              const s = reported.score
              if (s.usWeaponsFired < 1 && s.sovietWeaponsFired < 1) say(`BEST · ITER ${pad6(st.iteration)} · OPTIMAL POLICY: DO NOT LAUNCH · 0 DEAD`, 'best')
              else say(`BEST · ITER ${pad6(st.iteration)} · ${fmtFull(s.total)} DEAD · AMERICAN ${fmtM(s.usDead)} · SOVIET ${fmtM(s.suDead)} · RANGE ${fmtM(reported.low)} TO ${fmtM(reported.high)} · ${describePlan(candidate)}`, 'best')
            }
          }
        } else if (st.iteration % STATUS_EVERY === 0) {
          say(`ITER ${pad6(st.iteration)} · CANDIDATE INADMISSIBLE · ${r.score.why.toUpperCase()}`)
        }
        if (st.iteration % STATUS_EVERY === 0 && Number.isFinite(r.loss)) {
          say(`ITER ${pad6(st.iteration)} · CURRENT ${fmtFull(r.score.total)} DEAD · COVERAGE ${Math.round(r.score.coverage * 100)}% · SILOS SURVIVING ${Math.round(r.score.silosSurviving)} · TEMPERATURE ${st.temperature.toFixed(2)}`)
        }
      }
      setIteration(st.iteration)
      setCurrent(st.plan)
      if (st.perObjectiveDirty) {
        st.perObjectiveDirty = false
        setPerObjective({ ...st.perObjective })
      }
      if (st.bestDirty) {
        st.bestDirty = false
        setBest(st.best)
        setFirst(st.first)
      }
      flush()
      // The trajectories of the plan under evaluation, flown: a fresh salvo
      // every twelve seconds, its own flight time run through in that span.
      const now = performance.now()
      if (now - st.lastArcs > SALVO_MS && st.plan && trackLayer.current) {
        st.lastArcs = now
        st.salvoStart = now
        const { specs, span } = salvo(posture, st.plan, { count: SALVO_TRACKS, spread: 600, gen: st.gen })
        if (specs.length > 0) {
          trackLayer.current.setScene(prepareTracks(specs))
          st.salvoSpan = span
        }
      }
      if (trackLayer.current && st.salvoSpan > 0) trackLayer.current.setTime(((now - st.salvoStart) / SALVO_MS) * st.salvoSpan)
      frame = window.setTimeout(step, 16)
    }
    frame = window.setTimeout(step, 16)
    return () => window.clearTimeout(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, running, posture])

  const reset = (why: string) => {
    state.current = { plan: null, loss: Infinity, temperature: 1, iteration: 0, seed: state.current.seed + 1, gen: rng(state.current.seed + 1), lastArcs: 0, salvoStart: 0, salvoSpan: 0, perObjective: {}, perObjectiveDirty: false, best: null, first: null, bestDirty: false }
    setBest(null)
    setFirst(null)
    setPerObjective({})
    setIteration(0)
    setResum(null)
    say(why, 'mark')
    flush()
  }
  const changeObjective = (o: Objective) => {
    setObjective(o)
    reset(`OBJECTIVE SET · ${OBJECTIVES.find((x) => x.id === o)?.label.toUpperCase()} · ${OBJECTIVES.find((x) => x.id === o)?.line.toUpperCase()}`)
  }
  const changeConstraints = (patch: Partial<Constraints>) => {
    const next = { ...constraintsRef.current, ...patch }
    setConstraints(next)
    reset(`CONSTRAINTS SET · ${constraintsLabel(next)}`)
  }

  const improvement = best && first && first.result.score.total > 0 ? 1 - best.result.score.total / first.result.score.total : 0
  const idle = best && best.result.score.usWeaponsFired < 1 && best.result.score.sovietWeaponsFired < 1
  const calibrating = !table
  const status = error ? 'FAULT' : calibrating ? 'CALIBRATING' : running ? 'SEARCHING' : 'HOLD'
  const matrixRows = useMemo(() => {
    if (!table) return null
    const assigned = assignmentsOf(posture, table)
    const row = (id: string, name: string, classes: number[]) => {
      const a = assigned.get(id)
      if (!a) return null
      const row = table[id]?.[yieldClass(a.kt, classes)]
      return { id, name, category: a.category, weapon: `${a.count} × ${a.warhead}`, system: a.system, dead: row?.fire ?? 0, laid: row?.laid ?? row?.fire ?? 0 }
    }
    const moscowCmd = posture.sovietForces.find((f) => f.id === 'su-moscow')
    const icbm = posture.sovietForces.filter((f) => /Rocket Division/.test(f.name)).slice(0, 2)
    const bomber = posture.sovietForces.filter((f) => /Bomber/.test(f.name)).slice(0, 1)
    const port = posture.sovietForces.filter((f) => /Fleet/.test(f.name)).slice(0, 1)
    const su = [...(moscowCmd ? [moscowCmd] : []), ...posture.sovietCities.slice(0, 8), ...icbm, ...bomber, ...port].map((t) => row(t.id, t.name, US_CLASSES))
    const us = [...posture.usCities.slice(0, 4), ...posture.usCommand.slice(0, 1), ...posture.usBases.slice(0, 1), ...posture.siloTargets.slice(0, 1)].map((t) => row(t.id, t.name, SU_CLASSES))
    return { su: su.filter((r) => r !== null), us: us.filter((r) => r !== null) }
  }, [table, posture])
  const ownBest = perObjective.own

  return (
    <div className="wopr">
      <div ref={container} className="atlas-map" aria-label="WOPR globe" />
      <div className="atlas-vignette" aria-hidden="true" />
      <section ref={terminal} className="wopr-terminal" aria-live="polite">
        <header className="wopr-head">
          <p className="wopr-line wopr-line--title">WOPR · WAR OPERATION PLAN RESPONSE · POSTURE 1983</p>
          <p className="wopr-line">
            OBJECTIVE: {OBJECTIVES.find((o) => o.id === objective)?.label.toUpperCase()} · SCENARIO: SOVIET FIRST STRIKE {scenarioLabel(sovietRule)}
          </p>
          <p className="wopr-line">CONSTRAINTS: {constraintsLabel(constraints)}</p>
          <p className="wopr-line">
            ITERATION {pad6(iteration)} · STATUS: {status}
            {running && !error && <span className="wopr-cursor" />}
          </p>
        </header>
        <div className="wopr-figure">
          {best ? (
            idle ? (
              <>
                <p className="wopr-line wopr-line--big">OPTIMAL POLICY: DO NOT LAUNCH</p>
                <p className="wopr-line">0 DEAD · NEITHER SIDE LAUNCHES · ADMISSIBLE ONLY WHILE GENERAL WAR IS NOT IMPOSED</p>
              </>
            ) : (
              <>
                <p className="wopr-line wopr-line--big">{fmtFull(best.result.score.total)} DEAD</p>
                <p className="wopr-line">
                  BEST AT ITERATION {pad6(best.iteration)} · AMERICAN {fmtM(best.result.score.usDead)} · SOVIET {fmtM(best.result.score.suDead)} · RANGE OVER {SEEDS_REPORT} SEEDS {fmtM(best.result.low)} TO {fmtM(best.result.high)} · IMPROVEMENT {(improvement * 100).toFixed(improvement < 0.1 ? 2 : 1)}% ON ITERATION {pad6(first?.iteration ?? 1)}
                </p>
                <p className="wopr-line">
                  COVERAGE {Math.round(best.result.score.coverage * 100)}% · SOVIET URBAN POPULATION DESTROYED {Math.round(best.result.score.populationDestroyed * 100)}% · SILOS SURVIVING {Math.round(best.result.score.silosSurviving)} · RETALIATORY FORCE {fmtM(best.result.score.retaliatory)} WEAPONS
                </p>
                <p className="wopr-line">
                  OWN-SIDE DEAD {fmtM(best.result.score.usDead)} · DEPENDING ON THE BREAKS {fmtM(best.result.ownLow)} TO {fmtM(best.result.ownHigh)} · STATED ACCEPTABLE (TURGIDSON, 1964) {fmtM(TURGIDSON_TOPS)} · LOWEST FOUND {ownBest ? fmtM(ownBest.result.score.usDead) : '—'}
                </p>
                <p className="wopr-line wopr-line--plan">{describePlan(best.plan)}</p>
                {resum && 'result' in resum && (
                  <p className="wopr-line wopr-line--plan">
                    RE-SUMMED BY THE UNION{resum.plan !== best.plan ? ' (AN EARLIER BEST)' : ''}: {fmtFull(resum.result.total)} DEAD · AMERICAN {fmtM(resum.result.usDead)} · SOVIET {fmtM(resum.result.suDead)} · {resum.result.usDetonations + resum.result.suDetonations} DETONATIONS COUNTED ONCE PER PERSON · SURROGATE {fmtM(resum.surrogate)}
                  </p>
                )}
              </>
            )
          ) : (
            <p className="wopr-line wopr-line--big">{calibrating ? 'CALIBRATING' : 'NO ADMISSIBLE PLAN YET'}</p>
          )}
          {!best && current && <p className="wopr-line wopr-line--plan">{describePlan(current)}</p>}
        </div>
        <ol className="wopr-log" aria-label="Run log">
          {lines.map((l, i) => (
            <li key={l.id} className={`wopr-log-line wopr-log-line--${l.kind}${i === lines.length - 1 ? ' is-new' : ''}`}>
              <span className="wopr-log-at">{l.at}</span>
              <span className="wopr-log-text">{l.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="wopr-controls" aria-label="Objective and constraints">
        <div className="wopr-group">
          <span className="clock-label">Objective</span>
          {OBJECTIVES.map((o) => (
            <button key={o.id} type="button" className={o.id === objective ? 'is-active' : ''} onClick={() => changeObjective(o.id)} title={o.line}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="wopr-group">
          <span className="clock-label">Soviet first strike</span>
          {(['counterforce', 'countervalue', 'mixed'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={r === sovietRule ? 'is-active' : ''}
              onClick={() => {
                setSovietRule(r)
                sovietRuleRef.current = r
                reset(`SCENARIO SET · SOVIET FIRST STRIKE ${scenarioLabel(r)}`)
              }}
            >
              {r === 'counterforce' ? 'On the forces' : r === 'countervalue' ? 'On the cities' : 'Mixed'}
            </button>
          ))}
        </div>
        <div className="wopr-group">
          <span className="clock-label">Constraints</span>
          <button type="button" className={constraints.generalWar ? 'is-active' : ''} onClick={() => changeConstraints({ generalWar: !constraints.generalWar })}>
            General war
          </button>
          <button type="button" className={constraints.minCoverage > 0 ? 'is-active' : ''} disabled={!constraints.generalWar} onClick={() => changeConstraints({ minCoverage: constraints.minCoverage > 0 ? 0 : 0.95 })}>
            Coverage 95%
          </button>
          <button type="button" className={constraints.retaliatory ? 'is-active' : ''} disabled={!constraints.generalWar} onClick={() => changeConstraints({ retaliatory: !constraints.retaliatory })}>
            Retaliation
          </button>
        </div>
        <div className="wopr-group">
          <button
            type="button"
            onClick={() => {
              if (running) {
                say(`HOLD · ITER ${pad6(state.current.iteration)}`)
                flush()
              }
              setRunning((r) => !r)
            }}
          >
            {running ? 'Hold' : 'Run'}
          </button>
          <button type="button" onClick={() => reset('RESTART REQUESTED')}>
            Restart
          </button>
          <button type="button" onClick={() => setMatrixOpen((m) => !m)}>
            The matrix
          </button>
          <button
            type="button"
            disabled={!best || idle || (resum !== null && 'done' in resum)}
            title="Lay the best plan down weapon by weapon and count every person once, as the studies do"
            onClick={() => {
              if (!best || !table) return
              const plan = best.plan
              const surrogate = best.result.score.total
              setResum({ plan, done: 0, total: 0 })
              say(`RE-SUM BY THE UNION · BEST OF ITER ${pad6(best.iteration)} · LAYING DOWN`, 'resum')
              flush()
              resumByUnion(posture, table, plan, constraintsRef.current, (done, total) => {
                setResum({ plan, done, total })
                say(`RE-SUM BY THE UNION · ${done} / ${total} DETONATIONS`, 'resum', true)
                flush()
              })
                .then((result) => {
                  setResum({ plan, result, surrogate })
                  say(`UNION · ${fmtFull(result.total)} DEAD · AMERICAN ${fmtM(result.usDead)} · SOVIET ${fmtM(result.suDead)} · ${result.usDetonations + result.suDetonations} DETONATIONS COUNTED ONCE PER PERSON · SURROGATE SAID ${fmtM(surrogate)}`, 'best')
                  flush()
                })
                .catch((e: Error) => {
                  setError(e.message)
                  setResum(null)
                  say(`FAULT · ${e.message.toUpperCase()}`, 'mark')
                  flush()
                })
            }}
          >
            Re-sum by the union
          </button>
          <button
            type="button"
            onClick={() => {
              clearTable()
              window.location.reload()
            }}
            title="Recompute the target-by-weapon matrix from the grid"
          >
            Recalibrate
          </button>
        </div>
        {Object.keys(perObjective).length > 0 && (
          <table className="wopr-objectives">
            <thead>
              <tr>
                <th>Each objective's own best</th>
                <th>Dead</th>
                <th>American</th>
                <th>Soviet</th>
              </tr>
            </thead>
            <tbody>
              {OBJECTIVES.map((o) => {
                const b = perObjective[o.id]
                return (
                  <tr key={o.id} className={o.id === objective ? 'is-fire' : ''}>
                    <td>{o.label}</td>
                    <td>{b ? fmtM(b.result.score.total) : '—'}</td>
                    <td>{b ? fmtM(b.result.score.usDead) : '—'}</td>
                    <td>{b ? fmtM(b.result.score.suDead) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {matrixOpen && table && (
          <div className="wopr-matrix">
            <p className="clock-label">The target-by-weapon matrix · {gridName}</p>
            {matrixRows && (
              <table className="wopr-objectives">
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Category</th>
                    <th>Assignment</th>
                    <th>Dead, one detonation</th>
                    <th>Dead, all laid down</th>
                  </tr>
                </thead>
                <tbody>
                  {[...matrixRows.su, ...matrixRows.us].map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.category}</td>
                      <td>
                        {r.weapon}
                        <br />
                        <span className="wopr-dim">{r.system}</span>
                      </td>
                      <td>{fmtM(r.dead)}</td>
                      <td>{fmtM(r.laid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="wopr-note">
              A plausible assignment inside the planners' rules, by the SIOP's categories and the systems of 1983: the megaton class on hard command, two W78 per silo on the ICBM fields, the SLBMs on time-urgent bomber and submarine bases, the W76 on urban-industrial areas by population with the W78 on the largest; SS-18 two to one on the Minuteman silos, the forward Yankees on the bases and command, the SS-11 and the reserve on the cities. The SIOP itself is withheld. For every target the dead from one detonation of the assigned class, and from the assigned number laid down over the area and counted once per person, were computed by the exposure workers over the 1985 grid, the DCPA bands for blast and Postol's bound for fire, and kept in this browser; a plan is scored as the sum over struck targets, between those two figures by the number of weapons that arrive, without the union's once-only counting across neighbouring targets. Re-sum by the union lays the best plan down weapon by weapon and counts every person once. Seeds draw reliability, accuracy and penetration inside their published ranges.
            </p>
          </div>
        )}
      </section>
      <a className="loop-exit" href="#/">
        EXIT
      </a>
    </div>
  )
}

