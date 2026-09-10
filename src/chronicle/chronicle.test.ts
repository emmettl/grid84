import { describe, expect, it } from 'vitest'
import stockpiles from '../../data/chronicle/stockpiles.json'
import posture from '../../data/chronicle/posture.json'

describe('chronicle data', () => {
  it('carries a contiguous stockpile series for every state with its citation', () => {
    const s = stockpiles as { years: [number, number]; source: string; licence: string; series: Record<string, Array<[number, number]>> }
    expect(s.source).toMatch(/Federation of American Scientists/)
    expect(s.licence).toMatch(/CC BY/)
    for (const [name, points] of Object.entries(s.series)) {
      expect(points[0][0], name).toBe(s.years[0])
      expect(points[points.length - 1][0], name).toBe(s.years[1])
      for (let i = 1; i < points.length; i += 1) expect(points[i][0] - points[i - 1][0], name).toBe(1)
      for (const [, v] of points) expect(v).toBeGreaterThanOrEqual(0)
    }
    const world1986 = Object.values(s.series).reduce((t, pts) => t + (pts.find(([y]) => y === 1986)?.[1] ?? 0), 0)
    expect(world1986).toBeGreaterThan(60_000)
  })

  it('orders the posture epochs by year with totals that match their sites', () => {
    const p = posture as { epochs: Array<{ year: number; scope: string; sides: Record<string, string>; sites: Array<{ side: string; weapons: number; lon: number; lat: number; evidence: string; source: string }>; totals: Record<string, { sites: number; weapons: number }>; study: string }> }
    const years = p.epochs.map((e) => e.year)
    expect(years).toEqual([...years].sort((a, b) => a - b))
    expect(years).toContain(1956)
    expect(years).toContain(1991)
    for (const e of p.epochs) {
      for (const [side, t] of Object.entries(e.totals)) {
        const sites = e.sites.filter((s) => s.side === side)
        expect(sites.length, `${e.year} ${side}`).toBe(t.sites)
        expect(sites.reduce((n, s) => n + s.weapons, 0), `${e.year} ${side}`).toBe(t.weapons)
        expect(e.sides[side], `${e.year} ${side} named`).toBeTruthy()
      }
      for (const s of e.sites) {
        expect(Math.abs(s.lat)).toBeLessThanOrEqual(90)
        expect(Math.abs(s.lon)).toBeLessThanOrEqual(180)
        expect(['documented', 'reconstructed', 'inferred', 'modelled', 'withheld']).toContain(s.evidence)
        expect(s.source.length).toBeGreaterThan(0)
      }
      if (e.scope === 'strategic' && e.year !== 1991 && e.year !== 1956) expect(e.study).toMatch(/^#\/study\//)
    }
  })
})
