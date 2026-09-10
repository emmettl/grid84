#!/usr/bin/env python3
"""The nine arsenals of 2025 as launch points the atlas can vector from.

One entry per system and place: the base, field, airfield or patrol area,
the system, its warheads per missile, yield and range. Positions of bases
are the public ones and are reconstructed; patrol areas are inferred from
the open literature; yields of the undeclared or opaque arsenals are
inferred and said so. Sources: Kristensen, Korda, Johns and Knight, the
Nuclear Notebook series in the Bulletin of the Atomic Scientists (2023
to 2025) for every power; SIPRI Yearbook 2025; Wikipedia for the places.

Usage: python3 scripts/build-forces-2025.py --out data/atlas/forces-2025.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

NOTEBOOK = 'Kristensen, Korda, Johns and Knight, Nuclear Notebook (Bulletin of the Atomic Scientists, 2023-2025); SIPRI Yearbook 2025'

# side, name, kind, system, warheads per missile, yield kt, range km, lon, lat, evidence of the position, evidence of the load, note
# Bombers and submarine cruise systems carry a standoff in STANDOFF below: how far short of the target the missiles are released.
def slugify(text: str) -> str:
    slug = ''.join(c if c.isalnum() else '-' for c in text.lower())
    while '--' in slug:
        slug = slug.replace('--', '-')
    return slug.strip('-')


def site_ids(sites) -> dict:
    """Stable ids: the side and a slug of the place, not a running number.

    A shared strike link names the launch point it flew from, so the id has
    to survive a site being added to the middle of the list. The place is
    the first segment of the name; where one place carries two units — Minot
    has a missile wing and a bomb wing, and the Ohio boats patrol two oceans
    — the second segment joins it.
    """
    first = {}
    for row in sites:
        side, name = row[0], row[1]
        first.setdefault(f'{side}-{slugify(name.split(" · ")[0])}', []).append(name)
    out = {}
    for row in sites:
        side, name = row[0], row[1]
        parts = name.split(' · ')
        base = f'{side}-{slugify(parts[0])}'
        out[(side, name)] = base if len(first[base]) == 1 else f'{base}-{slugify(parts[1] if len(parts) > 1 else name)}'
    return out


SITES = [
    # United States
    ('us', 'Malmstrom AFB · 341st Missile Wing', 'icbm', 'Minuteman III', 1, 300, 13_000, -111.19, 47.50, 'documented', 'reconstructed', 'W87-0 on one reentry vehicle since the 2014 de-MIRV; 150 silos'),
    ('us', 'Minot AFB · 91st Missile Wing', 'icbm', 'Minuteman III', 1, 335, 13_000, -101.36, 48.42, 'documented', 'reconstructed', 'W78, one per missile; 150 silos'),
    ('us', 'F. E. Warren AFB · 90th Missile Wing', 'icbm', 'Minuteman III', 1, 300, 13_000, -104.87, 41.13, 'documented', 'reconstructed', '150 silos'),
    ('us', 'Ohio-class patrol · North Atlantic', 'slbm', 'Trident II D5', 4, 90, 12_000, -45.0, 42.0, 'inferred', 'reconstructed', 'W76-1 at about four per missile on patrol loads; W88 455 kt on some; the patrol box is a guess'),
    ('us', 'Ohio-class patrol · North Pacific', 'slbm', 'Trident II D5', 4, 90, 12_000, -155.0, 35.0, 'inferred', 'reconstructed', 'As the Atlantic'),
    ('us', 'Barksdale AFB · 2nd Bomb Wing', 'bomber', 'B-52H with AGM-86B', 8, 150, 12_000, -93.66, 32.50, 'documented', 'reconstructed', 'W80-1 on the air-launched cruise missile'),
    ('us', 'Minot AFB · 5th Bomb Wing', 'bomber', 'B-52H with AGM-86B', 8, 150, 12_000, -101.35, 48.42, 'documented', 'reconstructed', 'The other half of the American cruise-missile force; Minot carries a missile wing and a bomb wing on the one field'),
    ('us', 'Whiteman AFB · 509th Bomb Wing', 'bomber', 'B-2A with B61-12', 8, 50, 11_000, -93.55, 38.73, 'documented', 'reconstructed', 'B61-12 at its highest option, a guided gravity bomb: the B-2 has no standoff and must reach the target; B83-1 1.2 Mt retiring'),
    # Russia
    ('ru', 'Kozelsk · 28th Guards Rocket Division', 'icbm', 'RS-24 Yars (silo)', 4, 100, 11_000, 35.78, 54.03, 'documented', 'reconstructed', 'Up to four warheads of about 100 kt'),
    ('ru', 'Teykovo · 54th Guards Rocket Division', 'icbm', 'RS-24 Yars (mobile)', 4, 100, 11_000, 40.55, 56.86, 'documented', 'reconstructed', ''),
    ('ru', 'Tatishchevo · 60th Rocket Division', 'icbm', 'Topol-M (silo)', 1, 800, 11_000, 45.60, 51.68, 'documented', 'reconstructed', 'Single warhead of about 800 kt; Yars regiments alongside'),
    ('ru', 'Uzhur · 62nd Rocket Division', 'icbm', 'R-36M2 Voevoda', 10, 800, 11_000, 89.83, 55.31, 'documented', 'reconstructed', 'Ten warheads; Sarmat replacing'),
    ('ru', 'Dombarovsky · 13th Rocket Division', 'icbm', 'R-36M2 Voevoda / Avangard', 10, 800, 11_000, 59.53, 50.76, 'documented', 'reconstructed', ''),
    ('ru', 'Novosibirsk · 39th Guards Rocket Division', 'icbm', 'RS-24 Yars (mobile)', 4, 100, 11_000, 82.90, 55.05, 'documented', 'reconstructed', ''),
    ('ru', 'Irkutsk · 29th Guards Rocket Division', 'icbm', 'RS-24 Yars (mobile)', 4, 100, 11_000, 104.30, 52.30, 'documented', 'reconstructed', ''),
    ('ru', 'Yoshkar-Ola · 14th Rocket Division', 'icbm', 'RS-24 Yars (mobile)', 4, 100, 11_000, 47.90, 56.63, 'documented', 'reconstructed', ''),
    ('ru', 'Nizhny Tagil · 42nd Rocket Division', 'icbm', 'RS-24 Yars (mobile)', 4, 100, 11_000, 60.60, 57.92, 'documented', 'reconstructed', ''),
    ('ru', 'Barents Sea bastion · Northern Fleet patrol', 'slbm', 'R-30 Bulava (Borei)', 6, 100, 9_300, 38.0, 71.0, 'inferred', 'reconstructed', 'Six warheads of about 100 kt; the bastion is a guess'),
    ('ru', 'Sea of Okhotsk bastion · Pacific Fleet patrol', 'slbm', 'R-30 Bulava (Borei)', 6, 100, 9_300, 150.0, 55.0, 'inferred', 'reconstructed', ''),
    ('ru', 'Engels · 22nd Heavy Bomber Division', 'bomber', 'Tu-160 with Kh-102', 12, 250, 9_000, 46.21, 51.48, 'documented', 'inferred', 'Kh-102 yield inferred at 250 kt'),
    ('ru', 'Ukrainka · 326th Heavy Bomber Division', 'bomber', 'Tu-95MS with Kh-102', 8, 250, 9_000, 128.45, 51.17, 'documented', 'inferred', ''),
    ('ru', 'Savasleyka · 764th Fighter Regiment', 'bomber', 'MiG-31K with Kh-47M2 Kinzhal', 1, 100, 3_000, 42.34, 55.46, 'documented', 'inferred', 'The MiG-31K carriers of the Kinzhal; a nuclear option for the missile is asserted by Russia and unverified, and its yield is inferred'),
    ('ru', 'Vypolzovo · 7th Guards Rocket Division', 'icbm', 'RS-24 Yars (mobile)', 4, 100, 11_000, 33.06, 57.85, 'documented', 'reconstructed', 'Bologoye; converted from Topol'),
    ('ru', 'Barnaul · 35th Rocket Division', 'icbm', 'RS-24 Yars (mobile)', 4, 100, 11_000, 83.75, 53.36, 'documented', 'reconstructed', ''),
    ('ru', 'Yurya · 8th Rocket Division', 'icbm', 'RS-24 Yars (mobile)', 4, 100, 11_000, 49.31, 59.03, 'documented', 'reconstructed', ''),
    ('ru', 'Olenya · Tu-95MS forward base', 'bomber', 'Tu-95MS with Kh-102', 8, 250, 9_000, 33.46, 68.15, 'documented', 'inferred', 'A Northern Fleet field the long-range bombers work from; the load is the standard one'),
    ('ru', 'Kaliningrad · 152nd Guards Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 20.55, 54.70, 'documented', 'inferred', 'Non-strategic; a nuclear option of some tens of kilotons is inferred'),
    ('ru', 'Luga · 26th Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 29.85, 58.74, 'documented', 'inferred', ''),
    ('ru', 'Mozdok · 12th Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 44.60, 43.79, 'documented', 'inferred', ''),
    ('ru', 'Ussuriysk · 20th Guards Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 131.95, 43.80, 'documented', 'inferred', ''),
    ('ru', 'Kursk · 448th Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 36.19, 51.73, 'documented', 'inferred', ''),
    ('ru', 'Yelnya · 119th Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 33.18, 54.58, 'documented', 'inferred', 'Smolensk oblast; the brigade nearest the Belarusian border'),
    # China
    ('cn', 'Yumen silo field', 'icbm', 'DF-41', 3, 250, 12_000, 97.30, 40.20, 'documented', 'inferred', 'About 120 silos under construction since 2021; the load and yield are inferred'),
    ('cn', 'Hami silo field', 'icbm', 'DF-41', 3, 250, 12_000, 93.50, 42.80, 'documented', 'inferred', ''),
    ('cn', 'Yulin (Ordos) silo field', 'icbm', 'DF-41', 3, 250, 12_000, 108.50, 39.50, 'documented', 'inferred', ''),
    ('cn', 'Luoyang · 634 Brigade', 'icbm', 'DF-5B', 3, 300, 13_000, 112.40, 34.60, 'documented', 'inferred', 'Multiple warheads; the yield is inferred'),
    ('cn', 'Yibin · 631 Brigade', 'icbm', 'DF-31AG', 1, 250, 11_000, 104.60, 28.80, 'documented', 'inferred', ''),
    ('cn', 'Shaoyang · 633 Brigade', 'icbm', 'DF-31AG', 1, 250, 11_000, 111.50, 27.20, 'documented', 'inferred', ''),
    ('cn', 'Tianshui · 621 Brigade', 'icbm', 'DF-31AG', 1, 250, 11_000, 105.70, 34.60, 'documented', 'inferred', ''),
    ('cn', 'Korla · 646 Brigade', 'irbm', 'DF-26', 1, 200, 4_000, 86.10, 41.70, 'documented', 'inferred', 'Dual-capable intermediate-range; the nuclear yield is inferred'),
    ('cn', 'Qingzhou · 651 Brigade', 'irbm', 'DF-26', 1, 200, 4_000, 118.50, 36.70, 'documented', 'inferred', ''),
    ('cn', 'Chizhou · 613 Brigade', 'irbm', 'DF-21A', 1, 300, 2_100, 117.50, 30.70, 'documented', 'inferred', ''),
    ('cn', 'South China Sea patrol · Type 094', 'slbm', 'JL-3', 1, 250, 10_000, 112.0, 16.0, 'inferred', 'inferred', 'Six boats from Yulin, Hainan; the load and yield are inferred'),
    ('cn', 'Neixiang · 106th Brigade', 'bomber', 'H-6N with CJ-20A', 6, 200, 5_000, 111.85, 33.05, 'documented', 'inferred', 'The air leg of the triad since 2020; a nuclear cruise missile is reported and its yield inferred'),
    # France
    ('fr', 'Atlantic patrol · Force océanique stratégique', 'slbm', 'M51.3 (Triomphant)', 4, 100, 9_000, -15.0, 50.0, 'inferred', 'reconstructed', 'TNO of about 100 kt, four to six per missile; the patrol area is a guess'),
    ('fr', 'Istres · Escadron 2/4 La Fayette', 'bomber', 'Rafale with ASMPA-R', 1, 300, 2_500, 4.92, 43.52, 'documented', 'reconstructed', 'The southern half of the airborne force; the same missile as Saint-Dizier'),
    ('fr', 'Saint-Dizier · Escadron 1/4 Gascogne', 'bomber', 'Rafale with ASMPA-R', 1, 300, 2_500, 4.90, 48.64, 'documented', 'reconstructed', 'TNA of up to 300 kt; the aircraft carries the missile most of the way'),
    # United Kingdom
    ('uk', 'North Atlantic patrol · Vanguard class', 'slbm', 'Trident II D5', 5, 100, 12_000, -20.0, 58.0, 'inferred', 'reconstructed', 'About 40 warheads over 8 missiles on patrol; the Holbrook warhead at about 100 kt'),
    # India
    ('in', 'Central India · Agni-V regiment', 'icbm', 'Agni-V', 1, 40, 5_500, 79.50, 22.50, 'inferred', 'inferred', 'The Strategic Forces Command keeps its sites quiet; a central location is assumed; a boosted-fission yield in the tens of kilotons is inferred'),
    ('in', 'Northern India · Agni-II and Agni-III regiments', 'irbm', 'Agni-III', 1, 40, 3_500, 77.50, 28.00, 'inferred', 'inferred', ''),
    ('in', 'Bay of Bengal patrol · Arihant class', 'slbm', 'K-4', 1, 40, 3_500, 86.0, 16.0, 'inferred', 'inferred', 'From Visakhapatnam'),
    # Pakistan
    ('pk', 'Sargodha · Army Strategic Forces Command', 'irbm', 'Shaheen-III', 1, 30, 2_750, 72.67, 32.05, 'documented', 'inferred', 'A yield in the tens of kilotons is inferred from the 1998 tests'),
    ('pk', 'Central Punjab · Shaheen-II and Ghauri brigades', 'irbm', 'Shaheen-II', 1, 30, 2_000, 73.10, 31.40, 'inferred', 'inferred', ''),
    ('pk', 'Pano Aqil · Nasr and Babur batteries', 'irbm', 'Babur cruise missile', 1, 12, 700, 69.10, 27.85, 'inferred', 'inferred', 'Short-range and cruise systems; a small yield is inferred'),
    # Israel
    ('il', 'Sdot Micha', 'irbm', 'Jericho III', 1, 100, 5_000, 34.92, 31.72, 'documented', 'withheld', 'Israel neither confirms nor denies; the arsenal, the system and its yield are the open literature\'s estimates'),
    ('il', 'Eastern Mediterranean patrol · Dolphin class', 'bomber', 'Popeye Turbo cruise missile', 1, 20, 1_500, 33.5, 33.5, 'inferred', 'withheld', 'A submarine-launched cruise missile is widely reported and unconfirmed; treated as a cruise weapon'),
    # North Korea
    ('nk', 'Sunan · Pyongyang', 'icbm', 'Hwasong-18', 1, 200, 15_000, 125.67, 39.20, 'documented', 'inferred', 'Solid-fuel ICBM tested 2023; a yield near the 2017 test is inferred'),
    ('nk', 'Sil-li · missile support facility', 'icbm', 'Hwasong-17', 1, 200, 15_000, 125.57, 39.03, 'documented', 'inferred', ''),
    ('nk', 'Sohae · Tongchang-ri', 'irbm', 'Hwasong-12', 1, 150, 4_500, 124.70, 39.66, 'documented', 'inferred', ''),
    ('nk', 'Wonsan · KN-23 brigade', 'irbm', 'KN-23', 1, 20, 700, 127.44, 39.15, 'inferred', 'inferred', 'Short-range solid-fuel missile with a claimed nuclear option'),
    ('nk', 'Sinpo · Pukguksong boat', 'slbm', 'Pukguksong-3', 1, 100, 1_900, 128.20, 40.03, 'documented', 'inferred', 'One experimental boat; treated as if at sea off the port'),
]

IDS = site_ids(SITES)

# Standoff by system: release distance km, carrier speed m/s, missile speed m/s. A standoff at the range means the launcher itself fires.
# Standoff by system: the missile's own range in km, the carrier's speed and the missile's speed in m/s, an evidence
# tier for the range and its note. The range is the weapon's, not the aircraft's radius: doctrine is to release at the
# edge of it, outside the defences. A system absent from this table has no standoff and must overfly its target.
STANDOFF = {
    # AGM-86B: about 2,500 km is the figure the Air Force and the reference works give for the ALCM.
    'B-52H with AGM-86B': (2_500, 250, 240, 'documented', 'AGM-86B air-launched cruise missile, about 2,500 km; the B-52 has not been expected to penetrate since the 1980s'),
    # Kh-101/Kh-102: reported between 2,500 and 4,500 km; the longer figure is the one Russia states and the war in Ukraine has shown at the low end.
    'Tu-160 with Kh-102': (4_000, 260, 230, 'inferred', 'Kh-102, the nuclear Kh-101: reported from 2,500 to 4,500 km, 4,000 taken here'),
    'Tu-95MS with Kh-102': (4_000, 200, 230, 'inferred', 'As the Tu-160'),
    # ASMPA-R: about 500 km, the figure France gives for the improved missile in service since 2023.
    'Rafale with ASMPA-R': (500, 290, 300, 'documented', 'ASMPA-R, about 500 km at Mach 3; the missile is the reason the Rafale need not reach the target'),
    # CJ-20A: reported 1,500 to 2,000 km for the air-launched CJ-20 family.
    'H-6N with CJ-20A': (2_000, 220, 240, 'inferred', 'CJ-20A, reported 1,500 to 2,000 km; the H-6N is the air leg of the Chinese triad'),
    # Kh-47M2 Kinzhal: the claimed 2,000 km is the aircraft's radius plus the missile; the missile itself is an air-launched Iskander, about 500 km.
    'MiG-31K with Kh-47M2 Kinzhal': (500, 350, 1_000, 'inferred', 'The claimed 2,000 km includes the MiG-31 radius; the missile is an air-launched Iskander of about 500 km at Mach 4 and its nuclear option is asserted, not shown'),
    # Popeye Turbo: reported about 1,500 km, never confirmed.
    'Popeye Turbo cruise missile': (1_500, 0, 240, 'withheld', 'Reported at about 1,500 km and never confirmed; Israel neither confirms nor denies the system'),
}
# The B-2 carries the B61-12, a guided gravity bomb: no standoff at all. It penetrates or it does not deliver.

# Flight profile by system: the carrier's cruising altitude, the weapon's run, and the distance from the target at which
# the carrier goes to the deck (None: it stays high). Round figures from the open literature, reconstructed.
PROFILE = {
    'B-52H with AGM-86B': (12_000, 100, None),
    'B-2A with B61-12': (12_000, 12_000, None),
    'Tu-160 with Kh-102': (13_000, 60, None),
    'Tu-95MS with Kh-102': (10_000, 60, None),
    'H-6N with CJ-20A': (11_000, 100, None),
    'Rafale with ASMPA-R': (12_000, 20_000, None),
    'MiG-31K with Kh-47M2 Kinzhal': (15_000, 25_000, None),
    'Popeye Turbo cruise missile': (0, 100, None),
}

# Accuracy and reliability by system: CEP metres and the planning reliability. Documented for the American and Russian
# strategic systems in the Notebook and the open literature; inferred for the rest, and said so on the readout.
ACCURACY = {
    'Minuteman III': (120, 0.85), 'Trident II D5': (90, 0.85), 'B-52H with AGM-86B': (30, 0.9), 'B-2A with B61-12': (30, 0.9),
    'RS-24 Yars (silo)': (150, 0.85), 'RS-24 Yars (mobile)': (150, 0.85), 'Topol-M (silo)': (200, 0.85), 'R-36M2 Voevoda': (250, 0.85), 'R-36M2 Voevoda / Avangard': (250, 0.85),
    'R-30 Bulava (Borei)': (250, 0.85), 'Tu-160 with Kh-102': (20, 0.9), 'Tu-95MS with Kh-102': (20, 0.9), 'Iskander-M': (30, 0.9),
    'DF-41': (100, 0.85), 'DF-5B': (500, 0.8), 'DF-31AG': (150, 0.85), 'DF-26': (100, 0.85), 'DF-21A': (150, 0.85), 'JL-3': (300, 0.8), 'H-6N with CJ-20A': (20, 0.9),
    'M51.3 (Triomphant)': (150, 0.85), 'Rafale with ASMPA-R': (10, 0.9),
    'MiG-31K with Kh-47M2 Kinzhal': (30, 0.85),
    'Agni-V': (200, 0.8), 'Agni-III': (300, 0.8), 'K-4': (400, 0.75),
    'Shaheen-III': (300, 0.8), 'Shaheen-II': (350, 0.8), 'Babur cruise missile': (20, 0.85),
    'Jericho III': (300, 0.8), 'Popeye Turbo cruise missile': (20, 0.85),
    'Hwasong-18': (1_000, 0.7), 'Hwasong-17': (1_500, 0.6), 'Hwasong-12': (800, 0.7), 'KN-23': (100, 0.8), 'Pukguksong-3': (1_000, 0.6),
}

# Capacity per missile where it exceeds the deployed load: a full-loading posture. The open literature's figures; the treaties and the downloads are why they differ.
FULL_LOAD = {'Trident II D5': 8, 'Minuteman III': 3, 'M51.3 (Triomphant)': 6, 'DF-41': 10, 'DF-5B': 5, 'DF-31AG': 3, 'RS-24 Yars (silo)': 6, 'RS-24 Yars (mobile)': 6, 'R-30 Bulava (Borei)': 10}

LIQUID = {'R-36M2 Voevoda', 'R-36M2 Voevoda / Avangard', 'DF-5B', 'Hwasong-17', 'Hwasong-12'}

POWERS = {
    'us': {'name': 'United States', 'adjective': 'American'},
    'ru': {'name': 'Russia', 'adjective': 'Russian'},
    'cn': {'name': 'China', 'adjective': 'Chinese'},
    'fr': {'name': 'France', 'adjective': 'French'},
    'uk': {'name': 'United Kingdom', 'adjective': 'British'},
    'in': {'name': 'India', 'adjective': 'Indian'},
    'pk': {'name': 'Pakistan', 'adjective': 'Pakistani'},
    'il': {'name': 'Israel', 'adjective': 'Israeli'},
    'nk': {'name': 'North Korea', 'adjective': 'North Korean'},
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    sites = []
    for i, (side, name, kind, system, per, kt, rng, lon, lat, pos_ev, load_ev, note) in enumerate(SITES):
        sites.append({
            'id': IDS[(side, name)], 'side': side, 'name': name, 'kind': kind, 'system': system, 'warheadsPerMissile': per, 'yieldKt': kt, 'rangeKm': rng,
            'lon': lon, 'lat': lat, 'positionEvidence': pos_ev, 'evidence': load_ev, 'note': note, 'source': NOTEBOOK,
            **({'standoffKm': STANDOFF[system][0], 'carrierSpeedMs': STANDOFF[system][1], 'missileSpeedMs': STANDOFF[system][2], 'standoffEvidence': STANDOFF[system][3], 'standoffNote': STANDOFF[system][4]} if system in STANDOFF else {}),
            'cepMetres': ACCURACY[system][0], 'reliability': ACCURACY[system][1],
            'propellant': 'liquid' if system in LIQUID else 'solid',
            **({'cruiseAltitudeMetres': PROFILE[system][0], 'weaponAltitudeMetres': PROFILE[system][1], **({'descendAtMetres': PROFILE[system][2] * 1_000} if PROFILE[system][2] else {})} if system in PROFILE else {}),
            **({'warheadsPerMissileFull': FULL_LOAD[system]} if system in FULL_LOAD else {}),
        })
    out = {'date': '2025', 'note': 'Launch points for the atlas: one entry per system and place, not a count of the force. Bases are public; patrol areas are guesses; the loads and yields of the opaque arsenals are inferred, and Israel\'s is withheld. Warheads per missile are the deployed loads the Notebook gives (Trident at about four, Minuteman de-MIRVed to one, Yars four, Bulava six, Voevoda ten), not the missiles\' capacities; a full-loading posture would roughly double the American and British figures.', 'powers': POWERS, 'sites': sites}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(f'{len(sites)} sites for {len(POWERS)} powers')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
