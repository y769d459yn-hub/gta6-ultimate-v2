// Générateur statique : data/*.json + src/ → docs/ (GitHub Pages)
import fs from 'node:fs';
import crypto from 'node:crypto';
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
  'lieux.json': ['lieux', null, 'id', 'nom'], 'vehicules.json': ['vehicules', null, 'slug', 'nom'],
  'glitchs.json': ['glitchs', 'glitchs', 'slug', 'titre'], 'versions-jeu.json': ['versions', null, 'id', 'id']
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
// ---------- GLITCHS : données (data/glitchs.json, data/versions-jeu.json, modifiables depuis l'administration) ----------
const GLX = read('glitchs.json');
const VERSIONS = read('versions-jeu.json').slice().sort((a, b) => a.date.localeCompare(b.date));
const VDERN = VERSIONS[VERSIONS.length - 1] || null;
const GSTATUTS = {
  fonctionnel: { n: 'Fonctionnel', ic: 'check', c: '#3ddc84', t: 'Reproduit de façon documentée sur une version identifiée du jeu.', poids: 100 },
  documente: { n: 'Bien documenté', ic: 'book', c: '#4da3ff', t: 'Plusieurs sources indépendantes concordent, mais le fonctionnement sur la dernière version n’est pas entièrement établi.', poids: 70 },
  'a-reverifier': { n: 'À revérifier', ic: 'clock', c: '#ffa53a', t: 'Une mise à jour est sortie depuis les derniers témoignages, ou ceux-ci se contredisent.', poids: 40 },
  'non-confirme': { n: 'Non confirmé', ic: 'question', c: '#b3aec4', t: 'Les preuves disponibles sont insuffisantes.', poids: 10 },
  corrige: { n: 'Corrigé', ic: 'x', c: '#ff5a5a', t: 'Corrigé par une mise à jour, ou ne fonctionne plus de façon établie.', poids: -50 },
  faux: { n: 'Faux', ic: 'alert', c: '#8f8aa3', t: 'Méthode trompeuse, ou résultat démontré inexistant.', poids: -100 }
};
const GCATS = {
  argent: { n: 'Argent', ic: 'money', c: '#39ff88' }, vehicules: { n: 'Véhicules', ic: 'car', c: '#ff9a1f' }, armes: { n: 'Armes', ic: 'gun', c: '#ff3048' },
  secrets: { n: 'Secrets', ic: 'secret', c: '#ff2d87' }, gameplay: { n: 'Gameplay', ic: 'gamepad', c: '#19d3e3' }, duplication: { n: 'Duplication', ic: 'layers', c: '#b36bff' }
};
const cmpV = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
// statut affiché : un glitch « fonctionnel » ou « bien documenté » établi avant la dernière version du jeu passe « à revérifier » (le dernier statut connu reste affiché)
function gStatut(g) {
  if (VDERN && ['fonctionnel', 'documente'].includes(g.statut) && (g.version ? cmpV(g.version, VDERN.id) < 0 : (g.etabliLe || '') < VDERN.date)) return { id: 'a-reverifier', avant: g.statut, depuis: VDERN };
  return { id: g.statut };
}
const DIFF = { facile: 'Facile', moyenne: 'Moyenne', difficile: 'Difficile' };
// classement : fiabilité d'abord (un glitch douteux ne passe jamais devant un glitch fiable), puis utilité, facilité, gain connu, fraîcheur de la vérification
const gScore = (g) => GSTATUTS[gStatut(g).id].poids * 10 + (g.utilite || 0) * 10 + (g.difficulte === 'facile' ? 8 : g.difficulte === 'moyenne' ? 4 : 0) + (g.gainCourt ? 6 : 0) - Math.min(30, Math.floor((Date.parse('2026-12-31') - Date.parse(g.verifieLe || '2026-01-01')) / 864e5 / 10));
const GLITCHS = GLX.glitchs.filter((g) => g.publie && (g.sources || []).some((x) => x.lu)).sort((a, b) => gScore(b) - gScore(a));
const GL_RECO = GLITCHS.filter((g) => ['fonctionnel', 'documente', 'a-reverifier'].includes(gStatut(g).id));
const VEHICULES = read('vehicules.json');
// Catalogue complet (GTABase + gta6guide.fr, tools/catalogue.py) : véhicules sans fiche détaillée + infos des fiches
// Vérification de présence dans GTA 6 (tools/verification.py : site officiel, GTA Wiki, GTABase, gta6guide.fr)
const VERIF = fs.existsSync(path.join(ROOT, 'data', 'verification.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'verification.json'), 'utf8')).vehicules : {};
const verifTexte = (s) => { const v = VERIF[s]; if (!v) return ''; return v.statut === 'confirme' ? (v.preuves.length ? `Confirmé par ${v.preuves.join(' et ')}` : 'Type de véhicule confirmé') : v.statut === 'non-confirme' ? 'Non confirmé' : 'À confirmer : vu seulement sur GTABase ou gta6guide.fr'; };
const MISSIONS = fs.existsSync(path.join(ROOT, 'data', 'missions.json')) ? read('missions.json') : { chapitres: [], missions: [] };
// Ordre des missions : position selon chaque source ; « ecart » = les sources ne donnent pas le même ordre dans le chapitre
const MORDRE = fs.existsSync(path.join(ROOT, 'data', 'missions-ordre.json')) ? read('missions-ordre.json').missions : {};
// Compléments des fiches de missions (objectif, condition, erreurs fréquentes, récompense annoncée) : d'après le guide GTABase, non vérifiés en jeu
const MGUIDE = fs.existsSync(path.join(ROOT, 'data', 'missions-guide.json')) ? read('missions-guide.json') : { missions: {} };
const ordreAVerifier = (m) => !!(MORDRE[m.id] && MORDRE[m.id].ecart.length);
const ORDRE_NOTE = "GTABase présente sa liste « dans l'ordre chronologique », mais l'a réordonnée entre le 22 et le 25/11/2026 ; GTA Wiki n'explique pas son classement. Aucune source ne dit s'il s'agit de l'ordre de l'histoire ou de l'ordre de déblocage, ni si certaines missions peuvent se faire dans un ordre libre.";
// rang d'une mission dans son chapitre, selon une source (liste ou gtabase)
const rangChap = (m, k) => {
  const v = MORDRE[m.id] && MORDRE[m.id][k]; if (!v) return null;
  // numéros consécutifs dans chaque source : rang = numéro − premier numéro du chapitre + 1 (les missions en plus chez GTABase comptent)
  const premier = Math.min(...MISSIONS.missions.filter((x) => x.chapitre === m.chapitre && MORDRE[x.id] && MORDRE[x.id][k]).map((x) => MORDRE[x.id][k]));
  return v - premier + 1;
};
function ordreSources(m) {
  const o = MORDRE[m.id]; if (!o) return '';
  const lignes = [`<li>Notre liste : n° ${o.liste}, ${rangChap(m, 'liste')}<sup>e</sup> du chapitre (ordre publié par GTABase le 22/11/2026)</li>`,
    `<li>GTABase, liste du 25/11/2026 : ${o.gtabase ? `n° ${o.gtabase}, ${rangChap(m, 'gtabase')}<sup>e</sup> du chapitre` : 'absente'} (avec 2 missions de plus)</li>`,
    `<li>GTA Wiki : ${o.wiki ? `${o.wiki.rang}<sup>e</sup> du chapitre` : 'pas encore listée'} (page en cours de rédaction, sans explication du classement)</li>`];
  return `<details class="more"><summary>${icon('info')}Position selon les sources</summary><ul>${lignes.join('')}</ul><p>${ORDRE_NOTE} Nous n'avons pas tranché.</p></details>`;
}
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
const PERSO_ENC = Object.fromEntries(ENC.filter((e) => e.cat === 'personnages').map((e) => [e.nom, e.slug]));
const MESURE = (site.mesure && /^[a-z0-9-]{2,40}$/.test(site.mesure.goatcounter || '') && site.mesure.goatcounter) || '';
const CORR = fs.existsSync(path.join(ROOT, 'data', 'corrections.json')) ? read('corrections.json') : { corrections: [] };
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
// Une source compte pour confirmer seulement si elle est indépendante : ni agrégateur qui reprend les autres guides, ni site de faible qualité
const NON_INDEP = site.sourcesNonIndependantes || {};
const indepNoms = (noms = []) => [...new Set(noms)].filter((n) => !NON_INDEP[n]);
const indepIds = (ids = []) => [...new Set(ids)].filter((id) => SRC[id] && !SRC[id].fiabilite);
const COLL_NOTES = fs.existsSync(path.join(ROOT, 'data', 'collection-notes.json')) ? read('collection-notes.json').notes : {};
const byId = (arr, key = 'slug') => Object.fromEntries(arr.map((x) => [x[key], x]));
const A = byId(ASTUCES), V = byId(VEHICULES), L = byId(LIEUX, 'id'), E = byId(ENC), N = byId(ACTUS);
const REG = Object.fromEntries(LIEUX.filter((l) => l.type === 'region').map((r) => [r.id, r]));
const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
// extrait de recherche : l'information dès les premiers mots, coupé à une fin de phrase ou de mot (jamais au milieu d'un mot)
const extrait = (txt = '', max = 120) => {
  const t = String(txt).replace(/\s+/g, ' ').trim(); if (t.length <= max) return t;
  const c = t.slice(0, max); const fin = Math.max(c.lastIndexOf('. '), c.lastIndexOf(' : '), c.lastIndexOf(' ; '));
  return fin >= 60 ? c.slice(0, fin + 1).trim() : c.slice(0, c.lastIndexOf(' ')).replace(/[,;:(]$/, '').trim() + '…';
};
// n voisins autour de l'élément (avant et après, en boucle) : chaque fiche reçoit des liens, pas seulement les premières de la liste
const voisinsDe = (liste, el, n) => {
  const i = liste.indexOf(el); if (i < 0 || liste.length < 2) return liste.filter((x) => x !== el).slice(0, n);
  const out = []; for (let k = 1; out.length < Math.min(n, liste.length - 1); k++) { const a = liste[(i + Math.ceil(k / 2) * (k % 2 ? 1 : -1) + liste.length * 10) % liste.length]; if (a !== el && !out.includes(a)) out.push(a); }
  return out;
};
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function badge(st) {
  const s = statut(st);
  const ic = st === 'confirme' || st === 'teste' ? 'check' : st === 'provisoire' ? 'clock' : st === 'obsolete' ? 'x' : 'question';
  return `<span class="badge b-${st}" title="${esc(s.desc)}">${icon(ic)}${esc(s.nom)}</span>`;
}
const niveauNom = (n) => (n === 'facile' ? 'Facile' : 'Intermédiaire');
const dureeNom = (d) => (d <= 1 ? '1 min' : d <= 2 ? '2 min' : '5 min +');
const dureeBucket = (d) => (d <= 2 ? 'court' : d <= 5 ? 'moyen' : 'long');

// Résout une référence (slug) vers n'importe quel contenu
// titre SEO : le premier choix de 62 caractères ou moins (Google coupe vers 60-65)
function titreSEO(...choix) { const l = choix.filter(Boolean); return l.find((t) => t.length <= 62) || l[l.length - 1]; }
// description : phrases réelles, coupées à un mot entier sous 158 caractères
// minuscule en début de morceau placé après « : » (« Garée souvent… » → « garée souvent… »), sauf sigle ou mot en capitales
const minDebut = (t) => (t && /^[A-ZÀ-Ý][a-zà-ÿ'’]/.test(t) && !/^[A-ZÀ-Ý][a-zà-ÿ]+(?: [A-ZÀ-Ý]|['’])/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
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
  const Mi = slug.startsWith('mission:') && MIS[slug.slice(8)];
  if (Mi) return { t: Mi.nom, u: `missions/${Mi.id}/`, i: 'flag', c: '#ff3d6e', k: Mi.chapitre === 'prologue' ? 'Mission · prologue' : `Mission · chapitre ${Mi.chapitre}` };
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
const OGM_POS = fs.existsSync(path.join(ROOT, 'data', 'carte-ogm.json')) ? Object.fromEntries(read('carte-ogm.json').lieux.map((x) => [x.id, [x.x, x.y]])) : {};
function ancrePos(id) { const p = OGM_POS[id]; if (!p) throw new Error(`vehicules.json : ancre inconnue ${id}`); return p; }
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
  // « ancre » : repère précis d'une carte de joueurs qui concorde avec l'emplacement décrit par les guides (même endroit)
  const pos = v.ancre ? ancrePos(v.ancre) : v.gtadb ? gtadbCentre(v.gtadb) : autour(l.id, l.type === 'region' ? 420 : 110);
  if (!pos) continue;
  // ancré sur le repère du même véhicule relevé par une carte de joueurs : position précise (guides et carte concordent)
  const precision = v.ancre && /^vehicle-/.test(v.ancre) ? 'exacte' : l.type === 'region' ? 'region' : 'zone';
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
// Véhicules du catalogue : emplacements relevés sur GTA Wiki (texte + repères aux coordonnées du wiki, même repère que la carte)
const WIKI_V = fs.existsSync(path.join(ROOT, 'data', 'catalogue-wiki.json')) ? read('catalogue-wiki.json') : { vehicules: {} };
for (const [slug, w] of Object.entries(WIKI_V.vehicules)) {
  const x = CATALOGUE.vehicules.find((v) => v.slug === slug);
  if (!x) { console.warn(`catalogue-wiki : véhicule inconnu « ${slug} », ignoré`); continue; }
  const src = { nom: `GTA Wiki (${w.page})`, url: WIKI_V.source.url + encodeURIComponent(w.page.replace(/ /g, '_')) };
  if (w.obtenir && !x.obtenir) x.obtenir = w.obtenir;
  if (!(x.sources || []).some((s) => s.url === src.url)) x.sources = [...(x.sources || []), src];
  const ids = [];
  (w.points || []).forEach(([px, py, titre], i) => {
    const id = `w-${slug}-${i + 1}`;
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [px, py] }, properties: { id, nom: titre, cat: 'vehicules', sous: x.type, service: 'Véhicule', region: null, statut: 'a-verifier', precision: 'exacte', icon: cat('vehicules', x.type).icon, desc: w.obtenir, url: `vehicules/${slug}/`, src: 'wiki' } });
    ids.push(id);
  });
  if (w.repere) ids.push(w.repere);
  if (ids.length) CAT_CARTE[slug] = [...ids, ...(CAT_CARTE[slug] || [])];
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
  features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: pos }, properties: { id, nom: e.nom || base.properties.nom, cat: 'missions', sous: 'Mission', region: base ? base.properties.region : null, statut: 'a-verifier', precision: base ? base.properties.precision : 'zone', icon: 'flag', desc: `${ms.length} mission${ms.length > 1 ? 's' : ''} ici (${ch}) : ${ms.map((m) => m.nom).join(', ')}.`, service: `${ms.length} mission${ms.length > 1 ? 's' : ''}`, missions: ms.map((m) => ({ id: m.id, n: m.num, t: m.nom, c: m.chapitre, r: m.resume })) } });
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
// Listes de repères sur une page (armes uniques, véhicules remarquables) : texte lisible par Google, rangé par secteur, comme les pages de collection
function secteurDe(f) {
  if (f.properties.zone) return { z: f.properties.zone, estime: false };
  const [x, y] = f.geometry.coordinates; let best = null, d = 500;
  for (const g of features) { if (!g.properties.zone) continue; const e = Math.hypot(g.geometry.coordinates[0] - x, g.geometry.coordinates[1] - y); if (e < d) { d = e; best = g; } }
  return best ? { z: best.properties.zone, estime: true } : { z: '', estime: false };
}
const LISTES_ASTUCE = {
  'armes-gratuites': { titre: 'armes uniques signalées', filtre: (f) => f.properties.cat === 'armes' && f.properties.service === 'Arme unique' },
  'voiture-rare': { titre: 'véhicules remarquables signalés', filtre: (f) => /^o-standout-vehicle-/.test(f.properties.id) },
};
function listeRepères(slug, R) {
  const L = LISTES_ASTUCE[slug]; if (!L) return '';
  const items = features.filter(L.filtre).map((f) => ({ f, ...secteurDe(f) }));
  if (!items.length) return '';
  const groupes = {}; for (const it of items) (groupes[it.z || '~'] ||= []).push(it);
  const ordre = Object.keys(groupes).sort((a, b) => (a === '~') - (b === '~') || groupes[b].length - groupes[a].length || a.localeCompare(b, 'fr'));
  const lie = {}; for (const [s, ids] of Object.entries(CAT_CARTE)) for (const id of ids) lie[id] ||= s;
  const ligne = (it) => { const pr = it.f.properties, fiche = lie[pr.id] ? `vehicules/${lie[pr.id]}/` : pr.url && /^vehicules\//.test(pr.url) ? pr.url : null;
    return `<li class="col-it col-it--sans"><span class="col-t"><b>${fiche ? `<a href="${R}${fiche}">${esc(pr.nom)}</a>` : esc(pr.nom)}</b>${pr.desc ? `<small>${esc(pr.desc)}</small>` : ''}</span><a class="col-map" href="${R}carte/?focus=${pr.id}" aria-label="Voir « ${esc(pr.nom)} » sur la carte">${icon('map')}<span>Carte</span></a></li>`; };
  return `<section class="col" aria-labelledby="li-t" style="--c:#ff2bd6"><h2 id="li-t" class="h3">${icon('pin')}Les ${items.length} ${L.titre}, par secteur</h2>
  <p class="muted small">${icon('info')}Positions relevées par une carte de joueurs (Open GTA 6 Map), approximatives et pas encore vérifiées en jeu.</p>
  ${ordre.map((z) => `<section class="col-z"><h3 class="vgrp-h">${z === '~' ? 'Secteur non indiqué' : esc(z)} <small>${groupes[z].length}</small></h3>${groupes[z].some((i) => i.estime) ? '<p class="muted small">Secteur estimé d’après les repères voisins pour certains éléments.</p>' : ''}<ul class="col-l">${groupes[z].map(ligne).join('')}</ul></section>`).join('')}</section>`;
}
// coffres de la carte : le code donné par les guides et un lien vers le dossier des codes (sans le présenter comme vérifié)
for (const D of DOSSIERS.filter((d) => d.slug === 'codes-coffres')) for (const sec of D.sections) for (const it of sec.items || []) {
  const f = it.carte && it.code && mapIndex[it.carte]; if (!f) continue;
  const pr = f.properties;
  if (!pr.url) pr.url = 'dossiers/codes-coffres/';
  if (!(pr.desc || '').includes(it.code.split(' ')[0])) pr.desc = `Code : ${it.code}, selon les guides (non vérifié en jeu).${pr.desc ? ' ' + pr.desc : ''}`;
}
const onMap = (id) => !!mapIndex[id];
const vehOnMap = (slug) => !!mapIndex['v-' + slug];
// ---------- GLITCHS : éléments communs (onglets, statut, carte de glitch) ----------
// onglets de la rubrique Astuces (sans nouveau bouton dans la barre du bas)
const ongletsAstuces = (R, actif) => `<nav class="ast-tabs" aria-label="Rubriques Astuces">${[['tous', 'Tous', 'astuces/'], ['astuces', 'Astuces', 'astuces/#astuces-liste'], ['glitchs', 'Glitchs', 'glitchs/'], ['secrets', 'Secrets', 'dossiers/secrets/'], ['guides', 'Guides', 'dossiers/']].map(([id, t, u]) => `<a href="${R}${u}"${id === actif ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('')}</nav>`;
const gVign = (id, R) => (VIGN.has(id) ? `${R}vignettes/${id}.webp` : null);
const gPill = (g, explique = false) => { const st = gStatut(g), S = GSTATUTS[st.id]; return `<span class="gl-st" style="--s:${S.c}" title="${esc(S.t)}">${icon(S.ic)}${esc(S.n)}</span>${explique ? `<small class="gl-st-t">${esc(S.t)}${st.avant ? ` Dernier statut connu : ${esc(GSTATUTS[st.avant].n.toLowerCase())}, avant la mise à jour ${esc(st.depuis.id)} du ${fmtDate(st.depuis.date)}.` : ''}</small>` : ''}`; };
const gLieux = (g) => (g.emplacements || []).filter((e) => mapIndex[e.carte]);
const gVisuel = (g, R) => { const e = gLieux(g)[0], C = GCATS[g.cat], vg = e && gVign(e.carte, R); return g.image ? `<img src="${R}${g.image}" alt="" loading="lazy" decoding="async">` : vg ? `<span class="gl-vis-map" style="background-image:url(${vg})"></span><i class="gl-vis-pin" style="--c:${C.c}">${icon(C.ic)}</i>` : `<span class="gl-vis-ico">${icon(C.ic)}</span>`; };
const gFav = (g, mini) => `<button class="${mini ? 'card-cta fav fav--mini' : 'gl-fav fav'}" type="button" data-fav='${esc(JSON.stringify({ id: g.slug, type: 'glitch', t: g.titre, u: `glitchs/${g.slug}/`, i: GCATS[g.cat].ic, c: GCATS[g.cat].c }))}' aria-pressed="false" aria-label="Favori : ${esc(g.titre)}">${icon('heart')}</button>`;
const gMeta = (g) => [g.plateformes && g.plateformes.length ? g.plateformes.join(' · ') : '', g.mode ? 'Mode ' + g.mode : '', g.difficulte ? 'Difficulté : ' + DIFF[g.difficulte] : '', g.duree ? g.duree.replace(/ \([^)]*\)$/, '') : ''].filter(Boolean);
function gCarte(g, R, grand = false) {
  const C = GCATS[g.cat], st = gStatut(g), e = gLieux(g)[0];
  const txt = norm([g.titre, g.court, g.resume, C.n, g.gain, (g.etapes || []).map((x) => x.t).join(' ')].join(' '));
  return `<article class="gl-card${grand ? ' gl-card--une' : ''}" style="--c:${C.c}" data-gl-item data-cat="${g.cat}" data-ok="${st.id === 'fonctionnel' ? 1 : 0}" data-text="${esc(txt)}">
    <a class="gl-vis" href="${R}glitchs/${g.slug}/" tabindex="-1" aria-hidden="true">${gVisuel(g, R)}</a>
    <div class="gl-body">
      <p class="gl-cat">${icon(C.ic)}${esc(C.n)}</p>
      <h3 class="gl-t"><a href="${R}glitchs/${g.slug}/">${esc(g.titre)}</a></h3>
      <p class="gl-stl">${gPill(g)}</p>
      ${g.gainCourt ? `<p class="gl-gain">${icon('money')}${esc(g.gainCourt)}</p>` : ''}
      ${grand && g.resume ? `<p class="gl-res">${esc(g.resume)}</p>` : ''}
      ${gMeta(g).length ? `<p class="gl-meta-l">${gMeta(g).map(esc).join(' · ')}</p>` : ''}
      <p class="gl-ver">Sources vérifiées le ${fmtDate(g.verifieLe)}</p>
      <div class="gl-act"><a class="btn btn--primary gl-go" href="${R}glitchs/${g.slug}/">${icon('guide')}Voir le tutoriel</a>${e ? `<a class="btn gl-map" href="${R}carte/?glitch=${g.slug}&focus=${e.carte}">${icon('map')}Sur la carte</a>` : ''}${gFav(g)}</div>
    </div>
  </article>`;
}
// astuce → repères carte liés
const astuceMap = {};
for (const l of LIEUX) if (l.astuce && onMap(l.id)) (astuceMap[l.astuce] ||= []).push(l.id);
const ASTUCE_MAP_EXTRA = { 'billets-marques': 'focus=o-fence-005', 'voiture-rare': 'cat=vehicules', 'activites-eau': 'cat=activites', 'vendre-voitures-moses': 'cat=vehicules', 'stocker-vehicules': 'cat=vehicules' };

// ---------- layout ----------
const BRAND_MARK = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="mk-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb547"/><stop offset=".55" stop-color="#ff2bd6"/><stop offset="1" stop-color="#2de2e6"/></linearGradient></defs><path d="M5 17a11 11 0 0 1 22 0" fill="none" stroke="url(#mk-g)" stroke-width="1.3" stroke-linecap="round"/><path d="M3 20.5h26M6 24h20M10 27.5h12" stroke="url(#mk-g)" stroke-width="1.3" stroke-linecap="round"/></svg>`;
const NOUVEAU = ACTUS.length && (new Date(site.majLe) - new Date(ACTUS[0].date)) / 864e5 <= 7;
const BRAND_PALM = `<svg class="mark mark--palm" viewBox="0 0 48 40" aria-hidden="true"><defs><linearGradient id="pm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset=".5" stop-color="#ff2bd6"/><stop offset="1" stop-color="#b44dff"/></linearGradient></defs><path fill="url(#pm-g)" d="M23 13c-5-6-13-7-19-3 6-1 11 0 16 4-7-1-13 2-16 8 5-4 11-5 16-3-4 3-6 8-5 14l2 .5c-.5-6 1.5-10 5-13 .7 6 1 12 .2 19h3.4c.6-8 .2-14-1-20 4 2 7 6 7.5 11 2-6-1-11-6-14 6-1 11 1 15 5-2-7-9-10-16-8 4-4 10-5 15-3-5-5-13-4-18 1-1-4-4-7-8-8 3 2 5 5 5 8z"/></svg>`;
function layout({ p, title, desc, body, schema = [], noindex = false, cls = '', scripts = [], crumbs = null, ogType = 'website', v2 = true, styles = [], image = '' }) {
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
  const cur = (u) => (p.startsWith(u) || (u === 'astuces/' && p.startsWith('glitchs/')) ? ' aria-current="page"' : '');
  const tabs = [['', 'Accueil', 'home'], ['astuces/', 'Astuces', 'bolt'], ['#search', 'Chercher', 'search'], ['carte/', 'Carte', 'map'], ['missions/', 'Missions', 'flag']];
  // pages de listes : CollectionPage + la liste des fiches réellement liées dans la page (aucun élément invisible)
  if (!noindex && ['codes/', 'missions/', 'vehicules/', 'collection/', 'lieux/', 'actualites/', 'dossiers/', 'encyclopedie/'].includes(p) && !schema.some((x) => /^(ItemList|CollectionPage)$/.test(x['@type']))) {
    const fiches = [...new Set([...body.matchAll(new RegExp(`href="${R.replace(/\./g, '\\.')}${p}([a-z0-9-]+)/"`, 'g'))].map((m) => m[1]))];
    schema = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: canon, inLanguage: 'fr', isPartOf: { '@type': 'WebSite', name: M, url: site.url + '/' },
      ...(fiches.length >= 2 ? { mainEntity: { '@type': 'ItemList', numberOfItems: fiches.length, itemListElement: fiches.map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: `${canon}${f}/` })) } } : {}) }, ...schema];
  }
  if (crumbs) schema = [...schema, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: `${site.url}/${c[1]}` })) }];
  const crumbHtml = crumbs ? `<nav class="crumbs" aria-label="Fil d'Ariane">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${R}${c[1]}">${esc(c[0])}</a>${icon('arrow-right')}` : `<span aria-current="page">${esc(c[0])}</span>`).join('')}</nav>` : '';
  return `<!doctype html>
