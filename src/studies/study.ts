import type { Evidenced } from '../evidence/evidence.ts'
import type { LngLat } from '../geo/geodesy.ts'
import type { Track } from '../engine/track.ts'
import type { PromptEffects } from '../models/blast.ts'

/** A fixed place: a base, a launch complex, a radar, a target complex. */
export interface SiteEntity extends Evidenced {
  kind: 'site'
  id: string
  name: string
  designation: string
  position: LngLat
  /** Positional uncertainty in metres; drawn as a ring for inferred positions. */
  uncertaintyMetres?: number
  /** Label placement relative to the mark; default 'left' anchor (label to the right of the mark). */
  labelAnchor?: 'left' | 'right' | 'top' | 'bottom'
  facts: Array<Evidenced & { label: string; value: string }>
}

/** A moving thing with a timed path. */
export interface TrackEntity extends Evidenced {
  kind: 'track'
  id: string
  name: string
  designation: string
  track: Track
  /** Provenance for the vehicle's existence and posture may differ from the route's. */
  route: Evidenced
  /** 'full' draws the whole path at once; 'progressive' reveals it behind the vehicle as the clock runs. */
  reveal: 'full' | 'progressive'
  labelAnchor?: 'left' | 'right' | 'top' | 'bottom'
  facts: Array<Evidenced & { label: string; value: string }>
}

/** Rings that appear at a moment. */
export interface EffectEntity extends Evidenced {
  kind: 'effect'
  id: string
  name: string
  designation: string
  center: LngLat
  time: number
  effects: PromptEffects
  facts: Array<Evidenced & { label: string; value: string }>
}

export type Entity = SiteEntity | TrackEntity | EffectEntity

export interface CameraMove {
  center: LngLat
  zoom: number
  pitch?: number
  bearing?: number
  durationMs?: number
}

export interface StudyEvent {
  time: number
  text: string
  entityId?: string
  /** Fly the camera when the running clock crosses this event. */
  camera?: CameraMove
}

export interface Study {
  id: string
  title: string
  subtitle: string
  bounds: { start: number; end: number }
  /** Initial camera. */
  view: { center: LngLat; zoom: number }
  entities: Entity[]
  events: StudyEvent[]
  /** What the study does not compute, stated on the readout. */
  omissions: string[]
}
