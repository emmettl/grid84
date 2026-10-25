import { useEffect, useMemo, useRef, useState } from 'react'
import { Hud } from '../hud/Hud.tsx'
import { createAtlas, type Atlas, type AtlasPhase } from '../map/atlas.ts'
import { StudyView } from '../studies/StudyView.tsx'
import { StrikeConsole } from './StrikeConsole.tsx'
import { createBoundaryLoader, type Boundary } from './boundary.ts'
import { lookupTarget, strikeHash } from './lookup.ts'
import type { Power } from './forces.ts'
import type { DeliveryPreference, Loading } from './solver.ts'
import type { AtlasTarget } from './target.ts'
import type { Study } from '../studies/study.ts'

export function AtlasView({ strike }: { strike?: { ref: string; adversary: string | null; delivery: string | null; loading: string | null; site: string | null } }) {
  const [study, setStudy] = useState<Study | null>(null)
  /**
   * The handover from the console to the study engine tears down one globe and
   * builds another, and between the two there is nothing to look at. A veil
   * closes over the atlas while the console counts the last second, holds
   * through the swap, and opens on the study: the reader sees a cut, which is
   * what the moment is, rather than a flash of empty page.
   */
  const [veil, setVeil] = useState<'open' | 'closing' | 'closed'>('open')
  // Coming back from a strike returns to a clean atlas: the search box empty,
  // the target released, the globe back on standby. The counter remounts it,
  // and the shared-strike preset is dropped so it is not acquired again.
  const [runs, setRuns] = useState(0)
  // The preset is dropped by naming the one that has been used rather than by
  // copying it into state, so a new shared link still arrives.
  const [dropped, setDropped] = useState<typeof strike>(undefined)
  const preset = strike && strike !== dropped ? strike : undefined
  if (study) {
    return (
      <>
        <StudyView key={study.id} study={study} autoplay={{ rate: 20 }} />
        <Veil state={veil} onShown={() => setVeil('open')} />
        <button
          type="button"
          className="loop-exit"
          onClick={() => {
            setStudy(null)
            setVeil('open')
            setDropped(strike)
            setRuns((r) => r + 1)
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/atlas`)
          }}
        >
          BACK TO THE ATLAS
        </button>
      </>
    )
  }
  return (
    <>
      <AtlasGlobe key={runs} onLaunch={setStudy} onLaunching={() => setVeil('closing')} preset={preset} />
      <Veil state={veil} />
    </>
  )
}

/**
 * The veil. Closed it is the page's own ground, so what shows through the
 * moment is the colour everything else is drawn on rather than black.
 */
function Veil({ state, onShown }: { state: 'open' | 'closing' | 'closed'; onShown?: () => void }) {
  useEffect(() => {
    if (!onShown) return
    // On the far side of the swap the study is mounted; give it a frame to
    // paint its first view before the veil opens on it.
    const t = window.setTimeout(onShown, 260)
    return () => window.clearTimeout(t)
  }, [onShown])
  return <div className={`handover-veil handover-veil--${state}`} aria-hidden="true" />
}

function AtlasGlobe({ onLaunch, onLaunching, preset }: { onLaunch: (study: Study) => void; onLaunching?: () => void; preset?: { ref: string; adversary: string | null; delivery: string | null; loading: string | null; site: string | null } }) {
  const container = useRef<HTMLDivElement>(null)
  const atlas = useRef<Atlas | null>(null)
  const [phase, setPhase] = useState<AtlasPhase>({ kind: 'standby' })
  const [stoodDown, setStoodDown] = useState<string | null>(null)
  const [presetName, setPresetName] = useState<string | null>(null)
  const boundaryLoader = useMemo(() => createBoundaryLoader(), [])

  useEffect(() => () => boundaryLoader.cancel(), [boundaryLoader])

  useEffect(() => {
    if (!container.current) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const instance = createAtlas(container.current, { onPhase: setPhase, reducedMotion })
    atlas.current = instance
    return () => {
      atlas.current = null
      instance.destroy()
    }
  }, [])

  const [boundary, setBoundary] = useState<{ id: string; boundary: Boundary | null }>({ id: '', boundary: null })
  const acquire = (target: AtlasTarget) => {
    atlas.current?.acquire(target)
    atlas.current?.showBoundary(target, null)
    setBoundary({ id: target.id, boundary: null })
    void boundaryLoader.load(target, (b) => {
      setBoundary({ id: target.id, boundary: b })
      atlas.current?.showBoundary(target, b)
    })
  }
  // A shared link names the target by its OpenStreetMap id: look it up once and acquire it.
  const presetRef = preset?.ref ?? null
  useEffect(() => {
    if (!presetRef) return
    let cancelled = false
    lookupTarget(presetRef)
      .then((t) => {
        if (cancelled || !t) return
        setPresetName(t.name)
        acquire(t)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetRef])
  const acquired = phase.kind === 'acquired' ? phase.report.target : null

  /*
   * The tab names what is on the screen. A shared strike link arrives naming
   * only an OpenStreetMap id, so until the lookup comes back there is nothing
   * to say and the generic line stands; after it, the tab carries the place,
   * and a link that was shared as a strike says that it is one. It matters
   * more here than anywhere else on the site: a strike is the one thing this
   * engine makes that people send to each other, and half a dozen of them open
   * in a browser were until now half a dozen tabs all called Terminal Atlas.
   */
  // Standing down releases the target, so the tab lets go of the name too.
  const released = acquired !== null && stoodDown === acquired.id
  const named = released ? null : (acquired?.name ?? presetName)
  useEffect(() => {
    document.title = named ? `Grid/84 · ${preset ? 'A strike on ' : ''}${named}` : 'Grid/84 · Terminal Atlas'
  }, [named, preset])

  const share = (choices: { adversary: Power | null; delivery: DeliveryPreference; loading: Loading; site?: string | null }): string | null => {
    if (!acquired) return null
    const hash = strikeHash(acquired, choices)
    if (!hash) return null
    // The address bar carries the strike without a navigation; the link is what gets shared.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    /*
     * The shared link points at a path rather than at the root, because a hash
     * fragment is never sent to a server and a crawler asked to preview a
     * shared strike would be handed the front page's card. `/strike/` is a
     * prerendered page with a card of its own that says what the link is, and
     * it passes any hash it is given straight through to the app.
     *
     * Built from the base rather than from the current path: after a shared
     * link has been followed the browser is already under that page, and
     * sharing again from there would otherwise name it twice.
     */
    const base = new URL(import.meta.env.BASE_URL, window.location.origin).pathname
    return `${window.location.origin}${base}strike/${hash}`
  }
  return (
    <>
      <div ref={container} className="atlas-map" aria-label="Grid/84 globe" />
      <div className="atlas-vignette" aria-hidden="true" />
      <Hud phase={phase} onAcquire={acquire} consoleOpen={!!acquired && stoodDown !== acquired.id} presetName={presetName} />
      {acquired && stoodDown !== acquired.id && <StrikeConsole key={acquired.id} target={acquired} boundary={boundary.id === acquired.id ? boundary.boundary : null} initialAdversary={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) ? (preset.adversary as Power | null) : null} initialDelivery={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) ? ((preset.delivery as DeliveryPreference | null) ?? 'best') : 'best'} initialLoading={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) && preset.loading === 'full' ? 'full' : 'deployed'} initialSite={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) ? preset.site : null} onShare={share} onLaunch={onLaunch} onLaunching={onLaunching} onStandDown={() => {
            boundaryLoader.cancel()
            atlas.current?.clearAimPoints()
            setStoodDown(acquired.id)
          }} onAimPoint={(p) => atlas.current?.addAimPoint(p)} onClearAimPoints={() => atlas.current?.clearAimPoints()} />}
    </>
  )
}
