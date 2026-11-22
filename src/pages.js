/* Leonida Guide — animations communes des pages intérieures (GSAP + DrawSVG + SplitText) */
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
  g.from('.map-banner, .veh-hero', { opacity: 0, scale: .98, duration: .9, ease: 'expo.out', clearProps: 'transform' });
  const icons = document.querySelectorAll('.fiche-ico .ic > *, .door-ico .ic > *');
  if (icons.length && window.DrawSVGPlugin) g.from(icons, { drawSVG: '0%', duration: 1, stagger: .01, ease: 'power2.inOut', delay: .2 });
})();
