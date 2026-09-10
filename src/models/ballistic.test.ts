import { describe, expect, it } from 'vitest'
import { boostedTrajectory, boostedWaypoints, boostProfileFor, heightAt, minimumEnergyTrajectory } from './ballistic.ts'

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

describe('the boost phase', () => {
  it('adds the burn to the flight and puts burnout up and downrange', () => {
    const from: [number, number] = [59.53, 50.76]
    const to: [number, number] = [-101.34, 48.42]
    const liquid = boostProfileFor('icbm', 8_500_000, 'liquid')!
    const solid = boostProfileFor('icbm', 8_500_000, 'solid')!
    expect(liquid.burnoutSeconds).toBeGreaterThan(solid.burnoutSeconds)
    const plan = boostedTrajectory(from, to, liquid)
    expect(plan.totalSeconds).toBeGreaterThan(plan.free.flightSeconds + 299)
    expect(plan.totalSeconds / 60).toBeGreaterThan(30)
    expect(plan.totalSeconds / 60).toBeLessThan(38)
    const wps = boostedWaypoints(from, to, liquid, 0)
    expect(wps[0].altitude).toBe(0)
    const burnout = wps.find((w) => Math.abs(w.time - liquid.burnoutSeconds) < 1e-6)!
    expect(burnout.altitude).toBeCloseTo(liquid.burnoutAltitudeMetres, 0)
    expect(wps[wps.length - 1].altitude).toBe(0)
    for (let i = 1; i < 6; i += 1) expect(wps[i].altitude).toBeGreaterThan(wps[i - 1].altitude)
    expect(boostProfileFor('bomber', 5_000_000)).toBeNull()
    expect(boostProfileFor('irbm', 300_000)!.burnoutDownrangeMetres).toBeLessThanOrEqual(120_000)
    // A heavy flying short still burns its stages out; only the downrange is held inside the flight.
    const short = boostProfileFor('icbm', 11_000_000, 'liquid', 2_640_000)!
    expect(short.burnoutSeconds).toBe(300)
    expect(short.burnoutDownrangeMetres).toBe(600_000)
  })
})
