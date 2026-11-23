// Motos, bateaux, avions, hélicoptère, camion.
import * as THREE from 'three';
import { courbe, balayage, section, roue, boite, ovoide, tube, aile, lerp } from './geo.js';

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

// ---------- moto ----------
export function moto(spec, M) {
  const o = spec.options || {}, enduro = spec.forme === 'enduro';
  const g = new THREE.Group();
  const R = enduro ? .36 : .31, ea = enduro ? 1.5 : 1.42, yr = R;
  for (const x of [-ea / 2, ea / 2]) { const w = roue(R, enduro ? .11 : .16, M, { style: enduro ? 'fines' : 'branches', branches: enduro ? 18 : 3, flanc: enduro ? .28 : .3, jante: o.jante || (enduro ? 'noir' : 'chrome') }); w.position.set(x, yr, 0); g.add(w); }
  const hS = enduro ? .98 : .82;
  // fourche
  for (const sd of [-.07, .07]) g.add(tube([[ea / 2, yr, sd], [ea / 2 - .18, yr + .62, sd]], .025, M.chrome, 4));
  // cadre
  g.add(tube([[ea / 2 - .2, yr + .62, 0], [.1, yr + .32, 0], [-.3, yr + .3, 0], [-ea / 2, yr, 0]], .03, M.noir, 30));
  g.add(tube([[ea / 2 - .18, yr + .58, 0], [0, hS - .05, 0], [-.45, hS - .02, 0]], .03, M.noir, 30));
  // moteur
  const mot = boite(.42, .3, .26, .05, M.moteur); mot.position.set(.02, yr + .12, 0); g.add(mot);
  // réservoir peint
  const res = ovoide(.27, .1, .15, M.carrosserieUni); res.position.set(.12, hS + .02, 0); g.add(res);
  // selle
  const sel = boite(.55, .08, .26, .04, M.cuir); sel.position.set(-.32, hS - .01, 0); sel.rotation.z = enduro ? 0 : .08; g.add(sel);
  // carénage sportif
  if (!enduro) {
    const car = balayage(40, 32, (u, v) => {
      const x = lerp(.2, ea / 2 + .02, u), [c, s] = section(v, 2.6);
      const r = .13 * Math.sin(Math.PI * (.15 + .85 * u)) + .02;
      return { p: [x, lerp(yr + .25, hS + .14, u) + s * r * 1.2, c * r * .9] };
    }, () => 0);
    g.add(new THREE.Mesh(car, M.carrosserieUni));
    const bulle = boite(.02, .22, .24, .01, M.vitre); bulle.position.set(ea / 2 - .1, hS + .24, 0); bulle.rotation.z = .55; g.add(bulle);
    const queue = boite(.4, .1, .16, .04, M.carrosserieUni); queue.position.set(-.55, hS + .06, 0); queue.rotation.z = .2; g.add(queue);
  } else {
    const gav = boite(.5, .03, .14, .015, M.carrosserieUni); gav.position.set(ea / 2 - .05, yr + R + .1, 0); gav.rotation.z = -.15; g.add(gav);
    const gar = boite(.55, .03, .14, .015, M.carrosserieUni); gar.position.set(-.55, hS + .02, 0); gar.rotation.z = .25; g.add(gar);
    const pl = boite(.06, .2, .2, .02, M.carrosserieUni); pl.position.set(ea / 2 - .12, hS + .1, 0); g.add(pl);
  }
  // guidon, phare, échappement
  g.add(tube([[ea / 2 - .2, hS + .2, -.36], [ea / 2 - .16, hS + .15, 0], [ea / 2 - .2, hS + .2, .36]], .016, M.noir, 10));
  const ph = ovoide(.04, .06, .07, M.phare); ph.position.set(ea / 2 - .08, hS + (enduro ? .1 : .18), 0); g.add(ph);
  g.add(tube([[.05, yr, .14], [-.4, yr + .1, .17], [-.7, yr + .3, .17]], .045, M.chrome, 12));
  g.userData.dims = { L: ea + 2 * R, H: hS + .3, W: .8 };
  return g;
}

