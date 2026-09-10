import { useEffect } from 'react'
import { TIER_LABEL, TIER_MEANING, TIER_ORDER } from '../evidence/evidence.ts'

const REPO = 'https://github.com/emmettl/grid84'
const brief = (name: string) => `${REPO}/blob/main/docs/${name}`

interface FrontStudy {
  id: string
  epoch: string
  title: string
  line: string
  href: string
  brief: string
  variants?: Array<{ label: string; href: string }>
}

/** The studies as the front page lists them; each links to its own brief, which carries the sources and the findings. */
const STUDIES: FrontStudy[] = [
  {
    id: 'siop62',
    epoch: 'December 1961',
    title: 'SIOP//62',
    line: 'A bounded proof of the engine: one of everything, across every evidence tier, from the first single integrated operational plan.',
    href: '#/study/siop62',
    brief: brief('SIOP-62.md'),
  },
  {
    id: 'siop62-alert',
    epoch: '1961',
    title: 'Alert force',
    line: 'The plan\'s alert force enacted against its own target list, with refuelling, reliability and penetration as the record gives them, and the Soviet answer from what was on alert. Fourteen execution options as a force-generation curve.',
    href: '#/study/siop62-alert',
    brief: brief('SIOP-62.md'),
    variants: [{ label: 'Option 14', href: '#/study/siop62-alert/14' }],
  },
  {
    id: 'cuba-62',
    epoch: 'October 1962',
    title: 'Cuba 62',
    line: 'The crisis gone hot: the air strike, the R-12 regiments on Florida and the south-east, the FKR cruise missiles on Guantánamo, the landings and the Lunas on the beaches, then the general war a month into DEFCON 2.',
    href: '#/study/cuba-62',
    brief: brief('CUBA-62.md'),
    variants: [{ label: 'General war', href: '#/study/cuba-62/general' }],
  },
  {
    id: 'defcon3-73',
    epoch: 'October 1973',
    title: 'DEFCON 3',
    line: 'The posture of the night of 24 to 25 October from the Foreign Relations volume\'s own messages, both orders of battle from unit histories, SIOP-4 enacted with that force, and the 1969 readiness test with Giant Lance over Alaska.',
    href: '#/study/defcon3-73',
    brief: brief('DEFCON3-73.md'),
    variants: [
      { label: 'Execute', href: '#/study/defcon3-73/execute' },
      { label: '1969', href: '#/study/defcon3-73/1969' },
    ],
  },
  {
    id: 'able-archer-83',
    epoch: 'November 1983',
    title: 'Able Archer 83',
    line: 'The war scare gone hot as the European theatre war: the exercise week from the SHAPE report, the Soviet alert as the intelligence record reports it, and on the last morning the strike on NATO\'s delivery means and the answer from what survives. The first twenty minutes decide it.',
    href: '#/study/able-archer-83',
    brief: brief('ABLE-ARCHER-83.md'),
  },
  {
    id: 'britain-80',
    epoch: 'September 1980',
    title: 'Protect and Survive: Britain',
    line: 'Square Leg\'s 150 weapons and 280 megatons, the bomb plot withheld and drawn by a stated rule from the documented totals, the plumes on the exercise\'s own wind, and the Home Office\'s figures beside Openshaw\'s and the engine\'s. Strath\'s ten bombs of 1955 on the 1950 grid.',
    href: '#/study/britain-80',
    brief: brief('BRITAIN-80.md'),
    variants: [{ label: 'Strath 1955', href: '#/study/britain-80/strath' }],
  },
  {
    id: 'window-83',
    epoch: '1983',
    title: 'The window of vulnerability',
    line: 'A Soviet counterforce strike as the West feared it: two warheads on every American silo from the heavy fields, the boats off the coasts on the bombers with ten minutes\' warning, and the two answers the posture allowed. Ride it out and launch what survives, or launch under attack at H+22 so the warheads land on empty silos. The warning clock, minute by minute, is the point.',
    href: '#/study/window-83',
    brief: brief('WINDOW-83.md'),
    variants: [{ label: 'Launch under attack', href: '#/study/window-83/launch' }],
  },
  {
    id: '72-minutes',
    epoch: 'The present',
    title: 'Seventy-two minutes',
    line: 'A modern scenario after Jacobsen\'s Nuclear War and Bigelow\'s A House of Dynamite, on the forces of 2024 and the 2025 grid: one unattributed missile at Chicago with the interceptors at the film\'s odds, the agency\'s and the test record; then the book\'s seventy-two minutes, with the Minuteman arcs crossing the Russian Far East drawn where the geometry puts them. Nothing here is in any record, and every mark says so.',
    href: '#/study/72-minutes',
    brief: brief('72-MINUTES.md'),
    variants: [
      { label: 'Test record', href: '#/study/72-minutes/record' },
      { label: 'Jacobsen', href: '#/study/72-minutes/jacobsen' },
    ],
  },
]

