# WOPR

**A constrained optimiser over a 1980s force posture, searching the strategy space for a better apocalypse.** A planning brief, 10 September 2026, from the user's proposal; built the same day at `#/wopr`, and the section at the end says how. The loop at `#/loop` stays as it is; this is a second mode beside it.

## The idea

The loop replays scenarios. WOPR searches. Given a documented model of a Cold War force posture, a loss function and a set of constraints, it adjusts what the planners could adjust, readiness, warning time, execution option, interception, reliability, the allocation rule, and keeps whatever lowers the loss. It runs until told to stop, and it improves relentlessly. Beside the globe, turning, a counter:

```
SEARCHING…
BEST OUTCOME UPDATED
117,830,000 DEAD
IMPROVEMENT: 0.04%
STATUS: OPTIMAL
```

The word *optimal* beside the number is the entire work.

## Whose loss function

If the objective is the total of human deaths and non-execution is permitted, the solver returns at once: **do not launch**. That result is real and the machine should be allowed to find it, once, and say so.

Impose the constraints the planners lived under, general war true, target coverage at least ninety-five per cent of the list, a surviving retaliatory capability greater than zero, and the machine begins to work. The objectives it can be set are the ones the documents state or imply, and their optima differ:

- Minimise total deaths.
- Minimise own-side deaths.
- Maximise destruction of the target list.
- Preserve a surviving retaliatory force.
- Satisfy the planners' percent-destruction criteria (McNamara's fifth to a quarter of population and half of industry; the SIOP's damage expectancies).

Improving one grotesquely worsens another, and the reader watches it happen. The loss function is never neutral mathematics: someone decided what counted as loss. The instrument's job is to make that decision visible as a control the reader can turn.

## Honesty

The megadeaths must not be predetermined. The solver runs the engine's own documented model with repeated seeds and reports ranges, not a number chosen for effect, and the conclusion holds only if it emerges: every admissible plan that satisfies the doctrine remains catastrophic. If a plan comes out otherwise, the instrument shows it.

## What it needs from the engine

- **A fast evaluator.** A plan must be scored in milliseconds, not the minute the union sum takes. Precompute, once per posture, the exposure of every candidate target at each yield class the force carries, using the exposure workers over the 1985 grid (about 600 targets by three yield classes), then score a plan as the sum over struck targets with a stated overlap correction. Say on the readout that the search runs on this surrogate and that the best plan found is re-summed by the full union before it is reported.
- **The plan space.** On the 1983 posture of the window study: the American posture (ride out, launch under attack), the alert fraction of the bombers, the execution option (the fraction of the force committed), the allocation rule (forces first, cities first, a mix), the attrition assumptions within their published ranges, the Soviet strike composition (counterforce, countervalue, mixed), warning time; and, as a hypothetical the 1983 debate contained, an interceptor layer at the defence lab's arithmetic.
- **The search.** Random restarts with hill climbing or annealing over the discrete and continuous variables, one seed per restart, the best-so-far kept per objective, the run history kept so the counter can show the improvement.
- **The constraints.** General war (execution is not optional), coverage of the target list at or above a threshold, a retaliatory force above zero, and any the reader adds.
- **The display.** The globe turning, the occasional trajectory drawn from the plan under evaluation, no detonations, the counter and the iteration number, and a panel of the objectives with each one's own optimum so the reader can see them pull apart. Minimal chrome, in the loop's register.

## Where it sits

Beside the loop as `#/wopr`, with the same exit. The first build should run on the window-of-vulnerability posture, because that study already carries the silo-survival arithmetic, the warning clock and both sides' forces of 1983.

## Built

`#/wopr` (`src/wopr/`). The globe turns; a phosphor panel in the corner reports the search; the controls sit at the bottom right with the exit.