// ---------- coques (bateaux) ----------
function coque(L, W, h, { pointeArr = false, pont = '#f3f3f0', coqueC = '#ffffff', bande, fond = '#20232a' }, M) {
  const C = hex(coqueC), B = bande ? hex(bande) : null, F = hex(fond);
  const larg = pointeArr ? (u) => Math.sin(Math.PI * u) ** .7 : courbe([[0, .82], [.2, .98], [.6, .96], [.85, .7], [1, .02]]);
  const quille = pointeArr ? () => -h * .55 : courbe([[0, -h * .4], [.5, -h * .55], [.85, -h * .35], [1, h * .3]]);
  const pontH = courbe([[0, h * .45], [.7, h * .5], [1, h * .75]]);
  const geo = balayage(120, 48, (u, v) => {
    const x = -L / 2 + u * L, [c, s] = section(v, 2);
    const w = W * larg(u);
    let y, z;
    if (s >= 0) { y = pontH(u); z = c * w; } // pont plat
    else { const t = -s; z = c * w * (1 - t ** 1.8 * .98); y = lerp(pontH(u) * .92, quille(u), t ** 1.3); }
    let col = s >= .02 ? hex(pont) : C;
    if (B && s < 0 && s > -.3) col = B;
    if (s < -.75) col = F;
    return { p: [x, y + h * .55, z], c: col };
  }, () => 0);
  return new THREE.Mesh(geo, M.carrosserie);
}

