// District rainfall intelligence — districts → monthly → seasonal → annual.
// Irregular district cells are drawn on the land (Voronoi boundaries); a column stands on
// each district and morphs between the monthly, seasonal and annual totals.
import { grid, fbm, ridgedMF, span, lerp, hash, clamp01, THREE } from '../kit.js';

export const STAGES = [0, 2.6, 5.6, 8.6];
export const SETTLED = 11.5;

const N = 48;
const seeds = Array.from({ length: N }, (_, i) => [-4.3 + (i % 8) * 1.23 + (hash(i, 1) - 0.5) * 0.8, -4.0 + Math.floor(i / 8) * 1.45 + (hash(i, 2) - 0.5) * 0.8]);
const relief = (x, z) => 0.3 + 0.12 * fbm(x * 0.5 + 2, z * 0.5) + 2.2 * clamp01((-z - 1.4) / 3.6) ** 1.4 * (0.5 + 0.8 * ridgedMF(x * 0.4 + 7, z * 0.4 + 3));

const FIELD = /* glsl */`
  uniform vec2 uSeeds[${N}];
  float field(vec3 L, vec3 n, float h) {
    float d1 = 1e9, d2 = 1e9;
    for (int i = 0; i < ${N}; i++) { float d = distance(L.xz, uSeeds[i]); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    return (1.0 - smoothstep(0.0, 0.05, d2 - d1)) * uField;
  }`;

export function build(k) {
  const g = grid(relief, k.seg ?? 200);
  Object.assign(k.cam, { r: 22.5, el: 0.64, az: 0.7, look: [0.2, 0.8, 0.3] });
  const T = k.terrain(g, {
    field: FIELD, decl: '', uniforms: { uSeeds: { value: seeds.map(([x, z]) => new THREE.Vector2(x, z)) } },
    ramp: ['#5fe0ff', '#5fe0ff', '#9fe6ff'], low: '#3b4a3c', high: '#4f5662', rock: '#666c78', contour: 0.15, snowline: g.max * 0.85,
  });
  // three rainfall states per district (monsoon wetter to the north-east, drier south-west)
  const base = seeds.map(([x, z]) => clamp01(0.35 + 0.08 * x - 0.06 * z + 0.3 * (fbm(x * 0.4, z * 0.4) - 0.4)));
  const sets = [
    base.map((v, i) => clamp01(v * 0.7 + 0.3 * hash(i, 9))),
    base.map((v, i) => clamp01(v * 0.9 + 0.12 * hash(i, 4))),
    base,
  ];
  const shape = (vals) => seeds.map(([x, z], i) => ({ x, z, w: 0.36, h: 0.15 + vals[i] * 2.2, v: vals[i], delay: hash(i, 5) * 0.4 }));
  const C = k.boxes(shape(sets[0]), { round: true, colorBy: true, alpha: 0.92, ramp: ['#3b82ff', '#8b5cff', '#e04fd6'] });

  return {
    update(t) {
      k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.6);
      T.uField.value = span(t, 1.4, 3.2);
      C.uGrow.value = span(t, 2.6, 4.6) * 1.4;
      const a = span(t, 5.6, 6.8), b = span(t, 8.6, 9.8);
      C.set(shape(sets[0].map((v, i) => lerp(lerp(v, sets[1][i], a), sets[2][i], b))));
    },
  };
}
