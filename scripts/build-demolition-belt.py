#!/usr/bin/env python3
"""The atomic demolition belt: weapons emplaced on the ground being defended.

Atomic demolition munitions were nuclear weapons buried or placed by
engineers to crater a defile, drop a bridge or block a pass, on the
defender's own territory, ahead of an advance. The Americans deployed
them in West Germany, Italy, Greece, Turkey and South Korea; a few
hundred were in Europe through the 1970s and 1980s and the last were
withdrawn by 1989. Britain had tried the same idea earlier and stranger:
Blue Peacock, a ten-kiloton mine to be buried on the North German Plain,
cancelled in 1958, whose file includes a proposal to keep the electronics
warm through a German winter with live chickens sealed inside the casing.

The emplacement sites are not published. What is published is the
doctrine, the systems and the terrain: the barrier plans followed the
defiles an armoured advance had to use. The sites here are those defiles,
chosen by hand from the map and marked as inferred.

Usage: python3 scripts/build-demolition-belt.py --out data/demolition/belt-1980.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SOURCE = ('The atomic demolition munitions of NATO: the W54 SADM (0.01 to 1 kt) and the W45 MADM (1 to 15 kt), deployed in '
          'Europe from the early 1960s and withdrawn by 1989; the barrier plans themselves are not published')
BLUE_PEACOCK = ('Blue Peacock, the British ten-kiloton buried mine for the North German Plain, two prototypes built and the '
                'project cancelled in July 1958; the file was released to the National Archives in 2004 and the chicken '
                'heating proposal in it was confirmed by the Atomic Weapons Establishment to be genuine')

# name, lon, lat, kind, yield kt, what it destroys
SITES = [
    ('Fulda Gap · the Kinzig defile', 9.6800, 50.5500, 'MADM', 10, 'The corridor from Thuringia to Frankfurt, the shortest road to the Rhine'),
    ('Fulda Gap · Rasdorf ridge', 9.8900, 50.7200, 'MADM', 10, 'The northern shoulder of the gap'),
    ('Fulda Gap · Bad Hersfeld road junction', 9.7100, 50.8700, 'SADM', 1, 'The junction the advance has to pass'),
    ('Hof Corridor · Bavarian gate', 11.9200, 50.3100, 'MADM', 10, 'The southern route into Bavaria'),
    ('Hof Corridor · Naila defile', 11.7000, 50.3300, 'SADM', 1, ''),
    ('North German Plain · Weser crossing at Hameln', 9.3600, 52.1000, 'MADM', 10, 'The plain is where armour moves fastest and the rivers are the only obstacles'),
    ('North German Plain · Weser crossing at Nienburg', 9.2100, 52.6400, 'MADM', 10, ''),
    ('North German Plain · Aller crossing at Celle', 10.0800, 52.6200, 'SADM', 1, ''),
    ('North German Plain · Elbe-Seiten canal', 10.6000, 52.9000, 'SADM', 1, 'A canal makes a tank ditch if the banks are dropped'),
    ('Harz · Bad Harzburg pass', 10.5600, 51.8800, 'SADM', 1, ''),
    ('Thuringian forest · Meiningen approach', 10.4200, 50.5700, 'SADM', 1, ''),
    ('Danube · Regensburg crossing', 12.1000, 49.0200, 'MADM', 10, 'The southern axis, and the road to Austria'),
    ('Gorizia gap · Isonzo crossing', 13.6200, 45.9400, 'MADM', 10, 'The Italian corner: the route from Slovenia onto the Friulian plain'),
    ('Gorizia gap · Tarvisio pass', 13.5800, 46.5000, 'SADM', 1, 'The Alpine pass into Carinthia'),
    ('Ljubljana gap · Postojna defile', 14.2000, 45.7700, 'MADM', 10, ''),
]

WIND = {'fromDeg': 250, 'mph': 16, 'note': 'A south-westerly of sixteen miles an hour, the prevailing wind over Germany, assumed. The plumes therefore run north-east, over the country being defended and then over the country being invaded'}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    sites = [{'id': f'adm-{i}', 'name': n, 'lon': lo, 'lat': la, 'system': k, 'yieldKt': y, 'purpose': p}
             for i, (n, lo, la, k, y, p) in enumerate(SITES)]
    out = {
        'year': 1980,
        'source': SOURCE,
        'bluePeacock': BLUE_PEACOCK,
        'note': ('Every weapon here stands on NATO ground. The barrier had to be emplaced before the war, by engineers who '
                 'expected to be overrun, and fired on a political release that would arrive, if it arrived, while the ground '
                 'above it was being fought over.'),
        'rule': 'The emplacement sites are not published; these are the defiles an armoured advance has to use, chosen by hand from the map',
        'wind': WIND,
        'sites': sites,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(f'{len(sites)} emplacements, {sum(s["yieldKt"] for s in sites)} kt in all')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
