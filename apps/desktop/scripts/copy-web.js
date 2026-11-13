// Copies the web build into ./renderer so electron-builder can package it.
const fs = require('node:fs');
const path = require('node:path');
const src = path.join(__dirname, '..', '..', 'web', 'dist');
const dst = path.join(__dirname, '..', 'renderer');
if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('Web build not found. Run "npm run build -w @infra-tech/web" first.');
  process.exit(1);
}
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('Copied web build to', dst);
