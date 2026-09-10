import type { EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import { haversineMetres, type LngLat } from '../../geo/geodesy.ts'
import type { Launcher, Target } from '../../models/allocation.ts'
import { enactStrike } from '../strike.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import forceFile from '../../../data/britain/v-force-1964.json'
import targetsFile from '../../../data/siop62/targets-1956-priority.json'

/**
 * The V-force, and the two profiles it flew. Britain's medium bomber force
 * was built to cross the Soviet Union at fifty thousand feet, and an SA-2
 * over Sverdlovsk on 1 May 1960 ended the argument for it; from 1963 the
 * same aircraft flew the same routes at three hundred. Both are drawn here
 * from the same force against the same targets, so the cost of the change
 * can be read off: the fuel, the reach of Blue Steel, the warning the
 * defence gets.
 *
 * The targets are not Britain's. No British target list has been released;
 * the retaliation plan's contents are withheld. What is on the record is
 * that Bomber Command's targets were co-ordinated with the American plan
 * from 1958, and that HMG's stated criterion, from the 1950s through the
 * Trident papers of 1980, was the ability to threaten what those papers
 * called key aspects of Soviet state power: the seat of government and the
 * cities and industry that make a state a state. So the targets here are
 * the highest-priority Soviet complexes of the American study of 1956,
 * which are documented, filtered to those a V-bomber could reach, and the
 * assignment of British aircraft to them is inferred and says so.
 */

interface Base {
  id: string
  name: string
  lon: number
  lat: number
  aircraft: string
  squadrons: string
  strength: number
  weapon: string
  weaponsPerAircraft: number
  note: string
  evidence: string
  positionEvidence: string
  source: string
}

interface ProfileSpec {
  name: string
  year: number
  cruiseAltitudeMetres: number
  descendAtMetres: number | null
  blueSteelRangeMetres: number
  speedMs: number
  note: string
}

const FORCE = forceFile as unknown as {
  year: number
  note: string
  source: string
  strength: number
  dispersal: { airfields: number; perAirfield: number; note: string }
  profiles: Record<string, ProfileSpec>
  bases: Base[]
}

const TARGETS = targetsFile as unknown as {
  source: string
  targets: Array<{ complex: string; priority: number; name: string; lat: number; lon: number; categories: number[]; categoryNames?: string[]; population?: boolean; confidence: string }>
}

export type VProfile = 'high' | 'low'

const WYNN: Provenance = { source: FORCE.source }
const SAC_LIST: Provenance = {
  source: TARGETS.source,
  method: 'Bomber Command\'s targets were co-ordinated with the American plan from 1958; the British list itself has never been released, so the American study\'s highest-priority complexes within reach stand for it and the assignment is inferred',
}

/** The yield the free-fall and stand-off megaton weapons carried, kilotons. */
const YIELD_KT = 1_100
/** Blue Steel and Yellow Sun were both about a megaton; the Red Beard kiloton weapon is not drawn. */
const YIELD_NOTE = 'Yellow Sun Mk 2 and the Blue Steel warhead both carried the Red Snow physics package, about a megaton; the figure is the open literature\'s and is inferred'

/**
 * The radius a V-bomber could reach and return from, or reach at all on a
 * one-way sortie. Wynn gives the Vulcan B.2 a range of about 4,000 nautical
 * miles; a radius of action of 3,000 km from Lincolnshire is taken here, and
 * the readout says the crews knew the difference between a radius and a range.
 */
const RADIUS_METRES = 3_000_000

const HOME: LngLat = [-0.55, 53.2]

export interface VTarget extends Target {
  categories: string[]
  priority: number
}

/** The documented complexes a V-bomber could reach, in the American study's priority order. */
export function reachableTargets(limit = 60): VTarget[] {
  return TARGETS.targets
    .filter((t) => haversineMetres(HOME, [t.lon, t.lat]) <= RADIUS_METRES)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit)
    .map((t, i) => ({
      id: `v-${t.complex}`,
      name: t.name.toLowerCase().replace(/(^|[\s-])(\w)/g, (_, a, c) => a + c.toUpperCase()),
      priority: i,
      position: [t.lon, t.lat] as LngLat,
      maxWeapons: t.priority <= 3 ? 3 : 2,
      categories: t.categoryNames ?? [],
    }))
}

