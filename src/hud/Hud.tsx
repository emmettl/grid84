import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { designate } from '../atlas/designation.ts'
import type { AtlasTarget } from '../atlas/target.ts'
import { formatBearing, formatElevation, formatGrid, formatRange } from '../geo/geodesy.ts'
import type { AtlasPhase } from '../map/atlas.ts'
import { useGeocoder } from './use-geocoder.ts'

interface HudProps {
  phase: AtlasPhase
  onAcquire: (target: AtlasTarget) => void
  /** The strike console is up; on a phone the readout and the credits give it the room. */
  consoleOpen?: boolean
}

export function Hud({ phase, onAcquire, consoleOpen = false }: HudProps) {
  const geocoder = useGeocoder()
  const [open, setOpen] = useState(false)

  const acquire = (target: AtlasTarget) => {
    setOpen(false)
    geocoder.settle(target.name)
    onAcquire(target)
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const [first] = await geocoder.resolve()
    if (first) acquire(first)
  }

  // Enter acquires the first candidate. Handled explicitly so it does not depend on
  // implicit form submission, which some embedded browsers skip for synthetic keys.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    void submit()
  }

  const showResults = open && geocoder.query.trim() !== '' && geocoder.status !== 'idle'

  return (
    <div className={`hud${consoleOpen ? ' hud--console' : ''}`}>
      <header className="hud-brand">
        <span>SurfaceStudies presents</span>
        <strong>Terminal Atlas</strong>
        <span>Grid/84 global cartographic system</span>
      </header>

      <form className="hud-search" onSubmit={submit} role="search" aria-label="Designate target">
        <label htmlFor="target-query" className="hud-prompt-label">
          <span aria-hidden="true">&gt; </span>ENTER TARGET
        </label>
        <div className="hud-search-row">
        <input
          id="target-query"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder=""
          value={geocoder.query}
          onChange={(event) => {
            geocoder.setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {geocoder.query === '' && <span className="wopr-cursor hud-cursor" aria-hidden="true" />}
        <button type="submit" disabled={geocoder.query.trim() === ''}>
          Acquire
        </button>
        </div>
        <span className="hud-search-status" aria-live="polite">
          {geocoder.status === 'searching' && 'Querying geocoder…'}
          {geocoder.status === 'error' && 'Geocoder unreachable'}
          {geocoder.status === 'ready' && geocoder.results.length === 0 && 'No target matches'}
        </span>
        {showResults && geocoder.results.length > 0 && (
          <ul className="hud-results" role="listbox" aria-label="Candidate targets">
            {geocoder.results.map((target) => {
              const designation = designate(target)
              return (
                <li key={target.id} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => acquire(target)}>
                    <strong>{target.name}</strong>
                    <em>
                      {designation.role} {designation.code}
                    </em>
                    {target.label && <span>{target.label}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </form>

      <section className="hud-readout" aria-live="polite" aria-atomic="true">
        <Readout phase={phase} />
      </section>

      <footer className="hud-sources">
        Geometry: OpenStreetMap contributors · Tiles: OpenFreeMap · Terrain: Mapzen / AWS Terrain Tiles ·
        Geocoding: Photon (komoot) · Boundaries: Nominatim · Weather: Open-Meteo · Population: GHSL 2025 · Forces: Nuclear Notebook, SIPRI
      </footer>
    </div>
  )
}

function Readout({ phase }: { phase: AtlasPhase }) {
  if (phase.kind === 'standby') {
    return (
      <>
        <h1>Orbital standby</h1>
        <dl>
          <dt>Status</dt>
          <dd>Awaiting target designation</dd>
        </dl>
      </>
    )
  }
  if (phase.kind === 'descending') {
    return (
      <>
        <h1>Descending</h1>
        <dl>
          <dt>Target</dt>
          <dd>{phase.target.name}</dd>
          <dt>Designation</dt>
          <dd>
            {phase.designation.role} {phase.designation.code}
          </dd>
        </dl>
      </>
    )
  }
  const { report } = phase
  return (
    <>
      <h1>Target acquired</h1>
      <p className="hud-target">{report.target.name}</p>
      {report.target.label && <p className="hud-target-label">{report.target.label}</p>}
      <dl>
        <dt>Designation</dt>
        <dd>
          {report.designation.role} {report.designation.code}
        </dd>
        <dt>Grid</dt>
        <dd>{formatGrid(report.target.position)}</dd>
        <dt>Range</dt>
        <dd>
          {report.rangeMetres === null || report.bearing === null
            ? 'Initial fix'
            : `${formatRange(report.rangeMetres)} · BRG ${formatBearing(report.bearing)}`}
        </dd>
        {report.from && (
          <>
            <dt>From</dt>
            <dd>{report.from.name}</dd>
          </>
        )}
        {report.elevationMetres !== null && (
          <>
            <dt>Elevation</dt>
            <dd>{formatElevation(report.elevationMetres)}</dd>
          </>
        )}
      </dl>
      <p className="hud-prompt">
        Commence navigation? <span>Routing offline · stage 1</span>
      </p>
    </>
  )
}
