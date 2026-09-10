import { describe, expect, it } from 'vitest'
import { createUnion, exposure, unionAdd, type GridOrigin, type PopulationGrid, type UnionDetonation } from './exposure.ts'

/** A uniform grid of one-degree cells over 0..10E, 0..10N with 100 people in each. */
function uniform(): PopulationGrid {
  const width = 10
  const height = 10
  return { width, height, cellSize: 1, west: 0, south: 0, counts: new Float32Array(width * height).fill(100), source: { name: 'test', year: 0, licence: 'none' } }
}
const origin = (g: PopulationGrid): GridOrigin => ({ west: g.west, north: g.south + g.height * g.cellSize, width: g.width, cellSize: g.cellSize })

describe('union of detonations', () => {
  it('matches the single-detonation sum and counts overlap once', () => {
    const g = uniform()
    const d: UnionDetonation = { center: [5, 5], bandRadii: [100_000, 200_000, 300_000], fireRadius: 250_000 }
    const single = exposure(g, { center: d.center, rings: [{ key: 'a', radius: 100_000 }, { key: 'b', radius: 200_000 }, { key: 'c', radius: 300_000 }, { key: 'fire', radius: 250_000 }], subsamples: 4 })
    const state = createUnion(3, 4)
    unionAdd(g, state, d, origin(g))
    expect(state.bandTotals[0]).toBeCloseTo(single.within.a, 3)
    expect(state.bandTotals[0] + state.bandTotals[1]).toBeCloseTo(single.within.b, 3)
    expect(state.bandTotals.reduce((a, b) => a + b, 0)).toBeCloseTo(single.within.c, 3)
    expect(state.fireTotal).toBeCloseTo(single.within.fire, 3)
    // The same detonation again changes nothing.
    unionAdd(g, state, d, origin(g))
    expect(state.bandTotals.reduce((a, b) => a + b, 0)).toBeCloseTo(single.within.c, 3)
    // A second detonation at the same place with a bigger inner ring promotes samples inward without adding people.
    unionAdd(g, state, { center: [5, 5], bandRadii: [200_000, 200_000, 300_000], fireRadius: 0 }, origin(g))
    expect(state.bandTotals[0]).toBeCloseTo(single.within.b, 3)
    expect(state.bandTotals[1]).toBeCloseTo(0, 3)
    expect(state.bandTotals.reduce((a, b) => a + b, 0)).toBeCloseTo(single.within.c, 3)
  })

  it('sums disjoint detonations and never exceeds the grid', () => {
    const g = uniform()
    const state = createUnion(1, 2)
    unionAdd(g, state, { center: [2, 2], bandRadii: [100_000], fireRadius: 0 }, origin(g))
    const one = state.bandTotals[0]
    unionAdd(g, state, { center: [8, 8], bandRadii: [100_000], fireRadius: 0 }, origin(g))
    expect(state.bandTotals[0]).toBeCloseTo(2 * one, 1)
    for (let i = 0; i < 20; i += 1) unionAdd(g, state, { center: [1 + (i % 10), 1 + Math.floor(i / 2)], bandRadii: [400_000], fireRadius: 0 }, origin(g))
    expect(state.bandTotals[0]).toBeLessThanOrEqual(100 * 100 + 1e-6)
  })

  it('keys a window of a larger grid the same as the grid itself', () => {
    const g = uniform()
    const window: PopulationGrid = { width: 4, height: 4, cellSize: 1, west: 3, south: 3, counts: new Float32Array(16).fill(100), source: g.source, partial: true }
    const a = createUnion(1, 2)
    const b = createUnion(1, 2)
    unionAdd(g, a, { center: [5, 5], bandRadii: [120_000], fireRadius: 0 }, origin(g))
    unionAdd(window, b, { center: [5, 5], bandRadii: [120_000], fireRadius: 0 }, origin(g))
    expect(b.bandTotals[0]).toBeCloseTo(a.bandTotals[0], 3)
    expect([...b.bands.keys()].sort()).toEqual([...a.bands.keys()].sort())
  })
})

describe('effects in sequence', () => {
  it('kills by blast, then fire, then fallout among the survivors, never more than the people present', async () => {
    const { applyGroupDose, unionAddPlume, unionTotals } = await import('./exposure.ts')
    const g = uniform()
    const bands = [
      { fatal: 0.98, injured: 0.02 },
      { fatal: 0.5, injured: 0.4 },
      { fatal: 0.05, injured: 0.45 },
      { fatal: 0, injured: 0.25 },
    ]
    const state = createUnion(4, 2)
    // Blast bands of 50, 100, 150, 200 km; fire to 120 km.
    unionAdd(g, state, { center: [5, 5], bandRadii: [50_000, 100_000, 150_000, 200_000], fireRadius: 120_000 }, origin(g))
    const before = unionTotals(state, bands)
    expect(before.fireDead).toBeGreaterThanOrEqual(before.blastDead)
    expect(before.falloutDead).toBe(0)
    expect(before.combinedDead).toBeCloseTo(before.fireDead, 6)
    // A lethal plume over the whole area: everyone alive after blast and fire dies of it, and the combined figure is the people present.
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    const one = new Map<number, number>()
    unionAddPlume(g, state, { ring, doseMidRads: 2_000 }, origin(g), one)
    applyGroupDose(state, 'a', one)
    const after = unionTotals(state, bands)
    expect(after.underPlume).toBeCloseTo(100 * 100, 3)
    expect(after.falloutDead).toBeCloseTo(100 * 100 - after.fireDead, 3)
    expect(after.combinedDead).toBeCloseTo(100 * 100, 3)
    expect(after.blastDead).toBeCloseTo(before.blastDead, 6)
    // The same burst re-added at a later hour raises its own contribution rather than repeating it.
    const again = new Map<number, number>()
    unionAddPlume(g, state, { ring, doseMidRads: 3_000 }, origin(g), again)
    applyGroupDose(state, 'a', again)
    expect(unionTotals(state, bands).combinedDead).toBeCloseTo(100 * 100, 3)
  })

  it('adds the dose from separate plumes, which is what ten aim points over one city do', async () => {
    const { applyGroupDose, unionAddPlume, unionTotals } = await import('./exposure.ts')
    const g = uniform()
    const bands = [
      { fatal: 0.9, injured: 0.1 },
      { fatal: 0.5, injured: 0.4 },
      { fatal: 0.05, injured: 0.45 },
      { fatal: 0, injured: 0.25 },
    ]
    const state = createUnion(bands.length, 1)
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    // Three bursts, each on its own too weak to kill anybody.
    const doses = [200, 200, 200]
    doses.forEach((dose, i) => {
      const c = new Map<number, number>()
      unionAddPlume(g, state, { ring, doseMidRads: dose }, origin(g), c)
      applyGroupDose(state, `burst-${i}`, c)
    })
    // Six hundred rads between them, which kills most of those who take it.
    const t = unionTotals(state, bands)
    expect(t.underPlume).toBeCloseTo(100 * 100, 3)
    expect(t.falloutDead / t.underPlume).toBeGreaterThan(0.85)
    // One burst alone at the same dose kills nobody.
    const alone = createUnion(bands.length, 1)
    const c = new Map<number, number>()
    unionAddPlume(g, alone, { ring, doseMidRads: 200 }, origin(g), c)
    applyGroupDose(alone, 'only', c)
    expect(unionTotals(alone, bands).falloutDead).toBe(0)
  })
})
