import { Widget } from '../core/Widget.js';

const STYLES = ['Basic', 'Clock', 'Clock Labelled', 'Clock Boxed'];
const LABELS = { hours: 'hours', minutes: 'min', seconds: 'sec' };

const onlyWhenShown = (get) => get('show');
const pad = (value) => String(value).padStart(2, '0');

const countdown = (unit) =>
  `<span data-unit="${unit}" style="--value:0; --digits:2;" aria-live="polite" aria-label="0"></span>`;

export class TimeWidget extends Widget {
  static id = 'time';
  static title = 'Time';

  static schema = {
    show: { type: 'boolean', default: false, label: 'Show current time' },
    showSeconds: { type: 'boolean', default: true, label: 'Show seconds', visibleWhen: onlyWhenShown },
    use24Hour: { type: 'boolean', default: true, label: '24-hour clock', visibleWhen: onlyWhenShown },
    style: {
      type: 'select',
      default: 'Basic',
      label: 'Style',
      options: STYLES.map((value) => ({ value })),
      visibleWhen: onlyWhenShown,
    },
  };

  constructor(config) {
    super(config);
    this.units = {};
    this.periodElement = null;
  }

  mount() {
    this.root.className = 'text-center mb-8';
    this.root.innerHTML = '<div class="text-2xl text-base-content opacity-70 select-none"></div>';
    this.display = this.root.querySelector('div');
  }

  render() {
    this.repeat();

    const show = this.get('show');
    this.root.classList.toggle('hidden', !show);
    if (!show) return;

    // Settings can only change through a render, so the markup is built here
    // and tick() is left as a pure updater.
    this.display.innerHTML = this.buildMarkup(
      this.get('style'),
      this.get('showSeconds'),
      this.get('use24Hour'),
    );
    this.units = Object.fromEntries(
      [...this.display.querySelectorAll('[data-unit]')].map((el) => [el.dataset.unit, el]),
    );
    this.periodElement = this.display.querySelector('[data-period]');

    this.tick();
    this.repeat(() => this.tick(), 1000);
  }

  tick() {
    const use24Hour = this.get('use24Hour');
    const now = new Date();
    const hours = use24Hour ? now.getHours() : now.getHours() % 12 || 12;
    const period = now.getHours() >= 12 ? 'PM' : 'AM';

    if (this.get('style') === 'Basic') {
      const parts = [hours, now.getMinutes(), ...(this.get('showSeconds') ? [now.getSeconds()] : [])];
      const text = parts.map(pad).join(':') + (use24Hour ? '' : ` ${period}`);
      // Rewriting an identical string still drops and rebuilds the text node.
      if (this.display.textContent !== text) this.display.textContent = text;
      return;
    }

    this.setUnit('hours', hours);
    this.setUnit('minutes', now.getMinutes());
    this.setUnit('seconds', now.getSeconds());
    if (this.periodElement) this.periodElement.textContent = period;
  }

  setUnit(name, value) {
    const element = this.units[name];
    if (!element) return;
    // DaisyUI's countdown component animates off these custom properties.
    element.style.setProperty('--value', String(value));
    element.setAttribute('aria-label', pad(value));
  }

  buildMarkup(style, showSeconds, use24Hour) {
    if (style === 'Basic') return '';

    const units = ['hours', 'minutes', ...(showSeconds ? ['seconds'] : [])];

    if (style === 'Clock') {
      const period = use24Hour ? '' : ' <span data-period>AM</span>';
      return `<span class="countdown font-mono text-2xl">
        ${units.map(countdown).join(' : ')}
      </span>${period}`;
    }

    const column =
      style === 'Clock Boxed'
        ? 'bg-neutral rounded-box text-neutral-content flex flex-col p-2'
        : 'flex flex-col';
    const columns = units.map(
      (unit) => `
        <div class="${column}">
          <span class="countdown font-mono text-5xl">${countdown(unit)}</span>
          ${LABELS[unit]}
        </div>`,
    );
    if (!use24Hour) {
      columns.push(`<div class="${column}"><span class="font-mono text-5xl" data-period>AM</span></div>`);
    }
    return `<div class="grid auto-cols-max grid-flow-col gap-5 text-center">${columns.join('')}</div>`;
  }
}
