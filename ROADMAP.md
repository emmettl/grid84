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
| Population | HYDE 3.3 grids (Utrecht), prepared by `scripts/prepare-hyde-grid.py`; the study years are committed, other years prepare locally in seconds. GHSL GHS-POP at 30 arc seconds for the present, cut into ten-degree tiles by `scripts/prepare-ghsl-tiles.py` and fetched on demand by the exposure worker | HYDE CC BY-NC-SA 4.0, behind a bot check, manual download; GHSL CC BY 4.0, manual download | In use: GHS-POP 1975, 1985 and 2025 prepared, 334 tiles and about 170 MB each, kept local; the studies from 1973 on read them |

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
- [x] GHSL for finer contemporary resolution: a tiled grid format (`TiledPopulationGrid`), a window cut around each request so the exposure functions run unchanged, the lab's grid switch reading indexed paths, and the tiler proved on a synthetic GeoTIFF. GHS-POP 1975, 1985 and 2025 are prepared; DEFCON 3, Able Archer and Square Leg read the 30-arc-second grids and the earlier studies stay on HYDE, which has nothing finer before 1975. A finer historical grid for kiloton-scale studies remains open.
- [x] Terrain-shock lab at `#/lab/terrain`: line-of-sight shadow from the burst over AWS terrain tiles, a 2D acoustic wave with the blocking faces as reflectors, and a terrain factor against a flat run; Nagasaki, Hiroshima and Tsar Bomba presets. Finding: shadowing hides 3 percent of Nagasaki's 5 psi disc, so the valley confinement is a blast and fire effect; see [VALIDATION.md](docs/VALIDATION.md).
- [x] Structure-class correction, tried and refused by the record: scaling the bands to the 3 psi Japanese collapse pressure reaches the end-of-1945 total by doubling near-field mortality the survey does not support, because the DCPA fractions were fitted to Hiroshima already. Kept as an exploratory control in the population lab; see [VALIDATION.md](docs/VALIDATION.md).
- [ ] Nonlinear shock over terrain, if ever: a Mach-stem-capable solver, out of scope for a browser lab.
- [ ] Yield and height-of-burst selection staged as a configuration sequence.
- [x] This contemporary single-weapon case is the population lab with the GHSL grid selected: click the ground, choose the yield, read the two numbers over 30-arc-second cells; historical studies swap in HYDE.
- [x] NUKEMAP comparison: eight published runs as one-click cases in the lab with NUKEMAP's figures and rings beside the lab's; the method is the same, the 5 psi ring differs by a third in radius through the burst-height convention, and the large-yield case agrees within a fifth. Recorded in [VALIDATION.md](docs/VALIDATION.md#nukemap-comparison).

**Exit:** the circles are calculated effects, the readout states the model and its limits, and the local Aldi's overpressure band is correct for the chosen yield.

The labs live in `lab/` as self-contained specimens with a pure model module, a validation table and a declared fidelity ceiling. The [SIOP//62 brief](docs/SIOP-62.md#labs-programme) lists them: ballistic arc, bomber sortie, readiness clock, damage expectancy, prompt effects, terrain shock, fallout plume, fire spread, population exposure and the evidence grammar. Labs exist to establish the lines of the possible, not to ship.

## 4 — SIOP//62 execution study

The first historical execution study. Brief and source audit: [docs/SIOP-62.md](docs/SIOP-62.md).

- [x] Evidence contract: every entity carries a tier (documented, reconstructed, inferred, modelled, withheld) and a source reference; the renderer derives its line grammar from the tier. Lab at `#/lab/evidence`.
- [x] Transcribe the 1956 SAC city list (306 image-only pages) with OCR and a row-grammar parser: first pass complete, 1,691 complex rows and 8,875 category rows with confidence flags.
- [ ] Verify the transcript: work the 3,032 unparsed lines, the low-confidence rows and the out-of-box coordinates; check coordinates against 1960 borders and a hand-checked sample.
- [x] Order of battle as data: `data/siop62/order-of-battle-1961.json`, 71 launch sites with sources and position evidence.
- [ ] Period layers: 1960 borders with precision shown; HYDE 1960 population grid.
- [x] Bounded proof at `#/study/siop62`: F.E. Warren, a Chrome Dome sortie on a reconstructed route, Anadyr from the 1956 list with its redaction, one modelled Atlas D flight and prompt effects, the population ghost; the clock runs from H-hour and the camera descends to the target at impact.
- [x] Study clock as a shared engine module for every later study: `src/engine` holds the clock and timed tracks; models live in `src/models` with their validation tests.
- [x] Readiness lab at `#/lab/readiness`: the fourteen execution options as a force-generation curve, force tables by command, reaction times, sequence, posture and DEFCON, with the chart-versus-table disagreement on the alert force kept visible.
- [x] Alert force enactment at `#/study/siop62-alert`: 1,591 weapons from 71 documented launch sites to the 863 prioritised 1956 complexes, missiles first, bombers over the pole for fifteen hours, the outcome summed over HYDE 1961 in four workers against the JCS's 80 million. Order of battle built by script from unit lists; every assignment inferred by one stated rule.
- [x] Transcribe the 1956 airfield list, third pass: 598 rows read from section 6, 442 high-confidence airfields with priorities and coordinates in `data/siop62/airfields-1956-priority.json`; the alert force now strikes airfields first, as the study's own task order says. About half the release's 1,100 airfields remain to be read.
- [x] Transcribe the category code list (section 3) to `data/siop62/categories-1956.json`; every target now carries its category names, and the proof's Anadyr row reads them.
- [x] Second and third passes on both lists: separators read as quotes or digits, look-alike letters inside numbers, glued lowercase tails. 351 airfield rows and 2,787 city-list lines remain unparsed, mostly heavily damaged scans; a hand pass is the next step, not another regex.
- [x] Attrition model: reliability by system with Atlas documented, bomber penetration solved so the force averages the documented 85 percent assurance; lost sorties end on their routes. Refuelling tracks remain open.
- [x] Soviet response: documented 1961 force levels (Sagan Table 4), 10 percent bomber ground alert, six inferred Long Range Aviation fields, generation coupled to the US strikes, SAC sites and the ten largest 1960 cities as inferred targets, US air defence assumed at one half; sums per side against the 1961 estimates of American dead.
- [x] Refuelling: North American bombers route through the Chrome Dome refuelling areas (Newfoundland's BLACK GOAT, Alaska, Spain, the Pacific) with a ten-minute hold; areas documented, the choice per sortie reconstructed.
- [x] MIRVs and multi-weapon bombers as vehicles: the builder groups a launcher's allocated warheads into missiles whose targets lie within a footprint of the first (300 km by default) and bombers whose targets lie within a leg of each other (600 km), draws one boost arc that splits into its reentry vehicles after post-boost and one aircraft visiting its targets in turn, and applies reliability per vehicle so a failed missile takes every warhead with it. Summaries count vehicles as well as weapons.
- [x] Suborbital trajectories: ballistic sorties carry a height per waypoint from the minimum-energy model's apogee, the vertex buffers carry it as an attribute, and the shaders project through MapLibre's `projectTileFor3D`, metres above the sphere on the globe and metres through the custom-layer matrix on the plane, with the horizon clip applied to the elevated position. Any study whose tracks leave the surface draws through the WebGL layer, and the vehicle labels ride the arc: the layer keeps the last frame's projection and mirrors the shader's height projection on the CPU, and the view lifts each elevated label by that screen offset every frame.
- [x] WebGL track layer (`src/map/track-layer.ts`): studies with more than 100 tracks draw flown paths and vehicles from static vertex buffers through MapLibre's custom-layer projection, so the globe, the mercator fallback and their transition all come from MapLibre's own shader prelude. The alert force's 1,729 tracks cost 1–6 ms of main-thread time per update and 1–3 ms to draw, against 65–95 ms to build the equivalent GeoJSON features before MapLibre even re-tiles them. Rings, areas and flashes stay GeoJSON but are rewritten only when they change. Dev builds expose `window.__grid84Perf`.
  The earlier "300× effective" figure was an artefact of measuring in a hidden browser tab, where animation frames run twice a second and the clock's one-second cap drops the rest; a visible tab runs at the requested rate. World copies are not drawn under mercator, so a track crossing the antimeridian at high zoom shows on one side only.
- [x] Full force with the option selector: `#/study/siop62-alert/<n>` plays any of the fourteen options, each launcher generated on a straight line from the alert tables to the generated tables by stated per-system rules (24 of 78 ICBMs, two of five Polaris boats, every bomber by fourteen hours). Option 14 comes to 3,267 weapons and 188 ballistic missiles, Table 3's figures exactly. The finding is on the readout and in the brief: every option strikes the same 1,312 targets on the same timetable; preparation time only adds weapons per target, two to three, and megatons, 1,555 to 3,345 with Mk-28s assumed.
- [x] Generic strike builder (`src/studies/strike.ts`): allocation by rule with per-target weapon caps, a timed track per weapon, attrition by hash or calibrated to a documented assurance, cruise routes through refuelling areas by hook, a burst and plume assumption per target, one compact effect per target. Every strike in every study runs through it, the SIOP//62 alert force and its Soviet response included.
- [x] Urban targets derived from the population grid where no list is in the record (`scripts/derive-urban-targets.py`): the most populous cells by a stated rule, labelled modelled.
- [x] Union outcome: each side's headline is a union over the grid, every sample claimed once by the most severe band any detonation reaches it with, flagged for fire, and dosed by the highest plume once it has fallen; deaths taken in sequence per sample, blast, then fire as Postol's bound, then fallout among the survivors, with a combined cell for all three. The per-target sums stay in the log. The Britain fallout figure fell from 8 million summed per plume to a survivors' figure, and the alert force's blast headline from 61 to 53 million.
- [x] Detonation flashes: a radial white burst in wall time through the WebGL layer when the running clock crosses a detonation, sized by yield; the layer is present in every study, and draws reconstructed routes as a long dash and inferred ones as a faint solid line, since one-pixel dots shimmered.
- [x] Two-number outcome readout at impact: blast-only by the 1961 method against the mass-fire bound, computed in a worker from HYDE 1961.

**Exit:** the alert force plays end to end, every mark traces to a page, disagreements between sources are visible on the readout, and the study never claims to know more than the record.

Candidate studies after SIOP//62, each needing its own brief first: the Cuban missile crisis gone hot ([brief](docs/CUBA-62.md); **built** at `#/study/cuba-62`: the air strike, the R-12 regiments on Florida and the south-east, the FKRs on Guantánamo, the landings and the Lunas on one clock, and `#/study/cuba-62/general`, the option-14 force standing for the month at DEFCON 2), DEFCON 3 in October 1973 as a force-posture study of the seventies, with the 1969 readiness test as its second act ([brief](docs/DEFCON3-73.md); **built** at `#/study/defcon3-73`: the ladder of the night from the Foreign Relations volume's own documents, both orders of battle by script from unit histories, and `#/study/defcon3-73/execute`, SIOP-4 enacted with that force by the NUWEP-74 categories as a rule against a Soviet launch on warning; and `#/study/defcon3-73/1969`, the secret readiness test with Giant Lance's eighteen B-52s over Alaska), Able Archer 83 gone hot as the European theatre war ([brief](docs/ABLE-ARCHER-83.md); **built** at `#/study/able-archer-83`: the exercise week from the SHAPE report, the Soviet alert as the NID reports it, and on the last morning the strike on NATO's delivery means and the answer from what survives, which the first twenty minutes decide), Protect and Survive: Britain ([brief](docs/BRITAIN-80.md); **built** at `#/study/britain-80` with Strath at `/strath`: the withheld plot drawn by a stated rule from the documented totals, timing and wind, 57 plumes north over the island, the Home Office's and Openshaw's figures beside the engine's): Square Leg's 150 weapons and 280 Mt of September 1980, the Home Office's 8.5 million against Openshaw, Steadman and Greene's 29 million, Strath's twelve million of 1955, the regional bunkers, and the Warsaw Pact's Seven Days to the River Rhine with Britain left blank, India–Pakistan after Toon and Robock (2019), the Korean peninsula. See [Beyond SIOP//62](docs/SIOP-62.md#beyond-siop62).

## 5 — Publication

- [x] GHSL tiles on Cloudflare R2: bucket `grid84-grids`, public through its r2.dev URL with a CORS rule allowing GET from any origin, the 1,002 immutable tiles uploaded by `deploy/upload-ghsl-r2.sh` with a year's cache lifetime. The grids index names the bucket, `scripts/point-grids-at.py` switches it back to local, and the lab and the studies resolve their grids through the index. A custom domain in front of the bucket is a later nicety.
- [ ] Own routing host or a licensed provider before public launch; the demo servers are for development only.
- [ ] Tile and terrain budgets measured on a phone for the opening orbit and one descent.
- [ ] Attribution and licence audit for every service in the table above.
- [ ] Catalogue entry in Motion Studies as an adjunct, not an edition.
