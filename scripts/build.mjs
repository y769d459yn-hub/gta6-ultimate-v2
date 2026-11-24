// Générateur statique : data/*.json + src/ → docs/ (GitHub Pages)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { icon, iconDefs } from './icons.mjs';
import { validate } from './validate.mjs';
import { silhouette } from './silhouettes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');
const lireBrut = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

// ---------- contenu écrit depuis l'administration (data-admin/contenu.json, récupéré de Supabase avant le build) ----------
// fichier → [nom de la collection, champ qui contient la liste (ou null), clé unique, champ titre]
const COLLECTIONS = {
  'actualites.json': ['actualites', null, 'slug', 'titre'], 'astuces.json': ['astuces', null, 'slug', 'titre'],
  'codes.json': ['codes', 'codes', 'id', 'nom'], 'missions.json': ['missions', 'missions', 'id', 'nom'],
  'dossiers.json': ['dossiers', 'dossiers', 'slug', 'titre'], 'encyclopedie.json': ['encyclopedie', null, 'slug', 'nom'],
  'lieux.json': ['lieux', null, 'id', 'nom'], 'vehicules.json': ['vehicules', null, 'slug', 'nom']
};
const ADMIN_F = path.join(ROOT, 'data-admin', 'contenu.json');
const ADMIN_ROWS = fs.existsSync(ADMIN_F) ? JSON.parse(fs.readFileSync(ADMIN_F, 'utf8')) : [];
const ORIGINAUX = {}; // données d'origine (avant l'administration) pour l'écran admin
let ADMIN_APPLIQUES = 0;
const vide = (v) => (Array.isArray(v) ? [] : typeof v === 'string' ? '' : typeof v === 'number' ? 0 : typeof v === 'boolean' ? false : v && typeof v === 'object' ? {} : v);
function appliquerAdmin(f, data) {
  const c = COLLECTIONS[f]; if (!c) return data;
  const [nom, champ, cle] = c;
  const liste = champ ? data[champ] : data;
  ORIGINAUX[nom] = JSON.parse(JSON.stringify(liste));
  const types = {}; liste.forEach((x) => Object.entries(x).forEach(([k, v]) => { if (!(k in types)) types[k] = v; }));
  const communs = Object.keys(types).filter((k) => liste.every((x) => k in x));
  for (const r of ADMIN_ROWS.filter((x) => x.collection === nom)) {
    const i = liste.findIndex((x) => String(x[cle]) === r.cle);
    if (r.supprime) { if (i >= 0) { liste.splice(i, 1); ADMIN_APPLIQUES++; } continue; }
    const n = { ...(i >= 0 ? liste[i] : Object.fromEntries(communs.map((k) => [k, vide(types[k])]))), ...(r.donnees || {}) };
    n[cle] = typeof types[cle] === 'number' ? Number(r.cle) : r.cle;
    // chaque champ garde le type attendu par le site (texte, liste, nombre, oui/non)
    for (const [k, t] of Object.entries(types)) {
      if (!(k in n)) continue;
      const v = n[k];
      if (Array.isArray(t) && !Array.isArray(v)) n[k] = typeof v === 'string' ? v.split('\n').map((x) => x.trim()).filter(Boolean) : [];
      else if (typeof t === 'string' && typeof v !== 'string') n[k] = v == null ? '' : String(v);
      else if (typeof t === 'number' && typeof v !== 'number') n[k] = Number(v) || 0;
      else if (typeof t === 'boolean' && typeof v !== 'boolean') n[k] = !!v;
    }
    if (i >= 0) liste[i] = n; else liste.push(n);
    ADMIN_APPLIQUES++;
  }
  return data;
}
const read = (f) => appliquerAdmin(f, lireBrut(f));

