document.addEventListener('DOMContentLoaded', async () => {
  const openSidebarBtn = document.getElementById('openSidebar');
  const closeSidebarBtn = document.getElementById('closeSidebar');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const colorModeRadios = document.querySelectorAll('input[name="colorMode"]');
  const timeToggle = document.getElementById('timeToggle');
  const timeDisplay = document.getElementById('timeDisplay');
  const shortcutsToggle = document.getElementById('shortcutsToggle');

  // Load config
  await config.load();

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

  // Time management
  let timeInterval = null;

  function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    timeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
  }

  function showTime() {
    timeDisplay.classList.remove('hidden');
    updateTime();
    timeInterval = setInterval(updateTime, 1000);
  }

  function hideTime() {
    timeDisplay.classList.add('hidden');
    if (timeInterval) {
      clearInterval(timeInterval);
      timeInterval = null;
    }
  }

  // Initialize time display
  timeToggle.checked = config.showTime;
  if (config.showTime) {
    showTime();
  }

  // Listen for time toggle changes
  timeToggle.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    await config.setShowTime(isChecked);
    if (isChecked) {
      showTime();
    } else {
      hideTime();
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
