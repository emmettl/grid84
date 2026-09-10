import { destinationPoint } from '../geo/sector.ts'
import type { LngLat } from '../geo/geodesy.ts'
import { thirdDegreeBurnRadiusMetres } from '../models/blast.ts'
import { OTA_BANDS, radiusForPsi } from '../models/casualties.ts'
import type { UnionDetonation } from '../models/exposure.ts'
import { ExposureService } from '../models/exposure-service.ts'
import { resolveGridBase } from '../studies/StudyView.tsx'
import type { Posture1983 } from '../studies/window83/window.ts'
import { assignmentsOf, evaluate, type Constraints, type DeathTable, type Plan } from './model.ts'

/**
 * The re-sum: the best plan the search found, laid down weapon by weapon and
 * counted once per person by the studies' union over the 1985 grid. The
 * surrogate counts the largest weapon on each target once; this counts every
 * detonation and never counts a person twice, which is the figure the studies
 * report. It takes seconds rather than microseconds, so it runs on demand.
 */

const GRID = 'ghsl/popc_1985'
export const BAND_FRACTIONS = OTA_BANDS.map((b) => ({ fatal: b.fatal, injured: b.injured }))

export interface UnionResum {
  usDead: number
  suDead: number
  total: number
  usDetonations: number
  suDetonations: number
  gridName: string
}

/** The planner's laydown for several weapons on one target: a sunflower whose spacing lets the 5 psi rings just meet, so the pattern covers the area rather than piling on the centre. */
export function laydown(center: LngLat, count: number, kt: number, spreadMetres?: number): LngLat[] {
  if (count <= 1) return [center]
  const spacing = spreadMetres ?? radiusForPsi(kt, 5, 'air') * 1.6
  const golden = Math.PI * (3 - Math.sqrt(5))
  const out: LngLat[] = []
  for (let i = 0; i < count; i += 1) {
    const r = spacing * Math.sqrt(i / Math.PI)
    out.push(i === 0 ? center : destinationPoint(center, ((i * golden * 180) / Math.PI) % 360, r))
  }
  return out
}

export function detonation(center: LngLat, kt: number): UnionDetonation {
  return { center, bandRadii: OTA_BANDS.map((b) => radiusForPsi(kt, b.minPsi, 'air')), fireRadius: thirdDegreeBurnRadiusMetres(kt) }
}

/** A field of silos is sixty kilometres across; the weapons on it are spread over the field, not the base. */
export function fieldSpread(category: string, n: number): number | undefined {
  return category === 'ICBM FIELD' ? 60_000 / Math.sqrt(Math.max(1, n) / Math.PI) : undefined
}

let shared: { base: string; service: ExposureService; gridName: string } | null = null

async function service(): Promise<{ service: ExposureService; gridName: string }> {
  if (shared) return shared
  const base = await resolveGridBase(GRID)
  const s = new ExposureService(base, 2)
  const summary = await s.load()
  shared = { base, service: s, gridName: `${summary.source.name} · ${summary.source.year}` }
  return shared
}

export async function resumByUnion(posture: Posture1983, table: DeathTable, plan: Plan, constraints: Constraints, onProgress: (done: number, total: number) => void): Promise<UnionResum> {
  const score = evaluate(posture, table, plan, 0, constraints)
  const assigned = assignmentsOf(posture, table)
  const position = new Map<string, LngLat>()
  for (const list of [posture.usCities, posture.usBases, posture.usCommand, posture.siloTargets, posture.sovietForces, posture.sovietCities]) for (const t of list) position.set(t.id, t.position)
  const lay = (struck: Record<string, number>): UnionDetonation[] => {
    const out: UnionDetonation[] = []
    for (const [id, n] of Object.entries(struck)) {
      const a = assigned.get(id)
      const at = position.get(id)
      if (!a || !at || n <= 0) continue
      for (const c of laydown(at, n, a.kt, fieldSpread(a.category, n))) out.push(detonation(c, a.kt))
    }
    return out
  }
  const us = lay(score.struck.us)
  const su = lay(score.struck.su)
  const { service: svc, gridName } = await service()
  const total = us.length + su.length
  let done = 0
  onProgress(done, total)
  const run = async (key: string, list: UnionDetonation[]) => {
    await svc.unionReset(key)
    let totals = { blastDead: 0, fireDead: 0, combinedDead: 0, underPlume: 0 }
    for (let i = 0; i < list.length; i += 200) {
      totals = await svc.union(key, list.slice(i, i + 200), BAND_FRACTIONS)
      done += Math.min(200, list.length - i)
      onProgress(done, total)
    }
    return totals.fireDead
  }
  const [usDead, suDead] = await Promise.all([run('wopr-us', us), run('wopr-su', su)])
  return { usDead, suDead, total: usDead + suDead, usDetonations: us.length, suDetonations: su.length, gridName }
}
