#!/usr/bin/env node

// Prints the release version. CI reads it from here rather than parsing
// manifest.json itself, so there is one reader of where the version lives.

const path = require('path');
const { readVersion } = require('./lib');

process.stdout.write(readVersion(path.join(__dirname, '..')));
