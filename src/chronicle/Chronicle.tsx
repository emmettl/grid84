import { useMemo, useRef, useState } from 'react'
import stockpilesFile from '../../data/chronicle/stockpiles.json'
import postureFile from '../../data/chronicle/posture.json'
import { CrossingChart } from '../lab/AccuracyLab.tsx'
import { COUNTERFORCE_PSI } from '../models/lethality.ts'
import { placeLabels } from '../chart/labels.ts'

/**
 * The chronicle: doctrine, stockpiles and posture as charts and map states,
 * with the prose kept to captions and the sources one click away. The first
 * chapter is the stockpile curve, the calmest chart in the world.
 */

const STOCKPILES = stockpilesFile as unknown as { title: string; source: string; url: string; licence: string; note: string; years: [number, number]; series: Record<string, Array<[number, number]>> }

/** The studies, as marks on the years they belong to. */
const MOMENTS: Array<{ year: number; label: string; href: string }> = [
  { year: 1961, label: 'SIOP//62', href: '#/study/siop62-alert' },
  { year: 1962, label: 'Cuba', href: '#/study/cuba-62' },
  { year: 1973, label: 'DEFCON 3', href: '#/study/defcon3-73' },
  { year: 1980, label: 'Square Leg', href: '#/study/britain-80' },
  { year: 1983, label: 'Able Archer', href: '#/study/able-archer-83' },
  { year: 2025, label: '72 minutes', href: '#/study/72-minutes' },
]

/** The treaties as bounds on the curve: the year each entered into force, or ended. */
const TREATIES: Array<{ year: number; label: string; note: string }> = [
  { year: 1963, label: 'LTBT', note: 'Limited Test Ban Treaty: no tests in the atmosphere, in space or under water' },
  { year: 1970, label: 'NPT', note: 'Non-Proliferation Treaty in force' },
  { year: 1972, label: 'SALT I · ABM', note: 'Interim agreement freezing launchers; the ABM treaty limiting defences to two sites, later one' },
  { year: 1979, label: 'SALT II', note: 'Signed, never ratified, observed until 1986' },
  { year: 1987, label: 'INF', note: 'Intermediate-range missiles eliminated: the SS-20s, Pershing IIs and cruise missiles of the Able Archer study' },
  { year: 1991, label: 'START I', note: 'Deployed strategic warheads to 6,000 each; the drawdown the 1990s curve shows' },
  { year: 2002, label: 'SORT', note: 'Operationally deployed warheads to 1,700 to 2,200' },
  { year: 2011, label: 'New START', note: 'Deployed strategic warheads to 1,550 each, in force to February 2026' },
  { year: 2026, label: 'New START ends', note: 'The last bound expires' },
]

const POSTURE = postureFile as unknown as { epochs: Array<{ year: number; label: string; scope: string; study: string; studyName: string; sides: Record<string, string>; totals: Record<string, { sites: number; weapons: number }> }> }

/** Doctrine as the target rule it implies, and the study that enacts the rule. */
const DOCTRINES: Array<{ year: number; name: string; document: string; rule: string; study?: { label: string; href: string } }> = [
  { year: 1953, name: 'Massive retaliation', document: 'NSC 162/2, October 1953', rule: 'The whole force at once against the whole of the enemy: cities, industry and forces together, the optimum mix' },
  { year: 1961, name: 'The single plan', document: 'SIOP-62, briefed to Kennedy 13 September 1961', rule: 'One plan, executed whole: 3,400 ground zeros in the unrestricted allocation; airfields first by the task order, then the complexes', study: { label: 'Alert force', href: '#/study/siop62-alert' } },
  { year: 1965, name: 'Assured destruction', document: 'McNamara, draft presidential memorandum, December 1965', rule: 'Enough to destroy a fifth to a quarter of the population and half the industry after absorbing a first strike; about 400 equivalent megatons, and no more' },
  { year: 1974, name: 'Limited options', document: 'NSDM-242 and NUWEP-74', rule: 'Categories the weapons are assigned by: nuclear forces, other military, leadership, economic; options from a few weapons to the whole plan', study: { label: 'DEFCON 3 · execute', href: '#/study/defcon3-73/execute' } },
  { year: 1980, name: 'Countervailing', document: 'PD-59, July 1980', rule: 'Hold at risk what the adversary values most, leadership and forces above all, with the accuracy the new systems give', study: { label: 'Accuracy', href: '#/lab/accuracy' } },
  { year: 1983, name: 'The theatre', document: 'NATO general political guidelines; Soviet front doctrine', rule: 'Nuclear use inside a conventional war in Europe: the delivery means first, on both sides, in the first minutes', study: { label: 'Able Archer', href: '#/study/able-archer-83' } },
  { year: 2018, name: 'The present plan', document: 'Nuclear Posture Reviews of 2018 and 2022; OPLAN 8010', rule: 'Withheld. The studies draw a rule from the counts: forces and command first, then the most populous cells', study: { label: 'Seventy-two minutes', href: '#/study/72-minutes/jacobsen' } },
]


