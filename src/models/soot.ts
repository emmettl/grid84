/**
 * The source term: how a burning city becomes a shadow over the world.
 *
 * This is the weakest link in the whole chain, and it is the one the
 * argument is actually about. The climate models agree with each other:
 * when Reisner's group repeated Robock's simulation with the same five
 * teragrams of soot, they got the same climate. What they disagree about
 * is whether a nuclear attack on a city puts five teragrams of soot above
 * the weather, or a hundredth of that.
 *
 * The chain has four links and each is a number here:
 *
 *   area burned  ×  fuel on that area  ×  soot per unit fuel  ×  what gets
 *   high enough to stay
 *
 * Toon's group take the area burned from Hiroshima, thirteen square
 * kilometres for fifteen kilotonnes, scaled linearly with yield. They take
 * the fuel from the population: about eleven tonnes of combustible
 * material per person, which is the figure Turco's group derived for the
 * developed world and which Small's independent survey brackets between
 * 8.7 and 17. They take two per cent of burned fuel as black carbon. They
 * remove a fifth of it in the black rain of the fire itself and another
 * tenth to a seventh before it reaches the stratosphere. Multiply those
 * out and the whole chain reduces to one number that is worth stating
 * plainly, because it is what the instrument computes over a real
 * population grid:
 *
 *   about a hundred and fifty kilogrammes of stratospheric soot for every
 *   person inside the fire.
 *
 * That single figure reproduces both published anchors. A hundred
 * fifteen-kilotonne weapons on Indian and Pakistani cities burn thirteen
 * hundred square kilometres holding some thirty million people: five
 * teragrams. Four thousand four hundred hundred-kilotonne weapons on the
 * cities of the northern hemisphere reach about a billion people: a
 * hundred and fifty.
 *
 * The dispute is over the second link. Reisner's simulation used a fuel
 * loading of about one gramme per square centimetre — Robock's group went
 * and measured his own input map at 0.14 over the target area — where
 * Toon's Indian and Pakistani targets carry 12.6 to 94.5. Below about four
 * a firestorm does not form; without a firestorm the smoke never rises
 * above the weather and rains out within weeks; and so Reisner found no
 * nuclear winter. Wagman's independent run at Livermore made the pivot
 * explicit by sweeping the fuel loading and nothing else: at one gramme
 * per square centimetre there is no global forcing at all, at sixteen the
 * soot reaches the stratosphere and the world cools. The National
 * Academies' 2025 review declined to say who is right, and noted that the
 * American urban fuel surveys sit closer to Reisner's figure than to
 * Toon's. Hiroshima's own fuel loading is quoted at 3.9, at 10 and at 16
 * by three different authorities.
 *
 * So the fuel loading is a control here, not a constant, and the range it
 * spans is the range of the argument.
 *
 * Sources: Toon et al., Atmos. Chem. Phys. 7 (2007), §6 and Table 13;
 * Toon et al., Science Advances 5 (2019), Methods steps 1-7; Reisner et
 * al., J. Geophys. Res. Atmos. 123 (2018) and the 2019 Reply; Robock,
 * Toon & Bardeen, Comment, JGR Atmos. 124 (2019); Wagman et al., JGR
 * Atmos. 125 (2020); Tarshish & Romps, JGR Atmos. 127 (2022) on the
 * moisture that decides whether the plume rises; National Academies,
 * Potential Environmental Effects of Nuclear War (2025).
 */

export const SOOT_CHAIN = {
  /** Square kilometres set on fire per kilotonne: Hiroshima's 13 km² for 15 kt, taken linear in yield as Toon 2019 states it. */
  areaPerKilotonneKm2: 13 / 15,
  /** Combustible material per person, kilogrammes. Turco et al. 1990 for the developed world; Small 1989 brackets it. */
  fuelPerPersonKg: 11_000,
  fuelPerPersonRangeKg: [8_700, 17_000] as [number, number],
  /** Black carbon per unit of fuel burned, by mass. Toon 2019; Toon 2007 used 0.016. */
  emissionFactor: 0.02,
  /** Of the fuel present, how much burns. Toon takes all of it and says so, calling it an upper limit. */
  burnedFraction: 1,
  /** Removed in the fire's own black rain. */
  promptRainout: 0.2,
  /** Removed again in the first days, before the smoke is above the weather. */
  furtherRainout: 0.125,
  /** Glasstone & Dolan's conditions for a firestorm rather than a spreading conflagration. */
  firestormFuelGPerCm2: 4,
  firestormWindMs: 3.6,
  firestormAreaKm2: 1.3,
} as const

