class ThemeWidget extends StartWidget {
  constructor() {
    super();

    // Define 8 color pairs (light/dark mode hex values)
    // Format: { name, light: '#hex', dark: '#hex', lightContent: '#hex', darkContent: '#hex' }
    this.colorPairs = [
      {
        name: 'Blue',
        light: '#3b82f6',
        lightContent: '#ffffff',
        dark: '#60a5fa',
        darkContent: '#ffffff'
      },
      {
        name: 'Purple',
        light: '#a855f7',
        lightContent: '#ffffff',
        dark: '#c084fc',
        darkContent: '#ffffff'
      },
      {
        name: 'Pink',
        light: '#ec4899',
        lightContent: '#ffffff',
        dark: '#f472b6',
        darkContent: '#ffffff'
      },
      {
        name: 'Red',
        light: '#ef4444',
        lightContent: '#ffffff',
        dark: '#f87171',
        darkContent: '#ffffff'
      },
      {
        name: 'Orange',
        light: '#f97316',
        lightContent: '#ffffff',
        dark: '#fb923c',
        darkContent: '#ffffff'
      },
      {
        name: 'Yellow',
        light: '#eab308',
        lightContent: '#000000',
        dark: '#fbbf24',
        darkContent: '#000000'
      },
      {
        name: 'Green',
        light: '#22c55e',
        lightContent: '#ffffff',
        dark: '#4ade80',
        darkContent: '#000000'
      },
      {
        name: 'Teal',
        light: '#14b8a6',
        lightContent: '#ffffff',
        dark: '#2dd4bf',
        darkContent: '#000000'
      }
    ];
  }

  getId() {
    return 'theme';
  }

  getName() {
    return 'Theme';
  }

  registerConfig(config) {
    // Register primaryColor field (theme.primaryColor)
    this.registerStringField(config, 'primaryColor', 'primaryColor', 'Blue');
    // Register secondaryColor field (theme.secondaryColor)
    this.registerStringField(config, 'secondaryColor', 'secondaryColor', 'Purple');
    // Register accentColor field (theme.accentColor)
    this.registerStringField(config, 'accentColor', 'accentColor', 'Green');
  }

  createSettingsUI(settingsContainer) {
    const section = document.createElement('div');
    section.className = 'mb-6';

    // Generate primary color option buttons
    const primaryColorOptions = this.colorPairs.map(color => `
      <label class="cursor-pointer">
        <input type="radio" name="primaryColor" value="${color.name}" class="hidden peer" />
        <div class="w-full p-3 rounded-lg border-2 border-base-300 peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-base-200 transition-colors flex items-center gap-2">
          <div class="w-6 h-6 rounded-full" style="background: ${color.light}"></div>
          <span class="text-sm font-medium">${color.name}</span>
        </div>
      </label>
    `).join('');

    // Generate secondary color option buttons
    const secondaryColorOptions = this.colorPairs.map(color => `
      <label class="cursor-pointer">
        <input type="radio" name="secondaryColor" value="${color.name}" class="hidden peer" />
        <div class="w-full p-3 rounded-lg border-2 border-base-300 peer-checked:border-secondary peer-checked:bg-secondary/10 hover:bg-base-200 transition-colors flex items-center gap-2">
          <div class="w-6 h-6 rounded-full" style="background: ${color.light}"></div>
          <span class="text-sm font-medium">${color.name}</span>
        </div>
      </label>
    `).join('');

    // Generate accent color option buttons
    const accentColorOptions = this.colorPairs.map(color => `
      <label class="cursor-pointer">
        <input type="radio" name="accentColor" value="${color.name}" class="hidden peer" />
        <div class="w-full p-3 rounded-lg border-2 border-base-300 peer-checked:border-accent peer-checked:bg-accent/10 hover:bg-base-200 transition-colors flex items-center gap-2">
          <div class="w-6 h-6 rounded-full" style="background: ${color.light}"></div>
          <span class="text-sm font-medium">${color.name}</span>
        </div>
      </label>
    `).join('');

    section.innerHTML = `
      <div class="collapse collapse-arrow bg-base-200 mb-3">
        <input type="radio" name="colorAccordion" />
        <div class="collapse-title text-sm font-semibold">
          Primary Color
        </div>
        <div class="collapse-content">
          <div class="space-y-2 pt-2">
            ${primaryColorOptions}
          </div>
        </div>
      </div>
      <div class="collapse collapse-arrow bg-base-200 mb-3">
        <input type="radio" name="colorAccordion" />
        <div class="collapse-title text-sm font-semibold">
          Secondary Color
        </div>
        <div class="collapse-content">
          <div class="space-y-2 pt-2">
            ${secondaryColorOptions}
          </div>
        </div>
      </div>
      <div class="collapse collapse-arrow bg-base-200">
        <input type="radio" name="colorAccordion" />
        <div class="collapse-title text-sm font-semibold">
          Accent Color
        </div>
        <div class="collapse-content">
          <div class="space-y-2 pt-2">
            ${accentColorOptions}
          </div>
        </div>
      </div>
    `;

    settingsContainer.appendChild(section);
    return section;
  }

