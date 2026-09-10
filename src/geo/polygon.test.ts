import { describe, expect, it } from 'vitest'
import { pointInRing } from './polygon.ts'
import outline from '../../data/72-minutes/russia-outline.json'

const RING = outline.ring as Array<[number, number]>

describe('pointInRing', () => {
  it('tells a square inside from out, and straddles the antimeridian', () => {
    const square: Array<[number, number]> = [[170, 60], [190, 60], [190, 70], [170, 70]]
    expect(pointInRing([175, 65], square)).toBe(true)
    expect(pointInRing([-175, 65], square)).toBe(true)
    expect(pointInRing([-165, 65], square)).toBe(false)
    expect(pointInRing([175, 75], square)).toBe(false)
  })

  it('places Russian cities inside the coarse outline and its neighbours outside', () => {
    expect(pointInRing([37.6, 55.75], RING)).toBe(true) // Moscow
    expect(pointInRing([158.6, 53.0], RING)).toBe(true) // Petropavlovsk-Kamchatsky
    expect(pointInRing([176.0, 65.5], RING)).toBe(true) // inland of Anadyr
    expect(pointInRing([30.3, 50.45], RING)).toBe(false) // Kyiv
    expect(pointInRing([71.4, 51.2], RING)).toBe(false) // Astana
    expect(pointInRing([116.4, 39.9], RING)).toBe(false) // Beijing
    expect(pointInRing([125.7, 39.0], RING)).toBe(false) // Pyongyang
    expect(pointInRing([-149.9, 61.2], RING)).toBe(false) // Anchorage
    expect(pointInRing([24.9, 60.2], RING)).toBe(false) // Helsinki
  })
})
