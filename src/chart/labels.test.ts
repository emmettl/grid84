import { describe, expect, it } from 'vitest'
import { placeLabels, type LabelWish } from './labels.ts'

const wish = (id: string, x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'start'): LabelWish => ({ id, x, y, text, anchor, markX: x, markY: y })

describe('placeLabels', () => {
  it('leaves labels that do not collide where they were', () => {
    const out = placeLabels([wish('a', 10, 20, 'Atlas D'), wish('b', 10, 80, 'Titan II')], { top: 0, bottom: 200 })
    expect(out.map((l) => l.py)).toEqual([20, 80])
    expect(out.every((l) => !l.leader)).toBe(true)
  })

  it('separates labels that would overlap and keeps them inside the chart', () => {
    const out = placeLabels([wish('a', 10, 100, 'Atlas D'), wish('b', 12, 102, 'Polaris A1'), wish('c', 8, 104, 'R-7')], { top: 0, bottom: 200 })
    const ys = out.map((l) => l.py).sort((p, q) => p - q)
    for (let i = 1; i < ys.length; i += 1) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(11)
    for (const l of out) {
      expect(l.py).toBeGreaterThan(0)
      expect(l.py).toBeLessThan(200)
    }
    expect(out.some((l) => l.leader)).toBe(true)
  })

  it('does not move labels that only share a column with distant ones', () => {
    const out = placeLabels([wish('a', 600, 30, 'Peacekeeper', 'end'), wish('b', 640, 34, 'Trident II D5', 'end')], { top: 0, bottom: 300 })
    const a = out.find((l) => l.id === 'a')!
    const b = out.find((l) => l.id === 'b')!
    expect(Math.abs(a.py - b.py)).toBeGreaterThanOrEqual(11)
  })
})
