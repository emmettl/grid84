import { describe, expect, it } from 'vitest'
import { window83, windowArithmetic } from './window.ts'

describe('the window of vulnerability', () => {
  it('has the arithmetic: two SS-18 warheads at the open literature\'s accuracy kill about two silos in three', () => {
    const a = windowArithmetic()
    expect(a.p18).toBeGreaterThan(0.35)
    expect(a.twoShots).toBeGreaterThan(0.6)
    expect(a.flightMinutes).toBeGreaterThan(25)
    expect(a.flightMinutes).toBeLessThan(35)
    expect(a.silos).toBe(1_045)
    expect(a.launchMinutes).toBeLessThan(a.flightMinutes)
  })

  it('rides it out with most silos lost, and launches under attack with none', () => {
    const ride = window83('ride')
    const launch = window83('launch')
    const survivors = /(\d[\d,]*) of 1,045 silos survive/.exec(ride.subtitle)
    expect(survivors).not.toBeNull()
    const n = Number(survivors![1].replace(/,/g, ''))
    expect(n).toBeGreaterThan(200)
    expect(n).toBeLessThan(700)
    expect(launch.subtitle).toMatch(/every silo empty at H\+22/)
    const usTracks = (s: typeof ride) => s.entities.filter((e) => e.kind === 'track' && e.id.startsWith('us-s-')).length
    expect(usTracks(launch)).toBeGreaterThan(usTracks(ride))
    const silos = ride.entities.filter((e) => e.kind === 'site' && /silo-/.test(e.id)).length
    expect(silos).toBe(1_045)
    expect(ride.entities.filter((e) => e.kind === 'effect' && e.id.startsWith('su-icbm-')).length).toBeGreaterThan(900)
    expect(ride.events.some((ev) => /RIDES IT OUT/.test(ev.text))).toBe(true)
    expect(launch.events.some((ev) => /LAUNCH UNDER ATTACK ORDERED/.test(ev.text))).toBe(true)
    expect(ride.populationGrid).toBe('ghsl/popc_1985')
  })
})
