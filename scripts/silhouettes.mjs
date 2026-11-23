// Silhouettes néon originales des véhicules (profil, viewBox 0 0 240 100), avant à droite.
const GY = 72; // ligne des roues

// Carrosserie générique : profil du toit + passages de roues
function car(top, wheels, r = 12, extra = '') {
  const [x0] = top[0], [x1] = top[top.length - 1];
  let d = `M${x0} ${GY - 4} ` + top.map(([x, y]) => `L${x} ${y}`).join(' ') + ` L${x1} ${GY - 4}`;
  const ws = [...wheels].sort((a, b) => b - a);
  for (const w of ws) d += ` L${w + r + 3} ${GY - 4} A${r + 3} ${r + 3} 0 0 0 ${w - r - 3} ${GY - 4}`;
  d += ` L${x0} ${GY - 4}`;
  const roues = wheels.map((w) => `<circle cx="${w}" cy="${GY}" r="${r}"/><circle cx="${w}" cy="${GY}" r="${r * .4}"/>`).join('');
  return `<path d="${d}"/>${roues}${extra}`;
}
const vitre = (d) => `<path class="vs-glass" d="${d}"/>`;

export const SILHOUETTES = {
  supercar: car([[14, 64], [18, 56], [60, 52], [96, 38], [140, 36], [176, 48], [218, 54], [228, 62]], [54, 186], 12, vitre('M100 41 L138 39 L168 50 L92 51 Z')),
  hypercar: car([[14, 64], [18, 56], [60, 52], [96, 38], [140, 36], [176, 48], [218, 54], [228, 62]], [54, 186], 12, vitre('M100 41 L138 39 L168 50 L92 51 Z') + '<path d="M16 56 L16 44 L44 44 L40 52"/>'),
  muscle: car([[12, 66], [14, 50], [52, 48], [82, 30], [128, 28], [150, 44], [220, 46], [230, 54], [230, 64]], [52, 192], 13, vitre('M88 33 L126 31 L144 45 L80 46 Z') + '<path d="M170 46 L200 40 L214 46"/>'),
  sportive: car([[14, 66], [16, 52], [56, 48], [88, 32], [136, 30], [164, 46], [218, 50], [228, 58], [228, 64]], [54, 186], 12, vitre('M94 35 L134 33 L158 47 L84 48 Z')),
  berline: car([[12, 66], [12, 50], [44, 48], [72, 28], [150, 28], [176, 46], [222, 48], [230, 56], [230, 64]], [52, 190], 12, vitre('M78 32 L110 31 L110 46 L60 47 Z M116 31 L148 31 L168 46 L116 46 Z')),
  pickup: car([[10, 66], [10, 44], [104, 44], [108, 22], [160, 22], [178, 42], [224, 44], [232, 52], [232, 64]], [48, 194], 14, vitre('M114 26 L156 26 L170 42 L112 42 Z') + '<path d="M104 44 L104 60"/>'),
  classique: car([[10, 64], [8, 48], [30, 44], [36, 36], [60, 40], [86, 22], [140, 22], [160, 40], [220, 42], [232, 52], [232, 64]], [56, 186], 13, vitre('M92 26 L136 26 L152 40 L80 41 Z') + '<path d="M60 52 H200"/>'),
  buggy: `<path d="M26 58 L70 58 L96 26 L150 26 L178 58 L218 58 M96 26 L118 58 L150 26 M70 58 L178 58"/><circle cx="46" cy="${GY - 4}" r="16"/><circle cx="46" cy="${GY - 4}" r="6"/><circle cx="198" cy="${GY - 4}" r="16"/><circle cx="198" cy="${GY - 4}" r="6"/>`,
  camion: `<path d="M8 14 H164 V58 H8 Z M170 64 V22 H212 L232 42 V64 Z"/><path class="vs-glass" d="M180 28 H208 L222 42 H180 Z"/>` + [36, 66, 196].map((w) => `<circle cx="${w}" cy="${GY - 2}" r="11"/><circle cx="${w}" cy="${GY - 2}" r="4"/>`).join(''),
  moto: `<circle cx="52" cy="66" r="22"/><circle cx="52" cy="66" r="6"/><circle cx="184" cy="66" r="22"/><circle cx="184" cy="66" r="6"/><path d="M52 66 L94 40 L142 40 L184 66 M94 40 L118 66 M142 40 L160 18 L172 18 M86 32 L128 32 L140 40"/>`,
  enduro: `<circle cx="50" cy="68" r="22"/><circle cx="50" cy="68" r="6"/><circle cx="188" cy="68" r="22"/><circle cx="188" cy="68" r="6"/><path d="M50 68 L92 38 L138 36 L188 68 M92 38 L114 68 M138 36 L162 14 L176 14 M80 30 L132 28 M168 34 L204 40 M26 40 L60 38"/>`,
  vedette: `<path d="M8 50 H232 L214 74 H30 Z M82 50 L98 30 H150 L162 50"/><path class="vs-glass" d="M104 34 H146 L154 48 H96 Z"/><path class="vs-water" d="M0 84 Q30 78 60 84 T120 84 T180 84 T240 84"/>`,
  peche: `<path d="M8 52 H232 L214 74 H30 Z M118 52 V22 H154 V52 M126 22 V10 H146 V22 M154 30 L210 6"/><path class="vs-water" d="M0 84 Q30 78 60 84 T120 84 T180 84 T240 84"/>`,
  kayak: `<path d="M6 60 Q120 44 234 60 Q120 74 6 60 Z M100 54 Q120 46 140 54"/><path d="M84 26 L156 78 M76 20 L92 32 M148 72 L164 84"/><path class="vs-water" d="M0 84 Q30 78 60 84 T120 84 T180 84 T240 84"/>`,
  jetski: `<path d="M24 66 H198 L218 52 L156 46 L126 32 H98 L82 48 L40 50 Z M126 32 L132 20 L146 20"/><path class="vs-water" d="M0 82 Q30 76 60 82 T120 82 T180 82 T240 82"/>`,
  airboat: `<path d="M10 62 H210 L228 76 H20 Z M86 62 V46 H118 V62"/><circle cx="50" cy="36" r="26"/><path d="M50 10 V62 M24 36 H76 M32 18 L68 54 M68 18 L32 54"/><path class="vs-water" d="M0 86 Q30 80 60 86 T120 86 T180 86 T240 86"/>`,
  avion: `<path d="M20 52 Q60 40 200 44 L228 50 L200 56 Q60 62 20 52 Z M24 50 L14 26 L42 46 M68 36 H196 M120 36 L126 44 M228 34 V66"/><path class="vs-glass" d="M150 44 L170 38 L188 44 Z"/>`,
  hydravion: `<path d="M20 48 Q60 36 200 40 L228 46 L200 52 Q60 58 20 48 Z M24 46 L14 22 L42 42 M68 32 H196 M228 30 V62 M80 54 L74 72 M160 52 L166 72 M52 76 H190 Q206 76 206 70"/><path class="vs-glass" d="M150 40 L170 34 L188 40 Z"/>`,
  jet: `<path d="M10 52 L150 44 L232 50 L150 58 Z M70 51 L128 14 L150 45 M70 51 L128 88 L150 57 M20 51 L12 30 L40 47"/><path class="vs-glass" d="M176 46 L204 47 L190 44 Z"/>`,
  inconnu: `<path stroke-dasharray="6 6" d="M14 64 L16 52 L56 48 L88 32 L136 30 L164 46 L218 50 L228 64 Z"/><circle cx="54" cy="72" r="12" stroke-dasharray="4 4"/><circle cx="186" cy="72" r="12" stroke-dasharray="4 4"/><path d="M110 46 Q110 38 120 38 Q130 38 130 44 Q130 50 120 52 V56 M120 62 V63"/>`,
  helicoptere: `<path d="M72 50 Q72 30 112 30 H152 Q178 34 178 54 Q172 66 122 66 H92 Q72 66 72 50 Z M72 46 L14 40 V30 L6 26 M36 20 H212 M126 30 V20 M86 80 H172 M102 66 V80 M152 66 V80"/><path class="vs-glass" d="M150 34 Q172 38 174 52 H148 Z"/>`
};

