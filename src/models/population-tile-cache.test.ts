import { afterEach, describe, expect, it, vi } from 'vitest'
import { PopulationTileCache } from './population-tile-cache.ts'

const bytes = () => new Response(new Uint8Array([1, 2, 3, 4]))
afterEach(() => vi.unstubAllGlobals())

describe('population tile downloads', () => {
  it('coalesces concurrent requests and reuses downloaded bytes', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve }))
    vi.stubGlobal('fetch', fetcher)
    const cache = new PopulationTileCache()
    const requests = [cache.get('/2025/0_0'), cache.get('/2025/0_0'), cache.get('/2025/0_0')]
    expect(fetcher).toHaveBeenCalledTimes(1)
    finish(bytes())
    const results = await Promise.all(requests)
    expect(results[0]).toBe(results[1])
    expect(new Uint8Array(await cache.get('/2025/0_0'))).toEqual(new Uint8Array([1, 2, 3, 4]))
    expect(fetcher).toHaveBeenCalledTimes(1)
    cache.destroy()
  })

  it('retries failed requests instead of caching rejection', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockImplementation(bytes)
    vi.stubGlobal('fetch', fetcher)
    const cache = new PopulationTileCache()
    await expect(cache.get('/tile')).rejects.toThrow('503')
    expect((await cache.get('/tile')).byteLength).toBe(4)
    expect(fetcher).toHaveBeenCalledTimes(2)
    cache.destroy()
  })

  it('evicts least-recently-used bytes and keeps grid years separate', async () => {
    const fetcher = vi.fn(bytes)
    vi.stubGlobal('fetch', fetcher)
    const cache = new PopulationTileCache(8)
    await cache.get('/1985/0_0')
    await cache.get('/2025/0_0')
    await cache.get('/1985/0_0')
    await cache.get('/2025/0_1')
    await cache.get('/1985/0_0')
    expect(fetcher).toHaveBeenCalledTimes(3)
    await cache.get('/2025/0_0')
    expect(fetcher).toHaveBeenCalledTimes(4)
    cache.destroy()
  })

  it('aborts active downloads and refuses work after destruction', async () => {
    let signal!: AbortSignal
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise<Response>((_resolve, reject) => {
      signal = options.signal
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })))
    const cache = new PopulationTileCache()
    const request = cache.get('/tile')
    cache.destroy()
    await expect(request).rejects.toThrow()
    expect(signal.aborted).toBe(true)
    await expect(cache.get('/tile')).rejects.toThrow()
  })
})
