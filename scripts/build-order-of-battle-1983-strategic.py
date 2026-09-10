#!/usr/bin/env python3
"""Build the strategic order of battle of the United States and the Soviet Union in 1983.

The year of the window of vulnerability: the SS-18 Mod 4 fields complete,
Minuteman III refitted, Trident I at sea, Peacekeeper not yet, the bombers
taking their first cruise missiles. Totals per system follow the Nuclear
Weapons Databook vol. 1 (1984) and vol. 4 (1989) with the Nuclear Notebook
series, spread over the wings and divisions the unit histories name.
Loadings are the Databook's estimates. Everything here is reconstructed or
inferred and says so.

Usage: python3 scripts/build-order-of-battle-1983-strategic.py --out data/window83/order-of-battle-1983.json
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
NN = 'Cochran, Arkin and Hoenig, Nuclear Weapons Databook vol. 1 (1984) and vol. 4 (1989); Norris and Kristensen, Nuclear Notebook series, for 1983'

# --- United States -----------------------------------------------------------

# (id, name, query, [(version, missiles, warheads each, kt each)])
US_ICBM = [
    ('malmstrom-341', 'Malmstrom AFB · 341st SMW', 'Malmstrom Air Force Base', [('Minuteman II', 150, 1, 1_200), ('Minuteman III', 50, 3, 335)]),
    ('ellsworth-44', 'Ellsworth AFB · 44th SMW', 'Ellsworth Air Force Base', [('Minuteman II', 150, 1, 1_200)]),
    ('whiteman-351', 'Whiteman AFB · 351st SMW', 'Whiteman Air Force Base', [('Minuteman II', 150, 1, 1_200)]),
    ('minot-91', 'Minot AFB · 91st SMW', 'Minot Air Force Base', [('Minuteman III', 150, 3, 335)]),
    ('grand-forks-321', 'Grand Forks AFB · 321st SMW', 'Grand Forks Air Force Base', [('Minuteman III', 150, 3, 335)]),
    ('warren-90', 'F. E. Warren AFB · 90th SMW', 'Francis E. Warren Air Force Base', [('Minuteman III', 200, 3, 170)]),
    ('davis-monthan-390', 'Davis-Monthan AFB · 390th SMW', 'Davis-Monthan Air Force Base', [('Titan II', 15, 1, 9_000)]),
    ('little-rock-308', 'Little Rock AFB · 308th SMW', 'Little Rock Air Force Base', [('Titan II', 15, 1, 9_000)]),
    ('mcconnell-381', 'McConnell AFB · 381st SMW', 'McConnell Air Force Base', [('Titan II', 15, 1, 9_000)]),
]
US_ICBM_NOTE = '1,000 Minuteman and 45 Titan II in 1983 (Databook vol. 1): 450 Minuteman II, 550 Minuteman III with the W78 on the refitted wings and the W62 at Warren; the Titans deactivating from 1982'

# Fleet ballistic missiles: Poseidon boats leaving service, Trident I on converted Franklins and Madisons and the first Ohios, Trident II on the newest.
# Bases from the Databook; boats at sea and their areas inferred from the usual deployment rate.
US_SSBN_AREAS = [
    ('ssbn-atlantic', 'Poseidon and Trident I patrol · North Atlantic', (-45.0, 45.0), 'Boats from Charleston, Kings Bay and Holy Loch', 12, 16, 9, 60),
    ('ssbn-pacific', 'Trident I patrol · North Pacific', (-160.0, 45.0), 'The first Ohios from Bangor', 2, 24, 8, 100),
]
US_SSBN_PORTS = [
    ('charleston', 'Naval Weapons Station Charleston · Poseidon', 'Goose Creek, South Carolina', 8, 16, 10, 40),
    ('kings-bay', 'Kings Bay · Trident I refit boats', 'Naval Submarine Base Kings Bay', 4, 16, 8, 100),
    ('holy-loch', 'Holy Loch · Submarine Squadron 14', 'Dunoon', 6, 16, 10, 40),
    ('bangor', 'Bangor · Ohio-class', 'Naval Base Kitsap', 1, 24, 8, 100),
]
US_SSBN_NOTE = '33 boats in 1983: nineteen with Poseidon C-3 (ten W68 of 40 kt), twelve refitted with Trident I C-4 (eight W76 of 100 kt), two Ohios (Databook vol. 1); fourteen at sea and the areas inferred; the loading per boat at sea an average'

# Bombers: B-52G and H, B-1B, FB-111A in its last months; weapons as the Notebook counts them (cruise missiles and gravity bombs). No alert after 28 September 1991.
US_BOMBERS = [
    ('barksdale-2', 'Barksdale AFB · 2nd BW', 'Barksdale Air Force Base', 'B-52G', 19, 8, 1_100),
    ('castle-93', 'Castle AFB · 93rd BW', 'Castle Airport', 'B-52G', 19, 8, 1_100),
    ('loring-42', 'Loring AFB · 42nd BW', 'Loring International Airport', 'B-52G', 19, 8, 1_100),
    ('wurtsmith-379', 'Wurtsmith AFB · 379th BW', 'Oscoda-Wurtsmith Airport', 'B-52G', 19, 8, 1_100),
    ('griffiss-416', 'Griffiss AFB · 416th BW', 'Griffiss International Airport', 'B-52G', 19, 12, 200),
    ('eaker-97', 'Blytheville AFB · 97th BW', 'Arkansas International Airport', 'B-52G', 19, 8, 1_100),
    ('mather-320', 'Mather AFB · 320th BW', 'Sacramento Mather Airport', 'B-52G', 19, 8, 1_100),
    ('seymour-johnson-68', 'Seymour Johnson AFB · 68th BW', 'Seymour Johnson Air Force Base', 'B-52G', 19, 8, 1_100),
    ('robins-19', 'Robins AFB · 19th BW', 'Robins Air Force Base', 'B-52G', 19, 8, 1_100),
    ('andersen-43', 'Andersen AFB · 43rd BW', 'Andersen Air Force Base', 'B-52D', 15, 4, 1_100),
    ('fairchild-92', 'Fairchild AFB · 92nd BW', 'Fairchild Air Force Base', 'B-52H', 19, 8, 1_100),
    ('minot-5', 'Minot AFB · 5th BW', 'Minot Air Force Base', 'B-52H', 19, 8, 1_100),
    ('carswell-7', 'Carswell AFB · 7th BW', 'Naval Air Station Joint Reserve Base Fort Worth', 'B-52H', 19, 8, 1_100),
    ('ki-sawyer-410', 'K. I. Sawyer AFB · 410th BW', 'Sawyer International Airport', 'B-52H', 19, 8, 1_100),
    ('grand-forks-319', 'Grand Forks AFB · 319th BW', 'Grand Forks Air Force Base', 'B-52H', 19, 12, 200),
    ('ellsworth-28', 'Ellsworth AFB · 28th BW', 'Ellsworth Air Force Base', 'B-52H', 19, 8, 1_100),
    ('dyess-96', 'Dyess AFB · 96th BW', 'Dyess Air Force Base', 'B-52H', 19, 8, 1_100),
    ('pease-509', 'Pease AFB · 509th BW', 'Portsmouth International Airport at Pease', 'FB-111A', 30, 6, 170),
    ('plattsburgh-380', 'Plattsburgh AFB · 380th BW', 'Plattsburgh International Airport', 'FB-111A', 30, 6, 170),
]
US_BOMBER_NOTE = 'About 340 B-52 and 60 FB-111A in 1983 (Databook vol. 1), spread over the wings the unit lists name; eight gravity bombs and short-range missiles per B-52, twelve cruise missiles on the first two wings converted, six per FB-111A; about a third of the force on ground alert'

# --- Soviet Union ------------------------------------------------------------

# Notebook end-of-1991 launcher totals by type: SS-11 326, SS-13 40, SS-17 47, SS-18 308, SS-19 300, SS-24 89 (56 silo, 33 rail), SS-25 288; about 1,400 launchers and 6,600 warheads.
# Divisions from the rocket-army histories (Wikipedia, Strategic Rocket Forces; Podvig, Russian Strategic Nuclear Forces, 2001). Launchers spread evenly over the divisions fielding each type.
SU_ICBM = {
    'SS-18': ([('dombarovsky', 'Dombarovsky · 13th Rocket Division', 'Dombarovsky, Orenburg Oblast'), ('kartaly', 'Kartaly · 59th Rocket Division', 'Kartaly, Chelyabinsk Oblast'), ('uzhur', 'Uzhur · 62nd Rocket Division', 'Uzhur, Krasnoyarsk Krai'), ('aleysk', 'Aleysk · 41st Guards Rocket Division', 'Aleysk, Altai Krai'), ('zhangiz-tobe', 'Zhangiz-Tobe · 57th Rocket Division', 'Zhangiztobe, Kazakhstan'), ('derzhavinsk', 'Derzhavinsk · 38th Rocket Division', 'Derzhavinsk, Kazakhstan')], 308, 10, 500),
    'SS-19': ([('kozelsk', 'Kozelsk · 28th Guards Rocket Division', 'Kozelsk, Kaluga Oblast'), ('tatishchevo', 'Tatishchevo · 60th Rocket Division', 'Tatishchevo, Saratov Oblast'), ('pervomaysk', 'Pervomaysk · 46th Rocket Division', 'Pervomaisk, Mykolaiv Oblast'), ('khmelnytskyi', 'Khmelnytskyi · 19th Rocket Division', 'Khmelnytskyi')], 360, 6, 550),
    'SS-17': ([('kostroma', 'Kostroma · 10th Guards Rocket Division', 'Kostroma'), ('yedrovo', 'Yedrovo · 7th Guards Rocket Division', 'Bologoye, Tver Oblast')], 150, 4, 750),
    'SS-11': ([('teykovo', 'Teykovo · 54th Guards Rocket Division', 'Teykovo, Ivanovo Oblast'), ('bershet', 'Bershet · 52nd Rocket Division', 'Bershet, Perm Krai'), ('gladkaya', 'Gladkaya · 36th Guards Rocket Division', 'Kedrovy, Krasnoyarsk Krai'), ('svobodny', 'Svobodny · 27th Rocket Division', 'Svobodny, Amur Oblast'), ('olovyannaya', 'Olovyannaya · 47th Rocket Division', 'Olovyannaya, Zabaykalsky Krai'), ('drovyanaya', 'Drovyanaya · 4th Rocket Division', 'Drovyanaya, Zabaykalsky Krai'), ('yasny', 'Yasny · Orenburg fields', 'Yasny, Orenburg Oblast')], 520, 1, 1_000),
    'SS-13': ([('yoshkar-ola', 'Yoshkar-Ola · 14th Rocket Division', 'Yoshkar-Ola')], 60, 1, 750),
}

# Ballistic-missile submarines: about 59 boats and 2,800 warheads at the end of 1991 (Notebook); Northern Fleet at Gadzhiyevo, Nerpichya and Yagelnaya, Pacific at Rybachiy.
SU_SSBN_AREAS = [
    ('su-ssbn-barents', 'Delta patrol · Barents Sea bastion', (38.0, 73.0), 'Boats of the Northern Fleet', 6, 16, 2, 300),
    ('su-ssbn-atlantic', 'Yankee patrol · western Atlantic', (-65.0, 33.0), 'The boats off the American coast, ten minutes from the bomber bases', 3, 16, 1, 1_000),
    ('su-ssbn-pacific-coast', 'Yankee patrol · off the Pacific coast', (-135.0, 40.0), 'Off the Pacific coast', 2, 16, 1, 1_000),
    ('su-ssbn-okhotsk', 'Delta patrol · Sea of Okhotsk bastion', (150.0, 54.0), 'Boats of the Pacific Fleet', 3, 16, 2, 300),
]
SU_SSBN_PORTS = [
    ('gadzhiyevo', 'Gadzhiyevo · Northern Fleet', 'Gadzhiyevo', 30, 16, 2, 300),
    ('rybachiy', 'Rybachiy · Pacific Fleet', 'Vilyuchinsk', 18, 16, 2, 300),
]
SU_SSBN_NOTE = 'About 62 boats and 940 tubes in 1983 (Databook vol. 4): Yankees with single-warhead R-27s forward off the American coasts, Deltas with R-29s in the bastions; fourteen at sea and the areas inferred'

# Long Range Aviation heavy bombers: about 160 (Tu-95 and Tu-160), at fields in Russia, Ukraine and Kazakhstan.
SU_BOMBERS = [
    ('ukrainka', 'Ukrainka · 73rd Heavy Bomber Division', 'Seryshevo, Amur Oblast', 'Tu-95', 40, 2, 1_000),
    ('mozdok', 'Mozdok · 182nd Guards Regiment', 'Mozdok', 'Tu-95', 25, 2, 1_000),
    ('uzin', 'Uzin · 106th Heavy Bomber Division', 'Uzyn, Kyiv Oblast', 'Tu-95', 30, 2, 1_000),
    ('semipalatinsk', 'Semipalatinsk · 79th Heavy Bomber Division', 'Semey', 'Tu-95', 40, 2, 1_000),
    ('engels', 'Engels · 201st Heavy Bomber Division', 'Engels, Saratov Oblast', 'M-4/3M', 30, 2, 1_000),
]

HAND = {
    'yedrovo': (33.80, 57.85), 'yasny': (59.87, 51.04),
    'dombarovsky': (59.53, 50.76), 'kartaly': (60.65, 53.05), 'uzhur': (89.83, 55.30), 'aleysk': (82.78, 52.49), 'zhangiz-tobe': (81.20, 49.20), 'derzhavinsk': (66.32, 51.10),
    'kozelsk': (35.79, 54.04), 'tatishchevo': (45.60, 51.67), 'pervomaysk': (30.85, 48.05), 'khmelnytskyi': (26.98, 49.42), 'pervomaysk-24': (30.85, 48.05),
    'kostroma': (40.93, 57.77), 'bershet': (57.77, 57.73), 'krasnoyarsk': (91.75, 56.17),
    'teykovo': (40.54, 56.86), 'teykovo-11': (40.54, 56.86), 'yoshkar-ola': (47.89, 56.63), 'yoshkar-ola-13': (47.89, 56.63), 'vypolzovo': (33.80, 57.85), 'vypolzovo-17': (33.80, 57.85), 'yurya': (49.32, 59.05),
    'nizhny-tagil': (60.55, 58.05), 'novosibirsk': (83.02, 55.18), 'irkutsk': (104.28, 52.29), 'barnaul': (83.62, 53.28), 'kansk': (95.72, 56.20), 'drovyanaya': (113.05, 51.60), 'lida': (25.30, 53.89), 'mozyr': (29.25, 52.05),
    'gladkaya': (91.75, 56.17), 'svobodny': (128.32, 51.45), 'olovyannaya': (115.58, 50.95),
    'gadzhiyevo': (33.33, 69.25), 'rybachiy': (158.40, 52.93),
    'ukrainka': (124.24, 51.17), 'mozdok': (44.60, 43.79), 'uzin': (30.42, 49.83), 'semipalatinsk': (79.15, 50.45), 'priluki': (32.39, 50.59), 'engels': (46.20, 51.48),
    'holy-loch': (-4.93, 55.98), 'charleston': (-79.95, 32.97), 'eaker-97': (-89.94, 35.96), 'loring-42': (-67.89, 46.95), 'ki-sawyer-410': (-87.39, 46.35), 'mcconnell-384': (-97.27, 37.62),
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

    def add(rec, lid, query=None, pos=None):
        if pos is not None:
            lon, lat, hit, pe = pos[0], pos[1], 'hand-set', 'inferred'
        else:
            p = place(lid, query)
            if not p:
                return
            lon, lat, hit = p
            pe = 'inferred' if hit == 'hand-set' else 'reconstructed'
        rec.update({'id': lid, 'lon': round(lon, 4), 'lat': round(lat, 4), 'geocoded': hit, 'positionEvidence': pe})
        sites.append(rec)
        print(lid, hit, round(lon, 3), round(lat, 3))

    for lid, name, query, sq in US_ICBM:
        add({'side': 'us', 'name': name, 'kind': 'icbm', 'missiles': sum(n for _, n, _, _ in sq), 'weapons': sum(n * w for _, n, w, _ in sq), 'squadrons': [{'missiles': n, 'version': v, 'warheads': w, 'yieldKt': kt} for v, n, w, kt in sq], 'note': US_ICBM_NOTE, 'evidence': 'reconstructed', 'source': f'{NN}; {WIKI}, LGM-30 Minuteman; LGM-118 Peacekeeper'}, lid, query)
    for lid, name, pos, note, boats, tubes, warheads, kt in US_SSBN_AREAS:
        add({'side': 'us', 'name': name, 'kind': 'slbm', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': f'{note}. {US_SSBN_NOTE}', 'evidence': 'inferred', 'source': NN}, lid, pos=pos)
    for lid, name, query, boats, tubes, warheads, kt in US_SSBN_PORTS:
        add({'side': 'us', 'name': name, 'kind': 'slbm-port', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': US_SSBN_NOTE, 'evidence': 'reconstructed', 'source': f'{NN}; Databook vol. 1'}, lid, query)
    for lid, name, query, model, aircraft, weapons, kt in US_BOMBERS:
        add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': aircraft, 'weaponsPerAircraft': weapons, 'yieldKt': kt, 'alert': 0.0, 'note': US_BOMBER_NOTE, 'evidence': 'reconstructed', 'source': f'{NN}; {WIKI}, List of B-52 units; Rockwell B-1 Lancer; General Dynamics F-111'}, lid, query)

    for typ, (fields, total, warheads, kt) in SU_ICBM.items():
        for (lid, name, query), n in zip(fields, spread(total, len(fields))):
            add({'side': 'su', 'name': name, 'kind': 'icbm', 'missiles': n, 'weapons': n * warheads, 'squadrons': [{'missiles': n, 'version': typ, 'warheads': warheads, 'yieldKt': kt}], 'note': f'{total} {typ} launchers spread evenly over {len(fields)} division{"s" if len(fields) > 1 else ""}; {warheads} warhead{"s" if warheads > 1 else ""} of about {kt} kt each', 'evidence': 'inferred', 'source': f'{NN}; {WIKI}, Strategic Rocket Forces; Podvig, Russian Strategic Nuclear Forces (2001)'}, lid, query)
    for lid, name, pos, note, boats, tubes, warheads, kt in SU_SSBN_AREAS:
        add({'side': 'su', 'name': name, 'kind': 'slbm', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': f'{note}. {SU_SSBN_NOTE}', 'evidence': 'inferred', 'source': NN}, lid, pos=pos)
    for lid, name, query, boats, tubes, warheads, kt in SU_SSBN_PORTS:
        add({'side': 'su', 'name': name, 'kind': 'slbm-port', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': SU_SSBN_NOTE, 'evidence': 'reconstructed', 'source': f'{NN}; Databook vol. 4'}, lid, query)
    for lid, name, query, model, aircraft, weapons, kt in SU_BOMBERS:
        add({'side': 'su', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': aircraft, 'weaponsPerAircraft': weapons, 'yieldKt': kt, 'alert': 0.0, 'note': 'About 165 Long Range Aviation heavy bombers in 1983 (Databook vol. 4) spread over the fields the division histories name; two weapons each', 'evidence': 'inferred', 'source': f'{NN}; {WIKI}, Soviet Long Range Aviation'}, lid, query)

    out = {
        'date': '1983',
        'note': 'The forces of the window of vulnerability, spread from the Databook and Notebook totals over the wings and divisions the unit histories name; loadings are the Databook estimates.',
        'rules': {
            'usIcbm': {'launchers': 1045, 'note': US_ICBM_NOTE},
            'usSsbn': {'boats': 33, 'note': US_SSBN_NOTE},
            'usBombers': {'note': US_BOMBER_NOTE, 'groundAlert': 0.3},
            'suIcbm': {k: {'launchers': v[1], 'divisions': len(v[0]), 'warheads': v[2], 'yieldKt': v[3]} for k, v in SU_ICBM.items()},
            'suSsbn': {'boats': 62, 'note': SU_SSBN_NOTE},
            'siloPsi': 2000,
            'accuracy': {'SS-18': {'cepMetres': 250, 'yieldKt': 500}, 'SS-19': {'cepMetres': 300, 'yieldKt': 550}, 'source': 'The accuracy lab\'s published estimates: Databook vol. 4; MacKenzie, Inventing Accuracy (1990)'},
        },
        'sites': sites,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(sites), 'sites written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
