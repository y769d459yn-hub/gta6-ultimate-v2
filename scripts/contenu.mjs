// Récupère le contenu modifié depuis l'administration (table Supabase « contenu ») avant le build.
// Écrit data-admin/contenu.json et affiche son empreinte. En cas d'échec, on s'arrête :
// publier sans ces modifications effacerait du site ce que l'administrateur a écrit.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const { url, cle } = site.comptes || {};
if (!url || !cle) { console.log('pas de Supabase configuré : aucun contenu admin'); process.exit(0); }

const res = await fetch(`${url}/rest/v1/contenu?select=collection,cle,donnees,supprime,maj&order=maj.asc`, { headers: { apikey: cle, Accept: 'application/json' } });
if (!res.ok) {
  // table pas encore créée : on continue sans contenu admin
  if (res.status === 404 || res.status === 400) { console.log(`table contenu absente (${res.status}) : aucun contenu admin`); process.exit(0); }
  console.error(`lecture du contenu impossible : HTTP ${res.status}`); process.exit(1);
}
const rows = await res.json();
const texte = JSON.stringify(rows);
fs.mkdirSync(path.join(ROOT, 'data-admin'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data-admin', 'contenu.json'), texte);
const sha = crypto.createHash('sha256').update(texte).digest('hex').slice(0, 16);
console.log(`${rows.length} modification(s) admin · empreinte ${sha}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\n`);
