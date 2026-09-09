import { describe, expect, it } from 'vitest'
import { advance, formatStudyTime } from './clock.ts'

const bounds = { start: -600, end: 3_600 }

describe('advance', () => {
  it('moves by rate while playing and clamps at the end', () => {
    expect(advance({ time: 0, playing: true, rate: 60 }, 1, bounds).time).toBe(60)
    const end = advance({ time: 3_590, playing: true, rate: 60 }, 1, bounds)
    expect(end.time).toBe(3_600)
    expect(end.playing).toBe(false)
  })
  it('does nothing when paused', () => {
    const paused = { time: 5, playing: false, rate: 60 }
    expect(advance(paused, 10, bounds)).toBe(paused)
  })
})

describe('formatStudyTime', () => {
  it('formats H-relative times', () => {
    expect(formatStudyTime(0)).toBe('H+00:00:00')
    expect(formatStudyTime(1_062)).toBe('H+00:17:42')
    expect(formatStudyTime(-90)).toBe('H-00:01:30')
    expect(formatStudyTime(90_000)).toBe('H+1D 01:00:00')
  })
})
