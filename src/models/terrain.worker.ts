/// <reference lib="webworker" />
import { discStatistics, shadowMap, stepsToTravel, terrainFactor, WaveField, type HeightGrid } from './terrain-shock.ts'

/**
 * Terrain shock worker: fetches Terrarium-encoded elevation tiles for a
 * square box, builds a height grid, computes the line-of-sight shadow, then
 * runs a flat-ground and a with-terrain wave field and streams frames.
 */
export interface PrepareRequest {
  type: 'prepare'
  id: number
  center: [number, number]
  /** Box side in metres. */
  sizeMetres: number
  /** Cells per side. */
  n: number
  hob: number
  tileUrl: string
  /** Radii in metres for the readout statistics, keyed. */
  radii: Record<string, number>
}

export interface RunRequest {
  type: 'run'
  id: number
  /** Distance the front should travel before stopping, metres. */
  travelMetres: number
  /** Steps between streamed frames. */
  frameEvery: number
}

export type TerrainRequest = PrepareRequest | RunRequest

export type TerrainResponse =
  | { type: 'prepared'; id: number; n: number; dx: number; heights: Float32Array; visible: Uint8Array; blockers: Uint8Array; minHeight: number; maxHeight: number; burstHeight: number; stats: Record<string, { visibleFraction: number; cells: number }> }
  | { type: 'frame'; id: number; step: number; totalSteps: number; field: Float32Array }
  | { type: 'done'; id: number; factor: Float32Array; stats: Record<string, { visibleFraction: number; meanFactor: number }> }
  | { type: 'error'; id: number; message: string }

let grid: HeightGrid | null = null
let shadow: ReturnType<typeof shadowMap> | null = null
let burst: { x: number; y: number; hob: number } | null = null
let radii: Record<string, number> = {}

const toRad = (d: number) => (d * Math.PI) / 180

function tileOf(lon: number, lat: number, z: number): [number, number] {
  const scale = 2 ** z
  const x = ((lon + 180) / 360) * scale
  const y = ((1 - Math.log(Math.tan(toRad(lat)) + 1 / Math.cos(toRad(lat))) / Math.PI) / 2) * scale
  return [x, y]
}

async function fetchTile(url: string, z: number, x: number, y: number): Promise<ImageData> {
  const response = await fetch(url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)))
  if (!response.ok) throw new Error(`terrain tile ${z}/${x}/${y} ${response.status}`)
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
}

/** Build an n×n height grid over a square box of `sizeMetres` centred on `center`, from Terrarium tiles. */
async function buildGrid(req: PrepareRequest): Promise<HeightGrid> {
  const [lon0, lat0] = req.center
  const metresPerDegLat = 111_320
  const metresPerDegLon = 111_320 * Math.cos(toRad(lat0))
  const half = req.sizeMetres / 2
  const west = lon0 - half / metresPerDegLon
  const east = lon0 + half / metresPerDegLon
  const north = lat0 + half / metresPerDegLat
  const south = lat0 - half / metresPerDegLat
  const dx = req.sizeMetres / req.n
  // Choose the zoom whose pixels are about as fine as the grid cells.
  const targetMetresPerPixel = dx
  const z = Math.max(6, Math.min(14, Math.round(Math.log2((40_075_016 * Math.cos(toRad(lat0))) / 256 / targetMetresPerPixel))))
  const [tx0, ty0] = tileOf(west, north, z)
  const [tx1, ty1] = tileOf(east, south, z)
  const tiles = new Map<string, ImageData>()
  const jobs: Promise<void>[] = []
  for (let ty = Math.floor(ty0); ty <= Math.floor(ty1); ty += 1) {
    for (let tx = Math.floor(tx0); tx <= Math.floor(tx1); tx += 1) {
      jobs.push(fetchTile(req.tileUrl, z, tx, ty).then((img) => void tiles.set(`${tx}/${ty}`, img)))
    }
  }
  await Promise.all(jobs)
  const h = new Float32Array(req.n * req.n)
  for (let row = 0; row < req.n; row += 1) {
    const lat = north - ((row + 0.5) / req.n) * (north - south)
    for (let col = 0; col < req.n; col += 1) {
      const lon = west + ((col + 0.5) / req.n) * (east - west)
      const [fx, fy] = tileOf(lon, lat, z)
      const tx = Math.floor(fx)
      const ty = Math.floor(fy)
      const img = tiles.get(`${tx}/${ty}`)
      if (!img) continue
      const px = Math.min(img.width - 1, Math.floor((fx - tx) * img.width))
      const py = Math.min(img.height - 1, Math.floor((fy - ty) * img.height))
      const i = (py * img.width + px) * 4
      const r = img.data[i]
      const g = img.data[i + 1]
      const b = img.data[i + 2]
      h[row * req.n + col] = r * 256 + g + b / 256 - 32_768
    }
  }
  return { n: req.n, dx, h }
}

