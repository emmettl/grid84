import type { Evidenced, Provenance } from '../evidence/evidence.ts'

/**
 * SIOP-62 force generation: the fourteen execution options as a curve of
 * delivery systems and weapons against preparation time, from the 13
 * September 1961 briefing as reproduced by Sagan (1987), and the alert,
 * non-alert and fully generated force tables of 15 July 1961 from the same
 * source. "Warning time, whether it be in minutes or days, is the key to
 * success of the plan."
 */
const BRIEFING: Provenance = { source: 'Sagan 1987', locator: 'International Security 12:1, briefing pp. 48–49 (options, force generation)', url: 'https://archive.org/details/SIOP62TheNuclearWarPlanBriefingToPresidentKennedy' }
const TABLES: Provenance = { source: 'Sagan 1987', locator: 'Tables 1–3, U.S. Strategic Nuclear Forces, 15 July 1961, p. 25' }
const JCS_2056: Provenance = { source: 'Sagan 1987', locator: 'n. 5, citing JCS 2056/181, 14 Sept 1960' }

export interface GenerationPoint extends Evidenced {
  option: number
  /** Hours after the alert hour. */
  hours: number
  systems: number
  weapons?: number
  note?: string
}

/** Documented points on the force-generation chart. Option numbers 2 and 7 are stated; 1 and 14 are named. */
export const GENERATION_POINTS: GenerationPoint[] = [
  { option: 1, hours: 0, systems: 1_004, weapons: 1_685, evidence: 'documented', provenance: BRIEFING, note: 'The Alert Option: capable of immediate launch' },
  { option: 2, hours: 1, systems: 1_099, evidence: 'documented', provenance: BRIEFING, note: '"If one hour of preparation time is available, an additional 95 systems will have been prepared"' },
  { option: 7, hours: 6, systems: 1_658, evidence: 'documented', provenance: BRIEFING, note: '"At the end of six hours of preparation time, 1658 delivery systems will be prepared for launch under Option 7"' },
  { option: 14, hours: 14, systems: 2_244, weapons: 3_267, evidence: 'documented', provenance: BRIEFING, note: 'The Strategic Warning Option: a minimum of 14 hours, no maximum' },
]

/** Options 2 to 13 "are based on preparation times of up to 14 hours"; option n at n−1 hours fits the two stated cases. */
export function optionHours(option: number): number {
  if (option <= 1) return 0
  if (option >= 14) return 14
  return option - 1
}

export function optionAt(hours: number): number {
  if (hours >= 14) return 14
  return Math.max(1, Math.min(13, Math.floor(hours) + 1))
}

function interpolate(hours: number, key: 'systems' | 'weapons'): number {
  const pts = GENERATION_POINTS.filter((p) => p[key] !== undefined).map((p) => ({ h: p.hours, v: p[key] as number }))
  if (hours <= pts[0].h) return pts[0].v
  if (hours >= pts[pts.length - 1].h) return pts[pts.length - 1].v
  for (let i = 1; i < pts.length; i += 1) {
    if (hours <= pts[i].h) {
      const f = (hours - pts[i - 1].h) / (pts[i].h - pts[i - 1].h)
      return pts[i - 1].v + f * (pts[i].v - pts[i - 1].v)
    }
  }
  return pts[pts.length - 1].v
}

export interface Generation {
  hours: number
  option: number
  systems: number
  weapons: number
  megatons: number
  /** Whether the systems figure is a documented point or a straight line between two. */
  systemsEvidence: 'documented' | 'reconstructed'
}

/** Force ready to launch after `hours` of preparation. Straight lines between the documented points. */
export function generationAt(hours: number): Generation {
  const h = Math.max(0, hours)
  const documented = GENERATION_POINTS.some((p) => Math.abs(p.hours - h) < 1e-9)
  return {
    hours: h,
    option: optionAt(h),
    systems: interpolate(h, 'systems'),
    weapons: interpolate(h, 'weapons'),
    megatons: MEGATONS.alert + (MEGATONS.generated - MEGATONS.alert) * ((interpolate(h, 'weapons') - 1_685) / (3_267 - 1_685)),
    systemsEvidence: documented ? 'documented' : 'reconstructed',
  }
}

/** Total megatonnage, alert force and fully generated force. */
export const MEGATONS = { alert: 1_798, generated: 7_420, provenance: { source: 'Sagan 1987', locator: 'n. 8, citing the October 1964 memorandum for President Johnson' } as Provenance }

export interface CommandRow {
  command: string
  alert: number
  nonAlert: number
  generated: number
}

