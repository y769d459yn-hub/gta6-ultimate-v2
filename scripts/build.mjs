// Générateur statique : data/*.json + src/ → docs/ (GitHub Pages)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { icon, iconDefs } from './icons.mjs';
import { validate } from './validate.mjs';
import { silhouette } from './silhouettes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

const site = read('site.json');
const SRC = read('sources.json');
const ASTUCES = read('astuces.json');
const VEHICULES = read('vehicules.json');
// Catalogue complet (GTABase + gta6guide.fr, tools/catalogue.py) : véhicules sans fiche détaillée + infos des fiches
// Vérification de présence dans GTA 6 (tools/verification.py : site officiel, GTA Wiki, GTABase, gta6guide.fr)
const VERIF = fs.existsSync(path.join(ROOT, 'data', 'verification.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'verification.json'), 'utf8')).vehicules : {};
const verifTexte = (s) => { const v = VERIF[s]; if (!v) return ''; return v.statut === 'confirme' ? (v.preuves.length ? `Confirmé par ${v.preuves.join(' et ')}` : 'Type de véhicule confirmé') : v.statut === 'non-confirme' ? 'Non confirmé' : 'À confirmer : vu seulement sur GTABase ou gta6guide.fr'; };
const CATALOGUE = fs.existsSync(path.join(ROOT, 'data', 'catalogue.json')) ? read('catalogue.json') : { vehicules: [], fiches: {} };
const LIEUX = read('lieux.json');
const ENC = read('encyclopedie.json');
const ACTUS = read('actualites.json').sort((a, b) => b.date.localeCompare(a.date));
const CARTE = read('carte.json');
const M = site.marque;
const ACCUEIL = read('accueil.json');
{
  const errs = [
    ...validate(read('schemas/accueil.schema.json'), ACCUEIL, 'accueil'),
    ...validate(read('schemas/carte.schema.json'), CARTE, 'carte')
  ];
  const slugs = new Set(ASTUCES.map((a) => a.slug));
  ACCUEIL.enCeMoment.astuces.forEach((s) => { if (!slugs.has(s)) errs.push(`accueil.enCeMoment : astuce inconnue « ${s} »`); });
  [...ACCUEIL.tuiles.map((t) => t.icon), ...ACCUEIL.hero.raccourcis.map((r) => r.icon)].forEach((n) => { if (!iconDefs[n]) errs.push(`accueil : icône inconnue « ${n} »`); });
  if (errs.length) { console.error('✗ Données invalides :\n  ' + errs.join('\n  ')); process.exit(1); }
}

// ---------- helpers ----------
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9$]+/g, ' ').trim();
const cat = (group, id) => site.categories[group].find((c) => c.id === id) || { id, nom: id, icon: 'info', color: '#ff2d87' };
const statut = (id) => site.statuts[id] || site.statuts['a-verifier'];
const byId = (arr, key = 'slug') => Object.fromEntries(arr.map((x) => [x[key], x]));
const A = byId(ASTUCES), V = byId(VEHICULES), L = byId(LIEUX, 'id'), E = byId(ENC), N = byId(ACTUS);
const REG = Object.fromEntries(LIEUX.filter((l) => l.type === 'region').map((r) => [r.id, r]));
const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function badge(st) {
  const s = statut(st);
  const ic = st === 'confirme' ? 'check' : st === 'provisoire' ? 'clock' : 'question';
  return `<span class="badge b-${st}" title="${esc(s.desc)}">${icon(ic)}${esc(s.nom)}</span>`;
}
const niveauNom = (n) => (n === 'facile' ? 'Facile' : 'Intermédiaire');
const dureeNom = (d) => (d <= 1 ? '1 min' : d <= 2 ? '2 min' : '5 min +');
const dureeBucket = (d) => (d <= 2 ? 'court' : d <= 5 ? 'moyen' : 'long');

// Résout une référence (slug) vers n'importe quel contenu
function ref(slug) {
  if (A[slug]) { const c = cat('astuces', A[slug].cat); return { t: A[slug].court, u: `astuces/${slug}/`, i: A[slug].icon, c: c.color, k: 'Astuce' }; }
  if (V[slug]) { const c = cat('vehicules', V[slug].type); return { t: V[slug].nom, u: `vehicules/${slug}/`, i: c.icon, c: c.color, k: 'Véhicule' }; }
  if (E[slug]) { const c = cat('encyclopedie', E[slug].cat); return { t: E[slug].nom, u: `encyclopedie/${slug}/`, i: E[slug].icon, c: c.color, k: c.nom }; }
  if (N[slug]) return { t: N[slug].titre, u: `actualites/${slug}/`, i: 'news', c: '#19d3e3', k: 'Actu' };
  return null;
}

// ---------- positions carte (unités monde GTADB : x est, y nord) ----------
const TUILES = read('tuiles.json');
const VIGN = new Set(fs.existsSync(path.join(ROOT, 'data', 'vignettes.json')) ? read('vignettes.json').ids : []);
// url() dans une variable CSS est résolue par rapport à la feuille de style (assets/) : chemin relatif à assets/
// Photos des véhicules : src/photos/<slug>.webp, origine et note dans data/photos.json (préparées par tools/photos.py)
const PHOTOS = fs.existsSync(path.join(ROOT, 'data', 'photos.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'photos.json'), 'utf8')) : {};
for (const f of fs.existsSync(path.join(ROOT, 'src', 'photos')) ? fs.readdirSync(path.join(ROOT, 'src', 'photos')) : []) {
  const k = f.replace(/\.(webp|jpe?g|png)$/i, '');
  if (k !== f && !PHOTOS[k]) PHOTOS[k] = { fichier: f, note: '', credit: '', url: '' };
}
// Modèles 3D générés (data/modeles3d.json) et leurs rendus fixes (src/rendus/<slug>.webp, tools/rendus3d.cjs)
// Vue 3D désactivée : le site montre les vraies photos du jeu (les outils tools/3d restent disponibles)
const VUE_3D = false;
const MODELES = VUE_3D && fs.existsSync(path.join(ROOT, 'data', 'modeles3d.json')) ? read('modeles3d.json').modeles : {};
const RENDUS = new Set(VUE_3D && fs.existsSync(path.join(ROOT, 'src', 'rendus')) ? fs.readdirSync(path.join(ROOT, 'src', 'rendus')).map((f) => f.replace(/\.webp$/, '')) : []);
const rendu = (v, R) => (RENDUS.has(v.slug) ? `<img class="veh-photo veh-rendu" src="${R}rendus/${v.slug}.webp" alt="${esc(v.nom)} en 3D" loading="lazy" decoding="async">` : '');
const photoJeu = (v, R, extra = '') => `<img class="veh-photo${extra}" src="${R}photos/${PHOTOS[v.slug].fichier}" alt="${esc(v.nom)}${PHOTOS[v.slug].note ? ' — ' + esc(PHOTOS[v.slug].note) : ''}" loading="lazy" decoding="async">`;
// Modèles 3D réalistes fournis (src/modeles/<slug>.glb) : remplacent le modèle simplifié dans la vue 3D
const GLB = new Set(fs.existsSync(path.join(ROOT, 'src', 'modeles')) ? fs.readdirSync(path.join(ROOT, 'src', 'modeles')).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)) : []);
const vehVisuel = (v, R, cls = '') => PHOTOS[v.slug] ? photoJeu(v, R) : RENDUS.has(v.slug) ? rendu(v, R) : silhouette(v, cls);
const vehCredit = (v) => {
  const ph = PHOTOS[v.slug], m = MODELES[v.slug];
  if (m) {
    const cr = ph && ph.credit ? `${ph.note ? `<strong>${esc(ph.note)}</strong> · ` : ''}Photo du jeu : ${ph.url ? `<a href="${esc(ph.url)}" target="_blank" rel="noopener">${esc(ph.credit)}</a>` : esc(ph.credit)}. ` : '';
    const v3 = GLB.has(v.slug) ? 'Vue 3D : modèle 3D réaliste fourni.' : m.indicatif ? '<strong>Vue 3D indicative : aucune image fiable de ce véhicule, apparence supposée.</strong>' : 'Vue 3D : modèle simplifié créé par le site d\'après la photo.';
    return `<p class="veh-credit">${cr}${v3}</p>`;
  }
  if (!ph) return '';
  const cr = ph.credit ? `Image : ${ph.url ? `<a href="${esc(ph.url)}" target="_blank" rel="noopener">${esc(ph.credit)}</a>` : esc(ph.credit)}` : '';
  return `<p class="veh-credit">${ph.note ? `<strong>${esc(ph.note)}</strong>` : ''}${ph.note && cr ? ' · ' : ''}${cr}</p>`;
};
const vign = (id) => (VIGN.has(id) ? `../vignettes/${id}.webp` : null);
const GTADB_RAW = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor', 'gtadb', 'landmarks.json'), 'utf8'));
// Lieux communautaires : [adresse, [x, y], …, tags (index 6)]
const GTADB = Object.entries(GTADB_RAW).filter(([, v]) => v[1] && v[1].length === 2).map(([id, v]) => ({ id, adr: v[0] || '', x: v[1][0], y: v[1][1], tags: v[6] || [] }));
const GTADB_UTILISES = new Set(); // lieux GTADB déjà repris tels quels dans le guide
function gtadbCentre(motif) {
  const m = motif.toLowerCase();
  const hits = GTADB.filter((g) => g.adr.toLowerCase().split(', ').some((_, i, a) => a.slice(i).join(', ').startsWith(m)));
  if (!hits.length) throw new Error(`GTADB : aucun lieu pour « ${motif} »`);
  if (hits.length <= 2) hits.forEach((h) => GTADB_UTILISES.add(h.id));
  // médiane (robuste aux lieux mal placés)
  const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  return [Math.round(med(hits.map((h) => h.x))), Math.round(med(hits.map((h) => h.y)))];
}
const POS = {}; // position de chaque lieu du guide
for (const l of LIEUX) {
  if (l.monde) POS[l.id] = l.monde;
  else if (l.gtadb) POS[l.id] = gtadbCentre(l.gtadb);
}
// Éléments connus seulement à l'échelle d'une région : disposés en couronne autour du repère de la région
const ring = {};
function autour(id, rayon) {
  const c = POS[id]; if (!c) return null;
  const k = (ring[id] = (ring[id] || 0) + 1);
  const a = k * 2.39996;
  return [Math.round(c[0] + Math.cos(a) * rayon * (1 + k * .12)), Math.round(c[1] + Math.sin(a) * rayon * (1 + k * .12))];
}
// Résumé affiché dans la fiche de la carte : la réponse et les étapes, sans changer de page
const tipAstuce = (slug) => { const a = A[slug]; return a ? { type: `Astuce ${cat('astuces', a.cat).nom.toLowerCase()}`, titre: a.titre, reponse: a.reponse, etapes: a.etapes.slice(0, 3), lien: `astuces/${slug}/`, libelle: "Voir l'astuce complète" } : undefined; };
const features = [];
const lieuMapCat = (l) => l.mapcat || 'lieux';
for (const l of LIEUX) {
  let pos = POS[l.id] || null; const precision = l.precision;
  if (!pos && l.region && precision === 'region') pos = autour(l.region, 380);
  if (!pos) continue;
  const mc = lieuMapCat(l);
  const url = l.astuce ? `astuces/${l.astuce}/` : l.enc ? `encyclopedie/${l.enc}/` : `lieux/#${l.id}`;
  features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: pos }, properties: { id: l.id, nom: l.nom, cat: mc, sous: mc === 'lieux' ? l.type : mc === 'activites' ? l.id : 'service', region: l.type === 'region' ? l.id : l.region, statut: l.statut, precision, icon: l.icon, desc: l.desc, url, acces: l.acces, tip: l.astuce ? tipAstuce(l.astuce) : undefined, ...(l.type === 'region' ? { label: true } : {}) } });
}
for (const v of VEHICULES) {
  const l = v.lieu && L[v.lieu];
  if (!l) continue;
  const pos = v.gtadb ? gtadbCentre(v.gtadb) : autour(l.id, l.type === 'region' ? 420 : 110);
  if (!pos) continue;
  const precision = l.type === 'region' ? 'region' : 'zone';
  features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: pos }, properties: { id: 'v-' + v.slug, nom: v.nom, cat: 'vehicules', sous: v.type, region: l.type === 'region' ? l.id : l.region, statut: v.dispo, precision, icon: cat('vehicules', v.type).icon, desc: v.emplacement, url: `vehicules/${v.slug}/`, lieuNom: l.nom, ...(PHOTOS[v.slug] ? { img: `photos/${PHOTOS[v.slug].fichier}`, imgNote: PHOTOS[v.slug].note || undefined, imgCredit: PHOTOS[v.slug].credit || undefined } : RENDUS.has(v.slug) ? { img: `rendus/${v.slug}.webp`, imgNote: MODELES[v.slug] && MODELES[v.slug].indicatif ? 'Modèle 3D indicatif' : 'Modèle 3D', imgCredit: undefined, img3d: true } : {}), tip: { type: `Véhicule · ${cat('vehicules', v.type).nom.toLowerCase()}`, titre: `Comment obtenir : ${v.nom} ?`, reponse: v.emplacement, etapes: v.obtenir.slice(0, 3), lien: `vehicules/${v.slug}/`, libelle: 'Voir la fiche du véhicule' } } });
}
// Services repérés par la communauté (étiquettes « # » de GTADB) → catégorie « Points utiles »
const SERVICES = {
  '#guns': ['Armurerie', 'gun'], '#fence': ['Receleur', 'money'], '#modshop': ['Atelier auto', 'spray'], "#pay'n'spray": ["Pay 'n' Spray", 'spray'],
  '#hospital': ['Hôpital', 'heart'], '#supermarket': ['Épicerie', 'heart'], '#gas': ['Station-service', 'bolt'], '#hair': ['Coiffeur', 'user'],
  '#tattoos': ['Tatoueur', 'spray'], '#clothes': ['Vêtements', 'user'], '#gym': ['Salle de sport', 'trophy'], '#police': ['Police', 'badge'],
  '#marina': ['Marina', 'anchor'], '#airport': ['Aéroport', 'plane']
};
const SERVICE_ASTUCE = { '#guns': 'acheter-silencieux', '#fence': 'braquer-magasin', '#modshop': 'personnaliser-voiture', "#pay'n'spray": 'pay-n-spray', '#hospital': 'se-soigner', '#supermarket': 'se-soigner', '#hair': 'changer-de-look', '#tattoos': 'changer-de-look', '#clothes': 'changer-de-look', '#gym': 'augmenter-stats', '#police': 'semer-la-police', '#marina': 'activites-eau', '#airport': 'premier-avion' };
for (const g of GTADB) {
  if (GTADB_UTILISES.has(g.id)) continue;
  const tag = Object.keys(SERVICES).find((t) => g.tags.includes(t)); if (!tag) continue;
  const [label, ic] = SERVICES[tag];
  const parts = g.adr.split(', ');
  const nomBrut = parts[0].replace(/\?$/, '');
  const zone = parts.slice(1).join(', ') || 'Leonida';
  const nom = !nomBrut || nomBrut === '?' ? `${label} · ${parts[1] || 'Leonida'}` : nomBrut;
  features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [Math.round(g.x), Math.round(g.y)] }, properties: { id: 's-' + g.id, nom, cat: 'points-utiles', sous: label, region: null, statut: 'a-verifier', precision: 'zone', icon: ic, desc: `${label} · ${zone}. Repéré par la communauté GTADB.`, url: SERVICE_ASTUCE[tag] ? `astuces/${SERVICE_ASTUCE[tag]}/` : null, tip: SERVICE_ASTUCE[tag] ? tipAstuce(SERVICE_ASTUCE[tag]) : undefined, service: label } });
}
// Couche communautaire : lieux nommés et positionnés de GTADB
const COMMU_CATS = CARTE.communaute.categories;
const communaute = GTADB.filter((g) => g.adr && !g.adr.startsWith('?') && !g.tags.includes('demolished')).map((g) => {
  const parts = g.adr.split(', ');
  const c = (COMMU_CATS.find((c) => c.tags.some((t) => g.tags.includes(t))) || COMMU_CATS[COMMU_CATS.length - 1]).id;
  return { i: g.id, n: parts[0].replace(/\?$/, ''), z: parts.slice(1).join(', '), x: Math.round(g.x), y: Math.round(g.y), c, d: g.adr.includes('?') || g.tags.includes('unconfirmed') ? 1 : 0 };
});
const mapIndex = Object.fromEntries(features.map((f) => [f.properties.id, f]));
const onMap = (id) => !!mapIndex[id];
const vehOnMap = (slug) => !!mapIndex['v-' + slug];
// astuce → repères carte liés
const astuceMap = {};
for (const l of LIEUX) if (l.astuce && onMap(l.id)) (astuceMap[l.astuce] ||= []).push(l.id);
const ASTUCE_MAP_EXTRA = { 'voiture-rare': 'cat=vehicules', 'activites-eau': 'cat=activites', 'vendre-voitures-moses': 'cat=vehicules', 'stocker-vehicules': 'cat=vehicules' };

