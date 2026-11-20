// GLOF — glacier → glacial lake → monitoring → outburst simulation → exposure.
// A glaciated valley head with a moraine-dammed lake; the lake drains and the outburst
// runs down the valley floor past the villages.
import { grid, fbm, ridgedMF, span, lerp } from '../kit.js';

export const STAGES = [0, 2.6, 5.4, 8.4, 11.6];
export const SETTLED = 15;

const axis = (z) => 0.5 * Math.sin(z * 0.55 + 0.6);
const DAM = -1.15, LAKE = [0.25, -2.25];
function valley(x, z) {
  const ax = x - axis(z), dz = Math.abs(ax);
  const walls = 2.1 * Math.min(1, Math.max(0, (dz - 0.7) / 2.9)) ** 1.3 * (0.6 + 0.75 * ridgedMF(x * 0.45 + 2, z * 0.45 + 7));
  const lake = -0.75 * Math.exp(-((x - LAKE[0]) ** 2 + (z - LAKE[1]) ** 2 * 1.6) / 0.9);
  const moraine = 0.34 * Math.exp(-((z - DAM) ** 2) / 0.04) * Math.exp(-((x - LAKE[0]) ** 2) / 1.2);
  return 1.6 - z * 0.26 + walls - 0.28 * Math.exp(-(ax * ax) / 0.04) + lake + moraine + 0.12 * fbm(x * 1.5, z * 1.5);
}

const FIELD = /* glsl */`
  float field(vec3 L, vec3 n, float h) {
    float ax = L.x - 0.5 * sin(L.z * 0.55 + 0.6);
    float run = L.z - (${DAM.toFixed(2)});
    float band = exp(-ax * ax / (0.05 + 0.05 * max(run, 0.0))) * (1.0 - smoothstep(0.3, 0.55, 1.0 - n.y));
    float front = smoothstep(0.0, 0.7, uField * 7.0 - run) * step(0.0, run);
    return band * front * (0.75 + 0.25 * sin(run * 6.0 - uTime * 2.0));
  }`;

export function build(k) {
  const g = grid(valley, k.seg ?? 240);
  Object.assign(k.cam, { r: 25.5, el: 0.7, az: 0.32, look: [0, 1.3, -0.8] });
  const T = k.terrain(g, { field: FIELD, ramp: ['#2d6bff', '#49c6ff', '#e9fbff'], low: '#34413c', high: '#4c5360', rock: '#676d79', contour: 0.25 });
  const basin = g.at(...LAKE), crest = g.at(LAKE[0], DAM);
  const W = k.water({ size: [3.2, 2.4], center: [LAKE[0], LAKE[1] - 0.1], level: basin - 0.3, deep: '#0d3a6e', shallow: '#7fd8ff' });
  const P = k.pins([[-1.0, -2.4], [1.5, -2.6], [0.3, -3.3], [0.9, -1.5], [axis(1.6) + 0.5, 1.6]].map(([x, z]) => ({ x, z, h: 0.7 })), { color: '#5fe0ff', reach: 1.1 });
  const flood = k.paths([k.descend(axis(DAM + 0.15) + 0.02, DAM + 0.15, 0.04, 320)], { color: '#9fe6ff' });
  const villages = [];
  [[0.9, 1], [2.4, -1], [3.8, 1], [4.4, -1]].forEach(([z, side], vi) => {
    for (let i = 0; i < 14; i++) {
      const off = 0.32 + ((i * 37) % 11) / 11 * 0.6, x = axis(z) + side * off, zz = z + (((i * 53) % 9) / 9 - 0.5) * 0.6;
      villages.push({ x, z: zz, w: 0.11, d: 0.14, h: 0.08 + ((i * 29) % 5) * 0.015, v: Math.max(0, 1 - (off - 0.3) / 0.6), delay: vi * 0.1 });
    }
  });
  const V = k.boxes(villages, { base: '#c3cfe2', ramp: ['#3b82ff', '#e04fd6', '#ffb547'] });

  return {
    update(t) {
      k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.6);
      T.uSnowline.value = lerp(g.max + 0.5, g.max * 0.62, span(t, 0.8, 2.8));
      const fill = span(t, 2.6, 5), drain = span(t, 8.4, 11.6);
      W.uLevel.value = lerp(basin - 0.3, crest - 0.06, fill) - drain * (crest - basin - 0.12);
      W.uA.value = fill > 0 ? 1 : 0;
      P.set(span(t, 5.4, 6.4), t, span(t, 5.6, 6.6) * (1 - span(t, 11.6, 13)));
      T.uField.value = span(t, 8.4, 12.2);
      flood.uReveal.value = span(t, 8.4, 12);
      V.uGrow.value = span(t, 1.6, 3.6) * 1.4;
      V.uColorBy.value = span(t, 11.6, 13);
    },
  };
}
