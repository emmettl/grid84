import { describe, expect, it } from 'vitest'
import { haversineMetres } from '../geo/geodesy.ts'
import { greatCirclePoints, slerp, timeByGroundSpeed, Track, unwrapAntimeridian } from './track.ts'

describe('slerp', () => {
  it('returns the endpoints at 0 and 1 and the midpoint on the great circle', () => {
    const a = [0, 0] as const
    const b = [90, 0] as const
    expect(slerp(a, b, 0)[0]).toBeCloseTo(0, 6)
    expect(slerp(a, b, 1)[0]).toBeCloseTo(90, 6)
    expect(slerp(a, b, 0.5)[0]).toBeCloseTo(45, 6)
    // London to New York midpoint lies well north of both, as great circles do.
    const mid = slerp([-0.1276, 51.5072], [-74.006, 40.7128], 0.5)
    expect(mid[1]).toBeGreaterThan(51.5)
  })
})

describe('unwrapAntimeridian', () => {
  it('keeps a Warren to Anadyr line continuous across 180°', () => {
    const points = greatCirclePoints([-104.867, 41.133], [177.467, 64.733])
    for (let i = 1; i < points.length; i += 1) expect(Math.abs(points[i][0] - points[i - 1][0])).toBeLessThan(30)
    expect(unwrapAntimeridian([[170, 0], [-170, 0]])[1][0]).toBe(190)
  })
})

describe('Track', () => {
  const track = new Track(timeByGroundSpeed([[0, 0], [0, 1], [0, 2]], 100, 100))
  it('times waypoints by ground speed', () => {
    const legSeconds = haversineMetres([0, 0], [0, 1]) / 100
    expect(track.waypoints[1].time).toBeCloseTo(100 + legSeconds, 3)
    expect(track.end).toBeCloseTo(100 + 2 * legSeconds, 3)
  })
  it('is absent outside its window and interpolates inside it', () => {
    expect(track.positionAt(0)).toBeNull()
    expect(track.positionAt(track.end + 1)).toBeNull()
    const mid = track.positionAt((track.start + track.end) / 2)!
    expect(mid[1]).toBeCloseTo(1, 3)
    expect(track.progressAt(track.start)).toBe(0)
    expect(track.progressAt(track.end)).toBe(1)
  })
})

describe('geometryUntil', () => {
  it('reveals the path progressively and ends at the current position', () => {
    const track = new Track([
      { position: [0, 0], time: 0 },
      { position: [10, 0], time: 100 },
    ])
    expect(track.geometryUntil(-1)).toEqual([])
    const half = track.geometryUntil(50)
    expect(half[half.length - 1][0]).toBeCloseTo(5, 6)
    // Points scale with the distance flown: about one per 250 km, at least three for a 550 km half leg.
    expect(half.length).toBeGreaterThanOrEqual(3)
    expect(half.length).toBeLessThan(10)
    expect(track.geometryUntil(1_000).length).toBe(track.geometry().length)
  })
})
