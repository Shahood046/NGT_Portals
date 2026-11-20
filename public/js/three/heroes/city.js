// Digital twin — terrain → urban fabric → infrastructure → flood scenario → exposure.
// A city on the plain below a ridge, cut by a nullah; water rises in the channel and
// the buildings it reaches light up. variant 'b' = a different procedural city.
import { grid, fbm, ridgedMF, span, lerp, hash, clamp01 } from '../kit.js';

export const STAGES = [0, 2.4, 5, 8, 11];
export const SETTLED = 14;

export function build(k, { variant } = {}) {
  const s = variant === 'b' ? 7.3 : 0;
  const channel = (x) => 0.7 * Math.sin(x * 0.55 + 0.4 + s) + 0.5 + 0.25 * Math.sin(x * 1.3 + s);
  const fn = (x, z) => {
    const ridge = clamp01((-z - 1.4) / 3.6) ** 1.5 * 2.7 * (0.55 + 0.7 * ridgedMF(x * 0.4 + 5 + s, z * 0.4 + 1));
    const d = z - channel(x);
    return 0.35 + 0.16 * fbm(x * 0.5 + 1 + s, z * 0.5 + 2) + ridge - 0.42 * Math.exp(-(d * d) / 0.05);
  };
  const g = grid(fn, k.seg ?? 240);
  Object.assign(k.cam, { r: 21.5, el: 0.55, az: 0.62, look: [0.2, 0.4, 0.6] });
  const T = k.terrain(g, { low: '#2f3b37', high: '#47505c', rock: '#5f6672', contour: 0.22, snowline: 99 });

  // street grid: blocks between roads, denser toward the centre, kept off the channel and the ridge
  const items = [], roads = [];
  const STEP = 0.3, cx = 0.3, cz = 1.4;
  for (let x = -4.4; x <= 4.4; x += STEP) for (let z = -1.3; z <= 4.5; z += STEP) {
    const ix = Math.round((x + 4.4) / STEP), iz = Math.round((z + 1.3) / STEP);
    if (ix % 5 === 0 || iz % 5 === 0) continue;
    if (Math.abs(z - channel(x)) < 0.38) continue;
    const dens = Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / 7);
    const r = hash(ix + s * 13, iz);
    if (r > 0.25 + dens * 0.75) continue;
    const [gx, gz] = g.grad(x, z);
    if (Math.hypot(gx, gz) > 0.35) continue;
    items.push({ x, z, w: 0.2 + hash(ix, iz + 3) * 0.06, d: 0.2 + hash(ix + 5, iz) * 0.06, h: 0.06 + (r * dens) ** 1.6 * 1.5 + hash(ix, iz + 9) * 0.08, delay: Math.hypot(x - cx, z - cz) / 7 });
  }
  for (let i = 0; i <= 29; i += 5) {
    const z = -1.3 + i * STEP - STEP / 2, x = -4.4 + i * STEP - STEP / 2;
    const row = [], col = [];
    for (let t = -4.6; t <= 4.6; t += 0.1) {
      if (z > -1.4 && z < 4.6) row.push([t, g.at(t, z) + 0.02, z]);
      if (t > -1.4 && t < 4.6) col.push([x, g.at(x, t) + 0.02, t]);
    }
    if (row.length > 1) roads.push(row);
    if (col.length > 1) roads.push(col);
  }
  const B = k.boxes(items, { base: '#b4c3da', ramp: ['#6d4dff', '#e04fd6', '#ffb547'] });
  const R = k.paths(roads, { color: '#5fe0ff', dash: false, alpha: 0.55 });
  // flood to just above the nullah banks: the corridor floods, the rest of the city stays dry
  const lo = g.min + 0.04, hi = g.min + 0.36;
  const W = k.water({ level: lo - 0.2, deep: '#0b2a5c', shallow: '#4fb8ff', flow: [0.25, 0.05] });

  return {
    update(t) {
      k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.4);
      B.uGrow.value = span(t, 2.4, 5.4) * 1.4;
      R.uReveal.value = span(t, 5, 7.6);
      W.uLevel.value = t < 2.4 ? lo - 0.2 : lerp(lo, hi, span(t, 8, 11));
      B.uLevel.value = W.uLevel.value;
      B.uExpose.value = span(t, 11, 12.5);
    },
  };
}
