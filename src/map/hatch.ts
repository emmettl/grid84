/**
 * A diagonal hatch for fill patterns: two colours in alternating stripes,
 * drawn once on a canvas and handed to the map as an image. The target's
 * bounds use black and orange, the warning livery, so the outline is not
 * mistaken for another neutral line on the map.
 */
export const ALARM_HATCH = 'hatch-alarm'

export function hatchImage(size = 16, a = '#ff8a1f', b = '#0a0602', stripe = 4): { width: number; height: number; data: Uint8ClampedArray } | null {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = b
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = a
  ctx.lineWidth = stripe
  ctx.lineCap = 'butt'
  // Diagonal stripes that tile: three lines cover the corners as well as the middle.
  for (const off of [-size, 0, size]) {
    ctx.beginPath()
    ctx.moveTo(off, size)
    ctx.lineTo(off + size, 0)
    ctx.stroke()
  }
  return { width: size, height: size, data: new Uint8ClampedArray(ctx.getImageData(0, 0, size, size).data.buffer) }
}

/** Register the alarm hatch on a map once; safe to call before the style has loaded only inside its load handler. */
export function ensureAlarmHatch(map: { hasImage(id: string): boolean; addImage(id: string, image: { width: number; height: number; data: Uint8ClampedArray }, options?: { pixelRatio?: number }): unknown }): void {
  if (map.hasImage(ALARM_HATCH)) return
  const img = hatchImage()
  if (img) map.addImage(ALARM_HATCH, img, { pixelRatio: 2 })
}
