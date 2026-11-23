"""Catalogue complet des véhicules de GTA 6, rangé par catégorie, avec la photo la plus nette disponible.

Sources (relevés du 22/11/2026, dans vendor/catalogue/) :
- gtabase-fiches.json : fiches GTABase (classe, marque, places, vraie voiture, poids, transmission, rapports, autres jeux, photo d'origine).
- gta6guide.json : fiches gta6guide.fr (catégorie, « comment l'obtenir », photo).
Photos candidates pour chaque véhicule : GTABase (original), dépôt public xpbeats00-sudo/gta6-hq, gta6guide.fr.
La photo retenue est la plus nette (variance du laplacien à taille égale, pénalité pour les petites images).

Usage : python3 tools/catalogue.py <dépôt gta6-hq> <dossier cache images> [--images]"""
import csv, json, os, re, subprocess, sys, unicodedata
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HQ, CACHE = sys.argv[1], sys.argv[2]
IMAGES = '--images' in sys.argv
GBF = json.load(open(os.path.join(ROOT, 'vendor/catalogue/gtabase-fiches.json')))
G6 = json.load(open(os.path.join(ROOT, 'vendor/catalogue/gta6guide.json')))
PHOTOS31 = json.load(open(os.path.join(ROOT, 'data/photos.json')))
OUT_IMG = os.path.join(ROOT, 'src', 'catalogue')
os.makedirs(OUT_IMG, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

def norm(s): return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', (s or '').lower()).encode('ascii', 'ignore').decode())
def slug(s): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode())).strip('-')

# ---------- catégories (ordre d'affichage) ----------
GROUPES = [  # id, libellé, type (filtre), classes GTABase
    ('supercars', 'Supercars', 'voitures', ['super']), ('sportives', 'Sportives', 'voitures', ['sports']),
    ('sportives-classiques', 'Sportives classiques', 'voitures', ['sports-classic']), ('muscle', 'Muscle cars', 'voitures', ['muscle']),
    ('coupes', 'Coupés', 'voitures', ['coupes']), ('berlines', 'Berlines', 'voitures', ['sedans', 'compacts']),
    ('suv', 'SUV', 'voitures', ['suvs']), ('tout-terrain', 'Tout-terrain', 'voitures', ['off-road']),
    ('motos', 'Motos', 'motos', ['motorcycles']), ('velos', 'Vélos', 'motos', ['cycles']),
    ('bateaux', 'Bateaux', 'bateaux', ['boats']), ('helicopteres', 'Hélicoptères', 'avions', ['helicopters']), ('avions', 'Avions', 'avions', ['planes']),
    ('urgences', 'Police et urgences', 'autres', ['emergency']), ('militaires', 'Militaires', 'autres', ['military']),
    ('vans', 'Vans et fourgons', 'autres', ['vans']), ('utilitaires', 'Utilitaires', 'autres', ['commercial', 'utility']),
    ('industriels', 'Industriels', 'autres', ['industrial']), ('service', 'Taxis, bus et service', 'autres', ['service'])]
PAR_CLASSE = {c: g for g in GROUPES for c in g[3]}
PRIORITE = ['emergency', 'military', 'helicopters', 'planes', 'boats', 'cycles', 'motorcycles']  # une voiture de police va dans « Police »

