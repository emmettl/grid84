import { useCallback, useState } from 'react'

/**
 * A control panel that folds away.
 *
 * Every mode in this engine puts its controls over a map, and on a phone
 * they cover the thing they are controlling. So the secondary controls —
 * the objective, the constraints, the toggles, everything that is set once
 * and then watched — fold behind one button, while whatever must stay to
 * hand does not.
 *
 * The state is remembered per panel, and the default depends on the screen:
 * a phone opens folded, a wide screen opens with everything out.
 */

const PHONE = 700

export function foldedByDefault(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= PHONE
}

/**
 * `startFolded` overrides the screen's own default. The secondary controls
 * open folded on a phone because they are set once; the readout does not,
 * because it is what the study is for, and it has a handle instead.
 */
export function useFold(key: string, startFolded?: boolean): { folded: boolean; toggle: () => void; label: string } {
  const [folded, setFolded] = useState(() => {
    try {
      const saved = localStorage.getItem(`grid84-fold:${key}`)
      if (saved === 'open') return false
      if (saved === 'folded') return true
    } catch {
      // no storage; the screen decides
    }
    return startFolded ?? foldedByDefault()
  })
  const toggle = useCallback(() => {
    setFolded((f) => {
      try {
        localStorage.setItem(`grid84-fold:${key}`, f ? 'open' : 'folded')
      } catch {
        // nothing to remember it with
      }
      return !f
    })
  }, [key])
  return { folded, toggle, label: folded ? 'Set up' : 'Hide' }
}
