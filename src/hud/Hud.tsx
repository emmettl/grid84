import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
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
  /** A target acquired from a shared link: its name goes in the prompt as if typed. */
  presetName?: string | null
}

export function Hud({ phase, onAcquire, consoleOpen = false, presetName = null }: HudProps) {
  const geocoder = useGeocoder()
  const [open, setOpen] = useState(false)
  /**
   * Which candidate the keyboard is on, or -1 for none. Minus one is not the
   * same as zero: with nothing highlighted, Enter means "take the query and
   * resolve it", which is how the prompt behaved before it had a list at all
   * and is what someone who has typed a full place name expects.
   */
  const [active, setActive] = useState(-1)
  const focused = useRef(false)
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (presetName) geocoder.settle(presetName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetName])

  const acquire = (target: AtlasTarget) => {
    setOpen(false)
    setActive(-1)
    geocoder.settle(target.name)
    onAcquire(target)
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const [first] = await geocoder.resolve()
    if (first) acquire(first)
  }

  const showResults = open && geocoder.query.trim() !== '' && geocoder.status !== 'idle'
  const candidates = showResults ? geocoder.results : []

  // A new set of candidates is a new list, so the highlight goes back to nothing
  // rather than staying on whatever happened to be at that index before.
  useEffect(() => {
    setActive(-1)
  }, [geocoder.results])

  /**
   * The prompt is a combobox and is driven like one.
   *
   * Down and up walk the candidates and wrap; Home and End go to the ends.
   * Enter takes the highlighted one, or resolves the query when nothing is
   * highlighted. Escape closes the list, and a second Escape clears the
   * prompt — the usual two-stage escape, so a wrong search can be abandoned
   * without reaching for the mouse or holding backspace.
   *
   * Enter is handled here rather than left to the form so it does not depend
   * on implicit submission, which some embedded browsers skip for synthetic
   * keys.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    const last = candidates.length - 1
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        // Down on a closed list opens it without moving, which is what a
        // reader who has just clicked back into the prompt is asking for.
        if (!open) {
          setOpen(true)
          if (geocoder.results.length > 0) return
        }
        if (last < 0) return
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive((i) => (i < 0 ? (step > 0 ? 0 : last) : (i + step + candidates.length) % candidates.length))
        return
      }
      case 'Home':
        if (last < 0) return
        event.preventDefault()
        setActive(0)
        return
      case 'End':
        if (last < 0) return
        event.preventDefault()
        setActive(last)
        return
      case 'Enter': {
        event.preventDefault()
        const chosen = candidates[active]
        if (chosen) acquire(chosen)
        else void submit()
        return
      }
      case 'Escape':
        event.preventDefault()
        if (open && candidates.length > 0) {
          setOpen(false)
          setActive(-1)
        } else {
          geocoder.setQuery('')
          setActive(-1)
        }
        return
      case 'Tab':
        // Leaving the prompt abandons the highlight rather than acquiring it.
        setOpen(false)
        setActive(-1)
        return
      default:
    }
  }

  // The highlight is driven by the keyboard, so it has to bring itself into view.
  useEffect(() => {
    if (active < 0) return
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

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
          ref={(el) => {
            // The prompt takes focus on a pointer device. On a phone that would raise the keyboard over the globe.
            if (el && !focused.current && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
              focused.current = true
              el.focus()
            }
          }}
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
          onBlur={() => setTimeout(() => { setOpen(false); setActive(-1) }, 150)}
          role="combobox"
          aria-expanded={showResults && candidates.length > 0}
          aria-controls="target-candidates"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && candidates[active] ? `target-candidate-${active}` : undefined}
        />
        {/* The block cursor: the native caret is hidden and a blinking block rides on an invisible mirror of the typed text. */}
        <span className="hud-caret" aria-hidden="true">
          <span className="hud-caret-mirror">{geocoder.query}</span>
          <span className="wopr-cursor hud-cursor" />
        </span>
        <button type="submit" disabled={geocoder.query.trim() === ''}>
          Acquire
        </button>
        </div>
        <span className="hud-search-status" aria-live="polite">
          {geocoder.status === 'searching' && 'Querying geocoder…'}
          {geocoder.status === 'error' && 'Geocoder unreachable'}
          {geocoder.status === 'ready' && geocoder.results.length === 0 && 'No target matches'}
          {geocoder.status === 'ready' && candidates.length > 0 && `${candidates.length} candidate${candidates.length > 1 ? 's' : ''} · ↑↓ to choose · ⏎ to acquire`}
        </span>
        {showResults && candidates.length > 0 && (
          <ul id="target-candidates" ref={listRef} className="hud-results" role="listbox" aria-label="Candidate targets">
            {candidates.map((target, i) => {
              const designation = designate(target)
              return (
                <li key={target.id} id={`target-candidate-${i}`} role="option" aria-selected={i === active} className={i === active ? 'is-active' : undefined}>
                  {/* The pointer moves the highlight too, so the two never disagree about which candidate is live. */}
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => acquire(target)}>
                    <strong>{target.name}</strong>
                    <em>
                      {[designation.role, designation.code].filter(Boolean).join(' ')}
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
            {[phase.designation.role, phase.designation.code].filter(Boolean).join(' ')}
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
          {[report.designation.role, report.designation.code].filter(Boolean).join(' ')}
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
    </>
  )
}
