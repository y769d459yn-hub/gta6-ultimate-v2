"""Traduction en français des textes d'Open GTA 6 Map (noms génériques et indications des joueurs).

Trois étages : formules répétées (règles), dictionnaire des phrases traduites à la main
(tools/traductions/descriptions.json, noms.json), noms propres laissés tels quels (enseignes, marques, titres)."""
import json, os, re
ICI = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ICI, 'traductions')
def _charge(f):
    p = os.path.join(D, f)
    return json.load(open(p)) if os.path.exists(p) else {}
DESC = _charge('descriptions.json')
NOMS = _charge('noms.json')

LIEU = r"([A-Z0-9][^.]*?)"
TYPES = {
    'gas station': 'Station-service', 'bar': 'Bar', 'marina': 'Marina', 'marina club': 'Club nautique', 'metro station': 'Station de métro',
    'metromover station': 'Station de Metromover', 'train station': 'Gare', 'hospital': 'Hôpital', 'police station': 'Commissariat',
    'fire station': 'Caserne de pompiers', 'fire rescue station': 'Caserne de pompiers', 'fire department': 'Caserne de pompiers',
    'pawn shop': 'Prêteur sur gages', 'nightclub': 'Boîte de nuit', 'club': 'Club', 'convenience store': 'Supérette', 'liquor store': "Magasin d'alcool",
    'grocery store': 'Épicerie', 'minimarket': 'Supérette', 'supermarket': 'Supermarché', '24/7 supermarket': 'Supérette 24/7', 'gym': 'Salle de sport',
    'hotel': 'Hôtel', 'motel': 'Motel', 'bridge': 'Pont', 'building': 'Bâtiment', 'deli': 'Traiteur', 'cafe': 'Café', 'café': 'Café',
    'fast food restaurant': 'Fast-food', 'restaurant': 'Restaurant', 'seafood restaurant': 'Restaurant de fruits de mer', 'barber shop': 'Barbier',
    'hair salon': 'Salon de coiffure', 'tattoo parlour': 'Salon de tatouage', 'tattoo parlor': 'Salon de tatouage', 'clothing store': 'Magasin de vêtements',
    'clothes shop': 'Magasin de vêtements', 'shoe store': 'Magasin de chaussures', 'gun store': 'Armurerie', 'gun shop': 'Armurerie',
    'pawn and gun shop': 'Prêteur sur gages et armurerie', 'airfield': 'Aérodrome', 'airport': 'Aéroport', 'car wash': 'Station de lavage',
    'jewelry store': 'Bijouterie', 'jewellery store': 'Bijouterie', 'bank': 'Banque', 'cinema': 'Cinéma', 'golf club': 'Golf', 'park': 'Parc',
    'church': 'Église', 'school': 'École', 'stadium': 'Stade', 'mall': 'Centre commercial', 'shopping mall': 'Centre commercial',
    'cabaret': 'Cabaret', 'strip club': 'Club de strip-tease', 'diner': 'Diner', 'pizzeria': 'Pizzeria', 'bakery': 'Boulangerie', 'pharmacy': 'Pharmacie',
    'warehouse': 'Entrepôt', 'garage': 'Garage', 'apartment building': 'Immeuble', 'beach': 'Plage', 'lighthouse': 'Phare', 'ferry terminal': 'Terminal de ferry',
    'electronics store': "Magasin d'électronique", 'electronics shop': "Magasin d'électronique", 'mod shop': 'Garage de tuning', 'car dealership': 'Concessionnaire',
    'dealership': 'Concessionnaire', 'trailer park': 'Parc de mobil-homes', 'rv park': 'Camping', 'bowling alley': 'Bowling', 'casino': 'Casino',
}
REGLES = [
    (r"^Its position is estimated from the trailers and screenshots\.$", "Position estimée d'après les bandes-annonces et les captures d'écran."),
    (r" Its position is estimated from the trailers and screenshots\.", " Position estimée d'après les bandes-annonces et les captures d'écran."),
    (r"^A member found (?:the )?(.+?) card here\.", r"Un joueur a trouvé la carte « \1 » ici."),
    (r"^A member found (.+?) here\.", r"Un joueur a trouvé ici : \1."),
    (r"^A member found (.+?) in it\.", r"Un joueur y a trouvé : \1."),
    (r", seen in Rockstar's (.+?) screenshots\.", r", visible dans les captures officielles de Rockstar (\1)."),
    (r", seen in the Extended Look\.", ", visible dans la vidéo « Extended Look »."),
]
ANGLAIS = re.compile(r"\b(the|and|with|you|is|are|of|to|in|on|at|seen|about|each|over|by|it|this|for|from|inside|behind|near|next|under|top|left|right|cocktails?|packs?|bags?)\b", re.I)
def _type_lieu(desc):
    m = re.match(r"^(?:A|An) ([a-z0-9/ ]+?) (in|on|at) (.+?)\.( .*)?$", desc)
    if not m: return None
    t = TYPES.get(m.group(1))
    if not t: return None
    prep = {'in': 'à' if not re.match(r"(the |Route|Historic)", m.group(3)) else 'sur', 'on': 'sur', 'at': 'à'}[m.group(2)]
    lieu = m.group(3).replace(', Vice City', ' (Vice City)').replace(', Vice Beach', ' (Vice Beach)').replace(', Leonida Keys', ' (Leonida Keys)')
    reste = traduire_desc(m.group(4).strip()) if m.group(4) else ''
    return f"{t} {prep} {lieu}." + (' ' + reste if reste else '')

