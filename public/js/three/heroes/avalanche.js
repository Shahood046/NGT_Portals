// Snow Avalanche Prediction — terrain → snowpack → environmental data → AI analysis → prediction.
// Illustrative: release zones come from slope, aspect (wind-loaded lee) and snow cover.
import { grid, fbm, ridgedMF, span, lerp, hash, HALF, SIZE } from '../kit.js';

export const STAGES = [0, 2.6, 5.2, 8.6, 11.6];
export const SETTLED = 15;

// An alpine massif: a pointed summit cone and a lower sub-peak, carved by domain-warped
// ridged multifractal noise into arêtes, couloirs and gullies.
export function alpine(x, z) {
  const wx = x + 1.1 * (fbm(x * 0.22 + 11, z * 0.22 + 3) - 0.5), wz = z + 1.1 * (fbm(x * 0.22 + 2, z * 0.22 + 17) - 0.5);
  const cone = Math.max(0, 1 - Math.hypot(wx - 0.4, wz + 0.2) / 4.4);
  const cone2 = Math.max(0, 1 - Math.hypot(wx + 2.6, wz - 2.0) / 2.6);
  const rid = ridgedMF(wx * 0.38 + 3.3, wz * 0.38 + 1.9);
  const massif = 3.0 * cone ** 1.35 + 1.25 * cone2 ** 1.5;
  return massif + rid * 2.1 * (0.22 + 0.78 * Math.max(cone, cone2 * 0.8)) + 0.18 * fbm(x * 1.6, z * 1.6) + 0.12;
}

const FIELD = /* glsl */`
  float field(vec3 L, vec3 n, float h) {
    vec2 wind = normalize(vec2(1.0, 0.3));
    float slope = 1.0 - n.y;
    float lee = smoothstep(0.02, 0.4, dot(n.xz, wind));
    float band = smoothstep(0.10, 0.18, slope) * (1.0 - smoothstep(0.34, 0.5, slope));
    float sn = smoothstep(uSnowline - 0.15, uSnowline + 0.25, h);
    float zones = smoothstep(0.3, 0.7, vn(L.xz * 0.85 + 3.0));
    float r = band * lee * sn * zones * (0.8 + 0.2 * sin(h * 9.0 + uTime * 1.1));
    return r * smoothstep(0.0, 0.35, uField * (uGMax - uGMin + 0.6) - (uGMax - h));   // revealed summit-down
  }`;

export function build(k) {
  const g = grid(alpine, k.seg ?? 256);
  Object.assign(k.cam, { r: 24.5, el: 0.55, look: [0.3, g.max * 0.3, 0] });
  const snowEnd = g.min + (g.max - g.min) * 0.4;
  const T = k.terrain(g, { field: FIELD, low: '#3a463f', high: '#4d5462', rock: '#6b717d', contour: 0.3 });

  const layers = [['Temperature', 0, '#3b82ff', '#5fe0ff'], ['Snow depth', 1, '#9fc3ff', '#ffffff'], ['Wind field', 2, '#a78bfa']]
    .map(([label, type, a, b], i) => { const y = g.max + 0.6 + i * 0.55; return { y, L: k.layer({ label, type, a, b, y }) }; });
  const sweep = k.sweep({ height: g.max + 2.5 });
  const wind = k.tracers(200, {
    spawn: (i) => { const x = -HALF + hash(i, 1) * SIZE, z = -HALF + hash(i, 2) * SIZE; return [x, g.at(x, z) + 0.35, z, 0.5 + hash(i, 3) * 0.6, hash(i, 4) * 6]; },
    step: (p, dt, t, i) => {
      p[0] += p[3] * dt; p[2] += (0.3 * p[3] + 0.25 * Math.sin(p[0] * 0.8 + p[4])) * dt;
      if (p[0] > HALF) { p[0] = -HALF; p[2] = -HALF + hash(i, t) * SIZE; }
      if (p[2] > HALF) p[2] = -HALF; if (p[2] < -HALF) p[2] = HALF;
      p[1] = g.at(p[0], p[2]) * k.U.uRise.value + 0.35 + 0.2 * Math.sin(p[4] + t);
    },
  });

  // runout: steepest descent from the most loaded release cells (lee of the wind, release-angle band)
  const starts = [];
  for (let x = -4.2; x <= 4.2; x += 0.3) for (let z = -4.2; z <= 4.2; z += 0.3) {
    const [dx, dz] = g.grad(x, z), sl = Math.hypot(dx, dz), y = g.at(x, z);
    if (y > snowEnd + 0.5 && sl > 0.5 && sl < 1.5 && (dx + dz * 0.3) / sl < -0.3) starts.push([x, z, y * sl]);
  }
  starts.sort((a, b) => b[2] - a[2]);
  const picked = [];
  for (const s of starts) { if (picked.every((p) => Math.hypot(p[0] - s[0], p[1] - s[1]) > 1.2)) picked.push(s); if (picked.length === 7) break; }
  const run = k.paths(picked.map(([x, z]) => k.descend(x, z)), { color: '#ffb547' });

  return {
    update(t, dt) {
      k.U.uRise.value = 0.03 + 0.97 * span(t, 0, 2.6);
      T.uSnowline.value = lerp(g.max + 0.6, snowEnd, span(t, 2.6, 5.2));
      const dataIn = span(t, 5.2, 6.6), down = span(t, 8.6, 11.4);
      layers.forEach(({ y, L }, i) => { L.set(dataIn * (1 - down)); L.g.position.y = lerp(y, g.max * 0.5, down) + Math.sin(t * 0.4 + i) * 0.04 * (1 - down); });
      const sw = (t - 8.6) / 3, x = sw < 0 ? -99 : sw > 1 ? 99 : -HALF - 0.5 + sw * (SIZE + 1);
      T.uScan.value = x; sweep.set(x, sw >= 0 && sw <= 1 ? 1 : 0);
      T.uAnalysed.value = sw >= 0 ? 1 - span(t, 11.6, 13.1) : 0;
      T.uField.value = span(t, 11.6, 15);
      run.uReveal.value = T.uField.value;
      wind.set(0.75 * span(t, 5.2, 6.7) * (1 - 0.45 * span(t, 11.6, 13.6)), t, dt);
    },
  };
}
