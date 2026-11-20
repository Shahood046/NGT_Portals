// Heatwave forecast — terrain → weather stations → forecast field → hotspots.
// A plain with a city and low hills; a forecast temperature surface floats above it
// and the hottest ground (urban core, low basins) is picked out underneath.
import { grid, fbm, ridgedMF, span, clamp01 } from '../kit.js';

export const STAGES = [0, 2.6, 5.6, 9.6];
export const SETTLED = 13;

const relief = (x, z) => 0.3 + 0.12 * fbm(x * 0.5, z * 0.5) + 1.6 * clamp01((-z - 1.8) / 3.2) ** 1.4 * (0.5 + 0.8 * ridgedMF(x * 0.4 + 2, z * 0.4 + 6));
const temp = (x, z) => clamp01(0.55 + 0.38 * Math.exp(-((x - 0.8) ** 2 + (z - 1.2) ** 2) / 5) - 0.3 * (relief(x, z) - 0.3) + 0.25 * (fbm(x * 0.35 + 4, z * 0.35) - 0.5));

const FIELD = /* glsl */`
  float field(vec3 L, vec3 n, float h) {
    float t = 0.55 + 0.38 * exp(-(pow(L.x - 0.8, 2.0) + pow(L.z - 1.2, 2.0)) / 5.0) - 0.3 * (h - 0.3) + 0.25 * (vn(L.xz * 0.35 + vec2(4.0, 0.0)) - 0.5);
    return smoothstep(0.72, 0.9, t) * uField * (0.85 + 0.15 * sin(uTime * 1.2 + L.x * 2.0));
  }`;

export function build(k) {
  const g = grid(relief, k.seg ?? 220);
  Object.assign(k.cam, { r: 21.5, el: 0.6, az: 0.7, look: [0.3, 0.6, 0.4] });
  const T = k.terrain(g, { field: FIELD, ramp: ['#ffb547', '#ff7a45', '#ff4d4d'], low: '#4a4638', high: '#5a5450', rock: '#6d6a6a', contour: 0.22 });
  const items = [];
  for (let i = 0; i < 160; i++) {
    const a = (i * 2.399) % (Math.PI * 2), r = Math.sqrt(i / 160) * 1.7, x = 0.8 + Math.cos(a) * r, z = 1.2 + Math.sin(a) * r;
    items.push({ x, z, w: 0.13, d: 0.13, h: 0.06 + (1 - r / 1.7) ** 2 * 0.5, delay: r / 2 });
  }
  const B = k.boxes(items, { base: '#c7cfdc' });
  const P = k.pins([[-3.4, 2.6], [-1.6, 0.6], [0.8, 1.2], [2.9, 3.2], [3.6, -0.4], [-2.8, -1.4], [1.2, -2.6], [-0.4, 3.6]].map(([x, z]) => ({ x, z, h: 0.7 })), { color: '#ffd28a', reach: 0.9 });
  const S = k.surface(temp, { y: g.max + 0.5, amp: 1.3, ramp: ['#3b82ff', '#ffb547', '#ff4d4d'] });

  return {
    update(t) {
      k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.6);
      B.uGrow.value = span(t, 1.2, 3.6) * 1.4;
      P.set(span(t, 2.6, 3.6), t, span(t, 2.8, 4) * (1 - span(t, 5.6, 7)));
      S.uA.value = span(t, 5.6, 7);
      S.uGrow.value = span(t, 5.8, 9.2);
      T.uField.value = span(t, 9.6, 12);
    },
  };
}
