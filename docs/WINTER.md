# The years after

**What the weapons start and the sky finishes.** A zonal climate model, a
crop model and a food-system model, at `#/winter`, over fifteen years.

## Why a different model

Everything else in this engine works in minutes and kilometres over a
population grid. The thing that follows a general war works in months and
degrees of latitude over the whole planet, and none of the machinery
transfers. A plume is a local object; a soot layer in the stratosphere is
not. The prompt effects kill people where the weapon lands; the winter
kills people who never saw one.

The scale of that difference is the point of the mode. For the global
case the weapons kill 360 million people and the famine leaves six and a
half billion without food. The horrors of mass death are the beginning
of it.

## The chain

Five boxes, each with its own file, its own sources and its own controls
where the published work is uncertain.

**The source term** (`src/models/soot.ts`). Toon's chain, in four
multiplications: thirteen square kilometres set alight per fifteen
kilotonnes, taken linear in yield; eleven tonnes of combustible material
per person; two per cent of burned fuel emitted as black carbon; a fifth
lost to the fire's own black rain and an eighth of the rest before it is
above the weather. Multiplied out, that is **about a hundred and fifty
kilogrammes of stratospheric soot for every person inside the fire**, and
it reproduces both published anchors: a hundred fifteen-kilotonne weapons
over Indian and Pakistani cities reach some thirty million people, which
is five teragrams; four thousand four hundred hundred-kilotonne weapons
over the northern hemisphere reach about a billion, which is a hundred and
fifty.

**The sky** (`src/models/winter.ts`). A zonal energy-balance model: the
world in eighteen ten-degree bands, each with a land tile and an ocean
tile, each keeping a surface energy budget as the seasons turn and the
soot shades them. The soot spreads along its own hemisphere in a couple of
months and across the equator in about a year, and is removed with the
published e-folding times. Sea ice forms when a sea surface reaches
freezing and then falls like land, because the ice cuts it off from the
ocean beneath.

**The harvest** (`src/models/harvest.ts`). Liebig's law over four factors:
heat accumulated above five degrees against what a staple crop needs to
ripen, light on a saturating curve, water, and a hard cut for a killing
frost the war added inside a growing season.

**The food system** (`src/models/famine.ts`). The buffers, each of which
can be spent once: the animals that eat a third of the world's crop
calories and return a tenth, the fifth of the food that is thrown away,
the ships. Then the published mortality rule: count the calories, divide
by what a person can live on while losing weight, and the remainder is the
number the world can feed.

**The ultraviolet** (`src/models/ozone.ts`). A quarter of the ozone column
for a regional war, three quarters for a global one, and the sign change
that follows: while the soot is thick it blocks ultraviolet too, so the
worst of the burning comes years after the worst of the cold.

## What the reader can change, and why those things

Two controls, because there are two real arguments.

**How much fuel is in a city**, from 0.1 to 60 grammes per square
centimetre. This is the whole disagreement. Reisner's group simulated a
regional war and found no nuclear winter; Robock's group obtained their
fuel map and measured the target area at 0.14 g/cm², against the 12.6 to
94.5 of Toon's Indian and Pakistani targets. Below about four a fire does
not organise into a firestorm, and without a firestorm the smoke never
rises above the weather. Wagman's independent run at Livermore held
everything else fixed and swept only this: at one there is no global
forcing at all, at sixteen the stratosphere. So it is a slider, marked
with every published measurement, and moving it takes the same four
thousand four hundred weapons from one and a half teragrams to over three
hundred.

The National Academies reviewed all of it in 2025 and declined to say who
was right. Hiroshima's own fuel loading is published at 3.9, at 10 and at
16 by three different authorities.

**What the world does about food**: whether grain still goes to animals,
whether anything is still thrown away, whether ships still sail. These are
Xia's own variants, and they reproduce his finding, which is the most
useful thing in the paper: at five teragrams the buffers absorb everything
and nobody need die; at a hundred and fifty there is no arrangement of
them that feeds the world.

## What it does not do

It does not model the injured who die because there are no hospitals, the
water, the sewage, the disease, the fuel, the killing over what is left,
or anything at all about how a society behaves while it is starving.
Those are not small corrections. On the published evidence they are larger
than everything counted here, and they are why the number this page shows
is a floor.

It resolves latitude and not longitude, so it cannot say that Australia
does better and Ukraine worse; it has one number for the tropics where the
gridded crop models have a hundred thousand. Its no-trade case is
correspondingly optimistic in the middle of the range, because a
ten-degree band feeds itself from a pot that in reality is a dozen
countries that would not share it.

And the soot's own attenuation of ultraviolet is taken as equal to its
attenuation of light, which understates the peak ultraviolet by about a
third against Bardeen's model.

## Sources

- Turco, Toon, Ackerman, Pollack & Sagan, "Nuclear winter: global consequences of multiple nuclear explosions", *Science* 222 (1983).
- Toon, Turco, Robock, Bardeen, Oman & Stenchikov, *Atmos. Chem. Phys.* 7 (2007), 1973–2002 — the source term, §6 and Table 13.
- Robock, Oman, Stenchikov, Toon, Bardeen & Turco, *Atmos. Chem. Phys.* 7 (2007), 2003–2012 — the five-teragram case.
- Robock, Oman & Stenchikov, "Nuclear winter revisited with a modern climate model", *J. Geophys. Res.* 112 (2007), D13107 — 150 and 50 Tg, and the soot lifetimes.
- Toon, Robock & Turco, "Environmental consequences of nuclear war", *Physics Today* 61 (2008) — the 180 Tg from 4,400 weapons.
- Toon et al., "Rapidly expanding nuclear arsenals in Pakistan and India portend regional and global catastrophe", *Science Advances* 5 (2019), eaay5478.
- Coupe, Bardeen, Robock & Toon, *J. Geophys. Res. Atmos.* 124 (2019) — WACCM4 at 150 Tg.
- Mills, Toon, Lee-Taylor & Robock, *Earth's Future* 2 (2014) — growing season, 10 to 40 days for five years.
- Xia, Robock, Scherrer, Harrison, Bodirsky, Weindl, Jägermeyr, Bardeen, Toon & Heneghan, *Nature Food* 3 (2022), 586–596 — the famine, and every figure this model is set against.
- Bardeen, Kinnison, Toon, Mills, Vitt, Xia, Jägermeyr, Lovenduski, Scherrer, Clyne & Robock, *J. Geophys. Res. Atmos.* 126 (2021) — ozone and ultraviolet.
- Reisner et al., *J. Geophys. Res. Atmos.* 123 (2018), 2752–2772, and the Reply, 124 (2019), 12,959–12,962.
- Robock, Toon & Bardeen, Comment, *J. Geophys. Res. Atmos.* 124 (2019), 12,953–12,958.
- Wagman, Lundquist, Tang, Glascoe & Bader, *J. Geophys. Res. Atmos.* 125 (2020) — the fuel-loading sweep.
- Tarshish & Romps, *J. Geophys. Res. Atmos.* 127 (2022) — the moisture that decides whether the plume rises.
- National Academies, *Potential Environmental Effects of Nuclear War* (2025).
- North, Cahalan & Coakley, "Energy balance climate models", *Rev. Geophys.* 19 (1981) — the form of the model itself.
- HYDE 3.3 (2023) for the land, the people, the built-up area and the cropland, by ten-degree band.
