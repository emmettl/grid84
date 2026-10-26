import { afterEach, describe, expect, it, vi } from 'vitest'
import { PopulationTileCache } from './population-tile-cache.ts'
import { exposure } from './exposure.ts'
import { TiledPopulationGrid, type GridMeta } from './population-grid.ts'

/** A 2 by 2 tile grid of 4-cell tiles at one degree per cell over 0..8E, 0..8N; tile (r, c) holds value 10r + c in every cell. */
const meta: GridMeta = {
  dataset: 'test',
  variable: 'popc',
  year: 2025,
  width: 8,
  height: 8,
  cellSize: 1,
  west: 0,
  south: 0,
  encoding: 'test',
  totalPopulation: 0,
  source: 'test',
  licence: 'none',
  tiled: true,
  tileSize: 4,
  tilesX: 2,
  tilesY: 2,
  tiles: [
    [0, 0, 0],
    [0, 1, 16],
    [1, 0, 160],
    [1, 1, 176],
  ],
}

function fakeFetch(): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    const m = /tiles\/(\d+)_(\d+)\.bin\.gz$/.exec(url)
    if (!m) return new Response(null, { status: 404 })
    const value = Number(m[1]) * 10 + Number(m[2])
    const data = new Float32Array(16).fill(value)
    return new Response(data.buffer, { status: 200 })
  }) as unknown as typeof fetch
}

describe('TiledPopulationGrid', () => {
  const original = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = original
  })

  it('cuts a window from the tiles under a box and fetches each tile once', async () => {
    const fetchMock = fakeFetch()
    globalThis.fetch = fetchMock
    const grid = new TiledPopulationGrid('http://test/grid', meta)
    // A box straddling all four tiles: 3..5E, 3..5N.
    const w = await grid.window({ west: 3.2, south: 3.2, east: 4.8, north: 4.8 })
    expect(w.partial).toBe(true)
    expect(w.cellSize).toBe(1)
    // Margin of one cell: columns 2..5, rows for 2..6N.
    expect(w.west).toBe(2)
    expect(w.width).toBe(4)
    expect(w.height).toBe(4)
    // Row 0 of the window is the northern edge (lat 5..6): tile row 0 (values 0 and 1), then tile row 1 below.
    expect(Array.from(w.counts.subarray(0, 4))).toEqual([0, 0, 1, 1])
    expect(Array.from(w.counts.subarray(12, 16))).toEqual([10, 10, 11, 11])
    expect(fetchMock).toHaveBeenCalledTimes(4)
    await grid.window({ west: 3, south: 3, east: 4, north: 4 })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('shares downloads across worker-local grids without changing exposure results', async () => {
    const fetchMock = fakeFetch()
    globalThis.fetch = fetchMock
    const cache = new PopulationTileCache()
    const fetchTile = async (url: string) => new Response((await cache.get(url)).slice(0))
    const grids = Array.from({ length: 4 }, () => new TiledPopulationGrid('http://test/grid', meta, fetchTile))
    const box = { west: 3.2, south: 3.2, east: 4.8, north: 4.8 }
    const windows = await Promise.all(grids.map((grid) => grid.window(box)))
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const request = { center: [4, 4] as const, rings: [{ key: 'a', radius: 500_000 }], subsamples: 2 }
    const reference = exposure(await new TiledPopulationGrid('http://test/grid', meta).window(box), request)
    expect(reference.within.a).toBeGreaterThan(0)
    for (const window of windows) expect(exposure(window, request)).toEqual(reference)
    cache.destroy()
  })

  it('retries a tile after its download fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockImplementation(fakeFetch())
    globalThis.fetch = fetchMock
    const grid = new TiledPopulationGrid('http://test/grid', { ...meta, tiles: [[1, 1, 176]] })
    const box = { west: 6, south: 1, east: 7, north: 2 }
    await expect(grid.window(box)).rejects.toThrow('503')
    expect((await grid.window(box)).counts.some((value) => value > 0)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('skips tiles the index says are empty and clamps at the window edge', async () => {
    const fetchMock = fakeFetch()
    globalThis.fetch = fetchMock
    const grid = new TiledPopulationGrid('http://test/grid', { ...meta, tiles: [[1, 1, 176]] })
    const w = await grid.window({ west: 0.5, south: 0.5, east: 7.5, north: 7.5 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    let sum = 0
    for (const v of w.counts) sum += v
    expect(sum).toBe(11 * 16)
    // Exposure over the window counts only what is in it, without wrapping round the world.
    const r = exposure(w, { center: [7, 1], rings: [{ key: 'a', radius: 500_000 }], subsamples: 2 })
    expect(r.within.a).toBeGreaterThan(0)
    expect(r.within.a).toBeLessThanOrEqual(11 * 16)
  })
})
