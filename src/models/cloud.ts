/**
 * The cloud.
 *
 * This engine is about effects rather than spectacle, and the mushroom cloud
 * is the most photographed and least informative thing about a nuclear
 * explosion. It earns a place here for one reason: where the cloud stops
 * rising decides where the fission products go, and that is a question the
 * rest of the engine already turns on.
 *
 * A cloud that stabilises inside the troposphere puts its activity where the
 * weather is, and the weather brings it down over a county within a day —
 * which is the local plume the fallout model draws from Table 9.93. A cloud
 * that punches through the tropopause puts part of its activity into the
 * stratosphere, where there is no weather to wash it out, and it comes down
 * over a hemisphere over months and years, much decayed and much diluted.
 * The engine models the first and does not model the second, and the readouts
 * say so. This is the calculation that decides which case a given burst is.
 *
 * It is the same threshold the winter model turns on, asked about a different
 * quantity: soot above the tropopause is soot that does not rain out.
 *
 * The dimensions are Glasstone & Dolan, 1977 edition, chapter II:
 *
 *   §2.15  The cloud reaches its maximum height after about ten minutes and
 *          is then said to be stabilized.
 *   §2.16  Figure 2.16 gives approximate average values of cloud height and
 *          radius at about ten minutes, for land surface or low air bursts,
 *          under the conditions most likely to be met in the continental
 *          United States. Below about 15 kilotonnes the heights are above the
 *          burst point; above it they are above sea level. The flattening of
 *          the height curve between about 20 and 100 kilotonnes is the
 *          tropopause slowing the rise — the threshold this file exists for,
 *          visible in the source data as a kink.
 *   §2.17  Below about 20 kilotonnes the stem is about half the radius of the
 *          head. With increasing yield the ratio falls, and in the megatonne
 *          range the stem may be a fifth to a tenth as wide as the cloud.
 *          For clouds that do not penetrate the tropopause the base of the
 *          head is very roughly half the altitude of the top.
 *
 * Figure 2.16 is a figure and not a table, so what is used here is a fit to
 * it and not Glasstone — the same standing this engine gives the lethal-radius
 * fit in the accuracy model. The fit is the published one that accompanies the
 * Wikimedia reproduction of the figure, in yield W kilotonnes with
 * LW = log10(W):
 *
 *   top    = 3.0 km · 10^(0.006941·LW⁴ − 0.06216·LW³ + 0.1526·LW² + 0.1878·LW)
 *   radius = 0.6 km · 10^(0.0137·LW³ − 0.0358·LW² + 0.37·LW)
 *
 * The curves cover test data to about 50 megatonnes, which is Tsar Bomba, and
 * beyond that they are extrapolation. Everything here is the land surface or
 * low air burst of the figure's own caption: a burst high enough that the
 * fireball never touches the ground lofts no soil, and its cloud is smaller
 * and its fallout is a different problem.
 */

export const CLOUD = {
  /** §2.15. Minutes from the burst to the stabilized cloud. */
  minutesToStabilise: 10,
  /** The fit to Figure 2.16: kilometres at one kilotonne, and the log-yield polynomial. */
  topKmAtOneKt: 3.0,
  topPolynomial: [0.1878, 0.1526, -0.06216, 0.006941] as const,
  radiusKmAtOneKt: 0.6,
  radiusPolynomial: [0.37, -0.0358, 0.0137] as const,
  /** §2.16. Above this yield the figure's heights are above sea level, below it above the burst point. */
  aboveSeaLevelFromKt: 15,
  /** §2.16. The yield range in which the figure's height curve flattens against the tropopause. */
  tropopauseFlatteningKt: [20, 100] as const,
  /** §2.17. The base of a head that stays under the tropopause, as a fraction of the top. */
  baseFractionOfTop: 0.5,
  /** §2.17. The stem as a fraction of the head's radius, below 20 kt and in the megatonne range. */
  stemFractionSmall: 0.5,
  stemFractionMegatonne: [0.1, 0.2] as const,
  stemSmallBelowKt: 20,
  /** The yield beyond which the fitted curves are extrapolation past any test. */
  fittedToKt: 50_000,
  source: 'Glasstone & Dolan 1977 Fig. 2.16, §§2.15–2.17',
} as const

/**
 * The tropopause, metres. The engine's default is the ICAO Standard
 * Atmosphere's 11 km, which is also about where it sits over the continental
 * United States that Figure 2.16 assumes. The real tropopause runs from about
 * 8 km over the poles to about 17 km over the tropics and moves with the
 * season, so a burst whose cloud top is anywhere near this figure is a burst
 * whose answer depends on the day. The latitude form below is a smooth
 * cosine between those two ends and is inferred, not measured.
 */