/**
 * Areal fuel loading, grammes per square centimetre, as the argument uses
 * it. Toon's regression on population is 0.0011 g/cm² for every person per
 * square kilometre, which is the same eleven tonnes a person seen from
 * above.
 */
export const FUEL_PER_DENSITY = 0.0011

export interface FuelReference {
  label: string
  gPerCm2: number
  note: string
}

/** Where the measured and assumed fuel loadings actually sit. The spread is the dispute. */
export const FUEL_LOADS: FuelReference[] = [
  { label: "Reisner's target area, as measured by his critics", gPerCm2: 0.14, note: 'Suburban Atlanta: a golf course, a playground and houses with large yards. Robock, Toon & Bardeen 2019 obtained the fuel map and averaged it over the 13 km² fire area' },
  { label: 'American urban survey, Bush et al. 1991', gPerCm2: 1.75, note: '1.4 to 2.1 across American cities; the National Academies quote it in 2025 without remarking how far it is from the figures the winter studies use' },
  { label: "Reisner's whole domain", gPerCm2: 1.05, note: 'The 10 by 10 km domain of the simulation that found no nuclear winter' },
  { label: 'Hiroshima, per Rodden 1965', gPerCm2: 3.9, note: 'The lowest of the three published values for the one city where this has been measured' },
  { label: 'Firestorm threshold', gPerCm2: 4, note: 'Glasstone & Dolan: below this a fire spreads but does not organise itself into a firestorm, and the smoke stays low' },
  { label: 'Hiroshima, per Reisner 2019', gPerCm2: 10, note: 'The middle of the three' },
  { label: 'Hamburg, 1943', gPerCm2: 30, note: 'Toon 2007 gives 12 to 47 for the firestorm raid' },
  { label: 'Hiroshima, per Toon 2007', gPerCm2: 16, note: 'The highest of the three, and the one the winter studies calibrate on' },
  { label: 'American city centres', gPerCm2: 41, note: '23, 41 and 63 for three surveyed cores' },
  { label: 'Indian and Pakistani targets, Toon 2007', gPerCm2: 35, note: 'The 50-target average for India; Pakistan 28, China 50, the United States 12. Individual targets run from 12.6 to 94.5' },
]

/**
 * What fraction of the black carbon produced gets above the weather and
 * stays there. This is where the argument is decided, and it turns on the
 * fuel loading, because the fuel loading decides whether a firestorm forms
 * and a firestorm is what lifts the smoke. Wagman's Livermore sweep held
 * everything else fixed and varied only this: at one gramme per square
 * centimetre the soot is rained out and there is no global forcing at all;
 * at five it reaches the upper troposphere and then lofts itself; at
 * sixteen about forty per cent goes straight to the stratosphere and the
 * rest reaches the upper troposphere and lofts itself, giving a cooling
 * that matches the published five-teragram case. So sixteen is where this
 * curve reaches Toon's own assumption, that 68 per cent survives both
 * rainouts. The curve between those points is an interpolation and nothing
 * more, and it is the most consequential interpolation on the page.
 */
export function loftedFraction(fuelGPerCm2: number): number {
  const points: Array<[number, number]> = [
    [0, 0],
    [1, 0.02],
    [4, 0.15],
    [5, 0.25],
    [10, 0.5],
    [16, (1 - SOOT_CHAIN.promptRainout) * (1 - SOOT_CHAIN.furtherRainout)],
    [95, (1 - SOOT_CHAIN.promptRainout) * (1 - SOOT_CHAIN.furtherRainout)],
  ]
  if (fuelGPerCm2 <= 0) return 0
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    if (fuelGPerCm2 <= x1) return y0 + ((fuelGPerCm2 - x0) / (x1 - x0)) * (y1 - y0)
  }
  return points[points.length - 1][1]
}

