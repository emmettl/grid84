import type { LngLat } from '../geo/geodesy.ts'
import { hash01 } from '../models/attrition.ts'
import { engage } from '../models/defence.ts'
import { singleShotKill } from '../models/lethality.ts'
import type { Posture1983 } from '../studies/window83/window.ts'

/**
 * WOPR: a constrained search over the 1983 posture for the plan that
 * minimises a chosen loss under the planners' constraints. The evaluator is
 * a surrogate of the engine's documented model: every target's exposure is
 * computed once by the exposure workers over the 1985 grid at each yield
 * class the force carries, and a plan is scored as the sum over struck
 * targets with the largest weapon on each, as the studies' per-target log
 * lines are. It does not carry the union's once-only counting; the readout
 * says so. Seeds draw the attrition and accuracy inside their published
 * ranges, so a plan's figure is a range, not a number chosen for effect.
 */

export interface Plan {
  posture: 'ride' | 'launch'
  /** Minutes after the Soviet launch at which the American decision is made. */
  warningMinutes: number
  /** Fraction of the bomber force on ground alert. */
  bomberAlert: number
  /** Fraction of the American force committed. */
  usOption: number
  usRule: 'counterforce' | 'countervalue' | 'mixed'
  sovietRule: 'counterforce' | 'countervalue' | 'mixed'
  /** Fraction of the Soviet force committed to the first strike: the scenario, not the planner's choice; one, or zero when standing down is allowed. */
  sovietOption: number
  /** Missile reliability assumed, both sides: the centre of the published range, which the seeds draw across. Not searched. */
  reliability: number
  /** Interceptors in a hypothetical American layer, at the defence lab's arithmetic; zero under the treaty. */
  interceptors: number
}

export const PLAN_BOUNDS = {
  warningMinutes: [12, 28] as const,
  bomberAlert: [0.3, 1] as const,
  usOption: [0.25, 1] as const,
  sovietOption: [0.25, 1] as const,
  reliability: [0.75, 0.95] as const,
  interceptors: [0, 2_000] as const,
}
const RULES = ['counterforce', 'countervalue', 'mixed'] as const

export type Objective = 'total' | 'own' | 'destruction' | 'retaliatory' | 'criteria'
export const OBJECTIVES: Array<{ id: Objective; label: string; line: string }> = [
  { id: 'total', label: 'Minimise total deaths', line: 'The loss is everyone' },
  { id: 'own', label: 'Minimise own-side deaths', line: 'The loss is Americans' },
  { id: 'destruction', label: 'Maximise target destruction', line: 'The loss is what is left standing' },
  { id: 'retaliatory', label: 'Preserve a retaliatory force', line: 'The loss is what cannot be fired afterwards' },
  { id: 'criteria', label: "Meet the planners' criteria", line: 'A fifth of the population and half the industry, then the fewest dead that achieves it' },
]

export interface Constraints {
  generalWar: boolean
  minCoverage: number
  retaliatory: boolean
}

/** Deaths from one detonation on a target, by yield class, the largest weapon counting once. */
export interface DeathTable {
  [targetId: string]: { [yieldKt: number]: { blast: number; fire: number } }
}

export interface Score {
  usDead: number
  suDead: number
  total: number
  /** Fraction of the Soviet target list that receives at least one weapon. */
  coverage: number
  /** Fraction of the Soviet urban population inside the lethal bands. */
  populationDestroyed: number
  /** Fraction of the Soviet force sites struck. */
  forcesStruck: number
  /** American weapons alive after the Soviet first strike, before the answer. */
  retaliatory: number
  silosSurviving: number
  launchUnderAttack: boolean
  usWeaponsFired: number
  sovietWeaponsFired: number
  feasible: boolean
  why: string
}

/** The yield class the table was computed for, nearest below or equal. */
export function yieldClass(kt: number, classes: number[]): number {
  let best = classes[0]
  for (const c of classes) if (Math.abs(c - kt) < Math.abs(best - kt)) best = c
  return best
}

export const US_CLASSES = [100, 335, 1_100]
export const SU_CLASSES = [500, 1_000]

/** The weapon a planner would put on a target, in the categories the SIOP used and with the systems of 1983. */
export interface Assignment {
  system: string
  warhead: string
  kt: number
  /** Weapons on the target in a full option. */
  count: number
  category: 'COMMAND' | 'ICBM FIELD' | 'BOMBER BASE' | 'SUBMARINE BASE' | 'URBAN-INDUSTRIAL' | 'SILO'
}

