# Grid 84 

```
SurfaceStudies presents
TERMINAL ATLAS
GRID/84 GLOBAL CARTOGRAPHIC SYSTEM
```

## Introduction/Manifesto

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

Use Node 24 or later and npm 11.19.0. Run `npm ci`, then `npm run dev` for the atlas at `http://127.0.0.1:4184/`.

- `npm run typecheck`, `npm run lint` and `npm test` verify the workspace.
- `npm run build` writes the static site to `dist/`.

Grid/84 is a standalone repository. It borrows the [Motion Studies](https://github.com/emmettl/motionstudies) toolchain and ethos but not its timetable packages: every edition there is a bounded, pre-compiled study, whereas this atlas answers for anywhere on Earth through live open services. See the [roadmap](ROADMAP.md) for stages and the services each one depends on, and the [SIOP//62 brief](docs/SIOP-62.md) for the first execution study.

## Sources

- Geometry: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, served as [OpenFreeMap](https://openfreemap.org/) vector tiles.
- Terrain: [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) on AWS Open Data.
- Geocoding: [Photon](https://photon.komoot.io/) by komoot.
- Population: [HYDE 3.3](https://doi.org/10.24416/UU01-AEZZIT) (Utrecht University, CC BY-NC-SA 4.0) for the study years, and [GHSL GHS-POP R2023A](https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE) (European Commission JRC, CC BY 4.0) at 30 arc seconds for the present, prepared locally by the scripts under `scripts/`.

Nothing on the map is invented. The ceremony is applied to real geometry; a designation such as `SUPPLY NODE CH-0447` is derived deterministically from the OpenStreetMap feature it decorates.
