import { describe, expect, it } from 'vitest'
import { absentee, airDensity, footprint, horizonMetres, missDistanceMetres, reachMetres, window } from './intercept.ts'

describe('the boost window', () => {
  it('leaves a solid-fuelled booster almost nothing, and a liquid one not much more', () => {
    // A modern solid ICBM burns for about three minutes; detection and a decision take a minute and a half.
    expect(window(180).availableSeconds).toBe(90)
    // The liquid boosters of the 1960s and 70s burned for five.
    expect(window(300).availableSeconds).toBe(210)
    // Nothing at all is left if the booster is quick and the decision is not.
    expect(window(90).availableSeconds).toBe(0)
  })

  it('turns that window into a circle the interceptor must already be inside', () => {
    // Five kilometres a second for ninety seconds is four hundred and fifty kilometres.
    expect(reachMetres(window(180), 5_000)).toBe(450_000)
    // An aircraft with a hypersonic missile has to loiter inside a fifth of that, over the launcher's own country.
    expect(reachMetres(window(180), 1_500)).toBe(135_000)
  })
})

describe('the absentee problem', () => {
  it('finds that most of a constellation is always somewhere else', () => {
    const a = absentee(450_000, 1_000, 500_000)
    // A 450 km circle is about a fifth of a per cent of the sphere it is drawn on.
    expect(a.fraction).toBeGreaterThan(0.001)
    expect(a.fraction).toBeLessThan(0.01)
    // So a thousand interceptors put two or three over the launch point.
    expect(a.expected).toBeGreaterThan(1)
    expect(a.expected).toBeLessThan(6)
    // And you must own hundreds for each one that can shoot.
    expect(a.ratio).toBeGreaterThan(150)
  })

  it('scales the way the proposals did: to have a few in place you buy thousands', () => {
    const small = absentee(450_000, 200, 500_000)
    const large = absentee(450_000, 4_600, 500_000)
    expect(small.chance).toBeLessThan(0.6)
    expect(large.chance).toBeGreaterThan(0.99)
    expect(large.expected / small.expected).toBeCloseTo(23, 0)
  })
})

describe('the horizon, which is why a glide vehicle glides', () => {
  it('sees a ballistic apogee five times further off than a glide vehicle', () => {
    const radar = 10
    const ballistic = horizonMetres(radar, 1_000_000)
    const glide = horizonMetres(radar, 40_000)
    expect(ballistic / 1_000).toBeGreaterThan(3_400)
    expect(ballistic / 1_000).toBeLessThan(3_700)
    expect(glide / 1_000).toBeGreaterThan(650)
    expect(glide / 1_000).toBeLessThan(760)
    expect(ballistic / glide).toBeGreaterThan(4.5)
  })

  it('turns that into minutes of warning, which is what actually matters', () => {
    const speed = 3_000
    const ballisticWarning = horizonMetres(10, 1_000_000) / speed / 60
    const glideWarning = horizonMetres(10, 40_000) / speed / 60
    expect(ballisticWarning).toBeGreaterThan(18)
    expect(glideWarning).toBeLessThan(5)
  })
})

describe('the terminal footprint, against the two deployed systems', () => {
  it('gives a high terminal battery the two hundred kilometres its own literature claims', () => {
    // THAAD engages from about 150 km down to about 40; a reentry vehicle comes
    // through at 3 km/s at 30 degrees; the interceptor makes about 2.8 km/s.
    const f = footprint({ interceptorSpeedMs: 2_800, ceilingMetres: 150_000, floorMetres: 40_000, reentrySpeedMs: 3_000, reentryAngleDeg: 30 })
    expect(f.radiusMetres / 1_000).toBeGreaterThan(170)
    expect(f.radiusMetres / 1_000).toBeLessThan(230)
  })

  it('gives a point-defence battery about twenty, which is a base and not a country', () => {
    // PAC-3 engages in the last fifteen to thirty kilometres at about 1.7 km/s.
    const f = footprint({ interceptorSpeedMs: 1_700, ceilingMetres: 30_000, floorMetres: 15_000, reentrySpeedMs: 3_000, reentryAngleDeg: 30 })
    expect(f.radiusMetres / 1_000).toBeGreaterThan(12)
    expect(f.radiusMetres / 1_000).toBeLessThan(30)
    // Two orders of magnitude of area between the two, for a factor of less than two in speed.
    const high = footprint({ interceptorSpeedMs: 2_800, ceilingMetres: 150_000, floorMetres: 40_000, reentrySpeedMs: 3_000, reentryAngleDeg: 30 })
    expect(high.areaSqKm / f.areaSqKm).toBeGreaterThan(50)
  })

  it('shrinks the footprint when the reentry is steep, because there is less time in the band', () => {
    const shallow = footprint({ interceptorSpeedMs: 2_800, ceilingMetres: 150_000, floorMetres: 40_000, reentrySpeedMs: 3_000, reentryAngleDeg: 20 })
    const steep = footprint({ interceptorSpeedMs: 2_800, ceilingMetres: 150_000, floorMetres: 40_000, reentrySpeedMs: 3_000, reentryAngleDeg: 70 })
    expect(steep.radiusMetres).toBeLessThan(shallow.radiusMetres / 2)
  })
})

describe('hitting a bullet with a bullet', () => {
  it('turns a tenth of a second into a kilometre', () => {
    const m = missDistanceMetres({ lateralErrorMetres: 0, timingErrorSeconds: 0.1, closingSpeedMs: 10_000, handoverSeconds: 10 })
    expect(m.alongTrackMetres).toBe(1_000)
    // And asks the kill vehicle for two hundred metres a second of sideways push to fix it.
    expect(m.divertNeededMs).toBeCloseTo(200, 0)
  })

  it('is survivable only when the track is very good and the handover is early', () => {
    const good = missDistanceMetres({ lateralErrorMetres: 20, timingErrorSeconds: 0.002, closingSpeedMs: 10_000, handoverSeconds: 30 })
    expect(good.divertNeededMs).toBeLessThan(5)
    const late = missDistanceMetres({ lateralErrorMetres: 20, timingErrorSeconds: 0.002, closingSpeedMs: 10_000, handoverSeconds: 2 })
    expect(late.divertNeededMs).toBeGreaterThan(25)
  })
})

describe('the atmosphere, which is the only thing that sorts a decoy from a warhead', () => {
  it('thins out the way the standard exponential says', () => {
    expect(airDensity(0)).toBeCloseTo(1.225, 3)
    expect(airDensity(7_200)).toBeCloseTo(1.225 / Math.E, 3)
    // At the top of a terminal engagement there is almost nothing to slow anything down.
    expect(airDensity(100_000)).toBeLessThan(1e-5)
  })
})
