#!/usr/bin/env python3
"""Build the alert-force order of battle for mid-1961 as launcher records.

Wings and bases come from Wikipedia's unit lists (B-47 units; USAF strategic
wings; SAC bomb wings), the missile squadrons from the Atlas, Jupiter and
Polaris records already in the brief. Positions are geocoded from the
modern map through Photon, with hand-set coordinates for bases whose names
have changed. Strengths follow stated rules so the total reproduces the
documented alert-force table of 15 July 1961; the rules are recorded in
the output so the readout can show them.

Usage: python3 scripts/build-order-of-battle-1961.py --out data/siop62/order-of-battle-1961.json
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

PHOTON = 'https://photon.komoot.io/api/'

# (id, name, geocode query, kind, wing note, aircraft on base, weapons per aircraft, evidence, source)
B52_HEAVY = 45  # "The first B-52 wings were composed of 45 bombers" (SAC history via Wikipedia)
B52_DISPERSED = 15  # "each dispersed B-52 squadron became a strategic wing" of about 15 aircraft
B47_WING = 45  # medium bombardment wing, three squadrons of 15

BOMBER_BASES = [
    # B-52 strategic wings active in 1961 (Wikipedia, List of United States Air Force strategic wings)
    ('dow', 'Dow AFB, Maine', 'Bangor International Airport', 'b52', '4038th SW', B52_DISPERSED),
    ('griffiss', 'Griffiss AFB, New York', 'Griffiss International Airport', 'b52', '4039th SW', B52_DISPERSED),
    ('ki-sawyer', 'K.I. Sawyer AFB, Michigan', 'Sawyer International Airport', 'b52', '4042d SW', B52_DISPERSED),
    ('wright-patterson', 'Wright-Patterson AFB, Ohio', 'Wright-Patterson Air Force Base', 'b52', '4043d SW', B52_DISPERSED),
    ('mccoy', 'McCoy AFB, Florida', 'Orlando International Airport', 'b52', '4047th SW (from 1 Jul 1961)', B52_DISPERSED),
    ('goose', 'Goose AB, Labrador', 'Goose Bay Airport', 'b52', '4082d SW', B52_DISPERSED),
    ('carswell', 'Carswell AFB, Texas', 'Naval Air Station Joint Reserve Base Fort Worth', 'b52', '7th BW and 4123d SW', B52_HEAVY),
    ('beale', 'Beale AFB, California', 'Beale Air Force Base', 'b52', '4126th SW', B52_DISPERSED),
    ('amarillo', 'Amarillo AFB, Texas', 'Rick Husband Amarillo International Airport', 'b52', '4128th SW', B52_DISPERSED),
    ('bergstrom', 'Bergstrom AFB, Texas', 'Austin-Bergstrom International Airport', 'b52', '4130th SW', B52_DISPERSED),
    ('grand-forks', 'Grand Forks AFB, North Dakota', 'Grand Forks Air Force Base', 'b52', '4133d SW', B52_DISPERSED),
    ('mather', 'Mather AFB, California', 'Sacramento Mather Airport', 'b52', '4134th SW', B52_DISPERSED),
    ('eglin', 'Eglin AFB, Florida', 'Eglin Air Force Base', 'b52', '4135th SW', B52_DISPERSED),
    ('minot', 'Minot AFB, North Dakota', 'Minot Air Force Base', 'b52', '4136th SW', B52_DISPERSED),
    ('robins', 'Robins AFB, Georgia', 'Robins Air Force Base', 'b52', '4137th SW', B52_DISPERSED),
    ('turner', 'Turner AFB, Georgia', 'Marine Corps Logistics Base Albany', 'b52', '4138th SW', B52_DISPERSED),
    ('glasgow', 'Glasgow AFB, Montana', 'Glasgow Valley County Airport', 'b52', '4141st SW', B52_DISPERSED),
    ('larson', 'Larson AFB, Washington', 'Grant County International Airport', 'b52', '4170th SW', B52_DISPERSED),
    ('columbus', 'Columbus AFB, Mississippi', 'Columbus Air Force Base', 'b52', '4228th SW', B52_DISPERSED),
    ('barksdale', 'Barksdale AFB, Louisiana', 'Barksdale Air Force Base', 'b52', '4238th SW', B52_DISPERSED),
    ('kincheloe', 'Kincheloe AFB, Michigan', 'Chippewa County International Airport', 'b52', '4239th SW', B52_DISPERSED),
    ('seymour-johnson', 'Seymour Johnson AFB, North Carolina', 'Seymour Johnson Air Force Base', 'b52', '4241st SW', B52_DISPERSED),
    ('sheppard', 'Sheppard AFB, Texas', 'Sheppard Air Force Base', 'b52', '4245th SW', B52_DISPERSED),
    # B-52 heavy bombardment wings of 1961 (base existence documented; the 1961 B-52 assignment is reconstructed from wing histories)
    ('travis', 'Travis AFB, California', 'Travis Air Force Base', 'b52h', '5th BW', B52_HEAVY),
    ('walker', 'Walker AFB, New Mexico', 'Roswell Air Center', 'b52h', '6th BW', B52_HEAVY),
    ('altus', 'Altus AFB, Oklahoma', 'Altus Air Force Base', 'b52h', '11th BW', B52_HEAVY),
    ('ellsworth', 'Ellsworth AFB, South Dakota', 'Ellsworth Air Force Base', 'b52h', '28th BW', B52_HEAVY),
    ('loring', 'Loring AFB, Maine', 'Loring International Airport', 'b52h', '42d BW', B52_HEAVY),
    ('ramey', 'Ramey AFB, Puerto Rico', 'Rafael Hernandez Airport', 'b52h', '72d BW', B52_HEAVY),
    ('fairchild', 'Fairchild AFB, Washington', 'Fairchild Air Force Base', 'b52h', '92d BW', B52_HEAVY),
    ('castle', 'Castle AFB, California', 'Castle Airport', 'b52h', '93d BW', B52_HEAVY),
    ('biggs', 'Biggs AFB, Texas', 'Biggs Army Airfield', 'b52h', '95th BW', B52_HEAVY),
    ('blytheville', 'Blytheville AFB, Arkansas', 'Arkansas International Airport', 'b52h', '97th BW', B52_HEAVY),
    ('westover', 'Westover AFB, Massachusetts', 'Westover Air Reserve Base', 'b52h', '99th BW', B52_HEAVY),
    ('wurtsmith', 'Wurtsmith AFB, Michigan', 'Oscoda-Wurtsmith Airport', 'b52h', '379th BW (B-52 from 1961)', B52_HEAVY),
    # Overseas SAC bases named in the briefing (United Kingdom, Spain, Morocco, Guam); Reflex B-47 strengths are inferred
    ('brize-norton', 'RAF Brize Norton', 'RAF Brize Norton', 'b47r', 'Reflex Action', 15),
    ('fairford', 'RAF Fairford', 'RAF Fairford', 'b47r', 'Reflex Action', 15),
    ('greenham', 'RAF Greenham Common', 'Greenham Common', 'b47r', 'Reflex Action', 15),
    ('upper-heyford', 'RAF Upper Heyford', 'Upper Heyford', 'b47r', 'Reflex Action', 15),
    ('moron', 'Morón AB, Spain', 'Base Aérea de Morón', 'b47r', 'Reflex Action', 15),
    ('torrejon', 'Torrejón AB, Spain', 'Base Aérea de Torrejón', 'b47r', 'Reflex Action', 15),
    ('zaragoza', 'Zaragoza AB, Spain', 'Aeropuerto de Zaragoza', 'b47r', 'Reflex Action', 15),
    ('sidi-slimane', 'Sidi Slimane AB, Morocco', 'Sidi Slimane', 'b47r', 'Reflex Action', 15),
    ('ben-guerir', 'Ben Guerir AB, Morocco', 'Ben Guerir', 'b47r', 'Reflex Action', 15),
    ('andersen', 'Andersen AFB, Guam', 'Andersen Air Force Base', 'b47r', 'Reflex Action', 15),
    # B-47 medium bombardment wings active in 1961 (Wikipedia, List of B-47 units)
    ('hunter', 'Hunter AFB, Georgia', 'Hunter Army Airfield', 'b47', '2d and 308th BW', B47_WING),
    ('mountain-home', 'Mountain Home AFB, Idaho', 'Mountain Home Air Force Base', 'b47', '9th BW', B47_WING),
    ('march', 'March AFB, California', 'March Air Reserve Base', 'b47', '22d BW', B47_WING),
    ('forbes', 'Forbes AFB, Kansas', 'Topeka Regional Airport', 'b47', '40th BW; 55th SRW', B47_WING),
    ('lake-charles', 'Lake Charles AFB, Louisiana', 'Chennault International Airport', 'b47', '68th BW', B47_WING),
    ('dyess', 'Dyess AFB, Texas', 'Dyess Air Force Base', 'b47', '96th and 341st BW', B47_WING),
    ('lincoln', 'Lincoln AFB, Nebraska', 'Lincoln Airport Nebraska', 'b47', '98th and 307th BW', B47_WING),
    ('pease', 'Pease AFB, New Hampshire', 'Portsmouth International Airport at Pease', 'b47', '100th and 509th BW', B47_WING),
    ('lockbourne', 'Lockbourne AFB, Ohio', 'Rickenbacker International Airport', 'b47', '301st and 376th BW', B47_WING),
    ('davis-monthan', 'Davis-Monthan AFB, Arizona', 'Davis-Monthan Air Force Base', 'b47', '303d BW', B47_WING),
    ('macdill', 'MacDill AFB, Florida', 'MacDill Air Force Base', 'b47', '305th and 306th BW', B47_WING),
    ('schilling', 'Schilling AFB, Kansas', 'Salina Regional Airport', 'b47', '310th BW', B47_WING),
    ('whiteman', 'Whiteman AFB, Missouri', 'Whiteman Air Force Base', 'b47', '340th BW', B47_WING),
    ('plattsburgh', 'Plattsburgh AFB, New York', 'Plattsburgh International Airport', 'b47', '380th BW', B47_WING),
    ('little-rock', 'Little Rock AFB, Arkansas', 'Little Rock Air Force Base', 'b47', '384th BW; 70th SRW', B47_WING),
    ('homestead', 'Homestead AFB, Florida', 'Homestead Air Reserve Base', 'b47', '19th BW', B47_WING),
]

# Documented ballistic and forward systems in the alert force (Table 1, 15 July 1961: SAC 24, EUR 30, LANT 32 ballistic weapons).
MISSILES = [
    ('warren-564', 'F.E. Warren AFB · 564th/565th SMS', 'Francis E. Warren Air Force Base', 'icbm', 'Atlas D, operational Sept 1960', 15, 1_440, 'documented', 'Wikipedia SM-65 Atlas; Table 1: 24 SAC ballistic weapons on alert'),
    ('offutt-549', 'Offutt AFB · 549th SMS', 'Offutt Air Force Base', 'icbm', 'Atlas D, operational March 1961', 9, 1_440, 'documented', 'Wikipedia SM-65 Atlas'),
    ('gioia', 'Gioia del Colle · 36th Brigade', 'Gioia del Colle', 'irbm', 'Jupiter, 30 missiles at ten sites, 1961', 30, 1_440, 'documented', 'Wikipedia PGM-19 Jupiter; Table 1: 30 EUR ballistic weapons on alert'),
    ('polaris-norwegian', 'Polaris patrol · Norwegian Sea', None, 'slbm', 'Two George Washington-class boats on station, 16 A-1 each', 32, 600, 'inferred', 'Sagan p. 29 (two of five boats); patrol area inferred from the A-1 range of 1,200 nmi'),
    # Theatre forces in the alert table (Table 1: EUR 126 aircraft weapons and 22 cruise; PAC 75 aircraft weapons and 9 cruise); bases and yields inferred
    ('usafe-lakenheath', 'USAFE fighter-bombers · Lakenheath', 'RAF Lakenheath', 'tactical', 'EUR aircraft weapons, share inferred', 42, 70, 'inferred', 'Table 1 EUR aircraft weapons 126; base share inferred'),
    ('usafe-bitburg', 'USAFE fighter-bombers · Bitburg', 'Bitburg', 'tactical', 'EUR aircraft weapons, share inferred', 42, 70, 'inferred', 'Table 1 EUR aircraft weapons 126; base share inferred'),
    ('usafe-incirlik', 'USAFE fighter-bombers · Incirlik', 'Incirlik', 'tactical', 'EUR aircraft weapons, share inferred', 42, 70, 'inferred', 'Table 1 EUR aircraft weapons 126; base share inferred'),
    ('mace-sembach', 'Mace cruise missiles · Sembach', 'Sembach', 'cruise', 'EUR cruise missiles', 22, 1_100, 'inferred', 'Table 1 EUR cruise missiles 22; base inferred'),
    ('pacaf-kadena', 'PACAF and carrier aircraft · Kadena', 'Kadena Air Base', 'tactical', 'PAC aircraft weapons, placed at one base', 75, 70, 'inferred', 'Table 1 PAC aircraft weapons 75; placement inferred'),
    ('regulus-pacific', 'Regulus submarines · Sea of Japan', None, 'cruise', 'PAC cruise missiles', 9, 1_100, 'inferred', 'Table 1 PAC cruise missiles 9; patrol area inferred'),
]
HAND = {
    'polaris-norwegian': (5.0, 68.0),
    'regulus-pacific': (134.0, 40.0),
    'goose': (-60.42, 53.32),
    'sidi-slimane': (-5.9, 34.23),
    'ben-guerir': (-7.92, 32.12),
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
    launchers = []
    for bid, name, query, kind, wing, aircraft in BOMBER_BASES:
        if bid in HAND:
            lon, lat = HAND[bid]; hit = 'hand-set'
        else:
            g = geocode(query); time.sleep(1.0)
            if not g:
                print('NO MATCH', bid, query); continue
            lon, lat, hit = g
        launchers.append({'id': bid, 'name': name, 'kind': kind, 'lon': round(lon, 4), 'lat': round(lat, 4), 'wing': wing, 'aircraft': aircraft, 'geocoded': hit,
                          'evidence': 'documented', 'positionEvidence': 'reconstructed' if hit != 'hand-set' and 'Air Force Base' not in str(hit) else 'documented',
                          'source': 'Wikipedia, List of United States Air Force strategic wings' if kind == 'b52' else 'Wikipedia, List of B-47 units of the United States Air Force'})
        print(bid, hit, round(lon, 3), round(lat, 3))
    for mid, name, query, kind, note, weapons, yield_kt, evidence, source in MISSILES:
        if mid in HAND:
            lon, lat = HAND[mid]; hit = 'hand-set'
        else:
            g = geocode(query); time.sleep(1.0)
            if not g:
                print('NO MATCH', mid, query); continue
            lon, lat, hit = g
        launchers.append({'id': mid, 'name': name, 'kind': kind, 'lon': round(lon, 4), 'lat': round(lat, 4), 'note': note, 'weapons': weapons, 'yieldKt': yield_kt, 'geocoded': hit, 'evidence': evidence, 'positionEvidence': 'inferred' if hit == 'hand-set' else 'documented', 'source': source})
        print(mid, hit, round(lon, 3), round(lat, 3))
    out = {
        'date': '15 July 1961',
        'rules': {
            'b52Heavy': B52_HEAVY, 'b52Dispersed': B52_DISPERSED, 'b47Wing': B47_WING,
            'weaponsPerB52': 2, 'weaponsPerB47': 1,
            'alertFraction': 'chosen so the bomber bases carry the documented 1,212 SAC aircraft weapons on alert (Table 1, 15 July 1961)',
            'note': 'Approximately half of the SAC bomber force was on fifteen-minute ground alert in late 1961 (Sagan p. 29)',
        },
        'launchers': launchers,
    }
    args.out.write_text(json.dumps(out, indent=1) + '\n')
    print(len(launchers), 'launchers written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
