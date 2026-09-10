#!/usr/bin/env python3
"""Build the strategic order of battle of the United States and the Soviet Union at the end of 1991.

The epoch the posture atlas lacked: the peak force at the moment the
drawdown began. START I was signed in July, the Presidential Nuclear
Initiatives of September took the bombers off alert, and the union
dissolved in December with its rocket divisions in four republics. Totals
per system follow the Nuclear Notebook's end-of-1991 tables (Norris and
Arkin, Bulletin of the Atomic Scientists, 1992) as the open literature
reprints them, spread over the wings and divisions the unit histories name.
Loadings are the Notebook's estimates. Everything here is reconstructed or
inferred and says so; there is no study behind it.

Usage: python3 scripts/build-order-of-battle-1991.py --out data/chronicle/order-of-battle-1991.json
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
NN = 'Norris and Arkin, "Nuclear Notebook: U.S. strategic nuclear forces, end of 1991" and "Soviet strategic nuclear forces, end of 1991," Bulletin of the Atomic Scientists (1992), as reprinted; Cochran, Arkin and Hoenig, Nuclear Weapons Databook vol. 1 (1984) and vol. 4 (1989) for the bases'

# --- United States -----------------------------------------------------------

# (id, name, query, [(version, missiles, warheads each, kt each)])
US_ICBM = [
    ('malmstrom-341', 'Malmstrom AFB · 341st Missile Wing', 'Malmstrom Air Force Base', [('Minuteman II', 150, 1, 1_200), ('Minuteman III', 50, 3, 335)]),
    ('ellsworth-44', 'Ellsworth AFB · 44th Missile Wing', 'Ellsworth Air Force Base', [('Minuteman II', 150, 1, 1_200)]),
    ('whiteman-351', 'Whiteman AFB · 351st Missile Wing', 'Whiteman Air Force Base', [('Minuteman II', 150, 1, 1_200)]),
    ('minot-91', 'Minot AFB · 91st Missile Wing', 'Minot Air Force Base', [('Minuteman III', 150, 3, 335)]),
    ('grand-forks-321', 'Grand Forks AFB · 321st Missile Wing', 'Grand Forks Air Force Base', [('Minuteman III', 150, 3, 335)]),
    ('warren-90', 'F. E. Warren AFB · 90th Missile Wing', 'Francis E. Warren Air Force Base', [('Minuteman III', 150, 3, 170), ('Peacekeeper', 50, 10, 300)]),
]
US_ICBM_NOTE = '1,000 ICBMs: 450 Minuteman II, 500 Minuteman III, 50 Peacekeeper; the Minuteman IIs stood down from alert under the September 1991 initiative and are counted as they stood'

# Fleet ballistic missiles: Poseidon boats leaving service, Trident I on converted Franklins and Madisons and the first Ohios, Trident II on the newest.
# Bases from the Databook; boats at sea and their areas inferred from the usual deployment rate.
US_SSBN_AREAS = [
    ('ssbn-atlantic', 'Trident and Poseidon patrol · North Atlantic', (-45.0, 45.0), 'Boats from Charleston, Kings Bay and Holy Loch', 8, 16, 8, 100),
    ('ssbn-pacific', 'Trident patrol · North Pacific', (-160.0, 45.0), 'Boats from Bangor', 4, 24, 8, 100),
]
US_SSBN_PORTS = [
    ('charleston', 'Naval Weapons Station Charleston · Poseidon and Trident I', 'Goose Creek, South Carolina', 8, 16, 8, 100),
    ('kings-bay', 'Naval Submarine Base Kings Bay · Trident II', 'Naval Submarine Base Kings Bay', 4, 24, 8, 455),
    ('bangor', 'Naval Submarine Base Bangor · Trident I', 'Naval Base Kitsap', 4, 24, 8, 100),
    ('holy-loch', 'Holy Loch · Submarine Squadron 14', 'Dunoon', 4, 16, 8, 100),
]
US_SSBN_NOTE = 'About 32 boats and 5,700 warheads at the end of 1991 (Notebook); boats spread over the bases as the squadron histories place them, half at sea, the loadings the Notebook\'s averages'

# Bombers: B-52G and H, B-1B, FB-111A in its last months; weapons as the Notebook counts them (cruise missiles and gravity bombs). No alert after 28 September 1991.
US_BOMBERS = [
    ('barksdale-2', 'Barksdale AFB · 2nd Bomb Wing', 'Barksdale Air Force Base', 'B-52G', 28, 12, 200),
    ('castle-93', 'Castle AFB · 93rd Bomb Wing', 'Castle Airport', 'B-52G', 26, 12, 200),
    ('loring-42', 'Loring AFB · 42nd Bomb Wing', 'Loring International Airport', 'B-52G', 26, 12, 200),
    ('wurtsmith-379', 'Wurtsmith AFB · 379th Bomb Wing', 'Oscoda-Wurtsmith Airport', 'B-52G', 26, 12, 200),
    ('griffiss-416', 'Griffiss AFB · 416th Bomb Wing', 'Griffiss International Airport', 'B-52G', 26, 12, 200),
    ('eaker-97', 'Eaker AFB · 97th Bomb Wing', 'Arkansas International Airport', 'B-52G', 26, 12, 200),
    ('fairchild-92', 'Fairchild AFB · 92nd Bomb Wing', 'Fairchild Air Force Base', 'B-52H', 24, 12, 200),
    ('minot-5', 'Minot AFB · 5th Bomb Wing', 'Minot Air Force Base', 'B-52H', 24, 12, 200),
    ('carswell-7', 'Carswell AFB · 7th Bomb Wing', 'Naval Air Station Joint Reserve Base Fort Worth', 'B-52H', 24, 12, 200),
    ('ki-sawyer-410', 'K. I. Sawyer AFB · 410th Bomb Wing', 'Sawyer International Airport', 'B-52H', 24, 12, 200),
    ('dyess-96', 'Dyess AFB · 96th Bomb Wing', 'Dyess Air Force Base', 'B-1B', 24, 16, 200),
    ('ellsworth-28', 'Ellsworth AFB · 28th Bomb Wing', 'Ellsworth Air Force Base', 'B-1B', 24, 16, 200),
    ('grand-forks-319', 'Grand Forks AFB · 319th Bomb Wing', 'Grand Forks Air Force Base', 'B-1B', 24, 16, 200),
    ('mcconnell-384', 'McConnell AFB · 384th Bomb Wing', 'McConnell Air Force Base', 'B-1B', 24, 16, 200),
    ('pease-509', 'Pease AFB · 509th Bomb Wing', 'Portsmouth International Airport at Pease', 'FB-111A', 30, 6, 170),
    ('plattsburgh-380', 'Plattsburgh AFB · 380th Bomb Wing', 'Plattsburgh International Airport', 'FB-111A', 30, 6, 170),
]
US_BOMBER_NOTE = 'About 280 heavy bombers and 60 FB-111As (Notebook); wing strengths spread from the fleet totals over the wings the unit histories list; twelve weapons per B-52 (cruise missiles and bombs), sixteen per B-1B, six per FB-111A, the Notebook\'s loadings'

# --- Soviet Union ------------------------------------------------------------

# Notebook end-of-1991 launcher totals by type: SS-11 326, SS-13 40, SS-17 47, SS-18 308, SS-19 300, SS-24 89 (56 silo, 33 rail), SS-25 288; about 1,400 launchers and 6,600 warheads.
# Divisions from the rocket-army histories (Wikipedia, Strategic Rocket Forces; Podvig, Russian Strategic Nuclear Forces, 2001). Launchers spread evenly over the divisions fielding each type.
SU_ICBM = {
    'SS-18': ([('dombarovsky', 'Dombarovsky · 13th Rocket Division', 'Dombarovsky, Orenburg Oblast'), ('kartaly', 'Kartaly · 59th Rocket Division', 'Kartaly, Chelyabinsk Oblast'), ('uzhur', 'Uzhur · 62nd Rocket Division', 'Uzhur, Krasnoyarsk Krai'), ('aleysk', 'Aleysk · 41st Guards Rocket Division', 'Aleysk, Altai Krai'), ('zhangiz-tobe', 'Zhangiz-Tobe · 57th Rocket Division', 'Zhangiztobe, Kazakhstan'), ('derzhavinsk', 'Derzhavinsk · 38th Rocket Division', 'Derzhavinsk, Kazakhstan')], 308, 10, 550),
    'SS-19': ([('kozelsk', 'Kozelsk · 28th Guards Rocket Division', 'Kozelsk, Kaluga Oblast'), ('tatishchevo', 'Tatishchevo · 60th Rocket Division', 'Tatishchevo, Saratov Oblast'), ('pervomaysk', 'Pervomaysk · 46th Rocket Division', 'Pervomaisk, Mykolaiv Oblast'), ('khmelnytskyi', 'Khmelnytskyi · 19th Rocket Division', 'Khmelnytskyi')], 300, 6, 550),
    'SS-24': ([('kostroma', 'Kostroma · 10th Guards Rocket Division · rail', 'Kostroma'), ('bershet', 'Bershet · 52nd Rocket Division · rail', 'Bershet, Perm Krai'), ('krasnoyarsk', 'Krasnoyarsk · 36th Guards Rocket Division · rail', 'Kedrovy, Krasnoyarsk Krai'), ('pervomaysk-24', 'Pervomaysk · 46th Rocket Division · silo', 'Pervomaisk, Mykolaiv Oblast')], 89, 10, 400),
    'SS-25': ([('teykovo', 'Teykovo · 54th Guards Rocket Division', 'Teykovo, Ivanovo Oblast'), ('yoshkar-ola', 'Yoshkar-Ola · 14th Rocket Division', 'Yoshkar-Ola'), ('vypolzovo', 'Vypolzovo · 7th Guards Rocket Division', 'Bologoye, Tver Oblast'), ('yurya', 'Yurya · 8th Rocket Division', 'Yurya, Kirov Oblast'), ('nizhny-tagil', 'Nizhny Tagil · 42nd Rocket Division', 'Verkhnyaya Salda'), ('novosibirsk', 'Novosibirsk · 39th Guards Rocket Division', 'Pashino, Novosibirsk'), ('irkutsk', 'Irkutsk · 29th Guards Rocket Division', 'Irkutsk'), ('barnaul', 'Barnaul · 35th Rocket Division', 'Sibirsky, Altai Krai'), ('kansk', 'Kansk · 23rd Guards Rocket Division', 'Kansk'), ('drovyanaya', 'Drovyanaya · 4th Rocket Division', 'Drovyanaya, Zabaykalsky Krai'), ('lida', 'Lida · 49th Guards Rocket Division', 'Lida, Belarus'), ('mozyr', 'Mozyr · 33rd Guards Rocket Division', 'Mazyr, Belarus')], 288, 1, 550),
    'SS-11': ([('gladkaya', 'Gladkaya · 36th Guards Rocket Division', 'Kedrovy, Krasnoyarsk Krai'), ('svobodny', 'Svobodny · 27th Rocket Division', 'Svobodny, Amur Oblast'), ('olovyannaya', 'Olovyannaya · 47th Rocket Division', 'Olovyannaya, Zabaykalsky Krai'), ('teykovo-11', 'Teykovo · 54th Guards Rocket Division · silos', 'Teykovo, Ivanovo Oblast')], 326, 1, 1_000),
    'SS-17': ([('vypolzovo-17', 'Vypolzovo · 7th Guards Rocket Division · silos', 'Bologoye, Tver Oblast')], 47, 4, 750),
    'SS-13': ([('yoshkar-ola-13', 'Yoshkar-Ola · 14th Rocket Division · silos', 'Yoshkar-Ola')], 40, 1, 750),
}

# Ballistic-missile submarines: about 59 boats and 2,800 warheads at the end of 1991 (Notebook); Northern Fleet at Gadzhiyevo, Nerpichya and Yagelnaya, Pacific at Rybachiy.
SU_SSBN_AREAS = [
    ('su-ssbn-barents', 'Delta and Typhoon patrol · Barents Sea', (38.0, 73.0), 'Boats of the Northern Fleet', 4, 16, 4, 100),
    ('su-ssbn-okhotsk', 'Delta patrol · Sea of Okhotsk', (150.0, 54.0), 'Boats of the Pacific Fleet', 2, 16, 4, 100),
]
SU_SSBN_PORTS = [
    ('gadzhiyevo', 'Gadzhiyevo · Northern Fleet', 'Gadzhiyevo', 30, 16, 3, 100),
    ('rybachiy', 'Rybachiy · Pacific Fleet', 'Vilyuchinsk', 23, 16, 3, 100),
]
SU_SSBN_NOTE = 'Fifty-nine boats from Yankee to Typhoon; the loading per missile is the fleet average; six boats at sea is an inference'

# Long Range Aviation heavy bombers: about 160 (Tu-95 and Tu-160), at fields in Russia, Ukraine and Kazakhstan.
SU_BOMBERS = [
    ('ukrainka', 'Ukrainka · 73rd Heavy Bomber Division', 'Seryshevo, Amur Oblast', 'Tu-95MS', 40, 8, 250),
    ('mozdok', 'Mozdok · 182nd Guards Regiment', 'Mozdok', 'Tu-95MS', 20, 8, 250),
    ('uzin', 'Uzin · 106th Heavy Bomber Division', 'Uzyn, Kyiv Oblast', 'Tu-95MS', 25, 8, 250),
    ('semipalatinsk', 'Semipalatinsk · 79th Heavy Bomber Division', 'Semey', 'Tu-95MS', 40, 8, 250),
    ('priluki', 'Priluki · 184th Guards Regiment', 'Pryluky', 'Tu-160', 19, 12, 250),
    ('engels', 'Engels · 1096th Regiment', 'Engels, Saratov Oblast', 'Tu-160', 6, 12, 250),
]

HAND = {
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
        add({'side': 'su', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': aircraft, 'weaponsPerAircraft': weapons, 'yieldKt': kt, 'alert': 0.0, 'note': 'About 160 heavy bombers (Notebook) spread over the fields the division histories name; Kh-55 cruise missiles as the loading', 'evidence': 'inferred', 'source': f'{NN}; {WIKI}, Soviet Long Range Aviation'}, lid, query)

    out = {
        'date': 'end of 1991',
        'note': 'The force at the start of the drawdown: START I signed in July, the bombers off alert from September, the union dissolved in December with rocket divisions in Ukraine, Belarus and Kazakhstan. No study is built on this epoch; it exists so the posture atlas can show the 1990s.',
        'rules': {
            'usIcbm': {'launchers': 1000, 'note': US_ICBM_NOTE},
            'usSsbn': {'boats': 32, 'note': US_SSBN_NOTE},
            'usBombers': {'note': US_BOMBER_NOTE},
            'suIcbm': {k: {'launchers': v[1], 'divisions': len(v[0]), 'warheads': v[2], 'yieldKt': v[3]} for k, v in SU_ICBM.items()},
            'suSsbn': {'boats': 59, 'note': SU_SSBN_NOTE},
        },
        'sites': sites,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(sites), 'sites written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
