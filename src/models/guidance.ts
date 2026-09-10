import type { Evidenced } from '../evidence/evidence.ts'

/**
 * Where a CEP comes from. A missile's miss is the sum of many independent
 * errors, each small, none removable, and the accuracy of a system is the
 * root sum of their squares. For a submarine missile the largest of them
 * in 1960 was not the missile's at all but the boat's: its own position,
 * heading and velocity as the ship's inertial navigator had carried them
 * since the last fix, and the gravity it had not measured. This is the
 * problem of unknowns and cumulative error as MacKenzie's Inventing
 * Accuracy (1990) tells it, and the star sight of the later Tridents is
 * its answer. The structure here is the book's; the magnitudes are
 * illustrations chosen so the total reproduces each system's published
 * CEP, and the lab says so on every reading.
 */

export interface ErrorTerms {
  /** Boat position known at launch, metres, right after a fix. */
  positionAtFix: number
  /** Growth of the boat's position error between fixes, metres per hour. */
  positionDriftPerHour: number
  /** Hours since the last external fix (Transit, Loran, bottom contour). */
  hoursSinceFix: number
  /** Boat velocity error at launch, metres per second. */
  velocity: number
  /** Initial alignment error (heading and the vertical), milliradians. */
  alignment: number
  /** Accelerometer bias during boost, in millionths of g. */
  accelerometerBias: number
  /** Gyro drift during boost, degrees per hour. */
  gyroDrift: number
  /** Gravity model error along the trajectory, as an equivalent velocity error at burnout, metres per second. */
  gravity: number
  /** Reentry dispersion: winds, vehicle asymmetry, fuzing, metres. */
  reentry: number
  /** Range to the target, kilometres. */
  rangeKm: number
  /** Boost duration, seconds. */
  boostSeconds: number
  /** Time of flight, seconds. */
  flightSeconds: number
  /** A stellar-inertial system takes a star sight after boost and corrects the alignment and most of the position knowledge. */
  starSight: boolean
  /** How much of the alignment and position error the star sight removes, 0 to 1. */
  starSightRemoves: number
}

export interface BudgetLine {
  key: string
  label: string
  /** Per-axis standard deviation at the target, metres. */
  sigma: number
  /** Share of the total variance, 0 to 1. */
  share: number
}

export interface Budget {
  lines: BudgetLine[]
  /** Root sum of squares, metres, per axis. */
  sigma: number
  /** Circular error probable, metres: the radius holding half the shots. */
  cep: number
}

const G = 9.80665
/** CEP for a circular normal distribution with per-axis sigma. */
export const CEP_PER_SIGMA = Math.sqrt(2 * Math.log(2))

export function budget(t: ErrorTerms): Budget {
  const remaining = Math.max(0, t.flightSeconds - t.boostSeconds)
  const keep = t.starSight ? 1 - Math.max(0, Math.min(1, t.starSightRemoves)) : 1
  const position = (t.positionAtFix + t.positionDriftPerHour * Math.max(0, t.hoursSinceFix)) * keep
  const velocity = t.velocity * t.flightSeconds
  const alignment = (t.alignment / 1_000) * t.rangeKm * 1_000 * keep
  // A bias through boost leaves a velocity error at cutoff that runs for the rest of the flight.
  const accel = t.accelerometerBias * 1e-6 * G * t.boostSeconds * remaining
  // A constant drift tilts the platform through boost; the position error grows as the cube of the time.
  const drift = (G * ((t.gyroDrift * Math.PI) / 180 / 3_600) * t.boostSeconds ** 3) / 6 + G * ((t.gyroDrift * Math.PI) / 180 / 3_600) * (t.boostSeconds ** 2 / 2) * remaining
  const gravity = t.gravity * remaining
  const lines: BudgetLine[] = [
    { key: 'position', label: t.starSight ? 'Boat position, after the star sight' : 'Boat position since the last fix', sigma: position, share: 0 },
    { key: 'velocity', label: 'Boat velocity at launch', sigma: velocity, share: 0 },
    { key: 'alignment', label: t.starSight ? 'Alignment, after the star sight' : 'Alignment of the platform', sigma: alignment, share: 0 },
    { key: 'accel', label: 'Accelerometer bias through boost', sigma: accel, share: 0 },
    { key: 'drift', label: 'Gyro drift through boost', sigma: drift, share: 0 },
    { key: 'gravity', label: 'Gravity not in the model', sigma: gravity, share: 0 },
    { key: 'reentry', label: 'Reentry', sigma: t.reentry, share: 0 },
  ]
  const variance = lines.reduce((s, l) => s + l.sigma * l.sigma, 0)
  for (const l of lines) l.share = variance > 0 ? (l.sigma * l.sigma) / variance : 0
  const sigma = Math.sqrt(variance)
  return { lines, sigma, cep: sigma * CEP_PER_SIGMA }
}