def traduire_desc(d):
    """Indication de joueur → français (None si aucune traduction connue)."""
    if not d: return d
    if d in DESC: return DESC[d]
    # les champs déjà en français ajoutés par tools/opengta6map.py (« · Sécurité : … ») sont gardés
    tete, sep, queue = d.partition(' · ')
    if sep and tete in DESC: return DESC[tete] + ' · ' + queue
    t = _type_lieu(tete)
    if t and not ANGLAIS.search(t): return t + (' · ' + queue if sep else '')
    s = tete
    for a, b in REGLES: s = re.sub(a, b, s)
    if s != tete and not ANGLAIS.search(s): return s + (' · ' + queue if sep else '')
    return None

# ---------- noms ----------
POISSONS = {'American Eel': 'Anguille d’Amérique', 'Atlantic Herring': 'Hareng de l’Atlantique', 'Atlantic Spadefish': 'Forgeron atlantique',
    'Atlantic Tarpon': 'Tarpon de l’Atlantique', 'Black Drum': 'Grand tambour', 'Black Grouper': 'Mérou noir', 'Blue Striped Grunt': 'Gorette à rayures bleues',
    'Bluegill': 'Crapet arlequin', 'Candy Fish': 'Poisson bonbon', 'Channel Catfish': 'Barbue de rivière', 'Cobia': 'Cobia', 'Common Snook': 'Brochet de mer',
    'Florida Gar': 'Lépisosté de Floride', 'Great Barracuda': 'Grand barracuda', 'Greater Amberjack': 'Sériole couronnée', 'Green Moray Eel': 'Murène verte',
    'Hogfish': 'Labre capitaine', 'Lake Chubsucker': 'Sucet de lac', 'Largemouth Bass': 'Achigan à grande bouche', 'Littlehead Porgy': 'Daurade à petite tête',
    'Mahi-Mahi': 'Mahi-mahi', 'Permit': 'Pompaneau permit', 'Red Lionfish': 'Rascasse volante', 'Red Northern Snapper': 'Vivaneau rouge',
    'Redbreast Sunfish': 'Crapet rouge', 'Redfin Pickerel': 'Brochet d’Amérique', 'Salt Fish': 'Poisson salé', 'Sea Rock Bass': 'Bar de roche',
    'Spanish Mackerel': 'Thazard tacheté', 'Spotted Moray Eel': 'Murène tachetée', 'Stoplight Parrotfish': 'Poisson-perroquet feu', 'Striped Bass': 'Bar rayé',
    'Tiger Grouper': 'Mérou tigre', 'Yellowfin Tuna': 'Thon albacore', 'Yellowtail Snapper': 'Vivaneau à queue jaune'}
