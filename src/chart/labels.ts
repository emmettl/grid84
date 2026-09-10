/**
 * Label placement for the charts. Each label wants a spot beside its mark;
 * where two would overlap, the later one is moved up or down until they
 * clear, and a leader is drawn when it has moved far. Widths are estimated
 * from the text at the charts' 10 px monospace, which is good enough for
 * the collision test and needs no measurement of the DOM.
 */

export interface LabelWish {
  id: string
  /** Anchor point of the text (the x the text starts, ends or centres on). */
  x: number
  /** Baseline y wanted. */
  y: number
  text: string
  anchor: 'start' | 'middle' | 'end'
  /** Where the mark is, for the leader. */
  markX: number
  markY: number
}

export interface PlacedLabel extends LabelWish {
  /** Baseline y after placement. */
  py: number
  /** True when the label moved by more than its height and wants a leader line. */
  leader: boolean
}

const CHAR_W = 7
const LINE_H = 14

function box(l: { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end' }) {
  const w = l.text.length * CHAR_W
  const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2
  return { left, right: left + w, top: l.y - LINE_H + 2, bottom: l.y + 2 }
}

/** Place labels so none overlaps another, moving each conflicting label the shortest way up or down within the chart's height. */
export function placeLabels(wishes: LabelWish[], bounds: { top: number; bottom: number }): PlacedLabel[] {
  const placed: PlacedLabel[] = []
  const sorted = [...wishes].sort((a, b) => a.y - b.y)
  for (const w of sorted) {
    let py = w.y
    const clear = (y: number) => {
      const b = box({ ...w, y })
      if (b.top < bounds.top || b.bottom > bounds.bottom) return false
      return placed.every((p) => {
        const q = box({ ...p, y: p.py })
        return b.right <= q.left || b.left >= q.right || b.bottom <= q.top || b.top >= q.bottom
      })
    }
    if (!clear(py)) {
      let found = false
      for (let step = 1; step <= 40 && !found; step += 1) {
        for (const dir of [1, -1]) {
          const candidate = w.y + dir * step * (LINE_H / 2)
          if (clear(candidate)) {
            py = candidate
            found = true
            break
          }
        }
      }
    }
    placed.push({ ...w, py, leader: Math.abs(py - w.y) > LINE_H })
  }
  return placed
}
