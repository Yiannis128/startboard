import { Widget } from '../core/Widget.js';
import { isDark, onThemeChange } from '../core/theme.js';
import { notify } from '../core/notify.js';

const COLORS = [
  { name: 'Default', light: null, dark: null },
  { name: 'Slate', light: '#f1f5f9', dark: '#1e293b' },
  { name: 'Zinc', light: '#fafafa', dark: '#18181b' },
  { name: 'Stone', light: '#fafaf9', dark: '#292524' },
  { name: 'Warm', light: '#fef3c7', dark: '#451a03' },
  { name: 'Sky', light: '#e0f2fe', dark: '#0c4a6e' },
  { name: 'Sage', light: '#f0fdf4', dark: '#14532d' },
  { name: 'Lavender', light: '#faf5ff', dark: '#3b0764' },
];

const GRADIENTS = [
  { name: 'Ocean', light: ['#e0f2fe', '#dbeafe'], dark: ['#0c4a6e', '#1e3a8a'] },
  { name: 'Sunset', light: ['#fee2e2', '#fef3c7'], dark: ['#7c2d12', '#78350f'] },
  { name: 'Forest', light: ['#d1fae5', '#dbeafe'], dark: ['#064e3b', '#1e3a8a'] },
  { name: 'Lavender', light: ['#fae8ff', '#ede9fe'], dark: ['#581c87', '#4c1d95'] },
  { name: 'Rose', light: ['#ffe4e6', '#fce7f3'], dark: ['#881337', '#831843'] },
  { name: 'Mint', light: ['#d1fae5', '#ecfdf5'], dark: ['#064e3b', '#022c22'] },
  { name: 'Peach', light: ['#ffedd5', '#fef3c7'], dark: ['#7c2d12', '#78350f'] },
  { name: 'Twilight', light: ['#dbeafe', '#e0e7ff'], dark: ['#1e3a8a', '#312e81'] },
];

const TILED = [
  'backdrop/repeat/seamless-pool-water-surface-1699261204xl0.jpg',
  'backdrop/repeat/stone_texture_AGF81.jpg',
  'backdrop/repeat/wood_texture_10ravens.jpeg',
];

const FITTED = [
  'backdrop/pexels-photo-449011.jpeg',
  'backdrop/flower-garden-blue-sky-hokkaido-japan-60628.jpeg',
  'backdrop/ssha-kolorado-gory-plato-ultra-hd-panorama-4k-5k.jpg',
  'backdrop/G9w1XUpWoAAomGc.jpeg',
  'backdrop/G9w1XUqXwAAP4CB.jpeg',
  'backdrop/G9w1XUrXAAEKoX4.jpeg',
  'backdrop/G9w1XUvXUAAQT1B.jpeg',
];

const UPLOAD_TILE = `
  <div class="w-full h-16 rounded bg-base-300 flex items-center justify-center">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
         stroke="currentColor" class="w-8 h-8">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  </div>`;

// `tiled` rides along on each option, so whether the backdrop repeats is
// derived from the chosen image rather than being a separate stored setting
// that can drift out of step with it.
const IMAGES = [
  ...TILED.map((path) => ({ value: path, group: 'Tiled Backgrounds', image: `img/${path}`, tiled: true })),
  { value: 'custom-tiled', group: 'Tiled Backgrounds', html: UPLOAD_TILE, tiled: true, custom: 'customTiled' },
  ...FITTED.map((path) => ({ value: path, group: 'Fitted Backgrounds', image: `img/${path}`, tiled: false })),
  { value: 'custom-fitted', group: 'Fitted Backgrounds', html: UPLOAD_TILE, tiled: false, custom: 'customFitted' },
];

const CUSTOM_IMAGES = IMAGES.filter((option) => option.custom);

const inMode = (mode) => (get) => get('mode') === mode;

export class BackdropWidget extends Widget {
  static id = 'backdrop';
  static title = 'Backdrop';

