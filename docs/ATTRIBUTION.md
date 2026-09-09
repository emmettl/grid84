# Attribution and licence audit

Every service and dataset the published site touches, what its terms ask, where the site meets them, and what was changed on 9 September 2026 to close the gaps found. The site is non-commercial and is published at `https://motionstudies.app/grid84/` and `https://emmettl.github.io/grid84/`.

## Live services

| Service | Terms | Where credited | Status |
| --- | --- | --- | --- |
| OpenFreeMap vector tiles (`tiles.openfreemap.org/planet`) | Attribution required: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"; no request limits, commercial use allowed | The tile server's TileJSON carries the credit and MapLibre's attribution control shows it on every map; the front page lists it | Met. The control was collapsed by default on every width; it now opens by default on wide maps and collapses only on narrow ones, as the OpenStreetMap Foundation guidelines ask. In the studies and labs the control sat under the omissions panel; the panels now end above it |
| OpenStreetMap data (through the tiles and through Photon) | ODbL: "© OpenStreetMap contributors" with a link to the copyright page | In the control's credit and on the front page. Derived designations such as `SUPPLY NODE` are shown, not redistributed | Met |
| AWS terrain tiles (Mapzen/Tilezen Terrarium, `elevation-tiles-prod`) | Attribution required to the blended sources; the Tilezen attribution page lists a statement for each | The map's terrain source carried "Terrain: Mapzen, AWS Terrain Tiles", shown only while relief was in view; the terrain lab reads the same tiles outside MapLibre and showed nothing | Fixed. A terrain credit is now on every map at all times, linking to the full per-source list on the front page under Data and licences |
| Photon geocoder (`photon.komoot.io`) | "Please be fair"; extensive use throttled; no availability guarantee; data © OpenStreetMap contributors | Front page; the atlas HUD names Photon by komoot | Met. One request per acquisition; no batching |
| Cloudflare R2 (`grid84-grids` bucket) | The site's own storage for the prepared GHSL tiles | Not a data source; the grids index names the bucket | Nothing to credit |
| Cloudflare Web Analytics | Cookieless page-view counts; no personal data stored | Front page under Data and licences | Stated |
| Google Fonts | Loading a stylesheet from `fonts.googleapis.com` sends each visitor's address to Google, which the Munich Regional Court held in 2022 to need consent | Was loaded from Google on every page | Fixed. DM Mono (SIL Open Font Licence 1.1) is now served from the site through `@fontsource/dm-mono`; no font request leaves the origin |

## Datasets

| Dataset | Terms | Where credited | Status |
| --- | --- | --- | --- |
| HYDE 3.3 population grids (Utrecht University) | CC BY-NC-SA 4.0 as recorded in the download metadata (the DOI landing page refuses automated fetches): attribution, non-commercial, share-alike, changes indicated | Population lab grid panel (name, year, licence); study readouts now carry the licence beside the grid name; front page; README; each grid's JSON carries the citation | Met. The prepared grids are the published 5 arc-minute cells re-encoded as float32, not resampled, as the JSON states; the site is non-commercial; redistribution of the prepared grids carries the same terms |
| GHSL GHS-POP R2023A (European Commission JRC) | CC BY 4.0 under the European Commission reuse notice: "reuse is authorised, provided the source is acknowledged"; the portal prescribes a citation with DOI and PID | As HYDE; the front page carries the prescribed citation with DOI and PID | Met. The tiles are a re-tiling of the 30 arc-second product; the tile metadata says so |
| SIOP//62 documents, the 1956 SAC weapons requirements study, FRUS 1969–76 vol. XXV, the SHAPE Able Archer report, the 1973 DCPA manual through OTA 1979 | United States government works, public domain; released through the National Security Archive and the Office of the Historian | Cited page by page in the briefs and on every mark's provenance panel | Met |
| Home Office and Square Leg figures, as reported by Campbell, *War Plan UK* (1982) and Openshaw, Steadman and Greene, *Doomsday* (1983); Strath (1955) | Published books and a released Cabinet paper; the site quotes figures and cites them, and reproduces no text | Briefs and provenance panels | Met. The Square Leg bomb plot itself is withheld and the site draws a rule from the totals, saying so |
| Norris and Kristensen, *Nuclear Notebook*; Cochran, Arkin and Hoenig, *Nuclear Weapons Databook*; Chang and Kornbluh, *The Cuban Missile Crisis, 1962* | Published scholarship; figures cited | Briefs and provenance panels | Met |
| Wikipedia unit lists (B-47 and B-52 units, USAF stations, ROC groups, Regional Seats of Government, Soviet formations) | Text is CC BY-SA 4.0; the site takes locations and unit facts, not prose, and names the article on each entry | Provenance panels and the order-of-battle scripts | Met. No article text is reproduced |
| NUKEMAP (Alex Wellerstein) and the Newsweek reports quoting it | Published figures used for comparison and cited; the method is described in the FAQ the site links | Population lab comparison panel; `docs/VALIDATION.md` | Met |

## Software

| Package | Licence | Status |
| --- | --- | --- |
| MapLibre GL JS | BSD-3-Clause | Named on the front page and here; the licence text travels with the package |
| React | MIT | Listed on the front page |
| DM Mono | SIL Open Font Licence 1.1 | Served from the site; listed on the front page |

## Not yet resolved

- The HYDE licence should be confirmed against the Utrecht data portal by hand, since the portal blocks automated reads. The download metadata says CC BY-NC-SA 4.0 and the site treats it as such.
- The terrain credit names the largest sources and links to the full list; the Tilezen page does not say whether a short form is acceptable. The full list is one click from every map.
- Routing, when it comes, will need its own line here; the demo servers are for development only.