# nos 31 fiches détaillées -> catégorie (+ fiche GTABase correspondante quand elle existe)
NOS = {
    'pegassi-infernus': ('sportives-classiques', 'infernus96'), 'bravado-gauntlet-hellfire': ('muscle', 'gauntlethellfire'), 'maibatsu-penumbra-ff': ('sportives', 'penumbraff97'),
    'progen-emerus-royal-ruby': ('supercars', 'emerus'), 'imponte-phoenix-bloodbath': ('muscle', 'phoenix77'), 
    'mallard-flammes': ('avions', 'mallard'), 'lapwing-stolen-valor': ('avions', None), 'hauners-ridgway': ('tout-terrain', None),
    'hydroglisseur': ('bateaux', 'airboatfanboat'), 'jet-ski': ('bateaux', 'seashark'), 'vedette': ('bateaux', None), 'moto-sportive': ('motos', None),
    'dinka-enduro': ('motos', 'enduro72'), 'kayak-crest': ('bateaux', 'kayak'), 'mammoth-dodo': ('avions', 'dodo'), 'jets-militaires': ('avions', None),
    'helicoptere-toits': ('helicopteres', None), 'shitzu-squalo': ('bateaux', 'squalo'), 'bombora-s23': ('bateaux', 's23ccs'),
    'vapid-stanier-55': ('berlines', 'stanier55'), 'grotti-cheetah-95': ('sportives-classiques', 'cheetah95'), 'vapid-dominator-buggy': ('tout-terrain', 'dominator67buggy'),
    'vapid-ganado': ('muscle', 'ganado70'), 'pfister-comet-s2': ('sportives', 'comets2cabrio'), 'jobuilt-hauler': ('utilitaires', 'hauler'),
    'obey-tailgater-s': ('berlines', 'tailgaters'), 'imponte-ruiner': ('muscle', 'ruiner82'), 'maibatsu-penumbra-shirley': ('sportives', 'penumbra'),
    'pegassi-tempesta': ('supercars', 'tempesta'), 'granforma-zorrusso': ('supercars', 'zorrusso')}
DEJA = {k for _, k in NOS.values() if k}
VRAIES_MARQUES = re.compile(r'^(Azimut|Bavaria|BTN|Frauscher|Highfield|Lurssen|Shipyard|Crusader|Skater|Mercedes|Suzuki|Audi|Ford|International|Chevrolet|Dodge|Hitachi|Lamborghini|Buick|Toyota|Honda|Porsche|BMW|Nissan|GE|Sea Ray)\b', re.I)
# photos vérifiées à l'œil et écartées (floues, trop sombres, véhicule masqué ou illustration) : le véhicule garde sa silhouette
PHOTOS_REJETEES = {
    'obey-omnis-e-gt', 'vapid-caracara', 'dingus-como', 'declasse-granger', 'ubermacht-sentinel-xs', 'bravado-gauntlet-custom-69', 'vapid-slamvan-56',
    'willard-lasso-90', 'grotti-itali-gto', 'osprey-journey-78', 'vapid-dominator-gtx', 'mer-can-blast', 'pegassi-speeder', 'buckingham-windsor',
    'mammoth-streamer216', 'pegassi-bati-801', 'rb-s-ii', 'vapid-sandking-xl', 'obey-tailgater', 'lampadati-novak', 'vapid-liberator', 'vapid-stanier-98',
    'brute-tipper-6-wheels', 'canis-seminole-frontier', 'ubermacht-apoc', 'swamp-blaster', 'nagasaki-tao', 'maibatsu-caddy-82', 'maibatsu-iota',
    'endurex-race-bike', 'principe-lectro', 'metromule', 'bravado-dorado', 'dinka-b3000-excavator', 'hvy-airtug', 'fishing-boat', 'karin-asterope-gz', 'pegassi-vitello'}
TRANS = {'propulsion arrière': 'propulsion', 'traction avant': 'traction', '4x4': 'quatre roues motrices'}

# ---------- fusion GTABase + gta6guide ----------
g6 = {}
for o in G6:
    fab = o['fabricant'] if o['fabricant'] and 'Non document' not in o['fabricant'] else None
    full = o['nom'].strip(); mod = full[len(fab):].strip() if fab and full.startswith(fab) else full
    g6.setdefault(norm(mod), o); g6.setdefault(norm(full), o)

cat = {}
for r in GBF:
    nom = re.sub(r'^.*>', '', r['nom']).strip()
    if not nom or VRAIES_MARQUES.match(nom): continue
    k = norm(nom)
    cls = sorted(r['classes'], key=lambda c: (PRIORITE.index(c) if c in PRIORITE else 99))[0]
    g = PAR_CLASSE.get(cls, GROUPES[-1])
    f = r.get('fiche', {})
    fab = r.get('fabricant') or f.get('fabricant')
    if fab in ('', '-'): fab = None
    e = cat.setdefault(k, {'cle': k, 'fabricant': fab, 'modele': nom, 'groupe': g[0], 'type': g[2], 'base': (r.get('base') or f.get('base') or None),
                           'fiche': f, 'gb': r, 'sources': [{'nom': 'GTABase', 'url': r['url']}]})
    o = g6.get(k) or g6.get(norm((e['fabricant'] or '') + nom))
    if o and 'g6' not in e:
        e['g6'] = o; e['sources'].append({'nom': 'gta6guide.fr', 'url': o['url']})

