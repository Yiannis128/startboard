const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Compiles Tailwind into src/output.css.
 *
 * Invoked directly rather than chained through a package script, so the build
 * works the same whether it was started by npm, bun, or plain node.
 */
function buildCss(root) {
  const binary = path.join(root, 'node_modules', '.bin', 'tailwindcss');
  if (!fs.existsSync(binary)) {
    throw new Error('tailwindcss is not installed - run your package manager\'s install first');
  }
  execFileSync(binary, ['-i', 'src/input.css', '-o', 'src/output.css'], {
    cwd: root,
    stdio: 'inherit',
  });
}

/**
 * What the service worker precaches: code and markup at any size, plus assets
 * under the limit. Bulk content is cached on first use instead - the backdrop
 * library alone is ~13MB, and precaching it would download the lot on install.
 * Exported so the build and the test that checks it cannot drift apart.
 */
const SHELL_TYPES = ['.html', '.css', '.js', '.webmanifest'];
const MAX_ASSET_BYTES = 64 * 1024;

/** Posix-style path relative to `base`, so exclusion rules read the same on any OS. */
const relative = (base, file) => path.relative(base, file).split(path.sep).join('/');

/** Copies `from` into `to`, skipping any path listed in `exclude`. */
function copyTree(from, to, exclude, base = from) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    if (exclude.has(relative(base, source))) continue;
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

/**
 * The release version, from manifest.json.
 *
 * package.json has to agree, so that `bun install` and the published extension
 * never disagree about what this is. Enforced rather than documented, because a
 * convention nothing checks is one that drifts.
 */
function readVersion(root) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf-8')).version;
  const manifest = read('manifest.json');
  const pkg = read('package.json');
  if (manifest !== pkg) {
    throw new Error(`Version mismatch: manifest.json is ${manifest}, package.json is ${pkg}`);
  }
  return manifest;
}

module.exports = { buildCss, copyTree, listFiles, readVersion, SHELL_TYPES, MAX_ASSET_BYTES };
