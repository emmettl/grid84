#!/usr/bin/env python3
"""Derive an urban target list from a HYDE population grid.

Where no target list is in the record, the most populous cells of the
population grid of the year stand in for the urban-industrial category, by
a rule stated here: the N most populous 5-arc-minute cells inside a
bounding box, taken in descending order and skipping any cell within a
minimum distance of one already taken, so that one city yields one target.
The output records the rule, the grid and the population of each cell, and
the study labels every such target as modelled.

Usage: python3 scripts/derive-urban-targets.py --asc ~/Downloads/1973AD_pop/popc_1973AD.asc \
    --bbox -125 24 -66 50 --count 150 --spacing-km 40 --name "United States" --out data/defcon3/us-urban-1973.json
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def read_header(f):
    header = {}
    for _ in range(6):
        key, value = f.readline().split()
        header[key.lower()] = float(value)
    return header


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--asc', required=True, type=Path)
    ap.add_argument('--bbox', nargs=4, type=float, required=True, metavar=('WEST', 'SOUTH', 'EAST', 'NORTH'))
    ap.add_argument('--count', type=int, default=150)
    ap.add_argument('--spacing-km', type=float, default=40)
    ap.add_argument('--name', required=True)
    ap.add_argument('--year', type=int, required=True)
    ap.add_argument('--exclude', action='append', default=[], metavar='WEST,SOUTH,EAST,NORTH', help='box to leave out, e.g. a neighbouring country\'s city inside the bbox')
    ap.add_argument('--border-south', default=None, help='polyline lon,lat;lon,lat;... below which cells are left out (a southern land border)')
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    west, south, east, north = args.bbox
    excludes = [tuple(float(v) for v in e.split(',')) for e in args.exclude]
    border = [tuple(float(v) for v in pt.split(',')) for pt in args.border_south.split(';')] if args.border_south else None
    cells = []
    with args.asc.open() as f:
        h = read_header(f)
        ncols, nrows = int(h['ncols']), int(h['nrows'])
        cs = h['cellsize']
        x0, y0 = h['xllcorner'], h['yllcorner']
        nodata = h.get('nodata_value', -9999)
        for row in range(nrows):
            lat = y0 + (nrows - row - 0.5) * cs
            line = f.readline()
            if lat < south or lat > north:
                continue
            values = line.split()
            c0 = max(0, int((west - x0) / cs))
            c1 = min(ncols, int((east - x0) / cs) + 1)
            for col in range(c0, c1):
                v = float(values[col])
                if v == nodata or v <= 0:
                    continue
                lon = x0 + (col + 0.5) * cs
                if any(bw <= lon <= be and bs <= lat <= bn for bw, bs, be, bn in excludes):
                    continue
                if border and below_border(lon, lat, border):
                    continue
                cells.append((v, lon, lat))
    cells.sort(reverse=True)
    chosen = []
    spacing = args.spacing_km * 1_000
    for v, lon, lat in cells:
        if len(chosen) >= args.count:
            break
        ok = True
        for c in chosen:
            d = haversine(lon, lat, c['lon'], c['lat'])
            if d < spacing:
                ok = False
                break
        if ok:
            chosen.append({'lon': round(lon, 4), 'lat': round(lat, 4), 'population': round(v)})
    out = {
        'name': args.name,
        'year': args.year,
        'rule': f'The {args.count} most populous 5-arc-minute cells of the HYDE 3.3 {args.year} population grid inside the box {west}, {south} to {east}, {north}, in descending order, skipping any cell within {args.spacing_km:g} km of one already taken'
        + (f'; {len(excludes)} boxes of neighbouring cities left out' if excludes else '') + ('; cells south of the land border left out' if border else ''),
        'evidence': 'modelled',
        'source': 'Klein Goldewijk, K. (2023). History Database of the Global Environment 3.3 (CC BY-NC-SA 4.0)',
        'targets': chosen,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, indent=1) + '\n')
    print(len(chosen), 'targets written; largest', chosen[0], 'smallest', chosen[-1])
    return 0


def below_border(lon, lat, border):
    for (x1, y1), (x2, y2) in zip(border, border[1:]):
        if min(x1, x2) <= lon <= max(x1, x2):
            f = (lon - x1) / (x2 - x1) if x2 != x1 else 0
            return lat < y1 + f * (y2 - y1)
    return False


def haversine(lon1, lat1, lon2, lat2):
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


if __name__ == '__main__':
    raise SystemExit(main())
