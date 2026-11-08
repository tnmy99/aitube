/* Browse pages: the video library, courses, paths, topics, channels, talks. */
import { $, $$, esc, fmtTotal, plural, safeUrl } from "../util.js";
import { TIER_NAME, channelCard, pathCard, tierBadge, topicTile, videoCard, videoRow } from "../cards.js";
import { makeFeed } from "../feed.js";
import { infiniteGrid } from "../ui.js";
import { courseCard, pathProgress } from "./home.js";

const head = (eyebrow, title, blurb, extra = "") => `<header class="pagehead">
  <p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>
  <p class="lede">${esc(blurb)}</p>${extra}</header>`;

export function notFound(msg = "That page doesn't exist.") {
  $("#main").innerHTML = `<div class="empty"><h1>Not found</h1><p>${esc(msg)}</p>
    <a class="btn primary" href="#/">Back to home</a></div>`;
  return null;
}

/* ---------------- all videos ---------------- */
export function viewVideos(ctx, params) {
  const { cat } = ctx;
  const tier = params.get("tier") || "all";
  const len = params.get("len") || "all";
  const topic = params.get("topic") || "";
  const kind = params.get("kind") || "all";
  document.title = "Browse · AItube";
  const total = cat.V.length;
  $("#main").innerHTML = `${head("Library", "Every video, chosen on purpose",
    `${total.toLocaleString()} videos from ${cat.stats.channels} channels.`)}
    <div class="filters">
      ${chipRow("Tier", "tier", [["", "All"], ["S", "S"], ["A", "A"], ["B", "B"], ["C", "C"]], tier)}
      ${chipRow("Length", "len", [["", "Any"], ["short", "< 20 min"], ["mid", "20–60 min"], ["long", "> 1 hour"]], len)}
      ${chipRow("Type", "kind", [["", "Everything"], ["pick", "Hand-picked"], ["talk", "Talks"], ["course", "Course lectures"]], kind)}
      <label class="tselect">Topic
        <select id="topicSel"><option value="">All topics</option>
          ${cat.TOPICS.map((t, i) => `<option value="${esc(t.slug)}"${t.slug === topic ? " selected" : ""}>${esc(t.label)} (${cat.BY_TOPIC[i].length})</option>`).join("")}
        </select></label>
    </div>
    <div class="vgrid" id="grid"></div><div class="sentinel" id="sentinel"></div>`;
  const feed = makeFeed(cat, ctx.state, { tier, len, topic, kind });
  const gridEl = $("#grid");
  const stop = infiniteGrid(gridEl, () => feed(12).map((x) => videoCard(ctx, x.v)));
  const go = (k, v) => {
    const p = new URLSearchParams(params);
    if (v && v !== "all") p.set(k, v); else p.delete(k);
    location.hash = `#/videos${p.toString() ? "?" + p : ""}`;
  };
  const literal = { tier: "all", len: "all", kind: "all" };
  $$(".chip[data-k]", $("#main")).forEach((b) => (b.onclick = () => go(b.dataset.k, b.dataset.v || literal[b.dataset.k])));
  $("#topicSel").onchange = (e) => go("topic", e.target.value);
  return stop;
}

function chipRow(label, key, opts, cur) {
  return `<div class="chiprow" role="group" aria-label="${esc(label)}"><span class="clabel">${esc(label)}</span>
    ${opts.map(([v, text]) => `<button type="button" class="chip${(v || "all") === (cur || "all") ? " on" : ""}"
      data-k="${esc(key)}" data-v="${esc(v)}">${esc(text)}</button>`).join("")}</div>`;
}

/* ---------------- courses ---------------- */
export function viewCourses(ctx) {
  const { cat } = ctx;
  document.title = "Courses · AItube";
  $("#main").innerHTML = `${head("Courses", "Full courses, lecture by lecture",
    `${cat.COURSES.length} university and industry courses, in order, with progress saved in this browser.`)}
    <div class="cgrid">${cat.COURSES.map((c) => courseCard(ctx, c)).join("")}</div>`;
  return null;
}

export function viewCourse(ctx, slug) {
  const c = ctx.cat.PATH_BY_SLUG.get(slug);
  if (!c || c.kind !== "course") return notFound("No such course.");
  return pathPage(ctx, c, "Course");
}

/* ---------------- paths ---------------- */
export function viewPaths(ctx) {
  const { cat } = ctx;
  document.title = "Learning paths · AItube";
  $("#main").innerHTML = `${head("Learning paths", "An order that actually works",
    "Ordered routes through the library: start at the top, finish at the bottom, and you have covered the subject.")}
    <div class="pgrid wide">${cat.PATHS.map((p) => pathCard(ctx, p, { progress: pathProgress(ctx, p) })).join("")}</div>`;
  return null;
}

export function viewPath(ctx, slug) {
  const p = ctx.cat.PATH_BY_SLUG.get(slug);
  if (!p || p.kind !== "path") return notFound("No such path.");
  return pathPage(ctx, p, "Learning path");
}

