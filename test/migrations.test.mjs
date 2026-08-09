import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot, settings, view, SRC } from './harness.mjs';

const V1 = {
  displayMode: 'dark',
  shortcuts: [{ title: 'Old', url: 'https://old.example' }],
  'welcomeText.show': true,
  'welcomeText.text': 'Legacy',
  'backdrop.mode': 'image',
  'backdrop.image': 'data:image/png;base64,AAAA',
  'backdrop.imageRepeat': true,
  'time.show': true,
};

test('v1 settings migrate forward and still apply', async () => {
  const window = await boot({ settings: structuredClone(V1) });
  const after = await settings();

  assert.equal(after.__version, 2);
  assert.equal(after['theme.mode'], 'dark');
  assert.equal(after.displayMode, undefined, 'the old key should be gone');
  assert.equal(after['shortcuts.items'][0].url, 'https://old.example');
  assert.equal(after.shortcuts, undefined);
  assert.equal(after['backdrop.image'], 'custom-tiled', 'the data URL should become a sentinel');
  assert.equal(after['backdrop.imageRepeat'], undefined, 'tiling is derived now');

  const { createStorage } = await import(`${SRC}/core/storage.js`);
  const moved = await createStorage().loadLocal('backdrop.customTiled');
  assert.match(moved, /base64/, 'the upload should move to the local tier');

  assert.equal(view(window, 'welcomeText').querySelector('h1').textContent, 'Legacy');
  assert.equal(window.document.documentElement.getAttribute('data-theme'), 'dark');
});

test('migrating is idempotent', async () => {
  const { migrate } = await import(`${SRC}/core/migrations.js`);
  const noop = { saveLocal: async () => {} };

  const once = await migrate(structuredClone(V1), noop);
  const twice = await migrate(structuredClone(once), noop);
  assert.deepEqual(twice, once, 'a migrated config must survive a second pass unchanged');
});

test('a fresh install starts at the current version', async () => {
  await boot();
  assert.equal((await settings()).__version, 2);
});

test('import replaces settings rather than merging them', async () => {
  const { Config } = await import(`${SRC}/core/config.js`);
  const { createStorage } = await import(`${SRC}/core/storage.js`);

  await boot({ settings: { __version: 2, 'time.show': true, 'welcomeText.text': 'Before' } });

  const config = new Config(createStorage(), {});
  await config.load();
  await config.import({ __version: 2, 'welcomeText.text': 'After' });

  const stored = await settings();
  assert.equal(stored['welcomeText.text'], 'After');
  assert.equal(stored['time.show'], undefined, 'keys absent from the import should be dropped');

  await assert.rejects(() => config.import([1, 2, 3]), 'a non-object import should be refused');
});
