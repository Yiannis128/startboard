class WelcomeTextWidget extends StartWidget {
  constructor() {
    super();
    this.textElement = null;
  }

  getId() {
    return 'welcomeText';
  }

  getName() {
    return 'Welcome Text';
  }

  registerConfig(config) {
    // Register fields with namespacing (welcomeText.show, welcomeText.text, welcomeText.font)
    this.registerBooleanField(config, 'showWelcomeText', 'show', true);
    this.registerStringField(config, 'welcomeText', 'text', 'Welcome to StartBoard');
    this.registerStringField(config, 'welcomeTextFont', 'font', 'sans-serif');
  }

  createSettingsUI(settingsContainer) {
    const section = document.createElement('div');
    section.className = 'mb-6';
    section.innerHTML = `
      <h3 class="text-sm font-semibold mb-3">Welcome Text</h3>
      <label class="flex items-center cursor-pointer mb-3">
        <input type="checkbox" id="welcomeTextToggle" class="toggle toggle-primary" />
        <span class="ml-3">Show welcome text</span>
      </label>
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text">Text</span>
        </label>
        <input type="text" id="welcomeTextInput" class="input input-bordered" />
      </div>
      <details class="collapse collapse-arrow bg-base-200">
        <summary class="collapse-title text-sm font-medium">Font Style</summary>
        <div class="collapse-content">
          <div class="grid grid-cols-1 gap-2 pt-2">
            <button class="btn btn-outline font-selector-btn" data-font="sans-serif" style="font-family: sans-serif;">
              Sans Serif
            </button>
            <button class="btn btn-outline font-selector-btn" data-font="serif" style="font-family: serif;">
              Serif
            </button>
            <button class="btn btn-outline font-selector-btn" data-font="monospace" style="font-family: monospace;">
              Monospace
            </button>
          </div>
        </div>
      </details>
    `;
    settingsContainer.appendChild(section);
    return section;
  }

  async init(config) {
    this.textElement = document.getElementById('welcomeText');
    const toggle = document.getElementById('welcomeTextToggle');
    const textInput = document.getElementById('welcomeTextInput');
    const fontButtons = document.querySelectorAll('.font-selector-btn');

    // Initialize toggle state
    toggle.checked = config.showWelcomeText;

    // Initialize text input value
    textInput.value = config.welcomeText;

    // Update displayed text
    this.textElement.textContent = config.welcomeText;

    // Apply font style
    this.textElement.style.fontFamily = config.welcomeTextFont;

    // Highlight selected font button
    this.updateFontButtonSelection(fontButtons, config.welcomeTextFont);

    // Show/hide based on config
    if (config.showWelcomeText) {
      this.show();
    } else {
      this.hide();
    }

    // Listen for toggle changes
    toggle.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      await config.setShowWelcomeText(isChecked);
      if (isChecked) {
        this.show();
      } else {
        this.hide();
      }
    });

    // Listen for text input changes
    textInput.addEventListener('input', async (e) => {
      const newText = e.target.value.trim() || 'Welcome';
      await config.setWelcomeText(newText);
      this.textElement.textContent = newText;
    });

    // Listen for font selection changes
    fontButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const selectedFont = e.target.dataset.font;
        await config.setWelcomeTextFont(selectedFont);
        this.textElement.style.fontFamily = selectedFont;
        this.updateFontButtonSelection(fontButtons, selectedFont);
      });
    });
  }

  updateFontButtonSelection(buttons, selectedFont) {
    buttons.forEach(btn => {
      if (btn.dataset.font === selectedFont) {
        btn.classList.add('btn-active');
      } else {
        btn.classList.remove('btn-active');
      }
    });
  }

  show() {
    this.textElement.classList.remove('hidden');
  }

  hide() {
    this.textElement.classList.add('hidden');
  }
}

const welcomeTextWidget = new WelcomeTextWidget();
