/* App shell: catalog boot, sidebar, hash router, keyboard, TV mode. */
import { $, esc } from "./util.js";
import { loadCatalog } from "./catalog.js";
import { createState } from "./state.js";
import { createSearch } from "./search.js";
import { createRecommender } from "./recommend.js";
import { installSearchBox } from "./searchbox.js";
import { installCardMenu, openModal, toast } from "./ui.js";
import { mount } from "./player.js";
import { parseHash, resolveView } from "./router.js";
import { viewHome } from "./views/home.js";
import { viewChannels, viewChannel, viewCourse, viewCourses, viewPath, viewPaths, viewTalks,
  viewTopic, viewTopics, viewVideos } from "./views/browse.js";
import { viewHistory, viewLater, viewLiked, viewSearch } from "./views/library.js";
import { viewWatch } from "./views/watch.js";
import { keysHTML, viewAbout } from "./views/about.js";

const ctx = { cat: null, state: createState(), rerender: () => route(true) };
// The search and recommendation indexes cost ~100 ms each on a laptop; build them on first use.
let searchIndex = null, recommender = null;
Object.defineProperties(ctx, {
  search: { get: () => (searchIndex ??= createSearch(ctx.cat)) },
  rec: { get: () => (recommender ??= createRecommender(ctx.cat)) },
});

