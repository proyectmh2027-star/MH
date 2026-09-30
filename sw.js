/* sw.js — Martha Herrera
   Con internet: siempre trae la versión más reciente del sitio.
   Sin internet: muestra la última versión guardada. */
const CACHE = 'mh-sitio';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === 'navigate';
  const red = nav
    ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'manual' })
    : fetch(req, { cache: 'no-cache' });
  e.respondWith(
    red.then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req.url, copia)); }
      return res;
    }).catch(() =>
      caches.match(req.url, { ignoreSearch: true })
        .then(r => r || (nav ? caches.match(new URL('index.html', self.registration.scope).href) : undefined))
        .then(r => r || Response.error())
    )
  );
});
