import { describe, expect, it } from 'vitest'
import { reachableTargets, vForce, vForceArithmetic } from './vforce.ts'

describe('the V-force', () => {
  it('is the force the official history gives, on eight stations, with the dispersal scheme', () => {
    const a = vForceArithmetic('high')
    expect(a.strength).toBe(159)
    expect(a.bases).toBe(8)
    expect(a.blueSteelAircraft).toBe(40)
    expect(a.dispersed).toBe(144)
  })
  it('reaches Moscow and the western complexes and not the Urals', () => {
    const t = reachableTargets()
    expect(t[0].name).toBe('Moscow')
    expect(t.length).toBe(60)
    // Everything drawn is inside the radius of action taken here.
    expect(vForceArithmetic('high').farthest).toBeLessThanOrEqual(3_000)
    expect(t.every((x) => x.position[0] < 65)).toBe(true)
  })
  it('flies the two profiles from the same force, high until 1960 and on the deck afterwards', () => {
    const high = vForce('high')
    const low = vForce('low')
    // The aircraft, not their weapons: a Blue Steel missile ends on its target whatever the profile.
    const alt = (s: ReturnType<typeof vForce>) => {
      // Only the aircraft that got there: a lost one is cut wherever the defences caught it.
      const tracks = s.entities.filter((e) => e.kind === 'track' && e.vehicle === 'aircraft' && !/LOST/.test(e.designation))
      const ends = tracks.map((t) => (t.kind === 'track' ? (t.track.waypoints[t.track.waypoints.length - 1].altitude ?? 0) : 0))
      return { peak: Math.max(...tracks.flatMap((t) => (t.kind === 'track' ? t.track.waypoints.map((w) => w.altitude ?? 0) : [0]))), lowest: Math.min(...ends), count: tracks.length }
    }
    expect(alt(high).peak).toBeCloseTo(15_240, -2)
    expect(alt(low).peak).toBeCloseTo(13_700, -2)
    // The low profile ends on the deck; the high one is still at altitude over the target.
    expect(alt(low).lowest).toBeLessThan(200)
    expect(alt(high).lowest).toBeGreaterThan(5_000)
    expect(alt(high).count).toBeGreaterThan(10)
    // Blue Steel loses most of its reach at low level.
    expect(vForceArithmetic('low').blueSteelMiles).toBeLessThan(vForceArithmetic('high').blueSteelMiles / 2)
    expect(low.variants?.current).toBe('low')
    expect(high.omissions.some((o) => /never been released/.test(o))).toBe(true)
  })
})
