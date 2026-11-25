"""Versions allégées des images de l'accueil (fonds des cartes et aperçu de la carte), même rendu à l'écran.
Fonds CSS : 720 px de large (assez pour couvrir le cadre sur un écran ×3) ; aperçu de la carte : 480 px pour les téléphones.
Usage : python3 scripts/vignettes-accueil.py (à relancer si une photo de l'accueil change)"""
import os
from PIL import Image
SRC = 'src'
def reduit(src, dst, larg, q=74):
    im = Image.open(src)
    if im.width <= larg: return
    im.resize((larg, round(im.height * larg / im.width)), Image.LANCZOS).save(dst, 'WEBP', quality=q, method=6)
    print(dst, os.path.getsize(src) // 1024, '→', os.path.getsize(dst) // 1024, 'Ko')
for n in ['jets-militaires', 'kayak-crest', 'progen-emerus-royal-ruby', 'vapid-stanier-55']:
    reduit(f'{SRC}/photos/{n}.webp', f'{SRC}/img/hx-{n}.webp', 720)
reduit(f'{SRC}/img/m-carte.webp', f'{SRC}/img/m-carte-480.webp', 480)
