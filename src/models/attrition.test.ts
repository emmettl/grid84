import { describe, expect, it } from 'vitest'
import type { Sortie } from './allocation.ts'
import { calibrate, deliveryProbability, DOCUMENTED_ASSURANCE, fate, hash01, RELIABILITY } from './attrition.ts'

const sortie = (i: number, kind: Sortie['kind']): Sortie => ({ launcherId: 'l', targetId: `t${i}`, kind, weapons: 1, yieldKt: 1_000, distanceMetres: 1 })
const force: Sortie[] = [...Array.from({ length: 86 }, (_, i) => sortie(i, i < 24 ? 'icbm' : i < 54 ? 'irbm' : 'slbm')), ...Array.from({ length: 1_505 }, (_, i) => sortie(100 + i, 'bomber'))]

describe('calibrate', () => {
  it('finds the bomber penetration that makes the force average the documented assurance', () => {
    const c = calibrate(force)
    expect(c.average).toBeCloseTo(DOCUMENTED_ASSURANCE, 6)
    expect(c.penetration).toBeGreaterThan(0.9)
    expect(c.penetration).toBeLessThan(1)
    expect(deliveryProbability('icbm', c.penetration)).toBe(RELIABILITY.icbm.value)
    expect(deliveryProbability('bomber', c.penetration)).toBeCloseTo(0.9 * c.penetration, 9)
  })
})

describe('fate', () => {
  it('is deterministic and loses about the expected share', () => {
    const c = calibrate(force)
    let delivered = 0
    for (const s of force) {
      const f = fate(`${s.launcherId}-${s.targetId}`, s.kind, c.penetration)
      if (f.delivered) delivered += 1
      expect(fate(`${s.launcherId}-${s.targetId}`, s.kind, c.penetration)).toEqual(f)
    }
    expect(delivered / force.length).toBeGreaterThan(0.8)
    expect(delivered / force.length).toBeLessThan(0.9)
  })
  it('places reliability losses at launch and penetration losses late in the route', () => {
    let seenLaunch = false
    let seenLate = false
    for (let i = 0; i < 2_000; i += 1) {
      const f = fate(`x${i}`, 'bomber', 0.9)
      if (f.cause === 'reliability') seenLaunch = seenLaunch || (f.lostAtFraction ?? 1) < 0.15
      if (f.cause === 'penetration') seenLate = seenLate || (f.lostAtFraction ?? 0) > 0.6
    }
    expect(seenLaunch).toBe(true)
    expect(seenLate).toBe(true)
    expect(hash01('a')).not.toBe(hash01('b'))
  })
})
