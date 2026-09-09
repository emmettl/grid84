import { describe, expect, it } from 'vitest'
import { ALERT_FORCE, ALERT_FORCE_DOCUMENTED, compareOptions, forceForOption, GENERATED_FORCE_DOCUMENTED } from './alert-force.ts'

describe('alert force enactment', () => {
  const s = ALERT_FORCE.summary
  it('launches about as many weapons as the briefing says the alert force carried', () => {
    expect(s.weapons / ALERT_FORCE_DOCUMENTED.weapons).toBeGreaterThan(0.85)
    expect(s.weapons / ALERT_FORCE_DOCUMENTED.weapons).toBeLessThan(1.15)
  })
  it('carries about the documented alert-force megatonnage with Mk-28-class bomber weapons', () => {
    expect(s.megatons / ALERT_FORCE_DOCUMENTED.megatons).toBeGreaterThan(0.75)
    expect(s.megatons / ALERT_FORCE_DOCUMENTED.megatons).toBeLessThan(1.25)
  })
  it('covers airfields first, then complexes, and reaches Moscow', () => {
    expect(s.airfieldsCovered).toBeGreaterThan(300)
    expect(s.targetsCovered).toBeGreaterThan(1_000)
    const study = ALERT_FORCE.study
    const moscow = study.entities.find((e) => e.kind === 'effect' && e.name === 'MOSCOW')
    expect(moscow?.kind).toBe('effect')
    const missiles = study.entities.filter((e) => e.kind === 'effect' && /ICBM|IRBM|SLBM/.test(e.designation))
    expect(missiles.length).toBeGreaterThan(50)
    expect(missiles.every((e) => e.designation.startsWith('AIRFIELD'))).toBe(true)
    console.log('ALERT FORCE SUMMARY', JSON.stringify(s), 'entities', study.entities.length)
  })
  it('loses about fifteen percent of the force, as the documented assurance implies', () => {
    expect(s.delivered / s.weapons).toBeGreaterThan(0.8)
    expect(s.delivered / s.weapons).toBeLessThan(0.9)
    expect(s.lostReliability + s.lostPenetration + s.delivered).toBe(s.weapons)
  })
  it('states its omissions and its reference', () => {
    expect(ALERT_FORCE.study.omissions.length).toBeGreaterThan(4)
    expect(ALERT_FORCE.study.outcomeReference?.value).toBe(80_000_000)
  })
})

describe('execution options', () => {
  it('generates to the documented 3,267 weapons and 188 ballistic missiles at option 14', () => {
    const study = forceForOption(14).study
    const sites = study.entities.filter((e) => e.kind === 'site' && !e.id.startsWith('sov-'))
    const weapons = sites.reduce((s, e) => s + Number(/(\d+) WEAPONS/.exec(e.designation)?.[1] ?? 0), 0)
    expect(weapons).toBe(GENERATED_FORCE_DOCUMENTED.weapons)
    const ballistic = sites.filter((e) => /^(ICBM|IRBM|SLBM)/.test(e.designation)).reduce((s, e) => s + Number(/(\d+) WEAPONS/.exec(e.designation)?.[1] ?? 0), 0)
    expect(ballistic).toBe(GENERATED_FORCE_DOCUMENTED.ballistic)
    expect(forceForOption(14)).toBe(forceForOption(14))
    expect(forceForOption(1)).toBe(ALERT_FORCE)
  })
  it('keeps the same target list and the same day for every option, only with more weapons on each target', () => {
    const rows = compareOptions()
    expect(rows).toHaveLength(14)
    for (let i = 1; i < rows.length; i += 1) expect(rows[i].weapons).toBeGreaterThanOrEqual(rows[i - 1].weapons)
    expect(rows[13].weapons).toBeGreaterThan(rows[0].weapons * 1.9)
    const targets = new Set(rows.map((r) => r.targetsCovered))
    // Coverage is bounded by the list, not the force: no option covers more than a few percent more targets than the alert force.
    expect(Math.max(...targets) / Math.min(...targets)).toBeLessThan(1.05)
    expect(rows[13].weaponsPerTarget).toBeGreaterThan(rows[0].weaponsPerTarget)
    // The last detonation is set by the bombers' flight, not by the size of the force.
    expect(Math.abs(rows[13].lastDetonation - rows[0].lastDetonation)).toBeLessThan(3_600)
    console.log('OPTIONS', rows.map((r) => `${r.option}:${r.hours}h ${r.weapons}w ${Math.round(r.megatons)}Mt ${r.targetsCovered}t ×${r.weaponsPerTarget} ${r.delivered}d H+${(r.lastDetonation / 3_600).toFixed(1)}`).join(' | '))
  })
})
