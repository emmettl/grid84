import type { Sortie, SystemKind } from './allocation.ts'

/**
 * Delivery attrition for an enacted force. The planning staff's history
 * says SIOP-62's assurance of delivery "averaged 85 percent, greater than
 * the 75 percent minimum set by the U.S. high command" (NSA EBB 236), and
 * Sagan records Atlas D and E reliability of about 0.70 to 0.80 (n. 33).
 * Missiles fail only for reliability; bombers also fail to penetrate. The
 * bomber penetration probability is the one free number, chosen so the
 * weapon-weighted average delivery equals the documented 85 percent. Each
 * sortie is then delivered or lost by a deterministic hash of its id, so
 * the same force loses the same sorties every run.
 */
export const DOCUMENTED_ASSURANCE = 0.85
export const DOCUMENTED_ASSURANCE_FLOOR = 0.75

/** Reliability by system kind: Atlas documented; the others are inferred to sit near it. */
export const RELIABILITY: Record<SystemKind, { value: number; evidence: 'documented' | 'inferred'; note: string }> = {
  icbm: { value: 0.75, evidence: 'documented', note: 'Atlas D and E about 0.70 to 0.80 (Sagan n. 33)' },
  irbm: { value: 0.8, evidence: 'inferred', note: 'Jupiter, a simpler liquid-fuel missile of the same generation' },
  slbm: { value: 0.8, evidence: 'inferred', note: 'Polaris A-1, before the W47 defects were understood' },
  bomber: { value: 0.9, evidence: 'inferred', note: 'Aborts and mechanical failures on a fifteen-minute launch' },
}

/** The 1961 reliabilities as plain numbers, the default for `fate`. */
export const DEFAULT_RELIABILITY: Record<SystemKind, number> = { icbm: RELIABILITY.icbm.value, irbm: RELIABILITY.irbm.value, slbm: RELIABILITY.slbm.value, bomber: RELIABILITY.bomber.value }

export interface AttritionCalibration {
  /** Probability a bomber that works also gets through. */
  penetration: number
  /** Resulting weapon-weighted average delivery. */
  average: number
}

/** Solve the bomber penetration probability so the force average delivery equals the target. */
export function calibrate(sorties: Sortie[], target = DOCUMENTED_ASSURANCE): AttritionCalibration {
  const missileWeapons = sorties.filter((s) => s.kind !== 'bomber')
  const bomberWeapons = sorties.filter((s) => s.kind === 'bomber')
  const missileDelivered = missileWeapons.reduce((sum, s) => sum + s.weapons * RELIABILITY[s.kind].value, 0)
  const bomberWorking = bomberWeapons.reduce((sum, s) => sum + s.weapons * RELIABILITY.bomber.value, 0)
  const total = sorties.reduce((sum, s) => sum + s.weapons, 0)
  const needed = target * total - missileDelivered
  const penetration = bomberWorking > 0 ? Math.max(0, Math.min(1, needed / bomberWorking)) : 1
  const average = total > 0 ? (missileDelivered + bomberWorking * penetration) / total : 0
  return { penetration, average }
}

export function deliveryProbability(kind: SystemKind, penetration: number): number {
  return RELIABILITY[kind].value * (kind === 'bomber' ? penetration : 1)
}

/** Deterministic unit-interval hash of a string. */
export function hash01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1_000_003) / 1_000_003
}

export type LossCause = 'reliability' | 'penetration'

export interface SortieFate {
  delivered: boolean
  cause?: LossCause
  /** Fraction of the route flown before the loss; 0 for a launch failure. */
  lostAtFraction?: number
}

/** Decide each sortie's fate from its id. Reliability failures happen at launch; penetration losses in the last part of the route. */
export function fate(sortieId: string, kind: SystemKind, penetration: number, reliability: Record<SystemKind, number> = DEFAULT_RELIABILITY): SortieFate {
  const r = hash01(`${sortieId}:reliability`)
  if (r > reliability[kind]) return { delivered: false, cause: 'reliability', lostAtFraction: kind === 'bomber' ? hash01(`${sortieId}:abort`) * 0.15 : 0 }
  if (kind === 'bomber') {
    const p = hash01(`${sortieId}:penetration`)
    if (p > penetration) return { delivered: false, cause: 'penetration', lostAtFraction: 0.6 + hash01(`${sortieId}:where`) * 0.38 }
  }
  return { delivered: true }
}

export const ATTRITION_MODEL = 'Delivery attrition: system reliability × bomber penetration, penetration chosen so the force averages the documented 85 percent assurance (EBB 236); losses by deterministic hash'
