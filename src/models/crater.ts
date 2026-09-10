/**
 * The hole.
 *
 * A weapon burst at the optimum height for blast makes no crater at all:
 * the fireball never touches the ground. One burst on the surface, which
 * is what a plan does to a hard target and what a plan does when it wants
 * fallout, digs a hole and throws what was in it into the air. The two
 * facts are the same fact — the soil that leaves the crater is the soil
 * the fission products condense onto, and the plume the fallout model
 * draws is this material coming down again.
 *
 * The dimensions are Glasstone & Dolan's, from the 1977 edition:
 *
 *   §6.09  A one-kilotonne burst on the surface of dry soil or dry soft
 *          rock makes an apparent crater about 60 feet in radius and about
 *          30 feet deep, with the crest of the lip some 15 feet further
 *          out than the crater's own edge. Every dimension scales as the
 *          yield to the power 0.3. The book's own worked example: a
 *          hundred kilotonnes gives 60 × 100^0.3 = 240 feet of radius and
 *          30 × 100^0.3 = 120 feet of depth.
 *   §6.71  The lip crest stands at 1.25 times the apparent radius, and
 *          about a quarter of the apparent depth above the original
 *          surface.
 *   §6.74  Continuous ejecta reaches about 2.15 times the apparent radius.
 *
 * Two things the book says and this does not compute. In water-saturated
 * soil the radius is appreciably greater and the final depth shallower,
 * because the hole fills; in hard rock the dimensions are somewhat less.
 * Neither is given a number in the text, so neither is given one here.
 * Everything below is the dry soil and dry soft rock case, and the readout
 * says so.
 */

export const CRATER = {
  /** Apparent crater radius and depth for one kilotonne on dry soil or dry soft rock, feet. §6.09 */
  radiusFeetAtOneKt: 60,
  depthFeetAtOneKt: 30,
  /** How far beyond the crater's edge the crest of the lip stands at one kilotonne, feet. §6.09 */
  lipCrestExtraFeetAtOneKt: 15,
  /** Every dimension goes as the yield to this power. §6.09 */
  exponent: 0.3,
  /** The lip crest, as multiples of the apparent radius and depth. §6.71 */
  lipRadiusFactor: 1.25,
  lipHeightFactor: 0.25,
  /** The reach of continuous ejecta, as a multiple of the apparent radius. §6.74 */
  ejectaRadiusFactor: 2.15,
  medium: 'dry soil or dry soft rock',
} as const

const FOOT = 0.3048

/** Apparent crater radius in metres for a surface burst. */
export function craterRadiusMetres(yieldKt: number): number {
  if (yieldKt <= 0) return 0
  return CRATER.radiusFeetAtOneKt * yieldKt ** CRATER.exponent * FOOT
}

/** Apparent crater depth in metres for a surface burst. */
export function craterDepthMetres(yieldKt: number): number {
  if (yieldKt <= 0) return 0
  return CRATER.depthFeetAtOneKt * yieldKt ** CRATER.exponent * FOOT
}

/** Radius to the crest of the lip, metres. */
export function lipCrestRadiusMetres(yieldKt: number): number {
  return craterRadiusMetres(yieldKt) * CRATER.lipRadiusFactor
}

/** Height of the lip crest above the original surface, metres. */
export function lipHeightMetres(yieldKt: number): number {
  return craterDepthMetres(yieldKt) * CRATER.lipHeightFactor
}

/** How far continuous ejecta reaches, metres. */
export function ejectaRadiusMetres(yieldKt: number): number {
  return craterRadiusMetres(yieldKt) * CRATER.ejectaRadiusFactor
}

/**
 * The volume of the apparent crater, cubic metres, taking it as a
 * paraboloid of revolution, which is the shape the book's own profiles
 * have. This is the material that goes up, and it is the reason a surface
 * burst has a plume and an air burst does not.
 */
export function craterVolumeCubicMetres(yieldKt: number): number {
  const r = craterRadiusMetres(yieldKt)
  return 0.5 * Math.PI * r * r * craterDepthMetres(yieldKt)
}

/** Roughly how much soil that is, in tonnes, at a bulk density of 1.6 t/m³ for dry soil. */
export const SOIL_DENSITY_TONNES_PER_CUBIC_METRE = 1.6

export interface Crater {
  yieldKt: number
  radiusMetres: number
  depthMetres: number
  lipCrestRadiusMetres: number
  lipHeightMetres: number
  ejectaRadiusMetres: number
  volumeCubicMetres: number
  massTonnes: number
  medium: string
  source: string
}

export function crater(yieldKt: number): Crater {
  const volume = craterVolumeCubicMetres(yieldKt)
  return {
    yieldKt,
    radiusMetres: craterRadiusMetres(yieldKt),
    depthMetres: craterDepthMetres(yieldKt),
    lipCrestRadiusMetres: lipCrestRadiusMetres(yieldKt),
    lipHeightMetres: lipHeightMetres(yieldKt),
    ejectaRadiusMetres: ejectaRadiusMetres(yieldKt),
    volumeCubicMetres: volume,
    massTonnes: volume * SOIL_DENSITY_TONNES_PER_CUBIC_METRE,
    medium: CRATER.medium,
    source: 'Glasstone & Dolan 1977 §6.09, §6.71, §6.74; dry soil or dry soft rock, surface burst',
  }
}
