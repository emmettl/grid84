#!/usr/bin/env python3
"""Point the GHSL entries of the grids index at a bucket, or back at data/.

Usage: python3 scripts/point-grids-at.py https://grids.example.org   # absolute base
       python3 scripts/point-grids-at.py local                         # back to data/ghsl/...
"""
import json, sys
from pathlib import Path

base = sys.argv[1] if len(sys.argv) > 1 else 'local'
p = Path('public/data/hyde/index.json')
d = json.loads(p.read_text())
for g in d['grids']:
    if not g.get('tiled'):
        continue
    g['path'] = f'ghsl/{g["name"]}' if base == 'local' else f'{base.rstrip("/")}/ghsl/{g["name"]}'
p.write_text(json.dumps(d, indent=2) + '\n')
print([g['path'] for g in d['grids'] if g.get('tiled')])
