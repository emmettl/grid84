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
export const MODELLED_FILL = rgba(HUE.effect, 0.08)
export const INFERRED_RING = rgba(HUE.cyan, 0.35)
