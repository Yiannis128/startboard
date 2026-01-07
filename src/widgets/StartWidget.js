/**
 * Base class for all start page widgets.
 *
 * Widgets are modular components that can be toggled on/off and configured
 * through the settings sidebar. Each widget is responsible for:
 * 1. Registering its configuration fields in the Config class
 * 2. Creating its settings UI in the sidebar
 * 3. Initializing and managing its display on the main page
 *
 * Subclasses should implement all abstract methods.
 */
class StartWidget {
  constructor() {
    this.enabled = false;
  }

  /**
   * Get the unique identifier for this widget.
   * Used as the config key namespace and for DOM element IDs.
   *
   * @returns {string} Widget identifier (e.g., 'time', 'shortcuts')
   */
  getId() {
    throw new Error('Widget must implement getId()');
  }

  /**
   * Get the namespaced config key for a field.
   * Uses pattern: {widgetId}.{fieldName}
   *
   * @param {string} fieldName - The field name (e.g., 'show', 'text')
   * @returns {string} Namespaced key (e.g., 'welcomeText.show')
   */
  getConfigKey(fieldName) {
    return `${this.getId()}.${fieldName}`;
  }

  /**
   * Helper to register a boolean config field with automatic namespacing.
   *
   * @param {Config} config - The global config instance
   * @param {string} propertyName - The property name on config object (e.g., 'showWelcomeText')
   * @param {string} fieldName - The field name for namespacing (e.g., 'show')
   * @param {boolean} defaultValue - Default value
   */
  registerBooleanField(config, propertyName, fieldName, defaultValue) {
    const configKey = this.getConfigKey(fieldName);
    Object.defineProperty(config, propertyName, {
      get: function() { return this._get(configKey, defaultValue); }
    });
    Object.defineProperty(config, `set${propertyName.charAt(0).toUpperCase()}${propertyName.slice(1)}`, {
      value: async function(value) { await this._set(configKey, Boolean(value)); }
    });
  }

  /**
   * Helper to register a string config field with automatic namespacing.
   *
   * @param {Config} config - The global config instance
   * @param {string} propertyName - The property name on config object (e.g., 'welcomeText')
   * @param {string} fieldName - The field name for namespacing (e.g., 'text')
   * @param {string} defaultValue - Default value
   */
  registerStringField(config, propertyName, fieldName, defaultValue) {
    const configKey = this.getConfigKey(fieldName);
    Object.defineProperty(config, propertyName, {
      get: function() { return this._get(configKey, defaultValue); }
    });
    Object.defineProperty(config, `set${propertyName.charAt(0).toUpperCase()}${propertyName.slice(1)}`, {
      value: async function(value) { await this._set(configKey, String(value)); }
    });
  }

  /**
   * Get the display name for this widget.
   * Used in the settings UI.
   *
   * @returns {string} Human-readable name (e.g., 'Time', 'Shortcuts')
   */
  getName() {
    throw new Error('Widget must implement getName()');
  }

  /**
   * Register configuration fields for this widget in the Config class.
   * This method is called once during app initialization before config.load().
   *
   * Widgets should use the helper methods to register namespaced config fields.
   * All config keys are automatically namespaced as: {widgetId}.{fieldName}
   *
   * Example:
   *   registerConfig(config) {
   *     // Creates config.showWelcomeText property backed by 'welcomeText.show' key
   *     this.registerBooleanField(config, 'showWelcomeText', 'show', true);
   *     // Creates config.welcomeText property backed by 'welcomeText.text' key
   *     this.registerStringField(config, 'welcomeText', 'text', 'Welcome');
   *   }
   *
   * Available helper methods:
   * - registerBooleanField(config, propertyName, fieldName, defaultValue)
   * - registerStringField(config, propertyName, fieldName, defaultValue)
   * - getConfigKey(fieldName) - for manual registration
   *
   * @param {Config} config - The global config instance
   */
  registerConfig(config) {
    throw new Error('Widget must implement registerConfig()');
  }

  /**
   * Create and append settings UI elements to the sidebar.
   * This method is called once during app initialization.
   *
   * The settings should typically include a toggle to enable/disable the widget,
   * plus any widget-specific configuration options.
   *
   * @param {HTMLElement} settingsContainer - The sidebar settings container
   * @returns {HTMLElement} The settings section element created for this widget
   */
  createSettingsUI(settingsContainer) {
    throw new Error('Widget must implement createSettingsUI()');
  }

  /**
   * Initialize the widget on the main page.
   * This method is called once during app initialization after config is loaded.
   *
   * Widgets should:
   * - Set up DOM elements for display
   * - Set up event listeners for settings controls
   * - Initialize control states based on config
   * - Check if widget should be shown based on config
   *
   * @param {Config} config - The global config instance
   */
  async init(config) {
    throw new Error('Widget must implement init()');
  }

  /**
   * Show the widget on the main page.
   * Called when the widget is enabled via settings.
   */
  show() {
    throw new Error('Widget must implement show()');
  }

  /**
   * Hide the widget from the main page.
   * Called when the widget is disabled via settings.
   */
  hide() {
    throw new Error('Widget must implement hide()');
  }

  /**
   * Clean up resources when the widget is destroyed.
   * Optional method for widgets that need cleanup (intervals, listeners, etc.).
   */
  destroy() {
    // Default implementation does nothing
    // Widgets can override if they need cleanup
  }
}
