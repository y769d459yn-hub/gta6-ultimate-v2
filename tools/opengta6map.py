"""Emplacements de « Open GTA 6 Map » (fbritoferreira, CC BY 4.0) → data/carte-ogm.json.

Usage : python3 tools/opengta6map.py <dossier du dépôt fbritoferreira/gta6>
Garde les emplacements utiles (objets, armes, véhicules, braquages, commerces, services, activités),
convertit les coordonnées dans le repère monde de GTADB (calage exact sur les 1 021 lieux communs : x = 32·x − 16385, y = 16385 − 32·y),
traduit en français les types, les noms génériques et les indications des joueurs (tools/traduction_carte.py)."""
import json, os, re, sys, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from traduction_carte import traduire_desc, traduire_nom
SRC = sys.argv[1]
L = json.load(open(os.path.join(SRC, 'public', 'data', 'locations.json')))
os.makedirs(os.path.join(ROOT, 'vendor', 'opengta6map'), exist_ok=True)
shutil.copy(os.path.join(SRC, 'LICENSE'), os.path.join(ROOT, 'vendor', 'opengta6map', 'LICENSE'))
REV = os.popen(f'git -C "{SRC}" rev-parse HEAD').read().strip()

# type d'origine → (catégorie de la carte, libellé français, icône)
T = {}
def add(types, cat, lab, ic):
    for t in types.split('|'): T[t] = (cat, lab, ic)
CARTES = [t for t in {l.get('type', '') for l in L} if t.endswith(' card')] + ['Collectible card']
add('|'.join(CARTES), 'collection', 'Carte à collectionner', 'badge')
add('Yellow Loot Box', 'collection', 'Caisse jaune', 'chest')
add('WAiNK curiosity|WAiNK landmark|WAiNK sculpture', 'collection', 'Scan WAiNK', 'eye')
add('Magazine|Comic', 'collection', 'Magazine ou BD', 'book')
add('Hidden package', 'collection', 'Paquet caché', 'chest')
add('Meteorite', 'collection', 'Météorite', 'sparkle')
add('Ahol Street Art', 'collection', 'Street art Ahol', 'spray')
add('Book swap', 'collection', 'Boîte à livres', 'book')
add('Unique playlist', 'collection', 'Playlist unique', 'music')
add('Message in a bottle', 'collection', 'Message dans une bouteille', 'wave')
add('Treasure', 'collection', 'Trésor', 'diamond')
add('1010 mural', 'collection', 'Fresque 1010', 'spray')
add('Luxury Watch', 'collection', 'Montre de luxe', 'clock')
add('Scoop Container', 'collection', 'Conteneur SCOOP', 'truck')
add('Weapon pickup', 'armes', 'Arme au sol', 'gun')
add('Unique Weapon', 'armes', 'Arme unique', 'target')
add('Ammu-Nation', 'armes', 'Armurerie', 'gun')
add('Shooting range', 'armes', 'Stand de tir', 'target')
add('Standout vehicle', 'vehicules', 'Véhicule remarquable', 'car')
add('Vehicle spawn', 'vehicules', 'Véhicule qui apparaît ici', 'car')
add('Vehicle request', 'vehicules', 'Véhicule à commander', 'phone')
add('Vehicle rental', 'vehicules', 'Location de véhicules', 'car')
add('Bank', 'argent', 'Banque', 'bank')
add('Safe', 'argent', 'Coffre-fort', 'chest')
add('Convenience store|Liquor store', 'argent', 'Magasin à braquer', 'money')
add("Smash 'n' Grab", 'argent', 'Vitrine à casser', 'diamond')
add('Towable ATM', 'argent', 'Distributeur à arracher', 'truck')
add('Gang operation|Gang Operation|Gang compound', 'argent', 'Opération de gang', 'siren')
add('Payday loan', 'argent', 'Prêt sur salaire', 'money')
add('Fence', 'argent', 'Receleur', 'money')
add("Pay 'n' Spray", 'services', "Pay 'n' Spray", 'spray')
add('Mod shop', 'services', 'Garage auto', 'wrench')
add('Car wash', 'services', 'Station de lavage', 'spray')
add('Fire station', 'services', 'Pompiers', 'siren')
add('Hospital', 'services', 'Hôpital', 'heart')
add('Police station', 'services', 'Police', 'badge')
add('Garage', 'services', 'Garage perso', 'garage')
add('Safehouse', 'services', 'Planque', 'home')
add('Airport', 'services', 'Aéroport', 'plane')
add('Ferry', 'services', 'Ferry', 'boat')
add('Marina', 'services', 'Marina', 'anchor')
add('Station', 'services', 'Gare et métro', 'city')
add('Gym', 'services', 'Salle de sport', 'trophy')
add('Clothes shop', 'commerces', 'Vêtements', 'user')
add('Shoe shop', 'commerces', 'Chaussures', 'user')
add('Hair salon', 'commerces', 'Coiffeur', 'user')
add('Tattoo parlour', 'commerces', 'Tatoueur', 'spray')
add('Electronics', 'commerces', 'Électronique', 'phone')
add('Comics', 'commerces', 'Boutique de BD', 'book')
add('Gas station', 'commerces', 'Station-service', 'bolt')
add('Bar', 'commerces', 'Bar', 'music')
add('Nightclub', 'commerces', 'Boîte de nuit', 'music')
add('Café and takeout|Cafe Takeout', 'commerces', 'Café et vente à emporter', 'chest')
add('Street food', 'commerces', 'Street food', 'chest')
add('Food and drink', 'commerces', 'Restauration', 'chest')
add('Cinema', 'commerces', 'Cinéma', 'news')
add('Landmark', 'lieux', 'Lieu remarquable', 'star')
add('Under the bridge', 'activites', 'Passage sous un pont', 'plane')
add('Random event', 'activites', 'Événement aléatoire', 'question')
add('Stunt jump', 'activites', 'Saut de cascade', 'ramp')
add('Basketball hoop', 'activites', 'Panier de basket', 'ball')
add('Race', 'activites', 'Course', 'trophy')
add('Car Meet', 'activites', 'Rassemblement auto', 'car')
add('Arcade', 'activites', "Borne d'arcade", 'gamepad')
add('Pool', 'activites', 'Billard', 'ball')
add('Mini golf', 'activites', 'Mini-golf', 'ball')
add('Golf', 'activites', 'Golf', 'ball')
add('Drone race', 'activites', 'Course de drone', 'plane')
add('Knife flight', 'activites', 'Vol en rase-mottes', 'plane')
add('Fishing spot', 'activites', 'Coin de pêche', 'fish')
add('BASE jump', 'activites', 'Saut BASE', 'mountain')
add('Parachuting', 'activites', 'Saut en parachute', 'mountain')
add('Meditation spot', 'activites', 'Méditation', 'sun')
add('Hunting', 'activites', 'Chasse', 'paw')

