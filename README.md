# Grid 84 

```
SurfaceStudies presents
TERMINAL ATLAS
GRID/84 GLOBAL CARTOGRAPHIC SYSTEM
```

## Manifesto

Grid/84 is a world-state playback engine turned on the history and doctrine of strategic nuclear weapons. It takes a plan, a crisis, an exercise or a scenario from the record, puts every element of it on real geography, and plays it out on its own clock: the launch sites and the targets, the arcs and the routes, the detonations, the fires and the plumes, and the people under them. Every mark carries its evidence. Every readout states its method. What the record withholds is drawn as withheld.

It began as a joke about a navigation tool with an inappropriate emotional register, and the joke is preserved below because it still governs the style. What emerged in the first day of work is a different thing tonally, and this is its statement.

**The tension in the material.** The documents this engine reads are calm. The 1956 target study lists cities by priority with a category code for population. The execution options of 1961 are a table of weapons per hour of preparation. The Home Office's estimate of 1980 rounds the dead to the nearest half million and moves on to the regional seats of government. The film and the book of the present decade give their timelines in minute marks. The people who wrote these documents were, by their own lights, careful, technically enthusiastic and doing their jobs, and their boosters, if the pun is forgiven, wrote in the same register. What the documents describe is the end of cities. The engine does not resolve that tension and does not editorialise it. It adopts the voice of its subject, does the arithmetic in the same calm the planners used, and lets the sum at the bottom of the readout speak. The horror is not stated anywhere on the page. It is in the number, and in the fact that the number was computed by the method the planners themselves would have recognised.

**God-like distance, bureaucratic calm.** The camera sits in orbit. The type is the type of a terminal. The clock runs at sixty times life or six hundred. Nothing on the page raises its voice, and nothing is dramatised beyond what the geometry gives: an arc that leaves the surface because a minimum-energy trajectory does, a flash because a detonation is bright, a plume because the wind was from the south. The distance is the point. It is the distance the plans were written from, and the engine holds the reader there and does not let them look away from what the distance was for.

**Impractical, never fake.** Nothing on the map is invented. Where the record gives a fact, it is drawn as documented and cited to the page. Where a fact follows from documented facts by a stated method, it is reconstructed. Where something is plausible but not evidenced for the plan in hand, it is inferred, and the mark says so. Where a model produces a number, the model is named with its inputs. Where the record exists and is redacted, or was never released, the mark says that too, and the engine draws a rule from the totals rather than a guess dressed as a fact. This grammar is the whole ethics of the work. A study never claims to know more than the record, and it never claims to know what would happen. It says: here is what the plan said, here is the arithmetic, here is where the sources disagree.

**What it is not.** It is not a simulator that predicts. It is not an argument for or against anything, though the reader may draw one. It is not a game, and the clock's RUN button is not a launch. It is a way of reading documents that were written to be unreadable in the way that matters, by putting them on the ground they were written about, at the scale they were written at.

**The spectacle, deferred.** The original manifesto wanted a globe that descends through wireframe canyons and designates the local supermarket a supply node. That strand is not dead, and the atlas at `#/atlas` still idles in that register. But the ceremony the studies needed turned out to be a different ceremony: the evidence grammar itself, the arcs, the fade of a trail, the flash, the plume on the wind, the silhouette of a bomber turned to its heading. Whether the corridors and the contours and the seven-second descent are folded into the studies or kept as a toy beside them is an open question the roadmap takes up. For now the rule stands: it need not be pleasant to use, but it must work, and it must never lie.

### Where it started, 9 September 2026

The original manifesto, kept as written.

Grid/84 is an exploration of data as theatre. It is the expression of the primacy of the Rule Of Cool. 
What makes it more than a toy is the fact that it has to *work*.  It may not be practical, but it is not *fake*. 

It exists as an adjunct of the MotionStudies project, but with a stronger emphasis on spectacle rather than insight. 

A quote: 
"An impractical map may insist on flying the camera through a glowing wireframe canyon, drawing every road as a pulsing vector conduit and presenting Zürich HB as though it were the primary reactor complex of an orbital weapons platform. But when you search for your actual address, it must find it. When you zoom into Oerlikon, the buildings must be in the right places. When you request a route to Selgis, it must follow real roads.
That factual substrate is what converts aesthetic nonsense into an instrument.
A fictional sci-fi map merely says, “Look, here is some futuristic-looking geometry.” A real-world map says, “Your local Migros has now been designated SUPPLY NODE ZH-0447,” which is vastly funnier and more compelling because the grandeur is being applied to something true and mundane."

