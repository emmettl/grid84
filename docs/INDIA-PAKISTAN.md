# Fifty to a hundred and twenty-five million

**Brief, 11 September 2026.** Not built. A study of the India–Pakistan war modelled by Toon, Robock and eleven co-authors in *Science Advances* in 2019: the one scenario on this site's list that a peer-reviewed paper has already run end to end, with its weapon counts, its yields, its fatalities and its soot all published.

[Roadmap](../ROADMAP.md) · [Winter](WINTER.md) · [Validation](VALIDATION.md)

## Why this one

Every other study here reconstructs a plan from a release and says where the record stops. This one is different in a way that is worth the difference: **the answer is already published, so the engine can be marked against it.**

The winter model already carries Toon's figures. `SOOT_CASES` in `src/models/soot.ts` holds the 2019 paper's three yield cases — 16, 27 and 37 teragrams of black carbon, 52, 97 and 127 million dead — and the years-after view reads them as given. They are inputs. Nothing in this engine has ever computed them.

So the study is a test of the instrument on ground where the instrument can be wrong in public. Put 250 detonations over the real cities of the subcontinent on the 2025 population grid, sum the dead with the engine's own blast and fire models, sum the soot with the engine's own fire-to-stratosphere chain, and set both totals beside the numbers the winter view has been quoting all along. If they agree, the two halves of this engine agree with each other and with the literature. If they do not, that is a finding about the engine and it goes in the validation notes.

That is the prize. It is also the risk, and it is the right risk to take before showing this to anyone who works on the subject.

## The paper's own scenario

Toon, O. B., C. G. Bardeen, A. Robock, L. Xia, H. Kristensen, M. McKinzie, R. J. Peterson, C. S. Harrison, N. S. Lovenduski and R. P. Turco, "Rapidly expanding nuclear arsenals in Pakistan and India portend regional and global catastrophe," *Science Advances* **5**, eaay5478 (2 October 2019). The narrative below is the companion account the authors published in the *Bulletin of the Atomic Scientists*.

**The arsenals.** Both countries are projected to hold 400 to 500 weapons between them by 2025, with yields from the tested 12 to 45 kilotonnes up to a few hundred. India tested a weapon of 40 to 50 kilotonnes in 1998.

**The escalation**, in the authors' own telling, and it does not begin with cities:

| Day | What happens |
| --- | --- |
| 1 | Pakistan fires tactical weapons of about 5 kt — less than half of Hiroshima — as low air bursts against Indian armour, inside its own borders |
| 2 | Fifteen more tactical weapons. India uses 20 strategic weapons as air bursts: two over the garrison at Bahawalpur, eighteen over Pakistani airfields and weapons depots. Unlike the tactical shots in open country, these start immense fires |
| 3 | Pakistan uses 30 air bursts — twenty over garrisons in Indian cities, ten over naval bases and airfields in urban areas — and fifteen more tactical weapons against Indian troops. India answers over ten Pakistani bases, all of them in cities |
| 4–6 | Pakistan spends the rest of its strategic arsenal: 120 weapons on Indian cities |

**The totals the paper models:** India 100 strategic weapons on Pakistani urban centres, Pakistan 150 on Indian ones.

**What it finds**, in three yield cases:

| Weapon yield | Black carbon to the upper atmosphere | From India's weapons | From Pakistan's | Direct fatalities |
| --- | --- | --- | --- | --- |
| 15 kt | 16.1 Tg | 11.0 | 5.1 | 50–125 million across the three cases |
| 50 kt | 27.3 Tg | 19.8 | 7.5 | — |
| 100 kt | 36.6 Tg | 27.5 | 9.1 | — |

The asymmetry in the soot column is the paper's most quotable line and the study should draw it: **India's hundred weapons make roughly three times the smoke of Pakistan's hundred and fifty**, because Indian cities are larger and more densely built, and smoke is what the climate answers to. The side that fires fewer weapons does more to the world.

**And the world:** surface sunlight down 20 to 35 per cent, global surface cooling of 2 to 5 °C, precipitation down 15 to 30 per cent, net primary productivity down 15 to 30 per cent on land and 5 to 15 per cent in the ocean, and recovery taking more than ten years. For scale, the authors put a United States–Russia war at 150 Tg (Coupe et al., 2019), which this engine already carries as the `global-150` case.

## What the engine already has

