import { describe, expect, it } from 'vitest'
import { haversineMetres, initialBearing } from './geodesy.ts'
import { destinationPoint, sectorRing } from './sector.ts'

describe('destinationPoint', () => {
  it('lands at the range on the bearing', () => {
    const from: [number, number] = [-68.3, 76.57]
    const to = destinationPoint(from, 0, 1_000_000)
    expect(haversineMetres(from, to)).toBeCloseTo(1_000_000, -2)
    expect(to[1]).toBeGreaterThan(76.57)
    const east = destinationPoint([0, 0], 90, 500_000)
    expect(initialBearing([0, 0], east)).toBeCloseTo(90, 0)
  })
})

describe('sectorRing', () => {
  it('closes through the site for a sector and around itself for a circle', () => {
    const s = sectorRing([-149.18, 64.29], 0, 240, 4_800_000, 24)
    expect(s[0]).toEqual([-149.18, 64.29])
    expect(s[s.length - 1]).toEqual([-149.18, 64.29])
    expect(s.length).toBe(27)
    const c = sectorRing([-0.67, 54.36], 0, 360, 4_800_000, 24)
    expect(c[0]).toEqual(c[c.length - 1])
    expect(c.length).toBe(26)
  })

  it('stays in one piece across the antimeridian', () => {
    const s = sectorRing([174.09, 52.74], 290, 120, 3_000_000, 24)
    for (let i = 1; i < s.length; i += 1) expect(Math.abs(s[i][0] - s[i - 1][0])).toBeLessThan(180)
  })
})
