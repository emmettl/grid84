#!/usr/bin/env python3
"""The V-force at its peak, and the two profiles it flew.

Bomber Command's medium bomber force reached its greatest strength in the
middle of 1964, at about 159 aircraft. The main operating bases and the
aircraft on them are the open literature's; the squadron numbers moved
between bases through the period and are given as they stood in 1964. The
front-line strength held at each base is reconstructed by dividing the
fleet across the bases in the proportions the squadron establishments give,
not read from a return, and is marked as such.

Sources: Humphrey Wynn, RAF Nuclear Deterrent Forces (HMSO, 1994), the
official history; the annual Statements on the Defence Estimates; the
standard type histories for the Valiant, Vulcan and Victor.

Usage: python3 scripts/build-v-force-1964.py --out data/britain/v-force-1964.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

WYNN = 'Humphrey Wynn, RAF Nuclear Deterrent Forces (HMSO, 1994); the Statements on the Defence Estimates; standard type histories'

# name, lon, lat, type, squadrons, aircraft, weapon, weapons per aircraft, note
BASES = [
    ('RAF Scampton', -0.5508, 53.3078, 'Vulcan B.2', '27, 83, 617 Squadrons', 24, 'Blue Steel', 1,
     'The Blue Steel wing: one missile per aircraft, released short of the target while the bomber turned away'),
    ('RAF Wittering', -0.4761, 52.6125, 'Victor B.2', '100, 139 Squadrons', 16, 'Blue Steel', 1,
     'The second Blue Steel wing, worked up through 1964'),
    ('RAF Waddington', -0.5236, 53.1662, 'Vulcan B.2', '44, 50, 101 Squadrons', 24, 'Yellow Sun Mk 2', 1,
     'Free-fall megaton weapons'),
    ('RAF Coningsby', -0.1661, 53.0930, 'Vulcan B.2', '9, 12, 35 Squadrons', 24, 'Yellow Sun Mk 2', 1, ''),
    ('RAF Cottesmore', -0.6486, 52.7358, 'Victor B.1A', '10, 15 Squadrons', 16, 'Yellow Sun Mk 2', 1, ''),
    ('RAF Honington', 0.7728, 52.3428, 'Victor B.1A', '55, 57 Squadrons', 16, 'Yellow Sun Mk 2', 1, ''),
    ('RAF Finningley', -1.0047, 53.4747, 'Vulcan B.1A', '230 OCU and the Vulcan B.1A wing', 16, 'Yellow Sun Mk 1', 1, ''),
    ('RAF Marham', 0.5506, 52.6483, 'Valiant B.1', '49, 148, 207, 214 Squadrons', 23, 'Red Beard and Yellow Sun Mk 1', 1,
     'The Valiants were withdrawn in 1965 when fatigue cracks were found in the wing spars, a consequence of the low-level role'),
]

# The dispersal scheme: four aircraft to an airfield, so a first strike cannot find the force on eight stations.
DISPERSAL_AIRFIELDS = 36
DISPERSAL_PER_AIRFIELD = 4

PROFILES = {
    'high': {
        'name': 'High level, as built',
        'year': 1962,
        'cruiseAltitudeMetres': 15_240,
        'descendAtMetres': None,
        'blueSteelRangeMetres': 185_000,
        'speedMs': 250,
        'note': 'The profile the force was designed for: cruise at fifty thousand feet, above the guns, Blue Steel away a hundred nautical miles out. On 1 May 1960 an SA-2 brought down a U-2 at seventy thousand feet over Sverdlovsk and the argument for it ended.',
    },
    'low': {
        'name': 'Low level, as flown',
        'year': 1964,
        'cruiseAltitudeMetres': 13_700,
        'descendAtMetres': 700_000,
        'blueSteelRangeMetres': 74_000,
        'speedMs': 235,
        'note': 'The profile adopted from 1963: transit high, then down to about three hundred feet for the run in, under the radar horizon of the missile belts. Blue Steel lost most of its range on a low-level launch, the aircraft lost fuel and endurance, and the Valiant lost its wings.',
    },
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    bases = []
    for i, (name, lon, lat, kind, squadrons, aircraft, weapon, per, note) in enumerate(BASES):
        bases.append({
            'id': name.lower().replace('raf ', '').replace(' ', '-'), 'name': name, 'lon': lon, 'lat': lat,
            'aircraft': kind, 'squadrons': squadrons, 'strength': aircraft, 'weapon': weapon, 'weaponsPerAircraft': per,
            'note': note, 'evidence': 'reconstructed', 'positionEvidence': 'documented', 'source': WYNN,
        })
    total = sum(b['strength'] for b in bases)
    out = {
        'year': 1964,
        'note': f'The V-force at its peak: {total} aircraft on eight main bases, about the 159 the official history gives for June 1964. '
                f'Squadron numbers are as they stood in 1964; the strength at each base is reconstructed from the squadron establishments, not read from a return.',
        'source': WYNN,
        'strength': total,
        'dispersal': {'airfields': DISPERSAL_AIRFIELDS, 'perAirfield': DISPERSAL_PER_AIRFIELD,
                      'note': 'On alert the force dispersed in fours to dozens of civil and military airfields, so that no counterforce strike could catch it on eight stations. Quick reaction alert from 1962 held aircraft at fifteen minutes and later at cockpit readiness.'},
        'profiles': PROFILES,
        'bases': bases,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(f'{len(bases)} bases, {total} aircraft')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
