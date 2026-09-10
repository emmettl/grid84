# WOPR

**A constrained optimiser over a 1980s force posture, searching the strategy space for a better apocalypse.** A planning brief, 10 September 2026, from the user's proposal. Not yet built. The loop at `#/loop` stays as it is; this is a second mode beside it.

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
