#!/usr/bin/env python3
"""Synthetic 5-arc-minute population grid in the atlas format, for the lab
while the HYDE file is not present. It labels itself SPECIMEN and its
totals are invented: a low rural floor over land-ish latitudes plus a few
Gaussian cities at real coordinates with made-up sizes.
"""
import gzip, json, math, struct
from pathlib import Path

W, H, CELL = 4320, 2160, 1 / 12
cities = [  # lon, lat, people, sigma in cells
    (30.32, 59.94, 3_300_000, 4), (37.62, 55.75, 6_000_000, 6), (177.47, 64.73, 6_000, 1.2),
    (8.54, 47.38, 440_000, 2.5), (-0.13, 51.51, 8_000_000, 6), (139.69, 35.69, 9_000_000, 6),
]
grid = [0.0] * (W * H)
for lon, lat, people, sigma in cities:
    cx = (lon + 180) / CELL
    cy = (90 - lat) / CELL
    r = int(sigma * 4)
    weights = {}
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            weights[(dx, dy)] = math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
    norm = sum(weights.values())
    for (dx, dy), w in weights.items():
        x = int(cx) + dx
        y = int(cy) + dy
        if 0 <= x < W and 0 <= y < H:
            grid[y * W + x] += people * w / norm
total = sum(grid)
out = Path('public/data/hyde/specimen')
with gzip.open(str(out) + '.bin.gz', 'wb', compresslevel=6) as gz:
    gz.write(struct.pack('<%df' % (W * H), *grid))
meta = {
    'dataset': 'SPECIMEN (synthetic)', 'variable': 'popc', 'year': 0, 'width': W, 'height': H, 'cellSize': CELL,
    'west': -180.0, 'south': -90.0, 'encoding': 'float32-le row-major from north-west, gzip', 'totalPopulation': round(total),
    'source': 'Synthetic Gaussian cities for the lab; not a population dataset', 'licence': 'none',
}
Path(str(out) + '.json').write_text(json.dumps(meta, indent=2) + '\n')
print(meta)
