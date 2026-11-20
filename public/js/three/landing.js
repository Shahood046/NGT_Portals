// Landing screen (the three wings) — an exhibition of three technological worlds, WebGL + GSAP.
//  • Backdrop: a vast Earth rising behind a Himalayan horizon (NASA Blue Marble–derived texture,
//    three.js r160 examples), a dark reflective floor with faint topographic contours, sparse dust.
//  • One visualisation per wing, chosen by config.wings[].holo:
//      city    — a miniature digital-twin city on terrain, under a holographic globe
//      core    — a computational core over a flowing data surface, ringed by six analytic panels
//      sensing — real terrain with a river, sensor masts and a satellite scanning the ground
// Techniques ported from Spatial HUD (https://github.com/nitishhansa1/spatial-hud, MIT, © Nitish):
//   fresnel holographic shading and additive glass/glow layering, rewritten for plain three.js.
import * as THREE from '../../vendor/three.module.js';
import { ridgedMF, fbm, hash } from './kit.js';

const FACE_ASIA = -3.05; // globe yaw that brings ~70°E toward the camera (three.js sphere UV seam at 180°)
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// maxRatio caps pixels drawn: the soft full-screen backdrop needs far fewer than the sharp card visuals.
function renderer(canvas, maxRatio = 1.5) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const ratio = Math.min(maxRatio, (canvas.getBoundingClientRect().width / w) * devicePixelRatio) || 1;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(ratio);
  r.setSize(w, h, false);
  return { r, w, h };
}
const additive = (o) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o });
const UV_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRES_VS = 'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }';
const NOISE = `float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y); }
  float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }`;

function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    [].concat(o.material || []).forEach((m) => {
      Object.values(m).forEach((v) => v?.isTexture && v.dispose());
      Object.values(m.uniforms || {}).forEach((u) => u.value?.isTexture && u.value.dispose());
      m.dispose();
    });
  });
}

// ── Backdrop: "The Architectural Horizon Vault" ──────────────────────────────
// A reactive exhibition sanctuary: cosmic starfield, fluid volumetric aurora sky curtain,
// sunlit Earth limb, backlit Himalayan ridge, mirror-obsidian architectural grid floor with
// live spotlight pools & sweeping radar pulses, vertical cathedral light curtains, and
// color-shifting depth motes. Smoothly transforms its entire atmosphere for the hovered or
// selected pillar (Digital World cyan, AI & ML violet/magenta, Smart Sensing emerald/teal).
const BD_THEMES = {
  all: { a: '#8b5cff', b: '#3b9bff', c: '#2fe0b4', mode: 0, spotX: 0.0,  beams: [1, 1, 1] },
  ai:  { a: '#b064ff', b: '#e04fd6', c: '#4a7dff', mode: 1, spotX: -9.5, beams: [1.5, 0, 0] },
  dw:  { a: '#3fd4ff', b: '#2b6dff', c: '#7c66ff', mode: 1, spotX: -9.5, beams: [0, 1.5, 0] },
  ss:  { a: '#2fe0b4', b: '#24c8e0', c: '#ffb547', mode: 1, spotX:  9.5, beams: [0, 0, 1.5] },
};

