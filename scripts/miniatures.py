"""Miniatures des photos du catalogue pour les listes (560 px de large, WebP).
Usage : python3 scripts/miniatures.py  (à relancer après l'ajout de photos dans src/catalogue/)"""
import os
from PIL import Image
SRC, OUT, LARG = 'src/catalogue', 'src/catalogue-mini', 560
os.makedirs(OUT, exist_ok=True)
n = 0
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.webp'): continue
    dst = os.path.join(OUT, f)
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(os.path.join(SRC, f)): continue
    im = Image.open(os.path.join(SRC, f))
    if im.width <= LARG: continue  # déjà petite : la liste utilise l'originale
    im.resize((LARG, round(im.height * LARG / im.width)), Image.LANCZOS).save(dst, 'WEBP', quality=72, method=6)
    n += 1
print(n, 'miniature(s) créée(s)')
