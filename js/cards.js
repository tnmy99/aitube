/* Card and tile markup shared by every view. */
import { esc, fmtDate, fmtDur, fmtTotal, fmtViews, thumb } from "./util.js";

export const TIER_NAME = { S: "Masterpieces", A: "Excellent", B: "Very good", C: "Worth following" };

export const tierBadge = (t) =>
  (TIER_NAME[t] ? `<span class="tier t${t}" title="${TIER_NAME[t]}">${t}</span>` : "");

/** the most useful single reason to show for a video */
export function topReason(cat, v) {
  const notes = cat.NOTES[v.id] || [];
  for (const k of ["pick", "explainer", "talk"]) {
    const n = notes.find((x) => x[1].k === k);
    if (n) return n[0];
  }
  const course = (cat.PATHS_OF.get(v.id) || [])
    .map(([slug]) => cat.PATH_BY_SLUG.get(slug))
    .find((p) => p && p.kind === "course");
  if (course) return `Part of ${course.title}`;
  return cat.CH[v.ch].why || "";
}

const durBadge = (v) => (v.d ? `<span class="dur">${fmtDur(v.d)}</span>` : "");
const noEmbedBadge = (v) => (v.ne ? '<span class="ne" title="The owner allows playback only on YouTube">YouTube only</span>' : "");

export function videoCard(ctx, v, opts = {}) {
  const { cat, state } = ctx;
  const c = cat.CH[v.ch];
  const q = new URLSearchParams();
  if (opts.start) q.set("t", opts.start);
  if (opts.path) q.set("path", opts.path);
  const href = `#/watch/${v.id}${q.toString() ? "?" + q : ""}`;
  const seen = state.has("seen", v.id);
  const why = opts.why ?? topReason(cat, v);
  return `<article class="vcard${seen ? " seen" : ""}" data-id="${v.id}">
    <a class="vthumb" href="${href}" tabindex="-1" aria-hidden="true">
      <img loading="lazy" decoding="async" src="${thumb(v.id)}" alt="" width="320" height="180">
      ${durBadge(v)}${noEmbedBadge(v)}${seen ? '<span class="seen-dot" title="Watched"></span>' : ""}
    </a>
    <div class="vbody">
      <a class="vtitle" href="${href}" title="${esc(v.t)}">${esc(v.t)}</a>
      <div class="vmeta">
        <a class="chn" href="#/c/${esc(c.slug)}">${esc(c.name)}</a>${tierBadge(c.tier)}
        <span class="dot">·</span><span>${fmtViews(v.v)}</span>
      </div>
      ${why ? `<p class="vwhy">${esc(why)}</p>` : ""}
    </div>
    <button class="more" type="button" aria-label="More actions for this video" aria-haspopup="menu" data-menu="${v.id}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
    </button>
  </article>`;
}

/** compact row used in "up next" and search results */
export function videoRow(ctx, v, opts = {}) {
  const { cat, state } = ctx;
  const q = new URLSearchParams();
  if (opts.path) q.set("path", opts.path);
  if (opts.start) q.set("t", opts.start);
  const href = `#/watch/${v.id}${q.toString() ? "?" + q : ""}`;
  const seen = state.has("seen", v.id);
  return `<li class="${seen ? "done" : ""}">
    <a class="row" href="${href}">
      ${opts.n ? `<span class="rnum${seen ? " ok" : ""}">${seen ? "✓" : opts.n}</span>` : ""}
      <div class="rthumb"><img loading="lazy" src="${thumb(v.id)}" alt="">${durBadge(v)}${v.ne ? '<span class="ne">YouTube only</span>' : ""}</div>
      <div class="rbody"><div class="rtitle">${esc(v.t)}</div>
        <div class="rmeta">${esc(cat.CH[v.ch].name)}${tierBadge(cat.CH[v.ch].tier)}</div>
        ${opts.note ? `<div class="rnote">${esc(opts.note)}</div>` : ""}</div>
    </a></li>`;
}

export function pathCard(ctx, p, opts = {}) {
  const [done, total] = opts.progress || [0, p.items.length];
  const first = p.items.find(([id]) => ctx.cat.BY_ID.get(id));
  const secs = p.items.reduce((a, [id]) => a + (ctx.cat.BY_ID.get(id)?.d || 0), 0);
  const pct = total ? Math.round((100 * done) / total) : 0;
  return `<a class="pcard" href="#/${p.kind === "course" ? "course" : "path"}/${esc(p.slug)}">
    <div class="pimg">${first ? `<img loading="lazy" src="${thumb(first[0], "hqdefault")}" alt="">` : ""}
      <span class="pkind">${p.kind === "course" ? "Course" : "Path"}</span></div>
    <div class="pbody"><h3>${esc(p.title)}</h3><p>${esc(p.blurb)}</p>
      <div class="pmeta"><span>${total} videos</span><span>·</span><span>${fmtTotal(secs)}</span>
        ${done ? `<span>·</span><span class="pdone">${done} of ${total} watched</span>` : ""}</div>
      ${pct ? `<div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>` : ""}
    </div></a>`;
}

export function channelCard(ctx, i, { why = false } = {}) {
  const c = ctx.cat.CH[i];
  const n = ctx.cat.BY_CH[i].length;
  return `<a class="chcard${why ? " tall" : ""}" href="#/c/${esc(c.slug)}">
    <span class="mono">${esc(c.name.slice(0, 2).toUpperCase())}</span>
    <div><b>${esc(c.name)}</b>${tierBadge(c.tier)}
      <small>${n} videos</small>${why && c.why ? `<p class="cwhy">${esc(c.why)}</p>` : ""}</div></a>`;
}

export const topicTile = (t, n) =>
  `<a class="ttile" href="#/t/${esc(t.slug)}"><b>${esc(t.label)}</b><span>${n} videos</span></a>`;

export function skeletonCards(n = 8) {
  return Array.from({ length: n }, () => `<div class="vcard sk">
    <div class="vthumb"></div><div class="vbody"><div class="l w80"></div><div class="l w50"></div><div class="l w60"></div></div></div>`).join("");
}

export const metaLine = (v) => [fmtDate(v.date), fmtViews(v.v)].filter(Boolean).join(" · ");
