import { describe, expect, it } from 'vitest'
import { exposure, totalPopulation, type PopulationGrid } from './exposure.ts'

/** A synthetic grid of uniform density: `perDegree2` people per square degree, on a 0.1° lattice. */
function uniformGrid(perDegree2: number, cellSize = 0.1): PopulationGrid {
  const width = Math.round(360 / cellSize)
  const height = Math.round(180 / cellSize)
  const counts = new Float32Array(width * height).fill(perDegree2 * cellSize * cellSize)
  return { width, height, cellSize, west: -180, south: -90, counts, source: { name: 'synthetic', year: 0, licence: 'none' } }
}

describe('exposure', () => {
  it('recovers area × density on the equator for a uniform grid', () => {
    const grid = uniformGrid(1_000_000)
    const radius = 30_000
    const result = exposure(grid, { center: [0, 0], rings: [{ key: 'r', radius }], subsamples: 4 })
    const areaDeg2 = (Math.PI * radius * radius) / (111_320 * 111_320)
    const expected = areaDeg2 * 1_000_000
    expect(result.within.r / expected).toBeGreaterThan(0.97)
    expect(result.within.r / expected).toBeLessThan(1.03)
  })

  it('reports annuli that sum to the outer ring and handles the antimeridian', () => {
    const grid = uniformGrid(1_000)
    const result = exposure(grid, { center: [179.95, 0], rings: [{ key: 'a', radius: 10_000 }, { key: 'b', radius: 20_000 }], subsamples: 3 })
    expect(result.annuli.a + result.annuli.b).toBeCloseTo(result.within.b, 6)
    expect(result.within.b).toBeGreaterThan(result.within.a)
    const symmetric = exposure(grid, { center: [0, 0], rings: [{ key: 'a', radius: 10_000 }, { key: 'b', radius: 20_000 }], subsamples: 3 })
    expect(result.within.b / symmetric.within.b).toBeGreaterThan(0.95)
    expect(result.within.b / symmetric.within.b).toBeLessThan(1.05)
  })

  it('skips empty cells and counts the total', () => {
    const grid = uniformGrid(0, 1)
    grid.counts[0] = 5
    expect(totalPopulation(grid)).toBe(5)
    const result = exposure(grid, { center: [0, 0], rings: [{ key: 'r', radius: 50_000 }] })
    expect(result.cellsVisited).toBe(0)
    expect(result.within.r).toBe(0)
  })
})
