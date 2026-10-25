import { formatStudyTime } from '../engine/clock.ts'
import { formatProvenance, TIER_LABEL, type Evidenced } from '../evidence/evidence.ts'
import type { Burst } from '../models/casualties.ts'
import { SURFACE_BLAST_MODEL } from '../models/blast.ts'
import type { Missile, Launch } from './missile.ts'
import { fmt, type Outcomes, type FalloutOutcomes } from './readouts.ts'
import type { Entity, Study } from './study.ts'

function Badge({ evidence }: { evidence: Evidenced['evidence'] }) {
  return <span className={`badge badge--${evidence}`}>{TIER_LABEL[evidence]}</span>
}

interface ProvenancePanelProps {
  study: Study
  selected: Entity | null
  missile: Missile | null
  launch: Launch | null
  burst: Burst
  outcomes: Outcomes
  falloutOutcomes: FalloutOutcomes
  onSelect: (id: string) => void
}

export function ProvenancePanel({ study, selected, missile, launch, burst, outcomes, falloutOutcomes, onSelect }: ProvenancePanelProps) {
  return (
    <details className="provenance provenance-disclosure" aria-label="Selected entity">
      <summary>Provenance{selected ? ` · ${selected.name}` : ''}</summary>
      {selected ? (
        <>
          <h2>
            {selected.name} <Badge evidence={selected.evidence} />
          </h2>
          <p className="provenance-designation">{selected.designation}</p>
          <p className="provenance-source">{formatProvenance(selected.provenance)}</p>
          {selected.provenance.method && <p className="provenance-method">{selected.provenance.method}</p>}
          {selected.provenance.withheldUnder && <p className="provenance-method">Withheld: {selected.provenance.withheldUnder}</p>}
          {selected.kind === 'track' && (
            <p className="provenance-source">
              Route <Badge evidence={selected.route.evidence} /> {formatProvenance(selected.route.provenance)}
              {selected.route.provenance.method && <> · {selected.route.provenance.method}</>}
            </p>
          )}
          {selected.kind === 'effect' && selected.deliveredBy && selected.deliveredBy.length > 0 && (
            <div className="delivered">
              <span className="clock-label">Delivered by</span>
              <ul>
                {selected.deliveredBy.map((id) => {
                  const t = study.entities.find((x) => x.id === id)
                  if (!t || t.kind !== 'track') return null
                  return (
                    <li key={id}>
                      <button type="button" onClick={() => onSelect(id)}>
                        {t.name} · {t.designation}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {missile && (
            <div className="delivered">
              <span className="clock-label">{missile.kind === 'aircraft' ? 'The whole load' : 'The whole missile'}</span>
              <p className="provenance-method">
                {missile.bus.name.split(' → ')[0]} · {missile.vehicles.length} {missile.kind === 'aircraft' ? 'cruise missiles · released at' : 'reentry vehicles · bus separation at'} {formatStudyTime(missile.separation.time)}{missile.kind === 'aircraft' ? '' : `, ${Math.round(missile.separation.altitude / 1000)} km up`}
                {(() => {
                  const known = missile.effects.filter((x) => outcomes[x.id])
                  if (known.length === 0) return null
                  const dead = known.reduce((a, x) => a + outcomes[x.id].fire.fatal, 0)
                  return ` · ${fmt(dead)} dead across ${known.length} of its ${missile.effects.length} detonations, each counted at its own target`
                })()}
              </p>
              <ul>
                {missile.vehicles.map((v, k) => {
                  const hit = missile.effects.find((x) => (x.deliveredBy ?? []).includes(v.id))
                  const own = v.id === selected.id || (selected.kind === 'effect' && (selected.deliveredBy ?? []).includes(v.id))
                  return (
                    <li key={v.id} className={own ? 'is-own' : ''}>
                      <button type="button" onClick={() => onSelect(hit ? hit.id : v.id)}>
                        {missile.kind === 'aircraft' ? 'Missile' : 'RV'} {k + 1} → {v.name.split(' → ')[1] ?? v.name}
                        {hit ? ` · ${formatStudyTime(hit.time)}${outcomes[hit.id] ? ` · ${fmt(outcomes[hit.id].fire.fatal)} dead` : ''}` : ' · no detonation recorded'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {launch && !missile && (
            <div className="delivered">
              <span className="clock-label">Launched from here</span>
              <p className="provenance-method">
                {launch.tracks.length} vehicle{launch.tracks.length > 1 ? 's' : ''}{launch.vehicles.length > 0 ? `, ${launch.vehicles.length} reentry vehicles` : ''} · {launch.effects.length} detonation{launch.effects.length === 1 ? '' : 's'}
                {(() => {
                  const known = launch.effects.filter((x) => outcomes[x.id])
                  if (known.length === 0) return null
                  return ` · ${fmt(known.reduce((a, x) => a + outcomes[x.id].fire.fatal, 0))} dead across ${known.length} of them, each counted at its own target`
                })()}
              </p>
              <ul>
                {launch.tracks.slice(0, 24).map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => onSelect(t.id)}>
                      {t.name.split(' → ').slice(1).join(' → ') || t.name} · {t.designation}
                    </button>
                  </li>
                ))}
                {launch.tracks.length > 24 && <li className="provenance-method">and {launch.tracks.length - 24} more</li>}
              </ul>
            </div>
          )}
          {selected.kind === 'effect' && burst === 'surface' && (
            <p className="provenance-method">Surface burst: overpressure radii by {SURFACE_BLAST_MODEL}. {selected.fallout?.provenance.method}</p>
          )}
          {selected.kind === 'effect' && falloutOutcomes[selected.id] && (
            <div className="two-numbers">
              <div>
                <span>Under the 1 rad/hr contour</span>
                <strong>{fmt(falloutOutcomes[selected.id].under1)}</strong>
                <em>people · {falloutOutcomes[selected.id].grid}</em>
              </div>
              <div>
                <span>Acute fallout deaths, no shelter · to H+{falloutOutcomes[selected.id].hours} h</span>
                <strong>{fmt(falloutOutcomes[selected.id].dead)}</strong>
                <em>to H+{selected.fallout?.untilHours} h · Table 12.108</em>
              </div>
            </div>
          )}
          {selected.kind === 'effect' && outcomes[selected.id] && (
            <div className="two-numbers">
              <div>
                <span>Blast only · 1961 method</span>
                <strong>{fmt(outcomes[selected.id].blast.fatal)}</strong>
                <em>dead · {fmt(outcomes[selected.id].blast.injured)} injured · {outcomes[selected.id].grid}</em>
              </div>
              <div>
                <span>With mass fire · Postol bound</span>
                <strong>{fmt(outcomes[selected.id].fire.fatal)}</strong>
                <em>dead · everyone inside the fire zone</em>
              </div>
            </div>
          )}
          <dl>
            {selected.facts.map((fact) => (
              <div key={fact.label} className={`fact fact--${fact.evidence}`} title={`${formatProvenance(fact.provenance)}${fact.provenance.method ? ` · ${fact.provenance.method}` : ''}${fact.provenance.withheldUnder ? ` · ${fact.provenance.withheldUnder}` : ''}`}>
                <dt>
                  {fact.label} <Badge evidence={fact.evidence} />
                </dt>
                <dd className={fact.evidence === 'withheld' ? 'is-withheld' : ''}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <>
          <h2>Provenance</h2>
          <p className="log-empty">Select a mark or a log line. Every mark on this page traces to a source.</p>
        </>
      )}
    </details>
  )
}
