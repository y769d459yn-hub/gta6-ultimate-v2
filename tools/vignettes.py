"""Génère une vignette de carte (vue du quartier) pour chaque repère du guide.

Usage : python3 tools/vignettes.py   (après `npm run build`, qui écrit docs/data/carte.json)
Entrées : src/tiles/<niveau>/<x>_<y>.webp (carte communautaire GTADB, CC BY 4.0, recolorée)
Sortie : src/vignettes/<id>.webp (760×440) + data/vignettes.json (liste des ids disponibles)
"""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(os.path.join(ROOT, 'data', 'tuiles.json')))
C = json.load(open(os.path.join(ROOT, 'docs', 'data', 'carte.json')))
OUT = os.path.join(ROOT, 'src', 'vignettes')
os.makedirs(OUT, exist_ok=True)
W, H = 760, 440
FOND = (5, 6, 16)
cache = {}

def tuile(z, tx, ty):
    k = (z, tx, ty)
    if k not in cache:
        f = os.path.join(ROOT, 'src', 'tiles', str(z), f'{tx}_{ty}.webp')
        cache[k] = Image.open(f).convert('RGB') if os.path.exists(f) else None
    return cache[k]

def vignette(x, y, z):
    ppu = (1024 * 2 ** z) / T['monde']
    px, py = (x + T['zero']) * ppu, (T['zero'] - y) * ppu
    x0, y0 = int(px - W / 2), int(py - H / 2)
    img = Image.new('RGB', (W, H), FOND)
    for ty in range(y0 // 1024, (y0 + H) // 1024 + 1):
        for tx in range(x0 // 1024, (x0 + W) // 1024 + 1):
            t = tuile(z, tx, ty)
            if t is not None: img.paste(t, (tx * 1024 - x0, ty * 1024 - y0))
    return img

# repères cités par un glitch (data/glitchs.json) : vignette aussi, même pour un commerce ou un service
GL = set()
gf = os.path.join(ROOT, 'data', 'glitchs.json')
if os.path.exists(gf):
    for g in json.load(open(gf))['glitchs']:
        for e in g.get('emplacements', []): GL.add(e['carte'])
ids = []
for f in C['features']:
    p = f['properties']; x, y = f['geometry']['coordinates']
    if p.get('service') and p['id'] not in GL: continue
    z = 2 if p.get('label') else (3 if p.get('precision') == 'region' else 4)
    vignette(x, y, z).save(os.path.join(OUT, f"{p['id']}.webp"), 'WEBP', quality=70, method=6)
    ids.append(p['id'])
json.dump({'source': 'Carte communautaire Yanis v18 / GTADB (CC BY 4.0), recolorée', 'ids': ids}, open(os.path.join(ROOT, 'data', 'vignettes.json'), 'w'), ensure_ascii=False, indent=1)
print(len(ids), 'vignettes')
