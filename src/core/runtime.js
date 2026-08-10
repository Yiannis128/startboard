/** Chrome extension APIs, with PWA fallbacks. */
export const Runtime = {
  isExtension() {
    return typeof chrome !== 'undefined' && typeof chrome.runtime?.getManifest === 'function';
  },

  getVersion() {
    if (Runtime.isExtension()) {
      try {
        return chrome.runtime.getManifest().version;
      } catch (error) {
        console.warn('Failed to read manifest version:', error);
      }
    }
    // Set by scripts/build-pwa.js in the generated version.js.
    return globalThis.STARTBOARD_VERSION ?? 'unknown';
  },

  // app.js only wires the control that calls this when isExtension() is true.
  openSettings() {
    chrome.tabs.update({ url: 'chrome://settings/appearance' });
  },

  /**
   * Search via Chrome's Search API, which honours the user's default engine.
   * @returns {boolean} false if unavailable, so the caller can fall back.
   */
  search(query, onError) {
    if (!Runtime.isExtension() || !chrome.search?.query) return false;
    chrome.search.query({ text: query, disposition: 'CURRENT_TAB' }, () => {
      if (chrome.runtime.lastError) onError?.(chrome.runtime.lastError.message);
    });
    return true;
  },
};
