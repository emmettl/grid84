#!/usr/bin/env python3
"""Parse the OCR text of the 1956 study's airfield list (EBB 538 section 6).

Row grammar seen on the page:
    priority complex NAME[/AIRFIELD NAME] BBBB-8NNN DDMM-DDDMM [letter]
e.g.  62 0270 ARKHANGELSK/OSTROV KEG 0092-8004 6432-04028 U
The BE number's 8xxx suffix marks an airfield; the trailing letter is
kept raw (its meaning is not in the released pages). Every record keeps
its raw line and a confidence flag.

Usage: python3 scripts/transcribe-1956-airfields.py --ocr-dir <dir of pNNN.txt> --out data/siop62/airfields-1956.jsonl
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROW = re.compile(
    r"^\s*(?:(?P<priority>\d{1,4})[°\s]+)?(?P<complex>[0-9CO]\d{3})\s+(?P<name>[A-Z][A-Za-z0-9 .'\-/()»?]+?)\s+"
    r"(?P<be>[0-9oO]{4})\s*[-~=\"'\s]?\s*(?P<be2>[0-9oO]{4})\s+(?P<lat>\d{4,5})\s*[-~=\"'\s]\s*(?P<lon>\d{5})(?:\s*[-=]?\s*(?P<letter>[A-Z0-9]{1,2}))?"
)
HEADER = re.compile(r"TOP\s*SECRET|DECLASSIFIED|Authority|RESTRICT|DocId|NW#|USC 2168", re.I)


DIGIT_LOOKALIKES = str.maketrans({"O": "0", "o": "0", "B": "8", "S": "5", "l": "1", "I": "1", "§": "5", "£": "6"})


def fix_digit_groups(line: str) -> str:
    """Tokens that are mostly digits with look-alike letters become digits: O205=BOO1 -> 0205=8001."""
    out = []
    for tok in line.split(" "):
        core = re.sub(r"[-~=*+\"'`]", "", tok)
        digits = sum(ch.isdigit() for ch in core)
        if len(core) >= 3 and digits >= max(2, len(core) - 2) and re.fullmatch(r"[0-9OoBSlI§£\-~=*+\"'`]+", tok):
            tok = tok.translate(DIGIT_LOOKALIKES)
        out.append(tok)
    return " ".join(out)


def clean(line: str) -> str:
    line = line.replace("€", "E").replace("°", " ").replace("§", "5").replace("«", " ").replace("‘", " ")
    line = fix_digit_groups(line)
    line = re.sub(r"[|;:,\"‘’“”`·•©(){}\[\]]+", " ", line)
    line = line.replace("»", " ").replace("?", "")
    # Separators the OCR renders as quotes, tildes, equals or asterisks between digit groups become hyphens.
    line = re.sub(r"(?<=\d)\s*[~=*+\"'`]+\s*(?=\d)", "-", line)
    # A nine-digit run is a BE number whose hyphen was read as a digit: 0323 9 8022.
    line = re.sub(r"\b(\d{4})[0-9](8\d{3})\b", r"\1-\2", line)
    # An eight-digit run without a separator: 0203 8601.
    line = re.sub(r"\b(\d{4})(8\d{3})\b", r"\1-\2", line)
    # Lowercase tails glued to capitalised name tokens are commas or noise: ANKANGs -> ANKANG.
    line = re.sub(r"\b([A-Z]{3,})[a-z]{1,2}\b", r"\1", line)
    line = re.sub(r"^(?:[^\w\s]+\s*|[A-Za-z]{1,2}[^\w\s]*\s+)+", "", line.lstrip())
    return re.sub(r"\s+", " ", line).strip()


def dm(value: str, width: int):
    value = value.zfill(width)
    d, m = int(value[:-2]), int(value[-2:])
    return None if m >= 60 else d + m / 60


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--ocr-dir', required=True, type=Path)
    ap.add_argument('--out', required=True, type=Path)
    args = ap.parse_args()
    records = []
    unparsed = 0
    for txt in sorted(args.ocr_dir.glob('p*.txt')):
        page = int(re.sub(r'\D', '', txt.stem))
        for raw in txt.read_text(encoding='utf-8', errors='ignore').splitlines():
            line = clean(raw)
            if not line or HEADER.search(line):
                continue
            m = ROW.match(line)
            if not m:
                if re.search(r'\d{4}-\d{5}', line):
                    unparsed += 1
                    records.append({'kind': 'unparsed', 'page': page, 'raw': raw.rstrip()})
                continue
            lat_raw = m.group('lat')
            lat_suspect = len(lat_raw) == 5
            lat = dm(lat_raw[-4:], 4)
            lon = dm(m.group('lon'), 5)
            be = (m.group('be') + '-' + m.group('be2')).replace('o', '0').replace('O', '0')
            complex_no = m.group('complex').replace('C', '0').replace('O', '0')
            name = re.sub(r"\s+[.\-]+$", "", m.group('name')).strip()
            records.append({
                'kind': 'airfield', 'page': page,
                'priority': int(m.group('priority')) if m.group('priority') else None,
                'complex': complex_no, 'name': name, 'be': be,
                'lat_dm': m.group('lat'), 'lon_dm': m.group('lon'), 'lat': lat, 'lon': lon,
                'letter': m.group('letter'),
                'confidence': 'high' if lat and lon and 20 <= lat <= 80 and 5 <= lon <= 180 and be[5] == '8' and name.isupper() and not lat_suspect else 'medium',
                'evidence': 'documented-1956', 'raw': raw.rstrip(),
            })
    args.out.write_text('\n'.join(json.dumps(r, ensure_ascii=False) for r in records) + '\n')
    fields = [r for r in records if r['kind'] == 'airfield']
    print(json.dumps({'airfields': len(fields), 'withPriority': sum(1 for r in fields if r['priority']), 'high': sum(1 for r in fields if r['confidence'] == 'high'), 'unparsed': unparsed}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
