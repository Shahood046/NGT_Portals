// ─────────────────────────────────────────────────────────────────────────────
// NGT Briefing Portal — CENTRAL CONFIGURATION
// All content, media paths, URLs and presentation timings live here.
// Anything wrapped in TBS(...) or flagged `draft: true` is a placeholder and
// must be replaced with approved material. Media paths are relative to /public.
//
// Media slot shape (any field optional):
//   { video: 'assets/x.mp4', image: 'assets/x.jpg', poster: 'assets/x.jpg' }
// When no media is supplied, a procedural visual (`visual`) is shown instead.
// ─────────────────────────────────────────────────────────────────────────────

export const TBS = (what) => `[To be supplied: ${what}]`;

export const presentation = {
  // Seconds each step stays on screen in automated mode (before speed multiplier).
  durations: { ndma: 3.5, ngt: 8.5, vision: 6.5, wings: 7, wing: 12, portals: 8, portal: 12 },
  speeds: [0.5, 0.75, 1, 1.5, 2],
  loop: true,
  hideControlsAfter: 3, // seconds of pointer inactivity while presenting
};

export const institution = {
  ndma: { short: 'NDMA', name: 'National Disaster Management Authority', logo: 'assets/logos/ndma.png' },
  ngt:  { short: 'NGT',  name: 'Next Generation Technologies', logo: 'assets/logos/ngt.jpeg' },
};

// Vision showreel. Statements are TEMPORARY drafts until the approved vision is supplied.
export const vision = {
  draft: true,
  scenes: [
    // `hero` = the 3D scene (js/three/heroes/<kind>.js) shown full-bleed behind the statement
    { kicker: 'Earth observation',  statement: 'Every decision begins with seeing clearly.',     hero: 'relief',      media: null },
    { kicker: 'Geospatial intelligence', statement: 'From orbit to street level, one living picture.', hero: 'downscale', media: null },
    { kicker: 'Digital twins',      statement: 'Digital twins of the places we protect.',         hero: 'city',        media: null },
    { kicker: 'Artificial intelligence', statement: 'Intelligence that anticipates, not just reacts.', hero: 'multihazard', media: null },
    { kicker: 'Smart sensing',      statement: 'Sensing the world as it changes.',                hero: 'river',       media: null },
    { kicker: 'Decision support',   statement: 'Three pillars. One vision.',                       hero: 'relief',      media: null, finale: true },
  ],
};

// Focus areas are taken from the design brief. Intro lines are drafts built from those
// focus areas; vision and objectives are left for NGT to supply.
export const wings = [
  {
    id: 'ai', number: '01', short: 'AI & ML',
    name: 'Artificial Intelligence & Machine Learning',
    hero: 'multihazard', media: null,
    palette: ['#8B5CFF', '#E04FD6', '#3B82FF'], // violet, magenta, electric blue
    accent: '#A35CFF', holo: 'core',
    tagline: 'AI-driven analysis, predictive modelling and intelligent automation.',
    intro: 'AI-driven analysis, predictive modelling and intelligent automation — turning data into intelligence.',
    vision: TBS('pillar vision statement'),
    objectives: [TBS('objective 1'), TBS('objective 2'), TBS('objective 3')],
    capabilities: ['AI-driven analysis', 'Predictive modelling', 'Intelligent automation', 'Machine learning', 'Data intelligence'],
  },
  {
    id: 'dw', number: '02', short: 'Digital World',
    name: 'Digital World & Immersive Technologies',
    hero: 'city', media: null,
    palette: ['#3FD4FF', '#3B7BFF', '#8B5CFF'], // cyan, blue, violet
    accent: '#3B9BFF', holo: 'city', // landing screen: edge/glow colour and 3D visual
    tagline: 'Digital Earth, 3D city environments and digital twins.',
    intro: 'Digital Earth, 3D city environments and digital twins — geospatial intelligence delivered through virtual and immersive environments.',
    vision: TBS('pillar vision statement'),
    objectives: [TBS('objective 1'), TBS('objective 2'), TBS('objective 3')],
    capabilities: ['Digital Earth', '3D city environments', 'Digital twins', 'Geospatial intelligence', 'Virtual & immersive environments'],
  },
  {
    id: 'ss', number: '03', short: 'Smart Sensing',
    name: 'Smart Sensing',
    hero: 'river', media: null,
    palette: ['#2FD3E0', '#3DDC97', '#FFB547'], // cyan, green, amber
    accent: '#2FE0B4', holo: 'sensing',
    tagline: 'Sensor networks, remote and environmental monitoring.',
    intro: 'Sensor networks, remote and environmental monitoring — real-time data acquisition and measurement systems.',
    vision: TBS('pillar vision statement'),
    objectives: [TBS('objective 1'), TBS('objective 2'), TBS('objective 3')],
    capabilities: ['Sensor networks', 'Remote monitoring', 'Environmental sensing', 'Real-time data acquisition', 'Monitoring & measurement'],
  },
];

