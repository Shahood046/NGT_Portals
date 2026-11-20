// Presentation engine: one state object, one rAF clock, one render path.
//
// How the two modes coexist
// • The presentation is a flat sequence of steps (sequence.js). `index` always
//   points at the step matching the screen currently shown.
// • Automated mode = `playing: true`: the clock accumulates `elapsed` and advances
//   `index` when the step's duration (÷ speed) runs out.
// • Any interaction with the content (a click, a tap, a key that is not a
//   presentation shortcut) sets `playing: false` and `exploring: true` BEFORE the
//   click is handled, so an automatic transition can never land on a visitor.
// • Navigation sets `index` to the step for the new screen, so Resume simply
//   continues the narrative from wherever the visitor is.
import { presentation, portals } from './config.js';
import { buildSequence, indexOfRoute, durationOf } from './sequence.js';
import { views, crumbs, mediaFor } from './views.js';

const $ = (s) => document.querySelector(s);
const seq = buildSequence();
const app = { index: 0, elapsed: 0, playing: true, exploring: false, speed: 1 };
const stage = $('#stage'), viewport = $('#views');
let current = null; // { el, teardown }

const isLandingRoute = (r) => r.view === 'wings' || r.view === 'wing';
const isOpeningRoute = (r) => r.view === 'ndma' || r.view === 'ngt';
const isVisionRoute = (r) => r.view === 'vision';

