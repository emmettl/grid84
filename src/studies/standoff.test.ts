import { describe, expect, it } from 'vitest'
import { haversineMetres } from '../geo/geodesy.ts'
import type { Launcher, Target } from '../models/allocation.ts'
import { missileOf } from './missile.ts'
import { enactStrike } from './strike.ts'
import type { Study } from './study.ts'

const bomber: Launcher = { id: 'b52', name: 'Barksdale AFB', kind: 'bomber', position: [-93.66, 32.5], weapons: 3, weaponsPerVehicle: 8, rangeMetres: 12_000_000, yieldKt: 150, reactionSeconds: 0, speedMs: 250, standoffMetres: 2_400_000, missileSpeedMs: 240 }
const sub: Launcher = { id: 'dolphin', name: 'Dolphin patrol', kind: 'bomber', position: [33.5, 33.5], weapons: 1, weaponsPerVehicle: 1, rangeMetres: 1_500_000, yieldKt: 20, reactionSeconds: 0, standoffMetres: 1_500_000, missileSpeedMs: 240 }
const targets: Target[] = [
  { id: 'a', name: 'Moscow', priority: 0, position: [37.62, 55.75], maxWeapons: 1 },
  { id: 'b', name: 'Moscow aim 2', priority: 1, position: [37.8, 55.8], maxWeapons: 1 },
  { id: 'c', name: 'Moscow aim 3', priority: 2, position: [37.4, 55.7], maxWeapons: 1 },
]
const common = { side: 'attacker' as const, allocation: { maxWeaponsPerTarget: 1 }, attrition: { reliability: { icbm: 1, irbm: 1, slbm: 1, bomber: 1 }, penetration: 1, note: 'none' }, allocationRule: { source: 't' }, vehicle: { evidence: 'inferred' as const, provenance: { source: 't' } }, route: { cruise: { source: 't' }, ballistic: { source: 't' } } }

describe('standoff air delivery', () => {
  const strike = enactStrike({ ...common, prefix: 'sa', launchers: [bomber], targets })
  const tracks = strike.entities.filter((e) => e.kind === 'track')
  it('flies the aircraft to a release point short of the target, turns it for home, and sends each missile on from there', () => {
    const aircraft = tracks.find((t) => t.kind === 'track' && t.vehicle === 'aircraft')
    const missiles = tracks.filter((t) => t.kind === 'track' && t.vehicle === 'missile')
    expect(aircraft).toBeDefined()
    expect(missiles).toHaveLength(3)
    if (!aircraft || aircraft.kind !== 'track') return
    const wps = aircraft.track.waypoints
    expect(wps).toHaveLength(3)
    expect(wps[2].position).toEqual(bomber.position)
    const release = wps[1].position
    expect(haversineMetres(release, targets[0].position)).toBeCloseTo(2_400_000, -4)
    for (const m of missiles) {
      if (m.kind !== 'track') continue
      expect(m.track.waypoints[0].position).toEqual(release)
      expect(m.track.start).toBeCloseTo(wps[1].time, 3)
      expect(m.track.end).toBeGreaterThan(m.track.start + 2_400_000 / 260)
    }
    const arrival = Object.values(strike.firstArrival)
    expect(arrival).toHaveLength(3)
    expect(arrival.every((a) => a.tracks[0].includes('-cm'))).toBe(true)
  })
  it('is one load to the whole-missile resolver, released rather than separated', () => {
    const study = { entities: strike.entities } as unknown as Study
    const first = tracks.find((t) => t.kind === 'track' && t.vehicle === 'missile')
    const m = missileOf(study, first!.id)
    expect(m).not.toBeNull()
    expect(m!.kind).toBe('aircraft')
    expect(m!.vehicles).toHaveLength(3)
    expect(m!.effects).toHaveLength(3)
  })
  it('flies at least a third of the way when the standoff exceeds the distance', () => {
    const near = enactStrike({ ...common, prefix: 'near', launchers: [{ ...bomber, position: [46.21, 51.48] }], targets: [{ id: 'w', name: 'Warsaw', priority: 0, position: [21.01, 52.23], maxWeapons: 1 }] })
    const aircraft = near.entities.find((e) => e.kind === 'track' && e.vehicle === 'aircraft')
    expect(aircraft).toBeDefined()
    if (!aircraft || aircraft.kind !== 'track') return
    const d = haversineMetres([46.21, 51.48], [21.01, 52.23])
    expect(haversineMetres(aircraft.track.waypoints[0].position, aircraft.track.waypoints[1].position)).toBeCloseTo(d / 3, -4)
  })
  it('lets a submarine fire its cruise missile from where it sits, with no carrier leg', () => {
    const s = enactStrike({ ...common, prefix: 'sub', launchers: [sub], targets: [{ id: 't', name: 'Damascus', priority: 0, position: [36.3, 33.5], maxWeapons: 1 }] })
    const t = s.entities.filter((e) => e.kind === 'track')
    expect(t).toHaveLength(1)
    expect(t[0].kind === 'track' && t[0].vehicle).toBe('missile')
    expect(t[0].kind === 'track' && t[0].track.waypoints[0].position).toEqual(sub.position)
  })
})

describe('the boost phase in the engine', () => {
  it('marks burnout on the trail, releases the bus after it, and keeps the impulsive model when asked', () => {
    const heavy: Launcher = { id: 'uzhur', name: 'Uzhur', kind: 'icbm', position: [89.83, 55.31], weapons: 3, weaponsPerVehicle: 10, rangeMetres: 11_000_000, yieldKt: 800, reactionSeconds: 0, propellant: 'liquid' }
    const s = enactStrike({ ...common, prefix: 'bp', launchers: [heavy], targets: [{ id: 'a', name: 'Malmstrom 1', priority: 0, position: [-111.19, 47.5], maxWeapons: 1 }, { id: 'b', name: 'Malmstrom 2', priority: 1, position: [-111.0, 47.6], maxWeapons: 1 }, { id: 'c', name: 'Malmstrom 3', priority: 2, position: [-111.3, 47.4], maxWeapons: 1 }] })
    const bus = s.entities.find((e) => e.kind === 'track' && !/-rv\d+$/.test(e.id))
    expect(bus).toBeDefined()
    if (!bus || bus.kind !== 'track') return
    expect(bus.marks?.[0]?.kind).toBe('burnout')
    expect(bus.marks?.[0]?.time).toBe(300)
    expect(bus.track.end).toBeGreaterThanOrEqual(300 + 89)
    expect(bus.track.end).toBeLessThanOrEqual(300 + 91)
    const arrival = Object.values(s.firstArrival)[0].time
    expect(arrival / 60).toBeGreaterThan(30)
    const impulsive = enactStrike({ ...common, prefix: 'im', launchers: [{ ...heavy, boost: null }], targets: [{ id: 'a', name: 'Malmstrom 1', priority: 0, position: [-111.19, 47.5], maxWeapons: 1 }] })
    const t = impulsive.entities.find((e) => e.kind === 'track')
    expect(t && t.kind === 'track' ? t.marks : 'x').toBeUndefined()
    expect(Object.values(impulsive.firstArrival)[0].time).toBeLessThan(arrival)
  })
})
