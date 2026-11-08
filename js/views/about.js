/* About: what this is, how videos are chosen, what it stores, credits. */
import { $, esc } from "../util.js";
import { toast } from "../ui.js";

export const KEYS = [["/", "Focus search"], ["Esc", "Close search, menu or dialog"], ["T", "TV mode"],
  ["N", "Surprise me: a random top-tier video"], ["?", "This list"]];

export function keysHTML() {
  return `<dl class="keys">${KEYS.map(([k, v]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
}

export function viewAbout(ctx) {
  const { cat, state } = ctx;
  const s = cat.stats;
  document.title = "About · AItube";
  $("#main").innerHTML = `<article class="prose">
    <h1>About AItube</h1>
    <p class="lede">A small, hand-built library of the best AI education on YouTube — courses, lectures,
      talks and explainers — with a written reason for every video.</p>

    <h2>It is curated, not crawled</h2>
    <p>${s.videos.toLocaleString()} videos from ${s.channels} channels. A channel earns its place first: every one is
      tiered from S (masterpieces) to C (worth following) and carries a reason. Then only its AI-related uploads are
      considered — no vlogs, no news, no reaction videos, no tool launch streams. ${s.courses} full courses and
      ${s.paths - s.courses} learning paths are ordered lecture by lecture, and ${s.talks} talks were collected from years
      of Hacker News threads, where practitioners recommend what is actually worth an hour.</p>
    <p>Nothing here is an automatic feed. A video that cannot state why it belongs is not in the library.</p>

    <h2>What you will not find</h2>
    <ul>
      <li>AI news, hype, “this changes everything” commentary or tool launch videos.</li>
      <li>Sponsored content, clickbait or auto-generated summaries.</li>
      <li>Recommendations tuned for watch time. The home page shows what is good, not what is sticky.</li>
    </ul>

    <h2>How it works</h2>
    <p>AItube is a static site. There is no account, no server and no analytics. Search runs in your browser, the
      recommender runs in your browser, and your likes, history and watch-later list live in
      <code>localStorage</code> on this device. Nothing is sent anywhere except the YouTube embed itself.</p>
    <p>${s.youtube_only} videos are marked <b>YouTube only</b>: their owners disabled playback on other sites.
      They open on youtube.com and still count for course progress. Videos occasionally disappear from YouTube;
      they are removed from the library when that happens.</p>

    <h2>Your data</h2>
    <div class="datarow">
      <button class="btn" id="exportData">Export my data</button>
      <label class="btn ghost fileBtn">Import data<input type="file" id="importData" accept="application/json" hidden></label>
      <button class="btn ghost" id="clearData">Erase everything</button>
    </div>
    <p class="muted">${state.likes.length} liked · ${state.later.length} in Watch later · ${state.seen.length} watched ·
      ${state.hidden.length} hidden</p>

    <h2>Keyboard</h2>
    ${keysHTML()}

    <h2>Credits</h2>
    <ul>
      <li>Talks and the Hacker News notes come from <a href="https://hackertube.org" target="_blank" rel="noopener">HackerTube</a>
        (ODC-By 1.0), derived from the open-index/hacker-news dataset.</li>
      <li>Video metadata and thumbnails from YouTube. All videos belong to their creators; AItube only links and embeds.</li>
      <li>Inter by Rasmus Andersson (SIL Open Font License); iA Writer Mono for numbers.</li>
    </ul>
    <p class="muted">Catalog built ${esc(cat.generated)}. Made as a personal library, shared because it is useful.</p>
  </article>`;

  $("#exportData").onclick = () => {
    const blob = new Blob([JSON.stringify(state.exportData(), null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: "aitube-data.json",
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#importData").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const n = state.importData(JSON.parse(await file.text()));
      ctx.rerender();
      toast(`Imported ${n} entries.`);
    } catch (err) {
      toast(`Could not import: ${err.message}`);
    }
  };
  $("#clearData").onclick = () => {
    if (!confirm("Erase likes, watch later, history and interests from this browser?")) return;
    ["likes", "later", "seen", "hidden", "interests", "recent"].forEach((k) => state.clear(k));
    ctx.rerender();
  };
  const importLabel = $("#importData").parentElement;
  importLabel.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#importData").click(); } };
  return null;
}
