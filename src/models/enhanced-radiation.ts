import { overpressureRadiusMetres, radiationRadiusMetres, thirdDegreeBurnRadiusMetres } from './blast.ts'

/**
 * Enhanced radiation weapons, and the argument made for them.
 *
 * A fission weapon puts about half its energy into blast, a third into
 * heat and some five per cent into prompt radiation. An enhanced radiation
 * weapon is a small thermonuclear device built so that most of the fusion
 * neutrons escape rather than being captured: about a tenth of the yield
 * goes to blast and heat for a given radiation output, so for the same
 * prompt dose the blast radius is much smaller, or for the same blast the
 * dose is much larger. The doctrine that followed said this made the
 * weapon usable on the ground being defended: a tank crew inside armour
 * is protected from blast and not from neutrons, so a battery could kill
 * the crews of an armoured division on German soil without flattening the
 * German towns among them.
 *
 * The arithmetic here is the standard scaling, and it is enough to test
 * the claim, which turns out to be narrower than the argument made for it.
 * A one-kiloton enhanced weapon incapacitates a crew in armour out to
 * about six hundred metres and wrecks ordinary houses out to seven
 * hundred: it does not spare the town it is used over. What it does do is
 * kill those crews with a fifth of the blast area a fission weapon would
 * need for the same reach, because the fission weapon would have to be
 * ten to fifteen times the yield. The weapon is not clean; it is smaller
 * for the same military effect, and the doctrine turned that into an
 * argument for using it sooner.
 *
 * Sources: Glasstone & Dolan, The Effects of Nuclear Weapons (1977), ch. VIII
 * for prompt radiation and the dose criteria; Sublette, Nuclear Weapons FAQ
 * §1.6 and §5.6 for the radii and the energy partition; the dose criteria
 * for immediate incapacitation are the ones the American Army used in the
 * 1970s and are stated rather than derived.
 */

export type WeaponKind = 'fission' | 'enhanced'

export const ERW_MODEL = 'Glasstone & Dolan 1977 ch. VIII with the FAQ radii; the enhanced-radiation factor is a stated multiplier on the prompt dose, not a transport calculation'

/**
 * How much more prompt radiation an enhanced weapon gives for the same
 * yield. The open literature puts the neutron output of an ERW at roughly
 * an order of magnitude above a fission weapon of the same yield; ten is
 * taken here and it is an assumption, not a measurement.
 */
export const ENHANCEMENT = 10

/** The dose criteria the doctrine used, rads of prompt radiation. */
export const DOSES = [
  { key: 'incapacitation', rads: 8_000, label: 'IMMEDIATE INCAPACITATION', note: 'A crew stops fighting within minutes and dies within days. The criterion an artillery officer was given for a tank crew' },
  { key: 'lethal', rads: 3_000, label: 'CERTAIN DEATH', note: 'Death within days, but a crew may fight on for hours first, which is why the higher criterion existed' },
  { key: 'lethal50', rads: 650, label: 'HALF DIE', note: 'The median lethal dose without treatment' },
  { key: 'sick', rads: 150, label: 'RADIATION SICKNESS', note: 'Sickness, and a raised chance of cancer for the rest of a life' },
] as const

/**
 * Shielding, as a divisor on the dose. Armour is good against blast and
 * poor against neutrons, which is the whole basis of the doctrine; a
 * cellar is the reverse.
 */
export const SHIELDING = [
  { key: 'open', label: 'In the open', factor: 1 },
  { key: 'armour', label: 'Inside a tank', factor: 2.5 },
  { key: 'building', label: 'In a house', factor: 3 },
  { key: 'cellar', label: 'In a cellar', factor: 10 },
] as const

export type ShieldingKey = (typeof SHIELDING)[number]['key']

/** Prompt radiation radius for a dose, with the weapon's enhancement and the target's shielding. */
export function doseRadiusMetres(yieldKt: number, rads: number, kind: WeaponKind, shieldingFactor = 1): number {
  // A shielded target needs the unshielded dose to be higher by the factor; an enhanced weapon delivers more for its yield.
  const effective = (rads * shieldingFactor) / (kind === 'enhanced' ? ENHANCEMENT : 1)
  return Math.max(0, radiationRadiusMetres(yieldKt, effective))
}

export interface ErwProfile {
  yieldKt: number
  kind: WeaponKind
  /** The radius at which the dose criterion is met, metres, by shielding. */
  doses: Array<{ key: string; label: string; rads: number; note: string; radii: Record<ShieldingKey, number> }>
  blast5psiMetres: number
  blast20psiMetres: number
  burnsMetres: number
  /** The ratio the doctrine rests on: incapacitating radiation against severe blast. */
  radiationOverBlast: number
}

export function erwProfile(yieldKt: number, kind: WeaponKind): ErwProfile {
  const doses = DOSES.map((d) => ({
    key: d.key,
    label: d.label,
    rads: d.rads,
    note: d.note,
    radii: Object.fromEntries(SHIELDING.map((s) => [s.key, doseRadiusMetres(yieldKt, d.rads, kind, s.factor)])) as Record<ShieldingKey, number>,
  }))
  const blast5 = overpressureRadiusMetres(yieldKt, 5)
  const incap = doses[0].radii.armour
  return {
    yieldKt,
    kind,
    doses,
    blast5psiMetres: blast5,
    blast20psiMetres: overpressureRadiusMetres(yieldKt, 20),
    burnsMetres: thirdDegreeBurnRadiusMetres(yieldKt),
    radiationOverBlast: blast5 > 0 ? incap / blast5 : 0,
  }
}

/** The fission yield that would incapacitate crews in armour as far out as this weapon does. */
export function equivalentFissionYieldKt(yieldKt: number, kind: WeaponKind): number {
  const want = doseRadiusMetres(yieldKt, DOSES[0].rads, kind, 2.5)
  let lo = 0.01
  let hi = 10_000
  for (let i = 0; i < 60; i += 1) {
    const mid = Math.sqrt(lo * hi)
    if (doseRadiusMetres(mid, DOSES[0].rads, 'fission', 2.5) < want) lo = mid
    else hi = mid
  }
  return Math.sqrt(lo * hi)
}

export interface Doctrine {
  /** How far crews in armour are incapacitated. */
  killMetres: number
  /** How far ordinary houses are wrecked. */
  damageMetres: number
  /** Whether the crews are killed beyond the houses that are wrecked: the loose version of the claim. */
  sparesTheTown: boolean
  /** The fission yield needed for the same reach against crews, and what it would flatten. */
  equivalentFissionKt: number
  equivalentDamageMetres: number
  /** How many times less ground is wrecked for the same military effect: the claim that actually holds. */
  damageAreaRatio: number
}

/**
 * The doctrinal question in numbers. The loose claim is that the weapon
 * kills the crews and spares the town; the claim that holds is that it
 * kills them over a fraction of the wrecked ground a fission weapon needs.
 */
export function doctrine(yieldKt: number, kind: WeaponKind): Doctrine {
  const p = erwProfile(yieldKt, kind)
  const killMetres = p.doses[0].radii.armour
  const equivalentFissionKt = kind === 'enhanced' ? equivalentFissionYieldKt(yieldKt, kind) : yieldKt
  const equivalentDamageMetres = overpressureRadiusMetres(equivalentFissionKt, 5)
  return {
    killMetres,
    damageMetres: p.blast5psiMetres,
    sparesTheTown: killMetres > p.blast5psiMetres,
    equivalentFissionKt,
    equivalentDamageMetres,
    damageAreaRatio: p.blast5psiMetres > 0 ? (equivalentDamageMetres / p.blast5psiMetres) ** 2 : 1,
  }
}
