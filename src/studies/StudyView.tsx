import { Marker, type ExpressionSpecification, type Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { advance, formatStudyTime, type ClockState } from '../engine/clock.ts'
import { formatProvenance, TIER_LABEL, type Evidenced } from '../evidence/evidence.ts'
import { geodesicCircle } from '../geo/shapes.ts'
import { createBaseMap, installTerrainSync } from '../map/base.ts'
import { installEvidenceLayers, setSourceData, SOURCES, type EvidenceFeature } from '../map/evidence-layers.ts'
import { ALARM_HATCH, ensureAlarmHatch } from '../map/hatch.ts'
import { useFold } from '../hud/collapse.ts'
import { TrackLayer, TRAIL_FADE_SECONDS, TRAIL_HOLD_SECONDS } from '../map/track-layer.ts'
import { prepareTracks, type TrackSpec } from '../map/track-scene.ts'
import { applyBands, bandPopulations, OTA_BANDS, outcome, radiusForPsi, type Burst, type Outcome } from '../models/casualties.ts'
import { SURFACE_BLAST_MODEL, thirdDegreeBurnRadiusMetres } from '../models/blast.ts'
import { acuteMortality, CANCER_PER_PERSON_SIEVERT, latentFatalCancers, plume } from '../models/fallout.ts'
import { ExposureService } from '../models/exposure-service.ts'
import type { UnionDetonation, UnionTotals } from '../models/exposure.ts'
import { EvidenceLegend } from './EvidenceLegend.tsx'
import { busIdOf, launchedFrom, missileOf } from './missile.ts'
import type { Entity, LabelAnchor, Study } from './study.ts'

const RATES = [1, 10, 60, 600, 3_600]
/**
 * Hours after a burst at which the fallout count is brought up to date. The
 * dose accumulates from arrival, so the figure grows through the study
 * instead of arriving whole at the end; these are the steps it is recomputed
 * at, since each one costs a pass over the grid.
 */
const FALLOUT_STAGES = [1, 2, 4, 8, 16, 24, 36, 48, 72, 96]
/**
 * Where the count is carried to once the study's own clock has run out: a
 * month of standing in the fallout, which is about three quarters of the
 * dose anyone would ever take from it. Nobody would stand there for a
 * month, which is the point of showing it.
 */
const STAY_HOURS = 720

/** Headline figures rounded to two significant figures, as the readout states. */
function fmt(v: number) {
    if (v < 10) return Math.round(v).toLocaleString('en-GB')
    const magnitude = 10 ** (Math.floor(Math.log10(v)) - 1)
    return (Math.round(v / magnitude) * magnitude).toLocaleString('en-GB')
}

/** The OTA bands' fatal and injured fractions, for the union. */
const BAND_FRACTIONS = OTA_BANDS.map((b) => ({ fatal: b.fatal, injured: b.injured }))

/**
 * Where a study's grid lives. A bare name is a HYDE grid under data/hyde; an
 * absolute URL is used as given; a path such as ghsl/popc_1985 is looked up
 * in the grids index, which is where `scripts/point-grids-at.py` records
 * whether the tiles are local or in the bucket.
 */
export async function resolveGridBase(grid: string): Promise<string> {
  if (/^https?:/.test(grid)) return grid
  const local = (path: string) => new URL(`${import.meta.env.BASE_URL}data/${path}`, document.baseURI).href
  if (!grid.includes('/')) return local(`hyde/${grid}`)
  const name = grid.split('/').pop() ?? grid
  try {
    const index = (await fetch(local('hyde/index.json')).then((r) => (r.ok ? r.json() : null))) as { grids: Array<{ name: string; path?: string; fallback?: string }> } | null
    const entry = index?.grids.find((g) => g.name === name)
    if (entry?.path) {
      const primary = /^https?:/.test(entry.path) ? entry.path : local(entry.path)
      if (!entry.fallback) return primary
      // A bucket behind a young domain may not resolve everywhere yet; if its summary does not answer, the bucket's own URL does.
      try {
        const head = await fetch(`${primary}.json`, { method: 'HEAD' })
        if (head.ok) return primary
      } catch {
        // fall through to the fallback
      }
      console.warn(`grid ${name}: ${primary} did not answer; using ${entry.fallback}`)
      return entry.fallback
    }
  } catch {
    // fall through to the local path
  }
  return local(grid)
}
/**
 * The part of the map the panels leave clear. On a wide screen the study's
 * panels take a column each side; on a phone they take the top and the
 * bottom. A camera that fits its points to the whole canvas puts them
 * under a panel, so the padding is measured from the panels themselves.
 */
function clearPadding(map: MapLibreMap): { top: number; bottom: number; left: number; right: number } {
  const canvas = map.getCanvas()
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const margin = Math.max(24, Math.round(Math.min(w, h) * 0.06))
  const hud = document.querySelector('.study-hud')
  const fallback = { top: margin, bottom: margin, left: margin, right: margin }
  if (!hud) return fallback
  const wide = w > 700
  const panels = [...hud.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.offsetWidth > 0 && el.offsetHeight > 0)
  if (panels.length === 0) return fallback
  const box = hud.getBoundingClientRect()
  if (wide) {
    // Columns: the widest panel on each side, and only panels that leave the middle clear.
    const left = Math.max(0, ...panels.filter((el) => el.getBoundingClientRect().right < box.left + w * 0.45).map((el) => el.getBoundingClientRect().right - box.left))
    const right = Math.max(0, ...panels.filter((el) => el.getBoundingClientRect().left > box.left + w * 0.55).map((el) => box.right - el.getBoundingClientRect().left))
    return { top: margin, bottom: margin, left: Math.min(Math.round(left) + margin, Math.round(w * 0.42)), right: Math.min(Math.round(right) + margin, Math.round(w * 0.42)) }
  }
  // Stacked: the panels above and below whatever middle band is left.
  const top = Math.max(0, ...panels.filter((el) => el.getBoundingClientRect().bottom < box.top + h * 0.5).map((el) => el.getBoundingClientRect().bottom - box.top))
  const bottom = Math.max(0, ...panels.filter((el) => el.getBoundingClientRect().top > box.top + h * 0.5).map((el) => box.bottom - el.getBoundingClientRect().top))
  return { top: Math.min(Math.round(top) + margin, Math.round(h * 0.4)), bottom: Math.min(Math.round(bottom) + margin, Math.round(h * 0.4)), left: margin, right: margin }
}

/** Studies with more tracks than this draw them through the WebGL layer instead of GeoJSON sources. */
export const GL_TRACK_THRESHOLD = 100

function Badge({ evidence }: { evidence: Evidenced['evidence'] }) {
  return <span className={`badge badge--${evidence}`}>{TIER_LABEL[evidence]}</span>
}

function staticFeatures(study: Study) {
  const paths: EvidenceFeature[] = []
  const sites: EvidenceFeature[] = []
  const rings: EvidenceFeature[] = []
  for (const e of study.entities) {
    if (e.kind === 'track') {
      if (e.reveal === 'full') paths.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: e.track.geometry().map((p) => [p[0], p[1]]) }, properties: { evidence: e.route.evidence, id: e.id } })
    } else if (e.kind === 'site') {
      if (e.appearsAt !== undefined) continue
      sites.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.position[0], e.position[1]] }, properties: { evidence: e.evidence, id: e.id } })
      if (e.uncertaintyMetres) {
        rings.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: geodesicCircle(e.position, e.uncertaintyMetres).map((p) => [p[0], p[1]]) },
          properties: { evidence: e.evidence === 'withheld' ? 'withheld' : 'inferred', id: `${e.id}-ring` },
        })
      }
    }
  }
  return { paths, sites, rings }
}

/** An effect with plume assumptions follows the burst switch; one without keeps the burst its study gave it. */
function modeOf(e: Entity & { kind: 'effect' }, burst: Burst): Burst {
  return e.fallout ? burst : (e.burst ?? burst)
}

function effectRings(e: Entity & { kind: 'effect' }, mode: Burst) {
  const burst = modeOf(e, mode)
  if (burst === 'air') return e.effects.rings
  // Surface burst: overpressure rings shrink to the contact-burst radii; thermal and fireball rings are kept as drawn.
  return e.effects.rings.map((r) => (r.key.startsWith('psi') ? { ...r, radius: radiusForPsi(e.effects.yieldKt, Number(r.key.slice(3)), 'surface') } : r))
}

