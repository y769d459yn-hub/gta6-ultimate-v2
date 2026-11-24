# Audit technique et fonctionnel — gta6facile.fr

Audit réalisé le 24 novembre 2026 sur le code source réel (branche `main`, 644 pages générées).

**Méthode**
- Lecture du code.
- Construction du site.
- Tests automatisés dans un navigateur iPhone simulé (iPhone SE et iPhone 13) :
  - 24 recherches réelles de joueurs ;
  - 77 pages vérifiées pour le débordement, les erreurs JavaScript et la taille des zones tactiles ;
  - accessibilité (axe-core, WCAG 2 AA) sur 12 types de pages ;
  - liens internes et métadonnées sur les 644 pages.
- Rapport PageSpeed mobile fourni par le propriétaire.

**Légende**
- **Constaté** : défaut vérifié pendant l'audit.
- **Hypothèse** : point à vérifier, souvent hors de portée de l'environnement de test, qui n'accède ni à gta6facile.fr ni aux tableaux de bord OVH, GitHub et Supabase.
- **Corrigé** : corrigé dans la proposition de modification jointe (PR), testé, **non publié**.

**Priorités**
- **Bloquant** : empêche d'utiliser le site.
- **Haute** : à traiter rapidement.
- **Moyenne** : amélioration nette.
- **Basse** : finition.

## Résumé

Aucun défaut bloquant n'a été constaté. Le site se construit sans erreur et aucun lien interne n'est cassé sur les 644 pages. La recherche trouve la bonne réponse en premier pour 23 requêtes sur 24 (et pour toutes après correction). PageSpeed mobile donne Performances 92, Accessibilité 100, Bonnes pratiques 100 et SEO 100.

Les priorités hautes sont :
1. Les **mentions légales**, absentes alors que la loi française les impose.
2. Les **emplacements des véhicules** : 206 sur 282 sont sans emplacement, et l'administration ne permet pas de les ajouter.
3. Les **objets à collectionner** : 842 objets, visibles uniquement sur la carte, sans page de liste.
4. Le **statut des astuces** : 50 sur 64 sont encore « à vérifier ».
5. La **sécurité des comptes** : double authentification GitHub, renouvellement du domaine et réglages Supabase.

---

## 1. Domaine, DNS et HTTPS

| Constat | Fichier ou lieu | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Hypothèse** : HTTPS forcé. Le cadenas a été vu, mais la case « Enforce HTTPS » n'a pas été confirmée. | GitHub → Settings → Pages | Un visiteur qui tape `http://` resterait en clair | Haute | Vérifier que la case est cochée |
| **Hypothèse** : redirection de `www.gta6facile.fr` vers `gta6facile.fr` | Zone DNS OVH (CNAME `www` présent) | Lien `www` partagé qui ne marcherait pas | Moyenne | Ouvrir `www.gta6facile.fr` sur iPhone |
| **Constaté** (capture de la zone DNS) : pas d'enregistrements AAAA (IPv6) | Zone DNS OVH | Pas d'accès en IPv6 pur. Impact faible aujourd'hui | Basse | Ajouter 4 lignes AAAA : `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| **Constaté** : domaine non vérifié dans GitHub | GitHub → Settings → Pages → domaines vérifiés | Risque qu'un tiers rattache le domaine à son propre dépôt si Pages est désactivé un jour | Moyenne | Ajouter le domaine vérifié (un enregistrement TXT chez OVH) |
| **Constaté** (capture OVH) : renouvellement automatique « Aucun » sur les deux domaines | OVH | Perte du domaine dans un an, et rachat possible par un tiers | **Haute** | Activer le renouvellement automatique |
| **Constaté** : `gta6facile.eu` ne redirige nulle part | OVH | Visiteurs perdus s'ils tapent .eu | Basse | Redirection web OVH 301 vers `https://gta6facile.fr` |

