# Roadmap

[Manifesto](README.md#introductionmanifesto) · [Sources](README.md#sources)

Grid/84 is an art-and-data instrument. Each stage should end in a coherent, viewable study rather than a long period of invisible infrastructure. Two rules govern every stage:

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
| Population | GHSL population grid | Free, JRC attribution; needs tiling | Stage 3 |

## 0 — Target acquisition (now)

- [x] Establish the Vite, React, TypeScript, oxlint and Vitest baseline from Motion Studies.
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

## 3 — Consequence overlays

A generic overlay system: give it a coordinate and a set of geodesic zones and it renders them with maximum strategic ceremony. The first overlay set is the NukeMap sidequest.

- [ ] Overlay contract: a centre, an ordered list of geodesic rings or polygons, each with a label, a colour role and a stated uncertainty.
- [ ] Blast model as a pure, unit-tested module against published Glasstone & Dolan reference values: fireball radius, overpressure bands (20, 5, 1 psi), thermal radiation (third-degree burns), prompt radiation (500 rem).
- [ ] Fallout plume under selectable wind speed and direction, WSEG-10 style, drawn as a geodesic polygon.
- [ ] Population exposure from the GHSL grid, reported with its enormous uncertainty on the readout.
- [ ] Yield and height-of-burst selection staged as a configuration sequence.

**Exit:** the circles are calculated effects, the readout states the model and its limits, and the local Aldi's overpressure band is correct for the chosen yield.

## 4 — Publication

- [ ] Own routing host or a licensed provider before public launch; the demo servers are for development only.
- [ ] Tile and terrain budgets measured on a phone for the opening orbit and one descent.
- [ ] Attribution and licence audit for every service in the table above.
- [ ] Catalogue entry in Motion Studies as an adjunct, not an edition.
