import type { LngLat } from '../geo/geodesy.ts'

/**
 * Early fallout from a contact surface burst, after Glasstone & Dolan,
 * The Effects of Nuclear Weapons (1977), chapter IX.
 *
 * - Idealized unit-time (H+1) reference dose-rate contours from Table 9.93:
 *   downwind distance, maximum width and ground-zero width as a·W^b for a
 *   15 mph effective wind with 15° shear; upwind extent about half the
 *   ground-zero width (§9.93).
 * - Dose-rate values scale with the fission fraction (§9.94).
 * - Downwind distances scale with wind speed by §9.97's factor F.
 * - Decay as t^-1.2 (§9.15), within about 25 percent for two weeks.
 * - Accumulated dose is the integral of that law from arrival.
 *
 * Idealized: a smooth plane, a simple wind, no rain, no shelter. §9.95 says
 * real surfaces give 0.7 of these values in the open and 0.5 to 0.6 in
 * rough terrain. Air bursts produce no significant early fallout (§9.48).
 */
const MILE = 1_609.344

export interface ContourRow {
  /** Unit-time reference dose rate, rads/hr, for a 100 percent fission weapon. */
  radsPerHour: number
  downwind: [number, number]
  maxWidth: [number, number]
  groundZeroWidth: [number, number]
}

/** Table 9.93, coefficients a and exponents b in statute miles for W kilotons. */
export const TABLE_9_93: ContourRow[] = [
  { radsPerHour: 3_000, downwind: [0.95, 0.45], maxWidth: [0.0076, 0.86], groundZeroWidth: [0.026, 0.58] },
  { radsPerHour: 1_000, downwind: [1.8, 0.45], maxWidth: [0.036, 0.76], groundZeroWidth: [0.06, 0.57] },
  { radsPerHour: 300, downwind: [4.5, 0.45], maxWidth: [0.13, 0.66], groundZeroWidth: [0.2, 0.48] },
  { radsPerHour: 100, downwind: [8.9, 0.45], maxWidth: [0.38, 0.6], groundZeroWidth: [0.39, 0.42] },
  { radsPerHour: 30, downwind: [16, 0.45], maxWidth: [0.76, 0.56], groundZeroWidth: [0.53, 0.41] },
  { radsPerHour: 10, downwind: [24, 0.45], maxWidth: [1.4, 0.53], groundZeroWidth: [0.68, 0.41] },
  { radsPerHour: 3, downwind: [30, 0.45], maxWidth: [2.2, 0.5], groundZeroWidth: [0.89, 0.41] },
  { radsPerHour: 1, downwind: [40, 0.45], maxWidth: [3.3, 0.48], groundZeroWidth: [1.5, 0.41] },
]

export const FALLOUT_MODEL = 'Glasstone & Dolan 1977 ch. IX idealized unit-time contours (Table 9.93), t^-1.2 decay; contact surface burst, smooth plane, simple wind'

/** §9.97: downwind distances scale by F for an effective wind of v mph. */
export function windFactor(mph: number): number {
  return mph >= 15 ? 1 + (mph - 15) / 60 : 1 + (mph - 15) / 30
}

export interface ContourDimensions {
  /** Dose rate at H+1 on this contour for the given fission fraction, rads/hr. */
  radsPerHour: number
  downwindMetres: number
  maxWidthMetres: number
  groundZeroWidthMetres: number
  upwindMetres: number
}

export function contourDimensions(row: ContourRow, yieldKt: number, fissionFraction: number, windMph: number): ContourDimensions {
  const scale = (ab: [number, number]) => ab[0] * yieldKt ** ab[1] * MILE
  const gz = scale(row.groundZeroWidth)
  return {
    radsPerHour: row.radsPerHour * fissionFraction,
    downwindMetres: scale(row.downwind) * windFactor(windMph),
    maxWidthMetres: scale(row.maxWidth),
    groundZeroWidthMetres: gz,
    upwindMetres: gz / 2,
  }
}

/** Dose rate at t hours relative to the H+1 reference (§9.15). */
export function decayRatio(hours: number): number {
  return Math.max(hours, 1 / 60) ** -1.2
}

/**
 * The dose someone takes who never leaves: the decay integral to infinity,
 * which converges because t^-1.2 falls faster than 1/t. From an arrival at
 * one hour it is five times the unit-time rate, and the forty-eight hours a
 * study draws is a little over half of it. The t^-1.2 law is good to within
 * about a quarter for two weeks and is an extrapolation beyond that, so this
 * is a bound and is labelled as one.
 */
