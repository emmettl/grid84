import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, extname, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'

const base = process.env.PERF_URL ?? 'http://127.0.0.1:4186/'
const replayGeocoder = process.env.PERF_LIVE_GEOCODER !== '1'
const photon = JSON.parse(await readFile('src/atlas/__fixtures__/photon-responses.json', 'utf8'))['Zürich HB']
let server
if (!process.env.PERF_URL) {
  const root = resolve('dist')
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.gz': 'application/octet-stream' }
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, base).pathname)
      const file = resolve(root, `.${pathname.endsWith('/') ? pathname + 'index.html' : pathname}`)
      if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return }
      let data = await readFile(file)
      const extension = extname(file)
      const headers = { 'Content-Type': mime[extension] ?? 'application/octet-stream', 'Cache-Control': extname(file) === '.gz' ? 'public, max-age=86400, must-revalidate' : 'public, max-age=0, must-revalidate' }
      if (/\.(html|js|css|json|svg)$/.test(file) && request.headers['accept-encoding']?.includes('gzip')) {
        data = gzipSync(data)
        headers['Content-Encoding'] = 'gzip'
        headers.Vary = 'Accept-Encoding'
      }
      headers['Content-Length'] = data.byteLength
      response.writeHead(200, headers).end(request.method === 'HEAD' ? undefined : data)
    } catch { response.writeHead(404).end() }
  })
  await new Promise((ready, reject) => { server.once('error', reject); server.listen(4186, '127.0.0.1', ready) })
}
const repeats = Number(process.env.PERF_RUNS ?? 3)
const scenarios = (process.env.PERF_SCENARIOS ?? 'front,atlas,study').split(',')
const studyWindow = Number(process.env.PERF_STUDY_SECONDS ?? 60)
if (!Number.isInteger(repeats) || repeats < 1 || !Number.isFinite(studyWindow) || studyWindow < 1 || scenarios.some((name) => !['front', 'atlas', 'study'].includes(name))) throw new Error('Invalid performance run settings')
const out = process.env.PERF_OUT ?? '.cache/mobile-performance'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const browserCdp = await browser.newBrowserCDPSession()
let messageId = 0
async function workerHeaps() {
  const { targetInfos } = await browserCdp.send('Target.getTargets')
  const heaps = []
  for (const target of targetInfos.filter((t) => t.type === 'worker')) {
    let sessionId
    try {
      ;({ sessionId } = await browserCdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false }))
      const id = ++messageId
      const usage = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { browserCdp.off('Target.receivedMessageFromTarget', receive); reject(new Error('worker heap timeout')) }, 5_000)
        function receive(event) {
          const message = JSON.parse(event.message)
          if (event.sessionId !== sessionId || message.id !== id) return
          clearTimeout(timer)
          browserCdp.off('Target.receivedMessageFromTarget', receive)
          if (message.error) reject(new Error(message.error.message))
          else resolve(message.result)
        }
        browserCdp.on('Target.receivedMessageFromTarget', receive)
        browserCdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method: 'Runtime.getHeapUsage' }) }).catch(reject)
      })
      heaps.push({ url: target.url, ...usage })
    } catch (error) { heaps.push({ url: target.url, error: String(error) }) }
    finally { if (sessionId) await browserCdp.send('Target.detachFromTarget', { sessionId }).catch(() => {}) }
  }
  return heaps
}

