# Roadmap

[Manifesto](README.md#introductionmanifesto) · [Sources](README.md#sources) · [SIOP//62 brief](docs/SIOP-62.md)

Grid/84 is a world-state playback engine wearing a map. The Terminal Atlas is the engine idling with one entity, the camera; routing adds moving entities on real networks; the execution studies add thousands, each with provenance. It is an art-and-data instrument. Each stage should end in a coherent, viewable study rather than a long period of invisible infrastructure. Two rules govern every stage:

1. **Impractical, never fake.** Every readout is computed from real geometry or a documented model. Where a value is uncertain, say so on the readout; never decorate a guess as a fact.
2. **Ordinary map labels are beneath it.** The atlas names things through its own designations. If a stage needs labels for legibility, they are the atlas's labels, in the atlas's register.

No calendar dates are implied. Each stage names its exit criterion and the live services it depends on.

## Services

| Concern | Service | Terms | Status |
| --- | --- | --- | --- |
| Vector geometry (roads, rail, water, buildings, boundaries) | [OpenFreeMap](https://openfreemap.org/) planet tiles, OpenMapTiles schema | Free, no key, OSM attribution | In use |
| Terrain and elevation | [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), Terrarium encoding | Free, Mapzen attribution | In use |
| Geocoding | [Photon](https://photon.komoot.io/) public instance | Fair use, no key | In use |
| Routing | OSRM or Valhalla public demo servers | Demo only; own host for publication | Stage 1 |
| Contours | `maplibre-contour` from the terrain tiles | Client side | Stage 2 |
| Population | HYDE 3.3 grids (Utrecht), prepared by `scripts/prepare-hyde-grid.py`; 1940, 1961, 1983 and 2023 are committed, other years prepare locally in seconds; GHSL later for finer contemporary resolution | CC BY-NC-SA 4.0; behind a bot check, manual download | In use |

## 0 — Target acquisition (now)

- [x] Establish the Vite, React, TypeScript, oxlint and Vitest baseline from Motion Studies.
- [x] Hash routes: `#/` atlas, `#/study/<id>` execution studies, `#/lab/<id>` labs.
- [x] Globe in orbital standby with the Grid/84 style: dark ink, cyan conduits, amber rail, wireframe building footprints, hillshaded relief, no labels.
- [x] Photon search with candidate list and Enter-to-acquire.
- [x] Seven-second descent from orbit to the target, pitched along the line of flight, with terrain enabled below the orbital threshold.
- [x] Acquisition readout: designation role and code, grid reference, range and bearing from the previous fix, terrain elevation.
- [x] Reduced-motion path: no rotation, jump instead of fly.
- [ ] Rank candidates so a station or settlement outranks a guidepost of the same name; Photon returns the `information=guidepost` node first for "Zürich HB".
- [ ] Verify the descent on a real phone and set the first transfer budget for the opening view.
- [ ] Contract test for the geocoder against a recorded Photon response, so a schema change is caught before a release.
- [ ] Publish to GitHub Pages behind a custom path.

**Exit:** type an address anywhere on Earth, descend from orbit, and land over the correct buildings with an honest readout, in the first ten seconds.

## 1 — Corridors

- [ ] Route request between the previous fix and the acquired target (OSRM demo first), rendered as an animated pulse along real roads.
- [ ] `COMMENCE NAVIGATION? Y/N` becomes live: range and arrival window from the routed distance and duration.
- [ ] Transport mode switch (car, bike, foot) staged as a reconfiguration sequence, with the route re-planned on real networks.
- [ ] Route readout shows the router's own distance and duration; no smoothing that changes the numbers.

**Exit:** a route to Selgis follows the real roads and the arrival window is what the router said.

## 2 — Contours and terrain

- [ ] Contour lines generated client side from the terrain tiles at close zooms.
- [ ] Orbital descent sweeps the Alps with relief exaggeration that returns to 1.0 before any elevation readout.
- [ ] Peak targets (`TERRAIN FEATURE`) acquire from a bearing that shows the prominence.

**Exit:** the Jungfrau looks like a reactor complex and the elevation on the readout matches the official figure within the tile resolution.

## 3 — Consequence overlays and labs

A generic overlay system: give it a coordinate and a set of geodesic zones and it renders them with maximum strategic ceremony. The first overlay set is the NukeMap sidequest.

- [ ] Overlay contract: a centre, an ordered list of geodesic rings or polygons, each with a label, a colour role and a stated uncertainty.
- [ ] Blast model as a pure, unit-tested module against published Glasstone & Dolan reference values: fireball radius, overpressure bands (20, 5, 1 psi), thermal radiation (third-degree burns), prompt radiation (500 rem).
- [x] Fallout lab at `#/lab/fallout`: Glasstone & Dolan idealized unit-time contours (Table 9.93) under a chosen wind and fission fraction, decay integrated to a chosen hour, population and acute deaths from the HYDE grid via polygon exposure in the worker. Air bursts produce no early fallout, so the proof gained a burst switch: in surface mode the overpressure rings take the contact-burst radii, the plume grows downwind on the clock, and the outcome log gains a fallout line at four days.
- [x] Population exposure lab at `#/lab/population`: HYDE 3.3 grids (1961, 2023) in a worker, OTA 1979 blast bands against a Postol fire bound, two-number readout, cells drawn under the rings.
- [x] Validate against Hiroshima and Nagasaki: [docs/VALIDATION.md](docs/VALIDATION.md). Planar radii within about 10 percent at Hiroshima; the blast-only method reproduces the 1946 counts and the fire bound the end-of-1945 count with the survey's density; Nagasaki fails by two to three times because of terrain; HYDE cannot resolve a city at kiloton scale.
- [ ] A finer historical population grid, or documented city densities, for kiloton-scale studies; GHSL for finer contemporary resolution.
- [x] Terrain-shock lab at `#/lab/terrain`: line-of-sight shadow from the burst over AWS terrain tiles, a 2D acoustic wave with the blocking faces as reflectors, and a terrain factor against a flat run; Nagasaki, Hiroshima and Tsar Bomba presets. Finding: shadowing hides 3 percent of Nagasaki's 5 psi disc, so the valley confinement is a blast and fire effect; see [VALIDATION.md](docs/VALIDATION.md).
- [x] Structure-class correction, tried and refused by the record: scaling the bands to the 3 psi Japanese collapse pressure reaches the end-of-1945 total by doubling near-field mortality the survey does not support, because the DCPA fractions were fitted to Hiroshima already. Kept as an exploratory control in the population lab; see [VALIDATION.md](docs/VALIDATION.md).
- [ ] Nonlinear shock over terrain, if ever: a Mach-stem-capable solver, out of scope for a browser lab.
- [ ] Yield and height-of-burst selection staged as a configuration sequence.
- [ ] This contemporary single-weapon case is the base case for every later execution study and the thing most people use NUKEMAP for; it uses the present-day GHSL population grid, while historical studies swap in HYDE.

**Exit:** the circles are calculated effects, the readout states the model and its limits, and the local Aldi's overpressure band is correct for the chosen yield.

The labs live in `lab/` as self-contained specimens with a pure model module, a validation table and a declared fidelity ceiling. The [SIOP//62 brief](docs/SIOP-62.md#labs-programme) lists them: ballistic arc, bomber sortie, readiness clock, damage expectancy, prompt effects, terrain shock, fallout plume, fire spread, population exposure and the evidence grammar. Labs exist to establish the lines of the possible, not to ship.

## 4 — SIOP//62 execution study

The first historical execution study. Brief and source audit: [docs/SIOP-62.md](docs/SIOP-62.md).

- [x] Evidence contract: every entity carries a tier (documented, reconstructed, inferred, modelled, withheld) and a source reference; the renderer derives its line grammar from the tier. Lab at `#/lab/evidence`.
- [x] Transcribe the 1956 SAC city list (306 image-only pages) with OCR and a row-grammar parser: first pass complete, 1,691 complex rows and 8,875 category rows with confidence flags.
- [ ] Verify the transcript: work the 3,032 unparsed lines, the low-confidence rows and the out-of-box coordinates; check coordinates against 1960 borders and a hand-checked sample.
- [ ] Order of battle as data: bases, squadrons, boats, weapons and yields for mid-1961, each row cited.
- [ ] Period layers: 1960 borders with precision shown; HYDE 1960 population grid.
- [x] Bounded proof at `#/study/siop62`: F.E. Warren, a Chrome Dome sortie on a reconstructed route, Anadyr from the 1956 list with its redaction, one modelled Atlas D flight and prompt effects, the population ghost; the clock runs from H-hour and the camera descends to the target at impact.
- [x] Study clock as a shared engine module for every later study: `src/engine` holds the clock and timed tracks; models live in `src/models` with their validation tests.
- [x] Readiness lab at `#/lab/readiness`: the fourteen execution options as a force-generation curve, force tables by command, reaction times, sequence, posture and DEFCON, with the chart-versus-table disagreement on the alert force kept visible.
- [ ] Alert force enactment: option 1, 1,004 systems, missiles first, forward areas second, US-based last.
- [ ] Full force with the option selector, and the finding that the options barely differ.
- [x] Two-number outcome readout at impact: blast-only by the 1961 method against the mass-fire bound, computed in a worker from HYDE 1961.

**Exit:** the alert force plays end to end, every mark traces to a page, disagreements between sources are visible on the readout, and the study never claims to know more than the record.

Candidate studies after SIOP//62, each needing its own brief first: Able Archer 83 gone hot, India–Pakistan after Toon and Robock (2019), the Korean peninsula. See [Beyond SIOP//62](docs/SIOP-62.md#beyond-siop62).

## 5 — Publication

- [ ] Own routing host or a licensed provider before public launch; the demo servers are for development only.
- [ ] Tile and terrain budgets measured on a phone for the opening orbit and one descent.
- [ ] Attribution and licence audit for every service in the table above.
- [ ] Catalogue entry in Motion Studies as an adjunct, not an edition.
