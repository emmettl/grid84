# THE CHRONICLE

**Doctrine, stockpiles, posture and geopolitics as a visual spine through the studies.** A planning brief, 10 September 2026. The shape proposed for an evolving strand of the work; the labs and the first chapter are built, as noted below.

## What the studies cannot say on their own

Each study is a moment: December 1961, October 1962, October 1973, November 1983, September 1980, the present. Between the moments is the history the studies assume: how the stockpiles grew and fell, how the forces moved from bombers on runways to missiles in silos to boats at sea, what the plans were for (massive retaliation, assured destruction, flexible response, counterforce, launch under attack, damage limitation), which treaties bounded what, and where the weapons stood in relation to the crises of the day (Thors in Britain, Jupiters in Turkey and Italy, R-12s in Cuba, SS-20s and Pershing IIs in Europe, the boats in the bastions). The studies show the machinery at an instant. The chronicle would show the machinery changing, and why.

The manifesto's tension runs through this history more plainly than through any single plan: the stockpile curve is the calmest chart in the world, and it counts sixty thousand warheads at its peak.

## Principles, agreed 10 September 2026

- **Visual first.** The chart or the map state is the chapter; the prose is a caption, never an essay. A chapter that needs more than a screen of words has not found its picture.
- **Sources and methods, one click away and never in the way.** Every chart and map state carries a disclosure, collapsed by default, that names the series, the document and the method with page or figure references, and links out to the source and to the validation notes. The reader who wants the scholarship finds all of it; the reader who does not is never made to read it. The lab's `Sources and methods` panel is the pattern.
- **The register holds.** Calm, terminal type, the evidence grammar on every mark. The chronicle is a strange work of scholarship and looks like one.

## The form

A third form beside the studies and the labs, reached from the front page: chapters that read as text with the map as their spine. Each chapter is a few hundred words, one or two charts drawn from a cited series, and one or more **map states**, which are the engine's own entities at a date, opened in the same view the studies use and scrubbed across time where the data allows. The reader moves between the chapter and the map; the map is never illustration, it is the argument's evidence.

