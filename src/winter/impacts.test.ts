import { describe, expect, it } from 'vitest'
import { SOOT_CASES } from '../models/soot.ts'
import { impactCentre, impactPoints, impactSummary, REGIONAL_REACH_KM } from './impacts.ts'

describe('where the fires are', () => {
  it('marks a city for every weapon of every case', () => {
    for (const c of SOOT_CASES) {
      const fc = impactPoints(c.id)
      expect(fc.features.length, c.id).toBeGreaterThan(0)
      for (const f of fc.features) {
        const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates
        expect(Math.abs(lon), c.id).toBeLessThanOrEqual(180)
        expect(Math.abs(lat), c.id).toBeLessThanOrEqual(90)
        expect(Number(f.properties?.population), c.id).toBeGreaterThan(0)
      }
      expect(impactSummary(c.id).cities).toBe(fc.features.length)
    }
  })

  /**
   * The camera turns the globe to face a regional war and leaves a global one
   * alone, and the difference is decided here rather than by a list of case
   * ids — so the two sides of it are checked against the marks themselves.
   */
  it('puts the subcontinental cases in the subcontinent, within a reach the globe can face', () => {
    for (const c of SOOT_CASES.filter((x) => x.id.startsWith('regional'))) {
      const { centre, reachKm } = impactCentre(c.id)
      expect(centre[0], `${c.id} longitude`).toBeGreaterThan(65)
      expect(centre[0], `${c.id} longitude`).toBeLessThan(90)
      expect(centre[1], `${c.id} latitude`).toBeGreaterThan(15)
      expect(centre[1], `${c.id} latitude`).toBeLessThan(35)
      expect(reachKm, `${c.id} reach`).toBeLessThan(REGIONAL_REACH_KM)
    }
  })

  it('finds the global case has no face to turn to', () => {
    const { reachKm } = impactCentre('global-150')
    // Los Angeles to Vladivostok: no camera frames both, and the threshold says so.
    expect(reachKm).toBeGreaterThan(REGIONAL_REACH_KM * 2)
  })

  it('averages on the sphere, so a set straddling the meridian does not centre on the wrong side of the world', () => {
    // The global case spans the Pacific; a naive mean of longitudes would put
    // its centre in the Atlantic rather than over Siberia.
    const { centre } = impactCentre('global-150')
    expect(centre[0]).toBeGreaterThan(0)
    expect(centre[1]).toBeGreaterThan(40)
  })
})