const report = {
  measuredAt: new Date().toISOString(), base,
  localCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
  mapStyleDiff: execFileSync('git', ['diff', '--', 'src/map/style.ts'], { encoding: 'utf8' }),
  browser: browser.version(),
  artifact: process.env.PERF_URL ? 'remote release, see release marker' : 'local production dist, gzip HTTP server; run npm run build first',
  localDataCacheControl: 'public, max-age=86400, must-revalidate (matches published dense-grid headers)',
  conditions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, mobile: true, touch: true, pageCpuSlowdown: 4, downloadBitsPerSecond: 4_000_000, uploadBitsPerSecond: 1_000_000, latencyMs: 150, cache: 'fresh browser context per scenario; HTTP cache enabled within each scenario', rendering: 'headless Chromium, SwiftShader; not physical-phone GPU or thermal measurements', phaseWindow: `front 15s; orbit 20s; descent 25s from target entry; study ${studyWindow}s after RUN`, target: 'Zürich HB', geocoder: replayGeocoder ? 'recorded real Photon response, 11 September 2026; excluded from transfer totals' : 'live Photon', note: 'Live services; failed and in-flight requests are recorded. Main-page CDP emulation does not establish identical throttling in every worker. Transfer sums include completed requests from dedicated workers through Playwright context events. Page heap excludes workers. Worker Runtime.getHeapUsage includes backing storage where Chromium reports it; neither is total browser or GPU memory.' }, runs: [],
}
try {
  const response = await fetch(new URL('_release.json', base))
  report.release = response.ok ? await response.json() : { status: response.status }
} catch (error) { report.release = { error: String(error) } }

function category(url) {
  const u = new URL(url)
  if (/terrarium|terrain|elevation/i.test(url)) return 'terrain'
  if (/tiles\.grid84|r2\.dev|\/data\/(ghsl|hyde)|popc_|\.bin\.gz/.test(url)) return 'population'
  if (/openfreemap|\.pbf(?:\?|$)|sprite|glyph/i.test(url)) return 'basemap'
  if (u.hostname === new URL(base).hostname) return 'app'
  return 'other-service'
}

async function instrument() {
  const context = await browser.newContext({ viewport: report.conditions.viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'no-preference', serviceWorkers: 'block' })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  // Routing through Playwright disables the HTTP cache. Replay just Photon
  // inside the page instead, preserving real tile-cache behaviour.
  if (replayGeocoder) await page.addInitScript((fixture) => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input, options) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.startsWith('https://photon.komoot.io/')) return Promise.resolve(new Response(JSON.stringify(fixture), { headers: { 'Content-Type': 'application/json' } }))
      return nativeFetch(input, options)
    }
  }, photon)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 4_000_000 / 8, uploadThroughput: 1_000_000 / 8, connectionType: 'cellular4g' })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await cdp.send('Performance.enable')
  await page.addInitScript(() => {
    const state = { phase: 'load', frames: [], longTasks: [], lcp: [], phaseStart: performance.now() }
    window.__mobileMeasure = state
    new PerformanceObserver((list) => { for (const e of list.getEntries()) state.longTasks.push({ phase: state.phase, ms: e.duration }) }).observe({ type: 'longtask', buffered: true })
    new PerformanceObserver((list) => { for (const e of list.getEntries()) state.lcp.push(e.startTime) }).observe({ type: 'largest-contentful-paint', buffered: true })
    let last = performance.now()
    function frame(now) { state.frames.push({ phase: state.phase, ms: now - last }); last = now; requestAnimationFrame(frame) }
    requestAnimationFrame(frame)
  })
  let phase = 'load'
  const requests = new Map()
  const entries = []
  const sizing = []
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  context.on('request', (request) => requests.set(request, { phase, started: Date.now(), url: request.url(), category: category(request.url()), replayed: replayGeocoder && new URL(request.url()).hostname === 'photon.komoot.io' }))
  context.on('requestfinished', (request) => sizing.push((async () => {
    const entry = requests.get(request)
    if (!entry) return
    requests.delete(request)
    const response = await request.response()
    try { entries.push({ ...entry, status: response?.status(), elapsedMs: Date.now() - entry.started, ...await request.sizes() }) }
    catch (error) { entries.push({ ...entry, error: String(error) }) }
  })()))
  context.on('requestfailed', (request) => {
    const entry = requests.get(request)
    if (entry) entries.push({ ...entry, failure: request.failure()?.errorText })
    requests.delete(request)
  })
  async function mark(name) {
    phase = name
    await page.evaluate((name) => { if (window.__mobileMeasure) window.__mobileMeasure.phase = name }, name)
  }
  async function snapshot(name) {
    await Promise.all(sizing)
    const timing = await page.evaluate(() => {
      const s = window.__mobileMeasure
      return { ...s, paints: performance.getEntriesByType('paint').map((e) => ({ name: e.name, ms: e.startTime })), navigation: performance.getEntriesByType('navigation').map((e) => ({ domContentLoadedMs: e.domContentLoadedEventEnd, loadMs: e.loadEventEnd })), width: document.documentElement.scrollWidth, viewport: innerWidth,
        studyState: document.querySelector('.study-hud') ? {
          clock: document.querySelector('.clock-time')?.textContent,
          computed: document.querySelector('.aggregate [role="progressbar"]')?.getAttribute('aria-valuenow'),
          total: document.querySelector('.aggregate [role="progressbar"]')?.getAttribute('aria-valuemax'),
        } : null }
    })
    const metrics = (await cdp.send('Performance.getMetrics')).metrics
    const result = { name, timing, metrics, workerHeaps: await workerHeaps(), requests: [...entries], inflight: [...requests.values()], errors: [...errors] }
    await page.screenshot({ path: `${out}/${name}.png` })
    return result
  }
  return { page, context, mark, snapshot }
}

