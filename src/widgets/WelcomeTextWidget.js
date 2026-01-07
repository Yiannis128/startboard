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
    // Register fields with namespacing (welcomeText.show, welcomeText.text)
    this.registerBooleanField(config, 'showWelcomeText', 'show', true);
    this.registerStringField(config, 'welcomeText', 'text', 'Welcome to StartBoard');
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
      <div class="form-control">
        <label class="label">
          <span class="label-text">Text</span>
        </label>
        <input type="text" id="welcomeTextInput" class="input input-bordered" />
      </div>
    `;
    settingsContainer.appendChild(section);
    return section;
  }

  async init(config) {
    this.textElement = document.getElementById('welcomeText');
    const toggle = document.getElementById('welcomeTextToggle');
    const textInput = document.getElementById('welcomeTextInput');

    // Initialize toggle state
    toggle.checked = config.showWelcomeText;

    // Initialize text input value
    textInput.value = config.welcomeText;

    // Update displayed text
    this.textElement.textContent = config.welcomeText;

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
  }

  show() {
    this.textElement.classList.remove('hidden');
  }

  hide() {
    this.textElement.classList.add('hidden');
  }
}

const welcomeTextWidget = new WelcomeTextWidget();
