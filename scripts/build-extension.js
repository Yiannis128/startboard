#!/usr/bin/env node

/**
 * Build script for Chrome Extension
 * Creates dist/extension/ directory and dist/startboard-extension.zip
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const EXT_DIST = path.join(DIST, 'extension');

// Files/directories to include in extension build
const INCLUDE = [
  'manifest.json',
  'src',
  'LICENSE'
];

// Files to exclude (not needed for extension)
const EXCLUDE = [
  'src/manifest.webmanifest',
  'src/sw.js',
  'src/version.js'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyRecursive(src, dest, excludes = []) {
  const stat = fs.statSync(src);

  // Check if this path should be excluded
  const relativePath = path.relative(ROOT, src);
  if (excludes.some(ex => relativePath === ex || relativePath.startsWith(ex + path.sep))) {
    return;
  }

  if (stat.isDirectory()) {
    ensureDir(dest);
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(
        path.join(src, entry),
        path.join(dest, entry),
        excludes
      );
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function clean() {
  if (fs.existsSync(EXT_DIST)) {
    fs.rmSync(EXT_DIST, { recursive: true });
  }
}

function build() {
  console.log('Building Chrome extension...');

  clean();
  ensureDir(EXT_DIST);

  // Copy files
  for (const item of INCLUDE) {
    const src = path.join(ROOT, item);
    const dest = path.join(EXT_DIST, item);

    if (fs.existsSync(src)) {
      copyRecursive(src, dest, EXCLUDE);
      console.log(`  Copied: ${item}`);
    } else {
      console.warn(`  Warning: ${item} not found`);
    }
  }

  // Create zip file
  const zipPath = path.join(DIST, 'startboard-extension.zip');
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  try {
    execSync(`cd "${EXT_DIST}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
    console.log(`\nCreated: dist/startboard-extension.zip`);
  } catch (e) {
    console.error('Failed to create zip file. Make sure zip is installed.');
  }

  console.log('\nExtension build complete!');
  console.log(`  Directory: dist/extension/`);
}

build();
