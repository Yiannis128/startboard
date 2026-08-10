import { createStorage } from './core/storage.js';
import { Config } from './core/config.js';
import { Runtime } from './core/runtime.js';
import { collectDefaults, mountWidget } from './core/Widget.js';
import { notify } from './core/notify.js';
import { WIDGETS } from './widgets/index.js';

const storage = createStorage();
const config = new Config(storage, collectDefaults(WIDGETS));
await config.load();

const widgets = WIDGETS.map((WidgetClass) => new WidgetClass(config));
const containers = {
  settingsContainer: document.getElementById('settings'),
  viewContainer: document.getElementById('view'),
};
for (const widget of widgets) {
  await mountWidget(widget, containers);
}

// Revealed only now, so the page never flashes an unthemed backdrop.
document.body.classList.add('loaded');

setUpSidebar();
setUpConfigTransfer();

document.getElementById('versionDisplay').textContent = `v${Runtime.getVersion()}`;

const additionalSettings = document.getElementById('additionalSettings');
if (Runtime.isExtension()) {
  additionalSettings.addEventListener('click', () => Runtime.openSettings());
} else {
  additionalSettings.classList.add('hidden');
}

window.addEventListener('pagehide', () => {
  for (const widget of widgets) widget.destroy();
});

function setUpSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');

  const setOpen = (open) => {
    sidebar.classList.toggle('translate-x-full', !open);
    overlay.classList.toggle('hidden', !open);
  };

  document.getElementById('openSidebar').addEventListener('click', () => setOpen(true));
  document.getElementById('closeSidebar').addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

function setUpConfigTransfer() {
  document.getElementById('exportConfig').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(config.export(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `startboard-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  const input = document.getElementById('importConfig');
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      await config.import(JSON.parse(await file.text()));
      location.reload();
    } catch (error) {
      console.error('Failed to import config:', error);
      notify(`Could not import that file: ${error.message}`, 'error');
    }
  });
}
