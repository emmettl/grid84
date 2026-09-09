import { thirdDegreeBurnRadiusMetres } from './blast.ts'
import { OTA_BANDS, overpressureRadiusForPsi } from './casualties.ts'
import type { MortalityZone, ValidationCase } from './validation-cases.ts'

/**
 * Comparisons between the planar models and the recorded outcomes. Pure
 * functions, so the validation test and the lab readout cannot disagree.
 */
export interface RadiusComparison {
  label: string
  modelMetres: number
  recordedMetres: number
  ratio: number
}

/** Model radii set against the nearest recorded distance of the same kind. */
export function radiusComparisons(c: ValidationCase, yieldKt = (c.yieldKt.low + c.yieldKt.high) / 2): RadiusComparison[] {
  const find = (label: string) => c.damage.find((d) => d.label === label)
  const out: RadiusComparison[] = []
  const push = (label: string, model: number, recorded?: number) => {
    if (recorded === undefined) return
    out.push({ label, modelMetres: model, recordedMetres: recorded, ratio: model / recorded })
  }
  const destroyed = find('Complete destruction') ?? find('Nearly everything destroyed')
  push('5 psi against complete destruction', overpressureRadiusForPsi(yieldKt, 5), destroyed?.low)
  push('5 psi against steel-frame severe damage', overpressureRadiusForPsi(yieldKt, 5), find('Steel-frame severe damage')?.low)
  push('2 psi against all Japanese homes destroyed', overpressureRadiusForPsi(yieldKt, 2), find('All Japanese homes destroyed')?.low)
  const burned = find('Burned-out area') ?? find('Near-complete devastation')
  push('Third-degree burn radius against fire, mean radius', thirdDegreeBurnRadiusMetres(yieldKt), find('Fire, mean radius')?.low)
  if (burned) push('Third-degree burn radius against burned-area equivalent radius', thirdDegreeBurnRadiusMetres(yieldKt), Math.sqrt((burned.low * 1e6) / Math.PI))
  push('2 psi against complete window damage', overpressureRadiusForPsi(yieldKt, 2), find('Complete window damage')?.low)
  return out
}

/** The OTA fatality fraction at a distance, for a yield. */
export function otaFatalFractionAt(yieldKt: number, metres: number): number {
  for (const band of OTA_BANDS) {
    if (metres <= overpressureRadiusForPsi(yieldKt, band.minPsi)) return band.fatal
  }
  return 0
}

/** Area-weighted mean fatality fraction inside `radius`, from a piecewise-constant fraction of distance. */
export function areaWeightedFraction(fractionAt: (metres: number) => number, radius: number, steps = 400): number {
  let weighted = 0
  for (let i = 0; i < steps; i += 1) {
    const r0 = (i / steps) * radius
    const r1 = ((i + 1) / steps) * radius
    weighted += fractionAt((r0 + r1) / 2) * (r1 * r1 - r0 * r0)
  }
  return weighted / (radius * radius)
}

export function recordedFractionAt(zones: MortalityZone[], metres: number): number {
  const zone = zones.find((z) => metres >= z.from && metres < z.to)
  return zone ? zone.fraction : 0
}

export interface PlanarEstimate {
  densityPerKm2: number
  radiusOfBuiltUpMetres: number
  blastDead: number
  blastInjured: number
  fireDead: number
  note: string
}

/**
 * The blast-only method applied to the documented built-up density, treating
 * the built-up area as a disc centred on the hypocentre. This is the
 * planners' own arithmetic with the survey's own inputs.
 */
export function planarEstimate(c: ValidationCase, population: number, yieldKt = (c.yieldKt.low + c.yieldKt.high) / 2): PlanarEstimate | null {
  if (!c.builtUp) return null
  const density = (population * c.builtUp.populationShare) / c.builtUp.areaKm2
  const R = Math.sqrt((c.builtUp.areaKm2 * 1e6) / Math.PI)
  let dead = 0
  let injured = 0
  let previous = 0
  for (const band of OTA_BANDS) {
    const outer = Math.min(R, overpressureRadiusForPsi(yieldKt, band.minPsi))
    const area = Math.max(0, Math.PI * (outer * outer - previous * previous)) / 1e6
    dead += area * density * band.fatal
    injured += area * density * band.injured
    previous = Math.max(previous, outer)
  }
  const fireR = Math.min(R, thirdDegreeBurnRadiusMetres(yieldKt))
  const fireDead = Math.max(dead, (Math.PI * fireR * fireR * density) / 1e6)
  return { densityPerKm2: density, radiusOfBuiltUpMetres: R, blastDead: dead, blastInjured: injured, fireDead, note: c.builtUp.note }
}
