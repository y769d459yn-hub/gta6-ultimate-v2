/* Leonida Guide — accueil v2 : animations GSAP (SplitText, DrawSVG, ScrollTrigger) + carte interactive */
(() => {
  'use strict';
  const html = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const LG = window.LG || {};
  const ROOT = document.body.dataset.root || './';
  const g = window.gsap;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || html.dataset.motion === 'off';
  const ic = (n) => (LG.ic ? LG.ic(n) : '');
  const escH = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  if (!g || reduce) html.classList.add('no-anim');
  if (g) {
    const plugins = [window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin].filter(Boolean);
    g.registerPlugin(...plugins);
  }

  // ---------- en-tête : passe en verre au défilement ----------
  const top = $('.top');
  const onScroll = () => top && top.classList.toggle('is-scrolled', scrollY > 12);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- raccourcis : ouvrent la recherche pré-remplie ----------
  $$('.h-quick a[data-q]').forEach((a) => a.addEventListener('click', (e) => {
    const btn = $('[data-open-search]'); const input = $('#so-input');
    if (!btn || !input) return;
    e.preventDefault(); btn.click();
    requestAnimationFrame(() => { input.value = a.dataset.q; input.dispatchEvent(new Event('input', { bubbles: true })); });
  }));

  // ---------- intro héro ----------
  function intro() {
    if (!g || reduce) return;
    const tl = g.timeline({ defaults: { ease: 'expo.out' } });
    const title = $('.h-title');
    g.set(title, { opacity: 1 });
    let lines = $$('.h-line', title);
    if (window.SplitText) {
      const split = new SplitText('.h-line--plein', { type: 'chars', charsClass: 'h-ch' });
      g.set('.h-line--plein', { overflow: 'hidden', paddingBottom: '.06em' });
      tl.from(split.chars, { yPercent: 110, opacity: 0, duration: 1.1, stagger: .025 }, .15);
    } else tl.from(lines[0], { y: 40, opacity: 0, duration: 1 }, .15);
    // Néon : allumage avec scintillement
    tl.fromTo('.h-line--neon', { opacity: 0, filter: 'drop-shadow(0 0 0 rgba(255,43,214,0))' }, {
      keyframes: [{ opacity: .9, duration: .06 }, { opacity: .1, duration: .08 }, { opacity: 1, duration: .05 }, { opacity: .3, duration: .1 }, { opacity: 1, duration: .25 }],
      filter: 'drop-shadow(0 0 6px rgba(255,43,214,.85)) drop-shadow(0 0 22px rgba(255,43,214,.45))', ease: 'none'
    }, .55);
    tl.to('.h-kicker.h-anim', { opacity: 1, duration: .6 }, .1);
    tl.fromTo('.h-search', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .9 }, .65);
    tl.to('.h-search', { '--a': '360deg', duration: 2.2, ease: 'power2.inOut' }, .8);
    tl.fromTo('.h-quick a', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .6, stagger: .05 }, .85);
    g.set('.h-quick', { opacity: 1 });
    tl.fromTo('.ht', { opacity: 0, y: 26, clipPath: 'inset(0 0 100% 0 round 18px)' }, { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0 round 18px)', duration: 1, stagger: .07, clearProps: 'clipPath,transform' }, .9);
    if (window.DrawSVGPlugin) tl.from('.ht .ht-ico .ic > *', { drawSVG: '0%', duration: 1.1, stagger: .02, ease: 'power2.inOut' }, 1.05);
    tl.to('.h-help', { opacity: 1, duration: .6 }, 1.3);
    // Décor : soleil et palmiers tracés au trait
    g.set(['.h-sun', '.h-palms'], { opacity: 1 });
    if (window.DrawSVGPlugin) {
      tl.from('.sun-arc', { drawSVG: '50% 50%', duration: 1.8, stagger: .12, ease: 'power3.inOut' }, 0);
      tl.from('.sun-line', { drawSVG: '50% 50%', duration: 1.4, stagger: .08, ease: 'power3.inOut' }, .3);
      tl.from('.palm-l', { drawSVG: '0%', duration: 2, stagger: .05, ease: 'power2.inOut' }, .4);
    }
    g.set('.h-sun', { opacity: .75 }); g.set('.h-palms', { opacity: .5 });
    tl.from('.h-glow', { opacity: 0, scale: .6, duration: 2.4, ease: 'power2.out' }, 0);
    // Parallaxe au pointeur (desktop)
    if (matchMedia('(pointer:fine)').matches) {
      const sx = g.quickTo('.h-sun', 'x', { duration: 1.4, ease: 'power3' }), sy = g.quickTo('.h-sun', 'y', { duration: 1.4, ease: 'power3' });
      const gx = g.quickTo('.h-glow', 'x', { duration: 2, ease: 'power3' });
      addEventListener('pointermove', (e) => { const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5; sx(x * 30); sy(y * 18); gx(x * -40); });
    }
    // Défilement : le décor s'éloigne
    if (window.ScrollTrigger) {
      g.to('.h-sun', { yPercent: 25, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.h-hero', start: 'top top', end: 'bottom top', scrub: true } });
      g.to('.h-palms', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.h-hero', start: 'top top', end: 'bottom top', scrub: true } });
    }
  }

  // ---------- survol des tuiles : retracé de l'icône + aimant ----------
  function tilesFx() {
    if (!g || reduce) return;
    $$('.ht').forEach((t) => {
      const paths = $$('.ht-ico .ic > *', t);
      t.addEventListener('pointerenter', () => { if (window.DrawSVGPlugin) g.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: .7, stagger: .03, ease: 'power2.out' }); });
      if (!matchMedia('(pointer:fine)').matches) return;
      const go = $('.ht-go', t); const qx = g.quickTo(go, 'x', { duration: .5, ease: 'power3' }), qy = g.quickTo(go, 'y', { duration: .5, ease: 'power3' });
      t.addEventListener('pointermove', (e) => { const r = t.getBoundingClientRect(); qx((e.clientX - r.right + 30) * .15); qy((e.clientY - r.bottom + 30) * .15); });
      t.addEventListener('pointerleave', () => { qx(0); qy(0); });
    });
  }

  // ---------- texte de recherche qui s'écrit tout seul ----------
  function typer() {
    const el = $('[data-typer]'); if (!el) return;
    let words = []; try { words = JSON.parse(el.dataset.words); } catch (e) { return; }
    if (!words.length || reduce || !g) return;
    const base = el.textContent;
    const tl = g.timeline({ repeat: -1, delay: 2.4 });
    words.forEach((w) => {
      const o = { n: 0 };
      tl.to(o, { n: w.length, duration: w.length * .055, ease: 'none', onUpdate: () => { el.textContent = w.slice(0, Math.round(o.n)); } })
        .to({}, { duration: 1.3 })
        .to(o, { n: 0, duration: w.length * .025, ease: 'none', onUpdate: () => { el.textContent = w.slice(0, Math.round(o.n)) || ' '; } });
    });
    tl.call(() => { el.textContent = base; }).to({}, { duration: 1.6 });
  }

  // ---------- « En ce moment » ----------
  function rowsFx() {
    if (!g || reduce || !window.ScrollTrigger) return;
    g.from('.h-row', { opacity: 0, y: 24, duration: .8, stagger: .08, ease: 'expo.out', scrollTrigger: { trigger: '.h-rows', start: 'top 85%' } });
    g.from('.h-map .h-head > *', { opacity: 0, y: 20, duration: .9, stagger: .08, ease: 'expo.out', scrollTrigger: { trigger: '.h-map', start: 'top 80%' } });
  }

  // ======================================================================
  //   Carte interactive (zoom, dézoom, déplacement, inertie)
  // ======================================================================
  function homeMap() {
    const box = $('[data-homemap]'); if (!box) return;
    const stage = $('.hm-stage', box), svg = $('.hm-svg', box), layer = $('.hm-layer', box), pop = $('.hm-pop', box), hint = $('.hm-hint', box);
    const [VX, VY, VW, VH] = svg.getAttribute('viewBox').split(' ').map(Number);
    const C0 = (box.dataset.center || '').split(',').map(Number);
    const cam = { x: C0[0] || VX + VW / 2, y: C0[1] || VY + VH / 2, w: VW };
    let W = 0, H = 0, wMax = VW, wMin = VW / 9;
    let feats = [], regions = [], cats = {}, hidden = new Set(), active = null;

    const measure = () => {
      W = stage.clientWidth; H = stage.clientHeight;
      const a = W / H;
      wMax = Math.max(VW, VH * a) * 1.04; wMin = wMax / 9;
      cam.w = Math.min(Math.max(cam.w, wMin), wMax);
    };
    const hOf = (w) => w * H / W;
    const clampCam = () => {
      cam.w = Math.min(Math.max(cam.w, wMin), wMax);
      const h = hOf(cam.w), mx = Math.max(0, (VW - cam.w) / 2 + cam.w * .35), my = Math.max(0, (VH - h) / 2 + h * .35);
      cam.x = Math.min(Math.max(cam.x, VX + VW / 2 - mx), VX + VW / 2 + mx);
      cam.y = Math.min(Math.max(cam.y, VY + VH / 2 - my), VY + VH / 2 + my);
    };
    const k = () => W / cam.w;
    const toScreen = (x, y) => [(x - cam.x) * k() + W / 2, (y - cam.y) * k() + H / 2];
    const toMap = (sx, sy) => [(sx - W / 2) / k() + cam.x, (sy - H / 2) / k() + cam.y];

    let nodes = [], builtW = 0;
    function render() {
      clampCam();
      const h = hOf(cam.w);
      svg.setAttribute('viewBox', `${cam.x - cam.w / 2} ${cam.y - h / 2} ${cam.w} ${h}`);
      if (!builtW || Math.abs(Math.log(cam.w / builtW)) > .08) build();
      for (const n of nodes) { const [sx, sy] = toScreen(n.x, n.y); n.el.style.transform = `translate3d(${sx}px,${sy}px,0)`; }
    }
    function build() {
      builtW = cam.w;
      layer.innerHTML = ''; nodes = [];
      const frag = document.createDocumentFragment();
      const zoomed = wMax / cam.w;
      regions.forEach((r) => {
        const el = document.createElement('span'); el.className = 'hm-lbl'; el.textContent = r.nom;
        el.style.opacity = zoomed > 3.5 ? .35 : 1;
        frag.appendChild(el); nodes.push({ el, x: r.label[0], y: r.label[1] - 18 / k() });
      });
      const R = 30 / k(), cl = [];
      feats.filter((f) => !hidden.has(f.cat)).forEach((f) => {
        if (f.id === active) { cl.push({ x: f.x, y: f.y, m: [f], solo: 1 }); return; }
        const c = cl.find((c) => !c.solo && Math.hypot(c.x - f.x, c.y - f.y) < R);
        if (c) { c.m.push(f); c.x = c.m.reduce((s, a) => s + a.x, 0) / c.m.length; c.y = c.m.reduce((s, a) => s + a.y, 0) / c.m.length; }
        else cl.push({ x: f.x, y: f.y, m: [f] });
      });
      cl.forEach((c, i) => {
        const el = document.createElement('button'); el.type = 'button';
        if (c.m.length === 1) {
          const f = c.m[0];
          el.className = 'hm-dot' + (f.precision === 'region' ? ' hm-dot--approx' : '') + (f.id === active ? ' is-on' : '');
          el.style.setProperty('--c', cats[f.cat].color); el.style.setProperty('--d', (i % 7) * .35 + 's');
          el.setAttribute('aria-label', f.nom);
          el.addEventListener('click', (e) => { if (moved) return; e.stopPropagation(); open(f); });
        } else {
          el.className = 'hm-cl'; el.textContent = c.m.length; el.setAttribute('aria-label', `${c.m.length} repères : zoomer`);
          el.addEventListener('click', (e) => { if (moved) return; e.stopPropagation(); fitTo(c.m); });
        }
        frag.appendChild(el); nodes.push({ el, x: c.x, y: c.y });
      });
      layer.appendChild(frag);
    }

    // ---- caméra animée (GSAP) ----
    function flyTo(x, y, w, dur = .9) {
      w = Math.min(Math.max(w, wMin), wMax);
      if (!g || reduce) { cam.x = x; cam.y = y; cam.w = w; return render(); }
      g.to(cam, { x, y, w, duration: dur, ease: 'expo.out', overwrite: true, onUpdate: render });
    }
    function zoomAt(sx, sy, f) {
      const [mx, my] = toMap(sx, sy); const nw = Math.min(Math.max(cam.w / f, wMin), wMax); const nk = W / nw;
      flyTo(mx - (sx - W / 2) / nk, my - (sy - H / 2) / nk, nw, .7);
    }
    function fitTo(list) {
      const xs = list.map((f) => f.x), ys = list.map((f) => f.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const w = Math.max((x1 - x0) * 2.2, (y1 - y0) * 2.2 * W / H, wMin * 1.2);
      flyTo((x0 + x1) / 2, (y0 + y1) / 2, w);
    }

    // ---- fiche au toucher ----
    const STAT = { confirme: 'Confirmé', 'a-verifier': 'À vérifier', provisoire: 'Provisoire' };
    function open(f) {
      active = f.id; builtW = 0; render();
      const c = cats[f.cat];
      pop.innerHTML = `<span class="hm-pop-ico" style="--c:${c.color}">${ic(f.icon)}</span>
        <span class="hm-pop-t"><small>${escH(c.nom)} · ${STAT[f.statut] || ''}</small><b>${escH(f.nom)}</b>${f.precision === 'region' ? '<em>Emplacement à confirmer</em>' : ''}</span>
        <span class="hm-pop-act"><button type="button" data-close aria-label="Fermer">${ic('x')}</button><a class="go" href="${ROOT}${f.url}" aria-label="Voir la fiche de ${escH(f.nom)}">${ic('arrow-right')}</a></span>`;
      pop.hidden = false;
      $('[data-close]', pop).addEventListener('click', close);
      if (g && !reduce) g.fromTo(pop, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'expo.out' });
      const [sx, sy] = toScreen(f.x, f.y);
      const safeBottom = H - pop.offsetHeight - 30;
      if (sy > safeBottom || sy < 60 || sx < 30 || sx > W - 30) flyTo(f.x, f.y + (pop.offsetHeight / 2) / k(), cam.w, .8);
    }
    function close() { pop.hidden = true; if (active) { active = null; builtW = 0; render(); } }

    // ---- gestes ----
    let moved = false, armed = false;
    const pts = new Map(); let start = null, pinch = null, vel = { x: 0, y: 0, t: 0 };
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (g) g.killTweensOf(cam);
      armed = true; moved = false;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, id: e.pointerId }; vel = { x: 0, y: 0, t: performance.now(), px: e.clientX, py: e.clientY }; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], r = stage.getBoundingClientRect();
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: cam.w, m: toMap((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top) }; moved = true;
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = stage.getBoundingClientRect();
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        cam.w = pinch.w * pinch.d / Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1); cam.w = Math.min(Math.max(cam.w, wMin), wMax);
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        cam.x = pinch.m[0] - (mx - W / 2) / k(); cam.y = pinch.m[1] - (my - H / 2) / k(); render();
      } else if (start && e.pointerId === start.id) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) > 5) { moved = true; stage.classList.add('is-drag'); try { stage.setPointerCapture(e.pointerId); } catch (err) { /* */ } }
        if (moved) {
          cam.x = start.cx - dx / k(); cam.y = start.cy - dy / k(); render();
          const now = performance.now(), dt = Math.max(now - vel.t, 1);
          vel = { x: (e.clientX - vel.px) / dt, y: (e.clientY - vel.py) / dt, t: now, px: e.clientX, py: e.clientY };
        }
      }
    });
    const up = (e) => {
      const wasPan = pts.size === 1 && moved && start;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!pts.size) {
        stage.classList.remove('is-drag');
        if (wasPan && g && !reduce && performance.now() - vel.t < 80) { // inertie
          g.to(cam, { x: cam.x - vel.x * 260 / k(), y: cam.y - vel.y * 260 / k(), duration: 1, ease: 'power3.out', onUpdate: render });
        }
        start = null; setTimeout(() => { moved = false; }, 0);
      } else if (pts.size === 1) { const [id, p] = [...pts.entries()][0]; start = { x: p.x, y: p.y, cx: cam.x, cy: cam.y, id }; }
    };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('click', (e) => { if (!moved && !e.target.closest('.hm-dot,.hm-cl')) close(); });
    stage.addEventListener('pointerleave', () => { if (!pts.size) armed = false; });
    let hintT;
    stage.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey || armed)) { // ne bloque pas le défilement de la page
        hint.hidden = false; clearTimeout(hintT); hintT = setTimeout(() => { hint.hidden = true; }, 1200); return;
      }
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0022));
      const sx = e.clientX - r.left, sy = e.clientY - r.top; const [mx, my] = toMap(sx, sy);
      cam.w = Math.min(Math.max(cam.w / f, wMin), wMax);
      cam.x = mx - (sx - W / 2) / k(); cam.y = my - (sy - H / 2) / k(); render();
    }, { passive: false });
    stage.addEventListener('dblclick', (e) => { const r = stage.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, 2.2); });
    stage.addEventListener('keydown', (e) => {
      const s = cam.w * .12, m = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] };
      if (m[e.key]) { e.preventDefault(); flyTo(cam.x + m[e.key][0], cam.y + m[e.key][1], cam.w, .5); }
      if (e.key === '+' || e.key === '=') zoomAt(W / 2, H / 2, 1.8);
      if (e.key === '-') zoomAt(W / 2, H / 2, 1 / 1.8);
      if (e.key === 'Escape') close();
    });
    $$('[data-z]', box).forEach((b) => b.addEventListener('click', () => {
      const z = b.dataset.z;
      if (z === 'in') zoomAt(W / 2, H / 2, 1.9); else if (z === 'out') zoomAt(W / 2, H / 2, 1 / 1.9);
      else { close(); flyTo(VX + VW / 2, VY + VH / 2, wMax); }
    }));
    $$('.hm-chip', box).forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.cat; hidden.has(c) ? hidden.delete(c) : hidden.add(c);
      b.setAttribute('aria-pressed', !hidden.has(c)); builtW = 0; render();
      if (g && !reduce) g.from('.hm-dot, .hm-cl', { scale: 0, duration: .4, stagger: .01, ease: 'back.out(2)' });
    }));
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); builtW = 0; render(); }, 120); });

    // ---- données (JSON) ----
    fetch(ROOT + 'data/carte.json').then((r) => r.json()).then((d) => {
      d.categories.forEach((c) => { cats[c.id] = c; });
      regions = d.regions;
      feats = d.features.filter((f) => !f.properties.label).map((f) => ({ ...f.properties, x: f.geometry.coordinates[0], y: f.geometry.coordinates[1] }));
      measure(); cam.w = wMax / (+box.dataset.zoom || 1); render();
      if (g && !reduce && window.ScrollTrigger) {
        const tl = g.timeline({ scrollTrigger: { trigger: box, start: 'top 75%', once: true } });
        tl.fromTo(svg, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 1.8, ease: 'power3.inOut', clearProps: 'clipPath' }, 0)
          .from('.hm-coast-glow', { opacity: 0, duration: 1.4 }, .9);
        tl.from('.hm-reg', { opacity: 0, duration: 1.2, stagger: .1 }, .5)
          .from('.hm-roads path', { opacity: 0, duration: 1 }, 1)
          .from('.hm-lbl', { opacity: 0, y: 6, duration: .6, stagger: .06 }, 1.2)
          .from('.hm-dot, .hm-cl', { scale: 0, opacity: 0, duration: .5, stagger: .03, ease: 'back.out(2.2)' }, 1.4)
          .from('.hm-legend > *, .hm-ctrl > *', { opacity: 0, y: -8, duration: .5, stagger: .05 }, 1.2);
      }
    }).catch(() => { /* carte indisponible : le fond reste visible */ });
  }

  intro(); tilesFx(); typer(); rowsFx(); homeMap();
})();