// ---------- layout ----------
const BRAND_MARK = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="mk-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb547"/><stop offset=".55" stop-color="#ff2bd6"/><stop offset="1" stop-color="#2de2e6"/></linearGradient></defs><path d="M5 17a11 11 0 0 1 22 0" fill="none" stroke="url(#mk-g)" stroke-width="1.3" stroke-linecap="round"/><path d="M3 20.5h26M6 24h20M10 27.5h12" stroke="url(#mk-g)" stroke-width="1.3" stroke-linecap="round"/></svg>`;
function layout({ p, title, desc, body, schema = [], noindex = false, cls = '', scripts = [], crumbs = null, ogType = 'website', v2 = true, styles = [] }) {
  if (v2 && cls !== 'home' && !styles.includes('pages.css')) styles = [...styles, 'pages.css'];
  if (v2 && cls !== 'home' && cls !== 'p-atlas' && !scripts.includes('pages.js')) scripts = [...scripts, 'pages.js'];
  const deco = v2 && cls !== 'home' && cls !== 'p-atlas' ? `<div class="pg-deco" aria-hidden="true">${homeSun()}${homePalms()}</div>` : '';
  const depth = p.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const canon = `${site.url}/${p}`;
  const nav = [
    ['astuces/', 'Astuces', 'bolt'], ['vehicules/', 'Véhicules', 'car'], ['carte/', 'Carte', 'map'],
    ['lieux/', 'Lieux', 'pin'], ['encyclopedie/', 'Encyclopédie', 'book'], ['actualites/', 'Actus', 'news']
  ];
  const cur = (u) => (p.startsWith(u) ? ' aria-current="page"' : '');
  const tabs = [['', 'Accueil', 'home'], ['astuces/', 'Astuces', 'bolt'], ['#search', 'Chercher', 'search'], ['carte/', 'Carte', 'map'], ['favoris/', 'Favoris', 'heart']];
  if (crumbs) schema = [...schema, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: `${site.url}/${c[1]}` })) }];
  const crumbHtml = crumbs ? `<nav class="crumbs" aria-label="Fil d'Ariane">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${R}${c[1]}">${esc(c[0])}</a>${icon('arrow-right')}` : `<span aria-current="page">${esc(c[0])}</span>`).join('')}</nav>` : '';
  return `<!doctype html>
<html lang="fr" data-theme="night"${v2 ? ' class="v2"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${canon}">`}
<meta name="theme-color" content="${v2 ? '#040309' : '#140a22'}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(M)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${site.url}/assets/og.png">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${R}favicon.svg" type="image/svg+xml">
<link rel="manifest" href="${R}manifest.webmanifest">
${v2 ? `<link rel="preload" href="${R}assets/inter-tight-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${R}assets/jetbrains-mono-latin-var.woff2" as="font" type="font/woff2" crossorigin>` : `<link rel="preload" href="${R}assets/inter-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${R}assets/anton-latin.woff2" as="font" type="font/woff2" crossorigin>`}
<link rel="stylesheet" href="${R}assets/app.css">${v2 ? `\n<link rel="stylesheet" href="${R}assets/home.css">` : ''}${styles.map((f) => `\n<link rel="stylesheet" href="${R}assets/${f}">`).join('')}
<script>document.documentElement.classList.add('js');setTimeout(function(){document.documentElement.classList.add('ready-fallback')},1600);try{var P=JSON.parse(localStorage.getItem('lg:prefs')||'{}');var t=P.theme||'auto';if(t==='auto')t=matchMedia('(prefers-color-scheme: light)').matches?'day':'night';document.documentElement.dataset.theme=t;if(P.motion==='off')document.documentElement.dataset.motion='off';if(P.size)document.documentElement.dataset.size=P.size}catch(e){}</script>
${schema.map(ld).join('\n')}
<script type="speculationrules">{"prerender":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}</script>
</head>
<body class="${cls}" data-root="${R}">
<a class="skip" href="#main">Aller au contenu</a>
<header class="top">
  <a class="brand" href="${R}" aria-label="${esc(M)} — accueil">
    ${v2 ? BRAND_MARK : '<span class="brand-sun" aria-hidden="true"></span>'}
    <span class="brand-txt"><b>LEONIDA</b><i>guide</i></span>
  </a>
  <button class="search-trigger" type="button" data-open-search aria-label="Rechercher">
    ${icon('search')}<span>Une voiture, une mission, un lieu…</span><kbd>/</kbd>
  </button>
  <nav class="nav-desktop" aria-label="Principal">${nav.map(([u, t, i]) => `<a href="${R}${u}"${cur(u)}>${icon(i)}<span>${t}</span></a>`).join('')}</nav>
  <div class="top-actions">
    <a class="ibtn" href="${R}favoris/" aria-label="Mes favoris">${icon('heart')}<span class="count" data-fav-count hidden>0</span></a>
    <a class="ibtn" href="${R}compte/" aria-label="Mon espace">${icon('user')}</a>
  </div>
</header>
<main id="main" class="page">
${deco}
${crumbHtml}
${body}
</main>
<footer class="foot">
  <div class="foot-in">
    <a class="brand brand--foot" href="${R}">${v2 ? BRAND_MARK.replace(/mk-g/g, 'mk-f') : '<span class="brand-sun" aria-hidden="true"></span>'}<span class="brand-txt"><b>LEONIDA</b><i>guide</i></span></a>
    <nav aria-label="Pied de page">
      <a href="${R}astuces/">Astuces GTA 6</a><a href="${R}vehicules/">Véhicules</a><a href="${R}carte/">Carte interactive</a><a href="${R}lieux/">Lieux</a><a href="${R}encyclopedie/">Encyclopédie</a><a href="${R}actualites/">Actualités</a><a href="${R}a-propos/">À propos et fiabilité</a><a href="${R}compte/">Mon espace</a>
    </nav>
    <p class="disclaimer">Site indépendant, non affilié à Rockstar Games ni Take-Two. Grand Theft Auto est une marque de Take-Two Interactive. Mis à jour le ${fmtDate(site.majLe)}.</p>
  </div>
</footer>
<nav class="tabbar" aria-label="Navigation rapide">
${tabs.map(([u, t, i]) => u === '#search'
    ? `<button class="tab tab--main" type="button" data-open-search aria-label="Chercher">${icon(i)}<span>${t}</span></button>`
    : `<a class="tab" href="${R}${u}"${(u === '' ? p === '' : p.startsWith(u)) ? ' aria-current="page"' : ''}>${icon(i)}<span>${t}</span></a>`).join('')}
</nav>
<div class="so" id="search" role="dialog" aria-modal="true" aria-label="Recherche" hidden>
  <div class="so-backdrop" data-close-search></div>
  <div class="so-box">
    <div class="so-head">
      <label class="field field--xl">${icon('search')}<input type="search" id="so-input" placeholder="Écris un mot ou pose une question" autocomplete="off" enterkeyhint="search" aria-controls="so-results"></label>
      <button class="ibtn" type="button" data-close-search aria-label="Fermer">${icon('x')}</button>
    </div>
    <div class="so-chips chips" role="group" aria-label="Type de résultat">
      <button class="chip" type="button" data-sf="voiture" aria-pressed="false">${icon('car')}Voiture</button>
      <button class="chip" type="button" data-sf="mission" aria-pressed="false">${icon('flag')}Mission</button>
      <button class="chip" type="button" data-sf="lieu" aria-pressed="false">${icon('pin')}Lieu</button>
      <button class="chip" type="button" data-sf="activite" aria-pressed="false">${icon('wave')}Activité</button>
      <button class="chip" type="button" data-sf="personnage" aria-pressed="false">${icon('person')}Personnage</button>
    </div>
    <div class="so-results" id="so-results" role="listbox" aria-live="polite"></div>
  </div>
