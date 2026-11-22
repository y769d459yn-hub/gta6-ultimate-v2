"""Catalogue complet des véhicules de GTA 6 (en plus des 31 fiches détaillées du guide).

Sources (relevés du 22/11/2026, dans vendor/catalogue/) :
- GTABase, liste des véhicules confirmés par classe : marque, modèle, classe, modèle réel dont il s'inspire.
- gta6guide.fr, fiches véhicules : catégorie, places, comment l'obtenir quand c'est documenté, photo.
Photos : dépôt public xpbeats00-sudo/gta6-hq (meilleure résolution) sinon gta6guide.fr.

Usage : python3 tools/catalogue.py <dépôt gta6-hq> [--images]
  --images : télécharge et optimise les photos dans src/catalogue/ (sinon réutilise celles déjà présentes)."""
import csv, json, os, re, subprocess, sys, unicodedata
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HQ = sys.argv[1]
IMAGES = '--images' in sys.argv
GB = json.load(open(os.path.join(ROOT, 'vendor/catalogue/gtabase-classes.json')))
G6 = json.load(open(os.path.join(ROOT, 'vendor/catalogue/gta6guide.json')))
VEH = json.load(open(os.path.join(ROOT, 'data/vehicules.json')))
OUT_IMG = os.path.join(ROOT, 'src', 'catalogue')

def norm(s): return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', (s or '').lower()).encode('ascii', 'ignore').decode())
def slug(s): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode())).strip('-')

# classe GTABase -> (libellé, type du guide)
CLASSES = {
    'boats': ('Bateau', 'bateaux'), 'commercial': ('Utilitaire', 'autres'), 'compacts': ('Compacte', 'voitures'), 'coupes': ('Coupé', 'voitures'),
    'cycles': ('Vélo', 'motos'), 'emergency': ('Urgences', 'autres'), 'helicopters': ('Hélicoptère', 'avions'), 'industrial': ('Industriel', 'autres'),
    'military': ('Militaire', 'autres'), 'motorcycles': ('Moto', 'motos'), 'muscle': ('Muscle car', 'voitures'), 'off-road': ('Tout-terrain', 'voitures'),
    'planes': ('Avion', 'avions'), 'sedans': ('Berline', 'voitures'), 'service': ('Service', 'autres'), 'sports': ('Sportive', 'voitures'),
    'sports-classic': ('Sportive classique', 'voitures'), 'super': ('Supercar', 'voitures'), 'suvs': ('SUV', 'voitures'), 'utility': ('Utilitaire', 'autres'), 'vans': ('Van', 'autres')
}
G6CAT = {
    'Supercars & Sports': ('Sportive', 'voitures'), 'Muscle Cars & Classiques': ('Muscle car', 'voitures'), 'Berlines, Coupés & Familiales': ('Berline', 'voitures'),
    'SUV & Off-Road': ('SUV', 'voitures'), 'Vans, Utilitaires & Industriels': ('Utilitaire', 'autres'), 'Bateaux & Nautiques': ('Bateau', 'bateaux'),
    'Motos, Scooters & Vélos': ('Moto', 'motos'), 'Avions & Hélicoptères': ('Avion', 'avions'), "Urgences & Forces de l'ordre": ('Urgences', 'autres'),
    'Transports publics & Trains': ('Transport', 'autres')
}
# nos 31 fiches : leur équivalent dans les catalogues (pour ne pas les dupliquer et compléter leurs infos)
NOS = {
    'pegassi-infernus': 'infernusclassic', 'bravado-gauntlet-hellfire': 'gauntlethellfire', 'maibatsu-penumbra-ff': 'penumbraff97',
    'progen-emerus-royal-ruby': 'emerus', 'imponte-phoenix-bloodbath': 'phoenix77', 'mallard-flammes': 'mallard', 'hydroglisseur': 'airboatfanboat',
    'jet-ski': 'seashark', 'dinka-enduro': 'enduro72', 'kayak-crest': 'kayak', 'mammoth-dodo': 'dodo', 
    'shitzu-squalo': 'squalo', 'bombora-s23': 's23ccs', 'vapid-stanier-55': 'stanier55', 'grotti-cheetah-95': 'cheetah95',
    'vapid-dominator-buggy': 'dominator67buggy', 'vapid-ganado': 'ganado70', 'pfister-comet-s2': 'comets2cabrio', 'jobuilt-hauler': 'hauler',
    'obey-tailgater-s': 'tailgaters', 'imponte-ruiner': 'ruiner82', 'maibatsu-penumbra-shirley': 'penumbra', 'pegassi-tempesta': 'tempesta',
    'granforma-zorrusso': 'zorrusso'
}
DEJA = set(NOS.values())
# doublons de gta6guide.fr (noms traduits de véhicules déjà listés par GTABase)
DOUBLONS_G6 = {'bravado-buffalo-stx-pursuit-de-police', 'bravado-gauntlet-interceptor-de-police', 'bravado-voiture-de-patrouille-buffalo', 'brute-camion-utilitaire',
    'brute-navette-de-location', 'brute-riot-de-police', 'buckingham-maverick-de-police', 'dundreary-landstalker-xl-de-police', 'hvy-chariot-elevateur', 'hvy-dozer',
    'jacksheepe-pelle-mecanique', 'mtl-camion-de-pompiers', 'nagasaki-buzzard-de-police', 'pegassi-tempesta-de-police', 'vapid-depanneuse', 'vapid-ghost-de-police-stanier-le',
    'vapid-lowline-de-police-interceptor', 'vapid-montagne-de-police', 'vapid-voiture-de-patrouille-stanier-le', 'dinka-blista-compact', 'invetero-coquette-classic',
    'pfister-comet-retro-custom', 'bravado-gauntlet-classic', 'bravado-youga-classic', 'lure-predator-s23'}
