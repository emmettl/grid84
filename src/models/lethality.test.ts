import { describe, expect, it } from 'vitest'
import { cepForEvenChance, COUNTERFORCE_PSI, killProbability, lethalRadiusMetres, singleShotKill, SYSTEMS } from './lethality.ts'

describe('lethality', () => {
  it('has an even chance when the CEP equals the lethal radius, and scales as the circular normal', () => {
    const lr = lethalRadiusMetres(1_000, 2_000)
    expect(singleShotKill(1_000, lr, 2_000)).toBeCloseTo(0.5, 6)
    expect(singleShotKill(1_000, lr / 2, 2_000)).toBeCloseTo(1 - 0.5 ** 4, 6)
    expect(cepForEvenChance(1_000, 2_000)).toBeCloseTo(lr, 6)
  })

  it('makes a city a viable target for a megaton at miles and a silo not', () => {
    // Atlas D: 1.44 Mt at 3.7 km.
    expect(singleShotKill(1_440, 3_700, 5)).toBeGreaterThan(0.6)
    expect(singleShotKill(1_440, 3_700, 2_000)).toBeLessThan(0.1)
    // Trident II: 455 kt at 120 m against the hardened silo.
    expect(singleShotKill(455, 120, 2_000)).toBeGreaterThan(0.85)
  })

  it('finds the counterforce crossing in the late 1970s for the United States', () => {
    const even = SYSTEMS.filter((s) => s.side === 'us' && singleShotKill(s.yieldKt, s.cepMetres, COUNTERFORCE_PSI) >= 0.5)
    const first = even.sort((a, b) => a.year - b.year)[0]
    expect(first.year).toBeGreaterThanOrEqual(1970)
    expect(first.year).toBeLessThanOrEqual(1986)
    const before = SYSTEMS.filter((s) => s.year < 1966)
    for (const s of before) expect(singleShotKill(s.yieldKt, s.cepMetres, COUNTERFORCE_PSI)).toBeLessThan(0.5)
  })

  it('compounds shots and reliability', () => {
    const one = killProbability(335, 220, 2_000, 1, 0.8)
    const two = killProbability(335, 220, 2_000, 2, 0.8)
    expect(two).toBeGreaterThan(one)
    expect(two).toBeCloseTo(1 - (1 - one) ** 2, 9)
  })
})