export interface GuidancePreset extends Evidenced {
  id: string
  name: string
  year: number
  /** The published CEP the terms were chosen to reproduce, metres. */
  publishedCepMetres: number
  terms: ErrorTerms
  note: string
}

const MACKENZIE = 'MacKenzie, Inventing Accuracy: A Historical Sociology of Nuclear Missile Guidance (MIT Press, 1990), the chapters on the fleet ballistic missile and on gravity; CEPs as its tables of published estimates give them'

/**
 * Five systems, thirty years. The published CEP is the fixed point; the
 * split among the terms is an illustration consistent with it, the
 * boat's own position dominating at first and the missile's instruments
 * only after the star sight removed the boat from the sum.
 */
export const PRESETS: GuidancePreset[] = [
  {
    id: 'polaris-a1',
    name: 'Polaris A1',
    year: 1960,
    publishedCepMetres: 3_700,
    terms: { positionAtFix: 800, positionDriftPerHour: 220, hoursSinceFix: 8, velocity: 0.5, alignment: 0.8, accelerometerBias: 120, gyroDrift: 0.05, gravity: 0.35, reentry: 500, rangeKm: 2_200, boostSeconds: 130, flightSeconds: 780, starSight: false, starSightRemoves: 0 },
    note: 'The first SINS, with a Loran or a sun sight for a fix when the boat could take one; the boat\'s position and heading are most of the miss',
    evidence: 'inferred',
    provenance: { source: MACKENZIE, method: 'CEP about 2 nautical miles as published; the allocation to terms is an illustration' },
  },
  {
    id: 'polaris-a3',
    name: 'Polaris A3',
    year: 1964,
    publishedCepMetres: 900,
    terms: { positionAtFix: 200, positionDriftPerHour: 45, hoursSinceFix: 6, velocity: 0.12, alignment: 0.11, accelerometerBias: 50, gyroDrift: 0.02, gravity: 0.12, reentry: 250, rangeKm: 4_600, boostSeconds: 140, flightSeconds: 1_100, starSight: false, starSightRemoves: 0 },
    note: 'Transit satellite fixes from 1964 and a better SINS: the boat\'s position error falls by an order of magnitude',
    evidence: 'inferred',
    provenance: { source: MACKENZIE, method: 'CEP about 0.5 nautical miles as published; allocation illustrative' },
  },
  {
    id: 'poseidon',
    name: 'Poseidon C3',
    year: 1971,
    publishedCepMetres: 450,
    terms: { positionAtFix: 110, positionDriftPerHour: 25, hoursSinceFix: 4, velocity: 0.07, alignment: 0.05, accelerometerBias: 28, gyroDrift: 0.01, gravity: 0.09, reentry: 180, rangeKm: 4_600, boostSeconds: 150, flightSeconds: 1_100, starSight: false, starSightRemoves: 0 },
    note: 'Electrostatic gyros in the navigator, fixes every few hours; gravity and reentry now matter as much as the boat',
    evidence: 'inferred',
    provenance: { source: MACKENZIE, method: 'CEP about 0.25 nautical miles as published; allocation illustrative' },
  },
  {
    id: 'trident-c4',
    name: 'Trident I C4',
    year: 1979,
    publishedCepMetres: 450,
    terms: { positionAtFix: 160, positionDriftPerHour: 35, hoursSinceFix: 6, velocity: 0.1, alignment: 0.09, accelerometerBias: 28, gyroDrift: 0.01, gravity: 0.14, reentry: 250, rangeKm: 7_400, boostSeconds: 160, flightSeconds: 1_500, starSight: true, starSightRemoves: 0.8 },
    note: 'The first star sight: a longer range at the same CEP, because the sight after boost removes most of the boat\'s error from the sum',
    evidence: 'inferred',
    provenance: { source: MACKENZIE, method: 'CEP about 0.25 nautical miles at 7,400 km as published; allocation illustrative' },
  },
  {
    id: 'trident-d5',
    name: 'Trident II D5',
    year: 1990,
    publishedCepMetres: 120,
    terms: { positionAtFix: 80, positionDriftPerHour: 15, hoursSinceFix: 6, velocity: 0.03, alignment: 0.04, accelerometerBias: 8, gyroDrift: 0.003, gravity: 0.03, reentry: 60, rangeKm: 7_400, boostSeconds: 170, flightSeconds: 1_500, starSight: true, starSightRemoves: 0.9 },
    note: 'The Mk 6 stellar-inertial guidance and a gravity model built from years of satellite geodesy: the sea-based missile reaches the silo-killing accuracy of the land-based',
    evidence: 'inferred',
    provenance: { source: MACKENZIE, method: 'CEP about 0.06 nautical miles as published; allocation illustrative' },
  },
]
