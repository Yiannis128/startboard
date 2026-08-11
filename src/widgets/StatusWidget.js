import { Widget } from '../core/Widget.js';
import { Runtime } from '../core/runtime.js';
import { safeUrl } from '../core/url.js';
import { label } from '../core/fields.js';
import { setError } from '../core/notify.js';

const MAX_ENDPOINTS = 10;
const DEFAULT_INTERVAL = 10;
const MAX_INTERVAL = 1440;
const PROBE_TIMEOUT_MS = 8000;
const TICK_MS = 15_000;
const CACHE_KEY = 'states';

const HOLD_MS = 350;
const HOLD_SLOP_PX = 10;
const DRAG_SLOP_PX = 4;

const SPREAD = 'flex flex-row flex-wrap justify-center gap-2';

// Written out per placement because Tailwind only emits classes it finds verbatim.
const LAYOUTS = {
  top: { panel: `fixed top-4 left-4 right-4 z-30 ${SPREAD}` },
  // Stops short of the right edge, where the corner buttons live.
  bottom: { panel: `fixed bottom-4 left-4 right-56 z-30 ${SPREAD}` },
  left: { panel: 'fixed top-4 left-4 z-30 flex flex-col items-start gap-2', dotFirst: true },
  right: { panel: 'fixed top-4 right-4 z-30 flex flex-col items-end gap-2' },
};

const STATES = {
  checking: { dot: 'bg-warning animate-pulse', text: 'Checking' },
  up: { dot: 'bg-success', text: 'Responding' },
  error: { dot: 'bg-error', text: 'Error' },
  // Muted foreground rather than a grey: daisyUI's neutral sits on top of
  // base-100 in the dark theme, which would leave this dot invisible.
  down: { dot: 'bg-base-content opacity-40', text: 'Not responding' },
};

// The locale default, so this can disagree with the time widget's 24-hour setting.
let clock = null;
const at = (time) =>
  (clock ??= new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })).format(time);

const WEB_LIMITS = `
  <div data-web-limits class="rounded-lg border border-warning p-2 mb-3">
    <p class="text-xs font-semibold text-warning">Limited on the web</p>
    <p class="text-xs opacity-70 mt-1">
      A page cannot be granted permission to reach your services. Without CORS headers a
      service can only be told apart as answering or not, and one that blocks cross-origin
      reads stays grey even while it is up. The Chrome extension reports the real status.
    </p>
  </div>`;

const liveUrls = (items) => new Set(items.map((item) => item.url));

/**
 * Whether an endpoint answers, and with what if it will say. The deadline spans
 * both attempts, and is cleared rather than left to fire: `AbortSignal.timeout`
 * would keep a timer alive per probe for as long as it had left to run.
 */
async function probe(url) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await attempt(url, controller.signal);
  } finally {
    clearTimeout(deadline);
  }
}

async function attempt(url, signal) {
  const request = { signal, cache: 'no-store' };
  try {
    const response = await fetch(url, { ...request, mode: 'cors' });
    const detail = `HTTP ${response.status}`;
    return response.status < 400 ? { state: 'up', detail } : { state: 'error', detail };
  } catch {
    // Unreadable, which a service sending no CORS headers always is.
  }
  if (!signal.aborted) {
    try {
      await fetch(url, { ...request, mode: 'no-cors' });
      return { state: 'up', detail: null };
    } catch {
      // Nothing answered, or CORP refused the opaque read. Indistinguishable.
    }
  }
  return { state: 'down', detail: signal.aborted ? 'Timed out' : 'No reply or blocked' };
}

export class StatusWidget extends Widget {
  static id = 'status';
  static title = 'Service Status';

  static schema = {
    show: {
      type: 'boolean',
      default: true,
      label: 'Show service status',
      visibleWhen: (get, widget) => !widget.gated,
    },
    placement: {
      type: 'select',
      default: 'right',
      label: 'Placement',
      options: [
        { value: 'top', label: 'Top' },
        { value: 'right', label: 'Right' },
        { value: 'bottom', label: 'Bottom' },
        { value: 'left', label: 'Left' },
      ],
      visibleWhen: (get, widget) => widget.editable,
    },
    items: { type: 'value', default: [] },
  };

