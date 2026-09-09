#!/usr/bin/env python3
"""Sanity-check a transcription of the 1956 SAC city list.

Reports totals, confidence, priority coverage and coordinate ranges, and
optionally spot-checks a sample of complexes by geocoding their period name
with Photon and measuring the distance to the transcribed 1956 coordinate.
A large distance flags either an OCR error or a renamed place; both are
worth a human look. Nothing is corrected automatically.

Usage:
    python3 scripts/check-1956-city-list.py data/siop62/city-list.jsonl --geocode 20
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

PHOTON = "https://photon.komoot.io/api/"


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (lon1, lat1), (lon2, lat2) = a, b
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dlmb = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def geocode(name: str) -> tuple[float, float] | None:
    url = PHOTON + "?" + urllib.parse.urlencode({"q": name, "limit": 1, "lang": "en"})
    req = urllib.request.Request(url, headers={"User-Agent": "grid84 SIOP//62 transcription check"})
    with urllib.request.urlopen(req, timeout=20) as response:
        payload = json.load(response)
    features = payload.get("features") or []
    if not features:
        return None
    lon, lat = features[0]["geometry"]["coordinates"]
    return (lon, lat)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("jsonl", type=Path)
    ap.add_argument("--geocode", type=int, default=0, help="spot-check this many named complexes via Photon")
    ap.add_argument("--seed", type=int, default=84)
    args = ap.parse_args()

    records = [json.loads(line) for line in args.jsonl.read_text(encoding="utf-8").splitlines() if line.strip()]
    kinds = Counter(r["kind"] for r in records)
    complexes = [r for r in records if r["kind"] == "complex"]
    categories = [r for r in records if r["kind"] == "category"]
    print("records by kind:", dict(kinds))
    print("pages with redaction mark:", sum(1 for r in records if r["kind"] == "page" and r["evidence"] == "withheld"), "of", kinds.get("page", 0))
    print("complex confidence:", dict(Counter(r["confidence"] for r in complexes)))
    print("complexes with priority:", sum(1 for r in complexes if r["priority"] is not None), "of", len(complexes))
    print("distinct complex numbers:", len({r["complex"] for r in complexes if r["complex"]}))
    located = [r for r in complexes if r["lat"] is not None and r["lon"] is not None]
    if located:
        lats = [r["lat"] for r in located]
        lons = [r["lon"] for r in located]
        print(f"latitude range: {min(lats):.2f} to {max(lats):.2f}; longitude range: {min(lons):.2f} to {max(lons):.2f}")
        odd = [r for r in located if not (20 <= r["lat"] <= 80 and 5 <= r["lon"] <= 180)]
        print("complexes outside a Sino-Soviet-bloc bounding box (20-80N, 5-180E):", len(odd))
        for r in odd[:10]:
            print("   ", r["page"], r["name"], r["lat_dm"], r["lon_dm"], "|", r["raw"].strip()[:60])
    print("category codes (top 12):", Counter(r["category"] for r in categories).most_common(12))
    print("population rows (category 275):", sum(1 for r in categories if r["category"] == 275))
    print("category confidence:", dict(Counter(r["confidence"] for r in categories)))

    if args.geocode and located:
        random.seed(args.seed)
        sample = random.sample(located, min(args.geocode, len(located)))
        print(f"\nspot check: {len(sample)} period names through Photon (distance from 1956 coordinate)")
        for r in sample:
            name = r["name"].split(" E GER")[0].split(" MANCH")[0].split(" RUM")[0].split(" CHINA")[0].strip()
            try:
                hit = geocode(name)
            except Exception as error:  # network problems are reported, not hidden
                print(f"   {name:24s} geocoder error: {error}")
                continue
            if hit is None:
                print(f"   {name:24s} no modern match (renamed, or OCR)")
            else:
                km = haversine_km((r["lon"], r["lat"]), hit)
                flag = "" if km < 50 else "  <- check"
                print(f"   {name:24s} {km:8.1f} km{flag}")
            time.sleep(1.0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
