/* Leonida Guide — page des codes : recherche et filtres */
(() => {
  'use strict';
  const root = document.querySelector('[data-codes]'); if (!root) return;
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const LG = window.LG || {};
  const norm = LG.norm || ((s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  const input = $('[data-search]'), cards = $$('.code'), groups = $$('[data-cgrp]');
  const params = new URLSearchParams(location.search);
  const st = { cat: params.get('cat') || '', seq: false };
  const chips = $$('[data-ccat]');
  chips.forEach((b) => b.addEventListener('click', () => { st.cat = b.dataset.ccat; apply(); }));
  $('[data-cseq]').addEventListener('click', (e) => { st.seq = !st.seq; e.currentTarget.setAttribute('aria-pressed', String(st.seq)); apply(); });
  if (input) { input.value = params.get('q') || ''; let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 80); }); }
  function apply() {
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ccat === st.cat)));
    const toks = input ? norm(input.value).split(' ').filter(Boolean) : [];
    let n = 0;
    cards.forEach((c) => {
      const t = c.dataset.text || '', w = t.split(' ');
      const ok = (!st.cat || c.dataset.cat === st.cat) && (!st.seq || c.dataset.seq === '1') && toks.every((k) => t.includes(k) || (LG.tokMatch && LG.tokMatch(k, w) >= .5));
      c.hidden = !ok; if (ok) n++;
    });
    groups.forEach((g) => { g.hidden = !g.querySelector('.code:not([hidden])'); });
    $('[data-ccount]').textContent = `${n} code${n > 1 ? 's' : ''}`;
    $('[data-cempty]').hidden = n > 0;
    const u = new URL(location.href);
    st.cat ? u.searchParams.set('cat', st.cat) : u.searchParams.delete('cat');
    input && input.value.trim() ? u.searchParams.set('q', input.value.trim()) : u.searchParams.delete('q');
    history.replaceState(history.state, '', u);
  }
  apply();
  // lien direct vers un code (#id) : on le met en avant
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el && el.classList.contains('code')) { el.classList.add('is-target'); setTimeout(() => el.scrollIntoView({ block: 'center' }), 200); } }
})();
