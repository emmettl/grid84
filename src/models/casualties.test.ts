import { describe, expect, it } from 'vitest'
import { overpressureRadiusMetres } from './blast.ts'
import { applyBands, bandPopulations, bandsFor, OTA_BANDS, outcome, overpressureRadiusForPsi, STRUCTURE_CLASSES } from './casualties.ts'

describe('OTA bands', () => {
  it('reproduces figure II-1', () => {
    const byKey = Object.fromEntries(OTA_BANDS.map((b) => [b.key, b]))
    expect(byKey.psi12.fatal).toBe(0.98)
    expect(byKey.psi5.fatal + byKey.psi5.injured).toBeCloseTo(0.9, 6)
    expect(byKey.psi2.fatal).toBe(0.05)
    expect(byKey.psi1.fatal).toBe(0)
    expect(byKey.psi1.injured).toBe(0.25)
  })
})

describe('overpressureRadiusForPsi', () => {
  it('matches the tabulated constants exactly at their points', () => {
    for (const psi of [20, 10, 5, 3, 1] as const) expect(overpressureRadiusForPsi(1_000, psi)).toBeCloseTo(overpressureRadiusMetres(1_000, psi), 6)
  })
  it('interpolates monotonically for 12 and 2 psi', () => {
    const r20 = overpressureRadiusForPsi(1_000, 20)
    const r12 = overpressureRadiusForPsi(1_000, 12)
    const r10 = overpressureRadiusForPsi(1_000, 10)
    const r3 = overpressureRadiusForPsi(1_000, 3)
    const r2 = overpressureRadiusForPsi(1_000, 2)
    const r1 = overpressureRadiusForPsi(1_000, 1)
    expect(r12).toBeGreaterThan(r20)
    expect(r12).toBeLessThan(r10)
    expect(r2).toBeGreaterThan(r3)
    expect(r2).toBeLessThan(r1)
  })
})

describe('outcome', () => {
  it('sums blast casualties and lets fire dominate only when larger', () => {
    const bands = applyBands({ psi12: 1_000, psi5: 2_000, psi2: 4_000, psi1: 8_000 })
    const o = outcome(bands, 5_000)
    expect(o.blast.exposed).toBe(15_000)
    expect(o.blast.fatal).toBeCloseTo(980 + 1_000 + 200, 6)
    expect(o.blast.injured).toBeCloseTo(20 + 800 + 1_800 + 2_000, 6)
    expect(o.fire.fatal).toBe(5_000)
    expect(outcome(bands, 100).fire.fatal).toBeCloseTo(o.blast.fatal, 6)
  })
})

describe('bandPopulations', () => {
  it('differences cumulative counts and ignores rings that are not bands', () => {
    const within = { psi12: 100, psi5: 250, fire: 900, psi2: 400, psi1: 1_000 }
    expect(bandPopulations(within)).toEqual({ psi12: 100, psi5: 150, psi2: 150, psi1: 600 })
  })
})

describe('bandsFor', () => {
  it('scales the thresholds to the collapse pressure and keeps the fractions', () => {
    const japan = STRUCTURE_CLASSES.find((s) => s.key === 'japan-1945')!
    const bands = bandsFor(japan)
    for (const [i, psi] of [7.2, 3, 1.2, 0.6].entries()) expect(bands[i].minPsi).toBeCloseTo(psi, 9)
    expect(bands[1].maxPsi).toBeCloseTo(7.2, 9)
    expect(bands[0].maxPsi).toBe(Infinity)
    expect(bands.map((b) => b.fatal)).toEqual(OTA_BANDS.map((b) => b.fatal))
    expect(bandsFor(5)).toEqual(OTA_BANDS)
  })
  it('puts the Japanese collapse band at 15 kt near the recorded 1.5 mile "all homes destroyed" radius', () => {
    const japan = bandsFor(3)
    const collapseRadius = overpressureRadiusForPsi(15, japan[1].minPsi)
    expect(collapseRadius / 2_414).toBeGreaterThan(0.9)
    expect(collapseRadius / 2_414).toBeLessThan(1.15)
  })
})
