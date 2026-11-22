// Produit src/rendus/<slug>.webp (vue 3/4 avant, fond transparent) pour chaque modèle de data/modeles3d.json.
// Usage : node tools/rendus3d.cjs [largeur] [hauteur]   (nécessite Playwright + Chromium)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
(async () => {
  const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 720);
  const { modeles } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'modeles3d.json'), 'utf8'));
  const out = path.join(ROOT, 'src', 'rendus'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  await p.setContent('<!doctype html><meta charset="utf-8"><body></body>');
  await p.addScriptTag({ path: path.join(ROOT, 'src', 'vehicule3d.js') });
  let total = 0;
  for (const [slug, spec] of Object.entries(modeles)) {
    const url = await p.evaluate(([s, w, h]) => window.LG3D.image(s, w, h, -.62, 'image/webp', .86), [spec, W, H]);
    const buf = Buffer.from(url.split(',')[1], 'base64'); total += buf.length;
    fs.writeFileSync(path.join(out, slug + '.webp'), buf);
  }
  console.log(`${Object.keys(modeles).length} rendus · ${Math.round(total / 1024)} Ko → src/rendus/`);
  await b.close();
})();