const site = read('site.json');
const SRC = read('sources.json');
const ASTUCES = read('astuces.json');
const VEHICULES = read('vehicules.json');
// Catalogue complet (GTABase + gta6guide.fr, tools/catalogue.py) : véhicules sans fiche détaillée + infos des fiches
// Vérification de présence dans GTA 6 (tools/verification.py : site officiel, GTA Wiki, GTABase, gta6guide.fr)
const VERIF = fs.existsSync(path.join(ROOT, 'data', 'verification.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'verification.json'), 'utf8')).vehicules : {};
const verifTexte = (s) => { const v = VERIF[s]; if (!v) return ''; return v.statut === 'confirme' ? (v.preuves.length ? `Confirmé par ${v.preuves.join(' et ')}` : 'Type de véhicule confirmé') : v.statut === 'non-confirme' ? 'Non confirmé' : 'À confirmer : vu seulement sur GTABase ou gta6guide.fr'; };
const MISSIONS = fs.existsSync(path.join(ROOT, 'data', 'missions.json')) ? read('missions.json') : { chapitres: [], missions: [] };
const CODES = fs.existsSync(path.join(ROOT, 'data', 'codes.json')) ? read('codes.json') : { categories: [], codes: [] };
// on n'affiche que les codes dont la combinaison est connue
CODES.codes = CODES.codes.filter((c) => c.sequence.length);
CODES.categories = CODES.categories.filter((k) => CODES.codes.some((c) => c.cat === k.id));
const CAT_CARTE = fs.existsSync(path.join(ROOT, 'data', 'catalogue-carte.json')) ? read('catalogue-carte.json') : {};
const CATALOGUE = fs.existsSync(path.join(ROOT, 'data', 'catalogue.json')) ? read('catalogue.json') : { vehicules: [], fiches: {} };
// inspirations des véhicules (relevées en anglais) → français
const INSP = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'traductions', 'inspirations.json'), 'utf8'));
const ORD = { '1st': '1re', First: '1re', first: '1re', '2nd': '2e', Second: '2e', second: '2e', '3rd': '3e', Third: '3e', '4th': '4e', Fourth: '4e', '5th': '5e', Fifth: '5e', '6th': '6e', Sixth: '6e', '7th': '7e', Seventh: '7e', seventh: '7e', '10th': '10e' };
const frInsp = (s) => {
  if (!s) return s;
  if (INSP[s]) return INSP[s];
  return s
    .replace(/\((\d+(?:st|nd|rd|th)|First|Second)[- ](?:Gen|gen|generation|Generation)\)/g, (_, o) => `(${ORD[o]} génération)`)
    .replace(/\b(\d+(?:st|nd|rd|th)) (?:Gen|gen)$/, (_, o) => `(${ORD[o]} génération)`)
    .replace(/\bGen VI$/, '(6e génération)')
    .replace(/^(First|Second|Fourth|Fifth|Sixth|1st|2nd)[- ](?:generation|Generation|gen) (.+?)( \(.+\))?$/, (_, o, m, x) => `${m}${x || ''} (${ORD[o]} génération)`.replace(/\) \(/, ', '))
    .replace(/ Series\b/g, ' série').replace(/^(.+) série$/, 'série $1').replace(/^Tesla Model S$/, 'Tesla Model S').replace(/^Stearman Model 75$/, 'Stearman Model 75');
};
for (const v of CATALOGUE.vehicules) v.inspiration = frInsp(v.inspiration);
for (const f of Object.values(CATALOGUE.fiches)) if (f.inspiration) f.inspiration = frInsp(f.inspiration);
const LIEUX = read('lieux.json');
const ENC = read('encyclopedie.json');
const ACTUS = read('actualites.json').sort((a, b) => b.date.localeCompare(a.date));
// date de mise à jour affichée (pied de page, plan du site) : la plus récente entre site.json, les actualités et l'administration
site.majLe = [site.majLe, ...ACTUS.map((x) => x.date), ...ADMIN_ROWS.map((r) => String(r.maj || '').slice(0, 10))].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= new Date().toISOString().slice(0, 10)).sort().pop();
const CARTE = read('carte.json');
const M = site.marque;
const ACCUEIL = read('accueil.json');
const DOSSIERS = fs.existsSync(path.join(ROOT, 'data', 'dossiers.json')) ? read('dossiers.json').dossiers : [];
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
// titre SEO : le premier choix de 62 caractères ou moins (Google coupe vers 60-65)
function titreSEO(...choix) { const l = choix.filter(Boolean); return l.find((t) => t.length <= 62) || l[l.length - 1]; }
// description : phrases réelles, coupées à un mot entier sous 158 caractères
function descSEO(...morceaux) {
  const t = morceaux.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (t.length <= 158) return t;
  const c = t.slice(0, 155); return c.slice(0, c.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
}
// largeur et hauteur d'une image WebP (évite les sauts de mise en page sur iPhone)
const DIMS = {};
function dimImg(rel) {
  if (rel in DIMS) return DIMS[rel];
  let d = null;
  try {
    const b = fs.readFileSync(path.join(ROOT, 'src', rel));
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const t = b.toString('ascii', 12, 16);
      if (t === 'VP8 ') d = [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      else if (t === 'VP8L') { const n = b.readUInt32LE(21); d = [(n & 0x3fff) + 1, ((n >>> 14) & 0x3fff) + 1]; }
      else if (t === 'VP8X') d = [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    }
  } catch (e) { /* image absente */ }
  return (DIMS[rel] = d);
}
const wh = (rel) => { const d = dimImg(rel); return d ? ` width="${d[0]}" height="${d[1]}"` : ''; };

function ref(slug) {
  if (A[slug]) { const c = cat('astuces', A[slug].cat); return { t: A[slug].court, u: `astuces/${slug}/`, i: A[slug].icon, c: c.color, k: 'Astuce' }; }
  if (V[slug]) { const c = cat('vehicules', V[slug].type); return { t: V[slug].nom, u: `vehicules/${slug}/`, i: c.icon, c: c.color, k: 'Véhicule' }; }
  if (E[slug]) { const c = cat('encyclopedie', E[slug].cat); return { t: E[slug].nom, u: `encyclopedie/${slug}/`, i: E[slug].icon, c: c.color, k: c.nom }; }
  if (N[slug]) return { t: N[slug].titre, u: `actualites/${slug}/`, i: 'news', c: '#19d3e3', k: 'Actu' };
  const D = slug.startsWith('dossier:') && DOSSIERS.find((d) => d.slug === slug.slice(8));
  if (D) return { t: D.court, u: `dossiers/${D.slug}/`, i: D.icon, c: D.couleur, k: 'Dossier complet' };
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
const rendu = (v, R) => (RENDUS.has(v.slug) ? `<img class="veh-photo veh-rendu" src="${R}rendus/${v.slug}.webp" alt="${esc(v.nom)} en 3D"${wh('rendus/' + v.slug + '.webp')} loading="lazy" decoding="async">` : '');
const photoJeu = (v, R, extra = '') => `<img class="veh-photo${extra}" src="${R}photos/${PHOTOS[v.slug].fichier}" alt="${esc(v.nom)}${PHOTOS[v.slug].note ? ' — ' + esc(PHOTOS[v.slug].note) : ''}"${wh('photos/' + PHOTOS[v.slug].fichier)} loading="lazy" decoding="async">`;
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
  const url = `lieux/${l.id}/`;
  features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: pos }, properties: { id: l.id, nom: l.nom, cat: mc, sous: mc === 'lieux' ? l.type : mc === 'activites' ? l.id : 'service', region: l.type === 'region' ? l.id : l.region, statut: l.statut, precision, icon: l.icon, desc: l.desc, url, acces: l.acces, service: l.service, tip: l.astuce ? tipAstuce(l.astuce) : undefined, ...(l.type === 'region' ? { label: true } : {}) } });
}
for (const v of VEHICULES) {
  const l = v.lieu && L[v.lieu];
  if (!l) continue;
  const pos = v.gtadb ? gtadbCentre(v.gtadb) : autour(l.id, l.type === 'region' ? 420 : 110);
  if (!pos) continue;
  const precision = l.type === 'region' ? 'region' : 'zone';
  features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: pos }, properties: { id: 'v-' + v.slug, nom: v.nom, cat: 'vehicules', sous: v.type, region: l.type === 'region' ? l.id : l.region, statut: v.dispo, precision, icon: cat('vehicules', v.type).icon, desc: v.emplacement, url: `vehicules/${v.slug}/`, lieuNom: l.nom, ...(PHOTOS[v.slug] ? { img: `photos/${PHOTOS[v.slug].fichier}`, imgNote: PHOTOS[v.slug].note || undefined, imgCredit: PHOTOS[v.slug].credit || undefined } : RENDUS.has(v.slug) ? { img: `rendus/${v.slug}.webp`, imgNote: MODELES[v.slug] && MODELES[v.slug].indicatif ? 'Modèle 3D indicatif' : 'Modèle 3D', imgCredit: undefined, img3d: true } : {}), tip: { type: `Véhicule · ${cat('vehicules', v.type).nom.toLowerCase()}`, titre: `Comment obtenir : ${v.nom} ?`, reponse: v.emplacement, etapes: v.obtenir.slice(0, 3), lien: `vehicules/${v.slug}/`, libelle: 'Voir la fiche du véhicule' } } });
}
// Commerces, armes, argent et services repérés par la communauté GTADB : par étiquette « # » ou par le nom
// [libellé, icône, catégorie de la carte, astuce liée]
const SERVICES = {
  '#guns': ['Armurerie', 'gun', 'armes', 'acheter-silencieux'], '#fence': ['Receleur', 'money', 'argent', 'ou-vendre-butin'],
  '#modshop': ['Garage auto', 'spray', 'services', 'personnaliser-voiture'], "#pay'n'spray": ["Pay 'n' Spray", 'spray', 'services', 'pay-n-spray'],
  '#hospital': ['Hôpital', 'heart', 'services', 'se-soigner'], '#police': ['Police', 'badge', 'services', 'semer-la-police'],
  '#marina': ['Marina', 'anchor', 'services', 'activites-eau'], '#airport': ['Aéroport', 'plane', 'services', 'premier-avion'],
  '#gym': ['Salle de sport', 'trophy', 'services', 'augmenter-stats'], '#safehouse': ['Planque', 'home', 'services', 'planques'],
  '#carwash': ['Station de lavage', 'spray', 'services', null],
  '#supermarket': ['Épicerie', 'chest', 'commerces', 'se-soigner'], '#gas': ['Station-service', 'bolt', 'commerces', 'essence'],
  '#hair': ['Coiffeur', 'user', 'commerces', 'changer-de-look'], '#tattoos': ['Tatoueur', 'spray', 'commerces', 'changer-de-look'],
  '#clothes': ['Vêtements', 'user', 'commerces', 'changer-de-look'], '#shoes': ['Vêtements', 'user', 'commerces', 'changer-de-look'],
  '#liquor': ["Magasin d'alcool", 'chest', 'commerces', 'braquer-magasin'], '#pharmacy': ['Pharmacie', 'heart', 'commerces', 'se-soigner'],
  '#electronics': ['Électronique', 'phone', 'commerces', null], '#bikeshop': ['Vélos', 'moto', 'commerces', null],
  '#fastfood': ['Restauration', 'chest', 'commerces', null], '#food': ['Restauration', 'chest', 'commerces', null], '#bar': ['Bar', 'music', 'commerces', null],
  '#nightclub': ['Boîte de nuit', 'music', 'commerces', null], '#stripclub': ['Club', 'music', 'commerces', null]
};
// quand l'étiquette manque : le nom suffit (marques du jeu)
const NOMS = [
  [/^(phil's )?ammu-nation|^pawn & gun/i, '#guns'], [/^fleeca$|^lombank$/i, ['Banque', 'bank', 'argent', 'braquer-magasin']],
  [/jewel/i, ['Bijouterie', 'diamond', 'argent', 'braquer-bijouteries']], [/pawn/i, '#fence'],
  [/gas station$|^xero$|^arrow$/i, '#gas'], [/^24\/7|supermarket/i, '#supermarket'], [/pharmacy/i, '#pharmacy'],
  [/barber|salon$/i, '#hair'], [/tattoo/i, '#tattoos'], [/^binco$|clothing/i, '#clothes'], [/liquor/i, '#liquor'],
  [/^bean machine$|^burger shot$|^peewees$|^cluckin/i, '#food'], [/hospital/i, '#hospital'],
  [/police department|sheriff/i, '#police'], [/^fire station$/i, ['Pompiers', 'siren', 'services', null]],
  [/customs/i, '#modshop'], [/dealership/i, ['Concessionnaire', 'car', 'vehicules', 'voitures-gratuites']], [/^ajax gym$|^gym$/i, '#gym']
];
// lieux remarquables à découvrir (monuments, panneaux, curiosités)
const CURIOSITE = /lighthouse|oceanarium|casino|stadium|museum|golf club|mall$|raceway|speedway|submerged|wonder whale|sculpture|sign$|overkeel|ferris|tower$|mural/i;
const proches = [];
const NB_NOMS = {}; for (const g of GTADB) { const n = g.adr.split(', ')[0].replace(/\?$/, '').trim(); NB_NOMS[n] = (NB_NOMS[n] || 0) + 1; }
const TRAD = { Lighthouse: 'Phare', 'Welcome Sign': 'Panneau de bienvenue', 'Football Stadium': 'Stade de football', 'Tennis Stadium': 'Stade de tennis', 'Submerged Tank': 'Char englouti', 'Vice City Sign': 'Panneau Vice City', 'Fake Tunnel Mural': 'Faux tunnel peint', 'Gas Station': 'Station-service', 'Pawn Shop': 'Prêteur sur gages', Hospital: 'Hôpital', Pharmacy: 'Pharmacie', 'Fire Station': 'Caserne de pompiers', 'Liquor Store': "Magasin d'alcool", Airfield: 'Aérodrome', 'Car Wash': 'Station de lavage', 'Hamlet Water Tower': "Château d'eau de Hamlet" };
const tropProche = (lab, x, y, r = 260) => proches.some((q) => q.lab === lab && Math.hypot(q.x - x, q.y - y) < r);
for (const g of GTADB) {
  if (GTADB_UTILISES.has(g.id) || g.tags.includes('demolished') || g.tags.includes('closed')) continue;
  const parts = g.adr.split(', ');
  const nomBrut = parts[0].replace(/\?$/, '').trim();
  let def = null;
  const tag = Object.keys(SERVICES).find((t) => g.tags.includes(t));
  if (tag) def = SERVICES[tag];
  else if (nomBrut && nomBrut !== '?') { const r = NOMS.find(([re]) => re.test(nomBrut)); if (r) def = typeof r[1] === 'string' ? SERVICES[r[1]] : r[1]; }
  let lieuCurieux = false;
  if (!def && nomBrut && nomBrut !== '?' && (g.tags.includes('landmark') || g.tags.includes('point-of-interest') || CURIOSITE.test(nomBrut)) && !/lifeguard|water tower|control tower|radar tower|broadcast tower|residences|strip mall|^(radio|cell|guard|prison) tower/i.test(nomBrut)) { def = ['Lieu remarquable', 'star', 'lieux', null]; lieuCurieux = true; }
  if (!def) continue;
  const [label, ic, mc, ast] = def;
  const x = Math.round(g.x), y = Math.round(g.y);
  const cle = lieuCurieux ? nomBrut : label;
  if (tropProche(cle, x, y)) continue; // un seul repère par magasin (GTADB en compte parfois plusieurs : enseigne, parking…)
  proches.push({ lab: cle, x, y });
  const zone = parts.slice(1).join(', ') || 'Leonida';
  const fr = TRAD[nomBrut] || nomBrut;
  const nom = !nomBrut || nomBrut === '?' ? `${label} · ${parts[1] || 'Leonida'}` : NB_NOMS[nomBrut] > 1 && parts[1] ? `${fr} · ${parts[1]}` : fr;
  const douteux = g.adr.includes('?') || g.tags.includes('unconfirmed');
  features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [x, y] }, properties: { id: 's-' + g.id, nom, cat: mc, sous: label, region: null, statut: 'a-verifier', precision: 'zone', icon: ic, desc: `${label} · ${zone}. Repéré par la communauté GTADB${douteux ? ' (nom ou position à confirmer)' : ''}.`, url: ast && A[ast] ? `astuces/${ast}/` : null, tip: ast && A[ast] ? tipAstuce(ast) : undefined, service: label, zone } });
}
// Open GTA 6 Map (CC BY 4.0) : objets à collectionner, armes au sol, véhicules, braquages, commerces, activités
const OGM = fs.existsSync(path.join(ROOT, 'data', 'carte-ogm.json')) ? read('carte-ogm.json') : { lieux: [] };
{
  const pres = (f, x, y, r) => Math.hypot(f.geometry.coordinates[0] - x, f.geometry.coordinates[1] - y) < r;
  const retirer = new Set();
  const out = [];
  // même lieu sous deux noms proches (« Heath Tower » / « Heath Tower », « Phare · Catalan Key » / « Phare de Catalan Key »…)
  const VIDES = new Set(['the', 'les', 'des', 'sign', 'panneau', 'park', 'parc', 'hotel', 'tower', 'tour', 'route', 'city', 'vice', 'club', 'motel', 'station', 'gare', 'marina', 'lieu']);
  const mots = (t) => new Set(norm(t).split(' ').filter((w) => w.length >= 4 && !VIDES.has(w)));
  const proches = (a, b) => { if (norm(a) === norm(b)) return true; let A = mots(a), B = mots(b); if (!A.size || !B.size) return false; if (A.size > B.size) [A, B] = [B, A]; return [...A].every((w) => B.has(w)); };
  const vus = [];
  for (const o of OGM.lieux) {
    // un repère du guide au même endroit (même catégorie, ou même nom) : on garde le nôtre
    if (features.some((f) => !/^[sm]-/.test(f.properties.id) && ((f.properties.cat === o.c && pres(f, o.x, o.y, 60)) || (o.c === 'lieux' && L[f.properties.id] && L[f.properties.id].type === 'batiment' && pres(f, o.x, o.y, 90) && proches(f.properties.nom, o.n))))) continue;
    // doublon interne d'Open GTA 6 Map (même nom, même catégorie, au même endroit)
    if (vus.some((v) => v.c === o.c && v.s === o.s && norm(v.n) === norm(o.n) && Math.hypot(v.x - o.x, v.y - o.y) < 15)) continue;
    vus.push(o);
    // un repère GTADB équivalent : remplacé par celui-ci, mieux décrit
    features.forEach((f, i) => { if (f.properties.id.startsWith('s-') && ((f.properties.cat === o.c && f.properties.service !== 'Lieu remarquable' && pres(f, o.x, o.y, 150)) || (o.c === 'lieux' && pres(f, o.x, o.y, 150) && proches(f.properties.nom, o.n)))) retirer.add(i); });
    out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [o.x, o.y] }, properties: { id: 'o-' + o.id, nom: o.n, cat: o.c, sous: o.s, service: o.s, region: null, statut: 'a-verifier', precision: 'zone', icon: o.i, desc: o.d || '', ...(o.en ? { en: 1 } : {}), ...(o.a ? { zone: o.a } : {}), ...(o.ph || o.d ? { ext: `https://fbritoferreira.github.io/gta6/l/${o.id}/`, ph: o.ph ? 1 : undefined } : {}), src: 'ogm' } });
  }
  for (const i of [...retirer].sort((a, b) => b - a)) features.splice(i, 1);
  // repère GTADB qui double une fiche du guide (même nom, au même endroit)
  for (let i = features.length - 1; i >= 0; i--) { const f = features[i]; if (f.properties.id.startsWith('s-') && features.some((g) => L[g.properties.id] && pres(g, ...f.geometry.coordinates, 90) && proches(g.properties.nom, f.properties.nom))) features.splice(i, 1); }
  features.push(...out);
}
// Missions : où elles se passent (repère du guide ou lieu GTADB)
const MLIEUX = fs.existsSync(path.join(ROOT, 'data', 'carte-missions.json')) ? read('carte-missions.json').lieux : [];
const MIS = Object.fromEntries(MISSIONS.missions.map((m) => [m.id, m]));
const missionsSur = {}; // id mission → repère carte
for (const e of MLIEUX) {
  const base = e.lieu ? features.find((f) => f.properties.id === e.lieu) : null;
  if (e.lieu && !base) { console.warn(`carte-missions : « ${e.lieu} » n'est pas sur la carte, ignoré`); continue; }
  const pos = base ? base.geometry.coordinates.map((v, i) => v + (i ? 26 : -26)) : gtadbCentre(e.gtadb);
  const ms = e.missions.map((id) => MIS[id]).filter(Boolean).sort((a, b) => (a.num || 999) - (b.num || 999));
  const id = 'm-' + (e.lieu || norm(e.nom).replace(/ /g, '-'));
  ms.forEach((m) => { missionsSur[m.id] ||= id; });
  const ch = [...new Set(ms.map((m) => (m.chapitre === 'prologue' ? 'Prologue' : 'chap. ' + m.chapitre)))].join(', ');
  features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: pos }, properties: { id, nom: e.nom || base.properties.nom, cat: 'missions', sous: 'Mission', region: base ? base.properties.region : null, statut: 'confirme', precision: base ? base.properties.precision : 'zone', icon: 'flag', desc: `${ms.length} mission${ms.length > 1 ? 's' : ''} ici (${ch}) : ${ms.map((m) => m.nom).join(', ')}.`, service: `${ms.length} mission${ms.length > 1 ? 's' : ''}`, missions: ms.map((m) => ({ id: m.id, n: m.num, t: m.nom, c: m.chapitre, r: m.resume })) } });
}
// Couche communautaire : lieux nommés et positionnés de GTADB
const COMMU_CATS = CARTE.communaute.categories;
const TR_COMMU = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'traductions', 'communaute.json'), 'utf8'));
const communaute = GTADB.filter((g) => g.adr && !g.adr.startsWith('?') && !g.tags.includes('demolished')).map((g) => {
  const parts = g.adr.split(', ');
  const c = (COMMU_CATS.find((c) => c.tags.some((t) => g.tags.includes(t))) || COMMU_CATS[COMMU_CATS.length - 1]).id;
  const n0 = parts[0].replace(/\?$/, '');
  return { i: g.id, n: TR_COMMU[n0] || n0, z: parts.slice(1).join(', '), x: Math.round(g.x), y: Math.round(g.y), c, d: g.adr.includes('?') || g.tags.includes('unconfirmed') ? 1 : 0 };
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
const NOUVEAU = ACTUS.length && (new Date(site.majLe) - new Date(ACTUS[0].date)) / 864e5 <= 7;
const BRAND_PALM = `<svg class="mark mark--palm" viewBox="0 0 48 40" aria-hidden="true"><defs><linearGradient id="pm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset=".5" stop-color="#ff2bd6"/><stop offset="1" stop-color="#b44dff"/></linearGradient></defs><path fill="url(#pm-g)" d="M23 13c-5-6-13-7-19-3 6-1 11 0 16 4-7-1-13 2-16 8 5-4 11-5 16-3-4 3-6 8-5 14l2 .5c-.5-6 1.5-10 5-13 .7 6 1 12 .2 19h3.4c.6-8 .2-14-1-20 4 2 7 6 7.5 11 2-6-1-11-6-14 6-1 11 1 15 5-2-7-9-10-16-8 4-4 10-5 15-3-5-5-13-4-18 1-1-4-4-7-8-8 3 2 5 5 5 8z"/></svg>`;
function layout({ p, title, desc, body, schema = [], noindex = false, cls = '', scripts = [], crumbs = null, ogType = 'website', v2 = true, styles = [] }) {
  if (v2 && cls !== 'home' && !styles.includes('pages.css')) styles = [...styles, 'pages.css'];
  if (v2 && cls !== 'home' && cls !== 'p-atlas' && !scripts.includes('pages.js')) scripts = [...scripts, 'pages.js'];
  const deco = v2 && cls !== 'home' && cls !== 'p-atlas' ? `<div class="pg-deco" aria-hidden="true">${homeSun()}${homePalms()}</div>` : '';
  const depth = p.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const canon = `${site.url}/${p}`;
  const nav = [
    ['missions/', 'Missions', 'flag'], ['astuces/', 'Astuces', 'bolt'], ['vehicules/', 'Véhicules', 'car'], ['carte/', 'Carte', 'map'],
    ['lieux/', 'Lieux', 'pin'], ['encyclopedie/', 'Encyclopédie', 'book'], ['actualites/', 'Actus', 'news']
  ];
  const cur = (u) => (p.startsWith(u) ? ' aria-current="page"' : '');
  const tabs = [['', 'Accueil', 'home'], ['astuces/', 'Astuces', 'bolt'], ['#search', 'Chercher', 'search'], ['carte/', 'Carte', 'map'], ['missions/', 'Missions', 'flag']];
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
    ${v2 ? BRAND_PALM : '<span class="brand-sun" aria-hidden="true"></span>'}
    <span class="brand-txt"><b>GTA 6</b><i>facile</i></span>
  </a>
  <button class="search-trigger" type="button" data-open-search aria-label="Rechercher">
    ${icon('search')}<span>Une voiture, une mission, un lieu…</span><kbd>/</kbd>
  </button>
  <nav class="nav-desktop" aria-label="Principal">${nav.map(([u, t, i]) => `<a href="${R}${u}"${cur(u)}>${icon(i)}<span>${t}</span></a>`).join('')}</nav>
  <div class="top-actions">
    <a class="ibtn" href="${R}dossiers/" aria-label="Tous les guides">${icon('bookmark')}</a>
    <a class="ibtn" href="${R}favoris/" aria-label="Mes favoris">${icon('heart')}<span class="count" data-fav-count hidden>0</span></a>
    <a class="ibtn ibtn--bell" href="${R}actualites/" aria-label="Actualités${NOUVEAU ? ' (nouveautés)' : ''}">${icon('bell')}${NOUVEAU ? '<i class="dot" aria-hidden="true"></i>' : ''}</a>
    <button class="ibtn" type="button" data-menu aria-expanded="false" aria-controls="menu" aria-label="Menu">${icon('menu')}</button>
  </div>
</header>
<div class="drawer" id="menu" hidden>
  <div class="drawer-bg" data-menu-close></div>
  <nav class="drawer-in" aria-label="Menu">
    <div class="drawer-h"><b>Menu</b><button class="ibtn" type="button" data-menu-close aria-label="Fermer le menu">${icon('x')}</button></div>
    ${[['Explorer GTA 6', [['', 'Accueil', 'home', 'c'], ['codes/', 'Codes de triche', 'gamepad', 'p'], ['dossiers/argent-rapide/', 'Gagner de l\'argent', 'wallet', 'p'], ['dossiers/', 'Astuces et guides', 'bolt', 'c'], ['missions/', 'Missions et solutions', 'flag', 'c'], ['vehicules/', 'Véhicules', 'car', 'c'], ['carte/', 'Carte interactive', 'map', 'c']]],
      ['Découvrir', [['encyclopedie/', 'Encyclopédie et lieux', 'book', 'c'], ['actualites/', 'Actualités', 'news', 'c']]],
      ['Personnel', [['favoris/', 'Mes favoris', 'heart', 'p'], ['compte/', 'Mon espace', 'user', 'p']]],
      ['', [['a-propos/', 'À propos et fiabilité', 'shield', 'c']]]].map(([titre, liens]) => `<div class="drawer-sec">${titre ? `<p class="drawer-t">${titre}</p>` : ''}${liens.map(([u, t, i, c]) => `<a class="drawer-a drawer-a--${c}" href="${R}${u}"${(u === '' ? p === '' : u && p.startsWith(u) && !(u === 'dossiers/' && p.startsWith('dossiers/argent'))) ? ' aria-current="page"' : ''}>${icon(i)}<span>${t}</span>${icon('chevron')}</a>`).join('')}</div>`).join('')}
  </nav>
</div>
<main id="main" class="page">
${deco}
${crumbHtml}
${body}
</main>
<footer class="foot">
  <div class="foot-in">
    <a class="brand brand--foot" href="${R}">${v2 ? BRAND_PALM.replace(/pm-g/g, 'pm-f') : '<span class="brand-sun" aria-hidden="true"></span>'}<span class="brand-txt"><b>GTA 6</b><i>facile</i></span></a>
    <nav aria-label="Pied de page">
      <a href="${R}missions/">Missions et solutions</a><a href="${R}astuces/">Astuces GTA 6</a><a href="${R}vehicules/">Véhicules</a><a href="${R}carte/">Carte interactive</a><a href="${R}lieux/">Lieux</a><a href="${R}encyclopedie/">Encyclopédie</a><a href="${R}codes/">Codes</a><a href="${R}actualites/">Actualités</a><a href="${R}a-propos/">À propos et fiabilité</a>${site.editeur && site.editeur.nom ? `<a href="${R}mentions-legales/">Mentions légales et confidentialité</a>` : ''}<a href="${R}compte/">Mon espace</a>
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
<script src="${R}assets/compte.js" defer></script>
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
  const counts = { astuces: ASTUCES.length, vehicules: VEHICULES.length + CATALOGUE.vehicules.length, reperes: features.filter((f) => !f.properties.label).length, actualites: ACTUS.length, missions: MISSIONS.missions.length };
  const fill = (t, c) => t.replace('{n}', counts[c] ?? '').replace('{date}', fmtDate(ACTUS[0].date));
  const shortcuts = H.enCeMoment.astuces.map((s) => A[s]);
  const TOP = [
    ['codes/', 'Codes de triche PS5 et Xbox', `${CODES.codes.length} codes connus`, 'code', '#9b6bff'],
    ['dossiers/argent-rapide/', 'Gagner de l\'argent vite', 'Dossier complet', 'money', '#3ddc84'],
    ['dossiers/codes-coffres/', 'Tous les codes de coffres', 'Dossier complet', 'bank', '#ffb547'],
    ['carte/', 'La carte interactive', `${counts.reperes} repères`, 'map', '#2de2e6'],
    ['carte/?cat=armes', 'Où trouver les armes', 'Sur la carte', 'gun', '#ff5a5a'],
    ['astuces/voiture-rare/', 'Voitures rares', 'Astuce', 'car', '#ff9a1f'],
    ['dossiers/secrets/', 'Secrets et Easter eggs', 'Dossier complet', 'sparkle', '#9d7bff'],
    ['dossiers/100-pour-cent/', 'Finir le jeu à 100 %', 'Dossier complet', 'trophy', '#2de2e6'],
    ['missions/', 'Missions et solutions', 'Toute l\'histoire, étape par étape', 'flag', '#ff3d6e']
  ];
  const maj = site.majLe.split('-').reverse().join('.');
  const tileImg = { carte: vign('vice-city', R), vehicules: vign('v-pegassi-infernus', R) };
  const tilesHtml = H.tuiles.map((t, i) => `<a class="ht${t.taille === 'large' ? ' ht--large' : t.taille === 'large2' ? ' ht--wide' : ''}${tileImg[t.id] ? ' ht--img' : ''}" href="${R}${t.href}" style="--c:${t.couleur}${tileImg[t.id] ? `;--img:url(${tileImg[t.id]})` : ''}" data-h="tile">
      <span class="ht-idx">0${i + 1}</span>
      <span class="ht-ico">${icon(t.icon)}</span>
      <span class="ht-txt"><b>${esc(t.label)}</b><small>${esc(fill(t.sousTitre, t.compteur))}</small></span>
      <span class="ht-go" aria-hidden="true">${icon('arrow-right')}</span>
    </a>`).join('');
  // chemins relatifs à assets/home.css (variable CSS) : images de la maquette (m-…) dans assets/, photos du jeu dans photos/
  const ph = (n) => (n.startsWith('m-') ? `${n}.webp` : `../photos/${n}.webp`);
  const D_ = (s) => DOSSIERS.find((d) => d.slug === s);
  const vraiesM = MISSIONS.missions.filter((m) => !m.facultative && !m.tache).length;
  const CATS5 = [['codes/', 'Codes', 'gamepad', '#ff2bd6'], ['dossiers/argent-rapide/', 'Argent', 'money', '#3ddc84'], ['carte/', 'Carte', 'map', '#2de2e6'], ['missions/', 'Missions', 'flag', '#b44dff'], ['vehicules/', 'Véhicules', 'car', '#ffb547']];
  const UNE = D_('argent-rapide');
  const POP = [
    ['codes/', 'Codes', `Codes de triche GTA 6 (PS5 et Xbox)`, 'm-codes', '#ff2bd6', `${CODES.codes.length} codes avec leurs flèches`],
    ['dossiers/secrets/', 'Secrets', 'Secrets et Easter eggs de Leonida', 'm-secrets', '#9d7bff', 'Bigfoot, OVNI, fantômes…'],
    ['dossiers/codes-coffres/', 'Coffres', 'Tous les codes de coffres', 'vapid-stanier-55', '#ffb547', 'Repaires de gangs et lieux secrets'],
    ['dossiers/100-pour-cent/', '100 %', 'Finir GTA 6 à 100 %', 'kayak-crest', '#2de2e6', 'La checklist complète'],
    ['astuces/voiture-rare/', 'Véhicules', 'Trouver une voiture rare', 'progen-emerus-royal-ruby', '#ffb547', 'Où sont garées les plus belles'],
    ['carte/?cat=armes', 'Armes', 'Où trouver les armes', 'jets-militaires', '#ff5a5a', 'Armes au sol et armes uniques']
  ];
  const body = `
<section class="hx" aria-labelledby="h-title">
  <div class="hx-banner hx-banner--img">
    <img src="${R}assets/m-banniere-titre-1320.webp" srcset="${R}assets/m-banniere-titre-828.webp 828w, ${R}assets/m-banniere-titre-1320.webp 1320w, ${R}assets/m-banniere-titre.webp 2640w" sizes="(min-width: 1600px) 1600px, 100vw" width="2640" height="516" alt="" fetchpriority="high" decoding="async">
    <h1 class="sr-only" id="h-title">Le guide ultime de GTA 6 : astuces, codes, carte interactive, véhicules, missions et tous les secrets de Leonida</h1>
  </div>
  <div class="wrap hx-in">
    <button class="hx-search" type="button" data-open-search aria-label="Rechercher un code, une mission, un véhicule">${icon('search')}<span>Rechercher un code, une mission, un véhicule…</span>${icon('sparkle')}</button>
    <nav class="hx-cats" aria-label="Rubriques">${CATS5.map(([u, t, i, c]) => `<a href="${R}${u}" style="--c:${c}">${icon(i)}<span>${t}</span></a>`).join('')}</nav>
  </div>
</section>

<section class="wrap hx-sec" aria-labelledby="une-t">
  <header class="hx-h"><h2 id="une-t"><i class="hx-bar"></i>À la une</h2><span class="hx-maj">${icon('check')}Mis à jour</span><a href="${R}dossiers/">Tout voir${icon('arrow-right')}</a></header>
  <a class="hx-une" href="${R}dossiers/${UNE.slug}/" style="--c:${UNE.couleur}">
    <span class="hx-une-img" style="--img:url(${ph('m-argent')})"></span>
    <span class="hx-une-t"><span class="hx-tag" style="--c:#3ddc84">Argent</span><b>Gagner de l'argent rapidement sur GTA 6</b><small>Les meilleures méthodes du début à la fin de l'histoire, et comment ne pas perdre ce que tu gagnes.</small></span>
    <span class="hx-go">${icon('arrow-right')}</span>
  </a>
</section>

<section class="wrap hx-sec" aria-labelledby="pop-t" data-carousel>
  <header class="hx-h"><h2 id="pop-t">${icon('stack')}Guides populaires</h2><a href="${R}dossiers/">Tout voir${icon('arrow-right')}</a></header>
  <div class="hx-car">
    <button class="hx-arr hx-arr--l" type="button" data-car="-1" aria-label="Guides précédents">${icon('chevron-left')}</button>
    <ul class="hx-track" data-track>${POP.map(([u, tag, t, img, c, sub]) => `<li><a class="hx-card" href="${R}${u}" style="--c:${c};--img:url(${ph(img)})"><span class="hx-tag">${esc(tag)}</span><b>${esc(t)}</b><small>${esc(sub)}</small></a></li>`).join('')}</ul>
    <button class="hx-arr hx-arr--r" type="button" data-car="1" aria-label="Guides suivants">${icon('chevron')}</button>
  </div>
  <div class="hx-dots" data-dots aria-hidden="true"></div>
</section>

<section class="wrap hx-sec">
  <a class="hx-map" href="${R}carte/">
    <span class="hx-map-t"><b>${icon('pin')}Carte interactive de Leonida</b><small>Explore la carte de GTA 6 : missions, véhicules, lieux secrets, objets à collectionner et bien plus.</small><span class="hx-btn">${icon('map')}Ouvrir la carte${icon('arrow-right')}</span></span>
    <span class="hx-map-img" aria-hidden="true"><img src="${R}assets/m-carte.webp" alt=""${wh('img/m-carte.webp')} loading="lazy" decoding="async"></span>
  </a>
</section>

<section class="wrap hx-sec">
  <a class="hx-all" href="${R}dossiers/"><span class="hx-all-ico">${icon('book')}</span><span><b>Tous les guides GTA 6</b><small>Retrouve l'ensemble des guides : astuces, secrets, codes, collection…</small></span><span class="hx-go">${icon('arrow-right')}</span></a>
</section>`;
  emit(p, layout({
    p, title: H.meta.title, desc: H.meta.description, cls: 'home', body, v2: true, scripts: ['home.js'],
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
  emit(p, layout({ p, title: 'Recherche GTA 6 : retrouver un véhicule, un lieu, une astuce', desc: 'Recherchez une astuce, un véhicule, un lieu ou une réponse GTA 6 depuis une seule barre de recherche.', body, cls: 'p-search', noindex: true }));
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
  ${sourcesBlock(a.sources)}
</article>`;
  emit(p, layout({
    p, title: ((t) => titreSEO(`${t} : solution pas à pas`, `${t} : la solution`, t))(/GTA 6/.test(a.titre) ? a.titre.replace(/ \?$/, '') : `${a.titre.replace(/ \?$/, '')} dans GTA 6`),
    desc: descSEO(a.reponse, a.reponse.length < 90 ? a.etapes[0] : ''),
    body, cls: 'p-fiche', ogType: 'article',
    crumbs: [['Accueil', ''], ['Astuces', 'astuces/'], [c.nom, `astuces/?cat=${a.cat}`], [a.court, p]],
    schema: [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.titre, description: a.reponse, dateModified: site.majLe, inLanguage: 'fr-FR', author: { '@type': 'Organization', name: M, url: site.url + '/' }, publisher: { '@type': 'Organization', name: M, url: site.url + '/' }, mainEntityOfPage: `${site.url}/${p}` }]
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
{
  const p = 'vehicules/', R = R_(p);
  const GRP = CATALOGUE.groupes || [];
  const grpDe = (v) => (CATALOGUE.fiches[v.slug] || {}).groupe || 'service';
  // Une carte = une photo, un nom, et un seul bouton « Où le trouver ? » qui ouvre la carte sur le repère vérifié.
  // Sans repère vérifié : le texte d'obtention s'il existe, sinon « Emplacement non vérifié » (rien n'est inventé).
  const vCard = ({ slug, nom, kicker, classe, type, groupe, visu, sur, focus, comment }) => {
    const c = cat('vehicules', type);
    const known = !!(focus || comment);
    const txt = norm([nom, kicker, classe, c.nom].join(' '));
    const bouton = focus ? `<a class="vc-ou" href="${R}carte/?focus=${focus}">${icon('map')}Où le trouver ?</a>`
      : comment ? `<a class="vc-ou vc-ou--txt" href="${R}vehicules/${slug}/#ou">${icon('pin')}Où le trouver ?</a>`
      : `<span class="vc-ou vc-ou--off">${icon('question')}Emplacement non vérifié</span>`;
    return `<article class="card card--veh card--v" style="--c:${c.color}" data-cat="${type}" data-grp="${groupe}" data-known="${known ? 1 : 0}" data-sur="${sur ? 1 : 0}" data-text="${esc(txt)}">
  <a class="vc-link" href="${R}vehicules/${slug}/"><span class="veh-art">${visu}<span class="veh-type">${esc(UN[classe] || classe)}</span></span>
  <span class="card-body"><span class="card-kicker">${esc(kicker)}</span><b class="card-title">${esc(nom)}</b>${sur ? '' : `<span class="vc-warn">${icon('alert')}Présence à confirmer</span>`}</span></a>
  ${bouton}
</article>`;
  };
  const cartes = {};
  for (const v of VEHICULES) {
    const f = CATALOGUE.fiches[v.slug] || {};
    const sur = (VERIF[v.slug] || {}).statut === 'confirme';
    const focus = vehOnMap(v.slug) ? 'v-' + v.slug : null;
    (cartes[grpDe(v)] ||= []).push({ o: (sur ? 0 : 10) + (focus ? 0 : 1), n: v.nom, html: vCard({ slug: v.slug, nom: v.nom, kicker: f.fabricant || cat('vehicules', v.type).nom, classe: f.classe || v.sous, type: v.type, groupe: grpDe(v), visu: vehVisuel(v, R), sur, focus, comment: !!v.emplacement }) });
  }
  for (const x of CATALOGUE.vehicules) {
    const sur = (VERIF[x.slug] || {}).statut === 'confirme';
    const focus = (CAT_CARTE[x.slug] || []).find((id) => mapIndex[id]) || null;
    const visu = x.img ? `<img class="veh-photo" src="${R}catalogue/${x.img}" alt="${esc(x.nom)}"${wh('catalogue/' + x.img)} loading="lazy" decoding="async">` : silhouette({ slug: '', type: x.type });
    (cartes[x.groupe] ||= []).push({ o: (sur ? 0 : 10) + (focus ? 0 : x.obtenir ? 1 : x.img ? 2 : 3), n: x.nom, html: vCard({ slug: x.slug, nom: x.modele || x.nom, kicker: x.fabricant || cat('vehicules', x.type).nom, classe: x.classe, type: x.type, groupe: x.groupe, visu, sur, focus, comment: !!x.obtenir }) });
  }
  const groupes = GRP.filter((g) => cartes[g.id]);
  const total = VEHICULES.length + CATALOGUE.vehicules.length;
  const nbOu = Object.values(cartes).flat().filter((c) => c.html.includes('data-known="1"')).length;
  const ty = (id) => [...VEHICULES.filter((v) => v.type === id), ...CATALOGUE.vehicules.filter((x) => x.type === id)].length;
  const body = `<section class="wrap section" data-vlist>
  <h1 class="h1">Quel véhicule cherches-tu ?</h1>
  <p class="lead veh-lead">${total} véhicules. Touche <b>Où le trouver ?</b> pour ouvrir la carte au bon endroit (${nbOu} emplacements vérifiés pour l'instant).</p>
  ${fieldFilter('Nom, marque ou vraie voiture')}
  <div class="doors doors--5" role="group" aria-label="Type" data-vtype>
    ${site.categories.vehicules.map((c) => `<button class="door" type="button" data-value="${c.id}" aria-pressed="false" style="--c:${c.color}"><span class="door-ico">${icon(c.icon)}</span><span>${esc(c.nom)}</span><small>${ty(c.id)}</small></button>`).join('')}
  </div>
  <div class="filterbar">
    <button class="chip chip--toggle" type="button" data-vtoggle="known" aria-pressed="false">${icon('pin')}Emplacement connu</button>
  </div>
  <nav class="vjump" aria-label="Aller à une catégorie">${groupes.map((g) => `<a href="#cat-${g.id}" data-jump="${g.id}">${esc(g.nom)}<small>${cartes[g.id].length}</small></a>`).join('')}</nav>
  <p class="count-line" data-vcount aria-live="polite"></p>
  ${groupes.map((g) => `<section class="vgrp" id="cat-${g.id}" data-vgrp="${g.id}" data-type="${g.type}" aria-labelledby="t-${g.id}">
    <h2 class="vgrp-h" id="t-${g.id}">${esc(g.nom)} <small data-vn>${cartes[g.id].length}</small></h2>
    <div class="grid">${cartes[g.id].sort((a, b) => a.o - b.o || a.n.localeCompare(b.n, 'fr')).map((c) => c.html).join('')}</div>
    <button class="btn btn--ghost vgrp-more" type="button" data-vmore hidden>${icon('plus')}<span></span></button>
  </section>`).join('')}
  <p class="empty" data-vempty hidden>${icon('search')}Aucun véhicule ne correspond. Essaie un autre mot.</p>
  <p class="note veh-sources">${icon('info')}<span>Liste et caractéristiques : <a href="https://www.gtabase.com/fr/gta-6/vehicules/" target="_blank" rel="noopener">GTABase</a> et <a href="https://gta6guide.fr/gta-6/vehicules" target="_blank" rel="noopener">gta6guide.fr</a>, recoupées avec GTA Wiki. Emplacements : repères vérifiés de la carte. Photos : Rockstar Games (via GTABase, GTA Wiki) et gta6guide.fr, choisies parmi les plus nettes.</span></p>
  <a class="btn btn--wide" href="${R}carte/?cat=vehicules">${icon('map')}Voir tous les véhicules sur la carte</a>
</section>`;
  emit(p, layout({ p, title: 'Véhicules GTA 6 : liste complète, photos et emplacements', desc: `Les ${total} véhicules de GTA 6 avec photo, et un bouton pour ouvrir la carte à l'endroit où les trouver (${nbOu} emplacements vérifiés).`, body, cls: 'p-list', scripts: ['catalogue.js'], crumbs: [['Accueil', ''], ['Véhicules', 'vehicules/']] }));
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
    <div id="ou"><dt>${icon('pin')}Emplacement</dt><dd>${l ? `<a href="${R}lieux/${l.id}/"><b>${esc(l.nom)}</b></a> — ` : '<b>Inconnu</b> — '}${esc(v.emplacement)}</dd></div>
  </dl>
  <section class="steps-wrap" aria-labelledby="ob-t"><h2 id="ob-t" class="h3">${icon('list')}Comment l'obtenir</h2>
    <ol class="steps">${v.obtenir.map((s, i) => `<li class="step"><span class="step-n">${i + 1}</span><span class="step-t">${esc(s)}</span></li>`).join('')}</ol></section>
  ${similar.length ? `<section class="related"><h2 class="h3">${icon(c.icon)}Même type</h2><div class="minis">${similar.map((x) => relCard(x.slug, R)).join('')}</div></section>` : ''}
  ${sameReg.length ? `<section class="related"><h2 class="h3">${icon('pin')}Même région</h2><div class="minis">${sameReg.map((x) => relCard(x.slug, R)).join('')}</div></section>` : ''}
  ${sourcesBlock(v.sources)}
</article>`;
  emit(p, layout({ p, title: titreSEO(`${v.nom} GTA 6 : où le trouver et comment l'obtenir`, `${v.nom} GTA 6 : où le trouver`, `${v.nom} dans GTA 6`), desc: descSEO(`Où trouver ${v.nom} dans GTA 6 :`, v.emplacement, v.obtenir[0] || ''), body, cls: 'p-fiche', ogType: 'article', scripts: MODELES[v.slug] ? ['v3d-init.js'] : [], crumbs: [['Accueil', ''], ['Véhicules', 'vehicules/'], [v.nom, p]] }));
}

// ---------- FICHES DU CATALOGUE (une page par véhicule ; non indexée tant que sa présence n'est pas confirmée) ----------
for (const x of CATALOGUE.vehicules) {
  const p = `vehicules/${x.slug}/`, R = R_(p);
  const c = cat('vehicules', x.type);
  const vf = VERIF[x.slug] || {};
  const sur = vf.statut === 'confirme';
  const lo = (CAT_CARTE[x.slug] || []).map((id) => mapIndex[id]).filter(Boolean);
  const grp = (CATALOGUE.groupes || []).find((g) => g.id === x.groupe);
  const voisins = (l) => l.filter((y) => y.slug !== x.slug && (VERIF[y.slug] || {}).statut === 'confirme');
  const memeGroupe = voisins(CATALOGUE.vehicules.filter((y) => y.groupe === x.groupe)).sort((a, b) => (b.img ? 1 : 0) - (a.img ? 1 : 0) || a.nom.localeCompare(b.nom, 'fr')).slice(0, 4);
  const memeMarque = x.fabricant ? voisins(CATALOGUE.vehicules.filter((y) => y.fabricant === x.fabricant && !memeGroupe.includes(y))).slice(0, 4) : [];
  const mini = (y) => `<a class="mini" href="${R}vehicules/${y.slug}/" style="--c:${c.color}"><span class="mini-ico">${icon(cat('vehicules', y.type).icon)}</span><span><small>${esc(y.classe)}</small><b>${esc(y.nom)}</b></span>${icon('arrow-right')}</a>`;
  const faits = [
    x.fabricant && ['badge', 'Marque', esc(x.fabricant)],
    ['sparkle', 'Catégorie', `<a href="${R}vehicules/#cat-${x.groupe}">${esc(x.classe)}</a>`],
    x.inspiration && ['car', 'Inspiré de', esc(x.inspiration)],
    x.places && ['user', 'Places', esc(x.places)],
    (x.transmission || x.rapports) && ['sliders', 'Transmission', [x.transmission, x.rapports ? `${x.rapports} rapports` : ''].filter(Boolean).map(esc).join(' · ')],
    x.poids && ['shield', 'Poids', esc(x.poids)],
    x.aussi && ['replay', 'Déjà présent dans', esc(x.aussi)]
  ].filter(Boolean);
  const body = `<article class="wrap fiche" style="--c:${c.color}">
  <header class="fiche-head fiche-head--veh" data-reveal-group>
    ${x.img ? `<figure class="veh-hero veh-hero--photo"><img class="veh-photo" src="${R}catalogue/${x.img}" alt="${esc(x.nom)} dans GTA 6"${wh('catalogue/' + x.img)} fetchpriority="high" decoding="async">${x.credit ? `<figcaption class="veh-credit">Image : ${x.creditUrl ? `<a href="${esc(x.creditUrl)}" target="_blank" rel="noopener nofollow">${esc(x.credit)}</a>` : esc(x.credit)}</figcaption>` : ''}</figure>` : `<div class="veh-hero">${silhouette({ slug: '', type: x.type }, 'veh-svg--xl')}</div>`}
    <div class="fiche-tags"><a class="pill pill--cat" href="${R}vehicules/?cat=${x.type}">${icon(c.icon)}${esc(c.nom)}</a>${grp ? `<a class="pill" href="${R}vehicules/#cat-${x.groupe}">${esc(grp.nom)}</a>` : ''}</div>
    <h1 class="h1 h1--fiche">${esc(x.nom)}</h1>
  </header>
  <section class="answer"><span class="answer-k">${icon('bolt')}En bref</span><p>${esc(x.resume)}</p></section>
  <div class="actions">
    ${lo.length ? `<a class="btn btn--primary" href="${R}carte/?focus=${lo[0].properties.id}">${icon('map')}Où le trouver ?</a>` : ''}
    ${favBtn({ id: x.slug, type: 'vehicule', t: x.nom, u: p, i: c.icon, c: c.color })}
  </div>
  <dl class="facts">
    ${faits.map(([i, k, v]) => `<div><dt>${icon(i)}${k}</dt><dd>${v}</dd></div>`).join('')}
    ${vf.statut ? `<div class="fact-verif fact-verif--${vf.statut}"><dt>${icon(sur ? 'check' : 'alert')}Présence dans GTA 6</dt><dd>${esc(verifTexte(x.slug))}${vf.note ? ` <small>${esc(vf.note)}</small>` : ''}</dd></div>` : ''}
  </dl>
  <section class="steps-wrap" id="ou" aria-labelledby="ou-t"><h2 id="ou-t" class="h3">${icon('pin')}Où trouver ${esc(x.nom)} ?</h2>
    ${x.obtenir ? `<p>${esc(x.obtenir)}</p>` : ''}
    ${lo.length ? `<p>Repéré par les joueurs à ${lo.length > 1 ? `${lo.length} endroits` : 'un endroit précis'} :</p><ul class="vdlg-lo">${lo.slice(0, 8).map((f) => `<li><a href="${R}carte/?focus=${f.properties.id}"><b>${esc(f.properties.nom)}</b></a>${f.properties.zone ? ` · ${esc(f.properties.zone)}` : ''}${f.properties.desc ? `<br><small>${esc(f.properties.desc.slice(0, 160))}</small>` : ''}</li>`).join('')}</ul>`
    : x.obtenir ? '' : `<p>Pas encore documenté. ${sur ? 'Le véhicule est bien confirmé dans GTA 6, mais aucun emplacement fiable n’a encore été vérifié.' : 'Sa présence dans le jeu reste à confirmer.'} La fiche sera complétée dès qu’un emplacement sera vérifié.</p>`}
  </section>
  ${memeGroupe.length ? `<section class="related"><h2 class="h3">${icon(c.icon)}Autres ${esc((grp ? grp.nom : x.classe).toLowerCase())}</h2><div class="minis">${memeGroupe.map(mini).join('')}</div></section>` : ''}
  ${memeMarque.length ? `<section class="related"><h2 class="h3">${icon('badge')}Autres véhicules ${esc(x.fabricant)}</h2><div class="minis">${memeMarque.map(mini).join('')}</div></section>` : ''}
  ${x.sources && x.sources.length ? `<details class="sources"><summary>${icon('shield')}Sources (${x.sources.length})</summary><ul>${x.sources.map((s) => `<li><a href="${esc(s.url)}" rel="nofollow noopener" target="_blank">${esc(s.nom)}</a></li>`).join('')}</ul></details>` : ''}
</article>`;
  emit(p, layout({
    p, title: lo.length || x.obtenir ? titreSEO(`${x.nom} GTA 6 : où le trouver et caractéristiques`, `${x.nom} GTA 6 : où le trouver`, `${x.nom} dans GTA 6`) : titreSEO(`${x.nom} GTA 6 : fiche, photo et caractéristiques`, `${x.nom} GTA 6 : fiche et photo`, `${x.nom} dans GTA 6`),
    desc: descSEO(`${x.nom} dans GTA 6${x.fabricant ? ` (${x.fabricant})` : ''} : ${x.classe.toLowerCase()}${x.inspiration && x.inspiration !== x.nom && x.inspiration !== x.modele ? `, inspiré de ${x.inspiration}` : ''}${x.places ? `, ${x.places} places` : ''}${x.transmission ? `, ${x.transmission}` : ''}${x.poids ? `, ${x.poids}` : ''}.`, lo.length ? `Repéré à ${lo.length} endroit${lo.length > 1 ? 's' : ''} sur la carte.` : x.obtenir ? 'Comment l’obtenir.' : '', x.img ? 'Photo et caractéristiques.' : 'Caractéristiques et sources.'),
    body, cls: 'p-fiche', ogType: 'article', noindex: !sur,
    crumbs: [['Accueil', ''], ['Véhicules', 'vehicules/'], [x.nom, p]]
  }));
}

// ---------- MISSIONS ET SOLUTIONS ----------
{
  const p = 'missions/', R = R_(p);
  const MS = MISSIONS.missions, CH = MISSIONS.chapitres;
  const princ = MS.filter((m) => !m.facultative).length, fac = MS.length - princ, taches = MS.filter((m) => m.tache).length, vraies = princ - taches;
  const chNom = (c) => (c.id === 'prologue' ? 'Prologue' : `Chapitre ${c.id}`);
  const PERS = { jason: 'Jason', lucia: 'Lucia' };
  const carte = (m) => `<details class="mis${m.facultative ? ' mis--opt' : ''}${m.tache ? ' mis--tache' : ''}" id="${m.id}" data-ch="${m.chapitre}" data-opt="${m.facultative ? 1 : 0}" data-num="${m.num || ''}" data-text="${esc(norm([m.nom, m.nomEn, m.resume, m.donneur, ...m.etapes].join(' ')))}">
    <summary><span class="mis-n">${m.num ? m.num : icon('plus')}</span><span class="mis-t"><b>${esc(m.nom)}</b>${m.facultative || m.manquable || m.tache ? `<small>${[m.facultative ? 'facultative' : '', m.tache ? 'petite tâche' : '', m.manquable ? '<em>peut être manquée</em>' : ''].filter(Boolean).join(' · ')}</small>` : ''}</span><span class="mis-done" aria-hidden="true">${icon('check')}</span></summary>
    <div class="mis-b">
      <p class="mis-r">${esc(m.resume)}</p>
      <ul class="mis-meta">${m.donneur ? `<li>${icon('phone')}<span><b>Donnée par</b> ${esc(m.donneur)}</span></li>` : ''}<li>${icon('user')}<span><b>Tu joues</b> ${m.perso.map((x) => PERS[x]).join(' et ')}</span></li>${m.recompense ? `<li>${icon('money')}<span><b>Récompense</b> ${esc(m.recompense)}</span></li>` : ''}</ul>
      <h3 class="mis-h">${icon('list')}Étape par étape</h3>
      <ol class="mis-steps">${m.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>
      ${m.bloque.length ? `<div class="mis-help"><h3 class="mis-h">${icon('question')}Si tu es bloqué</h3><ul>${m.bloque.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
      <div class="mis-act"><a class="btn-s btn-s--ghost" href="${R}missions/${m.id}/">${icon('link')}<span>Page de la mission</span></a><button class="btn-s" type="button" data-mdone aria-pressed="false">${icon('check')}<span>Mission faite</span></button>${missionsSur[m.id] ? `<a class="btn-s btn-s--ghost" href="${R}carte/?focus=${missionsSur[m.id]}&amp;mission=${m.id}">${icon('map')}<span>Voir sur la carte</span></a>` : ''}${m.facultative ? '' : `<button class="btn-s btn-s--ghost" type="button" data-mhere>${icon('flag')}<span>J'en suis là</span></button>`}</div>
      <p class="mis-src">${icon('info')}${m.sources.length > 1 ? `Mission confirmée par ${m.sources.join(', ')}.` : `Mission listée par ${m.sources[0]} seulement.`}</p>
    </div>
  </details>`;
  const body = `<section class="wrap section missions" data-missions>
  <h1 class="h1">Missions et solutions</h1>
  <p class="lead">Toute l'histoire dans l'ordre et par chapitre : <b>${vraies} missions principales</b> et <b>${taches} petites tâches</b> (envoyer de l'argent, faire les courses…), plus <b>${fac} missions facultatives</b>. Pour chacune : ce qu'il faut faire, étape par étape, et quoi faire si tu bloques.</p>
  <div class="mis-now" data-mnow>
    <div class="mis-now-h">${icon('flag')}<div><b>Que faire maintenant ?</b><span data-mnow-txt>Touche « J'en suis là » sur ta mission actuelle : on t'indique la suivante.</span></div></div>
    <div class="mis-bar" aria-hidden="true"><i data-mbar></i></div>
    <p class="mis-now-c"><span data-mcount>0 / ${princ} étapes de l'histoire faites</span><button class="lnk" type="button" data-mreset hidden>Tout effacer</button></p>
    <a class="btn-s" href="#" data-mnext hidden>${icon('arrow-right')}<span>Voir la solution</span></a>
  </div>
  <h2 class="h3 mis-list-t">${icon('list')}Toutes les missions</h2>
  ${fieldFilter('Chercher une mission : banque, Raul, bateau…')}
  <div class="filterbar" role="group" aria-label="Filtrer par chapitre">
    <button class="chip" type="button" data-mch="" aria-pressed="true">Tous</button>
    ${CH.map((c) => `<button class="chip" type="button" data-mch="${c.id}" aria-pressed="false">${c.id === 'prologue' ? 'Prologue' : `Chap. ${c.id}`}</button>`).join('')}
  </div>
  <div class="filterbar" role="group" aria-label="Options d'affichage">
    <button class="chip chip--toggle" type="button" data-mopt aria-pressed="true">${icon('plus')}Facultatives</button>
    <button class="chip chip--toggle" type="button" data-mhide aria-pressed="false">${icon('eye')}Masquer les missions faites</button>
  </div>
  <p class="count-line" data-mcountline aria-live="polite"></p>
  ${CH.map((c) => {
    const L = MS.filter((m) => m.chapitre === c.id);
    return `<section class="mis-ch" data-mchap="${c.id}" aria-labelledby="ch-${c.id}"><h2 class="vgrp-h" id="ch-${c.id}">${chNom(c)}${c.id === 'prologue' ? '' : ` · ${esc(c.titre)}`} <small>${((n) => `${n} mission${n > 1 ? 's' : ''}`)(L.filter((m) => !m.facultative).length)}${((n) => n ? ` + ${n} facultative${n > 1 ? 's' : ''}` : '')(L.filter((m) => m.facultative).length)}</small></h2>
    <p class="mis-ch-r">${esc(c.resume)}</p>
    <div class="mis-list">${L.map(carte).join('')}</div></section>`;
  }).join('')}
  <p class="empty" data-mempty hidden>${icon('search')}Aucune mission ne correspond. Essaie un autre mot.</p>
  <section class="faq mis-stuck" aria-labelledby="stuck-t"><h2 class="h3" id="stuck-t">${icon('question')}Bloqué ? Les réponses rapides</h2>
    <details><summary>Je ne trouve pas la mission suivante</summary><p>1. Ouvre la carte et touche l'icône en forme de livre : c'est la liste des missions. 2. Si rien n'est marqué, la suite arrive souvent par un appel ou un SMS : fais autre chose quelques heures de jeu ou dors dans ta planque. 3. Certaines missions demandent d'en finir d'autres avant (c'est indiqué dans « Si tu es bloqué »).</p></details>
    <details><summary>Il me faut de l'argent pour continuer</summary><p>Certaines missions ne s'ouvrent qu'avec assez d'argent : par exemple 15 000 $ à la fin du chapitre 2. Braque des magasins, vends des voitures à Moses ou à Randy, ou fais les missions facultatives. Mets ton argent à la banque (BuckMe) : l'argent liquide est perdu si tu meurs.</p></details>
    <details><summary>La mission est trop dure</summary><p>1. Utilise le Focus : il ralentit le temps pour viser. 2. Soigne-toi avec des Zombix (5 maximum). 3. Change d'approche : en discrétion (accroupi, par derrière) ou à couvert avec une arme plus puissante. 4. Si tu échoues, tu reprends au dernier point de passage.</p></details>
    <details><summary>Peut-on rejouer une mission ?</summary><p>Non : GTA 6 n'a ni rejouer de mission ni médaille d'or. Sauvegarde avant les grosses missions pour pouvoir revenir en arrière.</p></details>
    <details><summary>J'ai raté une mission facultative</summary><p>Les missions marquées « peut être manquée » disparaissent au bout d'un moment. Ce n'est pas grave : elles ne comptent ni pour les trophées ni pour les 100 %.</p></details>
    <details><summary>Comment changer de personnage ?</summary><p>À partir de la mission « Pause café » (chapitre 2), maintiens droite sur la croix directionnelle pour passer de Jason à Lucia et donner des ordres à ton partenaire.</p></details>
  </section>
  <p class="note veh-sources">${icon('info')}<span>Liste et ordre des missions : <a href="https://www.gtabase.com/gta-6/missions" target="_blank" rel="noopener">GTABase</a>, recoupés avec <a href="https://gta6guide.fr/gta-6/missions" target="_blank" rel="noopener">gta6guide.fr</a> et <a href="https://gta.wiki/w/Missions_in_GTA_VI" target="_blank" rel="noopener">GTA Wiki</a> (relevé du 22/11/2026). Les résumés et les étapes sont écrits par GTA 6 Facile.</span></p>
</section>`;
  emit(p, layout({ p, title: 'Missions GTA 6 : toutes les solutions, chapitre par chapitre', desc: `Toutes les missions de GTA 6 (histoire et ${fac} facultatives) avec une solution courte, étape par étape, et de l'aide si tu es bloqué.`, body, cls: 'p-list', scripts: ['missions.js'], crumbs: [['Accueil', ''], ['Missions', 'missions/']] }));
}

// ---------- PAGES DES MISSIONS (une URL par mission) ----------
{
  const MS = MISSIONS.missions, CH = MISSIONS.chapitres;
  const chNom = (id) => (id === 'prologue' ? 'Prologue' : `Chapitre ${id}`);
  const PERS = { jason: 'Jason', lucia: 'Lucia' };
  const histoire = MS.filter((m) => !m.facultative);
  for (const m of MS) {
    const p = `missions/${m.id}/`, R = R_(p);
    const ch = CH.find((c) => c.id === m.chapitre) || {};
    const lieux = MLIEUX.filter((e) => e.missions.includes(m.id) && e.lieu && L[e.lieu]).map((e) => L[e.lieu]);
    const memeLieu = [...new Set(MLIEUX.filter((e) => e.missions.includes(m.id)).flatMap((e) => e.missions))].filter((id) => id !== m.id && MIS[id]).map((id) => MIS[id]).slice(0, 4);
    const i = histoire.indexOf(m);
    const prec = i > 0 ? histoire[i - 1] : null, suiv = i >= 0 && i < histoire.length - 1 ? histoire[i + 1] : null;
    const memeChap = m.facultative ? MS.filter((x) => x.chapitre === m.chapitre && x.facultative && x.id !== m.id).slice(0, 4) : [];
    const lienM = (x, k) => `<a class="mini" href="${R}missions/${x.id}/" style="--c:#ff3d6e"><span class="mini-ico">${icon('flag')}</span><span><small>${esc(k)}</small><b>${esc(x.nom)}</b></span>${icon('arrow-right')}</a>`;
    const tags = [m.facultative ? 'Facultative' : m.tache ? 'Petite tâche' : 'Histoire principale', m.manquable ? 'Peut être manquée' : ''].filter(Boolean);
    const body = `<article class="wrap fiche" style="--c:#ff3d6e">
  <header class="fiche-head" data-reveal-group>
    <div class="fiche-ico">${icon('flag', 'ic-xl')}</div>
    <div class="fiche-tags"><a class="pill pill--cat" href="${R}missions/#ch-${m.chapitre}">${icon('flag')}${chNom(m.chapitre)}${ch.titre && m.chapitre !== 'prologue' ? ` · ${esc(ch.titre)}` : ''}</a>${tags.map((t) => `<span class="pill">${esc(t)}</span>`).join('')}${m.num ? `<span class="pill">Mission ${m.num}</span>` : ''}</div>
    <h1 class="h1 h1--fiche">${esc(m.nom)} : solution de la mission</h1>
    ${m.nomEn && m.nomEn !== m.nom ? `<p class="muted">Nom anglais : ${esc(m.nomEn)}</p>` : ''}
  </header>
  <section class="answer"><span class="answer-k">${icon('bolt')}En bref</span><p>${esc(m.resume)}</p></section>
  <div class="actions">
    <a class="btn btn--primary" href="#etapes">${icon('list')}Voir la solution</a>
    ${missionsSur[m.id] ? `<a class="btn" href="${R}carte/?focus=${missionsSur[m.id]}&amp;mission=${m.id}">${icon('map')}Voir sur la carte</a>` : ''}
    <button class="btn btn--ghost" type="button" data-mission-faite="${m.id}" aria-pressed="false">${icon('check')}<span data-on="Mission faite" data-off="J'ai fini cette mission">J'ai fini cette mission</span></button>
  </div>
  <dl class="facts">
    <div><dt>${icon('user')}Tu joues</dt><dd>${m.perso.map((x) => PERS[x] || x).join(' et ')}</dd></div>
    ${m.donneur ? `<div><dt>${icon('phone')}Donnée par</dt><dd>${esc(m.donneur)}</dd></div>` : ''}
    ${m.recompense ? `<div><dt>${icon('money')}Récompense</dt><dd>${esc(m.recompense)}</dd></div>` : ''}
    ${lieux.length ? `<div><dt>${icon('pin')}Lieu</dt><dd>${lieux.map((l) => `<a href="${R}lieux/${l.id}/">${esc(l.nom)}</a>`).join(', ')}</dd></div>` : ''}
  </dl>
  <section class="steps-wrap" id="etapes" aria-labelledby="et-t">
    <h2 id="et-t" class="h3">${icon('list')}Solution étape par étape</h2>
    <ol class="steps">${m.etapes.map((e, n) => `<li class="step"><span class="step-n">${n + 1}</span><span class="step-t">${esc(e)}</span></li>`).join('')}</ol>
  </section>
  ${m.bloque.length ? `<section class="steps-wrap mis-bloque" aria-labelledby="bl-t"><h2 id="bl-t" class="h3">${icon('question')}Si tu es bloqué</h2><ul>${m.bloque.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></section>` : ''}
  ${prec || suiv ? `<nav class="related" aria-label="Missions de l'histoire"><h2 class="h3">${icon('flag')}Dans l'histoire</h2><div class="minis">${prec ? lienM(prec, 'Mission précédente') : ''}${suiv ? lienM(suiv, 'Mission suivante') : ''}</div></nav>` : ''}
  ${memeChap.length ? `<section class="related"><h2 class="h3">${icon('plus')}Autres missions facultatives du ${chNom(m.chapitre).toLowerCase()}</h2><div class="minis">${memeChap.map((x) => lienM(x, 'Facultative')).join('')}</div></section>` : ''}
  ${memeLieu.length ? `<section class="related"><h2 class="h3">${icon('pin')}Au même endroit</h2><div class="minis">${memeLieu.map((x) => lienM(x, chNom(x.chapitre))).join('')}</div></section>` : ''}
  <p class="muted small">${icon('info')}${m.sources.length > 1 ? `Mission confirmée par ${m.sources.map(esc).join(', ')}.` : `Mission listée par ${esc(m.sources[0])}.`} Étapes rédigées par ${M}. <a href="${R}missions/">Toutes les missions</a></p>
</article>`;
    emit(p, layout({
      p, title: titreSEO(`${m.nom} GTA 6 : solution de la mission`, `${m.nom} GTA 6 : solution`, `${m.nom} – GTA 6`),
      desc: descSEO(`Solution de la mission « ${m.nom} » (${chNom(m.chapitre)}) de GTA 6 :`, m.resume, 'Étapes détaillées et aide si tu es bloqué.'),
      body, cls: 'p-fiche', ogType: 'article',
      crumbs: [['Accueil', ''], ['Missions', 'missions/'], [m.nom, p]]
    }));
  }
}

// ---------- DOSSIERS (pages piliers) ----------
{
  const lienItem = (it, R) => it.carte && mapIndex[it.carte] ? `${R}carte/?focus=${it.carte}` : it.lien ? `${R}${it.lien}` : null;
  const libItem = (it) => it.carte && mapIndex[it.carte] ? 'Voir sur la carte' : it.lien && it.lien.startsWith('carte/') ? 'Voir sur la carte' : 'Voir';
  for (const D of DOSSIERS) for (const sec of D.sections) for (const it of sec.items || []) if (it.carte && !mapIndex[it.carte]) console.warn(`dossier ${D.slug} : repère inconnu ${it.carte}`);
  const item = (it, R) => {
    const href = lienItem(it, R);
    return `<li class="dos-it">${it.code ? `<span class="dos-code" aria-label="Code ${esc(it.code)}">${esc(it.code)}</span>` : it.n ? `<span class="dos-n">${esc(it.n)}</span>` : ''}<span class="dos-t"><b>${esc(it.t)}</b>${it.d ? `<small>${esc(it.d)}</small>` : ''}</span>${href ? `<a class="dos-go" href="${href}" aria-label="${esc(libItem(it))} : ${esc(it.t)}">${icon(it.carte || (it.lien || '').startsWith('carte/') ? 'map' : 'arrow-right')}<span>${esc(libItem(it))}</span></a>` : ''}</li>`;
  };
  const relLien = (u, R) => {
    const m = u.match(/^astuces\/([^/]+)\/$/);
    if (m) return relCard(m[1], R);
    const D = DOSSIERS.find((d) => `dossiers/${d.slug}/` === u);
    const lab = D ? [D.court, D.icon, D.couleur, 'Dossier'] : u.startsWith('carte/') ? ['La carte interactive', 'map', '#2de2e6', 'Carte'] : u === 'codes/' ? ['Codes de triche', 'code', '#9b6bff', 'Codes'] : u === 'missions/' ? ['Missions et solutions', 'flag', '#ff3d6e', 'Missions'] : [u, 'arrow-right', '#ff2bd6', 'Page'];
    return `<a class="mini" href="${R}${u}" style="--c:${lab[2]}"><span class="mini-ico">${icon(lab[1])}</span><span><small>${esc(lab[3])}</small><b>${esc(lab[0])}</b></span>${icon('arrow-right')}</a>`;
  };
  for (const D of DOSSIERS) {
    const p = `dossiers/${D.slug}/`, R = R_(p);
    const autres = DOSSIERS.filter((d) => d !== D).map((d) => `dossiers/${d.slug}/`);
    const body = `<article class="wrap fiche dos" style="--c:${D.couleur}">
  <header class="fiche-head">
    <div class="fiche-ico">${icon(D.icon, 'ic-xl')}</div>
    <div class="fiche-tags"><span class="pill pill--cat">${icon('book')}Dossier complet</span><span class="pill">${icon('clock')}Mis à jour le ${fmtDate('2026-11-23')}</span></div>
    <h1 class="h1 h1--fiche">${esc(D.titre)}</h1>
  </header>
  <section class="answer" aria-label="Réponse"><span class="answer-k">${icon('bolt')}En bref</span><p>${esc(D.reponse)}</p></section>
  <nav class="dos-toc" aria-label="Sommaire">${D.sections.map((sec, i) => `<a href="#s${i + 1}">${icon(sec.icon)}${esc(sec.titre)}</a>`).join('')}</nav>
  ${D.sections.map((sec, i) => `<section class="dos-sec${sec.warn ? ' dos-sec--warn' : ''}" id="s${i + 1}" aria-labelledby="s${i + 1}-t">
    <h2 class="h3" id="s${i + 1}-t">${icon(sec.icon)}${esc(sec.titre)}</h2>
    ${sec.intro ? `<p class="dos-intro">${esc(sec.intro)}</p>` : ''}
    ${sec.texte ? `<aside class="note">${icon('info')}<p>${esc(sec.texte)}</p></aside>` : ''}
    ${sec.items ? `<ul class="dos-list">${sec.items.map((it) => item(it, R)).join('')}</ul>` : ''}
    ${sec.etapes ? `<ol class="steps">${sec.etapes.map((t, j) => `<li class="step"><span class="step-n">${j + 1}</span><span class="step-t">${esc(t)}</span></li>`).join('')}</ol>` : ''}
  </section>`).join('')}
  <section class="related" aria-labelledby="va-t"><h2 id="va-t" class="h3">${icon('sparkle')}Voir aussi</h2><div class="minis">${[...D.liens, ...autres].map((u) => relLien(u, R)).join('')}</div></section>
  ${D.faq.length ? `<details class="more" open><summary>${icon('question')}Questions fréquentes</summary>${D.faq.map(([q, r]) => `<h3>${esc(q)}</h3><p>${esc(r)}</p>`).join('')}</details>` : ''}
  ${D.sources.length ? `<details class="sources"><summary>${icon('shield')}Sources (${D.sources.length})</summary><ul>${D.sources.map(([n, u]) => `<li><a href="${u}" rel="nofollow noopener" target="_blank">${esc(n)}</a></li>`).join('')}</ul><p class="muted">Relevé du 23/11/2026. Textes rédigés par GTA 6 Facile.</p></details>` : ''}
</article>`;
    emit(p, layout({
      p, title: titreSEO(D.seo, `${D.titre}`), desc: descSEO(D.desc), body, cls: 'p-fiche', ogType: 'article',
      crumbs: [['Accueil', ''], ['Dossiers', 'dossiers/'], [D.court, p]],
      schema: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: D.titre, acceptedAnswer: { '@type': 'Answer', text: D.reponse } }, ...D.faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } }))] }]
    }));
  }
  const p = 'dossiers/', R = R_(p);
  emit(p, layout({ p, title: 'Tous les guides GTA 6 : dossiers, astuces, codes et missions', desc: 'Tous les guides GTA 6 au même endroit : dossiers complets, astuces par thème, codes de triche, missions, véhicules et carte interactive.', cls: 'p-list', crumbs: [['Accueil', ''], ['Tous les guides', p]],
    body: (() => {
      // les plus recherchés d'abord : dossiers et rubriques phares, puis les astuces par intérêt
      const CATS = Object.fromEntries(site.categories.astuces.map((c) => [c.id, c]));
      const TOP = [
        ['codes/', 'gameplay', 'Codes de triche', 'gamepad', 'triche cheat ps5 xbox code'],
        ['dossiers/argent-rapide/', 'argent', 'Gagner de l\'argent vite', 'wallet', 'argent rapide braquage'],
        ['dossiers/codes-coffres/', 'argent', 'Codes de coffres', 'bank', 'coffre combinaison safe'],
        ['carte/', 'exploration', 'Carte interactive', 'map', 'carte emplacement'],
        ['missions/', 'missions', 'Missions et solutions', 'flag', 'mission soluce histoire'],
        ['vehicules/', 'vehicules', 'Tous les véhicules', 'car', 'voiture moto bateau avion'],
        ['dossiers/secrets/', 'exploration', 'Secrets et Easter eggs', 'sparkle', 'bigfoot ovni fantome'],
        ['dossiers/100-pour-cent/', 'exploration', 'Obtenir 100 %', 'trophy', 'cent pour cent checklist']
      ];
      const PRIO = ['code-argent', 'argent-debut', 'voiture-rare', 'voitures-gratuites', 'semer-la-police', 'armes-gratuites', 'meilleures-armes-debut', 'trouver-helicoptere', 'premier-avion', 'caches-argent', 'braquer-bijouteries', 'vendre-voitures-moses', 'operations-gangs', 'braquer-magasin', 'voler-voiture', 'garder-voiture-volee', 'entrer-un-code', 'code-focus-infini', 'codes-connus', 'codes-coffres', 'sauvegarder', 'se-soigner', 'augmenter-stats', 'voyage-rapide', 'fourgons-blindes', 'distributeurs', 'mode-focus', 'changer-de-look', 'personnaliser-voiture', 'stocker-vehicules'];
      const rang = (a) => { const k = PRIO.indexOf(a.slug); return k < 0 ? 100 + ASTUCES.indexOf(a) : k; };
      const items = [...TOP.map(([u, c, t, i, k]) => ({ u, c, t, i, k })), ...[...ASTUCES].sort((a, b) => rang(a) - rang(b)).map((a) => ({ u: `astuces/${a.slug}/`, c: a.cat, t: a.court, i: a.icon, k: [a.titre, ...(a.kw || [])].join(' ') }))];
      const F = [['', 'Tous'], ['argent', 'Argent'], ['vehicules', 'Véhicules'], ['gameplay', 'Gameplay'], ['missions', 'Missions'], ['debuter', 'Débutants'], ['exploration', 'Exploration']];
      return `<section class="wrap section tg" data-tg>
  <h1 class="h1">Tous les guides GTA 6</h1>
  <p class="lead">Trouve rapidement les conseils et solutions dont tu as besoin.</p>
  <label class="tg-search">${icon('search')}<span class="sr-only">Rechercher une astuce</span><input type="search" placeholder="Rechercher une astuce…" autocomplete="off" data-tg-q></label>
  <div class="tg-chips" role="group" aria-label="Filtrer">${F.map(([k, t], n) => `<button type="button" class="tg-chip" data-tg-f="${k}" aria-pressed="${n ? 'false' : 'true'}">${t}</button>`).join('')}</div>
  <div class="tg-head"><h2>Astuces disponibles</h2><span data-tg-count>${items.length} résultats</span></div>
  <ul class="tg-list" data-tg-list>${items.map((x) => { const c = CATS[x.c]; return `<li data-f="${x.c}" data-k="${esc(norm([x.t, c.nom, x.k].join(' ')))}"><a class="tg-card" href="${R}${x.u}" style="--c:${c.color}"><span class="tg-ico">${icon(x.i)}</span><span class="tg-txt"><small>${esc(c.nom)}</small><b>${esc(x.t)}</b></span>${icon('chevron')}</a></li>`; }).join('')}</ul>
  <p class="tg-empty" data-tg-empty hidden>Aucune astuce ne correspond. Essaie un autre mot.</p>
</section>
<script>(()=>{const b=document.querySelector('[data-tg]');if(!b)return;const q=b.querySelector('[data-tg-q]'),L=b.querySelector('[data-tg-list]'),E=b.querySelector('[data-tg-empty]'),C=b.querySelector('[data-tg-count]');let f='';const n=(x)=>x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const run=()=>{const w=n(q.value).split(/\s+/).filter(Boolean);let k=0;[...L.children].forEach((li)=>{const ok=(!f||li.dataset.f===f)&&w.every((x)=>li.dataset.k.includes(x));li.hidden=!ok;if(ok)k++});C.textContent=k+(k>1?' résultats':' résultat');E.hidden=k>0};
b.querySelectorAll('[data-tg-f]').forEach((c)=>c.addEventListener('click',()=>{f=c.dataset.tgF;b.querySelectorAll('[data-tg-f]').forEach((x)=>x.setAttribute('aria-pressed',String(x===c)));run()}));q.addEventListener('input',run)})();</script>`;
    })() }));
}

// ---------- CODES ----------
{
  const p = 'codes/', R = R_(p);
  const FL = { haut: 'Haut', bas: 'Bas', gauche: 'Gauche', droite: 'Droite' };
  const fleches = (seq) => `<div class="code-seq" role="img" aria-label="Combinaison : ${seq.map((d) => FL[d]).join(', ')}">${seq.map((d, i) => `<span class="dp dp--${d}">${icon('arrow-right')}</span>${i < seq.length - 1 ? '<i aria-hidden="true"></i>' : ''}`).join('')}</div>`;
  const C = CODES.codes, cats = CODES.categories;
  const connus = C.filter((c) => c.sequence.length).length;
  const carte = (c, k) => `<article class="code" id="${c.id}" style="--c:${k.color}" data-cat="${c.cat}" data-seq="${c.sequence.length ? 1 : 0}" data-text="${esc(norm([c.nom, c.nomEn, c.effet, c.deblocage, k.nom].join(' ')))}">
    <header class="code-h"><span class="code-ico">${icon(k.icon)}</span><div><h3>${esc(c.nom)}</h3></div></header>
    <p class="code-effet">${esc(c.effet)}</p>
    ${c.sequence.length ? fleches(c.sequence) : `<p class="code-tba">${icon('question')}Combinaison pas encore découverte</p>`}
    <p class="code-unlock">${icon('trophy')}<span><b>Pour le débloquer :</b> ${esc(c.deblocage)}</span></p>
    ${c.sequence.length ? `<p class="code-src ${c.confirme ? 'is-ok' : 'is-warn'}">${icon(c.confirme ? 'check' : 'alert')}${c.confirme ? `Combinaison confirmée par ${c.sources.length} guides` : `Combinaison donnée par un seul guide (${esc(c.sources.join(', '))}) : à vérifier`}</p>` : ''}
  </article>`;
  const body = `<section class="wrap section codes" data-codes>
  <h1 class="h1">Codes de triche GTA 6</h1>
  <p class="lead">Les <b>${C.length} codes de triche de GTA 6 (PS5 et Xbox) dont la combinaison est connue</b>. Pour chaque code : ce qu'il fait, comment le débloquer et les flèches à taper. Les codes dont la combinaison n'a pas encore été découverte ne sont pas listés : ils seront ajoutés dès qu'elle sera trouvée.</p>
  <ol class="howto">
    <li><span class="howto-n">1</span><span>${icon('flag')}<b>Termine l'histoire</b> La liste des codes apparaît dans le menu Progression.</span></li>
    <li><span class="howto-n">2</span><span>${icon('trophy')}<b>Débloque le code</b> Chaque code a son défi (sport, tir, collection…).</span></li>
    <li><span class="howto-n">3</span><span>${icon('phone')}<b>Tape-le au téléphone</b> Sors le téléphone, maintiens L1 et appuie sur R1 (PS5) ou LB + RB (Xbox), puis tape les flèches avec la croix.</span></li>
  </ol>
  <p class="note note--warn">${icon('alert')}<span>Un code actif <b>bloque la sauvegarde et les trophées</b> jusqu'à ce que tu quittes le jeu. Sauvegarde avant d'utiliser un code. Les codes sont les mêmes sur PS5 et Xbox ; il n'y a pas encore de version PC.</span></p>
  ${fieldFilter('Chercher un code : argent, munitions, tank…')}
  <div class="filterbar" role="group" aria-label="Filtrer les codes">
    <button class="chip" type="button" data-ccat="" aria-pressed="true">Tous <small>${C.length}</small></button>
    ${cats.map((k) => `<button class="chip" type="button" data-ccat="${k.id}" aria-pressed="false" style="--c:${k.color}">${icon(k.icon)}${esc(k.nom)} <small>${C.filter((c) => c.cat === k.id).length}</small></button>`).join('')}
  </div>
  <p class="count-line" data-ccount aria-live="polite"></p>
  ${cats.map((k) => `<section class="code-grp" data-cgrp="${k.id}" aria-labelledby="cg-${k.id}"><h2 class="vgrp-h" id="cg-${k.id}">${esc(k.nom)} <small>${C.filter((c) => c.cat === k.id).length}</small></h2>
    <div class="code-grid">${C.filter((c) => c.cat === k.id).sort((a, b) => (b.sequence.length ? 1 : 0) - (a.sequence.length ? 1 : 0)).map((c) => carte(c, k)).join('')}</div></section>`).join('')}
  <p class="empty" data-cempty hidden>${icon('search')}Aucun code ne correspond. Essaie un autre mot.</p>
  <section class="faq" aria-labelledby="faq-t"><h2 class="h3" id="faq-t">${icon('question')}Questions fréquentes</h2>
    <details><summary>Pourquoi mon code ne marche pas ?</summary><p>Un code ne fonctionne que s'il est débloqué : termine d'abord l'histoire, puis réussis son défi (indiqué sous chaque code). Vérifie aussi que tu maintiens bien L1 (ou LB) en appuyant sur R1 (ou RB) avant de taper les flèches.</p></details>
    <details><summary>Est-ce que les codes bloquent les trophées ?</summary><p>Oui, mais seulement pendant la session : tant qu'un code est actif, tu ne peux ni sauvegarder ni gagner de trophées. Quitte le jeu et recharge ta sauvegarde pour revenir à la normale. Ce que tu as fait pendant que le code était actif n'est pas gardé.</p></details>
    <details><summary>Y a-t-il un code d'invincibilité ou de santé ?</summary><p>Non. Aucun code connu ne rend invincible et il n'y a pas de code de santé.</p></details>
    <details><summary>Et sur PC ?</summary><p>GTA 6 n'est sorti que sur PS5 et Xbox Series. Les combinaisons utilisent seulement la croix directionnelle : elles sont identiques sur les deux consoles.</p></details>
  </section>
  <p class="note veh-sources">${icon('info')}<span>Sources : <a href="https://www.gtabase.com/gta-6/gta-6-cheats-ps5-cheat-codes" target="_blank" rel="noopener">GTABase</a>, <a href="https://gta.wiki/w/Cheats_in_GTA_VI" target="_blank" rel="noopener">GTA Wiki</a> et <a href="https://gta6guide.fr/gta-6/codes-triche" target="_blank" rel="noopener">gta6guide.fr</a> (relevé du 22/11/2026). Une combinaison est dite confirmée quand au moins deux de ces guides donnent la même.</span></p>
</section>`;
  emit(p, layout({ p, title: `Codes de triche GTA 6 PS5 et Xbox : les ${C.length} codes`, desc: `Les ${connus} codes de triche de GTA 6 sur PS5 et Xbox dont la combinaison est connue : ce que fait chaque code, comment le débloquer et les flèches à taper.`, body, cls: 'p-list', scripts: ['codes.js'], crumbs: [['Accueil', ''], ['Codes', 'codes/']] }));
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
    <div class="atp-cats" role="group" aria-label="Je cherche">
      <span class="atp-ask" aria-hidden="true">Je cherche</span>
      <button type="button" class="atp-chip atp-chip--all" data-all aria-pressed="true" style="--c:#fff">${icon('map')}Tout<small data-n="tout"></small></button>
      ${site.categories.carte.map((c) => `<button type="button" class="atp-chip" data-cat="${c.id}" aria-pressed="false" style="--c:${c.color}" title="${esc(c.sens)}">${icon(c.icon)}${esc(c.q)}<small data-n="${c.id}"></small></button>`).join('')}
      <button type="button" class="atp-chip atp-chip--commu" data-commu aria-pressed="false" style="--c:#c7c2e0"><i></i>Lieux de la communauté<small data-n="commu"></small></button>
    </div>
    <div class="atp-vide" data-vide hidden role="status">${icon('search')}<span><b>La carte est vide pour l'instant.</b> Touche ce que tu cherches juste au-dessus (une voiture, une arme, un objet…) pour afficher les lieux.</span></div>
    <div class="atp-solo" data-solo hidden role="status">${icon('flag')}<span>Seul le lieu de ta mission est affiché : <b data-solo-nom></b>.<i class="atp-solo-more"> Choisis ce que tu cherches pour voir le reste.</i></span><button type="button" data-solo-off>${icon('map')}Tout afficher</button></div>
  </div>
  <div class="atp-ctrl">
    <button type="button" class="hm-btn hm-btn--help" data-help aria-label="Comment utiliser la carte">${icon('question')}</button>
    <button type="button" class="hm-btn" data-z="in" aria-label="Zoomer">${icon('plus')}</button>
    <button type="button" class="hm-btn" data-z="out" aria-label="Dézoomer">${icon('minus')}</button>
    <button type="button" class="hm-btn" data-z="reset" aria-label="Voir toute la carte">${icon('expand')}</button>
  </div>
  <div class="atp-regions" role="group" aria-label="Liste et régions"><button type="button" class="atp-list" data-list>${icon('list')}Liste<small data-n="vue"></small></button>${CARTE.regions.map((r) => `<button type="button" data-reg="${r.id}" style="--c:${r.couleur}">${esc(r.nom)}</button>`).join('')}</div>
  <div class="atp-panel" data-panel role="region" aria-label="Détails" hidden aria-live="polite"></div>
  <details class="at-attrib at-attrib--page"><summary>${icon('info')}Sources</summary><p>${ATTRIB_HTML(R)} Lieux : GTADB, CC BY 4.0. Objets, armes, véhicules, braquages, commerces et activités : <a href="https://github.com/fbritoferreira/gta6" target="_blank" rel="noopener">Open GTA 6 Map</a> (fbritoferreira et contributeurs), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, positions converties et textes traduits.</p></details>
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
    <span class="card-body"><span class="card-kicker">${esc(c.nom.replace(/s$/, '').replace("Points d'intérêt", "Point d'intérêt"))}${reg && l.type !== 'region' ? ` · ${esc(reg.nom)}` : ''}</span><b class="card-title"><a href="${R}lieux/${l.id}/">${esc(l.nom)}</a></b>
    <span class="card-desc">${esc(l.desc)}${l.acces ? ` <i>${icon('compass')}${esc(l.acces)}</i>` : ''}</span>
    <span class="card-meta">${badge(l.statut)}</span></span>
    <span class="card-actions">${m ? `<a class="card-cta" href="${R}carte/?focus=${l.id}">${icon('map')}Voir sur la carte</a>` : `<span class="card-cta card-cta--off">${icon('question')}Position non vérifiée</span>`}${l.enc ? `<a class="card-cta" href="${R}encyclopedie/${l.enc}/">${icon('book')}Fiche</a>` : ''}<button class="card-cta fav fav--mini" type="button" data-fav='${esc(JSON.stringify({ id: l.id, type: 'lieu', t: l.nom, u: `lieux/${l.id}/`, i: l.icon, c: color }))}' aria-pressed="false" aria-label="Favori : ${esc(l.nom)}">${icon('heart')}</button></span>
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
  emit(p, layout({ p, title: 'Lieux GTA 6 : régions, quartiers et points d\u2019intérêt', desc: `Les ${LIEUX.length} lieux de GTA 6 par région et par type : où ils sont, comment y aller, les véhicules et les missions qui s'y trouvent.`, body, cls: 'p-list', crumbs: [['Accueil', ''], ['Lieux', 'lieux/']] }));
}

// ---------- PAGES DES LIEUX (une URL par lieu) ----------
for (const l of LIEUX) {
  const p = `lieux/${l.id}/`, R = R_(p);
  const c = cat('lieux', l.type);
  const reg = l.region && REG[l.region] && l.region !== l.id ? REG[l.region] : null;
  const zone = l.type === 'region' ? l.id : l.region;
  const m = onMap(l.id);
  const vg = vign(l.id, R);
  const vehs = VEHICULES.filter((v) => v.lieu === l.id || (l.type === 'region' && L[v.lieu] && L[v.lieu].region === l.id));
  const mis = [...new Set(MLIEUX.filter((e) => e.lieu === l.id).flatMap((e) => e.missions))].map((id) => MIS[id]).filter(Boolean).sort((a, b) => (a.num || 999) - (b.num || 999));
  const dedans = LIEUX.filter((x) => x.id !== l.id && (l.type === 'region' ? x.region === l.id : zone && x.region === zone && x.type !== 'region')).slice(0, l.type === 'region' ? 24 : 6);
  const astuce = l.astuce && A[l.astuce];
  const mini = (u, ico, k, t, col) => `<a class="mini" href="${R}${u}" style="--c:${col}"><span class="mini-ico">${icon(ico)}</span><span><small>${esc(k)}</small><b>${esc(t)}</b></span>${icon('arrow-right')}</a>`;
  const body = `<article class="wrap fiche" style="--c:${c.color}">
  <header class="fiche-head" data-reveal-group>
    <div class="fiche-ico">${icon(l.icon, 'ic-xl')}</div>
    <div class="fiche-tags"><a class="pill pill--cat" href="${R}lieux/?cat=${l.type}">${icon(c.icon)}${esc(c.nom.replace(/s$/, '').replace("Points d'intérêt", "Point d'intérêt"))}</a>${reg ? `<a class="pill" href="${R}lieux/${reg.id}/">${icon('pin')}${esc(reg.nom)}</a>` : ''}${badge(l.statut)}</div>
    <h1 class="h1 h1--fiche">${esc(l.nom)}</h1>
  </header>
  ${vg && m ? `<a class="map-banner" href="${R}carte/?focus=${l.id}" style="--img:url(${vg})"><i></i><span>${icon('map')}Voir sur la carte</span><small>${l.precision === 'exacte' ? 'Position vérifiée' : 'Position approximative'}</small></a>` : ''}
  <section class="answer"><span class="answer-k">${icon('pin')}${l.type === 'region' ? 'La région' : 'Le lieu'}</span><p>${esc(l.desc)}</p></section>
  <div class="actions">
    ${m ? `<a class="btn btn--primary" href="${R}carte/?focus=${l.id}">${icon('map')}Voir sur la carte</a>` : `<span class="btn btn--off" aria-disabled="true">${icon('map')}Position non vérifiée</span>`}
    ${l.enc && E[l.enc] ? `<a class="btn" href="${R}encyclopedie/${l.enc}/">${icon('book')}Fiche encyclopédie</a>` : ''}
    ${favBtn({ id: l.id, type: 'lieu', t: l.nom, u: p, i: l.icon, c: c.color })}
  </div>
  <dl class="facts">
    ${l.acces ? `<div><dt>${icon('compass')}Comment y aller</dt><dd>${esc(l.acces)}</dd></div>` : ''}
    ${reg ? `<div><dt>${icon('pin')}Région</dt><dd><a href="${R}lieux/${reg.id}/">${esc(reg.nom)}</a></dd></div>` : ''}
    ${l.service ? `<div><dt>${icon('bolt')}On y trouve</dt><dd>${esc(l.service)}</dd></div>` : ''}
    <div><dt>${icon('shield')}Fiabilité</dt><dd>${esc(statut(l.statut).nom)}${l.precision ? ` · position ${l.precision === 'exacte' ? 'vérifiée' : l.precision === 'zone' ? 'à l’échelle de la zone' : 'approximative'}` : ''}</dd></div>
  </dl>
  ${astuce ? `<section class="related"><h2 class="h3">${icon('bolt')}Le guide pour ce lieu</h2><div class="minis">${relCard(l.astuce, R)}</div></section>` : ''}
  ${mis.length ? `<section class="related"><h2 class="h3">${icon('flag')}Missions ici</h2><div class="minis">${mis.slice(0, 8).map((x) => mini(`missions/${x.id}/`, 'flag', x.chapitre === 'prologue' ? 'Prologue' : `Chapitre ${x.chapitre}`, x.nom, '#ff3d6e')).join('')}</div></section>` : ''}
  ${vehs.length ? `<section class="related"><h2 class="h3">${icon('car')}Véhicules à trouver ${l.type === 'region' ? 'dans la région' : 'ici'}</h2><div class="minis">${vehs.slice(0, 8).map((v) => relCard(v.slug, R)).join('')}</div></section>` : ''}
  ${dedans.length ? `<section class="related"><h2 class="h3">${icon('pin')}${l.type === 'region' ? 'Dans cette région' : 'À proximité, dans la même région'}</h2><div class="minis">${dedans.map((x) => mini(`lieux/${x.id}/`, x.icon, cat('lieux', x.type).nom.replace(/s$/, ''), x.nom, cat('lieux', x.type).color)).join('')}</div></section>` : ''}
  ${sourcesBlock(l.sources)}
</article>`;
  emit(p, layout({
    p, title: titreSEO(l.type === 'region' ? `${l.nom} GTA 6 : la région, ses lieux et missions` : `${l.nom} GTA 6 : où c'est et comment y aller`, `${l.nom} GTA 6 : où c'est`, `${l.nom} – GTA 6`),
    desc: descSEO(`${l.nom} dans GTA 6${reg ? ` (${reg.nom})` : ''} :`, l.desc, l.acces || '', m ? 'Position sur la carte interactive.' : '', mis.length ? `${mis.length} mission${mis.length > 1 ? 's' : ''} ici.` : ''),
    body, cls: 'p-fiche', ogType: 'article',
    crumbs: [['Accueil', ''], ['Lieux', 'lieux/'], ...(reg ? [[reg.nom, `lieux/${reg.id}/`]] : []), [l.nom, p]]
  }));
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
  emit(p, layout({ p, title: titreSEO(...(/GTA 6/.test(a.titre) ? [`${a.titre} : l'essentiel`, a.titre] : [`${a.titre} – GTA 6 : l'essentiel`, `${a.titre} – GTA 6`, `GTA 6 : ${a.titre}`])), desc: descSEO(a.bref, a.change), body, cls: 'p-fiche', ogType: 'article', crumbs: [['Accueil', ''], ['Actualités', 'actualites/'], [a.titre, p]], schema: [{ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.titre, datePublished: a.date, dateModified: site.majLe, description: a.bref, inLanguage: 'fr', isBasedOn: src ? src.u : undefined }] }));
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
  <p class="lead">Ton compte, tes favoris et ta progression.</p>
  <div class="auth" data-auth>
    <div data-auth-off>
      <div class="auth-tabs" role="tablist"><button type="button" role="tab" data-auth-tab="connexion" aria-selected="true">Se connecter</button><button type="button" role="tab" data-auth-tab="inscription" aria-selected="false">Créer un compte</button></div>
      <p class="auth-why">${icon('heart')}<span>Avec un compte, tes favoris et ta progression te suivent sur tous tes appareils. Sans compte, tout reste sur cet appareil.</span></p>
      <form class="auth-form" data-auth-view="connexion" data-form="connexion">
        <label>E-mail<input type="email" name="email" autocomplete="email" required></label>
        <label>Mot de passe<input type="password" name="mdp" autocomplete="current-password" required></label>
        <button class="btn btn--primary" type="submit">${icon('user')}Me connecter</button>
        <a href="#" class="auth-link" data-auth-go="oubli">Mot de passe oublié ?</a>
      </form>
      <form class="auth-form" data-auth-view="inscription" data-form="inscription" hidden>
        <label>E-mail<input type="email" name="email" autocomplete="email" required></label>
        <label>Mot de passe <small>(8 caractères minimum)</small><input type="password" name="mdp" autocomplete="new-password" minlength="8" required></label>
        <label>Confirme le mot de passe<input type="password" name="mdp2" autocomplete="new-password" minlength="8" required></label>
        <label class="auth-check"><input type="checkbox" name="ok"> <span>J'accepte que mon e-mail serve uniquement à mon compte GTA 6 Facile (voir <a href="${R}a-propos/#donnees">données personnelles</a>).</span></label>
        <button class="btn btn--primary" type="submit">${icon('plus')}Créer mon compte</button>
      </form>
      <form class="auth-form" data-auth-view="oubli" data-form="oubli" hidden>
        <p>Indique ton e-mail : tu recevras un lien pour choisir un nouveau mot de passe.</p>
        <label>E-mail<input type="email" name="email" autocomplete="email" required></label>
        <button class="btn btn--primary" type="submit">${icon('mail')}Recevoir le lien</button>
        <a href="#" class="auth-link" data-auth-go="connexion">Retour à la connexion</a>
      </form>
    </div>
    <div data-auth-on hidden>
      <div class="auth-me"><span class="tile-ico">${icon('user')}</span><div><small>Connecté avec</small><b data-auth-email></b><span class="auth-sync" data-auth-sync>Synchronisation…</span></div></div>
      <form class="auth-form" data-auth-new data-form="nouveau" hidden><label>Nouveau mot de passe<input type="password" name="mdp" autocomplete="new-password" minlength="8" required></label><button class="btn btn--primary" type="submit">${icon('check')}Enregistrer</button></form>
      <a class="btn btn--primary auth-admin" href="${R}admin/" data-auth-admin hidden>${icon('shield')}Administration</a>
      <div class="auth-actions"><button class="btn" type="button" data-auth-out>${icon('arrow-left')}Me déconnecter</button><button class="btn btn--ghost auth-del" type="button" data-auth-del>${icon('x')}Supprimer mon compte</button></div>
    </div>
    <p class="auth-msg" data-auth-msg role="status" aria-live="polite" hidden></p>
  </div>
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

// ---------- ADMINISTRATION (page vide : tout est chargé après vérification du compte par Supabase) ----------
{
  const p = 'admin/', R = R_(p);
  const body = `<section class="wrap section adm" data-admin>
  <h1 class="h1">${icon('shield')}Administration</h1>
  <p class="note" data-adm-etat>${icon('clock')}<span>Vérification de ton accès…</span></p>
  <div data-adm-app hidden>
    <div class="adm-pub" data-adm-pub></div>
    <div class="adm-tabs" role="tablist">
      <button type="button" role="tab" data-adm-tab="stats" aria-selected="true">${icon('star')}Statistiques</button>
      <button type="button" role="tab" data-adm-tab="contenu" aria-selected="false">${icon('book')}Contenu</button>
      <button type="button" role="tab" data-adm-tab="comptes" aria-selected="false">${icon('user')}Comptes</button>
    </div>
    <div data-adm-vue="stats"></div>
    <div data-adm-vue="contenu" hidden></div>
    <div data-adm-vue="comptes" hidden></div>
  </div>
</section>`;
  emit(p, layout({ p, title: `Administration | ${M}`, desc: 'Espace réservé à l’administrateur.', body, noindex: true, cls: 'p-admin', scripts: ['admin.js'], crumbs: [['Accueil', ''], ['Administration', p]] }));
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
    <div class="st st--ok">${badge('confirme')}<p>Confirmé par plusieurs sources qui concordent.</p></div>
    <div class="st st--wait">${badge('a-verifier')}<p>Donné par les guides, pas encore recoupé partout.</p></div>
    <div class="st st--part">${badge('provisoire')}<p>Information partielle ou donnée par une seule source.</p></div>
  </section>
  <section id="sources" class="related"><h2 class="h3">${icon('book')}Nos sources</h2><p>Les annonces officielles de Rockstar Games d'abord. Ensuite, les guides de sites spécialisés, recoupés quand c'est possible. Chaque fiche liste ses sources.</p>
  <p>La carte interactive utilise la carte communautaire <a href="https://map.gtadb.org" target="_blank" rel="noopener">« Yanis v18 — GTA VI Community Map »</a> et le catalogue de lieux de GTADB et de ses contributeurs, sous licence <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Nous l'avons recolorée, retiré sa légende et redécoupée. C'est une reconstruction de fans, approximative, et non la carte officielle de Rockstar Games.</p>
  <p>Les objets à collectionner, armes au sol, véhicules remarquables, braquages, commerces et activités viennent d'<a href="https://github.com/fbritoferreira/gta6" target="_blank" rel="noopener">Open GTA 6 Map</a> (fbritoferreira et contributeurs), sous licence <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Nous avons sélectionné les emplacements utiles, converti leurs positions sur notre carte et traduit en français les types, les noms et les indications des joueurs.</p>
  <details class="sources"><summary>${icon('shield')}Toutes les sources (${allSrc.length})</summary><ul>${allSrc.map((s) => `<li><a href="${s.u}" rel="nofollow noopener" target="_blank">${esc(s.n)}</a></li>`).join('')}</ul></details></section>
  <section id="donnees" class="related"><h2 class="h3">${icon('user')}Données personnelles</h2>
    <p>Le site s'utilise sans compte : tes favoris et ta progression restent alors dans ton navigateur, rien n'est envoyé.</p>
    <p>Si tu crées un compte, on enregistre uniquement ton adresse e-mail, ton mot de passe (chiffré, illisible même pour nous), tes favoris et ta progression, pour te les rendre sur tous tes appareils. Ces données sont hébergées par <a href="https://supabase.com" target="_blank" rel="noopener">Supabase</a>. Elles ne sont ni vendues, ni partagées, ni utilisées pour de la publicité.</p>
    <p>Tu peux supprimer ton compte à tout moment depuis <a href="${R}compte/">Mon espace</a> : toutes tes données en ligne sont alors effacées. ${site.editeur && site.editeur.nom ? `Tous les détails : <a href="${R}mentions-legales/#confidentialite">mentions légales et confidentialité</a>.` : ''}</p>
  </section>
  <section id="contact" class="related"><h2 class="h3">${icon('mail')}Nous contacter</h2><p>Une erreur, un emplacement à corriger ? Écris à <a href="mailto:${site.editeur.email}">${site.editeur.email}</a>${''} ou <a href="https://github.com/y769d459yn-hub/gta6-ultimate-v2/issues" rel="noopener" target="_blank">signale-le sur GitHub</a>.</p></section>
  <p class="note">${icon('info')}<span>Site indépendant, non affilié à Rockstar Games ni Take-Two. Les pictogrammes et la carte néon sont des créations du site. Les images de véhicules appartiennent à Rockstar Games : leur origine est indiquée sous chaque image.</span></p>
</section>`;
  emit(p, layout({ p, title: `À propos : méthode et fiabilité | ${M}`, desc: 'Découvrez comment les informations GTA 6 sont vérifiées et comment reconnaître les contenus confirmés.', body, cls: 'p-about', crumbs: [['Accueil', ''], ['À propos', 'a-propos/']] }));
}

// ---------- MENTIONS LÉGALES ET CONFIDENTIALITÉ (générée seulement quand l'éditeur est renseigné dans data/site.json) ----------
if (site.editeur && site.editeur.nom) {
  const p = 'mentions-legales/', R = R_(p);
  const E = site.editeur;
  const mail = `<a href="mailto:${E.email}">${E.email}</a>`;
  const body = `<article class="wrap fiche legal">
  <h1 class="h1">Mentions légales et confidentialité</h1>
  <section class="related"><h2 class="h3">${icon('user')}Éditeur du site</h2>
    <p><b>${esc(E.nom)}</b>, particulier. Directeur de la publication : ${esc(E.nom)}.<br>Contact : ${mail}</p>
    <p>${M} (${site.url.replace('https://', '')}) est un guide de fan, indépendant, non affilié à Rockstar Games ni à Take-Two Interactive.</p>
  </section>
  <section class="related"><h2 class="h3">${icon('shield')}Hébergement</h2>
    <p>Le site est hébergé par <b>GitHub, Inc.</b> (service GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis — <a href="https://github.com" rel="noopener" target="_blank">github.com</a>.</p>
    <p>Les comptes visiteurs sont hébergés par <b>Supabase</b> (<a href="https://supabase.com/privacy" rel="noopener" target="_blank">politique de confidentialité de Supabase</a>). Le nom de domaine est enregistré auprès d'OVHcloud.</p>
  </section>
  <section class="related" id="confidentialite"><h2 class="h3">${icon('user')}Données personnelles</h2>
    <p><b>Responsable du traitement :</b> ${esc(E.nom)} — ${mail}.</p>
    <p><b>Sans compte</b>, le site n'enregistre rien sur toi : tes favoris, ta progression et tes préférences restent dans la mémoire de ton navigateur (stockage local), sur ton appareil. Le site n'utilise ni cookie publicitaire, ni outil de mesure d'audience, ni bouton de réseau social.</p>
    <p><b>Avec un compte</b>, on enregistre ton adresse e-mail, ton mot de passe (chiffré, illisible même pour nous), tes favoris et ta progression, dans le seul but de te les rendre sur tous tes appareils. Base légale : l'exécution du service que tu demandes en créant ton compte. Ces données ne sont ni vendues, ni partagées, ni utilisées pour de la publicité. Elles sont conservées tant que ton compte existe et effacées quand tu le supprimes depuis <a href="${R}compte/">Mon espace</a>.</p>
    <p><b>Prestataires :</b> Supabase héberge les comptes ; GitHub héberge les pages et, comme tout hébergeur, peut conserver des journaux techniques (dont l'adresse IP) pour la sécurité du service.</p>
    <p><b>Tes droits :</b> accès, rectification, effacement, portabilité, limitation et opposition. Écris à ${mail}. Tu peux aussi adresser une réclamation à la <a href="https://www.cnil.fr/fr/plaintes" rel="noopener" target="_blank">CNIL</a>.</p>
  </section>
  <section class="related"><h2 class="h3">${icon('book')}Propriété intellectuelle</h2>
    <p>Grand Theft Auto, GTA et les noms, images et marques liés au jeu appartiennent à Take-Two Interactive et Rockstar Games. Les images du jeu sont utilisées à titre d'illustration, avec leur origine indiquée sous chaque image. Les textes, pictogrammes et la carte néon sont des créations du site.</p>
  </section>
  <p class="muted small">Dernière mise à jour : ${fmtDate(site.majLe)}.</p>
</article>`;
  emit(p, layout({ p, title: `Mentions légales et confidentialité | ${M}`, desc: `Éditeur, hébergement, données personnelles et droits des visiteurs de ${M}.`, body, cls: 'p-about', crumbs: [['Accueil', ''], ['Mentions légales', p]] }));
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
for (const x of CATALOGUE.vehicules) { const c = cat('vehicules', x.type); push({ t: x.nom, q: x.classe, k: norm([x.nom, x.fabricant || '', x.classe, c.nom, x.inspiration || '', 'vehicule'].join(' ')), d: x.inspiration ? `Inspiré de ${x.inspiration}` : x.classe, u: `vehicules/${x.slug}/`, i: c.icon, c: c.color, g: 'vehicule', s: x.type, l: 'Véhicule · ' + x.classe, m: 0, f: '' }); }
for (const v of VEHICULES) { const c = cat('vehicules', v.type); const l = L[v.lieu]; push({ t: v.nom, q: v.sous, k: norm([v.kw.join(' '), c.nom, 'vehicule voiture', l ? l.nom : ''].join(' ')), d: v.emplacement.slice(0, 90), u: `vehicules/${v.slug}/`, i: c.icon, c: v.color || c.color, g: 'vehicule', s: v.type, l: 'Véhicule · ' + c.nom, m: vehOnMap(v.slug) ? 1 : 0, f: vehOnMap(v.slug) ? 'v-' + v.slug : '' }); }
for (const l of LIEUX) { const c = cat('lieux', l.type); const act = l.mapcat === 'activites'; push({ t: l.nom, q: '', k: norm([l.kw.join(' '), c.nom, act ? 'activite' : 'lieu', l.region && REG[l.region] ? REG[l.region].nom : ''].join(' ')), d: l.desc.slice(0, 90), u: `lieux/${l.id}/`, i: l.icon, c: c.color, g: act ? 'activite' : 'lieu', s: l.type, l: act ? 'Activité' : 'Lieu · ' + c.nom, m: onMap(l.id) ? 1 : 0, f: onMap(l.id) ? l.id : '' }); }
for (const e of ENC) { const c = cat('encyclopedie', e.cat); push({ t: e.nom, q: '', k: norm([c.nom, e.cat === 'personnages' ? 'personnage perso' : ''].join(' ')), d: e.bref.slice(0, 90), u: `encyclopedie/${e.slug}/`, i: e.icon, c: c.color, g: e.cat === 'personnages' ? 'personnage' : 'ency', s: e.cat, l: 'Encyclopédie · ' + c.nom, m: 0 }); }
for (const a of ACTUS) push({ t: a.titre, q: '', k: norm('actualite news info ' + a.theme), d: fmtDate(a.date), u: `actualites/${a.slug}/`, i: 'news', c: '#3ddc84', g: 'actu', s: a.theme, l: 'Actu', m: 0 });
const CCAT = Object.fromEntries(site.categories.carte.map((c) => [c.id, c]));
{
  const types = {}; for (const f of features) if (f.properties.src === 'ogm') { const k = f.properties.cat + '|' + f.properties.service; (types[k] ||= { ...f.properties, n: 0 }).n++; }
  for (const t of Object.values(types)) { const c = CCAT[t.cat]; push({ t: `${t.service} (${t.n})`, q: c.q, k: norm(`${t.service} ${c.nom} ${c.q} carte ou trouver emplacement tous`), d: `Tous les emplacements sur la carte · ${c.nom}`, u: `carte/?cat=${t.cat}`, i: t.icon, c: c.color, g: 'lieu', s: t.cat, l: `Carte · ${c.nom}`, m: 1 }); }
}
const dejaT = new Set(index.map((x) => norm(x.t)));
for (const f of features.filter((f) => /^[sm]-/.test(f.properties.id) && !dejaT.has(norm(f.properties.nom)))) { const p = f.properties, c = CCAT[p.cat]; push({ t: p.nom, q: p.service, k: norm(`${p.service} ${c.nom} ${c.q} carte ou trouver ${p.desc}`), d: p.desc.slice(0, 90), u: `carte/?focus=${p.id}`, i: p.icon, c: c.color, g: 'lieu', s: p.cat, l: `${c.nom} · ${p.service}`, m: 1, f: p.id }); }
push({ t: 'Missions et solutions', q: 'missions', k: 'missions mission solution soluce chapitre histoire bloque que faire objectif', d: `Toutes les missions, étape par étape`, u: 'missions/', i: 'flag', c: '#ff3d6e', g: 'page', s: '', l: 'Page', m: 0 });
for (const m of MISSIONS.missions) push({ t: `Mission : ${m.nom}`, q: '', k: norm(['mission solution soluce', m.nom, m.nomEn, m.donneur, m.resume].join(' ')), d: m.resume, u: `missions/${m.id}/`, i: 'flag', c: '#ff3d6e', g: 'astuce', s: '', l: m.chapitre === 'prologue' ? 'Mission · Prologue' : `Mission · Chapitre ${m.chapitre}`, m: 0 });
push({ t: 'Codes de triche', q: 'cheat', k: 'codes triche cheat cheats astuce code argent munitions tank', d: `Les ${CODES.codes.length} codes et comment les débloquer`, u: 'codes/', i: 'code', c: '#9b6bff', g: 'page', s: '', l: 'Page', m: 0 });
for (const d of DOSSIERS) push({ t: d.titre, q: d.court, k: norm([d.titre, d.court, d.seo, d.desc, d.reponse, ...d.sections.map((x) => x.titre)].join(' ')), d: d.reponse, u: `dossiers/${d.slug}/`, i: d.icon, c: d.couleur, g: 'page', s: '', l: 'Dossier', m: 0 });
for (const c of CODES.codes) push({ t: `Code : ${c.nom}`, q: '', k: norm(['code triche cheat', c.nom, c.nomEn, c.effet].join(' ')), d: c.effet, u: `codes/#${c.id}`, i: 'code', c: '#9b6bff', g: 'astuce', s: '', l: 'Code', m: 0 });
push({ t: 'Carte interactive', q: 'map', k: 'carte map plan leonida', d: 'Tous les repères', u: 'carte/', i: 'map', c: '#19d3e3', g: 'page', s: '', l: 'Page', m: 0 });
push({ t: 'Mes favoris', q: '', k: 'favoris coeur enregistre', d: '', u: 'favoris/', i: 'heart', c: '#ff2d87', g: 'page', s: '', l: 'Page', m: 0 });

const syn = Object.entries(site.synonymes).map(([k, vs]) => [norm(k), ...vs.map(norm)]);
const popular = ['semer-la-police', 'argent-debut', 'sauvegarder', 'voyage-rapide', 'entrer-un-code', 'voiture-rare'].map((s) => ({ t: A[s].court, u: `astuces/${s}/`, i: A[s].icon, c: cat('astuces', A[s].cat).color }));

// ---------- écriture ----------
fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
for (const { p, html } of pages) write(p.endsWith('.html') ? p : p + 'index.html', html);
// pas deux résultats au même nom : on garde la page la plus complète (astuce, page, encyclopédie, véhicule, puis repère de carte)
{
  const PRIO = { astuce: 0, page: 1, personnage: 2, ency: 2, vehicule: 3, actu: 4, activite: 5, lieu: 6 };
  const best = {};
  index.forEach((x, i) => { const k = norm(x.t); if (!(k in best) || (PRIO[x.g] ?? 9) < (PRIO[index[best[k]].g] ?? 9)) best[k] = i; });
  const garde = new Set(Object.values(best));
  for (let i = index.length - 1; i >= 0; i--) if (!garde.has(i)) index.splice(i, 1);
}
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
// accueil : la mini-carte n'a besoin que des repères du guide (fichier léger)
write('data/carte-accueil.json', JSON.stringify({
  type: 'FeatureCollection', version: 2, info: CARTE.info, attribution: ATTRIBUTION,
  tuiles: { tileSize: TUILES.tileSize, monde: TUILES.monde, zero: TUILES.zero, fond: TUILES.fond, niveaux: TUILES.niveaux },
  bornes: CARTE.bornes, vueInitiale: CARTE.vueInitiale,
  regions: CARTE.regions.map((r) => ({ ...r, label: POS[r.id] })),
  categories: site.categories.carte,
  sousTypes: { vehicules: site.categories.vehicules.map(({ id, nom }) => ({ id, nom })), lieux: site.categories.lieux.map(({ id, nom }) => ({ id, nom })), activites: LIEUX.filter((l) => l.mapcat === 'activites' && onMap(l.id)).map((l) => ({ id: l.id, nom: l.nom })) },
  features: features.filter((f) => f.properties.src !== 'ogm')
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

// comptes visiteurs : configuration publique de Supabase injectée en tête de compte.js
const compteJs = path.join(OUT, 'assets', 'compte.js');
fs.writeFileSync(compteJs, `window.LG_SB=${JSON.stringify(site.comptes || {})};\n` + fs.readFileSync(compteJs, 'utf8'));

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset=".55" stop-color="#ff2d87"/><stop offset="1" stop-color="#8a3ffc"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#140a22"/><circle cx="32" cy="30" r="18" fill="url(#g)"/><path d="M14 36h36M16 41h32M20 46h24" stroke="#140a22" stroke-width="3"/></svg>`;
write('favicon.svg', favicon);
write('manifest.webmanifest', JSON.stringify({ name: M, short_name: 'GTA 6 Facile', start_url: './', display: 'standalone', background_color: '#140a22', theme_color: '#140a22', icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }));
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
const indexable = pages.filter(({ p, html }) => !p.endsWith('.html') && !html.includes('noindex'));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map(({ p }) => `<url><loc>${site.url}/${p}</loc><lastmod>${(p.startsWith('actualites/') && N[p.split('/')[1]] && N[p.split('/')[1]].date) || site.majLe}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('.nojekyll', '');
// administration : contenu d'origine (avant modifications) et état de la dernière publication
write('assets/admin-donnees.json', JSON.stringify(Object.fromEntries(Object.entries(COLLECTIONS).map(([, [nom, , cle, titre]]) => [nom, { cle, titre, items: ORIGINAUX[nom] || [] }]))));
write('assets/publication.json', JSON.stringify({ sha: process.env.CONTENU_SHA || '', date: new Date().toISOString(), modifications: ADMIN_APPLIQUES, erreur: process.env.CONTENU_ERREUR === '1' }));
// adresse personnalisée (GitHub Pages)
if (!site.url.includes('github.io')) write('CNAME', new URL(site.url).hostname + '\n');

console.log(`✓ ${pages.length} pages · ${index.length} entrées de recherche · ${features.length} repères carte → docs/`);
