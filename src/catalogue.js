/* Leonida Guide — catalogue des véhicules : fenêtre d'infos (marque, classe, vraie voiture, comment l'obtenir) */
(() => {
  'use strict';
  const data = document.getElementById('catalogue-data'); const dlg = document.querySelector('.vdlg');
  if (!data || !dlg) return;
  let L; try { L = JSON.parse(data.textContent); } catch (e) { return; }
  const by = Object.fromEntries(L.map((x) => [x.s, x]));
  const ROOT = document.body.dataset.root || './';
  const ic = (n) => (window.LG && LG.ic ? LG.ic(n) : '');
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NOMS = { voitures: 'Voiture', motos: 'Moto', bateaux: 'Bateau', avions: 'Avion', autres: 'Autre' };
  const box = dlg.querySelector('[data-vdlg]');
  let retour = null;

  function ouvrir(slug, depuis) {
    const x = by[slug]; if (!x) return;
    retour = depuis || null;
    const lignes = [
      x.f && ['badge', 'Marque', esc(x.f)],
      ['sparkle', 'Classe', `${esc(x.c)} <small>(${esc(NOMS[x.t] || '')})</small>`],
      x.i && ['car', 'Inspiré de', esc(x.i)],
      x.p && ['user', 'Places', esc(x.p)]
    ].filter(Boolean);
    box.innerHTML = `
      <button type="button" class="vdlg-x" data-x aria-label="Fermer">${ic('x')}</button>
      <figure class="vdlg-img">${x.img ? `<img src="${/^(https?:|\/)/.test(x.img) ? '' : ROOT + 'catalogue/'}${esc(x.img)}" alt="${esc(x.n)}">` : `<span class="vdlg-noimg">${ic('car')}<small>Pas encore de photo de ce véhicule</small></span>`}
        ${x.img && x.cr ? `<figcaption>Image : ${x.cu ? `<a href="${esc(x.cu)}" target="_blank" rel="noopener">${esc(x.cr)}</a>` : esc(x.cr)}</figcaption>` : ''}</figure>
      <div class="vdlg-body">
        <p class="vdlg-k">${esc(NOMS[x.t] || 'Véhicule')} · ${esc(x.c)}</p>
        <h2 id="vdlg-t" class="vdlg-t">${esc(x.n)}</h2>
        <dl class="vdlg-facts">${lignes.map(([i, k, v]) => `<div><dt>${ic(i)}${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <div class="vdlg-how ${x.o ? '' : 'is-unknown'}"><h3>${ic('pin')}Comment l'obtenir</h3>
          <p>${x.o ? esc(x.o) : "Pas encore documenté. Le véhicule est bien confirmé dans GTA 6, mais personne n'a encore indiqué où le trouver à coup sûr. On complète dès que c'est vérifié."}</p></div>
        <p class="vdlg-src">Sources : ${(x.src || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)}</a>`).join(' · ')}</p>
      </div>`;
    box.querySelector('[data-x]').addEventListener('click', fermer);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    const u = new URL(location.href); u.searchParams.set('v', slug); history.replaceState(history.state, '', u);
    if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.fromTo(box, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'expo.out' });
  }
  function fermer() {
    if (dlg.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  }
  dlg.addEventListener('close', () => {
    const u = new URL(location.href); u.searchParams.delete('v'); history.replaceState(history.state, '', u);
    if (retour) retour.focus();
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fermer(); }); // clic à côté
  document.querySelectorAll('[data-fiche]').forEach((b) => b.addEventListener('click', () => ouvrir(b.dataset.fiche, b)));
  const v = new URLSearchParams(location.search).get('v');
  if (v && by[v]) setTimeout(() => ouvrir(v, document.querySelector(`[data-fiche="${v}"]`)), 300);
})();
