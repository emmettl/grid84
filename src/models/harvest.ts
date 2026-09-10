import { baseline, type WinterFrame, type Zonal } from './winter.ts'

/**
 * What grows, and what stops growing.
 *
 * A crop does not care about the annual mean temperature. It cares whether
 * the season is long enough and warm enough to take it from sowing to
 * grain, whether a frost comes before it is ripe, whether there is light,
 * and whether there is rain. Nuclear winter attacks all four at once, and
 * the first of them is the one that kills a harvest outright: a maize crop
 * needs something like fourteen hundred growing degree days above ten
 * degrees, and a cold summer that halves the accumulation does not halve
 * the harvest, it ends it.
 *
 * So the yield here is not a linear function of temperature. It is
 * Liebig's law over four factors: heat accumulated over the season,
 * light, water, and a hard cut for a killing frost inside the growing
 * months. The three-dimensional studies do this with gridded crop models
 * calibrated per crop and per country; a zonal band with one number for
 * heat and one for light is a coarse instrument beside that, and the
 * thresholds in it are set so the whole chain reproduces the published
 * losses at the published soot loadings.
 *
 * Sources: Xia, Robock, Scherrer, Harrison, Bardeen, Mills et al., "Global
 * food insecurity and famine from regional and global nuclear conflict",
 * Nature Food 3 (2022), for the losses this is set against; Cassidy, West,
 * Gerber & Foley, "Redefining agricultural yields: from tonnes to people
 * nourished per hectare", Environ. Res. Lett. 8 (2013), for what the
 * world's cropland actually produces in calories.
 */

/**
 * Primary crop calories the world produces, per person per day, before any
 * of it goes to animals, to industry or to waste. Cassidy et al. 2013.
 */
export const CROP_CALORIES_PER_PERSON_DAY = 4_600

export const HARVEST_PARAMETERS = {
  /** Base temperature for growing degree days, °C: the point below which a staple crop does not develop. */
  baseTemperature: 5,
  /** A month whose mean is below this is a killing frost for anything standing in the field. */
  frostMonth: 2,
  /**
   * Heat, in growing degree days above the base temperature, that a staple
   * crop needs to go from sowing to grain. Wheat, maize and rice all sit
   * near fifteen hundred. This is an absolute requirement and not a
   * fraction of what a place normally gets, which is much of the difference
   * between the tropics and the middle latitudes under a shaded sky: the
   * Gangetic plain accumulates three times what a crop needs and can lose
   * two thirds of it and still ripen one, while Ukraine has barely more
   * than one crop's worth to begin with and loses everything.
   */
  requirementGdd: 1_200,
  /** As a multiple of that requirement: below the floor nothing ripens, above the full mark heat is not the limit. */
  heatFloor: 0.4,
  heatFull: 1.1,
  /**
   * How much of a place's surplus heat is actually being used for a second
   * or third crop in the year, and so is lost when the heat is lost. At
   * nought, heat above one crop's requirement is worth nothing; at one,
   * production scales with the whole heat accumulation.
   */
  multiCrop: 0.06,
  /**
   * Light. A leaf is not a solar panel: photosynthesis saturates well below
   * full sunlight, so a crop under half the normal light does not lose half
   * its yield. The floor is the compensation point, where the plant
   * respires away as much as it fixes and the yield is nothing; the
   * exponent is the saturation, and at the fitted value a halving of the
   * light costs about a tenth of the harvest. The exponent went to the edge
   * of its range in the fit, which is the model saying that the published
   * crop losses at moderate soot loadings are driven by cold and not by
   * darkness. Below about a fifth of normal light this curve is too kind.
   */
  lightFloor: 0.03,
  lightExponent: 0.15,
  /** Water, on the same shape: soil moisture and irrigation carry a crop through a dry year, up to a point. */
  waterFloor: 0.14,
  waterExponent: 0.2,
  /** What is left of a crop that met a killing frost mid-season. */
  frostSurvival: 0.33,
} as const

/** A factor that is nought below the floor, one above the full mark, and linear between them. */
function ramp(value: number, floor: number, full: number): number {
  if (value <= floor) return 0
  if (value >= full) return 1
  return (value - floor) / (full - floor)
}

/** A saturating response: nought at the compensation point, one at full supply, and concave between them. */
function saturating(value: number, floor: number, exponent: number): number {
  if (value <= floor) return 0
  return Math.min(1, ((value - floor) / (1 - floor)) ** exponent)
}

