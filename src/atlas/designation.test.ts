import { describe, expect, it } from 'vitest'
import { designate, designationCode, designationRole } from './designation.ts'

describe('designationRole', () => {
  it.each([
    ['shop', 'supermarket', 'SUPPLY NODE'],
    ['railway', 'station', 'TRANSIT HUB'],
    ['railway', 'rail', 'RAIL INFRASTRUCTURE'],
    ['place', 'city', 'POPULATION CENTRE'],
    ['place', 'village', 'SETTLEMENT SECTOR'],
    ['place', 'country', 'ADMINISTRATIVE REGION'],
    ['amenity', 'restaurant', 'RATION POINT'],
    ['amenity', 'hospital', 'MEDICAL FACILITY'],
    ['amenity', 'townhall', 'CIVIC FACILITY'],
    ['natural', 'peak', 'TERRAIN FEATURE'],
    ['natural', 'water', 'HYDROLOGICAL FEATURE'],
    ['military', 'barracks', 'RESTRICTED INSTALLATION'],
    ['information', 'guidepost', 'WAYFINDING MARKER'],
    ['craft', 'brewery', 'POINT OF INTEREST'],
  ])('%s=%s → %s', (key, value, role) => {
    expect(designationRole(key, value)).toBe(role)
  })
})

describe('designationCode', () => {
  it('uses the country and the last four digits of the OSM id', () => {
    expect(designationCode('CH', 3_450_447)).toBe('CH-0447')
    expect(designationCode('GB', 12)).toBe('GB-0012')
  })

  it('is stable for negative or fractional ids and unknown countries', () => {
    expect(designationCode('XX', -447)).toBe('XX-0447')
    expect(designationCode('', 447.9)).toBe('XX-0447')
    expect(designationCode('ch', 447)).toBe('XX-0447')
  })
})

describe('designate', () => {
  it('turns the local Migros into a supply node', () => {
    expect(designate({ osmKey: 'shop', osmValue: 'supermarket', countryCode: 'CH', osmId: 3_450_447 })).toEqual({
      role: 'SUPPLY NODE',
      code: 'CH-0447',
    })
  })
})
