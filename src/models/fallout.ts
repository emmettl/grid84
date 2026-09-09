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
export function contourRing(center: LngLat, dims: ContourDimensions, downwindBearingDeg: number, steps = 48): LngLat[] {
  const points: Array<[number, number]> = [] // [along, across] metres, along positive downwind
  const halfGz = dims.groundZeroWidthMetres / 2
  const halfMax = dims.maxWidthMetres / 2
  const L = dims.downwindMetres
  const profile = (f: number) => {
    // f in [0, 1] along the plume; blend from the ground-zero half width to the peak and down to zero.
    const peak = Math.sin(Math.PI * f) ** 0.6
    return halfGz * (1 - f) + (halfMax - halfGz * (1 - f)) * peak
  }
  for (let i = 0; i <= steps; i += 1) points.push([(i / steps) * L, profile(i / steps)])
  // Upwind semicircle from the downwind-side end back around.
  for (let i = 0; i <= steps / 2; i += 1) {
    const a = Math.PI / 2 + (i / (steps / 2)) * Math.PI
    points.push([Math.cos(a) * dims.upwindMetres, -Math.sin(a) * halfGz])
  }
  for (let i = steps; i >= 0; i -= 1) points.push([(i / steps) * L, -profile(i / steps)])
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
}

export function plume(options: PlumeOptions): PlumeContour[] {
  const metresPerHour = options.windMph * MILE
  return TABLE_9_93.map((row) => {
    const dims = contourDimensions(row, options.yieldKt, options.fissionFraction, options.windMph)
    const arrivalTip = dims.downwindMetres / metresPerHour
    const arrivalMid = (dims.downwindMetres / 3) / metresPerHour
    const dose = accumulatedDose(dims.radsPerHour, arrivalMid, options.untilHours)
    return {
      key: `r${row.radsPerHour}`,
      ...dims,
      ring: contourRing(options.center, dims, options.downwindBearingDeg),
      arrivalTipHours: arrivalTip,
      arrivalMidHours: arrivalMid,
      doseMidRads: dose,
      mortalityMid: acuteMortality(dose),
    }
  })
}
