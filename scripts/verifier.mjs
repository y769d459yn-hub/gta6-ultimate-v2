// Contrôle du site construit (docs/) avant publication : liens internes, métadonnées SEO, plan du site, données structurées.
// Usage : node scripts/verifier.mjs  (code de sortie 1 si une erreur bloquante est trouvée)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const BASE = site.url.replace(/\/$/, '') + '/';
const erreurs = [], alertes = [];
const err = (m) => erreurs.push(m), warn = (m) => alertes.push(m);
const decode = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// toutes les pages HTML
const pages = new Map();
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, f.name);
    if (f.isDirectory()) walk(full);
    else if (f.name.endsWith('.html')) pages.set(path.relative(OUT, full).replace(/\\/g, '/').replace(/index\.html$/, ''), fs.readFileSync(full, 'utf8'));
  }
})(OUT);

const titres = new Map(), descs = new Map();
for (const [p, h] of pages) {
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(h);
  // liens et ressources internes
  for (const m of h.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const a = m[1];
    if (/^(https?:|mailto:|#|data:|javascript:|\/)/.test(a)) continue;
    const rel = a.split('#')[0].split('?')[0]; if (!rel) continue;
    let t = path.normalize(path.join(OUT, path.dirname(p ? p + 'x' : 'x'), rel));
    if (rel.endsWith('/') || (fs.existsSync(t) && fs.statSync(t).isDirectory())) t = path.join(t, 'index.html');
    if (!fs.existsSync(t)) err(`lien cassé : ${p || '/'} → ${a}`);
  }
  // données structurées
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let j; try { j = JSON.parse(m[1]); } catch (e) { err(`JSON-LD invalide : ${p}`); continue; }
    const liste = j['@type'] === 'ItemList' ? j : j.mainEntity && j.mainEntity['@type'] === 'ItemList' ? j.mainEntity : null;
    for (const it of (liste && liste.itemListElement) || []) {
      const u = it.url || (it.item && (it.item.url || it.item['@id'])) || (typeof it.item === 'string' ? it.item : '');
      if (u && u.startsWith(BASE) && !pages.has(u.slice(BASE.length).split('#')[0])) err(`JSON-LD : élément de liste vers une page absente : ${p} → ${u}`);
    }
  }
  if (noindex || p === '404.html') continue;
  const t = decode((h.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  const d = decode((h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  const c = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  if (!t) err(`sans titre : ${p}`); else if (t.length > 70) warn(`titre long (${t.length}) : ${p}`);
  if (!d) err(`sans description : ${p}`); else if (d.length > 165) warn(`description longue (${d.length}) : ${p}`);
  if (c !== BASE + p) err(`canonical incorrecte : ${p} → ${c}`);
  if (h1 !== 1) err(`${h1} balises h1 : ${p}`);
  (titres.get(t) || titres.set(t, []).get(t)).push(p);
  if (d) (descs.get(d) || descs.set(d, []).get(d)).push(p);
}
for (const [t, l] of titres) if (l.length > 1) err(`titre en double « ${t} » : ${l.join(', ')}`);
for (const [d, l] of descs) if (l.length > 1) warn(`description en double : ${l.join(', ')}`);

// plan du site et robots.txt
const sm = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8');
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const u of urls) {
  const p = u.replace(BASE, '');
  if (!pages.has(p)) err(`sitemap → page absente : ${u}`);
  else if (/noindex/.test(pages.get(p).slice(0, 4000))) err(`sitemap → page noindex : ${u}`);
}
const indexables = [...pages].filter(([p, h]) => p !== '404.html' && !/<meta name="robots" content="[^"]*noindex/.test(h)).length;
if (urls.length !== indexables) err(`sitemap : ${urls.length} adresses pour ${indexables} pages indexables`);
const robots = fs.readFileSync(path.join(OUT, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${BASE}sitemap.xml`)) err('robots.txt : ligne Sitemap absente');
if (/Disallow: \/\s*$/m.test(robots)) err('robots.txt bloque tout le site');

// fiabilité : « confirmé » exige au moins deux sources (méthode du site), et seulement des statuts connus
const lire = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const statuts = Object.keys(site.statuts);
// sources indépendantes : ni agrégateur, ni source faible (data/sources.json → fiabilite ; data/site.json → sourcesNonIndependantes)
const SRCJ = lire('sources.json'), NONIND = site.sourcesNonIndependantes || {};
const indIds = (ids = []) => [...new Set(ids)].filter((id) => SRCJ[id] && !SRCJ[id].fiabilite);
const indNoms = (n = []) => [...new Set(n)].filter((x) => !NONIND[x]);
for (const a of lire('astuces.json')) {
  if (!statuts.includes(a.statut)) err(`astuce ${a.slug} : statut inconnu « ${a.statut} »`);
  if (a.statut === 'confirme' && indIds(a.sources).length < 2 && !(a.sources || []).some((id) => SRCJ[id] && SRCJ[id].official)) err(`astuce ${a.slug} : « confirmé » sans deux sources indépendantes (ni officielle)`);
  if (a.statut === 'teste' && !(a.preuve && a.preuve.date && a.preuve.plateforme && a.preuve.lien)) err(`astuce ${a.slug} : « testé en jeu » sans preuve (date, plateforme, lien)`);
  if (a.verifie && !/^\d{4}-\d{2}-\d{2}$/.test(a.verifie)) err(`astuce ${a.slug} : date de vérification invalide`);
}
// fiches de missions : objectif et aide obligatoires ; liens de déblocage valides ; pas de « 100 % » repris sans texte explicite
{
  const MG = lire('missions-guide.json').missions, MIDS = new Set(lire('missions.json').missions.map((m) => m.id));
  for (const [id, g] of Object.entries(MG)) {
    if (!MIDS.has(id)) err(`fiche mission ${id} : mission inconnue`);
    if (!g.objectif || !(g.erreurs || []).length) err(`fiche mission ${id} : objectif ou aide manquants`);
    if (g.apres && !MIDS.has(g.apres)) err(`fiche mission ${id} : mission de déblocage inconnue « ${g.apres} »`);
    if (g.cent !== undefined && typeof g.cent !== 'string') err(`fiche mission ${id} : « 100 % » doit être un texte tiré du guide`);
  }
}
// codes contradictoires (coffres, triche) : jamais de conseil qui laisse croire qu'un des codes marche à coup sûr
for (const f of ['dossiers.json', 'codes.json', 'astuces.json']) if (/essaie les deux|essaie-le si|confirm[ée]s par plusieurs guides/i.test(JSON.stringify(lire(f)))) err(`${f} : code contradictoire présenté comme sûr (« essaie les deux » ou « confirmés par plusieurs guides »)`);
// encyclopédie : chaque affirmation « Ce qu'on sait » a au moins une référence ; une citation pour chaque source relue
for (const e of lire('encyclopedie.json')) {
  if (!Array.isArray(e.refs) || e.refs.length !== e.sait.length) { err(`encyclopédie ${e.slug} : références absentes ou non alignées sur « Ce qu'on sait »`); continue; }
  e.refs.forEach((r, i) => {
    if (!r.length) err(`encyclopédie ${e.slug} : affirmation ${i + 1} sans source`);
    for (const x of r) {
      if (!SRCJ[x.s]) err(`encyclopédie ${e.slug} : source inconnue « ${x.s} »`);
      if (!['oui', 'partiel', 'non'].includes(x.v)) err(`encyclopédie ${e.slug} : niveau de vérification inconnu « ${x.v} »`);
      if (x.v !== 'non' && !x.q) err(`encyclopédie ${e.slug} : source relue sans citation (affirmation ${i + 1})`);
    }
  });
  if (e.statut === 'confirme' && !e.refs.flat().some((x) => x.v === 'oui' && SRCJ[x.s] && !SRCJ[x.s].fiabilite)) err(`encyclopédie ${e.slug} : « confirmé » sans aucune affirmation relue dans une source indépendante`);
}
for (const c of lire('codes.json').codes) {
  if (c.confirme && indNoms(c.sources).length < 2) err(`code ${c.id} : « confirmé » sans deux sources indépendantes`);
  if (c.confirme && c.contradiction) err(`code ${c.id} : « confirmé » alors qu'une contradiction est notée`);
  if (c.contradiction && /essaie les deux/i.test(c.contradiction)) err(`code ${c.id} : une combinaison contradictoire ne doit pas être présentée comme sûre de fonctionner`);
  if (c.variantes && (c.variantes.length < 2 || c.confirme)) err(`code ${c.id} : variantes mal décrites (au moins deux, jamais « confirmé »)`);
}
for (const x of lire('vehicules.json')) {
  if (x.dispo === 'confirme' && indIds(x.sources).length < 2) err(`véhicule ${x.slug} : emplacement « confirmé » sans deux sources indépendantes`);
  if (x.dispo === 'teste' && !(x.preuve && x.preuve.date && x.preuve.plateforme && x.preuve.lien)) err(`véhicule ${x.slug} : « testé en jeu » sans preuve (date, plateforme, lien)`);
}
if ([...pages.values()].some((h) => /Consultées le \d/.test(h))) err('date de consultation des sources affichée sans être réelle');
if (!fs.existsSync(path.join(OUT, 'llms.txt'))) err('llms.txt absent');

console.log(`${pages.size} pages · ${urls.length} dans le plan du site · ${erreurs.length} erreur(s) · ${alertes.length} alerte(s)`);
for (const a of alertes.slice(0, 20)) console.log('  alerte :', a);
for (const e of erreurs.slice(0, 50)) console.log('  ERREUR :', e);
process.exit(erreurs.length ? 1 : 0);
