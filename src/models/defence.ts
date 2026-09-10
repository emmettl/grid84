import type { Evidenced } from '../evidence/evidence.ts'

/**
 * The shot exchange. A defender with a stock of interceptors of some
 * single-shot kill probability fires a salvo at every object it cannot tell
 * from a warhead; an attacker adds warheads and decoys. The arithmetic is
 * the one every assessment since Sentinel has used in some form (the
 * Nitze criterion of 1985 states its cost form: a defence must be cheaper at
 * the margin than the offence it faces, or it will be bought out). Nothing
 * here models the physics of an intercept; the kill probability is an input,
 * and the reference cases take it from the test record where one exists.
 */

export interface Attack {
  /** Warheads that must be stopped. */
  warheads: number
  /** Decoys or other credible objects released per warhead. */
  decoysPerWarhead: number
  /** Fraction of decoys the defender discriminates before committing a shot, 0 to 1. */
  discriminated: number
}

export interface Defence {
  interceptors: number
  /** Single-shot kill probability against an engaged warhead. */
  pKill: number
  /** Interceptors committed per credible object. */
  salvo: number
  /** For a space layer: the number of interceptors in the constellation for each one in position; 1 for a ground site. */
  absentee: number
  /** Fire one, look, fire again only if needed; spends fewer shots per object when time allows. */
  shootLookShoot: boolean
}

export interface Engagement {
  /** Objects the defender must treat as warheads. */
  credibleObjects: number
  /** Interceptors in position to fire. */
  available: number
  /** Shots the doctrine wants for the whole raid. */
  shotsWanted: number
  /** Expected shots actually spent per credible object under the doctrine. */
  shotsPerObject: number
  /** Fraction of credible objects that receive their full engagement. */
  engagedFraction: number
  /** Probability an engaged warhead is killed. */
  pKillEngaged: number
  intercepted: number
  leaked: number
  leakageFraction: number
}

export function engage(a: Attack, d: Defence): Engagement {
  const credibleObjects = a.warheads * (1 + a.decoysPerWarhead * (1 - clamp01(a.discriminated)))
  const available = d.interceptors / Math.max(1, d.absentee)
  const p = clamp01(d.pKill)
  const k = Math.max(1, Math.round(d.salvo))
  const pKillEngaged = 1 - (1 - p) ** k
  // Shoot-look-shoot spends the next shot only after a miss: expected shots are a truncated geometric sum.
  let shotsPerObject = k
  if (d.shootLookShoot) {
    shotsPerObject = 0
    for (let i = 0; i < k; i += 1) shotsPerObject += (1 - p) ** i
  }
  const shotsWanted = credibleObjects * shotsPerObject
  const engagedFraction = shotsWanted > 0 ? Math.min(1, available / shotsWanted) : 1
  const intercepted = a.warheads * engagedFraction * pKillEngaged
  const leaked = a.warheads - intercepted
  return { credibleObjects, available, shotsWanted, shotsPerObject, engagedFraction, pKillEngaged, intercepted, leaked, leakageFraction: a.warheads > 0 ? leaked / a.warheads : 0 }
}

/** Interceptors the defender needs for every credible object to receive its full engagement. */
export function interceptorsNeeded(a: Attack, d: Defence): number {
  const e = engage(a, { ...d, interceptors: Number.MAX_SAFE_INTEGER })
  return Math.ceil(e.shotsWanted * Math.max(1, d.absentee))
}

export interface Costs {
  /** Per interceptor, including its share of the constellation or site. */
  interceptor: number
  /** Per additional warhead, including its share of the missile. */
  warhead: number
  /** Per additional decoy. */
  decoy: number
}

export interface CostExchange {
  /** What the defender must spend to hold its leakage when the attacker adds one warhead. */
  perWarhead: number
  /** What the defender must spend when the attacker adds one credible decoy. */
  perDecoy: number
  /** Defender's marginal cost over the attacker's, for the attacker's cheaper move. */
  ratio: number
  cheaperMove: 'warhead' | 'decoy'
}

