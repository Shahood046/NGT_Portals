// Opening scene (NDMA → NGT): "National Operations Command Table"
// A dark-theme institutional operations chamber housing a grounded, recessed circular
// dark-titanium command table with a high-contrast dark-obsidian + 14,000-point LiDAR
// sculpted relief of Pakistan, glowing aqua ridges & river veins, warm amber-gold hub
// beacons, dashed curved telemetry arcs, subtle flank readouts, and continuous
// NDMA → top-left glide + NGT emergence choreography.
import * as THREE from '../../vendor/three.module.js';
import { ridgedMF, fbm, hash, clamp01 } from './kit.js';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Grounded horizontal projection on XZ plane centered on Pakistan (~69.4°E, 30.3°N):
//   +X = East (right), -Z = North (top/back), +Y = 3D topographic elevation rising upward
const LON0 = 69.4, LAT0 = 30.3, COS_LAT = Math.cos((LAT0 * Math.PI) / 180), SCALE = 0.76;
const projXZ = (lon, lat) => [(lon - LON0) * COS_LAT * SCALE, -(lat - LAT0) * SCALE];
const smoothstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// High-detail Pakistan boundary [lon, lat] (clockwise from Jiwani / Makran Coast)
const PAKISTAN_BORDER = [
  [61.75, 25.05], [61.52, 25.48], [61.72, 25.95], [62.08, 26.32], [62.78, 26.68],
  [63.28, 27.18], [63.15, 27.68], [62.75, 28.08], [62.10, 28.55], [61.52, 28.98],
  [60.88, 29.85], [61.75, 29.62], [62.55, 29.46], [63.35, 29.52], [64.15, 29.56],
  [64.95, 29.68], [65.60, 29.92], [66.15, 30.42], [66.40, 30.92], [67.15, 31.18],
  [67.85, 31.38], [68.65, 31.48], [69.32, 31.55], [69.62, 32.05], [69.85, 32.58],
  [70.28, 33.08], [69.92, 33.65], [69.94, 33.98], [70.55, 34.02], [71.12, 34.12],
  [71.48, 34.62], [71.56, 34.98], [71.26, 35.42], [71.38, 35.88], [71.75, 36.28],
  [72.18, 36.68], [72.62, 36.88], [73.25, 36.84], [73.88, 36.92], [74.58, 37.08],
  [75.12, 36.98], [75.52, 36.78], [76.02, 36.32], [76.55, 36.02], [77.12, 35.72],
  [77.62, 35.42], [77.45, 34.95], [77.05, 34.62], [76.48, 34.55], [75.82, 34.52],
  [75.12, 34.62], [74.55, 34.45], [74.08, 34.08], [74.12, 33.65], [74.22, 33.25],
  [74.45, 32.78], [74.62, 32.48], [75.18, 32.12], [74.88, 31.82], [74.58, 31.55],
  [74.56, 31.08], [74.18, 30.65], [73.82, 30.22], [73.32, 29.78], [72.85, 29.32],
  [72.25, 28.82], [71.72, 28.38], [71.22, 28.02], [70.52, 27.88], [69.92, 27.55],
  [69.52, 27.12], [69.85, 26.62], [70.18, 26.18], [70.48, 25.68], [70.82, 25.18],
  [71.10, 24.75], [70.85, 24.32], [70.25, 24.32], [69.55, 24.28], [68.88, 24.22],
  [68.22, 23.74], [67.82, 23.92], [67.42, 24.18], [67.15, 24.58], [66.98, 24.86],
  [66.62, 25.38], [66.12, 25.44], [65.55, 25.34], [64.95, 25.24], [64.35, 25.22],
  [63.52, 25.26], [62.85, 25.18], [62.32, 25.12],
];

const RIVERS = [
  [[76.2, 35.1], [75.5, 35.35], [74.6, 35.8], [73.9, 35.4], [73.1, 34.8], [72.7, 34.0], [72.2, 33.8], [71.5, 32.9], [71.2, 31.8], [70.8, 30.5], [70.4, 29.0], [69.7, 28.4], [68.85, 27.7], [68.15, 26.8], [68.32, 25.4], [67.85, 24.6], [67.45, 24.08]],
  [[73.8, 34.3], [73.5, 33.4], [73.7, 32.9], [72.7, 32.0], [72.15, 31.2]],
  [[74.5, 32.6], [73.9, 32.4], [72.9, 31.6], [72.15, 31.2], [71.35, 30.1], [70.95, 29.2], [70.4, 29.0]],
  [[74.8, 31.9], [74.3, 31.55], [73.1, 30.8], [72.1, 30.6], [71.75, 30.45]],
  [[74.5, 31.05], [73.6, 30.3], [72.5, 29.9], [71.5, 29.4], [70.95, 29.2]],
];

const PROVINCE_LINES = [
  [[66.7, 25.35], [67.15, 26.2], [67.35, 27.1], [67.75, 28.0], [68.5, 28.45], [69.45, 28.6]],
  [[69.45, 28.6], [69.85, 29.4], [69.95, 30.4], [70.15, 31.25], [69.35, 31.55]],
  [[70.15, 31.25], [70.8, 32.1], [71.25, 32.9], [72.1, 33.75], [72.85, 33.95], [73.55, 34.25]],
  [[69.52, 27.12], [69.75, 27.8], [69.45, 28.6]],
  [[72.4, 35.1], [73.2, 35.05], [73.8, 34.85], [74.45, 34.55]],
];

