import { useEffect, useRef, useState } from 'react'
import { formatGrid } from '../geo/geodesy.ts'
import type { Study } from '../studies/study.ts'
import { POWER_IDS, POWERS, type Power } from './forces.ts'
import { readProfile } from './profile.ts'
import { useFold } from '../hud/collapse.ts'
import { fetchLandUse } from './landuse.ts'
import { describeAimPoints, planStrike, PROFILE_RINGS, type DeliveryPreference, type Loading, type StrikePlan } from './solver.ts'
import type { AimPointMark } from '../map/atlas.ts'
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

/** How long the veil has to close before the study engine takes over. */
export const HANDOVER_MS = 700
const COUNTDOWN = 10
const CADENCE_MS = 550

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function StrikeConsole({ target, boundary, onLaunch, onLaunching, onStandDown, onAimPoint, onClearAimPoints, onShare, initialAdversary = null, initialDelivery = 'best', initialLoading = 'deployed', initialSite = null }: { target: AtlasTarget; boundary: Boundary | null; onLaunch: (study: Study) => void; onLaunching?: () => void; onStandDown: () => void; onAimPoint?: (point: AimPointMark) => void; onClearAimPoints?: () => void; onShare?: (choices: { adversary: Power | null; delivery: DeliveryPreference; loading: Loading; site?: string | null }) => string | null; initialAdversary?: Power | null; initialDelivery?: DeliveryPreference; initialLoading?: Loading; initialSite?: string | null }) {
  const boundaryRef = useRef(boundary)
  useEffect(() => {
    boundaryRef.current = boundary
  }, [boundary])
  const [lines, setLines] = useState<Line[]>([])
  const [phase, setPhase] = useState<'reasoning' | 'countdown' | 'failed' | 'launching'>('reasoning')
  const [held, setHeld] = useState(false)
  const [count, setCount] = useState(COUNTDOWN)
  const [override, setOverride] = useState<Power | null>(initialAdversary)
  const [pickOpen, setPickOpen] = useState(false)
  const [prefer, setPrefer] = useState<DeliveryPreference>(initialDelivery)
  const [loading, setLoading] = useState<Loading>(initialLoading)
  // The launch point: named by a shared link, or drawn on the target's own seed,
  // or re-drawn by the reader asking for another profile.
  const [site, setSite] = useState<string | null>(initialSite)
  const [variant, setVariant] = useState(0)
  /*
   * The link, shown rather than only copied. A clipboard write can fail, and on
   * a phone the place it would have been reported — the console log — is in the
   * console's own upper case with letters spaced out, which is the one register
   * a URL cannot be read in. So the link appears in a field of its own, in its
   * own case, selected, where it can be copied by hand if the clipboard would
   * not take it.
   */
  const [link, setLink] = useState<string | null>(null)
  const linkField = useRef<HTMLInputElement>(null)
  const chosen = useRef<string | null>(initialSite)
  // The setup controls fold away; the actions during a countdown do not.
  const fold = useFold('strike')
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
    const made = onShare?.({ adversary: override, delivery: prefer, loading, site: chosen.current }) ?? null
    /*
     * A shown link names one strike, and the console goes on choosing things
     * after it is shown — the launch site is drawn during the reasoning. So the
     * field is refreshed rather than emptied: once it is up it always names the
     * strike on the screen, and it never disappears from under a thumb that was
     * about to copy it.
     */
    setLink((shown) => (shown ? made : null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override, prefer, loading, site, variant])

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
      say('READING THE GROUND · OPENSTREETMAP LAND USE WITHIN 2.5 KM', 'calib', true)
      const [profile, wind, land] = await Promise.all([
        readProfile(target).catch((e: Error) => {
          say(`GRID UNREADABLE · ${e.message.toUpperCase()}`, 'mark')
          return null
        }),
        fetchWindAloft(target.position, controller.signal),
        // The ground is worth asking for and nothing waits on it: Overpass is a live service and it fails.
        fetchLandUse(target.position, 2_500, controller.signal),
      ])
      if (cancelled) return
      if (!profile) {
        setPhase('failed')
        return
      }
      say(`POPULATION · ${PROFILE_RINGS.map((r) => `${r / 1000} KM ${Math.round(profile.within[r]).toLocaleString('en-GB')}`).join(' · ')} · ${profile.gridName.toUpperCase()}`, 'calib', true)
      await sleep(CADENCE_MS)
      const plan = planStrike(target, profile, override ?? undefined, true, prefer, loading, site ?? undefined, variant, land)
      chosen.current = 'failure' in plan ? null : plan.delivery.site.id
      onClearAimPoints?.()
      // The aim points land on the globe as their lines print.
      const aims = 'failure' in plan ? [] : describeAimPoints(plan.sizing, target.position, plan.classification)
      const cep = 'failure' in plan ? 0 : plan.delivery.site.cepMetres
      const place = (i: number) => {
        const a = aims[i]
        if (a) onAimPoint?.({ index: a.index, position: a.position, cepMetres: cep, label: a.index === 0 ? `AIM POINT 1 · CENTRE · CEP ${cep} M` : `AIM POINT ${a.index + 1} · ${(a.distanceMetres / 1000).toFixed(1)} KM AT ${Math.round(a.bearingDeg).toString().padStart(3, '0')}°` })
      }
      for (const line of plan.lines) {
        if (cancelled) return
        await waitWhileHeld()
        say(line, /^SELECTED|^LAYDOWN|^APPROACH/.test(line) ? 'best' : 'plain')
        const one = /^AIM POINT (\d+) /.exec(line)
        const rest = /^AIM POINTS (\d+) TO (\d+)/.exec(line)
        if (one) place(Number(one[1]) - 1)
        if (rest) {
          for (let i = Number(rest[1]) - 1; i < Number(rest[2]); i += 1) {
            if (cancelled) return
            place(i)
            await sleep(120)
          }
        }
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
      // The engine is about to be handed the strike, which means one globe is
      // torn down and another built. Saying so here gives the app the moment
      // it needs to draw the veil over that, so the reader sees a cut rather
      // than a flash of nothing.
      onLaunching?.()
      await sleep(HANDOVER_MS)
      if (!cancelled) onLaunch(buildStrikeStudy(plan as StrikePlan, wind, undefined, boundaryRef.current))
    }
    void run()
    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, override, prefer, loading, site, variant])

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
        <button
          type="button"
          title="A link that re-runs this strike: the target by its OpenStreetMap id and the choices made here"
          onClick={() => {
            const made = onShare?.({ adversary: override, delivery: prefer, loading, site: chosen.current })
            if (!made) {
              say('NO LINK · THE TARGET HAS NO OPENSTREETMAP ID TO NAME IT BY', 'mark')
              return
            }
            setLink(made)
            // Shown first and copied second: the field is the thing that works
            // everywhere, and the clipboard is the convenience on top of it.
            window.setTimeout(() => linkField.current?.select(), 0)
            navigator.clipboard?.writeText(made).then(
              () => say('LINK COPIED · IT RE-RUNS THIS STRIKE WITH THE WIND OF ITS OWN HOUR', 'mark'),
              () => say('LINK READY BELOW · THIS BROWSER WOULD NOT TAKE IT TO THE CLIPBOARD', 'mark'),
            )
          }}
        >
          Share
        </button>
        <button type="button" className={`panel-fold-toggle${fold.folded ? '' : ' is-active'}`} aria-expanded={!fold.folded} onClick={fold.toggle}>
          {fold.label}
        </button>
      </div>
      {link && (
        <div className="wopr-group strike-share">
          <span className="clock-label">Link</span>
          <input
            ref={linkField}
            className="strike-share-link"
            type="text"
            readOnly
            value={link}
            aria-label="A link that re-runs this strike"
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
          />
        </div>
      )}
      {/* Everything that is chosen once rather than watched: on a phone it folds away and the globe keeps the screen. */}
      <div className={`panel-fold${fold.folded ? ' is-folded' : ''}`}>
      <div className="wopr-group strike-controls">
        <button
          type="button"
          title="Draw another launch point from the options that score as well as the best: a different service, a different profile, the same target"
          disabled={phase === 'launching'}
          onClick={() => {
            setSite(null)
            setVariant((v) => v + 1)
          }}
        >
          Another profile
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
        <span className="clock-label">Loading</span>
        {(['deployed', 'full'] as const).map((l) => (
          <button
            key={l}
            type="button"
            className={loading === l ? 'is-active' : ''}
            disabled={phase === 'launching'}
            title={l === 'deployed' ? 'Warheads per missile as the Nuclear Notebook gives the deployed loads' : 'Every missile at its capacity: Trident at eight, Minuteman at three, the DF-41 at ten'}
            onClick={() => {
              if (l === loading) return
              skipRef.current = false
              heldRef.current = false
              setHeld(false)
              setLines([])
              setLoading(l)
            }}
          >
            {l === 'deployed' ? 'Deployed loads' : 'Full loading'}
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
      </div>
    </section>
  )
}
