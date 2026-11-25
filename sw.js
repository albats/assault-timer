/*
 * Service worker: guarda la app en caché para que funcione sin conexión.
 * Al publicar cambios, sube el número de CACHE para que los móviles
 * descarguen la versión nueva.
 */
const CACHE = 'ring-timer-v1.2.0';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/sequence.js',
  './js/i18n.js',
  './js/audio.js',
  './js/colors.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión.
// "no-cache" obliga a preguntar al servidor si hay versión nueva, para no
// mezclar archivos nuevos con otros antiguos guardados por el navegador.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const request = sameOrigin ? new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' }) : event.request;
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
