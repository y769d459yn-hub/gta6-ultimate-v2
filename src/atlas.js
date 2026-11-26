/* GTA 6 Facile — moteur de carte (tuiles néon GTADB, repères, regroupement, gestes, inertie).
   Coordonnées monde GTADB : x vers l'est, y vers le nord. Aucune dépendance (GSAP utilisé s'il est présent). */
(() => {
  'use strict';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
  const escH = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function Atlas(stage, o) {
    const ROOT = o.root || './';
    const T = o.tuiles; const C = o.carte;
    const g = window.gsap;
    const tilesEl = document.createElement('div'); tilesEl.className = 'at-tiles';
    const layer = document.createElement('div'); layer.className = 'at-layer';
    stage.append(tilesEl, layer);
    // sécurité pour les navigateurs sans overflow: clip : le calque des repères reste toujours calé sur la carte
    [tilesEl, layer].forEach((el) => el.addEventListener('scroll', () => { if (el.scrollLeft || el.scrollTop) { el.scrollLeft = 0; el.scrollTop = 0; } }));
    stage.style.background = T.fond;

    const B = C.bornes;
    const cam = { x: (B.ouest + B.est) / 2, y: (B.sud + B.nord) / 2, s: .04 };
    let W = 1, H = 1, sMin = .02, sMax = .75; // zoom maximum : au-delà, le niveau le plus détaillé deviendrait flou
    const pad = Object.assign({ top: 0, bottom: 0, left: 0, right: 0 }, o.pad || {});
    const st = { feats: (C.features || []).map((f) => ({ ...f.properties, x: f.geometry.coordinates[0], y: f.geometry.coordinates[1] })), commu: [], showCommu: !!o.communaute, filter: () => true, commuFilter: () => true, active: null };
    const cats = Object.fromEntries((C.categories || []).map((c) => [c.id, c]));

    // ---------- géométrie ----------
    function measure() {
      W = stage.clientWidth || 1; H = stage.clientHeight || 1; if (typeof sizeCanvas === 'function') sizeCanvas();
      const aw = W - pad.left - pad.right, ah = H - pad.top - pad.bottom;
      sMin = Math.min(aw / (B.est - B.ouest), ah / (B.nord - B.sud)) * (C.vueInitiale.zoomMin ? 1 : 1);
      sMax = .75;
    }
    const fx = () => pad.left + (W - pad.left - pad.right) / 2;
    const fy = () => pad.top + (H - pad.top - pad.bottom) / 2;
    const toScreen = (x, y) => [(x - cam.x) * cam.s + fx(), (cam.y - y) * cam.s + fy()];
    const toWorld = (sx, sy) => [(sx - fx()) / cam.s + cam.x, cam.y - (sy - fy()) / cam.s];
    function clamp() {
      cam.s = Math.min(Math.max(cam.s, sMin * .8), sMax);
      const mx = 1200, my = 1200;
      cam.x = Math.min(Math.max(cam.x, B.ouest - mx), B.est + mx);
      cam.y = Math.min(Math.max(cam.y, B.sud - my), B.nord + my);
    }

    // ---------- tuiles ----------
    // Images du fond (1024 px, ≈ 4 Mo chacune une fois décodée) : on n'en garde qu'un nombre limité.
    // Sans cette limite, chaque déplacement en ajoutait sans jamais les libérer, jusqu'à saturer la mémoire de Safari sur iPhone.
    const imgs = new Map(); let tick = 0;
    const VIDE = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    const levels = T.niveaux.map((n) => ({ z: n.z, set: new Set(n.tuiles) }));
    // Le fond est peint dans UN SEUL canvas (taille de l'écran) : avant, chaque morceau était une image séparée et agrandie,
    // et Safari sur iPhone réservait pour chacune une grande surface graphique, jusqu'à fermer la page.
    const cv = document.createElement('canvas'); cv.className = 'at-cv'; cv.setAttribute('aria-hidden', 'true'); tilesEl.appendChild(cv);
    const ctx = cv.getContext('2d', { alpha: false });
    const FONDU = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350;
    let cvR = 1, tr = 0;
    function sizeCanvas() { cvR = Math.min(devicePixelRatio || 1, 2); const w = Math.round(W * cvR), h = Math.round(H * cvR); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const reqTiles = () => { if (!tr) tr = requestAnimationFrame(() => { tr = 0; drawTiles(anim > 0); }); };
    function drawTiles(enVol) {
      tick++;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const want = Math.max(0, Math.min(levels.length - 1, Math.ceil(Math.log2(cam.s * dpr * T.monde / T.tileSize / 1) - 0.25)));
      const [wx0, wy1] = toWorld(0, 0), [wx1, wy0] = toWorld(W, H);
      const seen = new Set(), now = performance.now(); let fondu = false;
      ctx.setTransform(cvR, 0, 0, cvR, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = T.fond || '#5a85a3'; ctx.fillRect(0, 0, W, H);
      for (let L = Math.min(1, want); L <= want; L++) {
        if (L > 1 && L < want - 1) continue; // fond (niveau 1) + niveau courant et précédent
        const ppu = (1024 * 2 ** L) / T.monde, span = T.tileSize / ppu;
        if (L !== want && span * cam.s / T.tileSize > 2.2) continue; // niveau trop grossier à ce zoom : caché par le niveau détaillé
        const tx0 = Math.floor((wx0 + T.zero) / span), tx1 = Math.floor((wx1 + T.zero) / span);
        const ty0 = Math.floor((T.zero - wy1) / span), ty1 = Math.floor((T.zero - wy0) / span);
        for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
          const key = `${tx}_${ty}`;
          if (!levels[L].set.has(key)) continue;
          const id = `${L}/${key}`;
          let im = imgs.get(id);
          // pendant un déplacement automatique, pas de nouvelle image détaillée : elles se chargent à l'arrivée
          if (!im && enVol && L > 1) continue;
          seen.add(id);
          if (!im) {
            im = new Image(); im.decoding = 'async';
            im.onload = () => { im._ok = performance.now(); reqTiles(); };
            im.src = (window.LG_TILES && window.LG_TILES[id]) || `${ROOT}tiles/${L}/${key}.webp`; // LG_TILES : adresses de remplacement (aperçu)
            imgs.set(id, im);
          }
          im._vu = tick;
          if (!im._ok) continue;
          const [sx, sy] = toScreen(tx * span - T.zero, T.zero - ty * span), size = span * cam.s;
          const a = FONDU ? Math.min(1, (now - im._ok) / FONDU) : 1; if (a < 1) fondu = true;
          ctx.globalAlpha = a; ctx.drawImage(im, sx, sy, size + 1, size + 1);
        }
      }
      ctx.globalAlpha = 1;
      if (fondu) reqTiles();
      // au-delà de la limite, les images non affichées les plus anciennes sont libérées (elles restent dans le cache du navigateur, compressées)
      const max = Math.max(seen.size + 8, 28);
      if (imgs.size > max) {
        [...imgs].filter(([id]) => !seen.has(id)).sort((a, b) => a[1]._vu - b[1]._vu).slice(0, imgs.size - max)
          .forEach(([id, im]) => { im.onload = null; im.src = VIDE; imgs.delete(id); });
      }
    }

    // ---------- repères ----------
    let nodes = [], builtS = 0, builtKey = '';
    function build() {
      builtS = cam.s; layer.innerHTML = ''; nodes = [];
      const frag = document.createDocumentFragment();
      const add = (el, x, y) => { frag.appendChild(el); nodes.push({ el, x, y }); };
      // étiquettes de régions
      if (o.etiquettes !== false) (C.regions || []).forEach((r) => {
        if (!r.label) return;
        const el = document.createElement('button'); el.type = 'button'; el.className = 'at-lbl'; el.textContent = r.nom;
        el.style.setProperty('--c', r.couleur);
        el.addEventListener('click', (e) => { if (moved) return; e.stopPropagation(); o.onRegion && o.onRegion(r); });
        if (cam.s > .1) return;
        add(el, r.label[0], r.label[1]);
      });
      // couche communautaire (seulement à partir d'un certain zoom)
      if (st.showCommu && cam.s >= .07) {
        const [wx0, wy1] = toWorld(-40, -40), [wx1, wy0] = toWorld(W + 40, H + 40);
        const cell = cam.s >= .35 ? 0 : 26, grid = new Map();
        st.commu.forEach((p) => {
          if (p.x < wx0 || p.x > wx1 || p.y < wy0 || p.y > wy1 || !st.commuFilter(p)) return;
          const choisi = st.activeC === p.x + ':' + p.y;
          if (cell && !choisi) { const [sx, sy] = toScreen(p.x, p.y); const k = Math.floor(sx / cell) + ':' + Math.floor(sy / cell); if (grid.has(k)) return; grid.set(k, 1); }
          const el = document.createElement('button'); el.type = 'button'; el.className = 'at-c at-c--' + p.c + (p.d ? ' at-c--d' : '') + (choisi ? ' is-on' : '');
          el.setAttribute('aria-label', p.n);
          if (cam.s >= .45 || choisi) { el.classList.add('at-c--lbl'); el.innerHTML = `<span>${escH(p.n)}</span>`; }
          el.addEventListener('click', (e) => { if (moved) return; e.stopPropagation(); select({ ...p, commu: true }); });
          add(el, p.x, p.y);
        });
      }
      // repères du guide, regroupés en écran
      // 1) regroupement par proximité à l'écran ; 2) chaque groupe recentré sur ses membres ;
      // 3) deux groupes qui se toucheraient fusionnent (aucun repère n'est retiré, seulement regroupé)
      const R = 38, taille = (n) => (n === 1 ? 32 : Math.min(46, 32 + Math.sqrt(n) * 2));
      let cl = [];
      const vis = st.feats.filter((f) => !f.label && st.filter(f));
      const [vx0, vy1] = toWorld(-80, -80), [vx1, vy0] = toWorld(W + 80, H + 80); // hors écran : regroupé sans calcul fin
      vis.forEach((f) => {
        const [sx, sy] = toScreen(f.x, f.y);
        if (f.id === st.active) { cl.push({ sx, sy, m: [f], p: [[sx, sy]], solo: 1 }); return; }
        const loin = f.x < vx0 || f.x > vx1 || f.y < vy0 || f.y > vy1;
        const c = cl.find((c) => !c.solo && Math.hypot(c.sx - sx, c.sy - sy) < (loin ? R * 3 : R));
        if (c) { c.m.push(f); c.p.push([sx, sy]); } else cl.push({ sx, sy, m: [f], p: [[sx, sy]] });
      });
      const centre = (c) => { c.sx = c.p.reduce((t, q) => t + q[0], 0) / c.p.length; c.sy = c.p.reduce((t, q) => t + q[1], 0) / c.p.length; };
      cl.forEach(centre);
      for (let pass = 0, chg = true; chg && pass < 8; pass++) {
        chg = false;
        for (let i = 0; i < cl.length; i++) {
          const a = cl[i]; if (!a || a.solo) continue;
          for (let j = i + 1; j < cl.length; j++) {
            const b = cl[j]; if (!b || b.solo) continue;
            if (Math.hypot(a.sx - b.sx, a.sy - b.sy) < (taille(a.m.length) + taille(b.m.length)) / 2 + 4) { a.m.push(...b.m); a.p.push(...b.p); centre(a); cl[j] = null; chg = true; }
          }
        }
        cl = cl.filter(Boolean);
      }
      cl.forEach((c, i) => {
        const el = document.createElement('button'); el.type = 'button';
        const x = c.m.reduce((s, a) => s + a.x, 0) / c.m.length, y = c.m.reduce((s, a) => s + a.y, 0) / c.m.length;
        if (c.m.length === 1) {
          const f = c.m[0], col = (cats[f.cat] || {}).color || '#ff2bd6';
          el.className = 'at-dot' + (f.statut !== 'teste' ? ' at-dot--approx' : '') + (f.fi === 'approx' ? ' at-dot--zone' : '') + (f.id === st.active ? ' is-on' : '') + (st.found && st.found.has(f.id) ? ' is-found' : '') + (f.id === st.active ? ' is-spot' : '');
          const icn = window.LG && window.LG.ic ? window.LG.ic(f.icon) : '';
          el.innerHTML = `${f.id === st.active ? '<span class="at-beam" aria-hidden="true"></span>' : ''}<span class="at-dot-i">${icn}</span>${st.found && st.found.has(f.id) ? '<span class="at-dot-ok" aria-hidden="true"></span>' : ''}${st.badge && st.badge(f) ? `<span class="at-dot-b" aria-hidden="true">${escH(st.badge(f))}</span>` : ''}`;
          c.el = el; c.f = f;
          el.style.setProperty('--c', col); el.style.setProperty('--d', (i % 7) * .35 + 's');
          el.setAttribute('aria-label', `${f.nom} (${(cats[f.cat] || {}).nom || ''})`);
          el.dataset.id = f.id;
          el.addEventListener('click', (e) => { if (moved) return; e.stopPropagation(); select(f); });
        } else {
          const by = {}; c.m.forEach((f) => { by[f.cat] = (by[f.cat] || 0) + 1; });
          const parts = Object.entries(by).sort((a, b) => b[1] - a[1]);
          let acc = 0; const stops = parts.map(([k, n]) => { const a0 = acc; acc += n / c.m.length * 360; return `${(cats[k] || {}).color || '#ff2bd6'} ${a0}deg ${acc}deg`; });
          el.className = 'at-cl' + (parts.length > 1 ? ' at-cl--mix' : ''); el.innerHTML = `<b>${c.m.length > 999 ? '999+' : c.m.length}</b>`;
          el.style.setProperty('--ring', `conic-gradient(${stops.join(',')})`);
          el.style.setProperty('--c', (cats[parts[0][0]] || {}).color || '#ff2bd6');
          el.style.setProperty('--sz', taille(c.m.length) + 'px');
          el.setAttribute('aria-label', `${c.m.length} repères ici (${parts.map(([k, n]) => `${n} ${((cats[k] || {}).nom || k).toLowerCase()}`).join(', ')}) : toucher pour zoomer`);
          // repères trop proches pour être séparés même au zoom maximum : la liste s'ouvre au lieu de zoomer
          const xs = c.m.map((f) => f.x), ys = c.m.map((f) => f.y);
          const serres = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * sMax < 30;
          el.addEventListener('click', (e) => { if (moved) return; e.stopPropagation(); if ((serres || cam.s >= sMax * .97) && o.onCluster) o.onCluster(c.m); else fit(c.m, 2.6, 4); });
        }
        add(el, x, y);
      });
      // noms : celui du repère choisi toujours ; les autres seulement au zoom proche et s'ils ne chevauchent rien
      const boites = cl.map((c) => { const r = taille(c.m.length) / 2 + 2; return [c.sx - r, c.sy - r, c.sx + r, c.sy + r, c]; });
      const prises = [], coupe = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      const cand = cl.filter((c) => c.f && (c.f.id === st.active || (cam.s >= .26 && c.sx > 60 && c.sx < W - 70 && c.sy > pad.top && c.sy < H - 40)))
        .sort((a, b) => (b.f.id === st.active) - (a.f.id === st.active) || (a.f.src === 'ogm') - (b.f.src === 'ogm') || (!!b.f.rar) - (!!a.f.rar));
      for (const c of cand) {
        const actif = c.f.id === st.active; if (!actif && prises.length >= 28) break;
        const w = Math.min(actif ? 220 : 170, c.f.nom.length * 6.8 + 18), h = actif ? 26 : 22, y0 = c.sy + (actif ? 25 : 17) - h / 2 + 11;
        const bx = [c.sx - w / 2, y0, c.sx + w / 2, y0 + h];
        if (!actif && (prises.some((q) => coupe(q, bx)) || boites.some((q) => q[4] !== c && coupe(q, bx)))) continue;
        prises.push(bx);
        const n = document.createElement('b'); n.className = 'at-dot-n'; n.textContent = c.f.nom; c.el.appendChild(n); c.el.classList.add('at-dot--lbl');
      }
      layer.appendChild(frag);
      place();
    }
    function place() { for (const n of nodes) { const [sx, sy] = toScreen(n.x, n.y); n.el.style.transform = `translate3d(${sx}px,${sy}px,0)`; } }
    let lastCenter = '';
    function render(force) {
      clamp(); drawTiles(anim > 0);
      const key = st.showCommu && cam.s >= .07 ? Math.round(cam.x / (W / cam.s / 3)) + ':' + Math.round(cam.y / (H / cam.s / 3)) : '';
      const busy = pts.size > 0 || wheeling || anim > 0;
      if (force || !builtS || (!busy && (Math.abs(Math.log(cam.s / builtS)) > .1 || key !== lastCenter))) { lastCenter = key; build(); } else place();
      o.onView && o.onView(cam);
    }
    let raf = 0; const req = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

    // ---------- caméra ----------
    let tw = null, anim = 0;
    function stop() { const k = !!tw; if (tw) tw.kill(); tw = null; anim = 0; return k; }
    function flyTo(x, y, s = cam.s, dur = .9) {
      s = Math.min(Math.max(s, sMin * .8), sMax);
      if (!g || reduce()) { Object.assign(cam, { x, y, s }); return render(true); }
      stop();
      const s0 = cam.s;
      const p = { t: 0 }, x0 = cam.x, y0 = cam.y;
      anim++;
      tw = g.to(p, { t: 1, duration: dur, ease: 'expo.out', onUpdate: () => { cam.x = x0 + (x - x0) * p.t; cam.y = y0 + (y - y0) * p.t; cam.s = s0 * Math.pow(s / s0, p.t); render(); }, onComplete: () => { anim = 0; tw = null; render(true); } });
    }
    function zoomAt(sx, sy, f) {
      const [mx, my] = toWorld(sx, sy); const ns = Math.min(Math.max(cam.s * f, sMin * .8), sMax);
      flyTo(mx - (sx - fx()) / ns, my + (sy - fy()) / ns, ns, .6);
    }
    function fit(list, extra = 1.4, maxF = 0) {
      const xs = list.map((f) => f.x), ys = list.map((f) => f.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const aw = W - pad.left - pad.right, ah = H - pad.top - pad.bottom;
      const s = Math.min(aw / Math.max((x1 - x0) * extra, 300), ah / Math.max((y1 - y0) * extra, 300));
      flyTo((x0 + x1) / 2, (y0 + y1) / 2, maxF ? Math.min(Math.max(s, cam.s * 1.5), cam.s * maxF) : Math.max(s, cam.s * 1.5), .7);
    }
    function reset() { flyTo(C.vueInitiale.centre[0], C.vueInitiale.centre[1], sMin); }
    function select(f, opts = {}) {
      st.active = f.commu ? null : f.id; st.activeC = f.commu ? f.x + ':' + f.y : null;
      if (opts.fly) flyTo(f.x, f.y, Math.max(cam.s, opts.s || .3)); else render(true);
      o.onSelect && o.onSelect(f, opts);
    }

    // ---------- gestes ----------
    let moved = false, armed = false, wheeling = false, stopped = false;
    const pts = new Map(); let start = null, pinch = null, vel = { x: 0, y: 0, t: 0, px: 0, py: 0 };
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (stop()) stopped = true; armed = true; moved = false;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, id: e.pointerId }; vel = { x: 0, y: 0, t: performance.now(), px: e.clientX, py: e.clientY }; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], r = stage.getBoundingClientRect();
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s, m: toWorld((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top) }; moved = true;
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = stage.getBoundingClientRect();
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        cam.s = Math.min(Math.max(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, sMin * .8), sMax);
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        cam.x = pinch.m[0] - (mx - fx()) / cam.s; cam.y = pinch.m[1] + (my - fy()) / cam.s; req();
      } else if (start && e.pointerId === start.id) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) > 5) { moved = true; stage.classList.add('is-drag'); try { stage.setPointerCapture(e.pointerId); } catch (err) { /* */ } }
        if (moved) {
          cam.x = start.cx - dx / cam.s; cam.y = start.cy + dy / cam.s; req();
          const now = performance.now(), dt = Math.max(now - vel.t, 1);
          vel = { x: (e.clientX - vel.px) / dt, y: (e.clientY - vel.py) / dt, t: now, px: e.clientX, py: e.clientY };
        }
      }
    });
    const up = (e) => {
      const pan = pts.size === 1 && moved && start;
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (!pts.size) {
        stage.classList.remove('is-drag');
        if (pan && g && !reduce() && performance.now() - vel.t < 80) {
          const p = { t: 0 }, x0 = cam.x, y0 = cam.y, tx = -vel.x * 280 / cam.s, ty = vel.y * 280 / cam.s;
          anim++;
          tw = g.to(p, { t: 1, duration: 1, ease: 'power3.out', onUpdate: () => { cam.x = x0 + tx * p.t; cam.y = y0 + ty * p.t; render(); }, onComplete: () => { anim = 0; tw = null; render(true); } });
        } else if (moved) render(true);
        else if (stopped) setTimeout(() => render(true), 0); // après le clic éventuel sur un repère
        stopped = false;
        start = null; setTimeout(() => { moved = false; }, 0);
      } else if (pts.size === 1) { const [id, p] = [...pts.entries()][0]; start = { x: p.x, y: p.y, cx: cam.x, cy: cam.y, id }; }
    };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('click', (e) => { if (!moved && !e.target.closest('.at-dot,.at-cl,.at-c,.at-lbl')) o.onBlank && o.onBlank(); });
    stage.addEventListener('pointerleave', () => { if (!pts.size && o.wheelNeedsArm) armed = false; });
    stage.addEventListener('wheel', (e) => {
      if (o.wheelNeedsArm && !(e.ctrlKey || e.metaKey || armed)) { o.onWheelHint && o.onWheelHint(); return; }
      e.preventDefault(); stop(); wheeling = true;
      const r = stage.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const [mx, my] = toWorld(sx, sy);
      cam.s = Math.min(Math.max(cam.s * Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0022)), sMin * .8), sMax);
      cam.x = mx - (sx - fx()) / cam.s; cam.y = my + (sy - fy()) / cam.s; req();
      clearTimeout(stage._wt); stage._wt = setTimeout(() => { wheeling = false; render(true); }, 160);
    }, { passive: false });
    stage.addEventListener('dblclick', (e) => { const r = stage.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, 2.2); });
    stage.addEventListener('keydown', (e) => {
      const d = 90 / cam.s, m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] };
      if (m[e.key]) { e.preventDefault(); flyTo(cam.x + m[e.key][0], cam.y + m[e.key][1], cam.s, .45); }
      if (e.key === '+' || e.key === '=') zoomAt(fx(), fy(), 1.8);
      if (e.key === '-') zoomAt(fx(), fy(), 1 / 1.8);
    });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const k = cam.s / sMin; measure(); cam.s = sMin * k; render(true); }, 120); });

    measure();
    cam.x = C.vueInitiale.centre[0]; cam.y = C.vueInitiale.centre[1]; cam.s = sMin;
    render(true);

    return {
      cam, render, flyTo, fit, reset, select, zoomAt,
      zoomIn: () => zoomAt(fx(), fy(), 1.8), zoomOut: () => zoomAt(fx(), fy(), 1 / 1.8),
      setPad(p) { Object.assign(pad, p); measure(); render(true); },
      setFilter(fn) { st.filter = fn; render(true); },
      setCommu(list) { st.commu = list; render(true); },
      showCommu(on) { st.showCommu = on; render(true); },
      setCommuFilter(fn) { st.commuFilter = fn; render(true); },
      clearActive() { st.active = null; st.activeC = null; render(true); },
      markFound(set) { st.found = set; render(true); },
      setBadge(fn) { st.badge = fn; render(true); },
      spot(on) { if (!!st.spot === !!on) return; st.spot = !!on; layer.classList.toggle('has-spot', !!on); render(true); },
      feats: () => st.feats, nodes: () => nodes, layer, stage, toScreen,
      inView() {
        const [x0, y1] = toWorld(pad.left, pad.top), [x1, y0] = toWorld(W - pad.right, H - pad.bottom);
        return st.feats.filter((f) => !f.label && st.filter(f) && f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1);
      },
      active: () => st.active,
      vue: () => ({ x: cam.x, y: cam.y, s: cam.s }),
      setVue(v) { stop(); Object.assign(cam, v); measure(); render(true); },
      measure() { measure(); render(true); }
    };
  }
  window.Atlas = Atlas;
})();
