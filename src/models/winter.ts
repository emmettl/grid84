/**
 * Nuclear winter: the soot, the sunlight and the cold, by latitude band.
 *
 * The rest of this engine works in minutes and kilometres. This model works
 * in months and degrees of latitude, because the thing it computes happens
 * to the whole planet over years and is set by how much sunlight reaches
 * the ground. Cities burn; the smoke of a burning city is black, absorbs
 * sunlight, heats, and rises into the stratosphere, where nothing rains it
 * out. What follows is a planetary shading that lasts as long as the soot
 * does, and the harvest that fails under it kills far more people than the
 * weapons did.
 *
 * The published work is done with three-dimensional atmospheric models on
 * large machines: TTAPS in 1983, Robock and Toon's revisit from 2007 with
 * a coupled climate model, WACCM4 in 2019. None of that runs in a browser.
 * What does run in a browser, and what was in fact the form of the first
 * climate models, is an energy-balance model: the planet divided into
 * latitude bands, each with a land tile and an ocean tile, each keeping an
 * energy budget as the seasons turn and the soot shades them. It resolves
 * latitude and not longitude, which is the right compromise, because the
 * two quantities that decide a harvest — how much sun a place gets and how
 * long its season is — are set by latitude.
 *
 * It is a fit, and it is stated as one. The structure is physical: the
 * absorption of sunlight by soot along a slant path, the heat capacity of
 * a mixed layer against that of a soil, the exchange between maritime and
 * continental air, transport toward the global mean, sea ice when the
 * surface reaches freezing. The coefficients inside that structure are
 * chosen so that the model reproduces the published results of the large
 * models at both ends of the range, five teragrams and a hundred and fifty.
 * Between those anchors it interpolates on physical structure rather than
 * on a curve; outside them it should not be believed.
 *
 * Sources: Turco, Toon, Ackerman, Pollack & Sagan, "Nuclear winter: global
 * consequences of multiple nuclear explosions", Science 222 (1983);
 * Robock, Oman & Stenchikov, "Nuclear winter revisited with a modern
 * climate model", J. Geophys. Res. 112 (2007); Coupe, Bardeen, Robock &
 * Toon, "Nuclear winter responses ... in WACCM4", JGR Atmospheres 124
 * (2019); North, Cahalan & Coakley, "Energy balance climate models",
 * Rev. Geophys. 19 (1981) for the form of the model itself.
 */

/** One ten-degree band of the world, measured from the HYDE grids by scripts/build-zonal-2023.py. */
export interface ZonalBand {
  south: number
  north: number
  areaKm2: number
  landKm2: number
  population: number
  urbanPopulation: number
  builtUpKm2: number
  croplandKm2: number
  grazingKm2: number
}

export interface Zonal {
  bandWidthDeg: number
  bands: ZonalBand[]
  source: { grids: string; method: string; antarctica?: string }
}

export const SOLAR_CONSTANT = 1_361

/**
 * The parameters of the energy balance. Each is a physical quantity with a
 * physical range; the values are the ones that put the model on the
 * published results of the three-dimensional models, and the range is given
 * so the reader can see how much room there was to choose.
 */
