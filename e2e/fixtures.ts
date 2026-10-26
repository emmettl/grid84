import { test as base, expect } from '@playwright/test'
import { gzipSync } from 'node:zlib'

const meta = {
  dataset: 'BROWSER TEST SPECIMEN', variable: 'popc', year: 2025,
  width: 120, height: 120, cellSize: 0.01, west: 7.9, south: 46.8,
  encoding: 'float32-le row-major from north-west, gzip',
  tiled: true, tileSize: 120, tilesX: 1, tilesY: 1, tiles: [[0, 0, 1_440_000]],
  totalPopulation: 1_440_000, source: 'Synthetic browser fixture', licence: 'none',
}
const population = gzipSync(Buffer.from(new Float32Array(meta.width * meta.height).fill(100).buffer))

/** Keep the real app, solver, workers and DOM; replace only network data. */
export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/data/hyde/index.json') {
        return route.fulfill({ json: { grids: [{ name: 'popc_2025', path: 'test/population' }] } })
      }
      if (url.pathname === '/data/test/population.json') return route.fulfill({ json: meta })
      if (url.pathname === '/data/test/population/tiles/0_0.bin.gz') {
        return route.fulfill({ contentType: 'application/octet-stream', body: population })
      }
      if (url.origin === baseURL) return route.continue()
      if (url.hostname === 'photon.komoot.io') {
        return route.fulfill({ json: { features: [{
          type: 'Feature', geometry: { type: 'Point', coordinates: [8.54, 47.37] },
          properties: { osm_id: 123, osm_type: 'R', osm_key: 'place', osm_value: 'city', name: 'Test City', countrycode: 'CH', extent: [8.5, 47.4, 8.6, 47.3] },
        }] } })
      }
      if (url.hostname === 'nominatim.openstreetmap.org') {
        return route.fulfill({ json: [{ geojson: { type: 'Polygon', coordinates: [[[8.5, 47.3], [8.6, 47.3], [8.6, 47.4], [8.5, 47.3]]] } }] })
      }
      if (url.hostname === 'api.open-meteo.com') {
        return route.fulfill({ json: { current: { wind_speed_10m: 15, wind_direction_10m: 270 } } })
      }
      if (url.hostname === 'overpass-api.de') return route.fulfill({ json: { elements: [] } })
      // Basemap and terrain availability must not determine panel test results.
      return route.abort()
    })
    await provide(context)
  },
})

export { expect }