function launchers(profile: ProfileSpec): Launcher[] {
  return FORCE.bases.map((b) => {
    const blueSteel = b.weapon === 'Blue Steel'
    return {
      id: b.id,
      name: `${b.name} (${b.aircraft})`,
      kind: 'bomber' as const,
      position: [b.lon, b.lat] as LngLat,
      weapons: b.strength * b.weaponsPerAircraft,
      weaponsPerVehicle: b.weaponsPerAircraft,
      rangeMetres: RADIUS_METRES,
      yieldKt: YIELD_KT,
      // Quick reaction alert held the force at fifteen minutes; the scramble is the first four.
      reactionSeconds: 4 * 60,
      speedMs: profile.speedMs,
      cruiseAltitudeMetres: profile.cruiseAltitudeMetres,
      // The run-in height: on the high profile the aircraft is over the target at altitude, on the low one at three hundred feet.
      // A free-fall weapon leaves the aircraft there; Blue Steel leaves it earlier and flies the rest itself.
      weaponAltitudeMetres: profile.descendAtMetres === null ? (blueSteel ? 12_000 : profile.cruiseAltitudeMetres) : 90,
      ...(profile.descendAtMetres !== null ? { descendAtMetres: profile.descendAtMetres } : {}),
      ...(blueSteel ? { standoffMetres: profile.blueSteelRangeMetres, missileSpeedMs: profile.descendAtMetres === null ? 900 : 500 } : {}),
    }
  })
}

export function vForceArithmetic(profile: VProfile) {
  const p = FORCE.profiles[profile]
  const targets = reachableTargets()
  const blueSteelAircraft = FORCE.bases.filter((b) => b.weapon === 'Blue Steel').reduce((a, b) => a + b.strength, 0)
  return {
    strength: FORCE.strength,
    bases: FORCE.bases.length,
    blueSteelAircraft,
    dispersed: FORCE.dispersal.airfields * FORCE.dispersal.perAirfield,
    targets: targets.length,
    cruiseFeet: Math.round((p.cruiseAltitudeMetres * 3.28084) / 1_000) * 1_000,
    runInFeet: p.descendAtMetres === null ? null : 300,
    blueSteelMiles: Math.round(p.blueSteelRangeMetres / 1_852),
    farthest: Math.round(Math.max(...targets.map((t) => haversineMetres(HOME, t.position))) / 1_000),
  }
}

const variants = (current: VProfile) => ({
  label: 'Profile',
  current,
  items: [
    { id: 'high', label: 'High level, 1962', href: '#/study/v-force' },
    { id: 'low', label: 'Low level, 1964', href: '#/study/v-force/low' },
  ],
})

