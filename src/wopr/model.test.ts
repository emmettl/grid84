import { describe, expect, it } from 'vitest'
import { posture1983 } from '../studies/window83/window.ts'
import { describePlan, evaluate, evaluateSeeds, loss, perturb, randomPlan, rng, siloSamples, spreadSilos, tableTargets, type DeathTable, type Plan } from './model.ts'

/** A stand-in exposure table: every city kills a tenth of its population, every force site a thousand, per detonation. */
function fakeTable(): DeathTable {
  const p = posture1983()
  const table: DeathTable = {}
  for (const t of tableTargets(p)) {
    const city = p.usCities.find((c) => c.id === t.id) ?? p.sovietCities.find((c) => c.id === t.id)
    const dead = city ? city.population * 0.1 : 1_000
    table[t.id] = Object.fromEntries(t.classes.map((c) => [c, { blast: dead * 0.6, fire: dead }]))
  }
  for (const s of siloSamples(p)) table[s.id] = { 500: { blast: 200, fire: 300 }, 1_000: { blast: 200, fire: 300 } }
  spreadSilos(p, table, siloSamples(p))
  return table
}

const base: Plan = { posture: 'ride', warningMinutes: 20, bomberAlert: 0.3, usOption: 1, usRule: 'mixed', sovietRule: 'counterforce', sovietOption: 1, reliability: 0.85, interceptors: 0 }
const constraints = { generalWar: true, minCoverage: 0.95, retaliatory: true }

describe('WOPR model', () => {
  const p = posture1983()
  const table = fakeTable()

  it('scores a plan with the arithmetic of the window: half the silos survive a ride-out, none are lost under attack', () => {
    const ride = evaluate(p, table, base, 0, constraints)
    const launch = evaluate(p, table, { ...base, posture: 'launch' }, 0, constraints)
    expect(ride.silosSurviving).toBeGreaterThan(300)
    expect(ride.silosSurviving).toBeLessThan(800)
    expect(launch.launchUnderAttack).toBe(true)
    expect(launch.usWeaponsFired).toBeGreaterThan(ride.usWeaponsFired)
    expect(ride.total).toBeGreaterThan(0)
    expect(ride.feasible).toBe(true)
  })

  it('finds that not launching is best when general war is not required', () => {
    const idle = evaluate(p, table, { ...base, sovietOption: 0.25, usOption: 0.25 }, 0, { generalWar: false, minCoverage: 0, retaliatory: false })
    const full = evaluate(p, table, base, 0, { generalWar: false, minCoverage: 0, retaliatory: false })
    expect(idle.total).toBeLessThan(full.total)
  })

  it('rejects plans that fail the doctrine and ranks objectives differently', () => {
    const thin = evaluate(p, table, { ...base, usOption: 0.1 }, 0, constraints)
    expect(thin.feasible).toBe(false)
    expect(loss(thin, 'total')).toBe(Infinity)
    // Two W78 on every Soviet silo consumes what survives a ride-out; the pure counterforce option cannot then cover the list.
    const pure = evaluate(p, table, { ...base, usRule: 'counterforce' }, 0, constraints)
    expect(pure.feasible).toBe(false)
    expect(pure.why).toMatch(/coverage/)
    expect(evaluate(p, table, { ...base, usRule: 'counterforce', posture: 'launch' }, 0, constraints).feasible).toBe(true)
    const cv = evaluate(p, table, { ...base, usRule: 'countervalue' }, 0, constraints)
    const mixed = evaluate(p, table, base, 0, constraints)
    expect(cv.populationDestroyed).toBeGreaterThan(pure.populationDestroyed)
    expect(mixed.forcesStruck).toBeGreaterThan(cv.forcesStruck)
    expect(loss(mixed, 'destruction')).toBeLessThanOrEqual(loss(cv, 'destruction'))
  })

  it('gives a range over seeds and moves through the plan space deterministically', () => {
    const a = evaluateSeeds(p, table, base, 8, constraints, 'total')
    expect(a.low).toBeLessThanOrEqual(a.score.total + 1)
    expect(a.high).toBeGreaterThanOrEqual(a.score.total - 1)
    const r1 = rng(7)
    const r2 = rng(7)
    expect(randomPlan(r1)).toEqual(randomPlan(r2))
    const moved = perturb(base, rng(3))
    expect(JSON.stringify(moved)).not.toBe(JSON.stringify(base))
    expect(describePlan(base)).toMatch(/RIDE OUT/)
  })
})
