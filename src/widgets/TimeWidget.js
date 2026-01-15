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
    // Register time.showSeconds config field
    this.registerBooleanField(config, 'showSeconds', 'showSeconds', true);
    // Register time.use24Hour config field
    this.registerBooleanField(config, 'use24Hour', 'use24Hour', true);
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
      <label class="flex items-center cursor-pointer mb-4">
        <input type="checkbox" id="showSecondsToggle" class="toggle toggle-primary" />
        <span class="ml-3">Show seconds</span>
      </label>
      <label class="flex items-center cursor-pointer mb-4">
        <input type="checkbox" id="use24HourToggle" class="toggle toggle-primary" />
        <span class="ml-3">24-hour clock</span>
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
    const showSecondsToggle = document.getElementById('showSecondsToggle');
    const use24HourToggle = document.getElementById('use24HourToggle');
    const styleSelect = document.getElementById('timeStyle');

    // Store config for later use
    this.config = config;

    // Initialize toggle state
    toggle.checked = config.showTime;
    showSecondsToggle.checked = config.showSeconds;
    use24HourToggle.checked = config.use24Hour;

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

    // Listen for show seconds toggle
    showSecondsToggle.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      await config.setShowSeconds(isChecked);
      // Refresh the display if time is showing
      if (config.showTime) {
        this.currentStyle = null; // Force rebuild
        this.updateTime();
      }
    });

    // Listen for 24-hour toggle
    use24HourToggle.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      await config.setUse24Hour(isChecked);
      // Refresh the display if time is showing
      if (config.showTime) {
        this.currentStyle = null; // Force rebuild
        this.updateTime();
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

  convertTo12Hour(hours) {
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12; // Convert 0 to 12 for midnight
    return { hour12, period };
  }

  createCountdownSpan(id) {
    return `<span id="${id}" style="--value:0; --digits:2;" aria-live="polite" aria-label="0"></span>`;
  }

  createLabelledClock(columnClasses = 'flex flex-col', showSeconds = true, use24Hour = true) {
    const units = [
      { id: 'time-hours', label: 'hours' },
      { id: 'time-minutes', label: 'min' }
    ];

    if (showSeconds) {
      units.push({ id: 'time-seconds', label: 'sec' });
    }

    const periodHtml = use24Hour ? '' : `
      <div class="${columnClasses}">
        <span class="font-mono text-5xl" id="time-period">AM</span>
      </div>
    `;

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
        ${periodHtml}
      </div>
    `;
  }

  buildTimeStructure(style) {
    const showSeconds = this.config ? this.config.showSeconds : true;
    const use24Hour = this.config ? this.config.use24Hour : true;

    if (style === 'Clock') {
      const secondsPart = showSeconds ? `
        :
        ${this.createCountdownSpan('time-seconds')}
      ` : '';

      const periodPart = use24Hour ? '' : ' <span id="time-period">AM</span>';

      this.timeDisplay.innerHTML = `
        <span class="countdown font-mono text-2xl">
          ${this.createCountdownSpan('time-hours')}
          :
          ${this.createCountdownSpan('time-minutes')}${secondsPart}
        </span>${periodPart}
      `;
    } else if (style === 'Clock Labelled') {
      this.timeDisplay.innerHTML = this.createLabelledClock('flex flex-col', showSeconds, use24Hour);
    } else if (style === 'Clock Boxed') {
      this.timeDisplay.innerHTML = this.createLabelledClock('bg-neutral rounded-box text-neutral-content flex flex-col p-2', showSeconds, use24Hour);
    } else {
      const basicFormat = showSeconds ? '00:00:00' : '00:00';
      const periodPart = use24Hour ? '' : ' AM';
      this.timeDisplay.textContent = basicFormat + periodPart;
    }
    this.currentStyle = style;
  }

  updateTimeUnit(id, value) {
    const el = document.getElementById(id);
    if (el) {
      // DaisyUI countdown component uses --value and --digits for display
      el.style.setProperty('--value', String(value));
      // Update aria-label for accessibility with padded value
      el.setAttribute('aria-label', String(value).padStart(2, '0'));
    }
  }

  updateTime() {
    const now = new Date();
    const style = this.config ? this.config.timeStyle : 'Basic';
    const showSeconds = this.config ? this.config.showSeconds : true;
    const use24Hour = this.config ? this.config.use24Hour : true;

    if (style !== this.currentStyle) {
      this.buildTimeStructure(style);
    }

    const hours24 = now.getHours();
    const { hour12, period } = this.convertTo12Hour(hours24);
    const displayHours = use24Hour ? hours24 : hour12;

    if (style !== 'Basic') {
      this.updateTimeUnit('time-hours', displayHours);
      this.updateTimeUnit('time-minutes', now.getMinutes());
      if (showSeconds) {
        this.updateTimeUnit('time-seconds', now.getSeconds());
      }

      // Update AM/PM if in 12-hour mode
      if (!use24Hour) {
        const periodEl = document.getElementById('time-period');
        if (periodEl) {
          periodEl.textContent = period;
        }
      }
    } else {
      const pad = (n) => String(n).padStart(2, '0');
      const timeString = showSeconds
        ? `${pad(displayHours)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
        : `${pad(displayHours)}:${pad(now.getMinutes())}`;
      const periodPart = use24Hour ? '' : ` ${period}`;
      this.timeDisplay.textContent = timeString + periodPart;
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
