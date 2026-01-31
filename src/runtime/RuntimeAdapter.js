/**
 * Runtime Adapter - Abstraction layer for runtime-specific features
 * Handles Chrome extension APIs vs web/PWA environment
 */

class RuntimeAdapter {
  /**
   * Detect if running as Chrome extension
   */
  static isExtension() {
    return typeof chrome !== 'undefined' &&
           chrome.runtime &&
           typeof chrome.runtime.getManifest === 'function';
  }

  /**
   * Get the application version
   * @returns {string} Version string
   */
  static getVersion() {
    if (RuntimeAdapter.isExtension()) {
      try {
        const manifest = chrome.runtime.getManifest();
        return manifest.version;
      } catch (e) {
        console.warn('Failed to get manifest version:', e);
      }
    }
    // For PWA, use window global set by build script
    if (typeof window !== 'undefined' && window.STARTBOARD_VERSION) {
      return window.STARTBOARD_VERSION;
    }
    return 'unknown';
  }

  /**
   * Open browser settings (Chrome appearance settings)
   * Only works in Chrome extension context
   */
  static openSettings() {
    if (RuntimeAdapter.isExtension() && chrome.tabs && chrome.tabs.update) {
      chrome.tabs.update({ url: 'chrome://settings/appearance' });
    } else {
      alert('Additional settings are only available when running as a browser extension.');
    }
  }
}