/** Fuel loading implied by a population density, g/cm². */
export function fuelForDensity(peoplePerKm2: number): number {
  return FUEL_PER_DENSITY * peoplePerKm2
}

/** Whether a fire on this ground organises itself into a firestorm. */
export function firestorm(fuelGPerCm2: number, areaKm2: number, windMs = 2): boolean {
  return fuelGPerCm2 >= SOOT_CHAIN.firestormFuelGPerCm2 && areaKm2 >= SOOT_CHAIN.firestormAreaKm2 && windMs < SOOT_CHAIN.firestormWindMs
}

/** Area a weapon sets on fire, square kilometres, before any cap for the size of the city. */
export function fireAreaKm2(yieldKt: number): number {
  return SOOT_CHAIN.areaPerKilotonneKm2 * yieldKt
}

export interface SootResult {
  /** Square kilometres actually burning, after the city's own extent has capped it. */
  areaKm2: number
  /** People inside the fire. */
  people: number
  fuelGPerCm2: number
  fuelTg: number
  /** Black carbon produced, and the part of it that gets above the weather. */
  producedTg: number
  loftedTg: number
  firestorm: boolean
}

/**
 * The soot from one detonation over a city, from the population under it.
 * The burning area is what the weapon can set alight or what the built-up
 * area holds, whichever is less: a hundred-kilotonne weapon can ignite
 * eighty-seven square kilometres, and there is no point igniting fields.
 */
export function sootFromDetonation(input: { yieldKt: number; peoplePerKm2: number; builtUpKm2?: number; fuelGPerCm2?: number; windMs?: number }): SootResult {
  const ignitable = fireAreaKm2(input.yieldKt)
  const areaKm2 = Math.max(0, Math.min(ignitable, input.builtUpKm2 ?? ignitable))
  const fuel = input.fuelGPerCm2 ?? fuelForDensity(input.peoplePerKm2)
  // g/cm² is ten kilogrammes per square metre; a square kilometre is a million square metres.
  const fuelTg = (fuel * 10 * areaKm2 * 1e6 * SOOT_CHAIN.burnedFraction) / 1e9
  const producedTg = fuelTg * SOOT_CHAIN.emissionFactor
  return {
    areaKm2,
    people: areaKm2 * input.peoplePerKm2,
    fuelGPerCm2: fuel,
    fuelTg,
    producedTg,
    loftedTg: producedTg * loftedFraction(fuel),
    firestorm: firestorm(fuel, areaKm2, input.windMs),
  }
}

/** Stratospheric soot per person inside the fire, kilogrammes, on Toon's own assumptions: the whole chain in one number. */
export const SOOT_PER_PERSON_KG = SOOT_CHAIN.fuelPerPersonKg * SOOT_CHAIN.emissionFactor * (1 - SOOT_CHAIN.promptRainout) * (1 - SOOT_CHAIN.furtherRainout)

export interface SootCase {
  id: string
  label: string
  weapons: number
  yieldKt: number
  sootTg: number
  /** Deaths from the weapons themselves, before any of what follows. Xia et al. 2022, Table 1. */
  directFatalities: number
  /** Where the fires are, as latitudes with weights. */
  sources: Array<{ lat: number; weight: number }>
  source: string
  note: string
}

/** The published cases, as the papers state them, with the caveats they are usually quoted without. */
/**
 * The area a case sets alight: what its weapons can ignite. Toon's own
 * calculation caps each weapon at the city under it, which this cannot do
 * without a target list, so for a case with more weapons than cities this
 * is an overestimate and the fuel loading read back from it is
 * correspondingly low.
 */
export function burnedAreaKm2(c: SootCase): number {
  return c.weapons * fireAreaKm2(c.yieldKt)
}

