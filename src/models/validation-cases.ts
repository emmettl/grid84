import type { Evidenced, Provenance } from '../evidence/evidence.ts'
import type { LngLat } from '../geo/geodesy.ts'

/**
 * The two detonations with recorded outcomes. Every figure carries its
 * source; where sources disagree, all are kept. These are the only places
 * the effects and exposure chain can be checked against events.
 */
const MED: Provenance = { source: 'Manhattan Engineer District, The Atomic Bombings of Hiroshima and Nagasaki (29 June 1946)', url: 'https://www.atomicarchive.com/resources/documents/med/index.html' }
const USSBS: Provenance = { source: 'US Strategic Bombing Survey, The Effects of Atomic Bombs on Hiroshima and Nagasaki (30 June 1946)', url: 'https://www.atomicarchive.com/resources/documents/bombing-survey/index.html' }
const RERF: Provenance = { source: 'Radiation Effects Research Foundation, FAQ', url: 'https://www.rerf.or.jp/en/faq/' }
const MALIK: Provenance = { source: 'Malik, The Yields of the Hiroshima and Nagasaki Nuclear Explosions, LA-8819 (1985)', url: 'https://www.osti.gov/biblio/1489669' }
const CITY: Provenance = { source: 'City of Hiroshima, official site', url: 'https://www.city.hiroshima.lg.jp/site/english/9803.html' }

export interface RecordedFigure extends Evidenced {
  label: string
  /** Low and high of the stated range; equal when a single figure. */
  low: number
  high: number
  unit: 'people' | 'metres' | 'kilotons' | 'km2'
  note?: string
}

export interface MortalityZone {
  /** Distance band from the hypocentre, metres. */
  from: number
  to: number
  /** Fraction killed. */
  fraction: number
}

export interface ValidationCase {
  id: 'hiroshima' | 'nagasaki'
  name: string
  date: string
  hypocentre: LngLat
  hypocentreSource: Provenance
  yieldKt: RecordedFigure
  burstHeightMetres: RecordedFigure
  population: RecordedFigure[]
  dead: RecordedFigure[]
  injured: RecordedFigure[]
  /** Recorded distances, for the radius comparison. */
  damage: RecordedFigure[]
  /** Documented built-up density for the planar check, if the sources give one. */
  builtUp?: { areaKm2: number; populationShare: number; provenance: Provenance; note: string }
  mortalityByDistance?: { zones: MortalityZone[]; provenance: Provenance; note: string }
  terrainNote?: Evidenced & { text: string }
}

const FEET = 0.3048
const MILE = 1_609.344
const SQ_MILE = 2.589988

export const HIROSHIMA: ValidationCase = {
  id: 'hiroshima',
  name: 'Hiroshima',
  date: '6 August 1945, 08:15',
  hypocentre: [132.4536, 34.3955],
  hypocentreSource: { source: 'Hypocentre above the Shima Hospital, Ōtemachi; modern coordinates', method: 'The site is marked; coordinates read from the modern map' },
  yieldKt: { label: 'Yield', low: 12, high: 18, unit: 'kilotons', evidence: 'documented', provenance: MALIK, note: '15 kt with outside limits of ±20 percent' },
  burstHeightMetres: { label: 'Burst height', low: 600, high: 600, unit: 'metres', evidence: 'documented', provenance: RERF },
  population: [
    { label: 'Population at attack', low: 245_000, high: 245_000, unit: 'people', evidence: 'documented', provenance: USSBS, note: '"as seems probable"' },
    { label: 'Population at attack', low: 255_000, high: 255_000, unit: 'people', evidence: 'documented', provenance: MED, note: 'after systematic evacuation' },
    { label: 'Population at attack', low: 340_000, high: 350_000, unit: 'people', evidence: 'documented', provenance: RERF, note: 'including military, conscripted labourers and others' },
  ],
  dead: [
    { label: 'Dead', low: 66_000, high: 66_000, unit: 'people', evidence: 'documented', provenance: MED, note: 'immediate' },
    { label: 'Dead', low: 70_000, high: 80_000, unit: 'people', evidence: 'documented', provenance: USSBS, note: 'killed or missing and presumed dead' },
    { label: 'Dead', low: 90_000, high: 166_000, unit: 'people', evidence: 'documented', provenance: RERF, note: 'acute deaths within two to four months' },
    { label: 'Dead', low: 130_000, high: 150_000, unit: 'people', evidence: 'documented', provenance: CITY, note: 'roughly 140,000 by 31 December 1945; "the exact number is still unknown"' },
  ],
  injured: [
    { label: 'Injured', low: 69_000, high: 69_000, unit: 'people', evidence: 'documented', provenance: MED },
    { label: 'Injured', low: 70_000, high: 80_000, unit: 'people', evidence: 'documented', provenance: USSBS, note: '"an equal number were injured"' },
  ],
  damage: [
    { label: 'Complete destruction', low: 1 * MILE, high: 1 * MILE, unit: 'metres', evidence: 'documented', provenance: MED, note: '"almost everything up to about one mile from X was completely destroyed"' },
    { label: 'Steel-frame severe damage', low: 5_700 * FEET, high: 5_700 * FEET, unit: 'metres', evidence: 'documented', provenance: MED },
    { label: 'All Japanese homes destroyed', low: 1.5 * MILE, high: 1.5 * MILE, unit: 'metres', evidence: 'documented', provenance: MED },
    { label: 'Fire, mean radius', low: 6_000 * FEET, high: 6_000 * FEET, unit: 'metres', evidence: 'documented', provenance: MED, note: 'maximum about 11,000 ft' },
    { label: 'Burned-out area', low: 4.4 * SQ_MILE, high: 4.4 * SQ_MILE, unit: 'km2', evidence: 'documented', provenance: USSBS, note: 'almost completely burned out, roughly circular' },
    { label: 'Complete window damage', low: 12_000 * FEET, high: 12_000 * FEET, unit: 'metres', evidence: 'documented', provenance: MED },
  ],
  builtUp: { areaKm2: 7 * SQ_MILE, populationShare: 0.75, provenance: MED, note: '"only 7 square miles were completely built-up" and "75% of the population was concentrated in the densely built-up area in the center"' },
  mortalityByDistance: {
    provenance: { ...MED, locator: 'chapter 10, table C: British Mission to Japan calculation from the Joint Commission study; applies to both cities' },
    note: 'Calculated percent mortality at increasing distances from X',
    zones: [
      { from: 0, to: 1_000 * FEET, fraction: 0.93 },
      { from: 1_000 * FEET, to: 2_000 * FEET, fraction: 0.92 },
      { from: 2_000 * FEET, to: 3_000 * FEET, fraction: 0.86 },
      { from: 3_000 * FEET, to: 4_000 * FEET, fraction: 0.69 },
      { from: 4_000 * FEET, to: 5_000 * FEET, fraction: 0.49 },
      { from: 5_000 * FEET, to: 6_000 * FEET, fraction: 0.315 },
      { from: 6_000 * FEET, to: 7_000 * FEET, fraction: 0.125 },
      { from: 7_000 * FEET, to: 8_000 * FEET, fraction: 0.013 },
      { from: 8_000 * FEET, to: 9_000 * FEET, fraction: 0.005 },
      { from: 9_000 * FEET, to: 10_000 * FEET, fraction: 0 },
    ],
  },
}

