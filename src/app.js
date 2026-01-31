document.addEventListener('DOMContentLoaded', async () => {
  const openSidebarBtn = document.getElementById('openSidebar');
  const closeSidebarBtn = document.getElementById('closeSidebar');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const colorModeRadios = document.querySelectorAll('input[name="colorMode"]');
  const settingsContainer = document.getElementById('settingsContainer');

  // Display version
  const version = RuntimeAdapter.getVersion();
  const versionDisplay = document.getElementById('versionDisplay');
  if (versionDisplay && version) {
    versionDisplay.textContent = `v${version}`;
  }

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

  // Initialize widgets
  await welcomeTextWidget.init(config);
  await timeWidget.init(config);
  await shortcutsWidget.init(config);
  await themeWidget.init(config);
  await backdropWidget.init(config);

  // Sidebar controls
  function openSidebar() {
    sidebar.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
  }

  function closeSidebar() {
    sidebar.classList.add('translate-x-full');
    overlay.classList.add('hidden');
  }

  openSidebarBtn.addEventListener('click', openSidebar);
  closeSidebarBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

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
    // Reapply backdrop based on mode
    if (config.backdropMode === 'solid') {
      backdropWidget.applyBackgroundColor(config.backdropColor);
    } else if (config.backdropMode === 'gradient') {
      backdropWidget.applyGradient(config.backdropGradient, config.backdropAngle);
    } else if (config.backdropMode === 'image') {
      backdropWidget.applyBackgroundImage(config.backdropImage, config.backdropImageRepeat);
    }
  }

  // Initialize theme
  const currentMode = config.displayMode;
  applyTheme(currentMode);

  // Show the page now that backdrop and theme are applied
  document.body.classList.add('loaded');

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
    });
  });

  // Listen for system theme changes (when mode is 'system')
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (config.displayMode === 'system') {
      applyTheme('system');
    }
  });

  // Export/Import functionality
  const exportBtn = document.getElementById('exportConfig');
  const importInput = document.getElementById('importConfig');
  const additionalSettingsBtn = document.getElementById('additionalSettings');

  exportBtn.addEventListener('click', () => {
    // Serialize config data to JSON
    const configData = JSON.stringify(config.export(), null, 2);

    // Create blob and download link
    const blob = new Blob([configData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `startboard-config-${new Date().toISOString().split('T')[0]}.json`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Read file content
      const text = await file.text();
      const importedData = JSON.parse(text);

      // Update storage with imported data
      await config.importAll(importedData);

      // Reload the page to apply new configuration
      location.reload();
    } catch (error) {
      console.error('Failed to import config:', error);
      alert('Failed to import configuration. Please check that the file is valid JSON.');
    }

    // Reset file input
    e.target.value = '';
  });

  // Additional Settings button (only available in extension)
  if (RuntimeAdapter.isExtension()) {
    additionalSettingsBtn.addEventListener('click', () => {
      RuntimeAdapter.openSettings();
    });
  } else {
    additionalSettingsBtn.style.display = 'none';
  }
});
