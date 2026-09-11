import type { ReactNode } from 'react'
import { useFold } from './collapse.ts'

/**
 * The two halves of a control-heavy page, on a screen that has room for one.
 *
 * Every lab is the same shape: a header, one panel of controls, and a stack of
 * reading panels. On a wide screen the grid places each panel itself and these
 * wrappers generate no box at all, so nothing about that layout changes. On a
 * phone the controls fold behind one handle and the readings become a sheet
 * along the bottom, and the middle of the screen — which on three of the labs
 * is a map, and on the rest is the chart — is left alone.
 *
 * The labs are control-heavy by design and a phone is not going to be a good
 * place to drive one. This is the best-effort version: everything reachable,
 * nothing covering the thing it controls, and the state remembered per lab.
 */

/**
 * What the view is set to before it runs. A phone opens this folded, because
 * a lab is set once and then read.
 */
export function ControlSheet({ id, children }: { id: string; children: ReactNode }): ReactNode {
  const fold = useFold(`${id}-controls`)
  return (
    <div className={`study-controls${fold.folded ? ' is-folded' : ''}`}>
      <button type="button" className="study-controls-handle" aria-expanded={!fold.folded} onClick={fold.toggle}>
        {fold.folded ? 'Set it up' : 'Hide the controls'}
      </button>
      {children}
    </div>
  )
}

/**
 * What the view found. A phone opens this out, because it is what the lab is
 * for; the handle is there so the map underneath can be had back.
 */
export function ReadingSheet({ id, children }: { id: string; children: ReactNode }): ReactNode {
  const sheet = useFold(`${id}-sheet`, false)
  return (
    <div className={`study-sheet${sheet.folded ? ' is-folded' : ''}`}>
      <button type="button" className="study-sheet-handle" aria-expanded={!sheet.folded} onClick={sheet.toggle}>
        {sheet.folded ? 'Show the readout' : 'Hide the readout'}
      </button>
      {children}
    </div>
  )
}