/**
 * The target-to-weapon pairing a SAC planner of 1983 could have made, by
 * category: hard command in Moscow to the megaton class (Minuteman II, the
 * Titans, the B-52's gravity bombs), ICBM fields to the Minuteman III with
 * two W78 per silo, time-urgent soft bomber fields and submarine bases to
 * the SLBMs, and urban-industrial areas to the W76 by population with the
 * W78 on the largest. The Soviet pairing is the window study's: SS-18 on
 * the silos two to one, the forward Yankees on the bases and command, the
 * SS-11 and the reserve on the cities. This is a plausible assignment
 * inside the planners' rules, not a leaked one; the SIOP is withheld.
 */
const ASSIGNED = new WeakMap<DeathTable, Map<string, Assignment>>()
export function assignmentsOf(posture: Posture1983, table: DeathTable): Map<string, Assignment> {
  let m = ASSIGNED.get(table)
  if (!m) {
    m = assignments(posture, table)
    ASSIGNED.set(table, m)
  }
  return m
}

/** The weapons an urban area draws: by the dead one 100 kt weapon would make there, which is the population within its reach, two to twelve. */
function urbanCount(size: number): number {
  return Math.max(2, Math.min(12, Math.ceil(size / 60_000)))
}

export function assignments(posture: Posture1983, table: DeathTable): Map<string, Assignment> {
  const out = new Map<string, Assignment>()
  const size = (id: string, kt: number, fallback: number) => table[id]?.[kt]?.fire ?? fallback * 0.4
  for (const f of posture.sovietForces) {
    if (f.id === 'su-moscow') out.set(f.id, { system: 'Minuteman II', warhead: 'W56 1.2 Mt', kt: 1_100, count: 6, category: 'COMMAND' })
    else if (/Rocket Division/.test(f.name)) out.set(f.id, { system: 'Minuteman III', warhead: 'W78 335 kt', kt: 335, count: (f.maxWeapons ?? 2) * 2, category: 'ICBM FIELD' })
    else if (/Fleet/.test(f.name)) out.set(f.id, { system: 'Trident I C4', warhead: 'W76 100 kt', kt: 100, count: 4, category: 'SUBMARINE BASE' })
    else out.set(f.id, { system: 'Trident I C4', warhead: 'W76 100 kt', kt: 100, count: 4, category: 'BOMBER BASE' })
  }
  // The W78 goes on the thirty largest urban areas by what a weapon would find there; the W76 on the rest.
  const ranked = [...posture.sovietCities].sort((a, b) => size(b.id, 100, b.population) - size(a.id, 100, a.population))
  const largest = new Set(ranked.slice(0, 30).map((c) => c.id))
  for (const c of posture.sovietCities) {
    const big = largest.has(c.id)
    out.set(c.id, { system: big ? 'Minuteman III' : 'Poseidon C3 and Trident I C4', warhead: big ? 'W78 335 kt' : 'W76 100 kt', kt: big ? 335 : 100, count: urbanCount(size(c.id, 100, c.population)), category: 'URBAN-INDUSTRIAL' })
  }
  for (const s of posture.siloTargets) out.set(s.id, { system: 'SS-18', warhead: '500 kt', kt: 500, count: 2, category: 'SILO' })
  for (const b of posture.usBases) out.set(b.id, { system: 'SS-N-6 (Yankee, forward)', warhead: '1 Mt', kt: 1_000, count: 2, category: /Naval|Kings Bay|Holy Loch|Bangor|Poseidon|Trident|Ohio/.test(b.name) ? 'SUBMARINE BASE' : 'BOMBER BASE' })
  for (const c of posture.usCommand) out.set(c.id, { system: 'SS-N-6 (Yankee, forward)', warhead: '1 Mt', kt: 1_000, count: 2, category: 'COMMAND' })
  for (const c of posture.usCities) out.set(c.id, { system: 'SS-11 and the reserve', warhead: '1 Mt', kt: 1_000, count: urbanCount(size(c.id, 500, c.population)), category: 'URBAN-INDUSTRIAL' })
  return out
}

