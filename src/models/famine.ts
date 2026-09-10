import type { HarvestYear } from './harvest.ts'
import type { Zonal } from './winter.ts'

/**
 * The food system, and who is outside it.
 *
 * A harvest is not a meal. Between the field and the mouth stand the
 * animals that eat a third of the world's crop calories and return a
 * tenth of what they eat, the fifth of the food that is thrown away, the
 * ships that move a quarter of the calories consumed across borders, and
 * the stores that hold a few months against a bad year. Every one of
 * those is a buffer, and every one of them can be spent once.
 *
 * That is what makes the arithmetic of a nuclear famine so unforgiving.
 * The buffers are large enough that a small loss is absorbed entirely —
 * Xia's group found that a seven per cent loss of crop calories kills
 * nobody at all if the world stops feeding grain to animals and shares
 * what is left — and they are nowhere near large enough for a large one.
 * There is no arrangement of trade, waste and livestock that feeds the
 * world after a hundred and fifty teragrams of soot. Between those two
 * ends the buffers decide everything, which is why they are controls here
 * rather than constants.
 *
 * The mortality rule is the published one and it is brutally simple:
 * count the calories, divide by what a person needs to stay alive while
 * losing weight, and the remainder is the number of people the world can
 * feed. Everyone else is counted as being without food at the end of the
 * second year. It is not a demographic projection, and Xia's paper is
 * careful to call its headline figure "people without food" rather than
 * deaths. The reason the distinction is thin is that there is nowhere for
 * those people to get food from.
 *
 * Source: Xia, Robock, Scherrer, Harrison, Bodirsky, Weindl, Jägermeyr,
 * Bardeen, Toon & Heneghan, "Global food insecurity and famine from
 * reduced crop, marine fishery and livestock production due to climate
 * disruption from nuclear war soot injection", Nature Food 3 (2022),
 * 586-596, and its supplementary tables S3 to S9.
 */

export const FOOD = {
  /** Kilocalories per person per day, from the 2010 FAO food balance sheets as Xia uses them. */
  available: 2_855,
  intake: 2_310,
  /** What a person can live on while losing weight. Below this the reserves run out; the deaths are counted here. */
  survival: 1_911,
  restingRequirement: 1_145,
  /** Of the crop calories the world grows, the share that goes to animals rather than to people. */
  feedShare: 0.36,
  /** Calories returned as meat, milk and eggs per calorie of crop fed. */
  feedConversion: 0.11,
  /** The share of livestock feed that comes from pasture rather than from crops; it fails with the grazing land. */
  pastureShare: 0.46,
  /** Food lost in the household and at retail. */
  householdWaste: 0.2,
  /** Marine fish as a share of the calories people eat. */
  fishShare: 0.014,
  /** How much more fish can be caught if the fleets are turned loose on it, and how fast that stock is then gone. */
  fishingEffortMultiplier: 5,
} as const

/**
 * The log standard deviation of per-person food supply inside a band, fitted
 * so that the model reproduces Xia's published totals. It stands in for the
 * countries a ten-degree band contains and cannot see.
 */
export const DEFAULT_SPREAD = 0.27

export type LivestockPolicy = 'business-as-usual' | 'partial' | 'none'
export type WastePolicy = 'unchanged' | 'halved' | 'eliminated'

export interface FamineOptions {
  livestock: LivestockPolicy
  waste: WastePolicy
  /** Whether food crosses borders at all. Xia's default is that it does not. */
  trade: boolean
  /**
   * How unevenly the food that exists is spread within a latitude band.
   * The published work resolves countries; a band holds many countries and
   * would feed them all from one pot, which is not what happens. This is
   * the log standard deviation of per-person supply inside a band, and it
   * is fitted so that the model reproduces the published totals.
   */
  spread?: number
  population?: number
  /** Ocean productivity as a fraction of normal, which falls with the light. */
  fishFraction?: number
}

export interface FamineYear {
  year: number
  /** Calories available to people, per person per day, before any inequality. */
  perPersonDay: number
  /** As a fraction of the undisturbed figure. */
  fraction: number
  /** People the food can keep alive, and the people it cannot. */
  fed: number
  withoutFood: number
  byBand: Array<{ perPersonDay: number; withoutFood: number }>
}

const SQRT2 = Math.SQRT2

/** The normal cumulative distribution, for the share of a band that falls below the survival intake. */
function phi(z: number): number {
  // Abramowitz & Stegun 7.1.26 on the error function.
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / SQRT2)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp((-z * z) / 2)
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y)
}

/**
 * The calories a band's people can actually eat in a year, given what its
 * fields grew and what the world has decided to do about animals, waste
 * and trade.
 */
