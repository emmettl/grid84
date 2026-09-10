import type { EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import type { LngLat } from '../../geo/geodesy.ts'
import type { Launcher, Target } from '../../models/allocation.ts'
import { enactStrike, launcherSite } from '../strike.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import file from '../../../data/tornado/raf-germany-1985.json'

/**
 * RAF Germany, 1985. The Tornado inherited the V-force's answer to air
 * defence and was built for it from the start: two hundred feet on
 * terrain-following radar, under the radar horizon of a defence belt
 * denser than anything the Vulcans had faced. The weapon is the WE.177,
 * which after 1991 was called Britain's sub-strategic deterrent, a phrase
 * meaning a nuclear weapon delivered by an aircraft that must fly into the
 * target to release it.
 *
 * The finding is the attrition. The strike is worth drawing not because
 * of what it destroys but because of how much of the force does not come
 * back, and because the same aircraft would have had to do it again.
 */

interface Base {
  id: string
  name: string
  lon: number
  lat: number
  squadrons: string
  aircraft: number
}

const F = file as unknown as {
  year: number
  source: string
  weapon: string
  yieldKt: number
  profile: { cruiseAltitudeMetres: number; runInMetres: number; descendAtMetres: number; speedMs: number; note: string }
  attrition: { reliability: number; penetration: number; note: string }
  rule: string
  bases: Base[]
  targets: Array<{ id: string; name: string; lon: number; lat: number; kind: 'airfield' | 'crossing' }>
}

const SOURCE: Provenance = { source: F.source, method: F.rule }
const MIN = 60

function launchers(): Launcher[] {
  return F.bases.map((b) => ({
    id: b.id,
    name: `${b.name} (Tornado GR1)`,
    kind: 'bomber' as const,
    position: [b.lon, b.lat] as LngLat,
    // Two aircraft to each target, drawn from the station's strength.
    weapons: Math.min(b.aircraft, F.targets.length),
    weaponsPerVehicle: 1,
    rangeMetres: 1_400_000,
    yieldKt: F.yieldKt,
    reactionSeconds: 15 * MIN,
    speedMs: F.profile.speedMs,
    cruiseAltitudeMetres: F.profile.cruiseAltitudeMetres,
    weaponAltitudeMetres: F.profile.runInMetres,
    descendAtMetres: F.profile.descendAtMetres,
  }))
}

export function tornadoArithmetic() {
  const strike = enact()
  return {
    aircraft: F.bases.reduce((a, b) => a + b.aircraft, 0),
    targets: F.targets.length,
    sorties: strike.summary.vehicles,
    delivered: strike.summary.delivered,
    lost: strike.summary.weapons - strike.summary.delivered,
    lossFraction: strike.summary.weapons > 0 ? 1 - strike.summary.delivered / strike.summary.weapons : 0,
    yieldKt: F.yieldKt,
  }
}

function enact() {
  const targets: Target[] = F.targets.map((t, i) => ({ id: t.id, name: t.name, priority: i, position: [t.lon, t.lat] as LngLat, maxWeapons: 2 }))
  return enactStrike({
    prefix: 'tor',
    side: 'attacker',
    launchers: launchers(),
    targets,
    allocation: { maxWeaponsPerTarget: 2, order: ['bomber'] },
    attrition: { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: F.attrition.reliability }, penetration: F.attrition.penetration, note: F.attrition.note },
    allocationRule: SOURCE,
    vehicle: { evidence: 'reconstructed', provenance: { source: F.source, method: F.weapon } },
    route: { cruise: { source: 'Great circles at the profile\'s altitude', method: F.profile.note }, ballistic: { source: 'Not used' } },
    targetCategory: (t) => (F.targets.find((x) => x.id === t.id)?.kind === 'crossing' ? 'CROSSING' : 'AIRFIELD'),
    burstFor: () => ({ burst: 'air' as const }),
    targetFacts: (t) => {
      const k = F.targets.find((x) => x.id === t.id)?.kind
      return [
        { label: 'Why this target', value: k === 'crossing' ? 'A river crossing on the axis the second echelon has to use. Interdiction: the target is not the army but the road it needs' : 'A Warsaw Pact operating airfield in the rear', evidence: 'inferred' as EvidenceTier, provenance: SOURCE },
        { label: 'Whose target', value: 'Not on a released list. RAF Germany\'s strike plans are not published; this is a target any interdiction plan had to include', evidence: 'withheld' as EvidenceTier, provenance: SOURCE },
      ]
    },
    mirv: { bomberLegMetres: 200_000 },
  })
}

