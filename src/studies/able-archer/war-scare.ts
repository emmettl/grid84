import { Track, timeByGroundSpeed } from '../../engine/track.ts'
import type { EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import { haversineMetres, type LngLat } from '../../geo/geodesy.ts'
import type { Launcher, Target } from '../../models/allocation.ts'
import { enactStrike, type StrikeResult } from '../strike.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import orderOfBattle from '../../../data/able-archer/order-of-battle-1983.json'
import exerciseFile from '../../../data/able-archer/exercise-1983.json'

/**
 * Able Archer 83 gone hot. The week of the exercise as the documents give
 * it, the Soviet readiness as the intelligence record reports it, and on
 * the morning of 11 November, when the exercise executes its follow-on
 * strike, the branch the record avoided: the Soviet command reads it as
 * real, and frontal aviation, the missile brigades and the SS-20s strike
 * NATO's nuclear delivery means; what survives answers. A European war of
 * hours over the 1983 grid. Every target is inferred and says so.
 */

interface Site {
  side: 'nato' | 'wp'
  id: string
  kind: 'air' | 'pershing' | 'glcm' | 'hq' | 'missile' | 'ss20'
  name: string
  country?: string
  lon: number
  lat: number
  aircraft?: string
  count?: number
  qra?: number
  qraWeapons?: number
  generatedWeapons?: number
  alertWeapons?: number
  launchers?: number
  weapons?: number
  arriving?: number
  yieldKt?: number
  rangeKm?: number
  missile?: string
  evidence: string
  positionEvidence: string
  source: string
  note: string
}

const OOB = orderOfBattle as unknown as { rules: { qra: { perBase: number }; sovietAir: { alertFraction: number } }; sites: Site[] }
const EX = exerciseFile as unknown as {
  title: string
  zeroNote: string
  steps: Array<{ hours: number; text: string; evidence: string; source: string; camera?: { center: [number, number]; zoom: number; durationMs?: number }; action?: string }>
  airlift: { from: Array<[number, number]>; to: string; flights: number; drawn: number; speedKmh: number; note: string }
  sources: string[]
}
const SITES = OOB.sites
const site = (id: string) => SITES.find((s) => s.id === id)!
const HOUR = 3_600

const STRIKE_MS = 900_000 / 3_600
const F111_MS = 950_000 / 3_600
/** A NATO base loses its quick-reaction aircraft if a Soviet weapon lands within this distance before they launch. */
const STRUCK_WITHIN_M = 15_000
/** Launch on warning: the first Soviet launches at H+10 are seen, and the fifteen-minute alert forces leave at H+20. */
const QRA_LAUNCH = 20 * 60
const PERSHING_LAUNCH = 20 * 60
const GENERATED_LAUNCH = 4 * HOUR
const SOVIET_AIR_LAUNCH = 30 * 60
const SOVIET_SCUD_LAUNCH = 15 * 60
const SS20_LAUNCH = 10 * 60

const CARTE_BLANCHE: Provenance = { source: 'Exercise Carte Blanche, June 1955', locator: '335 simulated weapons on West German territory: 1.7 million dead and 3.5 million wounded in the exercise\'s own reckoning, the one documented figure for a theatre nuclear war in Germany' }

function tier(s: string): EvidenceTier {
  return s === 'documented' || s === 'reconstructed' || s === 'inferred' || s === 'modelled' || s === 'withheld' ? s : 'inferred'
}

function designation(s: Site): string {
  switch (s.kind) {
    case 'air':
      return s.side === 'nato' ? `${s.aircraft} · ${s.count} AIRCRAFT · ${s.qra} ON QRA · ${s.generatedWeapons} WEAPONS GENERATED` : `${s.aircraft} · ${s.count} AIRCRAFT · ${s.alertWeapons} ARMED AT THIRTY MINUTES`
    case 'pershing':
      return `PERSHING 1a · ${s.launchers} LAUNCHERS · ${s.yieldKt} KT`
    case 'glcm':
      return `GLCM · ${s.arriving} MISSILES ARRIVING 14 NOVEMBER · NONE OPERATIONAL`
    case 'missile':
      return `${s.missile} · ${s.launchers} LAUNCHERS · ${s.yieldKt} KT`
    case 'ss20':
      return `SS-20 · ${s.launchers} LAUNCHERS · ${s.weapons} WARHEADS OF ${s.yieldKt} KT`
    case 'hq':
      return 'HEADQUARTERS OR PORT'
  }
}

function siteEntity(s: Site): Entity {
  return {
    kind: 'site',
    id: s.id,
    name: s.name,
    designation: designation(s),
    label: (s.kind === 'air' && (s.country === 'UK' || s.side === 'wp')) || s.kind === 'pershing' || s.kind === 'glcm' || s.kind === 'ss20' || s.kind === 'missile' || s.id === 'shape' || s.id === 'crest-high' || s.id === 'wunsdorf',
    position: [s.lon, s.lat],
    evidence: s.kind === 'glcm' ? 'withheld' : tier(s.evidence),
    provenance: { source: s.source, method: s.note },
    facts: [
      { label: 'Strength', value: s.note, evidence: tier(s.evidence), provenance: { source: s.source } },
      { label: 'Position', value: 'Read from the modern map', evidence: tier(s.positionEvidence), provenance: { source: 'Photon geocoding of the base or town; some hand-set' } },
    ],
  }
}

function sovietLaunchers(): Launcher[] {
  const out: Launcher[] = []
  for (const s of SITES.filter((x) => x.side === 'wp')) {
    const position: LngLat = [s.lon, s.lat]
    if (s.kind === 'air') out.push({ id: s.id, name: s.name, kind: 'bomber', position, weapons: s.alertWeapons ?? 0, weaponsPerVehicle: 1, rangeMetres: 1_100_000, yieldKt: s.yieldKt ?? 100, reactionSeconds: SOVIET_AIR_LAUNCH, speedMs: STRIKE_MS })
    else if (s.kind === 'missile') out.push({ id: s.id, name: s.name, kind: 'irbm', position, weapons: s.weapons ?? 0, weaponsPerVehicle: 1, rangeMetres: (s.rangeKm ?? 300) * 1_000, yieldKt: s.yieldKt ?? 50, reactionSeconds: SOVIET_SCUD_LAUNCH })
    else if (s.kind === 'ss20') out.push({ id: s.id, name: s.name, kind: 'irbm', position, weapons: s.weapons ?? 0, weaponsPerVehicle: 3, rangeMetres: (s.rangeKm ?? 5_000) * 1_000, yieldKt: s.yieldKt ?? 150, reactionSeconds: SS20_LAUNCH })
  }
  return out
}

function natoTargets(): Target[] {
  return SITES.filter((s) => s.side === 'nato').map((s, i) => ({
    id: `t-${s.id}`,
    name: s.name,
    priority: s.kind === 'pershing' ? i : s.kind === 'air' ? 20 + i : s.kind === 'glcm' ? 40 : 60 + i,
    position: [s.lon, s.lat] as LngLat,
    maxWeapons: s.kind === 'air' || s.kind === 'pershing' ? 3 : s.kind === 'glcm' ? 1 : 2,
  }))
}

function natoLaunchers(struck: (position: LngLat, before: number) => boolean): Launcher[] {
  const out: Launcher[] = []
  for (const s of SITES.filter((x) => x.side === 'nato')) {
    const position: LngLat = [s.lon, s.lat]
    if (s.kind === 'air') {
      const speed = s.aircraft?.startsWith('F-111') ? F111_MS : STRIKE_MS
      const range = s.aircraft?.startsWith('F-111') ? 2_000_000 : 1_000_000
      const qraLost = struck(position, QRA_LAUNCH)
      const generatedLost = struck(position, GENERATED_LAUNCH)
      out.push({ id: `${s.id}-qra`, name: `${s.name} (QRA)`, kind: 'bomber', position, weapons: qraLost ? 0 : (s.qraWeapons ?? 0), weaponsPerVehicle: 1, rangeMetres: range, yieldKt: s.yieldKt ?? 170, reactionSeconds: QRA_LAUNCH, speedMs: speed })
      out.push({ id: `${s.id}-gen`, name: `${s.name} (generated)`, kind: 'bomber', position, weapons: generatedLost ? 0 : (s.generatedWeapons ?? 0) - (s.qraWeapons ?? 0), weaponsPerVehicle: 2, rangeMetres: range, yieldKt: s.yieldKt ?? 170, reactionSeconds: GENERATED_LAUNCH, speedMs: speed })
    } else if (s.kind === 'pershing') {
      const lost = struck(position, PERSHING_LAUNCH)
      out.push({ id: s.id, name: s.name, kind: 'irbm', position, weapons: lost ? 0 : (s.weapons ?? 0), weaponsPerVehicle: 1, rangeMetres: (s.rangeKm ?? 740) * 1_000, yieldKt: s.yieldKt ?? 400, reactionSeconds: PERSHING_LAUNCH })
    }
  }
  return out
}

function wpTargets(): Target[] {
  return SITES.filter((s) => s.side === 'wp').map((s, i) => ({
    id: `t-${s.id}`,
    name: s.name,
    priority: s.kind === 'ss20' ? i : s.kind === 'missile' ? 10 + i : s.kind === 'air' ? 20 + i : 60 + i,
    position: [s.lon, s.lat] as LngLat,
    maxWeapons: s.kind === 'ss20' ? 4 : s.kind === 'air' ? 3 : 2,
  }))
}

const category = (t: Target) => {
  const s = SITES.find((x) => `t-${x.id}` === t.id)
  if (!s) return 'TARGET'
  return s.kind === 'air' ? 'NUCLEAR-CAPABLE AIRFIELD' : s.kind === 'pershing' ? 'PERSHING GARRISON' : s.kind === 'glcm' ? 'CRUISE-MISSILE BASE, ARRIVING' : s.kind === 'missile' ? 'MISSILE BRIGADE' : s.kind === 'ss20' ? 'SS-20 GARRISON' : 'HEADQUARTERS OR PORT'
}

function strikes(): { wp: StrikeResult; nato: StrikeResult } {
  const wp = enactStrike({
    prefix: 'wp',
    side: 'defender',
    launchers: sovietLaunchers(),
    targets: natoTargets(),
    allocation: { maxWeaponsPerTarget: 3, order: ['irbm', 'bomber'] },
    attrition: { reliability: { icbm: 0.8, irbm: 0.8, slbm: 0.8, bomber: 0.85 }, penetration: 0.7, note: 'Missiles 0.8; aircraft 0.85 working and 0.7 through NATO air defence; all inferred' },
    allocationRule: { source: 'Rule', method: 'NATO\'s nuclear delivery means first: the Pershing garrisons, then the quick-reaction-alert airfields, the arriving cruise missiles, then headquarters and reinforcement ports; nearest launcher in range, missiles before aircraft. The Soviet General Staff\'s theatre plan of 1983 is not in the record; the 1979 Seven Days plan is the nearest published analogue' },
    vehicle: { evidence: 'inferred', provenance: { source: 'CIA NID of 10 November 1983; NSA message of 2 December 1983; Perroots 1989 (NSA EBB 2021-02-17)', method: 'The alert is documented; the order to strike is the counterfactual' } },
    route: { cruise: { source: 'Great circle at strike speed' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: category,
    targetFacts: (t) => [{ label: 'Why this target', value: `${category(t).toLowerCase()}; NATO's own exercise had just rehearsed release from here`, evidence: 'inferred', provenance: { source: 'Rule' } }],
  })
  const landed = Object.entries(wp.firstArrival).map(([id, fa]) => ({ position: natoTargets().find((t) => t.id === id)!.position, time: fa.time }))
  const struck = (position: LngLat, before: number) => landed.some((l) => l.time < before && haversineMetres(l.position, position) < STRUCK_WITHIN_M)
  const nato = enactStrike({
    prefix: 'nato',
    side: 'attacker',
    launchers: natoLaunchers(struck),
    targets: wpTargets(),
    allocation: { maxWeaponsPerTarget: 3, order: ['irbm', 'bomber'] },
    attrition: { reliability: { icbm: 0.85, irbm: 0.85, slbm: 0.85, bomber: 0.85 }, penetration: 0.6, note: 'Pershing 0.85; aircraft 0.85 working and 0.6 through the Warsaw Pact\'s air defence; all inferred' },
    allocationRule: { source: 'Rule', method: 'The SS-20 garrisons first, then the missile brigades, the forward airfields and the headquarters; Pershing 1a within 740 km, aircraft within their radius; from the bases that were not struck before they could launch' },
    vehicle: { evidence: 'inferred', provenance: { source: 'The release procedures the exercise had just rehearsed (NSA EBB 427)', method: 'Launch on warning: the fifteen-minute alert forces leave at H+20, generated aircraft at four hours; a base struck within 15 km before then loses its aircraft, which is the race the first twenty minutes decide' } },
    route: { cruise: { source: 'Great circle at strike speed' }, ballistic: { source: 'Minimum-energy trajectory' } },
    targetCategory: category,
    targetFacts: (t) => [{ label: 'Why this target', value: `${category(t).toLowerCase()}; the exercise's first use was against fixed targets in Orange satellite countries`, evidence: 'inferred', provenance: { source: 'SHAPE exercise report, NSA EBB 427' } }],
  })
  return { wp, nato }
}

function study(): Study {
  const { wp, nato } = strikes()
  const entities: Entity[] = [...SITES.map(siteEntity), ...wp.entities, ...nato.entities]
  const events: StudyEvent[] = EX.steps.map((st) => ({ time: st.hours * HOUR, text: `${st.text} (${st.evidence.toUpperCase()})`, camera: st.camera ? { center: st.camera.center, zoom: st.camera.zoom, durationMs: st.camera.durationMs ?? 5_000 } : undefined }))
  // The airlift: a dozen of the 172 radio-silent missions from the east-coast ports of embarkation to Rhein-Main.
  const airliftStart = (EX.steps.find((s) => s.action === 'airlift')?.hours ?? -100) * HOUR
  const dest = site(EX.airlift.to)
  for (let i = 0; i < EX.airlift.drawn; i += 1) {
    const from = EX.airlift.from[i % EX.airlift.from.length]
    entities.push({
      kind: 'track',
      id: `airlift-${i}`,
      name: `Reforger 83 airlift · mission ${i + 1} of ${EX.airlift.flights}`,
      designation: 'C-141 · RADIO SILENT · 19,000 SOLDIERS IN 172 MISSIONS',
      label: i === 0,
      side: 'attacker',
      track: new Track(timeByGroundSpeed([from, [dest.lon, dest.lat]], airliftStart + i * 0.6 * HOUR, (EX.airlift.speedKmh * 1_000) / 3_600)),
      reveal: 'progressive',
      evidence: 'documented',
      provenance: { source: 'Military Airlift Command report on Reforger 83 (NSA EBB 427)', method: EX.airlift.note },
      route: { evidence: 'reconstructed', provenance: { source: 'Great circle from the ports of embarkation' } },
      facts: [],
    })
  }
  events.push(
    { time: SS20_LAUNCH, text: `SS-20 REGIMENTS FIRE FROM BELARUS AND UKRAINE · SCUD BRIGADES AT FIFTEEN MINUTES · FRONTAL AVIATION AT THIRTY · ${wp.summary.weapons} WEAPONS ON ${wp.summary.targetsCovered} TARGETS (COUNTERFACTUAL; THE ALERT IS DOCUMENTED)` },
    { time: wp.summary.firstDetonation, text: 'FIRST DETONATION ON NATO TERRITORY' },
    { time: PERSHING_LAUNCH, text: `LAUNCH ON WARNING: PERSHING 1a AND THE QUICK-REACTION AIRCRAFT OF THE BASES NOT YET STRUCK ANSWER · ${nato.summary.weapons} WEAPONS ON ${nato.summary.targetsCovered} TARGETS · ${nato.summary.unassigned} HELD BACK (INFERRED)` },
    { time: nato.summary.firstDetonation, text: 'FIRST DETONATION ON WARSAW PACT TERRITORY' },
    { time: GENERATED_LAUNCH, text: 'GENERATED AIRCRAFT LEAVE THE BASES THAT STILL HAVE THEM (RECONSTRUCTED)' },
    { time: Math.max(wp.summary.lastDetonation, nato.summary.lastDetonation), text: 'LAST DETONATION · OUTCOME CALCULATION COMPLETE WHEN THE SUM FINISHES' },
    { time: 25 * HOUR, text: 'WHAT THE STATE DEPARTMENT REMOVED FROM ITS OWN HISTORY OF THESE DAYS IS RECORDED AS REMOVED (WITHHELD)' },
  )
  events.sort((a, b) => a.time - b.time)
  const end = (Math.ceil(Math.max(wp.summary.lastDetonation, nato.summary.lastDetonation, 25 * HOUR) / HOUR) + 1) * HOUR
  return {
    id: 'able-archer-83',
    title: 'ABLE ARCHER//83',
    subtitle: `The war scare gone hot · the exercise week as documented, the Soviet alert as reported, and on the last morning the order the record avoided · ${wp.summary.weapons} Warsaw Pact and ${nato.summary.weapons} NATO weapons · every target inferred`,
    bounds: { start: -180 * HOUR, end },
    startTime: -175 * HOUR,
    view: { center: [9, 51], zoom: 4.2 },
    populationGrid: 'ghsl/popc_1985',
    exposureWorkers: 3,
    outcomeReference: { label: 'Carte Blanche, 1955, West German dead', value: 1_700_000, source: `${CARTE_BLANCHE.source}: ${CARTE_BLANCHE.locator}` },
    sides: {
      attacker: { name: 'NATO · dead on Warsaw Pact territory' },
      defender: { name: 'Warsaw Pact · dead on NATO territory', reference: { label: 'Carte Blanche, 1955', value: 1_700_000, source: CARTE_BLANCHE.source } },
    },
    omissions: [
      'No order to strike was given in November 1983. The exercise, the airlift, the headquarters move and the Soviet alert are documented; the strike and the answer are the counterfactual',
      EX.zeroNote,
      'The Soviet regiment-level picture is reconstructed from the divisions the unit histories name; which regiments the intelligence record saw readying is in the still-redacted material',
      'NATO\'s quick-reaction alert at six aircraft a base with one weapon, and two per aircraft when generated, are rules, not the numbers, which are classified',
      'The Pershing II battery and the first cruise missiles landed after the exercise; the Pershing 1a force and an empty Greenham Common are drawn',
      'The SS-12 brigades that came to East Germany in 1984 as the answer to Pershing II are not yet there; the Scud brigades and the SS-20s are',
      'Soviet ICBM silos, the SIOP\'s successor and anything beyond the theatre are not drawn; the brief stops at the theatre exchange',
      'Air defence on both sides is a penetration number; SA-2 sites, Hawk belts, interceptors and the war\'s conventional week are not modelled',
      'Fallout is not drawn: the weapons are air bursts by the study\'s assumption, and the plume lab under November winds is the next step',
      'Carte Blanche of 1955 is the nearest documented figure for a theatre nuclear war in Germany, and it is a different war',
      `Sources: ${EX.sources.join('; ')}`,
    ],
    events,
    entities,
  }
}

let built: Study | null = null

export function ableArcher(): Study {
  built ??= study()
  return built
}

export function ableArcherSummary(): { wp: StrikeResult['summary']; nato: StrikeResult['summary'] } {
  const { wp, nato } = strikes()
  return { wp: wp.summary, nato: nato.summary }
}
