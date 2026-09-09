/**
 * Casualty fractions by peak overpressure band, from the Office of Technology
 * Assessment, The Effects of Nuclear War (1979), chapter II figure 1
 * ("Vulnerability of Population in Various Overpressure Zones"), the same
 * DCPA 1973 curves NUKEMAP uses. Blast only: the planners' method. The OTA
 * itself called the assumptions "relatively conservative".
 */
export interface Band {
  key: string
  label: string
  /** Lower bound of peak overpressure, psi. */
  minPsi: number
  /** Upper bound, psi; Infinity for the innermost band. */
  maxPsi: number
  fatal: number
  injured: number
}

export const OTA_BANDS: Band[] = [
  { key: 'psi12', label: '≥ 12 PSI', minPsi: 12, maxPsi: Infinity, fatal: 0.98, injured: 0.02 },
  { key: 'psi5', label: '5–12 PSI', minPsi: 5, maxPsi: 12, fatal: 0.5, injured: 0.4 },
  { key: 'psi2', label: '2–5 PSI', minPsi: 2, maxPsi: 5, fatal: 0.05, injured: 0.45 },
  { key: 'psi1', label: '1–2 PSI', minPsi: 1, maxPsi: 2, fatal: 0, injured: 0.25 },
]

export const CASUALTY_MODEL = 'OTA 1979 fig. II-1 (DCPA 1973) blast-only casualty fractions'

/**
 * Structure class as a collapse pressure. The OTA bands assume the 1970s
 * American residential stock, which "most residential buildings collapse"
 * at 5 psi; Glasstone's 1953 and 1955 Nevada houses collapsed or were
 * damaged beyond repair at 5 psi (§5.57, §5.67). Japanese-style wooden
 * dwellings at Hiroshima and Nagasaki "collapsed at distances up to 7,500
 * feet from ground zero, where the peak overpressure was estimated to be
 * about 3 pounds per square inch" (§5.53). People are hurt by buildings
 * more than by pressure, so the bands scale with the collapse pressure.
 */
export interface StructureClass {
  key: string
  label: string
  collapsePsi: number
  evidence: 'documented' | 'reconstructed' | 'inferred'
  source: string
}

export const STRUCTURE_CLASSES: StructureClass[] = [
  { key: 'ota-1979', label: 'US residential, 1979 baseline', collapsePsi: 5, evidence: 'documented', source: 'OTA 1979 fig. II-1; Glasstone & Dolan §5.57, §5.67' },
  { key: 'japan-1945', label: 'Japanese wooden dwellings, 1945', collapsePsi: 3, evidence: 'documented', source: 'Glasstone & Dolan §5.53: collapsed to 7,500 ft at about 3 psi' },
]

export const BASELINE_COLLAPSE_PSI = 5

/** The OTA bands with their thresholds scaled to a structure's collapse pressure. */
export function bandsFor(structure: StructureClass | number): Band[] {
  const collapse = typeof structure === 'number' ? structure : structure.collapsePsi
  const k = collapse / BASELINE_COLLAPSE_PSI
  return OTA_BANDS.map((b) => ({ ...b, minPsi: b.minPsi * k, maxPsi: b.maxPsi === Infinity ? Infinity : b.maxPsi * k }))
}

/**
 * Radius for an arbitrary overpressure by log-log interpolation between the
 * Sublette constants (20, 10, 5, 3, 1 psi). The 12 and 2 psi radii the OTA
 * bands need fall between tabulated points.
 */
const REFERENCE: Array<[psi: number, kmPerKtCubeRoot: number]> = [[20, 0.28], [10, 0.45], [5, 0.71], [3, 1.0], [1, 2.2]]

export function overpressureRadiusForPsi(yieldKt: number, psi: number): number {
  const cube = Math.cbrt(yieldKt)
  if (psi >= REFERENCE[0][0]) return REFERENCE[0][1] * (psi / REFERENCE[0][0]) ** -0.5 * cube * 1_000
  if (psi <= REFERENCE[REFERENCE.length - 1][0]) return REFERENCE[REFERENCE.length - 1][1] * (psi / REFERENCE[REFERENCE.length - 1][0]) ** -0.7 * cube * 1_000
  for (let i = 1; i < REFERENCE.length; i += 1) {
    const [p0, c0] = REFERENCE[i - 1]
    const [p1, c1] = REFERENCE[i]
    if (psi >= p1 && psi <= p0) {
      const f = (Math.log(psi) - Math.log(p0)) / (Math.log(p1) - Math.log(p0))
      const c = Math.exp(Math.log(c0) + f * (Math.log(c1) - Math.log(c0)))
      return c * cube * 1_000
    }
  }
  throw new Error(`unreachable overpressure ${psi}`)
}

/**
 * Band populations from cumulative "within" counts, so rings that are not
 * bands (the fire zone, the fireball) do not disturb the arithmetic.
 */
export function bandPopulations(within: Record<string, number>, bands: Band[] = OTA_BANDS): Record<string, number> {
  const out: Record<string, number> = {}
  let previous = 0
  // Innermost band first: bands are ordered from the highest pressure outward.
  for (const band of bands) {
    const cumulative = within[band.key] ?? previous
    out[band.key] = Math.max(0, cumulative - previous)
    previous = cumulative
  }
  return out
}

/** Population inside each OTA band, given per-band population from the exposure sum. */
export interface BandExposure {
  band: Band
  population: number
  fatal: number
  injured: number
}

export function applyBands(populationByBand: Record<string, number>, bands: Band[] = OTA_BANDS): BandExposure[] {
  return bands.map((band) => {
    const population = populationByBand[band.key] ?? 0
    return { band, population, fatal: population * band.fatal, injured: population * band.injured }
  })
}

/**
 * Postol's superfire bound: within the mass-fire zone, taken here as the
 * third-degree-burn radius (about 8 to 10 cal/cm², roughly 12 km for 1 Mt),
 * everyone is counted dead. Postol, "Possible Fatalities from Superfires",
 * in The Medical Implications of Nuclear War (1986). It is an upper bound
 * and says so.
 */
export const FIRE_MODEL = 'Postol 1986 superfire bound: all within the third-degree burn radius'

export interface Outcome {
  /** Blast-only, the 1961 method. */
  blast: { fatal: number; injured: number; exposed: number }
  /** Blast fatalities plus everyone in the fire zone not already counted. */
  fire: { fatal: number; exposed: number }
}

export function outcome(bands: BandExposure[], populationInFireZone: number): Outcome {
  const fatal = bands.reduce((s, b) => s + b.fatal, 0)
  const injured = bands.reduce((s, b) => s + b.injured, 0)
  const exposed = bands.reduce((s, b) => s + b.population, 0)
  return {
    blast: { fatal, injured, exposed },
    fire: { fatal: Math.max(fatal, populationInFireZone), exposed: Math.max(exposed, populationInFireZone) },
  }
}
