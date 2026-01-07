class TimeWidget extends StartWidget {
  constructor() {
    super();
    this.timeDisplay = null;
    this.timeInterval = null;
    this.currentStyle = null;
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
    // Register time.style config field
    this.registerStringField(config, 'timeStyle', 'style', 'Basic');
  }

  createSettingsUI(settingsContainer) {
    const section = document.createElement('div');
    section.className = 'mb-6';
    section.innerHTML = `
      <h3 class="text-sm font-semibold mb-3">Time</h3>
      <label class="flex items-center cursor-pointer mb-4">
        <input type="checkbox" id="timeToggle" class="toggle toggle-primary" />
        <span class="ml-3">Show current time</span>
      </label>
      <div class="form-control">
        <label class="label">
          <span class="label-text">Style</span>
        </label>
        <select id="timeStyle" class="select select-bordered w-full">
          <option value="Basic">Basic</option>
          <option value="Clock">Clock</option>
          <option value="Clock Labelled">Clock Labelled</option>
          <option value="Clock Boxed">Clock Boxed</option>
        </select>
      </div>
    `;
    settingsContainer.appendChild(section);
    return section;
  }

  async init(config) {
    this.timeDisplay = document.getElementById('timeDisplay');
    const toggle = document.getElementById('timeToggle');
    const styleSelect = document.getElementById('timeStyle');

    // Store config for later use
    this.config = config;

    // Initialize toggle state
    toggle.checked = config.showTime;

    // Initialize style select
    styleSelect.value = config.timeStyle;

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

    // Listen for style changes
    styleSelect.addEventListener('change', async (e) => {
      const newStyle = e.target.value;
      await config.setTimeStyle(newStyle);
      // Refresh the display if time is showing
      if (config.showTime) {
        this.updateTime();
      }
    });
  }

  createCountdownSpan(id) {
    return `<span id="${id}" style="--value:0;" aria-live="polite" aria-label="0">00</span>`;
  }

  createLabelledClock(columnClasses = 'flex flex-col') {
    const units = [
      { id: 'time-hours', label: 'hours' },
      { id: 'time-minutes', label: 'min' },
      { id: 'time-seconds', label: 'sec' }
    ];

    return `
      <div class="grid auto-cols-max grid-flow-col gap-5 text-center">
        ${units.map(({ id, label }) => `
          <div class="${columnClasses}">
            <span class="countdown font-mono text-5xl">
              ${this.createCountdownSpan(id)}
            </span>
            ${label}
          </div>
        `).join('')}
      </div>
    `;
  }

  buildTimeStructure(style) {
    if (style === 'Clock') {
      this.timeDisplay.innerHTML = `
        <span class="countdown font-mono text-2xl">
          ${this.createCountdownSpan('time-hours')}
          :
          ${this.createCountdownSpan('time-minutes')}
          :
          ${this.createCountdownSpan('time-seconds')}
        </span>
      `;
    } else if (style === 'Clock Labelled') {
      this.timeDisplay.innerHTML = this.createLabelledClock();
    } else if (style === 'Clock Boxed') {
      this.timeDisplay.innerHTML = this.createLabelledClock('bg-neutral rounded-box text-neutral-content flex flex-col p-2');
    } else {
      this.timeDisplay.textContent = '00:00:00';
    }
    this.currentStyle = style;
  }

  updateTimeUnit(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.style.setProperty('--value', value);
      el.setAttribute('aria-label', value);
      el.textContent = String(value).padStart(2, '0');
    }
  }

  updateTime() {
    const now = new Date();
    const style = this.config ? this.config.timeStyle : 'Basic';

    if (style !== this.currentStyle) {
      this.buildTimeStructure(style);
    }

    if (style !== 'Basic') {
      this.updateTimeUnit('time-hours', now.getHours());
      this.updateTimeUnit('time-minutes', now.getMinutes());
      this.updateTimeUnit('time-seconds', now.getSeconds());
    } else {
      const pad = (n) => String(n).padStart(2, '0');
      this.timeDisplay.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
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
