/// <reference lib="webworker" />
import { applyGroupDose, createUnion, exposure, exposurePolygons, totalPopulation, unionAdd, unionAddPlume, unionTotals, type BandFractions, type ExposurePolygon, type ExposureRequest, type GridOrigin, type PopulationGrid, type UnionDetonation, type UnionPlume, type UnionState, type UnionTotals } from './exposure.ts'
import { loadGridMeta, loadPopulationGrid, TiledPopulationGrid } from './population-grid.ts'

/**
 * Exposure worker. Loads one population grid on request and answers
 * exposure sums off the render thread. Each worker keeps its own copy of
 * the grid: a SharedArrayBuffer would avoid that but needs cross-origin
 * isolation headers that static hosting does not give us.
 */
export type WorkerRequest =
  | { id: number; type: 'load'; base: string }
  | { id: number; type: 'exposure'; request: ExposureRequest }
  | { id: number; type: 'cells'; west: number; south: number; east: number; north: number }
  | { id: number; type: 'polygons'; polygons: ExposurePolygon[] }
  | { id: number; type: 'union-add'; key: string; detonations: UnionDetonation[]; bands: BandFractions[] }
  | { id: number; type: 'union-plumes'; key: string; group: string; plumes: UnionPlume[]; bands: BandFractions[] }
  | { id: number; type: 'union-reset'; key: string }

/** [west, south, east, north, count] per populated cell. */
export type CellRow = [number, number, number, number, number]

export type WorkerResponse =
  | { id: number; type: 'loaded'; source: PopulationGrid['source']; total: number; cellSize: number }
  | { id: number; type: 'result'; result: ReturnType<typeof exposure> }
  | { id: number; type: 'cells'; cells: CellRow[] }
  | { id: number; type: 'polygons'; within: Record<string, number>; cellsVisited: number }
  | { id: number; type: 'union'; totals: UnionTotals }
  | { id: number; type: 'error'; message: string }

let grid: PopulationGrid | null = null
let tiled: TiledPopulationGrid | null = null
/** Unions in progress, one per side of a study, kept between requests. */
const unions = new Map<string, UnionState>()

function origin(): GridOrigin {
  if (tiled) return { west: tiled.west, north: tiled.south + tiled.height * tiled.cellSize, width: tiled.width, cellSize: tiled.cellSize }
  if (!grid) throw new Error('grid not loaded')
  return { west: grid.west, north: grid.south + grid.height * grid.cellSize, width: grid.width, cellSize: grid.cellSize }
}

/** The grid to answer a request over: the dense grid, or a window of the tiled one around the box. */
async function gridFor(box: { west: number; south: number; east: number; north: number }): Promise<PopulationGrid> {
  if (tiled) return tiled.window(box)
  if (!grid) throw new Error('grid not loaded')
  return grid
}

function boxAround(center: readonly [number, number], radiusMetres: number): { west: number; south: number; east: number; north: number } {
  const dLat = radiusMetres / 111_320
  const dLon = radiusMetres / (111_320 * Math.max(0.05, Math.cos((center[1] * Math.PI) / 180)))
  return { west: center[0] - dLon, south: center[1] - dLat, east: center[0] + dLon, north: center[1] + dLat }
}

function boxOf(polygons: ExposurePolygon[]): { west: number; south: number; east: number; north: number } {
  const box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }
  for (const p of polygons) for (const [lon, lat] of p.ring) {
    box.west = Math.min(box.west, lon)
    box.east = Math.max(box.east, lon)
    box.south = Math.min(box.south, lat)
    box.north = Math.max(box.north, lat)
  }
  return box
}

