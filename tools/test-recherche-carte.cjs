// Test automatisé de la recherche de la carte (125 requêtes). Usage : servir docs/ puis node tools/test-recherche-carte.cjs http://localhost:8766/carte/
// Banc de test de la recherche de la carte : chaque requête doit donner le résultat attendu dans les 3 premières suggestions
const { chromium, devices } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8766/carte/';
const T = [
  // argent
  ['Comment gagner de l\'argent rapidement ?', /Gagner de l'argent|Argent facile/], ['argent facile', /Argent facile|Gagner de l'argent/], ['argent', /Argent/], ['money', /Argent/], ['thune', /Argent/],
  ['gagner argent', /Gagner de l'argent|Argent facile/], ['devenir riche', /Gagner de l'argent/], ['Quel est le code du coffre ?', /Codes des coffres/], ['code coffre', /Codes des coffres/], ['codes des coffres', /Codes des coffres/],
  ['coffre-fort', /Coffres-forts|Coffre-fort/], ['coffre', /Coffres-forts|Codes des coffres|Coffre-fort/], ['safe code', /Codes des coffres/], ['braquage', /Commerces à braquer|braqu/i], ['braquer une banque', /Banques|braqu/i],
  ['banque', /Banques/], ['receleur', /Receleurs/], ['revendre', /Receleurs/], ['trésor', /Trésors/], ['Où sont les trésors ?', /Trésors/],
  ['tresor cache', /Trésors/], ['treasure', /Trésors/],
  // véhicules
  ['Où trouver une voiture rare ?', /Véhicules rares|Voitures rares/], ['voiture rare', /Véhicules rares|Voitures rares/], ['voitures rares', /Véhicules rares|Voitures rares/], ['véhicule unique', /Véhicules rares|Véhicules uniques|Versions uniques/],
  ['supercar', /Supercars/], ['supercar gratuite', /Supercars/], ['voiture rapide', /Supercars/], ['hypercar', /Supercars/], ['voiture de sport', /Sportives/],
  ['jdm', /Sportives/], ['muscle car', /Muscle/], ['voiture de collection', /Muscle/], ['moto', /Moto/i], ['moto sportive', /Motos/],
  ['quad', /Motos/], ['bateau', /Bateau/i], ['bateau rapide', /Bateaux/], ['jet ski', /Bateaux|Jet/i], ['hydroglisseur', /Bateaux|airboat|Hydroglisseur/i],
  ['Où trouver un hélicoptère ?', /hélicoptères/i], ['hélico', /hélicoptères/i], ['helicopter', /hélicoptères/i], ['helicoptere', /hélicoptères/i], ['avion', /Avions/],
  ['jet privé', /Avions/], ['hydravion', /Avions|Dodo/], ['tank', /Militaires|Rhino/], ['militaire', /Militaires/], ['Où est la Penumbra FF ?', /Penumbra FF/],
  ['penumbra ff', /Penumbra FF/], ['penumbra', /Penumbra/], ['penumra', /Penumbra/], ['Pegassi Tempesta', /Tempesta/], ['tempesta', /Tempesta/],
  ['tempestta', /Tempesta/], ['infernus', /Infernus/], ['cheetah', /Cheetah/], ['zorrusso', /Zorrusso/], ['emerus', /Emerus/],
  ['banshee', /Banshee/], ['comet', /Comet/], ['elegy', /Elegy/], ['sanchez', /Sanchez/], ['buzzard', /Buzzard/],
  ['sea sparrow', /Sea Sparrow/], ['dodo', /Dodo/], ['squalo', /Squalo/], ['airboat', /Airboat|Hydroglisseur/i], ['marshall', /Marshall/],
  // armes
  ['Où trouver une arme gratuite ?', /Armes gratuites/], ['arme gratuite', /Armes gratuites/], ['armes gratuites', /Armes gratuites/], ['arme', /Arme/], ['pistolet', /Arme|pistolet/i],
  ['arme rare', /Aucun emplacement fiable/], ['arme unique', /Armes uniques/], ['munitions', /Aucun emplacement fiable/], ['gilet pare-balles', /Aucun emplacement fiable/], ['armurerie', /Armureries/],
  ['ammu-nation', /Armureries|Ammu/i], ['stand de tir', /Stands de tir/],
  // secrets et collections
  ['secret', /Secrets/], ['easter egg', /Easter/], ['mystère', /Mystères|Secrets/], ['objets à collectionner', /Objets à collectionner/], ['collectibles', /Objets à collectionner/],
  ['carte à collectionner', /Cartes/], ['météorite', /Météorites/], ['paquet caché', /Paquets cachés/], ['scan waink', /WAiNK/], ['objet rare', /Objets rares/],
  ['Quels objets me restent-ils à récupérer ?', /Ma progression/], ['ma progression', /Ma progression/], ['Comment terminer GTA VI à 100 % ?', /100 %/], ['100%', /100 %/], ['finir le jeu', /100 %/],
  // missions et activités
  ['mission', /Missions/], ['missions principales', /Missions principales/], ['événement aléatoire', /Événements aléatoires/], ['random event', /Événements aléatoires/], ['course', /Courses/],
  ['cascade', /Cascades/], ['pêche', /Pêche/], ['sport', /Sports/],
  // propriétés, commerces, services
  ['Où trouver un garage ?', /Planques et garages|Garages/], ['garage', /Planques et garages|Garages/], ['planque', /Planques/], ['maison de Jason', /Jason/], ['vêtements', /vêtements/i],
  ['coiffeur', /Coiffeurs/], ['tatouage', /Tatoueurs/], ['tuning', /Garages publics|tuning|Garage/i], ['hôpital', /Hôpitaux/], ['station-service', /Stations-service/],
  ['essence', /Stations-service/], ['aéroport', /Aéroports/], ['gare', /Gares/], ['marina', /Marinas/],
  // lieux
  ['Vice City', /Vice City/], ['Port Gellhorn', /Port Gellhorn/], ['Key Lento', /Key Lento/], ['Grassrivers', /Grassrivers/], ['Ambrosia', /Ambrosia/],
];
(async () => {
  const b = await chromium.launch(); const pg = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); const err = []; pg.on('pageerror', (x) => err.push(x.message));
  await pg.goto(URL); await pg.waitForTimeout(2500);
  let ok1 = 0, ok3 = 0; const ko = [];
  for (const [q, re] of T) {
    await pg.fill('#atp-q', ''); await pg.fill('#atp-q', q); await pg.waitForTimeout(260);
    const r = await pg.evaluate(() => [...document.querySelectorAll('#atp-sugg [role="option"]')].slice(0, 3).map((x) => x.querySelector('b') ? x.querySelector('b').textContent.trim() + ' · ' + ((x.querySelector('small') || {}).textContent || '') : x.textContent.trim()));
    const i = r.findIndex((x) => re.test(x));
    if (i === 0) ok1++; if (i >= 0 && i < 3) ok3++; else ko.push(`${q} → ${r.join(' ‖ ') || '(aucun résultat)'}`);
  }
  console.log(`${T.length} recherches · bon résultat en 1re position : ${ok1} (${Math.round(ok1 / T.length * 100)} %) · dans les 3 premiers : ${ok3} (${Math.round(ok3 / T.length * 100)} %)`);
  ko.forEach((x) => console.log('  ✗', x)); console.log('erreurs', err); await b.close();
})();
