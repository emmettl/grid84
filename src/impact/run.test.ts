import { describe, expect, it } from 'vitest'
import { haversineMetres } from '../geo/geodesy.ts'
import { lethalRadiusMetres, singleShotKill, SYSTEMS } from '../models/lethality.ts'
import { attemptLabel, engage, RELIABILITY, rng, type RunOptions } from './run.ts'
import { allTargets, CATEGORIES, targetsIn, tidyName } from './targets.ts'

const options = (over: Partial<RunOptions> = {}): RunOptions => ({ weaponId: null, category: null, allowance: 3, ...over })

describe('the catalogue', () => {
  it('has somewhere to aim in every category', () => {
    for (const c of CATEGORIES) {
      const list = targetsIn(c.id)
      expect(list.length, `${c.id} is empty`).toBeGreaterThan(10)
      for (const t of list) {
        expect(t.name.length, t.id).toBeGreaterThan(1)
        expect(Math.abs(t.position[0]), t.id).toBeLessThanOrEqual(180)
        expect(Math.abs(t.position[1]), t.id).toBeLessThanOrEqual(90)
        expect(t.hardness.psi, t.id).toBeGreaterThan(0)
        expect(t.provenance.source.length, t.id).toBeGreaterThan(10)
      }
    }
  })

  it('gives every entry an id of its own', () => {
    const ids = allTargets().map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  /** The 1956 study is typed in capitals and read by OCR; a readout is not. */
  it('turns the study\'s shouted names into something a readout can show', () => {
    expect(tidyName('MOSCOW')).toBe('Moscow')
    expect(tidyName('GORK IY /FEDYAKOVO')).toBe('Gork Iy / Fedyakovo')
  })

  /**
   * A patrol box is a guessed rectangle of sea, and a boat in it is the one
   * thing on either side that cannot be aimed at — which is the whole reason
   * the boats are there. None of them is a target on this list.
   */
  it('has nowhere in it that is a guessed patch of open sea', () => {
    for (const t of allTargets()) {
      expect(t.name.toLowerCase(), t.id).not.toContain('patrol')
      expect(t.name.toLowerCase(), t.id).not.toContain('bastion')
    }
  })

  it('ranges from a city that fails at five psi to a bunker that does not fail at ten thousand', () => {
    expect(targetsIn('city')[0].hardness.psi).toBe(5)
    expect(targetsIn('silo')[0].hardness.psi).toBe(2_000)
    expect(targetsIn('command')[0].hardness.psi).toBe(10_000)
  })
})

describe('an engagement', () => {
  it('is the same engagement twice from the same seed', () => {
    const a = engage(options(), rng(7))
    const b = engage(options(), rng(7))
    expect(a.target.id).toBe(b.target.id)
    expect(a.weapon.id).toBe(b.weapon.id)
    expect(a.attempts.map((x) => x.missMetres)).toEqual(b.attempts.map((x) => x.missMetres))
  })

  it('stops spending warheads once one has worked', () => {
    const gen = rng(3)
    for (let i = 0; i < 200; i += 1) {
      const e = engage(options({ weaponId: 'trident-d5', category: 'city', allowance: 4 }), gen)
      if (e.destroyed) {
        expect(e.attempts.filter((a) => a.hit)).toHaveLength(1)
        expect(e.attempts[e.attempts.length - 1].hit).toBe(true)
      }
      expect(e.attempts.length).toBeLessThanOrEqual(4)
    }
  })

  it('never spends more than the allowance, and always spends at least one', () => {
    const gen = rng(11)
    for (let i = 0; i < 100; i += 1) {
      const e = engage(options({ allowance: 2 }), gen)
      expect(e.attempts.length).toBeGreaterThanOrEqual(1)
      expect(e.attempts.length).toBeLessThanOrEqual(2)
    }
  })

  it('puts the impact where the miss says it is', () => {
    const gen = rng(5)
    for (let i = 0; i < 50; i += 1) {
      const e = engage(options({ weaponId: 'atlas-d', category: 'city', allowance: 1 }), gen)
      for (const a of e.attempts) {
        expect(haversineMetres(a.aim, a.impact)).toBeCloseTo(a.missMetres, 0)
      }
    }
  })

  /**
   * The whole reason this screen exists beside the lab: fire enough of them
   * and the tally goes to the lab's own integral. Anything else would mean the
   * drawing and the arithmetic were two different models.
   */
  it('converges on the lab\'s single-shot figure', () => {
    for (const [weaponId, category] of [
      ['trident-d5', 'silo'],
      ['atlas-d', 'city'],
      ['minuteman-iii', 'airfield'],
    ] as const) {
      const gen = rng(42)
      let hits = 0
      const runs = 6_000
      for (let i = 0; i < runs; i += 1) {
        const e = engage({ weaponId, category, allowance: 1 }, gen)
        if (e.attempts[0].hit) hits += 1
      }
      const weapon = SYSTEMS.find((s) => s.id === weaponId)!
      const psi = targetsIn(category)[0].hardness.psi
      const expected = RELIABILITY * singleShotKill(weapon.yieldKt, weapon.cepMetres, psi)
      expect(Math.abs(hits / runs - expected), `${weaponId} at a ${category}`).toBeLessThan(0.025)
    }
  })

  /**
   * A megaton against a city and the same megaton against a silo are the same
   * weapon and two different problems, and that is the argument.
   */
  it('hits a city almost always and a hardened silo almost never with a weapon of 1960', () => {
    const gen = rng(19)
    const rate = (category: 'city' | 'silo') => {
      let destroyed = 0
      for (let i = 0; i < 400; i += 1) if (engage({ weaponId: 'atlas-d', category, allowance: 1 }, gen).destroyed) destroyed += 1
      return destroyed / 400
    }
    expect(rate('city')).toBeGreaterThan(0.6)
    expect(rate('silo')).toBeLessThan(0.02)
  })

  it('reads a warhead that never arrived as a dud rather than a miss', () => {
    const gen = rng(23)
    let duds = 0
    let attempts = 0
    for (let i = 0; i < 2_000; i += 1) {
      for (const a of engage(options({ allowance: 1 }), gen).attempts) {
        attempts += 1
        if (attemptLabel(a) === 'DUD') duds += 1
      }
    }
    expect(duds / attempts).toBeGreaterThan(0.06)
    expect(duds / attempts).toBeLessThan(0.14)
  })

  it('walks the list in order when a category is named', () => {
    const gen = rng(2)
    const list = targetsIn('radar')
    const walked = [0, 1, 2, 3].map((i) => engage(options({ category: 'radar' }), gen, i).target.id)
    expect(walked).toEqual(list.slice(0, 4).map((t) => t.id))
  })

  /**
   * Four fifths of the catalogue is the documented city and airfield lists and
   * both are soft, so drawing uniformly from it would show an almost unbroken
   * run of hits and never the case the lab is about. Wandering takes each kind
   * in turn instead.
   */
  it('takes one of each kind in turn when no category is named', () => {
    const gen = rng(2)
    const kinds = Array.from({ length: CATEGORIES.length }, (_, i) => engage(options(), gen, i).target.category)
    expect(kinds).toEqual(CATEGORIES.map((c) => c.id))
  })

  it('draws the lethal radius from the weapon and the hardness, not from anywhere else', () => {
    const e = engage(options({ weaponId: 'peacekeeper', category: 'silo', allowance: 1 }), rng(1))
    expect(e.attempts[0].lethalRadiusMetres).toBeCloseTo(lethalRadiusMetres(e.weapon.yieldKt, e.target.hardness.psi), 6)
  })
})
