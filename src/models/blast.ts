/**
 * Prompt effects of a nuclear detonation, from yield alone.
 *
 * Scaling laws from Carey Sublette, Nuclear Weapons FAQ §5.6, which are
 * curve fits to Glasstone and Dolan, The Effects of Nuclear Weapons (1977).
 * Ranges are for an air burst at the height that maximises the 5 psi radius,
 * over flat ground, in clear air. Accurate to about 10 percent from 1 kt to
 * 20 Mt. No terrain, no shielding, no weather. Say so on the readout.
 */
export interface EffectRing {
  key: string
  label: string
  /** Radius in metres. */
  radius: number
  /** What the ring means in plain words, for the readout. */
  criterion: string
}

export interface PromptEffects {
  yieldKt: number
  model: string
  rings: EffectRing[]
}

export const BLAST_MODEL = 'Sublette NWFAQ §5.6 fits to Glasstone & Dolan 1977; optimum-height air burst; ±10%'

/** Overpressure radius in km: r = c · Y^(1/3), Y in kt. */
const OVERPRESSURE_KM_PER_KT_CUBE_ROOT: Record<number, number> = { 20: 0.28, 10: 0.45, 5: 0.71, 3: 1.0, 1: 2.2 }

export function overpressureRadiusMetres(yieldKt: number, psi: 20 | 10 | 5 | 3 | 1): number {
  return OVERPRESSURE_KM_PER_KT_CUBE_ROOT[psi] * Math.cbrt(yieldKt) * 1_000
}

/**
 * Maximum fireball radius for an air burst, metres. Glasstone & Dolan §2.127:
 * radius at breakaway ≈ 100 · W^0.4 feet, and the maximum "may be taken to be
 * about twice that at the time of breakaway".
 */
export function fireballRadiusMetres(yieldKt: number): number {
  return 2 * 100 * yieldKt ** 0.4 * 0.3048
}

/** Third-degree burn radius in km: 0.67 · Y^0.41. */
export function thirdDegreeBurnRadiusMetres(yieldKt: number): number {
  return 0.67 * yieldKt ** 0.41 * 1_000
}

/** Initial nuclear radiation. 1000 rad radius is 0.70 · Y^0.19 km; dose falls tenfold per "tenth range". */
export function radiationRadiusMetres(yieldKt: number, rad: number): number {
  const r1000 = 0.7 * yieldKt ** 0.19 * 1_000
  const tenth = tenthRangeMetres(yieldKt)
  return r1000 + Math.log10(1_000 / rad) * tenth
}

/** Tenth-range attenuation distance in metres, interpolated in log yield from the FAQ table. */
export function tenthRangeMetres(yieldKt: number): number {
  const table: Array<[number, number]> = [[1, 330], [10, 440], [100, 490], [1_000, 560], [10_000, 670], [20_000, 700]]
  if (yieldKt <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i += 1) {
    const [y0, d0] = table[i - 1]
    const [y1, d1] = table[i]
    if (yieldKt <= y1) {
      const f = (Math.log10(yieldKt) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0))
      return d0 + f * (d1 - d0)
    }
  }
  return table[table.length - 1][1]
}

export function promptEffects(yieldKt: number): PromptEffects {
  return {
    yieldKt,
    model: BLAST_MODEL,
    rings: [
      { key: 'fireball', label: 'FIREBALL', radius: fireballRadiusMetres(yieldKt), criterion: 'Maximum fireball radius, air burst (Glasstone & Dolan §2.127)' },
      { key: 'psi20', label: '20 PSI', radius: overpressureRadiusMetres(yieldKt, 20), criterion: 'Heavily built concrete structures severely damaged or demolished' },
      { key: 'psi5', label: '5 PSI', radius: overpressureRadiusMetres(yieldKt, 5), criterion: 'Most residential buildings collapse; widespread fatalities' },
      { key: 'rad500', label: '500 RAD', radius: radiationRadiusMetres(yieldKt, 500), criterion: 'Initial radiation dose likely fatal without treatment' },
      { key: 'burn3', label: '3RD DEGREE', radius: thirdDegreeBurnRadiusMetres(yieldKt), criterion: 'Third-degree burns to exposed skin' },
      { key: 'psi1', label: '1 PSI', radius: overpressureRadiusMetres(yieldKt, 1), criterion: 'Window glass shatters; injuries from flying glass' },
    ],
  }
}

/**
 * Free-air peak overpressure in bars at scaled distance Z = R / m^(1/3),
 * R in metres and m the TNT mass in kilograms: Brode's 1955 fit,
 *   Δp = 0.975/Z + 1.455/Z² + 5.85/Z³ − 0.019      for 0.1 < Δp < 10 bar.
 * One kiloton is taken as 10⁶ kg of TNT.
 */
export function brodeFreeAirBars(Z: number): number {
  return 0.975 / Z + 1.455 / (Z * Z) + 5.85 / (Z * Z * Z) - 0.019
}

/** Scaled distance at which Brode's free-air fit gives `bars`, by bisection on the 0.1 to 10 bar branch. */
export function brodeScaledDistance(bars: number): number {
  let lo = 0.5
  let hi = 100
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2
    if (brodeFreeAirBars(mid) > bars) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export const PSI_PER_BAR = 14.5038

/**
 * Kinney & Graham (1985) free-air peak overpressure ratio Δp/p₀ at scaled
 * distance Z in m/kg^(1/3), as printed by Dlubal's formula reference:
 *   Δp/p₀ = 808 [1 + (Z/4.5)²] / √([1 + (Z/0.048)²][1 + (Z/0.32)²][1 + (Z/1.35)²])
 */
export function kinneyGrahamRatio(Z: number): number {
  return (808 * (1 + (Z / 4.5) ** 2)) / Math.sqrt((1 + (Z / 0.048) ** 2) * (1 + (Z / 0.32) ** 2) * (1 + (Z / 1.35) ** 2))
}

export function kinneyGrahamScaledDistance(bars: number): number {
  const ratio = bars / 1.01325
  let lo = 0.1
  let hi = 200
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2
    if (kinneyGrahamRatio(mid) > ratio) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Ground range for a peak overpressure from a contact surface burst.
 * Glasstone & Dolan §3.34: over an ideal reflecting surface the shock from a
 * contact burst "would correspond to that for a free air burst ... with
 * twice the energy yield". Real surfaces give somewhat less; this is the
 * upper value. Compare overpressureRadiusMetres, which is the optimum-height
 * air burst: at 20 psi the two nearly agree, at 1 psi the surface burst
 * reaches about three quarters as far.
 */
export function surfaceOverpressureRadiusMetres(yieldKt: number, psi: number): number {
  const Z = kinneyGrahamScaledDistance(psi / PSI_PER_BAR)
  return Z * Math.cbrt(2 * yieldKt * 1e6)
}

export const SURFACE_BLAST_MODEL = 'Glasstone & Dolan §3.34 (contact burst as a free-air burst of 2W, ideal surface) with the Kinney & Graham 1985 free-air fit; upper value'
