// One render function per stage of the hierarchy. Each returns an HTML string;
// navigation is declared with data-go='{route}' and handled centrally in main.js.
// 3D scenes are declared with data-hero="<kind>" and mounted by main.js (js/three/kit.js).
import { institution, vision, wings, portals } from './config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isTbs = (s) => String(s).startsWith('[To be supplied');
const txt = (s) => (isTbs(s) ? `<span class="tbs">${esc(s)}</span>` : esc(s));
const go = (route) => `data-go="${esc(JSON.stringify(route))}"`;
const r = (i) => `class="reveal" style="--i:${i}"`;
const wingOf = (id) => wings.find((w) => w.id === id);
const portalOf = (id) => portals.find((p) => p.id === id);
const portalsOf = (wingId) => portals.filter((p) => p.wing === wingId);
const badge = (label) => `<span class="badge">${esc(label)}</span>`;
const list = (items) => (items.every(isTbs) ? txt(items[0]) : items.map(txt).join(' · '));
const NGT_PALETTE = ['#3FD4FF', '#3B7BFF', '#8B5CFF'];
const pal = ([a, b, c]) => `--c1:${a};--c2:${b};--c3:${c}`;
const TBS_LINK = '[To be supplied: portal URL]';

const logo = (inst, cls = '') => inst.logo
  ? `<img class="logo ${cls}" src="${esc(inst.logo)}" alt="${esc(inst.short)} logo">`
  : `<div class="logo logo-ph ${cls}" role="img" aria-label="${esc(inst.short)} logo placeholder"><span>${esc(inst.short)}</span></div>`;

/** A 3D scene slot. Story mode shows the stage legend; ambient mode is a settled, drifting backdrop. */
function scene(kind, { mode = 'ambient', variant, cls = '', label = '', stages, legend, ramp } = {}) {
  const legendHtml = stages ? `
    <span class="hero-note">Illustrative visualisation</span>
    <div class="hero-legend">
      <ol class="pipeline">${stages.map((s, i) => `<li data-stage="${i}"><button>${esc(s)}</button></li>`).join('')}</ol>
      ${legend ? `<div class="ramp"><span>${esc(legend)}</span><i style="background:linear-gradient(90deg,${(ramp || []).join(',')})"></i><small><b>Lower</b><b>Higher</b></small></div>` : ''}
    </div>` : '';
  return `<div class="hero ${cls}" data-hero="${kind}" data-mode="${mode}" ${variant ? `data-variant="${variant}"` : ''}>
    <canvas role="img" aria-label="${esc(label || `Illustrative 3D visualisation${stages ? `: ${stages.join(', ')}` : ''}`)}"></canvas>
    <div class="hero-labels" aria-hidden="true"></div>${legendHtml}
  </div>`;
}

const ICON = {
  purpose: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/>',
  capabilities: '<path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>',
  technologies: '<path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4l8-4.6Z"/><path d="M12 12 20 7.4M12 12v9.2M12 12 4 7.4"/>',
  vision: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  objectives: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
};
const icon = (k) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const titleGrad = (t) => { const w = t.split(' '), last = w.pop(); return `${esc(w.join(' '))} <span class="grad">${esc(last)}</span>`; };

const openingView = (phase) => `
    <section class="view v-open" data-opening data-phase="${phase}" data-design="v2" style="${pal(NGT_PALETTE)}">
      <div class="open-bg"><canvas role="img" aria-label="Holographic map of Pakistan"></canvas></div>
      <div class="open-labels" aria-hidden="true"></div>
      <div class="open-vignette" aria-hidden="true"></div>
      <div class="open-ndma-dock" aria-hidden="true"></div>
      <div class="open-ndma-dock-label">
        <b>${esc(institution.ndma.short)}</b>
        <span>${esc(institution.ndma.name)}</span>
      </div>
      <div class="open-ndma-logo">${logo(institution.ndma, 'logo-xl')}</div>
      <div class="open-ndma-copy">
        <div class="open-rule"></div>
        <h1 class="open-name">${esc(institution.ndma.name)}</h1>
        <p class="open-abbr">${esc(institution.ndma.short)}</p>
      </div>
      <div class="open-ngt-stage">
        <div class="open-ngt-logo">${logo(institution.ngt, 'logo-xl')}</div>
        <div class="open-rule ngt-rule"></div>
        <h1 class="open-name big open-ngt-name">${titleGrad(institution.ngt.name)}</h1>
        <p class="open-sub open-ngt-sub">Powered by <b>${esc(institution.ndma.short)}</b></p>
      </div>
    </section>`;

export const views = {
  ndma: () => openingView('ndma'),
  ngt: () => openingView('ngt'),

  // Vision: ONE persistent 3D/WebGL world (js/three/vision.js) with six sequential content states.
  vision: ({ scene: i }) => {
    const s = vision.scenes[i], n = vision.scenes.length;
    return `
    <section class="view v-vision" data-vision data-scene="${i}" data-design="v2" style="${pal(NGT_PALETTE)}">
      <div class="v-bg"><canvas role="img" aria-label="NGT Vision 3D visualisation"></canvas></div>
      <div class="shade"></div>
      <header class="v-meta">
        <span class="kicker-sm">Vision of NGT</span>
        <span class="count">${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}</span>
        <nav class="v-dots" aria-label="Vision chapters">
          ${vision.scenes.map((sc, k) => `<button class="${k === i ? 'on' : k < i ? 'done' : ''}" ${go({ view: 'vision', scene: k })} aria-label="${esc(sc.kicker)}" title="${esc(sc.kicker)}"></button>`).join('')}
        </nav>
        ${vision.draft ? badge('Draft statement') : ''}
      </header>
      <div class="statement">
        <div class="kicker">${esc(s.kicker)}</div>
        <h2 class="headline"></h2>
        <div class="finale-wings" ${s.finale ? '' : 'inert'}>${wings.map((w) => `<button class="finale-wing" style="${pal(w.palette)}" ${go({ view: 'wing', wing: w.id })}><b>Pillar ${w.number}</b>${esc(w.name)}</button>`).join('')}</div>
      </div>
    </section>`;
  },

  // Landing: the three pillars as an exhibition. Pillar data (accent, holo, tagline, palette)
  // comes from config.wings; 3D + GSAP choreography live in js/three/landing.js.
  // Clicking or advancing to any pillar plays its brief in-place while its 3D scene stays live.
  wings: ({ focus, brief } = {}) => {
    const chars = (s) => s.split(' ').map((w) => `<span class="wd">${[...w].map((c) => `<span class="ch">${esc(c)}</span>`).join('')}</span>`).join(' ');
    return `
    <section class="view v-landing ${focus && !brief ? 'has-focus' : ''} ${brief ? 'has-brief' : ''}" data-landing ${brief ? `data-brief="${esc(brief)}"` : ''}>
      <div class="l-room" aria-hidden="true">
        <div class="l-bg"><canvas></canvas></div>
        <div class="l-floor"></div>
      </div>
      <header class="l-head">
        <span class="l-eyebrow">NGT Technological Pillars</span>
        <h2 class="l-title">${chars('Three Pillars.')} <span class="l-accent">${chars('One Technological Vision.')}</span></h2>
      </header>
      <div class="l-cards" ${brief ? 'inert' : ''}>
        ${wings.map((w) => { const n = portalsOf(w.id).length; return `
        <button class="lcard ${focus === w.id && !brief ? 'focus' : ''} ${brief === w.id ? 'is-active' : ''}" style="${pal(w.palette)};--a:${w.accent}" data-wing="${w.id}" data-holo="${w.holo}" data-colors="${w.palette.join(',')}" data-count="${n}" ${go({ view: 'wing', wing: w.id })}>
          <div class="lc-holo"><canvas role="img" aria-label="${esc(w.name)} visualisation"></canvas></div>
          <div class="lc-plat">
            <div class="lc-body">
              <span class="lc-num">Pillar ${w.number}</span>
              <h3>${esc(w.name)}</h3>
              <div class="lc-swap"><p class="lc-desc">${esc(w.tagline)}</p><p class="lc-more">${w.capabilities.map(esc).join(' · ')}</p></div>
              <span class="lc-rule"></span>
              <span class="lc-go">Projects<i><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></i></span>
            </div>
          </div>
          <div class="lc-floor" aria-hidden="true"></div>
        </button>`; }).join('')}
      </div>
      ${wings.map((w) => { const capSide = w.id === 'ss' ? 'right' : 'left', briefSide = w.id === 'ss' ? 'left' : 'right', open = brief === w.id; return `
      <div class="lb-caption" data-caption-wing="${w.id}" data-side="${capSide}" style="${pal(w.palette)};--a:${w.accent}" aria-hidden="true">
        <span>Pillar ${w.number}</span><b>${esc(w.short)}</b>
      </div>
      <div class="l-brief ${open ? 'open' : ''}" data-brief-wing="${w.id}" data-side="${briefSide}" style="${pal(w.palette)};--a:${w.accent}" ${open ? '' : 'inert'}>
        <div class="lb-panel">
          <div class="lb-top lb-anim">
            <span class="chip">Pillar ${w.number}</span>
            <button class="lb-back" ${go({ view: 'wings' })}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
              All three pillars
            </button>
          </div>
          <h1 class="title lb-title lb-anim">${titleGrad(w.name)}</h1>
          <p class="lead lb-lead lb-anim">${txt(w.intro)}</p>
          <div class="rule-c lb-anim"></div>
          <dl class="facts lb-facts">
            <div class="lb-anim">${icon('vision')}<dt>Vision</dt><dd>${txt(w.vision)}</dd></div>
            <div class="lb-anim">${icon('objectives')}<dt>Objectives</dt><dd>${list(w.objectives)}</dd></div>
            <div class="lb-anim">${icon('capabilities')}<dt>Technological capabilities</dt><dd class="lb-tags">${w.capabilities.map((c) => `<span>${esc(c)}</span>`).join('')}</dd></div>
          </dl>
          <div class="actions lb-anim">
            <button class="cta-btn" ${go({ view: 'portals', wing: w.id })}>View portals <span aria-hidden="true">›</span></button>
            <button class="text-link" ${go({ view: 'wings' })}>All pillars</button>
          </div>
        </div>
      </div>`; }).join('')}
    </section>`;
  },

  wing: ({ wing }) => {
    const w = wingOf(wing);
    return `
    <section class="view v-wing" data-design="v2" style="${pal(w.palette)}">
      ${scene(w.hero, { cls: 'hero-right', label: `${w.name} illustration` })}
      <div class="info">
        <span class="chip" ${r(0)}>Pillar ${w.number}</span>
        <h1 class="title" ${r(1)}>${titleGrad(w.name)}</h1>
        <p class="lead" ${r(2)}>${txt(w.intro)}</p>
        <div class="rule-c" ${r(3)}></div>
        <dl class="facts">
          <div ${r(3)}>${icon('vision')}<dt>Vision</dt><dd>${txt(w.vision)}</dd></div>
          <div ${r(4)}>${icon('objectives')}<dt>Objectives</dt><dd>${list(w.objectives)}</dd></div>
          <div ${r(5)}>${icon('capabilities')}<dt>Technological capabilities</dt><dd>${w.capabilities.map(esc).join(' · ')}</dd></div>
        </dl>
        <div class="actions" ${r(6)}>
          <button class="cta-btn" ${go({ view: 'portals', wing })}>View portals <span aria-hidden="true">›</span></button>
          <button class="text-link" ${go({ view: 'wings' })}>All pillars</button>
        </div>
      </div>
    </section>`;
  },

  portals: ({ wing }) => {
    const w = wingOf(wing), items = portalsOf(wing);
    return `
    <section class="view v-portals" data-design="v2" style="${pal(w.palette)}">
      <header class="section-head row">
        <div>
          <span class="chip" ${r(0)}>Pillar ${w.number} · ${esc(w.name)}</span>
          <h2 class="display" ${r(1)}>Project <span class="grad">portals</span></h2>
        </div>
        <nav class="head-links">
          <button class="text-link" ${go({ view: 'wing', wing })}>Pillar briefing</button>
          <button class="text-link" ${go({ view: 'wings' })}>All pillars</button>
        </nav>
      </header>
      <div class="portal-grid n${Math.min(items.length, 8)}">
        ${items.map((p, i) => `
        <button class="portal-card tilt" style="--i:${i + 2}" ${go({ view: 'portal', wing, portal: p.id })}>
          <div class="pc-thumb">${p.media.thumbnail
            ? `<img class="ready" src="${esc(p.media.thumbnail)}" alt="" loading="lazy">`
            : `<img alt="" data-snap="${p.hero.kind}:${p.hero.variant || ''}">`}</div>
          <div class="pc-body">
            <span class="meta-sm">${p.type === 'exe' ? 'Windows application' : 'Web portal'}</span>
            <h3>${esc(p.title)}</h3>
            <p>${txt(p.subtitle)}</p>
            ${p.draft ? badge('Placeholder entry') : ''}
          </div>
        </button>`).join('')}
      </div>
    </section>`;
  },

  portal: ({ wing, portal }) => {
    const w = wingOf(wing), p = portalOf(portal), h = p.hero;
    const action = p.url
      ? `<button class="cta-btn" data-launch="${esc(p.url)}" data-title="${esc(p.title)}">Launch portal <span aria-hidden="true">›</span></button>`
      : `<span class="pending">${txt(p.type === 'exe' ? '[To be supplied: demonstration video]' : TBS_LINK)}</span>`;
    // Preference: the portal itself (preloaded or live, framed) > a demo video > an illustrative scene.
    const cover = `<button class="live-cover" data-launch="${esc(p.url)}" data-title="${esc(p.title)}" aria-label="Launch ${esc(p.title)}"><span class="live-tag"><i></i>Live portal · click to launch</span></button>`;
    const visual = p.url && p.warm
      ? `<div class="live-panel" data-warm-slot="${esc(p.url)}">${cover}</div>` // main.js lays the preloaded viewer over this
      : p.url && p.preview !== false
      ? `<div class="live-panel" ${p.media.thumbnail ? `data-fallback="${esc(p.media.thumbnail)}"` : ''}><iframe src="${esc(p.url)}" title="${esc(p.title)} live preview" tabindex="-1" loading="lazy"></iframe>${cover}</div>`
      : p.media.video
      ? `<div class="hero hero-right"><video src="${esc(p.media.video)}" ${p.media.poster ? `poster="${esc(p.media.poster)}"` : ''} autoplay muted loop playsinline></video></div>`
      : scene(h.kind, { mode: 'story', variant: h.variant, cls: 'hero-right', stages: h.stages, legend: h.legend, ramp: h.ramp });
    return `
    <section class="view v-portal" data-design="v2" style="${pal(w.palette)}">
      ${visual}
      <div class="info">
        <span class="chip" ${r(0)}>${esc(w.name)}</span>
        <h1 class="title xl" ${r(1)}>${titleGrad(p.title)}</h1>
        <div ${r(1)}>${p.draft ? badge('Placeholder entry') : ''}</div>
        <p class="lead" ${r(2)}>${txt(p.intro)}</p>
        <div class="rule-c" ${r(3)}></div>
        <dl class="facts">
          <div ${r(3)}>${icon('purpose')}<dt>Purpose</dt><dd>${txt(p.purpose)}</dd></div>
          <div ${r(4)}>${icon('capabilities')}<dt>Key capabilities</dt><dd>${list(p.capabilities)}</dd></div>
          <div ${r(5)}>${icon('technologies')}<dt>Technologies</dt><dd>${list(p.technologies)}</dd></div>
        </dl>
        <div class="actions" ${r(6)}>${action}
          <button class="text-link" ${go({ view: 'portals', wing })}>Back to ${esc(w.short)} portals</button>
        </div>
        ${p.linkNote ? `<p class="note">${esc(p.linkNote)}</p>` : ''}
      </div>
    </section>`;
  },
};

// Breadcrumb trail for the persistent header.
export function crumbs(route) {
  const out = [['NGT', { view: 'wings' }]];
  if (route.wing) out.push([wingOf(route.wing).short, { view: 'wing', wing: route.wing }]);
  if (route.view === 'portals' || route.view === 'portal') out.push(['Portals', { view: 'portals', wing: route.wing }]);
  if (route.portal) out.push([portalOf(route.portal).title, null]);
  return out.map(([label, rt]) => (rt ? `<button class="link" ${go(rt)}>${esc(label)}</button>` : `<span>${esc(label)}</span>`)).join('<i>/</i>');
}

// Media worth warming up before a step is shown (images/posters only — videos stream on demand).
export function mediaFor(route) {
  const m = route.view === 'vision' ? vision.scenes[route.scene].media
    : route.view === 'wing' ? wingOf(route.wing).media
    : route.view === 'portal' ? portalOf(route.portal).media
    : null;
  return [m?.image, m?.poster, m?.screenshots?.[0]].filter(Boolean);
}
