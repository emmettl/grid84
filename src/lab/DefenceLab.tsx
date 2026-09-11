import { useMemo, useState } from 'react'
import { formatProvenance } from '../evidence/evidence.ts'
import { costExchange, DEFAULT_CASE, engage, interceptorsNeeded, REFERENCE_CASES, TEST_RECORDS, type Attack, type Costs, type Defence } from '../models/defence.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'
import { ControlSheet, ReadingSheet } from '../hud/sheets.tsx'

const n = (v: number) => Math.round(v).toLocaleString('en-GB')
const pct = (v: number) => `${Math.round(v * 100)}%`
const money = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)} bn` : `$${Math.round(v / 1e6)} M`)

const W = 640
const H = 300
const PAD = { l: 52, r: 16, t: 18, b: 34 }

/** Warheads through against interceptors held, for the case in hand; the vertical line is the stock the case has. */
function LeakageChart({ attack, defence, onHover }: { attack: Attack; defence: Defence; onHover: (m: number | null) => void }) {
  const needed = interceptorsNeeded(attack, defence)
  const xMax = Math.max(10, Math.ceil((Math.max(needed, defence.interceptors) * 1.25) / 10) * 10)
  const yMax = attack.warheads
  const x = (m: number) => PAD.l + (m / xMax) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b)
  const path = useMemo(() => {
    const pts: string[] = []
    for (let i = 0; i <= 120; i += 1) {
      const m = (i / 120) * xMax
      pts.push(`${x(m).toFixed(1)},${y(engage(attack, { ...defence, interceptors: m }).leaked).toFixed(1)}`)
    }
    return `M${pts.join(' L')}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attack, defence, xMax])
  const at = engage(attack, defence)
  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)
  const ticksX = [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax)
  const move = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    onHover(Math.max(0, Math.min(xMax, ((px - PAD.l) / (W - PAD.l - PAD.r)) * xMax)))
  }
  return (
    <svg className="gen-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Warheads through against interceptors held" onMouseMove={move} onMouseLeave={() => onHover(null)}>
      {ticksY.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={PAD.l - 8} y={y(v) + 3} className="tick" textAnchor="end">
            {n(v)}
          </text>
        </g>
      ))}
      {ticksX.map((m) => (
        <text key={m} x={x(m)} y={H - PAD.b + 16} className="tick" textAnchor="middle">
          {n(m)}
        </text>
      ))}
      <text x={W - PAD.r} y={H - 4} className="tick" textAnchor="end">
        interceptors held{defence.absentee > 1 ? ` (${defence.absentee} for each in position)` : ''}
      </text>
      <text x={PAD.l} y={PAD.t - 6} className="tick">
        warheads through
      </text>
      <line x1={x(needed)} x2={x(needed)} y1={PAD.t} y2={H - PAD.b} className="grid grid--needed" />
      <text x={x(needed) + 4} y={PAD.t + 10} className="label">
        {n(needed)} to engage every object
      </text>
      <path d={path} className="series series--weapons" />
      <circle cx={x(defence.interceptors)} cy={y(at.leaked)} r={5} className="mark mark--systems" />
      <text x={x(defence.interceptors) + (defence.interceptors > xMax * 0.7 ? -8 : 8)} y={y(at.leaked) - 8} className="label" textAnchor={defence.interceptors > xMax * 0.7 ? 'end' : 'start'}>
        {n(defence.interceptors)} held · {at.leaked.toFixed(at.leaked < 10 ? 1 : 0)} through
      </text>
    </svg>
  )
}

