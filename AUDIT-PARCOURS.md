# Audit des parcours joueurs sur iPhone : GTA6Facile.fr

Date : 24 novembre 2026.

Méthode :
- Chromium automatisé avec un profil iPhone 13 (390 px, écran tactile), sur le site construit.
- 72 recherches de joueurs, avec fautes, synonymes et questions.
- Contrôle automatique des 1 116 liens « Voir sur la carte ».
- Tests de progression, favoris et objets, avec rechargement de la page et passage d'un appareil à l'autre.

Règle suivie : une réponse utile en 2 ou 3 gestes quand l'information existe.

Priorités : **P1** fort impact, fait maintenant · **P2** utile, à faire ensuite · **P3** confort.

---

## 1. Recherche universelle

**Ce qui marchait déjà**
- Suggestions instantanées à chaque lettre.
- Tolérance aux fautes (« infrnus » → Pegassi Infernus, « sauvgarder » → Sauvegarder).
- Synonymes (thune, flics, bagnole…), mots surlignés, filtres par type.

**Vrais bugs constatés**

| Recherche | Résultat avant | Problème |
|---|---|---|
| « 100% », « 100 pour cent » | une Declasse Tulip M-100 | le dossier 100 % n'apparaissait pas |
| « trophée » | « Entrer un code » | aucun rapport |
| « jetski » | Airboat, Fishing Boat | le Jet-ski existait, mais n'était pas trouvé |
| « char d'assaut » | une épave sous-marine | le Rhino n'apparaissait pas |
| « voiture de police » | deux ambulances | ambulances avant les voitures de police |
| « lance roquette » | Invetero Coquette | « roquette » pris pour une faute de « coquette » |
| « mourir » | Courir plus vite | « mourir » pris pour une faute de « courir » |
| « perdre les flics » | Protéger son argent | « Semer la police » pas en tête |
| « gta online », « multijoueur » | aucun résultat | l'actu « Pas de mode en ligne » existait |
| « météo » | les météorites | avant le code « Changer la météo » |

**Ce qui manquait**
- Les catégories de véhicules (Motos, Bateaux, Police…) n'étaient pas proposées par la recherche.
- Rien n'indiquait clairement qu'aucun résultat n'avait été trouvé.

**Fait (P1)**
- Réponses directes pour les recherches courantes : 100 %, trophée, online, PC, tank, jet-ski, voiture de police, bloqué.
- Une faute n'est acceptée que si la première lettre est la même.
- Un mot n'est trouvé au milieu d'un autre que s'il fait 6 lettres ou plus.
- 19 catégories de véhicules ajoutées à la recherche.
- Nouveaux synonymes : planque, soigner, semer, 100 %, en ligne.
- Message « Aucun résultat pour « … » » avec un bouton **Signaler ce qui manque** (e-mail prérempli).

Après correction, les 10 recherches du tableau donnent la bonne page en premier, sauf deux qui restent sans bonne réponse :
- « lance roquette » : le site n'a pas de page sur les armes de ce type, la recherche ne propose plus de voiture par erreur ;
- « acheter maison » : la recherche propose « Acheter un garage » puis « Maison de Jason ».

## 2. Missions

**Ce qui marchait déjà**
- 135 fiches avec étapes numérotées.
- Mission précédente et suivante, nom anglais, donneur, récompense, sources.
- Recherche dans la liste ; « J'en suis là » et « Prochaine mission ».
- Missions repliées dans la liste : la solution ne s'affiche qu'au toucher.

**Ce qui manquait**
- Pas de bouton « Je suis bloqué » en haut des fiches.
- 31 missions n'avaient aucune aide.
- Aucun accès direct à la mission suivante après « J'ai fini ».
- Aucune protection contre les spoilers sur la fiche.

**Vrais bugs** : aucun.

