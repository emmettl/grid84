import { describe, expect, it } from 'vitest'
import { adversaryFor } from './adversary.ts'
import { FORCES, POWER_IDS } from './forces.ts'
import { classify, deliveryOptions, planStrike, PROFILE_RINGS, type Profile } from './solver.ts'
import type { AtlasTarget } from './target.ts'

const place = (name: string, cc: string, position: [number, number], key = 'place', value = 'city'): AtlasTarget => ({ id: `t:${name}`, osmId: 1, osmType: 'N', osmKey: key, osmValue: value, name, label: '', countryCode: cc, position })
const profile = (within: number[]): Profile => ({ within: Object.fromEntries(PROFILE_RINGS.map((r, i) => [r, within[i]])), gridName: 'test' })
const warsaw = profile([120_000, 700_000, 1_500_000, 2_300_000, 2_800_000])
const village = profile([300, 1_200, 6_000, 20_000, 60_000])

describe('the atlas solver', () => {
  it('has launch points for all nine powers, every one with a system in range of something', () => {
    for (const p of POWER_IDS) expect(FORCES.some((s) => s.side === p)).toBe(true)
    for (const s of FORCES) {
      expect(s.rangeKm).toBeGreaterThan(0)
      expect(s.yieldKt).toBeGreaterThan(0)
      expect(s.warheadsPerMissile).toBeGreaterThan(0)
    }
  })
  it('names adversaries by a stated rule and says when it falls back to proximity', () => {
    expect(adversaryFor('PL', [21, 52]).power).toBe('ru')
    expect(adversaryFor('US', [-74, 40.7]).power).toBe('ru')
    expect(adversaryFor('RU', [37.6, 55.75]).power).toBe('us')
    expect(adversaryFor('IN', [77.2, 28.6]).power).toBe('pk')
    expect(adversaryFor('IN', [91.7, 26.1]).power).toBe('cn')
    expect(adversaryFor('JP', [139.7, 35.7]).power).toBe('nk')
    expect(adversaryFor('IR', [51.4, 35.7]).power).toBe('il')
    const br = adversaryFor('BR', [-43.2, -22.9])
    expect(br.basis).toBe('proximity')
    expect(br.reason).toMatch(/NO DOCTRINE/)
  })
  it('classifies a city by density and a base by its tags', () => {
    const c = classify(place('Warsaw', 'PL', [21, 52.2]), warsaw)
    expect(c.category).toBe('URBAN-INDUSTRIAL')
    expect(c.countervalue).toBe(true)
    expect(c.urbanRadiusMetres).toBeGreaterThanOrEqual(10_000)
    const b = classify(place('Base', 'PL', [21, 52.2], 'military', 'airfield'), village)
    expect(b.category).toBe('MILITARY')
    expect(b.hard).toBe(true)
    expect(classify(place('Hamlet', 'PL', [21, 52.2]), village).category).toBe('RURAL')
  })
  it('picks the shortest flight in range, so Warsaw draws a theatre missile and New York an ICBM or a boat', () => {
    const w = deliveryOptions('ru', [21, 52.2])
    expect(w[0].inRange).toBe(true)
    expect(w[0].site.system).toMatch(/Iskander/)
    const ny = deliveryOptions('ru', [-74, 40.7])
    expect(ny[0].inRange).toBe(true)
    expect(['icbm', 'slbm']).toContain(ny[0].site.kind)
    expect(ny[0].flightSeconds).toBeGreaterThan(15 * 60)
  })
  it('sizes the laydown to tile the urban area and caps it, and reports when nothing reaches', () => {
    const plan = planStrike(place('Warsaw', 'PL', [21, 52.2]), warsaw)
    expect('failure' in plan).toBe(false)
    if ('failure' in plan) return
    expect(plan.sizing.warheads).toBeGreaterThan(1)
    // A capital of twenty kilometres' radius draws the heavy load, not the nearest theatre missile.
    expect(plan.delivery.site.warheadsPerMissile * plan.delivery.site.yieldKt).toBeGreaterThan(1_000)
    expect(plan.lines.some((l) => /COVERS \d+% OF THE AREA/.test(l))).toBe(true)
    // A city at 5 psi against a megaton-class warhead: accuracy is no longer the question; reliability is.
    expect(plan.kill.sspk).toBeGreaterThan(0.99)
    expect(plan.kill.perWarhead).toBeCloseTo(plan.delivery.site.reliability, 2)
    expect(plan.lines.some((l) => /^KILL PROBABILITY/.test(l))).toBe(true)
    const hard = planStrike(place('Base', 'PL', [21, 52.2], 'military', 'airfield'), village)
    expect('failure' in hard).toBe(false)
    if (!('failure' in hard)) expect(hard.kill.psi).toBe(1_000)
    expect(plan.sizing.aimPoints).toHaveLength(plan.sizing.warheads)
    expect(plan.sizing.missiles).toBeGreaterThanOrEqual(1)
    expect(plan.lines.some((l) => /WEAPON SIZED/.test(l))).toBe(true)
    const nowhere = planStrike(place('Ushuaia', 'AR', [-68.3, -54.8]), village, 'nk')
    expect('failure' in nowhere).toBe(true)
  })
})