/** The aftermath, as it was discovered, disputed, forgotten and found again. */
const AFTERMATH: Array<{ year: number; name: string; what: string; href?: string; label?: string }> = [
  { year: 1982, name: 'Twilight at noon', what: "Crutzen and Birks, asked to write about the atmosphere after a nuclear war, notice that nobody has costed the smoke. Not the dust a burst throws up, which had been studied, but the smoke of the cities and forests burning afterwards. Their estimate is that it would darken the northern hemisphere for months, and they publish it in a Swedish environmental journal" },
  { year: 1983, name: 'TTAPS', what: 'Turco, Toon, Ackerman, Pollack and Sagan put the smoke through a radiative model and find continental interiors falling tens of degrees below freezing, in summer, for months. It is presented at a Washington conference on Halloween and published in Science before Christmas. The name in the title is the thing that carries: nuclear winter' },
  { year: 1983, name: 'And the biology', what: 'Ehrlich and eighteen co-authors publish the biological companion in the same issue, and make the point the physics paper does not: the cold itself is not what kills most people. The harvest is. That argument waits thirty-nine years for numbers', href: '#/winter', label: 'Model' },
  { year: 1983, name: 'The same answer in Moscow', what: "Aleksandrov and Stenchikov, at the Computing Centre of the USSR Academy of Sciences, run the case on a general circulation model rather than a one-dimensional one, and get the same result. Two adversaries' modelling establishments agree about the consequence of their own arsenals, which had not happened before" },
  { year: 1984, name: 'Some policy implications', what: "Sagan argues in Foreign Affairs that the finding makes the arsenals self-deterring: a first strike large enough to work would destroy the country that launched it, without retaliation. He proposes cutting below the threshold where the effect begins. The argument's weakness is that nobody can say where that threshold is" },
  { year: 1985, name: 'The Academy confirms it, widely', what: 'The US National Research Council reports that the mechanism is real and the magnitude uncertain by a factor of several. It is a fair verdict and a politically useless one: both sides of the argument quote it' },
  { year: 1985, name: 'SCOPE 28', what: 'The international scientific committee runs the fuller study in two volumes, physical and biological, and reaches the conclusion that has held ever since: the indirect effects, above all the loss of a harvest, would kill far more people than the weapons' },
  { year: 1985, name: 'Aleksandrov does not come home', what: 'The Soviet modeller who had confirmed the American result disappears in Madrid on 31 March, after a conference. He has never been found and no account of what happened has ever been established' },
  { year: 1986, name: 'Nuclear autumn', what: "Thompson and Schneider publish a reappraisal in Foreign Affairs arguing the cooling would be milder, and coin the phrase that does the political work: autumn, not winter. Their own paper says the policy implications are unchanged. That sentence is not the one that gets quoted" },
  { year: 1990, name: 'The authors revise themselves', what: 'Turco, Toon, Ackerman, Pollack and Sagan publish an appraisal of their own 1983 work in Science: the continental summer cooling is now ten to twenty degrees rather than thirty to forty, and the effect is real. The subject then goes quiet for sixteen years' },
  { year: 2000, name: 'What it was for', what: "Gorbachev, asked what moved him, names the models: the knowledge of what the two countries' scientists had found was, in his words, a great stimulus to act. Whether it moved the arsenals is not settled; it is the only case in this chronicle of a piece of physics being offered as a reason for disarmament by a man who could order one" },
  { year: 2007, name: 'Reopened', what: 'Robock and Toon run it again on a modern coupled climate model and find the 1983 result held, and worse in one respect: a hundred weapons between India and Pakistan, a fraction of one per cent of the world arsenal, would cool the planet more than any year of the last millennium', href: '#/winter', label: 'Model' },
  { year: 2022, name: 'The harvest, in numbers', what: "Xia and thirteen co-authors put the soot through a crop model, a fishery model and the world's food balance sheets. Five billion people are outside the food system after a war between the two large arsenals. Ehrlich's 1983 argument, quantified", href: '#/winter', label: 'Model' },
  { year: 2025, name: 'The Academies decline to adjudicate', what: 'A National Academies review of the whole field finds the fire models and the urban fuel surveys both inadequate to settle whether the smoke rises at all, and picks no winner. The quantity the argument turns on has been measured for one city, where the published values differ by a factor of four', href: '#/winter', label: 'Dial' },
]