export const NAGASAKI: ValidationCase = {
  id: 'nagasaki',
  name: 'Nagasaki',
  date: '9 August 1945, 11:02',
  hypocentre: [129.8636, 32.7737],
  hypocentreSource: { source: 'Hypocentre over the Urakami valley, Matsuyama-machi; modern coordinates', method: 'The site is marked; coordinates read from the modern map' },
  yieldKt: { label: 'Yield', low: 18.9, high: 23.1, unit: 'kilotons', evidence: 'documented', provenance: MALIK, note: '21 kt with outside limits of ±10 percent' },
  burstHeightMetres: { label: 'Burst height', low: 503, high: 503, unit: 'metres', evidence: 'documented', provenance: RERF },
  population: [
    { label: 'Population at attack', low: 195_000, high: 195_000, unit: 'people', evidence: 'documented', provenance: MED },
    { label: 'Population at attack', low: 250_000, high: 270_000, unit: 'people', evidence: 'documented', provenance: RERF },
  ],
  dead: [
    { label: 'Dead', low: 39_000, high: 39_000, unit: 'people', evidence: 'documented', provenance: MED, note: 'immediate' },
    { label: 'Dead', low: 35_000, high: 40_000, unit: 'people', evidence: 'documented', provenance: USSBS },
    { label: 'Dead', low: 60_000, high: 80_000, unit: 'people', evidence: 'documented', provenance: RERF, note: 'acute deaths within two to four months' },
  ],
  injured: [
    { label: 'Injured', low: 25_000, high: 25_000, unit: 'people', evidence: 'documented', provenance: MED },
    { label: 'Injured', low: 35_000, high: 40_000, unit: 'people', evidence: 'documented', provenance: USSBS, note: '"about the same number injured"' },
  ],
  damage: [
    { label: 'Nearly everything destroyed', low: 0.5 * MILE, high: 0.5 * MILE, unit: 'metres', evidence: 'documented', provenance: MED },
    { label: 'Steel-frame severe damage', low: 6_000 * FEET, high: 6_000 * FEET, unit: 'metres', evidence: 'documented', provenance: MED },
    { label: 'All Japanese homes destroyed', low: 1.5 * MILE, high: 1.5 * MILE, unit: 'metres', evidence: 'documented', provenance: MED },
    { label: 'Heavy damage down the valley', low: 10_000 * FEET, high: 10_000 * FEET, unit: 'metres', evidence: 'documented', provenance: MED, note: 'south of X' },
    { label: 'Near-complete devastation', low: 1.8 * SQ_MILE, high: 1.8 * SQ_MILE, unit: 'km2', evidence: 'documented', provenance: USSBS },
  ],
  builtUp: { areaKm2: 4 * SQ_MILE, populationShare: 1, provenance: MED, note: '"less than 4 square miles" heavily developed; the USSBS gives about 65,000 per square mile there. The built-up area is not centred on the hypocentre: the main city lies behind a mountain spur to the south' },
  terrainNote: { evidence: 'documented', provenance: USSBS, text: '"no fire storm arose, and the uneven terrain of the city confined the maximum intensity of damage to the valley over which the bomb exploded"' },
}

export const VALIDATION_CASES: ValidationCase[] = [HIROSHIMA, NAGASAKI]