export const TROPOPAUSE_METRES = 11_000
export const TROPOPAUSE_POLAR_METRES = 8_000
export const TROPOPAUSE_TROPICAL_METRES = 17_000

export function tropopauseMetres(latitude?: number): number {
  if (latitude === undefined) return TROPOPAUSE_METRES
  const c = Math.cos((Math.abs(latitude) * Math.PI) / 180)
  return TROPOPAUSE_POLAR_METRES + (TROPOPAUSE_TROPICAL_METRES - TROPOPAUSE_POLAR_METRES) * c ** 2
}

const evaluate = (coefficients: readonly number[], x: number): number =>
  coefficients.reduce((sum, c, i) => sum + c * x ** (i + 1), 0)

/** Height of the stabilized cloud top, metres. */
export function cloudTopMetres(yieldKt: number): number {
  if (yieldKt <= 0) return 0
  const lw = Math.log10(yieldKt)
  return CLOUD.topKmAtOneKt * 1_000 * 10 ** evaluate(CLOUD.topPolynomial, lw)
}

/** Radius of the stabilized cloud head, metres. */
export function cloudRadiusMetres(yieldKt: number): number {
  if (yieldKt <= 0) return 0
  const lw = Math.log10(yieldKt)
  return CLOUD.radiusKmAtOneKt * 1_000 * 10 ** evaluate(CLOUD.radiusPolynomial, lw)
}

export interface StabilisedCloud {
  yieldKt: number
  /** Metres. Above the burst point below 15 kt, above sea level above it — §2.16. */
  topMetres: number
  /**
   * The base of the head, metres, or null. Glasstone's half-the-top rule is
   * stated only for clouds that stay under the tropopause (§2.17); for a cloud
   * that penetrates it, the book gives no rule and neither does this.
   */
  baseMetres: number | null
  radiusMetres: number
  /** The stem, metres, as a range: the ratio to the head falls with yield (§2.17). */
  stemRadiusMetres: [number, number]
  minutesToStabilise: number
  tropopauseMetres: number
  /** Whether the top stands above the tropopause, which is the whole point. */
  penetratesTropopause: boolean
  /** True beyond about 50 Mt, where the fitted curves run past every test. */
  extrapolated: boolean
  source: string
  method: string
}

/**
 * The stabilized cloud of a land surface or low air burst. `latitude` moves
 * the tropopause; leave it out for the standard 11 km.
 */
export function stabilisedCloud(yieldKt: number, latitude?: number): StabilisedCloud {
  const top = cloudTopMetres(yieldKt)
  const radius = cloudRadiusMetres(yieldKt)
  const tropopause = tropopauseMetres(latitude)
  const penetrates = top > tropopause
  const stem: [number, number] =
    yieldKt < CLOUD.stemSmallBelowKt
      ? [radius * CLOUD.stemFractionSmall, radius * CLOUD.stemFractionSmall]
      : [radius * CLOUD.stemFractionMegatonne[0], radius * CLOUD.stemFractionMegatonne[1]]
  return {
    yieldKt,
    topMetres: top,
    baseMetres: penetrates ? null : top * CLOUD.baseFractionOfTop,
    radiusMetres: radius,
    stemRadiusMetres: stem,
    minutesToStabilise: CLOUD.minutesToStabilise,
    tropopauseMetres: tropopause,
    penetratesTropopause: penetrates,
    extrapolated: yieldKt > CLOUD.fittedToKt,
    source: CLOUD.source,
    method:
      'A published fit to Figure 2.16, which is a figure and not a table, so this is a fit to Glasstone and not Glasstone. Land surface or low air burst, average continental conditions; the curves follow test data to about 50 Mt and extrapolate beyond it.',
  }
}

/**
 * What the tropopause crossing means for the fallout, in one line. This is the
 * sentence the readout wants, and it is the reason the cloud is computed at
 * all.
 */
export function falloutRegime(cloud: StabilisedCloud): string {
  return cloud.penetratesTropopause
    ? `The cloud top stands above the tropopause, so part of the activity is injected into the stratosphere, where nothing washes it out. That fraction comes down worldwide over months and years and is not in any local plume — this engine does not model it.`
    : `The cloud stabilises inside the troposphere, where the weather reaches it, so the activity comes down locally within hours to days. That is the plume the fallout model draws.`
}
