import type { Evidenced } from '../evidence/evidence.ts'
import type { LngLat } from '../geo/geodesy.ts'
import type { Track } from '../engine/track.ts'
import type { PromptEffects } from '../models/blast.ts'

export type LabelAnchor = 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'top-left'

/** A fixed place: a base, a launch complex, a radar, a target complex. */
export interface SiteEntity extends Evidenced {
  kind: 'site'
  id: string
  name: string
  designation: string
  /** Draw a text label beside the mark. Default true; large studies turn it off. */
  label?: boolean
  position: LngLat
  /** Positional uncertainty in metres; drawn as a ring for inferred positions. */
  uncertaintyMetres?: number
  /** Label placement relative to the mark; default 'left' anchor (label to the right of the mark). */
  labelAnchor?: LabelAnchor
  facts: Array<Evidenced & { label: string; value: string }>
}

/** What moves along a track. Aircraft draw as a silhouette pointing along the track; everything else as a ring. */
export type VehicleKind = 'aircraft' | 'missile' | 'ship' | 'ground'

/** A moving thing with a timed path. */
export interface TrackEntity extends Evidenced {
  kind: 'track'
  id: string
  name: string
  designation: string
  label?: boolean
  /** Which side's vehicle; colours the mark. Default 'attacker'. */
  side?: 'attacker' | 'defender'
  /** Default 'missile'. */
  vehicle?: VehicleKind
  track: Track
  /** Provenance for the vehicle's existence and posture may differ from the route's. */
  route: Evidenced
  /** 'full' draws the whole path at once; 'progressive' reveals it behind the vehicle as the clock runs. */
  reveal: 'full' | 'progressive'
  labelAnchor?: LabelAnchor
  facts: Array<Evidenced & { label: string; value: string }>
}

export interface FalloutAssumption {
  fissionFraction: number
  windMph: number
  downwindBearingDeg: number
  untilHours: number
  provenance: Evidenced['provenance']
}

/** Rings that appear at a moment. */
export interface EffectEntity extends Evidenced {
  kind: 'effect'
  id: string
  name: string
  designation: string
  label?: boolean
  /** Compact effects draw one mark scaled by yield instead of the ring set; the rings appear when selected. */
  compact?: boolean
  /** Whose weapon; the aggregate outcome is summed per side. Default 'attacker'. */
  side?: 'attacker' | 'defender'
  center: LngLat
  time: number
  effects: PromptEffects
  /** Air burst by default; a surface burst shrinks the prompt radii and raises a plume. */
  burst?: 'air' | 'surface'
  /** Plume assumptions, used when the burst is on the surface. */
  fallout?: FalloutAssumption
  /** Ids of the track entities whose weapons arrive here; selecting the detonation lights them. */
  deliveredBy?: string[]
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
  /** Where the clock opens; default ten minutes before H-hour or the start of the bounds, whichever is later. */
  startTime?: number
  /** Initial camera. */
  view: { center: LngLat; zoom: number }
  entities: Entity[]
  events: StudyEvent[]
  /** What the study does not compute, stated on the readout. */
  omissions: string[]
  /** A prepared population grid: a HYDE name under data/hyde such as 'popc_1961', a path under data/ such as 'ghsl/popc_1985', or an absolute URL to a bucket holding the same layout; effects then compute exposure. */
  populationGrid?: string
  /** Which burst mode the study opens in; default air. */
  defaultBurst?: 'air' | 'surface'
  /** Bounds to use when the study is switched to surface bursts, so the plume has days to fall. */
  surfaceBounds?: { start: number; end: number }
  /** Exposure workers to run; large studies ask for more. */
  exposureWorkers?: number
  /** A documented figure to set the aggregate outcome against, with its source. */
  outcomeReference?: { label: string; value: number; source: string }
  /** Names and references for the two sides, when a study has a response. */
  sides?: { attacker: { name: string }; defender: { name: string; reference?: { label: string; value: number; source: string } } }
  /** Sibling studies reached by a switch on the clock panel, such as the execution options of a plan. */
  variants?: { label: string; current: string; items: Array<{ id: string; label: string; href: string }> }
}