function trackSpecs(study: Study): TrackSpec[] {
  const specs: TrackSpec[] = []
  for (const e of study.entities) {
    if (e.kind === 'track') specs.push({ id: e.id, track: e.track, route: e.route.evidence, evidence: e.evidence, side: e.side ?? 'attacker', vehicle: e.vehicle ?? 'missile', reveal: e.reveal })
  }
  return specs
}

/** Timed geometry for the GeoJSON sources. `tracks` is false when the WebGL layer draws vehicles and flown paths. */
function timedFeatures(study: Study, time: number, burst: Burst, selectedId: string | null, tracks: boolean) {
  const vehicles: EvidenceFeature[] = []
  const rings: EvidenceFeature[] = []
  const areas: EvidenceFeature[] = []
  const paths: EvidenceFeature[] = []
  const flashes: EvidenceFeature[] = []
  /** True when something drawn here changes continuously with time, such as a spreading plume. */
  let animated = false
  for (const e of study.entities) {
    if (e.kind === 'track') {
      if (!tracks) continue
      const p = e.track.positionAt(time)
      if (p) vehicles.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p[0], p[1]] }, properties: { evidence: e.evidence, id: e.id, side: e.side ?? 'attacker', vehicle: e.vehicle ?? 'missile', heading: e.vehicle === 'aircraft' ? (e.track.headingAt(time) ?? 0) : 0 } })
      if (e.reveal === 'progressive') {
        const flown = e.track.geometryUntil(time)
        if (flown.length > 1) paths.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: flown.map((q) => [q[0], q[1]]) }, properties: { evidence: e.route.evidence, id: e.id } })
      }
    } else if (e.kind === 'effect' && time >= e.time) {
      if (e.compact && e.id !== selectedId) {
        // One mark per detonation, radius from the 5 psi ring so it scales with yield; rings only when selected, plumes always.
        const r5 = drawnRadius(e, burst, 'psi5')
        flashes.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.center[0], e.center[1]] }, properties: { evidence: 'modelled', id: e.id, radiusMetres: r5, age: time - e.time, side: e.side ?? 'attacker' } })
        if (burst === 'surface' && e.fallout) {
          animated = true
          const contours = plume({ center: e.center, yieldKt: e.effects.yieldKt, fissionFraction: e.fallout.fissionFraction, windMph: e.fallout.windMph, downwindBearingDeg: e.fallout.downwindBearingDeg, untilHours: e.fallout.untilHours, shearDeg: e.fallout.shearDeg, terrainFactor: e.fallout.terrainFactor, reachedHours: (time - e.time) / 3_600 })
          for (const c of [...contours].reverse()) areas.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [c.ring.map((p) => [p[0], p[1]])] }, properties: { evidence: 'modelled', id: `${e.id}-plume-${c.key}`, dose: c.radsPerHour } })
        }
        continue
      }
      const drawn = effectRings(e, burst)
      for (const ring of drawn) {
        const coords = geodesicCircle(e.center, ring.radius).map((p) => [p[0], p[1]])
        rings.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { evidence: 'modelled', id: `${e.id}-${ring.key}` } })
      }
      const outer = drawn.reduce((a, b) => (b.radius > a.radius ? b : a))
      areas.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [geodesicCircle(e.center, outer.radius).map((p) => [p[0], p[1]])] }, properties: { evidence: 'modelled', id: `${e.id}-area` } })
      if (burst === 'surface' && e.fallout) {
        animated = true
        const hoursSince = (time - e.time) / 3_600
        const contours = plume({ center: e.center, yieldKt: e.effects.yieldKt, fissionFraction: e.fallout.fissionFraction, windMph: e.fallout.windMph, downwindBearingDeg: e.fallout.downwindBearingDeg, untilHours: e.fallout.untilHours, shearDeg: e.fallout.shearDeg, terrainFactor: e.fallout.terrainFactor, reachedHours: hoursSince })
        for (const c of [...contours].reverse()) {
          areas.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [c.ring.map((p) => [p[0], p[1]])] }, properties: { evidence: 'modelled', id: `${e.id}-plume-${c.key}` } })
          rings.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c.ring.map((p) => [p[0], p[1]]) }, properties: { evidence: 'modelled', id: `${e.id}-plume-${c.key}-line` } })
        }
      }
    }
  }
  return { vehicles, rings, areas, paths, flashes, animated }
}

function drawnRadius(e: Entity & { kind: 'effect' }, burst: Burst, key: string): number {
  const ring = effectRings(e, burst).find((r) => r.key === key)
  return ring ? ring.radius : 0
}

/**
 * The headline cells for one side. With a union they are path-dependent: blast
 * first, then fire as Postol's bound, then fallout among the survivors, and
 * the last cell is all three in sequence. Before the union answers, the
 * per-target sums stand in.
 */
function OutcomeCells({ union, blastDead, blastInjured, fireDead, falloutDead, under1, plumes, falloutHours = 0, rising = false }: { union: UnionTotals | undefined; blastDead: number; blastInjured: number; fireDead: number; falloutDead: number | null; under1: number; plumes: number; falloutHours?: number; rising?: boolean }) {
  const showFallout = union ? union.underPlume > 0 : falloutDead !== null
  return (
    <div className="two-numbers">
      <div>
        <span>Blast only · 1961 method</span>
        <strong>{fmt(union ? union.blastDead : blastDead)}</strong>
        <em>dead · {fmt(union ? union.blastInjured : blastInjured)} injured</em>
      </div>
      <div>
        <span>With mass fire · Postol bound</span>
        <strong>{fmt(union ? union.fireDead : fireDead)}</strong>
        <em>dead</em>
      </div>
      {showFallout && (
        <div className={rising ? 'is-rising' : undefined}>
          <span>
            Fallout · no shelter{union ? ' · among the survivors' : ''}
            {falloutHours >= STAY_HOURS ? ' · if nobody leaves for a month' : falloutHours > 0 ? ` · to H+${falloutHours} h` : ''}
          </span>
          <strong>{fmt(union ? union.falloutDead : (falloutDead ?? 0))}</strong>
          <em>
            acute deaths · {fmt(union ? union.underPlume : under1)} under the plumes{union ? '' : ` · ${plumes} plumes summed`}
            {rising ? ' · still rising' : ''}
          </em>
        </div>
      )}
      {union && showFallout && union.personRads > 0 && (
        <div>
          <span>Latent fatal cancers, over decades</span>
          <strong>{fmt(latentFatalCancers(union.personRads))}</strong>
          <em>
            among the survivors · {fmt(union.personRads / 100)} person-sieverts at {Math.round(CANCER_PER_PERSON_SIEVERT * 1_000) / 10}% per sievert
          </em>
        </div>
      )}
      {union && showFallout && (
        <div>
          <span>Blast, fire and fallout in sequence</span>
          <strong>{fmt(union.combinedDead)}</strong>
          <em>dead · one minus the product of the survivals, per grid sample</em>
        </div>
      )}
    </div>
  )
}

function labelOffset(anchor: LabelAnchor): [number, number] {
  switch (anchor) {
    case 'left':
      return [10, 0]
    case 'right':
      return [-10, 0]
    case 'top':
      return [0, 12]
    case 'bottom':
      return [0, -12]
    case 'bottom-left':
      return [6, -8]
    case 'top-left':
      return [6, 8]
  }
}

function labelElement(entity: Entity, onSelect: (id: string) => void): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `ev-label ev-label--${entity.evidence}${entity.kind === 'site' && entity.appearsAt !== undefined ? ' ev-label--appears' : ''}`
  el.innerHTML = `<span class="ev-label-name"></span><span class="ev-label-designation"></span>`
  ;(el.firstChild as HTMLElement).textContent = entity.name
  ;(el.lastChild as HTMLElement).textContent = entity.designation
  el.addEventListener('click', (event) => {
    event.stopPropagation()
    onSelect(entity.id)
  })
  return el
}

/** What a study reports when the loop runs it to its end. */
export interface LoopSide {
  name: string
  detonations: number
  /** Dead by the union in sequence where the grid was summed, else the per-target sum with fire; null when nothing was computed. */
  dead: number | null
  injured: number | null
  method: 'union' | 'summed' | 'none'
}
export interface LoopResult {
  attacker: LoopSide
  defender: LoopSide
}
/** Driving the study from outside: run at this rate from the start, orbit the camera, and report when the clock and the sums have finished. */
export interface LoopOptions {
  rate: number
  onFinished: (result: LoopResult) => void
}

