// Leonida Guide — véhicules en 3D (modèles générés, studio, vue rotative).
// Assemblé par `npm run build:3d` dans src/vehicule3d.js (global : window.LG3D).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { voiture } from './voiture.js';
import { moto, bateau, avion, helico, camion } from './autres.js';

const FINITIONS = {
  brillant: { metalness: .15, roughness: .34, clearcoat: 1, clearcoatRoughness: .04 },
  metal: { metalness: .65, roughness: .3, clearcoat: 1, clearcoatRoughness: .05 },
  nacre: { metalness: .45, roughness: .22, clearcoat: 1, clearcoatRoughness: .03, iridescence: .6, iridescenceIOR: 1.6 },
  mat: { metalness: .2, roughness: .72, clearcoat: 0 }
};

function materiaux(spec) {
  const f = FINITIONS[spec.finition || 'brillant'];
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    carrosserie: phys({ color: 0xffffff, vertexColors: true, ...f }),
    carrosserieUni: phys({ color: spec.peinture, ...f }),
    carrosserieBlanc: phys({ color: '#f4f4f1', metalness: .1, roughness: .35, clearcoat: 1, clearcoatRoughness: .05 }),
    vitre: phys({ color: '#0a0e14', metalness: .1, roughness: .04, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.6 }),
    chrome: std({ color: '#e8e8ea', metalness: 1, roughness: .13 }),
    jNoir: std({ color: '#1a1a1d', metalness: .7, roughness: .35 }),
    jOr: std({ color: '#c9a14a', metalness: 1, roughness: .22 }),
    pneu: std({ color: '#121214', metalness: 0, roughness: .88 }),
    noir: std({ color: '#0d0d10', metalness: .3, roughness: .5 }),
    noirMat: std({ color: '#151518', metalness: 0, roughness: .9 }),
    disque: std({ color: '#7c7f86', metalness: .9, roughness: .4 }),
    etrier: std({ color: spec.etrier || '#c8102e', metalness: .3, roughness: .4 }),
    phare: std({ color: '#ffffff', emissive: '#e8f4ff', emissiveIntensity: 2.2, roughness: .1 }),
    feu: std({ color: '#ff1a2e', emissive: '#ff1028', emissiveIntensity: 2, roughness: .2 }),
    calandre: std({ color: '#0b0b0e', metalness: .5, roughness: .45 }),
    interieur: std({ color: '#1b1b1f', roughness: .8 }),
    cuir: std({ color: spec.cuir || '#2a1d18', roughness: .55 }),
    moteur: std({ color: '#6c6f76', metalness: .8, roughness: .35 }),
    moteurNoir: std({ color: '#18191c', metalness: .5, roughness: .4 }),
    bois: std({ color: '#6b4a2b', roughness: .6 }),
    neon: (c) => std({ color: c, emissive: c, emissiveIntensity: 4 })
  };
}

const FAMILLES = {
  supercar: voiture, hypercar: voiture, sportive: voiture, muscle: voiture, berline: voiture, classique: voiture, pickup: voiture, suv: voiture,
  moto: moto, enduro: moto, vedette: bateau, peche: bateau, kayak: bateau, jetski: bateau, airboat: bateau,
  avion: avion, hydravion: avion, jet: avion, helicoptere: helico, camion: camion
};

// centré au sol, longueur normalisée à 4,6 m pour un cadrage identique
function normaliser(g) {
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = 4.6 / Math.max(size.x, size.z * .9);
  const root = new THREE.Group();
  g.position.set(-c.x, -box.min.y, -c.z); root.add(g); root.scale.setScalar(k);
  root.userData.h = size.y * k; root.userData.l = size.x * k; root.userData.w = size.z * k;
  return root;
}
export function creer(spec) {
  const g = (FAMILLES[spec.forme] || voiture)(spec, materiaux(spec));
  return normaliser(g);
}

function ombre() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d'), gr = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.45, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = .002; return m;
}