## 2. Expérience mobile et navigation

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Constaté, corrigé** : sur un écran de 320 px (iPhone SE), une étiquette de chapitre longue débordait (page de 364 px de large) | `src/pages.css` (`.fiche-tags .pill`) | Défilement horizontal gênant | Moyenne | Retour à la ligne des étiquettes |
| **Constaté** : textes de 10,5 à 12 px (badges des cartes véhicules, date de l'accueil) | `src/home.css`, `src/pages.css` | Lecture difficile pour certains visiteurs | Basse | Minimum 12 px |
| **Constaté** : 33 liens « card-cta » de moins de 24 px de haut | `src/pages.css` | Petits à toucher, mais la carte entière est cliquable | Basse | Hauteur minimale de 32 px |
| Navigation (barre du bas, menu, recherche en un geste) | `scripts/build.mjs` (layout) | Bonne : accueil → mission ou véhicule en 2 gestes | — | — |

## 3. Recherche globale et filtres

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Constaté, corrigé** : « argent illimité » proposait d'abord le code « Focus illimité » | `data/astuces.json` (mots-clés de `code-argent`) | Mauvaise première réponse sur une recherche très fréquente | Haute | Mots-clés ajoutés ; le code 250 000 $ sort en premier |
| **Constaté** : « semer la police » affiche des ambulances en 2e et 3e position, et « vice city » ne met pas la page de la région en premier | `src/app.js` (fonction `search`) | Résultats secondaires moins pertinents ; la 1re réponse reste bonne | Basse | Pénaliser les correspondances qui ne portent que sur la catégorie d'un véhicule ; tests de régression sur les 24 requêtes |
| Fautes de frappe gérées (« banshe » → Bravado Banshee), synonymes (« thune », « flic »), filtres par type | `src/app.js`, `data/site.json` | Bon | — | — |

## 4. Missions et progression

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| Une page par mission avec solution, aide, précédente et suivante, progression synchronisée avec le compte | `scripts/build.mjs`, `src/app.js`, `src/missions.js` | Bon | — | — |
| **Constaté** : la liste `missions/` pèse 603 Ko (49 Ko compressée) car toutes les solutions sont dans la page | `scripts/build.mjs` | Acceptable en 4G ; plus lent en réseau faible | Basse | Garder pour l'instant (permet d'ouvrir une solution en 1 geste) |
| Proposition : afficher « ta prochaine mission » en haut de chaque page de mission selon la progression | `src/app.js` | Gain de temps | Basse | Phase 3 |

## 5. Véhicules et localisations

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Constaté** : 206 véhicules du catalogue sur 282 n'ont **aucun emplacement**, et 44 n'ont pas de photo | `data/catalogue.json`, `data/catalogue-carte.json` | Le joueur ne trouve pas où obtenir le véhicule | **Haute** (contenu) | Compléter avec des sources vérifiées, au fil des découvertes |
| **Constaté** : l'administration **ne permet pas de modifier les véhicules du catalogue** (seulement les 30 fiches détaillées) | `scripts/build.mjs` (`COLLECTIONS`), `src/admin.js`, `supabase/admin.sql` | Impossible d'ajouter un emplacement sans passer par Claude et GitHub | **Haute** | Ajouter la collection « catalogue » à l'administration (champ « Comment l'obtenir ») |
| 39 véhicules non confirmés : pages en noindex, hors plan du site | `scripts/build.mjs` | Bon : rien de douteux n'est mis en avant | — | — |

## 6. Carte interactive

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Constaté** : `data/carte.json` pèse 1,38 Mo (151 Ko compressé), chargé d'un coup | `scripts/build.mjs`, `src/carte.js` | Ouverture de la carte plus lente en réseau faible | Moyenne | Charger d'abord les catégories visibles, le reste ensuite |
| **Constaté** : 3 329 repères sur 3 387 sont « à vérifier » (données communautaires) | `data/carte-ogm.json`, `vendor/gtadb` | Fiabilité indiquée honnêtement | Basse | Confirmer progressivement les plus consultés |
| **Hypothèse** : gestes (pincer, glisser) sur iPhone réel | `src/atlas.js` | — | Moyenne | Test manuel sur iPhone |