export function infiniteDose(r1: number, arrivalHours: number): number {
  const a = Math.max(arrivalHours, 1 / 60)
  return (r1 * a ** -0.2) / 0.2
}

/** What fraction of the dose someone would ever take is taken by `untilHours`. */
export function doseFractionByHour(arrivalHours: number, untilHours: number): number {
  const whole = infiniteDose(1, arrivalHours)
  return whole > 0 ? accumulatedDose(1, arrivalHours, untilHours) / whole : 0
}

/**
 * Latent fatal cancers from a collective dose, at the nominal risk
 * coefficient of about five per cent per sievert. Applying a coefficient to
 * a population's collective dose is contested, and the commission that
 * publishes the coefficient advises against exactly this use; it is given
 * because the alternative is to leave the long tail at zero, which is
 * further from the truth.
 */
export const CANCER_PER_PERSON_SIEVERT = 0.055
export function latentFatalCancers(personRads: number): number {
  return (personRads / 100) * CANCER_PER_PERSON_SIEVERT
}

/** Accumulated dose in rads from arrival at `arrivalHours` to `untilHours`, for unit-time reference rate r1. */
export function accumulatedDose(r1: number, arrivalHours: number, untilHours: number): number {
  const a = Math.max(arrivalHours, 0.1)
  const t = Math.max(untilHours, a)
  return 5 * r1 * (a ** -0.2 - t ** -0.2)
}

/**
 * Acute whole-body mortality from Table 12.108: none below 200 rems, 0 to 90
 * percent from 200 to 600, 90 to 100 from 600 to 1,000, all above. Linear
 * inside each band, which is an interpolation of a table, not a dose-response
 * curve; no medical treatment is assumed beyond what the table assumes.
 */
export function acuteMortality(rems: number): number {
  if (rems < 200) return 0
  if (rems < 600) return ((rems - 200) / 400) * 0.9
  if (rems < 1_000) return 0.9 + ((rems - 600) / 400) * 0.1
  return 1
}

/**
 * The idealized contour as a closed ring of [lon, lat]: a semicircle upwind
 * of ground-zero width, then a cigar that reaches its maximum width about a
 * third of the way downwind and closes to a point at the downwind distance.
 * The cigar profile is a drawing convention for Fig. 9.93, not a formula
 * from the book.
 */
export function contourRing(center: LngLat, dims: ContourDimensions, downwindBearingDeg: number, steps = 48, clipAlongMetres = Infinity): LngLat[] {
  const points: Array<[number, number]> = [] // [along, across] metres, along positive downwind
  const halfGz = dims.groundZeroWidthMetres / 2
  const halfMax = dims.maxWidthMetres / 2
  const L = dims.downwindMetres
  const clip = Math.min(L, Math.max(0, clipAlongMetres))
  const profile = (f: number) => {
    // f in [0, 1] along the plume; blend from the ground-zero half width to the peak and down to zero.
    const peak = Math.sin(Math.PI * f) ** 0.6
    return halfGz * (1 - f) + (halfMax - halfGz * (1 - f)) * peak
  }
  for (let i = 0; i <= steps; i += 1) {
    const along = (i / steps) * L
    if (along > clip) {
      points.push([clip, profile(clip / L)])
      break
    }
    points.push([along, profile(i / steps)])
  }
  // Upwind semicircle from the downwind-side end back around.
  for (let i = 0; i <= steps / 2; i += 1) {
    const a = Math.PI / 2 + (i / (steps / 2)) * Math.PI
    points.push([Math.cos(a) * dims.upwindMetres, -Math.sin(a) * halfGz])
  }
  for (let i = steps; i >= 0; i -= 1) {
    const along = (i / steps) * L
    if (along > clip) {
      if (i === steps || (i + 1) / steps * L > clip) {
        if (points[points.length - 1][0] !== clip) points.push([clip, -profile(clip / L)])
      }
      continue
    }
    points.push([along, -profile(i / steps)])
  }
  const brg = (downwindBearingDeg * Math.PI) / 180
  const cosLat = Math.cos((center[1] * Math.PI) / 180)
  const ring: LngLat[] = points.map(([along, across]) => {
    const north = along * Math.cos(brg) - across * Math.sin(brg)
    const east = along * Math.sin(brg) + across * Math.cos(brg)
    return [center[0] + east / (111_320 * cosLat), center[1] + north / 111_320]
  })
  ring.push(ring[0])
  return ring
}

