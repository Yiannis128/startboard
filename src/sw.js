/**
 * Offline caching for the PWA. Both placeholders are filled by
 * scripts/build-pwa.js, which walks the built output rather than keeping a
 * hand-maintained file list here.
 */

const CACHE_VERSION = '{{VERSION}}';
const CACHE_NAME = `startboard-${CACHE_VERSION.startsWith('{{') ? 'dev' : `v${CACHE_VERSION}`}`;

// The app shell only - see isShell() in the build script. Bulk assets such as
// the ~13MB backdrop library are cached on first use instead of up front.
const PRECACHE = {{ASSETS}};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Third-party requests are left alone: caching the Helium bangs feed here
  // would shadow the widget's own one-week cache and make Refresh Bangs a
  // no-op.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(staleWhileRevalidate(event));
});

async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request);

  if (cached) {
    event.waitUntil(refresh(event.request));
    return cached;
  }

  try {
    return await refresh(event.request);
  } catch {
    if (event.request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function refresh(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}
