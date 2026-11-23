/* Leonida Guide — comptes visiteurs (Supabase) : connexion, inscription et synchronisation des favoris.
   La configuration (window.LG_SB = { url, cle }) est ajoutée en tête de ce fichier au build.
   Sans compte, rien ne change : tout reste dans le navigateur. La bibliothèque Supabase n'est chargée
   que sur la page « Mon espace » ou quand une session existe déjà. */
(() => {
  'use strict';
  // les autres scripts (administration) attendent cette promesse : { sb, user } ou null sans compte
  let pret; window.LG_COMPTE = new Promise((ok) => { pret = ok; });
  const CFG = window.LG_SB; if (!CFG || !CFG.url || !CFG.cle) return pret(null);
  const ROOT = document.body.dataset.root || './';
  const REF = CFG.url.replace(/^https:\/\//, '').split('.')[0];
  const SESSION = `sb-${REF}-auth-token`;
  const CLES = { favs: 'lg:favs', done: 'lg:done', missions: 'lg:missions', trouves: 'lg:carte-trouves' };
  const UID = 'lg:sb-uid';
  const page = document.querySelector('[data-auth]');
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* */ } } };
  if (!page && !ls.get(SESSION)) return pret(null); // pas de compte sur cet appareil : rien à faire

  const $ = (s, c = document) => c.querySelector(s);
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t) => (window.LG && window.LG.toast ? window.LG.toast(t, 'user') : null);
  let sb = null, user = null, pousse = null, applique = false;

  function charger() {
    return new Promise((ok, ko) => {
      if (window.supabase) return ok();
      const s = document.createElement('script'); s.src = ROOT + 'assets/supabase.min.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s);
    });
  }

  // ---------- données locales <-> distantes ----------
  const lire = (k, d) => { try { const v = ls.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const local = () => Object.fromEntries(Object.entries(CLES).map(([n, k]) => [n, lire(k, [])]));
  const cleFav = (x) => x.type + ':' + x.id;
  function fusion(a, b) {
    const favs = [...(a.favs || [])]; const vus = new Set(favs.map(cleFav));
    (b.favs || []).forEach((x) => { if (!vus.has(cleFav(x))) { favs.push(x); vus.add(cleFav(x)); } });
    const u = (k) => [...new Set([...(a[k] || []), ...(b[k] || [])])];
    return { favs: favs.sort((x, y) => (y.ts || 0) - (x.ts || 0)), done: u('done'), missions: u('missions'), trouves: u('trouves') };
  }
  function ecrireLocal(d) {
    applique = true;
    const avant = local();
    Object.entries(CLES).forEach(([n, k]) => ls.set(k, JSON.stringify(d[n] || [])));
    applique = false;
    if (window.LG) { window.LG.syncFavs && window.LG.syncFavs(); window.LG.syncDone && window.LG.syncDone(); }
    document.dispatchEvent(new CustomEvent('lg:remote'));
    // pages qui lisent ces données au chargement : on recharge une fois si elles ont changé
    const change = (n) => JSON.stringify(avant[n]) !== JSON.stringify(d[n] || []);
    if (((change('missions') && document.querySelector('[data-missions]')) || (change('trouves') && document.querySelector('[data-atlas-page]'))) && !sessionStorage.getItem('lg:rechargé')) {
      sessionStorage.setItem('lg:rechargé', '1'); location.reload();
    }
  }
  async function envoyer() {
    if (!sb || !user) return;
    const { error } = await sb.from('espace').upsert({ user_id: user.id, donnees: local(), maj: new Date().toISOString() });
    etat(error ? 'erreur' : 'ok');
  }
  const plusTard = () => { clearTimeout(pousse); pousse = setTimeout(envoyer, 800); };
  // toute modification des favoris ou de la progression part vers le compte
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { setItem.call(this, k, v); if (!applique && user && this === window.localStorage && Object.values(CLES).includes(k)) plusTard(); };

  async function synchroniser() {
    const { data, error } = await sb.from('espace').select('donnees').eq('user_id', user.id).maybeSingle();
    if (error) { etat('erreur'); return; }
    const distant = (data && data.donnees) || {};
    if (ls.get(UID) !== user.id) { // première connexion sur cet appareil : on garde tout
      ecrireLocal(fusion(local(), distant)); ls.set(UID, user.id); await envoyer();
      const n = (local().favs || []).length; if (n) toast(`${n} favori${n > 1 ? 's' : ''} sur ton compte`);
    } else if (data) { ecrireLocal({ ...local(), ...distant }); etat('ok'); } else await envoyer();
    sessionStorage.removeItem('lg:rechargé');
  }

  // ---------- page « Mon espace » ----------
  function etat(t) {
    const e = page && $('[data-auth-sync]', page); if (!e) return;
    e.textContent = t === 'ok' ? 'Favoris et progression synchronisés' : t === 'erreur' ? 'Synchronisation impossible pour l’instant, réessaie plus tard.' : 'Synchronisation…';
    e.dataset.state = t;
  }
  function msg(t, ok = false) { const m = $('[data-auth-msg]', page); m.hidden = !t; m.textContent = t || ''; m.dataset.ok = ok ? '1' : ''; }
  const FR = (e) => {
    const t = (e && e.message) || '';
    if (/Invalid login credentials/i.test(t)) return 'E-mail ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(t)) return 'Confirme d’abord ton adresse : ouvre le lien reçu par e-mail.';
    if (/already registered|already been registered/i.test(t)) return 'Un compte existe déjà avec cette adresse. Connecte-toi.';
    if (/at least 6|Password should/i.test(t)) return 'Le mot de passe doit faire au moins 8 caractères.';
    if (/rate limit|too many/i.test(t)) return 'Trop de tentatives. Patiente quelques minutes.';
    if (/valid email|invalid email/i.test(t)) return 'Adresse e-mail invalide.';
    if (/fetch|network/i.test(t)) return 'Connexion impossible. Vérifie ta connexion internet.';
    return 'Une erreur est survenue. Réessaie.';
  };
  function vue(nom) {
    page.querySelectorAll('[data-auth-view]').forEach((v) => { v.hidden = v.dataset.authView !== nom; });
    page.querySelectorAll('[data-auth-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.authTab === nom)));
    msg('');
  }
  function afficher() {
    if (!page) return;
    $('[data-auth-off]', page).hidden = !!user; $('[data-auth-on]', page).hidden = !user;
    if (user) { $('[data-auth-email]', page).textContent = user.email || ''; }
    const adm = $('[data-auth-admin]', page);
    if (adm) { adm.hidden = true; if (user) sb.rpc('est_admin').then(({ data }) => { adm.hidden = data !== true; }); }
    document.querySelectorAll('[data-auth-label]').forEach((e) => { e.textContent = user ? 'Mon compte' : 'Mon espace'; });
  }
  function brancherPage() {
    const lien = location.href.split('#')[0].split('?')[0];
    page.querySelectorAll('[data-auth-tab]').forEach((b) => b.addEventListener('click', () => vue(b.dataset.authTab)));
    page.querySelectorAll('[data-auth-go]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); vue(b.dataset.authGo); }));
    const occupe = (f, on) => { const b = f.querySelector('button[type=submit]'); if (b) { b.disabled = on; b.classList.toggle('is-busy', on); } };
    $('[data-form=connexion]', page).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; occupe(f, true); msg('');
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.mdp.value });
      occupe(f, false); if (error) msg(FR(error)); else f.reset();
    });
    $('[data-form=inscription]', page).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; msg('');
      if (f.mdp.value.length < 8) return msg('Le mot de passe doit faire au moins 8 caractères.');
      if (f.mdp.value !== f.mdp2.value) return msg('Les deux mots de passe ne sont pas identiques.');
      if (!f.ok.checked) return msg('Coche la case pour accepter l’utilisation de ton e-mail.');
      occupe(f, true);
      const { data, error } = await sb.auth.signUp({ email: f.email.value.trim(), password: f.mdp.value, options: { emailRedirectTo: lien } });
      occupe(f, false);
      if (error) return msg(FR(error));
      if (data && data.session) { f.reset(); return; }
      f.reset(); vue('connexion'); msg('Compte créé ! Ouvre l’e-mail de confirmation que tu viens de recevoir, puis connecte-toi.', true);
    });
    $('[data-form=oubli]', page).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; occupe(f, true);
      const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: lien });
      occupe(f, false); if (error) msg(FR(error)); else msg('Si un compte existe avec cette adresse, tu vas recevoir un e-mail pour choisir un nouveau mot de passe.', true);
    });
    $('[data-form=nouveau]', page).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target;
      if (f.mdp.value.length < 8) return msg('Le mot de passe doit faire au moins 8 caractères.');
      occupe(f, true); const { error } = await sb.auth.updateUser({ password: f.mdp.value }); occupe(f, false);
      if (error) msg(FR(error)); else { f.reset(); toast('Mot de passe modifié'); afficher(); }
    });
    $('[data-auth-out]', page).addEventListener('click', async () => { await sb.auth.signOut(); ls.del(UID); user = null; afficher(); vue('connexion'); toast('Tu es déconnecté'); });
    $('[data-auth-del]', page).addEventListener('click', async () => {
      if (!confirm('Supprimer ton compte ? Tes favoris restent sur cet appareil, mais ne seront plus sauvegardés en ligne. Cette action est définitive.')) return;
      const { error } = await sb.rpc('supprimer_mon_compte');
      if (error) return msg(FR(error));
      await sb.auth.signOut(); ls.del(UID); user = null; afficher(); vue('connexion'); toast('Compte supprimé');
    });
    vue('connexion');
  }

  // ---------- démarrage ----------
  if (page) page.classList.add('is-loading');
  charger().then(async () => {
    sb = window.supabase.createClient(CFG.url, CFG.cle, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    if (page) brancherPage();
    sb.auth.onAuthStateChange((ev, session) => {
      const avant = user && user.id; user = session ? session.user : null; afficher();
      if (ev === 'PASSWORD_RECOVERY' && page) { $('[data-auth-off]', page).hidden = true; $('[data-auth-on]', page).hidden = false; $('[data-auth-new]', page).hidden = false; $('[data-auth-new] input', page).focus(); }
      if (user && user.id !== avant) { etat('…'); setTimeout(synchroniser, 0); }
    });
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null; afficher();
    if (page) page.classList.remove('is-loading');
    pret({ sb, get user() { return user; } });
  }).catch(() => { pret(null); if (page) { page.classList.remove('is-loading'); msg('Le service de comptes est momentanément indisponible.'); } });
})();
