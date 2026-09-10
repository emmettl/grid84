import { describe, expect, it } from 'vitest'
import { doctrine, doseRadiusMetres, equivalentFissionYieldKt, erwProfile } from './enhanced-radiation.ts'

describe('enhanced radiation weapons', () => {
  it('does not spare the town, but needs a tenth of the yield for the same reach against crews', () => {
    const d = doctrine(1, 'enhanced')
    // The loose claim fails: houses are wrecked about as far as crews are killed.
    expect(d.sparesTheTown).toBe(false)
    expect(d.killMetres).toBeGreaterThan(500)
    expect(d.damageMetres).toBeGreaterThan(d.killMetres * 0.9)
    // The claim that holds: a fission weapon would need ten times the yield, and would wreck several times the ground.
    expect(d.equivalentFissionKt).toBeGreaterThan(8)
    expect(d.equivalentFissionKt).toBeLessThan(30)
    expect(d.damageAreaRatio).toBeGreaterThan(3)
    expect(equivalentFissionYieldKt(1, 'fission')).toBeCloseTo(1, 1)
    const plain = doctrine(1, 'fission')
    expect(plain.damageAreaRatio).toBeCloseTo(1, 5)
    expect(plain.killMetres).toBeLessThan(d.killMetres)
  })
  it('gives armour less protection than a cellar, which is the point', () => {
    const armour = doseRadiusMetres(1, 8_000, 'enhanced', 2.5)
    const cellar = doseRadiusMetres(1, 8_000, 'enhanced', 10)
    expect(armour).toBeGreaterThan(cellar)
  })
  it('loses the argument as the yield grows: at ten kilotons the blast catches the radiation up', () => {
    const small = erwProfile(1, 'enhanced').radiationOverBlast
    const large = erwProfile(50, 'enhanced').radiationOverBlast
    expect(small).toBeGreaterThan(large)
    expect(erwProfile(1, 'fission').radiationOverBlast).toBeLessThan(small)
  })
})
