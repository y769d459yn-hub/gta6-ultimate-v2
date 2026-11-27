/* GTA 6 Facile — page carte plein écran : filtres (catégories, sous-catégories, options), recherches populaires,
   recherche tolérante, fiches et listes en panneaux coulissants (3 hauteurs), progression, mode exploration.
   Configuration des catégories : data/site.json (categories.carte, carteOptions). */
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
  let atlas, D, OPT = {}, commu = [], commuCats = {}, cats = {}, regions = {}, sousNoms = {}, subNoms = {}, STATUTS = {};
  // ---------- état des filtres ----------
  // sel : catégories choisies ; subs : sous-catégories choisies par catégorie (vide = toute la catégorie)
  const sel = new Set(), subs = {};
  const DEF = { verif: false, cacheT: false, rares: false, spoil: false, favs: false, gl: false, tousv: false, prouve: false, approx: true, nonconf: false, sect: '' };
  const opt = { ...DEF };
  const state = { commu: false, fromList: false, vide: true, solo: '', spot: '', choisi: null, pop: '', lq: '', tri: 'pert', glitch: '' };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } } };
  // points marqués « trouvé » (gardés sur cet appareil, synchronisés par le compte s'il existe : même clé qu'avant)
  const KEY_T = 'lg:carte-trouves';
  let trouves = new Set(); try { trouves = new Set(JSON.parse(store.get(KEY_T) || '[]')); } catch (e) { /* */ }
  const saveT = () => store.set(KEY_T, JSON.stringify([...trouves]));
  let dernier = null; // dernière action « trouvé », pour pouvoir l'annuler
  // clics sur les recherches populaires : comptés sur cet appareil (et en compteur anonyme s'il est actif), jamais affichés comme des statistiques
  const KEY_POP = 'lg:carte-pop', KEY_POPR = 'lg:carte-pop-replie';
  const favs = () => { try { return (LG.store ? LG.store.get('favs', []) : JSON.parse(store.get('lg:favs') || '[]')) || []; } catch (e) { return []; } };
  // ce qu'on cherche souvent : le plus proche, depuis n'importe quel point
  const BESOINS = [[['Armurerie'], 'gun', 'Armurerie'], [['Hôpital'], 'heart', 'Hôpital'], [['Station-service'], 'bolt', 'Station-service'], [['Garage auto', "Pay 'n' Spray"], 'spray', 'Garage ou Pay \'n\' Spray'], [['Vêtements'], 'user', 'Vêtements'], [['Planque'], 'home', 'Planque']];
  const foundTxt = (f, on) => (f.cat === 'collection' || f.cat === 'vehicules' ? (on ? 'Trouvé' : 'Marquer comme trouvé') : (on ? 'Visité' : 'Marquer comme visité'));
  // ---------- fiabilité de l'information (statut) et précision de l'emplacement : deux choses distinctes ----------
  const sourceTxt = (f) => (/^o-/.test(f.id) ? 'Open GTA 6 Map (joueurs)' : /^w-/.test(f.id) ? 'GTA Wiki (joueurs)' : /^s-/.test(f.id) ? 'GTADB (joueurs)' : 'Fiche du guide GTA 6 Facile');
  const approx = (f) => f.precision === 'region' || f.precision === 'inconnue' || f.statut === 'provisoire';
  // jamais « vérifié » à cause des seules coordonnées ; jamais « officiel » pour une donnée communautaire
  // véhicules : fiabilité de l'emplacement évaluée à la génération (confirmé, fortement probable, approximatif, non vérifié)
  const FI_ST = { confirme: 'verifie', probable: 'probable', approx: 'nonconf', nonverif: 'nonverif' };
  function statutDe(f) {
    if (f.fi) return FI_ST[f.fi];
    if (f.statut === 'teste') return 'verifie';
    if (f.statut === 'confirme' && !/^[osw]-/.test(f.id)) return 'verifie';
    if (approx(f) || /^v-/.test(f.id)) return 'nonconf';
    return 'probable';
  }
  const precisionTxt = (f) => (f.precision === 'exacte' ? 'Position précise selon la source (pas vérifiée en jeu)' : f.precision === 'region' ? 'Zone seulement : position non précise' : f.precision === 'inconnue' ? 'Position inconnue' : 'Position approximative');
  const stTag = (f, seul) => { const s = STATUTS[statutDe(f)] || {}; return `<span class="pn-st" style="--c:${s.c}" title="${escH(s.t)}">${ic(s.ic)}${escH(s.n)}</span>${seul ? '' : `<small class="pn-st-t">${escH(s.t)}</small>`}`; };
  const km = (d) => (d < 950 ? `${Math.max(100, Math.round(d / 100) * 100)} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`);
  // secteur : quartier de la source, sinon la région du guide
  const secteur = (f) => (f.zone ? f.zone.split(',').pop().trim() : '') || (regions[f.region] || {}).nom || '';
  const sousLigne = (f) => { const z = f.zone || f.lieuNom || (regions[f.region] || {}).nom || ''; return z && !f.nom.includes(z.split(',')[0]) ? z : (f.service || (f.tip ? f.tip.titre : '') || z); };
  // sous-catégories d'un repère dans une catégorie donnée
  const scDe = (f, c) => (f.sc || []).filter((s) => (f.cat === c ? !s.includes(':') : s.startsWith(c + ':'))).map((s) => s.replace(/^.*:/, ''));
  const dans = (f, c) => f.cat === c || (f.tg || []).includes(c);
  const sousNom = (f) => { const s = scDe(f, f.cat)[0]; return (s && subNoms[f.cat + ':' + s]) || f.service || sousNoms[f.sous] || (cats[f.cat] || {}).nom || ''; };
  const rarete = (f) => (f.rar === '#' ? `Rare : ${atlas.feats().filter((x) => x.service === f.service).length} sur la carte` : f.rar || '');
  // description courte : première phrase, sans répéter le nom
  const court = (f) => { const p = (f.desc || '').split(/(?<=\.)\s/)[0] || ''; return p && norm(p) !== norm(f.nom) ? (p.length > 110 ? p.slice(0, 107) + '…' : p) : sousLigne(f); };

  Promise.all([fetch(ROOT + 'data/carte.json').then((r) => r.json()), fetch(ROOT + 'data/communaute.json').then((r) => r.json()).catch(() => ({ lieux: [], categories: [] }))]).then(([d, c]) => {
    D = d; OPT = d.options || {}; commu = c.lieux; c.categories.forEach((k) => { commuCats[k.id] = k; });
    (OPT.statuts || []).forEach((s) => { STATUTS[s.id] = s; });
    d.categories.forEach((k) => { cats[k.id] = k; k.sous.forEach((s) => { subNoms[k.id + ':' + s.id] = s.nom; }); });
    d.regions.forEach((r) => { regions[r.id] = r; });
    Object.values(d.sousTypes || {}).forEach((L) => L.forEach((x) => { sousNoms[x.id] = x.nom; }));
    lireURL();
    atlas = window.Atlas(stage, {
      root: ROOT, tuiles: d.tuiles, carte: d, pad: padding(),
      onSelect: (f, o2 = {}) => { state.choisi = f; garde(false); const r = f.commu ? openCommu(f) : openFeature(f); visible(f, o2.fly ? 1050 : 380); return r; },
      onRegion: openRegion, onBlank: () => { menuReg(false); closePanel(); }, onView: countView, onCluster: openCluster
    });
    atlas.setCommu(commu); atlas.markFound(trouves);
    // recherches populaires sans aucun repère : masquées
    $$('[data-pop]').forEach((b) => { const p = (OPT.populaires || []).find((x) => x.id === b.dataset.pop); if (!p || !nPop(p)) b.hidden = true; });
    comptes(); sync(); applyFilter();
    const focus = params.get('focus');
    const f = focus && atlas.feats().find((x) => x.id === focus);
    // arrivée par un lien (mission, lieu…) : le point est mis en avant, le reste s'efface
    if (f) setTimeout(() => { if (f.label) return openRegion(regions[f.id]); ensureShown(f); state.spot = f.id; atlas.spot(true); if (params.get('mission')) solo(f); atlas.select(f, { fly: innerWidth >= 900 || cote(), s: .45 }); }, 250);
    else if (params.get('region') && regions[params.get('region')]) setTimeout(() => openRegion(regions[params.get('region')]), 250);
    else if (!state.vide && sel.size) setTimeout(() => { openResults(); fitResults(); }, 300);
    bind();
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
    (params.get('f') || '').split(',').forEach((k) => { if (k in DEF && DEF[k] === false) opt[k] = true; if (k === 'sansapprox') opt.approx = false; if (k === 'avecnonverif') opt.nonconf = true; });
    if (params.get('sect')) opt.sect = params.get('sect');
    // arrivée depuis un tutoriel de glitch : seulement ses lieux
    const gq = params.get('glitch'); if (gq && D.features.some((f) => (f.properties.gl || []).some((x) => x.s === gq))) { state.glitch = gq; if (!sel.size) Object.keys(cats).forEach((k) => sel.add(k)); }
    if (sel.size) state.vide = false;
    if (params.get('pop')) { const p = (OPT.populaires || []).find((x) => x.id === params.get('pop')); if (p) { state.pop = p.id; appliquerPop(p, true); } }
  }
  function ecrireURL() {
    const u = new URL(location.href);
    ['cat', 'sc', 'f', 'sect', 'pop', 'focus', 'mission', 'glitch'].forEach((k) => u.searchParams.delete(k));
    if (state.glitch) u.searchParams.set('glitch', state.glitch);
    if (state.pop) u.searchParams.set('pop', state.pop);
    else if (!state.vide) {
      const tt = sel.size === Object.keys(cats).length && !Object.values(subs).some((s) => s.size);
      u.searchParams.set('cat', tt ? 'tout' : [...sel].join(','));
      const sc = [...sel].flatMap((c) => [...(subs[c] || [])].map((s) => (sel.size === 1 ? s : c + ':' + s)));
      if (sc.length) u.searchParams.set('sc', sc.join(','));
    }
    const fl = ['verif', 'cacheT', 'rares', 'spoil', 'favs', 'gl', 'tousv', 'prouve'].filter((k) => opt[k]); if (!opt.approx) fl.push('sansapprox'); if (opt.nonconf) fl.push('avecnonverif');
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
  const lqOk = (f) => { if (!state.lq) return true; const t = norm(`${f.nom} ${f.vo || ''} ${f.service || ''} ${f.zone || ''} ${f.vn || ''}`); return norm(state.lq).split(' ').every((w) => t.includes(w)); };
  function passeOpt(f) {
    if (opt.verif && statutDe(f) !== 'verifie') return false;
    if (opt.cacheT && trouves.has(f.id)) return false;
    if (opt.rares && !f.rar) return false;
    if (opt.spoil && f.cat === 'missions' && f.missions) return false;
    if (opt.favs && !estFav(f)) return false;
    if (opt.gl && !f.gl) return false;
    // véhicules ordinaires (note < 60) et emplacements non vérifiés : masqués tant que l'option n'est pas cochée (ou qu'on ne vise pas ce repère)
    // doublon (zone approximative d'une fiche au même endroit qu'un repère précis) : jamais affiché, sauf s'il est visé
    if (f.dbl && f.id !== state.cible && f.id !== state.spot) return false;
    // emplacements prouvés : capture prise en jeu sur place, deux sources concordantes, ou vérifié en jeu
    if (opt.prouve && !(f.statut === 'teste' || f.fi === 'probable' || f.fi === 'confirme')) return false;
    if (f.hv && !opt.tousv && f.id !== state.cible && f.id !== state.spot && f.id !== state.solo) return false;
    if (state.glitch && !(f.gl || []).some((x) => x.s === state.glitch)) return false;
    // approximatif : zone seulement ; non vérifié : masqué par défaut, affiché à la demande
    // le repère que le joueur vient d'ouvrir (recherche, lien, fiche) reste visible, même s'il est masqué par défaut
    const vise = f.id === state.cible || f.id === state.spot || f.id === state.solo;
    if (!vise && !opt.approx && statutDe(f) === 'nonconf') return false;
    if (!vise && !opt.nonconf && statutDe(f) === 'nonverif') return false;
    if (opt.sect && secteur(f) !== opt.sect) return false;
    return true;
  }
  const passe = (f) => !f.label && passeCat(f) && passeOpt(f) && lqOk(f);
  const resultats = () => { const L = atlas.feats().filter(passe); if (!state.zone) return L; const V = new Set(atlas.inView().map((f) => f.id)); return L.filter((f) => V.has(f.id)); };
  function applyFilter() {
    lireFavs();
    atlas.setBadge(state.glitch || opt.gl ? (f) => { const x = (f.gl || []).find((y) => !state.glitch || y.s === state.glitch); return x ? (x.n ? String(x.n) : '⚡') : ''; } : null);
    atlas.setFilter((f) => (state.solo ? f.id === state.solo : passe(f)));
    atlas.showCommu(state.commu && !state.solo); countView(); sync();
  }
  const nbOpts = () => ['verif', 'cacheT', 'rares', 'spoil', 'favs', 'gl', 'tousv', 'prouve'].filter((k) => opt[k]).length + (state.glitch ? 1 : 0) + (!opt.approx ? 1 : 0) + (opt.nonconf ? 1 : 0) + (opt.sect ? 1 : 0) + (state.commu ? 1 : 0);
  const filtresActifs = () => !state.vide || nbOpts() > 0;
  const nPop = (p) => atlas.feats().filter((f) => !f.label && passeOpt(f) && dans(f, p.cat) && (!(p.sc || []).length || scDe(f, p.cat).some((x) => p.sc.includes(x)))).length;
  // nombres affichés sur les boutons : repères de la catégorie (options comprises)
  function comptes() {
    lireFavs();
    const all = atlas.feats().filter((f) => !f.label && passeOpt(f));
    $$('[data-n]').forEach((el) => { const k = el.dataset.n; if (cats[k]) el.textContent = all.filter((f) => dans(f, k)).length; });
    const t = $('[data-n="tout"]'); if (t) t.textContent = all.length;
  }
  function sync() {
    const tt = !state.vide && sel.size === Object.keys(cats).length && !Object.values(subs).some((s) => s && s.size);
    $$('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', !state.solo && !tt && sel.has(b.dataset.cat)));
    $('[data-all]').setAttribute('aria-pressed', !state.solo && tt);
    $('[data-explorer]').setAttribute('aria-pressed', !state.solo && !tt && [...sel].some((c) => (OPT.explorer || []).includes(c)));
    $$('[data-pop]').forEach((b) => b.setAttribute('aria-pressed', state.pop === b.dataset.pop));
    const n = nbOpts() + (state.vide || tt ? 0 : [...sel].filter((c) => !(OPT.rapides || []).includes(c) || (subs[c] && subs[c].size)).length);
    const nf = $('[data-nf]'); nf.hidden = !n; nf.textContent = n;
    $('[data-reset]').hidden = !filtresActifs();
    const hv = $('[data-vide]'); if (hv) hv.hidden = !state.vide || !panel.hidden || !!state.solo;
    ecrireURL();
  }
  // ---------- choisir ----------
  function choisirCats(ids, scs) {
    unsolo(); sel.clear(); Object.keys(subs).forEach((k) => delete subs[k]); state.lq = '';
    ids.forEach((c) => { if (cats[c]) sel.add(c); });
    if (scs) Object.entries(scs).forEach(([c, L]) => { const s = L.filter((x) => subNoms[c + ':' + x]); if (s.length) subs[c] = new Set(s); });
    state.vide = !sel.size; applyFilter();
  }
  const tout = () => { state.pop = ''; choisirCats(Object.keys(cats)); };
  function reset() {
    state.pop = ''; Object.assign(opt, DEF); state.commu = false; state.glitch = '';
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
    if (f.hv) state.cible = f.id; // un repère masqué par défaut reste visible quand on l'ouvre depuis un lien ou une recherche
    if (state.solo ? f.id === state.solo : passe(f)) return;
    state.lq = '';
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

  // taille de l'écran lue une seule fois (puis à chaque redimensionnement) : la relire après chaque modification
  // de la page forçait le navigateur à recalculer la mise en page plusieurs fois par clic
  let ECR = { w: innerWidth, h: innerHeight };
  addEventListener('resize', () => { ECR = { w: innerWidth, h: innerHeight }; }, { passive: true });
  const cote = () => ECR.w < 900 && ECR.w > ECR.h && ECR.h < 520; // téléphone en paysage
  const mobile = () => ECR.w < 900 && !cote();
  // travail non urgent repoussé après l'affichage de la réponse (l'interaction se termine plus vite)
  const COLL = new Intl.Collator('fr').compare;
  const apresAffichage = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));
  function padding() {
    if (cote()) return { top: (top.getBoundingClientRect().bottom - page.getBoundingClientRect().top) + 6, bottom: 70, left: 10, right: panel.hidden ? 10 : Math.round(Math.min(innerWidth * .46, 380)) + 16 };
    return { top: (top.getBoundingClientRect().bottom - page.getBoundingClientRect().top) + 10, bottom: mobile() ? 130 : 70, left: 10, right: mobile() ? 10 : (panel.hidden ? 70 : 430) };
  }

  // ---------- petit message avec « Annuler » (trouvé, favori) ----------
  let snT = 0;
  function snack(msg, annulerFn) {
    const s = $('[data-snack]'); if (!s) return;
    $('[data-snack-t]', s).textContent = msg;
    const b = $('[data-snack-undo]', s); b.hidden = !annulerFn;
    b.onclick = () => { s.hidden = true; if (annulerFn) annulerFn(); };
    s.hidden = false; s.classList.remove('is-in'); void s.offsetWidth; s.classList.add('is-in');
    clearTimeout(snT); snT = setTimeout(() => { s.hidden = true; }, 4000);
  }
  const sansToast = () => { const t = document.querySelector('.toast'); if (t) t.hidden = true; };

  // ---------- panneau coulissant : réduit (≈20 %), intermédiaire (≈45 %), complet (≈90 %) sur téléphone ; à droite sur ordinateur ----------
  const NIV = ['compact', 'moyen', 'grand'];
  // les hauteurs du panneau ne dépendent que de l'écran : mesurées une fois par taille d'écran, pas après chaque nouveau contenu
  // (mesurer juste après avoir inséré une longue liste forçait le calcul complet de sa mise en page)
  let hCache = null;
  function hauteurs() {
    const k = ECR.w + 'x' + ECR.h;
    if (hCache && hCache.k === k) return hCache.v;
    const dispo = Math.max(240, panel.getBoundingClientRect().bottom - page.getBoundingClientRect().top - 6);
    const v = { compact: Math.round(Math.min(Math.max(dispo * .2, 132), 190)), moyen: Math.round(Math.max(dispo * .45, 250)), grand: Math.round(dispo * .9) };
    if (!panel.hidden) hCache = { k, v };
    return v;
  }
  function showPanel(html, niveau = 'moyen') {
    const hv = $('[data-vide]'); if (hv) hv.hidden = true; garde(false); legende(false); menuReg(false);
    panel.classList.remove('pn-anim', 'pn-fiche', 'pn-veh');
    if (panel.hidden) { panel.hidden = false; page.classList.add('has-panel'); }
    if (mobile()) hauteurs();
    panel.innerHTML = `<button type="button" class="pn-grip" data-grip aria-label="Changer la hauteur du panneau"><i></i></button><div class="pn-c">${html}</div>`;
    panel.hidden = false; page.classList.add('has-panel');
    taillePanneau(niveau);
    $('.pn-c', panel).scrollTop = 0;
    if ((innerWidth >= 900 || cote()) && atlas) atlas.setPad(padding());
    $$('[data-x]', panel).forEach((b) => b.addEventListener('click', closePanel));
    $$('[data-tg]', panel).forEach((b) => b.addEventListener('click', () => { panel.classList.add('pn-anim'); taillePanneau(panel.dataset.taille === 'grand' ? 'moyen' : 'grand'); }));
    $('[data-grip]', panel).addEventListener('click', () => { if (glisse) return; panel.classList.add('pn-anim'); taillePanneau(NIV[(NIV.indexOf(panel.dataset.taille) + 1) % 3]); });
    LG.syncFavs && LG.syncFavs();
    if (g && !reduce) g.fromTo(panel, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .25, ease: 'power2.out', clearProps: 'transform' });
  }
  function taillePanneau(t) {
    if (!mobile()) { panel.style.height = ''; delete panel.dataset.taille; delete page.dataset.pn; majCTA(); return; }
    panel.dataset.taille = t; page.dataset.pn = t; // copie sur la page : remplace des sélecteurs :has() coûteux
    // fiche réduite d'un véhicule : juste la hauteur de son contenu (nom, statut, variante, lieu, bouton)
    const vm = t === 'compact' && panel.classList.contains('pn-veh') && $('.pn-vmini', panel);
    const h = vm ? Math.min(Math.max(hauteurs().compact, Math.ceil(vm.getBoundingClientRect().bottom - panel.getBoundingClientRect().top + 16)), Math.round(hauteurs().moyen * .9)) : hauteurs()[t];
    panel.style.height = h + 'px';
    page.style.setProperty('--pn-h', h + 'px'); // les commandes de la carte restent au-dessus du panneau
    requestAnimationFrame(majCtrl); setTimeout(majCtrl, 300);
    const lab = { compact: 'Panneau réduit : toucher pour l’agrandir', moyen: 'Panneau à mi-hauteur : toucher pour l’agrandir', grand: 'Panneau en grand : toucher pour le réduire' }[t];
    $$('[data-grip]', panel).forEach((x) => x.setAttribute('aria-label', lab));
    $$('[data-tg]', panel).forEach((x) => { x.setAttribute('aria-label', t === 'grand' ? 'Réduire le panneau' : 'Agrandir le panneau'); x.classList.toggle('is-up', t === 'grand'); });
    majCTA();
  }
  // glisser la poignée ou l'en-tête : le panneau suit le doigt, puis se cale sur la hauteur la plus proche
  let glisse = null;
  panel.addEventListener('pointerdown', (e) => {
    if (!mobile() || e.button > 0) return;
    if (!e.target.closest('[data-grip], .pn-h') || e.target.closest('.pn-h button, .pn-h a')) return;
    glisse = { y: e.clientY, h: panel.offsetHeight, t: performance.now(), bouge: false, id: e.pointerId };
  });
  addEventListener('pointermove', (e) => {
    if (!glisse || e.pointerId !== glisse.id) return;
    const dy = e.clientY - glisse.y;
    if (!glisse.bouge && Math.abs(dy) < 6) return;
    if (!glisse.bouge) { glisse.bouge = true; panel.classList.remove('pn-anim'); }
    const hh = Math.max(70, Math.min(hauteurs().grand, glisse.h - dy)); panel.style.height = hh + 'px'; page.style.setProperty('--pn-h', hh + 'px');
  });
  const finGlisse = (e) => {
    if (!glisse || e.pointerId !== glisse.id) return;
    const gl = glisse;
    if (!gl.bouge) { glisse = null; return; }
    const H = hauteurs(), h = panel.offsetHeight, v = (e.clientY - gl.y) / Math.max(1, performance.now() - gl.t);
    panel.classList.add('pn-anim');
    if (h < H.compact * .75 || (v > .9 && panel.dataset.taille === 'compact')) closePanel();
    else {
      let best = NIV.reduce((a, k) => (Math.abs(H[k] - h) < Math.abs(H[a] - h) ? k : a), 'compact');
      if (Math.abs(v) > .6) { const i = NIV.indexOf(best); best = NIV[Math.max(0, Math.min(2, v < 0 ? (H[best] < h ? i + 1 : i) : (H[best] > h ? i - 1 : i)))]; }
      taillePanneau(best);
    }
    setTimeout(() => { glisse = null; }, 0); // le clic qui suit n'est pas un toucher de la poignée
  };
  addEventListener('pointerup', finGlisse); addEventListener('pointercancel', finGlisse);
  // dans le contenu : vers le haut, le panneau grandit d'abord ; tout en haut du contenu, vers le bas, il rétrécit
  let sw = null;
  panel.addEventListener('touchstart', (e) => { if (!mobile() || e.target.closest('[data-grip], .pn-h, input, select, .pn-chips')) { sw = null; return; } const c = $('.pn-c', panel); sw = { y: e.touches[0].clientY, top: c ? c.scrollTop : 0 }; }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (!sw) return; const d = e.changedTouches[0].clientY - sw.y, t = panel.dataset.taille; const s0 = sw; sw = null;
    panel.classList.add('pn-anim');
    if (d < -40 && t !== 'grand' && s0.top <= 0) taillePanneau(t === 'compact' ? 'moyen' : 'grand');
    else if (d > 70 && s0.top <= 0) { if (t === 'grand') taillePanneau('moyen'); else if (t === 'moyen') taillePanneau('compact'); else closePanel(); }
  });
  // bouton principal de la fiche : « Voir sur la carte » si le panneau cache la carte, sinon « Centrer sur le lieu »
  function majCTA() {
    const b = $('[data-center]', panel); if (!b) return;
    $('span', b).textContent = panel.dataset.taille === 'grand' ? 'Voir sur la carte' : 'Centrer sur le lieu';
  }
  // commandes de la carte (téléphone) : seulement celles qui tiennent entre le haut de la carte et le panneau (ou la rangée du bas)
  function majCtrl() {
    if (!mobile()) { delete page.dataset.ctrl; return; }
    const ctrl = $('.atp-ctrl'); if (!ctrl) return;
    const haut = Math.max(...['.atp-sbar', '.atp-row', '.atp-pop'].map((q) => { const e = $(q); return e && e.offsetParent && getComputedStyle(e).display !== 'none' ? e.getBoundingClientRect().bottom : 0; })) + 8; // le message « carte vide » laisse la place à droite
    const bas = !panel.hidden ? panel.getBoundingClientRect().top - 10 : $('.atp-regions').getBoundingClientRect().top - 10;
    const place = bas - haut, n = !panel.hidden ? 4 : 5; // 44 px par bouton + 6 px d'écart
    page.dataset.ctrl = place >= n * 50 ? 'tout' : place >= 100 ? 'mini' : 'non';
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
      const bas = (!panel.hidden && mobile() ? panel.getBoundingClientRect().top - r.top : r.height - 150) - 28;
      if (sy >= haut && sy <= bas && sx >= 36 && sx <= r.width - 36) return;
      const tx = r.width / 2, ty = bas > haut ? (haut + bas) / 2 - 18 : r.height / 2;
      atlas.flyTo(f.x - (tx - fx) / atlas.cam.s, f.y + (ty - fy) / atlas.cam.s, atlas.cam.s, .5);
    }, attente);
  }
  function closePanel() { if (atlas && !state.solo) { atlas.spot(false); state.spot = ''; } panel.hidden = true; page.classList.remove('has-panel'); state.fromList = false; requestAnimationFrame(majCtrl); if (atlas) { if (innerWidth >= 900 || cote()) atlas.setPad(padding()); if (!state.solo && atlas.active() == null && !state.choisi) atlas.clearActive(); } garde(true); setTimeout(sync, 0); }
  // en-tête commun des panneaux
  const head = (icon, color, kicker, title, extra = '') => `<div class="pn-h"><span class="pn-ico" style="--c:${color}">${ic(icon)}</span><div class="pn-h-t"><small>${escH(kicker)}</small><h2>${escH(title)}</h2></div>${extra}<button type="button" class="pn-tg" data-tg aria-label="Agrandir le panneau">${ic('chevron')}</button><button type="button" class="pn-x" data-x aria-label="Fermer">${ic('x')}</button></div>`;

  // ---------- nombre de repères visibles (bouton Liste) ----------
  let cvT = 0;
  function countView() { if (cvT) return; cvT = setTimeout(() => { cvT = 0; const el = $('[data-n="vue"]'); if (el && atlas) el.textContent = atlas.inView().length; if (state.zone && !panel.hidden && $('[data-zone]', panel)) openResults(true); }, 350); }

  // ---------- précédent / suivant dans les résultats ----------
  function sameCat(f) { return atlas.feats().filter((x) => !x.label && x.cat === f.cat && passe(x)).sort((a, b) => COLL(a.nom, b.nom)); }
  function nav(f) {
    const siens = f.vs ? atlas.feats().filter((x) => x.vs === f.vs) : [];
    if (siens.length > 1) {
      const i = siens.findIndex((x) => x.id === f.id), prev = siens[(i - 1 + siens.length) % siens.length], next = siens[(i + 1) % siens.length];
      return `<div class="pn-nav pn-more"><button type="button" class="pn-navb" data-go="${escH(prev.id)}" aria-label="Emplacement précédent">${ic('arrow-left')}</button>
        <span class="pn-navn">Emplacement ${i + 1} / ${siens.length} <small>de ce véhicule</small></span>
        <button type="button" class="pn-navb" data-go="${escH(next.id)}" aria-label="Emplacement suivant">${ic('arrow-right')}</button></div>`;
    }
    const list = sameCat(f), i = list.findIndex((x) => x.id === f.id), c = cats[f.cat] || {};
    if ((list.length < 2 || i < 0) && !state.fromList) return '';
    const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    return `<div class="pn-nav pn-more">${state.fromList ? `<button type="button" class="pn-navb pn-navb--txt" data-back>${ic('list')}<span>${state.fromList === 'answer' ? 'Résultats' : 'Liste'}</span></button>` : ''}
      ${list.length > 1 && i >= 0 ? `<button type="button" class="pn-navb" data-go="${escH(prev.id)}" aria-label="Précédent : ${escH(prev.nom)}">${ic('arrow-left')}</button>
      <span class="pn-navn">${i + 1} / ${list.length} <small>${escH((c.court || c.nom || '').toLowerCase())}</small></span>
      <button type="button" class="pn-navb" data-go="${escH(next.id)}" aria-label="Suivant : ${escH(next.nom)}">${ic('arrow-right')}</button>` : ''}</div>`;
  }
  function go(id) { const f = atlas.feats().find((x) => x.id === id); if (f) { ensureShown(f); atlas.select(f, { fly: true, s: Math.max(atlas.cam.s, .3) }); } }
  function bindNav() {
    $$('[data-go]', panel).forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
    const bk = $('[data-back]', panel); if (bk) bk.addEventListener('click', () => (state.fromList === 'answer' ? openResults() : openList()));
  }

  // ---------- listes : lignes visuelles, chargement progressif ----------
  const vignette = (f, cls = 'pn-r-t') => { const c = (cats[f.cat] || {}).color; return `<span class="${cls}" style="--c:${c}">${f.img ? `<img src="${ROOT}${f.img}" alt="" loading="lazy" decoding="async">` : ic(f.icon)}</span>`; };
  // même nom plusieurs fois dans une liste (même véhicule à plusieurs endroits) : le lieu s'affiche à côté du nom pour les distinguer
  let nomsListe = {};
  const ligne = (f) => {
    const t = trouves.has(f.id), fv = estFav(f), st = statutDe(f), S = STATUTS[st] || {};
    const lieuNom = nomsListe[f.nom] > 1 ? (f.zone || f.lieuNom || secteur(f) || '') : '';
    const meta = [escH(sousNom(f)), f.rar ? `<em class="pn-r-rar">${escH(f.rar === '#' ? 'Rare' : f.rar)}</em>` : '', st !== 'probable' ? `<em class="pn-r-st" style="--c:${S.c}">${ic(S.ic)}${escH(S.n)}</em>` : ''].filter(Boolean).join('<i>·</i>');
    return `<li class="pn-r${t ? ' is-found' : ''}"><button type="button" data-pick="${escH(f.id)}">${vignette(f)}<span class="pn-r-b"><b>${escH(f.nom)}${lieuNom ? `<span class="pn-r-z"> · ${escH(lieuNom)}</span>` : ''}</b><small>${escH(court(f))}</small><span class="pn-r-m">${meta}</span></span><span class="pn-r-s">${t ? `<span class="pn-r-ok" title="Déjà trouvé">${ic('check')}</span>` : ''}${fv ? `<span class="pn-r-fv" title="Dans tes favoris">${ic('heart')}</span>` : ''}${ic('chevron')}</span></button></li>`;
  };
  function bindPick(from, racine = panel) {
    $$('[data-pick]', racine).forEach((b) => { if (b._ok) return; b._ok = 1; b.addEventListener('click', () => { const f = atlas.feats().find((x) => x.id === b.dataset.pick); if (!f) return; state.fromList = from; b.classList.add('is-pick'); page.classList.add('is-busy'); apresAffichage(() => { atlas.select(f, { fly: true, s: Math.max(atlas.cam.s, .3) }); page.classList.remove('is-busy'); }); }); });
  }
  // affiche 40 lignes, puis la suite quand on arrive en bas (liste longue sans ralentir le téléphone)
  function remplir(ul, list, from) {
    let i = 0; const PAS = 40;
    nomsListe = {}; list.forEach((f) => { nomsListe[f.nom] = (nomsListe[f.nom] || 0) + 1; });
    const plus = () => {
      const old = $('[data-more]', ul); if (old) old.remove();
      ul.insertAdjacentHTML('beforeend', list.slice(i, i + PAS).map(ligne).join('')); i += PAS;
      bindPick(from, ul);
      if (i < list.length) {
        ul.insertAdjacentHTML('beforeend', `<li class="pn-more-l" data-more><button type="button">Afficher la suite (${list.length - i})</button></li>`);
        const m = $('[data-more]', ul); $('button', m).addEventListener('click', plus);
        if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); if (m.isConnected) plus(); } }, { root: $('.pn-c', panel), rootMargin: '200px' }); io.observe(m); }
      }
    };
    ul.innerHTML = ''; plus();
  }
  const RANG_ST = { verifie: 0, officiel: 0, probable: 1, nonconf: 2, nonverif: 3 };
  function trier(list) {
    const L = [...list], az = (a, b) => COLL(a.nom, b.nom);
    const ch = state.choisi && !state.choisi.commu ? state.choisi : null;
    const t = state.tri;
    if (t === 'az') return L.sort(az);
    if (t === 'rar') return L.sort((a, b) => (!!b.rar - !!a.rar) || az(a, b));
    if (t === 'reg') return L.sort((a, b) => COLL(secteur(a) || '~', secteur(b) || '~') || az(a, b));
    if (t === 'nt') return L.sort((a, b) => (trouves.has(a.id) - trouves.has(b.id)) || az(a, b));
    if (t === 'fav') return L.sort((a, b) => (estFav(b) - estFav(a)) || az(a, b));
    if (t === 'proche' && ch) return L.sort((a, b) => Math.hypot(a.x - ch.x, a.y - ch.y) - Math.hypot(b.x - ch.x, b.y - ch.y));
    if (t === 'fiab') return L.sort((a, b) => (RANG_ST[statutDe(a)] - RANG_ST[statutDe(b)]) || az(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (t === 'centre') { const v = atlas.vue(); return L.sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); }
    // pertinence (ordre stable) : véhicules rares et uniques, puis étoiles et note d'intérêt pour les véhicules ;
    // ailleurs, repères du guide et éléments rares d'abord ; puis les plus fiables, l'ordre alphabétique et l'identifiant
    return L.sort((a, b) => (!!b.ru - !!a.ru) || ((b.et || 0) - (a.et || 0)) || ((b.nt || 0) - (a.nt || 0)) || ((a.src === 'ogm') - (b.src === 'ogm')) || (!!b.rar - !!a.rar) || (RANG_ST[statutDe(a)] - RANG_ST[statutDe(b)]) || az(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  const outilsListe = (n) => `<div class="pn-lt pn-more"><label class="pn-lq">${ic('search')}<span class="sr-only">Chercher dans cette liste</span><input type="search" data-lq value="${escH(state.lq)}" placeholder="Filtrer ces ${n} résultats" autocomplete="off" enterkeyhint="search"></label>
    <label class="pn-sort"><span class="sr-only">Trier</span>${ic('sliders')}<select data-tri>${[['pert', 'Pertinence'], ['az', 'A → Z'], ['rar', 'Rares d’abord'], ['reg', 'Par région'], ['fiab', 'Plus fiables d’abord'], ['centre', 'Près du centre de la carte'], ['nt', 'Non trouvés d’abord'], ['fav', 'Favoris d’abord'], ...(state.choisi && !state.choisi.commu ? [['proche', 'Proches du repère choisi']] : [])].map(([v, l]) => `<option value="${v}"${state.tri === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label><button type="button" class="pn-zone" data-zone aria-pressed="${!!state.zone}" title="N’afficher que les résultats visibles à l’écran">${ic('focus')}<span>Zone visible</span></button></div>`;
  function bindOutils(refaire) {
    const q = $('[data-lq]', panel), tr = $('[data-tri]', panel); let qt;
    const zb = $('[data-zone]', panel); if (zb) zb.addEventListener('click', () => { state.zone = !state.zone; refaire(); });
    if (q) q.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { state.lq = q.value.trim(); applyFilter(); refaire(); }, 220); });
    if (tr) tr.addEventListener('change', () => { state.tri = tr.value; refaire(); });
  }
  function openList() {
    const list = atlas.inView();
    showPanel(`${head('list', '#ff2bd6', 'Dans cette partie de la carte', list.length ? `${list.length} repère${list.length > 1 ? 's' : ''} à voir` : 'Aucun repère ici')}
      ${list.length ? '<ul class="pn-rl" data-rl></ul>' : `<p class="pn-vide">${state.vide ? 'Choisis ce que tu recherches pour afficher les lieux sur la carte.' : 'Déplace la carte ou dézoome pour trouver des repères.'}</p>`}`);
    if (list.length) remplir($('[data-rl]', panel), trier(list), 'list');
  }
  // résumé lisible des filtres actifs
  function resume() {
    const t = [];
    if (state.glitch) { const x = atlas.feats().flatMap((f) => f.gl || []).find((y) => y.s === state.glitch); return 'Lieux du glitch : ' + (x ? x.t : state.glitch); }
    if (state.pop) t.push(((OPT.populaires || []).find((p) => p.id === state.pop) || {}).nom);
    else if (sel.size === Object.keys(cats).length && !Object.values(subs).some((x) => x && x.size)) t.push('Tous les repères');
    else [...sel].forEach((c) => { const s = subs[c]; t.push(s && s.size ? [...s].map((x) => subNoms[c + ':' + x]).join(', ') : (cats[c] || {}).nom); });
    return t.filter(Boolean).join(' · ');
  }
  // ---------- résultats : sous-catégories en filtres horizontaux, recherche interne, tri, liste ----------
  function openResults(garderTaille) {
    if (state.vide) return openFiltres();
    const list = resultats();
    const seule = sel.size === 1 ? [...sel][0] : '';
    const c = cats[seule] || { icon: 'filter', color: '#19d3e3', sous: [] };
    const pop = (OPT.populaires || []).find((p) => p.id === state.pop);
    const nf = list.filter((f) => trouves.has(f.id)).length;
    const base = atlas.feats().filter((f) => !f.label && passeOpt(f));
    const chips = seule ? [`<button type="button" class="pn-chip" data-sub="" aria-pressed="${!(subs[seule] && subs[seule].size)}">Tous</button>`, ...c.sous.map((s) => { const n = base.filter((f) => dans(f, seule) && scDe(f, seule).includes(s.id)).length; return n ? `<button type="button" class="pn-chip" data-sub="${s.id}" aria-pressed="${!!(subs[seule] && subs[seule].has(s.id))}">${escH(s.nom)} <small>${n}</small></button>` : ''; })]
      : [...sel].map((k) => `<button type="button" class="pn-chip" data-only="${k}" style="--c:${cats[k].color}">${ic(cats[k].icon)}${escH(cats[k].court || cats[k].nom)}</button>`);
    const t = panel.dataset.taille, c0 = $('.pn-c', panel), y = garderTaille && c0 ? c0.scrollTop : 0;
    showPanel(`${head(pop ? pop.icon : c.icon, c.color, pop ? 'Recherche populaire' : seule ? 'Catégorie' : 'Résultats', pop ? pop.nom : seule && !(subs[seule] && subs[seule].size) ? c.nom : resume() || 'Tous les repères', `<span class="pn-count"><b>${list.length}</b><small>${nf ? `${nf} trouvé${nf > 1 ? 's' : ''}` : `résultat${list.length > 1 ? 's' : ''}`}</small></span>`)}
      <div class="pn-chips" role="group" aria-label="Sous-catégories" style="--c:${c.color}">${chips.join('')}</div>
      ${outilsListe(list.length)}
      <div class="pn-ra pn-more"><button type="button" class="pn-lnk" data-open-f>${ic('filter')}Tous les filtres</button><button type="button" class="pn-lnk" data-fit>${ic('locate')}Voir sur la carte</button>${pop && pop.page ? `<a class="pn-lnk" href="${ROOT}${pop.page}">${ic('guide')}Le guide</a>` : ''}</div>
      ${list.length ? '<ul class="pn-rl" data-rl></ul>' : `<div class="pn-vide"><p><b>Aucun résultat avec ces filtres.</b>${opt.verif ? ' Aucun emplacement n’est encore vérifié en jeu par notre équipe.' : state.lq ? ` Rien ne correspond à « ${escH(state.lq)} ».` : ''}</p><button type="button" class="nbtn" data-reset-in><span>Réinitialiser les filtres</span><i>${ic('x')}</i></button></div>`}`, garderTaille && t ? t : 'moyen');
    if (list.length) remplir($('[data-rl]', panel), trier(list), 'answer');
    if (y) $('.pn-c', panel).scrollTop = y;
    bindOutils(() => { openResults(true); const q = $('[data-lq]', panel); if (q && state.lq) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } });
    $$('[data-sub]', panel).forEach((b) => b.addEventListener('click', () => { state.pop = ''; const v = b.dataset.sub; $$('[data-sub]', panel).forEach((x) => x.setAttribute('aria-pressed', x === b)); page.classList.add('is-busy'); apresAffichage(() => { if (!v) delete subs[seule]; else subs[seule] = new Set([v]); applyFilter(); openResults(true); page.classList.remove('is-busy'); }); }));
    $$('[data-only]', panel).forEach((b) => b.addEventListener('click', () => { state.pop = ''; choisirCats([b.dataset.only]); openResults(true); }));
    $('[data-open-f]', panel).addEventListener('click', openFiltres);
    $('[data-fit]', panel).addEventListener('click', () => { if (mobile()) { panel.classList.add('pn-anim'); taillePanneau('compact'); } fitResults(); });
    const rz = $('[data-reset-in]', panel); if (rz) rz.addEventListener('click', reset);
  }
  // groupe de repères au même endroit (inséparables au zoom) : leur liste
  function openCluster(m) {
    const c = cats[m[0].cat] || {};
    showPanel(`${head('list', c.color || '#ff2bd6', 'Au même endroit', `${m.length} repères ici`)}<p class="pn-hint">Ils sont trop proches pour être séparés sur la carte.</p><ul class="pn-rl" data-rl></ul>`);
    remplir($('[data-rl]', panel), trier(m), 'list');
  }

  // ---------- tous les filtres, par sections ----------
  function openFiltres() {
    const base = atlas.feats().filter((f) => !f.label && passeOpt(f));
    const nC = (c) => base.filter((f) => dans(f, c)).length;
    const nS = (c, s) => base.filter((f) => dans(f, c) && scDe(f, c).includes(s)).length;
    const all = atlas.feats().filter((f) => !f.label);
    const nO = (fn) => all.filter(fn).length;
    const secteurs = {}; all.forEach((f) => { const s = secteur(f); if (s) secteurs[s] = (secteurs[s] || 0) + 1; });
    const sects = Object.keys(secteurs).filter((s) => secteurs[s] >= 3 || s === opt.sect).sort((a, b) => a.localeCompare(b, 'fr'));
    const tog = (k, lab, aide) => `<button type="button" class="pn-opt" data-opt="${k}" aria-pressed="${k === 'commu' ? state.commu : opt[k]}"><span class="pn-sw" aria-hidden="true"></span><span><b>${escH(lab)}</b>${aide ? `<small>${escH(aide)}</small>` : ''}</span></button>`;
    const nHv = nO((f) => f.hv && !f.dbl), nPr = nO((f) => f.fi === 'probable' || f.fi === 'confirme' || f.statut === 'teste'), nVerif = nO((f) => statutDe(f) === 'verifie'), nApprox = nO((f) => statutDe(f) === 'nonconf'), nNc = nO((f) => statutDe(f) === 'nonverif'), nRar = nO((f) => f.rar), nSp = nO((f) => f.cat === 'missions' && f.missions), nGl = nO((f) => f.gl);
    const sect = (titre, corps) => (corps.trim() ? `<section class="pn-fs"><h3 class="pn-fs-h">${titre}</h3>${corps}</section>` : '');
    const n = state.vide ? 0 : resultats().length;
    const c0 = $('.pn-c', panel), y = !panel.hidden && $('[data-fc]', panel) && c0 ? c0.scrollTop : 0;
    showPanel(`${head('filter', '#19d3e3', 'Affiner la carte', 'Filtres')}
      ${sect('Catégories', `<ul class="pn-fcats">${Object.values(cats).map((c) => {
        const on = !state.vide && sel.has(c.id), s = subs[c.id];
        return `<li style="--c:${c.color}"><div class="pn-fc"><button type="button" class="pn-fcb" data-fc="${c.id}" aria-pressed="${on}"><span class="pn-fci">${ic(c.icon)}</span><span><b>${escH(c.nom)}</b></span><em>${nC(c.id)}</em></button>${c.sous.length ? `<button type="button" class="pn-fcx" data-fx="${c.id}" aria-expanded="${on && !!(s && s.size)}" aria-label="Sous-catégories : ${escH(c.nom)}">${ic('chevron')}</button>` : ''}</div>
          ${c.sous.length ? `<div class="pn-fsub" data-fsub="${c.id}"${on && s && s.size ? '' : ' hidden'}>${c.sous.map((x) => `<button type="button" class="pn-chip" data-fs="${c.id}:${x.id}" aria-pressed="${!!(on && s && s.has(x.id))}">${escH(x.nom)} <small>${nS(c.id, x.id)}</small></button>`).join('')}</div>` : ''}</li>`;
      }).join('')}</ul>`)}
      ${sects.length ? sect('Localisation', `<label class="pn-sect"><span class="sr-only">Région ou quartier</span><select data-sect><option value="">Toutes les régions</option>${sects.map((x) => `<option value="${escH(x)}"${x === opt.sect ? ' selected' : ''}>${escH(x)} (${secteurs[x]})</option>`).join('')}</select></label><p class="pn-fs-n">Seuls les repères dont le quartier est connu sont filtrés.</p>`) : ''}
      ${sect('Progression', `${tog('cacheT', 'Masquer les éléments déjà trouvés', trouves.size ? `N’affiche que les non trouvés (${trouves.size} marqué${trouves.size > 1 ? 's' : ''})` : 'Rien de marqué pour l’instant')}${tog('favs', 'Uniquement mes favoris', favSet.size ? '' : 'Ajoute un lieu en favori avec le cœur de sa fiche')}`)}
      ${sect('Fiabilité', `${nVerif ? tog('verif', 'Confirmés uniquement', `${nVerif} repère${nVerif > 1 ? 's' : ''} confirmé${nVerif > 1 ? 's' : ''}`) : ''}${nApprox ? tog('approx', 'Afficher les emplacements approximatifs', `Zone seulement (${nApprox})`) : ''}${nNc ? tog('nonconf', 'Afficher les informations non vérifiées', `${nNc} repères masqués par défaut`) : ''}${nPr ? tog('prouve', 'Uniquement les emplacements prouvés', `${nPr} repères : capture prise en jeu sur place ou deux sources concordantes`) : ''}${nHv ? tog('tousv', 'Afficher tous les véhicules', `${nHv} masqués par défaut : véhicules ordinaires (note sous 60) et emplacements non vérifiés`) : ''}<p class="pn-fs-n">Aucun emplacement n’est encore vérifié en jeu par notre équipe : « Confirmé » s’appuie sur une source officielle et une source indépendante.</p>`)}
      ${sect('Autres options', `${nSp ? tog('spoil', 'Masquer les spoilers', 'Cache les lieux des missions de l’histoire') : ''}${nRar ? tog('rares', 'Uniquement les éléments rares', 'Véhicules et armes uniques, objets rares') : ''}${nGl ? tog('gl', 'Uniquement les lieux de glitchs', `${nGl} lieux utilisés dans un tutoriel de glitch`) : ''}${commu.length ? tog('commu', 'Lieux de la communauté (GTADB)', 'Non vérifiés, visibles en zoomant') : ''}`)}
      <div class="pn-act pn-act--f"><button type="button" class="nbtn" data-reset-in><span>Réinitialiser</span><i>${ic('x')}</i></button><button type="button" class="nbtn nbtn--primary" data-voir><span>${state.vide ? 'Afficher les résultats' : `Afficher ${n} résultat${n > 1 ? 's' : ''}`}</span><i>${ic('arrow-right')}</i></button></div>`, 'grand');
    if (y) $('.pn-c', panel).scrollTop = y;
    const garder = (fn) => { fn(); state.pop = ''; comptes(); applyFilter(); openFiltres(); };
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
  // « Explorer » : les catégories secondaires dans un seul panneau compact (une entrée au lieu de quatre onglets)
  function openExplorer() {
    const base = atlas.feats().filter((f) => !f.label && passeOpt(f));
    const L = (OPT.explorer || []).map((id) => cats[id]).filter(Boolean);
    const ligne = (c) => { const n = base.filter((f) => dans(f, c.id)).length; if (!n) return '';
      const sous = (c.sous || []).map((s) => ({ s, n: base.filter((f) => dans(f, c.id) && scDe(f, c.id).includes(s.id)).length })).filter((x) => x.n).slice(0, 6);
      return `<li style="--c:${c.color}"><button type="button" class="pn-ex-c" data-ex="${c.id}"><span class="pn-fci">${ic(c.icon)}</span><span><b>${escH(c.nom)}</b><small>${escH(c.sens || '')}</small></span><em>${n}</em></button>
        ${sous.length ? `<div class="pn-ex-s">${sous.map((x) => `<button type="button" class="pn-chip" data-ex="${c.id}" data-ex-s="${x.s.id}">${escH(x.s.nom)} <small>${x.n}</small></button>`).join('')}</div>` : ''}</li>`; };
    showPanel(`${head('compass', '#f4f1ff', 'Explorer', 'Activités, lieux et services')}
      <ul class="pn-ex">${L.map(ligne).join('')}</ul>
      <div class="pn-act pn-act--f"><button type="button" class="nbtn" data-ex-tout><span>Afficher tous les repères</span><i>${ic('map')}</i></button></div>`, 'grand');
    $$('[data-ex]', panel).forEach((b) => b.addEventListener('click', () => { state.pop = ''; choisirCats([b.dataset.ex], b.dataset.exS ? { [b.dataset.ex]: [b.dataset.exS] } : null); openResults(); }));
    $('[data-ex-tout]', panel).addEventListener('click', () => { tout(); closePanel(); atlas.reset(); });
  }
  function openProgression() {
    const F = atlas.feats().filter((f) => !f.label);
    const T = F.filter((f) => trouves.has(f.id)).length;
    const pc = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);
    const bar = (n, t, c) => `<span class="pn-bar" style="--c:${c};--p:${pc(n, t)}%" role="progressbar" aria-valuemin="0" aria-valuemax="${t}" aria-valuenow="${n}"><i></i></span>`;
    const lignes = Object.values(cats).map((c) => { const L = F.filter((f) => f.cat === c.id), n = L.filter((f) => trouves.has(f.id)).length; return `<li style="--c:${c.color}"><button type="button" data-pg="${c.id}"><span class="pn-fci">${ic(c.icon)}</span><span><b>${escH(c.nom)}</b>${bar(n, L.length, c.color)}</span><em>${n}/${L.length}<small>${String(pc(n, L.length)).replace('.', ',')} %</small></em></button></li>`; }).join('');
    // par collection : trouvés, restants, pourcentage, et l'objet non trouvé le plus proche du centre de la carte
    const cc = cats.collection, ctr = atlas.vue ? atlas.vue() : null;
    const colls = cc ? (cc.sous || []).map((s) => {
      const L = F.filter((f) => f.cat === 'collection' && scDe(f, 'collection').includes(s.id)); if (!L.length) return '';
      const n = L.filter((f) => trouves.has(f.id)).length, reste = L.filter((f) => !trouves.has(f.id));
      let best = null; if (ctr) for (const f of reste) { const d = Math.hypot(f.x - ctr.x, f.y - ctr.y); if (!best || d < best.d) best = { f, d }; }
      return `<li style="--c:${cc.color}"><button type="button" data-pg-sc="${s.id}"><span><b>${escH(s.nom)}</b>${bar(n, L.length, cc.color)}</span><em>${n}/${L.length}<small>${reste.length} restant${reste.length > 1 ? 's' : ''}</small></em></button>${best ? `<button type="button" class="pn-pg-near" data-go="${escH(best.f.id)}" aria-label="Aller à l’objet non trouvé le plus proche : ${escH(best.f.nom)}">${ic('locate')}Le plus proche</button>` : ''}</li>`;
    }).join('') : '';
    showPanel(`${head('progress', '#39ff88', 'Ma progression', `${String(pc(T, F.length)).replace('.', ',')} % des repères`)}
      <div class="pn-pg-g">${bar(T, F.length, '#39ff88')}<p><b>${T}</b> sur ${F.length} repères marqués comme trouvés ou visités.</p></div>
      <p class="pn-hint">Calculé sur les repères de cette carte, pas sur le contenu complet du jeu (les totaux officiels ne sont pas connus). Enregistré automatiquement sur cet appareil${window.LG_SB && window.LG_SB.url ? ' et dans ton compte si tu es connecté' : ''}.</p>
      <ul class="pn-pg">${lignes}</ul>
      ${colls ? `<h3 class="pn-pg-h">${ic('badge')}Collections</h3><ul class="pn-pg pn-pg--c">${colls}</ul>` : ''}
      <div class="pn-pg-io"><button type="button" class="pn-lnk" data-pg-exp>${ic('download')}Exporter ma progression</button><label class="pn-lnk">${ic('save')}Importer<input type="file" accept="application/json,.json" data-pg-imp hidden></label></div>
      <div class="pn-act pn-act--f">${dernier ? `<button type="button" class="nbtn" data-undo><span>Annuler : ${escH(dernier.f.nom)}</span><i>${ic('replay')}</i></button>` : ''}<button type="button" class="nbtn" data-pg-hide aria-pressed="${opt.cacheT}"><span>${opt.cacheT ? 'Réafficher les trouvés' : 'Masquer les trouvés'}</span><i>${ic('eye')}</i></button></div>`, 'grand');
    $$('[data-pg]', panel).forEach((b) => b.addEventListener('click', () => { state.pop = ''; choisirCats([b.dataset.pg]); openResults(); }));
    const u = $('[data-undo]', panel); if (u) u.addEventListener('click', () => { annuler(); openProgression(); });
    $('[data-pg-hide]', panel).addEventListener('click', () => { opt.cacheT = !opt.cacheT; comptes(); applyFilter(); openProgression(); });
    $$('[data-pg-sc]', panel).forEach((b) => b.addEventListener('click', () => { state.pop = ''; choisirCats(['collection'], { collection: [b.dataset.pgSc] }); openResults(); }));
    $$('.pn-pg-near', panel).forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
    // export / import : un fichier JSON avec les identifiants stables des repères trouvés (rien n'est effacé à l'import : les deux listes sont réunies)
    $('[data-pg-exp]', panel).addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ site: 'gta6facile.fr', type: 'progression-carte', version: 1, date: new Date().toISOString(), trouves: [...trouves] })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gta6facile-progression.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    $('[data-pg-imp]', panel).addEventListener('change', (e) => {
      const fi = e.target.files && e.target.files[0]; if (!fi) return;
      fi.text().then((t) => { const d = JSON.parse(t); if (!d || !Array.isArray(d.trouves)) throw new Error('format');
        const ids = new Set(atlas.feats().map((f) => f.id)); let n = 0; d.trouves.forEach((id) => { if (typeof id === 'string' && ids.has(id) && !trouves.has(id)) { trouves.add(id); n++; } });
        saveT(); atlas.markFound(trouves); applyFilter(); openProgression(); LG.toast && LG.toast(`${n} repère${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} à ta progression`, 'check'); })
        .catch(() => { LG.toast && LG.toast('Fichier de progression illisible', 'alert'); });
    });
  }
  function marquer(f, on) {
    on ? trouves.add(f.id) : trouves.delete(f.id); saveT();
    dernier = { f, on };
    atlas.markFound && atlas.markFound(trouves);
    if (opt.cacheT) applyFilter();
  }
  function annuler() { if (!dernier) return; const { f, on } = dernier; on ? trouves.delete(f.id) : trouves.add(f.id); saveT(); atlas.markFound(trouves); dernier = null; if (opt.cacheT) applyFilter(); }

  // ---------- légende et menu des régions ----------
  function legende(on) {
    const L = $('#atp-leg'), b = $('[data-leg-btn]'); if (!L) return;
    L.hidden = !on; b.setAttribute('aria-expanded', !!on);
  }
  function menuReg(on) {
    const m = $('[data-reg-menu]'), b = $('[data-reg-btn]'); if (!m) return;
    m.hidden = !on; b.setAttribute('aria-expanded', !!on);
    if (on) { const x = $('[role="menuitem"]', m); if (x) x.focus(); }
  }

  // ---------- fiche d'un repère ----------
  function openFeature(f) {
    if (state.spot && state.spot !== f.id) { state.spot = ''; atlas.spot(false); }
    const c = cats[f.cat] || {}; const r = regions[f.region];
    const favType = f.cat === 'vehicules' ? 'vehicule' : 'lieu';
    const fav = f.vs ? { id: f.vs, type: 'vehicule', t: f.vn || f.nom, u: f.url, i: f.icon, c: c.color } : { id: f.cat === 'vehicules' ? f.id.replace(/^v-/, '') : f.id, type: favType, t: f.nom, u: f.cat === 'vehicules' && f.url ? f.url : `carte/?focus=${f.id}`, i: f.icon, c: c.color };
    const t = f.tip;
    const veh = f.cat === 'vehicules';
    const sc = scDe(f, f.cat).map((s) => subNoms[f.cat + ':' + s]).filter(Boolean);
    const kicker = [c.nom, sc[0] || f.service].filter(Boolean).join(' · ');
    const titre = veh ? f.nom : t && !(/^[sm]-/.test(f.id) || (f.service && !veh)) ? t.titre : f.nom;
    // véhicule non confirmé : une indication des joueurs (« à coup sûr », « toujours ») n'est pas une présence garantie
    const prudent = (x) => (veh && x && statutDe(f) !== 'verifie' && /coup s[ûu]r|toujours|garanti|syst[ée]matique|always|guaranteed/i.test(x) ? `Selon les joueurs, non vérifié : ${x.charAt(0).toLowerCase()}${x.slice(1)}` : x);
    const isT = trouves.has(f.id);
    // haut : image 16:9, ou emplacement graphique avec l'icône de la catégorie (jamais une image inventée)
    const cap = [f.imgNote ? escH(f.imgNote) : '', f.imgCredit ? 'Image : ' + escH(f.imgCredit) : ''].filter(Boolean).join(' · ');
    const hero = f.img ? `<figure class="pn-hero pn-more" style="--c:${c.color}"><img src="${ROOT}${f.img}" alt="${escH(f.nom)}" decoding="async" loading="lazy">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`
      : `<div class="pn-hero pn-hero--vide pn-more" style="--c:${c.color}" aria-hidden="true">${ic(f.icon || c.icon)}</div>`;
    const code = (f.desc || '').match(/^Code : ([^,.]+)/);
    const lead = f.desc && !f.missions && !code ? `<p class="pn-lead pn-more">${escH(prudent(court(f)))}</p>` : '';
    // informations principales : où, comment l'obtenir, rareté (seulement ce qui existe)
    const ou = [f.lieuNom, f.zone && !(f.lieuNom || '').includes(f.zone) ? f.zone : '', r && !(f.lieuNom || '').includes(r.nom) ? r.nom : ''].filter(Boolean);
    const reste = f.desc && !f.missions ? (code ? f.desc.replace(/^Code : [^.]*\.\s*/, '') : court(f) !== f.desc ? f.desc : '') : '';
    const infos = [
      ['pin', 'Emplacement', escH(ou.length ? ou.join(' · ') : f.nom) + (f.acces ? `<small>${ic('compass')}${escH(f.acces)}</small>` : '')],
      secteur(f) && !ou.includes(secteur(f)) ? ['map', 'Région ou quartier', escH(secteur(f))] : null,
      code ? ['code', 'Code du coffre', `<b class="pn-code">${escH(code[1])}</b><small>Selon les guides, pas vérifié en jeu.</small>`] : null,
      f.ob ? ['check', 'Comment l’obtenir', escH(f.ob)] : t ? ['bolt', 'Comment faire', `${escH(t.reponse)}${t.etapes && t.etapes.length ? `<ol class="pn-steps">${t.etapes.map((e) => `<li>${escH(e)}</li>`).join('')}</ol>` : ''}`] : null,
      rarete(f) ? ['diamond', 'Rareté', escH(rarete(f))] : null,
      veh && (f.et || f.ru) ? ['star', 'Sélection GTA 6 Facile', `${f.et ? `<b>${'★'.repeat(f.et)}</b> ` : ''}${f.ru ? 'Rare et unique' : ''}<small>Choix de la rédaction, pas une mesure de rareté en jeu.</small>`] : null,
      reste ? ['info', veh && !/^v-/.test(f.id) ? 'Indication des joueurs' : 'Infos utiles', escH(prudent(reste))] : null
    ].filter(Boolean);
    const dl = `<dl class="pn-key pn-more">${infos.map(([i, k, v]) => `<div><dt>${ic(i)}${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
    const mis = f.missions && !opt.spoil ? `<div class="pn-mis pn-more"><h3>${ic('flag')}Les missions ici</h3><ul>${[...f.missions].sort((a, b) => (b.id === params.get('mission')) - (a.id === params.get('mission'))).map((m) => `<li${m.id === params.get('mission') ? ' class="is-cur"' : ''}><a href="${ROOT}missions/${escH(m.id)}/">${m.id === params.get('mission') ? '<em class="pn-mis-cur">Ta mission</em>' : ''}<span class="pn-mis-n">${m.n || '+'}</span><span><b>${escH(m.t)}</b><small>${m.c === 'prologue' ? 'Prologue' : 'Chapitre ' + m.c} · ${escH(m.r)}</small></span>${ic('arrow-right')}</a></li>`).join('')}</ul></div>` : '';
    // deux actions principales
    const cta = `<div class="pn-cta" style="--c:${c.color}"><button type="button" class="pn-cta-1" data-center>${ic('locate')}<span>Centrer sur le lieu</span></button><button type="button" class="pn-cta-2${isT ? ' is-on' : ''}" data-found aria-pressed="${isT}">${ic('check')}<span>${foundTxt(f, isT)}</span></button></div>`;
    const lien = f.url ? `<a class="pn-full pn-more" href="${ROOT}${f.url}">${ic('guide')}<span>${veh ? 'Fiche complète du véhicule' : /^dossiers\//.test(f.url) ? 'Voir le dossier' : 'Voir la fiche complète'}</span>${ic('arrow-right')}</a>` : t && t.lien ? `<a class="pn-full pn-more" href="${ROOT}${t.lien}">${ic('guide')}<span>${escH(t.libelle)}</span>${ic('arrow-right')}</a>` : '';
    // actions secondaires, discrètes
    const mail = window.LG_CONTACT;
    const signal = mail ? `mailto:${mail}?subject=${encodeURIComponent('Erreur sur la carte : ' + f.nom)}&body=${encodeURIComponent(`Repère : ${f.nom} (${f.id})\nLien : ${location.origin}${location.pathname}?focus=${f.id}\n\nCe qui ne va pas :\n`)}` : '';
    const ext = f.ext ? `<a class="pn-lnk" href="${escH(f.ext)}" target="_blank" rel="noopener">${ic(f.ph ? 'eye' : 'link')}${f.ph ? 'Photo du lieu' : 'Consulter la source'}</a>` : '';
    const sec = `<div class="pn-sec pn-more"><button type="button" class="pn-lnk" data-share>${ic('share')}Partager</button>${ext}${signal ? `<a class="pn-lnk" href="${signal}">${ic('alert')}Signaler une erreur</a>` : ''}</div>`;
    // plus d'infos, repliées : fiabilité, précision, source
    const det = `<details class="pn-det pn-more"><summary>${ic('shield')}Fiabilité et source</summary><dl class="pn-dl">
      <div><dt>Statut</dt><dd>${stTag(f)}</dd></div>
      <div><dt>Emplacement</dt><dd>${escH(precisionTxt(f))}</dd></div>
      ${f.nat ? `<div><dt>Type d’apparition</dt><dd>${escH(f.nat)}</dd></div>` : ''}
      ${f.dv ? `<div><dt>Dernière vérification</dt><dd>${escH(f.dv)}</dd></div>` : ''}
      <div><dt>Source</dt><dd>${f.ext ? `<a href="${escH(f.ext)}" target="_blank" rel="noopener">${escH(sourceTxt(f))}</a>` : escH(sourceTxt(f))}</dd></div>
      ${(f.tg || []).length ? `<div><dt>Aussi dans</dt><dd>${escH(f.tg.map((k) => (cats[k] || {}).nom).filter(Boolean).join(', '))}</dd></div>` : ''}
      ${f.vo ? `<div><dt>Nom d’origine</dt><dd>${escH(f.vo)}</dd></div>` : ''}</dl></details>`;
    const prox = BESOINS.map(([lab, icn, cn]) => {
      let best = null, bd = Infinity;
      atlas.feats().forEach((x) => { if (x.id !== f.id && !x.label && lab.includes(x.service)) { const dd = Math.hypot(x.x - f.x, x.y - f.y); if (dd < bd) { bd = dd; best = x; } } });
      return best && !lab.includes(f.service) ? `<li><button type="button" data-go="${escH(best.id)}"><span class="pn-li-i">${ic(icn)}</span><span><b>${escH(cn)}</b><small>${escH(best.nom)}</small></span><em>${km(bd)}</em></button></li>` : '';
    }).filter(Boolean).slice(0, 4).join('');
    const proche = prox ? `<details class="pn-near pn-more"><summary>${ic('compass')}Le plus proche d'ici</summary><ul>${prox}</ul><p class="pn-near-n">Distances à vol d'oiseau, environ.</p></details>` : '';
    const favBtn = `<button type="button" class="pn-fav fav" data-fav='${escH(JSON.stringify(fav))}' aria-pressed="false" aria-label="Ajouter aux favoris">${ic('heart')}</button>`;
    const enTete = `<div class="pn-h pn-h--f">${vignette(f, 'pn-thumb')}<div class="pn-h-t"><small style="--c:${c.color}">${escH(kicker)}</small><h2>${escH(titre)}</h2><span class="pn-h-st">${stTag(f, true)}</span></div>${favBtn}<button type="button" class="pn-tg" data-tg aria-label="Agrandir le panneau">${ic('chevron')}</button><button type="button" class="pn-x" data-x aria-label="Fermer">${ic('x')}</button></div>`;
    // variante (livrée spéciale) d'un modèle : on le dit, et la fiche s'ouvre sur ce signalement précis
    const variante = veh && f.vn && /^o-standout-vehicle-/.test(f.id) && norm(f.nom) !== norm(f.vn);
    const ouMini = ou.length ? ou : secteur(f) ? [secteur(f)] : [];
    const mini = veh ? `<div class="pn-vmini">${variante ? `<span class="pn-vmini-v">${ic('diamond')}Variante à livrée spéciale du modèle ${escH(f.vn)}</span>` : ''}${ouMini.length ? `<span class="pn-vmini-l">${ic('pin')}${escH(ouMini.join(' · '))}</span>` : ''}${f.url ? `<a class="pn-vmini-a" href="${ROOT}${f.url}${/^v-/.test(f.id) ? '' : '#sig-' + encodeURIComponent(f.id)}">${ic('guide')}<span>${variante ? 'Fiche du modèle' : 'Voir la fiche complète'}</span></a>` : ''}</div>` : '';
    const glx = (f.gl || []).length ? `<div class="pn-gl">${f.gl.map((x) => `<a class="pn-full${x.s === state.glitch ? ' pn-full--gl' : ''}" href="${ROOT}glitchs/${escH(x.s)}/">${ic('bolt')}<span>${x.s === state.glitch ? 'Retour au tutoriel' : 'Glitch ici'} : ${escH(x.t)}${x.n ? ` <small>· étape ${x.n}</small>` : ''}</span>${ic('arrow-right')}</a>`).join('')}</div>` : '';
    showPanel(`${veh ? enTete + mini + hero : hero + enTete}${glx}${lead}${cta}${mis}${dl}${lien}${sec}${proche}${det}${nav(f)}`, veh ? 'compact' : panel.hidden || panel.dataset.taille === 'grand' ? 'moyen' : panel.dataset.taille || 'moyen');
    panel.classList.add('pn-fiche'); panel.classList.toggle('pn-veh', veh); if (veh) taillePanneau('compact');
    bindNav();
    const bt = $('[data-found]', panel);
    const majT = () => { const on = trouves.has(f.id); bt.setAttribute('aria-pressed', on); bt.classList.toggle('is-on', on); $('span', bt).textContent = foundTxt(f, on); };
    bt.addEventListener('click', () => {
      const on = !trouves.has(f.id); marquer(f, on); majT();
      bt.classList.remove('is-pop'); void bt.offsetWidth; bt.classList.add('is-pop');
      snack(on ? (f.cat === 'collection' ? 'Marqué comme trouvé' : 'Marqué comme visité') : 'Marque retirée', () => { annuler(); if (bt.isConnected) majT(); });
    });
    $('[data-center]', panel).addEventListener('click', () => { if (mobile() && panel.dataset.taille === 'grand') { panel.classList.add('pn-anim'); taillePanneau('compact'); } atlas.flyTo(f.x, f.y, Math.max(atlas.cam.s, .45), .5); visible(f, 600); });
    $('[data-share]', panel).addEventListener('click', async () => {
      const u = new URL(location.href); u.search = ''; u.searchParams.set('focus', f.id);
      try { if (navigator.share && innerWidth < 900) await navigator.share({ title: f.nom, url: u.href }); else { await navigator.clipboard.writeText(u.href); snack('Lien copié'); } } catch (err) { /* annulé */ }
    });
    $('.pn-c', panel).scrollTop = 0;
    if (cote()) atlas.flyTo(f.x, f.y, Math.max(atlas.cam.s, state.spot ? .45 : .3), .5);
    else if (mobile()) {
      const ts = Math.max(atlas.cam.s, state.spot ? .45 : .3), sr = stage.getBoundingClientRect();
      const y0 = top.getBoundingClientRect().bottom - sr.top, y1 = panel.getBoundingClientRect().top - sr.top;
      atlas.flyTo(f.x, f.y - (sr.height / 2 - ((y0 + y1) / 2 - 12)) / ts, ts, .5);
    }
  }
  // favori depuis une fiche : petit retour visuel et « Annuler » (la gestion des favoris reste celle du site)
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('.pn-fav'); if (!b || !LG.toggleFav) return;
    e.stopPropagation(); e.preventDefault();
    let o; try { o = JSON.parse(b.dataset.fav); } catch (err) { return; }
    const avant = favs().some((x) => x.type + ':' + x.id === o.type + ':' + o.id);
    LG.toggleFav(o); sansToast();
    b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop');
    lireFavs(); if (opt.favs) applyFilter();
    snack(avant ? 'Retiré des favoris' : 'Ajouté aux favoris', () => { LG.toggleFav(o); sansToast(); lireFavs(); if (opt.favs) applyFilter(); });
  }, true);
  function openCommu(p) {
    const k = commuCats[p.c] || { nom: 'Lieu' };
    showPanel(`${head('pin', '#c7c2e0', 'Lieu de la communauté · ' + k.nom, p.n)}
      <div class="pn-tags">${p.z ? `<span class="pn-tag">${escH(p.z)}</span>` : ''}<span class="pn-st" style="--c:#b3aec4">${ic('question')}${p.d ? 'Nom ou position douteux' : 'Non confirmé'}</span></div>
      <p class="pn-lead">Repéré par les contributeurs de GTADB d'après les bandes-annonces et le jeu. Ce n'est pas une information vérifiée par notre équipe.</p>
      <div class="pn-sec"><a class="pn-lnk" href="https://map.gtadb.org" target="_blank" rel="noopener">${ic('link')}Consulter la source (GTADB)</a></div>`, 'compact');
    if (mobile()) { const ts = Math.max(atlas.cam.s, .5); atlas.flyTo(p.x, p.y - (panel.offsetHeight / 2 + 10) / ts, ts, .5); }
  }
  function openRegion(r) {
    if (!r) return;
    const nom = $('[data-reg-nom]'); if (nom) nom.textContent = r.nom;
    const list = atlas.feats().filter((f) => f.region === r.id && !f.label);
    const by = {}; list.forEach((f) => { by[f.cat] = (by[f.cat] || 0) + 1; });
    showPanel(`${head('map', r.couleur, 'Région', r.nom)}
      <div class="pn-tags">${Object.entries(by).map(([c, n]) => `<span class="pn-tag">${n} ${escH((cats[c] || {}).nom || c).toLowerCase()}</span>`).join('') || '<span class="pn-tag">Pas encore de repère du guide</span>'}</div>
      <div class="pn-sec"><a class="pn-lnk" href="${ROOT}encyclopedie/${r.id}/">${ic('book')}Lire la fiche de la région</a></div>`, 'compact');
    atlas.flyTo(r.label[0], r.label[1], .12, .6);
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
  const MOTS_VIDES = new Set(['de', 'des', 'du', 'd', 'la', 'le', 'les', 'l', 'un', 'une', 'a', 'au', 'aux', 'ou', 'et', 'en', 'est', 'sont', 'se', 'y', 'il', 'ils', 'me', 'moi', 'mon', 'ma', 'mes', 'je', 'on', 'pour', 'avec', 'dans', 'sur', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'trouver', 'trouve', 'situe', 'gta', '6', 'vi', 'gtavi', 'gta6', 'jeu', 'avoir', 'obtenir', 'peut', 'faire', 'carte']);
  function search(q) {
    const qn = norm(q); if (!qn) return [];
    const toks = qn.split(' ').filter((t) => t && !MOTS_VIDES.has(t));
    if (!toks.length) return [];
    const out = [];
    // intention reconnue (« voiture rapide », « jet privé », « finir le jeu à 100 % ») : la bonne rubrique en tête, et seulement ses repères ensuite
    const qi = ` ${qn.replace(/%/g, '')} `;
    // la phrase reconnue la plus longue l'emporte (« code du coffre » avant « coffre »)
    let it = null, lmax = 0;
    (OPT.intentions || []).forEach((x) => x.q.forEach((m) => { const n = norm(m); if (n.length > lmax && qi.includes(` ${n} `)) { lmax = n.length; it = x; } }));
    if (it) {
      const p = it.pop && (OPT.populaires || []).find((x) => x.id === it.pop);
      if (it.action) return [{ s: 100, action: it.action }];
      if (p) out.push({ s: 100, pop: p });
      else if (cats[it.cat]) {
        const sub = (cats[it.cat].sous || []).find((x) => x.id === it.sc);
        // rubrique demandée sans aucun emplacement fiable : on le dit, plutôt que de proposer des résultats hors sujet
        if (it.sc && !sub) return [{ s: 100, info: `Aucun emplacement fiable n’est encore connu pour cette recherche.`, cat: cats[it.cat] }];
        out.push({ s: 100, cat: cats[it.cat], sub });
      }
    }
    (OPT.populaires || []).forEach((p) => { const c = cats[p.cat] || {}; const s = score(toks, p.nom, `${c.nom} ${(p.sc || []).map((x) => subNoms[p.cat + ':' + x]).join(' ')}`); if (s && nPop(p)) out.push({ s: s + 4, pop: p }); });
    Object.values(cats).forEach((c) => {
      const s = score(toks, c.nom, `${c.court} ${c.q} ${c.sens}`); if (s) out.push({ s: s + 3, cat: c });
      c.sous.forEach((x) => { const s2 = score(toks, x.nom, c.nom); if (s2) out.push({ s: s2 + 2.5, cat: c, sub: x }); });
    });
    atlas.feats().forEach((f) => { if ((f.label && !regions[f.id]) || f.dbl) return; const s = score(toks, f.nom, `${(cats[f.cat] || {}).nom} ${f.service || ''} ${f.vn || ''} ${f.vo || ''} ${f.zone || ''} ${f.desc || ''}`); if (s) out.push({ s: s + (f.label ? 1.5 : 1) + (passe(f) ? .3 : 0), f }); });
    commu.forEach((p) => { const s = score(toks, p.n, p.z); if (s) out.push({ s, p }); });
    const vus = new Set();
    const garde = (r) => !it || !r.f || (it.cat && r.f.cat === it.cat && (!it.sc || scDe(r.f, it.cat).includes(it.sc)));
    return out.filter((r) => (it && !it.pop ? garde(r) && !(r.cat && !r.sub && r.cat.id !== it.cat) : true)).sort((a, b) => b.s - a.s).filter((r) => { const k = r.pop ? 'p' + r.pop.id : r.cat ? 'c' + r.cat.id + (r.sub ? ':' + r.sub.id : '') : ''; if (!k) return true; if (vus.has(k)) return false; vus.add(k); return true; }).slice(0, 9);
  }
  // ---------- mode exploration : la carte seule, en plein écran ; vue, filtres, sélection et panneau restaurés en sortant ----------
  let expl = null;
  function explorer(on) {
    if (on === !!expl) return;
    const b = $('[data-explore]');
    if (on) {
      expl = { vue: atlas.vue(), fs: false };
      document.documentElement.classList.add('lg-explore');
      const el = document.documentElement;
      if (el.requestFullscreen && !/iPhone|iPod/.test(navigator.userAgent)) el.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (expl) expl.fs = true; }).catch(() => { /* mode immersif sans plein écran */ });
      requestAnimationFrame(() => requestAnimationFrame(() => { atlas.setPad(padding()); if (!panel.hidden) taillePanneau(panel.dataset.taille || 'moyen'); }));
    } else {
      const v = expl.vue; expl = null;
      document.documentElement.classList.remove('lg-explore');
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { /* */ });
      requestAnimationFrame(() => requestAnimationFrame(() => { atlas.setPad(padding()); atlas.setVue(v); if (!panel.hidden) taillePanneau(panel.dataset.taille || 'moyen'); }));
    }
    b.setAttribute('aria-pressed', !!on); b.setAttribute('aria-label', on ? 'Quitter le mode exploration' : 'Mode exploration (plein écran)');
    b.innerHTML = ic(on ? 'x' : 'expand');
    setTimeout(majCtrl, 80);
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && expl && expl.fs) explorer(false); });

  function bind() {
    const input = $('#atp-q'), sugg = $('#atp-sugg'), qx = $('[data-q-x]'); let res = [], sel2 = 0;
    const nCat = (c, s) => atlas.feats().filter((f) => !f.label && passeOpt(f) && dans(f, c) && (!s || scDe(f, c).includes(s))).length;
    const draw = () => {
      dt = 0; qx.hidden = !input.value;
      res = search(input.value); sel2 = 0; sugg.hidden = !input.value.trim();
      const lg = (r, i) => {
        const a = `role="option" data-i="${i}" aria-selected="${i === 0}"`;
        if (r.info) return `<div class="sg-info" role="option" data-i="${i}" aria-selected="${i === 0}">${ic('info')}<span><b>${escH(r.info)}</b><small>Les données sont ajoutées dès qu’une source fiable les publie. Voir toute la catégorie « ${escH(r.cat.nom)} ».</small></span></div>`;
        if (r.action === 'progression') return `<button type="button" ${a} style="--c:#39ff88" class="sg-cat">${ic('progress')}<span><b>Ma progression</b><small>Objets trouvés et restants, collection par collection</small></span></button>`;
        if (r.pop) { const c = cats[r.pop.cat]; return `<button type="button" ${a} style="--c:${c.color}" class="sg-cat">${ic(r.pop.icon)}<span><b>${escH(r.pop.nom)}</b><small>Recherche populaire · ${nPop(r.pop)} emplacements</small></span></button>`; }
        if (r.cat) return `<button type="button" ${a} style="--c:${r.cat.color}" class="sg-cat">${ic(r.cat.icon)}<span><b>${escH(r.sub ? r.sub.nom : r.cat.nom)}</b><small>${r.sub ? 'Sous-catégorie · ' + escH(r.cat.nom) : 'Catégorie'} · ${nCat(r.cat.id, r.sub && r.sub.id)} emplacements</small></span></button>`;
        if (r.f) return `<button type="button" ${a} style="--c:${(cats[r.f.cat] || {}).color || '#ff2bd6'}"><i></i><span><b>${escH(r.f.nom)}</b><small>${r.f.label ? 'Région' : escH(sousNom(r.f))}${secteur(r.f) ? ' · ' + escH(secteur(r.f)) : ''}</small></span></button>`;
        return `<button type="button" ${a} style="--c:#c7c2e0"><i></i><span><b>${escH(r.p.n)}</b><small>Communauté${r.p.z ? ' · ' + escH(r.p.z) : ''}</small></span></button>`;
      };
      const idees = (OPT.populaires || []).filter(nPop).slice(0, 6).map((p) => `<button type="button" class="sg-idee" data-pop-s="${p.id}" style="--c:${(cats[p.cat] || {}).color}">${ic(p.icon)}${escH(p.nom)}</button>`).join('');
      sugg.innerHTML = res.length ? res.map(lg).join('') : `<p class="sg-vide"><b>Aucun résultat pour « ${escH(input.value.trim())} ».</b> Vérifie l'orthographe, ou essaie une de ces recherches :</p><div class="sg-idees">${idees}</div>`;
      $$('[data-i]', sugg).forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
      $$('[data-pop-s]', sugg).forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
      $$('[data-pop-s]', sugg).forEach((b) => b.addEventListener('click', () => { input.value = ''; qx.hidden = true; sugg.hidden = true; input.blur(); popClic(b.dataset.popS); }));
      if (!res.length && input.value.trim().length > 2 && window.LG_EVT) { clearTimeout(draw.t); draw.t = setTimeout(() => { try { window.LG_EVT('carte-sans-resultat/' + norm(input.value).slice(0, 40)); } catch (e) { /* */ } }, 1500); }
    };
    const pick = (i) => {
      const r = res[i]; if (!r) return; sugg.hidden = true; input.blur();
      if (r.info) { state.pop = ''; choisirCats([r.cat.id]); openResults(); return; }
      if (r.action === 'progression') return openProgression();
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
    // recherche lancée une fois la frappe terminée (évite de tout recalculer à chaque lettre sur téléphone)
    let dt = 0;
    input.addEventListener('input', () => { clearTimeout(dt); qx.hidden = !input.value; dt = setTimeout(draw, 120); });
    input.addEventListener('focus', () => { if (input.value.trim()) draw(); menuReg(false); legende(false); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (dt) { clearTimeout(dt); dt = 0; draw(); } pick(sel2); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel2 = Math.max(0, Math.min(res.length - 1, sel2 + (e.key === 'ArrowDown' ? 1 : -1))); $$('[data-i]', sugg).forEach((b, i) => b.setAttribute('aria-selected', i === sel2)); }
      if (e.key === 'Escape') { input.value = ''; qx.hidden = true; sugg.hidden = true; }
    });
    input.addEventListener('blur', () => setTimeout(() => { sugg.hidden = true; }, 180));
    qx.addEventListener('mousedown', (e) => e.preventDefault());
    qx.addEventListener('click', () => { input.value = ''; qx.hidden = true; sugg.hidden = true; input.focus(); });
    // raccourcis permanents : un toucher = la catégorie seule et sa liste ; un second toucher l'enlève
    $$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.cat; state.pop = '';
      if (!state.vide && sel.size === 1 && sel.has(id) && !(subs[id] && subs[id].size)) { reset(); return; }
      $$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x === b)); page.classList.add('is-busy');
      apresAffichage(() => { choisirCats([id]); openResults(); page.classList.remove('is-busy'); b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' }); });
    }));
    $('[data-all]').addEventListener('click', () => { if ($('[data-all]').getAttribute('aria-pressed') === 'true') return reset(); tout(); closePanel(); atlas.reset(); });
    $('[data-explorer]').addEventListener('click', openExplorer);
    $('[data-filtres]').addEventListener('click', openFiltres);
    $('[data-reset]').addEventListener('click', reset);
    $$('[data-pop]').forEach((b) => b.addEventListener('click', () => { if (state.pop === b.dataset.pop) return reset(); popClic(b.dataset.pop); apresAffichage(() => b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' })); }));
    // 6 recherches au chargement, les autres sur demande
    const plus = $('[data-pop-plus]');
    if (plus) plus.addEventListener('click', () => {
      const on = plus.getAttribute('aria-expanded') !== 'true';
      plus.setAttribute('aria-expanded', on);
      $$('[data-pop-extra]').forEach((b) => { const p = (OPT.populaires || []).find((x) => x.id === b.dataset.pop); b.hidden = !on || !p || !nPop(p); });
      $('span', plus).textContent = on ? 'Moins de recherches' : 'Plus de recherches';
    });
    // recherches populaires repliables (choix gardé sur cet appareil)
    const pt = $('[data-pop-tog]'), pb = $('[data-pop-box]');
    const replier = (on) => { pb.classList.toggle('is-replie', on); pt.setAttribute('aria-expanded', !on); pt.setAttribute('aria-label', on ? 'Afficher les recherches populaires' : 'Masquer les recherches populaires'); store.set(KEY_POPR, on ? '1' : ''); setTimeout(() => { atlas.setPad(padding()); majCtrl(); }, 260); };
    replier(store.get(KEY_POPR) === '1');
    pt.addEventListener('click', () => replier(!pb.classList.contains('is-replie')));
    $('[data-solo-off]').addEventListener('click', () => { unsolo(); tout(); closePanel(); });
    $('[data-keep-voir]').addEventListener('click', () => { const f = state.choisi; if (!f) return; if (!f.commu) ensureShown(f); atlas.select(f, { fly: true, s: Math.max(atlas.cam.s, .3) }); });
    $('[data-keep-off]').addEventListener('click', () => { state.choisi = null; garde(false); atlas.clearActive(); });
    $$('[data-z]').forEach((b) => b.addEventListener('click', () => {
      const z = b.dataset.z;
      if (z === 'in') atlas.zoomIn(); else if (z === 'out') atlas.zoomOut();
      else if (z === 'center') { const f = state.choisi && !state.choisi.commu ? state.choisi : null; if (f) { atlas.flyTo(f.x, f.y, Math.max(atlas.cam.s, .45), .5); visible(f, 600); } else if (!state.vide && resultats().length) fitResults(); else atlas.reset(); }
    }));
    // un seul sélecteur de régions
    $('[data-reg-btn]').addEventListener('click', (e) => { e.stopPropagation(); menuReg($('[data-reg-menu]').hidden); });
    $$('[data-reg]').forEach((b) => b.addEventListener('click', () => {
      menuReg(false); const id = b.dataset.reg;
      if (!id) { $('[data-reg-nom]').textContent = 'Régions'; closePanel(); atlas.reset(); } else openRegion(regions[id]);
    }));
    $('[data-reg-menu]').addEventListener('keydown', (e) => { if (e.key === 'Escape') { menuReg(false); $('[data-reg-btn]').focus(); } });
    document.addEventListener('click', (e) => { if (!e.target.closest('[data-reg-menu], [data-reg-btn]')) menuReg(false); });
    $('[data-list]').addEventListener('click', () => { state.fromList = false; openList(); });
    $('[data-prog]').addEventListener('click', openProgression);
    $('[data-leg-btn]').addEventListener('click', () => legende($('#atp-leg').hidden));
    $('[data-leg-x]').addEventListener('click', () => legende(false));
    $('[data-explore]').addEventListener('click', () => explorer(!expl));
    const src = $('.at-attrib--page'); if (src && innerWidth >= 900) src.open = true;
    countView();
    addEventListener('keydown', (e) => { if (e.key !== 'Escape' || e.target.closest('input, select')) return; if (!panel.hidden) closePanel(); else if (expl) explorer(false); legende(false); menuReg(false); });
    addEventListener('storage', (e) => { if (e.key === 'lg:favs' && opt.favs) applyFilter(); });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { atlas.setPad(padding()); if (!panel.hidden) taillePanneau(panel.dataset.taille || 'moyen'); majCtrl(); }, 150); });
    majCtrl();
  }
  function popClic(id) {
    const p = (OPT.populaires || []).find((x) => x.id === id); if (!p) return;
    $$('[data-pop]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.pop === id)); page.classList.add('is-busy');
    apresAffichage(() => { appliquerPop(p); openResults(); fitResults(); page.classList.remove('is-busy'); });
  }
})();
