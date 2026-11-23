"""Noms des lieux de la communauté (GTADB) → français : écrit tools/traductions/communaute.json, lu par scripts/build.mjs.
Les noms propres (enseignes, quartiers, rues) restent comme dans le jeu ; seuls les mots génériques sont traduits."""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXACT = {
 'Airfield': 'Aérodrome', 'Bridge': 'Pont', 'Boat Ramp': 'Mise à l’eau', 'Bus Loop': 'Boucle de bus', 'Bus Parking Lot': 'Parking des bus', 'Bus Station': 'Gare routière',
 'Bus Stop': 'Arrêt de bus', 'Canal': 'Canal', 'Car Park': 'Parking', 'Casino': 'Casino', 'Cell Tower': 'Antenne relais', 'Cell Tower Lot': 'Terrain de l’antenne relais',
 'Church': 'Église', 'Construction Site': 'Chantier', 'Control Tower': 'Tour de contrôle', 'Covered Grandstands': 'Tribunes couvertes', 'Covered Parking Lot': 'Parking couvert',
 'Dam': 'Barrage', 'Dock Ring': 'Anneau du quai', 'Dry Dock': 'Cale sèche', 'Empty Lot': 'Terrain vague', 'Excavator Parking Lot': 'Parking des pelleteuses', 'Factory': 'Usine',
 'Fake Tunnel Mural': 'Fresque du faux tunnel', 'Fence': 'Clôture', 'Fire Station': 'Caserne de pompiers', 'Football Stadium': 'Stade de football américain', 'Footbridge': 'Passerelle',
 'Gas Station': 'Station-service', 'Gate Building': 'Bâtiment de l’entrée', 'Grandstands': 'Tribunes', 'Guard Booth': 'Guérite', 'Hangar': 'Hangar', 'Hospital': 'Hôpital',
 'Interchange': 'Échangeur', 'Lake': 'Lac', 'Lifeguard Tower': 'Poste de maître-nageur', 'Lighthouse': 'Phare', 'Liquor Store': 'Magasin d’alcool', 'Lock': 'Écluse',
 'Main Gate': 'Entrée principale', 'Main Prison Building': 'Bâtiment principal de la prison', 'Marina': 'Marina', 'Metro Mover Station': 'Station Metromover', 'Metro Station': 'Station de métro',
 'Mexican Restaurant': 'Restaurant mexicain', 'Office Building': 'Immeuble de bureaux', 'Park': 'Parc', 'Parking Garage': 'Parking couvert', 'Parking Lot': 'Parking', 'Pawn Shop': 'Prêteur sur gages',
 'Pharmacy': 'Pharmacie', 'Pier': 'Jetée', 'Pool': 'Piscine', 'Port': 'Port', 'Prison': 'Prison', 'Prison Building': 'Bâtiment de la prison', 'Radar Tower': 'Tour radar', 'Radio Mast': 'Mât radio',
 'Radio Tower': 'Tour radio', 'River': 'Rivière', 'Riverbank': 'Berge', 'Service Gate': 'Entrée de service', 'Sewage Treatment Plant': 'Station d’épuration', 'Soccer Field': 'Terrain de football',
 'Baseball Field': 'Terrain de baseball', 'Beach Volleyball': 'Beach-volley', 'Submerged Tank': 'Réservoir immergé', 'Tank': 'Réservoir', 'Tennis Court': 'Court de tennis', 'Tennis Courts': 'Courts de tennis',
 'Tennis Stadium': 'Stade de tennis', 'Trailer Park': 'Parc de mobile homes', 'Train Bridge': 'Pont ferroviaire', 'Train Station': 'Gare', 'Train Tunnel': 'Tunnel ferroviaire',
 'Transformer Station': 'Poste électrique', 'Tunnel': 'Tunnel', 'Tunnel Entrance': 'Entrée du tunnel', 'Turn ': 'Virage', 'Underwater Research Station': 'Station de recherche sous-marine',
 'Underwater Ruins': 'Ruines sous-marines', 'Warehouse': 'Entrepôt', 'Water Tank': 'Réservoir d’eau', 'Water Tower': 'Château d’eau', 'Weather Radar': 'Radar météo', 'Welcome Sign': 'Panneau de bienvenue',
 'Big House': 'La grande maison', 'National Coast Guard': 'Garde-côtes', 'The Atoll': 'L’atoll', 'Archipelago (N)': 'Archipel (nord)', 'Archipelago (S)': 'Archipel (sud)',
 '"Blue House"': '« Maison bleue »', '"White House"': '« Maison blanche »', '"Yellow House"': '« Maison jaune »', '"House B"': '« Maison B »', '"House C"': '« Maison C »', '"House D"': '« Maison D »',
 '"Mount Mountain"': '« Mont Montagne »', "Jason's House": 'Maison de Jason', 'Spaceship House': 'La maison vaisseau spatial', 'Air Force Radar Station': 'Station radar de l’armée de l’air',
 'Allied Air Hangar': 'Hangar Allied Air', 'Weather': 'Météo', 'Vice City Hall': 'Hôtel de ville de Vice City', 'Vice City Hospital': 'Hôpital de Vice City', 'Vice Beach Welcome Mural': 'Fresque de bienvenue de Vice Beach',
 'Brian\'s Marina Boat Racks': 'Racks à bateaux de la marina de Brian', "Brian's Marina Workshop": 'Atelier de la marina de Brian', 'Port Gellhorn Smokestack': 'Cheminée de Port Gellhorn',
 'Grassrivers Visitor Center': 'Centre d’accueil des Grassrivers', 'Vice City Casino Racetrack': 'Hippodrome du casino de Vice City', 'Mile Zero Air Station': 'Base aérienne de Mile Zero',
 'Sundown Private Airfield': 'Aérodrome privé de Sundown', 'Southpoint Airfield': 'Aérodrome de Southpoint', 'Rockridge Neighborhood Service Center': 'Centre de services de Rockridge',
 'Donovan Roeder Jr. Community Center': 'Centre social Donovan Roeder Jr.', 'Autograph Flight Support Building': 'Bâtiment de l’aviation Autograph', 'City Picnic Market': 'Marché City Picnic',
 'PTT YOUNGIN$ Illegal Goods Store': 'PTT YOUNGIN$ : magasin de marchandises illégales', 'Motorcycle Customs Shop': 'Atelier de motos custom', 'Little Cuba Souvenir Shop': 'Boutique de souvenirs de Little Cuba',
 'Ocean Beach Pharmacy': 'Pharmacie d’Ocean Beach', 'Leonard County Sheriff\'s Office': 'Bureau du shérif de Leonard County', 'City of Vice Fire Rescue Station': 'Caserne de pompiers de la ville de Vice',
 'Capri City Jackals Stadium': 'Stade des Capri City Jackals', 'Evergreen Mall Sign': 'Panneau Evergreen Mall', 'Gator Plaza Sign': 'Panneau Gator Plaza', 'Juice Fruit Sign': 'Panneau Juice Fruit',
 'Starlet Motel Sign': 'Panneau du Starlet Motel', 'Gellhorn Roadhouse Sign': 'Panneau du Gellhorn Roadhouse', 'Vice City Sign': 'Panneau Vice City',
 'Welcome to Port Gellhorn Sign': 'Panneau « Welcome to Port Gellhorn »', '"Welcome to Hamlet" Sign': 'Panneau « Welcome to Hamlet »', 'Hamlet Water Tower': 'Château d’eau de Hamlet',
 'Watson Bay Water Tower': 'Château d’eau de Watson Bay', 'Port VC Tunnel': 'Tunnel de Port VC', 'Port Vice City Tunnel': 'Tunnel de Port Vice City', 'Fuzzard Drain Canal': 'Canal de drainage Fuzzard',
 'X Hotel Parking Lot': 'Parking du X Hotel', 'Banner Parking Garage': 'Parking couvert Banner', 'Ficroth Capital Garage': 'Parking Ficroth Capital', 'Paradise Garage': 'Garage Paradise',
 '24/7 Supermarket': 'Supermarché 24/7', '247 Supermarket': 'Supermarché 247', 'Mami\'s Grocery Market': 'Épicerie de Mami', 'Palometa Seafood Restaurant': 'Restaurant de fruits de mer Palometa',
 'Office': 'Bureau', "Brian's Boat Works & Marina": "Brian's Boat Works & Marina", 'Gallery': 'Galerie', 'Shoreline Park': 'Parc de Shoreline', 'Temple Park': 'Temple Park', 'Tequesta Retreat Park': 'Parc de Tequesta Retreat',
}
REGLES = [
 (r'^"(.+) Bridge"$', r'« Pont \1 »'), (r'^"(.+) River"$', r'« Rivière \1 »'), (r'^(.+) Gas Station$', r'Station-service \1'),
 (r'^Turn (\w+)$', r'Virage \1'), (r'^Container Crane [#(](\d+)\)?$', r'Grue à conteneurs n° \1'), (r'^Prison Tower \((\d+)\)$', r'Mirador de la prison n° \1'),
 (r'^Autograph Hangar (\d+)$', r'Hangar Autograph n° \1'), (r'^Fuzzard Power Station \((\d)\)$', r'Centrale électrique Fuzzard n° \1'),
 (r'^Fuzzard Power Station \(N\)$', 'Centrale électrique Fuzzard (nord)'), (r'^Fuzzard Power Station \(S\)$', 'Centrale électrique Fuzzard (sud)'),
 (r'^(.+) North Tower$', r'\1, tour nord'), (r'^(.+) South Tower$', r'\1, tour sud'), (r'^(.+) West Tower$', r'\1, tour ouest'),
 (r'^(.+) Police Department$', r'Police de \1'), (r'^(.+) Metro Mover Station$', r'Station Metromover \1'), (r'^(.+) Metro Station$', r'Station de métro \1'),
 (r'^(.+) Train Station$', r'Gare de \1'), (r'^(.+) Station$', r'Gare de \1'), (r'^(.+) Control Tower$', r'Tour de contrôle \1'),
 (r'^(.+) Gas Station$', r'Station-service \1'), (r'^(.+) Bridge"?$', r'Pont \1'), (r'^"(.+) Bridge"$', r'« Pont \1 »'),
 (r'^(.+) Marina$', r'Marina de \1'), (r'^(.+) Hospital$', r'Hôpital \1'), (r'^(.+) Barber Shop$', r'Barbier \1'), (r'^(.+) Body Shop$', r'Carrosserie \1'),
 (r'^(.+) Skate Shop$', r'Skateshop \1'), (r'^(.+) Pharmacy$', r'Pharmacie \1'),
 (r'^Lake (.+)$', r'Lac \1'), (r'^(.+) Lake$', r'Lac \1'), (r'^(.+) River"?$', r'Rivière \1'), (r'^"(.+) River"$', r'« Rivière \1 »'),
 (r'^(.+) Bay$', r'Baie de \1'), (r'^"(.+) Hill"$', r'« Colline \1 »'), (r'^"(.+) Island"$', r'« Île \1 »'), (r'^"Mount (.+)"$', r'« Mont \1 »'),
 (r'^(.+) Islands$', r'Îles \1'), (r'^(.+) Island$', r'Île \1'), (r'^(.+) Construction$', r'\1 (chantier)'),
]
def elision(t):
    return re.sub(r"\b([Dd])e ([AEIOUÉ])", r"\1’\2", t)
def traduire(n):
    if n in EXACT: return EXACT[n]
    for a, b in REGLES:
        if re.match(a, n): return elision(re.sub(a, b, n))
    return n
if __name__ == '__main__':
    C = json.load(open(os.path.join(ROOT, 'docs', 'data', 'communaute.json')))['lieux']
    m = {}
    for l in C:
        t = traduire(l['n'])
        if t != l['n']: m[l['n']] = t
    json.dump(dict(sorted(m.items())), open(os.path.join(ROOT, 'tools', 'traductions', 'communaute.json'), 'w'), ensure_ascii=False, indent=0)
    print(len(m), 'noms traduits')
    for k in list(m)[::12]: print(k, '→', m[k])
