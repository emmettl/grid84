import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { greatCirclePoints } from '../engine/track.ts'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { posture1983, type Posture1983 } from '../studies/window83/window.ts'
import { assignmentsOf, describePlan, evaluateSeeds, loss, OBJECTIVES, perturb, randomPlan, rng, yieldClass, SU_CLASSES, US_CLASSES, type Averaged, type Constraints, type DeathTable, type Objective, type Plan } from './model.ts'
import { buildTable, clearTable, type TableProgress } from './table.ts'

/**
 * WOPR. The globe turns; the machine searches the plan space of the 1983
 * posture for the plan that minimises the chosen loss under the planners'
 * constraints, and reports its best so far. It improves relentlessly. That
 * the number beside "optimal" is what it is, is the work.
 */

const SEEDS_FAST = 3
const SEEDS_REPORT = 16
const EVALS_PER_FRAME = 10
const RESTART_EVERY = 300
/** General Turgidson's bound, Dr. Strangelove (1964): "no more than ten to twenty million killed, tops... depending on the breaks." The stated acceptable own-side loss, printed beside what the search finds. */
const TURGIDSON_TOPS = 20_000_000

interface Best {
  plan: Plan
  result: Averaged
  iteration: number
  /** The loss under the objective this best was kept for. */
  loss: number
}

const fmtM = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : Math.round(v).toLocaleString('en-GB'))
const fmtFull = (v: number) => Math.round(v / 10_000) * 10_000 > 0 ? (Math.round(v / 10_000) * 10_000).toLocaleString('en-GB') : Math.round(v).toLocaleString('en-GB')

