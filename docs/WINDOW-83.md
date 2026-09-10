# THE WINDOW OF VULNERABILITY

**A Soviet first strike as the West feared it, 1983, and the two answers the posture allowed: ride it out, or launch under attack.** Brief, 10 September 2026. Built the same day at `#/study/window-83` and `/launch`.

## Thesis

Every study so far has the United States striking first or a crisis climbing. The posture of the late Cold War was built the other way round: against a Soviet counterforce strike that would land on the Minuteman fields before a president could decide, the "window of vulnerability" of Nitze's 1976 essay, Team B's estimate and the 1980 campaign. The fear had arithmetic in it. The SS-18 Mod 4 carried ten warheads of about half a megaton to a quarter of a kilometre; the estimates gave two of them on a two-thousand-psi silo better than four chances in five of a kill, and three hundred of them could put two warheads on every American silo and have half their force left. The open literature's accuracy, run through the engine's own rule, gives about two chances in three, which is the uncertainty Bunn and Tsipis put before the public in 1983 and the study's first finding. The answer was launch under attack: the missiles leave the silos on confirmed warning, thirty minutes after the Soviet launch and before the warheads arrive, so the strike hits holes in the ground. Every early-warning radar on the posture atlas and every minute of the seventy-two-minute scenario's decision clock descends from this.

The study enacts the strike and both answers on the forces of 1983, and sums both on the 1985 grid. The claim is the arithmetic: how many silos survive a ride-out; what the surviving force and the boats at sea do to the Soviet Union; what launching under attack changes; and what the Soviet Union does with what it kept back. Nothing in the record says the Soviet Union planned this. The study says so, and draws the strike from the Western estimates that shaped the posture.

## The tiers

| Tier | In this study |
| --- | --- |
| **Documented** | The forces of 1983 as the Nuclear Notebook and the Databook count them; the accuracy and yield estimates of the open literature, tiered as estimates; the silo hardness of the Minuteman upgrade; the early-warning sites |
| **Reconstructed** | The silo fields as 150 points around each wing's base; the flight times; the warning timeline (satellite detection at launch, radar confirmation at about ten minutes, a decision by twenty, impact at thirty) |
| **Inferred** | The Soviet allocation, two warheads per silo from the SS-18 and SS-19 fields, submarine warheads on the bomber bases and ports from the coasts, the rest held; the American answer's allocation by the categories of the day; the launch-under-attack timing |
| **Modelled** | Silo survival by the single-shot kill rule of the accuracy lab; blast, fire and fallout; the union of the three on the grid |
| **Withheld** | The SIOP of 1983 and the Soviet plan, neither in the record |

## What the study enacts

Two acts on one clock, the Soviet launch at H.

1. **Ride it out** (`#/study/window-83`). The Soviet ICBM force puts two warheads on each of the 1,045 American silos; its boats off the coasts put warheads on the bomber bases and the submarine ports with ten minutes' warning; the command sites are struck. The American ICBMs stay in their silos. Each silo survives or not by the single-shot kill rule with the engine's draw; the survivors launch at H+40 with the boats at sea and whatever bombers left the interior bases before the warheads arrived, against the Soviet forces and cities by the categories of the day. The Soviet Union answers with what it kept back.
2. **Launch under attack** (`#/study/window-83/launch`). The same strike; the American ICBMs leave at H+20 on the radar confirmation, before the warheads arrive. The Soviet warheads land on empty silos. Everything else is the same.

The readout carries the two figures the posture turned on: silos surviving, and dead on each side.

## Data needed

| Need | Source | Status |
| --- | --- | --- |
| Forces of 1983 | Nuclear Notebook and Databook totals spread over the wings and divisions the unit histories name, as the 1991 order of battle was built | To build: `scripts/build-order-of-battle-1983-strategic.py` |
| Silo fields | 150 silos in fifteen flights of ten around each wing, as points within about 60 km of the base, by rule | To build in the study |
| Silo hardness and Soviet accuracy | 2,000 psi (Databook); SS-18 Mod 4 500 kt at 250 m, SS-19 550 kt at 300 m (the accuracy lab's estimates) | Have |
| Soviet urban targets | HYDE 1983 by `scripts/derive-urban-targets.py` over the Soviet Union, with the neighbours' cities inside the box excluded (Poland, Romania, Bulgaria, the Danube delta, Finland, Turkey, Iran, Hokkaido, and the southern land border as a polyline) | Built; cells named after the nearest city of `data/window83/cities-su-1983.json` (the 1983 names, geocoded by `scripts/name-cities-1983.py`) within thirty kilometres, the American cells after the modern list |
| Population | GHSL 1985 on the bucket for both sides | Have |
| The warning timeline | Bruce Blair, *Strategic Command and Control* (1985) and *The Logic of Accidental Nuclear War* (1993) | Cited |

## Built, 10 September 2026

The 1983 strategic forces are built by `scripts/build-order-of-battle-1983-strategic.py` from the Databook and Notebook totals (10,205 American and 8,654 Soviet weapons); the 1,045 silos are placed by rule in fifteen flights of ten around each wing; the Soviet urban targets come from the 1983 grid. The first finding is the one Bunn and Tsipis made in the year the study is set: with the open literature's accuracy, 500 kt at 250 m against 2,000 psi, a single SS-18 warhead kills a silo about two times in five and two warheads about two in three, so a ride-out leaves about half the silos to fire, not the handful the estimates feared, and fratricide, which the study does not model, would raise the survivors further. The warning clock runs from the satellites' detection at thirty seconds to the boats' warheads on the coastal bases at about eight minutes, the radar confirmation at ten, the conference at thirteen and the decision at twenty, with the first warheads on the silos at about thirty-four by the geometry, the five-minute liquid burn of the SS-18 included since the boost phase was added: a launch under attack ordered at twenty has some twelve minutes to spare. The outcome sums on the 1985 grid are on the readouts of both acts and are to be recorded here from a visible run.

## Sources

- Paul Nitze, "Deterring Our Deterrent," *Foreign Policy* 25 (Winter 1976–77).
- The Team B report, *Soviet Strategic Objectives: An Alternative View* (1976), released 1992.
- Bruce G. Blair, *Strategic Command and Control: Redefining the Nuclear Threat* (Brookings, 1985) and *The Logic of Accidental Nuclear War* (1993).
- Kosta Tsipis, *Arsenal* (1983), ch. 6, and Bunn and Tsipis, "The Uncertainties of a Preemptive Nuclear Attack," *Scientific American* (November 1983), which put the arithmetic of this study before the public in the year it is set.
- Office of Technology Assessment, *MX Missile Basing* (1981), on the silo problem.
- Cochran, Arkin and Hoenig, *Nuclear Weapons Databook* vol. 1 (1984); Norris and Kristensen, Nuclear Notebook series.

## Selection: the whole missile, and what a site sent

Selecting a detonation lights the vehicle that delivered it at full strength and, at part strength, the rest of its missile: the bus track to the separation point, which is marked with its time, altitude and warhead count, and the sibling reentry vehicles, with their targets ringed. The panel lists the missile's warheads with their targets, arrival times and, once the grid has been read, the dead at each, summed across the missile with each detonation counted at its own target. Selecting a launch point, a division, a silo, a base or a patrol area, lights everything it sent and rings everything it hit, with the same sum. The resolver is `src/studies/missile.ts`; vehicles belong to the site they start at or whose name they carry, since a division's missiles are spread over its field by rule. A bomber's cruise missiles released at a standoff are one load in the same way, with the release point marked instead of a separation. This applies to every study, not only this one.
