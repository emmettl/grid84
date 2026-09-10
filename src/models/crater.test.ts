import { describe, expect, it } from 'vitest'
import { crater, craterDepthMetres, craterRadiusMetres, ejectaRadiusMetres, lipCrestRadiusMetres, CRATER } from './crater.ts'

const FOOT = 0.3048

describe('the crater, against the book', () => {
  it('reproduces the worked example of §6.09', () => {
    // "the radius of the crater may be expected to be roughly 60 x (100)^0.3 =
    // 240 feet, and the depth about 30 x (100)^0.3 = 120 feet."
    // The book rounds its own arithmetic: 60 × 100^0.3 is 238.9, printed as 240.
    expect(Math.abs(craterRadiusMetres(100) / FOOT - 240)).toBeLessThan(2)
    expect(Math.abs(craterDepthMetres(100) / FOOT - 120)).toBeLessThan(1)
    // And the one-kilotonne anchors it scales from.
    expect(craterRadiusMetres(1) / FOOT).toBeCloseTo(60, 6)
    expect(craterDepthMetres(1) / FOOT).toBeCloseTo(30, 6)
  })

  it('agrees with itself about the lip, which the book states twice in different words', () => {
    // §6.09 puts the crest of the lip about fifteen feet beyond a sixty-foot
    // crater; §6.71 puts it at 1.25 times the radius. Those are the same lip.
    const fromParagraphNine = (CRATER.radiusFeetAtOneKt + CRATER.lipCrestExtraFeetAtOneKt) * FOOT
    expect(lipCrestRadiusMetres(1)).toBeCloseTo(fromParagraphNine, 6)
  })

  it('throws up the material the fallout is made of, and there is no crater without a yield', () => {
    const c = crater(335)
    expect(c.radiusMetres).toBeGreaterThan(100)
    expect(c.radiusMetres).toBeLessThan(120)
    expect(c.depthMetres).toBeCloseTo(c.radiusMetres / 2, 0)
    expect(c.ejectaRadiusMetres).toBeCloseTo(c.radiusMetres * 2.15, 6)
    // A third of a megatonne lifts a few million tonnes of soil.
    expect(c.massTonnes).toBeGreaterThan(1e6)
    expect(c.massTonnes).toBeLessThan(1e7)
    expect(crater(0).radiusMetres).toBe(0)
    expect(ejectaRadiusMetres(0)).toBe(0)
  })

  it('scales every dimension by the same power, as the book says it does', () => {
    const ratio = craterRadiusMetres(1_000) / craterRadiusMetres(1)
    expect(Math.log10(ratio) / 3).toBeCloseTo(CRATER.exponent, 6)
    expect(craterDepthMetres(1_000) / craterDepthMetres(1)).toBeCloseTo(ratio, 6)
  })
})
