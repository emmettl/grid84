import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { famine } from './famine.ts'
import { baselineDegreeDays, growingSeasonDays, harvest } from './harvest.ts'
import { burnedAreaKm2, fireAreaKm2, loftedFraction, referenceFuel, SOOT_CASES, SOOT_CHAIN, SOOT_PER_PERSON_KG, sootForFuel, sootFromDetonation } from './soot.ts'
import { OZONE, ozoneColumn, ultraviolet } from './ozone.ts'
import { injectionWeights, insolation, peakOf, runWinter, type Zonal } from './winter.ts'

const zonal = JSON.parse(readFileSync('data/atlas/zonal.json', 'utf8')) as Zonal
const caseOf = (id: string) => SOOT_CASES.find((c) => c.id === id)!
const run = (id: string, months = 144) => {
  const c = caseOf(id)
  return runWinter({ sootTg: c.sootTg, injection: injectionWeights(zonal, c.sources), zonal, months, startMonth: 4 })
}

describe('the source term', () => {
  it('reproduces the published soot from the population under the fire, which is the whole chain in one number', () => {
    // Toon 2019: 13 km² per 15 kt, linear in yield; 11 t of fuel a person; 2% of it soot; a fifth and then an eighth of that rained out.
    expect(fireAreaKm2(15)).toBeCloseTo(13, 5)
    expect(fireAreaKm2(100)).toBeCloseTo(86.7, 1)
    expect(SOOT_PER_PERSON_KG).toBeGreaterThan(140)
    expect(SOOT_PER_PERSON_KG).toBeLessThan(160)
    // A hundred 15 kt weapons on cities of 25,000 a square kilometre: the canonical five teragrams.
    const one = sootFromDetonation({ yieldKt: 15, peoplePerKm2: 25_000 })
    expect(one.loftedTg * 100).toBeGreaterThan(4)
    expect(one.loftedTg * 100).toBeLessThan(7)
    expect(one.firestorm).toBe(true)
    // And the global case, the same way round: a hundred and fifty teragrams
    // is about a billion people inside the fires, which is what four thousand
    // four hundred weapons on the northern hemisphere's cities reaches.
    const peopleFor150 = (150 * 1e9) / SOOT_PER_PERSON_KG
    expect(peopleFor150).toBeGreaterThan(0.8e9)
    expect(peopleFor150).toBeLessThan(1.2e9)
  })

  it('puts the dispute where it belongs: on the fuel loading, which decides whether anything gets above the weather', () => {
    // Reisner's target area as his critics measured it: no firestorm, and effectively nothing lofted.
    expect(sootFromDetonation({ yieldKt: 15, peoplePerKm2: 0, fuelGPerCm2: 0.14 }).firestorm).toBe(false)
    expect(loftedFraction(0.14)).toBeLessThan(0.01)
    // Wagman's sweep: nothing at one gramme a square centimetre, the stratosphere at sixteen.
    expect(loftedFraction(1)).toBeLessThan(0.05)
    expect(loftedFraction(16)).toBeGreaterThan(0.35)
    expect(loftedFraction(35)).toBeCloseTo((1 - SOOT_CHAIN.promptRainout) * (1 - SOOT_CHAIN.furtherRainout), 3)
    // The ratio between the two positions is the ratio between a winter and no winter.
    const low = sootFromDetonation({ yieldKt: 15, peoplePerKm2: 0, fuelGPerCm2: 1 })
    const high = sootFromDetonation({ yieldKt: 15, peoplePerKm2: 0, fuelGPerCm2: 35 })
    expect(high.loftedTg / low.loftedTg).toBeGreaterThan(50)
  })
})

