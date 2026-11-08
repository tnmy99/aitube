/* Personal pages (liked, watch later, history) and search results. */
import { $, esc, plural } from "../util.js";
import { videoCard } from "../cards.js";

const head = (title, blurb, extra = "") => `<header class="pagehead">
  <h1>${esc(title)}</h1><p class="lede">${esc(blurb)}</p>${extra}</header>`;

function listPage(ctx, { title, blurb, ids, empty, clear }) {
  const { cat } = ctx;
  const items = ids.map((id) => cat.BY_ID.get(id)).filter(Boolean);
  document.title = `${title} · AItube`;
  $("#main").innerHTML = `${head(title, blurb, items.length ? `<button class="btn ghost sm" id="clearBtn">Clear all</button>` : "")}
    ${items.length ? `<div class="vgrid">${items.map((v) => videoCard(ctx, v)).join("")}</div>`
    : `<div class="empty"><p>${esc(empty)}</p><a class="btn primary" href="#/videos">Browse the library</a></div>`}`;
  const b = $("#clearBtn");
  if (b) b.onclick = () => { clear(); };
  return null;
}

export function viewLiked(ctx) {
  return listPage(ctx, {
    title: "Liked", blurb: "Liked videos train the recommendations on this page. Nothing leaves your browser.",
    ids: ctx.state.likes, empty: "No liked videos yet. Hit Like on anything worth coming back to.",
    clear: () => { ctx.state.clear("likes"); ctx.rerender(); },
  });
}

export function viewLater(ctx) {
  return listPage(ctx, {
    title: "Watch later", blurb: "Your queue. Saved locally, so it is still here tomorrow.",
    ids: ctx.state.later, empty: "Nothing saved yet. Use the ⋮ menu on any video to save it for later.",
    clear: () => { ctx.state.clear("later"); ctx.rerender(); },
  });
}

/** newest first: state.seen is append-ordered, the page renders newest first */
export const historyIds = (seen) => seen.slice().reverse();

export function viewHistory(ctx) {
  const seen = historyIds(ctx.state.seen);
  return listPage(ctx, {
    title: "History", blurb: "Everything you have watched, newest first. Stored in this browser only.",
    ids: seen, empty: "Nothing watched yet.",
    clear: () => { ctx.state.clear("seen"); ctx.rerender(); },
  });
}

export function viewSearch(ctx, q) {
  const query = (q || "").trim();
  document.title = query ? `${query} · AItube` : "Search · AItube";
  if (!query) {
    $("#main").innerHTML = `${head("Search", "Find a video, a channel, a course or a topic.")}
      <div class="empty"><p>Type in the search box above. Try “attention”, “RLHF”, “diffusion” or a channel name.</p></div>`;
    return null;
  }
  const hits = ctx.search.search(query);
  const shown = hits.slice(0, 120);
  $("#main").innerHTML = `${head(`${plural(hits.length, "result")} for “${query}”`,
    hits.length ? "" : "Nothing matched. Try fewer or shorter words.")}
    ${shown.length ? `<div class="vgrid">${shown.map((v) => videoCard(ctx, v)).join("")}</div>` : ""}`;
  return null;
}
