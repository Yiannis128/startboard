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
  backdropWidget.registerConfig(config);

  // Load config
  await config.load();

  // Create widget settings UI
  welcomeTextWidget.createSettingsUI(settingsContainer);
  timeWidget.createSettingsUI(settingsContainer);
  shortcutsWidget.createSettingsUI(settingsContainer);
  themeWidget.createSettingsUI(settingsContainer);
  backdropWidget.createSettingsUI(settingsContainer);

  // Initialize widget settings (sets up event listeners for the settings UI)
  welcomeTextWidget.initSettings(config);
  timeWidget.initSettings(config);
  shortcutsWidget.initSettings(config);
  themeWidget.initSettings(config);
  backdropWidget.initSettings(config);

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

        // Handle backdrop mode changes
        if (changes['backdrop.mode']) {
          const newMode = changes['backdrop.mode'].newValue;
          const modeRadios = document.querySelectorAll('input[name="backdropMode"]');
          modeRadios.forEach(radio => {
            if (radio.value === newMode) {
              radio.checked = true;
            }
          });

          // Update section visibility
          const colorSection = document.getElementById('backdropColorSection');
          const gradientSection = document.getElementById('backdropGradientSection');
          const imageSection = document.getElementById('backdropImageSection');
          if (newMode === 'solid') {
            colorSection.classList.remove('hidden');
            gradientSection.classList.add('hidden');
            imageSection.classList.add('hidden');
          } else if (newMode === 'gradient') {
            colorSection.classList.add('hidden');
            gradientSection.classList.remove('hidden');
            imageSection.classList.add('hidden');
          } else if (newMode === 'image') {
            colorSection.classList.add('hidden');
            gradientSection.classList.add('hidden');
            imageSection.classList.remove('hidden');
          } else {
            colorSection.classList.add('hidden');
            gradientSection.classList.add('hidden');
            imageSection.classList.add('hidden');
          }
        }

        // Handle backdrop color changes
        if (changes['backdrop.color']) {
          const newColor = changes['backdrop.color'].newValue;
          // Don't apply backdrop to sidepanel - only update UI controls

          // Update color radio buttons
          const colorRadios = document.querySelectorAll('input[name="backdropColor"]');
          colorRadios.forEach(radio => {
            if (radio.value === newColor) {
              radio.checked = true;
            }
          });
        }

        // Handle backdrop gradient changes
        if (changes['backdrop.gradient']) {
          const newGradient = changes['backdrop.gradient'].newValue;

          // Update gradient radio buttons
          const gradientRadios = document.querySelectorAll('input[name="backdropGradient"]');
          gradientRadios.forEach(radio => {
            if (radio.value === newGradient) {
              radio.checked = true;
            }
          });
        }

        // Handle backdrop angle changes
        if (changes['backdrop.angle']) {
          const newAngle = changes['backdrop.angle'].newValue;
          const angleSlider = document.getElementById('backdropAngleSlider');
          const angleValue = document.getElementById('backdropAngleValue');

          if (angleSlider) {
            angleSlider.value = newAngle;
          }
          if (angleValue) {
            angleValue.textContent = newAngle;
          }
        }

        // Handle backdrop image changes
        if (changes['backdrop.image']) {
          const newImage = changes['backdrop.image'].newValue;

          // Update image radio buttons
          const imageRadios = document.querySelectorAll('input[name="backdropImage"]');
          imageRadios.forEach(radio => {
            if (radio.value === newImage) {
              radio.checked = true;
            }
          });
        }
      });
    }
  });
});