function draw(seed: number, key: string, lo: number, hi: number): number {
  return lo + (hi - lo) * hash01(`wopr:${seed}:${key}`)
}

interface Struck {
  [targetId: string]: number
}

/** Hand `weapons` to targets in order, up to each target's cap, and return what was struck and what was left. */
function allocate(weapons: number, targets: Array<{ id: string; cap: number }>, struck: Struck): number {
  let left = weapons
  for (const t of targets) {
    if (left <= 0) break
    const n = Math.min(t.cap, left)
    struck[t.id] = (struck[t.id] ?? 0) + n
    left -= n
  }
  return left
}

function deaths(table: DeathTable, struck: Struck, assigned: Map<string, Assignment>, fallbackKt: number, classes: number[]): number {
  let sum = 0
  for (const id of Object.keys(struck)) {
    const c = yieldClass(assigned.get(id)?.kt ?? fallbackKt, classes)
    const row = table[id]?.[c]
    if (row) sum += row.fire
  }
  return sum
}

export function evaluate(posture: Posture1983, table: DeathTable, plan: Plan, seed: number, constraints: Constraints, assigned: Map<string, Assignment> = assignmentsOf(posture, table)): Score {
  const rel = Math.max(0.5, Math.min(1, plan.reliability + draw(seed, 'rel', -0.1, 0.1)))
  const cep = draw(seed, 'cep', 200, 350)
  const penetration = draw(seed, 'pen', 0.5, 0.7)
  const pKill = singleShotKill(posture.accuracy['SS-18'].yieldKt, cep, posture.siloPsi)
  const cityCap = (pop: number) => Math.max(2, Math.min(12, Math.ceil(pop / 150_000)))

  // --- The Soviet first strike -------------------------------------------------
  const heavy = posture.sovietHeavy.reduce((s, h) => s + h.warheads, 0)
  const old = posture.sovietOld.reduce((s, h) => s + h.warheads, 0)
  const forward = posture.sovietBoats.filter((b) => b.forward).reduce((s, b) => s + b.warheads, 0)
  const bastion = posture.sovietBoats.filter((b) => !b.forward).reduce((s, b) => s + b.warheads, 0)
  const committed = plan.sovietOption < 0.05 ? 0 : Math.round((heavy + old + forward) * plan.sovietOption * rel)
  const leak = plan.interceptors > 0 ? engage({ warheads: committed, decoysPerWarhead: 0, discriminated: 1 }, { interceptors: plan.interceptors, pKill: 0.5, salvo: 2, absentee: 1, shootLookShoot: false }).leakageFraction : 1
  const arriving = Math.round(committed * leak)
  const struckUs: Struck = {}
  const siloList = posture.siloTargets.map((t) => ({ id: t.id, cap: assigned.get(t.id)?.count ?? 2 }))
  const baseList = posture.usBases.map((t) => ({ id: t.id, cap: 2 }))
  const commandList = posture.usCommand.map((t) => ({ id: t.id, cap: 2 }))
  const usCityList = posture.usCities.map((t) => ({ id: t.id, cap: assigned.get(t.id)?.count ?? cityCap(t.population) }))
  let left = arriving
  if (plan.sovietRule === 'counterforce') {
    left = allocate(left, siloList, struckUs)
    left = allocate(left, [...baseList, ...commandList], struckUs)
    left = allocate(left, usCityList, struckUs)
  } else if (plan.sovietRule === 'countervalue') {
    left = allocate(left, usCityList, struckUs)
    left = allocate(left, [...baseList, ...commandList], struckUs)
    left = allocate(left, siloList.map((s) => ({ ...s, cap: 1 })), struckUs)
  } else {
    left = allocate(left, siloList.map((s) => ({ ...s, cap: 1 })), struckUs)
    left = allocate(left, usCityList, struckUs)
    left = allocate(left, [...baseList, ...commandList], struckUs)
  }
  const reserve = committed === 0 ? 0 : Math.max(0, heavy + old + forward - committed) + Math.round(bastion * rel)

  // Silos: expected survivors under the single-shot kill rule.
  let silosSurviving = 0
  let survivingWarheads = 0
  for (const s of posture.silos) {
    const n = struckUs[s.id] ?? 0
    const p = (1 - pKill) ** n
    silosSurviving += p
    survivingWarheads += p * s.warheads
  }
  // Bombers: the alert fraction at coastal bases is caught by the forward boats when they are struck; interior alert bombers fly.
  let bombersFlown = 0
  for (const b of posture.usBombers) {
    const alert = b.weapons * plan.bomberAlert
    const hit = (struckUs[`base-${b.id}`] ?? 0) > 0
    if (!(b.coastal && hit)) bombersFlown += alert
  }
  const atSea = posture.usSlbmAtSea.reduce((s, b) => s + b.weapons, 0)
  const usFirstDead = deaths(table, struckUs, assigned, 500, SU_CLASSES)

  // --- The American answer ------------------------------------------------------
  const arrival = posture.flightSeconds / 60
  const launchUnderAttack = plan.posture === 'launch' && plan.warningMinutes + 2 < arrival
  const icbmWarheads = launchUnderAttack ? posture.silos.reduce((s, x) => s + x.warheads, 0) : survivingWarheads
  const retaliatory = survivingWarheads + atSea + bombersFlown
  const usFired = plan.usOption < 0.05 ? 0 : Math.round((icbmWarheads * rel + atSea * rel + bombersFlown * rel * penetration) * plan.usOption)
  const struckSu: Struck = {}
  const forceList = posture.sovietForces.map((t) => ({ id: t.id, cap: assigned.get(t.id)?.count ?? t.maxWeapons ?? 2 }))
  const suCityList = posture.sovietCities.map((t) => ({ id: t.id, cap: assigned.get(t.id)?.count ?? cityCap(t.population) }))
  let usLeft = usFired
  if (plan.usRule === 'counterforce') {
    usLeft = allocate(usLeft, forceList, struckSu)
    usLeft = allocate(usLeft, suCityList, struckSu)
  } else if (plan.usRule === 'countervalue') {
    usLeft = allocate(usLeft, suCityList, struckSu)
    usLeft = allocate(usLeft, forceList, struckSu)
  } else {
    usLeft = allocate(usLeft, forceList.map((f) => ({ ...f, cap: 1 })), struckSu)
    usLeft = allocate(usLeft, suCityList, struckSu)
    usLeft = allocate(usLeft, forceList, struckSu)
  }
  const suDead = deaths(table, struckSu, assigned, 335, US_CLASSES)
  const targetCount = posture.sovietForces.length + posture.sovietCities.length
  const coverage = Object.keys(struckSu).length / targetCount
  const forcesStruck = posture.sovietForces.filter((t) => struckSu[t.id]).length / posture.sovietForces.length
  const suUrbanPop = posture.sovietCities.reduce((s, c) => s + c.population, 0)
  const suCityDead = posture.sovietCities.reduce((s, c) => s + (struckSu[c.id] ? (table[c.id]?.[yieldClass(assigned.get(c.id)?.kt ?? 335, US_CLASSES)]?.fire ?? 0) : 0), 0)
  const populationDestroyed = suUrbanPop > 0 ? Math.min(1, suCityDead / suUrbanPop) : 0

  // --- The Soviet reserve, on the cities ----------------------------------------
  const struckUs2: Struck = {}
  allocate(Math.round(reserve * rel), usCityList.filter((c) => !struckUs[c.id]), struckUs2)
  const usSecondDead = deaths(table, struckUs2, assigned, 1_000, SU_CLASSES)

  const usDead = usFirstDead + usSecondDead
  const total = usDead + suDead
  let feasible = true
  let why = 'admissible'
  // The coverage and retaliation constraints are the planners' and apply to the war they planned; with execution optional they are moot.
  if (constraints.generalWar && (arriving < 1 || usFired < 1)) {
    feasible = false
    why = 'general war not executed'
  } else if (constraints.generalWar && coverage < constraints.minCoverage) {
    feasible = false
    why = `coverage ${Math.round(coverage * 100)}% below ${Math.round(constraints.minCoverage * 100)}%`
  } else if (constraints.generalWar && constraints.retaliatory && retaliatory <= 0) {
    feasible = false
    why = 'no retaliatory force survives'
  }
  return { usDead, suDead, total, coverage, populationDestroyed, forcesStruck, retaliatory, silosSurviving, launchUnderAttack, usWeaponsFired: usFired, sovietWeaponsFired: arriving + Math.round(reserve * rel), feasible, why }
}

