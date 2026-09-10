import { describe, expect, it } from 'vitest'
import { brodeFreeAirBars, brodeScaledDistance, fireballRadiusMetres, fireballTouchesGround, kinneyGrahamScaledDistance, optimumBurstHeightMetres, overpressureRadiusMetres, promptEffects, radiationRadiusMetres, surfaceOverpressureRadiusMetres, tenthRangeMetres, thirdDegreeBurnRadiusMetres } from './blast.ts'

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

describe('the fireball and the ground', () => {
  it('clears the ground at the height that maximises the 5 psi area, and can touch it when the burst is for 20 psi', () => {
    for (const y of [1, 100, 335, 1_100]) {
      expect(fireballTouchesGround(y, optimumBurstHeightMetres(y, 5))).toBe(false)
    }
    // At the high-overpressure end the margin closes: a 335 kt burst for 20 psi sits about one fireball radius up.
    expect(optimumBurstHeightMetres(335, 20) / fireballRadiusMetres(335)).toBeLessThan(1.2)
    expect(fireballTouchesGround(335, 0)).toBe(true)
    expect(fireballTouchesGround(335, 5_000)).toBe(false)
  })
})

describe('the thermal radius against the book itself', () => {
  /**
   * Glasstone, The Effects of Nuclear Weapons, revised edition 1962,
   * Table 12.31: ranges from ground zero for burns to bare skin from air
   * bursts, in miles. The 1977 edition gives the same thing as a graph
   * (Figure 12.65), which is why the 1962 table is the one quoted here.
   * Third-degree burns, the table's own note says, occur at shorter ranges.
   */
  const TABLE_12_31: Array<{ yieldKt: number; firstDegreeMiles: number | null; secondDegreeMiles: number }> = [
    { yieldKt: 1, firstDegreeMiles: 0.7, secondDegreeMiles: 0.5 },
    { yieldKt: 10, firstDegreeMiles: 1.9, secondDegreeMiles: 1.5 },
    { yieldKt: 100, firstDegreeMiles: 5.3, secondDegreeMiles: 4.0 },
    { yieldKt: 1_000, firstDegreeMiles: 14, secondDegreeMiles: 11 },
    // The first-degree range at ten megatonnes is printed as "greater than 30".
    { yieldKt: 10_000, firstDegreeMiles: null, secondDegreeMiles: 24 },
  ]
  const MILE = 1_609.344

  it('falls inside the tabulated second-degree ranges, by the margin a third-degree burn needs', () => {
    for (const row of TABLE_12_31) {
      const ours = thirdDegreeBurnRadiusMetres(row.yieldKt)
      const second = row.secondDegreeMiles * MILE
      expect(ours, `${row.yieldKt} kt is not inside the second-degree range`).toBeLessThan(second)
      expect(ours / second).toBeGreaterThan(0.55)
      if (row.firstDegreeMiles) expect(ours).toBeLessThan(row.firstDegreeMiles * MILE)
    }
  })

  it('scales with yield as the table does, because the same lengthening pulse is behind both', () => {
    const slope = (a: { yieldKt: number; secondDegreeMiles: number }, b: { yieldKt: number; secondDegreeMiles: number }) =>
      Math.log10(b.secondDegreeMiles / a.secondDegreeMiles) / Math.log10(b.yieldKt / a.yieldKt)
    const book = slope(TABLE_12_31[0], TABLE_12_31[TABLE_12_31.length - 1])
    // The book's second-degree ranges go as Y^0.42; this model's radius as Y^0.41.
    expect(book).toBeGreaterThan(0.38)
    expect(book).toBeLessThan(0.46)
    const ours = Math.log10(thirdDegreeBurnRadiusMetres(10_000) / thirdDegreeBurnRadiusMetres(1)) / 4
    expect(Math.abs(ours - book)).toBeLessThan(0.05)
  })
})

describe('the initial radiation against the book', () => {
  it('puts the worked case of §8.34 where the book puts it', () => {
    // "the absorbed dose received at a distance of 2,000 yards from a
    // 50-kiloton low air burst of a fission weapon... somewhat less than 300
    // rads. A reasonable interpolated value would appear to be about 250 rads."
    const YARD = 0.9144
    const ours = radiationRadiusMetres(50, 250) / YARD
    expect(Math.abs(ours - 2_000) / 2_000).toBeLessThan(0.08)
    // And the dose at the book's own distance is inside the band it gives.
    const atTwoThousand = 250 * 10 ** ((radiationRadiusMetres(50, 250) - 2_000 * YARD) / tenthRangeMetres(50))
    expect(atTwoThousand).toBeGreaterThan(150)
    expect(atTwoThousand).toBeLessThan(300)
  })

  it('falls tenfold over a tenth range, which lengthens with yield', () => {
    expect(radiationRadiusMetres(100, 100) - radiationRadiusMetres(100, 1_000)).toBeCloseTo(tenthRangeMetres(100), 6)
    expect(tenthRangeMetres(10_000)).toBeGreaterThan(tenthRangeMetres(1))
  })
})
