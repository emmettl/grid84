import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBoundaryLoader, extentRing, fetchBoundary, ringsOf, type Boundary } from './boundary.ts'
import type { AtlasTarget } from './target.ts'

const target = (osmId: number): AtlasTarget => ({
  id: `R:${osmId}`, osmId, osmType: 'R', osmKey: 'place', osmValue: 'city',
  name: 'Boundary specimen', label: '', countryCode: 'CH', position: [8.5, 47.4],
  extent: [8.4, 47.5, 8.7, 47.3],
})
const polygon: Boundary = { rings: [extentRing([8.4, 47.5, 8.7, 47.3])], kind: 'polygon', source: 'specimen' }
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

afterEach(() => vi.unstubAllGlobals())

describe('the target boundary', () => {
  it('takes the outer rings of polygons and multipolygons and nothing else', () => {
    expect(ringsOf({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]], [[0.2, 0.2], [0.3, 0.2], [0.3, 0.3], [0.2, 0.2]]] })).toEqual([[[0, 0], [1, 0], [1, 1], [0, 0]]])
    expect(ringsOf({ type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[5, 5], [6, 5], [6, 6], [5, 5]]]] })).toHaveLength(2)
    expect(ringsOf({ type: 'Point', coordinates: [1, 2] })).toEqual([])
    expect(ringsOf(null)).toEqual([])
  })
  it('turns the geocoder extent into a closed box', () => {
    const r = extentRing([8.4, 47.5, 8.7, 47.3])
    expect(r).toHaveLength(5)
    expect(r[0]).toEqual([8.4, 47.3])
    expect(r[4]).toEqual(r[0])
  })

  it.each([1, 2])('keeps the newest boundary when an older fetch finishes last (next target %s)', async (nextId) => {
    const first = pending<Boundary | null>()
    const second = pending<Boundary | null>()
    const fetcher = vi.fn<typeof fetchBoundary>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const loader = createBoundaryLoader(fetcher)
    const apply = vi.fn()
    const oldRequest = loader.load(target(1), apply)
    const newRequest = loader.load(target(nextId), apply)
    expect(fetcher.mock.calls[0][1]?.aborted).toBe(true)
    second.resolve(polygon)
    await newRequest
    first.resolve(null)
    await oldRequest
    expect(apply.mock.calls).toEqual([[polygon]])
  })

  it('does not apply a boundary after standing down or unmounting', async () => {
    const request = pending<Boundary | null>()
    const loader = createBoundaryLoader(() => request.promise)
    const apply = vi.fn()
    const work = loader.load(target(2), apply)
    loader.cancel()
    request.resolve(polygon)
    await work
    expect(apply).not.toHaveBeenCalled()
    // A fresh acquisition still works after cleanup (including StrictMode).
    await loader.load(target(3), apply)
    expect(apply).toHaveBeenCalledWith(polygon)
  })

  it('fetches again after cancellation instead of caching the extent fallback', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }))
      .mockResolvedValueOnce({ ok: true, json: async () => [{ geojson: { type: 'Polygon', coordinates: polygon.rings } }] })
    vi.stubGlobal('fetch', fetcher)
    const place = target(4)
    const interrupted = fetchBoundary(place, controller.signal)
    controller.abort()
    expect(await interrupted).toBeNull()
    expect((await fetchBoundary(place))?.kind).toBe('polygon')
    expect(fetcher).toHaveBeenCalledTimes(2)
    await fetchBoundary(place)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