/** The theatre: the rungs of a ladder nobody could describe, and the studies that draw them. */
const THEATRE: Array<{ year: number; name: string; what: string; href?: string; label?: string }> = [
  { year: 1955, name: 'Carte Blanche', what: 'NATO\'s own exercise simulates 335 weapons over Germany and estimates 1.7 million West German dead from the immediate effects alone. The figures leak that autumn', href: '#/study/carte-blanche', label: 'Open' },
  { year: 1957, name: 'MC 14/2', what: 'General nuclear response becomes the doctrine: the tripwire. Two years after the exercise that showed what it meant' },
  { year: 1961, name: 'The Davy Crockett', what: 'A recoilless rifle with a twenty-ton warhead, issued to platoons. The weapon and the political decision to use one arrive at the same rank' },
  { year: 1963, name: 'Down to the deck', what: 'Surface-to-air missiles drive every bomber force in Europe to low level; the V-force flies the profile it was not built for until Polaris takes the deterrent in 1969', href: '#/study/v-force/low', label: 'Open' },
  { year: 1967, name: 'MC 14/3', what: 'Flexible response: direct defence, deliberate escalation, general nuclear response. The middle rung is never specified, because specifying it would show it has no floor' },
  { year: 1977, name: 'The neutron bomb', what: 'An enhanced-radiation warhead is meant to kill crews and spare the town. It does not spare the town; it reaches the crews with a sixth of the wrecked ground a fission weapon needs, and that smallness is what makes it seem usable', href: '#/lab/neutron', label: 'Lab' },
  { year: 1979, name: 'The double-track decision, and the plan from the other side', what: 'NATO decides on the Pershing IIs and the cruise missiles while negotiating; the Warsaw Pact writes an exercise plan that begins by assuming NATO has used nuclear weapons first, and answers on twelve named western cities', href: '#/study/seven-days', label: 'Open' },
  { year: 1980, name: 'The demolition belt', what: 'Atomic demolition munitions stand buried on the defiles an advance must use, on the defender\'s own ground, waiting for a political release that has to arrive while the ground above them is fought over', href: '#/study/demolition-belt', label: 'Open' },
  { year: 1983, name: 'The missiles arrive', what: 'The Euromissiles are deployed in the same weeks as Able Archer. Coupling stops being an argument and becomes a deployment', href: '#/study/able-archer-83', label: 'Open' },
  { year: 1985, name: 'Sub-strategic', what: 'RAF Germany at two hundred feet with the WE.177. About two fifths of the weapons do not arrive, and the survivors are turned round and sent again', href: '#/study/tornado', label: 'Open' },
  { year: 1991, name: 'The ground weapons go', what: 'The presidential nuclear initiatives withdraw the artillery shells, the demolition munitions and the short-range missiles. What is left in Europe is a bomb on an aircraft' },
]

/** The forward deployments that put the weapons where the crises were. */
const BASING: Array<{ years: string; system: string; where: string; count: string; note: string; href?: string }> = [
  { years: '1959–1963', system: 'Thor', where: 'Britain, twenty sites in four groups', count: '60 missiles', note: 'The first American missiles in range of Moscow, under dual key' },
  { years: '1961–1963', system: 'Jupiter', where: 'Gioia del Colle, Italy; Çiğli, Turkey', count: '30 and 15', note: 'The Turkish missiles were the trade of the crisis, removed by April 1963', href: '#/study/cuba-62' },
  { years: '1962', system: 'R-12 and R-14', where: 'Cuba, six regiments', count: '36 R-12 missiles landed; the R-14 never arrived', note: 'Operation Anadyr as Norris and Kristensen count it', href: '#/study/cuba-62' },
  { years: '1976–1987', system: 'SS-20', where: 'Western military districts and beyond the Urals', count: '405 launchers at the treaty', note: 'Three warheads each; the Euromissile crisis begins here', href: '#/study/able-archer-83' },
  { years: '1983–1991', system: 'Pershing II and GLCM', where: 'West Germany; Britain, Italy, Belgium, the Netherlands', count: '108 and 464 planned', note: 'Arriving the week of Able Archer; gone under INF', href: '#/study/able-archer-83' },
  { years: '1960–', system: 'Boats at sea', where: 'Holy Loch, Rota and Guam, then the bastions and the open ocean', count: 'Half the force by the 1990s', note: 'The basing that needs no host: the posture atlas draws the patrol areas as the studies inferred them', href: '#/chronicle/posture' },
]

