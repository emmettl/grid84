import { describe, expect, it } from 'vitest'
import { haversineMetres } from '../geo/geodesy.ts'
import { arrivalBearing, DEFAULT_ALTITUDE_METRES, REENTRY_ANGLE_DEG, REENTRY_SECONDS, reentryTrack } from './reentry.ts'
import type { Attempt } from './run.ts'

const at = (lon: number, lat: number): Attempt => ({
  aim: [lon, lat],
  impact: [lon, lat],
  missMetres: 0,
  lethalRadiusMetres: 500,
  hit: true,
  arrived: true,
})

describe('the drawn reentry', () => {
  it('starts in the air and ends on the ground, at the point the warhead actually landed', () => {
    const track = reentryTrack(at(37.62, 55.75), 'us')
    const first = track.waypoints[0]
    const last = track.waypoints[track.waypoints.length - 1]
    expect(first.altitude).toBeCloseTo(DEFAULT_ALTITUDE_METRES, 6)
    expect(last.altitude).toBeCloseTo(0, 6)
    expect(first.time).toBe(0)
    expect(last.time).toBeCloseTo(REENTRY_SECONDS, 6)
    expect(haversineMetres(last.position, [37.62, 55.75])).toBeLessThan(1)
  })

  /**
   * The length of the leg is a drawing convention, chosen to fit the camera.
   * The angle it comes down at is not, and it holds whatever the length is.
   */
  it('comes down at the stated angle whatever length the leg is drawn at', () => {
    for (const altitudeMetres of [2_000, 15_000, 60_000]) {
      const track = reentryTrack(at(0, 0), 'us', { altitudeMetres })
      const run = haversineMetres(track.waypoints[0].position, track.waypoints[track.waypoints.length - 1].position)
      expect(track.waypoints[0].altitude).toBeCloseTo(altitudeMetres, 6)
      expect(run / altitudeMetres).toBeCloseTo(Math.tan((REENTRY_ANGLE_DEG * Math.PI) / 180), 3)
    }
  })

  it('loses height evenly down the leg, because the drawn path is straight', () => {
    const track = reentryTrack(at(10, 50), 'su', { altitudeMetres: 4_000, segments: 4 })
    expect(track.waypoints.map((w) => w.altitude)).toEqual([4_000, 3_000, 2_000, 1_000, 0])
  })

  /**
   * The reason the bearing is computed rather than chosen: at these latitudes
   * the great circle between the two countries' missile fields goes over the
   * pole, so an American warhead arrives at a Russian target out of the north
   * and a Russian one arrives at an American target the same way. Both come
   * from the northern half of the compass, and that is a fact about the globe
   * rather than a claim about a plan.
   */
  it('brings both sides in over the pole, which is what the great circle does', () => {
    const atMoscow = arrivalBearing([37.62, 55.75], 'us')
    const atWashington = arrivalBearing([-77.04, 38.9], 'su')
    const northerly = (b: number) => b < 90 || b > 270
    expect(northerly(atMoscow), `Moscow: ${atMoscow.toFixed(0)}°`).toBe(true)
    expect(northerly(atWashington), `Washington: ${atWashington.toFixed(0)}°`).toBe(true)
  })

  it('turns the arrow round for a target the firing side is south of', () => {
    // Straight below the launch region it comes in from due north; straight above, from due south.
    expect(arrivalBearing([-104, 20], 'us')).toBeCloseTo(0, 1)
    expect(arrivalBearing([-104, 70], 'us')).toBeCloseTo(180, 1)
  })

  it('walks the leg in order, so the layer can play it', () => {
    const track = reentryTrack(at(-1.2, 52), 'su', { segments: 12 })
    for (let i = 1; i < track.waypoints.length; i += 1) {
      expect(track.waypoints[i].time).toBeGreaterThan(track.waypoints[i - 1].time)
      expect(track.waypoints[i].altitude ?? 0).toBeLessThan(track.waypoints[i - 1].altitude ?? 0)
    }
  })
})
