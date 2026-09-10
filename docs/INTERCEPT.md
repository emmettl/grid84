# Interception

**Four phases, four reasons it is hard, and the arithmetic of each.** At
`#/lab/intercept`, with the models in `src/models/intercept.ts`.

## Why a lab and not a table

The phrase is "like hitting a bullet with a bullet", and it is usually
offered as the whole difficulty. It is the easy part. Hit-to-kill works: it
has worked in tests since the 1980s and in combat since. What defeats a
defence is not the closing geometry but four different clocks, one per
phase, and each of them is arithmetic that can be drawn.

## Boost

The target is one bright slow object with every warhead still aboard, and
killing it there drops the whole load short, on whoever is under the
trajectory rather than on the intended target. That is the attraction, and
it has been the attraction since the 1980s.

The clock is the motor. A solid-fuelled intercontinental missile burns for
about three minutes and a liquid one for about five. Detection takes about
a minute and a decision half a minute more, both of which are generous
round figures. What is left is the time an interceptor has to fly in, and
that time multiplied by the interceptor's speed is a circle it must
**already be inside** when the missile lifts.

Nobody can be everywhere. An interceptor in low orbit is somewhere else
almost all of the time, and the fraction of a constellation that is inside
the circle at the moment of launch is the spherical cap the circle cuts out
of the shell they orbit on. For a 450 km circle and a 500 km orbit that
fraction is about a tenth of one per cent: a thousand interceptors put one
over the launch point. That ratio is the absentee problem and it is why
every serious proposal for boost-phase defence has been counted in
thousands rather than dozens.

## Midcourse

Twenty minutes of flight and nothing in a hurry, which is why every
deployed strategic defence works here. The price is vacuum.

The closing speed is about ten kilometres a second, so a tenth of a second
of error about when the target will be somewhere is a kilometre of being in
the wrong place, and cancelling that in the last ten seconds asks two
hundred metres a second of sideways push from a kill vehicle that carries a
few hundred. That is the bullet, and it is soluble: it is solved by
tracking well enough that the error is metres and not kilometres.

What is not soluble by better tracking is that in vacuum a balloon weighing
a few hundred grammes follows exactly the same path as a warhead weighing a
few hundred kilogrammes, because gravity acts on mass and produces the same
acceleration whatever the mass. There is nothing to tell them apart with
until they reach air, and by then most interceptors are out of altitude.
The defence must therefore engage everything it sees, and the attacker's
cheapest countermeasure is a bag of balloons.

## Glide

A vehicle that flies at forty kilometres instead of arcing to a thousand
stays under the horizon of a ground sensor for most of its flight. This is
geometry and not stealth: the horizon distance goes as the square root of
the altitude, so a sensor ten metres up sees a ballistic apogee at about
3,600 kilometres and a glide vehicle at about 700. At three kilometres a
second that is twenty minutes of warning against four. It also manoeuvres
while it is inside that distance, so the predicted intercept point moves.

## Terminal

The defence finally knows exactly where the target is going, because it is
going to the thing being defended. What it does not have is time. A warhead
descending at three kilometres a second at thirty degrees crosses the band
between 150 and 40 kilometres in about seventy seconds, and an interceptor
making 2.8 kilometres a second can therefore reach about 200 kilometres
from its battery.

That is the defended footprint, and the formula is the one thing on this
page that can be checked against deployed hardware. It reproduces both
published figures from each system's own interceptor speed: about two
hundred kilometres of radius for a high terminal battery, and about twenty
for a point-defence one. Two orders of magnitude of area between them for a
factor of less than two in speed, which is the whole reason terminal
defence protects a base or a city and not a country.

## The loop

`#/intercept` flies it. A real launcher from the atlas's own order of
battle, a real city from the most populous cells of the 2025 grid, the two
interceptor sites the American midcourse system is actually deployed at,
and one engagement at a time on the globe. A tally keeps count, and the log
reads the way the thing reads: miss, miss, miss, hit, miss.

A table does not make anyone feel a probability. That is the whole reason
the loop exists beside the lab rather than instead of it.

**No probability of kill is borrowed from a test range.** Each attempt is
drawn from the arithmetic above, and fails for one of four reasons, each of
which is one of the four phases' own:

- **Nothing in reach.** Drawn from the absentee ratio: with fifteen hundred
  interceptors in orbit against a three-minute booster, one and a half are
  expected over the launch point, so one attempt in five finds nothing to
  shoot with at all.
- **Went for a decoy.** With nine balloons on the same trajectory, nine
  times in ten the kill vehicle goes for the wrong object, because in
  vacuum nothing tells them apart.
- **Missed.** The kill vehicle could not null the error in the seconds it
  had: the correction available is half its divert times the time since
  handover, and the error was larger.
- **Killed.** It could. This is the part that works.

The default case is the documented one: a midcourse engagement against a
threat carrying simple balloon countermeasures, which the Union of
Concerned Scientists and MIT set out in *Countermeasures* in 2000 and which
the defence lab already models. Turn the decoys off and the same loop hits
almost every time, which is the honest shape of the argument: the closing
geometry is solved, and the defence fails for the other three reasons.

## What this lab deliberately does not do

It gives no probability of kill for any named system. Test records are
small, they are conducted against targets whose trajectory is known in
advance, and they are not the same thing as a defence against an attack
that is trying not to be intercepted. The shot-exchange arithmetic — what a
stock of interceptors does against a raid with decoys — is the
[defence lab](https://grid84.app/labs/defence/), which does use published
test records and says so.

## Sources

The arithmetic is standard: the horizon distance, the spherical cap, the
engagement-band time, and the two-body closing geometry. The published
figures the footprint formula is checked against are the defended radii
quoted for deployed terminal batteries. The boost window's detection and
decision times are round figures and are stated as such.
