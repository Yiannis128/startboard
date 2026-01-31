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

  /**
   * Save large data to local-only storage (not synced)
   * Use this for data that exceeds sync storage limits
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<void>}
   */
  async saveLocal(key, value) {
    throw new Error('Not implemented');
  }

  /**
   * Load data from local-only storage
   * @param {string} key - Storage key
   * @returns {Promise<*>} Stored value or undefined
   */
  async loadLocal(key) {
    throw new Error('Not implemented');
  }
}

/**
 * Chrome Extension storage adapter using chrome.storage.sync
 */
class ChromeStorageAdapter extends StorageAdapter {
  async load() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(null, (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(items);
        }
      });
    });
  }

  async save(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async saveAll(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async saveLocal(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async loadLocal(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(items[key]);
        }
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

  async saveLocal(key, value) {
    try {
      localStorage.setItem(`startboard_local_${key}`, JSON.stringify(value));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.error('Local storage quota exceeded:', e);
      }
      throw e;
    }
  }

  async loadLocal(key) {
    const stored = localStorage.getItem(`startboard_local_${key}`);
    if (!stored) return undefined;
    try {
      return JSON.parse(stored);
    } catch {
      return undefined;
    }
  }
}

// Create global storage adapter instance
const storageAdapter = StorageAdapter.create();
