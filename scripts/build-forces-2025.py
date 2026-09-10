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
SITES = [
    # United States
    ('us', 'Malmstrom AFB · 341st Missile Wing', 'icbm', 'Minuteman III', 1, 300, 13_000, -111.19, 47.50, 'documented', 'reconstructed', 'W87-0 on one reentry vehicle since the 2014 de-MIRV; 150 silos'),
    ('us', 'Minot AFB · 91st Missile Wing', 'icbm', 'Minuteman III', 1, 335, 13_000, -101.36, 48.42, 'documented', 'reconstructed', 'W78, one per missile; 150 silos'),
    ('us', 'F. E. Warren AFB · 90th Missile Wing', 'icbm', 'Minuteman III', 1, 300, 13_000, -104.87, 41.13, 'documented', 'reconstructed', '150 silos'),
    ('us', 'Ohio-class patrol · North Atlantic', 'slbm', 'Trident II D5', 4, 90, 12_000, -45.0, 42.0, 'inferred', 'reconstructed', 'W76-1 at about four per missile on patrol loads; W88 455 kt on some; the patrol box is a guess'),
    ('us', 'Ohio-class patrol · North Pacific', 'slbm', 'Trident II D5', 4, 90, 12_000, -155.0, 35.0, 'inferred', 'reconstructed', 'As the Atlantic'),
    ('us', 'Barksdale AFB · 2nd Bomb Wing', 'bomber', 'B-52H with AGM-86B', 8, 150, 12_000, -93.66, 32.50, 'documented', 'reconstructed', 'W80-1 on the air-launched cruise missile'),
    ('us', 'Whiteman AFB · 509th Bomb Wing', 'bomber', 'B-2A with B61-12', 8, 50, 11_000, -93.55, 38.73, 'documented', 'reconstructed', 'B61-12 at its highest option; B83-1 1.2 Mt retiring'),
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
    ('ru', 'Kaliningrad · 152nd Guards Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 20.55, 54.70, 'documented', 'inferred', 'Non-strategic; a nuclear option of some tens of kilotons is inferred'),
    ('ru', 'Luga · 26th Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 29.85, 58.74, 'documented', 'inferred', ''),
    ('ru', 'Mozdok · 12th Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 44.60, 43.79, 'documented', 'inferred', ''),
    ('ru', 'Ussuriysk · 20th Guards Missile Brigade', 'irbm', 'Iskander-M', 1, 50, 500, 131.95, 43.80, 'documented', 'inferred', ''),
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

# Standoff by system: release distance km, carrier speed m/s, missile speed m/s. A standoff at the range means the launcher itself fires.
STANDOFF = {
    'B-52H with AGM-86B': (2_400, 250, 240),
    'B-2A with B61-12': (60, 250, 200),
    'Tu-160 with Kh-102': (3_000, 260, 230),
    'Tu-95MS with Kh-102': (3_000, 200, 230),
    'Rafale with ASMPA-R': (500, 290, 260),
    'Popeye Turbo cruise missile': (1_500, 0, 240),
    'H-6N with CJ-20A': (1_500, 220, 240),
}

# Accuracy and reliability by system: CEP metres and the planning reliability. Documented for the American and Russian
# strategic systems in the Notebook and the open literature; inferred for the rest, and said so on the readout.
ACCURACY = {
    'Minuteman III': (120, 0.85), 'Trident II D5': (90, 0.85), 'B-52H with AGM-86B': (30, 0.9), 'B-2A with B61-12': (30, 0.9),
    'RS-24 Yars (silo)': (150, 0.85), 'RS-24 Yars (mobile)': (150, 0.85), 'Topol-M (silo)': (200, 0.85), 'R-36M2 Voevoda': (250, 0.85), 'R-36M2 Voevoda / Avangard': (250, 0.85),
    'R-30 Bulava (Borei)': (250, 0.85), 'Tu-160 with Kh-102': (20, 0.9), 'Tu-95MS with Kh-102': (20, 0.9), 'Iskander-M': (30, 0.9),
    'DF-41': (100, 0.85), 'DF-5B': (500, 0.8), 'DF-31AG': (150, 0.85), 'DF-26': (100, 0.85), 'DF-21A': (150, 0.85), 'JL-3': (300, 0.8), 'H-6N with CJ-20A': (20, 0.9),
    'M51.3 (Triomphant)': (150, 0.85), 'Rafale with ASMPA-R': (10, 0.9),
    'Agni-V': (200, 0.8), 'Agni-III': (300, 0.8), 'K-4': (400, 0.75),
    'Shaheen-III': (300, 0.8), 'Shaheen-II': (350, 0.8), 'Babur cruise missile': (20, 0.85),
    'Jericho III': (300, 0.8), 'Popeye Turbo cruise missile': (20, 0.85),
    'Hwasong-18': (1_000, 0.7), 'Hwasong-17': (1_500, 0.6), 'Hwasong-12': (800, 0.7), 'KN-23': (100, 0.8), 'Pukguksong-3': (1_000, 0.6),
}

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
            'id': f'{side}-{i + 1}', 'side': side, 'name': name, 'kind': kind, 'system': system, 'warheadsPerMissile': per, 'yieldKt': kt, 'rangeKm': rng,
            'lon': lon, 'lat': lat, 'positionEvidence': pos_ev, 'evidence': load_ev, 'note': note, 'source': NOTEBOOK,
            **({'standoffKm': STANDOFF[system][0], 'carrierSpeedMs': STANDOFF[system][1], 'missileSpeedMs': STANDOFF[system][2]} if system in STANDOFF else {}),
            'cepMetres': ACCURACY[system][0], 'reliability': ACCURACY[system][1],
        })
    out = {'date': '2025', 'note': 'Launch points for the atlas: one entry per system and place, not a count of the force. Bases are public; patrol areas are guesses; the loads and yields of the opaque arsenals are inferred, and Israel\'s is withheld.', 'powers': POWERS, 'sites': sites}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(f'{len(sites)} sites for {len(POWERS)} powers')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
