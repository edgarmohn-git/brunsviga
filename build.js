// build.js — bündelt alle Dateien in eine einzige HTML-Datei
// Danach läuft staticrypt darüber für den Passwortschutz.
// Aufruf: node build.js

const fs = require('fs');
const path = require('path');

const dir = __dirname;

const css    = fs.readFileSync(path.join(dir, 'style.css'),  'utf8');
const seed   = fs.readFileSync(path.join(dir, 'seed.js'),   'utf8');
const appjs  = fs.readFileSync(path.join(dir, 'app.js'),    'utf8');
let   html   = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

// CSS inline
html = html.replace(
  '<link rel="stylesheet" href="style.css" />',
  `<style>\n${css}\n</style>`
);

// JS inline (seed zuerst, dann app)
html = html.replace(
  '<script src="seed.js"></script>\n<script src="app.js"></script>',
  `<script>\n${seed}\n${appjs}\n</script>`
);

const outFile = path.join(dir, 'bundle.html');
fs.writeFileSync(outFile, html, 'utf8');
console.log('✓ Bundle erstellt: bundle.html');
console.log('  Dateigröße:', Math.round(fs.statSync(outFile).size / 1024), 'KB');
