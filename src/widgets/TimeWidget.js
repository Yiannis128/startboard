class TimeWidget extends StartWidget {
  constructor() {
    super();
    this.timeDisplay = null;
    this.timeInterval = null;
  }

  getId() {
    return 'time';
  }

  getName() {
    return 'Time';
  }

  registerConfig(config) {
    // Register time.show config field
    this.registerBooleanField(config, 'showTime', 'show', false);
  }

  createSettingsUI(settingsContainer) {
    const section = document.createElement('div');
    section.className = 'mb-6';
    section.innerHTML = `
      <h3 class="text-sm font-semibold mb-3">Time</h3>
      <label class="flex items-center cursor-pointer">
        <input type="checkbox" id="timeToggle" class="toggle toggle-primary" />
        <span class="ml-3">Show current time</span>
      </label>
    `;
    settingsContainer.appendChild(section);
    return section;
  }

  async init(config) {
    this.timeDisplay = document.getElementById('timeDisplay');
    const toggle = document.getElementById('timeToggle');

    // Initialize toggle state
    toggle.checked = config.showTime;

    // Show/hide based on config
    if (config.showTime) {
      this.show();
    } else {
      this.hide();
    }

    // Listen for toggle changes
    toggle.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      await config.setShowTime(isChecked);
      if (isChecked) {
        this.show();
      } else {
        this.hide();
      }
    });
  }

  updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    this.timeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
  }

  show() {
    this.timeDisplay.classList.remove('hidden');
    this.updateTime();
    this.timeInterval = setInterval(() => this.updateTime(), 1000);
  }

  hide() {
    this.timeDisplay.classList.add('hidden');
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }

  destroy() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }
}

const timeWidget = new TimeWidget();