function edible(cropFraction: number, options: FamineOptions, fishFraction: number): number {
  const diverted = options.livestock === 'business-as-usual' ? 0 : options.livestock === 'partial' ? 0.5 : 1
  const waste = options.waste === 'unchanged' ? FOOD.householdWaste : options.waste === 'halved' ? FOOD.householdWaste / 2 : 0
  // Crop calories, as a share of the undisturbed crop harvest.
  const crop = cropFraction
  const toAnimals = crop * FOOD.feedShare * (1 - diverted)
  const toPeople = crop - toAnimals
  const animal = toAnimals * FOOD.feedConversion + (options.livestock === 'none' ? 0 : crop * FOOD.feedShare * (FOOD.pastureShare / (1 - FOOD.pastureShare)) * FOOD.feedConversion * cropFraction)
  const fish = FOOD.fishShare * fishFraction * (options.livestock === 'business-as-usual' ? 1 : Math.min(FOOD.fishingEffortMultiplier, 1 / Math.max(0.2, fishFraction)))
  return (toPeople + animal) * (1 - waste) + fish
}

/** The undisturbed year, by the same arithmetic, so the loss is measured against like. */
function edibleBaseline(options: FamineOptions): number {
  return edible(1, options, 1)
}

export function famine(harvestYears: HarvestYear[], zonal: Zonal, options: FamineOptions): FamineYear[] {
  const spread = options.spread ?? DEFAULT_SPREAD
  const totalPopulation = options.population ?? zonal.bands.reduce((a, b) => a + b.population, 0)
  const scale = totalPopulation / Math.max(1, zonal.bands.reduce((a, b) => a + b.population, 0))
  const baseline = edibleBaseline({ ...options, livestock: 'business-as-usual', waste: 'unchanged' })
  const years: FamineYear[] = []
  for (const y of harvestYears) {
    const fishFraction = options.fishFraction ?? 1
    // With trade, the world eats out of one pot; without it, each band eats what it grew.
    // A band's own supply at baseline is taken as what its people eat, not as
    // what its cropland grows. The world's cropland is not where the world's
    // people are, and a model that fed each band from its own hectares would
    // starve half of Asia before any war: what actually holds is that
    // continents are roughly self-sufficient in calories, with about a
    // quarter of what is eaten crossing a border. So the war's effect on a
    // band is its own yield factor, applied to its own consumption.
    const cropShare = zonal.bands.map((b, i) => ({ yieldFactor: y.yieldFactor[i], pop: b.population * scale }))
    const byBand: FamineYear['byBand'] = []
    // Each band first eats what it grew.
    const supply = cropShare.map((band) => (band.pop <= 0 ? 0 : (edible(band.yieldFactor, options, fishFraction) / baseline) * FOOD.available))
    // Then, if food still crosses borders, everything a band has above the
    // survival ration is shipped to the bands that are under it. This is the
    // most generous reading of trade there is — no price, no hoarding, no
    // sunk shipping — and at the larger loadings it changes almost nothing,
    // because there is no surplus anywhere to ship.
    if (options.trade) {
      const people = cropShare.reduce((a, b) => a + b.pop, 0)
      const mean = cropShare.reduce((a, b, i) => a + supply[i] * b.pop, 0) / Math.max(1, people)
      // Nobody gives away their own survival, so the level everyone is
      // brought to is the world's average when there is enough to go round
      // and the survival ration when there is not.
      const level = Math.max(FOOD.survival, mean)
      let surplus = 0
      let deficit = 0
      cropShare.forEach((band, i) => {
        const room = (supply[i] - level) * band.pop
        if (room > 0) surplus += room
        else deficit += -room
      })
      if (surplus > 0 && deficit > 0) {
        const moved = Math.min(surplus, deficit)
        cropShare.forEach((band, i) => {
          if (band.pop <= 0) return
          const room = (supply[i] - level) * band.pop
          if (room > 0) supply[i] -= (moved * (room / surplus)) / band.pop
          else supply[i] += (moved * (-room / deficit)) / band.pop
        })
      }
    }
    let withoutFood = 0
    let calories = 0
    cropShare.forEach((band, i) => {
      if (band.pop <= 0) {
        byBand.push({ perPersonDay: 0, withoutFood: 0 })
        return
      }
      const perPerson = supply[i]
      const z = Math.log(FOOD.survival / Math.max(1, perPerson)) / spread
      const short = Math.min(1, Math.max(0, phi(z)))
      byBand.push({ perPersonDay: perPerson, withoutFood: short * band.pop })
      withoutFood += short * band.pop
      calories += perPerson * band.pop
    })

    years.push({
      year: y.year,
      perPersonDay: calories / Math.max(1, totalPopulation),
      fraction: calories / Math.max(1, totalPopulation) / FOOD.available,
      fed: totalPopulation - withoutFood,
      withoutFood,
      byBand,
    })
  }
  return years
}
