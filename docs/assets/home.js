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
      filter: 'drop-shadow(0 0 8px rgba(255,43,214,.7)) drop-shadow(0 0 24px rgba(255,43,214,.35))', ease: 'none'
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
    g.set('.h-sun', { opacity: innerWidth < 900 ? .4 : .55 }); g.set('.h-palms', { opacity: .3 });
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
  //   Carte interactive (tuiles néon de la carte communautaire GTADB)
  // ======================================================================
  function homeMap() {
    const box = $('[data-homemap]'); if (!box || !window.Atlas) return;
    const stage = $('.hm-stage', box), pop = $('.hm-pop', box), hint = $('.hm-hint', box);
    const STAT = { confirme: 'Confirmé', 'a-verifier': 'À vérifier', provisoire: 'Provisoire' };
    let atlas, cats = {}, hidden = new Set(), hintT;
    function open(f) {
      const c = cats[f.cat] || {};
      pop.innerHTML = `<span class="hm-pop-ico" style="--c:${c.color}">${ic(f.icon)}</span>
        <span class="hm-pop-t"><small>${escH(c.nom || '')} · ${STAT[f.statut] || ''}</small><b>${escH(f.nom)}</b>${f.precision === 'region' ? '<em>Emplacement à confirmer</em>' : '<em>Position approximative</em>'}</span>
        <span class="hm-pop-act"><button type="button" data-close aria-label="Fermer">${ic('x')}</button><a class="go" href="${ROOT}carte/?focus=${encodeURIComponent(f.id)}" aria-label="Ouvrir ${escH(f.nom)} sur la carte complète">${ic('arrow-right')}</a></span>`;
      pop.hidden = false;
      $('[data-close]', pop).addEventListener('click', close);
      if (g && !reduce) g.fromTo(pop, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'expo.out' });
    }
    function close() { pop.hidden = true; atlas && atlas.clearActive(); }
    fetch(ROOT + 'data/carte.json').then((r) => r.json()).then((d) => {
      d.categories.forEach((c) => { cats[c.id] = c; });
      atlas = window.Atlas(stage, {
        root: ROOT, tuiles: d.tuiles, carte: d, wheelNeedsArm: true, pad: { top: 50, bottom: 40 },
        onSelect: open, onBlank: close,
        onRegion: (r) => atlas.flyTo(r.label[0], r.label[1], .12),
        onWheelHint: () => { hint.hidden = false; clearTimeout(hintT); hintT = setTimeout(() => { hint.hidden = true; }, 1300); }
      });
      $$('[data-z]', box).forEach((b) => b.addEventListener('click', () => {
        const z = b.dataset.z; if (z === 'in') atlas.zoomIn(); else if (z === 'out') atlas.zoomOut(); else { close(); atlas.reset(); }
      }));
      $$('.hm-chip', box).forEach((b) => b.addEventListener('click', () => {
        const c = b.dataset.cat; hidden.has(c) ? hidden.delete(c) : hidden.add(c);
        b.setAttribute('aria-pressed', !hidden.has(c)); atlas.setFilter((f) => !hidden.has(f.cat));
      }));
      if (g && !reduce && window.ScrollTrigger) {
        g.from(stage, { clipPath: 'circle(0% at 50% 50%)', duration: 1.6, ease: 'power3.inOut', clearProps: 'clipPath', scrollTrigger: { trigger: box, start: 'top 80%', once: true } });
        g.from('.hm-legend > *, .hm-ctrl > *', { opacity: 0, y: -8, duration: .5, stagger: .05, delay: .8, scrollTrigger: { trigger: box, start: 'top 80%', once: true } });
      }
    }).catch(() => { stage.textContent = 'Carte indisponible pour le moment.'; });
  }

  intro(); tilesFx(); typer(); rowsFx(); homeMap();
})();
