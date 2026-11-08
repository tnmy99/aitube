/* Watch page: the player (or a YouTube-only panel), actions, reasons, chapters,
   and what to watch next. */
import { $, esc, fmtDate, fmtDur, fmtViews, isVideoId, safeUrl, thumb, ytUrl } from "../util.js";
import { tierBadge, videoRow } from "../cards.js";
import { copyText, shareUrl, toast } from "../ui.js";
import { mount } from "../player.js";

const heart = (on) => `<svg class="hicon" viewBox="0 0 24 24" aria-hidden="true"${on ? ' style="fill:currentColor"' : ""}><path d="M12 20s-7-4.4-7-9.3A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.7C19 15.6 12 20 12 20z"/></svg>`;

function reasonsHTML(ctx, v) {
  const { cat } = ctx;
  const notes = cat.NOTES[v.id] || [];
  if (!notes.length) return `<p class="muted">${esc(cat.CH[v.ch].why)}</p>`;
  return notes.map(([text, x]) => {
    if (x.k === "talk") {
      const meta = [x.format, x.level, x.years && `recommended ${x.years}`].filter(Boolean).join(" · ");
      return `<div class="reason"><span class="rlabel">Talk people recommend</span>
        <p>${esc(text)}</p>${x.summary ? `<p class="muted">${esc(x.summary)}</p>` : ""}
        ${x.quote ? `<blockquote>“${esc(x.quote)}”<cite>${x.comment
          ? `<a href="https://news.ycombinator.com/item?id=${encodeURIComponent(x.comment)}" target="_blank" rel="noopener">Hacker News thread ↗</a>`
          : "Hacker News"}</cite></blockquote>` : ""}
        ${meta ? `<p class="muted">${esc(meta)}</p>` : ""}</div>`;
    }
    if (x.k === "explainer") {
      const url = safeUrl(x.url);
      return `<div class="reason"><span class="rlabel">Paper explainer</span><p>${esc(text)}</p>
        ${x.why ? `<p class="muted">${esc(x.why)}</p>` : ""}
        ${url ? `<p><a href="${esc(url)}" target="_blank" rel="noopener">Read the paper ↗</a></p>` : ""}</div>`;
    }
    if (x.k === "course") return `<div class="reason"><span class="rlabel">Course lecture</span><p>${esc(text)}</p></div>`;
    return `<div class="reason"><span class="rlabel">Hand-picked</span><p>${esc(text)}</p></div>`;
  }).join("");
}

function chaptersHTML(list) {
  return `<section class="chapters"><h2>Chapters</h2><ol>${list.map(([start, label]) =>
    `<li><button type="button" data-seek="${parseInt(start, 10) || 0}"><span class="ts">${fmtDur(start) || "0:00"}</span>
      <span>${esc(label)}</span></button></li>`).join("")}</ol></section>`;
}

