/**
 * StartBoard Service Worker
 * Provides offline caching for PWA functionality
 */

// Version is injected by build script, fallback for development
const CACHE_VERSION = '{{VERSION}}';
const CACHE_NAME = `startboard-${CACHE_VERSION === '{{VERSION}}' ? 'dev' : 'v' + CACHE_VERSION}`;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './output.css',
  './config.js',
  './app.js',
  './version.js',
  './storage/StorageAdapter.js',
  './runtime/RuntimeAdapter.js',
  './widgets/StartWidget.js',
  './widgets/WelcomeTextWidget.js',
  './widgets/TimeWidget.js',
  './widgets/ShortcutsWidget.js',
  './widgets/ThemeWidget.js',
  './widgets/BackdropWidget.js',
  './img/icon.png',
  './img/icon-192.png',
  './img/icon-512.png',
  './manifest.webmanifest'
];

// Install event - cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached response but also update cache in background
          event.waitUntil(
            fetch(event.request)
              .then((networkResponse) => {
                if (networkResponse.ok) {
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(event.request, networkResponse);
                    });
                }
              })
              .catch(() => {
                // Network failed, but we have cache - that's fine
              })
          );
          return cachedResponse;
        }

        // Not in cache, try network
        return fetch(event.request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed and not in cache
            // For navigation requests, return the cached index.html
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
      })
  );
});
