import { describe, expect, it } from 'vitest'
import { CUBA_DOCUMENTED, cubaGeneral, cubaRegional, cubaSummary } from './crisis.ts'

describe('Cuba 1962, the regional exchange', () => {
  it('fires the documented weapons and no more', () => {
    const study = cubaRegional()
    const s = cubaSummary()
    expect(s.r12.weapons).toBeLessThanOrEqual(CUBA_DOCUMENTED.r12.missiles)
    expect(s.r12.weapons).toBeGreaterThan(8)
    expect(s.fkr.weapons).toBe(8)
    expect(s.luna.weapons).toBeLessThanOrEqual(CUBA_DOCUMENTED.luna.warheads)
    expect(s.luna.weapons).toBeGreaterThan(0)
    const effects = study.entities.filter((e) => e.kind === 'effect')
    expect(effects.some((e) => /Guantánamo/.test(e.name))).toBe(true)
    expect(effects.some((e) => e.name === 'Washington' || /Homestead|MacDill/.test(e.name))).toBe(true)
    // The R-14 sites are drawn as withheld capability, not force.
    expect(study.entities.filter((e) => e.kind === 'site' && e.evidence === 'withheld')).toHaveLength(3)
    expect(study.populationGrid).toBe('popc_1962')
    expect(study.events.some((e) => /OPLAN 312/.test(e.text))).toBe(true)
    console.log('CUBA', JSON.stringify(s), 'entities', study.entities.length)
  })
  it('lands a week after the strike and fires the Lunas after the landing', () => {
    const study = cubaRegional()
    const lunas = study.entities.filter((e) => e.kind === 'effect' && e.id.startsWith('luna-'))
    for (const l of lunas) expect(l.kind === 'effect' && l.time).toBeGreaterThan(7 * 86_400)
    const r12 = study.entities.filter((e) => e.kind === 'effect' && e.id.startsWith('r12-'))
    for (const r of r12) expect(r.kind === 'effect' && r.time).toBeLessThan(5 * 3_600)
  })
})

describe('Cuba 1962, the general war', () => {
  it('is the option-14 force with the Cuban sites in front of it', () => {
    const study = cubaGeneral()
    expect(study.id).toBe('cuba-62-general')
    expect(study.populationGrid).toBe('popc_1962')
    expect(study.entities.filter((e) => e.kind === 'site' && e.id.startsWith('cuba-')).length).toBeGreaterThan(20)
    expect(study.entities.filter((e) => e.kind === 'track').length).toBeGreaterThan(3_000)
    expect(study.variants?.items.map((i) => i.id)).toEqual(['regional', 'general'])
  })
})
