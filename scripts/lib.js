const fs = require('fs');
const path = require('path');

/** Posix-style path relative to `base`, so exclusion rules read the same on any OS. */
const relative = (base, file) => path.relative(base, file).split(path.sep).join('/');

/** Copies `from` into `to`, skipping paths for which `exclude` returns true. */
function copyTree(from, to, exclude = () => false, base = from) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    if (exclude(relative(base, source))) continue;
    if (entry.isDirectory()) copyTree(source, path.join(to, entry.name), exclude, base);
    else fs.copyFileSync(source, path.join(to, entry.name));
  }
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [relative(base, full)];
  });
}

function readVersion(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf-8')).version;
}

module.exports = { copyTree, listFiles, readVersion };
