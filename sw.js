/* Bible Desk service worker: saves the app, the 3D library, the fonts and every chapter you read, so it works offline. */
const V = 'bible-desk-v8';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL).then(() => c.add('./data/kjv.json').catch(() => {}))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const okToStore = r => r && (r.ok || r.type === 'opaque');
async function put(req, res) { try { const c = await caches.open(V); await c.put(req, res); } catch (e) {} }

// network first (so updates arrive), cache when offline
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (okToStore(res)) put(req, res.clone());
    return res;
  } catch (e) {
    return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
  }
}
// cache first (library, fonts, chapters never change), fill the cache on first use
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (okToStore(res)) put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) {
    e.respondWith(req.mode === 'navigate' || u.pathname.endsWith('.html') || u.pathname.endsWith('sw.js') ? networkFirst(req) : cacheFirst(req));
  } else if (CDN.includes(u.hostname) || u.hostname === 'bible-api.com') {
    e.respondWith(cacheFirst(req).catch(() => Response.error()));
  }
});
