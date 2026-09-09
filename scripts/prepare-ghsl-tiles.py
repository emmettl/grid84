#!/usr/bin/env python3
"""Cut a GHSL population GeoTIFF into tiles the exposure worker fetches on demand.

The Global Human Settlement Layer's GHS-POP grids come as one global GeoTIFF
at 30 arc seconds in WGS84 (43,200 by 21,600 cells, a hundred times HYDE's
5 arc minutes), far too large to load whole in a browser. This writes the
grid as fixed-size tiles, float32 little-endian gzip like the HYDE grids,
with an index naming the tiles that hold anyone, so the worker loads only
the tiles under a request. The GeoTIFF is decoded once through a memory map
on disk, so the machine's memory is not the limit.

Usage: python3 scripts/prepare-ghsl-tiles.py --tif GHS_POP_E2025_GLOBE_R2023A_4326_30ss_V1_0.tif \
    --epoch 2025 --out public/data/ghsl/popc_2025 [--tile 1200] [--bbox W S E N]
Requires tifffile and imagecodecs (pip install --user tifffile imagecodecs).
"""
from __future__ import annotations

import argparse
import gzip
import json
import struct
from pathlib import Path

import numpy as np
import tifffile


def geotransform(tif: tifffile.TiffFile):
    page = tif.pages[0]
    tags = page.tags
    scale = tags['ModelPixelScaleTag'].value
    tie = tags['ModelTiepointTag'].value
    # Tie point: raster (i, j, k) -> model (x, y, z); GHSL uses the top-left corner.
    return {'west': float(tie[3] - tie[0] * scale[0]), 'north': float(tie[4] + tie[1] * scale[1]), 'dx': float(scale[0]), 'dy': float(scale[1]), 'width': page.imagewidth, 'height': page.imagelength, 'nodata': tags.get('GDAL_NODATA').value if 'GDAL_NODATA' in tags else None}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--tif', required=True, type=Path)
    ap.add_argument('--epoch', type=int, required=True)
    ap.add_argument('--out', required=True, type=Path, help='output prefix, e.g. public/data/ghsl/popc_2025')
    ap.add_argument('--tile', type=int, default=1200, help='cells per tile edge; 1200 is ten degrees at 30 arc seconds')
    ap.add_argument('--bbox', nargs=4, type=float, default=None, metavar=('W', 'S', 'E', 'N'), help='only write tiles touching this box')
    ap.add_argument('--memmap', type=Path, default=None, help='where to put the decoded copy; default beside the tif')
    ap.add_argument('--dataset', default=None, help='dataset label; default GHSL GHS-POP R2023A. Use it to label a synthetic specimen honestly')
    args = ap.parse_args()

    with tifffile.TiffFile(args.tif) as tif:
        g = geotransform(tif)
        print('grid', g)
        page = tif.pages[0]
        memmap_path = args.memmap or args.tif.with_suffix('.decoded.raw')
        if memmap_path.exists() and memmap_path.stat().st_size == page.imagelength * page.imagewidth * page.dtype.itemsize:
            data = np.memmap(memmap_path, dtype=page.dtype, mode='r', shape=(page.imagelength, page.imagewidth))
            print('reusing', memmap_path)
        else:
            print('decoding to', memmap_path)
            data = page.asarray(out=str(memmap_path))
    nodata = float(g['nodata']) if g['nodata'] is not None else None
    W, H, T = g['width'], g['height'], args.tile
    tiles_x = -(-W // T)
    tiles_y = -(-H // T)
    cell = g['dx']
    south = g['north'] - H * g['dy']
    out_dir = Path(str(args.out))
    (out_dir / 'tiles').mkdir(parents=True, exist_ok=True)
    present = []
    total = 0.0
    for ty in range(tiles_y):
        r0, r1 = ty * T, min(H, (ty + 1) * T)
        tile_north = g['north'] - r0 * g['dy']
        tile_south = g['north'] - r1 * g['dy']
        if args.bbox and (tile_north < args.bbox[1] or tile_south > args.bbox[3]):
            continue
        band = np.asarray(data[r0:r1, :], dtype=np.float64)
        if nodata is not None:
            band = np.where(band == nodata, 0.0, band)
        band = np.where(np.isfinite(band) & (band > 0), band, 0.0)
        for tx in range(tiles_x):
            c0, c1 = tx * T, min(W, (tx + 1) * T)
            tile_west = g['west'] + c0 * cell
            tile_east = g['west'] + c1 * cell
            if args.bbox and (tile_east < args.bbox[0] or tile_west > args.bbox[2]):
                continue
            block = band[:, c0:c1]
            s = float(block.sum())
            if s <= 0:
                continue
            total += s
            full = np.zeros((T, T), dtype='<f4')
            full[: block.shape[0], : block.shape[1]] = block
            with gzip.open(out_dir / 'tiles' / f'{ty}_{tx}.bin.gz', 'wb', compresslevel=6) as gz:
                gz.write(full.tobytes())
            present.append([ty, tx, round(s)])
        print(f'row {ty + 1}/{tiles_y}: {len(present)} tiles so far, {total:,.0f} people')
    meta = {
        'dataset': args.dataset or 'GHSL GHS-POP R2023A',
        'variable': 'popc',
        'year': args.epoch,
        'width': W,
        'height': H,
        'cellSize': cell,
        'west': g['west'],
        'south': south,
        'tiled': True,
        'tileSize': T,
        'tilesX': tiles_x,
        'tilesY': tiles_y,
        'tiles': present,
        'encoding': 'float32-le row-major from the north-west of each tile, gzip; tiles/<row>_<col>.bin.gz, partial edge tiles zero-padded',
        'totalPopulation': round(total),
        'source': 'Synthetic specimen; not a population dataset' if args.dataset and 'SPECIMEN' in args.dataset else 'Schiavina, M., Freire, S., Carioli, A., MacManus, K. (2023). GHS-POP R2023A, GHS population grid multitemporal (1975-2030). European Commission, Joint Research Centre. https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE',
        'licence': 'none' if args.dataset and 'SPECIMEN' in args.dataset else 'CC BY 4.0',
        'sourceFile': args.tif.name,
        'bbox': args.bbox,
    }
    Path(str(args.out) + '.json').write_text(json.dumps(meta, indent=1) + '\n')
    print(json.dumps({k: v for k, v in meta.items() if k != 'tiles'}, indent=2), len(present), 'tiles')
    # Add to the grids index the lab reads, beside the HYDE years.
    index_path = Path('public/data/hyde/index.json')
    entries = {}
    if index_path.exists():
        for e in json.loads(index_path.read_text()).get('grids', []):
            entries[e['name']] = e
    entries[args.out.name] = {'year': args.epoch, 'name': args.out.name, 'path': f'ghsl/{args.out.name}', 'totalPopulation': round(total), 'dataset': meta['dataset'], 'licence': meta['licence'], 'tiled': True, 'cellSize': cell}
    index_path.write_text(json.dumps({'grids': sorted(entries.values(), key=lambda e: e['year'])}, indent=2) + '\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
