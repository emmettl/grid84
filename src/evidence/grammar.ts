import type { EvidenceTier } from './evidence.ts'

/**
 * The visual grammar for each evidence tier, expressed as MapLibre paint
 * fragments so the map and the lab legend cannot drift apart.
 *
 * Documented    solid line, full weight
 * Reconstructed broken vector: long dashes
 * Inferred      ghost: dotted, low alpha, with an uncertainty ring
 * Modelled      solid geometry in the effects hue, thin
 * Withheld      black bar with a thin border: a positive mark, not an absence
 */
export const HUE = {
  cyan: [141, 250, 255] as const,
  amber: [255, 179, 71] as const,
  effect: [255, 96, 96] as const,
  /**
   * Fallout: a hue of its own, because a plume and a blast ring were both
   * drawn in the effect red at different opacities and could not be told
   * apart. They are not the same kind of thing — one is the moment and the
   * other is the days after it — and the map should say so before the legend
   * has to. Yellow-green sits far enough from the red to read at a glance and
   * is the colour the subject has carried since the fifties.
   */
  fallout: [190, 232, 92] as const,
  /** Reconstructed: derived from the record by a stated method; a hue of its own rather than a dash, which read as noise across a thousand tracks. */
  lilac: [196, 168, 255] as const,
  ink: [5, 4, 16] as const,
}

const rgba = (c: readonly [number, number, number], a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`

export interface LineGrammar {
  color: string
  width: number
  dasharray: number[] | null
  opacity: number
  blur: number
}

export interface PointGrammar {
  color: string
  strokeColor: string
  strokeWidth: number
  radius: number
  opacity: number
  /** Radius multiplier for the uncertainty ring, or null for none. */
  ring: number | null
}

export const LINE: Record<EvidenceTier, LineGrammar> = {
  documented: { color: rgba(HUE.cyan, 1), width: 2, dasharray: null, opacity: 1, blur: 0 },
  reconstructed: { color: rgba(HUE.lilac, 0.95), width: 1.6, dasharray: null, opacity: 1, blur: 0 },
  inferred: { color: rgba(HUE.cyan, 0.55), width: 1.2, dasharray: [1, 3], opacity: 0.8, blur: 1 },
  modelled: { color: rgba(HUE.effect, 0.9), width: 1.2, dasharray: null, opacity: 1, blur: 0 },
  withheld: { color: rgba(HUE.ink, 1), width: 6, dasharray: null, opacity: 1, blur: 0 },
}

export const POINT: Record<EvidenceTier, PointGrammar> = {
  documented: { color: rgba(HUE.cyan, 1), strokeColor: rgba(HUE.cyan, 1), strokeWidth: 1, radius: 4, opacity: 1, ring: null },
  reconstructed: { color: rgba(HUE.ink, 0.6), strokeColor: rgba(HUE.lilac, 0.95), strokeWidth: 1.5, radius: 4, opacity: 1, ring: null },
  inferred: { color: rgba(HUE.cyan, 0.25), strokeColor: rgba(HUE.cyan, 0.5), strokeWidth: 1, radius: 3, opacity: 0.9, ring: 6 },
  modelled: { color: rgba(HUE.effect, 0.35), strokeColor: rgba(HUE.effect, 0.9), strokeWidth: 1, radius: 3, opacity: 1, ring: null },
  withheld: { color: rgba(HUE.ink, 1), strokeColor: rgba(HUE.cyan, 0.7), strokeWidth: 1, radius: 5, opacity: 1, ring: null },
}

/** Outline for the withheld tier so a black bar reads against dark ground. */
export const WITHHELD_BORDER = rgba(HUE.cyan, 0.7)
/** Fill for withheld areas: a hatch is approximated with a dense dash on the outline plus a near-black fill. */
export const WITHHELD_FILL = rgba(HUE.ink, 0.92)
/*
  The wash inside a blast ring. It has been raised twice for the same reason:
  on a lit basemap at a wide zoom the rings are the thing the reader is meant
  to be looking at and they were reading as a haze. Now that the plume carries
  its own hue this tint no longer has to staylow to keep the two apart, so it
  is set where the ring is unmistakably an effect and not a shadow.
*/
export const MODELLED_FILL = rgba(HUE.effect, 0.22)
/** The effect rings' own line, heavier than the modelled-track grammar they used to borrow. */
export const EFFECT_RING = { color: rgba(HUE.effect, 1), width: 2, glow: rgba(HUE.effect, 0.35) } as const
/** The plume's own fill and edge, so it is never mistaken for a prompt effect. */
export const FALLOUT_FILL = rgba(HUE.fallout, 0.16)
export const FALLOUT_LINE = rgba(HUE.fallout, 0.5)
export const INFERRED_RING = rgba(HUE.cyan, 0.35)

/*
 * The stabilized cloud is not an effect on the ground; it is a volume
 * overhead, and what is drawn is its plan. It takes the fallout hue, because
 * it is where the fallout comes from, and it is drawn faint and dashed so that
 * it never reads as a ring anything happened inside.
 */
export const CLOUD_FILL = rgba(HUE.fallout, 0.07)
export const CLOUD_LINE = rgba(HUE.fallout, 0.55)