/** The Nitze criterion in numbers: the defender's marginal cost against the attacker's, at the doctrine's shots per object. */
export function costExchange(a: Attack, d: Defence, c: Costs): CostExchange {
  const e = engage(a, d)
  const perObject = e.shotsPerObject * Math.max(1, d.absentee) * c.interceptor
  const perWarhead = perObject
  const perDecoy = perObject * (1 - clamp01(a.discriminated))
  const decoyRatio = c.decoy > 0 && perDecoy > 0 ? perDecoy / c.decoy : 0
  const warheadRatio = c.warhead > 0 ? perWarhead / c.warhead : 0
  const cheaperMove = decoyRatio >= warheadRatio ? 'decoy' : 'warhead'
  return { perWarhead, perDecoy, ratio: Math.max(decoyRatio, warheadRatio), cheaperMove }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

export interface ReferenceCase extends Evidenced {
  id: string
  name: string
  year: number
  attack: Attack
  defence: Defence
  costs: Costs
  note: string
}

/** Published defences against the forces they faced, each with its numbers' source and tier. */
export const REFERENCE_CASES: ReferenceCase[] = [
  {
    id: 'gmd-one',
    name: 'GMD against one missile · the film',
    year: 2025,
    attack: { warheads: 1, decoysPerWarhead: 0, discriminated: 1 },
    defence: { interceptors: 44, pKill: 12 / 21, salvo: 2, absentee: 1, shootLookShoot: false },
    costs: { interceptor: 75_000_000, warhead: 30_000_000, decoy: 1_000_000 },
    evidence: 'documented',
    provenance: { source: 'Missile Defense Agency test record: 12 hits in 21 intercept tests through December 2023; 44 interceptors at Fort Greely and Vandenberg; two shots as in A House of Dynamite (2025)', method: 'Unit cost of a ground-based interceptor about $75 million (GAO); warhead and decoy costs are inferred round figures' },
    note: 'The film gives the pair 61 per cent; two shots at the record give 82',
  },
  {
    id: 'gmd-korea',
    name: 'GMD against North Korea\'s launchers',
    year: 2024,
    attack: { warheads: 17, decoysPerWarhead: 0, discriminated: 1 },
    defence: { interceptors: 44, pKill: 12 / 21, salvo: 4, absentee: 1, shootLookShoot: false },
    costs: { interceptor: 75_000_000, warhead: 30_000_000, decoy: 1_000_000 },
    evidence: 'reconstructed',
    provenance: { source: 'Seventeen ICBM launchers (SIPRI 2024; Wikipedia); the four-on-one doctrine', method: 'Every launcher fires one warhead with no decoys, the case the system was built for' },
    note: 'Forty-four interceptors are eleven salvos of four; the eighteenth object is not engaged',
  },
  {
    id: 'gmd-decoys',
    name: 'GMD against the same with balloon decoys',
    year: 2000,
    attack: { warheads: 17, decoysPerWarhead: 10, discriminated: 0 },
    defence: { interceptors: 44, pKill: 12 / 21, salvo: 4, absentee: 1, shootLookShoot: false },
    costs: { interceptor: 75_000_000, warhead: 30_000_000, decoy: 1_000_000 },
    evidence: 'reconstructed',
    provenance: { source: 'Union of Concerned Scientists and MIT Security Studies Program, Countermeasures (April 2000): warheads inside balloons among a cloud of identical balloons defeat midcourse discrimination', method: 'Ten balloons per warhead, none discriminated, is the report\'s illustrative case' },
    note: 'The report\'s conclusion in a number: the defender cannot tell which balloon to shoot',
  },
  {
    id: 'safeguard',
    name: 'Safeguard · Grand Forks',
    year: 1975,
    attack: { warheads: 2_000, decoysPerWarhead: 0, discriminated: 1 },
    defence: { interceptors: 100, pKill: 0.5, salvo: 1, absentee: 1, shootLookShoot: false },
    costs: { interceptor: 20_000_000, warhead: 5_000_000, decoy: 500_000 },
    evidence: 'reconstructed',
    provenance: { source: 'Thirty Spartan and seventy Sprint interceptors at the one site the 1974 ABM protocol allowed, operational October 1975 and ordered closed by Congress within the month; the Soviet ICBM force of 1975 at about 1,600 launchers with MIRVs arriving (Databook vol. 4)', method: 'A kill probability of one half for a nuclear-armed interceptor is an assumption; costs are 1975 dollars, inferred' },
    note: 'One site of a hundred against two thousand: the arithmetic Congress read',
  },
  {
    id: 'a-135',
    name: 'A-135 · Moscow',
    year: 2024,
    attack: { warheads: 400, decoysPerWarhead: 2, discriminated: 0.5 },
    defence: { interceptors: 68, pKill: 0.5, salvo: 1, absentee: 1, shootLookShoot: false },
    costs: { interceptor: 20_000_000, warhead: 30_000_000, decoy: 1_000_000 },
    evidence: 'inferred',
    provenance: { source: 'Sixty-eight nuclear-armed interceptors around Moscow under the treaty\'s hundred (Wikipedia, A-135); the warheads an American plan would put on the Moscow area are not in any record', method: 'Four hundred warheads with two decoys each, half discriminated, is an illustration' },
    note: 'The only other treaty site; the numbers against it are illustrative',
  },
  {
    id: 'pebbles',
    name: 'Brilliant Pebbles as proposed',
    year: 1990,
    attack: { warheads: 10_000, decoysPerWarhead: 0, discriminated: 1 },
    defence: { interceptors: 4_600, pKill: 0.7, salvo: 1, absentee: 10, shootLookShoot: false },
    costs: { interceptor: 2_000_000, warhead: 10_000_000, decoy: 500_000 },
    evidence: 'inferred',
    provenance: { source: 'The Strategic Defense Initiative Organization\'s 1990 architecture of about 4,600 space-based interceptors for boost-phase intercept; the Soviet strategic force of about 10,000 warheads (Nuclear Notebook); the American Physical Society, Science and Technology of Directed Energy Weapons (1987) on the decade or more the technologies needed', method: 'Boost phase leaves no decoys to discriminate but only the pebbles overhead can fire: an absentee ratio of ten and a kill probability of 0.7 are assumptions the programme never tested' },
    note: 'In boost phase the decoys vanish and the absentee ratio takes their place',
  },
  {
    id: 'golden-dome',
    name: 'A space layer of the present decade',
    year: 2025,
    attack: { warheads: 10, decoysPerWarhead: 0, discriminated: 1 },
    defence: { interceptors: 1_600, pKill: 0.7, salvo: 2, absentee: 20, shootLookShoot: false },
    costs: { interceptor: 100_000_000, warhead: 30_000_000, decoy: 1_000_000 },
    evidence: 'inferred',
    provenance: { source: 'Executive order of 27 January 2025 and the programme announced in May 2025; Congressional Budget Office, Costs of Expanding the Space-Based Interceptor Layer (May 2025), which put a constellation able to meet a small salvo at 1,000 to 2,000 interceptors and $161 billion to $542 billion over twenty years, as reported', method: 'Ten warheads in one salvo, an absentee ratio of twenty for a low-orbit constellation, and a kill probability of 0.7 are the illustration\'s assumptions; the programme has published no test' },
    note: 'The announced figures are announcements; the arithmetic is the same as in 1990',
  },
]

/** The default case the lab opens on. */
export const DEFAULT_CASE = REFERENCE_CASES[0]