/** The loss under an objective; lower is better. Infeasible plans are infinitely bad. */
export function loss(score: Score, objective: Objective): number {
  if (!score.feasible) return Infinity
  switch (objective) {
    case 'total':
      return score.total
    case 'own':
      // Ties among plans that cost no American lives are broken by everyone else's.
      return score.usDead + score.total * 1e-6
    case 'destruction':
      return -(score.coverage + score.populationDestroyed + score.forcesStruck) * 1e8
    case 'retaliatory':
      return -score.retaliatory * 1e4 + score.usDead * 0.01
    case 'criteria':
      // McNamara's fifth of the population and half of industry, industry read as the force and city list; then the fewest dead.
      return score.populationDestroyed >= 0.2 && score.forcesStruck >= 0.5 ? score.total : Infinity
  }
}

export interface Averaged {
  score: Score
  loss: number
  /** Total deaths over the seeds: the range the plan's number lives in. */
  low: number
  high: number
  /** American deaths over the seeds: depending on the breaks. */
  ownLow: number
  ownHigh: number
}

export function evaluateSeeds(posture: Posture1983, table: DeathTable, plan: Plan, seeds: number, constraints: Constraints, objective: Objective): Averaged {
  const scores: Score[] = []
  for (let s = 0; s < seeds; s += 1) scores.push(evaluate(posture, table, plan, s, constraints))
  const mean = (f: (x: Score) => number) => scores.reduce((a, x) => a + f(x), 0) / scores.length
  const score: Score = {
    ...scores[0],
    usDead: mean((x) => x.usDead),
    suDead: mean((x) => x.suDead),
    total: mean((x) => x.total),
    coverage: mean((x) => x.coverage),
    populationDestroyed: mean((x) => x.populationDestroyed),
    forcesStruck: mean((x) => x.forcesStruck),
    retaliatory: mean((x) => x.retaliatory),
    silosSurviving: mean((x) => x.silosSurviving),
    usWeaponsFired: mean((x) => x.usWeaponsFired),
    sovietWeaponsFired: mean((x) => x.sovietWeaponsFired),
    feasible: scores.every((x) => x.feasible),
    why: scores.find((x) => !x.feasible)?.why ?? 'admissible',
  }
  return { score, loss: loss(score, objective), low: Math.min(...scores.map((x) => x.total)), high: Math.max(...scores.map((x) => x.total)), ownLow: Math.min(...scores.map((x) => x.usDead)), ownHigh: Math.max(...scores.map((x) => x.usDead)) }
}

