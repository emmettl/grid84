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
