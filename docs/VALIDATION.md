# Validation against Hiroshima and Nagasaki

[SIOP//62 brief](SIOP-62.md) · [Roadmap](../ROADMAP.md) · Test: [`src/models/validation.test.ts`](../src/models/validation.test.ts) · Lab: `#/lab/population`, validation cases

Hiroshima and Nagasaki are the only detonations with recorded outcomes, so they are the only place the effects and exposure chain can be checked against events rather than against other models. Every recorded figure below is in [`validation-cases.ts`](../src/models/validation-cases.ts) with its source; every model figure is computed by the test, which prints this table.

## Inputs

| | Hiroshima | Nagasaki | Source |
| --- | --- | --- | --- |
| Yield | 15 kt, outside limits ±20% | 21 kt, ±10% | Malik, LA-8819 (1985) |
| Burst height | 600 m | 503 m | RERF FAQ |
| Population at attack | 245,000 (USSBS) · 255,000 (MED) · 340,000–350,000 (RERF, with military and labourers) | 195,000 (MED) · 250,000–270,000 (RERF) | as stated |
| Dead | 66,000 immediate (MED) · 70,000–80,000 (USSBS) · 90,000–166,000 to four months (RERF) · about 140,000 to 31 Dec 1945 (City of Hiroshima) | 39,000 (MED) · 35,000–40,000 (USSBS) · 60,000–80,000 (RERF) | as stated |
| Injured | 69,000 (MED) · about equal to the dead (USSBS) | 25,000 (MED) · about equal to the dead (USSBS) | as stated |

The sources disagree by a factor of two on the dead. The disagreement is mostly about what is counted: immediate deaths in June 1946, or acute deaths through the end of 1945.

## Radii: planar model against recorded damage

| City | Comparison | Model | Recorded | Ratio |
| --- | --- | --- | --- | --- |
| Hiroshima | 5 psi against "almost everything up to about one mile from X was completely destroyed" | 1.75 km | 1.61 km | 1.09 |
| Hiroshima | 5 psi against steel-frame severe damage to 5,700 ft | 1.75 km | 1.74 km | 1.01 |
| Hiroshima | 2 psi against all Japanese homes destroyed within 1.5 miles | 3.30 km | 2.41 km | 1.37 |
| Hiroshima | Third-degree burn radius against fire, mean radius 6,000 ft | 2.03 km | 1.83 km | 1.11 |
| Hiroshima | Third-degree burn radius against the 4.4 sq mi burned-out area as a circle | 2.03 km | 1.90 km | 1.07 |
| Hiroshima | 2 psi against complete window damage to 12,000 ft | 3.30 km | 3.66 km | 0.90 |
| Nagasaki | 5 psi against "nearly everything within ½ mile" destroyed | 1.96 km | 0.80 km | 2.43 |
| Nagasaki | 5 psi against steel-frame severe damage to 6,000 ft | 1.96 km | 1.83 km | 1.07 |
| Nagasaki | 2 psi against all Japanese homes destroyed within 1.5 miles | 3.69 km | 2.41 km | 1.53 |
| Nagasaki | Third-degree burn radius against the 1.8 sq mi devastated area as a circle | 2.33 km | 1.22 km | 1.92 |

**Reading.** At Hiroshima the planar radii for severe blast damage and for fire land within about 10 percent of the record. The 2 psi radius overstates the "all homes destroyed" distance by a third, which says that Japanese wooden houses of 1945 did not survive to 2 psi as the American criterion assumes, not that the pressure was wrong. At Nagasaki the steel-frame radius still matches, but every areal comparison fails by a factor of two: the survey's own explanation is that "the uneven terrain of the city confined the maximum intensity of damage to the valley over which the bomb exploded". A planar model cannot know that. This is the case for the terrain-shock lab.

## Fatality fractions: OTA bands against the mortality-by-distance table

The British Mission's calculated mortality by distance (MED chapter 10, table C), set against the OTA 1979 blast-only fraction at the same distance for 15 kt:

| Distance | Recorded | OTA band |
| --- | --- | --- |
| 0–305 m | 93.0% | 98% |
| 305–610 m | 92.0% | 98% |
| 610–914 m | 86.0% | 98% |
| 914–1,219 m | 69.0% | 50% |
| 1,219–1,524 m | 49.0% | 50% |
| 1,524–1,829 m | 31.5% | 50% |
| 1,829–2,134 m | 12.5% | 5% |
| 2,134–2,438 m | 1.3% | 5% |
| 2,438–2,743 m | 0.5% | 5% |
| 2,743–3,048 m | 0.0% | 5% |

Area-weighted inside the 5 psi radius of 1.75 km the model gives 65.1 percent and the record 59.9 percent. The step function crosses the recorded slope four times and integrates to roughly the right answer. That is what a calibration looks like: the DCPA curves were fitted to this data, so this is consistency with the source, not independent confirmation.

## Totals: the planners' method with the survey's own density

The MED says 75 percent of Hiroshima's population lived in the 7 square miles that were completely built up. Treating that as a disc of uniform density about the hypocentre and applying the OTA bands:

| Population assumed | Density | Blast-only dead | Injured | Fire bound (Postol) |
| --- | --- | --- | --- | --- |
| 245,000 (USSBS) | 10,135 /km² | 67,800 | 66,200 | 131,700 |
| 255,000 (MED) | 10,549 /km² | 70,600 | 68,900 | 137,100 |
| 340,000–350,000 (RERF) | 14,272 /km² | 95,500 | 93,200 | 185,400 |

The blast-only method with the 1946 population figures returns 68,000 to 71,000 dead and 66,000 to 69,000 injured against the 1946 counts of 66,000 to 80,000 dead and 69,000 injured. The fire bound with the same inputs returns 132,000 to 137,000 against the City of Hiroshima's roughly 140,000 by the end of 1945. The two numbers on the readout are, at Hiroshima, the immediate count and the end-of-year count. The 1961 planners were computing the first and calling it the answer.

At Nagasaki the same arithmetic with the MED's 195,000 gives 131,600 blast-only dead against a recorded 35,000 to 40,000. The disc assumption puts the whole city under the bomb; in fact the main city lay behind a mountain spur to the south and the valley took the blast. The model is not wrong about pressure; it is wrong about where people were.

## Resolution: HYDE 1940 at the scale of a 15 kt weapon

| City | HYDE 1940 within 5 km | Blast-only dead from the grid | Injured | Fire bound |
| --- | --- | --- | --- | --- |
| Hiroshima | 124,500 | 9,400 | 41,700 | 31,300 |
| Nagasaki | 134,500 | 18,100 | 58,600 | 40,800 |

A 5-arc-minute cell at 34°N is 7.6 by 9.3 km. Hiroshima's built-up area was about 18 km², so the city occupies a fraction of one or two cells and the grid spreads it over ten. Within 5 km of the hypocentre HYDE holds half the recorded population; within the 5 psi radius, a small fraction. The grid understates the blast-only dead by seven times. This is the resolution finding: HYDE is adequate for megaton weapons on 1961 cities, where the rings are tens of kilometres across, and not for kiloton weapons on 1945 cities. A finer historical grid or a documented density is needed at that scale, and the lab now says so beside the numbers.

## What this validates, and what it does not

- The planar blast and thermal radii reproduce Hiroshima's recorded damage distances within about 10 percent for severe damage and fire.
- The OTA fatality fractions integrate to the recorded fraction inside the 5 psi radius, because they were derived from it.
- The blast-only method reproduces the immediate counts at Hiroshima and the fire bound reproduces the end-of-1945 count, given the survey's density. This is a check of the arithmetic, on the one city that is close to a uniform disc.
- Nothing here validates the planar model where terrain matters, and Nagasaki shows how much that can be: a factor of two in area and three in deaths.
- Nothing here validates the grid at kiloton scale.
