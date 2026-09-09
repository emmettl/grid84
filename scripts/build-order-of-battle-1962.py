#!/usr/bin/env python3
"""Build the order of battle of the Cuban missile crisis, 27 October 1962.

The Soviet force in Cuba follows Norris and Kristensen's 2012 count and the
Anadyr record as Wikipedia carries it: three R-12 regiments of eight
launchers with 36 missiles, two R-14 regiments planned with warheads landed
and no missiles, two FKR regiments with 16 launchers and 80 warheads, three
Luna battalions with six launchers and twelve warheads, six Il-28 bombs.
The sites are the ones the photography named; positions are geocoded from
the modern towns and tiered reconstructed. The American side is the air
bases OPLAN 312 flew from, the carriers in the Straits, Guantánamo, and the
invasion beaches of OPLAN 316, positions from the modern map.

Usage: python3 scripts/build-order-of-battle-1962.py --out data/cuba62/order-of-battle-1962.json
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

PHOTON = 'https://photon.komoot.io/api/'
NORRIS = 'Norris and Kristensen, "The Cuban Missile Crisis: a nuclear order of battle, October and November 1962," Bulletin of the Atomic Scientists 68:6 (2012)'
ANADYR = 'Wikipedia, Operation Anadyr'

# Soviet sites: (id, name, query, kind, launchers, missiles, warheads, yield kt, note, evidence)
SOVIET = [
    ('san-cristobal-1', 'San Cristóbal MRBM site 1', 'San Cristóbal, Artemisa', 'irbm', 4, 6, 6, 1_000, 'R-12: four launchers per site, 1.5 missiles per launcher; four sites around San Cristóbal photographed from 14 October', 'documented'),
    ('san-cristobal-2', 'San Cristóbal MRBM site 2', 'Candelaria, Artemisa', 'irbm', 4, 6, 6, 1_000, 'R-12 site', 'documented'),
    ('san-cristobal-3', 'San Cristóbal MRBM site 3', 'San Diego de los Baños', 'irbm', 4, 6, 6, 1_000, 'R-12 site', 'documented'),
    ('san-cristobal-4', 'San Cristóbal MRBM site 4', 'Los Palacios, Pinar del Río', 'irbm', 4, 6, 6, 1_000, 'R-12 site', 'documented'),
    ('sagua-1', 'Sagua la Grande MRBM site 1', 'Sagua la Grande', 'irbm', 4, 6, 6, 1_000, 'R-12 site', 'documented'),
    ('sagua-2', 'Sagua la Grande MRBM site 2', 'Sitiecito, Villa Clara', 'irbm', 4, 6, 6, 1_000, 'R-12 site', 'documented'),
    ('guanajay-1', 'Guanajay IRBM site 1', 'Guanajay', 'irbm-empty', 4, 0, 8, 1_000, 'R-14: sixteen launchers planned at Guanajay and Remedios; 24 warheads arrived on the Aleksandrovsk at Mariel; no missiles arrived', 'documented'),
    ('guanajay-2', 'Guanajay IRBM site 2', 'Caimito, Artemisa', 'irbm-empty', 4, 0, 8, 1_000, 'R-14 site under construction, no missiles', 'documented'),
    ('remedios', 'Remedios IRBM site', 'Remedios, Villa Clara', 'irbm-empty', 8, 0, 8, 1_000, 'R-14 site under construction, no missiles', 'documented'),
    ('fkr-east', 'FKR regiment · Mayarí Arriba', 'Mayarí Arriba', 'cruise', 8, 40, 40, 12, 'The eastern FKR-1 regiment, within reach of Guantánamo; 80 warheads for two regiments', 'documented'),
    ('fkr-west', 'FKR regiment · western Cuba', 'Guerra, Artemisa', 'cruise', 8, 40, 40, 12, 'The western FKR-1 regiment; its exact position is reconstructed', 'reconstructed'),
    ('luna-artemisa', 'Luna battalion · Artemisa motorised rifle regiment', 'Artemisa', 'luna', 2, 4, 4, 2, 'Three Luna battalions with twelve 3N14 nuclear warheads on six launchers; the battalions with the western regiments', 'reconstructed'),
    ('luna-santa-clara', 'Luna battalion · Santa Clara motorised rifle regiment', 'Santa Clara, Cuba', 'luna', 2, 4, 4, 2, 'Luna battalion with the central regiment', 'reconstructed'),
    ('luna-holguin', 'Luna battalion · Holguín motorised rifle regiment', 'Holguín', 'luna', 2, 4, 4, 2, 'Luna battalion with the eastern regiment', 'reconstructed'),
    ('san-julian', 'San Julián airfield · Il-28 detachment', 'San Julián, Pinar del Río', 'bomber', 6, 6, 6, 12, 'Six Il-28 bombers with six 407N bombs; most aircraft still crated', 'documented'),
]

# American sites: (id, name, query, kind, note)
US = [
    ('homestead', 'Homestead AFB', 'Homestead Air Reserve Base', 'airbase', 'OPLAN 312 tactical fighters; 40 km from Miami'),
    ('macdill', 'MacDill AFB', 'MacDill Air Force Base', 'airbase', 'OPLAN 312; Tampa'),
    ('mccoy', 'McCoy AFB', 'Orlando International Airport', 'airbase', 'OPLAN 312; Orlando; the U-2s flew from here'),
    ('key-west', 'NAS Key West · Boca Chica', 'Naval Air Station Key West', 'airbase', 'The nearest field to Cuba; low-level reconnaissance'),
    ('patrick', 'Patrick AFB', 'Patrick Space Force Base', 'airbase', 'Cape Canaveral'),
    ('tyndall', 'Tyndall AFB', 'Tyndall Air Force Base', 'airbase', 'Panama City'),
    ('eglin', 'Eglin AFB', 'Eglin Air Force Base', 'airbase', 'Fort Walton Beach'),
    ('turner', 'Turner AFB', 'Marine Corps Logistics Base Albany', 'airbase', 'Albany, Georgia; SAC B-52s'),
    ('guantanamo', 'Guantánamo Bay Naval Base', None, 'base', 'Dependents evacuated 22 October; garrison reinforced by Marine battalions'),
    ('cv-enterprise', 'USS Enterprise · Straits of Florida', None, 'carrier', 'Carrier task force off Cuba for OPLAN 312; position inferred'),
    ('cv-independence', 'USS Independence · Windward Passage', None, 'carrier', 'Carrier task force off eastern Cuba; position inferred'),
    ('beach-east', 'OPLAN 316 landing · east of Havana', None, 'beach', 'The amphibious landing east of Havana; beach inferred at Tarará'),
    ('beach-west', 'OPLAN 316 landing · west of Havana', None, 'beach', 'The amphibious landing west of Havana; beach inferred at Mariel'),
    ('bragg', 'Fort Bragg · 82nd Airborne', 'Fort Liberty', 'base', 'OPLAN 316 airborne assault on day one'),
    ('campbell', 'Fort Campbell · 101st Airborne', 'Fort Campbell', 'base', 'OPLAN 316 airborne assault on day one'),
    ('washington', 'Washington', 'Washington, D.C.', 'capital', 'About 1,900 km from San Cristóbal, inside the R-12\'s 2,000 km'),
]
HAND = {
    'bragg': (-79.0, 35.14),
    'luna-holguin': (-76.26, 20.89),
    'guantanamo': (-75.16, 19.9175),
    'cv-enterprise': (-80.6, 23.4),
    'cv-independence': (-74.6, 20.6),
    'beach-east': (-82.2, 23.17),
    'beach-west': (-82.75, 23.0),
    'fkr-west': (-82.62, 22.87),
    'san-julian': (-84.15, 22.1),
    'sitiecito': (-80.16, 22.78),
}


def geocode(query: str):
    url = PHOTON + '?' + urllib.parse.urlencode({'q': query, 'limit': 1, 'lang': 'en'})
    req = urllib.request.Request(url, headers={'User-Agent': 'grid84 order-of-battle build'})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    f = data.get('features') or []
    if not f:
        return None
    lon, lat = f[0]['geometry']['coordinates']
    return (lon, lat, f[0]['properties'].get('name'))


def place(lid, query):
    if lid in HAND:
        lon, lat = HAND[lid]
        return lon, lat, 'hand-set'
    g = geocode(query)
    time.sleep(1.0)
    if not g:
        print('NO MATCH', lid, query)
        return None
    return g


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    sites = []
    for lid, name, query, kind, launchers, missiles, warheads, kt, note, evidence in SOVIET:
        p = place(lid, query)
        if not p:
            continue
        lon, lat, hit = p
        sites.append({'side': 'su', 'id': lid, 'name': name, 'kind': kind, 'lon': round(lon, 4), 'lat': round(lat, 4), 'launchers': launchers, 'missiles': missiles, 'warheads': warheads, 'yieldKt': kt, 'note': note, 'evidence': evidence, 'positionEvidence': 'inferred' if hit == 'hand-set' else 'reconstructed', 'geocoded': hit, 'source': f'{NORRIS}; {ANADYR}'})
        print(lid, hit, round(lon, 3), round(lat, 3))
    for lid, name, query, kind, note in US:
        p = place(lid, query)
        if not p:
            continue
        lon, lat, hit = p
        sites.append({'side': 'us', 'id': lid, 'name': name, 'kind': kind, 'lon': round(lon, 4), 'lat': round(lat, 4), 'note': note, 'evidence': 'documented' if kind in ('airbase', 'base', 'capital') else 'inferred', 'positionEvidence': 'inferred' if hit == 'hand-set' else 'reconstructed', 'geocoded': hit, 'source': 'Chang and Kornbluh, The Cuban Missile Crisis, 1962 (1998); the JCS papers in the National Security Archive collections'})
        print(lid, hit, round(lon, 3), round(lat, 3))
    out = {
        'date': '27 October 1962',
        'documented': {
            'r12': {'regiments': 3, 'launchers': 24, 'missiles': 36, 'warheads': 36, 'yieldKt': 1_000, 'rangeKm': 2_000, 'readinessMinutes': 30, 'source': f'{NORRIS}; {ANADYR}: eight launchers and 1.5 missiles per regiment; Wikipedia, R-12 Dvina: readiness 1 is 30 minutes to launch, the warhead 1.0 to 2.3 Mt'},
            'r14': {'launchersPlanned': 16, 'missiles': 0, 'warheads': 24, 'source': NORRIS},
            'fkr': {'regiments': 2, 'launchers': 16, 'warheads': 80, 'yieldKt': 12, 'rangeKm': 180, 'source': f'{NORRIS}; {ANADYR}'},
            'luna': {'battalions': 3, 'launchers': 6, 'warheads': 12, 'yieldKt': 2, 'rangeKm': 32, 'source': f'{ANADYR}; Wikipedia, 2K6 Luna: 36 rockets, twelve with two-kiloton warheads, six launchers'},
            'il28': {'aircraft': 6, 'bombs': 6, 'yieldKt': 12, 'source': ANADYR},
            'troops': {'anadyr': 47_000, 'cia': 43_000, 'source': f'{ANADYR}: 47,000; the crisis article: about 43,000; the CIA estimate at the time 10,000 to 12,000'},
            'oplan312': {'sorties': 1_190, 'source': 'The JCS papers via Chang and Kornbluh; the first-day sortie figure'},
            'oplan316': {'troops': 120_000, 'source': 'The JCS papers via Chang and Kornbluh'},
            'sac': {'defcon': 2, 'from': '24 October', 'to': '20 November', 'b52Airborne': 'about an eighth of the force', 'source': 'SAC historical study of the crisis; Sagan 1985'},
        },
        'sites': sites,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(sites), 'sites written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