export function vForce(profile: VProfile = 'high'): Study {
  const spec = FORCE.profiles[profile]
  const targets = reachableTargets()
  const a = vForceArithmetic(profile)
  const strike = enactStrike({
    prefix: 'v',
    side: 'attacker',
    launchers: launchers(spec),
    targets,
    allocation: { maxWeaponsPerTarget: 2, order: ['bomber'] },
    // Bomber Command's own planning assumed heavy losses to the defences; the figures are not published, and a half is taken.
    attrition: { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: 0.9 }, penetration: profile === 'high' ? 0.35 : 0.6, note: `Nine aircraft in ten serviceable and away, then ${profile === 'high' ? 'a third' : 'three fifths'} through the defences: the high profile flies into the missile belts the U-2 met, the low one under them. Bomber Command's own estimates of its losses are not published and these are inferred` },
    allocationRule: { ...SAC_LIST, method: `${SAC_LIST.method}. Two weapons on each complex, three on the first four` },
    vehicle: { evidence: 'reconstructed', provenance: { ...WYNN, method: FORCE.note } },
    route: {
      cruise: { source: 'Great circles from the bases, at the profile\'s altitude', method: spec.note },
      ballistic: { source: 'Not used' },
    },
    targetCategory: () => 'URBAN-INDUSTRIAL',
    burstFor: () => ({ burst: 'air' as const }),
    targetFacts: (t) => {
      const v = t as VTarget
      return [
        { label: 'Why this target', value: v.categories.length > 0 ? `A complex of the American study of 1956: ${v.categories.slice(0, 4).join(', ').toLowerCase()}` : 'A complex of the American study of 1956', evidence: 'documented' as EvidenceTier, provenance: SAC_LIST },
        { label: 'Whose target', value: 'Not on a released British list. Bomber Command\'s targets were co-ordinated with the American plan from 1958 and its own list is withheld; this complex stands in the category HMG\'s statements describe', evidence: 'withheld' as EvidenceTier, provenance: { source: 'The Future United Kingdom Strategic Nuclear Deterrent Force, Defence Open Government Document 80/23 (1980), on the ability to threaten key aspects of Soviet state power; the 1958 co-ordination is described in Wynn' } },
      ]
    },
    mirv: { bomberLegMetres: 400_000 },
  })
  const entities: Entity[] = [
    ...FORCE.bases.map((b): Entity => ({
      kind: 'site',
      id: `base-${b.id}`,
      name: b.name,
      designation: `${b.aircraft.toUpperCase()} · ${b.strength} AIRCRAFT · ${b.weapon.toUpperCase()}`,
      label: true,
      position: [b.lon, b.lat],
      evidence: b.evidence as EvidenceTier,
      provenance: { ...WYNN, method: b.note || undefined },
      facts: [
        { label: 'Squadrons', value: b.squadrons, evidence: 'reconstructed' as EvidenceTier, provenance: WYNN },
        { label: 'On alert', value: `Quick reaction alert from 1962: aircraft at fifteen minutes, later at cockpit readiness, with the four-minute warning as the public face of the same clock`, evidence: 'documented' as EvidenceTier, provenance: WYNN },
        { label: 'Dispersal', value: FORCE.dispersal.note, evidence: 'documented' as EvidenceTier, provenance: WYNN },
      ],
    })),
    ...strike.entities,
  ]
  const first = Math.min(...Object.values(strike.firstArrival).map((f) => f.time))
  const last = Math.max(...Object.values(strike.firstArrival).map((f) => f.time))
  const events: StudyEvent[] = [
    { time: -15 * 60, text: `QUICK REACTION ALERT · ${a.strength} AIRCRAFT ON ${a.bases} STATIONS · ON WARNING THEY DISPERSE IN FOURS TO ${FORCE.dispersal.airfields} AIRFIELDS`, entityId: `base-${FORCE.bases[0].id}` },
    { time: -4 * 60, text: 'THE FOUR-MINUTE WARNING · SCRAMBLE', entityId: `base-${FORCE.bases[0].id}` },
    { time: 0, text: `AIRBORNE · ${profile === 'high' ? `CLIMBING TO ${a.cruiseFeet.toLocaleString('en-GB')} FEET` : `TRANSIT AT ${a.cruiseFeet.toLocaleString('en-GB')} FEET, THEN DOWN TO THREE HUNDRED FOR THE RUN IN`}`, camera: { center: [15, 55], zoom: 4.5, fit: [...FORCE.bases.map((b) => [b.lon, b.lat] as LngLat), ...targets.slice(0, 12).map((t) => t.position)], durationMs: 2_500 } },
    { time: Math.round(first * 0.55), text: profile === 'high' ? 'INTO THE MISSILE BELTS · THIS IS THE HEIGHT AT WHICH POWERS WAS SHOT DOWN ON 1 MAY 1960' : 'DESCENT · THREE HUNDRED FEET, UNDER THE RADAR HORIZON, ON TERRAIN THE CREWS HAD NEVER SEEN', entityId: `base-${FORCE.bases[0].id}` },
    { time: Math.round(first * 0.9), text: `BLUE STEEL AWAY · ${a.blueSteelMiles} NAUTICAL MILES · ${a.blueSteelAircraft} AIRCRAFT CARRY IT${profile === 'low' ? ' · AT LOW LEVEL THE MISSILE HAS LOST MOST OF ITS REACH' : ''}` },
    { time: first, text: 'FIRST WEAPONS DOWN' },
    { time: last, text: `LAST OF ${strike.summary.delivered} WEAPONS DOWN · ${strike.summary.weapons - strike.summary.delivered} DID NOT ARRIVE` },
  ]
  return {
    id: `v-force-${profile}`,
    title: profile === 'high' ? 'THE V-FORCE · HIGH LEVEL, AS BUILT' : 'THE V-FORCE · LOW LEVEL, AS FLOWN',
    subtitle: `${a.strength} aircraft on ${a.bases} stations · ${spec.name.toLowerCase()}, ${spec.year} · ${a.targets} documented complexes within ${Math.round(RADIUS_METRES / 1_000).toLocaleString('en-GB')} km · the British target list is withheld`,
    bounds: { start: -15 * 60, end: last + 30 * 60 },
    startTime: -15 * 60,
    view: { center: [22, 55], zoom: 3 },
    entities,
    events,
    omissions: [
      'The British target list has never been released. These complexes are the American study of 1956, which is documented, filtered to what a V-bomber could reach; the assignment of British aircraft to them is inferred from the 1958 co-ordination and HMG\'s stated criterion, and no claim is made that any of them was on a British list',
      `Yields: ${YIELD_NOTE}. The kiloton weapons, Red Beard and the tactical stores, are not drawn`,
      'Losses to the defences are inferred. Bomber Command\'s own estimates are not published, and the difference between the two profiles here is a stated assumption, not a measured one',
      'No refuelling, no dispersal flying, no route planning around the defences: the aircraft fly great circles from their main bases, which is the one thing the crews certainly did not do',
      'The Soviet air defence is not modelled as an entity; it appears only as the penetration fraction',
      'Polaris, which took the deterrent from the RAF on 30 June 1969, is not drawn',
    ],
    populationGrid: 'popc_1962',
    exposureWorkers: 2,
    sides: { attacker: { name: 'RAF Bomber Command' }, defender: { name: 'The Soviet Union' } },
    links: [
      { label: 'SIOP//62: the American plan the British one was co-ordinated with', href: '#/study/siop62' },
      { label: 'The accuracy lab: what a megaton forgives', href: '#/lab/accuracy' },
      { label: 'The chronicle: posture and doctrine since 1945', href: '#/chronicle' },
      { label: 'Sources and attribution', href: '#/sources' },
    ],
    variants: variants(profile),
  }
}