export function StudyView({ study, loop, autoplay }: { study: Study; loop?: LoopOptions; autoplay?: { rate: number } }) {
  const loopRef = useRef<LoopOptions | undefined>(loop)
  useEffect(() => {
    loopRef.current = loop
  }, [loop])
  const finished = useRef(false)
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef<Map<string, Marker>>(new Map())
  const terrainSync = useRef<((force?: boolean) => void) | null>(null)
  const trackLayer = useRef<TrackLayer | null>(null)
  const flashLayer = useRef<TrackLayer | null>(null)
  /** Whether flown trails fade behind the vehicles; on by default where the WebGL layer draws them. */
  const [trails, setTrails] = useState<'keep' | 'fade'>('fade')
  const trailsRef = useRef(trails)
  /** Sources are rewritten only when the clock moves, and once on first paint. */
  const primed = useRef(false)
  const exposureService = useRef<ExposureService | null>(null)
  const computed = useRef<Set<string>>(new Set())
  const [outcomes, setOutcomes] = useState<Record<string, Outcome & { grid: string }>>({})
  const [burst, setBurst] = useState<Burst>(study.defaultBurst ?? 'air')
  const burstRef = useRef<Burst>(study.defaultBurst ?? 'air')
  const falloutComputed = useRef<Set<string>>(new Set())
  /** Detonations due but not yet added to their side's union, and what the unions say so far. */
  const unionQueue = useRef<Record<'attacker' | 'defender', UnionDetonation[]>>({ attacker: [], defender: [] })
  const unionBusy = useRef<Record<'attacker' | 'defender', boolean>>({ attacker: false, defender: false })
  const unionCount = useRef<Record<'attacker' | 'defender', number>>({ attacker: 0, defender: 0 })
  const [unions, setUnions] = useState<Partial<Record<'attacker' | 'defender', { totals: UnionTotals; detonations: number; plumes: number }>>>({})
  const unionPlumes = useRef<Record<'attacker' | 'defender', number>>({ attacker: 0, defender: 0 })
  const resetUnions = () => {
    unionQueue.current = { attacker: [], defender: [] }
    unionCount.current = { attacker: 0, defender: 0 }
    unionPlumes.current = { attacker: 0, defender: 0 }
    setUnions({})
    const service = exposureService.current
    if (service) for (const side of ['attacker', 'defender'] as const) service.unionReset(side).catch(() => undefined)
  }
  const [falloutOutcomes, setFalloutOutcomes] = useState<Record<string, { under1: number; dead: number; grid: string; hours: number }>>({})
  /** The stage each plume's count has been carried to, hours after its burst. */
  const falloutStage = useRef<Map<string, number>>(new Map())
  const [gridName, setGridName] = useState<string | null>(null)
  const effectCount = useMemo(() => study.entities.filter((e) => e.kind === 'effect').length, [study])
  // The toggles and the variants fold away; the clock, the transport and the scrubber do not.
  const fold = useFold('study')
  const sums = useMemo(() => {
    const sideOf: Record<string, 'attacker' | 'defender'> = {}
    const totals = { attacker: 0, defender: 0 }
    for (const e of study.entities) {
      if (e.kind !== 'effect') continue
      const side = e.side ?? 'attacker'
      sideOf[e.id] = side
      totals[side] += 1
    }
    const forSide = (side: 'attacker' | 'defender') => {
      const values = Object.entries(outcomes)
        .filter(([id]) => sideOf[id] === side)
        .map(([, o]) => o)
      const fallout = Object.entries(falloutOutcomes)
        .filter(([id]) => sideOf[id] === side)
        .map(([, o]) => o)
      return {
        computed: values.length,
        total: totals[side],
        blastDead: values.reduce((s, o) => s + o.blast.fatal, 0),
        blastInjured: values.reduce((s, o) => s + o.blast.injured, 0),
        fireDead: values.reduce((s, o) => s + o.fire.fatal, 0),
        falloutComputed: fallout.length,
        falloutDead: fallout.reduce((s, o) => s + o.dead, 0),
        under1: fallout.reduce((s, o) => s + o.under1, 0),
        falloutHours: fallout.length > 0 ? Math.max(...fallout.map((o) => o.hours)) : 0,
      }
    }
    return { all: Object.keys(outcomes).length, attacker: forSide('attacker'), defender: forSide('defender') }
  }, [outcomes, falloutOutcomes, study])
  const aggregate = { ...sums.attacker, computed: sums.all }
  const defence = sums.defender
  const bounds = burst === 'surface' && study.surfaceBounds ? study.surfaceBounds : study.bounds
  const boundsRef = useRef(bounds)

  useEffect(() => {
    boundsRef.current = bounds
  }, [bounds])
  const initialClock: ClockState = { time: (study.startTime ?? Math.max(study.bounds.start, -600)), playing: !!loop || !!autoplay, rate: loop?.rate ?? autoplay?.rate ?? 60 }
  const clockRef = useRef<ClockState>(initialClock)
  const [clock, setClock] = useState<ClockState>(initialClock)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedRef = useRef<string | null>(null)
  const focusMarker = useRef<Marker | null>(null)
  useEffect(() => {
    // Development handles for driving a selection from the console.
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __grid84Study?: Study; __grid84Select?: (id: string | null) => void }
    w.__grid84Study = study
    w.__grid84Select = setSelectedId
  }, [study])
  const missile = useMemo(() => missileOf(study, selectedId), [study, selectedId])
  const launch = useMemo(() => launchedFrom(study, selectedId), [study, selectedId])
  useEffect(() => {
    selectedRef.current = selectedId
    primed.current = false
    // The selected vehicle, or the vehicles that delivered the selected detonation, come back out of the fade; the rest of the
    // missile, the bus and its other warheads, comes half way, as do the vehicles a selected launch point sent.
    const e = study.entities.find((x) => x.id === selectedId)
    const lit = e?.kind === 'track' ? [e.id] : e?.kind === 'effect' ? (e.deliveredBy ?? []) : launch ? launch.tracks.map((t) => t.id) : []
    const faint = missile ? [missile.bus.id, ...missile.vehicles.map((v) => v.id)].filter((id) => !lit.includes(id)) : launch ? launch.vehicles.map((v) => v.id) : []
    trackLayer.current?.setHighlight(lit, faint)
    // The other detonations of the missile, or everything the launch point hit, ringed; the bus separation marked.
    const map = mapRef.current
    const targets = (missile?.effects ?? launch?.effects ?? []).filter((x) => x.id !== selectedId)
    const features: EvidenceFeature[] = targets.map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.center[0], x.center[1]] }, properties: { evidence: 'modelled', id: x.id, role: 'target' } }))
    if (missile) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [missile.separation.position[0], missile.separation.position[1]] }, properties: { evidence: 'modelled', id: `${missile.bus.id}-separation`, role: 'separation' } })
    if (map?.getSource('ev-focus')) setSourceData(map, 'ev-focus', features)
    focusMarker.current?.remove()
    focusMarker.current = null
    if (missile && map) {
      const el = document.createElement('div')
      el.className = 'ev-focus-label'
      el.textContent = missile.kind === 'aircraft' ? `RELEASE · ${formatStudyTime(missile.separation.time)} · ${missile.vehicles.length} MISSILE${missile.vehicles.length > 1 ? 'S' : ''}` : `BUS SEPARATION · ${formatStudyTime(missile.separation.time)} · ${Math.round(missile.separation.altitude / 1000)} KM · ${missile.vehicles.length} RV`
      focusMarker.current = new Marker({ element: el, anchor: 'left', offset: [10, 0] }).setLngLat([missile.separation.position[0], missile.separation.position[1]]).addTo(map)
    }
  }, [selectedId, study, missile, launch])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    document.title = `Grid/84 · ${study.title.replace(/\s+/g, ' ')}`
  }, [study])
  /** The longest deposition window any of this study's plumes has, hours; the fallout count stops rising there. */
  const falloutHorizon = useMemo(() => Math.max(0, ...study.entities.map((e) => (e.kind === 'effect' && e.fallout ? e.fallout.untilHours : 0))), [study])
  const statics = useMemo(() => staticFeatures(study), [study])
  // Buses and carrier aircraft: the tracks that release other tracks; their ends are the separation and release points.
  const buses = useMemo(() => {
    const parents = new Set(study.entities.filter((e) => e.kind === 'track' && busIdOf(e.id) !== e.id).map((e) => busIdOf(e.id)))
    return study.entities.filter((e): e is Extract<Entity, { kind: 'track' }> => e.kind === 'track' && parents.has(e.id)).map((e) => {
      const child = study.entities.find((c): c is Extract<Entity, { kind: 'track' }> => c.kind === 'track' && busIdOf(c.id) === e.id && c.id !== e.id)
      const at = child ? child.track.waypoints[0] : e.track.waypoints[e.track.waypoints.length - 1]
      return { id: e.id, time: at.time, position: at.position, kind: child && /-cm\d+$/.test(child.id) ? 'release' : 'separation' }
    }).concat(study.entities.flatMap((e) => (e.kind === 'track' && e.marks ? e.marks.map((m) => ({ id: `${e.id}-${m.kind}`, time: m.time, position: m.position, kind: m.kind as string })) : [])))
  }, [study])
  // The WebGL layer draws large studies and any study whose tracks leave the surface, which GeoJSON cannot.
  const glTracks = useMemo(() => study.entities.filter((e) => e.kind === 'track').length > GL_TRACK_THRESHOLD || study.entities.some((e) => e.kind === 'track' && e.track.elevated), [study])
  const selected = study.entities.find((e) => e.id === selectedId) ?? null

  useEffect(() => {
    if (!container.current) return
    const map = createBaseMap(container.current, { center: study.view.center, zoom: study.view.zoom })
    mapRef.current = map
    if (import.meta.env.DEV) Object.assign(window, { __grid84Map: map })
    const labels = markers.current
    map.on('load', () => {
      terrainSync.current = installTerrainSync(map)
      installEvidenceLayers(map)
      // Tracks go beneath the effect areas so the plumes and rings, which are the result, read over them; the flashes go on top.
      const layer = new TrackLayer('ev-tracks-gl')
      layer.setFade({ enabled: trailsRef.current === 'fade' })
      if (glTracks) layer.setScene(prepareTracks(trackSpecs(study)))
      else setSourceData(map, SOURCES.paths, statics.paths)
      map.addLayer(layer, 'ev-areas-fill')
      trackLayer.current = layer
      const flashes = new TrackLayer('ev-flash-gl')
      map.addLayer(flashes, 'ev-vehicles-glow')
      flashLayer.current = flashes
      // Outlines the study carries, such as a target's boundary, under the effects.
      if (study.overlays && study.overlays.length > 0) {
        map.addSource('ev-overlays', { type: 'geojson', data: { type: 'FeatureCollection', features: study.overlays.flatMap((o) => o.rings.map((ring) => ({ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [ring.map((p) => [p[0], p[1]])] }, properties: { id: o.id, name: o.name } }))) } })
        ensureAlarmHatch(map)
        map.addLayer({ id: 'ev-overlays-fill', type: 'fill', source: 'ev-overlays', paint: { 'fill-pattern': ALARM_HATCH, 'fill-opacity': 0.22 } }, 'ev-areas-fill')
        map.addLayer({ id: 'ev-overlays-line', type: 'line', source: 'ev-overlays', paint: { 'line-color': '#ff8a1f', 'line-width': 1.6, 'line-opacity': 0.9 } }, 'ev-areas-fill')
        map.addLayer({ id: 'ev-overlays-line-dark', type: 'line', source: 'ev-overlays', paint: { 'line-color': '#0a0602', 'line-width': 1.6, 'line-dasharray': [2, 2], 'line-opacity': 0.85 } }, 'ev-areas-fill')
      }
      // The focus of a selection: the other targets of the same missile or launch point, ringed, and the bus separation point.
      map.addSource('ev-focus', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      // Separation and release points on the trails, small and permanent once passed.
      map.addSource('ev-separations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      // A separation point belongs to the trail it sits on, so it fades with it:
      // the same hold and span the track layer uses, driven by the mark's own age.
      const markFade = ['interpolate', ['linear'], ['get', 'age'], 0, 1, TRAIL_HOLD_SECONDS, 1, TRAIL_HOLD_SECONDS + TRAIL_FADE_SECONDS, 0] as unknown as ExpressionSpecification
      map.addLayer({ id: 'ev-separations', type: 'circle', source: 'ev-separations', paint: { 'circle-radius': ['case', ['==', ['get', 'kind'], 'burnout'], 2, 2.4], 'circle-color': ['case', ['==', ['get', 'kind'], 'burnout'], 'rgba(255, 190, 90, 0.95)', 'rgba(232, 251, 255, 0.95)'], 'circle-opacity': markFade, 'circle-stroke-color': ['case', ['==', ['get', 'kind'], 'burnout'], 'rgba(255, 160, 60, 0.5)', 'rgba(141, 250, 255, 0.55)'], 'circle-stroke-width': 1.5, 'circle-stroke-opacity': markFade } })
      map.addLayer({ id: 'ev-focus-targets', type: 'circle', source: 'ev-focus', filter: ['==', ['get', 'role'], 'target'], paint: { 'circle-radius': 9, 'circle-color': 'rgba(0, 0, 0, 0)', 'circle-stroke-color': 'rgba(141, 250, 255, 0.55)', 'circle-stroke-width': 1 } })
      map.addLayer({ id: 'ev-focus-separation', type: 'circle', source: 'ev-focus', filter: ['==', ['get', 'role'], 'separation'], paint: { 'circle-radius': 4, 'circle-color': 'rgba(141, 250, 255, 0.9)', 'circle-stroke-color': 'rgba(141, 250, 255, 0.4)', 'circle-stroke-width': 4 } })
      setSourceData(map, SOURCES.sites, statics.sites)
      for (const e of study.entities) {
        if (e.label === false) continue
        const position = e.kind === 'site' ? e.position : e.kind === 'effect' ? e.center : null
        if (!position) continue
        const anchor = e.kind === 'site' ? (e.labelAnchor ?? 'left') : 'left'
        const marker = new Marker({ element: labelElement(e, setSelectedId), anchor, offset: labelOffset(anchor) }).setLngLat([position[0], position[1]])
        if (e.kind === 'site' && e.appearsAt === undefined) marker.addTo(map)
        markers.current.set(e.id, marker)
      }
      for (const e of study.entities) {
        if (e.kind !== 'track' || e.label === false) continue
        const anchor = e.labelAnchor ?? 'left'
        const marker = new Marker({ element: labelElement(e, setSelectedId), anchor, offset: labelOffset(anchor) })
        markers.current.set(e.id, marker)
      }
      setReady(true)
    })
    map.on('click', (event) => {
      const hits = map.queryRenderedFeatures(event.point, { layers: ['ev-flashes'] })
      const id = hits[0]?.properties?.id
      setSelectedId(typeof id === 'string' ? id : null)
    })
    return () => {
      labels.forEach((m) => m.remove())
      labels.clear()
      map.remove()
      mapRef.current = null
      trackLayer.current = null
      flashLayer.current = null
      setReady(false)
    }
  }, [study, statics, glTracks])

  // Population grid for outcome calculation, loaded once per study in a worker.
  useEffect(() => {
    if (!study.populationGrid) return
    let service: ExposureService | null = null
    let cancelled = false
    resolveGridBase(study.populationGrid)
      .then((base) => {
        if (cancelled) return
        service = new ExposureService(base, study.exposureWorkers ?? 1)
        exposureService.current = service
        if (import.meta.env.DEV) Object.assign(window, { __grid84Exposure: service })
        return service.load()
      })
      .then((summary) => {
        if (summary && exposureService.current === service) setGridName(`${summary.source.name} ${summary.source.year} · ${summary.source.licence}`)
      })
      .catch((error) => {
        // A destroyed service rejects its load; only clear the ref if it is still ours.
        if (service && exposureService.current !== service) return
        console.warn('population grid unavailable', error)
        exposureService.current = null
      })
    return () => {
      cancelled = true
      service?.destroy()
      exposureService.current = null
    }
  }, [study])

  useEffect(() => {
    if (!ready) return
    let frame = 0
    let last = performance.now()
    let lastSources = 0
    let lastPanel = 0
    let lastFlashes = 0
    let lastUnion = 0
    let flashesKey = ''
    let appearedKey = ''
    let separationsKey = ''
    let appearedRings: EvidenceFeature[] = []
    let ringsKey = ''
    const perf = { ticks: 0, updateMs: 0, maxUpdateMs: 0, renderer: glTracks ? 'webgl' : 'geojson' }
    if (import.meta.env.DEV) Object.assign(window, { __grid84Perf: perf })
    const tick = (now: number) => {
      // Slow frames must not slow the study clock: allow up to a second of wall time per frame.
      const dt = Math.min(1, (now - last) / 1_000)
      last = now
      const previous = clockRef.current
      const next = advance(previous, dt, boundsRef.current)
      const changed = next !== previous
      clockRef.current = next
      const map = mapRef.current
      if (map && changed) {
        // Camera moves fire when the running clock crosses their event; scrubbing does not fly.
        for (const event of study.events) {
          if (event.camera && previous.time < event.time && next.time >= event.time) {
            const c = event.camera
            if (c.fit && c.fit.length > 1) {
              // Fit the points that matter into the part of the map the panels leave clear.
              const lons = c.fit.map((p) => p[0])
              const lats = c.fit.map((p) => p[1])
              map.fitBounds(
                [
                  [Math.min(...lons), Math.min(...lats)],
                  [Math.max(...lons), Math.max(...lats)],
                ],
                { padding: clearPadding(map), pitch: c.pitch ?? 0, bearing: c.bearing ?? 0, duration: c.durationMs ?? 4_000, maxZoom: c.zoom, essential: true },
              )
            } else {
              map.flyTo({ center: [c.center[0], c.center[1]], zoom: c.zoom, pitch: c.pitch ?? 0, bearing: c.bearing ?? 0, duration: c.durationMs ?? 4_000, essential: true })
            }
          }
        }
      }
      // Cheap when unchanged; keeps terrain honest even if MapLibre never reports the fly-to ending.
      if (map) terrainSync.current?.()
      // Labels on tracks that leave the surface are lifted to the vehicle's height every frame, since the camera may move without the clock.
      const layer = trackLayer.current
      if (map && layer) {
        for (const e of study.entities) {
          if (e.kind !== 'track' || !e.track.elevated) continue
          const marker = markers.current.get(e.id)
          if (!marker || !marker.getElement().isConnected) continue
          const p = e.track.positionAt(next.time)
          if (!p) continue
          const base = labelOffset(e.labelAnchor ?? 'left')
          const lift = layer.screenOffset(p[0], p[1], e.track.altitudeAt(next.time))
          marker.setOffset(lift ? [base[0] + lift[0], base[1] + lift[1]] : base)
        }
      }
      // Map sources are rewritten at most about fifteen times a second; the readout about ten.
      const refreshSources = !primed.current || now - lastSources > 66
      let updated = false
      const updateStart = performance.now()
      if (map && (changed || !primed.current) && refreshSources) {
        primed.current = true
        lastSources = now
        updated = true
        const timed = timedFeatures(study, next.time, burstRef.current, selectedRef.current, !glTracks)
        if (glTracks) {
          trackLayer.current?.setTime(next.time)
        } else {
          setSourceData(map, SOURCES.vehicles, timed.vehicles)
          setSourceData(map, SOURCES.paths, [...statics.paths, ...timed.paths])
        }
        // Rings and areas only change with selection, burst mode or a spreading plume; flashes age slowly.
        const nextRingsKey = `${timed.rings.length}:${timed.areas.length}:${selectedRef.current}:${burstRef.current}:${timed.animated ? Math.floor(now / 500) : ''}`
        if (nextRingsKey !== ringsKey) {
          ringsKey = nextRingsKey
          setSourceData(map, SOURCES.rings, [...statics.rings, ...timed.rings, ...appearedRings])
          setSourceData(map, SOURCES.areas, timed.areas)
        }
        const nextFlashesKey = `${timed.flashes.length}:${selectedRef.current}`
        if (nextFlashesKey !== flashesKey || now - lastFlashes > 500) {
          flashesKey = nextFlashesKey
          lastFlashes = now
          setSourceData(map, SOURCES.flashes, timed.flashes)
        }
        // Separation and release points appear on the trails as the clock passes them.
        if (buses.length > 0) {
          const due = buses.filter((b) => next.time >= b.time)
          const fading = trailsRef.current === 'fade'
          // While the trails fade, the marks have to be rewritten as they age; while they do not, only their number changes.
          const key = fading ? `${due.length}:${Math.round(next.time / 20)}` : String(due.length)
          if (key !== separationsKey) {
            separationsKey = key
            setSourceData(map, 'ev-separations', due.map((b) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [b.position[0], b.position[1]] }, properties: { evidence: 'modelled' as const, id: `${b.id}-${b.kind}`, kind: b.kind, age: fading ? Math.max(0, next.time - b.time) : 0 } })))
          }
        }
        // Sites that come into existence during the study: the source and the label follow the clock, and a flash marks the moment.
        const appearing = study.entities.filter((e): e is Extract<Entity, { kind: 'site' }> => e.kind === 'site' && e.appearsAt !== undefined)
        if (appearing.length > 0) {
          const due = appearing.filter((e) => next.time >= (e.appearsAt as number) && (e.vanishesAt === undefined || next.time < e.vanishesAt))
          const key = due.map((e) => e.id).join(',')
          if (key !== appearedKey) {
            appearedKey = key
            setSourceData(map, SOURCES.sites, [...statics.sites, ...due.map((e) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [e.position[0], e.position[1]] }, properties: { evidence: e.evidence, id: e.id } }))])
            appearedRings = due.filter((e) => e.uncertaintyMetres).map((e) => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: geodesicCircle(e.position, e.uncertaintyMetres as number).map((p) => [p[0], p[1]]) }, properties: { evidence: (e.evidence === 'withheld' ? 'withheld' : 'inferred') as 'withheld' | 'inferred', id: `${e.id}-ring` } }))
            // A ring that encloses ground worth filling: the boost-phase reach, hatched.
            setSourceData(map, 'ev-reach', due.filter((e) => e.ringFill === 'hatch' && e.uncertaintyMetres).map((e) => ({ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [geodesicCircle(e.position, e.uncertaintyMetres as number).map((p) => [p[0], p[1]])] }, properties: { evidence: 'modelled' as const, id: `${e.id}-reach` } })))
            ringsKey = ''
          }
          for (const e of appearing) {
            const at = e.appearsAt as number
            const isDue = next.time >= at && (e.vanishesAt === undefined || next.time < e.vanishesAt)
            const marker = markers.current.get(e.id)
            if (marker) {
              if (isDue && !marker.getElement().isConnected) marker.addTo(map)
              else if (!isDue && marker.getElement().isConnected) marker.remove()
            }
            if (changed && previous.time < at && next.time >= at && previous.playing) flashLayer.current?.flash(e.position[0], e.position[1], 22)
          }
        }
        for (const e of study.entities) {
          const marker = markers.current.get(e.id)
          if (e.kind === 'track') {
            if (!marker) continue
            const p = e.track.positionAt(next.time)
            if (p) {
              marker.setLngLat([p[0], p[1]])
              if (!marker.getElement().isConnected) marker.addTo(map)
            } else if (marker.getElement().isConnected) marker.remove()
          } else if (e.kind === 'effect') {
            const due = next.time >= e.time
            // A radial flash when the running clock crosses the detonation; scrubbing does not flash.
            if (changed && previous.time < e.time && next.time >= e.time && previous.playing) {
              flashLayer.current?.flash(e.center[0], e.center[1], 40 + 24 * Math.log10(Math.max(1, e.effects.yieldKt)))
            }
            if (marker) {
              if (due && !marker.getElement().isConnected) marker.addTo(map)
              else if (!due && marker.getElement().isConnected) marker.remove()
            }
            const service = exposureService.current
            if (due && service && service.grid && !computed.current.has(e.id)) {
              computed.current.add(e.id)
              const yieldKt = e.effects.yieldKt
              const mode = modeOf(e, burstRef.current)
              const rings = [...OTA_BANDS.map((b) => ({ key: b.key, radius: radiusForPsi(yieldKt, b.minPsi, mode) })), { key: 'fire', radius: thirdDegreeBurnRadiusMetres(yieldKt) }]
              const gridName = `${service.grid.source.name} · ${service.grid.source.year}`
              unionQueue.current[e.side ?? 'attacker'].push({ center: e.center, bandRadii: OTA_BANDS.map((b) => radiusForPsi(yieldKt, b.minPsi, mode)), fireRadius: thirdDegreeBurnRadiusMetres(yieldKt) })
              service
                .exposure({ center: e.center, rings, subsamples: 4 })
                .then((result) => {
                  const bands = applyBands(bandPopulations(result.within))
                  setOutcomes((prev) => ({ ...prev, [e.id]: { ...outcome(bands, result.within.fire ?? 0), grid: gridName } }))
                })
                .catch((error) => {
                  console.warn('exposure failed', error)
                  computed.current.delete(e.id)
                })
            }
            // The fallout count is carried forward as the dose accumulates: the plume reaches further and the people
            // under the near contours have taken more, so the figure grows through the study rather than arriving whole.
            // Stages while the study runs; at its end the count is carried out to a month, which the readout labels.
            const atEnd = next.time >= bounds.end - 1
            const stageHours = e.fallout ? (atEnd ? STAY_HOURS : FALLOUT_STAGES.filter((hrs) => hrs <= Math.min((next.time - e.time) / 3_600, e.fallout!.untilHours)).pop()) : undefined
            if (burstRef.current === 'surface' && e.fallout && service && service.grid && stageHours !== undefined && stageHours > (falloutStage.current.get(e.id) ?? 0)) {
              const first = !falloutStage.current.has(e.id)
              falloutStage.current.set(e.id, stageHours)
              falloutComputed.current.add(e.id)
              const f = e.fallout
              const contours = plume({ center: e.center, yieldKt: e.effects.yieldKt, fissionFraction: f.fissionFraction, windMph: f.windMph, downwindBearingDeg: f.downwindBearingDeg, untilHours: stageHours, shearDeg: f.shearDeg, terrainFactor: f.terrainFactor, reachedHours: stageHours })
              const gridName = `${service.grid.source.name} · ${service.grid.source.year}`
              const plumeSide = e.side ?? 'attacker'
              // The union keeps the worst dose each person has taken, so re-adding a plume at a later hour raises it rather than counting it twice.
              if (first) unionPlumes.current[plumeSide] += 1
              service
                .unionPlumes(plumeSide, e.id, contours.map((c) => ({ ring: c.ring, doseMidRads: c.doseMidRads })), BAND_FRACTIONS)
                .then((totals) => setUnions((prev) => ({ ...prev, [plumeSide]: { totals, detonations: unionCount.current[plumeSide], plumes: unionPlumes.current[plumeSide] } })))
                .catch((error) => console.warn('plume union failed', error))
              service
                .polygons(contours.map((c) => ({ key: c.key, ring: c.ring })))
                .then((r) => {
                  let dead = 0
                  for (let i = 0; i < contours.length; i += 1) {
                    const inner = i > 0 ? (r.within[contours[i - 1].key] ?? 0) : 0
                    const band = Math.max(0, (r.within[contours[i].key] ?? 0) - inner)
                    dead += band * acuteMortality(contours[i].doseMidRads)
                  }
                  setFalloutOutcomes((prev) => ({ ...prev, [e.id]: { under1: r.within[contours[contours.length - 1].key] ?? 0, dead, grid: gridName, hours: stageHours } }))
                })
                .catch((error) => {
                  console.warn('fallout exposure failed', error)
                  falloutComputed.current.delete(e.id)
                  falloutStage.current.delete(e.id)
                })
            }
          }
        }
      }
      if (updated && import.meta.env.DEV) {
        // Dev-only counters for the main-thread cost of a source update, readable as window.__grid84Perf.
        const ms = performance.now() - updateStart
        perf.ticks += 1
        perf.updateMs += ms
        perf.maxUpdateMs = Math.max(perf.maxUpdateMs, ms)
      }
      // Each side's union takes the new detonations in batches, so a person under several is counted once.
      const unionService = exposureService.current
      if (unionService && unionService.grid) {
        for (const side of ['attacker', 'defender'] as const) {
          const queue = unionQueue.current[side]
          if (!queue.length || unionBusy.current[side] || (now - lastUnion < 1_500 && next.playing)) continue
          lastUnion = now
          const batch = queue.splice(0, queue.length)
          unionBusy.current[side] = true
          unionCount.current[side] += batch.length
          const detonations = unionCount.current[side]
          unionService
            .union(side, batch, BAND_FRACTIONS)
            .then((totals) => {
              setUnions((prev) => ({ ...prev, [side]: { totals, detonations, plumes: unionPlumes.current[side] } }))
            })
            .catch((error) => console.warn('union failed', error))
            .finally(() => {
              unionBusy.current[side] = false
            })
        }
      }
      // The loop's camera: a slow drift of longitude whenever no flight is under way.
      const orbitMap = mapRef.current
      if (loopRef.current && orbitMap && !orbitMap.isMoving()) {
        const c = orbitMap.getCenter()
        orbitMap.jumpTo({ center: [c.lng + 0.025, c.lat] })
      }
      if (changed && (now - lastPanel > 100 || !next.playing)) {
        lastPanel = now
        setClock(next)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [ready, study, statics, glTracks, buses, bounds.end])

  const setClockState = (patch: Partial<ClockState>) => {
    clockRef.current = { ...clockRef.current, ...patch }
    primed.current = false
    setClock(clockRef.current)
  }

  // The loop is told when the clock has reached the end and every detonation has been summed, or after a grace period if the sums cannot finish.
  useEffect(() => {
    const l = loopRef.current
    if (!l || finished.current || clock.playing || clock.time < bounds.end - 1) return
    const sideResult = (side: 'attacker' | 'defender'): LoopSide => {
      const s = side === 'attacker' ? sums.attacker : sums.defender
      const u = unions[side]
      const name = side === 'attacker' ? (study.sides?.attacker.name ?? 'Attacker') : (study.sides?.defender.name ?? 'Defender')
      if (u && u.detonations >= s.total && s.total > 0) return { name, detonations: s.total, dead: u.totals.underPlume > 0 ? u.totals.combinedDead : u.totals.fireDead, injured: u.totals.blastInjured, method: 'union' }
      if (s.computed > 0) return { name, detonations: s.total, dead: s.fireDead, injured: s.blastInjured, method: 'summed' }
      return { name, detonations: s.total, dead: null, injured: null, method: 'none' }
    }
    const complete = (['attacker', 'defender'] as const).every((side) => {
      const s = side === 'attacker' ? sums.attacker : sums.defender
      return s.total === 0 || (unions[side]?.detonations ?? 0) >= s.total
    })
    const report = () => {
      if (finished.current) return
      finished.current = true
      l.onFinished({ attacker: sideResult('attacker'), defender: sideResult('defender') })
    }
    if (complete) {
      report()
      return
    }
    const grace = window.setTimeout(report, 20_000)
    return () => window.clearTimeout(grace)
  }, [clock.playing, clock.time, bounds.end, sums, unions, study])

  // Per-target outcome lines only for small studies; a large one reports through the aggregate panel.
  const outcomeEvents = study.entities.flatMap((e) => {
    if (e.kind !== 'effect' || effectCount > 20) return []
    const o = outcomes[e.id]
    if (!o) return []
    return [
      { time: e.time + 2, text: `OUTCOME · ${e.name.toUpperCase()} · BLAST ONLY (1961 METHOD): ${fmt(o.blast.fatal)} DEAD · ${fmt(o.blast.injured)} INJURED (MODELLED)`, entityId: e.id },
      { time: e.time + 3, text: `OUTCOME · ${e.name.toUpperCase()} · WITH MASS FIRE (POSTOL BOUND): ${fmt(o.fire.fatal)} DEAD (MODELLED)`, entityId: e.id },
    ]
  })
  const falloutEvents = study.entities.flatMap((e) => {
    if (e.kind !== 'effect' || !e.fallout || burst !== 'surface') return []
    const f = e.fallout
    const lines = [{ time: e.time + 4, text: `FALLOUT · CONTACT SURFACE BURST · PLUME UNDER ${Math.round(f.windMph)} MPH WIND TOWARDS ${String(Math.round(f.downwindBearingDeg) % 360).padStart(3, '0')}° · FISSION ${Math.round(f.fissionFraction * 100)}% (ASSUMED)`, entityId: e.id }]
    const o = falloutOutcomes[e.id]
    if (o) lines.push({ time: e.time + f.untilHours * 3_600, text: `OUTCOME · FALLOUT TO H+${f.untilHours} H · ${fmt(o.under1)} UNDER 1 RAD/HR · ${fmt(o.dead)} ACUTE DEATHS, NO SHELTER (INFERRED)`, entityId: e.id })
    return lines
  })
  const log = [...study.events, ...outcomeEvents, ...falloutEvents].filter((e) => e.time <= clock.time).sort((a, b) => b.time - a.time)
  const hasSurfaceOption = study.entities.some((e) => e.kind === 'effect' && e.fallout)
  const switchBurst = (mode: Burst) => {
    burstRef.current = mode
    setBurst(mode)
    setClockState({ time: (study.startTime ?? Math.max(study.bounds.start, -600)), playing: false })
    computed.current.clear()
    falloutComputed.current.clear()
    falloutStage.current.clear()
    setOutcomes({})
    setFalloutOutcomes({})
    resetUnions()
    terrainSync.current?.(false)
    mapRef.current?.flyTo({ center: [study.view.center[0], study.view.center[1]], zoom: study.view.zoom, pitch: 0, bearing: 0, duration: 2_000, essential: true })
  }

  return (
    <div className="study">
      <div ref={container} className="atlas-map" aria-label={`${study.title} globe`} />
      <div className="atlas-vignette" aria-hidden="true" />
      <div className={`study-hud${loop ? ' study-hud--loop' : ''}`}>
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>{study.title}</strong>
          <span>{study.subtitle}</span>
        </header>

        <section className="clock" aria-label="Study clock">
          <div className="clock-time">{formatStudyTime(clock.time)}</div>
          <div className="clock-controls">
            {/* While the clock is stopped this is the thing to press, and it says so. */}
            <button type="button" className={clock.playing ? 'is-active' : 'is-primed'} onClick={() => setClockState({ playing: !clock.playing })}>
              {clock.playing ? 'HOLD' : 'RUN'}
            </button>
            {/* A study may open at a rate of its own, such as the atlas strike at twenty; it gets a button of its own so the running rate is always lit. */}
            {(RATES.includes(clock.rate) ? RATES : [...RATES, clock.rate].sort((a, b) => a - b)).map((rate) => (
              <button key={rate} type="button" className={clock.rate === rate ? 'is-active' : ''} onClick={() => setClockState({ rate })}>
                {rate}×
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setClockState({ time: (study.startTime ?? Math.max(study.bounds.start, -600)), playing: false })
                computed.current.clear()
                falloutComputed.current.clear()
                falloutStage.current.clear()
                setOutcomes({})
                setFalloutOutcomes({})
                resetUnions()
                terrainSync.current?.(false)
                mapRef.current?.flyTo({ center: [study.view.center[0], study.view.center[1]], zoom: study.view.zoom, pitch: 0, bearing: 0, duration: 2_000, essential: true })
              }}
            >
              RESET
            </button>
            {(glTracks || hasSurfaceOption || study.variants) && (
              <button type="button" className={`panel-fold-toggle${fold.folded ? '' : ' is-active'}`} aria-expanded={!fold.folded} onClick={fold.toggle}>
                {fold.label}
              </button>
            )}
          </div>
          <div className={`panel-fold${fold.folded ? ' is-folded' : ''}`}>
          {(glTracks || hasSurfaceOption) && (
            <div className="clock-controls clock-controls--toggles">
              {glTracks && (
                <span className="clock-group">
                  <span className="clock-label">Trails</span>
                  {(['fade', 'keep'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={trails === mode ? 'is-active' : ''}
                      title={mode === 'fade' ? 'Flown paths hold for five minutes of study time, then fade over twenty-five to a trace' : 'Flown paths stay at full strength'}
                      onClick={() => {
                        setTrails(mode)
                        trailsRef.current = mode
                        trackLayer.current?.setFade({ enabled: mode === 'fade' })
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </span>
              )}
              {hasSurfaceOption && (
                <span className="clock-group">
                  <span className="clock-label">Burst</span>
                  {(['air', 'surface'] as Burst[]).map((mode) => (
                    <button key={mode} type="button" className={burst === mode ? 'is-active' : ''} onClick={() => switchBurst(mode)}>
                      {mode}
                    </button>
                  ))}
                </span>
              )}
            </div>
          )}
          {study.variants && (
            <div className="clock-controls clock-controls--variants" role="group" aria-label={study.variants.label}>
              <span className="clock-label">{study.variants.label}</span>
              {study.variants.items.map((item) => (
                <a key={item.id} href={item.href} className={item.id === study.variants!.current ? 'is-active' : ''} aria-current={item.id === study.variants!.current ? 'page' : undefined}>
                  {item.label}
                </a>
              ))}
            </div>
          )}
          </div>
          <input
            type="range"
            min={bounds.start}
            max={bounds.end}
            step={1}
            value={clock.time}
            aria-label="Scrub study time"
            onChange={(event) => setClockState({ time: Number(event.target.value), playing: false })}
          />
          <div className="clock-bounds">
            <span>{formatStudyTime(bounds.start)}</span>
            <span>{formatStudyTime(bounds.end)}</span>
          </div>
        </section>

        <section className="log" aria-label="Event log" aria-live="polite">
          <h2>Log</h2>
          {log.length === 0 && <p className="log-empty">Nothing yet. Run the clock.</p>}
          <ol>
            {log.map((e, i) => (
              <li key={`${e.time}-${e.text}`} className={i === 0 ? 'is-latest' : ''}>
                <time>{formatStudyTime(e.time)}</time>
                <button type="button" onClick={() => e.entityId && setSelectedId(e.entityId)} disabled={!e.entityId}>
                  {e.text}
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="provenance" aria-label="Selected entity">
          {selected ? (
            <>
              <h2>
                {selected.name} <Badge evidence={selected.evidence} />
              </h2>
              <p className="provenance-designation">{selected.designation}</p>
              <p className="provenance-source">{formatProvenance(selected.provenance)}</p>
              {selected.provenance.method && <p className="provenance-method">{selected.provenance.method}</p>}
              {selected.provenance.withheldUnder && <p className="provenance-method">Withheld: {selected.provenance.withheldUnder}</p>}
              {selected.kind === 'track' && (
                <p className="provenance-source">
                  Route <Badge evidence={selected.route.evidence} /> {formatProvenance(selected.route.provenance)}
                  {selected.route.provenance.method && <> · {selected.route.provenance.method}</>}
                </p>
              )}
              {selected.kind === 'effect' && selected.deliveredBy && selected.deliveredBy.length > 0 && (
                <div className="delivered">
                  <span className="clock-label">Delivered by</span>
                  <ul>
                    {selected.deliveredBy.map((id) => {
                      const t = study.entities.find((x) => x.id === id)
                      if (!t || t.kind !== 'track') return null
                      return (
                        <li key={id}>
                          <button type="button" onClick={() => setSelectedId(id)}>
                            {t.name} · {t.designation}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {missile && (
                <div className="delivered">
                  <span className="clock-label">{missile.kind === 'aircraft' ? 'The whole load' : 'The whole missile'}</span>
                  <p className="provenance-method">
                    {missile.bus.name.split(' → ')[0]} · {missile.vehicles.length} {missile.kind === 'aircraft' ? 'cruise missiles · released at' : 'reentry vehicles · bus separation at'} {formatStudyTime(missile.separation.time)}{missile.kind === 'aircraft' ? '' : `, ${Math.round(missile.separation.altitude / 1000)} km up`}
                    {(() => {
                      const known = missile.effects.filter((x) => outcomes[x.id])
                      if (known.length === 0) return null
                      const dead = known.reduce((a, x) => a + outcomes[x.id].fire.fatal, 0)
                      return ` · ${fmt(dead)} dead across ${known.length} of its ${missile.effects.length} detonations, each counted at its own target`
                    })()}
                  </p>
                  <ul>
                    {missile.vehicles.map((v, k) => {
                      const hit = missile.effects.find((x) => (x.deliveredBy ?? []).includes(v.id))
                      const own = v.id === selectedId || (selected.kind === 'effect' && (selected.deliveredBy ?? []).includes(v.id))
                      return (
                        <li key={v.id} className={own ? 'is-own' : ''}>
                          <button type="button" onClick={() => setSelectedId(hit ? hit.id : v.id)}>
                            {missile.kind === 'aircraft' ? 'Missile' : 'RV'} {k + 1} → {v.name.split(' → ')[1] ?? v.name}
                            {hit ? ` · ${formatStudyTime(hit.time)}${outcomes[hit.id] ? ` · ${fmt(outcomes[hit.id].fire.fatal)} dead` : ''}` : ' · no detonation recorded'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {launch && !missile && (
                <div className="delivered">
                  <span className="clock-label">Launched from here</span>
                  <p className="provenance-method">
                    {launch.tracks.length} vehicle{launch.tracks.length > 1 ? 's' : ''}{launch.vehicles.length > 0 ? `, ${launch.vehicles.length} reentry vehicles` : ''} · {launch.effects.length} detonation{launch.effects.length === 1 ? '' : 's'}
                    {(() => {
                      const known = launch.effects.filter((x) => outcomes[x.id])
                      if (known.length === 0) return null
                      return ` · ${fmt(known.reduce((a, x) => a + outcomes[x.id].fire.fatal, 0))} dead across ${known.length} of them, each counted at its own target`
                    })()}
                  </p>
                  <ul>
                    {launch.tracks.slice(0, 24).map((t) => (
                      <li key={t.id}>
                        <button type="button" onClick={() => setSelectedId(t.id)}>
                          {t.name.split(' → ').slice(1).join(' → ') || t.name} · {t.designation}
                        </button>
                      </li>
                    ))}
                    {launch.tracks.length > 24 && <li className="provenance-method">and {launch.tracks.length - 24} more</li>}
                  </ul>
                </div>
              )}
              {selected.kind === 'effect' && burst === 'surface' && (
                <p className="provenance-method">Surface burst: overpressure radii by {SURFACE_BLAST_MODEL}. {selected.fallout?.provenance.method}</p>
              )}
              {selected.kind === 'effect' && falloutOutcomes[selected.id] && (
                <div className="two-numbers">
                  <div>
                    <span>Under the 1 rad/hr contour</span>
                    <strong>{fmt(falloutOutcomes[selected.id].under1)}</strong>
                    <em>people · {falloutOutcomes[selected.id].grid}</em>
                  </div>
                  <div>
                    <span>Acute fallout deaths, no shelter · to H+{falloutOutcomes[selected.id].hours} h</span>
                    <strong>{fmt(falloutOutcomes[selected.id].dead)}</strong>
                    <em>to H+{selected.fallout?.untilHours} h · Table 12.108</em>
                  </div>
                </div>
              )}
              {selected.kind === 'effect' && outcomes[selected.id] && (
                <div className="two-numbers">
                  <div>
                    <span>Blast only · 1961 method</span>
                    <strong>{fmt(outcomes[selected.id].blast.fatal)}</strong>
                    <em>dead · {fmt(outcomes[selected.id].blast.injured)} injured · {outcomes[selected.id].grid}</em>
                  </div>
                  <div>
                    <span>With mass fire · Postol bound</span>
                    <strong>{fmt(outcomes[selected.id].fire.fatal)}</strong>
                    <em>dead · everyone inside the fire zone</em>
                  </div>
                </div>
              )}
              <dl>
                {selected.facts.map((fact) => (
                  <div key={fact.label} className={`fact fact--${fact.evidence}`} title={`${formatProvenance(fact.provenance)}${fact.provenance.method ? ` · ${fact.provenance.method}` : ''}${fact.provenance.withheldUnder ? ` · ${fact.provenance.withheldUnder}` : ''}`}>
                    <dt>
                      {fact.label} <Badge evidence={fact.evidence} />
                    </dt>
                    <dd className={fact.evidence === 'withheld' ? 'is-withheld' : ''}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <>
              <h2>Provenance</h2>
              <p className="log-empty">Select a mark or a log line. Every mark on this page traces to a source.</p>
            </>
          )}
        </section>

        {/* One detonation has an outcome as much as a hundred do: a strike on a
            small town is sized for a single warhead, and it used to show nothing. */}
        {effectCount > 0 && (
          <section className="aggregate" aria-label="Aggregate outcome">
            <h2>
              Outcome calculation <span className="badge badge--modelled">MODELLED</span>
            </h2>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={effectCount} aria-valuenow={aggregate.computed}>
              <div style={{ width: `${(100 * aggregate.computed) / effectCount}%` }} />
            </div>
            <p className="log-empty">
              {aggregate.computed} of {effectCount} detonations summed over {gridName ?? 'the population grid'}
              {unions.attacker ? ` · ${unions.attacker.detonations} in the union, each person counted once` : ''}
            </p>
            <OutcomeCells union={unions.attacker?.totals} blastDead={aggregate.blastDead} blastInjured={aggregate.blastInjured} fireDead={aggregate.fireDead} falloutDead={aggregate.falloutComputed > 0 ? aggregate.falloutDead : null} under1={aggregate.under1} plumes={aggregate.falloutComputed} falloutHours={aggregate.falloutHours} rising={aggregate.falloutHours > 0 && aggregate.falloutHours < falloutHorizon} />
            {unions.attacker && aggregate.computed > 1 && (
              <p className="log-empty">
                Summed per target instead, as the log lines are, with people under several detonations counted each time: {fmt(aggregate.blastDead)} dead by blast, {fmt(aggregate.fireDead)} with fire
              </p>
            )}
            {study.outcomeReference && (
              <p className="provenance-source">
                {study.outcomeReference.label}: {fmt(study.outcomeReference.value)} · {study.outcomeReference.source}
              </p>
            )}
            {study.sides && defence.total > 0 && (
              <>
                <h2>
                  {study.sides.defender.name} <span className="badge badge--inferred">INFERRED</span>
                </h2>
                <p className="log-empty">
                  {defence.computed} of {defence.total} detonations
                  {unions.defender ? ` · ${unions.defender.detonations} in the union, each person counted once` : ''}
                </p>
                <OutcomeCells union={unions.defender?.totals} blastDead={defence.blastDead} blastInjured={defence.blastInjured} fireDead={defence.fireDead} falloutDead={defence.falloutComputed > 0 ? defence.falloutDead : null} under1={defence.under1} plumes={defence.falloutComputed} falloutHours={defence.falloutHours} rising={defence.falloutHours > 0 && defence.falloutHours < falloutHorizon} />
                {unions.defender && defence.computed > 1 && (
                  <p className="log-empty">
                    Summed per target instead: {fmt(defence.blastDead)} dead by blast, {fmt(defence.fireDead)} with fire
                  </p>
                )}
                {study.sides.defender.reference && (
                  <p className="provenance-source">
                    {study.sides.defender.reference.label}: {fmt(study.sides.defender.reference.value)} · {study.sides.defender.reference.source}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        <section className="omissions" aria-label="Not computed">
          <h2>Not represented</h2>
          <ul>
            {study.omissions.map((o) => (
              <li key={o}>{o}</li>
            ))}
            {burst === 'air' && effectCount > 0 && (
              <li>
                No fallout is drawn, and that is not the same as none existing. At the height that maximises the blast area the fireball never reaches the ground, so there is no soil for the fission products to condense onto and no plume within hours; the same activity instead forms particles small enough to stay aloft for weeks or years and comes down worldwide, much decayed and much diluted. This engine counts the local plume of a surface burst and does not count the delayed global fallout of an air burst, which is real and is nobody's local dose
              </li>
            )}
            {burst === 'surface' && (
              <>
                <li>
                  Nobody moves. The dose accumulates from arrival over the population where the grid has it. For an attack of this size that is close to the case, and it is what the governments themselves assumed: British policy was to stay at home, and American crisis relocation needed several days of warning it did not expect to get
                </li>
                <li>
                  The count stops at the acute deaths and the latent cancers. Everything between them is omitted: the injured who die because there is no hospital, the people who die of the winter without heat or water, the crops that fail, the famine that the atmospheric work of the last decade puts far above every prompt effect combined. Those are the deaths the studies of consequence are about, and this engine does not model them
                </li>
                <li>
                  Nobody shelters either, and that is a bound rather than a case. The dose is taken in the open, at a protection factor of one; a ground-floor inner room is worth about five and a basement twenty, so a sheltered population takes a fraction of this. It is the largest single uncertainty in any fallout figure, and the reason official and academic estimates of the same attack differ by millions. <a href="#/lab/fallout">The fallout lab</a> has the factor as a control
                </li>
              </>
            )}
          </ul>
          {study.links && study.links.length > 0 && (
            <>
              <h2>Further reading</h2>
              <ul className="study-links">
                {study.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <EvidenceLegend />
      </div>
    </div>
  )
}
