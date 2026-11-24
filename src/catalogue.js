/* GTA 6 Facile — page Véhicules : catégories, filtres, recherche et fenêtre d'infos du catalogue */
(() => {
  'use strict';
  const root = document.querySelector('[data-vlist]'); if (!root) return;
  const $ = (s, c = root) => c.querySelector(s);
  const $$ = (s, c = root) => [...c.querySelectorAll(s)];
  const LG = window.LG || {};
  const ic = (n) => (LG.ic ? LG.ic(n) : '');
  const norm = LG.norm || ((s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROOT = document.body.dataset.root || './';
  const PAR_GROUPE = 8; // cartes visibles par catégorie avant « Voir les autres »

  // ---------- filtres et catégories ----------
  const input = $('[data-search]');
  const groups = $$('[data-vgrp]').map((sec) => ({ sec, id: sec.dataset.vgrp, nom: sec.querySelector('.vgrp-h').firstChild.textContent.trim().toLowerCase(), cards: $$('.card', sec), more: $('[data-vmore]', sec), n: $('[data-vn]', sec), open: false }));
  const jumps = Object.fromEntries($$('[data-jump]').map((a) => [a.dataset.jump, a]));
  const params = new URLSearchParams(location.search);
  const st = { type: params.get('cat') || '', t: {} };
  const doors = $$('[data-vtype] [data-value]');
  const syncDoors = () => { doors.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === st.type))); $('[data-vtype]').classList.toggle('is-picked', !!st.type); };
  doors.forEach((b) => b.addEventListener('click', () => { st.type = st.type === b.dataset.value ? '' : b.dataset.value; syncDoors(); syncURL(); apply(); }));
  $$('[data-vtoggle]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.vtoggle; st.t[k] = !st.t[k]; b.setAttribute('aria-pressed', String(!!st.t[k])); apply(); }));
  groups.forEach((g) => g.more.addEventListener('click', () => { g.open = !g.open; apply(); if (!g.open) g.sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); }));
  if (input) { input.value = params.get('q') || ''; let tm; input.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { syncURL(); apply(); }, 90); }); }

  function syncURL() {
    const u = new URL(location.href);
    st.type ? u.searchParams.set('cat', st.type) : u.searchParams.delete('cat');
    input && input.value.trim() ? u.searchParams.set('q', input.value.trim()) : u.searchParams.delete('q');
    history.replaceState(history.state, '', u);
  }
  function apply() {
    const q = input ? norm(input.value) : '';
    const toks = q ? q.split(' ').filter(Boolean) : [];
    let total = 0, nGroupes = 0;
    for (const g of groups) {
      const ok = g.cards.filter((c) => {
        if (st.type && c.dataset.cat !== st.type) return false;
        if (st.t.known && c.dataset.known !== '1') return false;
        if (st.t.photo && c.dataset.photo !== '1') return false;
        if (st.t.sur && c.dataset.sur !== '1') return false;
        if (st.t.map && c.dataset.map !== '1') return false;
        if (toks.length) { const t = c.dataset.text || ''; const w = t.split(' '); if (!toks.every((k) => t.includes(k) || (LG.tokMatch && LG.tokMatch(k, w) >= .5))) return false; }
        return true;
      });
      const tout = g.open || toks.length > 0 || ok.length <= PAR_GROUPE + 2;
      const visibles = new Set(tout ? ok : ok.slice(0, PAR_GROUPE));
      g.cards.forEach((c) => { c.hidden = !visibles.has(c); });
      g.sec.hidden = ok.length === 0;
      g.n.textContent = ok.length;
      g.more.hidden = ok.length <= PAR_GROUPE + 2 || toks.length > 0;
      g.more.querySelector('span').textContent = g.open ? 'Réduire' : `Voir les ${ok.length - PAR_GROUPE} autres (${g.nom})`;
      g.more.setAttribute('aria-expanded', String(g.open));
      if (jumps[g.id]) { jumps[g.id].hidden = ok.length === 0; jumps[g.id].querySelector('small').textContent = ok.length; }
      total += ok.length; if (ok.length) nGroupes++;
    }
    $('[data-vcount]').textContent = `${total} véhicule${total > 1 ? 's' : ''} · ${nGroupes} catégorie${nGroupes > 1 ? 's' : ''}`;
    $('[data-vempty]').hidden = total > 0;
  }
  syncDoors(); apply();

  // ---------- fenêtre d'infos des véhicules du catalogue ----------
  const data = document.getElementById('catalogue-data'); const dlg = document.querySelector('.vdlg');
  if (!data || !dlg) return;
  let L; try { L = JSON.parse(data.textContent); } catch (e) { return; }
  const by = Object.fromEntries(L.map((x) => [x.s, x]));
  const NOMS = { voitures: 'Voiture', motos: 'Moto', bateaux: 'Bateau', avions: 'Avion', autres: 'Autre' };
  const box = dlg.querySelector('[data-vdlg]');
  let retour = null;

  function ouvrir(slug, depuis) {
    const x = by[slug]; if (!x) return;
    retour = depuis || null;
    const lignes = [
      x.f && ['badge', 'Marque', esc(x.f)],
      ['sparkle', 'Catégorie', esc(x.c)],
      x.i && ['car', 'Inspiré de', esc(x.i)],
      x.p && ['user', 'Places', esc(x.p)],
      (x.tr || x.r) && ['sliders', 'Transmission', [x.tr, x.r ? `${x.r} rapports` : ''].filter(Boolean).map(esc).join(' · ')],
      x.w && ['shield', 'Poids', esc(x.w)],
      x.a && ['replay', 'Déjà vu dans', esc(x.a)]
    ].filter(Boolean);
    const src = /^(https?:|\/)/.test(x.img || '') ? '' : ROOT + 'catalogue/';
    box.innerHTML = `
      <button type="button" class="vdlg-x" data-x aria-label="Fermer">${ic('x')}</button>
      <figure class="vdlg-img">${x.img ? `<img src="${src}${esc(x.img)}" alt="${esc(x.n)}">` : `<span class="vdlg-noimg">${ic('car')}<small>Pas encore de photo nette de ce véhicule</small></span>`}
        ${x.img && x.cr ? `<figcaption>Image : ${x.cu ? `<a href="${esc(x.cu)}" target="_blank" rel="noopener">${esc(x.cr)}</a>` : esc(x.cr)}</figcaption>` : ''}</figure>
      <div class="vdlg-body">
        <p class="vdlg-k">${esc(x.c)}</p>
        <h2 id="vdlg-t" class="vdlg-t">${esc(x.n)}</h2>
        ${x.d ? `<p class="vdlg-d">${esc(x.d)}</p>` : ''}
        <dl class="vdlg-facts">${lignes.map(([i, k, v]) => `<div><dt>${ic(i)}${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        ${x.vt ? `<p class="vdlg-verif vdlg-verif--${esc(x.vf)}">${ic(x.vf === 'confirme' ? 'check' : 'alert')}<span><b>Présence dans GTA 6 :</b> ${esc(x.vt)}${x.vn ? ` ${esc(x.vn)}` : ''}</span></p>` : ''}
        <div class="vdlg-how ${x.o || (x.lo && x.lo.length) ? '' : 'is-unknown'}"><h3>${ic('pin')}Comment l'obtenir</h3>
          ${x.lo && x.lo.length ? `<p>${x.o ? esc(x.o) + ' ' : ''}Repéré par les joueurs à ${x.lo.length > 1 ? x.lo.length + ' endroits' : 'un endroit précis'} :</p><ul class="vdlg-lo">${x.lo.map((l) => `<li><b>${esc(l.n)}</b>${l.z ? ` · ${esc(l.z)}` : ''}${l.d ? `<br><small>${esc(l.d)}</small>` : ''}</li>`).join('')}</ul><a class="btn btn--primary vdlg-map" href="${ROOT}carte/?focus=${encodeURIComponent(x.lo[0].id)}">${ic('map')}Voir sur la carte</a>`
            : `<p>${x.o ? esc(x.o) : "Pas encore documenté. Le véhicule est bien confirmé dans GTA 6, mais personne n'a encore indiqué où le trouver à coup sûr. On complète dès que c'est vérifié."}</p>`}</div>
        <a class="btn btn--primary vdlg-page" href="${ROOT}vehicules/${esc(x.s)}/">${ic('arrow-right')}Voir la fiche complète</a>
        <p class="vdlg-src">Sources : ${(x.src || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nom)}</a>`).join(' · ')}</p>
      </div>`;
    box.querySelector('[data-x]').addEventListener('click', fermer);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    const u = new URL(location.href); u.searchParams.set('v', slug); history.replaceState(history.state, '', u);
    if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.fromTo(box, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'expo.out' });
  }
  function fermer() { if (dlg.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); } }
  dlg.addEventListener('close', () => { const u = new URL(location.href); u.searchParams.delete('v'); history.replaceState(history.state, '', u); if (retour) retour.focus(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fermer(); });
  // la carte est un vrai lien vers la fiche : un simple toucher ouvre la fenêtre rapide, un appui long ou un nouvel onglet ouvre la page
  document.querySelectorAll('[data-fiche]').forEach((b) => b.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0 || !by[b.dataset.fiche]) return;
    e.preventDefault(); ouvrir(b.dataset.fiche, b);
  }));
  const v = params.get('v');
  if (v && by[v]) setTimeout(() => ouvrir(v, document.querySelector(`[data-fiche="${v}"]`)), 300);
})();
