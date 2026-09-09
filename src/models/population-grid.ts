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
}

/** Fetch `<base>.json` and `<base>.bin.gz` and return a grid in memory. Works in a worker or the page. */
export async function loadPopulationGrid(base: string, signal?: AbortSignal): Promise<PopulationGrid> {
  const metaResponse = await fetch(`${base}.json`, { signal })
  if (!metaResponse.ok) throw new Error(`grid metadata ${metaResponse.status}`)
  const meta = (await metaResponse.json()) as GridMeta
  const binResponse = await fetch(`${base}.bin.gz`, { signal })
  if (!binResponse.ok) throw new Error(`grid data ${binResponse.status}`)
  // Some servers add Content-Encoding: gzip to .gz files and the browser inflates them
  // in transit; others serve the bytes raw. Decide by the gzip magic number, not the name.
  const raw = await binResponse.arrayBuffer()
  const head = new Uint8Array(raw, 0, 2)
  const buffer = head[0] === 0x1f && head[1] === 0x8b ? await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : raw
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
