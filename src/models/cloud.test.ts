import { describe, expect, it } from 'vitest'
import { CLOUD, cloudRadiusMetres, cloudTopMetres, falloutRegime, stabilisedCloud, tropopauseMetres } from './cloud.ts'

describe('the stabilized cloud', () => {
  /**
   * The fit is anchored at one kilotonne by construction: LW = 0, so both
   * polynomials vanish and the coefficients are read straight off.
   */
  it('is 3 km tall and 0.6 km across the head at one kilotonne', () => {
    expect(cloudTopMetres(1)).toBeCloseTo(3_000, 6)
    expect(cloudRadiusMetres(1)).toBeCloseTo(600, 6)
  })

  /**
   * The cases Glasstone's own text describes, to within the width of a line
   * on a log-log figure. A megatonne cloud tops out around 20 km, which is
   * the 65,000 feet of the test reports; Hiroshima's 15 kt cloud was
   * photographed at about 6 km.
   */
  it('puts a megatonne cloud at about 20 km and a 15 kt cloud at about 6.6 km', () => {
    expect(cloudTopMetres(1_000) / 1_000).toBeGreaterThan(19)
    expect(cloudTopMetres(1_000) / 1_000).toBeLessThan(21)
    expect(cloudTopMetres(15) / 1_000).toBeGreaterThan(6)
    expect(cloudTopMetres(15) / 1_000).toBeLessThan(7.2)
  })

  it('grows with yield in both dimensions, monotonically, across the fitted range', () => {
    let lastTop = 0
    let lastRadius = 0
    for (const kt of [0.5, 1, 5, 15, 20, 50, 100, 300, 1_000, 5_000, 15_000, 50_000]) {
      const top = cloudTopMetres(kt)
      const radius = cloudRadiusMetres(kt)
      expect(top, `${kt} kt top`).toBeGreaterThan(lastTop)
      expect(radius, `${kt} kt radius`).toBeGreaterThan(lastRadius)
      lastTop = top
      lastRadius = radius
    }
  })

  /**
   * §2.16 says the height curve flattens between about 20 and 100 kilotonnes,
   * and that the tropopause is why. The test is on the local slope
   * dlnH/dlnW: it should rise to a maximum below 20 kt and then fall right
   * through the band the book names. That kink is the tropopause in the data,
   * and it is the reason this file exists.
   */
  it('carries the tropopause flattening the figure describes', () => {
    const slope = (kt: number) =>
      (Math.log(cloudTopMetres(kt * 1.05)) - Math.log(cloudTopMetres(kt / 1.05))) / Math.log(1.05 ** 2)
    expect(slope(12)).toBeGreaterThan(slope(1))
    for (const [a, b] of [
      [20, 30],
      [30, 50],
      [50, 70],
      [70, 100],
    ]) {
      expect(slope(b), `${a} → ${b} kt should be slackening`).toBeLessThan(slope(a))
    }
    expect(slope(100)).toBeLessThan(slope(15) * 0.9)
  })

  it('has no cloud at all for no weapon', () => {
    expect(cloudTopMetres(0)).toBe(0)
    expect(cloudRadiusMetres(-1)).toBe(0)
  })
})

describe('what the cloud decides', () => {
  it('keeps a tactical weapon under the tropopause and puts a city weapon through it', () => {
    expect(stabilisedCloud(1).penetratesTropopause).toBe(false)
    expect(stabilisedCloud(15).penetratesTropopause).toBe(false)
    expect(stabilisedCloud(300).penetratesTropopause).toBe(true)
    expect(stabilisedCloud(1_000).penetratesTropopause).toBe(true)
  })

  it('says which fallout problem each one is', () => {
    expect(falloutRegime(stabilisedCloud(15))).toContain('troposphere')
    expect(falloutRegime(stabilisedCloud(15))).toContain('plume')
    expect(falloutRegime(stabilisedCloud(1_000))).toContain('stratosphere')
    expect(falloutRegime(stabilisedCloud(1_000))).toContain('does not model')
  })

  /**
   * Glasstone gives the half-the-top rule only for a head that stays below
   * the tropopause. Above it the book says nothing, so neither does this.
   */
  it('gives the base of the head only where Glasstone gives a rule for it', () => {
    const small = stabilisedCloud(15)
    expect(small.baseMetres).toBeCloseTo(small.topMetres * 0.5, 6)
    expect(stabilisedCloud(1_000).baseMetres).toBeNull()
  })

  it('narrows the stem against the head as the yield rises, as §2.17 describes', () => {
    const small = stabilisedCloud(10)
    const large = stabilisedCloud(1_000)
    expect(small.stemRadiusMetres[1] / small.radiusMetres).toBeCloseTo(CLOUD.stemFractionSmall, 6)
    expect(large.stemRadiusMetres[1] / large.radiusMetres).toBeLessThan(small.stemRadiusMetres[1] / small.radiusMetres)
  })

  it('marks the yields where the curves have run past every test', () => {
    expect(stabilisedCloud(50_000).extrapolated).toBe(false)
    expect(stabilisedCloud(100_000).extrapolated).toBe(true)
  })

  /** A borderline cloud is a borderline cloud: the same weapon answers differently by latitude. */
  it('moves the threshold with the tropopause, which moves with latitude', () => {
    expect(tropopauseMetres(0)).toBeCloseTo(17_000, 6)
    expect(tropopauseMetres(90)).toBeCloseTo(8_000, 6)
    expect(tropopauseMetres(45)).toBeGreaterThan(tropopauseMetres(60))
    expect(stabilisedCloud(100, 70).penetratesTropopause).toBe(true)
    expect(stabilisedCloud(100, 0).penetratesTropopause).toBe(false)
  })
})