function backdrop(canvas) {
  const { r, w, h } = renderer(canvas, 1.25);
  const scene = new THREE.Scene();
  const portrait = h > w;
  const cam = new THREE.PerspectiveCamera(portrait ? 58 : 40, w / h, 0.1, 600);
  cam.position.set(0, 1.4, 16); cam.lookAt(0, 3.2, -10); cam.updateMatrixWorld();
  const sun = new THREE.Vector3(-0.55, 0.6, 0.35).normalize();
  const at = (nx, ny, d) => new THREE.Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(d).add(cam.position);
  const span = (f, d) => d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * f;

  // Shared reactive theme uniforms
  const uTime = { value: 0 };
  const uMode = { value: 0 }; // 0 = three-pillar tri-spectrum overview, 1 = focused single-pillar sanctuary
  const uSpotX = { value: 0 };
  const uHover = { value: new THREE.Vector3(0, 0, 0) };
  const uA = { value: new THREE.Color(BD_THEMES.all.a) };
  const uB = { value: new THREE.Color(BD_THEMES.all.b) };
  const uC = { value: new THREE.Color(BD_THEMES.all.c) };
  const cDW = new THREE.Color('#a35cff'), cAI = new THREE.Color('#3b9bff'), cSS = new THREE.Color('#2fe0b4'); // left (AI), mid (DW), right (SS)

  // 1. Deep space starfield dome
  const N_STARS = 750;
  const sPos = new Float32Array(N_STARS * 3), sCol = new Float32Array(N_STARS * 3), tmpC = new THREE.Color();
  for (let i = 0; i < N_STARS; i++) {
    const theta = (hash(i, 1) - 0.5) * 2.4;
    const elev = hash(i, 2) * 0.65 + 0.04;
    const rad = 240 + hash(i, 3) * 140;
    sPos[i * 3] = Math.sin(theta) * rad;
    sPos[i * 3 + 1] = Math.sin(elev) * rad - 4;
    sPos[i * 3 + 2] = -Math.cos(theta) * rad;
    tmpC.setHSL(0.56 + hash(i, 4) * 0.16, 0.42, 0.72 + hash(i, 5) * 0.28);
    sCol.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.75, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.65, depthWrite: false })));

  // 2. Vast sunlit Earth rising behind the horizon (continuity from Vision State 5)
  const D = 215;
  const earth = new THREE.Group();
  earth.position.copy(portrait ? at(0.45, 0.55, D) : at(0.76, -0.96, D));
  const R = span(portrait ? 0.55 : 1.72, D);
  const tex = new THREE.TextureLoader().load('vendor/earth_atmos_2048.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uSun: { value: sun }, cA: uA, uMode },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform vec3 uSun, cA; uniform float uMode;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
        float lam = max(dot(n, uSun), 0.0);
        vec3 tx = texture2D(map, vUv).rgb;
        vec3 col = mix(vec3(dot(tx, vec3(0.3, 0.5, 0.2))), tx, 0.42) * (0.025 + 0.36 * lam) * vec3(0.5, 0.74, 1.15) + vec3(0.0, 0.01, 0.036);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 2.8);
        vec3 rim = mix(vec3(0.28, 0.68, 1.0), cA, 0.35 + 0.45 * uMode);
        col = mix(col, rim, fres * (0.55 + 0.55 * lam));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  globe.rotation.z = 0.3;
  earth.add(globe);
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.038, 96, 64), additive({
    side: THREE.BackSide, uniforms: { uSun: { value: sun }, cA: uA, uMode },
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uSun, cA; uniform float uMode; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float i = pow(max(0.0, 0.62 + dot(normalize(vN), V)), 4.6); float lit = 0.45 + 0.55 * max(dot(-normalize(vN), uSun) + 0.3, 0.0); vec3 rim = mix(vec3(0.3, 0.66, 1.0), cA, 0.4 + 0.45 * uMode); gl_FragColor = vec4(rim, i * 1.15 * lit); }',
  })));
  scene.add(earth);

  // 3. Fluid Volumetric Aurora Sky Curtain (tri-pillar spectrum in overview → signature world when selected!)
  const aurGeo = new THREE.PlaneGeometry(250, 74, 72, 20);
  const ap = aurGeo.attributes.position;
  for (let i = 0; i < ap.count; i++) {
    const x = ap.getX(i);
    ap.setZ(i, -(x * x) * 0.0022); // gentle concave amphitheater curve
  }
  const aurora = new THREE.Mesh(aurGeo, additive({
    side: THREE.DoubleSide,
    uniforms: { uTime, uMode, uHover, cA: uA, cB: uB, cC: uC, cDW: { value: cDW }, cAI: { value: cAI }, cSS: { value: cSS } },
    vertexShader: UV_VS,
    fragmentShader: /* glsl */`
      uniform float uTime, uMode; uniform vec3 uHover, cA, cB, cC, cDW, cAI, cSS; varying vec2 vUv; ${NOISE}
      void main() {
        vec2 uv = vUv;
        // Flowing silk-like aurora folds
        float fold1 = fbm2(vec2(uv.x * 3.8 + uTime * 0.045, uv.y * 1.6 - uTime * 0.025));
        float fold2 = fbm2(vec2(uv.x * 7.2 - uTime * 0.06, uv.y * 2.4 + fold1 * 1.4));
        float ribbon = smoothstep(0.32, 0.78, fold1 * 0.55 + fold2 * 0.55);
        float streaks = pow(0.5 + 0.5 * sin(uv.x * 26.0 + fold1 * 9.0 - uTime * 0.35), 2.5);
        // Smooth vertical fade: bright near horizon & mid-sky, soft fade to top & bottom
        float vFade = smoothstep(0.0, 0.24, uv.y) * smoothstep(1.0, 0.22, uv.y);
        float hFade = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x);

        // Overview: three harmonized pillar light zones (Left Cyan, Mid Violet, Right Emerald)
        float wL = exp(-pow((uv.x - 0.22) * 3.6, 2.0)) * (1.0 + uHover.x * 0.75);
        float wM = exp(-pow((uv.x - 0.50) * 3.6, 2.0)) * (1.0 + uHover.y * 0.75);
        float wR = exp(-pow((uv.x - 0.78) * 3.6, 2.0)) * (1.0 + uHover.z * 0.75);
        vec3 triCol = (cDW * wL + cAI * wM + cSS * wR) / max(wL + wM + wR, 0.35);

        // Focused single-pillar mode: sweeps full sanctuary with that pillar's dual-color aurora
        vec3 singleCol = mix(cA, cB, smoothstep(0.25, 0.8, fold2 + uv.x * 0.3));
        singleCol = mix(singleCol, cC, streaks * 0.28);

        vec3 col = mix(triCol, singleCol, uMode);
        float intensity = (0.14 + ribbon * 0.34 + streaks * 0.16) * vFade * hFade;
        float boost = mix(0.65 + (wL + wM + wR) * 0.24, 1.15, uMode);
        gl_FragColor = vec4(col, intensity * boost * 0.58);
      }`,
  }));
  aurora.position.set(0, 26, -112);
  scene.add(aurora);

  // 4. Backlit Himalayan Horizon with Dynamic Pillar-Tinted Rim Glow
  const mg = new THREE.PlaneGeometry(240, 32, 220, 28).rotateX(-Math.PI / 2);
  const mp = mg.attributes.position;
  for (let k = 0; k < mp.count; k++) {
    const x = mp.getX(k), z = mp.getZ(k);
    const band = Math.exp(-((z + 2) ** 2) / 52) * (0.45 + 0.55 * Math.min(1, Math.abs(x) / 40));
    mp.setY(k, (ridgedMF(x * 0.05 + 3, z * 0.09 + 1) * 1.18 + 0.35 * fbm(x * 0.04, z * 0.05)) * 13.5 * band + 0.6 * fbm(x * 0.3, z * 0.3) - 0.5);
  }
  mg.computeVertexNormals();
  const range = new THREE.Mesh(mg, new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sun }, uRise: { value: 1 }, uMode, cA: uA, cB: uB, cDW: { value: cDW }, cAI: { value: cAI }, cSS: { value: cSS } },
    vertexShader: 'uniform float uRise; varying vec3 vN; varying vec3 vW; varying float vH; void main(){ vec3 p = position; p.y *= uRise; vH = position.y; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform vec3 uSun, cA, cB, cDW, cAI, cSS; uniform float uMode;
      varying vec3 vN; varying vec3 vW; varying float vH;
      void main(){
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
        float slope = 1.0 - n.y;
        float lam = max(dot(n, uSun), 0.0);
        float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        float snow = smoothstep(4.2, 7.2, vH + sin(vW.x * 2.1) * 0.4) * (1.0 - smoothstep(0.45, 0.72, slope));

        // Regional tint across the ridge (cyan left, violet mid, emerald right → active pillar when selected)
        float nx = clamp((vW.x + 85.0) / 170.0, 0.0, 1.0);
        vec3 triRim = nx < 0.5 ? mix(cDW, cAI, nx * 2.0) : mix(cAI, cSS, nx * 2.0 - 1.0);
        vec3 accent = mix(triRim, mix(cA, cB, 0.35), uMode);

        vec3 alb = mix(vec3(0.04, 0.065, 0.13), vec3(0.84, 0.93, 1.0), snow);
        vec3 col = alb * (0.09 + 0.78 * lam) + vec3(0.012, 0.028, 0.072);
        // Dramatic colored silhouette backlight along mountain crests
        col += accent * (rim * 0.32 + snow * 0.14);
        float d = length(cameraPosition - vW);
        col = mix(col, vec3(0.02, 0.045, 0.11) + accent * 0.06, smoothstep(62.0, 155.0, d) * 0.85);
        // Glowing atmospheric valley mist right where mountains meet the glossy floor
        col += accent * smoothstep(2.0, -2.8, vW.y) * (0.28 + 0.16 * uMode);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  range.position.set(0, -3, -78);
  scene.add(range);

  // 5. Three Towering Subtle Cathedral Light Curtains Behind the Pillars
  const beamX = [-12.2, 0, 12.2];
  const beamCols = [cDW, cAI, cSS];
  const beamUniforms = beamX.map((x, i) => {
    const u = { uTime, uVis: { value: 1 }, c: { value: beamCols[i].clone() } };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 34).translate(0, 14, 0), additive({
      side: THREE.DoubleSide, uniforms: u, vertexShader: UV_VS,
      fragmentShader: /* glsl */`
        uniform float uTime, uVis; uniform vec3 c; varying vec2 vUv;
        void main() {
          float cx = abs(vUv.x - 0.5) * 2.0;
          float colBeam = exp(-cx * cx * 5.2);
          float vFade = smoothstep(0.0, 0.18, vUv.y) * pow(1.0 - vUv.y, 1.45);
          float shimmer = 0.84 + 0.16 * sin(vUv.x * 16.0 + uTime * 0.65);
          gl_FragColor = vec4(c, colBeam * vFade * shimmer * 0.15 * uVis);
        }`,
    }));
    mesh.position.set(x, -3, -36);
    scene.add(mesh);
    return u;
  });

  // 6. Mirror-Obsidian Architectural Horizon Floor (Grid + Contours + Live Spotlight Pools + Radar Pulse!)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(700, 360).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uTime, uMode, uSpotX, uHover, cA: uA, cB: uB, cDW: { value: cDW }, cAI: { value: cAI }, cSS: { value: cSS } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform float uTime, uMode, uSpotX; uniform vec3 uHover, cA, cB, cDW, cAI, cSS; varying vec3 vW; ${NOISE}
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float graze = pow(1.0 - abs(V.y), 5.5);
        float distCam = length(vW.xz - cameraPosition.xz);
        float nearFade = exp(-distCam * 0.022);

        // Crisp receding architectural perspective grid
        vec2 g1 = abs(fract(vW.xz * 0.25 + 0.5) - 0.5) / fwidth(vW.xz * 0.25);
        float majorGrid = 1.0 - min(min(g1.x, g1.y), 1.0);
        vec2 g2 = abs(fract(vW.xz * 1.0 + 0.5) - 0.5) / fwidth(vW.xz * 1.0);
        float minorGrid = 1.0 - min(min(g2.x, g2.y), 1.0);

        // Flowing topographic floor contours
        float k = fbm2(vW.xz * 0.045 + vec2(0.0, uTime * 0.005)) * 14.0;
        float d = min(fract(k), 1.0 - fract(k));
        float contour = 1.0 - smoothstep(0.0, fwidth(k) * 1.4, d);

        // Live spotlight reflections cast onto the dark mirror floor under each pillar
        float pL = exp(-(pow((vW.x + 9.5) * 0.14, 2.0) + pow((vW.z + 6.0) * 0.11, 2.0))) * (1.0 + uHover.x * 0.85);
        float pM = exp(-(pow((vW.x) * 0.14, 2.0) + pow((vW.z + 6.0) * 0.11, 2.0))) * (1.0 + uHover.y * 0.85);
        float pR = exp(-(pow((vW.x - 9.5) * 0.14, 2.0) + pow((vW.z + 6.0) * 0.11, 2.0))) * (1.0 + uHover.z * 0.85);
        vec3 triPool = cDW * pL + cAI * pM + cSS * pR;

        // Focused single-pillar spotlight + expanding concentric radar energy pulse on the floor
        float dSpot = length(vW.xz - vec2(uSpotX, -4.0));
        float singlePool = exp(-dSpot * dSpot * 0.0085);
        float pulseR = mod(uTime * 8.5, 58.0);
        float radarWave = exp(-pow((dSpot - pulseR) * 0.42, 2.0)) * smoothstep(58.0, 8.0, pulseR);

        // Horizon-sweeping ambient scan line across the exhibition hall
        float scanZ = -mod(uTime * 10.0, 95.0) + 12.0;
        float hScan = exp(-pow((vW.z - scanZ) * 0.25, 2.0)) * nearFade;

        vec3 gridTint = mix(vec3(0.24, 0.56, 1.0), mix(cA, cB, 0.35), uMode);
        vec3 col = vec3(0.009, 0.018, 0.046);
        col += mix(vec3(0.10, 0.26, 0.62), cA * 0.72, uMode) * graze * 0.42;
        col += mix(triPool * 0.24, (cA * singlePool * 0.36 + mix(cA, cB, 0.4) * radarWave * 0.28), uMode);
        col += gridTint * (majorGrid * 0.16 + minorGrid * 0.04 + contour * 0.07) * nearFade;
        col += gridTint * hScan * (0.14 + majorGrid * 0.32);

        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  floor.position.set(0, -3, -150);
  scene.add(floor);

  // 7. Drifting Bioluminescent Depth Motes (color shifts smoothly with active pillar)
  const N = 240, dp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { dp[i * 3] = (hash(i, 1) - 0.5) * 56; dp[i * 3 + 1] = hash(i, 2) * 18 - 3; dp[i * 3 + 2] = -hash(i, 3) * 38 + 6; }
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dustMat = new THREE.PointsMaterial({ color: '#8fd0ff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(dGeo, dustMat));

  const state = { px: 0, py: 0, dolly: 0, shiftX: 0, mode: 0, spotX: 0, h0: 0, h1: 0, h2: 0, b0: 1, b1: 1, b2: 1 };
  const _white = new THREE.Color('#ffffff');
  return {
    earth, range, state, uA, uB, uC,
    frame(t, dt) {
      uTime.value = t;
      uMode.value = state.mode;
      uSpotX.value = state.spotX;
      uHover.value.set(state.h0, state.h1, state.h2);
      beamUniforms[0].uVis.value = state.b0 + state.h0 * 0.8;
      beamUniforms[1].uVis.value = state.b1 + state.h1 * 0.8;
      beamUniforms[2].uVis.value = state.b2 + state.h2 * 0.8;

      globe.rotation.y = FACE_ASIA + t * 0.006;
      dustMat.color.copy(uA.value).lerp(_white, 0.45);
      for (let i = 0; i < N; i++) { dp[i * 3 + 1] += dt * (0.12 + hash(i, 4) * 0.18); if (dp[i * 3 + 1] > 15) dp[i * 3 + 1] = -3; }
      dGeo.attributes.position.needsUpdate = true;

      cam.position.set(state.px * 1.1 + state.shiftX * 2.2, 1.4 - state.py * 0.5 + state.dolly * 0.6, 16 - state.dolly * 7);
      cam.lookAt(state.px * 0.3 + state.shiftX * 0.8, 3.2, -10);
      r.render(scene, cam);
    },
    dispose() { disposeScene(scene); r.dispose(); r.forceContextLoss(); },
  };
}

// ── Shared pieces for the wing visualisations ───────────────────────────────
function lights(scene) {
  scene.add(new THREE.HemisphereLight('#c4dcff', '#0a1224', 1.5));
  const d = new THREE.DirectionalLight('#ffffff', 2.6); d.position.set(-3, 6, 5); scene.add(d);
}

// the round plinth every visual stands on: dark slab, lit rim, soft glow halo
function plinth(color, r = 2.35) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.98, 0.24, 96), new THREE.MeshLambertMaterial({ color: '#0b1630' }));
  slab.position.y = -0.12; g.add(slab);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 8, 192).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color }));
  g.add(rim);
  const halo = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.35, 128).rotateX(-Math.PI / 2), additive({
    uniforms: { c: { value: new THREE.Color(color) }, r0: { value: r } }, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 c; uniform float r0; varying vec3 vP; void main(){ float k = (length(vP.xz) - r0) / 0.35; gl_FragColor = vec4(c, (1.0 - k) * (1.0 - k) * 0.45); }',
  }));
  halo.position.y = -0.005; g.add(halo);
  return g;
}