</div>
<div class="toast" role="status" aria-live="polite" hidden></div>
${v2 ? ['gsap', 'ScrollTrigger', 'SplitText', 'DrawSVGPlugin'].map((n) => `<script src="${R}assets/${n}.min.js" defer></script>`).join('\n') : ''}
<script src="${R}assets/app.js" defer></script>
${scripts.map((s) => `<script src="${R}assets/${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

const pages = [];
const emit = (p, html) => pages.push({ p, html });
const R_ = (p) => { const d = p.split('/').filter(Boolean).length; return d ? '../'.repeat(d) : './'; };

// ---------- composants ----------
function tile({ href, ic, label, sub = '', color, big = false, attrs = '' }) {
  return `<a class="tile${big ? ' tile--big' : ''}" href="${href}" style="--c:${color}" ${attrs}><span class="tile-ico">${icon(ic)}</span><span class="tile-txt"><span class="tile-label">${esc(label)}</span>${sub ? `<span class="tile-sub">${esc(sub)}</span>` : ''}</span><span class="tile-go">${icon('arrow-right')}</span></a>`;
}
function relCard(slug, R) {
  const r = ref(slug); if (!r) return '';
  return `<a class="mini" href="${R}${r.u}" style="--c:${r.c}"><span class="mini-ico">${icon(r.i)}</span><span><small>${esc(r.k)}</small><b>${esc(r.t)}</b></span>${icon('arrow-right')}</a>`;
}
function sourcesBlock(ids) {
  const list = ids.map((id) => SRC[id]).filter(Boolean);
  if (!list.length) return '';
  return `<details class="sources"><summary>${icon('shield')}Sources (${list.length})</summary><ul>${list.map((s) => `<li><a href="${s.u}" rel="nofollow noopener" target="_blank">${esc(s.n)}</a>${s.official ? ' <span class="pill pill--ok">officiel</span>' : ''}</li>`).join('')}</ul><p class="muted">Consultées le ${fmtDate(site.majLe)}.</p></details>`;
}
function favBtn(o) {
  return `<button class="btn btn--ghost fav" type="button" data-fav='${esc(JSON.stringify(o))}' aria-pressed="false">${icon('heart')}<span data-on="Dans mes favoris" data-off="Ajouter aux favoris">Ajouter aux favoris</span></button>`;
}
function fieldFilter(placeholder) {
  return `<label class="field">${icon('search')}<input type="search" data-search placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="search"></label>`;
}
function chipGroup(name, label, opts, { all = 'Tout' } = {}) {
  return `<div class="chips" role="group" aria-label="${esc(label)}" data-filter="${name}">${all ? `<button class="chip" type="button" data-value="" aria-pressed="true">${esc(all)}</button>` : ''}${opts.map((o) => `<button class="chip" type="button" data-value="${o.v}" aria-pressed="false"${o.c ? ` style="--c:${o.c}"` : ''}>${o.i ? icon(o.i) : ''}${esc(o.n)}</button>`).join('')}</div>`;
}
function emptyState(msg, R, cta = null) {
  return `<div class="empty" data-empty hidden>${icon('question', 'ic-xl')}<p>${esc(msg)}</p>${cta ? `<a class="btn btn--primary" href="${R}${cta[1]}">${esc(cta[0])}</a>` : ''}</div>`;
}
const moreBtn = `<button class="btn btn--ghost more-btn" type="button" data-more hidden>${icon('plus')}Voir plus</button>`;

function astuceCard(a, R) {
  const c = cat('astuces', a.cat);
  const txt = norm([a.titre, a.court, a.reponse, a.kw.join(' '), c.nom].join(' '));
  return `<a class="card" href="${R}astuces/${a.slug}/" style="--c:${c.color}" data-cat="${a.cat}" data-niveau="${a.niveau}" data-duree="${dureeBucket(a.duree)}" data-d="${a.duree}" data-alpha="${esc(norm(a.court))}" data-text="${esc(txt)}" data-id="${a.slug}">
  <span class="card-ico">${icon(a.icon)}</span>
  <span class="card-body"><span class="card-kicker">${esc(c.nom)}</span><b class="card-title">${esc(a.court)}</b>
  <span class="card-meta"><span class="pill">${icon('clock')}${dureeNom(a.duree)}</span>${badge(a.statut)}<span class="done-flag" hidden>${icon('check')}Fait</span></span></span>
  <span class="card-cta">Voir la solution ${icon('arrow-right')}</span></a>`;
}

// ---------- ACCUEIL (direction artistique v2 : néon sombre, traits fins) ----------
const ATTRIB_HTML = (R) => `Fond : <a href="https://map.gtadb.org" target="_blank" rel="noopener">Yanis v18 · GTADB</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, recoloré. Reconstruction communautaire, non officielle.`;
function homeSun() {
  // Soleil en traits fins : arcs concentriques + lignes d'horizon
  const arcs = [150, 128, 106, 84].map((r, i) => `<path class="sun-arc" d="M${200 - r} 200a${r} ${r} 0 0 1 ${r * 2} 0" stroke="url(#sun-g)" stroke-opacity="${1 - i * .18}"/>`).join('');
  const lines = [212, 226, 242, 260, 282].map((y, i) => `<line class="sun-line" x1="${30 + i * 8}" x2="${370 - i * 8}" y1="${y}" y2="${y}" stroke="url(#sun-h)" stroke-opacity="${.9 - i * .15}"/>`).join('');
  return `<svg class="h-sun" viewBox="0 0 400 300" aria-hidden="true" fill="none" stroke-width="1.1" stroke-linecap="round">
    <defs><linearGradient id="sun-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb547"/><stop offset=".6" stop-color="#ff2bd6"/><stop offset="1" stop-color="#9d7bff"/></linearGradient>
    <linearGradient id="sun-h" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="380" y2="0"><stop offset="0" stop-color="#2de2e6" stop-opacity="0"/><stop offset=".5" stop-color="#ff2bd6"/><stop offset="1" stop-color="#2de2e6" stop-opacity="0"/></linearGradient></defs>
    ${arcs}${lines}</svg>`;
}
function homePalms() {
  const palm = (tx, s, flip) => `<g transform="translate(${tx} 0) scale(${flip ? -s : s} ${s})"><path class="palm-l" d="M0 300C2 240 6 190 18 140"/><path class="palm-l" d="M18 140C4 116-22 108-46 118M18 140C10 112 14 88 30 72M18 140C30 116 54 104 80 110M18 140C36 132 58 138 72 156M18 140C0 136-18 146-26 166"/></g>`;
  return `<svg class="h-palms" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" fill="none" stroke="#ff2bd6" stroke-width="1.1" stroke-linecap="round">${palm(90, 1, false)}${palm(1110, 1.15, true)}${palm(1010, .75, false)}</svg>`;
}
{
  const p = '', R = R_(p);
  const H = ACCUEIL;
  const counts = { astuces: ASTUCES.length, vehicules: VEHICULES.length + CATALOGUE.vehicules.length, reperes: features.filter((f) => !f.properties.label).length, actualites: ACTUS.length };
  const fill = (t, c) => t.replace('{n}', counts[c] ?? '').replace('{date}', fmtDate(ACTUS[0].date));
  const shortcuts = H.enCeMoment.astuces.map((s) => A[s]);
  const maj = site.majLe.split('-').reverse().join('.');
  const tileImg = { carte: vign('vice-city', R), vehicules: vign('v-pegassi-infernus', R) };
  const tilesHtml = H.tuiles.map((t, i) => `<a class="ht${t.taille === 'large' ? ' ht--large' : ''}${tileImg[t.id] ? ' ht--img' : ''}" href="${R}${t.href}" style="--c:${t.couleur}${tileImg[t.id] ? `;--img:url(${tileImg[t.id]})` : ''}" data-h="tile">
      <span class="ht-idx">0${i + 1}</span>
      <span class="ht-ico">${icon(t.icon)}</span>
      <span class="ht-txt"><b>${esc(t.label)}</b><small>${esc(fill(t.sousTitre, t.compteur))}</small></span>
      <span class="ht-go" aria-hidden="true">${icon('arrow-right')}</span>
    </a>`).join('');
  const body = `
<section class="h-hero" aria-labelledby="h-title">
  <div class="h-bg" aria-hidden="true">
    <div class="h-glow"></div>
    ${homeSun()}
    <div class="h-floor"><div class="h-floor-grid"></div></div>
    ${homePalms()}
  </div>
  <div class="wrap h-in">
    <p class="h-kicker h-anim"><span class="h-dot"></span>${esc(H.hero.kicker)}<span class="h-sep">/</span>MAJ ${maj}</p>
    <h1 class="h-title" id="h-title">${H.hero.titre.map((l) => `<span class="h-line h-line--${l.style}"${l.style === 'neon' ? ` data-text="${esc(l.texte)}"` : ''}>${esc(l.texte)}</span>`).join('')}</h1>
    <button class="h-search h-anim" type="button" data-open-search aria-label="${esc(H.hero.recherche.label)}">
      ${icon('search')}
      <span class="h-search-ph"><span data-typer data-words='${esc(JSON.stringify(H.hero.recherche.suggestionsAnimees))}'>${esc(H.hero.recherche.placeholder)}</span><i class="h-caret"></i></span>
      <kbd>/</kbd>
      <span class="h-search-go">${icon('arrow-right')}</span>
    </button>
    <nav class="h-quick h-anim" aria-label="Recherches rapides">${H.hero.raccourcis.map((r) => `<a href="${R}recherche/?q=${encodeURIComponent(r.q)}" data-q="${esc(r.q)}">${icon(r.icon)}${esc(r.label)}</a>`).join('')}</nav>
    <nav class="h-tiles" aria-label="Catégories">${tilesHtml}</nav>
    <p class="h-help h-anim">${icon('info')}${esc(H.aide)}</p>
  </div>
</section>

<section class="wrap h-map" aria-labelledby="hm-title">
  <header class="h-head">
    <p class="h-kicker"><span class="h-dot h-dot--c"></span>${esc(H.carte.kicker)}</p>
    <h2 class="h-h2" id="hm-title">${esc(H.carte.titre)}</h2>
    <p class="h-lead">${esc(H.carte.texte)}</p>
  </header>
  <div class="hm" data-homemap data-center="${H.carte.vueInitiale.centre.join(',')}" data-zoom="${H.carte.vueInitiale.zoom}">
    <div class="hm-stage" tabindex="0" role="application" aria-label="Carte interactive de Leonida : glisse pour naviguer, + et − pour zoomer"></div>
    <p class="at-attrib">${ATTRIB_HTML(R)}</p>
    <div class="hm-legend" role="group" aria-label="Afficher">${site.categories.carte.map((c) => `<button type="button" class="hm-chip" data-cat="${c.id}" aria-pressed="true" style="--c:${c.color}"><i></i>${esc(c.nom)}</button>`).join('')}</div>
    <div class="hm-ctrl">
      <button type="button" class="hm-btn" data-z="in" aria-label="Zoomer">${icon('plus')}</button>
      <button type="button" class="hm-btn" data-z="out" aria-label="Dézoomer">${icon('minus')}</button>
      <button type="button" class="hm-btn" data-z="reset" aria-label="Recentrer">${icon('expand')}</button>
    </div>
    <p class="hm-hint" hidden>Ctrl + molette pour zoomer</p>
    <div class="hm-pop" hidden></div>
    <span class="hm-corner hm-corner--tl"></span><span class="hm-corner hm-corner--tr"></span><span class="hm-corner hm-corner--bl"></span><span class="hm-corner hm-corner--br"></span>
  </div>
  <a class="nbtn nbtn--primary" href="${R}${H.carte.cta.href}"><span>${esc(H.carte.cta.label)}</span><i>${icon('arrow-right')}</i></a>
</section>

<section class="wrap h-now" aria-labelledby="now-title">
  <header class="h-head h-head--row"><p class="h-kicker"><span class="h-dot h-dot--g"></span>${esc(H.enCeMoment.titre)}</p><a class="nbtn nbtn--ghost nbtn--sm" href="${R}astuces/"><span>Toutes les astuces</span><i>${icon('arrow-right')}</i></a></header>
  <h2 class="sr-only" id="now-title">${esc(H.enCeMoment.titre)}</h2>
  <ol class="h-rows">${shortcuts.map((a, i) => { const c = cat('astuces', a.cat); return `<li><a class="h-row" href="${R}astuces/${a.slug}/" style="--c:${c.color === '#ff3d6e' ? '#ff2bd6' : c.color}"><span class="h-row-n">0${i + 1}</span><span class="h-row-ico">${icon(a.icon)}</span><span class="h-row-t"><small>${esc(c.nom)} · ${dureeNom(a.duree)}</small><b>${esc(a.court)}</b></span><span class="h-row-go">${icon('arrow-right')}</span></a></li>`; }).join('')}</ol>
</section>`;
  emit(p, layout({
    p, title: H.meta.title, desc: H.meta.description, cls: 'home', body, v2: true, scripts: ['atlas.js', 'home.js'], styles: ['atlas.css'],
    schema: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: M, url: site.url + '/', inLanguage: 'fr-FR', potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${site.url}/recherche/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } },
      { '@context': 'https://schema.org', '@type': 'Organization', name: M, url: site.url + '/', logo: `${site.url}/favicon.svg` },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Rubriques du guide', itemListElement: H.tuiles.map((t, i) => ({ '@type': 'SiteNavigationElement', position: i + 1, name: t.label, url: `${site.url}/${t.href}` })) }
    ]
  }));
}

function palms() {
  const palm = (x, s, flip) => `<svg class="palm" style="left:${x}%;--s:${s};${flip ? 'transform:scaleX(-1)' : ''}" viewBox="0 0 120 260"><path d="M62 260c-2-60 2-120 10-170" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M72 92c-20-30-50-34-70-22 22-2 44 6 70 22zM72 92c10-34 40-48 64-40-22 4-46 18-64 40zM72 92c-4-30-26-50-48-52 18 10 34 28 48 52zM72 92c18-24 44-30 60-20-20 0-40 8-60 20zM72 92c-26-12-52-6-64 10 20-10 42-12 64-10z" fill="currentColor"/></svg>`;
  return palm(2, 1, false) + palm(80, 1.25, true) + palm(90, .8, false);
}

