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
