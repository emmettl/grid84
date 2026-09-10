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
  it('carries the real postal code with the country, and nothing when there is none', () => {
    expect(designationCode('CH', '8001')).toBe('CH-8001')
    expect(designationCode('GB', 'SW1A 2AA')).toBe('GB-SW1A')
    expect(designationCode('CH', undefined)).toBe('')
    expect(designationCode('CH', '  ')).toBe('')
    expect(designationCode('XX', '75001')).toBe('75001')
    expect(designationCode('', '8001')).toBe('8001')
  })
})

describe('designate', () => {
  it('turns the local Migros into a supply node with its postcode, and a city without one into its role alone', () => {
    expect(designate({ osmKey: 'shop', osmValue: 'supermarket', countryCode: 'CH', postcode: '8001' })).toEqual({ role: 'SUPPLY NODE', code: 'CH-8001' })
    expect(designate({ osmKey: 'place', osmValue: 'city', countryCode: 'CH' })).toEqual({ role: 'POPULATION CENTRE', code: '' })
  })
})