// Refined high-DPI glassmorphic micro-HUD panel (crisp hairlines, corner brackets, anti-aliased data)
function chart(kind, [a, b, c], seed) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288;
  const g = cv.getContext('2d'), v = (i) => hash(i + seed * 17, seed * 5 + 3);

  // Translucent dark-glass base with subtle top edge sheen (no clunky boxy frame)
  const bg = g.createLinearGradient(0, 0, 0, 288);
  bg.addColorStop(0, 'rgba(10, 18, 42, 0.52)');
  bg.addColorStop(1, 'rgba(5, 10, 26, 0.28)');
  g.fillStyle = bg;
  g.fillRect(6, 6, 500, 276);

  // Subtle top hairline accent + precision corner brackets
  const topLine = g.createLinearGradient(6, 0, 506, 0);
  topLine.addColorStop(0, a); topLine.addColorStop(0.65, b); topLine.addColorStop(1, 'transparent');
  g.strokeStyle = topLine; g.globalAlpha = 0.72; g.lineWidth = 2;
  g.beginPath(); g.moveTo(6, 7); g.lineTo(506, 7); g.stroke();

  g.strokeStyle = a; g.globalAlpha = 0.85; g.lineWidth = 2;
  const br = 18;
  [[6, 6, 1, 1], [506, 6, -1, 1], [6, 282, 1, -1], [506, 282, -1, -1]].forEach(([x, y, dx, dy]) => {
    g.beginPath(); g.moveTo(x + dx * br, y); g.lineTo(x, y); g.lineTo(x, y + dy * br); g.stroke();
  });

  // Micro header telemetry ticks
  g.globalAlpha = 0.55; g.fillStyle = a;
  g.fillRect(26, 26, 54, 4);
  g.globalAlpha = 0.25; g.fillRect(92, 26, 28, 4);
  g.fillStyle = b; g.globalAlpha = 0.7;
  g.beginPath(); g.arc(478, 28, 4, 0, 7); g.fill();

  // Whisper-thin internal grid lines
  g.strokeStyle = a; g.globalAlpha = 0.14; g.lineWidth = 1;
  for (let y = 70; y <= 240; y += 42) { g.beginPath(); g.moveTo(26, y); g.lineTo(486, y); g.stroke(); }

  g.globalAlpha = 1;
  if (kind === 0) {
    // Sleek fine-pitch spectrum analyzer bars
    const bars = 26;
    for (let i = 0; i < bars; i++) {
      const val = 0.18 + 0.72 * Math.sin(i * 0.32 + seed) ** 2 * (0.5 + 0.5 * v(i));
      const hh = val * 168;
      const x = 30 + i * 17.6;
      const gr = g.createLinearGradient(0, 252 - hh, 0, 252);
      gr.addColorStop(0, i % 5 === 0 ? '#ffffff' : b);
      gr.addColorStop(0.45, a);
      gr.addColorStop(1, 'rgba(20, 40, 80, 0.08)');
      g.fillStyle = gr;
      g.fillRect(x, 252 - hh, 7, hh);
    }
  } else if (kind === 1 || kind === 2) {
    // Smooth dual-channel glowing signal curve with soft area gradient
    const drawWave = (col, phase, amp, fillArea) => {
      g.beginPath();
      const pts = [];
      for (let i = 0; i <= 32; i++) {
        const x = 26 + (460 * i) / 32;
        const y = 175 - Math.sin(i * 0.38 + phase) * amp - Math.cos(i * 0.17 + seed) * (amp * 0.55) - (v(i) - 0.5) * 18;
        pts.push([x, y]);
      }
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) * 0.5, my = (pts[i][1] + pts[i + 1][1]) * 0.5;
        g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      g.strokeStyle = col; g.lineWidth = 2.6; g.stroke();
      if (fillArea) {
        g.lineTo(486, 254); g.lineTo(26, 254); g.closePath();
        const ag = g.createLinearGradient(0, 80, 0, 254);
        ag.addColorStop(0, col); ag.addColorStop(1, 'transparent');
        g.globalAlpha = 0.22; g.fillStyle = ag; g.fill(); g.globalAlpha = 1;
      }
    };
    drawWave(a, seed * 1.3, 42, true);
    drawWave(b, seed * 2.1 + 1.5, 28, false);
  } else if (kind === 3) {
    // Precision neural node scatter & delicate connecting vectors
    const pts = Array.from({ length: 18 }, (_, i) => [44 + v(i) * 424, 68 + v(i + 41) * 176]);
    g.strokeStyle = a; g.globalAlpha = 0.28; g.lineWidth = 1.2;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < 125) {
        g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); g.stroke();
      }
    }
    pts.forEach(([x, y], i) => {
      g.globalAlpha = 0.9; g.fillStyle = i % 3 === 0 ? '#ffffff' : i % 2 ? a : c;
      g.beginPath(); g.arc(x, y, i % 4 === 0 ? 4.5 : 3, 0, 7); g.fill();
    });
  } else if (kind === 4) {
    // Crisp high-density dot-matrix probability tensor
    for (let i = 0; i < 16; i++) for (let j = 0; j < 7; j++) {
      const k = 0.5 + 0.5 * Math.sin(i * 0.45 + seed) * Math.cos(j * 0.65 - seed);
      g.globalAlpha = 0.14 + k * 0.78;
      g.fillStyle = k > 0.68 ? b : a;
      g.beginPath(); g.arc(42 + i * 28.5, 68 + j * 28, 3 + k * 4.5, 0, 7); g.fill();
    }
  } else {
    // Concentric precision radial gauge + ticks
    const cx = 256, cy = 158;
    [76, 56, 36].forEach((rad, i) => {
      g.strokeStyle = i === 1 ? b : a; g.globalAlpha = 0.22; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.stroke();
      g.globalAlpha = 0.92; g.lineWidth = i === 0 ? 4.5 : 3;
      const start = -1.57 + i * 0.8, span = 2.6 + v(i + 1) * 2.4;
      g.beginPath(); g.arc(cx, cy, rad, start, start + span); g.stroke();
    });
  }

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const panel = (tex, w = 0.92, h = 0.52) => new THREE.Mesh(
  new THREE.PlaneGeometry(w, h),
  new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
);