# formules répétées → français ; le reste reste en anglais
CHAMPS = {'Security': 'Sécurité', 'Take value': 'Butin', 'Inventory': 'Stock', 'Style': 'Style', 'Robbery': 'Braquage'}
VALS = {'Low': 'faible', 'Medium': 'moyenne', 'High': 'élevée', 'Standard': 'standard', 'Expanded': 'étendu', 'Casual': 'décontracté', 'Sportswear': 'sport',
        'Formal': 'habillé', 'Thrift': 'friperie', 'Teller': 'au guichet', 'Vault': 'chambre forte'}
PHRASES = {
    'Garage offering repairs and resprays to lower recognition. They also buy and register vehicles with standard trackers.': "Garage : réparations et nouvelle peinture pour être moins reconnu. Rachète et enregistre les véhicules à traceur standard.",
    'Electronics shop selling headphones, earbuds, and phone cases.': 'Magasin d’électronique : casques, écouteurs et coques de téléphone.',
    'Ammu-Nation distributor that stocks guns, mods, ammo, and equipment.': 'Ammu-Nation : armes, accessoires, munitions et équipement.',
    'In the garage.': 'Dans le garage.',
    'Drive-thru car wash that offers a quick in-and-out service.': 'Station de lavage rapide, sans descendre de voiture.',
    'Clothing store specializing in denim, selling everyday attire, footwear, and accessories.': 'Magasin de jeans : vêtements de tous les jours, chaussures et accessoires.',
    'Retail chain selling athletic clothing, footwear, and accessories.': 'Chaîne de vêtements de sport, chaussures et accessoires.',
    'Shoe store specializing in sneakers and accessories.': 'Magasin de baskets et accessoires.',
    'Liquor store selling beer, snacks, and smokes.': 'Magasin d’alcool : bière, snacks et cigarettes.',
    'Pawn shop that buys collectibles, like cards, doubloons and meteorites.': 'Prêteur sur gages : rachète les objets de collection (cartes, doublons, météorites).',
    'Loan store with marked bills on site. A viable robbery target now that you have a dye pack jammer.': 'Boutique de prêts avec billets marqués : braquable une fois que tu as le brouilleur de sachets d’encre.',
    'Fashion retailer selling vibrant clubwear, footwear, and accessories.': 'Boutique de mode : tenues de soirée colorées, chaussures et accessoires.',
    'Fashion retailer selling high-end clothes, footwear, and accessories.': 'Boutique de mode haut de gamme : vêtements, chaussures et accessoires.',
    'Vintage store selling clothing, footwear, and accessories at a bargain.': 'Friperie : vêtements, chaussures et accessoires à petit prix.',
    'High-end shoe store specializing in dress shoes, boots, and sandals.': 'Chaussures haut de gamme : chaussures de ville, bottes et sandales.',
    'Shoe store selling discount sneakers, boots, and sandals.': 'Chaussures à prix réduits : baskets, bottes et sandales.',
    'Small bank with marked bills on site. A viable robbery target now that you have a dye pack jammer.': 'Petite banque avec billets marqués : braquable une fois que tu as le brouilleur de sachets d’encre.',
    'Boutique retailer selling everyday attire, footwear, and accessories.': 'Boutique : vêtements de tous les jours, chaussures et accessoires.',
    'Retail chain specializing in jerseys, selling team apparel, footwear, and accessories.': 'Maillots d’équipes, chaussures et accessoires.',
    'Small, high-end jewelry store with luxury pieces for wealthy clientele.': 'Petite bijouterie de luxe.',
    'Convenience store selling snacks, drinks, and smokes.': 'Supérette : snacks, boissons et cigarettes.',
}
def fr(desc):
    if not desc: return '', False
    parts = [p.strip() for p in desc.split(';')]
    head, rest = parts[0], parts[1:]
    out, en = [], False
    if head in PHRASES: out.append(PHRASES[head])
    elif head: out.append(head); en = True
    for p in rest:
        m = re.match(r'(\w[\w ]*?):\s*(.*)$', p)
        if m and m.group(1) in CHAMPS:
            v = m.group(2)
            v = re.sub(r'\b(' + '|'.join(VALS) + r')\b', lambda x: VALS[x.group(1)], v).replace(',', ' ').replace('  ', ' ')
            out.append(f'{CHAMPS[m.group(1)]} : {v}')
        elif p: out.append(p); en = True
    return ' · '.join(out), en