NOM_REGLES = [
    (r"^Hoop (\d+) - (.+)$", r"Panier \1 · \2"),
    (r"^Under the Bridge: (.+)$", r"Sous le pont : \1"),
    (r"^(.+?) Stunt Jump$", r"Saut de cascade : \1"), (r"^Stuns?t Jump (.+)$", r"Saut de cascade : \1"),
    (r"^(.+?) Base Jump$", r"Saut BASE : \1"), (r"^(.+?) Knife Flight$", r"Vol en rase-mottes : \1"),
    (r"^(.+?) Meditation$", r"Méditation : \1"), (r"^(.+?) Hunting Spot$", r"Coin de chasse : \1"),
    (r"^Hotspot - (.+)$", lambda m: "Coin de pêche : " + POISSONS.get(m.group(1), m.group(1))), (r"^Meteorite Fragments? ?(\(.+\))?$", r"Fragment de météorite \1"),
    (r"^Meteorite ?(\(.+\))?$", r"Météorite \1"), (r"^Yellow Loot Box$", "Caisse jaune"), (r"^Black Loot Box$", "Caisse noire"),
    (r"^Towable ATM$", "Distributeur à arracher"), (r"^Street Food Vendor$", "Vendeur de rue"), (r"^Produce Stall$", "Étal de fruits et légumes"),
    (r"^Boiled Peanuts Stand$", "Stand de cacahuètes bouillies"), (r"^Juice Stall$", "Stand de jus"), (r"^Refreshments Stand$", "Buvette"),
    (r"^Cafe$", "Café"), (r"^Bar$", "Bar"), (r"^Police Station$", "Commissariat"),
    (r"^(.+?) Police (?:Department|Station)$", r"Commissariat de \1"), (r"^(.+?) Hospital$", r"Hôpital de \1"),
    (r"^(.+?) Fire (?:Station|Department|Dept|Rescue Station|Rescue Dept)( \d+)?$", r"Pompiers de \1\2"),
    (r"^(.+?) Metro Station( \(.+\))?$", r"Station de métro \1\2"), (r"^(.+?) Metromover Station$", r"Station Metromover \1"),
    (r"^(.+?) Train Station$", r"Gare de \1"), (r"^(.+?) Gas Station( \(.+\))?$", r"Station-service \1\2"), (r"^(.+?) Station$", r"Gare de \1"), (r"^(.+?) Airfield$", r"Aérodrome de \1"),
    (r"^(.+?) Airport$", r"Aéroport de \1"), (r"^(.+?) Marina( \(.+\))?$", r"Marina de \1\2"),
    (r"^(.+?) Gas Station( \(.+\))?$", r"Station-service \1\2"), (r"^Gas Station$", "Station-service"),
    (r"^Message in a Bottle (\d+)$", r"Message dans une bouteille \1"), (r"^Book Swap (\d+)$", r"Boîte à livres \1"),
    (r"^Luxury Watch$", "Montre de luxe"), (r"^Luxury Watch: (.+)$", r"Montre de luxe : \1"), (r"^Luxury Watch \((.+)\)$", r"Montre de luxe (\1)"),
    (r"^SCOOP Container ?(\(.+\))?$", r"Conteneur SCOOP \1"), (r"^Parachute ?(\(.+\))?$", r"Parachute \1"),
    (r"^Cocaine Flamingo ?(\(.+\))?$", r"Flamant à cocaïne \1"), (r"^Ahol Street Art: (.+)$", r"Street art Ahol : \1"), (r"^Ahol Street Art$", "Street art Ahol"),
    (r"^(\d+) Mural: (.+)$", r"Fresque \1 : « \2 »"), (r"^(.+?) Treasure( \d+/\d+)?$", r"Trésor : \1\2"),
    (r"^Robbery Opportunity - (.+)$", r"Coup à faire : \1"), (r"^Safe - (.+)$", r"Coffre-fort · \1"), (r"^Locked Safe - (.+)$", r"Coffre verrouillé · \1"),
    (r"^Office Safe - (.+)$", r"Coffre de bureau · \1"), (r"^Warehouse Safe - (.+)$", r"Coffre d'entrepôt · \1"), (r"^RV Safe - (.+)$", r"Coffre de camping-car · \1"),
    (r"^(.+?) Safe - (.+)$", r"Coffre-fort (\1) · \2"),
    (r"^Opponent Pool - (.+)$", r"Billard contre un adversaire : \1"), (r"^Pool - (.+)$", r"Billard : \1"),
    (r"^Collectible Card$", "Carte à collectionner"), (r"^(.+?) card: (.+)$", r"Carte « \1 » : \2"), (r"^(.+?) card$", r"Carte « \1 »"),
    (r"^(.+?) \((Moses|Randy)'s? request\)$", r"\1 (demande de \2)"), (r"^(.+?) Rentals$", r"Location de véhicules · \1"),
    (r"^Pay 'n' Spray - (.+)$", r"Pay 'n' Spray · \1"), (r"^(.+?) Range$", r"Stand de tir : \1"),
    (r"^Hidden Package$", "Paquet caché"), (r"^Shipwreck$", "Épave"), (r"^Easter Egg: (.+)$", r"Clin d'œil : \1"),
    (r"^(.+?) - Cycling Trial$", r"\1 · épreuve à vélo"), (r"^(.+?) - Motocross Stunt Run$", r"\1 · parcours de motocross"),
    (r"^(.+?) - Oval Trial$", r"\1 · épreuve sur ovale"), (r"^(.+?) - Drag Trial$", r"\1 · course d'accélération"),
    (r"^(.+?) - Skid Loop$", r"\1 · boucle de dérapage"), (r"^(.+?) Ferry Terminal$", r"Terminal de ferry · \1"),
    (r"^(.+?) Outdoor Gym$", r"Salle de sport en plein air · \1"), (r"^(.+?) Gym$", r"Salle de sport · \1"),
    (r"^(.+?) Garage$", r"Garage · \1"), (r"^(.+?) Rooftop Bar$", r"Bar sur le toit · \1"), (r"^(.+?) Poolside Bar$", r"Bar de piscine · \1"),
]
COURSES = {'Raceway Trial': 'épreuve sur circuit', 'Speedway Trial': 'épreuve sur ovale', 'Basic Loop': 'boucle simple', 'Full Loop': 'boucle complète',
    'Intermediate Loop': 'boucle intermédiaire', 'Long Loop': 'grande boucle', 'Short Loop': 'petite boucle', 'Dragway Trial': "course d'accélération",
    'BMX Stunt Run': 'parcours acrobatique en BMX', 'Airport Run': "course de l'aéroport", 'Beach Blast': 'virée sur la plage', 'Freeway Run': "course sur l'autoroute",
    'Little Cuba Run': 'course de Little Cuba', 'Mural Tour': 'tour des fresques', 'Port Cruise': 'virée au port', 'Rialto Run': 'course des Rialto',
    'The Tunnel': 'le tunnel', 'Air Time Stunt Run': 'parcours de sauts', 'Big Mud': 'grosse boue', 'Dirt Slam': 'choc dans la terre', 'Dirt Track Trial': 'épreuve sur terre',
    'Figure 8 Blitz': 'circuit en huit', 'Hill Climb Trial': 'course de côte', 'Hog Hustle': 'course des cochons', 'Muck Scramble': 'mêlée dans la boue',
    'Sludge Rush': 'ruée dans la gadoue', 'Swamp Run Trial': 'épreuve du marais', 'Trash Dash': 'sprint dans la décharge', 'Red Canyon Run': 'course du canyon rouge',
    'Strip Mine': 'mine à ciel ouvert', 'Mountainside': 'flanc de montagne', 'Farm Tour': 'tour de la ferme', 'Log Jam': 'embâcle de troncs', 'Golf Tour': 'tour du golf'}
