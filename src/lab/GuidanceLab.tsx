import { useMemo, useState } from 'react'
import { formatProvenance } from '../evidence/evidence.ts'
import { budget, PRESETS, type ErrorTerms } from '../models/guidance.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'

const m = (v: number) => (v >= 1_000 ? `${(v / 1_000).toFixed(2)} km` : `${Math.round(v)} m`)
const pct = (v: number) => `${Math.round(v * 100)}%`

const W = 640
const H = 260
const PAD = { l: 52, r: 16, t: 18, b: 34 }
const HOURS = 48

/** CEP against hours since the last fix, with and without the star sight. */
function DriftChart({ terms, at }: { terms: ErrorTerms; at: number }) {
  const series = useMemo(() => {
    const plain: number[] = []
    const sighted: number[] = []
    for (let h = 0; h <= HOURS; h += 1) {
      plain.push(budget({ ...terms, hoursSinceFix: h, starSight: false }).cep)
      sighted.push(budget({ ...terms, hoursSinceFix: h, starSight: true, starSightRemoves: terms.starSight ? terms.starSightRemoves : 0.85 }).cep)
    }
    return { plain, sighted }
  }, [terms])
  const yMax = Math.max(...series.plain) * 1.15
  const x = (h: number) => PAD.l + (h / HOURS) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b)
  const path = (v: number[]) => `M${v.map((c, h) => `${x(h).toFixed(1)},${y(c).toFixed(1)}`).join(' L')}`
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)
  const now = budget({ ...terms, hoursSinceFix: at })
  return (
    <svg className="gen-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="CEP against hours since the last navigation fix">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={PAD.l - 8} y={y(t) + 3} className="tick" textAnchor="end">
            {m(t)}
          </text>
        </g>
      ))}
      {[0, 12, 24, 36, 48].map((h) => (
        <text key={h} x={x(h)} y={H - PAD.b + 16} className="tick" textAnchor="middle">
          {h} h
        </text>
      ))}
      <text x={W - PAD.r} y={H - 4} className="tick" textAnchor="end">
        hours since the last fix · CEP
      </text>
      <path d={path(series.plain)} className="series series--weapons" />
      <path d={path(series.sighted)} className="series series--systems" />
      <text x={x(HOURS) - 4} y={y(series.plain[HOURS]) - 6} className="label" textAnchor="end">
        inertial only
      </text>
      <text x={x(HOURS) - 4} y={y(series.sighted[HOURS]) + 14} className="label" textAnchor="end">
        with a star sight
      </text>
      <line x1={x(at)} x2={x(at)} y1={PAD.t} y2={H - PAD.b} className="grid grid--needed" />
      <circle cx={x(at)} cy={y(now.cep)} r={5} className={`mark ${terms.starSight ? 'mark--systems' : 'mark--weapons'}`} />
    </svg>
  )
}

