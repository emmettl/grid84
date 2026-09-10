#!/usr/bin/env python3
"""RAF Germany's Tornado force, 1985, and the targets it trained against.

The Tornado GR1 replaced the Vulcan's role in Europe and inherited the
V-force's answer to air defence: fly under it. Four squadrons at Bruggen
and three at Laarbruch stood at readiness with the WE.177, at two hundred
feet on terrain-following radar, against airfields and river crossings in
the Warsaw Pact's rear. After 1991 the same weapon on the same aircraft
was called Britain's sub-strategic deterrent until it was withdrawn in
1998.

The strike plans are not published. The squadrons and their bases are;
the targets here are the Warsaw Pact airfields and the Oder and Elbe
crossings that any interdiction plan had to include, chosen from the map
and marked inferred.

Usage: python3 scripts/build-tornado-1985.py --out data/tornado/raf-germany-1985.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SOURCE = ('RAF Germany order of battle, 1985: Tornado GR1 squadrons at Bruggen and Laarbruch; the WE.177 as the strike '
          'weapon. The strike plans and the target list are not published')
WEAPON = ('WE.177: a laydown weapon in three marks, the 450 kt B and the 200 kt C being the ones the Tornado carried. '
          '200 kt is taken here and the mark at any station is not known')

BASES = [
    ('RAF Bruggen', 6.1319, 51.1997, 'IX, 14, 17 and 31 Squadrons', 48),
    ('RAF Laarbruch', 6.1425, 51.7533, '15, 16 and 20 Squadrons', 36),
]

# Warsaw Pact airfields and river crossings within reach at low level. name, lon, lat, kind.
TARGETS = [
    ('Werneuchen airfield', 13.74, 52.63, 'airfield'),
    ('Finow airfield', 13.68, 52.83, 'airfield'),
    ('Sperenberg airfield', 13.37, 52.15, 'airfield'),
    ('Altes Lager airfield', 13.16, 51.95, 'airfield'),
    ('Zerbst airfield', 12.15, 51.97, 'airfield'),
    ('Merseburg airfield', 12.06, 51.36, 'airfield'),
    ('Wittstock airfield', 12.44, 53.16, 'airfield'),
    ('Parchim airfield', 11.78, 53.43, 'airfield'),
    ('Cottbus airfield', 14.36, 51.89, 'airfield'),
    ('Grossenhain airfield', 13.55, 51.29, 'airfield'),
    ('Oder crossing at Frankfurt', 14.55, 52.34, 'crossing'),
    ('Oder crossing at Kustrin', 14.66, 52.59, 'crossing'),
    ('Elbe crossing at Magdeburg', 11.64, 52.13, 'crossing'),
    ('Elbe crossing at Wittenberge', 11.75, 52.99, 'crossing'),
]

PROFILE = {
    'cruiseAltitudeMetres': 9_000,
    'runInMetres': 60,
    'descendAtMetres': 250_000,
    'speedMs': 250,
    'note': ('Transit at height while over friendly ground, then down to two hundred feet on terrain-following radar for '
             'the run in: the V-force profile of 1963, flown by an aircraft designed for it from the start'),
}

ATTRITION = {
    'reliability': 0.9,
    'penetration': 0.55,
    'note': ('RAF Germany\'s own loss estimates are not published. Contemporary studies of interdiction against the Warsaw '
             'Pact\'s air defences put attrition at tens of per cent a sortie; nine aircraft in ten serviceable and away, '
             'and a little over half through, are inferred here'),
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    out = {
        'year': 1985,
        'source': SOURCE,
        'weapon': WEAPON,
        'yieldKt': 200,
        'profile': PROFILE,
        'attrition': ATTRITION,
        'rule': 'Two aircraft to each target, the nearest station first; the real plans are not published',
        'bases': [{'id': n.lower().replace('raf ', ''), 'name': n, 'lon': lo, 'lat': la, 'squadrons': sq, 'aircraft': ac}
                  for n, lo, la, sq, ac in BASES],
        'targets': [{'id': f't-{i}', 'name': n, 'lon': lo, 'lat': la, 'kind': k} for i, (n, lo, la, k) in enumerate(TARGETS)],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(f'{len(BASES)} bases, {sum(b[4] for b in BASES)} aircraft, {len(TARGETS)} targets')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
