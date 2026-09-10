import { describe, expect, it } from 'vitest'
import { classify } from './solver.ts'
import { describeLandUse, readLandUse, ringAreaKm2 } from './landuse.ts'
import type { AtlasTarget } from './target.ts'

/** A square of the given side in kilometres, centred on a point. */
function square(lon: number, lat: number, km: number, tags: Record<string, string>) {
  const dLat = km / 2 / 110.574
  const dLon = km / 2 / (111.32 * Math.cos((lat * Math.PI) / 180))
  return {
    type: 'way',
    tags,
    geometry: [
      { lat: lat - dLat, lon: lon - dLon },
      { lat: lat - dLat, lon: lon + dLon },
      { lat: lat + dLat, lon: lon + dLon },
      { lat: lat + dLat, lon: lon - dLon },
    ],
  }
}

const target = (key: string, value: string): AtlasTarget => ({ id: 'N:1', osmId: 1, osmType: 'N', osmKey: key, osmValue: value, name: 'Somewhere', label: '', countryCode: 'GB', position: [0, 51] })
const profile = (within10: number, within30: number) => ({ within: { 2000: within10 * 0.2, 5000: within10 * 0.5, 10000: within10, 20000: within30 * 0.7, 30000: within30 }, gridName: 'test' }) as never

describe('reading the ground', () => {
  it('measures a polygon the shoelace way, on the sphere it sits on', () => {
    // A one-kilometre square is a square kilometre, wherever it is.
    const s = square(0, 51, 1, { landuse: 'industrial' })
    expect(ringAreaKm2(s.geometry, 51)).toBeCloseTo(1, 2)
    expect(ringAreaKm2(square(0, 78, 1, {}).geometry, 78)).toBeCloseTo(1, 2)
    expect(ringAreaKm2([{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }], 0)).toBe(0)
  })

  it('sorts the land into classes and names what is on it', () => {
    const land = readLandUse(
      [square(0, 51, 2, { landuse: 'industrial', name: 'Works' }), square(0.05, 51, 1, { landuse: 'residential' }), square(-0.05, 51, 1.4, { landuse: 'farmland' })],
      [0, 51],
      2_500,
    )
    expect(land.industrialKm2).toBeCloseTo(4, 1)
    expect(land.shares.industrial).toBeGreaterThan(0.5)
    expect(land.shares.residential).toBeGreaterThan(0.1)
    expect(land.largest?.name).toBe('Works')
    expect(describeLandUse(land)).toContain('INDUSTRIAL')
  })

  it('counts military land and aerodromes whatever the landuse tag says', () => {
    const land = readLandUse([square(0, 51, 2, { military: 'airfield', name: 'RAF Somewhere' }), square(0, 51.05, 1.5, { aeroway: 'aerodrome' })], [0, 51], 2_500)
    expect(land.militaryKm2).toBeCloseTo(4, 1)
    expect(land.aerodromeKm2).toBeCloseTo(2.25, 1)
    expect(land.shares.military).toBeGreaterThan(0.5)
  })
})

describe('the ground deciding what a place is', () => {
  const untagged = target('place', 'suburb')

  it('finds a barracks the geocoder called a suburb', () => {
    const land = readLandUse([square(0, 51, 1.4, { landuse: 'military' })], [0, 51], 2_500)
    const c = classify(untagged, profile(20_000, 60_000), land)
    expect(c.category).toBe('MILITARY')
    expect(c.hard).toBe(true)
    expect(c.ground).toBe('land use')
  })

  it('tells a works from a housing estate at the same density', () => {
    const works = readLandUse([square(0, 51, 2, { landuse: 'industrial' })], [0, 51], 2_500)
    const houses = readLandUse([square(0, 51, 2, { landuse: 'residential' })], [0, 51], 2_500)
    expect(classify(untagged, profile(60_000, 200_000), works).category).toBe('INDUSTRY')
    expect(classify(untagged, profile(60_000, 200_000), works).countervalue).toBe(false)
    expect(classify(untagged, profile(60_000, 200_000), houses).countervalue).toBe(true)
  })

  it('falls back to the tag and the density when Overpass says nothing, and says so', () => {
    const c = classify(untagged, profile(400_000, 900_000), null)
    expect(c.ground).toBe('tag and density')
    expect(c.category).toBe('URBAN-INDUSTRIAL')
    // An empty answer is not the same as no answer, but it decides nothing either.
    expect(classify(untagged, profile(400_000, 900_000), readLandUse([], [0, 51], 2_500)).ground).toBe('tag and density')
  })

  it('still lets an explicit tag win, because a tag is about this place and the ground is about its surroundings', () => {
    const houses = readLandUse([square(0, 51, 2, { landuse: 'residential' })], [0, 51], 2_500)
    expect(classify(target('military', 'naval_base'), profile(60_000, 200_000), houses).category).toBe('MILITARY')
  })
})
