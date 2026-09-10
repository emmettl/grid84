import data from '../../data/atlas/zonal.json'
import type { Zonal } from '../models/winter.ts'

/**
 * The world by ten-degree band, measured from the HYDE 3.3 grids by
 * scripts/build-zonal-2023.py: land, people, built-up area, cropland,
 * grazing. Four kilobytes, so it ships with the bundle rather than being
 * fetched.
 */
export const ZONAL = data as Zonal

export const WORLD_POPULATION = ZONAL.bands.reduce((a, b) => a + b.population, 0)
export const WORLD_CROPLAND_KM2 = ZONAL.bands.reduce((a, b) => a + b.croplandKm2, 0)

/** One polygon per band, subdivided in longitude so the globe curves them properly. */
export function bandPolygons(): GeoJSON.FeatureCollection {
  const step = 10
  return {
    type: 'FeatureCollection',
    features: ZONAL.bands.map((b, i) => {
      const south: GeoJSON.Position[] = []
      const north: GeoJSON.Position[] = []
      for (let lon = -179.9; lon <= 179.9; lon += step) {
        south.push([lon, b.south])
        north.push([lon, b.north])
      }
      south.push([179.9, b.south])
      north.push([179.9, b.north])
      return {
        type: 'Feature' as const,
        id: i,
        geometry: { type: 'Polygon' as const, coordinates: [[...south, ...north.reverse(), [-179.9, b.south]]] },
        properties: { band: i, anomaly: 0, tau: 0 },
      }
    }),
  }
}
