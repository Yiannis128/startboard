import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';
import { createRequire } from 'node:module';

// The build stamps the manifest version into the worker's cache name, so read
// it from the same place the build does rather than hard-coding it.
const { readVersion } = createRequire(import.meta.url)('../scripts/lib.js');
const VERSION = readVersion(ROOT);

const BUILT_SW = path.join(ROOT, 'dist', 'pwa', 'sw.js');

before(() => {
  assert.ok(
    fs.existsSync(BUILT_SW),
    'dist/pwa/sw.js is missing - run `npm run build:pwa` before the tests',
  );
});

/** Loads the built service worker with stubbed globals and captures its handlers. */
function loadWorker() {
  const listeners = {};
  const store = new Map();
  const fetched = [];
  const deleted = [];
  let networkFails = false;

  const cache = {
    async addAll(urls) {
      for (const url of urls) store.set(url, new Response(`pre:${url}`, { status: 200 }));
    },
    async put(request, response) {
      store.set(request.url ?? request, response);
    },
  };

  const sandbox = {
    self: {
      addEventListener: (type, handler) => {
        listeners[type] = handler;
      },
      location: { origin: 'https://example.test' },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => cache,
      keys: async () => ['startboard-v0.0.0-old', `startboard-v${VERSION}`],
      delete: async (name) => {
        deleted.push(name);
        return true;
      },
      match: async (request) => store.get(request.url ?? request),
    },
    fetch: async (request) => {
      fetched.push(request.url ?? request);
      if (networkFails) throw new Error('offline');
      return new Response(`net:${request.url}`, { status: 200 });
    },
    Response,
    URL,
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(BUILT_SW, 'utf-8'), sandbox);

  const dispatch = (url, { method = 'GET', mode = 'no-cors' } = {}) => {
    let responded = null;
    const waits = [];
    listeners.fetch({
      request: { url, method, mode },
      respondWith: (promise) => {
        responded = promise;
      },
      waitUntil: (promise) => waits.push(promise),
    });
    return { responded, waits };
  };

  const run = async (type) => {
    const waits = [];
    await listeners[type]({ waitUntil: (promise) => waits.push(promise) });
    await Promise.all(waits);
  };

  return {
    store, fetched, deleted, dispatch, run,
    goOffline: () => {
      networkFails = true;
    },
  };
}

test('precaches the app shell but not bulk assets', async () => {
  const worker = loadWorker();
  await worker.run('install');

  assert.ok(worker.store.has('./index.html'));
  assert.ok(worker.store.has('./app.js'));
  assert.ok(worker.store.has('./output.css'));
  assert.ok(!worker.store.has('./sw.js'), 'the worker should not precache itself');

  // The rule, rather than a list of today's filenames: code and markup at any
  // size, everything else only when small.
  const SHELL_TYPES = ['.html', '.css', '.js', '.webmanifest'];
  const LIMIT = 64 * 1024;
  const sizeOf = (entry) => fs.statSync(path.join(ROOT, 'dist', 'pwa', entry.slice(2))).size;

  const oversized = [...worker.store.keys()]
    .filter((entry) => entry !== './' && !SHELL_TYPES.includes(path.extname(entry)))
    .filter((entry) => sizeOf(entry) > LIMIT);
  assert.deepEqual(oversized, [], 'no bulk asset belongs in the install payload');

  // And the rule actually bites: something in the build was left out.
  const built = fs
    .readdirSync(path.join(ROOT, 'dist', 'pwa', 'img', 'backdrop'), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `./img/backdrop/${entry.name}`);
  const excluded = built.filter((entry) => sizeOf(entry) > LIMIT && !worker.store.has(entry));
  assert.ok(excluded.length > 0, 'expected at least one oversized asset to be excluded');
});

test('leaves cross-origin requests alone', async () => {
  const worker = loadWorker();

  // Caching this would shadow the widget's own weekly cache and make
  // "Refresh Bangs" a no-op.
  assert.equal(worker.dispatch('https://services.helium.imput.net/bangs.json').responded, null);
  assert.equal(worker.dispatch('https://www.google.com/s2/favicons?domain=x.com').responded, null);
  assert.notEqual(worker.dispatch('https://example.test/app.js').responded, null);
  assert.equal(worker.dispatch('https://example.test/app.js', { method: 'POST' }).responded, null);
});

test('serves from cache and revalidates behind it', async () => {
  const worker = loadWorker();
  worker.store.set('https://example.test/output.css', new Response('cached', { status: 200 }));

  const { responded, waits } = worker.dispatch('https://example.test/output.css');
  assert.equal(await (await responded).text(), 'cached');
  await Promise.all(waits);
  assert.ok(worker.fetched.includes('https://example.test/output.css'), 'should revalidate');
});

test('falls back to the shell offline', async () => {
  const worker = loadWorker();
  await worker.run('install');
  worker.goOffline();

  const navigation = worker.dispatch('https://example.test/deep/link', { mode: 'navigate' });
  assert.match(await (await navigation.responded).text(), /^pre:\.\/index\.html$/);

  const asset = worker.dispatch('https://example.test/missing.png');
  assert.equal((await asset.responded).status, 503);
});

test('drops caches from older versions on activate', async () => {
  const worker = loadWorker();
  await worker.run('activate');

  assert.ok(worker.deleted.includes('startboard-v0.0.0-old'), 'stale cache should be dropped');
  assert.ok(!worker.deleted.includes(`startboard-v${VERSION}`), 'current cache should be kept');
});
