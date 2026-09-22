/*
 * Offline support for the installed web app.
 * - Pages: network first (so users always get the newest version), falling back to the cached app.
 * - Build files, fonts and icons: cached on first use (their file names change with every build).
 * Firebase requests are never touched; Firestore keeps its own offline copy of the diary.
 * Paths are relative to where the app is hosted (e.g. /muhasaba-diary/).
 */
const CACHE = 'muhasaba-v1';
const BASE = self.registration.scope; // e.g. https://example.github.io/muhasaba-diary/
const APP_SHELL = ['', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map((p) => new URL(p, BASE).href);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !req.url.startsWith(BASE)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(BASE, copy));
          return res;
        })
        .catch(() => caches.match(BASE)),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