# véhicules sans nom dans le jeu, désignés par leur vraie marque : on ne les présente pas comme des véhicules de GTA 6
VRAIES_MARQUES = re.compile(r'^(Azimut|Bavaria|BTN|Frauscher|Highfield|Lurssen|Shipyard|Crusader|Skater|Mercedes|Suzuki|Audi|Ford|International|Chevrolet|Dodge|Hitachi|Lamborghini|Buick|Toyota|Honda|Porsche|BMW|Nissan)\b', re.I)

# ---------- fusion ----------
g6_par_modele = {}
for o in G6:
    full = o['nom'].strip()
    fab = o['fabricant'] if o['fabricant'] and 'Non document' not in o['fabricant'] else None
    modele = full[len(fab):].strip() if fab and full.startswith(fab) else full
    g6_par_modele.setdefault(norm(modele), o)
    g6_par_modele.setdefault(norm(full), o)

cat = {}
for v in GB:
    fab = v['fabricant'] if v['fabricant'] not in ('-', '') else None
    modele = v['nom'].strip()
    k = norm(modele)
    if k in cat or VRAIES_MARQUES.match(modele): continue
    cl, ty = CLASSES.get(v['classe'], ('Véhicule', 'autres'))
    e = {'cle': k, 'fabricant': fab, 'modele': modele, 'classe': cl, 'type': ty, 'inspiration': v.get('base') or None,
         'sources': [{'nom': 'GTABase', 'url': f"https://www.gtabase.com/fr/articles/gta-6/gta-6-list-of-confirmed-vehicles-by-class?class={v['classe']}"}]}
    o = g6_par_modele.get(k) or g6_par_modele.get(norm((fab or '') + modele))
    if o:
        e['g6'] = o
        e['sources'].append({'nom': 'gta6guide.fr', 'url': o['url']})
    cat[k] = e
# véhicules présents seulement sur gta6guide.fr, avec une marque du jeu (on écarte les noms de vraies marques)
for o in G6:
    fab = o['fabricant'] if o['fabricant'] and 'Non document' not in o['fabricant'] else None
    if not fab: continue
    full = o['nom'].strip(); modele = full[len(fab):].strip() if full.startswith(fab) else full
    k = norm(modele)
    if k in cat or norm(full) in cat: continue
    proches = [x for x in cat if x.startswith(k) and len(k) >= 4]
    if proches:
        cible = cat[sorted(proches, key=len)[0]]
        if 'g6' not in cible: cible['g6'] = o; cible['sources'].append({'nom': 'gta6guide.fr', 'url': o['url']})
        continue
    cl, ty = G6CAT.get(o['categorie'], ('Véhicule', 'autres'))
    cat[k] = {'cle': k, 'fabricant': fab, 'modele': modele, 'classe': cl, 'type': ty, 'inspiration': o.get('inspiration'), 'g6': o,
              'sources': [{'nom': 'gta6guide.fr', 'url': o['url']}]}

