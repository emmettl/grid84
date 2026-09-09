import { initialBearing, type LngLat } from '../geo/geodesy.ts'
import type { AtlasTarget } from '../atlas/target.ts'

/** Zoom held at the peak of every flight: low orbit, whole hemisphere visible. */
export const ORBITAL_ZOOM = 1.6
/** Seven seconds to descend from orbit, sweep the terrain and acquire the target. */
export const DESCENT_DURATION_MS = 7_000
/** Terrain is meaningful below this height; above it the globe carries the drama. */
export const TERRAIN_MIN_ZOOM = 9

export interface DescentPlan {
  center: LngLat
  zoom: number
  pitch: number
  bearing: number
  duration: number
  /** Zoom at the peak of the flight path; forces every descent to start from orbit. */
  minZoom: number
}

/** How close to get. Cities are seen whole; a shop is seen among its neighbours' roofs. */
export function targetZoom(target: Pick<AtlasTarget, 'osmKey' | 'osmValue'>): number {
  const { osmKey, osmValue } = target
  if (osmKey === 'place') {
    if (osmValue === 'country') return 4.5
    if (['state', 'region', 'province', 'county', 'district'].includes(osmValue)) return 7
    if (osmValue === 'city') return 11
    if (osmValue === 'town') return 12.5
    if (['village', 'suburb', 'borough', 'quarter'].includes(osmValue)) return 13.5
    if (['hamlet', 'neighbourhood', 'locality'].includes(osmValue)) return 14.5
    if (osmValue === 'house') return 17
    return 13
  }
  if (osmKey === 'boundary') return 8
  if (osmKey === 'natural' && ['peak', 'volcano', 'glacier'].includes(osmValue)) return 13
  if (osmKey === 'natural' || osmKey === 'waterway' || osmKey === 'landuse') return 12.5
  if (osmKey === 'aeroway') return 13.5
  if (osmKey === 'highway') return 15
  return 16.5
}

export function planDescent(
  from: LngLat,
  target: AtlasTarget,
  options: { durationMs?: number } = {},
): DescentPlan {
  const zoom = targetZoom(target)
  const close = zoom >= 14
  return {
    center: target.position,
    zoom,
    pitch: close ? 60 : zoom >= 11 ? 45 : 0,
    bearing: close ? initialBearing(from, target.position) : 0,
    duration: options.durationMs ?? DESCENT_DURATION_MS,
    minZoom: ORBITAL_ZOOM,
  }
}
