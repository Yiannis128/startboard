import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boot, fire, set, settled, fakeChrome, field, option, section, view, isHidden,
  MANIFEST, SCHEMA_VERSION,
} from './harness.mjs';

/** The section is either open for business or replaced by the grant prompt. */
function assertGate(window, locked) {
  const sidebar = section(window, 'status');
  assert.equal(isHidden(field(window, 'status', 'show')), locked, 'the show toggle');
  assert.equal(isHidden(sidebar.querySelector('[data-endpoints]')), locked, 'the editor');
  assert.equal(isHidden(sidebar.querySelector('[data-grant]')), !locked, 'the grant prompt');
}

test('uses Chrome runtime APIs and the synced storage tier', async () => {
  const env = fakeChrome();
  const window = await boot({ chrome: env.api });
  const { document } = window;

  assert.equal(document.getElementById('versionDisplay').textContent, 'v9.9.9');
  assert.ok(!document.getElementById('additionalSettings').classList.contains('hidden'));
  assert.ok(isHidden(field(window, 'search', 'engine')),
    'engine picker is meaningless when Chrome owns the default engine');
  assert.equal(env.sync.__version, SCHEMA_VERSION);

  await set(field(window, 'time', 'show'), true);
  assert.equal(env.sync['time.show'], true);
  assert.equal(Object.keys(env.local).length, 0, 'settings must not leak into the local tier');

  const input = view(window, 'search').querySelector('[data-search-input]');
  input.value = 'hello world';
  view(window, 'search').querySelector('[data-search-button]').click();
  await settled();
  assert.equal(env.searches.length, 1);
  assert.equal(env.searches[0].text, 'hello world');
});

test('a custom backdrop upload goes to the local tier, never to sync', async () => {
  const env = fakeChrome();
  const window = await boot({ chrome: env.api });
  const { document } = window;

  await set(option(window, 'backdrop', 'mode', 'image'), true);

  // Five times the 8KB chrome.storage.sync per-item quota.
  const payload = 'A'.repeat(40_000);
  const input = document.querySelector('[data-widget="backdrop"] [data-upload="custom-tiled"]');
  Object.defineProperty(input, 'files', {
    value: [new window.File([payload], 'wallpaper.png', { type: 'image/png' })],
    configurable: true,
  });

  let pickerOpened = false;
  input.click = () => {
    pickerOpened = true;
  };

  await set(option(window, 'backdrop', 'image', 'custom-tiled'), true);
  assert.ok(pickerOpened, 'selecting the upload tile should open the picker');

  // jsdom cannot run a real picker, so stand in for the user choosing a file.
  // Its FileReader is real, so this exercises the actual encode path.
  fire(input, 'change');
  await settled();

  const stored = env.local['backdrop.customTiled'];
  assert.ok(stored?.startsWith('data:image/png;base64,'), 'should store a PNG data URL');
  assert.equal(
    Buffer.from(stored.split(',')[1], 'base64').toString(),
    payload,
    'the stored image should round-trip back to the uploaded bytes',
  );

  assert.equal(env.sync['backdrop.image'], 'custom-tiled', 'sync should hold only the sentinel');
  assert.ok(
    !Object.values(env.sync).some((v) => typeof v === 'string' && v.startsWith('data:')),
    'an upload must never reach the synced tier',
  );
  assert.match(document.body.style.backgroundImage, /data:image\/png/);
  assert.equal(document.body.style.backgroundRepeat, 'repeat');
  assert.equal(document.querySelector('[data-toast-level="error"]'), null, 'upload should not error');
});

test('uploads are read lazily, only when selected', async () => {
  const unselected = fakeChrome({
    sync: { __version: SCHEMA_VERSION },
    local: { 'backdrop.customTiled': 'data:image/png;base64,UNUSED' },
  });
  await boot({ chrome: unselected.api });
  assert.deepEqual(unselected.reads, [], 'a default backdrop should read no uploads at startup');

  const selected = fakeChrome({
    sync: { __version: SCHEMA_VERSION, 'backdrop.mode': 'image', 'backdrop.image': 'custom-fitted' },
    local: { 'backdrop.customFitted': 'data:image/png;base64,STORED' },
  });
  const window = await boot({ chrome: selected.api });
  await settled();

  assert.match(window.document.body.style.backgroundImage, /STORED/);
  assert.equal(window.document.body.style.backgroundSize, 'cover');
  assert.ok(!selected.reads.includes('backdrop.customTiled'), 'only the selected upload is read');
  assert.equal(
    selected.reads.filter((k) => k === 'backdrop.customFitted').length,
    1,
    'the selected upload should be read exactly once',
  );
});

// Only with the host permission can a probe read a reply from a service that
// sends no CORS headers, or get past Cross-Origin-Resource-Policy at all - so
// adding endpoints is gated on holding it rather than guarded after the fact.
test('the whole status section is gated until host access is granted', async () => {
  const env = fakeChrome();
  const window = await boot({ chrome: env.api });
  assertGate(window, true);

  section(window, 'status').querySelector('[data-grant-access]').click();
  await settled();

  // Asked for exactly what the manifest declares: a pattern it does not carry is
  // rejected outright, which would lock the section for good.
  assert.deepEqual(env.requested, MANIFEST.optional_host_permissions);
  assertGate(window, false);
});

test('a declined grant leaves the section locked', async () => {
  const env = fakeChrome({ grant: false });
  const window = await boot({ chrome: env.api });

  section(window, 'status').querySelector('[data-grant-access]').click();
  await settled();

  assert.deepEqual(env.requested, MANIFEST.optional_host_permissions);
  assertGate(window, true);
});

test('an already-granted extension opens the section without prompting', async () => {
  const env = fakeChrome({ hosts: MANIFEST.optional_host_permissions });
  const window = await boot({ chrome: env.api });

  assertGate(window, false);
  assert.deepEqual(env.requested, []);
  assert.equal(section(window, 'status').querySelector('[data-web-limits]'), null,
    'the web-only CORS warning has no place here');
});

test('exceeding the sync quota surfaces a toast instead of failing silently', async () => {
  const env = fakeChrome({ syncQuotaBytes: 40 });
  const window = await boot({ chrome: env.api });

  await set(field(window, 'welcomeText', 'text'), 'x'.repeat(200), 'input');

  const toast = window.document.querySelector('[data-toast-level="error"]');
  assert.ok(toast, 'a rejected write should be reported');
  assert.match(toast.textContent, /storage/i);
  assert.ok(window.document.body.classList.contains('loaded'), 'page should stay usable');
});
