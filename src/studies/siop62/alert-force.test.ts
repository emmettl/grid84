import { describe, expect, it } from 'vitest'
import { ALERT_FORCE, ALERT_FORCE_DOCUMENTED } from './alert-force.ts'

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
  it('covers several hundred targets and puts missiles on the highest priorities', () => {
    expect(s.targetsCovered).toBeGreaterThan(400)
    const study = ALERT_FORCE.study
    const moscow = study.entities.find((e) => e.kind === 'effect' && e.name === 'MOSCOW')
    expect(moscow?.kind).toBe('effect')
    expect(moscow?.designation).toContain('ICBM')
    console.log('ALERT FORCE SUMMARY', JSON.stringify(s), 'entities', study.entities.length)
  })
  it('states its omissions and its reference', () => {
    expect(ALERT_FORCE.study.omissions.length).toBeGreaterThan(4)
    expect(ALERT_FORCE.study.outcomeReference?.value).toBe(80_000_000)
  })
})
