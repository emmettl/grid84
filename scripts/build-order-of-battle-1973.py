#!/usr/bin/env python3
"""Build the strategic order of battle of both sides for 24 October 1973.

American wings and bases come from Wikipedia's unit histories (the six
Minuteman wings with their conversion dates, the three Titan II wings, the
B-52 and FB-111 wings active in 1973); Soviet divisions and fields from the
rocket-army and missile articles, with the launcher totals per type from
the same pages; Long Range Aviation from the Tu-95 unit list and the CIA's
count of 195 bombers at five fields. Positions are geocoded from the modern
map through Photon, with hand-set coordinates for patrol areas and closed
bases. Strengths follow stated rules recorded in the output.

Usage: python3 scripts/build-order-of-battle-1973.py --out data/defcon3/order-of-battle-1973.json
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

# --- United States ---------------------------------------------------------

# Minuteman: (id, name, query, missiles, version, note, source)
# Yields: Minuteman II W56 1.2 Mt; Minuteman III three W62 of 170 kt; Minuteman I W59 1 Mt (Databook vol. 1).
MINUTEMAN = [
    ('malmstrom-341', 'Malmstrom AFB · 341st SMW', 'Malmstrom Air Force Base', [(200, 'MM II')], '10th, 12th, 490th SMS with 150 and the 564th with 50; all Minuteman II by June 1969, the 564th to Minuteman III only in 1975', f'{WIKI}, 341st Missile Wing'),
    ('ellsworth-44', 'Ellsworth AFB · 44th SMW', 'Ellsworth Air Force Base', [(150, 'MM II')], 'Force Modernization from Minuteman I to II, October 1971 to March 1973', f'{WIKI}, 44th Missile Wing'),
    ('whiteman-351', 'Whiteman AFB · 351st SMW', 'Whiteman Air Force Base', [(150, 'MM II')], 'Minuteman II since October 1967', f'{WIKI}, 351st Missile Wing'),
    ('minot-91', 'Minot AFB · 91st SMW', 'Minot Air Force Base', [(150, 'MM III')], 'Minuteman III from 1972', f'{WIKI}, 91st Missile Wing'),
    ('grand-forks-321', 'Grand Forks AFB · 321st SMW', 'Grand Forks Air Force Base', [(150, 'MM III')], 'Converted to Minuteman III, December 1971 to March 1973', f'{WIKI}, 321st Missile Wing'),
    ('warren-90', 'F.E. Warren AFB · 90th SMW', 'Francis E. Warren Air Force Base', [(150, 'MM I'), (50, 'MM III')], 'Changeout from Minuteman I to III began June 1973 and completed October 1974; the 400th SMS first. Fifty converted by 24 October is a straight-line reconstruction', f'{WIKI}, 90th Missile Wing'),
]
MM_YIELD = {'MM I': (1, 1_000), 'MM II': (1, 1_200), 'MM III': (3, 170)}  # (warheads per missile, kt each)

TITAN = [
    ('davis-monthan-390', 'Davis-Monthan AFB · 390th SMW', 'Davis-Monthan Air Force Base'),
    ('little-rock-308', 'Little Rock AFB · 308th SMW', 'Little Rock Air Force Base'),
    ('mcconnell-381', 'McConnell AFB · 381st SMW', 'McConnell Air Force Base'),
]
TITAN_PER_WING = 18
TITAN_YIELD_KT = 9_000  # W53

# B-52 wings active in October 1973 (Wikipedia, List of B-52 units), with the model.
B52_WINGS = [
    ('barksdale-2', 'Barksdale AFB · 2nd BW', 'Barksdale Air Force Base', 'B-52G'),
    ('minot-5', 'Minot AFB · 5th BW', 'Minot Air Force Base', 'B-52H'),
    ('carswell-7', 'Carswell AFB · 7th BW', 'Naval Air Station Joint Reserve Base Fort Worth', 'B-52D'),
    ('robins-19', 'Robins AFB · 19th BW', 'Robins Air Force Base', 'B-52G'),
    ('march-22', 'March AFB · 22nd BW', 'March Air Reserve Base', 'B-52D'),
    ('ellsworth-28', 'Ellsworth AFB · 28th BW', 'Ellsworth Air Force Base', 'B-52G'),
    ('loring-42', 'Loring AFB · 42nd BW', 'Loring International Airport', 'B-52G'),
    ('seymour-johnson-68', 'Seymour Johnson AFB · 68th BW', 'Seymour Johnson Air Force Base', 'B-52G'),
    ('fairchild-92', 'Fairchild AFB · 92nd BW', 'Fairchild Air Force Base', 'B-52G'),
    ('castle-93', 'Castle AFB · 93rd BW', 'Castle Airport', 'B-52G'),
    ('dyess-96', 'Dyess AFB · 96th BW', 'Dyess Air Force Base', 'B-52D'),
    ('blytheville-97', 'Blytheville AFB · 97th BW', 'Arkansas International Airport', 'B-52G'),
    ('westover-99', 'Westover AFB · 99th BW', 'Westover Air Reserve Base', 'B-52D'),
    ('mccoy-306', 'McCoy AFB · 306th BW', 'Orlando International Airport', 'B-52D'),
    ('grand-forks-319', 'Grand Forks AFB · 319th BW', 'Grand Forks Air Force Base', 'B-52H'),
    ('mather-320', 'Mather AFB · 320th BW', 'Sacramento Mather Airport', 'B-52G'),
    ('wurtsmith-379', 'Wurtsmith AFB · 379th BW', 'Oscoda-Wurtsmith Airport', 'B-52H'),
    ('ki-sawyer-410', 'K.I. Sawyer AFB · 410th BW', 'Sawyer International Airport', 'B-52H'),
    ('griffiss-416', 'Griffiss AFB · 416th BW', 'Griffiss International Airport', 'B-52H'),
    ('kincheloe-449', 'Kincheloe AFB · 449th BW', 'Chippewa County International Airport', 'B-52H'),
    ('beale-456', 'Beale AFB · 456th BW', 'Beale Air Force Base', 'B-52G'),
]
# The 75 B-52s at Andersen recalled on the night (FRUS 1969–76 vol. XXV doc. 269); U-Tapao's B-52Ds stayed on the Southeast Asia task.
GUAM = ('andersen-43', 'Andersen AFB · 43rd SW', 'Andersen Air Force Base', 'B-52D', 75)
FB111 = [
    ('pease-509', 'Pease AFB · 509th BW', 'Portsmouth International Airport at Pease', 'FB-111A'),
    ('plattsburgh-380', 'Plattsburgh AFB · 380th BW', 'Plattsburgh International Airport', 'FB-111A'),
]
B52_TOTAL = 400  # about 400 B-52s in SAC in 1973 (Databook vol. 1); the 75 at Guam are documented on the night
FB111_TOTAL = 76  # 76 built (Wikipedia, F-111)
B52_WEAPONS = 4  # four gravity bombs per B-52 as the SIOP load; SRAM entering service is not counted
B52_YIELD_KT = 1_100  # B28/B43 class
FB111_WEAPONS = 4  # SRAMs, two internal and four on pylons possible (Wikipedia); four assumed
FB111_YIELD_KT = 170  # W69 SRAM
BOMBER_ALERT = 0.33  # about a third of the bomber force on ground alert in the early 1970s (Databook vol. 1); reconstructed

# Fleet ballistic missile force: 41 boats with 656 tubes (Databook vol. 1). Poseidon in service from March 1971,
# eventually on 31 boats; the state of conversion in October 1973 is reconstructed as half the 31.
SSBN_AREAS = [
    ('ssbn-norwegian', 'Polaris and Poseidon patrol · Norwegian Sea', (5.0, 68.0), 'Boats from Submarine Squadron 14, Holy Loch', 10),
    ('ssbn-atlantic', 'Poseidon patrol · North Atlantic', (-40.0, 45.0), 'Boats from Charleston', 6),
    ('ssbn-mediterranean', 'Polaris patrol · Mediterranean', (18.0, 35.0), 'Boats from Submarine Squadron 16, Rota', 3),
    ('ssbn-pacific', 'Polaris patrol · western Pacific', (150.0, 30.0), 'Boats from Submarine Squadron 15, Guam', 4),
]
SSBN_AT_SEA_NOTE = 'About 23 of 41 boats at sea, a reconstruction from the usual half-plus deployment rate; the split between areas is inferred'
POLARIS_A3 = (3, 200)  # three W58 of 200 kt, MRV
POSEIDON = (10, 40)  # ten W68 of 40 kt (Wikipedia, UGM-73)

# --- Soviet Union ----------------------------------------------------------

# ICBM fields by type. Launcher totals per type from the missile articles: 990 UR-100 (SS-11) by 1972,
# about 288 R-36 (SS-9), about 60 RT-2 (SS-13) at Yoshkar-Ola, and the R-16 (SS-7) force of 202 at peak
# still largely in place in 1973 under the SALT I replacement rule. Divisions and towns from the rocket-army articles.
SS11_FIELDS = [
    ('kozelsk', 'Kozelsk · 28th Guards Rocket Division', 'Kozelsk, Kaluga Oblast'),
    ('tatishchevo', 'Tatishchevo · 60th Rocket Division', 'Tatishchevo, Saratov Oblast'),
    ('teykovo', 'Teykovo · 54th Guards Rocket Division', 'Teykovo, Ivanovo Oblast'),
    ('kostroma', 'Kostroma · 10th Guards Rocket Division', 'Kostroma'),
    ('bershet', 'Bershet · 52nd Rocket Division', 'Bershet, Perm Krai'),
    ('pervomaysk', 'Pervomaysk · 46th Rocket Division', 'Pervomaisk, Mykolaiv Oblast'),
    ('derazhnya', 'Derazhnya · 19th Rocket Division', 'Derazhnia, Khmelnytskyi Oblast'),
    ('drovyanaya', 'Drovyanaya · 4th Rocket Division', 'Drovyanaya, Zabaykalsky Krai'),
    ('svobodny', 'Svobodny · 27th Rocket Division', 'Svobodny, Amur Oblast'),
    ('gladkaya', 'Gladkaya · 36th Guards Rocket Division', 'Kedrovy, Krasnoyarsk Krai'),
    ('pashino', 'Pashino · 39th Guards Rocket Division', 'Pashino, Novosibirsk'),
    ('olovyannaya', 'Olovyannaya · 47th Rocket Division', 'Olovyannaya, Zabaykalsky Krai'),
]
SS9_FIELDS = [
    ('aleysk', 'Aleysk · 41st Guards Rocket Division', 'Aleysk, Altai Krai'),
    ('dombarovsky', 'Dombarovsky · 13th Rocket Division', 'Dombarovsky, Orenburg Oblast'),
    ('kartaly', 'Kartaly · 59th Rocket Division', 'Kartaly, Chelyabinsk Oblast'),
    ('uzhur', 'Uzhur · 62nd Rocket Division', 'Uzhur, Krasnoyarsk Krai'),
    ('zhangiz-tobe', 'Zhangiz-Tobe · 57th Rocket Division', 'Zhangiztobe, Kazakhstan'),
]
SS13_FIELDS = [('yoshkar-ola', 'Yoshkar-Ola · 14th Rocket Division', 'Yoshkar-Ola')]
SS7_FIELDS = [
    ('yurya', 'Yurya · 8th Rocket Division', 'Yurya, Kirov Oblast'),
    ('nizhny-tagil', 'Verkhnyaya Salda · 42nd Rocket Division', 'Verkhnyaya Salda'),
    ('shadrinsk', 'Shadrinsk · 17th Rocket Brigade', 'Shadrinsk'),
    ('itatka', 'Itatka · 97th Rocket Brigade', 'Itatka, Tomsk Oblast'),
    ('tyumen', 'Tyumen · 93rd Rocket Brigade', 'Tyumen'),
]
SOVIET_ICBM = {
    'SS-11': (SS11_FIELDS, 990, 1_000, 'UR-100: 990 launchers by 1972; 0.5 to 1.1 Mt (Wikipedia, UR-100)'),
    'SS-9': (SS9_FIELDS, 288, 20_000, 'R-36: about 288 launchers at peak, 20 Mt or 8.3 Mt warhead (Wikipedia, R-36; Databook vol. 4 for the count)'),
    'SS-13': (SS13_FIELDS, 60, 600, 'RT-2: about 60 built by 1972, all in the Yoshkar-Ola field, 600 kt (Wikipedia, RT-2)'),
    'SS-7': (SS7_FIELDS, 186, 5_000, 'R-16: 202 at peak in 1965, retired by 1976 under the SALT I replacement rule; 186 in October 1973 is a reconstruction (Wikipedia, R-16)'),
}

# Long Range Aviation: "the 195 bombers belonging to Long Range Aviation were concentrated at only five primary airfields" (CIA, early 1970s, via Wikipedia).
LRA_FIELDS = [
    ('uzin', 'Uzin · 106th Heavy Bomber Division', 'Uzyn, Kyiv Oblast', 'Tu-95'),
    ('mozdok', 'Mozdok · 182nd Guards Regiment', 'Mozdok', 'Tu-95'),
    ('dolon', 'Dolon · 79th Heavy Bomber Division', 'Semey', 'Tu-95'),
    ('ukrainka', 'Ukrainka · 73rd Heavy Bomber Division', 'Seryshevo, Amur Oblast', 'Tu-95'),
    ('engels', 'Engels · 201st Heavy Bomber Division', 'Engels, Saratov Oblast', 'M-4/3M'),
]
LRA_TOTAL = 195
LRA_WEAPONS = 2
LRA_YIELD_KT = 1_000

# Yankee-class: 16 R-27 of 1 Mt and 2,400 km each; about three boats continually on patrol, east of Bermuda and off the Pacific coast (Wikipedia, Yankee-class; R-27 Zyb).
YANKEE_PATROL = [
    ('yankee-bermuda', 'Yankee patrol box · east of Bermuda', (-60.0, 33.0), 2),
    ('yankee-pacific', 'Yankee patrol box · off the Pacific coast', (-132.0, 40.0), 1),
]
YANKEE_PORTS = [
    ('gadzhiyevo', 'Gadzhiyevo · Northern Fleet', 'Gadzhiyevo', 18),
    ('rybachiy', 'Rybachiy · Pacific Fleet', 'Vilyuchinsk', 9),
]

HAND = {
    'bershet': (57.77, 57.73),
    'dombarovsky': (59.53, 50.76),
    'kincheloe-449': (-84.47, 46.25),
    'mccoy-306': (-81.31, 28.43),
    'loring-42': (-67.89, 46.95),
    'gladkaya': (91.75, 56.17),
    'olovyannaya': (115.58, 50.95),
    'itatka': (85.55, 56.85),
    'dolon': (79.15, 50.45),
    'ukrainka': (124.24, 51.17),
    'engels': (46.20, 51.48),
    'zhangiz-tobe': (81.20, 49.20),
    'drovyanaya': (113.05, 51.60),
    'svobodny': (128.32, 51.45),
    'pashino': (83.02, 55.18),
    'shadrinsk': (63.63, 56.08),
    'tyumen': (65.53, 57.15),
    'yurya': (49.32, 59.05),
    'nizhny-tagil': (60.55, 58.05),
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
    launchers = []

    def place(lid, query, hand_ok=True):
        if lid in HAND:
            lon, lat = HAND[lid]
            return lon, lat, 'hand-set'
        g = geocode(query)
        time.sleep(1.0)
        if not g:
            print('NO MATCH', lid, query)
            return None
        return g

    def add(rec, lid, query):
        p = place(lid, query)
        if not p:
            return
        lon, lat, hit = p
        rec.update({'id': lid, 'lon': round(lon, 4), 'lat': round(lat, 4), 'geocoded': hit, 'positionEvidence': 'inferred' if hit == 'hand-set' else 'reconstructed'})
        launchers.append(rec)
        print(lid, hit, round(lon, 3), round(lat, 3))

    for lid, name, query, squadrons, note, source in MINUTEMAN:
        weapons = sum(n * MM_YIELD[v][0] for n, v in squadrons)
        missiles = sum(n for n, _ in squadrons)
        add({'side': 'us', 'name': name, 'kind': 'icbm', 'missiles': missiles, 'weapons': weapons, 'squadrons': [{'missiles': n, 'version': v, 'warheads': MM_YIELD[v][0], 'yieldKt': MM_YIELD[v][1]} for n, v in squadrons], 'note': note, 'evidence': 'documented' if all(v != 'MM III' or lid != 'warren-90' for _, v in squadrons) else 'reconstructed', 'source': source}, lid, query)
    for lid, name, query in TITAN:
        add({'side': 'us', 'name': name, 'kind': 'icbm', 'missiles': TITAN_PER_WING, 'weapons': TITAN_PER_WING, 'squadrons': [{'missiles': TITAN_PER_WING, 'version': 'Titan II', 'warheads': 1, 'yieldKt': TITAN_YIELD_KT}], 'note': 'Two squadrons of nine', 'evidence': 'documented', 'source': f'{WIKI}, LGM-25C Titan II'}, lid, query)
    per_wing = spread(B52_TOTAL - GUAM[4], len(B52_WINGS))
    for (lid, name, query, model), n in zip(B52_WINGS, per_wing):
        add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': n, 'weaponsPerAircraft': B52_WEAPONS, 'yieldKt': B52_YIELD_KT, 'note': f'{B52_TOTAL} B-52s less the {GUAM[4]} at Guam spread evenly over {len(B52_WINGS)} wings', 'evidence': 'reconstructed', 'source': f'{WIKI}, List of B-52 units; Databook vol. 1 for the total'}, lid, query)
    lid, name, query, model, n = GUAM
    add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': n, 'weaponsPerAircraft': B52_WEAPONS, 'yieldKt': B52_YIELD_KT, 'note': 'Seventy-five B-52s recalled from Guam on the night of the alert', 'evidence': 'documented', 'source': 'FRUS 1969–76 vol. XXV doc. 269'}, lid, query)
    for (lid, name, query, model), n in zip(FB111, spread(FB111_TOTAL, len(FB111))):
        add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': n, 'weaponsPerAircraft': FB111_WEAPONS, 'yieldKt': FB111_YIELD_KT, 'note': '76 FB-111As in two wings', 'evidence': 'documented', 'source': f'{WIKI}, General Dynamics F-111 Aardvark'}, lid, query)
    for lid, name, pos, note, boats in SSBN_AREAS:
        poseidon = 'Poseidon' in name and 'Polaris' not in name
        warheads, kt = POSEIDON if poseidon else POLARIS_A3
        launchers.append({'side': 'us', 'id': lid, 'name': name, 'kind': 'slbm', 'lon': pos[0], 'lat': pos[1], 'boats': boats, 'missiles': boats * 16, 'weapons': boats * 16 * warheads, 'yieldKt': kt, 'note': f'{note}. {SSBN_AT_SEA_NOTE}', 'geocoded': 'hand-set', 'evidence': 'inferred', 'positionEvidence': 'inferred', 'source': 'Databook vol. 1: 41 boats, 656 tubes; Wikipedia, UGM-73 Poseidon'})
    for typ, (fields, total, kt, source) in SOVIET_ICBM.items():
        for (lid, name, query), n in zip(fields, spread(total, len(fields))):
            add({'side': 'su', 'name': name, 'kind': 'icbm', 'missiles': n, 'weapons': n, 'squadrons': [{'missiles': n, 'version': typ, 'warheads': 1, 'yieldKt': kt}], 'note': f'{total} {typ} launchers spread evenly over {len(fields)} fields', 'evidence': 'reconstructed', 'source': source}, lid, query)
    for (lid, name, query, model), n in zip(LRA_FIELDS, spread(LRA_TOTAL, len(LRA_FIELDS))):
        add({'side': 'su', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': n, 'weaponsPerAircraft': LRA_WEAPONS, 'yieldKt': LRA_YIELD_KT, 'note': f'{LRA_TOTAL} Long Range Aviation bombers at five fields (CIA), spread evenly', 'evidence': 'reconstructed', 'source': f'{WIKI}, Soviet Long Range Aviation; Tupolev Tu-95 units'}, lid, query)
    for lid, name, pos, boats in YANKEE_PATROL:
        launchers.append({'side': 'su', 'id': lid, 'name': name, 'kind': 'slbm', 'lon': pos[0], 'lat': pos[1], 'boats': boats, 'missiles': boats * 16, 'weapons': boats * 16, 'yieldKt': 1_000, 'note': 'About three Yankee boats continually on patrol in the 1970s', 'geocoded': 'hand-set', 'evidence': 'documented', 'positionEvidence': 'inferred', 'source': f'{WIKI}, Yankee-class submarine; R-27 Zyb'})
    for lid, name, query, boats in YANKEE_PORTS:
        add({'side': 'su', 'name': name, 'kind': 'slbm-port', 'boats': boats, 'missiles': boats * 16, 'weapons': boats * 16, 'yieldKt': 1_000, 'note': 'Boats in port, days from launch range; the split between fleets is reconstructed', 'evidence': 'reconstructed', 'source': f'{WIKI}, Yankee-class submarine: 34 built 1964–1974'}, lid, query)

    out = {
        'date': '24 October 1973',
        'rules': {
            'minutemanYields': {k: {'warheads': v[0], 'yieldKt': v[1]} for k, v in MM_YIELD.items()},
            'b52': {'total': B52_TOTAL, 'guam': GUAM[4], 'weaponsPerAircraft': B52_WEAPONS, 'yieldKt': B52_YIELD_KT, 'groundAlert': BOMBER_ALERT},
            'fb111': {'total': FB111_TOTAL, 'weaponsPerAircraft': FB111_WEAPONS, 'yieldKt': FB111_YIELD_KT},
            'ssbn': {'boats': 41, 'tubes': 656, 'atSea': sum(a[4] for a in SSBN_AREAS), 'note': SSBN_AT_SEA_NOTE},
            'sovietIcbm': {k: {'launchers': v[1], 'fields': len(v[0]), 'yieldKt': v[2]} for k, v in SOVIET_ICBM.items()},
            'lra': {'bombers': LRA_TOTAL, 'fields': len(LRA_FIELDS), 'weaponsPerAircraft': LRA_WEAPONS, 'yieldKt': LRA_YIELD_KT},
            'yankee': {'onPatrol': sum(p[3] for p in YANKEE_PATROL), 'inPort': sum(p[3] for p in YANKEE_PORTS)},
        },
        'launchers': launchers,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(launchers), 'launchers written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
