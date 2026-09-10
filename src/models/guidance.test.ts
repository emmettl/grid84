import { describe, expect, it } from 'vitest'
import { budget, CEP_PER_SIGMA, PRESETS } from './guidance.ts'

describe('guidance error budget', () => {
  it('sums the terms in quadrature and converts to a CEP', () => {
    const b = budget(PRESETS[0].terms)
    const rss = Math.sqrt(b.lines.reduce((s, l) => s + l.sigma ** 2, 0))
    expect(b.sigma).toBeCloseTo(rss, 6)
    expect(b.cep).toBeCloseTo(rss * CEP_PER_SIGMA, 6)
    expect(b.lines.reduce((s, l) => s + l.share, 0)).toBeCloseTo(1, 6)
  })

  it('reproduces each published CEP within a quarter', () => {
    for (const p of PRESETS) {
      const b = budget(p.terms)
      expect(Math.abs(b.cep - p.publishedCepMetres) / p.publishedCepMetres).toBeLessThan(0.25)
    }
  })

  it('grows with the hours since the last fix, and the star sight takes the boat out of the sum', () => {
    const a1 = PRESETS[0].terms
    const fresh = budget({ ...a1, hoursSinceFix: 0 }).cep
    const stale = budget({ ...a1, hoursSinceFix: 24 }).cep
    expect(stale).toBeGreaterThan(fresh * 1.5)
    const sighted = budget({ ...a1, hoursSinceFix: 24, starSight: true, starSightRemoves: 0.9 }).cep
    expect(sighted).toBeLessThan(fresh)
    // In 1960 the boat is most of the miss.
    const first = budget(a1)
    const boat = first.lines.filter((l) => l.key === 'position' || l.key === 'alignment' || l.key === 'velocity').reduce((s, l) => s + l.share, 0)
    expect(boat).toBeGreaterThan(0.6)
  })
})
