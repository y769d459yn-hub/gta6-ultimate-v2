/* Leonida Guide — page carte plein écran (recherche, filtres, fiches, couche communautaire GTADB) */
(() => {
  'use strict';
  const page = document.querySelector('[data-atlas-page]'); if (!page || !window.Atlas) return;
  const $ = (s, c = page) => c.querySelector(s);
  const $$ = (s, c = page) => [...c.querySelectorAll(s)];
  const LG = window.LG || {};
  const ROOT = document.body.dataset.root || './';
  const ic = (n) => (LG.ic ? LG.ic(n) : '');
  const norm = LG.norm || ((s) => String(s).toLowerCase());
  const escH = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const g = window.gsap;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STAT = { confirme: ['Confirmé', 'pn-tag--ok'], 'a-verifier': ['À vérifier', 'pn-tag--warn'], provisoire: ['Provisoire', 'pn-tag--warn'] };
  const stage = $('.atp-stage'), panel = $('[data-panel]'), top = $('.atp-top');
  const params = new URLSearchParams(location.search);
  let atlas, D, commu = [], commuCats = {}, cats = {}, regions = {};
  const shown = new Set(), state = { commu: false };

  Promise.all([fetch(ROOT + 'data/carte.json').then((r) => r.json()), fetch(ROOT + 'data/communaute.json').then((r) => r.json()).catch(() => ({ lieux: [], categories: [] }))]).then(([d, c]) => {
    D = d; commu = c.lieux; c.categories.forEach((k) => { commuCats[k.id] = k; });
    d.categories.forEach((k) => { cats[k.id] = k; shown.add(k.id); });
    d.regions.forEach((r) => { regions[r.id] = r; });
    const only = params.get('cat'); if (only && cats[only]) { shown.clear(); shown.add(only); }
    atlas = window.Atlas(stage, {
      root: ROOT, tuiles: d.tuiles, carte: d, pad: padding(),
      onSelect: (f) => (f.commu ? openCommu(f) : openFeature(f)),
      onRegion: openRegion, onBlank: closePanel
    });
    atlas.setCommu(commu);
    syncChips(); applyFilter();
    const n = (id) => $(`[data-n="${id}"]`);
    d.categories.forEach((k) => { const el = n(k.id); if (el) el.textContent = d.features.filter((f) => f.properties.cat === k.id && !f.properties.label).length; });
    n('commu').textContent = commu.length;
    const focus = params.get('focus');
    const f = focus && atlas.feats().find((x) => x.id === focus);
    if (f) setTimeout(() => { f.label ? openRegion(regions[f.id]) : atlas.select(f, { fly: innerWidth >= 900, s: .32 }); }, 250);
    else if (params.get('region') && regions[params.get('region')]) setTimeout(() => openRegion(regions[params.get('region')]), 250);
    bind();
    if (g && !reduce) g.from('.atp-top > *, .atp-ctrl > *, .atp-regions > *', { opacity: 0, y: -10, duration: .6, stagger: .03, ease: 'expo.out' });
  }).catch(() => { stage.textContent = 'Carte indisponible pour le moment.'; });

  function padding() {
    const mob = innerWidth < 900;
    return { top: (top.getBoundingClientRect().bottom - page.getBoundingClientRect().top) + 10, bottom: mob ? 140 : 70, left: 10, right: mob ? 10 : 70 };
  }
  function syncChips() {
    $$('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', shown.has(b.dataset.cat)));
    $('[data-commu]').setAttribute('aria-pressed', state.commu);
    const u = new URL(location.href);
    shown.size === 1 ? u.searchParams.set('cat', [...shown][0]) : u.searchParams.delete('cat');
    u.searchParams.delete('focus'); history.replaceState(null, '', u);
  }
  function applyFilter() { atlas.setFilter((f) => shown.has(f.cat)); atlas.showCommu(state.commu); }

  // ---------- panneau de détail ----------
  function showPanel(html) {
    panel.innerHTML = html; panel.hidden = false; page.classList.add('has-panel');
    $('[data-x]', panel).addEventListener('click', closePanel);
    LG.syncFavs && LG.syncFavs();
    if (g && !reduce) g.fromTo(panel, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'expo.out' });
  }
  function closePanel() { panel.hidden = true; page.classList.remove('has-panel'); atlas && atlas.clearActive(); }
  const head = (icon, color, kicker, title) => `<div class="pn-h"><span class="pn-ico" style="--c:${color}">${ic(icon)}</span><div><small>${escH(kicker)}</small><h2>${escH(title)}</h2></div><button type="button" class="pn-x" data-x aria-label="Fermer">${ic('x')}</button></div>`;
  function openFeature(f) {
    const c = cats[f.cat] || {}; const r = regions[f.region]; const st = STAT[f.statut] || STAT['a-verifier'];
    const favType = f.cat === 'vehicules' ? 'vehicule' : 'lieu';
    const fav = { id: f.cat === 'vehicules' ? f.id.replace(/^v-/, '') : f.id, type: favType, t: f.nom, u: f.cat === 'vehicules' ? f.url : `carte/?focus=${f.id}`, i: f.icon, c: c.color };
    const t = f.tip;
    const tags = `<div class="pn-tags"><span class="pn-tag ${st[1]}">${st[0]}</span>${r ? `<span class="pn-tag">${escH(r.nom)}</span>` : ''}<span class="pn-tag pn-tag--warn">${f.precision === 'region' ? 'Emplacement à confirmer' : 'Position approximative'}</span></div>`;
    const favBtn = `<button type="button" class="pn-fav fav" data-fav='${escH(JSON.stringify(fav))}' aria-pressed="false" aria-label="Ajouter aux favoris">${ic('heart')}</button>`;
    const body = t
      ? `<div class="pn-tip" style="--c:${c.color}"><p class="pn-q">${ic('bolt')}${escH(t.titre)}</p><p class="pn-a">${escH(t.reponse)}</p>
         <div class="pn-act"><a class="nbtn nbtn--primary" href="${ROOT}${t.lien}"><span>${escH(t.libelle)}</span><i>${ic('arrow-right')}</i></a>${favBtn}</div>
         <ol class="pn-steps">${t.etapes.map((e) => `<li>${escH(e)}</li>`).join('')}</ol></div>${tags}`
      : `${tags}<p>${escH(f.desc || '')}</p>
         <div class="pn-act">${f.url ? `<a class="nbtn nbtn--primary" href="${ROOT}${f.url}"><span>Voir la fiche</span><i>${ic('arrow-right')}</i></a>` : `<a class="nbtn" href="https://map.gtadb.org" target="_blank" rel="noopener"><span>Source : GTADB</span><i>${ic('arrow-right')}</i></a>`}${favBtn}</div>`;
    showPanel(`${head(f.icon, c.color, (c.nom || '') + (f.service ? ' · ' + f.service : ''), f.nom)}${body}`);
    if (innerWidth < 900) {
      const ts = Math.max(atlas.cam.s, .3); const ph = panel.offsetHeight;
      atlas.flyTo(f.x, f.y - (ph / 2 + 10) / ts, ts);
    }
  }
  function openCommu(p) {
    const k = commuCats[p.c] || { nom: 'Lieu' };
    showPanel(`${head('pin', '#c7c2e0', 'Lieu de la communauté · ' + k.nom, p.n)}
      <div class="pn-tags">${p.z ? `<span class="pn-tag">${escH(p.z)}</span>` : ''}<span class="pn-tag pn-tag--warn">${p.d ? 'Nom ou position douteux' : 'Position approximative'}</span></div>
      <p>Repéré par les contributeurs de GTADB d'après les bandes-annonces et le jeu. Ce n'est pas une information vérifiée par notre équipe.</p>
      <div class="pn-act"><a class="nbtn" href="https://map.gtadb.org" target="_blank" rel="noopener"><span>Source : GTADB</span><i>${ic('arrow-right')}</i></a></div>`);
    if (innerWidth < 900) { const ts = Math.max(atlas.cam.s, .5); atlas.flyTo(p.x, p.y - (panel.offsetHeight / 2 + 10) / ts, ts); }
  }
  function openRegion(r) {
    if (!r) return;
    const list = atlas.feats().filter((f) => f.region === r.id && !f.label);
    const by = {}; list.forEach((f) => { by[f.cat] = (by[f.cat] || 0) + 1; });
    showPanel(`${head('map', r.couleur, 'Région', r.nom)}
      <div class="pn-tags">${Object.entries(by).map(([c, n]) => `<span class="pn-tag">${n} ${escH((cats[c] || {}).nom || c).toLowerCase()}</span>`).join('') || '<span class="pn-tag">Pas encore de repère du guide</span>'}</div>
      <div class="pn-act"><a class="nbtn nbtn--primary" href="${ROOT}encyclopedie/${r.id}/"><span>Lire la fiche</span><i>${ic('arrow-right')}</i></a></div>`);
    atlas.flyTo(r.label[0], r.label[1], .12);
  }

  // ---------- recherche ----------
  function search(q) {
    const qn = norm(q); if (!qn) return [];
    const toks = qn.split(' ').filter(Boolean);
    const score = (name, extra) => {
      const w = norm(name).split(' '), e = norm(extra).split(' ');
      let s = 0, hit = 0;
      toks.forEach((t) => { const m = Math.max((LG.tokMatch ? LG.tokMatch(t, w) : w.includes(t) ? 1 : 0) * 2, LG.tokMatch ? LG.tokMatch(t, e) : 0); s += m; if (m) hit++; });
      return hit === toks.length ? s : 0;
    };
    const out = [];
    atlas.feats().forEach((f) => { const s = score(f.nom, `${(cats[f.cat] || {}).nom} ${f.desc || ''}`); if (s) out.push({ s: s + 1, f }); });
    commu.forEach((p) => { const s = score(p.n, p.z); if (s) out.push({ s, p }); });
    return out.sort((a, b) => b.s - a.s).slice(0, 8);
  }
  function bind() {
    const input = $('#atp-q'), sugg = $('#atp-sugg'); let res = [], sel = 0;
    const draw = () => {
      res = search(input.value); sel = 0; sugg.hidden = !input.value.trim();
      sugg.innerHTML = res.length ? res.map((r, i) => {
        const f = r.f, p = r.p;
        return f ? `<button type="button" role="option" data-i="${i}" aria-selected="${i === 0}" style="--c:${(cats[f.cat] || {}).color}"><i></i><span><b>${escH(f.nom)}</b><small>${escH((cats[f.cat] || {}).nom || '')}${regions[f.region] ? ' · ' + escH(regions[f.region].nom) : ''}</small></span></button>`
          : `<button type="button" role="option" data-i="${i}" aria-selected="${i === 0}" style="--c:#c7c2e0"><i></i><span><b>${escH(p.n)}</b><small>Communauté${p.z ? ' · ' + escH(p.z) : ''}</small></span></button>`;
      }).join('') : '<p>Aucun lieu trouvé. Essaie un autre mot.</p>';
      $$('[data-i]', sugg).forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
    };
    const pick = (i) => {
      const r = res[i]; if (!r) return; sugg.hidden = true; input.blur();
      if (r.f) {
        if (r.f.label) return openRegion(regions[r.f.id]);
        if (!shown.has(r.f.cat)) { shown.add(r.f.cat); syncChips(); applyFilter(); }
        atlas.select(r.f, { fly: innerWidth >= 900, s: .32 });
      } else {
        if (!state.commu) { state.commu = true; syncChips(); applyFilter(); }
        atlas.select({ ...r.p, commu: true, x: r.p.x, y: r.p.y }, { fly: innerWidth >= 900, s: .5 });
      }
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(res.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); $$('[data-i]', sugg).forEach((b, i) => b.setAttribute('aria-selected', i === sel)); }
      if (e.key === 'Escape') { input.value = ''; sugg.hidden = true; }
    });
    input.addEventListener('blur', () => setTimeout(() => { sugg.hidden = true; }, 180));
    $$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.cat, all = shown.size === Object.keys(cats).length;
      if (all) { shown.clear(); shown.add(id); } else if (shown.has(id)) { shown.delete(id); if (!shown.size) Object.keys(cats).forEach((k) => shown.add(k)); } else shown.add(id);
      syncChips(); applyFilter();
    }));
    $('[data-commu]').addEventListener('click', () => {
      state.commu = !state.commu; syncChips(); applyFilter();
      if (state.commu && atlas.cam.s < .07) { atlas.flyTo(-900, 600, .14); LG.toast && LG.toast('Zoome pour voir les lieux de la communauté', 'info'); }
    });
    $$('[data-z]').forEach((b) => b.addEventListener('click', () => { const z = b.dataset.z; if (z === 'in') atlas.zoomIn(); else if (z === 'out') atlas.zoomOut(); else { closePanel(); atlas.reset(); } }));
    $$('[data-reg]').forEach((b) => b.addEventListener('click', () => openRegion(regions[b.dataset.reg])));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => atlas.setPad(padding()), 150); });
  }
})();