try {
  for (let run = 1; run <= repeats; run++) {
    const results = { run }
    report.runs.push(results)
    for (const scenario of scenarios) {
      const { page, context, mark, snapshot } = await instrument()
      try {
        const route = scenario === 'front' ? '#/' : scenario === 'atlas' ? '#/atlas' : '#/study/siop62-alert/2'
        const start = Date.now()
        await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 90_000 })
        await mark(scenario === 'atlas' ? 'orbit' : scenario)
        if (scenario === 'front') {
          await page.locator('.front').waitFor({ timeout: 90_000 })
          results.frontReadyMs = Date.now() - start
          await page.waitForTimeout(15_000)
        } else if (scenario === 'atlas') {
          await page.getByRole('heading', { name: 'Orbital standby' }).waitFor({ timeout: 90_000 })
          results.atlasReadyMs = Date.now() - start
          await page.waitForTimeout(20_000)
          results.orbit = await snapshot(`run-${run}-orbit`)
          await mark('descent')
          const acquireStart = Date.now()
          await page.getByRole('combobox', { name: 'ENTER TARGET' }).fill('Zürich HB')
          await page.getByRole('button', { name: 'Acquire', exact: true }).click()
          try {
            const console = page.getByRole('region', { name: 'Strike console' })
            await console.waitFor({ timeout: 45_000 })
            results.acquiredMs = Date.now() - acquireStart
            await console.getByRole('button', { name: 'Hold', exact: true }).click()
          } catch (error) { results.acquireError = String(error) }
          await page.waitForTimeout(Math.max(0, 25_000 - (Date.now() - acquireStart)))
        } else {
          await page.getByRole('region', { name: 'Study clock' }).waitFor({ timeout: 90_000 })
          results.studyControlsReadyMs = Date.now() - start
          await page.getByRole('button', { name: 'RUN', exact: true }).click()
          await mark('playback')
          await page.waitForTimeout(studyWindow * 1_000)
        }
        results[scenario] = await snapshot(`run-${run}-${scenario}`)
      } catch (error) { results[`${scenario}Error`] = String(error) }
      finally { await context.close() }
      await writeFile(`${out}/raw.json`, JSON.stringify(report, null, 2))
      console.log(`run ${run}: ${scenario} complete`)
    }
    await writeFile(`${out}/raw.json`, JSON.stringify(report, null, 2))
  }
} finally { await browser.close(); if (server) await new Promise((done) => server.close(done)) }
console.log(`Saved ${out}/raw.json`)

if (report.runs.some((run) => Object.keys(run).some((key) => key.endsWith('Error')))) {
  console.error('One or more scenarios did not complete; inspect raw.json before using the measurements.')
  process.exitCode = 1
}
