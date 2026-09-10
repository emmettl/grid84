import type { Evidenced } from '../evidence/evidence.ts'
import { overpressureRadiusMetres, surfaceOverpressureRadiusMetres } from './blast.ts'

/**
 * Lethality: what a weapon of a given yield and accuracy can destroy. The
 * single-shot kill probability against a target that fails at a stated
 * overpressure is the chance the warhead lands inside the radius at which
 * that overpressure is reached, with the miss distance distributed as a
 * circular normal whose median is the CEP. This is the bookkeeping of every
 * counterforce assessment from the 1960s on (Tsipis, Arsenal, 1983, ch. 6;
 * Bunn and Tsipis, Scientific American, November 1983), and it is what made
 * counterforce a technical choice before it was a doctrinal one: a city
 * fails at five pounds per square inch and a silo at two thousand, and the
 * radius for the second is a small fraction of the first.
 */

export interface HardTarget {
  id: string
  name: string
  /** Overpressure at which the target is destroyed, psi. */
  psi: number
  /**
   * How big the thing itself is, metres across. It is drawn to scale beside
   * the lethal radius, because that comparison is the whole argument about
   * accuracy: a silo lid is four metres wide and a city is ten kilometres,
   * so a warhead that must land within a few hundred metres of one need not
   * be aimed at all carefully at the other.
   */
  extentMetres: number
  note: string
  provenance: Evidenced['provenance']
}

export const TARGETS: HardTarget[] = [
  { id: 'city', name: 'City centre', psi: 5, extentMetres: 10_000, note: 'Brick and frame construction severely damaged; the OTA and NUKEMAP casualty bands take 5 psi as the line', provenance: { source: 'Office of Technology Assessment, The Effects of Nuclear War (1979), ch. II' } },
  { id: 'airfield', name: 'Aircraft in the open', psi: 3, extentMetres: 2_500, note: 'Parked aircraft damaged beyond use at 2 to 3 psi', provenance: { source: 'Glasstone and Dolan, The Effects of Nuclear Weapons (1977), §5.150' } },
  { id: 'silo-1960s', name: 'Silo, early 1960s', psi: 300, extentMetres: 4, note: 'Minuteman I silos were built to about 300 psi', provenance: { source: 'Cochran, Arkin and Hoenig, Nuclear Weapons Databook vol. 1 (1984), Minuteman' } },
  { id: 'silo-hard', name: 'Hardened silo, 1970s', psi: 2_000, extentMetres: 4, note: 'The Minuteman upgrade programme of the 1970s took the silos to about 2,000 psi; Soviet silos of the same decade were estimated at 2,000 to 6,000', provenance: { source: 'Databook vol. 1; Tsipis, Arsenal (1983), ch. 6' } },
  { id: 'silo-superhard', name: 'Superhard silo, as estimated', psi: 6_000, extentMetres: 4, note: 'The upper estimate for the SS-18 fields', provenance: { source: 'Tsipis, Arsenal (1983); Bunn and Tsipis (1983)' } },
  { id: 'bunker', name: 'Deep command bunker', psi: 10_000, extentMetres: 60, note: 'A figure of merit rather than a design: at this hardness only a crater reaches the target, and the overpressure rule overstates what a near miss does', provenance: { source: 'Illustrative; deep-underground hardening is not published' } },
]

/**
 * Where a salvo actually lands.
 *
 * Circular error probable is the radius that half the warheads fall inside.
 * The impacts themselves are two independent normal errors, one in each
 * direction, each with a standard deviation of CEP / 1.1774 — the factor is
 * the Rayleigh median. Drawing them is worth more than quoting the number:
 * against a silo four metres wide, a hundred-metre CEP is the difference
 * between a weapon that works and one that does not, and against a city
 * nothing about it matters at all.
 *
 * The draw is seeded so that the same salvo can be looked at twice.
 */
export const CEP_TO_SIGMA = 1 / 1.1774

export function impactPattern(cepMetres: number, shots: number, seed = 1): Array<{ x: number; y: number; radius: number }> {
  const sigma = cepMetres * CEP_TO_SIGMA
  let state = (seed * 2654435761) >>> 0
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return (state >>> 8) / 16777216
  }
  const out: Array<{ x: number; y: number; radius: number }> = []
  for (let i = 0; i < shots; i += 1) {
    // Box-Muller, twice, for two independent normal errors.
    const u1 = Math.max(1e-9, next())
    const u2 = next()
    const r = sigma * Math.sqrt(-2 * Math.log(u1))
    const x = r * Math.cos(2 * Math.PI * u2)
    const y = r * Math.sin(2 * Math.PI * u2)
    out.push({ x, y, radius: Math.hypot(x, y) })
  }
  return out
}