function pathPage(ctx, p, eyebrow) {
  const { cat, state } = ctx;
  const [done, total] = pathProgress(ctx, p);
  const items = p.items.filter(([id]) => cat.BY_ID.get(id));
  const next = items.find(([id]) => !state.has("seen", id)) || items[0];
  const secs = items.reduce((a, [id]) => a + (cat.BY_ID.get(id)?.d || 0), 0);
  const pct = total ? Math.round((100 * done) / total) : 0;
  document.title = `${p.title} · AItube`;
  $("#main").innerHTML = `<article class="pathpage">
    <header><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(p.title)}</h1><p class="lede">${esc(p.blurb)}</p>
      <div class="pstats"><span><b>${total}</b> videos</span><span><b>${fmtTotal(secs)}</b></span>
        <span><b>${done} of ${total}</b> watched</span>
        ${next ? `<a class="btn primary" href="#/watch/${next[0]}?path=${esc(p.slug)}${next[1] ? "&t=" + next[1] : ""}">${done ? "Continue" : "Start"}</a>` : ""}</div>
      <div class="bar wide" aria-hidden="true" title="${pct}% watched"><i style="width:${pct}%"></i></div>
    </header>
    <ol class="video-rows">${items.map(([id, start, note], i) => videoRow(ctx, cat.BY_ID.get(id), { n: i + 1, note, path: p.slug, start })).join("")}</ol>
  </article>`;
  return null;
}

/* ---------------- topics ---------------- */
export function viewTopics(ctx) {
  const { cat } = ctx;
  document.title = "Topics · AItube";
  $("#main").innerHTML = `${head("Topics", "Browse by subject",
    "Every video is tagged with the concepts it teaches. Pick a subject to see only that.")}
    <div class="tgrid wide">${cat.TOPICS.map((t, i) => topicTile(t, cat.BY_TOPIC[i].length)).join("")}</div>`;
  return null;
}

export function viewTopic(ctx, slug) {
  const { cat } = ctx;
  const i = cat.TOPIC_BY_SLUG.get(slug);
  if (i == null) return notFound("No such topic.");
  const t = cat.TOPICS[i];
  const list = cat.BY_TOPIC[i];
  document.title = `${t.label} · AItube`;
  $("#main").innerHTML = `${head("Topic", t.label, `${plural(list.length, "video")} in this topic, from ${plural(new Set(list.map((v) => v.ch)).size, "channel")}.`)}
    <div class="vgrid">${list.map((v) => videoCard(ctx, v)).join("")}</div>`;
  return null;
}

/* ---------------- channels ---------------- */
export function viewChannels(ctx) {
  const { cat } = ctx;
  const rows = cat.CH.map((c, i) => [c, i]).filter(([c, i]) => c.group !== "external" && cat.BY_CH[i].length);
  const groups = [["institution", "Universities, labs and organisations"], ["educator", "Educators"],
    ["researcher", "Researchers"], ["podcast", "Conversations"], ["creator", "Creators"]];
  document.title = "Channels · AItube";
  $("#main").innerHTML = `${head("Channels", "Who is worth following",
    `${rows.length} channels, each tiered by how good they are at teaching, with a written reason.`,
    `<div class="legend">${["S", "A", "B", "C"].map((t) =>
      `<span>${tierBadge(t)}<b>${t}</b> ${TIER_NAME[t]}</span>`).join("")}</div>`)}
    ${groups.map(([g, label]) => {
      const inGroup = rows.filter(([c]) => c.group === g);
      if (!inGroup.length) return "";
      return `<section class="shelf"><header><h2>${esc(label)}</h2></header>
        <div class="chgrid wide">${inGroup.map(([, i]) => channelCard(ctx, i, { why: true })).join("")}</div></section>`;
    }).join("")}`;
  return null;
}

export function viewChannel(ctx, slug) {
  const { cat } = ctx;
  const i = cat.CH_BY_SLUG.get(slug);
  const c = i == null ? null : cat.CH[i];
  if (!c) return notFound("No such channel.");
  const list = cat.BY_CH[i];
  const courses = cat.COURSES.concat(cat.PATHS).filter((p) => p.items.some(([id]) => cat.BY_ID.get(id)?.ch === i));
  document.title = `${c.name} · AItube`;
  $("#main").innerHTML = `<header class="pagehead chanhead">
      <div class="mono big">${esc(c.name.slice(0, 2).toUpperCase())}</div>
      <div><h1>${esc(c.name)}${tierBadge(c.tier)}</h1><p class="lede">${esc(c.why)}</p>
      <div class="pstats"><span><b>${list.length}</b> videos here</span>
        ${safeUrl(c.url) ? `<a class="btn ghost sm" href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener">Channel on YouTube ↗</a>` : ""}</div></div>
    </header>
    ${courses.length ? `<section class="shelf"><header><h2>Courses and paths</h2></header>
      <div class="pgrid">${courses.map((p) => pathCard(ctx, p, { progress: pathProgress(ctx, p) })).join("")}</div></section>` : ""}
    <section class="shelf"><header><h2>Videos</h2></header>
      <div class="vgrid">${list.map((v) => videoCard(ctx, v)).join("")}</div></section>`;
  return null;
}

/* ---------------- talks ---------------- */
export function viewTalks(ctx) {
  const { cat } = ctx;
  const talks = cat.TALKS.slice().sort((a, b) => b.s - a.s);
  document.title = "Talks · AItube";
  $("#main").innerHTML = `${head("Talks", "The talks people keep recommending",
    "Collected from years of Hacker News threads: the lectures and talks practitioners send to each other.")}
    <div class="vgrid">${talks.map((v) => videoCard(ctx, v)).join("")}</div>`;
  return null;
}
