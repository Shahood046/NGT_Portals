// Shared 3D kit for project scenes ("heroes"). One visual grammar for every project:
// a cut-away terrain specimen block lit by a low sun (baked cast shadows + ambient
// occlusion), on which each project places its own data — water, buildings, columns,
// hovering data layers, an analysis sweep, flow paths, sensors, field surfaces.
// A hero module (js/three/heroes/<kind>.js) exports STAGES, SETTLED and build(kit).
import * as THREE from '../../vendor/three.module.js';

export { THREE };
export const SIZE = 10, HALF = SIZE / 2, BASE = -0.9;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const span = (t, a, b) => ease((t - a) / (b - a)); // eased 0→1 progress of t through [a, b]

// ── noise (CPU) ──
export const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
// Ridged multifractal: sharp crests, each octave weighted by the last — reads as eroded rock.
export function ridgedMF(x, y, oct = 6) {
  let s = 0, a = 0.5, f = 1, w = 1;
  for (let i = 0; i < oct; i++) {
    let sig = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1);
    sig *= sig * w;
    w = clamp01(sig * 2);
    s += sig * a; f *= 2.1; a *= 0.5;
  }
  return s;
}

const NOISE = /* glsl */`
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
  vec3 ramp3(vec3 a, vec3 b, vec3 c, float t) { return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, t * 2.0 - 1.0); }
`;
const UV_VS = 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';

// ── height grid: sampled once, shared by mesh, shadows, particles and placement ──
export function grid(fn, seg = 240) {
  const n = seg + 1, H = new Float32Array(n * n);
  let max = -Infinity, min = Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = fn(-HALF + (SIZE * i) / seg, -HALF + (SIZE * j) / seg);
    H[j * n + i] = v; if (v > max) max = v; if (v < min) min = v;
  }
  const idx = (fi, fj) => {
    fi = Math.min(seg, Math.max(0, fi)); fj = Math.min(seg, Math.max(0, fj));
    const i = Math.min(seg - 1, Math.floor(fi)), j = Math.min(seg - 1, Math.floor(fj)), u = fi - i, v = fj - j;
    return lerp(lerp(H[j * n + i], H[j * n + i + 1], u), lerp(H[(j + 1) * n + i], H[(j + 1) * n + i + 1], u), v);
  };
  const at = (x, z) => idx(((x + HALF) / SIZE) * seg, ((z + HALF) / SIZE) * seg);
  const grad = (x, z, e = 0.04) => [(at(x + e, z) - at(x - e, z)) / (2 * e), (at(x, z + e) - at(x, z - e)) / (2 * e)];
  return { seg, n, H, max, min, at, idx, grad };
}

// Cast shadows (horizon march toward the sun) + ambient occlusion, baked per vertex.
function bake(g, sun) {
  const { seg, n, H, idx } = g, cell = SIZE / seg, out = new Float32Array(n * n * 2);
  const dl = Math.hypot(sun.x, sun.z), dx = sun.x / dl, dz = sun.z / dl, rise = (sun.y / dl) * cell;
  const ring = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4) * 5, Math.sin((k * Math.PI) / 4) * 5]);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, h0 = H[k];
    let occ = 0;
    for (let s = 2; s < 90; s += 1.5) {
      const fi = i + dx * s, fj = j + dz * s;
      if (fi < 0 || fj < 0 || fi > seg || fj > seg) break;
      occ = Math.max(occ, idx(fi, fj) - (h0 + rise * s));
    }
    let avg = 0;
    for (const [ox, oz] of ring) avg += idx(i + ox, j + oz);
    out[k * 2] = clamp01(1 - occ * 2.2);
    out[k * 2 + 1] = Math.min(1, Math.max(0.4, 1 - Math.max(0, avg / 8 - h0) * 1.1));
  }
  return out;
}

