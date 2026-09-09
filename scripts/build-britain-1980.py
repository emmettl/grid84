#!/usr/bin/env python3
"""Build the sites of the Britain study: the target categories the record names
for Square Leg, the regional government headquarters, the ROC group controls,
and the launchers that would have fired.

The Square Leg bomb plot is withheld: the Ministry refused the 2009 and 2011
requests and the 1980 written answer declined to name targets. What the
record gives is the totals (131 weapons and 205 Mt in Campbell's count, 69
ground and 62 air bursts; 150 and 280.5 Mt in the later count), the timing
(the first strike from 12:01 to 12:10, the second drifting in from 13:00 to
15:00), the southerly wind, and the categories of target that Campbell and
Openshaw describe: the nuclear-capable and American airfields, the naval
bases and ports, the command and warning sites, and the cities with inner
London left out. This script names the sites in those categories from the
public record of 1980 and geocodes them; the study assigns the documented
totals over them by a stated rule and labels every mark reconstructed.

Usage: python3 scripts/build-britain-1980.py --out data/britain/sites-1980.json
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

PHOTON = 'https://photon.komoot.io/api/'

# (id, name, query, category)
MILITARY = [
    ('lakenheath', 'RAF Lakenheath · USAF F-111', 'RAF Lakenheath', 'airfield'),
    ('mildenhall', 'RAF Mildenhall · USAF tankers and SR-71', 'RAF Mildenhall', 'airfield'),
    ('upper-heyford', 'RAF Upper Heyford · USAF F-111', 'Upper Heyford', 'airfield'),
    ('alconbury', 'RAF Alconbury · USAF', 'RAF Alconbury', 'airfield'),
    ('bentwaters', 'RAF Bentwaters and Woodbridge · USAF A-10', 'Bentwaters Parks', 'airfield'),
    ('greenham', 'RAF Greenham Common · cruise missiles from 1983', 'Greenham Common', 'airfield'),
    ('fairford', 'RAF Fairford', 'RAF Fairford', 'airfield'),
    ('brize-norton', 'RAF Brize Norton', 'RAF Brize Norton', 'airfield'),
    ('marham', 'RAF Marham · Victor tankers', 'RAF Marham', 'airfield'),
    ('honington', 'RAF Honington · Buccaneer and Tornado', 'RAF Honington', 'airfield'),
    ('wittering', 'RAF Wittering · Harrier', 'RAF Wittering', 'airfield'),
    ('coningsby', 'RAF Coningsby · Phantom', 'RAF Coningsby', 'airfield'),
    ('waddington', 'RAF Waddington · Vulcan', 'RAF Waddington', 'airfield'),
    ('scampton', 'RAF Scampton · Vulcan', 'RAF Scampton', 'airfield'),
    ('leuchars', 'RAF Leuchars · Phantom', 'Leuchars', 'airfield'),
    ('lossiemouth', 'RAF Lossiemouth · Buccaneer', 'RAF Lossiemouth', 'airfield'),
    ('kinloss', 'RAF Kinloss · Nimrod', 'Kinloss', 'airfield'),
    ('st-mawgan', 'RAF St Mawgan · Nimrod', 'Newquay Airport', 'airfield'),
    ('boscombe-down', 'Boscombe Down', 'Boscombe Down', 'airfield'),
    ('wyton', 'RAF Wyton', 'RAF Wyton', 'airfield'),
    ('sculthorpe', 'RAF Sculthorpe · USAF standby', 'Sculthorpe', 'airfield'),
    ('wethersfield', 'RAF Wethersfield · USAF', 'Wethersfield', 'airfield'),
    ('molesworth', 'RAF Molesworth · cruise missiles planned', 'Molesworth', 'airfield'),
    ('machrihanish', 'RAF Machrihanish', 'Campbeltown Airport', 'airfield'),
    ('brawdy', 'RAF Brawdy · US SOSUS', 'Brawdy', 'airfield'),
    ('finningley', 'RAF Finningley', 'Doncaster Sheffield Airport', 'airfield'),
    ('cottesmore', 'RAF Cottesmore · Tornado', 'Cottesmore', 'airfield'),
    ('coltishall', 'RAF Coltishall · Jaguar', 'Coltishall', 'airfield'),
    ('binbrook', 'RAF Binbrook · Lightning', 'Binbrook', 'airfield'),
    ('leeming', 'RAF Leeming', 'RAF Leeming', 'airfield'),
    ('faslane', 'Faslane · Polaris base', 'Faslane', 'naval'),
    ('coulport', 'Coulport · Polaris warheads', 'Coulport', 'naval'),
    ('holy-loch', 'Holy Loch · US Poseidon tender', 'Kilmun', 'naval'),
    ('rosyth', 'Rosyth dockyard', 'Rosyth', 'naval'),
    ('devonport', 'Devonport dockyard', 'Devonport, Plymouth', 'naval'),
    ('portsmouth', 'Portsmouth naval base', 'Portsmouth', 'naval'),
    ('chatham', 'Chatham dockyard', 'Chatham', 'naval'),
    ('portland', 'Portland naval base', 'Portland, Dorset', 'naval'),
    ('liverpool', 'Liverpool docks', 'Liverpool', 'port'),
    ('southampton', 'Southampton docks', 'Southampton', 'port'),
    ('hull', 'Hull docks', 'Kingston upon Hull', 'port'),
    ('tilbury', 'Tilbury docks', 'Tilbury', 'port'),
    ('felixstowe', 'Felixstowe', 'Felixstowe', 'port'),
    ('milford-haven', 'Milford Haven oil terminals', 'Milford Haven', 'port'),
    ('teesside', 'Teesside · Teesport and ICI', 'Middlesbrough', 'port'),
    ('tyne', 'Tyneside docks', 'North Shields', 'port'),
    ('grangemouth', 'Grangemouth refinery', 'Grangemouth', 'port'),
    ('northwood', 'Northwood · CINCFLEET and Eastern Atlantic HQ', 'Northwood, London', 'command'),
    ('high-wycombe', 'High Wycombe · Strike Command HQ', 'RAF High Wycombe', 'command'),
    ('fylingdales', 'Fylingdales · BMEWS', 'RAF Fylingdales', 'command'),
    ('menwith-hill', 'Menwith Hill', 'Menwith Hill', 'command'),
    ('corsham', 'Corsham · the central government war headquarters', 'Corsham', 'command'),
    ('rugby', 'Rugby radio station · VLF to the submarines', 'Hillmorton', 'command'),
    ('oakhanger', 'Oakhanger · Skynet', 'Oakhanger', 'command'),
    ('aldermaston', 'Aldermaston · AWRE', 'Aldermaston', 'command'),
    ('burghfield', 'Burghfield · ROF', 'Burghfield', 'command'),
    ('chicksands', 'Chicksands · USAF signals', 'Chicksands', 'command'),
]
# Regional Government Headquarters of the 1980s (Wikipedia, Regional Seats of Government).
RGHQ = [
    ('cultybraggan', 'Scotland · Cultybraggan', 'Comrie, Perth and Kinross'),
    ('hexham', 'Region 1 · Hexham', 'Hexham'),
    ('skendleby', 'Region 3 · Skendleby', 'Skendleby'),
    ('loughborough', 'Region 3 · Loughborough', 'Loughborough'),
    ('bawburgh', 'Region 4 · Bawburgh', 'Bawburgh'),
    ('hertford', 'Region 4 · Hertford', 'Hertford'),
    ('kelvedon-hatch', 'Region 5 · Kelvedon Hatch', 'Kelvedon Hatch'),
    ('crowborough', 'Region 6 · Crowborough', 'Crowborough'),
    ('bolt-head', 'Region 7 · Hope Cove', 'Hope Cove'),
    ('chilmark', 'Region 7 · Chilmark', 'Chilmark'),
    ('brackla', 'Wales · Brackla', 'Brackla, Bridgend'),
    ('wrexham', 'Wales · Wrexham', 'Wrexham'),
    ('drakelow', 'Region 9 · Drakelow', 'Kinver'),
    ('swynnerton', 'Region 9 · Swynnerton', 'Swynnerton'),
    ('hack-green', 'Region 10 · Hack Green', 'Hack Green'),
    ('goosnargh', 'Region 10 · Goosnargh', 'Goosnargh'),
    ('ballymena', 'Northern Ireland · Ballymena', 'Ballymena'),
]
# ROC group controls, 1968 to 1991 (Wikipedia, List of ROC Group Headquarters).
ROC = [(1, 'Maidstone'), (2, 'Horsham'), (3, 'Oxford'), (4, 'Colchester'), (5, 'Watford'), (6, 'Norwich'), (7, 'Bedford'), (8, 'Coventry'), (9, 'Yeovil'), (10, 'Exeter'), (11, 'Truro'), (12, 'Bristol'), (13, 'Carmarthen'), (14, 'Winchester'), (15, 'Lincoln'), (16, 'Shrewsbury'), (17, 'Wrexham'), (18, 'Leeds'), (19, 'Manchester'), (20, 'York'), (21, 'Preston'), (22, 'Carlisle'), (24, 'Edinburgh'), (25, 'Ayr'), (27, 'Oban'), (28, 'Dundee'), (29, 'Aberdeen'), (30, 'Inverness'), (31, 'Belfast')]

HAND = {
    'coulport': (-4.88, 56.05),
    'faslane': (-4.82, 56.06),
    'holy-loch': (-4.93, 55.98),
    'fylingdales': (-0.67, 54.36),
    'menwith-hill': (-1.69, 54.01),
    'boscombe-down': (-1.75, 51.16),
    'greenham': (-1.29, 51.38),
    'upper-heyford': (-1.25, 51.94),
    'molesworth': (-0.42, 52.39),
    'bentwaters': (1.43, 52.13),
    'sculthorpe': (0.76, 52.85),
    'wethersfield': (0.51, 51.97),
    'brawdy': (-5.11, 51.88),
    'cottesmore': (-0.65, 52.73),
    'coltishall': (1.36, 52.75),
    'binbrook': (-0.2, 53.45),
    'oakhanger': (-0.9, 51.12),
    'rugby': (-1.2, 52.36),
    'northwood': (-0.42, 51.62),
    'high-wycombe': (-0.8, 51.68),
    'corsham': (-2.19, 51.42),
    'burghfield': (-1.05, 51.41),
    'chicksands': (-0.37, 52.04),
    'bolt-head': (-3.83, 50.24),
    'hack-green': (-2.52, 53.03),
    'drakelow': (-2.27, 52.42),
    'skendleby': (0.12, 53.2),
    'bawburgh': (1.18, 52.62),
    'kelvedon-hatch': (0.28, 51.66),
    'cultybraggan': (-3.95, 56.36),
}


def geocode(query):
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
    g = geocode(query + ', United Kingdom')
    time.sleep(1.0)
    if not g:
        print('NO MATCH', lid, query)
        return None
    return g


def main():
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

    for lid, name, query, cat in MILITARY:
        add({'kind': 'target', 'category': cat, 'name': name, 'evidence': 'reconstructed', 'source': 'Campbell, War Plan UK (1982) and Openshaw, Steadman and Greene, Doomsday (1983) for the categories; the site list is the public record of 1980', 'note': f'A {cat} in the categories Square Leg struck; whether it was on the plot is withheld'}, lid, query)
    for lid, name, query in RGHQ:
        add({'kind': 'rghq', 'name': f'RGHQ · {name}', 'evidence': 'documented', 'source': 'Wikipedia, Regional Seats of Government: the final Cold War configuration', 'note': 'A regional government headquarters, drawn where it was; Square Leg assumed the bunkers intact'}, lid, query)
    for n, town in ROC:
        add({'kind': 'roc', 'name': f'ROC No {n} Group · {town}', 'evidence': 'documented', 'source': 'Wikipedia, List of ROC Group Headquarters and UKWMO Sector controls', 'note': 'A group control of the Royal Observer Corps, where the fallout would have been read from the monitoring posts'}, f'roc-{n}', town)
    out = {
        'date': '19 September 1980',
        'documented': {
            'weapons': {'campbell': 131, 'later': 150, 'megatonsCampbell': 205, 'megatonsLater': 280.5, 'groundBursts': 69, 'airBursts': 62, 'openshawPlot': 127, 'yieldRangeKt': [500, 3000], 'source': 'Campbell, War Plan UK (1982); Wikipedia, Square Leg; Openshaw, Steadman and Greene, Doomsday (1983): a partial plot of 127 strikes, 68 ground and 59 air'},
            'timing': {'firstStrike': '12:01 to 12:10 on 19 September', 'secondStrike': 'from 13:00, drifting in until 15:00', 'source': 'Wikipedia, Square Leg, from the exercise papers'},
            'wind': {'from': 'south', 'source': 'Wikipedia, Square Leg: the exercise presumed a prevailing southerly wind at the time of attack'},
            'innerLondon': {'struck': False, 'source': 'Wikipedia, Square Leg: no targets in inner London were struck, though peripheral damage devastated much of it'},
            'homeOffice1982': {'blastDead': 8_500_000, 'radiationDead': 2_500_000, 'severelyInjured': 2_000_000, 'uninjured': 41_000_000, 'source': 'Home Office estimate of 1982, via Campbell'},
            'openshaw1983': {'dead': 29_000_000, 'seriouslyInjured': 7_000_000, 'uninjured': 19_000_000, 'source': 'Openshaw, Steadman and Greene, Doomsday (1983)'},
            'strath1955': {'bombs': 10, 'yieldMt': 10, 'dead': 12_000_000, 'casualties': 16_000_000, 'seriouslyInjured': 4_000_000, 'source': 'Hennessy, The Secret State (2010), pp. 167–172; the report of 1955, classified until 2002'},
        },
        'sites': sites,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(sites), 'sites written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
