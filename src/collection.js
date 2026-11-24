/* GTA 6 Facile — objets à collectionner : cases « trouvé » (même liste que la carte, lg:carte-trouves, synchronisée avec le compte),
   progression, recherche dans la page et « masquer les objets trouvés ». */
(() => {
  'use strict';
  const KEY = 'lg:carte-trouves';
  const lire = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); } };
  const ecrire = (s) => { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) { /* mode privé */ } };
  const norm = (window.LG && window.LG.norm) || ((s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim());

  // page d'accueil des objets : « x / y trouvés » sur chaque type
  const index = document.querySelector('[data-col-index]');
  if (index) {
    const maj = () => {
      const t = lire();
      index.querySelectorAll('[data-col-type]').forEach((a) => {
        const ids = a.dataset.colType.split(' '); const n = ids.filter((i) => t.has(i)).length;
        const s = a.querySelector('[data-col-compte]'); s.textContent = n ? `${n} / ${ids.length} trouvés` : `${ids.length} emplacements`;
      });
    };
    maj(); document.addEventListener('lg:remote', maj);
    return;
  }

  const box = document.querySelector('[data-col]'); if (!box) return;
  const items = [...box.querySelectorAll('.col-it')];
  const zones = [...box.querySelectorAll('[data-col-z]')];
  const q = box.querySelector('[data-search]'), cacher = box.querySelector('[data-col-cacher]');
  const nEl = box.querySelector('[data-col-n]'), bar = box.querySelector('[data-col-bar]'), vide = box.querySelector('[data-col-vide]');
  let masquer = false;

  function afficher() {
    const t = lire(), mots = q && q.value ? norm(q.value).split(' ').filter(Boolean) : [];
    let n = 0, visibles = 0;
    items.forEach((li) => {
      const ok = t.has(li.dataset.id); if (ok) n++;
      li.classList.toggle('is-found', ok);
      li.querySelector('[data-trouve]').setAttribute('aria-pressed', String(ok));
      const vu = (!masquer || !ok) && mots.every((m) => li.dataset.text.includes(m));
      li.hidden = !vu; if (vu) visibles++;
    });
    zones.forEach((z) => { z.hidden = !z.querySelector('.col-it:not([hidden])'); });
    nEl.textContent = n; bar.style.width = `${Math.round((n / items.length) * 100)}%`;
    vide.hidden = visibles > 0;
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-trouve]'); if (!b) return;
    const t = lire(), id = b.dataset.trouve;
    if (t.has(id)) t.delete(id); else { t.add(id); window.LG && window.LG.toast && window.LG.toast('Trouvé !'); }
    ecrire(t); afficher();
  });
  if (q) { let tm; q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(afficher, 80); }); }
  if (cacher) cacher.addEventListener('click', () => { masquer = !masquer; cacher.setAttribute('aria-pressed', String(masquer)); afficher(); });
  document.addEventListener('lg:remote', afficher);
  afficher();
})();