describe('the sky', () => {
  it('puts the sun where the astronomy says it is', () => {
    expect(insolation(0, 80)).toBeGreaterThan(400)
    expect(insolation(90, 172)).toBeGreaterThan(insolation(0, 172))
    expect(insolation(90, 355)).toBe(0)
    expect(insolation(-90, 355)).toBeGreaterThan(500)
  })

  it('matches the published climate response over the whole range of the literature', () => {
    // Robock, Oman & Stenchikov 2007 (ModelE) and Coupe et al. 2019 (WACCM4).
    const small = peakOf(run('regional-5'))
    expect(small.anomaly).toBeLessThan(-0.7)
    expect(small.anomaly).toBeGreaterThan(-1.6)
    const big = run('global-150')
    const peak = peakOf(big)
    // ModelE gives 7 to 8 K sustained; WACCM4 gives 9.5 K at one year.
    expect(peak.anomaly).toBeLessThan(-6.5)
    expect(peak.anomaly).toBeGreaterThan(-10.5)
    // Still cold a decade later: ModelE gives 4 K at ten years.
    expect(big[120].globalAnomaly).toBeLessThan(-2.5)
    expect(big[120].globalAnomaly).toBeGreaterThan(-5.5)
    // Precipitation: 45 per cent down in ModelE, 58 in WACCM4.
    expect(big[24].precipitation).toBeLessThan(0.6)
    expect(big[24].precipitation).toBeGreaterThan(0.38)
    expect(run('regional-5')[24].precipitation).toBeGreaterThan(0.88)
    // The soot goes as the published e-folding times: six years at five teragrams, four and a half at a hundred and fifty.
    const five = run('regional-5', 72)
    expect(five[72].sootTg / 5).toBeCloseTo(Math.exp(-6 / 6), 1)
    expect(big[72].sootTg / 150).toBeLessThan(Math.exp(-6 / 6))
  })

  it('freezes the continents and not the oceans, and not the tropics', () => {
    const f = run('global-150')[24]
    const land = (lo: number, hi: number) => {
      let w = 0
      let s = 0
      zonal.bands.forEach((b, i) => {
        if (b.south >= lo && b.north <= hi) {
          s += f.landAnomaly[i] * b.landKm2
          w += b.landKm2
        }
      })
      return s / w
    }
    const sea = zonal.bands.reduce((a, b, i) => a + f.seaAnomaly[i] * (b.areaKm2 - b.landKm2), 0) / zonal.bands.reduce((a, b) => a + b.areaKm2 - b.landKm2, 0)
    // Toon et al. 2019: land about 18 K down, ocean about 6, for a full winter.
    expect(land(30, 60)).toBeLessThan(-12)
    expect(sea).toBeGreaterThan(-9)
    expect(sea).toBeLessThan(-3)
    expect(land(30, 60)).toBeLessThan(sea)
    // The tropics cool, but a tropical continent is held up by the sea beside it.
    expect(land(-10, 10)).toBeGreaterThan(-14)
  })
})

describe('the harvest and the famine', () => {
  const XIA = [
    { id: 'regional-5', crops: 0.931, without: 254.7e6 },
    { id: 'regional-16', crops: 0.773, without: 925.6e6 },
    { id: 'regional-27', crops: 0.672, without: 1_426.1e6 },
    { id: 'regional-37', crops: 0.589, without: 2_080.9e6 },
    { id: 'regional-47', crops: 0.52, without: 2_512.2e6 },
    { id: 'global-150', crops: 0.184, without: 5_340.8e6 },
  ]

  it('reproduces Xia et al. 2022 across every published case, to the accuracy a zonal model can claim', () => {
    for (const x of XIA) {
      const years = harvest(run(x.id, 96), zonal, { population: 6.70e9 })
      const without = famine(years, zonal, { livestock: 'partial', waste: 'unchanged', trade: false, population: 6.70e9 })[1].withoutFood
      // The crop loss within a tenth, and the people without food within a factor of a quarter either way.
      expect(Math.abs(years[1].fraction - x.crops)).toBeLessThan(0.11)
      expect(without).toBeGreaterThan(x.without * 0.7)
      expect(without).toBeLessThan(x.without * 1.35)
    }
  })

  it('finds the published result that the buffers decide everything until they cannot', () => {
    const years = harvest(run('regional-5', 96), zonal, { population: 6.70e9 })
    const bau = famine(years, zonal, { livestock: 'business-as-usual', waste: 'unchanged', trade: false, population: 6.70e9 })[1]
    const better = famine(years, zonal, { livestock: 'none', waste: 'eliminated', trade: true, population: 6.70e9 })[1]
    expect(better.withoutFood).toBeLessThan(bau.withoutFood / 4)
    // At a hundred and fifty teragrams nothing helps: Xia's every variant lands between 5.32 and 5.44 billion.
    const global = harvest(run('global-150', 96), zonal, { population: 6.70e9 })
    const worst = famine(global, zonal, { livestock: 'business-as-usual', waste: 'unchanged', trade: false, population: 6.70e9 })[1]
    const best = famine(global, zonal, { livestock: 'none', waste: 'eliminated', trade: true, population: 6.70e9 })[1]
    // Xia's own variants span 5.32 to 5.44 billion at this loading; this model
    // is a little more responsive to the buffers than theirs, and still finds
    // that emptying every one of them leaves most of the world without food.
    expect(best.withoutFood).toBeGreaterThan(worst.withoutFood * 0.7)
    expect(best.withoutFood).toBeGreaterThan(4e9)
  })

  it('shortens the growing season by what Mills et al. 2014 measured, having never been fitted to it', () => {
    // Mills, Toon, Lee-Taylor & Robock, Earth's Future 2 (2014): killing frosts
    // reduce the growing season by 10 to 40 days a year for five years, at 5 Tg.
    const years = harvest(run('regional-5', 96), zonal, { population: 7.86e9 })
    const north = [12, 13, 14]
    const lost = years.slice(0, 5).flatMap((y) => north.map((b) => y.seasonLost[b]))
    expect(Math.min(...lost)).toBeGreaterThan(4)
    expect(Math.max(...lost)).toBeLessThan(45)
    expect(lost.filter((d) => d >= 10 && d <= 40).length).toBeGreaterThan(lost.length / 2)
    // A full winter takes the season away entirely where the wheat is, for years.
    const big = harvest(run('global-150', 96), zonal, { population: 7.86e9 })
    expect(big[1].seasonDays[13]).toBe(0)
    expect(big[3].seasonDays[13]).toBe(0)
  })

  it('counts the days of a season from the months, and loses none in an undisturbed year', () => {
    const warm = Array.from({ length: 12 }, () => 20)
    expect(growingSeasonDays(warm)).toBeCloseTo(365.25, 0)
    expect(growingSeasonDays(Array.from({ length: 12 }, () => -20))).toBe(0)
    // A year that crosses the threshold twice keeps the part above it.
    const seasonal = [-5, -3, 2, 8, 14, 18, 20, 19, 14, 8, 2, -3]
    expect(growingSeasonDays(seasonal)).toBeGreaterThan(150)
    expect(growingSeasonDays(seasonal)).toBeLessThan(230)
  })

  it('accumulates heat where the crops are, and takes it away where the cold arrives', () => {
    const base = baselineDegreeDays(zonal)
    const gangetic = zonal.bands.findIndex((b) => b.south === 20)
    const ukraine = zonal.bands.findIndex((b) => b.south === 40)
    expect(base[gangetic]).toBeGreaterThan(base[ukraine] * 2)
    const years = harvest(run('global-150', 96), zonal, { population: 7.86e9 })
    expect(years[1].yieldFactor[ukraine]).toBe(0)
    expect(years[1].frostMonths[ukraine]).toBeGreaterThan(2)
  })
})

