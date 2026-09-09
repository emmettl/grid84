# SIOP//62

[Manifesto](../README.md#introductionmanifesto) · [Roadmap](../ROADMAP.md) · [Labs programme](#labs-programme)

**An execution study. What if the end of the world had an interface, and someone pressed RUN?**

**Status:** brief, source audit and bounded proof, 9 September 2026. The proof plays at `#/study/siop62`; the evidence-grammar lab at `#/lab/evidence`; the 1956 city list is transcribed to a first pass. See the roadmap.

## What Grid/84 turns out to be

Grid/84 is not fundamentally a mapping application. It is a **world-state playback engine**: a clock, a set of entities whose state changes over that clock, and a globe that renders the state at any instant. The Terminal Atlas is that engine idling with a single entity, the camera. Routing adds moving entities on real networks. SIOP//62 adds thousands of entities, each with a documented origin, a reconstructed path, and a modelled consequence, and asks the engine to play the most consequential timetable ever written.

The distinction from DEFCON is that this is not an abstract strategy game: it is a specific historical plan, on real geography, with real order of battle. The distinction from NUKEMAP is that it does not show one isolated detonation: it attempts to make the plan unfold globally, with readiness states, launches, converging trajectories, designated ground zeros, overlapping effects and the steadily changing state of the world.

The subject is the transformation of apocalypse into systems engineering: targets as records, populations as estimates, cities as overlapping effect radii, annihilation as a progress bar. The study renders that with bureaucratic calm because the calm is what the documents actually sound like.

```
PLAN EXECUTION            00:17:42
OPTION                    1 · ALERT FORCE
WEAPONS COMMITTED         1,685 (JCS 1961) · >1,700 (JCS est. 1961)
DESIGNATED GROUND ZEROS   1,060 · BY COUNTRY: WITHHELD
ASSURANCE                 75% MINIMUM · 85% ACHIEVED · 95% TOP PRIORITY
OUTCOME CALCULATION       IN PROGRESS
```

## The constraint that becomes the visual language

The United States has never declassified any complete SIOP. Historians work from the briefing given to President Kennedy on 13 September 1961, from the planning staff's own excised history, from later reviews, and from an earlier target study that shows the method. The complete plan cannot be reconstructed, and the study must never pretend otherwise.

That incompleteness is the visual language. Every entity carries an evidence tier and a source reference, and the renderer derives its line grammar from the tier. Nothing is drawn without provenance, and provenance is one hover away.

| Tier | Meaning | Rendering | Examples |
| --- | --- | --- | --- |
| **Documented** | Stated in a released primary source, with page reference | Solid geometry | Base locations, squadron strengths, yields, the alert-force totals, the fourteen execution options, target categories and coordinates in the 1956 study |
| **Reconstructed** | Derived from documented facts by a stated method | Broken vectors, dashed | Bomber routes as great circles with refuelling tracks; which 1956 targets survived into the 1961 target list |
| **Inferred** | Plausible from context but not evidenced for this plan | Ghost geometry, low alpha, positional uncertainty ring | A ground zero known only to city level; weapon-to-target assignments |
| **Modelled** | Output of a named physical or statistical model with stated inputs | Solid effect geometry with a model label | Blast rings, thermal radius, fallout plume, population exposure |
| **Withheld** | A record exists and is redacted, or the government has never released it | Blacked-out field, interrupted telemetry, positioned where the document positions it | The by-country breakdown of ground zeros; the weapons column on every page of the 1956 study; the plan itself |

Two rules follow. **Redaction is a datum.** A blacked-out column on a released page proves that a record exists at that position; it renders as a positive mark with its own citation, never as an empty slot. **Disagreement is carried, not resolved.** Where documents give different totals, the readout shows both with their sources. Picking one would be a claim the record does not support.

## The record

### Primary and archival sources

| Source | What it gives the study | Tier |
| --- | --- | --- |
| Scott D. Sagan, ["SIOP-62: The Nuclear War Plan Briefing to President Kennedy"](https://archive.org/details/SIOP62TheNuclearWarPlanBriefingToPresidentKennedy), *International Security* 12:1 (Summer 1987), reproducing the 13 September 1961 briefing | Force totals by command at day-to-day and fully generated alert; the fourteen options and their generation times; 1,060 ground zeros covering 3,729 installations; the targeting sequence; the 75 percent assurance floor; retaliation and preemption modes with alternate missile targets; the 1961 alert posture; the count of bases | Documented |
| National Security Archive, [EBB 236, *New Evidence on the Origins of Overkill*](https://nsarchive2.gwu.edu/nukevault/ebb236/) (2007, updated 2009): the JSTPS history *Background and Preparation of SIOP-62*, excised | 1,043 ground zeros of which 706 in the USSR, the remaining 337 by country still classified; sixteen options with the last assuming 28 hours; delivery assurance averaging 85 percent against the 75 percent floor; radiation exceeding JCS dosage limits | Documented, with a live disagreement against the briefing (see figures) |
| National Security Archive, [EBB 538, *SAC Atomic Weapons Requirements Study for 1959*](https://nsarchive2.gwu.edu/nukevault/ebb538-Cold-War-Nuclear-Target-List-Declassified-First-Ever/) (released 22 December 2015), produced June 1956 | About 800 scanned pages. More than 1,100 airfields with priorities; more than 1,200 urban-industrial areas for "systematic destruction"; 3,400 ground zeros in the unrestricted allocation and 1,209 in the restricted; coordinates in degrees and minutes; target category codes including **category 275, Population**; Moscow with about 180 installations, Leningrad 145, East Berlin 91 ground zeros, Beijing priority 13 with 23 | Documented for 1956; reconstructed as a proxy for the 1961 target list |
| National Security Archive, [EBB 798, *Long-Classified U.S. Estimates of Nuclear War Casualties*](https://nsarchive.gwu.edu/briefing-book/nuclear-vault/2022-07-14/long-classified-us-estimates-nuclear-war-casualties-during) (14 July 2022) | 1961 estimates for a Berlin contingency: 108 million Soviet dead (54 percent) from the full force, 80 million (37 percent) from the alert force, 104 million Chinese; alert force "over 1,700" weapons; a 95 percent assurance factor with some ground zeros assigned multiple weapons; the argument that every estimate was too low because it counted blast alone and omitted fire, fallout, epidemic and starvation | Documented |
| National Security Archive, [EBB 638, *U.S. Nuclear War Plan Option Sought Destruction of China and Soviet Union as "Viable" Societies*](https://nsarchive.gwu.edu/briefing-book/nuclear-vault/2018-08-15/us-nuclear-war-plan-option-sought-destruction-china-soviet-union-viable-societies) (15 August 2018) | Concerns SIOP-64, not 62, but documents the method's continuity: damage expectancy 95 percent for nuclear forces and 90 percent otherwise; the May 1964 arsenal; the requirement for 30 percent Chinese fatalities | Documented context, out of period |
| Fred Kaplan, *The Wizards of Armageddon* (1983); David Alan Rosenberg, "The Origins of Overkill" (1983) and later work, as summarised on [Wikipedia](https://en.wikipedia.org/wiki/Single_Integrated_Operational_Plan) | 3,200 warheads and 7,847 megatons; 285 million dead in the USSR and China; nine weapons on four Leningrad targets, 23 on six Moscow complexes; Shoup's objection on China | Secondary; figures must be traced to the books before use |

### Figures, with their disagreements

| Quantity | Value | Source |
| --- | --- | --- |
| Alert force, 15 July 1961 | 1,004 delivery systems, 1,685 weapons, 1,798 megatons | Briefing via Sagan |
| Alert force | "over 1,700 nuclear weapons" | EBB 798 |
| Fully generated force | 2,244 delivery systems, 3,267 weapons, 7,420 megatons | Briefing via Sagan |
| Fully generated force | 3,200 warheads, 7,847 megatons | Kaplan via Wikipedia |
| Weapons by command, day-to-day / generated | SAC 1,246 / 2,180 · Pacific 84 / 421 · European 178 / 489 · Atlantic 32 / 177 | Briefing via Sagan |
| Ground zeros | 1,060 covering 3,729 installations; about 800 of roughly 1,000 military | Briefing via Sagan |
| Ground zeros | 1,043, of which 706 USSR, 337 withheld by country | JSTPS history, EBB 236 |
| Execution options | 14: option 1 alert; 2 to 13 at preparation times up to 14 hours, with 1,658 systems ready under option 7 at six hours; 14 strategic warning at 14 hours or more | Briefing via Sagan |
| Execution options | 16, the last assuming 28 hours | JSTPS history, EBB 236 |
| Assurance of delivery | 75 percent minimum, approved by Eisenhower 12 February 1960 | Briefing via Sagan |
| Assurance of delivery | 85 percent average achieved | JSTPS history, EBB 236 |
| Assurance | 95 percent for top-priority targets | EBB 798 |
| Alert reaction times | 15 minutes for fixed bases; two hours for submarines and carriers | Sagan, citing JCS 2056/181 |
| Targeting sequence | Ballistic missiles first, forward-area forces second, US-based forces last | Briefing via Sagan |
| 1961 posture | About half the bomber force on 15-minute ground alert, a small airborne alert; 2 of 5 Polaris boats on station; 24 of 78 ICBMs on alert | Sagan |
| 1960 posture | One third of bombers and tankers on 24-hour alert; on 30 June 1960, 113 B-52, 346 B-47, 85 KC-135, 152 KC-97 on alert | SAC history via Wikipedia |
| Bases | 46 SAC bases in the continental US plus Puerto Rico, Newfoundland, Labrador, the United Kingdom, Morocco, Spain and Guam; 112 bases in all used by the plan | Sagan |
| Atlas D and E reliability | About 0.70 to 0.80 | Sagan, citing the 1961 draft memorandum on delivery forces |
| Fatalities, 1961 estimate | 108 million Soviet (full force), 80 million (alert force), 104 million Chinese | EBB 798 |
| Fatalities | 285 million dead, 40 million injured, USSR and China | Kaplan via Wikipedia |

The 14-versus-16 options and 1,060-versus-1,043 ground zeros discrepancies are between the briefing as delivered and the planning staff's own history. Both are primary. The study shows both.

### Order of battle, 1961 to 1962

All of this is documented tier from published unit histories and weapon records, and it is what makes the launches real rather than decorative.

| Element | Detail | Source |
| --- | --- | --- |
| Atlas D | 564th and 565th SMS, F.E. Warren AFB, Wyoming (6 and 9 missiles, from September 1960); 549th SMS, Offutt AFB, Nebraska (9, from March 1961). W49, 1.44 Mt. Raised to vertical and fuelled before launch | [Wikipedia, SM-65 Atlas](https://en.wikipedia.org/wiki/SM-65_Atlas), citing Norris and Cochran, NRDC 1997 |
| Atlas E | 567th SMS, Fairchild AFB, Washington; 548th SMS, Forbes AFB, Kansas; 566th SMS, F.E. Warren (9 each, from late 1961). W38, 3.75 Mt. Horizontal coffins | Same |
| Atlas F | 550th Schilling, 551st Lincoln, 577th Altus, 578th Dyess, 579th Walker, 556th Plattsburgh (12 each, operational September to December 1962). W38. Silos, about ten minutes to launch after fuelling | Same |
| Titan I | Six squadrons at Lowry (two), Ellsworth, Beale, Larson and Mountain Home, 1962. W38, 3.75 Mt; 70 warheads deployed on Titan I | [Wikipedia, W38](https://en.wikipedia.org/wiki/W38_(nuclear_warhead)); squadron histories |
| Polaris A-1 | Five George Washington-class boats in 1961, nine in 1962; 16 missiles each, 1,200 nautical miles, W47 Y1 at 600 kt with severe later reliability findings; North Atlantic patrols; two of five on alert in 1961 | [Nuclear Companion](https://nuclearcompanion.com/data/polaris-missile-deployment-1960-1982/); [Wikipedia, W47](https://en.wikipedia.org/wiki/W47); Sagan |
| Thor | 60 missiles at 20 RAF sites in four wings (Hemswell, Driffield, Feltwell, North Luffenham), 1959 to September 1963. W49, 1.44 Mt, 1,750 miles, about 15 minutes to launch | [Wikipedia, PGM-17 Thor](https://en.wikipedia.org/wiki/PGM-17_Thor) |
| Jupiter | 30 missiles at ten sites around Gioia del Colle, Italy; 15 at five sites near İzmir, Turkey; 1961 to April 1963. W49, 1.44 Mt | [Wikipedia, PGM-19 Jupiter](https://en.wikipedia.org/wiki/PGM-19_Jupiter) |
| Bomber weapons | Mk-28 (70 kt to 1.45 Mt by variant), Mk-39 (3.8 Mt), Mk-15 (1.7 to 3.8 Mt), Mk-36 (6 to 19 Mt, retired 1961), Mk-41 (25 Mt) | [Wikipedia, B28](https://en.wikipedia.org/wiki/B28_nuclear_bomb), [Mark 39](https://en.wikipedia.org/wiki/Mark_39_nuclear_bomb), [list of US weapons](https://en.wikipedia.org/wiki/List_of_nuclear_weapons) |
| Airborne alert | Operation Chrome Dome from 1961: a northern route around Canada past Thule and Alaska, a southern "Mail Pouch" route across the Atlantic to the western Mediterranean, two aircraft monitoring the Thule BMEWS; 12 sorties a day by late 1961; KC-135 refuelling from the northeast US, Alaska and Spain | [Wikipedia, Operation Chrome Dome](https://en.wikipedia.org/wiki/Operation_Chrome_Dome), from RCAF files and SAC histories |

Open: a per-base bomber and tanker count for mid-1961. The Norris and Cochran NRDC tables and SAC unit histories will supply it.

### Literature

The academic record is deep, and the study should stand on it rather than on the archive alone. Titles marked "core" are the ones the evidence contract is built against.

| Work | Why it matters here |
| --- | --- |
| David Alan Rosenberg, "The Origins of Overkill: Nuclear Weapons and American Strategy, 1945–1960," *International Security* 7:4 (1983) | Core. The founding account of how bureaucratic competition and damage criteria produced SIOP-62's scale. The National Security Archive's EBB 130 and 236 are titled after it. |
| Scott D. Sagan, "SIOP-62: The Nuclear War Plan Briefing to President Kennedy," *International Security* 12:1 (1987) | Core. Reproduces and annotates the briefing; the source of the force tables above. |
| Desmond Ball and Jeffrey Richelson, eds., *Strategic Nuclear Targeting* (Cornell, 1986) | Core. Thirteen essays on targets, timing and intent; the chapter on 1945–1960 war planning frames the 1956 study. |
| Edward Kaplan, *To Kill Nations: American Strategy in the Air-Atomic Age and the Rise of Mutually Assured Destruction* (Cornell, 2015) | Core. By a retired Air Force intelligence officer; argues the air-atomic strategy sought to win by one massive, time-compressed strike. That compression is the study's clock. |
| Fred Kaplan, *The Wizards of Armageddon* (1983) | The narrative history; the 285-million figure traces here and must be checked against its own source. |
| Lynn Eden, *Whole World on Fire: Organizations, Knowledge, and Nuclear Weapons Devastation* (Cornell, 2004) | Why planners modelled blast and not fire, and what fire would have done. The fire-spread lab and the two-number readout both rest on this. |
| Daniel Ellsberg, *The Doomsday Machine: Confessions of a Nuclear War Planner* (2017) | A participant's account of the 1961 casualty estimates and the plan's rigidity. |
| Eric Schlosser, *Command and Control* (2013) | Alert posture, weapons safety and the airborne alert accidents; the Chrome Dome specimen's context. |
| Paul Bracken, *The Command and Control of Nuclear Forces* (1983); Bruce Blair, *Strategic Command and Control* (1985) | Readiness states and the mechanics of execution, for the readiness-clock lab. |
| Chuck Hansen, *Swords of Armageddon* (1995, rev. 2007) | Weapon yields and variants; the source behind most of the order-of-battle figures. |
| Robert S. Norris and Thomas B. Cochran, *US–USSR/Russian Strategic Offensive Nuclear Forces 1945–1996* (NRDC, 1997) | Year-by-year force tables; the per-base bomber counts still open above come from here. |
| William Burr's National Security Archive briefing books, especially EBB 130, 236, 538, 638 and 798 | The documentary spine. Burr's editorial notes are themselves a running historiography. |
| Alex Wellerstein, *Restricted Data: The History of Nuclear Secrecy in the United States* (Chicago, 2021) | The secrecy itself, which is the withheld tier's subject. |
| Wikipedia, ["Basic Encyclopedia"](https://en.wikipedia.org/wiki/Basic_Encyclopedia) | The Bombing Encyclopedia of the World, begun in 1946, with over 80,000 targets: BE numbers of eight digits, coordinates, elevation and category. The `BBBB-NNNN` numbers in the 1956 study are its identifiers. |
| Office of Technology Assessment, *The Effects of Nuclear War* (1979) | The casualty curves and the government's own admission of what its models omit. |

The National Security Archive keeps a [select literature list](https://nsarchive2.gwu.edu/nukevault/literature/) that should be read before this table is considered complete.

## Period geography

The globe is 2026 OpenStreetMap. In 1961 the frontiers were different and Gorky, Sverdlovsk, Kuibyshev and Stalingrad existed under those names. Three things fix this:

- **The 1956 study carries its own coordinates**, in degrees and minutes, alongside period names. A target transcribed from it needs no geocoding. Its coordinates are documented tier; the modern name is an annotation.
- **[historical-basemaps](https://github.com/aourednik/historical-basemaps)** has `world_1945.geojson` and `world_1960.geojson` under GPL-3.0, with a `BORDERPRECISION` field and the author's own warning to verify against other sources. The 1960 borders are drawn as a documented-with-caveat layer, precision shown.
- **[HYDE 3.3](https://doi.org/10.24416/UU01-AEZZIT)** (Klein Goldewijk, Utrecht University, 2023) supplies gridded population at 5 arc minutes in ESRI ASCII format. The Utrecht publication page states the licence as **CC BY-NC-SA 4.0**, not the CC BY that a mirror claimed; the study is non-commercial and share-alike is acceptable, and the attribution goes on the readout. The download sits behind a bot check that a browser passes.

## The 1956 transcription

This is the question that decides scope, and the answer is favourable.

The city list is a 306-page PDF of typewritten, monospaced, cleanly scanned pages with no text layer. The row grammar is visible on the page: a priority number, a complex number, the period name in capitals, coordinates as `DDMM-DDDMM`, then indented rows of three-digit category codes with Bombing Encyclopedia numbers. Population rows carry category 275. On every page a box on the right covers the weapons column, printed with its statutory exemption under the Atomic Energy Act. That box is the first withheld-tier datum in the study.

- **First pass, 9 September 2026.** All 306 pages are transcribed to [`data/siop62/city-list.jsonl`](../data/siop62/city-list.jsonl), every record with its raw OCR line and a confidence flag. Totals: 1,691 complex rows over 888 distinct complex numbers (930 carrying a priority), 8,875 category rows of which 1,773 are category 275 Population, 976 additional ground-zero rows, 3,032 unparsed lines still to work through, and the weapons-column redaction read on 217 of 306 pages. The [checker](../scripts/check-1956-city-list.py) geocoded 30 random period names through Photon: 22 landed within 10 km of the 1956 coordinate, the rest were ambiguous or renamed places or OCR damage. Nineteen complexes fall outside a Sino-Soviet-bloc bounding box, all recognisable digit confusions in the scan (5 read as 9, 1 as 3, 0 as 9). None of this is corrected automatically; the verification queue is the unparsed lines, the low-confidence category rows, the out-of-box coordinates and the spot-check flags.
- **Trial.** Tesseract 5.5 at 300 dpi with page-segmentation mode 6 reads the typewritten rows cleanly. Complex rows such as `1045 0230 ANADYR 6444-17728` and `131 0249 AN SHAN MANCH 4107-12257` parse with their coordinates; category rows parse with occasional digit confusion in the Bombing Encyclopedia number; margin noise from the scan is the main source of rejected lines. Some complexes carry no priority number. The list is alphabetical by name, not by priority. The script is [`scripts/transcribe-1956-city-list.py`](../scripts/transcribe-1956-city-list.py); it writes JSONL with the raw line and a confidence flag on every record and records the redaction box on every page as a withheld datum. Sanity checks to add: coordinates must fall inside the named country's 1960 borders, and a hand-checked sample of rows against the scan.
- The Future of Life Institute digitised about 1,100 city targets from this release and Alex Wellerstein rendered them with NUKEMAP in 2016. No download or licence for that transcription was located. Ask before reusing; never scrape the visualisation.
- The 1956 study is a proxy. It shows the method and the categories of the 1961 target list, not the list itself. Targets from it render as documented-1956 and reconstructed-1961, never as SIOP-62 fact.

## Effects models

The models are public even though NUKEMAP's code is not. NUKEMAP's own [FAQ](https://nuclearsecrecy.com/nukemap/faq/) names them, which is the best possible validation set.

| Effect | Model | Notes |
| --- | --- | --- |
| Fireball, overpressure, thermal, prompt radiation | Curve fits to Glasstone and Dolan, *The Effects of Nuclear Weapons* (1977); the AEC *Nuclear Bomb Effects Computer* CEX-62.2 (1963) | Ignores terrain, shielding and atmosphere; say so |
| Fallout | Carl F. Miller, *Simplified Fallout Scaling System* (SRI, 1963), H+1 normalised; WSEG-10 as the alternative | Surface bursts only; idealised wind; the study uses climatological winds and labels them |
| Casualties | DCPA *Attack Environment Manual* (1973) curves as reprinted by the OTA in 1979 | Blast proxy only, which is exactly the underestimate EBB 798 describes |
| Mass fire | Weakest area; Hiroshima and Hamburg evidence, Lynn Eden's *Whole World on Fire* | Lowest fidelity ceiling in the study; a lab, not a claim |

The outcome readout carries two numbers: the blast-only figure by the planners' own OTA/DCPA method, and the mass-fire bound after Postol, in which everyone inside the third-degree-burn radius is counted dead. The gap is the subject. Casualty fractions by band come from OTA 1979 figure II-1: 98 percent dead above 12 psi, 50 percent dead and 40 percent injured from 5 to 12, 5 and 45 from 2 to 5, none dead and 25 percent injured from 1 to 2. The 12 and 2 psi radii are log-log interpolations between Sublette's tabulated constants.

## Labs programme

Most of the study is subsystems, and each subsystem earns its place through a lab before it touches the execution study. A lab is a self-contained specimen page with a pure model module, a visual grammar, a validation table against published values, and a declared fidelity ceiling. Fidelity ceilings are declared, not discovered. The point is to establish the lines of the possible, not to build a weapons-effects code.

| Lab | Establishes | Validation | Fidelity ceiling |
| --- | --- | --- | --- |
| **Ballistic arc** | Minimum-energy and lofted trajectories, burn time, apogee, time of flight against range for Atlas, Titan I, Polaris A-1, Thor and Jupiter | Published flight times of roughly 30 minutes intercontinental and 15 minutes for the IRBMs | Point-mass over a spherical Earth, no atmosphere after burnout |
| **Bomber sortie** | Great-circle legs, refuelling tracks, cruise speed and altitude, time over target; the Chrome Dome loop as the documented specimen | Chrome Dome mission durations and the 12-a-day cadence | No penetration tactics, no defences |
| **Readiness clock** | DEFCON and alert states; the fourteen options as a force-generation curve from 1,004 systems at H-hour to 2,244 at 14 hours | The briefing's option table | Linear interpolation between documented points |
| **Damage expectancy** | Reliability times probability of arrival times probability of damage, the arithmetic behind multiple weapons per ground zero | The 75, 85 and 95 percent figures; Atlas reliability 0.70 to 0.80 | The planners' own method, no better |
| **Prompt effects** | Fireball, overpressure bands, thermal and prompt radiation rings by yield and height of burst | Glasstone and Dolan tables; NUKEMAP's published radii for reference yields | Ideal surface, no terrain |
| **Terrain shock** | Blast propagation over real terrain rather than a plane: Nagasaki's Urakami valley confined and channelled the blast, and Glasstone treats terrain only qualitatively, which is why planar tools stop there. Three fidelities in order: line-of-sight shadowing of the burst point over the terrain tiles; a 2D acoustic wave solver over the height field on a small grid, run in a shader when the camera is close, showing reflections and channelling; and the planar model everywhere else. Real CFD is out of scope | Nagasaki damage surveys against the shadowed and channelled zones; the planar radii in the far field | A linear wave over a 2.5D surface; qualitative reflections, not pressures anyone should quote |
| **Fallout plume** | Dose-rate contours over hours and days under a chosen wind, decay | Miller and WSEG-10 worked examples | Single wind vector, no shear |
| **Fire spread** | Ignition radius, mass-fire growth, the firestorm threshold | Hiroshima and Hamburg | Explicitly speculative; rendered inferred |
| **Population exposure** | Sampling the HYDE grid under effect geometry; the two-number readout. **Built:** `#/lab/population`, HYDE 3.3 1961 and 2023 grids in a worker pool, OTA 1979 blast-only bands against a Postol superfire bound, populated cells drawn under the rings, click to move ground zero | Hiroshima and Nagasaki, done: see [VALIDATION.md](VALIDATION.md) | Grid resolution of 5 arc minutes; uniform density within a cell |
| **Evidence grammar** | Solid, broken, ghost, modelled and withheld line treatments in the Grid/84 style; provenance on hover | Legibility on a phone | None; this is design |

The labs are also where the register is tuned. A plume that grows in silence over Sverdlovsk while a counter ticks up is the whole study in miniature, and it should be tested as a specimen before the full plan is attempted.

## Register

Absolute bureaucratic calm. Fixed-width readouts, upper case, no exclamation, no explosion sprites. Things happen on schedule. Numbers carry their source. One line from the 1956 study, if it survives verification, is shown in the study's own words rather than paraphrased: the category list entry for population. It needs no help.

## Bounded proof

The first deliverable is not the plan. It is one of everything, across every tier:

1. One documented base: the 564th SMS at F.E. Warren, six Atlas D, W49.
2. One documented sortie: a Chrome Dome northern-route B-52 with its refuelling track.
3. One transcribed 1956 target with its coordinates and category rows, rendered documented-1956 and reconstructed-1961, with the weapons column shown as a withheld datum citing the page.
4. One modelled consequence: prompt effects and a plume for one weapon at that target, with the two-number exposure readout.
5. One ghost: a ground zero known only to city level, inside its uncertainty ring.

**Exit:** the proof plays from H-hour on the Terminal Atlas clock, every mark on it can be traced to a page, and the redaction is visible.

**Built, 9 September 2026.** The proof runs. The Atlas D launches at H+15:00 on the documented reaction time, flies a minimum-energy arc of 21.6 minutes to apogee 1,026 km, and detonates at H+36:38 with the prompt-effects rings drawn on the Anadyr estuary; the camera descends to the target in the terminal phase. The Chrome Dome B-52 flies its reconstructed loop throughout, passing Thule half an hour before H-hour, its SIOP target logged as withheld. Every mark opens a provenance panel with its facts badged by tier. Population exposure is shown as not computed. Population exposure now computes at impact from the HYDE 1961 grid: the Anadyr weapon gives about 7,000 dead by the blast-only 1961 method and 8,500 with mass fire, both labelled modelled with their sources. Not yet built: fallout, the Soviet response, and the terrain-shock lab.

## Beyond SIOP//62

The engine is general and SIOP//62 is the jumping-off point. Grid/84 as a whole is an interactive exploration of the history and doctrine of strategic nuclear weapons, and the candidate studies below each need their own brief before any code. Each has a documentary spine already.

| Study | Starting sources | Note |
| --- | --- | --- |
| **Contemporary single weapon** | Glasstone and Dolan; GHSL population; NUKEMAP as the validation reference | The base case, and the main thing people use NUKEMAP for. It is stage 3 of the roadmap on the 2026 map and shares every lab with SIOP//62; only the population grid changes. |
| **Tsar Bomba, 30 October 1961** | Soviet test records and Western yield estimates (about 50 Mt, air burst near 4 km over Novaya Zemlya); Wellerstein's writing on the test | A fully documented single detonation on real terrain, inside the SIOP-62 period, and the largest yield the effects models will be asked for. A natural first case study once the rendering lands, and the obvious specimen for the terrain-shock lab. |
| **Able Archer 83 gone hot** | The National Security Archive's [Able Archer 83 Sourcebook](https://nsarchive.gwu.edu/project/able-archer-83-sourcebook), over a thousand pages assembled by Nate Jones; the 1990 PFIAB report *The Soviet "War Scare"* released after a twelve-year fight; Jones, *Able Archer 83* (2016) | A counterfactual on a documented exercise, with both sides' readiness states in the record. The withheld tier would be busy: the 2025 briefing book is titled *The Censored History of Able Archer 83*. |
| **India–Pakistan** | Toon, Robock et al., ["Rapidly expanding nuclear arsenals in Pakistan and India portend regional and global catastrophe,"](https://www.science.org/doi/10.1126/sciadv.aay5478) *Science Advances* 5 (2019) | A published, peer-reviewed scenario with explicit weapon counts, yields, city targets, fatality ranges of 50 to 125 million, and a soot model. The study would enact the paper's own scenario, cited as such. |
| **Korean peninsula** | Zagurek, ["A Hypothetical Nuclear Attack on Seoul and Tokyo,"](https://www.38north.org/2017/10/mzagurek100417/) 38 North (2017); Kristensen and Korda's Nuclear Notebook on North Korean forces | Smaller arsenal, denser cities, contemporary population grid. A good second contemporary study. |

The rule from the manifesto holds for all of them: impractical, never fake. A study that cannot name its sources on the readout does not get built.

## Open questions

- Which 1956 targets can be tied to 1961 ground zeros, and by what stated rule? Airfields and the largest cities are the safest reconstruction.
- Does the Future of Life Institute transcription exist as data with a licence, or is a fresh transcription the cleaner path?
- What is the right treatment of the Soviet response? The briefing says some Soviet weapons would reach the United States under any circumstances. The study is about the plan, and a one-sided plan is the honest scope, but the readout should state that omission.
- Publication review. The study is history and its inputs are public, but the register is deliberately disturbing. Decide the framing text before anything is public.

## Sources

- Sagan, Scott D. "SIOP-62: The Nuclear War Plan Briefing to President Kennedy." *International Security* 12, no. 1 (1987): 22–51. [Archive.org copy](https://archive.org/details/SIOP62TheNuclearWarPlanBriefingToPresidentKennedy).
- National Security Archive EBB 236, 538, 638 and 798, linked above.
- Wellerstein, Alex. ["Mapping the US nuclear war plan for 1956."](https://blog.nuclearsecrecy.com/2016/05/09/mapping-us-nuclear-war-plan-1956/) *Restricted Data*, 9 May 2016, and the [NUKEMAP FAQ](https://nuclearsecrecy.com/nukemap/faq/).
- Future of Life Institute, ["1100 Declassified U.S. Nuclear Targets."](https://futureoflife.org/resource/us-nuclear-targets/)
- Klein Goldewijk, K., et al. *HYDE 3.3*, PBL / Utrecht University, CC BY 4.0.
- Ourednik, A. *historical-basemaps*, GPL-3.0.
- Glasstone, S., and P. J. Dolan. *The Effects of Nuclear Weapons*, 3rd ed., 1977.
- Miller, C. F. *Fallout and Radiological Countermeasures*, SRI, 1963.
