#!/usr/bin/env python3
"""Read a window of the tiled GHSL population grid that this site serves.

The grid is prepared by prepare-ghsl-tiles.py as float32 little-endian tiles,
gzipped, laid out row-major from the north-west of each tile, with partial
edge tiles zero-padded. The browser reads it through TiledPopulationGrid; the
build scripts read it through here, so that a target list and a readout are
counting the same people from the same file.

Not a script: a module for the build scripts beside it.
"""
from __future__ import annotations

import gzip
import json
import math
from array import array
from pathlib import Path


class Grid:
    def __init__(self, index_path: Path):
        self.root = index_path.with_suffix('')
        meta = json.loads(index_path.read_text())
        self.meta = meta
        self.cell = float(meta['cellSize'])
        self.west = float(meta['west'])
        self.south = float(meta['south'])
        self.width = int(meta['width'])
        self.height = int(meta['height'])
        self.tile = int(meta['tileSize'])
        self.tiles_x = int(meta['tilesX'])
        self.present = {(int(r), int(c)) for r, c, has in meta['tiles'] if has}
        self._cache: dict[tuple[int, int], array | None] = {}

    @property
    def north(self) -> float:
        return self.south + self.height * self.cell

    def col_of(self, lon: float) -> int:
        return int(math.floor((lon - self.west) / self.cell))

    def row_of(self, lat: float) -> int:
        """Row 0 is the northern edge, as the tiles are written."""
        return int(math.floor((self.north - lat) / self.cell))

    def centre_of(self, row: int, col: int) -> tuple[float, float]:
        return (self.west + (col + 0.5) * self.cell, self.north - (row + 0.5) * self.cell)

    def _tile(self, ty: int, tx: int) -> array | None:
        key = (ty, tx)
        if key in self._cache:
            return self._cache[key]
        value: array | None = None
        if key in self.present:
            path = self.root / 'tiles' / f'{ty}_{tx}.bin.gz'
            if path.exists():
                a = array('f')
                a.frombytes(gzip.decompress(path.read_bytes()))
                value = a
        # Only a handful of tiles cover any one country; holding them all is cheap.
        self._cache[key] = value
        return value

    def value(self, row: int, col: int) -> float:
        if row < 0 or col < 0 or row >= self.height or col >= self.width:
            return 0.0
        t = self._tile(row // self.tile, col // self.tile)
        if t is None:
            return 0.0
        v = t[(row % self.tile) * self.tile + (col % self.tile)]
        # The source marks no-data as a large negative; the tiler keeps it.
        return float(v) if v > 0 else 0.0

    def within_km(self, lon: float, lat: float, radius_km: float) -> float:
        """Sum the people inside a radius, by the cells whose centres fall in it."""
        deg_lat = radius_km / 111.32
        deg_lon = radius_km / (111.32 * max(0.05, math.cos(math.radians(lat))))
        r0, r1 = self.row_of(lat + deg_lat), self.row_of(lat - deg_lat)
        c0, c1 = self.col_of(lon - deg_lon), self.col_of(lon + deg_lon)
        total = 0.0
        for row in range(r0, r1 + 1):
            for col in range(c0, c1 + 1):
                clon, clat = self.centre_of(row, col)
                if haversine_km(lon, lat, clon, clat) <= radius_km:
                    total += self.value(row, col)
        return total


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
