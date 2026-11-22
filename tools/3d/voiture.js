// Voitures : carrosserie balayée + habitacle vitré + roues + détails.
import * as THREE from 'three';
import { courbe, balayage, section, roue, boite, ovoide, tube, lerp, clamp01 } from './geo.js';

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

// Gabarits par type (u = 0 arrière -> 1 avant). Hauteurs en mètres.
export const GABARITS = {
  supercar: { L: 4.55, W: 1.0, n: 8, R: .37, roues: [.17, .8], bas: .16,
    haut: [[0, .64], [.07, .79], [.3, .81], [.68, .78], [.84, .64], [.96, .5], [1, .4]],
    larg: [[0, .9], [.15, 1], [.5, .96], [.85, .98], [1, .86]],
    toit: [[.3, .82], [.4, 1.12], [.55, 1.14], [.68, 1.02], [.74, .78]], cab: [.28, .76], cabL: .9 },
  hypercar: { L: 4.7, W: 1.03, n: 8, R: .38, roues: [.16, .8], bas: .14,
    haut: [[0, .62], [.07, .82], [.32, .82], [.72, .74], [.86, .58], [.97, .44], [1, .36]],
    larg: [[0, .88], [.15, 1], [.5, .94], [.85, 1], [1, .84]],
    toit: [[.36, .82], [.46, 1.1], [.6, 1.1], [.72, .95], [.78, .7]], cab: [.34, .8], cabL: .9 },
  sportive: { L: 4.45, W: .95, n: 8, R: .36, roues: [.17, .82], bas: .2,
    haut: [[0, .76], [.1, .86], [.3, .86], [.6, .84], [.8, .74], [.96, .62], [1, .5]],
    larg: [[0, .9], [.15, .99], [.5, .96], [.85, .98], [1, .88]],
    toit: [[.16, .86], [.3, 1.24], [.55, 1.28], [.66, 1.16], [.76, .82]], cab: [.14, .78], cabL: .9 },
  muscle: { L: 4.9, W: .98, n: 9, R: .38, roues: [.16, .8], bas: .22,
    haut: [[0, .82], [.06, .92], [.3, .92], [.62, .9], [.9, .88], [.99, .78], [1, .6]],
    larg: [[0, .93], [.15, 1], [.5, .97], [.85, 1], [1, .92]],
    toit: [[.2, .92], [.3, 1.3], [.52, 1.32], [.6, 1.22], [.68, .9]], cab: [.18, .7], cabL: .9 },
  berline: { L: 4.75, W: .93, n: 9, R: .34, roues: [.17, .81], bas: .22,
    haut: [[0, .86], [.08, .96], [.3, .96], [.62, .94], [.84, .86], [.97, .74], [1, .58]],
    larg: [[0, .9], [.15, .98], [.5, .98], [.85, .98], [1, .88]],
    toit: [[.16, .96], [.28, 1.38], [.56, 1.42], [.66, 1.3], [.74, .94]], cab: [.14, .76], cabL: .9 },
  classique: { L: 5.1, W: .97, n: 9, R: .37, roues: [.16, .8], bas: .26,
    haut: [[0, .86], [.04, .98], [.22, .98], [.3, .92], [.6, .92], [.86, .94], [.98, .86], [1, .66]],
    larg: [[0, .88], [.12, .97], [.5, 1], [.85, .99], [1, .9]],
    toit: [[.26, .94], [.36, 1.42], [.58, 1.44], [.64, 1.32], [.7, .94]], cab: [.25, .71], cabL: .9 },
  pickup: { L: 5.3, W: 1.0, n: 10, R: .42, roues: [.17, .8], bas: .42,
    haut: [[0, 1.04], [.04, 1.1], [.5, 1.1], [.62, 1.1], [.86, 1.12], [.98, 1.02], [1, .82]],
    larg: [[0, .96], [.1, 1], [.5, 1], [.85, 1], [1, .94]],
    toit: [[.4, 1.1], [.43, 1.86], [.6, 1.88], [.66, 1.72], [.7, 1.1]], cab: [.39, .71], cabL: .92, benne: [.02, .38] },
  suv: { L: 4.9, W: 1.0, n: 10, R: .4, roues: [.17, .81], bas: .38,
    haut: [[0, 1.08], [.06, 1.14], [.5, 1.14], [.84, 1.1], [.97, .98], [1, .8]],
    larg: [[0, .94], [.12, 1], [.5, 1], [.85, 1], [1, .92]],
    toit: [[.03, 1.14], [.08, 1.82], [.6, 1.86], [.7, 1.66], [.78, 1.14]], cab: [.02, .79], cabL: .93 }
};

