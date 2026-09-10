import type { LngLat } from '../geo/geodesy.ts'
import { haversineMetres } from '../geo/geodesy.ts'
import { FORCES, POWERS, type Power } from './forces.ts'

/**
 * Which nuclear power might strike a place. A table of declared or evident
 * adversaries by country, then a fallback to the nearest arsenal that can
 * reach it, which the console says is a fallback. This is a heuristic and
 * is stated as one; the reader can override it.
 */
export interface Adversary {
  power: Power
  reason: string
  /** 'doctrine' when a stated adversary relation names the country; 'proximity' for the fallback. */
  basis: 'doctrine' | 'proximity'
}

const NATO_AND_EU = new Set(['AL', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'TR', 'GB', 'CH', 'LI', 'AD', 'MC', 'SM', 'VA', 'XK', 'BA', 'RS', 'UA', 'MD', 'GE', 'GL', 'FO', 'GI', 'IM', 'JE', 'GG', 'AX', 'SJ'])
const RUSSIA_BLOC = new Set(['RU', 'BY'])
const KOREA_JAPAN = new Set(['JP', 'KR'])
const ISRAEL_ADVERSARIES = new Set(['IR', 'SY', 'LB', 'IQ', 'YE'])

export function adversaryFor(countryCode: string, position: LngLat): Adversary {
  const cc = countryCode.toUpperCase()
  if (cc === 'US' || cc === 'CA' || cc === 'PR' || cc === 'VI' || cc === 'BM') return { power: 'ru', reason: 'THE ONLY ARSENAL SIZED AND POSTURED AGAINST NORTH AMERICA; CHINA AND NORTH KOREA CAN REACH IT WITH LESS', basis: 'doctrine' }
  if (cc === 'GU' || cc === 'MP') return { power: 'cn', reason: 'THE DF-26 IS BUILT AND NAMED FOR THIS ISLAND', basis: 'doctrine' }
  if (cc === 'HI' || cc === 'AS') return { power: 'cn', reason: 'THE PACIFIC ADVERSARY', basis: 'doctrine' }
  if (NATO_AND_EU.has(cc)) return { power: 'ru', reason: 'NATO AND ITS NEIGHBOURS ARE THE TARGET SET OF THE RUSSIAN STRATEGIC AND THEATRE FORCES', basis: 'doctrine' }
  if (RUSSIA_BLOC.has(cc)) return { power: 'us', reason: 'THE AMERICAN FORCE IS POSTURED AGAINST RUSSIA; BRITAIN AND FRANCE HOLD THE SAME TARGET SET WITH LESS', basis: 'doctrine' }
  if (cc === 'CN' || cc === 'HK' || cc === 'MO') return { power: 'us', reason: 'THE AMERICAN FORCE IS POSTURED AGAINST CHINA; INDIA CAN REACH THE SOUTH-WEST', basis: 'doctrine' }
  if (cc === 'TW') return { power: 'cn', reason: 'THE DECLARED OBJECT OF CHINESE FORCE', basis: 'doctrine' }
  if (KOREA_JAPAN.has(cc)) return { power: 'nk', reason: 'NORTH KOREA NAMES BOTH IN ITS DOCTRINE AND HOLDS THEM UNDER SHORT- AND MEDIUM-RANGE MISSILES; RUSSIA AND CHINA CAN REACH THEM TOO', basis: 'doctrine' }
  if (cc === 'KP') return { power: 'us', reason: 'THE AMERICAN EXTENDED DETERRENT OVER KOREA AND JAPAN', basis: 'doctrine' }
  if (cc === 'IN' || cc === 'BT' || cc === 'NP' || cc === 'LK' || cc === 'BD') {
    // East of the Siliguri corridor the border is with China; west of it, with Pakistan.
    if (position[0] > 88) return { power: 'cn', reason: 'THE NORTH-EAST FACES THE CHINESE THEATRE FORCE ACROSS THE DISPUTED BORDER', basis: 'doctrine' }
    return { power: 'pk', reason: 'THE PAKISTANI ARSENAL EXISTS FOR THIS TARGET SET', basis: 'doctrine' }
  }
  if (cc === 'PK' || cc === 'AF') return { power: 'in', reason: 'THE INDIAN ARSENAL EXISTS FOR THIS TARGET SET', basis: 'doctrine' }
  if (ISRAEL_ADVERSARIES.has(cc)) return { power: 'il', reason: 'THE ONLY NUCLEAR POWER WITH A DECLARED ENEMY HERE; ITS ARSENAL IS UNDECLARED', basis: 'doctrine' }
  if (cc === 'AU' || cc === 'NZ' || cc === 'PH' || cc === 'VN' || cc === 'SG' || cc === 'MY' || cc === 'ID' || cc === 'PG') return { power: 'cn', reason: 'THE PACIFIC STRATEGIC COMPETITOR; NO DOCTRINE NAMES THIS PLACE', basis: 'doctrine' }
  if (cc === 'IL' || cc === 'PS') return nearest(position, 'NO NUCLEAR POWER NAMES ISRAEL AS AN ENEMY; THE NEAREST ARSENAL THAT REACHES IT IS TAKEN')
  return nearest(position, 'NO DOCTRINE ON RECORD NAMES THIS PLACE; THE NEAREST ARSENAL THAT REACHES IT IS TAKEN')
}

function nearest(position: LngLat, reason: string): Adversary {
  let best: { power: Power; d: number } | null = null
  for (const s of FORCES) {
    const d = haversineMetres(s.position, position)
    if (d > s.rangeKm * 1_000) continue
    if (!best || d < best.d) best = { power: s.side, d }
  }
  return { power: best?.power ?? 'ru', reason: `${reason} · ${POWERS[best?.power ?? 'ru'].name.toUpperCase()}`, basis: 'proximity' }
}