  async init(config) {
    const primaryColorRadios = document.querySelectorAll('input[name="primaryColor"]');
    const secondaryColorRadios = document.querySelectorAll('input[name="secondaryColor"]');
    const accentColorRadios = document.querySelectorAll('input[name="accentColor"]');

    // Apply the saved primary, secondary, and accent colors
    this.applyPrimaryColor(config.primaryColor);
    this.applySecondaryColor(config.secondaryColor);
    this.applyAccentColor(config.accentColor);

    // Initialize selected primary color
    primaryColorRadios.forEach(radio => {
      if (radio.value === config.primaryColor) {
        radio.checked = true;
      }
    });

    // Initialize selected secondary color
    secondaryColorRadios.forEach(radio => {
      if (radio.value === config.secondaryColor) {
        radio.checked = true;
      }
    });

    // Initialize selected accent color
    accentColorRadios.forEach(radio => {
      if (radio.value === config.accentColor) {
        radio.checked = true;
      }
    });

    // Listen for primary color changes
    primaryColorRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const newColor = e.target.value;
        await config.setPrimaryColor(newColor);
        this.applyPrimaryColor(newColor);
      });
    });

    // Listen for secondary color changes
    secondaryColorRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const newColor = e.target.value;
        await config.setSecondaryColor(newColor);
        this.applySecondaryColor(newColor);
      });
    });

    // Listen for accent color changes
    accentColorRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const newColor = e.target.value;
        await config.setAccentColor(newColor);
        this.applyAccentColor(newColor);
      });
    });
  }

  applyPrimaryColor(colorName) {
    // Find the color pair
    const colorPair = this.colorPairs.find(c => c.name === colorName);
    if (!colorPair) {
      console.warn(`Color "${colorName}" not found, using default`);
      return;
    }

    // Determine if we're in dark mode
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const primaryColor = isDark ? colorPair.dark : colorPair.light;
    const primaryContent = isDark ? colorPair.darkContent : colorPair.lightContent;

    // Set the CSS variables for DaisyUI primary color (hex format)
    document.documentElement.style.setProperty('--color-primary', primaryColor);
    document.documentElement.style.setProperty('--color-primary-content', primaryContent);
  }

  applySecondaryColor(colorName) {
    // Find the color pair
    const colorPair = this.colorPairs.find(c => c.name === colorName);
    if (!colorPair) {
      console.warn(`Color "${colorName}" not found, using default`);
      return;
    }

    // Determine if we're in dark mode
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const secondaryColor = isDark ? colorPair.dark : colorPair.light;
    const secondaryContent = isDark ? colorPair.darkContent : colorPair.lightContent;

    // Set the CSS variables for DaisyUI secondary color (hex format)
    document.documentElement.style.setProperty('--color-secondary', secondaryColor);
    document.documentElement.style.setProperty('--color-secondary-content', secondaryContent);
  }

  applyAccentColor(colorName) {
    // Find the color pair
    const colorPair = this.colorPairs.find(c => c.name === colorName);
    if (!colorPair) {
      console.warn(`Color "${colorName}" not found, using default`);
      return;
    }

    // Determine if we're in dark mode
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const accentColor = isDark ? colorPair.dark : colorPair.light;
    const accentContent = isDark ? colorPair.darkContent : colorPair.lightContent;

    // Set the CSS variables for DaisyUI accent color (hex format)
    document.documentElement.style.setProperty('--color-accent', accentColor);
    document.documentElement.style.setProperty('--color-accent-content', accentContent);
  }

  show() {
    // Theme widget doesn't have a visible element on the main page
    // It only affects the color scheme
  }

  hide() {
    // Theme widget doesn't have a visible element on the main page
  }
}

const themeWidget = new ThemeWidget();
