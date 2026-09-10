import type { FamineYear } from '../models/famine.ts'
import type { HarvestYear } from '../models/harvest.ts'
import { ozoneColumn, ultraviolet, OZONE } from '../models/ozone.ts'
import { burnedAreaKm2, firestorm, loftedFraction, SOOT_CHAIN, SOOT_PER_PERSON_KG, type SootCase } from '../models/soot.ts'
import { bandOf, type WinterFrame } from '../models/winter.ts'
import { ZONAL } from './zonal.ts'

/**
 * The chain, told as it happens. Every line is derived from the models and
 * from nothing else, so scrubbing the clock rebuilds the same account of
 * the same run rather than replaying a script.
 */

export interface WinterLine {
  month: number
  text: string
  kind: 'plain' | 'best' | 'mark' | 'calib'
}

const tg = (v: number) => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2))
const pc = (v: number) => `${Math.round(v * 100)}%`
const people = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)} BILLION` : v >= 1e6 ? `${(v / 1e6).toFixed(0)} MILLION` : Math.round(v).toLocaleString('en-GB'))
const km2 = (v: number) => `${Math.round(v).toLocaleString('en-GB')} KM²`

export interface ReportInput {
  sootCase: SootCase
  fuelGPerCm2: number
  sootTg: number
  frames: WinterFrame[]
  harvest: HarvestYear[]
  famine: FamineYear[]
  population: number
}

/** Which month each stated line belongs to. */
export function report(input: ReportInput): WinterLine[] {
  const { sootCase: c, fuelGPerCm2: fuel, sootTg, frames, harvest, famine } = input
  const out: WinterLine[] = []
  const say = (month: number, text: string, kind: WinterLine['kind'] = 'plain') => out.push({ month, text, kind })
  const area = burnedAreaKm2(c)
  const produced = (area * fuel * 10 * 1e6 * SOOT_CHAIN.emissionFactor) / 1e9
  const north = bandOf(ZONAL, 45)
  const tropics = bandOf(ZONAL, 5)

  say(0, `EXCHANGE · ${c.label.toUpperCase()} · ${c.weapons.toLocaleString('en-GB')} WEAPONS OF ${c.yieldKt} KT`, 'mark')
  say(0, `PROMPT DEATHS · ${people(c.directFatalities)} · BLAST, FIRE AND THE FIRST FALLOUT · XIA ET AL. 2022, TABLE 1`)
  say(0, `FIRES · ${km2(area)} ALIGHT · FUEL LOADING ${fuel.toFixed(1)} G/CM² · ${fuel >= SOOT_CHAIN.firestormFuelGPerCm2 ? 'A CITY' : 'NOT A CITY: SUBURBS, OR CITY WITH THE RUBBLE SMOTHERING MOST OF THE FUEL'}`)
  say(0, firestorm(fuel, area) ? `FIRESTORM · FUEL ABOVE THE ${SOOT_CHAIN.firestormFuelGPerCm2} G/CM² THRESHOLD · THE FIRE MAKES ITS OWN WIND AND ITS OWN COLUMN` : `NO FIRESTORM · FUEL BELOW ${SOOT_CHAIN.firestormFuelGPerCm2} G/CM² · THE FIRE SPREADS BUT DOES NOT ORGANISE, AND THE SMOKE STAYS LOW`, 'calib')
  say(0, `SOOT PRODUCED ${tg(produced)} TG · ${pc(loftedFraction(fuel))} ABOVE THE WEATHER · ${tg(sootTg)} TG INTO THE STRATOSPHERE`, 'best')
  say(0, `AT ${Math.round(SOOT_PER_PERSON_KG)} KG OF SOOT A PERSON, THAT IS ${people((sootTg * 1e9) / SOOT_PER_PERSON_KG)} PEOPLE INSIDE THE FIRES. THE MARKS ON THE GLOBE ARE THE CITY CENTRES; THE FIRES ARE THE METROPOLITAN AREAS AROUND THEM`)
  if (sootTg < 1) {
    say(1, 'THE SMOKE RAINS OUT WITHIN WEEKS. NO GLOBAL FORCING. THIS IS THE OUTCOME REISNER FOUND, AND IT FOLLOWS FROM THE FUEL LOADING ALONE', 'calib')
  }

  const f1 = frames[1]
  if (f1) {
    say(1, `OPTICAL DEPTH ${f1.opticalDepth[north].toFixed(2)} OVER THE INJECTION LATITUDES · ${pc(f1.sunlight[north])} OF NORMAL SUNLIGHT REACHES THE GROUND THERE`)
    say(2, `THE LAYER SPREADS ALONG ITS OWN HEMISPHERE IN A COUPLE OF MONTHS AND CROSSES THE EQUATOR IN ABOUT A YEAR`)
  }
  const f3 = frames[3]
  if (f3) say(3, `SURFACE ${f3.globalAnomaly.toFixed(1)} K · LAND ${f3.landAnomalyMean.toFixed(1)} K · THE CONTINENTS GO FIRST BECAUSE THEY HAVE NO HEAT STORED`)
  const f6 = frames[6]
  if (f6) say(6, `SUNLIGHT ${pc(f6.sunlightMean)} · RAIN ${pc(f6.precipitation)} · THE RAIN GOES WITH THE SUN THAT LIFTED THE WATER`)

  for (let y = 1; y <= Math.min(harvest.length, 12); y += 1) {
    const m = y * 12
    const frame = frames[m]
    const h = harvest[y - 1]
    const fam = famine[y - 1]
    if (!frame || !h) break
    say(m, `YEAR ${y} · SURFACE ${frame.globalAnomaly.toFixed(1)} K · LAND ${frame.landAnomalyMean.toFixed(1)} K · SUN ${pc(frame.sunlightMean)} · RAIN ${pc(frame.precipitation)} · SOOT ${tg(frame.sootTg)} TG`, 'mark')
    const lost = h.frostMonths[north]
    if (lost > 0) say(m + 1, `${lost} MONTH${lost === 1 ? '' : 'S'} OF KILLING FROST ADDED AT 40 TO 50 NORTH, WHERE THE FROST FELL ON A STANDING CROP`)
    say(m + 2, `HARVEST ${pc(h.fraction)} OF NORMAL · ${pc(h.yieldFactor[north])} AT 40 TO 50 NORTH · ${pc(h.yieldFactor[tropics])} IN THE TROPICS`, 'best')
    if (fam) {
      say(m + 3, fam.withoutFood > 1e6 ? `WITHOUT FOOD · ${people(fam.withoutFood)} · ${pc(fam.withoutFood / input.population)} OF THE WORLD · AT ${Math.round(fam.perPersonDay).toLocaleString('en-GB')} KCAL A DAY THE AVERAGE IS ${fam.perPersonDay < 1_911 ? 'BELOW' : 'ABOVE'} WHAT A BODY CAN LIVE ON` : 'THE BUFFERS HOLD. THE LOSS IS ABSORBED BY THE ANIMALS NOT EATING IT AND BY WHAT WOULD HAVE BEEN THROWN AWAY', 'best')
    }
    const column = ozoneColumn(sootTg, m)
    if (y === 2 || y === 5 || y === 8) {
      const uv = ultraviolet(sootTg, m, frame.opticalDepth[tropics])
      say(m + 4, `OZONE COLUMN ${pc(column)} · ULTRAVIOLET INDEX ${uv.toFixed(0)} IN THE TROPICS AT NOON, AGAINST ${OZONE.baselineIndex} NOW · ${uv < OZONE.baselineIndex ? 'THE SOOT IS STILL SHADING IT' : 'THE SOOT HAS GONE AND THE OZONE HAS NOT COME BACK'}`)
    }
  }

  const recovered = frames.findIndex((f) => f.month > 24 && f.globalAnomaly > -0.5)
  if (recovered > 0) say(recovered, `SURFACE WITHIN HALF A DEGREE OF NORMAL AFTER ${(recovered / 12).toFixed(0)} YEARS. THE OZONE TAKES LONGER. NOTHING ELSE COMES BACK`, 'mark')
  return out.sort((a, b) => a.month - b.month)
}
