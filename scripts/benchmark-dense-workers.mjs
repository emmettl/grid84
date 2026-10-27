/** Compare dense exposure throughput and exact results without changing the pool policy. */
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { thirdDegreeBurnRadiusMetres } from '../src/models/blast.ts'
import { OTA_BANDS, radiusForPsi } from '../src/models/casualties.ts'

const targets = JSON.parse(await readFile('data/siop62/targets-1956-priority.json', 'utf8')).targets
const jobs = targets.flatMap((target) => [100, 1_100, 9_000].map((kt) => ({
  center: [target.lon, target.lat], subsamples: 4,
  rings: [...OTA_BANDS.map((band) => ({ key: band.key, radius: radiusForPsi(kt, band.minPsi, 'air') })), { key: 'fire', radius: thirdDegreeBurnRadiusMetres(kt) }],
})))
const workerFile = (await readdir('dist/assets')).find((name) => /^exposure\.worker-.*\.js$/.test(name))
if (!workerFile) throw new Error('Build the production bundle first')
const server = await preview({ preview: { host: '127.0.0.1', port: 4187, strictPort: true } })
const browser = await chromium.launch({ headless: true })
const report = { measuredAt: new Date().toISOString(), jobCount: jobs.length, method: '870 transcribed SAC targets × 100, 1100 and 9000 kt; unchanged airburst rings and exposure model; four subsamples per cell edge; eight outstanding requests; dense 1961 grid; headless Chromium on host, no CPU/network emulation or map rendering; load excluded from batch time; raw workers deliberately bypass the service single-worker policy for comparison', runs: [] }
let digest
try {
  for (let repeat = 1; repeat <= 3; repeat++) {
    // Alternate order to reduce systematic warm-host/cache bias.
    for (const count of repeat % 2 ? [1, 4] : [4, 1]) {
      const context = await browser.newContext()
      try {
        const page = await context.newPage()
        await page.goto('http://127.0.0.1:4187/#/')
        const result = await page.evaluate(async ({ count, workerFile, jobs }) => {
          let nextId = 0
          const slots = Array.from({ length: count }, () => {
            const worker = new Worker(`/assets/${workerFile}`, { type: 'module' })
            const pending = new Map()
            worker.onmessage = ({ data }) => {
              const job = pending.get(data.id)
              if (!job) return
              pending.delete(data.id)
              if (data.type === 'error') job.reject(new Error(data.message))
              else job.resolve(data)
            }
            worker.onerror = (event) => { for (const p of pending.values()) p.reject(new Error(event.message)); pending.clear() }
            return { worker, pending, busy: 0 }
          })
          async function send(slot, request) {
            const id = ++nextId
            slot.busy++
            try {
              return await new Promise((resolve, reject) => { slot.pending.set(id, { resolve, reject }); slot.worker.postMessage({ id, ...request }) })
            } finally { slot.busy-- }
          }
          try {
            const loadStart = performance.now()
            await Promise.all(slots.map((slot) => send(slot, { type: 'load', base: `${location.origin}/data/hyde/popc_1961` })))
            const loadMs = performance.now() - loadStart
            await Promise.all(slots.map((slot) => send(slot, { type: 'exposure', request: jobs[0] })))
            const results = Array(jobs.length)
            let next = 0
            const start = performance.now()
            await Promise.all(Array.from({ length: 8 }, async () => {
              while (next < jobs.length) {
                const index = next++
                const slot = slots.reduce((best, candidate) => candidate.busy < best.busy ? candidate : best)
                results[index] = (await send(slot, { type: 'exposure', request: jobs[index] })).result
              }
            }))
            return { loadMs, batchMs: performance.now() - start, results }
          } finally { slots.forEach((slot) => slot.worker.terminate()) }
        }, { count, workerFile, jobs })
        const resultDigest = createHash('sha256').update(JSON.stringify(result.results)).digest('hex')
        if (digest && resultDigest !== digest) throw new Error('Exposure results differ between pools')
        digest = resultDigest
        report.runs.push({ repeat, workers: count, loadMs: result.loadMs, batchMs: result.batchMs, resultDigest })
        console.log(`repeat ${repeat}, ${count} worker(s): ${result.batchMs.toFixed(1)} ms, exact results match`)
      } finally { await context.close() }
    }
  }
} finally { await browser.close(); await new Promise((done) => server.httpServer.close(done)) }
await mkdir('.cache/mobile-dense-single', { recursive: true })
await writeFile('.cache/mobile-dense-single/batch.json', JSON.stringify(report, null, 2))