<html lang="fr" data-theme="night"${v2 ? ' class="v2"' : ''}>
<head>
<meta charset="utf-8">
<meta name="referrer" content="strict-origin-when-cross-origin">${p === '' && site.verification.google ? `\n<meta name="google-site-verification" content="${esc(site.verification.google)}">` : ''}${p === '' && site.verification.bing ? `\n<meta name="msvalidate.01" content="${esc(site.verification.bing)}">` : ''}
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : `<link rel="canonical" href="${canon}">`}
<meta name="theme-color" content="${v2 ? '#040309' : '#140a22'}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(M)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${image ? site.url + '/' + image : site.url + '/assets/og.png'}">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${R}favicon.svg" type="image/svg+xml">
<link rel="manifest" href="${R}manifest.webmanifest">
<link rel="apple-touch-icon" href="${R}assets/apple-touch-icon.png">
${v2 ? `<link rel="preload" href="${R}assets/inter-tight-latin-var.woff2" as="font" type="font/woff2" crossorigin>${cls === 'home' ? '' : `\n<link rel="preload" href="${R}assets/jetbrains-mono-latin-var.woff2" as="font" type="font/woff2" crossorigin>`}` : `<link rel="preload" href="${R}assets/inter-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${R}assets/anton-latin.woff2" as="font" type="font/woff2" crossorigin>`}
<link rel="stylesheet" href="${R}assets/app.css">${v2 ? `\n<link rel="stylesheet" href="${R}assets/home.css">` : ''}${styles.map((f) => `\n<link rel="stylesheet" href="${R}assets/${f}">`).join('')}
<script>document.documentElement.classList.add('js');setTimeout(function(){document.documentElement.classList.add('ready-fallback')},1600);try{var P=JSON.parse(localStorage.getItem('lg:prefs')||'{}');var t=P.theme||'auto';if(t==='auto')t=matchMedia('(prefers-color-scheme: light)').matches?'day':'night';document.documentElement.dataset.theme=t;if(P.motion==='off')document.documentElement.dataset.motion='off';if(P.size)document.documentElement.dataset.size=P.size;if(P.spoil==='off')document.documentElement.dataset.spoil='off'}catch(e){}</script>
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
    ${[['Explorer GTA 6', [['', 'Accueil', 'home', 'c'], ['codes/', 'Codes de triche', 'gamepad', 'p'], ['dossiers/argent-rapide/', 'Gagner de l\'argent', 'wallet', 'p'], ['dossiers/', 'Astuces et guides', 'bolt', 'c'], ['missions/', 'Missions et solutions', 'flag', 'c'], ['vehicules/', 'Véhicules', 'car', 'c'], ['collection/', 'Objets à collectionner', 'badge', 'p'], ['carte/', 'Carte interactive', 'map', 'c']]],
      ['Découvrir', [['encyclopedie/', 'Encyclopédie et lieux', 'book', 'c'], ['actualites/', 'Actualités', 'news', 'c']]],
      ['Personnel', [['favoris/', 'Mes favoris', 'heart', 'p'], ['compte/', 'Mon espace', 'user', 'p']]],
      ['', [['a-propos/', 'À propos et fiabilité', 'shield', 'c']]]].map(([titre, liens]) => `<div class="drawer-sec">${titre ? `<p class="drawer-t">${titre}</p>` : ''}${liens.map(([u, t, i, c]) => `<a class="drawer-a drawer-a--${c}" href="${R}${u}"${(u === '' ? p === '' : u && p.startsWith(u) && !(u === 'dossiers/' && p.startsWith('dossiers/argent'))) ? ' aria-current="page"' : ''}>${icon(i)}<span>${t}</span>${icon('chevron')}</a>`).join('')}</div>`).join('')}
  </nav>
