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
  yieldKt: number
  rangeKm: number
  /** Air-delivered and submarine cruise systems: release this far short of the target; the carrier's and the missile's speeds. */
  standoffKm?: number
  carrierSpeedMs?: number
  missileSpeedMs?: number
  position: LngLat
  positionEvidence: EvidenceTier
  evidence: EvidenceTier
  note: string
  source: string
}

interface Raw {
  powers: Record<string, { name: string; adjective: string }>
  sites: Array<Omit<ForceSite, 'position' | 'side' | 'kind' | 'positionEvidence' | 'evidence'> & { lon: number; lat: number; side: string; kind: string; positionEvidence: string; evidence: string; standoffKm?: number; carrierSpeedMs?: number; missileSpeedMs?: number }>
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
  yieldKt: s.yieldKt,
  rangeKm: s.rangeKm,
  standoffKm: s.standoffKm,
  carrierSpeedMs: s.carrierSpeedMs,
  missileSpeedMs: s.missileSpeedMs,
  position: [s.lon, s.lat],
  positionEvidence: s.positionEvidence as EvidenceTier,
  evidence: s.evidence as EvidenceTier,
  note: s.note,
  source: s.source,
}))

export const FORCES_SOURCE = raw.sites[0]?.source ?? ''