// ── Pillar 01: Digital World — Dark-Glass Smart City Digital Twin & Holographic Digital Earth ──
function city(scene, [c1, c2, c3]) {
  lights(scene);
  const root = new THREE.Group(); scene.add(root);
  root.add(plinth(c2));

  const WL = 0.04;
  // Gentle back-rim foothills (kept cleanly behind z < -0.7 so nothing ever blocks the downtown skyline)
  const hf = (x, z) => {
    const r = Math.hypot(x, z);
    const backHills = Math.max(0, -z - 0.65) * THREE.MathUtils.smoothstep(r, 1.15, 2.05) * (0.55 + 0.75 * ridgedMF(x * 0.9 + 5, z * 0.9 + 2, 4));
    const canal = Math.exp(-((z - (0.32 * Math.sin(x * 1.4) + 0.92)) ** 2) / 0.032) * 0.14;
    return 0.08 + backHills * 0.62 + 0.025 * fbm(x * 2.5, z * 2.5) - canal;
  };

  // Sculpted dark-slate architectural terrain disc with glowing urban street grid & waterfront
  const radius = 2.32, seg = 96;
  const tGeo = new THREE.PlaneGeometry(radius * 2, radius * 2, seg, seg).rotateX(-Math.PI / 2);
  const tp = tGeo.attributes.position;
  const aWet = new Float32Array(tp.count);
  for (let k = 0; k < tp.count; k++) {
    let x = tp.getX(k), z = tp.getZ(k);
    const rr = Math.hypot(x, z);
    if (rr > radius) { x *= radius / rr; z *= radius / rr; }
    const edge = THREE.MathUtils.smoothstep(radius - Math.min(rr, radius), 0, radius * 0.12);
    const y0 = hf(x, z);
    const y = Math.max(y0, WL) * edge + 0.002;
    tp.setXYZ(k, x, y, z);
    aWet[k] = y0 <= WL ? 1 : 0;
  }
  tGeo.setAttribute('aWet', new THREE.BufferAttribute(aWet, 1));
  tGeo.computeVertexNormals();

  const u = {
    uTime: { value: 0 }, uBoost: { value: 0 },
    uSun: { value: new THREE.Vector3(-0.5, 0.78, 0.45).normalize() },
    a: { value: new THREE.Color(c1) }, b: { value: new THREE.Color(c2) }, e: { value: new THREE.Color(c3) },
  };
  root.add(new THREE.Mesh(tGeo, new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      attribute float aWet;
      varying vec3 vN; varying vec3 vL; varying float vWet;
      void main() {
        vL = position; vWet = aWet;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uBoost; uniform vec3 uSun, a, b;
      varying vec3 vN; varying vec3 vL; varying float vWet; ${NOISE}
      void main() {
        vec3 n = normalize(vN);
        float lam = max(dot(n, uSun), 0.0);
        float r = length(vL.xz);
        // Sleek dark midnight-slate terrain + foothills (no matte play-dough green/grey!)
        vec3 urbanPad = vec3(0.035, 0.065, 0.13);
        vec3 foothill = vec3(0.08, 0.12, 0.21);
        vec3 alb = mix(urbanPad, foothill, smoothstep(0.12, 0.55, vL.y)) * (0.86 + 0.28 * vnoise(vL.xz * 7.0));
        vec3 col = alb * (0.3 + 0.85 * lam) + vec3(0.008, 0.02, 0.05);

        // Luminous urban waterfront canal
        if (vWet > 0.5) {
          float shimmer = 0.65 + 0.35 * sin(vL.x * 16.0 - uTime * 2.5);
          col = mix(vec3(0.03, 0.18, 0.38), a, 0.38 + 0.32 * shimmer);
        }

        // Crisp glowing cyan architectural street grid + subtle traffic pulses across downtown
        float cityMask = smoothstep(1.65, 1.15, r) * (1.0 - vWet);
        vec2 st = abs(fract(vL.xz * 3.33 + 0.5) - 0.5) / fwidth(vL.xz * 3.33);
        float street = 1.0 - min(min(st.x, st.y), 1.0);
        float pulse = exp(-pow(fract(vL.x * 0.45 - uTime * 0.32) * 5.0 - 0.5, 2.0));
        col += mix(b, a, 0.6) * street * (0.24 + 0.45 * pulse) * cityMask * (0.85 + 0.4 * uBoost);

        // Topographic elevation contours on the back foothills
        float ck = vL.y * 14.0;
        float cd = min(fract(ck), 1.0 - fract(ck));
        float cont = 1.0 - smoothstep(0.0, fwidth(ck) * 1.4, cd);
        col += a * cont * 0.22 * smoothstep(0.14, 0.32, vL.y);

        gl_FragColor = vec4(col, 1.0);
      }`,
  })));

  // Architectural dark-glass digital-twin skyscrapers (custom procedural window & holographic rim shader!)
  const bItems = [];
  for (let x = -1.45; x <= 1.45; x += 0.15) {
    for (let z = -1.35; z <= 1.45; z += 0.15) {
      const r = Math.hypot(x, z), ix = Math.round(x / 0.15), iz = Math.round(z / 0.15);
      if (r > 1.45 || ix % 4 === 0 || iz % 4 === 0 || hf(x, z) < WL + 0.03 || hf(x, z) > 0.24) continue;
      if (Math.hypot(x + 0.05, z - 0.05) < 0.2) continue; // reserve center plaza for spire
      if (hash(ix * 3.1, iz * 1.7) > 0.84) continue;
      const rnd = hash(ix, iz), tall = Math.exp(-(r * r) / 0.52);
      const wB = 0.08 + hash(iz, ix) * 0.042;
      const dB = 0.08 + hash(ix + 7, iz) * 0.042;
      const hB = 0.09 + (0.12 + rnd * rnd * 1.08) * tall + rnd * 0.05;
      bItems.push({ x, z, y: hf(x, z), w: wB, d: dB, h: hB, seed: hash(ix * 5, iz * 3) });
    }
  }
  const bGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const aSeed = new Float32Array(bItems.length);
  const aH = new Float32Array(bItems.length);
  const bMat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      attribute float aSeed; attribute float aH;
      varying vec3 vN; varying vec3 vV; varying vec3 vLoc; varying vec3 vWorld; varying float vSeed; varying float vH;
      void main() {
        vLoc = position; vSeed = aSeed; vH = aH;
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0); vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uBoost; uniform vec3 uSun, a, b;
      varying vec3 vN; varying vec3 vV; varying vec3 vLoc; varying vec3 vWorld; varying float vSeed; varying float vH;
      void main() {
        vec3 n = normalize(vN), V = normalize(vV);
        float lam = max(dot(n, uSun), 0.0);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 2.0);
        float side = 1.0 - abs(n.y);

        // Deep reflective midnight-sapphire architectural glass (not flat white!)
        vec3 glass = mix(vec3(0.06, 0.12, 0.24), vec3(0.18, 0.34, 0.56), 0.25 + 0.55 * lam + fres * 0.45);
        vec3 col = glass;

        // Crisp procedural architectural window floor-bands (warm amber + ice-cyan)
        float fl = floor(vLoc.y * max(4.0, vH * 14.0));
        float bandY = step(0.42, fract(vLoc.y * max(4.0, vH * 14.0)));
        float mullions = step(0.24, fract((vLoc.x + vLoc.z) * 4.5));
        float lit = step(0.48, fract(sin(fl * 43.1 + vSeed * 91.7) * 43758.5));
        vec3 winCol = fract(vSeed * 13.7 + fl * 0.17) > 0.72 ? vec3(1.0, 0.82, 0.5) : mix(a, vec3(0.86, 0.97, 1.0), 0.45);
        col += winCol * side * bandY * mullions * lit * 0.65;

        // Subtle roof edge highlight + upward holographic twin scan wave across the skyline
        float roofRim = smoothstep(0.92, 1.0, vLoc.y);
        float scan = exp(-pow((vWorld.y - mod(uTime * 0.48, 2.2)) * 4.5, 2.0));
        col += a * (roofRim * 0.55 + fres * 0.22 + scan * 0.42) * (0.85 + 0.45 * uBoost);

        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const town = new THREE.InstancedMesh(bGeo, bMat, bItems.length);
  const m = new THREE.Matrix4();
  bItems.forEach((b, i) => {
    m.makeScale(b.w, b.h, b.d);
    m.setPosition(b.x, b.y, b.z);
    town.setMatrixAt(i, m);
    aSeed[i] = b.seed; aH[i] = b.h;
  });
  bGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  bGeo.setAttribute('aH', new THREE.InstancedBufferAttribute(aH, 1));
  root.add(town);

  // Sleek tapered dark-glass architectural landmark spire with glowing observation ring halo
  const spire = new THREE.Group();
  spire.position.set(-0.05, hf(-0.05, 0.05), 0.05);
  const spireMat = new THREE.MeshStandardMaterial({ color: '#1b3052', metalness: 0.78, roughness: 0.25, emissive: '#0c2748' });
  spire.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.068, 1.65, 8).translate(0, 0.825, 0), spireMat));
  // Glowing cyan observation ring + slender antenna needle + soft beacon tip
  const obsRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.014, 12, 48).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  obsRing.position.y = 1.18; spire.add(obsRing);
  spire.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 0.42, 8).translate(0, 1.86, 0), new THREE.MeshBasicMaterial({ color: '#b4ecff' })));
  const spireTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 12, 10),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  spireTip.position.y = 2.08; spire.add(spireTip);
  root.add(spire);

  // Holographic Digital Earth floating behind the skyline (continents, fine graticule, sweeping meridian)
  const tex = new THREE.TextureLoader().load('vendor/earth_atmos_2048.jpg');
  const gu = { map: { value: tex }, a: u.a, b: u.b, uTime: u.uTime, uBoost: u.uBoost };
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1.82, 80, 56), additive({
    uniforms: gu, vertexShader: FRES_VS,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform vec3 a, b; uniform float uTime, uBoost;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        vec3 t = texture2D(map, vUv).rgb;
        float land = smoothstep(0.02, 0.1, (t.r + t.g) * 0.5 - t.b * 0.55);
        vec2 g = abs(fract(vUv * vec2(28.0, 14.0)) - 0.5) / fwidth(vUv * vec2(28.0, 14.0));
        float grid = 1.0 - min(min(g.x, g.y), 1.0);
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.3);
        float scan = exp(-pow(fract(vUv.x - uTime * 0.08) * 6.0 - 0.5, 2.0));
        vec3 col = mix(b, a, land * 0.75 + fres * 0.35) + vec3(0.75, 0.96, 1.0) * scan * 0.25;
        float alpha = (land * 0.26 + grid * 0.10 + fres * 0.46 + scan * 0.14) * (0.85 + 0.42 * uBoost);
        gl_FragColor = vec4(col, alpha);
      }`,
  }));
  globe.position.set(0, 1.48, -0.78);
  scene.add(globe);

  // Two sleek fading orbital comet-trails with optical star-glint beacons (no rigid solid hoop!)
  const glintMat = additive({
    side: THREE.DoubleSide, uniforms: { c: u.a },
    vertexShader: UV_VS,
    fragmentShader: /* glsl */`
      uniform vec3 c; varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
        float core = exp(-r * r * 30.0);
        float cross = exp(-abs(p.y) * 24.0) * exp(-abs(p.x) * 4.0) * 0.7 + exp(-abs(p.x) * 24.0) * exp(-abs(p.y) * 4.0) * 0.5;
        gl_FragColor = vec4(mix(c, vec3(1.0), core), (core + cross) * smoothstep(1.0, 0.2, r));
      }`,
  });
  const orbTrails = [
    { rad: 2.42, rx: 0.34, rz: -0.22, spd: 0.28, ph: 0.4 },
    { rad: 2.22, rx: -0.42, rz: 0.28, spd: -0.22, ph: 2.8 },
  ].map(({ rad, rx, rz, spd, ph }) => {
    const og = new THREE.Group();
    og.position.copy(globe.position);
    og.rotation.set(rx, 0, rz);
    const segs = 160, tPos = [], tAng = [];
    for (let i = 0; i <= segs; i++) {
      const ang = (i / segs) * Math.PI * 2;
      tPos.push(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
      tAng.push(ang);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    tg.setAttribute('aAng', new THREE.Float32BufferAttribute(tAng, 1));
    const tu = { uAng: { value: ph }, uDir: { value: Math.sign(spd) }, c: u.a };
    og.add(new THREE.Line(tg, additive({
      uniforms: tu,
      vertexShader: 'attribute float aAng; varying float vAng; void main(){ vAng = aAng; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uAng, uDir; uniform vec3 c; varying float vAng; void main(){ float d = mod((uAng - vAng) * uDir, 6.2831853); float tail = exp(-d * 2.2) * smoothstep(0.0, 0.03, d); float dash = step(0.55, fract(vAng * 22.0)) * 0.07; gl_FragColor = vec4(mix(c, vec3(1.0), tail * 0.5), tail * 0.55 + dash); }',
    })));
    const glint = new THREE.Group();
    [0, Math.PI / 2].forEach((ry) => {
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), glintMat);
      fl.rotation.y = ry;
      glint.add(fl);
    });
    glint.add(new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
    og.add(glint);
    scene.add(og);
    return { rad, spd, ph, tu, glint };
  });

  return (t, h) => {
    u.uTime.value = t;
    u.uBoost.value = h;
    // Gentle scenic sway so back foothills never spin around to block the downtown skyline
    root.rotation.y = Math.sin(t * 0.12) * 0.32;
    globe.rotation.y = FACE_ASIA + t * 0.1;
    spireTip.material.opacity = 0.45 + 0.55 * Math.sin(t * 3.5);
    orbTrails.forEach(({ rad, spd, ph, tu, glint }) => {
      const ang = t * spd + ph;
      tu.uAng.value = ang;
      glint.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
    });
  };
}

// ── Pillar 02: AI & ML — Obsidian Quantum Neural Core, Gyroscopic Rings & Synaptic Field ──
function core(scene, [c1, c2, c3]) {
  lights(scene);
  const root = new THREE.Group(); scene.add(root);
  root.add(plinth(c1));
  const u = { uTime: { value: 0 }, uBoost: { value: 0 }, a: { value: new THREE.Color(c1) }, b: { value: new THREE.Color(c2) }, e: { value: new THREE.Color(c3) } };

  // Subtle concentric dark-energy base resonance on the obsidian plinth
  const baseGlow = new THREE.Mesh(new THREE.CircleGeometry(2.3, 128).rotateX(-Math.PI / 2), additive({
    uniforms: u, vertexShader: UV_VS,
    fragmentShader: /* glsl */`
      uniform float uTime, uBoost; uniform vec3 a, b, e; varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
        float rings = 1.0 - smoothstep(0.0, 0.035, abs(fract(r * 4.5 - uTime * 0.25) - 0.5));
        float corePool = exp(-r * r * 3.8);
        float mask = 1.0 - smoothstep(0.75, 1.0, r);
        vec3 col = mix(a, b, corePool * 0.6 + r * 0.3);
        gl_FragColor = vec4(col, mask * (corePool * 0.34 + rings * 0.16) * (0.85 + 0.4 * uBoost));
      }`,
  }));
  baseGlow.position.y = 0.015; root.add(baseGlow);

  // Precision tensor data-wave manifold floating cleanly above the plinth
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0, 72, 72).rotateX(-Math.PI / 2), additive({
    uniforms: u, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uTime; varying vec3 vP; varying float vH;
      void main() {
        vec3 p = position; float r = length(p.xz);
        p.y += (0.14 * sin(p.x * 2.4 + uTime * 0.8) + 0.11 * cos(p.z * 2.7 - uTime * 1.05)) * smoothstep(2.0, 0.4, r);
        vP = position; vH = p.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 a, b, e; uniform float uBoost; varying vec3 vP; varying float vH;
      void main() {
        vec2 k = vP.xz * 7.5; vec2 d = abs(fract(k) - 0.5) / fwidth(k);
        float line = 1.0 - min(min(d.x, d.y), 1.0);
        float dotNode = (1.0 - smoothstep(0.0, 0.14, length(fract(k) - 0.5))) * 0.6;
        float m = 1.0 - smoothstep(1.45, 2.0, length(vP.xz));
        vec3 col = mix(e, mix(a, b, 0.55), smoothstep(-0.2, 0.24, vH));
        gl_FragColor = vec4(col, m * (line * 0.32 + dotNode * 0.25 + 0.02) * (0.85 + 0.45 * uBoost));
      }`,
  }));
  surf.position.y = 0.42; root.add(surf);

  // Center core assembly (y = 1.98)
  const corePos = new THREE.Vector3(0, 1.98, 0);
  const coreGroup = new THREE.Group();
  coreGroup.position.copy(corePos);
  root.add(coreGroup);

  // Razor-smooth dark-obsidian quantum glass sphere with internal volumetric plasma veins
  const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.66, 72, 56), new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main() {
        vL = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 a, b, e; uniform float uTime, uBoost;
      varying vec3 vN; varying vec3 vV; varying vec3 vL; ${NOISE}
      void main() {
        vec3 n = normalize(vN), V = normalize(vV);
        float ndv = max(dot(n, V), 0.0);
        float fres = pow(1.0 - ndv, 2.4);
        // Swirling internal energy filaments inside glossy dark obsidian glass
        vec2 p1 = vec2(atan(vL.z, vL.x) * 2.2 + uTime * 0.35, vL.y * 3.8 - uTime * 0.22);
        float f1 = fbm2(p1);
        float f2 = fbm2(p1 * 1.9 - vec2(uTime * 0.28, f1 * 2.2));
        float filament = pow(smoothstep(0.46, 0.84, f2), 2.2);
        // Crisp directional specular sheen on the glass shell
        vec3 key = normalize(vec3(-0.45, 0.72, 0.6));
        float spec = pow(max(dot(reflect(-key, n), V), 0.0), 64.0);

        vec3 glassDark = vec3(0.03, 0.025, 0.09);
        vec3 innerGlow = mix(a, b, f1) * filament * (1.25 + 0.45 * uBoost);
        vec3 rimGlow = mix(a, mix(b, vec3(1.0), 0.45), fres) * fres * (1.15 + 0.4 * uBoost);
        vec3 col = glassDark + innerGlow + rimGlow + vec3(0.92, 0.96, 1.0) * spec * 0.85;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  coreGroup.add(coreSphere);

  // Soft volumetric core backlight halo (subtle, never blown out)
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), additive({
    uniforms: u, vertexShader: UV_VS,
    fragmentShader: 'uniform vec3 a, b; uniform float uBoost; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(mix(b, a, r), pow(max(0.0, 1.0 - r), 2.8) * (0.42 + 0.25 * uBoost)); }',
  }));
  halo.position.z = -0.65; coreGroup.add(halo);

  // Three precision concentric gyroscopic accelerator rings with fine orbital degree ticks
  const gyros = [
    { rad: 1.02, tube: 0.014, rx: 0.55, ry: 0.2, col: c1, spd: [0.22, 0.34, 0.08] },
    { rad: 1.24, tube: 0.011, rx: -0.72, ry: 0.8, col: c2, spd: [-0.18, 0.24, -0.14] },
    { rad: 1.46, tube: 0.010, rx: 1.15, ry: -0.4, col: c3, spd: [0.12, -0.2, 0.16] },
  ].map(({ rad, tube, rx, ry, col, spd }) => {
    const g = new THREE.Group();
    g.rotation.set(rx, ry, 0);
    // Razor-thin metallic luminous torus ring
    g.add(new THREE.Mesh(
      new THREE.TorusGeometry(rad, tube, 12, 160),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
    ));
    // Dashed precision orbital gauge track just outside the ring
    const tickU = { uTime: u.uTime, uBoost: u.uBoost, c: { value: new THREE.Color(col) } };
    g.add(new THREE.Mesh(
      new THREE.RingGeometry(rad + 0.05, rad + 0.095, 160),
      additive({
        side: THREE.DoubleSide, uniforms: tickU,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uTime, uBoost; uniform vec3 c; varying vec3 vP; void main(){ float ang = atan(vP.y, vP.x); float tick = step(0.68, fract(ang * 14.0)); float arc = pow(0.5 + 0.5 * cos(ang - uTime * 1.4), 5.0); gl_FragColor = vec4(mix(c, vec3(1.0), arc * 0.5), (tick * 0.32 + arc * 0.48) * (0.85 + 0.4 * uBoost)); }',
      }),
    ));
    coreGroup.add(g);
    return { g, spd };
  });

  // 3D Fibonacci spherical neural constellation: 64 crystalline nodes + pulsing synaptic filaments
  const neuralGroup = new THREE.Group();
  coreGroup.add(neuralGroup);
  const N_NODES = 64, NR = 1.34;
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N_NODES; i++) {
    const y = 1 - (i / (N_NODES - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    nodes.push(new THREE.Vector3(Math.cos(th) * rad * NR, y * NR, Math.sin(th) * rad * NR));
  }
  const nPos = new Float32Array(N_NODES * 3);
  nodes.forEach((p, i) => nPos.set([p.x, p.y, p.z], i * 3));
  const nGeo = new THREE.BufferGeometry();
  nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  neuralGroup.add(new THREE.Points(nGeo, new THREE.PointsMaterial({ color: '#f2d6ff', size: 3.4, sizeAttenuation: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })));

  const synVerts = [], synAlong = [];
  for (let i = 0; i < N_NODES; i++) {
    for (let j = i + 1; j < N_NODES; j++) {
      if (nodes[i].distanceTo(nodes[j]) < 0.78) {
        synVerts.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
        synAlong.push(0, 1);
      }
    }
  }
  const synGeo = new THREE.BufferGeometry();
  synGeo.setAttribute('position', new THREE.Float32BufferAttribute(synVerts, 3));
  synGeo.setAttribute('aAlong', new THREE.Float32BufferAttribute(synAlong, 1));
  neuralGroup.add(new THREE.LineSegments(synGeo, additive({
    uniforms: u,
    vertexShader: 'attribute float aAlong; varying float vA; varying vec3 vP; void main(){ vA = aAlong; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime, uBoost; uniform vec3 a, b; varying float vA; varying vec3 vP; void main(){ float pk = exp(-pow(fract(vA - uTime * 0.55 + vP.x * 0.4 + vP.y * 0.3) * 4.5 - 0.5, 2.0)); vec3 col = mix(a, mix(b, vec3(1.0), 0.55), pk); gl_FragColor = vec4(col, (0.09 + 0.58 * pk) * (0.85 + 0.45 * uBoost)); }',
  })));

  // Delicate vertical optical tether beam linking plinth to core (subtle, slender)
  const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.24, 1.3, 32, 1, true).translate(0, 0.65, 0), additive({
    side: THREE.DoubleSide, uniforms: u, vertexShader: UV_VS,
    fragmentShader: 'uniform vec3 a, b; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(a, b, vUv.y), (1.0 - vUv.y) * 0.16); }',
  }));
  root.add(tether);

  // 5 sleek high-DPI frosted-glass micro-HUD slivers orbiting calmly with radial hair-tethers
  const hudRing = new THREE.Group(); root.add(hudRing);
  const hudCount = 5;
  for (let i = 0; i < hudCount; i++) {
    const p = panel(chart(i + 1, [c1, c2, c3], i + 3), 0.88, 0.5);
    const ang = (i / hudCount) * Math.PI * 2 + 0.35;
    const py = 1.48 + (i % 2) * 0.72;
    const px = Math.cos(ang) * 2.38, pz = Math.sin(ang) * 2.38;
    p.position.set(px, py, pz);
    p.lookAt(0, py, 0); p.rotateY(Math.PI);
    hudRing.add(p);
    // whisper-thin tether line from core radius toward the HUD card
    const tGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(ang) * 1.42, 1.98, Math.sin(ang) * 1.42),
      new THREE.Vector3(px * 0.84, py, pz * 0.84),
    ]);
    hudRing.add(new THREE.Line(tGeo, new THREE.LineBasicMaterial({ color: c1, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })));
  }

  return (t, h) => {
    u.uTime.value = t; u.uBoost.value = h;
    coreGroup.position.y = 1.98 + Math.sin(t * 0.85) * 0.045;
    gyros.forEach(({ g, spd }) => { g.rotation.x += spd[0] * 0.008; g.rotation.y += spd[1] * 0.008; g.rotation.z += spd[2] * 0.008; });
    neuralGroup.rotation.y = t * 0.09;
    neuralGroup.rotation.x = Math.sin(t * 0.2) * 0.12;
    hudRing.rotation.y = t * 0.065;
  };
}

// ── Pillar 03: Smart Sensing — Sculpted Holographic Watershed, Mesh Sensors & Precision Satellite ──
function sensing(scene, [c1, c2]) {
  lights(scene);
  const root = new THREE.Group(); scene.add(root);
  root.add(plinth(c2));

  const WL = 0.05;
  const river = (x) => 0.45 * Math.sin(x * 1.25 + 0.5) + 0.38;
  const hf = (x, z) => {
    const dr = z - river(x);
    const peak1 = ridgedMF(x * 0.68 + 3.8, z * 0.68 + 1.2, 5) * 1.75 * Math.exp(-((x - 0.55) ** 2 + (z + 0.95) ** 2) / 1.45);
    const peak2 = ridgedMF(x * 0.72 + 8.4, z * 0.72 + 4.1, 5) * 1.15 * Math.exp(-((x + 0.85) ** 2 + (z + 0.85) ** 2) / 1.25);
    return 0.10 + peak1 + peak2 + 0.11 * fbm(x * 1.7, z * 1.7) - 0.16 * Math.exp(-(dr * dr) / 0.028);
  };

  // Sculpted dark-slate & holographic topographic terrain disc with live Lidar scan response
  const radius = 2.32, seg = 104;
  const tGeo = new THREE.PlaneGeometry(radius * 2, radius * 2, seg, seg).rotateX(-Math.PI / 2);
  const tp = tGeo.attributes.position;
  const aWet = new Float32Array(tp.count);
  for (let k = 0; k < tp.count; k++) {
    let x = tp.getX(k), z = tp.getZ(k);
    const rr = Math.hypot(x, z);
    if (rr > radius) { x *= radius / rr; z *= radius / rr; }
    const edge = THREE.MathUtils.smoothstep(radius - Math.min(rr, radius), 0, radius * 0.12);
    const y0 = hf(x, z);
    const y = Math.max(y0, WL) * edge + 0.002;
    tp.setXYZ(k, x, y, z);
    aWet[k] = y0 <= WL ? 1 : 0;
  }
  tGeo.setAttribute('aWet', new THREE.BufferAttribute(aWet, 1));
  tGeo.computeVertexNormals();

  const terrainU = {
    uTime: { value: 0 }, uBoost: { value: 0 },
    uScanPos: { value: new THREE.Vector2(0.2, 0.2) },
    uSun: { value: new THREE.Vector3(-0.55, 0.75, 0.45).normalize() },
    cA: { value: new THREE.Color(c1) }, cB: { value: new THREE.Color(c2) },
  };
  root.add(new THREE.Mesh(tGeo, new THREE.ShaderMaterial({
    uniforms: terrainU,
    vertexShader: /* glsl */`
      attribute float aWet;
      varying vec3 vN; varying vec3 vL; varying float vWet;
      void main() {
        vL = position; vWet = aWet;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uBoost; uniform vec2 uScanPos; uniform vec3 uSun, cA, cB;
      varying vec3 vN; varying vec3 vL; varying float vWet; ${NOISE}
      void main() {
        vec3 n = normalize(vN);
        float slope = 1.0 - max(n.y, 0.0);
        float lam = max(dot(n, uSun), 0.0);

        // Realistic dark alpine slate + conifer shadow + sunlit snow ridges (no toy plastic green!)
        vec3 valley = vec3(0.055, 0.14, 0.14);
        vec3 highland = vec3(0.11, 0.17, 0.23);
        vec3 rock = vec3(0.18, 0.22, 0.28);
        vec3 snow = vec3(0.84, 0.93, 1.0);
        float nTex = 0.85 + 0.3 * vnoise(vL.xz * 7.0);
        vec3 alb = mix(valley, highland, smoothstep(0.08, 0.48, vL.y)) * nTex;
        alb = mix(alb, rock, smoothstep(0.22, 0.5, slope));
        float sn = smoothstep(0.56, 0.82, vL.y + (vnoise(vL.xz * 6.0) - 0.5) * 0.14) * (1.0 - smoothstep(0.45, 0.7, slope));
        alb = mix(alb, snow, sn);

        vec3 col = alb * (0.28 + 0.95 * lam) + vec3(0.01, 0.03, 0.055);

        // Shimmering glowing river channel
        if (vWet > 0.5) {
          float flow = 0.65 + 0.35 * sin(vL.x * 16.0 - uTime * 3.0 + vL.z * 6.0);
          col = mix(vec3(0.04, 0.26, 0.42), cA, 0.45 + 0.35 * flow);
        }

        // Crisp glowing emerald/aqua topographic elevation contours
        float ck = vL.y * 12.0;
        float cd = min(fract(ck), 1.0 - fract(ck));
        float cont = 1.0 - smoothstep(0.0, fwidth(ck) * 1.4, cd);
        col += mix(cB, cA, 0.5) * cont * 0.22 * (1.0 - sn * 0.6);

        // Live terrain-hugging Lidar/SAR scan illumination where satellite sweeps
        float dScan = length(vL.xz - uScanPos);
        float scanRing = exp(-pow((dScan - 0.52) * 18.0, 2.0));
        float scanFill = smoothstep(0.58, 0.0, dScan);
        vec2 sg = abs(fract(vL.xz * 8.0) - 0.5) / fwidth(vL.xz * 8.0);
        float scanGrid = 1.0 - min(min(sg.x, sg.y), 1.0);
        col += cA * (scanRing * 0.95 + scanFill * (0.16 + scanGrid * 0.42)) * (0.9 + 0.45 * uBoost);

        gl_FragColor = vec4(col, 1.0);
      }`,
  })));

  // Micro-optical sensor beacons (slender tapered teal laser fibers + crystalline nodes + mesh arcs)
  const sensors = [[-1.35, 1.0], [0.95, 1.35], [1.55, -0.15], [-0.45, 0.15], [-1.55, -0.6], [0.25, 1.85], [0.65, -0.85]];
  const rings = [];
  const sPoints = [];
  sensors.forEach(([x, z], i) => {
    const y = Math.max(hf(x, z), WL);
    const p = new THREE.Vector3(x, y, z);
    sPoints.push(p);
    // Hair-thin luminous optical beacon needle
    const needle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.014, 0.46, 8).translate(0, 0.23, 0),
      additive({
        uniforms: { c: { value: new THREE.Color(c1) } }, vertexShader: UV_VS,
        fragmentShader: 'uniform vec3 c; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(c, vec3(1.0), vUv.y * 0.6), 0.35 + 0.65 * vUv.y); }',
      }),
    );
    needle.position.copy(p); root.add(needle);
    // Tiny crystalline diamond sensor head
    const head = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.036),
      new THREE.MeshBasicMaterial({ color: '#e6fff9', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    head.position.set(x, y + 0.47, z); root.add(head);
    // Expanding emerald sonar ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.0, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: c2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.position.set(x, y + 0.025, z); root.add(ring); rings.push([ring, i * 0.17]);
  });

  // Curved mesh-network telemetry arcs linking the ground sensor nodes
  const mVerts = [], mAlong = [];
  [[0, 3], [3, 1], [1, 2], [3, 4], [1, 5], [2, 6], [3, 6]].forEach(([a, b]) => {
    const p1 = sPoints[a].clone().add(new THREE.Vector3(0, 0.46, 0));
    const p2 = sPoints[b].clone().add(new THREE.Vector3(0, 0.46, 0));
    const mid = p1.clone().lerp(p2, 0.5); mid.y += 0.24;
    const pts = new THREE.QuadraticBezierCurve3(p1, mid, p2).getPoints(20);
    for (let k = 0; k < pts.length - 1; k++) {
      mVerts.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
      mAlong.push(k / (pts.length - 1), (k + 1) / (pts.length - 1));
    }
  });
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.Float32BufferAttribute(mVerts, 3));
  mGeo.setAttribute('aAlong', new THREE.Float32BufferAttribute(mAlong, 1));
  root.add(new THREE.LineSegments(mGeo, additive({
    uniforms: { uTime: terrainU.uTime, c: { value: new THREE.Color(c1) } },
    vertexShader: 'attribute float aAlong; varying float vA; void main(){ vA = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime; uniform vec3 c; varying float vA; void main(){ float pk = exp(-pow(fract(vA - uTime * 0.45) * 4.5 - 0.5, 2.0)); gl_FragColor = vec4(mix(c, vec3(1.0), pk * 0.5), 0.16 + 0.62 * pk); }',
  })));

  // Precision-engineered Earth-observation micro-satellite (dark titanium + brushed gold foil + sleek specular solar wings)
  const sat = new THREE.Group();
  const titanium = new THREE.MeshStandardMaterial({ color: '#2b394e', metalness: 0.78, roughness: 0.32 });
  const goldFoil = new THREE.MeshStandardMaterial({ color: '#b89448', metalness: 0.82, roughness: 0.35, emissive: '#221704' });
  const busBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 8), goldFoil);
  busBody.rotation.z = Math.PI / 2;
  sat.add(busBody);
  // Dark optical telescope shroud & precision Ka-band dish underneath
  const optics = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.12, 16), titanium);
  optics.position.y = -0.11; sat.add(optics);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.048, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: c1 }));
  lens.position.y = -0.172; sat.add(lens);
  // Slender metallic solar-array truss + sleek dark-sapphire specular photovoltaic wings
  const truss = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.65, 8).rotateZ(Math.PI / 2), titanium);
  sat.add(truss);
  const solarMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { cA: { value: new THREE.Color(c1) } },
    vertexShader: FRES_VS,
    fragmentShader: /* glsl */`
      uniform vec3 cA; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        vec2 cell = abs(fract(vUv * vec2(12.0, 4.0)) - 0.5);
        float grid = smoothstep(0.45, 0.5, max(cell.x, cell.y));
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec3 base = mix(vec3(0.03, 0.08, 0.19), vec3(0.08, 0.22, 0.42), fres);
        vec3 col = mix(base, vec3(0.45, 0.72, 0.92), grid * 0.32) + cA * fres * 0.28;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  [-1, 1].forEach((s) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.012, 0.22), solarMat);
    wing.position.x = s * 0.52;
    sat.add(wing);
  });
  // Tiny blinking navigation strobe on top of bus
  const strobeMat = new THREE.MeshBasicMaterial({ color: '#b8fff0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), strobeMat);
  strobe.position.set(0, 0.13, 0); sat.add(strobe);

  sat.position.set(1.12, 2.88, 0.42);
  sat.rotation.set(0.22, 0.55, -0.32);
  sat.scale.setScalar(1.05);
  scene.add(sat);

  // Feather-soft volumetric SAR/Lidar scanning fan (Fresnel-softened edges — no hard flat cone!)
  const cu = { c: { value: new THREE.Color(c1) }, uTime: terrainU.uTime, uBoost: { value: 0 } };
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.56, 1, 64, 1, true).translate(0, -0.5, 0), additive({
    side: THREE.DoubleSide, uniforms: cu,
    vertexShader: FRES_VS,
    fragmentShader: /* glsl */`
      uniform vec3 c; uniform float uTime, uBoost; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        float softEdge = pow(abs(dot(normalize(vN), normalize(vV))), 1.35);
        float pulse = 0.72 + 0.28 * sin(vUv.y * 28.0 + uTime * 4.2);
        float vert = smoothstep(0.0, 0.14, vUv.y) * pow(1.0 - vUv.y, 0.85);
        gl_FragColor = vec4(c, softEdge * vert * pulse * (0.20 + 0.14 * uBoost));
      }`,
  }));
  scene.add(cone);

  // Sleek high-DPI dual-waveform environmental telemetry sliver
  const data = panel(chart(1, [c1, c2, '#ffffff'], 9), 0.96, 0.54);
  data.position.set(-1.55, 2.38, -0.35); data.rotation.y = 0.32; scene.add(data);

  const target = new THREE.Vector3(), world = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), dir = new THREE.Vector3();
  return (t, h) => {
    terrainU.uTime.value = t;
    terrainU.uBoost.value = h;
    root.rotation.y = Math.sin(t * 0.11) * 0.26;
    rings.forEach(([r, o]) => { const p = (t * 0.32 + o) % 1; r.scale.setScalar(0.08 + p * 0.44); r.material.opacity = (1 - p) * 0.65; });
    const sx = 0.2 + Math.sin(t * 0.21) * 0.72, sz = 0.28 + Math.cos(t * 0.17) * 0.62;
    terrainU.uScanPos.value.set(sx, sz);
    target.set(sx, Math.max(hf(sx, sz), WL) + 0.03, sz);
    sat.position.y = 2.88 + Math.sin(t * 0.75) * 0.04;
    strobeMat.opacity = 0.25 + 0.75 * Math.max(0, Math.sin(t * 4.5));
    root.updateMatrixWorld();
    world.copy(target).applyMatrix4(root.matrixWorld);
    cone.position.set(sat.position.x, sat.position.y - 0.14, sat.position.z);
    dir.copy(world).sub(cone.position);
    const len = dir.length();
    cone.quaternion.setFromUnitVectors(down, dir.normalize());
    cone.scale.set(1, len, 1);
    cu.uBoost.value = h;
    data.position.y = 2.38 + Math.sin(t * 0.6 + 1) * 0.035;
  };
}

