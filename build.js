// build.js — bündelt alle Dateien in eine einzige HTML-Datei
// Kein staticrypt mehr — Zugangsschutz über Cloudflare Access.
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

// Direkt nach docs/ schreiben (Cloudflare Pages Deploy-Ziel)
fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
const outFile = path.join(dir, 'docs', 'index.html');
fs.writeFileSync(outFile, html, 'utf8');
console.log('✓ Build fertig: docs/index.html');
console.log('  Dateigröße:', Math.round(fs.statSync(outFile).size / 1024), 'KB');
