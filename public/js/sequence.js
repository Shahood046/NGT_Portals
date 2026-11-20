// Builds the automated presentation as a flat list of steps that follows the
// hierarchy NDMA → NGT → Vision → Wings → Wing → Portals → Portal briefing.
// Every screen a visitor can reach interactively is also a step here, so
// "resume" can always continue from wherever the visitor stopped.
import { presentation, vision, wings, portals } from './config.js';

export function buildSequence() {
  const s = [
    { view: 'ndma', chapter: 'Opening' },
    { view: 'ngt', chapter: 'Opening' },
  ];
  vision.scenes.forEach((_, i) => s.push({ view: 'vision', scene: i, chapter: 'Vision' }));
  for (const w of wings) {
    s.push({ view: 'wings', focus: w.id, chapter: w.short }); // re-introduce the overview before each wing
    s.push({ view: 'wing', wing: w.id, chapter: w.short });
    s.push({ view: 'portals', wing: w.id, chapter: w.short });
    for (const p of portals.filter((p) => p.wing === w.id)) {
      s.push({ view: 'portal', wing: w.id, portal: p.id, chapter: w.short });
    }
  }
  return s;
}

// `focus` is presentation decoration only, so it is ignored when matching routes.
export const sameRoute = (a, b) =>
  a.view === b.view && a.scene === b.scene && a.wing === b.wing && a.portal === b.portal;

export const indexOfRoute = (seq, route) => Math.max(0, seq.findIndex((s) => sameRoute(s, route)));

export const durationOf = (step) =>
  (step.view === 'vision' && vision.scenes[step.scene].duration)
  || (step.view === 'portal' && portals.find((p) => p.id === step.portal).duration)
  || presentation.durations[step.view];

// One level up the hierarchy (used by Back buttons).
export function parentRoute(r) {
  if (r.view === 'portal') return { view: 'portals', wing: r.wing };
  if (r.view === 'portals') return { view: 'wing', wing: r.wing };
  return { view: 'wings' };
}
