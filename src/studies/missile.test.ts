import { describe, expect, it } from 'vitest'
import { launchedFrom, missileOf } from './missile.ts'
import { window83 } from './window83/window.ts'

describe('the whole missile behind a warhead', () => {
  const study = window83('ride')
  const rv = study.entities.find((e) => e.kind === 'track' && /-rv1$/.test(e.id))
  it('finds the bus, the separation point and the sibling vehicles from one reentry vehicle', () => {
    expect(rv).toBeDefined()
    const m = missileOf(study, rv!.id)
    expect(m).not.toBeNull()
    expect(m!.bus.id).toBe(rv!.id.replace(/-rv1$/, ''))
    expect(m!.vehicles.length).toBeGreaterThan(1)
    expect(m!.vehicles[0].id).toBe(rv!.id)
    expect(m!.separation.time).toBe(m!.bus.track.end)
    expect(m!.separation.altitude).toBeGreaterThan(0)
    for (const v of m!.vehicles) expect(v.track.start).toBeCloseTo(m!.separation.time, 3)
  })
  it('finds the same missile from one of its detonations and from the bus, and nothing from a single-warhead vehicle', () => {
    const m = missileOf(study, rv!.id)!
    const effect = study.entities.find((e) => e.kind === 'effect' && (e.deliveredBy ?? []).includes(rv!.id))
    expect(effect).toBeDefined()
    expect(missileOf(study, effect!.id)?.bus.id).toBe(m.bus.id)
    expect(missileOf(study, m.bus.id)?.vehicles.length).toBe(m.vehicles.length)
    expect(m.effects.length).toBeGreaterThan(0)
    expect(m.effects.length).toBeLessThanOrEqual(m.vehicles.length)
    const single = study.entities.find((e) => e.kind === 'track' && !/-rv\d+$/.test(e.id) && !study.entities.some((x) => x.kind === 'track' && x.id.startsWith(`${e.id}-rv`)))
    expect(single).toBeDefined()
    expect(missileOf(study, single!.id)).toBeNull()
    expect(missileOf(study, null)).toBeNull()
  })
  it('finds what a launch point sent and what it hit', () => {
    const m = missileOf(study, rv!.id)!
    const from = m.bus.track.waypoints[0].position
    const site = study.entities.find((e) => e.kind === 'site' && Math.abs(e.position[0] - from[0]) < 0.01 && Math.abs(e.position[1] - from[1]) < 0.01)
    expect(site).toBeDefined()
    const l = launchedFrom(study, site!.id)
    expect(l).not.toBeNull()
    expect(l!.tracks.map((t) => t.id)).toContain(m.bus.id)
    expect(l!.vehicles.length).toBeGreaterThanOrEqual(m.vehicles.length)
    expect(l!.effects.length).toBeGreaterThan(0)
    expect(launchedFrom(study, 'no-such-site')).toBeNull()
    // A division's missiles are found by name: nearest launcher first leaves some divisions unfired, so take one that fired.
    const divisions = study.entities.filter((e) => e.kind === 'site' && /Rocket Division/.test(e.name))
    const fired = divisions.map((d) => launchedFrom(study, d.id)).filter((d) => d !== null)
    expect(fired.length).toBeGreaterThan(3)
    expect(fired.length).toBeLessThan(divisions.length)
    expect(fired[0]!.tracks.length).toBeGreaterThan(10)
    expect(fired[0]!.effects.length).toBeGreaterThan(10)
    expect(fired[0]!.vehicles.length).toBeGreaterThan(fired[0]!.tracks.length)
  })
})
