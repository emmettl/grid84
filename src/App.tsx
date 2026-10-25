import { lazy, Suspense, useEffect, useState } from 'react'
import { FrontPage } from './front/FrontPage.tsx'
import { parseRoute, type Route } from './route.ts'
import { RouteBoundary } from './RouteBoundary.tsx'

const AtlasView = lazy(() => import('./atlas/AtlasView.tsx').then((m) => ({ default: m.AtlasView })))
const StudyRoute = lazy(() => import('./studies/StudyRoute.tsx').then((m) => ({ default: m.StudyRoute })))
const EvidenceLab = lazy(() => import('./lab/EvidenceLab.tsx').then((m) => ({ default: m.EvidenceLab })))
const PopulationLab = lazy(() => import('./lab/PopulationLab.tsx').then((m) => ({ default: m.PopulationLab })))
const TerrainLab = lazy(() => import('./lab/TerrainLab.tsx').then((m) => ({ default: m.TerrainLab })))
const FalloutLab = lazy(() => import('./lab/FalloutLab.tsx').then((m) => ({ default: m.FalloutLab })))
const ReadinessLab = lazy(() => import('./lab/ReadinessLab.tsx').then((m) => ({ default: m.ReadinessLab })))
const DefenceLab = lazy(() => import('./lab/DefenceLab.tsx').then((m) => ({ default: m.DefenceLab })))
const InterceptLab = lazy(() => import('./lab/InterceptLab.tsx').then((m) => ({ default: m.InterceptLab })))
const AccuracyLab = lazy(() => import('./lab/AccuracyLab.tsx').then((m) => ({ default: m.AccuracyLab })))
const GuidanceLab = lazy(() => import('./lab/GuidanceLab.tsx').then((m) => ({ default: m.GuidanceLab })))
const CloudLab = lazy(() => import('./lab/CloudLab.tsx').then((m) => ({ default: m.CloudLab })))
const ErwLab = lazy(() => import('./lab/ErwLab.tsx').then((m) => ({ default: m.ErwLab })))
const ImpactView = lazy(() => import('./impact/ImpactView.tsx').then((m) => ({ default: m.ImpactView })))
const LoopView = lazy(() => import('./studies/LoopView.tsx').then((m) => ({ default: m.LoopView })))
const WoprView = lazy(() => import('./wopr/WoprView.tsx').then((m) => ({ default: m.WoprView })))
const WinterView = lazy(() => import('./winter/WinterView.tsx').then((m) => ({ default: m.WinterView })))
const InterceptView = lazy(() => import('./intercept/InterceptView.tsx').then((m) => ({ default: m.InterceptView })))
const Chronicle = lazy(() => import('./chronicle/Chronicle.tsx').then((m) => ({ default: m.Chronicle })))
const PostureAtlas = lazy(() => import('./chronicle/PostureAtlas.tsx').then((m) => ({ default: m.PostureAtlas })))

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
      <RouteBoundary key={JSON.stringify(route)}>
        <Suspense fallback={<p className="route-status" role="status">Loading…</p>}>
          {route.kind === 'loop' && <LoopView />}
          {route.kind === 'wopr' && <WoprView />}
          {route.kind === 'winter' && <WinterView />}
          {route.kind === 'intercept' && <InterceptView />}
          {route.kind === 'front' && <FrontPage />}
          {route.kind === 'chronicle' && <Chronicle />}
          {route.kind === 'posture' && <PostureAtlas key="posture" />}
          {route.kind === 'atlas' && <AtlasView strike={route.strike} />}
          {route.kind === 'study' && <StudyRoute route={route} />}
          {route.kind === 'lab' && route.id === 'evidence' && <EvidenceLab key="lab-evidence" />}
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
        </Suspense>
      </RouteBoundary>
    </>
  )
}
