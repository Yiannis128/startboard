const SAFE_SCHEMES = new Set(['http:', 'https:']);

/**
 * Returns a normalised http(s) URL, or null if the input is unusable.
 *
 * Rejecting other schemes matters because these URLs end up in `href` and
 * `location.href`: `javascript:` there is script execution, and shortcuts
 * arrive from user input, imported settings files, and the remote bang feed.
 */
export function safeUrl(raw, { assumeHttps = false } = {}) {
  if (typeof raw !== 'string') return null;
  let text = raw.trim();
  if (!text) return null;

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text);
  if (!hasScheme) {
    if (!assumeHttps) return null;
    text = `https://${text}`;
  }

  try {
    const url = new URL(text);
    return SAFE_SCHEMES.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
