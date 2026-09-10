import { useEffect, useMemo, useRef, useState } from 'react'
import type { Study } from './study.ts'
import { StudyView, type LoopResult } from './StudyView.tsx'
import { ALERT_FORCE, forceForOption } from './siop62/alert-force.ts'
import { cubaGeneral } from './cuba62/crisis.ts'
import { defcon3Execute } from './defcon3/posture.ts'
import { ableArcher } from './able-archer/war-scare.ts'
import { britainSquareLeg } from './britain/protect.ts'
import { seventyTwoMinutes } from './minutes72/scenario.ts'

/**
 * The loop. The engine runs its scenarios one after another with the camera
 * orbiting and the chrome stripped to the clock, and each ends on its
 * number. Nothing is said about the number. The reader draws the conclusion.
 */

interface Scenario {
  id: string
  /** One line above the number: what ran. */
  line: string
  build: () => Study
}

const SCENARIOS: Scenario[] = [
  { id: 'alert-1', line: 'SIOP-62 · OPTION 1 · THE ALERT FORCE · DECEMBER 1961', build: () => ALERT_FORCE.study },
  { id: '72-film', line: 'ONE MISSILE AT CHICAGO · TWO INTERCEPTORS AS FILMED · THE PRESENT', build: () => seventyTwoMinutes('film') },
  { id: 'cuba-general', line: 'SIOP-63 · THE FORCE OF OCTOBER 1962 AFTER A MONTH AT DEFCON 2', build: () => cubaGeneral() },
  { id: '72-salvo', line: 'SEVENTEEN MISSILES · FORTY-FOUR INTERCEPTORS AT THE TEST RECORD · THE PRESENT', build: () => seventyTwoMinutes('salvo') },
  { id: 'defcon3', line: 'SIOP-4 · THE FORCE OF 24 OCTOBER 1973 · LAUNCH ON WARNING', build: () => defcon3Execute() },
  { id: '72-claim', line: 'ONE MISSILE AT CHICAGO · INTERCEPTORS AT THE AGENCY\'S CLAIM · THE PRESENT', build: () => seventyTwoMinutes('claim') },
  { id: 'able-archer', line: 'ABLE ARCHER 83 · THE THEATRE WAR · NOVEMBER 1983', build: () => ableArcher() },
  { id: 'britain', line: 'SQUARE LEG · 150 WEAPONS ON BRITAIN · SEPTEMBER 1980', build: () => britainSquareLeg() },
  { id: '72-book', line: 'SEVENTY-TWO MINUTES · JACOBSEN · THE PRESENT', build: () => seventyTwoMinutes('book') },
  { id: 'alert-14', line: 'SIOP-62 · OPTION 14 · FOURTEEN HOURS OF PREPARATION · DECEMBER 1961', build: () => forceForOption(14).study },
  { id: '72-record', line: 'ONE MISSILE AT CHICAGO · INTERCEPTORS AT THE TEST RECORD · THE PRESENT', build: () => seventyTwoMinutes('record') },
]

/** Each run takes about this long on the wall clock, whatever the study's span. */
const RUN_SECONDS = 45
const HOLD_MS = 9_000

const fmt = (v: number | null) => (v === null ? '—' : v < 1_000_000 ? Math.round(v).toLocaleString('en-GB') : `${(Math.round(v / 100_000) / 10).toLocaleString('en-GB')} M`)

export function LoopView() {
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<LoopResult | null>(null)
  const [run, setRun] = useState(0)
  const timer = useRef<number | null>(null)
  const scenario = SCENARIOS[index % SCENARIOS.length]
  const study = useMemo(() => scenario.build(), [scenario])
  const rate = useMemo(() => Math.max(60, Math.ceil((study.bounds.end - (study.startTime ?? study.bounds.start)) / RUN_SECONDS)), [study])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const onFinished = (r: LoopResult) => {
    setResult(r)
    timer.current = window.setTimeout(() => {
      setResult(null)
      setIndex((i) => i + 1)
      setRun((n) => n + 1)
    }, HOLD_MS)
  }

  const sides = result ? [result.attacker, result.defender].filter((s) => s.detonations > 0) : []
  return (
    <div className="loop">
      <StudyView key={`${scenario.id}-${run}`} study={study} loop={{ rate, onFinished }} />
      <div className="loop-line" aria-live="polite">
        <span>RUN {String(index + 1).padStart(2, '0')}</span>
        <span>{scenario.line}</span>
      </div>
      {result && (
        <div className="loop-tally" role="status">
          {sides.map((s) => (
            <div key={s.name} className="loop-side">
              <span className="loop-side-name">{s.name.toUpperCase()}</span>
              <strong>{fmt(s.dead)}</strong>
              <span className="loop-side-note">
                DEAD · {fmt(s.injured)} INJURED · {s.detonations.toLocaleString('en-GB')} DETONATIONS · {s.method === 'union' ? 'EACH PERSON COUNTED ONCE' : s.method === 'summed' ? 'SUMMED PER TARGET' : 'NOT COMPUTED'}
              </span>
            </div>
          ))}
          {sides.length === 0 && (
            <div className="loop-side">
              <strong>0</strong>
              <span className="loop-side-note">NO DETONATION</span>
            </div>
          )}
        </div>
      )}
      <a className="loop-exit" href="#/">
        EXIT
      </a>
    </div>
  )
}
