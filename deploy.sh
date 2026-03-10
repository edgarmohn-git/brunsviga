#!/bin/bash
# Brunsviga — Deploy zu Cloudflare Pages
# Aufruf: bash deploy.sh

cd "$(dirname "$0")"

echo ""
echo "=== Brunsviga Deploy ==="
echo ""

# Build (erzeugt docs/index.html)
node build.js

# Anleitung mitkopieren
cp anleitung.html docs/anleitung.html

echo ""
echo "✓ docs/ ist aktuell. Jetzt pushen:"
echo ""
echo "  git add docs/ && git commit -m 'Deploy' && git push"
echo ""
echo "  → Cloudflare Pages deployed automatisch nach dem Push."
echo ""
