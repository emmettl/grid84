import { useEffect, useMemo, useRef, useState } from 'react'
import { Hud } from './hud/Hud.tsx'
import { EVIDENCE_LAB } from './lab/evidence-lab.ts'
import { PopulationLab } from './lab/PopulationLab.tsx'
import { TerrainLab } from './lab/TerrainLab.tsx'
import { FalloutLab } from './lab/FalloutLab.tsx'
import { ReadinessLab } from './lab/ReadinessLab.tsx'
import { DefenceLab } from './lab/DefenceLab.tsx'
import { InterceptLab } from './lab/InterceptLab.tsx'
import { AccuracyLab } from './lab/AccuracyLab.tsx'
import { GuidanceLab } from './lab/GuidanceLab.tsx'
import { CloudLab } from './lab/CloudLab.tsx'
import { ImpactView } from './impact/ImpactView.tsx'
import { ErwLab } from './lab/ErwLab.tsx'
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
import { sevenDays } from './studies/sevendays/seven-days.ts'
import { carteBlanche } from './studies/carteblanche/carte-blanche.ts'
import { demolitionBelt } from './studies/demolition/belt.ts'
import { tornadoStrike } from './studies/tornado/tornado.ts'
import { sinoSoviet69 } from './studies/sinosoviet69/sino-soviet-69.ts'
import { StudyView } from './studies/StudyView.tsx'
import { FrontPage } from './front/FrontPage.tsx'
import { LoopView } from './studies/LoopView.tsx'
import { StrikeConsole } from './atlas/StrikeConsole.tsx'
import { fetchBoundary, type Boundary } from './atlas/boundary.ts'
import { lookupTarget, strikeHash } from './atlas/lookup.ts'
import type { Power } from './atlas/forces.ts'
import type { DeliveryPreference, Loading } from './atlas/solver.ts'
import type { AtlasTarget } from './atlas/target.ts'
import type { Study } from './studies/study.ts'
import { WoprView } from './wopr/WoprView.tsx'
import { WinterView } from './winter/WinterView.tsx'
import { InterceptView } from './intercept/InterceptView.tsx'
import { Chronicle } from './chronicle/Chronicle.tsx'
import { parseRoute, type Route } from './route.ts'
import { PostureAtlas } from './chronicle/PostureAtlas.tsx'

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
      route.kind === 'atlas' ? 'Terminal Atlas' : route.kind === 'wopr' ? 'WOPR' : route.kind === 'winter' ? 'The years after' : route.kind === 'intercept' ? 'Intercept' : route.kind === 'impact' ? 'The terminal phase' : route.kind === 'loop' ? 'The loop' : route.kind === 'chronicle' ? 'Chronicle' : route.kind === 'lab' ? `${route.id.charAt(0).toUpperCase()}${route.id.slice(1)} lab` : ''
    // A study names the tab itself, from its title. A lab does not, even the
    // one built as a study: its tab reads like the other labs' rather than
    // shouting a study's title at the tab strip. The atlas names its own too,
    // once it knows what it is looking at — see AtlasGlobe. It has to be its
    // own owner, because a child's effect runs before its parent's and this
    // one would otherwise overwrite the name with the generic line.
    if (route.kind === 'study' || route.kind === 'atlas') return
    document.title = part ? `Grid/84 · ${part}` : 'Grid/84'
  }, [route])
}

