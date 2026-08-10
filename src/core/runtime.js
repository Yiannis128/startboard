// Chrome grants host access per pattern, and an endpoint can be any host, so
// there is nothing narrower to ask for than the manifest's optional pattern.
const ALL_HOSTS = '*://*/*';

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
   * Whether the extension may read cross-origin replies, from the manifest's
   * optional host permissions.
   *
   * Chrome exempts a fetch from CORS while the permission is held, which is the
   * only way to read a status back from a service that sends no CORS headers -
   * and the only way at all past a `Cross-Origin-Resource-Policy: same-origin`
   * header, which blocks an opaque no-cors read outright. True in the PWA, where
   * there is no such permission to hold and nothing to ask for.
   */
  async hasHostAccess() {
    if (!Runtime.isExtension() || !chrome.permissions?.contains) return true;
    return chrome.permissions.contains({ origins: [ALL_HOSTS] });
  },

  /** Must be called from a user gesture. False if the user declines. */
  async requestHostAccess() {
    if (!Runtime.isExtension() || !chrome.permissions?.request) return true;
    try {
      return await chrome.permissions.request({ origins: [ALL_HOSTS] });
    } catch (error) {
      console.warn('Host permission request failed:', error);
      return false;
    }
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
