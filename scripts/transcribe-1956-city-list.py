#!/usr/bin/env python3
"""Transcribe the 1956 SAC Atomic Weapons Requirements Study city list.

Source: National Security Archive EBB 538, "1st city list complete.pdf", 306
image-only scanned pages. Row grammar as seen on the page:

    [priority] complex NAME [suffix]      DDMM-DDDMM [E] [letter]   <- a target complex
                                          DDMM-DDDMME letter        <- an additional DGZ
                                          CCC BBBB-NNNN             <- category code + BE number

The weapons column on every page is a redaction box; it is recorded per page
as a withheld datum, not silently dropped.

Requires poppler (pdftoppm) and tesseract on PATH. Renders at 300 dpi into a
cache, OCRs with --psm 6, parses with regular expressions and writes JSONL
with the raw OCR line and a confidence flag on every record. Nothing is
invented: a line that does not parse is kept as `unparsed`.

Usage:
    python3 scripts/transcribe-1956-city-list.py --pdf data/siop62/sources/1st_city_list_complete.pdf \
        --first 5 --last 8 --out data/siop62/city-list.jsonl
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REDACTION_MARK = re.compile(r"42\s*USC\s*2168", re.I)
# 1045 0230 ANADYR 6444-17728   |  0237 ANDREYKOVO M-1 5557-03625 GA  |  602 0233 ANAR ° 5038-07227
COMPLEX = re.compile(
    r"^\s*(?:(?P<priority>\d{1,4})\s+)?(?P<complex>\d{4,5})\s+(?P<name>[A-Z][A-Z0-9 .'\-~/]+?)\s+"
    r"(?P<lat>\d{4})\s*[-~]\s*(?P<lon>\d{5})(?P<lonE>E)?(?P<tail>(?:\s+[A-Z0-9]{1,2}){0,2})"
)
# Continuation complex with a name but no numbers (e.g. LENINSK under ANDIZHAN)
SUBNAME = re.compile(r"^\s*(?P<name>[A-Z][A-Z0-9 .'\-]{2,}?)\s+(?P<lat>\d{4})\s*[-~]\s*(?P<lon>\d{5})(?P<lonE>E)?(?P<tail>(?:\s+[A-Z0-9]{1,2}){0,2})")
# 4046- 7220E A   (additional DGZ line, longitude sometimes loses its leading zero)
DGZ = re.compile(r"^\s*(?P<lat>\d{4})\s*[-~]\s*(?P<lon>\d{4,5})\s*(?P<lonE>E)?(?:\s+(?P<letter>[A-Z0-9]{1,2}))?(?=\s|$)")
# 275 0498-9999   (category code + Bombing Encyclopedia number; number may be truncated)
CATEGORY = re.compile(r"^\s*(?P<category>\d{3})\s+(?P<be_prefix>[0-9oOy]{4})\s*[-~]\s*(?P<be_suffix>\d{0,4})(?=\s|$)")
NOISE = re.compile(r"^[\W_]*$")
HEADER = re.compile(r"TOP\s*SECRET|DECLASSIFIED|Authority|RESTRICT|DocId|NW#|DGZ\s+BA", re.I)


def dm_to_degrees(value: str, width: int) -> float | None:
    value = value.zfill(width)
    degrees, minutes = int(value[:-2]), int(value[-2:])
    if minutes >= 60:
        return None
    return degrees + minutes / 60


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
    # Strip the scanner margin noise that tesseract reads as punctuation.
    line = line.replace("€", "E").replace("°", " ").replace("§", "5").replace("«", " ").replace("‘", " ")
    line = fix_digit_groups(line).replace("—", "-").replace("–", "-")
    line = re.sub(r"^\s*\$(?=\d)", "5", line)
    line = re.sub(r"[|;:,'\"‘’“”`·•]+", " ", line)
    line = re.sub(r"(\d)~", r"\1-", line)
    line = re.sub(r"(?<=\d)\s*[=*+\"'`]+\s*(?=\d)", "-", line)
    line = re.sub(r"\b([A-Z]{3,})[a-z]{1,2}\b", r"\1", line)
    # Scanner margin marks read as short junk tokens before the real row.
    line = re.sub(r"^(?:[^\w\s]+\s*|[A-Za-z]{1,2}[^\w\s]*\s+)+", "", line.lstrip())
    line = re.sub(r"\s+", " ", line)
    return line.strip()


def render(pdf: Path, page: int, cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    stem = cache / f"p{page:03d}"
    png = stem.with_name(stem.name + ".png")
    if not png.exists():
        subprocess.run(
            ["pdftoppm", "-f", str(page), "-l", str(page), "-r", "300", "-gray", "-png", "-singlefile", str(pdf), str(stem)],
            check=True,
        )
    return png


def ocr(png: Path) -> list[str]:
    txt = png.with_suffix(".txt")
    if not txt.exists():
        subprocess.run(
            ["tesseract", str(png), str(png.with_suffix("")), "--psm", "6", "-c", "preserve_interword_spaces=1"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    return txt.read_text(encoding="utf-8", errors="ignore").splitlines()


def parse_page(page: int, lines: list[str], state: dict) -> list[dict]:
    """Parse one page. `state["current"]` carries the parent complex across page breaks."""
    records: list[dict] = []
    current: str | None = state.get("current")
    redacted = any(REDACTION_MARK.search(line) for line in lines)
    records.append({
        "kind": "page",
        "page": page,
        "weapons_column": "withheld" if redacted else "no redaction mark read",
        "evidence": "withheld" if redacted else "unknown",
    })
    for raw in lines:
        line = clean(raw)
        if not line or NOISE.match(line) or HEADER.search(line) or REDACTION_MARK.search(line):
            continue
        m = COMPLEX.match(line) or SUBNAME.match(line)
        if m:
            lat = dm_to_degrees(m.group("lat"), 4)
            lon = dm_to_degrees(m.group("lon"), 5)
            complex_no = m.groupdict().get("complex")
            if complex_no:
                current = complex_no[:4]
            name = re.sub(r"\s+[°~-]$", "", m.group("name")).strip()
            records.append({
                "kind": "complex",
                "page": page,
                "priority": int(m.group("priority")) if m.groupdict().get("priority") else None,
                "complex": current,
                "name": name,
                "lat_dm": m.group("lat"),
                "lon_dm": m.group("lon"),
                "lat": lat,
                "lon": lon,
                "east": bool(m.group("lonE")),
                "tail": m.group("tail").strip() or None,
                "confidence": "high" if lat is not None and lon is not None and m.re is COMPLEX and len(complex_no or "") == 4 else "medium",
                "evidence": "documented-1956",
                "raw": raw.rstrip(),
            })
            continue
        m = CATEGORY.match(line)
        if m and current:
            prefix = m.group("be_prefix").replace("o", "0").replace("O", "0").replace("y", "0")
            records.append({
                "kind": "category",
                "page": page,
                "complex": current,
                "category": int(m.group("category")),
                "be_number": f"{prefix}-{m.group('be_suffix')}" if m.group("be_suffix") else f"{prefix}-",
                "confidence": "high" if m.group("be_suffix") and m.group("be_prefix").isdigit() else "low",
                "evidence": "documented-1956",
                "raw": raw.rstrip(),
            })
            continue
        m = DGZ.match(line)
        if m and current:
            records.append({
                "kind": "dgz",
                "page": page,
                "complex": current,
                "lat_dm": m.group("lat"),
                "lon_dm": m.group("lon").zfill(5),
                "lat": dm_to_degrees(m.group("lat"), 4),
                "lon": dm_to_degrees(m.group("lon"), 5),
                "letter": m.group("letter"),
                "confidence": "medium",
                "evidence": "documented-1956",
                "raw": raw.rstrip(),
            })
            continue
        if re.search(r"\d", line) or re.search(r"[A-Z]{3,}", line):
            records.append({"kind": "unparsed", "page": page, "complex": current, "raw": raw.rstrip()})
    state["current"] = current
    return records


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, type=Path)
    ap.add_argument("--first", type=int, default=1)
    ap.add_argument("--last", type=int, default=306)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--cache", type=Path, default=Path("data/siop62/ocr-cache"))
    args = ap.parse_args()

    totals = {"page": 0, "complex": 0, "category": 0, "dgz": 0, "unparsed": 0}
    state: dict = {}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as out:
        for page in range(args.first, args.last + 1):
            records = parse_page(page, ocr(render(args.pdf, page, args.cache)), state)
            for record in records:
                totals[record["kind"]] += 1
                out.write(json.dumps(record, ensure_ascii=False) + "\n")
            counts = {k: sum(1 for r in records if r["kind"] == k) for k in ("complex", "category", "dgz", "unparsed")}
            print(f"page {page:3d}: {counts}", file=sys.stderr)
    print(json.dumps(totals), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
