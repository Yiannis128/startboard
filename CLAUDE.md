# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StartBoard is a Chrome extension that provides a custom start page, replacing the default new tab page. The extension is built with vanilla JavaScript, Tailwind CSS v4, and DaisyUI component library.

## Build System

The project uses Tailwind CSS v4 with the standalone CLI for styling:

- **Build CSS once**: `npm run build:css`
- **Watch mode (rebuild on changes)**: `npm run watch`

Always run `npm run build:css` after modifying Tailwind classes or the Tailwind config before testing the extension.

## Architecture

### Extension Structure

- `manifest.json` - Chrome extension manifest (v3) at project root
- `src/` - All source code lives here
  - `index.html` - Main start page that replaces new tab
  - `app.js` - Main application initialization (widget lifecycle, theme management, export/import)
  - `config.js` - Configuration storage class
  - `widgets/` - Widget system
    - `StartWidget.js` - Base widget class
    - `WelcomeTextWidget.js` - Welcome text widget
    - `TimeWidget.js` - Time display widget with multiple styles
    - `ShortcutsWidget.js` - Shortcuts grid with drag-and-drop editing
    - `ThemeWidget.js` - Theme color customization (primary, secondary, accent)
    - `BackdropWidget.js` - Background customization (solid/gradient/image)
  - `input.css` - Tailwind CSS input file (directives only)
  - `output.css` - Generated CSS (do not edit manually)

### Widget System

Widgets are modular, toggleable components that extend `StartWidget` base class. Each widget follows a three-phase lifecycle:

1. **Registration Phase** (`registerConfig(config)`): Called before config loads. Widgets register their config fields using helper methods:
   - `registerBooleanField(config, propertyName, fieldName, defaultValue)`
   - `registerStringField(config, propertyName, fieldName, defaultValue)`
   - Config keys are auto-namespaced as `{widgetId}.{fieldName}`

2. **Settings UI Phase** (`createSettingsUI(settingsContainer)`): Creates settings controls in the sidebar

3. **Initialization Phase** (`async init(config)`): Called after config loads. Sets up DOM, event listeners, and initial display state

**Adding a new widget:**
1. Create class extending `StartWidget` in `src/widgets/`
2. Implement: `getId()`, `getName()`, `registerConfig()`, `createSettingsUI()`, `init()`, `show()`, `hide()`
3. Register in `app.js`: call `registerConfig()`, `createSettingsUI()`, and `init()`
4. Add `<script>` tag in `src/index.html`

**Current widgets:**
- `WelcomeTextWidget` - Welcome text display
- `TimeWidget` - Time display with style options
- `ShortcutsWidget` - Shortcuts grid with drag-and-drop
- `ThemeWidget` - DaisyUI theme color customization
- `BackdropWidget` - Background customization (solid, gradient, image)

### Configuration System

The `Config` class in `src/config.js` handles persistent storage using Chrome's `chrome.storage.sync` API:

- **Pattern**: Each config field has a getter and async setter method
- **Storage**: Values are automatically persisted to Chrome sync storage on set
- **Usage**: Must call `await config.load()` before accessing config values
- **Export/Import**: Settings can be exported as JSON and imported to transfer configurations
- **Widget configs**: Use namespaced keys via widget registration (e.g., `time.show`, `time.style`)

**Adding config fields** (for non-widget features):
Add getter/setter pairs that use internal `_get()` and `_set()` methods:

```javascript
get fieldName() {
  return this._get('fieldName', defaultValue);
}

async setFieldName(value) {
  await this._set('fieldName', value);
}
```

**Core config fields:**
- `displayMode` - Theme preference ('light', 'dark', or 'system')
- `shortcuts` - Array of ShortcutEntry objects
- `maxShortcuts` - Maximum shortcuts allowed (default: 16)
- `elementsPerRow` - Shortcuts per row (default: 8)

### Styling

- Uses Tailwind CSS v4 with DaisyUI component library
- Config: `tailwind.config.js` with DaisyUI plugin enabled
- Components: Use DaisyUI component classes (see https://daisyui.com)
- The extension has `storage` permission in manifest for config persistence

## Loading the Extension

1. Build CSS: `npm run build:css`
2. Open Chrome to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select this project directory

After code changes, click the refresh icon on the extension card in `chrome://extensions/`.
