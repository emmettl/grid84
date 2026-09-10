import { useEffect, useRef, useState } from 'react'
import { formatGrid } from '../geo/geodesy.ts'
import type { Study } from '../studies/study.ts'
import { POWER_IDS, POWERS, type Power } from './forces.ts'
import { readProfile } from './profile.ts'
import { planStrike, PROFILE_RINGS, type DeliveryPreference, type StrikePlan } from './solver.ts'
import { buildStrikeStudy } from './strike-study.ts'
import type { AtlasTarget } from './target.ts'
import { fetchWindAloft } from './wind.ts'
import type { Boundary } from './boundary.ts'

/**
 * The strike console: once the atlas has a target, the solver reasons aloud
 * on a teletype, reads the grid and the wind, counts down and hands the
 * generated study to the engine. The reader can hold, stand down, skip the
 * countdown, or overrule the adversary.
 */

interface Line {
  id: number
  at: string
  text: string
  kind: 'plain' | 'best' | 'mark' | 'calib'
}

const COUNTDOWN = 10
const CADENCE_MS = 550

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function StrikeConsole({ target, boundary, onLaunch, onStandDown }: { target: AtlasTarget; boundary: Boundary | null; onLaunch: (study: Study) => void; onStandDown: () => void }) {
  const boundaryRef = useRef(boundary)
  useEffect(() => {
    boundaryRef.current = boundary
  }, [boundary])
  const [lines, setLines] = useState<Line[]>([])
  const [phase, setPhase] = useState<'reasoning' | 'countdown' | 'failed' | 'launching'>('reasoning')
  const [held, setHeld] = useState(false)
  const [count, setCount] = useState(COUNTDOWN)
  const [override, setOverride] = useState<Power | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [prefer, setPrefer] = useState<DeliveryPreference>('best')
  const heldRef = useRef(false)
  const skipRef = useRef(false)
  const started = useRef(performance.now())
  const next = useRef(1)
  const opened = useRef(false)

  const say = (text: string, kind: Line['kind'] = 'plain', replace = false) => {
    const elapsed = Math.round((performance.now() - started.current) / 1000)
    const at = `T+${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
    setLines((prev) => {
      const last = prev[prev.length - 1]
      if (replace && last && last.kind === kind) return [...prev.slice(0, -1), { ...last, at, text }]
      const id = next.current
      next.current += 1
      return [...prev.slice(-60), { id, at, text, kind }]
    })
  }

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const waitWhileHeld = async () => {
      while (heldRef.current && !cancelled) await sleep(200)
    }
    const run = async () => {
      setPhase('reasoning')
      setCount(COUNTDOWN)
      // Development remounts the effect; the opening is written once.
      if (!opened.current) say(`TARGET ACQUIRED · ${target.name.toUpperCase()} · ${target.countryCode} · ${formatGrid(target.position)}`, 'mark')
      opened.current = true
      say('READING THE 2025 GRID', 'calib', true)
      const [profile, wind] = await Promise.all([
        readProfile(target).catch((e: Error) => {
          say(`GRID UNREADABLE · ${e.message.toUpperCase()}`, 'mark')
          return null
        }),
        fetchWindAloft(target.position, controller.signal),
      ])
      if (cancelled) return
      if (!profile) {
        setPhase('failed')
        return
      }
      say(`POPULATION · ${PROFILE_RINGS.map((r) => `${r / 1000} KM ${Math.round(profile.within[r]).toLocaleString('en-GB')}`).join(' · ')} · ${profile.gridName.toUpperCase()}`, 'calib', true)
      await sleep(CADENCE_MS)
      const plan = planStrike(target, profile, override ?? undefined, true, prefer)
      for (const line of plan.lines) {
        if (cancelled) return
        await waitWhileHeld()
        say(line, /^SELECTED|^LAYDOWN/.test(line) ? 'best' : 'plain')
        await sleep(CADENCE_MS)
      }
      if ('failure' in plan) {
        say(plan.failure, 'mark')
        say('STAND DOWN · OR SET ANOTHER ADVERSARY', 'mark')
        setPhase('failed')
        return
      }
      say(`WIND · EFFECTIVE, ${wind.level.toUpperCase()} · FROM ${Math.round(wind.fromDeg)}° AT ${Math.round(wind.mph)} MPH · SHEAR ${Math.round(wind.shearDeg)}° · PLUME BEARS ${Math.round((wind.fromDeg + 180) % 360)}°${wind.surfaceMph !== null ? ` · SURFACE FROM ${Math.round(wind.surfaceFromDeg ?? 0)}° AT ${Math.round(wind.surfaceMph)} MPH` : ''} · ${wind.live ? `OPEN-METEO, ${wind.samples} SAMPLES` : 'ASSUMED; THE WEATHER SERVICE WAS NOT REACHED'}`)
      await sleep(CADENCE_MS)
      say(`BEARING ${Math.round(plan.bearingDeg)}° · ${Math.round(plan.delivery.distanceMetres / 1000).toLocaleString('en-GB')} KM · FLIGHT ${Math.round(plan.delivery.flightSeconds / 60)} MIN · COUNTDOWN`, 'best')
      setPhase('countdown')
      for (let c = COUNTDOWN; c > 0; c -= 1) {
        if (cancelled) return
        await waitWhileHeld()
        if (skipRef.current) break
        setCount(c)
        say(`T MINUS ${c}`, 'calib', true)
        await sleep(1_000)
      }
      if (cancelled) return
      say('LAUNCH · THE STUDY ENGINE TAKES THE STRIKE FROM HERE', 'mark')
      setPhase('launching')
      await sleep(600)
      if (!cancelled) onLaunch(buildStrikeStudy(plan as StrikePlan, wind, 5, boundaryRef.current))
    }
    void run()
    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, override, prefer])

  const toggleHold = () => {
    heldRef.current = !heldRef.current
    setHeld(heldRef.current)
    say(heldRef.current ? 'HOLD' : 'RESUME', 'mark')
  }

  return (
    <section className="strike-console" aria-live="polite" aria-label="Strike console">
      <p className="wopr-line wopr-line--title">
        STRIKE CONSOLE · {phase === 'countdown' ? `T MINUS ${count}` : phase.toUpperCase()}
        {phase !== 'failed' && !held && <span className="wopr-cursor" />}
      </p>
      <ol className="wopr-log strike-log">
        {lines.map((l, i) => (
          <li key={l.id} className={`wopr-log-line wopr-log-line--${l.kind}${i === lines.length - 1 ? ' is-new' : ''}`}>
            <span className="wopr-log-at">{l.at}</span>
            <span className="wopr-log-text">{l.text}</span>
          </li>
        ))}
      </ol>
      <div className="wopr-group strike-controls">
        <button type="button" onClick={toggleHold} disabled={phase === 'failed' || phase === 'launching'}>
          {held ? 'Resume' : 'Hold'}
        </button>
        <button
          type="button"
          disabled={phase !== 'countdown' || held}
          onClick={() => {
            skipRef.current = true
          }}
        >
          Vector now
        </button>
        <button type="button" onClick={onStandDown}>
          Stand down
        </button>
      </div>
      <div className="wopr-group strike-controls">
        <span className="clock-label">Delivery</span>
        {(['best', 'missile', 'aircraft'] as const).map((d) => (
          <button
            key={d}
            type="button"
            className={prefer === d ? 'is-active' : ''}
            disabled={phase === 'launching'}
            onClick={() => {
              if (d === prefer) return
              skipRef.current = false
              heldRef.current = false
              setHeld(false)
              setLines([])
              setPrefer(d)
            }}
          >
            {d === 'best' ? 'As the rule says' : d === 'missile' ? 'Missile' : 'Aircraft standoff'}
          </button>
        ))}
      </div>
      <div className="wopr-group strike-controls">
        <button type="button" className="strike-pick" onClick={() => setPickOpen((o) => !o)} disabled={phase === 'launching'} aria-expanded={pickOpen}>
          Adversary · {override ? POWERS[override].name : 'as the rule says'} · {pickOpen ? 'close' : 'change'}
        </button>
        {pickOpen && POWER_IDS.map((p) => (
          <button
            key={p}
            type="button"
            className={override === p ? 'is-active' : ''}
            disabled={phase === 'launching'}
            onClick={() => {
              skipRef.current = false
              heldRef.current = false
              setHeld(false)
              setLines([])
              setPickOpen(false)
              setOverride(p)
            }}
          >
            {POWERS[p].name}
          </button>
        ))}
      </div>
    </section>
  )
}
