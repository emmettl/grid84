import { useMemo, useState } from 'react'
import { formatProvenance } from '../evidence/evidence.ts'
import { COUNTERFORCE_PSI, killProbability, lethalRadiusMetres, singleShotKill, SYSTEMS, TARGETS, type WeaponSystem } from '../models/lethality.ts'
import { BLAST_MODEL, SURFACE_BLAST_MODEL } from '../models/blast.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'

const pct = (v: number) => `${Math.round(v * 100)}%`
const km = (m: number) => (m >= 1_000 ? `${(m / 1_000).toFixed(m >= 10_000 ? 0 : 1)} km` : `${Math.round(m)} m`)
const kt = (v: number) => (v >= 1_000 ? `${v / 1_000} Mt` : `${v} kt`)

const W = 640
const H = 300
const PAD = { l: 46, r: 16, t: 18, b: 34 }
const Y0 = 1957
const Y1 = 1993
const x = (year: number) => PAD.l + ((year - Y0) / (Y1 - Y0)) * (W - PAD.l - PAD.r)
const y = (p: number) => H - PAD.b - p * (H - PAD.t - PAD.b)

/** Single-shot kill against the benchmark silo by year of service, one mark per system. */
export function CrossingChart({ psi, selected, onPick }: { psi: number; selected: string; onPick: (id: string) => void }) {
  return (
    <svg className="gen-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Single-shot kill probability against a ${psi} psi target by year of service`}>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <g key={p}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(p)} y2={y(p)} className={p === 0.5 ? 'grid grid--needed' : 'grid'} />
          <text x={PAD.l - 8} y={y(p) + 3} className="tick" textAnchor="end">
            {pct(p)}
          </text>
        </g>
      ))}
      {[1960, 1965, 1970, 1975, 1980, 1985, 1990].map((yr) => (
        <text key={yr} x={x(yr)} y={H - PAD.b + 16} className="tick" textAnchor="middle">
          {yr}
        </text>
      ))}
      <text x={W - PAD.r} y={H - 4} className="tick" textAnchor="end">
        year of service · single-shot kill against {psi.toLocaleString('en-GB')} psi
      </text>
      <text x={x(Y0) + 4} y={y(0.5) - 5} className="label">
        even chance
      </text>
      {SYSTEMS.map((s) => {
        const p = singleShotKill(s.yieldKt, s.cepMetres, psi)
        const active = s.id === selected
        return (
          <g key={s.id} className={`sys sys--${s.side}${active ? ' is-active' : ''}`} onClick={() => onPick(s.id)} style={{ cursor: 'pointer' }}>
            <circle cx={x(s.year)} cy={y(p)} r={active ? 6 : 4.5} className={`mark ${s.side === 'us' ? 'mark--systems' : 'mark--weapons'}`} />
            {(active || p >= 0.5 || s.year <= 1960) && (
              <text x={x(s.year) + (s.year > 1985 ? -8 : 8)} y={y(p) - 8} className="label" textAnchor={s.year > 1985 ? 'end' : 'start'}>
                {s.name.split(' · ')[0]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function AccuracyLab() {
  const [systemId, setSystemId] = useState('atlas-d')
  const base = SYSTEMS.find((s) => s.id === systemId) ?? SYSTEMS[0]
  const [edit, setEdit] = useState<{ yieldKt: number; cepMetres: number } | null>(null)
  const [psi, setPsi] = useState(COUNTERFORCE_PSI)
  const [shots, setShots] = useState(1)
  const [reliability, setReliability] = useState(0.8)
  const sys: WeaponSystem = edit ? { ...base, ...edit } : base
  const pick = (id: string) => {
    setSystemId(id)
    setEdit(null)
  }
  const rows = useMemo(() => SYSTEMS.map((s) => ({ s, cells: TARGETS.map((t) => singleShotKill(s.yieldKt, s.cepMetres, t.psi)) })), [])
  const lr = lethalRadiusMetres(sys.yieldKt, psi)
  const p1 = singleShotKill(sys.yieldKt, sys.cepMetres, psi)
  const pk = killProbability(sys.yieldKt, sys.cepMetres, psi, shots, reliability)
  const target = TARGETS.find((t) => t.psi === psi)

  return (
    <div className="study readiness defence accuracy">
      <div className="readiness-ground" aria-hidden="true" />
      <div className="study-hud lab-hud readiness-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>LAB · YIELD AND ACCURACY</strong>
          <span>Counterforce as a technical choice · what a warhead of a given yield and CEP can destroy</span>
        </header>

        <section className="clock" aria-label="Weapon and target">
          <h2>Weapon</h2>
          <div className="clock-controls clock-controls--variants" role="group" aria-label="Systems">
            {SYSTEMS.map((s) => (
              <button key={s.id} type="button" className={s.id === systemId ? 'is-active' : ''} onClick={() => pick(s.id)} title={`${s.year} · ${kt(s.yieldKt)} × ${s.warheads} · CEP ${km(s.cepMetres)} · ${s.guidance}`}>
                {s.name.split(' · ')[0]}
              </button>
            ))}
          </div>
          <p className="log-empty">
            {base.year} · {base.guidance} · {kt(base.yieldKt)} × {base.warheads} · CEP {km(base.cepMetres)} <span className={`badge badge--${base.evidence}`}>{base.evidence.toUpperCase()}</span>
            {edit ? ' · edited' : ''}
          </p>
          <div className="fields">
            <label className="field">
              <span>Yield, kt</span>
              <input type="number" min={1} value={sys.yieldKt} onChange={(ev) => setEdit({ yieldKt: Number(ev.target.value), cepMetres: sys.cepMetres })} />
            </label>
            <label className="field">
              <span>CEP, metres</span>
              <input type="number" min={1} value={sys.cepMetres} onChange={(ev) => setEdit({ yieldKt: sys.yieldKt, cepMetres: Number(ev.target.value) })} />
            </label>
            <label className="field">
              <span>Target hardness, psi</span>
              <input type="number" min={1} value={psi} onChange={(ev) => setPsi(Math.max(1, Number(ev.target.value)))} />
            </label>
            <label className="field">
              <span>Shots</span>
              <input type="number" min={1} max={4} value={shots} onChange={(ev) => setShots(Math.max(1, Number(ev.target.value)))} />
            </label>
            <label className="field">
              <span>Reliability</span>
              <input type="number" min={0} max={1} step={0.05} value={reliability} onChange={(ev) => setReliability(Number(ev.target.value))} />
            </label>
          </div>
          <div className="clock-controls" role="group" aria-label="Targets">
            {TARGETS.map((t) => (
              <button key={t.id} type="button" className={t.psi === psi ? 'is-active' : ''} onClick={() => setPsi(t.psi)} title={t.note}>
                {t.name} · {t.psi.toLocaleString('en-GB')}
              </button>
            ))}
          </div>
        </section>

        <section className="log readiness-chart" aria-label="Crossing">
          <h2>The counterforce crossing</h2>
          <CrossingChart psi={psi} selected={systemId} onPick={pick} />
          <table className="bands">
            <tbody>
              <tr>
                <td>Lethal radius at {psi.toLocaleString('en-GB')} psi</td>
                <td>{km(lr)}</td>
                <td>CEP</td>
                <td>{km(sys.cepMetres)}</td>
              </tr>
              <tr>
                <td>Radius over CEP</td>
                <td>{(lr / sys.cepMetres).toFixed(2)}</td>
                <td>Single-shot kill</td>
                <td>{pct(p1)}</td>
              </tr>
              <tr className="is-fire">
                <td>
                  {shots} shot{shots > 1 ? 's' : ''} at {pct(reliability)} reliability
                </td>
                <td>{pct(pk)}</td>
                <td>{target ? target.name : 'Target'}</td>
                <td>{target ? target.note.split(';')[0] : `${psi} psi`}</td>
              </tr>
            </tbody>
          </table>
          <table className="bands matrix" aria-label="Single-shot kill by system and target">
            <thead>
              <tr>
                <th>System · year</th>
                {TARGETS.map((t) => (
                  <th key={t.id} title={t.note}>
                    {t.psi.toLocaleString('en-GB')} psi
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, cells }) => (
                <tr key={s.id} className={s.id === systemId ? 'is-fire' : ''} onClick={() => pick(s.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    {s.name.split(' · ')[0]} · {s.year}
                  </td>
                  {cells.map((c, i) => (
                    <td key={TARGETS[i].id} className="cell" style={{ background: `rgba(${s.side === 'us' ? '141, 250, 255' : '255, 96, 96'}, ${(0.08 + 0.55 * c).toFixed(2)})` }}>
                      {pct(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="provenance" aria-label="Reading">
          <h2>
            What the crossing means <span className="badge badge--modelled">MODELLED</span>
          </h2>
          <p className="log-empty">
            A city fails at 5 psi and a hardened silo at 2,000. For a megaton the first radius is about 7 km and the second about 400 m. With a CEP of miles the city is a target and the silo is not: counterforce was not available to the planners of 1961 whatever they wanted, and assured destruction was what the weapons could do. The systems that cross the even-chance line do it by accuracy, not yield: Minuteman III's refit, Peacekeeper and Trident II carry a third of the yield of the weapons of 1962 at a thirtieth of the miss distance. The MIRV bus made the accurate warhead cheap enough to spend on silos. That is the shift from the large unitary warhead to the accurate MIRV, and it is what the present doctrine rests on.
          </p>
          <details className="sources">
            <summary>Sources and methods</summary>
            <p className="provenance-source">Weapon: {formatProvenance(base.provenance)}</p>
            {target && <p className="provenance-source">Target: {formatProvenance(target.provenance)}</p>}
            <p className="provenance-method">
              Single-shot kill is the probability the warhead lands inside the radius at which the target's overpressure is reached, with the miss distance circular normal and median CEP: 1 − 0.5<sup>(r/CEP)²</sup>. Radii for 5 psi and below are the optimum-height air burst ({BLAST_MODEL}); above, the contact surface burst ({SURFACE_BLAST_MODEL}). Shots compound as independent trials at the stated reliability. The overpressure rule overstates what a near miss does to a target hardened past a few thousand psi, where only the crater counts.
            </p>
            <p className="provenance-method">
              Read further: Kosta Tsipis, <em>Arsenal: Understanding Weapons in the Nuclear Age</em> (1983), ch. 6 · Matthew Bunn and Kosta Tsipis, "The Uncertainties of a Preemptive Nuclear Attack," <em>Scientific American</em> (November 1983) · Donald MacKenzie, <em>Inventing Accuracy</em> (1990) · Cochran, Arkin and Hoenig, <em>Nuclear Weapons Databook</em> vol. 1 (1984) · the validation notes in this repository. CEPs are the open literature's estimates; official figures are classified.
            </p>
          </details>
        </section>

        <EvidenceLegend />
      </div>
    </div>
  )
}
