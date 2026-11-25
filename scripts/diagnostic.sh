#!/usr/bin/env bash
# Diagnostic de publication de gta6facile.fr, exécuté depuis un serveur GitHub (accès Internet public).
# Ne modifie rien : il interroge seulement le DNS, HTTPS, les redirections, robots.txt, le plan du site et quelques liens directs.
set -u
D=gta6facile.fr
GH=y769d459yn-hub.github.io
UA_NAV='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
UA_GOOGLE='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
titre() { echo; echo "==================== $* ===================="; }

titre "1. DNS (résolveurs publics Google et Cloudflare)"
for r in 8.8.8.8 1.1.1.1; do
  for h in $D www.$D; do
    for t in A AAAA CNAME CAA; do echo "@$r $h $t : $(dig +short @$r $h $t | tr '\n' ' ')"; done
  done
done
echo "NS : $(dig +short NS $D | tr '\n' ' ')"
echo "Adresses officielles GitHub Pages attendues : 185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153"

titre "2. Pages GitHub (configuration du dépôt)"
curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN:-}" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${GITHUB_REPOSITORY:-y769d459yn-hub/gta6-ultimate-v2}/pages" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print({k: d.get(k) for k in ['status','cname','custom_404','html_url','build_type','https_enforced','https_certificate','public','message']})" 2>&1

titre "3. Certificat HTTPS"
for h in $D www.$D; do
  echo "--- $h"
  echo | timeout 15 openssl s_client -servername $h -connect $h:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName 2>&1 | sed 's/^/    /'
done

titre "4. Redirections (chaque étape : code, adresse)"
for u in "http://$D/" "https://$D/" "http://www.$D/" "https://www.$D/" "https://$GH/" "https://$GH/gta6-ultimate-v2/" "https://$D/missions" ; do
  echo "--- $u"
  curl -sS -o /dev/null -L --max-redirs 10 -A "$UA_NAV" -w '    final : %{http_code} %{url_effective} (%{num_redirects} redirection(s), %{time_total}s)\n' "$u" 2>&1
  curl -sS -I -A "$UA_NAV" --max-time 20 "$u" 2>&1 | grep -iE '^(HTTP|location|x-robots-tag|server|content-type)' | sed 's/^/    /'
done