const KINDS = { city, core, sensing };

function card(canvas, kind, colors, count) {
  const { r, w, h } = renderer(canvas, 2);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 60);
  cam.position.set(0, 3.0, 9.4).multiplyScalar(Math.max(1, 1.35 * h / w)); // narrow panels: step back so it fits
  cam.lookAt(0, 1.3, 0);
  const update = KINDS[kind](scene, colors, count);
  const host = canvas.closest('.lcard');
  let hover = false, hv = 0, tt = 6;
  const on = () => { hover = true; }, off = () => { hover = false; };
  host.addEventListener('pointerenter', on); host.addEventListener('pointerleave', off);
  const ctrl = {
    wing: host.dataset.wing,
    paused: false,
    active: false,
    frame(dt) {
      if (ctrl.paused) return;
      hv += ((hover || ctrl.active || host.classList.contains('focus') ? 1 : 0) - hv) * Math.min(1, dt * 4);
      tt += dt * (1 + hv * 0.8); // the visual quickens and brightens while hovered or presented
      update(tt, hv);
      r.render(scene, cam);
    },
    dispose() {
      host.removeEventListener('pointerenter', on); host.removeEventListener('pointerleave', off);
      disposeScene(scene); r.dispose(); r.forceContextLoss();
    },
  };
  return ctrl;
}

