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

/**
 * The published intercept-test records, and the fact that several of them
 * are two records wearing one number.
 *
 * A kill probability taken from a test record is already generous \u2014 the
 * trajectory was known in advance, the target was not trying to survive, and
 * the weather was chosen \u2014 but before that generosity is even reached
 * there is the question of what was counted. The two conventions below are
 * both literally true of the same tests; they differ on whether a
 * cancelled shot is a test and whether a glancing blow is a kill. Where a
 * record is given as a single figure anywhere in this project, this table
 * is what stands behind it.
 */
export interface TestRecord extends Evidenced {
  id: string
  system: string
  /** The hits and attempts as the standard tally gives them. */
  hits: number
  attempts: number
  /** The same tests counted another defensible way, where one exists. */
  alternates: Array<{ hits: number; attempts: number; by: string; because: string }>
  through: string
  note: string
}

export const TEST_RECORDS: TestRecord[] = [
  {
    id: 'gmd',
    system: 'Ground-Based Midcourse Defense',
    hits: 12,
    attempts: 21,
    alternates: [
      { hits: 11, attempts: 21, by: 'Union of Concerned Scientists', because: 'FTG-02 of 1 September 2006 scored a failure: the interceptor struck a glancing blow without destroying the target, which the Director of Operational Test and Evaluation called a hit but not a kill' },
      { hits: 13, attempts: 22, by: 'George Lewis', because: 'FTG-11 of 25 March 2019 fired two interceptors a minute apart and counted as two, not one \u2014 while arguing the test demonstrated nothing about salvo doctrine, since a second shot only pays when the first fails' },
    ],
    through: 'FTG-12, 11 December 2023, the programme\u2019s last slated flight test',
    evidence: 'documented',
    provenance: {
      source: 'Missile Defense Agency test record as reported by the Congressional Research Service and the Arms Control Association',
      method: 'The standard tally is twelve of twenty-one; the honest range across published counting conventions is eleven to thirteen of twenty-one or twenty-two',
    },
    note: 'A range of eleven to thirteen of twenty-one is between 52 and 59 per cent, which is the spread this project treats as the uncertainty on the figure',
  },
  {
    id: 'thaad',
    system: 'THAAD',
    hits: 16,
    attempts: 16,
    alternates: [
      { hits: 14, attempts: 18, by: 'Congressional Research Service and CSIS', because: 'the same period of 2006 to 2019, counting the four attempts cancelled before launch because the target malfunctioned' },
    ],
    through: 'FTT-23, 30 August 2019, the most recent official cumulative claim',
    evidence: 'documented',
    provenance: {
      source: 'Missile Defense Agency and Lockheed Martin for sixteen of sixteen; Congressional Research Service for fourteen of eighteen',
      method: 'The perfect record uses a filtered denominator: only tests where an interceptor flew against a target',
    },
    note: 'Neither convention counts the development run: the first attempt of December 1995 failed, and five more from 1996 to 1999 failed after it, attributed to quality control in interceptor manufacture',
  },
  {
    id: 'sm3',
    system: 'SM-3, all variants',
    hits: 40,
    attempts: 50,
    alternates: [
      { hits: 34, attempts: 43, by: 'Center for Arms Control and Non-Proliferation', because: 'a different denominator, most likely excluding the Japanese flight tests; neither source states its counting rule' },
    ],
    through: 'fiscal year 2024',
    evidence: 'documented',
    provenance: {
      source: 'Arms Control Association fact sheet, reviewed January 2025; Center for Arms Control and Non-Proliferation, updated May 2025',
      method: 'Two published tallies of the same programme that cannot both be right, and neither publishes the rule that would reconcile them',
    },
    note: 'The two documented Block IIA failures are 21 June 2017, when a sailor triggered the missile\u2019s self-destruct, and FTM-29 of 31 January 2018, a third-stage ignition failure',
  },
  {
    id: 'patriot-gulf',
    system: 'Patriot, Operation Desert Storm',
    hits: 0,
    attempts: 158,
    alternates: [
      { hits: 82, attempts: 158, by: 'the Army, April 1992', because: 'seventy per cent successful in Saudi Arabia and forty in Israel, on a definition of success that included causing a warhead to change course and land outside a protected area' },
      { hits: 14, attempts: 158, by: 'the Army\u2019s own high-confidence set', because: 'warhead kills the Army held with high confidence \u2014 about a quarter of engagements, and its deputy programme manager conceded high confidence did not mean the Army was certain' },
    ],
    through: '28 February 1991',
    evidence: 'documented',
    provenance: {
      source: 'GAO/NSIAD-92-340, Operation Desert Storm: Data Does Not Exist to Conclusively Say How Well Patriot Performed (22 September 1992); House Report 102-1086, pp. 179-188',
      method: 'Zero is not an assertion that nothing was hit: it is the accounting office\u2019s finding that the data needed to demonstrate a kill was never recorded. Strong evidence exists for about nine per cent of engagements',
    },
    note: 'The claim began at ninety-six per cent for Saudi Arabia and Israel together, on 15 February 1991, and the Army revised it to seventy and forty over the following fourteen months. Telemetry was not fitted because of the weight, and the system recorded a kill whenever the missile reached the computed point of closest approach and stopped talking',
  },
]

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
    provenance: { source: 'Missile Defense Agency test record: 12 hits in 21 intercept tests through FTG-12 of December 2023, which is 11 of 21 or 13 of 22 on the other published counting conventions (see the table above); 44 interceptors at Fort Greely and Vandenberg; two shots as in A House of Dynamite (2025)', method: 'Unit cost of a ground-based interceptor about $75 million (GAO); warhead and decoy costs are inferred round figures' },
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
