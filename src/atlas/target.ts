import type { LngLat } from '../geo/geodesy.ts'

/** A real place the atlas can acquire. Everything here comes from OpenStreetMap via the geocoder. */
export interface AtlasTarget {
  /** Stable identity: `${osmType}:${osmId}`. */
  id: string
  osmId: number
  osmType: string
  osmKey: string
  osmValue: string
  /** Display name. Falls back to the address, then the settlement. */
  name: string
  /** Secondary address line, may be empty. */
  label: string
  /** ISO 3166-1 alpha-2, upper case, `XX` when the geocoder gave none. */
  countryCode: string
  position: LngLat
  /** Geocoder bounding box as [minLon, maxLat, maxLon, minLat] when the feature has an extent. */
  extent?: readonly [number, number, number, number]
}