// ---------- RECHERCHE ----------
{
  const p = 'recherche/', R = R_(p);
  const body = `<section class="wrap section">
  <h1 class="h1">Tu cherches quoi ?</h1>
  <div class="inline-search" data-inline-search>
    <label class="field field--xl">${icon('search')}<input type="search" id="rs-input" placeholder="Écris un mot ou pose une question" autocomplete="off" enterkeyhint="search"></label>
    <div class="chips" role="group" aria-label="Type">
      <button class="chip" type="button" data-sf="voiture" aria-pressed="false">${icon('car')}Voiture</button>
      <button class="chip" type="button" data-sf="mission" aria-pressed="false">${icon('flag')}Mission</button>
      <button class="chip" type="button" data-sf="lieu" aria-pressed="false">${icon('pin')}Lieu</button>
      <button class="chip" type="button" data-sf="activite" aria-pressed="false">${icon('wave')}Activité</button>
      <button class="chip" type="button" data-sf="personnage" aria-pressed="false">${icon('person')}Personnage</button>
      <button class="chip chip--toggle" type="button" data-mapsonly aria-pressed="false">${icon('map')}Sur la carte seulement</button>
    </div>
    <div class="so-results" id="rs-results" aria-live="polite"></div>
  </div>
</section>`;
  emit(p, layout({ p, title: 'Recherche GTA 6 : retrouver un véhicule, un lieu, une astuce', desc: 'Recherchez une astuce, un véhicule, un lieu ou une réponse GTA 6 depuis une seule barre de recherche.', body, cls: 'p-search' }));
}

// ---------- ASTUCES ----------
{
  const p = 'astuces/', R = R_(p);
  const cats = site.categories.astuces;
  const body = `<section class="wrap section" data-list>
  <h1 class="h1">De quoi as-tu besoin ?</h1>
  ${fieldFilter('Trouver une astuce')}
  <div class="doors" role="group" aria-label="Catégorie" data-filter="cat">
    ${cats.map((c) => `<button class="door" type="button" data-value="${c.id}" aria-pressed="false" style="--c:${c.color}"><span class="door-ico">${icon(c.icon)}</span><span>${esc(c.nom)}</span><small>${ASTUCES.filter((a) => a.cat === c.id).length}</small></button>`).join('')}
  </div>
  <div class="filterbar">
    ${chipGroup('niveau', 'Difficulté', [{ v: 'facile', n: 'Facile' }, { v: 'intermediaire', n: 'Intermédiaire' }], { all: 'Tous niveaux' })}
    ${chipGroup('duree', 'Durée', [{ v: 'court', n: 'Moins de 2 min' }, { v: 'moyen', n: '5 min' }, { v: 'long', n: '+' }], { all: 'Toutes durées' })}
    <label class="sort">${icon('sliders')}<select data-sort aria-label="Trier"><option value="">Pertinence</option><option value="d">Plus rapide</option><option value="alpha">A → Z</option></select></label>
  </div>
  <p class="count-line" data-count></p>
  <div class="grid" data-items>${ASTUCES.map((a) => astuceCard(a, R)).join('')}</div>
  ${emptyState('Pas encore de guide pour ce sujet', R, ['Tout voir', 'astuces/'])}
  ${moreBtn}
</section>`;
  emit(p, layout({
    p, title: 'Astuces GTA 6 : solutions rapides et guides faciles', desc: 'Trouvez un guide GTA 6 par mission, véhicule ou activité, avec des étapes courtes et des solutions directes.', body, cls: 'p-list',
    crumbs: [['Accueil', ''], ['Astuces', 'astuces/']],
    schema: [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: ASTUCES.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: `${site.url}/astuces/${a.slug}/`, name: a.titre })) }]
  }));
}

