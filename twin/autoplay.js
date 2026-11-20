// Injected by server.mjs into the digital-twin viewer it serves on :8081 (never into the files
// on disk, so flood-twin-viewer.exe is untouched). The briefing loads the viewer in the background
// at start-up; once it has booted, this turns buildings on and selects story camera "Path 5",
// then plays it from the top each time the briefing asks (when its twin step comes on screen).
(() => {
  const PATH = 'Path 5';
  const fromBriefing = (e) => { try { return new URL(e.origin).hostname === location.hostname; } catch { return false; } };
  let ready = false, wantPlay = false;

  function play() {
    const cp = window.scene.camPath, p = cp.paths.find((x) => x.name === PATH);
    if (!p) return console.warn(`[ngt] camera path "${PATH}" not found for this site`);
    if (cp.active) cp._stopInternal(false);
    cp.currentId = p.id;
    cp._scrubT = 0;
    cp._play('preview');
  }

  function prepare() {
    const s = window.scene;
    // The saved setting supersamples (2×); a framed preview does not need 4× the pixels.
    s._resMode = 'auto'; s._resize();
    const b = document.getElementById('l-bld');
    if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); }
    ready = true;
    parent.postMessage({ ngt: 'twin-ready' }, '*');
    if (wantPlay) play();
  }

  addEventListener('message', (e) => {
    if (!fromBriefing(e) || !e.data || e.data.ngt !== 'twin-play') return;
    if (ready) play(); else wantPlay = true;
  });

  const wait = setInterval(() => {
    if (window.scene && window.scene.camPath && window.scene.camPath.paths && !document.getElementById('boot')) { clearInterval(wait); prepare(); }
  }, 250);
})();
