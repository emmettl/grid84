/**
 * The evidence contract. Every entity in an execution study carries a tier
 * and a provenance record; the renderer derives its line grammar from the
 * tier and never draws anything without a citation attached.
 */
export type EvidenceTier = 'documented' | 'reconstructed' | 'inferred' | 'modelled' | 'withheld'

export interface Provenance {
  /** Short citation shown on the readout, e.g. "Sagan 1987, p. 29". */
  source: string
  /** Page, table or record reference within the source. */
  locator?: string
  url?: string
  /** What was done to the source to get this value: the method for reconstructed and modelled tiers. */
  method?: string
  /** For withheld: what is known to exist and under what authority it is withheld. */
  withheldUnder?: string
}

export interface Evidenced {
  evidence: EvidenceTier
  provenance: Provenance
}

export const TIER_LABEL: Record<EvidenceTier, string> = {
  documented: 'DOCUMENTED',
  reconstructed: 'RECONSTRUCTED',
  inferred: 'INFERRED',
  modelled: 'MODELLED',
  withheld: 'WITHHELD',
}

export const TIER_ORDER: EvidenceTier[] = ['documented', 'reconstructed', 'inferred', 'modelled', 'withheld']

/** One-line description of what each tier means, for the legend and the readout. */
export const TIER_MEANING: Record<EvidenceTier, string> = {
  documented: 'Stated in a released primary source, with page reference',
  reconstructed: 'Derived from documented facts by a stated method',
  inferred: 'Plausible from context, not evidenced for this plan',
  modelled: 'Output of a named model with stated inputs',
  withheld: 'A record exists and is redacted, or was never released',
}

export function formatProvenance(p: Provenance): string {
  const parts = [p.source]
  if (p.locator) parts.push(p.locator)
  return parts.join(' · ')
}
