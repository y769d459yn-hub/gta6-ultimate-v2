# Optimisation de GTA6Facile.fr : rapport final

Branche : `claude/tender-newton-uo1pb8` (rien n'est encore en ligne : la mise en ligne se fait quand la demande de fusion vers `main` est acceptée).
Date des travaux : 24 novembre 2026.

Légende : **Fait et testé** = codé et contrôlé ici (construction, vérificateur, navigateur automatisé). **Non vérifié** = codé mais impossible à contrôler ici. **À faire** = reste à réaliser.

---

## 1. Problèmes détectés (constatés, pas supposés)

| # | Problème | Gravité |
|---|---|---|
| 1 | Combinaisons des codes de triche affichées uniquement en flèches dessinées : illisibles pour Google et les assistants IA, impossibles à copier | Élevée |
| 2 | Un code (« joueur-04 ») marqué « confirmé » avec une seule source, ce qui est contraire à la méthode du site | Élevée |
| 3 | Les articles d'astuces annonçaient une date de modification (`dateModified`) égale à la date de mise à jour globale du site, pas à une vraie vérification | Moyenne |
| 4 | Accueil : H1 non conforme à la demande | Moyenne |
| 5 | Pas de `llms.txt` pour les moteurs IA | Faible |
| 6 | Pas de bouton pour signaler une erreur, pas d'historique des corrections, seulement 3 statuts de fiabilité | Moyenne |
| 7 | Site non installable : manifeste avec une seule icône SVG, pas de service worker, rien hors connexion | Moyenne |
| 8 | Pages de rubrique (missions, véhicules, lieux…) sans données structurées de liste | Moyenne |
| 9 | « Mon espace » : seules les astuces étaient suivies, pas les missions ni les objets ; aucun export des données | Moyenne |
| 10 | Page Véhicules : 1,85 Mo, photos de 1600 px affichées en 173 à 381 px ; 490 ms de blocage | Élevée |
| 11 | ScrollTrigger chargé sur toutes les pages alors qu'il ne servait qu'à une animation | Faible |

## 2. Fonctionnalités existantes conservées

Aucune fonctionnalité ni aucun élément du design n'a été supprimé : recherche, carte interactive (filtres, partage `?focus=`, cases « trouvé »), favoris, comptes Supabase et synchronisation, administration, missions avec suivi, objets à collectionner, mesure d'audience GoatCounter sans cookie avec refus, thème jour/nuit, publication automatique.

## 3. Modifications réalisées

### Lot 1 : référencement, IA, fiabilité, recherche (fait et testé)
- H1 de l'accueil : « GTA 6 : guides, astuces, codes de triche et carte interactive » (visuellement masqué, car la bannière affiche déjà le titre ; il reste lu par Google et les lecteurs d'écran).
- Codes de triche : combinaison écrite en texte (« Haut, Droite, Bas… »), bouton **Copier la combinaison**, plateformes (PS5 et Xbox Series), statut avec sources et date du relevé.
- « Confirmé » exige désormais au moins deux sources ; le code « joueur-04 » est repassé « À vérifier ».
- 5 statuts : Testé en jeu, Confirmé, À vérifier, Provisoire, Obsolète, expliqués sur la page À propos.
- 14 astuces revérifiées affichent « Dernière vérification : 24 novembre 2026 » ; `dateModified` n'est donné que pour elles (plus de date artificielle).
- Historique des corrections sur la page À propos (5 corrections réelles).
- Bouton « Signaler une erreur sur cette page » sur toutes les fiches (e-mail prérempli).
- `llms.txt` : résumé du site et liens principaux pour les assistants IA. `robots.txt` inchangé (les robots IA restent autorisés, aucune permission d'entraînement modifiée).
- Recherche : mots surlignés dans les résultats ; recherches sans résultat comptées anonymement pour savoir quels guides manquent (rien n'est envoyé en cas de refus de la mesure, de Do Not Track ou de GPC).
- Balise `referrer` stricte ; emplacements prévus pour les codes de validation Google et Bing (vides).

### Lot 2 : application installable (fait et testé)
- Manifeste complet : icônes 192 et 512 px, icône « maskable » pour Android, icône Apple, raccourcis Carte, Codes, Missions.
- Service worker `sw.js`, une nouvelle version à chaque publication (les anciens caches sont supprimés) :
  - pages, CSS, JS, données : réseau d'abord (toujours la version à jour quand on est connecté) ;
  - images et polices : cache d'abord (400 images au plus) ;
  - jamais mis en cache : administration, compte, état de publication, Supabase, GoatCounter.
- Page « Hors connexion » pour les pages jamais ouvertes.
- Bandeau jaune quand une page vient du cache : « tu consultes la version enregistrée lors de ta dernière visite, elle peut ne pas être à jour ».

### Lot 3 : données structurées et espace personnel (fait et testé)
- `CollectionPage` + liste des fiches réellement présentes dans la page, sur Missions (135), Véhicules (312), Lieux (72), Encyclopédie (31), Actualités (10), Objets (14), Dossiers (4), Codes.
- Le vérificateur contrôle que chaque élément de ces listes mène à une page existante (578 adresses, 0 erreur).
- Mon espace : anneaux **Missions terminées** (x / 135) et **Objets trouvés** (x / 842), **Consultés récemment** (8 dernières fiches, sur l'appareil seulement), **Télécharger mes données** (fichier JSON) et **Effacer mes données** de l'appareil (le compte en ligne et le refus de mesure ne sont pas touchés).

### Lot 4 : performances (fait et testé)
- 214 miniatures de 560 px pour la liste des véhicules (`srcset`) ; les fiches gardent la photo complète. Script `scripts/miniatures.py` pour les futures photos.
- Animation des silhouettes de véhicules déclenchée par IntersectionObserver (même rendu, sans recalcul de toute la page).
- ScrollTrigger chargé uniquement sur l'accueil.
- Sécurité vérifiée : données affichées échappées, tous les liens externes en `noopener`. GitHub Pages ne permet pas d'en-têtes de sécurité (CSP, HSTS…) ; une CSP en balise meta n'a pas été ajoutée car elle risquait de casser les scripts intégrés sans gain réel.

## 4. Mesures avant / après

Lighthouse 12.2.1, mobile simulé (processeur ralenti ×4, réseau 4G lente), serveur local avec compression comme GitHub Pages. Les valeurs varient de quelques points d'une mesure à l'autre.

| Page | Performance | Blocage (TBT) | Poids |
|---|---|---|---|
| Accueil | 94 → 93 | 10 → 30 ms | 476 → 476 Ko |
| Codes | 97 → 97 | 30 → 20 ms | 248 → 231 Ko |
| **Véhicules** | **85 → 93** | **490 → 230 ms** | **1 851 → 902 Ko** |
| Mission (Prologue) | 99 → 99 | 20 → 90 ms | 196 → 179 Ko |
| **Carte** | **86 → 91** | 90 → 90 ms | **503 → 364 Ko** |
| Objets | 98 → 99 | 80 → 70 ms | 202 → 184 Ko |

Accessibilité, bonnes pratiques et SEO : 100 sur toutes ces pages, avant comme après.

## 5. Tests effectués

- `npm test` (construction + vérificateur) : 661 pages, 616 dans le plan du site, **0 erreur, 0 alerte**. Le vérificateur bloque désormais : « confirmé » avec moins de deux sources, statut inconnu, date de vérification invalide, `llms.txt` absent, élément de liste JSON-LD vers une page absente.
- Navigateur automatisé (Chromium) :
  - copie d'un code → « Haut, Droite, Bas, Gauche, Haut, Gauche, Bas, Droite » ;
  - surlignage de la recherche ;
  - service worker actif ; page visitée lisible hors connexion avec bandeau ; page jamais visitée → page « Hors connexion » ; bandeau retiré une fois reconnecté ;
  - compteurs de Mon espace, historique, export JSON, effacement ;
  - silhouettes de véhicules bien dessinées après défilement ;
  - 19 pages parcourues sans aucune erreur JavaScript.

## 6. Non vérifié ici

- Installation réelle sur iPhone et Android (« Ajouter à l'écran d'accueil ») : à tester après la mise en ligne.
- Comportement du service worker sur le vrai domaine (le bac à sable n'accède pas à gta6facile.fr).
- Réception réelle des événements anonymes dans GoatCounter (désactivés en local par conception).
- Note PageSpeed sur le site en ligne (réseau et serveurs réels).

## 7. Problèmes restants et contenus à compléter (aucune information inventée)

- 196 véhicules du catalogue n'ont pas encore d'emplacement connu.
- 44 astuces « À vérifier » et 6 « Provisoire » : à confirmer avec une deuxième source ou en jeu.
- 2 codes affichés sur 19 restent « À vérifier » (une seule source).
- 44 codes connus par leur nom n'ont pas encore de combinaison ni de source : ils ne sont pas affichés.
- Emplacements des objets à collectionner : relevés par la communauté, pas encore tous vérifiés en jeu.
- Accueil : le poids de la page (476 Ko) vient surtout des polices et des visuels ; aucun gain sûr sans toucher au design.

## 8. Actions manuelles pour toi

1. Relire puis accepter la demande de fusion vers `main` (c'est ce qui met en ligne).
2. Après la mise en ligne, sur iPhone : Safari → Partager → « Sur l'écran d'accueil », pour vérifier l'icône.
3. Facultatif : ajouter les 4 enregistrements AAAA chez OVH (IPv6 de GitHub Pages).
4. Facultatif : dans GoatCounter, vérifier la conservation de 760 jours et la case « Region » décochée.
5. Facultatif : renouvellement automatique des domaines chez OVH et double authentification sur GitHub.

## 9. Déploiement et retour en arrière

- **Déployer** : accepter la demande de fusion. GitHub Actions construit, vérifie (`npm test`) puis publie ; la page Administration affiche le commit publié.
- **Revenir en arrière** : sur GitHub, ouvrir la demande de fusion acceptée → « Revert » → accepter la nouvelle demande. Le site est republié dans l'état précédent. Le service worker change de version à chaque publication et supprime ses anciens caches, donc les visiteurs reçoivent aussi l'ancienne version.
- **Désactiver seulement le service worker** si besoin : retirer l'enregistrement dans `src/app.js` (bloc « application installable ») et publier un `sw.js` qui se désinscrit.

## 10. Fichiers

**Créés** : `data/corrections.json`, `scripts/miniatures.py`, `src/img/icon-192.png`, `src/img/icon-512.png`, `src/img/icon-maskable-512.png`, `src/img/apple-touch-icon.png`, `src/catalogue-mini/` (214 miniatures), `RAPPORT-OPTIMISATION.md`. Fichiers générés à la construction : `docs/sw.js`, `docs/hors-ligne.html`, `docs/llms.txt`.

**Modifiés** : `scripts/build.mjs`, `scripts/verifier.mjs`, `src/app.js`, `src/mesure.js`, `src/pages.js`, `src/app.css`, `src/pages.css`, `data/site.json`, `data/codes.json`, `data/astuces.json`, et le site construit `docs/`.
