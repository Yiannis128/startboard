import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boot, set, settled, settings, countIntervals, field, option, section, view, isHidden,
  SRC, SCHEMA_VERSION,
} from './harness.mjs';

// From the widget's schema, so editing the default shortcut list is a content
// change rather than a test change.
const { ShortcutsWidget } = await import(`${SRC}/widgets/ShortcutsWidget.js`);
const DEFAULTS = ShortcutsWidget.schema.items.default.length;

test('mounts every widget and reveals the page', async () => {
  const window = await boot();
  const { document } = window;
  // From the registry, so this asserts that it drives the sidebar order rather
  // than that today's list happens to match a copy of it.
  const { WIDGETS } = await import(`${SRC}/widgets/index.js`);

  assert.ok(document.body.classList.contains('loaded'), 'page stayed hidden');
  assert.deepEqual(
    [...document.querySelectorAll('#settings [data-widget]')].map((s) => s.dataset.widget),
    WIDGETS.map((W) => W.id),
  );
  assert.equal(document.querySelectorAll('#view [data-widget-root]').length, WIDGETS.length);
  assert.ok(document.getElementById('additionalSettings').classList.contains('hidden'),
    'extension-only button should be hidden in the PWA');
  assert.equal((await settings()).__version, SCHEMA_VERSION);
});

test('welcome text follows the input and falls back when empty', async () => {
  const window = await boot();
  const heading = view(window, 'welcomeText').querySelector('h1');
  assert.equal(heading.textContent, 'Welcome to StartBoard');
  assert.equal(heading.style.fontFamily, 'sans-serif');

  const input = field(window, 'welcomeText', 'text');
  await set(input, 'Hello there', 'input');
  assert.equal(heading.textContent, 'Hello there');
  assert.equal((await settings())['welcomeText.text'], 'Hello there');

  await set(input, '', 'input');
  assert.equal(heading.textContent, 'Welcome');
});

test('time renders each style and honours seconds and 12-hour', async () => {
  const window = await boot();
  const root = view(window, 'time');
  assert.ok(root.classList.contains('hidden'), 'time should start hidden');
  assert.ok(isHidden(field(window, 'time', 'showSeconds')),
    'sub-settings should be hidden while time is off');

  await set(field(window, 'time', 'show'), true);
  assert.ok(!root.classList.contains('hidden'));
  assert.ok(!isHidden(field(window, 'time', 'showSeconds')));
  assert.match(root.textContent.trim(), /^\d{2}:\d{2}:\d{2}$/);

  await set(field(window, 'time', 'showSeconds'), false);
  assert.match(root.textContent.trim(), /^\d{2}:\d{2}$/);

  await set(field(window, 'time', 'use24Hour'), false);
  assert.match(root.textContent.trim(), /(AM|PM)$/);

  // From the rendered options, so a new style is covered without editing this.
  // Basic is the one that renders plain text rather than countdown units.
  const styles = [...field(window, 'time', 'style').options]
    .map((o) => o.value)
    .filter((value) => value !== 'Basic');

  for (const style of styles) {
    await set(field(window, 'time', 'style'), style);
    assert.equal(root.querySelectorAll('[data-unit]').length, 2, `${style} units`);
    assert.ok(root.querySelector('[data-period]'), `${style} period`);
  }
});

test('time clears its interval when hidden', async () => {
  // Counting live intervals rather than waiting out a tick: the wall-clock
  // version had to sleep past the clock's 1s period to mean anything.
  const intervals = countIntervals();
  try {
    const window = await boot();
    assert.equal(intervals.size, 0, 'a hidden clock should not be ticking');

    await set(field(window, 'time', 'show'), true);
    assert.equal(intervals.size, 1, 'showing the clock starts exactly one interval');

    await set(field(window, 'time', 'show'), false);
    assert.equal(intervals.size, 0, 'hiding the clock clears it');
  } finally {
    intervals.restore();
  }
});