/** Growing degree days accumulated over twelve months of land temperature, base 8 °C. */
export function degreeDays(monthlyTemps: number[], base = HARVEST_PARAMETERS.baseTemperature): number {
  return monthlyTemps.reduce((a, t) => a + Math.max(0, t - base) * (365.25 / 12), 0)
}

/** The undisturbed year: what each band's land accumulates with no soot in the sky. */
export function baselineDegreeDays(zonal: Zonal): number[] {
  return zonal.bands.map((b) => {
    const lat = (b.south + b.north) / 2
    return degreeDays(Array.from({ length: 12 }, (_, m) => baseline(lat, m, 'land')))
  })
}

export interface HarvestYear {
  /** Years after the exchange; year 1 is the first full year. */
  year: number
  /** Per band. */
  yieldFactor: number[]
  degreeDays: number[]
  frostMonths: number[]
  /** Calories the band produces, and the world's total, both as a fraction of the undisturbed year. */
  bandFraction: number[]
  fraction: number
  calories: number
}

/**
 * The harvest, year by year, from the climate the winter model gives. Each
 * year is taken as the twelve months beginning at the anniversary of the
 * exchange, which is not how a crop calendar works but is what a zonal
 * model can honestly say.
 */
export function harvest(frames: WinterFrame[], zonal: Zonal, options: { parameters?: Partial<typeof HARVEST_PARAMETERS>; population?: number } = {}): HarvestYear[] {
  const p = { ...HARVEST_PARAMETERS, ...options.parameters }
  const base = baselineDegreeDays(zonal)
  const cropland = zonal.bands.map((b) => b.croplandKm2)
  const croplandTotal = cropland.reduce((a, b) => a + b, 0)
  const population = options.population ?? zonal.bands.reduce((a, b) => a + b.population, 0)
  const wholeCrop = CROP_CALORIES_PER_PERSON_DAY * population * 365.25
  const years: HarvestYear[] = []
  const yearCount = Math.floor((frames.length - 1) / 12)
  for (let y = 0; y < yearCount; y += 1) {
    const window = frames.slice(y * 12, y * 12 + 12)
    const yieldFactor: number[] = []
    const gdd: number[] = []
    const frostMonths: number[] = []
    for (let i = 0; i < zonal.bands.length; i += 1) {
      const temps = window.map((f) => f.landTemp[i])
      const g = degreeDays(temps, p.baseTemperature)
      gdd.push(g)
      const ripens = ramp(g / p.requirementGdd, p.heatFloor, p.heatFull)
      const seasons = base[i] > 0 ? Math.min(1, (g / base[i]) ** p.multiCrop) : 0
      const heat = ripens * seasons
      // A frost is only a frost if it is one the war added, and only if it
      // falls where a crop would have been standing. Every mid-latitude
      // winter has months below freezing already, and the fields are empty.
      const lat = (zonal.bands[i].south + zonal.bands[i].north) / 2
      const normal = Array.from({ length: 12 }, (_, m) => baseline(lat, m, 'land'))
      const growing = temps.filter((t) => t > p.baseTemperature).length
      const frosts = temps.filter((t) => t < p.frostMonth).length
      const wasFrost = normal.filter((t) => t < p.frostMonth).length
      const extraFrosts = Math.max(0, frosts - wasFrost)
      frostMonths.push(extraFrosts)
      const light = saturating(window.reduce((a, f) => a + f.sunlight[i], 0) / window.length, p.lightFloor, p.lightExponent)
      const water = saturating(window.reduce((a, f) => a + f.precipitationBand[i], 0) / window.length, p.waterFloor, p.waterExponent)
      const baseGrowing = normal.filter((t) => t > p.baseTemperature).length
      const frostHit = extraFrosts > 0 ? 1 - (1 - p.frostSurvival) * Math.min(1, extraFrosts / Math.max(1, baseGrowing)) : 1
      yieldFactor.push(growing === 0 ? 0 : Math.min(heat, light, water) * frostHit)
    }
    const bandFraction = yieldFactor.map((f, i) => (croplandTotal > 0 ? (f * cropland[i]) / croplandTotal : 0))
    const fraction = bandFraction.reduce((a, b) => a + b, 0)
    years.push({ year: y + 1, yieldFactor, degreeDays: gdd, frostMonths, bandFraction, fraction, calories: fraction * wholeCrop })
  }
  return years
}

/** The undisturbed world's crop calories, for the ledger to set the loss against. */
export function baselineCalories(zonal: Zonal): number {
  return CROP_CALORIES_PER_PERSON_DAY * zonal.bands.reduce((a, b) => a + b.population, 0) * 365.25
}
