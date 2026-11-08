/* YouTube IFrame API wrapper for the watch page and TV mode.
   Uses the privacy-enhanced youtube-nocookie.com host; falls back to a plain
   iframe if the API script is blocked (e.g. by an ad blocker). */

let ready = null;
function load() {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(true);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(true); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
    setTimeout(() => resolve(!!(window.YT && window.YT.Player)), 8000);
  });
  return ready;
}

const noop = () => {};
const inert = { seek: noop, rel: noop, toggle: noop, mute: noop, frac: noop, time: () => 0, load: noop, destroy: noop };

/* Each mount owns one node inside `el` and destroy() removes only that node, so a
   stale mount finishing late can never wipe the player that replaced it. */
function fallback(el, host, id, start) {
  const frame = document.createElement("iframe");
  const src = (vid, s) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?autoplay=1&rel=0&start=${parseInt(s, 10) || 0}`;
  frame.src = src(id, start);
  frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  frame.allowFullscreen = true;
  frame.title = "YouTube video player";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  if (host.isConnected) host.replaceWith(frame); else el.replaceChildren(frame);
  return { ...inert, load(nid, ns) { frame.src = src(nid, ns); }, destroy() { frame.remove(); } };
}

/**
 * mount(el, id, {start, onEnd, onError, signal}) -> controller.
 * Aborting `signal` tears an API player down at any stage (the plain-iframe fallback is removed by
 * destroy()). A newer mount on the same el detaches this one's node; callers still destroy() it.
 * Calls made before the player is ready are queued: load() keeps the latest request.
 */
export async function mount(el, id, opts = {}) {
  const { signal } = opts;
  const host = document.createElement("div");
  el.replaceChildren(host);
  const ok = await load();
  if (signal?.aborted || !host.isConnected) { host.remove(); return inert; }
  if (!ok) return fallback(el, host, id, opts.start);
  let player = null, ready = false, wanted = null, dead = false;
  const kill = () => {
    if (dead) return;
    dead = true;
    let frame = null;
    try { frame = player.getIframe(); } catch { /* not created */ }
    try { player.destroy(); } catch { /* already gone */ }
    if (frame && frame.isConnected) frame.remove();
    if (host.isConnected) host.remove();
  };
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 15000); // stop waiting; calls stay queued until onReady
    const onAbort = () => { kill(); clearTimeout(timer); resolve(); };
    signal?.addEventListener("abort", onAbort, { once: true });
    player = new window.YT.Player(host, {
      videoId: id, host: "https://www.youtube-nocookie.com",
      playerVars: { autoplay: 1, rel: 0, start: parseInt(opts.start, 10) || 0, playsinline: 1, modestbranding: 1 },
      events: {
        onReady: () => {
          ready = true;
          if (wanted && !dead) { try { player.loadVideoById(wanted); } catch { /* player gone */ } }
          wanted = null;
          clearTimeout(timer);
          resolve();
        },
        onStateChange: (e) => { if (e.data === 0 && opts.onEnd && !dead) opts.onEnd(); },
        onError: (e) => { if (opts.onError && !dead) opts.onError(e.data); clearTimeout(timer); resolve(); },
      },
    });
  });
  if (dead) return inert;
  const safe = (fn) => (...a) => { if (!ready || dead) return undefined; try { return fn(...a); } catch { return undefined; } };
  return {
    seek: safe((sec) => { player.seekTo(sec, true); player.playVideo(); }),
    rel: safe((d) => player.seekTo(Math.max(0, player.getCurrentTime() + d), true)),
    frac: safe((f) => player.seekTo(player.getDuration() * f, true)),
    toggle: safe(() => (player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo())),
    mute: safe(() => (player.isMuted() ? player.unMute() : player.mute())),
    time: () => (ready && !dead ? Math.floor(player.getCurrentTime?.() || 0) : 0),
    load(nid, start) {
      const req = { videoId: nid, startSeconds: parseInt(start, 10) || 0 };
      if (dead) return;
      if (!ready) { wanted = req; return; } // applied by onReady
      try { player.loadVideoById(req); } catch { /* player gone */ }
    },
    destroy: kill,
  };
}
