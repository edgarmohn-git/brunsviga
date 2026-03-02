#!/bin/bash
# Brunsviga — App verschlüsseln
# Aufruf: bash encrypt.sh

cd "$(dirname "$0")"

echo ""
echo "=== Brunsviga Verschlüsselung ==="
echo ""

# Bundle neu bauen (erzeugt bundle.html)
node build.js

echo ""
read -s -p "Passwort für Jörg eingeben: " PW
echo ""
read -s -p "Passwort bestätigen:         " PW2
echo ""

if [ "$PW" != "$PW2" ]; then
  echo "✗ Passwörter stimmen nicht überein. Abbruch."
  exit 1
fi

if [ ${#PW} -lt 4 ]; then
  echo "✗ Passwort zu kurz (mindestens 4 Zeichen). Abbruch."
  exit 1
fi

# Verschlüsseln — Ausgabe in docs/ (GitHub Pages)
mkdir -p docs
npx staticrypt bundle.html \
  --password "$PW" \
  -d docs \
  --remember 0 \
  --short

# bundle.html → docs/index.html umbenennen
mv docs/bundle.html docs/index.html

# Anleitung mitkopieren (unverschlüsselt — kein sensibler Inhalt)
cp anleitung.html docs/anleitung.html

# Aufräumen
rm bundle.html

echo ""
echo "✓ Fertig — docs/index.html ist verschlüsselt."
echo "  docs/anleitung.html ist kopiert."
echo ""
echo "  Jetzt pushen:"
echo "  cd $(pwd) && git add docs/ && git commit -m 'Deploy' && git push"
echo ""
