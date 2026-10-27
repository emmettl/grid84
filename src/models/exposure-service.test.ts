import { afterEach, expect, it, vi } from 'vitest'
import { ExposureService } from './exposure-service.ts'
import type { WorkerRequest, WorkerResponse } from './exposure.worker.ts'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage?: (event: { data: WorkerResponse }) => void
  onerror?: (event: { message: string }) => void
  postMessage = vi.fn<(message: WorkerRequest) => void>()
  terminate = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
  emit(data: WorkerResponse) { this.onmessage?.({ data }) }
}

afterEach(() => { vi.unstubAllGlobals(); FakeWorker.instances = [] })

const source = { name: 'test', year: 2025, licence: 'none' }
function setup(size: number) {
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('navigator', { hardwareConcurrency: 4 })
  return new ExposureService('/grid', size)
}
function loaded(worker: FakeWorker, tiled: boolean) {
  const request = worker.postMessage.mock.calls[0][0]
  worker.emit({ type: 'loaded', id: request.id, tiled, source, total: 10, cellSize: 1 })
}

it('brokers tile replies and keeps the requested pool for tiled grids', async () => {
  const service = setup(2)
  const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4])))
  vi.stubGlobal('fetch', fetcher)
  const [a, b] = FakeWorker.instances
  const loading = service.load()
  expect(b.postMessage).not.toHaveBeenCalled()
  loaded(a, true)
  await vi.waitFor(() => expect(b.postMessage).toHaveBeenCalledTimes(1))
  for (const worker of [a, b]) {
    const load = worker.postMessage.mock.calls[0][0]
    // Tile and job IDs deliberately overlap: these are separate protocols.
    worker.emit({ type: 'tile-request', id: load.id, path: '/grid/tiles/0_0.bin.gz' })
  }
  await vi.waitFor(() => expect(b.postMessage).toHaveBeenCalledTimes(2))
  expect(fetcher).toHaveBeenCalledTimes(1)
  for (const worker of [a, b]) {
    const load = worker.postMessage.mock.calls[0][0]
    expect(worker.postMessage.mock.calls[1][0]).toMatchObject({ type: 'tile-result', id: load.id, data: expect.any(ArrayBuffer) })
  }
  loaded(b, true)
  await expect(loading).resolves.toMatchObject({ total: 10 })
  expect(service.size).toBe(2)
  service.destroy()
  expect(a.terminate).toHaveBeenCalledTimes(1)
})

it('loads a dense grid once, retires spare workers and queues jobs until ready', async () => {
  const service = setup(4)
  const [owner, ...spares] = FakeWorker.instances
  const loading = service.load()
  expect(service.load()).toBe(loading)
  const request = { center: [0, 0] as const, rings: [{ key: 'a', radius: 1_000 }] }
  const job = service.exposure(request)
  expect(owner.postMessage).toHaveBeenCalledTimes(1)
  loaded(owner, false)
  await loading
  await vi.waitFor(() => expect(owner.postMessage).toHaveBeenCalledTimes(2))
  expect(service.size).toBe(1)
  for (const worker of spares) {
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  }
  const message = owner.postMessage.mock.calls[1][0]
  expect(message).toMatchObject({ type: 'exposure', request })
  const result = { within: { a: 10 }, annuli: { a: 10 }, cellsVisited: 1, samples: 16 }
  owner.emit({ type: 'result', id: message.id, result })
  await expect(job).resolves.toEqual(result)
  await service.load()
  expect(owner.postMessage).toHaveBeenCalledTimes(2)
  service.destroy()
})

it('rejects queued jobs on destruction without loading spare workers', async () => {
  const service = setup(4)
  const loading = service.load()
  const job = service.cells({ west: 0, south: 0, east: 1, north: 1 })
  const rejected = expect(Promise.all([loading, job])).rejects.toThrow('service destroyed')
  service.destroy()
  await rejected
  await expect(service.load()).rejects.toThrow('service destroyed')
  for (const worker of FakeWorker.instances) expect(worker.terminate).toHaveBeenCalledTimes(1)
  expect(FakeWorker.instances.slice(1).every((w) => w.postMessage.mock.calls.length === 0)).toBe(true)
})

it('can retry a failed initial grid download', async () => {
  const service = setup(2)
  const [owner] = FakeWorker.instances
  const first = service.load()
  const failed = expect(first).rejects.toThrow('grid data 503')
  owner.emit({ type: 'error', id: owner.postMessage.mock.calls[0][0].id, message: 'grid data 503' })
  await failed
  const retry = service.load()
  const request = owner.postMessage.mock.calls[1][0]
  owner.emit({ type: 'loaded', id: request.id, tiled: false, source, total: 10, cellSize: 1 })
  await expect(retry).resolves.toMatchObject({ total: 10 })
  expect(service.size).toBe(1)
  service.destroy()
})

it('rejects a tiled load if a spare worker failed before it was needed', async () => {
  const service = setup(2)
  const [owner, spare] = FakeWorker.instances
  const loading = service.load()
  spare.onerror?.({ message: 'worker import failed' })
  const rejected = expect(loading).rejects.toThrow('worker import failed')
  loaded(owner, true)
  await rejected
  service.destroy()
})
