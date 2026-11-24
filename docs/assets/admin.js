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
  const NOMS = { actualites: 'Actualités', astuces: 'Astuces', codes: 'Codes de triche', missions: 'Missions', dossiers: 'Dossiers', encyclopedie: 'Encyclopédie', lieux: 'Lieux', vehicules: 'Véhicules' };
  const LIBELLES = {
    titre: 'Titre', nom: 'Nom', nomEn: 'Nom anglais', court: 'Titre court', bref: 'Résumé', reponse: 'Réponse', resume: 'Résumé', desc: 'Description',
    date: 'Date (AAAA-MM-JJ)', statut: 'Statut', theme: 'Thème', cat: 'Catégorie', icon: 'Icône', etapes: 'Étapes', asavoir: 'À savoir', duree: 'Durée (minutes)',
    niveau: 'Niveau', sources: 'Sources', annonce: 'Ce qui a été annoncé', change: 'Ce que ça change', inconnu: 'Ce qui reste inconnu', liens: 'Liens vers des guides',
    kw: 'Mots-clés de recherche', voir: 'Voir aussi', effet: 'Effet', deblocage: 'Comment le débloquer', sequence: 'Séquence (haut, bas, gauche, droite…)',
    confirme: 'Confirmé', argent: 'Donne de l’argent', chapitre: 'Chapitre', num: 'Numéro', facultative: 'Facultative', manquable: 'Peut être manquée', tache: 'Petite tâche',
    perso: 'Personnages', donneur: 'Donnée par', recompense: 'Récompense', bloque: 'Si tu es bloqué', sait: 'Ce que l’on sait', incertain: 'Encore incertain',
    region: 'Région', precision: 'Précision de la position', acces: 'Accès', type: 'Type', sous: 'Sous-type', dispo: 'Disponibilité', lieu: 'Lieu', emplacement: 'Emplacement', obtenir: 'Comment l’obtenir',
    color: 'Couleur', couleur: 'Couleur', seo: 'Titre Google', faq: 'Questions fréquentes', sections: 'Sections'
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
    stats(); contenu(); comptes();
  })();

  function onglet(n) {
    $$('[data-adm-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.admTab === n)));
    $$('[data-adm-vue]').forEach((v) => { v.hidden = v.dataset.admVue !== n; });
  }

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
    <p class="muted small">Les visites du site (nombre de visiteurs, recherches Google) se trouvent dans Google Search Console.</p>`;
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
})();