// ── Rendering ────────────────────────────────────────────────────────────────
function show(route, { rebuild = false } = {}) {
  const onLanding = isLandingRoute(route);
  const onOpening = isOpeningRoute(route);
  const onVision = isVisionRoute(route);
  document.body.dataset.view = route.view;
  if (onLanding) document.body.dataset.landing = '1';
  else delete document.body.dataset.landing;
  const resized = fit(); // the landing screen reshapes the stage (portrait/tall screens) before anything measures it

  // Stay on the live 3-pillars stage when entering/exiting an inline wing brief or changing focus.
  if (onLanding && !rebuild && !resized && current?.landing && current.el.isConnected) {
    if (route.wing === 'dw') bootWarm();
    current.landing.update(route);
    $('#crumbs').innerHTML = crumbs(route);
    preload(seq[(app.index + 1) % seq.length]);
    updateChrome();
    return;
  }

  // Stay on the live holographic Pakistan map when transitioning between NDMA and NGT opening phases.
  if (onOpening && !rebuild && !resized && current?.opening && current.el.isConnected) {
    current.opening.update(route.view);
    $('#crumbs').innerHTML = crumbs(route);
    preload(seq[(app.index + 1) % seq.length]);
    updateChrome();
    return;
  }

  // Stay on the single persistent Vision 3D scene across all 6 sequential Vision states.
  if (onVision && !rebuild && !resized && current?.vision && current.el.isConnected) {
    current.vision.update(route.scene);
    $('#crumbs').innerHTML = crumbs(route);
    preload(seq[(app.index + 1) % seq.length]);
    updateChrome();
    return;
  }

  const tpl = document.createElement('template');
  tpl.innerHTML = (onLanding
    ? views.wings({ focus: route.focus, brief: route.view === 'wing' ? route.wing : null })
    : views[route.view](route)
  ).trim();
  const el = tpl.content.firstElementChild;
  el.classList.add('enter');
  viewport.append(el);
  el.querySelectorAll('.live-panel iframe').forEach(fitPreview);
  el.querySelectorAll('.live-panel[data-fallback] iframe').forEach(guardPortal);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('enter')));

  // 3D scenes: loaded only when a screen has them; every WebGL context released on teardown.
  const stops = [];
  const stopHero = () => stops.splice(0).forEach((s) => s());
  const heroes = [...el.querySelectorAll('[data-hero]')];
  if (heroes.length) {
    import('./three/kit.js').then((kit) => heroes.forEach((host) => {
      const steps = [...host.querySelectorAll('[data-stage]')];
      kit.mountHero(host, host.dataset.hero, {
        mode: host.dataset.mode || 'story', variant: host.dataset.variant,
        onStage: (s) => steps.forEach((li, i) => { li.classList.toggle('on', i === s); li.classList.toggle('done', i < s); }),
      }).then((stop) => (el.isConnected ? stops.push(stop) : stop()));
    })).catch((err) => console.error('3D scene failed to load', err));
  }
  let landing = null;
  if (el.matches('[data-landing]')) {
    let ctrl = null, pending = null;
    landing = { update: (rt) => (ctrl ? ctrl.update(rt) : (pending = rt)) };
    import('./three/landing.js').then((m) => {
      if (!el.isConnected) return;
      ctrl = m.mount(el);
      stops.push(ctrl.dispose);
      if (pending) { ctrl.update(pending); pending = null; }
    }).catch((err) => console.error('landing scene failed to load', err));
  }
  let opening = null;
  if (el.matches('[data-opening]')) {
    let ctrl = null, pending = null;
    opening = { update: (ph) => (ctrl ? ctrl.update(ph) : (pending = ph)) };
    import('./three/opening.js').then((m) => {
      if (!el.isConnected) return;
      ctrl = m.mount(el);
      stops.push(ctrl.dispose);
      if (pending) { ctrl.update(pending); pending = null; }
    }).catch((err) => console.error('opening scene failed to load', err));
  }
  let visionCtrl = null;
  if (el.matches('[data-vision]')) {
    let ctrl = null, pending = null;
    visionCtrl = {
      update: (idx) => (ctrl ? ctrl.update(idx) : (pending = idx)),
      transitionToWings: () => ctrl?.transitionToWings(),
    };
    import('./three/vision.js').then((m) => {
      if (!el.isConnected) return;
      ctrl = m.mount(el, pending ?? route.scene);
      stops.push(ctrl.dispose);
      pending = null;
    }).catch((err) => console.error('vision scene failed to load', err));
  }
  // Portal thumbnails: still renders of each project's scene, made one at a time.
  const thumbs = [...el.querySelectorAll('img[data-snap]')];
  if (thumbs.length) {
    import('./three/kit.js').then((kit) => thumbs.forEach((img) => {
      const [kind, variant] = img.dataset.snap.split(':');
      kit.snapshot(kind, variant, 640, 400).then((url) => { img.src = url; img.classList.add('ready'); });
    }));
  }

  const prev = current;
  const warmSlot = el.querySelector('[data-warm-slot]');
  if (warmSlot || route.wing === 'dw' || route.view === 'portals' || route.view === 'portal') bootWarm();
  current = { el, stopHero, landing, opening, vision: visionCtrl, warmSlot, teardown: () => { stopHero(); releaseMedia(el); el.remove(); } };
  if (prev) {
    const handoff = prev.vision && onLanding;
    if (handoff) {
      prev.vision.transitionToWings();
      prev.el.classList.add('exit-to-wings');
    }
    prev.el.classList.add('exit');
    prev.el.inert = true;
    setTimeout(prev.teardown, handoff ? 1150 : 1000);
  }

  $('#crumbs').innerHTML = crumbs(route);
  preload(seq[(app.index + 1) % seq.length]);
  updateChrome();
}

// Free decoders and network for media that is leaving the screen.
function releaseMedia(el) {
  el.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
  el.querySelectorAll('iframe').forEach((f) => { f.src = 'about:blank'; });
}

const warmed = new Set();
function preload(step) {
  for (const src of mediaFor(step)) {
    if (warmed.has(src)) continue;
    warmed.add(src); // shortcut: grows by one entry per distinct image path; fine for a config-sized media list
    new Image().src = src;
  }
}

// ── Navigation ───────────────────────────────────────────────────────────────
function goStep(i) {
  if (i >= seq.length && !presentation.loop) { app.playing = false; return updateChrome(); }
  app.index = (i + seq.length) % seq.length;
  app.elapsed = 0;
  app.exploring = false;
  show(seq[app.index]);
}

