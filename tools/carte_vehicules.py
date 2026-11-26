"""Repères véhicules d'« Open GTA 6 Map » (fbritoferreira, CC BY 4.0) : mise à jour des seuls véhicules dans data/carte-ogm.json.

Usage : python3 tools/carte_vehicules.py <locations.json d'Open GTA 6 Map> <date de la révision AAAA-MM-JJ>
- remplace uniquement les repères « Standout vehicle », « Vehicle spawn », « Vehicle request », « Vehicle rental » (les autres catégories ne bougent pas) ;
- mêmes conversions que tools/opengta6map.py (x = 32·x − 16385, y = 16385 − 32·y), noms traduits par tools/traduction_carte.py ;
- garde la « collection » (Set) indiquée par les joueurs et signale la présence d'une capture (ph) ;
- rattache chaque repère à la fiche du catalogue quand la marque et le modèle concordent sans ambiguïté (data/catalogue-carte.json)."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from traduction_carte import traduire_desc, traduire_nom

SRC, REV = sys.argv[1], sys.argv[2]
L = json.load(open(SRC))
TYPES = {'Standout vehicle': ('Véhicule remarquable', 'car'), 'Vehicle spawn': ('Véhicule qui apparaît ici', 'car'),
         'Vehicle request': ('Véhicule à commander', 'phone'), 'Vehicle rental': ('Location de véhicules', 'car')}
PHRASES = {'In the garage.': 'Dans le garage.', 'In the junkyard.': 'Dans la casse.', 'On the rooftop helipad.': "Sur l'héliport du toit.",
           'Inside the garage.': 'Dans le garage.', 'Behind the building.': 'Derrière le bâtiment.', 'In the parking lot.': 'Sur le parking.',
           'F-16 Hangar - Grab yourself a fighter jet': 'Hangar des F-16 : un avion de chasse à prendre.',
           'One or two Banshees are always parked here.': 'Une ou deux Banshee sont toujours garées ici.',
           'Special GTA+ reward.': 'Récompense spéciale GTA+.'}

def desc_fr(d):
    if not d: return '', None, False
    sets = [s.strip() for s in re.findall(r'Set:\s*([^;]+?)(?=\s*Set:|;|$)', d)]
    reste = re.sub(r'Set:\s*[^;]+?(?=\s*Set:|;|$)', '', d)
    reste = ' '.join(p.strip() for p in reste.split(';') if p.strip())
    en = False
    if reste:
        if reste in PHRASES: reste = PHRASES[reste]
        else:
            t = traduire_desc(reste)
            if t: reste = t
            else: en = True
    return reste, (sets[0] if sets else None), en

# ---------- rattachement au catalogue ----------
n = lambda s: re.sub(r'[^a-z0-9 ]', ' ', (s or '').lower()).split()
cat = json.load(open(os.path.join(ROOT, 'data', 'catalogue.json')))['vehicules']
ve = json.load(open(os.path.join(ROOT, 'data', 'vehicules.json')))
fiches = json.load(open(os.path.join(ROOT, 'data', 'catalogue.json')))['fiches']
modeles = []
for v in cat: modeles.append((v['slug'], v.get('fabricant') or '', v['modele']))
for v in ve:
    f = fiches.get(v['slug'], {})
    fab = f.get('fabricant') or ''
    mo = f.get('modele') or (re.sub(r'[«»"]', '', v['nom'][len(fab):]).strip() if fab and v['nom'].startswith(fab) else '')
    if fab and mo: modeles.append((v['slug'], fab, mo))
def decoupe(mo):
    m = re.match(r"(.+?) '(\d\d)(.*)$", mo)
    return (m.group(1) + m.group(3), m.group(2)) if m else (mo, None)
def rattache(nom):
    w = n(nom.replace("'", " '"))
    txt = ' ' + ' '.join(w) + ' '
    ans = set(re.findall(r"'(\d\d)\b", nom)) | {y[2:] for y in re.findall(r'\b(19\d\d|20\d\d)\b', nom)}
    cands = []
    for slug, fab, mo in modeles:
        base, an = decoupe(mo)
        b = ' '.join(n(base))
        if not b or ' ' + b + ' ' not in txt: continue
        if fab and n(fab) and w[:len(n(fab))] != n(fab): continue
        # modèle sans marque (« Jet », « Blimp ») : le nom doit être exactement celui du modèle
        if not fab and ' '.join(n(re.sub(r'\(.*?\)', '', nom))) != b: continue
        if an and ans and an not in ans: continue
        # modèle daté (« Comet '88 ») sans l'année dans le nom : seulement si aucun autre modèle ne commence par le même mot
        if an and an not in ans and any(s2 != slug and n(decoupe(m2)[0])[:1] == n(base)[:1] for s2, f2, m2 in modeles): continue
        cands.append((len(b), an in ans if an else False, slug, an))
    if not cands: return None
    cands.sort(reverse=True)
    top = [c for c in cands if c[0] == cands[0][0]]
    if len(top) > 1:
        sur = [c for c in top if c[1]] or [c for c in top if not c[3]]
        if len(sur) != 1: return None
        return sur[0][2]
    return top[0][2]

# rattachements vérifiés à la main (nom générique dans la source)
MANUEL = {'vehicle-spawn-002': 'jets-militaires'}
ogm_path = os.path.join(ROOT, 'data', 'carte-ogm.json')
OGM = json.load(open(ogm_path))
labels = {lab for lab, _ in TYPES.values()}
autres = [o for o in OGM['lieux'] if not (o['c'] == 'vehicules' and o['s'] in labels)]
nouveaux, lien = [], {}
for l in L:
    if l.get('type') not in TYPES: continue
    lab, ic = TYPES[l['type']]
    d, s, en = desc_fr(l.get('description', ''))
    nom = traduire_nom(l['name'].strip())
    o = {'id': l['id'], 'c': 'vehicules', 's': lab, 'i': ic, 'n': nom, 'x': round(32 * l['x'] - 16385), 'y': round(16385 - 32 * l['y'])}
    if d: o['d'] = d
    if en: o['en'] = 1
    if s: o['set'] = s
    if l.get('screenshot'): o['ph'] = 1
    if l.get('area'): o['a'] = l['area']
    nouveaux.append(o)
    slug = MANUEL.get(l['id']) or rattache(l['name'])
    if slug: lien.setdefault(slug, []).append('o-' + l['id'])
OGM['lieux'] = autres + nouveaux
OGM['revisionVehicules'] = REV
json.dump(OGM, open(ogm_path, 'w'), ensure_ascii=False, separators=(',', ':'))

cc_path = os.path.join(ROOT, 'data', 'catalogue-carte.json')
CC = json.load(open(cc_path))
VEH = re.compile(r'^o-(standout-vehicle|vehicle-spawn|vehicle-request|vehicle-rental)-')
# liens déjà établis (import précédent, vérifiés) : conservés tels quels ; la correspondance automatique ne sert qu'aux repères encore sans fiche
deja = {i for v in CC.values() for i in v if VEH.match(i)}
presents = {'o-' + o['id'] for o in nouveaux}
for k in list(CC):
    CC[k] = [i for i in CC[k] if not VEH.match(i) or i in presents]
for slug, ids in lien.items(): CC.setdefault(slug, []).extend(i for i in ids if i not in deja)
CC = {k: v for k, v in CC.items() if v}
json.dump(CC, open(cc_path, 'w'), ensure_ascii=False, indent=0)
import collections
print(len(nouveaux), 'repères véhicules', dict(collections.Counter(o['s'] for o in nouveaux)), '·', sum(1 for v in CC.values() for i in v if VEH.match(i)), 'rattachés à une fiche ·', sum(1 for o in nouveaux if o.get('en')), 'indications en anglais')