test('shortcuts render, and unsafe URLs never become links', async () => {
  const window = await boot();
  const root = view(window, 'shortcuts');
  const grid = root.querySelector('[data-grid]');
  assert.equal(grid.children.length, DEFAULTS + 1, 'the defaults plus the add button');
  assert.equal(grid.children[0].href, 'https://www.google.com/');

  const title = root.querySelector('[data-title]');
  const url = root.querySelector('[data-url]');
  const error = root.querySelector('[data-dialog-error]');

  title.value = 'Evil';
  url.value = 'javascript:alert(1)';
  root.querySelector('[data-save]').click();
  await settled();
  assert.ok(!error.classList.contains('hidden'), 'javascript: URL should be rejected');
  assert.equal(grid.children.length, DEFAULTS + 1, 'rejected shortcut should not be added');

  title.value = 'Bare Domain';
  url.value = 'example.com';
  root.querySelector('[data-save]').click();
  await settled();
  assert.equal(grid.children.length, DEFAULTS + 2);
  assert.equal((await settings())['shortcuts.items'].at(-1).url, 'https://example.com/');
});

test('a stored javascript: shortcut is filtered out on render', async () => {
  const window = await boot({
    settings: {
      __version: SCHEMA_VERSION,
      'shortcuts.items': [
        { title: 'Bad', url: 'javascript:alert(1)' },
        { title: 'Good', url: 'https://good.example' },
      ],
    },
  });
  const cards = view(window, 'shortcuts').querySelectorAll('[data-grid] a');
  assert.equal(cards.length, 1, 'only the safe shortcut should render');
  assert.equal(cards[0].href, 'https://good.example/');
});

test('shortcuts are not built while the widget is hidden', async () => {
  const window = await boot({ settings: { __version: SCHEMA_VERSION, 'shortcuts.show': false } });
  const grid = view(window, 'shortcuts').querySelector('[data-grid]');
  assert.equal(grid.children.length, 0, 'hidden grid should build nothing');

  await set(field(window, 'shortcuts', 'show'), true);
  assert.equal(grid.children.length, DEFAULTS + 1);
});

test('a status endpoint is added from the sidebar, probed, and removed again', async () => {
  const calls = [];
  const window = await boot({
    fetch: async (url, options) => {
      calls.push({ url, mode: options.mode });
      return { status: 200 };
    },
  });
  const root = view(window, 'status');
  const sidebar = section(window, 'status');
  const panel = root.querySelector('[data-panel]');
  assert.equal(panel.children.length, 0, 'nothing configured, so no tiles');
  assert.equal(sidebar.querySelectorAll('[data-row]').length, 0);
  assert.equal(calls.length, 0, 'an empty list should probe nothing');
  // There is no host permission to hold on the web, so nothing is gated here -
  // the section says what that costs instead.
  assert.ok(sidebar.querySelector('[data-grant]').classList.contains('hidden'));
  assert.ok(!sidebar.querySelector('[data-endpoints]').classList.contains('hidden'));
  assert.ok(sidebar.querySelector('[data-web-limits]'), 'the web build warns about CORS');

  sidebar.querySelector('[data-add]').click();
  root.querySelector('[data-name]').value = 'Cloud';
  root.querySelector('[data-url]').value = 'cloud.example';
  root.querySelector('[data-interval]').value = '10';
  root.querySelector('[data-save]').click();
  await settled();

  assert.deepEqual((await settings())['status.items'], [
    { name: 'Cloud', url: 'https://cloud.example/', interval: 10 },
  ]);
  const tile = panel.querySelector('[data-endpoint]');
  assert.equal(tile.href, 'https://cloud.example/');
  assert.match(tile.querySelector('[data-dot]').className, /bg-success/);
  assert.match(tile.title, /Responding \(HTTP 200\)/);
  assert.deepEqual(calls, [{ url: 'https://cloud.example/', mode: 'cors' }]);
  assert.equal(sidebar.querySelectorAll('[data-row]').length, 1, 'the sidebar lists it');

  // The refresh rate has not come round, so a re-render must not probe again.
  await set(field(window, 'status', 'show'), false);
  assert.ok(
    sidebar.querySelector('[data-endpoints]').classList.contains('hidden'),
    'the editor goes away with the panel it edits',
  );
  await set(field(window, 'status', 'show'), true);
  assert.equal(calls.length, 1, 'an endpoint checked a moment ago is not due');

  // The row's name is the way in to editing, since a touch screen has no
  // right-click to reach the tile menu with.
  sidebar.querySelector('[data-row] button').click();
  assert.equal(root.querySelector('[data-dialog-title]').textContent, 'Edit Endpoint');
  assert.equal(root.querySelector('[data-url]').value, 'https://cloud.example/');
  root.querySelector('[data-cancel]').click();

  sidebar.querySelector('[data-row] [data-remove]').click();
  await settled();
  assert.deepEqual((await settings())['status.items'], []);
  assert.equal(panel.children.length, 0, 'removing the last endpoint empties the panel');
});

