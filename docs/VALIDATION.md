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

## Terrain: what the shadow and the wave say about Nagasaki

The terrain lab (`#/lab/terrain`) puts the Nagasaki burst, 21 kt at 503 m, over the AWS terrain tiles resampled to 53 m cells.

| Quantity | Value |
| --- | --- |
| Ground in the box | −71 to 482 m above sea level; burst at 510 m |
| Visible from the burst, within the 5 psi radius (1.96 km) | 97% |
| Visible within the 2 psi radius (3.69 km) | 75% |
| Unshadowed 5 psi area | 11.7 of 12.1 km², against 4.7 km² of near-complete devastation recorded by the USSBS |
| Mean terrain factor from the acoustic run, within 5 psi | ×1.00 |
| Mean terrain factor within 2 psi | ×0.60 |

**Reading.** Geometric shadowing does not explain Nagasaki, and Glasstone says as much: §3.36, "shielding from blast effects behind the brow of a large hill is not dependent upon line-of-sight considerations", and §3.37, "little reduction in blast damage to structures may be expected" from terrain, while §3.35 describes the spike at the base of a hill facing the burst and the reduction over the crest, which is the reflection and shadow pattern the acoustic run draws. From a burst 500 m up, hills of 200 to 400 m a kilometre or two away hide only 3 percent of the ground inside the 5 psi radius; the thermal flash reached almost all of it. So the confinement the survey describes is a blast and fire phenomenon, not a line-of-sight one. The acoustic run points the same way: reflections off the valley walls hold the peak inside the valley at about the flat-ground level while the ground beyond the ridges drops to six tenths, which is the survey's sentence drawn as a map. It is not a measurement. The wave is linear, two-dimensional and stopped at the edge of the box; it cannot produce the Mach stem that carries a real shock along a valley floor, and it knows nothing of the wooden houses that burned. The lab's contribution is to rule out the cheap explanation and to show where a real solver would have to work.

Structure class is the other half. "All Japanese homes destroyed" at 2.4 km against a 2 psi radius of 3.3 km is the American masonry criterion applied to a wooden city, and the OTA fractions were fitted to these two cities and no others. A structure-class correction belongs beside terrain as the second departure from the planar model.

## Structure class: a correction the record refuses

Glasstone and Dolan §5.53: Japanese-style wooden dwellings "collapsed at distances up to 7,500 feet (1.4 miles) from ground zero, where the peak overpressure was estimated to be about 3 pounds per square inch". The American test houses of 1953 and 1955 collapsed or were damaged beyond repair at 5 psi (§5.57, §5.67), which is the collapse pressure the OTA bands assume. The obvious correction scales the band thresholds by 3/5, so that the Japanese city's people are counted at the pressures at which their houses fell.

| Hiroshima, 15 kt, MED density | Blast-only dead | Injured |
| --- | --- | --- |
| OTA bands as published (collapse at 5 psi) | 70,600 | 68,900 |
| Bands scaled to a 3 psi collapse | 125,800 | 52,600 |

The scaled total lands between the RERF and City of Hiroshima end-of-1945 figures, which looks like a success until the mortality-by-distance table is consulted:

| Distance | Recorded | OTA as published | Scaled to 3 psi |
| --- | --- | --- | --- |
| 914–1,219 m | 69.0% | 50% | 98% |
| 1,219–1,524 m | 49.0% | 50% | 98% |
| 1,524–1,829 m | 31.5% | 50% | 50% |
| 1,829–2,134 m | 12.5% | 5% | 50% |
| 2,134–2,438 m | 1.3% | 5% | 50% |

Inside the scaled collapse radius of 2.47 km the scaled model gives an area-weighted 64.9 percent dead against a recorded 34.4 percent; the unscaled bands give a figure within a tenth of the record. The correction reaches the right total by killing the wrong people: it doubles the near-field mortality that the record does not support, and the extra deaths it produces are the fire and radiation deaths that the blast-only method cannot see, arrived at by a different route.

The reason is that the DCPA curves were fitted to these two cities. Their pressure labels are labels; the fractions already embed the Japanese houses. A structure correction on top double counts, and the test now asserts that it does. The class remains in the lab as an exploratory control, badged inferred, for building stock the record cannot calibrate, and the readout says when it is off the baseline. For the 1961 Soviet cities of SIOP//62 the honest position is to leave the bands as published and state that their building stock is not in the calibration.

## NUKEMAP comparison

NUKEMAP's casualty method is this engine's: the DCPA bands of 1973 as reprinted in OTA 1979, applied to the overpressure rings, with no shielding and no thermal or radiation count. A difference between the two is therefore a difference of rings, of population data, or of ground zero. NUKEMAP sums LandScan 2011 ambient population; the lab sums GHSL residential population for 2025. The published runs are Newsweek's of 30 October 2025, a W88 of 455 kt air burst over seven cities, and of 16 May 2022, the Tsar Bomba over New York; neither states its ground zero, so the city's geocoded centre stands for it. The lab's numbers are the population lab on the 2025 grid, blast only.