export interface SearchOptions {
  /** The options may fall to zero, which is not launching; both sides. */
  allowIdle?: boolean
  /** The Soviet first strike's rule: the scenario, held fixed by the search. */
  sovietRule?: Plan['sovietRule']
}

/** A random plan inside the bounds. The Soviet strike and the reliability are the scenario and are not varied. */
export function randomPlan(rng: () => number, opts: SearchOptions = {}): Plan {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)]
  const span = (b: readonly [number, number]) => b[0] + rng() * (b[1] - b[0])
  const option = opts.allowIdle ? ([0, 1] as const) : PLAN_BOUNDS.usOption
  return {
    posture: rng() < 0.5 ? 'ride' : 'launch',
    warningMinutes: Math.round(span(PLAN_BOUNDS.warningMinutes)),
    bomberAlert: span(PLAN_BOUNDS.bomberAlert),
    usOption: opts.allowIdle && rng() < 0.5 ? 0 : span(option),
    usRule: pick(RULES),
    sovietRule: opts.sovietRule ?? 'counterforce',
    sovietOption: opts.allowIdle && rng() < 0.5 ? 0 : 1,
    reliability: 0.85,
    interceptors: rng() < 0.7 ? 0 : Math.round(span(PLAN_BOUNDS.interceptors)),
  }
}

