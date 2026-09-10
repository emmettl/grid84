import { useEffect, useMemo, useRef, useState } from 'react'
import { Hud } from './hud/Hud.tsx'
import { EVIDENCE_LAB } from './lab/evidence-lab.ts'
import { PopulationLab } from './lab/PopulationLab.tsx'
import { TerrainLab } from './lab/TerrainLab.tsx'
import { FalloutLab } from './lab/FalloutLab.tsx'
import { ReadinessLab } from './lab/ReadinessLab.tsx'
import { DefenceLab } from './lab/DefenceLab.tsx'
import { AccuracyLab } from './lab/AccuracyLab.tsx'
import { GuidanceLab } from './lab/GuidanceLab.tsx'
import { createAtlas, type Atlas, type AtlasPhase } from './map/atlas.ts'
import { SIOP62_PROOF } from './studies/siop62/proof.ts'
import { ALERT_FORCE, forceForOption } from './studies/siop62/alert-force.ts'
import { defcon3Execute, defcon3Giant, defcon3Posture } from './studies/defcon3/posture.ts'
import { cubaGeneral, cubaRegional } from './studies/cuba62/crisis.ts'
import { ableArcher } from './studies/able-archer/war-scare.ts'
import { britainSquareLeg, britainStrath } from './studies/britain/protect.ts'
import { seventyTwoMinutes } from './studies/minutes72/scenario.ts'
import { window83 } from './studies/window83/window.ts'
import { vForce } from './studies/vforce/vforce.ts'
import { StudyView } from './studies/StudyView.tsx'
import { FrontPage } from './front/FrontPage.tsx'
import { LoopView } from './studies/LoopView.tsx'
import { StrikeConsole } from './atlas/StrikeConsole.tsx'
import { fetchBoundary, type Boundary } from './atlas/boundary.ts'
import { lookupTarget, parseStrikeHash, strikeHash } from './atlas/lookup.ts'
import type { Power } from './atlas/forces.ts'
import type { DeliveryPreference, Loading } from './atlas/solver.ts'
import type { AtlasTarget } from './atlas/target.ts'
import type { Study } from './studies/study.ts'
import { WoprView } from './wopr/WoprView.tsx'
import { Chronicle } from './chronicle/Chronicle.tsx'
import { PostureAtlas } from './chronicle/PostureAtlas.tsx'

type Route =
  | { kind: 'front' }
  | { kind: 'loop' }
  | { kind: 'wopr' }
  | { kind: 'chronicle' }
  | { kind: 'posture' }
  | { kind: 'atlas'; strike?: { ref: string; adversary: string | null; delivery: string | null; loading: string | null } }
  | { kind: 'study'; id: 'siop62' }
  | { kind: 'study'; id: 'siop62-alert'; option: number }
  | { kind: 'study'; id: 'defcon3-73'; variant: 'posture' | 'execute' | 'giant' }
  | { kind: 'study'; id: 'cuba-62'; general: boolean }
  | { kind: 'study'; id: 'able-archer-83' }
  | { kind: 'study'; id: 'britain-80'; strath: boolean }
  | { kind: 'study'; id: 'v-force'; profile: 'high' | 'low' }
  | { kind: 'study'; id: '72-minutes'; variant: 'film' | 'record' | 'claim' | 'salvo' | 'book' }
  | { kind: 'study'; id: 'window-83'; posture: 'ride' | 'launch' }
  | { kind: 'lab'; id: 'evidence' | 'population' | 'terrain' | 'fallout' | 'readiness' | 'defence' | 'accuracy' | 'guidance' }

