class SearchWidget extends StartWidget {
  static ENGINES = {
    google: 'https://www.google.com/search?q=%s',
    duckduckgo: 'https://duckduckgo.com/?q=%s',
    bing: 'https://www.bing.com/search?q=%s',
    brave: 'https://search.brave.com/search?q=%s'
  };

  static ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  static BANGS_URL = 'https://services.helium.imput.net/bangs.json';

  constructor() {
    super();
    this.searchContainer = null;
    this.searchInput = null;
    this.searchButton = null;
    this.searchError = null;
    this.bangsData = null;
  }

  getId() {
    return 'search';
  }

  getName() {
    return 'Search';
  }

  registerConfig(config) {
    this.registerBooleanField(config, 'showSearch', 'show', true);
    this.registerStringField(config, 'searchEngine', 'engine', 'google');
    this.registerStringField(config, 'searchCustomUrl', 'customUrl', '');
    this.registerBooleanField(config, 'searchEnableBangs', 'enableBangs', false);
    // Note: bangs data is stored in local storage via storageAdapter.saveLocal('bangs')
    // to avoid Chrome sync storage quota limits
  }

  createSettingsUI(settingsContainer) {
    const section = document.createElement('div');
    section.className = 'mb-6';
    section.innerHTML = `
      <h3 class="text-sm font-semibold mb-3">Search</h3>
      <label class="flex items-center cursor-pointer mb-4">
        <input type="checkbox" id="searchToggle" class="toggle toggle-primary" />
        <span class="ml-3">Show search bar</span>
      </label>
      <div id="engineSelectionSection">
        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text">Search Engine</span>
          </label>
          <select id="searchEngineSelect" class="select select-bordered w-full">
            <option value="google">Google</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="bing">Bing</option>
            <option value="brave">Brave Search</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div id="customUrlContainer" class="form-control mb-4 hidden">
          <label class="label">
            <span class="label-text">Custom URL</span>
          </label>
          <input type="text" id="searchCustomUrlInput" class="input input-bordered w-full" placeholder="Use %s for query" />
          <div id="customUrlError" class="text-error text-sm mt-1 hidden"></div>
        </div>
      </div>
      <label class="flex items-center cursor-pointer mb-2">
        <input type="checkbox" id="bangsToggle" class="toggle toggle-primary" />
        <span class="ml-3">Enable Helium Bangs</span>
      </label>
      <p class="text-xs opacity-70 mb-4 ml-12">Type !x query to search with bangs</p>
      <div id="bangsControls" class="hidden">
        <button id="refreshBangsBtn" class="btn btn-sm btn-outline w-full mb-2">Refresh Bangs</button>
        <div id="bangsError" class="text-error text-sm hidden"></div>
      </div>
    `;
    settingsContainer.appendChild(section);
    return section;
  }

  updateCustomUrlVisibility(engine, customUrlContainer) {
    if (engine === 'custom') {
      customUrlContainer.classList.remove('hidden');
    } else {
      customUrlContainer.classList.add('hidden');
    }
  }

  validateCustomUrl(url, errorElement, isCustomEngine = true) {
    errorElement.classList.add('hidden');

    if (!url && isCustomEngine) {
      errorElement.textContent = 'No custom URL set - will use Google as fallback';
      errorElement.classList.remove('hidden');
      return true; // Allow empty, but warn
    }

    if (!url) return true;

    if (!url.includes('%s')) {
      errorElement.textContent = 'URL must contain %s as placeholder for search query';
      errorElement.classList.remove('hidden');
      return false;
    }

    try {
      new URL(url.replace('%s', 'test'));
      return true;
    } catch {
      errorElement.textContent = 'Invalid URL format';
      errorElement.classList.remove('hidden');
      return false;
    }
  }

  async loadBangsWithErrorDisplay(bangsError) {
    bangsError.classList.add('hidden');
    try {
      await this.loadBangs();
    } catch (err) {
      bangsError.textContent = 'Failed to load bangs: ' + err.message;
      bangsError.classList.remove('hidden');
    }
  }

