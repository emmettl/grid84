#!/usr/bin/env python3
"""Turn a HYDE population-count grid into the atlas's compact binary format.

Input: a HYDE `<year>AD_pop.zip` (from Utrecht University's HYDE 3.3 vault,
CC BY-NC-SA 4.0) containing `popc_<year>AD.asc`, an ESRI ASCII grid of
people per 5-arc-minute cell, 4320 x 2160, NODATA -9999.

Output: `<out>.bin` little-endian float32 row-major from the north-west
corner, plus `<out>.json` with the header and provenance. Float32 keeps the
counts exact enough (HYDE cells are fractional people already) and gzips to
a few megabytes because most of the planet is empty.

Usage:
    python3 scripts/prepare-hyde-grid.py --zip data/siop62/sources/1961AD_pop.zip --year 1961 --out public/data/hyde/popc_1961
"""
from __future__ import annotations

import argparse
import gzip
import io
import json
import struct
import zipfile
from pathlib import Path


def read_asc(text: io.TextIOBase):
    header = {}
    for _ in range(6):
        key, value = text.readline().split()
        header[key.lower()] = float(value) if '.' in value or key.lower() in ('xllcorner', 'yllcorner', 'cellsize') else int(value)
    ncols, nrows = int(header['ncols']), int(header['nrows'])
    nodata = header.get('nodata_value', -9999)
    values = bytearray()
    total = 0.0
    count = 0
    for line in text:
        for token in line.split():
            v = float(token)
            if v == nodata or v < 0:
                v = 0.0
            values += struct.pack('<f', v)
            total += v
            count += 1
    assert count == ncols * nrows, f'expected {ncols * nrows} cells, read {count}'
    return header, bytes(values), total


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip', type=Path, help='HYDE <year>AD_pop.zip')
    ap.add_argument('--asc', type=Path, help='an already extracted popc_<year>AD.asc')
    ap.add_argument('--year', required=True, type=int)
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    member = f'popc_{args.year}AD.asc'
    if args.asc:
        match = str(args.asc)
        with open(args.asc, encoding='ascii') as raw:
            header, blob, total = read_asc(raw)
    elif args.zip:
        with zipfile.ZipFile(args.zip) as zf:
            names = zf.namelist()
            match = next((n for n in names if n.endswith(member)), None)
            if not match:
                raise SystemExit(f'{member} not in {args.zip}: {names[:10]}')
            with zf.open(match) as raw:
                header, blob, total = read_asc(io.TextIOWrapper(raw, encoding='ascii'))
    else:
        raise SystemExit('give --zip or --asc')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(str(args.out) + '.bin.gz', 'wb', compresslevel=9) as gz:
        gz.write(blob)
    meta = {
        'dataset': 'HYDE 3.3',
        'variable': 'popc',
        'year': args.year,
        'width': int(header['ncols']),
        'height': int(header['nrows']),
        'cellSize': float(header['cellsize']),
        'west': float(header['xllcorner']),
        'south': float(header['yllcorner']),
        'encoding': 'float32-le row-major from north-west, gzip',
        'totalPopulation': round(total),
        'source': 'Klein Goldewijk, K. (2023). History Database of the Global Environment 3.3. Utrecht University. https://doi.org/10.24416/UU01-AEZZIT',
        'licence': 'CC BY-NC-SA 4.0',
        'sourceFile': match,
    }
    Path(str(args.out) + '.json').write_text(json.dumps(meta, indent=2) + '\n')
    print(json.dumps(meta, indent=2))
    # Maintain an index of prepared grids for the lab's year switch.
    index_path = args.out.parent / 'index.json'
    entries = {}
    if index_path.exists():
        for e in json.loads(index_path.read_text()).get('grids', []):
            entries[e['name']] = e
    entries[args.out.name] = {'year': args.year, 'name': args.out.name, 'totalPopulation': round(total), 'dataset': meta['dataset'], 'licence': meta['licence']}
    index_path.write_text(json.dumps({'grids': sorted(entries.values(), key=lambda e: e['year'])}, indent=2) + '\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
