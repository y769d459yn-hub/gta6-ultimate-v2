"""Génère les tuiles néon de la carte à partir des tuiles GTADB (Yanis v18, CC BY 4.0).

Usage : python3 tools/tuiles.py <chemin/vers/gtadb.org> 
Source : https://github.com/rolux/gtadb.org (maps/tiles/6/yanis,18)
Sortie : src/tiles/<niveau>/<x>_<y>.webp + data/tuiles.json

Modifications apportées (exigées par CC BY 4.0) : recoloration « néon de nuit »,
masquage de la colonne de légende et des vignettes (x monde > COUPE_X), redécoupage en tuiles de 1024 px.
"""
import json, os, sys, glob
import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else '../rolux-gtadb'
SET = 'yanis,18'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'tiles')
NIVEAUX = [int(a) for a in sys.argv[2].split(',')] if len(sys.argv) > 2 else range(0, 6)  # 5 = niveau le plus détaillé de la source (1 pixel par mètre)
SRC_TILE, OUT_TILE = 256, 1024
MONDE, ZERO = 32768, 16384
COUPE_X = 3600  # au-delà : légende et vignettes de la carte source, exclues

def c(*v): return np.array(v, np.float32) / 255.
FOND = c(5, 6, 16)

def neon(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    v = mx; d = np.maximum(mx - mn, 1e-6); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    out = np.zeros_like(a)
    eau = (h > 185) & (h < 240) & (s > .35)
    vert = (h >= 55) & (h < 170) & (s > .18)
    jaune = (h >= 35) & (h < 55) & (s > .25)
    gris = s <= .12
    autre = ~(eau | vert | jaune | gris)
    t = np.clip((v - .62) / .38, 0, 1)[..., None]
    out = np.where(eau[..., None], FOND * (1 - t) + c(12, 62, 84) * t, out)
    lv = np.clip((v - .55) / .4, 0, 1)[..., None]
    out = np.where(vert[..., None], c(22, 19, 40) * (1 - lv) + c(40, 34, 68) * lv, out)
    out = np.where(jaune[..., None], c(52, 38, 30), out)
    route = gris & (v > .86); ville = gris & (v <= .86)
    cv = np.clip((v - .55) / .31, 0, 1)[..., None]
    out = np.where(ville[..., None], c(30, 27, 52) * (1 - cv) + c(66, 56, 100) * cv, out)
    rv = np.clip((v - .86) / .14, 0, 1)[..., None]
    out = np.where(route[..., None], c(150, 70, 150) * (1 - rv) + c(255, 122, 232) * rv, out)
    out = np.where(autre[..., None], np.clip(a * .55 + c(40, 20, 50), 0, 1), out)
    return out

def charge(z, row, col):
    f = os.path.join(SRC, 'maps', 'tiles', '6', SET, str(z), f'{z},{row},{col}.jpg')
    return Image.open(f).convert('RGB') if os.path.exists(f) else None

meta = {'tileSize': OUT_TILE, 'monde': MONDE, 'zero': ZERO, 'fond': '#050610', 'coupeX': COUPE_X,
        'source': {'nom': 'Yanis v18 — GTA VI Community Map', 'diffuseur': 'GTADB', 'url': 'https://map.gtadb.org',
                   'depot': 'https://github.com/rolux/gtadb.org', 'licence': 'CC BY 4.0',
                   'licenceUrl': 'https://creativecommons.org/licenses/by/4.0/',
                   'modifications': 'Recoloration néon, légende et vignettes retirées, redécoupage.',
                   'officielle': False},
        'niveaux': []}
for z in NIVEAUX:
    n = 4 * 2 ** z  # tuiles source par côté
    ppu = (1024 * 2 ** z) / MONDE  # pixels par unité monde à ce niveau
    tuiles = []
    for ty in range(n // 4):
        for tx in range(n // 4):
            canvas = Image.new('RGB', (OUT_TILE, OUT_TILE), (0, 0, 0)); found = False
            mask = np.zeros((OUT_TILE, OUT_TILE), bool)
            for j in range(4):
                for i in range(4):
                    im = charge(z, ty * 4 + j, tx * 4 + i)
                    if im is not None:
                        canvas.paste(im, (i * SRC_TILE, j * SRC_TILE)); found = True
                        mask[j * SRC_TILE:(j + 1) * SRC_TILE, i * SRC_TILE:(i + 1) * SRC_TILE] = True
            if not found: continue
            if z >= 5: canvas = canvas.filter(ImageFilter.MedianFilter(3))  # niveau détaillé : retire le bruit JPEG de la source avant la recoloration
            a = np.asarray(canvas).astype(np.float32) / 255.
            o = neon(a)
            o[~mask] = FOND
            xs = (tx * OUT_TILE + np.arange(OUT_TILE)) / ppu - ZERO
            o[:, xs > COUPE_X] = FOND
            if np.abs(o - FOND).max() < 0.03: continue  # tuile vide (océan uniforme)
            os.makedirs(os.path.join(OUT, str(z)), exist_ok=True)
            Image.fromarray((np.clip(o, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, str(z), f'{tx}_{ty}.webp'), 'WEBP', quality=72 if z < 5 else 82, method=6)
            tuiles.append(f'{tx}_{ty}')
    meta['niveaux'].append({'z': z, 'grille': n // 4, 'tuiles': tuiles})
    print('niveau', z, len(tuiles), 'tuiles')
if len(sys.argv) > 2:  # niveaux régénérés à part : on garde les autres
    old = json.load(open(os.path.join(ROOT, 'data', 'tuiles.json')))['niveaux']
    meta['niveaux'] = sorted([n for n in old if n['z'] not in NIVEAUX] + meta['niveaux'], key=lambda n: n['z'])
json.dump(meta, open(os.path.join(ROOT, 'data', 'tuiles.json'), 'w'), ensure_ascii=False, indent=1)