export const WINTER_PARAMETERS = {
  /**
   * Mass absorption cross-section of the soot, m² per gram at solar
   * wavelengths. Bond & Bergstrom's measurement of fresh black carbon is
   * 7.5 ± 1.2; the climate models that ran these cases used 6.21 (ModelE)
   * and 5.48 (WACCM4), and coating by other combustion products raises
   * absorption by about half again.
   */
  massAbsorption: 7.6,
  /**
   * The slant-path factor. Sunlight crosses the layer at an angle, so the
   * absorbing path is longer than the layer is thick. 1.66 is the standard
   * diffusivity factor of plane-parallel radiative transfer.
   */
  slantPath: 1.66,
  /** Fraction of the sunlight at the top of the atmosphere that reaches the ground in clear-average conditions. Global mean observed: 185 of 341 W/m². */
  atmosphere: 0.54,
  /** Surface albedo of open land, ocean and ice. */
  albedoLand: 0.2,
  albedoSea: 0.07,
  albedoIce: 0.6,
  /**
   * The fraction of the surface sunlight deficit that appears as a net
   * energy deficit at the surface. Over land it is about half, because a
   * field that loses its sunlight also stops evaporating, and the water it
   * is no longer lifting is heat it is no longer losing; the hot soot layer
   * overhead radiates some of the difference back down as well. Over the
   * sea almost none of that applies: the water is warm and goes on
   * evaporating into the cold air above it, so the whole deficit stands.
   * What keeps the sea surface warm is not compensation at the surface but
   * the ocean underneath it, which is the next two terms.
   */
  compensationLand: 0.51,
  compensationSea: 1.0,
  /**
   * How hard the surface pushes back per degree it cools, W per m² per K.
   * Over land it is close to the radiative response of the column, which is
   * below the Planck value of 5.4 because the air cools with the ground.
   * Over water it is stronger, because most of what a sea surface loses it
   * loses by evaporating, and evaporation falls away steeply as the water
   * cools.
   */
  restoringLand: 3.2,
  restoringSea: 6.0,
  /**
   * Exchange between the ocean's mixed layer and the water below it, W per
   * m² per K. Cooling a sea surface makes it denser, so it sinks: the
   * cooling drives the convection that brings warmer water up to be cooled
   * in its turn. This is the term that holds the sea surface up while the
   * land goes under, and under a shaded sky it is large.
   */
  deepExchange: 19.4,
  /** Exchange between the air over the land and the air over the sea within a band, W per m² per K. This is what keeps a coast mild and lets a continental interior freeze. */
  coastExchange: 1.2,
  /** The most the land of a very oceanic band can be tied to its own sea, as a multiple of the exchange. */
  coastLimit: 6,
  /**
   * How much stronger that tie is in the tropics, and how far from the
   * equator the strengthening reaches, in degrees. Deep convection over
   * warm water sets the temperature of the whole tropical troposphere, and
   * the free troposphere cannot hold a horizontal gradient against it, so a
   * tropical continent is held to the sea beside it in a way that a
   * northern one is not. This is why the Congo and the Amazon do not freeze
   * in these runs while Ukraine does.
   */
  tropicalCoupling: 3.5,
  tropicalWidthDeg: 25,
  /** Transport toward the global mean, W per m² per K: everything the winds and the currents do to even the planet out. */
  transport: 0.4,
  /** Heat capacity of the land surface and its boundary layer, J per m² per K: a month's memory. */
  capacityLand: 1.1e7,
  /**
   * Heat capacity of the ocean mixed layer, J per m² per K. The summer
   * summer layer is fifty metres; cooling the surface makes it denser and
   * convection deepens the layer, so what has to be cooled is the deep
   * winter one. Two hundred and fifty metres of sea water.
   */
  capacitySea: 1.04e9,
  /** Heat capacity of a frozen sea surface: the ice insulates, and the surface above it behaves like land. */
  capacityIce: 1.5e7,
  /** Sea water freezes at this temperature; below it the tile takes the ice albedo and the ice heat capacity. */
  freezing: -1.8,
  /** How fast soot spreads across its own hemisphere, and how fast the hemispheres equalise. Months. */
  mixingHemisphere: 2.2,
  mixingCross: 14,
  /**
   * How long the soot stays up: the e-folding time in years for a
   * five-teragram injection, and the power of the injection size that
   * shortens it. The sign is the counter-intuitive part and it is
   * published: a small injection lasts *longer*, six years against four
   * and a half, because a thick layer shades its own lower part and only
   * the top of it is heated enough to keep climbing. Robock, Oman &
   * Stenchikov 2007 give 6.0 years at 5 Tg, 5.5 at 50 and 4.6 at 150; the
   * exponent here is the fit through those three, and it puts a volcanic
   * sulfate layer's one year in perspective.
   */
  removalYears: 6,
  removalExponent: -0.078,
  /** Global precipitation falls with the energy available to evaporate water. Fraction of the global sunlight deficit that appears as a precipitation deficit. */
  precipitationSensitivity: 0.57,
} as const

/** Mid-month day of the year, for the insolation. */
const MONTH_DAY = [16, 45, 75, 105, 136, 166, 197, 228, 258, 289, 319, 350]

/**
 * Daily-mean insolation at the top of the atmosphere, W/m², for a latitude
 * and a day of the year. The standard astronomical expression with a
 * circular orbit and an obliquity of 23.44°.
 */
export function insolation(latDeg: number, day: number): number {
  const phi = (latDeg * Math.PI) / 180
  const delta = (23.44 * Math.PI) / 180 * Math.sin((2 * Math.PI * (day - 80.25)) / 365.25)
  const cosH = -Math.tan(phi) * Math.tan(delta)
  const h = cosH >= 1 ? 0 : cosH <= -1 ? Math.PI : Math.acos(cosH)
  return (SOLAR_CONSTANT / Math.PI) * (h * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(h))
}

