import type { LngLat } from '../geo/geodesy.ts'
import { destinationPoint } from '../geo/sector.ts'
import { CEP_TO_SIGMA, lethalRadiusMetres, singleShotKill, SYSTEMS, type WeaponSystem } from '../models/lethality.ts'
import { CATEGORIES, targetsIn, type CategoryId, type Installation } from './targets.ts'

/**
 * The terminal phase, one warhead at a time.
 *
 * The lab beside this draws the curves. Here a real weapon is aimed at a real
 * installation, the miss is drawn from the same circular-normal distribution
 * the lab integrates, and the answer is HIT or MISS — which is the form the
 * answer actually takes. Run it for a while and the tally converges on the
 * lab's own number, which is the point: the single-shot kill probability is
 * not a property of the weapon, it is what happens when you keep firing.
 *
 * A miss is not a near miss. Against a city almost nothing is a miss; against
 * a silo almost everything is, and watching the same weapon do both is the
 * argument this pair of screens exists to make.
 */

/** A deterministic generator, so a run can be repeated and a seed shared. */
export function rng(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return (state >>> 8) / 16777216
  }
}

export interface Attempt {
  /** Where it was meant to land. */
  aim: LngLat
  /** Where it did. */
  impact: LngLat
  missMetres: number
  /** Ground range at which the target's failure overpressure is reached. */
  lethalRadiusMetres: number
  hit: boolean
  /** Whether the warhead worked at all; a dud is a miss with a different reason. */
  arrived: boolean
}

export interface Engagement {
  target: Installation
  weapon: WeaponSystem
  attempts: Attempt[]
  /** True once one of the attempts landed inside the lethal radius. */
  destroyed: boolean
  /** The lab's own figure for one shot, for the tally to converge on. */
  singleShot: number
  /** How many shots this engagement is allowed before it moves on. */
  allowance: number
}

/**
 * Reliability. Every counterforce sum in the literature carries one and the
 * open estimates sit between 0.75 and 0.9; the shot exchange lab uses 0.9 and
 * so does this. A warhead that does not arrive is a miss that the accuracy of
 * the system had nothing to do with, and the log says which kind it was.
 */
export const RELIABILITY = 0.9

export interface RunOptions {
  /** A named system, or null to draw one at random. */
  weaponId: string | null
  /** A named category, or null to wander. */
  category: CategoryId | null
  /** How many warheads may be spent on one target before moving on. */
  allowance: number
}

/** Two independent normal errors, each with sigma = CEP / 1.1774: the Rayleigh median. */
function missMetres(cepMetres: number, next: () => number): { east: number; north: number } {
  const sigma = cepMetres * CEP_TO_SIGMA
  const u1 = Math.max(1e-9, next())
  const u2 = next()
  const r = sigma * Math.sqrt(-2 * Math.log(u1))
  return { east: r * Math.cos(2 * Math.PI * u2), north: r * Math.sin(2 * Math.PI * u2) }
}

function offset(from: LngLat, eastMetres: number, northMetres: number): LngLat {
  const distance = Math.hypot(eastMetres, northMetres)
  if (distance === 0) return from
  const bearing = (Math.atan2(eastMetres, northMetres) * 180) / Math.PI
  return destinationPoint(from, bearing, distance)
}

/**
 * One engagement: a weapon, a target, and up to `allowance` warheads. It stops
 * on the first one that works, because a plan that reattacks a destroyed silo
 * is a plan wasting a warhead, and reattack is exactly what the allowance is.
 *
 * `index` walks a chosen category in the list's own order rather than at
 * random: when the reader has picked a weapon and a target type the screen is
 * answering a specific question — what does this weapon do to this kind of
 * thing — and wandering would hide the answer in the sampling.
 *
 * With no category chosen it takes each kind of target in turn and draws a
 * place from it. Drawing uniformly from the whole catalogue would not do: the
 * documented city and airfield lists are four fifths of it and both are soft,
 * so the screen would show an almost unbroken run of hits and the reader would
 * never see the case the lab is about. One of each, round and round.
 */
export function engage(options: RunOptions, next: () => number, index = 0): Engagement {
  const category: CategoryId = options.category ?? CATEGORIES[index % CATEGORIES.length].id
  const pool = targetsIn(category)
  const target = options.category ? pool[index % pool.length] : pool[Math.floor(next() * pool.length) % pool.length]
  const weapon = options.weaponId ? (SYSTEMS.find((s) => s.id === options.weaponId) ?? SYSTEMS[0]) : SYSTEMS[Math.floor(next() * SYSTEMS.length) % SYSTEMS.length]
  const lethal = lethalRadiusMetres(weapon.yieldKt, target.hardness.psi)
  const attempts: Attempt[] = []
  let destroyed = false
  for (let i = 0; i < options.allowance && !destroyed; i += 1) {
    const arrived = next() < RELIABILITY
    const { east, north } = missMetres(weapon.cepMetres, next)
    const impact = offset(target.position, east, north)
    const distance = Math.hypot(east, north)
    const hit = arrived && distance <= lethal
    attempts.push({ aim: target.position, impact, missMetres: distance, lethalRadiusMetres: lethal, hit, arrived })
    if (hit) destroyed = true
  }
  return {
    target,
    weapon,
    attempts,
    destroyed,
    singleShot: RELIABILITY * singleShotKill(weapon.yieldKt, weapon.cepMetres, target.hardness.psi),
    allowance: options.allowance,
  }
}

/** How the log reads one attempt. */
export function attemptLabel(a: Attempt): 'HIT' | 'MISS' | 'DUD' {
  if (!a.arrived) return 'DUD'
  return a.hit ? 'HIT' : 'MISS'
}
