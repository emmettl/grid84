import { useEffect, useMemo, useRef, useState } from 'react'
import { Hud } from './hud/Hud.tsx'
import { EVIDENCE_LAB } from './lab/evidence-lab.ts'
import { PopulationLab } from './lab/PopulationLab.tsx'
import { TerrainLab } from './lab/TerrainLab.tsx'
import { FalloutLab } from './lab/FalloutLab.tsx'
import { ReadinessLab } from './lab/ReadinessLab.tsx'
import { createAtlas, type Atlas, type AtlasPhase } from './map/atlas.ts'
import { SIOP62_PROOF } from './studies/siop62/proof.ts'
import { ALERT_FORCE, forceForOption } from './studies/siop62/alert-force.ts'
import { defcon3Execute, defcon3Giant, defcon3Posture } from './studies/defcon3/posture.ts'
import { cubaGeneral, cubaRegional } from './studies/cuba62/crisis.ts'
import { ableArcher } from './studies/able-archer/war-scare.ts'
import { britainSquareLeg, britainStrath } from './studies/britain/protect.ts'
import { StudyView } from './studies/StudyView.tsx'
import { FrontPage } from './front/FrontPage.tsx'

type Route =
  | { kind: 'front' }
  | { kind: 'atlas' }
  | { kind: 'study'; id: 'siop62' }
  | { kind: 'study'; id: 'siop62-alert'; option: number }
  | { kind: 'study'; id: 'defcon3-73'; variant: 'posture' | 'execute' | 'giant' }
  | { kind: 'study'; id: 'cuba-62'; general: boolean }
  | { kind: 'study'; id: 'able-archer-83' }
  | { kind: 'study'; id: 'britain-80'; strath: boolean }
  | { kind: 'lab'; id: 'evidence' | 'population' | 'terrain' | 'fallout' | 'readiness' }

function parseRoute(hash: string): Route {
  if (hash === '' || hash === '#' || hash === '#/') return { kind: 'front' }
  if (hash === '#/atlas') return { kind: 'atlas' }
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
  if (hash === '#/study/britain-80') return { kind: 'study', id: 'britain-80', strath: false }
  if (hash === '#/study/britain-80/strath') return { kind: 'study', id: 'britain-80', strath: true }
  if (hash === '#/lab/evidence') return { kind: 'lab', id: 'evidence' }
  if (hash === '#/lab/population') return { kind: 'lab', id: 'population' }
  if (hash === '#/lab/terrain') return { kind: 'lab', id: 'terrain' }
  if (hash === '#/lab/fallout') return { kind: 'lab', id: 'fallout' }
  if (hash === '#/lab/readiness') return { kind: 'lab', id: 'readiness' }
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

function AtlasView() {
  const container = useRef<HTMLDivElement>(null)
  const atlas = useRef<Atlas | null>(null)
  const [phase, setPhase] = useState<AtlasPhase>({ kind: 'standby' })

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

  return (
    <>
      <div ref={container} className="atlas-map" aria-label="Grid/84 globe" />
      <div className="atlas-vignette" aria-hidden="true" />
      <Hud phase={phase} onAcquire={(target) => atlas.current?.acquire(target)} />
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

function BritainStudy({ strath }: { strath: boolean }) {
  const study = useMemo(() => (strath ? britainStrath() : britainSquareLeg()), [strath])
  return <StudyView key={study.id} study={study} />
}

export default function App() {
  const route = useRoute()
  const links: Array<{ href: string; label: string; active: boolean }> = [
    { href: '#/', label: 'Grid/84', active: route.kind === 'front' },
    { href: '#/atlas', label: 'Atlas', active: route.kind === 'atlas' },
    { href: '#/study/siop62', label: 'SIOP//62', active: route.kind === 'study' && route.id === 'siop62' },
    { href: '#/study/siop62-alert', label: 'Alert force', active: route.kind === 'study' && route.id === 'siop62-alert' },
    { href: '#/study/cuba-62', label: 'Cuba 62', active: route.kind === 'study' && route.id === 'cuba-62' },
    { href: '#/study/defcon3-73', label: 'DEFCON 3', active: route.kind === 'study' && route.id === 'defcon3-73' },
    { href: '#/study/able-archer-83', label: 'Able Archer', active: route.kind === 'study' && route.id === 'able-archer-83' },
    { href: '#/study/britain-80', label: 'Britain', active: route.kind === 'study' && route.id === 'britain-80' },
    { href: '#/lab/evidence', label: 'Lab · Evidence', active: route.kind === 'lab' && route.id === 'evidence' },
    { href: '#/lab/population', label: 'Lab · Population', active: route.kind === 'lab' && route.id === 'population' },
    { href: '#/lab/terrain', label: 'Lab · Terrain', active: route.kind === 'lab' && route.id === 'terrain' },
    { href: '#/lab/fallout', label: 'Lab · Fallout', active: route.kind === 'lab' && route.id === 'fallout' },
    { href: '#/lab/readiness', label: 'Lab · Readiness', active: route.kind === 'lab' && route.id === 'readiness' },
  ]
  return (
    <>
      <nav className="grid-nav" aria-label="Views">
        {links.map((l) => (
          <a key={l.href} href={l.href} className={l.active ? 'is-active' : ''} aria-current={l.active ? 'page' : undefined}>
            {l.label}
          </a>
        ))}
      </nav>
      {route.kind === 'front' && <FrontPage />}
      {route.kind === 'atlas' && <AtlasView />}
      {route.kind === 'study' && route.id === 'siop62' && <StudyView key="siop62" study={SIOP62_PROOF} />}
      {route.kind === 'study' && route.id === 'siop62-alert' && <OptionStudy option={route.option} />}
      {route.kind === 'study' && route.id === 'defcon3-73' && <Defcon3Study variant={route.variant} />}
      {route.kind === 'study' && route.id === 'cuba-62' && <CubaStudy general={route.general} />}
      {route.kind === 'study' && route.id === 'able-archer-83' && <AbleArcherStudy />}
      {route.kind === 'study' && route.id === 'britain-80' && <BritainStudy strath={route.strath} />}
      {route.kind === 'lab' && route.id === 'evidence' && <StudyView key="lab-evidence" study={EVIDENCE_LAB} />}
      {route.kind === 'lab' && route.id === 'population' && <PopulationLab key="lab-population" />}
      {route.kind === 'lab' && route.id === 'terrain' && <TerrainLab key="lab-terrain" />}
      {route.kind === 'lab' && route.id === 'fallout' && <FalloutLab key="lab-fallout" />}
      {route.kind === 'lab' && route.id === 'readiness' && <ReadinessLab key="lab-readiness" />}
    </>
  )
}