# ---------- netteté des images ----------
LAPL = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], 1, 128)
def nettete(path):
    try:
        im = Image.open(path).convert('L')
    except Exception:
        return 0, (0, 0)
    w, h = im.size
    if w < 200 or h < 100: return 0, (w, h)
    t = im.resize((640, max(1, int(640 * h / w))), Image.LANCZOS)
    a = np.asarray(t.filter(LAPL), dtype=np.float32)
    return float(a.var()) * min(1.0, w / 900) ** 1.2, (w, h)   # une petite image agrandie est floue : on la pénalise

def telecharger(url, nom):
    p = os.path.join(CACHE, nom)
    if not os.path.exists(p) or os.path.getsize(p) < 500:
        subprocess.run(['curl', '-s', '-L', '-m', '40', '-A', UA, '-o', p, url])
    return p if os.path.exists(p) and os.path.getsize(p) > 500 else None

ORIG = {}
with open(os.path.join(HQ, 'docs/compliance/media-hashes.csv'), newline='') as fh:
    for row in csv.DictReader(fh): ORIG[row['file']] = row['source']
HQF = {os.path.splitext(f)[0]: f for f in os.listdir(os.path.join(HQ, 'images/vehicles'))}
def credit_hq(rel):
    s = ORIG.get(rel, ''); url = next((w.strip('",') for w in s.split() if w.startswith('http')), '')
    for dom, n in [('gtabase.com', 'GTABase'), ('tracker.gg', 'Tracker.gg'), ('gta.wiki', 'GTA Wiki')]:
        if dom in url: return f'Rockstar Games, via {n}', url
    return 'Rockstar Games', url

def candidats(e, nom_complet):
    c = []
    gb = e.get('gb') or {}
    if gb.get('imgUrl'):
        p = telecharger(gb['imgUrl'], 'gb_' + re.sub(r'[^a-zA-Z0-9._-]', '_', gb['imgUrl'].rsplit('/', 1)[1]))
        if p: c.append((p, 'Rockstar Games, via GTABase', gb['url']))
    for k in (slug(nom_complet), slug(e['modele'])):
        if k in HQF:
            rel = 'images/vehicles/' + HQF[k]; cr, u = credit_hq(rel); c.append((os.path.join(HQ, rel), cr, u)); break
    o = e.get('g6') or {}
    if o.get('img'):
        p = telecharger(o['img'], 'g6_' + o['slug'] + '.' + o['img'].rsplit('.', 1)[-1][:4])
        if p: c.append((p, 'gta6guide.fr', o['url']))
    return c

def meilleure(c):
    best = None
    for p, cr, u in c:
        s, size = nettete(p)
        if s > 0 and (not best or s > best[0]): best = (s, p, cr, u, size)
    return best

def enregistrer(src, dest):
    im = Image.open(src).convert('RGB'); im.thumbnail((1280, 1280))
    im.save(dest, 'WEBP', quality=80, method=6)

def resume(e):
    f = e.get('fiche', {})
    txt = e['modele'] + (f" de {e['fabricant']}" if e['fabricant'] else '')
    if e.get('base'): txt += f", inspiré de : {e['base']}"
    txt += '.'
    tech = []
    if (f.get('places') or '').isdigit(): tech.append(f"{f['places']} place{'s' if int(f['places']) > 1 else ''}")
    if f.get('transmission'): tech.append(TRANS.get(f['transmission'], f['transmission']))
    if (f.get('rapports') or '').isdigit() and int(f['rapports']) > 1: tech.append(f"{f['rapports']} rapports")
    if f.get('poids'): tech.append(f['poids'])
    if tech: txt += ' ' + ', '.join(tech)[0].upper() + ', '.join(tech)[1:] + '.'
    if f.get('aussi'): txt += f" Déjà présent dans {f['aussi']}."
    return txt

