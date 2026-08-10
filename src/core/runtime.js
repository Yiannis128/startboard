// Read from the manifest rather than repeated here: a pattern chrome.permissions
// is asked for but the manifest does not declare is rejected outright. All of
// them, so a second optional pattern would widen what needsHostAccess() asks
// for - declare one only if every caller should have to hold it.
const optionalHosts = () => chrome.runtime.getManifest().optional_host_permissions ?? [];

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
   * Whether the optional host permission is still to be asked for. False in the
   * PWA: a page cannot be granted one, so there is nothing to gate on.
   */
  async needsHostAccess() {
    if (!Runtime.isExtension() || !chrome.permissions?.contains) return false;
    const origins = optionalHosts();
    if (origins.length === 0) return false;
    return !(await chrome.permissions.contains({ origins }));
  },

  /** Must be called from a user gesture. @returns {boolean} false if declined. */
  async requestHostAccess() {
    if (!Runtime.isExtension() || !chrome.permissions?.request) return false;
    try {
      return await chrome.permissions.request({ origins: optionalHosts() });
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
