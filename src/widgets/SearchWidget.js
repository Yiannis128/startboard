import { Widget } from '../core/Widget.js';
import { Runtime } from '../core/runtime.js';
import { safeUrl } from '../core/url.js';
import { setError } from '../core/notify.js';

const ENGINES = {
  google: { label: 'Google', url: 'https://www.google.com/search?q=%s' },
  duckduckgo: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  bing: { label: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  brave: { label: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
};

const BANGS_URL = 'https://services.helium.imput.net/bangs.json';
const BANGS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BANGS_CACHE_KEY = 'bangs';

// The extension searches through Chrome, which uses the browser's own default
// engine, so the engine picker only applies to the PWA.
const picksOwnEngine = () => !Runtime.isExtension();

// requestIdleCallback is missing on older Safari, which the PWA still targets.
const whenIdle = (task) =>
  (globalThis.requestIdleCallback ?? ((fn) => setTimeout(fn, 200)))(task);

export class SearchWidget extends Widget {
  static id = 'search';
  static title = 'Search';

  static schema = {
    show: { type: 'boolean', default: true, label: 'Show search bar' },
    engine: {
      type: 'select',
      default: 'google',
      label: 'Search Engine',
      options: [
        ...Object.entries(ENGINES).map(([value, { label }]) => ({ value, label })),
        { value: 'custom', label: 'Custom' },
      ],
      visibleWhen: (get) => get('show') && picksOwnEngine(),
    },
    customUrl: {
      type: 'text',
      default: '',
      label: 'Custom URL',
      placeholder: 'https://example.com/search?q=%s',
      help: 'Use %s where the query goes. Leave empty to fall back to Google.',
      visibleWhen: (get) => get('show') && picksOwnEngine() && get('engine') === 'custom',
      validate: (value) => {
        if (!value) return null;
        if (!value.includes('%s')) return 'URL must contain %s as a placeholder for the query.';
        return safeUrl(value.replace('%s', 'test')) ? null : 'Must be a valid http(s) URL.';
      },
    },
    enableBangs: { type: 'boolean', default: false, label: 'Enable Helium Bangs' },
  };

  constructor(config) {
    super(config);
    this.bangs = null;
  }

  settingsExtra() {
    return `
      <p class="text-xs opacity-70 mb-4 ml-12">Type <code>!x query</code> to search with bangs.</p>
      <div data-bangs-controls class="hidden">
        <button data-refresh-bangs class="btn btn-sm btn-outline w-full mb-2">Refresh Bangs</button>
        <div data-bangs-error class="text-error text-sm hidden"></div>
      </div>`;
  }

  mount() {
    // Starts hidden so the first render is always a transition, which is what
    // decides whether to take focus.
    this.root.className = 'w-full max-w-xl mb-8 hidden';
    this.root.innerHTML = `
      <div class="join w-full">
        <input type="text" data-search-input class="input input-bordered join-item w-full"
               placeholder="Search the web..." autocomplete="off" />
        <button data-search-button class="btn btn-primary join-item" aria-label="Search">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </button>
      </div>
      <div data-search-error class="text-error text-sm mt-2 hidden"></div>`;

    this.input = this.root.querySelector('[data-search-input]');
    this.error = this.root.querySelector('[data-search-error]');
    this.bangsControls = this.section.querySelector('[data-bangs-controls]');
    this.bangsError = this.section.querySelector('[data-bangs-error]');

    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.performSearch();
    });
    this.root.querySelector('[data-search-button]').addEventListener('click', () => this.performSearch());

    const refresh = this.section.querySelector('[data-refresh-bangs]');
    refresh.addEventListener('click', async () => {
      refresh.classList.add('loading');
      await this.loadBangs({ force: true });
      refresh.classList.remove('loading');
    });

    // Deferred, not just un-awaited: the cached feed is megabytes of JSON and
    // parsing it is synchronous, so doing it during mount would stall the
    // first paint of every new tab.
    if (this.get('enableBangs')) whenIdle(() => this.loadBangs());
  }

  render() {
    const show = this.get('show');
    const wasHidden = this.root.classList.contains('hidden');
    this.root.classList.toggle('hidden', !show);
    this.bangsControls.classList.toggle('hidden', !this.get('enableBangs'));
    if (show && wasHidden) this.input.focus();
  }

  async onChange(field, value) {
    if (field === 'enableBangs' && value) await this.loadBangs();
  }

  /** Never rejects - failures surface as an inline message in the sidebar. */
  async loadBangs({ force = false } = {}) {
    setError(this.bangsError, null);
    let cached;
    try {
      cached = await this.getLocal(BANGS_CACHE_KEY);
      if (!force && cached?.data && Date.now() - cached.timestamp < BANGS_TTL_MS) {
        this.bangs = cached.data;
        return;
      }
      this.bangs = await fetchBangs();
      await this.setLocal(BANGS_CACHE_KEY, { data: this.bangs, timestamp: Date.now() });
    } catch (error) {
      // Stale bangs beat no bangs.
      this.bangs = cached?.data ?? null;
      setError(this.bangsError, `Failed to load bangs: ${error.message}`);
    }
  }

  findBang(name) {
    if (!Array.isArray(this.bangs)) return null;
    const wanted = name.toLowerCase();
    return this.bangs.find((entry) => entry.ts?.some((t) => t.toLowerCase() === wanted)) ?? null;
  }

  searchUrl(query) {
    const engine = this.get('engine');
    const template =
      engine === 'custom'
        ? this.get('customUrl') || ENGINES.google.url
        : (ENGINES[engine] ?? ENGINES.google).url;
    const url = template.includes('%s') ? template : ENGINES.google.url;
    return safeUrl(url.replace('%s', encodeURIComponent(query)));
  }

  /** Runs a plain (non-bang) search through Chrome if available, else by URL. */
  runSearch(query) {
    if (Runtime.search(query, (message) => setError(this.error, `Search failed: ${message}`))) return;
    const url = this.searchUrl(query);
    if (url) window.location.href = url;
    else setError(this.error, 'Search engine URL is not valid.');
  }

  performSearch() {
    const query = this.input.value.trim();
    if (!query) return;
    setError(this.error, null);

    if (!this.get('enableBangs') || !this.bangs) {
      this.runSearch(query);
      return;
    }

    const match = query.match(/^!(\S+)(?:\s+(.+))?$/);
    if (!match) {
      this.runSearch(query);
      return;
    }

    const [, name, terms] = match;
    const bang = this.findBang(name);

    if (!terms) {
      setError(
        this.error,
        bang ? `Add a search term after !${name} (e.g. !${name} your search)` : `Unknown bang "!${name}"`,
      );
      return;
    }
    if (!bang?.u) {
      setError(this.error, `Unknown bang "!${name}", searching normally...`);
      this.runSearch(terms);
      return;
    }

    // Bang targets come from a third-party feed, so check the scheme.
    const url = safeUrl(bang.u.replace('{searchTerms}', encodeURIComponent(terms)));
    if (url) window.location.href = url;
    else setError(this.error, `Bang "!${name}" has an unsupported URL.`);
  }
}

async function fetchBangs() {
  const response = await fetch(BANGS_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  // Helium serves JS-flavoured JSON: leading license comments and trailing commas.
  const json = text.replace(/^(\s*\/\/.*\n)+/, '').replace(/,(\s*[\]}])/g, '$1');
  return JSON.parse(json);
}
