# The strike console

**The atlas takes a place name and vectors a strike onto it.** Built 10 September 2026 from the user's proposal: the theatrical version of the modern single-strike case, and the nukemap-and-then-some aspect of the instrument. It reads the 2025 grid, reasons aloud in the WOPR's register, counts down, and hands the strike to the study engine, which draws the inbound path, the bus and its reentry vehicles, the rings, the exposure and the plume as it does for the documented studies.

## The flow

1. **The prompt.** `> ENTER TARGET` with a blinking block; Photon geocodes the place from OpenStreetMap and the atlas descends on it as before.
2. **The grid.** One exposure worker reads the population within 2, 5, 10, 20 and 30 km of the target from GHSL 2025 (the R2 bucket at `tiles.grid84.app`).
3. **Identification.** The geocoder's tags first: a military tag is counterforce and hard; an airfield, a port, a power plant, an industrial site or a seat of government is a point target. Otherwise the density profile: annuli above 800 people per km² out from the centre give the urban radius, and a place with an urban radius of five kilometres or 300,000 within ten is urban-industrial, countervalue; a town is struck as one area; anything less as a point. (Land-use grids would refine this; HYDE's are on disk and not yet prepared.)
4. **The adversary.** A stated rule by country: NATO and its neighbours to Russia; Russia and China to the United States; Japan and Korea to North Korea; India to Pakistan west of the Siliguri corridor and China east of it; Pakistan to India; Iran and Israel's declared enemies to Israel; Taiwan, Guam and the Pacific to China; anywhere else to the nearest arsenal that reaches it, which the console calls a fallback. The reader can overrule it with the nine buttons.
5. **The delivery.** Every launch point of that power in `data/atlas/forces-2025.json` (bases public, patrol areas guessed, loads and yields of the opaque arsenals inferred, Israel's withheld) is tried; those in range are sorted ballistic before cruise and by flight time, so Warsaw draws an Iskander from Kaliningrad in minutes and New York a Yars or a Bulava in half an hour. The top options are printed.
6. **The weapon, sized for effect.** The 5 psi radius of one warhead at the chosen burst, against the urban radius: enough discs to tile the area, capped at two missiles' loads; hard points take one on the surface. Aim points fall in a sunflower spaced so the discs meet, the planner's laydown, and the engine's MIRV grouping puts them on one bus where the load allows.
7. **The wind.** Open-Meteo's forecast at 850 hPa for the hour, with the surface wind beside it; a westerly at fifteen miles an hour if the service is not reached, and the console says which.
8. **The countdown** from ten, with hold, vector now, and stand down.
9. **The study.** Surface burst by default so the plume is drawn, with the console saying doctrine would airburst a city and the readout can show it; further reading links to the 72 minutes, the fallout and accuracy labs, the chronicle and the sources.

## Honesty

The adversary and the weapon are a heuristic and are printed as one, line by line, with the rule that produced each. Nothing here is a plan on record. The forces file is one entry per system and place, not a count; the file says so. No attrition, no defence, no warning.

## Files

`src/atlas/forces.ts`, `adversary.ts`, `solver.ts` (classify, deliveryOptions, sizeWeapon, planStrike), `profile.ts`, `wind.ts`, `strike-study.ts`, `StrikeConsole.tsx`; `scripts/build-forces-2025.py`; tests in `solver.test.ts` and `strike-study.test.ts`. `StudyView` gained `autoplay` and studies gained `links`.
