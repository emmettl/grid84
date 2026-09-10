import type { EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import type { LngLat } from '../../geo/geodesy.ts'
import { BLAST_MODEL, promptEffects } from '../../models/blast.ts'
import type { Entity, FalloutAssumption, Study, StudyEvent } from '../study.ts'
import beltFile from '../../../data/demolition/belt-1980.json'

/**
 * The demolition belt. Atomic demolition munitions were nuclear weapons
 * emplaced by engineers on the defender's own ground, to crater a defile
 * or drop a river crossing ahead of an armoured advance. They are the
 * strangest object in the whole doctrine: a weapon that has to be carried
 * to its target by the people it is defending, buried before the war
 * begins, and fired by a political release that arrives, if it arrives,
 * while the ground above it is being fought over.
 *
 * They are also the clearest case of the thing the theatre chapter is
 * about. Every one of these fires on NATO territory, at the surface,
 * which is the burst that makes fallout; and the prevailing wind over
 * Germany carries it north-east, over the country the belt defends.
 */

interface Site {
  id: string
  name: string
  lon: number
  lat: number
  system: 'SADM' | 'MADM'
  yieldKt: number
  purpose: string
}

const B = beltFile as unknown as {
  year: number
  source: string
  bluePeacock: string
  note: string
  rule: string
  wind: { fromDeg: number; mph: number; note: string }
  sites: Site[]
}

const SOURCE: Provenance = { source: B.source, method: B.rule }
const MIN = 60

/** The advance runs east to west, so the belt fires from the inner German border outward. */
function firingOrder(): Site[] {
  return [...B.sites].sort((a, b) => b.lon - a.lon)
}

const WIND: FalloutAssumption = {
  fissionFraction: 1,
  windMph: B.wind.mph,
  downwindBearingDeg: (B.wind.fromDeg + 180) % 360,
  untilHours: 48,
  shearDeg: 25,
  terrainFactor: 0.7,
  provenance: { source: B.wind.note, method: 'A pure fission weapon at this size, so the fission fraction is one; the surface burst is what the weapon is for, since it must throw the ground' },
}

export function beltArithmetic() {
  const sites = B.sites
  return {
    emplacements: sites.length,
    totalKt: sites.reduce((a, s) => a + s.yieldKt, 0),
    madm: sites.filter((s) => s.system === 'MADM').length,
    sadm: sites.filter((s) => s.system === 'SADM').length,
    countries: new Set(sites.map((s) => (s.lon > 13 && s.lat < 47 ? 'IT' : s.lat < 46.5 ? 'SI' : 'DE'))).size,
  }
}

export function demolitionBelt(): Study {
  const order = firingOrder()
  const a = beltArithmetic()
  // Emplacement happens before the war; the belt fires as the advance reaches each defile.
  const emplacedAt = -6 * 60 * MIN
  const entities: Entity[] = []
  order.forEach((s, i) => {
    const at = Math.round(i * 12 * MIN)
    const position: LngLat = [s.lon, s.lat]
    entities.push({
      kind: 'site',
      id: `emplace-${s.id}`,
      name: s.name,
      designation: `${s.system} · ${s.yieldKt < 1 ? `${s.yieldKt * 1_000} T` : `${s.yieldKt} KT`} · EMPLACED`,
      label: true,
      position,
      appearsAt: emplacedAt,
      vanishesAt: at,
      evidence: 'inferred',
      provenance: SOURCE,
      facts: [
        { label: 'What it destroys', value: s.purpose || 'A crossing or a defile on the axis of advance', evidence: 'inferred' as EvidenceTier, provenance: SOURCE },
        { label: 'Whose ground', value: 'NATO territory. The weapon is carried here by the defenders, buried before the war, and fired under the advance', evidence: 'documented' as EvidenceTier, provenance: { source: B.note } },
        { label: 'The emplacement', value: B.rule, evidence: 'withheld' as EvidenceTier, provenance: SOURCE },
      ],
    })
    entities.push({
      kind: 'effect',
      id: `fire-${s.id}`,
      name: s.name,
      designation: `${s.system} FIRED · ${s.yieldKt < 1 ? `${s.yieldKt * 1_000} T` : `${s.yieldKt} KT`} · SURFACE`,
      label: false,
      compact: true,
      side: 'defender',
      center: position,
      time: at,
      effects: promptEffects(s.yieldKt),
      burst: 'surface',
      fallout: WIND,
      evidence: 'modelled',
      provenance: { source: BLAST_MODEL },
      facts: [
        { label: 'Why a surface burst', value: 'The weapon exists to throw the ground: a crater, a dropped span, a blocked pass. A surface burst is the one that makes fallout, and this one is on the defender\'s own soil', evidence: 'documented' as EvidenceTier, provenance: SOURCE },
        { label: 'What it destroys', value: s.purpose || 'A crossing or a defile on the axis of advance', evidence: 'inferred' as EvidenceTier, provenance: SOURCE },
      ],
    })
  })

  const last = Math.round((order.length - 1) * 12 * MIN)
  const events: StudyEvent[] = [
    { time: emplacedAt, text: `THE BELT IS EMPLACED · ${a.emplacements} WEAPONS, ${a.totalKt} KT IN ALL · ${a.madm} MADM AND ${a.sadm} SADM · ALL OF THEM ON THE GROUND BEING DEFENDED`, camera: { center: [11, 50.5], zoom: 6.5, fit: B.sites.map((x) => [x.lon, x.lat] as LngLat), durationMs: 3_000 } },
    { time: -30 * MIN, text: 'THE ENGINEERS WHO LAY THEM ARE EXPECTED TO BE OVERRUN. THE RELEASE IS POLITICAL AND HAS TO ARRIVE WHILE THE GROUND ABOVE THE WEAPON IS BEING FOUGHT OVER' },
    { time: 0, text: 'THE ADVANCE REACHES THE FIRST DEFILE. THE BELT FIRES FROM EAST TO WEST' },
    { time: Math.round(last * 0.4), text: 'EVERY BURST IS A SURFACE BURST, BECAUSE THE WEAPON IS FOR THROWING THE GROUND' },
    { time: last, text: `THE LAST OF THE BELT · THE PLUMES RUN NORTH-EAST ON THE PREVAILING WIND, ACROSS THE COUNTRY THE BARRIER DEFENDS`, camera: { center: [11.5, 51.5], zoom: 6, fit: B.sites.map((x) => [x.lon, x.lat] as LngLat), durationMs: 3_000 } },
    { time: last + 12 * 3_600, text: 'TWELVE HOURS LATER. THE OBSTACLE IS THE FALLOUT, AND IT DOES NOT DISTINGUISH BETWEEN THE ARMY IT STOPS AND THE COUNTRY IT IS IN' },
  ]

  return {
    id: 'demolition-belt-1980',
    title: 'THE DEMOLITION BELT',
    subtitle: `Atomic demolition munitions on the ground being defended · ${a.emplacements} emplacements, ${a.totalKt} kt · the barrier plans are not published`,
    bounds: { start: emplacedAt, end: last + 48 * 3_600 },
    startTime: -40 * MIN,
    view: { center: [11, 50.5], zoom: 5 },
    entities,
    events,
    omissions: [
      'The emplacement sites are not published. These are the defiles an armoured advance has to use, chosen by hand from the map and marked inferred',
      'Yields are the systems\' nominal ones: a kiloton for the SADM and ten for the MADM, inside their published ranges of 0.01 to 1 and 1 to 15. Which weapon was at which site is not known',
      `Britain's own attempt is not drawn: ${B.bluePeacock}`,
      'No ground war. The advance that would trigger the belt is not modelled; the firing order is simply east to west',
      'Cratering, which is the weapon\'s actual purpose, is not modelled. The engine draws blast, fire and fallout, not the hole',
      `Wind: ${B.wind.note}`,
    ],
    populationGrid: 'popc_1983',
    defaultBurst: 'surface',
    surfaceBounds: { start: emplacedAt, end: last + 48 * 3_600 },
    exposureWorkers: 2,
    sides: { attacker: { name: 'The advance' }, defender: { name: 'NATO, on its own ground' } },
    links: [
      { label: 'Seven days to the River Rhine: the advance this belt is meant to stop', href: '#/study/seven-days' },
      { label: 'The neutron bomb: the other weapon for the same problem', href: '#/lab/neutron' },
      { label: 'Carte Blanche: the same ground, twenty-five years earlier', href: '#/study/carte-blanche' },
      { label: 'The fallout lab: the plume model and its assumptions', href: '#/lab/fallout' },
    ],
  }
}