export function GuidanceLab() {
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
  const [edit, setEdit] = useState<ErrorTerms | null>(null)
  const terms = edit ?? preset.terms
  const b = budget(terms)
  const pick = (id: string) => {
    setPresetId(id)
    setEdit(null)
  }
  const set = (patch: Partial<ErrorTerms>) => setEdit({ ...terms, ...patch })
  const num = (label: string, key: keyof ErrorTerms, step = 1) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <input type="number" step={step} min={0} value={Number((terms[key] as number).toFixed(4))} onChange={(ev) => set({ [key]: Number(ev.target.value) } as Partial<ErrorTerms>)} />
    </label>
  )
  const biggest = [...b.lines].sort((p, q) => q.share - p.share)[0]

  return (
    <div className="study readiness defence guidance">
      <div className="readiness-ground" aria-hidden="true" />
      <div className="study-hud lab-hud readiness-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>LAB · GUIDANCE ERROR BUDGET</strong>
          <span>Where a CEP comes from · the submarine missile and the problem of cumulative error</span>
        </header>

        <section className="clock" aria-label="System">
          <h2>System</h2>
          <div className="clock-controls clock-controls--variants" role="group" aria-label="Systems">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={p.id === presetId && !edit ? 'is-active' : ''} onClick={() => pick(p.id)} title={p.note}>
                {p.name} · {p.year}
              </button>
            ))}
          </div>
          <p className="log-empty">
            {preset.note}. Published CEP {m(preset.publishedCepMetres)} <span className={`badge badge--${preset.evidence}`}>{preset.evidence.toUpperCase()}</span>
            {edit ? ' · edited' : ''}
          </p>
          <div className="fields">
            {num('Hours since the last fix', 'hoursSinceFix', 0.5)}
            {num('Position at the fix, m', 'positionAtFix', 10)}
            {num('Position drift, m per hour', 'positionDriftPerHour', 5)}
            {num('Velocity error, m/s', 'velocity', 0.01)}
            {num('Alignment, mrad', 'alignment', 0.01)}
            {num('Accelerometer bias, µg', 'accelerometerBias', 1)}
            {num('Gyro drift, °/h', 'gyroDrift', 0.001)}
            {num('Gravity error, m/s', 'gravity', 0.01)}
            {num('Reentry, m', 'reentry', 10)}
            {num('Range, km', 'rangeKm', 100)}
            {num('Boost, s', 'boostSeconds', 5)}
            {num('Flight, s', 'flightSeconds', 10)}
            <label className="field field--check">
              <input type="checkbox" checked={terms.starSight} onChange={(ev) => set({ starSight: ev.target.checked, starSightRemoves: terms.starSightRemoves || 0.85 })} />
              <span>Star sight after boost</span>
            </label>
            {num('Star sight removes', 'starSightRemoves', 0.05)}
          </div>
        </section>

        <section className="log readiness-chart" aria-label="Cumulative error">
          <h2>The clock on the boat</h2>
          <DriftChart terms={terms} at={terms.hoursSinceFix} />
          <table className="bands">
            <thead>
              <tr>
                <th>Error term</th>
                <th>At the target, 1σ</th>
                <th>Share of the miss</th>
              </tr>
            </thead>
            <tbody>
              {b.lines.map((l) => (
                <tr key={l.key} className={l.key === biggest.key ? 'is-fire' : ''}>
                  <td>{l.label}</td>
                  <td>{m(l.sigma)}</td>
                  <td>
                    <span className="guidance-bar" style={{ width: `${Math.round(l.share * 100)}%` }} /> {pct(l.share)}
                  </td>
                </tr>
              ))}
              <tr className="is-fire">
                <td>Root sum of squares · CEP</td>
                <td>{m(b.sigma)}</td>
                <td>
                  CEP {m(b.cep)} · published {m(preset.publishedCepMetres)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="provenance" aria-label="Reading">
          <h2>
            What the sum says <span className="badge badge--modelled">MODELLED</span>
          </h2>
          <p className="log-empty">
            Every term is small and none can be removed, so the miss is the square root of the sum of their squares, and cutting the largest term is the only thing that helps. In 1960 the largest was the boat: where it was, which way it pointed, how fast it moved, as its inertial navigator had reckoned them since the last fix, and the reckoning drifted with every hour submerged. Better navigators and the Transit satellites cut that term through the sixties; the star sight of Trident took the boat out of the sum after boost; and once the boat was gone the gravity the missile flew through, mapped from orbit, was the last term to fall. That is why the sea-based deterrent reached the silo-killing accuracy of the land-based only in 1990, and why for thirty years it was a weapon for cities.
          </p>
          <details className="sources">
            <summary>Sources and methods</summary>
            <p className="provenance-source">{formatProvenance(preset.provenance)}</p>
            <p className="provenance-method">
              The structure is MacKenzie's; the magnitudes are illustrations chosen so that each system's total reproduces its published CEP, and the split among the terms is not a documented budget. The archive copy of the book is lending-only and its pages could not be read for this build; the terms should be corrected from the text. The sum: each term as a per-axis standard deviation at the target, position and alignment scaled by range and reduced by the star sight, velocity and gravity errors run for the flight, a bias and a drift integrated through boost, all added in quadrature; CEP = 1.1774 σ for a circular normal miss.
            </p>
            <p className="provenance-method">
              Read further: Donald MacKenzie, <em>Inventing Accuracy</em> (1990), on the fleet ballistic missile, the gravity problem and the Trident star sight · the accuracy lab in this instrument for what the CEP buys · the validation notes.
            </p>
          </details>
        </section>

        <EvidenceLegend />
      </div>
    </div>
  )
}
