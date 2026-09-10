#!/usr/bin/env python3
"""Normalise the studies' orders of battle into the posture atlas's epochs.

Each study built its own order of battle by script, in its own shape. The
posture atlas scrubs a date across them, so this writes one file with the
same shape for every epoch: sites with a side, a kind, a position and the
weapons they carried, and the rules each study used to get the weapons from
the aircraft or launcher counts. Nothing is re-sourced here; every site
keeps the evidence tier and the source its study gave it, and the epoch
says whether it is a strategic or a theatre picture.

Usage: python3 scripts/build-posture-epochs.py --out data/chronicle/posture.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(rel: str):
    return json.loads((ROOT / rel).read_text())


def site(s, side, kind, weapons, vehicles=None, unit=None):
    return {
        'id': s['id'], 'name': s['name'], 'side': side, 'kind': kind, 'lon': s['lon'], 'lat': s['lat'],
        'weapons': int(round(weapons)), 'vehicles': vehicles, 'unit': unit,
        'evidence': s.get('evidence', 'inferred'), 'positionEvidence': s.get('positionEvidence', 'inferred'), 'source': s.get('source', ''), 'note': s.get('note', ''),
    }


def epoch_1961():
    d = load('data/siop62/order-of-battle-1961.json')
    r = d['rules']
    sites = []
    for l in d['launchers']:
        k = l['kind']
        if k in ('b52', 'b52h'):
            sites.append(site(l, 'us', 'bomber', l['aircraft'] * r['weaponsPerB52'], l['aircraft'], 'aircraft'))
        elif k in ('b47', 'b47r'):
            sites.append(site(l, 'us', 'bomber', l['aircraft'] * r['weaponsPerB47'], l['aircraft'], 'aircraft'))
        elif k in ('icbm', 'irbm', 'slbm', 'cruise', 'tactical'):
            sites.append(site(l, 'us', k, l['weapons']))
    s = load('data/siop62/soviet-response-1961.json')
    doc, inf = s['documented'], s['inferred']
    bombers = doc['longRangeBombersAndTankers']['value']
    per = doc['weaponsPerBomber']['value']
    bases = inf['bases']
    each = bombers / len(bases)
    for b in bases:
        sites.append({**site(b, 'su', 'bomber', each * per, round(each), 'aircraft'), 'note': f'{bombers} Long Range Aviation bombers and tankers (Sagan) spread evenly over six inferred fields; {per} weapons each'})
    icbm = doc['icbms']
    sites.append({'id': 'plesetsk-r7', 'name': 'Plesetsk · R-7 launch sites', 'side': 'su', 'kind': 'icbm', 'lon': 40.5, 'lat': 62.9, 'weapons': int(icbm['low']), 'vehicles': int(icbm['low']), 'unit': 'launchers', 'evidence': 'inferred', 'positionEvidence': 'reconstructed', 'source': icbm['source'], 'note': f"Four R-7 launchers at Plesetsk stood for the Soviet ICBM force of 1961; the documented estimate is {icbm['low']} to {icbm['high']}"})
    return {'year': 1961, 'label': 'December 1961', 'scope': 'strategic', 'study': '#/study/siop62-alert', 'studyName': 'SIOP//62 alert force', 'sides': {'us': 'United States', 'su': 'Soviet Union'}, 'sites': sites, 'rules': r, 'source': d.get('date', ''), 'caveat': 'The Soviet side is the intercontinental force only, four ICBMs and the heavy bombers as Sagan counts them; the medium bombers and the R-12s facing Europe, most of the stockpile, are not drawn'}


def epoch_1962():
    d = load('data/cuba62/order-of-battle-1962.json')
    sites = []
    for s in d['sites']:
        w = s.get('warheads', 0) or 0
        kind = {'irbm': 'irbm', 'irbm-empty': 'irbm', 'luna': 'tactical', 'cruise': 'cruise', 'bomber': 'bomber', 'airbase': 'bomber', 'carrier': 'carrier', 'base': 'base', 'beach': 'beach', 'capital': 'command'}.get(s['kind'], s['kind'])
        sites.append(site(s, s['side'], kind, w, s.get('launchers') or s.get('aircraft'), 'launchers' if s.get('launchers') else ('aircraft' if s.get('aircraft') else None)))
    return {'year': 1962, 'label': 'October 1962 · Cuba', 'scope': 'theatre', 'study': '#/study/cuba-62', 'studyName': 'Cuba 62', 'sides': {'us': 'United States', 'su': 'Soviet forces in Cuba'}, 'sites': sites, 'rules': {}, 'source': d.get('date', '')}


def epoch_1973():
    d = load('data/defcon3/order-of-battle-1973.json')
    sites = []
    for l in d['launchers']:
        k = l['kind']
        if k == 'bomber':
            sites.append(site(l, l['side'], 'bomber', l['aircraft'] * l['weaponsPerAircraft'], l['aircraft'], 'aircraft'))
        elif k in ('icbm', 'slbm', 'slbm-port'):
            sites.append(site(l, l['side'], k, l['weapons'], l.get('missiles'), 'missiles'))
    return {'year': 1973, 'label': 'October 1973', 'scope': 'strategic', 'study': '#/study/defcon3-73', 'studyName': 'DEFCON 3', 'sides': {'us': 'United States', 'su': 'Soviet Union'}, 'sites': sites, 'rules': d['rules'], 'source': d.get('date', '')}


def epoch_1983():
    d = load('data/able-archer/order-of-battle-1983.json')
    r = d['rules']
    sites = []
    for s in d['sites']:
        side = 'us' if s['side'] == 'nato' else 'su'
        k = s['kind']
        if k == 'air':
            w = s.get('generatedWeapons') or s.get('alertWeapons') or 0
            sites.append(site(s, side, 'bomber', w, s.get('count'), 'aircraft'))
        elif k == 'ss20':
            n = s.get('launchers') or s.get('count') or 0
            sites.append(site(s, side, 'irbm', n * r['ss20']['warheads'], n, 'launchers'))
        elif k in ('pershing', 'missile', 'glcm'):
            n = s.get('launchers') or s.get('count') or 0
            w = s.get('weapons') or s.get('generatedWeapons') or n
            sites.append(site(s, side, 'irbm' if k == 'pershing' else k, w, n, 'launchers'))
        elif k == 'hq':
            sites.append(site(s, side, 'command', 0))
    return {'year': 1983, 'label': 'November 1983 · Europe', 'scope': 'theatre', 'study': '#/study/able-archer-83', 'studyName': 'Able Archer 83', 'sides': {'us': 'NATO', 'su': 'Warsaw Pact'}, 'sites': sites, 'rules': r, 'source': d.get('date', '')}


def epoch_1991():
    d = load('data/chronicle/order-of-battle-1991.json')
    sites = []
    for s in d['sites']:
        k = s['kind']
        if k == 'bomber':
            sites.append(site(s, s['side'], 'bomber', s['aircraft'] * s['weaponsPerAircraft'], s['aircraft'], 'aircraft'))
        elif k in ('icbm', 'slbm', 'slbm-port'):
            sites.append(site(s, s['side'], k, s['weapons'], s.get('missiles'), 'missiles'))
    return {'year': 1991, 'label': 'End of 1991', 'scope': 'strategic', 'study': '', 'studyName': '', 'sides': {'us': 'United States', 'su': 'Soviet Union'}, 'sites': sites, 'rules': d['rules'], 'source': d.get('note', '')}


def epoch_2024():
    d = load('data/72-minutes/order-of-battle-2024.json')
    sites = []
    for s in d['sites']:
        k = s['kind']
        side = {'us': 'us', 'ru': 'su', 'nk': 'nk'}[s['side']]
        if k == 'bomber':
            sites.append(site(s, side, 'bomber', s['aircraft'] * s['weaponsPerAircraft'], s['aircraft'], 'aircraft'))
        elif k in ('icbm', 'slbm', 'slbm-port'):
            sites.append(site(s, side, k, s['weapons'], s.get('missiles'), 'missiles'))
        elif k in ('interceptor', 'sensor', 'command'):
            sites.append(site(s, side, k, 0, s.get('interceptors'), 'interceptors' if k == 'interceptor' else None))
    return {'year': 2024, 'label': '2024', 'scope': 'strategic', 'study': '#/study/72-minutes', 'studyName': 'Seventy-two minutes', 'sides': {'us': 'United States', 'su': 'Russia', 'nk': 'North Korea'}, 'sites': sites, 'rules': d['rules'], 'source': d.get('date', '')}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    epochs = [epoch_1961(), epoch_1962(), epoch_1973(), epoch_1983(), epoch_1991(), epoch_2024()]
    for e in epochs:
        totals = {}
        for s in e['sites']:
            t = totals.setdefault(s['side'], {'sites': 0, 'weapons': 0, 'byKind': {}})
            t['sites'] += 1
            t['weapons'] += s['weapons']
            t['byKind'][s['kind']] = t['byKind'].get(s['kind'], 0) + s['weapons']
        e['totals'] = totals
        print(e['year'], {k: (v['sites'], v['weapons']) for k, v in totals.items()})
    out = {'note': 'Each epoch is the order of battle its study built, normalised: a site carries the weapons its study counted, by that study\'s rules, and keeps the tier and source the study gave it. Theatre epochs (Cuba, Europe) are not comparable with the strategic ones and say so.', 'epochs': epochs}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False) + '\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
