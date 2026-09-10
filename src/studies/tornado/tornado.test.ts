import { describe, expect, it } from 'vitest'
import { tornadoArithmetic, tornadoStrike } from './tornado.ts'

describe('RAF Germany, 1985', () => {
  it('flies the V-force profile from an aircraft built for it, and loses a large part of the force', () => {
    const a = tornadoArithmetic()
    expect(a.aircraft).toBe(84)
    expect(a.targets).toBe(14)
    expect(a.lossFraction).toBeGreaterThan(0.2)
    expect(a.lossFraction).toBeLessThan(0.7)
    const s = tornadoStrike()
    const air = s.entities.filter((e) => e.kind === 'track' && e.vehicle === 'aircraft' && !/LOST/.test(e.designation))
    expect(air.length).toBeGreaterThan(0)
    const ends = air.map((t) => (t.kind === 'track' ? (t.track.waypoints[t.track.waypoints.length - 1].altitude ?? 0) : 0))
    // On the deck at the target, having transited at height.
    expect(Math.min(...ends)).toBeLessThan(200)
    expect(Math.max(...air.flatMap((t) => (t.kind === 'track' ? t.track.waypoints.map((w) => w.altitude ?? 0) : [0])))).toBeGreaterThan(5_000)
  })
  it('says the plans are not published and that the force would have been sent again', () => {
    const s = tornadoStrike()
    expect(s.omissions.some((o) => /not published/.test(o))).toBe(true)
    expect(s.omissions.some((o) => /second sortie/.test(o))).toBe(true)
    expect(s.events.some((e) => /SUB-STRATEGIC MEANT/.test(e.text))).toBe(true)
    expect(s.entities.filter((e) => e.kind === 'site' && !e.id.startsWith('tor-')).length).toBe(2)
  })
})
