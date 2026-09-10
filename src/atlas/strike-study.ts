import type { Launcher, Target } from '../models/allocation.ts'
import { enactStrike, launcherSite } from '../studies/strike.ts'
import type { Entity, Study, StudyEvent } from '../studies/study.ts'
import { designate } from './designation.ts'
import { FORCES_SOURCE, POWERS } from './forces.ts'
import { STRIKE_GRID } from './profile.ts'
import { describeAimPoints, type StrikePlan } from './solver.ts'
import { airReachMetres, boostWindow, SPACE_LAYERS, spaceChance } from '../models/boost-intercept.ts'
import type { WindAloft } from './wind.ts'
import type { Boundary } from './boundary.ts'

/**
 * The generated study: one strike, as the solver planned it, on the 2025
 * grid, with the wind of the hour. Everything else the study engine does,
 * the inbound track, the bus and its reentry vehicles, the rings, the
 * exposure and the plume, it does here as in the documented studies.
 */

const fmtYield = (kt: number) => (kt >= 1_000 ? `${(kt / 1_000).toFixed(1)} MT` : `${kt} KT`)

/** Study seconds before the launch, spent on the target with its aim points marked; at the autoplay rate a few real seconds. */
export const PRELUDE_SECONDS = 120

export function buildStrikeStudy(plan: StrikePlan, wind: WindAloft, countdownSeconds = PRELUDE_SECONDS, boundary: Boundary | null = null): Study {
  const { target, delivery, sizing, adversary, classification, salvos } = plan
  const site = delivery.site
  const power = POWERS[adversary.power]
  const launchers: Launcher[] = salvos.map((s) => ({
    id: `atlas-${s.option.site.id}`,
    name: `${s.option.site.name} (${s.option.site.system})`,
    kind: s.option.site.kind,
    position: s.option.site.position,
    weapons: s.warheads,
    weaponsPerVehicle: s.option.site.warheadsPerMissile,
    rangeMetres: s.option.site.rangeKm * 1_000,
    yieldKt: sizing.yieldKt,
    reactionSeconds: s.launchDelaySeconds,
    speedMs: s.option.site.kind === 'bomber' && s.option.site.carrierSpeedMs !== 0 ? (s.option.site.carrierSpeedMs ?? 240) : undefined,
    standoffMetres: s.option.site.kind === 'bomber' && s.option.site.standoffKm !== undefined ? s.option.site.standoffKm * 1_000 : undefined,
    missileSpeedMs: s.option.site.missileSpeedMs,
    propellant: s.option.site.propellant,
  }))
  const launcher = launchers[0]
  const designation = designate(target)
  const perAim = sizing.aimPoints.length === 1 ? sizing.warheads : 1
  const targets: Target[] = sizing.aimPoints.map((p, i) => ({ id: i === 0 ? 'target' : `target-aim-${i + 1}`, name: i === 0 ? target.name : `${target.name} · aim point ${i + 1}`, priority: i, position: p, maxWeapons: perAim }))
  const strike = enactStrike({
    prefix: 'atlas',
    side: 'attacker',
    launchers,
    targets,
    allocation: { maxWeaponsPerTarget: perAim },
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
    ...launchers.map((l, i) => {
      const s = salvos[i].option.site
      return launcherSite(l, { side: 'attacker', designation: `${s.kind.toUpperCase()} · ${s.system.toUpperCase()} · ${salvos[i].missiles} MISSILE${salvos[i].missiles > 1 ? 'S' : ''}${salvos[i].launchDelaySeconds > 0 ? ` · HELD ${salvos[i].launchDelaySeconds} S` : ''}`, evidence: s.evidence, provenance: { source: s.source, method: s.note }, positionEvidence: s.positionEvidence, label: true, facts: [{ label: 'Load', value: `${s.warheadsPerMissile} × ${fmtYield(s.yieldKt)} per missile · range ${s.rangeKm.toLocaleString('en-GB')} km · CEP ${s.cepMetres} m · reliability ${Math.round(s.reliability * 100)}%`, evidence: s.evidence, provenance: { source: s.source } }, ...(s.kind === 'bomber' ? [{ label: 'Standoff', value: s.standoffKm ? `${s.standoffKm.toLocaleString('en-GB')} km: ${s.standoffNote ?? 'the missile\'s reach'}` : 'None: a gravity bomb, so the aircraft must reach the target itself', evidence: s.standoffEvidence ?? ('inferred' as const), provenance: { source: s.source, method: 'Doctrine is to release at the edge of the missile\'s range, outside the defences' } }] : []), ...(salvos[i].launchDelaySeconds > 0 ? [{ label: 'Launch held', value: `${salvos[i].launchDelaySeconds} s after the first salvo, so its warheads arrive with the others': time on target`, evidence: 'modelled' as const, provenance: { source: 'The atlas solver' } }] : [])] })
    }),
    { kind: 'site', id: 'target-site', name: target.name, designation: `${[designation.role.toUpperCase(), designation.code].filter(Boolean).join(' ')} · ${classification.category}`, label: true, position: target.position, evidence: 'documented', provenance: { source: 'OpenStreetMap via Photon' }, facts: [{ label: 'Population', value: classification.population > 0 ? `${Math.round(plan.classification.population).toLocaleString('en-GB')} within 30 km on the 2025 grid` : 'None on the grid', evidence: 'modelled', provenance: { source: 'GHSL GHS-POP R2023A, 2025 epoch' } }, { label: 'Kill probability', value: `${Math.round(plan.kill.perWarhead * 100)}% per warhead as fired: ${classification.category.toLowerCase()} taken at ${plan.kill.psi} psi, lethal radius ${(plan.kill.lethalRadiusMetres / 1000).toFixed(1)} km against a CEP of ${plan.kill.cepMetres} m, reliability ${Math.round(plan.kill.reliability * 100)}%`, evidence: site.evidence, provenance: { source: 'SSPK = 1 − 0.5^((r/CEP)²), the accuracy lab; CEP and reliability from the forces file' } }] },
    // The boost-phase reach at each launch point: a ring a space interceptor must already be inside when the missile lifts, gone at burnout.
    ...(delivery.boost
      ? salvos.map((sv, i) => {
          const w = boostWindow(delivery.boost!.burnoutSeconds)
          const best = spaceChance(w, SPACE_LAYERS[0])
          const thousand = spaceChance(w, SPACE_LAYERS[1])
          return {
            kind: 'site' as const,
            id: `reach-${i + 1}`,
            name: 'Boost-phase reach',
            designation: `A SPACE INTERCEPTOR MUST BE INSIDE THIS RING AT LAUNCH · ${Math.round(best.reachMetres / 1000).toLocaleString('en-GB')} KM · ${w.availableSeconds} S · ${SPACE_LAYERS[0].interceptors.toLocaleString('en-GB')} PEBBLES: ${Math.round(best.chance * 100)}% · A THOUSAND: ${Math.round(thousand.chance * 100)}%`,
            label: i === 0,
            labelAnchor: 'right' as const,
            position: sv.option.site.position,
            appearsAt: sv.launchDelaySeconds,
            vanishesAt: sv.launchDelaySeconds + delivery.boost!.burnoutSeconds,
            uncertaintyMetres: best.reachMetres,
            evidence: 'modelled' as const,
            provenance: { source: 'The boost-phase arithmetic: detection at 60 s, decision at 30 s, a closing speed of 5 km/s; the constellation spread over its shell; one minus the Poisson zero', method: `An aircraft with a hypersonic interceptor would have to loiter within ${Math.round(airReachMetres(w) / 1000)} km of the launch point` },
            facts: [
              { label: 'The window', value: `Burnout at ${delivery.boost!.burnoutSeconds} s; ${w.availableSeconds} s after detection and decision`, evidence: 'reconstructed' as const, provenance: { source: 'Boost profiles by class from the open literature' } },
              { label: 'A space layer', value: SPACE_LAYERS.map((l) => `${l.name}: ${spaceChance(w, l).expected.toFixed(1)} expected within reach, ${Math.round(spaceChance(w, l).chance * 100)}%`).join('; '), evidence: 'modelled' as const, provenance: { source: 'The defence lab\'s Brilliant Pebbles and space-layer cases' } },
            ],
          }
        })
      : []),
    ...describeAimPoints(sizing, target.position).map((a, i, all) => ({
      kind: 'site' as const,
      id: `aim-${a.index + 1}`,
      // The aim points materialise one by one through the prelude.
      // The aim points come up in the first moments of the hold, so they sit on the opening view before the launch pulls the camera out.
      appearsAt: -countdownSeconds + Math.round(countdownSeconds * (0.06 + (0.24 * i) / Math.max(1, all.length))),
      name: `Aim point ${a.index + 1}`,
      designation: `${a.index === 0 ? 'AIM POINT 1 · CENTRE' : `AIM POINT ${a.index + 1} · ${(a.distanceMetres / 1000).toFixed(1)} KM AT ${Math.round(a.bearingDeg).toString().padStart(3, '0')}°`} · CEP ${site.cepMetres} M`,
      label: a.index < 8,
      // The ring is the weapon's CEP: half the warheads fall inside it.
      uncertaintyMetres: site.cepMetres,
      labelAnchor: (a.bearingDeg > 180 ? 'right' : 'left') as 'left' | 'right',
      position: a.position,
      evidence: 'modelled' as const,
      provenance: { source: 'The atlas solver', method: a.reason },
      facts: [
        { label: 'Why here', value: a.reason, evidence: 'modelled' as const, provenance: { source: 'The atlas solver: a sunflower spaced so the 5 psi discs meet, centred on the geocoder\'s point' } },
        { label: 'CEP', value: `${site.cepMetres} m for the ${site.system}: the ring within which half the warheads fall; the lethal radius at ${plan.kill.psi} psi is ${(plan.kill.lethalRadiusMetres / 1000).toFixed(1)} km`, evidence: site.evidence, provenance: { source: site.source, method: 'Circular error probable as the open literature gives it; inferred for the opaque arsenals' } },
      ],
    })),
    ...strike.entities,
  ]
  const aims = describeAimPoints(sizing, target.position)
  const approachLine = plan.lines.find((l) => /^APPROACH/.test(l)) ?? ''
  const events: StudyEvent[] = [
    { time: -countdownSeconds, text: `STRIKE ORDER · ${power.name.toUpperCase()} · ${site.system.toUpperCase()} FROM ${site.name.toUpperCase()}${salvos.length > 1 ? ` AND ${salvos.length - 1} MORE SITE${salvos.length > 2 ? 'S' : ''}` : ''} · ${sizing.warheads} × ${fmtYield(sizing.yieldKt)} ON ${target.name.toUpperCase()}`, entityId: 'target-site' },
    { time: -countdownSeconds + Math.round(countdownSeconds * 0.06), text: `AIM POINTS · ${sizing.aimPoints.length} · ${sizing.aimPoints.length > 1 ? `A SUNFLOWER WITH NEIGHBOURS ABOUT ${((sizing.r5 * 1.6) / 1000).toFixed(1)} KM APART SO THE 5 PSI DISCS OF ${fmtYield(sizing.yieldKt)} MEET` : sizing.warheads > 1 ? `ONE, AT THE CENTRE, WITH ${sizing.warheads} WARHEADS ON IT` : 'ONE, AT THE CENTRE'} · ${classification.category} · ${classification.countervalue && classification.urbanRadiusMetres > 0 ? `TILING THE ${Math.round(classification.urbanRadiusMetres / 1000)} KM URBAN AREA` : 'A POINT TARGET'}`, entityId: 'aim-1' },
    ...aims.slice(1, 4).map((a, k) => ({ time: -countdownSeconds + Math.round(countdownSeconds * (0.12 + k * 0.08)), text: `AIM POINT ${a.index + 1} · ${(a.distanceMetres / 1000).toFixed(1)} KM AT ${Math.round(a.bearingDeg).toString().padStart(3, '0')}° · ${a.reason.split(' · ').slice(-1)[0]}`, entityId: `aim-${a.index + 1}` })),
    { time: -Math.round(countdownSeconds * 0.45), text: plan.kill.line, entityId: 'aim-1' },
    { time: -Math.round(countdownSeconds * 0.2), text: approachLine || `APPROACH · FROM ${Math.round((plan.bearingDeg + 180) % 360)}°`, entityId: launcher.id },
    ...salvos.filter((s) => s.launchDelaySeconds > 0).map((s) => ({ time: s.launchDelaySeconds, text: `LAUNCH · ${s.option.site.name.toUpperCase()} · ${s.missiles} MISSILE${s.missiles > 1 ? 'S' : ''} · HELD ${s.launchDelaySeconds} S FOR A COMMON ARRIVAL`, entityId: `atlas-${s.option.site.id}` })),
    { time: 0, text: `LAUNCH · ${salvos[0].option.site.name.toUpperCase()} · ${salvos[0].missiles} MISSILE${salvos[0].missiles > 1 ? 'S' : ''}${salvos.length > 1 ? ` · ${salvos.length - 1} MORE SITE${salvos.length > 2 ? 'S' : ''} TO FOLLOW` : ''} · ${Math.round(delivery.distanceMetres / 1000).toLocaleString('en-GB')} KM · FLIGHT ${Math.round(delivery.flightSeconds / 60)} MIN`, entityId: launcher.id, camera: { center: [(site.position[0] + target.position[0]) / 2, (site.position[1] + target.position[1]) / 2], zoom: delivery.distanceMetres > 8_000_000 ? 2.3 : delivery.distanceMetres > 5_000_000 ? 2.8 : delivery.distanceMetres > 2_500_000 ? 3.6 : delivery.distanceMetres > 1_000_000 ? 4.6 : 5.8, durationMs: 2_500 } },
    ...(delivery.boost
      ? [{ time: 1, text: `BOOST-PHASE DEFENCE · ${boostWindow(delivery.boost.burnoutSeconds).availableSeconds} S · A SPACE INTERCEPTOR MUST ALREADY BE INSIDE THE RING AT ${delivery.site.name.split(' · ')[0].toUpperCase()} · ${SPACE_LAYERS.map((l) => `${l.interceptors.toLocaleString('en-GB')}: ${Math.round(spaceChance(boostWindow(delivery.boost!.burnoutSeconds), l).chance * 100)}%`).join(' · ')} · AN AIRCRAFT WITHIN ${Math.round(airReachMetres(boostWindow(delivery.boost.burnoutSeconds)) / 1000)} KM`, entityId: 'reach-1' }]
      : []),
    ...(delivery.boost ? [{ time: delivery.boost.burnoutSeconds, text: `BURNOUT · +${delivery.boost.burnoutSeconds} S · ${Math.round(delivery.boost.burnoutAltitudeMetres / 1000)} KM UP · THE BOOST-PHASE INTERCEPT WINDOW CLOSES · ${sizing.warheads > 1 && site.warheadsPerMissile > 1 ? 'THE BUS RELEASES ITS WARHEADS OVER THE NEXT MINUTE AND A HALF' : 'THE WARHEAD COASTS FROM HERE'}`, entityId: launcher.id }] : []),
    { time: arrival - 60, text: 'ONE MINUTE TO IMPACT', entityId: 'target-site', camera: { center: target.position, zoom: sizing.warheads > 3 ? 8 : 9, pitch: 40, durationMs: 3_000 } },
    { time: arrival, text: `DETONATION · ${target.name.toUpperCase()} · ${sizing.burst.toUpperCase()} BURST · ${fmtYield(sizing.yieldKt)}`, entityId: 'atlas-e-target' },
    ...(last > arrival + 1 ? [{ time: last, text: `LAST OF ${sizing.warheads} WARHEADS DOWN`, entityId: 'atlas-e-target' }] : []),
    ...(sizing.burst === 'surface' ? [{ time: arrival + 3_600, text: `FALLOUT · EFFECTIVE WIND FROM ${Math.round(wind.fromDeg)}° AT ${Math.round(wind.mph)} MPH · SHEAR ${Math.round(wind.shearDeg)}° · ${wind.live ? `THE FORECAST, ${wind.level.toUpperCase()}` : 'ASSUMED'}`, entityId: 'atlas-e-target', camera: { center: target.position, zoom: 6.5, pitch: 0, durationMs: 3_000 } }] : []),
  ]
  return {
    id: `atlas-strike-${target.id}`,
    title: `Strike on ${target.name}`,
    subtitle: `${power.adjective} ${site.system} from ${site.name.split(' · ')[0]}${salvos.length > 1 ? ` and ${salvos.length - 1} more` : ''} · ${sizing.warheads} × ${fmtYield(sizing.yieldKt).toLowerCase()} · ${classification.category.toLowerCase()} · 2025 grid`,
    bounds: { start: -countdownSeconds, end: last + 1_800 },
    startTime: -countdownSeconds,
    // Open on the target close enough to read its bounds; the launch pulls the camera out to the whole flight.
    view: { center: target.position, zoom: sizing.warheads > 4 ? 9.5 : 10.5 },
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