const CITIES = [
  { name: 'Islamabad', coord: [73.05, 33.68], major: true, label: true },
  { name: 'Lahore',    coord: [74.35, 31.55], major: true, label: true },
  { name: 'Peshawar',  coord: [71.58, 34.01], major: true, label: true },
  { name: 'Quetta',    coord: [67.01, 30.18], major: true, label: true },
  { name: 'Karachi',   coord: [67.00, 24.86], major: true, label: true },
  { name: 'Gilgit',    coord: [74.31, 35.92], major: false, label: true },
  { name: 'Gwadar',    coord: [62.32, 25.12], major: false, label: true },
  { name: 'Multan',    coord: [71.52, 30.16], major: false, label: false },
  { name: 'Sukkur',    coord: [68.85, 27.71], major: false, label: false },
];

const ARCS = [
  [0, 1, 'gold'], [0, 3, 'gold'], [0, 4, 'cyan'],
  [2, 3, 'cyan'], [3, 4, 'gold'], [1, 4, 'cyan'],
  [0, 5, 'cyan'], [3, 6, 'cyan'],
];

const additive = (o) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o });

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

// High-detail procedural topography of Pakistan (+Y elevation units)
function pakistanElevation(lon, lat) {
  const karakoram = smoothstep(33.4, 36.1, lat) * smoothstep(71.2, 74.4, lon) * 1.55;
  const hinduKush = smoothstep(33.8, 36.3, lat) * smoothstep(73.8, 71.2, lon) * 1.1;
  const spineLon = lat > 29.0 ? 69.7 - (33.5 - lat) * 0.35 : 67.25;
  const spineDist = Math.abs(lon - spineLon);
  const westernWall = Math.exp(-(spineDist * spineDist) / 2.0) * smoothstep(24.9, 26.8, lat) * smoothstep(35.0, 32.8, lat) * 0.88;
  const baloch = smoothstep(68.2, 65.0, lon) * smoothstep(24.8, 26.4, lat) * smoothstep(31.2, 29.5, lat) * 0.62;
  const potohar = Math.exp(-(((lon - 73.1) ** 2) / 1.4 + ((lat - 33.4) ** 2) / 0.8)) * 0.36;
  const indusLon = 68.0 + (lat - 25.0) * 0.52;
  const indusMask = Math.exp(-(((lon - indusLon) ** 2) / 3.6)) * smoothstep(33.2, 30.8, lat);

  const r1 = ridgedMF(lon * 0.72 + 2.3, lat * 0.72 + 1.1, 4);
  const r2 = ridgedMF(lon * 1.85 + 7.1, lat * 1.85 + 4.4, 3);
  const f1 = fbm(lon * 1.0, lat * 1.0, 3);

  const raw = (karakoram + hinduKush) * (0.42 + 0.92 * r1 + 0.32 * r2)
    + westernWall * (0.4 + 0.9 * r1 + 0.2 * r2)
    + baloch * (0.35 + 0.82 * r2 + 0.22 * f1)
    + potohar * (0.48 + 0.58 * f1)
    + 0.08 * f1;
  return Math.max(0.04, raw * (1.0 - indusMask * 0.62) + 0.06);
}

// Precomputed flat edge arrays for zero-allocation signed border distance
const BORDER_XZ = PAKISTAN_BORDER.map(([lon, lat]) => projXZ(lon, lat));
const N_EDGE = BORDER_XZ.length;
const EX = new Float32Array(N_EDGE), EZ = new Float32Array(N_EDGE);
const EDX = new Float32Array(N_EDGE), EDZ = new Float32Array(N_EDGE), EINV = new Float32Array(N_EDGE);
let B_MIN_X = Infinity, B_MAX_X = -Infinity, B_MIN_Z = Infinity, B_MAX_Z = -Infinity;
for (let i = 0; i < N_EDGE; i++) {
  const j = (i + N_EDGE - 1) % N_EDGE;
  const xi = BORDER_XZ[i][0], zi = BORDER_XZ[i][1];
  const xj = BORDER_XZ[j][0], zj = BORDER_XZ[j][1];
  EX[i] = xi; EZ[i] = zi;
  const dx = xj - xi, dz = zj - zi;
  EDX[i] = dx; EDZ[i] = dz; EINV[i] = 1 / (dx * dx + dz * dz + 1e-9);
  if (xi < B_MIN_X) B_MIN_X = xi; if (xi > B_MAX_X) B_MAX_X = xi;
  if (zi < B_MIN_Z) B_MIN_Z = zi; if (zi > B_MAX_Z) B_MAX_Z = zi;
}

function signedBorderDist(px, pz) {
  if (px < B_MIN_X - 0.3 || px > B_MAX_X + 0.3 || pz < B_MIN_Z - 0.3 || pz > B_MAX_Z + 0.3) return -1.0;
  let inside = false, minD2 = Infinity;
  for (let i = 0; i < N_EDGE; i++) {
    const xi = EX[i], zi = EZ[i], dx = EDX[i], dz = EDZ[i];
    const zj = zi + dz;
    if (((zi > pz) !== (zj > pz)) && (px < (dx * (pz - zi)) / (dz + 1e-9) + xi)) inside = !inside;
    let t = ((px - xi) * dx + (pz - zi) * dz) * EINV[i];
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const ex = px - (xi + t * dx), ez = pz - (zi + t * dz);
    const d2 = ex * ex + ez * ez;
    if (d2 < minD2) minD2 = d2;
  }
  const d = Math.sqrt(minD2);
  return inside ? d : -d;
}

