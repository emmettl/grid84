import { describe, expect, it } from 'vitest'
import { haversineMetres } from '../geo/geodesy.ts'
import { radiusForPsi } from '../models/casualties.ts'
import { laydown } from './union.ts'

describe('WOPR laydown', () => {
  it('puts one weapon on the centre and spreads the rest so the 5 psi rings about meet', () => {
    expect(laydown([37.62, 55.75], 1, 335)).toEqual([[37.62, 55.75]])
    const pts = laydown([37.62, 55.75], 8, 335)
    expect(pts).toHaveLength(8)
    expect(pts[0]).toEqual([37.62, 55.75])
    const r5 = radiusForPsi(335, 5, 'air')
    let nearest = Infinity
    for (let i = 0; i < pts.length; i += 1) for (let j = i + 1; j < pts.length; j += 1) nearest = Math.min(nearest, haversineMetres(pts[i], pts[j]))
    expect(nearest).toBeGreaterThan(r5 * 0.8)
    expect(nearest).toBeLessThan(r5 * 3)
    const far = Math.max(...pts.map((p) => haversineMetres(p, [37.62, 55.75])))
    expect(far).toBeLessThan(r5 * 6)
  })
})
