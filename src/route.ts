import { parseStrikeHash } from './atlas/lookup.ts'

/**
 * The router: a hash to a route, and nothing else. It lives apart from the
 * app so that the table of pages given to search engines can be checked
 * against it without pulling in the whole engine.
 */

export type Route =
  | { kind: 'front' }
  | { kind: 'loop' }
  | { kind: 'wopr' }
  | { kind: 'winter' }
  | { kind: 'chronicle' }
  | { kind: 'posture' }
  | { kind: 'atlas'; strike?: { ref: string; adversary: string | null; delivery: string | null; loading: string | null; site: string | null } }
  | { kind: 'study'; id: 'siop62' }
  | { kind: 'study'; id: 'siop62-alert'; option: number }
  | { kind: 'study'; id: 'defcon3-73'; variant: 'posture' | 'execute' | 'giant' }
  | { kind: 'study'; id: 'cuba-62'; general: boolean }
  | { kind: 'study'; id: 'able-archer-83' }
  | { kind: 'study'; id: 'britain-80'; strath: boolean }
  | { kind: 'study'; id: 'v-force'; profile: 'high' | 'low' }
  | { kind: 'study'; id: 'seven-days' }
  | { kind: 'study'; id: 'carte-blanche' }
  | { kind: 'study'; id: 'demolition-belt' }
  | { kind: 'study'; id: 'tornado' }
  | { kind: 'study'; id: '72-minutes'; variant: 'film' | 'record' | 'claim' | 'salvo' | 'book' }
  | { kind: 'study'; id: 'window-83'; posture: 'ride' | 'launch' }
  | { kind: 'lab'; id: 'evidence' | 'population' | 'terrain' | 'fallout' | 'readiness' | 'defence' | 'accuracy' | 'guidance' | 'neutron' | 'intercept' }

export function parseRoute(hash: string): Route {
  if (hash === '' || hash === '#' || hash === '#/' || hash === '#/sources' || hash === '#/labs' || hash === '#/studies') return { kind: 'front' }
  if (hash === '#/atlas') return { kind: 'atlas' }
  const shared = parseStrikeHash(hash)
  if (shared) return { kind: 'atlas', strike: shared }
  if (hash === '#/loop') return { kind: 'loop' }
  if (hash === '#/wopr') return { kind: 'wopr' }
  if (hash === '#/winter') return { kind: 'winter' }
  if (hash === '#/chronicle') return { kind: 'chronicle' }
  if (hash === '#/chronicle/posture') return { kind: 'posture' }
  if (hash === '#/study/siop62') return { kind: 'study', id: 'siop62' }
  if (hash === '#/study/siop62-alert') return { kind: 'study', id: 'siop62-alert', option: 1 }
  const option = /^#\/study\/siop62-alert\/(\d{1,2})$/.exec(hash)
  if (option) return { kind: 'study', id: 'siop62-alert', option: Math.max(1, Math.min(14, Number(option[1]))) }
  if (hash === '#/study/defcon3-73') return { kind: 'study', id: 'defcon3-73', variant: 'posture' }
  if (hash === '#/study/defcon3-73/execute') return { kind: 'study', id: 'defcon3-73', variant: 'execute' }
  if (hash === '#/study/defcon3-73/1969') return { kind: 'study', id: 'defcon3-73', variant: 'giant' }
  if (hash === '#/study/cuba-62') return { kind: 'study', id: 'cuba-62', general: false }
  if (hash === '#/study/cuba-62/general') return { kind: 'study', id: 'cuba-62', general: true }
  if (hash === '#/study/able-archer-83') return { kind: 'study', id: 'able-archer-83' }
  if (hash === '#/study/tornado') return { kind: 'study', id: 'tornado' }
  if (hash === '#/study/demolition-belt') return { kind: 'study', id: 'demolition-belt' }
  if (hash === '#/study/carte-blanche') return { kind: 'study', id: 'carte-blanche' }
  if (hash === '#/study/seven-days') return { kind: 'study', id: 'seven-days' }
  if (hash === '#/study/v-force') return { kind: 'study', id: 'v-force', profile: 'high' }
  if (hash === '#/study/v-force/low') return { kind: 'study', id: 'v-force', profile: 'low' }
  if (hash === '#/study/britain-80') return { kind: 'study', id: 'britain-80', strath: false }
  if (hash === '#/study/britain-80/strath') return { kind: 'study', id: 'britain-80', strath: true }
  if (hash === '#/study/72-minutes') return { kind: 'study', id: '72-minutes', variant: 'film' }
  if (hash === '#/study/72-minutes/record') return { kind: 'study', id: '72-minutes', variant: 'record' }
  if (hash === '#/study/72-minutes/claim') return { kind: 'study', id: '72-minutes', variant: 'claim' }
  if (hash === '#/study/72-minutes/jacobsen') return { kind: 'study', id: '72-minutes', variant: 'book' }
  if (hash === '#/study/72-minutes/salvo') return { kind: 'study', id: '72-minutes', variant: 'salvo' }
  if (hash === '#/study/window-83') return { kind: 'study', id: 'window-83', posture: 'ride' }
  if (hash === '#/study/window-83/launch') return { kind: 'study', id: 'window-83', posture: 'launch' }
  if (hash === '#/lab/evidence') return { kind: 'lab', id: 'evidence' }
  if (hash === '#/lab/population') return { kind: 'lab', id: 'population' }
  if (hash === '#/lab/terrain') return { kind: 'lab', id: 'terrain' }
  if (hash === '#/lab/fallout') return { kind: 'lab', id: 'fallout' }
  if (hash === '#/lab/neutron') return { kind: 'lab', id: 'neutron' }
  if (hash === '#/lab/readiness') return { kind: 'lab', id: 'readiness' }
  if (hash === '#/lab/defence') return { kind: 'lab', id: 'defence' }
  if (hash === '#/lab/intercept') return { kind: 'lab', id: 'intercept' }
  if (hash === '#/lab/accuracy') return { kind: 'lab', id: 'accuracy' }
  if (hash === '#/lab/guidance') return { kind: 'lab', id: 'guidance' }
  return { kind: 'atlas' }
}
