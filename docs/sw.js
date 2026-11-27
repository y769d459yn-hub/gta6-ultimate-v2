/* GTA 6 Facile, service worker (version 20261127054828) */
'use strict';
const V = '20261127054828', BASE = '/';
const PAGES = 'lg-pages-' + V, FICHIERS = 'lg-fichiers-' + V, IMAGES = 'lg-images-' + V;
const ESSENTIELS = [BASE, BASE + 'hors-ligne.html', BASE + 'assets/app.css', BASE + 'assets/app.js', BASE + 'favicon.svg', BASE + 'assets/icon-192.png'];
const JAMAIS = /\/(admin|compte)\/|publication\.json|admin-donnees\.json|sw\.js$/;
self.addEventListener('install', (e) => { e.waitUntil(caches.open(PAGES).then((c) => c.addAll(ESSENTIELS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n.startsWith('lg-') && !n.endsWith('-' + V)).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
async function limiter(nom, max) { const c = await caches.open(nom); const k = await c.keys(); for (let i = 0; i < k.length - max; i++) await c.delete(k[i]); }
// toujours demander au serveur si la page a changé (pas de vieille page gardée par le navigateur après une publication) ;
// une page inchangée coûte une simple réponse « 304 », et hors connexion la dernière version reste affichée
async function frais(req) {
  if (req.mode === 'navigate') {
    if (!/(\/|\.html)$/.test(new URL(req.url).pathname)) return fetch(req);
    const r = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
    return r.redirected ? fetch(req) : r;
  }
  return fetch(req, { cache: 'no-cache' });
}
async function reseauDabord(req, nom) {
  try {
    const r = await frais(req);
    if (r.ok && r.type === 'basic') { const c = await caches.open(nom); c.put(req, r.clone()); }
    return r;
  } catch (err) {
    const m = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (m) return m;
    if (req.mode === 'navigate') return caches.match(BASE + 'hors-ligne.html');
    throw err;
  }
}
async function cacheDabord(req) {
  const m = await caches.match(req); if (m) return m;
  const r = await fetch(req);
  if (r.ok && r.type === 'basic') { const c = await caches.open(IMAGES); await c.put(req, r.clone()); limiter(IMAGES, 400); }
  return r;
}
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(BASE) || JAMAIS.test(u.pathname)) return;
  if (/\.(webp|png|jpe?g|svg|gif|avif|woff2?|glb)$/.test(u.pathname)) e.respondWith(cacheDabord(req));
  else e.respondWith(reseauDabord(req, req.mode === 'navigate' ? PAGES : FICHIERS));
});
