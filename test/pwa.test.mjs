import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot, set, settings, field, option, view, isHidden } from './harness.mjs';

test('mounts every widget and reveals the page', async () => {
  const window = await boot();
  const { document } = window;

  assert.ok(document.body.classList.contains('loaded'), 'page stayed hidden');
  assert.deepEqual(
    [...document.querySelectorAll('#settings [data-widget]')].map((s) => s.dataset.widget),
    ['theme', 'welcomeText', 'time', 'search', 'shortcuts', 'backdrop'],
  );
  assert.equal(document.querySelectorAll('#view [data-widget-root]').length, 6);
  assert.ok(document.getElementById('additionalSettings').classList.contains('hidden'),
    'extension-only button should be hidden in the PWA');
  assert.equal(settings(window).__version, 2);
});

test('welcome text follows the input and falls back when empty', async () => {
  const window = await boot();
  const heading = view(window, 'welcomeText').querySelector('h1');
  assert.equal(heading.textContent, 'Welcome to StartBoard');
  assert.equal(heading.style.fontFamily, 'sans-serif');

  const input = field(window, 'welcomeText', 'text');
  await set(input, 'Hello there', 'input');
  assert.equal(heading.textContent, 'Hello there');
  assert.equal(settings(window)['welcomeText.text'], 'Hello there');

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

  for (const style of ['Clock', 'Clock Labelled', 'Clock Boxed']) {
    await set(field(window, 'time', 'style'), style);
    assert.equal(root.querySelectorAll('[data-unit]').length, 2, `${style} units`);
    assert.ok(root.querySelector('[data-period]'), `${style} period`);
  }
});

test('time clears its interval when hidden', async () => {
  const window = await boot();
  await set(field(window, 'time', 'show'), true);
  const root = view(window, 'time');
  await set(field(window, 'time', 'show'), false);

  const before = root.textContent;
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(root.textContent, before, 'a stopped clock should not keep ticking');
});

test('shortcuts render, and unsafe URLs never become links', async () => {
  const window = await boot();
  const grid = view(window, 'shortcuts').querySelector('[data-grid]');
  assert.equal(grid.children.length, 11, '10 defaults plus the add button');
  assert.equal(grid.children[0].href, 'https://www.google.com/');

  const root = view(window, 'shortcuts');
  const title = root.querySelector('[data-title]');
  const url = root.querySelector('[data-url]');
  const error = root.querySelector('[data-dialog-error]');

  title.value = 'Evil';
  url.value = 'javascript:alert(1)';
  root.querySelector('[data-save]').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(!error.classList.contains('hidden'), 'javascript: URL should be rejected');
  assert.equal(grid.children.length, 11, 'rejected shortcut should not be added');

  title.value = 'Bare Domain';
  url.value = 'example.com';
  root.querySelector('[data-save]').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(grid.children.length, 12);
  assert.equal(settings(window)['shortcuts.items'].at(-1).url, 'https://example.com/');
});

test('a stored javascript: shortcut is filtered out on render', async () => {
  const window = await boot({
    settings: {
      __version: 2,
      'shortcuts.items': [
        { title: 'Bad', url: 'javascript:alert(1)' },
        { title: 'Good', url: 'https://good.example' },
      ],
    },
  });
  const cards = window.document.querySelectorAll('[data-widget-root="shortcuts"] [data-grid] a');
  assert.equal(cards.length, 1, 'only the safe shortcut should render');
  assert.equal(cards[0].href, 'https://good.example/');
});

test('shortcuts are not built while the widget is hidden', async () => {
  const window = await boot({ settings: { __version: 2, 'shortcuts.show': false } });
  const grid = view(window, 'shortcuts').querySelector('[data-grid]');
  assert.equal(grid.children.length, 0, 'hidden grid should build nothing');

  await set(field(window, 'shortcuts', 'show'), true);
  assert.equal(grid.children.length, 11);
});

test('an invalid custom search URL is reported and not saved', async () => {
  const window = await boot();
  await set(field(window, 'search', 'engine'), 'custom');
  const url = field(window, 'search', 'customUrl');
  const error = window.document.querySelector('[data-widget="search"] [data-error="customUrl"]');
  assert.ok(!isHidden(url), 'custom URL field should be revealed');

  await set(url, 'https://example.com/search?query=nothing');
  assert.ok(!error.classList.contains('hidden'), 'missing %s should be reported');
  assert.equal(settings(window)['search.customUrl'], undefined, 'invalid URL must not persist');

  await set(url, 'https://example.com/search?q=%s');
  assert.ok(error.classList.contains('hidden'));
  assert.equal(settings(window)['search.customUrl'], 'https://example.com/search?q=%s');
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

  await set(option(window, 'backdrop', 'image', 'backdrop/repeat/stone_texture_AGF81.jpg'), true);
  assert.match(style.backgroundImage, /stone_texture/);
  assert.equal(style.backgroundRepeat, 'repeat');
  assert.equal(settings(window)['backdrop.imageRepeat'], undefined,
    'tiling is derived from the image, not stored');

  await set(option(window, 'backdrop', 'image', 'backdrop/pexels-photo-449011.jpeg'), true);
  assert.equal(style.backgroundSize, 'cover');
  assert.equal(style.backgroundRepeat, 'no-repeat');
});

test('theme swaps colours and repaints the backdrop', async () => {
  const window = await boot();
  const { documentElement } = window.document;
  assert.equal(documentElement.getAttribute('data-theme'), 'light');

  await set(option(window, 'backdrop', 'mode', 'gradient'), true);
  const lightGradient = window.document.body.style.backgroundImage;

  await set(option(window, 'theme', 'mode', 'dark'), true);
  assert.equal(documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(documentElement.style.getPropertyValue('--color-primary'), '#60a5fa');
  assert.notEqual(window.document.body.style.backgroundImage, lightGradient,
    'backdrop should repaint for the new theme');
});
