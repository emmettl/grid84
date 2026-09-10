import type { LngLat } from '../geo/geodesy.ts'

/**
 * The wind aloft at the target, for the plume: Open-Meteo's forecast at
 * 850 hPa, about 1,500 m, the level that carries the stem's fallout on the
 * plume model's scale, with the surface wind beside it. Open-Meteo is free
 * and keyless (CC BY 4.0). If it cannot be reached, a prevailing westerly
 * of fifteen miles an hour is assumed and said so.
 */
export interface WindAloft {
  fromDeg: number
  mph: number
  surfaceFromDeg: number | null
  surfaceMph: number | null
  level: string
  source: string
  live: boolean
}

export const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

export const FALLBACK_WIND: WindAloft = { fromDeg: 270, mph: 15, surfaceFromDeg: null, surfaceMph: null, level: 'assumed', source: 'A prevailing westerly of fifteen miles an hour, assumed; the weather service could not be reached', live: false }

export async function fetchWindAloft(position: LngLat, signal?: AbortSignal): Promise<WindAloft> {
  const q = new URLSearchParams({ latitude: position[1].toFixed(3), longitude: position[0].toFixed(3), current: 'wind_speed_10m,wind_direction_10m', hourly: 'wind_speed_850hPa,wind_direction_850hPa', forecast_hours: '1', wind_speed_unit: 'mph' })
  try {
    const r = await fetch(`${OPEN_METEO}?${q}`, { signal })
    if (!r.ok) return FALLBACK_WIND
    const j = (await r.json()) as { current?: { wind_speed_10m?: number; wind_direction_10m?: number }; hourly?: { wind_speed_850hPa?: number[]; wind_direction_850hPa?: number[]; time?: string[] } }
    const aloftMph = j.hourly?.wind_speed_850hPa?.[0]
    const aloftFrom = j.hourly?.wind_direction_850hPa?.[0]
    const surfaceMph = j.current?.wind_speed_10m ?? null
    const surfaceFrom = j.current?.wind_direction_10m ?? null
    if (typeof aloftMph === 'number' && typeof aloftFrom === 'number') {
      return { fromDeg: aloftFrom, mph: Math.max(2, aloftMph), surfaceFromDeg: surfaceFrom, surfaceMph, level: '850 hPa', source: `Open-Meteo forecast at ${j.hourly?.time?.[0] ?? 'now'} UTC, 850 hPa (CC BY 4.0)`, live: true }
    }
    if (typeof surfaceMph === 'number' && typeof surfaceFrom === 'number') {
      return { fromDeg: surfaceFrom, mph: Math.max(2, surfaceMph), surfaceFromDeg: surfaceFrom, surfaceMph, level: '10 m', source: 'Open-Meteo current surface wind (CC BY 4.0); no wind aloft returned', live: true }
    }
    return FALLBACK_WIND
  } catch {
    return FALLBACK_WIND
  }
}
