import { Track } from '../engine/track.ts'
import { TIER_MEANING, TIER_ORDER } from '../evidence/evidence.ts'
import type { LngLat } from '../geo/geodesy.ts'
import { BLAST_MODEL, promptEffects } from '../models/blast.ts'
import type { Entity, Study } from '../studies/study.ts'

/**
 * The evidence-grammar lab: a synthetic study whose only purpose is to show
 * every tier as line, point and ring on the real globe, with the readout
 * typography beside it. Every entity says it is a specimen.
 */
const SPECIMEN = { source: 'SPECIMEN', method: 'Synthetic geometry for the lab; not a fact about any place' }

const base: LngLat = [-170, 62]
const entities: Entity[] = []

TIER_ORDER.forEach((tier, i) => {
  const lat = base[1] + 4.5 - i * 1.6
  const from: LngLat = [base[0] + 2, lat]
  const to: LngLat = [base[0] + 14, lat]
  entities.push({
    kind: 'track',
    id: `line-${tier}`,
    name: tier.toUpperCase(),
    designation: TIER_MEANING[tier].toUpperCase(),
    track: new Track([
      { position: from, time: -3_600 },
      { position: to, time: 3_600 },
    ]),
    reveal: 'full',
    labelAnchor: 'bottom-left',
    evidence: tier,
    provenance: SPECIMEN,
    route: { evidence: tier, provenance: SPECIMEN },
    facts: [{ label: 'Line', value: 'Great-circle leg drawn in this tier', evidence: tier, provenance: SPECIMEN }],
  })
  entities.push({
    kind: 'site',
    id: `site-${tier}`,
    name: `${tier.toUpperCase()} MARK`,
    designation: 'POINT SPECIMEN',
    position: [base[0] + 19, lat],
    uncertaintyMetres: tier === 'inferred' ? 60_000 : tier === 'withheld' ? 40_000 : undefined,
    evidence: tier,
    provenance: SPECIMEN,
    facts: [{ label: 'Point', value: 'Marker drawn in this tier', evidence: tier, provenance: SPECIMEN }],
  })
})

entities.push({
  kind: 'effect',
  id: 'effect-specimen',
  name: 'MODELLED RINGS',
  designation: 'EFFECT SPECIMEN · 1.44 MT',
  center: [base[0] + 10, base[1] - 5],
  time: 1_062,
  effects: promptEffects(1_440),
  evidence: 'modelled',
  provenance: { source: BLAST_MODEL },
  facts: [{ label: 'Appears', value: 'At H+00:17:42, to show an effect arriving on the clock', evidence: 'modelled', provenance: SPECIMEN }],
})

export const EVIDENCE_LAB: Study = {
  id: 'lab-evidence',
  title: 'LAB · EVIDENCE GRAMMAR',
  subtitle: 'Five tiers as line, point and ring · synthetic specimens on real ground',
  bounds: { start: -3_600, end: 3_600 },
  view: { center: [base[0] + 10, base[1] - 1], zoom: 3.2 },
  omissions: ['Everything on this page is a specimen; the geometry is invented and the ground is real'],
  events: [
    { time: -3_600, text: 'SPECIMEN LOG · LINES BEGIN MOVING' },
    { time: 0, text: 'H-HOUR · A DOCUMENTED EVENT READS LIKE THIS' },
    { time: 900, text: 'A RECONSTRUCTED EVENT NAMES ITS METHOD (RECONSTRUCTED)' },
    { time: 1_062, text: 'A MODELLED EVENT NAMES ITS MODEL (MODELLED)', entityId: 'effect-specimen' },
    { time: 1_800, text: 'A WITHHELD RECORD IS LOGGED AS PRESENT: WITHHELD' },
  ],
  entities,
}