## 7. Guides, astuces et objets à collectionner

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Constaté** : 842 objets à collectionner sont **uniquement sur la carte**, sans page de liste par type | `scripts/build.mjs` | Recherches très fréquentes (« emplacement de tous les … ») sans page dédiée ; moins pratique sur mobile | **Haute** | Une page par type d'objet : liste par zone, lien vers chaque repère, compteur « trouvé » (réutilise `lg:carte-trouves`) |
| **Constaté** : 50 astuces sur 64 sont « à vérifier » et 9 « provisoires », alors que le jeu est sorti | `data/astuces.json` | Moins de confiance des visiteurs | **Haute** | Revoir chaque astuce avec des sources postérieures à la sortie ; ne passer en « confirmé » qu'avec preuve |

## 8. Fiabilité des contenus et des données

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| Toutes les fiches ont au moins une source, et toutes les sources citées existent | `data/*.json`, `data/sources.json` | Bon | — | — |
| **Constaté, corrigé** : la date « Mis à jour le » du pied de page était fixe (22 novembre), même après une actualité ou une modification admin | `scripts/build.mjs` | Le site paraissait non mis à jour | Moyenne | Calculée automatiquement (actualités et administration) |
| **Hypothèse** : missions et codes relevés juste après la sortie ; un patch peut les avoir changés | `data/missions.json`, `data/codes.json` | Solution erronée possible | Moyenne | Revérifier après chaque mise à jour du jeu |

## 9. SEO, plan du site, métadonnées, indexabilité

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| 600 pages indexables, titres uniques de 62 caractères maximum, canonical, fil d'Ariane, robots.txt correct, recherche interne en noindex | `scripts/build.mjs` | Bon | — | — |
| **Constaté, corrigé** : aucun contrôle automatique empêchait de publier une page cassée | `scripts/verifier.mjs`, `.github/workflows/verifier.yml` | Régression possible sans s'en rendre compte | Haute | Contrôle à chaque PR (liens, titres, canonical, plan du site, JSON-LD) |
| **Constaté** : une seule image de partage pour toutes les pages | `scripts/build.mjs` (`og:image`) | Partages moins attractifs | Basse | Utiliser la photo du véhicule ou du lieu quand elle existe |

