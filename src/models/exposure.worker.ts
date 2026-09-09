/// <reference lib="webworker" />
import { exposure, totalPopulation, type ExposureRequest, type PopulationGrid } from './exposure.ts'
import { loadPopulationGrid } from './population-grid.ts'

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

/** [west, south, east, north, count] per populated cell. */
export type CellRow = [number, number, number, number, number]

export type WorkerResponse =
  | { id: number; type: 'loaded'; source: PopulationGrid['source']; total: number }
  | { id: number; type: 'result'; result: ReturnType<typeof exposure> }
  | { id: number; type: 'cells'; cells: CellRow[] }
  | { id: number; type: 'error'; message: string }

let grid: PopulationGrid | null = null

function cellsIn(g: PopulationGrid, box: { west: number; south: number; east: number; north: number }): CellRow[] {
  const top = g.south + g.height * g.cellSize
  const r0 = Math.max(0, Math.floor((top - box.north) / g.cellSize))
  const r1 = Math.min(g.height - 1, Math.floor((top - box.south) / g.cellSize))
  const c0 = Math.floor((box.west - g.west) / g.cellSize)
  const c1 = Math.floor((box.east - g.west) / g.cellSize)
  const out: CellRow[] = []
  for (let row = r0; row <= r1; row += 1) {
    for (let cc = c0; cc <= c1; cc += 1) {
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
      grid = await loadPopulationGrid(message.base)
      const response: WorkerResponse = { id: message.id, type: 'loaded', source: grid.source, total: totalPopulation(grid) }
      self.postMessage(response)
      return
    }
    if (!grid) throw new Error('grid not loaded')
    if (message.type === 'cells') {
      const response: WorkerResponse = { id: message.id, type: 'cells', cells: cellsIn(grid, message) }
      self.postMessage(response)
      return
    }
    const response: WorkerResponse = { id: message.id, type: 'result', result: exposure(grid, message.request) }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = { id: message.id, type: 'error', message: error instanceof Error ? error.message : String(error) }
    self.postMessage(response)
  }
}