function studio(renderer, spec) {
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  scene.environmentIntensity = .9;
  const key = new THREE.DirectionalLight('#ffffff', 1.9); key.position.set(4, 7, 5); scene.add(key);
  const rimA = new THREE.PointLight('#ff2bd6', 3.5, 14); rimA.position.set(-4, 2.2, -3.5); scene.add(rimA);
  const rimB = new THREE.PointLight('#19d3e3', 4, 14); rimB.position.set(4.5, 1.6, -3); scene.add(rimB);
  const v = creer(spec); scene.add(v);
  const o = ombre(); o.scale.set(v.userData.l * 1.25, 1, Math.max(v.userData.w, 1.4) * 1.5); scene.add(o);
  return { scene, v, o };
}

function nouveauRendu(cv, opts = {}) {
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.capture, powerPreference: 'high-performance' });
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

function cadrer(cam, v, aspect, angle = -.62, haut = .2) {
  const d = Math.max(v.userData.l * .95, v.userData.w * .85, v.userData.h * 2.4) * Math.max(1.12, 1.12 * 1.72 / aspect) + .9;
  cam.position.set(Math.cos(angle) * d, v.userData.h * .55 + d * haut, Math.sin(angle) * d);
  cam.lookAt(0, v.userData.h * .42, 0);
  return d;
}

// Vue interactive dans un conteneur
export function monter(el, spec, { rotation = true } = {}) {
  const cv = document.createElement('canvas'); cv.className = 'v3d-canvas'; el.appendChild(cv);
  const r = nouveauRendu(cv);
  const st = studio(r, spec), { scene, o } = st; let v = st.v;
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctl = new OrbitControls(cam, cv);
  ctl.enableDamping = true; ctl.dampingFactor = .08; ctl.enablePan = false;
  ctl.autoRotate = rotation && !reduce; ctl.autoRotateSpeed = 1.1;
  ctl.minPolarAngle = .35; ctl.maxPolarAngle = 1.48;
  cv.style.touchAction = 'pan-y'; // le défilement vertical de la page reste possible
  let d = 6;
  const taille = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    d = cadrer(cam, v, w / h); ctl.target.set(0, v.userData.h * .42, 0);
    ctl.minDistance = d * .55; ctl.maxDistance = d * 1.6; ctl.update();
  };
  taille();
  let vis = true, raf = 0;
  const boucle = () => { raf = 0; if (!vis || document.hidden) return; ctl.update(); r.render(scene, cam); raf = requestAnimationFrame(boucle); };
  const go = () => { if (!raf) raf = requestAnimationFrame(boucle); };
  const io = new IntersectionObserver((e) => { vis = e[0].isIntersecting; if (vis) go(); }, { threshold: .05 }); io.observe(el);
  const ro = new ResizeObserver(() => { taille(); go(); }); ro.observe(el);
  document.addEventListener('visibilitychange', go);
  ctl.addEventListener('start', () => el.classList.add('is-touch'));
  go();
  // modèle réaliste fourni (.glb) : il remplace le modèle simplifié dès qu'il est chargé
  if (spec.glb) new GLTFLoader().load(spec.glb, (gl) => {
    const nv = normaliser(gl.scene); scene.remove(v); scene.add(nv); v = nv;
    o.scale.set(v.userData.l * 1.25, 1, Math.max(v.userData.w, 1.4) * 1.5); taille(); go();
    el.classList.add('is-glb');
  });
  return {
    stop(on) { ctl.autoRotate = !on && rotation && !reduce; },
    dispose() { io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); ctl.dispose(); r.dispose(); cv.remove(); }
  };
}

// Image fixe (pour les vignettes) : renvoie un dataURL PNG transparent
export function image(spec, w = 1600, h = 900, angle = -.62, format = 'image/png', q = .9) {
  const cv = document.createElement('canvas');
  const r = nouveauRendu(cv, { capture: true }); r.setPixelRatio(1); r.setSize(w, h, false);
  const { scene, v } = studio(r, spec);
  const cam = new THREE.PerspectiveCamera(30, w / h, .1, 100); cadrer(cam, v, w / h, angle, .17);
  r.render(scene, cam);
  const url = cv.toDataURL(format, q); r.dispose(); return url;
}

if (typeof window !== 'undefined') window.LG3D = { creer, monter, image };