export function bateau(spec, M) {
  const o = spec.options || {}, f = spec.forme;
  const g = new THREE.Group();
  if (f === 'kayak') {
    g.add(coque(3.8, .34, .3, { pointeArr: true, pont: spec.peinture, coqueC: spec.peinture, fond: spec.peinture }, M));
    const cock = ovoide(.42, .04, .2, M.noirMat); cock.position.set(.1, .33, 0); g.add(cock);
    const siege = boite(.36, .05, .3, .02, M.noirMat); siege.position.set(0, .33, 0); g.add(siege);
    g.add(tube([[.3, .5, -1.05], [.3, .5, 1.05]], .016, M.noir, 4));
    for (const z of [-1.1, 1.1]) { const p = ovoide(.12, .01, .06, M.carrosserieUni); p.position.set(.3, .5, z); p.rotation.x = Math.PI / 2; g.add(p); }
    g.userData.dims = { L: 3.8, H: .6, W: 2.2 }; return g;
  }
  if (f === 'jetski') {
    g.add(coque(3.1, .58, .55, { pont: spec.peinture, coqueC: o.coque || '#f5f5f5', bande: o.bande, fond: '#15171c' }, M));
    const sel = boite(1.1, .16, .42, .07, M.cuir); sel.position.set(-.35, .78, 0); g.add(sel);
    const col = boite(.4, .3, .5, .1, M.carrosserieUni); col.position.set(.45, .8, 0); col.rotation.z = -.4; g.add(col);
    g.add(tube([[.55, 1.02, -.34], [.6, 1.0, 0], [.55, 1.02, .34]], .02, M.noir, 8));
    g.userData.dims = { L: 3.1, H: 1.1, W: 1.2 }; return g;
  }
  if (f === 'airboat') {
    g.add(coque(4.6, .95, .45, { pont: '#3a3f45', coqueC: spec.peinture, bande: o.bande, fond: '#1a1c20' }, M));
    const siege = boite(.5, .55, .6, .05, M.noir); siege.position.set(-.6, 1.05, 0); g.add(siege);
    const mot = boite(.6, .45, .55, .06, M.moteur); mot.position.set(-1.35, 1.0, 0); g.add(mot);
    const cage = new THREE.Group();
    for (const r of [.95, .55]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, .02, 8, 48), M.chrome); t.rotation.y = Math.PI / 2; cage.add(t); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; cage.add(tube([[0, Math.cos(a) * .55, Math.sin(a) * .55], [0, Math.cos(a) * .95, Math.sin(a) * .95]], .012, M.chrome, 2)); }
    for (let k = 0; k < 2; k++) { const h = boite(.04, 1.7, .16, .02, M.bois); h.rotation.x = k * Math.PI / 2 + .3; cage.add(h); }
    cage.position.set(-1.85, 1.45, 0); g.add(cage);
    g.userData.dims = { L: 4.8, H: 2.4, W: 2 }; return g;
  }
  // vedette / bateau de pêche
  const L = f === 'peche' ? 7 : 7.4, W = f === 'peche' ? 1.25 : 1.2;
  g.add(coque(L, W, 1, { pont: o.pont || '#e9e4d8', coqueC: o.coque || '#f7f7f5', bande: spec.peinture, fond: o.fond || '#1d2733' }, M));
  if (f === 'peche') {
    const cons = boite(1, 1, 1.1, .1, M.carrosserieBlanc); cons.position.set(.6, 1.6, 0); g.add(cons);
    const pb = boite(.06, .5, 1.1, .03, M.vitre); pb.position.set(1.15, 2.25, 0); pb.rotation.z = .5; g.add(pb);
    // toit (T-top) et cannes
    for (const z of [-.5, .5]) for (const x of [.1, 1.1]) g.add(tube([[x, 1.6, z], [x, 2.8, z]], .03, M.chrome, 2));
    const tt = boite(1.4, .08, 1.3, .03, M.carrosserieBlanc); tt.position.set(.6, 2.84, 0); g.add(tt);
    for (const z of [-.3, -.1, .1, .3]) g.add(tube([[.2, 2.88, z], [-.6, 4.2, z * 3]], .008, M.noir, 2));
    for (const sd of [-1, 1]) g.add(tube([[-2.2, 1.65, sd * 1.05], [1.5, 1.65, sd * 1.15], [2.9, 1.8, sd * .4]], .02, M.chrome, 20));
  } else {
    const cab = balayage(50, 32, (u, v) => {
      const x = lerp(-1.2, 1.6, u), [c, s] = section(v, 2.4);
      const h = .55 * Math.sin(Math.PI * Math.min(1, u * 1.2)) ** .5;
      return { p: [x, 1.55 + Math.max(0, s) * h, c * .95 * (1 - .3 * u)] };
    }, (u, v) => (section(v, 2.4)[1] > .25 && u > .35 ? 1 : 0), { nMat: 2 });
    g.add(new THREE.Mesh(cab, [M.carrosserieBlanc, M.vitre]));
    for (const z of [-.35, .35]) { const s = boite(.5, .4, .45, .06, M.cuir); s.position.set(-1.8, 1.75, z); g.add(s); }
  }
  // moteurs hors-bord
  const nm = o.moteurs || 2;
  for (let k = 0; k < nm; k++) {
    const z = (k - (nm - 1) / 2) * .45;
    const m = boite(.45, .8, .36, .1, M.moteurNoir); m.position.set(-L / 2 - .12, 1.25, z); g.add(m);
    const pied = boite(.16, .8, .1, .03, M.moteurNoir); pied.position.set(-L / 2 - .08, .7, z); g.add(pied);
  }
  g.userData.dims = { L: L + .5, H: f === 'peche' ? 3 : 2.3, W: W * 2 };
  return g;
}

// ---------- avions ----------
function fuselage(L, r, prof, M, mat, nMat = 1, matFn = () => 0) {
  const rr = courbe(prof.r), yy = courbe(prof.y || [[0, 0], [1, 0]]);
  const geo = balayage(100, 40, (u, v) => {
    const [c, s] = section(v, 2.2);
    return { p: [-L / 2 + u * L, yy(u) + s * r * rr(u), c * r * rr(u) * (prof.ecrase || 1)] };
  }, matFn, { nMat });
  return new THREE.Mesh(geo, mat);
}

