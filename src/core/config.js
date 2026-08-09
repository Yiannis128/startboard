import { isQuotaError } from './storage.js';
import { SCHEMA_VERSION, migrate } from './migrations.js';
import { notify } from './notify.js';

/**
 * Settings store. Keys are flat and namespaced as `{widgetId}.{field}`;
 * defaults come from the widget schemas passed in at construction, so an
 * unset key reads as its declared default rather than undefined.
 */
export class Config {
  constructor(storage, defaults) {
    this._storage = storage;
    this._defaults = defaults;
    this._data = {};
  }

  async load() {
    const stored = await this._storage.load();
    // A first run starts at the current version rather than being walked
    // through migrations that have nothing to act on.
    this._data =
      Object.keys(stored).length === 0
        ? { __version: SCHEMA_VERSION }
        : await migrate(stored, this._storage);

    if (stored.__version !== SCHEMA_VERSION) {
      await this._storage.replaceAll(this._data);
    }
  }

  get(key) {
    return this._data[key] !== undefined ? this._data[key] : this._defaults[key];
  }

  async set(key, value) {
    this._data[key] = value;
    try {
      await this._storage.save(key, value);
    } catch (error) {
      if (isQuotaError(error)) {
        notify('Storage is full. Export your settings, then clear something to make room.', 'error');
        return;
      }
      throw error;
    }
  }

  /** Bulk data kept out of synced settings, which have an 8KB per-item quota. */
  loadLocal(key) {
    return this._storage.loadLocal(key);
  }

  saveLocal(key, value) {
    return this._storage.saveLocal(key, value);
  }

  export() {
    return { ...this._data };
  }

  /** Replaces all settings - keys absent from `data` are dropped. */
  async import(data) {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Expected a settings object');
    }
    const migrated = await migrate(data, this._storage);
    await this._storage.replaceAll(migrated);
    this._data = migrated;
  }
}