</div>
<main id="main" class="page">
${deco}
${crumbHtml}
${body}
${(cls === 'p-fiche' || cls === 'p-fiche p-vfiche') && site.editeur && site.editeur.email ? `<p class="wrap signal"><a class="btn btn--ghost" href="mailto:${site.editeur.email}?subject=${encodeURIComponent('Erreur sur la page : ' + title)}&amp;body=${encodeURIComponent('Page : ' + canon + '\n\nCe qui est faux ou manquant :\n\nSource (lien), si tu en as une :\n')}">${icon('alert')}Signaler une erreur sur cette page</a></p>` : ''}
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
    : `<a class="tab" href="${R}${u}"${(u === '' ? p === '' : p.startsWith(u) || (u === 'astuces/' && p.startsWith('glitchs/'))) ? ' aria-current="page"' : ''}>${icon(i)}<span>${t}</span></a>`).join('')}
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
${v2 ? ['gsap', ...(cls === 'home' ? ['ScrollTrigger'] : []), 'SplitText', 'DrawSVGPlugin'].map((n) => `<script src="${R}assets/${n}.min.js" defer></script>`).join('\n') : ''}
<script src="${R}assets/app.js" defer></script>
<script src="${R}assets/compte.js" defer></script>
${MESURE ? `<script src="${R}assets/mesure.js" defer data-gc="${MESURE}"></script>` : ''}
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
  return `<details class="sources"><summary>${icon('shield')}Sources (${list.length})</summary><ul>${list.map((s) => `<li><a href="${s.u}" rel="nofollow noopener" target="_blank">${esc(s.n)}</a>${s.official ? ' <span class="pill pill--ok">officiel</span>' : s.fiabilite === 'faible' ? ' <span class="pill">source faible</span>' : s.fiabilite === 'agregateur' ? ' <span class="pill">reprend d\u2019autres guides</span>' : ''}</li>`).join('')}</ul><p class="muted">Une source marquée « faible » ou « reprend d’autres guides » ne compte pas pour confirmer une information.</p></details>`;
}
// Encyclopédie : références numérotées par affirmation, détail dans un bloc dépliable en bas de fiche
// v = oui (citation relue), partiel (ne confirme qu'une partie), non (page inaccessible lors de la vérification : non revérifiée)
const REFS_DATE = '25/11/2026';
function encyRefs(e) {
  const ordre = [];
  (e.refs || []).flat().forEach((x) => { if (SRC[x.s] && !ordre.includes(x.s)) ordre.push(x.s); });
  const autres = e.sources.filter((id) => SRC[id] && !ordre.includes(id));
  const num = (id) => ordre.indexOf(id) + 1;
  const marque = (i) => {
    const r = (e.refs || [])[i] || [];
    const sup = [...new Set(r.map((x) => x.s))].filter((id) => SRC[id]).map((id) => {
      const nv = r.filter((x) => x.s === id).every((x) => x.v === 'non');
      return `<a class="ref${nv ? ' ref--nv' : ''}" href="#src-${e.slug}-${num(id)}" aria-label="Source ${num(id)}${nv ? ', non revérifiée' : ''}">${num(id)}</a>`;
    }).join('');
    const sure = r.some((x) => x.v === 'oui' && !(SRC[x.s].fiabilite));
    return `${sup ? `<sup class="refs">${sup}</sup>` : ''}${sure ? '' : ' <span class="ref-av">(à revérifier)</span>'}`;
  };
  const pill = (s) => (s.official ? ' <span class="pill pill--ok">officiel</span>' : s.fiabilite === 'faible' ? ' <span class="pill">source faible</span>' : s.fiabilite === 'agregateur' ? ' <span class="pill">reprend d’autres guides</span>' : '');
  const item = (id) => {
    const s = SRC[id];
    const lignes = [];
    (e.refs || []).forEach((r, i) => r.filter((x) => x.s === id).forEach((x) => lignes.push(`<li><b>Affirmation ${i + 1}</b> · ${x.v === 'oui' ? `relue le ${REFS_DATE}` : x.v === 'partiel' ? `confirme seulement une partie (relue le ${REFS_DATE})` : `page inaccessible lors de notre vérification du ${REFS_DATE} : non revérifiée`}${x.q ? ` : <q lang="en">${esc(x.q)}</q>` : ''}${x.n ? `<br><small>${esc(x.n)}</small>` : ''}</li>`)));
    return `<li id="src-${e.slug}-${num(id)}"><a href="${s.u}" rel="nofollow noopener" target="_blank">${esc(s.n)}</a>${pill(s)}${lignes.length ? `<ul class="refs-l">${lignes.join('')}</ul>` : ''}</li>`;
  };
  const bloc = ordre.length + autres.length ? `<details class="sources" id="sources-${e.slug}"><summary>${icon('shield')}Sources détaillées (${ordre.length + autres.length})</summary>
  <p class="muted">Les numéros après chaque affirmation renvoient à cette liste. Une affirmation suivie de « à revérifier » n'a pas pu être relue dans une source indépendante.</p>
  <ol class="refs-src">${ordre.map(item).join('')}</ol>${autres.length ? `<p class="muted">Autres sources consultées pour cette fiche :</p><ul>${autres.map((id) => `<li><a href="${SRC[id].u}" rel="nofollow noopener" target="_blank">${esc(SRC[id].n)}</a>${pill(SRC[id])}</li>`).join('')}</ul>` : ''}
  <p class="muted">Une source marquée « faible » ou « reprend d’autres guides » ne compte pas pour confirmer une information. Citations en anglais, telles que publiées.</p></details>` : '';
  return { marque, bloc };
}
// Véhicules : nature de chaque emplacement, d'après le type de repère de la source (rien n'est déduit au-delà)
const NATURE_V = { 'Véhicule remarquable': 'Garé à cet endroit', 'Véhicule qui apparaît ici': 'Apparaît à cet endroit', 'Véhicule à commander': 'Lié à une demande (Moses ou Randy)', 'Location de véhicules': 'À louer' };
// « Véhicule remarquable » des cartes de joueurs : une version unique (livrée ou préparation spéciale), pas le modèle de série
const unique = (f) => /^o-standout-vehicle-/.test(f.properties.id);
const natureLieu = (f) => (f.properties.id.startsWith('w-') ? 'Position relevée' : unique(f) ? 'Version unique (livrée spéciale), garée à cet endroit' : NATURE_V[f.properties.service] || 'Repère de la carte');
// emplacement d'une fiche (article) et repère d'une carte de joueurs au même endroit : deux sources concordent, sans vérification en jeu
const DOUBLONS = fs.existsSync(path.join(ROOT, 'data', 'doublons.json')) ? read('doublons.json') : { doublons: {}, noms: {} };
function concorde(slug, ids = []) {
  const v = mapIndex['v-' + slug]; if (!v) return null;
  // fiche ancrée sur un repère précis : pas de rapprochement avec une autre version garée à côté
  if (VEHICULES.some((x) => x.slug === slug && x.ancre)) return null;
  const dm = DOUBLONS.doublons['v-' + slug]; if (dm && mapIndex[dm.garde]) return { d: 0, f: mapIndex[dm.garde] };
  let best = null;
  const dist = (DOUBLONS.distincts || {})['v-' + slug] || {};
  for (const id of ids) { const f = mapIndex[id]; if (!f || !/^o-/.test(id) || dist[id]) continue; const d = Math.hypot(f.geometry.coordinates[0] - v.geometry.coordinates[0], f.geometry.coordinates[1] - v.geometry.coordinates[1]); if (d < 400 && (!best || d < best.d)) best = { d, f }; }
  return best;
}
const sourceLieu = (f) => (f.properties.id.startsWith('w-') ? 'GTA Wiki (wiki de joueurs)' : f.properties.id.startsWith('o-') ? 'Open GTA 6 Map (carte de joueurs)' : f.properties.id.startsWith('v-') ? 'fiche GTA 6 Facile' : 'GTADB (carte de joueurs)');
// Un seul bloc en haut de fiche : la réponse, l'action principale, les favoris.
// lieux : repères de la carte ; texte : emplacement décrit ; fiab : fiabilité de l'emplacement ; etapes : méthode d'obtention vérifiée par les sources de la fiche
function blocOu({ nom, R, lieux, texte, lien, fiab, etapes, fav, signaler, conseil = false }) {
  const connu = lieux.length || texte;
  const plusieurs = lieux.length > 1;
  const spoil = (s) => /chapitre|«|mission/i.test(s);
  return `<section class="ou-veh" id="ou" aria-labelledby="ou-t">
    <h2 id="ou-t" class="h3">${icon('pin')}Où le trouver ?</h2>
    ${connu ? `<p class="ou-fiab">${badge(fiab.statut)}<small>${esc(fiab.texte)}</small></p>` : `<p class="ou-fiab"><span class="badge b-a-verifier">${icon('question')}Emplacement à vérifier</span></p>`}
    ${texte ? `<p class="ou-txt">${lien ? `<a href="${R}lieux/${lien.id}/"><b>${esc(lien.nom)}</b></a> — ` : ''}${esc(texte)}</p>` : ''}
    ${plusieurs ? `<p class="ou-n">Repéré à ${lieux.length} endroits${lieux.length > 8 ? ` (les 8 premiers ci-dessous, tous sur la carte)` : ''} :</p>` : ''}
    ${!texte && lieux.length && lieux.every(unique) ? `<p class="muted small">${icon('info')}${lieux.length > 1 ? 'Ces emplacements sont ceux de versions uniques' : 'Cet emplacement est celui d\u2019une version unique'} (livrée ou préparation spéciale). Aucun emplacement du modèle de série n'est relevé.</p>` : ''}
    ${lieux.length && (plusieurs || !texte) ? `<ul class="vdlg-lo">${lieux.slice(0, 8).map((f) => `<li><a href="${R}carte/?focus=${f.properties.id}"><b>${esc(f.properties.nom)}</b></a>${f.properties.zone ? ` · ${esc(f.properties.zone)}` : ''}<br><small>${esc(natureLieu(f))} · source : ${esc(sourceLieu(f))}</small>${f.properties.desc && f.properties.desc !== texte ? `<br><small>${esc(f.properties.desc.slice(0, 160))}</small>` : ''}</li>`).join('')}</ul>` : ''}
    ${connu ? '' : `<p class="ou-txt">Aucun emplacement fiable n'a encore été relevé pour ${esc(nom)}. Rien n'est indiqué tant qu'il n'est pas vérifié.</p>`}
    <div class="actions actions--ou">
      ${lieux.length ? `<a class="btn btn--primary" href="${R}carte/?focus=${lieux[0].properties.id}">${icon('map')}Voir l'emplacement</a>` : ''}
      ${fav}
      ${connu ? '' : `<a class="btn btn--ghost" href="mailto:${site.editeur.email}?subject=${encodeURIComponent(`Emplacement : ${nom}`)}&amp;body=${encodeURIComponent(`Véhicule : ${nom} (${site.url}/${signaler})\nOù je l'ai trouvé :\nSource ou capture, si tu en as une :\n`)}">${icon('mail')}Signaler un emplacement</a>`}
    </div>
    ${etapes && etapes.length ? `<h3 class="ou-h">${icon('list')}${conseil ? 'Conseils pour le trouver' : "Comment l'obtenir"}</h3>${conseil ? '<p class="muted small">Pas de méthode précise connue : ce sont des conseils généraux, pas une procédure vérifiée.</p>' : ''}<ol class="steps">${etapes.map((s, i) => `<li class="step"><span class="step-n">${i + 1}</span><span class="step-t${spoil(s) ? ' spoil' : ''}">${esc(s)}</span></li>`).join('')}</ol>` : ''}
  </section>`;
}
// Fiabilité : trois questions séparées (le véhicule est-il dans le jeu ? l'emplacement est-il sûr ? comment l'obtenir ?)
function blocFiab({ presence, emplacement, obtention }) {
  return `<section class="fiab-veh" aria-labelledby="fi-t"><h2 id="fi-t" class="h3">${icon('shield')}Fiabilité</h2><dl class="facts facts--fiab">
    <div><dt>${icon('check')}Présence dans GTA 6</dt><dd>${presence}</dd></div>
    <div><dt>${icon('pin')}Emplacement</dt><dd>${emplacement}</dd></div>
    <div><dt>${icon('list')}Méthode d'obtention</dt><dd>${obtention}</dd></div>
  </dl></section>`;
}
// présence : une page de wiki ou de base de données de joueurs n'est pas une confirmation officielle de Rockstar
const presenceTxt = (slug, srcIds = []) => {
  const v = VERIF[slug] || {};
  const preuves = (v.preuves || []), off = preuves.filter((x) => /rockstar/i.test(x));
  const cat = CATALOGUE.vehicules.find((x) => x.slug === slug) || CATALOGUE.fiches[slug] || {};
  const joueurs = indepNoms([...preuves.filter((x) => !/rockstar/i.test(x)), ...(cat.sources || []).map((s) => s.nom)]);
  if (off.length || srcIds.some((id) => SRC[id] && SRC[id].official)) return `Confirmée par Rockstar Games (source officielle)${joueurs.length ? `, et relevée par ${joueurs.join(', ')}` : ''}.${v.note ? ' ' + v.note : ''}`;
  if (v.statut === 'confirme' && joueurs.length >= 2) return `Recoupée par ${joueurs.join(' et ')} (bases de données de joueurs), pas par une annonce officielle de Rockstar.${v.note ? ' ' + v.note : ''}`;
  if (v.statut === 'confirme') return `Signalée par ${joueurs.join(', ') || 'une base de joueurs'} seulement, pas encore recoupée.${v.note ? ' ' + v.note : ''}`;
  return `À confirmer : vue seulement sur GTABase ou gta6guide.fr.${v.note ? ' ' + v.note : ''}`;
};
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
    ['codes/', 'Codes de triche PS5 et Xbox', `${CODES.codes.length} codes relevés`, 'code', '#9b6bff'],
    ['dossiers/argent-rapide/', 'Gagner de l\'argent vite', 'Dossier complet', 'money', '#3ddc84'],
    ['dossiers/codes-coffres/', 'Les codes de coffres connus', 'Dossier', 'bank', '#ffb547'],
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
  // photos : version allégée de 720 px pour les fonds des cartes (scripts/vignettes-accueil.py), sinon l'originale
  const ph = (n) => (n.startsWith('m-') ? `${n}.webp` : fs.existsSync(path.join(ROOT, 'src', 'img', `hx-${n}.webp`)) ? `hx-${n}.webp` : `../photos/${n}.webp`);
  const D_ = (s) => DOSSIERS.find((d) => d.slug === s);
  const vraiesM = MISSIONS.missions.filter((m) => !m.facultative && !m.tache).length;
  const CATS5 = [['codes/', 'Codes', 'gamepad', '#ff2bd6'], ['dossiers/argent-rapide/', 'Argent', 'dollar', '#3ddc84'], ['carte/', 'Carte', 'map', '#2de2e6'], ['missions/', 'Missions', 'flag', '#b44dff'], ['vehicules/', 'Véhicules', 'car', '#ffb547'], ['glitchs/', 'Glitchs', 'bolt', '#ff5c70']];
  const UNE = D_('argent-rapide');
  const POP = [
    ['codes/', 'Codes', `Codes de triche GTA 6 (PS5 et Xbox)`, 'm-codes', '#ff2bd6', `${CODES.codes.length} codes avec leurs flèches`],
    ['dossiers/secrets/', 'Secrets', 'Secrets et Easter eggs de Leonida', 'm-secrets', '#9d7bff', 'Bigfoot, OVNI, fantômes…'],
    ['dossiers/codes-coffres/', 'Coffres', 'Les codes de coffres connus', 'vapid-stanier-55', '#ffb547', 'Repaires de gangs et lieux secrets'],
    ['dossiers/100-pour-cent/', '100 %', 'Finir GTA 6 à 100 %', 'kayak-crest', '#2de2e6', 'La checklist complète'],
    ['astuces/voiture-rare/', 'Véhicules', 'Trouver une voiture rare', 'progen-emerus-royal-ruby', '#ffb547', 'Où sont garées les plus belles'],
    ['carte/?cat=armes', 'Armes', 'Où trouver les armes', 'jets-militaires', '#ff5a5a', 'Armes au sol et armes uniques']
  ];
  const body = `
<section class="hx" aria-labelledby="h-title">
  <div class="hx-banner hx-banner--img">
    <img src="${R}assets/m-banniere-titre-1320.webp" srcset="${R}assets/m-banniere-titre-828.webp 828w, ${R}assets/m-banniere-titre-1320.webp 1320w, ${R}assets/m-banniere-titre.webp 2640w" sizes="(min-width: 1600px) 1600px, 100vw" width="2640" height="516" alt="" fetchpriority="high" decoding="async">
    <h1 class="sr-only" id="h-title">GTA 6 : guides, astuces, codes de triche et carte interactive</h1>
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
    <span class="hx-map-img" aria-hidden="true"><img src="${R}assets/m-carte.webp" srcset="${R}assets/m-carte-480.webp 480w, ${R}assets/m-carte.webp 872w" sizes="(min-width: 900px) 440px, 40vw" alt=""${wh('img/m-carte.webp')} loading="lazy" decoding="async"></span>
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
  const glBande = GL_RECO.length ? `<a class="gl-bande" href="${R}glitchs/">${icon('bolt')}<span><b>Meilleurs glitchs GTA 6</b><small>${esc(GL_RECO.slice(0, 2).map((g) => g.court || g.titre).join(' · '))}</small></span>${icon('arrow-right')}</a>` : '';
  const body = `<section class="wrap section" data-list>
  ${ongletsAstuces(R, 'tous')}
  <h1 class="h1">De quoi as-tu besoin ?</h1>
  ${glBande}
  <span id="astuces-liste"></span>
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
    ${a.verifie ? `<p class="fiche-date">${icon('check')}Dernière vérification : <time datetime="${a.verifie}">${fmtDate(a.verifie)}</time></p>` : ''}
  </header>
  ${mapIds.length && vign(mapIds[0], R) ? `<a class="map-banner" href="${R}carte/?focus=${mapIds[0]}" style="--img:url(${vign(mapIds[0], R)})"><i></i><span>${icon('map')}Voir l'endroit sur la carte</span><small>Position approximative</small></a>` : ''}
  <section class="answer" id="solution" aria-label="Réponse">
    <span class="answer-k">${icon('bolt')}Réponse</span>
    <p>${esc(a.reponse)}</p>
    ${!['confirme', 'teste'].includes(a.statut) && /\d/.test(a.reponse) ? `<p class="muted small">${icon('info')}Les chiffres de cette réponse viennent des guides cités et n'ont pas encore été vérifiés en jeu.</p>` : ''}
  </section>
  <div class="actions">
    <a class="btn btn--primary" href="#etapes">${icon('list')}Voir les étapes</a>
    ${mapHref ? `<a class="btn" href="${mapHref}">${icon('map')}${esc(a.carteLibelle || 'Voir sur la carte')}</a>` : ''}
    <button class="btn btn--ghost" type="button" data-copy>${icon('link')}Copier le lien</button>
    ${favBtn({ id: a.slug, type: 'astuce', t: a.court, u: p, i: a.icon, c: c.color })}
    <button class="btn btn--ghost" type="button" data-done="${a.slug}" aria-pressed="false">${icon('check')}<span data-on="C'est fait !" data-off="Je l'ai fait">Je l'ai fait</span></button>
  </div>
  <section class="steps-wrap" id="etapes" aria-labelledby="et-t">
    <h2 id="et-t" class="h3">${icon('list')}Étapes</h2>
    <ol class="steps">${a.etapes.map((s, i) => `<li class="step"><span class="step-n">${i + 1}</span><span class="step-t">${esc(s)}</span></li>`).join('')}</ol>
  </section>
  ${a.asavoir ? `<aside class="note">${icon('alert')}<p><b>À savoir :</b> ${esc(a.asavoir)}</p></aside>` : ''}
  ${a.slug === 'collection' ? `<a class="btn btn--primary btn--wide" href="${R}collection/">${icon('badge')}Voir les listes d'objets à collectionner</a>` : ''}
  ${listeRepères(a.slug, R)}
  <section class="related" aria-labelledby="va-t"><h2 id="va-t" class="h3">${icon('sparkle')}Voir aussi</h2><div class="minis">${a.voir.map((s) => relCard(s, R)).join('')}${ENC.filter((e) => e.liens.includes(a.slug)).slice(0, 2).map((e) => `<a class="mini" href="${R}encyclopedie/${e.slug}/" style="--c:${cat('encyclopedie', e.cat).color}"><span class="mini-ico">${icon(e.icon)}</span><span><small>Encyclopédie</small><b>${esc(e.nom)}</b></span>${icon('arrow-right')}</a>`).join('')}</div></section>
  ${sourcesBlock(a.sources)}
</article>`;
  emit(p, layout({
    p, title: ((t) => titreSEO(`${t} : solution pas à pas`, `${t} : la solution`, t))(/GTA 6/.test(a.titre) ? a.titre.replace(/ \?$/, '') : `${a.titre.replace(/ \?$/, '')} dans GTA 6`),
    desc: descSEO(a.reponse, a.reponse.length < 90 ? a.etapes[0] : ''),
    body, cls: 'p-fiche', ogType: 'article',
    crumbs: [['Accueil', ''], ['Astuces', 'astuces/'], [c.nom, `astuces/?cat=${a.cat}`], [a.court, p]],
    schema: [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.titre, description: a.reponse, ...(a.verifie ? { dateModified: a.verifie } : {}), inLanguage: 'fr-FR', author: { '@type': 'Organization', name: M, url: site.url + '/' }, publisher: { '@type': 'Organization', name: M, url: site.url + '/' }, mainEntityOfPage: `${site.url}/${p}` }]
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
let VGROUPES = []; // catégories de la page Véhicules, aussi proposées par la recherche
const UN = { 'Supercars': 'Supercar', 'Sportives': 'Sportive', 'Sportives classiques': 'Sportive classique', 'Muscle cars': 'Muscle car', 'Coupés': 'Coupé', 'Berlines': 'Berline', 'Motos': 'Moto', 'Vélos': 'Vélo', 'Bateaux': 'Bateau', 'Hélicoptères': 'Hélicoptère', 'Avions': 'Avion', 'Police et urgences': 'Urgences', 'Militaires': 'Militaire', 'Vans et fourgons': 'Van', 'Utilitaires': 'Utilitaire', 'Industriels': 'Industriel', 'Taxis, bus et service': 'Service' };
{
  const p = 'vehicules/', R = R_(p);
  const GRP = CATALOGUE.groupes || [];
  const grpDe = (v) => (CATALOGUE.fiches[v.slug] || {}).groupe || 'service';
  // Une carte = une photo, un nom, et un seul bouton « Où le trouver ? » qui ouvre la carte sur le repère vérifié.
  // Sans repère : le texte d'obtention s'il existe, sinon « Emplacement pas encore connu » (rien n'est inventé).
  const vCard = ({ slug, nom, kicker, classe, type, groupe, visu, sur, focus, comment }) => {
    // marque déjà affichée au-dessus : pas de répétition dans le nom (« Pegassi » / « Infernus »)
    if (kicker && nom.toLowerCase().startsWith(kicker.toLowerCase() + ' ')) nom = nom.slice(kicker.length + 1);
    const c = cat('vehicules', type);
    const known = !!(focus || comment);
    const txt = norm([nom, kicker, classe, c.nom].join(' '));
    const bouton = focus ? `<a class="vc-ou" href="${R}carte/?focus=${focus}">${icon('map')}Où le trouver ?</a>`
      : comment ? `<a class="vc-ou vc-ou--txt" href="${R}vehicules/${slug}/#ou">${icon('pin')}Où le trouver ?</a>`
      : `<span class="vc-ou vc-ou--off">${icon('question')}Emplacement à vérifier</span>`;
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
    // même véhicule au même endroit : le repère précis de la carte plutôt que la zone approximative de la fiche
    const cc = concorde(v.slug, CAT_CARTE[v.slug]);
    const focus = cc ? cc.f.properties.id : vehOnMap(v.slug) ? 'v-' + v.slug : null;
    (cartes[grpDe(v)] ||= []).push({ o: (sur ? 0 : 10) + (focus ? 0 : 1), n: v.nom, html: vCard({ slug: v.slug, nom: v.nom, kicker: f.fabricant || cat('vehicules', v.type).nom, classe: f.classe || v.sous, type: v.type, groupe: grpDe(v), visu: vehVisuel(v, R), sur, focus, comment: !!v.emplacement }) });
  }
  for (const x of CATALOGUE.vehicules) {
    const sur = (VERIF[x.slug] || {}).statut === 'confirme';
    const focus = (CAT_CARTE[x.slug] || []).find((id) => mapIndex[id]) || null;
    // liste : miniature de 960 px quand elle existe (scripts/miniatures.py), l'original pour les écrans très denses
    const mini = x.img && fs.existsSync(path.join(ROOT, 'src', 'catalogue-mini', x.img));
    const larg = x.img && (dimImg('catalogue/' + x.img) || [])[0];
    const visu = x.img ? `<img class="veh-photo" src="${R}${mini ? 'catalogue-mini' : 'catalogue'}/${x.img}"${mini && larg ? ` srcset="${R}catalogue-mini/${x.img} 960w, ${R}catalogue/${x.img} ${larg}w" sizes="(min-width: 1100px) 380px, (min-width: 700px) 46vw, 92vw"` : ''} alt="${esc(x.nom)}"${wh('catalogue/' + x.img)} loading="lazy" decoding="async">` : silhouette({ slug: '', type: x.type });
    (cartes[x.groupe] ||= []).push({ o: (sur ? 0 : 10) + (focus ? 0 : x.obtenir ? 1 : x.img ? 2 : 3), n: x.nom, html: vCard({ slug: x.slug, nom: x.modele || x.nom, kicker: x.fabricant || cat('vehicules', x.type).nom, classe: x.classe, type: x.type, groupe: x.groupe, visu, sur, focus, comment: !!x.obtenir }) });
  }
  const groupes = GRP.filter((g) => cartes[g.id]);
  VGROUPES = groupes.map((g) => ({ id: g.id, nom: g.nom, type: g.type, n: cartes[g.id].length }));
  const total = VEHICULES.length + CATALOGUE.vehicules.length;
  const nbOu = Object.values(cartes).flat().filter((c) => c.html.includes('data-known="1"')).length;
  const ty = (id) => [...VEHICULES.filter((v) => v.type === id), ...CATALOGUE.vehicules.filter((x) => x.type === id)].length;
  const body = `<section class="wrap section" data-vlist>
  <h1 class="h1">Quel véhicule cherches-tu ?</h1>
  <p class="lead veh-lead"><b>${total}</b> véhicules recensés · <b>${nbOu}</b> avec un emplacement relevé. Touche <b>Où le trouver ?</b> pour ouvrir la carte.</p>
  ${fieldFilter('Nom, marque ou vraie voiture')}
  <div class="doors doors--5" role="group" aria-label="Type" data-vtype>
    ${site.categories.vehicules.map((c) => `<button class="door" type="button" data-value="${c.id}" aria-pressed="false" style="--c:${c.color}"><span class="door-ico">${icon(c.icon)}</span><span>${esc(c.nom)}</span><small>${ty(c.id)}</small></button>`).join('')}
  </div>
  <div class="filterbar">
    <button class="chip chip--toggle" type="button" data-vtoggle="known" aria-pressed="false">${icon('pin')}Emplacement connu</button>
  </div>
  <nav class="vjump" aria-label="Aller à une catégorie">${groupes.map((g) => `<a href="#cat-${g.id}" data-jump="${g.id}">${esc(g.nom)}<small>${cartes[g.id].length}</small></a>`).join('')}</nav>
  <p class="count-line"><span data-vcount aria-live="polite"></span> <button class="lnk" type="button" data-vclear hidden>Effacer les filtres</button></p>
  ${groupes.map((g) => `<section class="vgrp" id="cat-${g.id}" data-vgrp="${g.id}" data-type="${g.type}" aria-labelledby="t-${g.id}">
    <h2 class="vgrp-h" id="t-${g.id}">${esc(g.nom)} <small data-vn>${cartes[g.id].length}</small></h2>
    <div class="grid">${cartes[g.id].sort((a, b) => a.o - b.o || a.n.localeCompare(b.n, 'fr')).map((c) => c.html).join('')}</div>
    <button class="btn btn--ghost vgrp-more" type="button" data-vmore hidden>${icon('plus')}<span></span></button>
  </section>`).join('')}
  <p class="empty" data-vempty hidden>${icon('search')}Aucun véhicule ne correspond. <button class="lnk" type="button" data-vclear>Effacer les filtres</button></p>
  <p class="note veh-sources">${icon('info')}<span>Liste et caractéristiques : <a href="https://www.gtabase.com/fr/gta-6/vehicules/" target="_blank" rel="noopener">GTABase</a> et <a href="https://gta6guide.fr/gta-6/vehicules" target="_blank" rel="noopener">gta6guide.fr</a>, recoupées avec GTA Wiki. Emplacements : repères de la carte (Open GTA 6 Map et GTA Wiki, relevés par la communauté). Photos : Rockstar Games (via GTABase, GTA Wiki) et gta6guide.fr, choisies parmi les plus nettes.</span></p>
  <a class="btn btn--wide" href="${R}carte/?cat=vehicules">${icon('map')}Voir tous les véhicules sur la carte</a>
</section>`;
  const aConfirmer = [...VEHICULES, ...CATALOGUE.vehicules].filter((y) => (VERIF[y.slug] || {}).statut !== 'confirme').length;
  emit(p, layout({ p, title: 'Véhicules GTA 6 : liste, photos et emplacements', desc: `${total} véhicules de GTA 6 recensés (dont ${aConfirmer} encore à confirmer), avec photo quand elle existe. ${nbOu} ont un emplacement relevé par les joueurs, à ouvrir sur la carte.`, body, cls: 'p-list', scripts: ['catalogue.js'], crumbs: [['Accueil', ''], ['Véhicules', 'vehicules/']] }));
}
// ---------- FICHE VÉHICULE, NOUVELLE PRÉSENTATION (déploiement progressif : seulement les fiches listées) ----------
// rendue après le calcul de fiabilité des repères (noterVehicules) ; mêmes titre, description, données structurées et liens que l'ancienne
const FICHES_V2_CAT = fs.existsSync(path.join(ROOT, 'data', 'fiches-v2.json')) ? read('fiches-v2.json').fiches : {};
const FICHE_V2 = new Set(['pegassi-infernus', 'bravado-gauntlet-hellfire', 'pegassi-tempesta', 'maibatsu-penumbra-ff', 'bombora-s23', 'grotti-cheetah-95', 'pfister-comet-s2', ...Object.keys(FICHES_V2_CAT)]);
const V2_A_FAIRE = [];
const FI_TXT = { confirme: 'Confirmé', probable: 'Probable', approx: 'Approximatif', nonverif: 'Non vérifié' };
// statut du repère, avec les mêmes mots et la même définition que la légende de la carte
const FI_ST = { confirme: 'verifie', probable: 'probable', approx: 'nonconf', nonverif: 'nonverif' };
const repereSt = (f) => STATUTS_CARTE.find((x) => x.id === (FI_ST[f.properties.fi] || 'nonverif'));
function ficheV2(v, { p, R, c, l, onM, liens = [] }) {
  const la = ['voitures', 'motos'].includes(v.type) ? 'la' : 'le';
  const elle = la === 'la' ? 'elle' : 'il';
  const sur = ['confirme', 'teste'].includes(v.dispo);
  const cc = v.ancre ? null : concorde(v.slug, CAT_CARTE[v.slug]);
  if (v.principal && !mapIndex[v.principal]) throw new Error(`fiches-v2.json : repère principal inconnu ${v.principal}`);
  const principal = v.principal ? mapIndex[v.principal] : (cc && cc.f) || (onM ? mapIndex['v-' + v.slug] : null);
  const autres = (CAT_CARTE[v.slug] || []).map((id) => mapIndex[id]).filter((f) => f && f !== principal && !f.properties.dbl && !DOUBLONS.doublons[f.properties.id]);
  const srcN = v.sources.map((id) => SRC[id] && SRC[id].n).filter(Boolean);
  const srcTxt = srcN.length > 1 ? `${srcN.length} sources (${srcN.join(', ')})` : `1 seule source (${srcN[0] || 'non citée'})`;
  const reg = l ? (L[l.region] || l).nom : '';
  // lieu plus précis que le quartier de la fiche (ex. « Hôtels Eden Grove Marina »), quand les sources le nomment
  const lieuT = v.lieuPrecis || (l ? l.nom : '');
  const fx = CATALOGUE.fiches[v.slug] || CATALOGUE.vehicules.find((x) => x.slug === v.slug) || {};
  const pres = presenceTxt(v.slug, v.sources);
  const recoupee = /^(Recoupée|Confirmée)/.test(pres);
  const mapHref = principal ? `${R}carte/?focus=${principal.properties.id}` : '';
  const fav = favBtn({ id: v.slug, type: 'vehicule', t: v.nom, u: p, i: c.icon, c: v.color || c.color }).replace('class="btn btn--ghost fav"', 'class="btn btn--ghost btn--wide fav"');
  // nature de chaque autre signalement : même modèle, variante (livrée spéciale) ou véhicule peut-être différent
  const base = (n) => n.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const genre = (f) => (base(f.properties.nom) === v.nom ? ['ok', unique(f) ? 'Même modèle, version unique' : 'Même modèle'] : unique(f) ? ['var', 'Variante : livrée spéciale'] : ['doute', 'Modèle à confirmer : peut-être un autre véhicule']);
  const statutF = (f) => `Repère ${(FI_TXT[f.properties.fi] || 'Non vérifié').toLowerCase()}${f.properties.cap ? ' (capture prise en jeu, GTABase)' : ''}`;
  const pas = sur ? v.obtenir : v.chercher || [`Va dans la zone signalée : ${l ? l.nom : 'voir la carte'}${reg && (!l || reg !== l.nom) ? `, à ${reg}` : ''}.`, `Vérifie l'endroit indiqué par la source : ${minDebut(v.emplacement)}`, `Si ${elle} n'y est pas, consulte les autres signalements ci-dessus.`];
  // véhicules similaires : même type, même catégorie, même marque ou même famille (pas de bateau pour une voiture)
  const score = (x) => { const fy = CATALOGUE.fiches[x.slug] || {}; return (x.sous === v.sous ? 3 : 0) + (fy.fabricant && fy.fabricant === fx.fabricant ? 2 : 0) + (fy.groupe && fy.groupe === fx.groupe ? 2 : 0); };
  const sim = VEHICULES.filter((x) => x.slug !== v.slug && x.type === v.type).map((x) => [score(x) + (PHOTOS[x.slug] ? 0.5 : 0), x]).filter(([s]) => s >= 3).sort((a, b) => b[0] - a[0] || a[1].nom.localeCompare(b[1].nom, 'fr')).slice(0, 3).map(([, x]) => x);
  // même région : véhicules du même type (pas de bateau pour une voiture) ; les autres types seulement s'il n'y en a aucun
  const regTous = l ? VEHICULES.filter((x) => x.slug !== v.slug && !sim.includes(x) && L[x.lieu] && (L[x.lieu].region || L[x.lieu].id) === (l.region || l.id)) : [];
  const memeReg = (regTous.some((x) => x.type === v.type) ? regTous.filter((x) => x.type === v.type) : regTous).slice(0, 3);
  // liens de l'ancienne présentation (« Même type ») conservés, plus discrètement
  const memeType = VEHICULES.filter((x) => x.slug !== v.slug && x.type === v.type).slice(0, 2).filter((x) => !sim.includes(x) && !memeReg.includes(x));
  return `<article class="wrap fiche vf" style="--c:${v.color || c.color}">
  <header class="fiche-head fiche-head--veh" data-reveal-group>
    <div class="veh-hero vf-hero"${vign('v-' + v.slug, R) ? ` style="--img:url(${vign('v-' + v.slug, R)})"` : ''}>${!PHOTOS[v.slug] && v.catImg ? `<img class="veh-photo" src="${R}catalogue/${v.catImg}" alt="${esc(v.nom)}"${wh('catalogue/' + v.catImg)} fetchpriority="high" decoding="async">` : vehVisuel(v, R, 'veh-svg--xl').replace(' loading="lazy"', ' fetchpriority="high"')}<span class="veh-type">${esc(v.sous)}</span>${lieuT ? `<span class="veh-pin">${icon('pin')}${esc(lieuT)}</span>` : ''}</div>
    ${!PHOTOS[v.slug] && v.catImg ? (v.catCredit ? `<p class="veh-credit">Image : ${v.catCreditUrl ? `<a href="${esc(v.catCreditUrl)}" target="_blank" rel="noopener">${esc(v.catCredit)}</a>` : esc(v.catCredit)}</p>` : '') : vehCredit(v)}
    <div class="fiche-tags"><a class="pill pill--cat" href="${R}vehicules/?cat=${v.type}">${icon(c.icon)}${esc(c.nom)}</a></div>
    <h1 class="h1 h1--fiche">${esc(v.nom)}</h1>
    <p class="vf-resume">${l || principal ? `Emplacement principal signalé à ${esc(reg || (l ? l.nom : ''))} par ${esc(srcN.length > 1 ? `${srcN.length} sources` : `une seule source (${srcN[0]})`)}${sur ? '.' : ', encore à vérifier.'}` : `Aucun emplacement fixe connu pour l'instant, selon ${esc(srcN.length > 1 ? `${srcN.length} sources` : `une seule source (${srcN[0]})`)}.`}</p>
  </header>
  <nav class="vf-bref" aria-label="En bref">
    ${l || v.lieuPrecis ? `<a href="#ou">${icon('pin')}<span><small>Emplacement</small><b>${esc(v.lieuPrecis || (l ? l.nom.replace(/^Commissariat de /, '') : '—'))}</b>${reg && l && reg !== l.nom ? `<i>${esc(reg)}</i>` : ''}</span></a>` : ''}
    ${mapHref ? `<a href="${mapHref}">${icon('map')}<span><small>Carte</small><b>Voir le point</b></span></a>` : ''}
    ${autres.length ? `<a href="#autres" data-ouvre>${icon('layers')}<span><small>Signalements</small><b>${1 + autres.length} au total</b></span></a>` : ''}
  </nav>
  <section class="vf-ou" id="ou" aria-labelledby="ou-t">
    <h2 id="ou-t" class="vf-k">${icon('pin')}Où ${la} trouver ?</h2>
    ${v.lieuPrecis ? `<p class="vf-lieu">${esc(v.lieuPrecis)}</p>${l ? `<p class="muted small vf-quartier">${l.type === 'region' ? 'Région' : 'Quartier'} : <a href="${R}lieux/${l.id}/">${esc(l.nom)}</a></p>` : ''}` : l ? `<p class="vf-lieu"><a href="${R}lieux/${l.id}/">${esc(l.nom)}</a></p>` : ''}
    <p class="vf-sous">${esc(v.emplacement)}</p>
    ${mapHref ? `<a class="btn btn--primary btn--wide" href="${mapHref}">${icon('map')}Voir sur la carte</a>` : `<p class="muted small">${icon('info')}Pas encore de repère sur la carte pour cet emplacement.</p>`}
    ${fav}
    ${principal ? ((st) => `<p class="vf-rep"><span class="pn-st" style="--c:${st.c}">${icon(st.ic)}Repère de la carte : ${esc(st.n)}</span><small>${esc(st.t)} « ${esc(statut(v.dispo).nom)} » concerne l'information de la fiche, tant qu'elle n'est pas confirmée en jeu.</small></p>`)(repereSt(principal)) : ''}
    ${(v.pistes || []).length ? `<p class="muted small vf-pistes">${icon('pin')}Autres lieux cités : ${v.pistes.map(([n, id]) => (id && mapIndex[id] ? `<a href="${R}carte/?focus=${id}">${esc(n)}</a>` : esc(n))).join(' · ')}</p>` : ''}
    ${principal && (v.noteCarte || principal.properties.precision === 'zone') ? `<p class="muted small vf-note">${icon('info')}${esc(v.noteCarte || 'Le repère de la carte indique le lieu, pas la place exacte.')}</p>` : ''}
  </section>
  ${autres.length ? `<details class="vf-autres" id="autres"><summary>${icon('layers')}<span>Autres signalements (${autres.length})</span>${icon('chevron')}</summary>
    <ul>${autres.map((f) => { const [g, gt] = genre(f); const d = f.properties.desc && f.properties.desc !== v.emplacement ? traduit(f.properties.desc) : ''; return `<li class="vf-sig" id="sig-${esc(f.properties.id)}">
      <p class="vf-sig-t"><b>${esc(traduit(f.properties.nom))}</b><span class="vf-genre vf-genre--${g}">${esc(gt)}</span></p>
      <p class="vf-sig-m">${f.properties.zone ? `${icon('pin')}${esc(f.properties.zone)} · ` : ''}${esc(statutF(f))}</p>
      <p class="vf-sig-d">${esc(natureLieu(f))}${d ? ` — ${esc(d.slice(0, 160))}` : ''}</p>
      <p class="vf-sig-s">Source : ${esc(sourceLieu(f))} · <a href="${R}carte/?focus=${f.properties.id}">${icon('map')}Voir sur la carte</a></p>
    </li>`; }).join('')}</ul>
  </details>` : ''}
  <section class="vf-bloc" aria-labelledby="ch-t">
    <h2 id="ch-t" class="vf-h">${icon(sur ? 'list' : 'target')}${sur ? `Comment l'obtenir` : `Comment ${la} chercher`}</h2>
    <ol class="vf-steps">${pas.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    ${mapHref ? `<a class="btn btn--primary btn--wide" href="${mapHref}">${icon('map')}Voir sur la carte</a>` : ''}
  </section>
  ${sim.length ? `<section class="vf-bloc" aria-labelledby="si-t"><h2 id="si-t" class="vf-h">${icon(c.icon)}Véhicules similaires</h2>
    <div class="vf-sim">${sim.map((x) => `<a href="${R}vehicules/${x.slug}/"><span class="vf-sim-i">${vehVisuel(x, R)}</span><b>${esc(x.nom)}</b>${icon('chevron')}</a>`).join('')}</div></section>` : ''}
  ${memeReg.length ? `<p class="vf-reg">${icon('pin')}Dans la même région : ${memeReg.map((x) => `<a href="${R}vehicules/${x.slug}/">${esc(x.nom)}</a>`).join(', ')}</p>` : ''}
${liens.filter(([, xs]) => xs.length).map(([t, xs]) => `<p class="vf-reg">${icon(c.icon)}${esc(t)} : ${xs.map((x) => `<a href="${R}vehicules/${x.slug}/">${esc(x.nom)}</a>`).join(', ')}</p>`).join('')}
  ${memeType.length ? `<p class="vf-reg">${icon(c.icon)}Autres ${esc(c.nom.toLowerCase())} du guide : ${memeType.map((x) => `<a href="${R}vehicules/${x.slug}/">${esc(x.nom)}</a>`).join(', ')}</p>` : ''}
  <section class="vf-bloc" aria-labelledby="in-t">
    <h2 id="in-t" class="vf-h">${icon('info')}Infos utiles</h2>
    <dl class="vf-infos">
      <div><dt>${icon(c.icon)}Type</dt><dd>${esc(c.nom)} · ${esc(v.sous)}</dd></div>
      ${fx.fabricant ? `<div><dt>${icon('badge')}Marque</dt><dd>${esc(fx.fabricant)}</dd></div>` : ''}
      ${fx.inspiration ? `<div><dt>${icon('layers')}Inspirée de</dt><dd>${esc(fx.inspiration)}</dd></div>` : ''}
      ${fx.transmission || fx.poids || fx.places ? `<div><dt>${icon('sliders')}Fiche technique</dt><dd>${[fx.places ? `${fx.places} places` : '', fx.transmission, fx.poids].filter(Boolean).map(esc).join(' · ')}</dd></div>` : ''}
      ${fx.aussi ? `<div class="vf-infos-l"><dt>${icon('gamepad')}Ancien GTA</dt><dd>Déjà présente dans ${esc(fx.aussi)}</dd></div>` : ''}
    </dl>
    ${(fx.sources || []).length ? `<p class="muted small">${icon('info')}Infos techniques relevées par ${fx.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="nofollow noopener">${esc(s.nom)}</a>`).join(', ')}, base de données de joueurs : pas encore vérifiées en jeu.</p>` : ''}
  </section>
  ${sourcesBlock([...v.sources, ...(v.sourcesPlus || [])])}
</article>`;
}

for (const v of VEHICULES) {
  const p = `vehicules/${v.slug}/`, R = R_(p);
  const c = cat('vehicules', v.type);
  const l = v.lieu && L[v.lieu];
  const onM = vehOnMap(v.slug);
  const similar = VEHICULES.filter((x) => x.slug !== v.slug && x.type === v.type).slice(0, 2);
  const sameReg = l ? VEHICULES.filter((x) => x.slug !== v.slug && L[x.lieu] && (L[x.lieu].region || L[x.lieu].id) === (l.region || l.id) && !similar.includes(x)).sort((a, b) => (a.type === v.type ? 0 : 1) - (b.type === v.type ? 0 : 1)).slice(0, 2) : [];
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
  ${(() => {
    const cc = concorde(v.slug, CAT_CARTE[v.slug]);
    // même véhicule, même endroit : le repère précis de la carte de joueurs passe en premier, la zone approximative de la fiche n'est plus listée (doublon)
    const rangL = (f) => (unique(f) ? 2 : 0) + (f.properties.fi === 'probable' || f.properties.fi === 'confirme' ? 0 : 1);
    const lieux = [cc && cc.f, onM && !cc && mapIndex['v-' + v.slug], ...(CAT_CARTE[v.slug] || []).filter((id) => !cc || id !== cc.f.properties.id).map((id) => mapIndex[id]).filter(Boolean).sort((a, b) => rangL(a) - rangL(b))].filter(Boolean);
    const srcN = v.sources.map((id) => SRC[id] && SRC[id].n).filter(Boolean);
    const fiab = { statut: v.dispo, texte: `${srcN.length > 1 ? `${srcN.length} sources` : '1 seule source'} : ${srcN.join(', ')}${cc ? ` · même endroit sur Open GTA 6 Map (carte de joueurs, à ~${Math.max(10, Math.round(cc.d / 10) * 10)} m) : deux sources concordent, non vérifié en jeu` : ''}` };
    return blocOu({ nom: v.nom, R, lieux, texte: v.emplacement, lien: l, fiab, etapes: v.obtenir, conseil: !!v.conseil, fav: favBtn({ id: v.slug, type: 'vehicule', t: v.nom, u: p, i: c.icon, c: v.color || c.color }), signaler: p })
      + blocFiab({ presence: esc(presenceTxt(v.slug, v.sources)), emplacement: `${esc(statut(v.dispo).nom)} · ${esc(fiab.texte)}`, obtention: `${esc(statut(v.dispo).nom)} · étapes tirées des mêmes sources` });
  })()}
  <dl class="facts">
    <div><dt>${icon(c.icon)}Type</dt><dd>${esc(c.nom)} · ${esc(v.sous)}</dd></div>
    ${CATALOGUE.fiches[v.slug] && CATALOGUE.fiches[v.slug].fabricant ? `<div><dt>${icon('badge')}Marque</dt><dd>${esc(CATALOGUE.fiches[v.slug].fabricant)}${CATALOGUE.fiches[v.slug].classe ? ' · ' + esc(CATALOGUE.fiches[v.slug].classe) : ''}</dd></div>` : ''}
    ${CATALOGUE.fiches[v.slug] && CATALOGUE.fiches[v.slug].inspiration ? `<div><dt>${icon('car')}Inspiré de</dt><dd>${esc(CATALOGUE.fiches[v.slug].inspiration)}${CATALOGUE.fiches[v.slug].places ? ` · ${esc(CATALOGUE.fiches[v.slug].places)} places` : ''}</dd></div>` : ''}
    ${CATALOGUE.fiches[v.slug] && (CATALOGUE.fiches[v.slug].transmission || CATALOGUE.fiches[v.slug].poids) ? `<div><dt>${icon('sliders')}Caractéristiques</dt><dd>${[CATALOGUE.fiches[v.slug].transmission, CATALOGUE.fiches[v.slug].poids, CATALOGUE.fiches[v.slug].aussi ? 'déjà dans ' + CATALOGUE.fiches[v.slug].aussi : ''].filter(Boolean).map(esc).join(' · ')}</dd></div>` : ''}
  </dl>
  ${similar.length ? `<section class="related"><h2 class="h3">${icon(c.icon)}Même type</h2><div class="minis">${similar.map((x) => relCard(x.slug, R)).join('')}</div></section>` : ''}
  ${sameReg.length ? `<section class="related"><h2 class="h3">${icon('pin')}Même région</h2><div class="minis">${sameReg.map((x) => relCard(x.slug, R)).join('')}</div></section>` : ''}
  ${sourcesBlock([...v.sources, ...(v.sourcesPlus || [])])}
</article>`;
  const argsV = { p, title: titreSEO(`${v.nom} GTA 6 : où le trouver et comment l'obtenir`, `${v.nom} GTA 6 : où le trouver`, `${v.nom} dans GTA 6`), desc: descSEO(['confirme', 'teste'].includes(v.dispo) ? `Où trouver ${v.nom} dans GTA 6 :` : `Où trouver ${v.nom} dans GTA 6 (emplacement signalé, à vérifier) :`, minDebut(v.emplacement), v.obtenir[0] || ''), body, cls: 'p-fiche', ogType: 'article',
    image: PHOTOS[v.slug] ? `photos/${PHOTOS[v.slug].fichier}` : '',
    schema: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: `${v.nom} dans GTA 6`, url: `${site.url}/${p}`, inLanguage: 'fr', about: { '@type': 'VideoGame', name: 'Grand Theft Auto VI' }, ...(PHOTOS[v.slug] ? { primaryImageOfPage: { '@type': 'ImageObject', contentUrl: `${site.url}/photos/${PHOTOS[v.slug].fichier}`, ...(PHOTOS[v.slug].credit ? { creditText: PHOTOS[v.slug].credit } : {}) } } : {}) }], scripts: MODELES[v.slug] ? ['v3d-init.js'] : [], crumbs: [['Accueil', ''], ['Véhicules', 'vehicules/'], [v.nom, p]] };
  if (FICHE_V2.has(v.slug)) V2_A_FAIRE.push(() => emit(p, layout({ ...argsV, body: ficheV2(v, { p, R, c, l, onM }), cls: 'p-fiche p-vfiche' })));
  else emit(p, layout(argsV));
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
  const parNom = (l) => [...l].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const grpListe = parNom(CATALOGUE.vehicules.filter((y) => y.groupe === x.groupe && (y === x || (VERIF[y.slug] || {}).statut === 'confirme')));
  const memeGroupe = voisinsDe(grpListe, x, 4);
  const mqListe = x.fabricant ? parNom(CATALOGUE.vehicules.filter((y) => y.fabricant === x.fabricant && (y === x || (VERIF[y.slug] || {}).statut === 'confirme'))) : [];
  const memeMarque = x.fabricant ? voisinsDe(mqListe, x, 6).filter((y) => !memeGroupe.includes(y)).slice(0, 4) : [];
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
    ${x.img ? (() => {
      // vitrine : photo 16:9 en pleine largeur, ouverte en plein écran dans sa plus grande résolution (catalogue-hd)
      const L = (dimImg('catalogue/' + x.img) || [])[0], mini = fs.existsSync(path.join(ROOT, 'src', 'catalogue-mini', x.img)) && L > 960;
      const hd = x.hd && fs.existsSync(path.join(ROOT, 'src', 'catalogue-hd', x.hd)) ? `catalogue-hd/${x.hd}` : `catalogue/${x.img}`;
      return `<figure class="veh-show"><div class="veh-show-img"><img class="veh-photo" src="${R}catalogue/${x.img}"${mini ? ` srcset="${R}catalogue-mini/${x.img} 960w, ${R}catalogue/${x.img} ${L}w" sizes="(min-width: 1180px) 1100px, 94vw"` : ''} alt="${esc(x.nom)} dans GTA 6"${wh('catalogue/' + x.img)} fetchpriority="high" decoding="async"><button class="veh-plein" type="button" data-plein="${R}${hd}" data-plein-alt="${esc(x.nom)}" aria-label="Voir l'image de ${esc(x.nom)} en plein écran">${icon('expand')}</button></div>${x.credit ? `<figcaption class="veh-credit">Image : ${x.creditUrl ? `<a href="${esc(x.creditUrl)}" target="_blank" rel="noopener nofollow">${esc(x.credit)}</a>` : esc(x.credit)}</figcaption>` : ''}</figure>`;
    })() : `<div class="veh-hero">${silhouette({ slug: '', type: x.type }, 'veh-svg--xl')}</div>`}
    <div class="fiche-tags"><a class="pill pill--cat" href="${R}vehicules/?cat=${x.type}">${icon(c.icon)}${esc(c.nom)}</a>${grp ? `<a class="pill" href="${R}vehicules/#cat-${x.groupe}">${esc(grp.nom)}</a>` : ''}</div>
    <h1 class="h1 h1--fiche">${esc(x.nom)}</h1>
  </header>
  ${(() => {
    const srcL = [...new Set(lo.map(sourceLieu))];
    const fiab = { statut: 'a-verifier', texte: srcL.length ? `relevé par les joueurs, pas encore vérifié en jeu · ${srcL.join(', ')}` : x.obtenir ? 'décrit par GTA Wiki (wiki de joueurs), pas encore vérifié en jeu' : '' };
    return blocOu({ nom: x.nom, R, lieux: lo, texte: x.obtenir || '', fiab, etapes: null, fav: favBtn({ id: x.slug, type: 'vehicule', t: x.nom, u: p, i: c.icon, c: c.color }), signaler: p })
      + blocFiab({
        presence: esc(presenceTxt(x.slug)),
        emplacement: lo.length || x.obtenir ? `À vérifier · ${esc(fiab.texte)}` : 'Aucun emplacement relevé',
        obtention: x.obtenir ? 'Décrite par GTA Wiki (wiki de joueurs), à vérifier en jeu' : 'Non documentée : on n’indique rien tant que ce n’est pas sourcé'
      });
  })()}
  <section class="answer"><span class="answer-k">${icon('bolt')}En bref</span><p>${esc(x.resume)}</p></section>
  <dl class="facts">
    ${faits.map(([i, k, v]) => `<div><dt>${icon(i)}${k}</dt><dd>${v}</dd></div>`).join('')}
  </dl>
  ${memeGroupe.length ? `<section class="related"><h2 class="h3">${icon(c.icon)}Autres ${esc((grp ? grp.nom : x.classe).toLowerCase())}</h2><div class="minis">${memeGroupe.map(mini).join('')}</div></section>` : ''}
  ${memeMarque.length ? `<section class="related"><h2 class="h3">${icon('badge')}Autres véhicules ${esc(x.fabricant)}</h2><div class="minis">${memeMarque.map(mini).join('')}</div></section>` : ''}
  ${x.sources && x.sources.length ? `<details class="sources"><summary>${icon('shield')}Sources (${x.sources.length})</summary><ul>${x.sources.map((s) => `<li><a href="${esc(s.url)}" rel="nofollow noopener" target="_blank">${esc(s.nom)}</a></li>`).join('')}</ul></details>` : ''}