test('a cached result stands in, so a new tab does not re-probe everything', async () => {
  const calls = [];
  const window = await boot({
    settings: {
      __version: SCHEMA_VERSION,
      'status.items': [
        { name: 'Fresh', url: 'https://fresh.example', interval: 10 },
        { name: 'Stale', url: 'https://stale.example', interval: 10 },
      ],
    },
    local: {
      'status.states': {
        'https://fresh.example/': { state: 'up', detail: 'HTTP 200', checkedAt: Date.now() },
        'https://stale.example/': { state: 'up', detail: 'HTTP 200', checkedAt: 0 },
      },
    },
    fetch: async (url) => {
      calls.push(url);
      return { status: 503 };
    },
  });
  await settled();

  assert.deepEqual(calls, ['https://stale.example/'], 'only the endpoint past its rate is due');
  const dot = (name) =>
    [...view(window, 'status').querySelectorAll('[data-endpoint]')]
      .find((tile) => tile.textContent.includes(name))
      .querySelector('[data-dot]').className;
  assert.match(dot('Fresh'), /bg-success/, 'the cached colour stands in unprobed');
  assert.match(dot('Stale'), /bg-error/, 'the re-probed one takes its new colour');
});

test('placement moves the panel, and the dot to the anchored edge', async () => {
  const window = await boot({
    settings: {
      __version: SCHEMA_VERSION,
      'status.items': [{ name: 'Cloud', url: 'https://cloud.example', interval: 10 }],
    },
  });
  const panel = view(window, 'status').querySelector('[data-panel]');
  const dotLeads = () =>
    panel.querySelector('[data-endpoint]').firstElementChild.dataset.dot !== undefined;

  assert.match(panel.className, /right-4/);
  assert.match(panel.className, /flex-col/);
  assert.equal(dotLeads(), false, 'anchored right, so the dot sits on the right');

  await set(field(window, 'status', 'placement'), 'left');
  assert.match(panel.className, /left-4/);
  assert.equal(dotLeads(), true, 'anchored left, so the dot sits on the left');

  await set(field(window, 'status', 'placement'), 'top');
  assert.match(panel.className, /flex-row/, 'top and bottom spread across');
  assert.equal(dotLeads(), false, 'no anchored side, so the dot trails');

  await set(field(window, 'status', 'show'), false);
  assert.ok(panel.classList.contains('hidden'), 'the panel hides itself, not its root');
});

test('sidebar rows reorder by dragging', async () => {
  const window = await boot({
    settings: {
      __version: SCHEMA_VERSION,
      'status.items': [
        { name: 'One', url: 'https://one.example', interval: 10 },
        { name: 'Two', url: 'https://two.example', interval: 10 },
      ],
    },
  });
  const sidebar = section(window, 'status');
  const order = () =>
    [...sidebar.querySelectorAll('[data-row]')].map((row) => row.querySelector('button').textContent);
  assert.deepEqual(order(), ['One', 'Two']);

  // jsdom lays nothing out, so every row measures as zero-height at the origin
  // and a dragged row can only land last. That still covers the whole path from
  // pointer events to the committed order.
  const row = sidebar.querySelector('[data-row]');
  const drag = (type, clientY) =>
    row.dispatchEvent(new window.MouseEvent(type, { bubbles: true, clientY }));
  drag('pointerdown', 0);
  drag('pointermove', 40);
  drag('pointerup', 40);
  await settled();

  assert.deepEqual(
    (await settings())['status.items'].map((item) => item.name),
    ['Two', 'One'],
  );
  assert.deepEqual(order(), ['Two', 'One']);
});

test('status states cover error, opaque reply, and no reply', async () => {
  const window = await boot({
    settings: {
      __version: SCHEMA_VERSION,
      'status.items': [
        { name: 'Broken', url: 'https://broken.example', interval: 10 },
        { name: 'Opaque', url: 'https://opaque.example', interval: 10 },
        { name: 'Dead', url: 'https://dead.example', interval: 10 },
        { name: 'Evil', url: 'javascript:alert(1)', interval: 10 },
      ],
    },
    fetch: async (url, options) => {
      if (url.startsWith('javascript:')) throw new Error('should never be fetched');
      if (url.startsWith('https://broken.example')) return { status: 503 };
      // Stands in for a service with no CORS headers: readable only as opaque.
      if (url.startsWith('https://opaque.example')) {
        if (options.mode === 'cors') throw new TypeError('Failed to fetch');
        return { status: 0, type: 'opaque' };
      }
      throw new TypeError('Failed to fetch');
    },
  });
  await settled();

  const tiles = [...view(window, 'status').querySelectorAll('[data-endpoint]')];
  assert.equal(tiles.length, 3, 'a javascript: endpoint must not render');

  const dot = (name) =>
    tiles.find((tile) => tile.textContent.includes(name)).querySelector('[data-dot]').className;
  assert.match(dot('Broken'), /bg-error/);
  assert.match(dot('Opaque'), /bg-success/);
  assert.match(dot('Dead'), /bg-base-content/);
});