def _course(n):
    m = re.match(r"^(.+?) - (.+?)( CCW)?$", n)
    if m and m.group(2) in COURSES: return f"{m.group(1)} · {COURSES[m.group(2)]}" + (' (sens inverse)' if m.group(3) else '')
    return None
RARETE = {'Standard': 'standard', 'Silver': 'argent', 'Gold': 'or', 'Purple': 'violette', 'Deep Red': 'rouge foncé', 'Blue': 'bleue',
    'Red': 'rouge', 'Dusty Pink': 'rose poudré', 'Pink/Blue': 'rose et bleu', 'Green': 'verte', 'Black': 'noire', 'Holo': 'holographique'}
OBJETS = {'Mattress': 'Matelas', 'Cone': 'Cône', 'Fridge': 'Frigo', 'Chair': 'Chaise', 'Buckets': 'Seaux', 'Bucket': 'Seau', 'Pallet': 'Palette',
    'TV': 'Télé', 'Tires': 'Pneus', 'Tire': 'Pneu', 'Wheel': 'Roue', 'Couch': 'Canapé', 'Sofa': 'Canapé', 'Barrel': 'Baril', 'Door': 'Porte',
    'Toilet': 'Toilettes', 'Box': 'Carton', 'Boxes': 'Cartons', 'Shopping Cart': 'Caddie', 'Cart': 'Caddie', 'Sign': 'Panneau', 'Washer': 'Lave-linge',
    'Microwave': 'Micro-ondes', 'Lamp': 'Lampe', 'Table': 'Table', 'Bike': 'Vélo', 'Car': 'Voiture', 'Boat': 'Bateau', 'Trash Can': 'Poubelle',
    'Dumpster': 'Benne', 'Oven': 'Four', 'Stove': 'Cuisinière', 'Piano': 'Piano', 'Bathtub': 'Baignoire', 'Crate': 'Caisse', 'Drum': 'Bidon'}