function AtlasView({ strike }: { strike?: { ref: string; adversary: string | null; delivery: string | null; loading: string | null; site: string | null } }) {
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
    return `${window.location.origin}${window.location.pathname}${hash}`
  }
  return (
    <>
      <div ref={container} className="atlas-map" aria-label="Grid/84 globe" />
      <div className="atlas-vignette" aria-hidden="true" />
      <Hud phase={phase} onAcquire={acquire} consoleOpen={!!acquired && stoodDown !== acquired.id} presetName={presetName} />
      {acquired && stoodDown !== acquired.id && <StrikeConsole key={acquired.id} target={acquired} boundary={boundary.id === acquired.id ? boundary.boundary : null} initialAdversary={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) ? (preset.adversary as Power | null) : null} initialDelivery={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) ? ((preset.delivery as DeliveryPreference | null) ?? 'best') : 'best'} initialLoading={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) && preset.loading === 'full' ? 'full' : 'deployed'} initialSite={preset && preset.ref === (acquired.osmType.charAt(0).toUpperCase() + acquired.osmId) ? preset.site : null} onShare={share} onLaunch={onLaunch} onLaunching={onLaunching} onStandDown={() => {
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

function TornadoStudy() {
  const study = useMemo(() => tornadoStrike(), [])
  return <StudyView key={study.id} study={study} />
}

function SinoSoviet69Study() {
  const study = useMemo(() => sinoSoviet69(), [])
  return <StudyView key={study.id} study={study} />
}

function DemolitionBeltStudy() {
  const study = useMemo(() => demolitionBelt(), [])
  return <StudyView key={study.id} study={study} />
}

function CarteBlancheStudy() {
  const study = useMemo(() => carteBlanche(), [])
  return <StudyView key={study.id} study={study} />
}

function SevenDaysStudy() {
  const study = useMemo(() => sevenDays(), [])
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
    { href: '#/lab/cloud', label: 'Cloud', active: inLab && route.id === 'cloud' },
    { href: '#/lab/readiness', label: 'Readiness', active: inLab && route.id === 'readiness' },
    { href: '#/lab/defence', label: 'Defence', active: inLab && route.id === 'defence' },
    { href: '#/lab/intercept', label: 'Interception', active: inLab && route.id === 'intercept' },
    { href: '#/lab/accuracy', label: 'Accuracy', active: inLab && route.id === 'accuracy' },
    { href: '#/lab/guidance', label: 'Guidance', active: inLab && route.id === 'guidance' },
    { href: '#/lab/neutron', label: 'Neutron bomb', active: inLab && route.id === 'neutron' },
  ]
  /** Every study, so the bar can name the one that is open without listing them all. */
  const studies: Array<{ id: string; label: string; href: string }> = [
    { id: 'siop62', label: 'SIOP//62', href: '#/study/siop62' },
    { id: 'siop62-alert', label: 'Alert force', href: '#/study/siop62-alert' },
    { id: 'cuba-62', label: 'Cuba 62', href: '#/study/cuba-62' },
    { id: 'defcon3-73', label: 'DEFCON 3', href: '#/study/defcon3-73' },
    { id: 'able-archer-83', label: 'Able Archer', href: '#/study/able-archer-83' },
    { id: 'window-83', label: 'The window', href: '#/study/window-83' },
    { id: 'carte-blanche', label: 'Carte Blanche', href: '#/study/carte-blanche' },
    { id: 'v-force', label: 'V-force', href: '#/study/v-force' },
    { id: 'seven-days', label: 'Seven days', href: '#/study/seven-days' },
    { id: 'demolition-belt', label: 'Demolition belt', href: '#/study/demolition-belt' },
    { id: 'tornado', label: 'RAF Germany', href: '#/study/tornado' },
    { id: 'sino-soviet-1969', label: 'The nuclear surgery', href: '#/study/sino-soviet-1969' },
    { id: 'britain-80', label: 'Britain', href: '#/study/britain-80' },
    { id: '72-minutes', label: '72 minutes', href: '#/study/72-minutes' },
  ]
  const openStudy = route.kind === 'study' ? studies.find((x) => x.id === route.id) : undefined
  // The bar carries the five ways in and names whatever is open; the studies and the labs are listed on the front page.
  const links: Array<{ href: string; label: string; active: boolean }> = [
    { href: '#/', label: 'Grid/84', active: route.kind === 'front' },
    { href: '#/chronicle', label: 'Chronicle', active: route.kind === 'chronicle' || route.kind === 'posture' },
    { href: '#/atlas', label: 'Atlas', active: route.kind === 'atlas' },
    { href: '#/studies', label: 'Studies', active: route.kind === 'study' },
    { href: '#/labs', label: 'Labs', active: inLab },
    ...(openStudy ? [{ href: openStudy.href, label: openStudy.label, active: true }] : []),
    ...labs.filter((l) => l.active).map((l) => ({ ...l, label: `Lab · ${l.label}` })),
  ]
  return (
    <>
      {route.kind !== 'loop' && route.kind !== 'wopr' && route.kind !== 'winter' && route.kind !== 'intercept' && (
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
      {route.kind === 'winter' && <WinterView />}
      {route.kind === 'intercept' && <InterceptView />}
      {route.kind === 'front' && <FrontPage />}
      {route.kind === 'chronicle' && <Chronicle />}
      {route.kind === 'posture' && <PostureAtlas key="posture" />}
      {route.kind === 'atlas' && <AtlasView strike={route.strike} />}
      {route.kind === 'study' && route.id === 'siop62' && <StudyView key="siop62" study={SIOP62_PROOF} />}
      {route.kind === 'study' && route.id === 'siop62-alert' && <OptionStudy option={route.option} />}
      {route.kind === 'study' && route.id === 'defcon3-73' && <Defcon3Study variant={route.variant} />}
      {route.kind === 'study' && route.id === 'cuba-62' && <CubaStudy general={route.general} />}
      {route.kind === 'study' && route.id === 'able-archer-83' && <AbleArcherStudy />}
      {route.kind === 'study' && route.id === 'tornado' && <TornadoStudy />}
      {route.kind === 'study' && route.id === 'sino-soviet-1969' && <SinoSoviet69Study />}
      {route.kind === 'study' && route.id === 'demolition-belt' && <DemolitionBeltStudy />}
      {route.kind === 'study' && route.id === 'carte-blanche' && <CarteBlancheStudy />}
      {route.kind === 'study' && route.id === 'seven-days' && <SevenDaysStudy />}
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
      {route.kind === 'lab' && route.id === 'intercept' && <InterceptLab key="lab-intercept" />}
      {route.kind === 'lab' && route.id === 'accuracy' && <AccuracyLab key="lab-accuracy" />}
      {route.kind === 'lab' && route.id === 'guidance' && <GuidanceLab key="lab-guidance" />}
      {route.kind === 'lab' && route.id === 'cloud' && <CloudLab key="lab-cloud" />}
      {route.kind === 'impact' && <ImpactView key="impact" />}
      {route.kind === 'lab' && route.id === 'neutron' && <ErwLab key="lab-neutron" />}
    </>
  )
}