/**
 * The observed climatology the anomalies are added to: the annual mean and
 * the seasonal amplitude of the surface temperature over land and over sea,
 * by band centre, as a harmonic in the month. A fit to the zonal means, not
 * a reanalysis: it is here so the model can say whether a month is above
 * freezing, which is what a crop cares about.
 */
const CLIMATOLOGY: Array<{ lat: number; landMean: number; landAmp: number; seaMean: number; seaAmp: number }> = [
  { lat: -85, landMean: -50, landAmp: 15, seaMean: -1.8, seaAmp: 0.5 },
  { lat: -75, landMean: -35, landAmp: 15, seaMean: -1.5, seaAmp: 1 },
  { lat: -65, landMean: -15, landAmp: 10, seaMean: 0, seaAmp: 2 },
  { lat: -55, landMean: 6, landAmp: 4, seaMean: 4, seaAmp: 2 },
  { lat: -45, landMean: 9, landAmp: 5, seaMean: 9, seaAmp: 3 },
  { lat: -35, landMean: 15, landAmp: 7, seaMean: 16, seaAmp: 4 },
  { lat: -25, landMean: 20, landAmp: 7, seaMean: 21, seaAmp: 4 },
  { lat: -15, landMean: 23, landAmp: 5, seaMean: 25, seaAmp: 3 },
  { lat: -5, landMean: 25, landAmp: 2, seaMean: 26.5, seaAmp: 1.5 },
  { lat: 5, landMean: 26, landAmp: 1.5, seaMean: 27, seaAmp: 1 },
  { lat: 15, landMean: 26, landAmp: 4, seaMean: 27, seaAmp: 2 },
  { lat: 25, landMean: 23, landAmp: 9, seaMean: 24, seaAmp: 4 },
  { lat: 35, landMean: 16, landAmp: 12, seaMean: 19, seaAmp: 5 },
  { lat: 45, landMean: 8, landAmp: 15, seaMean: 12, seaAmp: 6 },
  { lat: 55, landMean: 1, landAmp: 18, seaMean: 7, seaAmp: 5 },
  { lat: 65, landMean: -8, landAmp: 20, seaMean: 2, seaAmp: 3 },
  { lat: 75, landMean: -16, landAmp: 18, seaMean: -1, seaAmp: 2 },
  { lat: 85, landMean: -22, landAmp: 17, seaMean: -1.7, seaAmp: 1 },
]

/** Baseline surface temperature, °C, for a band centre and a month index (0 = January). */
export function baseline(latDeg: number, month: number, surface: 'land' | 'sea'): number {
  let row = CLIMATOLOGY[0]
  for (const r of CLIMATOLOGY) if (Math.abs(r.lat - latDeg) < Math.abs(row.lat - latDeg)) row = r
  const mean = surface === 'land' ? row.landMean : row.seaMean
  const amp = surface === 'land' ? row.landAmp : row.seaAmp
  // The warmest month is July in the north and January in the south.
  const phase = Math.cos((2 * Math.PI * (month - 6.5)) / 12) * (latDeg >= 0 ? 1 : -1)
  return mean + amp * phase
}

export interface WinterFrame {
  /** Months since the exchange. */
  month: number
  /** Stratospheric soot still aloft, teragrams. */
  sootTg: number
  /** By band: optical depth, the fraction of normal sunlight reaching the ground, the temperature anomaly and the absolute temperature over land. */
  opticalDepth: number[]
  sunlight: number[]
  landAnomaly: number[]
  seaAnomaly: number[]
  landTemp: number[]
  seaTemp: number[]
  frozen: boolean[]
  /** Area-weighted global means. */
  globalAnomaly: number
  landAnomalyMean: number
  sunlightMean: number
  /** Precipitation as a fraction of normal, globally and by band. */
  precipitation: number
  precipitationBand: number[]
}

export interface WinterInput {
  /** Soot delivered to the stratosphere, teragrams of black carbon. */
  sootTg: number
  /** Where it went in: a weight per band, normalised inside. */
  injection: number[]
  zonal: Zonal
  /** How long to run, in months. Default 240, twenty years. */
  months?: number
  /** Which month of the year the exchange happens in, 0 = January. The northern growing season is the thing at risk, so this matters. */
  startMonth?: number
  parameters?: Partial<typeof WINTER_PARAMETERS>
}

const MONTH_SECONDS = (365.25 * 24 * 3_600) / 12
/** Steps within the month: the land's memory is short enough that a month taken whole is unstable. */
const SUB_STEPS = 12

