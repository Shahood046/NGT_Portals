# NGT Unified Institutional Briefing Portal

A cinematic, browser-based institutional briefing that follows one fixed hierarchy:
**NDMA → NGT → Vision → Three Wings → Wing briefing → Portals → Portal briefing.**

## Run

```powershell
npm start
```

Open `http://<this-pc-ip>:8080` from any computer on the network. Ports 8080 (briefing), 8081 (digital-twin viewer) and 8082 (snow-avalanche portal pass-through) must be reachable. Requires Node 18+ and has no dependencies.
To host it elsewhere, serve the `public/` folder from any static web server (IIS, nginx).

- `Space` pauses/resumes, `←` `→` skip, `F` toggles fullscreen, `Home` restarts.
- `npm test` checks the sequence and hierarchy logic.

## Editing content — `public/js/config.js`

Everything lives in one file: institution names and logos, vision statements, wing text and accents, the portal list (taken from `Portal_Team_Data_Register.xlsx`), URLs, media paths and step durations.

- `[To be supplied: …]` text shows on screen as a dashed, italic placeholder.
- `draft: true` / `wingPending: true` show amber badges.
- **Logos:** served from `public/assets/logos/` (copies of the files in `Logos/`); paths are set in `institution`.
- **Media:** add `media: { video, image, poster, thumbnail, screenshots: [] }` to a vision scene, wing or portal. Until media is supplied, a procedural visual (globe, terrain, city, neural or sensors) is drawn instead.
- **Digital-twin EXEs:** EXEs are never launched from the browser. The Islamabad–Rawalpindi twin plays live through its own web viewer. `server.mjs` serves `..\local_app\viewer` **read-only** on port 8081 (change it with `TWIN_DIR` / `TWIN_PORT`). It answers only GET requests, so the viewer's autosave and editor can't write to the files that the running `flood-twin-viewer.exe` uses. The viewer takes ~15 s to boot, so the briefing loads it once at start-up, parked off-screen (`warm: true` in `config.js`). On its step, the same viewer is laid over the panel already running story camera "Path 5" with buildings on, and Launch enlarges it without reloading. That behaviour comes from `twin/autoplay.js`, which `server.mjs` adds to the viewer's page as it is served on 8081. The viewer's files on disk are never changed. Twins without a viewer use a demo `video` and `screenshots`.
- **Web portals:** with a `url`, the portal runs live inside the briefing. A scaled live preview appears in the briefing, and **Launch portal** opens it full-window with a "Back to briefing" bar. A portal must not send `X-Frame-Options` or a CSP `frame-ancestors` rule that blocks framing. The snow-avalanche portal (`172.18.61.6:5000`) sends `X-Frame-Options: SAMEORIGIN`. `server.mjs` therefore relays it unchanged on port 8082, dropping only that header (see `FRAME_PROXIES`). Use the same approach for any other portal that blocks framing.

## Landing screen (three wings)

Exhibition design in `js/three/landing.js` + the `Landing` section of `css/main.css`. A large Earth rises behind a Himalayan horizon above a dark contoured floor. Each wing stands on a glass platform with its own 3D visual: a digital-twin city, a computational core, or a sensing terrain. The visual, colours and tagline come from `accent`, `holo`, `palette` and `tagline` in `config.wings`, and project counts are computed from the portal list. GSAP drives the entrance and the hover lift. Clicking a wing dollies the camera in before the wing briefing opens. It is the only responsive screen: the stage grows on taller screens and switches to stacked rows on phones.

Third-party assets (all local in `public/vendor`, no internet needed):
- `three.module.js` — three.js r160 (MIT)
- `gsap.min.js` — GSAP 3.12.5 (GreenSock standard licence, free to use)
- `earth_atmos_2048.jpg` — Earth texture from the three.js examples (NASA Blue Marble–derived)
- Ported techniques from [Spatial HUD](https://github.com/nitishhansa1/spatial-hud) (MIT, © Nitish): GPU particle core, grid floor with scan line, glass panel styling

## Architecture

```
public/
  index.html        shell: 1920×1080 stage, top bar, control bar
  css/main.css      design tokens + all stage layouts
  js/config.js      ALL content, media, URLs, timings
  js/sequence.js    hierarchy → flat presentation sequence (pure, tested)
  js/views.js       one render function per stage
  js/visuals.js     procedural canvas placeholders
  js/main.js        state, clock, navigation, controls
server.mjs          zero-dependency static server with video range support
```

**Rendering.** The whole UI is designed at 1920×1080 and letterbox-scaled to fit any screen. Each navigation renders a new view and cross-fades it in. After the fade, the outgoing view is torn down: animation loops are cancelled, canvas memory is freed, videos are unloaded and the DOM node is removed. Only one view stays mounted, so the presentation can loop indefinitely without memory building up.

**Media loading.** Media loads only when its view is mounted. The next step's images and posters are warmed in advance. Videos stream on demand.

### How automated and interactive modes coexist

- The presentation is a flat list of steps built from the hierarchy. Every screen a visitor can reach is also a step.
- `index` always points at the step being shown. One clock adds up the elapsed time and advances the step only while `playing` is on. Speed is a multiplier on the configured durations.
- **Any pointer interaction with the content** pauses playback *before* the click is handled, and switches the mode to *Exploring*. An automatic transition can never land on a visitor mid-exploration.
- Exploring sets `index` to the visitor's current screen, so **Resume** continues the narrative from there. Prev/Next and the chapter bar move through the sequence and don't change play/pause.
