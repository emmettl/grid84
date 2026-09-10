import { describe, expect, it } from 'vitest'
import { carteBlanche, carteBlancheArithmetic, laydown } from './carte-blanche.ts'

describe('Carte Blanche', () => {
  it('lays down the documented number of weapons by the stated rule', () => {
    const a = carteBlancheArithmetic()
    expect(a.weapons).toBe(335)
    expect(a.airfields).toBe(40)
    // Two on each airfield, the rest on the cells; the marks are the aim points, not the weapons.
    expect(a.marks).toBe(a.airfields + a.urban)
    expect(a.urban).toBe(335 - 40 * 2)
    expect(laydown().filter((m) => m.category === 'AIRFIELD')).toHaveLength(40)
  })
  it('sets the engine against the exercise\'s own estimate and says the ground zeros are not published', () => {
    const s = carteBlanche()
    expect(s.outcomeReference?.value).toBe(1_700_000)
    expect(s.outcomeReference?.label).toMatch(/exercise/)
    expect(s.populationGrid).toBe('popc_1951')
    expect(s.omissions.some((o) => /target list is not published/.test(o))).toBe(true)
    const effects = s.entities.filter((e) => e.kind === 'effect')
    expect(effects).toHaveLength(carteBlancheArithmetic().marks)
    // Every mark carries the withheld fact that the exercise's own ground zeros are not known.
    expect(effects.every((e) => e.facts.some((f) => f.evidence === 'withheld'))).toBe(true)
    // They arrive in order over the study's hour.
    const times = effects.map((e) => (e.kind === 'effect' ? e.time : 0))
    expect(times[0]).toBe(0)
    expect(Math.max(...times)).toBeLessThanOrEqual(60 * 60)
  })
})