EXCLUS = {'Bus stop', 'ATM', 'EV charger', 'City / Town', 'helipad', 'Helipad'}
out, manque = [], set()
for l in L:
    t = l.get('type', '')
    if t in EXCLUS: continue
    if t not in T: manque.add(t); continue
    cat, lab, ic = T[t]
    d, en = fr(l.get('description', ''))
    if en:
        t = traduire_desc(d)
        if t: d, en = t, False
    nom = traduire_nom(l['name'].strip())
    out.append({'id': l['id'], 'c': cat, 's': lab, 'i': ic, 'n': nom, 'x': round(32 * l['x'] - 16385), 'y': round(16385 - 32 * l['y']),
                **({'d': d} if d else {}), **({'en': 1} if en else {}), **({'ph': 1} if l.get('screenshot') else {}), **({'a': l['area']} if l.get('area') else {})})
assert not manque, manque
json.dump({'source': 'Open GTA 6 Map (fbritoferreira), https://github.com/fbritoferreira/gta6', 'licence': 'CC BY 4.0', 'revision': REV,
           'modifications': 'Sélection des emplacements utiles, coordonnées converties dans le repère GTADB, types, noms et indications traduits en français.', 'lieux': out},
          open(os.path.join(ROOT, 'data', 'carte-ogm.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
import collections
print(len(out), 'emplacements ·', dict(collections.Counter(o['c'] for o in out)), '·', sum(1 for o in out if o.get('en')), 'descriptions en anglais')