function explore(route) {
  app.playing = false;
  app.exploring = true;
  app.index = indexOfRoute(seq, route);
  app.elapsed = 0;
  show({ ...seq[app.index], ...route, focus: undefined });
}

function setPlaying(on) {
  app.playing = on;
  if (on && app.exploring) { app.exploring = false; app.elapsed = 0; }
  updateChrome();
}

// ── Clock ────────────────────────────────────────────────────────────────────
let last = performance.now();
function tick(now) {
  const dt = Math.min(now - last, 100) / 1000; // clamp so a backgrounded tab does not skip steps
  last = now;
  if (app.playing) {
    app.elapsed += dt * app.speed;
    if (app.elapsed >= durationOf(seq[app.index])) goStep(app.index + 1);
  }
  drawProgress();
  placeWarm();
  requestAnimationFrame(tick);
}

// ── Warm portals ─────────────────────────────────────────────────────────────
// A portal marked `warm` (the digital twin, ~15 s to boot) is loaded into an off-screen iframe
// that is never moved in the DOM. Booting starts once the presentation reaches the portals stage
// (during Pillar 01 AI & ML, giving ~2 min of quiet background runway before Digital World) or
// immediately if a visitor jumps straight to Digital World / launches a live portal.
const warm = new Map();
let warmBooted = false;
function bootWarm() {
  if (warmBooted) return;
  warmBooted = true;
  portals.filter((p) => p.warm && p.url).forEach((p) => {
    const host = Object.assign(document.createElement('div'), { className: 'warm-host' });
    const frame = Object.assign(document.createElement('iframe'), { src: p.url, title: `${p.title} — live portal`, tabIndex: -1 });
    frame.setAttribute('allow', 'fullscreen; autoplay');
    const cover = Object.assign(document.createElement('button'), { className: 'live-cover', ariaLabel: `Launch ${p.title}` });
    cover.innerHTML = '<span class="live-tag"><i></i>Live portal · click to launch</span>';
    cover.addEventListener('click', () => openLive(p.url, p.title));
    host.append(frame, cover);
    document.body.append(host);
    warm.set(p.url, { host, frame, on: false, full: false });
  });
}
setTimeout(() => { new Image().src = 'vendor/earth_atmos_2048.jpg'; }, 1800);

// If its step came up before the viewer finished booting, start it the moment it is ready.
addEventListener('message', (e) => {
  if (e.data?.ngt !== 'twin-ready') return;
  for (const w of warm.values()) if (w.on && e.source === w.frame.contentWindow) e.source.postMessage({ ngt: 'twin-play' }, '*');
});

