// Climate downscaling — observed → raw CMIP6 → downscaled (~5 km) → SSP scenarios.
// Coarse model cells hover over the terrain, then resolve into a fine grid that follows
// the relief; the scenario stage lifts the fine field to its projected change.
import { grid, fbm, ridgedMF, span, clamp01 } from '../kit.js';

export const STAGES = [0, 2.6, 5.6, 9];
export const SETTLED = 12.5;

const relief = (x, z) => 0.3 + 0.14 * fbm(x * 0.5 + 6, z * 0.5) + 2.4 * clamp01((-z - 1.2) / 3.8) ** 1.4 * (0.5 + 0.8 * ridgedMF(x * 0.4 + 3, z * 0.4 + 8));

export function build(k) {
  const g = grid(relief, k.seg ?? 220);
  Object.assign(k.cam, { r: 22.5, el: 0.62, az: 0.74, look: [0.2, 1.0, 0.2] });
  k.terrain(g, { low: '#3a493d', high: '#4e5563', rock: '#676d79', contour: 0.3, snowline: g.max * 0.8 });
  const plane = g.max + 0.5;
  const value = (x, z) => clamp01(0.62 - 0.22 * (g.at(x, z) - g.min) / (g.max - g.min) + 0.3 * (fbm(x * 0.6 + 2, z * 0.6) - 0.4) + 0.05 * x);
  const coarse = [], fine = [], fine2 = [];
  const C = 6, F = 26;
  for (let i = 0; i < C; i++) for (let j = 0; j < C; j++) {
    const x = -5 + (i + 0.5) * (10 / C), z = -5 + (j + 0.5) * (10 / C);
    let v = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) v += value(x - 0.6 + a * 0.4, z - 0.6 + b * 0.4);
    v /= 16; coarse.push({ x, z, y: plane, w: 10 / C - 0.08, h: 0.05 + v * 0.6, v, delay: (i + j) / 24 });
  }
  for (let i = 0; i < F; i++) for (let j = 0; j < F; j++) {
    const x = -5 + (i + 0.5) * (10 / F), z = -5 + (j + 0.5) * (10 / F), v = value(x, z), s = clamp01(v + 0.22 + 0.1 * (1 - (z + 5) / 10));
    fine.push({ x, z, y: plane, w: 10 / F - 0.04, h: 0.03 + v * 0.6, v, delay: (i + j) / 104 });
    fine2.push({ x, z, y: plane, w: 10 / F - 0.04, h: 0.03 + s * 0.9, v: s, delay: (i + j) / 104 });
  }
  const ramp = ['#2fd3e0', '#3ddc97', '#ffb547'];
  const CB = k.boxes(coarse, { colorBy: true, alpha: 0.6, ramp });
  const FB = k.boxes(fine, { colorBy: true, alpha: 0.85, ramp });
  const P = k.pins([[-3.2, 2.4], [-0.8, 3.4], [1.8, 1.6], [3.6, 3.2], [0.4, -0.6], [-2.6, -1.8], [2.6, -2.8]].map(([x, z]) => ({ x, z, h: 0.7 })), { color: '#5fe0ff', reach: 0.9 });
  let last = -1;

  return {
    update(t) {
      k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.6);
      P.set(span(t, 0.8, 2) * (1 - span(t, 5.6, 7)), t, span(t, 1, 2.4) * (1 - span(t, 2.6, 4)));
      CB.uGrow.value = span(t, 2.6, 4.4) * 1.4;
      CB.uA.value = 0.6 * (1 - span(t, 5.6, 7));
      FB.uGrow.value = span(t, 5.8, 8) * 1.4;
      const s = span(t, 9, 10.8);
      if (Math.abs(s - last) > 0.01) { last = s; FB.set(fine.map((b, i) => ({ ...b, h: b.h + (fine2[i].h - b.h) * s, v: b.v + (fine2[i].v - b.v) * s }))); }
    },
  };
}