  async init(config) {
    this.config = config;
    this.searchContainer = document.getElementById('searchContainer');
    this.searchInput = document.getElementById('searchInput');
    this.searchButton = document.getElementById('searchButton');
    this.searchError = document.getElementById('searchError');

    // Settings elements
    const toggle = document.getElementById('searchToggle');
    const engineSelect = document.getElementById('searchEngineSelect');
    const engineSelectionSection = document.getElementById('engineSelectionSection');
    const customUrlContainer = document.getElementById('customUrlContainer');
    const customUrlInput = document.getElementById('searchCustomUrlInput');
    const customUrlError = document.getElementById('customUrlError');
    const bangsToggle = document.getElementById('bangsToggle');
    const bangsControls = document.getElementById('bangsControls');
    const refreshBangsBtn = document.getElementById('refreshBangsBtn');
    const bangsError = document.getElementById('bangsError');

    // Hide engine selection in Chrome extension mode - the extension uses Chrome's
    // Search API which respects the user's default search engine from browser settings
    if (RuntimeAdapter.isExtension()) {
      engineSelectionSection.classList.add('hidden');
    }

    // Initialize states
    toggle.checked = config.showSearch;
    engineSelect.value = config.searchEngine;
    customUrlInput.value = config.searchCustomUrl;
    bangsToggle.checked = config.searchEnableBangs;

    // Show/hide custom URL field and validate
    this.updateCustomUrlVisibility(config.searchEngine, customUrlContainer);
    if (config.searchEngine === 'custom') {
      this.validateCustomUrl(config.searchCustomUrl, customUrlError, true);
    }

    // Show/hide bangs controls
    if (config.searchEnableBangs) {
      bangsControls.classList.remove('hidden');
      await this.loadBangsWithErrorDisplay(bangsError);
    }

    // Show/hide based on config
    if (config.showSearch) {
      this.show();
    } else {
      this.hide();
    }

    // Toggle listener
    toggle.addEventListener('change', async (e) => {
      await config.setShowSearch(e.target.checked);
      if (e.target.checked) {
        this.show();
      } else {
        this.hide();
      }
    });

    // Engine select listener
    engineSelect.addEventListener('change', async (e) => {
      const engine = e.target.value;
      await config.setSearchEngine(engine);
      this.updateCustomUrlVisibility(engine, customUrlContainer);
      if (engine === 'custom') {
        this.validateCustomUrl(config.searchCustomUrl, customUrlError, true);
      } else {
        customUrlError.classList.add('hidden');
      }
    });

    // Custom URL listener
    customUrlInput.addEventListener('change', async (e) => {
      const url = e.target.value;
      this.validateCustomUrl(url, customUrlError);
      await config.setSearchCustomUrl(url);
    });

    // Bangs toggle listener
    bangsToggle.addEventListener('change', async (e) => {
      await config.setSearchEnableBangs(e.target.checked);
      if (e.target.checked) {
        bangsControls.classList.remove('hidden');
        await this.loadBangsWithErrorDisplay(bangsError);
      } else {
        bangsControls.classList.add('hidden');
      }
    });

    // Refresh bangs button
    refreshBangsBtn.addEventListener('click', async () => {
      refreshBangsBtn.classList.add('loading');
      bangsError.classList.add('hidden');
      try {
        await this.fetchBangs();
      } catch (err) {
        bangsError.textContent = 'Failed to refresh bangs: ' + err.message;
        bangsError.classList.remove('hidden');
      }
      refreshBangsBtn.classList.remove('loading');
    });

    // Search input listener (Enter key)
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });

    // Search button listener
    this.searchButton.addEventListener('click', () => {
      this.performSearch();
    });
  }

  async loadBangs() {
    const cached = await storageAdapter.loadLocal('bangs');
    const now = Date.now();

    if (cached && cached.data && cached.timestamp && (now - cached.timestamp < SearchWidget.ONE_WEEK_MS)) {
      this.bangsData = cached.data;
      return;
    }

    await this.fetchBangs();
  }

  async fetchBangs() {
    try {
      const response = await fetch(SearchWidget.BANGS_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      let text = await response.text();
      // Strip leading JavaScript comments (Helium bangs.json has license comments)
      text = text.replace(/^(\s*\/\/.*\n)+/, '');
      // Strip trailing commas (invalid in JSON but valid in JavaScript)
      text = text.replace(/,(\s*[\]\}])/g, '$1');
      const data = JSON.parse(text);
      this.bangsData = data;

      // Cache bangs data in local storage (not synced, avoids quota issues)
      await storageAdapter.saveLocal('bangs', { data, timestamp: Date.now() });
    } catch (err) {
      // Keep old cached data if available
      const cached = await storageAdapter.loadLocal('bangs');
      if (cached && cached.data) {
        this.bangsData = cached.data;
      } else {
        this.bangsData = null;
      }
      throw err;
    }
  }

  findBang(bangName) {
    if (!this.bangsData || !Array.isArray(this.bangsData)) {
      return null;
    }

    const lowerBang = bangName.toLowerCase();
    for (const entry of this.bangsData) {
      if (entry.ts && Array.isArray(entry.ts)) {
        for (const trigger of entry.ts) {
          if (trigger.toLowerCase() === lowerBang) {
            return entry;
          }
        }
      }
    }
    return null;
  }

  getSearchUrl(query) {
    const engine = this.config.searchEngine;

    if (engine === 'custom') {
      const customUrl = this.config.searchCustomUrl;
      if (!customUrl || !customUrl.includes('%s')) {
        // Fallback to Google
        return SearchWidget.ENGINES.google.replace('%s', encodeURIComponent(query));
      }
      return customUrl.replace('%s', encodeURIComponent(query));
    }

    const template = SearchWidget.ENGINES[engine] || SearchWidget.ENGINES.google;
    return template.replace('%s', encodeURIComponent(query));
  }

  executeSearch(query) {
    // For extension: use Chrome Search API (respects user's default search engine)
    const used = RuntimeAdapter.search(query, (errorMessage) => {
      this.searchError.textContent = 'Search failed: ' + errorMessage;
      this.searchError.classList.remove('hidden');
    });

    if (used) {
      return;
    }

    // For PWA: use the configured search engine URL
    const url = this.getSearchUrl(query);
    window.location.href = url;
  }

  performSearch() {
    const query = this.searchInput.value.trim();
    if (!query) return;

    this.searchError.classList.add('hidden');

    try {
      // Check for bang pattern: !bangname query OR just !bangname
      const bangWithQuery = query.match(/^!(\S+)\s+(.+)$/);
      const bangOnly = query.match(/^!(\S+)$/);

      if (this.config.searchEnableBangs && this.bangsData) {
        if (bangWithQuery) {
          const bangName = bangWithQuery[1];
          const searchQuery = bangWithQuery[2];
          const bang = this.findBang(bangName);

          if (bang && bang.u) {
            // Helium uses {searchTerms} placeholder
            const url = bang.u.replace('{searchTerms}', encodeURIComponent(searchQuery));
            window.location.href = url;
            return;
          } else {
            // Unknown bang - show warning and search with just the query (without bang prefix)
            this.searchError.textContent = `Unknown bang "!${bangName}", searching normally...`;
            this.searchError.classList.remove('hidden');
            this.executeSearch(searchQuery);
            return;
          }
        } else if (bangOnly) {
          // Bang without query - show guidance
          const bangName = bangOnly[1];
          const bang = this.findBang(bangName);
          if (bang) {
            this.searchError.textContent = `Add a search term after !${bangName} (e.g., !${bangName} your search)`;
          } else {
            this.searchError.textContent = `Unknown bang "!${bangName}"`;
          }
          this.searchError.classList.remove('hidden');
          return;
        }
      }

      // Normal search
      this.executeSearch(query);
    } catch (err) {
      this.searchError.textContent = 'Search failed: ' + err.message;
      this.searchError.classList.remove('hidden');
    }
  }

  show() {
    this.searchContainer.classList.remove('hidden');
    this.searchInput.focus();
  }

  hide() {
    this.searchContainer.classList.add('hidden');
  }
}

const searchWidget = new SearchWidget();
