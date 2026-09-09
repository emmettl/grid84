import { haversineMetres, type LngLat } from '../geo/geodesy.ts'

/**
 * Allocation of an alert force to a priority-ordered target list. Nobody
 * outside the vault knows the real assignments, so this is an illustration
 * with a stated rule: highest-priority targets first, each weapon from the
 * nearest launcher that can reach it and still has weapons, up to a maximum
 * number of weapons per target. Every sortie it produces is inferred.
 */
export type SystemKind = 'icbm' | 'slbm' | 'irbm' | 'bomber'

export interface Launcher {
  id: string
  name: string
  kind: SystemKind
  position: LngLat
  /** Weapons available from this launcher in the alert force. */
  weapons: number
  /** Weapons carried per vehicle: 1 for missiles, 2 for a B-52 with Mk-28s. */
  weaponsPerVehicle: number
  /** Reach from the launcher, metres; Infinity for an unlimited illustration. */
  rangeMetres: number
  yieldKt: number
  /** Seconds after the execution order before the first vehicle leaves. */
  reactionSeconds: number
  /** Ground speed for bombers, m/s; ballistic systems use the trajectory model. */
  speedMs?: number
}

export interface Target {
  id: string
  name: string
  priority: number
  position: LngLat
  /** Weapons this target may receive, overriding the allocation-wide maximum; a field of silos takes more than a city. */
  maxWeapons?: number
}

export interface Sortie {
  launcherId: string
  targetId: string
  kind: SystemKind
  weapons: number
  yieldKt: number
  distanceMetres: number
}

export interface AllocationResult {
  sorties: Sortie[]
  /** Weapons left at each launcher after allocation. */
  remaining: Record<string, number>
  targetsCovered: number
  weaponsAssigned: number
}

export interface AllocationOptions {
  /** Weapons a single target may receive before the next target is considered; the assurance overkill. */
  maxWeaponsPerTarget?: number
  /** Ballistic systems are assigned first, then forward-based, then bombers, matching the documented sequence. */
  order?: SystemKind[]
}

const DEFAULT_ORDER: SystemKind[] = ['icbm', 'slbm', 'irbm', 'bomber']

/**
 * Greedy allocation. Pass 1 gives every target in priority order one weapon
 * while weapons last, preferring the earliest system kind in `order` and the
 * nearest launcher of that kind within range. Pass 2 repeats for a second
 * weapon, and so on, up to `maxWeaponsPerTarget`, so overkill on the top
 * targets only happens after coverage of the list.
 */
export function allocate(launchers: Launcher[], targets: Target[], options: AllocationOptions = {}): AllocationResult {
  const maxPer = options.maxWeaponsPerTarget ?? 2
  const order = options.order ?? DEFAULT_ORDER
  const remaining: Record<string, number> = Object.fromEntries(launchers.map((l) => [l.id, l.weapons]))
  const sorted = [...targets].sort((a, b) => a.priority - b.priority)
  const sorties: Sortie[] = []
  const perTarget: Record<string, number> = {}
  let weaponsAssigned = 0

  const passes = Math.max(maxPer, ...targets.map((t) => t.maxWeapons ?? 0))
  for (let pass = 0; pass < passes; pass += 1) {
    for (const target of sorted) {
      const have = perTarget[target.id] ?? 0
      if (have > pass || have >= (target.maxWeapons ?? maxPer)) continue
      let chosen: { launcher: Launcher; distance: number } | null = null
      for (const kind of order) {
        for (const launcher of launchers) {
          if (launcher.kind !== kind || remaining[launcher.id] <= 0) continue
          const distance = haversineMetres(launcher.position, target.position)
          if (distance > launcher.rangeMetres) continue
          if (!chosen || distance < chosen.distance) chosen = { launcher, distance }
        }
        if (chosen) break
      }
      if (!chosen) continue
      remaining[chosen.launcher.id] -= 1
      perTarget[target.id] = (perTarget[target.id] ?? 0) + 1
      weaponsAssigned += 1
      sorties.push({ launcherId: chosen.launcher.id, targetId: target.id, kind: chosen.launcher.kind, weapons: 1, yieldKt: chosen.launcher.yieldKt, distanceMetres: chosen.distance })
    }
  }
  return { sorties, remaining, targetsCovered: Object.keys(perTarget).length, weaponsAssigned }
}

/** Total megatonnage of an allocation, to check against the documented alert-force figure. */
export function megatons(sorties: Sortie[]): number {
  return sorties.reduce((s, x) => s + (x.weapons * x.yieldKt) / 1_000, 0)
}