// ── Mount: 3D + GSAP choreography; returns { update, dispose } ──
export function mount(root) {
  const bd = backdrop(root.querySelector('.l-bg canvas'));
  const cardEls = [...root.querySelectorAll('.lcard')];
  const cards = cardEls.map((el) => card(el.querySelector('.lc-holo canvas'), el.dataset.holo, el.dataset.colors.split(','), +el.dataset.count || 6));
  const cardsWrap = root.querySelector('.l-cards');
  const headEl = root.querySelector('.l-head');

  const items = cardEls.map((el, i) => ({
    id: el.dataset.wing,
    el,
    holo: el.querySelector('.lc-holo'),
    plat: el.querySelector('.lc-plat'),
    floor: el.querySelector('.lc-floor'),
    card: cards[i],
    brief: root.querySelector(`.l-brief[data-brief-wing="${el.dataset.wing}"]`),
    anims: [...root.querySelectorAll(`.l-brief[data-brief-wing="${el.dataset.wing}"] .lb-anim`)],
    caption: root.querySelector(`.lb-caption[data-caption-wing="${el.dataset.wing}"]`),
  }));
  const byWing = new Map(items.map((it) => [it.id, it]));

  const still = reduce();
  const isPortrait = () => root.closest('#stage')?.classList.contains('portrait');
  // Compute hero showcase coordinates for any pillar:
  //   Wing 01 (left)  → stays left, brief plays in Columns 2–3
  //   Wing 02 (mid)   → glides left into showcase slot, brief plays in Columns 2–3
  //   Wing 03 (right) → stays right, brief plays in Columns 1–2
  function poseFor(item) {
    if (isPortrait()) {
      const dy = items[0].el.offsetTop - item.el.offsetTop - 24;
      return { holo: { x: 168, y: dy, scale: 1.12 }, floor: { x: 0, y: 0, scale: 1, opacity: 0 }, dolly: 0.12, shiftX: 0, slideX: 0 };
    }
    if (item.id === 'ss') {
      return { holo: { x: -34, y: 118, scale: 1.24 }, floor: { x: -34, y: -148, scale: 1.08, opacity: 0.92 }, dolly: 0.24, shiftX: 0.42, slideX: -44 };
    }
    const dx = items[0].el.offsetLeft - item.el.offsetLeft + 34;
    const scale = item.id === 'ai' ? 1.22 : 1.24;
    return { holo: { x: dx, y: 118, scale }, floor: { x: dx, y: -148, scale: 1.08, opacity: 0.92 }, dolly: 0.24, shiftX: -0.42, slideX: 44 };
  }

  const onMove = (e) => { const b = root.getBoundingClientRect(); bd.state.px = (e.clientX - b.left) / b.width - 0.5; bd.state.py = (e.clientY - b.top) / b.height - 0.5; };
  root.addEventListener('pointermove', onMove);

  const { gsap } = window;
  const tweens = [], offs = [], hovers = [];
  let roomTl = null, uiTl = null, briefTl = null, themeTl = null;
  let activeBrief = root.dataset.brief || null;

  function applyThemeInstant(key) {
    const th = BD_THEMES[key] || BD_THEMES.all;
    bd.uA.value.set(th.a); bd.uB.value.set(th.b); bd.uC.value.set(th.c);
    Object.assign(bd.state, {
      mode: th.mode, spotX: th.spotX,
      b0: th.beams[0], b1: th.beams[1], b2: th.beams[2],
      h0: 0, h1: 0, h2: 0,
    });
  }

  function tweenTheme(key, dur = 1.15) {
    const th = BD_THEMES[key] || BD_THEMES.all;
    if (!gsap || still) return applyThemeInstant(key);
    themeTl?.kill();
    const ca = new THREE.Color(th.a), cb = new THREE.Color(th.b), cc = new THREE.Color(th.c);
    themeTl = gsap.timeline({ overwrite: 'auto' })
      .to(bd.state, {
        mode: th.mode, spotX: th.spotX,
        b0: th.beams[0], b1: th.beams[1], b2: th.beams[2],
        h0: 0, h1: 0, h2: 0,
        duration: dur, ease: 'power2.inOut',
      }, 0)
      .to(bd.uA.value, { r: ca.r, g: ca.g, b: ca.b, duration: dur, ease: 'power2.inOut' }, 0)
      .to(bd.uB.value, { r: cb.r, g: cb.g, b: cb.b, duration: dur, ease: 'power2.inOut' }, 0)
      .to(bd.uC.value, { r: cc.r, g: cc.g, b: cc.b, duration: dur, ease: 'power2.inOut' }, 0);
    tweens.push(themeTl);
  }

  // Apply brief or 3-pillars overview state immediately (initial brief mount or reduced motion).
  function applyInstant(briefId) {
    const active = briefId ? byWing.get(briefId) : null;
    root.classList.toggle('has-brief', !!active);
    if (active) root.dataset.brief = active.id; else delete root.dataset.brief;
    cardsWrap.inert = !!active;
    applyThemeInstant(active ? active.id : 'all');

    items.forEach((it) => {
      const isAct = it === active;
      it.el.classList.toggle('is-active', isAct);
      it.brief.classList.toggle('open', isAct);
      it.brief.inert = !isAct;
      it.card.active = isAct;
      it.card.paused = !!active && !isAct;
      if (!gsap) return;
      const pose = poseFor(it);
      gsap.set(it.el, active && !isAct ? { opacity: 0, y: 38, scale: 0.94 } : { opacity: 1, y: 0, scale: 1 });
      gsap.set(it.plat, isAct ? { opacity: 0, y: 42, scale: 0.96 } : { opacity: 1, y: 0, scale: 1 });
      gsap.set(it.holo, isAct ? { ...pose.holo, opacity: 1 } : { x: 0, y: 0, scale: 1, opacity: 1 });
      gsap.set(it.floor, isAct ? pose.floor : { x: 0, y: 0, scale: 1, opacity: 1 });
      gsap.set(it.brief, isAct ? { opacity: 1, x: 0 } : { opacity: 0, x: pose.slideX });
      gsap.set(it.anims, { opacity: isAct ? 1 : 0, y: 0 });
      gsap.set(it.caption, isAct ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 });
    });

    if (gsap) gsap.set(headEl, active ? { opacity: 0, y: -24 } : { opacity: 1, y: 0 });
    const pose = active ? poseFor(active) : null;
    bd.state.dolly = pose ? pose.dolly : 0;
    bd.state.shiftX = pose ? pose.shiftX : 0;
  }

  // Smooth in-place transition between the 3-pillars view and any pillar's brief.
  function setBrief(briefId) {
    if (briefId === activeBrief) return;
    const prev = activeBrief ? byWing.get(activeBrief) : null;
    activeBrief = briefId;
    uiTl?.kill();
    briefTl?.kill();

    if (!gsap || still) { applyInstant(briefId); return; }

    // Reset any active hover lift on cards so showcase positions stay exact.
    hovers.forEach(({ y, s }) => { y(0); s(1); });

    const active = briefId ? byWing.get(briefId) : null;
    tweenTheme(active ? active.id : 'all', active ? 1.15 : 0.95);
    if (active) {
      const others = items.filter((it) => it !== active);
      const pose = poseFor(active);
      root.classList.remove('has-focus');
      root.classList.add('has-brief');
      root.dataset.brief = active.id;
      cardsWrap.inert = true;

      active.card.paused = false;
      active.card.active = true;
      active.el.classList.add('is-active');
      active.brief.classList.add('open');
      active.brief.inert = false;
      others.forEach((it) => {
        it.card.active = false;
        it.el.classList.remove('is-active');
        it.brief.inert = true;
      });

      briefTl = gsap.timeline({ overwrite: 'auto' })
        .to(bd.state, { dolly: pose.dolly, shiftX: pose.shiftX, duration: 1.05, ease: 'power3.inOut' }, 0)
        .to(headEl, { opacity: 0, y: -26, duration: 0.45, ease: 'power2.in' }, 0)
        .to(others.map((it) => it.el), {
          opacity: 0, y: 38, scale: 0.94, stagger: 0.05, duration: 0.5, ease: 'power2.inOut',
          onComplete: () => {
            if (activeBrief !== active.id) return;
            others.forEach((it) => {
              it.card.paused = true;
              it.brief.classList.remove('open');
              gsap.set(it.holo, { x: 0, y: 0, scale: 1 });
              gsap.set(it.plat, { opacity: 1, y: 0, scale: 1 });
              gsap.set(it.floor, { x: 0, y: 0, scale: 1, opacity: 1 });
            });
          },
        }, 0)
        .to(active.el, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power2.out' }, 0)
        .to(active.plat, { opacity: 0, y: 42, scale: 0.96, duration: 0.48, ease: 'power2.inOut' }, 0.04)
        .to(active.holo, { ...pose.holo, opacity: 1, duration: 0.92, ease: 'power3.inOut' }, 0.04)
        .to(active.floor, { ...pose.floor, duration: 0.92, ease: 'power3.inOut' }, 0.04)
        .fromTo(active.brief, { opacity: 0, x: pose.slideX }, { opacity: 1, x: 0, duration: 0.72, ease: 'power3.out' }, 0.24)
        .fromTo(active.anims, { opacity: 0, y: 18 }, { opacity: 1, y: 0, stagger: 0.06, duration: 0.58, ease: 'power3.out' }, 0.34)
        .fromTo(active.caption, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, 0.44);
      if (prev && prev !== active) {
        const prevPose = poseFor(prev);
        briefTl
          .to(prev.brief, { opacity: 0, x: prevPose.slideX * 0.7, duration: 0.32, ease: 'power2.in', onComplete: () => prev.brief.classList.remove('open') }, 0)
          .to(prev.caption, { opacity: 0, y: 10, duration: 0.28, ease: 'power2.in' }, 0);
      }
      tweens.push(briefTl);
    } else if (prev) {
      const others = items.filter((it) => it !== prev);
      const prevPose = poseFor(prev);
      items.forEach((it) => { it.card.paused = false; it.card.active = false; it.brief.inert = true; });
      cardsWrap.inert = false;

      briefTl = gsap.timeline({ overwrite: 'auto' })
        .to(prev.brief, {
          opacity: 0, x: prevPose.slideX * 0.75, duration: 0.36, ease: 'power2.in',
          onComplete: () => {
            if (!activeBrief) {
              prev.brief.classList.remove('open');
              prev.el.classList.remove('is-active');
              root.classList.remove('has-brief');
              delete root.dataset.brief;
            }
          },
        }, 0)
        .to(prev.caption, { opacity: 0, y: 10, duration: 0.28, ease: 'power2.in' }, 0)
        .to(bd.state, { dolly: 0, shiftX: 0, duration: 0.9, ease: 'power3.inOut' }, 0.06)
        .to(prev.holo, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.82, ease: 'power3.inOut' }, 0.08)
        .to(prev.floor, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.82, ease: 'power3.inOut' }, 0.08)
        .to(prev.plat, { opacity: 1, y: 0, scale: 1, duration: 0.58, ease: 'power3.out' }, 0.24)
        .to(headEl, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, 0.22)
        .to(others.map((it) => it.el), { opacity: 1, y: 0, scale: 1, stagger: 0.08, duration: 0.65, ease: 'power3.out' }, 0.24)
        .to(others.map((it) => it.plat), { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' }, 0.24)
        .to(others.map((it) => it.holo), { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.24)
        .to(others.map((it) => it.floor), { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.24);
      tweens.push(briefTl);
    }
  }

  function update(route) {
    const nextBrief = route.view === 'wing' && byWing.has(route.wing) ? route.wing : null;
    if (!nextBrief) {
      root.classList.toggle('has-focus', !!route.focus);
      cardEls.forEach((c) => c.classList.toggle('focus', c.dataset.wing === route.focus));
      if (gsap && !still) {
        gsap.to(bd.state, {
          h0: route.focus === cardEls[0]?.dataset.wing ? 0.9 : 0,
          h1: route.focus === cardEls[1]?.dataset.wing ? 0.9 : 0,
          h2: route.focus === cardEls[2]?.dataset.wing ? 0.9 : 0,
          duration: 0.75, ease: 'power2.out',
        });
      }
    } else {
      root.classList.remove('has-focus');
      cardEls.forEach((c) => c.classList.remove('focus'));
    }
    setBrief(nextBrief);
  }

  if (gsap && !still) {
    // Building four WebGL scenes makes the first frames long; GSAP's lag smoothing would then
    // crawl the entrance. Run it on real time, with a safety net so content never stays hidden.
    gsap.ticker.lagSmoothing(0);
    const q = gsap.utils.selector(root);

    roomTl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      .from(q('.l-room'), { opacity: 0, duration: 1.4 }, 0)
      .from(bd.earth.position, { y: '-=14', duration: 3.2 }, 0)
      .from(bd.range.material.uniforms.uRise, { value: 0.05, duration: 2.2 }, 0.1);
    tweens.push(roomTl);

    if (activeBrief && byWing.has(activeBrief)) {
      // Mounted directly into a wing brief (e.g. navigating back from that wing's portals)
      applyInstant(activeBrief);
      const act = byWing.get(activeBrief), pose = poseFor(act);
      uiTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from(act.holo, { y: pose.holo.y + 42, scale: pose.holo.scale * 0.9, opacity: 0, duration: 1.0 }, 0.15)
        .from(act.floor, { opacity: 0, scale: 0.7, duration: 0.95 }, 0.2)
        .from(act.brief, { opacity: 0, x: pose.slideX, duration: 0.78 }, 0.2)
        .from(act.anims, { opacity: 0, y: 18, stagger: 0.06, duration: 0.58 }, 0.3)
        .from(act.caption, { opacity: 0, y: 12, duration: 0.55 }, 0.4);
      tweens.push(uiTl);
    } else {
      items.forEach((it) => {
        gsap.set(it.brief, { opacity: 0, x: poseFor(it).slideX });
        gsap.set(it.caption, { opacity: 0, y: 12 });
      });
      // The entrance animates the parts inside each card, so the hover tweens on .lcard never collide with it.
      uiTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from(q('.l-eyebrow'), { y: 16, opacity: 0, duration: 0.7 }, 0.25)
        .from(q('.l-title .ch'), { yPercent: 110, opacity: 0, stagger: 0.016, duration: 0.8 }, 0.35)
        .from(q('.lc-plat'), { y: 70, opacity: 0, stagger: 0.15, duration: 1.1 }, 0.6)
        .from(q('.lc-floor'), { opacity: 0, scale: 0.6, stagger: 0.15, duration: 1.2 }, 0.75)
        .from(q('.lc-holo'), { y: 46, scale: 0.86, opacity: 0, stagger: 0.15, duration: 1.3 }, 0.85);
      const safety = setTimeout(() => { if (!activeBrief) uiTl?.progress(1); roomTl?.progress(1); }, 4500);
      tweens.push(uiTl, { kill: () => clearTimeout(safety) });
    }

    // hover: platform lifts forward and its matching aurora zone & floor spotlight brighten
    cardEls.forEach((el, idx) => {
      const [y, s] = ['y', 'scale'].map((p) => gsap.quickTo(el, p, { duration: 0.5, ease: 'power3.out' }));
      const hProp = `h${idx}`;
      const hTo = gsap.quickTo(bd.state, hProp, { duration: 0.6, ease: 'power2.out' });
      hovers.push({ y, s });
      tweens.push(y.tween, s.tween, hTo.tween);
      const enter = () => { if (!activeBrief) { y(-12); s(1.035); hTo(1); } };
      const leave = () => { if (!activeBrief) { y(0); s(1); hTo(0); } };
      el.addEventListener('pointerenter', enter); el.addEventListener('pointerleave', leave);
      offs.push(() => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); });
    });
  } else {
    applyInstant(activeBrief);
  }

  let raf = 0, last = performance.now();
  const t0 = last;
  const loop = (now) => {
    const t = still ? 6 : (now - t0) / 1000, dt = still ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
    bd.frame(t, dt);
    cards.forEach((c) => c.frame(dt));
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return {
    update,
    dispose() {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onMove);
      offs.forEach((f) => f());
      tweens.forEach((tw) => tw.kill());
      bd.dispose(); cards.forEach((c) => c.dispose());
    },
  };
}
