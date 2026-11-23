// Briques géométriques des véhicules 3D (carrosseries lissées, roues, ailes, tubes).
// Repère : x vers l'avant, y vers le haut, z vers le côté. Unités : mètres.
import * as THREE from 'three';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
const sgnPow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

// Courbe lisse passant par des points [u, valeur] (Catmull-Rom, extrémités plates)
export function courbe(pts) {
  const n = pts.length;
  const m = pts.map((p, i) => (i === 0 || i === n - 1 ? 0 : (pts[i + 1][1] - pts[i - 1][1]) / (pts[i + 1][0] - pts[i - 1][0])));
  return (u) => {
    if (u <= pts[0][0]) return pts[0][1];
    if (u >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (u > pts[i + 1][0]) i++;
    const [u0, v0] = pts[i], [u1, v1] = pts[i + 1], h = u1 - u0, t = (u - u0) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * h * m[i + 1];
  };
}

// Surface balayée : f(u, v) -> { p: [x, y, z], c: [r, g, b] } ; mat(u, v) -> index de matériau
// Coutures en v = 0/1 (placées sous le véhicule). Bouchons optionnels aux extrémités.
export function balayage(nU, nV, f, mat = () => 0, { boucher = true, nMat = 1 } = {}) {
  const pos = [], col = [], faces = Array.from({ length: nMat }, () => []);
  const idx = (i, j) => i * (nV + 1) + j;
  for (let i = 0; i <= nU; i++) for (let j = 0; j <= nV; j++) {
    const r = f(i / nU, j / nV); pos.push(...r.p); col.push(...(r.c || [1, 1, 1]));
  }
  for (let i = 0; i < nU; i++) for (let j = 0; j < nV; j++) {
    const m = mat((i + .5) / nU, (j + .5) / nV);
    const a = idx(i, j), b = idx(i + 1, j), c = idx(i + 1, j + 1), d = idx(i, j + 1);
    faces[m].push(a, b, d, b, c, d);
  }
  if (boucher) {
    for (const [i, rev] of [[0, true], [nU, false]]) {
      // centre du bouchon
      let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < nV; j++) { const k = idx(i, j) * 3; cx += pos[k]; cy += pos[k + 1]; cz += pos[k + 2]; }
      const centre = pos.length / 3; pos.push(cx / nV, cy / nV, cz / nV);
      const k0 = idx(i, 0) * 3; col.push(col[k0], col[k0 + 1], col[k0 + 2]);
      const m = mat(i ? 1 : 0, .5);
      for (let j = 0; j < nV; j++) rev ? faces[m].push(centre, idx(i, j + 1), idx(i, j)) : faces[m].push(centre, idx(i, j), idx(i, j + 1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const all = []; let start = 0;
  faces.forEach((fs, m) => { all.push(...fs); g.addGroup(start, fs.length, m); start += fs.length; });
  g.setIndex(all);
  g.computeVertexNormals();
  return g;
}

// Section « superellipse » : v in [0,1] -> (cos, sin) arrondis, couture en bas.
// Points répartis à longueur d'arc égale (sinon les parties plates n'ont presque aucun point).
const TABLES = new Map();
function table(n) {
  if (TABLES.has(n)) return TABLES.get(n);
  const N = 4096, pts = [], len = [0];
  for (let k = 0; k <= N; k++) { const a = -Math.PI / 2 + (k / N) * Math.PI * 2; pts.push([sgnPow(Math.cos(a), 2 / n), sgnPow(Math.sin(a), 2 / n)]); }
  for (let k = 1; k <= N; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const t = { pts, len, tot: len[N] }; TABLES.set(n, t); return t;
}
export function section(v, n) {
  const { pts, len, tot } = table(n), cible = v * tot;
  let lo = 0, hi = len.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] < cible) lo = m; else hi = m; }
  const f = (cible - len[lo]) / Math.max(1e-9, len[hi] - len[lo]);
  return [lerp(pts[lo][0], pts[hi][0], f), lerp(pts[lo][1], pts[hi][1], f)];
}

// Tube le long d'une liste de points
export function tube(points, r, mat, seg = 24) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 10, false), mat);
}

