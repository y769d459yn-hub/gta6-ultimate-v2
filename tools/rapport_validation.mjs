// Rapport des repères importants à valider EN JEU (aucune vérification en jeu n'a encore été faite par l'équipe).
// Usage : node tools/rapport_validation.mjs  (après node scripts/build.mjs) → rapports/validation-en-jeu.md
// Une fois un repère vu en jeu, l'ajouter à data/verifications-en-jeu.json : il passe en « Confirmé ».
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(new URL('../docs/data/carte.json', import.meta.url)));
const VJ = JSON.parse(fs.readFileSync(new URL('../data/verifications-en-jeu.json', import.meta.url))).reperes;
const F = d.features.map((f) => ({ ...f.properties, x: f.geometry.coordinates[0], y: f.geometry.coordinates[1] })).filter((p) => !p.label && !p.dbl);
const src = (p) => (/^o-/.test(p.id) ? 'Open GTA 6 Map' : /^w-/.test(p.id) ? 'GTA Wiki' : /^s-/.test(p.id) ? 'GTADB' : 'fiche du guide') + (p.cap ? ' + capture GTABase' : '');
const has = (p, c, sc) => p.cat === c && (!sc || (p.sc || []).includes(sc));
const LOTS = [
  ['Véhicules affichés sur la carte', (p) => p.cat === 'vehicules' && !p.hv, 'Présence du véhicule (et de la livrée) à cet endroit ; moment où il devient accessible'],
  ['Codes des coffres', (p) => has(p, 'argent', 'codes'), 'Code exact, ouverture du coffre, contenu'],
  ['Coffres-forts', (p) => has(p, 'argent', 'coffres') && !has(p, 'argent', 'codes'), 'Présence du coffre, accès, contenu'],
  ['Armes uniques', (p) => has(p, 'armes', 'uniques'), 'Arme présente, nom exact, conditions'],
  ['Trésors', (p) => has(p, 'collection', 'tresors'), 'Objet présent, accès (plongée, outil)'],
  ['Secrets et Easter Eggs', (p) => p.cat === 'secrets', 'Observation du secret, conditions de déclenchement'],
  ['Planques et garages', (p) => has(p, 'proprietes', 'planques') || has(p, 'proprietes', 'garages'), 'Accès, déblocage, prix éventuel'],
];
let md = `# Repères à valider en jeu\n\nGénéré le ${new Date().toISOString().slice(0, 10)} depuis la carte. Aucun repère n'a encore été vérifié en jeu par l'équipe (${Object.keys(VJ).length} entrée(s) dans data/verifications-en-jeu.json).\n\nPour chaque repère vu en jeu : ajouter son identifiant dans \`data/verifications-en-jeu.json\` (date, version du jeu, note), puis régénérer le site.\n\n`;
let total = 0;
for (const [titre, f, quoi] of LOTS) {
  const L = F.filter(f).filter((p) => !VJ[p.id]).sort((a, b) => (b.et || 0) - (a.et || 0) || (b.nt || 0) - (a.nt || 0) || a.nom.localeCompare(b.nom, 'fr'));
  total += L.length;
  md += `## ${titre} (${L.length})\n\nÀ vérifier : ${quoi}.\n\n| Identifiant | Nom | Secteur | Fiabilité actuelle | Source |\n|---|---|---|---|---|\n`;
  for (const p of L) md += `| \`${p.id}\` | ${p.nom.replace(/\|/g, '/')} | ${p.zone || ''} | ${p.fi || p.statut} | ${src(p)} |\n`;
  md += '\n';
}
fs.mkdirSync(new URL('../rapports/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../rapports/validation-en-jeu.md', import.meta.url), md);
console.log(total, 'repères prioritaires à valider en jeu → rapports/validation-en-jeu.md');