  constructor(config) {
    super(config);
    /** url -> { state, detail, checkedAt }, mirrored into the local tier. */
    this.states = new Map();
    this.editingIndex = null;
    this.drag = null;
    this.restoring = null;
    /** Whether the host permission is still to be asked for. Set in mount(). */
    this.gated = false;
  }

  /** Editing needs the permission held and the panel on screen. */
  get editable() {
    return !this.gated && this.get('show');
  }

  /** Stored endpoints, filtered down to ones that are safe to fetch and link. */
  items() {
    const stored = this.get('items');
    if (!Array.isArray(stored)) return [];
    return stored
      .map((item) => ({
        name: String(item?.name ?? ''),
        url: safeUrl(item?.url),
        interval: minutes(item?.interval),
      }))
      .filter((item) => item.name && item.url);
  }

  settingsExtra() {
    return `
      <div data-endpoints class="hidden">
        ${Runtime.isExtension() ? '' : WEB_LIMITS}
        <div data-rows class="space-y-2 mb-3"></div>
        <button type="button" data-add class="btn btn-outline btn-sm w-full">Add Endpoint</button>
        <p class="text-xs opacity-70 mt-2">
          Click a name to edit it, drag to reorder - holding first on a touch screen.
          Right-click a tile on the page to check it now.
        </p>
      </div>
      <div data-grant class="hidden">
        <p class="text-xs opacity-70 mb-2">
          Checking a service means asking Chrome for permission to reach it, and Chrome
          grants that for all sites at once. Startboard only ever contacts the endpoints
          you add here.
        </p>
        <button type="button" data-grant-access class="btn btn-outline btn-sm w-full">
          Grant Permission
        </button>
      </div>`;
  }

  mount() {
    this.root.innerHTML = `
      <div data-panel></div>

      <dialog data-dialog class="modal">
        <div class="modal-box">
          <h3 data-dialog-title class="font-bold text-lg mb-4">Add Endpoint</h3>
          <div class="form-control mb-4">
            ${label('Name')}
            <input type="text" data-name class="input input-bordered" required />
          </div>
          <div class="form-control mb-4">
            ${label('URL')}
            <input type="url" data-url class="input input-bordered"
                   placeholder="https://cloud.example" required />
          </div>
          <div class="form-control mb-4">
            ${label('Check every (minutes)')}
            <input type="number" data-interval class="input input-bordered"
                   min="1" max="${MAX_INTERVAL}" step="1" />
          </div>
          <div data-dialog-error class="text-error text-sm mb-2 hidden"></div>
          <div class="modal-action">
            <button type="button" data-save class="btn btn-primary">Save</button>
            <button type="button" data-cancel class="btn">Cancel</button>
          </div>
        </div>
      </dialog>

      <div data-menu class="hidden fixed bg-base-100 shadow-lg rounded-lg border border-base-300 z-50">
        <ul class="menu p-2 w-44">
          <li><button type="button" data-recheck class="text-sm">Check now</button></li>
          <li><button type="button" data-edit class="text-sm">Edit</button></li>
          <li><button type="button" data-delete class="text-sm text-error">Remove</button></li>
        </ul>
      </div>`;

    this.panel = this.root.querySelector('[data-panel]');
    this.dialog = this.root.querySelector('[data-dialog]');
    this.dialogTitle = this.root.querySelector('[data-dialog-title]');
    this.dialogError = this.root.querySelector('[data-dialog-error]');
    this.nameInput = this.root.querySelector('[data-name]');
    this.urlInput = this.root.querySelector('[data-url]');
    this.intervalInput = this.root.querySelector('[data-interval]');
    this.menu = this.root.querySelector('[data-menu]');
    this.rows = this.section.querySelector('[data-rows]');
    this.addButton = this.section.querySelector('[data-add]');
    this.endpoints = this.section.querySelector('[data-endpoints]');
    this.grantBlock = this.section.querySelector('[data-grant]');

    this.addButton.addEventListener('click', () => this.openDialog());
    this.root.querySelector('[data-save]').addEventListener('click', () => this.save());
    this.root.querySelector('[data-cancel]').addEventListener('click', () => this.closeDialog());
    this.root.querySelector('[data-recheck]').addEventListener('click', () => {
      this.hideMenu();
      this.recheck();
    });
    this.root.querySelector('[data-edit]').addEventListener('click', () => {
      this.hideMenu();
      this.openDialog(this.editingIndex);
    });
    this.root.querySelector('[data-delete]').addEventListener('click', () => {
      this.hideMenu();
      this.removeAt(this.editingIndex);
    });

    document.addEventListener('click', (event) => {
      if (!this.menu.contains(event.target)) this.hideMenu();
    });

    this.rows.addEventListener('pointerdown', (event) => this.startDrag(event));
    this.rows.addEventListener('pointermove', (event) => this.onDrag(event));
    this.rows.addEventListener('pointerup', () => this.endDrag(true));
    this.rows.addEventListener('pointercancel', () => this.endDrag(false));
    // Non-passive: only preventDefault here stops a held row scrolling the sidebar.
    this.rows.addEventListener('touchmove', (event) => {
      if (this.drag?.phase === 'sorting') event.preventDefault();
    }, { passive: false });

    this.section.querySelector('[data-grant-access]').addEventListener('click', async () => {
      this.gated = !(await Runtime.requestHostAccess());
      this.refresh();
    });
    // Un-awaited: mount() is on the critical path, and the sidebar starts closed.
    Runtime.needsHostAccess().then((needed) => {
      if (needed === this.gated) return;
      this.gated = needed;
      this.refresh();
    });
  }