function placeWarm() {
  if (!warm.size) return;
  const slot = current?.warmSlot;
  for (const [url, w] of warm) {
    const box = w.full ? $('#live-frame') : slot && slot.dataset.warmSlot === url && !current.el.classList.contains('exit') ? slot : null;
    const wasOn = w.on;
    if (box && !wasOn) w.frame.contentWindow?.postMessage({ ngt: 'twin-play' }, '*');
    w.on = !!box;
    if (w.on !== wasOn || w.full !== w.wasFull) {
      w.host.classList.toggle('on', w.on);
      w.host.classList.toggle('full', w.full);
      w.wasFull = w.full;
    }
    if (!box) {
      if (wasOn) { w.host.removeAttribute('style'); w.frame.removeAttribute('style'); }
      continue;
    }
    const r = box.getBoundingClientRect(), base = w.full ? r.width : 1600, s = r.width / base;
    Object.assign(w.host.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    Object.assign(w.frame.style, { width: `${base}px`, height: `${r.height / s}px`, transform: `scale(${s})` });
  }
}

// ── Chrome: controls, progress, mode ────────────────────────────────────────
const chapters = seq.reduce((acc, s, i) => {
  if (acc.at(-1)?.name === s.chapter) acc.at(-1).count++;
  else acc.push({ name: s.chapter, start: i, count: 1 });
  return acc;
}, []);
$('#progress').innerHTML = chapters.map((c, i) =>
  `<button class="seg" style="flex:${Math.max(c.count, 3)}" data-chapter="${i}" aria-label="Jump to ${c.name}"><span class="fill"></span><span class="seg-label">${c.name}</span></button>`).join('');
const fills = [...document.querySelectorAll('#progress .fill')];

function drawProgress() {
  const pos = app.index + Math.min(1, app.elapsed / durationOf(seq[app.index]));
  chapters.forEach((c, i) => {
    const f = Math.max(0, Math.min(1, (pos - c.start) / c.count));
    fills[i].style.transform = `scaleX(${f})`;
    fills[i].parentElement.classList.toggle('active', app.index >= c.start && app.index < c.start + c.count);
  });
}

function updateChrome() {
  const mode = app.playing ? 'presenting' : app.exploring ? 'exploring' : 'paused';
  document.body.dataset.mode = mode;
  $('#mode-label').textContent = { presenting: 'Presenting', exploring: 'Exploring', paused: 'Paused' }[mode];
  $('#play').setAttribute('aria-label', app.playing ? 'Pause' : 'Resume presentation');
  $('#play-label').textContent = app.playing ? 'Pause' : app.exploring ? 'Resume presentation' : 'Play';
  const step = seq[app.index], inWing = seq.filter((s) => s.view === 'portal' && s.wing === step.wing);
  $('#step-label').textContent = step.portal
    ? `${step.chapter} · Project ${inWing.findIndex((s) => s.portal === step.portal) + 1} of ${inWing.length}`
    : `${step.chapter} · ${app.index + 1} / ${seq.length}`;
}

$('#speed').innerHTML = presentation.speeds.map((s) => `<option value="${s}" ${s === 1 ? 'selected' : ''}>${s}×</option>`).join('');
$('#speed').addEventListener('change', (e) => { app.speed = +e.target.value; });
$('#play').addEventListener('click', () => setPlaying(!app.playing));
$('#prev').addEventListener('click', () => goStep(app.index - 1));
$('#next').addEventListener('click', () => goStep(app.index + 1));
$('#fullscreen').addEventListener('click', toggleFullscreen);
$('#progress').addEventListener('click', (e) => {
  const seg = e.target.closest('[data-chapter]');
  if (seg) goStep(chapters[+seg.dataset.chapter].start);
});

function toggleFullscreen() {
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {});
}

// Any interaction with the content pauses automation first, then is handled.
stage.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#controls') && app.playing) { app.playing = false; app.exploring = true; updateChrome(); }
}, true);

stage.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-go]');
  if (nav) return explore(JSON.parse(nav.dataset.go));
  const launch = e.target.closest('[data-launch]');
  if (launch) openLive(launch.dataset.launch, launch.dataset.title);
});

// Live portal: runs full-window inside the briefing, outside the scaled stage so it gets real pixels.
const live = $('#live');
function openLive(url, title) {
  bootWarm();
  app.playing = false; app.exploring = true; updateChrome();
  current.stopHero(); releaseMedia(current.el); // nothing keeps rendering behind the overlay
  $('#live-title').textContent = title;
  const w = warm.get(url);
  if (w) { w.full = true; $('#live-frame').replaceChildren(); live.hidden = false; return; } // reuse the already-loaded viewer
  const frame = Object.assign(document.createElement('iframe'), { src: url, title: `${title} — live portal` });
  frame.setAttribute('allow', 'fullscreen; autoplay; microphone; clipboard-write');
  $('#live-frame').replaceChildren(frame);
  live.hidden = false;
  frame.focus();
}
function closeLive() {
  warm.forEach((w) => { w.full = false; });
  releaseMedia(live); $('#live-frame').replaceChildren(); live.hidden = true;
  show(seq[app.index], { rebuild: true }); // re-render the briefing so its 3D scene comes back
}
$('#live-close').addEventListener('click', closeLive);
$('#live-reload').addEventListener('click', () => { const f = live.querySelector('iframe'); if (f) f.src = f.src; });