const TERRAIN_VS = /* glsl */`
  uniform float uRise; attribute vec2 sh;
  varying vec3 vW; varying vec3 vL; varying vec3 vN; varying float vH; varying vec2 vSh;
  void main() {
    vec3 p = position; p.y *= uRise; vH = position.y; vL = vec3(p.x, position.y, p.z); vSh = sh;
    vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const terrainFS = (field, decl) => /* glsl */`
  uniform float uTime, uRise, uSnowline, uField, uScan, uAnalysed, uContour, uGMin, uGMax;
  uniform vec3 uSun, uBg, cLow, cHigh, cRock, cSnow, cCont, cP1, cP2, cP3, cScan;
  ${decl}
  varying vec3 vW; varying vec3 vL; varying vec3 vN; varying float vH; varying vec2 vSh;
  ${NOISE}
  ${field}
  void main() {
    vec3 n = normalize(vN), sun = normalize(uSun);
    float slope = 1.0 - n.y;
    float lam = max(dot(n, sun), 0.0) * vSh.x;
    float e = smoothstep(uGMin, uGMax, vH);
    vec3 ground = mix(cLow, cHigh, e) * (0.88 + 0.24 * vn(vL.xz * 7.0));
    vec3 rock = cRock * (0.75 + 0.4 * vn(vL.xz * 13.0 + 4.0)) * (0.9 + 0.1 * sin(vH * 26.0 + vn(vL.xz * 3.0) * 4.0));
    vec3 alb = mix(ground, rock, smoothstep(0.22, 0.46, slope));
    // snow holds on gentler ground and in hollows, breaks up on crests and cliffs
    float edge = (vn(vL.xz * 3.2) - 0.5) * 0.8 + (vn(vL.xz * 14.0) - 0.5) * 0.25;
    float sn = smoothstep(uSnowline - 0.15, uSnowline + 0.15, vH + edge) * (1.0 - smoothstep(0.38, 0.6, slope + (1.0 - vSh.y) * -0.3));
    alb = mix(alb, cSnow, sn);
    float sky = (0.30 + 0.24 * n.y) * vSh.y;
    vec3 col = alb * (sky + 1.1 * lam);
    col += sn * vec3(0.05, 0.10, 0.22) * (1.0 - lam) * vSh.y;            // cool skylight in snow shadow
    vec3 V = normalize(cameraPosition - vW);
    col += sn * pow(max(dot(reflect(-sun, n), V), 0.0), 28.0) * 0.25 * vSh.x; // icy sheen
    float k = vH * 5.0, cd = min(fract(k), 1.0 - fract(k));
    float cl = 1.0 - smoothstep(0.0, fwidth(k) * 1.3, cd);
    float idx = 1.0 - smoothstep(0.0, fwidth(vH) * 1.5, min(fract(vH), 1.0 - fract(vH)));
    col = mix(col, cCont, clamp(cl * 0.45 + idx * 0.8, 0.0, 1.0) * uContour * (1.0 - sn * 0.7));
    float f = clamp(field(vL, n, vH), 0.0, 1.0);
    vec3 rp = ramp3(cP1, cP2, cP3, f);
    float m = smoothstep(0.08, 0.5, f);
    col = mix(col, rp * (0.65 + 0.5 * lam), m * 0.75) + rp * m * 0.12;
    col += cScan * exp(-pow((vL.x - uScan) * 2.4, 2.0)) * 0.6;
    col = mix(col, col * vec3(0.92, 1.0, 1.12), uAnalysed * step(vL.x, uScan) * 0.5);
    col = mix(col, uBg, smoothstep(20.0, 40.0, length(cameraPosition - vW)) * 0.5);
    gl_FragColor = vec4(col, 1.0);
  }`;

const SKIRT_FS = /* glsl */`
  uniform vec3 cEdge; varying vec3 vL;
  void main() {
    float k = (vL.y - ${BASE.toFixed(2)}) * 3.5, d = min(fract(k), 1.0 - fract(k));
    float strata = 1.0 - smoothstep(0.0, fwidth(k) * 1.3, d);
    vec3 col = vec3(0.03, 0.07, 0.16) + cEdge * (strata * 0.26 + smoothstep(${BASE.toFixed(2)}, 3.0, vL.y) * 0.2);
    gl_FragColor = vec4(col, 0.62 + strata * 0.25);
  }`;

const LAYER_FS = /* glsl */`
  uniform float uA, uTime, uType, uSize; uniform vec3 cA, cB; varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float e = smoothstep(0.0, 0.05, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    vec3 col; float a;
    if (uType < 0.5) {            // isolines
      float f = sin(p.x * 0.55 + 0.4) * 0.9 + cos(p.y * 0.45 - 0.3) * 0.8 + p.y * 0.15;
      float k = f * 2.5, d = min(fract(k), 1.0 - fract(k));
      col = mix(cA, cB, f * 0.3 + 0.5); a = 0.08 + (1.0 - smoothstep(0.0, fwidth(k) * 1.5, d)) * 0.65;
    } else if (uType < 1.5) {     // density field on a fine lattice
      float f = smoothstep(0.15, 1.0, 0.5 + 0.5 * sin(p.x * 0.7 + 1.0) * cos(p.y * 0.6 - 0.5));
      float g = 1.0 - smoothstep(0.0, 0.08, min(fract(p.x * 1.5), fract(p.y * 1.5)));
      col = mix(cA, cB, f); a = f * 0.42 + g * f * 0.25;
    } else if (uType < 2.5) {     // streaklines moving downstream
      vec2 q = vec2(p.x * 0.95 + p.y * 0.3, p.y - p.x * 0.3);
      float k = q.y * 3.0 + sin(q.x * 0.6) * 0.3, d = min(fract(k), 1.0 - fract(k));
      col = cA; a = (1.0 - smoothstep(0.0, fwidth(k) * 1.5, d)) * (0.25 + 0.75 * fract(q.x * 0.22 - uTime * 0.3)) * 0.7;
    } else {                      // zoned cells (hazard / class map)
      vec2 c = floor(p * 0.9 + 0.5 * sin(p.yx * 0.4));
      float v = fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 f = fract(p * 0.9 + 0.5 * sin(p.yx * 0.4));
      float edge = 1.0 - smoothstep(0.0, 0.05, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
      col = mix(cA, cB, v); a = smoothstep(0.35, 0.9, v) * 0.45 + edge * 0.35;
    }
    gl_FragColor = vec4(col, a * uA * e);
  }`;

const WATER_FS = /* glsl */`
  uniform float uTime, uA; uniform vec2 uFlow; uniform vec3 cDeep, cShallow, uSun;
  varying vec3 vW;
  ${NOISE}
  void main() {
    vec2 q = vW.xz * 2.2 - uFlow * uTime;
    float e = 0.06, h0 = vn(q) + 0.5 * vn(q * 2.3 + 3.0);
    float hx = vn(q + vec2(e, 0.0)) + 0.5 * vn((q + vec2(e, 0.0)) * 2.3 + 3.0);
    float hz = vn(q + vec2(0.0, e)) + 0.5 * vn((q + vec2(0.0, e)) * 2.3 + 3.0);
    vec3 nrm = normalize(vec3((h0 - hx) * 0.9, 1.0, (h0 - hz) * 0.9));
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1.0 - max(dot(V, nrm), 0.0), 3.0);
    vec3 col = mix(cDeep, cShallow, 0.3 + 0.7 * fres);
    col += pow(max(dot(reflect(-normalize(uSun), nrm), V), 0.0), 70.0) * 0.7;
    gl_FragColor = vec4(col, (0.66 + 0.28 * fres) * uA);
  }`;

const BOX_VS = /* glsl */`
  uniform float uGrow, uRise; attribute float aV; attribute float aD;
  varying float vV; varying float vTop; varying vec3 vN; varying float vBase;
  void main() {
    float g = clamp((uGrow - aD) * 3.0, 0.0, 1.0); g = g * g * (3.0 - 2.0 * g);
    vec3 p = position; p.y *= max(g, 0.002);
    mat4 m = modelMatrix * instanceMatrix;
    vec4 base = m * vec4(0.0, 0.0, 0.0, 1.0);
    vec4 w = m * vec4(p, 1.0); w.y += base.y * (uRise - 1.0);
    vBase = base.y; vV = aV; vTop = position.y; vN = normalize(mat3(m) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const BOX_FS = /* glsl */`
  uniform float uLevel, uExpose, uColorBy, uA; uniform vec3 cBase, cP1, cP2, cP3, uSun;
  varying float vV; varying float vTop; varying vec3 vN; varying float vBase;
  ${NOISE}
  void main() {
    vec3 n = normalize(vN);
    float lam = max(dot(n, normalize(uSun)), 0.0);
    vec3 c = mix(cBase, ramp3(cP1, cP2, cP3, vV), uColorBy);
    float wet = step(vBase, uLevel) * uExpose;
    c = mix(c, cP3, wet * 0.85);
    vec3 col = c * (0.42 + 0.8 * lam) + c * smoothstep(0.92, 1.0, vTop) * 0.3 * max(n.y, 0.0) + cP3 * wet * 0.2;
    gl_FragColor = vec4(col, uA);
  }`;

export class Kit {
  constructor(canvas, { w, h, ratio = 1, labelsEl = null }) {
    this.w = w; this.h = h; this.labelsEl = labelsEl;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 200);
    this.block = new THREE.Group();
    this.scene.add(this.block);
    this.U = { uTime: { value: 0 }, uRise: { value: 1 } };
    this.sun = new THREE.Vector3(-0.72, 0.5, 0.42).normalize();
    this.bg = new THREE.Color('#060c1c');
    this.cam = { r: 23, el: 0.58, az: 0.82, look: [0.2, 0.5, 0], drift: 0.2, entry: 8 };
    this.pointer = [0, 0];
    this.labels = [];
    this._v = new THREE.Vector3();
  }

  _shader(o) { return new THREE.ShaderMaterial(o); }
  color(c) { return new THREE.Color(c); }

  /** Terrain specimen block. `field` is GLSL `float field(vec3 L, vec3 n, float h)` (0..1),
   *  drawn through the ramp; `decl` declares any extra uniforms it reads (passed in `uniforms`). */
  terrain(g, o = {}) {
    this.g = g;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, g.seg, g.seg).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, g.H[k]);
    geo.computeVertexNormals();
    geo.setAttribute('sh', new THREE.BufferAttribute(bake(g, this.sun), 2));
    const C = (c) => ({ value: this.color(c) });
    const [r1, r2, r3] = o.ramp || ['#6d4dff', '#e04fd6', '#ffb547'];
    const u = {
      uTime: this.U.uTime, uRise: this.U.uRise, uSun: { value: this.sun }, uBg: { value: this.bg },
      uSnowline: { value: o.snowline ?? 99 }, uField: { value: 0 }, uScan: { value: -99 }, uAnalysed: { value: 0 },
      uContour: { value: o.contour ?? 0.35 }, uGMin: { value: g.min }, uGMax: { value: g.max },
      cLow: C(o.low || '#24302f'), cHigh: C(o.high || '#3c4452'), cRock: C(o.rock || '#555c69'), cSnow: C('#f1f6ff'),
      cCont: C(o.contourColor || '#5fe0ff'), cP1: C(r1), cP2: C(r2), cP3: C(r3), cScan: C(o.scan || '#5fe0ff'),
      ...(o.uniforms || {}),
    };
    this.block.add(new THREE.Mesh(geo, this._shader({
      uniforms: u, vertexShader: TERRAIN_VS,
      fragmentShader: terrainFS(o.field || 'float field(vec3 L, vec3 n, float h) { return 0.0; }', o.decl || ''),
    })));

    // cut-away walls with strata, base frame, and a faint light pool beneath
    const verts = [], ix = [], s = g.seg;
    const sides = [(t) => [t, HALF], (t) => [HALF, -t], (t) => [-t, -HALF], (t) => [-HALF, t]];
    for (const side of sides) {
      const b = verts.length / 3;
      for (let i = 0; i <= s; i++) { const [x, z] = side(-HALF + (SIZE * i) / s); verts.push(x, g.at(x, z), z, x, BASE, z); }
      for (let i = 0; i < s; i++) { const a = b + i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const sk = new THREE.BufferGeometry();
    sk.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    sk.setIndex(ix);
    this.block.add(new THREE.Mesh(sk, this._shader({
      uniforms: { uRise: this.U.uRise, cEdge: C(o.edge || '#4cc9ff') },
      vertexShader: `uniform float uRise; varying vec3 vL; void main(){ vec3 p = position; if (p.y > ${BASE + 0.01}) p.y *= uRise; vL = p; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: SKIRT_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    })));
    this.block.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(SIZE, 0.001, SIZE)).translate(0, BASE, 0),
      new THREE.LineBasicMaterial({ color: o.edge || '#4cc9ff', transparent: true, opacity: 0.5 })));
    this.block.add(new THREE.Mesh(new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2).translate(0, BASE - 0.02, 0), this._shader({
      transparent: true, depthWrite: false, uniforms: { c: C(o.pool || '#3f73ff') }, vertexShader: UV_VS,
      fragmentShader: 'uniform vec3 c; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(c, (1.0 - smoothstep(0.15, 0.75, r)) * 0.16); }',
    })));
    return u;
  }

  /** Water surface at uLevel (optionally only a local rectangle, e.g. a lake), with side walls
   *  wherever the water stands above the block's edge so the cut-away stays honest. */
  water(o = {}) {
    const [w, d] = o.size || [SIZE - 0.01, SIZE - 0.01], [cx, cz] = o.center || [0, 0];
    const u = {
      uTime: this.U.uTime, uA: { value: o.alpha ?? 1 }, uLevel: { value: o.level ?? 0 }, uFlow: { value: new THREE.Vector2(...(o.flow || [0.15, 0.05])) },
      cDeep: { value: this.color(o.deep || '#0b2a5c') }, cShallow: { value: this.color(o.shallow || '#4fb8ff') }, uSun: { value: this.sun },
    };
    const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, 0, cz);
    const VS = 'uniform float uLevel; varying vec3 vW; void main(){ vec3 p = position; p.y = uLevel; vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
    const mat = this._shader({ uniforms: u, vertexShader: VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false });
    this.block.add(new THREE.Mesh(geo, mat));
    if (!o.size && this.g) { // side walls of the water body
      const verts = [], top = [], ix = [], s = 120;
      const sides = [(t) => [t, HALF], (t) => [HALF, -t], (t) => [-t, -HALF], (t) => [-HALF, t]];
      for (const side of sides) {
        const b = verts.length / 3;
        for (let i = 0; i <= s; i++) { const [x, z] = side(-HALF + (SIZE * i) / s), y = this.g.at(x, z); verts.push(x, y, z, x, y, z); top.push(1, 0); }
        for (let i = 0; i < s; i++) { const a = b + i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      wg.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
      wg.setIndex(ix);
      this.block.add(new THREE.Mesh(wg, this._shader({
        uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: 'uniform float uLevel; attribute float aTop; varying float vT; void main(){ vec3 p = position; if (aTop > 0.5) p.y = max(uLevel, p.y); vT = aTop; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'uniform float uA; uniform vec3 cDeep, cShallow; varying float vT; void main(){ gl_FragColor = vec4(mix(cDeep, cShallow, vT * 0.5), 0.55 * uA); }',
      })));
    }
    return u;
  }

  /** Instanced boxes/columns standing on the terrain: buildings, data columns, grid cells.
   *  items: {x, z, w, d, h, v (0..1 colour), delay (0..1 grow order)}. */
  boxes(items, o = {}) {
    const geo = (o.round ? new THREE.CylinderGeometry(0.5, 0.5, 1, 28) : new THREE.BoxGeometry(1, 1, 1)).translate(0, 0.5, 0);
    const aV = new Float32Array(items.length), aD = new Float32Array(items.length);
    const [p1, p2, p3] = o.ramp || ['#6d4dff', '#e04fd6', '#ffb547'];
    const u = {
      uGrow: { value: 0 }, uRise: this.U.uRise, uLevel: { value: -99 }, uExpose: { value: 0 }, uColorBy: { value: o.colorBy ? 1 : 0 },
      uA: { value: o.alpha ?? 1 }, cBase: { value: this.color(o.base || '#9fb2cf') }, uSun: { value: this.sun },
      cP1: { value: this.color(p1) }, cP2: { value: this.color(p2) }, cP3: { value: this.color(p3) },
    };
    const mesh = new THREE.InstancedMesh(geo, this._shader({
      uniforms: u, vertexShader: BOX_VS, fragmentShader: BOX_FS, transparent: (o.alpha ?? 1) < 1, depthWrite: (o.alpha ?? 1) >= 1,
    }), items.length);
    const m = new THREE.Matrix4();
    const place = (list) => list.forEach((b, i) => {
      m.makeScale(b.w, Math.max(0.001, b.h), b.d ?? b.w);
      m.setPosition(b.x, b.y ?? (this.g ? this.g.at(b.x, b.z) - 0.02 : 0), b.z);
      mesh.setMatrixAt(i, m);
      aV[i] = b.v ?? 0; aD[i] = b.delay ?? 0;
    });
    place(items);
    geo.setAttribute('aV', new THREE.InstancedBufferAttribute(aV, 1));
    geo.setAttribute('aD', new THREE.InstancedBufferAttribute(aD, 1));
    this.block.add(mesh);
    return Object.assign(u, {
      // re-shape every instance (e.g. morph between data sets) — cheap for a few hundred
      set(list) { place(list); mesh.instanceMatrix.needsUpdate = true; geo.attributes.aV.needsUpdate = true; },
    });
  }

  /** Polylines on/over the terrain, revealed along their length, optionally with flowing dashes. */
  paths(lines, o = {}) {
    const verts = [], along = [];
    for (const pts of lines) for (let i = 0; i < pts.length - 1; i++) { verts.push(...pts[i], ...pts[i + 1]); along.push(i / pts.length, (i + 1) / pts.length); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    const u = { uReveal: { value: 0 }, uTime: this.U.uTime, uRise: this.U.uRise, uA: { value: o.alpha ?? 0.95 }, c: { value: this.color(o.color || '#ffb547') }, uDash: { value: o.dash === false ? 0 : 1 } };
    this.block.add(new THREE.LineSegments(geo, this._shader({
      uniforms: u, transparent: true, depthWrite: false,
      vertexShader: 'uniform float uRise; attribute float along; varying float vA; void main(){ vA = along; vec3 p = position; p.y *= uRise; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float uReveal, uTime, uA, uDash; uniform vec3 c; varying float vA; void main(){ float shown = step(vA, uReveal * 1.25 - 0.25); float dash = mix(1.0, 0.45 + 0.55 * step(0.5, fract(vA * 26.0 - uTime * 0.9)), uDash); gl_FragColor = vec4(c, shown * dash * uA); }',
    })));
    return u;
  }

  /** Steepest-descent line from (x, z): avalanche runout, outburst floods, drainage. */
  descend(x, z, step = 0.04, max = 260) {
    const pts = [], g = this.g;
    for (let i = 0; i < max; i++) {
      pts.push([x, g.at(x, z) + 0.03, z]);
      const [dx, dz] = g.grad(x, z), m = Math.hypot(dx, dz);
      if (m < 0.04 || Math.abs(x) > HALF - 0.1 || Math.abs(z) > HALF - 0.1) break;
      x -= (dx / m) * step; z -= (dz / m) * step;
    }
    return pts;
  }

  /** A translucent data layer hovering above the block (labelled). */
  layer(o) {
    const size = o.size || 6.4;
    const u = { uA: { value: 0 }, uTime: this.U.uTime, uType: { value: o.type }, uSize: { value: size }, cA: { value: this.color(o.a) }, cB: { value: this.color(o.b || o.a) } };
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), this._shader({
      uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: UV_VS, fragmentShader: LAYER_FS,
    })));
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2)),
      new THREE.LineBasicMaterial({ color: o.b || o.a, transparent: true, opacity: 0 }));
    g.add(outline);
    g.position.set(o.x || 0, o.y, o.z || 0);
    this.block.add(g);
    if (o.label) this.label(o.label, g, new THREE.Vector3(size / 2, 0, -size / 2), () => u.uA.value);
    return { g, u, set(a) { u.uA.value = a; outline.material.opacity = 0.5 * a; } };
  }

  /** Vertical sheet of light swept across x (an analysis pass). */
  sweep(o = {}) {
    const u = { uA: { value: 0 }, c: { value: this.color(o.color || '#5fe0ff') } };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE + 0.4, o.height || 6).rotateY(Math.PI / 2).translate(0, (o.height || 6) / 2 - 0.9, 0), this._shader({
      uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, vertexShader: UV_VS,
      fragmentShader: 'uniform float uA; uniform vec3 c; varying vec2 vUv; void main(){ gl_FragColor = vec4(c, uA * (1.0 - vUv.y) * 0.35 * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x)); }',
    }));
    this.block.add(mesh);
    return { set: (x, a) => { mesh.position.x = x; u.uA.value = a; } };
  }

  /** Sensor / gauge masts with a precise head and slow propagation rings on the ground. */
  pins(list, o = {}) {
    const col = o.color || '#5fe0ff', g = this.g;
    const mv = [];
    list.forEach((p) => { const y = g.at(p.x, p.z); p.y = y; mv.push(p.x, y, p.z, p.x, y + (p.h ?? 0.8), p.z); });
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mv, 3));
    const mastMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0 });
    this.block.add(new THREE.LineSegments(mg, mastMat));
    const heads = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.075), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }), list.length);
    const m = new THREE.Matrix4();
    list.forEach((p, i) => { m.makeTranslation(p.x, p.y + (p.h ?? 0.8), p.z); heads.setMatrixAt(i, m); });
    this.block.add(heads);
    const rings = list.map((p) => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false }));
      r.position.set(p.x, p.y + 0.04, p.z);
      this.block.add(r);
      return r;
    });
    return {
      set: (a, t, signal = 0) => {
        mastMat.opacity = 0.75 * a; heads.material.opacity = a;
        rings.forEach((r, i) => { const ph = (t * 0.32 + i * 0.173) % 1; r.scale.setScalar(0.15 + ph * (o.reach || 1.4)); r.material.opacity = signal * a * (1 - ph) * 0.7; });
      },
    };
  }

  /** A translucent value surface hovering over the terrain (temperature, projected change...). */
  surface(fn, o = {}) {
    const seg = o.seg || 120, size = o.size || SIZE;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const p = geo.attributes.position, val = new Float32Array(p.count);
    for (let k = 0; k < p.count; k++) val[k] = clamp01(fn(p.getX(k), p.getZ(k)));
    geo.setAttribute('aV', new THREE.BufferAttribute(val, 1));
    const [r1, r2, r3] = o.ramp || ['#3b82ff', '#ffb547', '#ff5a4f'];
    const u = { uA: { value: 0 }, uGrow: { value: 0 }, uY: { value: o.y ?? 2 }, uAmp: { value: o.amp ?? 1.2 }, uTime: this.U.uTime, cP1: { value: this.color(r1) }, cP2: { value: this.color(r2) }, cP3: { value: this.color(r3) } };
    this.block.add(new THREE.Mesh(geo, this._shader({
      uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'uniform float uY, uAmp, uGrow; attribute float aV; varying float vV; void main(){ vV = aV; vec3 p = position; p.y = uY + aV * uAmp * uGrow; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: `uniform float uA; uniform vec3 cP1, cP2, cP3; varying float vV; ${NOISE}
        void main(){ float k = vV * 10.0, d = min(fract(k), 1.0 - fract(k)); float l = 1.0 - smoothstep(0.0, fwidth(k) * 1.4, d);
          gl_FragColor = vec4(ramp3(cP1, cP2, cP3, vV) * (0.8 + l * 0.6), uA * (0.06 + 0.2 * vV * vV + l * 0.5)); }`,
    })));
    return u;
  }

  /** Sparse moving tracers (wind, rain): spawn(i) → [x,y,z]; step(p, dt, t) mutates p. */
  tracers(n, o) {
    const pts = Array.from({ length: n }, (_, i) => o.spawn(i));
    const arr = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color: o.color || '#8fe9ff', size: o.size || 2.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
    this.block.add(new THREE.Points(geo, mat));
    return {
      set: (a, t, dt) => {
        mat.opacity = a;
        pts.forEach((p, i) => { if (dt) o.step(p, dt, t, i); arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2]; });
        geo.attributes.position.needsUpdate = true;
      },
    };
  }

  label(text, obj, local, opacity) {
    if (!this.labelsEl) return;
    const el = document.createElement('span');
    el.textContent = text;
    this.labelsEl.append(el);
    this.labels.push({ el, obj, local, opacity });
  }

  /** Slow, deliberate camera: dolly-in on entry, gentle drift, small pointer parallax. */
  frame(t, since, still) {
    const c = this.cam, [px, py] = this.pointer;
    const az = c.az + (still ? 0 : c.drift * Math.sin(t * 0.045)) + px * 0.12;
    const el = c.el - py * 0.06, r = c.r + c.entry * (1 - ease(since / 3.2));
    this.camera.position.set(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r);
    this.camera.lookAt(...c.look);
    this.scene.updateMatrixWorld();
    for (const L of this.labels) {
      const v = this._v.copy(L.local).applyMatrix4(L.obj.matrixWorld).project(this.camera);
      L.el.style.transform = `translate(${((v.x + 1) / 2) * this.w}px, ${((1 - v.y) / 2) * this.h}px)`;
      L.el.style.opacity = L.opacity();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.labels.forEach((L) => L.el.remove());
  }
}

const load = (kind) => import(`./heroes/${kind}.js`);

/** Mount a hero into `host` (needs a <canvas>, optionally .hero-labels and [data-stage] items).
 *  mode 'story' plays the stages from the start; 'ambient' shows the settled scene, drifting. */
export async function mountHero(host, kind, { mode = 'story', variant, onStage } = {}) {
  const mod = await load(kind);
  if (!host.isConnected) return () => {};
  const canvas = host.querySelector('canvas');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const ratio = Math.min(1.75, (canvas.getBoundingClientRect().width / w) * devicePixelRatio) || 1;
  const kit = new Kit(canvas, { w, h, ratio, labelsEl: host.querySelector('.hero-labels') });
  kit.seg = w < 900 ? 150 : 240; // smaller frames (cards) don't need the full-resolution mesh
  const hero = mod.build(kit, { variant, mode });
  if (w < 900) kit.cam.r *= 1.12; // small frames: step back so the whole block fits
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STAGES = mod.STAGES || [0], SETTLED = mod.SETTLED || 0;
  let t0 = performance.now(), last = t0, raf = 0, stage = -1;
  const onMove = (e) => { const b = host.getBoundingClientRect(); kit.pointer = [(e.clientX - b.left) / b.width - 0.5, (e.clientY - b.top) / b.height - 0.5]; };
  const onClick = (e) => { const li = e.target.closest('[data-stage]'); if (li) t0 = performance.now() - STAGES[+li.dataset.stage] * 1000; };
  host.addEventListener('pointermove', onMove);
  host.addEventListener('click', onClick);
  const loop = (now) => {
    const since = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = reduce ? SETTLED + 4 : mode === 'ambient' ? SETTLED + since : since;
    kit.U.uTime.value = t;
    hero.update(t, reduce ? 0 : dt);
    kit.frame(t, mode === 'ambient' ? 99 : since, reduce);
    const s = STAGES.filter((x) => t >= x).length - 1;
    if (s !== stage) { stage = s; onStage?.(s); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    host.removeEventListener('pointermove', onMove);
    host.removeEventListener('click', onClick);
    kit.dispose();
  };
}

/** Still image of a hero's settled state (portal thumbnails). One short-lived context at a time. */
const shots = new Map();
let queue = Promise.resolve();
export function snapshot(kind, variant, w, h) {
  const key = `${kind}:${variant || ''}:${w}x${h}`;
  if (!shots.has(key)) {
    shots.set(key, queue = queue.then(async () => {
      const mod = await load(kind);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const kit = new Kit(canvas, { w, h, ratio: 1 });
      kit.seg = 150;
      const hero = mod.build(kit, { variant, mode: 'ambient' });
      kit.cam.r *= 1.14;
      const t = (mod.SETTLED || 0) + 3;
      kit.U.uTime.value = t;
      hero.update(t, 0);
      kit.frame(t, 99, true);
      const url = canvas.toDataURL('image/jpeg', 0.86);
      kit.dispose();
      await new Promise((r) => setTimeout(r, 0)); // let the page breathe between thumbnails
      return url;
    }));
  }
  return shots.get(key);
}
