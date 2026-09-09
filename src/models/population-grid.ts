import type { PopulationGrid } from './exposure.ts'

export interface GridMeta {
  dataset: string
  variable: string
  year: number
  width: number
  height: number
  cellSize: number
  west: number
  south: number
  encoding: string
  totalPopulation: number
  source: string
  licence: string
  /** Tiled grids ship one gzip block per tile under `<base>/tiles/<row>_<col>.bin.gz`. */
  tiled?: boolean
  tileSize?: number
  tilesX?: number
  tilesY?: number
  /** [row, col, population] of every tile that holds anyone; the rest are not fetched. */
  tiles?: Array<[number, number, number]>
}

async function inflate(binResponse: Response): Promise<ArrayBuffer> {
  // Some servers add Content-Encoding: gzip to .gz files and the browser inflates them
  // in transit; others serve the bytes raw. Decide by the gzip magic number, not the name.
  const raw = await binResponse.arrayBuffer()
  const head = new Uint8Array(raw, 0, 2)
  return head[0] === 0x1f && head[1] === 0x8b ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : raw
}

/**
 * A grid too large to hold whole, such as GHSL at 30 arc seconds: tiles are
 * fetched on demand and kept, and `window` cuts a dense grid around a box
 * for the exposure functions, which then run unchanged.
 */
export class TiledPopulationGrid {
  readonly width: number
  readonly height: number
  readonly cellSize: number
  readonly west: number
  readonly south: number
  readonly source: PopulationGrid['source']
  readonly total: number
  private readonly tileSize: number
  private readonly present = new Set<string>()
  private readonly loaded = new Map<string, Float32Array>()
  private readonly inflight = new Map<string, Promise<Float32Array>>()

  constructor(private readonly base: string, meta: GridMeta) {
    this.width = meta.width
    this.height = meta.height
    this.cellSize = meta.cellSize
    this.west = meta.west
    this.south = meta.south
    this.source = { name: meta.dataset, year: meta.year, licence: meta.licence }
    this.total = meta.totalPopulation
    this.tileSize = meta.tileSize ?? 1_200
    for (const [row, col] of meta.tiles ?? []) this.present.add(`${row}_${col}`)
  }

  private async tile(row: number, col: number, signal?: AbortSignal): Promise<Float32Array | null> {
    const key = `${row}_${col}`
    if (!this.present.has(key)) return null
    const have = this.loaded.get(key)
    if (have) return have
    let p = this.inflight.get(key)
    if (!p) {
      p = (async () => {
        const response = await fetch(`${this.base}/tiles/${key}.bin.gz`, { signal })
        if (!response.ok) throw new Error(`tile ${key} ${response.status}`)
        const data = new Float32Array(await inflate(response))
        this.loaded.set(key, data)
        this.inflight.delete(key)
        return data
      })()
      this.inflight.set(key, p)
    }
    return p
  }

  /** A dense grid covering the box, with a margin of one cell, cut from the tiles under it. */
  async window(box: { west: number; south: number; east: number; north: number }, signal?: AbortSignal): Promise<PopulationGrid> {
    const top = this.south + this.height * this.cellSize
    const c0 = Math.max(0, Math.floor((box.west - this.west) / this.cellSize) - 1)
    const c1 = Math.min(this.width - 1, Math.floor((box.east - this.west) / this.cellSize) + 1)
    const r0 = Math.max(0, Math.floor((top - box.north) / this.cellSize) - 1)
    const r1 = Math.min(this.height - 1, Math.floor((top - box.south) / this.cellSize) + 1)
    const width = Math.max(0, c1 - c0 + 1)
    const height = Math.max(0, r1 - r0 + 1)
    const counts = new Float32Array(width * height)
    const T = this.tileSize
    const tileRows = [Math.floor(r0 / T), Math.floor(r1 / T)]
    const tileCols = [Math.floor(c0 / T), Math.floor(c1 / T)]
    const wanted: Array<[number, number]> = []
    for (let ty = tileRows[0]; ty <= tileRows[1]; ty += 1) for (let tx = tileCols[0]; tx <= tileCols[1]; tx += 1) wanted.push([ty, tx])
    const tiles = await Promise.all(wanted.map(([ty, tx]) => this.tile(ty, tx, signal)))
    wanted.forEach(([ty, tx], k) => {
      const data = tiles[k]
      if (!data) return
      const rowStart = Math.max(r0, ty * T)
      const rowEnd = Math.min(r1, ty * T + T - 1)
      const colStart = Math.max(c0, tx * T)
      const colEnd = Math.min(c1, tx * T + T - 1)
      for (let row = rowStart; row <= rowEnd; row += 1) {
        const src = (row - ty * T) * T + (colStart - tx * T)
        const dst = (row - r0) * width + (colStart - c0)
        counts.set(data.subarray(src, src + (colEnd - colStart + 1)), dst)
      }
    })
    return { width, height, cellSize: this.cellSize, west: this.west + c0 * this.cellSize, south: top - (r1 + 1) * this.cellSize, counts, source: this.source, partial: true }
  }
}

export async function loadGridMeta(base: string, signal?: AbortSignal): Promise<GridMeta> {
  const metaResponse = await fetch(`${base}.json`, { signal })
  if (!metaResponse.ok) throw new Error(`grid metadata ${metaResponse.status}`)
  return (await metaResponse.json()) as GridMeta
}

/** Fetch `<base>.json` and `<base>.bin.gz` and return a grid in memory. Works in a worker or the page. */
export async function loadPopulationGrid(base: string, signal?: AbortSignal): Promise<PopulationGrid> {
  const meta = await loadGridMeta(base, signal)
  const binResponse = await fetch(`${base}.bin.gz`, { signal })
  if (!binResponse.ok) throw new Error(`grid data ${binResponse.status}`)
  const buffer = await inflate(binResponse)
  const expected = meta.width * meta.height * 4
  if (buffer.byteLength !== expected) throw new Error(`grid is ${buffer.byteLength} bytes, expected ${expected}`)
  return {
    width: meta.width,
    height: meta.height,
    cellSize: meta.cellSize,
    west: meta.west,
    south: meta.south,
    counts: new Float32Array(buffer),
    source: { name: meta.dataset, year: meta.year, licence: meta.licence },
  }
}