PARENS = {'safe': 'coffre-fort', 'beach party': 'fête sur la plage', 'bus': 'bus', "lovers' camp": 'camp des amoureux', 'Garage': 'garage',
    'Dock Warehouse': 'entrepôt du quai', 'toilet': 'toilettes', 'island': 'île', 'VR Gamer house safe': 'coffre de la maison du joueur VR', 'Capri North': 'Capri nord', 'Capri South': 'Capri sud', 'beached whale': 'baleine échouée', 'chimney': 'cheminée', 'clinic': 'clinique', 'observatory': 'observatoire', 'Armory': 'armurerie', 'Lieutenant Room': 'chambre du lieutenant', 'Gold': 'or', 'Wyman kit car': 'voiture en kit Wyman',
    'Pink/Blue': 'rose et bleu', 'North': 'nord', 'South': 'sud', 'East': 'est', 'West': 'ouest', 'helicopter': 'hélicoptère', 'boat': 'bateau',
    'house': 'maison', 'roof': 'toit', 'rooftop': 'toit', 'bar': 'bar', 'motel': 'motel', 'pool': 'piscine', 'dock': 'ponton', 'garage': 'garage',
    'kitchen': 'cuisine', 'bedroom': 'chambre', 'bathroom': 'salle de bain', 'office': 'bureau', 'shed': 'cabane', 'trailer': 'caravane',
    'caravan': 'caravane', 'warehouse': 'entrepôt', 'basement': 'sous-sol', 'attic': 'grenier', 'porch': 'porche', 'yard': 'jardin', 'church': 'église'}
