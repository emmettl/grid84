#!/usr/bin/env python3
"""Build the theatre nuclear order of battle of both sides for 11 November 1983.

NATO's nuclear delivery means are the quick-reaction-alert wings of USAFE,
RAF Germany, the Luftwaffe and the Belgian, Dutch and Italian air forces,
the three Pershing 1a battalions of the 56th Field Artillery Brigade, and
the cruise missiles then arriving at Greenham Common, which landed on 14
November and are drawn as arriving. The Soviet side is the 16th Air Army's
fighter-bomber regiments in East Germany and the 4th Air Army's bombers in
Poland, the record's "GSFG fighter-bombers at thirty-minute alert" and
"4th Air Army bombers" with warheads loaded; the operational-tactical
missile brigades of the two groups; and the SS-20 regiments of the western
military districts. Positions are geocoded from the modern map and every
strength follows a rule recorded in the output. The regiment-level picture
on the Soviet side is reconstructed from the divisions the unit histories
name; the readout says so.

Usage: python3 scripts/build-order-of-battle-1983.py --out data/able-archer/order-of-battle-1983.json
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

PHOTON = 'https://photon.komoot.io/api/'

# NATO air wings: (id, name, query, country, aircraft, aircraft count, weapon kt, evidence, source)
NATO_AIR = [
    ('lakenheath-48', 'RAF Lakenheath · 48th TFW', 'RAF Lakenheath', 'UK', 'F-111F', 72, 170, 'documented', 'Wikipedia, 48th Fighter Wing'),
    ('upper-heyford-20', 'RAF Upper Heyford · 20th TFW', 'Upper Heyford', 'UK', 'F-111E', 72, 170, 'documented', 'Wikipedia, 20th Fighter Wing'),
    ('hahn-50', 'Hahn AB · 50th TFW', 'Flughafen Frankfurt-Hahn', 'DE', 'F-16A', 72, 170, 'documented', 'Wikipedia, 50th Tactical Fighter Wing'),
    ('spangdahlem-52', 'Spangdahlem AB · 52nd TFW', 'Spangdahlem Air Base', 'DE', 'F-4E/G', 72, 170, 'documented', 'Wikipedia, 52nd Fighter Wing'),
    ('ramstein-86', 'Ramstein AB · 86th TFW', 'Ramstein Air Base', 'DE', 'F-4E', 72, 170, 'documented', 'Wikipedia, 86th Airlift Wing'),
    ('torrejon-401', 'Torrejón AB · 401st TFW', 'Torrejón Air Base', 'ES', 'F-4E', 72, 170, 'documented', 'Wikipedia, 401st Tactical Fighter Wing'),
    ('bruggen', 'RAF Brüggen · 14, 17, 31 Sqn', 'Brüggen', 'DE', 'Tornado GR1 / Jaguar', 36, 200, 'documented', 'Wikipedia, RAF Germany: Brüggen and Laarbruch Tornados carried WE.177'),
    ('laarbruch', 'RAF Laarbruch · 15, 16 Sqn', 'Weeze Airport', 'DE', 'Tornado GR1 / Buccaneer', 24, 200, 'documented', 'Wikipedia, RAF Germany'),
    ('buchel', 'Büchel · JaBoG 33', 'Büchel Air Base', 'DE', 'F-104G', 36, 170, 'reconstructed', 'Luftwaffe strike wings under US custody; the wing list is from the NATO nuclear sharing record'),
    ('norvenich', 'Nörvenich · JaBoG 31', 'Nörvenich', 'DE', 'Tornado IDS', 36, 170, 'reconstructed', 'Luftwaffe strike wing'),
    ('memmingen', 'Memmingen · JaBoG 34', 'Memmingen Airport', 'DE', 'F-104G', 36, 170, 'reconstructed', 'Luftwaffe strike wing'),
    ('lechfeld', 'Lechfeld · JaBoG 32', 'Lechfeld', 'DE', 'Tornado IDS', 36, 170, 'reconstructed', 'Luftwaffe strike wing'),
    ('kleine-brogel', 'Kleine Brogel · 10 Wing', 'Kleine-Brogel Air Base', 'BE', 'F-16A', 36, 170, 'reconstructed', 'Belgian strike wing under US custody'),
    ('volkel', 'Volkel · 311, 312 Sqn', 'Volkel Air Base', 'NL', 'F-16A', 36, 170, 'reconstructed', 'Dutch strike squadrons under US custody'),
    ('ghedi', 'Ghedi · 6º Stormo', 'Ghedi Air Base', 'IT', 'Tornado IDS', 36, 170, 'reconstructed', 'Italian strike wing under US custody'),
]
# Quick-reaction alert: a handful of aircraft per base armed and on fifteen minutes; the rest generated over hours. Both rules reconstructed.
QRA_PER_BASE = 6
QRA_WEAPONS_PER_AIRCRAFT = 1
GENERATED_WEAPONS_PER_AIRCRAFT = 2

# Pershing 1a: 108 launchers in three battalions, 400 kt (Wikipedia, Pershing II: the Pershing 1a's "400 kt warhead").
PERSHING = [
    ('schwabisch-gmund', 'Schwäbisch Gmünd · 1st Bn 41st FA', 'Schwäbisch Gmünd', 36),
    ('neu-ulm', 'Neu-Ulm · 1st Bn 81st FA', 'Neu-Ulm', 36),
    ('neckarsulm', 'Neckarsulm · 3rd Bn 84th FA', 'Neckarsulm', 36),
]
PERSHING_KT = 400
PERSHING_RANGE_KM = 740
# Cruise missiles: the first flight of sixteen landed at Greenham Common on 14 November 1983, three days after the exercise; drawn as arriving.
GLCM = ('greenham', 'RAF Greenham Common · 501st TMW', 'Greenham Common', 16, 150, 2_780)

# NATO headquarters and ports as targets only.
NATO_HQ = [
    ('shape', 'SHAPE · Casteau', 'Casteau, Mons'),
    ('afcent', 'AFCENT · Brunssum', 'Brunssum'),
    ('northag', 'NORTHAG and RAF Germany · Rheindahlen', 'Rheindahlen'),
    ('centag', 'CENTAG and USAREUR · Heidelberg', 'Heidelberg'),
    ('crest-high', 'Alternate War HQ CREST HIGH · Birkenfeld', 'Birkenfeld, Rhineland-Palatinate'),
    ('bremerhaven', 'Reinforcement port · Bremerhaven', 'Bremerhaven'),
    ('antwerp', 'Reinforcement port · Antwerp', 'Antwerpen'),
    ('rhein-main', 'Rhein-Main AB · Reforger airlift', 'Frankfurt Airport'),
]

# Soviet fighter-bomber regiments in East Germany (16th Air Army) and bombers in Poland (4th Air Army).
# Bases from the unit histories; which regiment flew what in November 1983 is reconstructed.
SOVIET_AIR = [
    ('brand', 'Brand · 116th Guards Bomber Regiment', 'Brand-Niederlausitz', 'DE', 'Su-24', 36, 'reconstructed'),
    ('grossenhain', 'Großenhain · 296th Fighter-Bomber Regiment', 'Großenhain', 'DE', 'MiG-27', 36, 'documented'),
    ('finsterwalde', 'Finsterwalde · 559th Fighter-Bomber Regiment', 'Finsterwalde', 'DE', 'MiG-27', 36, 'reconstructed'),
    ('gross-dolln', 'Groß Dölln · 20th Fighter-Bomber Regiment', 'Templin', 'DE', 'Su-17', 36, 'documented'),
    ('larz', 'Lärz · 19th Guards Fighter-Bomber Regiment', 'Lärz', 'DE', 'MiG-27', 36, 'documented'),
    ('neuruppin', 'Neuruppin · 730th Fighter-Bomber Regiment', 'Neuruppin', 'DE', 'MiG-27', 36, 'reconstructed'),
    ('szprotawa', 'Szprotawa · 149th Bomber Division', 'Szprotawa', 'PL', 'Su-24', 36, 'documented'),
    ('zagan', 'Żagań · 89th Bomber Regiment', 'Żagań', 'PL', 'Su-24', 36, 'reconstructed'),
    ('brzeg', 'Brzeg · 42nd Guards Bomber Regiment', 'Brzeg', 'PL', 'Su-24', 36, 'reconstructed'),
]
SOVIET_AIR_KT = 100  # TN-1000 class bombs; inferred
SOVIET_AIR_WEAPONS = 1
SOVIET_AIR_ALERT = 0.5  # half the regiment armed at thirty-minute alert (inferred from "30-minute alert" and "warheads placed on bombers")

# Operational-tactical missile brigades: Scud (R-17) with the groups of forces; 12 launchers a brigade, 50 kt; garrisons reconstructed except Legnica.
SOVIET_MISSILE = [
    ('legnica-114', 'Legnica · 114th Missile Brigade', 'Legnica', 'PL', 'R-17 Scud', 12, 50, 'documented'),
    ('waren', 'Waren · GSFG missile brigade', 'Waren (Müritz)', 'DE', 'R-17 Scud', 12, 50, 'reconstructed'),
    ('konigsbruck', 'Königsbrück · GSFG missile brigade', 'Königsbrück', 'DE', 'R-17 Scud', 12, 50, 'reconstructed'),
    ('wittstock', 'Wittstock · GSFG missile brigade', 'Wittstock/Dosse', 'DE', 'R-17 Scud', 12, 50, 'reconstructed'),
]
SOVIET_MISSILE_RANGE_KM = 300

# SS-20 regiments facing Europe: 405 launchers in all by 1986 (Wikipedia, RSD-10), about two thirds in the western districts; five garrisons stand for them.
SS20 = [
    ('postavy', 'Postavy · 32nd Rocket Division', 'Pastavy'),
    ('lida', 'Lida · 49th Guards Rocket Division', 'Lida, Belarus'),
    ('mozyr', 'Mozyr · 33rd Guards Rocket Division', 'Mazyr'),
    ('lutsk', 'Lutsk · 37th Guards Rocket Division', 'Lutsk'),
    ('belokorovichi', 'Belokorovichi · 50th Rocket Division', 'Bilokorovychi'),
]
SS20_LAUNCHERS_WEST = 243
SS20_WARHEADS = 3
SS20_KT = 150
SS20_RANGE_KM = 5_000

SOVIET_HQ = [
    ('wunsdorf', 'GSFG headquarters · Wünsdorf', 'Wünsdorf'),
    ('legnica-hq', 'Northern Group headquarters · Legnica', 'Legnica'),
]

HAND = {
    'crest-high': (7.17, 49.65),
    'gross-dolln': (13.53, 53.03),
    'larz': (12.75, 53.31),
    'brand': (13.87, 51.98),
    'szprotawa': (15.52, 51.55),
    'zagan': (15.42, 51.62),
    'brzeg': (17.42, 50.83),
    'greenham': (-1.29, 51.38),
    'upper-heyford': (-1.25, 51.94),
    'lechfeld': (10.86, 48.19),
    'norvenich': (6.66, 50.83),
    'buchel': (7.06, 50.17),
    'bruggen': (6.13, 51.2),
    'kleine-brogel': (5.47, 51.17),
    'ghedi': (10.27, 45.43),
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


def spread(total, n):
    base, extra = divmod(total, n)
    return [base + (1 if i < extra else 0) for i in range(n)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    sites = []

    def add(rec, lid, query):
        p = place(lid, query)
        if not p:
            return
        lon, lat, hit = p
        rec.update({'id': lid, 'lon': round(lon, 4), 'lat': round(lat, 4), 'geocoded': hit, 'positionEvidence': 'inferred' if hit == 'hand-set' else 'reconstructed'})
        sites.append(rec)
        print(lid, hit, round(lon, 3), round(lat, 3))

    for lid, name, query, country, aircraft, n, kt, evidence, source in NATO_AIR:
        add({'side': 'nato', 'kind': 'air', 'name': name, 'country': country, 'aircraft': aircraft, 'count': n, 'qra': QRA_PER_BASE, 'qraWeapons': QRA_PER_BASE * QRA_WEAPONS_PER_AIRCRAFT, 'generatedWeapons': n * GENERATED_WEAPONS_PER_AIRCRAFT, 'yieldKt': kt, 'evidence': evidence, 'source': source, 'note': f'{n} aircraft; {QRA_PER_BASE} on quick-reaction alert with one weapon each, the rest generated with two (rules reconstructed)'}, lid, query)
    for lid, name, query, launchers in PERSHING:
        add({'side': 'nato', 'kind': 'pershing', 'name': name, 'country': 'DE', 'launchers': launchers, 'weapons': launchers, 'yieldKt': PERSHING_KT, 'rangeKm': PERSHING_RANGE_KM, 'evidence': 'documented', 'source': 'Wikipedia, Pershing II: 108 Pershing 1a launchers in three battalions; Pershing II arrived from late November 1983', 'note': 'Pershing 1a, 400 kt; the Pershing II battery landed two weeks after the exercise'}, lid, query)
    lid, name, query, n, kt, rng = GLCM
    add({'side': 'nato', 'kind': 'glcm', 'name': name, 'country': 'UK', 'launchers': 0, 'weapons': 0, 'arriving': n, 'yieldKt': kt, 'rangeKm': rng, 'evidence': 'documented', 'source': 'Wikipedia, BGM-109G: 96 missiles at Greenham Common at full strength; the first flight landed on 14 November 1983', 'note': 'Sixteen missiles arriving three days after the exercise; none operational on the 11th'}, lid, query)
    for lid, name, query in NATO_HQ:
        add({'side': 'nato', 'kind': 'hq', 'name': name, 'evidence': 'documented', 'source': 'SHAPE exercise report and Seventh Air Division after-action report (NSA EBB 427) for the headquarters; the ports are the Reforger record', 'note': 'A headquarters or port, drawn as a target'}, lid, query)
    for lid, name, query, country, aircraft, n, evidence in SOVIET_AIR:
        add({'side': 'wp', 'kind': 'air', 'name': name, 'country': country, 'aircraft': aircraft, 'count': n, 'alertWeapons': int(n * SOVIET_AIR_ALERT) * SOVIET_AIR_WEAPONS, 'generatedWeapons': n * SOVIET_AIR_WEAPONS, 'yieldKt': SOVIET_AIR_KT, 'evidence': evidence, 'source': 'Wikipedia, 16th Air Army and Northern Group of Forces for the bases and divisions; the CIA NID of 10 November 1983 and the 1989 memorandum for the alert (NSA EBB 2021-02-17)', 'note': f'{n} aircraft; half armed at thirty-minute alert with one weapon of about {SOVIET_AIR_KT} kt, inferred from "warheads placed on 4th Air Army bombers" and "fighter-bombers at 30-minute alert"'}, lid, query)
    for lid, name, query, country, missile, launchers, kt, evidence in SOVIET_MISSILE:
        add({'side': 'wp', 'kind': 'missile', 'name': name, 'country': country, 'missile': missile, 'launchers': launchers, 'weapons': launchers, 'yieldKt': kt, 'rangeKm': SOVIET_MISSILE_RANGE_KM, 'evidence': evidence, 'source': 'Wikipedia, Northern Group of Forces (the 114th at Legnica); GSFG garrisons reconstructed', 'note': 'Twelve launchers a brigade with one warhead each; the SS-12 brigades of 1984 had not yet arrived'}, lid, query)
    for (lid, name, query), n in zip(SS20, spread(SS20_LAUNCHERS_WEST, len(SS20))):
        add({'side': 'wp', 'kind': 'ss20', 'name': name, 'country': 'SU', 'missile': 'RSD-10 / SS-20', 'launchers': n, 'weapons': n * SS20_WARHEADS, 'yieldKt': SS20_KT, 'rangeKm': SS20_RANGE_KM, 'evidence': 'reconstructed', 'source': 'Wikipedia, RSD-10 Pioneer: 435 missiles at 48 sites by 1986, three 150 kt warheads; the western share and its garrisons reconstructed', 'note': f'{SS20_LAUNCHERS_WEST} launchers facing Europe spread over five garrisons'}, lid, query)
    for lid, name, query in SOVIET_HQ:
        add({'side': 'wp', 'kind': 'hq', 'name': name, 'evidence': 'documented', 'source': 'Wikipedia, Group of Soviet Forces in Germany; Northern Group of Forces', 'note': 'A headquarters, drawn as a target'}, lid, query)

    out = {
        'date': '11 November 1983',
        'rules': {
            'qra': {'perBase': QRA_PER_BASE, 'weaponsPerAircraft': QRA_WEAPONS_PER_AIRCRAFT, 'generatedWeaponsPerAircraft': GENERATED_WEAPONS_PER_AIRCRAFT},
            'pershing': {'launchers': 108, 'yieldKt': PERSHING_KT, 'rangeKm': PERSHING_RANGE_KM},
            'glcm': {'arriving': GLCM[3], 'yieldKt': GLCM[4]},
            'sovietAir': {'alertFraction': SOVIET_AIR_ALERT, 'weaponsPerAircraft': SOVIET_AIR_WEAPONS, 'yieldKt': SOVIET_AIR_KT},
            'sovietMissile': {'launchersPerBrigade': 12, 'rangeKm': SOVIET_MISSILE_RANGE_KM},
            'ss20': {'launchersWest': SS20_LAUNCHERS_WEST, 'warheads': SS20_WARHEADS, 'yieldKt': SS20_KT},
        },
        'sites': sites,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(sites), 'sites written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