// Module-level cache of Pakistan relief + LiDAR typed arrays so revisiting Opening is instant
let cachedRelief = null;
function getPakistanBuffers() {
  if (cachedRelief) return cachedRelief;
  const GX = 132, GZ = 118;
  const LON_MIN = 60.5, LON_MAX = 78.0, LAT_MIN = 23.4, LAT_MAX = 37.4;
  const count = (GX + 1) * (GZ + 1);
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const edgeDists = new Float32Array(count);
  const elevs = new Float32Array(count);
  const insideGrid = new Uint8Array(count);
  const indices = [], lidarPts = [], lidarBright = [];

  for (let j = 0; j <= GZ; j++) {
    const v = j / GZ, lat = LAT_MIN + (LAT_MAX - LAT_MIN) * v;
    for (let i = 0; i <= GX; i++) {
      const u = i / GX, lon = LON_MIN + (LON_MAX - LON_MIN) * u;
      const [x, z] = projXZ(lon, lat);
      const sd = signedBorderDist(x, z);
      const idx = j * (GX + 1) + i;
      insideGrid[idx] = sd > -0.22 ? 1 : 0;
      const e = sd > -0.24 ? pakistanElevation(lon, lat) * smoothstep(-0.18, 0.12, sd) : 0;
      positions[idx * 3] = x; positions[idx * 3 + 1] = e + 0.14; positions[idx * 3 + 2] = z;
      uvs[idx * 2] = u; uvs[idx * 2 + 1] = v;
      edgeDists[idx] = sd; elevs[idx] = e;
      if (sd > 0.01) {
        const keepProb = 0.28 + clamp01(e * 0.85) * 0.7 + (sd < 0.18 ? 0.5 : 0);
        if (hash(i * 1.7 + j * 0.3, j * 2.1) < keepProb) {
          lidarPts.push(x + (hash(i, j + 11) - 0.5) * 0.05, e + 0.175, z + (hash(i + 19, j) - 0.5) * 0.05);
          lidarBright.push(clamp01(0.28 + e * 0.72 + (sd < 0.14 ? 0.38 : 0)));
        }
      }
    }
  }
  for (let j = 0; j < GZ; j++) {
    for (let i = 0; i < GX; i++) {
      const a = j * (GX + 1) + i, b = a + 1, c = a + (GX + 1), d = c + 1;
      if (insideGrid[a] || insideGrid[b] || insideGrid[c] || insideGrid[d]) indices.push(a, c, b, b, c, d);
    }
  }
  cachedRelief = {
    positions, uvs, edgeDists, elevs,
    indices: new Uint32Array(indices),
    lidarPts: new Float32Array(lidarPts),
    lidarBright: new Float32Array(lidarBright),
  };
  return cachedRelief;
}