/** Missile defence, from the first programme to the present decade's. */
const DEFENCES: Array<{ year: number; name: string; what: string; href?: string }> = [
  { year: 1963, name: 'Nike-Zeus', what: 'Cancelled before deployment: it could not tell warheads from decoys' },
  { year: 1967, name: 'Sentinel', what: 'A thin national defence against China, announced and then withdrawn from the cities' },
  { year: 1972, name: 'ABM treaty · A-35', what: 'Two sites each, then one; the Moscow system the only one that stayed' },
  { year: 1975, name: 'Safeguard', what: 'One site at Grand Forks, a hundred interceptors, operational in October and ordered closed by Congress within the month', href: '#/lab/defence' },
  { year: 1983, name: 'Strategic Defense Initiative', what: 'The speech of 23 March; the American Physical Society study of 1987 on the decade or more the technologies needed' },
  { year: 1990, name: 'Brilliant Pebbles', what: 'About 4,600 space-based interceptors proposed for boost phase; never built', href: '#/lab/defence' },
  { year: 2002, name: 'Withdrawal', what: 'The United States leaves the ABM treaty' },
  { year: 2004, name: 'Ground-based midcourse defence', what: 'Interceptors at Fort Greely and Vandenberg, forty-four by 2017, twelve hits in twenty-one tests', href: '#/study/72-minutes/salvo' },
  { year: 2025, name: 'The space layer', what: 'An executive order in January and a programme in May; the Congressional Budget Office estimate of 1,000 to 2,000 interceptors for a small salvo', href: '#/lab/defence' },
]

/** Draw order and colour role: the two arsenals that made the curve, then the rest. */
const ORDER = ['United States', 'Russia', 'United Kingdom', 'France', 'China', 'Israel', 'India', 'Pakistan', 'North Korea', 'South Africa']
const ROLE: Record<string, string> = { 'United States': 'us', Russia: 'ru' }

const W = 960
const H = 420
const PAD = { l: 60, r: 120, t: 24, b: 40 }
const fmt = (v: number) => v.toLocaleString('en-GB')