## 10. Performances et accessibilité

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Constaté, corrigé** : sur l'onglet actif de « Mon espace », contraste de 3,2:1 (blanc sur rose) | `src/pages.css` (`.auth-tabs`) | Texte peu lisible | Moyenne | Texte foncé sur rose |
| LCP mobile de 3,0 s, causé par la bannière | `scripts/build.mjs`, `src/img` | Déjà corrigé (PR #8, publiée) | — | — |
| Bibliothèque d'animation (GSAP, environ 130 Ko) sur chaque page | `scripts/build.mjs` | Faible : chargée en différé | Basse | À garder (choix de design) |

## 11. Sécurité et protection des données

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| RLS Supabase actif, fonctions admin vérifiées côté serveur, seule la clé publique est dans le site, textes échappés avant affichage, liens externes en `noopener` | `supabase/*.sql`, `src/*.js` | Bon | — | — |
| **Hypothèse** : double authentification GitHub non confirmée | Compte GitHub | Un mot de passe volé suffirait à modifier tout le site | **Haute** | Activer la 2FA |
| **Hypothèse** : longueur minimale du mot de passe côté Supabase (6 par défaut ; le site exige 8 côté navigateur seulement) | Supabase → Authentication → Providers → Email | Contournable | Moyenne | Mettre 8 dans Supabase ; activer la protection contre les mots de passe divulgués si disponible |
| **Constaté** : pas de Content-Security-Policy (GitHub Pages ne permet pas les en-têtes) | `scripts/build.mjs` | Défense en profondeur absente | Basse | Balise `<meta>` CSP plus tard |
| **Constaté** : `compte.js` remplace `Storage.prototype.setItem` pour tout le site | `src/compte.js` | Fragile si un autre script fait de même | Basse | Événement dédié lors des écritures |
| **Constaté** : actions GitHub référencées par version (`@v4`) et non par empreinte | `.github/workflows/*.yml` | Risque d'attaque par la chaîne d'approvisionnement, faible | Basse | Épingler par SHA |

## 12. Qualité du code et tests

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Constaté, corrigé** : aucun test, aucun script `npm test` | `package.json` | — | Haute | `npm test` = construction + vérification |
| **Constaté** : `scripts/build.mjs` fait 1 550 lignes dans un seul fichier | `scripts/build.mjs` | Maintenance plus difficile | Moyenne | Découper par rubrique, sans changement visible |
| **Constaté** : pas de test de la recherche | `src/app.js` | Une modification peut dégrader les résultats sans qu'on le voie | Moyenne | Tests sur les 24 requêtes de l'audit |

## 13. Administration et maintenance

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Constaté, corrigé** : si la publication automatique s'arrête, l'admin ne le savait pas | `src/admin.js` | Modifications jamais publiées sans alerte | Haute | Alerte si une modification attend depuis plus d'une heure, avec la marche à suivre |
| **Fait documenté par GitHub** : les tâches planifiées sont désactivées après 60 jours sans activité sur le dépôt | `.github/workflows/site.yml` | La publication depuis l'admin s'arrêterait | Moyenne | Alerte ci-dessus ; la réactivation se fait en un geste |
| **Hypothèse** : mise en pause du projet Supabase gratuit après 7 jours d'inactivité (la lecture toutes les 10 minutes la limite probablement) | Supabase | Comptes et admin indisponibles | Moyenne | Vérifier dans le tableau de bord Supabase |
| **Constaté** : pas de sauvegarde du contenu admin hors Supabase | `scripts/contenu.mjs` | Perte des modifications si le projet Supabase est supprimé | Moyenne | Export hebdomadaire automatique |

## 14. Préparation de la monétisation

| Constat | Fichier | Impact | Priorité | Correction |
|---|---|---|---|---|
| **Constaté** : **pas de mentions légales** (éditeur, hébergeur), obligatoires en France (loi LCEN) | `scripts/build.mjs` | Risque légal ; exigées aussi par les régies publicitaires | **Haute** | Page « Mentions légales » : nécessite **ta décision** sur l'identité de l'éditeur. Hébergeur : GitHub, Inc. |
| **Constaté** : pas de `ads.txt`, pas de gestion du consentement aux cookies | — | Obligatoires avant d'afficher Google AdSense en Europe | Moyenne (au moment de monétiser) | Plateforme de consentement certifiée Google ; `ads.txt` à la racine |
| **Constaté** : aucune mesure d'audience hors Search Console | — | Impossible de savoir quelles pages rapporteront | Moyenne | Outil sans cookies, donc sans bannière (à décider) |
| Réserver la place des futures publicités avec une hauteur fixe | `src/*.css` | Évite que la page saute (CLS de 0 aujourd'hui) | Basse | Au moment de monétiser |
| **Hypothèse** : « gta6 » dans le domaine, marque de Take-Two, peut gêner certaines régies | — | Refus possible d'une régie | Basse | À vérifier au moment de la candidature |

---

## Corrections incluses dans cette proposition (testées, non publiées)

1. Plus de débordement sur petit écran (`src/pages.css`).
2. Contraste de « Mon espace » (`src/pages.css`).
3. Recherche « argent illimité » (`data/astuces.json`).
4. Date de mise à jour automatique (`scripts/build.mjs`).
5. Alerte de publication bloquée dans l'administration (`src/admin.js`).
6. Contrôle automatique du site : `scripts/verifier.mjs`, `npm test`, vérification à chaque PR (`.github/workflows/verifier.yml`) et après chaque construction (`site.yml`, en avertissement).

**Résultats des tests**
- Construction OK, 0 erreur de contrôle sur 644 pages.
- 0 débordement sur 77 pages en 320 px.
- 0 violation WCAG AA sur 12 types de pages.
- Aucune erreur JavaScript.

## Prochaines étapes proposées

- **Phase 2**, à décider avec toi :
  - mentions légales ;
  - véhicules du catalogue dans l'administration ;
  - pages des objets à collectionner ;
  - mesure d'audience sans cookies.
- **Phase 3** :
  - classement fin de la recherche avec ses tests ;
  - chargement progressif de la carte ;
  - découpage de `build.mjs` ;
  - images de partage par page.
- **Contenu, en continu** :
  - emplacements des véhicules ;
  - statut des astuces ;
  - revérification après chaque patch du jeu.
