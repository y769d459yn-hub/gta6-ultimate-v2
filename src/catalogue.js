/* GTA 6 Facile — page Véhicules : recherche, filtres par type et « emplacement connu » */
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
  const st = { type: params.get('cat') || '', t: { known: params.get('connu') === '1' } };
  const doors = $$('[data-vtype] [data-value]');
  const syncDoors = () => { doors.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === st.type))); $('[data-vtype]').classList.toggle('is-picked', !!st.type); };
  doors.forEach((b) => b.addEventListener('click', () => { st.type = st.type === b.dataset.value ? '' : b.dataset.value; syncDoors(); syncURL(); apply(); }));
  $$('[data-vtoggle]').forEach((b) => b.setAttribute('aria-pressed', String(!!st.t[b.dataset.vtoggle])));
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

  // anciens liens partagés (?v=slug, l'ancienne fenêtre d'infos) : on ouvre la fiche du véhicule
  const v = params.get('v');
  if (v && /^[a-z0-9-]+$/.test(v)) location.replace(ROOT + 'vehicules/' + v + '/');
})();
