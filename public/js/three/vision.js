// Persistent Vision Experience — "THE LIVING PLANETARY CORE"
// ONE monumental, persistent 3D/WebGL orbital Earth + layered planetary shells that stay
// mounted across all 6 Vision statements. Only camera framing, lighting/palette, shader
// uniforms, planetary layer weights, and typography change between states, culminating in
// a seamless orbital pull-back into the Three Wings exhibition.
//
//   0: Earth observation       — sunlit Blue Marble Earth, atmosphere & night terminator lights
//   1: Geospatial intelligence — spherical lat/lon graticule + orbital satellite swath cones
//   2: Digital twins           — holographic blueprint globe + 3D radial urban prism clusters
//   3: Artificial intelligence — violet/magenta neural constellation, great-circle arcs & scan wave
//   4: Smart sensing           — emerald/aqua atmospheric particle currents & surface sonar pulses
//   5: Decision support        — grand pull-back + three wing-colored harmonic orbital rings → Three Wings
import * as THREE from '../../vendor/three.module.js';
import { vision } from '../config.js';
import { hash } from './kit.js';

const FACE_ASIA = -3.05; // aligns ~70°E (Pakistan / South Asia) toward +Z camera
const EARTH_R = 5.4;
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const additive = (o) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o });

// Convert geographic (lon, lat) in degrees to exact Three.js SphereGeometry local 3D point
function latLonToVec3(lon, lat, r = EARTH_R) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.cos(phi) * Math.sin(theta),
    r * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

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

// Per-state cinematography: camera, lookAt, planet offset, palette & planetary shell weights
const STATES = [
  { // 0: Earth observation — majestic wide orbital portrait on the right, clean sunlit limb
    cam: [-3.2, 2.2, 16.5], look: [-2.1, 0.2, 0.0], fov: 38,
    px: 2.2, py: -0.2, pz: 0.0, rotY: 0.0,
    c1: '#49d8ff', c2: '#3b7bff', c3: '#7a8eff',
    holoGrid: 0.08, twinTint: 0.0, orbital: 0.45, twin: 0.0, ai: 0.0, sensing: 0.0, finale: 0.0,
  },
  { // 1: Geospatial intelligence — tight swoop over South Asia with graticule & satellite swaths
    cam: [-1.1, 4.2, 12.2], look: [-0.8, 1.35, 1.2], fov: 36,
    px: 1.9, py: -0.4, pz: 0.0, rotY: 0.14,
    c1: '#3fd4ff', c2: '#2d8cff', c3: '#687bff',
    holoGrid: 1.0, twinTint: 0.18, orbital: 1.0, twin: 0.12, ai: 0.0, sensing: 0.08, finale: 0.0,
  },
  { // 2: Digital twins — dramatic grazing orbit as 3D blueprint towers & twin shell rise off Earth
    cam: [0.4, 2.6, 10.6], look: [-0.9, 1.2, 1.8], fov: 35,
    px: 2.1, py: -0.55, pz: 0.0, rotY: -0.08,
    c1: '#54e6ff', c2: '#3b88ff', c3: '#7c66ff',
    holoGrid: 0.42, twinTint: 0.92, orbital: 0.35, twin: 1.0, ai: 0.08, sensing: 0.0, finale: 0.0,
  },
  { // 3: Artificial intelligence — violet/magenta neural constellation, meridian scan & great-circle arcs
    cam: [-2.6, 3.8, 13.8], look: [-1.4, 0.4, 0.3], fov: 37,
    px: 2.3, py: -0.1, pz: 0.0, rotY: 0.24,
    c1: '#b266ff', c2: '#e84fd6', c3: '#ffb547',
    holoGrid: 0.22, twinTint: 0.28, orbital: 0.2, twin: 0.45, ai: 1.0, sensing: 0.12, finale: 0.0,
  },
  { // 4: Smart sensing — bioluminescent emerald/teal atmospheric wind currents & surface sonar pulses
    cam: [-3.8, 1.4, 13.4], look: [-1.7, 0.1, 0.2], fov: 37,
    px: 2.1, py: -0.25, pz: 0.0, rotY: -0.18,
    c1: '#2fe0b4', c2: '#2fd3e0', c3: '#ffb547',
    holoGrid: 0.2, twinTint: 0.14, orbital: 0.55, twin: 0.22, ai: 0.15, sensing: 1.0, finale: 0.0,
  },
  { // 5: Decision support — heroic pull-back framing Earth upper-right + 3 wing-colored orbital rings
    cam: [-2.4, 0.6, 16.8], look: [-1.8, -0.35, 0.0], fov: 40,
    px: 3.6, py: 0.9, pz: -1.8, rotY: 0.05,
    c1: '#3fd4ff', c2: '#a35cff', c3: '#2fe0b4',
    holoGrid: 0.18, twinTint: 0.18, orbital: 0.28, twin: 0.32, ai: 0.35, sensing: 0.42, finale: 1.0,
  },
];

// Real regional & global hub coordinates [lon, lat] centered heavily on Pakistan & South Asia
const HUBS = [
  [73.05, 33.68], [67.00, 24.86], [74.35, 31.55], [71.58, 34.01], [67.01, 30.18],
  [74.31, 35.92], [62.32, 25.12], [71.52, 30.16], [68.85, 27.71],
  [55.27, 25.20], [51.39, 35.69], [77.21, 28.61], [72.88, 19.08], [90.41, 23.81],
  [100.5, 13.75], [116.4, 39.90], [103.8, 1.35], [46.67, 24.71], [37.62, 55.75],
  [28.98, 41.01], [31.23, 30.04], [85.32, 27.71], [69.24, 41.30], [76.95, 43.24],
];

