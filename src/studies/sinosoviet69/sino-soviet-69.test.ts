import { describe, expect, it } from 'vitest'
import { missileReach, reachOf, sinoSoviet69, sinoSoviet69Arithmetic } from './sino-soviet-69.ts'

describe('the nuclear surgery', () => {
  it('strikes the operating complex and draws the interior plants without striking them', () => {
    const a = sinoSoviet69Arithmetic()
    expect(a.operating).toBe(8)
    expect(a.underConstruction).toBe(2)
    const s = sinoSoviet69()
    // Every operating facility is an aim point; the Third Front plants are sites.
    expect(s.entities.filter((e) => e.kind === 'effect').length).toBeGreaterThan(0)
    expect(s.entities.some((e) => e.id === 'ss69-building-plant-814')).toBe(true)
    expect(s.entities.some((e) => e.id === 'ss69-building-plant-821')).toBe(true)
  })

  /**
   * The finding the missile fields exist to carry: they were in the wrong
   * places. Fifty-five of the fifty-eight launchers east of the Urals are
   * medium-range, and between them they cannot reach either of the two
   * facilities that matter most. If a future edit moved a field into range of
   * everything, the study would quietly stop making its own argument.
   */
  it('finds the medium-range force cannot reach the Ninth Academy or Lanzhou', () => {
    const a = sinoSoviet69Arithmetic()
    expect(a.mediumLaunchers).toBe(55)
    expect(a.withinMediumRange).toBe(5)
    expect(a.withinMediumRange).toBeLessThan(a.operating)
    const medium = missileReach().filter((r) => r.battery.rangeKm <= 2_500)
    const reached = new Set(medium.flatMap((r) => r.targets.map((t) => t.id)))
    expect(reached.has('plant-221'), 'the Ninth Academy').toBe(false)
    expect(reached.has('plant-504'), 'Lanzhou enrichment').toBe(false)
    // The only system that covers the complex is three silos sited against Europe.
    const aktyubinsk = missileReach().find((r) => r.battery.id === 'aktyubinsk')!
    expect(aktyubinsk.battery.launchers).toBe(3)
    expect(aktyubinsk.targets.map((t) => t.id)).toContain('plant-221')
    expect(aktyubinsk.targets.map((t) => t.id)).toContain('plant-504')
  })

  it('leaves the milling and mining beyond every bomber base on the list', () => {
    const a = sinoSoviet69Arithmetic()
    expect(a.beyondReach.map((t) => t.id)).toEqual(['plant-272'])
  })

  it('puts three of the eight in or beside cities, which is the reason it is not a surgery', () => {
    expect(sinoSoviet69Arithmetic().inCities).toBe(3)
  })

  it('reaches the far targets only from the long-range bases', () => {
    // Hengyang, two thousand kilometres deeper into China than anything else.
    const fromDolon = reachOf([79.2, 50.55], 3_250_000).map((t) => t.id)
    const fromVozdvizhenka = reachOf([131.92, 43.9], 1_150_000).map((t) => t.id)
    expect(fromDolon).toContain('lop-nur')
    expect(fromVozdvizhenka).not.toContain('plant-221')
  })

  it('says on the study itself that no such plan is on the record', () => {
    const s = sinoSoviet69()
    expect(s.omissions[0].toLowerCase()).toContain('no soviet plan')
    expect(s.events[s.events.length - 1].text).toContain('NO SUCH PLAN IS ON THE RECORD')
    expect(s.populationGrid).toBe('popc_1969')
  })
})