</article>`;
  const argsC = {
    p, title: lo.length || x.obtenir ? titreSEO(`${x.nom} GTA 6 : où le trouver et caractéristiques`, `${x.nom} GTA 6 : où le trouver`, `${x.nom} dans GTA 6`) : titreSEO(`${x.nom} GTA 6 : fiche, photo et caractéristiques`, `${x.nom} GTA 6 : fiche et photo`, `${x.nom} dans GTA 6`),
    desc: descSEO(`${x.nom} dans GTA 6${x.fabricant ? ` (${x.fabricant})` : ''} : ${x.classe.toLowerCase()}${x.inspiration && x.inspiration !== x.nom && x.inspiration !== x.modele ? `, inspiré de ${x.inspiration}` : ''}${x.places ? `, ${x.places} places` : ''}${x.transmission ? `, ${x.transmission}` : ''}${x.poids ? `, ${x.poids}` : ''}.`, lo.length ? `Repéré à ${lo.length} endroit${lo.length > 1 ? 's' : ''} sur la carte.` : x.obtenir ? 'Comment l’obtenir.' : '', x.img ? 'Photo et caractéristiques.' : 'Caractéristiques et sources.'),
    body, cls: 'p-fiche', ogType: 'article', noindex: !sur, image: x.img ? `catalogue/${x.img}` : '',
    // la page décrit un véhicule du jeu : WebPage + image principale avec son crédit (pas de « Product », ce n'est pas un objet à vendre)
    schema: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: `${x.nom} dans GTA 6`, url: `${site.url}/${p}`, inLanguage: 'fr', about: { '@type': 'VideoGame', name: 'Grand Theft Auto VI' }, ...(x.img ? { primaryImageOfPage: { '@type': 'ImageObject', contentUrl: `${site.url}/catalogue/${x.img}`, ...(x.credit ? { creditText: x.credit } : {}) } } : {}) }],
    crumbs: [['Accueil', ''], ['Véhicules', 'vehicules/'], [x.nom, p]]
  };
  const o2 = FICHES_V2_CAT[x.slug];
  if (o2) { const v2 = { slug: x.slug, nom: x.nom, type: x.type, sous: x.classe.replace(/s$/, ''), obtenir: o2.chercher, kw: [], ...o2, catImg: x.img, catCredit: x.credit, catCreditUrl: x.creditUrl };
    V2_A_FAIRE.push(() => emit(p, layout({ ...argsC, body: ficheV2(v2, { p, R, c, l: L[o2.lieu], onM: false, liens: [[`Autres ${(grp ? grp.nom : x.classe).toLowerCase()}`, memeGroupe], [`Autres véhicules ${x.fabricant || ''}`.trim(), memeMarque]] }), cls: 'p-fiche p-vfiche' }))); }
  else emit(p, layout(argsC));
}

// ---------- OBJETS À COLLECTIONNER (une page par type ; repères communautaires Open GTA 6 Map, CC BY 4.0) ----------
const COLL = (() => {
  const PLURIEL = { 'Carte à collectionner': 'Cartes à collectionner', 'Scan WAiNK': 'Scans WAiNK', 'Caisse jaune': 'Caisses jaunes', 'Paquet caché': 'Paquets cachés', 'Magazine ou BD': 'Magazines et BD', 'Météorite': 'Météorites', 'Street art Ahol': 'Street art Ahol', 'Montre de luxe': 'Montres de luxe', 'Boîte à livres': 'Boîtes à livres', 'Playlist unique': 'Playlists uniques', 'Message dans une bouteille': 'Messages dans une bouteille', 'Conteneur SCOOP': 'Conteneurs SCOOP', 'Trésor': 'Trésors', 'Fresque 1010': 'Fresques 1010' };
  const objets = features.filter((f) => f.properties.cat === 'collection');
  const zones = features.filter((f) => f.properties.zone);
  // secteur : celui de la source, sinon le repère nommé le plus proche (à moins de 500 m), signalé comme estimé
  const secteur = (f) => {
    if (f.properties.zone) return { z: f.properties.zone, estime: false };
    const [x, y] = f.geometry.coordinates; let best = null, d = 500;
    for (const g of zones) { const e = Math.hypot(g.geometry.coordinates[0] - x, g.geometry.coordinates[1] - y); if (e < d) { d = e; best = g; } }
    return best ? { z: best.properties.zone, estime: true } : { z: '', estime: false };
  };
  const types = {};
  for (const f of objets) {
    const t = f.properties.service;
    (types[t] ||= { nom: t, pluriel: PLURIEL[t] || t, slug: norm(t).replace(/ /g, '-'), icon: f.properties.icon, items: [] }).items.push({ f, ...secteur(f) });
  }
  return Object.values(types).sort((a, b) => b.items.length - a.items.length);
})();
{
  const OGM_SRC = '<a href="https://github.com/fbritoferreira/gta6" rel="noopener nofollow" target="_blank">Open GTA 6 Map</a> (licence <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" rel="noopener nofollow" target="_blank">CC BY 4.0</a>)';
  const total = COLL.reduce((n, t) => n + t.items.length, 0);
  for (const T of COLL) {
    const p = `collection/${T.slug}/`, R = R_(p);
    const groupes = {};
    for (const it of T.items) (groupes[it.z || '~'] ||= []).push(it);
    const ordre = Object.keys(groupes).sort((a, b) => (a === '~') - (b === '~') || groupes[b].length - groupes[a].length || a.localeCompare(b, 'fr'));
    const ligne = (it) => `<li class="col-it" data-id="${it.f.properties.id}" data-text="${esc(norm(it.f.properties.nom + ' ' + it.z + ' ' + (it.f.properties.desc || '')))}">
      <button class="col-ok" type="button" data-trouve="${it.f.properties.id}" aria-pressed="false" aria-label="Marquer « ${esc(it.f.properties.nom)} » comme trouvé">${icon('check')}</button>
      <span class="col-t"><b>${esc(it.f.properties.nom)}</b>${it.f.properties.desc ? `<small>${esc(it.f.properties.desc)}</small>` : ''}</span>
      <a class="col-map" href="${R}carte/?focus=${it.f.properties.id}" aria-label="Voir « ${esc(it.f.properties.nom)} » sur la carte">${icon('map')}<span>Carte</span></a></li>`;
    const body = `<section class="wrap section col" data-col style="--c:#ff2bd6">
  <h1 class="h1">${esc(T.pluriel)} GTA 6 : les emplacements</h1>
  <p class="lead">${T.items.length} emplacement${T.items.length > 1 ? 's' : ''} repéré${T.items.length > 1 ? 's' : ''}, rangé${T.items.length > 1 ? 's' : ''} par secteur. Touche <b>Carte</b> pour voir la position relevée par les joueurs (approximative), et coche ce que tu as trouvé.</p>
  ${COLL_NOTES[T.slug] ? `<p class="note">${icon('alert')}<span>${esc(COLL_NOTES[T.slug])}</span></p>` : ''}
  <div class="col-prog" aria-live="polite"><span><b data-col-n>0</b> / ${T.items.length} trouvés</span><i class="col-bar"><i data-col-bar></i></i></div>
  ${fieldFilter('Chercher un nom ou un secteur')}
  <div class="filterbar"><button class="chip chip--toggle" type="button" data-col-cacher aria-pressed="false">${icon('eye')}Masquer les objets trouvés</button></div>
  ${ordre.map((z) => `<section class="col-z" data-col-z><h2 class="vgrp-h">${z === '~' ? 'Secteur non indiqué' : esc(z)} <small>${groupes[z].length}</small></h2>${groupes[z].some((i) => i.estime) ? '<p class="muted small">Secteur estimé d’après les repères voisins pour certains objets : la position sur la carte est celle relevée par la communauté.</p>' : ''}<ul class="col-l">${groupes[z].sort((a, b) => a.f.properties.nom.localeCompare(b.f.properties.nom, 'fr')).map(ligne).join('')}</ul></section>`).join('')}
  <p class="empty" data-col-vide hidden>${icon('search')}Aucun objet ne correspond.</p>
  <p class="note">${icon('info')}<span>Emplacements relevés par la communauté : ${OGM_SRC}. Ils ne sont pas encore tous vérifiés en jeu. Une erreur ? Écris à <a href="mailto:${site.editeur.email}">${site.editeur.email}</a>.</span></p>
  <section class="related"><h2 class="h3">${icon('badge')}Autres objets à collectionner</h2><div class="minis">${COLL.filter((x) => x !== T).map((x) => `<a class="mini" href="${R}collection/${x.slug}/" style="--c:#ff2bd6"><span class="mini-ico">${icon(x.icon)}</span><span><small>${x.items.length} emplacements</small><b>${esc(x.pluriel)}</b></span>${icon('arrow-right')}</a>`).join('')}</div></section>
</section>`;
    emit(p, layout({
      p, title: titreSEO(`${T.pluriel} GTA 6 : ${T.items.length} emplacement${T.items.length > 1 ? 's' : ''} repéré${T.items.length > 1 ? 's' : ''}`, `${T.pluriel} GTA 6 : emplacements`), desc: descSEO(`${T.items.length} emplacement${T.items.length > 1 ? 's' : ''} de ${T.pluriel.toLowerCase()} repéré${T.items.length > 1 ? 's' : ''} par les joueurs dans GTA 6, rangé${T.items.length > 1 ? 's' : ''} par secteur, avec un lien vers la carte interactive et une case pour cocher ceux que tu as trouvés.`),
      body, cls: 'p-list', scripts: ['collection.js'], crumbs: [['Accueil', ''], ['Objets à collectionner', 'collection/'], [T.pluriel, p]]
    }));
  }
  const p = 'collection/', R = R_(p);
  const body = `<section class="wrap section" data-col-index>
  <h1 class="h1">Objets à collectionner dans GTA 6</h1>
  <p class="lead">${total} emplacements repérés, en ${COLL.length} types. Choisis un type pour voir la liste par secteur et ouvrir chaque emplacement sur la carte.</p>
  <div class="minis">${COLL.map((x) => `<a class="mini" href="${R}collection/${x.slug}/" style="--c:#ff2bd6" data-col-type="${x.items.map((i) => i.f.properties.id).join(' ')}"><span class="mini-ico">${icon(x.icon)}</span><span><small data-col-compte="${x.items.length}">${x.items.length} emplacements</small><b>${esc(x.pluriel)}</b></span>${icon('arrow-right')}</a>`).join('')}</div>
  <a class="btn btn--wide" href="${R}carte/?cat=collection">${icon('map')}Voir tous les objets sur la carte</a>
  <p class="note">${icon('info')}<span>Emplacements relevés par la communauté : ${OGM_SRC}. Ils ne sont pas encore tous vérifiés en jeu.</span></p>
</section>`;
  emit(p, layout({ p, title: `Objets à collectionner GTA 6 : ${total} emplacements repérés`, desc: descSEO(`${total} emplacements d'objets à collectionner de GTA 6 repérés par les joueurs, par type : cartes, scans WAiNK, caisses jaunes, paquets cachés, météorites et plus.`), body, cls: 'p-list', scripts: ['collection.js'], crumbs: [['Accueil', ''], ['Objets à collectionner', p]] }));
}