function parseRoute(hash: string): Route {
  if (hash === '' || hash === '#' || hash === '#/' || hash === '#/sources' || hash === '#/labs') return { kind: 'front' }
  if (hash === '#/atlas') return { kind: 'atlas' }
  const shared = parseStrikeHash(hash)
  if (shared) return { kind: 'atlas', strike: shared }
  if (hash === '#/loop') return { kind: 'loop' }
  if (hash === '#/wopr') return { kind: 'wopr' }
  if (hash === '#/chronicle') return { kind: 'chronicle' }
  if (hash === '#/chronicle/posture') return { kind: 'posture' }
  if (hash === '#/study/siop62') return { kind: 'study', id: 'siop62' }
  if (hash === '#/study/siop62-alert') return { kind: 'study', id: 'siop62-alert', option: 1 }
  const option = /^#\/study\/siop62-alert\/(\d{1,2})$/.exec(hash)
  if (option) return { kind: 'study', id: 'siop62-alert', option: Math.max(1, Math.min(14, Number(option[1]))) }
  if (hash === '#/study/defcon3-73') return { kind: 'study', id: 'defcon3-73', variant: 'posture' }
  if (hash === '#/study/defcon3-73/execute') return { kind: 'study', id: 'defcon3-73', variant: 'execute' }
  if (hash === '#/study/defcon3-73/1969') return { kind: 'study', id: 'defcon3-73', variant: 'giant' }
  if (hash === '#/study/cuba-62') return { kind: 'study', id: 'cuba-62', general: false }
  if (hash === '#/study/cuba-62/general') return { kind: 'study', id: 'cuba-62', general: true }
  if (hash === '#/study/able-archer-83') return { kind: 'study', id: 'able-archer-83' }
  if (hash === '#/study/v-force') return { kind: 'study', id: 'v-force', profile: 'high' }
  if (hash === '#/study/v-force/low') return { kind: 'study', id: 'v-force', profile: 'low' }
  if (hash === '#/study/britain-80') return { kind: 'study', id: 'britain-80', strath: false }
  if (hash === '#/study/britain-80/strath') return { kind: 'study', id: 'britain-80', strath: true }
  if (hash === '#/study/72-minutes') return { kind: 'study', id: '72-minutes', variant: 'film' }
  if (hash === '#/study/72-minutes/record') return { kind: 'study', id: '72-minutes', variant: 'record' }
  if (hash === '#/study/72-minutes/claim') return { kind: 'study', id: '72-minutes', variant: 'claim' }
  if (hash === '#/study/72-minutes/jacobsen') return { kind: 'study', id: '72-minutes', variant: 'book' }
  if (hash === '#/study/72-minutes/salvo') return { kind: 'study', id: '72-minutes', variant: 'salvo' }
  if (hash === '#/study/window-83') return { kind: 'study', id: 'window-83', posture: 'ride' }
  if (hash === '#/study/window-83/launch') return { kind: 'study', id: 'window-83', posture: 'launch' }
  if (hash === '#/lab/evidence') return { kind: 'lab', id: 'evidence' }
  if (hash === '#/lab/population') return { kind: 'lab', id: 'population' }
  if (hash === '#/lab/terrain') return { kind: 'lab', id: 'terrain' }
  if (hash === '#/lab/fallout') return { kind: 'lab', id: 'fallout' }
  if (hash === '#/lab/readiness') return { kind: 'lab', id: 'readiness' }
  if (hash === '#/lab/defence') return { kind: 'lab', id: 'defence' }
  if (hash === '#/lab/accuracy') return { kind: 'lab', id: 'accuracy' }
  if (hash === '#/lab/guidance') return { kind: 'lab', id: 'guidance' }
  return { kind: 'atlas' }
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

/** The document title: Grid/84, with the mode or the study after it. */
function useTitle(route: Route) {
  useEffect(() => {
    const part =
      route.kind === 'atlas' ? 'Terminal Atlas' : route.kind === 'wopr' ? 'WOPR' : route.kind === 'loop' ? 'The loop' : route.kind === 'chronicle' ? 'Chronicle' : route.kind === 'lab' ? `${route.id.charAt(0).toUpperCase()}${route.id.slice(1)} lab` : ''
    // A study names the tab itself, from its title.
    if (route.kind === 'study') return
    document.title = part ? `Grid/84 · ${part}` : 'Grid/84'
  }, [route])
}

function AtlasView({ strike }: { strike?: { ref: string; adversary: string | null; delivery: string | null; loading: string | null } }) {
  const [study, setStudy] = useState<Study | null>(null)
  if (study) {
    return (
      <>
        <StudyView key={study.id} study={study} autoplay={{ rate: 20 }} />
        <button type="button" className="loop-exit" onClick={() => setStudy(null)}>
          BACK TO THE ATLAS
        </button>
      </>
    )
  }
  return <AtlasGlobe onLaunch={setStudy} preset={strike} />
}

function AtlasGlobe({ onLaunch, preset }: { onLaunch: (study: Study) => void; preset?: { ref: string; adversary: string | null; delivery: string | null; loading: string | null } }) {
  const container = useRef<HTMLDivElement>(null)
  const atlas = useRef<Atlas | null>(null)
  const [phase, setPhase] = useState<AtlasPhase>({ kind: 'standby' })
  const [stoodDown, setStoodDown] = useState<string | null>(null)
  const [presetName, setPresetName] = useState<string | null>(null)

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
    void fetchBoundary(target).then((b) => {
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
  const share = (choices: { adversary: Power | null; delivery: DeliveryPreference; loading: Loading }): string | null => {
    if (!acquired) return null
    const hash = strikeHash(acquired, choices)
    if (!hash) return null
    // The address bar carries the strike without a navigation; the link is what gets shared.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    return `${window.location.origin}${window.location.pathname}${hash}`
  }
  return (
    <>
      <div ref={container} className="atlas-map" aria-label="Grid/84 globe" />
      <div className="atlas-vignette" aria-hidden="true" />
      <Hud phase={phase} onAcquire={acquire} consoleOpen={!!acquired && stoodDown !== acquired.id} presetName={presetName} />
      {acquired && stoodDown !== acquired.id && <StrikeConsole key={acquired.id} target={acquired} boundary={boundary.id === acquired.id ? boundary.boundary : null} initialAdversary={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) ? (preset.adversary as Power | null) : null} initialDelivery={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) ? ((preset.delivery as DeliveryPreference | null) ?? 'best') : 'best'} initialLoading={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) && preset.loading === 'full' ? 'full' : 'deployed'} onShare={share} onLaunch={onLaunch} onStandDown={() => {
            atlas.current?.clearAimPoints()
            setStoodDown(acquired.id)
          }} onAimPoint={(p) => atlas.current?.addAimPoint(p)} onClearAimPoints={() => atlas.current?.clearAimPoints()} />}
    </>
  )
}

