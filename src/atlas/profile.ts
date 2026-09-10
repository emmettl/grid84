import { ExposureService } from '../models/exposure-service.ts'
import { resolveGridBase } from '../studies/StudyView.tsx'
import type { AtlasTarget } from './target.ts'
import { PROFILE_RINGS, type Profile } from './solver.ts'

export const STRIKE_GRID = 'ghsl/popc_2025'

/** Population within rings around the target from the 2025 grid, through one exposure worker. */
export async function readProfile(target: AtlasTarget): Promise<Profile> {
  const base = await resolveGridBase(STRIKE_GRID)
  const service = new ExposureService(base, 1)
  try {
    const summary = await service.load()
    const result = await service.exposure({ center: target.position, rings: PROFILE_RINGS.map((r) => ({ key: String(r), radius: r })), subsamples: 2 })
    const within: Record<number, number> = {}
    for (const r of PROFILE_RINGS) within[r] = result.within[String(r)] ?? 0
    return { within, gridName: `${summary.source.name} · ${summary.source.year}` }
  } finally {
    service.destroy()
  }
}