LIB = {g[0]: g[1] for g in GROUPES}
liste = []
for k, e in sorted(cat.items(), key=lambda kv: kv[1]['modele']):
    if k in DEJA: continue
    nom = f"{e['fabricant']} {e['modele']}" if e['fabricant'] and not e['modele'].startswith(e['fabricant']) else e['modele']
    o = e.get('g6') or {}
    f = e.get('fiche', {})
    obtenir = o.get('obtenir') if o.get('obtenir') and 'Non document' not in o.get('obtenir') else None
    item = {'slug': slug(nom), 'nom': nom, 'fabricant': e['fabricant'], 'modele': e['modele'], 'groupe': e['groupe'], 'classe': LIB[e['groupe']], 'type': e['type'],
            'inspiration': e['base'], 'places': f.get('places') if (f.get('places') or '').isdigit() else None, 'poids': f.get('poids'),
            'transmission': TRANS.get(f.get('transmission'), f.get('transmission')), 'rapports': f.get('rapports') if (f.get('rapports') or '').isdigit() and int(f.get('rapports')) > 1 else None,
            'aussi': f.get('aussi'), 'obtenir': obtenir, 'resume': resume(e), 'sources': e['sources']}
    best = None if item['slug'] in PHOTOS_REJETEES else meilleure(candidats(e, nom))
    if best:
        dest = os.path.join(OUT_IMG, item['slug'] + '.webp')
        if IMAGES or not os.path.exists(dest): enregistrer(best[1], dest)
        item.update({'img': item['slug'] + '.webp', 'credit': best[2], 'creditUrl': best[3], 'nettete': round(best[0]), 'taille': list(best[4])})
    liste.append(item)

# ---------- photos ajoutées à la main (data/catalogue-photos-extra.json) : rendus 4K du GTA Wiki et rendus GTABase vérifiés à l'œil ----------
EXTRA_P = os.path.join(ROOT, 'data/catalogue-photos-extra.json')
EXTRA = json.load(open(EXTRA_P)) if os.path.exists(EXTRA_P) else {}
for item in liste:
    x = EXTRA.get(item['slug'])
    if x and os.path.exists(os.path.join(OUT_IMG, item['slug'] + '.webp')):
        item.update({'img': item['slug'] + '.webp', 'credit': x['credit'], 'creditUrl': x['creditUrl'], 'taille': x['taille']})

# ---------- nos 31 fiches : catégorie et infos (leurs photos restent celles choisies à la main) ----------
fiches = {}
for s, (gid, k) in NOS.items():
    e = cat.get(k) if k else None
    d = {'groupe': gid, 'classe': LIB[gid]}
    if e:
        f = e.get('fiche', {})
        d.update({'fabricant': e['fabricant'], 'inspiration': e['base'], 'places': f.get('places') if (f.get('places') or '').isdigit() else None, 'poids': f.get('poids'),
                  'transmission': TRANS.get(f.get('transmission'), f.get('transmission')), 'aussi': f.get('aussi'), 'sources': e['sources']})
    fiches[s] = d

utiles = {x['img'] for x in liste if x.get('img')} | {d['img'] for d in fiches.values() if d.get('img')}
for fn in os.listdir(OUT_IMG):
    if fn not in utiles: os.remove(os.path.join(OUT_IMG, fn))
json.dump({'info': 'Catalogue des véhicules confirmés de GTA 6. Sources : GTABase et gta6guide.fr (relevés du 22/11/2026). Généré par tools/catalogue.py.',
           'groupes': [{'id': g[0], 'nom': g[1], 'type': g[2]} for g in GROUPES], 'vehicules': liste, 'fiches': fiches},
          open(os.path.join(ROOT, 'data/catalogue.json'), 'w'), ensure_ascii=False, indent=1)
print(len(liste), 'véhicules ·', sum(1 for x in liste if x.get('img')), 'avec photo nette ·', len(PHOTOS_REJETEES), 'photos écartées')
