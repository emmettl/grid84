import { useMemo, useState } from 'react'
import { EvidenceLegend } from '../studies/EvidenceLegend.tsx'
import { absentee, footprint, horizonMetres, INTERCEPT_SYSTEMS, missDistanceMetres, PHASES, reachMetres, window as boostWindow, DETECT_SECONDS, DECIDE_SECONDS, type InterceptSystem } from '../models/intercept.ts'

/**
 * The intercept lab: why hitting a bullet with a bullet is the easy part.
 *
 * Four phases, four different reasons it is hard, and each of them is a
 * graphic rather than a claim. The boost window, which detection and a
 * decision eat before an interceptor can move. The absentee ratio, which
 * is what it costs to have a shooter over the right place at the right
 * moment. The horizon, which is why a vehicle that glides low is seen five
 * times later than one that arcs high. And the defended footprint, which
 * is why a terminal battery covers a city and not a country.
 */

const km = (m: number) => (m >= 1_000 ? `${Math.round(m / 1_000).toLocaleString('en-GB')} km` : `${Math.round(m)} m`)
const W = 620
const H = 190
const PAD = { l: 56, r: 18, t: 20, b: 34 }

/** The boost phase as a bar: what the clock does to it before anything can be fired. */
function WindowBar({ burnSeconds }: { burnSeconds: number }) {
  const w = boostWindow(burnSeconds)
  const total = Math.max(burnSeconds, 60)
  const x = (s: number) => PAD.l + (s / total) * (W - PAD.l - PAD.r)
  const bar = 42
  const y = 56
  const parts = [
    { from: 0, to: w.detectSeconds, cls: 'iv-detect', label: 'Seeing it' },
    { from: w.detectSeconds, to: w.detectSeconds + w.decideSeconds, cls: 'iv-decide', label: 'Deciding' },
    { from: w.detectSeconds + w.decideSeconds, to: burnSeconds, cls: 'iv-fly', label: 'Flying' },
  ].filter((p) => p.to > p.from)
  return (
    <svg className="gen-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The boost phase, and what is left of it">
      <line x1={PAD.l} x2={W - PAD.r} y1={y + bar + 14} y2={y + bar + 14} className="axis" />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={x(f * total)} x2={x(f * total)} y1={y + bar + 14} y2={y + bar + 19} className="axis" />
          <text x={x(f * total)} y={y + bar + 32} className="tick" textAnchor="middle">
            {Math.round(f * total)} s
          </text>
        </g>
      ))}
      {parts.map((p) => (
        <g key={p.cls}>
          <rect x={x(p.from)} y={y} width={Math.max(1, x(p.to) - x(p.from))} height={bar} className={p.cls} />
          {x(p.to) - x(p.from) > 54 && (
            <text x={(x(p.from) + x(p.to)) / 2} y={y + bar / 2 + 4} className="tick" textAnchor="middle">
              {p.label}
            </text>
          )}
        </g>
      ))}
      <text x={PAD.l} y={38} className="tick">
        BURNOUT AT {burnSeconds} S · {w.availableSeconds} S LEFT TO FLY IN
      </text>
      <line x1={x(burnSeconds)} x2={x(burnSeconds)} y1={y - 8} y2={y + bar + 8} className="iv-burnout" />
    </svg>
  )
}

