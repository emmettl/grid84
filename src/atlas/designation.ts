import type { AtlasTarget } from './target.ts'

/**
 * Strategic designation for a real place. The role is derived from the
 * OpenStreetMap tag the geocoder matched; the code is deterministic from the
 * OSM identity, so the same Migros is always the same SUPPLY NODE.
 */
export interface Designation {
  role: string
  code: string
}

const oneOf = (value: string, ...values: string[]): boolean => values.includes(value)

export function designationRole(osmKey: string, osmValue: string): string {
  switch (osmKey) {
    case 'shop':
      return 'SUPPLY NODE'
    case 'railway':
      return oneOf(osmValue, 'station', 'halt', 'stop', 'tram_stop', 'subway_entrance')
        ? 'TRANSIT HUB'
        : 'RAIL INFRASTRUCTURE'
    case 'public_transport':
      return 'TRANSIT HUB'
    case 'aeroway':
      return 'AIR FACILITY'
    case 'place':
      if (oneOf(osmValue, 'city', 'town')) return 'POPULATION CENTRE'
      if (oneOf(osmValue, 'country', 'state', 'region', 'province', 'county', 'district'))
        return 'ADMINISTRATIVE REGION'
      if (osmValue === 'house') return 'STRUCTURE'
      if (oneOf(osmValue, 'island', 'islet', 'archipelago')) return 'LANDMASS'
      return 'SETTLEMENT SECTOR'
    case 'amenity':
      if (oneOf(osmValue, 'hospital', 'clinic', 'doctors', 'pharmacy', 'dentist')) return 'MEDICAL FACILITY'
      if (oneOf(osmValue, 'school', 'university', 'college', 'kindergarten', 'library'))
        return 'INSTRUCTION FACILITY'
      if (oneOf(osmValue, 'restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'biergarten', 'food_court', 'ice_cream'))
        return 'RATION POINT'
      if (oneOf(osmValue, 'fuel', 'charging_station')) return 'ENERGY POINT'
      if (osmValue === 'place_of_worship') return 'ASSEMBLY SITE'
      if (oneOf(osmValue, 'parking', 'parking_entrance')) return 'VEHICLE HOLDING AREA'
      if (oneOf(osmValue, 'police', 'fire_station')) return 'RESPONSE STATION'
      return 'CIVIC FACILITY'
    case 'highway':
      return 'ROUTE SEGMENT'
    case 'building':
      return 'STRUCTURE'
    case 'natural':
      if (oneOf(osmValue, 'water', 'bay', 'spring', 'glacier', 'strait', 'wetland')) return 'HYDROLOGICAL FEATURE'
      if (oneOf(osmValue, 'wood', 'tree', 'scrub', 'heath')) return 'VEGETATION MASS'
      return 'TERRAIN FEATURE'
    case 'waterway':
      return 'HYDROLOGICAL FEATURE'
    case 'tourism':
      return 'ATTRACTION SITE'
    case 'leisure':
      return 'RECREATION ZONE'
    case 'landuse':
      if (oneOf(osmValue, 'industrial', 'commercial', 'retail', 'quarry', 'port')) return 'INDUSTRIAL ZONE'
      if (osmValue === 'residential') return 'HOUSING SECTOR'
      return 'LAND PARCEL'
    case 'office':
      return 'ADMINISTRATIVE FACILITY'
    case 'man_made':
    case 'power':
    case 'industrial':
      return 'INDUSTRIAL INSTALLATION'
    case 'military':
      return 'RESTRICTED INSTALLATION'
    case 'boundary':
      return 'ADMINISTRATIVE REGION'
    case 'historic':
      return 'HERITAGE SITE'
    case 'information':
      return 'WAYFINDING MARKER'
    default:
      return 'POINT OF INTEREST'
  }
}

export function designationCode(countryCode: string, osmId: number): string {
  const prefix = /^[A-Z]{2}$/.test(countryCode) ? countryCode : 'XX'
  const serial = Math.abs(Math.trunc(osmId)) % 10_000
  return `${prefix}-${String(serial).padStart(4, '0')}`
}

export function designate(
  target: Pick<AtlasTarget, 'osmKey' | 'osmValue' | 'countryCode' | 'osmId'>,
): Designation {
  return {
    role: designationRole(target.osmKey, target.osmValue),
    code: designationCode(target.countryCode, target.osmId),
  }
}