More succinctly put: Anywhere on Earth. Real geography. Indefensibly dramatic presentation. 

It needn’t be pleasant to use. It can take seven seconds to descend from orbit, sweep over the Alps and acquire the selected target. It can require the user to accept that ordinary map labels are beneath it. It can draw a route as an animated green pulse and make changing transport mode feel like reconfiguring a planetary logistics network.

It is the unholy love child of a TomTom and a Trident missile targeting computer. 

That is the product pitch. Google Maps provides the omniscience; the Trident targeting computer provides the emotional register.
A consumer navigation tool burdened with completely inappropriate apocalyptic significance:
DESTINATION ACQUIRED
CHNUSPERHÜSLI
RANGE: 14.7 KM
ARRIVAL WINDOW: 12:43–12:51
COMMENCE NAVIGATION? Y/N

It contains an important sidequest: recreate NukeMap. 

What use is finding your local Aldi if you can't model the overpressure effect of a proximal 150kt airbust on it?

And again, the “must actually work” rule matters. The circles cannot merely look threatening; they need to represent calculated effects:
- fireball radius;
- overpressure bands;
- thermal radiation;
- prompt radiation;
- fallout plume under selectable winds;
- population exposure, with appropriately enormous uncertainty.

Architecturally, it could begin innocently as a generic consequence-overlay system: give it a coordinate plus a set of geodesic zones and it renders them with maximum strategic ceremony. Routing uses corridors; elevation uses contours; the NukeMap side quest supplies blast and fallout models.

## Development

Use Node 24 or later and npm 11.19.0. Run `npm ci`, then `npm run dev` for the site at `http://127.0.0.1:4184/`: the front page at `#/`, the chronicle at `#/chronicle` with the posture atlas at `#/chronicle/posture`, the loop at `#/loop`, the atlas at `#/atlas`, the studies under `#/study/` and the labs under `#/lab/`.

- `npm run typecheck`, `npm run lint` and `npm test` verify the workspace.
- `npm run build` writes the static site to `dist/`.
- Pushes to `main` run the checks and deploy `dist/` to GitHub Pages at [emmettl.github.io/grid84](https://emmettl.github.io/grid84/) and, as a Cloudflare Worker with static assets, to [grid84.app](https://grid84.app/) (`.github/workflows/pages.yml`, `wrangler.jsonc`; see [docs/HOSTING.md](docs/HOSTING.md)). The build ships the HYDE study grids and drops the local GHSL tiles, which the site reads from the R2 bucket named in the grids index.

Grid/84 is a standalone repository with its own domain. It borrows the [Motion Studies](https://github.com/emmettl/motionstudies) toolchain and ethos but not its timetable packages, and it is not one of its editions: every edition there is a bounded, pre-compiled study, whereas this atlas answers for anywhere on Earth through live open services. See the [roadmap](ROADMAP.md) for stages and the services each one depends on, and the [SIOP//62 brief](docs/SIOP-62.md) for the first execution study.

## Sources

- Geometry: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, served as [OpenFreeMap](https://openfreemap.org/) vector tiles.
- Terrain: [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) on AWS Open Data.
- Geocoding: [Photon](https://photon.komoot.io/) by komoot.
- Population: [HYDE 3.3](https://doi.org/10.24416/UU01-AEZZIT) (Utrecht University, CC BY-NC-SA 4.0) for the study years, and [GHSL GHS-POP R2023A](https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE) (European Commission JRC, CC BY 4.0) at 30 arc seconds for 1975, 1985 and the present, prepared by the scripts under `scripts/` and served from a Cloudflare R2 bucket named in `public/data/hyde/index.json`; the tiles are not committed. HYDE's licence is non-commercial and share-alike: the published site is non-commercial, names the dataset and its licence on every readout that uses it, and any redistribution of the prepared grids carries the same terms.

Every service and dataset is audited against its terms in [ATTRIBUTION.md](docs/ATTRIBUTION.md). Nothing on the map is invented. The ceremony is applied to real geometry; a designation such as `SUPPLY NODE CH-0447` is derived deterministically from the OpenStreetMap feature it decorates.
