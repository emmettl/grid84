import { useEffect, useRef, useState } from 'react'
import { Hud } from './hud/Hud.tsx'
import { EVIDENCE_LAB } from './lab/evidence-lab.ts'
import { PopulationLab } from './lab/PopulationLab.tsx'
import { createAtlas, type Atlas, type AtlasPhase } from './map/atlas.ts'
import { SIOP62_PROOF } from './studies/siop62/proof.ts'
import { StudyView } from './studies/StudyView.tsx'

type Route = { kind: 'atlas' } | { kind: 'study'; id: 'siop62' } | { kind: 'lab'; id: 'evidence' | 'population' }

function parseRoute(hash: string): Route {
  if (hash === '#/study/siop62') return { kind: 'study', id: 'siop62' }
  if (hash === '#/lab/evidence') return { kind: 'lab', id: 'evidence' }
  if (hash === '#/lab/population') return { kind: 'lab', id: 'population' }
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

export default function App() {
  const route = useRoute()
  const links: Array<{ href: string; label: string; active: boolean }> = [
    { href: '#/', label: 'Atlas', active: route.kind === 'atlas' },
    { href: '#/study/siop62', label: 'SIOP//62', active: route.kind === 'study' },
    { href: '#/lab/evidence', label: 'Lab · Evidence', active: route.kind === 'lab' && route.id === 'evidence' },
    { href: '#/lab/population', label: 'Lab · Population', active: route.kind === 'lab' && route.id === 'population' },
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
      {route.kind === 'atlas' && <AtlasView />}
      {route.kind === 'study' && <StudyView key="siop62" study={SIOP62_PROOF} />}
      {route.kind === 'lab' && route.id === 'evidence' && <StudyView key="lab-evidence" study={EVIDENCE_LAB} />}
      {route.kind === 'lab' && route.id === 'population' && <PopulationLab key="lab-population" />}
    </>
  )
}
