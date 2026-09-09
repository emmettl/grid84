#!/usr/bin/env python3
"""Soviet side of the SIOP//62 alert-force enactment, September 1961.

Force levels are documented (Sagan 1987, Table 4 and notes 14, 17, 20, 22,
42): about 200 bombers that could be put over North America, 10 to 25
ICBMs with no alert and one to three hours to fuel (R-7: twenty hours'
preparation per Siddiqi), about 78 to 90 submarine missiles needing to
close to 150 to 350 nautical miles and surface, and, per the NATO planning
conference material with Schelling's caveat, 10 percent of the bomber
force on ground alert. The bases are inferred: Long Range Aviation's heavy
bomber fields of the period, hand-placed. Targets are inferred: the SAC
launch sites of the order of battle and the ten largest US cities of the
1960 census (Wikipedia), geocoded from the modern map.
"""
import json, time, urllib.parse, urllib.request
from pathlib import Path

PHOTON = 'https://photon.komoot.io/api/'
BASES = [  # id, name, lon, lat
    ('engels', 'Engels', 46.12, 51.48),
    ('uzin', 'Uzin', 30.44, 49.79),
    ('mozdok', 'Mozdok', 44.60, 43.79),
    ('chagan', 'Semipalatinsk (Chagan)', 79.19, 50.55),
    ('ukrainka', 'Ukrainka', 128.45, 51.17),
    ('belaya', 'Belaya', 103.57, 52.92),
]
CITIES_1960 = [('New York', 7_781_984), ('Chicago', 3_550_404), ('Los Angeles', 2_479_015), ('Philadelphia', 2_002_512), ('Detroit', 1_670_144), ('Baltimore', 939_024), ('Houston', 938_219), ('Cleveland', 876_050), ('Washington, D.C.', 783_956), ('St. Louis', 750_026)]


def geocode(q):
    url = PHOTON + '?' + urllib.parse.urlencode({'q': q + ', United States', 'limit': 1, 'lang': 'en'})
    req = urllib.request.Request(url, headers={'User-Agent': 'grid84 soviet response build'})
    with urllib.request.urlopen(req, timeout=20) as r:
        f = json.load(r).get('features') or []
    return f[0]['geometry']['coordinates'] if f else None


cities = []
for name, pop in CITIES_1960:
    c = geocode(name); time.sleep(1)
    if c:
        cities.append({'name': name, 'population1960': pop, 'lon': round(c[0], 4), 'lat': round(c[1], 4)})
out = {
    'date': 'September 1961',
    'documented': {
        'bombersOverNorthAmerica': {'value': 200, 'source': 'September 1961 Berlin-crisis war game material and McNamara testimony, via Sagan 1987 n. 14: "about 200 bombers over North America", Bison and Bear with Badger and Blinder, before US air-defence attrition'},
        'longRangeBombersAndTankers': {'value': 165, 'source': 'McNamara, 5 September 1962, via Sagan n. 14'},
        'icbms': {'low': 10, 'high': 25, 'source': 'Sagan Table 4; NIE via McQuade memo'},
        'icbmAlert': {'value': 'none on alert; one to three hours to warm and fuel', 'source': 'Sagan p. 29 and n. 20'},
        'r7': {'units': 6, 'sites': 'Baikonur site 31; Plesetsk sites 16, 41, 43', 'preparationHours': 20, 'yieldMt': '3 to 5', 'source': 'Wikipedia R-7 Semyorka, citing Siddiqi 2000'},
        'submarineMissiles': {'low': 78, 'high': 90, 'source': 'Sagan Table 4 and n. 17; must close to 150–350 nautical miles and surface'},
        'bomberGroundAlert': {'value': 0.1, 'source': 'NATO Planning Conference material via Sagan n. 22; Schelling: possibly an artifice of the game'},
        'weaponsPerBomber': {'value': 1, 'source': 'Collins 1978 via Sagan n. 42: one large gravity bomb or AS-3'},
        'usFatalityEstimates': [
            {'label': 'Pentagon civilians, 1961', 'low': 2_000_000, 'high': 15_000_000, 'source': 'Kaplan via Sagan n. 47'},
            {'label': 'Air Force to Kennedy, Berlin crisis', 'low': 0, 'high': 10_000_000, 'source': 'Ellsberg via Herken, Sagan n. 47: "probably under ten million if the United States struck first"'},
        ],
    },
    'inferred': {
        'bases': [{'id': i, 'name': n, 'lon': lon, 'lat': lat, 'evidence': 'inferred', 'source': 'Long Range Aviation heavy bomber field of the period; regiment assignment not sourced here'} for i, n, lon, lat in BASES],
        'bomberYieldKt': {'value': 3_000, 'note': 'A large Soviet gravity bomb of the period; assumed'},
        'bomberSpeedKmh': 800,
        'bomberRangeKm': 9_000,
        'generationHours': 3,
        'launchOnWarningMinutes': 30,
        'usAirDefencePenetration': {'value': 0.5, 'note': 'No official estimate of NORAD effectiveness is available (Sagan n. 15); one half assumed'},
        'cities1960': cities,
    },
}
Path('data/siop62/soviet-response-1961.json').write_text(json.dumps(out, indent=1) + '\n')
print(len(cities), 'cities geocoded;', [c['name'] for c in cities])