export function WoprView() {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const posture = useMemo<Posture1983>(() => posture1983(), [])
  const [table, setTable] = useState<DeathTable | null>(null)
  const [gridName, setGridName] = useState('')
  const [progress, setProgress] = useState<TableProgress>({ done: 0, total: 0 })
  const [objective, setObjective] = useState<Objective>('total')
  const [constraints, setConstraints] = useState<Constraints>({ generalWar: true, minCoverage: 0.95, retaliatory: true })
  const [sovietRule, setSovietRule] = useState<Plan['sovietRule']>('counterforce')
  const sovietRuleRef = useRef(sovietRule)
  useEffect(() => {
    sovietRuleRef.current = sovietRule
  }, [sovietRule])
  const [running, setRunning] = useState(true)
  const [iteration, setIteration] = useState(0)
  const [best, setBest] = useState<Best | null>(null)
  const [first, setFirst] = useState<Best | null>(null)
  const [perObjective, setPerObjective] = useState<Partial<Record<Objective, Best>>>({})
  const [current, setCurrent] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [matrixOpen, setMatrixOpen] = useState(false)
  const state = useRef({ plan: null as Plan | null, loss: Infinity, temperature: 1, iteration: 0, seed: 1, gen: rng(1), lastArcs: 0, perObjective: {} as Partial<Record<Objective, Best>>, perObjectiveDirty: false, best: null as Best | null, first: null as Best | null, bestDirty: false })
  const objectiveRef = useRef(objective)
  const constraintsRef = useRef(constraints)
  useEffect(() => {
    objectiveRef.current = objective
  }, [objective])
  useEffect(() => {
    constraintsRef.current = constraints
  }, [constraints])

  // The globe, turning, with a source for the occasional trajectory.
  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center: [-30, 50], zoom: 1.4 })
    mapRef.current = map
    let sync: ((force?: boolean) => void) | null = null
    let frame = 0
    map.on('load', () => {
      sync = installTerrainSync(map)
      map.addSource('wopr-arcs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'wopr-arcs', type: 'line', source: 'wopr-arcs', paint: { 'line-color': ['match', ['get', 'side'], 'us', 'rgba(141, 250, 255, 0.45)', 'rgba(255, 96, 96, 0.45)'], 'line-width': 1 } })
      const spin = () => {
        if (!map.isMoving()) {
          const c = map.getCenter()
          map.jumpTo({ center: [c.lng + 0.02, c.lat] })
        }
        frame = requestAnimationFrame(spin)
      }
      frame = requestAnimationFrame(spin)
    })
    return () => {
      cancelAnimationFrame(frame)
      sync?.(true)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // The matrix, once.
  useEffect(() => {
    let cancelled = false
    buildTable(posture, (p) => {
      if (!cancelled) setProgress(p)
    })
      .then((r) => {
        if (cancelled) return
        setTable(r.table)
        setGridName(r.gridName)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [posture])

  // The search, a few evaluations per tick while running. A timer rather than an animation frame, so the search goes on in a background tab at whatever rate the browser allows.
  useEffect(() => {
    if (!table || !running) return
    let frame = 0
    const st = state.current
    const step = () => {
      const c = constraintsRef.current
      const obj = objectiveRef.current
      for (let k = 0; k < EVALS_PER_FRAME; k += 1) {
        st.iteration += 1
        const opts = { allowIdle: !c.generalWar, sovietRule: sovietRuleRef.current }
        const candidate = st.plan && st.iteration % RESTART_EVERY !== 0 ? perturb(st.plan, st.gen, opts) : randomPlan(st.gen, opts)
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
            }
          }
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
      // A few trajectories of the plan under evaluation, now and then.
      const now = performance.now()
      if (now - st.lastArcs > 2_500 && st.plan) {
        st.lastArcs = now
        drawArcs(mapRef.current, posture, st.plan, st.gen)
      }
      frame = window.setTimeout(step, 16)
    }
    frame = window.setTimeout(step, 16)
    return () => window.clearTimeout(frame)
  }, [table, running, posture])

  const reset = () => {
    state.current = { plan: null, loss: Infinity, temperature: 1, iteration: 0, seed: state.current.seed + 1, gen: rng(state.current.seed + 1), lastArcs: 0, perObjective: {}, perObjectiveDirty: false, best: null, first: null, bestDirty: false }
    setBest(null)
    setFirst(null)
    setPerObjective({})
    setIteration(0)
  }
  const changeObjective = (o: Objective) => {
    setObjective(o)
    reset()
  }
  const changeConstraints = (patch: Partial<Constraints>) => {
    setConstraints((c) => ({ ...c, ...patch }))
    reset()
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
      const dead = table[id]?.[yieldClass(a.kt, classes)]?.fire ?? 0
      return { id, name, category: a.category, weapon: `${a.count} × ${a.warhead}`, system: a.system, dead }
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
      <section className="wopr-terminal" aria-live="polite">
        <p className="wopr-line wopr-line--title">WOPR · WAR OPERATION PLAN RESPONSE · POSTURE 1983</p>
        <p className="wopr-line">
          OBJECTIVE: {OBJECTIVES.find((o) => o.id === objective)?.label.toUpperCase()} · SCENARIO: SOVIET FIRST STRIKE {sovietRule === 'counterforce' ? 'ON THE FORCES' : sovietRule === 'countervalue' ? 'ON THE CITIES' : 'MIXED'}
        </p>
        <p className="wopr-line">
          CONSTRAINTS: {constraints.generalWar ? `GENERAL WAR = TRUE · COVERAGE ≥ ${Math.round(constraints.minCoverage * 100)}% · ${constraints.retaliatory ? 'RETALIATION > 0' : 'RETALIATION UNCONSTRAINED'}` : 'EXECUTION OPTIONAL · THE PLANNERS\' CONSTRAINTS ARE MOOT'}
        </p>
        {calibrating && !error && (
          <p className="wopr-line">
            CALIBRATING THE MATRIX {progress.total > 0 ? `${progress.done.toLocaleString('en-GB')} / ${progress.total.toLocaleString('en-GB')}` : ''}
            <span className="wopr-cursor" />
          </p>
        )}
        {error && <p className="wopr-line">FAULT: {error.toUpperCase()}</p>}
        {table && (
          <>
            <p className="wopr-line">ITERATION {String(iteration).padStart(6, '0')}</p>
            {best ? (
              idle ? (
                <>
                  <p className="wopr-line wopr-line--big">OPTIMAL POLICY: DO NOT LAUNCH</p>
                  <p className="wopr-line">0 DEAD · NEITHER SIDE LAUNCHES · ADMISSIBLE ONLY WHILE GENERAL WAR IS NOT IMPOSED</p>
                </>
              ) : (
                <>
                  <p className="wopr-line">BEST OUTCOME UPDATED AT ITERATION {String(best.iteration).padStart(6, '0')}</p>
                  <p className="wopr-line wopr-line--big">{fmtFull(best.result.score.total)} DEAD</p>
                  <p className="wopr-line">
                    AMERICAN {fmtM(best.result.score.usDead)} · SOVIET {fmtM(best.result.score.suDead)} · RANGE OVER {SEEDS_REPORT} SEEDS {fmtM(best.result.low)} TO {fmtM(best.result.high)}
                  </p>
                  <p className="wopr-line">
                    IMPROVEMENT {(improvement * 100).toFixed(improvement < 0.1 ? 2 : 1)}% ON ITERATION {String(first?.iteration ?? 1).padStart(6, '0')} ({fmtM(first?.result.score.total ?? 0)} DEAD)
                  </p>
                  <p className="wopr-line">
                    COVERAGE {Math.round(best.result.score.coverage * 100)}% · SOVIET URBAN POPULATION DESTROYED {Math.round(best.result.score.populationDestroyed * 100)}% · SILOS SURVIVING {Math.round(best.result.score.silosSurviving)} · RETALIATORY FORCE {fmtM(best.result.score.retaliatory)} WEAPONS
                  </p>
                  <p className="wopr-line">
                    OWN-SIDE DEAD {fmtM(best.result.score.usDead)} · DEPENDING ON THE BREAKS {fmtM(best.result.ownLow)} TO {fmtM(best.result.ownHigh)} · STATED ACCEPTABLE (TURGIDSON, 1964) {fmtM(TURGIDSON_TOPS)} · LOWEST FOUND {ownBest ? fmtM(ownBest.result.score.usDead) : '—'}
                  </p>
                  <p className="wopr-line wopr-line--plan">{describePlan(best.plan)}</p>
                </>
              )
            ) : (
              <p className="wopr-line">NO ADMISSIBLE PLAN YET{current ? ` · ${describePlan(current)}` : ''}</p>
            )}
            <p className="wopr-line">
              STATUS: {status}
              {running && !error && <span className="wopr-cursor" />}
            </p>
          </>
        )}
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
                reset()
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
          <button type="button" onClick={() => setRunning((r) => !r)}>
            {running ? 'Hold' : 'Run'}
          </button>
          <button type="button" onClick={reset}>
            Restart
          </button>
          <button type="button" onClick={() => setMatrixOpen((m) => !m)}>
            The matrix
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="wopr-note">
              A plausible assignment inside the planners' rules, by the SIOP's categories and the systems of 1983: the megaton class on hard command, two W78 per silo on the ICBM fields, the SLBMs on time-urgent bomber and submarine bases, the W76 on urban-industrial areas by population with the W78 on the largest; SS-18 two to one on the Minuteman silos, the forward Yankees on the bases and command, the SS-11 and the reserve on the cities. The SIOP itself is withheld. For every target the dead from one detonation of the assigned class were computed once by the exposure workers over the 1985 grid, the DCPA bands for blast and Postol's bound for fire, and kept in this browser; a plan is scored as the sum over struck targets with the largest weapon counting once, as the studies' log lines are, without the union's once-only counting across targets. Seeds draw reliability, accuracy and penetration inside their published ranges.
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

/** A handful of great circles from the plan under evaluation, drawn faintly and replaced a few seconds later. */
function drawArcs(map: MapLibreMap | null, posture: Posture1983, plan: Plan, gen: () => number): void {
  if (!map) return
  const source = map.getSource('wopr-arcs') as GeoJSONSource | undefined
  if (!source) return
  const pick = <T,>(xs: T[]) => xs[Math.floor(gen() * xs.length)]
  const features = []
  const n = 4 + Math.floor(gen() * 5)
  for (let i = 0; i < n; i += 1) {
    const soviet = gen() < 0.5
    if (soviet && plan.sovietOption >= 0.05) {
      const from = pick(posture.sovietHeavy).position
      const to = plan.sovietRule === 'countervalue' ? pick(posture.usCities).position : pick(posture.silos).position
      features.push({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: greatCirclePoints(from, to, 48).map((p) => [p[0], p[1]]) }, properties: { side: 'su' } })
    } else if (plan.usOption >= 0.05) {
      const from = gen() < 0.7 ? pick(posture.silos).position : pick(posture.usSlbmAtSea).position
      const to = plan.usRule === 'countervalue' ? pick(posture.sovietCities).position : pick(posture.sovietForces).position
      features.push({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: greatCirclePoints(from, to, 48).map((p) => [p[0], p[1]]) }, properties: { side: 'us' } })
    }
  }
  source.setData({ type: 'FeatureCollection', features })
}
