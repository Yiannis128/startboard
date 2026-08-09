import { renderField, writeControl, bindField, applyVisibility } from './fields.js';
import { notify } from './notify.js';

/**
 * Base class for start page widgets.
 *
 * A widget declares a static `schema` of settings fields; the framework
 * renders the sidebar controls, persists changes, and calls `render()`
 * afterwards. Subclasses only write the parts that are actually specific
 * to them: the page markup in `mount()` and how it reacts in `render()`.
 *
 *   static id      config namespace and DOM id, e.g. 'time'
 *   static title   sidebar heading
 *   static schema  { fieldName: { type, default, label, ... } }
 *
 * See src/core/fields.js for the available field types.
 */
export class Widget {
  static id = '';
  static title = '';
  static schema = {};

  constructor(config) {
    this.config = config;
    /** The widget's settings section in the sidebar. Scope queries to it. */
    this.section = null;
    /** The widget's container on the page. Empty for settings-only widgets. */
    this.root = null;
  }

  get(name) {
    return this.config.get(`${this.constructor.id}.${name}`);
  }

  set(name, value) {
    return this.config.set(`${this.constructor.id}.${name}`, value);
  }

  /** For data too large to sync, such as uploaded images or cached feeds. */
  getLocal(name) {
    return this.config.loadLocal(`${this.constructor.id}.${name}`);
  }

  setLocal(name, value) {
    return this.config.saveLocal(`${this.constructor.id}.${name}`, value);
  }

  /** Extra settings markup, appended after the schema-driven fields. */
  settingsExtra() {
    return '';
  }

  /** One-time setup. Populate `this.root` and wire `this.section` extras here. */
  mount() {}

  /** Called once after mount, then after every settings change. */
  render() {}

  /** Side effects that need to know which field changed. */
  onChange() {}

  /** Release timers and listeners. */
  destroy() {}
}

/** Every default in the app, keyed the way Config stores them. */
export function collectDefaults(widgetClasses) {
  return Object.fromEntries(
    widgetClasses.flatMap((W) =>
      Object.entries(W.schema).map(([name, field]) => [`${W.id}.${name}`, field.default]),
    ),
  );
}

function renderSettings(WidgetClass) {
  const fields = Object.entries(WidgetClass.schema)
    .map(([name, field]) => renderField(name, field, `${WidgetClass.id}Accordion`))
    .join('');
  return `<h3 class="text-sm font-semibold mb-3">${WidgetClass.title}</h3>${fields}`;
}

/**
 * Builds a widget's sidebar section and page container, binds its controls,
 * then hands control to the widget.
 */
export async function mountWidget(widget, { settingsContainer, viewContainer }) {
  const WidgetClass = widget.constructor;
  const schema = WidgetClass.schema;

  const section = document.createElement('section');
  section.className = 'mb-6';
  section.dataset.widget = WidgetClass.id;
  section.innerHTML = renderSettings(WidgetClass) + widget.settingsExtra();
  settingsContainer.appendChild(section);
  widget.section = section;

  const root = document.createElement('div');
  root.dataset.widgetRoot = WidgetClass.id;
  viewContainer.appendChild(root);
  widget.root = root;

  const get = (name) => widget.get(name);
  const refresh = () => {
    applyVisibility(section, schema, get);
    widget.render();
  };

  for (const [name, field] of Object.entries(schema)) {
    writeControl(section, name, field, widget.get(name));
    bindField(section, name, field, async (value) => {
      try {
        await widget.set(name, value);
        await widget.onChange(name, value);
        refresh();
      } catch (error) {
        console.error(`${WidgetClass.id}.${name} failed:`, error);
        notify(`Could not save ${WidgetClass.title} settings.`, 'error');
      }
    });
  }

  await widget.mount();
  refresh();
}
