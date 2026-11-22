"""Codes de triche de GTA 6 : écrit data/codes.json à partir des relevés du 22/11/2026 (vendor/codes/).

Sources : GTABase (liste PS5/Xbox), GTA Wiki (« Cheats in GTA VI »), gta6guide.fr (« Codes de triche »).
Textes français rédigés par le site. Une combinaison est « confirmée » quand au moins deux sources donnent la même."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = os.path.join(ROOT, 'vendor', 'codes')
GB = json.load(open(os.path.join(V, 'gtabase.json')))
WK = json.load(open(os.path.join(V, 'gtawiki.json')))
G6 = json.load(open(os.path.join(V, 'gta6guide.json')))
assert len(GB) == len(G6) == 61

CATS = {'Player Cheats': ('joueur', 'Joueur', 'user', '#ff2d87'), 'Combat Cheats': ('combat', 'Combat', 'gun', '#ff5a3c'),
        'Vehicle Spawn Cheats': ('vehicules', 'Véhicules', 'car', '#ff9a1f'), 'Environment Cheats': ('environnement', 'Météo et heure', 'sun', '#19d3e3'),
        'Screen Filter Cheats': ('filtres', "Filtres d'écran", 'eye', '#9b6bff')}

# nom, effet, comment le débloquer (dans l'ordre des 61 codes)
FR = [
    ('250 000 $', 'Donne 250 000 $ tout de suite.', "Terminer l'histoire."),
    ('Ivresse', 'Rend ton personnage et ton partenaire ivres.', "Dépenser 2 500 $ en alcool."),
    ('Augmenter la pression policière', 'Augmente le niveau de pression (« heat ») dans toute la carte.', 'Semer 25 fois un avis de recherche à 3 étoiles.'),
    ("Augmenter l'avis de recherche", "Augmente ton niveau de recherche partout sur la carte.", 'Semer 50 fois un avis de recherche à 3 étoiles.'),
    ('Focus illimité', 'Ta jauge de Focus ne se vide plus.', "Terminer l'histoire."),
    ('Aucun dégât de chute', 'Tu ne prends plus de dégâts en tombant.', 'Survivre 20 fois à une chute libre de 12 mètres (40 pieds).'),
    ('Parachute', 'Ajoute un parachute à ton équipement.', 'Faire 50 sauts en parachute ou BASE jumps depuis au moins 90 mètres (300 pieds).'),
    ('Gilet pare-balles', 'Ajoute un gilet pare-balles à ton équipement.', 'Faire 100 séances de sport.'),
    ('Réparer le véhicule', 'Répare entièrement le véhicule dans lequel tu es.', 'Finir 1er de 10 courses à Gellhorn Raceway, Thrillbilly Mud Club et Boone Speedway.'),
    ('Nitro illimitée', 'Ton véhicule ne tombe plus à court de nitro ni de carburant.', 'Réussir 50 sauts acrobatiques.'),
    ('Munitions au maximum', 'Remplit les munitions de toutes tes armes.', 'Gagner 25 médailles de bronze (ou mieux) aux stands de tir.'),
    ('Munitions infinies', 'Tes munitions ne s’épuisent plus.', "Gagner 25 médailles d'argent (ou mieux) aux stands de tir."),
    ('Sans rechargement', 'Munitions infinies et plus besoin de recharger.', "Gagner 25 médailles d'or aux stands de tir."),
    ('Toutes les armes explosives', 'Ajoute toutes les armes explosives, avec le plein de munitions.', 'Lancer 100 grenades.'),
    ('Munitions incendiaires', 'Tes munitions mettent le feu aux cibles.', 'Brûler 100 ennemis.'),
    ('Bouteilles explosives', 'Les bouteilles explosent quand on les touche.', 'Lancer 100 cocktails Molotov.'),
    ('Fusil à pompe explosif', 'Ajoute un Mason & Keen Shortstraw qui tire des cartouches explosives.', 'Toucher 100 ennemis avec des explosions.'),
    ('Hauners H-AT', 'Ajoute un lance-roquettes Hauners H-AT à ton équipement.', 'Faire exploser 100 véhicules.'),
    ('Force des attaques', 'Tes balles et tes coups envoient les cibles voler.', "Terminer l'histoire."),
    ('Ballons explosifs', 'Les ballons de sport explosent à l’impact.', 'Toucher 20 ennemis avec des explosions.'),
    ('Force des véhicules', 'Les piétons percutés par un véhicule s’envolent.', 'Tuer 25 ennemis avec un véhicule (écraser des passants compte aussi).'),
    ('Interstate Ambulance', 'Fait apparaître une ambulance.', "Découvrir l'Interstate Ambulance dans le menu Progression."),
    ('Airboat 09', 'Fait apparaître un hydroglisseur Airboat 09.', 'Réussir 5 défis Survie.'),
    ('Bravado Banshee', 'Fait apparaître une Bravado Banshee.', 'Réussir tous les défis Combat.'),
    ('Tuff BMX', 'Fait apparaître un vélo BMX.', 'Réussir 5 défis Forme.'),
    ('Maibatsu Boomazoom', 'Fait apparaître une Maibatsu Boomazoom.', 'Réussir 5 défis Shopping.'),
    ('Nagasaki Carbon RS', 'Fait apparaître une moto Nagasaki Carbon RS.', 'Réussir tous les défis Exploration.'),
    ("Vapid Dominator '65", "Fait apparaître une Vapid Dominator de 1965.", 'Réussir tous les défis Forme.'),
    ('Progen Emerus', 'Fait apparaître une hypercar Progen Emerus.', 'Réussir tous les défis Véhicules.'),
    ('Flamant rose gonflable', 'Fait apparaître une bouée flamant rose.', 'Détruire 50 flamants à cocaïne.'),
    ('MTL Pumper', 'Fait apparaître un camion de pompiers.', 'Découvrir le MTL Pumper dans le menu Progression.'),
    ('Taxi Vapid Stanier G2', 'Fait apparaître un taxi.', 'Réussir 5 défis Sport.'),
    ('Hauners P-996 Lazer', 'Fait apparaître un avion de chasse.', 'Réussir tous les défis.'),
    ('HVY Bulldozer', 'Fait apparaître un bulldozer.', 'Découvrir le HVY Bulldozer dans le menu Progression.'),
    ('Lapwing Mallard', 'Fait apparaître un avion de voltige.', 'Réussir 5 défis Véhicules.'),
    ('Brimstone Golfer', 'Fait apparaître une voiturette de golf.', 'Réussir tous les défis Sport.'),
    ('Hauners Rhino (tank)', 'Fait apparaître un tank.', 'Réussir tous les défis Survie.'),
    ('Maibatsu Sanchez', 'Fait apparaître une moto tout-terrain.', 'Réussir 5 défis Criminels.'),
    ('Nagasaki Sea Sparrow', 'Fait apparaître un petit hélicoptère amphibie.', 'Réussir 5 défis Exploration.'),
    ('Speeder 700 GT', 'Fait apparaître un hors-bord.', 'Réussir 5 défis Combat.'),
    ('Truffade Thrax', 'Fait apparaître une hypercar Truffade Thrax.', 'Réussir tous les défis Shopping.'),
    ('Western Zombie Bobber', 'Fait apparaître une moto Western Zombie Bobber.', 'Réussir tous les défis Criminels.'),
    ("Avancer l'heure", "Fait avancer l'heure de la journée.", 'Trouver 10 montres à collectionner.'),
    ("Figer l'heure", "Bloque l'heure de la journée.", 'Trouver 20 montres à collectionner.'),
    ('Changer la météo', 'Fait défiler les différentes météos.', "Terminer l'histoire."),
    ('Golden Hour', 'Teinte dorée et image en format cinéma.', 'Passer 4 heures à se tenir la main.'),
    ('Powdered Sugar', 'Le monde devient blanc, avec des reflets scintillants.', 'Scanner tous les débris spatiaux avec WAiNK.'),
    ('Pinhole', "Effet d'appareil photo sténopé.", 'Nettoyer 25 opérations de gangs avec ton partenaire.'),
    ('Neon Jungle', 'Ajoute des reflets néon partout.', 'Découvrir les 16 véhicules Girlypop.'),
    ('Yesteryear', 'Image de vieille télé en noir et blanc.', 'Découvrir la Ridgeway.'),
    ('Cataclysm', 'Remplit le monde de fumée sombre.', 'Découvrir la Vamos de Martha dans le menu Progression.'),
    ('Videotape', 'Image de vieille cassette vidéo.', 'Faire 50 activités avec ton partenaire.'),
    ('Dark Mirror', 'Le monde devient noir et à l’envers.', 'Gagner 500 000 $ en vendant des véhicules.'),
    ('Migraine', "Image floue et déformée.", "Survivre 6 minutes avec un avis de recherche à 6 étoiles."),
    ('Dollhouse', 'Couleurs vives et image étroite.', 'Passer 8 heures avec ton partenaire.'),
    ('Bubblegum', 'Le monde devient violet et jaune, avec des reflets scintillants.', 'Trouver les 24 cartes Vice City Flamingos.'),
    ('Fast Forward', 'Flou de mouvement et nuages accélérés.', 'Faire 50 méditations.'),
    ('Fisheye', "Effet d'objectif fisheye.", 'Pêcher 100 poissons.'),
    ('Faded Glory', 'Image de vieille télé couleur.', 'Braquer 50 magasins avec ton partenaire.'),
    ('Pixel Art', "Pixelise l'image.", 'Gagner 250 000 $ en vendant des objets de collection.'),
    ('Hellscape', "Le monde devient rouge et orange, avec un effet de chaleur.", 'Voler 100 véhicules de police.')]
assert len(FR) == 61
DIR = {'UP': 'haut', 'DOWN': 'bas', 'LEFT': 'gauche', 'RIGHT': 'droite'}

def wiki_seq(w):  # le wiki affiche chaque flèche deux fois (icônes PlayStation et Xbox)
    s = w['seq']; return s[::2] if len(s) % 2 == 0 and s[::2] == s[1::2] else s
wiki = [w for w in WK if w.get('effet')]
codes = []
for i, (g, f6, fr) in enumerate(zip(GB, G6, FR)):
    cid, cnom, cic, ccol = CATS[g['cat']]
    seqs = {'GTABase': g['keys'], 'gta6guide.fr': f6['seq']}
    if i < len(wiki): seqs['GTA Wiki'] = wiki_seq(wiki[i])
    connues = {k: tuple(v) for k, v in seqs.items() if v}
    seq = list(max(connues.values(), key=lambda s: sum(1 for x in connues.values() if x == s))) if connues else []
    accord = [k for k, v in connues.items() if list(v) == seq]
    # une combinaison vue sur une seule source et identique à celle d'un autre code est une erreur probable : on ne la publie pas
    if len(accord) < 2 and any(list(c2['sequence']) == [DIR[k] for k in seq] for c2 in codes): seq, accord = [], []
    codes.append({'id': f'{cid}-{i + 1:02d}', 'cat': cid, 'nom': fr[0], 'effet': fr[1], 'deblocage': fr[2], 'nomEn': g['nom'].replace(' Cheat', ''),
                  'sequence': [DIR[k] for k in seq], 'confirme': len(accord) >= 2, 'sources': accord or [], 'argent': i == 0})
json.dump({'info': 'Codes de triche de GTA 6 (relevé du 22/11/2026). Sources : GTABase, GTA Wiki, gta6guide.fr. Généré par tools/codes.py.',
           'categories': [{'id': c[0], 'nom': c[1], 'icon': c[2], 'color': c[3]} for c in CATS.values()], 'codes': codes},
          open(os.path.join(ROOT, 'data', 'codes.json'), 'w'), ensure_ascii=False, indent=1)
print(len(codes), 'codes ·', sum(1 for c in codes if c['sequence']), 'combinaisons connues ·', sum(1 for c in codes if c['confirme']), 'confirmées par 2 sources ou plus')