function StockpileChart({ scale, onHover, hover, treaties }: { scale: 'linear' | 'log'; onHover: (y: number | null) => void; hover: number | null; treaties: boolean }) {
  const [y0, y1] = STOCKPILES.years
  const max = useMemo(() => Math.max(...Object.values(STOCKPILES.series).flat().map(([, v]) => v)), [])
  const yMax = scale === 'linear' ? Math.ceil(max / 10_000) * 10_000 : 100_000
  const x = (year: number) => PAD.l + ((year - y0) / (y1 - y0)) * (W - PAD.l - PAD.r)
  const y = (v: number) => {
    if (scale === 'linear') return H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b)
    const lv = Math.log10(Math.max(1, v))
    return H - PAD.b - (lv / 5) * (H - PAD.t - PAD.b)
  }
  const paths = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [name, points] of Object.entries(STOCKPILES.series)) {
      const pts = points.filter(([, v]) => scale === 'linear' || v > 0).map(([yr, v]) => `${x(yr).toFixed(1)},${y(v).toFixed(1)}`)
      out[name] = pts.length ? `M${pts.join(' L')}` : ''
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale])
  const ticks = scale === 'linear' ? [0, 10_000, 20_000, 30_000, 40_000].filter((t) => t <= yMax) : [1, 10, 100, 1_000, 10_000, 100_000]
  // One state update per hovered year, not per mouse event: the readout only changes when the year does.
  const lastYear = useRef<number | null>(null)
  const move = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    const yr = Math.max(y0, Math.min(y1, Math.round(y0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (y1 - y0))))
    if (yr === lastYear.current) return
    lastYear.current = yr
    onHover(yr)
  }
  const leave = () => {
    lastYear.current = null
    onHover(null)
  }
  const last = (name: string) => STOCKPILES.series[name][STOCKPILES.series[name].length - 1]
  const world = (yr: number) => Object.values(STOCKPILES.series).reduce((s, pts) => s + (pts.find(([yy]) => yy === yr)?.[1] ?? 0), 0)
  const peak = useMemo(() => {
    let best: [number, number] = [y0, 0]
    for (let yr = y0; yr <= y1; yr += 1) {
      const w = world(yr)
      if (w > best[1]) best = [yr, w]
    }
    return best
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <svg className="gen-chart chronicle-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={STOCKPILES.title} onMouseMove={move} onMouseLeave={leave}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={PAD.l - 8} y={y(t) + 3} className="tick" textAnchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
      {[1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020].map((yr) => (
        <text key={yr} x={x(yr)} y={H - PAD.b + 16} className="tick" textAnchor="middle">
          {yr}
        </text>
      ))}
      <text x={PAD.l} y={PAD.t - 8} className="tick">
        warheads in the stockpile, estimated · {scale === 'log' ? 'log scale' : 'linear'}
      </text>
      {MOMENTS.map((m) => (
        <g key={m.href} className="moment">
          <line x1={x(m.year)} x2={x(m.year)} y1={PAD.t} y2={H - PAD.b} className="grid grid--moment" />
          <text x={x(m.year) + 3} y={H - PAD.b - 6} className="tick tick--moment" transform={`rotate(-90 ${x(m.year) + 3} ${H - PAD.b - 6})`}>
            {m.label}
          </text>
        </g>
      ))}
      {treaties &&
        TREATIES.map((t) => (
          <g key={t.label} className="treaty">
            <line x1={x(t.year)} x2={x(t.year)} y1={PAD.t + 30} y2={H - PAD.b} className="grid grid--treaty" />
            <text x={x(t.year) - 3} y={PAD.t + 34} className="tick tick--treaty" transform={`rotate(-90 ${x(t.year) - 3} ${PAD.t + 34})`} textAnchor="end">
              {t.label}
            </text>
          </g>
        ))}
      {[...ORDER].reverse().map((name) =>
        paths[name] ? <path key={name} d={paths[name]} className={`series series--state series--${ROLE[name] ?? 'other'}`} /> : null,
      )}
      {placeLabels(
        ORDER.filter((name) => last(name)[1] > 0).map((name) => {
          const [yr, v] = last(name)
          return { id: name, x: x(yr) + 6, y: y(v) + 3, text: `${name === 'United Kingdom' ? 'Britain' : name} ${fmt(v)}`, anchor: 'start' as const, markX: x(yr), markY: y(v) }
        }),
        { top: PAD.t, bottom: H - PAD.b },
      ).map((l) => (
        <g key={l.id}>
          {l.leader && <line x1={l.markX} y1={l.markY} x2={l.x} y2={l.py - 3} className="leader" />}
          <text x={l.x} y={l.py} className={`label label--${ROLE[l.id] ?? 'other'}`}>
            {l.text}
          </text>
        </g>
      ))}
      <g className="peak">
        <text x={x(peak[0])} y={PAD.t + 10} className="label" textAnchor="middle">
          {fmt(peak[1])} in {peak[0]}, the world's peak
        </text>
      </g>
      {hover !== null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="cursor" />
          <text x={x(hover) + (hover > 2000 ? -6 : 6)} y={PAD.t + 26} className="label" textAnchor={hover > 2000 ? 'end' : 'start'}>
            {hover} · world {fmt(world(hover))}
          </text>
        </g>
      )}
    </svg>
  )
}

const SHORT: Record<string, string> = { 'United States': 'US', 'Soviet Union': 'USSR', Russia: 'Russia', 'North Korea': 'DPRK', NATO: 'NATO', 'Warsaw Pact': 'Pact' }

