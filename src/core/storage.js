/**
 * Persistent storage, backed by chrome.storage in the extension and
 * localStorage in the PWA. Both implementations provide:
 *
 *   load()                 all settings, as one flat object
 *   save(key, value)       one setting
 *   replaceAll(data)       every setting, dropping any key not in `data`
 *   saveLocal(key, value)  bulk data, never synced
 *   loadLocal(key)
 *
 * The two tiers exist because chrome.storage.sync allows only 8KB per item.
 * Settings are kept as flat top-level keys for the same reason - one nested
 * object would hit that ceiling almost immediately.
 */
export function createStorage() {
  return typeof chrome !== 'undefined' && chrome.storage?.sync
    ? new ChromeStorage()
    : new LocalStorage();
}

class ChromeStorage {
  async load() {
    return chrome.storage.sync.get(null);
  }

  async save(key, value) {
    return chrome.storage.sync.set({ [key]: value });
  }

  async replaceAll(data) {
    await chrome.storage.sync.clear();
    return chrome.storage.sync.set(data);
  }

  async saveLocal(key, value) {
    return chrome.storage.local.set({ [key]: value });
  }

  async loadLocal(key) {
    return (await chrome.storage.local.get(key))[key];
  }
}

class LocalStorage {
  static KEY = 'startboard_config';
  static LOCAL_PREFIX = 'startboard_local_';

  // Mirrors the stored blob so a single-key write does not have to read and
  // re-parse everything first.
  #settings = null;

  async load() {
    this.#settings = readJson(LocalStorage.KEY) ?? {};
    return this.#settings;
  }

  async save(key, value) {
    this.#settings ??= await this.load();
    this.#settings[key] = value;
    writeJson(LocalStorage.KEY, this.#settings);
  }

  async replaceAll(data) {
    this.#settings = { ...data };
    writeJson(LocalStorage.KEY, this.#settings);
  }

  async saveLocal(key, value) {
    writeJson(LocalStorage.LOCAL_PREFIX + key, value);
  }

  async loadLocal(key) {
    return readJson(LocalStorage.LOCAL_PREFIX + key);
  }
}

function readJson(key) {
  const raw = localStorage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function isQuotaError(error) {
  return (
    error?.name === 'QuotaExceededError' ||
    error?.code === 22 ||
    /quota/i.test(error?.message ?? '')
  );
}
