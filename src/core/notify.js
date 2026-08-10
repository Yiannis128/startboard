const TIMEOUT_MS = 6000;

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast toast-top toast-center z-[100]';
    document.body.appendChild(container);
  }
  return container;
}

/** Fills an inline error slot, hiding it when there is no message. */
export function setError(element, message) {
  if (!element) return;
  element.textContent = message ?? '';
  element.classList.toggle('hidden', !message);
}

/** @param {'info'|'error'} level */
export function notify(message, level = 'info') {
  const toast = document.createElement('div');
  toast.className = `alert ${level === 'error' ? 'alert-error' : 'alert-info'}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  ensureContainer().appendChild(toast);
  setTimeout(() => toast.remove(), TIMEOUT_MS);
}
