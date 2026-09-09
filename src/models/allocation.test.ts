import { describe, expect, it } from 'vitest'
import { allocate, megatons, type Launcher, type Target } from './allocation.ts'

const launchers: Launcher[] = [
  { id: 'icbm', name: 'Warren', kind: 'icbm', position: [-104.9, 41.1], weapons: 2, weaponsPerVehicle: 1, rangeMetres: Infinity, yieldKt: 1_440, reactionSeconds: 900 },
  { id: 'bomber-near', name: 'Thule', kind: 'bomber', position: [-68.7, 76.5], weapons: 3, weaponsPerVehicle: 2, rangeMetres: 6_000_000, yieldKt: 1_100, reactionSeconds: 900, speedMs: 235 },
  { id: 'bomber-far', name: 'Guam', kind: 'bomber', position: [144.8, 13.5], weapons: 3, weaponsPerVehicle: 2, rangeMetres: 6_000_000, yieldKt: 1_100, reactionSeconds: 900, speedMs: 235 },
]
const targets: Target[] = [
  { id: 'moscow', name: 'Moscow', priority: 1, position: [37.62, 55.75] },
  { id: 'leningrad', name: 'Leningrad', priority: 2, position: [30.33, 59.93] },
  { id: 'vladivostok', name: 'Vladivostok', priority: 3, position: [131.9, 43.1] },
  { id: 'far-away', name: 'Unreachable', priority: 4, position: [0, -60] },
]

describe('allocate', () => {
  it('covers targets in priority order with missiles first, then the nearest bomber in range', () => {
    const r = allocate(launchers, targets, { maxWeaponsPerTarget: 1 })
    const by = Object.fromEntries(r.sorties.map((s) => [s.targetId, s]))
    expect(by.moscow.kind).toBe('icbm')
    expect(by.leningrad.kind).toBe('icbm')
    expect(by.vladivostok.launcherId).toBe('bomber-far')
    expect(by['far-away']).toBeUndefined()
    expect(r.targetsCovered).toBe(3)
    expect(r.weaponsAssigned).toBe(3)
  })

  it('only adds second weapons after the list has been covered once', () => {
    const r = allocate(launchers, targets, { maxWeaponsPerTarget: 2 })
    const counts: Record<string, number> = {}
    for (const s of r.sorties) counts[s.targetId] = (counts[s.targetId] ?? 0) + 1
    expect(counts.moscow).toBe(2)
    expect(counts.leningrad).toBe(2)
    expect(counts.vladivostok).toBe(2)
    expect(r.weaponsAssigned).toBe(6)
    expect(r.remaining.icbm).toBe(0)
  })

  it('reports megatonnage', () => {
    const r = allocate(launchers, targets, { maxWeaponsPerTarget: 1 })
    expect(megatons(r.sorties)).toBeCloseTo(1.44 * 2 + 1.1, 6)
  })
})