# ---------- infos pour nos 31 fiches ----------
infos31 = {}
for s, k in NOS.items():
    e = cat.get(k)
    if e: infos31[s] = {'fabricant': e['fabricant'], 'classe': e['classe'], 'inspiration': e['inspiration'], 'places': (e.get('g6') or {}).get('places'), 'sources': e['sources']}

# ---------- photos ----------
ORIG = {}
with open(os.path.join(HQ, 'docs/compliance/media-hashes.csv'), newline='') as f:
    for r in csv.DictReader(f): ORIG[r['file']] = r['source']
hq_files = {os.path.splitext(f)[0]: f for f in os.listdir(os.path.join(HQ, 'images/vehicles'))}
os.makedirs(OUT_IMG, exist_ok=True)

def credit_hq(rel):
    s = ORIG.get(rel, ''); url = next((w.strip('",') for w in s.split() if w.startswith('http')), '')
    for dom, n in [('gtabase.com', 'GTABase'), ('tracker.gg', 'Tracker.gg'), ('gta.wiki', 'GTA Wiki'), ('rockstargames.com', 'Rockstar Games')]:
        if dom in url: return ('Rockstar Games' if n == 'Rockstar Games' else f'Rockstar Games, via {n}'), url
    return 'Rockstar Games', url

def enregistrer(src_img, dest):
    im = Image.open(src_img).convert('RGB')
    im.thumbnail((960, 960))
    im.save(dest, 'WEBP', quality=78, method=6)

liste = []
for k, e in sorted(cat.items(), key=lambda kv: ((kv[1]['fabricant'] or '~'), kv[1]['modele'])):
    if k in DEJA: continue
    nom0 = f"{e['fabricant']} {e['modele']}" if e['fabricant'] and not e['modele'].startswith(e['fabricant']) else e['modele']
    if slug(nom0) in DOUBLONS_G6: continue
    nom = f"{e['fabricant']} {e['modele']}" if e['fabricant'] and not e['modele'].startswith(e['fabricant']) else e['modele']
    sl = slug(nom)
    o = e.get('g6') or {}
    obtenir = o.get('obtenir') if o.get('obtenir') and 'Non document' not in o.get('obtenir') else None
    item = {'slug': sl, 'nom': nom, 'fabricant': e['fabricant'], 'modele': e['modele'], 'classe': e['classe'], 'type': e['type'],
            'inspiration': e['inspiration'] if e['inspiration'] and e['inspiration'] not in ('-', '') else None,
            'places': o.get('places') if o.get('places') and o.get('places').isdigit() else None,
            'obtenir': obtenir, 'sources': e['sources']}
    # photo : gta6-hq d'abord (meilleure résolution), sinon gta6guide.fr
    dest = os.path.join(OUT_IMG, sl + '.webp')
    hq = hq_files.get(sl) or hq_files.get(slug(e['modele']))
    if hq:
        rel = 'images/vehicles/' + hq
        if IMAGES or not os.path.exists(dest): enregistrer(os.path.join(HQ, rel), dest)
        item['img'] = sl + '.webp'; item['credit'], item['creditUrl'] = credit_hq(rel)
    elif o.get('img'):
        if IMAGES or not os.path.exists(dest):
            tmp = dest + '.dl'
            subprocess.run(['curl', '-s', '-L', '-m', '30', '-A', 'Mozilla/5.0', '-o', tmp, o['img']])
            try: enregistrer(tmp, dest)
            except Exception: pass
            if os.path.exists(tmp): os.remove(tmp)
        if os.path.exists(dest): item['img'] = sl + '.webp'; item['credit'], item['creditUrl'] = 'gta6guide.fr', o['url']
    liste.append(item)

# ménage : photos qui ne servent plus
utiles = {x['img'] for x in liste if x.get('img')}
for f in os.listdir(OUT_IMG):
    if f not in utiles: os.remove(os.path.join(OUT_IMG, f))
json.dump({'info': 'Catalogue des véhicules confirmés de GTA 6, hors fiches détaillées. Sources : GTABase et gta6guide.fr (relevés du 22/11/2026). Généré par tools/catalogue.py.',
           'vehicules': liste, 'fiches': infos31}, open(os.path.join(ROOT, 'data/catalogue.json'), 'w'), ensure_ascii=False, indent=1)
print(len(liste), 'véhicules au catalogue ·', sum(1 for x in liste if x.get('img')), 'avec photo ·', sum(1 for x in liste if x['obtenir']), 'avec « comment l’obtenir » ·', len(infos31), 'fiches complétées')
print('non retrouvés :', [s for s, k in NOS.items() if k not in cat])
