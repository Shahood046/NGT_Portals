// Multi-hazard risk assessment — area of interest → hazard layers → exposure → risk assessment.
// Mountains behind, a river through the middle, settlements on the plain. Hazard layers
// are drawn down into the terrain; the combined risk lands on ground and buildings.
import { grid, fbm, ridgedMF, span, lerp, hash, clamp01, HALF, SIZE } from '../kit.js';

export const STAGES = [0, 2.8, 6, 9.2];
export const SETTLED = 13.5;

const course = (x) => 0.6 * Math.sin(x * 0.5 + 1) + 0.6;
function relief(x, z) {
  const d = z - course(x);
  const mtn = 2.6 * clamp01((-z - 0.8) / 3.8) ** 1.3 * (0.55 + 0.8 * ridgedMF(x * 0.42 + 4, z * 0.42 + 2));
  return 0.32 + 0.12 * fbm(x * 0.6 + 3, z * 0.6) + mtn - 0.32 * Math.exp(-(d * d) / 0.06);
}
const risk = (x, z) => clamp01(0.9 * Math.exp(-((z - course(x)) ** 2) / 0.9) + 0.6 * clamp01((-z - 0.2) / 2) * fbm(x * 0.8, z * 0.8) + 0.2 * (fbm(x * 0.5 + 9, z * 0.5) - 0.3));

const FIELD = /* glsl */`
  float field(vec3 L, vec3 n, float h) {
    float d = L.z - (0.6 * sin(L.x * 0.5 + 1.0) + 0.6);
    float r = 0.9 * exp(-d * d / 0.9) + 0.4 * smoothstep(0.26, 0.46, 1.0 - n.y) * smoothstep(0.45, 0.75, vn(L.xz * 0.7 + 2.0)) + 0.15 * (vn(L.xz * 0.5 + 9.0) - 0.3);
    return clamp(r, 0.0, 1.0) * uField;
  }`;

export function build(k) {
  const g = grid(relief, k.seg ?? 230);
  Object.assign(k.cam, { r: 22.5, el: 0.57, az: 0.66, look: [0.2, 0.7, 0.3] });
  const T = k.terrain(g, { field: FIELD, low: '#36433b', high: '#4c5361', rock: '#666c78', contour: 0.25, snowline: g.max * 0.82 });
  const layers = [['Flood', 3, '#3b82ff', '#7fd0ff'], ['Landslide', 0, '#ffb547', '#ffd28a'], ['Earthquake', 1, '#a78bfa', '#e0d4ff']]
    .map(([label, type, a, b], i) => { const y = g.max + 0.5 + i * 0.6; return { y, L: k.layer({ label, type, a, b, y, size: 7 }) }; });
  const sweep = k.sweep({ height: g.max + 2.6, color: '#c4a8ff' });
  const items = [], roads = [];
  [[-2.8, 2.6], [-0.4, 3.4], [2.4, 2.2], [1.2, 0.0], [-2.0, 0.4], [3.4, 3.8]].forEach(([cx, cz], ci) => {
    for (let i = 0; i < 22; i++) {
      const x = cx + (hash(i, ci) - 0.5) * 1.1, z = cz + (hash(ci, i) - 0.5) * 0.9;
      if (Math.abs(z - course(x)) < 0.3) continue;
      items.push({ x, z, w: 0.12, d: 0.14, h: 0.07 + hash(i + 7, ci) * 0.14, v: risk(x, z), delay: ci * 0.07 });
    }
    if (ci) { const [px, pz] = [[-2.8, 2.6], [-0.4, 3.4], [2.4, 2.2], [1.2, 0.0], [-2.0, 0.4]][ci - 1]; const pts = []; for (let s = 0; s <= 1.0001; s += 0.04) { const x = lerp(px, cx, s), z = lerp(pz, cz, s); pts.push([x, g.at(x, z) + 0.03, z]); } roads.push(pts); }
  });
  const B = k.boxes(items, { base: '#c3cfe2', ramp: ['#3b82ff', '#e04fd6', '#ffb547'] });
  const R = k.paths(roads, { color: '#9fb6d8', dash: false, alpha: 0.6 });
  k.water({ level: g.min + 0.1, flow: [0.25, 0.08] });

  return {
    update(t) {
      k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.8);
      const inL = span(t, 2.8, 4.4), down = span(t, 9.2, 11.6);
      layers.forEach(({ y, L }, i) => { L.set(span(t, 2.8 + i * 0.5, 4.2 + i * 0.5) * (1 - down)); L.g.position.y = lerp(y, g.max * 0.4, down) + Math.sin(t * 0.4 + i) * 0.04 * inL * (1 - down); });
      B.uGrow.value = span(t, 6, 7.8) * 1.4;
      R.uReveal.value = span(t, 6.4, 8.4);
      const sw = (t - 9.2) / 2.6, x = sw < 0 ? -99 : sw > 1 ? 99 : -HALF - 0.5 + sw * (SIZE + 1);
      T.uScan.value = x; sweep.set(x, sw >= 0 && sw <= 1 ? 1 : 0);
      T.uField.value = span(t, 10.4, 13) * 0.85;
      B.uColorBy.value = span(t, 10.8, 12.8);
    },
  };
}
