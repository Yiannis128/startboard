class ShortcutEntry {
  constructor(title, url) {
    this.title = title;
    this.url = url;
  }
}

class Config {
  constructor() {
    this._data = {};
    this._loaded = false;
  }

  async load() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (items) => {
        this._data = items;
        this._loaded = true;
        resolve();
      });
    });
  }

  _save(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  _get(key, defaultValue = null) {
    return this._data[key] !== undefined ? this._data[key] : defaultValue;
  }

  async _set(key, value) {
    this._data[key] = value;
    await this._save(key, value);
  }

  get displayMode() {
    return this._get('displayMode', 'system');
  }

  async setDisplayMode(value) {
    if (!['light', 'dark', 'system'].includes(value)) {
      throw new Error('displayMode must be "light", "dark", or "system"');
    }
    await this._set('displayMode', value);
  }

  get showShortcuts() {
    return this._get('showShortcuts', true);
  }

  async setShowShortcuts(value) {
    await this._set('showShortcuts', Boolean(value));
  }

  get maxShortcuts() {
    return this._get('maxShortcuts', 16);
  }

  get elementsPerRow() {
    return this._get('elementsPerRow', 8);
  }

  get shortcuts() {
    const defaultShortcuts = [
      new ShortcutEntry('Google', 'https://www.google.com'),
      new ShortcutEntry('YouTube', 'https://www.youtube.com'),
      new ShortcutEntry('Facebook', 'https://www.facebook.com'),
      new ShortcutEntry('Instagram', 'https://www.instagram.com'),
      new ShortcutEntry('ChatGPT', 'https://chatgpt.com'),
      new ShortcutEntry('X', 'https://x.com'),
      new ShortcutEntry('Financial Times', 'https://www.ft.com'),
      new ShortcutEntry('Reddit', 'https://www.reddit.com'),
      new ShortcutEntry('GitHub', 'https://github.com/Yiannis128/startboard'),
      new ShortcutEntry('Yiannis', 'https://yiannis.info')
    ];
    const stored = this._get('shortcuts', null);
    if (!stored) {
      return defaultShortcuts;
    }
    return stored.map(s => new ShortcutEntry(s.title, s.url));
  }

  async setShortcuts(value) {
    // Limit to max shortcuts
    const limitedValue = value.slice(0, this.maxShortcuts);
    await this._set('shortcuts', limitedValue);
  }
}

const config = new Config();