| City, W88 455 kt air burst | NUKEMAP dead | Lab dead | Ratio | NUKEMAP injured | Lab injured | Ratio |
| --- | --- | --- | --- | --- | --- | --- |
| Moscow | 507,500 | 952,842 | ×1.88 | 1,442,990 | 3,340,191 | ×2.31 |
| Beijing | 695,260 | 1,655,853 | ×2.38 | 1,502,500 | 4,156,674 | ×2.77 |
| London | 225,930 | 929,187 | ×4.11 | 202,370 | 2,482,353 | ×12.27 |
| New York | 1,258,610 | 896,596 | ×0.71 | 1,436,630 | 2,395,583 | ×1.67 |
| Los Angeles | 320,580 | 437,236 | ×1.36 | 601,150 | 1,250,854 | ×2.08 |
| Tokyo | 673,950 | 1,201,561 | ×1.78 | 1,752,400 | 3,609,989 | ×2.06 |
| Paris | 1,072,840 | 1,672,735 | ×1.56 | 1,537,060 | 2,518,599 | ×1.64 |
| New York, Tsar Bomba 50 Mt | 7,600,000 | 8,856,454 | ×1.17 | 4,200,000 | 5,147,568 | ×1.23 |

**The rings account for most of it.** NUKEMAP's report quotes its ring areas, which give its radii; the lab's are Glasstone's optimum-height figures.

| 455 kt | NUKEMAP | Lab | Ratio |
| --- | --- | --- | --- |
| Fireball | 0.78 km | 0.71 km | ×0.91 |
| 20 psi | 1.80 km | 2.15 km | ×1.19 |
| 500 rem | 2.17 km | 2.40 km | ×1.11 |
| 5 psi | 4.15 km | 5.46 km | ×1.32 |
| Third-degree burns | 8.62 km | 8.24 km | ×0.96 |
| 1 psi | 15.19 km | 16.92 km | ×1.11 |

The fireball, burn and 1 psi radii agree within ten percent. The 5 psi ring differs by a third in radius and by 73 percent in area, and the 5 to 12 psi band is where the method counts most of its dead, so a lab figure 1.5 to 2 times NUKEMAP's is what the rings alone predict. The lab's 5.46 km is Glasstone's optimum-height 5 psi radius scaled from 1 Mt; NUKEMAP's 4.15 km sits between that and the surface-burst figure of 4.43 km, so its run used a lower burst height than the 5 psi optimum. That is a choice, not an error, on either side, and the lab's panel now shows both sets of rings.

**The rest is population and ground zero.** New York runs below NUKEMAP because LandScan's ambient count puts Manhattan's daytime workers under the rings where a residential grid does not. London runs four times above, with NUKEMAP's injured fewer than its dead, which no set of bands produces from a centred ground zero; the published London run's ground zero must have been off the centre, or on the river. Beijing has grown since 2011. The Tsar Bomba case, where the rings are tens of kilometres and the population is a whole metropolis, agrees within a fifth, which is the comparison that tests the population data rather than the burst height.

**What it validates.** The method is the same and the large-yield case agrees, so the exposure chain is sound; the disagreement at half a megaton is the burst-height convention, which the lab states on every readout as an optimum-height air burst. A NUKEMAP run at the optimum height for 5 psi with a stated ground zero would settle the remaining difference, and the lab's comparison buttons put the cases one click away for anyone with both tools open.

## Shot exchange

The defence lab's model (`src/models/defence.ts`) is the bookkeeping every published assessment of missile defence has used in some form: credible objects are warheads plus the decoys the defender cannot discriminate; each receives the doctrine's shots while interceptors in position last; an engaged warhead is killed with probability 1 − (1 − p)^k; shoot-look-shoot spends the next shot only after a miss; a space layer's absentee ratio divides the stock by the fraction overhead. The cost exchange is Nitze's 1985 criterion in numbers. No intercept physics is modelled.

Checks: two shots at the test record's 12 in 21 give 82 per cent, against the film's 61; four give 97, which is the agency's claim exactly, so the claim is the record with independence assumed; forty-four interceptors in salvos of four engage eleven objects and leak the twelfth onward; ten undiscriminated balloons per warhead (UCS 2000) raise the credible objects elevenfold and the leakage to nearly everything. The reference cases' kill probabilities are the test record where one exists and stated assumptions where none does, and the lab says which on every case.

## Yield and accuracy

The accuracy lab's model (`src/models/lethality.ts`) is the standard single-shot kill rule: the warhead kills if it lands within the radius at which the target's overpressure is reached, and the miss distance is circular normal with median CEP, so P = 1 − 0.5^((r/CEP)²). Radii come from the engine's own blast fits: the optimum-height air burst at 5 psi and below, the contact surface burst above. Checks: a CEP equal to the lethal radius gives exactly one half; Atlas D at 1.44 Mt and 3.7 km has better than a 60 per cent chance against a city and under 10 against a 2,000 psi silo; Trident II at 455 kt and 120 m has better than 90 against the silo; no American system before 1966 reaches an even chance against the silo and the first that does enters service between 1970 and 1986. Yields are the Databook's; CEPs are the open literature's estimates and are tiered as such.