// ---------- FICHE ASTUCE ----------
for (const a of ASTUCES) {
  const p = `astuces/${a.slug}/`, R = R_(p);
  const c = cat('astuces', a.cat);
  const mapIds = astuceMap[a.slug] || [];
  const mapHref = mapIds.length ? `${R}carte/?focus=${mapIds[0]}` : ASTUCE_MAP_EXTRA[a.slug] ? `${R}carte/?${ASTUCE_MAP_EXTRA[a.slug]}` : null;
  const body = `<article class="wrap fiche" style="--c:${c.color}">
  <header class="fiche-head" data-reveal-group>
    <div class="fiche-ico">${icon(a.icon, 'ic-xl')}</div>
    <div class="fiche-tags"><a class="pill pill--cat" href="${R}astuces/?cat=${a.cat}">${icon(c.icon)}${esc(c.nom)}</a><span class="pill">${icon('clock')}${dureeNom(a.duree)}</span><span class="pill">${niveauNom(a.niveau)}</span>${badge(a.statut)}</div>
    <h1 class="h1 h1--fiche">${esc(a.titre)}</h1>
  </header>
  ${mapIds.length && vign(mapIds[0], R) ? `<a class="map-banner" href="${R}carte/?focus=${mapIds[0]}" style="--img:url(${vign(mapIds[0], R)})"><i></i><span>${icon('map')}Voir l'endroit sur la carte</span><small>Position approximative</small></a>` : ''}
  <section class="answer" id="solution" aria-label="Réponse">
    <span class="answer-k">${icon('bolt')}Réponse</span>
    <p>${esc(a.reponse)}</p>
  </section>
  <div class="actions">
    <a class="btn btn--primary" href="#etapes">${icon('list')}Voir la solution</a>
    ${mapHref ? `<a class="btn" href="${mapHref}">${icon('map')}Voir sur la carte</a>` : ''}
    <button class="btn btn--ghost" type="button" data-copy>${icon('link')}Copier le lien</button>
    ${favBtn({ id: a.slug, type: 'astuce', t: a.court, u: p, i: a.icon, c: c.color })}
    <button class="btn btn--ghost" type="button" data-done="${a.slug}" aria-pressed="false">${icon('check')}<span data-on="C'est fait !" data-off="Je l'ai fait">Je l'ai fait</span></button>
  </div>
  <section class="steps-wrap" id="etapes" aria-labelledby="et-t">
    <h2 id="et-t" class="h3">${icon('list')}Étapes</h2>
    <ol class="steps">${a.etapes.map((s, i) => `<li class="step"><span class="step-n">${i + 1}</span><span class="step-t">${esc(s)}</span></li>`).join('')}</ol>
  </section>
  ${a.asavoir ? `<aside class="note">${icon('alert')}<p><b>À savoir :</b> ${esc(a.asavoir)}</p></aside>` : ''}
  <section class="related" aria-labelledby="va-t"><h2 id="va-t" class="h3">${icon('sparkle')}Voir aussi</h2><div class="minis">${a.voir.map((s) => relCard(s, R)).join('')}</div></section>
  <details class="more" id="questions"><summary>${icon('question')}Questions fréquentes</summary>
    <h3>${esc(a.titre)}</h3><p>${esc(a.reponse)} ${esc(a.asavoir || '')}</p>
    <h3>Combien de temps faut-il ?</h3><p>Compte environ ${dureeNom(a.duree)}. Difficulté : ${niveauNom(a.niveau).toLowerCase()}.</p>
    <h3>Cette information est-elle fiable ?</h3><p>Statut : ${esc(statut(a.statut).nom)}. ${esc(statut(a.statut).desc)} Les sources sont listées ci-dessous.</p>
  </details>
  ${sourcesBlock(a.sources)}
</article>`;
  emit(p, layout({
    p, title: `${a.titre.replace(/ \?$/, '').replace(/ dans GTA 6$/, '')} dans GTA 6 : solution pas à pas`.replace('GTA 6 dans GTA 6', 'GTA 6'),
    desc: `${a.reponse}`.slice(0, 155),
    body, cls: 'p-fiche', ogType: 'article',
    crumbs: [['Accueil', ''], ['Astuces', 'astuces/'], [c.nom, `astuces/?cat=${a.cat}`], [a.court, p]],
    schema: [
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: a.titre, acceptedAnswer: { '@type': 'Answer', text: a.reponse + ' ' + a.etapes.join(' ') } }] },
      { '@context': 'https://schema.org', '@type': 'HowTo', name: a.titre, totalTime: `PT${a.duree}M`, step: a.etapes.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })) }
    ]
  }));
}

// ---------- VEHICULES ----------
function vehCard(v, R) {
  const c = cat('vehicules', v.type);
  const l = v.lieu && L[v.lieu];
  const reg = l ? (l.type === 'region' ? l.id : l.region) : '';
  const txt = norm([v.nom, v.sous, c.nom, v.emplacement, v.kw.join(' '), l ? l.nom : ''].join(' '));
  return `<a class="card card--veh" href="${R}vehicules/${v.slug}/" style="--c:${v.color || c.color}" data-cat="${v.type}" data-zone="${reg || ''}" data-dispo="${v.dispo}" data-map="${vehOnMap(v.slug) ? 1 : 0}" data-alpha="${esc(norm(v.nom))}" data-text="${esc(txt)}" data-id="${v.slug}">
  <span class="veh-art"${vign('v-' + v.slug, R) ? ` style="--img:url(${vign('v-' + v.slug, R)})"` : ''}>${vehVisuel(v, R)}<span class="veh-type">${esc(v.sous)}</span>${l ? `<span class="veh-pin">${esc(l.nom)}</span>` : ''}</span>
  <span class="card-body"><span class="card-kicker">${esc(c.nom)}</span><b class="card-title">${esc(v.nom)}</b>
  <span class="card-meta">${badge(v.dispo)}${l ? `<span class="pill">${icon('pin')}${esc(l.nom)}</span>` : `<span class="pill pill--warn">${icon('question')}Position non vérifiée</span>`}</span></span>
  <span class="card-cta">Où le trouver ? ${icon('arrow-right')}</span></a>`;
}
const UN = { 'Supercars': 'Supercar', 'Sportives': 'Sportive', 'Sportives classiques': 'Sportive classique', 'Muscle cars': 'Muscle car', 'Coupés': 'Coupé', 'Berlines': 'Berline', 'Motos': 'Moto', 'Vélos': 'Vélo', 'Bateaux': 'Bateau', 'Hélicoptères': 'Hélicoptère', 'Avions': 'Avion', 'Police et urgences': 'Urgences', 'Militaires': 'Militaire', 'Vans et fourgons': 'Van', 'Utilitaires': 'Utilitaire', 'Industriels': 'Industriel', 'Taxis, bus et service': 'Service' };
function catCard(x, R) {
  const c = cat('vehicules', x.type);
  const txt = norm([x.nom, x.classe, c.nom, x.inspiration || '', x.fabricant || ''].join(' '));
  const visu = x.img ? `<img class="veh-photo" src="${R}catalogue/${x.img}" alt="${esc(x.nom)}" loading="lazy" decoding="async">` : silhouette({ slug: '', type: x.type });
  return `<button class="card card--veh card--cat" type="button" data-fiche="${x.slug}" style="--c:${c.color}" data-cat="${x.type}" data-grp="${x.groupe}" data-photo="${x.img ? 1 : 0}" data-known="${x.obtenir ? 1 : 0}" data-sur="${(VERIF[x.slug] || {}).statut === 'confirme' ? 1 : 0}" data-map="0" data-text="${esc(txt)}" aria-haspopup="dialog">
  <span class="veh-art">${visu}<span class="veh-type">${esc(UN[x.classe] || x.classe)}</span></span>
  <span class="card-body"><span class="card-kicker">${esc(x.fabricant || c.nom)}</span><b class="card-title">${esc(x.modele || x.nom)}</b>
  <span class="card-meta">${x.inspiration ? `<span class="pill pill--insp">${icon('car')}${esc(x.inspiration.length > 34 ? x.inspiration.slice(0, 32) + '…' : x.inspiration)}</span>` : `<span class="pill">${icon('check')}Confirmé dans le jeu</span>`}${x.obtenir ? `<span class="pill pill--ok">${icon('pin')}Où l'obtenir</span>` : ''}${(VERIF[x.slug] || {}).statut !== 'confirme' ? `<span class="pill pill--warn">${icon('question')}À confirmer</span>` : ''}</span></span>
  <span class="card-cta">Voir les infos ${icon('arrow-right')}</span></button>`;
}
{
  const p = 'vehicules/', R = R_(p);
  const GRP = CATALOGUE.groupes || [];
  const grpDe = (v) => (CATALOGUE.fiches[v.slug] || {}).groupe || 'service';
  // une carte par véhicule, rangée dans sa catégorie : nos fiches (emplacement connu) d'abord, puis les photos nettes, puis le reste
  const cartes = {};
  for (const v of VEHICULES) (cartes[grpDe(v)] ||= []).push({ o: 0, n: v.nom, o: (VERIF[v.slug] || {}).statut === 'non-confirme' ? 9 : 0, html: vehCard(v, R).replace('class="card card--veh"', `class="card card--veh card--fiche" data-grp="${grpDe(v)}" data-photo="1" data-known="1" data-sur="${(VERIF[v.slug] || {}).statut === 'confirme' ? 1 : 0}"`) });
  for (const x of CATALOGUE.vehicules) (cartes[x.groupe] ||= []).push({ o: ((VERIF[x.slug] || {}).statut !== 'confirme' ? 10 : 0) + (x.obtenir ? 1 : x.img ? 2 : 3), n: x.nom, html: catCard(x, R) });
  const groupes = GRP.filter((g) => cartes[g.id]);
  const total = VEHICULES.length + CATALOGUE.vehicules.length;
  const ty = (id) => [...VEHICULES.filter((v) => v.type === id), ...CATALOGUE.vehicules.filter((x) => x.type === id)].length;
  const body = `<section class="wrap section" data-vlist>
  <h1 class="h1">Quel véhicule cherches-tu ?</h1>
  <p class="lead veh-lead"><b>${total} véhicules</b> rangés par catégorie. Dans chaque catégorie, ceux dont on sait où les trouver passent en premier. Chaque véhicule a été vérifié : ${Object.values(VERIF).filter((v) => v.statut === 'confirme').length} sont confirmés par GTA Wiki ou le site officiel de Rockstar, les autres portent l'étiquette « À confirmer ». Tape un nom, une marque ou même une vraie voiture (« Porsche », « Corvette »…).</p>
  ${fieldFilter('Nom, marque ou vraie voiture')}
  <div class="doors doors--5" role="group" aria-label="Type" data-vtype>
    ${site.categories.vehicules.map((c) => `<button class="door" type="button" data-value="${c.id}" aria-pressed="false" style="--c:${c.color}"><span class="door-ico">${icon(c.icon)}</span><span>${esc(c.nom)}</span><small>${ty(c.id)}</small></button>`).join('')}
  </div>
  <div class="filterbar">
    <button class="chip chip--toggle" type="button" data-vtoggle="known" aria-pressed="false">${icon('pin')}Emplacement connu</button>
    <button class="chip chip--toggle" type="button" data-vtoggle="sur" aria-pressed="false">${icon('check')}Confirmés seulement</button>
    <button class="chip chip--toggle" type="button" data-vtoggle="photo" aria-pressed="false">${icon('eye')}Avec photo</button>
    <button class="chip chip--toggle" type="button" data-vtoggle="map" aria-pressed="false">${icon('map')}Sur la carte</button>
  </div>
  <nav class="vjump" aria-label="Aller à une catégorie">${groupes.map((g) => `<a href="#cat-${g.id}" data-jump="${g.id}">${esc(g.nom)}<small>${cartes[g.id].length}</small></a>`).join('')}</nav>
  <p class="count-line" data-vcount aria-live="polite"></p>
  ${groupes.map((g) => `<section class="vgrp" id="cat-${g.id}" data-vgrp="${g.id}" data-type="${g.type}" aria-labelledby="t-${g.id}">
    <h2 class="vgrp-h" id="t-${g.id}">${esc(g.nom)} <small data-vn>${cartes[g.id].length}</small></h2>
    <div class="grid">${cartes[g.id].sort((a, b) => a.o - b.o || a.n.localeCompare(b.n, 'fr')).map((c) => c.html).join('')}</div>
    <button class="btn btn--ghost vgrp-more" type="button" data-vmore hidden>${icon('plus')}<span></span></button>
  </section>`).join('')}
  <p class="empty" data-vempty hidden>${icon('search')}Aucun véhicule ne correspond. Essaie un autre mot.</p>
  <dialog class="vdlg" aria-labelledby="vdlg-t"><div class="vdlg-in" data-vdlg></div></dialog>
  <script type="application/json" id="catalogue-data">${JSON.stringify(CATALOGUE.vehicules.map((x) => ({ s: x.slug, n: x.nom, f: x.fabricant, m: x.modele, c: x.classe, t: x.type, i: x.inspiration, p: x.places, w: x.poids, tr: x.transmission, r: x.rapports, a: x.aussi, o: x.obtenir, d: x.resume, vf: (VERIF[x.slug] || {}).statut, vt: verifTexte(x.slug), vn: (VERIF[x.slug] || {}).note, img: x.img, cr: x.credit, cu: x.creditUrl, src: x.sources }))).replace(/</g, '\\u003c')}</script>
  <p class="note veh-sources">${icon('info')}<span>Liste et caractéristiques : <a href="https://www.gtabase.com/fr/gta-6/vehicules/" target="_blank" rel="noopener">GTABase</a> et <a href="https://gta6guide.fr/gta-6/vehicules" target="_blank" rel="noopener">gta6guide.fr</a>. Photos : Rockstar Games (via GTABase, GTA Wiki) et gta6guide.fr, choisies parmi les plus nettes.</span></p>
  <a class="btn btn--wide" href="${R}carte/?cat=vehicules">${icon('map')}Voir les véhicules sur la carte</a>
</section>`;
  emit(p, layout({ p, title: 'Véhicules GTA 6 : liste complète par catégorie, photos et emplacements', desc: `Les ${total} véhicules confirmés de GTA 6 rangés par catégorie : photo, marque, vraie voiture d'origine, caractéristiques et emplacement quand il est connu.`, body, cls: 'p-list', scripts: ['catalogue.js'], crumbs: [['Accueil', ''], ['Véhicules', 'vehicules/']] }));
}
for (const v of VEHICULES) {
  const p = `vehicules/${v.slug}/`, R = R_(p);
  const c = cat('vehicules', v.type);
  const l = v.lieu && L[v.lieu];
  const onM = vehOnMap(v.slug);
  const similar = VEHICULES.filter((x) => x.slug !== v.slug && x.type === v.type).slice(0, 2);
  const sameReg = l ? VEHICULES.filter((x) => x.slug !== v.slug && L[x.lieu] && (L[x.lieu].region || L[x.lieu].id) === (l.region || l.id) && !similar.includes(x)).slice(0, 2) : [];
  const body = `<article class="wrap fiche" style="--c:${v.color || c.color}">
  <header class="fiche-head fiche-head--veh" data-reveal-group>
    ${MODELES[v.slug] ? `<div class="veh-hero veh-hero--3d${PHOTOS[v.slug] ? ' is-photo' : ''}" data-v3d="${esc(JSON.stringify({ ...MODELES[v.slug], ...(GLB.has(v.slug) ? { glb: `modeles/${v.slug}.glb` } : {}) }))}"${PHOTOS[v.slug] ? ' data-v3d-attente' : ''}>${rendu(v, R).replace(' loading="lazy"', '')}<div class="v3d-stage"></div>${PHOTOS[v.slug] ? photoJeu(v, R, ' veh-jeu').replace(' loading="lazy"', '') : ''}<span class="veh-type">${esc(v.sous)}</span>${l ? `<span class="veh-pin">${esc(l.nom)}</span>` : ''}
      <div class="v3d-bar" role="group" aria-label="Affichage du véhicule">${PHOTOS[v.slug] ? `<button type="button" data-vue="photo" aria-pressed="true">${icon('eye')}Photo du jeu</button>` : ''}<button type="button" data-vue="3d" aria-pressed="${PHOTOS[v.slug] ? 'false' : 'true'}">${icon('refresh')}Vue 3D</button></div>
      <span class="v3d-hint" aria-hidden="true">${icon('refresh')}Glisse pour le faire tourner</span></div>`
    : `<div class="veh-hero"${vign('v-' + v.slug, R) ? ` style="--img:url(${vign('v-' + v.slug, R)})"` : ''}>${vehVisuel(v, R, 'veh-svg--xl')}<span class="veh-type">${esc(v.sous)}</span>${l ? `<span class="veh-pin">${esc(l.nom)}</span>` : ''}</div>`}
    ${vehCredit(v)}
    <div class="fiche-tags"><a class="pill pill--cat" href="${R}vehicules/?cat=${v.type}">${icon(c.icon)}${esc(c.nom)}</a>${badge(v.dispo)}</div>
    <h1 class="h1 h1--fiche">${esc(v.nom)}</h1>
  </header>
  <div class="actions">
    <a class="btn btn--primary" href="#ou">${icon('pin')}Où le trouver ?</a>
    ${onM ? `<a class="btn" href="${R}carte/?focus=v-${v.slug}">${icon('map')}Voir sur la carte</a>` : `<span class="btn btn--off" aria-disabled="true">${icon('map')}Position non vérifiée</span>`}
    ${favBtn({ id: v.slug, type: 'vehicule', t: v.nom, u: p, i: c.icon, c: v.color || c.color })}
  </div>
  <dl class="facts">
    <div><dt>${icon(c.icon)}Type</dt><dd>${esc(c.nom)} · ${esc(v.sous)}</dd></div>
    <div><dt>${icon('shield')}Disponibilité</dt><dd>${esc(statut(v.dispo).nom)}</dd></div>
    ${VERIF[v.slug] ? `<div class="fact-verif fact-verif--${VERIF[v.slug].statut}"><dt>${icon(VERIF[v.slug].statut === 'confirme' ? 'check' : 'alert')}Présence dans GTA 6</dt><dd>${esc(verifTexte(v.slug))}${VERIF[v.slug].note ? ` <small>${esc(VERIF[v.slug].note)}</small>` : ''}</dd></div>` : ''}
    ${CATALOGUE.fiches[v.slug] && CATALOGUE.fiches[v.slug].fabricant ? `<div><dt>${icon('badge')}Marque</dt><dd>${esc(CATALOGUE.fiches[v.slug].fabricant)}${CATALOGUE.fiches[v.slug].classe ? ' · ' + esc(CATALOGUE.fiches[v.slug].classe) : ''}</dd></div>` : ''}
    ${CATALOGUE.fiches[v.slug] && CATALOGUE.fiches[v.slug].inspiration ? `<div><dt>${icon('car')}Inspiré de</dt><dd>${esc(CATALOGUE.fiches[v.slug].inspiration)}${CATALOGUE.fiches[v.slug].places ? ` · ${esc(CATALOGUE.fiches[v.slug].places)} places` : ''}</dd></div>` : ''}
    ${CATALOGUE.fiches[v.slug] && (CATALOGUE.fiches[v.slug].transmission || CATALOGUE.fiches[v.slug].poids) ? `<div><dt>${icon('sliders')}Caractéristiques</dt><dd>${[CATALOGUE.fiches[v.slug].transmission, CATALOGUE.fiches[v.slug].poids, CATALOGUE.fiches[v.slug].aussi ? 'déjà dans ' + CATALOGUE.fiches[v.slug].aussi : ''].filter(Boolean).map(esc).join(' · ')}</dd></div>` : ''}
    <div id="ou"><dt>${icon('pin')}Emplacement</dt><dd>${l ? `<b>${esc(l.nom)}</b> — ` : '<b>Inconnu</b> — '}${esc(v.emplacement)}</dd></div>
  </dl>
  <section class="steps-wrap" aria-labelledby="ob-t"><h2 id="ob-t" class="h3">${icon('list')}Comment l'obtenir</h2>
    <ol class="steps">${v.obtenir.map((s, i) => `<li class="step"><span class="step-n">${i + 1}</span><span class="step-t">${esc(s)}</span></li>`).join('')}</ol></section>
  ${similar.length ? `<section class="related"><h2 class="h3">${icon(c.icon)}Même type</h2><div class="minis">${similar.map((x) => relCard(x.slug, R)).join('')}</div></section>` : ''}
  ${sameReg.length ? `<section class="related"><h2 class="h3">${icon('pin')}Même région</h2><div class="minis">${sameReg.map((x) => relCard(x.slug, R)).join('')}</div></section>` : ''}
  <details class="more"><summary>${icon('info')}En savoir plus</summary><p>${esc(v.nom)} (${esc(c.nom.toLowerCase())}, ${esc(v.sous.toLowerCase())}) dans GTA 6. Emplacement signalé : ${esc(v.emplacement)} Statut : ${esc(statut(v.dispo).nom.toLowerCase())}. Ne jamais se fier à un emplacement non vérifié pour une mission chronométrée.</p></details>
  ${sourcesBlock(v.sources)}
</article>`;
  emit(p, layout({ p, title: `${v.nom} GTA 6 : emplacement et comment l'obtenir`, desc: `Localisation, informations et méthode d'obtention de ${v.nom} dans GTA 6, selon les sources disponibles.`, body, cls: 'p-fiche', ogType: 'article', scripts: MODELES[v.slug] ? ['v3d-init.js'] : [], crumbs: [['Accueil', ''], ['Véhicules', 'vehicules/'], [v.nom, p]] }));
}

