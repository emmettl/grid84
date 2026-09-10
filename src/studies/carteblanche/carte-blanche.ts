import type { EvidenceTier, Provenance } from '../../evidence/evidence.ts'
import type { LngLat } from '../../geo/geodesy.ts'
import { promptEffects } from '../../models/blast.ts'
import { BLAST_MODEL } from '../../models/blast.ts'
import type { Entity, Study, StudyEvent } from '../study.ts'
import exercise from '../../../data/carte-blanche/exercise-1955.json'
import urban from '../../../data/carte-blanche/de-urban-1951.json'

/**
 * Carte Blanche, 20 to 28 June 1955. NATO's air exercise simulated 335
 * nuclear weapons, most of them on German soil, and its own estimate of
 * the result was 1.7 million West German dead and 3.5 million injured
 * from the immediate effects alone. The figures leaked that autumn and
 * did more damage to massive retaliation in Germany than any argument.
 *
 * The desired ground zeros are not published, so the weapons fall by a
 * stated rule: two on each airfield of 1955, the rest on the most
 * populous cells of the 1951 grid. Nothing here is a route or a sortie;
 * the exercise is drawn as what it was, a distribution of detonations
 * over a country, and the readout sets the engine's figure against the
 * exercise's own.
 */

interface Airfield {
  id: string
  name: string
  lon: number
  lat: number
  side: 'nato' | 'pact'
}

const E = exercise as unknown as {
  year: number
  source: string
  documented: { weapons: number; weaponsNote: string; sorties: number; dead: number; injured: number; casualtyNote: string; dates: string }
  yields: { airfieldKt: number; areaKt: number; note: string }
  rule: string
  airfields: Airfield[]
}

const U = urban as unknown as { source: string; rule: string; targets: Array<{ lon: number; lat: number; population: number }> }

const SOURCE: Provenance = { source: E.source }
const GRID: Provenance = { source: U.source, method: U.rule }

const MIN = 60

/** Where each weapon falls, in the order the rule gives. */
export function laydown(): Array<{ id: string; name: string; position: LngLat; yieldKt: number; category: 'AIRFIELD' | 'URBAN-INDUSTRIAL'; note: string }> {
  const out: Array<{ id: string; name: string; position: LngLat; yieldKt: number; category: 'AIRFIELD' | 'URBAN-INDUSTRIAL'; note: string }> = []
  for (const f of E.airfields) {
    out.push({ id: f.id, name: f.name, position: [f.lon, f.lat], yieldKt: E.yields.airfieldKt, category: 'AIRFIELD', note: f.side === 'nato' ? 'An allied operating base in West Germany. In this exercise the alliance is destroying the country it is defending, and its own airfields are among the aiming points because the other side is doing the same' : 'A Soviet or East German airfield' })
  }
  let left = E.documented.weapons - out.length * 2
  for (const t of U.targets) {
    if (left <= 0) break
    out.push({ id: `urban-${out.length}`, name: `Urban area ${Math.abs(t.lat).toFixed(1)}°N ${Math.abs(t.lon).toFixed(1)}°E`, position: [t.lon, t.lat], yieldKt: E.yields.areaKt, category: 'URBAN-INDUSTRIAL', note: `One of the most populous cells of the 1951 grid, about ${Math.round(t.population).toLocaleString('en-GB')} people. Whether the exercise struck it is not known` })
    left -= 1
  }
  return out
}

export function carteBlancheArithmetic() {
  const l = laydown()
  return {
    weapons: E.documented.weapons,
    marks: l.length,
    airfields: E.airfields.length,
    urban: l.filter((x) => x.category === 'URBAN-INDUSTRIAL').length,
    dead: E.documented.dead,
    injured: E.documented.injured,
    perWeapon: Math.round(E.documented.dead / E.documented.weapons),
  }
}

