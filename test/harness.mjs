import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = path.join(ROOT, 'src');

let bootCount = 0;

/**
 * Evaluates the real app against a fresh jsdom document.
 *
 * The app is plain ES modules with no bundler, so it is loaded by importing
 * src/app.js with the browser globals installed. The counter in the specifier
 * re-evaluates app.js, but its imports under src/core and src/widgets keep
 * their module state for the life of the process - which is why
 * scripts/test.js gives each test file its own process.
 */
export async function boot({ chrome, settings } = {}) {
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');
  const dom = new JSDOM(html, { url: 'https://example.test/', pretendToBeVisual: true });
  const { window } = dom;

  // jsdom has no dialog implementation; real browsers do.
  window.HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
  };
  window.matchMedia ??= () => ({ matches: false, addEventListener() {} });

  for (const key of [
    'window', 'document', 'localStorage', 'CustomEvent', 'Event', 'FileReader',
    'Blob', 'URL', 'CSS', 'matchMedia',
  ]) {
    globalThis[key] = window[key];
  }
  globalThis.navigator = window.navigator;
  globalThis.fetch = async () => {
    throw new Error('offline');
  };

  if (chrome) globalThis.chrome = chrome;
  else delete globalThis.chrome;

  // Seeded through the storage layer rather than by writing its keys directly,
  // so tests do not pin how settings are serialised.
  if (settings) {
    const { createStorage } = await import(`${SRC}/core/storage.js`);
    await createStorage().replaceAll(settings);
  }

  await import(`${SRC}/app.js?boot=${++bootCount}`);
  await settled();
  return window;
}

export const fire = (element, type) =>
  element.dispatchEvent(new globalThis.Event(type, { bubbles: true }));

export const settled = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

/** Everything the app has persisted, read back through the storage layer. */
export async function settings() {
  const { createStorage } = await import(`${SRC}/core/storage.js`);
  return createStorage().load();
}

export const field = (window, widget, name) =>
  window.document.querySelector(`[data-widget="${widget}"] [data-field="${name}"]`);

export const option = (window, widget, name, value) =>
  window.document.querySelector(
    `[data-widget="${widget}"] [data-field="${name}"][value="${value}"]`,
  );

export const view = (window, widget) =>
  window.document.querySelector(`[data-widget-root="${widget}"]`);

export const isHidden = (element) => element.closest('[data-field-wrap]').classList.contains('hidden');

export async function set(element, value, event = 'change') {
  if (element.type === 'checkbox' || element.type === 'radio') element.checked = value;
  else element.value = value;
  fire(element, event);
  await settled();
}

/**
 * A chrome.* stub that enforces the real sync per-item quota, so tests can
 * tell the difference between the synced and local storage tiers.
 */
export function fakeChrome({ sync = {}, local = {}, syncQuotaBytes = 8192 } = {}) {
  const searches = [];
  const reads = [];

  const area = (store, quota, track) => ({
    async get(keys) {
      if (keys === null || keys === undefined) return { ...store };
      const list = Array.isArray(keys) ? keys : [keys];
      if (track) reads.push(...list);
      return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]]));
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        const size = key.length + JSON.stringify(value).length;
        if (quota && size > quota) {
          throw new Error(`QUOTA_BYTES_PER_ITEM quota exceeded for "${key}" (${size} bytes)`);
        }
        store[key] = value;
      }
    },
    async clear() {
      for (const key of Object.keys(store)) delete store[key];
    },
    async remove(key) {
      delete store[key];
    },
  });

  return {
    api: {
      storage: {
        sync: area(sync, syncQuotaBytes, false),
        local: area(local, 0, true),
      },
      runtime: { getManifest: () => ({ version: '9.9.9' }), lastError: null },
      search: {
        query(options, callback) {
          searches.push(options);
          callback();
        },
      },
    },
    sync,
    local,
    searches,
    /** Keys read from the local tier, to assert lazy loading. */
    reads,
  };
}