// ---------- CARTE (v2 : vraie carte communautaire) ----------
{
  const p = 'carte/', R = R_(p);
  const body = `<h1 class="sr-only">Carte interactive de GTA 6 : Leonida</h1>
<section class="atp" data-atlas-page>
  <div class="atp-stage" tabindex="0" role="application" aria-label="Carte de Leonida : glisse pour naviguer, pince ou molette pour zoomer"></div>
  <div class="atp-top">
    <label class="atp-search"><span class="sr-only">Chercher sur la carte</span>${icon('search')}<input type="search" id="atp-q" placeholder="Chercher un lieu, un véhicule…" autocomplete="off" enterkeyhint="search" aria-controls="atp-sugg"></label>
    <div class="atp-sugg" id="atp-sugg" role="listbox" hidden></div>
    <div class="atp-cats" role="group" aria-label="Afficher sur la carte">
      ${site.categories.carte.map((c) => `<button type="button" class="atp-chip" data-cat="${c.id}" aria-pressed="true" style="--c:${c.color}"><i></i>${esc(c.nom)}<small data-n="${c.id}"></small></button>`).join('')}
      <button type="button" class="atp-chip atp-chip--commu" data-commu aria-pressed="false" style="--c:#c7c2e0"><i></i>Lieux de la communauté<small data-n="commu"></small></button>
    </div>
  </div>
  <div class="atp-ctrl">
    <button type="button" class="hm-btn hm-btn--help" data-help aria-label="Comment utiliser la carte">${icon('question')}</button>
    <button type="button" class="hm-btn" data-z="in" aria-label="Zoomer">${icon('plus')}</button>
    <button type="button" class="hm-btn" data-z="out" aria-label="Dézoomer">${icon('minus')}</button>
    <button type="button" class="hm-btn" data-z="reset" aria-label="Voir toute la carte">${icon('expand')}</button>
  </div>
  <div class="atp-regions" role="group" aria-label="Liste et régions"><button type="button" class="atp-list" data-list>${icon('list')}Liste<small data-n="vue"></small></button>${CARTE.regions.map((r) => `<button type="button" data-reg="${r.id}" style="--c:${r.couleur}">${esc(r.nom)}</button>`).join('')}</div>
  <aside class="atp-panel" data-panel hidden aria-live="polite"></aside>
  <details class="at-attrib at-attrib--page"><summary>${icon('info')}Sources</summary><p>${ATTRIB_HTML(R)} Lieux : GTADB, CC BY 4.0.</p></details>
</section>`;
  emit(p, layout({ p, title: 'Carte GTA 6 interactive : lieux et véhicules', desc: 'Explorez la carte de Leonida en détail : zoom, recherche, véhicules, activités et plus de 900 lieux repérés par la communauté.', body, cls: 'p-atlas', v2: true, scripts: ['atlas.js', 'carte.js'], styles: ['atlas.css'] }));
}

