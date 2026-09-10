import { describe, expect, it } from 'vitest'
import { effectiveWind } from './wind.ts'

describe('the effective wind', () => {
  it('averages winds as vectors and reads their spread as shear', () => {
    const steady = effectiveWind([{ fromDeg: 270, mph: 20 }, { fromDeg: 270, mph: 10 }])
    expect(steady.fromDeg).toBeCloseTo(270, 5)
    expect(steady.mph).toBeCloseTo(15, 5)
    expect(steady.shearDeg).toBe(15)
    const veering = effectiveWind([{ fromDeg: 250, mph: 20 }, { fromDeg: 290, mph: 20 }])
    expect(veering.fromDeg).toBeCloseTo(270, 5)
    expect(veering.mph).toBeLessThan(20)
    expect(veering.shearDeg).toBeGreaterThan(15)
    const across = effectiveWind([{ fromDeg: 350, mph: 10 }, { fromDeg: 10, mph: 10 }])
    expect(across.fromDeg).toBeCloseTo(0, 5)
  })
})