// Boîte arrondie (sans dépendance)
export function boite(lx, ly, lz, r, mat) {
  const s = new THREE.Shape();
  const w = lx / 2 - r, h = ly / 2 - r;
  s.moveTo(-w, -ly / 2); s.lineTo(w, -ly / 2); s.quadraticCurveTo(lx / 2, -ly / 2, lx / 2, -h);
  s.lineTo(lx / 2, h); s.quadraticCurveTo(lx / 2, ly / 2, w, ly / 2); s.lineTo(-w, ly / 2);
  s.quadraticCurveTo(-lx / 2, ly / 2, -lx / 2, h); s.lineTo(-lx / 2, -h); s.quadraticCurveTo(-lx / 2, -ly / 2, -w, -ly / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, lz - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * .6, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(lz - 2 * r) / 2);
  return new THREE.Mesh(g, mat);
}

// Ellipsoïde
export function ovoide(rx, ry, rz, mat, seg = 24) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.round(seg * .7)), mat);
  m.scale.set(rx, ry, rz); return m;
}

// Roue complète : pneu, jante à branches, disque et étrier. Axe selon z.
export function roue(R, larg, M, { style = 'branches', branches = 5, flanc = .3, jante = 'chrome' } = {}) {
  const g = new THREE.Group();
  const ri = R * (1 - flanc);
  // pneu : profil arrondi tourné autour de l'axe
  const prof = [];
  for (let k = 0; k <= 16; k++) {
    const a = -Math.PI / 2 + (k / 16) * Math.PI;
    prof.push(new THREE.Vector2(ri + (R - ri) * (.55 + .45 * Math.cos(a) ** .6), (larg / 2) * Math.sin(a)));
  }
  prof.unshift(new THREE.Vector2(ri, -larg / 2)); prof.push(new THREE.Vector2(ri, larg / 2));
  const pneu = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), M.pneu); pneu.rotation.x = Math.PI / 2; g.add(pneu);
  const mj = jante === 'noir' ? M.jNoir : jante === 'or' ? M.jOr : M.chrome;
  // cerclage de jante
  const cer = new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, larg * .86, 40, 1, true), mj); cer.rotation.x = Math.PI / 2; g.add(cer);
  // fond sombre
  const fond = new THREE.Mesh(new THREE.CircleGeometry(ri * .98, 40), M.noir); fond.position.z = larg * .05; g.add(fond);
  // disque et étrier
  const disque = new THREE.Mesh(new THREE.CylinderGeometry(ri * .72, ri * .72, .02, 32), M.disque); disque.rotation.x = Math.PI / 2; disque.position.z = larg * .12; g.add(disque);
  const etrier = boite(ri * .5, ri * .26, .06, .015, M.etrier); etrier.position.set(-ri * .35, ri * .42, larg * .17); etrier.rotation.z = .6; g.add(etrier);
  // branches
  const face = larg * .3;
  if (style === 'plein') {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(ri * .96, ri * .9, .04, 40), mj); p.rotation.x = Math.PI / 2; p.position.z = face; g.add(p);
  } else {
    for (let k = 0; k < branches; k++) {
      const a = (k / branches) * Math.PI * 2;
      const b = boite(ri * .92, ri * (style === 'fines' ? .1 : .2), .045, .012, mj);
      b.position.set(Math.cos(a) * ri * .48, Math.sin(a) * ri * .48, face); b.rotation.z = a; g.add(b);
    }
  }
  const moyeu = new THREE.Mesh(new THREE.CylinderGeometry(ri * .22, ri * .26, .06, 24), mj); moyeu.rotation.x = Math.PI / 2; moyeu.position.z = face + .01; g.add(moyeu);
  return g;
}

// Aile profilée le long de z (envergure), corde selon x
export function aile(env, cordeR, cordeT, ep, M, { fleche = 0, diedre = 0, sym = true, mat } = {}) {
  const geo = balayage(24, 28, (u, v) => {
    const t = u; const corde = lerp(cordeR, cordeT, t);
    const [c, s] = section(v, 2.2);
    const xx = c * corde / 2, yy = s * ep * corde / cordeR / 2 * (c > 0 ? 1 : .8);
    return { p: [xx - fleche * t, yy + diedre * t, t * env] };
  }, () => 0, { boucher: true });
  const g = new THREE.Group();
  const a = new THREE.Mesh(geo, mat || M.peinture); g.add(a);
  if (sym) { const b = a.clone(); b.scale.z = -1; g.add(b); }
  return g;
}
