document.addEventListener('DOMContentLoaded', async () => {
  const openSidebarBtn = document.getElementById('openSidebar');
  const closeSidebarBtn = document.getElementById('closeSidebar');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const colorModeRadios = document.querySelectorAll('input[name="colorMode"]');
  const shortcutsToggle = document.getElementById('shortcutsToggle');
  const settingsContainer = document.getElementById('settingsContainer');

  // Register widget configs before loading
  welcomeTextWidget.registerConfig(config);
  timeWidget.registerConfig(config);

  // Load config
  await config.load();

  // Create widget settings UI
  welcomeTextWidget.createSettingsUI(settingsContainer);
  timeWidget.createSettingsUI(settingsContainer);

  // Initialize widgets
  await welcomeTextWidget.init(config);
  await timeWidget.init(config);

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
    });
  });

  // Listen for system theme changes (when mode is 'system')
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (config.displayMode === 'system') {
      applyTheme('system');
    }
  });

  // Shortcuts management
  const shortcutsContainer = document.getElementById('shortcutsContainer');
  const shortcutsGrid = document.getElementById('shortcutsGrid');

  // Initialize shortcuts manager
  shortcutsManager.init(shortcutsContainer, shortcutsGrid);

  // Initialize shortcuts toggle
  shortcutsToggle.checked = config.showShortcuts;

  // Show/hide shortcuts based on config
  if (config.showShortcuts) {
    shortcutsManager.show();
  }

  // Listen for shortcuts toggle changes
  shortcutsToggle.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    await config.setShowShortcuts(isChecked);

    if (isChecked) {
      shortcutsManager.show();
    } else {
      shortcutsManager.hide();
    }
  });
});