// ── Build the single persistent orbital world (initialized ONCE) ─────────────
function buildWorld(canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const ratio = Math.min(1.6, (canvas.getBoundingClientRect().width / w) * devicePixelRatio) || 1;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(ratio);
  r.setSize(w, h, false);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, w / h, 0.1, 500);
  const sunDir = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();

  const st = {
    cx: STATES[0].cam[0], cy: STATES[0].cam[1], cz: STATES[0].cam[2],
    lx: STATES[0].look[0], ly: STATES[0].look[1], lz: STATES[0].look[2],
    fov: STATES[0].fov,
    px: STATES[0].px, py: STATES[0].py, pz: STATES[0].pz, rotY: 0,
    mx: 0, my: 0,
    holoGrid: 0.08, twinTint: 0, orbital: 0.45, twin: 0, ai: 0, sensing: 0, finale: 0,
    reveal: 1,
  };

  const uTime = { value: 0 };
  const uC1 = { value: new THREE.Color(STATES[0].c1) };
  const uC2 = { value: new THREE.Color(STATES[0].c2) };
  const uC3 = { value: new THREE.Color(STATES[0].c3) };
  const uReveal = { value: 1 };

  // ── 1. Deep Space Starfield (900 crisp varied-tint stars) ──
  const N_STARS = 900;
  const sPos = new Float32Array(N_STARS * 3), sCol = new Float32Array(N_STARS * 3);
  const sc = new THREE.Color();
  for (let i = 0; i < N_STARS; i++) {
    const u = hash(i, 1) * Math.PI * 2;
    const v = Math.acos(2 * hash(i, 2) - 1);
    const rad = 110 + hash(i, 3) * 90;
    sPos[i * 3] = rad * Math.sin(v) * Math.cos(u);
    sPos[i * 3 + 1] = rad * Math.cos(v);
    sPos[i * 3 + 2] = rad * Math.sin(v) * Math.sin(u);
    const tint = hash(i, 4);
    sc.setHSL(tint < 0.7 ? 0.58 + tint * 0.1 : 0.12, 0.45, 0.72 + hash(i, 5) * 0.28);
    sCol.set([sc.r, sc.g, sc.b], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const starMat = new THREE.PointsMaterial({ size: 1.85, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── 2. Planetary System Root (positioned right-of-center for clean typography contrast) ──
  const planetSystem = new THREE.Group();
  scene.add(planetSystem);

  // Rotating Earth pivot — keeps continents, twin towers, neural arcs & sensors 100% geo-locked!
  const earthPivot = new THREE.Group();
  earthPivot.rotation.z = 0.22; // gentle axial tilt
  planetSystem.add(earthPivot);

  // ── 3. Hero Living Planet Sphere (multi-mode GPU planetary shader) ──
  const earthTex = new THREE.TextureLoader().load('vendor/earth_atmos_2048.jpg');
  earthTex.colorSpace = THREE.SRGBColorSpace;
  const sensorDirs = HUBS.slice(0, 8).map(([lon, lat]) => latLonToVec3(lon, lat, 1.0).normalize());

  const earthU = {
    map: { value: earthTex },
    uTime, uReveal, uSun: { value: sunDir },
    cA: uC1, cB: uC2, cC: uC3,
    uGrid: { value: 0.08 },
    uTwin: { value: 0.0 },
    uAI: { value: 0.0 },
    uSense: { value: 0.0 },
    uSensors: { value: sensorDirs },
  };
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 72), new THREE.ShaderMaterial({
    uniforms: earthU,
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vLocalN;
      void main() {
        vUv = uv;
        vLocalN = normalize(position);
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map;
      uniform float uTime, uReveal, uGrid, uTwin, uAI, uSense;
      uniform vec3 uSun, cA, cB, cC;
      uniform vec3 uSensors[8];
      varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vLocalN;

      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }

      void main() {
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
        float ndl = dot(n, uSun);
        float lam = max(ndl, 0.0);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 2.75);

        vec3 tx = texture2D(map, vUv).rgb;
        float land = smoothstep(0.015, 0.095, (tx.r + tx.g) * 0.5 - tx.b * 0.56);
        float luma = dot(tx, vec3(0.299, 0.587, 0.114));

        // 1. Base cinematic Blue Marble Earth with deep sapphire ocean & warm sunlit continents
        vec3 ocean = vec3(0.018, 0.068, 0.155) + vec3(0.04, 0.18, 0.34) * pow(lam, 1.3);
        vec3 continent = mix(vec3(0.07, 0.16, 0.24), tx * vec3(0.82, 0.94, 1.15), 0.65) * (0.08 + 0.88 * lam);
        vec3 col = mix(ocean, continent, land);

        // Specular sunlight glint over oceans
        vec3 H = normalize(uSun + V);
        col += (1.0 - land) * pow(max(dot(n, H), 0.0), 42.0) * vec3(0.45, 0.78, 1.0) * 0.38 * lam;

        // Subtle warm golden city lights on the night-side terminator
        float night = smoothstep(0.14, -0.22, ndl);
        float sparkle = smoothstep(0.66, 0.92, vn(vUv * vec2(180.0, 90.0)) * vn(vUv * vec2(52.0, 26.0) + 3.1));
        col += vec3(1.0, 0.78, 0.42) * land * night * sparkle * 0.65;

        // 2. Geospatial spherical graticule + fine latitude/longitude lattice (State 1)
        vec2 g1 = abs(fract(vUv * vec2(36.0, 18.0)) - 0.5) / fwidth(vUv * vec2(36.0, 18.0));
        float majorGrid = 1.0 - min(min(g1.x, g1.y), 1.0);
        vec2 g2 = abs(fract(vUv * vec2(108.0, 54.0)) - 0.5) / fwidth(vUv * vec2(108.0, 54.0));
        float minorGrid = 1.0 - min(min(g2.x, g2.y), 1.0);
        col += mix(cB, cA, majorGrid) * (majorGrid * 0.42 + minorGrid * 0.14) * uGrid * (0.35 + 0.65 * lam + fres);

        // 3. Digital Twin holographic blueprint surface transformation (State 2)
        float coast = smoothstep(0.06, 0.45, abs(dFdx(land)) + abs(dFdy(land)));
        vec3 blueprint = mix(vec3(0.02, 0.1, 0.22), cA * (0.38 + 0.65 * luma), land * 0.75 + 0.18);
        col = mix(col, blueprint + cA * coast * 0.85, uTwin * 0.62);

        // 4. AI sweeping meridian scan wave + predictive hotspot luminescence (State 3)
        float lonAng = atan(vLocalN.z, vLocalN.x);
        float scanAng = mod(uTime * 0.75, 6.283185) - 3.141592;
        float dAng = abs(atan(sin(lonAng - scanAng), cos(lonAng - scanAng)));
        float meridian = exp(-dAng * dAng * 45.0);
        float hotspot = smoothstep(0.54, 0.86, vn(vUv * vec2(26.0, 13.0) + 1.4)) * land;
        col += mix(cA, cB, 0.55) * meridian * 0.65 * uAI;
        col += mix(cB, cC, hotspot) * hotspot * (0.35 + 0.75 * meridian) * uAI;

        // 5. Smart Sensing concentric sonar waves radiating across the curved globe (State 4)
        float pulseSum = 0.0;
        for (int i = 0; i < 8; i++) {
          float angD = acos(clamp(dot(vLocalN, uSensors[i]), -1.0, 1.0));
          float ph = fract(uTime * 0.34 + float(i) * 0.17);
          float ring = exp(-pow((angD - ph * 0.38) * 52.0, 2.0)) * (1.0 - ph);
          pulseSum += ring;
        }
        col += mix(cA, cB, 0.4) * clamp(pulseSum, 0.0, 1.4) * 0.75 * uSense;

        // 6. Radiant Fresnel atmospheric limb tinted by the active Vision state palette
        vec3 rimCol = mix(vec3(0.32, 0.72, 1.0), cA, 0.58);
        col = mix(col, rimCol, fres * (0.55 + 0.55 * lam));
        col += rimCol * pow(fres, 2.2) * 0.35;

        gl_FragColor = vec4(col * uReveal, 1.0);
      }`,
  }));
  earthPivot.add(earthMesh);

  // Translucent drifting cloud wisps shell
  const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.012, 80, 56), additive({
    uniforms: { uTime, uReveal, uSun: { value: sunDir }, cA: uC1 },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uReveal; uniform vec3 uSun, cA; varying vec2 vUv; varying vec3 vN;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.05; a *= 0.5; } return s; }
      void main() {
        float lam = max(dot(normalize(vN), uSun), 0.0);
        vec2 q = vUv * vec2(12.0, 6.0) + vec2(uTime * 0.012, 0.0);
        float c = smoothstep(0.54, 0.84, fbm2(q));
        gl_FragColor = vec4(mix(vec3(0.75, 0.9, 1.0), cA, 0.22), c * (0.04 + 0.16 * lam) * uReveal);
      }`,
  }));
  earthPivot.add(cloudMesh);

  // Outer volumetric Fresnel atmosphere bloom halo (matches Three Wings Earth glow!)
  const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.075, 88, 64), additive({
    side: THREE.BackSide,
    uniforms: { uReveal, uSun: { value: sunDir }, cA: uC1 },
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform float uReveal; uniform vec3 uSun, cA; varying vec3 vN; varying vec3 vW;
      void main() {
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
        float intensity = pow(max(0.0, 0.64 + dot(n, V)), 4.2);
        float lit = 0.42 + 0.58 * max(dot(-n, uSun) + 0.35, 0.0);
        vec3 col = mix(vec3(0.28, 0.65, 1.0), cA, 0.55);
        gl_FragColor = vec4(col, intensity * 1.25 * lit * uReveal);
      }`,
  }));
  planetSystem.add(atmoMesh);

  // ── 4. Layer 1: Realistic Orbital Telemetry Trails, Optical Glints & Nadir Swaths ──
  const orbitalGroup = new THREE.Group();
  planetSystem.add(orbitalGroup);
  const satEntries = [];

  // Shared optical star-glint shader (crisp pinpoint flare like a sunlit orbital satellite)
  const glintMatBase = (uA) => additive({
    side: THREE.DoubleSide,
    uniforms: { uA, cA: uC1 },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uA; uniform vec3 cA; varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float core = exp(-r * r * 36.0);
        float halo = exp(-r * r * 5.0) * 0.35;
        float crossH = exp(-abs(p.y) * 28.0) * exp(-abs(p.x) * 3.8) * 0.72;
        float crossV = exp(-abs(p.x) * 28.0) * exp(-abs(p.y) * 3.8) * 0.55;
        float alpha = (core + halo + crossH + crossV) * smoothstep(1.0, 0.25, r) * uA;
        vec3 col = mix(cA, vec3(1.0), clamp(core * 1.4 + crossH * 0.6, 0.0, 1.0));
        gl_FragColor = vec4(col, alpha);
      }`,
  });

  [
    [EARTH_R * 1.19, 0.48, -0.24,  0.072, 0.65],
    [EARTH_R * 1.27, -0.38, 0.36, -0.056, 2.55],
    [EARTH_R * 1.15, 0.76,  0.14,  0.088, 4.35],
  ].forEach(([rad, rx, rz, spd, phase]) => {
    const og = new THREE.Group();
    og.rotation.set(rx, 0, rz);

    // Delicate fading orbital comet-trail (NOT a rigid solid neon hoop!)
    const segs = 220;
    const tPos = [], tAng = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      tPos.push(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      tAng.push(a);
    }
    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    trackGeo.setAttribute('aAng', new THREE.Float32BufferAttribute(tAng, 1));
    const trackU = { uSatAng: { value: phase }, uDir: { value: Math.sign(spd) }, uA: { value: 0 }, cA: uC1 };
    const trackLine = new THREE.Line(trackGeo, additive({
      uniforms: trackU,
      vertexShader: 'attribute float aAng; varying float vAng; void main(){ vAng = aAng; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform float uSatAng, uDir, uA; uniform vec3 cA; varying float vAng;
        void main() {
          // signed angular distance trailing behind the spacecraft
          float d = mod((uSatAng - vAng) * uDir, 6.2831853);
          float tail = exp(-d * 2.4) * smoothstep(0.0, 0.03, d);
          float dash = step(0.55, fract(vAng * 24.0)) * 0.055;
          vec3 col = mix(cA, vec3(1.0), tail * 0.55);
          gl_FragColor = vec4(col, (tail * 0.52 + dash) * uA);
        }`,
    }));
    og.add(trackLine);

    // Optical glint spacecraft beacon + hair-thin nadir laser tether + curved surface swath ring
    const sat = new THREE.Group();
    const uA = trackU.uA;
    const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), glintMatBase(uA));
    sat.add(glint);

    // Hair-thin translucent optical nadir beam pointing straight down to Earth's surface
    const nadirLen = rad - EARTH_R * 1.005;
    const nadirGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, nadirLen),
    ]);
    const nadirMat = new THREE.LineBasicMaterial({ color: '#8af0ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    sat.add(new THREE.Line(nadirGeo, nadirMat));

    // Delicate surface swath footprint ring right where the nadir beam meets Earth
    const footU = { uTime, uA, cA: uC1 };
    const foot = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.31, 48),
      additive({
        side: THREE.DoubleSide, uniforms: footU,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uTime, uA; uniform vec3 cA; varying vec2 vUv; void main(){ float p = 0.65 + 0.35 * sin(uTime * 3.0); gl_FragColor = vec4(cA, 0.42 * p * uA); }',
      }),
    );
    foot.position.z = nadirLen;
    sat.add(foot);

    og.add(sat);
    orbitalGroup.add(og);
    satEntries.push({ sat, glint, rad, spd, phase, trackU, nadirMat });
  });

  // ── 5. Layer 2: Digital Twin — Sculpted Floating Continental Hologram Shell (State 2) ──
  // Instead of spiky sticks, Earth's continents smoothly lift off the globe as a translucent
  // 3D vertex-displaced topographic twin shell with crisp isolines, Fresnel lattice & flush hub halos.
  const twinGroup = new THREE.Group();
  earthPivot.add(twinGroup);

  const twinU = { uGrow: { value: 0 }, uTime, uReveal, map: { value: earthTex }, cA: uC1, cB: uC2 };
  const twinReliefMesh = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.006, 112, 80),
    additive({
      uniforms: twinU,
      vertexShader: /* glsl */`
        uniform sampler2D map; uniform float uGrow;
        varying vec2 vUv; varying float vLand; varying float vElev; varying vec3 vN; varying vec3 vV;
        void main() {
          vUv = uv;
          vec3 tx = texture2D(map, uv).rgb;
          float land = smoothstep(0.02, 0.11, (tx.r + tx.g) * 0.5 - tx.b * 0.56);
          float luma = dot(tx, vec3(0.299, 0.587, 0.114));
          // Subtle smooth continental relief lift (higher over mountainous highlands)
          float elev = land * (0.28 + 0.72 * smoothstep(0.14, 0.65, luma));
          vLand = land; vElev = elev;
          vec3 displaced = position + normal * (elev * 0.24 * uGrow);
          vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uGrow, uTime, uReveal; uniform vec3 cA, cB;
        varying vec2 vUv; varying float vLand; varying float vElev; varying vec3 vN; varying vec3 vV;
        void main() {
          if (vLand < 0.03) discard;
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.9);
          // Crisp holographic elevation contours + fine digital mesh lines over continents
          float ck = vElev * 10.0;
          float cd = min(fract(ck), 1.0 - fract(ck));
          float contour = 1.0 - smoothstep(0.0, fwidth(ck) * 1.5, cd);
          vec2 mg = abs(fract(vUv * vec2(120.0, 60.0)) - 0.5) / fwidth(vUv * vec2(120.0, 60.0));
          float microGrid = 1.0 - min(min(mg.x, mg.y), 1.0);
          // Sweeping holographic scan wave across the twin shell
          float wave = exp(-pow(fract(vUv.y * 2.0 - uTime * 0.14) * 6.0 - 0.5, 2.0));
          float coast = smoothstep(0.03, 0.28, vLand) * (1.0 - smoothstep(0.28, 0.65, vLand));

          vec3 col = mix(cB, cA, 0.45 + 0.55 * vElev);
          col = mix(col, vec3(0.86, 0.99, 1.0), clamp(contour * 0.45 + coast * 0.8 + wave * 0.45 + fres * 0.35, 0.0, 1.0));
          float alpha = (0.10 + vElev * 0.22 + contour * 0.26 + microGrid * 0.12 + coast * 0.42 + wave * 0.28 + fres * 0.22) * vLand * uGrow * uReveal;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.82));
        }`,
    }),
  );
  twinGroup.add(twinReliefMesh);

  // Fresnel-masked precision geodesic twin cage (glows only softly along the grazing limb!)
  const twinCageU = { uGrow: twinU.uGrow, uReveal, cA: uC1 };
  const twinShell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(EARTH_R * 1.055, 3)),
    additive({
      uniforms: twinCageU,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normalize(position)); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uGrow, uReveal; uniform vec3 cA; varying vec3 vN; varying vec3 vV; void main(){ float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(cA, (0.03 + 0.34 * fres) * uGrow * uReveal); }',
    }),
  );
  twinGroup.add(twinShell);

  // Flush concentric surface hub rings hugging Earth's curvature over major regional cities
  const hubRingMat = additive({
    side: THREE.DoubleSide,
    uniforms: { uGrow: twinU.uGrow, uTime, uReveal, cA: uC1 },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uGrow, uTime, uReveal; uniform vec3 cA; varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float core = exp(-r * r * 26.0);
        float ring1 = 1.0 - smoothstep(0.0, 0.09, abs(r - 0.52));
        float ring2 = 1.0 - smoothstep(0.0, 0.06, abs(r - 0.88));
        float pulse = 0.72 + 0.28 * sin(uTime * 2.4);
        vec3 col = mix(cA, vec3(1.0), core * 0.75);
        gl_FragColor = vec4(col, (core * 0.85 + ring1 * 0.45 + ring2 * 0.22) * pulse * uGrow * uReveal);
      }`,
  });
  const _q = new THREE.Quaternion(), _fwd = new THREE.Vector3(0, 0, 1);
  HUBS.slice(0, 14).forEach(([lon, lat], i) => {
    const pos = latLonToVec3(lon, lat, EARTH_R * 1.028);
    const nrm = pos.clone().normalize();
    const sz = i < 5 ? 0.42 : 0.26;
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), hubRingMat);
    disc.position.copy(pos);
    _q.setFromUnitVectors(_fwd, nrm);
    disc.quaternion.copy(_q);
    twinGroup.add(disc);
  });

  // ── 6. Layer 3: AI Neural Constellation & Great-Circle Predictive Arcs (State 3) ──
  const aiGroup = new THREE.Group();
  earthPivot.add(aiGroup);

  const neuralLatticeMat = new THREE.LineBasicMaterial({ color: '#b870ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const neuralGeo = new THREE.IcosahedronGeometry(EARTH_R * 1.11, 2);
  const neuralLattice = new THREE.LineSegments(new THREE.EdgesGeometry(neuralGeo), neuralLatticeMat);
  aiGroup.add(neuralLattice);

  // Glowing neural nodes at geodesic vertices
  const nPosAttr = neuralGeo.attributes.position;
  const uniqueNodes = [];
  const seen = new Set();
  for (let i = 0; i < nPosAttr.count; i++) {
    const x = nPosAttr.getX(i), y = nPosAttr.getY(i), z = nPosAttr.getZ(i);
    const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
    if (!seen.has(key)) { seen.add(key); uniqueNodes.push(x, y, z); }
  }
  const nNodeGeo = new THREE.BufferGeometry();
  nNodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(uniqueNodes, 3));
  const nNodeMat = new THREE.PointsMaterial({ color: '#f4a8ff', size: 3.4, sizeAttenuation: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  aiGroup.add(new THREE.Points(nNodeGeo, nNodeMat));

  // 20 sweeping 3D Great-Circle Predictive Arcs connecting regional & global hubs around Earth
  const arcVerts = [], arcAlong = [];
  const hubVecs = HUBS.map(([lon, lat]) => latLonToVec3(lon, lat, EARTH_R * 1.008));
  for (let i = 1; i < hubVecs.length; i++) {
    const a = hubVecs[i % 5 === 0 ? 1 : 0];
    const b = hubVecs[i];
    const dist = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(EARTH_R + 0.55 + dist * 0.24);
    const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(40);
    for (let k = 0; k < pts.length - 1; k++) {
      arcVerts.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
      arcAlong.push(k / (pts.length - 1), (k + 1) / (pts.length - 1));
    }
  }
  const aiArcGeo = new THREE.BufferGeometry();
  aiArcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcVerts, 3));
  aiArcGeo.setAttribute('aAlong', new THREE.Float32BufferAttribute(arcAlong, 1));
  const aiArcU = { uTime, uA: { value: 0 }, cA: uC1, cB: uC2, cC: uC3 };
  aiGroup.add(new THREE.LineSegments(aiArcGeo, additive({
    uniforms: aiArcU,
    vertexShader: 'attribute float aAlong; varying float vA; void main(){ vA = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uA; uniform vec3 cA, cB, cC; varying float vA;
      void main() {
        float pk = exp(-pow(fract(vA - uTime * 0.34) * 5.2 - 0.5, 2.0));
        vec3 col = mix(cA, mix(cB, cC, 0.55), pk);
        gl_FragColor = vec4(col, (0.14 + 0.82 * pk) * uA);
      }`,
  })));

  // ── 7. Layer 4: Smart Sensing Atmospheric Particle Stream & Radial Beacons (State 4) ──
  const sensingGroup = new THREE.Group();
  earthPivot.add(sensingGroup);

  // 1,200 GPU-driven atmospheric wind/jet-stream particles flowing smoothly around the sphere
  const N_FLOW = 1200;
  const fLon = new Float32Array(N_FLOW), fLat = new Float32Array(N_FLOW), fSpd = new Float32Array(N_FLOW), fSeed = new Float32Array(N_FLOW);
  const fDummy = new Float32Array(N_FLOW * 3);
  for (let i = 0; i < N_FLOW; i++) {
    fLon[i] = hash(i, 11) * Math.PI * 2;
    fLat[i] = (hash(i, 12) - 0.5) * 2.55;
    fSpd[i] = 0.08 + hash(i, 13) * 0.16;
    fSeed[i] = hash(i, 14);
  }
  const flowGeo = new THREE.BufferGeometry();
  flowGeo.setAttribute('position', new THREE.BufferAttribute(fDummy, 3));
  flowGeo.setAttribute('aLon', new THREE.BufferAttribute(fLon, 1));
  flowGeo.setAttribute('aLat', new THREE.BufferAttribute(fLat, 1));
  flowGeo.setAttribute('aSpd', new THREE.BufferAttribute(fSpd, 1));
  flowGeo.setAttribute('aSeed', new THREE.BufferAttribute(fSeed, 1));
  const flowU = { uTime, uA: { value: 0 }, cA: uC1, cB: uC2 };
  sensingGroup.add(new THREE.Points(flowGeo, additive({
    uniforms: flowU,
    vertexShader: /* glsl */`
      uniform float uTime; attribute float aLon, aLat, aSpd, aSeed; varying float vMix;
      void main() {
        float lon = aLon + uTime * aSpd;
        float lat = aLat + sin(lon * 3.0 + aSeed * 6.28) * 0.12;
        float rad = ${(EARTH_R * 1.055).toFixed(3)} + aSeed * 0.35;
        vec3 p = vec3(rad * cos(lat) * cos(lon), rad * sin(lat), rad * cos(lat) * sin(lon));
        vMix = 0.5 + 0.5 * sin(uTime * 1.8 + aSeed * 12.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 2.2 + aSeed * 2.4;
      }`,
    fragmentShader: /* glsl */`
      uniform float uA; uniform vec3 cA, cB; varying float vMix;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float soft = smoothstep(1.0, 0.15, d);
        gl_FragColor = vec4(mix(cB, cA, vMix), soft * 0.72 * uA);
      }`,
  })));

  // Slender vertical sensor spires rising radially from hub coordinates
  const spireVerts = [];
  HUBS.forEach(([lon, lat], i) => {
    const a = latLonToVec3(lon, lat, EARTH_R * 1.003);
    const b = latLonToVec3(lon, lat, EARTH_R * (i < 5 ? 1.13 : 1.08));
    spireVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  });
  const spireGeo = new THREE.BufferGeometry();
  spireGeo.setAttribute('position', new THREE.Float32BufferAttribute(spireVerts, 3));
  const spireMat = new THREE.LineBasicMaterial({ color: '#5effd2', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  sensingGroup.add(new THREE.LineSegments(spireGeo, spireMat));

  // ── 8. Layer 5: Three Wings Harmonic Orbital Halos (State 5 → Three Wings bridge) ──
  const finaleGroup = new THREE.Group();
  planetSystem.add(finaleGroup);
  const wingHalos = [
    { col: '#3B9BFF', r: EARTH_R * 1.24, rx: 1.18, rz: 0.22, spd: 0.32 },  // Wing 01 Digital World
    { col: '#A35CFF', r: EARTH_R * 1.34, rx: 1.32, rz: -0.34, spd: -0.26 }, // Wing 02 AI & ML
    { col: '#2FE0B4', r: EARTH_R * 1.44, rx: 1.02, rz: 0.48, spd: 0.22 },   // Wing 03 Smart Sensing
  ].map(({ col, r: rad, rx, rz, spd }) => {
    const hg = new THREE.Group();
    hg.rotation.set(rx, 0, rz);
    const ringU = { uTime, uA: { value: 0 }, uSpd: { value: spd }, c: { value: new THREE.Color(col) } };
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(rad - 0.045, rad + 0.045, 192),
      additive({
        side: THREE.DoubleSide, uniforms: ringU,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */`
          uniform float uTime, uA, uSpd; uniform vec3 c; varying vec3 vP;
          void main() {
            float ang = atan(vP.y, vP.x);
            float comet = pow(0.5 + 0.5 * cos(ang - uTime * uSpd * 3.0), 10.0);
            vec3 col = mix(c, vec3(1.0), comet * 0.65);
            gl_FragColor = vec4(col, (0.24 + 0.72 * comet) * uA);
          }`,
      }),
    );
    hg.add(ringMesh);
    finaleGroup.add(hg);
    return { hg, ringU, spd };
  });

  return {
    st, uC1, uC2, uC3,
    frame(t, dt) {
      uTime.value = t;
      uReveal.value = st.reveal;
      starMat.opacity = 0.72 * st.reveal;
      stars.rotation.y = t * 0.004 + st.mx * 0.04;

      // Smooth orbital camera with gentle organic breathing & pointer parallax
      if (Math.abs(cam.fov - st.fov) > 0.01) { cam.fov = st.fov; cam.updateProjectionMatrix(); }
      const bx = Math.sin(t * 0.16) * 0.28, by = Math.cos(t * 0.13) * 0.14;
      cam.position.set(st.cx + bx + st.mx * 1.1, st.cy + by - st.my * 0.55, st.cz);
      cam.lookAt(st.lx + st.mx * 0.25, st.ly, st.lz);

      // Position & gently breathe the monumental planet
      planetSystem.position.set(st.px, st.py + Math.sin(t * 0.35) * 0.08, st.pz);
      earthPivot.rotation.y = FACE_ASIA + st.rotY + t * 0.022;
      cloudMesh.rotation.y = t * 0.008;

      // Update Earth surface shader layer weights
      earthU.uGrid.value = st.holoGrid;
      earthU.uTwin.value = st.twinTint;
      earthU.uAI.value = st.ai;
      earthU.uSense.value = st.sensing;

      // Layer 1: Realistic fading orbital comet trails, optical glints & nadir swath footprints
      orbitalGroup.visible = st.orbital > 0.005;
      if (orbitalGroup.visible) {
        planetSystem.updateMatrixWorld();
        satEntries.forEach(({ sat, glint, rad, spd, phase, trackU, nadirMat }) => {
          const ang = t * spd + phase;
          sat.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
          sat.lookAt(planetSystem.position);
          sat.updateMatrixWorld();
          glint.lookAt(cam.position);
          trackU.uSatAng.value = ang;
          trackU.uA.value = st.orbital * st.reveal;
          nadirMat.opacity = 0.28 * st.orbital * st.reveal;
        });
      }

      // Layer 2: Digital Twin sculpted floating continental hologram shell & Fresnel cage
      twinGroup.visible = st.twin > 0.005;
      if (twinGroup.visible) {
        twinU.uGrow.value = st.twin;
        twinShell.rotation.y = -t * 0.012;
      }

      // Layer 3: AI neural constellation & great-circle arcs
      aiGroup.visible = st.ai > 0.005;
      if (aiGroup.visible) {
        neuralLatticeMat.opacity = 0.18 * st.ai * st.reveal;
        nNodeMat.opacity = 0.85 * st.ai * st.reveal;
        neuralLattice.rotation.y = t * 0.02;
        aiArcU.uA.value = st.ai * st.reveal;
      }

      // Layer 4: Smart sensing particle stream & radial beacons
      sensingGroup.visible = st.sensing > 0.005;
      if (sensingGroup.visible) {
        flowU.uA.value = st.sensing * st.reveal;
        spireMat.opacity = 0.65 * st.sensing * st.reveal;
      }

      // Layer 5: Three Wings harmonic orbital halos
      finaleGroup.visible = st.finale > 0.005;
      if (finaleGroup.visible) {
        wingHalos.forEach(({ hg, ringU, spd }) => {
          ringU.uA.value = st.finale * st.reveal;
          hg.rotation.y = t * spd * 0.35;
        });
      }

      r.render(scene, cam);
    },
    dispose() { disposeScene(scene); r.dispose(); r.forceContextLoss(); },
  };
}

// ── Mount: Persistent Planetary World + 6 Sequential Content States ──────────
export function mount(root, initialScene = 0) {
  const world = buildWorld(root.querySelector('.v-bg canvas'));
  const countEl = root.querySelector('.v-meta .count');
  const kickerEl = root.querySelector('.statement .kicker');
  const headlineEl = root.querySelector('.statement .headline');
  const finaleEl = root.querySelector('.finale-wings');
  const dots = [...root.querySelectorAll('.v-dots button')];
  const n = vision.scenes.length;

  const still = reduce();
  const onMove = (e) => {
    const b = root.getBoundingClientRect();
    world.st.mx = (e.clientX - b.left) / b.width - 0.5;
    world.st.my = (e.clientY - b.top) / b.height - 0.5;
  };
  root.addEventListener('pointermove', onMove);

  const { gsap } = window;
  const tweens = [];
  let sceneTl = null, textTl = null;
  let activeIndex = -1;

  const setWords = (text) => {
    headlineEl.innerHTML = text.split(' ').map((w) => `<span class="v-word">${esc(w)}</span>`).join(' ');
    return [...headlineEl.querySelectorAll('.v-word')];
  };

  function applyPaletteCSS(cfg) {
    root.style.setProperty('--c1', cfg.c1);
    root.style.setProperty('--c2', cfg.c2);
    root.style.setProperty('--c3', cfg.c3);
  }

  function applyInstant(idx) {
    const cfg = STATES[idx] || STATES[0];
    const sc = vision.scenes[idx];
    activeIndex = idx;
    root.dataset.scene = String(idx);
    applyPaletteCSS(cfg);

    Object.assign(world.st, {
      cx: cfg.cam[0], cy: cfg.cam[1], cz: cfg.cam[2],
      lx: cfg.look[0], ly: cfg.look[1], lz: cfg.look[2],
      fov: cfg.fov, px: cfg.px, py: cfg.py, pz: cfg.pz, rotY: cfg.rotY,
      holoGrid: cfg.holoGrid, twinTint: cfg.twinTint, orbital: cfg.orbital,
      twin: cfg.twin, ai: cfg.ai, sensing: cfg.sensing, finale: cfg.finale,
    });
    world.uC1.value.set(cfg.c1);
    world.uC2.value.set(cfg.c2);
    world.uC3.value.set(cfg.c3);

    countEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    dots.forEach((d, i) => { d.classList.toggle('on', i === idx); d.classList.toggle('done', i < idx); });
    kickerEl.textContent = sc.kicker;
    setWords(sc.statement);
    finaleEl.inert = !sc.finale;
    finaleEl.classList.toggle('show', !!sc.finale);
    if (gsap) {
      gsap.set([kickerEl, headlineEl], { opacity: 1, y: 0 });
      gsap.set(finaleEl, { opacity: sc.finale ? 1 : 0, y: sc.finale ? 0 : 20 });
    }
  }

  function update(idx, { immediate = false } = {}) {
    if (idx === activeIndex && !immediate) return;
    const cfg = STATES[idx] || STATES[0];
    const sc = vision.scenes[idx];
    const first = activeIndex === -1;
    activeIndex = idx;
    root.dataset.scene = String(idx);
    applyPaletteCSS(cfg);

    countEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    dots.forEach((d, i) => { d.classList.toggle('on', i === idx); d.classList.toggle('done', i < idx); });

    if (!gsap || still || immediate) { applyInstant(idx); return; }

    sceneTl?.kill();
    textTl?.kill();

    const c1 = new THREE.Color(cfg.c1), c2 = new THREE.Color(cfg.c2), c3 = new THREE.Color(cfg.c3);
    const dur = first ? 1.65 : 1.85;

    // Smoothly transition camera, planetary position, lighting palette & active layers
    sceneTl = gsap.timeline({ overwrite: 'auto' })
      .to(world.st, {
        cx: cfg.cam[0], cy: cfg.cam[1], cz: cfg.cam[2],
        lx: cfg.look[0], ly: cfg.look[1], lz: cfg.look[2],
        fov: cfg.fov, px: cfg.px, py: cfg.py, pz: cfg.pz, rotY: cfg.rotY,
        holoGrid: cfg.holoGrid, twinTint: cfg.twinTint, orbital: cfg.orbital,
        twin: cfg.twin, ai: cfg.ai, sensing: cfg.sensing, finale: cfg.finale,
        duration: dur, ease: 'power2.inOut',
      }, 0)
      .to(world.uC1.value, { r: c1.r, g: c1.g, b: c1.b, duration: dur, ease: 'power2.inOut' }, 0)
      .to(world.uC2.value, { r: c2.r, g: c2.g, b: c2.b, duration: dur, ease: 'power2.inOut' }, 0)
      .to(world.uC3.value, { r: c3.r, g: c3.g, b: c3.b, duration: dur, ease: 'power2.inOut' }, 0);
    tweens.push(sceneTl);

    const revealNewText = () => {
      kickerEl.textContent = sc.kicker;
      const words = setWords(sc.statement);
      finaleEl.inert = !sc.finale;
      finaleEl.classList.toggle('show', !!sc.finale);
      const inTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(kickerEl, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 }, 0)
        .fromTo(words, { opacity: 0, y: 26 }, { opacity: 1, y: 0, stagger: 0.065, duration: 0.78 }, 0.08);
      if (sc.finale) {
        inTl.fromTo(finaleEl, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.72 }, 0.42);
      } else {
        gsap.set(finaleEl, { opacity: 0, y: 20 });
      }
      tweens.push(inTl);
    };

    if (first) {
      revealNewText();
    } else {
      textTl = gsap.timeline({ onComplete: revealNewText })
        .to([kickerEl, headlineEl], { opacity: 0, y: -14, duration: 0.34, ease: 'power2.in' }, 0)
        .to(finaleEl, { opacity: 0, y: 12, duration: 0.28, ease: 'power2.in' }, 0)
        .set([kickerEl, headlineEl], { opacity: 1, y: 0 });
      tweens.push(textTl);
    }
  }

  // Seamless orbital pull-back handoff into the Three Wings exhibition (same Earth upper-right!)
  function transitionToWings() {
    if (!gsap || still) return;
    sceneTl?.kill();
    textTl?.kill();
    const handoff = gsap.timeline({ overwrite: 'auto' })
      .to(root.querySelectorAll('.v-meta, .statement'), { opacity: 0, y: -22, duration: 0.48, ease: 'power2.in' }, 0)
      .to(world.st, {
        cx: 0.0, cy: 0.8, cz: 17.5, lx: 0.0, ly: 0.2, lz: 0.0, fov: 40,
        px: 5.2, py: 2.2, pz: -4.5,
        finale: 1.4, orbital: 0.0, twin: 0.0, ai: 0.0, sensing: 0.0, holoGrid: 0.0, twinTint: 0.0,
        duration: 1.05, ease: 'power2.inOut',
      }, 0);
    tweens.push(handoff);
  }

  // Initialize directly at `initialScene` with a graceful orbital arrival push-in
  applyInstant(initialScene);
  if (gsap && !still) {
    gsap.ticker.lagSmoothing(0);
    world.st.reveal = 0;
    world.st.cz += 3.6;
    const fadeIn = gsap.to(world.st, { reveal: 1, duration: 1.25, ease: 'power2.out' });
    tweens.push(fadeIn);
    activeIndex = -1;
    update(initialScene);
  }

  let raf = 0, last = performance.now();
  const t0 = last;
  const loop = (now) => {
    const t = still ? 4 : (now - t0) / 1000;
    const dt = still ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    world.frame(t, dt);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    update,
    transitionToWings,
    dispose() {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onMove);
      tweens.forEach((tw) => tw.kill());
      world.dispose();
    },
  };
}
