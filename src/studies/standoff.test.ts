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
    // Out at the cruising altitude, release, and home the way it came.
    expect(wps.length).toBeGreaterThan(3)
    expect(wps[wps.length - 1].position).toEqual(bomber.position)
    expect(Math.max(...wps.map((w) => w.altitude ?? 0))).toBeGreaterThan(5_000)
    expect(wps[0].altitude).toBe(0)
    const release = missiles[0].kind === 'track' ? missiles[0].track.waypoints[0].position : ([0, 0] as [number, number])
    expect(haversineMetres(release, targets[0].position)).toBeCloseTo(2_400_000, -4)
    for (const m of missiles) {
      if (m.kind !== 'track') continue
      expect(m.track.waypoints[0].position).toEqual(release)
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
  it('fans several aircraft from one base into a flight', () => {
    const rafale: Launcher = { id: 'sd', name: 'Saint-Dizier', kind: 'bomber', position: [4.9, 48.64], weapons: 3, weaponsPerVehicle: 1, rangeMetres: 2_500_000, yieldKt: 300, reactionSeconds: 0, speedMs: 290, standoffMetres: 500_000, missileSpeedMs: 260 }
    const flight = enactStrike({ ...common, prefix: 'fl', launchers: [rafale], targets })
    const aircraft = flight.entities.filter((e) => e.kind === 'track' && e.vehicle === 'aircraft')
    expect(aircraft).toHaveLength(3)
    const releases = flight.entities.filter((e) => e.kind === 'track' && e.vehicle === 'missile').map((m) => (m.kind === 'track' ? m.track.waypoints[0].position : ([0, 0] as [number, number])))
    expect(haversineMetres(releases[0], releases[1])).toBeGreaterThan(2_000)
    expect(haversineMetres(releases[0], releases[2])).toBeGreaterThan(2_000)
    expect(haversineMetres(releases[1], releases[2])).toBeGreaterThan(4_000)
    expect(aircraft.some((a) => a.kind === 'track' && /2 OF THE FLIGHT/.test(a.designation))).toBe(true)
  })
  it('releases after the climb-out when the missile can fly the rest, as doctrine has it', () => {
    const near = enactStrike({ ...common, prefix: 'near', launchers: [{ ...bomber, position: [46.21, 51.48] }], targets: [{ id: 'w', name: 'Warsaw', priority: 0, position: [21.01, 52.23], maxWeapons: 1 }] })
    const aircraft = near.entities.find((e) => e.kind === 'track' && e.vehicle === 'aircraft')
    expect(aircraft).toBeDefined()
    if (!aircraft || aircraft.kind !== 'track') return
    const release1 = near.entities.find((e) => e.kind === 'track' && e.vehicle === 'missile')
    expect(release1?.kind === 'track' ? haversineMetres(aircraft.track.waypoints[0].position, release1.track.waypoints[0].position) : 0).toBeCloseTo(150_000, -4)
    // A target closer than the climb-out gets a release a third of the way.
    const close = enactStrike({ ...common, prefix: 'close', launchers: [{ ...bomber, position: [21.5, 52.0] }], targets: [{ id: 'w', name: 'Warsaw', priority: 0, position: [21.01, 52.23], maxWeapons: 1 }] })
    const m2 = close.entities.find((e) => e.kind === 'track' && e.vehicle === 'missile')
    if (m2 && m2.kind === 'track') expect(haversineMetres([21.5, 52.0], m2.track.waypoints[0].position)).toBeLessThan(20_000)
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

describe('flight profiles', () => {
  it('climbs to the cruising altitude, and goes to the deck before the target when the profile says so', () => {
    const high: Launcher = { ...bomber, cruiseAltitudeMetres: 12_000, weaponAltitudeMetres: 100 }
    const low: Launcher = { ...bomber, standoffMetres: undefined, cruiseAltitudeMetres: 13_700, weaponAltitudeMetres: 90, descendAtMetres: 700_000, weapons: 1, weaponsPerVehicle: 1 }
    const one = [{ id: 'a', name: 'Moscow', priority: 0, position: [37.62, 55.75] as [number, number], maxWeapons: 1 }]
    const s1 = enactStrike({ ...common, prefix: 'hi', launchers: [high], targets: one })
    const a1 = s1.entities.find((e) => e.kind === 'track' && e.vehicle === 'aircraft')
    expect(a1?.kind === 'track' ? Math.max(...a1.track.waypoints.map((w) => w.altitude ?? 0)) : 0).toBeCloseTo(12_000, -2)
    const s2 = enactStrike({ ...common, prefix: 'lo', launchers: [low], targets: one })
    const a2 = s2.entities.find((e) => e.kind === 'track')
    expect(a2).toBeDefined()
    if (!a2 || a2.kind !== 'track') return
    const wps = a2.track.waypoints
    expect(Math.max(...wps.map((w) => w.altitude ?? 0))).toBeCloseTo(13_700, -2)
    // It is on the deck when it arrives.
    expect(wps[wps.length - 1].altitude).toBeCloseTo(90, 0)
    // And still high two thousand kilometres out.
    const early = wps.find((w) => haversineMetres(w.position, one[0].position) < 2_000_000)!
    expect(early.altitude).toBeGreaterThan(10_000)
  })
})