  static schema = {
    mode: {
      type: 'choice',
      default: 'solid',
      label: 'Backdrop Mode',
      options: [
        { value: 'solid', label: 'Solid' },
        { value: 'gradient', label: 'Gradient' },
        { value: 'image', label: 'Image' },
      ],
    },
    color: {
      type: 'choice',
      default: 'Default',
      label: 'Background Color',
      visibleWhen: inMode('solid'),
      options: COLORS.map((c) => ({ value: c.name, swatch: c.light ?? '#e5e7eb' })),
    },
    gradient: {
      type: 'choice',
      default: 'Ocean',
      label: 'Gradient',
      visibleWhen: inMode('gradient'),
      options: GRADIENTS.map((g) => ({
        value: g.name,
        swatch: `linear-gradient(135deg, ${g.light[0]}, ${g.light[1]})`,
      })),
    },
    angle: {
      type: 'range',
      default: 135,
      label: 'Gradient Angle',
      min: 0,
      max: 360,
      step: 15,
      format: (value) => `${value}°`,
      visibleWhen: inMode('gradient'),
    },
    image: {
      type: 'choice',
      default: '',
      label: 'Image',
      columns: 2,
      visibleWhen: inMode('image'),
      options: IMAGES,
    },
  };

  constructor(config) {
    super(config);
    // value -> data URL, or null once known to be absent. Populated lazily.
    this.uploads = new Map();
  }

  settingsExtra() {
    return CUSTOM_IMAGES.map(
      (option) => `<input type="file" accept="image/*" class="hidden" data-upload="${option.value}" />`,
    ).join('');
  }

  mount() {
    for (const option of CUSTOM_IMAGES) {
      const input = this.section.querySelector(`[data-upload="${option.value}"]`);
      input.addEventListener('change', () => this.acceptUpload(option, input));
    }

    onThemeChange(() => this.render());
  }

  render() {
    const mode = this.get('mode');
    if (mode === 'solid') this.paintColor();
    else if (mode === 'gradient') this.paintGradient();
    else if (mode === 'image') this.paintImage();
    else paint({});
  }

  onChange(field, value) {
    // Picking an upload tile means "choose a file", not "apply what's stored".
    if (field !== 'image') return;
    const option = IMAGES.find((o) => o.value === value);
    if (option?.custom) this.section.querySelector(`[data-upload="${value}"]`).click();
  }

  paintColor() {
    const color = COLORS.find((c) => c.name === this.get('color'));
    const value = color && (isDark() ? color.dark : color.light);
    paint(value ? { backgroundColor: value } : {});
  }

  paintGradient() {
    const gradient = GRADIENTS.find((g) => g.name === this.get('gradient'));
    if (!gradient) return paint({});
    const [from, to] = isDark() ? gradient.dark : gradient.light;
    paint({ backgroundImage: `linear-gradient(${this.get('angle')}deg, ${from} 0%, ${to} 100%)` });
  }

  paintImage() {
    const option = IMAGES.find((o) => o.value === this.get('image'));
    if (!option) return paint({});

    let src = `img/${option.value}`;
    if (option.custom) {
      // An upload is a multi-megabyte data URL. Read it only when it is the
      // one actually selected, so the common case costs no storage access.
      if (!this.uploads.has(option.value)) {
        this.uploads.set(option.value, null);
        this.getLocal(option.custom).then((dataUrl) => {
          if (!dataUrl) return;
          this.uploads.set(option.value, dataUrl);
          this.render();
        });
      }
      src = this.uploads.get(option.value);
    }

    if (!src) return paint({});
    paint({
      backgroundImage: cssUrl(src),
      backgroundRepeat: option.tiled ? 'repeat' : 'no-repeat',
      backgroundSize: option.tiled ? 'auto' : 'cover',
      backgroundPosition: option.tiled ? 'top left' : 'center',
    });
  }

  async acceptUpload(option, input) {
    const file = input.files[0];
    input.value = '';
    if (!file?.type.startsWith('image/')) return;

    try {
      const dataUrl = await readDataUrl(file);
      // Uploads are far past the 8KB chrome.storage.sync per-item quota, so
      // they live in local storage and never sync.
      await this.setLocal(option.custom, dataUrl);
      this.uploads.set(option.value, dataUrl);
      this.render();
    } catch (error) {
      console.error('Backdrop upload failed:', error);
      notify('Could not save that image. Try a smaller one.', 'error');
    }
  }
}

const BACKGROUND_PROPERTIES = [
  'backgroundColor',
  'backgroundImage',
  'backgroundSize',
  'backgroundRepeat',
  'backgroundPosition',
];

const cssUrl = (src) => `url("${src.replace(/["\\]/g, '\\$&')}")`;

/** Resets every background property, then applies the ones given. */
function paint(properties) {
  for (const name of BACKGROUND_PROPERTIES) {
    document.body.style[name] = properties[name] ?? '';
  }
}

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
