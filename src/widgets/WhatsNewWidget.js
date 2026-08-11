import { Widget } from '../core/Widget.js';
import { renderMarkdown } from '../core/markdown.js';
import { escapeHtml } from '../core/html.js';

// Ships next to index.html in both builds. CI fills it with the body of the
// GitHub release; a development build keeps the placeholder that is committed.
const NOTES_FILE = 'whats-new.md';
const RELEASES_URL = 'https://github.com/Yiannis128/startboard/releases';

// The release the notes came from, stamped by the release notes step in
// build.yml. renderMarkdown drops it along with any other comment.
const RELEASE = /^\s*<!--\s*release:\s*(.+?)\s*-->/;

const SPARKLE =
  'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z';

const icon = (size) => `
  <svg class="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${SPARKLE}"></path>
  </svg>`;

export class WhatsNewWidget extends Widget {
  static id = 'whatsNew';
  static title = "What's New";

  static schema = {
    hideOnHome: { type: 'boolean', default: false, label: "Don't show on home screen" },
    // The notes that have been read, identified by themselves rather than by
    // the app version, which the PWA's notes routinely lag behind.
    seen: { type: 'value', default: '' },
  };

  constructor(config) {
    super(config);
    /** The notes as fetched, their release if they name one, and their identity. */
    this.text = null;
    this.release = null;
    this.id = null;
    /** Whether a history entry is ours to unwind. See open(). */
    this.pushed = false;
  }

  settingsExtra() {
    return `
      <button type="button" data-show class="btn btn-outline btn-primary w-full">
        ${icon('w-4 h-4')}
        Show What's New Dialog
      </button>`;
  }

  mount() {
    this.root.innerHTML = `
      <button type="button" data-open aria-label="What's New" title="What's New"
              class="btn btn-secondary fixed bottom-4 right-36 shake">
        ${icon('w-6 h-6')}
      </button>

      <dialog data-dialog class="modal modal-bottom sm:modal-middle">
        <div class="modal-box flex flex-col overflow-hidden p-0 w-full h-full max-w-none max-h-none
                    rounded-none sm:w-3/5 sm:h-3/4 sm:rounded-2xl">
          <div class="flex items-center justify-between gap-2 border-b border-base-300 p-4">
            <h3 class="text-lg font-bold">
              What's New <span data-version class="text-sm font-normal opacity-60"></span>
            </h3>
            <button type="button" data-close class="btn btn-sm btn-circle btn-ghost"
                    aria-label="Close">✕</button>
          </div>
          <div data-notes class="flex-1 overflow-y-auto p-4"></div>
        </div>
        <form method="dialog" class="modal-backdrop"><button aria-label="Close">close</button></form>
      </dialog>`;

    this.button = this.root.querySelector('[data-open]');
    this.dialog = this.root.querySelector('[data-dialog]');
    this.notes = this.root.querySelector('[data-notes]');
    this.version = this.root.querySelector('[data-version]');

    this.button.addEventListener('click', () => this.open());
    this.section.querySelector('[data-show]').addEventListener('click', () => this.open());
    this.root.querySelector('[data-close]').addEventListener('click', () => this.dialog.close());

    // Android's back gesture. Chrome closes a modal dialog on it by itself, so
    // the entry pushed here is unwound on close either way: whichever of the
    // two fires first clears the flag, and the other one becomes a no-op.
    window.addEventListener('popstate', () => {
      if (!this.dialog.open) return;
      this.pushed = false;
      this.dialog.close();
    });
    this.dialog.addEventListener('close', () => {
      if (!this.pushed) return;
      this.pushed = false;
      window.history.back();
    });

    // Un-awaited: mount() is on the critical path, and only the notes know
    // whether they have been read. Skipped when the button they decide is
    // turned off, which leaves the settings button to fetch them on demand.
    if (!this.get('hideOnHome')) this.read().then(() => this.refresh());
  }

  render() {
    const unread = this.id !== null && this.id !== this.get('seen');
    this.button.classList.toggle('hidden', !unread || this.get('hideOnHome'));
  }

  /** Turning the button back on is the other moment the notes become worth reading. */
  async onChange(field, value) {
    if (field === 'hideOnHome' && !value) await this.read();
  }

  async open() {
    if (!this.dialog.open) this.dialog.showModal();
    if (!this.pushed) {
      window.history.pushState({ whatsNew: true }, '');
      this.pushed = true;
    }
    await this.read();
    this.paint();
    if (this.id !== null && this.id !== this.get('seen')) await this.set('seen', this.id);
    this.refresh();
  }

  /**
   * Fetches the notes and works out which notes they are: the release they name
   * if CI stamped one, else a digest of themselves, so notes that were never
   * stamped still announce themselves exactly once.
   */
  async read() {
    if (this.text !== null) return;
    try {
      const response = await fetch(NOTES_FILE);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.text = await response.text();
      this.release = RELEASE.exec(this.text)?.[1] ?? null;
      this.id = this.release ?? digest(this.text);
    } catch (error) {
      this.notes.innerHTML = `
        <p class="mb-4 opacity-70">
          Could not load the release notes: ${escapeHtml(error.message)}
        </p>
        <a href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer"
           class="link link-primary">Read them on GitHub</a>`;
    }
  }

  /** Rendered on open rather than on read: a closed dialog needs no markup. */
  paint() {
    if (this.text === null || this.notes.dataset.notes === this.id) return;
    this.notes.innerHTML = renderMarkdown(this.text);
    this.notes.dataset.notes = this.id;
    this.version.textContent = this.release ?? '';
  }
}

/**
 * FNV-1a. Notes that name no release are still worth telling apart from the
 * next set, and this never has to survive anything but a comparison with itself.
 */
function digest(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16);
}