/**
 * Run the model. Returns one frame per month from the exchange, each
 * carrying the state of the sky and the surface.
 */
export function runWinter(input: WinterInput): WinterFrame[] {
  const p = { ...WINTER_PARAMETERS, ...input.parameters }
  const bands = input.zonal.bands
  const n = bands.length
  const months = input.months ?? 240
  const start = input.startMonth ?? 6
  const lat = bands.map((b) => (b.south + b.north) / 2)
  const areaM2 = bands.map((b) => b.areaKm2 * 1e6)
  const totalArea = areaM2.reduce((a, b) => a + b, 0)
  const landFraction = bands.map((b) => Math.min(1, b.landKm2 / b.areaKm2))

  // The injection, as mass per band in teragrams.
  const weight = input.injection.reduce((a, b) => a + Math.max(0, b), 0)
  const soot = input.injection.map((w) => (weight > 0 ? (input.sootTg * Math.max(0, w)) / weight : input.sootTg / n))

  // How long the soot stays: bigger injections loft themselves higher and last longer.
  const removal = p.removalYears * Math.max(1, input.sootTg / 5) ** p.removalExponent * 12
  const hemisphereMix = 1 - Math.exp(-1 / p.mixingHemisphere)
  const crossMix = 1 - Math.exp(-1 / p.mixingCross)

  const landT = new Array<number>(n).fill(0)
  const seaT = new Array<number>(n).fill(0)
  const frames: WinterFrame[] = []

  for (let step = 0; step <= months; step += 1) {
    const month = (start + step) % 12
    const day = MONTH_DAY[month]

    // The sky: optical depth from the mass per unit area, and what gets through it.
    const tau = soot.map((tg, i) => (tg * 1e12 * p.massAbsorption) / areaM2[i])

    // The surface budget, tile by tile. The land has a month's memory and is
    // coupled to the sea beside it hard enough that a whole month is too long
    // a step to take at once, so the month is walked in fifths of a week.
    const q = lat.map((l) => insolation(l, day))
    const frozenAt = seaT.map((v, i) => baseline(lat[i], month, 'sea') + v <= p.freezing)
    const through = tau.map((t) => Math.exp(-p.slantPath * t))
    const sub = MONTH_SECONDS / SUB_STEPS
    const snapshotLand = [...landT]
    const snapshotSea = [...seaT]
    const globalMean = landT.reduce((a, v, i) => a + v * areaM2[i] * landFraction[i], 0) / totalArea + seaT.reduce((a, v, i) => a + v * areaM2[i] * (1 - landFraction[i]), 0) / totalArea
    for (let s = 0; s < SUB_STEPS; s += 1) {
      const mean = landT.reduce((a, v, i) => a + v * areaM2[i] * landFraction[i], 0) / totalArea + seaT.reduce((a, v, i) => a + v * areaM2[i] * (1 - landFraction[i]), 0) / totalArea
      const nextLand = [...landT]
      const nextSea = [...seaT]
      for (let i = 0; i < n; i += 1) {
        const surface = q[i] * p.atmosphere
        const deficit = 1 - through[i]
        const iceHere = baseline(lat[i], month, 'sea') + seaT[i] <= p.freezing
        const fLand = -surface * (1 - p.albedoLand) * deficit * p.compensationLand
        const fSea = -surface * (1 - (iceHere ? p.albedoIce : p.albedoSea)) * deficit * (iceHere ? p.compensationLand : p.compensationSea)
        const fl = landFraction[i]
        const fo = 1 - fl
        // The coast term is a flux between two tiles of unequal area, and it has
        // to balance: what the land takes per square metre times the land's area
        // is what the sea gives per square metre times the sea's. The asymmetry
        // is the point. Air over a band that is three-quarters ocean is maritime
        // air wherever it stands, which is why a tropical continent cannot cool
        // much below the sea beside it, and why a wide northern continent can.
        const ratio = Math.min(p.coastLimit, fo / Math.max(fl, 0.02))
        const exchange = p.coastExchange * (1 + (p.tropicalCoupling - 1) * Math.exp(-((lat[i] / p.tropicalWidthDeg) ** 2)))
        const coastOnLand = fl > 0 ? exchange * ratio * (seaT[i] - landT[i]) : 0
        const coastOnSea = fo > 0 ? exchange * (landT[i] - seaT[i]) * ((fl * ratio) / fo) : 0
        // Under ice there is no evaporation and no convection: the surface is cut off from the ocean beneath it, and falls like land.
        const damping = iceHere ? p.restoringLand : p.restoringSea + p.deepExchange
        const dLand = (fLand - p.restoringLand * landT[i] + coastOnLand + p.transport * (mean - landT[i])) / p.capacityLand
        const dSea = (fSea - damping * seaT[i] + coastOnSea + p.transport * (mean - seaT[i])) / (iceHere ? p.capacityIce : p.capacitySea)
        nextLand[i] = landT[i] + dLand * sub
        nextSea[i] = seaT[i] + dSea * sub
      }
      for (let i = 0; i < n; i += 1) {
        landT[i] = nextLand[i]
        seaT[i] = nextSea[i]
      }
    }

    const sootTotal = soot.reduce((a, b) => a + b, 0)
    const landMean = bands.reduce((a, b, i) => a + snapshotLand[i] * b.landKm2, 0) / Math.max(1, bands.reduce((a, b) => a + b.landKm2, 0))
    const sunlightMean = through.reduce((a, v, i) => a + v * areaM2[i] * q[i], 0) / Math.max(1e-9, areaM2.reduce((a, v, i) => a + v * q[i], 0))
    frames.push({
      month: step,
      sootTg: sootTotal,
      opticalDepth: [...tau],
      sunlight: [...through],
      landAnomaly: [...snapshotLand],
      seaAnomaly: [...snapshotSea],
      landTemp: snapshotLand.map((v, i) => baseline(lat[i], month, 'land') + v),
      seaTemp: snapshotSea.map((v, i) => baseline(lat[i], month, 'sea') + v),
      frozen: frozenAt,
      globalAnomaly: globalMean,
      landAnomalyMean: landMean,
      sunlightMean,
      precipitation: Math.max(0.05, 1 - (1 - sunlightMean) * p.precipitationSensitivity),
      // Rain falls where the sun lifts the water, so a band that has lost its sunlight has lost its rain.
      precipitationBand: through.map((v) => Math.max(0.05, 1 - (1 - v) * p.precipitationSensitivity)),
    })

    // The sky, moved on: spread within each hemisphere, then between them, then washed out.
    spread(soot, areaM2, lat, hemisphereMix, crossMix)
    for (let i = 0; i < n; i += 1) soot[i] *= Math.exp(-1 / removal)
  }
  return frames
}

