/* V195 — enrichissement visuel des favoris, sans écriture dans le stockage. */
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
      img.loading = 'lazy';
      img.decoding = 'async';
      const old = Array.from(link.children).find(el => el.matches('.mini-ico,.card-ico,.tile-ico,.list-ico,.fav-ico,.row-ico,svg:first-child'));
      link.dataset.favImageDone = '1';
      img.addEventListener('error', () => { img.remove(); if (old) old.hidden = false; link.classList.remove('fav-vehicle-photo'); }, { once: true });
      img.addEventListener('load', () => { if (old) old.hidden = true; }, { once: true });
      link.classList.add('fav-vehicle-photo');
      link.prepend(img);
      img.src = new URL(rel, base).href;
    }
  }
  const observer = new MutationObserver(update);
  observer.observe(list, { childList: true, subtree: true });
  update();
})();
