// Service Worker for Ibra Wa Kheit (إبرة وخيط) PWA
const CACHE_NAME = 'ibra-kheit-v2026.1';
const STATIC_ASSETS = [
  '/',
  '/products',
  '/class',
  '/models',
  '/vote',
  '/track',
  '/manifest.json',
  '/khamaiq.com/styles_v=p138.css',
  '/khamaiq.com/colors_and_type_v=p138.css',
  '/khamaiq.com/extras_v=p138.css',
  '/khamaiq.com/enhancements.css',
  '/khamaiq.com/enhancements.js',
  '/khamaiq.com/assets/icons/favicon-32x32_v=p138.png',
  '/khamaiq.com/assets/icons/apple-touch-icon_v=p138.png',
  '/khamaiq.com/qrcode.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW: Some assets failed to precache:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET and API calls (let them go to network directly)
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-First with Cache Fallback strategy
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
            return caches.match('/');
          }
        });
      })
  );
});
