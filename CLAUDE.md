# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

StartBoard is a customizable start page published two ways from one source
tree: a Chrome extension (new tab override) and a standalone PWA (GitHub
Pages).

## Build Commands

This project uses **bun**, in CI and locally. `bun.lock` is the lockfile of
record; there is no `package-lock.json`, and npm is not installed on the
development machine.

- `bun install` — dependencies
- `bun run build:extension` → `dist/extension/` and `dist/startboard-extension.zip`
- `bun run build:pwa` → `dist/pwa/`
- `bun run build:all` — both
- `bun run watch` — rebuild CSS on change
- `bun run test` — the test suite (not `bun test`; see Tests below)

The build scripts compile the CSS themselves (`buildCss` in `scripts/lib.js`)
rather than chaining a package script, so `node scripts/build-pwa.js` works
regardless of which runner started it.

Serve the PWA over HTTP to try it — `python3 -m http.server` from inside
`dist/pwa`. ES modules and the service worker will not load from `file://`.

## Tests

`bun run test` builds the PWA and runs the suite; `bun run test:only` skips the
build when `dist/pwa` is already current. The service worker suite reads the
*built* `dist/pwa/sw.js`, so it needs that build to exist.

Tests are written against `node:test` but run under bun — on a machine where
`node` is a bun shim, `node --test` does not work.

**`scripts/test.js` runs each file in its own process, and that is not
optional.** `bun test` evaluates every file in one process; these tests each
build a jsdom window and re-import the app, and that state accumulates until the
run stops exiting — `pwa + extension + migrations` together hang reliably while
any one alone passes. A process per file is also the isolation the tests assume:
module-level state in `src/` starts fresh and one file's stubs cannot leak into
the next. Do not "simplify" this back to a bare `bun test`.

- `test/harness.mjs` — boots the real app in jsdom with browser globals
  installed, plus `fakeChrome()`, a `chrome.*` stub that enforces the real 8KB
  sync per-item quota so the two storage tiers can be told apart
- `test/pwa.test.mjs`, `test/extension.test.mjs` — the same app under each runtime
- `test/migrations.test.mjs`, `test/sw.test.mjs`

There is no browser in CI, so nothing here covers layout, animation, drag and
drop, or the file picker. Those still need a manual pass.

## Architecture

Everything is plain ES modules, no bundler. `src/index.html` loads one script,
`app.js`, which pulls in the rest. There are no globals and no load-order
dependencies.

```
src/
  index.html        page shell: sidebar chrome, plus #view and #settings
  app.js            entry point: load config, mount widgets, wire sidebar
  core/
    Widget.js       base class and the mount/render lifecycle
    fields.js       renders and binds settings controls from a schema
    config.js       settings store, defaults, export/import
    storage.js      chrome.storage and localStorage backends
    migrations.js   SCHEMA_VERSION and the upgrade steps
    theme.js        the effective light/dark theme
    url.js          safeUrl(), the scheme allowlist
    notify.js       toasts and inline error slots
    runtime.js      Chrome extension APIs, with PWA fallbacks
  widgets/          the widgets, plus index.js (the registry)
```

`src/index.html` deliberately contains no widget markup. Widgets render
themselves into a container the framework hands them.

### Widgets

A widget is a class extending `core/Widget.js` with three static properties and
up to four methods:

```js
export class TimeWidget extends Widget {
  static id = 'time';        // config namespace
  static title = 'Time';     // sidebar heading
  static schema = {          // settings fields, see core/fields.js
    show: { type: 'boolean', default: false, label: 'Show current time' },
  };

  mount() {}     // once: build this.root, wire this.section extras
  render() {}    // after mount, and after every settings change
  onChange() {}  // side effects that need to know which field changed
  destroy() {}   // release timers and listeners
}
```

The framework does the rest: it renders the sidebar controls from `schema`,
reflects stored values into them, persists edits, and calls `render()`
afterwards. `this.root` is the widget's container on the page, `this.section`
its section in the sidebar — scope DOM queries to those rather than using
`document.getElementById`.

