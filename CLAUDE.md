# CLAUDE.md

StartBoard is a customizable start page built from one source tree and shipped
two ways: a Chrome extension (new tab override) and a PWA on GitHub Pages.

Each module in `src/core/` opens with a comment stating what it owns and why.
This file covers what is not visible from any one file.

## Commands

bun, locally and in CI. `bun.lock` is the lockfile of record; npm is not
installed on this machine.

- `bun install`
- `bun run build:extension` → `dist/extension/` and the zip
- `bun run build:pwa` → `dist/pwa/`
- `bun run build:all`
- `bun run test` — builds the PWA first; `test:only` skips that
- `bun run watch` — rebuild CSS on change

Serve the PWA over HTTP to try it (`python3 -m http.server` inside `dist/pwa`);
ES modules and the service worker will not load from `file://`. For the
extension: build, then `chrome://extensions/` → Developer mode → Load unpacked →
`dist/extension/`, and hit refresh on the card after every rebuild.

## Tests

**`bun run test`, never `bun test`.** `scripts/test.js` runs each file in its
own process, and that is not optional — every file builds a jsdom window and
re-imports the app, and in one process that state accumulates until the run
stops exiting. The reasoning is in that file; do not simplify it away.

The service worker suite reads the *built* `dist/pwa/sw.js`, so it needs a build
to exist. Tests are written against `node:test` but run under bun, since `node`
is a bun shim here.

`test/harness.mjs` boots the real app in jsdom and provides `fakeChrome()`,
which enforces the real 8KB sync quota so the two storage tiers can be told
apart.

There is no browser in CI, so nothing covers layout, animation, drag and drop,
or the file picker. Those need a manual pass.

## Architecture

Plain ES modules, no bundler. `src/index.html` loads `app.js`, which pulls in
the rest — no globals, no load-order dependencies, and no widget markup in the
HTML. Widgets render themselves into a container the framework hands them.

```text
src/
  app.js       entry point: load config, mount widgets, wire the sidebar
  core/        Widget.js, fields.js, config.js, storage.js, migrations.js,
               theme.js, url.js, notify.js, runtime.js, markdown.js, html.js
  widgets/     the widgets, plus index.js (the registry)
```

### Widgets

A widget extends `core/Widget.js` with `static id`, `title` and `schema`, and up
to four methods: `mount()`, `render()`, `onChange()`, `destroy()`. The framework
renders the sidebar controls from the schema, persists edits and re-renders.
Scope DOM queries to `this.root` (the page container) and `this.section` (the
sidebar section) rather than to `document`.

**To add one: write the class, add it to `src/widgets/index.js`.** That registry
is the only list — it drives sidebar order, page order, config defaults and both
builds. If a widget's name needs adding somewhere else, that is a bug in the
build, not a step to follow.

Widgets must never import from each other; anything two of them need belongs in
`core/`. Light and dark come from `core/theme.js` (`isDark()`,
`onThemeChange()`), so a repaint does not depend on whichever widget owns the
mode setting.

`mount()` is on the critical path: `body` is `opacity: 0` until every widget has
mounted, on every new tab. Build DOM and wire listeners there, nothing more.
Read storage lazily, when the value is actually needed — both tiers can hold
megabytes, `chrome.storage.local` is IPC, and `localStorage` parses on the main
thread.

Field types live in `core/fields.js`. Use `live` sparingly: each keystroke is a
storage write and `chrome.storage.sync` caps writes at 120/minute.

A widget that ticks calls `this.repeat(fn, ms)` instead of holding a timer: each
call replaces the last, no arguments stops it, and `destroy()` clears it — so a
widget that renders conditionally cannot stack tickers or leave one behind.

A `<dialog>` that fills the screen pushes a history entry as it opens, so
Android's back gesture closes it rather than leaving the PWA — see
`WhatsNewWidget.open()`. Chrome closes a modal dialog on the gesture by itself
and the entry is unwound on `close`; elsewhere the navigation arrives as
`popstate` and closes the dialog. The small form dialogs do without it.

### Config and storage

Settings are flat keys namespaced `{widgetId}.{field}`, because
`chrome.storage.sync` applies its 8KB quota per item and one nested object would
hit that immediately. Defaults are collected from the widget schemas at startup,
so there is no second list to keep in sync.

Two tiers in `core/storage.js`: `save`/`load` for synced settings,
`saveLocal`/`loadLocal` for anything too big (uploaded backdrops, the cached
bang feed). `Config.set` toasts on a quota rejection, but do not lean on it — a
setting that can hold arbitrary user data belongs in the local tier from the
start.

### Migrations

Stored settings carry a `__version`, and `core/migrations.js` walks them forward
one step at a time. To add a migration, bump `SCHEMA_VERSION` and add a `STEPS`
entry keyed by the version it upgrades *from*. **Never edit an existing step** —
someone's browser is still on that version. Imports go through the same chain,
so an old export still loads.

### URL safety

`safeUrl()` in `core/url.js` is the only way a URL should reach an `href` or
`location.href`. Shortcuts come from user input and imported settings files,
bang targets from a third-party feed, and a `javascript:` URL in any of those is
script execution. Shortcuts are re-validated on render, not only on save,
because an import bypasses the save path.

### Service checks

