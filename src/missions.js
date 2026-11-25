/* GTA 6 Facile — Missions et solutions : recherche, filtres et suivi de progression (gardé sur cet appareil) */
(() => {
  'use strict';
  const root = document.querySelector('[data-missions]'); if (!root) return;
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const LG = window.LG || {};
  const norm = LG.norm || ((s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
  const KEY = 'lg:missions';
  const cards = $$('.mis'), chaps = $$('[data-mchap]'), main = cards.filter((c) => c.dataset.opt === '0');
  const input = $('[data-search]');
  const params = new URLSearchParams(location.search);
  const st = { ch: params.get('ch') || '', opt: true, hide: false };

  let done = new Set();
  try { done = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { /* stockage indisponible */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch (e) { /* ignoré */ } };

  function paint() {
    cards.forEach((c) => {
      const on = done.has(c.id);
      c.classList.toggle('is-done', on);
      const b = c.querySelector('[data-mdone]');
      if (b) { b.setAttribute('aria-pressed', String(on)); b.querySelector('span').textContent = on ? 'Faite' : 'Mission faite'; }
    });
    const n = main.filter((c) => done.has(c.id)).length;
    $('[data-mcount]').textContent = `${n} / ${main.length} étapes de l'histoire faites`;
    $('[data-mbar]').style.width = `${(n / main.length) * 100}%`;
    $('[data-mreset]').hidden = !done.size;
    // prochaine mission : la première mission principale pas encore faite
    const next = n ? main.find((c) => !done.has(c.id)) : null;
    const txt = $('[data-mnow-txt]'), a = $('[data-mnext]');
    if (!n) { txt.textContent = "Touche « J'en suis là » sur ta mission actuelle : on t'indique la suivante."; a.hidden = true; }
    else if (!next) { txt.textContent = "Tu as fini l'histoire ! Il reste peut-être des missions facultatives."; a.hidden = true; }
    else {
      const t = next.querySelector('.mis-t b').textContent, num = next.dataset.num;
      txt.innerHTML = '';
      txt.append('Prochaine mission : ', Object.assign(document.createElement('b'), { textContent: `${num}. ${t}` }));
      if (next.dataset.ov) txt.append(' (ordre à vérifier : les sources ne donnent pas toutes le même ordre)');
      a.hidden = false; a.href = `#${next.id}`; a.dataset.target = next.id;
    }
    apply();
  }

  function open(id) {
    const el = document.getElementById(id); if (!el) return;
    if (el.hidden) { st.ch = ''; st.hide = false; if (input) input.value = ''; apply(); }
    el.open = true; el.classList.add('is-target');
    setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  }

  root.addEventListener('click', (e) => {
    const d = e.target.closest('[data-mdone]'), h = e.target.closest('[data-mhere]'), nx = e.target.closest('[data-mnext]');
    if (d) { const id = d.closest('.mis').id; done.has(id) ? done.delete(id) : done.add(id); save(); paint(); }
    if (h) { // toutes les missions de l'histoire avant celle-ci sont faites
      const id = h.closest('.mis').id, i = main.findIndex((c) => c.id === id);
      main.forEach((c, k) => { k < i ? done.add(c.id) : done.delete(c.id); });
      save(); paint();
      $('[data-mnow]').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (nx) { e.preventDefault(); open(nx.dataset.target); }
  });
  $('[data-mreset]').addEventListener('click', () => { if (confirm('Effacer ta progression sur cet appareil ?')) { done.clear(); save(); paint(); } });

  const chips = $$('[data-mch]');
  chips.forEach((b) => b.addEventListener('click', () => { st.ch = b.dataset.mch; apply(); }));
  $('[data-mopt]').addEventListener('click', (e) => { st.opt = !st.opt; e.currentTarget.setAttribute('aria-pressed', String(st.opt)); apply(); });
  $('[data-mhide]').addEventListener('click', (e) => { st.hide = !st.hide; e.currentTarget.setAttribute('aria-pressed', String(st.hide)); apply(); });
  if (input) { input.value = params.get('q') || ''; let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 80); }); }

  function apply() {
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mch === st.ch)));
    const toks = input ? norm(input.value).split(' ').filter(Boolean) : [];
    let n = 0;
    cards.forEach((c) => {
      const t = c.dataset.text || '', w = t.split(' ');
      const ok = (!st.ch || c.dataset.ch === st.ch) && (st.opt || c.dataset.opt === '0') && (!st.hide || !done.has(c.id))
        && toks.every((k) => t.includes(k) || (LG.tokMatch && LG.tokMatch(k, w) >= .5));
      c.hidden = !ok; if (ok) n++;
    });
    chaps.forEach((g) => { g.hidden = !g.querySelector('.mis:not([hidden])'); });
    $('[data-mcountline]').textContent = `${n} mission${n > 1 ? 's' : ''}`;
    $('[data-mempty]').hidden = n > 0;
    const u = new URL(location.href);
    st.ch ? u.searchParams.set('ch', st.ch) : u.searchParams.delete('ch');
    input && input.value.trim() ? u.searchParams.set('q', input.value.trim()) : u.searchParams.delete('q');
    history.replaceState(history.state, '', u);
  }

  paint();
  if (location.hash) open(location.hash.slice(1));
  window.addEventListener('hashchange', () => open(location.hash.slice(1)));
})();