- **The 2025 population grid.** GHS-POP 2025 is prepared as 30-arc-second tiles and fetched on demand. The paper models 2025; the grid is the right year and finer than the inner rings, so the cell-resolution caveat that governs every HYDE readout does not apply here.
- **The effects models.** Blast, thermal, prompt radiation and the optimum-height air burst, all tested against Glasstone and Dolan. The paper's weapons are air bursts throughout, which is the case the engine is strongest on.
- **The exposure workers**, with the union machinery that counts a person under several detonations once. With 250 detonations over one subcontinent the overlaps will be large, and the difference between the summed-per-target figure and the union figure is itself worth showing.
- **The soot chain** in `src/models/soot.ts`: fuel loading from population density, the emission factor, prompt and further rainout, and the lofted fraction. This is the machinery the paper's 16.1 Tg would be checked against.
- **The winter model**, which already runs the paper's answers. It would run the engine's instead, side by side.
- **The forces**, partly: `data/atlas/forces-2025.json` carries Indian and Pakistani systems with yields, ranges and CEPs from the Nuclear Notebook.

## What it needs that it has not got

1. **An urban target list for both countries on the 2025 grid.** `scripts/derive-urban-targets.py` does exactly this job — the N most populous cells inside a bounding box, skipping any within a spacing distance of one already taken, recording the rule and the population of each cell — but it reads HYDE `.asc` files at five arc minutes. It needs to read the GHSL tiles, or a sibling script does. Every such target is drawn modelled, as the existing studies do.
2. **The military aim points of days 2 and 3.** The paper's first sixty weapons go on garrisons, airfields, naval bases and weapons depots, and the point of naming them is that the fires start there — the authors say so explicitly. Some are in `forces-2025.json`; the rest would be inferred from open sources and tiered accordingly.
3. **A yield switch.** Three cases, 15 / 50 / 100 kt, as the paper has them. The engine's studies carry variants already; this is the same mechanism.
4. **The soot sum as a study output.** The engine computes soot per detonation. It has never summed it over a whole war and handed the total to the winter model. That is the join between the two halves of the engine, and it does not exist yet.

## The rule this study would state

*The paper's own scenario, enacted.* India's 100 and Pakistan's 150 strategic weapons as optimum-height air bursts over the most populous urban cells of the other country on the 2025 grid, one weapon to a city, at the chosen yield; the sixty military shots of days 2 and 3 on named installations; the tactical weapons of day 1 drawn and not counted, because they are fired in open country and start no fires. Everything counted by the engine's own models, and the paper's published totals shown beside the engine's as a check rather than as a source.

## Fidelity ceiling, declared in advance

- **The escalation is the paper's, not a prediction.** Six days from armour in the desert to a hundred and twenty weapons on cities is one authored sequence of events, and the study says so on every readout. It is the scenario's spine because it is published and cited, not because anyone thinks it is what would happen.
- **One weapon to a city is the paper's convention**, and it is coarse. Real planning puts several on the largest.
- **The fire model is the weakest part**, as it is everywhere in this subject and as the paper's own authors say. Fuel loading from population density is an estimate over a region whose construction differs from the American and Japanese cities the loadings were measured in. This is the number most likely to disagree with Toon's, and the disagreement would be the most interesting thing the study produces.
- **No fallout.** The paper's weapons are air bursts, which make no early local plume, and the engine says so already.
- **No famine count of its own.** The winter model's Xia variants carry that, and they are read from the literature rather than computed here.

## What would have to be true for this to be worth publishing

The direct-fatality total for the 15 kt case lands within a factor of about 1.5 of the paper's 50 million, or the study explains in the validation notes why it does not. Anything else and the engine is claiming a precision it has not got.

## Sources

- Toon et al., *Science Advances* **5**, eaay5478 (2019). doi:10.1126/sciadv.aay5478
- Robock, Toon and Bardeen, "How an India-Pakistan nuclear war could start — and have global consequences," *Bulletin of the Atomic Scientists* (2019) — the escalation narrative and the per-country soot split.
- Coupe, Bardeen, Robock and Toon, *J. Geophys. Res. Atmos.* **124** (2019) — the 150 Tg case, already carried.
- Xia et al., *Nature Food* **3** (2022) — the famine work the winter model already reads.
- Kristensen and Korda, Nuclear Notebook, on Indian and Pakistani forces — already carried in `data/atlas/forces-2025.json`.
- GHS-POP 2025, European Commission Joint Research Centre — already prepared.
