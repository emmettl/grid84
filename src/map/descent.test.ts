import { describe, expect, it } from 'vitest'
import type { AtlasTarget } from '../atlas/target.ts'
import { DESCENT_DURATION_MS, ORBITAL_ZOOM, planDescent, targetZoom } from './descent.ts'

const target = (osmKey: string, osmValue: string): AtlasTarget => ({
  id: 'N:1',
  osmId: 1,
  osmType: 'N',
  osmKey,
  osmValue,
  name: 'x',
  label: '',
  countryCode: 'CH',
  position: [8.54, 47.38],
})

describe('targetZoom', () => {
  it('sees cities whole and shops among their roofs', () => {
    expect(targetZoom(target('place', 'city'))).toBe(11)
    expect(targetZoom(target('shop', 'supermarket'))).toBe(16.5)
    expect(targetZoom(target('place', 'country'))).toBeLessThan(targetZoom(target('place', 'town')))
  })
})

describe('planDescent', () => {
  it('always peaks in orbit and takes seven seconds', () => {
    const plan = planDescent([0, 0], target('shop', 'supermarket'))
    expect(plan.minZoom).toBe(ORBITAL_ZOOM)
    expect(plan.duration).toBe(DESCENT_DURATION_MS)
    expect(plan.center).toEqual([8.54, 47.38])
  })

  it('approaches close targets pitched along the line of flight', () => {
    const plan = planDescent([0, 0], target('shop', 'supermarket'))
    expect(plan.pitch).toBe(60)
    expect(plan.bearing).toBeGreaterThan(0)
    expect(plan.bearing).toBeLessThan(90)
  })

  it('looks straight down at whole regions', () => {
    const plan = planDescent([0, 0], target('place', 'country'))
    expect(plan.pitch).toBe(0)
    expect(plan.bearing).toBe(0)
  })
})