const ICON = {
  home: "M4 11.5 12 4l8 7.5M6 10.5V20h12v-9.5",
  library: "M4 6h16M4 12h16M4 18h10",
  course: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 5.5v15",
  path: "M6 4v7a4 4 0 0 0 4 4h8M14 11l4 4-4 4",
  topics: "M4 7h16M4 12h16M4 17h10",
  talks: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  channels: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 8.5a2.5 2.5 0 1 0 0-5M18 14c2.3.4 4 2.4 4 4.8",
  liked: "M12 20s-7-4.4-7-9.3A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.7C19 15.6 12 20 12 20z",
  later: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  history: "M4 12a8 8 0 1 0 3-6.2M4 4v4h4M12 8v4l3 2",
  about: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.1",
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ico"><path d="${ICON[k]}"/></svg>`;

const NAV = [
  [["home", "Home", "#/"], ["library", "Library", "#/videos"], ["course", "Courses", "#/courses"],
    ["path", "Learning paths", "#/paths"], ["topics", "Topics", "#/topics"], ["talks", "Talks", "#/talks"],
    ["channels", "Channels", "#/channels"]],
  [["liked", "Liked", "#/liked"], ["later", "Watch later", "#/later"], ["history", "History", "#/history"]],
  [["about", "About & data", "#/about"]],
];

function renderSide() {
  const { cat, state } = ctx;
  const counts = {
    library: cat.stats.videos.toLocaleString(), course: cat.stats.courses, path: cat.PATHS.length,
    topics: cat.TOPICS.length, talks: cat.stats.talks, channels: cat.stats.channels,
    liked: state.likes.length || "", later: state.later.length || "", history: state.seen.length || "",
  };
  const path = location.hash.replace(/^#/, "").split("?")[0];
  $("#side").innerHTML = NAV.map((group) => `<div class="navgroup">${group.map(([key, label, href]) => {
    const on = href === "#/" ? path === "/" || path === "" : path.startsWith(href.slice(1));
    const n = counts[key];
    return `<a class="navitem${on ? " on" : ""}" href="${href}">${icon(key)}<span>${esc(label)}</span>
      ${n !== "" && n !== undefined ? `<span class="n">${n}</span>` : ""}</a>`;
  }).join("")}</div>`).join("");
}

/* ---------- router ---------- */
let cleanup = null;
function route(force = false) {
  if (!ctx.cat) return;
  const { head, arg, params } = parseHash(location.hash);
  if (cleanup) { cleanup(); cleanup = null; }
  document.body.classList.toggle("watching", head === "watch");
  const views = {
    "": viewHome, home: viewHome, videos: () => viewVideos(ctx, params), courses: viewCourses,
    course: () => viewCourse(ctx, arg), paths: viewPaths, path: () => viewPath(ctx, arg),
    topics: viewTopics, t: () => viewTopic(ctx, arg), talks: viewTalks, channels: viewChannels,
    c: () => viewChannel(ctx, arg), watch: () => viewWatch(ctx, arg, params), liked: viewLiked,
    later: viewLater, history: viewHistory, search: () => viewSearch(ctx, params.get("q") || ""),
    about: viewAbout,
  };
  const fn = resolveView(views, head);
  if (!fn) {
    document.title = "Not found · AItube";
    $("#main").innerHTML = `<div class="empty"><h1>Not found</h1><p>That page doesn't exist.</p>
      <a class="btn primary" href="#/">Back to home</a></div>`;
  } else {
    const out = fn(ctx);
    cleanup = typeof out === "function" ? out : null;
  }
  renderSide();
  if (!force) window.scrollTo(0, 0);
  $("#main").focus({ preventScroll: true });
}

/* ---------- TV mode ---------- */
const TV = { open: false, ctl: null, mounting: null, abort: null, history: [], pos: -1, gen: 0, want: null };
function tvReset() {
  TV.gen++;
  if (TV.abort) TV.abort.abort();
  TV.abort = null;
  TV.mounting = null;
  if (TV.ctl) { TV.ctl.destroy(); TV.ctl = null; }
  $("#tvFrame").replaceChildren();
}
async function tvPlay(v) {
  if (!v) { toast("Nothing left to play. Try another category."); tvClose(); return; }
  $("#tvTitle").textContent = `${v.t} — ${ctx.cat.CH[v.ch].name}`;
  ctx.state.markSeen(v.id);
  TV.want = v.id;
  if (TV.ctl) { TV.ctl.load(v.id, 0); return; }
  if (TV.mounting) return;
  const gen = TV.gen;
  const guard = (fn) => () => { if (TV.gen === gen && TV.open) fn(); };
  TV.abort = new AbortController();
  TV.mounting = mount($("#tvFrame"), v.id, { onEnd: guard(tvNext), onError: guard(tvNext), signal: TV.abort.signal });
  const ctl = await TV.mounting;
  if (TV.gen !== gen || !TV.open) { ctl.destroy(); return; }
  TV.mounting = null;
  TV.ctl = ctl;
  if (TV.want !== v.id) ctl.load(TV.want, 0);
}
function tvNext() {
  if (!TV.open) return;
  if (TV.pos < TV.history.length - 1) { TV.pos++; tvPlay(TV.history[TV.pos]); return; }
  const seen = new Set(TV.history.map((x) => x.id));
  const pool = ctx.cat.V.filter((v) => !v.ne && !ctx.state.hidden.includes(v.id) && !seen.has(v.id)
    && ["S", "A"].includes(ctx.cat.CH[v.ch].tier));
  const v = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  if (v) { TV.history.push(v); TV.pos = TV.history.length - 1; }
  tvPlay(v);
}
function tvPrev() { if (TV.pos > 0) { TV.pos--; tvPlay(TV.history[TV.pos]); } }
function tvOpen(startId) {
  const { head, arg } = parseHash(location.hash);
  if (cleanup) { cleanup(); cleanup = null; }
  tvReset();
  TV.open = true;
  $("#tv").hidden = false;
  document.body.classList.add("tv-on");
  $("#tvExit").focus();
  TV.history = [];
  TV.pos = -1;
  const start = ctx.cat.BY_ID.get(startId || (head === "watch" ? arg : ""));
  if (start && !start.ne) { TV.history.push(start); TV.pos = 0; tvPlay(start); } else tvNext();
}
function tvClose() {
  if (!TV.open) return;
  TV.open = false;
  tvReset();
  $("#tv").hidden = true;
  document.body.classList.remove("tv-on");
  route(true);
}
function tvKey(e) {
  const k = e.key, c = TV.ctl;
  const act = {
    Escape: tvClose, t: tvClose, T: tvClose, n: tvNext, N: tvNext, p: tvPrev, P: tvPrev,
    " ": () => c && c.toggle(), ArrowRight: () => c && c.rel(10), ArrowLeft: () => c && c.rel(-10),
    m: () => c && c.mute(), M: () => c && c.mute(),
  }[k];
  if (act) { e.preventDefault(); act(); }
}

/* ---------- theme ---------- */
function setTheme(t) {
  if (t === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("ait.theme", t); } catch { /* blocked */ }
}
function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
}

/* ---------- keyboard ---------- */
function onKey(e) {
  if (TV.open) return tvKey(e);
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (e.key === "Escape" && document.activeElement === $("#q")) { $("#q").blur(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); $("#q").focus(); $("#q").select(); }
  else if (e.key === "t" || e.key === "T") { e.preventDefault(); tvOpen(); }
  else if (e.key === "?") { e.preventDefault(); openModal(`<h2>Keyboard</h2>${keysHTML()}`, { label: "Keyboard shortcuts" }); }
  else if (e.key === "n" || e.key === "N") { e.preventDefault(); surprise(); }
}

function surprise() {
  const pool = ctx.cat.V.filter((v) => !v.ne && ["S", "A"].includes(ctx.cat.CH[v.ch].tier));
  if (!pool.length) return toast("Nothing to play.");
  const v = pool[Math.floor(Math.random() * pool.length)];
  location.hash = `#/watch/${v.id}`;
}

/* ---------- boot ---------- */
function shellBusy() {
  $("#main").innerHTML = `<div class="home"><section class="hero sk">
    <div class="hero-copy"><div class="l w30"></div><div class="l big"></div><div class="l w60"></div></div></section>
    <div class="vgrid">${Array.from({ length: 8 }, () => `<div class="vcard sk"><div class="vthumb"></div>
      <div class="vbody"><div class="l w80"></div><div class="l w50"></div></div></div>`).join("")}</div></div>`;
}

export async function boot() {
  shellBusy();
  try {
    ctx.cat = await loadCatalog();
  } catch (err) {
    $("#main").innerHTML = `<div class="empty"><h1>Could not load the library</h1>
      <p>${esc(err.message)}</p><button class="btn primary" id="reloadBtn">Reload</button></div>`;
    $("#reloadBtn").onclick = () => location.reload();
    return;
  }
  installSearchBox(ctx);
  installCardMenu(ctx);
  $("#menuBtn").onclick = () => {
    const open = !$("#side").classList.contains("open");
    $("#side").classList.toggle("open", open);
    $("#scrim").hidden = !open;
    $("#menuBtn").setAttribute("aria-expanded", String(open));
  };
  $("#scrim").onclick = () => { $("#side").classList.remove("open"); $("#scrim").hidden = true; };
  $("#themeBtn").onclick = toggleTheme;
  $("#helpBtn").onclick = () => openModal(`<h2>Keyboard</h2>${keysHTML()}`, { label: "Keyboard shortcuts" });
  $("#luckyBtn").onclick = surprise;
  $("#tvBtn").onclick = () => tvOpen();
  $("#tvNext").onclick = tvNext;
  $("#tvExit").onclick = tvClose;
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", () => route(false));
  ctx.state.onChange((k) => { if (k === "likes" || k === "later" || k === "seen") renderSide(); });
  route(true);
  document.documentElement.classList.add("ready");
}

boot();
export { ctx };
