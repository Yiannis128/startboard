document.addEventListener('DOMContentLoaded', async () => {
  const colorModeRadios = document.querySelectorAll('input[name="colorMode"]');
  const settingsContainer = document.getElementById('settingsContainer');

  // Chrome Appearance Settings button handler
  document.getElementById('chromeAppearanceBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://settings/appearance' });
  });

  // Register widget configs before loading
  welcomeTextWidget.registerConfig(config);
  timeWidget.registerConfig(config);
  shortcutsWidget.registerConfig(config);
  themeWidget.registerConfig(config);

  // Load config
  await config.load();

  // Create widget settings UI
  welcomeTextWidget.createSettingsUI(settingsContainer);
  timeWidget.createSettingsUI(settingsContainer);
  shortcutsWidget.createSettingsUI(settingsContainer);
  themeWidget.createSettingsUI(settingsContainer);

  // Initialize widget settings (sets up event listeners for the settings UI)
  welcomeTextWidget.initSettings(config);
  timeWidget.initSettings(config);
  shortcutsWidget.initSettings(config);
  themeWidget.initSettings(config);

  // Theme management
  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(mode) {
    const theme = mode === 'system' ? getSystemTheme() : mode;
    document.documentElement.setAttribute('data-theme', theme);
    // Reapply colors when theme changes (colors differ for light/dark)
    themeWidget.applyPrimaryColor(config.primaryColor);
    themeWidget.applySecondaryColor(config.secondaryColor);
    themeWidget.applyAccentColor(config.accentColor);
  }

  // Initialize theme
  const currentMode = config.displayMode;
  applyTheme(currentMode);

  // Set the correct radio button
  colorModeRadios.forEach(radio => {
    if (radio.value === currentMode) {
      radio.checked = true;
    }
  });

  // Listen for color mode changes
  colorModeRadios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      const newMode = e.target.value;
      await config.setDisplayMode(newMode);
      applyTheme(newMode);

      // Notify the main page to update its theme
      chrome.runtime.sendMessage({ type: 'themeChanged', mode: newMode });
    });
  });

  // Listen for system theme changes (when mode is 'system')
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (config.displayMode === 'system') {
      applyTheme('system');
    }
  });

  // Listen for storage changes (when settings change from other places)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      // Reload config and update UI
      config.load().then(() => {
        // Update color mode radio
        colorModeRadios.forEach(radio => {
          if (radio.value === config.displayMode) {
            radio.checked = true;
          }
        });
        applyTheme(config.displayMode);

        // Handle theme color changes
        if (changes['theme.primaryColor']) {
          const newColor = changes['theme.primaryColor'].newValue;
          themeWidget.applyPrimaryColor(newColor);

          // Update color radio buttons
          const colorRadios = document.querySelectorAll('input[name="primaryColor"]');
          colorRadios.forEach(radio => {
            if (radio.value === newColor) {
              radio.checked = true;
            }
          });
        }

        if (changes['theme.secondaryColor']) {
          const newColor = changes['theme.secondaryColor'].newValue;
          themeWidget.applySecondaryColor(newColor);

          // Update color radio buttons
          const colorRadios = document.querySelectorAll('input[name="secondaryColor"]');
          colorRadios.forEach(radio => {
            if (radio.value === newColor) {
              radio.checked = true;
            }
          });
        }

        if (changes['theme.accentColor']) {
          const newColor = changes['theme.accentColor'].newValue;
          themeWidget.applyAccentColor(newColor);

          // Update color radio buttons
          const colorRadios = document.querySelectorAll('input[name="accentColor"]');
          colorRadios.forEach(radio => {
            if (radio.value === newColor) {
              radio.checked = true;
            }
          });
        }
      });
    }
  });
});
