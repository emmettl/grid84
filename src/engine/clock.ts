/**
 * The study clock. Time is seconds relative to H-hour (execution order).
 * Entities expose `stateAt(t)`; the clock only owns the number.
 */
export interface ClockState {
  /** Seconds relative to H-hour. Negative before execution. */
  time: number
  playing: boolean
  /** Study seconds per wall-clock second. */
  rate: number
}

export interface ClockBounds {
  start: number
  end: number
}

export function advance(state: ClockState, wallSeconds: number, bounds: ClockBounds): ClockState {
  if (!state.playing) return state
  const next = state.time + wallSeconds * state.rate
  if (next >= bounds.end) return { ...state, time: bounds.end, playing: false }
  return { ...state, time: Math.max(bounds.start, next) }
}

/** `H+00:17:42` style, with the sign and a day count past 24 hours. */
export function formatStudyTime(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+'
  const total = Math.abs(Math.round(seconds))
  const days = Math.floor(total / 86_400)
  const h = Math.floor((total % 86_400) / 3_600)
  const m = Math.floor((total % 3_600) / 60)
  const s = total % 60
  const hms = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return days > 0 ? `H${sign}${days}D ${hms}` : `H${sign}${hms}`
}