const LABS: Array<{ title: string; line: string; href: string }> = [
  { title: 'Evidence', line: 'The five tiers as line, point and ring; synthetic specimens on real ground.', href: '#/lab/evidence' },
  { title: 'Population', line: 'Click the ground, choose a yield and a year; exposure by the 1961 method against the mass-fire bound, with published NUKEMAP runs beside it.', href: '#/lab/population' },
  { title: 'Terrain', line: 'Blast over real ground: shadow, wave and terrain factor.', href: '#/lab/terrain' },
  { title: 'Fallout', line: 'A contact surface burst and its idealized early fallout under a chosen wind.', href: '#/lab/fallout' },
  { title: 'Readiness', line: 'The fourteen execution options as a force-generation curve.', href: '#/lab/readiness' },
  { title: 'Accuracy', line: 'Counterforce as a technical choice: what a warhead of a given yield and CEP can destroy, from Atlas to Trident II, and the year the even-chance line against a hardened silo was crossed.', href: '#/lab/accuracy' },
  { title: 'Guidance', line: 'Where a CEP comes from: the error budget of a submarine missile, the boat\'s own drift since its last fix, and the star sight that took the boat out of the sum.', href: '#/lab/guidance' },
  { title: 'Defence', line: 'The shot exchange: warheads and decoys against interceptors, from Safeguard through SDI to the present decade\'s space layer, with the Nitze criterion in numbers.', href: '#/lab/defence' },
]

