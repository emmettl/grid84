import { readFile, writeFile } from 'node:fs/promises'
const path = process.argv[2] ?? `${process.env.PERF_OUT ?? '.cache/mobile-performance'}/raw.json`
const report = JSON.parse(await readFile(path, 'utf8'))
const percentile = (xs, p) => xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] : null
const rows = []
for (const run of report.runs) {
  for (const name of ['front', 'orbit', 'atlas', 'study']) {
    const s = run[name]
    if (!s) { if (run[`${name}Error`]) rows.push({ run: run.run, scenario: name, error: run[`${name}Error`] }); continue }
    const descent = name === 'atlas'
    const entries = descent ? s.requests.filter((r) => r.phase === 'descent') : s.requests
    const frames = s.timing.frames.filter((f) => !descent || f.phase === 'descent').map((f) => f.ms)
    const tasks = s.timing.longTasks.filter((t) => !descent || t.phase === 'descent').map((t) => t.ms)
    const categories = {}
    for (const r of entries) {
      const c = categories[r.category] ??= { requests: 0, bytes: 0, failures: 0, cancelled: 0 }
      c.requests++
      c.bytes += r.replayed ? 0 : (r.responseBodySize ?? 0) + (r.responseHeadersSize ?? 0)
      if (r.failure === 'net::ERR_ABORTED') c.cancelled++
      else if (r.failure || r.error || r.status >= 400) c.failures++
    }
    const metrics = Object.fromEntries(s.metrics.map((m) => [m.name, m.value]))
    rows.push({ run: run.run, scenario: name,
      readyMs: name === 'front' ? run.frontReadyMs : name === 'orbit' ? run.atlasReadyMs : name === 'atlas' ? run.acquiredMs : run.studyControlsReadyMs,
      lcpMs: descent ? null : s.timing.lcp.at(-1),
      requests: entries.length, bytes: Object.values(categories).reduce((n, c) => n + c.bytes, 0), categories,
      pending: s.inflight.filter((r) => !descent || r.phase === 'descent').length,
      frameP50Ms: percentile(frames, .5), frameP95Ms: percentile(frames, .95), frameOver50Ms: frames.filter((x) => x > 50).length,
      longTasks: tasks.length, blockingMs: tasks.reduce((n, ms) => n + ms - 50, 0),
      studyState: s.timing.studyState, workerHeaps: s.workerHeaps, pageHeapBytes: metrics.JSHeapUsedSize, pageDomNodes: metrics.Nodes, errors: s.errors,
      overflow: s.timing.width > s.timing.viewport,
      acquireError: descent ? run.acquireError : undefined,
    })
  }
}
const summary = { measuredAt: report.measuredAt, artifact: report.artifact, localDataCacheControl: report.localDataCacheControl, localCommit: report.localCommit, release: report.release, conditions: report.conditions, browser: report.browser, rows }
await writeFile(path.replace(/raw\.json$/, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
