document.addEventListener('DOMContentLoaded', async () => {
  // Register widget configs before loading
  welcomeTextWidget.registerConfig(config);
  timeWidget.registerConfig(config);
  shortcutsWidget.registerConfig(config);

  // Load config
  await config.load();

  // Initialize widgets
  await welcomeTextWidget.init(config);
  await timeWidget.init(config);
  await shortcutsWidget.init(config);

  // Settings button - opens Chrome side panel
  const openSettingsBtn = document.getElementById('openSettings');
  openSettingsBtn.addEventListener('click', async () => {
    try {
      // Get the current window
      const currentWindow = await chrome.windows.getCurrent();
      // Open the side panel for this window
      await chrome.sidePanel.open({ windowId: currentWindow.id });
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  });

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

  // Listen for theme changes from the side panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'themeChanged') {
      applyTheme(message.mode);
    }
  });

  // Listen for system theme changes (when mode is 'system')
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (config.displayMode === 'system') {
      applyTheme('system');
    }
  });

  // Listen for storage changes from the side panel
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'sync') {
      // Reload config
      await config.load();

      // Update widgets based on changes
      for (const [key, { oldValue, newValue }] of Object.entries(changes)) {
        // Handle theme changes
        if (key === 'displayMode') {
          applyTheme(newValue);
        }

        // Handle welcome text changes
        if (key === 'welcomeText.show') {
          if (newValue) {
            welcomeTextWidget.show();
          } else {
            welcomeTextWidget.hide();
          }
        }
        if (key === 'welcomeText.text') {
          const textElement = document.getElementById('welcomeText');
          if (textElement) {
            textElement.textContent = newValue;
          }
        }

        // Handle time widget changes
        if (key === 'time.show') {
          if (newValue) {
            timeWidget.show();
          } else {
            timeWidget.hide();
          }
        }

        // Handle shortcuts changes
        if (key === 'shortcuts.show') {
          if (newValue) {
            shortcutsWidget.show();
          } else {
            shortcutsWidget.hide();
          }
        }
        if (key === 'shortcuts') {
          // Re-render shortcuts when they change
          shortcutsWidget.manager.render();
        }
      }
    }
  });
});
