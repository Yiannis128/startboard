#!/usr/bin/env node

/**
 * Runs each test file in its own process.
 *
 * `bun test` evaluates every file in one process. These tests each construct a
 * jsdom window and re-import the app, and that state accumulates across files
 * until the run stops exiting - `pwa + extension + migrations` together hang
 * reliably, while any one of them alone passes. A process per file is also the
 * isolation the tests assume: module-level state in src/ starts fresh, and a
 * stub one file installs cannot leak into the next.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'test');

const files = fs
  .readdirSync(TESTS)
  .filter((name) => name.endsWith('.test.mjs'))
  .sort();

if (files.length === 0) {
  console.error('No test files found in test/');
  process.exit(1);
}

const failed = [];
for (const file of files) {
  const relative = path.join('test', file);
  const { status } = spawnSync('bun', ['test', relative], { cwd: ROOT, stdio: 'inherit' });
  if (status !== 0) failed.push(relative);
}

if (failed.length > 0) {
  console.error(`\nFailed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\n${files.length} test files passed.`);
