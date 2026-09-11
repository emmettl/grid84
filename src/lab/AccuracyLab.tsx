import { useMemo, useState } from 'react'
import { formatProvenance } from '../evidence/evidence.ts'
import { COUNTERFORCE_PSI, impactPattern, killProbability, lethalRadiusMetres, singleShotKill, SYSTEMS, TARGETS, type WeaponSystem } from '../models/lethality.ts'
import { BLAST_MODEL, SURFACE_BLAST_MODEL } from '../models/blast.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'
import { placeLabels, type LabelWish } from '../chart/labels.ts'
import { ControlSheet, ReadingSheet } from '../hud/sheets.tsx'

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
  const wishes: LabelWish[] = SYSTEMS.filter((s) => s.id === selected || singleShotKill(s.yieldKt, s.cepMetres, psi) >= 0.5 || s.year <= 1960).map((s) => {
    const p = singleShotKill(s.yieldKt, s.cepMetres, psi)
    const right = s.year > 1985
    return { id: s.id, x: x(s.year) + (right ? -8 : 8), y: y(p) - 8, text: s.name.split(' · ')[0], anchor: right ? 'end' : 'start', markX: x(s.year), markY: y(p) }
  })
  const labels = new Map(placeLabels(wishes, { top: PAD.t, bottom: H - PAD.b }).map((l) => [l.id, l]))
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
            {labels.has(s.id) && (
              <>
                {labels.get(s.id)!.leader && <line x1={x(s.year)} y1={y(p)} x2={labels.get(s.id)!.x} y2={labels.get(s.id)!.py - 3} className="leader" />}
                <text x={labels.get(s.id)!.x} y={labels.get(s.id)!.py} className="label" textAnchor={labels.get(s.id)!.anchor}>
                  {labels.get(s.id)!.text}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * A salvo, landed.
 *
 * The table says a hundred-metre CEP against a two-thousand-psi silo gives
 * eighty-odd per cent. This draws it: the silo at its real size, the radius
 * inside which the overpressure destroys it, the circle half the warheads
 * fall inside, and twenty warheads where they actually land. It is the same
 * arithmetic, and it is the reason the argument of the 1970s was about
 * metres.
 *
 * The scale is the point. Against a city the lethal radius is kilometres
 * across and the aim point may as well be anywhere; against a silo lid four
 * metres wide it is the accuracy and nothing else.
 */
function SalvoPlan({ yieldKt, cepMetres, psi, extentMetres, shots, seed }: { yieldKt: number; cepMetres: number; psi: number; extentMetres: number; shots: number; seed: number }) {
  const lethal = lethalRadiusMetres(yieldKt, psi)
  const impacts = useMemo(() => impactPattern(cepMetres, shots, seed), [cepMetres, shots, seed])
  const span = Math.max(lethal, cepMetres * 1.6, extentMetres / 2) * 2.4
  const S = 420
  const scale = S / span
  const px = (metres: number) => metres * scale
  const cx = S / 2
  const killed = impacts.filter((i) => i.radius <= lethal).length
  // A round number of metres for the bar, about a fifth of the view.
  const barMetres = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000].reduce((best, m) => (Math.abs(px(m) - S / 5) < Math.abs(px(best) - S / 5) ? m : best), 1)
  return (
    <div className="salvo">
      <svg className="gen-chart salvo-plan" viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`${shots} warheads aimed at a ${psi} psi target, drawn to scale`}>
        <rect x={0} y={0} width={S} height={S} className="salvo-ground" />
        {/* The radius inside which the target is destroyed. */}
        <circle cx={cx} cy={cx} r={px(lethal)} className="salvo-lethal" />
        {/* The circle half of them land inside. */}
        <circle cx={cx} cy={cx} r={px(cepMetres)} className="salvo-cep" />
        {/* The thing itself, at its own size. */}
        {px(extentMetres / 2) >= 1.5 ? (
          <rect x={cx - px(extentMetres / 2)} y={cx - px(extentMetres / 2)} width={px(extentMetres)} height={px(extentMetres)} className="salvo-target" />
        ) : (
          <circle cx={cx} cy={cx} r={2} className="salvo-target" />
        )}
        {impacts.map((i, n) => (
          <g key={n} className={i.radius <= lethal ? 'salvo-hit' : 'salvo-miss'}>
            <line x1={cx + px(i.x) - 4} x2={cx + px(i.x) + 4} y1={cx + px(i.y)} y2={cx + px(i.y)} />
            <line x1={cx + px(i.x)} x2={cx + px(i.x)} y1={cx + px(i.y) - 4} y2={cx + px(i.y) + 4} />
          </g>
        ))}
        <g className="salvo-scale">
          <line x1={16} x2={16 + px(barMetres)} y1={S - 18} y2={S - 18} />
          <text x={16} y={S - 24}>{barMetres >= 1_000 ? `${barMetres / 1_000} km` : `${barMetres} m`}</text>
        </g>
      </svg>
      <p className="log-empty">
        {killed} of {shots} inside the {km(lethal)} at which {psi.toLocaleString('en-GB')} psi is reached · the target itself is {extentMetres >= 1_000 ? `${(extentMetres / 1_000).toFixed(1)} km` : `${extentMetres} m`} across · CEP {km(cepMetres)}
      </p>
    </div>
  )
}

export function AccuracyLab() {
  const [systemId, setSystemId] = useState('atlas-d')
  const base = SYSTEMS.find((s) => s.id === systemId) ?? SYSTEMS[0]
  const [edit, setEdit] = useState<{ yieldKt: number; cepMetres: number } | null>(null)
  const [psi, setPsi] = useState(COUNTERFORCE_PSI)
  const [shots, setShots] = useState(1)
  const [reliability, setReliability] = useState(0.8)
  const [salvo, setSalvo] = useState(20)
  const [seed, setSeed] = useState(1)
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

        <ControlSheet id="accuracy">
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
        </ControlSheet>

        <ReadingSheet id="accuracy">
        <section className="log readiness-chart" aria-label="Crossing">
          <h2>What missing looks like</h2>
          <SalvoPlan yieldKt={sys.yieldKt} cepMetres={sys.cepMetres} psi={psi} extentMetres={target?.extentMetres ?? 4} shots={salvo} seed={seed} />
          <div className="clock-controls" role="group" aria-label="Salvo">
            {[5, 20, 100].map((n) => (
              <button key={n} type="button" className={n === salvo ? 'is-active' : ''} onClick={() => setSalvo(n)}>
                {n} warheads
              </button>
            ))}
            <button type="button" onClick={() => setSeed((v) => v + 1)}>
              Fire again
            </button>
          </div>
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
        </ReadingSheet>

        <EvidenceLegend />
      </div>
    </div>
  )
}
