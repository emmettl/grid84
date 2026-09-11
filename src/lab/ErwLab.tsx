import { useMemo, useState } from 'react'
import { formatProvenance } from '../evidence/evidence.ts'
import { BLAST_MODEL } from '../models/blast.ts'
import { doctrine, DOSES, equivalentFissionYieldKt, ERW_MODEL, erwProfile, SHIELDING, type ShieldingKey, type WeaponKind } from '../models/enhanced-radiation.ts'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'
import { ControlSheet, ReadingSheet } from '../hud/sheets.tsx'

const m = (v: number) => (v >= 1_000 ? `${(v / 1_000).toFixed(2)} km` : `${Math.round(v)} m`)
const ktLabel = (v: number) => (v >= 1_000 ? `${(v / 1_000).toFixed(1)} Mt` : v >= 1 ? `${Math.round(v * 10) / 10} kt` : `${Math.round(v * 1_000)} t`)

const YIELDS = [0.1, 0.5, 1, 2, 5, 10, 50]

/** The weapons the doctrine was written around. */
const CASES = [
  { id: 'w70', name: 'W70-3 on Lance', yieldKt: 1, kind: 'enhanced' as WeaponKind, note: 'The enhanced-radiation warhead for the Lance missile, cancelled by Carter in April 1978 after the political storm, put into production by Reagan in 1981 and withdrawn under Bush in 1992' },
  { id: 'w79', name: 'W79 · 203 mm shell', yieldKt: 0.8, kind: 'enhanced' as WeaponKind, note: 'The enhanced-radiation artillery shell: a corps commander\'s weapon, fired by a battery, with the political consequences of a strategic one' },
  { id: 'w48', name: 'W48 · 155 mm shell', yieldKt: 0.072, kind: 'fission' as WeaponKind, note: 'The ordinary fission shell it would have joined: seventy-two tons, the smallest thing in the American stockpile' },
  { id: 'davy', name: 'Davy Crockett', yieldKt: 0.02, kind: 'fission' as WeaponKind, note: 'A recoilless rifle with a twenty-ton warhead and a range shorter, on the higher setting, than the distance at which its own radiation was lethal' },
  { id: 'tactical', name: 'A tactical fission weapon', yieldKt: 10, kind: 'fission' as WeaponKind, note: 'The ordinary theatre weapon of the period, for comparison' },
]

const W = 660
const H = 320
const CX = W / 2
const CY = H / 2 + 10