`StatusWidget` probes each endpoint twice: `mode: 'cors'` first, since the
status code is the only thing separating an error reply from a healthy one, then
`mode: 'no-cors'`, whose opaque response resolves for any status. A service
sending `Cross-Origin-Resource-Policy: same-origin` blocks both, so the
extension asks for the optional host permission declared in `manifest.json`,
which exempts the fetch from CORS. The settings section is gated on holding it —
a prompt, not an invariant: `status.items` is synced while the permission is
per-install, so endpoints configured with no permission held is the ordinary
state of a second machine, and there the panel shows grey until it is granted.

A page cannot be granted anything, so in the PWA a CORP-protected endpoint reads
as grey, as does an `http://` one — the settings section says so, because a grey
dot on its own looks like a broken service. Nothing in a page can tell a blocked
read from a dead host: fetch, Resource Timing, an `<img>` probe and a WebSocket
all report the same either way. Do not go looking for a signal to key off.

Results are cached in the local tier and read back on the first sweep. Without
that the refresh rate would gate nothing — a new-tab page lives for seconds, so
every tab would re-probe everything. One `setInterval` covers the whole list,
ticking every 15s and probing whatever is due.

### Release notes

`WhatsNewWidget` renders `src/whats-new.md`, which CI overwrites with the body of
the GitHub release before building — see the release notes step in `build.yml`.
The file committed here is a placeholder, and a build made from a working copy
says so on the page rather than showing nothing. A master build takes the latest
published release instead, because Pages deploys from master and would otherwise
serve that placeholder to everyone.

`whatsNew.seen` holds the identity of the notes that were read — the release CI
stamped into them as `<!-- release: v0.1.2 -->`, or a digest of the file when
nothing stamped one. **Not the app version**, which is a different thing: Pages
deploys from master, so the PWA usually ships an earlier release's notes than
the version around them, and keying this on `Runtime.getVersion()` would mark
the next release's notes read before they existed. `seen` is synced, so it would
do that on every machine at once.

The widget therefore has to read the notes to know whether to advertise them,
which it does un-awaited from `mount()`, and skips entirely when the button is
turned off. Rendering waits for the dialog to open.

`core/markdown.js` renders the subset of Markdown a release body uses. Its output
goes into `innerHTML`, so it emits no markup that came from the source: text is
escaped and targets go through `safeUrl()`. The notes travel from a GitHub
release through CI into the build, and none of that is this project's own text.
Comments are dropped, which is what keeps the release stamp off the page.

Tests get the committed placeholder served for them — see `ASSETS` in
`test/harness.mjs` — so a widget fetching a shipped file does not turn up in
another test's fetch stub.

## Styling

Tailwind v4 with DaisyUI, configured CSS-first in `src/input.css`. There is no
`tailwind.config.js`; v4 does not read one unless the CSS says `@config`, and
this project does not. `src/output.css` is generated and gitignored.

Tailwind only emits classes it finds verbatim, so a templated class name
produces nothing. Write the variants out in full — see `ACCENTS` in
`core/fields.js` and `LAYOUTS` in `widgets/StatusWidget.js`.

The bottom-right corner is a ladder of fixed buttons 4rem apart: settings at
`right-4` and donate at `right-20` in `index.html`, What's New at `right-36` in
its widget. `StatusWidget`'s `bottom` placement reserves `right-56` to clear all
three. A fourth button means extending both ends of that, which is the one piece
of layout no single file owns — put it in a flex row if it grows again.

## Builds

Both scripts copy `src/` recursively and exclude by name, so neither has a file
manifest to maintain. The extension drops `manifest.webmanifest`, `sw.js` and
`input.css`; the PWA drops `input.css` and injects the manifest link, meta tags,
a generated `version.js` and the service worker registration into `index.html`.

`src/sw.js` has `{{VERSION}}` and `{{ASSETS}}` placeholders filled from the
files the build actually copied. `isShell()` in `scripts/build-pwa.js` decides
what goes in: code and markup at any size, other assets under 64KB. Bulk content
is cached on first use instead — the backdrop library alone is ~13MB — so a
widget shipping large assets is already handled.

The service worker ignores cross-origin requests. Caching the bangs feed there
would shadow the widget's own weekly cache and make "Refresh Bangs" a no-op.

## CI and releases

`build.yml` builds both targets and runs the suite on pull requests, master, and
via `workflow_call`; a master push also deploys `dist/pwa` to Pages from a
separate job, so its `pages` concurrency group can decline to cancel a
deployment already going out. `release.yml` checks the tag against the manifest,
calls `build.yml`, attaches the zip to the release, then publishes to the Chrome
Web Store. Shared setup is the composite action in `.github/actions/setup`;
checkout itself has to stay in each caller, since a local action cannot be
resolved before the repository is on disk.

`manifest.json` is the version source of truth and `readVersion` in
`scripts/lib.js` is its only reader — it fails when `package.json` disagrees, so
the two cannot drift. Bump both, commit, then create a release tagged
`v<version>`; a mismatched tag fails the release instead of shipping a
mislabelled extension.

The release body becomes the What's New page, so a release with no description
fails the same job for the same reason — nobody wants the development
placeholder shipped as the release notes.

Publishing needs four repository secrets: `CHROME_EXTENSION_ID`,
`CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`. It lives in
`scripts/publish-webstore.sh` so it gets shellcheck and can be run by hand after
a failed release, and it inspects response bodies rather than status codes —
both Web Store endpoints answer 200 with a failure payload.

## External dependencies

`SearchWidget` fetches bang definitions from
`https://services.helium.imput.net/bangs.json`, which needs `host_permissions`
in `manifest.json`. The response is JavaScript-flavoured (license comments,
trailing commas) and is sanitized before `JSON.parse`. Cached for a week in the
local tier.
