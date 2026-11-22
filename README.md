# Leonida Guide — guide GTA 6

Site guide **pédagogique, visuel et ultra rapide** pour GTA 6 : astuces, véhicules, lieux, encyclopédie, actualités et **carte interactive en JSON**.
Objectif : trouver la solution en quelques secondes, avec peu de lecture et peu de scroll.

## Lancer
```bash
npm run build      # génère le site dans docs/
npm run dev        # build + serveur local sur http://localhost:8080
```
Aucune dépendance npm. GSAP et les polices (Anton, Inter) sont hébergés localement : le site ne fait aucun appel externe.

**Mise en ligne (GitHub Pages)** : dans *Settings → Pages*, choisis la branche puis le dossier `/docs`. Pour un autre domaine, modifie `url` dans `data/site.json`.

## Où modifier le contenu
| Fichier | Contenu |
|---|---|
| `data/astuces.json` | Fiches astuces (réponse, 3 étapes, à savoir, voir aussi, sources, statut) |
| `data/vehicules.json` | Véhicules (type, disponibilité, emplacement, comment l'obtenir) |
| `data/lieux.json` | Régions, quartiers, bâtiments, activités (+ position carte) |
| `data/carte.json` | Fond de carte schématique (côtes, régions, îles, lac, routes) |
| `data/encyclopedie.json` | Fiches « ce qu'on sait / ce qui reste incertain » |
| `data/actualites.json` | Actualités datées et sourcées |
| `data/sources.json` | Sources citées |
| `data/site.json` | Marque, URL, catégories, statuts, **synonymes de recherche** |

Statuts de fiabilité : `confirme` (vérifié humainement), `a-verifier`, `provisoire`.
**Règle : ne jamais inventer un emplacement.** Sans position connue, laisse `pos: null`. Avec une région seulement, mets `precision: "region"` : le repère est alors placé dans la région et affiché « à confirmer ».

## Architecture
- `scripts/build.mjs` : générateur statique (HTML par page, SEO, JSON-LD, sitemap, index de recherche, `docs/data/carte.json` au format GeoJSON).
- `scripts/icons.mjs` : pictogrammes SVG originaux et animés.
- `src/app.css` : direction artistique « coucher de soleil sur Leonida », mobile first, thèmes Nuit et Jour.
- `src/app.js` : recherche instantanée (tolérance aux fautes, synonymes, meilleur résultat en premier, raccourcis `/` et `Ctrl+K`), filtres, favoris, progression, préférences, animations GSAP.
- `src/map.js` : carte interactive (glisser, pincer, molette, regroupement des repères, filtres, recherche, panneau détail).

## Carte interactive
- Fond : carte communautaire « Yanis v18 — GTA VI Community Map » diffusée par [GTADB](https://map.gtadb.org) (CC BY 4.0), recolorée en néon par `tools/tuiles.py` → `src/tiles/` (5 niveaux, tuiles WebP de 1024 px). Ce n'est **pas** la carte officielle de Rockstar.
- Lieux de la communauté : `vendor/gtadb/landmarks.json` (CC BY 4.0), filtrés à la construction → `docs/data/communaute.json`.
- Les lieux du guide (`data/lieux.json`) sont placés soit par coordonnées (`monde`), soit par la médiane des lieux GTADB d'un quartier (`gtadb`).
- Moteur : `src/atlas.js` (tuiles, regroupement, pincer/glisser/molette, inertie), page : `src/carte.js`.
- Mettre à jour la carte : `git clone https://github.com/rolux/gtadb.org`, puis `python3 tools/tuiles.py ../gtadb.org` et copier `map/data/6/landmarks.json` dans `vendor/gtadb/`.

## SEO (discret)
Title et description par page, URL propres, canonical, Open Graph, JSON-LD (WebSite + SearchAction, FAQPage, HowTo, BreadcrumbList, Article, NewsArticle), sitemap.xml, robots.txt. Le texte complémentaire est rangé dans des blocs repliables (« Questions fréquentes », « En savoir plus »).

---
Site indépendant, non affilié à Rockstar Games ni à Take-Two. Aucune image du jeu n'est utilisée : les pictogrammes et la carte sont des créations originales.