titre "5. Accueil, robots.txt, sitemap.xml"
curl -sS -A "$UA_NAV" "https://$D/" -o /tmp/accueil.html -w 'accueil : %{http_code}, %{size_download} octets\n'
echo "titre : $(grep -o '<title>[^<]*' /tmp/accueil.html | head -1 | cut -c8-)"
echo "canonical : $(grep -o '<link rel="canonical" href="[^"]*' /tmp/accueil.html | cut -d'"' -f4)"
echo "meta robots : $(grep -o '<meta name="robots"[^>]*>' /tmp/accueil.html || echo 'aucune (indexable)')"
echo "--- robots.txt"; curl -sS -A "$UA_GOOGLE" "https://$D/robots.txt" -w '\n    (code %{http_code}, type %{content_type})\n'
curl -sS -A "$UA_GOOGLE" "https://$D/sitemap.xml" -o /tmp/sitemap.xml -w 'sitemap.xml : %{http_code}, type %{content_type}, %{size_download} octets\n'
grep -o '<loc>[^<]*' /tmp/sitemap.xml | cut -c6- > /tmp/urls.txt
echo "adresses dans le sitemap : $(wc -l < /tmp/urls.txt)"
echo "adresses hors du domaine : $(grep -vc "^https://$D/" /tmp/urls.txt)"

titre "6. Toutes les pages du sitemap (vu par Googlebot)"
cat /tmp/urls.txt | xargs -P 4 -I{} curl -sS -o /dev/null -A "$UA_GOOGLE" --max-time 30 -w '%{http_code} {}\n' {} > /tmp/codes.txt 2>&1
echo "réponses (4 requêtes en parallèle) : $(cut -d' ' -f1 /tmp/codes.txt | sort | uniq -c | tr '\n' ' ')"
echo "pages en erreur au premier passage (max 20) :"; grep -v '^200 ' /tmp/codes.txt | head -20
echo "nouvel essai des pages en erreur, une par une, 5 s plus tard :"
sleep 5
grep -v '^200 ' /tmp/codes.txt | cut -d' ' -f2 | while read -r u; do curl -sS -o /dev/null -A "$UA_GOOGLE" --max-time 30 -w '    %{http_code} {}\n' "$u" | sed "s#{}#$u#"; sleep 1; done

titre "7. Liens directs (navigateur iPhone puis Googlebot)"
for p in missions/coming-home/ vehicules/pegassi-infernus/ vehicules/obey-8f-drafter/ astuces/semer-la-police/ collection/meteorite/ lieux/vice-city/ mentions-legales/ dossiers/100-pour-cent/ "carte/?focus=w-mtl-pumper-1" page-qui-nexiste-pas/; do
  for ua in "$UA_NAV" "$UA_GOOGLE"; do
    curl -sS -A "$ua" "https://$D/$p" -o /tmp/p.html -w "%{http_code}" > /tmp/c 2>&1
    echo "$(cat /tmp/c) $p | $(grep -o '<title>[^<]*' /tmp/p.html | head -1 | cut -c8- | cut -c1-70) | robots: $(grep -o '<meta name="robots" content="[^"]*' /tmp/p.html | cut -d'"' -f4)"
  done
done

titre "8. Version publiée et nouveautés (application installable, IA, miniatures)"
echo "publication.json : $(curl -sS --max-time 20 "https://$D/assets/publication.json?t=$(date +%s)" | cut -c1-200)"
for f in sw.js hors-ligne.html manifest.webmanifest llms.txt assets/icon-192.png assets/icon-512.png assets/icon-maskable-512.png assets/apple-touch-icon.png catalogue-mini/emperor-sultan.webp; do
  echo "$(curl -sS -o /tmp/f -A "$UA_NAV" --max-time 20 -w '%{http_code} %{content_type} %{size_download}o' "https://$D/$f") $f"
done
echo "sw.js : $(curl -sS --max-time 20 "https://$D/sw.js" | head -1)"
echo "manifeste : $(curl -sS --max-time 20 "https://$D/manifest.webmanifest" | cut -c1-160)"
echo "accueil : $(grep -o '<h1[^>]*>[^<]*' /tmp/accueil.html | head -1) | $(grep -c 'apple-touch-icon' /tmp/accueil.html) lien apple-touch-icon"
curl -sS --max-time 20 "https://$D/codes/" -o /tmp/codes.html; echo "codes : $(grep -c 'code-copy' /tmp/codes.html) boutons Copier | $(grep -o 'Combinaison (croix directionnelle) : [^<]*' /tmp/codes.html | head -1 | cut -c1-120)"

titre "9. Améliorations d'utilité (recherche, missions, Mon espace)"
echo "publication.json : $(curl -sS --max-time 20 "https://$D/assets/publication.json?t=$(date +%s)" | cut -c1-120)"
curl -sS --max-time 20 "https://$D/data/index.json" -o /tmp/idx.json; echo "index de recherche : $(grep -o '"pins":\[[^]]*' /tmp/idx.json | cut -c1-90) | listes de véhicules : $(grep -o 'Liste de véhicules' /tmp/idx.json | wc -l)"
curl -sS --max-time 20 "https://$D/missions/gone-fishing/" -o /tmp/m.html; echo "mission : $(grep -c 'href="#bloque"' /tmp/m.html) bouton Je suis bloqué | $(grep -c 'data-mission-suivante' /tmp/m.html) Mission suivante | $(grep -c 'data-spoil-tg' /tmp/m.html) interrupteur spoilers"
curl -sS --max-time 20 "https://$D/compte/" -o /tmp/c.html; echo "Mon espace : $(grep -c 'data-import' /tmp/c.html) import | $(grep -c 'data-pref="spoil"' /tmp/c.html) préférence spoilers"
echo "app.js : $(curl -sS --max-time 20 "https://$D/assets/app.js" | grep -c 'Signaler un guide manquant') message sans résultat"

titre "10. Corrections de fiabilité (audit du 25/11)"
curl -sS --max-time 20 "https://$D/codes/" -o /tmp/c.html; echo "codes : $(grep -c 'Contradictoire' /tmp/c.html) code contradictoire | $(grep -o 'Recoupée par deux sources distinctes' /tmp/c.html | wc -l) codes recoupés"
curl -sS --max-time 20 "https://$D/vehicules/moto-sportive/" -o /tmp/v.html; echo "moto sportive : $(grep -c 'Conseils pour le trouver' /tmp/v.html) conseils | $(grep -o 'b-a-verifier' /tmp/v.html | head -1)"
curl -sS --max-time 20 "https://$D/astuces/semer-la-police/" -o /tmp/a.html; echo "date de consultation inventée : $(grep -c 'Consultées le [0-9]' /tmp/a.html) (0 attendu)"
curl -sS --max-time 20 "https://$D/collection/playlist-unique/" -o /tmp/p.html; echo "playlists : $(grep -c '2 playlists uniques' /tmp/p.html) note d'écart"
curl -sS --max-time 20 "https://$D/a-propos/" -o /tmp/ap.html; echo "historique : $(grep -o '2026-11-25' /tmp/ap.html | wc -l) corrections du 25/11"

titre "11. Fiabilité, suite (missions, encyclopédie, recherche, code contradictoire)"
curl -sS --max-time 20 "https://$D/encyclopedie/vice-city/?t=$(date +%s)" -o /tmp/e.html; echo "encyclopédie : $(grep -c 'Sources détaillées' /tmp/e.html) bloc Sources détaillées | $(grep -o 'class="ref' /tmp/e.html | wc -l) renvois | $(grep -c 'cœur de Leonida' /tmp/e.html) « cœur de Leonida » (0 attendu)"
curl -sS --max-time 20 "https://$D/missions/?t=$(date +%s)" -o /tmp/ms.html; echo "missions : $(grep -o 'ordre à vérifier' /tmp/ms.html | wc -l) mentions « ordre à vérifier »"
curl -sS --max-time 20 "https://$D/codes/?t=$(date +%s)" -o /tmp/c2.html; echo "code Force des attaques : $(grep -c 'Version A' /tmp/c2.html) version A | $(grep -c 'Version B' /tmp/c2.html) version B | $(grep -c 'Essaie les deux' /tmp/c2.html) « Essaie les deux » (0 attendu)"
curl -sS --max-time 20 "https://$D/data/index.json?t=$(date +%s)" -o /tmp/i2.json; echo "recherche : $(grep -o 'Pas encore confirm' /tmp/i2.json | wc -l) réponses « Pas encore confirmé »"

titre "12. Fiches de missions"
curl -sS --max-time 20 "https://$D/missions/ambulance-chaser/?t=$(date +%s)" -o /tmp/mf.html; echo "fiche : $(grep -c 'Solution rapide' /tmp/mf.html) solution rapide | $(grep -c 'Avant de commencer' /tmp/mf.html) avant de commencer | $(grep -c 'Explications complémentaires' /tmp/mf.html) complément | $(grep -c 'data-mission-suivante' /tmp/mf.html) bouton suivante (1 attendu)"
curl -sS --max-time 20 "https://$D/missions/lab-fees/?t=$(date +%s)" -o /tmp/mf2.html; echo "ordre à vérifier : $(grep -c 'data-mission-suivante' /tmp/mf2.html) bouton suivante (0 attendu)"
curl -sS --max-time 20 "https://$D/missions/?t=$(date +%s)" -o /tmp/ml.html; echo "liste : $(grep -o 'selon GTABase, non vérifiée' /tmp/ml.html | wc -l) récompenses marquées non vérifiées"

titre "13. Page Codes allégée"
curl -sS --max-time 20 "https://$D/codes/?t=$(date +%s)" -o /tmp/cz.html; echo "codes : $(grep -c 'dont la combinaison a été relevée' /tmp/cz.html) intro (0 attendu) | $(grep -c 'mêmes sur PS5 et Xbox' /tmp/cz.html) phrase PS5/Xbox (0 attendu)"
