#!/usr/bin/env python3
"""Geocode the Soviet cities of 1983 under their names of the day.

The 1983 urban targets are cells of the 1985 population grid and carry no
names; the window study and WOPR name a cell after the nearest city in this
list within thirty kilometres. The names are those of 1983 (Leningrad, Gorky,
Sverdlovsk, Kuybyshev, Frunze); each is geocoded by its modern name through
Photon, and the output keeps both.

Usage: python3 scripts/name-cities-1983.py --out data/window83/cities-su-1983.json
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

PHOTON = 'https://photon.komoot.io/api/'

# (name in 1983, modern query)
SU = [
    ('Moscow', 'Moscow, Russia'), ('Leningrad', 'Saint Petersburg, Russia'), ('Kiev', 'Kyiv, Ukraine'), ('Tashkent', 'Tashkent, Uzbekistan'),
    ('Baku', 'Baku, Azerbaijan'), ('Kharkov', 'Kharkiv, Ukraine'), ('Minsk', 'Minsk, Belarus'), ('Gorky', 'Nizhny Novgorod, Russia'),
    ('Novosibirsk', 'Novosibirsk, Russia'), ('Sverdlovsk', 'Yekaterinburg, Russia'), ('Kuybyshev', 'Samara, Russia'), ('Tbilisi', 'Tbilisi, Georgia'),
    ('Dnepropetrovsk', 'Dnipro, Ukraine'), ('Yerevan', 'Yerevan, Armenia'), ('Odessa', 'Odesa, Ukraine'), ('Omsk', 'Omsk, Russia'),
    ('Chelyabinsk', 'Chelyabinsk, Russia'), ('Alma-Ata', 'Almaty, Kazakhstan'), ('Donetsk', 'Donetsk, Ukraine'), ('Kazan', 'Kazan, Russia'),
    ('Perm', 'Perm, Russia'), ('Ufa', 'Ufa, Russia'), ('Rostov-on-Don', 'Rostov-on-Don, Russia'), ('Volgograd', 'Volgograd, Russia'),
    ('Riga', 'Riga, Latvia'), ('Saratov', 'Saratov, Russia'), ('Krasnoyarsk', 'Krasnoyarsk, Russia'), ('Zaporozhye', 'Zaporizhzhia, Ukraine'),
    ('Voronezh', 'Voronezh, Russia'), ('Lvov', 'Lviv, Ukraine'), ('Krivoy Rog', 'Kryvyi Rih, Ukraine'), ('Yaroslavl', 'Yaroslavl, Russia'),
    ('Karaganda', 'Karaganda, Kazakhstan'), ('Krasnodar', 'Krasnodar, Russia'), ('Novokuznetsk', 'Novokuznetsk, Russia'), ('Izhevsk', 'Izhevsk, Russia'),
    ('Vladivostok', 'Vladivostok, Russia'), ('Irkutsk', 'Irkutsk, Russia'), ('Barnaul', 'Barnaul, Russia'), ('Khabarovsk', 'Khabarovsk, Russia'),
    ('Tolyatti', 'Tolyatti, Russia'), ('Frunze', 'Bishkek, Kyrgyzstan'), ('Vilnius', 'Vilnius, Lithuania'), ('Kishinev', 'Chisinau, Moldova'),
    ('Dushanbe', 'Dushanbe, Tajikistan'), ('Ulyanovsk', 'Ulyanovsk, Russia'), ('Penza', 'Penza, Russia'), ('Zhdanov', 'Mariupol, Ukraine'),
    ('Tula', 'Tula, Russia'), ('Kemerovo', 'Kemerovo, Russia'), ('Orenburg', 'Orenburg, Russia'), ('Ryazan', 'Ryazan, Russia'),
    ('Astrakhan', 'Astrakhan, Russia'), ('Tallinn', 'Tallinn, Estonia'), ('Nikolayev', 'Mykolaiv, Ukraine'), ('Voroshilovgrad', 'Luhansk, Ukraine'),
    ('Tomsk', 'Tomsk, Russia'), ('Lipetsk', 'Lipetsk, Russia'), ('Kirov', 'Kirov, Kirov Oblast, Russia'), ('Makhachkala', 'Makhachkala, Russia'),
    ('Kaliningrad', 'Kaliningrad, Russia'), ('Magnitogorsk', 'Magnitogorsk, Russia'), ('Murmansk', 'Murmansk, Russia'), ('Arkhangelsk', 'Arkhangelsk, Russia'),
    ('Gomel', 'Gomel, Belarus'), ('Chimkent', 'Shymkent, Kazakhstan'), ('Ashkhabad', 'Ashgabat, Turkmenistan'), ('Tselinograd', 'Astana, Kazakhstan'),
    ('Kursk', 'Kursk, Russia'), ('Bryansk', 'Bryansk, Russia'), ('Ivanovo', 'Ivanovo, Russia'), ('Kalinin', 'Tver, Russia'),
    ('Nizhny Tagil', 'Nizhny Tagil, Russia'), ('Chita', 'Chita, Russia'), ('Ulan-Ude', 'Ulan-Ude, Russia'), ('Sevastopol', 'Sevastopol'),
    ('Severodvinsk', 'Severodvinsk, Russia'), ('Petropavlovsk-Kamchatsky', 'Petropavlovsk-Kamchatsky, Russia'), ('Komsomolsk-on-Amur', 'Komsomolsk-on-Amur, Russia'),
    ('Cherepovets', 'Cherepovets, Russia'), ('Grozny', 'Grozny, Russia'), ('Vitebsk', 'Vitebsk, Belarus'), ('Mogilev', 'Mogilev, Belarus'),
    ('Kaunas', 'Kaunas, Lithuania'), ('Semipalatinsk', 'Semey, Kazakhstan'), ('Pavlodar', 'Pavlodar, Kazakhstan'), ('Samarkand', 'Samarkand, Uzbekistan'),
    ('Kherson', 'Kherson, Ukraine'), ('Poltava', 'Poltava, Ukraine'), ('Vinnitsa', 'Vinnytsia, Ukraine'), ('Simferopol', 'Simferopol'),
    ('Kirovabad', 'Ganja, Azerbaijan'), ('Kutaisi', 'Kutaisi, Georgia'), ('Naberezhnye Chelny', 'Naberezhnye Chelny, Russia'), ('Stavropol', 'Stavropol, Russia'),
    ('Vladimir', 'Vladimir, Russia'), ('Kaluga', 'Kaluga, Russia'), ('Smolensk', 'Smolensk, Russia'), ('Kurgan', 'Kurgan, Russia'),
    ('Tyumen', 'Tyumen, Russia'), ('Sochi', 'Sochi, Russia'), ('Cheboksary', 'Cheboksary, Russia'), ('Belgorod', 'Belgorod, Russia'),
    ('Vologda', 'Vologda, Russia'), ('Yakutsk', 'Yakutsk, Russia'), ('Chernigov', 'Chernihiv, Ukraine'), ('Zhitomir', 'Zhytomyr, Ukraine'),
]


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
    out = {'source': 'Photon (komoot) over OpenStreetMap, geocoded on the day of the build by the modern name; the names are those in use in 1983 and the list is the largest Soviet cities of the 1979 and 1989 censuses', 'cities': []}
    for name, query in SU:
        g = geocode(query)
        time.sleep(1.0)
        if not g:
            print('NO MATCH', name, query)
            continue
        out['cities'].append({'name': name, 'modern': query.split(',')[0], **g})
        print(name, g['lon'], g['lat'], g['hit'])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