**Fait (P1)**
- Bouton **Je suis bloqué** en haut de chaque fiche (1 geste vers l'aide).
- Sur les 31 missions sans astuce, un message honnête et le bouton « Je bloque encore : nous écrire ».
- Bouton **Mission suivante** qui apparaît dès qu'on touche « J'ai fini cette mission ».
- Mode **Masquer les spoilers**, facultatif et gardé sur l'appareil :
  - résumés et nom de la mission suivante floutés ;
  - un toucher pour lire ;
  - activable sur la fiche, la liste et Mon espace.

**À faire (P2)** : compléter l'aide des 31 missions, à mesure que des sources fiables existent.

## 3. Véhicules

**Ce qui marchait déjà**
- 312 véhicules avec photo et 5 filtres de type.
- « Emplacement connu » ; 19 catégories accessibles en un geste.
- **Où le trouver ?** ouvre la carte sur le bon repère (116 véhicules).
- Pour les autres, la fiche indique honnêtement que l'emplacement n'est pas encore documenté.

**Ce qui manque** :
- 196 véhicules sans emplacement vérifié ;
- l'acquisition (achat, vol, récompense) n'est connue que pour une partie.

**Vrais bugs** : aucun (seule la recherche « jetski » posait problème, corrigé au point 1).

**À faire (P2)** :
- dans « Autres véhicules », mettre d'abord ceux dont on connaît l'emplacement ;
- compléter les emplacements au fil des vérifications quotidiennes.

## 4. Carte

**Ce qui marchait déjà**
- Filtres par catégorie, repères groupés, cases « trouvé ».
- Lien partageable `?focus=`.
- Performance mobile 91/100, panneau d'information ouvert en 1,6 s.

**Vrais bugs** : aucun. Les 1 116 liens « Voir sur la carte » mènent tous à un repère existant.

**À faire (P3)** : rien d'urgent.

## 5. Objets à collectionner

**Ce qui marchait déjà**
- 14 listes et 842 emplacements, case **Trouvé**, sans inscription.
- Gardé après rechargement ; compteur « 1 / 51 trouvés » sur l'index.
- Même liste que la carte, « Masquer les objets trouvés ».

**Vrais bugs** : aucun.

**Ce qui manque** : les emplacements viennent de la communauté et ne sont pas tous vérifiés en jeu (déjà indiqué sur chaque page).

## 6. Qualité des informations

**Ce qui marchait déjà**
- Sources sur chaque fiche ; 5 statuts.
- « Confirmé » exige 2 sources (contrôlé avant chaque publication).
- Historique des corrections, bouton « Signaler une erreur » sur chaque fiche.
- Vérification quotidienne avec GTA Wiki.

**Ce qui manque** : 44 astuces « À vérifier » et 6 « Provisoire ».

**Vrais bugs** : aucun.

## 7. Référencement

**Ce qui marchait déjà**
- Une adresse indexable par mission, véhicule, lieu, astuce, liste d'objets et dossier : 616 pages dans le plan du site.
- Liens internes (même type, même région, mission précédente et suivante).
- Données structurées, performances de 91 à 99 sur mobile.

**Vrais bugs** : aucun. Le site vient d'être publié, l'indexation Google est en cours.

## 8. Sauvegarde locale

**Ce qui marchait déjà**
- Favoris, missions, astuces faites, objets trouvés, gardés sur l'appareil sans compte.
- Export des données ; compte facultatif pour synchroniser.

**Ce qui manquait** : impossible de remettre ses données sur un nouveau téléphone sans compte.

**Fait (P1)** : **Importer un fichier** dans Mon espace. Les listes sont fusionnées, rien n'est perdu, et un mauvais fichier est refusé avec un message clair.

## 9. Recherches sans résultat

**Ce qui marchait déjà** : comptage anonyme dans GoatCounter, sans cookie, et seulement si le visiteur ne l'a pas refusé.

**Ce qui manquait** : aucun moyen simple de les consulter.

**Fait (P1)**
- Dans Administration → Statistiques, un bouton **Voir les recherches sans résultat** (et « Codes copiés ») qui ouvre GoatCounter déjà filtré.
- Les visiteurs peuvent aussi signaler directement ce qui manque (point 1).

---

## Les 5 améliorations réalisées (P1)

1. Recherche plus juste : réponses directes, catégories, fautes et synonymes mieux gérés.
2. Recherche sans résultat : message clair et « Signaler ce qui manque », plus l'accès dans l'administration.
3. « Je suis bloqué » sur chaque mission, avec une solution de secours quand il n'y a pas encore d'astuce.
4. « Mission suivante » dès qu'une mission est finie, et le mode « Masquer les spoilers ».
5. Import des données dans Mon espace, pour changer de téléphone sans compte.

**Tests**
- `npm test` : 661 pages, 0 erreur.
- Parcours iPhone automatisés : recherche, missions, spoilers, import et export, objets, favoris.
- 19 pages parcourues sans aucune erreur JavaScript.
- Le design n'a pas changé : mêmes couleurs, mêmes images, même navigation. Seuls des boutons ont été ajoutés dans le style existant.
