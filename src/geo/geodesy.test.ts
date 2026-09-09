import { describe, expect, it } from 'vitest'
import { formatBearing, formatGrid, formatRange, haversineMetres, initialBearing } from './geodesy.ts'

const ZURICH_HB = [8.5402, 47.3782] as const
const BERN = [7.4391, 46.9489] as const
const LONDON = [-0.1276, 51.5072] as const
const NEW_YORK = [-74.006, 40.7128] as const

describe('haversineMetres', () => {
  it('is zero for coincident points', () => {
    expect(haversineMetres(ZURICH_HB, ZURICH_HB)).toBe(0)
  })

  it('measures Zürich HB to Bern within a percent of the reference distance', () => {
    // Reference: 96.0 km great-circle from the coordinate deltas (47.7 km N–S, 83.3 km E–W).
    expect(haversineMetres(ZURICH_HB, BERN)).toBeCloseTo(96_000, -3)
  })

  it('measures London to New York at ~5,570 km', () => {
    expect(haversineMetres(LONDON, NEW_YORK) / 1000).toBeCloseTo(5_570, -1)
  })

  it('is symmetric', () => {
    expect(haversineMetres(LONDON, NEW_YORK)).toBeCloseTo(haversineMetres(NEW_YORK, LONDON), 6)
  })
})

describe('initialBearing', () => {
  it('points north along a meridian', () => {
    expect(initialBearing([0, 0], [0, 10])).toBeCloseTo(0, 6)
  })

  it('points east along the equator', () => {
    expect(initialBearing([0, 0], [10, 0])).toBeCloseTo(90, 6)
  })

  it('normalizes westward bearings into 0–360', () => {
    const bearing = initialBearing([0, 0], [-10, 0])
    expect(bearing).toBeCloseTo(270, 6)
    expect(bearing).toBeGreaterThanOrEqual(0)
    expect(bearing).toBeLessThan(360)
  })

  it('heads south-west from Zürich towards Bern', () => {
    const bearing = initialBearing(ZURICH_HB, BERN)
    expect(bearing).toBeGreaterThan(235)
    expect(bearing).toBeLessThan(250)
  })
})

describe('formatting', () => {
  it('formats ranges by magnitude', () => {
    expect(formatRange(420)).toBe('420 M')
    expect(formatRange(14_720)).toBe('14.7 KM')
    expect(formatRange(5_570_400)).toBe('5,570 KM')
    expect(formatRange(Number.NaN)).toBe('—')
  })

  it('zero-pads bearings to three digits', () => {
    expect(formatBearing(7.4)).toBe('007°')
    expect(formatBearing(-90)).toBe('270°')
    expect(formatBearing(359.6)).toBe('000°')
  })

  it('formats grid references with hemispheres', () => {
    expect(formatGrid(ZURICH_HB)).toBe('47.3782 N · 008.5402 E')
    expect(formatGrid(NEW_YORK)).toBe('40.7128 N · 074.0060 W')
    expect(formatGrid([151.2093, -33.8688])).toBe('33.8688 S · 151.2093 E')
  })
})