export function viewWatch(ctx, id, params) {
  const { cat, state } = ctx;
  const main = $("#main");
  const v = cat.BY_ID.get(id);
  if (!v) {
    const link = isVideoId(id) ? ` <a href="${esc(ytUrl(id))}" target="_blank" rel="noopener">Open it on YouTube ↗</a>` : "";
    main.innerHTML = `<div class="empty"><h1>Not in the library</h1><p>This video isn't part of AItube.${link}</p>
      <a class="btn primary" href="#/videos">Browse the library</a></div>`;
    return null;
  }
  const c = cat.CH[v.ch];
  const start = Math.max(0, parseInt(params.get("t") || "0", 10) || 0);
  const pathSlug = params.get("path") || "";
  const path = pathSlug ? cat.PATH_BY_SLUG.get(pathSlug) : null;
  const chapters = cat.chapters[v.id];

  // up next: the rest of the course/path if we came from one, otherwise related videos
  let next = [];
  let nextTitle = "Up next";
  if (path) {
    const i = path.items.findIndex(([pid]) => pid === v.id);
    next = path.items.slice(i + 1).map(([pid, s, note]) => cat.BY_ID.get(pid) && { v: cat.BY_ID.get(pid), start: s, note }).filter(Boolean);
    if (next.length) nextTitle = `Next in ${path.title}`;
  }
  if (!next.length) next = ctx.rec.related(v, 10).map((x) => ({ v: x }));
  const inPath = path ? ` <a href="#/${path.kind === "course" ? "course" : "path"}/${esc(path.slug)}">${esc(path.title)}</a>` : "";
  const pos = path ? path.items.findIndex(([pid]) => pid === v.id) + 1 : 0;

  document.title = `${v.t} · AItube`;
  main.innerHTML = `<article class="watch">
    <div class="watch-main">
      <div class="player" id="player">${v.ne ? `<a class="noembed" href="${ytUrl(v.id, start)}" target="_blank" rel="noopener">
        <img src="${thumb(v.id, "hqdefault")}" alt=""><span><b>Watch on YouTube ↗</b>
        The owner allows playback only on youtube.com, so this opens in a new tab.</span></a>` : ""}</div>
      <h1>${esc(v.t)}</h1>
      <div class="wmeta">
        <a class="chn" href="#/c/${esc(c.slug)}">${esc(c.name)}</a>${tierBadge(c.tier)}
        <span class="dot">·</span><span>${fmtViews(v.v)}</span>
        ${v.date ? `<span class="dot">·</span><span>${fmtDate(v.date)}</span>` : ""}
        ${path ? `<span class="dot">·</span><span>${pos} of ${path.items.length} in ${inPath}</span>` : ""}
      </div>
      <div class="wactions">
        <button class="btn pill" id="likeBtn" aria-pressed="${state.has("likes", v.id)}">${heart(state.has("likes", v.id))}${state.has("likes", v.id) ? "Liked" : "Like"}</button>
        <button class="btn pill" id="laterBtn" aria-pressed="${state.has("later", v.id)}">${state.has("later", v.id) ? "Saved" : "+ Watch later"}</button>
        <button class="btn pill" id="shareBtn">Share at timestamp</button>
        <a class="btn pill" href="${ytUrl(v.id, start)}" target="_blank" rel="noopener">YouTube ↗</a>
      </div>
      <section class="reasons"><h2>Why it's here</h2>${reasonsHTML(ctx, v)}</section>
      ${chapters ? chaptersHTML(chapters) : ""}
    </div>
    <aside class="upnext" aria-label="${esc(nextTitle)}">
      <h2>${esc(nextTitle)}</h2>
      <ol class="video-rows">${next.map((x, i) => videoRow(ctx, x.v, { n: path ? pos + i + 1 : undefined, note: x.note, path: path?.slug, start: x.start })).join("")}</ol>
    </aside>
  </article>`;

  let ctl = null, alive = true;
  const abort = new AbortController();
  if (!v.ne) {
    mount($("#player"), v.id, {
      start, signal: abort.signal,
      onEnd: () => {
        const n = next.find((x) => !x.v.ne);
        if (n && alive) location.hash = `#/watch/${n.v.id}${path ? `?path=${path.slug}` : ""}${n.start ? "&t=" + n.start : ""}`;
      },
    }).then((p) => { if (alive) ctl = p; else p.destroy(); });
  }
  main.querySelectorAll("[data-seek]").forEach((b) => (b.onclick = () => {
    if (ctl) ctl.seek(+b.dataset.seek);
    else window.open(ytUrl(v.id, +b.dataset.seek), "_blank", "noopener");
    $("#player").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }));
  const flip = (btn, list, on, off) => {
    const now = state.toggle(list, v.id);
    btn.setAttribute("aria-pressed", String(now));
    btn.innerHTML = list === "likes" ? heart(now) + (now ? "Liked" : "Like") : (now ? "Saved" : "+ Watch later");
    toast(now ? on : off);
  };
  $("#likeBtn").onclick = (e) => flip(e.currentTarget, "likes", "Liked. Recommendations will use it.", "Like removed");
  $("#laterBtn").onclick = (e) => flip(e.currentTarget, "later", "Saved to Watch later", "Removed from Watch later");
  $("#shareBtn").onclick = async () => {
    const t = ctl ? ctl.time() : start;
    toast((await copyText(shareUrl(v.id, t))) ? `Link copied${t ? " at " + fmtDur(t) : ""}` : "Could not copy the link");
  };
  state.markSeen(v.id);
  return () => { alive = false; abort.abort(); if (ctl) ctl.destroy(); };
}
