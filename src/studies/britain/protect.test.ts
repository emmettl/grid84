import { describe, expect, it } from 'vitest'
import { BRITAIN_DOCUMENTED, britainSquareLeg, britainStrath } from './protect.ts'

describe('Square Leg, 1980', () => {
  it('drops the documented number of ground and air bursts and leaves inner London alone', () => {
    const study = britainSquareLeg()
    const effects = study.entities.filter((e) => e.kind === 'effect')
    const ground = effects.filter((e) => e.kind === 'effect' && e.burst === 'surface')
    const air = effects.filter((e) => e.kind === 'effect' && e.burst === 'air')
    const weapons = study.entities.filter((e) => e.kind === 'track' && /^sl[ga]-s-/.test(e.id)).length
    expect(weapons).toBe(BRITAIN_DOCUMENTED.weapons.groundBursts + BRITAIN_DOCUMENTED.weapons.airBursts)
    expect(ground.length).toBeGreaterThan(40)
    expect(air.length).toBeGreaterThan(50)
    expect(ground.every((e) => e.kind === 'effect' && e.fallout?.downwindBearingDeg === 0)).toBe(true)
    expect(effects.some((e) => e.kind === 'effect' && Math.abs(e.center[0] + 0.1251) < 0.01 && Math.abs(e.center[1] - 51.5416) < 0.01)).toBe(false)
    // Timing: the first strike inside ten minutes, the second between one and three hours.
    for (const g of ground) expect(g.kind === 'effect' && g.time).toBeLessThan(12 * 60)
    for (const a of air) {
      expect(a.kind === 'effect' && a.time).toBeGreaterThan(3_500)
      expect(a.kind === 'effect' && a.time).toBeLessThan(3 * 3_600 + 600)
    }
    expect(study.defaultBurst).toBe('surface')
    expect(study.populationGrid).toBe('ghsl/popc_1985')
    expect(study.entities.filter((e) => e.kind === 'site' && e.evidence === 'withheld').length).toBeGreaterThan(50)
    console.log('SQUARE LEG', ground.length, 'ground', air.length, 'air', 'entities', study.entities.length)
  })
})

describe('Strath, 1955', () => {
  it('drops ten 10 Mt ground bursts on the 1950 grid', () => {
    const study = britainStrath()
    const effects = study.entities.filter((e) => e.kind === 'effect')
    expect(effects).toHaveLength(10)
    expect(effects.every((e) => e.kind === 'effect' && e.burst === 'surface' && e.effects.yieldKt === 10_000)).toBe(true)
    expect(study.populationGrid).toBe('popc_1950')
    expect(study.outcomeReference?.value).toBe(12_000_000)
  })
})