// ---------- MISSIONS ET SOLUTIONS ----------
{
  const p = 'missions/', R = R_(p);
  const MS = MISSIONS.missions, CH = MISSIONS.chapitres;
  const princ = MS.filter((m) => !m.facultative).length, fac = MS.length - princ, taches = MS.filter((m) => m.tache).length, vraies = princ - taches;
  const chNom = (c) => (c.id === 'prologue' ? 'Prologue' : `Chapitre ${c.id}`);
  const PERS = { jason: 'Jason', lucia: 'Lucia' };
  const carte = (m) => `<details class="mis${m.facultative ? ' mis--opt' : ''}${m.tache ? ' mis--tache' : ''}" id="${m.id}" data-ch="${m.chapitre}" data-opt="${m.facultative ? 1 : 0}" data-num="${m.num || ''}"${ordreAVerifier(m) ? ' data-ov="1"' : ''} data-text="${esc(norm([m.nom, m.nomEn, m.resume, m.donneur, ...m.etapes].join(' ')))}">
    <summary><span class="mis-n">${m.num ? m.num : icon('plus')}</span><span class="mis-t"><b>${esc(m.nom)}</b>${m.facultative || m.manquable || m.tache || ordreAVerifier(m) ? `<small>${[m.facultative ? 'facultative' : '', m.tache ? 'petite tâche' : '', m.manquable ? '<em>peut être manquée</em>' : '', ordreAVerifier(m) ? 'ordre à vérifier' : ''].filter(Boolean).join(' · ')}</small>` : ''}</span><span class="mis-done" aria-hidden="true">${icon('check')}</span></summary>
    <div class="mis-b">
      <p class="mis-r spoil">${esc(MGUIDE.missions[m.id] ? MGUIDE.missions[m.id].objectif : m.resume)}</p>
      <ul class="mis-meta">${m.donneur ? `<li>${icon('phone')}<span><b>Donnée par</b> ${esc(m.donneur)}</span></li>` : ''}<li>${icon('user')}<span><b>Tu joues</b> ${m.perso.map((x) => PERS[x]).join(' et ')}</span></li>${m.recompense ? `<li>${icon('money')}<span><b>Récompense</b> ${esc(m.recompense)} <small>(selon GTABase, non vérifiée)</small></span></li>` : ''}</ul>
      <h3 class="mis-h">${icon('list')}Étape par étape</h3>
      <ol class="mis-steps">${m.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>
      ${MGUIDE.missions[m.id] ? `<div class="mis-help"><h3 class="mis-h">${icon('question')}Si tu es bloqué</h3><ul>${MGUIDE.missions[m.id].erreurs.map((e) => `<li><b>${esc(e.p)}</b> ${esc(e.s)}</li>`).join('')}</ul></div>` : m.bloque.length ? `<div class="mis-help"><h3 class="mis-h">${icon('question')}Si tu es bloqué</h3><ul>${m.bloque.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
      <div class="mis-act"><a class="btn-s btn-s--ghost" href="${R}missions/${m.id}/">${icon('link')}<span>Page de la mission</span></a><button class="btn-s" type="button" data-mdone aria-pressed="false">${icon('check')}<span>Mission faite</span></button>${missionsSur[m.id] ? `<a class="btn-s btn-s--ghost" href="${R}carte/?focus=${missionsSur[m.id]}&amp;mission=${m.id}">${icon('map')}<span>Voir sur la carte</span></a>` : ''}${m.facultative ? '' : `<button class="btn-s btn-s--ghost" type="button" data-mhere>${icon('flag')}<span>J'en suis là</span></button>`}</div>
      <p class="mis-src">${icon('info')}${misSrc(m)}</p>
    </div>
  </details>`;
  const body = `<section class="wrap section missions" data-missions>
  <h1 class="h1">Missions et solutions</h1>
  <p class="lead">L'histoire par chapitre : <b>${vraies} missions principales</b> et <b>${taches} petites tâches</b> (envoyer de l'argent, faire les courses…), plus <b>${fac} missions facultatives</b>. Pour chacune : ce qu'il faut faire, étape par étape, et quoi faire si tu bloques.</p>
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
  <p class="spoil-line"><button class="chip" type="button" data-spoil-tg aria-pressed="false">${icon('eye')}Masquer les spoilers</button></p>
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
  emit(p, layout({ p, title: 'Missions GTA 6 : solutions chapitre par chapitre', desc: `Solutions de ${MS.length} missions de GTA 6 (histoire principale et ${fac} missions facultatives), étape par étape, avec de l'aide si tu es bloqué.`, body, cls: 'p-list', scripts: ['missions.js'], crumbs: [['Accueil', ''], ['Missions', 'missions/']] }));
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
    const lienM = (x, k) => `<a class="mini" href="${R}missions/${x.id}/" style="--c:#ff3d6e"><span class="mini-ico">${icon('flag')}</span><span><small>${esc(k)}</small><b${k.startsWith('Mission suivante') ? ' class="spoil"' : ''}>${esc(x.nom)}</b></span>${icon('arrow-right')}</a>`;
    const tags = [m.facultative ? 'Facultative' : m.tache ? 'Petite tâche' : 'Histoire principale', m.manquable ? 'Peut être manquée' : ''].filter(Boolean);
    // fiche enrichie : solution rapide d'abord, conditions ensuite, explications complémentaires repliées en bas
    const G = MGUIDE.missions[m.id];
    const suivSure = suiv && !ordreAVerifier(m) && !ordreAVerifier(suiv);
    const facts = `<dl class="facts">
    <div><dt>${icon('user')}Tu joues</dt><dd>${m.perso.map((x) => PERS[x] || x).join(' et ')}</dd></div>
    ${m.donneur ? `<div><dt>${icon('phone')}Donnée par</dt><dd>${m.donneur.split(', ').map((n) => PERSO_ENC[n] ? `<a href="${R}encyclopedie/${PERSO_ENC[n]}/">${esc(n)}</a>` : esc(n)).join(', ')}</dd></div>` : ''}
    ${G && G.avant ? `<div><dt>${icon('clock')}Débloquée</dt><dd>${G.apres && MIS[G.apres] ? `${esc(G.avant)} <a href="${R}missions/${G.apres}/">Voir « ${esc(MIS[G.apres].nom)} »</a>` : esc(G.avant)}</dd></div>` : ''}
    ${G && (G.manque || m.manquable) ? `<div><dt>${icon('alert')}Peut être manquée</dt><dd>${esc(G.manque || 'Oui, selon GTABase : fais-la dès qu\u2019elle est proposée.')}</dd></div>` : ''}
    ${G && G.cent ? `<div><dt>${icon('trophy')}Pour le 100 %</dt><dd>${esc(G.cent)}</dd></div>` : ''}
    ${!G && m.recompense ? `<div><dt>${icon('money')}Récompense</dt><dd>${esc(m.recompense)}</dd></div>` : ''}
    ${lieux.length ? `<div><dt>${icon('pin')}Lieu</dt><dd>${lieux.map((l) => `<a href="${R}lieux/${l.id}/">${esc(l.nom)}</a>`).join(', ')}</dd></div>` : ''}
  </dl>`;
    const body = `<article class="wrap fiche" style="--c:#ff3d6e">
  <header class="fiche-head" data-reveal-group>
    <div class="fiche-ico">${icon('flag', 'ic-xl')}</div>
    <div class="fiche-tags"><a class="pill pill--cat" href="${R}missions/#ch-${m.chapitre}">${icon('flag')}${chNom(m.chapitre)}${ch.titre && m.chapitre !== 'prologue' ? ` · ${esc(ch.titre)}` : ''}</a>${tags.map((t) => `<span class="pill">${esc(t)}</span>`).join('')}${m.num ? `<span class="pill">Mission ${m.num}${ordreAVerifier(m) ? ' · ordre à vérifier' : ''}</span>` : ''}</div>
    <h1 class="h1 h1--fiche">${esc(m.nom)} : solution de la mission</h1>
    ${m.nomEn && m.nomEn !== m.nom ? `<p class="muted">Nom anglais : ${esc(m.nomEn)}</p>` : ''}
  </header>
  <section class="answer"><span class="answer-k">${icon(G ? 'flag' : 'bolt')}${G ? 'Objectif' : 'En bref'}<button class="lnk spoil-tg" type="button" data-spoil-tg aria-pressed="false">Masquer les spoilers</button></span><p class="spoil">${esc(G ? G.objectif : m.resume)}</p></section>
  <div class="actions">
    <a class="btn btn--primary" href="#etapes">${icon('list')}Voir la solution</a>
    <a class="btn" href="#bloque">${icon('question')}Je suis bloqué</a>
    ${missionsSur[m.id] ? `<a class="btn" href="${R}carte/?focus=${missionsSur[m.id]}&amp;mission=${m.id}">${icon('map')}Voir sur la carte</a>` : ''}
    <button class="btn btn--ghost" type="button" data-mission-faite="${m.id}" aria-pressed="false">${icon('check')}<span data-on="Mission faite" data-off="J'ai fini cette mission">J'ai fini cette mission</span></button>
    ${suiv && (!G || suivSure) ? `<a class="btn btn--primary" href="${R}missions/${suiv.id}/" data-mission-suivante hidden>${icon('arrow-right')}<span>Mission suivante : <span class="spoil">${esc(suiv.nom)}</span></span></a>` : ''}
  </div>
  ${G ? `  <section class="steps-wrap" id="etapes" aria-labelledby="et-t">
    <h2 id="et-t" class="h3">${icon('list')}${G ? 'Solution rapide' : 'Solution étape par étape'}</h2>
    <ol class="steps">${m.etapes.map((e, n) => `<li class="step"><span class="step-n">${n + 1}</span><span class="step-t">${esc(e)}</span></li>`).join('')}</ol>
    ${G ? `<p class="muted small">${icon('info')}Étapes rédigées d'après le guide de GTABase (relevé du 22/11/2026), pas encore vérifiées en jeu.</p>` : ''}
  </section>
  <section class="related" aria-labelledby="av-t"><h2 id="av-t" class="h3">${icon('flag')}Avant de commencer</h2>
  ${facts}</section>
  <section class="steps-wrap mis-bloque" id="bloque" aria-labelledby="bl-t"><h2 id="bl-t" class="h3">${icon('question')}Si tu es bloqué</h2><ul>${G.erreurs.map((e) => `<li><b>${esc(e.p)}</b> ${esc(e.s)}</li>`).join('')}</ul>
    <p><a class="btn-s btn-s--ghost" href="mailto:${site.editeur.email}?subject=${encodeURIComponent(`Bloqué sur la mission ${m.nom}`)}&amp;body=${encodeURIComponent(`Mission : ${m.nom} (${site.url}/${p})\nÉtape où je bloque :\n`)}">${icon('mail')}<span>Je bloque encore : nous écrire</span></a></p></section>
  ${ordreAVerifier(m) ? ordreSources(m) : ''}
  <details class="more"><summary>${icon('book')}Explications complémentaires</summary>
    ${(G.plus || []).length ? `<ul>${G.plus.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <p><b>Récompense :</b> ${G.recompense || m.recompense ? `${esc(G.recompense || m.recompense)}, selon GTABase. Montant non vérifié en jeu.${G.recompenseNote ? ` ${esc(G.recompenseNote)}` : ''}` : 'aucune indiquée par GTABase.'}</p>
    <p>Source : ${esc(MGUIDE.source)}. Traduit et résumé par ${M}.</p>
  </details>` : `${facts}
  ${ordreAVerifier(m) ? ordreSources(m) : ''}
  <section class="steps-wrap" id="etapes" aria-labelledby="et-t">
    <h2 id="et-t" class="h3">${icon('list')}${G ? 'Solution rapide' : 'Solution étape par étape'}</h2>
    <ol class="steps">${m.etapes.map((e, n) => `<li class="step"><span class="step-n">${n + 1}</span><span class="step-t">${esc(e)}</span></li>`).join('')}</ol>
    ${G ? `<p class="muted small">${icon('info')}Étapes rédigées d'après le guide de GTABase (relevé du 22/11/2026), pas encore vérifiées en jeu.</p>` : ''}
  </section>
  <section class="steps-wrap mis-bloque" id="bloque" aria-labelledby="bl-t"><h2 id="bl-t" class="h3">${icon('question')}Si tu es bloqué</h2>${m.bloque.length ? `<ul>${m.bloque.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : `<p>Pas encore d'astuce pour cette mission. Relis l'étape où tu t'arrêtes ci-dessus, et dis-nous où tu bloques : on complète la fiche.</p>`}
    <p><a class="btn-s btn-s--ghost" href="mailto:${site.editeur.email}?subject=${encodeURIComponent(`Bloqué sur la mission ${m.nom}`)}&amp;body=${encodeURIComponent(`Mission : ${m.nom} (${site.url}/${p})\nÉtape où je bloque :\n`)}">${icon('mail')}<span>Je bloque encore : nous écrire</span></a></p></section>`}
  ${prec || suiv ? `<nav class="related" aria-label="Missions de l'histoire"><h2 class="h3">${icon('flag')}Dans l'histoire</h2><div class="minis">${prec ? lienM(prec, ordreAVerifier(m) || ordreAVerifier(prec) ? 'Mission précédente dans notre liste (ordre à vérifier)' : 'Mission précédente') : ''}${suiv ? lienM(suiv, ordreAVerifier(m) || ordreAVerifier(suiv) ? 'Mission suivante dans notre liste (ordre à vérifier)' : 'Mission suivante') : ''}</div></nav>` : ''}
  ${(() => { const al = ASTUCES.filter((a) => (a.voir || []).includes('mission:' + m.id)); return al.length ? `<section class="related"><h2 class="h3">${icon('sparkle')}Astuces liées à cette mission</h2><div class="minis">${al.map((a) => relCard(a.slug, R)).join('')}</div></section>` : ''; })()}${memeChap.length ? `<section class="related"><h2 class="h3">${icon('plus')}Autres missions facultatives du ${chNom(m.chapitre).toLowerCase()}</h2><div class="minis">${memeChap.map((x) => lienM(x, 'Facultative')).join('')}</div></section>` : ''}
  ${memeLieu.length ? `<section class="related"><h2 class="h3">${icon('pin')}Au même endroit</h2><div class="minis">${memeLieu.map((x) => lienM(x, chNom(x.chapitre))).join('')}</div></section>` : ''}
  <p class="muted small">${icon('info')}${misSrc(m)} <a href="${R}missions/">Toutes les missions</a></p>
</article>`;
    emit(p, layout({
      p, title: titreSEO(`${m.nom} GTA 6 : solution de la mission`, `${m.nom} GTA 6 : solution`, `${m.nom} – GTA 6`),
      desc: descSEO(`Solution de la mission « ${m.nom} » (${chNom(m.chapitre)}) de GTA 6 :`, m.resume, 'Étapes détaillées et aide si tu es bloqué.'),
      body, cls: 'p-fiche', ogType: 'article',
      schema: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `${m.nom} : solution de la mission`, description: m.resume, inLanguage: 'fr', about: { '@type': 'VideoGame', name: 'Grand Theft Auto VI' }, author: { '@type': 'Organization', name: M, url: site.url + '/' }, publisher: { '@type': 'Organization', name: M, url: site.url + '/' } }],
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
  emit(p, layout({ p, title: 'Guides GTA 6 : dossiers, astuces, codes et missions', desc: 'Tous nos guides GTA 6 au même endroit : dossiers détaillés, astuces par thème, codes de triche, missions, véhicules et carte interactive.', cls: 'p-list', crumbs: [['Accueil', ''], ['Tous les guides', p]],
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
  const FLT = { haut: '↑', bas: '↓', gauche: '←', droite: '→' };
  const texte = (seq) => seq.map((d) => FL[d]).join(', ');
  const fleches = (seq, k = 'Combinaison (croix directionnelle) :') => `<div class="code-seq" aria-hidden="true">${seq.map((d, i) => `<span class="dp dp--${d}">${icon('arrow-right')}</span>${i < seq.length - 1 ? '<i></i>' : ''}`).join('')}</div>
    <p class="code-txt"><span class="code-txt-k">${k}</span> <span class="code-txt-v">${seq.map((d) => `${FLT[d]} ${FL[d]}`).join(' · ')}</span></p>
    <button class="btn-s btn-s--ghost code-copy" type="button" data-copy-text="${esc(texte(seq))}">${icon('link')}<span>Copier la combinaison</span></button>`;
  const confirme = (c) => c.confirme && !c.contradiction && indepNoms(c.sources).length >= 2;
  const C = CODES.codes, cats = CODES.categories;
  const connus = C.filter((c) => c.sequence.length).length;
  const carte = (c, k) => `<article class="code" id="${c.id}" style="--c:${k.color}" data-cat="${c.cat}" data-seq="${c.sequence.length ? 1 : 0}" data-text="${esc(norm([c.nom, c.nomEn, c.effet, c.deblocage, k.nom].join(' ')))}">
    <header class="code-h"><span class="code-ico">${icon(k.icon)}</span><div><h3>${esc(c.nom)}</h3></div><button class="code-fav fav--mini" type="button" data-fav='${esc(JSON.stringify({ id: c.id, type: 'code', t: c.nom, u: `codes/#${c.id}`, i: k.icon, c: k.color }))}' aria-pressed="false" aria-label="Favori : code ${esc(c.nom)}">${icon('heart')}</button></header>
    <p class="code-effet">${esc(c.effet)}</p>
    ${c.variantes ? `<p class="code-tba">${icon('alert')}Deux combinaisons différentes circulent, aucune n'est vérifiée en jeu.</p>${c.variantes.map((v, i) => `<div class="code-var">${fleches(v.sequence, `Version ${'AB'[i]}, selon ${esc(v.sources.join(' et '))} (${v.sequence.length} flèches, non vérifiée) :`)}</div>`).join('')}` : c.sequence.length ? fleches(c.sequence) : `<p class="code-tba">${icon('question')}Combinaison pas encore découverte</p>`}
    <p class="code-unlock">${icon('trophy')}<span><b>Pour le débloquer :</b> ${esc(c.deblocage)}</span></p>
  </article>`;
  const body = `<section class="wrap section codes" data-codes>
  <h1 class="h1">Codes de triche GTA 6</h1>
  <ol class="howto">
    <li><span class="howto-n">1</span><span>${icon('flag')}<b>Termine l'histoire</b> La liste des codes apparaît dans le menu Progression.</span></li>
    <li><span class="howto-n">2</span><span>${icon('trophy')}<b>Débloque le code</b> Chaque code a son défi (sport, tir, collection…).</span></li>
    <li><span class="howto-n">3</span><span>${icon('phone')}<b>Tape-le au téléphone</b> Sors le téléphone, maintiens L1 et appuie sur R1 (PS5) ou LB + RB (Xbox), puis tape les flèches avec la croix.</span></li>
  </ol>
  <p class="note note--warn">${icon('alert')}<span>Un code actif <b>bloque la sauvegarde et les trophées</b> jusqu'à ce que tu quittes le jeu. Sauvegarde avant d'utiliser un code.</span></p>
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
  emit(p, layout({ p, title: `Codes de triche GTA 6 PS5 et Xbox : ${C.length} codes relevés`, desc: `${connus} codes de triche de GTA 6 relevés par les joueurs, dont ${C.filter(confirme).length} recoupés par deux sources distinctes : effet, déblocage, flèches et sources de chaque code.`, body, cls: 'p-list', scripts: ['codes.js'], crumbs: [['Accueil', ''], ['Codes', 'codes/']] }));
}

// ---------- GLITCHS : page de la rubrique ----------
{
  const p = 'glitchs/', R = R_(p);
  const corriges = GLITCHS.filter((g) => ['corrige', 'faux'].includes(gStatut(g).id));
  const actifs = GLITCHS.filter((g) => !corriges.includes(g));
  // chaque glitch n'apparaît qu'une fois : du moment, meilleurs, nouveaux, puis tous les autres
  const moment = GL_RECO[0] && actifs.includes(GL_RECO[0]) ? GL_RECO[0] : null;
  const reste = actifs.filter((g) => g !== moment);
  const meilleurs = reste.filter((g) => GL_RECO.includes(g)).slice(0, 3);
  const nouveaux = reste.filter((g) => !meilleurs.includes(g)).sort((a, b) => (b.publieLe || '').localeCompare(a.publieLe || '')).slice(0, 3);
  const autres = reste.filter((g) => !meilleurs.includes(g) && !nouveaux.includes(g));
  const nOk = actifs.filter((g) => gStatut(g).id === 'fonctionnel').length;
  const aRevoir = actifs.filter((g) => gStatut(g).avant);
  const sec = (id, titre, ic, list, grand) => (list.length ? `<section class="gl-sec" data-gl-sec aria-labelledby="gl-${id}"><h2 class="gl-h" id="gl-${id}">${icon(ic)}${titre}</h2><div class="gl-grid${grand ? ' gl-grid--une' : ''}">${list.map((g) => gCarte(g, R, grand)).join('')}</div></section>` : '');
  const cats = Object.entries(GCATS).filter(([id]) => actifs.some((g) => g.cat === id));
  const body = `<section class="wrap section gl-page" data-gl>
  ${ongletsAstuces(R, 'glitchs')}
  <header class="gl-head">
    <p class="kicker">${icon('bolt')}Rubrique Astuces</p>
    <h1 class="h1 gl-h1">Glitchs GTA 6</h1>
    <p class="lead">Les meilleurs glitchs, leurs tutoriels et leur état de fonctionnement.</p>
  </header>
  <label class="field gl-q">${icon('search')}<span class="sr-only">Rechercher un glitch</span><input type="search" placeholder="Rechercher un glitch…" data-gl-q autocomplete="off" enterkeyhint="search"></label>
  <div class="gl-filtres" role="group" aria-label="Filtrer les glitchs">
    <button type="button" class="gl-ok" data-gl-ok aria-pressed="false">${icon('check')}Fonctionnent encore <small>${nOk}</small></button>
    <div class="gl-chips"><button type="button" class="chip" data-gl-cat="" aria-pressed="true">Tous <small>${actifs.length}</small></button>${cats.map(([id, c]) => `<button type="button" class="chip" data-gl-cat="${id}" aria-pressed="false" style="--c:${c.c}">${icon(c.ic)}${esc(c.n)} <small>${actifs.filter((g) => g.cat === id).length}</small></button>`).join('')}</div>
  </div>
  <p class="gl-vide" data-gl-vide hidden></p>
  ${moment ? sec('moment', 'Glitch du moment', 'flame', [moment], true) : ''}
  ${sec('meilleurs', 'Meilleurs glitchs', 'star', meilleurs)}
  ${sec('nouveaux', 'Nouveaux glitchs', 'sparkle', nouveaux)}
  ${sec('tous', 'Tous les glitchs', 'list', autres)}
  ${corriges.length ? `<details class="gl-corr"><summary>${icon('x')}Glitchs corrigés (${corriges.length})</summary><div class="gl-grid">${corriges.map((g) => gCarte(g, R)).join('')}</div></details>` : ''}
  <details class="gl-statuts"><summary>${icon('shield')}Comment nous évaluons un glitch</summary><ul>${Object.values(GSTATUTS).map((S) => `<li><span class="gl-st" style="--s:${S.c}">${icon(S.ic)}${esc(S.n)}</span><span>${esc(S.t)}</span></li>`).join('')}</ul>
    <p>Un glitch n'est publié que si au moins une source a été lue par notre équipe. Une vidéo populaire ou des commentaires enthousiastes ne suffisent jamais à le déclarer fonctionnel. Les votes des joueurs sont un indicateur : ils ne changent pas le statut sans nouvelle vérification.</p></details>
</section>`;
  emit(p, layout({ p, title: 'Glitchs GTA 6 : meilleurs glitchs et s’ils fonctionnent encore', desc: `Les glitchs GTA 6 documentés (argent infini, vue première personne…) avec tutoriel en français, sources et état de fonctionnement après la mise à jour ${VDERN ? VDERN.id : ''}.`, body, cls: 'p-list p-glitchs', scripts: ['glitchs.js'], crumbs: [['Accueil', ''], ['Astuces', 'astuces/'], ['Glitchs', 'glitchs/']],
    schema: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Glitchs GTA 6', itemListElement: GLITCHS.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${site.url}/glitchs/${g.slug}/`, name: g.titre })) }] }));
}
// ---------- FICHE GLITCH ----------
for (const g of GLITCHS) {
  const p = `glitchs/${g.slug}/`, R = R_(p);
  const C = GCATS[g.cat], st = gStatut(g), lieux = gLieux(g);
  const S = Object.fromEntries((g.sources || []).map((x) => [x.id, x]));
  const cite = (id) => (S[id] ? ` <a class="gl-cite" href="${esc(S[id].url)}" target="_blank" rel="noopener nofollow">${esc(S[id].nom)}</a>` : '');
  const faits = [['Gain', g.gain], ['Difficulté', g.difficulte ? DIFF[g.difficulte] + (g.difficulteNote ? ` · ${g.difficulteNote}` : '') : ''], ['Durée', g.duree], ['Plateformes', (g.plateformes || []).join(', ')], ['Mode', g.mode], ['Dernier test', g.version ? `Sources portant sur la version ${g.version}` : g.etabliLe ? `Sources du ${fmtDate(g.etabliLe)}${VDERN && g.etabliLe < VDERN.date ? `, avant la mise à jour ${VDERN.id}` : ''}` : ''], ['Notre équipe', 'Pas encore reproduit sur console']].filter(([, v]) => v);
  const lieu1 = lieux[0];
  const carteLien = (e) => `${R}carte/?glitch=${g.slug}&focus=${e.carte}`;
  const body = `<article class="wrap fiche gl-fiche" style="--c:${C.c}" data-gl-fiche="${g.slug}">
  ${ongletsAstuces(R, 'glitchs')}
  ${['corrige', 'faux'].includes(st.id) ? `<p class="gl-alerte">${icon('alert')}<span>Ce glitch ${st.id === 'faux' ? 'est faux ou trompeur' : 'ne fonctionne plus'} : la page reste en ligne pour information.</span></p>` : ''}
  <figure class="gl-hero">${gVisuel(g, R)}</figure>
  <header class="gl-fh">
    <p class="gl-cat">${icon(C.ic)}${esc(C.n)} · Glitch</p>
    <div class="gl-fh-t"><h1 class="h1">${esc(g.titre)}</h1>${gFav(g)}</div>
    <div class="gl-fh-st">${gPill(g)}</div>
    ${lieu1 ? `<a class="btn btn--primary gl-carte-btn" href="${carteLien(lieu1)}">${icon('map')}Voir sur la carte interactive</a>` : ''}
  </header>
  <section class="gl-s"><h2 class="h3">${icon('bolt')}En bref</h2><p class="gl-bref">${esc(g.resume)}</p></section>
  ${g.afficherPrerequis && (g.prerequis || []).length ? `<section class="gl-s"><h2 class="h3">${icon('list')}Prérequis</h2><dl class="gl-pre">${g.prerequis.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}
  <section class="gl-s" aria-labelledby="gl-tuto"><h2 class="h3" id="gl-tuto">${icon('guide')}Tutoriel étape par étape</h2>
    <p class="gl-astuce">Coche les étapes au fur et à mesure : c'est gardé sur cet appareil.</p>
    <ol class="gl-etapes">${g.etapes.map((e, i) => { const L = e.lieu && lieux.find((x) => x.n === e.lieu); return `<li class="gl-et"><label><input type="checkbox" data-gl-et="${i}"><span class="gl-et-n">${i + 1}</span><span class="gl-et-t">${esc(e.t)}</span></label>${L ? `<a class="gl-et-map" href="${carteLien(L)}">${icon('pin')}Lieu ${L.n} sur la carte</a>` : ''}</li>`; }).join('')}</ol>
    <button type="button" class="gl-raz" data-gl-raz>${icon('replay')}Tout décocher</button>
    ${(g.variantes || []).length ? `<div class="gl-var">${g.variantes.map((v) => `<details><summary>${icon('swap')}Variante : ${esc(v.titre)}</summary><p>${esc(v.texte)}${v.source ? cite(v.source) : ''}</p></details>`).join('')}</div>` : ''}
  </section>
  ${lieux.length ? `<section class="gl-s"><h2 class="h3">${icon('pin')}Où aller</h2><div class="gl-lieux">${lieux.map((e) => { const f = mapIndex[e.carte].properties, vg = gVign(e.carte, R); return `<a class="gl-lieu" href="${carteLien(e)}">${vg ? `<span class="gl-lieu-map" style="background-image:url(${vg})"><i>${e.n || icon('pin')}</i></span>` : ''}<span class="gl-lieu-t"><b>${e.n ? `${e.n}. ` : ''}${esc(e.nom)}</b><small>${esc(f.zone || (REG[f.region] || {}).nom || '')}${f.zone || f.region ? ' · ' : ''}Position relevée par les joueurs, approximative</small>${e.note ? `<small class="gl-lieu-n">${esc(e.note)}</small>` : ''}</span>${icon('arrow-right')}</a>`; }).join('')}</div></section>` : ''}
  ${(g.problemes || []).length ? `<section class="gl-s"><h2 class="h3">${icon('wrench')}Problèmes fréquents</h2><dl class="gl-pb">${g.problemes.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>` : ''}
  ${(g.videos || []).length ? `<section class="gl-s"><h2 class="h3">${icon('eye')}Vidéos</h2><p class="gl-note">Vidéos des créateurs, chargées seulement si tu appuies dessus. Nous ne les avons pas visionnées : elles ne servent pas de preuve.</p><div class="gl-vids">${g.videos.map((v) => `<div class="gl-vid" data-yt="${esc(v.id)}"><button type="button" class="gl-vid-b" data-yt-go aria-label="Lire la vidéo : ${esc(v.titre)}"><span class="gl-vid-ic">${icon('replay')}</span><span><b>${esc(v.titre)}</b><small>${esc(v.createur)} · ${esc(v.plateforme)} · ${v.langue === 'fr' ? 'Français' : 'Anglais'}${v.versionCitee ? ` · version citée : ${esc(v.versionCitee)}` : ''}</small></span></button><a class="gl-vid-l" href="${esc(v.url)}" target="_blank" rel="noopener nofollow">Ouvrir sur ${esc(v.plateforme.split(' ')[0])}</a></div>`).join('')}</div></section>` : ''}
  <section class="gl-s gl-vote" data-gl-vote="${g.slug}" aria-labelledby="gl-vote-t"><h2 class="h3" id="gl-vote-t">${icon('talk')}Ce glitch fonctionne-t-il encore ?</h2>
    <p class="gl-note" data-vote-etat>Chargement des votes…</p>
    <div class="gl-vote-b" data-vote-btns hidden><button type="button" class="btn" data-vote="oui">Fonctionne 👍</button><button type="button" class="btn" data-vote="non">Ne fonctionne plus 👎</button><button type="button" class="btn" data-vote="partiel">Fonctionne partiellement</button></div>
    <form class="gl-vote-f" data-vote-form hidden>
      <label>Sur quelle console ?<select name="plateforme" required><option value="">Choisir</option><option value="ps5">PS5</option><option value="xsx">Xbox Series X</option><option value="xss">Xbox Series S</option></select></label>
      <button type="submit" class="btn btn--primary">Envoyer mon vote</button>
    </form>
    <p class="gl-note">Les votes sont un indicateur : ils ne changent pas le statut sans nouvelle vérification de notre équipe. Un vote par compte et par glitch.</p>
  </section>
  ${(g.historique || []).length ? `<details class="gl-hist"><summary>${icon('clock')}Historique du statut</summary><ul>${g.historique.map((h) => `<li><b>${fmtDate(h.date)}</b> · ${esc(GSTATUTS[h.statut] ? GSTATUTS[h.statut].n : h.statut)} · ${esc(h.note)}</li>`).join('')}${st.avant ? `<li><b>${fmtDate(st.depuis.date)}</b> · À revérifier · Mise à jour ${esc(st.depuis.id)} sortie depuis les dernières sources (calculé automatiquement).</li>` : ''}</ul></details>` : ''}
  ${GLITCHS.length > 1 ? `<section class="gl-s"><h2 class="h3">${icon('bolt')}Autres glitchs</h2><div class="gl-grid">${GLITCHS.filter((x) => x !== g).slice(0, 3).map((x) => gCarte(x, R)).join('')}</div><p><a class="btn" href="${R}glitchs/">${icon('list')}Tous les glitchs</a></p></section>` : `<p><a class="btn" href="${R}glitchs/">${icon('list')}Tous les glitchs</a></p>`}
</article>`;
  const howto = { '@context': 'https://schema.org', '@type': 'HowTo', name: g.titre, description: g.resume, inLanguage: 'fr', dateModified: g.verifieLe, datePublished: g.publieLe, step: g.etapes.map((e, i) => ({ '@type': 'HowToStep', position: i + 1, text: e.t })) };
  emit(p, layout({ p, title: titreSEO(`${g.titre} : glitch GTA 6, tutoriel et état`, `${g.titre} : glitch GTA 6`, `Glitch GTA 6 : ${g.court || g.titre}`), desc: descSEO(`Glitch GTA 6 : ${g.court || g.titre}.`, `${GSTATUTS[st.id].n}.`, g.resume), body, cls: 'p-fiche p-glitch', ogType: 'article', scripts: ['glitchs.js'], crumbs: [['Accueil', ''], ['Astuces', 'astuces/'], ['Glitchs', 'glitchs/'], [g.court || g.titre, p]], schema: [howto] }));
}

// statuts de fiabilité de la carte (mêmes libellés dans la légende et dans carte.js)
const STATUTS_CARTE = [
  { id: 'verifie', n: 'Confirmé', ic: 'check', c: '#4da3ff', t: 'Vérifié en jeu, ou établi par une source officielle et une source indépendante.' },
  { id: 'probable', n: 'Probable', ic: 'info', c: '#ffa53a', t: 'Position précise donnée par une carte de joueurs, ou appuyée par une capture prise en jeu sur place : pas encore vérifiée en jeu par notre équipe.' },
  { id: 'nonconf', n: 'Approximatif', ic: 'compass', c: '#ffd23f', t: 'Secteur connu, position exacte inconnue : le repère indique une zone de recherche.' },
  { id: 'nonverif', n: 'Non vérifié', ic: 'question', c: '#b3aec4', t: 'Une seule source sans preuve, ou information provisoire : masqué par défaut.' },
  { id: 'officiel', n: 'Confirmé', ic: 'badge', c: '#39ff88', t: 'Confirmé par Rockstar Games.' },
  { id: 'avenir', n: 'À venir', ic: 'clock', c: '#c77dff', t: 'Information pas encore disponible.' }
];
// ---------- CARTE (v2 : vraie carte communautaire) ----------
{
  const p = 'carte/', R = R_(p);
  const CC = site.categories.carte, CO2 = site.carteOptions;
  const cc = (id) => CC.find((c) => c.id === id);
  const nbRep = features.filter((f) => !f.properties.label).length;
  // guides liés (pages existantes seulement) : maillage interne visible, lisible par les moteurs de recherche
  const GUIDES = [['dossiers/argent-rapide/', "Gagner de l'argent rapidement", 'money', '#39ff88'], ['dossiers/codes-coffres/', 'Codes des coffres-forts', 'code', '#39ff88'], ['astuces/voiture-rare/', 'Emplacement des voitures rares', 'car', '#ff9a1f'], ['astuces/trouver-helicoptere/', 'Où trouver un hélicoptère', 'heli', '#ff9a1f'], ['astuces/armes-gratuites/', 'Armes gratuites', 'gun', '#ff3048'], ['dossiers/secrets/', 'Secrets et Easter Eggs', 'secret', '#ff2d87'], ['collection/tresor/', 'Emplacement des trésors', 'chest', '#b36bff'], ['collection/', 'Objets à collectionner', 'chest', '#b36bff'], ['dossiers/100-pour-cent/', 'Guide 100 %', 'trophy', '#19d3e3']]
    .filter(([u]) => pages.some((x) => x.p === u));
  const body = `<h1 class="sr-only">Carte interactive de GTA 6 : argent, voitures rares, armes, secrets et objets</h1>
<section class="atp" data-atlas-page>
  <div class="atp-stage" tabindex="0" role="application" aria-label="Carte de Leonida : glisse pour naviguer, pince ou molette pour zoomer"></div>
  <div class="atp-top">
    <div class="atp-sbar"><label class="atp-search"><span class="sr-only">Que recherches-tu dans GTA 6 ?</span>${icon('search')}<input type="search" id="atp-q" placeholder="Que recherches-tu dans GTA 6 ?" autocomplete="off" enterkeyhint="search" aria-controls="atp-sugg" aria-autocomplete="list"><button type="button" class="atp-qx" data-q-x hidden aria-label="Effacer la recherche">${icon('x')}</button></label></div>
    <div class="atp-sugg" id="atp-sugg" role="listbox" aria-label="Suggestions" hidden></div>
    <div class="atp-row">
      <div class="atp-cats" role="group" aria-label="Catégories principales">
        ${CO2.rapides.map((id) => { const c = cc(id); return `<button type="button" class="atp-chip" data-cat="${c.id}" aria-pressed="false" style="--c:${c.color}" title="${esc(c.nom)}">${icon(c.icon)}<span>${esc(c.court)}</span><small data-n="${c.id}"></small></button>`; }).join('')}
        <button type="button" class="atp-chip atp-chip--all" data-explorer aria-haspopup="dialog" aria-pressed="false" style="--c:#f4f1ff" title="Activités, propriétés, commerces, services et lieux">${icon('compass')}<span>Explorer</span></button>
        <button type="button" data-all hidden aria-pressed="false">Tout</button><small data-n="tout" hidden></small>
        <button type="button" class="atp-chip atp-chip--reset" data-reset hidden style="--c:#ff6b6b">${icon('x')}<span>Réinitialiser</span></button>
      </div>
      <button type="button" class="atp-fbtn" data-filtres aria-haspopup="dialog">${icon('filter')}<span>Filtres</span><b class="atp-nf" data-nf hidden></b></button>
    </div>
    <div class="atp-pop" data-pop-box role="group" aria-label="Recherches populaires"><button type="button" class="atp-pop-k" data-pop-tog aria-expanded="true" aria-controls="atp-pop-l">${icon('flame')}<span>Populaires</span>${icon('chevron')}</button><div class="atp-pop-l" id="atp-pop-l">${CO2.populaires.map((x, i) => `<button type="button" class="atp-popb" data-pop="${x.id}" aria-pressed="false" style="--c:${cc(x.cat).color}"${i >= 6 ? ' data-pop-extra hidden' : ''}>${icon(x.icon)}${esc(x.nom)}</button>`).join('')}${CO2.populaires.length > 6 ? `<button type="button" class="atp-popb atp-popb--plus" data-pop-plus aria-expanded="false">${icon('plus')}<span>Plus de recherches</span></button>` : ''}</div></div>
    <div class="atp-vide" data-vide hidden role="status">${icon('search')}<span>Choisis ce que tu recherches pour afficher les lieux sur la carte.</span></div>
    <div class="atp-solo atp-keep" data-keep hidden role="status">${icon('pin')}<span>Repère choisi : <b data-keep-nom></b></span><button type="button" data-keep-voir>${icon('arrow-right')}Voir</button><button type="button" class="atp-keep-x" data-keep-off aria-label="Effacer le repère choisi">${icon('x')}</button></div>
    <div class="atp-solo" data-solo hidden role="status">${icon('flag')}<span>Seul le lieu de ta mission est affiché : <b data-solo-nom></b>.<i class="atp-solo-more"> Choisis ce que tu cherches pour voir le reste.</i></span><button type="button" data-solo-off>${icon('map')}Tout afficher</button></div>
  </div>
  <div class="atp-ctrl">
    <button type="button" class="hm-btn atp-explore" data-explore aria-pressed="false" aria-label="Mode exploration (plein écran)">${icon('expand')}</button>
    <button type="button" class="hm-btn" data-z="in" aria-label="Zoomer">${icon('plus')}</button>
    <button type="button" class="hm-btn" data-z="out" aria-label="Dézoomer">${icon('minus')}</button>
    <button type="button" class="hm-btn" data-z="center" aria-label="Recentrer la carte (sur le repère choisi ou les résultats)">${icon('locate')}</button>
    <button type="button" class="hm-btn hm-btn--help" data-leg-btn aria-expanded="false" aria-controls="atp-leg" aria-label="Légende de la carte">${icon('question')}</button>
  </div>
  <div class="atp-leg" id="atp-leg" hidden>
    <div class="atp-leg-h"><b>Légende</b><button type="button" data-leg-x aria-label="Fermer la légende">${icon('x')}</button></div>
    <p>Choisis ce que tu recherches pour afficher les lieux sur la carte.</p>
    <details class="atp-leg-d"><summary>Catégories de la carte</summary><ul class="atp-leg-c">${CC.map((c) => `<li><span class="hl-dot" style="--c:${c.color}">${icon(c.icon)}</span><span><b>${esc(c.nom)}</b>${esc(c.sens)}</span></li>`).join('')}</ul></details>
    <ul class="atp-leg-b"><li><span class="atp-leg-ring"></span>Bordure pleine : emplacement vérifié en jeu</li><li><span class="atp-leg-ring atp-leg-ring--d"></span>Pointillés : approximatif ou à confirmer</li></ul>
    <details class="atp-leg-d"><summary>Statuts de fiabilité</summary><ul class="atp-leg-s">${STATUTS_CARTE.slice(0, 4).map((x) => `<li><span class="pn-st" style="--c:${x.c}">${icon(x.ic)}${esc(x.n)}</span><span>${esc(x.t)}</span></li>`).join('')}</ul></details>
    <details class="atp-leg-d"><summary>Guides liés</summary><ul class="atp-leg-g">${GUIDES.map(([u, t, ic, c]) => `<li><a href="${R}${u}" style="--c:${c}">${icon(ic)}${esc(t)}</a></li>`).join('')}</ul></details>
  </div>
  <div class="atp-regions" role="group" aria-label="Liste, régions et progression"><button type="button" class="atp-list" data-list>${icon('list')}Liste<small data-n="vue"></small></button><button type="button" class="atp-regb" data-reg-btn aria-haspopup="menu" aria-expanded="false">${icon('map')}<span data-reg-nom>Régions</span>${icon('chevron')}</button><button type="button" class="atp-progb" data-prog aria-label="Ma progression">${icon('progress')}<span>Progression</span></button>
    <div class="atp-regm" data-reg-menu role="menu" hidden><button type="button" role="menuitem" data-reg="">${icon('expand')}Toutes les régions</button>${CARTE.regions.map((r) => `<button type="button" role="menuitem" data-reg="${r.id}" style="--c:${r.couleur}"><i></i>${esc(r.nom)}</button>`).join('')}</div></div>
  <div class="atp-snack" data-snack role="status" aria-live="polite" hidden><span data-snack-t></span><button type="button" data-snack-undo>Annuler</button></div>
  <div class="atp-panel" data-panel role="region" aria-label="Détails" hidden aria-live="polite"></div>
  <details class="at-attrib at-attrib--page"><summary>${icon('info')}Sources</summary><p>${ATTRIB_HTML(R)} Lieux : GTADB, CC BY 4.0. Objets, armes, véhicules, braquages, commerces et activités : <a href="https://github.com/fbritoferreira/gta6" target="_blank" rel="noopener">Open GTA 6 Map</a> (fbritoferreira et contributeurs), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, positions converties et textes traduits.</p></details>
</section>`;
  const schema = [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Carte interactive de GTA 6', url: site.url + '/carte/', applicationCategory: 'GameApplication', operatingSystem: 'Web', inLanguage: 'fr', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, description: `Carte de Leonida avec ${nbRep} repères classés en ${CC.length} catégories. Positions signalées par les joueurs, fiabilité indiquée pour chaque point.` }];
  emit(p, layout({ p, title: 'Carte interactive GTA 6 : voitures rares, coffres, armes, secrets', desc: `Carte GTA 6 en français : voitures rares (Penumbra FF, supercars), codes des coffres, armes gratuites, trésors et objets du 100 %, avec la fiabilité.`, body, schema, cls: 'p-atlas', v2: true, scripts: ['atlas.js', 'carte.js'], styles: ['atlas.css'] }));
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
  emit(p, layout({ p, title: 'Lieux GTA 6 : régions, quartiers et points d\u2019intérêt', desc: `${LIEUX.length} lieux de GTA 6 par région et par type : où ils sont, comment y aller, les véhicules et les missions qui s'y trouvent.`, body, cls: 'p-list', crumbs: [['Accueil', ''], ['Lieux', 'lieux/']] }));
}

// personnages de l'encyclopédie, pour relier les missions qu'ils donnent
// Missions : l'existence est recoupée (ou non) ; les étapes, la récompense et l'aide sont rédigées d'après les guides, sans vérification en jeu
function misSrc(m) {
  const ind = indepNoms(m.sources), agr = m.sources.filter((n) => NON_INDEP[n]);
  const ex = ind.length >= 2 ? `Existence de la mission recoupée par ${esc(ind.join(' et '))}.` : `Mission listée par ${esc(ind.join(', ') || m.sources[0])}${agr.length ? ` (et ${esc(agr.join(', '))}, qui reprend d'autres guides)` : ''} : pas encore recoupée par une source indépendante.`;
  return `${ex} Étapes, récompense et aide rédigées par ${M} d'après les guides cités, pas encore vérifiées en jeu.`;
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
  const dedans = l.type === 'region' ? LIEUX.filter((x) => x.id !== l.id && x.region === l.id).slice(0, 24) : zone ? voisinsDe(LIEUX.filter((x) => x.region === zone && x.type !== 'region'), l, 6) : [];
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
  const refs = encyRefs(e);
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
    <section class="known"><h2 class="h3">${icon('check')}Ce qu'on sait</h2><ul>${e.sait.map((s, i) => `<li>${esc(s)}${refs.marque(i)}</li>`).join('')}</ul></section>
    <section class="unknown"><h2 class="h3">${icon('question')}Ce qui reste incertain</h2><ul>${e.incertain.map((s) => `<li>${esc(s)}</li>`).join('') || '<li>Rien de notable.</li>'}</ul></section>
  </div>
  ${guides.length ? `<section class="related" id="guides"><h2 class="h3">${icon('bolt')}Guides liés</h2><div class="minis">${guides.map((s) => relCard(s, R)).join('')}</div></section>` : ''}
  ${fiches.length ? `<section class="related"><h2 class="h3">${icon('link')}Liens utiles</h2><div class="minis">${fiches.map((s) => relCard(s, R)).join('')}</div></section>` : ''}
  ${(() => { const ms = e.cat === 'personnages' ? MISSIONS.missions.filter((m) => (m.donneur || '').split(', ').includes(e.nom)) : []; return ms.length ? `<section class="related"><h2 class="h3">${icon('flag')}Missions données par ${esc(e.nom.split(' ')[0])} (${ms.length})</h2><div class="minis">${ms.map((m) => `<a class="mini" href="${R}missions/${m.id}/" style="--c:#ff3d6e"><span class="mini-ico">${icon('flag')}</span><span><small>${m.chapitre === 'prologue' ? 'Prologue' : `Chapitre ${m.chapitre}`}</small><b>${esc(m.nom)}</b></span>${icon('arrow-right')}</a>`).join('')}</div></section>` : ''; })()}
  ${refs.bloc}
</article>`;
  emit(p, layout({ p, title: `${e.nom} dans GTA 6 : informations et guide`, desc: descSEO(`${e.nom} dans GTA 6 :`, e.bref, 'Ce qui est confirmé et ce qui reste incertain, avec les sources.'), body, cls: 'p-fiche', ogType: 'article', crumbs: [['Accueil', ''], ['Encyclopédie', 'encyclopedie/'], [c.nom, `encyclopedie/?cat=${e.cat}`], [e.nom, p]], schema: [{ '@context': 'https://schema.org', '@type': 'Article', headline: `${e.nom} dans GTA 6`, description: e.bref, inLanguage: 'fr', dateModified: site.majLe, about: { '@type': 'VideoGame', name: 'Grand Theft Auto VI' } }] }));
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
  <div class="doors doors--4" role="group" aria-label="Type" data-fav-filter>
    <button class="door" type="button" data-value="astuce" aria-pressed="false" style="--c:#ff2d87"><span class="door-ico">${icon('bolt')}</span><span>Astuces</span><small data-fc="astuce">0</small></button>
    <button class="door" type="button" data-value="vehicule" aria-pressed="false" style="--c:#ff9a1f"><span class="door-ico">${icon('car')}</span><span>Véhicules</span><small data-fc="vehicule">0</small></button>
    <button class="door" type="button" data-value="lieu" aria-pressed="false" style="--c:#19d3e3"><span class="door-ico">${icon('pin')}</span><span>Lieux</span><small data-fc="lieu">0</small></button>
    <button class="door" type="button" data-value="code" aria-pressed="false" style="--c:#9b6bff"><span class="door-ico">${icon('code')}</span><span>Codes</span><small data-fc="code">0</small></button>
    <button class="door" type="button" data-value="glitch" aria-pressed="false" style="--c:#19d3e3"><span class="door-ico">${icon('bolt')}</span><span>Glitchs</span><small data-fc="glitch">0</small></button>
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
    <div class="acc-card" style="--c:#ffd23f"><span class="tile-ico">${icon('flag')}</span><b>Missions terminées</b><div class="ring" data-ring-mis style="--p:0"><span data-acc-mis>0</span><small>/ ${MISSIONS.missions.length}</small></div><a class="link-btn" href="${R}missions/">Voir les missions</a></div>
    <div class="acc-card" style="--c:#ff2bd6"><span class="tile-ico">${icon('badge')}</span><b>Objets trouvés</b><div class="ring" data-ring-obj style="--p:0"><span data-acc-obj>0</span><small>/ ${COLL.reduce((n, t) => n + t.items.length, 0)}</small></div><a class="link-btn" href="${R}collection/">Voir les objets</a></div>
    <div class="acc-card acc-card--prefs" style="--c:#9b6bff"><span class="tile-ico">${icon('sliders')}</span><b>Mes préférences</b>
      <p class="sheet-l">Animations</p><div class="chips" data-pref="motion"><button class="chip" data-value="on" aria-pressed="false">Oui</button><button class="chip" data-value="off" aria-pressed="false">Réduites</button></div>
      <p class="sheet-l">Résumés des missions (spoilers)</p><div class="chips" data-pref="spoil"><button class="chip" data-value="" aria-pressed="false">Afficher</button><button class="chip" data-value="off" aria-pressed="false">Masquer</button></div>
      <p class="sheet-l">Taille du texte</p><div class="chips" data-pref="size"><button class="chip" data-value="" aria-pressed="false">Normale</button><button class="chip" data-value="l" aria-pressed="false">Grande</button></div>
    </div>
  </div>
  <section class="acc-sec" data-recents-box hidden><h2 class="h3">${icon('clock')}Consultés récemment</h2><ul class="acc-recents" data-recents></ul><button class="link-btn" type="button" data-recents-clear>Effacer cet historique</button></section>
  <section class="acc-sec"><h2 class="h3">${icon('shield')}Mes données</h2>
    <p class="muted small">Sans compte, tes favoris, ta progression et cet historique restent uniquement sur cet appareil. Tu peux les télécharger, les remettre sur un autre appareil avec « Importer un fichier », ou les effacer à tout moment.</p>
    <div class="actions"><button class="btn" type="button" data-export>${icon('download')}Télécharger mes données</button><label class="btn">${icon('plus')}Importer un fichier<input type="file" accept=".json,application/json" data-import hidden></label><button class="btn btn--ghost" type="button" data-wipe>${icon('x')}Effacer mes données</button></div>
  </section>
  <script type="application/json" data-acc-ids>${JSON.stringify({ mis: MISSIONS.missions.map((m) => m.id), obj: COLL.flatMap((t) => t.items.map((i) => i.f.properties.id)) })}</script>
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
      <button type="button" role="tab" data-adm-tab="glitchs" aria-selected="false">${icon('bolt')}Glitchs</button>
    </div>
    <div data-adm-vue="stats"></div>
    <div data-adm-vue="contenu" hidden></div>
    <div data-adm-vue="comptes" hidden></div>
    <div data-adm-vue="glitchs" hidden></div>
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
    ${['teste', 'confirme', 'a-verifier', 'provisoire', 'obsolete'].map((k) => `<div class="st st--${k === 'confirme' || k === 'teste' ? 'ok' : k === 'a-verifier' ? 'wait' : 'part'}">${badge(k)}<p>${esc(site.statuts[k].desc)}</p></div>`).join('')}
    <p class="muted small">Règle du site : une information ne passe « confirmée » que si elle est officielle, ou si au moins deux sources indépendantes concordent sans contradiction. Un site qui reprend d'autres guides (agrégateur) ou une source de faible qualité ne compte pas. « Testé en jeu » exige une preuve : date, plateforme et lien vers une capture ou une vidéo. Le contrôle automatique du site refuse une astuce, un code ou un emplacement de véhicule « confirmé » sans deux sources indépendantes, ou un code contradictoire noté « confirmé ». Une date « Dernière vérification » n'apparaît que lorsque l'information a réellement été revérifiée.</p>
  </section>
  <section id="sources" class="related"><h2 class="h3">${icon('book')}Nos sources</h2><p>Les annonces officielles de Rockstar Games d'abord. Ensuite, les guides de sites spécialisés, recoupés quand c'est possible. Chaque fiche liste ses sources.</p>
  <p>La carte interactive utilise la carte communautaire <a href="https://map.gtadb.org" target="_blank" rel="noopener">« Yanis v18 — GTA VI Community Map »</a> et le catalogue de lieux de GTADB et de ses contributeurs, sous licence <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Nous l'avons recolorée, retiré sa légende et redécoupée. C'est une reconstruction de fans, approximative, et non la carte officielle de Rockstar Games.</p>
  <p>Les objets à collectionner, armes au sol, véhicules remarquables, braquages, commerces et activités viennent d'<a href="https://github.com/fbritoferreira/gta6" target="_blank" rel="noopener">Open GTA 6 Map</a> (fbritoferreira et contributeurs), sous licence <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Nous avons sélectionné les emplacements utiles, converti leurs positions sur notre carte et traduit en français les types, les noms et les indications des joueurs.</p>
  <details class="sources"><summary>${icon('shield')}Toutes les sources (${allSrc.length})</summary><ul>${allSrc.map((s) => `<li><a href="${s.u}" rel="nofollow noopener" target="_blank">${esc(s.n)}</a></li>`).join('')}</ul></details></section>
  <section id="donnees" class="related"><h2 class="h3">${icon('user')}Données personnelles</h2>
    <p>Le site s'utilise sans compte : tes favoris et ta progression restent alors dans ton navigateur, rien n'est envoyé.</p>
    <p>Si tu crées un compte, on enregistre uniquement ton adresse e-mail, ton mot de passe (chiffré, illisible même pour nous), tes favoris et ta progression, pour te les rendre sur tous tes appareils. Ces données sont hébergées par <a href="https://supabase.com" target="_blank" rel="noopener">Supabase</a>, sur des serveurs situés en Irlande (Union européenne). Elles ne sont ni vendues, ni partagées, ni utilisées pour de la publicité.</p>
    <p>Tu peux supprimer ton compte à tout moment depuis <a href="${R}compte/">Mon espace</a> : toutes tes données en ligne sont alors effacées. ${site.editeur && site.editeur.nom ? `Tous les détails : <a href="${R}mentions-legales/#confidentialite">mentions légales et confidentialité</a>.` : ''}</p>
  </section>
  <section id="corrections" class="related"><h2 class="h3">${icon('refresh')}Corrections récentes</h2><ul class="corr">${CORR.corrections.map((x) => `<li><time datetime="${x.date}">${fmtDate(x.date)}</time> · <a href="${R}${x.page}">${esc(x.titre)}</a> : ${esc(x.texte)}</li>`).join('')}</ul></section>
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
    <p>Les comptes visiteurs sont hébergés par <b>Supabase</b>, sur des serveurs situés en Irlande, dans l'Union européenne (<a href="https://supabase.com/privacy" rel="noopener" target="_blank">politique de confidentialité de Supabase</a>). Le nom de domaine est enregistré auprès d'OVHcloud.</p>
  </section>
  <section class="related" id="confidentialite"><h2 class="h3">${icon('user')}Données personnelles</h2>
    <p><b>Responsable du traitement :</b> ${esc(E.nom)} — ${mail}.</p>
    <p><b>Sans compte</b>, le site n'enregistre rien sur toi : tes favoris, ta progression et tes préférences restent dans la mémoire de ton navigateur (stockage local), sur ton appareil. Le site n'utilise ni cookie, ni publicité, ni bouton de réseau social${MESURE ? '' : ", ni outil de mesure d'audience"}.</p>
    ${MESURE ? `<div id="mesure" class="mesure-box"><p><b>Mesure d'audience.</b> Pour savoir quelles pages sont utiles, on compte les visites avec <a href="https://www.goatcounter.com/help/privacy" rel="noopener" target="_blank">GoatCounter</a> (exploitant : Martin Tournoij, Irlande ; données sur des serveurs situés en Finlande et en Allemagne, dans l'Union européenne). <b>Aucun cookie</b> et rien n'est enregistré sur ton appareil. Sont transmis : la page vue, la page d'où tu viens, la taille de l'écran, le navigateur et le pays (déduit de l'adresse IP, qui n'est pas conservée). Sont aussi comptés, de façon anonyme, les recherches du site et de la carte qui ne donnent aucun résultat (le texte cherché, pour savoir quels guides manquent), les raccourcis « Recherches populaires » de la carte utilisés (pour les classer un jour selon les vrais usages) et les combinaisons de codes copiées. Si tu votes sur un glitch (« Ce glitch fonctionne-t-il encore ? »), ton vote est enregistré avec ton compte : ta réponse et ta console. Seuls des totaux sont affichés publiquement ; le détail n'est visible que par l'administrateur du site. On n'obtient que des statistiques globales et anonymes, utilisées uniquement par ${M}, jamais croisées avec d'autres données ni utilisées pour de la publicité. Elles sont conservées ${site.mesure.conservationMois} mois au maximum. Rien n'est compté si ton navigateur demande à ne pas être suivi (« Do Not Track » ou « Global Privacy Control »).</p>
      <p><b>Tu peux refuser à tout moment</b> : <button class="btn btn--ghost" type="button" data-mesure-refus aria-pressed="false">${icon('eye')}<span data-on="Tes visites ne sont plus comptées (annuler)" data-off="Ne pas compter mes visites">Ne pas compter mes visites</span></button></p></div>` : ''}
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

// ---------- page hors connexion (servie par le service worker) ----------
{
  const body = `<section class="wrap section center"><p class="kicker">${icon('alert')}Hors connexion</p><h1 class="h1">Pas de connexion Internet.</h1><p class="lead">Cette page n'a pas encore été enregistrée sur ton appareil. Les pages déjà ouvertes restent consultables, dans la version de ta dernière visite : elles peuvent ne pas être à jour.</p><div class="actions actions--center"><a class="btn btn--primary" href="./">${icon('home')}Accueil</a><button class="btn" type="button" onclick="location.reload()">Réessayer</button></div></section>`;
  let html = layout({ p: '', title: `Hors connexion | ${M}`, desc: 'Pas de connexion Internet.', body, noindex: true, cls: 'p-404' });
  const base = new URL(site.url).pathname.replace(/\/$/, '') + '/';
  html = html.replaceAll('href="./', `href="${base}`).replaceAll('src="./', `src="${base}`).replace('data-root="./"', `data-root="${base}"`);
  emit('hors-ligne.html', html);
}

// ---------- index de recherche ----------
const index = [];
const push = (o) => index.push(o);
for (const a of ASTUCES) { const c = cat('astuces', a.cat); push({ t: a.court, q: a.titre, k: norm([a.kw.join(' '), c.nom].join(' ')), d: extrait(a.reponse), ...(['confirme', 'teste'].includes(a.statut) ? { r: extrait(a.reponse, 260), rs: site.statuts[a.statut].nom || a.statut } : {}), u: `astuces/${a.slug}/`, i: a.icon, c: c.color, g: 'astuce', s: a.cat, l: c.nom, m: (astuceMap[a.slug] || []).length ? 1 : 0 }); }
for (const x of CATALOGUE.vehicules) { const c = cat('vehicules', x.type); push({ t: x.nom, q: x.classe, k: norm([x.nom, x.fabricant || '', x.classe, c.nom, x.inspiration || '', 'vehicule'].join(' ')), d: x.inspiration ? `Inspiré de ${x.inspiration}` : x.classe, u: `vehicules/${x.slug}/`, i: c.icon, c: c.color, g: 'vehicule', s: x.type, l: 'Véhicule · ' + x.classe, m: 0, f: '' }); }
for (const v of VEHICULES) { const c = cat('vehicules', v.type); const l = L[v.lieu]; push({ t: v.nom, q: v.sous, k: norm([v.kw.join(' '), c.nom, 'vehicule voiture', l ? l.nom : ''].join(' ')), d: extrait(v.emplacement), u: `vehicules/${v.slug}/`, i: c.icon, c: v.color || c.color, g: 'vehicule', s: v.type, l: 'Véhicule · ' + c.nom, m: vehOnMap(v.slug) ? 1 : 0, f: vehOnMap(v.slug) ? 'v-' + v.slug : '' }); }
for (const l of LIEUX) { const c = cat('lieux', l.type); const act = l.mapcat === 'activites'; push({ t: l.nom, q: '', k: norm([l.kw.join(' '), c.nom, act ? 'activite' : 'lieu', l.region && REG[l.region] ? REG[l.region].nom : ''].join(' ')), d: extrait(l.desc), u: `lieux/${l.id}/`, i: l.icon, c: c.color, g: act ? 'activite' : 'lieu', s: l.type, l: act ? 'Activité' : 'Lieu · ' + c.nom, m: onMap(l.id) ? 1 : 0, f: onMap(l.id) ? l.id : '' }); }
for (const e of ENC) { const c = cat('encyclopedie', e.cat); push({ t: e.nom, q: '', k: norm([c.nom, e.cat === 'personnages' ? 'personnage perso' : ''].join(' ')), d: extrait(e.bref), u: `encyclopedie/${e.slug}/`, i: e.icon, c: c.color, g: e.cat === 'personnages' ? 'personnage' : 'ency', s: e.cat, l: 'Encyclopédie · ' + c.nom, m: 0 }); }
for (const a of ACTUS) push({ t: a.titre, q: '', k: norm('actualite news info ' + a.theme), d: fmtDate(a.date), u: `actualites/${a.slug}/`, i: 'news', c: '#3ddc84', g: 'actu', s: a.theme, l: 'Actu', m: 0 });
const CCAT = Object.fromEntries(site.categories.carte.map((c) => [c.id, c]));
// ---------- carte : 10 catégories et leurs sous-catégories (configuration : site.json « categories.carte » et « carteOptions ») ----------
// Chaque repère garde ses données et sa provenance ; on calcule seulement où le ranger. Aucune position n'est ajoutée ni déplacée.
const CO = site.carteOptions;
const SECRETS_D = {}; // repère -> sections du dossier « secrets » qui le citent
for (const d of DOSSIERS.filter((x) => x.slug === 'secrets')) d.sections.forEach((s, i) => (s.items || []).forEach((it) => { if (it.carte) (SECRETS_D[it.carte] ||= []).push('secrets:' + i); }));
const COFFRES_CODE = new Set(DOSSIERS.filter((x) => x.slug === 'codes-coffres').flatMap((d) => d.sections.flatMap((s) => (s.items || []).filter((it) => it.carte && it.code).map((it) => it.carte))));
const MIS_FAC = Object.fromEntries(MISSIONS.missions.map((m) => [m.id, !!m.facultative]));
const vClasse = (slug) => { if (!slug) return ''; const v = VEHICULES.find((x) => x.slug === slug); if (v) return v.sous || ''; const c = CATALOGUE.vehicules.find((x) => x.slug === slug); return c ? c.classe || '' : ''; };
function carteCat(p) {
  if (p.label) return p.cat === 'lieux' ? 'services' : p.cat;
  if (SECRETS_D[p.id] && CO.secretsPrimaire.some((x) => p.id.startsWith(x))) return 'secrets';
  return CO.primaire[p.cat + ':' + (p.service || p.sous)] || CO.primaire[p.cat + ':*'] || p.cat;
}
function regleOk(r, p) {
  if (!r) return false;
  if (r.et && !regleOk(r.et, p)) return false; // condition supplémentaire obligatoire
  const sv = p.service || p.sous;
  if (r.s && r.s.includes(sv)) return true;
  if (r.ids && r.ids.includes(p.id)) return true;
  if (r.ru && p.ru) return true;
  if (r.uv && /^o-standout-vehicle-/.test(p.id) && !p.hv) return true; // version unique (livrée spéciale) affichée sur la carte
  if (r.vt && p.vt && r.vt.includes(p.vt)) return true;
  if (r.vm && p.vm && r.vm.includes(p.vm)) return true;
  if (r.vc && r.vc.includes(vClasse(p.vs))) return true;
  if (r.re && new RegExp(r.re, 'i').test(p.nom)) return true;
  if (r.dossier && (SECRETS_D[p.id] || []).some((x) => r.dossier.includes(x))) return true;
  if (r.code && COFFRES_CODE.has(p.id)) return true;
  if (r.mis && (p.missions || []).some((m) => (MIS_FAC[m.id] ? 'facultative' : 'principale') === r.mis)) return true;
  if (r.lieux && p.cat === 'lieux') return true;
  return false;
}
const subsDe = (c, p, seul) => { const L = c.sous.filter((s) => s.r && (!seul || s.r.dossier) && regleOk(s.r, p)); return L.filter((s) => !(s.r.sauf && L.some((x) => x.id === s.r.sauf))).map((s) => s.id); };
// propriétés de sortie : nouvelle catégorie (cat), sous-catégories (sc), autres catégories où le repère apparaît aussi (tg), rareté (rar)
function carteClasse(p) {
  const cat = carteCat(p), out = { cat };
  if (p.label) return out;
  const sc = subsDe(CCAT[cat], p, false); if (sc.length) out.sc = sc;
  const tg = site.categories.carte.filter((c) => c.id !== cat && subsDe(c, p, true).length);
  if (tg.length) { out.tg = tg.map((c) => c.id); out.sc = [...(out.sc || []), ...tg.flatMap((c) => subsDe(c, p, true).map((s) => c.id + ':' + s))]; }
  // « Version unique » : seulement les versions spéciales (livrées) ; un point d'apparition du modèle de série n'en est pas une
  const rar = sc.map((s) => CO.rares[cat + ':' + s]).find(Boolean) || (/^o-vehicle-spawn-/.test(p.id) ? '' : CO.rares['s:' + (p.service || '')]); if (rar) out.rar = rar;
  return out;
}
// catégories publiées : seules les sous-catégories qui ont au moins un repère (les autres restent prêtes dans la configuration)
function carteCats(feats) {
  const n = {}; for (const f of feats) { const p = f.properties; if (p.label) continue; for (const s of p.sc || []) { const k = s.includes(':') ? s : p.cat + ':' + s; n[k] = (n[k] || 0) + 1; } }
  return site.categories.carte.map(({ sous, ...c }) => ({ ...c, sous: sous.filter((s) => n[c.id + ':' + s.id]).map((s) => ({ id: s.id, nom: s.nom })) }));
}
{
  const types = {}; for (const f of features) if (f.properties.src === 'ogm') { const k = f.properties.cat + '|' + f.properties.service; (types[k] ||= { ...f.properties, n: 0 }).n++; }
  for (const t of Object.values(types).filter((x) => x.cat !== 'collection')) { const cl = carteClasse(t), c = CCAT[cl.cat]; const sc1 = (CCAT[cl.cat].sous.filter((s) => s.r && s.r.s && s.r.s.includes(t.service)).sort((a, b) => a.r.s.length - b.r.s.length)[0] || {}).id; t.cat = cl.cat; t.lienC = `carte/?cat=${cl.cat}${sc1 ? '&sc=' + sc1 : ''}`; push({ t: `${t.service} (${t.n})`, q: c.q, k: norm(`${t.service} ${c.nom} ${c.q} carte ou trouver emplacement tous`), d: `Tous les emplacements sur la carte · ${c.nom}`, u: t.lienC, i: t.icon, c: c.color, g: 'lieu', s: t.cat, l: `Carte · ${c.nom}`, m: 1 }); }
}
const dejaT = new Set(index.map((x) => norm(x.t)));
for (const f of features.filter((f) => /^[sm]-/.test(f.properties.id) && !dejaT.has(norm(f.properties.nom)))) { const p = f.properties, c = CCAT[carteCat(p)]; push({ t: p.nom, q: p.service, k: norm(`${p.service} ${c.nom} ${c.q} carte ou trouver ${p.desc}`), d: extrait(p.desc), u: `carte/?focus=${p.id}`, i: p.icon, c: c.color, g: 'lieu', s: p.cat, l: `${c.nom} · ${p.service}`, m: 1, f: p.id }); }
for (const T of COLL) push({ t: `${T.pluriel} (${T.items.length})`, q: 'collection', k: norm(`${T.pluriel} ${T.nom} objet a collectionner collection emplacement tous liste`), d: 'Tous les emplacements, par secteur', u: `collection/${T.slug}/`, i: T.icon, c: '#ff2bd6', g: 'astuce', s: '', l: 'Objets à collectionner', m: 0 });
push({ t: 'Objets à collectionner', q: 'collection', k: 'objets a collectionner collection collectibles tous emplacements cartes paquets caches', d: 'Toutes les listes par type', u: 'collection/', i: 'badge', c: '#ff2bd6', g: 'astuce', s: '', l: 'Toutes les listes', m: 0 });
push({ t: 'Missions et solutions', q: 'missions', k: 'missions mission solution soluce chapitre histoire bloque que faire objectif', d: `Toutes les missions, étape par étape`, u: 'missions/', i: 'flag', c: '#ff3d6e', g: 'page', s: '', l: 'Page', m: 0 });
for (const m of MISSIONS.missions) push({ t: `Mission : ${m.nom}`, q: '', k: norm(['mission solution soluce', m.nom, m.nomEn, m.donneur, m.resume].join(' ')), d: extrait(m.resume), u: `missions/${m.id}/`, i: 'flag', c: '#ff3d6e', g: 'astuce', s: '', l: m.chapitre === 'prologue' ? 'Mission · Prologue' : `Mission · Chapitre ${m.chapitre}`, m: 0 });
push({ t: 'Glitchs GTA 6', q: 'glitch', k: 'glitch glitchs bug bugs exploit astuce argent infini meilleurs glitch qui fonctionne encore apres mise a jour', d: `${GLITCHS.length} glitchs documentés, avec leur état de fonctionnement`, u: 'glitchs/', i: 'bolt', c: '#19d3e3', g: 'page', s: '', l: 'Page', m: 0 });
for (const g of GLITCHS) push({ t: `Glitch : ${g.titre}`, q: '', k: norm(['glitch bug exploit', g.titre, g.court, g.resume, GCATS[g.cat].n, g.cat === 'argent' ? 'argent infini facile rapide money' : '', g.cat === 'gameplay' ? 'fps premiere personne camera vue' : ''].join(' ')), d: g.resume.split('. ')[0], u: `glitchs/${g.slug}/`, i: GCATS[g.cat].ic, c: GCATS[g.cat].c, g: 'astuce', s: '', l: `Glitch · ${GSTATUTS[gStatut(g).id].n}`, m: 0 });
push({ t: 'Codes de triche', q: 'cheat', k: 'codes triche cheat cheats astuce code argent munitions tank', d: `${CODES.codes.length} codes relevés et comment les débloquer`, u: 'codes/', i: 'code', c: '#9b6bff', g: 'page', s: '', l: 'Page', m: 0 });
for (const d of DOSSIERS) push({ t: d.titre, q: d.court, k: norm([d.titre, d.court, d.seo, d.desc, d.reponse, ...d.sections.map((x) => x.titre)].join(' ')), d: extrait(d.reponse), u: `dossiers/${d.slug}/`, i: d.icon, c: d.couleur, g: 'page', s: '', l: 'Dossier', m: 0 });
for (const c of CODES.codes) push({ t: `Code : ${c.nom}`, q: '', k: norm(['code triche cheat', c.nom, c.nomEn, c.effet].join(' ')), d: c.effet, ...(c.confirme && c.sources.length >= 2 ? { r: `${c.effet} Combinaison : ${c.sequence.map((x) => ({ haut: 'Haut', bas: 'Bas', gauche: 'Gauche', droite: 'Droite' }[x] || x)).join(', ')}.`, rs: 'Confirmé' } : {}), u: `codes/#${c.id}`, i: 'code', c: '#9b6bff', g: 'astuce', s: '', l: 'Code', m: 0 });
for (const g of VGROUPES) { const c = cat('vehicules', g.type) || {}; push({ t: `${g.nom} (${g.n})`, q: 'liste', k: norm(`${g.nom} ${UN[g.nom] || ''} ${c.nom || ''} vehicules liste tous`), d: `Tous les véhicules de cette catégorie, avec leur emplacement quand il est connu`, u: `vehicules/#cat-${g.id}`, i: c.icon || 'car', c: c.color || '#ff9a1f', g: 'vehicule', s: g.type, l: 'Liste de véhicules', m: 0 }); }
push({ t: 'Carte interactive', q: 'map', k: 'carte map plan leonida', d: 'Tous les repères', u: 'carte/', i: 'map', c: '#19d3e3', g: 'page', s: '', l: 'Page', m: 0 });
push({ t: 'Mes favoris', q: '', k: 'favoris coeur enregistre', d: '', u: 'favoris/', i: 'heart', c: '#ff2d87', g: 'page', s: '', l: 'Page', m: 0 });

const syn = Object.entries(site.synonymes).map(([k, vs]) => [norm(k), ...vs.map(norm)]);
const popular = ['semer-la-police', 'argent-debut', 'sauvegarder', 'voyage-rapide', 'entrer-un-code', 'voiture-rare'].map((s) => ({ t: A[s].court, u: `astuces/${s}/`, i: A[s].icon, c: cat('astuces', A[s].cat).color }));

// ---------- écriture ----------
fs.rmSync(OUT, { recursive: true, force: true });
// CSS allégé : commentaires et espaces inutiles retirés (aucune chaîne « content » du site ne contient ces caractères ; vérifié)
const miniCSS = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}');
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
// réponse « pas encore confirmé » : affichée en tête de recherche, en orange, jamais comme une réponse vérifiée
for (const [u, r] of Object.entries(site.reponsesNonConfirmees || {})) {
  const x = index.find((y) => y.u === u);
  if (!x) throw new Error(`réponse non confirmée : ${u} n'est pas dans l'index de recherche`);
  Object.assign(x, { r, rs: 'Pas encore confirmé', rw: 1 });
}
// réponses directes : une recherche courante mène d'abord à la bonne page (seulement des pages qui existent)
const pins = (site.reponsesDirectes || []).map(([q, u]) => {
  if (!index.some((x) => x.u === u)) throw new Error(`réponse directe « ${q} » : ${u} n'est pas dans l'index de recherche`);
  return [norm(q), u];
});
const NB = { vehicules: VEHICULES.length + CATALOGUE.vehicules.length, missions: MISSIONS.missions.length, carte: features.length, codes: CODES.codes.length, collection: COLL.reduce((n, t) => n + t.items.length, 0), astuces: ASTUCES.length, lieux: LIEUX.length };
const DNB = { vehicules: (n) => `${n} véhicules, avec l'emplacement quand il est connu`, missions: (n) => `${n} missions, la solution étape par étape`, carte: (n) => `${n} repères : lieux, véhicules, objets`, codes: (n) => `${n} codes, avec la combinaison et le déblocage`, collection: (n) => `${n} emplacements, par type et par secteur`, astuces: (n) => `${n} réponses courtes aux questions des joueurs`, lieux: (n) => `${n} lieux de Leonida` };
const existe = (u) => pages.some(({ p }) => p === u.split(/[?#]/)[0]);
const cats = (site.rechercheCategories || []).map((x) => {
  for (const u of [x.u, ...x.actions.map((a) => a[1])]) if (!existe(u)) throw new Error(`raccourci de recherche : ${u} n'existe pas`);
  return { m: x.mots.map(norm), t: x.t, u: x.u, i: x.i, c: x.c, d: DNB[x.n] ? DNB[x.n](NB[x.n]) : '', a: x.actions };
});
write('data/index.json', JSON.stringify({ items: index, syn, popular, pins, cats }));
// Points véhicules : type du véhicule (d'après la fiche liée) séparé du mode d'obtention (d'après le type de repère de la source).
// Aucune position n'est ajoutée ni déplacée ; un point sans fiche liée garde « type non précisé ».
{
  const lie = {}; for (const [slug, ids] of Object.entries(CAT_CARTE)) for (const id of ids) lie[id] ||= slug;
  const MODE = (f) => {
    const id = f.properties.id;
    if (id.startsWith('v-')) return 'Repère du guide';
    if (id.startsWith('w-')) return 'Position relevée (GTA Wiki)';
    return { 'Véhicule remarquable': 'Garé à cet endroit', 'Véhicule qui apparaît ici': 'Apparaît à cet endroit', 'Véhicule à commander': 'Demande de Moses ou Randy', 'Location de véhicules': 'À louer', Concessionnaire: 'Concessionnaire' }[f.properties.service] || 'Autre repère';
  };
  for (const f of features) {
    if (f.properties.cat !== 'vehicules' || f.properties.label) continue;
    const id = f.properties.id, slug = id.startsWith('v-') ? id.slice(2) : lie[id];
    const v = slug && (VEHICULES.find((x) => x.slug === slug) || CATALOGUE.vehicules.find((x) => x.slug === slug));
    f.properties.vm = MODE(f);
    f.properties.vt = v ? v.type : '';
    if (v) { f.properties.vs = slug; f.properties.vn = v.nom; if (!f.properties.url) f.properties.url = `vehicules/${slug}/`; }
    // courte indication pour l'obtenir : seulement les fiches du guide dont l'emplacement est « Confirmé » ou « Testé en jeu »
    if (id.startsWith('v-') && v && ['confirme', 'teste'].includes(v.dispo) && v.obtenir && v.obtenir.length) f.properties.ob = v.obtenir.slice(0, 2).join(' ');
  }
  noterVehicules(lie);
}
// ---------- Véhicules de la carte : intérêt (note sur 100) et fiabilité de l'emplacement ----------
// Seules des données connues sont utilisées : type de repère de la source, catégorie du modèle (catalogue), version unique.
// Les performances chiffrées et la personnalisation de GTA 6 ne sont pas publiées : la catégorie sert d'indicateur (signalé « estimé »),
// la personnalisation reçoit une valeur neutre (signalée « inconnue »).
// Par défaut, la carte n'affiche que les véhicules notés 60 ou plus, et jamais un emplacement non vérifié.
function noterVehicules(lie) {
  const VERIF_DATE = '26 novembre 2026';
  // captures prises en jeu sur place (Open GTA 6 Map), regardées une par une : le véhicule et le lieu sont visibles
  const CAPTURE_SUR_PLACE = new Set(['o-vehicle-spawn-001', 'o-vehicle-spawn-002', 'o-vehicle-spawn-003', 'o-vehicle-spawn-007', 'o-vehicle-spawn-008', 'o-vehicle-spawn-009', 'o-vehicle-spawn-010']);
  // performances (20) d'après la catégorie du modèle ; « désirable » : catégories recherchées par les joueurs
  const PERF = { supercars: 20, sportives: 17, 'sportives-classiques': 16, muscle: 14, coupes: 12, motos: 13, velos: 2, bateaux: 11, helicopteres: 15, avions: 15, militaires: 20, 'tout-terrain': 10, suv: 6, berlines: 5, urgences: 7, vans: 3, utilitaires: 3, industriels: 4, service: 3 };
  const DESIRABLE = new Set(['supercars', 'sportives', 'sportives-classiques', 'muscle', 'coupes', 'motos', 'bateaux', 'helicopteres', 'avions', 'militaires', 'tout-terrain']);
  const ICONES = /infernus|cheetah|banshee|comet|elegy|stallion|dominator|sabre|tempesta|zorrusso|emerus|sanchez|buzzard|annihilator|dodo|squalo|jet|faggio|hermes|stanier/i;
  const GRP_FICHE = { 'jets-militaires': 'militaires', 'helicoptere-toits': 'helicopteres', 'mammoth-dodo': 'avions', 'lapwing-stolen-valor': 'avions', 'mallard-flammes': 'avions' };
  const groupeDe = (slug) => { if (!slug) return null; if (GRP_FICHE[slug]) return GRP_FICHE[slug]; const x = CATALOGUE.vehicules.find((y) => y.slug === slug); if (x) return x.groupe; const fi = CATALOGUE.fiches[slug]; if (fi && fi.groupe) return fi.groupe; const v = VEHICULES.find((y) => y.slug === slug); return v ? ({ avions: 'avions', bateaux: 'bateaux', motos: 'motos' }[v.type] || null) : null; };
  // sélection de l'éditeur (étoiles) et captures prises en jeu sur place publiées par GTABase
  const SEL = fs.existsSync(path.join(ROOT, 'data', 'carte-selection.json')) ? read('carte-selection.json').vehicules : [];
  const GBV = fs.existsSync(path.join(ROOT, 'data', 'carte-gtabase.json')) ? read('carte-gtabase.json') : { reperes: {} };
  const etoiles = (p) => {
    const t = `${p.vo || ''} ${p.nom} ${p.vn || ''}`.toLowerCase();
    const parSlug = p.vs && SEL.find((x) => x.s.includes(p.vs));
    if (parSlug) return parSlug;
    return SEL.find((x) => x.m && new RegExp(x.m, 'i').test(t)) || null;
  };
  const vfeat = features.filter((f) => f.properties.cat === 'vehicules' && !f.properties.label);
  const proche = (f, pred, r) => vfeat.some((g) => g !== f && pred(g) && Math.hypot(g.geometry.coordinates[0] - f.geometry.coordinates[0], g.geometry.coordinates[1] - f.geometry.coordinates[1]) < r);
  for (const f of vfeat) {
    const p = f.properties, id = p.id, slug = p.vs || null, grp = groupeDe(slug);
    const kind = /^o-standout-vehicle-/.test(id) ? 'unique' : /^o-vehicle-spawn-/.test(id) || id.startsWith('w-') ? 'spawn' : /^o-vehicle-request-/.test(id) ? 'demande' : /^o-vehicle-rental-/.test(id) ? 'location' : id.startsWith('v-') ? 'guide' : 'autre';
    const des = grp ? DESIRABLE.has(grp) : null, perf = grp ? PERF[grp] ?? 8 : 8;
    const B = { unique: [22, 20, 10, 12, 5, 3], spawn: [14, 22, 12, 10, 4, 4], demande: [12, 22, 12, 8, 4, 5], location: [2, 8, 6, 2, 2, 2], guide: [20, 20, 12, 12, 6, 3], autre: [8, 12, 8, 6, 4, 2] }[kind];
    // rareté, intérêt (désirable / ordinaire), unicité (désirable / ordinaire), stratégie
    const sel = etoiles(p), e = sel ? sel.e : 0;
    const rar = B[0], inter = e ? [0, 8, 20, 25][e] : des === false ? B[2] : B[1], uniq = Math.min(15, (des === false ? B[4] : B[3]) + (ICONES.test(p.nom + ' ' + (p.vn || '')) ? 3 : 0)), strat = B[5], perso = 5;
    const note = Math.min(100, rar + inter + perf + uniq + perso + strat);
    const classe = note >= 90 ? 'Exceptionnel' : note >= 75 ? 'Très intéressant' : note >= 60 ? 'Intéressant' : note >= 40 ? 'Secondaire' : 'Ordinaire';
    // fiabilité de l'emplacement
    let fi;
    if (kind === 'guide') fi = ['confirme', 'teste'].includes(p.statut) && p.precision === 'exacte' ? 'confirme' : p.precision !== 'exacte' ? 'approx' : 'probable';
    else {
      const concorde = slug && proche(f, (g) => (g.properties.vs === slug) && !/^o-/.test(g.properties.id), 400);
      fi = CAPTURE_SUR_PLACE.has(id) || concorde ? 'probable' : 'nonverif';
    }
    // capture prise en jeu sur place (GTABase) : le véhicule et le lieu sont visibles → fortement probable
    const gb = id.startsWith('o-') ? GBV.reperes[id.slice(2)] : null;
    if (gb && gb.cap) { fi = fi === 'approx' ? fi : 'probable'; p.ext = `${GBV.url}#${id.slice(2)}`; p.ph = 1; p.cap = 1; }
    if (gb && gb.d && (!p.desc || p.en)) { p.desc = gb.d; delete p.en; }
    // secteurs de GTABase traduits mot à mot (« Clé Lento ») : noms officiels des lieux
    const ZFR = { 'Baie Watson': 'Watson Bay', 'Clé Lento': 'Key Lento', 'Clé de Gloriana': 'Gloriana Key', Corsaire: 'Corsair', 'Sables mouvants': 'Quicksands', Ambroisie: 'Ambrosia' };
    if (gb && gb.z && !p.zone) p.zone = ZFR[gb.z] || gb.z;
    const NAT = { unique: 'Version unique garée à cet endroit (selon les joueurs)', spawn: 'Point d’apparition signalé par les joueurs', demande: 'Véhicule lié à une demande (mission rémunérée)', location: 'Location de véhicules', guide: 'Emplacement décrit par nos sources', autre: 'Repère communautaire' }[kind];
    // photo : celle de la fiche du modèle pour un point d'apparition ou une demande (même modèle) ;
    // une version unique (livrée spéciale) n'en reçoit une que si la photo montre cette version
    const MEME_VERSION = { 'o-standout-vehicle-086': 'maibatsu-penumbra-ff' };
    const ph = MEME_VERSION[id] || (['spawn', 'demande', 'location', 'unique'].includes(kind) && slug);
    if (!p.img && ph) {
      const x = CATALOGUE.vehicules.find((y) => y.slug === ph);
      if (PHOTOS[ph]) { p.img = `photos/${PHOTOS[ph].fichier}`; if (PHOTOS[ph].credit) p.imgCredit = PHOTOS[ph].credit; }
      else if (x && x.img) { p.img = `catalogue/${x.img}`; if (x.credit) p.imgCredit = x.credit; }
      if (p.img) { p.imgT = MEME_VERSION[id] ? 'exacte' : 'modele'; if (!MEME_VERSION[id]) p.imgNote = kind === 'unique' ? 'Modèle standard : pas cette livrée spéciale' : 'Photo du modèle standard'; }
    }
    if (kind !== 'guide') p.precision = 'exacte'; // repère posé au point précis par la source (pas une zone)
    p.nt = note; p.ntc = classe; p.fi = fi; p.dv = VERIF_DATE;
    p.nat = fi === 'nonverif' ? 'Information communautaire non confirmée' : p.cap ? (kind === 'unique' ? 'Version unique stationnée ici : capture prise en jeu sur place' : 'Point d’apparition : capture prise en jeu sur place') : NAT;
    if (e) { p.et = e; if (sel.nom !== p.vn) p.selNom = sel.nom; }
    p.ntx = [`Rareté ${rar}/25`, `Intérêt ${inter}/25`, `Performances ${perf}/20${grp ? ' (estimées d’après la catégorie)' : ' (inconnues)'}`, `Unicité ${uniq}/15`, `Personnalisation ${perso}/10 (inconnue)`, `Intérêt stratégique ${strat}/5`].join(' · ');
    // masqué par défaut : emplacement non vérifié, ou véhicule noté sous 60 (exception : les demandes, missions rémunérées)
    // affichés par défaut : emplacement prouvé (capture sur place, deux sources) ou zone d'une fiche du guide,
    // pour un véhicule de la sélection noté 2 ou 3 étoiles, ou une version unique (livrée spéciale) prouvée ; le reste reste dans les données
    const prouve = fi === 'probable' || fi === 'confirme';
    const ordinaire = ['vans', 'utilitaires', 'velos', 'service', 'industriels', 'berlines'].includes(grp) || /scorcher|bmx|\bbike\b|v[ée]lo/i.test(`${p.vo || ''} ${p.nom}`);
    const garde = (prouve && (e >= 2 || (!sel && kind === 'unique' && p.cap && !ordinaire))) || (fi === 'approx' && e >= 2);
    if (!garde) p.hv = 1;
    // « Véhicules rares et uniques » : versions uniques prouvées, et véhicules 3 étoiles à l'emplacement prouvé
    if (!p.hv && prouve && ((kind === 'unique' && p.cap) || e === 3)) { p.ru = 1; p.icon = 'diamond'; }
  }
  // doublon : la zone approximative d'une fiche du guide est masquée quand un repère précis et fortement probable du même véhicule est à moins de 400 m
  for (const f of vfeat) { const p = f.properties; if (p.fi === 'approx' && p.vs && proche(f, (g) => g.properties.vs === p.vs && g.properties.fi === 'probable' && !((DOUBLONS.distincts || {})[p.id] || {})[g.properties.id], 400)) { p.hv = 1; p.dbl = 1; } }
}
const ATTRIBUTION = { carte: TUILES.source, lieux: { nom: 'GTA VI Landmarks Data', diffuseur: 'GTADB', url: 'https://map.gtadb.org', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', modifications: 'Filtrage des lieux nommés et positionnés, champs raccourcis.' } };
// intitulés génériques encore en anglais : traduits à l'affichage (les données d'origine ne changent pas ; l'original reste cherchable)
const TRAD_C = (CO.traductions || []);
const traduit = (t) => TRAD_C.reduce((a, [en, fr]) => a.split(en).join(fr), t || '');
// repères utilisés par un glitch publié : lien vers le tutoriel (et numéro de l'étape)
const GL_LIEUX = {}; for (const g of GLITCHS) for (const e of g.emplacements || []) (GL_LIEUX[e.carte] ||= []).push({ s: g.slug, t: g.court || g.titre, n: e.n || 0 });
const PHOTOS_LIEUX = fs.existsSync(path.join(ROOT, 'data', 'photos-lieux.json')) ? read('photos-lieux.json').lieux : {};
// vérifications faites en jeu par l'équipe (data/verifications-en-jeu.json) : le repère devient « Confirmé », avec la date
const VJ = fs.existsSync(path.join(ROOT, 'data', 'verifications-en-jeu.json')) ? read('verifications-en-jeu.json').reperes : {};
for (const id of Object.keys(VJ)) if (!mapIndex[id] && !features.some((f) => f.properties.id === id)) throw new Error(`verifications-en-jeu.json : repère inconnu « ${id} »`);
const featsCarte = features.map((f) => { const p = { ...f.properties, ...carteClasse(f.properties) };
  const db = DOUBLONS.doublons[p.id]; if (db) { p.dbl = 1; p.hv = 1; p.dblDe = db.garde; }
  if (DOUBLONS.noms[p.id] && DOUBLONS.noms[p.id] !== p.nom) { p.vo = p.vo || p.nom; p.nom = DOUBLONS.noms[p.id]; }
  const vj = VJ[p.id]; if (vj) { p.statut = 'teste'; if (p.fi) p.fi = 'confirme'; p.dv = vj.date; p.vj = vj.note || ''; delete p.hv; }
  const pl = PHOTOS_LIEUX[p.id]; if (pl && !p.img) { p.img = `photos-lieux/${pl.fichier}`; p.imgNote = `${pl.legende} · photo officielle du lieu`; p.imgCredit = pl.credit; p.imgT = 'lieu'; } if (GL_LIEUX[p.id]) p.gl = GL_LIEUX[p.id]; const n = traduit(p.nom); if (n !== p.nom) { p.vo = p.nom; p.nom = n; } if (p.desc) p.desc = traduit(p.desc); return { ...f, properties: p }; });
// fiches véhicules à la nouvelle présentation : après la fiabilité des repères et les traductions
{ const n0 = pages.length; for (const f of V2_A_FAIRE) f(); for (const { p, html } of pages.slice(n0)) write(p + 'index.html', html); }
write('data/carte.json', JSON.stringify({
  type: 'FeatureCollection', version: 2, info: CARTE.info, attribution: ATTRIBUTION,
  tuiles: { tileSize: TUILES.tileSize, monde: TUILES.monde, zero: TUILES.zero, fond: TUILES.fond, niveaux: TUILES.niveaux },
  bornes: CARTE.bornes, vueInitiale: CARTE.vueInitiale,
  regions: CARTE.regions.map((r) => ({ ...r, label: POS[r.id] })),
  categories: carteCats(featsCarte), options: { rapides: CO.rapides, explorer: CO.explorer || [], alias: CO.alias, populaires: CO.populaires, synonymes: CO.synonymes, intentions: CO.intentions || [], statuts: STATUTS_CARTE },
  sousTypes: { vehicules: site.categories.vehicules.map(({ id, nom }) => ({ id, nom })), lieux: site.categories.lieux.map(({ id, nom }) => ({ id, nom })), activites: LIEUX.filter((l) => l.mapcat === 'activites' && onMap(l.id)).map((l) => ({ id: l.id, nom: l.nom })) },
  features: featsCarte
}));
// accueil : la mini-carte n'a besoin que des repères du guide (fichier léger)
write('data/carte-accueil.json', JSON.stringify({
  type: 'FeatureCollection', version: 2, info: CARTE.info, attribution: ATTRIBUTION,
  tuiles: { tileSize: TUILES.tileSize, monde: TUILES.monde, zero: TUILES.zero, fond: TUILES.fond, niveaux: TUILES.niveaux },
  bornes: CARTE.bornes, vueInitiale: CARTE.vueInitiale,
  regions: CARTE.regions.map((r) => ({ ...r, label: POS[r.id] })),
  categories: carteCats(featsCarte.filter((f) => f.properties.src !== 'ogm')),
  features: featsCarte.filter((f) => f.properties.src !== 'ogm')
}));
write('data/communaute.json', JSON.stringify({ version: 1, attribution: ATTRIBUTION.lieux, champs: { i: 'identifiant GTADB', n: 'nom', z: 'quartier / zone', x: 'x monde', y: 'y monde', c: 'catégorie', d: '1 = douteux' }, categories: COMMU_CATS.map(({ id, nom }) => ({ id, nom })), lieux: communaute }));
for (const f of fs.readdirSync(path.join(ROOT, 'src'), { recursive: true })) {
  const full = path.join(ROOT, 'src', f);
  if (!fs.statSync(full).isFile()) continue;
  if (!VUE_3D && (f === 'vehicule3d.js' || f === 'v3d-init.js' || f.startsWith('rendus' + path.sep) || f.startsWith('modeles' + path.sep))) continue;
  write(f.startsWith('tiles' + path.sep) || f.startsWith('vignettes' + path.sep) || f.startsWith('photos' + path.sep) || f.startsWith('rendus' + path.sep) || f.startsWith('modeles' + path.sep) || f.startsWith('catalogue' + path.sep) || f.startsWith('catalogue-mini' + path.sep) || f.startsWith('catalogue-hd' + path.sep) || f.startsWith('photos-hd' + path.sep) || f.startsWith('photos-lieux' + path.sep) ? f : path.join('assets', path.basename(f)), f.endsWith('.css') ? miniCSS(fs.readFileSync(full, 'utf8')) : fs.readFileSync(full));
}
// icônes pour le JS client : injectées en tête de app.js
const appJs = path.join(OUT, 'assets', 'app.js');
fs.writeFileSync(appJs, `window.LG_CONTACT=${JSON.stringify(site.editeur.email || '')};\nwindow.LG_ICONS=${JSON.stringify(Object.fromEntries(Object.entries(iconDefs).map(([n, d]) => [n, d[1]])))};\n` + fs.readFileSync(appJs, 'utf8'));

// comptes visiteurs : configuration publique de Supabase injectée en tête de compte.js
const compteJs = path.join(OUT, 'assets', 'compte.js');
fs.writeFileSync(compteJs, `window.LG_SB=${JSON.stringify(site.comptes || {})};\n` + fs.readFileSync(compteJs, 'utf8'));

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset=".55" stop-color="#ff2d87"/><stop offset="1" stop-color="#8a3ffc"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#140a22"/><circle cx="32" cy="30" r="18" fill="url(#g)"/><path d="M14 36h36M16 41h32M20 46h24" stroke="#140a22" stroke-width="3"/></svg>`;
write('favicon.svg', favicon);
const BASEP = new URL(site.url).pathname.replace(/\/$/, '') + '/';
write('manifest.webmanifest', JSON.stringify({
  id: BASEP, name: M, short_name: 'GTA 6 Facile', lang: 'fr', dir: 'ltr',
  description: 'Guide GTA 6 en français : missions, codes de triche, véhicules, objets à collectionner et carte interactive.',
  start_url: BASEP, scope: BASEP, display: 'standalone', background_color: '#140a22', theme_color: '#140a22',
  icons: [
    { src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }
  ],
  shortcuts: [
    { name: 'Carte interactive', url: BASEP + 'carte/' },
    { name: 'Codes de triche', url: BASEP + 'codes/' },
    { name: 'Missions', url: BASEP + 'missions/' }
  ]
}));
// service worker : une version par publication (les anciens caches sont supprimés), réseau d'abord pour les pages et les données,
// jamais de cache pour l'administration, les comptes ni les services extérieurs (Supabase, GoatCounter)
const SW_VERSION = (process.env.GITHUB_SHA || '').slice(0, 10) || new Date().toISOString().replace(/\D/g, '').slice(0, 14);
write('sw.js', `/* GTA 6 Facile, service worker (version ${SW_VERSION}) */
'use strict';
const V = '${SW_VERSION}', BASE = '${BASEP}';
const PAGES = 'lg-pages-' + V, FICHIERS = 'lg-fichiers-' + V, IMAGES = 'lg-images-' + V;
const ESSENTIELS = [BASE, BASE + 'hors-ligne.html', BASE + 'assets/app.css', BASE + 'assets/app.js', BASE + 'favicon.svg', BASE + 'assets/icon-192.png'];
const JAMAIS = /\\/(admin|compte)\\/|publication\\.json|admin-donnees\\.json|sw\\.js$/;
self.addEventListener('install', (e) => { e.waitUntil(caches.open(PAGES).then((c) => c.addAll(ESSENTIELS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n.startsWith('lg-') && !n.endsWith('-' + V)).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
async function limiter(nom, max) { const c = await caches.open(nom); const k = await c.keys(); for (let i = 0; i < k.length - max; i++) await c.delete(k[i]); }
// toujours demander au serveur si la page a changé (pas de vieille page gardée par le navigateur après une publication) ;
// une page inchangée coûte une simple réponse « 304 », et hors connexion la dernière version reste affichée
async function frais(req) {
  if (req.mode === 'navigate') {
    if (!/(\\/|\\.html)$/.test(new URL(req.url).pathname)) return fetch(req);
    const r = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
    return r.redirected ? fetch(req) : r;
  }
  return fetch(req, { cache: 'no-cache' });
}
async function reseauDabord(req, nom) {
  try {
    const r = await frais(req);
    if (r.ok && r.type === 'basic') { const c = await caches.open(nom); c.put(req, r.clone()); }
    return r;
  } catch (err) {
    const m = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (m) return m;
    if (req.mode === 'navigate') return caches.match(BASE + 'hors-ligne.html');
    throw err;
  }
}
async function cacheDabord(req) {
  const m = await caches.match(req); if (m) return m;
  const r = await fetch(req);
  if (r.ok && r.type === 'basic') { const c = await caches.open(IMAGES); await c.put(req, r.clone()); limiter(IMAGES, 400); }
  return r;
}
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(BASE) || JAMAIS.test(u.pathname)) return;
  if (/\\.(webp|png|jpe?g|svg|gif|avif|woff2?|glb)$/.test(u.pathname)) e.respondWith(cacheDabord(req));
  else e.respondWith(reseauDabord(req, req.mode === 'navigate' ? PAGES : FICHIERS));
});
`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
const indexable = pages.filter(({ p, html }) => !p.endsWith('.html') && !html.includes('noindex'));
// lastmod : date à laquelle le contenu principal de la page a réellement changé (empreinte du <main>, gardée dans data/lastmod.json)
const LM_F = path.join(ROOT, 'data', 'lastmod.json');
const LM = fs.existsSync(LM_F) ? JSON.parse(fs.readFileSync(LM_F, 'utf8')) : {};
const today = new Date().toISOString().slice(0, 10);
const empreinte = (html) => crypto.createHash('sha1').update(((html.match(/<main[\s\S]*<\/main>/) || [html])[0]).replace(/\s+/g, ' ')).digest('hex').slice(0, 16);
const LM2 = {};
for (const { p, html } of indexable) {
  const h = empreinte(html), old = LM[p];
  const actu = p.startsWith('actualites/') && N[p.split('/')[1]] && N[p.split('/')[1]].date;
  const verifie = p.startsWith('astuces/') && A[p.split('/')[1]] && A[p.split('/')[1]].verifie; // première fois : la date connue (actualité, vérification), sinon la dernière mise à jour du site
  // contenu changé : date du jour en local ; sur GitHub (modification faite dans l'administration), date de cette modification (site.majLe), stable d'une publication à l'autre
  LM2[p] = { h, d: old && old.h === h ? old.d : old ? (process.env.CI ? site.majLe : today) : (actu || verifie || site.majLe) };
}
if (!process.env.CI) fs.writeFileSync(LM_F, JSON.stringify(LM2, null, 0).replace(/},"/g, '},\n"') + '\n');
const imgDe = (p) => { const s = p.match(/^vehicules\/([^/]+)\/$/); if (!s) return ''; const x = CATALOGUE.vehicules.find((y) => y.slug === s[1]); const f = x && x.img ? `catalogue/${x.img}` : PHOTOS[s[1]] ? `photos/${PHOTOS[s[1]].fichier}` : ''; return f ? `<image:image><image:loc>${site.url}/${f}</image:loc></image:image>` : ''; };
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${indexable.map(({ p }) => `<url><loc>${site.url}/${p}</loc><lastmod>${LM2[p].d}</lastmod>${imgDe(p)}</url>`).join('\n')}\n</urlset>\n`);
write('.nojekyll', '');
write('llms.txt', `# ${M}

> Guide francophone indépendant de GTA 6 (Grand Theft Auto VI, PS5 et Xbox Series) : solutions des missions, codes de triche, véhicules et où les trouver, objets à collectionner, lieux de Leonida et carte interactive. Chaque information indique ses sources et un statut de fiabilité (Testé en jeu, Confirmé, À vérifier, Provisoire, Obsolète). Site non affilié à Rockstar Games ni à Take-Two Interactive.

## Rubriques principales
- [Codes de triche](${site.url}/codes/) : combinaisons à la croix directionnelle, effet, déblocage, sources
- [Missions et solutions](${site.url}/missions/) : ${MISSIONS.missions.length} missions, une page par mission avec la solution étape par étape
- [Véhicules](${site.url}/vehicules/) : ${VEHICULES.length + CATALOGUE.vehicules.length} véhicules, avec l'emplacement quand il est connu
- [Objets à collectionner](${site.url}/collection/) : listes par type et par secteur
- [Lieux](${site.url}/lieux/) : régions, quartiers et bâtiments de Leonida
- [Astuces](${site.url}/astuces/) : réponses courtes aux questions des joueurs
- [Dossier 100 %](${site.url}/dossiers/100-pour-cent/) : les objectifs exacts de la complétion
- [Gagner de l'argent](${site.url}/dossiers/argent-rapide/)
- [Carte interactive](${site.url}/carte/)
- [Actualités](${site.url}/actualites/)

## Fiabilité
- [Méthode, statuts et sources](${site.url}/a-propos/)
- [Mentions légales et confidentialité](${site.url}/mentions-legales/)

## Index complet
- [Plan du site](${site.url}/sitemap.xml)
`);
// administration : contenu d'origine (avant modifications) et état de la dernière publication
write('assets/admin-donnees.json', JSON.stringify(Object.fromEntries(Object.entries(COLLECTIONS).map(([, [nom, , cle, titre]]) => [nom, { cle, titre, items: ORIGINAUX[nom] || [] }]))));
write('assets/publication.json', JSON.stringify({ sha: process.env.CONTENU_SHA || '', commit: process.env.GITHUB_SHA || '', date: new Date().toISOString(), modifications: ADMIN_APPLIQUES, erreur: process.env.CONTENU_ERREUR === '1' }));
// adresse personnalisée (GitHub Pages)
if (!site.url.includes('github.io')) write('CNAME', new URL(site.url).hostname + '\n');

console.log(`✓ ${pages.length} pages · ${index.length} entrées de recherche · ${features.length} repères carte → docs/`);
write('ads.txt', 'google.com, pub-5400900635133774, DIRECT, f08c47fec0942fa0\n');
