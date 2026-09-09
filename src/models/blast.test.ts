import { describe, expect, it } from 'vitest'
import { brodeFreeAirBars, brodeScaledDistance, fireballRadiusMetres, kinneyGrahamScaledDistance, overpressureRadiusMetres, surfaceOverpressureRadiusMetres, promptEffects, radiationRadiusMetres, thirdDegreeBurnRadiusMetres } from './blast.ts'

describe('overpressure', () => {
  it('reproduces the FAQ constants at 1 kt', () => {
    expect(overpressureRadiusMetres(1, 5)).toBeCloseTo(710, 0)
    expect(overpressureRadiusMetres(1, 20)).toBeCloseTo(280, 0)
    expect(overpressureRadiusMetres(1, 1)).toBeCloseTo(2_200, 0)
  })
  it('scales by the cube root of yield', () => {
    expect(overpressureRadiusMetres(1_000, 5)).toBeCloseTo(7_100, 0)
    expect(overpressureRadiusMetres(8, 5) / overpressureRadiusMetres(1, 5)).toBeCloseTo(2, 6)
  })
})

describe('fireball', () => {
  it('is 200 feet at 1 kt and about 1.1 km at 1.44 Mt', () => {
    expect(fireballRadiusMetres(1)).toBeCloseTo(60.96, 1)
    expect(fireballRadiusMetres(1_440) / 1_000).toBeGreaterThan(1.0)
    expect(fireballRadiusMetres(1_440) / 1_000).toBeLessThan(1.2)
  })
})

describe('thermal', () => {
  it('matches the FAQ reference table within its stated 10 percent', () => {
    // FAQ §5.6.1.1: third-degree burns at 2.7 km for 20 kt, 12 km for 1 Mt, 39 km for 20 Mt.
    // The FAQ's own fit gives 2.3 km at 20 kt, 15 percent under its table; carried as a known
    // discrepancy in the source rather than tuned away.
    expect(thirdDegreeBurnRadiusMetres(20) / 2_700).toBeGreaterThan(0.8)
    expect(thirdDegreeBurnRadiusMetres(20) / 2_700).toBeLessThan(1.1)
    expect(thirdDegreeBurnRadiusMetres(1_000) / 12_000).toBeGreaterThan(0.9)
    expect(thirdDegreeBurnRadiusMetres(1_000) / 12_000).toBeLessThan(1.1)
    expect(thirdDegreeBurnRadiusMetres(20_000) / 39_000).toBeGreaterThan(0.9)
    expect(thirdDegreeBurnRadiusMetres(20_000) / 39_000).toBeLessThan(1.1)
  })
})

describe('radiation', () => {
  it('gives 700 m for 1000 rad at 1 kt and grows slowly with yield', () => {
    expect(radiationRadiusMetres(1, 1_000)).toBeCloseTo(700, 0)
    expect(radiationRadiusMetres(1_000, 1_000)).toBeCloseTo(0.7 * 1_000 ** 0.19 * 1_000, 0)
  })
  it('extends by one tenth-range per decade of dose', () => {
    expect(radiationRadiusMetres(1, 100) - radiationRadiusMetres(1, 1_000)).toBeCloseTo(330, 0)
  })
})

describe('promptEffects', () => {
  it('orders the rings for a 1.44 Mt weapon as the physics does', () => {
    const rings = promptEffects(1_440).rings
    const radius = (key: string) => rings.find((r) => r.key === key)!.radius
    expect(radius('fireball')).toBeLessThan(radius('psi20'))
    expect(radius('psi20')).toBeLessThan(radius('psi5'))
    expect(radius('psi5')).toBeLessThan(radius('burn3'))
    expect(radius('burn3')).toBeLessThan(radius('psi1'))
    // At megaton yields prompt radiation is dwarfed by blast: the 500 rad ring sits inside 20 psi.
    expect(radius('rad500')).toBeLessThan(radius('psi20'))
  })
})

describe('surface burst', () => {
  it('inverts the Brode fit and agrees with Kinney & Graham within 15 percent over the band', () => {
    for (const bars of [0.2, 0.5, 1, 3]) {
      expect(brodeFreeAirBars(brodeScaledDistance(bars))).toBeCloseTo(bars, 6)
      const ratio = kinneyGrahamScaledDistance(bars) / brodeScaledDistance(bars)
      expect(ratio).toBeGreaterThan(0.85)
      expect(ratio).toBeLessThan(1.15)
    }
  })
  it('nearly matches the optimum air burst at 20 psi and falls well short of it at 1 psi', () => {
    const r20 = surfaceOverpressureRadiusMetres(1, 20) / overpressureRadiusMetres(1, 20)
    const r5 = surfaceOverpressureRadiusMetres(1, 5) / overpressureRadiusMetres(1, 5)
    const r1 = surfaceOverpressureRadiusMetres(1, 1) / overpressureRadiusMetres(1, 1)
    expect(r20).toBeGreaterThan(0.85)
    expect(r20).toBeLessThan(1.1)
    expect(r5).toBeGreaterThan(0.65)
    expect(r5).toBeLessThan(0.9)
    expect(r1).toBeGreaterThan(0.6)
    expect(r1).toBeLessThan(0.85)
    expect(r1).toBeLessThan(r5)
  })
  it('scales with the cube root of yield', () => {
    expect(surfaceOverpressureRadiusMetres(8_000, 5) / surfaceOverpressureRadiusMetres(1_000, 5)).toBeCloseTo(2, 6)
  })
})
