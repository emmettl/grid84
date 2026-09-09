import { describe, expect, it } from 'vitest'
import { heightAt, minimumEnergyTrajectory } from './ballistic.ts'

const WARREN = [-104.867, 41.133] as const
const ANADYR = [177.467, 64.733] as const
const VANDENBERG = [-120.6, 34.7] as const
const KWAJALEIN = [167.7, 8.7] as const

describe('minimumEnergyTrajectory', () => {
  it('gives a roughly 30-minute flight and ~1,000 km apogee for an ICBM range', () => {
    // Vandenberg to Kwajalein is the classic ~7,800 km test range; ICBM flight times are quoted at about 30 minutes.
    const plan = minimumEnergyTrajectory(VANDENBERG, KWAJALEIN)
    expect(plan.rangeMetres / 1_000).toBeGreaterThan(7_500)
    expect(plan.flightSeconds / 60).toBeGreaterThan(25)
    expect(plan.flightSeconds / 60).toBeLessThan(40)
    expect(plan.apogeeMetres / 1_000).toBeGreaterThan(900)
    expect(plan.apogeeMetres / 1_000).toBeLessThan(1_600)
    expect(plan.burnoutSpeed).toBeGreaterThan(6_500)
    expect(plan.burnoutSpeed).toBeLessThan(7_500)
  })

  it('reaches Anadyr from F.E. Warren in under half an hour', () => {
    const plan = minimumEnergyTrajectory(WARREN, ANADYR)
    expect(plan.rangeMetres / 1_000).toBeGreaterThan(5_000)
    expect(plan.rangeMetres / 1_000).toBeLessThan(6_500)
    expect(plan.flightSeconds / 60).toBeGreaterThan(20)
    expect(plan.flightSeconds / 60).toBeLessThan(32)
  })

  it('shortens with range and the flight-path angle steepens towards 45 degrees', () => {
    const short = minimumEnergyTrajectory([0, 0], [0, 9])
    const long = minimumEnergyTrajectory([0, 0], [0, 70])
    expect(short.flightSeconds).toBeLessThan(long.flightSeconds)
    expect(short.flightPathAngle).toBeGreaterThan(long.flightPathAngle)
    expect(short.flightPathAngle).toBeLessThan(Math.PI / 4)
  })
})

describe('heightAt', () => {
  it('starts and ends at the surface and peaks at apogee midway', () => {
    const plan = minimumEnergyTrajectory(WARREN, ANADYR)
    expect(Math.abs(heightAt(plan, 0))).toBeLessThan(1_000)
    expect(Math.abs(heightAt(plan, 1))).toBeLessThan(1_000)
    expect(heightAt(plan, 0.5)).toBeCloseTo(plan.apogeeMetres, -2)
    expect(heightAt(plan, 0.25)).toBeLessThan(plan.apogeeMetres)
  })
})
