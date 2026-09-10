import type { LngLat } from '../geo/geodesy.ts'
import type { EvidenceTier } from '../evidence/evidence.ts'
import forces from '../../data/atlas/forces-2025.json'

/** The nine powers, by the two-letter keys the forces file uses. */
export type Power = 'us' | 'ru' | 'cn' | 'fr' | 'uk' | 'in' | 'pk' | 'il' | 'nk'

export interface ForceSite {
  id: string
  side: Power
  name: string
  kind: 'icbm' | 'slbm' | 'irbm' | 'bomber'
  system: string
  warheadsPerMissile: number
  /** The missile's capacity where it exceeds the deployed load; the full-loading posture. */
  warheadsPerMissileFull?: number
  yieldKt: number
  rangeKm: number
  /** Air-delivered and submarine cruise systems: release this far short of the target; the carrier's and the missile's speeds. */
  standoffKm?: number
  carrierSpeedMs?: number
  missileSpeedMs?: number
  /** The tier of the standoff range and the note that gives it; a system without a standoff must overfly its target. */
  standoffEvidence?: EvidenceTier
  standoffNote?: string
  /** The carrier's cruising altitude and the weapon's run, metres; the distance from the target at which the carrier goes to the deck. */
  cruiseAltitudeMetres?: number
  weaponAltitudeMetres?: number
  descendAtMetres?: number
  /** Circular error probable, metres, and the planning reliability; inferred for the opaque arsenals. */
  cepMetres: number
  reliability: number
  /** Liquid heavies burn for five minutes; solids for three. */
  propellant: 'solid' | 'liquid'
  position: LngLat
  positionEvidence: EvidenceTier
  evidence: EvidenceTier
  note: string
  source: string
}

interface Raw {
  powers: Record<string, { name: string; adjective: string }>
  sites: Array<Omit<ForceSite, 'position' | 'side' | 'kind' | 'positionEvidence' | 'evidence'> & { lon: number; lat: number; side: string; kind: string; positionEvidence: string; evidence: string; standoffKm?: number; carrierSpeedMs?: number; missileSpeedMs?: number; standoffEvidence?: string; standoffNote?: string; cruiseAltitudeMetres?: number; weaponAltitudeMetres?: number; descendAtMetres?: number; cepMetres: number; reliability: number; propellant: string; warheadsPerMissileFull?: number }>
}

const raw = forces as Raw

export const POWERS = raw.powers as Record<Power, { name: string; adjective: string }>
export const POWER_IDS = Object.keys(POWERS) as Power[]

export const FORCES: ForceSite[] = raw.sites.map((s) => ({
  id: s.id,
  side: s.side as Power,
  name: s.name,
  kind: s.kind as ForceSite['kind'],
  system: s.system,
  warheadsPerMissile: s.warheadsPerMissile,
  warheadsPerMissileFull: s.warheadsPerMissileFull,
  yieldKt: s.yieldKt,
  rangeKm: s.rangeKm,
  standoffKm: s.standoffKm,
  carrierSpeedMs: s.carrierSpeedMs,
  missileSpeedMs: s.missileSpeedMs,
  standoffEvidence: s.standoffEvidence as EvidenceTier | undefined,
  standoffNote: s.standoffNote,
  cruiseAltitudeMetres: s.cruiseAltitudeMetres,
  weaponAltitudeMetres: s.weaponAltitudeMetres,
  descendAtMetres: s.descendAtMetres,
  cepMetres: s.cepMetres,
  reliability: s.reliability,
  propellant: s.propellant as 'solid' | 'liquid',
  position: [s.lon, s.lat],
  positionEvidence: s.positionEvidence as EvidenceTier,
  evidence: s.evidence as EvidenceTier,
  note: s.note,
  source: s.source,
}))

export const FORCES_SOURCE = raw.sites[0]?.source ?? ''
