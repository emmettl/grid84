import { describe, expect, it } from 'vitest'
import { discStatistics, shadowMap, stepsToTravel, terrainFactor, WaveField, type HeightGrid } from './terrain-shock.ts'

function flat(n: number, dx: number, height = 0): HeightGrid {
  return { n, dx, h: new Float32Array(n * n).fill(height) }
}

/** A north–south ridge of given height at column `col`, `width` cells wide. */
function ridge(n: number, dx: number, col: number, width: number, height: number): HeightGrid {
  const g = flat(n, dx)
  for (let y = 0; y < n; y += 1) for (let x = col; x < col + width; x += 1) g.h[y * n + x] = height
  return g
}

describe('shadowMap', () => {
  it('sees everything on flat ground', () => {
    const s = shadowMap(flat(64, 50), { x: 32, y: 32, hob: 500 })
    expect(s.visibleFraction).toBe(1)
    expect(s.blockers.every((v) => v === 0)).toBe(true)
  })

  it('shadows the ground behind a ridge and marks the ridge face as the blocker', () => {
    const g = ridge(64, 50, 40, 2, 300)
    const s = shadowMap(g, { x: 16, y: 32, hob: 1_500 })
    // Directly behind the ridge, near it, the burst at 1,500 m over a 300 m ridge 24 cells away is hidden.
    expect(s.visible[32 * 64 + 43]).toBe(0)
    // Far behind, the line of sight clears the ridge again.
    expect(s.visible[32 * 64 + 63]).toBe(1)
    // In front of the ridge everything is visible.
    expect(s.visible[32 * 64 + 30]).toBe(1)
    expect(s.blockers[32 * 64 + 40] + s.blockers[32 * 64 + 41]).toBeGreaterThan(0)
    expect(s.visibleFraction).toBeLessThan(1)
    expect(s.visibleFraction).toBeGreaterThan(0.7)
  })
})

describe('WaveField', () => {
  it('spreads a pulse outward and stays bounded', () => {
    const n = 96
    const field = new WaveField(n, 50, null, { damping: 0 })
    field.inject(48, 48, 1, 2)
    field.advance(stepsToTravel(field, 1_500))
    const centre = Math.abs(field.field[48 * n + 48])
    const ring = Math.abs(field.field[48 * n + 48 + 30])
    expect(Number.isFinite(centre)).toBe(true)
    expect(field.peak[48 * n + 48 + 30]).toBeGreaterThan(0)
    expect(field.peak[48 * n + 48 + 30]).toBeLessThan(1)
    expect(ring).toBeLessThan(1)
  })

  it('reflects off a wall so the terrain factor rises in front of it and falls behind it', () => {
    const n = 96
    const dx = 50
    const wall = new Uint8Array(n * n)
    for (let y = 20; y < 76; y += 1) wall[y * n + 60] = 1
    const flatRun = new WaveField(n, dx, null)
    const wallRun = new WaveField(n, dx, wall)
    for (const f of [flatRun, wallRun]) {
      f.inject(30, 48, 1, 2)
      f.advance(stepsToTravel(f, 3_000))
    }
    const factor = terrainFactor(wallRun.peak, flatRun.peak)
    const inFront = factor[48 * n + 57]
    const behind = factor[48 * n + 70]
    expect(inFront).toBeGreaterThan(1.05)
    expect(behind).toBeLessThan(0.7)
  })
})

describe('discStatistics', () => {
  it('counts visibility and mean factor inside a disc', () => {
    const n = 32
    const visible = new Uint8Array(n * n).fill(1)
    for (let i = 0; i < n * n; i += 1) if (i % 2) visible[i] = 0
    const stats = discStatistics(n, 16, 16, 5, visible, null)
    expect(stats.cells).toBeGreaterThan(60)
    expect(stats.visibleFraction).toBeGreaterThan(0.4)
    expect(stats.visibleFraction).toBeLessThan(0.6)
    expect(stats.meanFactor).toBe(1)
  })
})
