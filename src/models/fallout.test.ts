import { describe, expect, it } from 'vitest'
import { accumulatedDose, acuteMortality, contourDimensions, contourRing, decayRatio, plume, TABLE_9_93, windFactor } from './fallout.ts'

const MILE = 1_609.344

describe('Table 9.93', () => {
  it('reproduces the worked example in §9.99: 10 Mt at 30 mph puts the 1,000 rads/hr tip about 100 miles downwind', () => {
    // §9.99: "1,800 rads/hr at 100 miles, 620 rads/hr at 200 miles, and 360 rads/hr at 300 miles" by interpolation between rows.
    const F = windFactor(30)
    expect(F).toBeCloseTo(1.25, 6)
    const d1000 = contourDimensions(TABLE_9_93[1], 10_000, 1, 30).downwindMetres / MILE
    const d300 = contourDimensions(TABLE_9_93[2], 10_000, 1, 30).downwindMetres / MILE
    const d3000 = contourDimensions(TABLE_9_93[0], 10_000, 1, 30).downwindMetres / MILE
    expect(d3000).toBeLessThan(100)
    expect(d1000).toBeGreaterThan(100)
    expect(d1000).toBeLessThan(200)
    expect(d300).toBeGreaterThan(300)
  })

  it('scales dose rates with the fission fraction and distances with the wind', () => {
    const half = contourDimensions(TABLE_9_93[1], 1_000, 0.5, 15)
    const full = contourDimensions(TABLE_9_93[1], 1_000, 1, 15)
    expect(half.radsPerHour).toBe(500)
    expect(half.downwindMetres).toBe(full.downwindMetres)
    expect(contourDimensions(TABLE_9_93[1], 1_000, 1, 45).downwindMetres / full.downwindMetres).toBeCloseTo(1.5, 6)
    expect(windFactor(8)).toBeCloseTo(1 - 7 / 30, 6)
  })
})

describe('decay', () => {
  it('matches Table 9.19 within the stated 25 percent', () => {
    const table: Array<[number, number]> = [[1, 1000], [2, 400], [3, 230], [6, 100], [10, 63], [24, 23], [48, 10], [100, 4.0], [200, 1.7], [400, 0.69]]
    for (const [hours, relative] of table) {
      const ratio = (decayRatio(hours) * 1000) / relative
      expect(ratio).toBeGreaterThan(0.75)
      expect(ratio).toBeLessThan(1.25)
    }
  })

  it('integrates the decay law for the accumulated dose', () => {
    // From 1 h to infinity the dose is 5 × R1; from 1 h to 49 h it is about 2.7 × R1.
    expect(accumulatedDose(100, 1, 1e40)).toBeCloseTo(500, 0)
    expect(accumulatedDose(100, 1, 49) / 100).toBeGreaterThan(2.6)
    expect(accumulatedDose(100, 1, 49) / 100).toBeLessThan(2.8)
    expect(accumulatedDose(100, 4, 2)).toBe(0)
  })
})

describe('acuteMortality', () => {
  it('follows Table 12.108', () => {
    expect(acuteMortality(150)).toBe(0)
    expect(acuteMortality(400)).toBeCloseTo(0.45, 6)
    expect(acuteMortality(600)).toBeCloseTo(0.9, 6)
    expect(acuteMortality(1_200)).toBe(1)
  })
})

describe('contourRing and plume', () => {
  it('draws a closed ring whose extent matches the dimensions and points downwind', () => {
    const dims = contourDimensions(TABLE_9_93[3], 1_000, 0.5, 15)
    const ring = contourRing([0, 0], dims, 90)
    expect(ring[0]).toEqual(ring[ring.length - 1])
    const lons = ring.map((p) => p[0])
    const east = Math.max(...lons) * 111_320
    const west = -Math.min(...lons) * 111_320
    expect(east / dims.downwindMetres).toBeGreaterThan(0.98)
    expect(east / dims.downwindMetres).toBeLessThan(1.02)
    expect(west / dims.upwindMetres).toBeGreaterThan(0.9)
    expect(west / dims.upwindMetres).toBeLessThan(1.1)
    const lats = ring.map((p) => p[1] * 111_320)
    expect((Math.max(...lats) - Math.min(...lats)) / dims.maxWidthMetres).toBeGreaterThan(0.95)
    expect((Math.max(...lats) - Math.min(...lats)) / dims.maxWidthMetres).toBeLessThan(1.05)
  })

  it('produces eight nested contours with rising arrival times and falling doses outward', () => {
    const p = plume({ center: [30, 60], yieldKt: 1_440, fissionFraction: 0.5, windMph: 15, downwindBearingDeg: 45, untilHours: 96 })
    expect(p).toHaveLength(8)
    for (let i = 1; i < p.length; i += 1) {
      expect(p[i].downwindMetres).toBeGreaterThan(p[i - 1].downwindMetres)
      expect(p[i].arrivalTipHours).toBeGreaterThan(p[i - 1].arrivalTipHours)
      expect(p[i].doseMidRads).toBeLessThan(p[i - 1].doseMidRads)
    }
    expect(p[0].mortalityMid).toBe(1)
  })
})