// Portals — source: Portal_Team_Data_Register.xlsx (Portal Register sheet).
// Intro and capability text is taken from the register's "Script of Portal" column;
// anything the register does not provide is TBS(...).
// type: 'exe' (standalone Windows app → demo video + screenshots) or 'web'
// (independently hosted → runs live inside the briefing in an embedded frame; the
// portal must not send X-Frame-Options / CSP frame-ancestors that forbid this).
// URLs are internal network addresses, so the briefing must be opened on that network.
// Card thumbnails: each portal's real home page, from screenshots/ resized to 720 px JPEGs
// (~50 KB each) in assets/thumbs/<id>.jpg. Portals without one show their 3D illustration.
const THUMBS = new Set(['glof', 'twin-cities', 'flood-impact', 'avalanche', 'e-mhvra', 'nci', 'pcop', 'climate-downscaling', 'intelliresponse']);
const portal = (id, wing, type, title, seed, extra = {}) => ({
  id, wing, type, title, seed,
  subtitle: TBS('short identifying subtitle'),
  intro: TBS('two-to-three-line introduction'),
  purpose: TBS('purpose and the problem being addressed'),
  capabilities: [TBS('major capabilities')],
  technologies: [TBS('relevant technologies')],
  url: null,
  media: { thumbnail: THUMBS.has(id) ? `assets/thumbs/${id}.jpg` : null, video: null, poster: null, screenshots: [] },
  ...extra,
});

// Each project's 3D scene: `kind` = js/three/heroes/<kind>.js; `stages` label the scene's own
// narrative (what the visual shows, not claims about the project); `legend` + `ramp` explain
// its colour scale. All scenes are illustrative and marked so on screen.
const hero = (kind, stages, legend, ramp, variant) => ({ kind, stages, legend, ramp, variant });
const RISK = ['#6d4dff', '#e04fd6', '#ffb547'], WATER = ['#2d6bff', '#49c6ff', '#e9fbff'];

