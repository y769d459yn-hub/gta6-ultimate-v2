/* GTA 6 Facile — animations communes des pages intérieures (GSAP + DrawSVG + SplitText) */
(() => {
  'use strict';
  const g = window.gsap;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
  if (!g || reduce) return;
  const plugins = [window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin].filter(Boolean);
  g.registerPlugin(...plugins);
  const top = document.querySelector('.top');
  const onScroll = () => top && top.classList.toggle('is-scrolled', scrollY > 12);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (window.DrawSVGPlugin) {
    g.from('.pg-deco .sun-arc', { drawSVG: '50% 50%', duration: 1.6, stagger: .1, ease: 'power3.inOut' });
    g.from('.pg-deco .sun-line', { drawSVG: '50% 50%', duration: 1.2, stagger: .06, ease: 'power3.inOut', delay: .2 });
    g.from('.pg-deco .palm-l', { drawSVG: '0%', duration: 1.8, stagger: .04, ease: 'power2.inOut', delay: .2 });
  }
  const h1 = document.querySelector('main .h1');
  if (h1 && window.SplitText) {
    const split = new SplitText(h1, { type: 'words,chars', wordsClass: 'w' });
    g.from(split.chars, { yPercent: 60, opacity: 0, duration: .8, stagger: .012, ease: 'expo.out', onComplete: () => split.revert() });
  }
  // silhouettes qui se dessinent à l'entrée dans l'écran : IntersectionObserver (pas de mesure de toute la page comme ScrollTrigger)
  const svgs = document.querySelectorAll('.veh-svg');
  if (window.DrawSVGPlugin && svgs.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      const els = entries.filter((e) => e.isIntersecting).map((e) => e.target); if (!els.length) return;
      els.forEach((e) => io.unobserve(e));
      g.from(els.map((e) => [...e.querySelectorAll('path, circle')]).flat(), { drawSVG: '0%', duration: 1.2, stagger: .01, ease: 'power2.inOut' });
    }, { rootMargin: '0px 0px -8% 0px' });
    svgs.forEach((e) => io.observe(e));
  }
  g.fromTo('.map-banner, .veh-hero', { opacity: 0, scale: .98 }, { opacity: 1, scale: 1, duration: .9, ease: 'expo.out', clearProps: 'transform' });
  const icons = document.querySelectorAll('.fiche-ico .ic > *, .door-ico .ic > *');
  if (icons.length && window.DrawSVGPlugin) g.from(icons, { drawSVG: '0%', duration: 1, stagger: .01, ease: 'power2.inOut', delay: .2 });
})();

// Fiche véhicule : photo en plein écran, dans sa plus grande résolution (chargée seulement à la demande)
(() => {
  'use strict';
  const btns = document.querySelectorAll('[data-plein]'); if (!btns.length) return;
  let box = null, dernier = null;
  const fermer = () => { if (!box) return; box.remove(); box = null; document.documentElement.classList.remove('veh-lb-on'); if (dernier) dernier.focus(); };
  btns.forEach((b) => b.addEventListener('click', () => {
    dernier = b;
    box = document.createElement('div'); box.className = 'veh-lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', `${b.dataset.pleinAlt} en plein écran`);
    box.innerHTML = '<img decoding="async"><button class="veh-lb-x" type="button" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><span class="veh-lb-info">Chargement de la haute définition…</span>';
    const im = box.querySelector('img'), prev = b.parentElement.querySelector('img');
    im.alt = b.dataset.pleinAlt; im.src = prev.currentSrc || prev.src; // aperçu immédiat, remplacé par la HD
    const hd = new Image(); hd.onload = () => { if (box) { im.src = hd.src; box.classList.add('is-hd'); } }; hd.src = b.dataset.plein;
    // un toucher sur la photo l'affiche à taille réelle (pixels d'origine), un second la remet à l'écran
    im.addEventListener('click', (e) => { e.stopPropagation(); box.classList.toggle('is-zoom'); });
    box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('.veh-lb-x')) fermer(); });
    document.body.appendChild(box); document.documentElement.classList.add('veh-lb-on'); box.querySelector('.veh-lb-x').focus();
  }));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });
})();