/** Soot above the weather, in teragrams, from an area of city at a fuel loading. */
export function sootFromArea(areaKm2: number, fuelGPerCm2: number): number {
  return (areaKm2 * 1e6 * fuelGPerCm2 * 10 * SOOT_CHAIN.emissionFactor * loftedFraction(fuelGPerCm2)) / 1e9
}

/**
 * The fuel loading a published case implies, given the area its weapons
 * ignite. This is a check as much as a control: the hundred-weapon regional
 * case comes back at about 28 g/cm², which is exactly Toon's fifty-target
 * average for Pakistan, so the chain and the published figure agree without
 * being made to.
 */
export function referenceFuel(c: SootCase): number {
  const area = burnedAreaKm2(c)
  let lo = 0.01
  let hi = 200
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2
    if (sootFromArea(area, mid) < c.sootTg) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** The soot that case would give if the cities held a different amount of fuel. This is the argument, as a dial. */
export function sootForFuel(c: SootCase, fuelGPerCm2: number): number {
  return sootFromArea(burnedAreaKm2(c), fuelGPerCm2)
}

export const SOOT_CASES: SootCase[] = [
  {
    id: 'regional-5',
    label: 'India and Pakistan, 2007 arsenals',
    weapons: 100,
    yieldKt: 15,
    sootTg: 5,
    directFatalities: 27_000_000,
    sources: [{ lat: 25, weight: 0.7 }, { lat: 32, weight: 0.3 }],
    source: 'Robock, Oman, Stenchikov, Toon, Bardeen & Turco, Atmos. Chem. Phys. 7 (2007), 2003-2012',
    note: 'The canonical five teragrams is the top of a stated range of one to five, not a computed total: Toon 2007 Table 13 sums India and Pakistan to 6.6, and with 2016 populations the same hundred weapons give 8.7',
  },
  { id: 'regional-16', label: 'India and Pakistan, 2025 arsenals', weapons: 250, yieldKt: 15, sootTg: 16,
    directFatalities: 52_000_000, sources: [{ lat: 25, weight: 0.7 }, { lat: 32, weight: 0.3 }], source: 'Toon et al., Science Advances 5 (2019), table S1', note: 'India 100 weapons on Pakistani cities, Pakistan 150 on Indian cities' },
  { id: 'regional-27', label: 'The same war with fifty-kilotonne weapons', weapons: 250, yieldKt: 50, sootTg: 27,
    directFatalities: 97_000_000, sources: [{ lat: 25, weight: 0.7 }, { lat: 32, weight: 0.3 }], source: 'Toon et al., Science Advances 5 (2019)', note: 'Both arsenals are moving to higher yields, which is what this case is for' },
  { id: 'regional-37', label: 'The same war with hundred-kilotonne weapons', weapons: 250, yieldKt: 100, sootTg: 37,
    directFatalities: 127_000_000, sources: [{ lat: 25, weight: 0.7 }, { lat: 32, weight: 0.3 }], source: 'Toon et al., Science Advances 5 (2019)', note: '' },
  { id: 'regional-47', label: 'The upper limit for the subcontinent', weapons: 500, yieldKt: 100, sootTg: 47,
    directFatalities: 164_000_000, sources: [{ lat: 25, weight: 0.7 }, { lat: 32, weight: 0.3 }], source: 'Toon et al. 2019 as read by Xia et al. 2022, Table 1', note: 'Toon 2019 says 250 weapons for this case and 250 for the 37 Tg case, which cannot both be right; Xia reads it as 250 against each country' },
  {
    id: 'global-150',
    label: 'The northern hemisphere',
    weapons: 4_400,
    yieldKt: 100,
    sootTg: 150,
    directFatalities: 360_000_000,
    sources: [{ lat: 35, weight: 0.35 }, { lat: 45, weight: 0.4 }, { lat: 55, weight: 0.25 }],
    source: 'Toon, Robock & Turco, Physics Today 61 (2008), 180 Tg; rounded to 150 by Coupe et al., JGR Atmos. 124 (2019)',
    note: 'Four hundred and forty megatonnes, about half the arsenals of Russia, China, Britain, France and the United States. The 180 became 150 by doubling the assumed rainout, not by striking fewer cities',
  },
]
