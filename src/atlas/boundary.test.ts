import { describe, expect, it } from 'vitest'
import { extentRing, ringsOf } from './boundary.ts'

describe('the target boundary', () => {
  it('takes the outer rings of polygons and multipolygons and nothing else', () => {
    expect(ringsOf({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]], [[0.2, 0.2], [0.3, 0.2], [0.3, 0.3], [0.2, 0.2]]] })).toEqual([[[0, 0], [1, 0], [1, 1], [0, 0]]])
    expect(ringsOf({ type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[5, 5], [6, 5], [6, 6], [5, 5]]]] })).toHaveLength(2)
    expect(ringsOf({ type: 'Point', coordinates: [1, 2] })).toEqual([])
    expect(ringsOf(null)).toEqual([])
  })
  it('turns the geocoder extent into a closed box', () => {
    const r = extentRing([8.4, 47.5, 8.7, 47.3])
    expect(r).toHaveLength(5)
    expect(r[0]).toEqual([8.4, 47.3])
    expect(r[4]).toEqual(r[0])
  })
})
