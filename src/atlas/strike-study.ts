import type { Launcher, Target } from '../models/allocation.ts'
import { enactStrike, launcherSite } from '../studies/strike.ts'
import type { Entity, Study, StudyEvent } from '../studies/study.ts'
import { designate } from './designation.ts'
import { FORCES_SOURCE, POWERS } from './forces.ts'
import { STRIKE_GRID } from './profile.ts'
import type { StrikePlan } from './solver.ts'
import type { WindAloft } from './wind.ts'
import type { Boundary } from './boundary.ts'

/**
 * The generated study: one strike, as the solver planned it, on the 2025
 * grid, with the wind of the hour. Everything else the study engine does,
 * the inbound track, the bus and its reentry vehicles, the rings, the
 * exposure and the plume, it does here as in the documented studies.
 */

const fmtYield = (kt: number) => (kt >= 1_000 ? `${(kt / 1_000).toFixed(1)} MT` : `${kt} KT`)

export function buildStrikeStudy(plan: StrikePlan, wind: WindAloft, countdownSeconds = 5, boundary: Boundary | null = null): Study {
  const { target, delivery, sizing, adversary, classification } = plan
  const site = delivery.site
  const power = POWERS[adversary.power]
  const launcher: Launcher = {
    id: `atlas-${site.id}`,
    name: `${site.name} (${site.system})`,
    kind: site.kind,
    position: site.position,
    weapons: sizing.warheads,
    weaponsPerVehicle: site.warheadsPerMissile,
    rangeMetres: site.rangeKm * 1_000,
    yieldKt: sizing.yieldKt,
    reactionSeconds: 0,
    speedMs: site.kind === 'bomber' && site.carrierSpeedMs !== 0 ? (site.carrierSpeedMs ?? 240) : undefined,
    standoffMetres: site.kind === 'bomber' && site.standoffKm !== undefined ? site.standoffKm * 1_000 : undefined,
    missileSpeedMs: site.missileSpeedMs,
  }
  const designation = designate(target)
  const targets: Target[] = sizing.aimPoints.map((p, i) => ({ id: i === 0 ? 'target' : `target-aim-${i + 1}`, name: i === 0 ? target.name : `${target.name} · aim point ${i + 1}`, priority: i, position: p, maxWeapons: 1 }))
  const strike = enactStrike({
    prefix: 'atlas',
    side: 'attacker',
    launchers: [launcher],
    targets,
    allocation: { maxWeaponsPerTarget: 1 },
    attrition: { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: 1 }, penetration: 1, note: 'No attrition: the strike is shown as ordered, every weapon arriving' },
    allocationRule: { source: 'The atlas solver', method: `${sizing.reason}. Aim points in a sunflower spaced so the 5 psi discs meet` },
    vehicle: { evidence: site.evidence, provenance: { source: FORCES_SOURCE, method: site.note || 'The system, its load and its yield as the open literature gives them' } },
    route: { cruise: { source: 'Great circles: the aircraft to its release point at its cruising speed, then home; each missile from there to its aim point at cruise-missile speed' }, ballistic: { source: 'Minimum-energy trajectory over a spherical Earth', method: 'The bus splits after twelve per cent of the flight and each reentry vehicle takes its own arc' } },
    targetCategory: () => classification.category,
    burstFor: () => ({ burst: sizing.burst, fallout: sizing.burst === 'surface' ? { fissionFraction: 0.5, windMph: wind.mph, downwindBearingDeg: (wind.fromDeg + 180) % 360, untilHours: 48, shearDeg: wind.shearDeg, terrainFactor: 0.7, provenance: { source: wind.source, method: `Effective wind from ${Math.round(wind.fromDeg)}° at ${Math.round(wind.mph)} mph (${wind.level}), shear ${Math.round(wind.shearDeg)}°; fission fraction 0.5 assumed; dose rates at 0.7 of the idealized plane for a real surface (Glasstone §9.95)` } } : undefined }),
    targetFacts: () => [
      { label: 'Why this target', value: classification.reason, evidence: 'modelled', provenance: { source: 'The atlas solver: the geocoder\'s tags and the density profile of the 2025 grid' } },
      { label: 'Why this adversary', value: adversary.reason, evidence: 'inferred', provenance: { source: 'A stated rule by country, with a nearest-arsenal fallback; the reader can override it' } },
    ],
  })
  const arrival = Math.min(...Object.values(strike.firstArrival).map((f) => f.time))
  const last = Math.max(...Object.values(strike.firstArrival).map((f) => f.time))
  const entities: Entity[] = [
    launcherSite(launcher, { side: 'attacker', designation: `${site.kind.toUpperCase()} · ${site.system.toUpperCase()}`, evidence: site.evidence, provenance: { source: site.source, method: site.note }, positionEvidence: site.positionEvidence, label: true, facts: [{ label: 'Load', value: `${site.warheadsPerMissile} × ${fmtYield(site.yieldKt)} per missile · range ${site.rangeKm.toLocaleString('en-GB')} km`, evidence: site.evidence, provenance: { source: site.source } }] }),
    { kind: 'site', id: 'target-site', name: target.name, designation: `${[designation.role.toUpperCase(), designation.code].filter(Boolean).join(' ')} · ${classification.category}`, label: true, position: target.position, evidence: 'documented', provenance: { source: 'OpenStreetMap via Photon' }, facts: [{ label: 'Population within 10 km', value: classification.population > 0 ? `${Math.round(plan.classification.population).toLocaleString('en-GB')} within 30 km on the 2025 grid` : 'None on the grid', evidence: 'modelled', provenance: { source: 'GHSL GHS-POP R2023A, 2025 epoch' } }] },
    ...strike.entities,
  ]
  const events: StudyEvent[] = [
    { time: -countdownSeconds, text: `STRIKE ORDER · ${power.name.toUpperCase()} · ${site.system.toUpperCase()} FROM ${site.name.toUpperCase()} · ${sizing.warheads} × ${fmtYield(sizing.yieldKt)} ON ${target.name.toUpperCase()}`, entityId: launcher.id },
    { time: 0, text: `LAUNCH · ${sizing.missiles} MISSILE${sizing.missiles > 1 ? 'S' : ''} · ${Math.round(delivery.distanceMetres / 1000).toLocaleString('en-GB')} KM · FLIGHT ${Math.round(delivery.flightSeconds / 60)} MIN`, entityId: launcher.id, camera: { center: [(site.position[0] + target.position[0]) / 2, (site.position[1] + target.position[1]) / 2], zoom: delivery.distanceMetres > 8_000_000 ? 2.3 : delivery.distanceMetres > 5_000_000 ? 2.8 : delivery.distanceMetres > 2_500_000 ? 3.6 : delivery.distanceMetres > 1_000_000 ? 4.6 : 5.8, durationMs: 2_500 } },
    { time: arrival - 60, text: 'ONE MINUTE TO IMPACT', entityId: 'target-site', camera: { center: target.position, zoom: sizing.warheads > 3 ? 8 : 9, pitch: 40, durationMs: 3_000 } },
    { time: arrival, text: `DETONATION · ${target.name.toUpperCase()} · ${sizing.burst.toUpperCase()} BURST · ${fmtYield(sizing.yieldKt)}`, entityId: 'atlas-e-target' },
    ...(last > arrival + 1 ? [{ time: last, text: `LAST OF ${sizing.warheads} WARHEADS DOWN`, entityId: 'atlas-e-target' }] : []),
    ...(sizing.burst === 'surface' ? [{ time: arrival + 3_600, text: `FALLOUT · EFFECTIVE WIND FROM ${Math.round(wind.fromDeg)}° AT ${Math.round(wind.mph)} MPH · SHEAR ${Math.round(wind.shearDeg)}° · ${wind.live ? `THE FORECAST, ${wind.level.toUpperCase()}` : 'ASSUMED'}`, entityId: 'atlas-e-target', camera: { center: target.position, zoom: 6.5, pitch: 0, durationMs: 3_000 } }] : []),
  ]
  return {
    id: `atlas-strike-${target.id}`,
    title: `Strike on ${target.name}`,
    subtitle: `${power.adjective} ${site.system} from ${site.name.split(' · ')[0]} · ${sizing.warheads} × ${fmtYield(sizing.yieldKt).toLowerCase()} · ${classification.category.toLowerCase()} · 2025 grid`,
    bounds: { start: -countdownSeconds, end: last + 1_800 },
    startTime: -countdownSeconds,
    // Open on the target close enough to read its bounds; the launch pulls the camera out to the whole flight.
    view: { center: target.position, zoom: 7.5 },
    entities,
    events,
    omissions: [
      'The adversary and the weapon are a stated heuristic, not a plan on record; every arsenal here is the open literature\'s estimate and the opaque ones are inferred',
      'No attrition, no defence, no warning: the strike arrives as ordered',
      'Fallout from the wind of one level at one hour; no sheltering, no medical care, no fire spread beyond Postol\'s bound',
    ],
    populationGrid: STRIKE_GRID,
    defaultBurst: sizing.burst,
    surfaceBounds: { start: -countdownSeconds, end: last + 48 * 3_600 },
    exposureWorkers: 2,
    sides: { attacker: { name: power.name }, defender: { name: target.countryCode } },
    overlays: boundary ? [{ id: 'target-boundary', name: target.name, rings: boundary.rings, source: boundary.source }] : undefined,
    links: [
      { label: 'The 72 minutes: the modern single-strike studies this leans on', href: '#/study/72-minutes' },
      { label: 'The fallout lab: the plume model and its assumptions', href: '#/lab/fallout' },
      { label: 'The accuracy lab: yield against hardness', href: '#/lab/accuracy' },
      { label: 'The chronicle: posture and doctrine since 1945', href: '#/chronicle' },
      { label: 'Sources and attribution', href: '#/sources' },
    ],
  }
}
