import { Widget } from '../core/Widget.js';
import { safeUrl } from '../core/url.js';
import { label } from '../core/fields.js';
import { setError } from '../core/notify.js';

const MAX_SHORTCUTS = 16;

const TILE =
  'card bg-base-100 shadow-md hover:shadow-lg transition-shadow p-2 flex flex-col ' +
  'items-center justify-center gap-1 text-center aspect-square w-full';

const DEFAULTS = [
  ['Google', 'https://www.google.com'],
  ['YouTube', 'https://www.youtube.com'],
  ['Facebook', 'https://www.facebook.com'],
  ['Instagram', 'https://www.instagram.com'],
  ['ChatGPT', 'https://chatgpt.com'],
  ['X', 'https://x.com'],
  ['Financial Times', 'https://www.ft.com'],
  ['Reddit', 'https://www.reddit.com'],
  ['GitHub', 'https://github.com/Yiannis128/startboard'],
  ['Yiannis', 'https://yiannis.info'],
].map(([title, url]) => ({ title, url }));

// Only ever called with a URL that safeUrl() has already parsed and normalised.
const faviconUrl = (url) =>
  `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(new URL(url).hostname)}`;

export class ShortcutsWidget extends Widget {
  static id = 'shortcuts';
  static title = 'Shortcuts';

  static schema = {
    show: { type: 'boolean', default: true, label: 'Show shortcuts' },
    items: { type: 'value', default: DEFAULTS },
  };

  constructor(config) {
    super(config);
    this.editingIndex = null;
    this.draggedIndex = null;
  }

  /** Stored entries, filtered down to ones that are actually safe to link to. */
  items() {
    const stored = this.get('items');
    if (!Array.isArray(stored)) return [];
    return stored
      .map((item) => ({ title: String(item?.title ?? ''), url: safeUrl(item?.url) }))
      .filter((item) => item.title && item.url);
  }

  mount() {
    this.root.className = 'w-full max-w-4xl';
    this.root.innerHTML = `
      <div data-grid class="grid grid-cols-3 min-[480px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-6
                            lg:grid-cols-8 gap-2 min-[480px]:gap-3 md:gap-4"></div>

      <dialog data-dialog class="modal">
        <div class="modal-box">
          <h3 data-dialog-title class="font-bold text-lg mb-4">Add Shortcut</h3>
          <div class="form-control mb-4">
            ${label('Title')}
            <input type="text" data-title class="input input-bordered" required />
          </div>
          <div class="form-control mb-4">
            ${label('URL')}
            <input type="url" data-url class="input input-bordered" required />
          </div>
          <div data-dialog-error class="text-error text-sm mb-2 hidden"></div>
          <div class="modal-action">
            <button type="button" data-save class="btn btn-primary">Save</button>
            <button type="button" data-cancel class="btn">Cancel</button>
          </div>
        </div>
      </dialog>

      <div data-menu class="hidden fixed bg-base-100 shadow-lg rounded-lg border border-base-300 z-50">
        <ul class="menu p-2 w-40">
          <li><button type="button" data-edit class="text-sm">Edit</button></li>
          <li><button type="button" data-delete class="text-sm text-error">Delete</button></li>
        </ul>
      </div>`;

    this.grid = this.root.querySelector('[data-grid]');
    this.dialog = this.root.querySelector('[data-dialog]');
    this.dialogTitle = this.root.querySelector('[data-dialog-title]');
    this.dialogError = this.root.querySelector('[data-dialog-error]');
    this.titleInput = this.root.querySelector('[data-title]');
    this.urlInput = this.root.querySelector('[data-url]');
    this.menu = this.root.querySelector('[data-menu]');

    this.root.querySelector('[data-save]').addEventListener('click', () => this.save());
    this.root.querySelector('[data-cancel]').addEventListener('click', () => this.closeDialog());
    this.root.querySelector('[data-edit]').addEventListener('click', () => {
      this.hideMenu();
      this.openDialog(this.editingIndex);
    });
    this.root.querySelector('[data-delete]').addEventListener('click', () => this.remove());

    document.addEventListener('click', (event) => {
      if (!this.menu.contains(event.target)) this.hideMenu();
    });

    this.grid.addEventListener('dragover', (event) => event.preventDefault());
  }

  render() {
    const show = this.get('show');
    this.root.classList.toggle('hidden', !show);
    // Building up to 17 cards, each with listeners and a favicon request, is
    // wasted entirely when the grid is not on screen.
    if (!show) return;

    const items = this.items();
    this.grid.replaceChildren(...items.map((item, index) => this.card(item, index)));

    if (items.length < MAX_SHORTCUTS) {
      this.grid.appendChild(this.addButton());
    }
  }

  card(item, index) {
    const card = document.createElement('a');
    card.className = `${TILE} cursor-move`;
    card.href = item.url;
    card.draggable = true;

    const icon = document.createElement('img');
    icon.src = faviconUrl(item.url);
    icon.alt = '';
    icon.className = 'w-5 h-5 min-[480px]:w-6 min-[480px]:h-6';

    const title = document.createElement('span');
    title.className = 'text-xs font-medium';
    title.textContent = item.title;

    card.append(icon, title);

    card.addEventListener('dragstart', (event) => {
      this.draggedIndex = index;
      card.style.opacity = '0.4';
      event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
      this.draggedIndex = null;
    });
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.reorder(this.draggedIndex, index);
    });
    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.showMenu(event, index);
    });
    return card;
  }

  addButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${TILE} cursor-pointer`;
    button.setAttribute('aria-label', 'Add shortcut');
    button.innerHTML = `
      <svg class="w-5 h-5 min-[480px]:w-6 min-[480px]:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>`;
    button.addEventListener('click', () => this.openDialog());
    return button;
  }

  async reorder(from, to) {
    if (from === null || from === to) return;
    const items = this.items();
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    await this.commit(items);
  }

  openDialog(index = null) {
    this.editingIndex = index;
    const item = index === null ? null : this.items()[index];
    this.dialogTitle.textContent = item ? 'Edit Shortcut' : 'Add Shortcut';
    this.titleInput.value = item?.title ?? '';
    this.urlInput.value = item?.url ?? '';
    setError(this.dialogError, null);
    this.dialog.showModal();
  }

  closeDialog() {
    this.dialog.close();
    this.editingIndex = null;
  }

  async save() {
    const title = this.titleInput.value.trim();
    // Typing "example.com" should work, but "javascript:..." must not - it
    // would end up as a card's href.
    const url = safeUrl(this.urlInput.value, { assumeHttps: true });

    if (!title) return setError(this.dialogError, 'Give the shortcut a title.');
    if (!url) return setError(this.dialogError, 'Enter a valid http(s) address.');

    const items = this.items();
    if (this.editingIndex === null) items.push({ title, url });
    else items[this.editingIndex] = { title, url };

    await this.commit(items);
    this.closeDialog();
  }

  async remove() {
    this.hideMenu();
    if (this.editingIndex === null) return;
    const items = this.items();
    items.splice(this.editingIndex, 1);
    await this.commit(items);
  }

  async commit(items) {
    await this.set('items', items.slice(0, MAX_SHORTCUTS));
    this.refresh();
  }

  showMenu(event, index) {
    this.editingIndex = index;
    this.menu.style.left = `${event.pageX}px`;
    this.menu.style.top = `${event.pageY}px`;
    this.menu.classList.remove('hidden');
  }

  hideMenu() {
    this.menu.classList.add('hidden');
  }
}
