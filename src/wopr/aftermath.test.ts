import { describe, expect, it } from 'vitest'
import { aftermathOf, aftermathWorld, SOOT_PER_DEAD_KG, sootOf } from './aftermath.ts'

describe('the aftermath of a plan', () => {
  it('turns the fires the matrix already counted into soot, at Toon\'s own rate', () => {
    expect(SOOT_PER_DEAD_KG).toBeGreaterThan(140)
    expect(SOOT_PER_DEAD_KG).toBeLessThan(160)
    // The first runs of the search settle near 212 million dead, 115 of them American.
    const soot = sootOf({ usDead: 115e6, suDead: 97e6 })
    expect(soot.total).toBeGreaterThan(25)
    expect(soot.total).toBeLessThan(35)
    // Half of it is the enemy's strike on American cities, which no American plan changes.
    expect(soot.fromSoviet / soot.total).toBeGreaterThan(0.5)
  })

  it('runs the published chain on the world of 1983 and finds the famine larger than the war', () => {
    const world = aftermathWorld()
    expect(world.year).toBe(1983)
    expect(world.population).toBeGreaterThan(4.5e9)
    expect(world.population).toBeLessThan(5e9)
    const a = aftermathOf({ usDead: 115e6, suDead: 97e6 })
    expect(a.peakAnomaly).toBeLessThan(-3)
    expect(a.harvestYear2).toBeLessThan(0.8)
    // More people outside the food system than the weapons killed, on a fifth of the soot of a full countervalue exchange.
    expect(a.withoutFood).toBeGreaterThan(212e6)
    expect(a.withoutFood).toBeLessThan(world.population)
  })

  it('is monotone in the dead, and saturates where the published curve does', () => {
    const small = aftermathOf({ usDead: 20e6, suDead: 20e6 })
    const large = aftermathOf({ usDead: 300e6, suDead: 300e6 })
    expect(large.sootTg).toBeGreaterThan(small.sootTg)
    expect(large.withoutFood).toBeGreaterThan(small.withoutFood)
    expect(large.peakAnomaly).toBeLessThan(small.peakAnomaly)
    // A plan that kills nobody puts nothing up.
    expect(aftermathOf({ usDead: 0, suDead: 0 }).sootTg).toBe(0)
    expect(aftermathOf({ usDead: 0, suDead: 0 }).withoutFood).toBe(0)
  })
})
