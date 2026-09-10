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
  /**
   * Fill the ring as well as drawing it. Only for a ring that encloses an
   * area meaning something — the ground a boost-phase interceptor must
   * already be over — rather than a ring meaning "somewhere about here".
   */
  ringFill?: 'hatch'
  /** Label placement relative to the mark; default 'left' anchor (label to the right of the mark). */
  labelAnchor?: LabelAnchor
  /** Study seconds at which the site comes into existence; before that it is not drawn. Default: always there. */
  appearsAt?: number
  /** Study seconds at which an appearing site goes again, such as a reach ring that means nothing after burnout. */
  vanishesAt?: number
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
  /** Moments on the trail worth a mark: burnout, where the boost phase and its intercept window end. */
  marks?: Array<{ kind: 'burnout'; time: number; position: LngLat; altitude: number }>
  labelAnchor?: LabelAnchor
  facts: Array<Evidenced & { label: string; value: string }>
}

export interface FalloutAssumption {
  fissionFraction: number
  windMph: number
  downwindBearingDeg: number
  untilHours: number
  /** Directional shear of the carrying winds, degrees; the model's contours assume 15. */
  shearDeg?: number
  /** Fraction of the idealized dose rate a real surface gives; Glasstone's 0.7 in the open. */
  terrainFactor?: number
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
  /**
   * Points that must be in shot. When given, the camera fits them with a
   * margin instead of taking `zoom`, which is what a portrait phone needs:
   * the same zoom shows far less across than it does on a wide screen.
   */
  fit?: LngLat[]
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
  /** Further reading: the studies and labs this one leans on, and outside sources. */
  links?: Array<{ label: string; href: string }>
  /** Outlines drawn under everything: a target's boundary from the map. */
  overlays?: Array<{ id: string; name: string; rings: LngLat[][]; source: string }>
}
