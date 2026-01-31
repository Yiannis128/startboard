/**
 * Storage Adapter - Abstraction layer for persistent storage
 * Supports both Chrome Extension storage and localStorage for PWA
 */

class StorageAdapter {
  /**
   * Detect if running as Chrome extension
   */
  static isExtension() {
    return typeof chrome !== 'undefined' &&
           chrome.storage &&
           chrome.storage.sync;
  }

  /**
   * Factory method to create appropriate storage adapter
   */
  static create() {
    if (StorageAdapter.isExtension()) {
      return new ChromeStorageAdapter();
    }
    return new LocalStorageAdapter();
  }

  /**
   * Load all data from storage
   * @returns {Promise<Object>} All stored data
   */
  async load() {
    throw new Error('Not implemented');
  }

  /**
   * Save a key-value pair to storage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<void>}
   */
  async save(key, value) {
    throw new Error('Not implemented');
  }

  /**
   * Save multiple key-value pairs to storage
   * @param {Object} data - Object with key-value pairs to store
   * @returns {Promise<void>}
   */
  async saveAll(data) {
    throw new Error('Not implemented');
  }
}

/**
 * Chrome Extension storage adapter using chrome.storage.sync
 */
class ChromeStorageAdapter extends StorageAdapter {
  async load() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (items) => {
        resolve(items);
      });
    });
  }

  async save(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  async saveAll(data) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(data, () => {
        resolve();
      });
    });
  }
}

/**
 * LocalStorage adapter for PWA/web usage
 */
class LocalStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    this._storageKey = 'startboard_config';
  }

  async load() {
    const stored = localStorage.getItem(this._storageKey);
    if (!stored) {
      return {};
    }
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored config:', e);
      return {};
    }
  }

  async save(key, value) {
    const data = await this.load();
    data[key] = value;
    this._writeToStorage(data);
  }

  async saveAll(data) {
    const existing = await this.load();
    const merged = { ...existing, ...data };
    this._writeToStorage(merged);
  }

  _writeToStorage(data) {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(data));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.error('Storage quota exceeded. Some settings may not be saved.');
        alert('Storage is full. Please remove some custom images or export your settings.');
      }
      throw e;
    }
  }
}

// Create global storage adapter instance
const storageAdapter = StorageAdapter.create();
