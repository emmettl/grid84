import type { UnionTotals } from '../models/exposure.ts'
import { CANCER_PER_PERSON_SIEVERT, latentFatalCancers } from '../models/fallout.ts'
import { fmt, STAY_HOURS, type OutcomeSums, type Unions } from './readouts.ts'
import type { Study } from './study.ts'

/**
 * The headline cells for one side. With a union they are path-dependent: blast
 * first, then fire as Postol's bound, then fallout among the survivors, and
 * the last cell is all three in sequence. Before the union answers, the
 * per-target sums stand in.
 */
function OutcomeCells({ union, blastDead, blastInjured, fireDead, falloutDead, under1, plumes, falloutHours = 0, rising = false }: { union: UnionTotals | undefined; blastDead: number; blastInjured: number; fireDead: number; falloutDead: number | null; under1: number; plumes: number; falloutHours?: number; rising?: boolean }) {
  const showFallout = union ? union.underPlume > 0 : falloutDead !== null
  return (
    <div className="two-numbers">
      <div>
        <span>Blast only · 1961 method</span>
        <strong>{fmt(union ? union.blastDead : blastDead)}</strong>
        <em>dead · {fmt(union ? union.blastInjured : blastInjured)} injured</em>
      </div>
      <div>
        <span>With mass fire · Postol bound</span>
        <strong>{fmt(union ? union.fireDead : fireDead)}</strong>
        <em>dead</em>
      </div>
      {showFallout && (
        <div className={rising ? 'is-rising' : undefined}>
          <span>
            Fallout · no shelter{union ? ' · among the survivors' : ''}
            {falloutHours >= STAY_HOURS ? ' · if nobody leaves for a month' : falloutHours > 0 ? ` · to H+${falloutHours} h` : ''}
          </span>
          <strong>{fmt(union ? union.falloutDead : (falloutDead ?? 0))}</strong>
          <em>
            acute deaths · {fmt(union ? union.underPlume : under1)} under the plumes{union ? '' : ` · ${plumes} plumes summed`}
            {rising ? ' · still rising' : ''}
          </em>
        </div>
      )}
      {union && showFallout && union.personRads > 0 && (
        <div>
          <span>Latent fatal cancers, over decades</span>
          <strong>{fmt(latentFatalCancers(union.personRads))}</strong>
          <em>
            among the survivors · {fmt(union.personRads / 100)} person-sieverts at {Math.round(CANCER_PER_PERSON_SIEVERT * 1_000) / 10}% per sievert
          </em>
        </div>
      )}
      {union && showFallout && (
        <div>
          <span>Blast, fire and fallout in sequence</span>
          <strong>{fmt(union.combinedDead)}</strong>
          <em>dead · one minus the product of the survivals, per grid sample</em>
        </div>
      )}
    </div>
  )
}

interface OutcomePanelProps {
  study: Study
  effectCount: number
  aggregate: OutcomeSums
  defence: OutcomeSums
  unions: Unions
  gridName: string | null
  falloutHorizon: number
}

/** One detonation has an outcome as much as a hundred do. */
export function OutcomePanel({ study, effectCount, aggregate, defence, unions, gridName, falloutHorizon }: OutcomePanelProps) {
  if (effectCount === 0) return null
  return (
    <section className="aggregate" aria-label="Aggregate outcome">
      <h2>
        Outcome calculation <span className="badge badge--modelled">MODELLED</span>
      </h2>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={effectCount} aria-valuenow={aggregate.computed}>
        <div style={{ width: `${(100 * aggregate.computed) / effectCount}%` }} />
      </div>
      <p className="log-empty">
        {aggregate.computed} of {effectCount} detonations summed over {gridName ?? 'the population grid'}
        {unions.attacker ? ` · ${unions.attacker.detonations} in the union, each person counted once` : ''}
      </p>
      <OutcomeCells union={unions.attacker?.totals} blastDead={aggregate.blastDead} blastInjured={aggregate.blastInjured} fireDead={aggregate.fireDead} falloutDead={aggregate.falloutComputed > 0 ? aggregate.falloutDead : null} under1={aggregate.under1} plumes={aggregate.falloutComputed} falloutHours={aggregate.falloutHours} rising={aggregate.falloutHours > 0 && aggregate.falloutHours < falloutHorizon} />
      {unions.attacker && aggregate.computed > 1 && (
        <p className="log-empty">
          Summed per target instead, as the log lines are, with people under several detonations counted each time: {fmt(aggregate.blastDead)} dead by blast, {fmt(aggregate.fireDead)} with fire
        </p>
      )}
      {study.outcomeReference && (
        <p className="provenance-source">
          {study.outcomeReference.label}: {fmt(study.outcomeReference.value)} · {study.outcomeReference.source}
        </p>
      )}
      {study.sides && defence.total > 0 && (
        <>
          <h2>
            {study.sides.defender.name} <span className="badge badge--inferred">INFERRED</span>
          </h2>
          <p className="log-empty">
            {defence.computed} of {defence.total} detonations
            {unions.defender ? ` · ${unions.defender.detonations} in the union, each person counted once` : ''}
          </p>
          <OutcomeCells union={unions.defender?.totals} blastDead={defence.blastDead} blastInjured={defence.blastInjured} fireDead={defence.fireDead} falloutDead={defence.falloutComputed > 0 ? defence.falloutDead : null} under1={defence.under1} plumes={defence.falloutComputed} falloutHours={defence.falloutHours} rising={defence.falloutHours > 0 && defence.falloutHours < falloutHorizon} />
          {unions.defender && defence.computed > 1 && (
            <p className="log-empty">
              Summed per target instead: {fmt(defence.blastDead)} dead by blast, {fmt(defence.fireDead)} with fire
            </p>
          )}
          {study.sides.defender.reference && (
            <p className="provenance-source">
              {study.sides.defender.reference.label}: {fmt(study.sides.defender.reference.value)} · {study.sides.defender.reference.source}
            </p>
          )}
        </>
      )}
    </section>
  )
}
