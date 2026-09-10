import { describe, expect, it } from 'vitest'
import { sevenDays, sevenDaysArithmetic } from './seven-days.ts'

describe('Seven Days to the River Rhine', () => {
  const study = sevenDays()
  it('draws both halves in the plan\'s own order: the premise on Poland, then the answer westward', () => {
    const a = sevenDaysArithmetic()
    expect(a.west).toBe(12)
    expect(a.poland).toBe(8)
    expect(a.pactWarheads).toBe(160)
    const events = study.events.map((e) => e.text)
    const premise = study.events.findIndex((e) => /ASSUMED NATO STRIKE/.test(e.text))
    const answerAt = study.events.findIndex((e) => /COUNTER-OFFENSIVE/.test(e.text))
    expect(premise).toBeGreaterThanOrEqual(0)
    expect(answerAt).toBeGreaterThan(premise)
    expect(study.events[premise].time).toBeLessThan(study.events[answerAt].time)
    expect(events.some((t) => /NEUTRAL COUNTRY/.test(t))).toBe(true)
  })
  it('strikes the cities the release names, Vienna among them, and says the primary document is not transcribed', () => {
    const effects = study.entities.filter((e) => e.kind === 'effect')
    const names = effects.map((e) => e.name)
    // The deep targets go by missile and arrive; some of the near ones are flown at and lost, which is the point of the aviation's odds.
    for (const city of ['Brussels', 'Vienna', 'Verona', 'Amsterdam']) expect(names).toContain(city)
    expect(names.filter((n) => ['Brussels', 'Antwerp', 'Amsterdam', 'Utrecht', 'Copenhagen', 'Hamburg', 'Stuttgart', 'Munich', 'Vienna', 'Verona', 'Vicenza', 'Padua'].includes(n)).length).toBeGreaterThanOrEqual(8)
    for (const city of ['Warsaw', 'Gdansk']) expect(names).toContain(city)
    expect(sevenDaysArithmetic().neutral).toEqual(['Vienna'])
    expect(study.omissions.some((o) => /not transcribed here/.test(o))).toBe(true)
    expect(study.omissions.some((o) => /plan's own premise/.test(o))).toBe(true)
    expect(study.populationGrid).toBe('popc_1976')
  })
  it('flies the theatre systems by their own kind: missiles on arcs, the strike aircraft low', () => {
    const tracks = study.entities.filter((e) => e.kind === 'track')
    const air = tracks.filter((t) => t.kind === 'track' && t.vehicle === 'aircraft')
    expect(air.length).toBeGreaterThan(0)
    const lowest = Math.min(...air.flatMap((t) => (t.kind === 'track' ? [t.track.waypoints[t.track.waypoints.length - 1].altitude ?? 0] : [0])))
    expect(lowest).toBeLessThan(1_000)
    const ballistic = tracks.filter((t) => t.kind === 'track' && t.vehicle === 'missile')
    expect(Math.max(...ballistic.flatMap((t) => (t.kind === 'track' ? t.track.waypoints.map((w) => w.altitude ?? 0) : [0])))).toBeGreaterThan(50_000)
  })
})
