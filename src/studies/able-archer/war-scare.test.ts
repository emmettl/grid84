import { describe, expect, it } from 'vitest'
import { ableArcher, ableArcherSummary } from './war-scare.ts'

describe('Able Archer 83 gone hot', () => {
  it('plays the documented week before the counterfactual morning', () => {
    const study = ableArcher()
    expect(study.bounds.start).toBeLessThan(-170 * 3_600)
    const texts = study.events.map((e) => e.text)
    expect(texts.some((t) => /SACEUR REQUESTS/.test(t))).toBe(true)
    expect(texts.some((t) => /THIRTY-MINUTE ALERT/.test(t))).toBe(true)
    expect(texts.some((t) => /WITHHELD/.test(t))).toBe(true)
    expect(study.entities.filter((e) => e.kind === 'track' && e.id.startsWith('airlift-'))).toHaveLength(12)
    expect(study.entities.some((e) => e.kind === 'site' && e.evidence === 'withheld' && /Greenham/.test(e.name))).toBe(true)
  })
  it('strikes the delivery means first and answers from what survives', () => {
    const { wp, nato } = ableArcherSummary()
    expect(wp.weapons).toBeGreaterThan(60)
    expect(wp.targetsCovered).toBeGreaterThan(15)
    expect(nato.weapons).toBeGreaterThan(5)
    expect(nato.weapons).toBeLessThan(wp.weapons + 400)
    expect(nato.firstDetonation).toBeGreaterThan(wp.firstDetonation)
    const study = ableArcher()
    const effects = study.entities.filter((e) => e.kind === 'effect')
    expect(effects.some((e) => /Schwäbisch Gmünd|Neu-Ulm|Neckarsulm/.test(e.name))).toBe(true)
    expect(effects.some((e) => /Postavy|Lida|Mozyr|Lutsk|Belokorovichi/.test(e.name))).toBe(true)
    expect(study.populationGrid).toBe('popc_1983')
    console.log('ABLE ARCHER WP', JSON.stringify(wp), 'NATO', JSON.stringify(nato), 'entities', study.entities.length)
  })
})
