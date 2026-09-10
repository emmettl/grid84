import { describe, expect, it } from 'vitest'
import { planStrike, PROFILE_RINGS, type Profile } from './solver.ts'
import { buildStrikeStudy } from './strike-study.ts'
import type { AtlasTarget } from './target.ts'
import { FALLBACK_WIND } from './wind.ts'

const warsaw: AtlasTarget = { id: 't:warsaw', osmId: 1, osmType: 'N', osmKey: 'place', osmValue: 'city', name: 'Warsaw', label: 'Poland', countryCode: 'PL', position: [21.01, 52.23] }
const profile: Profile = { within: Object.fromEntries(PROFILE_RINGS.map((r, i) => [r, [120_000, 700_000, 1_500_000, 2_300_000, 2_800_000][i]])), gridName: 'test' }

describe('the generated strike study', () => {
  const plan = planStrike(warsaw, profile)
  it('enacts the plan as a study the engine can run: launch site, target, inbound tracks, detonations, a plume and further reading', () => {
    expect('failure' in plan).toBe(false)
    if ('failure' in plan) return
    const study = buildStrikeStudy(plan, FALLBACK_WIND)
    const sites = study.entities.filter((e) => e.kind === 'site')
    const tracks = study.entities.filter((e) => e.kind === 'track')
    const effects = study.entities.filter((e) => e.kind === 'effect')
    expect(sites.map((s) => s.id)).toContain('target-site')
    expect(tracks.length).toBeGreaterThanOrEqual(plan.sizing.missiles)
    expect(effects).toHaveLength(plan.sizing.warheads)
    expect(effects.every((e) => e.kind === 'effect' && e.burst === 'surface' && e.fallout)).toBe(true)
    expect(study.defaultBurst).toBe('surface')
    expect(study.populationGrid).toBe('ghsl/popc_2025')
    expect(study.events.some((e) => /LAUNCH/.test(e.text))).toBe(true)
    expect(study.events.some((e) => /DETONATION/.test(e.text))).toBe(true)
    expect(study.bounds.end).toBeGreaterThan(plan.delivery.flightSeconds)
    expect(study.links?.length).toBeGreaterThan(2)
    const first = study.events.find((e) => /DETONATION/.test(e.text))
    expect(first?.time).toBeCloseTo(plan.delivery.flightSeconds, -1)
  })
})