export function avion(spec, M) {
  const o = spec.options || {}, f = spec.forme;
  const g = new THREE.Group();
  if (f === 'jet') {
    const fus = fuselage(15, .75, { r: [[0, .55], [.1, .75], [.6, 1], [.82, .8], [.96, .3], [1, .02]], y: [[0, 0], [1, -.1]] }, M, M.carrosserieUni);
    fus.position.y = 2; g.add(fus);
    const can = ovoide(1.3, .45, .45, M.vitre); can.position.set(3.6, 2.6, 0); g.add(can);
    const ailes = aile(4.6, 5.2, 1, .25, M, { fleche: 3.3, mat: M.carrosserieUni }); ailes.position.set(-.5, 1.9, 0); g.add(ailes);
    const st = aile(2.2, 2, .7, .2, M, { fleche: 1.3, mat: M.carrosserieUni }); st.position.set(-6, 2, 0); g.add(st);
    for (const sd of [-1, 1]) { const d = aile(2.3, 2.4, .9, .18, M, { fleche: 1.6, sym: false, mat: M.carrosserieUni }); d.rotation.x = -Math.PI / 2 + sd * .35 - (sd > 0 ? Math.PI : 0) * 0; d.rotation.x = sd > 0 ? -Math.PI / 2 + .35 : -Math.PI / 2 - .35; d.position.set(-5.6, 2.4, sd * .7); g.add(d); }
    for (const sd of [-1, 1]) { const tu = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, 1, 24, 1, true), M.moteurNoir); tu.rotation.z = Math.PI / 2; tu.position.set(-7.4, 1.95, sd * .45); g.add(tu); }
    for (const x of [3.8, -1.5]) { g.add(tube([[x, 1.4, 0], [x, .35, 0]], .06, M.chrome, 2)); const w = roue(.33, .2, M, { style: 'plein', jante: 'noir' }); w.position.set(x, .33, 0); g.add(w); }
    for (const sd of [-1, 1]) { g.add(tube([[-1, 1.5, sd * 1.4], [-1, .4, sd * 1.6]], .06, M.chrome, 2)); const w = roue(.38, .22, M, { style: 'plein', jante: 'noir' }); w.position.set(-1, .38, sd * 1.6); g.add(w); }
    g.userData.dims = { L: 16, H: 4.5, W: 10 }; return g;
  }
  const hyd = f === 'hydravion';
  const L = hyd ? 9.5 : 6.8, r = hyd ? .75 : .55, y0 = hyd ? 2.4 : 1.35;
  const fus = fuselage(L, r, { r: [[0, .12], [.25, .45], [.55, .95], [.82, 1], [.95, .85], [1, .5]], y: [[0, .25], [.4, .1], [1, 0]] }, M, [M.carrosserie, M.vitre], 2,
    (u, v) => { const [c, s] = section(v, 2.2); return u > .68 && u < .8 && s > .15 ? 1 : 0; });
  // couleurs du fuselage : bandes en couleurs de vertex
  const P = hex(spec.peinture), B = hex(o.bande || spec.peinture), F = o.flammes ? hex(o.flammes) : null;
  const col = fus.geometry.attributes.color, pos = fus.geometry.attributes.position;
  for (let i = 0; i < col.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), uu = (x + L / 2) / L;
    let c = P;
    if (Math.abs(y - .05) < r * .16) c = B;
    if (F) { const front = (uu - .55) / .45, edge = r * (.55 - 1.1 * (1 - front)) + .08 * Math.sin(uu * 38); if (front > 0 && y < edge) c = F; }
    col.setXYZ(i, ...c);
  }
  fus.position.y = y0; g.add(fus);
  // capot moteur + hélice
  const nez = ovoide(.18, .18, .18, M.chrome); nez.position.set(L / 2 + .05, y0, 0); g.add(nez);
  for (let k = 0; k < (hyd ? 3 : 2); k++) { const p = boite(.04, 1.9, .14, .02, M.noir); p.position.set(L / 2 + .14, y0, 0); p.rotation.x = k * Math.PI / (hyd ? 1.5 : 2) + .4; g.add(p); }
  // ailes
  const yA = hyd ? y0 + r * .95 : y0 - r * .4;
  const ail = aile(hyd ? 7 : 4.3, 1.7, 1, .14, M, { diedre: hyd ? .05 : .3, mat: M.carrosserieUni }); ail.position.set(L * .12, yA, 0); g.add(ail);
  if (o.biplan) { const a2 = aile(4, 1.5, 1, .12, M, { mat: M.carrosserieUni }); a2.position.set(L * .16, y0 + r * 1.6, 0); g.add(a2); for (const sd of [-1, 1]) g.add(tube([[L * .12, yA, sd * 2.6], [L * .16, y0 + r * 1.6, sd * 2.6]], .03, M.noir, 2)); }
  if (hyd) for (const sd of [-1, 1]) g.add(tube([[L * .1, yA, sd * 2.2], [L * .05, y0 - r * .9, sd * .5]], .04, M.chrome, 2));
  const st = aile(1.6, 1, .6, .1, M, { mat: M.carrosserieUni }); st.position.set(-L / 2 + .5, y0 + .25, 0); g.add(st);
  const de = aile(1.2, 1.2, .6, .1, M, { fleche: .5, sym: false, mat: M.carrosserieUni }); de.rotation.x = -Math.PI / 2; de.position.set(-L / 2 + .6, y0 + .3, 0); g.add(de);
  if (hyd) {
    // flotteurs
    for (const sd of [-1, 1]) {
      const fl = fuselage(6, .3, { r: [[0, .2], [.2, .9], [.7, 1], [.95, .6], [1, .2]], y: [[0, .1], [1, .2]] }, M, M.carrosserieBlanc);
      fl.position.set(.3, .45, sd * 1.4); g.add(fl);
      for (const x of [-1, 1.5]) g.add(tube([[x, .75, sd * 1.4], [x + .2, y0 - r * .8, sd * .4]], .035, M.chrome, 2));
    }
  } else {
    for (const sd of [-1, 1]) { g.add(tube([[L * .2, y0 - .3, sd * .3], [L * .2, .3, sd * .9]], .035, M.noir, 2)); const w = roue(.28, .14, M, { style: 'plein', jante: 'noir' }); w.position.set(L * .2, .28, sd * .9); g.add(w); }
    const w = roue(.14, .08, M, { style: 'plein', jante: 'noir' }); w.position.set(-L / 2 + .4, .14 + .2, 0); g.add(w);
  }
  g.userData.dims = { L: L + .6, H: y0 + r * 2.2, W: hyd ? 14 : 9 };
  return g;
}

