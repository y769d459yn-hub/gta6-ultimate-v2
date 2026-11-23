"""Mise en couleur « réaliste » du fond de carte (tons proches de la carte du jeu) :
eau bleu-gris, terres vert sauge, villes gris clair, routes presque blanches, plages sable.
Transformation continue (pas de seuils) : les dégradés et l'anticrénelage de la source sont conservés."""
import numpy as np


def _hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def _rgb(h, s, v):
    h = (h % 360) / 60
    i = np.floor(h); f = h - i
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    i = i.astype(int) % 6
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1)


def _fen(h, c, w):  # poids doux autour d'une teinte (fenêtre circulaire)
    d = np.abs(((h - c + 180) % 360) - 180)
    return np.clip(1 - d / w, 0, 1)


def realiste(a):
    """a : image RGB en flottants 0..1 → même image en tons « jeu »."""
    h, s, v = _hsv(a)
    col = np.clip((s - .12) / .2, 0, 1)  # 0 = gris/blanc (villes, routes), 1 = couleur franche
    # eau (bleus)
    w_eau = _fen(h, 205, 40) * col
    eau = _rgb(np.full_like(h, 204), s * .62, .40 + v * .38)
    # végétation (verts et vert-jaune)
    w_vert = np.maximum(_fen(h, 95, 45), _fen(h, 140, 35)) * col
    vert = _rgb(100 + (h - 90) * .25, s * .36, .30 + v * .38)
    # sable et champs (jaunes)
    w_sable = _fen(h, 48, 14) * col
    sable = _rgb(np.full_like(h, 45), s * .45, .55 + v * .36)
    # le reste en couleur (textes rouges, rails…) : simplement adouci
    w_autre = np.clip(col - w_eau - w_vert - w_sable, 0, 1)
    autre = _rgb(h, s * .55, v * .9)
    # gris et blancs : villes gris lavande, routes presque blanches
    gris = np.clip(a.mean(-1, keepdims=True) * np.array([.98, .98, 1.03]) * .97 + .015, 0, 1)
    w_gris = 1 - np.clip(w_eau + w_vert + w_sable + w_autre, 0, 1)
    tot = w_eau + w_vert + w_sable + w_autre + w_gris
    out = (eau * w_eau[..., None] + vert * w_vert[..., None] + sable * w_sable[..., None] + autre * w_autre[..., None] + gris * w_gris[..., None]) / tot[..., None]
    return np.clip(out, 0, 1)


EAU_PROFONDE = None
def fond_eau():
    """Couleur de l'eau profonde après transformation (sert de fond hors carte)."""
    src = np.array([[[44, 104, 166]]], np.float32) / 255.
    return realiste(src)[0, 0]
