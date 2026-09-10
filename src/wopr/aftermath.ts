import { famine } from '../models/famine.ts'
import { harvest } from '../models/harvest.ts'
import { SOOT_PER_PERSON_KG } from '../models/soot.ts'
import { injectionWeights, peakOf, runWinter } from '../models/winter.ts'
import { ZONAL_1983 } from '../winter/zonal.ts'
import type { Score } from './model.ts'

/**
 * What the plan does to the sky, and what the sky then does.
 *
 * The optimiser's loss function stops at the blast and the fire. That is a
 * decision, and it is the decision the instrument exists to make visible,
 * so the consequence of it is computed here and printed beside every plan
 * the machine calls optimal.
 *
 * The arithmetic is short because the matrix has already done the work.
 * Toon's chain puts eleven tonnes of combustible material behind every
 * person in a burning city and turns two per cent of what burns into soot,
 * of which about two thirds gets above the weather: a hundred and fifty
 * kilogrammes of stratospheric soot for each person inside the fire. And
 * the figure the matrix carries for every target is Postol's bound, which
 * is the population inside the fire. So under Toon's own assumptions the
 * soot of a plan is proportional to the people its fires kill, and the
 * constant is the same hundred and fifty kilogrammes.
 *
 * That proportionality is worth stating rather than hiding, because it
 * means no plan can trade one against the other. A planner cannot buy back
 * the winter by killing the same people differently. The only thing that
 * changes the soot is striking somewhere that does not burn — a silo field
 * — and the coverage constraint is what stops that.
 *
 * Half the soot is not the American planner's to decide at all. The Soviet
 * strike is the scenario here, not a choice, and the cities it burns are
 * American ones. Whatever objective the machine is set, that half stands.
 */

/** Stratospheric soot per person inside the fire, kilogrammes: Toon's chain, multiplied out. */
export const SOOT_PER_DEAD_KG = SOOT_PER_PERSON_KG

export interface Aftermath {
  /** Teragrams, from the Soviet strike on American cities and from the American answer on Soviet ones. */
  fromSoviet: number
  fromAmerican: number
  sootTg: number
  /** People the world's food cannot keep alive at the worst of it, on the 1983 world. */
  withoutFood: number
  /** The year that falls in, and the deepest global cooling. */
  worstYear: number
  peakAnomaly: number
  /** The harvest of the second year, as a fraction of an undisturbed one. */
  harvestYear2: number
}

const tgOf = (dead: number) => (dead * SOOT_PER_DEAD_KG) / 1e9

export function sootOf(score: { usDead: number; suDead: number }): { fromSoviet: number; fromAmerican: number; total: number } {
  const fromSoviet = tgOf(score.usDead)
  const fromAmerican = tgOf(score.suDead)
  return { fromSoviet, fromAmerican, total: fromSoviet + fromAmerican }
}

interface Row {
  sootTg: number
  withoutFood: number
  worstYear: number
  peakAnomaly: number
  harvestYear2: number
}

/**
 * The winter chain is too slow to run inside the search, so it is run once
 * over a ladder of soot masses and interpolated. Twenty-four rungs from
 * half a teragram to eight hundred, which covers everything the 1983
 * posture can put up.
 */
let ladder: Row[] | null = null

function buildLadder(): Row[] {
  const zonal = ZONAL_1983
  const population = zonal.bands.reduce((a, b) => a + b.population, 0)
  const injection = injectionWeights(zonal, [
    { lat: 35, weight: 0.3 },
    { lat: 45, weight: 0.4 },
    { lat: 55, weight: 0.3 },
  ])
  const rows: Row[] = [{ sootTg: 0, withoutFood: 0, worstYear: 0, peakAnomaly: 0, harvestYear2: 1 }]
  for (let i = 0; i < 24; i += 1) {
    const sootTg = 0.5 * (800 / 0.5) ** (i / 23)
    const frames = runWinter({ sootTg, injection, zonal, months: 120, startMonth: 4 })
    const years = harvest(frames, zonal, { population })
    const hunger = famine(years, zonal, { livestock: 'partial', waste: 'unchanged', trade: false, population })
    const worst = hunger.reduce((a, b) => (b.withoutFood > a.withoutFood ? b : a), hunger[0])
    rows.push({ sootTg, withoutFood: worst.withoutFood, worstYear: worst.year, peakAnomaly: peakOf(frames).anomaly, harvestYear2: years[1]?.fraction ?? 1 })
  }
  return rows
}

/** The aftermath of a plan: its soot, and what the published chain says follows. */
export function aftermathOf(score: Pick<Score, 'usDead' | 'suDead'>): Aftermath {
  if (!ladder) ladder = buildLadder()
  const soot = sootOf(score)
  const rows = ladder
  const t = Math.max(0, Math.min(soot.total, rows[rows.length - 1].sootTg))
  let lo = rows[0]
  let hi = rows[rows.length - 1]
  for (let i = 1; i < rows.length; i += 1) {
    if (t <= rows[i].sootTg) {
      lo = rows[i - 1]
      hi = rows[i]
      break
    }
  }
  const span = hi.sootTg - lo.sootTg
  const f = span > 0 ? (t - lo.sootTg) / span : 0
  const mix = (a: number, b: number) => a + (b - a) * f
  return {
    fromSoviet: soot.fromSoviet,
    fromAmerican: soot.fromAmerican,
    sootTg: soot.total,
    withoutFood: mix(lo.withoutFood, hi.withoutFood),
    worstYear: Math.round(mix(lo.worstYear, hi.worstYear)),
    peakAnomaly: mix(lo.peakAnomaly, hi.peakAnomaly),
    harvestYear2: mix(lo.harvestYear2, hi.harvestYear2),
  }
}

/** The world the aftermath is computed on, for the readout to name. */
export function aftermathWorld(): { year: number; population: number } {
  return { year: ZONAL_1983.year ?? 1983, population: ZONAL_1983.bands.reduce((a, b) => a + b.population, 0) }
}
