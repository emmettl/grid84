import { haversineMetres, type LngLat } from '../geo/geodesy.ts'

/**
 * A population grid in geographic coordinates, row 0 at the north edge,
 * cell values are people per cell. HYDE ships 5-arc-minute ESRI ASCII grids;
 * this is the same thing in memory.
 */
export interface PopulationGrid {
  /** Columns and rows. */
  width: number
  height: number
  /** Degrees per cell. */
  cellSize: number
  /** Longitude of the west edge and latitude of the south edge. */
  west: number
  south: number
  /** People per cell, row-major from the north-west corner. */
  counts: Float32Array
  /** For the readout: dataset, year, licence. */
  source: { name: string; year: number; licence: string }
}

export interface ExposureRing {
  key: string
  radius: number
}

export interface ExposureRequest {
  center: LngLat
  /** Rings sorted by increasing radius; population is reported per annulus. */
  rings: ExposureRing[]
  /** Sub-samples per cell edge; 4 gives 16 samples per cell. */
  subsamples?: number
}

export interface ExposureResult {
  /** Population inside each ring's outer radius but outside the previous ring. */
  annuli: Record<string, number>
  /** Population inside each ring's outer radius, cumulative. */
  within: Record<string, number>
  cellsVisited: number
  samples: number
}

/**
 * Sum population under a set of concentric geodesic rings. Each cell is
 * split into sub-cells assumed to hold an equal share of the cell's people,
 * and a sub-cell counts if its centre lies within the radius. Uniform
 * density inside a cell is the assumption; at 5 arc minutes that is the
 * dominant source of error near the centre, and the readout says so.
 */
export function exposure(grid: PopulationGrid, request: ExposureRequest): ExposureResult {
  const sub = Math.max(1, Math.floor(request.subsamples ?? 4))
  const rings = [...request.rings].sort((a, b) => a.radius - b.radius)
  const outer = rings[rings.length - 1]?.radius ?? 0
  const within: Record<string, number> = Object.fromEntries(rings.map((r) => [r.key, 0]))
  const [lon0, lat0] = request.center
  // Bounding box in cells, with margin for the sub-sample offsets.
  const dLat = (outer / 111_320) + grid.cellSize
  const cosLat = Math.max(0.05, Math.cos((lat0 * Math.PI) / 180))
  const dLon = (outer / (111_320 * cosLat)) + grid.cellSize
  const north = grid.south + grid.height * grid.cellSize
  const colOf = (lon: number) => Math.floor((lon - grid.west) / grid.cellSize)
  const rowOf = (lat: number) => Math.floor((north - lat) / grid.cellSize)
  const c0 = colOf(lon0 - dLon)
  const c1 = colOf(lon0 + dLon)
  const r0 = Math.max(0, rowOf(lat0 + dLat))
  const r1 = Math.min(grid.height - 1, rowOf(lat0 - dLat))
  let cellsVisited = 0
  let samples = 0
  const share = 1 / (sub * sub)
  for (let row = r0; row <= r1; row += 1) {
    for (let cc = c0; cc <= c1; cc += 1) {
      // Wrap longitude so a target near the antimeridian still sees both sides.
      const col = ((cc % grid.width) + grid.width) % grid.width
      const count = grid.counts[row * grid.width + col]
      if (!count) continue
      cellsVisited += 1
      const cellWest = grid.west + col * grid.cellSize
      const cellNorth = north - row * grid.cellSize
      for (let sy = 0; sy < sub; sy += 1) {
        const lat = cellNorth - ((sy + 0.5) / sub) * grid.cellSize
        for (let sx = 0; sx < sub; sx += 1) {
          const lon = cellWest + ((sx + 0.5) / sub) * grid.cellSize
          samples += 1
          const d = haversineMetres([lon0, lat0], [lon, lat])
          if (d > outer) continue
          for (const ring of rings) {
            if (d <= ring.radius) within[ring.key] += count * share
          }
        }
      }
    }
  }
  const annuli: Record<string, number> = {}
  let previous = 0
  for (const ring of rings) {
    annuli[ring.key] = within[ring.key] - previous
    previous = within[ring.key]
  }
  return { annuli, within, cellsVisited, samples }
}

/** Total population of the grid, for the readout's sanity line. */
export function totalPopulation(grid: PopulationGrid): number {
  let total = 0
  for (let i = 0; i < grid.counts.length; i += 1) total += grid.counts[i]
  return total
}