/** Ground range at which the overpressure is reached: the optimum-height air burst for soft targets, the contact surface burst for hard ones. */
export function lethalRadiusMetres(yieldKt: number, psi: number): number {
  if (psi <= 5) return overpressureRadiusMetres(yieldKt, psi <= 3 ? 3 : 5)
  return surfaceOverpressureRadiusMetres(yieldKt, psi)
}

/** Probability that one warhead lands within the lethal radius, the miss distance circular normal with median CEP. */
export function singleShotKill(yieldKt: number, cepMetres: number, psi: number): number {
  const lr = lethalRadiusMetres(yieldKt, psi)
  if (cepMetres <= 0) return 1
  return 1 - 0.5 ** ((lr / cepMetres) ** 2)
}

/** Kill probability with `shots` warheads each of reliability `reliability`. */
export function killProbability(yieldKt: number, cepMetres: number, psi: number, shots = 1, reliability = 1): number {
  const p = reliability * singleShotKill(yieldKt, cepMetres, psi)
  return 1 - (1 - p) ** Math.max(1, shots)
}

/** The CEP at which a weapon of this yield has an even chance against the target. */
export function cepForEvenChance(yieldKt: number, psi: number): number {
  return lethalRadiusMetres(yieldKt, psi)
}

export interface WeaponSystem extends Evidenced {
  id: string
  name: string
  side: 'us' | 'su'
  /** Year the system, or the guidance that gives it this CEP, entered service. */
  year: number
  yieldKt: number
  warheads: number
  cepMetres: number
  guidance: string
}

const DATABOOK = 'Cochran, Arkin and Hoenig, Nuclear Weapons Databook vol. 1 (1984); vol. 4 (1989) for Soviet systems'
const MACKENZIE = 'MacKenzie, Inventing Accuracy: A Historical Sociology of Nuclear Missile Guidance (1990), tables of published CEP estimates'

/**
 * Published estimates of yield and accuracy by system. CEPs are the
 * estimates the open literature gives; official figures are classified and
 * the tier says so. The sequence is the shift the lab shows: from a
 * megaton that must land within miles to a few hundred kilotons that land
 * within a hundred metres.
 */
