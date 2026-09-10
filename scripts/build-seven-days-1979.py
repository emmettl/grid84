#!/usr/bin/env python3
"""Seven Days to the River Rhine: the plan's two halves, 1979.

The Warsaw Pact exercise plan Siedem dni do Renu was declassified by
Poland's minister of defence in November 2005 and reported worldwide. Its
premise is a NATO nuclear attack on the Vistula valley that wrecks Poland;
its answer is a nuclear counter-offensive westward reaching the Rhine in
seven days. The western cities named in the coverage of the release are
here; the plan's full target list is public in Poland but is not
transcribed in this repository, and the readouts say so.

Nothing here is a count of the Warsaw Pact's arsenal. The delivery units
are the theatre systems of 1979 at garrisons the open literature gives,
and their assignment to these cities is inferred.

Usage: python3 scripts/build-seven-days-1979.py --out data/seven-days/plan-1979.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

RELEASE = ('Siedem dni do Renu, the Warsaw Pact exercise plan of 1979, declassified by the Polish Ministry of National Defence '
           'in November 2005; the cities are those named in the reporting of the release. The primary document is public in '
           'Poland and is not transcribed here')
NOTEBOOK = 'Cochran, Arkin and Hoenig, Nuclear Weapons Databook; Norris and Kristensen, Nuclear Notebook, for the theatre systems of 1979'

# The western cities the coverage of the release names. lon, lat, country, note.
WEST = [
    (4.3517, 50.8467, 'Brussels', 'BE', 'NATO and SHAPE country; named in the plan'),
    (4.4025, 51.2194, 'Antwerp', 'BE', 'The reinforcement port for northern Europe'),
    (4.8952, 52.3702, 'Amsterdam', 'NL', ''),
    (5.1214, 52.0907, 'Utrecht', 'NL', ''),
    (12.5683, 55.6761, 'Copenhagen', 'DK', 'Denmark closes the Baltic exits'),
    (9.9937, 53.5511, 'Hamburg', 'DE', 'The northern port and the NORTHAG rear'),
    (9.1829, 48.7758, 'Stuttgart', 'DE', 'CENTAG and the American command'),
    (11.5820, 48.1351, 'Munich', 'DE', ''),
    (16.3738, 48.2082, 'Vienna', 'AT', 'Austria was neutral. The plan names it anyway'),
    (10.9916, 45.4384, 'Verona', 'IT', 'The Italian corps sector and its command'),
    (11.5480, 45.5455, 'Vicenza', 'IT', ''),
    (11.8768, 45.4064, 'Padua', 'IT', ''),
]

# The plan's premise: a NATO strike on the Vistula. The cities are Poland's largest of 1979; which the plan
# assumed would be struck is not transcribed here, and the readout says the premise is the plan's, not a NATO document.
POLAND = [
    (21.0122, 52.2297, 'Warsaw', 'PL', ''),
    (19.4560, 51.7592, 'Lodz', 'PL', ''),
    (19.9450, 50.0647, 'Krakow', 'PL', ''),
    (16.9252, 51.1079, 'Wroclaw', 'PL', ''),
    (18.6466, 54.3520, 'Gdansk', 'PL', 'The Baltic ports the plan expects to lose'),
    (18.9987, 49.8225, 'Katowice area', 'PL', 'The industrial region of Upper Silesia'),
    (16.9252, 52.4064, 'Poznan', 'PL', ''),
    (14.5528, 53.4285, 'Szczecin', 'PL', ''),
]

# Theatre delivery of 1979: system, warheads at this garrison, yield kt, range km, lon, lat, note.
PACT_LAUNCHERS = [
    ('SS-20 Saber (Pioneer)', 'Postavy · 32nd Guards Rocket Division', 27, 150, 5_000, 26.83, 55.11, 'Three warheads a missile; the system the double-track decision was answering'),
    ('SS-20 Saber (Pioneer)', 'Mozyr · rocket division', 27, 150, 5_000, 29.27, 52.05, ''),
    ('SS-4 Sandal (R-12)', 'Kolomyia · rocket regiment', 12, 1_000, 2_000, 25.04, 48.53, 'The old megaton IRBMs, still deployed in 1979'),
    ('SS-12 Scaleboard (Temp-S)', 'Group of Soviet Forces in Germany · missile brigade', 12, 500, 900, 12.50, 52.30, 'Operational-tactical, held at army level'),
    ('SS-12 Scaleboard (Temp-S)', 'Northern Group of Forces · Poland', 12, 500, 900, 16.20, 52.90, ''),
    ('SS-1 Scud-B (R-17)', 'Central Group of Forces · Czechoslovakia', 18, 100, 300, 15.30, 49.50, 'Divisional and army missiles; the short rungs of the ladder'),
    ('SS-1 Scud-B (R-17)', 'Group of Soviet Forces in Germany · army brigades', 24, 100, 300, 11.80, 51.20, ''),
    ('Su-24 Fencer', 'Templin · air army', 16, 350, 1_800, 13.50, 53.12, 'Theatre strike aviation, low level'),
    ('Tu-22M Backfire', 'Bobruisk · heavy bomber division', 12, 350, 4_000, 29.22, 53.15, 'The medium bomber the West counted as strategic and Moscow did not'),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    out = {
        'year': 1979,
        'source': RELEASE,
        'forceSource': NOTEBOOK,
        'note': ('The plan assumes NATO uses nuclear weapons first, on Poland, and answers westward. Both halves are drawn. '
                 'The western cities are named in the release; the Polish cities are the country\'s largest of the period and '
                 'stand for a premise the plan states without a transcribed list.'),
        'west': [{'name': n, 'lon': lo, 'lat': la, 'country': c, 'note': note} for lo, la, n, c, note in WEST],
        'poland': [{'name': n, 'lon': lo, 'lat': la, 'country': c, 'note': note} for lo, la, n, c, note in POLAND],
        'launchers': [{'system': s, 'name': n, 'warheads': w, 'yieldKt': y, 'rangeKm': r, 'lon': lo, 'lat': la, 'note': note}
                      for s, n, w, y, r, lo, la, note in PACT_LAUNCHERS],
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(f'{len(WEST)} western cities, {len(POLAND)} Polish, {len(PACT_LAUNCHERS)} launcher groups, '
          f'{sum(l[2] for l in PACT_LAUNCHERS)} warheads')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