export const portals = [
  // ── Artificial Intelligence & Machine Learning
  portal('glof', 'ai', 'web', 'Pakistan Glacial Lakes AI Portal', 21, {
    url: 'http://172.18.61.76:8000/',
    subtitle: 'Glacial lake outburst flood risk and monitoring',
    intro: 'A glacial lakes AI portal that finds lakes and assesses GLOF risk, with live weather, flood paths and the villages and infrastructure at risk — and a built-in offline AI assistant.',
    capabilities: ['Simulated digital twin of GLOF', 'Predictive analysis to 2035', 'Glacial mass, ice melt & snow cover', 'Forest cover', 'Daily AI monitoring of all glacial lakes'],
    hero: hero('glacier', ['Glacier', 'Glacial lake', 'Monitoring', 'Outburst simulation', 'Exposure'], 'Outburst flood path', WATER),
  }),
  portal('flood-impact', 'ai', 'web', 'Flood Impact Warning', 22, { // pillar blank in register; confirmed AI/ML
    url: 'http://172.18.0.15:5173/',
    hero: hero('river', ['Catchment', 'Rainfall', 'River response', 'Inundation', 'Impact'], 'Exposed buildings', RISK, 'impact'),
  }),
  portal('avalanche', 'ai', 'web', 'Snow Avalanche Prediction Using AI', 23, {
    // Real portal: http://172.18.61.6:5000/ — it sends X-Frame-Options: SAMEORIGIN, so it is shown
    // through server.mjs's pass-through port 8082, which drops only that header.
    url: `http://${globalThis.location?.hostname || 'localhost'}:8082/`,
    hero: hero('avalanche', ['Terrain', 'Snowpack', 'Environmental data', 'AI analysis', 'Prediction'], 'Relative release likelihood', RISK),
  }),
  // Temporarily commented out (no active portal URL yet):
  // portal('heatwave', 'ai', 'web', 'Pakistan Heatwave Forecast', 24, {
  //   hero: hero('heat', ['Terrain', 'Weather stations', 'Forecast field', 'Hotspots'], 'Forecast temperature', ['#3b82ff', '#ffb547', '#ff4d4d']),
  // }),
  portal('e-mhvra', 'ai', 'web', 'Agentic E-MHVRA', 25, {
    url: 'http://172.18.61.105:8095/',
    subtitle: 'AI-powered multi-hazard risk assessment',
    intro: 'Transforms Pakistan’s existing MHVRA into an AI-powered system where users can request risk assessments in English or Urdu.',
    purpose: 'Delivers risk assessments with minimal manual intervention.',
    capabilities: ['Requests in English or Urdu', 'Automated GIS analysis', 'Hazard & exposed-infrastructure visualisation', 'Interactive voice briefings on risks and impacts'],
    hero: hero('multihazard', ['Area of interest', 'Hazard layers', 'Exposure', 'Risk assessment'], 'Combined risk', RISK),
  }),
  portal('nci', 'ai', 'web', 'National Climate Intelligence', 26, {
    url: 'http://172.18.61.11:8080/',
    subtitle: 'District-level rainfall intelligence',
    intro: 'Monthly, seasonal and annual rainfall for 169 districts of Pakistan.',
    hero: hero('columns', ['Districts', 'Monthly', 'Seasonal', 'Annual'], 'Rainfall', ['#3b82ff', '#8b5cff', '#e04fd6']),
  }),
  portal('pcop', 'ai', 'web', 'Coastal Intelligence — PCOP', 27, {
    url: 'http://172.18.61.44:5173/',
    subtitle: 'Pakistan’s Coastal Observation Projections',
    intro: 'Pakistan’s Coastal Observation Projections (PCOP) of hazards affecting the coastal area of Pakistan, from 1995 to the present day and on to 2100.',
    capabilities: ['Coastal hazard observations, 1995 – present', 'Projections to 2100', 'Chatbot for questions on coastal hazards and ongoing events'],
    linkNote: 'Works only on the same network.',
    hero: hero('coast', ['Coastline', '1995 baseline', 'Present day', '2100 projection'], 'Low-lying hazard band', RISK),
  }),
  // Temporarily commented out (no active portal URL yet):
  // portal('floodguard', 'ai', 'web', 'FloodGuard Intelligence Portal', 28, {
  //   subtitle: 'National flood early-warning and command portal',
  //   intro: 'A national flood early-warning and command portal for Pakistan, combining live river gauges, rainfall, catchment and district risk on an interactive 2D/3D map with AI flood forecasts and simulations.',
  //   capabilities: ['Live river gauges', 'Rainfall, catchment & district risk', 'Interactive 2D/3D map', 'AI flood forecasts & simulations'],
  //   hero: hero('river', ['Catchment', 'River gauges', 'Rainfall', 'AI forecast', 'Inundation'], 'Forecast flood depth', ['#49c6ff', '#3b6dff', '#8b5cff']),
  // }),

  // ── Digital World & Immersive Technologies
  portal('twin-cities', 'dw', 'exe', 'Islamabad–Rawalpindi Digital Twin', 11, {
    // The EXE's web viewer, served read-only by server.mjs on :8081 from the same host as this briefing.
    // nullahlai = Rawalpindi site; sites.json's "twincity" entry has no data folder on disk yet.
    url: `http://${globalThis.location?.hostname || 'localhost'}:8081/index.html?site=nullahlai`,
    // The viewer takes ~15 s to boot, so it is pre-warmed once the presentation enters AI & ML's
    // portals (or immediately if Digital World is opened directly) and kept alive; its step shows
    // it already running story camera "Path 5" with buildings on (driven by twin/autoplay.js).
    warm: true,
    subtitle: 'Immersive virtual representation of the twin cities',
    intro: 'An immersive virtual representation of the twin cities, integrating geospatial data and 3D urban environments.',
    purpose: 'Supports informed planning, analysis and decision-making for the twin cities.',
    capabilities: ['Visualisation of urban infrastructure', 'Spatial relationships', 'Development scenarios', 'Geospatial data integration'],
    hero: hero('city', ['Terrain', 'Urban fabric', 'Infrastructure', 'Flood scenario', 'Exposure'], 'Exposed buildings', RISK),
  }),
  // Temporarily commented out (no active portal URL yet):
  // portal('dt-2', 'dw', 'exe', 'Second Digital Twin Project', 12, { // in the brief, not yet in the register
  //   draft: true, hero: hero('city', ['Terrain', 'Urban fabric', 'Infrastructure', 'Scenario', 'Exposure'], 'Exposed buildings', RISK, 'b'),
  // }),

  // ── Smart Sensing
  portal('climate-downscaling', 'ss', 'web', 'Climate Downscaling Portal', 31, {
    url: 'http://172.18.61.113:8000/',
    subtitle: 'Downscaled CMIP6 climate projections for Pakistan',
    intro: 'Compares observed climate with raw and downscaled CMIP6 projections (about 5 km) of rainfall and temperature under four SSP scenarios to 2100.',
    capabilities: ['Observed vs raw vs downscaled CMIP6', '~5 km resolution', 'Rainfall & temperature', 'Four SSP scenarios to 2100'],
    hero: hero('downscale', ['Observed', 'Raw CMIP6', 'Downscaled ~5 km', 'SSP scenarios'], 'Projected change', ['#2fd3e0', '#3ddc97', '#ffb547']),
  }),
  portal('intelliresponse', 'ss', 'web', 'IntelliResponse', 32, {
    url: 'http://172.18.61.110:3000/',
    subtitle: 'National Disaster Coordination Portal',
    intro: 'A unified National Disaster Coordination Portal connecting NDMA, PDMAs and DDMAs — enabling coordinated disaster response from national to district level.',
    capabilities: ['Real-time communication', 'Centralised disaster monitoring', 'Interactive GIS layers', 'Incident management', 'Evacuation & rescue planning'],
    hero: hero('multihazard', ['Area of interest', 'Hazard layers', 'Exposure', 'Risk assessment'], 'Combined risk', RISK),
  }),
];