// Recessed ambient wall-monitor canvas texture for the dark operations chamber flanks (lightweight 256×160)
function wallMonitorTex(seed) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const g = cv.getContext('2d');
  g.scale(0.5, 0.5);
  g.fillStyle = '#030814'; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = 'rgba(46, 94, 166, 0.26)'; g.lineWidth = 2; g.strokeRect(4, 4, 504, 312);
  for (let p = 0; p < 3; p++) {
    const y0 = 18 + p * 98;
    g.fillStyle = 'rgba(7, 17, 38, 0.78)'; g.fillRect(16, y0, 480, 84);
    g.strokeStyle = 'rgba(48, 98, 172, 0.22)'; g.lineWidth = 1; g.strokeRect(16, y0, 480, 84);
    if ((p + seed) % 3 === 0) {
      for (let i = 0; i < 28; i++) {
        const hh = 12 + hash(i + seed * 11, p + 2) * 50;
        g.fillStyle = i % 9 === 0 ? 'rgba(62, 176, 218, 0.36)' : 'rgba(46, 98, 172, 0.32)';
        g.fillRect(28 + i * 16.2, y0 + 74 - hh, 8, hh);
      }
    } else if ((p + seed) % 3 === 1) {
      g.strokeStyle = 'rgba(68, 134, 212, 0.44)'; g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const x = 26 + i * 9.6;
        const y = y0 + 44 + Math.sin(i * 0.45 + seed) * 20 * (0.4 + 0.6 * hash(i, seed + p));
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    } else {
      for (let r = 0; r < 4; r++) {
        g.fillStyle = r === 0 ? 'rgba(76, 152, 224, 0.34)' : 'rgba(48, 96, 166, 0.26)';
        g.fillRect(28, y0 + 16 + r * 16, 80 + hash(r + seed, 4) * 140, 5);
        g.fillStyle = 'rgba(46, 92, 158, 0.16)';
        g.fillRect(280, y0 + 16 + r * 16, 60 + hash(r, seed + 8) * 130, 5);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── 3D National Operations Command Chamber & LiDAR Pakistan Map ──────────────
function buildCommandRoom(canvas, labelsEl) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const ratio = Math.min(1.25, (canvas.getBoundingClientRect().width / w) * devicePixelRatio) || 1;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(ratio);
  r.setSize(w, h, false);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#02050d', 0.026);
  const cam = new THREE.PerspectiveCamera(36, w / h, 0.1, 160);

  // Restrained deep-navy architectural lighting so the table supports the foreground emblem
  scene.add(new THREE.HemisphereLight('#3262a8', '#02050c', 0.48));
  const keyLight = new THREE.DirectionalLight('#6ea2e0', 1.15);
  keyLight.position.set(-5, 16, 8);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight('#2a66b8', 2.2, 26, 1.5);
  rimLight.position.set(0, 5.5, 0);
  scene.add(rimLight);

  const uTime = { value: 0 };
  const uReveal = { value: 1 };

  // ── 1. Dark Architectural Operations Chamber (curved shadow walls + distant wall monitors) ──
  const chamber = new THREE.Group();
  scene.add(chamber);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#040914', metalness: 0.55, roughness: 0.74, side: THREE.BackSide });
  const backWall = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 18, 48, 1, true, Math.PI * 0.65, Math.PI * 0.7), wallMat);
  backWall.position.set(0, 6.5, 1.5);
  chamber.add(backWall);

  const ribMat = new THREE.MeshStandardMaterial({ color: '#081122', metalness: 0.7, roughness: 0.44 });
  [-0.95, -0.58, -0.22, 0.22, 0.58, 0.95].forEach((ang) => {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.42, 16, 0.85), ribMat);
    const rad = 22.8;
    rib.position.set(Math.sin(ang) * rad, 6.2, -Math.cos(ang) * rad + 1.5);
    rib.rotation.y = -ang;
    rib.rotation.x = 0.08;
    chamber.add(rib);
  });

  // Dim navy telemetry wall monitor banks recessed on the far left & right chamber flanks
  const monMats = [];
  [[-15.2, 4.4, -9.8, 0.62, 1], [-14.0, 4.2, -14.2, 0.42, 2], [15.2, 4.4, -9.8, -0.62, 3], [14.0, 4.2, -14.2, -0.42, 4]].forEach(([x, y, z, ry, seed]) => {
    const m = new THREE.MeshBasicMaterial({ map: wallMonitorTex(seed), transparent: true, opacity: 0.14, depthWrite: false });
    monMats.push(m);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.75), m);
    screen.position.set(x, y, z);
    screen.rotation.y = ry;
    chamber.add(screen);
  });

  // Subtle deep-blue overhead down-light wash
  const overhead = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 7.2, 13, 48, 1, true).translate(0, 6.5, 0),
    additive({
      side: THREE.DoubleSide, uniforms: { uReveal },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uReveal; varying vec2 vUv; void main(){ float v = smoothstep(0.0, 0.25, vUv.y) * pow(1.0 - vUv.y, 1.4); gl_FragColor = vec4(vec3(0.08, 0.24, 0.52), v * 0.042 * uReveal); }',
    }),
  );
  chamber.add(overhead);

  const roomFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#02060e', metalness: 0.35, roughness: 0.8 }),
  );
  roomFloor.position.y = -0.34;
  chamber.add(roomFloor);

  // ── 2. Grounded Recessed Circular Brushed-Titanium Command Table ──
  const table = new THREE.Group();
  table.position.set(0.15, -0.25, -0.25);
  scene.add(table);

  const bezelMat = new THREE.MeshStandardMaterial({ color: '#0b1526', metalness: 0.82, roughness: 0.34 });
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(7.25, 8.95, 128).rotateX(-Math.PI / 2), bezelMat);
  outerRing.position.y = 0.04;
  table.add(outerRing);

  const innerLip = new THREE.Mesh(new THREE.CylinderGeometry(7.28, 7.28, 0.36, 128, 1, true), bezelMat);
  innerLip.position.y = -0.14;
  table.add(innerLip);

  const outerWall = new THREE.Mesh(new THREE.CylinderGeometry(8.95, 9.35, 0.42, 128, 1, true), bezelMat);
  outerWall.position.y = -0.17;
  table.add(outerWall);

  // Dark-navy decorative optical grooves, reserving subtle cyan only for the inner active rim
  const bezelGlowMats = [];
  [
    [7.26, 7.31, '#32a6d4', 0.32, 0.05],
    [8.08, 8.11, '#163a72', 0.22, 0.05],
    [8.90, 8.95, '#1d4c8e', 0.28, 0.05],
  ].forEach(([r0, r1, col, op, y]) => {
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    m.userData.baseOp = op;
    bezelGlowMats.push(m);
    const mesh = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 128).rotateX(-Math.PI / 2), m);
    mesh.position.y = y;
    table.add(mesh);
  });

  // Restrained dark-blue compass tick marks around the inner table rim
  table.add(new THREE.Mesh(new THREE.RingGeometry(7.38, 7.62, 160).rotateX(-Math.PI / 2).translate(0, 0.052, 0), additive({
    side: THREE.DoubleSide, uniforms: { uTime, uReveal },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uReveal; varying vec3 vP;
      void main() {
        float ang = atan(vP.z, vP.x);
        float tick = step(0.84, fract(ang * 28.6478));
        float major = step(0.95, fract(ang * 5.7295));
        float sweep = pow(0.5 + 0.5 * cos(ang + uTime * 0.26), 12.0);
        vec3 col = mix(vec3(0.11, 0.28, 0.56), vec3(0.26, 0.68, 0.9), major * 0.6 + sweep * 0.45);
        gl_FragColor = vec4(col, (tick * 0.11 + major * 0.22 + sweep * 0.12) * uReveal);
      }`,
  })));

  // Dark-navy recessed optical glass well inside the circular table
  const wellMat = new THREE.ShaderMaterial({
    uniforms: { uTime, uReveal },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uReveal; varying vec3 vP;
      void main() {
        vec2 p = vP.xz; float dist = length(p);
        vec2 g1 = abs(fract(p * 0.8 + 0.5) - 0.5) / fwidth(p * 0.8);
        float fine = 1.0 - min(min(g1.x, g1.y), 1.0);
        vec2 g2 = abs(fract(p * 0.2 + 0.5) - 0.5) / fwidth(p * 0.2);
        float major = 1.0 - min(min(g2.x, g2.y), 1.0);
        float ang = atan(p.y, p.x);
        float radar = pow(max(0.0, cos(ang + uTime * 0.28)), 22.0) * smoothstep(7.2, 1.4, dist);
        float edgeShade = smoothstep(7.25, 4.2, dist);

        vec3 base = vec3(0.006, 0.013, 0.030);
        vec3 lines = vec3(0.07, 0.21, 0.46) * (fine * 0.04 + major * 0.09 + radar * 0.08) * edgeShade * uReveal;
        gl_FragColor = vec4(base + lines, 1.0);
      }`,
  });
  const well = new THREE.Mesh(new THREE.CircleGeometry(7.26, 128).rotateX(-Math.PI / 2), wellMat);
  well.position.y = -0.06;
  table.add(well);

  // ── 3. Grounded High-Contrast Dark-Obsidian + LiDAR Relief Map of Pakistan ──
  const mapGroup = new THREE.Group();
  mapGroup.position.set(0.05, 0.02, 0.0);
  table.add(mapGroup);

  const pb = getPakistanBuffers();
  const reliefGeo = new THREE.BufferGeometry();
  reliefGeo.setAttribute('position', new THREE.BufferAttribute(pb.positions, 3));
  reliefGeo.setAttribute('uv', new THREE.BufferAttribute(pb.uvs, 2));
  reliefGeo.setAttribute('aEdge', new THREE.BufferAttribute(pb.edgeDists, 1));
  reliefGeo.setAttribute('aElev', new THREE.BufferAttribute(pb.elevs, 1));
  reliefGeo.setIndex(new THREE.BufferAttribute(pb.indices, 1));
  reliefGeo.computeVertexNormals();

  // High-contrast dark-obsidian surface (NormalBlending so valleys stay deep dark navy & crests pop crisply!)
  const reliefMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: { uTime, uReveal },
    vertexShader: /* glsl */`
      attribute float aEdge; attribute float aElev;
      varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vEdge; varying float vElev;
      void main() {
        vEdge = aEdge; vElev = aElev; vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uReveal;
      varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vEdge; varying float vElev;
      void main() {
        if (vEdge < 0.0) discard;
        vec3 n = normalize(vN);
        vec3 keyDir = normalize(vec3(-0.48, 0.72, 0.5));
        float lam = max(dot(n, keyDir), 0.0);
        float slope = 1.0 - max(n.y, 0.0);
        float fres = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.2);

        // Razor-crisp topographic contour lines hugging the dark obsidian terrain
        float ck = vElev * 15.0;
        float cd = min(fract(ck), 1.0 - fract(ck));
        float contour = 1.0 - smoothstep(0.0, fwidth(ck) * 1.25, cd);

        // Subtle north-to-south telemetry scan line
        float scanZ = mod(uTime * 1.45, 13.5) - 6.5;
        float sweep = exp(-pow((vP.z - scanZ) * 2.2, 2.0));

        // Deep midnight-navy interior, reserving cyan strictly as an edge accent & selected highlight
        float borderCore = 1.0 - smoothstep(0.0, 0.06, vEdge);
        float borderGlow = 1.0 - smoothstep(0.0, 0.26, vEdge);

        vec3 darkBasin  = vec3(0.009, 0.020, 0.052);
        vec3 navyRidge  = vec3(0.028, 0.072, 0.168);
        vec3 steelBlue  = vec3(0.14, 0.36, 0.68);
        vec3 cyanEdge   = vec3(0.24, 0.78, 0.94);

        float ridge = clamp(vElev * 0.75 + slope * 0.62, 0.0, 1.0);
        vec3 col = mix(darkBasin, navyRidge, clamp(ridge * 0.78 + lam * 0.24, 0.0, 1.0));
        col += steelBlue * (pow(ridge, 2.2) * (0.18 + 0.34 * lam) + contour * 0.10 + fres * 0.14 + borderGlow * 0.12);
        col += cyanEdge * (borderCore * 0.62 + sweep * 0.11);

        gl_FragColor = vec4(col, 0.95 * uReveal);
      }`,
  });
  mapGroup.add(new THREE.Mesh(reliefGeo, reliefMat));

  // Fine LiDAR point-cloud shimmer pushed into deep steel-blue (supporting, not competing)
  const lidarGeo = new THREE.BufferGeometry();
  lidarGeo.setAttribute('position', new THREE.BufferAttribute(pb.lidarPts, 3));
  lidarGeo.setAttribute('aBright', new THREE.BufferAttribute(pb.lidarBright, 1));
  mapGroup.add(new THREE.Points(lidarGeo, additive({
    uniforms: { uTime, uReveal },
    vertexShader: /* glsl */`
      attribute float aBright; varying float vB; varying vec3 vP;
      void main() {
        vB = aBright; vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 1.25 + aBright * 0.95;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uReveal; varying float vB; varying vec3 vP;
      void main() {
        float scanZ = mod(uTime * 1.45, 13.5) - 6.5;
        float sweep = exp(-pow((vP.z - scanZ) * 2.4, 2.0));
        vec3 col = mix(vec3(0.09, 0.24, 0.50), vec3(0.32, 0.74, 0.92), clamp(vB * 0.55 + sweep * 0.55, 0.0, 1.0));
        gl_FragColor = vec4(col, (0.06 + vB * 0.16 + sweep * 0.16) * uReveal);
      }`,
  })));

  // Beveled dark-navy cliff skirt + reserved cyan accent on the top map border
  const borderBase = PAKISTAN_BORDER.map(([lon, lat]) => {
    const [x, z] = projXZ(lon, lat);
    const topY = pakistanElevation(lon, lat) * 0.22 + 0.16;
    return { x, z, topY };
  });
  const nB = borderBase.length;
  const wallPos = [], wallUv = [], wallIdx = [];
  for (let i = 0; i <= nB; i++) {
    const pt = borderBase[i % nB];
    wallPos.push(pt.x, -0.05, pt.z, pt.x, pt.topY, pt.z);
    wallUv.push(i / nB, 0, i / nB, 1);
  }
  for (let i = 0; i < nB; i++) { const a = i * 2; wallIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUv, 2));
  wallGeo.setIndex(wallIdx);
  mapGroup.add(new THREE.Mesh(wallGeo, additive({
    side: THREE.DoubleSide, uniforms: { uReveal },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uReveal; varying vec2 vUv; void main(){ vec3 col = mix(vec3(0.02, 0.09, 0.22), vec3(0.18, 0.58, 0.82), vUv.y); gl_FragColor = vec4(col, (0.05 + 0.18 * vUv.y) * uReveal); }',
  })));

  const borderLineMats = [];
  [
    [0.01, '#42bce8', 0.62, true],
    [0.03, '#1e5494', 0.28, true],
    [0.0,  '#133464', 0.22, false],
  ].forEach(([dy, col, op, useTop]) => {
    const pts = borderBase.map((p) => new THREE.Vector3(p.x, (useTop ? p.topY : -0.05) + dy, p.z));
    const m = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    m.userData.baseOp = op;
    borderLineMats.push(m);
    mapGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m));
  });

  // Indus River network & provincial boundaries in restrained deep azure/navy
  const buildTerrainLines = (chains, yOff) => {
    const verts = [], along = [];
    for (const chain of chains) {
      for (let i = 0; i < chain.length - 1; i++) {
        const [x1, z1] = projXZ(chain[i][0], chain[i][1]), y1 = pakistanElevation(chain[i][0], chain[i][1]) + 0.15 + yOff;
        const [x2, z2] = projXZ(chain[i + 1][0], chain[i + 1][1]), y2 = pakistanElevation(chain[i + 1][0], chain[i + 1][1]) + 0.15 + yOff;
        verts.push(x1, y1, z1, x2, y2, z2);
        along.push(i / (chain.length - 1), (i + 1) / (chain.length - 1));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    return geo;
  };
  mapGroup.add(new THREE.LineSegments(buildTerrainLines(RIVERS, 0.04), additive({
    uniforms: { uTime, uReveal },
    vertexShader: 'attribute float aAlong; varying float vA; void main(){ vA = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime, uReveal; varying float vA; void main(){ float p = 0.55 + 0.45 * sin(vA * 18.0 - uTime * 2.4); gl_FragColor = vec4(vec3(0.18, 0.48, 0.78), (0.14 + 0.16 * p) * uReveal); }',
  })));
  const provMat = new THREE.LineBasicMaterial({ color: '#26508a', transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false });
  mapGroup.add(new THREE.LineSegments(buildTerrainLines(PROVINCE_LINES, 0.03), provMat));

  // ── 4. Restrained Warm Amber-Gold City Beacons + Projected Callout Labels ──
  const flareMat = additive({
    side: THREE.DoubleSide, uniforms: { uTime, uReveal },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uReveal; varying vec2 vUv;
      void main() {
        float cx = abs(vUv.x - 0.5) * 2.0;
        float core = exp(-cx * cx * 18.0) * pow(1.0 - vUv.y, 1.55) * smoothstep(0.0, 0.05, vUv.y);
        float baseGlow = exp(-((cx * cx * 3.2) + (vUv.y * vUv.y * 12.0))) * 0.52;
        vec3 col = mix(vec3(0.92, 0.52, 0.14), vec3(1.0, 0.9, 0.72), clamp(core * 1.2 + baseGlow * 0.5, 0.0, 1.0));
        gl_FragColor = vec4(col, (core * 0.54 + baseGlow * 0.34) * uReveal);
      }`,
  });

  const cityPositions = [], cityPulseRings = [], labelNodes = [];
  CITIES.forEach((city, idx) => {
    const [x, z] = projXZ(city.coord[0], city.coord[1]);
    const y = pakistanElevation(city.coord[0], city.coord[1]) + 0.18;
    const p = new THREE.Vector3(x, y, z);
    cityPositions.push(p);

    const fh = city.major ? 0.88 : 0.52, fw = city.major ? 0.36 : 0.24;
    [0, Math.PI / 2].forEach((rotY) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh).translate(0, fh / 2, 0), flareMat);
      f.position.copy(p); f.rotation.y = rotY;
      mapGroup.add(f);
    });
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(city.major ? 0.056 : 0.038, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#ffdfa4', transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    orb.position.copy(p);
    mapGroup.add(orb);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.84, 1.0, 44).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: city.major ? '#d99138' : '#2e72b8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.position.set(x, y + 0.02, z);
    mapGroup.add(ring);
    cityPulseRings.push({ ring, offset: idx * 0.16, reach: city.major ? 0.54 : 0.34, baseOp: city.major ? 0.4 : 0.26 });

    if (city.label && labelsEl) {
      const span = document.createElement('span');
      span.textContent = city.name;
      labelsEl.append(span);
      labelNodes.push({ el: span, local: new THREE.Vector3(x, y + (city.major ? 0.65 : 0.4), z) });
    }
  });

  // ── 5. Restrained Dashed Curved Telemetry & Flight Arcs ──
  const buildArcSet = (kind, colorVec) => {
    const verts = [], along = [];
    ARCS.filter(([, , k]) => k === kind).forEach(([aIdx, bIdx]) => {
      const a = cityPositions[aIdx], b = cityPositions[bIdx];
      const mid = a.clone().lerp(b, 0.5);
      mid.y += 0.84 + a.distanceTo(b) * 0.2;
      const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(44);
      for (let i = 0; i < pts.length - 1; i++) {
        verts.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
        along.push(i / (pts.length - 1), (i + 1) / (pts.length - 1));
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    mapGroup.add(new THREE.LineSegments(geo, additive({
      uniforms: { uTime, uReveal, cCol: { value: colorVec } },
      vertexShader: 'attribute float aAlong; varying float vA; void main(){ vA = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform float uTime, uReveal; uniform vec3 cCol; varying float vA;
        void main() {
          float dash = step(0.46, fract(vA * 24.0 - uTime * 0.4));
          float packet = exp(-pow(fract(vA - uTime * 0.22) * 5.5 - 0.5, 2.0));
          float alpha = (dash * 0.16 + packet * 0.36) * uReveal;
          gl_FragColor = vec4(mix(cCol, vec3(0.88, 0.94, 1.0), packet * 0.35), alpha);
        }`,
    })));
  };
  buildArcSet('gold', new THREE.Color('#cc8832'));
  buildArcSet('cyan', new THREE.Color('#2c6eb4'));

  // ── 6. Sparse Rising Ambient Data Motes Over the Command Table ──
  const N = 120, mp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = hash(i, 1) * Math.PI * 2, rad = Math.sqrt(hash(i, 2)) * 7.2;
    mp[i * 3] = Math.cos(a) * rad;
    mp[i * 3 + 1] = hash(i, 3) * 4.2;
    mp[i * 3 + 2] = Math.sin(a) * rad;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const moteMat = new THREE.PointsMaterial({ color: '#4274b8', size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
  table.add(new THREE.Points(moteGeo, moteMat));

  const state = { px: 0, py: 0, phase: 0, reveal: 1 };
  const _proj = new THREE.Vector3();
  return {
    state,
    frame(t, dt) {
      uTime.value = t;
      uReveal.value = state.reveal;
      moteMat.opacity = 0.13 * state.reveal;
      provMat.opacity = 0.09 * state.reveal;
      monMats.forEach((m) => { m.opacity = 0.14 * state.reveal; });
      borderLineMats.forEach((m) => { m.opacity = m.userData.baseOp * state.reveal; });
      bezelGlowMats.forEach((m) => { m.opacity = m.userData.baseOp * state.reveal; });

      mapGroup.rotation.y = Math.sin(t * 0.12) * 0.08 + state.px * 0.09 - state.phase * 0.06;

      cityPulseRings.forEach(({ ring, offset, reach, baseOp }) => {
        const p = (t * 0.36 + offset) % 1;
        ring.scale.setScalar(0.1 + p * reach);
        ring.material.opacity = (1 - p) * baseOp * state.reveal;
      });

      for (let i = 0; i < N; i++) {
        mp[i * 3 + 1] += dt * (0.12 + hash(i, 4) * 0.16);
        if (mp[i * 3 + 1] > 4.2) mp[i * 3 + 1] = 0.05;
      }
      moteGeo.attributes.position.needsUpdate = true;

      const camZ = 15.6 - state.phase * 1.45;
      const camY = 9.4 - state.phase * 0.85;
      cam.position.set(state.px * 0.95, camY - state.py * 0.35, camZ);
      cam.lookAt(0, 0.2, -0.6);
      scene.updateMatrixWorld();

      // Project muted city callout labels & strongly attenuate any passing behind center NDMA/NGT focal zone
      for (const L of labelNodes) {
        _proj.copy(L.local).applyMatrix4(mapGroup.matrixWorld).project(cam);
        const sx = ((_proj.x + 1) / 2) * w, sy = ((1 - _proj.y) / 2) * h;
        const dx = _proj.x, dy = _proj.y + 0.04;
        const centerFade = smoothstep(0.24, 0.52, Math.hypot(dx * 0.85, dy * 1.2));
        L.el.style.left = `${sx}px`;
        L.el.style.top = `${sy}px`;
        L.el.style.opacity = String(0.68 * centerFade * state.reveal);
      }

      r.render(scene, cam);
    },
    dispose() {
      labelNodes.forEach((L) => L.el.remove());
      disposeScene(scene);
      r.dispose();
      r.forceContextLoss();
    },
  };
}

// ── Mount: National Operations Command Table + NDMA → NGT Choreography ───────
export function mount(root) {
  const map = buildCommandRoom(root.querySelector('.open-bg canvas'), root.querySelector('.open-labels'));
  const dockEl = root.querySelector('.open-ndma-dock');
  const dockLabel = root.querySelector('.open-ndma-dock-label');
  const ndmaLogo = root.querySelector('.open-ndma-logo');
  const ndmaCopy = root.querySelector('.open-ndma-copy');
  const ndmaRule = root.querySelector('.open-ndma-copy .open-rule');
  const ndmaItems = [...root.querySelectorAll('.open-ndma-copy .open-name, .open-ndma-copy .open-abbr')];
  const ngtStage = root.querySelector('.open-ngt-stage');
  const ngtLogo = root.querySelector('.open-ngt-logo');
  const ngtRule = root.querySelector('.open-ngt-stage .ngt-rule');
  const ngtTexts = [...root.querySelectorAll('.open-ngt-name, .open-ngt-abbr, .open-ngt-sub')];

  const still = reduce();
  const onMove = (e) => {
    const b = root.getBoundingClientRect();
    map.state.px = (e.clientX - b.left) / b.width - 0.5;
    map.state.py = (e.clientY - b.top) / b.height - 0.5;
  };
  root.addEventListener('pointermove', onMove);

  const { gsap } = window;
  const tweens = [];
  let phaseTl = null;
  let currentPhase = root.dataset.phase || 'ndma';

  function dockTransform() {
    const dx = (dockEl.offsetLeft + dockEl.offsetWidth / 2) - (ndmaLogo.offsetLeft + ndmaLogo.offsetWidth / 2);
    const dy = (dockEl.offsetTop + dockEl.offsetHeight / 2) - (ndmaLogo.offsetTop + ndmaLogo.offsetHeight / 2);
    const scale = dockEl.offsetWidth / ndmaLogo.offsetWidth;
    return { x: dx, y: dy, scale };
  }

  function applyInstant(phase) {
    const isNgt = phase === 'ngt';
    root.dataset.phase = phase;
    map.state.phase = isNgt ? 1 : 0;
    map.state.reveal = 1;
    if (!gsap) return;
    const dock = dockTransform();
    gsap.set(ndmaLogo, isNgt ? { ...dock, opacity: 1 } : { x: 0, y: 0, scale: 1, opacity: 1 });
    gsap.set(dockLabel, isNgt ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 });
    gsap.set(ndmaCopy, isNgt ? { opacity: 0, y: 16 } : { opacity: 1, y: 0 });
    gsap.set(ndmaRule, { scaleX: isNgt ? 0 : 1 });
    gsap.set(ndmaItems, { opacity: isNgt ? 0 : 1, y: 0 });
    gsap.set(ngtStage, { opacity: isNgt ? 1 : 0 });
    gsap.set(ngtLogo, isNgt ? { opacity: 1, scale: 1, z: 0 } : { opacity: 0, scale: 0.42, z: -420 });
    gsap.set(ngtRule, { scaleX: isNgt ? 1 : 0, opacity: isNgt ? 1 : 0 });
    gsap.set(ngtTexts, isNgt ? { opacity: 1, scale: 1, z: 0, y: 0 } : { opacity: 0, scale: 0.68, z: -240, y: 14 });
  }

  function update(nextPhase) {
    if (nextPhase === currentPhase) return;
    currentPhase = nextPhase;
    root.dataset.phase = nextPhase;
    phaseTl?.kill();

    if (!gsap || still) { applyInstant(nextPhase); return; }

    const dock = dockTransform();
    if (nextPhase === 'ngt') {
      // NDMA text fades → NDMA logo glides unhurriedly to top-left → NGT logo & title glide in from back
      phaseTl = gsap.timeline({ overwrite: 'auto' })
        .to(ndmaCopy, { opacity: 0, y: 18, duration: 0.55, ease: 'power2.in' }, 0)
        .to(ndmaLogo, { ...dock, opacity: 1, duration: 2.2, ease: 'power2.inOut' }, 0.12)
        .to(map.state, { phase: 1, duration: 2.35, ease: 'power2.inOut' }, 0.12)
        .fromTo(dockLabel, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' }, 1.8)
        .set(ngtStage, { opacity: 1 }, 0.9)
        .fromTo(ngtLogo, { opacity: 0, scale: 0.42, z: -420 }, { opacity: 1, scale: 1, z: 0, duration: 1.5, ease: 'power3.out' }, 0.95)
        .fromTo(ngtRule, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.95, ease: 'power3.out' }, 1.38)
        .fromTo(ngtTexts, { opacity: 0, scale: 0.68, z: -240, y: 14 }, { opacity: 1, scale: 1, z: 0, y: 0, stagger: 0.14, duration: 1.1, ease: 'power3.out' }, 1.44);
      tweens.push(phaseTl);
    } else {
      // Smooth reverse back to NDMA centered
      phaseTl = gsap.timeline({ overwrite: 'auto' })
        .to(ngtTexts, { opacity: 0, scale: 0.72, z: -220, duration: 0.5, ease: 'power2.in' }, 0)
        .to(ngtRule, { scaleX: 0, opacity: 0, duration: 0.4, ease: 'power2.in' }, 0)
        .to(ngtLogo, { opacity: 0, scale: 0.5, z: -360, duration: 0.6, ease: 'power2.in', onComplete: () => { if (currentPhase === 'ndma') gsap.set(ngtStage, { opacity: 0 }); } }, 0.05)
        .to(dockLabel, { opacity: 0, x: -14, duration: 0.4, ease: 'power2.in' }, 0)
        .to(map.state, { phase: 0, duration: 1.9, ease: 'power2.inOut' }, 0.12)
        .to(ndmaLogo, { x: 0, y: 0, scale: 1, opacity: 1, duration: 1.85, ease: 'power2.inOut' }, 0.14)
        .fromTo(ndmaCopy, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }, 1.25)
        .fromTo(ndmaRule, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power3.out' }, 1.3)
        .fromTo(ndmaItems, { opacity: 0, y: 14 }, { opacity: 1, y: 0, stagger: 0.1, duration: 0.6, ease: 'power3.out' }, 1.34);
      tweens.push(phaseTl);
    }
  }

  if (gsap && !still) {
    gsap.ticker.lagSmoothing(0);
    map.state.reveal = 0;
    const mapIn = gsap.to(map.state, { reveal: 1, duration: 1.35, ease: 'power2.out' });
    tweens.push(mapIn);

    if (currentPhase === 'ngt') {
      applyInstant('ngt');
      phaseTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from(ndmaLogo, { opacity: 0, scale: dockTransform().scale * 0.85, duration: 0.6 }, 0.1)
        .from(dockLabel, { opacity: 0, x: -14, duration: 0.55 }, 0.2)
        .fromTo(ngtLogo, { opacity: 0, scale: 0.42, z: -420 }, { opacity: 1, scale: 1, z: 0, duration: 1.25 }, 0.12)
        .fromTo(ngtRule, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.8 }, 0.4)
        .fromTo(ngtTexts, { opacity: 0, scale: 0.68, z: -240, y: 14 }, { opacity: 1, scale: 1, z: 0, y: 0, stagger: 0.12, duration: 0.95 }, 0.45);
      tweens.push(phaseTl);
    } else {
      applyInstant('ndma');
      phaseTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from(ndmaLogo, { opacity: 0, scale: 0.86, y: 20, duration: 0.78 }, 0.12)
        .fromTo(ndmaRule, { scaleX: 0 }, { scaleX: 1, duration: 0.75 }, 0.32)
        .from(ndmaItems, { opacity: 0, y: 18, stagger: 0.1, duration: 0.65 }, 0.36);
      tweens.push(phaseTl);
    }
  } else {
    applyInstant(currentPhase);
  }

  let raf = 0, last = performance.now();
  const t0 = last;
  const loop = (now) => {
    const t = still ? 4 : (now - t0) / 1000;
    const dt = still ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    map.frame(t, dt);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    update,
    dispose() {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onMove);
      tweens.forEach((tw) => tw.kill());
      map.dispose();
    },
  };
}
