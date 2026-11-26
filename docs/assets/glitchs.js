/* GTA 6 Facile — rubrique Glitchs : filtres et recherche de la liste, étapes à cocher, vidéos chargées au clic, votes des joueurs.
   Votes : table Supabase « glitch_votes » (supabase/glitchs.sql). Tant qu'elle n'existe pas, aucun compteur n'est affiché. */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const LG = window.LG || {};
  const norm = LG.norm || ((s) => String(s).toLowerCase());
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROOT = document.body.dataset.root || './';
  const store = { get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } } };

  // ---------- liste : recherche, catégories, « Fonctionnent encore » ----------
  const page = $('[data-gl]');
  if (page) {
    const items = $$('[data-gl-item]', page), vide = $('[data-gl-vide]', page), q = $('[data-gl-q]', page), ok = $('[data-gl-ok]', page);
    let cat = '';
    const filtrer = () => {
      const t = norm(q.value).split(' ').filter(Boolean), seulOk = ok.getAttribute('aria-pressed') === 'true';
      let n = 0;
      items.forEach((it) => { const v = (!cat || it.dataset.cat === cat) && (!seulOk || it.dataset.ok === '1') && t.every((w) => it.dataset.text.includes(w)); it.hidden = !v; if (v) n++; });
      $$('[data-gl-sec]', page).forEach((s) => { s.hidden = !$$('[data-gl-item]', s).some((x) => !x.hidden); });
      vide.hidden = !!n;
      vide.textContent = seulOk ? 'Aucun glitch n’est encore établi comme fonctionnel sur la dernière version du jeu : notre équipe ne marque « Fonctionnel » qu’un glitch reproduit sur une version identifiée. Désactive ce filtre pour voir les glitchs bien documentés.' : 'Aucun glitch ne correspond à ta recherche.';
    };
    q.addEventListener('input', filtrer);
    ok.addEventListener('click', () => { ok.setAttribute('aria-pressed', ok.getAttribute('aria-pressed') !== 'true'); filtrer(); });
    $$('[data-gl-cat]', page).forEach((b) => b.addEventListener('click', () => { cat = b.dataset.glCat; $$('[data-gl-cat]', page).forEach((x) => x.setAttribute('aria-pressed', x === b)); filtrer(); }));
    // retour depuis un tutoriel : même position dans la liste
    try { const y = sessionStorage.getItem('lg:glitchs-y'); if (y) { sessionStorage.removeItem('lg:glitchs-y'); requestAnimationFrame(() => scrollTo(0, +y)); } } catch (e) { /* */ }
    page.addEventListener('click', (e) => { if (e.target.closest('a[href*="glitchs/"]')) try { sessionStorage.setItem('lg:glitchs-y', String(scrollY)); } catch (err) { /* */ } });
  }

  // ---------- fiche : étapes à cocher (gardées sur l'appareil) ----------
  const fiche = $('[data-gl-fiche]');
  if (fiche) {
    const slug = fiche.dataset.glFiche, K = 'lg:glitch-etapes';
    const tout = store.get(K) || {}, faites = new Set(tout[slug] || []);
    const cases = $$('[data-gl-et]', fiche);
    const maj = () => { cases.forEach((c) => { c.checked = faites.has(+c.dataset.glEt); c.closest('li').classList.toggle('is-done', c.checked); }); };
    cases.forEach((c) => c.addEventListener('change', () => { c.checked ? faites.add(+c.dataset.glEt) : faites.delete(+c.dataset.glEt); const t = store.get(K) || {}; t[slug] = [...faites]; store.set(K, t); maj(); }));
    const raz = $('[data-gl-raz]', fiche); if (raz) raz.addEventListener('click', () => { faites.clear(); const t = store.get(K) || {}; delete t[slug]; store.set(K, t); maj(); });
    maj();
    // vidéos : le lecteur YouTube n'est chargé qu'au clic (aucune lecture automatique, aucun cookie avant)
    $$('[data-yt]', fiche).forEach((v) => $('[data-yt-go]', v).addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.dataset.yt)}?rel=0`;
      f.title = $('b', v).textContent; f.loading = 'lazy'; f.allow = 'encrypted-media; picture-in-picture; fullscreen'; f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.className = 'gl-vid-f'; $('[data-yt-go]', v).replaceWith(f);
    }));
    votes(fiche);
  }

  // ---------- votes : vrais votes seulement, un par compte et par glitch ----------
  async function votes(fiche) {
    const box = $('[data-gl-vote]', fiche); if (!box) return;
    const slug = box.dataset.glVote, etat = $('[data-vote-etat]', box), btns = $('[data-vote-btns]', box), form = $('[data-vote-form]', box);
    const CFG = window.LG_SB || {};
    const ferme = (t) => { etat.innerHTML = t; btns.hidden = true; form.hidden = true; };
    if (!CFG.url || !CFG.cle) return ferme('Le vote n’est pas disponible pour le moment.');
    // résumé public (seulement des nombres, calculés par la base)
    let resume = null;
    try {
      const r = await fetch(`${CFG.url}/rest/v1/rpc/glitch_votes_resume`, { method: 'POST', headers: { apikey: CFG.cle, 'Content-Type': 'application/json' }, body: JSON.stringify({ g: slug }) });
      if (r.ok) resume = await r.json(); else if (r.status === 404) return ferme('Le vote des joueurs ouvrira bientôt : la base qui enregistre les votes n’est pas encore en place. Aucun chiffre n’est affiché d’ici là.');
    } catch (e) { return ferme('Les votes sont momentanément indisponibles.'); }
    const ligne = Array.isArray(resume) ? resume[0] : resume;
    const n = (k) => (ligne && +ligne[k]) || 0, total = n('oui') + n('non') + n('partiel');
    const texte = () => (total ? `<b>${total} vote${total > 1 ? 's' : ''}</b> : ${n('oui')} « fonctionne », ${n('non')} « ne fonctionne plus », ${n('partiel')} « partiellement »${ligne.dernier ? ` · dernier vote le ${new Date(ligne.dernier).toLocaleDateString('fr-FR')}` : ''}.` : 'Aucun vote pour l’instant.');
    const c = window.LG_COMPTE ? await window.LG_COMPTE : null;
    if (!c || !c.user) { etat.innerHTML = `${texte()} <a href="${ROOT}compte/">Connecte-toi</a> pour voter (un vote par compte, pour éviter les abus).`; return; }
    etat.innerHTML = texte(); btns.hidden = false;
    let choix = '';
    $$('[data-vote]', btns).forEach((b) => b.addEventListener('click', () => { choix = b.dataset.vote; $$('[data-vote]', btns).forEach((x) => x.setAttribute('aria-pressed', x === b)); form.hidden = false; $('select', form).focus(); }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); if (!choix) return;
      const d = Object.fromEntries(new FormData(form));
      // seule la console est demandée : les autres colonnes de la table restent vides (mode Histoire par défaut)
      const row = { glitch: slug, user_id: c.user.id, resultat: choix, plateforme: d.plateforme, mode: 'histoire', maj: new Date().toISOString() };
      const { error } = await c.sb.from('glitch_votes').upsert(row, { onConflict: 'glitch,user_id' });
      if (error) { LG.toast && LG.toast(/limite|limit/i.test(error.message) ? 'Trop de votes en peu de temps : réessaie plus tard' : 'Vote non enregistré', 'alert'); return; }
      form.hidden = true; LG.toast && LG.toast('Merci, ton vote est enregistré', 'check');
      etat.innerHTML = 'Merci ! Ton vote est enregistré (tu peux le modifier en revotant). Il sera pris en compte lors de la prochaine vérification.';
    });
  }
})();
