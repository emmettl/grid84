#!/usr/bin/env python3
"""Build the strategic order of battle of the United States and the Soviet Union at the end of 1967.

The peak of the American stockpile (31,255 warheads by the Notebook's
count) and the year the Minuteman force reached its thousand silos; on the
Soviet side the SS-9 and SS-11 fields filling and the ICBM force passing
five hundred. Totals follow the Nuclear Weapons Databook vol. 1 (American
aircraft and missiles by year) and vol. 4 with the Nuclear Notebook's
series (Soviet launchers by type), spread over the wings and divisions the
unit histories name. Everything is reconstructed or inferred and says so;
no study stands on it.

Usage: python3 scripts/build-order-of-battle-1967.py --out data/chronicle/order-of-battle-1967.json
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
DATABOOK = 'Cochran, Arkin and Hoenig, Nuclear Weapons Databook vol. 1 (1984); vol. 4 (1989)'
NN = 'Norris and Kristensen, "Global nuclear weapons inventories, 1945–2013," Bulletin of the Atomic Scientists 69:5 (2013): United States 31,255 and Soviet Union 8,339 warheads in 1967'

# Minuteman: 1,000 silos by April 1967; Minuteman II in the 564th at Malmstrom and at Grand Forks, the rest Minuteman I (Databook vol. 1).
US_ICBM = [
    ('malmstrom-341', 'Malmstrom AFB · 341st SMW', 'Malmstrom Air Force Base', [('Minuteman I', 150, 1, 1_200), ('Minuteman II', 50, 1, 1_200)]),
    ('ellsworth-44', 'Ellsworth AFB · 44th SMW', 'Ellsworth Air Force Base', [('Minuteman I', 150, 1, 1_200)]),
    ('minot-91', 'Minot AFB · 91st SMW', 'Minot Air Force Base', [('Minuteman I', 150, 1, 1_200)]),
    ('whiteman-351', 'Whiteman AFB · 351st SMW', 'Whiteman Air Force Base', [('Minuteman I', 150, 1, 1_200)]),
    ('warren-90', 'F. E. Warren AFB · 90th SMW', 'Francis E. Warren Air Force Base', [('Minuteman I', 200, 1, 1_200)]),
    ('grand-forks-321', 'Grand Forks AFB · 321st SMW', 'Grand Forks Air Force Base', [('Minuteman II', 150, 1, 1_200)]),
    ('davis-monthan-390', 'Davis-Monthan AFB · 390th SMW', 'Davis-Monthan Air Force Base', [('Titan II', 18, 1, 9_000)]),
    ('little-rock-308', 'Little Rock AFB · 308th SMW', 'Little Rock Air Force Base', [('Titan II', 18, 1, 9_000)]),
    ('mcconnell-381', 'McConnell AFB · 381st SMW', 'McConnell Air Force Base', [('Titan II', 18, 1, 9_000)]),
]
US_ICBM_NOTE = '1,000 Minuteman and 54 Titan II at the end of 1967 (Databook vol. 1); the Minuteman II share is the conversion state of the year, reconstructed'

# Bombers: about 590 B-52 and 76 B-58 in service in 1967 (Databook vol. 1), spread over the wings the unit lists name; a third of the force on ground alert, the rest of the B-52Ds on the Arc Light rotation.
B52_WINGS = [
    ('barksdale-2', 'Barksdale AFB · 2nd BW', 'Barksdale Air Force Base'), ('minot-5', 'Minot AFB · 5th BW', 'Minot Air Force Base'), ('carswell-7', 'Carswell AFB · 7th BW', 'Naval Air Station Joint Reserve Base Fort Worth'),
    ('robins-19', 'Robins AFB · 19th BW', 'Robins Air Force Base'), ('march-22', 'March AFB · 22nd BW', 'March Air Reserve Base'), ('ellsworth-28', 'Ellsworth AFB · 28th BW', 'Ellsworth Air Force Base'),
    ('loring-42', 'Loring AFB · 42nd BW', 'Loring International Airport'), ('seymour-johnson-68', 'Seymour Johnson AFB · 68th BW', 'Seymour Johnson Air Force Base'), ('fairchild-92', 'Fairchild AFB · 92nd BW', 'Fairchild Air Force Base'),
    ('castle-93', 'Castle AFB · 93rd BW', 'Castle Airport'), ('dyess-96', 'Dyess AFB · 96th BW', 'Dyess Air Force Base'), ('blytheville-97', 'Blytheville AFB · 97th BW', 'Arkansas International Airport'),
    ('westover-99', 'Westover AFB · 99th BW', 'Westover Air Reserve Base'), ('mccoy-306', 'McCoy AFB · 306th BW', 'Orlando International Airport'), ('grand-forks-319', 'Grand Forks AFB · 319th BW', 'Grand Forks Air Force Base'),
    ('mather-320', 'Mather AFB · 320th BW', 'Sacramento Mather Airport'), ('wurtsmith-379', 'Wurtsmith AFB · 379th BW', 'Oscoda-Wurtsmith Airport'), ('ki-sawyer-410', 'K. I. Sawyer AFB · 410th BW', 'Sawyer International Airport'),
    ('griffiss-416', 'Griffiss AFB · 416th BW', 'Griffiss International Airport'), ('kincheloe-449', 'Kincheloe AFB · 449th BW', 'Chippewa County International Airport'), ('beale-456', 'Beale AFB · 456th BW', 'Beale Air Force Base'),
    ('columbus-454', 'Columbus AFB · 454th BW', 'Columbus Air Force Base'), ('turner-484', 'Turner AFB · 484th BW', 'Southwest Georgia Regional Airport'), ('homestead-19', 'Homestead AFB · 19th BW', 'Homestead Air Reserve Base'),
    ('plattsburgh-380', 'Plattsburgh AFB · 380th SAW', 'Plattsburgh International Airport'), ('pease-509', 'Pease AFB · 509th BW', 'Portsmouth International Airport at Pease'), ('travis-5', 'Travis AFB · 5th BW', 'Travis Air Force Base'),
    ('andersen-3960', 'Andersen AFB · Arc Light rotation', 'Andersen Air Force Base'), ('u-tapao', 'U-Tapao · Arc Light rotation', 'U-Tapao International Airport'), ('kadena-4252', 'Kadena AB · Arc Light rotation', 'Kadena Air Base'),
]
B58_WINGS = [('grissom-305', 'Grissom AFB · 305th BW', 'Grissom Air Reserve Base'), ('little-rock-43', 'Little Rock AFB · 43rd BW', 'Little Rock Air Force Base')]
B52_TOTAL, B58_TOTAL = 590, 76
B52_WEAPONS, B58_WEAPONS = 4, 2
B52_KT, B58_KT = 1_100, 1_100
US_BOMBER_NOTE = f'{B52_TOTAL} B-52 and {B58_TOTAL} B-58 in 1967 (Databook vol. 1), spread over the wings the unit lists name with three deployed fields for the Southeast Asia rotation; four weapons per B-52 and two per B-58 as the SIOP load; about a third on ground alert (Databook)'

# Polaris: 41 boats and 656 tubes complete in 1967, A3 on most; Holy Loch, Rota, Guam and Charleston.
US_SSBN_AREAS = [
    ('ssbn-norwegian', 'Polaris patrol · Norwegian Sea', (5.0, 68.0), 'Boats from Holy Loch', 10, 16, 3, 200),
    ('ssbn-mediterranean', 'Polaris patrol · Mediterranean', (18.0, 35.0), 'Boats from Rota', 4, 16, 3, 200),
    ('ssbn-pacific', 'Polaris patrol · western Pacific', (150.0, 30.0), 'Boats from Guam', 5, 16, 3, 200),
    ('ssbn-atlantic', 'Polaris patrol · North Atlantic', (-40.0, 45.0), 'Boats from Charleston', 4, 16, 3, 200),
]
US_SSBN_PORTS = [('holy-loch', 'Holy Loch · Submarine Squadron 14', 'Dunoon', 6, 16, 3, 200), ('rota', 'Rota · Submarine Squadron 16', 'Rota, Spain', 4, 16, 3, 200), ('guam-15', 'Apra Harbor · Submarine Squadron 15', 'Apra Harbor', 4, 16, 3, 200), ('charleston', 'Charleston · Polaris boats', 'Goose Creek, South Carolina', 4, 16, 3, 200)]
US_SSBN_NOTE = '41 boats and 656 tubes (Databook vol. 1); A3 with three 200 kt warheads as the loading, A2 boats counted the same; 23 at sea and the areas inferred'

# Soviet ICBMs at the end of 1967, by type (Databook vol. 4; the Notebook's series): SS-7 and SS-8 about 220, SS-9 about 130, SS-11 about 300, SS-13 arriving; about 650 launchers.
SU_ICBM = {
    'SS-7 / SS-8': ([('yurya', 'Yurya · 8th Rocket Division', 'Yurya, Kirov Oblast'), ('nizhny-tagil', 'Verkhnyaya Salda · 42nd Rocket Division', 'Verkhnyaya Salda'), ('shadrinsk', 'Shadrinsk · 17th Rocket Brigade', 'Shadrinsk'), ('itatka', 'Itatka · 97th Rocket Brigade', 'Itatka, Tomsk Oblast'), ('tyumen', 'Tyumen · 93rd Rocket Brigade', 'Tyumen'), ('plesetsk', 'Plesetsk · 3rd Rocket Division', 'Plesetsk')], 220, 1, 5_000),
    'SS-9': ([('aleysk', 'Aleysk · 41st Guards Rocket Division', 'Aleysk, Altai Krai'), ('dombarovsky', 'Dombarovsky · 13th Rocket Division', 'Dombarovsky, Orenburg Oblast'), ('kartaly', 'Kartaly · 59th Rocket Division', 'Kartaly, Chelyabinsk Oblast'), ('uzhur', 'Uzhur · 62nd Rocket Division', 'Uzhur, Krasnoyarsk Krai')], 130, 1, 20_000),
    'SS-11': ([('kozelsk', 'Kozelsk · 28th Guards Rocket Division', 'Kozelsk, Kaluga Oblast'), ('tatishchevo', 'Tatishchevo · 60th Rocket Division', 'Tatishchevo, Saratov Oblast'), ('teykovo', 'Teykovo · 54th Guards Rocket Division', 'Teykovo, Ivanovo Oblast'), ('kostroma', 'Kostroma · 10th Guards Rocket Division', 'Kostroma'), ('bershet', 'Bershet · 52nd Rocket Division', 'Bershet, Perm Krai'), ('pervomaysk', 'Pervomaysk · 46th Rocket Division', 'Pervomaisk, Mykolaiv Oblast'), ('drovyanaya', 'Drovyanaya · 4th Rocket Division', 'Drovyanaya, Zabaykalsky Krai'), ('svobodny', 'Svobodny · 27th Rocket Division', 'Svobodny, Amur Oblast')], 300, 1, 1_000),
}
SU_ICBM_NOTE = 'About 650 launchers at the end of 1967 by the Databook and the Notebook series, spread evenly over the divisions of each type; the yields are the Databook\'s'
SU_BOMBERS = [('uzin', 'Uzin · 106th Heavy Bomber Division', 'Uzyn, Kyiv Oblast', 'Tu-95'), ('mozdok', 'Mozdok · 182nd Guards Regiment', 'Mozdok', 'Tu-95'), ('dolon', 'Dolon · 79th Heavy Bomber Division', 'Semey', 'Tu-95'), ('ukrainka', 'Ukrainka · 73rd Heavy Bomber Division', 'Seryshevo, Amur Oblast', 'Tu-95'), ('engels', 'Engels · 201st Heavy Bomber Division', 'Engels, Saratov Oblast', 'M-4/3M')]
SU_BOMBER_TOTAL, SU_BOMBER_WEAPONS, SU_BOMBER_KT = 190, 2, 1_000
SU_SSBN_AREAS = [('su-ssbn-atlantic', 'Hotel and Golf patrol · North Atlantic', (-40.0, 50.0), 'Boats of the Northern Fleet', 3, 3, 1, 1_000), ('su-ssbn-pacific', 'Golf patrol · North Pacific', (170.0, 45.0), 'Boats of the Pacific Fleet', 2, 3, 1, 1_000)]
SU_SSBN_PORTS = [('gadzhiyevo', 'Gadzhiyevo · Northern Fleet', 'Gadzhiyevo', 20, 3, 1, 1_000), ('rybachiy', 'Rybachiy · Pacific Fleet', 'Vilyuchinsk', 10, 3, 1, 1_000), ('yankee-first', 'Gadzhiyevo · the first Yankee boats', 'Gadzhiyevo', 2, 16, 1, 1_000)]
SU_SSBN_NOTE = 'About 35 Hotel and Golf boats with three R-13 or R-21 each, and the first Yankees commissioning; five at sea is an inference'

HAND = {
    'plesetsk': (40.50, 62.90), 'yurya': (49.32, 59.05), 'nizhny-tagil': (60.55, 58.05), 'shadrinsk': (63.63, 56.08), 'itatka': (85.55, 56.85), 'tyumen': (65.53, 57.15),
    'aleysk': (82.78, 52.49), 'dombarovsky': (59.53, 50.76), 'kartaly': (60.65, 53.05), 'uzhur': (89.83, 55.30),
    'kozelsk': (35.79, 54.04), 'tatishchevo': (45.60, 51.67), 'teykovo': (40.54, 56.86), 'kostroma': (40.93, 57.77), 'bershet': (57.77, 57.73), 'pervomaysk': (30.85, 48.05), 'drovyanaya': (113.05, 51.60), 'svobodny': (128.32, 51.45),
    'uzin': (30.42, 49.83), 'mozdok': (44.60, 43.79), 'dolon': (79.15, 50.45), 'ukrainka': (124.24, 51.17), 'engels': (46.20, 51.48), 'gadzhiyevo': (33.33, 69.25), 'rybachiy': (158.40, 52.93), 'yankee-first': (33.33, 69.25),
    'holy-loch': (-4.93, 55.98), 'charleston': (-79.95, 32.97), 'guam-15': (144.66, 13.44), 'rota': (-6.35, 36.64),
    'loring-42': (-67.89, 46.95), 'mccoy-306': (-81.31, 28.43), 'kincheloe-449': (-84.47, 46.25), 'ki-sawyer-410': (-87.39, 46.35), 'columbus-454': (-88.44, 33.64), 'turner-484': (-84.19, 31.53), 'u-tapao': (101.00, 12.68), 'blytheville-97': (-89.94, 35.96),
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

    def add(rec, lid, query=None, pos=None):
        if pos is not None:
            lon, lat, hit, pe = pos[0], pos[1], 'hand-set', 'inferred'
        elif lid in HAND:
            lon, lat, hit, pe = HAND[lid][0], HAND[lid][1], 'hand-set', 'inferred'
        else:
            g = geocode(query)
            time.sleep(1.0)
            if not g:
                print('NO MATCH', lid, query)
                return
            lon, lat, hit = g
            pe = 'reconstructed'
        rec.update({'id': lid, 'lon': round(lon, 4), 'lat': round(lat, 4), 'geocoded': hit, 'positionEvidence': pe})
        sites.append(rec)
        print(lid, hit, round(lon, 3), round(lat, 3))

    for lid, name, query, sq in US_ICBM:
        add({'side': 'us', 'name': name, 'kind': 'icbm', 'missiles': sum(n for _, n, _, _ in sq), 'weapons': sum(n * w for _, n, w, _ in sq), 'squadrons': [{'missiles': n, 'version': v, 'warheads': w, 'yieldKt': kt} for v, n, w, kt in sq], 'note': US_ICBM_NOTE, 'evidence': 'reconstructed', 'source': f'{DATABOOK}; {WIKI}, LGM-30 Minuteman; LGM-25C Titan II'}, lid, query)
    for (lid, name, query), n in zip(B52_WINGS, spread(B52_TOTAL, len(B52_WINGS))):
        add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': 'B-52', 'aircraft': n, 'weaponsPerAircraft': B52_WEAPONS, 'yieldKt': B52_KT, 'note': US_BOMBER_NOTE, 'evidence': 'reconstructed', 'source': f'{DATABOOK}; {WIKI}, List of B-52 units'}, lid, query)
    for (lid, name, query), n in zip(B58_WINGS, spread(B58_TOTAL, len(B58_WINGS))):
        add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': 'B-58', 'aircraft': n, 'weaponsPerAircraft': B58_WEAPONS, 'yieldKt': B58_KT, 'note': US_BOMBER_NOTE, 'evidence': 'reconstructed', 'source': f'{DATABOOK}; {WIKI}, Convair B-58 Hustler'}, lid, query)
    for lid, name, pos, note, boats, tubes, warheads, kt in US_SSBN_AREAS:
        add({'side': 'us', 'name': name, 'kind': 'slbm', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': f'{note}. {US_SSBN_NOTE}', 'evidence': 'inferred', 'source': f'{DATABOOK}; {WIKI}, UGM-27 Polaris'}, lid, pos=pos)
    for lid, name, query, boats, tubes, warheads, kt in US_SSBN_PORTS:
        add({'side': 'us', 'name': name, 'kind': 'slbm-port', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': US_SSBN_NOTE, 'evidence': 'reconstructed', 'source': DATABOOK}, lid, query)

    for typ, (fields, total, warheads, kt) in SU_ICBM.items():
        for (lid, name, query), n in zip(fields, spread(total, len(fields))):
            add({'side': 'su', 'name': name, 'kind': 'icbm', 'missiles': n, 'weapons': n * warheads, 'squadrons': [{'missiles': n, 'version': typ, 'warheads': warheads, 'yieldKt': kt}], 'note': SU_ICBM_NOTE, 'evidence': 'inferred', 'source': f'{DATABOOK}; {NN}; {WIKI}, Strategic Rocket Forces'}, lid, query)
    for (lid, name, query, model), n in zip(SU_BOMBERS, spread(SU_BOMBER_TOTAL, len(SU_BOMBERS))):
        add({'side': 'su', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': n, 'weaponsPerAircraft': SU_BOMBER_WEAPONS, 'yieldKt': SU_BOMBER_KT, 'note': f'{SU_BOMBER_TOTAL} Long Range Aviation heavy bombers spread evenly over five fields', 'evidence': 'inferred', 'source': f'{DATABOOK}; {WIKI}, Soviet Long Range Aviation'}, lid, query)
    for lid, name, pos, note, boats, tubes, warheads, kt in SU_SSBN_AREAS:
        add({'side': 'su', 'name': name, 'kind': 'slbm', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': f'{note}. {SU_SSBN_NOTE}', 'evidence': 'inferred', 'source': DATABOOK}, lid, pos=pos)
    for lid, name, query, boats, tubes, warheads, kt in SU_SSBN_PORTS:
        add({'side': 'su', 'name': name, 'kind': 'slbm-port', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': SU_SSBN_NOTE, 'evidence': 'reconstructed', 'source': DATABOOK}, lid, query)

    out = {'date': 'end of 1967', 'note': 'The peak of the American stockpile and the thousandth Minuteman silo; the Soviet fields filling. No study stands on this epoch.', 'rules': {'usIcbm': US_ICBM_NOTE, 'usBombers': US_BOMBER_NOTE, 'usSsbn': US_SSBN_NOTE, 'suIcbm': SU_ICBM_NOTE, 'suSsbn': SU_SSBN_NOTE, 'stockpiles': NN}, 'sites': sites}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(sites), 'sites written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