function cellsIn(g: PopulationGrid, box: { west: number; south: number; east: number; north: number }): CellRow[] {
  const top = g.south + g.height * g.cellSize
  const r0 = Math.max(0, Math.floor((top - box.north) / g.cellSize))
  const r1 = Math.min(g.height - 1, Math.floor((top - box.south) / g.cellSize))
  const c0 = Math.floor((box.west - g.west) / g.cellSize)
  const c1 = Math.floor((box.east - g.west) / g.cellSize)
  const out: CellRow[] = []
  for (let row = r0; row <= r1; row += 1) {
    for (let cc = c0; cc <= c1; cc += 1) {
      if (g.partial && (cc < 0 || cc >= g.width)) continue
      const col = ((cc % g.width) + g.width) % g.width
      const count = g.counts[row * g.width + col]
      if (!count) continue
      const west = g.west + cc * g.cellSize
      const north = top - row * g.cellSize
      out.push([west, north - g.cellSize, west + g.cellSize, north, count])
    }
  }
  return out
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  try {
    if (message.type === 'load') {
      const meta = await loadGridMeta(message.base)
      if (meta.tiled) {
        tiled = new TiledPopulationGrid(message.base, meta)
        grid = null
        const response: WorkerResponse = { id: message.id, type: 'loaded', source: tiled.source, total: tiled.total, cellSize: tiled.cellSize }
        self.postMessage(response)
        return
      }
      tiled = null
      grid = await loadPopulationGrid(message.base)
      const response: WorkerResponse = { id: message.id, type: 'loaded', source: grid.source, total: totalPopulation(grid), cellSize: grid.cellSize }
      self.postMessage(response)
      return
    }
    if (!grid && !tiled) throw new Error('grid not loaded')
    if (message.type === 'polygons') {
      const g = await gridFor(boxOf(message.polygons))
      const r = exposurePolygons(g, message.polygons)
      const response: WorkerResponse = { id: message.id, type: 'polygons', within: r.within, cellsVisited: r.cellsVisited }
      self.postMessage(response)
      return
    }
    if (message.type === 'union-reset') {
      unions.delete(message.key)
      const response: WorkerResponse = { id: message.id, type: 'union', totals: { blastDead: 0, blastInjured: 0, fireDead: 0, falloutDead: 0, combinedDead: 0, underPlume: 0, samples: 0 } }
      self.postMessage(response)
      return
    }
    if (message.type === 'union-add' || message.type === 'union-plumes') {
      const o = origin()
      // Coarse cells are sub-sampled; a 30-arc-second cell is finer than the rings and is not.
      let state = unions.get(message.key)
      if (!state) {
        state = createUnion(message.bands.length, o.cellSize > 0.02 ? 4 : 1)
        unions.set(message.key, state)
      }
      if (message.type === 'union-add') {
        for (const d of message.detonations) {
          const outer = Math.max(d.fireRadius, ...d.bandRadii)
          const g = await gridFor(boxAround(d.center, outer + 2_000))
          unionAdd(g, state, d, o)
        }
      } else {
        // One burst's contours are one group: within it the innermost contour wins, and groups add.
        const contribution = new Map<number, number>()
        for (const p of message.plumes) {
          const g = await gridFor(boxOf([{ key: 'p', ring: p.ring }]))
          unionAddPlume(g, state, p, o, contribution)
        }
        applyGroupDose(state, message.group, contribution)
      }
      const response: WorkerResponse = { id: message.id, type: 'union', totals: unionTotals(state, message.bands) }
      self.postMessage(response)
      return
    }
    if (message.type === 'cells') {
      const g = await gridFor(message)
      const response: WorkerResponse = { id: message.id, type: 'cells', cells: cellsIn(g, message) }
      self.postMessage(response)
      return
    }
    const outer = Math.max(0, ...message.request.rings.map((r) => r.radius))
    const g = await gridFor(boxAround(message.request.center, outer + 2_000))
    const response: WorkerResponse = { id: message.id, type: 'result', result: exposure(g, message.request) }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = { id: message.id, type: 'error', message: error instanceof Error ? error.message : String(error) }
    self.postMessage(response)
  }
}
