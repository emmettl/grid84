import { describe, expect, it } from 'vitest'
import { costExchange, engage, interceptorsNeeded, REFERENCE_CASES } from './defence.ts'

const gmd = { interceptors: 44, pKill: 12 / 21, salvo: 4, absentee: 1, shootLookShoot: false }

describe('shot exchange', () => {
  it('kills an engaged warhead with the salvo probability and leaks the rest', () => {
    const one = engage({ warheads: 1, decoysPerWarhead: 0, discriminated: 1 }, gmd)
    expect(one.pKillEngaged).toBeCloseTo(1 - (9 / 21) ** 4, 6)
    expect(one.leaked).toBeCloseTo((9 / 21) ** 4, 6)
    // Two shots as in the film: 82 per cent.
    const film = engage({ warheads: 1, decoysPerWarhead: 0, discriminated: 1 }, { ...gmd, salvo: 2 })
    expect(1 - film.leakageFraction).toBeCloseTo(0.816, 2)
  })

  it('runs out of shots: eleven salvos of four engage eleven of seventeen', () => {
    const korea = engage({ warheads: 17, decoysPerWarhead: 0, discriminated: 1 }, gmd)
    expect(korea.shotsWanted).toBe(68)
    expect(korea.engagedFraction).toBeCloseTo(44 / 68, 6)
    expect(korea.leaked).toBeGreaterThan(6)
    expect(interceptorsNeeded({ warheads: 17, decoysPerWarhead: 0, discriminated: 1 }, gmd)).toBe(68)
  })

  it('is bought out by decoys the defender cannot discriminate', () => {
    const plain = engage({ warheads: 17, decoysPerWarhead: 0, discriminated: 1 }, gmd)
    const balloons = engage({ warheads: 17, decoysPerWarhead: 10, discriminated: 0 }, gmd)
    expect(balloons.credibleObjects).toBe(187)
    expect(balloons.leaked).toBeGreaterThan(plain.leaked)
    expect(balloons.leaked).toBeGreaterThan(15)
    const seen = engage({ warheads: 17, decoysPerWarhead: 10, discriminated: 1 }, gmd)
    expect(seen.leaked).toBeCloseTo(plain.leaked, 6)
  })

  it('spends fewer shots under shoot-look-shoot and counts absentees', () => {
    const sls = engage({ warheads: 17, decoysPerWarhead: 0, discriminated: 1 }, { ...gmd, shootLookShoot: true })
    expect(sls.shotsPerObject).toBeLessThan(4)
    expect(sls.leaked).toBeLessThan(engage({ warheads: 17, decoysPerWarhead: 0, discriminated: 1 }, gmd).leaked)
    const space = engage({ warheads: 10, decoysPerWarhead: 0, discriminated: 1 }, { interceptors: 200, pKill: 0.7, salvo: 2, absentee: 20, shootLookShoot: false })
    expect(space.available).toBe(10)
    expect(space.engagedFraction).toBeCloseTo(0.5, 6)
  })

  it('states the Nitze criterion: the defender pays the salvo per object the attacker adds', () => {
    const c = costExchange({ warheads: 17, decoysPerWarhead: 10, discriminated: 0 }, gmd, { interceptor: 75e6, warhead: 30e6, decoy: 1e6 })
    expect(c.perWarhead).toBe(300e6)
    expect(c.perDecoy).toBe(300e6)
    expect(c.cheaperMove).toBe('decoy')
    expect(c.ratio).toBe(300)
  })

  it('carries every reference case with a source and a finite result', () => {
    for (const r of REFERENCE_CASES) {
      const e = engage(r.attack, r.defence)
      expect(Number.isFinite(e.leaked)).toBe(true)
      expect(e.leaked).toBeGreaterThanOrEqual(0)
      expect(e.leaked).toBeLessThanOrEqual(r.attack.warheads)
      expect(r.provenance.source.length).toBeGreaterThan(20)
    }
  })
})