/** Weapons by side at the strategic epochs, as bars. */
function PostureBars() {
  const epochs = POSTURE.epochs.filter((e) => e.scope === 'strategic')
  const max = Math.max(...epochs.flatMap((e) => Object.values(e.totals).map((t) => t.weapons)))
  const W = 960
  const H = 200
  const PADL = 60
  const band = (W - PADL - 20) / epochs.length
  const h = (v: number) => (v / max) * (H - 60)
  return (
    <svg className="gen-chart chronicle-chart chronicle-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weapons by side at each strategic epoch">
      {epochs.map((e, i) => {
        const x0 = PADL + i * band
        const sides = Object.entries(e.sides).filter(([id]) => e.totals[id])
        const bw = Math.min(70, (band - 40) / sides.length)
        return (
          <g key={e.year}>
            {sides.map(([id, name], k) => {
              const v = e.totals[id].weapons
              const x = x0 + 20 + k * (bw + 8)
              return (
                <g key={id}>
                  <rect x={x} y={H - 30 - h(v)} width={bw} height={h(v)} className={`bar bar--${id === 'us' ? 'us' : id === 'nk' ? 'other' : 'ru'}`} />
                  <text x={x + bw / 2} y={H - 34 - h(v)} className="label" textAnchor="middle">
                    {fmt(v)}
                  </text>
                  <text x={x + bw / 2} y={H - 16} className="tick" textAnchor="middle">
                    {SHORT[name] ?? name}
                  </text>
                </g>
              )
            })}
            <text x={x0 + band / 2} y={H - 4} className="tick tick--moment" textAnchor="middle">
              {e.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function Chronicle() {
  const [scale, setScale] = useState<'linear' | 'log'>('linear')
  const [treaties, setTreaties] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const at = hover ?? STOCKPILES.years[1]
  // Every state, every time, so the row keeps its height as the year changes.
  const values = ORDER.map((name) => ({ name, v: STOCKPILES.series[name].find(([yy]) => yy === at)?.[1] ?? 0 }))
  return (
    <main className="front chronicle" aria-label="Chronicle">
      <div className="front-inner front-inner--wide">
        <header className="front-masthead">
          <span className="front-eyebrow">SurfaceStudies · Terminal Atlas · Chronicle</span>
          <h1>THE STOCKPILES</h1>
          <p className="front-standfirst">Every warhead the nine states are estimated to have held, 1945 to the present, with the studies marked on the years they belong to.</p>
        </header>

        <section className="front-section chronicle-section" aria-labelledby="ch-stockpiles">
          <div className="chronicle-toolbar">
            <h2 id="ch-stockpiles">Chapter 1 · The curve</h2>
            <div className="clock-controls" role="group" aria-label="Scale">
              <button type="button" className={scale === 'linear' ? 'is-active' : ''} onClick={() => setScale('linear')}>
                Linear
              </button>
              <button type="button" className={scale === 'log' ? 'is-active' : ''} onClick={() => setScale('log')}>
                Log
              </button>
              <button type="button" className={treaties ? 'is-active' : ''} onClick={() => setTreaties((t) => !t)}>
                Treaties
              </button>
            </div>
          </div>
          <StockpileChart scale={scale} onHover={setHover} hover={hover} treaties={treaties} />
          <div className="chronicle-readout">
            <span className="chronicle-year">{at}</span>
            {values.map((r) => (
              <span key={r.name} className={`chronicle-value chronicle-value--${ROLE[r.name] ?? 'other'}${r.v > 0 ? '' : ' is-none'}`}>
                {r.name === 'United Kingdom' ? 'Britain' : r.name} <strong>{r.v > 0 ? fmt(r.v) : '—'}</strong>
              </span>
            ))}
          </div>
          {treaties && (
            <ul className="chronicle-treaties">
              {TREATIES.map((t) => (
                <li key={t.label}>
                  <strong>{t.year}</strong> {t.label} · {t.note}
                </li>
              ))}
            </ul>
          )}
          <nav className="front-links chronicle-moments" aria-label="Studies on the curve">
            {MOMENTS.map((m) => (
              <a key={m.href} href={m.href}>
                {m.year} · {m.label}
              </a>
            ))}
          </nav>
          <details className="sources">
            <summary>Sources and methods</summary>
            <p className="provenance-source">{STOCKPILES.source}</p>
            <p className="provenance-method">{STOCKPILES.note} Licence: {STOCKPILES.licence}. The series counts each state's military stockpile as estimated year by year from the open record; the Soviet and Russian figures before 1991 are reconstructions from later disclosures, and every value is an estimate whose uncertainty the Federation's notes discuss.</p>
            <p className="provenance-method">
              Read further:{' '}
              <a href={STOCKPILES.url} rel="noreferrer">
                the series and its notes
              </a>{' '}
              · Kristensen and Korda, "Estimated global nuclear warhead inventories" (FAS) · Norris and Kristensen, "Global nuclear weapons inventories, 1945–2013," <em>Bulletin of the Atomic Scientists</em> 69:5 (2013) · the chronicle brief in this repository.
            </p>
          </details>
        </section>

        <section className="front-section chronicle-section" aria-labelledby="ch-posture">
          <h2 id="ch-posture">Chapter 2 · Posture</h2>
          <PostureBars />
          <p className="front-caption">
            Weapons the studies counted at their sites, by side, at the strategic epochs; the theatre pictures of 1962 and 1983 are drawn on the atlas but not here.{' '}
            <a href="#/chronicle/posture">Open the posture atlas</a>, where each epoch is a map.
          </p>
        </section>

        <section className="front-section chronicle-section" aria-labelledby="ch-doctrine">
          <h2 id="ch-doctrine">Chapter 3 · Doctrine as arithmetic</h2>
          <CrossingChart psi={COUNTERFORCE_PSI} selected="" onPick={() => (window.location.hash = '#/lab/accuracy')} />
          <p className="front-caption">
            Single-shot kill against a hardened silo by year of service. Counterforce became a doctrine when it became a number.{' '}
            <a href="#/lab/accuracy">Open the accuracy lab</a>.
          </p>
          <div className="chronicle-table-wrap">
          <table className="front-sources chronicle-table">
            <tbody>
              {DOCTRINES.map((d) => (
                <tr key={d.year}>
                  <th scope="row">{d.year}</th>
                  <td>
                    <strong>{d.name}</strong>
                    <br />
                    <span className="chronicle-muted">{d.document}</span>
                  </td>
                  <td>{d.rule}</td>
                  <td>{d.study ? <a href={d.study.href}>{d.study.label}</a> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>

        <section className="front-section chronicle-section" aria-labelledby="ch-basing">
          <h2 id="ch-basing">Chapter 4 · Geopolitics as basing</h2>
          <div className="chronicle-table-wrap">
          <table className="front-sources chronicle-table">
            <tbody>
              {BASING.map((b) => (
                <tr key={b.system}>
                  <th scope="row">{b.years}</th>
                  <td>
                    <strong>{b.system}</strong>
                    <br />
                    <span className="chronicle-muted">{b.where}</span>
                  </td>
                  <td>
                    {b.count}
                    <br />
                    <span className="chronicle-muted">{b.note}</span>
                  </td>
                  <td>{b.href ? <a href={b.href}>Open</a> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="front-caption">The crises are where the weapons were. Each row that has a study opens it.</p>
        </section>

        <section className="front-section chronicle-section" aria-labelledby="ch-treaties">
          <h2 id="ch-treaties">Chapter 5 · Treaties as bounds</h2>
          <p className="front-caption">The treaties are lines on the curve above: switch them on with the Treaties button. The INF line takes the Euromissiles off the map; the START I line is where the drawdown begins; the last line is the last bound's end.</p>
        </section>

        <section className="front-section chronicle-section" aria-labelledby="ch-theatre">
          <h2 id="ch-theatre">Chapter 6 · The theatre, and why it is not a separate compartment</h2>
          <p className="front-caption">
            Strategic policy cannot be read apart from this. NATO could not match the conventional force against it and so promised nuclear use early; every strategic argument of the Cold War follows from that promise. Flexible response only deterred if theatre use led somewhere, which is what coupling meant, and the Euromissile crisis was a four-year argument about whether it did. The documents do not describe a firebreak. They describe a slope.
          </p>
          <div className="chronicle-table-wrap">
            <table className="front-sources chronicle-table">
              <tbody>
                {THEATRE.map((t) => (
                  <tr key={`${t.year}-${t.name}`}>
                    <th scope="row">{t.year}</th>
                    <td>
                      <strong>{t.name}</strong>
                    </td>
                    <td>{t.what}</td>
                    <td>{t.href ? <a href={t.href}>{t.label ?? 'Open'}</a> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="front-caption">
            The five studies of this chapter are on the front page under <a href="#/studies">the theatre</a>; the brief is <a href="./brief/theatre.html">the theatre brief</a>.
          </p>
        </section>


        <section className="front-section chronicle-section" aria-labelledby="ch-defence">
          <h2 id="ch-defence">Chapter 7 · Missile defence</h2>
          <div className="chronicle-table-wrap">
          <table className="front-sources chronicle-table">
            <tbody>
              {DEFENCES.map((d) => (
                <tr key={d.year}>
                  <th scope="row">{d.year}</th>
                  <td>
                    <strong>{d.name}</strong>
                  </td>
                  <td>{d.what}</td>
                  <td>{d.href ? <a href={d.href}>Open</a> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="front-caption">
            Every one of these faced the same arithmetic: the defender must buy shots faster than the attacker buys warheads and decoys. <a href="#/lab/defence">The defence lab</a> draws the curve; <a href="#/study/72-minutes/salvo">the salvo act</a> draws it on the map.
          </p>
          <details className="sources">
            <summary>Sources and methods for chapters 3 to 7</summary>
            <p className="provenance-method">Doctrine: NSC 162/2 and the SIOP-62 briefing through the National Security Archive; McNamara's 1965 draft presidential memorandum; NSDM-242 and NUWEP-74; PD-59; the 2018 and 2022 Nuclear Posture Reviews. Each rule is the study's reading of the document, stated on the study's own omissions panel. Basing: Norris and Kristensen on Cuba; the Nuclear Weapons Databook; the INF treaty's memorandum of understanding for the SS-20, Pershing II and GLCM counts. Theatre: MC 14/2 and MC 14/3 as the standard accounts of NATO doctrine give them; the reporting of Carte Blanche and of the 2005 Polish release; the Nuclear Weapons Databook for the theatre systems. Defence: the Missile Defense Agency's test record; the American Physical Society (1987); the Union of Concerned Scientists (2000); the National Academies (2012); the Congressional Budget Office (2025), as reported. The counts in these tables are the open literature's and are quoted as such.</p>
          </details>
        </section>
        <section className="front-section chronicle-section" aria-labelledby="ch-aftermath">
          <h2 id="ch-aftermath">Chapter 8 · The aftermath, and what it did to the argument</h2>
          <p className="front-caption">
            Every chapter above counts what the weapons do where they land. From 1982 it was understood that this is not most of what they do. The smoke of the cities they burn would shade the northern hemisphere, the harvest would fail under it, and the famine would kill more people than the war. That finding has been made three times by two adversaries' scientists, disputed once on grounds its own authors called policy-neutral, forgotten for sixteen years, and confirmed with better models since. It is the only physics in this chronicle that a head of state has cited as a reason to disarm.
          </p>
          <div className="chronicle-table-wrap">
            <table className="front-sources chronicle-table">
              <tbody>
                {AFTERMATH.map((a) => (
                  <tr key={`${a.year}-${a.name}`}>
                    <th scope="row">{a.year}</th>
                    <td>
                      <strong>{a.name}</strong>
                    </td>
                    <td>{a.what}</td>
                    <td>{a.href ? <a href={a.href}>{a.label ?? 'Open'}</a> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="front-caption">
            The chain is modelled in <a href="#/winter">the years after</a>, and the optimiser at <a href="#/wopr">WOPR</a> now prints what its own best plan does to the sky, which its loss function does not carry. The brief is <a href="./brief/winter.html">the winter brief</a>.
          </p>
          <details className="sources">
            <summary>Sources for chapter 8</summary>
            <p className="provenance-method">
              Crutzen and Birks, Ambio 11 (1982); Turco, Toon, Ackerman, Pollack and Sagan, Science 222 (1983), and their own appraisal, Science 247 (1990); Ehrlich and eighteen others, Science 222 (1983); Aleksandrov and Stenchikov (1983) as the standard accounts of the Soviet work give it; Sagan, Foreign Affairs 62 (1983/84); the National Research Council, The Effects on the Atmosphere of a Major Nuclear Exchange (1985); SCOPE 28 (1985); Thompson and Schneider, Foreign Affairs 64 (1986); Robock, Oman and Stenchikov, J. Geophys. Res. 112 (2007); Xia and others, Nature Food 3 (2022); National Academies, Potential Environmental Effects of Nuclear War (2025). Gorbachev's remark is his own, from an interview of 2000, and is given here as a statement he made rather than as evidence of what moved a government. Aleksandrov's disappearance in Madrid on 31 March 1985 is reported as the fact it is: unresolved.
            </p>
          </details>
        </section>
      </div>
    </main>
  )
}