FIN = [
    (r'^Overheard Conversation(.*)$', r'Conversation surprise\1'),
    (r'^Magazine rack: (.+)$', r'Présentoir à magazines : \1'), (r"^Styling Magazine \(Lucia's make-up\)$", 'Magazine de style (maquillage de Lucia)'),
    (r'^Styling Magazine \(Waink scan\)$', 'Magazine de style (scan WAiNK)'), (r'^Styling Magazine: Beard Style$', 'Magazine de style : barbe'),
    (r'^Styling Magazine: Cowboy Horseshoe Mustache$', 'Magazine de style : moustache en fer à cheval'), (r'^Styling Magazine: Lucia Make-up$', 'Magazine de style : maquillage de Lucia'), (r'^Styling Magazine: Square Goatee \(Jason\)$', 'Magazine de style : bouc carré (Jason)'), (r'^Styling Magazine: (.+)$', r'Magazine de style : \1'),
    (r'^Styling Magazine(.*)$', r'Magazine de style\1'),
    (r'^"(.+)" Sign(.*)$', r'Panneau « \1 »\2'), (r'^Welcome to (.+) Sign$', r'Panneau « Welcome to \1 »'), (r'^(.+?) Sign(?: [·-] (.+))?$', lambda m: 'Panneau ' + m.group(1) + (' · ' + m.group(2) if m.group(2) else '')),
    (r'^(RON|Xero) Car Wash(.*)$', r'Station de lavage \1\2'), (r"^Méditation : Jason's House$", 'Méditation : maison de Jason'),
    (r'^Weed Bricks$', 'Briques de cannabis'),
    (r'^(.+) Rooftop Pool Bar$', r'Bar de piscine sur le toit · \1'), (r'^(.+) Balcony VIP Bar$', r'Bar VIP du balcon · \1'),
    (r'^(.+) VIP Bar$', r'Bar VIP · \1'), (r'^(.+) Hotel Bar$', r"Bar de l'hôtel · \1"), (r'^(.+) Pool Bar$', r'Bar de piscine · \1'),
    (r'^Courtyard Bar$', 'Bar de la cour'), (r'^Pills Stash(.*)$', r'Réserve de cachets\1'), (r'^Stash Bust$', 'Descente dans une planque'),
    (r'^(.+) Outdoor Bar$', r'Bar en plein air · \1'), (r'^(.+) Indoor Bar$', r'Bar intérieur · \1'), (r'^(.+) Beach Bar$', r'Bar de plage · \1'),
    (r'^(.+) Beachside Bar$', r'Bar de plage · \1'), (r'^(.+) Lobby Bar$', r'Bar du hall · \1'), (r'^(.+) Park Bar$', r'Bar · \1 Park'),
    (r'^(.+) Vineyard Bar$', r'Bar du vignoble · \1'), (r'^(.+) Museum Bar$', r'Bar du musée · \1 Museum'),
    (r'^(.+) Footbridge$', r'Passerelle \1'), (r'^(.+) Drawbridge( North| South| East| West)?$', r'Pont-levis \1\2'), (r'^(.+) Bridge$', r'Pont \1'),
    (r'^(.+) Stunt [Jj]ump$', r'Saut de cascade : \1'), (r'^(.+) Weed Stash$', r'Réserve de cannabis · \1'),
    (r'^Crystal Stash(.*)$', r'Réserve de cristal\1'), (r'^LSD Stash(.*)$', r'Réserve de LSD\1'), (r'^Shrooms Stash(.*)$', r'Réserve de champignons\1'),
    (r'^Weed Stash(.*)$', r'Réserve de cannabis\1'), (r'^Pawn Stash$', 'Planque du prêteur sur gages'), (r'^Small Weed Farm$', 'Petite plantation de cannabis'),
    (r'^Criminals: (.+)$', r'Criminels : \1'), (r'^Exotic Animals Front: Hidden Stash$', "Trafic d'animaux exotiques : planque cachée"),
    (r'^Garage · Final Chapter: (.+)$', r'Garage · chapitre final : \1'), (r'^Garage · Safe -\s*(.+)$', r'Garage · coffre-fort \1'),
    (r'^Station-service Safe - (.+)$', r'Coffre-fort de station-service · \1'), (r'^Gold Revolver$', 'Revolver en or'),
    (r"^Martha's 1922 Pistol$", 'Pistolet 1922 de Martha'), (r'^Money Bag & Deadringer 1922 Pistols$', 'Pistolets 1922 Money Bag et Deadringer'),
    (r'^Tattoo Magazine \((.+)\)$', r'Magazine de tatouage (\1)'), (r'^Stranded Race Driver$', 'Le pilote de course en panne'),
    (r'^Off the Hook (\d+)$', r'Magazine Off the Hook n° \1'), (r'^The Vault Radio (\d+)$', r'Radio du Vault n° \1'),
    (r'^The Sniper of La Perle (\d+)$', r'Le tireur de La Perle n° \1'), (r'^Top Fun Drones - (.+)$', r'Top Fun Drones · \1'),
]
SOUS = [('Industrial Weed Grow', 'plantation industrielle de cannabis'), ('Weed Grow', 'plantation de cannabis'), ('Backroom Weed Front', 'arrière-boutique à cannabis'),
    ('Watson Bay Safe House', 'planque de Watson Bay'), ('Stash House', 'planque'), ('Illegal Goods Store', 'magasin de marchandises illégales'),
    ('Ocean Beach Liquor Store', "magasin d'alcool d'Ocean Beach"), ('VR Gamer House', 'maison du joueur VR'), ('Gun Nut House', "maison du fou d'armes"),
    ('Wash House', 'blanchisserie'), ('Belpoint Shipwreck', 'épave de Belpoint'), ('Biker Hideout', 'repaire des bikers'),
    ('Canoes and Kayaks', 'loueur de canoës et kayaks'), ('Cigar Import Front', "façade d'import de cigares"), ('Drug Warehouse', 'entrepôt de drogue'),
    ('Exotic Animal Front', "façade d'animaux exotiques"), ('Illegal Sneaker Trade', 'trafic de baskets'), ('Room 115', 'chambre 115'), ('Farm Fix Meth Lab', 'labo de méth de Farm Fix'), ('Ocean Beach Lab', "labo d'Ocean Beach")]
