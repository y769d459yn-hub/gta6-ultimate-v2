"""Prépare les photos des véhicules (src/photos/<slug>.webp) et data/photos.json.
Source des images : dépôt xpbeats00-sudo/gta6-hq (images/vehicles, images/editions),
dont le fichier docs/compliance/media-hashes.csv donne l'origine de chaque image.
Usage : python3 tools/photos.py <chemin du dépôt gta6-hq>"""
import csv, json, os, sys
from PIL import Image, ImageEnhance, ImageOps

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'photos')

# slug du site -> (image source, note affichée sous la photo, réglage de luminosité)
CHOIX = {
    'pegassi-infernus': ('images/vehicles/pegassi-infernus-96.jpg', '', 1.7, (0, 50, 832, 440)),
    'bravado-gauntlet-hellfire': ('images/vehicles/bravado-gauntlet-hellfire.jpg', '', 1.1, (130, 50, 832, 445)),
    'maibatsu-penumbra-ff': ('images/vehicles/maibatsu-penumbra-ff.jpg', '', 2.2, (0, 70, 832, 420)),
    'progen-emerus-royal-ruby': ('images/vehicles/progen-emerus.jpg', 'Modèle standard montré (pas la version « Royal Ruby »)', 1),
    'imponte-phoenix-bloodbath': ('images/vehicles/imponte-phoenix.jpg', 'Modèle standard montré (pas la version « Bloodbath »)', 1.5, (150, 70, 960, 500)),
    'mallard-flammes': ('images/vehicles/lapwing-mallard.jpg', 'Mallard standard montré (sans les flammes)', 1),
    'hydroglisseur': ('images/vehicles/airboat.jpg', '', 1),
    'jet-ski': ('images/vehicles/jet-ski.jpg', '', 1),
    'vedette': ('images/vehicles/speedboat.jpg', 'Exemple de hors-bord', 1),
    'moto-sportive': ('images/vehicles/pegassi-bati-801.jpg', 'Exemple : Pegassi Bati 801', 1),
    'dinka-enduro': ('images/vehicles/dinka-enduro.jpg', '', 1),
    'kayak-crest': ('images/vehicles/crest-kayak.jpg', '', 1),
    'mammoth-dodo': ('images/vehicles/mammoth-dodo.jpg', '', 1),
    'helicoptere-toits': ('images/vehicles/buckingham-maverick.jpg', 'Exemple : Buckingham Maverick', 1),
    'shitzu-squalo': ('images/editions/squalo-02.jpg', '', 1),
    'bombora-s23': ('images/vehicles/bombora-s23-ccs.jpg', '', 1),
    'vapid-stanier-55': ('images/vehicles/vapid-stanier-55.jpg', '', 1),
    'grotti-cheetah-95': ('images/vehicles/grotti-cheetah-95.jpg', '', 1),
    'vapid-dominator-buggy': ('images/vehicles/vapid-dominator-buggy.jpg', '', 1),
    'vapid-ganado': ('images/vehicles/vapid-ganado.jpg', '', 1),
    'pfister-comet-s2': ('images/vehicles/pfister-comet-s2.jpg', '', 1),
    'obey-tailgater-s': ('images/vehicles/obey-tailgater-s.jpg', '', 1),
    'imponte-ruiner': ('images/vehicles/imponte-ruiner-82.jpg', '', 1.15, (0, 0, 768, 533)),
    'maibatsu-penumbra-shirley': ('images/vehicles/maibatsu-penumbra.jpg', '', 1),
    'pegassi-tempesta': ('images/vehicles/pegassi-police-tempesta.jpg', 'Version police montrée', 1),
    'granforma-zorrusso': ('images/vehicles/granforma-zorrusso.jpg', '', 1),
    'jets-militaires': ('images/locations/mile-zero-air-station.jpg', 'Jet sur la base de Mile Zero', 1.1, (250, 350, 1850, 1250)),
}

ORIGINES = {}
with open(os.path.join(SRC, 'docs/compliance/media-hashes.csv'), newline='') as f:
    for r in csv.DictReader(f):
        ORIGINES[r['file']] = r['source']

def credit(src):
    s = ORIGINES.get(src, '')
    url = next((w.strip('",') for w in s.split() if w.startswith('http')), '')
    nom = 'Rockstar Games'
    for dom, n in [('pcgamer.com', 'PC Gamer'), ('gtabase.com', 'GTABase'), ('tracker.gg', 'Tracker.gg'), ('gta.wiki', 'GTA Wiki')]:
        if dom in url: nom = 'Capture du jeu, via PC Gamer' if n == 'PC Gamer' else f'Rockstar Games, via {n}'
    return nom, url

os.makedirs(OUT, exist_ok=True)
data = {}
for slug, (src, note, lum, *crop) in CHOIX.items():
    im = Image.open(os.path.join(SRC, src)).convert('RGB')
    if crop: im = im.crop(crop[0])
    if lum != 1:
        im = ImageOps.autocontrast(im, cutoff=(.5, .2))
        g = 1 / lum
        im = im.point(lambda v: int(255 * (v / 255) ** g))
        im = ImageEnhance.Color(im).enhance(1.12)
    im.thumbnail((960, 960))
    im.save(os.path.join(OUT, slug + '.webp'), 'WEBP', quality=74, method=6)
    nom, url = credit(src)
    data[slug] = {'fichier': slug + '.webp', 'note': note, 'credit': nom, 'url': url}
json.dump(data, open(os.path.join(ROOT, 'data', 'photos.json'), 'w'), ensure_ascii=False, indent=1)
print(len(data), 'photos', sum(os.path.getsize(os.path.join(OUT, d['fichier'])) for d in data.values()) // 1024, 'Ko')
