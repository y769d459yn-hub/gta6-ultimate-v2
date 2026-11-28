/* V197 — enrichissement visuel des favoris, sans écriture dans le stockage. */
(() => {
  'use strict';
  const page = document.querySelector('[data-favs][data-vehicle-images]');
  const list = page?.querySelector('[data-fav-list]');
  if (!list) return;
  let images;
  try { images = JSON.parse(page.dataset.vehicleImages); } catch { return; }
  const base = new URL('../', location.href);
  const prefix = new URL('vehicules/', base).pathname;
  function update() {
    for (const link of list.querySelectorAll('a[href]')) {
      if (link.querySelector('img') || link.dataset.favImageDone) continue;
      const url = new URL(link.href, location.href);
      if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) continue;
      const slug = url.pathname.slice(prefix.length).replace(/\/(?:index\.html)?$/, '');
      if (!Object.prototype.hasOwnProperty.call(images, slug)) continue;
      const rel = images[slug];
      if (!/^(photos|catalogue-mini|catalogue)\/[^/]+$/.test(rel)) continue;
      const img = document.createElement('img');
      img.className = 'fav-vehicle-thumb';
      img.alt = '';
      // A hidden lazy image may never load on Safari.
      img.loading = 'eager';
      img.decoding = 'async';
      const row = link.closest('.card--row');
      const old = row?.querySelector(':scope > .card-ico');
      if (!row || !old) continue;
      link.dataset.favImageDone = '1';
      img.addEventListener('error', () => { img.remove(); if (old) old.hidden = false; row.classList.remove('fav-vehicle-photo'); }, { once: true });
      img.addEventListener('load', () => { old.hidden = true; img.hidden = false; row.classList.add('fav-vehicle-photo'); }, { once: true });
      img.hidden = true;
      old.before(img);
      img.src = new URL(rel, base).href;
    }
  }
  const observer = new MutationObserver(update);
  observer.observe(list, { childList: true, subtree: true });
  update();
})();
