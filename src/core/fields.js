import { setError } from './notify.js';

/**
 * Renders and binds settings controls from a widget's schema.
 *
 * A field is `{ type, default, label, ... }`. Every type renders a wrapper
 * tagged `data-field-wrap` and one or more inputs tagged `data-field`, so
 * binding and visibility can find them without per-widget element ids.
 */

// Written out in full because Tailwind only generates classes it finds
// verbatim in the source - a `peer-checked:border-${accent}` template would
// produce nothing.
const ACCENTS = {
  primary: 'peer-checked:border-primary peer-checked:bg-primary/10',
  secondary: 'peer-checked:border-secondary peer-checked:bg-secondary/10',
  accent: 'peer-checked:border-accent peer-checked:bg-accent/10',
};

const COLUMNS = { 1: 'grid-cols-1', 2: 'grid-cols-2' };

const TILE = 'w-full rounded-lg border-2 border-base-300 hover:bg-base-200 transition-colors';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const label = (text) =>
  `<label class="label"><span class="label-text">${escapeHtml(text)}</span></label>`;

/** Fields that hold state but render no control. */
const isHidden = (field) => field.type === 'value';

const RENDERERS = {
  boolean: (key, field) => `
    <label class="flex items-center cursor-pointer mb-4">
      <input type="checkbox" class="toggle toggle-primary" data-field="${key}" />
      <span class="ml-3">${escapeHtml(field.label)}</span>
    </label>`,

  text: (key, field) => `
    ${label(field.label)}
    <input type="text" class="input input-bordered w-full" data-field="${key}"
           placeholder="${escapeHtml(field.placeholder ?? '')}" />
    ${field.help ? `<p class="text-xs opacity-70 mt-1">${escapeHtml(field.help)}</p>` : ''}
    <div class="text-error text-sm mt-1 hidden" data-error="${key}"></div>`,

  select: (key, field) => `
    ${label(field.label)}
    <select class="select select-bordered w-full" data-field="${key}">
      ${field.options
        .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label ?? o.value)}</option>`)
        .join('')}
    </select>`,

  range: (key, field) => `
    <label class="label">
      <span class="label-text">${escapeHtml(field.label)}: <span data-range-value="${key}"></span></span>
    </label>
    <input type="range" class="range range-primary" data-field="${key}"
           min="${field.min}" max="${field.max}" step="${field.step ?? 1}" />
    <div class="w-full flex justify-between text-xs px-2 mt-1">
      ${rangeTicks(field).map((t) => `<span>${escapeHtml(t)}</span>`).join('')}
    </div>`,

  choice: (key, field) => {
    const groups = groupOptions(field.options);
    const body = groups
      .map(([name, options]) => {
        const heading = name ? label(name) : '';
        const grid = `<div class="grid ${COLUMNS[field.columns ?? 1]} gap-2 mb-2">
          ${options.map((o) => tile(key, o, field)).join('')}
        </div>`;
        return heading + grid;
      })
      .join('');
    return (field.collapsible ? '' : label(field.label)) + body;
  },
};

function tile(key, option, field) {
  const accent = ACCENTS[field.accent ?? 'primary'];
  return `
    <label class="cursor-pointer">
      <input type="radio" name="${key}" value="${escapeHtml(option.value)}"
             class="hidden peer" data-field="${key}" />
      <div class="${TILE} ${accent} ${option.image || option.html ? 'p-2' : 'p-3 flex items-center gap-2'}">
        ${tileBody(option)}
      </div>
    </label>`;
}

function tileBody(option) {
  if (option.html) return option.html;
  if (option.image) {
    return `<img src="${escapeHtml(option.image)}" alt="${escapeHtml(option.label ?? '')}"
                 loading="lazy" class="w-full h-16 object-cover rounded" />`;
  }
  const swatch = option.swatch
    ? `<div class="w-6 h-6 rounded-full shrink-0" style="background: ${escapeHtml(option.swatch)}"></div>`
    : '';
  return `${swatch}<span class="text-sm font-medium">${escapeHtml(option.label ?? option.value)}</span>`;
}

function groupOptions(options) {
  const groups = new Map();
  for (const option of options) {
    const name = option.group ?? '';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(option);
  }
  return [...groups];
}

function rangeTicks(field) {
  const format = field.format ?? String;
  const span = field.max - field.min;
  return Array.from({ length: 5 }, (_, i) => format(field.min + (span * i) / 4));
}

/** Wraps a field's control in its layout, or in a collapse if requested. */
export function renderField(key, field, accordionGroup) {
  if (isHidden(field)) return '';
  const inner = RENDERERS[field.type](key, field);

  if (field.collapsible) {
    return `
      <div class="collapse collapse-arrow bg-base-200 mb-3" data-field-wrap="${key}">
        <input type="checkbox" name="${escapeHtml(accordionGroup)}" />
        <div class="collapse-title text-sm font-semibold">${escapeHtml(field.label)}</div>
        <div class="collapse-content"><div class="pt-2">${inner}</div></div>
      </div>`;
  }

  const layout = field.type === 'boolean' ? '' : 'form-control mb-4';
  return `<div class="${layout}" data-field-wrap="${key}">${inner}</div>`;
}

function readControl(field, element) {
  if (field.type === 'boolean') return element.checked;
  return field.type === 'range' ? Number(element.value) : element.value;
}

/** Reflects a stored value back into the rendered control. */
export function writeControl(section, key, field, value) {
  if (isHidden(field)) return;
  const elements = section.querySelectorAll(`[data-field="${CSS.escape(key)}"]`);
  for (const element of elements) {
    if (field.type === 'boolean') element.checked = Boolean(value);
    else if (field.type === 'choice') element.checked = element.value === String(value);
    // Skipping an identical write keeps the caret put while typing.
    else if (element.value !== String(value)) element.value = value;
  }
  if (field.type === 'range') {
    const display = section.querySelector(`[data-range-value="${CSS.escape(key)}"]`);
    if (display) display.textContent = (field.format ?? String)(value);
  }
}

/**
 * Wires a field's control to `commit(key, value)`. Invalid values (per the
 * field's `validate`) show an inline error and are not committed.
 */
export function bindField(section, key, field, commit) {
  if (isHidden(field)) return;
  const elements = section.querySelectorAll(`[data-field="${CSS.escape(key)}"]`);
  const errorElement = section.querySelector(`[data-error="${CSS.escape(key)}"]`);

  const onCommit = (event) => {
    const value = readControl(field, event.target);
    const error = field.validate?.(value) ?? null;
    setError(errorElement, error);
    if (!error) commit(value);
  };

  for (const element of elements) {
    element.addEventListener(field.live ? 'input' : 'change', onCommit);
    if (field.type === 'range') {
      // Track the slider live, but only persist once the drag ends.
      element.addEventListener('input', () => writeControl(section, key, field, element.value));
    }
  }
}

/** Shows or hides fields whose `visibleWhen` predicate depends on other fields. */
export function applyVisibility(section, schema, get) {
  for (const [name, field] of Object.entries(schema)) {
    if (!field.visibleWhen) continue;
    const wrap = section.querySelector(`[data-field-wrap="${CSS.escape(name)}"]`);
    wrap?.classList.toggle('hidden', !field.visibleWhen(get));
  }
}