// If a portal's server refuses the connection or has not answered within 8 s, show its home-page
// screenshot instead of a browser error page. (A cross-origin frame cannot be inspected, so a
// portal that answers with its own error page is not caught.)
function guardPortal(f) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  fetch(f.src, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal })
    .then(() => clearTimeout(timer))
    .catch(() => {
      if (!f.isConnected) return; // the step already ended
      const panel = f.parentElement;
      f.replaceWith(Object.assign(document.createElement('img'), { className: 'live-fallback', src: panel.dataset.fallback, alt: '' }));
      const tag = panel.querySelector('.live-tag');
      if (tag) tag.lastChild.textContent = 'Screenshot · portal not responding';
    });
}

// Live previews render at desktop width, then scale into their panel so portals show their full layout.
function fitPreview(f) {
  const box = f.parentElement, s = box.clientWidth / 1600;
  Object.assign(f.style, { width: '1600px', height: `${box.clientHeight / s}px`, transform: `scale(${s})` });
}

// 3D tilt + light sheen that follows the pointer on cards.
let tilted = null;
const untilt = (el) => ['--rx', '--ry', '--mx', '--my'].forEach((p) => el.style.removeProperty(p));
stage.addEventListener('pointermove', (e) => {
  const card = e.target.closest('.tilt');
  if (tilted && tilted !== card) untilt(tilted);
  tilted = card;
  if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const b = card.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
  card.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
  card.style.setProperty('--rx', `${(0.5 - y) * 12}deg`);
  card.style.setProperty('--mx', `${x * 100}%`);
  card.style.setProperty('--my', `${y * 100}%`);
});
stage.addEventListener('pointerleave', () => tilted && untilt(tilted));

document.addEventListener('keydown', (e) => {
  if (!live.hidden) { if (e.key === 'Escape') closeLive(); return; } // presentation keys stay off while a portal is open
  if (e.target.closest('select, input, textarea')) return;
  const keys = {
    ' ': () => setPlaying(!app.playing),
    ArrowRight: () => goStep(app.index + 1),
    ArrowLeft: () => goStep(app.index - 1),
    f: toggleFullscreen,
    Home: () => { goStep(0); setPlaying(true); },
  };
  const fn = keys[e.key];
  if (fn) { e.preventDefault(); fn(); }
});

// Hide controls and cursor while presenting and the pointer is still.
let idleTimer;
const wake = () => {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => app.playing && document.body.classList.add('idle'), presentation.hideControlsAfter * 1000);
};
['pointermove', 'pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, wake));

// Fit the design canvas to the window. Screens are designed at 1920×1080; the stage takes the
// window's shape so nothing is letterboxed: wider windows get a wider stage (height stays 1080),
// taller ones a taller stage (width stays 1920). Briefing screens stop growing taller at 4:3 and
// letterbox beyond that; the landing screen switches to a 600-px portrait stage on phones.
function fit() {
  const landing = document.body.dataset.landing === '1', ar = innerWidth / innerHeight;
  let W = 1920, H = 1080;
  if (landing && ar < 1) { W = 600; H = Math.round(600 / ar); }
  else if (ar > 16 / 9) W = Math.round(1080 * ar);
  else H = Math.round(1920 / Math.max(ar, landing ? 0 : 4 / 3));
  const changed = stage.offsetWidth !== W || stage.offsetHeight !== H;
  stage.style.width = `${W}px`; stage.style.height = `${H}px`;
  stage.classList.toggle('portrait', landing && ar < 1);
  stage.classList.toggle('short', landing && ar < 1 && H < 960); // e.g. 4:3 tablets held upright
  stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / W, innerHeight / H)})`;
  return changed;
}
// Re-render when the stage shape changes (rotation, window resize), so 3D scenes and live
// previews are rebuilt at the new size. Not while a portal is open full-window.
addEventListener('resize', () => { if (fit() && current && live.hidden) show(seq[app.index], { rebuild: true }); });
fit();
wake();
goStep(0);
requestAnimationFrame(tick);
