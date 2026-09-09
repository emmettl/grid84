import { describe, expect, it } from 'vitest'
import { commandsAt, COMMAND_TOTALS, COMMANDS, generationAt, GENERATION_POINTS, optionAt, optionHours, SYSTEMS } from './readiness.ts'

describe('generationAt', () => {
  it('returns the documented points exactly', () => {
    expect(generationAt(0)).toMatchObject({ option: 1, systems: 1_004, weapons: 1_685, systemsEvidence: 'documented' })
    expect(generationAt(1).systems).toBe(1_099)
    expect(generationAt(6)).toMatchObject({ option: 7, systems: 1_658, systemsEvidence: 'documented' })
    expect(generationAt(14)).toMatchObject({ option: 14, systems: 2_244, weapons: 3_267 })
    expect(generationAt(30).systems).toBe(2_244)
  })
  it('draws straight lines between them and says so', () => {
    const g = generationAt(3.5)
    expect(g.systemsEvidence).toBe('reconstructed')
    expect(g.systems).toBeCloseTo(1_099 + (2.5 / 5) * (1_658 - 1_099), 6)
    expect(g.option).toBe(4)
    expect(g.megatons).toBeGreaterThan(1_798)
    expect(g.megatons).toBeLessThan(7_420)
    expect(generationAt(14).megatons).toBeCloseTo(7_420, 6)
  })
  it('maps options to hours the way the two stated cases do', () => {
    expect(optionHours(2)).toBe(1)
    expect(optionHours(7)).toBe(6)
    expect(optionAt(6)).toBe(7)
    expect(optionAt(13.9)).toBe(13)
    expect(optionAt(14)).toBe(14)
  })
})

describe('tables of 15 July 1961', () => {
  it('sum by command to the stated totals', () => {
    const sum = (k: 'alert' | 'nonAlert' | 'generated') => COMMANDS.reduce((s, c) => s + c[k], 0)
    expect(sum('alert')).toBe(COMMAND_TOTALS.alert)
    expect(sum('nonAlert')).toBe(COMMAND_TOTALS.nonAlert)
    expect(sum('generated')).toBe(COMMAND_TOTALS.generated)
    expect(COMMAND_TOTALS.alert + COMMAND_TOTALS.nonAlert).toBe(COMMAND_TOTALS.generated)
  })
  it('sum by system to the same totals', () => {
    expect(SYSTEMS.reduce((s, r) => s + r.alert, 0)).toBe(1_530)
    expect(SYSTEMS.reduce((s, r) => s + r.generated, 0)).toBe(3_267)
  })
  it('carry the disagreement between the chart and the table on the alert force', () => {
    expect(GENERATION_POINTS[0].weapons).toBe(1_685)
    expect(COMMAND_TOTALS.alert).toBe(1_530)
  })
  it('interpolates commands to the generated force at fourteen hours', () => {
    const at14 = commandsAt(14)
    expect(at14.find((c) => c.command === 'Strategic Air Command')!.at).toBe(2_180)
    expect(commandsAt(0).reduce((s, c) => s + c.at, 0)).toBe(1_530)
  })
})
