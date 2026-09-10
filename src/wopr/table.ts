import { applyBands, bandPopulations, OTA_BANDS, outcome, radiusForPsi } from '../models/casualties.ts'
import { thirdDegreeBurnRadiusMetres } from '../models/blast.ts'
import { ExposureService } from '../models/exposure-service.ts'
import { resolveGridBase } from '../studies/StudyView.tsx'
import type { LngLat } from '../geo/geodesy.ts'
import type { Posture1983 } from '../studies/window83/window.ts'
import { assignmentsOf, siloSamples, spreadSilos, tableTargets, type DeathTable } from './model.ts'
import { BAND_FRACTIONS, detonation, fieldSpread, laydown } from './union.ts'

/**
 * The target-by-weapon matrix: for every target the search can strike, the
 * dead from one detonation of each yield class the force carries, by the
 * studies' method (the DCPA bands for blast, Postol's bound for fire) over
 * the 1985 grid. Computed once through the exposure workers and kept in the
 * browser, so the search scores a plan in milliseconds. This is the data
 * input, and the panel shows it as such.
 */

const CACHE_PREFIX = 'grid84-wopr-table-v2'
const GRID = 'ghsl/popc_1985'

export interface TableProgress {
  done: number
  total: number
  pass?: 'single' | 'laydown'
}

/** The cache key carries a fingerprint of the target list, so a rebuilt list recomputes. */
function cacheKey(posture: Posture1983): string {
  let h = 0
  for (const t of tableTargets(posture)) h = (h * 31 + Math.abs(Math.round(t.position[0] * 100)) * 7 + Math.abs(Math.round(t.position[1] * 100))) % 1_000_000_007
  return `${CACHE_PREFIX}:${tableTargets(posture).length}:${h}`
}

export async function buildTable(posture: Posture1983, onProgress: (p: TableProgress) => void): Promise<{ table: DeathTable; gridName: string; fromCache: boolean }> {
  const key = cacheKey(posture)
  try {
    const cached = localStorage.getItem(key)
    if (cached) {
      const parsed = JSON.parse(cached) as { table: DeathTable; gridName: string }
      onProgress({ done: 1, total: 1 })
      return { ...parsed, fromCache: true }
    }
  } catch {
    // no cache
  }
  const base = await resolveGridBase(GRID)
  const service = new ExposureService(base, 4)
  const summary = await service.load()
  const gridName = `${summary.source.name} · ${summary.source.year}`
  const targets = tableTargets(posture)
  const samples = siloSamples(posture)
  const jobs: Array<{ id: string; position: LngLat; kt: number }> = []
  for (const t of targets) for (const kt of t.classes) jobs.push({ id: t.id, position: t.position, kt })
  for (const s of samples) jobs.push({ id: s.id, position: s.position, kt: 500 })
  const table: DeathTable = {}
  let done = 0
  onProgress({ done, total: jobs.length, pass: 'single' })
  const run = async (job: { id: string; position: LngLat; kt: number }) => {
    const rings = [...OTA_BANDS.map((b) => ({ key: b.key, radius: radiusForPsi(job.kt, b.minPsi, 'air') })), { key: 'fire', radius: thirdDegreeBurnRadiusMetres(job.kt) }]
    const result = await service.exposure({ center: job.position, rings, subsamples: 2 })
    const o = outcome(applyBands(bandPopulations(result.within)), result.within.fire ?? 0)
    table[job.id] = { ...(table[job.id] ?? {}), [job.kt]: { blast: o.blast.fatal, fire: o.fire.fatal } }
    done += 1
    if (done % 25 === 0 || done === jobs.length) onProgress({ done, total: jobs.length, pass: 'single' })
  }
  const width = 8
  let next = 0
  await Promise.all(
    Array.from({ length: width }, async () => {
      while (next < jobs.length) {
        const job = jobs[next]
        next += 1
        await run(job)
      }
    }),
  )
  spreadSilos(posture, table, samples)
  // The second pass: each target's assigned number of weapons laid down over its area and counted once per person, through the union.
  const assigned = assignmentsOf(posture, table)
  const laid = targets.filter((t) => (assigned.get(t.id)?.count ?? 1) > 1)
  done = 0
  const lanes = 4
  let laidNext = 0
  onProgress({ done: 0, total: laid.length, pass: 'laydown' })
  await Promise.all(
    Array.from({ length: lanes }, async (_, lane) => {
      const key = `wopr-table-${lane}`
      while (laidNext < laid.length) {
        const t = laid[laidNext]
        laidNext += 1
        const a = assigned.get(t.id)
        if (!a) continue
        await service.unionReset(key)
        const totals = await service.union(key, laydown(t.position, a.count, a.kt, fieldSpread(a.category, a.count)).map((c) => detonation(c, a.kt)), BAND_FRACTIONS)
        const row = table[t.id]?.[a.kt]
        if (row) row.laid = Math.max(row.fire, totals.fireDead)
        done += 1
        if (done % 25 === 0 || done === laid.length) onProgress({ done: Math.min(done, laid.length), total: laid.length, pass: 'laydown' })
      }
      await service.unionReset(key)
    }),
  )
  service.destroy()
  try {
    localStorage.setItem(key, JSON.stringify({ table, gridName }))
  } catch {
    // too big for this browser; the next visit recomputes
  }
  return { table, gridName, fromCache: false }
}

export function clearTable(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k)
  } catch {
    // nothing to clear
  }
}
