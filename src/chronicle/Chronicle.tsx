import { useMemo, useState } from 'react'
import stockpilesFile from '../../data/chronicle/stockpiles.json'

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
  const move = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    const yr = Math.round(y0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (y1 - y0))
    onHover(Math.max(y0, Math.min(y1, yr)))
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
    <svg className="gen-chart chronicle-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={STOCKPILES.title} onMouseMove={move} onMouseLeave={() => onHover(null)}>
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
      {ORDER.map((name) => {
        const [yr, v] = last(name)
        if (v <= 0) return null
        return (
          <text key={name} x={x(yr) + 6} y={y(v) + 3} className={`label label--${ROLE[name] ?? 'other'}`}>
            {name === 'United States' ? 'United States' : name === 'United Kingdom' ? 'Britain' : name} {fmt(v)}
          </text>
        )
      })}
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

export function Chronicle() {
  const [scale, setScale] = useState<'linear' | 'log'>('linear')
  const [treaties, setTreaties] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const at = hover ?? STOCKPILES.years[1]
  const values = ORDER.map((name) => ({ name, v: STOCKPILES.series[name].find(([yy]) => yy === at)?.[1] ?? 0 })).filter((r) => r.v > 0)
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
              <span key={r.name} className={`chronicle-value chronicle-value--${ROLE[r.name] ?? 'other'}`}>
                {r.name === 'United Kingdom' ? 'Britain' : r.name} <strong>{fmt(r.v)}</strong>
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

        <section className="front-section" aria-labelledby="ch-next">
          <h2 id="ch-next">Chapters</h2>
          <ul className="front-labs">
            <li>
              <a href="#/chronicle/posture">Chapter 2 · Posture</a>
              <span>The forces where they stood, scrubbed across the epochs the studies built: 1961, 1962, 1973, 1983, 2024. Disc area is the weapons each study counted at the site.</span>
            </li>
            <li>
              <a href="#/lab/accuracy">Doctrine as arithmetic</a>
              <span>Each named policy as the target rule it implies; the accuracy lab shows why the choice was technical first.</span>
            </li>
            <li>
              <a href="#/lab/defence">Missile defence</a>
              <span>The shot exchange from Safeguard to the present decade, in the defence lab and on the map.</span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