def _finir(t):
    for a, b in FIN:
        if re.match(a, t): t = re.sub(a, b, t); break
    if re.match(r'^(Coffre|Criminels)', t):
        for a, b in SOUS: t = t.replace(' · ' + a, ' · ' + b).replace(' : ' + a, ' : ' + b)
    t = re.sub(r'\(([^()]+)\) ·', lambda m: '(' + PARENS.get(m.group(1), m.group(1)) + ') ·', t)
    m = re.match(r'^(Street art Ahol : )(.+?) (\d+)$', t)
    if m and m.group(2) in OBJETS: t = f"{m.group(1)}{OBJETS[m.group(2)]} {m.group(3)}"
    t = re.sub(r'\(([^()]+)\)$', lambda m: '(' + RARETE.get(m.group(1), PARENS.get(m.group(1), m.group(1))) + ')', t)
    t = re.sub(r'\((\$[\d,]+)\)', lambda m: '(' + m.group(1)[1:].replace(',', ' ') + ' $)', t)
    t = re.sub(r'^(\w[^·:]*?) - ([A-Z][^·]*)$', r'\1 · \2', t)
    return t
def traduire_nom(n):
    t = _finir(_traduire_nom(n))
    return t if t == n else re.sub(r"\b([Dd])e ([AEIOUÉ])", r"\1’\2", t)
def _traduire_nom(n):
    if n in NOMS: return NOMS[n]
    m = re.match(r'^Top Fun Drones - (.+)$', n)
    if m: return 'Top Fun Drones · ' + {'Capri Train Station': 'gare de Capri', 'Power Station South': 'centrale électrique sud', 'Power Station North': 'centrale électrique nord'}.get(m.group(1), m.group(1))
    if n.strip() in NOMS: return NOMS[n.strip()]
    c = _course(n)
    if c: return c
    for a, b in NOM_REGLES:
        if re.match(a, n): return re.sub(r'\s+', ' ', re.sub(a, b, n)).strip()
    return n