/** Weapons by command, 15 July 1961 (Tables 1–3). Note the alert total of 1,530 against the briefing chart's 1,685. */
export const COMMANDS: CommandRow[] = [
  { command: 'Strategic Air Command', alert: 1_236, nonAlert: 944, generated: 2_180 },
  { command: 'Pacific Command', alert: 84, nonAlert: 337, generated: 421 },
  { command: 'European Command', alert: 178, nonAlert: 311, generated: 489 },
  { command: 'Atlantic Command', alert: 32, nonAlert: 145, generated: 177 },
]
export const COMMAND_TOTALS = { alert: 1_530, nonAlert: 1_737, generated: 3_267, provenance: TABLES }

export interface SystemRow {
  system: string
  alert: number
  generated: number
}

/** Weapons by delivery system, 15 July 1961 (Tables 1 and 3). */
export const SYSTEMS: SystemRow[] = [
  { system: 'Aircraft', alert: 1_413, generated: 2_938 },
  { system: 'Cruise missiles', alert: 31, generated: 141 },
  { system: 'Ballistic missiles', alert: 86, generated: 188 },
]

/** Weapons by command at a generation fraction between the alert and fully generated tables. Straight lines: reconstructed. */
export function commandsAt(hours: number): Array<CommandRow & { at: number }> {
  const f = Math.max(0, Math.min(1, hours / 14))
  return COMMANDS.map((c) => ({ ...c, at: c.alert + f * (c.generated - c.alert) }))
}

export const REACTION: Array<Evidenced & { force: string; minutes: number; note: string }> = [
  { force: 'ICBMs and bombers on fixed bases', minutes: 15, note: 'Under tactical warning; "there must be a reasonable assurance that the weapon carrier will survive enemy action long enough to be launched effectively"', evidence: 'documented', provenance: JCS_2056 },
  { force: 'Missile submarines and aircraft carriers', minutes: 120, note: 'Two hours under tactical warning', evidence: 'documented', provenance: JCS_2056 },
]

export const SEQUENCE: Evidenced & { steps: string[] } = {
  steps: ['Ballistic missiles', 'Forces launching from forward areas', 'Forces from the United States'],
  evidence: 'documented',
  provenance: { ...BRIEFING, locator: 'briefing: "The sequence of targeting was first, the ballistic missiles; second, forces launching from forward areas; and last, forces from the US"' },
}

export const POSTURE_1961: Array<Evidenced & { text: string }> = [
  { text: 'Approximately half of the SAC bomber force on fifteen-minute ground alert, with a small number of B-52s on airborne alert at all times', evidence: 'documented', provenance: { source: 'Sagan 1987', locator: 'p. 29' } },
  { text: 'Two of the Atlantic Command’s five Polaris submarines, each with sixteen missiles, on station', evidence: 'documented', provenance: { source: 'Sagan 1987', locator: 'p. 29' } },
  { text: 'About one third of SAC’s ICBM force, twenty-four of seventy-eight missiles, on alert', evidence: 'documented', provenance: { source: 'Sagan 1987', locator: 'p. 29' } },
]

export interface DefconLevel {
  level: number
  term: string
  description: string
  readiness: string
}

/** Defense readiness conditions, defined by the Joint Chiefs in November 1959. */
export const DEFCON: DefconLevel[] = [
  { level: 5, term: 'FADE OUT', description: 'Lowest state of readiness', readiness: 'Normal readiness' },
  { level: 4, term: 'DOUBLE TAKE', description: 'Increased intelligence watch and strengthened security measures', readiness: 'Above normal readiness' },
  { level: 3, term: 'ROUND HOUSE', description: 'Increase in force readiness above that required for normal readiness', readiness: 'Air Force ready to mobilize in fifteen minutes' },
  { level: 2, term: 'FAST PACE', description: 'Next step to nuclear war', readiness: 'Armed forces ready to deploy and engage in less than six hours' },
  { level: 1, term: 'COCKED PISTOL', description: 'Nuclear war is imminent or has already begun', readiness: 'Maximum readiness; immediate response' },
]
export const DEFCON_PROVENANCE: Provenance = { source: 'Wikipedia, DEFCON', locator: 'declassified table; JCS system of November 1959; SAC at DEFCON 2 from 24 October to 15 November 1962, the only time', url: 'https://en.wikipedia.org/wiki/DEFCON' }

export const RIGIDITY: Array<Evidenced & { text: string }> = [
  { text: '"Warning time, whether it be in minutes or days, is the key to success of the plan."', evidence: 'documented', provenance: { ...BRIEFING, locator: 'briefing, Optimum Strike Effort' } },
  { text: 'Every option applies the same integrated target list; the option changes the force, not the targets. "Basically, the SIOP is designed for execution as a whole."', evidence: 'documented', provenance: { ...BRIEFING, locator: 'briefing, Flexibility' } },
  { text: 'Bundy to Kennedy, 7 July 1961: "The current war plan is dangerously rigid and, if continued without amendment, may leave you with very little choice as to how you face the moment of thermonuclear truth."', evidence: 'documented', provenance: { source: 'Sagan 1987', locator: 'n. 5, quoting Bundy’s covering note' } },
]