/** How many interceptors must be owned for one to be in the right place. */
function AbsenteeChart({ reach, altitudeMetres, constellation }: { reach: number; altitudeMetres: number; constellation: number }) {
  const points = useMemo(() => {
    const out: Array<{ n: number; expected: number }> = []
    for (let i = 0; i <= 100; i += 1) {
      const n = 10 ** (1 + (i / 100) * 3.2)
      out.push({ n, expected: absentee(reach, n, altitudeMetres).expected })
    }
    return out
  }, [reach, altitudeMetres])
  const yMax = Math.max(4, ...points.map((p) => p.expected))
  const x = (n: number) => PAD.l + ((Math.log10(n) - 1) / 3.2) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b)
  const here = absentee(reach, constellation, altitudeMetres)
  return (
    <svg className="gen-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Interceptors in place against constellation size">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(f * yMax)} y2={y(f * yMax)} className="grid" />
          <text x={PAD.l - 8} y={y(f * yMax) + 3} className="tick" textAnchor="end">
            {(f * yMax).toFixed(1)}
          </text>
        </g>
      ))}
      {[10, 100, 1_000, 10_000].map((n) => (
        <text key={n} x={x(n)} y={H - 12} className="tick" textAnchor="middle">
          {n.toLocaleString('en-GB')}
        </text>
      ))}
      <line x1={PAD.l} x2={W - PAD.r} y1={y(1)} y2={y(1)} className="iv-one" />
      <text x={W - PAD.r} y={y(1) - 5} className="tick" textAnchor="end">
        one in place
      </text>
      <path d={`M${points.map((p) => `${x(p.n).toFixed(1)},${y(p.expected).toFixed(1)}`).join(' L')}`} className="iv-line" />
      <circle cx={x(constellation)} cy={y(here.expected)} r={4} className="iv-dot" />
    </svg>
  )
}