export interface PlumeContour extends ContourDimensions {
  key: string
  ring: LngLat[]
  /** Arrival of fallout at the contour's downwind tip and at a third of the way, hours. */
  arrivalTipHours: number
  arrivalMidHours: number
  /** Accumulated dose from mid-plume arrival to `untilHours`, rads. */
  doseMidRads: number
  mortalityMid: number
}

export interface PlumeOptions {
  center: LngLat
  yieldKt: number
  fissionFraction: number
  windMph: number
  /** Direction the fallout travels, degrees clockwise from north. */
  downwindBearingDeg: number
  untilHours: number
  /** Draw only the part of each contour the cloud has reached by this many hours after the burst. */
  reachedHours?: number
  /**
   * Directional shear of the winds carrying the cloud, degrees; the table's
   * contours assume 15°. More shear spreads the pattern wider and shorter,
   * as §9.93 describes; here by the square root of the ratio, a stated rule.
   */
  shearDeg?: number
  /** §9.95: real surfaces give about 0.7 of the idealized dose rates in the open, 0.5 to 0.6 in rough terrain. Default 1, the idealized plane. */
  terrainFactor?: number
  /**
   * Shielding, as the factor by which a structure divides the dose its
   * occupants take: Glasstone's protection factor. One is standing in the
   * open, which is the studies' assumption and an upper bound on the dead;
   * a house is two to three, a basement ten to forty, a purpose-built
   * shelter a hundred or more. This is the single largest uncertainty in
   * any fallout casualty figure.
   */
  protectionFactor?: number
}

/** Glasstone ch. IX: what a structure divides the dose by. Round figures, and the range within each kind is wide. */
export const PROTECTION_FACTORS = [
  { key: 'open', label: 'In the open', factor: 1, note: 'The studies\' assumption, and an upper bound on the dead' },
  { key: 'house', label: 'A house, upper floor', factor: 2, note: 'Frame and brick houses give little: two to three' },
  { key: 'ground', label: 'A house, ground floor, inner room', factor: 5, note: 'The British stay-at-home advice: an inner refuge away from outside walls' },
  { key: 'basement', label: 'A basement', factor: 20, note: 'Ten to forty, depending on how much of it is below grade' },
  { key: 'shelter', label: 'A purpose-built shelter', factor: 100, note: 'What civil-defence programmes costed and, in Britain and America, did not build for the public' },
] as const

/** The table's contours widened and shortened for a shear other than the 15° they assume. */
export function shearAdjust(dims: ContourDimensions, shearDeg: number): ContourDimensions {
  const ratio = Math.max(0.5, Math.min(4, shearDeg / 15))
  const wider = Math.sqrt(ratio)
  return { ...dims, maxWidthMetres: dims.maxWidthMetres * wider, groundZeroWidthMetres: dims.groundZeroWidthMetres * Math.sqrt(wider), downwindMetres: dims.downwindMetres / Math.sqrt(wider) }
}

export function plume(options: PlumeOptions): PlumeContour[] {
  const metresPerHour = options.windMph * MILE
  const clip = options.reachedHours === undefined ? Infinity : Math.max(0, options.reachedHours) * metresPerHour
  const terrain = options.terrainFactor ?? 1
  const protection = Math.max(1, options.protectionFactor ?? 1)
  return TABLE_9_93.map((row) => {
    const ideal = contourDimensions(row, options.yieldKt, options.fissionFraction, options.windMph)
    const sheared = options.shearDeg !== undefined && options.shearDeg !== 15 ? shearAdjust(ideal, options.shearDeg) : ideal
    const dims = { ...sheared, radsPerHour: sheared.radsPerHour * terrain }
    const arrivalTip = dims.downwindMetres / metresPerHour
    const arrivalMid = (dims.downwindMetres / 3) / metresPerHour
    const dose = accumulatedDose(dims.radsPerHour, arrivalMid, options.untilHours) / protection
    return {
      key: `r${row.radsPerHour}`,
      ...dims,
      ring: contourRing(options.center, dims, options.downwindBearingDeg, 48, clip),
      arrivalTipHours: arrivalTip,
      arrivalMidHours: arrivalMid,
      doseMidRads: dose,
      mortalityMid: acuteMortality(dose),
    }
  })
}