export function DefenceLab() {
  const [caseId, setCaseId] = useState(DEFAULT_CASE.id)
  const ref = REFERENCE_CASES.find((r) => r.id === caseId) ?? DEFAULT_CASE
  const [attack, setAttack] = useState<Attack>(ref.attack)
  const [defence, setDefence] = useState<Defence>(ref.defence)
  const [costs, setCosts] = useState<Costs>(ref.costs)
  const [hover, setHover] = useState<number | null>(null)
  const pick = (id: string) => {
    const r = REFERENCE_CASES.find((c) => c.id === id)
    if (!r) return
    setCaseId(id)
    setAttack(r.attack)
    setDefence(r.defence)
    setCosts(r.costs)
  }
  const shown = hover === null ? defence : { ...defence, interceptors: hover }
  const e = engage(attack, shown)
  const cost = costExchange(attack, shown, costs)
  const needed = interceptorsNeeded(attack, defence)
  const edited = attack !== ref.attack || defence !== ref.defence || costs !== ref.costs

  const num = (label: string, value: number, set: (v: number) => void, o: { min?: number; max?: number; step?: number } = {}) => (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={Number(value.toFixed(3))} min={o.min ?? 0} max={o.max} step={o.step ?? 1} onChange={(ev) => set(Number(ev.target.value))} />
    </label>
  )

  return (
    <div className="study readiness defence">
      <div className="readiness-ground" aria-hidden="true" />
      <div className="study-hud lab-hud readiness-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>LAB · SHOT EXCHANGE</strong>
          <span>Warheads, decoys and interceptors · the arithmetic every missile defence has faced since Sentinel</span>
        </header>

        <ControlSheet id="defence">
        <section className="clock" aria-label="Case">
          <h2>Case</h2>
          <div className="clock-controls clock-controls--variants" role="group" aria-label="Reference cases">
            {REFERENCE_CASES.map((r) => (
              <button key={r.id} type="button" className={r.id === caseId && !edited ? 'is-active' : ''} onClick={() => pick(r.id)} title={r.note}>
                {r.name}
              </button>
            ))}
          </div>
          <p className="log-empty">
            {ref.note} <span className={`badge badge--${ref.evidence}`}>{ref.evidence.toUpperCase()}</span>
            {edited ? ' · edited' : ''}
          </p>
          <div className="fields">
            {num('Warheads', attack.warheads, (v) => setAttack({ ...attack, warheads: v }), { min: 1 })}
            {num('Decoys per warhead', attack.decoysPerWarhead, (v) => setAttack({ ...attack, decoysPerWarhead: v }))}
            {num('Discriminated', attack.discriminated, (v) => setAttack({ ...attack, discriminated: v }), { max: 1, step: 0.05 })}
            {num('Interceptors', defence.interceptors, (v) => setDefence({ ...defence, interceptors: v }))}
            {num('Kill probability', defence.pKill, (v) => setDefence({ ...defence, pKill: v }), { max: 1, step: 0.01 })}
            {num('Shots per object', defence.salvo, (v) => setDefence({ ...defence, salvo: v }), { min: 1, max: 8 })}
            {num('Absentee ratio', defence.absentee, (v) => setDefence({ ...defence, absentee: v }), { min: 1 })}
            <label className="field field--check">
              <input type="checkbox" checked={defence.shootLookShoot} onChange={(ev) => setDefence({ ...defence, shootLookShoot: ev.target.checked })} />
              <span>Shoot, look, shoot</span>
            </label>
          </div>
        </section>
        </ControlSheet>

        <ReadingSheet id="defence">
        <section className="provenance recorded lab-records" aria-label="Test records">
          <h2>Where a kill probability comes from</h2>
          <p className="log-empty">
            A figure taken from a test record is already generous: the trajectory was known in advance, the target was not trying to survive, and the day was chosen. Before that generosity is reached there is the question of what was counted. Each pair below is the same set of tests under two defensible conventions.
          </p>
          <table className="bands">
            <tbody>
              {TEST_RECORDS.map((r) => (
                <tr key={r.id}>
                  <td>{r.system}</td>
                  <td>
                    {r.id === 'patriot-gulf' ? 'no demonstrable kill' : `${r.hits} of ${r.attempts}`}
                    {r.alternates.map((a) => (
                      <span key={a.by} className="lab-alt"> · {a.hits} of {a.attempts} ({a.by})</span>
                    ))}
                  </td>
                  <td className="lab-system-source">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="log-empty lab-system-source">
            The Patriot row is the accounting office's finding that the data needed to demonstrate a kill was never recorded, not a claim that nothing was hit: telemetry transmitters were left off for the weight, and the system recorded a kill whenever the missile reached the computed point of closest approach and stopped talking.
          </p>
        </section>

        <section className="log readiness-chart" aria-label="Leakage">
          <h2>Warheads through</h2>
          <LeakageChart attack={attack} defence={defence} onHover={setHover} />
          <table className="bands">
            <tbody>
              <tr>
                <td>Credible objects</td>
                <td>{n(e.credibleObjects)}</td>
                <td>Shots the doctrine wants</td>
                <td>{n(e.shotsWanted)}</td>
              </tr>
              <tr>
                <td>Interceptors in position</td>
                <td>{n(e.available)}</td>
                <td>Objects fully engaged</td>
                <td>{pct(e.engagedFraction)}</td>
              </tr>
              <tr>
                <td>Kill of an engaged warhead</td>
                <td>{pct(e.pKillEngaged)}</td>
                <td>Needed for every object</td>
                <td>{n(needed)}</td>
              </tr>
              <tr className="is-fire">
                <td>Warheads through</td>
                <td>
                  {e.leaked.toFixed(e.leaked < 10 ? 2 : 0)} of {n(attack.warheads)}
                </td>
                <td>Leakage</td>
                <td>{pct(e.leakageFraction)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="provenance" aria-label="Cost exchange">
          <h2>
            Cost exchange <span className="badge badge--modelled">MODELLED</span>
          </h2>
          <dl className="grid-facts">
            <dt>Interceptor</dt>
            <dd>{num('', costs.interceptor / 1e6, (v) => setCosts({ ...costs, interceptor: v * 1e6 }))} $M</dd>
            <dt>Warhead added</dt>
            <dd>{num('', costs.warhead / 1e6, (v) => setCosts({ ...costs, warhead: v * 1e6 }))} $M</dd>
            <dt>Decoy added</dt>
            <dd>{num('', costs.decoy / 1e6, (v) => setCosts({ ...costs, decoy: v * 1e6 }), { step: 0.1 })} $M</dd>
            <dt>Defender pays per warhead added</dt>
            <dd>{money(cost.perWarhead)}</dd>
            <dt>Per decoy added</dt>
            <dd>{cost.perDecoy > 0 ? money(cost.perDecoy) : 'nothing, all discriminated'}</dd>
            <dt>Ratio, attacker's cheaper move</dt>
            <dd>
              {cost.ratio.toFixed(cost.ratio < 10 ? 1 : 0)} to 1 · the {cost.cheaperMove}
            </dd>
          </dl>
          <p className="log-empty">Nitze's criterion (1985): a defence must be cheaper at the margin than the offence it faces, or the offence buys it out. Every case here fails it.</p>
          <details className="sources">
            <summary>Sources and methods</summary>
            <p className="provenance-source">{formatProvenance(ref.provenance)}</p>
            <p className="provenance-method">
              The engagement: credible objects are warheads plus the decoys not discriminated; each receives the doctrine's shots while interceptors in position last; an engaged warhead dies with probability 1 − (1 − p)<sup>k</sup>; shoot-look-shoot spends the next shot only after a miss. The cost exchange is the doctrine's shots, times the absentee ratio, times the interceptor's cost, against what the attacker paid for the object. No intercept physics is modelled; the kill probability is an input and the test record supplies it where one exists.
            </p>
            <p className="provenance-method">
              Read further: Congressional Budget Office, <em>Costs of Expanding the Space-Based Interceptor Layer</em> (2025) · National Academies, <em>Making Sense of Ballistic Missile Defense</em> (2012) · Union of Concerned Scientists, <em>Countermeasures</em> (2000) · American Physical Society, <em>Science and Technology of Directed Energy Weapons</em> (1987) · Office of Technology Assessment, <em>Ballistic Missile Defense Technologies</em> (1985) · the validation notes in this repository.
            </p>
          </details>
        </section>
        </ReadingSheet>

        <EvidenceLegend />
      </div>
    </div>
  )
}
