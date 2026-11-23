"""Missions de GTA 6 : écrit data/missions.json.

Liste, ordre, chapitres, donneurs et récompenses : relevé GTABase du 22/11/2026 (vendor/missions/gtabase-*.json),
recoupé avec gta6guide.fr et GTA Wiki (vendor/missions/*-liste.txt).
Noms français, résumés, étapes et conseils : rédigés par le site (tools/missions_fr/)."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from missions_fr import ch1, ch2, ch3, ch45
FR = {**ch1.M, **ch2.M, **ch3.M, **ch45.M}
V = os.path.join(ROOT, 'vendor', 'missions')
D = json.load(open(os.path.join(V, 'gtabase-detail.json')))
assert len(D) == len(FR) == 134, (len(D), len(FR))
n = lambda s: re.sub(r'[^a-z0-9]', '', s.lower().replace('’', "'"))
G6 = {n(l) for l in open(os.path.join(V, 'gta6guide-liste.txt')).read().split('\n')}
WK = {n(l) for l in open(os.path.join(V, 'gtawiki-liste.txt')).read().split('\n')}
# deux missions portent un autre nom sur gta6guide.fr
G6_ALIAS = {'Play Nurse': 'Take Care of Jason', 'Got Pills?': 'Painkiller Supplier'}

CHAP = [('prologue', 'Prologue', "Lucia en prison, juste avant le début de l'histoire."),
        ('1', 'Comme au paradis', 'Jason dans les Keys, puis la sortie de prison de Lucia.'),
        ('2', 'Le paradis perdu', 'En fuite, le couple se cache à Port Gellhorn.'),
        ('3', 'Sexe, drogue et fric', 'Arrivée à Vice City et braquage de la banque du cartel.'),
        ('4', 'Vice City, bébé', "La vie à Ocean Beach et le braquage de l'aéroport."),
        ('5', "Au sommet du monde, m'man", 'Le final : plusieurs fins possibles (cinq selon la plupart des guides).')]

def recompense(r):
    if not r or r.lower() == 'none' or r.startswith('None'): return ''
    r = re.sub(r'(\d+) unlocks?', lambda m: f"{m.group(1)} déblocage{'s' if m.group(1) != '1' else ''}", r)
    r = re.sub(r'\$([\d,]+)', lambda m: m.group(1).replace(',', ' ') + ' $', r)
    T = [('depends on how the mission goes', 'selon le déroulement'), ('more if you sell the leftover cocaine to Donnie', 'de plus si tu vends le reste de cocaïne à Donnie'),
         ('if you sell the drugs to Brian', 'si tu vends la drogue à Brian'), ('back from Vicki via BuckMe', 'rendus par Vicki sur BuckMe'),
         ('Up to around', "Jusqu'à environ"), ('Up to', "Jusqu'à"), ('less if the Crawler is damaged', 'moins si le Crawler est abîmé'), ('from Dunk via BuckMe (next day)', 'de Dunk sur BuckMe (le lendemain)'),
         ('BuckMe Silver Checking Account', 'Compte BuckMe Silver'), ('BuckMe Black account', 'Compte BuckMe Black'), ('account limit', 'de plafond'), ('limit', 'de plafond'), ('interest if you reached the first', "d'intérêts si tu as atteint le premier objectif de"),
         ('Family Savings goal', "d'épargne familiale"), ('depending on your race position', 'selon ta place'), ('depending on your race placement', 'selon ta place'),
         ('from Vicki via BuckMe (next day)', 'de Vicki sur BuckMe (le lendemain)'), ('At least', 'Au moins'), ('in cash (from helping Frankie and Mario or from Frankie’s office)', 'en liquide (en aidant Frankie et Mario ou dans le bureau de Frankie)'),
         ('Around', 'Environ'), ('in jewelry and cash', 'en bijoux et liquide'), ('from Mia (sent many in-game days later)', 'de Mia (envoyés plusieurs jours plus tard)'),
         ('bonus if the car is delivered in good condition', 'de bonus si la voiture est livrée intacte'), ('Prize money based on your finishing position', 'Gain selon ta place'),
         ('for first place', 'pour la 1re place'), ('inside the practice safe', "dans le coffre d'entraînement"), ('about', 'environ'), ('in stolen goods and drugs to fence', 'en objets volés et drogue à revendre'),
         ('only if you take Boobie’s bricks on the way out', 'seulement si tu prends les briques de Boobie en partant'), ('for the requested items', 'pour les objets demandés'),
         ('paying Eddie costs', 'payer Eddie coûte'), ('if you kill Felipe', 'si tu tues Felipe'),
         ('based on your choices', 'selon tes choix'), ('in marked bills (if you grab them all)', 'en billets marqués (si tu prends tout)')]
    for a, b in T: r = r.replace(a, b)
    parts = [re.sub(r'\s+', ' ', x).strip() for x in r.split(' + ')]
    return ' · '.join(dict.fromkeys(parts))

PERSO = {'J': 'jason', 'L': 'lucia'}
out = []
for k, d in enumerate(D):
    nom, resume, etapes, bloque = FR[k]
    ch = 'prologue' if d['chap'] == 'Prologue' else d['chap'][-1]
    en = d['name']
    src = ['GTABase'] + (['gta6guide.fr'] if n(G6_ALIAS.get(en, en)) in G6 else []) + (['GTA Wiki'] if n(en) in WK else [])
    prot = sorted({PERSO[p[0].upper()] for p in d['prot']}) or ['jason', 'lucia']
    giver = d['info'].get('Mission Giver', '').replace(' , ', ', ')
    out.append({'id': d['url'].rstrip('/').split('/')[-1], 'num': d['num'], 'chapitre': ch, 'nom': nom, 'nomEn': en,
                'facultative': 'opt' in d['badges'], 'manquable': 'miss' in d['badges'], 'perso': prot, 'donneur': giver,
                'recompense': recompense(d['info'].get('Rewards', '')), 'resume': resume, 'etapes': etapes, 'bloque': bloque, 'sources': src})
# --- vérification du 23/11/2026 (listes par chapitre de TheClick, HowToVideoGame, games.gg, Push Square, Dexerto) ---
# petites tâches de l'histoire : les guides ne les comptent pas parmi les 91 à 93 missions principales
TACHES = {'Deposit Cash Into BuckMe', 'Save for the Future', 'Building a Life', 'Play Nurse', 'Overnight Charges', 'New Look', 'How Do I Look?',
          'Got Pills?', 'Behind on Payments', 'Prepare for Vice City', 'Send Money to Lorena', 'Send More Money to Lorena', 'Heist Planning',
          'Pool Day', 'Tie Up Loose Ends', 'Honest Abe', 'Unfinished Business'}
for m in out:
    if m['nomEn'] in TACHES: m['tache'] = True
# ordre corrigé d'après le consensus des guides : (mission à déplacer, à placer juste après)
APRES = [('Just a Scratch', 'Gear Up'), ('Lab Fees', 'Just a Scratch'), ('Unwanted Attention', 'Lab Fees'), ('Pipework', 'Unwanted Attention'),
         ('Buck Me', 'Coming Home'), ('Clear Skies', 'Down to Earth'), ('Too Much Baggage', 'Dirty Work'), ('VC Baby', 'Taking Liberties')]
for a_, b_ in APRES:
    i = next(k for k, m in enumerate(out) if m['nomEn'] == a_); m = out.pop(i)
    j = next(k for k, x in enumerate(out) if x['nomEn'] == b_); out.insert(j + 1, m)
# mission facultative absente du relevé GTABase des missions : « Take Out Kitty Litter » (Tyrone), listée comme rencontre
i = next(k for k, m in enumerate(out) if m['nomEn'] == 'Here, Kitty Kitty')
out.insert(i + 1, {'id': 'take-out-kitty-litter', 'num': None, 'chapitre': '3', 'nom': 'Les labos de Kitty Litter', 'nomEn': 'Take Out Kitty Litter',
    'facultative': True, 'manquable': False, 'perso': ['jason', 'lucia'], 'donneur': 'Tyrone', 'recompense': '2 000 à 2 500 $ par labo détruit',
    'resume': "Mission facultative : détruire les labos de drogue Kitty Litter pour Tyrone. Elle compte pour le 100 %.",
    'etapes': ["Termine la mission « Here, Kitty Kitty » (chapitre 3) : Tyrone te confie la mission.", "Trouve les labos (14 ou 15 selon les guides) et détruis-les : Tyrone te paie sur BuckMe pour chacun.", "Quand tu en as détruit assez, la mission finale de Tyrone, « Spin On This », se débloque."],
    'bloque': ["Le garage de Balsero demande un code : 1999.", "Les labos sont aussi en jeu libre : tu peux les détruire à ton rythme, sans indication."],
    'sources': ['GTABase', 'TheClick', 'EGamers']})
k = 0
for m in out:
    if not m['facultative']: k += 1; m['num'] = k
json.dump({'info': 'Missions de GTA 6 (relevé du 22/11/2026). Liste : GTABase, recoupée avec gta6guide.fr et GTA Wiki. Textes rédigés par le site. Généré par tools/missions.py.',
           'chapitres': [{'id': c[0], 'titre': c[1], 'resume': c[2]} for c in CHAP], 'missions': out},
          open(os.path.join(ROOT, 'data', 'missions.json'), 'w'), ensure_ascii=False, indent=1)
print(sum(1 for m in out if not m['facultative'] and not m.get('tache')), 'missions principales ·', sum(1 for m in out if m.get('tache')), 'tâches ·', len(out), 'entrées ·', sum(1 for m in out if not m['facultative']), 'principales ·', sum(1 for m in out if m['facultative']), 'facultatives ·',
      sum(1 for m in out if len(m['sources']) > 1), 'confirmées par 2 sources ou plus')
