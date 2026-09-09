import { TIER_LABEL, TIER_MEANING, TIER_ORDER } from '../evidence/evidence.ts'

export function EvidenceLegend() {
  return (
    <section className="legend" aria-label="Evidence tiers">
      <h2>Evidence</h2>
      <ul>
        {TIER_ORDER.map((tier) => (
          <li key={tier}>
            <span className={`swatch swatch--${tier}`} aria-hidden="true" />
            <strong>{TIER_LABEL[tier]}</strong>
            <span>{TIER_MEANING[tier]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