// ---------- LIEUX ----------
{
  const p = 'lieux/', R = R_(p);
  const cats = site.categories.lieux;
  const regsUsed = Object.keys(REG);
  const tileL = (l) => {
    const c = cat('lieux', l.type);
    const reg = l.region && REG[l.region];
    const color = l.type === 'region' ? (CARTE.regions.find((r) => r.id === l.id) || {}).couleur || c.color : c.color;
    const m = onMap(l.id);
    const txt = norm([l.nom, l.desc, l.kw.join(' '), reg ? reg.nom : '', c.nom].join(' '));
    const vg = vign(l.id, R);
    return `<article class="card card--lieu" id="${l.id}" style="--c:${color}" data-cat="${l.type}" data-zone="${l.region || ''}" data-ver="${l.statut === 'confirme' ? 'oui' : 'non'}" data-map="${m ? 1 : 0}" data-alpha="${esc(norm(l.nom))}" data-text="${esc(txt)}">
    ${vg ? `<a class="card-map" href="${R}carte/?focus=${l.id}" style="--img:url(${vg})" aria-label="Voir ${esc(l.nom)} sur la carte"><i></i></a>` : ''}
    <span class="card-ico">${icon(l.icon)}</span>
    <span class="card-body"><span class="card-kicker">${esc(c.nom.replace(/s$/, '').replace("Points d'intérêt", "Point d'intérêt"))}${reg && l.type !== 'region' ? ` · ${esc(reg.nom)}` : ''}</span><b class="card-title">${esc(l.nom)}</b>
    <span class="card-desc">${esc(l.desc)}${l.acces ? ` <i>${icon('compass')}${esc(l.acces)}</i>` : ''}</span>
    <span class="card-meta">${badge(l.statut)}</span></span>
    <span class="card-actions">${m ? `<a class="card-cta" href="${R}carte/?focus=${l.id}">${icon('map')}Voir sur la carte</a>` : `<span class="card-cta card-cta--off">${icon('question')}Position non vérifiée</span>`}${l.enc ? `<a class="card-cta" href="${R}encyclopedie/${l.enc}/">${icon('book')}Fiche</a>` : ''}<button class="card-cta fav fav--mini" type="button" data-fav='${esc(JSON.stringify({ id: l.id, type: 'lieu', t: l.nom, u: m ? `carte/?focus=${l.id}` : `lieux/#${l.id}`, i: l.icon, c: color }))}' aria-pressed="false" aria-label="Favori : ${esc(l.nom)}">${icon('heart')}</button></span>
  </article>`;
  };
  const body = `<section class="wrap section" data-list>
  <h1 class="h1">Tu cherches quel endroit ?</h1>
  ${fieldFilter('Nom du lieu')}
  <div class="doors doors--4" role="group" aria-label="Type de lieu" data-filter="cat">
    ${cats.map((c) => `<button class="door" type="button" data-value="${c.id}" aria-pressed="false" style="--c:${c.color}"><span class="door-ico">${icon(c.icon)}</span><span>${esc(c.nom)}</span><small>${LIEUX.filter((l) => l.type === c.id).length}</small></button>`).join('')}
  </div>
  <div class="filterbar">
    ${chipGroup('zone', 'Région', regsUsed.map((z) => ({ v: z, n: REG[z].nom })), { all: 'Toutes régions' })}
    ${chipGroup('ver', 'Fiabilité', [{ v: 'oui', n: 'Vérifié' }, { v: 'non', n: 'À vérifier' }], { all: 'Tout' })}
    <button class="chip chip--toggle" type="button" data-toggle="map" aria-pressed="false">${icon('map')}Sur la carte</button>
  </div>
  <p class="count-line" data-count></p>
  <div class="grid" data-items>${LIEUX.map(tileL).join('')}</div>
  ${emptyState('Aucun lieu ne correspond. Essaie un autre mot.', R)}
  ${moreBtn}
  <a class="btn btn--wide" href="${R}carte/">${icon('map')}Ouvrir la carte</a>
</section>`;
  emit(p, layout({ p, title: 'Lieux GTA 6 : régions, quartiers et points d\u2019intérêt', desc: 'Retrouvez les lieux de GTA 6 par région et par type, avec les informations de localisation disponibles.', body, cls: 'p-list', crumbs: [['Accueil', ''], ['Lieux', 'lieux/']] }));
}

// ---------- ENCYCLOPEDIE ----------
{
  const p = 'encyclopedie/', R = R_(p);
  const cats = site.categories.encyclopedie;
  const card = (e) => {
    const c = cat('encyclopedie', e.cat);
    return `<a class="card card--row" href="${R}encyclopedie/${e.slug}/" style="--c:${c.color}" data-cat="${e.cat}" data-ver="${e.statut}" data-alpha="${esc(norm(e.nom))}" data-text="${esc(norm([e.nom, e.bref, c.nom].join(' ')))}"><span class="card-ico">${icon(e.icon)}</span><span class="card-body"><b class="card-title">${esc(e.nom)}</b><span class="card-desc">${esc(e.bref)}</span></span>${badge(e.statut)}${icon('arrow-right', 'go')}</a>`;
  };
  const body = `<section class="wrap section" data-list data-require-filter>
  <h1 class="h1">Que veux-tu comprendre ?</h1>
  ${fieldFilter('Chercher une information')}
  <div class="doors doors--6" role="group" aria-label="Catégorie" data-filter="cat">
    ${cats.map((c) => `<button class="door door--big" type="button" data-value="${c.id}" aria-pressed="false" style="--c:${c.color}"><span class="door-ico">${icon(c.icon)}</span><span>${esc(c.nom)}</span><small>${ENC.filter((e) => e.cat === c.id).length}</small></button>`).join('')}
  </div>
  <div class="filterbar" data-after-filter hidden>
    ${chipGroup('ver', 'Fiabilité', [{ v: 'confirme', n: 'Confirmé' }, { v: 'a-verifier', n: 'À vérifier' }, { v: 'provisoire', n: 'Provisoire' }], { all: 'Tout' })}
    <label class="sort">${icon('sliders')}<select data-sort aria-label="Trier"><option value="alpha">A → Z</option><option value="">Par défaut</option></select></label>
  </div>
  <p class="count-line" data-count></p>
  <div class="list" data-items>${ENC.map(card).join('')}</div>
  ${emptyState('Rien trouvé. Essaie un autre mot.', R)}
  ${moreBtn}
</section>`;
  emit(p, layout({ p, title: 'Encyclopédie GTA 6 : personnages, lieux et gameplay', desc: 'Une encyclopédie GTA 6 claire pour comprendre les personnages, le monde du jeu et ses mécanismes.', body, cls: 'p-list', crumbs: [['Accueil', ''], ['Encyclopédie', 'encyclopedie/']] }));
}
for (const e of ENC) {
  const p = `encyclopedie/${e.slug}/`, R = R_(p);
  const c = cat('encyclopedie', e.cat);
  const lieu = e.lieu && onMap(e.lieu);
  const guides = e.liens.filter((s) => A[s] || V[s]);
  const fiches = e.liens.filter((s) => !A[s] && !V[s]);
  const body = `<article class="wrap fiche" style="--c:${c.color}">
  <header class="fiche-head" data-reveal-group>
    <div class="fiche-ico">${icon(e.icon, 'ic-xl')}</div>
    <div class="fiche-tags"><a class="pill pill--cat" href="${R}encyclopedie/?cat=${e.cat}">${icon(c.icon)}${esc(c.nom)}</a>${badge(e.statut)}</div>
    <h1 class="h1 h1--fiche">${esc(e.nom)}</h1>
  </header>
  ${lieu && vign(e.lieu, R) ? `<a class="map-banner" href="${R}carte/?focus=${e.lieu}" style="--img:url(${vign(e.lieu, R)});--c:${c.color}"><i></i><span>${icon('map')}${esc(e.nom)} sur la carte</span><small>Carte communautaire GTADB</small></a>` : ''}
  <section class="answer"><span class="answer-k">${icon('info')}En bref</span><p>${esc(e.bref)}</p></section>
  <div class="actions">
    ${lieu ? `<a class="btn btn--primary" href="${R}carte/?focus=${e.lieu}">${icon('map')}Voir sur la carte</a>` : ''}
    ${guides.length ? `<a class="btn${lieu ? '' : ' btn--primary'}" href="#guides">${icon('bolt')}Voir les guides liés</a>` : ''}
    <a class="btn btn--ghost" href="${R}encyclopedie/?cat=${e.cat}">${icon('arrow-left')}Retour à la catégorie</a>
  </div>
  <div class="split">
    <section class="known"><h2 class="h3">${icon('check')}Ce qu'on sait</h2><ul>${e.sait.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>
    <section class="unknown"><h2 class="h3">${icon('question')}Ce qui reste incertain</h2><ul>${e.incertain.map((s) => `<li>${esc(s)}</li>`).join('') || '<li>Rien de notable.</li>'}</ul></section>
  </div>
  ${guides.length ? `<section class="related" id="guides"><h2 class="h3">${icon('bolt')}Guides liés</h2><div class="minis">${guides.map((s) => relCard(s, R)).join('')}</div></section>` : ''}
  ${fiches.length ? `<section class="related"><h2 class="h3">${icon('link')}Liens utiles</h2><div class="minis">${fiches.map((s) => relCard(s, R)).join('')}</div></section>` : ''}
  ${sourcesBlock(e.sources)}
</article>`;
  emit(p, layout({ p, title: `${e.nom} dans GTA 6 : informations et guide`, desc: `Informations claires sur ${e.nom} dans GTA 6, avec sources et distinction entre faits confirmés et hypothèses.`, body, cls: 'p-fiche', ogType: 'article', crumbs: [['Accueil', ''], ['Encyclopédie', 'encyclopedie/'], [c.nom, `encyclopedie/?cat=${e.cat}`], [e.nom, p]], schema: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `${e.nom} dans GTA 6`, description: e.bref, inLanguage: 'fr', dateModified: site.majLe, about: { '@type': 'VideoGame', name: 'Grand Theft Auto VI' } }] }));
}

// ---------- ACTUALITES ----------
const actuCat = (a) => (a.statut === 'officiel' ? 'officiel' : a.statut === 'maj' ? 'maj' : 'a-verifier');
{
  const p = 'actualites/', R = R_(p);
  const recentLimit = '2026-01-01';
  const card = (a) => {
    const off = a.statut === 'officiel';
    const src = SRC[a.sources[0]];
    return `<article class="card card--news" data-cat="${actuCat(a)}" data-age="${a.date >= recentLimit ? 'recent' : 'archive'}" data-text="${esc(norm(a.titre + ' ' + a.bref))}" style="--c:${off ? '#3ddc84' : '#ffd23f'}">
    <div class="news-top"><time datetime="${a.date}">${icon('clock')}${fmtDate(a.date)}</time><span class="badge ${off ? 'b-confirme' : 'b-a-verifier'}">${icon(off ? 'badge' : 'question')}${off ? 'Officiel' : 'À vérifier'}</span>${src ? `<span class="pill">${icon('shield')}${esc(src.n.replace(' (officiel)', ''))}</span>` : ''}</div>
    <h2 class="card-title"><a href="${R}actualites/${a.slug}/">${esc(a.titre)}</a></h2>
    <details class="t30"><summary>${icon('bolt')}Comprendre en 30 s</summary><p>${esc(a.bref)}</p><p><b>Ce qui change :</b> ${esc(a.change)}</p><a class="card-cta" href="${R}actualites/${a.slug}/">Lire l'essentiel ${icon('arrow-right')}</a></details>
  </article>`;
  };
  const body = `<section class="wrap section" data-list data-page-size="3">
  <h1 class="h1">Quoi de neuf sur GTA 6 ?</h1>
  <div class="doors doors--3" role="group" aria-label="Statut" data-filter="cat">
    ${site.categories.actualites.map((c) => `<button class="door" type="button" data-value="${c.id}" aria-pressed="false" style="--c:${c.color}"><span class="door-ico">${icon(c.icon)}</span><span>${esc(c.nom)}</span><small>${ACTUS.filter((a) => actuCat(a) === c.id).length}</small></button>`).join('')}
  </div>
  <div class="filterbar">${chipGroup('age', 'Date', [{ v: 'recent', n: 'Récent' }, { v: 'archive', n: 'Archive' }], { all: 'Toutes dates' })}</div>
  <div class="list" data-items>${ACTUS.map(card).join('')}</div>
  ${emptyState('Aucune nouvelle annonce officielle', R)}
  ${moreBtn}
</section>`;
  emit(p, layout({ p, title: 'Actualités GTA 6 : annonces officielles et informations vérifiées', desc: 'Suivez les actualités GTA 6 avec des résumés courts, des dates et des liens vers les annonces officielles.', body, cls: 'p-list', crumbs: [['Accueil', ''], ['Actualités', 'actualites/']] }));
}
for (const a of ACTUS) {
  const p = `actualites/${a.slug}/`, R = R_(p);
  const off = a.statut === 'officiel';
  const src = SRC[a.sources[0]];
  const similar = ACTUS.filter((x) => x.slug !== a.slug && x.theme === a.theme).slice(0, 2);
  const body = `<article class="wrap fiche" style="--c:${off ? '#3ddc84' : '#ffd23f'}">
  <header class="fiche-head" data-reveal-group>
    <div class="fiche-tags"><time class="pill" datetime="${a.date}">${icon('clock')}${fmtDate(a.date)}</time><span class="badge ${off ? 'b-confirme' : 'b-a-verifier'}">${icon(off ? 'badge' : 'question')}${off ? 'Officiel' : 'À vérifier'}</span>${src ? `<a class="pill" href="${src.u}" rel="nofollow noopener" target="_blank">${icon('shield')}${esc(src.n)}</a>` : ''}</div>
    <h1 class="h1 h1--fiche">${esc(a.titre)}</h1>
  </header>
  <section class="answer"><span class="answer-k">${icon('bolt')}En bref</span><p>${esc(a.bref)}</p></section>
  <div class="actions">
    ${src ? `<a class="btn btn--primary" href="${src.u}" rel="nofollow noopener" target="_blank">${icon('share')}Voir la source</a>` : ''}
    ${a.liens.length ? `<a class="btn" href="#guides">${icon('bolt')}Guides associés</a>` : ''}
    <a class="btn btn--ghost" href="${R}actualites/">${icon('arrow-left')}Toutes les actualités</a>
  </div>
  <div class="split">
    <section class="known"><h2 class="h3">${icon('badge')}Ce qui a été annoncé</h2><ul>${a.annonce.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>
    <section class="known known--alt"><h2 class="h3">${icon('refresh')}Ce que cela change</h2><p>${esc(a.change)}</p></section>
    ${a.inconnu.length ? `<section class="unknown"><h2 class="h3">${icon('question')}Ce qui reste inconnu</h2><ul>${a.inconnu.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>` : ''}
  </div>
  ${a.liens.length ? `<section class="related" id="guides"><h2 class="h3">${icon('bolt')}Guides associés</h2><div class="minis">${a.liens.map((s) => relCard(s, R)).join('')}</div></section>` : ''}
  ${similar.length ? `<section class="related"><h2 class="h3">${icon('news')}Sur le même thème</h2><div class="minis">${similar.map((s) => relCard(s.slug, R)).join('')}</div></section>` : ''}
  ${src ? `<p class="muted small">${icon('shield')}Source : <a href="${src.u}" rel="nofollow noopener" target="_blank">${esc(src.u)}</a> — information du ${fmtDate(a.date)}.</p>` : ''}
</article>`;
  emit(p, layout({ p, title: `${a.titre} — GTA 6 : l'essentiel en bref`, desc: `Résumé clair : ${a.bref}`.slice(0, 158), body, cls: 'p-fiche', ogType: 'article', crumbs: [['Accueil', ''], ['Actualités', 'actualites/'], [a.titre, p]], schema: [{ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.titre, datePublished: a.date, dateModified: site.majLe, description: a.bref, inLanguage: 'fr', isBasedOn: src ? src.u : undefined }] }));
}

// ---------- FAVORIS ----------
{
  const p = 'favoris/', R = R_(p);
  const body = `<section class="wrap section" data-favs>
  <h1 class="h1">Mes favoris</h1>
  <p class="lead">Retrouve ce que tu as enregistré.</p>
  <div class="doors doors--3" role="group" aria-label="Type" data-fav-filter>
    <button class="door" type="button" data-value="astuce" aria-pressed="false" style="--c:#ff2d87"><span class="door-ico">${icon('bolt')}</span><span>Astuces</span><small data-fc="astuce">0</small></button>
    <button class="door" type="button" data-value="vehicule" aria-pressed="false" style="--c:#ff9a1f"><span class="door-ico">${icon('car')}</span><span>Véhicules</span><small data-fc="vehicule">0</small></button>
    <button class="door" type="button" data-value="lieu" aria-pressed="false" style="--c:#19d3e3"><span class="door-ico">${icon('pin')}</span><span>Lieux</span><small data-fc="lieu">0</small></button>
  </div>
  <div class="filterbar"><label class="sort">${icon('sliders')}<select data-fav-sort aria-label="Trier"><option value="recent">Récent</option><option value="alpha">A → Z</option></select></label></div>
  <div class="list" data-fav-list></div>
  <div class="empty" data-fav-empty hidden>${icon('heart', 'ic-xl')}<p>Rien ici pour le moment</p><a class="btn btn--primary" href="${R}astuces/">${icon('bolt')}Explorer les astuces</a></div>
</section>`;
  emit(p, layout({ p, title: `Mes favoris | ${M}`, desc: 'Retrouvez vos guides et véhicules favoris.', body, noindex: true, cls: 'p-favs' }));
}

// ---------- COMPTE ----------
{
  const p = 'compte/', R = R_(p);
  const body = `<section class="wrap section" data-account data-total="${ASTUCES.length}">
  <h1 class="h1">Mon espace</h1>
  <p class="lead">Retrouve tes repères.</p>
  <div class="acc-login">
    <button class="btn" type="button" disabled>${icon('user')}Me connecter <small>bientôt</small></button>
    <button class="btn" type="button" disabled>${icon('plus')}Créer un compte <small>bientôt</small></button>
    <span class="btn btn--primary btn--static">${icon('check')}Tu continues sans compte</span>
  </div>
  <p class="note note--ok">${icon('shield')}<span>Tout reste sur ton appareil. Aucune donnée n'est envoyée, et aucun compte n'est nécessaire pour utiliser le site.</span></p>
  <div class="acc-grid">
    <a class="acc-card" href="${R}favoris/" style="--c:#ff2d87"><span class="tile-ico">${icon('heart')}</span><b>Mes favoris</b><span class="acc-big" data-acc-favs>0</span><small>enregistrés</small></a>
    <div class="acc-card" style="--c:#3ddc84"><span class="tile-ico">${icon('trophy')}</span><b>Ma progression</b><div class="ring" data-ring style="--p:0"><span data-acc-done>0</span><small>/ ${ASTUCES.length}</small></div><small>astuces marquées « fait »</small><button class="link-btn" type="button" data-reset-done>Remettre à zéro</button></div>
    <div class="acc-card acc-card--prefs" style="--c:#9b6bff"><span class="tile-ico">${icon('sliders')}</span><b>Mes préférences</b>
      <p class="sheet-l">Animations</p><div class="chips" data-pref="motion"><button class="chip" data-value="on" aria-pressed="false">Oui</button><button class="chip" data-value="off" aria-pressed="false">Réduites</button></div>
      <p class="sheet-l">Taille du texte</p><div class="chips" data-pref="size"><button class="chip" data-value="" aria-pressed="false">Normale</button><button class="chip" data-value="l" aria-pressed="false">Grande</button></div>
    </div>
  </div>
</section>`;
  emit(p, layout({ p, title: `Mon compte | ${M}`, desc: 'Accédez à vos favoris et préférences.', body, noindex: true, cls: 'p-account' }));
}

// ---------- ADMIN ----------
{
  const p = 'admin/', R = R_(p);
  const rows = [
    ...ASTUCES.map((a) => ({ type: 'Guides', t: a.titre, st: a.statut, pub: a.publie === false ? 'Brouillon' : 'Publié', u: `astuces/${a.slug}/`, src: a.sources.length })),
    ...VEHICULES.map((v) => ({ type: 'Véhicules', t: v.nom, st: v.dispo, pub: 'Publié', u: `vehicules/${v.slug}/`, src: v.sources.length })),
    ...LIEUX.map((l) => ({ type: 'Carte', t: l.nom, st: l.statut, pub: 'Publié', u: `lieux/#${l.id}`, src: l.sources.length, pos: onMap(l.id) ? l.precision : 'hors carte' })),
    ...ACTUS.map((a) => ({ type: 'Actualités', t: a.titre, st: a.statut === 'officiel' ? 'confirme' : 'a-verifier', pub: 'Publié', u: `actualites/${a.slug}/`, src: a.sources.length })),
    ...ENC.map((e) => ({ type: 'Encyclopédie', t: e.nom, st: e.statut, pub: 'Publié', u: `encyclopedie/${e.slug}/`, src: e.sources.length }))
  ];
  const drafts = rows.filter((r) => r.pub === 'Brouillon').length;
  const toCheck = rows.filter((r) => r.st !== 'confirme').length;
  const types = ['Guides', 'Véhicules', 'Carte', 'Actualités', 'Encyclopédie'];
  const tpl = JSON.stringify({ slug: 'nouveau-guide', cat: 'debuter', icon: 'bolt', titre: 'Comment … ?', court: '…', reponse: '…', etapes: ['…', '…', '…'], asavoir: '…', duree: 2, niveau: 'facile', statut: 'provisoire', publie: false, sources: [], kw: [], voir: [] }, null, 2);
  const body = `<section class="wrap section" data-list data-page-size="40">
  <h1 class="h1">Gérer le site</h1>
  <p class="note">${icon('shield')}<span>Écran privé, non indexé, en lecture seule. On modifie le contenu dans <code>data/*.json</code>. Chaque contenu est relu par une personne avant publication, en deux étapes séparées : « Vérifier », puis « Approuver ». Rien n'est publié automatiquement par une IA.</span></p>
  <div class="acc-grid acc-grid--3">
    <div class="acc-card" style="--c:#ff9a1f"><span class="tile-ico">${icon('list')}</span><b>À traiter</b><span class="acc-big">${drafts}</span><small>brouillons</small></div>
    <div class="acc-card" style="--c:#ffd23f"><span class="tile-ico">${icon('question')}</span><b>À vérifier</b><span class="acc-big">${toCheck}</span><small>contenus non confirmés</small></div>
    <div class="acc-card" style="--c:#3ddc84"><span class="tile-ico">${icon('check')}</span><b>Confirmés</b><span class="acc-big">${rows.length - toCheck}</span><small>sur ${rows.length}</small></div>
  </div>
  <details class="more"><summary>${icon('plus')}Nouveau guide</summary><p>Copie ce modèle dans <code>data/astuces.json</code>. Laisse « publie » à false tant qu'il n'est pas approuvé.</p><pre class="code">${esc(tpl)}</pre></details>
  ${fieldFilter('Texte recherché')}
  <div class="filterbar">
    ${chipGroup('cat', 'Type', types.map((t) => ({ v: norm(t), n: t })), { all: 'Tous types' })}
    ${chipGroup('ver', 'Fiabilité', [{ v: 'provisoire', n: 'Provisoire' }, { v: 'a-verifier', n: 'À vérifier' }, { v: 'confirme', n: 'Confirmé' }], { all: 'Toute fiabilité' })}
    ${chipGroup('pub', 'État', [{ v: 'publie', n: 'Publié' }, { v: 'brouillon', n: 'Brouillon' }], { all: 'Tout état' })}
  </div>
  <p class="count-line" data-count></p>
  <div class="list list--admin" data-items>${rows.map((r) => `<div class="arow" data-cat="${norm(r.type)}" data-ver="${r.st}" data-pub="${norm(r.pub)}" data-text="${esc(norm(r.t + ' ' + r.type))}"><span class="pill">${esc(r.type)}</span><a href="${R}${r.u}">${esc(r.t)}</a>${badge(r.st)}<span class="pill">${esc(r.pub)}</span><span class="muted small">${r.src} source${r.src > 1 ? 's' : ''}${r.pos ? ' · ' + esc(r.pos) : ''}</span><span class="arow-act"><button class="chip" type="button" data-admin-act="verifier">Vérifier</button><button class="chip" type="button" data-admin-act="approuver" disabled>Approuver</button></span></div>`).join('')}</div>
  ${emptyState('Aucun contenu.', R)}
  ${moreBtn}
</section>`;
  emit(p, layout({ p, title: `Administration | ${M}`, desc: 'Gestion privée des contenus.', body, noindex: true, cls: 'p-admin' }));
}

// ---------- A PROPOS ----------
{
  const p = 'a-propos/', R = R_(p);
  const allSrc = Object.values(SRC);
  const body = `<section class="wrap section fiche">
  <h1 class="h1">Comment fonctionne ce site ?</h1>
  <p class="answer"><span class="answer-k">${icon('shield')}Notre promesse</span>Des réponses courtes, des sources visibles.</p>
  <div class="actions"><a class="btn btn--primary" href="#sources">${icon('book')}Nos sources</a><a class="btn" href="#statuts">${icon('badge')}Nos statuts</a><a class="btn btn--ghost" href="#contact">${icon('mail')}Nous contacter</a></div>
  <section id="statuts" class="statuts">
    <div class="st st--ok">${badge('confirme')}<p>Vérifié et validé humainement.</p></div>
    <div class="st st--wait">${badge('a-verifier')}<p>Information non démontrée.</p></div>
    <div class="st st--part">${badge('provisoire')}<p>Information partielle.</p></div>
  </section>
  <section id="sources" class="related"><h2 class="h3">${icon('book')}Nos sources</h2><p>Les annonces officielles de Rockstar Games d'abord. Ensuite, les guides de sites spécialisés, recoupés quand c'est possible. Chaque fiche liste ses sources.</p>
  <p>La carte interactive utilise la carte communautaire <a href="https://map.gtadb.org" target="_blank" rel="noopener">« Yanis v18 — GTA VI Community Map »</a> et le catalogue de lieux de GTADB et de ses contributeurs, sous licence <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Nous l'avons recolorée, retiré sa légende et redécoupée. C'est une reconstruction de fans, approximative, et non la carte officielle de Rockstar Games.</p>
  <details class="sources"><summary>${icon('shield')}Toutes les sources (${allSrc.length})</summary><ul>${allSrc.map((s) => `<li><a href="${s.u}" rel="nofollow noopener" target="_blank">${esc(s.n)}</a></li>`).join('')}</ul></details></section>
  <section id="contact" class="related"><h2 class="h3">${icon('mail')}Nous contacter</h2><p>Une erreur, un emplacement à corriger ? <a href="https://github.com/y769d459yn-hub/gta6-ultimate-v2/issues" rel="noopener" target="_blank">Signale-le ici</a>.</p></section>
  <p class="note">${icon('info')}<span>Site indépendant, non affilié à Rockstar Games ni Take-Two. Les pictogrammes et la carte néon sont des créations du site. Les images de véhicules appartiennent à Rockstar Games : leur origine est indiquée sous chaque image.</span></p>
</section>`;
  emit(p, layout({ p, title: `À propos : méthode et fiabilité | ${M}`, desc: 'Découvrez comment les informations GTA 6 sont vérifiées et comment reconnaître les contenus confirmés.', body, cls: 'p-about', crumbs: [['Accueil', ''], ['À propos', 'a-propos/']] }));
}

// ---------- 404 ----------
{
  const body = `<section class="wrap section center"><p class="kicker">${icon('alert')}Erreur 404</p><h1 class="h1">Tu t'es perdu dans les marais.</h1><p class="lead">Cette page n'existe pas. Cherche directement :</p><button class="hero-search" type="button" data-open-search>${icon('search')}<span>Une voiture, une mission, un lieu…</span></button><div class="actions actions--center"><a class="btn btn--primary" data-home href="./">${icon('home')}Accueil</a><a class="btn" data-home-map href="./carte/">${icon('map')}Carte</a></div></section>`;
  // 404 servi à n'importe quelle profondeur : chemins absolus à partir de la base du site
  let html = layout({ p: '', title: `Page introuvable | ${M}`, desc: 'Page introuvable.', body, noindex: true, cls: 'p-404' });
  const base = new URL(site.url).pathname.replace(/\/$/, '') + '/';
  html = html.replaceAll('href="./', `href="${base}`).replaceAll('src="./', `src="${base}`).replace('data-root="./"', `data-root="${base}"`);
  emit('404.html', html);
}

// ---------- index de recherche ----------
const index = [];
const push = (o) => index.push(o);
for (const a of ASTUCES) { const c = cat('astuces', a.cat); push({ t: a.court, q: a.titre, k: norm([a.kw.join(' '), c.nom].join(' ')), d: a.reponse.slice(0, 90), u: `astuces/${a.slug}/`, i: a.icon, c: c.color, g: 'astuce', s: a.cat, l: c.nom, m: (astuceMap[a.slug] || []).length ? 1 : 0 }); }
for (const x of CATALOGUE.vehicules) { const c = cat('vehicules', x.type); push({ t: x.nom, q: x.classe, k: norm([x.nom, x.fabricant || '', x.classe, c.nom, x.inspiration || '', 'vehicule'].join(' ')), d: x.inspiration ? `Inspiré de ${x.inspiration}` : x.classe, u: `vehicules/?v=${x.slug}`, i: c.icon, c: c.color, g: 'vehicule', s: x.type, l: 'Véhicule · ' + x.classe, m: 0, f: '' }); }
for (const v of VEHICULES) { const c = cat('vehicules', v.type); const l = L[v.lieu]; push({ t: v.nom, q: v.sous, k: norm([v.kw.join(' '), c.nom, 'vehicule voiture', l ? l.nom : ''].join(' ')), d: v.emplacement.slice(0, 90), u: `vehicules/${v.slug}/`, i: c.icon, c: v.color || c.color, g: 'vehicule', s: v.type, l: 'Véhicule · ' + c.nom, m: vehOnMap(v.slug) ? 1 : 0, f: vehOnMap(v.slug) ? 'v-' + v.slug : '' }); }
for (const l of LIEUX) { const c = cat('lieux', l.type); const act = l.mapcat === 'activites'; push({ t: l.nom, q: '', k: norm([l.kw.join(' '), c.nom, act ? 'activite' : 'lieu', l.region && REG[l.region] ? REG[l.region].nom : ''].join(' ')), d: l.desc.slice(0, 90), u: onMap(l.id) ? `carte/?focus=${l.id}` : `lieux/#${l.id}`, i: l.icon, c: c.color, g: act ? 'activite' : 'lieu', s: l.type, l: act ? 'Activité' : 'Lieu · ' + c.nom, m: onMap(l.id) ? 1 : 0, f: onMap(l.id) ? l.id : '' }); }
for (const e of ENC) { const c = cat('encyclopedie', e.cat); push({ t: e.nom, q: '', k: norm([c.nom, e.cat === 'personnages' ? 'personnage perso' : ''].join(' ')), d: e.bref.slice(0, 90), u: `encyclopedie/${e.slug}/`, i: e.icon, c: c.color, g: e.cat === 'personnages' ? 'personnage' : 'ency', s: e.cat, l: 'Encyclopédie · ' + c.nom, m: 0 }); }
for (const a of ACTUS) push({ t: a.titre, q: '', k: norm('actualite news info ' + a.theme), d: fmtDate(a.date), u: `actualites/${a.slug}/`, i: 'news', c: '#3ddc84', g: 'actu', s: a.theme, l: 'Actu', m: 0 });
for (const f of features.filter((f) => f.properties.service)) { const p = f.properties; push({ t: p.nom, q: p.service, k: norm(`${p.service} service carte ${p.desc}`), d: p.desc.slice(0, 90), u: `carte/?focus=${p.id}`, i: p.icon, c: '#ffd23f', g: 'lieu', s: 'service', l: 'Point utile · ' + p.service, m: 1, f: p.id }); }
push({ t: 'Carte interactive', q: 'map', k: 'carte map plan leonida', d: 'Tous les repères', u: 'carte/', i: 'map', c: '#19d3e3', g: 'page', s: '', l: 'Page', m: 0 });
push({ t: 'Mes favoris', q: '', k: 'favoris coeur enregistre', d: '', u: 'favoris/', i: 'heart', c: '#ff2d87', g: 'page', s: '', l: 'Page', m: 0 });

const syn = Object.entries(site.synonymes).map(([k, vs]) => [norm(k), ...vs.map(norm)]);
const popular = ['semer-la-police', 'argent-debut', 'sauvegarder', 'voyage-rapide', 'entrer-code-triche', 'voiture-rare'].map((s) => ({ t: A[s].court, u: `astuces/${s}/`, i: A[s].icon, c: cat('astuces', A[s].cat).color }));

// ---------- écriture ----------
fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
for (const { p, html } of pages) write(p.endsWith('.html') ? p : p + 'index.html', html);
write('data/index.json', JSON.stringify({ items: index, syn, popular }));
const ATTRIBUTION = { carte: TUILES.source, lieux: { nom: 'GTA VI Landmarks Data', diffuseur: 'GTADB', url: 'https://map.gtadb.org', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', modifications: 'Filtrage des lieux nommés et positionnés, champs raccourcis.' } };
write('data/carte.json', JSON.stringify({
  type: 'FeatureCollection', version: 2, info: CARTE.info, attribution: ATTRIBUTION,
  tuiles: { tileSize: TUILES.tileSize, monde: TUILES.monde, zero: TUILES.zero, fond: TUILES.fond, niveaux: TUILES.niveaux },
  bornes: CARTE.bornes, vueInitiale: CARTE.vueInitiale,
  regions: CARTE.regions.map((r) => ({ ...r, label: POS[r.id] })),
  categories: site.categories.carte,
  sousTypes: { vehicules: site.categories.vehicules.map(({ id, nom }) => ({ id, nom })), lieux: site.categories.lieux.map(({ id, nom }) => ({ id, nom })), activites: LIEUX.filter((l) => l.mapcat === 'activites' && onMap(l.id)).map((l) => ({ id: l.id, nom: l.nom })) },
  features
}));
write('data/communaute.json', JSON.stringify({ version: 1, attribution: ATTRIBUTION.lieux, champs: { i: 'identifiant GTADB', n: 'nom', z: 'quartier / zone', x: 'x monde', y: 'y monde', c: 'catégorie', d: '1 = douteux' }, categories: COMMU_CATS.map(({ id, nom }) => ({ id, nom })), lieux: communaute }));
for (const f of fs.readdirSync(path.join(ROOT, 'src'), { recursive: true })) {
  const full = path.join(ROOT, 'src', f);
  if (!fs.statSync(full).isFile()) continue;
  if (!VUE_3D && (f === 'vehicule3d.js' || f === 'v3d-init.js' || f.startsWith('rendus' + path.sep) || f.startsWith('modeles' + path.sep))) continue;
  write(f.startsWith('tiles' + path.sep) || f.startsWith('vignettes' + path.sep) || f.startsWith('photos' + path.sep) || f.startsWith('rendus' + path.sep) || f.startsWith('modeles' + path.sep) || f.startsWith('catalogue' + path.sep) ? f : path.join('assets', path.basename(f)), fs.readFileSync(full));
}
// icônes pour le JS client : injectées en tête de app.js
const appJs = path.join(OUT, 'assets', 'app.js');
fs.writeFileSync(appJs, `window.LG_ICONS=${JSON.stringify(Object.fromEntries(Object.entries(iconDefs).map(([n, d]) => [n, d[1]])))};\n` + fs.readFileSync(appJs, 'utf8'));

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset=".55" stop-color="#ff2d87"/><stop offset="1" stop-color="#8a3ffc"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#140a22"/><circle cx="32" cy="30" r="18" fill="url(#g)"/><path d="M14 36h36M16 41h32M20 46h24" stroke="#140a22" stroke-width="3"/></svg>`;
write('favicon.svg', favicon);
write('manifest.webmanifest', JSON.stringify({ name: M, short_name: 'Leonida', start_url: './', display: 'standalone', background_color: '#140a22', theme_color: '#140a22', icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }));
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /compte/\nDisallow: /favoris/\nSitemap: ${site.url}/sitemap.xml\n`);
const indexable = pages.filter(({ p, html }) => !p.endsWith('.html') && !html.includes('noindex'));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map(({ p }) => `<url><loc>${site.url}/${p}</loc><lastmod>${site.majLe}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('.nojekyll', '');

console.log(`✓ ${pages.length} pages · ${index.length} entrées de recherche · ${features.length} repères carte → docs/`);