/** One variable nudged. */
export function perturb(plan: Plan, rng: () => number, opts: SearchOptions = {}): Plan {
  const next = { ...plan }
  const clamp = (v: number, b: readonly [number, number]) => Math.max(b[0], Math.min(b[1], v))
  const option = opts.allowIdle ? ([0, 1] as const) : PLAN_BOUNDS.usOption
  const k = Math.floor(rng() * (opts.allowIdle ? 7 : 6))
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)]
  switch (k) {
    case 0:
      next.posture = next.posture === 'ride' ? 'launch' : 'ride'
      break
    case 1:
      next.warningMinutes = Math.round(clamp(next.warningMinutes + (rng() - 0.5) * 6, PLAN_BOUNDS.warningMinutes))
      break
    case 2:
      next.bomberAlert = clamp(next.bomberAlert + (rng() - 0.5) * 0.3, PLAN_BOUNDS.bomberAlert)
      break
    case 3:
      next.usOption = clamp(next.usOption + (rng() - 0.5) * 0.3, option)
      break
    case 4:
      next.usRule = pick(RULES)
      break
    case 5:
      next.interceptors = rng() < 0.3 ? 0 : Math.round(clamp(next.interceptors + (rng() - 0.5) * 600, PLAN_BOUNDS.interceptors))
      break
    default:
      next.sovietOption = next.sovietOption > 0 ? 0 : 1
  }
  if (opts.sovietRule) next.sovietRule = opts.sovietRule
  return next
}

/** A small deterministic generator, so a run can be replayed. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4_294_967_296
  }
}

export function describePlan(p: Plan): string {
  return [
    p.posture === 'launch' ? `LAUNCH UNDER ATTACK AT H+${p.warningMinutes}` : `RIDE OUT · DECIDE AT H+${p.warningMinutes}`,
    `BOMBERS ${Math.round(p.bomberAlert * 100)}% ON ALERT`,
    p.usOption < 0.05 ? 'US DOES NOT LAUNCH' : `US OPTION ${Math.round(p.usOption * 100)}% · ${p.usRule.toUpperCase()}`,
    p.sovietOption < 0.05 ? 'SOVIETS STAND DOWN' : `SOVIET FIRST STRIKE ${p.sovietRule.toUpperCase()}`,
    p.interceptors > 0 ? `${p.interceptors} INTERCEPTORS` : 'NO DEFENCE',
  ].join(' · ')
}

/** The targets the exposure table must cover, with the yield classes each needs, and a sample of silos per wing standing for the field. */
export function tableTargets(posture: Posture1983): Array<{ id: string; position: LngLat; classes: number[] }> {
  const out: Array<{ id: string; position: LngLat; classes: number[] }> = []
  for (const c of posture.usCities) out.push({ id: c.id, position: c.position, classes: SU_CLASSES })
  for (const b of posture.usBases) out.push({ id: b.id, position: b.position, classes: SU_CLASSES })
  for (const c of posture.usCommand) out.push({ id: c.id, position: c.position, classes: SU_CLASSES })
  for (const f of posture.sovietForces) out.push({ id: f.id, position: f.position, classes: US_CLASSES })
  for (const c of posture.sovietCities) out.push({ id: c.id, position: c.position, classes: US_CLASSES })
  return out
}

/** Silos share a wing's sample: three silos per wing are computed and the rest copy the mean. */
export function siloSamples(posture: Posture1983): Array<{ wing: string; id: string; position: LngLat }> {
  const out: Array<{ wing: string; id: string; position: LngLat }> = []
  const byWing = new Map<string, typeof posture.silos>()
  for (const s of posture.silos) byWing.set(s.wing, [...(byWing.get(s.wing) ?? []), s])
  for (const [wing, list] of byWing) for (const i of [0, Math.floor(list.length / 2), list.length - 1]) out.push({ wing, id: list[i].id, position: list[i].position })
  return out
}

/** Fill every silo's row from its wing's sample mean. */
export function spreadSilos(posture: Posture1983, table: DeathTable, samples: Array<{ wing: string; id: string }>): void {
  const means = new Map<string, { blast: number; fire: number }>()
  const byWing = new Map<string, string[]>()
  for (const s of samples) byWing.set(s.wing, [...(byWing.get(s.wing) ?? []), s.id])
  for (const [wing, ids] of byWing) {
    const rows = ids.map((id) => table[id]?.[500]).filter((r): r is { blast: number; fire: number } => !!r)
    if (rows.length) means.set(wing, { blast: rows.reduce((a, r) => a + r.blast, 0) / rows.length, fire: rows.reduce((a, r) => a + r.fire, 0) / rows.length })
  }
  for (const s of posture.silos) {
    const m = means.get(s.wing)
    if (m) table[s.id] = { 500: m, 1_000: m }
  }
}
