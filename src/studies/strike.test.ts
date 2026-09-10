import { describe, expect, it } from 'vitest'
import type { Launcher, Target } from '../models/allocation.ts'
import { enactStrike, groupVehicles } from './strike.ts'

const attrition = { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: 1 }, penetration: 1, note: 'none' }
const common = {
  allocationRule: { source: 'test' },
  vehicle: { evidence: 'inferred' as const, provenance: { source: 'test' } },
  route: { cruise: { source: 'test' }, ballistic: { source: 'test' } },
}

describe('groupVehicles', () => {
  it('fills a missile with warheads whose targets lie within its footprint and no more', () => {
    const l: Launcher = { id: 'silo', name: 'Silo', kind: 'icbm', position: [-100, 48], weapons: 6, weaponsPerVehicle: 3, rangeMetres: 1e7, yieldKt: 170, reactionSeconds: 0 }
    const targets: Target[] = [
      { id: 'a', name: 'A', priority: 0, position: [37.6, 55.7] },
      { id: 'b', name: 'B', priority: 1, position: [38.0, 55.9] },
      { id: 'c', name: 'C', priority: 2, position: [37.2, 55.5] },
      { id: 'd', name: 'D', priority: 3, position: [60.6, 56.8] },
      { id: 'e', name: 'E', priority: 4, position: [61.0, 57.0] },
      { id: 'f', name: 'F', priority: 5, position: [30.3, 59.9] },
    ]
    const sorties = targets.map((t) => ({ launcherId: 'silo', targetId: t.id, kind: 'icbm' as const, weapons: 1, yieldKt: 170, distanceMetres: 0 }))
    const groups = groupVehicles(sorties, { silo: l }, Object.fromEntries(targets.map((t) => [t.id, t])), 300_000, 600_000)
    expect(groups.map((g) => g.sorties.map((s) => s.targetId).sort().join(''))).toEqual(['abc', 'de', 'f'])
  })
})

describe('enactStrike with MIRVs', () => {
  it('draws one bus that splits into its reentry vehicles after post-boost', () => {
    const l: Launcher = { id: 'silo', name: 'Silo', kind: 'icbm', position: [-100, 48], weapons: 3, weaponsPerVehicle: 3, rangeMetres: 1e7, yieldKt: 170, reactionSeconds: 60 }
    const targets: Target[] = [
      { id: 'a', name: 'A', priority: 0, position: [37.6, 55.7] },
      { id: 'b', name: 'B', priority: 1, position: [38.4, 56.2] },
      { id: 'c', name: 'C', priority: 2, position: [36.8, 55.2] },
    ]
    const r = enactStrike({ ...common, prefix: 't', side: 'attacker', launchers: [l], targets, allocation: { maxWeaponsPerTarget: 1 }, attrition })
    const tracks = r.entities.filter((e) => e.kind === 'track')
    expect(tracks).toHaveLength(4)
    const bus = tracks.find((t) => /BUS/.test(t.designation))!
    const rvs = tracks.filter((t) => /^RV/.test(t.designation))
    expect(rvs).toHaveLength(3)
    expect(bus.kind === 'track' && bus.track.start).toBe(60)
    const split = bus.kind === 'track' ? bus.track.end : 0
    for (const rv of rvs) {
      expect(rv.kind === 'track' && rv.track.start).toBeCloseTo(split, 3)
      const p = rv.kind === 'track' ? rv.track.positionAt(split)! : [0, 0]
      const b = bus.kind === 'track' ? bus.track.positionAt(split)! : [1, 1]
      expect(p[0]).toBeCloseTo(b[0], 4)
      expect(p[1]).toBeCloseTo(b[1], 4)
      expect(rv.kind === 'track' && rv.track.altitudeAt(split)).toBeGreaterThan(50_000)
    }
    expect(r.summary.vehicles).toBe(1)
    expect(r.summary.weapons).toBe(3)
    expect(r.summary.delivered).toBe(3)
    expect(Object.keys(r.firstArrival).sort()).toEqual(['a', 'b', 'c'])
    // Each detonation names the reentry vehicle that delivered it, and the id is a track in the result.
    const trackIds = new Set(tracks.map((t) => t.id))
    for (const e of r.entities) {
      if (e.kind !== 'effect') continue
      expect(e.deliveredBy?.length).toBe(1)
      expect(trackIds.has(e.deliveredBy![0])).toBe(true)
      expect(e.deliveredBy![0]).toMatch(/-rv\d$/)
    }
  })

  it('flies a bomber through its targets in turn and loses both weapons when it is lost early', () => {
    const l: Launcher = { id: 'base', name: 'Base', kind: 'bomber', position: [-100, 48], weapons: 2, weaponsPerVehicle: 2, rangeMetres: Infinity, yieldKt: 1_100, reactionSeconds: 0, speedMs: 250 }
    const targets: Target[] = [
      { id: 'a', name: 'A', priority: 0, position: [37.6, 55.7] },
      { id: 'b', name: 'B', priority: 1, position: [39.0, 56.0] },
    ]
    const r = enactStrike({ ...common, prefix: 'b', side: 'attacker', launchers: [l], targets, allocation: { maxWeaponsPerTarget: 1 }, attrition })
    const tracks = r.entities.filter((e) => e.kind === 'track')
    expect(tracks).toHaveLength(1)
    // The legs are drawn with a climb and a cruising altitude, so a leg is several waypoints; the aircraft still visits both targets in turn.
    const wps = tracks[0].kind === 'track' ? tracks[0].track.waypoints : []
    expect(wps.length).toBeGreaterThan(3)
    expect(wps[0].position).toEqual(l.position)
    expect(wps[wps.length - 1].position).toEqual(targets[1].position)
    expect(Math.max(...wps.map((w) => w.altitude ?? 0))).toBeGreaterThan(5_000)
    expect(r.summary.vehicles).toBe(1)
    expect(r.summary.delivered).toBe(2)
    expect(r.firstArrival.b.time).toBeGreaterThan(r.firstArrival.a.time)
    // Both detonations were delivered by the one aircraft.
    expect(r.firstArrival.a.tracks).toEqual([tracks[0].id])
    expect(r.firstArrival.b.tracks).toEqual([tracks[0].id])
    const lost = enactStrike({ ...common, prefix: 'c', side: 'attacker', launchers: [l], targets, allocation: { maxWeaponsPerTarget: 1 }, attrition: { ...attrition, reliability: { ...attrition.reliability, bomber: 0 } } })
    expect(lost.summary.delivered).toBe(0)
    expect(lost.summary.lostReliability).toBe(2)
  })
})
