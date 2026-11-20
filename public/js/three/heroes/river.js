// River flood scenes. A meandering river in a broad valley between hill ranges.
//  default ('gauges', FloodGuard / Smart Sensing): catchment → river gauges → rainfall → AI forecast → inundation
//  'impact' (Flood Impact Warning):               catchment → rainfall → river response → inundation → impact
import { grid, fbm, ridgedMF, span, lerp, hash, HALF, SIZE } from '../kit.js';

export const STAGES = [0, 2.6, 5.2, 8.2, 11.2];
export const SETTLED = 14.5;

const course = (x) => 0.9 * Math.sin(x * 0.45 + 0.4) + 0.3 * Math.sin(x * 1.1);
function valley(x, z) {
  const d = z - course(x), ad = Math.abs(d);
  const hills = 2.0 * Math.min(1, Math.max(0, (ad - 1.6) / 3)) ** 1.2 * (0.55 + 0.8 * ridgedMF(x * 0.4 + 9, z * 0.4 + 1));
  return 0.25 + 0.08 * fbm(x * 0.6, z * 0.6) + 0.34 * Math.min(1, ad / 1.6) + hills - 0.36 * Math.exp(-(d * d) / 0.05);
}

const FIELD = /* glsl */`
  uniform float uFore;
  float field(vec3 L, vec3 n, float h) { return clamp((uFore - h) * 4.0, 0.0, 1.0) * uField * step(0.0, uFore - h); }`;

export function build(k, { variant } = {}) {
  const impact = variant === 'impact';
  const g = grid(valley, k.seg ?? 240);
  Object.assign(k.cam, { r: 21.5, el: 0.56, az: 0.72, look: [0.2, 0.4, 0] });
  // flood stage reaches the lower floodplain beside the channel, not the whole valley
  const lo = g.min + 0.08, flood = g.min + 0.47;
  const T = k.terrain(g, {
    field: FIELD, decl: '', uniforms: { uFore: { value: flood } }, ramp: ['#49c6ff', '#3b6dff', '#8b5cff'],
    low: '#33433a', high: '#4a5260', rock: '#646b77', contour: 0.28,
  });
  const W = k.water({ level: lo - 0.3, flow: [0.3, 0.06] });
  const rain = k.tracers(260, {
    spawn: (i) => [-HALF + hash(i, 1) * SIZE, 2 + hash(i, 2) * 3, -HALF + hash(i, 3) * SIZE],
    step: (p, dt, t, i) => { p[1] -= 3.2 * dt; if (p[1] < g.at(p[0], p[2])) { p[0] = -HALF + hash(i, t) * SIZE; p[2] = -HALF + hash(t, i) * SIZE; p[1] = 4.5; } },
    color: '#bfe3ff', size: 1.8,
  });
  const P = k.pins([-4, -2.4, -0.8, 0.8, 2.4, 4].map((x) => ({ x, z: course(x) + 0.3, h: 0.75 })), { color: '#5fe0ff', reach: 1.2 });
  const sweep = k.sweep({ height: 4 });
  let B = null;
  if (impact) {
    const items = [];
    [[-2.6, 1], [0.2, -1], [2.8, 1], [1.4, 1], [-1.2, -1]].forEach(([cx, side], ci) => {
      for (let i = 0; i < 26; i++) {
        const x = cx + (hash(i, ci) - 0.5) * 1.3, z = course(x) + side * (0.35 + hash(ci, i) * 1.1);
        items.push({ x, z, w: 0.12, d: 0.15, h: 0.07 + hash(i + 3, ci) * 0.12, delay: ci * 0.08 });
      }
    });
    B = k.boxes(items, { base: '#c3cfe2' });
  }

  return {
    update(t, dt) {
      k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.6);
      if (B) B.uGrow.value = span(t, 1.2, 3.4) * 1.4;
      if (impact) {
        rain.set(0.8 * span(t, 2.6, 3.4) * (1 - span(t, 7.6, 8.6)), t, dt);
        P.set(span(t, 5.2, 6), t, span(t, 5.4, 6.2));
        W.uLevel.value = t < 2.6 ? lo - 0.3 : lerp(lo, lo + 0.14, span(t, 5.2, 7.6)) + (flood - lo - 0.14) * span(t, 8.2, 11);
        B.uLevel.value = W.uLevel.value; B.uExpose.value = span(t, 11.2, 12.6);
      } else {
        P.set(span(t, 2.6, 3.6), t, span(t, 2.8, 3.8));
        rain.set(0.8 * span(t, 5.2, 6) * (1 - span(t, 8.2, 9.2)), t, dt);
        const sw = (t - 8.2) / 3, x = sw < 0 ? -99 : sw > 1 ? 99 : -HALF - 0.5 + sw * (SIZE + 1);
        T.uScan.value = x; sweep.set(x, sw >= 0 && sw <= 1 ? 1 : 0);
        T.uField.value = span(t, 8.4, 11.2) * (1 - span(t, 11.4, 13.4));
        W.uLevel.value = t < 2.6 ? lo - 0.3 : lerp(lo, flood, span(t, 11.2, 14));
      }
    },
  };
}
