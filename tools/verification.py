"""Vérifie que chaque véhicule du guide existe bien dans GTA 6 (relevé du 22/11/2026).

Preuves retenues :
- Site officiel Rockstar (rockstargames.com/VI/editions) : 7 véhicules cités.
- GTA Wiki (gta.wiki) : page « Vehicles in GTA VI » + catégorie « Vehicles in GTA VI » (vendor/catalogue/gtawiki-vehicules-gta6.json).
- GTABase et gta6guide.fr : sources du catalogue (une seule ne suffit pas pour « confirmé »).
Écrit data/verification.json : statut « confirme » si GTA Wiki ou le site officiel le recensent, sinon « a-confirmer »."""
import json, os, re, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = [t for t in json.load(open(os.path.join(ROOT, 'vendor/catalogue/gtawiki-vehicules-gta6.json'))) if not t.startswith('Category:')]
CAT = json.load(open(os.path.join(ROOT, 'data/catalogue.json')))
OFFICIEL = {'vapid-stanier-55', 'grotti-cheetah-95', 'vapid-dominator-buggy', 'vapid-ganado', 'dinka-enduro', 'kayak-crest', 'shitzu-squalo'}

def n(s): return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', (s or '').lower()).encode('ascii', 'ignore').decode())
def base(s):
    s = re.sub(r'\(.*?\)', '', s); s = re.sub(r"'\d\d\b", '', s); s = re.sub(r'\b(classic|retro|custom)\b', '', s, flags=re.I)
    return n(s)
WB = {}
for t in W:
    WB.setdefault(base(t), t); WB.setdefault(n(t), t)

# noms différents entre GTABase et GTA Wiki (vérifiés à la main)
ALIAS = {
    'declasse-ambulance-90s': 'Ambulance', 'dinka-blista-85': 'Blista Compact', 'imponte-df8-90': 'DF8-90', 'willard-faction-custom-donk': 'Faction',
    'vulcar-ingot': 'Ingot', 'grotti-itali-gto': 'Itali GTO', 'lure-predator-l35p-police-boat': 'L35P (police)', 'ocelot-locust': 'Locust', 'canis-mesa': 'Mesa',
    'vapid-minivan': 'Minivan', 'hvy-mixer': 'Mixer (4-axle)', 'declasse-moonbeam': 'Moonbeam', 'lampadati-novak': 'Novak', 'dundreary-regina': 'Regina',
    'brute-rental-bus': 'Rental Shuttle Bus', 'vapid-sadler': 'Sadler', 'western-sovereign-107': 'Sovereign', 'zirconium-stratum': 'Stratum', 'obey-tailgater': 'Tailgater',
    'brute-utility-truck': 'Utility Truck', 'western-zombie-chopper': 'Zombie', 'albany-alpha': 'Alpha', 'ferry': 'Unnamed GTA VI ferry',
    'amloco': 'Unnamed GTA VI GE Genesis-inspired locomotive', 'rb-s-ii': 'Unnamed GTA VI RB-S II-inspired coast guard boat', 'ascot-paragon': 'Paragon R',
    'bottcher-police-buzzard': 'Buzzard (police)', 'bravado-police-cruiser-buffalo': 'Buffalo (police)', 'bravado-police-gauntlet-interceptor': 'Gauntlet Interceptor',
    'bravado-police-buffalo-stx-pursuit': 'Buffalo STX Pursuit', 'dundreary-police-landstalker-xl': 'Landstalker XL (police)', 'vapid-police-cruiser-stanier-le': 'Stanier G2 (police)',
    'vapid-police-ghost-stanier-le': 'Police Stanier G2', 'vapid-stanier-taxi': 'Stanier G2 (taxi)', 'vapid-tow-truck': 'Reclaimer (tow truck)',
    # nos fiches
    'pegassi-infernus': 'Infernus Classic', 'grotti-cheetah-95': 'Cheetah Classic', 'hydroglisseur': 'Airboat 09', 'jet-ski': 'Seashark', 'kayak-crest': 'Kayak',
    'jets-militaires': 'P-996 LAZER', 'helicoptere-toits': 'Maverick', 'bombora-s23': 'S23 CCS', 'lapwing-stolen-valor': 'Duster 300-H', 'hauners-ridgway': 'Ridgway',
    'vapid-stanier-55': 'Stanier (1955)', 'pfister-comet-s2': 'Comet S2 Cabrio', 'obey-tailgater-s': 'Tailgater S', 'maibatsu-penumbra-ff': 'Penumbra FF',
    'maibatsu-penumbra-shirley': 'Penumbra', 'vapid-dominator-buggy': 'Dominator Buggy', 'progen-emerus-royal-ruby': 'Emerus', 'imponte-phoenix-bloodbath': 'Phoenix',
    'mallard-flammes': 'Mallard', 'bravado-gauntlet-hellfire': 'Gauntlet Hellfire', 'dinka-enduro': 'Enduro', 'mammoth-dodo': 'Dodo', 'shitzu-squalo': 'Squalo',
    'vapid-ganado': 'Ganado', 'jobuilt-hauler': 'Hauler', 'imponte-ruiner': 'Ruiner', 'pegassi-tempesta': 'Tempesta', 'granforma-zorrusso': 'Zorrusso'}
# précisions affichées (variante ou détail non confirmé)
NOTES = {
    'lapwing-stolen-valor': "Le Lapwing Duster 300-H existe bien dans GTA 6 ; la livrée « Stolen Valor » n'est pas confirmée.",
    'progen-emerus-royal-ruby': "L'Emerus existe bien ; la version « Royal Ruby » vient des guides, pas encore du wiki.",
    'imponte-phoenix-bloodbath': "La Phoenix existe bien ; la version « Bloodbath » vient des guides, pas encore du wiki.",
    'vedette': 'Type de bateau générique : plusieurs hors-bords sont confirmés.', 'moto-sportive': 'Type de moto générique : plusieurs motos sportives sont confirmées.'}
GENERIQUES = {'vedette', 'moto-sportive'}

out = {}
def verifier(slug, modele):
    t = ALIAS.get(slug) or WB.get(base(modele)) or WB.get(n(modele))
    preuves = []
    if slug in OFFICIEL: preuves.append('Rockstar (site officiel)')
    if t and t in W: preuves.append('GTA Wiki')
    st = 'confirme' if preuves or slug in GENERIQUES else 'a-confirmer'
    return {'statut': st, 'preuves': preuves, 'wiki': t if t in W else None, 'note': NOTES.get(slug)}
for x in CAT['vehicules']: out[x['slug']] = verifier(x['slug'], x['modele'])
for v in json.load(open(os.path.join(ROOT, 'data/vehicules.json'))):
    m = re.sub(r"«.*?»|'\d\d|à flammes|dorée|de Shirley", '', v['nom']).strip().split(' ', 1)[-1]
    out[v['slug']] = verifier(v['slug'], m)
json.dump({'info': 'Vérification de présence dans GTA 6 (22/11/2026) : site officiel Rockstar, GTA Wiki, GTABase, gta6guide.fr. Généré par tools/verification.py.', 'vehicules': out},
          open(os.path.join(ROOT, 'data/verification.json'), 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(v['statut'] for v in out.values()))
print('à confirmer :', sorted(k for k, v in out.items() if v['statut'] != 'confirme'))