function OptionStudy({ option }: { option: number }) {
  const force = useMemo(() => (option === 1 ? ALERT_FORCE : forceForOption(option)), [option])
  return <StudyView key={force.study.id} study={force.study} />
}

function Defcon3Study({ variant }: { variant: 'posture' | 'execute' | 'giant' }) {
  const study = useMemo(() => (variant === 'execute' ? defcon3Execute() : variant === 'giant' ? defcon3Giant() : defcon3Posture()), [variant])
  return <StudyView key={study.id} study={study} />
}

function CubaStudy({ general }: { general: boolean }) {
  const study = useMemo(() => (general ? cubaGeneral() : cubaRegional()), [general])
  return <StudyView key={study.id} study={study} />
}

function AbleArcherStudy() {
  const study = useMemo(() => ableArcher(), [])
  return <StudyView key={study.id} study={study} />
}

function VForceStudy({ profile }: { profile: 'high' | 'low' }) {
  const study = useMemo(() => vForce(profile), [profile])
  return <StudyView key={study.id} study={study} />
}

function WindowStudy({ posture }: { posture: 'ride' | 'launch' }) {
  const study = useMemo(() => window83(posture), [posture])
  return <StudyView key={study.id} study={study} />
}

function SeventyTwoStudy({ variant }: { variant: 'film' | 'record' | 'claim' | 'salvo' | 'book' }) {
  const study = useMemo(() => seventyTwoMinutes(variant), [variant])
  return <StudyView key={study.id} study={study} />
}

function BritainStudy({ strath }: { strath: boolean }) {
  const study = useMemo(() => (strath ? britainStrath() : britainSquareLeg()), [strath])
  return <StudyView key={study.id} study={study} />
}