/**
 * Move the soot about. Within a hemisphere the stratosphere mixes in a
 * couple of months, so each band's concentration relaxes toward the
 * hemispheric mean; across the equator it takes the better part of a year,
 * so the two hemispheric means relax toward the global one.
 */
function spread(soot: number[], areaM2: number[], lat: number[], hemisphere: number, cross: number): void {
  for (const sign of [-1, 1]) {
    const idx = lat.map((l, i) => ({ l, i })).filter((x) => Math.sign(x.l) === sign).map((x) => x.i)
    const area = idx.reduce((a, i) => a + areaM2[i], 0)
    const mass = idx.reduce((a, i) => a + soot[i], 0)
    for (const i of idx) {
      const target = (mass * areaM2[i]) / area
      soot[i] += (target - soot[i]) * hemisphere
    }
  }
  const totalArea = areaM2.reduce((a, b) => a + b, 0)
  const totalMass = soot.reduce((a, b) => a + b, 0)
  for (let i = 0; i < soot.length; i += 1) {
    const target = (totalMass * areaM2[i]) / totalArea
    soot[i] += (target - soot[i]) * cross
  }
}

/** The band a latitude falls in. */
export function bandOf(zonal: Zonal, latDeg: number): number {
  const w = zonal.bandWidthDeg
  return Math.max(0, Math.min(zonal.bands.length - 1, Math.floor((latDeg + 90) / w)))
}

/** Injection weights from a set of burning cities: the soot goes up where they are. */
export function injectionWeights(zonal: Zonal, sources: Array<{ lat: number; weight: number }>): number[] {
  const w = new Array<number>(zonal.bands.length).fill(0)
  for (const s of sources) w[bandOf(zonal, s.lat)] += Math.max(0, s.weight)
  return w
}

/** The worst of the run: the deepest global anomaly and when it comes. */
export function peakOf(frames: WinterFrame[]): { month: number; anomaly: number; landAnomaly: number; sunlight: number } {
  let best = frames[0]
  for (const f of frames) if (f.globalAnomaly < best.globalAnomaly) best = f
  return { month: best.month, anomaly: best.globalAnomaly, landAnomaly: best.landAnomalyMean, sunlight: best.sunlightMean }
}
