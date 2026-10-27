# Roadmap

[Manifesto](README.md#manifesto) · [Sources](README.md#sources) · [SIOP//62 brief](docs/SIOP-62.md)

Grid/84 is a world-state playback engine turned on the history and doctrine of strategic nuclear weapons. The Terminal Atlas is the engine idling with one entity, the camera; the studies add thousands, each with provenance. It is an art-and-data instrument. Each stage should end in a coherent, viewable study rather than a long period of invisible infrastructure. Two rules govern every stage:

1. **Impractical, never fake.** Every readout is computed from real geometry or a documented model. Where a value is uncertain, say so on the readout; never decorate a guess as a fact.
2. **Ordinary map labels are beneath it.** The atlas names things through its own designations. If a stage needs labels for legibility, they are the atlas's labels, in the atlas's register.

No calendar dates are implied. Each stage names its exit criterion and the live services it depends on.

## Taking stock, 27 October 2026

The core instrument is built. The studies became the centre, with the engine, labs, chronicle and atlas serving them. Work now falls into evidence checks, the next complete study, performance measurement and care. The original stages below remain a record of the work, not the order of the next releases. Dates here record progress; they are not delivery promises.

### Built

- **The studies and their engine.** SIOP//62, Cuba, DEFCON 3 and the 1969 readiness test, Able Archer, Britain and Strath, Seventy-two minutes, the 1983 window of vulnerability, the V-force and the four theatre scenarios. The Soviet response of 1961 reads the enacted strike: a base is lost when a delivered American weapon arrives within 30 km before its generation time. The [Sino-Soviet study](docs/SINO-SOVIET-69.md) is also built at `#/study/sino-soviet-1969`, testing a 1969 strike on the Chinese nuclear complex.
- **The chronicle and posture atlas.** `#/chronicle` carries stockpiles, posture, doctrine, basing, treaties, theatre and missile defence. `#/chronicle/posture` has eight epochs: 1956, 1961, 1962, 1967, 1973, 1983, 1991 and 2024, with provenance and radar coverage. The 1991 epoch is built; the intervening drawdown years remain. See [DOCTRINE.md](docs/DOCTRINE.md).
- **The labs and live demonstrations.** Effects, exposure, terrain, fallout, cloud, evidence, accuracy, guidance and defence have working views. `#/impact` draws individual misses against real installations; `#/intercept` runs individual engagements from the intercept geometry and countermeasures. See [INTERCEPT.md](docs/INTERCEPT.md) and [VALIDATION.md](docs/VALIDATION.md).
- **The years after.** `#/winter` connects soot to a zonal climate model, crops and food availability over fifteen years, with assumptions and fidelity limits exposed. This is an implemented model chain, with published reference cases, rather than a prediction. See [WINTER.md](docs/WINTER.md).
- **WOPR.** `#/wopr` searches the 1983 posture with a target-by-weapon exposure matrix, assignments by category, seeded annealing, constraints and competing objectives. Its aftermath readout converts the matrix's fire deaths into soot and interpolates climate and food outcomes; those outcomes are outside the loss function. Fallout, fratricide and C3 degradation remain excluded. See [WOPR.md](docs/WOPR.md).
- **The strike console.** `#/atlas` selects delivery from nine arsenals, derives an urban laydown from the 2025 grid, fetches wind aloft and hands a generated study to the engine. Shared strikes have links and preview cards. Land-use identification and more than one missile type per strike remain open. See [STRIKE.md](docs/STRIKE.md).
- **Publication and recent hardening.** Deployment is configured for GitHub Pages and `grid84.app`, with GHSL tiles on R2 at `tiles.grid84.app`. October's work updated dependencies and setup guidance, fixed atlas panels and boundary races, added browser regressions and PR checks, and split routes, study panels and styles. Routes and study datasets load on demand; the browser suite checks the initial JavaScript budget and recovery from a failed route download. CI runs type, lint, unit, build and browser checks before deployment.

### Next milestone — India–Pakistan

The [brief](docs/INDIA-PAKISTAN.md) and `data/india-pakistan/cities-2025.json` are committed. `scripts/build-india-pakistan-2025.py` assigns named cities by the geocoder's country code and ranks them by population within a stated radius on the 2025 GHSL grid. The execution study is not built.

- [x] Brief the Toon et al. (2019) comparison and prepare country-checked urban targets on the 2025 grid.
- [ ] Build the 250-detonation study with the paper's weapon counts and its three yield cases, keeping the allocation rule and evidence tiers visible.
- [ ] Compute union blast and fire outcomes and a study-wide soot total; connect that output to the winter view. WOPR's aftermath readout is an existing connection, but it does not provide this study's per-detonation calculation.
- [ ] Compare the engine's fatalities and soot with the paper's published figures; record agreement or disagreement and its limits in the brief and validation notes.
- [ ] Measure phone transfer and terrain costs alongside the study, including the opening orbit and one atlas descent.

**Exit:** a reader can run all three yield cases, inspect the target rule, compare the immediate and soot totals with the paper, and follow the computed soot into the years-after model without mistaking published inputs for engine outputs.

### Evidence and model work

These remain active alongside the next milestone; access-dependent research is not a prerequisite for shipping it.

- [ ] Hand-review the 1956 transcription: 351 airfield rows and 2,787 city-list lines remain unparsed, mostly from damaged scans. This needs a person with the scans.
- [ ] Check the Seventy-two minutes book's minute marks against the text and record outcome sums in the brief from a visible run.
- [ ] Obtain the JIC target papers for Britain and the Square Leg plot if access opens. Until then the totals-based reconstruction stays labelled as such.
- [ ] Replace illustrative guidance error-budget magnitudes with values checked against MacKenzie's text; the lab currently marks them as illustrations.
- [ ] Extend the V-force with dispersal-airfield geometry and defences as entities rather than an attrition fraction.
- [ ] Fill posture gaps, including the years of drawdown between 1991 and 2024; treaty-driven changes on the map remain work beyond the chart's treaty markers.

The blast reference tests and the NUKEMAP burst-height convention check are complete; the validation notes state their limits.

Further candidates, each needing its own brief:

- **The Korean peninsula:** the conventional-to-nuclear escalation ladder.
- **The Strath Report:** its reasoning beyond the existing scenario, as a state doing this arithmetic on itself.
- **Civil defence:** films and pamphlets read as documents with plans behind them.

### Engine, mobile performance and care

- [x] Broker population tile downloads across each exposure-worker pool: concurrent requests share one fetch and a 32 MiB download cache retains recent tiles. Workers keep their own decoded grids; eviction can require a later refetch. Failed downloads can retry, and destroying the pool cancels its fetches.
- [x] Establish a repeatable mobile-emulated baseline for the front page, orbit, descent and a large study, with completed transfer counts and worker-memory inspection; record provisional budgets in [MOBILE-PERFORMANCE.md](docs/MOBILE-PERFORMANCE.md).
- [x] Defer hillshade below the same zoom-9 threshold as 3D terrain: three mobile-emulated opening samples fell from 4.04 MB to 0.96 MB of completed responses, with zero DEM requests in orbit and terrain retained on descent.
- [x] Keep dense population grids in one exposure worker, retaining the requested pool for tiled grids. Three 60-second SIOP//62 mobile-emulated samples reduced exposure-worker backing storage from 149.34 MB to 37.34 MB; dense batch parallelism is traded for memory, with full-run throughput still to measure.
- [ ] Set measured transfer and terrain budgets on a real phone. Phone layouts and automated phone/tablet scrolling regressions are built; these do not establish a network or terrain budget.
- [ ] Confirm the HYDE licence by hand on the source portal and keep attribution notes current as services change.
- [ ] Add the Motion Studies catalogue entry as an adjunct, not an edition.

The generic overlay contract remains deferred until a study needs zones other than detonations. Contours and further descent spectacle remain the original atlas strand, outside the next study's critical path.

**Standing exit criterion:** a reader arriving at the front page understands in one screen what the instrument is and what it is not, and every study they open holds to the evidence grammar.

## Services

| Concern | Service | Terms | Status |
| --- | --- | --- | --- |
| Vector geometry (roads, rail, water, buildings, boundaries) | [OpenFreeMap](https://openfreemap.org/) planet tiles, OpenMapTiles schema | Free, no key, OSM attribution | In use |
| Terrain and elevation | [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), Terrarium encoding | Free, Mapzen attribution | In use |
| Geocoding | [Photon](https://photon.komoot.io/) public instance | Fair use, no key | In use |
| Contours | `maplibre-contour` from the terrain tiles | Client side | Deferred; stage 2 |
| Population | HYDE 3.3 grids (Utrecht), prepared by `scripts/prepare-hyde-grid.py`; the study years are committed, other years prepare locally in seconds. GHSL GHS-POP at 30 arc seconds for the present, cut into ten-degree tiles by `scripts/prepare-ghsl-tiles.py` and fetched on demand by the exposure worker | HYDE CC BY-NC-SA 4.0, behind a bot check, manual download; GHSL CC BY 4.0, manual download | In use: GHS-POP 1975, 1985 and 2025 prepared, 334 tiles and about 170 MB per year, served from R2; the studies from 1973 on read them |

## Record of stages

The original sequence is retained below. The stock-taking above sets current priorities; unchecked items here may be deferred or explicitly out of scope.

### 0 — Target acquisition

- [x] Establish the Vite, React, TypeScript, oxlint and Vitest baseline from Motion Studies.
- [x] Hash routes: `#/` front page, `#/atlas` atlas, `#/study/<id>` execution studies, `#/lab/<id>` labs.
- [x] Globe in orbital standby with the Grid/84 style: dark ink, cyan conduits, amber rail, wireframe building footprints, hillshaded relief, no labels.
- [x] Photon search with candidate list and Enter-to-acquire.
- [x] Seven-second descent from orbit to the target, pitched along the line of flight, with terrain enabled below the orbital threshold.
- [x] Acquisition readout: designation role and code, grid reference, range and bearing from the previous fix, terrain elevation.
- [x] Reduced-motion path: no rotation, jump instead of fly.
- [x] Rank candidates so a station or settlement outranks a guidepost of the same name: `src/atlas/rank.ts` sorts Photon's list by what kind of thing each candidate is, on the rule that a feature which exists to point at another feature ranks below the feature it points at. "Zürich HB" now gives the Hauptbahnhof, "Heathrow" the aerodrome and "Cheyenne Mountain" the NORAD complex. Nothing is filtered; only the order changes.
- [ ] Verify the descent on a real phone and set the first transfer budget for the opening view.
- [x] Contract test for the geocoder: five real Photon responses recorded 11 September 2026 in `src/atlas/__fixtures__/photon-responses.json`, each parsed and checked for the fields the atlas needs, so a field renamed upstream shows up as a parse returning nothing.
- [x] Publication path built (see 5 — Publication): GitHub Pages and `grid84.app`; the former Motion Studies sub-path edition is retired.

**Exit:** type an address anywhere on Earth, descend from orbit, and land over the correct buildings with an honest readout, in the first ten seconds.

### 2 — Contours and terrain

- [ ] Contour lines generated client side from the terrain tiles at close zooms.
- [ ] Orbital descent sweeps the Alps with relief exaggeration that returns to 1.0 before any elevation readout.
- [ ] Peak targets (`TERRAIN FEATURE`) acquire from a bearing that shows the prominence.

**Exit:** the Jungfrau looks like a reactor complex and the elevation on the readout matches the official figure within the tile resolution.

### 3 — Consequence overlays and labs

A generic overlay system: give it a coordinate and a set of geodesic zones and it renders them with maximum strategic ceremony. The first overlay set is the NukeMap sidequest.

- [ ] Overlay contract: a centre, an ordered list of geodesic rings or polygons, each with a label, a colour role and a stated uncertainty.
- [x] Blast model as a pure, unit-tested module against published reference values (`src/models/blast.test.ts`): the FAQ constants at 1 kt and their cube-root scaling, the fireball at 1 kt and 1.44 Mt, thermal against the book's own tabulated second-degree ranges and their scaling with yield, initial radiation against the worked case of §8.34 and the tenth-range rule, and the contact-burst fit against Kinney & Graham within 15 percent across the band. The crossings are held too: where the prompt-radiation ring passes inside the blast ring, and where the fireball first touches the ground at the hard-target height.
- [x] Fallout lab at `#/lab/fallout`: Glasstone & Dolan idealized unit-time contours (Table 9.93) under a chosen wind and fission fraction, decay integrated to a chosen hour, population and acute deaths from the HYDE grid via polygon exposure in the worker. Air bursts produce no early fallout, so the proof gained a burst switch: in surface mode the overpressure rings take the contact-burst radii, the plume grows downwind on the clock, and the outcome log gains a fallout line at four days.
- [x] Population exposure lab at `#/lab/population`: HYDE 3.3 grids (1961, 2023) in a worker, OTA 1979 blast bands against a Postol fire bound, two-number readout, cells drawn under the rings.
- [x] Validate against Hiroshima and Nagasaki: [docs/VALIDATION.md](docs/VALIDATION.md). Planar radii within about 10 percent at Hiroshima; the blast-only method reproduces the 1946 counts and the fire bound the end-of-1945 count with the survey's density; Nagasaki fails by two to three times because of terrain; HYDE cannot resolve a city at kiloton scale.
- [x] GHSL for finer contemporary resolution: a tiled grid format (`TiledPopulationGrid`), a window cut around each request so the exposure functions run unchanged, the lab's grid switch reading indexed paths, and the tiler proved on a synthetic GeoTIFF. GHS-POP 1975, 1985 and 2025 are prepared; DEFCON 3, Able Archer and Square Leg read the 30-arc-second grids and the earlier studies stay on HYDE, which has nothing finer before 1975. A finer historical grid for kiloton-scale studies remains open.
- [x] Terrain-shock lab at `#/lab/terrain`: line-of-sight shadow from the burst over AWS terrain tiles, a 2D acoustic wave with the blocking faces as reflectors, and a terrain factor against a flat run; Nagasaki, Hiroshima and Tsar Bomba presets. Finding: shadowing hides 3 percent of Nagasaki's 5 psi disc, so the valley confinement is a blast and fire effect; see [VALIDATION.md](docs/VALIDATION.md).
- [x] Structure-class correction, tried and refused by the record: scaling the bands to the 3 psi Japanese collapse pressure reaches the end-of-1945 total by doubling near-field mortality the survey does not support, because the DCPA fractions were fitted to Hiroshima already. Kept as an exploratory control in the population lab; see [VALIDATION.md](docs/VALIDATION.md).
- [x] Cloud lab at `#/lab/cloud`: the stabilized cloud's top, base and head radius against yield from Glasstone & Dolan Figure 2.16 (§§2.15–2.17), drawn in plan over real ground and in elevation against the tropopause, which moves with the latitude of the burst. It is here for one thing: a cloud that stabilises inside the troposphere puts its activity where the weather is and it comes down over a county within a day, which is the plume Table 9.93 already draws; one that goes through puts part of it where nothing washes it out. Figure 2.16 is a figure and not a table, so the readout says it uses a fit to Glasstone and not Glasstone, and where the book gives no rule — the base of a head that penetrates — it reads NO RULE GIVEN.
- [ ] Nonlinear shock over terrain, if ever: a Mach-stem-capable solver, out of scope for a browser lab.
- [ ] Yield and height-of-burst selection staged as a configuration sequence.
- [x] This contemporary single-weapon case is the population lab with the GHSL grid selected: click the ground, choose the yield, read the two numbers over 30-arc-second cells; historical studies swap in HYDE.
- [x] NUKEMAP comparison: eight published runs as one-click cases in the lab with NUKEMAP's figures and rings beside the lab's; the method is the same, the 5 psi ring differs by a third in radius through the burst-height convention, and the large-yield case agrees within a fifth. Recorded in [VALIDATION.md](docs/VALIDATION.md#nukemap-comparison).

**Exit:** the circles are calculated effects, the readout states the model and its limits, and the local Aldi's overpressure band is correct for the chosen yield.

The labs live in `src/lab/` as self-contained specimens with a pure model module, a validation table and a declared fidelity ceiling. The [SIOP//62 brief](docs/SIOP-62.md#labs-programme) lists them: ballistic arc, bomber sortie, readiness clock, damage expectancy, prompt effects, terrain shock, fallout plume, fire spread, population exposure and the evidence grammar. Labs exist to establish the lines of the possible, not to ship.

### 4 — SIOP//62 execution study

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

#### Studies after SIOP//62

The original candidates have mostly become working studies. Each has its own brief; current next steps are listed in the stock-taking above.

| Study | Status | Scope and variants | Brief |
| --- | --- | --- | --- |
| **Cuban missile crisis** | Built | `#/study/cuba-62`: the air strike, R-12 regiments, FKRs, landings and Lunas on one clock. `/general` adds the option-14 force at DEFCON 2. | [Cuba 1962](docs/CUBA-62.md) |
| **DEFCON 3** | Built | `#/study/defcon3-73`: the October 1973 alert. `/execute` enacts SIOP-4 against Soviet launch on warning; `/1969` runs the secret readiness test and Giant Lance. | [DEFCON 3](docs/DEFCON3-73.md) |
| **Able Archer 83** | Built | `#/study/able-archer-83`: the exercise week, Soviet alert, strike on NATO's delivery means and answer from the surviving force. | [Able Archer](docs/ABLE-ARCHER-83.md) |
| **Protect and Survive: Britain** | Built | `#/study/britain-80`: Square Leg's withheld plot reconstructed from the documented totals, timing and wind, with the competing casualty estimates beside the engine's. `/strath` adds the 1955 case. | [Britain](docs/BRITAIN-80.md) |
| **Seventy-two minutes** | Built; text verification open | `#/study/72-minutes`: the film's missile and three interceptor assumptions. `/jacobsen` runs the book's clock on the 2024 forces and 2025 grid; its minute marks still need checking against the text. | [Seventy-two minutes](docs/72-MINUTES.md) |
| **The window of vulnerability** | Built | `#/study/window-83`: a Soviet counterforce first strike in 1983, with ride-out and launch-under-attack as the acts. | [Window 1983](docs/WINDOW-83.md) |
| **The Sino-Soviet strike question** | Built | `#/study/sino-soviet-1969`: a 1969 strike on the Chinese nuclear complex, testing what the surgery would take and whether it would work. | [Sino-Soviet 1969](docs/SINO-SOVIET-69.md) |
| **India–Pakistan** | Brief and target data prepared | Toon et al. (2019) on the 2025 grid. The execution study and comparison of fatalities and soot remain the next milestone. | [India–Pakistan](docs/INDIA-PAKISTAN.md) |
| **The Korean peninsula** | Candidate; brief needed | The conventional-to-nuclear escalation ladder. | — |

See [Beyond SIOP//62](docs/SIOP-62.md#beyond-siop62).

### 5 — Publication

- [x] GHSL tiles on Cloudflare R2: bucket `grid84-grids`, public at `tiles.grid84.app` (a custom domain on the bucket; the r2.dev URL still answers) with a CORS rule allowing GET from any origin, the 1,002 immutable tiles uploaded by `deploy/upload-ghsl-r2.sh` with a year's cache lifetime. The grids index names the bucket, `scripts/point-grids-at.py` switches it back to local, and the lab and the studies resolve their grids through the index. The bucket custom domain is in use.
- [x] Publication path: `pages.yml` checks, builds and deploys to GitHub Pages at `emmettl.github.io/grid84`, and deploys the same artifact to `grid84.app` as a Cloudflare Worker with static assets when the token secret is present (`wrangler.jsonc`, [HOSTING.md](docs/HOSTING.md)); the Motion Studies sub-path edition was retired on 10 September 2026.
- [ ] Tile and terrain budgets measured on a phone for the opening orbit and one descent.
- [x] Attribution and licence audit for every service and dataset: [ATTRIBUTION.md](docs/ATTRIBUTION.md). It found the map credit hidden under the study panels and collapsed by default, the terrain credit absent from the terrain lab, and fonts fetched from Google; all three fixed, and the study readouts now carry the grid's licence.
- [x] Aircraft draw as a silhouette turned to the track's heading, in both renderers (`src/map/plane-icon.ts`); missiles, ships and landing forces stay rings. The reconstructed tier is a colour of its own, lilac, drawn solid: the dashes read as noise across a thousand tracks. Trails fade to nothing. Phones get a one-column study layout with the map in the middle.
- [x] Front page at `#/`: what the engine is, the six studies with their variants and briefs, the evidence grammar, the method in one paragraph with a link to the validation notes, the labs, and the data with its licences. The atlas moved to `#/atlas`.
- [ ] Catalogue entry in Motion Studies as an adjunct, not an edition.
