#!/usr/bin/env python3
"""Build the strategic order of battle of the United States and the Soviet Union in 1956.

The start of the curve: the year of the SAC target study the SIOP//62 study
transcribes, when the force was bombers and nothing else. Strategic Air
Command's fleet totals for 1956 follow the Nuclear Weapons Databook vol. 1
(247 B-36, 1,306 B-47, 97 B-52), spread over the wings the unit lists name
at 45 aircraft a wing, with the rotational bases abroad where the B-47s
stood their Reflex tours. The Soviet side is Long Range Aviation's few
heavy bombers and the Tu-16 divisions, with the stockpile of the year
(about 426 warheads, Norris and Kristensen) as the ceiling on their weapons.
Everything is reconstructed or inferred and says so; no study stands on it.

Usage: python3 scripts/build-order-of-battle-1956.py --out data/chronicle/order-of-battle-1956.json
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

PHOTON = 'https://photon.komoot.io/api/'
WIKI = 'Wikipedia'
DATABOOK = 'Cochran, Arkin and Hoenig, Nuclear Weapons Databook vol. 1 (1984), SAC aircraft by year; vol. 4 (1989) for Soviet forces'
NN = 'Norris and Kristensen, "Global nuclear weapons inventories, 1945–2013," Bulletin of the Atomic Scientists 69:5 (2013): United States 3,692 and Soviet Union 426 warheads in 1956'

# --- United States: Strategic Air Command, 1956 ------------------------------

B47_WINGS = [
    ('pease-100', 'Pease AFB · 100th BW', 'Portsmouth International Airport at Pease'),
    ('plattsburgh-380', 'Plattsburgh AFB · 380th BW', 'Plattsburgh International Airport'),
    ('lockbourne-301', 'Lockbourne AFB · 301st BW', 'Rickenbacker International Airport'),
    ('hunter-2', 'Hunter AFB · 2nd and 308th BW', 'Hunter Army Airfield'),
    ('macdill-306', 'MacDill AFB · 306th and 305th BW', 'MacDill Air Force Base'),
    ('homestead-379', 'Homestead AFB · 379th BW', 'Homestead Air Reserve Base'),
    ('pinecastle-321', 'Pinecastle AFB · 321st BW', 'Orlando International Airport'),
    ('chennault-44', 'Chennault AFB · 44th BW', 'Chennault International Airport'),
    ('barksdale-376', 'Barksdale AFB · 376th BW', 'Barksdale Air Force Base'),
    ('little-rock-384', 'Little Rock AFB · 384th and 70th BW', 'Little Rock Air Force Base'),
    ('whiteman-340', 'Whiteman AFB · 340th BW', 'Whiteman Air Force Base'),
    ('forbes-40', 'Forbes AFB · 40th BW', 'Topeka Regional Airport'),
    ('schilling-310', 'Schilling AFB · 310th BW', 'Salina Regional Airport'),
    ('lincoln-98', 'Lincoln AFB · 98th and 307th BW', 'Lincoln Airport, Nebraska'),
    ('mountain-home-9', 'Mountain Home AFB · 9th BW', 'Mountain Home Air Force Base'),
    ('march-22', 'March AFB · 22nd and 320th BW', 'March Air Reserve Base'),
    ('davis-monthan-303', 'Davis-Monthan AFB · 303rd BW', 'Davis-Monthan Air Force Base'),
    ('dyess-341', 'Dyess AFB · 341st BW', 'Dyess Air Force Base'),
    ('lake-charles-68', 'Lake Charles AFB · 68th BW', 'Chennault International Airport'),
    ('mccoy-19', 'McCoy AFB · 19th BW', 'Orlando International Airport'),
    ('smoky-hill-40', 'Smoky Hill AFB · 40th BW', 'Salina Regional Airport'),
    ('sedalia-340', 'Sedalia AFB · 340th BW', 'Whiteman Air Force Base'),
]
# Bases abroad: B-47 wings stood ninety-day rotations in Britain, Morocco and Guam and, from 1957, the shorter Reflex tours.
ABROAD = [
    ('brize-norton', 'RAF Brize Norton · rotational B-47 wing', 'Brize Norton'),
    ('fairford', 'RAF Fairford · rotational B-47 wing', 'RAF Fairford'),
    ('greenham-common', 'RAF Greenham Common · rotational B-47 wing', 'Greenham Common'),
    ('upper-heyford', 'RAF Upper Heyford · rotational B-47 wing', 'Upper Heyford'),
    ('sidi-slimane', 'Sidi Slimane · rotational B-47 wing', 'Sidi Slimane'),
    ('ben-guerir', 'Ben Guerir · rotational B-47 wing', 'Ben Guerir'),
    ('andersen-guam', 'Andersen AFB · rotational B-47 wing', 'Andersen Air Force Base'),
]
B36_WINGS = [
    ('carswell-7', 'Carswell AFB · 7th and 11th BW', 'Naval Air Station Joint Reserve Base Fort Worth'),
    ('biggs-95', 'Biggs AFB · 95th BW', 'Biggs Army Airfield'),
    ('ellsworth-28', 'Ellsworth AFB · 28th BW', 'Ellsworth Air Force Base'),
    ('fairchild-92', 'Fairchild AFB · 92nd BW', 'Fairchild Air Force Base'),
    ('loring-42', 'Loring AFB · 42nd BW', 'Loring International Airport'),
    ('walker-6', 'Walker AFB · 6th BW', 'Roswell Air Center'),
    ('travis-5', 'Travis AFB · 5th BW', 'Travis Air Force Base'),
]
B52 = ('castle-93', 'Castle AFB · 93rd BW', 'Castle Airport')
B47_TOTAL, B36_TOTAL, B52_TOTAL = 1_306, 247, 97
B47_WEAPONS, B36_WEAPONS, B52_WEAPONS = 1, 2, 2
B47_KT, B36_KT, B52_KT = 1_100, 3_800, 3_800  # Mk 6/15 class on the B-47; Mk 17/36 class on the heavies, the Databook's loadings by class
US_NOTE = f'{B47_TOTAL} B-47, {B36_TOTAL} B-36 and {B52_TOTAL} B-52 in 1956 (Databook vol. 1) spread over the wings and rotational bases the unit lists name; one weapon per B-47, two per heavy bomber, the yields by weapon class'

# --- Soviet Union: Long Range Aviation, 1956 ---------------------------------

SU_HEAVY = [
    ('engels', 'Engels · 201st Heavy Bomber Division · M-4', 'Engels, Saratov Oblast', 'M-4', 30),
    ('uzin', 'Uzin · 106th Heavy Bomber Division · Tu-95', 'Uzyn, Kyiv Oblast', 'Tu-95', 20),
]
SU_MEDIUM = [
    ('bobruisk', 'Bobruisk · Tu-16 division', 'Babruysk', 'Tu-16'),
    ('poltava', 'Poltava · Tu-16 division', 'Poltava', 'Tu-16'),
    ('priluki', 'Priluki · Tu-16 division', 'Pryluky', 'Tu-16'),
    ('baranovichi', 'Baranovichi · Tu-16 division', 'Baranavichy', 'Tu-16'),
    ('migalovo', 'Migalovo · Tu-16 division', 'Tver', 'Tu-16'),
    ('belaya', 'Belaya · Tu-16 division', 'Usolye-Sibirskoye', 'Tu-16'),
    ('spassk', 'Spassk-Dalny · Tu-16 division', 'Spassk-Dalny', 'Tu-16'),
    ('vozdvizhenka', 'Vozdvizhenka · Tu-16 division', 'Ussuriysk', 'Tu-16'),
]
TU16_TOTAL = 400
SU_STOCKPILE = 426
SU_HEAVY_WEAPONS = 1
SU_NOTE = f'About 50 heavy bombers and some 400 Tu-16s in Long Range Aviation by 1956 (Databook vol. 4; the Tu-16 count is an estimate), with the stockpile of the year, {SU_STOCKPILE} warheads, as the ceiling: one weapon per heavy bomber and the rest spread over the Tu-16 fields, which are inferred'

HAND = {
    'engels': (46.20, 51.48), 'uzin': (30.42, 49.83), 'bobruisk': (29.18, 53.10), 'poltava': (34.55, 49.60), 'priluki': (32.39, 50.59), 'baranovichi': (26.02, 53.10),
    'migalovo': (35.75, 56.83), 'belaya': (103.57, 52.92), 'spassk': (132.80, 44.55), 'vozdvizhenka': (131.94, 43.90),
    'sidi-slimane': (-6.05, 34.23), 'ben-guerir': (-7.87, 32.12), 'loring-42': (-67.89, 46.95), 'mccoy-19': (-81.31, 28.43), 'walker-6': (-104.53, 33.30), 'biggs-95': (-106.38, 31.85),
    'pinecastle-321': (-81.31, 28.43), 'smoky-hill-40': (-97.65, 38.79), 'lake-charles-68': (-93.14, 30.21), 'sedalia-340': (-93.55, 38.73),
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


def spread(total: int, n: int) -> list[int]:
    base, extra = divmod(total, n)
    return [base + (1 if i < extra else 0) for i in range(n)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    sites = []

    def add(rec, lid, query):
        if lid in HAND:
            lon, lat, hit = HAND[lid][0], HAND[lid][1], 'hand-set'
        else:
            g = geocode(query)
            time.sleep(1.0)
            if not g:
                print('NO MATCH', lid, query)
                return
            lon, lat, hit = g
        rec.update({'id': lid, 'lon': round(lon, 4), 'lat': round(lat, 4), 'geocoded': hit, 'positionEvidence': 'inferred' if hit == 'hand-set' else 'reconstructed'})
        sites.append(rec)
        print(lid, hit, round(lon, 3), round(lat, 3))

    b47_sites = B47_WINGS + ABROAD
    for (lid, name, query), n in zip(b47_sites, spread(B47_TOTAL, len(b47_sites))):
        add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': 'B-47', 'aircraft': n, 'weaponsPerAircraft': B47_WEAPONS, 'yieldKt': B47_KT, 'note': US_NOTE, 'evidence': 'reconstructed', 'source': f'{DATABOOK}; {WIKI}, List of B-47 units of the United States Air Force'}, lid, query)
    for (lid, name, query), n in zip(B36_WINGS, spread(B36_TOTAL, len(B36_WINGS))):
        add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': 'B-36', 'aircraft': n, 'weaponsPerAircraft': B36_WEAPONS, 'yieldKt': B36_KT, 'note': US_NOTE, 'evidence': 'reconstructed', 'source': f'{DATABOOK}; {WIKI}, Convair B-36 Peacemaker operators'}, lid, query)
    lid, name, query = B52
    add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': 'B-52B', 'aircraft': B52_TOTAL, 'weaponsPerAircraft': B52_WEAPONS, 'yieldKt': B52_KT, 'note': US_NOTE, 'evidence': 'documented', 'source': f'{DATABOOK}; {WIKI}, 93rd Bomb Wing: the first B-52 wing, from June 1955'}, lid, query)

    heavy_weapons = sum(n for *_, n in SU_HEAVY) * SU_HEAVY_WEAPONS
    for lid, name, query, model, n in SU_HEAVY:
        add({'side': 'su', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': n, 'weaponsPerAircraft': SU_HEAVY_WEAPONS, 'yieldKt': 1_000, 'note': SU_NOTE, 'evidence': 'inferred', 'source': f'{DATABOOK}; {WIKI}, Myasishchev M-4; Tupolev Tu-95'}, lid, query)
    medium_weapons = spread(SU_STOCKPILE - heavy_weapons, len(SU_MEDIUM))
    for (lid, name, query, model), n, w in zip(SU_MEDIUM, spread(TU16_TOTAL, len(SU_MEDIUM)), medium_weapons):
        add({'side': 'su', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': n, 'weapons': w, 'weaponsPerAircraft': round(w / n, 2), 'yieldKt': 400, 'note': SU_NOTE, 'evidence': 'inferred', 'source': f'{DATABOOK}; {NN}; {WIKI}, Tupolev Tu-16'}, lid, query)

    out = {
        'date': '1956',
        'note': 'The start of the curve: a force of bombers on both sides, the year of the SAC target study the SIOP//62 study transcribes. No study stands on this epoch.',
        'rules': {'us': US_NOTE, 'su': SU_NOTE, 'stockpiles': NN},
        'sites': sites,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(sites), 'sites written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
