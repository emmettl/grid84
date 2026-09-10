#!/usr/bin/env python3
"""Build the strategic order of battle of the United States, Russia and North Korea for 2024.

The counts follow the Nuclear Notebook's 2024 estimates (Kristensen, Korda,
Johns and Knight, Bulletin of the Atomic Scientists) and the Federation of
American Scientists' status table, with the unit lists and towns from
Wikipedia. Nothing here is a scenario: this is the force the two published
scenarios run on. Warhead loadings per missile are estimates and are marked
reconstructed; patrol areas are inferred; every base is a real place geocoded
from the modern map or hand-set where the geocoder cannot find it. The
missile-defence and early-warning sites are included because the scenarios
turn on what can be seen and what can be shot.

Usage: python3 scripts/build-order-of-battle-2024.py --out data/72-minutes/order-of-battle-2024.json
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
NN_US = 'Kristensen, Korda, Johns and Knight, "United States nuclear weapons, 2024," Bulletin of the Atomic Scientists (Nuclear Notebook)'
NN_RU = 'Kristensen, Korda, Johns and Knight, "Russian nuclear weapons, 2024," Bulletin of the Atomic Scientists (Nuclear Notebook)'
FAS = 'Federation of American Scientists, Status of World Nuclear Forces (2025 update)'
SIPRI = 'SIPRI Yearbook 2024, world nuclear forces'

# --- United States -----------------------------------------------------------

# Three wings of 150 silos each; 400 missiles deployed in 450 silos, one warhead each under New START (Nuclear Notebook 2024).
# W87 (300 kt) at F. E. Warren from the Peacekeeper transfer; W78 (335 kt) at Malmstrom and Minot; the split is reconstructed.
MINUTEMAN = [
    ('warren-90', 'F. E. Warren AFB · 90th Missile Wing', 'Francis E. Warren Air Force Base', 134, 'W87', 300, 'Three squadrons (319th, 320th, 321st) in fifteen alert facilities over south-east Wyoming, Nebraska and Colorado; drawn at the base'),
    ('minot-91', 'Minot AFB · 91st Missile Wing', 'Minot Air Force Base', 133, 'W78', 335, 'Three squadrons (740th, 741st, 742nd) north and west of Minot; drawn at the base'),
    ('malmstrom-341', 'Malmstrom AFB · 341st Missile Wing', 'Malmstrom Air Force Base', 133, 'W78', 335, 'Three squadrons (10th, 12th, 490th) over central Montana; drawn at the base'),
]

# Fourteen Ohio-class boats, twelve counted operational, twenty tubes each after the New START conversion; about 970 warheads
# on some 240 deployed Trident II D5s, the W76-1 of 90 kt on most and the W88 of 455 kt on a minority (Nuclear Notebook 2024).
# Eight boats are based at Bangor and six at Kings Bay. How many are at sea and where is not published: the areas below are inferred
# from the usual pattern of eight to ten at sea, five in the Pacific and three in the Atlantic.
SSBN_AREAS = [
    ('ssbn-pacific-north', 'Trident patrol · Gulf of Alaska', (-150.0, 52.0), 'Boats from Bangor', 3),
    ('ssbn-pacific-west', 'Trident patrol · north-west Pacific', (170.0, 40.0), 'Boats from Bangor, forward in the western Pacific; the book\'s USS Nebraska stands here', 2),
    ('ssbn-atlantic', 'Trident patrol · North Atlantic', (-45.0, 42.0), 'Boats from Kings Bay', 3),
]
SSBN_PORTS = [
    ('bangor', 'Naval Base Kitsap · Bangor', 'Naval Base Kitsap', 3),
    ('kings-bay', 'Naval Submarine Base Kings Bay', 'Naval Submarine Base Kings Bay', 3),
]
TRIDENT_TUBES = 20
TRIDENT_WARHEADS = 4  # about 970 warheads on about 240 missiles; four per missile is the average and is reconstructed
TRIDENT_YIELD_KT = 90  # W76-1; the W88's 455 kt is carried on a minority and the scenario names it where it uses it

# Bombers: 46 B-52H and 20 B-2A counted as nuclear-assigned (Nuclear Notebook 2024). No bomber has stood on alert since 1991;
# generation to a launch posture takes hours to days and the study's bombers start on the ground.
BOMBERS = [
    ('minot-5', 'Minot AFB · 5th Bomb Wing', 'Minot Air Force Base', 'B-52H', 23, 20, 150, 'Twenty AGM-86B cruise missiles of the W80-1 at up to 150 kt'),
    ('barksdale-2', 'Barksdale AFB · 2nd Bomb Wing', 'Barksdale Air Force Base', 'B-52H', 23, 20, 150, 'Twenty AGM-86B cruise missiles of the W80-1 at up to 150 kt'),
    ('whiteman-509', 'Whiteman AFB · 509th Bomb Wing', 'Whiteman Air Force Base', 'B-2A', 20, 16, 50, 'Sixteen B61-12 gravity bombs at up to 50 kt; the B83 is being retired'),
]

# Ground-based midcourse defence: 44 interceptors, 40 at Fort Greely and 4 at Vandenberg; twelve hits in twenty-one intercept
# tests through December 2023 (Missile Defense Agency; Wikipedia, Ground-Based Midcourse Defense).
INTERCEPTORS = [
    ('fort-greely', 'Fort Greely · Missile Defense Complex', 'Fort Greely', 40),
    ('vandenberg-gbi', 'Vandenberg SFB · interceptor silos', 'Vandenberg Space Force Base', 4),
]
GBI_TESTS = (12, 21)

# Early-warning and tracking sites the scenarios name or rely on.
US_SENSORS = [
    ('buckley', 'Buckley SFB · SBIRS ground station', 'Buckley Space Force Base', 'Overhead infrared; the satellites themselves are not placed'),
    ('beale', 'Beale AFB · upgraded early warning radar', 'Beale Air Force Base', 'PAVE PAWS, facing the Pacific'),
    ('clear', 'Clear SFS · upgraded early warning radar', 'Clear Space Force Station', 'Facing the polar approaches'),
    ('cape-cod', 'Cape Cod SFS · upgraded early warning radar', 'Cape Cod Space Force Station', 'Facing the Atlantic'),
    ('fylingdales', 'RAF Fylingdales · upgraded early warning radar', 'RAF Fylingdales', 'Facing the polar approaches from the east'),
    ('pituffik', 'Pituffik SB · upgraded early warning radar', 'Pituffik Space Base', 'Thule; the polar approaches'),
    ('cobra-dane', 'Shemya · Cobra Dane radar', 'Eareckson Air Station', 'Aleutians; the north-west Pacific approaches'),
    ('shariki', 'Shariki · AN/TPY-2 forward radar', 'Tsugaru, Aomori', 'Forward X-band radar in northern Japan'),
    ('kyogamisaki', 'Kyogamisaki · AN/TPY-2 forward radar', 'Kyotango', 'Forward X-band radar on the Sea of Japan'),
]
# The sea-based X-band radar's position is a deployment choice; drawn on its usual station in the central Pacific.
SBX = ('sbx-1', 'SBX-1 · sea-based X-band radar', (-165.0, 40.0), 'Home port Pearl Harbor, formerly Adak; the mid-Pacific station is inferred')

US_COMMAND = [
    ('pentagon', 'The Pentagon · National Military Command Center', 'The Pentagon', 'The book\'s ground zero'),
    ('offutt', 'Offutt AFB · US Strategic Command', 'Offutt Air Force Base', 'The commander who executes'),
    ('cheyenne-mountain', 'Cheyenne Mountain · NORAD alternate command center', 'Cheyenne Mountain Complex', 'NORAD and NORTHCOM assess'),
    ('raven-rock', 'Raven Rock Mountain Complex', 'Raven Rock Mountain Complex', 'The alternate joint communications center'),
]

# --- Russia ------------------------------------------------------------------

# About 326 ICBM launchers in eleven divisions of three rocket armies (Nuclear Notebook 2024; Wikipedia, Strategic Rocket Forces).
# Per-type totals: 40 R-36M2 (SS-18) at Dombarovsky and Uzhur; 12 UR-100NUTTH with Avangard at Dombarovsky; 68 Topol-M (50 silo at
# Tatishchevo, 18 mobile at Teykovo); 204 RS-24 Yars (24 silo at Kozelsk, 180 mobile over seven divisions). Loadings are estimates.
RU_ICBM = [
    # (id, name, query, [(version, launchers, warheads each, kt each)])
    ('tatishchevo', 'Tatishchevo · 60th Rocket Division', 'Tatishchevo, Saratov Oblast', [('Topol-M silo', 50, 1, 800)]),
    ('kozelsk', 'Kozelsk · 28th Guards Rocket Division', 'Kozelsk, Kaluga Oblast', [('Yars silo', 24, 3, 150)]),
    ('teykovo', 'Teykovo · 54th Guards Rocket Division', 'Teykovo, Ivanovo Oblast', [('Topol-M mobile', 18, 1, 800), ('Yars mobile', 18, 3, 150)]),
    ('yoshkar-ola', 'Yoshkar-Ola · 14th Rocket Division', 'Yoshkar-Ola', [('Yars mobile', 27, 3, 150)]),
    ('vypolzovo', 'Vypolzovo · 7th Guards Rocket Division', 'Bologoye, Tver Oblast', [('Yars mobile', 27, 3, 150)]),
    ('nizhny-tagil', 'Nizhny Tagil · 42nd Rocket Division', 'Verkhnyaya Salda', [('Yars mobile', 27, 3, 150)]),
    ('novosibirsk', 'Novosibirsk · 39th Guards Rocket Division', 'Pashino, Novosibirsk', [('Yars mobile', 27, 3, 150)]),
    ('irkutsk', 'Irkutsk · 29th Guards Rocket Division', 'Irkutsk', [('Yars mobile', 27, 3, 150)]),
    ('barnaul', 'Barnaul · 35th Rocket Division', 'Sibirsky, Altai Krai', [('Yars mobile', 27, 3, 150)]),
    ('dombarovsky', 'Dombarovsky · 13th Rocket Division', 'Dombarovsky, Orenburg Oblast', [('R-36M2', 20, 10, 800), ('UR-100NUTTH Avangard', 12, 1, 800)]),
    ('uzhur', 'Uzhur · 62nd Rocket Division', 'Uzhur, Krasnoyarsk Krai', [('R-36M2', 20, 10, 800)]),
]
RU_ICBM_NOTE = 'Launchers per division are the Nuclear Notebook\'s per-type totals spread over the divisions that field the type; warheads per missile and yields are the Notebook\'s estimates (Yars three to four of about 100 to 300 kt, R-36M2 ten of about 800 kt, Topol-M one of 800 kt, Avangard one glide vehicle of uncertain yield drawn at 800 kt)'

# Twelve boats counted: five Delta IV at Gadzhiyevo with sixteen R-29RMU2 of four 100 kt warheads, and seven Borei, two in the
# Northern Fleet and five in the Pacific, with sixteen Bulava of six 100 kt (Nuclear Notebook 2024). Russia keeps one or two boats
# at sea at a time, in the bastions; the split is inferred.
RU_SSBN_AREAS = [
    ('ru-ssbn-barents', 'Borei and Delta IV patrol · Barents Sea bastion', (38.0, 73.0), 'Boats from Gadzhiyevo', 2, 16, 5, 100),
    ('ru-ssbn-okhotsk', 'Borei patrol · Sea of Okhotsk bastion', (150.0, 54.0), 'Boats from Vilyuchinsk', 1, 16, 6, 100),
]
RU_SSBN_PORTS = [
    ('gadzhiyevo', 'Gadzhiyevo · Northern Fleet', 'Gadzhiyevo', 5, 16, 5, 100),
    ('vilyuchinsk', 'Vilyuchinsk · Pacific Fleet', 'Vilyuchinsk', 4, 16, 6, 100),
]

# Long Range Aviation: about 58 heavy bombers counted, Tu-95MS at Engels and Ukrainka and Tu-160 at Engels, with the Kh-102
# cruise missile (Nuclear Notebook 2024). Loadings reconstructed.
RU_BOMBERS = [
    ('engels', 'Engels-2 · 22nd Guards Heavy Bomber Division', 'Engels, Saratov Oblast', 'Tu-160 / Tu-95MS', 32, 8, 250, 'Kh-102 cruise missiles; eight per Tu-95MS, twelve per Tu-160, drawn as eight'),
    ('ukrainka', 'Ukrainka · 326th Heavy Bomber Division', 'Seryshevo, Amur Oblast', 'Tu-95MS', 26, 8, 250, 'Kh-102 cruise missiles'),
]

# Early warning: the satellite ground stations and the Voronezh and Daryal radars (Wikipedia, Main Centre for Missile Attack Warning).
RU_SENSORS = [
    ('serpukhov-15', 'Serpukhov-15 · western satellite ground station', 'Kurilovo, Kaluga Oblast', 'The 1983 false alarm\'s station; the book\'s commander reports from here'),
    ('pivan-1', 'Pivan-1 · eastern satellite ground station', 'Pivan, Khabarovsk Krai', 'Eastern control of the EKS satellites'),
    ('lekhtusi', 'Lekhtusi · Voronezh-M radar', 'Lekhtusi', 'North-west'),
    ('olenegorsk', 'Olenegorsk · Dnestr/Voronezh radar', 'Olenegorsk, Murmansk Oblast', 'North'),
    ('pechora', 'Pechora · Daryal radar', 'Pechora, Komi Republic', 'North'),
    ('vorkuta', 'Vorkuta · Voronezh radar', 'Vorkuta', 'North, under construction into the 2020s'),
    ('armavir', 'Armavir · Voronezh-DM radar', 'Armavir, Krasnodar Krai', 'South-west'),
    ('pionersky', 'Pionersky · Voronezh-DM radar', 'Pionersky, Kaliningrad Oblast', 'West'),
    ('orsk', 'Orsk · Voronezh-M radar', 'Orsk', 'South'),
    ('barnaul-radar', 'Barnaul · Voronezh-DM radar', 'Barnaul', 'South-east'),
    ('yeniseysk', 'Yeniseysk · Voronezh-DM radar', 'Yeniseysk', 'North-east'),
    ('mishelevka', 'Mishelevka · Voronezh-M radar', 'Usolye-Sibirskoye', 'East'),
]
RU_COMMAND = [
    ('moscow-genstaff', 'Moscow · General Staff', 'Kremlin, Moscow', 'The Russian president and the General Staff; the book\'s unanswered line'),
]

# --- North Korea -------------------------------------------------------------

# About 50 assembled warheads (SIPRI 2024; FAS says about 60) and some seventeen ICBMs on mobile launchers, eleven or more
# Hwasong-17 and six or more of the Hwasong-15 and 18 (Wikipedia, North Korea and weapons of mass destruction). The 2017 test
# is estimated at about 250 kt and stands for the warhead. Launch sites are the places the tests have used; the split is reconstructed.
NK_ICBM = [
    ('sunan', 'Sunan · Pyongyang International Airport', 'Pyongyang International Airport', 8, 'The Hwasong-17 test launches of 2022 and 2023'),
    ('sil-li', 'Sil-li · missile support facility', 'Sunan District, Pyongyang', 5, 'The base identified near the airport in open-source imagery'),
    ('sohae', 'Sohae · satellite launching station', 'Tongchang-ri', 2, 'The west coast station'),
    ('tonghae', 'Tonghae · Musudan-ri', 'Hwadae County', 2, 'The east coast station'),
]
NK_ICBM_TOTAL = 17
NK_YIELD_KT = 250
NK_WARHEADS = 50
# One missile submarine, the Hero Kim Kun Ok, a rebuilt Romeo-class hull commissioned in 2023 at Sinpo, with the Pukguksong-3 of
# about 1,900 km; it cannot reach the American coast from Korean waters, which is the scenario's weakest step.
NK_SUB = ('sinpo', 'Sinpo · South shipyard · Hero Kim Kun Ok', 'Sinpo', 1, 'One boat, up to ten tubes claimed, Pukguksong-3 at about 1,900 km')
NK_COMMAND = [('pyongyang', 'Pyongyang · State Affairs Commission', 'Pyongyang', 'The leadership')]

HAND = {
    'dombarovsky': (59.53, 50.76),
    'uzhur': (89.83, 55.30),
    'vypolzovo': (33.80, 57.85),
    'nizhny-tagil': (60.55, 58.05),
    'novosibirsk': (83.02, 55.18),
    'barnaul': (83.62, 53.28),
    'engels': (46.20, 51.48),
    'ukrainka': (124.24, 51.17),
    'serpukhov-15': (36.83, 54.85),
    'pivan-1': (137.05, 50.53),
    'lekhtusi': (30.55, 60.28),
    'olenegorsk': (33.17, 68.11),
    'pechora': (57.29, 65.21),
    'vorkuta': (64.08, 67.50),
    'armavir': (40.98, 44.92),
    'pionersky': (20.17, 54.86),
    'orsk': (58.35, 51.20),
    'barnaul-radar': (83.55, 53.30),
    'yeniseysk': (92.10, 58.40),
    'mishelevka': (103.27, 52.86),
    'cobra-dane': (174.09, 52.74),
    'shariki': (140.58, 40.90),
    'kyogamisaki': (135.10, 35.77),
    'fylingdales': (-0.67, 54.36),
    'pituffik': (-68.30, 76.57),
    'sil-li': (125.65, 39.21),
    'sohae': (124.71, 39.66),
    'tonghae': (129.67, 40.86),
    'sinpo': (128.19, 40.03),
    'sunan': (125.67, 39.22),
    'vilyuchinsk': (158.40, 52.93),
    'gadzhiyevo': (33.33, 69.25),
    'fort-greely': (-145.73, 63.97),
    'cheyenne-mountain': (-104.85, 38.74),
    'raven-rock': (-77.42, 39.73),
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
            lon, lat, hit = pos[0], pos[1], 'hand-set'
            position_evidence = 'inferred'
        else:
            p = place(lid, query)
            if not p:
                return
            lon, lat, hit = p
            position_evidence = 'inferred' if hit == 'hand-set' else 'reconstructed'
        rec.update({'id': lid, 'lon': round(lon, 4), 'lat': round(lat, 4), 'geocoded': hit, 'positionEvidence': position_evidence})
        sites.append(rec)
        print(lid, hit, round(lon, 3), round(lat, 3))

    # United States
    for lid, name, query, missiles, warhead, kt, note in MINUTEMAN:
        add({'side': 'us', 'name': name, 'kind': 'icbm', 'missiles': missiles, 'weapons': missiles, 'squadrons': [{'missiles': missiles, 'version': f'Minuteman III · {warhead}', 'warheads': 1, 'yieldKt': kt}], 'note': note, 'evidence': 'documented', 'source': f'{NN_US}; {WIKI}, LGM-30 Minuteman'}, lid, query)
    for lid, name, pos, note, boats in SSBN_AREAS:
        add({'side': 'us', 'name': name, 'kind': 'slbm', 'boats': boats, 'missiles': boats * TRIDENT_TUBES, 'weapons': boats * TRIDENT_TUBES * TRIDENT_WARHEADS, 'weaponsPerVehicle': TRIDENT_WARHEADS, 'yieldKt': TRIDENT_YIELD_KT, 'note': f'{note}. At-sea numbers and areas are inferred; the loading of four W76-1 per missile is the fleet average', 'evidence': 'inferred', 'source': NN_US}, lid, pos=pos)
    for lid, name, query, boats in SSBN_PORTS:
        add({'side': 'us', 'name': name, 'kind': 'slbm-port', 'boats': boats, 'missiles': boats * TRIDENT_TUBES, 'weapons': boats * TRIDENT_TUBES * TRIDENT_WARHEADS, 'weaponsPerVehicle': TRIDENT_WARHEADS, 'yieldKt': TRIDENT_YIELD_KT, 'note': 'Boats in port or refit; the split is reconstructed from eight at Bangor and six at Kings Bay less those at sea', 'evidence': 'reconstructed', 'source': NN_US}, lid, query)
    for lid, name, query, model, aircraft, weapons, kt, note in BOMBERS:
        add({'side': 'us', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': aircraft, 'weaponsPerAircraft': weapons, 'yieldKt': kt, 'alert': 0.0, 'note': f'{note}. No bomber alert since 1991; generation takes hours to days', 'evidence': 'reconstructed', 'source': f'{NN_US}; {WIKI}, List of B-52 units; 509th Bomb Wing'}, lid, query)
    for lid, name, query, n in INTERCEPTORS:
        add({'side': 'us', 'name': name, 'kind': 'interceptor', 'interceptors': n, 'testRecord': {'hits': GBI_TESTS[0], 'tests': GBI_TESTS[1]}, 'note': f'{n} ground-based interceptors; {GBI_TESTS[0]} hits in {GBI_TESTS[1]} intercept tests through December 2023', 'evidence': 'documented', 'source': f'Missile Defense Agency; {WIKI}, Ground-Based Midcourse Defense'}, lid, query)
    for lid, name, query, note in US_SENSORS:
        add({'side': 'us', 'name': name, 'kind': 'sensor', 'note': note, 'evidence': 'documented', 'source': f'{WIKI}, Solid State Phased Array Radar System; AN/TPY-2; Space-Based Infrared System'}, lid, query)
    lid, name, pos, note = SBX
    add({'side': 'us', 'name': name, 'kind': 'sensor', 'note': note, 'evidence': 'documented', 'source': f'{WIKI}, Sea-Based X-Band Radar'}, lid, pos=pos)
    for lid, name, query, note in US_COMMAND:
        add({'side': 'us', 'name': name, 'kind': 'command', 'note': note, 'evidence': 'documented', 'source': WIKI}, lid, query)

    # Russia
    for lid, name, query, squadrons in RU_ICBM:
        missiles = sum(n for _, n, _, _ in squadrons)
        weapons = sum(n * w for _, n, w, _ in squadrons)
        add({'side': 'ru', 'name': name, 'kind': 'icbm', 'missiles': missiles, 'weapons': weapons, 'squadrons': [{'missiles': n, 'version': v, 'warheads': w, 'yieldKt': kt} for v, n, w, kt in squadrons], 'note': RU_ICBM_NOTE, 'evidence': 'reconstructed', 'source': f'{NN_RU}; {WIKI}, Strategic Rocket Forces'}, lid, query)
    for lid, name, pos, note, boats, tubes, warheads, kt in RU_SSBN_AREAS:
        add({'side': 'ru', 'name': name, 'kind': 'slbm', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': f'{note}. One or two boats at sea at a time in the bastions; inferred', 'evidence': 'inferred', 'source': NN_RU}, lid, pos=pos)
    for lid, name, query, boats, tubes, warheads, kt in RU_SSBN_PORTS:
        add({'side': 'ru', 'name': name, 'kind': 'slbm-port', 'boats': boats, 'missiles': boats * tubes, 'weapons': boats * tubes * warheads, 'weaponsPerVehicle': warheads, 'yieldKt': kt, 'note': 'Boats in port; the book has them launching from there, which Russia\'s boats can', 'evidence': 'reconstructed', 'source': f'{NN_RU}; {WIKI}, Borei-class submarine; Delta-class submarine'}, lid, query)
    for lid, name, query, model, aircraft, weapons, kt, note in RU_BOMBERS:
        add({'side': 'ru', 'name': name, 'kind': 'bomber', 'model': model, 'aircraft': aircraft, 'weaponsPerAircraft': weapons, 'yieldKt': kt, 'alert': 0.0, 'note': note, 'evidence': 'reconstructed', 'source': f'{NN_RU}; {WIKI}, Russian Long Range Aviation'}, lid, query)
    for lid, name, query, note in RU_SENSORS:
        add({'side': 'ru', 'name': name, 'kind': 'sensor', 'note': note, 'evidence': 'documented', 'source': f'{WIKI}, Main Centre for Missile Attack Warning; Voronezh radar'}, lid, query)
    for lid, name, query, note in RU_COMMAND:
        add({'side': 'ru', 'name': name, 'kind': 'command', 'note': note, 'evidence': 'documented', 'source': WIKI}, lid, query)

    # North Korea
    for lid, name, query, n, note in NK_ICBM:
        add({'side': 'nk', 'name': name, 'kind': 'icbm', 'missiles': n, 'weapons': n, 'squadrons': [{'missiles': n, 'version': 'Hwasong-17 / 15 / 18', 'warheads': 1, 'yieldKt': NK_YIELD_KT}], 'note': f'{note}. {NK_ICBM_TOTAL} launchers in all, spread by the sites the tests have used; about {NK_WARHEADS} warheads for every system', 'evidence': 'reconstructed', 'source': f'{SIPRI}; {FAS}; {WIKI}, Hwasong-17'}, lid, query)
    lid, name, query, boats, note = NK_SUB
    add({'side': 'nk', 'name': name, 'kind': 'slbm-port', 'boats': boats, 'missiles': 2, 'weapons': 2, 'weaponsPerVehicle': 1, 'yieldKt': NK_YIELD_KT, 'rangeKm': 1_900, 'note': note, 'evidence': 'documented', 'source': f'{WIKI}, Hero Kim Kun Ok; Pukguksong-3'}, lid, query)
    for lid, name, query, note in NK_COMMAND:
        add({'side': 'nk', 'name': name, 'kind': 'command', 'note': note, 'evidence': 'documented', 'source': WIKI}, lid, query)

    out = {
        'date': '2024',
        'rules': {
            'minuteman': {'missiles': sum(m[3] for m in MINUTEMAN), 'warheadsPerMissile': 1, 'note': 'One warhead per missile under New START; W87 at Warren, W78 at Malmstrom and Minot, the split reconstructed'},
            'trident': {'boats': 14, 'operational': 12, 'atSea': sum(a[4] for a in SSBN_AREAS), 'tubes': TRIDENT_TUBES, 'warheadsPerMissile': TRIDENT_WARHEADS, 'yieldKt': TRIDENT_YIELD_KT, 'w88Kt': 455},
            'usBombers': {'aircraft': sum(b[4] for b in BOMBERS), 'alert': 0.0},
            'gmd': {'interceptors': sum(i[3] for i in INTERCEPTORS), 'testHits': GBI_TESTS[0], 'tests': GBI_TESTS[1], 'salvo': 4, 'note': 'Four interceptors per incoming warhead is the stated doctrine; the 97 per cent it claims assumes independent shots'},
            'ruIcbm': {'launchers': sum(sum(n for _, n, _, _ in sq) for _, _, _, sq in RU_ICBM), 'warheads': sum(sum(n * w for _, n, w, _ in sq) for _, _, _, sq in RU_ICBM), 'note': RU_ICBM_NOTE},
            'ruSsbn': {'boats': 12, 'atSea': sum(a[4] for a in RU_SSBN_AREAS)},
            'ruBombers': {'aircraft': sum(b[4] for b in RU_BOMBERS), 'alert': 0.0},
            'nk': {'icbmLaunchers': NK_ICBM_TOTAL, 'warheads': NK_WARHEADS, 'yieldKt': NK_YIELD_KT, 'note': 'The 2017 test yield stands for the warhead; the book\'s one megaton is a scenario choice'},
            'deployedStrategic': {'us': 1670, 'ru': 1796, 'source': FAS},
        },
        'sites': sites,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(sites), 'sites written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
