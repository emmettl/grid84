#!/usr/bin/env python3
"""Carte Blanche, June 1955: the airfields, and what the exercise concluded.

NATO's air exercise of 20 to 28 June 1955 flew some three thousand sorties
and simulated the use of 335 nuclear weapons, most of them on German soil,
against airfields and the routes an attack would come down. Its own
casualty estimate, 1.7 million dead and 3.5 million injured, was for West
Germany alone and counted only the immediate effects; the figures leaked
to the German press that autumn and did more damage to the doctrine of
massive retaliation in Germany than any argument against it.

The desired ground zeros are not published. What is published is the
number of weapons, the categories and the casualty estimate, so the
airfields here are the operating bases of 1955 as the open literature has
them, and the rest of the weapons fall on the most populous cells of the
1951 grid by a stated rule.

Usage: python3 scripts/build-carte-blanche-1955.py --out data/carte-blanche/exercise-1955.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SOURCE = ('Exercise Carte Blanche, Allied Air Forces Central Europe, 20-28 June 1955; the weapon count and the casualty '
          'estimate as reported at the time and in the standard accounts of the German nuclear debate. The exercise\'s own '
          'target list is not published')

DOCUMENTED = {
    'weapons': 335,
    'weaponsNote': 'The number of nuclear weapons the exercise simulated, most of them on German territory',
    'sorties': 3_000,
    'dead': 1_700_000,
    'injured': 3_500_000,
    'casualtyNote': ('West German dead and injured from the immediate effects alone, in the exercise\'s own estimate. '
                     'Fallout, fire and the destruction of everything that treats casualties were not counted, and nor '
                     'was East Germany'),
    'dates': '20 to 28 June 1955',
}

# NATO and allied airfields in West Germany and the Low Countries, 1955. lon, lat, name, side.
WEST_AIRFIELDS = [
    (8.32, 49.97, 'Wiesbaden', 'nato'), (7.60, 49.44, 'Ramstein', 'nato'), (6.57, 49.94, 'Bitburg', 'nato'),
    (6.69, 49.97, 'Spangdahlem', 'nato'), (7.27, 49.95, 'Hahn', 'nato'), (7.87, 49.50, 'Sembach', 'nato'),
    (11.27, 48.21, 'Fürstenfeldbruck', 'nato'), (10.91, 48.07, 'Landsberg', 'nato'), (11.63, 48.08, 'Neubiberg', 'nato'),
    (11.95, 48.32, 'Erding', 'nato'), (9.43, 52.46, 'Wunstorf', 'nato'), (10.02, 52.59, 'Celle', 'nato'),
    (8.31, 51.92, 'Gütersloh', 'nato'), (6.14, 51.12, 'Wildenrath', 'nato'), (6.13, 51.20, 'Brüggen', 'nato'),
    (6.14, 51.75, 'Laarbruch', 'nato'), (6.04, 50.96, 'Geilenkirchen', 'nato'), (7.89, 53.53, 'Jever', 'nato'),
    (8.24, 53.20, 'Oldenburg', 'nato'), (8.23, 52.89, 'Ahlhorn', 'nato'), (9.08, 52.28, 'Bückeburg', 'nato'),
    (9.68, 50.56, 'Fulda area forward strips', 'nato'), (8.57, 50.05, 'Frankfurt Rhein-Main', 'nato'),
    (10.94, 49.50, 'Herzogenaurach', 'nato'), (12.11, 49.05, 'Regensburg area', 'nato'),
]

# Soviet and East German airfields, 1955.
EAST_AIRFIELDS = [
    (13.74, 52.63, 'Werneuchen', 'pact'), (13.68, 52.83, 'Finow', 'pact'), (13.37, 52.15, 'Sperenberg', 'pact'),
    (14.36, 51.89, 'Cottbus', 'pact'), (13.55, 51.29, 'Grossenhain', 'pact'), (12.06, 51.36, 'Merseburg', 'pact'),
    (12.15, 51.97, 'Zerbst', 'pact'), (13.16, 51.95, 'Altes Lager', 'pact'), (12.44, 53.16, 'Wittstock', 'pact'),
    (11.78, 53.43, 'Parchim', 'pact'), (12.28, 53.92, 'Laage', 'pact'), (13.77, 54.16, 'Peenemünde', 'pact'),
    (11.44, 52.10, 'Stendal', 'pact'), (10.72, 52.14, 'Oschersleben', 'pact'), (14.53, 52.34, 'Frankfurt an der Oder', 'pact'),
]

# The yields. The exercise's own are not published; the tactical stockpile of 1955 ran from a few kilotons to a few tens.
YIELD_AIRFIELD_KT = 20
YIELD_AREA_KT = 40


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    fields = [{'id': f'af-{i}', 'name': n, 'lon': lo, 'lat': la, 'side': s}
              for i, (lo, la, n, s) in enumerate([*WEST_AIRFIELDS, *EAST_AIRFIELDS])]
    out = {
        'year': 1955,
        'source': SOURCE,
        'documented': DOCUMENTED,
        'yields': {'airfieldKt': YIELD_AIRFIELD_KT, 'areaKt': YIELD_AREA_KT,
                   'note': 'Inferred. The exercise\'s yields are not published; the tactical stockpile of 1955 ran from a few kilotons to a few tens'},
        'rule': (f'{DOCUMENTED["weapons"]} weapons: two on each of the {len(fields)} airfields, and the rest on the most '
                 f'populous cells of the 1951 grid inside Germany, largest first. The exercise\'s own ground zeros are not published'),
        'airfields': fields,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(f'{len(fields)} airfields ({len(WEST_AIRFIELDS)} west, {len(EAST_AIRFIELDS)} east), {DOCUMENTED["weapons"]} weapons')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
