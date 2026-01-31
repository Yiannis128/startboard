#!/usr/bin/env node

/**
 * Build script for PWA
 * Creates dist/pwa/ directory with PWA-ready files
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PWA_DIST = path.join(DIST, 'pwa');

// Read version from manifest.json
function getVersion() {
  const manifestPath = path.join(ROOT, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  return manifest.version;
}

// Files to copy from src/
const SRC_FILES = [
  'index.html',
  'output.css',
  'config.js',
  'app.js',
  'manifest.webmanifest',
  'sw.js',
  'storage/StorageAdapter.js',
  'runtime/RuntimeAdapter.js',
  'widgets/StartWidget.js',
  'widgets/WelcomeTextWidget.js',
  'widgets/TimeWidget.js',
  'widgets/ShortcutsWidget.js',
  'widgets/ThemeWidget.js',
  'widgets/BackdropWidget.js',
  'img/icon.png',
  'img/icon-192.png',
  'img/icon-512.png'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function clean() {
  if (fs.existsSync(PWA_DIST)) {
    fs.rmSync(PWA_DIST, { recursive: true });
  }
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  ensureDir(destDir);
  fs.copyFileSync(src, dest);
}

function injectPwaIntoHtml(htmlPath) {
  let html = fs.readFileSync(htmlPath, 'utf-8');

  // Add PWA meta tags and manifest link after <head>
  const pwaHead = `
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#3b82f6">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="StartBoard">
  <link rel="apple-touch-icon" href="img/icon-192.png">`;

  html = html.replace('<head>', '<head>' + pwaHead);

  // Add version.js and service worker registration before </body>
  const pwaScripts = `
  <script src="version.js"></script>
  <script>
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('ServiceWorker registered:', registration.scope);
          })
          .catch((error) => {
            console.log('ServiceWorker registration failed:', error);
          });
      });
    }
  </script>`;

  html = html.replace('</body>', pwaScripts + '\n</body>');

  fs.writeFileSync(htmlPath, html);
}

function createVersionFile(version) {
  const versionJs = `// Auto-generated version file for PWA
window.STARTBOARD_VERSION = '${version}';
`;
  fs.writeFileSync(path.join(PWA_DIST, 'version.js'), versionJs);
}

function injectVersionIntoServiceWorker(version) {
  const swPath = path.join(PWA_DIST, 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf-8');
  sw = sw.replace('{{VERSION}}', version);
  fs.writeFileSync(swPath, sw);
}

function build() {
  console.log('Building PWA...');

  const version = getVersion();
  console.log(`  Version: ${version}`);

  clean();
  ensureDir(PWA_DIST);

  // Copy source files
  for (const file of SRC_FILES) {
    const src = path.join(ROOT, 'src', file);
    const dest = path.join(PWA_DIST, file);

    if (fs.existsSync(src)) {
      copyFile(src, dest);
      console.log(`  Copied: ${file}`);
    } else {
      console.warn(`  Warning: ${file} not found`);
    }
  }

  // Create version.js
  createVersionFile(version);
  console.log('  Created: version.js');

  // Inject version into service worker
  injectVersionIntoServiceWorker(version);
  console.log('  Injected version into service worker');

  // Inject PWA tags into HTML
  injectPwaIntoHtml(path.join(PWA_DIST, 'index.html'));
  console.log('  Injected PWA meta tags and service worker registration');

  // Copy LICENSE
  const licenseSrc = path.join(ROOT, 'LICENSE');
  if (fs.existsSync(licenseSrc)) {
    fs.copyFileSync(licenseSrc, path.join(PWA_DIST, 'LICENSE'));
    console.log('  Copied: LICENSE');
  }

  console.log('\nPWA build complete!');
  console.log(`  Directory: dist/pwa/`);
  console.log('\nTo test locally:');
  console.log('  npx serve dist/pwa');
}

build();