- **The matrix.** `table.ts` computes, once per browser, the dead from one detonation on every target the search can strike, at each yield class the force carries (100, 335 and 1,100 kt for the American weapons; 500 and 1,000 kt for the Soviet), by the studies' method: the DCPA bands for blast and Postol's bound for fire, through the exposure workers over the 1985 grid. Three silos per wing stand for the field. About two thousand jobs; kept in `localStorage` under `grid84-wopr-table-v1`; *Recalibrate* clears it.
- **The assignment.** `assignments()` in `model.ts` pairs every target with the weapon a SAC planner of 1983 could have put on it, by the SIOP's categories: the Moscow command to the megaton class (Minuteman II W56), the ICBM fields to two W78 per silo, bomber and submarine bases to the SLBMs (W76), urban-industrial areas to the W76 by population with the W78 on those over a million and a half. The Soviet pairing is the window study's. The matrix panel shows the pairs with the dead from one detonation, so the reader sees the data input as data. The SIOP is withheld; the pairing is plausible inside the planners' rules, not leaked.
- **The evaluator.** `evaluate()` runs the window study's arithmetic on the matrix in under a millisecond: the Soviet first strike by rule with the assigned weapons, interception at the defence lab's arithmetic when the plan has interceptors, silo survival as (1 − p)^n with p from the lethality model at the seed's CEP, bombers caught on coastal bases, the American answer by rule (a launch under attack if the decision falls before the first arrival), coverage, the fraction of the Soviet urban population inside the lethal bands, the fraction of force sites struck, the surviving retaliatory force, the Soviet reserve on the cities. A plan is scored as the sum over struck targets with the largest weapon counting once, without the union's once-only counting across targets. Seeds draw reliability, CEP and bomber penetration inside their published ranges.
- **The plan space.** The American plan: ride out or launch under attack, the decision minute, the bomber alert fraction, the execution option, the allocation rule, and a hypothetical interceptor layer. The Soviet first strike is the scenario, not the planner's choice: full commitment, its rule a control (on the forces, on the cities, mixed), so the machine cannot improve the outcome by making the enemy hold back. Reliability is drawn by the seeds across its published range, not chosen.
- **The search.** Annealing with random restarts every six hundred evaluations, ten evaluations a tick on a timer (so it goes on in a background tab), three seeds each; a candidate that beats the best is re-scored over sixteen seeds and kept only if it still does, and the range is printed. Every objective keeps its own best from the same stream, and the table shows them pulling apart.
- **The constraints.** General war (execution is not optional), coverage of the target list at ninety-five per cent, a retaliatory force above zero; each a toggle, the second and third moot when the first is off. With general war off, the plan space includes standing down, on both sides, and the machine finds it: *OPTIMAL POLICY: DO NOT LAUNCH*.
- **Turgidson.** One line prints the own-side dead of the best plan with its range over the seeds, beside the stated acceptable loss of 1964 (twenty million, tops, depending on the breaks) and the lowest own-side figure the run has found. The machine does not comment.

### The lessons the first runs gave

Two W78 on every Soviet silo is 2,648 weapons; what survives a ride-out and fires is about 2,900. The pure counterforce option therefore cannot cover the list, and the constraint rejects it; the mixed and countervalue rules are what the machine settles on. That is a fair reading of what happened to the SIOP's counterforce ambitions once the Soviet silo count passed a thousand.

Under general war against a full first strike on the forces the best found in the first runs was about 118 to 129 million dead, 68.5 million of them American, and the range over the seeds was a point: every listed American target is struck in every draw, whatever the reliability, the accuracy or the interceptors, because seven thousand Soviet warheads against three hundred cells and a few dozen bases leave nothing to chance. The own-side objective cannot move the American figure at all. The lowest own-side figure the machine finds sits beside the twenty million of 1964 without comment.

The surrogate counts the largest weapon on each target once, so the totals are the sum of one detonation per listed cell; the true figures for cities that draw eight or twelve weapons are higher, and the union of the studies would give them.

### What it does not do

No fallout, no fratricide, no C3 degradation, no bombers over the pole, no re-summing of the best plan by the full union (the brief asked for it; the surrogate's error is the overlap between neighbouring targets and is stated rather than corrected). The Soviet target list of the 1983 record is not public and is stood in for by the grid's most populous cells under their 1983 names.
