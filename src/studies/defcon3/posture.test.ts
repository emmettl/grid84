import { describe, expect, it } from 'vitest'
import { DEFCON3_DOCUMENTED, defcon3Execute, defcon3Giant, defcon3Posture, defcon3Summary } from './posture.ts'

describe('DEFCON 3 posture', () => {
  it('draws both forces and climbs the documented ladder', () => {
    const study = defcon3Posture()
    const sites = study.entities.filter((e) => e.kind === 'site')
    expect(sites.length).toBeGreaterThan(60)
    const usIcbm = sites.filter((e) => /MM|Titan/.test(e.designation))
    expect(usIcbm.length).toBe(9)
    expect(study.events.some((e) => /DEFCON III/.test(e.text))).toBe(true)
    expect(study.events.some((e) => /75 B-52/.test(e.text))).toBe(true)
    const tracks = study.entities.filter((e) => e.kind === 'track')
    expect(tracks.filter((t) => t.id.startsWith('recall')).length).toBe(5)
    expect(tracks.filter((t) => t.id.startsWith('cv-')).length).toBe(3)
    expect(study.variants?.items.map((i) => i.id)).toEqual(['posture', 'execute', 'giant'])
  })
  it('fields the documented 1,054 American ICBMs and stays under the SALT I Soviet ceiling', () => {
    const study = defcon3Posture()
    const icbm = (side: 'attacker' | 'defender') =>
      study.entities
        .filter((e) => e.kind === 'site' && /MM|Titan|SS-/.test(e.designation) && (side === 'attacker' ? !/SS-/.test(e.designation) : /SS-/.test(e.designation)))
        .reduce((s, e) => s + [...e.designation.matchAll(/(\d+) (MM I{1,3}|Titan II|SS-\d+)/g)].reduce((a, m) => a + Number(m[1]), 0), 0)
    expect(icbm('attacker')).toBe(DEFCON3_DOCUMENTED.usIcbm)
    expect(icbm('defender')).toBeLessThan(DEFCON3_DOCUMENTED.sovietIcbmCeiling)
    expect(icbm('defender')).toBeGreaterThan(1_400)
  })
})

describe('SIOP-4 executed', () => {
  it('assigns thousands of weapons a side, covers the fields first, and leaves the rest unassigned rather than inventing targets', () => {
    const { us, su } = defcon3Summary()
    expect(us.weapons).toBeGreaterThan(3_000)
    expect(us.weapons).toBeLessThan(6_000)
    expect(su.weapons).toBeGreaterThan(1_000)
    expect(us.unassigned + us.weapons).toBeGreaterThan(5_000)
    expect(su.firstDetonation).toBeGreaterThan(us.firstDetonation - 3_600)
    expect(us.delivered / us.weapons).toBeGreaterThan(0.6)
    const study = defcon3Execute()
    const effects = study.entities.filter((e) => e.kind === 'effect')
    expect(effects.some((e) => e.name.startsWith('Kozelsk'))).toBe(true)
    expect(effects.some((e) => e.name === 'New York' && e.side === 'defender')).toBe(true)
    expect(study.bounds.end).toBeGreaterThan(Math.max(us.lastDetonation, su.lastDetonation))
    expect(study.populationGrid).toBe('popc_1973')
    console.log('DEFCON3 US', JSON.stringify(us), 'SU', JSON.stringify(su), 'entities', study.entities.length)
  })
})

describe('1969 readiness test', () => {
  it('flies eighteen B-52s in three waves of six over Alaska and draws nothing on the Soviet side', () => {
    const study = defcon3Giant()
    const sorties = study.entities.filter((e) => e.kind === 'track' && e.id.startsWith('giant-'))
    expect(sorties).toHaveLength(18)
    const first = sorties[0]
    expect(first.kind === 'track' && first.track.end - first.track.start).toBeGreaterThan(12 * 3_600)
    expect(first.kind === 'track' && first.track.end - first.track.start).toBeLessThan(20 * 3_600)
    expect(study.entities.some((e) => e.kind === 'site' && /SS-/.test(e.designation))).toBe(false)
    expect(study.events.some((e) => /GIANT LANCE/.test(e.text))).toBe(true)
    expect(study.bounds.end).toBeGreaterThan(20 * 86_400)
  })
})
