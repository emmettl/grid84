#!/usr/bin/env python3
"""
The world by latitude band, from the grids the studies already use.

The winter model is zonal: it resolves latitude and not longitude, because
that is what a browser can integrate honestly and because the quantity that
matters to a harvest — how much sun a place gets and how long its season is
— is set by latitude. It therefore needs to know, band by band, how much
land there is, how many people live on it, how much of it is under crops and
how much of it is built up and can burn.

All of that is measured rather than assumed. HYDE 3.3's 2023 layers are on a
five-arc-minute grid: popc (people per cell), uopp (built-up area, km² per
cell), cropland and grazing (km² per cell), and the no-data mask is the sea.
This script sums them into ten-degree bands and writes data/atlas/zonal.json.

Usage: python3 scripts/build-zonal-2023.py ~/Downloads/2023AD_pop ~/Downloads/2023AD_lu data/atlas/zonal.json
"""
import json
import math
import sys
from pathlib import Path

R = 6371.0088  # km, the authalic radius


def read_header(path):
    header = {}
    with path.open() as fh:
        for _ in range(6):
            key, value = fh.readline().split()
            header[key.lower()] = float(value)
    return header


def rows(path):
    """Yield (row index, list of floats) for each row of an Arc/Info ASCII grid."""
    with path.open() as fh:
        for _ in range(6):
            fh.readline()
        for index, line in enumerate(fh):
            if not line.strip():
                continue
            yield index, line.split()


def band_index(lat, width):
    return min(int((lat + 90) // width), int(180 // width) - 1)


def main():
    pop_dir = Path(sys.argv[1]).expanduser()
    lu_dir = Path(sys.argv[2]).expanduser()
    out_path = Path(sys.argv[3]) if len(sys.argv) > 3 else Path('data/atlas/zonal.json')
    year = ''.join(c for c in pop_dir.name if c.isdigit())
    width = 10
    count = 180 // width
    fields = ['landKm2', 'population', 'urbanPopulation', 'builtUpKm2', 'croplandKm2', 'grazingKm2']
    bands = [{f: 0.0 for f in fields} for _ in range(count)]

    layers = [
        ('population', pop_dir / f'popc_{year}AD.asc', True),
        ('urbanPopulation', pop_dir / f'urbc_{year}AD.asc', False),
        ('builtUpKm2', pop_dir / f'uopp_{year}AD.asc', False),
        ('croplandKm2', lu_dir / f'cropland{year}AD.asc', False),
        ('grazingKm2', lu_dir / f'grazing{year}AD.asc', False),
    ]

    for field, path, take_land in layers:
        head = read_header(path)
        cell = head['cellsize']
        nrows = int(head['nrows'])
        top = head['yllcorner'] + nrows * cell
        nodata = head['nodata_value']
        # Row areas depend only on latitude.
        areas = []
        for r in range(nrows):
            north = top - r * cell
            south = north - cell
            areas.append(abs(R * R * math.radians(cell) * (math.sin(math.radians(north)) - math.sin(math.radians(south)))))
        indices = [band_index(top - (r + 0.5) * cell, width) for r in range(nrows)]
        for r, values in rows(path):
            if r >= nrows:
                break
            b = bands[indices[r]]
            area = areas[r]
            total = 0.0
            land = 0.0
            for token in values:
                v = float(token)
                if v == nodata:
                    continue
                land += 1
                if v > 0:
                    total += v
            b[field] += total
            if take_land:
                b['landKm2'] += land * area
        print(f'{path.name}: summed', file=sys.stderr)

    # HYDE maps what people use, and gives Antarctica no data at all, so the three
    # southern polar bands come back with no land. Their land fractions are put
    # back from the continent's own geography; nothing else on the continent
    # matters to this model, since nobody lives there and nothing grows.
    antarctic = {0: 1.0, 1: 0.72, 2: 0.09}
    for i, fraction in antarctic.items():
        area = 2 * math.pi * R * R * abs(math.sin(math.radians(-90 + (i + 1) * width)) - math.sin(math.radians(-90 + i * width)))
        bands[i]['landKm2'] = fraction * area

    out = {
        'source': {
            'grids': f'HYDE 3.3 ({year} AD): popc, urbc, uopp, cropland, grazing, five arc-minute',
            'antarctica': 'HYDE gives Antarctica no data; the land fractions of the three southern polar bands are set from the continent\'s geography (1.00, 0.72, 0.09)',
            'method': 'Cells summed into ten-degree latitude bands; land area from the cells the grid gives a value to, weighted by the true area of each row on a sphere of radius 6371.0088 km',
        },
        'year': int(year),
        'bandWidthDeg': width,
        'bands': [
            {
                'south': -90 + i * width,
                'north': -90 + (i + 1) * width,
                'areaKm2': round(2 * math.pi * R * R * abs(math.sin(math.radians(-90 + (i + 1) * width)) - math.sin(math.radians(-90 + i * width)))),
                **{k: round(v) for k, v in b.items()},
            }
            for i, b in enumerate(bands)
        ],
    }
    dest = out_path
    dest.write_text(json.dumps(out, indent=1) + '\n')
    total_pop = sum(b['population'] for b in bands)
    total_crop = sum(b['croplandKm2'] for b in bands)
    print(f'{dest}: {total_pop / 1e9:.2f} billion people, {total_crop / 1e6:.2f} million km² of cropland', file=sys.stderr)


main()
