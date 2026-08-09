import { Widget } from '../core/Widget.js';
import { setTheme, isDark, prefersDark } from '../core/theme.js';

const ROLES = ['primary', 'secondary', 'accent'];

const COLORS = [
  { name: 'Blue', light: '#3b82f6', dark: '#60a5fa', lightContent: '#ffffff', darkContent: '#ffffff' },
  { name: 'Purple', light: '#a855f7', dark: '#c084fc', lightContent: '#ffffff', darkContent: '#ffffff' },
  { name: 'Pink', light: '#ec4899', dark: '#f472b6', lightContent: '#ffffff', darkContent: '#ffffff' },
  { name: 'Red', light: '#ef4444', dark: '#f87171', lightContent: '#ffffff', darkContent: '#ffffff' },
  { name: 'Orange', light: '#f97316', dark: '#fb923c', lightContent: '#ffffff', darkContent: '#ffffff' },
  { name: 'Yellow', light: '#eab308', dark: '#fbbf24', lightContent: '#000000', darkContent: '#000000' },
  { name: 'Green', light: '#22c55e', dark: '#4ade80', lightContent: '#ffffff', darkContent: '#000000' },
  { name: 'Teal', light: '#14b8a6', dark: '#2dd4bf', lightContent: '#ffffff', darkContent: '#000000' },
];

const colorField = (label, accent, fallback) => ({
  type: 'choice',
  default: fallback,
  label,
  accent,
  collapsible: true,
  options: COLORS.map((color) => ({ value: color.name, swatch: color.light })),
});

export class ThemeWidget extends Widget {
  static id = 'theme';
  static title = 'Color';

  static schema = {
    mode: {
      type: 'choice',
      default: 'system',
      label: 'Color Mode',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'system', label: 'System' },
      ],
    },
    primaryColor: colorField('Primary Color', 'primary', 'Blue'),
    secondaryColor: colorField('Secondary Color', 'secondary', 'Purple'),
    accentColor: colorField('Accent Color', 'accent', 'Green'),
  };

  mount() {
    prefersDark().addEventListener('change', () => {
      if (this.get('mode') === 'system') this.render();
    });
  }

  render() {
    const mode = this.get('mode');
    // Notifies anything that varies by theme, the backdrop included.
    setTheme(mode === 'system' ? (prefersDark().matches ? 'dark' : 'light') : mode);

    const dark = isDark();
    const style = document.documentElement.style;
    for (const role of ROLES) {
      const color = COLORS.find((c) => c.name === this.get(`${role}Color`));
      if (!color) continue;
      style.setProperty(`--color-${role}`, dark ? color.dark : color.light);
      style.setProperty(`--color-${role}-content`, dark ? color.darkContent : color.lightContent);
    }
  }
}