**Adding a widget: write the class, add it to `src/widgets/index.js`.** That
registry is the only list. It drives the sidebar order, the page order, the
config defaults, and both builds. Nothing else enumerates widgets — if you find
yourself adding a widget's filename to a second place, that is a bug in the
build, not a step to follow.

Field types live in `core/fields.js`: `boolean`, `text`, `select`, `range`,
`choice` (radio tiles with an optional colour swatch, thumbnail, or custom
HTML), and `value` for state that persists but renders no control. Fields also
take `visibleWhen(get)` to show or hide themselves based on sibling fields,
`validate(value)` to block invalid input with an inline error, `collapsible` to
wrap themselves in an accordion, and `live` to commit on every keystroke instead
of on blur. Use `live` sparingly: each keystroke is a storage write, and
`chrome.storage.sync` caps writes at 120/minute.

Widgets that vary by light/dark read `isDark()` from `core/theme.js` and
subscribe with `onThemeChange()`. That module owns the effective theme, so the
backdrop repaints when the theme flips without importing from whichever widget
owns the mode setting. Widgets must never import from each other — if two need
to share something, it belongs in `core/`.

### Startup cost

This page renders on every new tab, and `body` is `opacity: 0` until `app.js`
has mounted every widget — so anything a `mount()` does is time the user spends
looking at a blank tab. Keep `mount()` to DOM construction and listener wiring.

Storage reads are not free: `chrome.storage.local` is IPC, and `localStorage` is
synchronous main-thread work including the `JSON.parse`. Both tiers can hold
megabytes (an uploaded backdrop, the cached bang feed), so read them lazily —
when the value is actually needed — rather than on the way in. `BackdropWidget`
reads an upload only when that tile is the selected one; `SearchWidget` defers
the bang cache to `requestIdleCallback`. Neither cost exists on a default setup.

### Configuration

`core/config.js` stores flat keys namespaced `{widgetId}.{field}`. Flat, not
nested, because `chrome.storage.sync` enforces its 8KB quota per item — one
nested object would hit the ceiling almost immediately. Defaults are collected
from the widget schemas at startup, so an unset key reads as its declared
default and there is no second list of defaults to keep in sync.

Two tiers of storage, both in `core/storage.js`:

- `save`/`load` — settings, synced across the user's browsers
- `saveLocal`/`loadLocal` — anything too big to sync (uploaded backdrop images,
  the cached bang feed). On the widget these are `setLocal`/`getLocal`.

A value over the sync quota is rejected by Chrome; `Config.set` catches that and
shows a toast rather than letting the write fail unnoticed. Do not rely on it —
if a setting can hold arbitrary user data, it belongs in the local tier in the
first place. `backdrop.image` stores a sentinel (`custom-tiled`) in settings and
keeps the data URL itself under `backdrop.customTiled` in the local tier;
migration `1:` exists to undo the version that got this wrong.

### Migrations

Stored settings carry a `__version`. `core/migrations.js` walks data forward one
version at a time until it matches `SCHEMA_VERSION`.

To add a migration: bump `SCHEMA_VERSION`, add a `STEPS` entry keyed by the
version it upgrades *from*, taking the v(n) shape and returning v(n+1). **Never
edit an existing step** — someone's browser is still on that version and will
run it on next load. A fresh install skips migrations entirely and starts at the
current version.

Imported settings files go through the same chain, so an old export still loads.

### URL safety

`core/url.js` `safeUrl()` is the only way a URL should reach an `href` or
`location.href`. Shortcut URLs come from user input and imported settings files;
bang targets come from a third-party feed. All three are places a
`javascript:` URL would be script execution, so the scheme allowlist is not
optional. Shortcuts are re-validated on render, not just on save, because an
imported file bypasses the save path.

### Builds

Both build scripts copy `src/` recursively and exclude by name, so neither has
a file manifest to maintain. `scripts/lib.js` holds the shared copy and listing
helpers.

