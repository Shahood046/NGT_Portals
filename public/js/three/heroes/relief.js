// General relief — northern ranges falling to plains and a river. Used behind the opening
// and in the vision showreel (ambient: no stages, just the settled scene drifting).
import { grid, fbm, ridgedMF, span, clamp01 } from '../kit.js';

export const STAGES = [0];
export const SETTLED = 3;

const course = (x) => 1.6 + 0.8 * Math.sin(x * 0.4 + 0.5);
function relief(x, z) {
  const d = z - course(x);
  const range = 3.2 * clamp01((-z + 0.4) / 5.2) ** 1.5 * (0.5 + 0.85 * ridgedMF(x * 0.42 + 2, z * 0.42 + 4));
  return 0.25 + 0.12 * fbm(x * 0.6, z * 0.6) + range - 0.3 * Math.exp(-(d * d) / 0.05);
}

export function build(k) {
  const g = grid(relief, k.seg ?? 220);
  Object.assign(k.cam, { r: 22, el: 0.5, az: 0.75, look: [0.2, 0.9, 0], drift: 0.35 });
  k.terrain(g, { low: '#38463c', high: '#4d5462', rock: '#686e7a', contour: 0.4, snowline: g.min + (g.max - g.min) * 0.6 });
  k.water({ level: g.min + 0.1, flow: [0.25, 0.05] });
  return { update(t) { k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.6); } };
}