export function carteBlanche(): Study {
  const marks = laydown()
  const a = carteBlancheArithmetic()
  // The exercise ran over nine days; the detonations are laid out over an hour so the reader can watch the country fill up.
  const spacing = (60 * MIN) / marks.length
  const entities: Entity[] = marks.map((m, i) => ({
    kind: 'effect',
    id: `cb-${m.id}`,
    name: m.name,
    designation: `${m.category} · ${m.yieldKt} KT · SIMULATED`,
    label: false,
    compact: true,
    side: 'attacker',
    center: m.position,
    time: Math.round(i * spacing),
    effects: promptEffects(m.yieldKt),
    burst: 'air',
    evidence: 'modelled',
    provenance: { source: BLAST_MODEL },
    facts: [
      { label: 'Why here', value: m.note, evidence: m.category === 'AIRFIELD' ? ('reconstructed' as EvidenceTier) : ('modelled' as EvidenceTier), provenance: m.category === 'AIRFIELD' ? SOURCE : GRID },
      { label: 'The exercise\'s own ground zeros', value: 'Not published. This mark is where a stated rule puts a weapon, not where the exercise put one', evidence: 'withheld' as EvidenceTier, provenance: SOURCE },
      { label: 'Yield', value: `${m.yieldKt} kt, inferred. ${E.yields.note}`, evidence: 'inferred' as EvidenceTier, provenance: SOURCE },
    ],
  }))
  const events: StudyEvent[] = [
    { time: -2 * MIN, text: `CARTE BLANCHE · ${E.documented.dates.toUpperCase()} · ALLIED AIR FORCES CENTRAL EUROPE · ABOUT ${E.documented.sorties.toLocaleString('en-GB')} SORTIES`, camera: { center: [10.5, 51], zoom: 6.5, fit: marks.map((m) => m.position), durationMs: 2_500 } },
    { time: 0, text: `${a.weapons} NUCLEAR WEAPONS ARE SIMULATED · MOST OF THEM ON GERMAN SOIL · TWO ON EACH OF ${a.airfields} AIRFIELDS, THE REST ON THE MOST POPULOUS CELLS` },
    { time: Math.round(20 * MIN), text: 'THE AIRFIELDS ARE GONE, ON BOTH SIDES OF THE LINE' },
    { time: Math.round(45 * MIN), text: 'THE EXERCISE DOES NOT DISTINGUISH BETWEEN THE COUNTRY BEING DEFENDED AND THE BATTLEFIELD' },
    { time: Math.round(60 * MIN), text: `THE EXERCISE'S OWN ESTIMATE · ${(a.dead / 1e6).toFixed(1)} MILLION WEST GERMAN DEAD, ${(a.injured / 1e6).toFixed(1)} MILLION INJURED · IMMEDIATE EFFECTS ONLY, WEST GERMANY ONLY` },
    { time: Math.round(70 * MIN), text: 'THE FIGURES LEAKED THAT AUTUMN. THE DEFENCE OF GERMANY, ON THE RECORD, MEANT THE DESTRUCTION OF GERMANY' },
  ]
  return {
    id: 'carte-blanche-1955',
    title: 'CARTE BLANCHE · THE DEFENCE OF GERMANY',
    subtitle: `NATO's air exercise of June 1955 · ${a.weapons} simulated weapons, ${a.airfields} airfields and ${a.urban} populous cells · the exercise's own estimate was ${(a.dead / 1e6).toFixed(1)} million dead · the ground zeros are not published`,
    bounds: { start: -2 * MIN, end: 80 * MIN },
    startTime: -2 * MIN,
    view: { center: [10.5, 51], zoom: 5 },
    entities,
    events,
    omissions: [
      'The exercise\'s target list is not published. Every mark here is where a stated rule puts a weapon: two on each airfield of 1955, the rest on the most populous cells of the 1951 grid, largest first',
      `Yields are inferred: ${E.yields.airfieldKt} kt on the airfields and ${E.yields.areaKt} on the areas. The exercise's own are not published`,
      'No sorties, no routes, no defences: the exercise is drawn as a distribution of detonations, which is what its casualty estimate was',
      'Fallout is not drawn. The exercise counted immediate effects only, and so does this; the ground bursts that would have made most of the fallout are not distinguished in the record',
      'East Germany is struck here and was not counted in the 1.7 million, which was West German dead alone',
      'The nine days of the exercise are compressed into an hour of study time so the country can be watched filling up',
    ],
    populationGrid: 'popc_1951',
    exposureWorkers: 2,
    outcomeReference: { label: 'The exercise\'s own estimate, West German dead', value: E.documented.dead, source: `${E.source}. ${E.documented.casualtyNote}` },
    sides: { attacker: { name: 'The exercise' }, defender: { name: 'Germany' } },
    links: [
      { label: 'Seven days to the River Rhine: the same ground, twenty-four years on', href: '#/study/seven-days' },
      { label: 'Britain: Square Leg and the home front', href: '#/study/britain-80' },
      { label: 'The chronicle: posture and doctrine since 1945', href: '#/chronicle' },
      { label: 'Sources and attribution', href: '#/sources' },
    ],
  }
}
