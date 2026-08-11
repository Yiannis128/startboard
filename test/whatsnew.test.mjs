import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boot, served, set, settled, settings, field, section, view, SRC, SCHEMA_VERSION,
} from './harness.mjs';

const { renderMarkdown } = await import(`${SRC}/core/markdown.js`);

const NOTES = `## What's Changed

- Added a **What's New** page
- Fixed \`safeUrl\` on bare domains

See the [releases](https://github.com/Yiannis128/startboard/releases) page.`;

/** Boots with `notes` as the shipped release notes file. */
const withNotes = (notes, rest = {}) => boot({ assets: { 'whats-new.md': notes }, ...rest });

const seed = (seen) => ({ __version: SCHEMA_VERSION, 'whatsNew.seen': seen });

const button = (window) => view(window, 'whatsNew').querySelector('[data-open]');
const dialog = (window) => view(window, 'whatsNew').querySelector('[data-dialog]');
const notes = (window) => view(window, 'whatsNew').querySelector('[data-notes]');
const shown = (window) => !button(window).classList.contains('hidden');

test('the button opens the notes, then stays away until they change', async () => {
  const window = await withNotes(NOTES);

  assert.ok(shown(window), 'unread notes should be advertised');
  assert.ok(button(window).classList.contains('shake'), 'and should draw the eye');
  assert.deepEqual(served, ['whats-new.md'], 'read once, so the button knows to appear');

  button(window).click();
  await settled();

  assert.ok(dialog(window).open);
  assert.equal(notes(window).querySelector('h2').textContent, "What's Changed");
  assert.equal(notes(window).querySelectorAll('li').length, 2);
  assert.equal(notes(window).querySelector('strong').textContent, "What's New");
  assert.equal(notes(window).querySelector('code').textContent, 'safeUrl');
  assert.equal(
    notes(window).querySelector('a').href,
    'https://github.com/Yiannis128/startboard/releases',
  );
  assert.ok(!shown(window), 'read notes stop advertising themselves');

  // Re-opening neither re-fetches nor re-renders what is already on screen.
  const rendered = notes(window).firstElementChild;
  section(window, 'whatsNew').querySelector('[data-show]').click();
  await settled();
  assert.deepEqual(served, ['whats-new.md'], 'the notes are read once per page');
  assert.equal(notes(window).firstElementChild, rendered, 'and rendered once');
});

test('what is tracked is the notes, not the version around them', async () => {
  const first = await withNotes(NOTES);
  button(first).click();
  await settled();

  // Keyed on the notes themselves: the PWA deploys from master, so the notes it
  // ships are often an earlier release than the app they are shipped with.
  const seen = (await settings())['whatsNew.seen'];
  assert.ok(seen, 'reading the notes records which notes they were');

  const unchanged = await withNotes(NOTES, { settings: seed(seen) });
  assert.ok(!shown(unchanged), 'the same notes stay read');

  const next = await withNotes(`${NOTES}\n\n- And one more thing`, { settings: seed(seen) });
  assert.ok(shown(next), 'notes that have changed announce themselves again');
});

test('a stamped release is what gets tracked, and never renders', async () => {
  const window = await withNotes(`<!-- release: v9.9.9 -->\n\n${NOTES}`);
  button(window).click();
  await settled();

  assert.equal((await settings())['whatsNew.seen'], 'v9.9.9');
  assert.equal(
    view(window, 'whatsNew').querySelector('[data-version]').textContent,
    'v9.9.9',
    'the dialog names the release the notes came from',
  );
  assert.doesNotMatch(notes(window).innerHTML, /release:/, 'the stamp is not content');
  assert.equal(notes(window).querySelector('h2').textContent, "What's Changed");
});

test('the home screen button can be turned off without hiding the page', async () => {
  const window = await withNotes(NOTES, { settings: { __version: SCHEMA_VERSION } });
  await set(field(window, 'whatsNew', 'hideOnHome'), true);

  assert.ok(!shown(window));
  assert.equal(
    (await settings())['whatsNew.seen'],
    undefined,
    'hiding the button is not reading the notes',
  );

  section(window, 'whatsNew').querySelector('[data-show]').click();
  await settled();
  assert.ok(dialog(window).open);
  assert.equal(notes(window).querySelector('h2').textContent, "What's Changed");
});

test('notes are left unread until they can be read', async () => {
  const window = await withNotes(null);
  assert.ok(!shown(window), 'nothing to advertise when the notes cannot be fetched');

  section(window, 'whatsNew').querySelector('[data-show]').click();
  await settled();

  assert.ok(dialog(window).open, 'the dialog still opens');
  assert.match(notes(window).textContent, /Could not load the release notes: HTTP 404/);
  assert.equal(
    notes(window).querySelector('a').href,
    'https://github.com/Yiannis128/startboard/releases',
  );
  assert.equal((await settings())['whatsNew.seen'], undefined, 'and nothing is marked read');
});

test('the back gesture closes the dialog', async () => {
  const window = await withNotes(NOTES);
  const entries = window.history.length;

  button(window).click();
  await settled();
  assert.equal(window.history.length, entries + 1, 'an entry to go back to');

  // Firefox for Android navigates rather than closing the dialog for us.
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
  await settled();
  assert.ok(!dialog(window).open);

  // Chrome closes it itself, and the entry has to come off the stack anyway.
  button(window).click();
  await settled();
  dialog(window).close();
  await settled();
  assert.ok(!dialog(window).open);
});

test('release notes are rendered as markup, never as script', async () => {
  const html = renderMarkdown(
    [
      '# Heading',
      '',
      '<script>alert(1)</script>',
      '',
      '[click](javascript:alert(1))',
      '',
      '![shot](javascript:alert(1))',
      '',
      '1. first',
      '2. second',
      '',
      '> quoted',
      '',
      '---',
      '',
      '```',
      '<b>literal</b>',
      '```',
      '',
      'Full Changelog: https://github.com/Yiannis128/startboard/compare/v0.1.0...v0.1.1.',
      '',
      'MAX_ASSET_BYTES is not _emphasis_.',
    ].join('\n'),
  );

  assert.ok(!/<script/.test(html), 'markup in the source must not survive as markup');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!/javascript:/.test(html), 'an unsafe link target must not reach an attribute');
  assert.ok(html.includes('>click<'), 'but its text is still shown');
  assert.ok(html.includes('<code>&lt;b&gt;literal&lt;/b&gt;</code>'));
  assert.ok(html.includes('<h1'));
  assert.ok(html.includes('<ol'));
  assert.ok(html.includes('<blockquote'));
  assert.ok(html.includes('<hr'));
  assert.ok(
    html.includes('href="https://github.com/Yiannis128/startboard/compare/v0.1.0...v0.1.1"'),
    'a bare URL links without swallowing the full stop after it',
  );
  assert.ok(html.includes('MAX_ASSET_BYTES is not <em>emphasis</em>.'));
});

test('a comment in a release body is dropped rather than shown', async () => {
  const html = renderMarkdown('Ship it <!-- reviewers: please\ncheck this --> today');
  assert.ok(!html.includes('reviewers'), 'comments are not content');
  assert.match(html, /Ship it\s+today/);
});

test('turning the button back on reads the notes it was hiding', async () => {
  const window = await withNotes(NOTES, {
    settings: { __version: SCHEMA_VERSION, 'whatsNew.hideOnHome': true },
  });
  assert.deepEqual(served, [], 'nothing to read while the button is off');

  await set(field(window, 'whatsNew', 'hideOnHome'), false);
  assert.ok(shown(window), 'the unread notes turn up without a reload');
});
