// Coastal intelligence — coastline → 1995 baseline → present day → 2100 projection.
// Low-lying delta coast with creeks; sea level steps up (exaggerated for legibility) and
// the coastal hazard band and exposed settlements grow with it.
import { grid, fbm, ridgedMF, span, lerp, hash, clamp01 } from '../kit.js';

export const STAGES = [0, 2.6, 5.6, 8.6];
export const SETTLED = 12;

const shore = (x) => 0.7 + 0.6 * Math.sin(x * 0.55 + 1) + 0.25 * Math.sin(x * 1.7);
function coast(x, z) {
  const d = shore(x) - z; // > 0 inland
  if (d < 0) return d * 0.32 - 0.05 + 0.04 * fbm(x, z);
  const creek = 0.09 * Math.exp(-((x - 0.8 * Math.sin(z * 1.3) - 1.2) ** 2) / 0.02) * clamp01(1 - d / 2.5);
  return 0.03 + d * 0.11 + 1.9 * clamp01((d - 2.6) / 3.2) ** 1.3 * (0.5 + 0.8 * ridgedMF(x * 0.4 + 1, z * 0.4 + 5)) + 0.06 * fbm(x * 0.8, z * 0.8) - creek;
}

const FIELD = /* glsl */`
  uniform float uSea;
  float field(vec3 L, vec3 n, float h) { return (1.0 - smoothstep(uSea, uSea + 0.32, h)) * step(uSea - 0.01, h) * uField; }`;

export function build(k) {
  const g = grid(coast, k.seg ?? 220);
  Object.assign(k.cam, { r: 21.5, el: 0.58, az: 0.9, look: [0.2, 0.2, 0.6] });
  const LEVELS = [-0.02, 0.03, 0.2];
  const T = k.terrain(g, { field: FIELD, decl: '', uniforms: { uSea: { value: LEVELS[0] } }, low: '#585440', high: '#4c5562', rock: '#666c78', contour: 0.22 });
  const W = k.water({ level: LEVELS[0], deep: '#0a2a55', shallow: '#3fa7e6', flow: [0.05, 0.12] });
  const items = [];
  [[-3, 1], [-0.6, 0.5], [2.4, 1.2], [3.8, 0.7], [0.8, 2.6]].forEach(([cx, inland], ci) => {
    for (let i = 0; i < 24; i++) {
      const x = cx + (hash(i, ci) - 0.5) * 1.2, z = shore(x) - inland - (hash(ci, i) - 0.5) * 0.8;
      if (coast(x, z) < 0.02) continue;
      items.push({ x, z, w: 0.12, d: 0.14, h: 0.07 + hash(i, ci + 3) * 0.12, delay: ci * 0.08 });
    }
  });
  const B = k.boxes(items, { base: '#c3cfe2' });

  return {
    update(t) {
      k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.6);
      B.uGrow.value = span(t, 1.4, 3.4) * 1.4;
      const sea = lerp(lerp(LEVELS[0], LEVELS[1], span(t, 5.6, 7)), LEVELS[2], span(t, 8.6, 10.6));
      W.uLevel.value = sea; T.uSea.value = sea; B.uLevel.value = sea;
      T.uField.value = span(t, 2.6, 4) * (0.6 + 0.4 * span(t, 8.6, 10.6));
      B.uExpose.value = span(t, 9.6, 11);
    },
  };
}