// ---------- hélicoptère ----------
export function helico(spec, M) {
  const o = spec.options || {};
  const g = new THREE.Group();
  const P = hex(spec.peinture), B = hex(o.bande || '#ffffff');
  const corps = balayage(90, 48, (u, v) => {
    const [c, s] = section(v, 2.4);
    const x = lerp(-1.9, 1.9, u), e = Math.sin(Math.PI * (.08 + .92 * u)) ** .55;
    const h = .85 * e, w = .78 * e;
    return { p: [x, 1.35 + s * h + .1 * u, c * w * (1 - .15 * Math.max(0, s))], c: (s < -.3 ? B : P) };
  }, (u, v) => { const [c, s] = section(v, 2.4); return u > .66 && s > -.35 && !(Math.abs(c) < .12 && s > .6) ? 1 : 0; }, { nMat: 2 });
  g.add(new THREE.Mesh(corps, [M.carrosserie, M.vitre]));
  // poutre de queue
  const pq = balayage(40, 24, (u, v) => { const [c, s] = section(v, 2); const r = lerp(.32, .1, u); return { p: [lerp(-1.6, -6.2, u), 1.7 + u * .25 + s * r, c * r], c: P }; }, () => 0);
  g.add(new THREE.Mesh(pq, M.carrosserie));
  const de = aile(.9, 1, .5, .14, M, { fleche: .4, sym: false, mat: M.carrosserieUni }); de.rotation.x = -Math.PI / 2; de.position.set(-6, 1.9, 0); g.add(de);
  const st = aile(.6, .5, .35, .12, M, { mat: M.carrosserieUni }); st.position.set(-5.4, 1.95, 0); g.add(st);
  // rotors
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .4, 16), M.moteurNoir); mat.position.set(0, 2.45, 0); g.add(mat);
  for (let k = 0; k < (o.pales || 3); k++) { const p = boite(5.3, .03, .26, .01, M.noir); const piv = new THREE.Group(); p.position.x = 2.7; piv.add(p); piv.rotation.y = k / (o.pales || 3) * Math.PI * 2 + .4; piv.position.set(0, 2.66, 0); g.add(piv); }
  for (let k = 0; k < 2; k++) { const p = boite(.06, .9, .02, .01, M.noir); p.position.set(-6.25, 2.05, .14); p.rotation.z = k * Math.PI / 2 + .3; g.add(p); }
  // patins
  for (const sd of [-1, 1]) {
    g.add(tube([[-1.3, .1, sd * .85], [1.6, .1, sd * .85], [1.95, .3, sd * .85]], .04, M.chrome, 20));
    for (const x of [-.8, .8]) g.add(tube([[x, .1, sd * .85], [x, .6, sd * .55]], .035, M.chrome, 2));
  }
  g.userData.dims = { L: 8.5, H: 2.8, W: 5.6 };
  return g;
}