self.onmessage = async (event: MessageEvent<TerrainRequest>) => {
  const message = event.data
  try {
    if (message.type === 'prepare') {
      grid = await buildGrid(message)
      radii = message.radii
      burst = { x: grid.n / 2, y: grid.n / 2, hob: message.hob }
      shadow = shadowMap(grid, burst)
      let min = Infinity
      let max = -Infinity
      for (const v of grid.h) {
        if (v < min) min = v
        if (v > max) max = v
      }
      const stats: Record<string, { visibleFraction: number; cells: number }> = {}
      for (const [key, r] of Object.entries(radii)) {
        const s = discStatistics(grid.n, burst.x, burst.y, r / grid.dx, shadow.visible, null)
        stats[key] = { visibleFraction: s.visibleFraction, cells: s.cells }
      }
      const response: TerrainResponse = { type: 'prepared', id: message.id, n: grid.n, dx: grid.dx, heights: grid.h, visible: shadow.visible, blockers: shadow.blockers, minHeight: min, maxHeight: max, burstHeight: grid.h[Math.round(burst.y) * grid.n + Math.round(burst.x)] + burst.hob, stats }
      self.postMessage(response)
      return
    }
    if (!grid || !shadow || !burst) throw new Error('not prepared')
    const flat = new WaveField(grid.n, grid.dx, null)
    const rough = new WaveField(grid.n, grid.dx, shadow.blockers)
    flat.inject(burst.x, burst.y, 1, 2)
    rough.inject(burst.x, burst.y, 1, 2)
    const total = stepsToTravel(rough, message.travelMetres)
    for (let done = 0; done < total; done += message.frameEvery) {
      const chunk = Math.min(message.frameEvery, total - done)
      flat.advance(chunk)
      rough.advance(chunk)
      const frame = new Float32Array(rough.field)
      const response: TerrainResponse = { type: 'frame', id: message.id, step: rough.step, totalSteps: total, field: frame }
      self.postMessage(response, [frame.buffer])
    }
    // Report the factor only where the flat run carried real amplitude, so the box edges stay quiet.
    let flatMax = 0
    for (const v of flat.peak) if (v > flatMax) flatMax = v
    const factor = terrainFactor(rough.peak, flat.peak, flatMax * 0.02)
    const stats: Record<string, { visibleFraction: number; meanFactor: number }> = {}
    for (const [key, r] of Object.entries(radii)) {
      const s = discStatistics(grid.n, burst.x, burst.y, r / grid.dx, shadow.visible, factor)
      stats[key] = { visibleFraction: s.visibleFraction, meanFactor: s.meanFactor }
    }
    const response: TerrainResponse = { type: 'done', id: message.id, factor, stats }
    self.postMessage(response, [factor.buffer])
  } catch (error) {
    const response: TerrainResponse = { type: 'error', id: message.id, message: error instanceof Error ? error.message : String(error) }
    self.postMessage(response)
  }
}
