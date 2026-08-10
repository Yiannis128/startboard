import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boot, set, settled, settings, localSetting, countIntervals, fakeChrome, field, section, view,
  isHidden, MANIFEST, SCHEMA_VERSION,
} from './harness.mjs';

/** An endpoint seed; the url follows the name unless one is given. */
const endpoint = (name, url = `https://${name.toLowerCase()}.example`, interval = 10) =>
  ({ name, url, interval });

const seed = (...items) => ({ __version: SCHEMA_VERSION, 'status.items': items });

/** The dot classes of the status tile carrying `name`. */
const dot = (window, name) =>
  [...view(window, 'status').querySelectorAll('[data-endpoint]')]
    .find((tile) => tile.textContent.includes(name))
    .querySelector('[data-dot]').className;

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
  assert.ok(isHidden(sidebar.querySelector('[data-grant]')));
  assert.ok(!isHidden(sidebar.querySelector('[data-endpoints]')));
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
    isHidden(sidebar.querySelector('[data-endpoints]')),
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
    settings: seed(endpoint('Fresh'), endpoint('Stale')),
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
  assert.match(dot(window, 'Fresh'), /bg-success/, 'the cached colour stands in unprobed');
  assert.match(dot(window, 'Stale'), /bg-error/, 'the re-probed one takes its new colour');
});

test('the cache holds only endpoints that still exist', async () => {
  const window = await boot({
    settings: seed(endpoint('Live')),
    local: {
      'status.states': {
        'https://gone.example/': { state: 'up', detail: 'HTTP 200', checkedAt: 0 },
      },
    },
    fetch: async (url) => {
      if (url !== 'https://live.example/') throw new Error(`unexpected probe: ${url}`);
      return { status: 200 };
    },
  });
  await settled();

  // Otherwise every url the user ever configured is restored and written back,
  // and the blob grows without bound.
  assert.deepEqual(Object.keys(await localSetting('status.states')), ['https://live.example/']);
  assert.match(dot(window, 'Live'), /bg-success/);
});

test('placement moves the panel, and the dot to the anchored edge', async () => {
  const window = await boot({
    settings: seed(endpoint('Cloud')),
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
    settings: seed(endpoint('One'), endpoint('Two')),
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
    settings: seed(
      endpoint('Broken'),
      endpoint('Opaque'),
      endpoint('Dead'),
      endpoint('Evil', 'javascript:alert(1)'),
    ),
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

  assert.match(dot(window, 'Broken'), /bg-error/);
  assert.match(dot(window, 'Opaque'), /bg-success/);
  assert.match(dot(window, 'Dead'), /bg-base-content/);
});

test('status stops ticking while it is hidden', async () => {
  const intervals = countIntervals();
  try {
    const window = await boot({
      settings: seed(endpoint('Cloud')),
    });
    assert.equal(intervals.size, 1, 'one ticker covers the whole list');

    await set(field(window, 'status', 'show'), false);
    assert.equal(intervals.size, 0, 'hiding the panel clears it');
  } finally {
    intervals.restore();
  }
});

/** The section is either open for business or replaced by the grant prompt. */
function assertGate(window, locked) {
  const sidebar = section(window, 'status');
  assert.equal(isHidden(field(window, 'status', 'show')), locked, 'the show toggle');
  assert.equal(isHidden(sidebar.querySelector('[data-endpoints]')), locked, 'the editor');
  assert.equal(isHidden(sidebar.querySelector('[data-grant]')), !locked, 'the grant prompt');
}

// Adding endpoints is gated on the permission rather than guarded after the fact.
test('the whole status section is gated until host access is granted', async () => {
  const env = fakeChrome();
  const window = await boot({ chrome: env.api });
  assertGate(window, true);

  section(window, 'status').querySelector('[data-grant-access]').click();
  await settled();

  // A pattern the manifest does not declare is rejected outright.
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
