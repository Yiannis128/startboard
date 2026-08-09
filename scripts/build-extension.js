#!/usr/bin/env node

/**
 * Builds dist/extension/ and dist/startboard-extension.zip from src/.
 *
 * Everything in src/ ships except the PWA-only files and build inputs, so
 * adding a widget needs no change here.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { copyTree, readVersion } = require('./lib');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'extension');
const ZIP = path.join(ROOT, 'dist', 'startboard-extension.zip');

const EXCLUDE = ['manifest.webmanifest', 'sw.js', 'version.js', 'input.css'];

function build() {
  const version = readVersion(ROOT);
  console.log(`Building Chrome extension (v${version})...`);

  fs.rmSync(OUT, { recursive: true, force: true });
  copyTree(path.join(ROOT, 'src'), path.join(OUT, 'src'), (file) => EXCLUDE.includes(file));
  fs.copyFileSync(path.join(ROOT, 'manifest.json'), path.join(OUT, 'manifest.json'));
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(OUT, 'LICENSE'));

  fs.rmSync(ZIP, { force: true });
  try {
    execFileSync('zip', ['-rq', ZIP, '.'], { cwd: OUT, stdio: 'inherit' });
    console.log('  Output: dist/extension/ and dist/startboard-extension.zip');
  } catch {
    console.error('  Could not create the zip - is `zip` installed? Directory output is still usable.');
    process.exitCode = 1;
  }
}

build();
