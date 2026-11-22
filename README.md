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

## Images des véhicules
Chaque véhicule est montré avec sa **photo du jeu** quand elle existe (`src/photos/<slug>.webp`, 27 sur 31 ; les photos sombres sont recadrées et éclaircies par `tools/photos.py`). Pour ajouter ou remplacer une photo, dépose `src/photos/<slug>.webp` (ex. `src/photos/jobuilt-hauler.webp`) puis relance `npm run build`, l'image la plus réaliste possible. Les photos sont préparées par `python3 tools/photos.py <dépôt gta6-hq>` à partir du dépôt public xpbeats00-sudo/gta6-hq, et `data/photos.json` garde l'origine de chacune (Rockstar Games, via GTABase, Tracker.gg ou GTA Wiki), affichée sous l'image. Ces images appartiennent à Rockstar Games : elles ne sont pas sous licence libre.

Une **vue 3D** (désactivée par défaut : `VUE_3D` dans `scripts/build.mjs`) peut être réactivée. Par défaut, c'est un modèle simplifié généré par `tools/3d` (three.js) d'après la photo, réglé dans `data/modeles3d.json` ; `npm run build:3d` assemble `src/vehicule3d.js` et produit les rendus fixes `src/rendus/` (utilisés quand il n'y a pas de photo). Pour une 3D réaliste, dépose un modèle `.glb` sous licence compatible dans `src/modeles/<slug>.glb` (par exemple `src/modeles/grotti-cheetah-95.glb`) : il remplace automatiquement le modèle simplifié. Pense à citer son auteur et sa licence.

## SEO (discret)
Title et description par page, URL propres, canonical, Open Graph, JSON-LD (WebSite + SearchAction, FAQPage, HowTo, BreadcrumbList, Article, NewsArticle), sitemap.xml, robots.txt. Le texte complémentaire est rangé dans des blocs repliables (« Questions fréquentes », « En savoir plus »).

---
Site indépendant, non affilié à Rockstar Games ni à Take-Two. Aucune image du jeu n'est utilisée : les pictogrammes et la carte sont des créations originales.

## Catalogue complet des véhicules

La page Véhicules range les 313 véhicules confirmés de GTA 6 en 19 catégories (Supercars, Sportives, Muscle cars, SUV, Motos, Bateaux, Avions, Police…). Dans chaque catégorie, les 31 véhicules du guide dont l'emplacement est connu passent en premier. Un toucher sur un véhicule du catalogue ouvre ses infos : photo, présentation, marque, vraie voiture d'origine, places, transmission, poids, autres jeux et « comment l'obtenir » quand c'est documenté.

- Sources : fiches GTABase (`vendor/catalogue/gtabase-fiches.json`) et gta6guide.fr (`vendor/catalogue/gta6guide.json`), relevées le 22/11/2026.
- `python3 tools/catalogue.py <dépôt gta6-hq> <cache images> [--images]` fusionne les sources, range chaque véhicule dans sa catégorie, compare toutes les photos disponibles (GTABase, gta6-hq, gta6guide.fr) et garde la plus nette. Les photos floues, trop sombres ou où le véhicule est masqué sont écartées à la main (`PHOTOS_REJETEES`) : le véhicule garde alors sa silhouette.
