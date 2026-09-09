import { useMemo, useState } from 'react'
import { formatProvenance } from '../evidence/evidence.ts'
import { commandsAt, COMMAND_TOTALS, DEFCON, DEFCON_PROVENANCE, generationAt, GENERATION_POINTS, MEGATONS, POSTURE_1961, REACTION, RIGIDITY, SEQUENCE, SYSTEMS } from '../models/readiness.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'

const n = (v: number) => Math.round(v).toLocaleString('en-GB')

/** Chart geometry: hours 0 to 16 across, count 0 to 3,500 up. */
const W = 640
const H = 300
const PAD = { l: 52, r: 16, t: 18, b: 34 }
const X_MAX = 16
const Y_MAX = 3_500
const x = (h: number) => PAD.l + (h / X_MAX) * (W - PAD.l - PAD.r)
const y = (v: number) => H - PAD.b - (v / Y_MAX) * (H - PAD.t - PAD.b)

function GenerationChart({ hours, onHover }: { hours: number; onHover: (h: number | null) => void }) {
  const systemsPath = useMemo(() => {
    const pts: string[] = []
    for (let h = 0; h <= X_MAX; h += 0.25) pts.push(`${x(h).toFixed(1)},${y(generationAt(h).systems).toFixed(1)}`)
    return `M${pts.join(' L')}`
  }, [])
  const weaponsPath = useMemo(() => {
    const pts: string[] = []
    for (let h = 0; h <= X_MAX; h += 0.25) pts.push(`${x(h).toFixed(1)},${y(generationAt(h).weapons).toFixed(1)}`)
    return `M${pts.join(' L')}`
  }, [])
  const g = generationAt(hours)
  const move = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    const h = Math.max(0, Math.min(X_MAX, ((px - PAD.l) / (W - PAD.l - PAD.r)) * X_MAX))
    onHover(h)
  }
  return (
    <svg className="gen-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Delivery systems and weapons ready to launch against hours of preparation" onMouseMove={move} onMouseLeave={() => onHover(null)}>
      {[0, 1_000, 2_000, 3_000].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={PAD.l - 8} y={y(v) + 3} className="tick" textAnchor="end">
            {n(v)}
          </text>
        </g>
      ))}
      {[0, 2, 4, 6, 8, 10, 12, 14, 16].map((h) => (
        <text key={h} x={x(h)} y={H - PAD.b + 16} className="tick" textAnchor="middle">
          {h === 0 ? 'H' : `+${h}h`}
        </text>
      ))}
      <text x={W - PAD.r} y={H - 4} className="tick" textAnchor="end">
        hours of preparation after the alert hour
      </text>
      <path d={weaponsPath} className="series series--weapons" />
      <path d={systemsPath} className="series series--systems" />
      {GENERATION_POINTS.map((p) => (
        <g key={p.option}>
          <circle cx={x(p.hours)} cy={y(p.systems)} r={4.5} className="mark mark--systems" />
          <text x={p.hours >= 12 ? x(p.hours) - 8 : x(p.hours) + 8} y={y(p.systems) - 8} className="label" textAnchor={p.hours >= 12 ? 'end' : 'start'}>
            {n(p.systems)} · option {p.option}
          </text>
          {p.weapons !== undefined && (
            <>
              <circle cx={x(p.hours)} cy={y(p.weapons)} r={4.5} className="mark mark--weapons" />
              <text x={p.hours >= 12 ? x(p.hours) - 8 : x(p.hours) + 8} y={y(p.weapons) - 8} className="label" textAnchor={p.hours >= 12 ? 'end' : 'start'}>
                {n(p.weapons)} weapons
              </text>
            </>
          )}
        </g>
      ))}
      <line x1={x(hours)} x2={x(hours)} y1={PAD.t} y2={H - PAD.b} className="cursor" />
      <circle cx={x(hours)} cy={y(g.systems)} r={5} className="cursor-dot cursor-dot--systems" />
      <circle cx={x(hours)} cy={y(g.weapons)} r={5} className="cursor-dot cursor-dot--weapons" />
      <g className="legend-inline" transform={`translate(${PAD.l + 8}, ${PAD.t + 4})`}>
        <line x1={0} x2={18} y1={0} y2={0} className="series series--systems" />
        <text x={24} y={4} className="tick">
          delivery systems
        </text>
        <line x1={130} x2={148} y1={0} y2={0} className="series series--weapons" />
        <text x={154} y={4} className="tick">
          weapons
        </text>
      </g>
    </svg>
  )
}

