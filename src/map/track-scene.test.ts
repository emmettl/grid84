import { describe, expect, it } from 'vitest'
import { Track } from '../engine/track.ts'
import { allocateFrame, buildFrame, dashFor, LINE_STRIDE, mercator, parseRgba, POINT_STRIDE, prepareTracks, vehicleColor, type TrackSpec } from './track-scene.ts'

const spec = (id: string, track: Track, reveal: 'full' | 'progressive' = 'progressive', side: 'attacker' | 'defender' = 'attacker'): TrackSpec => ({ id, track, route: 'reconstructed', evidence: 'inferred', side, reveal })

describe('mercator', () => {
  it('maps the origin to the centre of the unit square and clamps the poles', () => {
    expect(mercator(0, 0)).toEqual([0.5, 0.5])
    expect(mercator(-180, 0)[0]).toBe(0)
    expect(mercator(180, 0)[0]).toBe(1)
    expect(mercator(0, 85.0511)[1]).toBeCloseTo(0, 3)
    expect(Number.isFinite(mercator(0, 90)[1])).toBe(true)
    // Unwrapped longitudes stay continuous rather than wrapping back into the square.
    expect(mercator(190, 0)[0]).toBeCloseTo(1.0278, 3)
  })
})

describe('colours and dashes', () => {
  it('parses the grammar colours and picks the defender hue', () => {
    expect(parseRgba('rgba(255, 96, 96, 0.9)')).toEqual([1, 96 / 255, 96 / 255, 0.9])
    expect(vehicleColor('documented', 'attacker')[0]).toBeCloseTo(141 / 255)
    expect(vehicleColor('documented', 'defender')[0]).toBe(1)
    expect(dashFor('documented')).toEqual([0, 0])
    const [on, period] = dashFor('reconstructed')
    expect(on).toBeGreaterThan(0)
    expect(period).toBeGreaterThan(on)
  })
})

describe('prepareTracks and buildFrame', () => {
  const warren = new Track([
    { position: [-104.8, 41.1], time: 0 },
    { position: [-68.5, 76.5], time: 3_600 },
    { position: [177.5, 64.7], time: 7_200 },
  ])
  const short = new Track([
    { position: [10, 50], time: 1_000 },
    { position: [11, 50], time: 1_100 },
  ])

  it('densifies each track once with monotonic times and a vertex per point', () => {
    const scene = prepareTracks([spec('w', warren), spec('s', short)])
    expect(scene.tracks).toHaveLength(2)
    const w = scene.tracks[0]
    expect(w.first).toBe(0)
    expect(w.count).toBeGreaterThan(20)
    expect(scene.tracks[1].first).toBe(w.count)
    expect(scene.vertices.length).toBe((w.count + scene.tracks[1].count) * LINE_STRIDE)
    for (let i = 1; i < w.count; i += 1) {
      expect(w.times[i]).toBeGreaterThanOrEqual(w.times[i - 1])
      expect(w.dist[i]).toBeGreaterThanOrEqual(w.dist[i - 1])
    }
    expect(w.times[0]).toBe(0)
    expect(w.times[w.count - 1]).toBeCloseTo(7_200)
    // The second leg crosses the antimeridian; unwrapped x keeps going rather than jumping back.
    expect(w.merc[(w.count - 1) * 2]).toBeLessThan(0)
  })

  it('reveals nothing before start, everything after end, and a head segment in between', () => {
    const scene = prepareTracks([spec('w', warren)])
    const frame = allocateFrame(scene)
    buildFrame(scene, -10, frame)
    expect(frame.indexCount).toBe(0)
    expect(frame.headVertexCount).toBe(0)
    expect(frame.pointCount).toBe(0)

    buildFrame(scene, 1_800, frame)
    const w = scene.tracks[0]
    expect(frame.indexCount).toBeGreaterThan(0)
    expect(frame.indexCount).toBeLessThan((w.count - 1) * 2)
    expect(frame.headVertexCount).toBe(2)
    expect(frame.pointCount).toBe(1)
    const p = warren.positionAt(1_800)!
    const [x, y] = mercator(p[0], p[1])
    expect(frame.heads[LINE_STRIDE]).toBeCloseTo(x, 6)
    expect(frame.heads[LINE_STRIDE + 1]).toBeCloseTo(y, 6)
    expect(frame.points[0]).toBeCloseTo(x, 6)
    expect(frame.points[1]).toBeCloseTo(y, 6)
    // The head starts where the flown geometry stops.
    const lastIndex = frame.indices[frame.indexCount - 1]
    expect(frame.heads[0]).toBeCloseTo(scene.vertices[lastIndex * LINE_STRIDE], 6)

    buildFrame(scene, 10_000, frame)
    expect(frame.indexCount).toBe((w.count - 1) * 2)
    expect(frame.headVertexCount).toBe(0)
    expect(frame.pointCount).toBe(0)
  })

  it('draws full-reveal tracks whole from the start and colours the defender red', () => {
    const scene = prepareTracks([spec('s', short, 'full', 'defender')])
    const frame = allocateFrame(scene)
    buildFrame(scene, 0, frame)
    expect(frame.indexCount).toBe((scene.tracks[0].count - 1) * 2)
    expect(frame.headVertexCount).toBe(0)
    buildFrame(scene, 1_050, frame)
    expect(frame.pointCount).toBe(1)
    expect(frame.points[3]).toBe(1)
    expect(frame.points[POINT_STRIDE - 1]).toBeCloseTo(0.95)
  })

  it('never exceeds the allocated capacity for many tracks', () => {
    const specs: TrackSpec[] = []
    for (let i = 0; i < 200; i += 1) specs.push(spec(`t${i}`, new Track([{ position: [-100 + i * 0.1, 40], time: i }, { position: [40 + i * 0.1, 55], time: 10_000 + i }])))
    const scene = prepareTracks(specs)
    const frame = allocateFrame(scene)
    for (const t of [0, 100, 5_000, 9_999, 20_000]) {
      buildFrame(scene, t, frame)
      expect(frame.indexCount).toBeLessThanOrEqual(frame.indices.length)
      expect(frame.headVertexCount * LINE_STRIDE).toBeLessThanOrEqual(frame.heads.length)
      expect(frame.pointCount * POINT_STRIDE).toBeLessThanOrEqual(frame.points.length)
    }
  })
})

describe('altitude', () => {
  it('carries a height per vertex and interpolates it at the head', () => {
    const arc = new Track([
      { position: [0, 0], time: 0, altitude: 0 },
      { position: [10, 0], time: 100, altitude: 500_000 },
      { position: [20, 0], time: 200, altitude: 0 },
    ])
    expect(arc.elevated).toBe(true)
    expect(arc.altitudeAt(50)).toBeCloseTo(250_000)
    expect(arc.altitudeAt(150)).toBeCloseTo(250_000)
    expect(arc.altitudeAt(-1)).toBe(0)
    const scene = prepareTracks([spec('a', arc)])
    const t = scene.tracks[0]
    expect(Math.max(...Array.from(t.alt))).toBeCloseTo(500_000)
    const frame = allocateFrame(scene)
    buildFrame(scene, 100, frame)
    expect(frame.points[2]).toBeCloseTo(500_000)
    expect(frame.heads[LINE_STRIDE + 2]).toBeCloseTo(500_000)
  })
})