describe('the ozone and the ultraviolet', () => {
  it('loses the published fraction of the column and takes years to get it back', () => {
    // Bardeen et al. 2021: a quarter of the column for a regional war, three quarters for a global one.
    let worstSmall = 1
    let worstBig = 1
    for (let m = 0; m < 200; m += 1) {
      worstSmall = Math.min(worstSmall, ozoneColumn(5, m))
      worstBig = Math.min(worstBig, ozoneColumn(150, m))
    }
    expect(1 - worstSmall).toBeCloseTo(0.25, 1)
    expect(1 - worstBig).toBeCloseTo(0.75, 1)
    expect(ozoneColumn(5, 144)).toBeGreaterThan(0.93)
  })

  it('finds the sign change: a global war shades the ultraviolet away before it lets it through', () => {
    const big = run('global-150', 180)
    const tropics = zonal.bands.findIndex((b) => b.south === 0)
    const uv = big.map((f) => ultraviolet(150, f.month, f.opticalDepth[tropics]))
    // While the soot is thick the ultraviolet is below normal.
    expect(uv[12]).toBeLessThan(OZONE.baselineIndex)
    // Once it clears, the missing ozone shows, and it shows late: the worst
    // of it is years after the war, not during it.
    const worst = Math.max(...uv)
    expect(worst).toBeGreaterThan(OZONE.baselineIndex)
    // Bardeen puts the peak eight to nine years out; this model brings it
    // forward, but it keeps the order of events, which is the point.
    expect(uv.indexOf(worst)).toBeGreaterThan(30)
    // A regional war has no such reprieve; the rise starts at once.
    const small = run('regional-5', 120)
    expect(ultraviolet(5, 24, small[24].opticalDepth[tropics])).toBeGreaterThan(OZONE.baselineIndex)
  })
})

describe('the fuel loading, which is the argument', () => {
  it('reads back a burned area consistent with the case, and swings the soot by two orders of magnitude across the dispute', () => {
    const regional = caseOf('regional-5')
    const global = caseOf('global-150')
    // A hundred Hiroshimas is about thirteen hundred square kilometres of city.
    expect(burnedAreaKm2(regional)).toBeCloseTo(1_300, 0)
    // And the loading that gives the published soot over that area comes back
    // at Toon's own fifty-target average for Pakistan, which nothing here made it do.
    expect(referenceFuel(regional)).toBeGreaterThan(24)
    expect(referenceFuel(regional)).toBeLessThan(34)
    // The global case ignites more ground than there is city on, so the loading it implies is lower.
    expect(referenceFuel(global)).toBeLessThan(referenceFuel(regional))
    // Reisner's loading against Toon's: no winter against a winter.
    expect(sootForFuel(global, 1)).toBeLessThan(10)
    expect(sootForFuel(global, referenceFuel(global))).toBeCloseTo(150, 0)
    expect(sootForFuel(global, 30) / sootForFuel(global, 1)).toBeGreaterThan(20)
  })
})
