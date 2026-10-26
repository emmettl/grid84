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

it('brokers tile replies to the requesting workers without consuming exposure jobs', async () => {
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('navigator', { hardwareConcurrency: 4 })
  const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4])))
  vi.stubGlobal('fetch', fetcher)
  const service = new ExposureService('/grid', 2)
  const [a, b] = FakeWorker.instances
  const loaded = service.load()
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
    worker.emit({ type: 'loaded', id: load.id, source: { name: 'test', year: 2025, licence: 'none' }, total: 10, cellSize: 1 })
  }
  await expect(loaded).resolves.toMatchObject({ total: 10 })
  service.destroy()
  expect(a.terminate).toHaveBeenCalledTimes(1)
})