- Extension: excludes `manifest.webmanifest`, `sw.js`, `input.css`
- PWA: excludes `input.css`, injects the manifest link, meta tags, generated
  `version.js`, and the service worker registration into `index.html`

`src/sw.js` has `{{VERSION}}` and `{{ASSETS}}` placeholders filled by
`scripts/build-pwa.js`, which generates the precache list from the files it
actually copied. `isShell()` decides what goes in: code and markup at any size,
plus assets under 64KB. Bulk content is cached on first use instead — the
backdrop library alone is ~13MB and would otherwise be downloaded in full on
install. A widget shipping large assets is handled by that rule automatically;
there is nothing to add here.

The service worker ignores cross-origin requests. Caching the Helium bangs feed
there would shadow the widget's own weekly cache and make "Refresh Bangs" a
no-op.

## Styling

Tailwind CSS v4 with DaisyUI, configured CSS-first in `src/input.css`. There is
no `tailwind.config.js` — v4 does not read one unless the CSS says `@config`,
and this project does not. `src/output.css` is generated and gitignored.

Tailwind only emits classes it finds verbatim in the source. A template like
`` `peer-checked:border-${role}` `` produces nothing; write the variants out in
full (see the `ACCENTS` map in `core/fields.js`).

## Loading the Extension

1. `bun run build:extension`
2. `chrome://extensions/` → enable "Developer mode"
3. "Load unpacked" → select `dist/extension/`

Click refresh on the extension card after code changes.

## External Dependencies

**Helium Bangs** — `SearchWidget` fetches bang definitions from
`https://services.helium.imput.net/bangs.json`. Needs `host_permissions` in
`manifest.json`. The response is JavaScript-flavoured (license comments,
trailing commas) and is sanitized before `JSON.parse`. Cached for a week in
local storage.

## Workflows

- `build.yml` — pull requests, master, and callable via `workflow_call`. Builds
  both targets, runs the suite, uploads the extension zip; on a master push it
  also deploys `dist/pwa` to GitHub Pages.
- `release.yml` — on release creation: checks the tag against the manifest,
  calls `build.yml`, attaches the zip to the release, publishes to the Chrome
  Web Store.

One workflow does the building, so a PR, a master push and a release all run the
same steps, and Pages only ever gets a build the suite passed. The Pages deploy
is a separate job so its `pages` concurrency group can decline to cancel a
deployment already going out, while the build job's own group still cancels
superseded runs. The Pages steps are skipped unless the event is a master push,
which is why they sit in a job holding `pages: write`.

Checkout, Bun, the dependency cache, and `bun install` live in the composite
action at `.github/actions/setup`. Checkout itself has to stay in each caller —
a local action cannot be resolved before the repository is on disk. Bun's
version comes from `packageManager` in `package.json` rather than `latest`, so
CI cannot drift onto a different release than the one used locally.

## Releasing

`manifest.json` is the single source of version truth, and `readVersion` in
`scripts/lib.js` is its only reader — CI asks `node scripts/version.js` rather
than parsing the file itself. `readVersion` fails when `package.json` disagrees,
so the two cannot drift. Bump both, commit, then create a release tagged
`v<version>`; `release.yml` refuses to publish when the tag disagrees with the
manifest, so a forgotten bump fails the release instead of shipping a
mislabelled extension. That check runs beside the build rather than after it, so
a bad tag costs seconds instead of a full build and test run.

Publishing needs four repository secrets: `CHROME_EXTENSION_ID`,
`CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` (see
https://developer.chrome.com/docs/webstore/using-api). It lives in
`scripts/publish-webstore.sh`, not inline in the workflow, so it gets shellcheck
and can be run by hand after a failed release. It uses `curl` rather than a
third-party action to keep publish credentials out of code this repo does not
control, and inspects the response body rather than the status code — both Web
Store endpoints answer 200 with a failure payload.

The GitHub release asset is attached before the Web Store step, so a Web Store
failure still leaves a downloadable build on the release.
