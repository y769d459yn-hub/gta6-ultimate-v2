/* Leonida Guide — interactions globales (sans dépendance ; GSAP en amélioration progressive) */
(() => {
  'use strict';
  const html = document.documentElement;
  const ROOT = document.body.dataset.root || './';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const GSAP_URL = ROOT + 'assets/gsap.min.js';
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || html.dataset.motion === 'off';
  const ICONS = () => window.LG_ICONS || {};
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS()[n] || ''}</svg>`;
  const escH = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- stockage local (tolérant) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('lg:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('lg:' + k, JSON.stringify(v)); } catch (e) { /* mode privé */ } }
  };

  // ---------- toast ----------
  let toastT;
  function toast(msg, icon = 'check') {
    const t = $('.toast'); if (!t) return;
    t.innerHTML = ic(icon) + escH(msg); t.hidden = false;
    if (window.gsap && !reduceMotion()) gsap.fromTo(t, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'back.out(2)' });
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ---------- normalisation + recherche floue ----------
  const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9$]+/g, ' ').trim();
  const STOP = new Set('ou le la les l un une des de du d comment quoi quel quelle quels quelles est ce c que qu qui pour avec dans sur en et a au aux je j tu il on mon ma mes faire fait peut peux veux trouver avoir gta 6 vi grand theft auto se s y sans par plus'.split(' '));
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev[j - 2] + 1);
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function tokMatch(q, toks) {
    let best = 0;
    for (const t of toks) {
      let s = 0;
      if (t === q) s = 1;
      else if (q.length >= 2 && t.startsWith(q)) s = .85;
      else if (t.length >= 4 && q.startsWith(t)) s = .65;
      else if (q.length >= 4 && t.includes(q)) s = .6;
      else if (q.length >= 4 && lev(q, t, 1) <= 1) s = .7;
      else if (q.length >= 7 && lev(q, t, 2) <= 2) s = .5;
      if (s > best) { best = s; if (s === 1) break; }
    }
    return best;
  }
  const queryTokens = (qn) => { const all = qn.split(' ').filter(Boolean); const t = all.filter((x) => !STOP.has(x)); return t.length ? t : all; };

  // ---------- index ----------
  let IDX = null, idxP = null;
  function loadIndex() {
    if (IDX) return Promise.resolve(IDX);
    if (!idxP) idxP = fetch(ROOT + 'data/index.json').then((r) => r.json()).then((d) => {
      d.items.forEach((it) => { it._t = norm(it.t + ' ' + (it.q || '')).split(' '); it._k = (it.k || '').split(' '); it._d = norm(it.d).split(' '); it._tn = norm(it.t); });
      d.synTok = new Map(); d.synPhr = [];
      d.syn.forEach((g, gi) => g.forEach((w) => (w.includes(' ') ? d.synPhr.push([w, gi]) : d.synTok.set(w, gi))));
      return (IDX = d);
    });
    return idxP;
  }
  const SF = {
    voiture: (it) => it.g === 'vehicule',
    mission: (it) => (it.g === 'astuce' && it.s === 'missions') || (it.g === 'ency' && it.s === 'histoire'),
    lieu: (it) => it.g === 'lieu',
    activite: (it) => it.g === 'activite' || (it.g === 'astuce' && it.s === 'exploration'),
    personnage: (it) => it.g === 'personnage'
  };
  function search(q, { sf = null, mapOnly = false } = {}) {
    const d = IDX; if (!d) return [];
    const qn = norm(q);
    let pool = d.items;
    if (sf && SF[sf]) pool = pool.filter(SF[sf]);
    if (mapOnly) pool = pool.filter((it) => it.m);
    if (!qn) return sf || mapOnly ? pool.slice(0, 30).map((it) => ({ it, s: 1 })) : [];
    const toks = queryTokens(qn);
    const alts = toks.map((t) => {
      const a = [[t, 1]];
      const gi = d.synTok.get(t);
      if (gi !== undefined) d.syn[gi].forEach((w) => w !== t && w.length > 1 && a.push([w, .75]));
      return a;
    });
    d.synPhr.forEach(([ph, gi]) => { if (qn.includes(ph)) alts.push(d.syn[gi].filter((w) => w !== ph).map((w) => [w, .8])); });
    const out = [];
    for (const it of pool) {
      let total = 0, hit = 0;
      alts.forEach((a, i) => {
        let best = 0;
        for (const [w, wt] of a) {
          // une expression (« voyage rapide ») ne compte que si tous ses mots sont présents
          const s = Math.min(...w.split(' ').map((p) => Math.max(tokMatch(p, it._t) * 3, tokMatch(p, it._k) * 2, tokMatch(p, it._d)))) * wt;
          if (s > best) best = s;
        }
        total += best; if (best > 0 && i < toks.length) hit++;
      });
      if (!total) continue;
      let s = total * Math.pow(Math.max(hit, .5) / toks.length, 2);
      if (it._tn.includes(qn)) s += 3;
      if (it._tn.startsWith(qn)) s += 1;
      if (it.g === 'page') s *= .6;
      out.push({ it, s });
    }
    return out.sort((a, b) => b.s - a.s).slice(0, 24);
  }
  function resultHTML(r, i) {
    const it = r.it;
    const best = i === 0;
    return `<div class="so-row" role="option" data-i="${i}"><a class="so-item${best ? ' so-best' : ''}" href="${ROOT}${it.u}" style="--c:${it.c}" data-i="${i}">
      <span class="mini-ico">${ic(it.i) || ic('pin')}</span>
      <span class="so-item-t"><small>${best ? 'Meilleur résultat · ' : ''}${escH(it.l)}</small><b>${escH(it.t)}</b>${it.d ? `<span>${escH(it.d)}</span>` : ''}</span>
      <span class="so-go">Voir ${ic('arrow-right')}</span></a></div>`;
  }
  function popularHTML() {
    const d = IDX; if (!d) return '';
    return `<p class="so-sec">Les plus cherchés</p><div class="so-pop">${d.popular.map((p) => `<a href="${ROOT}${p.u}" style="--c:${p.c}">${ic(p.i)}${escH(p.t)}</a>`).join('')}</div>
      <p class="so-sec">Raccourcis</p><div class="so-pop"><a href="${ROOT}carte/" style="--c:#19d3e3">${ic('map')}Carte</a><a href="${ROOT}vehicules/" style="--c:#ff9a1f">${ic('car')}Véhicules</a><a href="${ROOT}astuces/?cat=argent" style="--c:#3ddc84">${ic('money')}Argent</a><a href="${ROOT}astuces/?cat=debuter" style="--c:#ffd23f">${ic('sprout')}Débuter</a></div>`;
  }
  function bindSearchUI(input, results, chipsWrap, { onQuery } = {}) {
    let sf = null, mapOnly = false, sel = 0, last = [];
    const render = () => {
      const q = input.value;
      if (!q.trim() && !sf && !mapOnly) { results.innerHTML = popularHTML(); last = []; return; }
      last = search(q, { sf, mapOnly });
      sel = 0;
      results.innerHTML = last.length ? last.map(resultHTML).join('') : `<p class="so-empty">${ic('question', 'ic-xl')}<br>Essaie un autre mot</p>${popularHTML()}`;
      mark();
      if (window.gsap && !reduceMotion()) gsap.from(results.querySelectorAll('.so-row'), { y: 10, opacity: 0, duration: .25, stagger: .02, ease: 'power2.out' });
      onQuery && onQuery(q);
    };
    const mark = () => $$('.so-item', results).forEach((a, i) => a.setAttribute('aria-selected', i === sel ? 'true' : 'false'));
    let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => loadIndex().then(render), 60); });
    input.addEventListener('keydown', (e) => {
      const items = $$('.so-item', results);
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, items.length - 1); mark(); items[sel] && items[sel].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); items[sel] && items[sel].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { const a = items[sel] || items[0]; if (a) { e.preventDefault(); location.href = a.href; } }
    });
    chipsWrap && $$('[data-sf]', chipsWrap).forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.sf; sf = sf === v ? null : v;
      $$('[data-sf]', chipsWrap).forEach((x) => x.setAttribute('aria-pressed', x.dataset.sf === sf ? 'true' : 'false'));
      loadIndex().then(render); input.focus({ preventScroll: true });
    }));
    const mo = chipsWrap && $('[data-mapsonly]', chipsWrap);
    mo && mo.addEventListener('click', () => { mapOnly = !mapOnly; mo.setAttribute('aria-pressed', mapOnly); loadIndex().then(render); });
    return { render: () => loadIndex().then(render) };
  }

  // ---------- recherche plein écran ----------
  const so = $('#search');
  let soUI = null, soOpen = false;
  function openSearch(prefill = '') {
    if (!so || soOpen) return;
    soOpen = true; so.hidden = false; document.body.style.overflow = 'hidden';
    const input = $('#so-input');
    if (!soUI) soUI = bindSearchUI(input, $('#so-results'), $('.so-chips', so));
    if (prefill) input.value = prefill;
    soUI.render();
    requestAnimationFrame(() => input.focus());
    history.pushState({ so: 1 }, '');
    if (window.gsap && !reduceMotion()) {
      gsap.fromTo('.so-backdrop', { opacity: 0 }, { opacity: 1, duration: .25 });
      gsap.fromTo('.so-box', { y: -24, opacity: 0, scale: .98 }, { y: 0, opacity: 1, scale: 1, duration: .4, ease: 'expo.out' });
    }
  }
  function closeSearch(fromPop = false) {
    if (!soOpen) return;
    soOpen = false; so.hidden = true; document.body.style.overflow = '';
    if (!fromPop && history.state && history.state.so) history.back();
  }
  addEventListener('popstate', () => closeSearch(true));
  $$('[data-open-search]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); openSearch(); }));
  $$('[data-close-search]').forEach((b) => b.addEventListener('click', () => closeSearch()));
  addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
    if (e.key === 'Escape' && soOpen) closeSearch();
    else if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); openSearch(); }
  });
  // Précharge l'index au premier signe d'intention
  ['pointerover', 'focusin', 'touchstart'].forEach((ev) => $$('[data-open-search]').forEach((b) => b.addEventListener(ev, () => loadIndex(), { once: true, passive: true })));

  // page /recherche
  const rs = $('#rs-input');
  if (rs) {
    const ui = bindSearchUI(rs, $('#rs-results'), $('[data-inline-search] .chips'), { onQuery: (q) => { const u = new URL(location.href); q ? u.searchParams.set('q', q) : u.searchParams.delete('q'); history.replaceState(null, '', u); } });
    rs.value = new URLSearchParams(location.search).get('q') || '';
    ui.render(); rs.focus();
  }

  // ---------- favoris ----------
  const favs = () => store.get('favs', []);
  const setFavs = (a) => { store.set('favs', a); syncFavs(); };
  function syncFavs() {
    const f = favs(); const ids = new Set(f.map((x) => x.type + ':' + x.id));
    $$('[data-fav-count]').forEach((c) => { c.textContent = f.length; c.hidden = !f.length; });
    $$('[data-fav]').forEach((b) => {
      let o; try { o = JSON.parse(b.dataset.fav); } catch (e) { return; }
      const on = ids.has(o.type + ':' + o.id);
      b.setAttribute('aria-pressed', on);
      const sp = b.querySelector('[data-on]'); if (sp) sp.textContent = on ? sp.dataset.on : sp.dataset.off;
    });
  }
  function toggleFav(o) {
    const f = favs(); const k = o.type + ':' + o.id; const i = f.findIndex((x) => x.type + ':' + x.id === k);
    if (i >= 0) { f.splice(i, 1); toast('Retiré des favoris', 'heart'); } else { f.unshift({ ...o, ts: Date.now() }); toast('Ajouté aux favoris', 'heart'); }
    setFavs(f);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fav]'); if (!b) return;
    e.preventDefault(); try { toggleFav(JSON.parse(b.dataset.fav)); } catch (err) { /* */ }
  });
  window.LG = { toggleFav, syncFavs, toast, store, norm, lev, tokMatch, ic, ROOT, reduceMotion };
  syncFavs();

  // ---------- « je l'ai fait » ----------
  const done = () => new Set(store.get('done', []));
  function syncDone() {
    const d = done();
    $$('[data-done]').forEach((b) => { const on = d.has(b.dataset.done); b.setAttribute('aria-pressed', on); const sp = b.querySelector('[data-on]'); if (sp) sp.textContent = on ? sp.dataset.on : sp.dataset.off; });
    $$('.card[data-id]').forEach((c) => { const on = d.has(c.dataset.id); c.classList.toggle('is-done', on); const f = c.querySelector('.done-flag'); if (f) f.hidden = !on; });
  }
  $$('[data-done]').forEach((b) => b.addEventListener('click', () => {
    const d = done(); const id = b.dataset.done;
    if (d.has(id)) d.delete(id); else { d.add(id); toast('Bien joué ! Astuce cochée'); }
    store.set('done', [...d]); syncDone();
  }));
  syncDone();

  // ---------- copier le lien ----------
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const url = location.href.split('#')[0];
    try {
      if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url); toast('Lien copié');
    } catch (e) { toast('Copie impossible', 'x'); }
  }));

  // ---------- listes filtrables ----------
  $$('[data-list]').forEach(initList);
  function initList(rootEl) {
    const wrap = $('[data-items]', rootEl); if (!wrap) return;
    const items = [...wrap.children];
    items.forEach((el, i) => { el._i = i; });
    const pageSize = +rootEl.dataset.pageSize || 12;
    let limit = pageSize;
    const st = { q: [], f: {}, t: {}, sort: '' };
    const requireFilter = rootEl.hasAttribute('data-require-filter');
    const groups = $$('[data-filter]', rootEl);
    const params = new URLSearchParams(location.search);
    const input = $('[data-search]', rootEl);
    const sortSel = $('[data-sort]', rootEl);
    if (sortSel) st.sort = sortSel.value;

    groups.forEach((g) => {
      const name = g.dataset.filter;
      const btns = $$('[data-value]', g);
      const set = (v, user) => {
        st.f[name] = v;
        if (g.classList.contains('doors')) g.classList.toggle('is-picked', !!v);
        btns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.value === v && (v !== '' || b.textContent.trim() !== '') ? 'true' : 'false'));
        if (v === '' && !btns.some((b) => b.dataset.value === '')) btns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
        if (user) { limit = pageSize; syncURL(); apply(true); }
      };
      btns.forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.value;
        set(st.f[name] === v && v !== '' ? '' : v, true);
        if (window.gsap && !reduceMotion()) gsap.fromTo(b, { scale: .92 }, { scale: 1, duration: .4, ease: 'back.out(3)' });
        if (name === 'cat' && v && innerWidth < 900) { const tgt = $('[data-count]', rootEl); tgt && setTimeout(() => tgt.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }), 60); }
      }));
      set(params.get(name) || '', false);
    });
    $$('[data-toggle]', rootEl).forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.toggle; st.t[k] = !st.t[k]; b.setAttribute('aria-pressed', st.t[k]); limit = pageSize; apply(true);
    }));
    if (input) {
      input.value = params.get('q') || '';
      let tm; input.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { limit = pageSize; apply(true); }, 80); });
    }
    sortSel && sortSel.addEventListener('change', () => { st.sort = sortSel.value; apply(true); });
    const more = $('[data-more]', rootEl);
    more && more.addEventListener('click', () => { limit += pageSize; apply(true, true); });

    function syncURL() {
      const u = new URL(location.href);
      Object.entries(st.f).forEach(([k, v]) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k)));
      history.replaceState(history.state, '', u);
    }
    function textOk(el, toks) {
      if (!toks.length) return true;
      const words = el.dataset.text.split(' ');
      return toks.every((t) => el.dataset.text.includes(t) || tokMatch(t, words) >= .5);
    }
    function apply(user, appendOnly) {
      const toks = input ? queryTokens(norm(input.value)) : [];
      const hasCat = !!st.f.cat;
      const gate = requireFilter && !hasCat && !toks.length;
      $$('[data-after-filter]', rootEl).forEach((x) => { x.hidden = gate; });
      let list = items.filter((el) => {
        for (const [k, v] of Object.entries(st.f)) if (v && el.dataset[k] !== v) return false;
        if (st.t.map && el.dataset.map !== '1') return false;
        return textOk(el, toks);
      });
      if (st.sort === 'd') list.sort((a, b) => (+a.dataset.d) - (+b.dataset.d) || a._i - b._i);
      else if (st.sort === 'alpha') list.sort((a, b) => a.dataset.alpha.localeCompare(b.dataset.alpha));
      else list.sort((a, b) => a._i - b._i);
      if (gate) list = [];
      const shown = new Set(list.slice(0, limit));
      const wasHidden = new Set(items.filter((x) => x.hidden));
      list.forEach((el) => wrap.appendChild(el));
      items.forEach((el) => { el.hidden = !shown.has(el); });
      const n = list.length;
      const cnt = $('[data-count]', rootEl);
      if (cnt) cnt.textContent = gate ? 'Choisis une porte d’entrée ci-dessus.' : n ? `${n} résultat${n > 1 ? 's' : ''}` : '';
      const empty = $('[data-empty]', rootEl); if (empty) empty.hidden = !!n || gate;
      if (more) more.hidden = n <= limit;
      if (user && window.gsap && !reduceMotion()) {
        const anim = [...shown].filter((el) => !appendOnly || wasHidden.has(el)).slice(0, 18);
        gsap.fromTo(anim, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .4, stagger: .03, ease: 'power2.out', clearProps: 'transform,opacity' });
      }
    }
    apply(false);
  }

  // ---------- page favoris ----------
  const favRoot = $('[data-favs]');
  if (favRoot) {
    let type = '', sort = 'recent';
    const list = $('[data-fav-list]', favRoot), empty = $('[data-fav-empty]', favRoot);
    const doors = $$('[data-fav-filter] [data-value]', favRoot);
    doors.forEach((b) => b.addEventListener('click', () => { type = type === b.dataset.value ? '' : b.dataset.value; doors.forEach((x) => x.setAttribute('aria-pressed', x.dataset.value === type)); render(); }));
    $('[data-fav-sort]', favRoot).addEventListener('change', (e) => { sort = e.target.value; render(); });
    const label = { astuce: 'Astuce', vehicule: 'Véhicule', lieu: 'Lieu' };
    function render() {
      const all = favs();
      ['astuce', 'vehicule', 'lieu'].forEach((t) => { const c = $(`[data-fc="${t}"]`, favRoot); if (c) c.textContent = all.filter((x) => x.type === t).length; });
      let f = all.filter((x) => !type || x.type === type);
      f = sort === 'alpha' ? f.sort((a, b) => a.t.localeCompare(b.t, 'fr')) : f.sort((a, b) => b.ts - a.ts);
      empty.hidden = !!f.length;
      list.innerHTML = f.map((x) => `<div class="card card--row" style="--c:${x.c}"><span class="card-ico">${ic(x.i) || ic('heart')}</span><span class="card-body"><span class="card-kicker">${label[x.type] || ''}</span><b class="card-title">${escH(x.t)}</b></span><a class="btn btn--primary" href="${ROOT}${x.u}">Ouvrir</a><button class="btn btn--ghost" type="button" data-rm="${x.type}:${x.id}" aria-label="Retirer ${escH(x.t)}">${ic('x')}<span class="sr-only">Retirer</span></button></div>`).join('');
      $$('[data-rm]', list).forEach((b) => b.addEventListener('click', () => { setFavs(favs().filter((x) => x.type + ':' + x.id !== b.dataset.rm)); toast('Retiré'); render(); }));
    }
    render();
  }

  // ---------- compte ----------
  const acc = $('[data-account]');
  if (acc) {
    const total = +acc.dataset.total;
    const refresh = () => {
      const d = store.get('done', []).length;
      $('[data-acc-favs]', acc).textContent = favs().length;
      $('[data-acc-done]', acc).textContent = d;
      $('[data-ring]', acc).style.setProperty('--p', Math.round((d / total) * 100));
    };
    refresh();
    $('[data-reset-done]', acc).addEventListener('click', () => { store.set('done', []); refresh(); toast('Progression remise à zéro'); });
    const prefs = store.get('prefs', {});
    const cur = { theme: prefs.theme || 'auto', motion: prefs.motion || 'on', size: prefs.size || '' };
    $$('[data-pref]', acc).forEach((g) => {
      const k = g.dataset.pref;
      const mark = () => $$('[data-value]', g).forEach((b) => b.setAttribute('aria-pressed', b.dataset.value === cur[k]));
      mark();
      $$('[data-value]', g).forEach((b) => b.addEventListener('click', () => {
        cur[k] = b.dataset.value; store.set('prefs', cur); mark();
        if (k === 'theme') html.dataset.theme = cur.theme === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night') : cur.theme;
        if (k === 'motion') { if (cur.motion === 'off') html.dataset.motion = 'off'; else delete html.dataset.motion; }
        if (k === 'size') { if (cur.size) html.dataset.size = cur.size; else delete html.dataset.size; }
        toast('Préférence enregistrée');
      }));
    });
  }

  // ---------- admin (démo locale, validation humaine en 2 temps) ----------
  $$('[data-admin-act="verifier"]').forEach((b) => b.addEventListener('click', () => {
    const row = b.closest('.arow'); row.classList.toggle('is-checked');
    const ap = row.querySelector('[data-admin-act="approuver"]'); ap.disabled = !row.classList.contains('is-checked');
    b.setAttribute('aria-pressed', row.classList.contains('is-checked'));
  }));
  $$('[data-admin-act="approuver"]').forEach((b) => b.addEventListener('click', () => toast('Approbation notée : reporte-la dans data/*.json', 'check')));

  // ---------- animations (GSAP chargé à la demande) ----------
  function animate() {
    const g = window.gsap;
    if (!g || reduceMotion() || html.classList.contains('ready-fallback')) { html.classList.add('no-gsap'); return; }
    g.fromTo('[data-reveal]', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'expo.out', stagger: .07 });
    $$('[data-reveal-group]').forEach((grp) => g.fromTo(grp.children, { y: 34, opacity: 0, scale: .96 }, { y: 0, opacity: 1, scale: 1, duration: .7, ease: 'back.out(1.4)', stagger: .06, delay: .12, clearProps: 'transform' }));
    const first = $$('[data-items] > *:not([hidden])').slice(0, 9);
    first.length && g.fromTo(first, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .04, ease: 'power2.out', delay: .15, clearProps: 'transform,opacity' });
    const steps = $$('.step');
    steps.length && g.fromTo(steps, { x: -16, opacity: 0 }, { x: 0, opacity: 1, duration: .5, stagger: .1, ease: 'power3.out', delay: .25, clearProps: 'transform' });
    const ans = $('.answer'); ans && g.fromTo(ans, { scale: .97, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'expo.out', delay: .1, clearProps: 'transform' });
    if (matchMedia('(pointer:fine)').matches) {
      $$('.tile, .door--big').forEach((el) => {
        el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; g.to(el, { rotateY: x * 9, rotateX: -y * 9, y: -4, transformPerspective: 800, duration: .4, ease: 'power2.out' }); });
        el.addEventListener('pointerleave', () => g.to(el, { rotateX: 0, rotateY: 0, y: 0, duration: .8, ease: 'elastic.out(1, .5)' }));
      });
      const sun = $('.sun');
      sun && addEventListener('pointermove', (e) => g.to(sun, { x: (e.clientX / innerWidth - .5) * 30, y: (e.clientY / innerHeight - .5) * 20, duration: 1.2, ease: 'power2.out' }));
    }
  }
  function loadGsap() {
    if (reduceMotion()) { html.classList.add('no-gsap'); return; }
    if (window.gsap) return animate();
    const s = document.createElement('script'); s.src = GSAP_URL; s.async = true;
    s.onload = animate; s.onerror = () => html.classList.add('no-gsap');
    document.head.appendChild(s);
  }
  loadGsap();
})();

// ---------- menu latéral (bouton ☰ de l'en-tête) ----------
(() => {
  const btn = document.querySelector('[data-menu]'), dr = document.getElementById('menu');
  if (!btn || !dr) return;
  const set = (open) => {
    dr.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('menu-open', open);
    if (open) { const a = dr.querySelector('a'); a && a.focus(); } else btn.focus();
  };
  btn.addEventListener('click', () => set(dr.hidden));
  dr.querySelectorAll('[data-menu-close]').forEach((b) => b.addEventListener('click', () => set(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dr.hidden) set(false); });
})();
