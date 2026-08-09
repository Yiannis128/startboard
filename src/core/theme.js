/**
 * The page's effective light/dark theme.
 *
 * Widgets that pick different values per theme (colours, backdrops) read it
 * through here and subscribe to changes, so none of them has to import from
 * whichever widget owns the mode setting.
 */

const THEME_CHANGE = 'theme:change';

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.dispatchEvent(new CustomEvent(THEME_CHANGE, { detail: { theme } }));
}

export function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function onThemeChange(listener) {
  document.documentElement.addEventListener(THEME_CHANGE, listener);
}

export function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)');
}
