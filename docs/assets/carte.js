/* GTA 6 Facile — page carte plein écran : filtres (catégories, sous-catégories, options), recherches populaires,
   recherche tolérante, fiches, progression. Configuration des catégories : data/site.json (categories.carte, carteOptions). */
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
  const stage = $('.atp-stage'), panel = $('[data-panel]'), top = $('.atp-top');
  const params = new URLSearchParams(location.search);
  let atlas, D, OPT = {}, commu = [], commuCats = {}, cats = {}, regions = {}, sousNoms = {}, subNoms = {};
  // ---------- état des filtres ----------
  // sel : catégories choisies ; subs : sous-catégories choisies par catégorie (vide = toute la catégorie)
  const sel = new Set(), subs = {};
  const DEF = { verif: false, cacheT: false, rares: false, spoil: false, favs: false, approx: true, sect: '' };
  const opt = { ...DEF };
  const state = { commu: false, fromList: false, vide: true, solo: '', spot: '', choisi: null, pop: '' };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } } };
  // points marqués « trouvé » (gardés sur cet appareil, synchronisés par le compte s'il existe : même clé qu'avant)
  const KEY_T = 'lg:carte-trouves';
  let trouves = new Set(); try { trouves = new Set(JSON.parse(store.get(KEY_T) || '[]')); } catch (e) { /* */ }
  const saveT = () => store.set(KEY_T, JSON.stringify([...trouves]));
  let dernier = null; // dernière action « trouvé », pour pouvoir l'annuler
  // clics sur les recherches populaires : comptés sur cet appareil (et en compteur anonyme s'il est actif), jamais affichés comme des statistiques
  const KEY_POP = 'lg:carte-pop';
  const favs = () => { try { return (LG.store ? LG.store.get('favs', []) : JSON.parse(store.get('lg:favs') || '[]')) || []; } catch (e) { return []; } };
  // ce qu'on cherche souvent : le plus proche, depuis n'importe quel point
  const BESOINS = [[['Armurerie'], 'gun', 'Armurerie'], [['Hôpital'], 'heart', 'Hôpital'], [['Station-service'], 'bolt', 'Station-service'], [['Garage auto', "Pay 'n' Spray"], 'spray', 'Garage ou Pay \'n\' Spray'], [['Vêtements'], 'user', 'Vêtements'], [['Planque'], 'home', 'Planque']];
  const foundTxt = (f, on) => (f.cat === 'collection' ? (on ? 'Trouvé' : 'Marquer comme trouvé') : (on ? 'Visité' : 'Marquer comme visité'));
  // ---------- fiabilité : officiel / vérifié / probable / non confirmé (jamais déduit des seules coordonnées) ----------
  const sourceTxt = (f) => (/^o-/.test(f.id) ? 'Open GTA 6 Map (joueurs)' : /^w-/.test(f.id) ? 'GTA Wiki (joueurs)' : /^s-/.test(f.id) ? 'GTADB (joueurs)' : 'fiche du guide');
  function fiab(f) {
    const pos = f.precision === 'exacte' ? 'position précise selon la source' : f.precision === 'region' ? 'zone seulement' : 'position approximative';
    if (f.statut === 'teste') return { n: 'Vérifié en jeu', cls: 'pn-tag--ok', t: pos };
    if (f.statut === 'confirme' && !/^[osw]-/.test(f.id)) return { n: 'Lieu officiel', cls: 'pn-tag--ok', t: `existence confirmée, ${pos}` };
    if (approx(f) || /^v-/.test(f.id)) return { n: 'Non confirmé', cls: 'pn-tag--warn', t: `${pos} · ${sourceTxt(f)}` };
    return { n: 'Probable', cls: 'pn-tag--info', t: `signalé par une source, ${pos} · ${sourceTxt(f)}` };
  }
  const approx = (f) => f.precision === 'region' || f.precision === 'inconnue' || f.statut === 'provisoire';
  const km = (d) => (d < 950 ? `${Math.max(100, Math.round(d / 100) * 100)} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`);
  // secteur : quartier de la source, sinon la région du guide
  const secteur = (f) => (f.zone ? f.zone.split(',').pop().trim() : '') || (regions[f.region] || {}).nom || '';
  const sousLigne = (f) => { const z = f.zone || f.lieuNom || (regions[f.region] || {}).nom || ''; return z && !f.nom.includes(z.split(',')[0]) ? z : (f.service || (f.tip ? f.tip.titre : '') || z); };
  // sous-catégories d'un repère dans une catégorie donnée
  const scDe = (f, c) => (f.sc || []).filter((s) => (f.cat === c ? !s.includes(':') : s.startsWith(c + ':'))).map((s) => s.replace(/^.*:/, ''));
  const dans = (f, c) => f.cat === c || (f.tg || []).includes(c);
  const sousNom = (f) => { const s = scDe(f, f.cat)[0]; return (s && subNoms[f.cat + ':' + s]) || f.service || sousNoms[f.sous] || (cats[f.cat] || {}).nom || ''; };
  const catsDe = (f) => [f.cat, ...(f.tg || [])];

  Promise.all([fetch(ROOT + 'data/carte.json').then((r) => r.json()), fetch(ROOT + 'data/communaute.json').then((r) => r.json()).catch(() => ({ lieux: [], categories: [] }))]).then(([d, c]) => {
    D = d; OPT = d.options || {}; commu = c.lieux; c.categories.forEach((k) => { commuCats[k.id] = k; });
    d.categories.forEach((k) => { cats[k.id] = k; k.sous.forEach((s) => { subNoms[k.id + ':' + s.id] = s.nom; }); });
    d.regions.forEach((r) => { regions[r.id] = r; });
    Object.values(d.sousTypes || {}).forEach((L) => L.forEach((x) => { sousNoms[x.id] = x.nom; }));
    lireURL();
    atlas = window.Atlas(stage, {
      root: ROOT, tuiles: d.tuiles, carte: d, pad: padding(),
      onSelect: (f, o2 = {}) => { state.choisi = f; garde(false); const r = f.commu ? openCommu(f) : openFeature(f); visible(f, o2.fly ? 1050 : 380); return r; },
      onRegion: openRegion, onBlank: closePanel, onView: countView, onCluster: openCluster
    });
    atlas.setCommu(commu); atlas.markFound(trouves);
    comptes(); sync(); applyFilter();
    const focus = params.get('focus');
    const f = focus && atlas.feats().find((x) => x.id === focus);
    // arrivée par un lien (mission, lieu…) : le point est mis en avant, le reste s'efface
    if (f) setTimeout(() => { if (f.label) return openRegion(regions[f.id]); ensureShown(f); state.spot = f.id; atlas.spot(true); if (params.get('mission')) solo(f); atlas.select(f, { fly: innerWidth >= 900 || cote(), s: .45 }); }, 250);
    else if (params.get('region') && regions[params.get('region')]) setTimeout(() => openRegion(regions[params.get('region')]), 250);
    else if (!state.vide && sel.size) setTimeout(() => { openResults(); fitResults(); }, 300);
    bind();
    if (g && !reduce) g.from('.atp-top > *, .atp-ctrl > *', { opacity: 0, y: -10, duration: .6, stagger: .03, ease: 'expo.out' });
  }).catch((e) => { stage.textContent = 'Carte indisponible pour le moment.'; if (window.console) console.warn(e); });

  // ---------- lien partageable : ?cat=a,b&sc=a:x&f=rares,cacheT&sect=Vice City ----------
  function lireURL() {
    // anciens liens (?cat=lieux…) : redirigés vers la nouvelle catégorie et sa sous-catégorie
    const al = OPT.alias || {}, scAl = [];
    const cs = (params.get('cat') || '').split(',').map((x) => { const a = al[x]; if (!a) return x; const [c, s] = a.split(':'); if (s) scAl.push(c + ':' + s); return c; }).filter((x) => cats[x]);
    if (params.get('cat') === 'tout') { state.vide = false; Object.keys(cats).forEach((k) => sel.add(k)); }
    cs.forEach((x) => sel.add(x));
    [...(params.get('sc') || '').split(','), ...scAl].filter(Boolean).forEach((s) => {
      const [c, id] = s.includes(':') ? s.split(':') : [cs[0], s];
      if (sel.has(c) && subNoms[c + ':' + id]) (subs[c] ||= new Set()).add(id);
    });
    (params.get('f') || '').split(',').forEach((k) => { if (k in DEF && typeof DEF[k] === 'boolean') opt[k] = k !== 'approx'; if (k === 'sansapprox') opt.approx = false; });
    if (params.get('sect')) opt.sect = params.get('sect');
    if (sel.size) state.vide = false;
    if (params.get('pop')) { const p = (OPT.populaires || []).find((x) => x.id === params.get('pop')); if (p) { state.pop = p.id; appliquerPop(p, true); } }
  }
  function ecrireURL() {
    const u = new URL(location.href);
    ['cat', 'sc', 'f', 'sect', 'pop', 'focus', 'mission'].forEach((k) => u.searchParams.delete(k));
    if (state.pop) u.searchParams.set('pop', state.pop);
    else if (!state.vide) {
      const tout = sel.size === Object.keys(cats).length && !Object.values(subs).some((s) => s.size);
      u.searchParams.set('cat', tout ? 'tout' : [...sel].join(','));
      const sc = [...sel].flatMap((c) => [...(subs[c] || [])].map((s) => (sel.size === 1 ? s : c + ':' + s)));
      if (sc.length) u.searchParams.set('sc', sc.join(','));
    }
    const fl = ['verif', 'cacheT', 'rares', 'spoil', 'favs'].filter((k) => opt[k]); if (!opt.approx) fl.push('sansapprox');
    if (fl.length) u.searchParams.set('f', fl.join(','));
    if (opt.sect) u.searchParams.set('sect', opt.sect);
    history.replaceState(null, '', u);
  }

  // ---------- filtre unique, appliqué aux repères ET aux listes ----------
  function passeCat(f) {
    if (state.vide) return false;
    for (const c of sel) {
      if (!dans(f, c)) continue;
      const s = subs[c]; if (!s || !s.size) return true;
      if (scDe(f, c).some((x) => s.has(x))) return true;
    }
    return false;
  }
  let favSet = new Set();
  const lireFavs = () => { favSet = new Set(favs().map((x) => x.type + ':' + x.id)); };
  const estFav = (f) => favSet.has('lieu:' + f.id) || (f.vs && favSet.has('vehicule:' + f.vs)) || (/^v-/.test(f.id) && favSet.has('vehicule:' + f.id.slice(2)));
  function passeOpt(f) {
    if (opt.verif && f.statut !== 'teste') return false;
    if (opt.cacheT && trouves.has(f.id)) return false;
    if (opt.rares && !f.rar) return false;
    if (opt.spoil && f.cat === 'missions' && f.missions) return false;
    if (opt.favs && !estFav(f)) return false;
    if (!opt.approx && approx(f)) return false;
    if (opt.sect && secteur(f) !== opt.sect) return false;
    return true;
  }
  const passe = (f) => !f.label && passeCat(f) && passeOpt(f);
  const resultats = () => atlas.feats().filter(passe);
  function applyFilter() {
    lireFavs();
    atlas.setFilter((f) => (state.solo ? f.id === state.solo : passe(f)));
    atlas.showCommu(state.commu && !state.solo); countView(); sync();
  }
  const nbOpts = () => ['verif', 'cacheT', 'rares', 'spoil', 'favs'].filter((k) => opt[k]).length + (!opt.approx ? 1 : 0) + (opt.sect ? 1 : 0) + (state.commu ? 1 : 0);
  const filtresActifs = () => !state.vide || nbOpts() > 0;
  // nombres affichés sur les boutons : repères de la catégorie (options comprises)
  function comptes() {
    lireFavs();
    const all = atlas.feats().filter((f) => !f.label && passeOpt(f));
    $$('[data-n]').forEach((el) => { const k = el.dataset.n; if (cats[k]) el.textContent = all.filter((f) => dans(f, k)).length; });
    const t = $('[data-n="tout"]'); if (t) t.textContent = all.length;
  }
  function sync() {
    const tout = !state.vide && sel.size === Object.keys(cats).length && !Object.values(subs).some((s) => s && s.size);
    $$('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', !state.solo && !tout && sel.has(b.dataset.cat)));
    $('[data-all]').setAttribute('aria-pressed', !state.solo && tout);
    $$('[data-pop]').forEach((b) => b.setAttribute('aria-pressed', state.pop === b.dataset.pop));
    const n = nbOpts() + (state.vide || tout ? 0 : [...sel].filter((c) => !(OPT.rapides || []).includes(c) || (subs[c] && subs[c].size)).length);
    const nf = $('[data-nf]'); nf.hidden = !n; nf.textContent = n;
    $('[data-reset]').hidden = !filtresActifs();
    const hv = $('[data-vide]'); if (hv) hv.hidden = !state.vide || !panel.hidden || !!state.solo;
    ecrireURL();
  }
  // ---------- choisir ----------
  function choisirCats(ids, scs) {
    unsolo(); sel.clear(); Object.keys(subs).forEach((k) => delete subs[k]);
    ids.forEach((c) => { if (cats[c]) sel.add(c); });
    if (scs) Object.entries(scs).forEach(([c, L]) => { const s = L.filter((x) => subNoms[c + ':' + x]); if (s.length) subs[c] = new Set(s); });
    state.vide = !sel.size; applyFilter();
  }
  const tout = () => { state.pop = ''; choisirCats(Object.keys(cats)); };
  function reset() {
    state.pop = ''; Object.assign(opt, DEF); state.commu = false;
    choisirCats([]); state.vide = true; comptes(); applyFilter(); closePanel();
  }
  function appliquerPop(p, init) {
    state.pop = p.id;
    if (init) { sel.add(p.cat); if (p.sc && p.sc.length) subs[p.cat] = new Set(p.sc.filter((x) => subNoms[p.cat + ':' + x])); state.vide = false; return; }
    choisirCats([p.cat], p.sc && p.sc.length ? { [p.cat]: p.sc } : null); state.pop = p.id; sync();
    try { const m = JSON.parse(store.get(KEY_POP) || '{}'); m[p.id] = (m[p.id] || 0) + 1; store.set(KEY_POP, JSON.stringify(m)); } catch (e) { /* */ }
    if (window.LG_EVT) try { window.LG_EVT('carte-pop/' + p.id); } catch (e) { /* */ }
  }
  function ensureShown(f) {
    if (state.solo ? f.id === state.solo : passe(f)) return;
    if (!passeOpt(f)) { Object.assign(opt, DEF); comptes(); }
    if (!passeCat(f)) { state.pop = ''; choisirCats([f.cat]); } else applyFilter();
  }
  function solo(f) {
    state.solo = f.id;
    $('[data-solo-nom]').textContent = f.nom; $('[data-solo]').hidden = false;
    applyFilter();
  }
  function unsolo() { if (!state.solo) return; state.solo = ''; state.spot = ''; $('[data-solo]').hidden = true; atlas.spot(false); }
  function fitResults() { const L = resultats(); if (L.length) atlas.fit(L.length > 400 ? L.filter((_, i) => i % 4 === 0) : L, 1.15); }

  const cote = () => innerWidth < 900 && innerWidth > innerHeight && innerHeight < 520; // téléphone en paysage
  function padding() {
    const mob = innerWidth < 900 && !cote();
    if (cote()) return { top: (top.getBoundingClientRect().bottom - page.getBoundingClientRect().top) + 6, bottom: 80, left: 10, right: panel.hidden ? 10 : Math.round(Math.min(innerWidth * .46, 380)) + 16 };
    return { top: (top.getBoundingClientRect().bottom - page.getBoundingClientRect().top) + 10, bottom: mob ? 140 : 70, left: 10, right: mob ? 10 : (panel.hidden ? 70 : 430) };
  }

  // ---------- panneau (fiche en bas de l'écran sur téléphone, à droite sur ordinateur) ----------
  function showPanel(html) {
    const hv = $('[data-vide]'); if (hv) hv.hidden = true; garde(false); legende(false);
    panel.classList.remove('pn-anim');
    panel.innerHTML = `<button type="button" class="pn-grip" data-grip aria-label="Agrandir le panneau"></button>${html}`; panel.hidden = false; panel.scrollTop = 0; page.classList.add('has-panel');
    taillePanneau(showPanel.grand ? 'grand' : showPanel.moyen ? 'moyen' : 'compact'); showPanel.grand = false; showPanel.moyen = false;
    const bascule = () => { panel.classList.add('pn-anim'); taillePanneau(panel.dataset.taille === 'grand' ? 'compact' : 'grand'); };
    $('[data-grip]', panel).addEventListener('click', bascule);
    const tg = $('[data-tg]', panel); if (tg) tg.addEventListener('click', bascule);
    if ((innerWidth >= 900 || cote()) && atlas) atlas.setPad(padding());
    $('[data-x]', panel).addEventListener('click', closePanel);
    LG.syncFavs && LG.syncFavs();
    if (g && !reduce) g.fromTo(panel, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'expo.out' });
  }
  // repère choisi : il reste marqué sur la carte quand la fiche se ferme, avec un rappel pour le rouvrir ou l'effacer
  function garde(on) {
    const k = $('[data-keep]'); if (!k) return;
    k.hidden = !on || !state.choisi;
    if (!k.hidden) $('[data-keep-nom]', k).textContent = state.choisi.nom || state.choisi.n || '';
    if (!k.hidden) visible(state.choisi);
  }
  // le repère choisi doit être visible : entre la barre du haut et la fiche (ou le bas de l'écran), sans changer le zoom
  function visible(f, attente = 380) {
    if (!atlas || !f || f.x == null) return;
    setTimeout(() => {
      const r = atlas.stage.getBoundingClientRect(), [sx, sy] = atlas.toScreen(f.x, f.y), [fx, fy] = atlas.toScreen(atlas.cam.x, atlas.cam.y);
      const hautEl = $('.atp-top'), haut = (hautEl ? hautEl.getBoundingClientRect().bottom - r.top : 80) + 28;
      const bas = (!panel.hidden && !(innerWidth >= 900 || cote()) ? panel.getBoundingClientRect().top - r.top : r.height - 150) - 28;
      if (sy >= haut && sy <= bas && sx >= 36 && sx <= r.width - 36) return;
      const tx = r.width / 2, ty = bas > haut ? (haut + bas) / 2 - 18 : r.height / 2;
      atlas.flyTo(f.x - (tx - fx) / atlas.cam.s, f.y + (ty - fy) / atlas.cam.s, atlas.cam.s, .7);
    }, attente);
  }
  function closePanel() { if (atlas && !state.solo) { atlas.spot(false); state.spot = ''; } panel.classList.remove('pn-peek'); panel.hidden = true; page.classList.remove('has-panel'); state.fromList = false; if (atlas) { if (innerWidth >= 900 || cote()) atlas.setPad(padding()); if (!state.solo && atlas.active() == null && !state.choisi) atlas.clearActive(); } garde(true); setTimeout(sync, 0); }
  function taillePanneau(t) {
    if (innerWidth >= 900 || cote()) { panel.style.maxHeight = ''; delete panel.dataset.taille; return; }
    const bas = panel.getBoundingClientRect().bottom, haut = top.getBoundingClientRect().top;
    const dispo = Math.max(140, bas - haut - 8);
    panel.dataset.taille = t;
    panel.style.maxHeight = Math.round(t === 'grand' ? dispo : t === 'moyen' ? Math.min(dispo * .66, 380) : Math.min(dispo * .42, 300)) + 'px';
    [$('[data-grip]', panel), $('[data-tg]', panel)].forEach((x) => x && x.setAttribute('aria-label', t === 'grand' ? 'Réduire le panneau' : 'Agrandir le panneau'));
  }
  let sw = null;
  panel.addEventListener('touchstart', (e) => { sw = panel.scrollTop <= 0 && innerWidth < 900 ? { y: e.touches[0].clientY, d: 0 } : null; }, { passive: true });
  panel.addEventListener('touchmove', (e) => { if (!sw) return; sw.d = e.touches[0].clientY - sw.y; if (sw.d > 0) panel.style.transform = `translateY(${sw.d}px)`; }, { passive: true });
  panel.addEventListener('touchend', () => {
    if (!sw) return; const d = sw.d; sw = null; panel.style.transform = '';
    panel.classList.add('pn-anim');
    if (d < -40) taillePanneau('grand');
    else if (d > 70) { if (panel.dataset.taille === 'grand') taillePanneau('compact'); else closePanel(); }
  });
  const head = (icon, color, kicker, title) => `<div class="pn-h"><span class="pn-ico" style="--c:${color}">${ic(icon)}</span><div><small>${escH(kicker)}</small><h2>${escH(title)}</h2></div><button type="button" class="pn-tg" data-tg aria-label="Agrandir le panneau">${ic('chevron')}</button><button type="button" class="pn-x" data-x aria-label="Fermer">${ic('x')}</button></div>`;

  // ---------- nombre de repères visibles (bouton Liste) ----------
  let cvT = 0;
  function countView() { if (cvT) return; cvT = setTimeout(() => { cvT = 0; const el = $('[data-n="vue"]'); if (el && atlas) el.textContent = atlas.inView().length; }, 200); }

  // ---------- précédent / suivant dans les résultats ----------
  function sameCat(f) { return atlas.feats().filter((x) => !x.label && x.cat === f.cat && passe(x)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')); }
  function nav(f) {
    const siens = f.vs ? atlas.feats().filter((x) => x.vs === f.vs) : [];
    if (siens.length > 1) {
      const i = siens.findIndex((x) => x.id === f.id), prev = siens[(i - 1 + siens.length) % siens.length], next = siens[(i + 1) % siens.length];
      return `<div class="pn-nav"><button type="button" class="pn-navb" data-go="${escH(prev.id)}" aria-label="Emplacement précédent">${ic('arrow-left')}</button>
        <span class="pn-navn">Emplacement ${i + 1} / ${siens.length} <small>de ce véhicule</small></span>
        <button type="button" class="pn-navb" data-go="${escH(next.id)}" aria-label="Emplacement suivant">${ic('arrow-right')}</button></div>`;
    }
    const list = sameCat(f), i = list.findIndex((x) => x.id === f.id), c = cats[f.cat] || {};
    if ((list.length < 2 || i < 0) && !state.fromList) return '';
    const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    return `<div class="pn-nav">${state.fromList ? `<button type="button" class="pn-navb pn-navb--txt" data-back>${ic('list')}<span>${state.fromList === 'answer' ? 'Résultats' : 'Liste'}</span></button>` : ''}
      ${list.length > 1 && i >= 0 ? `<button type="button" class="pn-navb" data-go="${escH(prev.id)}" aria-label="Précédent : ${escH(prev.nom)}">${ic('arrow-left')}</button>
      <span class="pn-navn">${i + 1} / ${list.length} <small>${escH((c.court || c.nom || '').toLowerCase())}</small></span>
      <button type="button" class="pn-navb" data-go="${escH(next.id)}" aria-label="Suivant : ${escH(next.nom)}">${ic('arrow-right')}</button>` : ''}</div>`;
  }
  function go(id) { const f = atlas.feats().find((x) => x.id === id); if (f) { ensureShown(f); atlas.select(f, { fly: true, s: Math.max(atlas.cam.s, .3) }); } }
  function bindNav() {
    $$('[data-go]', panel).forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
    const bk = $('[data-back]', panel); if (bk) bk.addEventListener('click', () => (state.fromList === 'answer' ? openResults() : openList()));
  }

  // ---------- listes ----------
  const li = (f) => `<li${trouves.has(f.id) ? ' class="is-found"' : ''}><button type="button" data-pick="${escH(f.id)}"><span class="pn-li-i" style="--c:${(cats[f.cat] || {}).color}">${ic(trouves.has(f.id) ? 'check' : f.icon)}</span><span><b>${escH(f.nom)}</b><small>${escH(sousLigne(f))}</small></span>${ic('arrow-right')}</button></li>`;
  function bindPick(from) {
    $$('[data-pick]', panel).forEach((b) => b.addEventListener('click', () => { const f = atlas.feats().find((x) => x.id === b.dataset.pick); if (!f) return; state.fromList = from; atlas.select(f, { fly: true, s: Math.max(atlas.cam.s, .3) }); }));
  }
  // groupes repliables au-delà de 150 éléments : la liste reste légère sur téléphone
  function groupes(list, cle, color) {
    const by = {}; list.forEach((f) => { (by[cle(f)] ||= []).push(f); });
    const ks = Object.keys(by).sort((a, b) => by[b].length - by[a].length || a.localeCompare(b, 'fr'));
    const gros = list.length > 150;
    return ks.map((k, i) => {
      const items = by[k].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      const c = color(items[0]);
      return gros ? `<details class="pn-lg pn-lgd" style="--c:${c}"${i === 0 ? ' open' : ''}><summary><i></i>${escH(k)} <small>${items.length}</small></summary><ul data-lazy="${i}"></ul></details>`
        : `<section class="pn-lg" style="--c:${c}"><h3><i></i>${escH(k)} <small>${items.length}</small></h3><ul>${items.map(li).join('')}</ul></section>`;
    }).join('') + (gros ? `<template data-groups>${JSON.stringify(ks.map((k) => by[k].map((f) => f.id)))}</template>` : '');
  }
  function bindGroupes(from) {
    const tpl = $('template[data-groups]', panel); const ids = tpl ? JSON.parse(tpl.innerHTML) : null;
    const remplir = (ul) => { if (!ids || ul.dataset.done) return; ul.dataset.done = 1; const F = new Map(atlas.feats().map((f) => [f.id, f])); ul.innerHTML = ids[+ul.dataset.lazy].map((id) => F.get(id)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(li).join(''); bindPick(from); };
    $$('details.pn-lgd', panel).forEach((d) => { if (d.open) remplir($('ul', d)); d.addEventListener('toggle', () => d.open && remplir($('ul', d))); });
    bindPick(from);
  }
  function openList() {
    const list = atlas.inView();
    showPanel(`${head('list', '#ff2bd6', 'Dans cette partie de la carte', list.length ? `${list.length} point${list.length > 1 ? 's' : ''} à voir` : 'Aucun point ici')}
      ${list.length ? `<p class="pn-hint">Touche un nom pour voir ce que c'est et où aller.</p>${groupes(list, (f) => (cats[f.cat] || {}).nom || '', (f) => (cats[f.cat] || {}).color)}` : `<p>${state.vide ? 'Choisis ce que tu recherches pour afficher les lieux sur la carte.' : 'Déplace la carte ou dézoome pour trouver des points.'}</p>`}`);
    bindGroupes('list');
  }
  // résumé lisible des filtres actifs
  function resume() {
    const t = [];
    if (state.pop) t.push(((OPT.populaires || []).find((p) => p.id === state.pop) || {}).nom);
    else if (sel.size === Object.keys(cats).length && !Object.values(subs).some((x) => x && x.size)) t.push('Tous les repères');
    else [...sel].forEach((c) => { const s = subs[c]; t.push(s && s.size ? [...s].map((x) => subNoms[c + ':' + x]).join(', ') : (cats[c] || {}).nom); });
    if (opt.verif) t.push('vérifiés en jeu'); if (opt.cacheT) t.push('sans les trouvés'); if (opt.rares) t.push('rares'); if (opt.spoil) t.push('sans spoilers'); if (opt.favs) t.push('mes favoris'); if (!opt.approx) t.push('sans les approximatifs'); if (opt.sect) t.push(opt.sect);
    return t.filter(Boolean);
  }
  // ---------- résultats : tout ce que les filtres affichent, rangé par sous-catégorie ----------
  function openResults() {
    if (state.vide) return openFiltres();
    const list = resultats();
    const seule = sel.size === 1 ? [...sel][0] : '';
    const c = cats[seule] || { icon: 'filter', color: '#19d3e3' };
    const pop = (OPT.populaires || []).find((p) => p.id === state.pop);
    const nf = list.filter((f) => trouves.has(f.id)).length;
    const cle = (f) => { const cc = seule || f.cat; const s = scDe(f, cc).find((x) => !subs[cc] || !subs[cc].size || subs[cc].has(x)); return (s && subNoms[cc + ':' + s]) || (seule ? 'Autres' : (cats[f.cat] || {}).nom); };
    showPanel(`${head(pop ? pop.icon : c.icon, c.color, pop ? 'Recherche populaire' : 'Résultats', resume().join(' · ') || 'Tous les repères')}
      <div class="pn-ans-meta"><span><b>${list.length}</b> emplacement${list.length > 1 ? 's' : ''} sur la carte</span>${nf ? `<span class="pn-found-n">${ic('check')}${nf} trouvé${nf > 1 ? 's' : ''}</span>` : ''}</div>
      <div class="pn-ra"><button type="button" class="pn-fchip" data-open-f>${ic('filter')}Modifier les filtres</button><button type="button" class="pn-fchip" data-fit>${ic('locate')}Voir sur la carte</button>${pop && pop.page ? `<a class="pn-fchip" href="${ROOT}${pop.page}">${ic('guide')}Le guide</a>` : ''}</div>
      ${list.length ? `<p class="pn-hint">Touche un nom : la carte se centre dessus et sa fiche s'ouvre.</p>${groupes(list, cle, (f) => (cats[seule || f.cat] || {}).color)}`
        : `<p class="pn-vide">Aucun emplacement avec ces filtres.${opt.verif ? ' Aucun repère n\'est encore vérifié en jeu par notre équipe.' : ''}</p><div class="pn-act"><button type="button" class="nbtn" data-reset-in><span>Réinitialiser les filtres</span><i>${ic('x')}</i></button></div>`}`);
    bindGroupes('answer');
    $('[data-open-f]', panel).addEventListener('click', openFiltres);
    $('[data-fit]', panel).addEventListener('click', () => { if (innerWidth < 900) taillePanneau('compact'); fitResults(); });
    const rz = $('[data-reset-in]', panel); if (rz) rz.addEventListener('click', reset);
  }
  // groupe de repères au même endroit (inséparables au zoom) : leur liste
  function openCluster(m) {
    const c = cats[m[0].cat] || {};
    showPanel(`${head('list', c.color || '#ff2bd6', 'Au même endroit', `${m.length} repères ici`)}<p class="pn-hint">Ils sont trop proches pour être séparés sur la carte. Touche un nom.</p><section class="pn-lg" style="--c:${c.color || '#ff2bd6'}"><ul>${m.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(li).join('')}</ul></section>`);
    bindPick('list');
  }

  // ---------- tous les filtres : catégories, sous-catégories (choix multiple) et options ----------
  function openFiltres() {
    const base = atlas.feats().filter((f) => !f.label && passeOpt(f));
    const nC = (c) => base.filter((f) => dans(f, c)).length;
    const nS = (c, s) => base.filter((f) => dans(f, c) && scDe(f, c).includes(s)).length;
    const nO = (fn) => atlas.feats().filter((f) => !f.label && passeCat(f) && fn(f)).length;
    const secteurs = {}; atlas.feats().forEach((f) => { if (f.label) return; const s = secteur(f); if (s) secteurs[s] = (secteurs[s] || 0) + 1; });
    const sects = Object.keys(secteurs).filter((s) => secteurs[s] >= 3 || s === opt.sect).sort((a, b) => a.localeCompare(b, 'fr'));
    const tog = (k, lab, n, aide) => `<button type="button" class="pn-opt" data-opt="${k}" aria-pressed="${k === 'commu' ? state.commu : opt[k]}"${n === 0 && !opt[k] ? ' disabled' : ''}><span class="pn-sw" aria-hidden="true"></span><span><b>${escH(lab)}</b>${aide ? `<small>${escH(aide)}</small>` : ''}</span>${n != null ? `<em>${n}</em>` : ''}</button>`;
    const nVerif = nO((f) => f.statut === 'teste');
    showPanel.grand = true;
    showPanel(`${head('filter', '#19d3e3', 'Affiner la carte', 'Tous les filtres')}
      <p class="pn-hint">Choisis une ou plusieurs catégories, puis précise avec les sous-catégories.</p>
      <ul class="pn-fcats">${Object.values(cats).map((c) => {
        const on = !state.vide && sel.has(c.id), s = subs[c.id];
        return `<li style="--c:${c.color}"><div class="pn-fc"><button type="button" class="pn-fcb" data-fc="${c.id}" aria-pressed="${on}"><span class="pn-fci">${ic(c.icon)}</span><span><b>${escH(c.nom)}</b><small>${escH(c.sens || '')}</small></span><em>${nC(c.id)}</em></button>${c.sous.length ? `<button type="button" class="pn-fcx" data-fx="${c.id}" aria-expanded="${on && !!(s && s.size)}" aria-label="Sous-catégories : ${escH(c.nom)}">${ic('chevron')}</button>` : ''}</div>
          ${c.sous.length ? `<div class="pn-fsub" data-fsub="${c.id}"${on && s && s.size ? '' : ' hidden'}>${c.sous.map((x) => `<button type="button" class="pn-fchip" data-fs="${c.id}:${x.id}" aria-pressed="${!!(on && s && s.has(x.id))}">${escH(x.nom)} <small>${nS(c.id, x.id)}</small></button>`).join('')}</div>` : ''}</li>`;
      }).join('')}</ul>
      <h3 class="hl-h">Options</h3>
      <div class="pn-opts">
        ${tog('verif', 'Uniquement les lieux vérifiés en jeu', nVerif, nVerif ? '' : 'Aucun repère n\'est encore vérifié en jeu par notre équipe')}
        ${tog('cacheT', 'Masquer ce que j\'ai déjà trouvé', null, trouves.size ? `${trouves.size} repère${trouves.size > 1 ? 's' : ''} marqué${trouves.size > 1 ? 's' : ''}` : 'Rien de marqué pour l\'instant')}
        ${tog('rares', 'Uniquement les éléments rares', null, 'Véhicules et armes uniques, objets rares')}
        ${tog('spoil', 'Masquer les spoilers', null, 'Cache les lieux des missions de l\'histoire')}
        ${tog('favs', 'Uniquement mes favoris', null, favSet.size ? '' : 'Ajoute un lieu en favori avec le cœur de sa fiche')}
        ${tog('approx', 'Afficher les emplacements approximatifs', null, 'Repères dont seule la zone est connue')}
        ${tog('commu', 'Lieux de la communauté (GTADB)', commu.length, 'Non vérifiés, visibles en zoomant')}
      </div>
      ${sects.length ? `<label class="pn-sect"><span>Région ou quartier</span><select data-sect><option value="">Toute la carte</option>${sects.map((s) => `<option value="${escH(s)}"${s === opt.sect ? ' selected' : ''}>${escH(s)} (${secteurs[s]})</option>`).join('')}</select></label>` : ''}
      <div class="pn-act pn-act--f"><button type="button" class="nbtn" data-reset-in><span>Réinitialiser les filtres</span><i>${ic('x')}</i></button><button type="button" class="nbtn nbtn--primary" data-voir><span>Voir ${state.vide ? 'les résultats' : resultats().length + ' résultat' + (resultats().length > 1 ? 's' : '')}</span><i>${ic('arrow-right')}</i></button></div>`);
    const garder = (fn) => { const y = panel.scrollTop, t = panel.dataset.taille; fn(); state.pop = ''; comptes(); applyFilter(); openFiltres(); if (t) taillePanneau(t); panel.scrollTop = y; };
    $$('[data-fc]', panel).forEach((b) => b.addEventListener('click', () => garder(() => {
      const c = b.dataset.fc; unsolo();
      if (state.vide) { sel.clear(); state.vide = false; }
      if (sel.has(c)) { sel.delete(c); delete subs[c]; } else sel.add(c);
      state.vide = !sel.size;
    })));
    $$('[data-fx]', panel).forEach((b) => b.addEventListener('click', () => { const d = $(`[data-fsub="${b.dataset.fx}"]`, panel); d.hidden = !d.hidden; b.setAttribute('aria-expanded', !d.hidden); }));
    $$('[data-fs]', panel).forEach((b) => b.addEventListener('click', () => garder(() => {
      const [c, s] = b.dataset.fs.split(':'); unsolo();
      if (state.vide) { sel.clear(); state.vide = false; }
      sel.add(c); const set = (subs[c] ||= new Set());
      set.has(s) ? set.delete(s) : set.add(s);
      if (!set.size) delete subs[c];
    })));
    $$('[data-opt]', panel).forEach((b) => b.addEventListener('click', () => garder(() => {
      const k = b.dataset.opt;
      if (k === 'commu') { if (state.solo) unsolo(); state.commu = !state.commu; if (state.commu && atlas.cam.s < .07) { atlas.flyTo(-900, 600, .14); LG.toast && LG.toast('Zoome pour voir les lieux de la communauté', 'info'); } }
      else opt[k] = !opt[k];
    })));
    const se = $('[data-sect]', panel); if (se) se.addEventListener('change', () => garder(() => { opt.sect = se.value; }));
    $('[data-reset-in]', panel).addEventListener('click', reset);
    $('[data-voir]', panel).addEventListener('click', () => { if (state.vide) tout(); openResults(); fitResults(); });
  }

  // ---------- progression : vrais totaux, calculés sur les repères de la carte ----------
  function openProgression() {
    const F = atlas.feats().filter((f) => !f.label);
    const T = F.filter((f) => trouves.has(f.id)).length;
    const pc = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);
    const bar = (n, t, c) => `<span class="pn-bar" style="--c:${c};--p:${pc(n, t)}%" role="progressbar" aria-valuemin="0" aria-valuemax="${t}" aria-valuenow="${n}"><i></i></span>`;
    const lignes = Object.values(cats).map((c) => { const L = F.filter((f) => f.cat === c.id), n = L.filter((f) => trouves.has(f.id)).length; return `<li style="--c:${c.color}"><button type="button" data-pg="${c.id}"><span class="pn-fci">${ic(c.icon)}</span><span><b>${escH(c.nom)}</b>${bar(n, L.length, c.color)}</span><em>${n}/${L.length}<small>${String(pc(n, L.length)).replace('.', ',')} %</small></em></button></li>`; }).join('');
    showPanel.grand = true;
    showPanel(`${head('progress', '#39ff88', 'Ma progression', `${String(pc(T, F.length)).replace('.', ',')} % des repères de la carte`)}
      <div class="pn-pg-g">${bar(T, F.length, '#39ff88')}<p><b>${T}</b> sur ${F.length} repères marqués comme trouvés ou visités.</p></div>
      <p class="pn-hint">Calculé sur les repères de cette carte, pas sur le contenu complet du jeu (les totaux officiels ne sont pas connus). Enregistré automatiquement sur cet appareil${window.LG_SB && window.LG_SB.url ? ' et dans ton compte si tu es connecté' : ''}.</p>
      <ul class="pn-pg">${lignes}</ul>
      <div class="pn-act pn-act--f">${dernier ? `<button type="button" class="nbtn" data-undo><span>Annuler : ${escH(dernier.f.nom)}</span><i>${ic('replay')}</i></button>` : ''}<button type="button" class="nbtn" data-pg-hide aria-pressed="${opt.cacheT}"><span>${opt.cacheT ? 'Réafficher les trouvés' : 'Masquer les trouvés'}</span><i>${ic('eye')}</i></button></div>`);
    $$('[data-pg]', panel).forEach((b) => b.addEventListener('click', () => { state.pop = ''; choisirCats([b.dataset.pg]); openResults(); }));
    const u = $('[data-undo]', panel); if (u) u.addEventListener('click', () => { annuler(); openProgression(); });
    $('[data-pg-hide]', panel).addEventListener('click', () => { opt.cacheT = !opt.cacheT; comptes(); applyFilter(); openProgression(); });
  }
  function marquer(f, on) {
    on ? trouves.add(f.id) : trouves.delete(f.id); saveT();
    dernier = { f, on };
    atlas.markFound && atlas.markFound(trouves);
    if (opt.cacheT) applyFilter();
  }
  function annuler() { if (!dernier) return; const { f, on } = dernier; on ? trouves.delete(f.id) : trouves.add(f.id); saveT(); atlas.markFound(trouves); dernier = null; if (opt.cacheT) applyFilter(); }

  // ---------- légende : repliable, fermée par défaut ----------
  function legende(on) {
    const L = $('#atp-leg'), b = $('[data-leg-btn]'); if (!L) return;
    L.hidden = !on; b.setAttribute('aria-expanded', !!on);
  }

  // ---------- fiche d'un repère ----------
  function openFeature(f) {
    if (state.spot && state.spot !== f.id) { state.spot = ''; atlas.spot(false); panel.classList.remove('pn-peek'); }
    const c = cats[f.cat] || {}; const r = regions[f.region];
    const favType = f.cat === 'vehicules' ? 'vehicule' : 'lieu';
    const fav = f.vs ? { id: f.vs, type: 'vehicule', t: f.vn || f.nom, u: f.url, i: f.icon, c: c.color } : { id: f.cat === 'vehicules' ? f.id.replace(/^v-/, '') : f.id, type: favType, t: f.nom, u: f.cat === 'vehicules' && f.url ? f.url : `carte/?focus=${f.id}`, i: f.icon, c: c.color };
    const t = f.tip;
    const place = /^[sm]-/.test(f.id) || (f.service && f.cat !== 'vehicules');
    const ou = f.lieuNom ? `${f.lieuNom}${r ? ' · ' + r.nom : ''}` : (r ? r.nom : f.zone || '');
    const precision = f.precision === 'region' ? 'Emplacement à confirmer dans cette zone' : f.src === 'ogm' ? 'Position relevée par les joueurs (Open GTA 6 Map)' : f.src === 'wiki' ? 'Position indiquée par GTA Wiki' : 'Position approximative (carte communautaire)';
    const where = `<div class="pn-where" style="--c:${c.color}"><span class="pn-where-k">${ic('pin')}Où aller</span><b>${escH(f.nom)}</b>${ou && ou !== f.nom ? `<span>${escH(ou)}</span>` : ''}${f.acces ? `<span class="pn-where-go">${ic('compass')}${escH(f.acces)}</span>` : ''}<small>${precision}</small></div>`;
    const fb = fiab(f);
    const favBtn = `<button type="button" class="pn-fav fav" data-fav='${escH(JSON.stringify(fav))}' aria-pressed="false" aria-label="Ajouter aux favoris">${ic('heart')}</button>`;
    const veh = f.cat === 'vehicules';
    // informations : seulement celles qui existent dans les données
    const sc = scDe(f, f.cat).map((s) => subNoms[f.cat + ':' + s]).filter(Boolean);
    const autres = (f.tg || []).map((k) => (cats[k] || {}).nom).filter(Boolean);
    const rar = f.rar === '#' ? `Rare : ${atlas.feats().filter((x) => x.service === f.service).length} « ${(f.service || '').toLowerCase()} » sur la carte` : f.rar;
    const sect = secteur(f);
    const src = /^[osw]-/.test(f.id) ? (f.ext ? `<a href="${escH(f.ext)}" target="_blank" rel="noopener">${escH(sourceTxt(f))}</a>` : escH(sourceTxt(f))) : 'Fiche du guide GTA 6 Facile';
    const infos = [['Catégorie', escH([c.nom, sc.slice(0, 2).join(', ')].filter(Boolean).join(' · '))], autres.length ? ['Aussi dans', escH(autres.join(', '))] : null, sect ? ['Secteur', escH(sect)] : null, rar ? ['Rareté', escH(rar)] : null, ['Fiabilité', `<span class="pn-tag ${fb.cls}">${fb.n}</span> <small>${escH(fb.t)}</small>`], ['Source', src]].filter(Boolean);
    const dl = `<dl class="pn-dl">${infos.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
    const corpsV = `<div class="pn-act">${f.url ? `<a class="nbtn nbtn--primary" href="${ROOT}${f.url}"><span>Fiche du véhicule</span><i>${ic('arrow-right')}</i></a>` : ''}${favBtn}</div>
      ${f.ob ? `<p class="pn-ob">${ic('check')}<span><b>Pour l'obtenir :</b> ${escH(f.ob)}</span></p>` : ''}
      ${f.desc && f.desc !== f.ob ? `<p class="pn-en"><small>${ic('info')}${/^v-/.test(f.id) ? 'Emplacement indiqué sur la fiche' : `Indication des joueurs${f.en ? ', en anglais' : ''}`} :</small>${escH(f.desc)}</p>` : ''}`;
    const body = veh ? corpsV : t
      ? `${where}<div class="pn-tip" style="--c:${c.color}">${place ? `<p class="pn-tip-q">${ic('bolt')}${escH(t.titre)}</p>` : ''}<p class="pn-a">${escH(t.reponse)}</p>
         <div class="pn-act"><a class="nbtn nbtn--primary" href="${ROOT}${t.lien}"><span>${escH(t.libelle)}</span><i>${ic('arrow-right')}</i></a>${favBtn}</div>
         <ol class="pn-steps">${t.etapes.map((e) => `<li>${escH(e)}</li>`).join('')}</ol></div>`
      : `${where}${f.missions || !f.desc || f.desc.replace(/\.$/, '') === ou ? '' : f.en ? `<p class="pn-en"><small>${ic('info')}Indication des joueurs, en anglais :</small>${escH(f.desc || '')}</p>` : `<p>${escH(f.desc || '')}</p>`}
         <div class="pn-act">${f.url ? `<a class="nbtn nbtn--primary" href="${ROOT}${f.url}"><span>${/^dossiers\//.test(f.url) ? 'Voir le dossier' : 'Voir la fiche'}</span><i>${ic('arrow-right')}</i></a>` : f.ext && f.ph ? `<a class="nbtn nbtn--primary" href="${f.ext}" target="_blank" rel="noopener"><span>Voir la photo du lieu</span><i>${ic('eye')}</i></a>` : ''}${favBtn}</div>`;
    const quoi = veh ? [c.nom, sc[0]].filter(Boolean).join(' · ') : t && !place ? t.type : `${c.nom || ''}${f.service ? ' · ' + f.service : ''}`;
    const cap = [f.imgNote ? `<b>${escH(f.imgNote)}</b>` : '', f.imgCredit ? 'Image : ' + escH(f.imgCredit) : ''].filter(Boolean).join(' · ');
    const img = f.img ? `<figure class="pn-img${f.img3d ? ' pn-img--3d' : ''}" style="--c:${c.color}"><img src="${ROOT}${f.img}" alt="${escH(f.nom)}${f.img3d ? ' en 3D' : ''}" decoding="async" loading="lazy">${cap ? `<figcaption>${cap}${f.img3d ? ' · <a href="' + ROOT + f.url + '">la faire tourner</a>' : ''}</figcaption>` : ''}</figure>` : '';
    const mis = f.missions && !opt.spoil ? `<div class="pn-mis"><h3>${ic('flag')}Les missions ici</h3><ul>${[...f.missions].sort((a, b) => (b.id === params.get('mission')) - (a.id === params.get('mission'))).map((m) => `<li${m.id === params.get('mission') ? ' class="is-cur"' : ''}><a href="${ROOT}missions/${escH(m.id)}/">${m.id === params.get('mission') ? '<em class="pn-mis-cur">Ta mission</em>' : ''}<span class="pn-mis-n">${m.n || '+'}</span><span><b>${escH(m.t)}</b><small>${m.c === 'prologue' ? 'Prologue' : 'Chapitre ' + m.c} · ${escH(m.r)}</small></span>${ic('arrow-right')}</a></li>`).join('')}</ul></div>` : '';
    const prox = BESOINS.map(([lab, icn, court]) => {
      let best = null, bd = Infinity;
      atlas.feats().forEach((x) => { if (x.id !== f.id && !x.label && lab.includes(x.service)) { const dd = Math.hypot(x.x - f.x, x.y - f.y); if (dd < bd) { bd = dd; best = x; } } });
      return best && !lab.includes(f.service) ? `<li><button type="button" data-go="${escH(best.id)}"><span class="pn-li-i">${ic(icn)}</span><span><b>${escH(court)}</b><small>${escH(best.nom)}</small></span><em>${km(bd)}</em></button></li>` : '';
    }).filter(Boolean).slice(0, 4).join('');
    const proche = prox ? `<details class="pn-near"${innerWidth >= 900 ? ' open' : ''}><summary>${ic('compass')}Le plus proche d'ici</summary><ul>${prox}</ul><p class="pn-near-n">Distances à vol d'oiseau, environ.</p></details>` : '';
    const isT = trouves.has(f.id);
    const mail = window.LG_CONTACT;
    const signal = mail ? `mailto:${mail}?subject=${encodeURIComponent('Erreur sur la carte : ' + f.nom)}&body=${encodeURIComponent(`Repère : ${f.nom} (${f.id})\nLien : ${location.origin}${location.pathname}?focus=${f.id}\n\nCe qui ne va pas :\n`)}` : '';
    const outils = `<div class="pn-tools"><button type="button" class="pn-tool${isT ? ' is-on' : ''}" data-found aria-pressed="${isT}">${ic('check')}<span>${foundTxt(f, isT)}</span></button><button type="button" class="pn-tool" data-center>${ic('locate')}<span>Centrer</span></button><button type="button" class="pn-tool" data-share>${ic('share')}<span>Partager</span></button>${signal ? `<a class="pn-tool" href="${signal}">${ic('alert')}<span>Signaler une erreur</span></a>` : ''}</div><p class="pn-undo" data-undo-l hidden><button type="button" data-undo-f>${ic('replay')}Annuler</button></p>`;
    showPanel.moyen = true;
    showPanel(`${head(f.icon, c.color, quoi, veh ? f.nom : t && !place ? t.titre : f.nom)}${veh ? '' : img}${mis}${body}${veh ? img : ''}${outils}${dl}${proche}${nav(f)}`);
    bindNav();
    const bt = $('[data-found]', panel), ul = $('[data-undo-l]', panel);
    const majT = () => { const on = trouves.has(f.id); bt.setAttribute('aria-pressed', on); bt.classList.toggle('is-on', on); bt.querySelector('span').textContent = foundTxt(f, on); };
    bt.addEventListener('click', () => { marquer(f, !trouves.has(f.id)); majT(); ul.hidden = false; });
    $('[data-undo-f]', panel).addEventListener('click', () => { annuler(); majT(); ul.hidden = true; });
    $('[data-center]', panel).addEventListener('click', () => { if (innerWidth < 900 && !cote()) taillePanneau('compact'); atlas.flyTo(f.x, f.y, Math.max(atlas.cam.s, .45)); visible(f, 900); });
    $('[data-share]', panel).addEventListener('click', async () => {
      const u = new URL(location.href); u.search = ''; u.searchParams.set('focus', f.id);
      try { if (navigator.share && innerWidth < 900) await navigator.share({ title: f.nom, url: u.href }); else { await navigator.clipboard.writeText(u.href); LG.toast && LG.toast('Lien copié', 'check'); } } catch (err) { /* annulé */ }
    });
    panel.classList.toggle('pn-peek', !!state.spot && innerWidth < 900);
    panel.scrollTop = 0;
    if (cote()) atlas.flyTo(f.x, f.y, Math.max(atlas.cam.s, state.spot ? .45 : .3));
    else if (innerWidth < 900) {
      const ts = Math.max(atlas.cam.s, state.spot ? .45 : .3), sr = stage.getBoundingClientRect();
      const y0 = top.getBoundingClientRect().bottom - sr.top, y1 = panel.getBoundingClientRect().top - sr.top;
      atlas.flyTo(f.x, f.y - (sr.height / 2 - ((y0 + y1) / 2 - (state.spot ? 16 : 0))) / ts, ts);
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

  // ---------- recherche : accents, synonymes, fautes de frappe, catégories et recherches populaires ----------
  const lev = LG.lev || ((a, b) => (a === b ? 0 : 9));
  let SYN = null;
  function synonymes(t) {
    if (!SYN) { SYN = {}; (OPT.synonymes || []).forEach((grp) => { const n = grp.map(norm); n.forEach((w) => { SYN[w] = n; }); }); }
    return SYN[t] || [t];
  }
  // un mot de la requête correspond-il à un mot du texte ? (exact, début de mot, synonyme, ou une faute de frappe sur les mots longs)
  function motOk(t, mots) {
    let best = 0;
    for (const v of synonymes(t)) for (const w of mots) {
      if (w === v) return 3;
      if (v.length >= 2 && w.startsWith(v)) best = Math.max(best, 2);
      else if (v.length >= 5 && w.length >= 4 && Math.abs(w.length - v.length) <= 2 && lev(v, w) <= (v.length >= 8 ? 2 : 1)) best = Math.max(best, 1);
    }
    return best;
  }
  function score(toks, nom, extra) {
    const w = norm(nom).split(' '), e = norm(extra).split(' ');
    let s = 0;
    for (const t of toks) { const m = Math.max(motOk(t, w) * 2, motOk(t, e)); if (!m) return 0; s += m; }
    return s;
  }
  function search(q) {
    const qn = norm(q); if (!qn) return [];
    const toks = qn.split(' ').filter((t) => t && !['de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'a', 'ou', 'trouver', 'gta', '6'].includes(t));
    if (!toks.length) return [];
    const out = [];
    (OPT.populaires || []).forEach((p) => { const c = cats[p.cat] || {}; const s = score(toks, p.nom, `${c.nom} ${(p.sc || []).map((x) => subNoms[p.cat + ':' + x]).join(' ')}`); if (s) out.push({ s: s + 4, pop: p }); });
    Object.values(cats).forEach((c) => {
      const s = score(toks, c.nom, `${c.court} ${c.q} ${c.sens}`); if (s) out.push({ s: s + 3, cat: c });
      c.sous.forEach((x) => { const s2 = score(toks, x.nom, c.nom); if (s2) out.push({ s: s2 + 2.5, cat: c, sub: x }); });
    });
    atlas.feats().forEach((f) => { if (f.label && !regions[f.id]) return; const s = score(toks, f.nom, `${(cats[f.cat] || {}).nom} ${f.service || ''} ${f.vn || ''} ${f.zone || ''} ${f.desc || ''}`); if (s) out.push({ s: s + (f.label ? 1.5 : 1) + (passe(f) ? .3 : 0), f }); });
    commu.forEach((p) => { const s = score(toks, p.n, p.z); if (s) out.push({ s, p }); });
    // pas deux fois la même entrée de catégorie
    const vus = new Set();
    return out.sort((a, b) => b.s - a.s).filter((r) => { const k = r.pop ? 'p' + r.pop.id : r.cat ? 'c' + r.cat.id + (r.sub ? ':' + r.sub.id : '') : ''; if (!k) return true; if (vus.has(k)) return false; vus.add(k); return true; }).slice(0, 9);
  }
  function bind() {
    const input = $('#atp-q'), sugg = $('#atp-sugg'); let res = [], sel2 = 0;
    const nCat = (c, s) => atlas.feats().filter((f) => !f.label && dans(f, c) && (!s || scDe(f, c).includes(s))).length;
    const draw = () => {
      res = search(input.value); sel2 = 0; sugg.hidden = !input.value.trim();
      const ligne = (r, i) => {
        const a = `role="option" data-i="${i}" aria-selected="${i === 0}"`;
        if (r.pop) { const c = cats[r.pop.cat]; return `<button type="button" ${a} style="--c:${c.color}" class="sg-cat">${ic(r.pop.icon)}<span><b>${escH(r.pop.nom)}</b><small>Recherche populaire · ${nCat(r.pop.cat, (r.pop.sc || [])[0])} emplacements</small></span></button>`; }
        if (r.cat) return `<button type="button" ${a} style="--c:${r.cat.color}" class="sg-cat">${ic(r.cat.icon)}<span><b>${escH(r.sub ? r.sub.nom : r.cat.nom)}</b><small>${r.sub ? 'Sous-catégorie · ' + escH(r.cat.nom) : 'Catégorie'} · ${nCat(r.cat.id, r.sub && r.sub.id)} emplacements</small></span></button>`;
        if (r.f) return `<button type="button" ${a} style="--c:${(cats[r.f.cat] || {}).color || '#ff2bd6'}"><i></i><span><b>${escH(r.f.nom)}</b><small>${r.f.label ? 'Région' : escH(sousNom(r.f))}${secteur(r.f) ? ' · ' + escH(secteur(r.f)) : ''}</small></span></button>`;
        return `<button type="button" ${a} style="--c:#c7c2e0"><i></i><span><b>${escH(r.p.n)}</b><small>Communauté${r.p.z ? ' · ' + escH(r.p.z) : ''}</small></span></button>`;
      };
      const idees = (OPT.populaires || []).slice(0, 6).map((p) => `<button type="button" class="sg-idee" data-pop-s="${p.id}" style="--c:${(cats[p.cat] || {}).color}">${ic(p.icon)}${escH(p.nom)}</button>`).join('');
      sugg.innerHTML = res.length ? res.map(ligne).join('') : `<p class="sg-vide"><b>Aucun résultat pour « ${escH(input.value.trim())} ».</b> Vérifie l'orthographe, ou essaie une de ces recherches :</p><div class="sg-idees">${idees}</div>`;
      $$('[data-i]', sugg).forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
      $$('[data-pop-s]', sugg).forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
      $$('[data-pop-s]', sugg).forEach((b) => b.addEventListener('click', () => { input.value = ''; sugg.hidden = true; input.blur(); popClic(b.dataset.popS); }));
      if (!res.length && input.value.trim().length > 2 && window.LG_EVT) { clearTimeout(draw.t); draw.t = setTimeout(() => { try { window.LG_EVT('carte-sans-resultat/' + norm(input.value).slice(0, 40)); } catch (e) { /* */ } }, 1500); }
    };
    const pick = (i) => {
      const r = res[i]; if (!r) return; sugg.hidden = true; input.blur();
      if (r.pop) return popClic(r.pop.id);
      if (r.cat) { state.pop = ''; choisirCats([r.cat.id], r.sub ? { [r.cat.id]: [r.sub.id] } : null); openResults(); fitResults(); return; }
      if (r.f) {
        if (r.f.label) return openRegion(regions[r.f.id]);
        ensureShown(r.f); state.fromList = false;
        atlas.select(r.f, { fly: true, s: Math.max(atlas.cam.s, .32) });
      } else {
        if (!state.commu) { state.commu = true; applyFilter(); }
        atlas.select({ ...r.p, commu: true, x: r.p.x, y: r.p.y }, { fly: true, s: .5 });
      }
    };
    input.addEventListener('input', draw);
    input.addEventListener('focus', () => { if (input.value.trim()) draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); pick(sel2); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel2 = Math.max(0, Math.min(res.length - 1, sel2 + (e.key === 'ArrowDown' ? 1 : -1))); $$('[data-i]', sugg).forEach((b, i) => b.setAttribute('aria-selected', i === sel2)); }
      if (e.key === 'Escape') { input.value = ''; sugg.hidden = true; }
    });
    input.addEventListener('blur', () => setTimeout(() => { sugg.hidden = true; }, 180));
    // raccourcis permanents : un toucher = la catégorie seule et sa liste ; un second toucher l'enlève
    $$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.cat; state.pop = '';
      if (!state.vide && sel.size === 1 && sel.has(id) && !(subs[id] && subs[id].size)) { reset(); return; }
      choisirCats([id]); openResults();
      b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }));
    $('[data-all]').addEventListener('click', () => { if ($('[data-all]').getAttribute('aria-pressed') === 'true') return reset(); tout(); closePanel(); atlas.reset(); });
    $('[data-filtres]').addEventListener('click', openFiltres);
    $('[data-reset]').addEventListener('click', reset);
    $$('[data-pop]').forEach((b) => b.addEventListener('click', () => { if (state.pop === b.dataset.pop) return reset(); popClic(b.dataset.pop); b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' }); }));
    $('[data-solo-off]').addEventListener('click', () => { unsolo(); tout(); closePanel(); });
    $('[data-keep-voir]').addEventListener('click', () => { const f = state.choisi; if (!f) return; if (!f.commu) ensureShown(f); atlas.select(f, { fly: true, s: Math.max(atlas.cam.s, .3) }); });
    $('[data-keep-off]').addEventListener('click', () => { state.choisi = null; garde(false); atlas.clearActive(); });
    $$('[data-z]').forEach((b) => b.addEventListener('click', () => {
      const z = b.dataset.z;
      if (z === 'in') atlas.zoomIn(); else if (z === 'out') atlas.zoomOut();
      else if (z === 'center') { const f = state.choisi && !state.choisi.commu ? state.choisi : null; if (f) { atlas.flyTo(f.x, f.y, Math.max(atlas.cam.s, .45)); visible(f, 900); } else if (!state.vide && resultats().length) fitResults(); else atlas.reset(); }
    }));
    $$('[data-reg]').forEach((b) => b.addEventListener('click', () => openRegion(regions[b.dataset.reg])));
    $('[data-list]').addEventListener('click', () => { state.fromList = false; openList(); });
    $('[data-prog]').addEventListener('click', openProgression);
    $('[data-leg-btn]').addEventListener('click', () => legende($('#atp-leg').hidden));
    $('[data-leg-x]').addEventListener('click', () => legende(false));
    const src = $('.at-attrib--page'); if (src && innerWidth >= 900) src.open = true;
    countView();
    addEventListener('keydown', (e) => { if (e.key === 'Escape') { legende(false); closePanel(); } });
    addEventListener('storage', (e) => { if (e.key === 'lg:favs' && opt.favs) applyFilter(); });
    panel.addEventListener('click', (e) => { if (opt.favs && e.target.closest('.fav')) setTimeout(applyFilter, 50); });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => atlas.setPad(padding()), 150); });
  }
  function popClic(id) {
    const p = (OPT.populaires || []).find((x) => x.id === id); if (!p) return;
    appliquerPop(p); openResults(); fitResults();
  }
})();