  render() {
    const items = this.items();
    this.renderSection(items);
    this.renderPanel(items);
  }

  renderSection(items) {
    const editing = this.editable;
    this.endpoints.classList.toggle('hidden', !editing);
    this.grantBlock.classList.toggle('hidden', !this.gated);
    // Rows would go into a hidden block; flipping either gate renders again.
    if (editing) this.renderRows(items);
  }

  renderPanel(items) {
    this.repeat();

    const layout = LAYOUTS[this.get('placement')] ?? LAYOUTS.right;
    const show = this.get('show');
    this.panel.className = layout.panel;
    this.panel.classList.toggle('hidden', !show);
    if (!show) return;

    this.forget(items);
    this.panel.replaceChildren(...items.map((item, index) => this.tile(item, index, layout)));

    if (items.length === 0) return;
    // Un-awaited: a probe is a network round trip, and app.js reveals the page
    // only once every widget has mounted.
    this.sweep();
    this.repeat(() => this.sweep(), TICK_MS);
  }

  /** Probes the endpoints whose refresh rate has come round. */
  async sweep() {
    if (document.hidden) return;
    const items = this.items();
    this.restoring ??= this.restore(items);
    await this.restoring;

    const now = Date.now();
    const due = items.filter((item) => {
      const entry = this.states.get(item.url);
      if (entry?.state === 'checking') return false;
      return !entry || now - entry.checkedAt >= item.interval * 60_000;
    });
    for (const item of due) this.check(item, items);
  }

  /** Loads the cached results for the endpoints that are still configured. */
  async restore(items) {
    const cached = await this.getLocal(CACHE_KEY);
    if (typeof cached !== 'object' || cached === null) return;
    const live = liveUrls(items);
    for (const [url, entry] of Object.entries(cached)) {
      // A shape an older build wrote has no dot to paint and no time to format,
      // and a probe that started while this read was in flight owns its entry.
      if (!live.has(url) || !STATES[entry?.state] || !Number.isFinite(entry.checkedAt)) continue;
      if (this.states.has(url)) continue;
      this.states.set(url, entry);
      this.paint(url);
    }
  }

  /**
   * Coalesces the writes of probes that settle together. Waiting for the whole
   * sweep instead would lose every result whenever one endpoint hangs, since the
   * deadline outlives the page a new tab gives it.
   */
  remember(items) {
    clearTimeout(this.writing);
    this.writing = setTimeout(() => this.write(items), 0);
  }