export function voiture(spec, M) {
  const G = { ...GABARITS[spec.forme || 'sportive'], ...(spec.gabarit || {}) };
  const o = spec.options || {};
  const lift = o.sureleve || 0;
  const L = G.L, W = G.W, R = G.R * (o.grossesRoues || 1);
  const haut = courbe(G.haut), larg = courbe(G.larg), toit = courbe(G.toit);
  const P = hex(spec.peinture), P2 = hex(o.toitCouleur || spec.peinture), S = hex(o.bandes || '#ffffff'), D = [.03, .03, .035];
  const wheels = G.roues.map((u) => -L / 2 + u * L);
  const yRoue = R + lift;
  const env = (u, p) => Math.pow(1 - Math.pow(Math.abs(2 * u - 1), p), 1 / p);
  const g = new THREE.Group();

  // ---------- carrosserie ----------
  const bas = (u) => G.bas + lift + .05 * Math.pow(Math.abs(2 * u - 1), 3);
  const caisse = balayage(160, 64, (u, v) => {
    const x = -L / 2 + u * L;
    const e = env(u, 10);
    const top = haut(u) + lift, bot = bas(u);
    const mid = (top + bot) / 2, half = (top - bot) / 2 * (.84 + .16 * e);
    const [c, s] = section(v, G.n);
    let z = c * W * larg(u) * e * (1 - .1 * Math.max(0, s) ** 3) * (1 - .05 * Math.max(0, -s) ** 2);
    let y = mid + s * half;
    let col = P;
    // passages de roues creusés
    for (const wx of wheels) {
      const dx = x - wx, ra = R + .07;
      const zMax = W * larg(u) * e;
      if (Math.abs(dx) < ra) {
        const arche = yRoue + Math.sqrt(ra * ra - dx * dx);
        const cote = clamp01((Math.abs(z) / zMax - .62) / .22); // 0 au centre, 1 sur les côtés
        if (y < arche && cote > 0) { y = lerp(y, Math.max(y, arche), cote); if (s < -.2) col = D; }
        else if (y < arche && s < 0) { y = Math.max(y, Math.min(arche, top - .05)); }
      }
    }
    // bandes sur le capot et le coffre
    if (o.bandes && Math.abs(z) < W * .2 && Math.abs(z) > W * .05 && s > .4) col = S;
    // bas de caisse sombre
    if (s < -.55) col = [col[0] * .35, col[1] * .35, col[2] * .35];
    return { p: [x, y, z], c: col };
  }, () => 0);
  g.add(new THREE.Mesh(caisse, M.carrosserie));

  // ---------- habitacle ----------
  // l'habitacle commence et finit là où le toit dépasse vraiment la caisse
  let [c0, c1] = G.cab;
  { let a = c0, b = c1; for (let u = G.cab[0]; u <= G.cab[1]; u += .002) if (toit(u) - haut(u) > .05) { a = u; break; }
    for (let u = G.cab[1]; u >= G.cab[0]; u -= .002) if (toit(u) - haut(u) > .05) { b = u; break; } c0 = a - .01; c1 = b + .01; }
  if (!o.cabriolet) {
    const hab = balayage(90, 48, (u, v) => {
      const uu = lerp(c0, c1, u);
      const x = -L / 2 + uu * L;
      const ee = env(u, 4);
      const base = haut(uu) + lift - .03, sommet = base + .002 + Math.max(0, toit(uu) + lift - base) * Math.pow(ee, .3);
      const [c, s] = section(v, 4.5);
      const half = (sommet - base) / 2;
      const z = c * W * larg(uu) * G.cabL * (1 - .2 * ((s + 1) / 2) ** 1.6) * (.86 + .14 * ee);
      const y = base + half + s * half;
      return { p: [x, Math.max(base, y), z], c: s > .8 || o.toitCouleur ? P2 : P };
    }, (u, v) => {
      const [c, s] = section(v, 4.5);
      if (s < -.25) return 0;                                   // base cachée
      const uu = lerp(c0, c1, u), pente = Math.abs(toit(uu + .01) - toit(uu - .01)) / .02;
      if (s > .96 && pente < 1.2) return 0;                    // toit
      if (Math.abs(c) > .86 && s > .5 && pente >= 1.2) return 0; // montants avant / arrière
      if (Math.abs(u - .5) < .018 && Math.abs(c) > .6 && s < .96) return 0; // montant central
      return 1;                                                 // vitrage
    }, { nMat: 2 });
    const mh = new THREE.Mesh(hab, [M.carrosserie, M.vitre]); g.add(mh);
  } else {
    // pare-brise + intérieur + sièges
    const u0 = c1 - .08, x0 = -L / 2 + u0 * L;
    const pb = boite(.04, .36, W * 1.5, .02, M.vitre); pb.position.set(x0, haut(u0) + lift + .16, 0); pb.rotation.z = .9; g.add(pb);
    const inter = boite(L * (c1 - c0) * .9, .2, W * 1.5, .05, M.interieur); inter.position.set(-L / 2 + (c0 + c1) / 2 * L, haut(.5) + lift - .05, 0); g.add(inter);
    for (const zz of [-.38, .38]) {
      const siege = boite(.16, .42, .44, .06, M.cuir); siege.position.set(-L / 2 + (c0 + .1) * L, haut(.5) + lift + .02, zz); siege.rotation.z = -.25; g.add(siege);
    }
  }
  // benne de pick-up
  if (G.benne) {
    const [b0, b1] = G.benne;
    const bx = -L / 2 + (b0 + b1) / 2 * L, bl = (b1 - b0) * L;
    const fond = boite(bl, .06, W * 1.62, .02, M.noirMat); fond.position.set(bx, haut(.2) + lift - .32, 0); g.add(fond);
    const creux = boite(bl * .98, .34, W * 1.66, .02, M.noirMat); creux.position.set(bx, haut(.2) + lift - .16, 0); g.add(creux);
  }

  // ---------- roues ----------
  for (const wx of wheels) for (const sd of [-1, 1]) {
    const w = roue(R, .3 * (o.grossesRoues ? 1.3 : 1), M, { style: o.jantes || 'branches', branches: o.branches || 5, jante: o.jante || 'chrome', flanc: o.grossesRoues ? .45 : .3 });
    w.position.set(wx, yRoue, sd * W * .84); if (sd < 0) w.rotation.y = Math.PI; g.add(w);
  }

  // ---------- phares, feux, calandre ----------
  const surface = (zt, y, avant) => {
    for (let k = 0; k <= 400; k++) {
      const u = avant ? 1 - k / 400 : k / 400;
      const e = env(u, 10), top = haut(u) + lift, bot = bas(u);
      if (y > top || y < bot) continue;
      const mid = (top + bot) / 2, half = (top - bot) / 2 * (.84 + .16 * e);
      const s = (y - mid) / half; if (Math.abs(s) > 1) continue;
      const c = Math.pow(1 - Math.pow(Math.abs(s), G.n / 2), 2 / G.n);
      const zz = c * W * larg(u) * e * (1 - .1 * Math.max(0, s) ** 3);
      if (zz >= zt) return -L / 2 + u * L;
    }
    return avant ? L / 2 : -L / 2;
  };
  const yAv = lerp(bas(1), haut(.97) + lift, .62);
  for (const sd of [-1, 1]) {
    const zz = W * .66, xa = surface(zz, yAv, true);
    const ph = ovoide(.05, o.pharesRonds ? .075 : .032, o.pharesRonds ? .075 : .17, M.phare); ph.position.set(xa - .015, yAv, sd * zz); ph.rotation.x = sd * .12; g.add(ph);
    const yAr = lerp(bas(0), haut(.02) + lift, .66), xr = surface(zz, yAr, false);
    const fe = ovoide(.05, .045, o.pharesRonds ? .07 : .2, M.feu); fe.position.set(xr + .02, yAr, sd * zz); g.add(fe);
  }
  const yG = lerp(bas(1), haut(.97) + lift, .3), xg = surface(W * .42, yG, true);
  const cal = boite(.05, .13, W * .8, .03, M.calandre); cal.position.set(xg + .005, yG, 0); g.add(cal);
  // rétroviseurs
  const uA = c1 - .05, xA = -L / 2 + uA * L;
  for (const sd of [-1, 1]) {
    const rv = boite(.13, .075, .14, .03, M.carrosserieUni); rv.position.set(xA, haut(uA) + lift + .06, sd * W * larg(uA) * .93); g.add(rv);
  }
  // prises d'air, lame avant et diffuseur (sportives)
  const forme = spec.forme || 'sportive';
  if (forme === 'supercar' || forme === 'hypercar') for (const sd of [-1, 1]) {
    const up = .36, xp = -L / 2 + up * L, yp = lerp(bas(up), haut(up) + lift, .45);
    const pr = boite(.5, .16, .05, .02, M.calandre); pr.position.set(xp, yp, sd * W * larg(up) * .985); pr.rotation.y = sd * .12; g.add(pr);
  }
  if (forme === 'supercar' || forme === 'hypercar' || forme === 'sportive') {
    const lame = boite(.18, .03, W * 1.6, .01, M.calandre); lame.position.set(surface(W * .6, bas(1) + .04, true) - .05, bas(1) + .02, 0); g.add(lame);
    const dif = boite(.3, .1, W * 1.3, .02, M.calandre); dif.position.set(-L / 2 + .14, bas(0) + .06, 0); g.add(dif);
    for (const sd of [-1, 1]) { const ech = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .12, 16), M.chrome); ech.rotation.z = Math.PI / 2; ech.position.set(-L / 2 + .02, bas(0) + .12, sd * W * .35); g.add(ech); }
  }
  // aileron
  if (o.aileron) {
    const xw = -L / 2 + .05 * L, yw = haut(.05) + lift + (o.aileron === 'grand' ? .34 : .16);
    const lame = boite(.32, .04, W * 1.7, .02, M.carrosserieUni); lame.position.set(xw, yw, 0); lame.rotation.z = -.08; g.add(lame);
    for (const sd of [-.55, .55]) { const p = boite(.08, yw - haut(.05) - lift, .03, .01, M.noir); p.position.set(xw + .04, (yw + haut(.05) + lift) / 2, sd * W); g.add(p); }
  }
  // arceau + rampe de phares (buggy)
  if (o.arceau) {
    const xb = -L / 2 + G.cab[0] * L + .2, yb = toit(.4) + lift;
    for (const sd of [-1, 1]) g.add(tube([[xb, haut(.3) + lift, sd * W * .7], [xb + .1, yb + .1, sd * W * .62], [xb + .9, yb + .14, sd * W * .6], [xb + 1.3, haut(.7) + lift, sd * W * .7]], .03, M.noir));
    const rampe = boite(.08, .08, W * 1.2, .02, M.noir); rampe.position.set(xb + .95, yb + .2, 0); g.add(rampe);
    for (let k = -2; k <= 2; k++) { const l = ovoide(.02, .035, .07, M.phare); l.position.set(xb + 1, yb + .2, k * .2); g.add(l); }
  }
  // éclairage sous caisse (néon)
  if (o.neon) {
    const n = boite(L * .7, .02, W * 1.5, .01, M.neon(o.neon)); n.position.set(0, G.bas + lift - .02, 0); g.add(n);
  }
  g.userData.dims = { L, H: toit(.5) + lift, W: W * 2 };
  return g;
}
