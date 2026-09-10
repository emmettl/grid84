import type { LngLat } from './geodesy.ts'

/**
 * Whether a point lies inside a ring, by ray casting. The ring's longitudes
 * may run past 180 so that a shape straddling the antimeridian stays in one
 * piece; the point is tested at its own longitude and at that plus 360.
 */
export function pointInRing(point: LngLat, ring: Array<[number, number]>): boolean {
  const test = (x: number, y: number): boolean => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  return test(point[0], point[1]) || test(point[0] + 360, point[1])
}
