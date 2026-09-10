#!/bin/sh
# Rasterise the social card. macOS only: it uses Quick Look to render the SVG
# and sips to crop the square thumbnail back to the 1200 by 630 a card wants.
# The PNG it writes is committed, so no build anywhere depends on this.
set -e
out=$(mktemp -d)
qlmanage -t -s 1200 -o "$out" public/og.svg >/dev/null 2>&1
cp "$out/og.svg.png" public/og.png
sips -c 630 1200 public/og.png >/dev/null
rm -rf "$out"
echo "public/og.png: $(sips -g pixelWidth -g pixelHeight public/og.png | tail -2 | tr -d ' \n')"
