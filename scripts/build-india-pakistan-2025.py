#!/usr/bin/env python3
"""The urban targets of the India-Pakistan study, from the 2025 population grid.

Toon et al. (2019) put India's hundred strategic weapons and Pakistan's hundred
and fifty on the other country's urban centres. This builds the list of urban
centres those weapons would go to.

The other modern studies here derive their targets from the most populous cells
of a population grid and then name each cell after the nearest city. That works
where a country is alone inside a box. It does not work on this border: Lahore
is twenty-five kilometres from India and Amritsar thirty from Pakistan, the
Punjab is continuous across the line, and a cell rule would hand each side
cities belonging to the other. On this study that is not a rounding error, it
is the wrong war.

So the list is named first and measured second. Every entry is a city of the
usual reckoning, geocoded by Photon, and **the geocoder's own country code is
what assigns it to a side** — an entry the geocoder puts in the wrong country
is dropped and reported rather than quietly kept. The population is then summed
from the GHS-POP 2025 grid inside a stated radius, which is the same grid and
the same people the engine will count under the rings.

The order is by that summed population, not by the order of the list, so the
ranking is the grid's and not mine.

Usage: python3 scripts/build-india-pakistan-2025.py --out data/india-pakistan/cities-2025.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ghsl_read import Grid, haversine_km  # noqa: E402

PHOTON = 'https://photon.komoot.io/api/'

# The radius the city's population is summed inside. Ten kilometres is about
# the built-up core of a large Indian city and is the radius the two-number
# readouts are used to; the figure is for ranking and for the log line, and the
# casualty count comes from the grid under the rings rather than from here.
RADIUS_KM = 10.0

# No two targets closer than this. It is set to separate cities rather than to
# merge them: Rawalpindi and Islamabad are fourteen kilometres apart and are two
# targets by any planner's reckoning, while Howrah and Kolkata face each other
# across a river and are one. Twelve kilometres draws that line, and it is well
# outside the lethal radius of even the hundred-kilotonne case, so nothing on
# this list is separated from its neighbour by less than one weapon's reach.
SPACING_KM = 12.0

# What the geocoder has to have found for the entry to stand. Asking Photon for
# a city by name mostly returns the city; sometimes it returns something inside
# it that carries the name — "Kirari Suleman Nagar" came back as a drain in
# Delhi, with six million people within ten kilometres because it sits in the
# middle of the sprawl, and it would have ranked sixth in the country. A target
# list is not the place to find that out, so only a populated place counts.
PLACE_KINDS = {'place=city', 'place=town', 'place=municipality', 'place=suburb', 'place=borough', 'place=district', 'place=subdistrict', 'place=county', 'place=state_capital', 'place=village'}

# And the other direction: a city of the usual reckoning that comes back with
# almost nobody around it has been geocoded to a hamlet of the same name.
# Chandrapur came back with two thousand seven hundred people.
FLOOR = 50_000

INDIA = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur',
    'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad',
    'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad',
    'Amritsar', 'Navi Mumbai', 'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur',
    'Madurai', 'Raipur', 'Kota', 'Chandigarh', 'Guwahati', 'Solapur', 'Hubli', 'Mysore', 'Tiruchirappalli', 'Bareilly',
    'Aligarh', 'Tiruppur', 'Moradabad', 'Jalandhar', 'Bhubaneswar', 'Salem', 'Warangal', 'Guntur', 'Bhiwandi', 'Saharanpur',
    'Gorakhpur', 'Bikaner', 'Amravati', 'Noida', 'Jamshedpur', 'Bhilai', 'Cuttack', 'Firozabad', 'Kochi', 'Dehradun',
    'Durgapur', 'Asansol', 'Nanded', 'Kolhapur', 'Ajmer', 'Gulbarga', 'Jamnagar', 'Ujjain', 'Siliguri', 'Jhansi',
    'Belgaum', 'Mangalore', 'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Jalgaon', 'Udaipur', 'Maheshtala', 'Tirupati',
    'Davanagere', 'Kozhikode', 'Akola', 'Kurnool', 'Bokaro', 'Rajahmundry', 'Ballari', 'Agartala', 'Bhagalpur', 'Latur',
    'Dhule', 'Korba', 'Bhilwara', 'Brahmapur', 'Muzaffarpur', 'Ahmednagar', 'Mathura', 'Kollam', 'Avadi', 'Rajpur Sonarpur',
    'Bilaspur', 'Shahjahanpur', 'Bijapur', 'Rampur', 'Shivamogga', 'Chandrapur', 'Junagadh', 'Thrissur', 'Alwar', 'Bardhaman',
    'Kulti', 'Nizamabad', 'Parbhani', 'Tumkur', 'Khammam', 'Ozhukarai', 'Bihar Sharif', 'Panipat', 'Darbhanga', 'Bally',
    'Aizawl', 'Dewas', 'Ichalkaranji', 'Karnal', 'Bathinda', 'Jalna', 'Eluru', 'Barasat', 'Kirari Suleman Nagar', 'Purnia',
    'Satna', 'Mau', 'Sonipat', 'Farrukhabad', 'Sagar', 'Rourkela', 'Durg', 'Imphal', 'Ratlam', 'Hapur',
    'Arrah', 'Anantapur', 'Karimnagar', 'Etawah', 'Ambernath', 'North Dumdum', 'Bharatpur', 'Begusarai', 'New Delhi', 'Gandhinagar',
    'Baranagar', 'Tiruvottiyur', 'Puducherry', 'Sikar', 'Thoothukudi', 'Rewa', 'Mirzapur', 'Raichur', 'Pali', 'Ramagundam',
]

PAKISTAN = [
    'Karachi', 'Lahore', 'Faisalabad', 'Rawalpindi', 'Gujranwala', 'Peshawar', 'Multan', 'Hyderabad, Pakistan', 'Islamabad', 'Quetta',
    'Bahawalpur', 'Sargodha', 'Sialkot', 'Sukkur', 'Larkana', 'Sheikhupura', 'Rahim Yar Khan', 'Jhang', 'Dera Ghazi Khan', 'Gujrat',
    'Sahiwal', 'Wah Cantonment', 'Mardan', 'Kasur', 'Okara', 'Mingora', 'Nawabshah', 'Chiniot', 'Kotri', 'Kamoke',
    'Hafizabad', 'Sadiqabad', 'Mirpur Khas', 'Burewala', 'Kohat', 'Khanewal', 'Dera Ismail Khan', 'Turbat', 'Muzaffargarh', 'Abbottabad',
    'Mandi Bahauddin', 'Shikarpur', 'Jacobabad', 'Jhelum', 'Khanpur', 'Khairpur', 'Khuzdar', 'Pakpattan', 'Vehari', 'Chishtian',
    'Attock', 'Bhakkar', 'Chakwal', 'Gojra', 'Muridke', 'Daska', 'Bahawalnagar', 'Tando Allahyar', 'Gwadar', 'Nowshera',
]


CACHE = Path('.cache/india-pakistan-geocode-v2.json')


def load_cache() -> dict:
    try:
        return json.loads(CACHE.read_text())
    except Exception:
        return {}


def save_cache(cache: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False) + '\n')


def geocode(query: str) -> dict | None:
    """Ask for several and take the one that is a place.

    This is the same fault the atlas had and fixed in src/atlas/rank.ts: asking
    Photon for a city by name and taking the first answer gets you the railway
    station named after the town as often as the town — a thing that exists to
    point at another thing, carrying its name and ranking above it. Wah
    Cantonment, Kamoke, Shikarpur, Khanpur, Pakpattan, Vehari and Bhakkar all
    came back as stations. So: ask for five, prefer a populated place, accept
    the city's own administrative boundary if that is all there is, and refuse
    anything else.
    """
    url = PHOTON + '?' + urllib.parse.urlencode({'q': query, 'limit': 5, 'lang': 'en'})
    req = urllib.request.Request(url, headers={'User-Agent': 'grid84 india-pakistan target list build'})
    with urllib.request.urlopen(req, timeout=20) as r:
        payload = json.load(r)
    candidates = []
    for f in payload.get('features') or []:
        p = f.get('properties', {})
        kind = f"{p.get('osm_key')}={p.get('osm_value')}"
        lon, lat = f['geometry']['coordinates'][0], f['geometry']['coordinates'][1]
        candidates.append({'lon': round(float(lon), 4), 'lat': round(float(lat), 4), 'hit': p.get('name'), 'country': p.get('countrycode'), 'kind': kind})
    for c in candidates:
        if c['kind'] in PLACE_KINDS:
            return c
    # A city's own administrative relation is the city; it is only second choice
    # because its point is a label position rather than a centre.
    for c in candidates:
        if c['kind'] == 'boundary=administrative':
            return c
    return candidates[0] if candidates else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--grid', type=Path, default=Path('public/data/ghsl/popc_2025.json'))
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--pause', type=float, default=1.1, help="Photon's public instance asks for a gentle pace")
    args = ap.parse_args()

    grid = Grid(args.grid)
    cache = load_cache()
    out: dict = {
        'note': (
            'The urban centres of the India-Pakistan study. Named first and measured second: every entry is a city of the usual '
            'reckoning, geocoded by Photon, assigned to a side by the geocoder\'s own country code, and then weighed on the '
            'GHS-POP 2025 grid. A cell rule was not used because the Punjab is continuous across the border and would have given '
            'each side cities belonging to the other.'
        ),
        'rule': (
            f'Population summed from the grid within {RADIUS_KM:g} km of the geocoded centre; entries ordered by that sum; no two targets within {SPACING_KM:g} km of each other, '
            f'the first-listed of a colliding pair kept; the geocoder must have returned a populated place and at least {FLOOR:,} people must live within the radius.'
        ),
        'grid': grid.meta['source'],
        'geocoder': 'Photon (komoot) over OpenStreetMap, on the day of the build',
        'evidence': 'reconstructed',
        'radiusKm': RADIUS_KM,
        'spacingKm': SPACING_KM,
        'cities': [],
    }
    dropped: list[dict] = []

    for side, names, want in (('in', INDIA, 'IN'), ('pk', PAKISTAN, 'PK')):
        found: list[dict] = []
        for name in names:
            query = name if ',' in name else f'{name}, {"India" if want == "IN" else "Pakistan"}'
            if query in cache:
                g = cache[query]
            else:
                try:
                    g = geocode(query)
                except Exception as e:  # a public instance; a failure is a dropped row, not a dead build
                    dropped.append({'side': side, 'name': name, 'why': f'geocoder: {e}'})
                    time.sleep(args.pause)
                    continue
                cache[query] = g
                save_cache(cache)
                time.sleep(args.pause)
            if not g:
                dropped.append({'side': side, 'name': name, 'why': 'no hit'})
                continue
            if g.get('kind') not in PLACE_KINDS and g.get('kind') != 'boundary=administrative':
                dropped.append({'side': side, 'name': name, 'why': f"the geocoder found a {g.get('kind')}, not a populated place", **g})
                continue
            if g['country'] != want:
                dropped.append({'side': side, 'name': name, 'why': f"geocoded to {g['country']}, not {want}", **g})
                continue
            people = grid.within_km(g['lon'], g['lat'], RADIUS_KM)
            if people < FLOOR:
                dropped.append({'side': side, 'name': name, 'why': f'only {int(round(people)):,} people within {RADIUS_KM:g} km — geocoded to a place of the same name, not the city', **g})
                continue
            found.append({'side': side, 'name': name.split(',')[0], 'lon': g['lon'], 'lat': g['lat'], 'hit': g['hit'], 'kind': g['kind'], 'population': int(round(people))})
            print(f"{side} {name:24} {g['lon']:9.4f} {g['lat']:8.4f} {int(round(people)):>12,}", flush=True)

        # The list is written in the usual order of size and fame; keep the first of any colliding pair.
        kept: list[dict] = []
        for c in found:
            near = next((k for k in kept if haversine_km(c['lon'], c['lat'], k['lon'], k['lat']) < SPACING_KM), None)
            if near is not None:
                dropped.append({'side': side, 'name': c['name'], 'why': f"within {SPACING_KM:g} km of {near['name']}"})
                continue
            kept.append(c)
        # Collisions are settled by the order of the list, which is the usual
        # reckoning, and not by the grid: Kotri outweighs Hyderabad on the grid
        # and nobody calls that place Kotri. The ranking that follows is the
        # grid's.
        kept.sort(key=lambda c: -c['population'])
        out['cities'].extend(kept)

    out['dropped'] = dropped
    out['counts'] = {'in': sum(1 for c in out['cities'] if c['side'] == 'in'), 'pk': sum(1 for c in out['cities'] if c['side'] == 'pk')}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(f"\n{out['counts']} kept, {len(dropped)} dropped → {args.out}")
    for d in dropped:
        print('  dropped:', d['side'], d['name'], '·', d['why'])
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