export default function App() {
  const route = useRoute()
  useTitle(route)
  const inLab = route.kind === 'lab'
  const labs: Array<{ href: string; label: string; active: boolean }> = [
    { href: '#/lab/evidence', label: 'Evidence', active: inLab && route.id === 'evidence' },
    { href: '#/lab/population', label: 'Population', active: inLab && route.id === 'population' },
    { href: '#/lab/terrain', label: 'Terrain', active: inLab && route.id === 'terrain' },
    { href: '#/lab/fallout', label: 'Fallout', active: inLab && route.id === 'fallout' },
    { href: '#/lab/readiness', label: 'Readiness', active: inLab && route.id === 'readiness' },
    { href: '#/lab/defence', label: 'Defence', active: inLab && route.id === 'defence' },
    { href: '#/lab/accuracy', label: 'Accuracy', active: inLab && route.id === 'accuracy' },
    { href: '#/lab/guidance', label: 'Guidance', active: inLab && route.id === 'guidance' },
  ]
  // The bar carries the forms and the studies; the open lab appears beside a link to the labs on the front page.
  const links: Array<{ href: string; label: string; active: boolean }> = [
    { href: '#/', label: 'Grid/84', active: route.kind === 'front' },
    { href: '#/chronicle', label: 'Chronicle', active: route.kind === 'chronicle' || route.kind === 'posture' },
    { href: '#/atlas', label: 'Atlas', active: route.kind === 'atlas' },
    { href: '#/study/siop62', label: 'SIOP//62', active: route.kind === 'study' && route.id === 'siop62' },
    { href: '#/study/siop62-alert', label: 'Alert force', active: route.kind === 'study' && route.id === 'siop62-alert' },
    { href: '#/study/cuba-62', label: 'Cuba 62', active: route.kind === 'study' && route.id === 'cuba-62' },
    { href: '#/study/defcon3-73', label: 'DEFCON 3', active: route.kind === 'study' && route.id === 'defcon3-73' },
    { href: '#/study/able-archer-83', label: 'Able Archer', active: route.kind === 'study' && route.id === 'able-archer-83' },
    { href: '#/study/britain-80', label: 'Britain', active: route.kind === 'study' && route.id === 'britain-80' },
    { href: '#/study/v-force', label: 'V-force', active: route.kind === 'study' && route.id === 'v-force' },
    { href: '#/study/window-83', label: 'The window', active: route.kind === 'study' && route.id === 'window-83' },
    { href: '#/study/72-minutes', label: '72 minutes', active: route.kind === 'study' && route.id === '72-minutes' },
    ...labs.filter((l) => l.active).map((l) => ({ ...l, label: `Lab · ${l.label}` })),
    { href: '#/labs', label: 'Labs', active: false },
  ]
  return (
    <>
      {route.kind !== 'loop' && route.kind !== 'wopr' && (
      <nav className="grid-nav" aria-label="Views">
        {links.map((l) => (
          <a key={l.href} href={l.href} className={l.active ? 'is-active' : ''} aria-current={l.active ? 'page' : undefined}>
            {l.label}
          </a>
        ))}
      </nav>
      )}
      {route.kind === 'loop' && <LoopView />}
      {route.kind === 'wopr' && <WoprView />}
      {route.kind === 'front' && <FrontPage />}
      {route.kind === 'chronicle' && <Chronicle />}
      {route.kind === 'posture' && <PostureAtlas key="posture" />}
      {route.kind === 'atlas' && <AtlasView strike={route.strike} />}
      {route.kind === 'study' && route.id === 'siop62' && <StudyView key="siop62" study={SIOP62_PROOF} />}
      {route.kind === 'study' && route.id === 'siop62-alert' && <OptionStudy option={route.option} />}
      {route.kind === 'study' && route.id === 'defcon3-73' && <Defcon3Study variant={route.variant} />}
      {route.kind === 'study' && route.id === 'cuba-62' && <CubaStudy general={route.general} />}
      {route.kind === 'study' && route.id === 'able-archer-83' && <AbleArcherStudy />}
      {route.kind === 'study' && route.id === 'v-force' && <VForceStudy profile={route.profile} />}
      {route.kind === 'study' && route.id === 'britain-80' && <BritainStudy strath={route.strath} />}
      {route.kind === 'study' && route.id === '72-minutes' && <SeventyTwoStudy variant={route.variant} />}
      {route.kind === 'study' && route.id === 'window-83' && <WindowStudy posture={route.posture} />}
      {route.kind === 'lab' && route.id === 'evidence' && <StudyView key="lab-evidence" study={EVIDENCE_LAB} />}
      {route.kind === 'lab' && route.id === 'population' && <PopulationLab key="lab-population" />}
      {route.kind === 'lab' && route.id === 'terrain' && <TerrainLab key="lab-terrain" />}
      {route.kind === 'lab' && route.id === 'fallout' && <FalloutLab key="lab-fallout" />}
      {route.kind === 'lab' && route.id === 'readiness' && <ReadinessLab key="lab-readiness" />}
      {route.kind === 'lab' && route.id === 'defence' && <DefenceLab key="lab-defence" />}
      {route.kind === 'lab' && route.id === 'accuracy' && <AccuracyLab key="lab-accuracy" />}
      {route.kind === 'lab' && route.id === 'guidance' && <GuidanceLab key="lab-guidance" />}
    </>
  )
}