  /** Holds only endpoints that still exist, or the cache grows for ever. */
  async write(items) {
    const live = liveUrls(items);
    const settled = [...this.states].filter(
      ([url, entry]) => live.has(url) && entry.state !== 'checking',
    );
    await this.setLocal(CACHE_KEY, Object.fromEntries(settled));
  }

  async check(item, items) {
    this.states.set(item.url, { state: 'checking', detail: null, checkedAt: Date.now() });
    this.paint(item.url);
    const result = await probe(item.url);
    this.states.set(item.url, { ...result, checkedAt: Date.now() });
    this.paint(item.url);
    this.remember(items);
  }

  paint(url) {
    const selector = `[data-endpoint="${CSS.escape(url)}"]`;
    for (const tile of this.panel.querySelectorAll(selector)) this.paintTile(tile);
  }

  /** Takes the element, so a tile can be dressed before it reaches the panel. */
  paintTile(tile) {
    const entry = this.states.get(tile.dataset.endpoint) ?? { state: 'checking' };
    const state = STATES[entry.state];
    const dot = tile.querySelector('[data-dot]');
    dot.className = `w-2.5 h-2.5 rounded-full shrink-0 ${state.dot}`;
    dot.setAttribute('aria-label', state.text);
    const detail = entry.detail ? ` (${entry.detail})` : '';
    const checked = entry.state === 'checking' ? '' : ` · ${at(entry.checkedAt)}`;
    tile.title = `${state.text}${detail}${checked}`;
  }

