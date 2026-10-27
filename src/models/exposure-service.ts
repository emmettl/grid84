import { PopulationTileCache } from './population-tile-cache.ts'
import type { BandFractions, ExposurePolygon, ExposureRequest, ExposureResult, PopulationGrid, UnionDetonation, UnionPlume, UnionTotals } from './exposure.ts'
import type { CellRow, WorkerRequest, WorkerResponse } from './exposure.worker.ts'

/** Omit that distributes over a union, so each request shape keeps its own fields. */
type Outgoing<T> = T extends { type: 'tile-result' } ? never : T extends unknown ? Omit<T, 'id'> : never

export interface GridSummary {
  source: PopulationGrid['source']
  total: number
  /** Degrees per cell, for the readout. */
  cellSize: number
}

/**
 * A small pool of exposure workers. One is enough for a lab; a study with
 * hundreds of detonations can ask for more on tiled grids. Dense grids use
 * one worker to keep one full count array. Tile downloads share a bounded
 * pool-owned cache. Requests go to the least-busy worker.
 */
export class ExposureService {
  private workers: Array<{ worker: Worker; busy: number; failure?: Error }> = []
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; slot: number }>()
  private readonly tiles = new PopulationTileCache()
  private next = 1
  private summary: GridSummary | null = null
  private loading: Promise<GridSummary> | null = null
  private destroyed = false

  constructor(private readonly base: string, size = 1) {
    const count = Math.max(1, Math.min(size, navigator.hardwareConcurrency || 2))
    for (let i = 0; i < count; i += 1) {
      const worker = new Worker(new URL('./exposure.worker.ts', import.meta.url), { type: 'module' })
      const slot = i
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.receive(event.data, slot)
      worker.onerror = (event) => {
        const failure = new Error(event.message || 'worker failed')
        const entry = this.workers[slot]
        if (entry) { entry.failure = failure; entry.busy = 0 }
        for (const [id, p] of this.pending) {
          if (p.slot === slot) {
            p.reject(failure)
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

  /** Load once; dense grids retain one worker, tiled grids retain the requested pool. */
  load(): Promise<GridSummary> {
    if (this.destroyed) return Promise.reject(new Error('service destroyed'))
    if (this.summary) return Promise.resolve(this.summary)
    if (!this.loading) this.loading = this.loadPool().catch((error: unknown) => {
      this.loading = null
      throw error
    })
    return this.loading
  }

  private async loadPool(): Promise<GridSummary> {
    const first = await this.send<Extract<WorkerResponse, { type: 'loaded' }>>({ type: 'load', base: this.base }, 0)
    if (this.destroyed) throw new Error('service destroyed')
    if (first.tiled) {
      await Promise.all(this.workers.slice(1).map((_, index) => this.send({ type: 'load', base: this.base }, index + 1)))
    } else {
      // No jobs are dispatched before load resolves, so the spare workers are idle.
      for (const entry of this.workers.splice(1)) entry.worker.terminate()
    }
    if (this.destroyed) throw new Error('service destroyed')
    this.summary = { source: first.source, total: first.total, cellSize: first.cellSize }
    return this.summary
  }

  private async ready(): Promise<void> {
    await this.load()
    if (this.destroyed) throw new Error('service destroyed')
  }

  async exposure(request: ExposureRequest): Promise<ExposureResult> {
    await this.ready()
    let slot = 0
    for (let i = 1; i < this.workers.length; i += 1) if (this.workers[i].busy < this.workers[slot].busy) slot = i
    const response = await this.send<WorkerResponse & { type: 'result' }>({ type: 'exposure', request }, slot)
    return response.result
  }

  /** Population inside each polygon. */
  async polygons(polygons: ExposurePolygon[]): Promise<{ within: Record<string, number>; cellsVisited: number }> {
    await this.ready()
    let slot = 0
    for (let i = 1; i < this.workers.length; i += 1) if (this.workers[i].busy < this.workers[slot].busy) slot = i
    const response = await this.send<WorkerResponse & { type: 'polygons' }>({ type: 'polygons', polygons }, slot)
    return { within: response.within, cellsVisited: response.cellsVisited }
  }

  /** Add detonations to a side's union and return its totals; a key always goes to the same worker, which keeps the state. */
  async union(key: string, detonations: UnionDetonation[], bands: BandFractions[]): Promise<UnionTotals> {
    await this.ready()
    const response = await this.send<WorkerResponse & { type: 'union' }>({ type: 'union-add', key, detonations, bands }, this.slotFor(key))
    return response.totals
  }

  /** Add plumes at their deposited dose to a side's union; fallout deaths count only among the blast and fire survivors. */
  async unionPlumes(key: string, group: string, plumes: UnionPlume[], bands: BandFractions[]): Promise<UnionTotals> {
    await this.ready()
    const response = await this.send<WorkerResponse & { type: 'union' }>({ type: 'union-plumes', key, group, plumes, bands }, this.slotFor(key))
    return response.totals
  }

  async unionReset(key: string): Promise<void> {
    await this.ready()
    await this.send<WorkerResponse & { type: 'union' }>({ type: 'union-reset', key }, this.slotFor(key))
  }

  private slotFor(key: string): number {
    let h = 0
    for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0
    return h % this.workers.length
  }

  /** Populated cells inside a bounding box, for drawing. */
  async cells(box: { west: number; south: number; east: number; north: number }): Promise<CellRow[]> {
    await this.ready()
    const response = await this.send<WorkerResponse & { type: 'cells' }>({ type: 'cells', ...box }, 0)
    return response.cells
  }

  destroy(): void {
    this.destroyed = true
    this.tiles.destroy()
    for (const w of this.workers) w.worker.terminate()
    for (const p of this.pending.values()) p.reject(new Error('service destroyed'))
    this.pending.clear()
    this.workers = []
  }

  private send<T>(message: Outgoing<WorkerRequest>, slot: number): Promise<T> {
    const id = this.next++
    const entry = this.workers[slot]
    if (!entry) return Promise.reject(new Error('service destroyed'))
    if (entry.failure) return Promise.reject(entry.failure)
    entry.busy += 1
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, slot })
      entry.worker.postMessage({ ...message, id })
    })
  }

  private receive(message: WorkerResponse, slot: number): void {
    if (message.type === 'tile-request') {
      const worker = this.workers[slot]?.worker
      if (!worker) return
      void this.tiles.get(message.path).then(
        (data) => { if (this.workers[slot]?.worker === worker) worker.postMessage({ id: message.id, type: 'tile-result', data } satisfies WorkerRequest) },
        (error: unknown) => { if (this.workers[slot]?.worker === worker) worker.postMessage({ id: message.id, type: 'tile-result', message: error instanceof Error ? error.message : String(error) } satisfies WorkerRequest) },
      )
      return
    }
    const p = this.pending.get(message.id)
    if (!p) return
    this.pending.delete(message.id)
    this.workers[slot].busy -= 1
    if (message.type === 'error') p.reject(new Error(message.message))
    else p.resolve(message)
  }
}