/** The horizon: how far off a sensor can see something, by how high it flies. */
function HorizonChart({ sensorHeight, glideAltitude, apogee }: { sensorHeight: number; glideAltitude: number; apogee: number }) {
  const yMax = Math.max(apogee, 1_200_000)
  const xMax = horizonMetres(sensorHeight, yMax)
  const x = (m: number) => PAD.l + (m / xMax) * (W - PAD.l - PAD.r)
  const y = (m: number) => H - PAD.b - (m / yMax) * (H - PAD.t - PAD.b)
  const curve = useMemo(() => {
    const pts: string[] = []
    for (let i = 0; i <= 120; i += 1) {
      const h = (i / 120) * yMax
      pts.push(`${x(horizonMetres(sensorHeight, h)).toFixed(1)},${y(h).toFixed(1)}`)
    }
    return `M${pts.join(' L')}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensorHeight, yMax])
  const marks = [
    { h: glideAltitude, label: 'GLIDE', cls: 'iv-glide' },
    { h: apogee, label: 'BALLISTIC APOGEE', cls: 'iv-ballistic' },
  ]
  return (
    <svg className="gen-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Detection range against the altitude a thing flies at">
      <path d={curve} className="iv-line" />
      {marks.map((m) => (
        <g key={m.label}>
          <line x1={PAD.l} x2={x(horizonMetres(sensorHeight, m.h))} y1={y(m.h)} y2={y(m.h)} className={m.cls} />
          <circle cx={x(horizonMetres(sensorHeight, m.h))} cy={y(m.h)} r={3.5} className="iv-dot" />
          <text x={x(horizonMetres(sensorHeight, m.h)) + 6} y={y(m.h) + 3} className="tick">
            {m.label} · {km(horizonMetres(sensorHeight, m.h))}
          </text>
        </g>
      ))}
      <text x={PAD.l - 8} y={y(0) + 3} className="tick" textAnchor="end">
        0
      </text>
      <text x={PAD.l - 8} y={y(yMax) + 3} className="tick" textAnchor="end">
        {Math.round(yMax / 1_000)} km
      </text>
      <text x={W - PAD.r} y={H - 12} className="tick" textAnchor="end">
        range to the horizon
      </text>
    </svg>
  )
}

/** The defended footprint, drawn against something the size of a city. */
function FootprintPlan({ radiusMetres, cityRadiusMetres }: { radiusMetres: number; cityRadiusMetres: number }) {
  const S = 260
  const span = Math.max(radiusMetres, cityRadiusMetres) * 2.4
  const px = (m: number) => (m / span) * S
  const c = S / 2
  return (
    <svg className="gen-chart iv-plan" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="The ground a battery defends, against the size of a city">
      <circle cx={c} cy={c} r={px(radiusMetres)} className="iv-footprint" />
      <circle cx={c} cy={c} r={px(cityRadiusMetres)} className="iv-city" />
      <circle cx={c} cy={c} r={3} className="iv-battery" />
      <text x={8} y={S - 10} className="tick">
        {km(radiusMetres)} defended · city {km(cityRadiusMetres * 2)} across
      </text>
    </svg>
  )
}

export function InterceptLab() {
  const [burnSeconds, setBurnSeconds] = useState(180)
  const [interceptorMs, setInterceptorMs] = useState(5_000)
  const [constellation, setConstellation] = useState(1_000)
  const [altitudeKm, setAltitudeKm] = useState(500)
  const [sensorHeight, setSensorHeight] = useState(10)
  const [glideKm, setGlideKm] = useState(40)
  const [apogeeKm, setApogeeKm] = useState(1_000)
  const [terminal, setTerminal] = useState({ speed: 2_800, ceiling: 150, floor: 40 })
  const [timingError, setTimingError] = useState(0.1)
  const [systemId, setSystemId] = useState<string | null>(null)
  const system = INTERCEPT_SYSTEMS.find((x) => x.id === systemId) ?? null

  /** A preset sets whichever controls it has a figure for and leaves the rest alone. */
  const apply = (x: InterceptSystem) => {
    setSystemId(x.id)
    if (x.preset.burnSeconds) setBurnSeconds(x.preset.burnSeconds)
    if (x.preset.interceptorMs) setInterceptorMs(x.preset.interceptorMs)
    if (x.preset.constellation) setConstellation(x.preset.constellation)
    if (x.preset.orbitAltitudeMetres) setAltitudeKm(x.preset.orbitAltitudeMetres / 1_000)
    if (x.preset.glideAltitudeMetres) setGlideKm(x.preset.glideAltitudeMetres / 1_000)
    if (x.preset.terminalSpeedMs || x.preset.ceilingMetres || x.preset.floorMetres) {
      setTerminal((t) => {
        const ceiling = x.preset.ceilingMetres ? x.preset.ceilingMetres / 1_000 : t.ceiling
        const floor = x.preset.floorMetres ? x.preset.floorMetres / 1_000 : t.floor
        // A preset that sets only one end must not leave the band inside out.
        return { speed: x.preset.terminalSpeedMs ?? t.speed, ceiling, floor: Math.min(floor, ceiling - 1) }
      })
    }
  }

  const w = boostWindow(burnSeconds)
  const reach = reachMetres(w, interceptorMs)
  const space = absentee(reach, constellation, altitudeKm * 1_000)
  const foot = footprint({ interceptorSpeedMs: terminal.speed, ceilingMetres: terminal.ceiling * 1_000, floorMetres: terminal.floor * 1_000, reentrySpeedMs: 3_000, reentryAngleDeg: 30 })
  const miss = missDistanceMetres({ lateralErrorMetres: 20, timingErrorSeconds: timingError, closingSpeedMs: 10_000, handoverSeconds: 10 })
  const glideWarning = horizonMetres(sensorHeight, glideKm * 1_000) / 3_000 / 60
  const ballisticWarning = horizonMetres(sensorHeight, apogeeKm * 1_000) / 3_000 / 60

  return (
    <div className="study">
      <div className="study-hud lab-hud readiness-hud">
        <header className="hud-brand study-brand">
          <span>SurfaceStudies · Terminal Atlas</span>
          <strong>Lab · Interception</strong>
          <span>Four phases, four reasons it is hard, and the arithmetic of each</span>
        </header>

        <section className="clock" aria-label="The phases">
          <h2>Named systems</h2>
          {(['boost', 'midcourse', 'terminal', 'glide'] as const).map((p) => (
            <div key={p} className="clock-controls" role="group" aria-label={`${p} systems`}>
              <span className="log-empty lab-phase-tag">{p}</span>
              {INTERCEPT_SYSTEMS.filter((x) => x.phase === p).map((x) => (
                <button key={x.id} type="button" className={`${x.id === systemId ? 'is-active' : ''} ${x.status === 'deployed' ? 'is-fielded' : ''}`} onClick={() => apply(x)} title={`${x.years} · ${x.status} · ${x.note}`}>
                  {x.name}
                </button>
              ))}
            </div>
          ))}
          {system ? (
            <div className="lab-system">
              <p className="log-empty">
                {system.years} · {system.status} · {system.phase} phase <span className={`badge badge--${system.evidence}`}>{system.evidence.toUpperCase()}</span>
              </p>
              <p className="log-empty">{system.note}</p>
              <p className="log-empty lab-system-source">{system.provenance.source}</p>
              {system.provenance.method && <p className="log-empty lab-system-source">Method · {system.provenance.method}</p>}
              {system.provenance.withheldUnder && <p className="log-empty lab-system-withheld">Not published · {system.provenance.withheldUnder}</p>}
            </div>
          ) : (
            <p className="log-empty">A preset sets the controls it has a figure for and leaves the rest alone. Most of these are marked withheld, and it is worth saying why: no burnout velocity has ever been officially published for the ground-based interceptor, for any variant of the SM-3, for THAAD, for Patriot, for Arrow 3 or for the Russian 53T6. Every speed in circulation for them is an analyst's estimate, and the most-cited compendium disclaims its own accuracy. None of them carries a probability of kill either, and the reading panel says why.</p>
          )}

          <h2>The four phases</h2>
          <table className="bands">
            <tbody>
              {PHASES.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.gives}</td>
                  <td>{p.takes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Boost</h2>
          <div className="fields">
            <label className="field">
              <span>Burn time, s</span>
              <input type="number" min={30} max={400} value={burnSeconds} onChange={(e) => setBurnSeconds(Math.max(30, Number(e.target.value)))} />
            </label>
            <label className="field">
              <span>Interceptor, m/s</span>
              <input type="number" min={500} max={12_000} step={100} value={interceptorMs} onChange={(e) => setInterceptorMs(Math.max(500, Number(e.target.value)))} />
            </label>
            <label className="field">
              <span>Constellation</span>
              <input type="number" min={10} max={20_000} step={10} value={constellation} onChange={(e) => setConstellation(Math.max(10, Number(e.target.value)))} />
            </label>
            <label className="field">
              <span>Orbit, km</span>
              <input type="number" min={200} max={2_000} step={50} value={altitudeKm} onChange={(e) => setAltitudeKm(Math.max(200, Number(e.target.value)))} />
            </label>
          </div>
          <div className="clock-controls" role="group" aria-label="Boosters">
            <button type="button" className={burnSeconds === 180 ? 'is-active' : ''} onClick={() => setBurnSeconds(180)}>
              Solid · 180 s
            </button>
            <button type="button" className={burnSeconds === 300 ? 'is-active' : ''} onClick={() => setBurnSeconds(300)}>
              Liquid · 300 s
            </button>
          </div>
          <h2>Horizon and terminal</h2>
          <div className="fields">
            <label className="field">
              <span>Sensor height, m</span>
              <input type="number" min={0} max={10_000} value={sensorHeight} onChange={(e) => setSensorHeight(Math.max(0, Number(e.target.value)))} />
            </label>
            <label className="field">
              <span>Glide altitude, km</span>
              <input type="number" min={10} max={100} value={glideKm} onChange={(e) => setGlideKm(Math.max(10, Number(e.target.value)))} />
            </label>
            <label className="field">
              <span>Apogee, km</span>
              <input type="number" min={100} max={1_500} step={50} value={apogeeKm} onChange={(e) => setApogeeKm(Math.max(100, Number(e.target.value)))} />
            </label>
            <label className="field">
              <span>Interceptor, m/s</span>
              <input type="number" min={500} max={5_000} step={100} value={terminal.speed} onChange={(e) => setTerminal({ ...terminal, speed: Math.max(500, Number(e.target.value)) })} />
            </label>
            <label className="field">
              <span>Engage from, km</span>
              <input type="number" min={20} max={200} value={terminal.ceiling} onChange={(e) => setTerminal({ ...terminal, ceiling: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span>Down to, km</span>
              <input type="number" min={5} max={100} value={terminal.floor} onChange={(e) => setTerminal({ ...terminal, floor: Number(e.target.value) })} />
            </label>
          </div>
        </section>

        <section className="log readiness-chart" aria-label="The arithmetic of each phase">
          <h2>Boost · the window, and who is in it</h2>
          <WindowBar burnSeconds={burnSeconds} />
          <p className="log-empty">
            Detection takes {DETECT_SECONDS} s and a decision {DECIDE_SECONDS} more, so a booster that burns for {burnSeconds} s leaves {w.availableSeconds} s to fly in. At {interceptorMs.toLocaleString('en-GB')} m/s that is a circle {km(reach)} in radius, and the interceptor must already be inside it when the missile lifts.
          </p>
          <AbsenteeChart reach={reach} altitudeMetres={altitudeKm * 1_000} constellation={constellation} />
          <p className="log-empty">
            That circle is {(space.fraction * 100).toFixed(2)}% of the shell at {altitudeKm} km, so {constellation.toLocaleString('en-GB')} interceptors put {space.expected.toFixed(1)} of them over the launch point: a {Math.round(space.ratio).toLocaleString('en-GB')} to one absentee ratio, and a {Math.round(space.chance * 100)}% chance that at least one is there. This is why every serious proposal for shooting in boost phase has been counted in thousands.
          </p>

          <h2>Midcourse · hitting a bullet with a bullet</h2>
          <p className="log-empty">
            Twenty minutes of flight and nothing in a hurry, which is why every deployed strategic defence works here. The price is that the kill vehicle closes at about 10 km/s: {timingError} s of error in knowing when the target will be somewhere is {km(miss.alongTrackMetres)} of being in the wrong place, and cancelling that in the last ten seconds asks {Math.round(miss.divertNeededMs)} m/s of sideways push from a vehicle that carries a few hundred. And in vacuum a balloon of a few hundred grammes flies the same path as a warhead of a few hundred kilogrammes, because gravity does not care about mass.
          </p>
          <div className="fields">
            <label className="field">
              <span>Timing error, s</span>
              <input type="number" min={0.001} max={1} step={0.01} value={timingError} onChange={(e) => setTimingError(Math.max(0.001, Number(e.target.value)))} />
            </label>
          </div>

          <h2>Glide · the horizon</h2>
          <HorizonChart sensorHeight={sensorHeight} glideAltitude={glideKm * 1_000} apogee={apogeeKm * 1_000} />
          <p className="log-empty">
            A ground sensor {sensorHeight} m up sees a ballistic apogee at {km(horizonMetres(sensorHeight, apogeeKm * 1_000))} and a glide vehicle at {glideKm} km only at {km(horizonMetres(sensorHeight, glideKm * 1_000))}. At 3 km/s that is {ballisticWarning.toFixed(0)} minutes of warning against {glideWarning.toFixed(1)}. Nothing about the glide vehicle is hidden; it is simply lower, and the Earth is curved.
          </p>

          <h2>Terminal · the footprint</h2>
          <FootprintPlan radiusMetres={foot.radiusMetres} cityRadiusMetres={7_500} />
          <p className="log-empty">
            Coming down at 3 km/s at thirty degrees, a warhead crosses the band from {terminal.ceiling} km to {terminal.floor} km in {Math.round(foot.secondsAvailable)} s. An interceptor making {terminal.speed.toLocaleString('en-GB')} m/s can therefore reach {km(foot.radiusMetres)} from its battery: {Math.round(foot.areaSqKm).toLocaleString('en-GB')} km² defended. A city is about fifteen kilometres across. A country is not.
          </p>
        </section>

        <section className="provenance" aria-label="Reading">
          <h2>What the numbers mean</h2>
          <p className="provenance-method">
            Every figure on this page is arithmetic, not a claim about any particular system: the boost window is the burn time less a minute to see and half a minute to decide; the reach is that window times a speed; the absentee fraction is the spherical cap the reach cuts from the shell the interceptors orbit on; the horizon is the sum of the two horizon distances; the footprint is the time a warhead spends in the engagement band times the interceptor's speed.
          </p>
          <p className="provenance-method">
            The last of those is the one to test, and it passes: 2.8 km/s from 150 km down to 40 gives about 200 km of defended radius, which is what a high terminal battery's own literature claims, and 1.7 km/s from 30 km down to 15 gives about 20 km, which is what a point-defence battery claims. The same formula, from each system's own speed.
          </p>
          <p className="provenance-method">
            What is deliberately not here is a probability of kill for a named system. Test records are small, conducted against targets whose trajectory is known, and are not the same thing as a defence against an attack that is trying not to be intercepted.
          </p>
        </section>

        <EvidenceLegend />
      </div>
    </div>
  )
}