// ---------- camion ----------
export function camion(spec, M) {
  const g = new THREE.Group();
  const cab = boite(2.1, 2.2, 2.4, .2, M.carrosserieUni); cab.position.set(3.3, 1.95, 0); g.add(cab);
  const capot = boite(1.3, 1.1, 2.2, .18, M.carrosserieUni); capot.position.set(4.8, 1.4, 0); g.add(capot);
  const pb = boite(.06, .9, 2.1, .04, M.vitre); pb.position.set(4.37, 2.55, 0); pb.rotation.z = .12; g.add(pb);
  for (const sd of [-1, 1]) { const f = boite(1, .7, .04, .02, M.vitre); f.position.set(3.4, 2.5, sd * 1.21); g.add(f); }
  const cal = boite(.06, .9, 1.4, .04, M.chrome); cal.position.set(5.46, 1.35, 0); g.add(cal);
  for (const sd of [-1, 1]) { const p = ovoide(.04, .12, .12, M.phare); p.position.set(5.46, 1.2, sd * .9); g.add(p); }
  for (const sd of [-1, 1]) g.add(tube([[2.3, 1.1, sd * 1.1], [2.3, 3.4, sd * 1.1]], .08, M.chrome, 2));
  const rem = boite(9, 2.8, 2.5, .08, M.carrosserieBlanc); rem.position.set(-3.2, 2.6, 0); g.add(rem);
  const chassis = boite(13, .3, 1.6, .04, M.noir); chassis.position.set(-.9, .85, 0); g.add(chassis);
  for (const x of [4.7, 2.0, 1.0, -5.5, -6.6]) for (const sd of [-1, 1]) { const w = roue(.52, .32, M, { style: 'plein', jante: 'chrome', flanc: .4 }); w.position.set(x, .52, sd * 1.05); if (sd < 0) w.rotation.y = Math.PI; g.add(w); }
  g.userData.dims = { L: 13.5, H: 4, W: 2.6 };
  return g;
}
