/**
 * Stored settings carry a `__version`. On load, `migrate` walks the data one
 * version at a time until it matches SCHEMA_VERSION.
 *
 * To add a migration: bump SCHEMA_VERSION and add a STEPS entry keyed by the
 * version it upgrades *from*. Each step takes the v(n) shape and returns v(n+1).
 * Never edit an existing step - someone's browser is still on that version.
 */

export const SCHEMA_VERSION = 2;

const STEPS = {
  // v1 kept custom backdrop uploads in synced settings as a data URL, which
  // silently blew the 8KB chrome.storage.sync per-item quota. Move them to
  // local storage and leave a sentinel behind.
  1: async (data, storage) => {
    const image = data['backdrop.image'];
    if (typeof image === 'string' && image.startsWith('data:')) {
      const tiled = Boolean(data['backdrop.imageRepeat']);
      await storage.saveLocal(tiled ? 'backdrop.customTiled' : 'backdrop.customFitted', image);
      data['backdrop.image'] = tiled ? 'custom-tiled' : 'custom-fitted';
    }
    // imageRepeat is now derived from the selected image, not stored.
    delete data['backdrop.imageRepeat'];
    // Colour mode moved under the theme widget's namespace.
    if (data.displayMode !== undefined) {
      data['theme.mode'] = data.displayMode;
      delete data.displayMode;
    }
    // Shortcuts moved under the shortcuts widget's namespace.
    if (data.shortcuts !== undefined) {
      data['shortcuts.items'] = data.shortcuts;
      delete data.shortcuts;
    }
    return data;
  },
};

export async function migrate(data, storage, from = data.__version ?? 1) {
  if (from >= SCHEMA_VERSION) return { ...data, __version: SCHEMA_VERSION };
  const step = STEPS[from];
  return migrate(step ? await step(data, storage) : data, storage, from + 1);
}
