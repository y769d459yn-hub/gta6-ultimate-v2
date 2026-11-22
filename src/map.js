/* Leonida Guide — carte interactive (SVG + repères HTML, données JSON) */
(() => {
  'use strict';
  const page = document.querySelector('[data-map]');
  if (!page) return;
  const $ = (s, c = page) => c.querySelector(s);
  const $$ = (s, c = page) => [...c.querySelectorAll(s)];
  const LG = window.LG;
  const { ROOT, ic, norm, tokMatch } = LG;
  const escH = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUT = { confirme: ['Confirmé', 'check'], 'a-verifier': ['À vérifier', 'question'], provisoire: ['Provisoire', 'clock'] };
  const badge = (s) => { const b = STATUT[s] || STATUT['a-verifier']; return `<span class="badge b-${s}">${ic(b[1])}${b[0]}</span>`; };

  const stage = $('.map-stage'), svg = $('.map-svg'), layer = $('.map-layer'), top = $('.map-top');
  const detail = $('[data-detail]'), filters = $('[data-filters]');
  let D, feats = [], CAT = {}, REG = {};
  let topOff = 0, W = 0, H = 0, k = 1, cx = 0, cy = 0, kMin = 1, kMax = 8, fx = 0, fy = 0;
  let VX, VY, VW, VH;
  const state = { cats: new Set(), sous: '', region: '', verified: false, active: null };

  fetch(ROOT + 'data/carte.json').then((r) => r.json()).then(init).catch(() => { layer.innerHTML = '<p class="wrap">Carte indisponible pour le moment.</p>'; });

  function init(data) {
    D = data; feats = data.features.map((f) => ({ ...f.properties, x: f.geometry.coordinates[0], y: f.geometry.coordinates[1] }));
    [VX, VY, VW, VH] = data.viewBox;
    data.categories.forEach((c) => { CAT[c.id] = c; });
    data.regions.forEach((r) => { REG[r.id] = r; });
    svg.setAttribute('preserveAspectRatio', 'none');

    const q = new URLSearchParams(location.search);
    const onlyCat = q.get('cat');
    data.categories.forEach((c) => { if (!onlyCat || onlyCat === c.id) state.cats.add(c.id); });
    if (q.get('region') && REG[q.get('region')]) state.region = q.get('region');

    measure(); k = kMin; cx = VX + VW / 2; cy = VY + VH / 2;
    syncUI(); rebuild(); view();

    const focus = q.get('focus');
    if (focus) { const f = feats.find((x) => x.id === focus); if (f) setTimeout(() => focusFeature(f, true), 250); }
    else if (state.region) setTimeout(() => zoomRegion(state.region), 250);

    bind();
    if (window.gsap && !LG.reduceMotion()) {
      gsap.from('.mcat', { y: -12, opacity: 0, duration: .5, stagger: .06, ease: 'back.out(2)' });
      gsap.from(svg, { scale: 1.06, opacity: 0, duration: 1, ease: 'expo.out', transformOrigin: '50% 50%' });
    }
  }

  // ---------- géométrie ----------
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    topOff = Math.min(top.getBoundingClientRect().bottom - stage.getBoundingClientRect().top + 8, H * .45);
    const botOff = innerWidth < 900 ? 96 : 20;
    topOff = Math.max(topOff, 0);
    const availH = Math.max(H - topOff - botOff, H * .4);
    fx = W / 2; fy = topOff + availH / 2;
    kMin = Math.min(W / VW, availH / VH) * .96;
    kMax = kMin * 9;
  }
  const toScreen = (x, y) => [(x - cx) * k + fx, (y - cy) * k + fy];
  const toMap = (sx, sy) => [(sx - fx) / k + cx, (sy - fy) / k + cy];
  function clamp() {
    k = Math.min(Math.max(k, kMin), kMax);
    const m = 60 / k;
    cx = Math.min(Math.max(cx, VX - m), VX + VW + m);
    cy = Math.min(Math.max(cy, VY - m), VY + VH + m);
  }
  let lastK = 0, rafV = 0;
  function view() {
    clamp();
    const [x0, y0] = toMap(0, 0);
    svg.setAttribute('viewBox', `${x0} ${y0} ${W / k} ${H / k}`);
    if (Math.abs(Math.log(k / (lastK || 1))) > .06) rebuild();
    for (const n of nodes) { const [sx, sy] = toScreen(n.x, n.y); n.el.style.transform = `translate3d(${sx}px,${sy}px,0)`; }
  }
  const req = () => { if (!rafV) rafV = requestAnimationFrame(() => { rafV = 0; view(); }); };

  // ---------- filtres ----------
  function visible() {
    return feats.filter((f) => !f.label && state.cats.has(f.cat)
      && (!state.sous || f.sous === state.sous)
      && (!state.region || f.region === state.region)
      && (!state.verified || f.statut === 'confirme'));
  }

  // ---------- rendu des repères (regroupement en écran) ----------
  let nodes = [];
  function rebuild() {
    lastK = k;
    layer.innerHTML = ''; nodes = [];
    const frag = document.createDocumentFragment();
    D.regions.forEach((r) => {
      if (state.region && state.region !== r.id) return;
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'map-label'; el.textContent = r.nom; el.style.left = '0'; el.style.top = '0';
      el.addEventListener('click', (e) => { if (moved) return; e.stopPropagation(); openRegion(r.id); });
      frag.appendChild(el); nodes.push({ el, x: r.label[0], y: r.label[1] });
    });
    const vis = visible();
    const R = 40 / k; const clusters = [];
    for (const f of vis) {
      if (f.id === state.active) { clusters.push({ x: f.x, y: f.y, m: [f], solo: true }); continue; }
      const c = clusters.find((c) => !c.solo && Math.hypot(c.x - f.x, c.y - f.y) < R) || null;
      if (c) { c.m.push(f); c.x = c.m.reduce((s, a) => s + a.x, 0) / c.m.length; c.y = c.m.reduce((s, a) => s + a.y, 0) / c.m.length; }
      else clusters.push({ x: f.x, y: f.y, m: [f] });
    }
    for (const c of clusters) {
      const el = document.createElement('button'); el.type = 'button'; el.style.left = '0'; el.style.top = '0';
      if (c.m.length === 1) {
        const f = c.m[0];
        el.className = 'mk' + (f.precision === 'region' ? ' mk--approx' : '') + (state.active === f.id ? ' is-active' : '');
        el.style.setProperty('--c', CAT[f.cat].color);
        el.setAttribute('aria-label', `${f.nom}, ${CAT[f.cat].nom}`);
        el.dataset.id = f.id;
        el.innerHTML = `<span class="mk-pin">${ic(f.icon)}</span>`;
        el.addEventListener('click', (e) => { if (moved) return; e.stopPropagation(); openFeature(f); });
      } else {
        el.className = 'mk-cluster';
        el.setAttribute('aria-label', `${c.m.length} repères, zoomer`);
        el.textContent = c.m.length;
        el.addEventListener('click', (e) => { if (moved) return; e.stopPropagation(); zoomTo(c.m); });
      }
      frag.appendChild(el); nodes.push({ el, x: c.x, y: c.y });
    }
    layer.appendChild(frag);
    $$('.reg', svg).forEach((p) => p.classList.toggle('is-on', !!state.region && p.dataset.region === state.region));
  }

  // ---------- animations de vue ----------
  let tw = 0;
  function animateTo(nx, ny, nk, dur = 520) {
    cancelAnimationFrame(tw);
    nk = Math.min(Math.max(nk, kMin), kMax);
    if (LG.reduceMotion()) { cx = nx; cy = ny; k = nk; return view(); }
    const sx = cx, sy = cy, sk = k, t0 = performance.now();
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      cx = sx + (nx - sx) * e; cy = sy + (ny - sy) * e; k = sk * Math.pow(nk / sk, e);
      view(); if (p < 1) tw = requestAnimationFrame(step);
    };
    tw = requestAnimationFrame(step);
  }
  function zoomAt(sx, sy, factor) {
    const [mx, my] = toMap(sx, sy);
    const nk = Math.min(Math.max(k * factor, kMin), kMax);
    animateTo(mx - (sx - fx) / nk, my - (sy - fy) / nk, nk, 360);
  }
  function zoomTo(list, pad = 1) {
    const xs = list.map((f) => f.x), ys = list.map((f) => f.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const bw = Math.max(x1 - x0, 60) * 1.6 * pad, bh = Math.max(y1 - y0, 60) * 1.6 * pad;
    const avail = (H - (fy - (H - fy))) || H;
    const nk = Math.min(W / bw, Math.min(H, avail) / bh, kMax);
    animateTo((x0 + x1) / 2, (y0 + y1) / 2, Math.max(nk, k * 1.6));
  }
  function zoomRegion(id) {
    const list = feats.filter((f) => f.region === id);
    const r = REG[id];
    if (r) list.push({ x: r.label[0], y: r.label[1] });
    if (list.length) zoomTo(list, 1.4);
  }

  // ---------- panneaux ----------
  function showSheet(el) {
    el.hidden = false; page.classList.add('has-sheet');
    if (window.gsap && !LG.reduceMotion()) gsap.fromTo(el, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'expo.out' });
  }
  function closeDetail() { detail.hidden = true; if (filters.hidden) page.classList.remove('has-sheet'); const had = state.active; state.active = null; if (had) { lastK = 0; req(); } $$('.mk.is-active', layer).forEach((m) => m.classList.remove('is-active')); }
  function openFeature(f) {
    filters.hidden = true;
    state.active = f.id;
    $$('.mk', layer).forEach((m) => m.classList.toggle('is-active', m.dataset.id === f.id));
    const c = CAT[f.cat]; const r = REG[f.region];
    const favType = f.cat === 'vehicules' ? 'vehicule' : 'lieu';
    const favId = f.cat === 'vehicules' ? f.id.replace(/^v-/, '') : f.id;
    const fav = { id: favId, type: favType, t: f.nom, u: f.cat === 'vehicules' ? f.url : `carte/?focus=${f.id}`, i: f.icon, c: c.color };
    const warn = f.precision === 'region' ? 'Emplacement à confirmer' : f.precision === 'zone' ? 'Zone approximative' : '';
    detail.innerHTML = `<div class="sheet-grip"></div><div class="det" style="--c:${c.color}">
      <span class="mini-ico">${ic(f.icon)}</span>
      <div><span class="det-k">${escH(c.nom)}</span><h2>${escH(f.nom)}</h2></div>
      <button class="ibtn" type="button" data-close-detail aria-label="Fermer">${ic('x')}</button>
    </div>
    <div class="det" style="--c:${c.color};display:block">
      <div class="det-tags">${badge(f.statut)}${r ? `<span class="pill">${ic('pin')}${escH(r.nom)}</span>` : ''}${warn ? `<span class="pill pill--warn" title="${f.precision === 'region' ? 'Repère placé dans sa région, position exacte non vérifiée' : 'Carte schématique'}">${ic('question')}${warn}</span>` : ''}</div>
      <p>${escH(f.desc || '')}</p>
      <div class="det-act">
        <a class="btn btn--primary" href="${ROOT}${f.url}">${ic('arrow-right')}Voir la fiche</a>
        <button class="ibtn fav fav--icon" type="button" data-fav='${escH(JSON.stringify(fav))}' aria-pressed="false" aria-label="Ajouter aux favoris">${ic('heart')}</button>
      </div>
    </div>`;
    $('[data-close-detail]', detail).addEventListener('click', closeDetail);
    LG.syncFavs();
    showSheet(detail);
    ensureVisible(f);
  }
  // Recentre le repère dans la zone visible (entre l'interface du haut et le panneau)
  function ensureVisible(f, nk = k) {
    const st = stage.getBoundingClientRect();
    const desk = innerWidth >= 900;
    const sheetTop = desk ? H : detail.getBoundingClientRect().top - st.top;
    const topNow = Math.max(top.getBoundingClientRect().bottom - st.top + 8, 0);
    const tx = desk ? (W - 400) / 2 : W / 2;
    const ty = desk ? fy : (topNow + sheetTop) / 2 + 20;
    const [sx, sy] = [(f.x - cx) * nk + fx, (f.y - cy) * nk + fy];
    const inside = sx > 40 && sx < (desk ? W - 420 : W - 40) && sy > topNow + 50 && sy < sheetTop - 10;
    if (inside && nk === k) return;
    animateTo(f.x - (tx - fx) / nk, f.y - (ty - fy) / nk, nk);
  }
  function openRegion(id) {
    const r = REG[id]; if (!r) return;
    filters.hidden = true; state.active = null;
    const list = feats.filter((f) => f.region === id && !f.label);
    const by = {}; list.forEach((f) => { by[f.cat] = (by[f.cat] || 0) + 1; });
    detail.innerHTML = `<div class="sheet-grip"></div><div class="det" style="--c:${r.color}">
      <span class="mini-ico">${ic('map')}</span><div><span class="det-k">Région</span><h2>${escH(r.nom)}</h2></div>
      <button class="ibtn" type="button" data-close-detail aria-label="Fermer">${ic('x')}</button></div>
      <div class="det-tags">${Object.entries(by).map(([c, n]) => `<span class="pill" style="color:${CAT[c].color}">${ic(CAT[c].icon)}${n} ${escH(CAT[c].nom.toLowerCase())}</span>`).join('') || '<span class="pill">Aucun repère pour l’instant</span>'}</div>
      <div class="det-act">
        <button class="btn btn--primary" type="button" data-region-only>${ic('locate')}Voir seulement cette région</button>
        <a class="btn" href="${ROOT}encyclopedie/${id}/">${ic('book')}La fiche</a>
      </div>`;
    $('[data-close-detail]', detail).addEventListener('click', closeDetail);
    $('[data-region-only]', detail).addEventListener('click', () => { state.region = id; syncUI(); rebuild(); view(); zoomRegion(id); closeDetail(); });
    showSheet(detail);
  }
  function focusFeature(f, fromUrl) {
    if (f.label) { state.region = ''; syncUI(); rebuild(); view(); zoomRegion(f.id); return setTimeout(() => openRegion(f.id), 400); }
    if (!state.cats.has(f.cat)) state.cats.add(f.cat);
    if (state.region && state.region !== f.region) state.region = '';
    if (state.sous && state.sous !== f.sous) state.sous = '';
    if (state.verified && f.statut !== 'confirme') state.verified = false;
    syncUI(); rebuild(); view();
    const nk = Math.max(k, kMin * 4.5);
    state.active = f.id; rebuild();
    openFeature(f);
    ensureVisible(f, Math.min(nk, kMax));
    setTimeout(() => {
      const m = $(`.mk[data-id="${CSS.escape(f.id)}"]`, layer);
      if (m) { m.classList.add('is-active', 'is-hit'); setTimeout(() => m.classList.remove('is-hit'), 2600); }
    }, 600);
  }

  // ---------- UI filtres ----------
  function syncUI() {
    $$('[data-mcat]').forEach((b) => b.setAttribute('aria-pressed', state.cats.has(b.dataset.mcat)));
    const base = feats.filter((f) => !f.label && (!state.region || f.region === state.region) && (!state.verified || f.statut === 'confirme'));
    $$('[data-mcount]').forEach((s) => { s.textContent = base.filter((f) => f.cat === s.dataset.mcount).length; });
    const sousWrap = $('[data-sous]');
    const only = state.cats.size === 1 ? [...state.cats][0] : null;
    const opts = only && D.sousTypes[only] ? D.sousTypes[only].filter((o) => feats.some((f) => f.cat === only && f.sous === o.id)) : [];
    sousWrap.innerHTML = opts.length
      ? `<button class="chip" type="button" data-s="" aria-pressed="${!state.sous}">Tous</button>` + opts.map((o) => `<button class="chip" type="button" data-s="${o.id}" aria-pressed="${state.sous === o.id}">${escH(o.nom)}</button>`).join('')
      : `<p class="muted small">${ic('info')}Choisis une seule catégorie pour l'affiner.</p>`;
    $$('[data-s]', sousWrap).forEach((b) => b.addEventListener('click', () => { state.sous = b.dataset.s; syncUI(); rebuild(); view(); }));
    $$('[data-reg]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.reg === state.region));
    $('[data-verified]').checked = state.verified;
    $('[data-filter-dot]').hidden = !(state.sous || state.region || state.verified);
    const u = new URL(location.href);
    state.region ? u.searchParams.set('region', state.region) : u.searchParams.delete('region');
    state.cats.size === 1 ? u.searchParams.set('cat', [...state.cats][0]) : u.searchParams.delete('cat');
    u.searchParams.delete('focus');
    history.replaceState(null, '', u);
  }

  // ---------- recherche sur la carte ----------
  function mapSearch(q) {
    const qn = norm(q); if (!qn) return [];
    const toks = qn.split(' ').filter(Boolean);
    return feats.map((f) => {
      const words = norm(`${f.nom} ${CAT[f.cat].nom} ${REG[f.region] ? REG[f.region].nom : ''} ${f.desc || ''}`).split(' ');
      const nameW = norm(f.nom).split(' ');
      let s = 0, hit = 0;
      toks.forEach((t) => { const m = Math.max(tokMatch(t, nameW) * 2, tokMatch(t, words)); s += m; if (m) hit++; });
      return { f, s: hit === toks.length ? s : 0 };
    }).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 6).map((r) => r.f);
  }

  // ---------- événements ----------
  let moved = false;
  function bind() {
    const pts = new Map(); let start = null, pinch = null;
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      cancelAnimationFrame(tw);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pts.size === 1) start = { x: e.clientX, y: e.clientY, cx, cy, id: e.pointerId };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const rect = stage.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k, m: toMap(mx, my) };
        moved = true;
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rect = stage.getBoundingClientRect();
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        k = pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; clamp();
        const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
        cx = pinch.m[0] - (mx - fx) / k; cy = pinch.m[1] - (my - fy) / k;
        req();
      } else if (start && e.pointerId === start.id) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) > 6) { moved = true; stage.classList.add('is-drag'); try { stage.setPointerCapture(e.pointerId); } catch (err) { /* */ } }
        if (moved) { cx = start.cx - dx / k; cy = start.cy - dy / k; req(); }
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const [id, p] = [...pts.entries()][0]; start = { x: p.x, y: p.y, cx, cy, id }; }
      if (!pts.size) { start = null; stage.classList.remove('is-drag'); setTimeout(() => { moved = false; }, 0); }
    };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('click', (e) => { if (!moved && !e.target.closest('.mk,.mk-cluster,.map-label')) { closeDetail(); filters.hidden = true; } });
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018));
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const [mx, my] = toMap(sx, sy);
      k = Math.min(Math.max(k * f, kMin), kMax);
      cx = mx - (sx - fx) / k; cy = my - (sy - fy) / k; req();
    }, { passive: false });
    stage.addEventListener('dblclick', (e) => { const rect = stage.getBoundingClientRect(); zoomAt(e.clientX - rect.left, e.clientY - rect.top, 2); });
    stage.addEventListener('keydown', (e) => {
      const s = 60 / k;
      const map = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] };
      if (map[e.key]) { e.preventDefault(); animateTo(cx + map[e.key][0], cy + map[e.key][1], k, 200); }
      if (e.key === '+' || e.key === '=') zoomAt(fx, fy, 1.6);
      if (e.key === '-') zoomAt(fx, fy, 1 / 1.6);
    });
    $$('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
      const z = b.dataset.zoom;
      if (z === 'in') zoomAt(fx, fy, 1.7); else if (z === 'out') zoomAt(fx, fy, 1 / 1.7);
      else { state.region = ''; syncUI(); rebuild(); animateTo(VX + VW / 2, VY + VH / 2, kMin); }
    }));
    $$('[data-mcat]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.mcat; const all = state.cats.size === D.categories.length;
      if (all) { state.cats.clear(); state.cats.add(id); }
      else if (state.cats.has(id)) { state.cats.delete(id); if (!state.cats.size) D.categories.forEach((c) => state.cats.add(c.id)); }
      else state.cats.add(id);
      state.sous = ''; closeDetail(); syncUI(); rebuild(); view();
      if (window.gsap && !LG.reduceMotion()) gsap.from('.mk, .mk-cluster', { scale: 0, duration: .35, stagger: .015, ease: 'back.out(2.5)' });
    }));
    const fBtn = $('[data-open-filters]');
    fBtn.addEventListener('click', () => { const open = filters.hidden; closeDetail(); filters.hidden = !open; fBtn.setAttribute('aria-expanded', open); if (open) showSheet(filters); });
    $('[data-close-filters]').addEventListener('click', () => { filters.hidden = true; page.classList.remove('has-sheet'); fBtn.setAttribute('aria-expanded', 'false'); });
    $$('[data-reg]').forEach((b) => b.addEventListener('click', () => {
      state.region = b.dataset.reg; syncUI(); rebuild(); view();
      if (state.region) zoomRegion(state.region); else animateTo(VX + VW / 2, VY + VH / 2, kMin);
    }));
    $('[data-verified]').addEventListener('change', (e) => {
      state.verified = e.target.checked; syncUI(); rebuild(); view();
      if (state.verified && !visible().length) LG.toast('Aucune position vérifiée dans ce filtre pour l’instant', 'info');
    });
    // recherche
    const input = $('[data-map-search]'), sugg = $('#map-sugg');
    let res = [], sel = 0;
    const draw = () => {
      res = mapSearch(input.value); sel = 0;
      sugg.hidden = !input.value.trim();
      sugg.innerHTML = res.length ? res.map((f, i) => `<button type="button" role="option" data-i="${i}" aria-selected="${i === 0}"><span class="mini-ico" style="--c:${CAT[f.cat].color};color:${CAT[f.cat].color}">${ic(f.icon)}</span><span>${escH(f.nom)}<small>${escH(CAT[f.cat].nom)}${REG[f.region] ? ' · ' + escH(REG[f.region].nom) : ''}</small></span></button>`).join('') : `<p class="muted small" style="margin:8px">${ic('question')}Essaie un autre mot</p>`;
      $$('[data-i]', sugg).forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
    };
    const pick = (i) => { const f = res[i]; if (!f) return; sugg.hidden = true; input.blur(); focusFeature(f); };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(res.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); $$('[data-i]', sugg).forEach((b, i) => b.setAttribute('aria-selected', i === sel)); }
      if (e.key === 'Escape') { input.value = ''; sugg.hidden = true; }
    });
    input.addEventListener('blur', () => setTimeout(() => { sugg.hidden = true; }, 180));
    input.addEventListener('focus', () => { if (input.value.trim()) draw(); });
    // redimensionnement
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const ok = k / kMin; measure(); k = kMin * ok; lastK = 0; view(); }, 120); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDetail(); filters.hidden = true; } });
  }
})();
