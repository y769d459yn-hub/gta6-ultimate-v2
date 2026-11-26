/* GTA 6 Facile — administration.
   La page est publique mais vide : rien ne s'affiche tant que Supabase n'a pas confirmé que le compte connecté
   est administrateur (fonction est_admin). Les statistiques, la liste des comptes et l'écriture du contenu
   sont refusées par Supabase à tout autre compte, même si quelqu'un modifie ce script. */
(() => {
  'use strict';
  const box = document.querySelector('[data-admin]'); if (!box) return;
  const ROOT = document.body.dataset.root || './';
  const $ = (s, c = box) => c.querySelector(s);
  const $$ = (s, c = box) => [...c.querySelectorAll(s)];
  const LG = () => window.LG || {};
  const ic = (n) => (LG().ic ? LG().ic(n) : '');
  const toast = (t, i = 'check') => LG().toast && LG().toast(t, i);
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const slug = (s = '') => norm(s).replace(/ /g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  const date = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const jour = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  function etat(t, i = 'shield') { const e = $('[data-adm-etat]'); e.hidden = !t; if (t) e.innerHTML = ic(i) + `<span>${t}</span>`; }

  let sb = null, BASE = {}, LIGNES = [], PUB = null;
  const NOMS = { actualites: 'Actualités', astuces: 'Astuces', codes: 'Codes de triche', missions: 'Missions', dossiers: 'Dossiers', encyclopedie: 'Encyclopédie', lieux: 'Lieux', vehicules: 'Véhicules', glitchs: 'Glitchs', versions: 'Versions du jeu' };
  const LIBELLES = {
    titre: 'Titre', nom: 'Nom', nomEn: 'Nom anglais', court: 'Titre court', bref: 'Résumé', reponse: 'Réponse', resume: 'Résumé', desc: 'Description',
    date: 'Date (AAAA-MM-JJ)', statut: 'Statut', theme: 'Thème', cat: 'Catégorie', icon: 'Icône', etapes: 'Étapes', asavoir: 'À savoir', duree: 'Durée (minutes)',
    niveau: 'Niveau', sources: 'Sources', annonce: 'Ce qui a été annoncé', change: 'Ce que ça change', inconnu: 'Ce qui reste inconnu', liens: 'Liens vers des guides',
    kw: 'Mots-clés de recherche', voir: 'Voir aussi', effet: 'Effet', deblocage: 'Comment le débloquer', sequence: 'Séquence (haut, bas, gauche, droite…)',
    confirme: 'Confirmé', argent: 'Donne de l’argent', chapitre: 'Chapitre', num: 'Numéro', facultative: 'Facultative', manquable: 'Peut être manquée', tache: 'Petite tâche',
    perso: 'Personnages', donneur: 'Donnée par', recompense: 'Récompense', bloque: 'Si tu es bloqué', sait: 'Ce que l’on sait', incertain: 'Encore incertain',
    region: 'Région', precision: 'Précision de la position', acces: 'Accès', type: 'Type', sous: 'Sous-type', dispo: 'Disponibilité', lieu: 'Lieu', emplacement: 'Emplacement', obtenir: 'Comment l’obtenir',
    color: 'Couleur', couleur: 'Couleur', seo: 'Titre Google', faq: 'Questions fréquentes', sections: 'Sections',
    publie: 'Publié', gain: 'Gain (avec la source)', gainCourt: 'Gain court (carte)', difficulte: 'Difficulté (facile, moyenne, difficile)', difficulteNote: 'Précision sur la difficulté', plateformes: 'Plateformes', mode: 'Mode de jeu', version: 'Version du jeu des sources', etabliLe: 'Date des sources (AAAA-MM-JJ)', verifieLe: 'Dernière vérification (AAAA-MM-JJ)', publieLe: 'Date de publication', utilite: 'Utilité (1 à 3)', prerequis: 'Prérequis', variantes: 'Variantes', problemes: 'Problèmes fréquents', risques: 'Risques', emplacements: 'Emplacements sur la carte', videos: 'Vidéos', retours: 'Retours des joueurs', historique: 'Historique du statut', brouillon: 'Raison du brouillon', alternatives: 'Alternatives sans glitch', notes: 'Notes de mise à jour', source: 'Source', url: 'Lien'
  };

  // ---------- démarrage ----------
  (async () => {
    const c = window.LG_COMPTE ? await window.LG_COMPTE : null;
    if (!c || !c.user) { etat(`Connecte-toi d’abord avec ton compte administrateur dans <a href="${ROOT}compte/">Mon espace</a>.`, 'user'); return; }
    sb = c.sb;
    const { data: ok } = await sb.rpc('est_admin');
    if (ok !== true) { etat('Accès réservé à l’administrateur du site.', 'x'); return; }
    etat('');
    $('[data-adm-app]').hidden = false;
    $$('[data-adm-tab]').forEach((b) => b.addEventListener('click', () => onglet(b.dataset.admTab)));
    try { BASE = await (await fetch(ROOT + 'assets/admin-donnees.json', { cache: 'no-store' })).json(); } catch (e) { BASE = {}; }
    await rechargerLignes();
    stats(); contenu(); comptes(); glitchsAdmin();
  })();

  function onglet(n) {
    $$('[data-adm-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.admTab === n)));
    $$('[data-adm-vue]').forEach((v) => { v.hidden = v.dataset.admVue !== n; });
  }

  const GC = (document.querySelector('script[data-gc]') || { dataset: {} }).dataset.gc || ''; // code GoatCounter du site
  async function rechargerLignes() {
    const { data } = await sb.from('contenu').select('collection,cle,donnees,supprime,maj').order('maj', { ascending: false });
    LIGNES = data || [];
    try { PUB = await (await fetch(ROOT + 'assets/publication.json?t=' + Date.now(), { cache: 'no-store' })).json(); } catch (e) { PUB = null; }
    publication();
  }

  // bandeau : ce qui est déjà en ligne, ce qui attend la prochaine publication
  function publication() {
    const e = $('[data-adm-pub]');
    const depuis = PUB && PUB.date ? new Date(PUB.date) : null;
    const attente = LIGNES.filter((l) => !depuis || new Date(l.maj) > depuis).length;
    // modifications en attente depuis plus d'une heure : la publication automatique est probablement arrêtée
    const vieille = LIGNES.filter((l) => depuis && new Date(l.maj) > depuis && Date.now() - new Date(l.maj) > 3600e3).length;
    e.innerHTML = (vieille ? `<p class="adm-err">${ic('alert')}<span>${vieille} modification${vieille > 1 ? 's attendent' : ' attend'} depuis plus d’une heure. La publication automatique semble arrêtée : sur GitHub, onglet <b>Actions</b> → <b>Publier le site</b>, vérifie qu’elle est activée (GitHub la met en pause après 60 jours sans activité sur le dépôt) puis touche <b>Run workflow</b>.</span></p>` : '') + `<p>${ic('refresh')}<span>Site mis à jour le <b>${date(PUB && PUB.date)}</b>.${attente ? ` <b class="adm-wait">${attente} modification${attente > 1 ? 's' : ''} en attente</b> : en ligne d’ici 10 à 20 minutes.` : ' Tout est en ligne.'}</span></p>` +
      (PUB && PUB.erreur ? `<p class="adm-err">${ic('x')}<span>La dernière publication a échoué à cause d’une modification : le site est resté sur l’ancienne version. Vérifie tes dernières modifications.</span></p>` : '');
  }

  // ---------- statistiques ----------
  async function stats() {
    const v = $('[data-adm-vue="stats"]'); v.innerHTML = `<p class="muted">Chargement…</p>`;
    const { data: s, error } = await sb.rpc('admin_stats');
    if (error || !s) { v.innerHTML = `<p class="adm-err">${ic('x')}<span>Statistiques indisponibles.</span></p>`; return; }
    const titre = (col, id) => { const b = BASE[col]; const x = b && b.items.find((i) => String(i[b.cle]) === String(id)); return x ? x[b.titre] : id; };
    const top = (t, l, f) => `<section class="adm-card"><h2 class="h3">${t}</h2>${l.length ? `<ol class="adm-top">${l.map((x) => `<li><span>${f(x)}</span><b>${x.n}</b></li>`).join('')}</ol>` : '<p class="muted">Pas encore de données.</p>'}</section>`;
    const TYPES = { astuce: 'Astuce', vehicule: 'Véhicule', lieu: 'Lieu', mission: 'Mission', code: 'Code', encyclopedie: 'Encyclopédie', dossier: 'Dossier' };
    v.innerHTML = `<div class="adm-nums">
      ${[['Comptes', s.comptes, 'user'], ['Nouveaux (7 j)', s.nouveaux_7j, 'plus'], ['Nouveaux (30 j)', s.nouveaux_30j, 'star'], ['Actifs (7 j)', s.actifs_7j, 'bolt'], ['E-mails confirmés', s.confirmes, 'check'], ['Favoris enregistrés', s.favoris, 'heart']]
        .map(([t, n, i]) => `<div class="adm-num">${ic(i)}<b>${n}</b><small>${t}</small></div>`).join('')}
    </div>
    ${top(`${ic('heart')}Les plus ajoutés en favoris`, s.top_favs, (x) => `<a href="${ROOT}${esc(x.u || '')}">${esc(x.t || x.id)}</a> <small class="muted">${TYPES[x.type] || esc(x.type || '')}</small>`)}
    ${top(`${ic('flag')}Missions les plus terminées`, s.top_missions, (x) => esc(titre('missions', x.id)))}
    ${top(`${ic('check')}Astuces les plus marquées « faites »`, s.top_faites, (x) => esc(titre('astuces', x.id)))}
    ${GC ? `<section class="adm-card"><h2 class="h3">${ic('search')}Recherches sans résultat</h2><p class="muted small">Ce que les visiteurs cherchent sur le site sans rien trouver : ce sont les contenus qui manquent. Compté de façon anonyme, sans cookie, par GoatCounter (ainsi que les combinaisons de codes copiées).</p><p><a class="btn-s" href="https://${GC}.goatcounter.com/?filter=recherche-sans-resultat" target="_blank" rel="noopener">${ic('arrow-right')}<span>Voir les recherches sans résultat</span></a> <a class="btn-s btn-s--ghost" href="https://${GC}.goatcounter.com/?filter=code-copie" target="_blank" rel="noopener"><span>Codes copiés</span></a></p></section>` : ''}
    <p class="muted small">Visites du site : GoatCounter${GC ? ` (<a href="https://${GC}.goatcounter.com/" target="_blank" rel="noopener">tableau de bord</a>)` : ''}. Recherches Google : Google Search Console.</p>`;
  }

  // ---------- comptes ----------
  async function comptes() {
    const v = $('[data-adm-vue="comptes"]'); v.innerHTML = `<p class="muted">Chargement…</p>`;
    const { data, error } = await sb.rpc('admin_comptes');
    if (error) { v.innerHTML = `<p class="adm-err">${ic('x')}<span>Liste indisponible.</span></p>`; return; }
    v.innerHTML = `<label class="field">${ic('search')}<input type="search" data-adm-cq placeholder="Chercher une adresse e-mail" autocomplete="off"></label>
    <p class="muted small">${data.length} compte${data.length > 1 ? 's' : ''}</p>
    <div class="adm-list">${data.map((u) => `<div class="adm-row" data-q="${esc(norm(u.adresse))}">
      <div class="adm-row-t"><b>${esc(u.adresse)}</b>${u.est_admin ? `<span class="pill pill--ok">${ic('shield')}Admin</span>` : ''}${u.confirme ? '' : '<span class="pill">E-mail non confirmé</span>'}</div>
      <small class="muted">Créé le ${jour(u.cree)} · dernière connexion ${jour(u.vu)} · ${u.nb_favoris} favori${u.nb_favoris > 1 ? 's' : ''}</small>
      ${u.est_admin ? '' : `<button class="btn btn--ghost adm-del" type="button" data-adm-del="${u.uid}" data-adm-mail="${esc(u.adresse)}">${ic('x')}Supprimer</button>`}
    </div>`).join('')}</div>`;
    $('[data-adm-cq]', v).addEventListener('input', (e) => { const q = norm(e.target.value); $$('.adm-row', v).forEach((r) => { r.hidden = q && !r.dataset.q.includes(q); }); });
    $$('[data-adm-del]', v).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(`Supprimer définitivement le compte ${b.dataset.admMail} et ses favoris enregistrés ?`)) return;
      const { error: e } = await sb.rpc('admin_supprimer_compte', { cible: b.dataset.admDel });
      if (e) { toast('Suppression impossible', 'x'); return; }
      toast('Compte supprimé'); comptes(); stats();
    }));
  }

  // ---------- contenu ----------
  let COL = 'actualites', Q = '';
  const ligne = (col, cle) => LIGNES.find((l) => l.collection === col && l.cle === String(cle));
  function elements(col) {
    const b = BASE[col]; if (!b) return [];
    const out = b.items.map((x) => ({ cle: String(x[b.cle]), item: x, orig: x }));
    LIGNES.filter((l) => l.collection === col).forEach((l) => {
      const e = out.find((o) => o.cle === l.cle);
      if (e) { e.item = { ...e.orig, ...l.donnees }; e.ligne = l; } else out.push({ cle: l.cle, item: l.donnees, ligne: l, nouveau: true });
    });
    if (col === 'actualites') out.sort((a, c) => String(c.item.date || '').localeCompare(String(a.item.date || '')));
    if (col === 'missions') out.sort((a, c) => (a.item.num || 0) - (c.item.num || 0));
    return out;
  }
  function contenu() {
    const v = $('[data-adm-vue="contenu"]');
    v.innerHTML = `<div class="adm-quick"><button class="btn btn--primary" type="button" data-adm-new-actu>${ic('plus')}Publier une actualité</button></div>
    <div class="adm-cols" role="group" aria-label="Rubrique">${Object.keys(NOMS).filter((n) => BASE[n]).map((n) => `<button type="button" class="chip" data-adm-col="${n}" aria-pressed="${n === COL}">${NOMS[n]}</button>`).join('')}</div>
    <div class="adm-bar"><label class="field">${ic('search')}<input type="search" data-adm-q placeholder="Chercher" autocomplete="off" value="${esc(Q)}"></label><button class="btn" type="button" data-adm-new>${ic('plus')}Ajouter</button></div>
    <div class="adm-list" data-adm-items></div>`;
    $$('[data-adm-col]', v).forEach((b) => b.addEventListener('click', () => { COL = b.dataset.admCol; Q = ''; contenu(); }));
    $('[data-adm-q]', v).addEventListener('input', (e) => { Q = e.target.value; liste(); });
    $('[data-adm-new]', v).addEventListener('click', () => editer(COL, null));
    $('[data-adm-new-actu]', v).addEventListener('click', () => { COL = 'actualites'; contenu(); editer('actualites', null); });
    liste();
  }
  function liste() {
    const b = BASE[COL]; const q = norm(Q);
    const l = elements(COL).filter((e) => !q || norm(`${e.item[b.titre]} ${e.cle}`).includes(q));
    $('[data-adm-items]').innerHTML = l.map((e) => {
      const st = e.ligne && e.ligne.supprime ? '<span class="pill adm-pill-del">Supprimé</span>' : e.nouveau ? '<span class="pill pill--ok">Ajouté</span>' : e.ligne ? '<span class="pill adm-pill-mod">Modifié</span>' : '';
      return `<button type="button" class="adm-row adm-row--btn" data-adm-edit="${esc(e.cle)}"><span class="adm-row-t"><b>${esc(e.item[b.titre] || e.cle)}</b>${st}</span><small class="muted">${esc(e.cle)}${e.item.date ? ' · ' + esc(e.item.date) : ''}</small></button>`;
    }).join('') || '<p class="muted">Aucun élément.</p>';
    $$('[data-adm-edit]').forEach((x) => x.addEventListener('click', () => editer(COL, x.dataset.admEdit)));
  }

  // valeurs déjà utilisées pour un champ (catégories, statuts…) : on propose une liste pour éviter les fautes
  function choix(col, k) {
    if (k === BASE[col].titre || ['date', 'nomEn', 'court', 'donneur', 'recompense', 'lieu', 'seo'].includes(k)) return null;
    const l = BASE[col].items.map((x) => x[k]).filter((x) => typeof x === 'string' && x);
    const vals = new Set(l);
    // seulement les champs à valeurs répétées (catégorie, statut, région…) : jamais un texte libre
    return vals.size > 1 && vals.size <= 30 && vals.size * 2 <= l.length && [...vals].every((x) => x.length < 40) ? [...vals].sort() : null;
  }
  // valeur la plus utilisée d'un champ : valeur par défaut d'un nouvel élément
  function frequent(col, k) {
    const n = {}; BASE[col].items.forEach((x) => { if (typeof x[k] === 'string') n[x[k]] = (n[x[k]] || 0) + 1; });
    return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];
  }
  function modele(col) {
    const it = BASE[col].items, types = {};
    it.forEach((x) => Object.entries(x).forEach(([k, v]) => { if (!(k in types)) types[k] = v; }));
    return types;
  }

  function editer(col, cle) {
    const b = BASE[col], types = modele(col);
    const e = cle == null ? null : elements(col).find((x) => x.cle === cle);
    const communs = Object.keys(types).filter((k) => b.items.every((x) => k in x));
    const item = e ? { ...e.item } : Object.fromEntries(communs.map((k) => {
      const t = types[k], c = choix(col, k);
      return [k, k === 'date' ? new Date().toISOString().slice(0, 10) : c ? frequent(col, k) : Array.isArray(t) ? [] : typeof t === 'number' ? 0 : typeof t === 'boolean' ? false : t && typeof t === 'object' ? {} : ''];
    }));
    const cles = [...new Set([...Object.keys(types), ...Object.keys(item)])].filter((k) => k !== b.cle && (k in item || communs.includes(k)));
    cles.sort((x, y) => (x === b.titre ? -1 : y === b.titre ? 1 : 0));
    const champ = (k) => {
      const v = item[k], t = k in types ? types[k] : v, lab = esc(LIBELLES[k] || k), c = choix(col, k);
      if (typeof t === 'boolean') return `<label class="adm-check"><input type="checkbox" name="${k}" ${v ? 'checked' : ''}>${lab}</label>`;
      if (typeof t === 'number') return `<label>${lab}<input type="number" name="${k}" value="${esc(v ?? 0)}" inputmode="numeric"></label>`;
      if (Array.isArray(t) && (!t.length || typeof t[0] === 'string') && (!Array.isArray(v) || v.every((x) => typeof x === 'string'))) return `<label>${lab}<small>Un élément par ligne</small><textarea name="${k}" rows="${Math.min(10, Math.max(3, (v || []).length + 1))}" data-type="lignes">${esc((v || []).join('\n'))}</textarea></label>`;
      if (t && typeof t === 'object') return `<label>${lab}<small>Format avancé (JSON) : modifie avec prudence</small><textarea name="${k}" rows="8" data-type="json" spellcheck="false">${esc(JSON.stringify(v ?? (Array.isArray(t) ? [] : {}), null, 2))}</textarea></label>`;
      if (c) return `<label>${lab}<select name="${k}">${[...new Set([...(v ? [v] : []), ...c])].map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
      const long = String(v || '').length > 60 || ['reponse', 'bref', 'resume', 'desc', 'change', 'asavoir', 'effet', 'obtenir', 'emplacement', 'acces'].includes(k);
      return long ? `<label>${lab}<textarea name="${k}" rows="4">${esc(v || '')}</textarea></label>` : `<label>${lab}<input type="text" name="${k}" value="${esc(v || '')}"></label>`;
    };
    const v = $('[data-adm-vue="contenu"]');
    v.innerHTML = `<button class="btn btn--ghost" type="button" data-adm-back>${ic('arrow-left')}Retour à la liste</button>
    <h2 class="h3">${e ? 'Modifier' : 'Ajouter'} · ${NOMS[col]}</h2>
    ${e && e.ligne && e.ligne.supprime ? `<p class="adm-err">${ic('x')}<span>Cet élément est supprimé du site.</span></p>` : ''}
    <form class="auth-form adm-form" data-adm-form>
      ${champ(b.titre)}
      <label>Identifiant (adresse de la page)<input type="text" name="__cle" value="${esc(cle || '')}" ${e ? 'readonly' : 'required'} pattern="[a-z0-9][a-z0-9\\-]{0,80}" autocapitalize="off" spellcheck="false"><small>${e ? 'Ne peut pas être changé.' : 'Rempli automatiquement depuis le titre. Lettres minuscules, chiffres et tirets.'}</small></label>
      ${cles.filter((k) => k !== b.titre).map(champ).join('')}
      <p class="adm-err" data-adm-msg hidden></p>
      <div class="adm-actions">
        <button class="btn btn--primary" type="submit">${ic('check')}${e && e.ligne && e.ligne.supprime ? 'Enregistrer et remettre en ligne' : 'Enregistrer'}</button>
        ${e && !e.nouveau && e.ligne ? `<button class="btn" type="button" data-adm-reset>${ic('refresh')}Revenir à l’original</button>` : ''}
        ${e && !(e.ligne && e.ligne.supprime) ? `<button class="btn btn--ghost adm-del" type="button" data-adm-rm>${ic('x')}Supprimer du site</button>` : ''}
      </div>
    </form>`;
    v.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const f = $('[data-adm-form]', v);
    const msg = (t) => { const m = $('[data-adm-msg]', v); m.hidden = !t; m.textContent = t || ''; };
    if (!e) {
      const tt = f.elements[b.titre], kk = f.elements.__cle; let touche = false;
      kk.addEventListener('input', () => { touche = true; });
      tt.addEventListener('input', () => { if (!touche) kk.value = typeof types[b.cle] === 'number' ? kk.value : slug(tt.value); });
    }
    $('[data-adm-back]', v).addEventListener('click', contenu);
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); msg('');
      const k = f.elements.__cle.value.trim();
      if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(k)) return msg('Identifiant invalide : lettres minuscules, chiffres et tirets seulement.');
      if (!e && elements(col).some((x) => x.cle === k)) return msg('Cet identifiant existe déjà : choisis-en un autre.');
      const d = {};
      for (const x of cles) {
        const el = f.elements[x]; if (!el) continue;
        if (el.type === 'checkbox') d[x] = el.checked;
        else if (el.type === 'number') d[x] = Number(el.value) || 0;
        else if (el.dataset.type === 'lignes') d[x] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
        else if (el.dataset.type === 'json') { try { d[x] = JSON.parse(el.value || 'null'); } catch (er) { return msg(`Le champ « ${LIBELLES[x] || x} » n’est pas un JSON valide.`); } }
        else d[x] = el.value.trim();
      }
      if (!String(d[b.titre] || '').trim()) return msg('Le titre est obligatoire.');
      if ('date' in d && d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return msg('La date doit être au format AAAA-MM-JJ, par exemple 2026-11-23.');
      const bt = f.querySelector('[type=submit]'); bt.disabled = true;
      const { error } = await sb.from('contenu').upsert({ collection: col, cle: k, donnees: d, supprime: false, maj: new Date().toISOString() });
      bt.disabled = false;
      if (error) return msg('Enregistrement impossible : ' + (error.message || 'erreur inconnue'));
      toast('Enregistré : en ligne d’ici 10 à 20 minutes');
      await rechargerLignes(); contenu();
    });
    const rm = $('[data-adm-rm]', v);
    if (rm) rm.addEventListener('click', async () => {
      if (!confirm('Retirer cet élément du site ? Tu pourras le remettre ensuite.')) return;
      const { error } = await sb.from('contenu').upsert({ collection: col, cle, donnees: e.item, supprime: true, maj: new Date().toISOString() });
      if (error) { toast('Suppression impossible', 'x'); return; }
      toast('Retiré du site d’ici 10 à 20 minutes'); await rechargerLignes(); contenu();
    });
    const rs = $('[data-adm-reset]', v);
    if (rs) rs.addEventListener('click', async () => {
      if (!confirm('Annuler toutes tes modifications sur cet élément et revenir à la version d’origine ?')) return;
      const { error } = await sb.from('contenu').delete().eq('collection', col).eq('cle', cle);
      if (error) { toast('Impossible', 'x'); return; }
      toast('Version d’origine restaurée'); await rechargerLignes(); contenu();
    });
  }

  // ---------- glitchs : statuts, publication, versions du jeu, import, votes ----------
  const GST = { fonctionnel: 'Fonctionnel', documente: 'Bien documenté', 'a-reverifier': 'À revérifier', 'non-confirme': 'Non confirmé', corrige: 'Corrigé', faux: 'Faux' };
  const GCAT = ['argent', 'vehicules', 'armes', 'secrets', 'gameplay', 'duplication'];
  const auj = () => new Date().toISOString().slice(0, 10);
  async function ecrire(col, cle, donnees, msg) {
    const { error } = await sb.from('contenu').upsert({ collection: col, cle, donnees, supprime: false, maj: new Date().toISOString() });
    if (error) { toast(/check|violates/i.test(error.message) ? 'Base non prête : exécute supabase/glitchs.sql dans Supabase' : 'Erreur : ' + error.message, 'x'); return false; }
    toast(msg || 'Enregistré, en ligne à la prochaine publication'); await rechargerLignes(); glitchsAdmin(); return true;
  }
  function glitchsAdmin() {
    const v = $('[data-adm-vue="glitchs"]'); if (!v || !BASE.glitchs) return;
    const vers = elements('versions').map((e) => e.item).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const vd = vers[vers.length - 1];
    const L = elements('glitchs');
    const aff = (g) => (vd && ['fonctionnel', 'documente'].includes(g.statut) && (g.version ? g.version < vd.id : String(g.etabliLe || '') < vd.date) ? `À revérifier (dernier statut : ${GST[g.statut]})` : GST[g.statut] || g.statut);
    v.innerHTML = `<p class="adm-note">${ic('info')}Dernière version du jeu : <b>${esc(vd ? vd.id + ' (' + jour(vd.date) + ')' : 'aucune')}</b>. Un glitch « Fonctionnel » ou « Bien documenté » plus ancien s’affiche « À revérifier » sur le site jusqu’à un nouveau contrôle.</p>
    <div class="adm-list">${L.map((e) => { const g = e.item; const lu = (g.sources || []).some((x) => x.lu); return `<div class="adm-row"><span><b>${esc(g.titre)}</b><small>${esc(aff(g))} · ${g.publie ? (lu ? 'publié' : 'publié mais aucune source lue : reste hors ligne') : 'brouillon'}${g.version ? ' · version ' + esc(g.version) : ''} · vérifié le ${esc(jour(g.verifieLe))}</small></span>
      <span class="adm-acts"><button class="btn" type="button" data-g-ed="${esc(e.cle)}">${ic('wrench')}Modifier</button><button class="btn" type="button" data-g-pub="${esc(e.cle)}">${g.publie ? 'Dépublier' : 'Publier'}</button><button class="btn" type="button" data-g-ok="${esc(e.cle)}">${ic('check')}Fonctionne après test</button><button class="btn" type="button" data-g-corr="${esc(e.cle)}">${ic('x')}Archiver : corrigé</button></span></div>`; }).join('')}</div>
    <details class="adm-box"><summary>${ic('plus')}Nouvelle version du jeu</summary><form data-g-ver><label>Numéro<input name="id" required pattern="[0-9.]{3,20}" placeholder="01.002.003"></label><label>Date de sortie<input type="date" name="date" required></label><label>Ce qu’elle change<textarea name="notes" rows="3"></textarea></label><label>Source (nom)<input name="source"></label><label>Lien de la source<input type="url" name="url"></label><button class="btn btn--primary" type="submit">Ajouter la version</button></form></details>
    <details class="adm-box"><summary>${ic('download')}Importer des glitchs (JSON validé)</summary><p class="adm-note">Colle une liste de glitchs au format de data/glitchs.json. Chaque glitch importé arrive en brouillon : publie-le après avoir lu ses sources.</p><textarea rows="8" data-g-json spellcheck="false" placeholder='[{"slug":"mon-glitch","titre":"…","cat":"argent","statut":"non-confirme","etapes":[{"t":"…"}],"sources":[{"nom":"…","url":"https://…","lu":false}]}]'></textarea><button class="btn" type="button" data-g-imp>Vérifier et importer</button><p data-g-imp-r></p></details>
    <details class="adm-box" data-g-votes-box><summary>${ic('talk')}Votes des joueurs</summary><div data-g-votes>Ouvre pour charger les votes.</div></details>`;
    const trouve = (cle) => L.find((e) => e.cle === cle).item;
    $$('[data-g-ed]', v).forEach((b) => b.addEventListener('click', () => { onglet('contenu'); COL = 'glitchs'; contenu(); editer('glitchs', b.dataset.gEd); }));
    $$('[data-g-pub]', v).forEach((b) => b.addEventListener('click', () => { const g = trouve(b.dataset.gPub); ecrire('glitchs', b.dataset.gPub, { ...g, publie: !g.publie }, g.publie ? 'Dépublié' : 'Publié (en ligne à la prochaine publication)'); }));
    $$('[data-g-ok]', v).forEach((b) => b.addEventListener('click', () => {
      const g = trouve(b.dataset.gOk), ver = prompt('Version du jeu sur laquelle le glitch a été reproduit :', vd ? vd.id : ''); if (!ver) return;
      const preuve = prompt('Comment a-t-il été reproduit ? (console, date, lien de la vidéo ou de la capture)'); if (!preuve) return;
      ecrire('glitchs', b.dataset.gOk, { ...g, statut: 'fonctionnel', version: ver, verifieLe: auj(), preuve, historique: [...(g.historique || []), { date: auj(), statut: 'fonctionnel', note: `Reproduit sur la version ${ver} : ${preuve}` }] });
    }));
    $$('[data-g-corr]', v).forEach((b) => b.addEventListener('click', () => {
      const g = trouve(b.dataset.gCorr), why = prompt('Pourquoi est-il corrigé ? (mise à jour, source)'); if (!why) return;
      ecrire('glitchs', b.dataset.gCorr, { ...g, statut: 'corrige', verifieLe: auj(), historique: [...(g.historique || []), { date: auj(), statut: 'corrige', note: why }] });
    }));
    $('[data-g-ver]', v).addEventListener('submit', (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); ecrire('versions', d.id, d, 'Version ajoutée : les glitchs concernés passeront « À revérifier »'); });
    $('[data-g-imp]', v).addEventListener('click', async () => {
      const r = $('[data-g-imp-r]', v); let liste;
      try { liste = JSON.parse($('[data-g-json]', v).value); if (!Array.isArray(liste)) liste = [liste]; } catch (e) { r.textContent = 'JSON invalide : ' + e.message; return; }
      const err = [];
      liste.forEach((g, i) => {
        const k = `Glitch ${i + 1}`;
        if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(g.slug || '')) err.push(`${k} : slug invalide`);
        if (!g.titre) err.push(`${k} : titre manquant`);
        if (!GCAT.includes(g.cat)) err.push(`${k} : catégorie inconnue (${GCAT.join(', ')})`);
        if (!GST[g.statut]) err.push(`${k} : statut inconnu`);
        if (g.statut === 'fonctionnel' && !(g.version && g.preuve)) err.push(`${k} : « fonctionnel » exige une version et une preuve`);
        if (!Array.isArray(g.etapes) || !Array.isArray(g.sources)) err.push(`${k} : etapes et sources doivent être des listes`);
        (g.sources || []).forEach((x) => { if (!/^https:\/\//.test(x.url || '')) err.push(`${k} : source sans lien https`); });
      });
      if (err.length) { r.textContent = err.join(' · '); return; }
      let ok = 0;
      for (const g of liste) { const { error } = await sb.from('contenu').upsert({ collection: 'glitchs', cle: g.slug, donnees: { ...g, publie: false, historique: [...(g.historique || []), { date: auj(), statut: g.statut, note: 'Importé (brouillon)' }] }, supprime: false, maj: new Date().toISOString() }); if (!error) ok++; else { r.textContent = 'Erreur : ' + error.message; break; } }
      if (ok) { r.textContent = `${ok} glitch(s) importé(s) en brouillon.`; await rechargerLignes(); }
    });
    $('[data-g-votes-box]', v).addEventListener('toggle', async (e) => {
      if (!e.target.open) return;
      const box = $('[data-g-votes]', v); box.textContent = 'Chargement…';
      const { data, error } = await sb.rpc('admin_glitch_votes');
      if (error) { box.textContent = 'Votes indisponibles : la table n’existe pas encore. Exécute supabase/glitchs.sql dans Supabase.'; return; }
      box.innerHTML = data.length ? `<table class="adm-t"><tr><th>Glitch</th><th>Résultat</th><th>Console</th><th>Version</th><th>Mode</th><th>Test</th><th>Commentaire</th></tr>${data.map((x) => `<tr><td>${esc(x.glitch)}</td><td>${esc(x.resultat)}</td><td>${esc(x.plateforme)}</td><td>${esc(x.version || '')}</td><td>${esc(x.mode)}</td><td>${esc(x.date_test || '')}</td><td>${esc(x.commentaire || '')}</td></tr>`).join('')}</table>` : 'Aucun vote pour l’instant.';
    });
  }
})();
