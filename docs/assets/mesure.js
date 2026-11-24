/* GTA 6 Facile — mesure d'audience sans cookie (GoatCounter).
   Aucun script extérieur et rien n'est écrit sur l'appareil pour la mesure : un simple appel à l'adresse de comptage,
   avec la page, la page d'origine et la taille de l'écran. Rien n'est envoyé si le visiteur a refusé la mesure
   (bouton de la page de confidentialité), ni si le navigateur demande à ne pas être suivi (Do Not Track, Global Privacy Control). */
(() => {
  'use strict';
  const me = document.currentScript; const code = me && me.dataset.gc;
  const REFUS = 'lg:sans-mesure';
  const refuse = () => { try { return localStorage.getItem(REFUS) === '1'; } catch (e) { return false; } };

  // bouton « Ne pas compter mes visites » (page mentions légales)
  document.querySelectorAll('[data-mesure-refus]').forEach((b) => {
    const maj = () => { const on = refuse(); b.setAttribute('aria-pressed', String(on)); const sp = b.querySelector('[data-on]'); if (sp) sp.textContent = on ? sp.dataset.on : sp.dataset.off; };
    b.addEventListener('click', () => {
      try { if (refuse()) localStorage.removeItem(REFUS); else localStorage.setItem(REFUS, '1'); } catch (e) { /* mode privé : rien n'est compté de toute façon si le stockage est bloqué */ }
      maj();
    });
    maj();
  });

  if (!code || refuse()) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  if (!/^https:$/.test(location.protocol) || /^(localhost|127\.)/.test(location.hostname)) return; // pas de comptage en local ni dans les aperçus
  if (navigator.webdriver) return; // robots de test
  const ref = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : '';
  const q = new URLSearchParams({ p: location.pathname, r: ref, s: `${screen.width},${screen.height},${window.devicePixelRatio || 1}`, rnd: Math.random().toString(36).slice(2) });
  const url = `https://${code}.goatcounter.com/count?${q}`;
  if (navigator.sendBeacon) navigator.sendBeacon(url); else { const i = new Image(); i.src = url; }
})();