export function ErwLab() {
  const [caseId, setCaseId] = useState('w70')
  const [yieldKt, setYieldKt] = useState(1)
  const [kind, setKind] = useState<WeaponKind>('enhanced')
  const [shielding, setShielding] = useState<ShieldingKey>('armour')
  const [townMetres, setTownMetres] = useState(1_200)

  const profile = useMemo(() => erwProfile(yieldKt, kind), [yieldKt, kind])
  const d = useMemo(() => doctrine(yieldKt, kind), [yieldKt, kind])
  const shield = SHIELDING.find((s) => s.key === shielding) ?? SHIELDING[1]
  const chosen = CASES.find((c) => c.id === caseId)

  const pick = (id: string) => {
    const c = CASES.find((x) => x.id === id)
    if (!c) return
    setCaseId(id)
    setYieldKt(c.yieldKt)
    setKind(c.kind)
  }

  // The plan view: rings to scale, with the town's edge as a straight line.
  const outer = Math.max(profile.blast5psiMetres, profile.doses[3].radii[shielding], townMetres) * 1.15
  const scale = (H / 2 - 20) / outer
  const r = (metres: number) => Math.max(0, metres * scale)

  return (
    <div className="study readiness defence">
      <div className="readiness-ground" aria-hidden="true" />
      <div className="study-hud lab-hud readiness-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>LAB · THE NEUTRON BOMB</strong>
          <span>Enhanced radiation weapons and the doctrine written around them</span>
        </header>

        <ControlSheet id="neutron">
        <section className="clock" aria-label="Weapon">
          <h2>Weapon</h2>
          <div className="clock-controls">
            {CASES.map((c) => (
              <button key={c.id} type="button" className={caseId === c.id ? 'is-active' : ''} title={c.note} onClick={() => pick(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          {chosen && <p className="log-empty">{chosen.note}</p>}
          <h2>Yield {ktLabel(yieldKt)}</h2>
          <div className="clock-controls">
            {YIELDS.map((y) => (
              <button key={y} type="button" className={yieldKt === y ? 'is-active' : ''} onClick={() => setYieldKt(y)}>
                {ktLabel(y)}
              </button>
            ))}
          </div>
          <h2>Design</h2>
          <div className="clock-controls">
            <button type="button" className={kind === 'fission' ? 'is-active' : ''} onClick={() => setKind('fission')}>
              Ordinary fission
            </button>
            <button type="button" className={kind === 'enhanced' ? 'is-active' : ''} onClick={() => setKind('enhanced')}>
              Enhanced radiation
            </button>
          </div>
          <h2>The target</h2>
          <div className="clock-controls">
            {SHIELDING.map((s) => (
              <button key={s.key} type="button" className={shielding === s.key ? 'is-active' : ''} onClick={() => setShielding(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <h2>The town is {m(townMetres)} away</h2>
          <input type="range" min={200} max={4_000} step={50} value={townMetres} aria-label="Distance to the nearest town" onChange={(e) => setTownMetres(Number(e.target.value))} />
        </section>
        </ControlSheet>

        <ReadingSheet id="neutron">
        <section className="log" aria-label="The doctrine">
          <h2>The claim, and what holds of it</h2>
          <dl className="grid-facts">
            <dt>Crews in armour incapacitated to</dt>
            <dd>
              {m(d.killMetres)} <span className="badge badge--modelled">MODELLED</span>
            </dd>
            <dt>Houses wrecked to (5 psi)</dt>
            <dd>{m(d.damageMetres)}</dd>
            <dt>Does it spare the town?</dt>
            <dd>{d.sparesTheTown ? 'The crews are killed beyond the wrecked houses' : 'No. The houses are wrecked about as far out as the crews are killed'}</dd>
            {kind === 'enhanced' && (
              <>
                <dt>A fission weapon of the same reach</dt>
                <dd>
                  {ktLabel(d.equivalentFissionKt)}, wrecking to {m(d.equivalentDamageMetres)}
                </dd>
                <dt>Ground wrecked, compared</dt>
                <dd>{d.damageAreaRatio.toFixed(1)}× less, for the same effect on the crews</dd>
              </>
            )}
            <dt>The town at {m(townMetres)}</dt>
            <dd>
              {townMetres < d.damageMetres ? 'Inside the wrecked area' : townMetres < profile.doses[2].radii[shielding] ? 'Standing, and half the people in it die of the radiation' : townMetres < profile.doses[3].radii[shielding] ? 'Standing, with radiation sickness in it' : 'Outside every ring drawn here'}
            </dd>
          </dl>
        </section>

        <section className="provenance" aria-label="The rings">
          <h2>{kind === 'enhanced' ? 'Enhanced radiation' : 'Ordinary fission'} · {ktLabel(yieldKt)} · a target {shield.label.toLowerCase()}</h2>
          <svg className="gen-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Prompt radiation and blast radii to scale">
            <rect x={0} y={0} width={W} height={H} fill="none" />
            {/* The town, as a band at its distance. */}
            <rect x={CX + r(townMetres)} y={0} width={Math.max(0, W - CX - r(townMetres))} height={H} className="erw-town" />
            <text x={Math.min(W - 6, CX + r(townMetres) + 6)} y={16} className="label" textAnchor="start">
              THE TOWN
            </text>
            {/* Blast first, so the radiation rings read over it. */}
            <circle cx={CX} cy={CY} r={r(profile.blast5psiMetres)} className="erw-blast" />
            <circle cx={CX} cy={CY} r={r(profile.blast20psiMetres)} className="erw-blast erw-blast--severe" />
            {profile.doses.map((dose, i) => (
              <circle key={dose.key} cx={CX} cy={CY} r={r(dose.radii[shielding])} className={`erw-dose erw-dose--${i}`} />
            ))}
            <circle cx={CX} cy={CY} r={2.5} className="erw-zero" />
            {profile.doses.map((dose, i) => {
              const rr = r(dose.radii[shielding])
              if (rr < 8) return null
              return (
                <text key={dose.key} x={CX} y={CY - rr - 4} className="label" textAnchor="middle">
                  {dose.rads.toLocaleString('en-GB')} RAD
                  {i === 0 ? ' · CREWS STOP' : ''}
                </text>
              )
            })}
            <text x={CX} y={CY + r(profile.blast5psiMetres) + 14} className="label" textAnchor="middle">
              5 PSI · HOUSES WRECKED · {m(profile.blast5psiMetres)}
            </text>
          </svg>
          <p className="provenance-source">
            Radii <span className="badge badge--modelled">MODELLED</span> {formatProvenance({ source: ERW_MODEL })}. Blast by {BLAST_MODEL}.
          </p>
          <p className="provenance-method">
            The enhancement is taken as a factor of ten on the prompt dose for the same yield, which is the order the open literature gives and is an assumption, not a transport calculation. The dose criteria are the ones the American Army used: 8,000 rads to stop a crew within minutes, 650 to kill half of those who take it. Shielding is a divisor: armour is worth about 2.5 against neutrons and a cellar about ten, which is why the weapon was described as one that killed soldiers and spared civilians, and why that description does not survive the arithmetic when the soldiers are in the town.
          </p>
        </section>

        <section className="omissions" aria-label="Not computed">
          <h2>Not represented</h2>
          <ul>
            <li>No transport calculation. The enhancement, the shielding factors and the dose criteria are stated numbers from the open literature, not a computation of what the neutrons do</li>
            <li>Residual radiation from neutron activation of the ground and of the armour itself, which is what made the weapon dirty in the place it was used, is not drawn</li>
            <li>No fallout: these are air bursts at a few hundred metres</li>
            <li>Nothing here says whether an armoured division would be where the weapon was aimed by the time it arrived, which was the practical objection the soldiers made</li>
          </ul>
          <h2>Further reading</h2>
          <ul className="study-links">
            <li>
              <a href="#/study/carte-blanche">Carte Blanche: what 335 weapons on Germany came to in 1955</a>
            </li>
            <li>
              <a href="#/study/seven-days">Seven days to the River Rhine: the answer from the other side</a>
            </li>
            <li>
              <a href="#/lab/accuracy">The accuracy lab: yield against hardness</a>
            </li>
          </ul>
        </section>
        </ReadingSheet>

        <EvidenceLegend />
      </div>
    </div>
  )
}

export const ERW_EQUIVALENCE = equivalentFissionYieldKt
export const ERW_DOSES = DOSES