export function tornadoStrike(): Study {
  const strike = enact()
  const a = tornadoArithmetic()
  const entities: Entity[] = [
    ...F.bases.map((b, i) =>
      launcherSite(launchers()[i], {
        side: 'attacker',
        designation: `TORNADO GR1 · ${b.aircraft} AIRCRAFT · WE.177`,
        evidence: 'documented',
        provenance: { source: F.source },
        positionEvidence: 'documented',
        label: true,
        facts: [
          { label: 'Squadrons', value: b.squadrons, evidence: 'documented' as EvidenceTier, provenance: { source: F.source } },
          { label: 'The weapon', value: F.weapon, evidence: 'reconstructed' as EvidenceTier, provenance: { source: F.source } },
          { label: 'The profile', value: F.profile.note, evidence: 'reconstructed' as EvidenceTier, provenance: { source: F.source } },
        ],
      }),
    ),
    ...strike.entities,
  ]
  const arrivals = Object.values(strike.firstArrival).map((f) => f.time)
  const first = Math.min(...arrivals)
  const last = Math.max(...arrivals)
  const events: StudyEvent[] = [
    { time: -15 * MIN, text: `RAF GERMANY AT READINESS · ${a.aircraft} TORNADO GR1 ON TWO STATIONS · WE.177 AT ${a.yieldKt} KT`, camera: { center: [10, 52], zoom: 5.4, durationMs: 2_500 } },
    { time: 0, text: `THE PACKAGE GOES · ${a.sorties} AIRCRAFT AGAINST ${a.targets} AIRFIELDS AND CROSSINGS` },
    { time: Math.round(first * 0.55), text: 'DOWN TO TWO HUNDRED FEET · TERRAIN-FOLLOWING RADAR · THE V-FORCE PROFILE OF 1963, FLOWN BY AN AIRCRAFT BUILT FOR IT' },
    { time: first, text: 'FIRST WEAPONS DOWN' },
    { time: last, text: `${a.delivered} OF ${a.delivered + a.lost} WEAPONS ARRIVE · ${Math.round(a.lossFraction * 100)}% OF THE FORCE DOES NOT` },
    { time: last + 20 * MIN, text: 'THE SURVIVORS TURN FOR STATIONS THAT HAVE THEMSELVES BEEN STRUCK, TO BE TURNED ROUND AND SENT AGAIN. THIS IS WHAT SUB-STRATEGIC MEANT' },
  ]
  return {
    id: 'tornado-1985',
    title: 'RAF GERMANY · THE SUB-STRATEGIC STRIKE',
    subtitle: `Tornado GR1 with the WE.177, 1985 · ${a.sorties} sorties against ${a.targets} airfields and crossings · about ${Math.round(a.lossFraction * 100)}% do not arrive · the strike plans are not published`,
    bounds: { start: -20 * MIN, end: last + 40 * MIN },
    startTime: -20 * MIN,
    view: { center: [10.5, 52], zoom: 5.4 },
    entities,
    events,
    omissions: [
      'RAF Germany\'s strike plans and target lists are not published. These are the airfields and crossings any interdiction plan had to include, chosen from the map and marked inferred',
      `Yield: ${F.weapon}`,
      `Attrition: ${F.attrition.note}`,
      'No air defences as entities, no route planning around them, no electronic warfare and no escort: the aircraft fly great circles, which is the one thing the crews would not have done',
      'No second sortie. The force that survives would have been turned round and sent again, and the study stops at the first',
      'The conventional war around this is not drawn',
    ],
    populationGrid: 'popc_1983',
    exposureWorkers: 2,
    sides: { attacker: { name: 'RAF Germany' }, defender: { name: 'The Warsaw Pact' } },
    links: [
      { label: 'The V-force: the same answer, twenty years earlier', href: '#/study/v-force/low' },
      { label: 'Seven days to the River Rhine: what this is meant to stop', href: '#/study/seven-days' },
      { label: 'The demolition belt: the other way to close a crossing', href: '#/study/demolition-belt' },
      { label: 'The chronicle: posture and doctrine since 1945', href: '#/chronicle' },
    ],
  }
}
