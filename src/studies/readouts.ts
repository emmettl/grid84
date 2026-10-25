import type { Outcome } from '../models/casualties.ts'
import type { UnionTotals } from '../models/exposure.ts'

/**
 * Where the count is carried to once the study's own clock has run out: a
 * month of standing in the fallout, which is about three quarters of the
 * dose anyone would ever take from it. Nobody would stand there for a
 * month, which is the point of showing it.
 */
export const STAY_HOURS = 720

/** Headline figures rounded to two significant figures, as the readout states. */
export function fmt(v: number) {
  if (v < 10) return Math.round(v).toLocaleString('en-GB')
  const magnitude = 10 ** (Math.floor(Math.log10(v)) - 1)
  return (Math.round(v / magnitude) * magnitude).toLocaleString('en-GB')
}

export type Outcomes = Record<string, Outcome & { grid: string }>
export type FalloutOutcomes = Record<string, { under1: number; dead: number; grid: string; hours: number }>
export type Unions = Partial<Record<'attacker' | 'defender', { totals: UnionTotals; detonations: number; plumes: number }>>
export interface OutcomeSums {
  computed: number
  total: number
  blastDead: number
  blastInjured: number
  fireDead: number
  falloutComputed: number
  falloutDead: number
  under1: number
  falloutHours: number
}
