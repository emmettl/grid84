import type { ExposurePolygon, ExposureRequest, ExposureResult, PopulationGrid } from './exposure.ts'
import type { CellRow, WorkerRequest, WorkerResponse } from './exposure.worker.ts'

/** Omit that distributes over a union, so each request shape keeps its own fields. */
type Outgoing<T> = T extends unknown ? Omit<T, 'id'> : never

export interface GridSummary {
  source: PopulationGrid['source']
  total: number
  /** Degrees per cell, for the readout. */
  cellSize: number
}

/**
 * A small pool of exposure workers. One is enough for a lab; a study with
 * hundreds of detonations can ask for more, at the cost of one grid copy
 * per worker. Requests are handed to the least-busy worker.
 */
export class ExposureService {
  private workers: Array<{ worker: Worker; busy: number }> = []
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; slot: number }>()
  private next = 1
  private summary: GridSummary | null = null

  constructor(private readonly base: string, size = 1) {
    const count = Math.max(1, Math.min(size, navigator.hardwareConcurrency || 2))
    for (let i = 0; i < count; i += 1) {
      const worker = new Worker(new URL('./exposure.worker.ts', import.meta.url), { type: 'module' })
      const slot = i
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.receive(event.data, slot)
      worker.onerror = (event) => {
        for (const [id, p] of this.pending) {
          if (p.slot === slot) {
            p.reject(new Error(event.message || 'worker failed'))
            this.pending.delete(id)
          }
        }
      }
      this.workers.push({ worker, busy: 0 })
    }
  }

  get size(): number {
    return this.workers.length
  }

  get grid(): GridSummary | null {
    return this.summary
  }

  /** Load the grid into every worker. Resolves with the grid summary from the first. */
  async load(): Promise<GridSummary> {
    const results = await Promise.all(this.workers.map((_, slot) => this.send<WorkerResponse & { type: 'loaded' }>({ type: 'load', base: this.base }, slot)))
    this.summary = { source: results[0].source, total: results[0].total, cellSize: results[0].cellSize }
    return this.summary
  }

  async exposure(request: ExposureRequest): Promise<ExposureResult> {
    let slot = 0
    for (let i = 1; i < this.workers.length; i += 1) if (this.workers[i].busy < this.workers[slot].busy) slot = i
    const response = await this.send<WorkerResponse & { type: 'result' }>({ type: 'exposure', request }, slot)
    return response.result
  }

  /** Population inside each polygon. */
  async polygons(polygons: ExposurePolygon[]): Promise<{ within: Record<string, number>; cellsVisited: number }> {
    let slot = 0
    for (let i = 1; i < this.workers.length; i += 1) if (this.workers[i].busy < this.workers[slot].busy) slot = i
    const response = await this.send<WorkerResponse & { type: 'polygons' }>({ type: 'polygons', polygons }, slot)
    return { within: response.within, cellsVisited: response.cellsVisited }
  }

  /** Populated cells inside a bounding box, for drawing. */
  async cells(box: { west: number; south: number; east: number; north: number }): Promise<CellRow[]> {
    const response = await this.send<WorkerResponse & { type: 'cells' }>({ type: 'cells', ...box }, 0)
    return response.cells
  }

  destroy(): void {
    for (const w of this.workers) w.worker.terminate()
    for (const p of this.pending.values()) p.reject(new Error('service destroyed'))
    this.pending.clear()
    this.workers = []
  }

  private send<T>(message: Outgoing<WorkerRequest>, slot: number): Promise<T> {
    const id = this.next++
    const entry = this.workers[slot]
    entry.busy += 1
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, slot })
      entry.worker.postMessage({ ...message, id })
    })
  }

  private receive(message: WorkerResponse, slot: number): void {
    const p = this.pending.get(message.id)
    if (!p) return
    this.pending.delete(message.id)
    this.workers[slot].busy -= 1
    if (message.type === 'error') p.reject(new Error(message.message))
    else p.resolve(message)
  }
}