The map states already exist for five epochs, because the studies built their orders of battle by script: 1961 (SIOP//62), 1962 (Cuba), 1973 (DEFCON 3), 1983 (Able Archer, theatre only), 2024 (seventy-two minutes). A **posture atlas** that scrubs a date across those epochs, sites appearing and disappearing with their strengths, is the first thing the chronicle can show and needs no new data beyond the gaps between them. Filling the gaps (1950s bombers, the 1990s drawdown) is the chronicle's own work, epoch by epoch, each with its Nuclear Notebook or Databook citation.

## Chapters proposed

1. **The stockpiles, 1945 to the present.** The Kristensen and Korda inventory series for every state, as a chart, with the moments of the studies marked on it. The chart is the chronicle's cover: the calm line and its peak.
2. **Posture.** From bombers on ground alert and airborne alert to the triad, the alert rates, the bastions; the fraction of the force that could fire within fifteen minutes at each epoch, which the readiness lab already computes for 1961. Launch on warning and launch under attack as the doctrine the present scenario rests on.
3. **Doctrine as arithmetic.** Massive retaliation, assured destruction's "20 to 25 per cent of population and 50 per cent of industry" (McNamara, 1965), flexible response, NUWEP-74's categories, the countervailing strategy of PD-59, the present. Each named with its document and shown as the target rule it implies, which the studies already enact (SIOP-62's task order, NUWEP-74's categories, OPLAN 8010 as a rule).
4. **Geopolitics as basing.** The forward bases and what they did to the crises: Thor, Jupiter, the Cuban regiments, the Euromissiles, the Pacific boats. Map states with the crisis studies opened from them.
5. **Treaties as bounds.** LTBT, NPT, SALT I and the ABM treaty, SALT II, INF, START, SORT, New START and its expiry in February 2026; each as a line on the stockpile chart and a change on the map (the INF zero, the START drawdown).
6. **Missile defence and the shot exchange.** Nike-Zeus, Sentinel, Safeguard's one site at Grand Forks (1975, closed within months), the ABM treaty, Moscow's A-35 and A-135, SDI, Brilliant Pebbles, GMD's forty-four, and the present decade's Golden Dome. The chapter's argument is arithmetic and belongs in a lab (below): the defender must buy shots faster than the attacker buys warheads and decoys, and no system since 1957 has done so.

## Labs the chronicle needs

**The shot-exchange lab** (built 10 September 2026 at `#/lab/defence`; model in `src/models/defence.ts`). An attacker with N warheads, D decoys per warhead and a MIRV multiplier against a defender with M interceptors of single-shot kill probability p fired in salvos of k. Outputs: leakage (warheads through) as a function of M, the cost-exchange ratio at stated unit costs, and the point at which the attacker's cheapest countermeasure beats the defender's dearest interceptor. Reference cases from the published record: Safeguard's 100 interceptors against the 1975 Soviet force; the APS 1987 directed-energy study's numbers for SDI; the UCS 2000 countermeasures report; the NAS 2012 assessment of GMD; the Congressional Budget Office's 2025 estimate for a space-based interceptor layer. The lab runs against the seventy-two-minute act: what forty-four interceptors at the test record do to one missile, and to fifty. This is the "folly" made visible as a curve, in the same calm as everything else.

**The yield-and-accuracy lab** (built 10 September 2026 at `#/lab/accuracy`; model in `src/models/lethality.ts`). The user's point: counterforce against countervalue was a technically mediated choice before it was a doctrinal one. A city fails at 5 psi and a silo at 2,000; the radius for the first is kilometres and for the second hundreds of metres; with a CEP of miles the city is a target and the silo is not. The lab plots single-shot kill against a hardened silo by year of service for eighteen systems from Atlas D to Trident II, with the even-chance line, a matrix of every system against every target hardness, and editable yield, CEP, hardness, shots and reliability. The crossing comes with Minuteman III's guidance refit, Peacekeeper and Trident II, by accuracy rather than yield, and the MIRV bus is what made the accurate warhead cheap enough to spend on silos. That is the shift from the large unitary warhead to the accurate MIRV, and it is the chapter on doctrine as arithmetic in one chart.

**The guidance error-budget lab** (proposed). The companion to the lethality lab: where the CEP comes from. A missile's miss distance is the root sum of squares of independent error sources, and for a submarine missile the largest of them in 1960 was not the missile's at all but the boat's: its own position and velocity as its inertial navigator carried them since the last fix, and the gravity it had not measured. A lab that composes a CEP from its terms (initial position and heading, velocity at launch, gyro drift over the flight, accelerometer bias, the gravity model, reentry dispersion), lets the reader scrub the time since the last fix and watch the boat's contribution grow, and then adds the star sight of Trident to collapse the initial-condition terms, would show the problem of unknowns and cumulative error the way the Polaris guidance history tells it. The figures need a source: MacKenzie's *Inventing Accuracy* gives the structure and some magnitudes, and the text the user has in mind should be named before the lab is built so its numbers, not illustrations, drive it.

**The stockpile chart** (built 10 September 2026 at `#/chronicle`, chapter 1). The Federation of American Scientists' inventory series as republished by Our World in Data under CC BY, all nine states, linear and log, the studies marked on their years, the world's peak labelled (64,452 in 1986), a hover readout by year, and the sources collapsed beneath. The first chapter of the chronicle and the pattern for the rest.

**The posture atlas** as a date scrubber over the orders of battle, which is engine work rather than a lab: a launcher entity gains a `from` and `until`, and the study view learns to show a date rather than a clock.

## Data needed

| Need | Source | Terms |
| --- | --- | --- |
| Warhead inventories by state, 1945 to the present | Kristensen and Korda, "Estimated global nuclear warhead inventories" (FAS, updated yearly); Norris and Kristensen, "Global nuclear weapons inventories, 1945–2013," *Bulletin of the Atomic Scientists* 69:5 | Published estimates; cite the year of each |
| Deployed strategic forces by leg, per epoch | *Nuclear Weapons Databook* vols. 1 and 4; the Nuclear Notebook series | Published |
| Basing by epoch | The five existing orders of battle; the Databook and unit histories for the gaps | Built and to build |
| Doctrine documents | NSC 162/2, McNamara's 1965 draft presidential memorandum, NSDM-242 and NUWEP-74, PD-59, the 2018 and 2022 posture reviews; via the National Security Archive and the Office of the Historian | Public domain |
| Treaties | Texts and the data exchanges (New START aggregate numbers, twice yearly until 2023) | Public |
| Missile defence | Safeguard and Sentinel histories; APS, *Science and Technology of Directed Energy Weapons* (1987); UCS, *Countermeasures* (2000); NAS, *Making Sense of Ballistic Missile Defense* (2012); MDA test record; CBO, *Costs of Space-Based Interceptors* (2025); the January 2025 executive order | Published; the recent programme's figures are announcements, marked as such |

## Where to start

The shot-exchange lab first: self-contained, a week of scholarship already in the record, tied to the seventy-two-minute act, and the clearest demonstration the chronicle has of the manifesto's tension. Then the stockpile chart and the posture atlas over the existing epochs, which together are the chronicle's spine and need no new data. The chapters follow as the map states and charts exist to hang them on.

## Open questions

- Whether chapters live in the app or as briefs in `docs/` with the app holding only the map states and charts. The app, probably: the front page already reads as a page, and the reader should not leave the instrument.
- How much text the register can bear. The studies say almost nothing in prose; the chronicle must say more, and it must keep the calm.
- The 1990s: the drawdown is the part of the history the studies never touch and the chronicle must, because the present scenario's force is its residue.
