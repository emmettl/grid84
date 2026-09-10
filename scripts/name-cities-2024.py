#!/usr/bin/env python3
"""Geocode the cities the modern studies name their urban targets after.

The urban targets are cells of a population grid and carry no names; the
studies name a cell after the nearest city in this list within thirty
kilometres, as the DEFCON 3 study does with the 1970 census. The lists are
the largest cities of each country by the usual reckoning; every position is
geocoded from the modern map by Photon and the output records the hit.

Usage: python3 scripts/name-cities-2024.py --out data/72-minutes/cities-2024.json
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

PHOTON = 'https://photon.komoot.io/api/'

US = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus, Ohio', 'Charlotte', 'Indianapolis', 'San Francisco', 'Seattle', 'Denver', 'Washington, D.C.', 'Boston', 'Nashville', 'Detroit', 'Oklahoma City', 'Portland, Oregon', 'Las Vegas', 'Memphis', 'Louisville', 'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento', 'Kansas City, Missouri', 'Atlanta', 'Miami', 'Omaha', 'Raleigh', 'Minneapolis', 'Tampa', 'New Orleans', 'Cleveland', 'Pittsburgh', 'St. Louis', 'Cincinnati', 'Orlando', 'Salt Lake City', 'Buffalo', 'Richmond, Virginia', 'Anaheim', 'Riverside, California', 'Norfolk, Virginia', 'Honolulu', 'Anchorage', 'Providence', 'Hartford', 'Birmingham, Alabama', 'Rochester, New York', 'El Paso', 'Oakland', 'Long Beach', 'Tulsa', 'Colorado Springs', 'Newark', 'Bridgeport, Connecticut', 'Des Moines', 'Little Rock', 'Boise', 'Spokane', 'Grand Rapids', 'Dayton', 'Toledo', 'Akron', 'Knoxville', 'Chattanooga', 'Baton Rouge', 'Shreveport', 'Wichita', 'Madison, Wisconsin']
RU = ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod', 'Chelyabinsk', 'Samara', 'Omsk', 'Rostov-on-Don', 'Ufa', 'Krasnoyarsk', 'Voronezh', 'Perm', 'Volgograd', 'Krasnodar', 'Saratov', 'Tyumen', 'Tolyatti', 'Izhevsk', 'Barnaul', 'Ulyanovsk', 'Irkutsk', 'Khabarovsk', 'Yaroslavl', 'Vladivostok', 'Makhachkala', 'Tomsk', 'Orenburg', 'Kemerovo', 'Novokuznetsk', 'Ryazan', 'Astrakhan', 'Naberezhnye Chelny', 'Penza', 'Lipetsk', 'Kirov', 'Cheboksary', 'Tula', 'Kaliningrad', 'Kursk', 'Sochi', 'Stavropol', 'Ulan-Ude', 'Tver', 'Magnitogorsk', 'Bryansk', 'Ivanovo', 'Belgorod', 'Surgut', 'Vladimir', 'Nizhny Tagil', 'Arkhangelsk', 'Chita', 'Kaluga', 'Smolensk', 'Volzhsky', 'Kurgan', 'Cherepovets', 'Vologda', 'Murmansk', 'Yakutsk', 'Petropavlovsk-Kamchatsky', 'Komsomolsk-on-Amur', 'Severodvinsk', 'Engels', 'Severomorsk']
NK = ['Pyongyang', 'Hamhung', 'Chongjin', 'Nampo', 'Wonsan', 'Sinuiju', 'Tanchon', 'Kaechon', 'Kaesong', 'Sariwon', 'Sinpo', 'Haeju', 'Kanggye', 'Hyesan', 'Sunchon']


def geocode(query: str):
    url = PHOTON + '?' + urllib.parse.urlencode({'q': query, 'limit': 1, 'lang': 'en'})
    req = urllib.request.Request(url, headers={'User-Agent': 'grid84 city names build'})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    f = data.get('features') or []
    if not f:
        return None
    lon, lat = f[0]['geometry']['coordinates']
    p = f[0]['properties']
    return {'lon': round(lon, 4), 'lat': round(lat, 4), 'hit': p.get('name'), 'geocodedCountry': p.get('countrycode')}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    out = {'source': 'Photon (komoot) over OpenStreetMap, geocoded on the day of the build; the lists are the largest cities of each country', 'cities': []}
    for country, names, code in (('us', US, 'US'), ('ru', RU, 'RU'), ('nk', NK, 'KP')):
        for name in names:
            query = name if ',' in name or country != 'us' else f'{name}, United States'
            if country == 'ru':
                query = f'{name}, Russia'
            if country == 'nk':
                query = f'{name}, North Korea'
            g = geocode(query)
            time.sleep(1.0)
            if not g or (g['geocodedCountry'] and g['geocodedCountry'] != code):
                print('NO MATCH', name, g)
                continue
            out['cities'].append({'country': country, 'name': name.split(',')[0], **g})
            print(country, name, g['lon'], g['lat'])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(len(out['cities']), 'cities written')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