export function ReadinessLab() {
  const [hours, setHours] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const at = hover ?? hours
  const g = generationAt(at)
  const commands = commandsAt(at)
  const defcon = at >= 14 ? 1 : at >= 6 ? 2 : at > 0 ? 3 : 3

  return (
    <div className="study readiness">
      <div className="readiness-ground" aria-hidden="true" />
      <div className="study-hud lab-hud readiness-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>LAB · READINESS CLOCK</strong>
          <span>The fourteen execution options as a force-generation curve</span>
        </header>

        <section className="clock" aria-label="Warning time">
          <h2>Preparation time</h2>
          <div className="clock-time">{at >= 14 ? '≥ 14 H' : `${at.toFixed(1)} H`}</div>
          <input type="range" min={0} max={16} step={0.25} value={hours} aria-label="Hours of preparation" onChange={(e) => setHours(Number(e.target.value))} />
          <dl className="grid-facts">
            <dt>Option</dt>
            <dd>
              {g.option} {g.option === 1 ? '· the Alert Option' : g.option === 14 ? '· the Strategic Warning Option' : ''}{' '}
              <span className={`badge badge--${g.option === 1 || g.option === 2 || g.option === 7 || g.option === 14 ? 'documented' : 'inferred'}`}>{g.option === 1 || g.option === 2 || g.option === 7 || g.option === 14 ? 'DOCUMENTED' : 'INFERRED'}</span>
            </dd>
            <dt>Delivery systems</dt>
            <dd>
              {n(g.systems)} <span className={`badge badge--${g.systemsEvidence}`}>{g.systemsEvidence.toUpperCase()}</span>
            </dd>
            <dt>Weapons</dt>
            <dd>
              {n(g.weapons)} <span className={`badge badge--${at === 0 || at >= 14 ? 'documented' : 'reconstructed'}`}>{at === 0 || at >= 14 ? 'DOCUMENTED' : 'RECONSTRUCTED'}</span>
            </dd>
            <dt>Megatons</dt>
            <dd>
              {n(g.megatons)} <span className={`badge badge--${at === 0 || at >= 14 ? 'documented' : 'reconstructed'}`}>{at === 0 || at >= 14 ? 'DOCUMENTED' : 'RECONSTRUCTED'}</span>
            </dd>
          </dl>
          <p className="log-empty">Option n at n−1 hours fits the two stated cases; the numbers of the other options are inferred from that pattern. Lines between the four documented points are straight, and reconstructed.</p>
        </section>

        <section className="log readiness-chart" aria-label="Force generation">
          <h2>Force generation</h2>
          <GenerationChart hours={hours} onHover={setHover} />
          <table className="bands">
            <thead>
              <tr>
                <th>Command · weapons</th>
                <th>Alert</th>
                <th>At {at >= 14 ? '14 h' : `${at.toFixed(1)} h`}</th>
                <th>Generated</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((c) => (
                <tr key={c.command}>
                  <td>{c.command}</td>
                  <td>{n(c.alert)}</td>
                  <td>{n(c.at)}</td>
                  <td>{n(c.generated)}</td>
                </tr>
              ))}
              <tr className="is-fire">
                <td>Total, 15 July 1961</td>
                <td>{n(COMMAND_TOTALS.alert)}</td>
                <td>{n(commands.reduce((s, c) => s + c.at, 0))}</td>
                <td>{n(COMMAND_TOTALS.generated)}</td>
              </tr>
            </tbody>
          </table>
          <p className="provenance-source">{formatProvenance(COMMAND_TOTALS.provenance)} · the table's alert force is 1,530 weapons; the briefing chart says 1,685. Both are kept.</p>
          <p className="provenance-source">By system, alert to generated: {SYSTEMS.map((s) => `${s.system} ${n(s.alert)} → ${n(s.generated)}`).join(' · ')}.</p>
        </section>

        <section className="provenance" aria-label="Readiness">
          <h2>
            Readiness <span className="badge badge--documented">DOCUMENTED</span>
          </h2>
          <dl>
            {REACTION.map((r) => (
              <div key={r.force} className="fact fact--documented" title={formatProvenance(r.provenance)}>
                <dt>{r.force}</dt>
                <dd>
                  {r.minutes} minutes · {r.note}
                </dd>
              </div>
            ))}
            <div className="fact fact--documented" title={formatProvenance(SEQUENCE.provenance)}>
              <dt>Launch sequence</dt>
              <dd>{SEQUENCE.steps.join(' → ')}</dd>
            </div>
            {POSTURE_1961.map((p) => (
              <div key={p.text} className="fact fact--documented" title={formatProvenance(p.provenance)}>
                <dt>Posture, late 1961</dt>
                <dd>{p.text}</dd>
              </div>
            ))}
            <div className="fact fact--documented" title={formatProvenance(MEGATONS.provenance)}>
              <dt>Megatonnage</dt>
              <dd>
                {n(MEGATONS.alert)} on alert · {n(MEGATONS.generated)} fully generated
              </dd>
            </div>
          </dl>
          <h2>DEFCON</h2>
          <ol className="defcon">
            {DEFCON.map((d) => (
              <li key={d.level} className={d.level === defcon ? 'is-active' : ''} title={d.readiness}>
                <strong>{d.level}</strong>
                <span>{d.term}</span>
                <em>{d.description}</em>
              </li>
            ))}
          </ol>
          <p className="provenance-source">{formatProvenance(DEFCON_PROVENANCE)}. The highlighted level is a reading of the slider against the readiness descriptions, not a documented mapping of options to conditions.</p>
        </section>

        <section className="omissions" aria-label="Rigidity">
          <h2>What the option does not change</h2>
          <ul>
            {RIGIDITY.map((r) => (
              <li key={r.text} title={formatProvenance(r.provenance)}>
                {r.text}
              </li>
            ))}
          </ul>
        </section>

        <EvidenceLegend />
      </div>
    </div>
  )
}