export const SYSTEMS: WeaponSystem[] = [
  { id: 'atlas-d', name: 'Atlas D · W49', side: 'us', year: 1959, yieldKt: 1_440, warheads: 1, cepMetres: 3_700, guidance: 'Radio-inertial', evidence: 'reconstructed', provenance: { source: DATABOOK, method: 'CEP about 2 nautical miles' } },
  { id: 'r-7', name: 'R-7 · SS-6', side: 'su', year: 1960, yieldKt: 3_000, warheads: 1, cepMetres: 5_000, guidance: 'Radio-inertial', evidence: 'inferred', provenance: { source: MACKENZIE, method: 'CEP of several kilometres; the figure is an estimate' } },
  { id: 'polaris-a1', name: 'Polaris A1 · W47', side: 'us', year: 1960, yieldKt: 600, warheads: 1, cepMetres: 3_700, guidance: 'Inertial, from SINS', evidence: 'reconstructed', provenance: { source: MACKENZIE, method: 'About 2 nautical miles, the submarine\'s own position error the largest term' } },
  { id: 'titan-ii', name: 'Titan II · W53', side: 'us', year: 1963, yieldKt: 9_000, warheads: 1, cepMetres: 1_400, guidance: 'Inertial', evidence: 'reconstructed', provenance: { source: DATABOOK, method: 'About 0.8 nautical miles' } },
  { id: 'minuteman-i', name: 'Minuteman I · W59', side: 'us', year: 1962, yieldKt: 1_000, warheads: 1, cepMetres: 2_000, guidance: 'Inertial, NS-10', evidence: 'reconstructed', provenance: { source: DATABOOK, method: 'About 1.1 nautical miles' } },
  { id: 'polaris-a3', name: 'Polaris A3 · W58', side: 'us', year: 1964, yieldKt: 200, warheads: 3, cepMetres: 900, guidance: 'Inertial, from SINS', evidence: 'reconstructed', provenance: { source: MACKENZIE, method: 'About 0.5 nautical miles' } },
  { id: 'ss-11', name: 'UR-100 · SS-11', side: 'su', year: 1966, yieldKt: 1_000, warheads: 1, cepMetres: 1_400, guidance: 'Inertial', evidence: 'inferred', provenance: { source: DATABOOK, method: 'Estimate' } },
  { id: 'minuteman-ii', name: 'Minuteman II · W56', side: 'us', year: 1966, yieldKt: 1_200, warheads: 1, cepMetres: 600, guidance: 'Inertial, NS-17', evidence: 'reconstructed', provenance: { source: DATABOOK, method: 'About 0.3 nautical miles' } },
  { id: 'ss-9', name: 'R-36 · SS-9', side: 'su', year: 1967, yieldKt: 20_000, warheads: 1, cepMetres: 1_000, guidance: 'Inertial', evidence: 'inferred', provenance: { source: DATABOOK, method: 'Estimate; the largest warhead ever deployed on a missile' } },
  { id: 'minuteman-iii', name: 'Minuteman III · W62', side: 'us', year: 1970, yieldKt: 170, warheads: 3, cepMetres: 280, guidance: 'Inertial, NS-20', evidence: 'reconstructed', provenance: { source: DATABOOK, method: 'About 0.15 nautical miles' } },
  { id: 'poseidon', name: 'Poseidon C3 · W68', side: 'us', year: 1971, yieldKt: 40, warheads: 10, cepMetres: 450, guidance: 'Inertial, from SINS', evidence: 'reconstructed', provenance: { source: MACKENZIE, method: 'About 0.25 nautical miles' } },
  { id: 'ss-19', name: 'UR-100N · SS-19', side: 'su', year: 1975, yieldKt: 550, warheads: 6, cepMetres: 300, guidance: 'Inertial', evidence: 'inferred', provenance: { source: DATABOOK, method: 'Estimate' } },
  { id: 'ss-18-4', name: 'R-36M · SS-18 Mod 4', side: 'su', year: 1979, yieldKt: 500, warheads: 10, cepMetres: 250, guidance: 'Inertial', evidence: 'inferred', provenance: { source: DATABOOK, method: 'Estimate; the system American planners counted as a silo killer' } },
  { id: 'trident-c4', name: 'Trident I C4 · W76', side: 'us', year: 1979, yieldKt: 100, warheads: 8, cepMetres: 450, guidance: 'Stellar-inertial', evidence: 'reconstructed', provenance: { source: MACKENZIE, method: 'About 0.25 nautical miles; the star sight removes most of the submarine\'s position and heading error' } },
  { id: 'minuteman-iii-w78', name: 'Minuteman III · W78 · NS-20 refit', side: 'us', year: 1980, yieldKt: 335, warheads: 3, cepMetres: 220, guidance: 'Inertial, NS-20 improved', evidence: 'reconstructed', provenance: { source: DATABOOK, method: 'About 0.12 nautical miles after the guidance improvement programme' } },
  { id: 'ss-25', name: 'RT-2PM · SS-25', side: 'su', year: 1985, yieldKt: 550, warheads: 1, cepMetres: 200, guidance: 'Inertial', evidence: 'inferred', provenance: { source: DATABOOK, method: 'Estimate' } },
  { id: 'peacekeeper', name: 'Peacekeeper · W87', side: 'us', year: 1986, yieldKt: 300, warheads: 10, cepMetres: 100, guidance: 'Inertial, AIRS', evidence: 'reconstructed', provenance: { source: MACKENZIE, method: 'About 0.05 nautical miles; the floated-sphere inertial unit' } },
  { id: 'trident-d5', name: 'Trident II D5 · W88', side: 'us', year: 1990, yieldKt: 455, warheads: 8, cepMetres: 120, guidance: 'Stellar-inertial, Mk 6', evidence: 'reconstructed', provenance: { source: MACKENZIE, method: 'About 0.06 nautical miles; the first sea-based weapon with a silo-killing accuracy' } },
]

/** The Minuteman upgrade's 2,000 psi silo as the benchmark of counterforce: which systems have an even chance against it. */
export const COUNTERFORCE_PSI = 2_000