const PAR_SLUG = {
  'pegassi-infernus': 'supercar', 'grotti-cheetah-95': 'supercar', 'pegassi-tempesta': 'supercar', 'granforma-zorrusso': 'supercar',
  'progen-emerus-royal-ruby': 'hypercar', 'bravado-gauntlet-hellfire': 'muscle', 'imponte-phoenix-bloodbath': 'muscle', 'imponte-ruiner': 'muscle',
  'maibatsu-penumbra-ff': 'sportive', 'maibatsu-penumbra-shirley': 'sportive', 'pfister-comet-s2': 'sportive', 'obey-tailgater-s': 'berline',
  'vapid-ganado': 'pickup', 'vapid-stanier-55': 'classique', 'vapid-dominator-buggy': 'buggy', 'jobuilt-hauler': 'camion', 'hauners-ridgway': 'inconnu',
  'moto-sportive': 'moto', 'dinka-enduro': 'enduro', 'vedette': 'vedette', 'bombora-s23': 'vedette', 'shitzu-squalo': 'peche', 'kayak-crest': 'kayak',
  'jet-ski': 'jetski', 'hydroglisseur': 'airboat', 'mallard-flammes': 'avion', 'mammoth-dodo': 'hydravion', 'jets-militaires': 'jet',
  'helicoptere-toits': 'helicoptere', 'lapwing-stolen-valor': 'inconnu'
};
const PAR_TYPE = { voitures: 'sportive', motos: 'moto', bateaux: 'vedette', avions: 'avion', autres: 'sportive' };

export function silhouette(v, cls = '') {
  const k = PAR_SLUG[v.slug] || PAR_TYPE[v.type] || 'sportive';
  return `<svg class="veh-svg ${cls}" viewBox="0 0 240 100" role="img" aria-label="${k === 'inconnu' ? 'Apparence non confirmée' : 'Silhouette du véhicule'}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SILHOUETTES[k]}</svg>`;
}