const SOURCES: Array<{ what: string; who: string; href: string; terms: string }> = [
  { what: 'Map geometry', who: 'OpenFreeMap © OpenMapTiles, data from OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright', terms: 'ODbL; attribution on every map' },
  { what: 'Terrain', who: 'Mapzen terrain tiles on AWS Open Data, blended from the sources listed below', href: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md', terms: 'Per source, below' },
  { what: 'Geocoding', who: 'Photon by komoot, an OpenStreetMap project', href: 'https://photon.komoot.io/', terms: 'Public instance, fair use' },
  { what: 'Population, study years', who: 'Klein Goldewijk, K. (2023). History Database of the Global Environment 3.3. Utrecht University', href: 'https://doi.org/10.24416/UU01-AEZZIT', terms: 'CC BY-NC-SA 4.0' },
  { what: 'Population, 1975 · 1985 · present', who: 'Schiavina, M., Freire, S., Carioli, A., MacManus, K. (2023). GHS-POP R2023A, GHS population grid multitemporal (1975–2030). European Commission, Joint Research Centre. PID http://data.europa.eu/89h/2ff68a52-5b5b-4a22-8f40-c41da8332cfe', href: 'https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE', terms: 'CC BY 4.0' },
  { what: 'Analytics', who: 'Cloudflare Web Analytics: page views without cookies or personal data', href: 'https://www.cloudflare.com/web-analytics/', terms: 'Cookieless' },
  { what: 'Software', who: 'MapLibre GL JS (BSD-3-Clause), React (MIT), DM Mono served from this site (SIL Open Font Licence 1.1)', href: 'https://github.com/emmettl/grid84/blob/main/docs/ATTRIBUTION.md', terms: 'Open source' },
]

/** The elevation sets the terrain tiles blend, each with the statement its provider asks for. */
const TERRAIN_SOURCES: string[] = [
  'United States: 3DEP, GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey',
  'Global: ETOPO1 terrain data, U.S. National Oceanic and Atmospheric Administration',
  'Europe: produced using Copernicus data and information funded by the European Union (EU-DEM)',
  'Arctic: DEMs created from DigitalGlobe, Inc., imagery and funded under National Science Foundation awards 1043681, 1559691 and 1542736 (ArcticDEM)',
  'Austria: © offene Daten Österreichs, Digitales Geländemodell (DGM) Österreich',
  'Australia: © Commonwealth of Australia (Geoscience Australia) 2017',
  'Canada: contains information licensed under the Open Government Licence, Canada',
  'Mexico: source INEGI, Continental relief, 2016',
  'New Zealand: copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government',
  'Norway: © Kartverket',
  'United Kingdom: © Environment Agency copyright and/or database right 2015. All rights reserved',
]

export function FrontPage() {
  useEffect(() => {
    if (window.location.hash === '#/sources') document.getElementById('front-sources')?.scrollIntoView()
    if (window.location.hash === '#/labs') document.getElementById('front-labs')?.scrollIntoView()
  }, [])
  return (
    <main className="front" aria-label="Grid/84">
      <div className="front-inner">
        <header className="front-masthead">
          <span className="front-eyebrow">SurfaceStudies presents · Terminal Atlas</span>
          <h1>GRID/84</h1>
          <p className="front-standfirst">
            A world-state playback engine. Anywhere on Earth, real geography, indefensibly dramatic presentation, turned on the history and doctrine of strategic nuclear weapons.
          </p>
          <p>
            Each study puts a documented plan, posture or exercise on the map and plays it out on its own clock: the launch sites and the targets, the arcs and the routes, the detonations, the fires and the plumes, and the people under them. Every mark carries its evidence tier, every readout states its method and its disagreements, and a fact the record withholds is drawn as withheld rather than guessed. Impractical, never fake.
          </p>
          <nav className="front-actions" aria-label="Start">
            <a className="front-button" href="#/study/siop62-alert">Open the alert force</a>
            <a className="front-button front-button--quiet" href="#/loop">Run the loop</a>
            <a className="front-button front-button--quiet" href="#/atlas">The atlas</a>
          </nav>
        </header>

        <section className="front-section" aria-labelledby="front-studies">
          <h2 id="front-studies">Studies</h2>
          <ol className="front-studies">
            {STUDIES.map((s) => (
              <li key={s.id}>
                <span className="front-epoch">{s.epoch}</span>
                <h3>
                  <a href={s.href}>{s.title}</a>
                </h3>
                <p>{s.line}</p>
                <span className="front-links">
                  <a href={s.href}>Open</a>
                  {s.variants?.map((v) => (
                    <a key={v.href} href={v.href}>
                      {v.label}
                    </a>
                  ))}
                  <a href={s.brief} rel="noreferrer">
                    Brief
                  </a>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="front-section" aria-labelledby="front-chronicle">
          <h2 id="front-chronicle">Chronicle</h2>
          <ul className="front-labs">
            <li>
              <a href="#/chronicle">The stockpiles</a>
              <span>Every warhead the nine states are estimated to have held, 1945 to the present, with the studies marked on the curve. The first chapter of the history between the studies; the labs on accuracy and defence carry the next two.</span>
            </li>
          </ul>
        </section>

        <section className="front-section" aria-labelledby="front-evidence">
          <h2 id="front-evidence">Evidence</h2>
          <p>
            Nothing on the map is invented. What the sources give is drawn as documented; what follows from them by a stated method is reconstructed; what is plausible but not evidenced for the plan in hand is inferred; the output of a named model with stated inputs is modelled; and where a record exists but is redacted, or was never released, the mark says so. The five tiers are drawn as five line and ring styles and named on every legend.
          </p>
          <ul className="front-tiers">
            {TIER_ORDER.map((tier) => (
              <li key={tier}>
                <span className={`swatch swatch--${tier}`} aria-hidden="true" />
                <strong>{TIER_LABEL[tier]}</strong>
                <span>{TIER_MEANING[tier]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="front-section" aria-labelledby="front-method">
          <h2 id="front-method">Method</h2>
          <p>
            Blast casualties follow the overpressure bands of the 1973 Defense Civil Preparedness Agency manual as the Office of Technology Assessment reprinted them in 1979, the same bands NUKEMAP uses. Mass fire is Postol's 1986 bound: everyone inside the third-degree-burn radius. Fallout is the idealized early plume of a contact surface burst under the study's wind, and its dose is applied to the survivors of blast and fire. Where detonations overlap, each person is counted once, at the worst that reached them. The population is a gridded census for the study's year, and the readout names the grid, its cell size and its licence.
          </p>
          <p>
            The engine is checked against Hiroshima and Nagasaki, against the Home Office and academic estimates for Square Leg, and against eight published NUKEMAP runs; the comparisons and where they disagree are in the{' '}
            <a href={brief('VALIDATION.md')} rel="noreferrer">
              validation notes
            </a>
            .
          </p>
        </section>

        <section className="front-section" aria-labelledby="front-labs">
          <h2 id="front-labs">Labs</h2>
          <ul className="front-labs">
            {LABS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.title}</a>
                <span>{l.line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="front-section" aria-labelledby="front-sources">
          <h2 id="front-sources">Data and licences</h2>
          <table className="front-sources">
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.what}>
                  <th scope="row">{s.what}</th>
                  <td>
                    <a href={s.href} rel="noreferrer">
                      {s.who}
                    </a>
                  </td>
                  <td>{s.terms}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details className="front-terrain">
            <summary>Terrain sources</summary>
            <ul>
              {TERRAIN_SOURCES.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
          <p>
            This site is non-commercial. The HYDE grids are used under a non-commercial, share-alike licence and any redistribution of the prepared grids carries the same terms; the GHSL grids are re-tiled from the published product and the HYDE grids re-encoded, both unchanged in value. The plans, exercises and estimates are cited page by page in each study's brief and on each mark's provenance panel. The full audit of every service and dataset against its terms is in the{' '}
            <a href={brief('ATTRIBUTION.md')} rel="noreferrer">
              attribution notes
            </a>
            .
          </p>
        </section>

        <footer className="front-footer">
          <span>
            An adjunct of{' '}
            <a href="https://motionstudies.app/" rel="noreferrer">
              Motion Studies
            </a>
          </span>
          <span>
            <a href={REPO} rel="noreferrer">
              Source and briefs on GitHub
            </a>
          </span>
        </footer>
      </div>
    </main>
  )
}