  tile(item, index, layout) {
    const tile = document.createElement('a');
    tile.className =
      'card bg-base-100/80 shadow-md hover:shadow-lg transition-shadow flex-row items-center ' +
      'gap-2 px-3 py-2';
    tile.href = item.url;
    tile.dataset.endpoint = item.url;

    const dot = document.createElement('span');
    dot.dataset.dot = '';
    dot.setAttribute('role', 'img');

    const name = document.createElement('span');
    name.className = 'text-xs font-medium';
    name.textContent = item.name;

    tile.append(...(layout.dotFirst ? [dot, name] : [name, dot]));
    this.paintTile(tile);
    tile.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.showMenu(event, index);
    });
    return tile;
  }

  renderRows(items) {
    this.rows.replaceChildren(...items.map((item, index) => this.row(item, index)));
    this.addButton.disabled = items.length >= MAX_ENDPOINTS;
  }

  row(item, index) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 rounded-lg bg-base-200 px-2 py-1 cursor-move select-none';
    row.dataset.row = index;

    const grip = document.createElement('span');
    grip.className = 'text-xs opacity-40';
    grip.setAttribute('aria-hidden', 'true');
    grip.textContent = '⠿';

    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'text-sm text-left flex-1 truncate';
    name.textContent = item.name;
    name.title = `${item.url} · every ${item.interval} min`;
    name.addEventListener('click', () => this.openDialog(index));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.remove = '';
    remove.className = 'btn btn-ghost btn-xs btn-circle text-error';
    remove.setAttribute('aria-label', `Remove ${item.name}`);
    remove.textContent = '✕';
    remove.addEventListener('click', () => this.removeAt(index));

    row.append(grip, name, remove);
    return row;
  }

  startDrag(event) {
    const row = event.target.closest('[data-row]');
    if (!row || event.button !== 0 || event.target.closest('[data-remove]')) return;
    // Capturing keeps the moves coming once the pointer leaves the row.
    row.setPointerCapture?.(event.pointerId);
    const held = event.pointerType === 'touch';
    this.drag = { row, y: event.clientY, phase: held ? 'hold' : 'armed', timer: null };
    if (held) this.drag.timer = setTimeout(() => this.sort(), HOLD_MS);
  }

  sort() {
    this.drag.phase = 'sorting';
    this.drag.row.classList.add('ring-2', 'ring-primary');
  }

  onDrag(event) {
    const drag = this.drag;
    if (!drag) return;
    const travelled = Math.abs(event.clientY - drag.y);
    if (drag.phase === 'hold') {
      // Travelling before the hold lands means the finger is scrolling.
      if (travelled > HOLD_SLOP_PX) this.endDrag(false);
      return;
    }
    if (drag.phase === 'armed') {
      if (travelled < DRAG_SLOP_PX) return;
      this.sort();
    }
    this.moveRow(drag.row, event.clientY);
  }

  moveRow(row, y) {
    const rows = [...this.rows.querySelectorAll('[data-row]')];
    const before =
      rows.find((other) => {
        if (other === row) return false;
        const box = other.getBoundingClientRect();
        return y < box.top + box.height / 2;
      }) ?? null;
    if (row.nextElementSibling !== before) this.rows.insertBefore(row, before);
  }

  async endDrag(keep) {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    clearTimeout(drag.timer);
    drag.row.classList.remove('ring-2', 'ring-primary');
    if (drag.phase !== 'sorting') return;
    if (!keep) return this.renderRows(this.items());
    // Each row carries the index it came from, so the rendered order is the
    // new order and nothing has to be tracked during the drag.
    const items = this.items();
    const order = [...this.rows.querySelectorAll('[data-row]')].map((row) => Number(row.dataset.row));
    await this.commit(order.map((index) => items[index]));
  }

  openDialog(index = null) {
    this.editingIndex = index;
    const item = index === null ? null : this.items()[index];
    this.dialogTitle.textContent = item ? 'Edit Endpoint' : 'Add Endpoint';
    this.nameInput.value = item?.name ?? '';
    this.urlInput.value = item?.url ?? '';
    this.intervalInput.value = String(item?.interval ?? DEFAULT_INTERVAL);
    setError(this.dialogError, null);
    this.dialog.showModal();
  }

  closeDialog() {
    this.dialog.close();
    this.editingIndex = null;
  }

  async save() {
    const name = this.nameInput.value.trim();
    // Typing "cloud.example" should work, but "javascript:..." must not - the
    // URL becomes a tile's href as well as a fetch target.
    const url = safeUrl(this.urlInput.value, { assumeHttps: true });
    const minutes = Number(this.intervalInput.value);

    if (!name) return setError(this.dialogError, 'Give the endpoint a name.');
    if (!url) return setError(this.dialogError, 'Enter a valid http(s) address.');
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_INTERVAL) {
      return setError(this.dialogError, `Check every 1 to ${MAX_INTERVAL} minutes.`);
    }

    const items = this.items();
    const item = { name, url, interval: minutes };
    if (this.editingIndex === null) items.push(item);
    else items[this.editingIndex] = item;

    await this.commit(items);
    this.closeDialog();
  }

  async removeAt(index) {
    if (index === null) return;
    const items = this.items();
    items.splice(index, 1);
    await this.commit(items);
  }

  async recheck() {
    const items = this.items();
    const item = this.editingIndex === null ? null : items[this.editingIndex];
    if (!item) return;
    this.states.delete(item.url);
    await this.check(item, items);
  }

  async commit(items) {
    await this.set('items', items.slice(0, MAX_ENDPOINTS));
    this.refresh();
  }

  /** Drops state for endpoints that are gone, so a re-added one probes afresh. */
  forget(items) {
    const live = liveUrls(items);
    for (const url of this.states.keys()) {
      if (!live.has(url)) this.states.delete(url);
    }
  }

  showMenu(event, index) {
    this.editingIndex = index;
    // Anchored by its right edge: the tiles can sit in a corner, so a menu
    // opening rightwards would land off screen.
    this.menu.style.right = `${Math.max(8, window.innerWidth - event.clientX)}px`;
    this.menu.style.top = `${event.clientY}px`;
    this.menu.classList.remove('hidden');
  }

  hideMenu() {
    this.menu.classList.add('hidden');
  }
}

/** The refresh rate in minutes, as stored - an imported file can hold anything. */
function minutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 1) return DEFAULT_INTERVAL;
  return Math.min(Math.round(minutes), MAX_INTERVAL);
}
