/* Leonida Guide — page carte plein écran (recherche, filtres, fiches, couche communautaire GTADB) */
(() => {
  'use strict';
  const page = document.querySelector('[data-atlas-page]'); if (!page || !window.Atlas) return;
  const $ = (s, c = page) => c.querySelector(s);
  const $$ = (s, c = page) => [...c.querySelectorAll(s)];
  const LG = window.LG || {};
  const ROOT = document.body.dataset.root || './';
  const ic = (n) => (LG.ic ? LG.ic(n) : '');
  const norm = LG.norm || ((s) => String(s).toLowerCase());
  const escH = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const g = window.gsap;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STAT = { confirme: ['Confirmé', 'pn-tag--ok'], 'a-verifier': ['À vérifier', 'pn-tag--warn'], provisoire: ['Provisoire', 'pn-tag--warn'] };
  const stage = $('.atp-stage'), panel = $('[data-panel]'), top = $('.atp-top');
  const params = new URLSearchParams(location.search);
  let atlas, D, commu = [], commuCats = {}, cats = {}, regions = {}, sousNoms = {};
  const shown = new Set(), state = { commu: false, fromList: false, sel: '' };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } } };
  // points marqués « trouvé » (gardés sur cet appareil)
  const KEY_T = 'lg:carte-trouves';
  let trouves = new Set(); try { trouves = new Set(JSON.parse(store.get(KEY_T) || '[]')); } catch (e) { /* */ }
  const saveT = () => store.set(KEY_T, JSON.stringify([...trouves]));
  // ce qu'on cherche souvent : la plus proche, depuis n'importe quel point
  const BESOINS = [[['Armurerie'], 'gun', 'Armurerie'], [['Hôpital'], 'heart', 'Hôpital'], [['Station-service'], 'bolt', 'Station-service'], [['Garage auto', "Pay 'n' Spray"], 'spray', 'Garage ou Pay \'n\' Spray'], [['Vêtements'], 'user', 'Vêtements'], [['Planque'], 'home', 'Planque']];
  const foundTxt = (f, on) => (f.cat === 'collection' ? (on ? 'Trouvé !' : "Je l'ai trouvé") : (on ? 'Trouvé !' : "J'y suis allé"));
  const km = (d) => (d < 950 ? `${Math.max(100, Math.round(d / 100) * 100)} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`);
  const sousLigne = (f) => { const z = f.zone || f.lieuNom || (regions[f.region] || {}).nom || ''; return z && !f.nom.includes(z.split(',')[0]) ? z : (f.service || (f.tip ? f.tip.titre : '') || z); };
  const sousNom = (f) => f.service || sousNoms[f.cat + ':' + f.sous] || (cats[f.cat] || {}).nom || '';

  Promise.all([fetch(ROOT + 'data/carte.json').then((r) => r.json()), fetch(ROOT + 'data/communaute.json').then((r) => r.json()).catch(() => ({ lieux: [], categories: [] }))]).then(([d, c]) => {
    D = d; commu = c.lieux; c.categories.forEach((k) => { commuCats[k.id] = k; });
    d.categories.forEach((k) => { cats[k.id] = k; shown.add(k.id); });
    d.regions.forEach((r) => { regions[r.id] = r; });
    Object.entries(d.sousTypes || {}).forEach(([c, L]) => L.forEach((x) => { sousNoms[c + ':' + x.id] = c === 'activites' ? 'Activités' : x.nom; }));
    const only = params.get('cat'); if (only && cats[only]) { state.sel = only; shown.clear(); shown.add(only); }
    atlas = window.Atlas(stage, {
      root: ROOT, tuiles: d.tuiles, carte: d, pad: padding(),
      onSelect: (f) => (f.commu ? openCommu(f) : openFeature(f)),
      onRegion: openRegion, onBlank: closePanel, onView: countView
    });
    atlas.setCommu(commu); atlas.markFound(trouves);
    syncChips(); applyFilter();
    const n = (id) => $(`[data-n="${id}"]`);
    d.categories.forEach((k) => { const el = n(k.id); if (el) el.textContent = d.features.filter((f) => f.properties.cat === k.id && !f.properties.label).length; });
    n('commu').textContent = commu.length;
    n('tout').textContent = d.features.filter((f) => !f.properties.label).length;
    const focus = params.get('focus');
    const f = focus && atlas.feats().find((x) => x.id === focus);
    if (only && cats[only] && !focus) setTimeout(() => openAnswer(only), 300);
    // arrivée par un lien (mission, lieu…) : le point est mis en avant, le reste s'efface
    if (f) setTimeout(() => { if (f.label) return openRegion(regions[f.id]); ensureShown(f); state.spot = f.id; atlas.spot(true); if (params.get('mission')) solo(f); atlas.select(f, { fly: true, s: .45 }); }, 250);
    else if (params.get('region') && regions[params.get('region')]) setTimeout(() => openRegion(regions[params.get('region')]), 250);
    bind();
    if (!f && !only && !params.get('region') && !store.get('lg-carte-aide')) setTimeout(openHelp, 600);
    if (g && !reduce) g.from('.atp-top > *, .atp-ctrl > *, .atp-regions > *', { opacity: 0, y: -10, duration: .6, stagger: .03, ease: 'expo.out' });
  }).catch(() => { stage.textContent = 'Carte indisponible pour le moment.'; });

  function padding() {
    const mob = innerWidth < 900;
    return { top: (top.getBoundingClientRect().bottom - page.getBoundingClientRect().top) + 10, bottom: mob ? 140 : 70, left: 10, right: mob ? 10 : (panel.hidden ? 70 : 430) };
  }
  function syncChips() {
    $$('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', !state.solo && state.sel === b.dataset.cat));
    $('[data-all]').setAttribute('aria-pressed', !state.sel && !state.solo);
    $('[data-commu]').setAttribute('aria-pressed', state.commu);
    const u = new URL(location.href);
    state.sel ? u.searchParams.set('cat', state.sel) : u.searchParams.delete('cat');
    u.searchParams.delete('focus'); history.replaceState(null, '', u);
  }
  function applyFilter() { atlas.setFilter((f) => (state.solo ? f.id === state.solo : shown.has(f.cat))); atlas.showCommu(state.commu && !state.solo); countView(); }
  // depuis une mission : on ne garde que son lieu ; le reste revient quand on choisit une catégorie
  function solo(f) {
    state.solo = f.id;
    $('[data-solo-nom]').textContent = f.nom; $('[data-solo]').hidden = false;
    syncChips(); applyFilter();
  }
  function unsolo() { if (!state.solo) return; state.solo = ''; state.spot = ''; $('[data-solo]').hidden = true; atlas.spot(false); }
  function choose(id) {
    unsolo();
    state.sel = id || ''; shown.clear();
    if (id) shown.add(id); else Object.keys(cats).forEach((k) => shown.add(k));
    syncChips(); applyFilter();
  }
  function ensureShown(f) { if (state.solo ? f.id !== state.solo : !shown.has(f.cat)) choose(''); }

  // ---------- panneau de détail ----------
  function showPanel(html) {
    panel.innerHTML = html; panel.hidden = false; panel.scrollTop = 0; page.classList.add('has-panel');
    if (innerWidth >= 900 && atlas) atlas.setPad(padding());
    $('[data-x]', panel).addEventListener('click', closePanel);
    LG.syncFavs && LG.syncFavs();
    if (g && !reduce) g.fromTo(panel, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'expo.out' });
  }
  function closePanel() { if (atlas && !state.solo) { atlas.spot(false); state.spot = ''; } panel.classList.remove('pn-peek'); panel.hidden = true; page.classList.remove('has-panel'); state.fromList = false; if (atlas) { if (innerWidth >= 900) atlas.setPad(padding()); if (!state.solo) atlas.clearActive(); } }
  // Téléphone : glisser la fiche vers le bas pour la fermer
  let sw = null;
  panel.addEventListener('touchstart', (e) => { sw = panel.scrollTop <= 0 && innerWidth < 900 ? { y: e.touches[0].clientY, d: 0 } : null; }, { passive: true });
  panel.addEventListener('touchmove', (e) => { if (!sw) return; sw.d = Math.max(0, e.touches[0].clientY - sw.y); panel.style.transform = `translateY(${sw.d}px)`; }, { passive: true });
  panel.addEventListener('touchend', () => { if (!sw) return; const d = sw.d; sw = null; panel.style.transform = ''; if (d > 90) closePanel(); });

  // ---------- nombre de repères visibles (bouton Liste) ----------
  let cvT = 0;
  function countView() { if (cvT) return; cvT = setTimeout(() => { cvT = 0; const el = $('[data-n="vue"]'); if (el && atlas) el.textContent = atlas.inView().length; }, 200); }

  // ---------- précédent / suivant dans la même catégorie ----------
  function sameCat(f) { return atlas.feats().filter((x) => !x.label && x.cat === f.cat && shown.has(x.cat)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')); }
  function nav(f) {
    const list = sameCat(f), i = list.findIndex((x) => x.id === f.id), c = cats[f.cat] || {};
    if (list.length < 2 && !state.fromList) return '';
    const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    return `<div class="pn-nav">${state.fromList ? `<button type="button" class="pn-navb pn-navb--txt" data-back>${ic('list')}<span>${state.fromList === 'answer' ? 'Retour' : 'Liste'}</span></button>` : ''}
      ${list.length > 1 ? `<button type="button" class="pn-navb" data-go="${escH(prev.id)}" aria-label="Précédent : ${escH(prev.nom)}">${ic('arrow-left')}</button>
      <span class="pn-navn">${i + 1} / ${list.length} <small>${escH((c.nom || '').toLowerCase())}</small></span>
      <button type="button" class="pn-navb" data-go="${escH(next.id)}" aria-label="Suivant : ${escH(next.nom)}">${ic('arrow-right')}</button>` : ''}</div>`;
  }
  function go(id) { const f = atlas.feats().find((x) => x.id === id); if (f) { ensureShown(f); atlas.select(f, { fly: true, s: Math.max(atlas.cam.s, .3) }); } }
  function bindNav() {
    $$('[data-go]', panel).forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
    const bk = $('[data-back]', panel); if (bk) bk.addEventListener('click', () => (state.fromList === 'answer' && state.sel ? openAnswer(state.sel) : openList()));
  }

  // ---------- liste des repères visibles ----------
  function openList() {
    const list = atlas.inView();
    const by = {}; list.forEach((f) => { (by[f.cat] ||= []).push(f); });
    const groups = Object.keys(cats).filter((k) => by[k]).map((k) => {
      const c = cats[k];
      return `<section class="pn-lg" style="--c:${c.color}"><h3><i></i>${escH(c.nom)} <small>${by[k].length}</small></h3>
        <ul>${by[k].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(li).join('')}</ul></section>`;
    }).join('');
    showPanel(`${head('list', '#ff2bd6', 'Dans cette partie de la carte', list.length ? `${list.length} point${list.length > 1 ? 's' : ''} à voir` : 'Aucun point ici')}
      ${list.length ? `<p class="pn-hint">Touche un nom pour voir ce que c'est et où aller.</p>${groups}` : '<p>Déplace la carte ou dézoome pour trouver des points.</p>'}`);
    bindPick('list');
  }
  const li = (f) => `<li${trouves.has(f.id) ? ' class="is-found"' : ''}><button type="button" data-pick="${escH(f.id)}"><span class="pn-li-i">${ic(trouves.has(f.id) ? 'check' : f.icon)}</span><span><b>${escH(f.nom)}</b><small>${escH(sousLigne(f))}</small></span>${ic('arrow-right')}</button></li>`;
  function bindPick(from) {
    $$('[data-pick]', panel).forEach((b) => b.addEventListener('click', () => { const f = atlas.feats().find((x) => x.id === b.dataset.pick); if (!f) return; state.fromList = from; atlas.select(f, { fly: true, s: Math.max(atlas.cam.s, .3) }); }));
  }

  // ---------- « Je cherche… » : la réponse, rangée par type ----------
  function openAnswer(id) {
    const c = cats[id]; if (!c) return;
    const list = atlas.feats().filter((f) => f.cat === id && !f.label);
    const by = {}; list.forEach((f) => { (by[sousNom(f)] ||= []).push(f); });
    const groups = Object.keys(by).sort((a, b) => by[b].length - by[a].length || a.localeCompare(b, 'fr'));
    const nf = list.filter((f) => trouves.has(f.id)).length;
    showPanel(`${head(c.icon, c.color, 'Je cherche : ' + c.q.toLowerCase(), c.sens)}
      <div class="pn-ans-meta"><span>${list.length} endroit${list.length > 1 ? 's' : ''} sur la carte</span>${nf ? `<span class="pn-found-n">${ic('check')}${nf} trouvé${nf > 1 ? 's' : ''}</span>` : ''}</div>
      ${groups.length > 1 ? `<div class="pn-jump">${groups.map((gn, i) => `<a href="#pn-g${i}">${escH(gn)} <small>${by[gn].length}</small></a>`).join('')}</div>` : ''}
      <p class="pn-hint">Touche un nom : la carte t'y emmène et te dit quoi faire.</p>
      ${groups.map((gn, i) => `<section class="pn-lg" id="pn-g${i}" style="--c:${c.color}"><h3><i></i>${escH(gn)} <small>${by[gn].length}</small></h3><ul>${by[gn].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(li).join('')}</ul></section>`).join('')}
      <div class="pn-act"><button type="button" class="nbtn" data-allcats><span>Tout afficher</span><i>${ic('map')}</i></button></div>`);
    bindPick('answer');
    $$('.pn-jump a', panel).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const t = $(a.getAttribute('href'), panel); if (t) panel.scrollTo({ top: t.offsetTop - 8, behavior: 'smooth' }); }));
    $('[data-allcats]', panel).addEventListener('click', () => { choose(''); closePanel(); });
  }

  // ---------- aide : comment utiliser la carte + légende ----------
  function openHelp() {
    store.set('lg-carte-aide', '1');
    const dot = (c, icn, cls = '') => `<span class="hl-dot ${cls}" style="--c:${c}">${ic(icn)}</span>`;
    showPanel(`${head('question', '#19d3e3', "Mode d'emploi", 'Comment utiliser la carte')}
      <ol class="hl-steps">
        <li><span class="hl-dot hl-gest">${ic('search')}</span><span><b>Dis ce que tu cherches</b>Touche « Une arme », « Une voiture », « Un magasin »… en haut : la carte ne garde que ça et te donne la liste.</span></li>
      </ol>
      <h3 class="hl-h">Les couleurs</h3>
      <ul class="hl-leg">${Object.values(cats).map((c) => `<li>${dot(c.color, c.icon)}<span><b>${escH(c.nom)}</b>${escH(c.sens || '')}</span></li>`).join('')}
        <li>${dot('#ff9a1f', 'pin', 'hl-dash')}<span><b>Bord en pointillés</b>Position approximative : cherche dans le coin.</span></li></ul>
      <h3 class="hl-h">Pour bien t'en servir</h3>
      <ol class="hl-steps">
        <li>${dot('#ff9a1f', 'car')}<span><b>Touche un rond coloré</b>Tu vois ce que c'est, où aller, quoi faire et ce qu'il y a de plus proche.</span></li>
        <li><span class="hl-dot hl-cl" style="--ring:conic-gradient(#39ff88 0 40%,#ff9a1f 40% 70%,#ffd23f 70%)"><b>12</b></span><span><b>Un rond avec un chiffre ?</b>Il regroupe plusieurs points. Touche-le pour zoomer dessus.</span></li>
        <li><span class="hl-dot hl-gest">${ic('expand')}</span><span><b>Zoome et déplace-toi</b>Pince avec deux doigts (ou molette, ou + et −). Glisse pour te déplacer.</span></li>
        <li><span class="hl-dot hl-gest">${ic('list')}</span><span><b>Tu préfères une liste ?</b>Le bouton « Liste » montre tous les points visibles à l'écran.</span></li>
        <li><span class="hl-dot hl-gest">${ic('check')}</span><span><b>Coche ce que tu as trouvé</b>Les boutons « Je l'ai trouvé » et « J'y suis allé » gardent ta progression sur cet appareil.</span></li>
      </ol>
      <div class="pn-act"><button type="button" class="nbtn nbtn--primary" data-ok><span>C'est parti</span><i>${ic('arrow-right')}</i></button></div>`);
    $('[data-ok]', panel).addEventListener('click', closePanel);
  }
  const head = (icon, color, kicker, title) => `<div class="pn-h"><span class="pn-ico" style="--c:${color}">${ic(icon)}</span><div><small>${escH(kicker)}</small><h2>${escH(title)}</h2></div><button type="button" class="pn-x" data-x aria-label="Fermer">${ic('x')}</button></div>`;
  function openFeature(f) {
    if (state.spot && state.spot !== f.id) { state.spot = ''; atlas.spot(false); panel.classList.remove('pn-peek'); }
    const c = cats[f.cat] || {}; const r = regions[f.region]; const st = STAT[f.statut] || STAT['a-verifier'];
    const favType = f.cat === 'vehicules' ? 'vehicule' : 'lieu';
    const fav = { id: f.cat === 'vehicules' ? f.id.replace(/^v-/, '') : f.id, type: favType, t: f.nom, u: f.cat === 'vehicules' ? f.url : `carte/?focus=${f.id}`, i: f.icon, c: c.color };
    const t = f.tip;
    const place = /^[sm]-/.test(f.id) || (f.service && f.cat !== 'vehicules'); // un endroit : son nom en titre, l'astuce en dessous
    const ou = f.lieuNom ? `${f.lieuNom}${r ? ' · ' + r.nom : ''}` : (r ? r.nom : (f.desc || '').split('.')[0].replace(/^[^·]*· /, ''));
    const precision = f.precision === 'region' ? 'Emplacement à confirmer dans cette zone' : f.src === 'ogm' ? 'Position relevée par les joueurs (Open GTA 6 Map)' : 'Position approximative (carte communautaire)';
    const where = `<div class="pn-where" style="--c:${c.color}"><span class="pn-where-k">${ic('pin')}Où aller</span><b>${escH(f.nom)}</b>${ou && ou !== f.nom ? `<span>${escH(ou)}</span>` : ''}${f.acces ? `<span class="pn-where-go">${ic('compass')}${escH(f.acces)}</span>` : ''}<small>${precision}</small></div>`;
    const tags = `<div class="pn-tags"><span class="pn-tag ${st[1]}">${st[0]}</span></div>`;
    const favBtn = `<button type="button" class="pn-fav fav" data-fav='${escH(JSON.stringify(fav))}' aria-pressed="false" aria-label="Ajouter aux favoris">${ic('heart')}</button>`;
    const body = t
      ? `${where}<div class="pn-tip" style="--c:${c.color}">${place ? `<p class="pn-tip-q">${ic('bolt')}${escH(t.titre)}</p>` : ''}<p class="pn-a">${escH(t.reponse)}</p>
         <div class="pn-act"><a class="nbtn nbtn--primary" href="${ROOT}${t.lien}"><span>${escH(t.libelle)}</span><i>${ic('arrow-right')}</i></a>${favBtn}</div>
         <ol class="pn-steps">${t.etapes.map((e) => `<li>${escH(e)}</li>`).join('')}</ol></div>${tags}`
      : `${where}${f.missions || !f.desc ? '' : f.en ? `<p class="pn-en"><small>${ic('info')}Indication des joueurs, en anglais :</small>${escH(f.desc || '')}</p>` : `<p>${escH(f.desc || '')}</p>`}
         <div class="pn-act">${f.url ? `<a class="nbtn nbtn--primary" href="${ROOT}${f.url}"><span>Voir la fiche</span><i>${ic('arrow-right')}</i></a>` : f.ext ? `<a class="nbtn${f.ph ? ' nbtn--primary' : ''}" href="${f.ext}" target="_blank" rel="noopener"><span>${f.ph ? 'Voir la photo du lieu' : 'Détail : Open GTA 6 Map'}</span><i>${ic(f.ph ? 'eye' : 'arrow-right')}</i></a>` : f.src === 'ogm' ? '' : `<a class="nbtn" href="https://map.gtadb.org" target="_blank" rel="noopener"><span>Source : GTADB</span><i>${ic('arrow-right')}</i></a>`}${favBtn}</div>${tags}`;
    const quoi = t && !place ? t.type : `${c.nom || ''}${f.service ? ' · ' + f.service : ''}`;
    const cap = [f.imgNote ? `<b>${escH(f.imgNote)}</b>` : '', f.imgCredit ? 'Image : ' + escH(f.imgCredit) : ''].filter(Boolean).join(' · ');
    const img = f.img ? `<figure class="pn-img${f.img3d ? ' pn-img--3d' : ''}" style="--c:${c.color}"><img src="${ROOT}${f.img}" alt="${escH(f.nom)}${f.img3d ? ' en 3D' : ''}" decoding="async">${cap ? `<figcaption>${cap}${f.img3d ? ' · <a href="' + ROOT + f.url + '">la faire tourner</a>' : ''}</figcaption>` : ''}</figure>` : '';
    const mis = f.missions ? `<div class="pn-mis"><h3>${ic('flag')}Les missions ici</h3><ul>${[...f.missions].sort((a, b) => (b.id === params.get('mission')) - (a.id === params.get('mission'))).map((m) => `<li${m.id === params.get('mission') ? ' class="is-cur"' : ''}><a href="${ROOT}missions/#${escH(m.id)}">${m.id === params.get('mission') ? '<em class="pn-mis-cur">Ta mission</em>' : ''}<span class="pn-mis-n">${m.n || '+'}</span><span><b>${escH(m.t)}</b><small>${m.c === 'prologue' ? 'Prologue' : 'Chapitre ' + m.c} · ${escH(m.r)}</small></span>${ic('arrow-right')}</a></li>`).join('')}</ul></div>` : '';
    const prox = BESOINS.map(([lab, icn, court]) => {
      let best = null, bd = Infinity;
      atlas.feats().forEach((x) => { if (x.id !== f.id && !x.label && lab.includes(x.service)) { const dd = Math.hypot(x.x - f.x, x.y - f.y); if (dd < bd) { bd = dd; best = x; } } });
      return best && !lab.includes(f.service) ? `<li><button type="button" data-go="${escH(best.id)}"><span class="pn-li-i">${ic(icn)}</span><span><b>${escH(court)}</b><small>${escH(best.nom)}</small></span><em>${km(bd)}</em></button></li>` : '';
    }).filter(Boolean).slice(0, 4).join('');
    const proche = prox ? `<details class="pn-near"${innerWidth >= 900 ? ' open' : ''}><summary>${ic('compass')}Le plus proche d'ici</summary><ul>${prox}</ul><p class="pn-near-n">Distances à vol d'oiseau, environ.</p></details>` : '';
    const isT = trouves.has(f.id);
    const outils = `<div class="pn-tools"><button type="button" class="pn-tool" data-found aria-pressed="${isT}">${ic('check')}<span>${foundTxt(f, isT)}</span></button><button type="button" class="pn-tool" data-share>${ic('share')}<span>Partager</span></button></div>`;
    showPanel(`${head(f.icon, c.color, quoi, t && !place ? t.titre : f.nom)}${img}${mis}${body}${outils}${proche}${nav(f)}`);
    bindNav();
    $('[data-found]', panel).addEventListener('click', (e) => {
      const b = e.currentTarget, on = !trouves.has(f.id);
      on ? trouves.add(f.id) : trouves.delete(f.id); saveT();
      b.setAttribute('aria-pressed', on); b.querySelector('span').textContent = foundTxt(f, on);
      atlas.markFound && atlas.markFound(trouves);
    });
    $('[data-share]', panel).addEventListener('click', async () => {
      const u = new URL(location.href); u.search = ''; u.searchParams.set('focus', f.id);
      try { if (navigator.share && innerWidth < 900) await navigator.share({ title: f.nom, url: u.href }); else { await navigator.clipboard.writeText(u.href); LG.toast && LG.toast('Lien copié', 'check'); } } catch (err) { /* annulé */ }
    });
    panel.classList.toggle('pn-peek', !!state.spot && innerWidth < 900);
    // la fiche s'ouvre en haut, titre visible ; ta mission est en tête de liste
    panel.scrollTop = 0;
    if (innerWidth < 900) {
      // le point se place au milieu de l'espace libre entre la barre du haut et la fiche
      const ts = Math.max(atlas.cam.s, state.spot ? .45 : .3), sr = stage.getBoundingClientRect();
      const y0 = top.getBoundingClientRect().bottom - sr.top, y1 = panel.getBoundingClientRect().top - sr.top;
      atlas.flyTo(f.x, f.y - (sr.height / 2 - ((y0 + y1) / 2 - (state.spot ? 16 : 0))) / ts, ts); // un peu plus haut : le nom du lieu tient sous le point
    }
  }
  function openCommu(p) {
    const k = commuCats[p.c] || { nom: 'Lieu' };
    showPanel(`${head('pin', '#c7c2e0', 'Lieu de la communauté · ' + k.nom, p.n)}
      <div class="pn-tags">${p.z ? `<span class="pn-tag">${escH(p.z)}</span>` : ''}<span class="pn-tag pn-tag--warn">${p.d ? 'Nom ou position douteux' : 'Position approximative'}</span></div>
      <p>Repéré par les contributeurs de GTADB d'après les bandes-annonces et le jeu. Ce n'est pas une information vérifiée par notre équipe.</p>
      <div class="pn-act"><a class="nbtn" href="https://map.gtadb.org" target="_blank" rel="noopener"><span>Source : GTADB</span><i>${ic('arrow-right')}</i></a></div>`);
    if (innerWidth < 900) { const ts = Math.max(atlas.cam.s, .5); atlas.flyTo(p.x, p.y - (panel.offsetHeight / 2 + 10) / ts, ts); }
  }
  function openRegion(r) {
    if (!r) return;
    const list = atlas.feats().filter((f) => f.region === r.id && !f.label);
    const by = {}; list.forEach((f) => { by[f.cat] = (by[f.cat] || 0) + 1; });
    showPanel(`${head('map', r.couleur, 'Région', r.nom)}
      <div class="pn-tags">${Object.entries(by).map(([c, n]) => `<span class="pn-tag">${n} ${escH((cats[c] || {}).nom || c).toLowerCase()}</span>`).join('') || '<span class="pn-tag">Pas encore de repère du guide</span>'}</div>
      <div class="pn-act"><a class="nbtn nbtn--primary" href="${ROOT}encyclopedie/${r.id}/"><span>Lire la fiche</span><i>${ic('arrow-right')}</i></a></div>`);
    atlas.flyTo(r.label[0], r.label[1], .12);
  }

  // ---------- recherche ----------
  function search(q) {
    const qn = norm(q); if (!qn) return [];
    const toks = qn.split(' ').filter(Boolean);
    const score = (name, extra) => {
      const w = norm(name).split(' '), e = norm(extra).split(' ');
      let s = 0, hit = 0;
      toks.forEach((t) => { const m = Math.max((LG.tokMatch ? LG.tokMatch(t, w) : w.includes(t) ? 1 : 0) * 2, LG.tokMatch ? LG.tokMatch(t, e) : 0); s += m; if (m) hit++; });
      return hit === toks.length ? s : 0;
    };
    const out = [];
    atlas.feats().forEach((f) => { const s = score(f.nom, `${(cats[f.cat] || {}).nom} ${f.desc || ''}`); if (s) out.push({ s: s + 1, f }); });
    commu.forEach((p) => { const s = score(p.n, p.z); if (s) out.push({ s, p }); });
    return out.sort((a, b) => b.s - a.s).slice(0, 8);
  }
  function bind() {
    const input = $('#atp-q'), sugg = $('#atp-sugg'); let res = [], sel = 0;
    const draw = () => {
      res = search(input.value); sel = 0; sugg.hidden = !input.value.trim();
      sugg.innerHTML = res.length ? res.map((r, i) => {
        const f = r.f, p = r.p;
        return f ? `<button type="button" role="option" data-i="${i}" aria-selected="${i === 0}" style="--c:${(cats[f.cat] || {}).color}"><i></i><span><b>${escH(f.nom)}</b><small>${escH((cats[f.cat] || {}).nom || '')}${regions[f.region] ? ' · ' + escH(regions[f.region].nom) : ''}</small></span></button>`
          : `<button type="button" role="option" data-i="${i}" aria-selected="${i === 0}" style="--c:#c7c2e0"><i></i><span><b>${escH(p.n)}</b><small>Communauté${p.z ? ' · ' + escH(p.z) : ''}</small></span></button>`;
      }).join('') : '<p>Aucun lieu trouvé. Essaie un autre mot.</p>';
      $$('[data-i]', sugg).forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
    };
    const pick = (i) => {
      const r = res[i]; if (!r) return; sugg.hidden = true; input.blur();
      if (r.f) {
        if (r.f.label) return openRegion(regions[r.f.id]);
        ensureShown(r.f);
        atlas.select(r.f, { fly: innerWidth >= 900, s: .32 });
      } else {
        if (!state.commu) { state.commu = true; syncChips(); applyFilter(); }
        atlas.select({ ...r.p, commu: true, x: r.p.x, y: r.p.y }, { fly: innerWidth >= 900, s: .5 });
      }
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(res.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); $$('[data-i]', sugg).forEach((b, i) => b.setAttribute('aria-selected', i === sel)); }
      if (e.key === 'Escape') { input.value = ''; sugg.hidden = true; }
    });
    input.addEventListener('blur', () => setTimeout(() => { sugg.hidden = true; }, 180));
    $$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.cat;
      if (state.sel === id) { choose(''); closePanel(); return; }
      choose(id); openAnswer(id);
      b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }));
    $('[data-all]').addEventListener('click', () => { choose(''); closePanel(); atlas.reset(); });
    $('[data-solo-off]').addEventListener('click', () => { choose(''); closePanel(); });
    $('[data-commu]').addEventListener('click', () => {
      if (state.solo) { unsolo(); choose(''); }
      state.commu = !state.commu; syncChips(); applyFilter();
      if (state.commu && atlas.cam.s < .07) { atlas.flyTo(-900, 600, .14); LG.toast && LG.toast('Zoome pour voir les lieux de la communauté', 'info'); }
    });
    $$('[data-z]').forEach((b) => b.addEventListener('click', () => { const z = b.dataset.z; if (z === 'in') atlas.zoomIn(); else if (z === 'out') atlas.zoomOut(); else { closePanel(); atlas.reset(); } }));
    $$('[data-reg]').forEach((b) => b.addEventListener('click', () => openRegion(regions[b.dataset.reg])));
    $('[data-list]').addEventListener('click', () => { state.fromList = false; openList(); });
    $('[data-help]').addEventListener('click', openHelp);
    const src = $('.at-attrib--page'); if (src && innerWidth >= 900) src.open = true;
    countView();
    addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => atlas.setPad(padding()), 150); });
  }
})();