test('status stops ticking while it is hidden', async () => {
  const intervals = countIntervals();
  try {
    const window = await boot({
      settings: {
        __version: SCHEMA_VERSION,
        'status.items': [{ name: 'Cloud', url: 'https://cloud.example', interval: 10 }],
      },
    });
    assert.equal(intervals.size, 1, 'one ticker covers the whole list');

    await set(field(window, 'status', 'show'), false);
    assert.equal(intervals.size, 0, 'hiding the panel clears it');
  } finally {
    intervals.restore();
  }
});

test('an invalid custom search URL is reported and not saved', async () => {
  const window = await boot();
  await set(field(window, 'search', 'engine'), 'custom');
  const url = field(window, 'search', 'customUrl');
  const error = window.document.querySelector('[data-widget="search"] [data-error="customUrl"]');
  assert.ok(!isHidden(url), 'custom URL field should be revealed');

  await set(url, 'https://example.com/search?query=nothing');
  assert.ok(!error.classList.contains('hidden'), 'missing %s should be reported');
  assert.equal((await settings())['search.customUrl'], undefined, 'invalid URL must not persist');

  await set(url, 'https://example.com/search?q=%s');
  assert.ok(error.classList.contains('hidden'));
  assert.equal((await settings())['search.customUrl'], 'https://example.com/search?q=%s');
});

test('backdrop paints each mode and derives tiling from the image', async () => {
  const window = await boot();
  const { style } = window.document.body;

  await set(option(window, 'backdrop', 'mode', 'gradient'), true);
  assert.match(style.backgroundImage, /linear-gradient/);
  assert.match(style.backgroundImage, /135deg/);

  await set(field(window, 'backdrop', 'angle'), '45');
  assert.match(style.backgroundImage, /45deg/);

  await set(option(window, 'backdrop', 'mode', 'image'), true);
  assert.equal(style.backgroundImage, '', 'no image selected yet');

  // Taken from the rendered choices, so swapping a wallpaper stays a content
  // change rather than a test failure.
  const images = [...window.document.querySelectorAll('[data-widget="backdrop"] [data-field="image"]')]
    .map((radio) => radio.value)
    .filter((value) => !value.startsWith('custom-'));
  const tiled = images.find((value) => value.includes('/repeat/'));
  const fitted = images.find((value) => !value.includes('/repeat/'));
  assert.ok(tiled && fitted, 'expected both a tiled and a fitted backdrop option');

  await set(option(window, 'backdrop', 'image', tiled), true);
  assert.equal(style.backgroundRepeat, 'repeat');
  assert.equal(style.backgroundSize, 'auto');
  assert.equal((await settings())['backdrop.imageRepeat'], undefined,
    'tiling is derived from the image, not stored');

  await set(option(window, 'backdrop', 'image', fitted), true);
  assert.equal(style.backgroundSize, 'cover');
  assert.equal(style.backgroundRepeat, 'no-repeat');
});

test('theme swaps colours and repaints the backdrop', async () => {
  const window = await boot();
  const { documentElement } = window.document;
  assert.equal(documentElement.getAttribute('data-theme'), 'light');

  await set(option(window, 'backdrop', 'mode', 'gradient'), true);
  const lightGradient = window.document.body.style.backgroundImage;

  const lightPrimary = documentElement.style.getPropertyValue('--color-primary');

  await set(option(window, 'theme', 'mode', 'dark'), true);
  assert.equal(documentElement.getAttribute('data-theme'), 'dark');
  assert.notEqual(documentElement.style.getPropertyValue('--color-primary'), lightPrimary,
    'the accent should take its dark value');
  assert.notEqual(window.document.body.style.backgroundImage, lightGradient,
    'backdrop should repaint for the new theme');
});
