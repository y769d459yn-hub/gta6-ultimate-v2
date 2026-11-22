/* Leonida Guide — fiche véhicule : vue 3D chargée à la demande, bascule « Vue 3D / Photo du jeu » */
(() => {
  'use strict';
  const hero = document.querySelector('[data-v3d]'); if (!hero) return;
  const ROOT = document.body.dataset.root || './';
  const stage = hero.querySelector('.v3d-stage'), photo = hero.querySelector('.veh-jeu');
  const nom = (document.querySelector('main h1') || {}).textContent || 'véhicule';
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', `Modèle 3D : ${nom.trim()}. Glisse pour le faire tourner.`);
  let spec; try { spec = JSON.parse(hero.dataset.v3d); } catch (e) { return; }
  const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  let vue = null, charge = false;
  function charger() {
    if (charge || !webgl) return; charge = true;
    const go = () => {
      try { vue = window.LG3D.monter(stage, spec); requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-3d'))); }
      catch (e) { hero.classList.add('no-3d'); }
    };
    if (window.LG3D) return go();
    const s = document.createElement('script'); s.src = ROOT + 'assets/vehicule3d.js'; s.async = true;
    s.onload = go; s.onerror = () => hero.classList.add('no-3d');
    document.head.appendChild(s);
  }
  if (!webgl) hero.classList.add('no-3d');
  else if ('IntersectionObserver' in window) { const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); charger(); } }, { rootMargin: '200px' }); io.observe(hero); }
  else charger();
  hero.querySelectorAll('[data-vue]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.vue === 'photo';
    hero.querySelectorAll('[data-vue]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    hero.classList.toggle('is-photo', p); if (photo) photo.hidden = !p;
    if (vue) vue.stop(p);
  }));
  stage.addEventListener('pointerdown', () => hero.classList.add('is-touch'), { once: true });
})();
