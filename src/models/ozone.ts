/**
 * The other sky: ozone, and the ultraviolet that follows it.
 *
 * The soot does not only shade the ground. It absorbs sunlight where it
 * sits, which heats the stratosphere by tens of degrees, and a hot
 * stratosphere destroys ozone: the reactions that consume it run faster,
 * and the circulation that replenishes it is thrown over. Bardeen's group
 * put the loss at a quarter of the ozone column for a regional war and
 * three quarters for a global one, held for well over a decade.
 *
 * What that does at the surface is the part worth being careful about,
 * because it changes sign. While the soot is thick it blocks ultraviolet
 * as effectively as it blocks light, so for the first years after a global
 * war the ultraviolet at the ground is *lower* than normal. Then the soot
 * clears, and the ozone is still gone, and the ultraviolet index over the
 * tropics goes past thirty-five and stays there for four years, against a
 * present-day maximum of about twenty-six. For a regional war there is no
 * such reprieve: too little soot to shade anything, enough to wreck the
 * ozone, so the ultraviolet rises from the start.
 *
 * The arithmetic here is the standard one, and it is cruder than theirs:
 * taking the soot's attenuation of ultraviolet as equal to its attenuation
 * of light, this reaches about thirty where their model reaches fifty. The
 * shape is right and the peak is understated.
 *
 * The arithmetic: ultraviolet at the surface goes
 * as the ozone column to the power of the radiation amplification factor,
 * about 1.2 for the erythemal weighting, and the soot multiplies whatever
 * is left.
 *
 * Source: Bardeen, Kinnison, Toon, Mills, Vitt, Xia, Jägermeyr, Lovenduski,
 * Scherrer, Clyne & Robock, "Extreme ozone loss following nuclear war
 * results in enhanced surface ultraviolet radiation", J. Geophys. Res.
 * Atmos. 126 (2021), e2021JD035079; Mills et al., PNAS 105 (2008) and
 * Earth's Future 2 (2014) for the regional case.
 */

export const OZONE = {
  /** Peak column loss for a five-teragram injection, and how it grows with the injection. Bardeen 2021: a quarter at 5 Tg, three quarters at 150. */
  lossAtFive: 0.25,
  lossExponent: 0.323,
  lossCap: 0.85,
  /** How long the loss takes to develop, months. Bardeen gives two to three years for the regional case. */
  riseMonths: 10,
  /** How long it takes to come back: twelve years for a regional war, fifteen for a global one. */
  recoveryMonths: 78,
  /** The radiation amplification factor: a one per cent loss of column ozone is a 1.2 per cent rise in erythemal ultraviolet. */
  amplification: 1.2,
  /** Present-day maximum ultraviolet index, tropics at noon: the value Bardeen's maps give for the control run. */
  baselineIndex: 26,
} as const

/** The fraction of the ozone column still there, by months since the exchange. */
export function ozoneColumn(sootTg: number, months: number): number {
  if (sootTg <= 0 || months < 0) return 1
  const peak = Math.min(OZONE.lossCap, OZONE.lossAtFive * (sootTg / 5) ** OZONE.lossExponent)
  const shape = (t: number) => (1 - Math.exp(-t / OZONE.riseMonths)) * Math.exp(-t / OZONE.recoveryMonths)
  // Normalised so the shape peaks at one, and the peak is the published loss.
  let max = 0
  for (let t = 0; t < 240; t += 1) max = Math.max(max, shape(t))
  return 1 - (peak * shape(months)) / max
}

/**
 * The ultraviolet index at the surface, tropics at noon: the ozone that is
 * gone raises it, and the soot that is still up there holds it down. The
 * crossing point between the two is the moment the survivors of a global
 * war stop being cold and start being burned.
 */
export function ultraviolet(sootTg: number, months: number, opticalDepth: number): number {
  const column = ozoneColumn(sootTg, months)
  // The index is a noon figure with the sun overhead, so the path through the
  // soot is the vertical one, not the slant path the daily energy budget takes.
  return OZONE.baselineIndex * column ** -OZONE.amplification * Math.exp(-Math.max(0, opticalDepth))
}
