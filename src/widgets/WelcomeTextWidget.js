import { Widget } from '../core/Widget.js';

const FONTS = ['sans-serif', 'serif', 'monospace'];
const FONT_LABELS = { 'sans-serif': 'Sans Serif', serif: 'Serif', monospace: 'Monospace' };

export class WelcomeTextWidget extends Widget {
  static id = 'welcomeText';
  static title = 'Welcome Text';

  static schema = {
    show: { type: 'boolean', default: true, label: 'Show welcome text' },
    text: {
      type: 'text',
      default: 'Welcome to StartBoard',
      label: 'Text',
      live: true,
      help: 'Leave empty to show "Welcome".',
      visibleWhen: (get) => get('show'),
    },
    font: {
      type: 'choice',
      default: 'sans-serif',
      label: 'Font Style',
      collapsible: true,
      visibleWhen: (get) => get('show'),
      options: FONTS.map((font) => ({
        value: font,
        html: `<span class="text-sm font-medium" style="font-family: ${font}">${FONT_LABELS[font]}</span>`,
      })),
    },
  };

  mount() {
    this.root.className = 'text-center mb-4 max-w-4xl w-full';
    this.root.innerHTML =
      '<h1 class="over-backdrop text-4xl font-bold text-base-content select-none break-words"></h1>';
    this.heading = this.root.querySelector('h1');
  }

  render() {
    this.root.classList.toggle('hidden', !this.get('show'));
    this.heading.textContent = this.get('text') || 'Welcome';
    this.heading.style.fontFamily = this.get('font');
  }
}
