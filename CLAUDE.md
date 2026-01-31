# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StartBoard is a customizable start page that can be published as both a Chrome extension (new tab override) and a standalone PWA (GitHub Pages).

## Build Commands

- **Build CSS**: `npm run build:css` (run after modifying Tailwind classes)
- **Watch mode**: `npm run watch` (rebuilds CSS on changes)
- **Build Chrome extension**: `npm run build:extension` → outputs to `dist/extension/` and `dist/startboard-extension.zip`
- **Build PWA**: `npm run build:pwa` → outputs to `dist/pwa/`
- **Build both**: `npm run build:all`

To test the PWA locally: `npx serve dist/pwa`

## Architecture

### Dual-Publish System

The codebase supports two deployment targets with shared source code:

| Target | Storage | Version Source | Build Output |
|--------|---------|----------------|--------------|
| Chrome Extension | `chrome.storage.sync` | `manifest.json` | `dist/extension/` |
| PWA | `localStorage` | `version.js` (generated) | `dist/pwa/` |

**Abstraction layers** in `src/`:
- `storage/StorageAdapter.js` - Detects runtime and provides appropriate storage backend
- `runtime/RuntimeAdapter.js` - Abstracts Chrome-specific APIs (version, settings)

The build scripts (`scripts/build-*.js`) handle target-specific differences:
- Extension build excludes PWA files (`sw.js`, `manifest.webmanifest`)
- PWA build injects service worker registration and meta tags into HTML

### Widget System

Widgets extend `StartWidget` base class with a three-phase lifecycle:

1. **Registration** (`registerConfig(config)`): Register config fields before load
   - Use `registerBooleanField()` / `registerStringField()` helpers
   - Keys auto-namespaced as `{widgetId}.{fieldName}`

2. **Settings UI** (`createSettingsUI(container)`): Build sidebar controls

3. **Initialization** (`async init(config)`): Setup after config loads

**Adding a widget:**
1. Create class extending `StartWidget` in `src/widgets/`
2. Implement: `getId()`, `getName()`, `registerConfig()`, `createSettingsUI()`, `init()`, `show()`, `hide()`
3. Register in `app.js`: call all three lifecycle methods
4. Add `<script>` tag in `src/index.html`

### Configuration System

The `Config` class uses `StorageAdapter` for persistence:

```javascript
get fieldName() {
  return this._get('fieldName', defaultValue);
}

async setFieldName(value) {
  await this._set('fieldName', value);
}
```

Must call `await config.load()` before accessing values.

### Styling

- Tailwind CSS v4 with DaisyUI component library
- `src/input.css` - Tailwind directives
- `src/output.css` - Generated (do not edit)

## Loading the Extension

1. `npm run build:extension`
2. Chrome → `chrome://extensions/` → Enable "Developer mode"
3. Click "Load unpacked" → select `dist/extension/`

After code changes, click refresh on the extension card.

## Deployment

- **Chrome Extension**: Tag-based release via `.github/workflows/publish.yml`
- **PWA**: Auto-deploys to GitHub Pages on push to master via `.github/workflows/deploy-pwa.yml`
