import { haversineMetres, type LngLat } from '../geo/geodesy.ts'
import { acuteMortality } from './fallout.ts'

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
  /** A window cut from a larger grid: columns outside it are skipped rather than wrapped round the world. */
  partial?: boolean
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
      // Wrap longitude so a target near the antimeridian still sees both sides; a window has no other side.
      if (grid.partial && (cc < 0 || cc >= grid.width)) continue
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

export interface ExposurePolygon {
  key: string
  /** Closed ring of [lon, lat]. */
  ring: LngLat[]
}

/** Ray-casting point-in-polygon on [lon, lat]. */
export function pointInRing(lon: number, lat: number, ring: LngLat[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Population inside each polygon, with the same sub-sampling as `exposure`.
 * Polygons are independent: the caller nests or differences them as it likes.
 */
export function exposurePolygons(grid: PopulationGrid, polygons: ExposurePolygon[], subsamples = 3): { within: Record<string, number>; cellsVisited: number } {
  const sub = Math.max(1, Math.floor(subsamples))
  const within: Record<string, number> = Object.fromEntries(polygons.map((p) => [p.key, 0]))
  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const p of polygons) {
    for (const [lon, lat] of p.ring) {
      if (lon < west) west = lon
      if (lon > east) east = lon
      if (lat < south) south = lat
      if (lat > north) north = lat
    }
  }
  const top = grid.south + grid.height * grid.cellSize
  const r0 = Math.max(0, Math.floor((top - north) / grid.cellSize))
  const r1 = Math.min(grid.height - 1, Math.floor((top - south) / grid.cellSize))
  const c0 = Math.floor((west - grid.west) / grid.cellSize)
  const c1 = Math.floor((east - grid.west) / grid.cellSize)
  const share = 1 / (sub * sub)
  let cellsVisited = 0
  for (let row = r0; row <= r1; row += 1) {
    for (let cc = c0; cc <= c1; cc += 1) {
      if (grid.partial && (cc < 0 || cc >= grid.width)) continue
      const col = ((cc % grid.width) + grid.width) % grid.width
      const count = grid.counts[row * grid.width + col]
      if (!count) continue
      cellsVisited += 1
      const cellWest = grid.west + cc * grid.cellSize
      const cellNorth = top - row * grid.cellSize
      for (let sy = 0; sy < sub; sy += 1) {
        const lat = cellNorth - ((sy + 0.5) / sub) * grid.cellSize
        for (let sx = 0; sx < sub; sx += 1) {
          const lon = cellWest + ((sx + 0.5) / sub) * grid.cellSize
          for (const p of polygons) if (pointInRing(lon, lat, p.ring)) within[p.key] += count * share
        }
      }
    }
  }
  return { within, cellsVisited }
}

/**
 * A union of detonations over the grid, so that a person under several is
 * counted once, in the most severe band that reaches them. Each sub-sample
 * of a cell is keyed by its global position; a detonation claims the
 * samples inside its rings and improves their band where it can, and the
 * totals move with the improvement, so the sum never double counts.
 */
export interface UnionDetonation {
  center: LngLat
  /** Outer radius of each band in metres, innermost first, one per band. */
  bandRadii: number[]
  /** The mass-fire radius, or 0 for none. */
  fireRadius: number
}

/** Where the grid sits in the world, so window and dense grids key their samples alike. */
export interface GridOrigin {
  west: number
  north: number
  width: number
  cellSize: number
}

export interface UnionState {
  /** Sub-samples per cell edge. */
  sub: number
  /** Sample key to band index. */
  bands: Map<number, number>
  fire: Set<number>
  bandTotals: number[]
  fireTotal: number
  /** People at each sample touched by any effect. */
  people: Map<number, number>
  /** The highest mid-band dose any plume gives a sample, rads. */
  dose: Map<number, number>
}

export function createUnion(bandCount: number, sub: number): UnionState {
  return { sub, bands: new Map(), fire: new Set(), bandTotals: new Array<number>(bandCount).fill(0), fireTotal: 0, people: new Map(), dose: new Map() }
}

export interface UnionPlume {
  /** Closed ring of [lon, lat]. */
  ring: LngLat[]
  doseMidRads: number
}

export interface BandFractions {
  fatal: number
  injured: number
}

/** The union's totals, with the effects applied in sequence per sample: blast, then fire, then fallout among the survivors. */
export interface UnionTotals {
  blastDead: number
  blastInjured: number
  /** Postol's bound: everyone in a fire zone dies, whatever the blast did. */
  fireDead: number
  /** Acute fallout deaths among those the blast and fire left alive. */
  falloutDead: number
  /** Blast, fire and fallout in sequence: one minus the product of the survivals. */
  combinedDead: number
  /** People under any plume's outermost contour. */
  underPlume: number
  samples: number
}

export function unionTotals(state: UnionState, bands: BandFractions[]): UnionTotals {
  const t: UnionTotals = { blastDead: 0, blastInjured: 0, fireDead: 0, falloutDead: 0, combinedDead: 0, underPlume: 0, samples: state.people.size }
  for (const [key, people] of state.people) {
    const band = state.bands.get(key)
    const pb = band === undefined ? 0 : bands[band].fatal
    const pi = band === undefined ? 0 : bands[band].injured
    const pf = state.fire.has(key) ? 1 : 0
    const dose = state.dose.get(key)
    const pr = dose === undefined ? 0 : acuteMortality(dose)
    const afterBlastAndFire = Math.max(pb, pf)
    t.blastDead += people * pb
    t.blastInjured += people * pi
    t.fireDead += people * afterBlastAndFire
    t.falloutDead += people * (1 - afterBlastAndFire) * pr
    t.combinedDead += people * (1 - (1 - afterBlastAndFire) * (1 - pr))
    if (dose !== undefined) t.underPlume += people
  }
  return t
}

/** Claim the samples inside a plume's contour at its dose, keeping the highest dose per sample. */
export function unionAddPlume(grid: PopulationGrid, state: UnionState, plume: UnionPlume, origin: GridOrigin): void {
  const sub = state.sub
  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let northmost = -Infinity
  for (const [lon, lat] of plume.ring) {
    west = Math.min(west, lon)
    east = Math.max(east, lon)
    south = Math.min(south, lat)
    northmost = Math.max(northmost, lat)
  }
  const north = grid.south + grid.height * grid.cellSize
  const colOf = (lon: number) => Math.floor((lon - grid.west) / grid.cellSize)
  const rowOf = (lat: number) => Math.floor((north - lat) / grid.cellSize)
  const c0 = colOf(west) - 1
  const c1 = colOf(east) + 1
  const r0 = Math.max(0, rowOf(northmost) - 1)
  const r1 = Math.min(grid.height - 1, rowOf(south) + 1)
  const share = 1 / (sub * sub)
  for (let row = r0; row <= r1; row += 1) {
    for (let cc = c0; cc <= c1; cc += 1) {
      if (grid.partial && (cc < 0 || cc >= grid.width)) continue
      const col = ((cc % grid.width) + grid.width) % grid.width
      const count = grid.counts[row * grid.width + col]
      if (!count) continue
      const cellWest = grid.west + col * grid.cellSize
      const cellNorth = north - row * grid.cellSize
      const gcol = Math.round((cellWest - origin.west) / origin.cellSize)
      const grow = Math.round((origin.north - cellNorth) / origin.cellSize)
      const cellKey = (grow * origin.width + ((gcol % origin.width) + origin.width) % origin.width) * 16
      for (let sy = 0; sy < sub; sy += 1) {
        const lat = cellNorth - ((sy + 0.5) / sub) * grid.cellSize
        for (let sx = 0; sx < sub; sx += 1) {
          const lon = cellWest + ((sx + 0.5) / sub) * grid.cellSize
          if (!pointInRing(lon, lat, plume.ring)) continue
          const key = cellKey + sy * 4 + sx
          if (!state.people.has(key)) state.people.set(key, count * share)
          const have = state.dose.get(key)
          if (have === undefined || plume.doseMidRads > have) state.dose.set(key, plume.doseMidRads)
        }
      }
    }
  }
}

export function unionAdd(grid: PopulationGrid, state: UnionState, d: UnionDetonation, origin: GridOrigin): void {
  const sub = state.sub
  const outer = Math.max(d.fireRadius, ...d.bandRadii)
  if (outer <= 0) return
  const [lon0, lat0] = d.center
  const north = grid.south + grid.height * grid.cellSize
  const dLat = outer / 111_320 + grid.cellSize
  const cosLat = Math.max(0.05, Math.cos((lat0 * Math.PI) / 180))
  const dLon = outer / (111_320 * cosLat) + grid.cellSize
  const colOf = (lon: number) => Math.floor((lon - grid.west) / grid.cellSize)
  const rowOf = (lat: number) => Math.floor((north - lat) / grid.cellSize)
  const c0 = colOf(lon0 - dLon)
  const c1 = colOf(lon0 + dLon)
  const r0 = Math.max(0, rowOf(lat0 + dLat))
  const r1 = Math.min(grid.height - 1, rowOf(lat0 - dLat))
  const share = 1 / (sub * sub)
  for (let row = r0; row <= r1; row += 1) {
    for (let cc = c0; cc <= c1; cc += 1) {
      if (grid.partial && (cc < 0 || cc >= grid.width)) continue
      const col = ((cc % grid.width) + grid.width) % grid.width
      const count = grid.counts[row * grid.width + col]
      if (!count) continue
      const cellWest = grid.west + col * grid.cellSize
      const cellNorth = north - row * grid.cellSize
      const gcol = Math.round((cellWest - origin.west) / origin.cellSize)
      const grow = Math.round((origin.north - cellNorth) / origin.cellSize)
      const cellKey = (grow * origin.width + ((gcol % origin.width) + origin.width) % origin.width) * 16
      for (let sy = 0; sy < sub; sy += 1) {
        const lat = cellNorth - ((sy + 0.5) / sub) * grid.cellSize
        for (let sx = 0; sx < sub; sx += 1) {
          const lon = cellWest + ((sx + 0.5) / sub) * grid.cellSize
          const dist = haversineMetres([lon0, lat0], [lon, lat])
          if (dist > outer) continue
          const key = cellKey + sy * 4 + sx
          const people = count * share
          if (!state.people.has(key)) state.people.set(key, people)
          let band = -1
          for (let i = 0; i < d.bandRadii.length; i += 1) {
            if (dist <= d.bandRadii[i]) {
              band = i
              break
            }
          }
          if (band >= 0) {
            const have = state.bands.get(key)
            if (have === undefined) {
              state.bands.set(key, band)
              state.bandTotals[band] += people
            } else if (band < have) {
              state.bands.set(key, band)
              state.bandTotals[have] -= people
              state.bandTotals[band] += people
            }
          }
          if (d.fireRadius > 0 && dist <= d.fireRadius && !state.fire.has(key)) {
            state.fire.add(key)
            state.fireTotal += people
          }
        }
      }
    }
  }
}
