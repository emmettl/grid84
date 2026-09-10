import type { LngLat } from '../geo/geodesy.ts'

/**
 * The wind that carries the cloud, for the plume: Open-Meteo's forecast at
 * 850, 700 and 500 hPa, about 1.5, 3 and 5.5 km, over the twelve hours
 * after the strike, vector-averaged into one effective wind, with the
 * spread of directions among the samples as the shear. Open-Meteo is free
 * and keyless (CC BY 4.0). If it cannot be reached, a prevailing westerly
 * of fifteen miles an hour with the table's 15° shear is assumed and said so.
 */
export interface WindAloft {
  fromDeg: number
  mph: number
  /** Directional spread of the carrying winds, degrees; the plume model's contours assume 15. */
  shearDeg: number
  surfaceFromDeg: number | null
  surfaceMph: number | null
  level: string
  source: string
  live: boolean
  samples: number
}

export const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
export const LEVELS = ['850hPa', '700hPa', '500hPa'] as const
export const HOURS = 12

export const FALLBACK_WIND: WindAloft = { fromDeg: 270, mph: 15, shearDeg: 15, surfaceFromDeg: null, surfaceMph: null, level: 'assumed', source: 'A prevailing westerly of fifteen miles an hour with 15° of shear, assumed; the weather service could not be reached', live: false, samples: 0 }

/** Vector mean of winds given as the direction they blow from and their speed, with the circular spread of the directions. */
export function effectiveWind(samples: Array<{ fromDeg: number; mph: number }>): { fromDeg: number; mph: number; shearDeg: number } {
  let x = 0
  let y = 0
  for (const s of samples) {
    const r = (s.fromDeg * Math.PI) / 180
    x += s.mph * Math.sin(r)
    y += s.mph * Math.cos(r)
  }
  const n = Math.max(1, samples.length)
  const mph = Math.hypot(x, y) / n
  const fromDeg = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
  // Circular standard deviation of the directions, degrees: the shear the plume model widens for.
  let cx = 0
  let cy = 0
  for (const s of samples) {
    const r = (s.fromDeg * Math.PI) / 180
    cx += Math.cos(r)
    cy += Math.sin(r)
  }
  const R = Math.hypot(cx, cy) / n
  const shearDeg = samples.length > 1 ? Math.min(90, (Math.sqrt(Math.max(0, -2 * Math.log(Math.max(1e-9, R)))) * 180) / Math.PI) : 15
  return { fromDeg, mph, shearDeg: Math.max(15, shearDeg) }
}

export async function fetchWindAloft(position: LngLat, signal?: AbortSignal): Promise<WindAloft> {
  const hourly = LEVELS.flatMap((l) => [`wind_speed_${l}`, `wind_direction_${l}`]).join(',')
  const q = new URLSearchParams({ latitude: position[1].toFixed(3), longitude: position[0].toFixed(3), current: 'wind_speed_10m,wind_direction_10m', hourly, forecast_hours: String(HOURS), wind_speed_unit: 'mph' })
  try {
    const r = await fetch(`${OPEN_METEO}?${q}`, { signal })
    if (!r.ok) return FALLBACK_WIND
    const j = (await r.json()) as { current?: { wind_speed_10m?: number; wind_direction_10m?: number }; hourly?: Record<string, Array<number | null> | string[] | undefined> }
    const surfaceMph = j.current?.wind_speed_10m ?? null
    const surfaceFrom = j.current?.wind_direction_10m ?? null
    const samples: Array<{ fromDeg: number; mph: number }> = []
    for (const l of LEVELS) {
      const speeds = (j.hourly?.[`wind_speed_${l}`] ?? []) as Array<number | null>
      const dirs = (j.hourly?.[`wind_direction_${l}`] ?? []) as Array<number | null>
      for (let i = 0; i < Math.min(speeds.length, dirs.length); i += 1) {
        const s = speeds[i]
        const d = dirs[i]
        if (typeof s === 'number' && typeof d === 'number') samples.push({ fromDeg: d, mph: s })
      }
    }
    const first = (j.hourly?.time as string[] | undefined)?.[0] ?? 'now'
    if (samples.length > 0) {
      const eff = effectiveWind(samples)
      return { ...eff, mph: Math.max(2, eff.mph), surfaceFromDeg: surfaceFrom, surfaceMph, level: `850 to 500 hPa over ${HOURS} h`, source: `Open-Meteo forecast from ${first} UTC: the vector mean of the 850, 700 and 500 hPa winds over the following ${HOURS} hours, ${samples.length} samples (CC BY 4.0)`, live: true, samples: samples.length }
    }
    if (typeof surfaceMph === 'number' && typeof surfaceFrom === 'number') {
      return { fromDeg: surfaceFrom, mph: Math.max(2, surfaceMph), shearDeg: 15, surfaceFromDeg: surfaceFrom, surfaceMph, level: '10 m', source: 'Open-Meteo current surface wind (CC BY 4.0); no wind aloft returned', live: true, samples: 1 }
    }
    return FALLBACK_WIND
  } catch {
    return FALLBACK_WIND
  }
}
