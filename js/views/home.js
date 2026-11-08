/* Home: a curated front page, not a firehose. Shelves of courses, paths,
   hand-picked videos and talks, then topics and channels to browse. */
import { $, esc, fmtTotal, plural, thumb } from "../util.js";
import { channelCard, pathCard, tierBadge, topicTile, videoCard } from "../cards.js";

export const pathProgress = (ctx, p) => {
  let done = 0;
  p.items.forEach(([id]) => { if (ctx.state.has("seen", id)) done++; });
  return [done, p.items.length];
};

const shelf = (title, href, body, cls = "") => `<section class="shelf ${cls}">
  <header><h2>${esc(title)}</h2>${href ? `<a class="see" href="${href}">See all</a>` : ""}</header>
  ${body}</section>`;

const grid = (items, cls = "vgrid") => `<div class="${cls}">${items.join("")}</div>`;

export function viewHome(ctx) {
  const { cat, state } = ctx;
  const out = [];

  // hero
  out.push(`<section class="hero">
    <div class="hero-copy">
      <p class="kicker">A hand-built library</p>
      <h1>AI education<br><em>worth your time.</em></h1>
      <p class="lede">${cat.stats.channels} channels, ${cat.stats.courses} full courses and ${cat.stats.talks} talks.
        No firehose, no reaction videos: every video on this site was chosen and says why it's here.</p>
      <div class="hero-actions"><a class="btn primary lg" href="#/videos">Browse the library</a>
        <a class="btn lg" href="#/paths">Start a learning path</a></div>
      <div class="hero-topics"><span>Or pick a topic:</span>
        ${cat.TOPICS.slice(0, 6).map((t) => `<a class="chip" href="#/t/${esc(t.slug)}">${esc(t.label)}</a>`).join("")}
        <a class="chip more" href="#/topics">All ${cat.TOPICS.length} →</a></div>
    </div>
    <a class="hero-feature" href="#/course/${esc(featureCourse(cat).slug)}">
      <img src="${thumb(featureCourse(cat).items.find(([id]) => cat.BY_ID.get(id))?.[0] || "", "hqdefault")}" alt="">
      <span class="tag">Course of the week</span>
      <div>
        <h2>${esc(featureCourse(cat).title)}</h2>
        <p>${esc(featureCourse(cat).blurb)}</p>
        <small>${featureCourse(cat).items.length} lectures · ${esc(cat.CH[cat.BY_ID.get(featureCourse(cat).items[0][0])?.ch]?.name || "")}</small></div>
    </a>
  </section>`);

  // continue
  const started = cat.PATHS.map((p) => [p, ...pathProgress(ctx, p)]).filter(([, d, n]) => d > 0 && d < n);
  const coursesStarted = cat.COURSES.map((p) => [p, ...pathProgress(ctx, p)]).filter(([, d, n]) => d > 0 && d < n);
  const resume = started.concat(coursesStarted);
  if (resume.length >= 2) {
    out.push(shelf("Pick up where you left off", "#/paths",
      `<div class="pgrid">${resume.slice(0, 3).map(([p, d, n]) => pathCard(ctx, p, { progress: [d, n] })).join("")}</div>`));
  }

  // recommendations, only when there is something to go on
  const recs = ctx.rec.forYou(state, 8);
  if (recs.length) {
    out.push(shelf("Picked for you", null, grid(recs.map((r) => videoCard(ctx, r.v, { why: r.why })))));
  }

  // paths
  out.push(shelf("Learning paths", "#/paths",
    `<div class="pgrid">${cat.PATHS.map((p) => pathCard(ctx, p, { progress: pathProgress(ctx, p) })).join("")}</div>`));

  // hand-picked
  const picks = cat.PICKS.filter((v) => cat.NOTES[v.id].some((n) => n[1].k === "pick")).slice(0, 8);
  if (picks.length) out.push(shelf("Hand-picked", "#/videos?kind=pick", grid(picks.map((v) => videoCard(ctx, v)))));

  // featured course strip
  const featured = cat.COURSES.filter((c) => c.items.length >= 8).slice(0, 4);
  if (featured.length) {
    out.push(shelf("Full courses", "#/courses", `<div class="cgrid">${featured.map((c) => courseCard(ctx, c)).join("")}</div>`));
  }

  // talks
  if (cat.TALKS.length) {
    out.push(shelf("Talks people keep recommending", "#/talks",
      grid(cat.TALKS.slice(0, 8).map((v) => videoCard(ctx, v)))));
  }

  // topics
  out.push(shelf("Browse by topic", "#/topics",
    `<div class="tgrid">${cat.TOPICS.map((t, i) => topicTile(t, cat.BY_TOPIC[i].length)).join("")}</div>`));

  // channels
  const topCh = cat.CH.map((c, i) => [c, i]).filter(([c, i]) => c.group !== "external" && cat.BY_CH[i].length)
    .sort((a, b) => "SABC".indexOf(a[0].tier) - "SABC".indexOf(b[0].tier));
  out.push(shelf("Channels", "#/channels",
    `<div class="chgrid">${topCh.slice(0, 12).map(([, i]) => channelCard(ctx, i)).join("")}</div>`));

  $("#main").innerHTML = `<div class="home">${out.join("")}</div>`;
  return null;
}

export function courseCard(ctx, c) {
  const [done] = pathProgress(ctx, c);
  const secs = c.items.reduce((a, [id]) => a + (ctx.cat.BY_ID.get(id)?.d || 0), 0);
  const first = c.items.find(([id]) => ctx.cat.BY_ID.get(id));
  const ch = first ? ctx.cat.CH[ctx.cat.BY_ID.get(first[0]).ch] : null;
  return `<a class="ccard" href="#/course/${esc(c.slug)}">
    <div class="cthumb"><img loading="lazy" src="${thumb(first?.[0] || "", "hqdefault")}" alt="">
      <span class="badge">${plural(c.items.length, "lecture")}</span></div>
    <div class="cbody"><h3>${esc(c.title)}</h3>
      <p>${esc(c.blurb)}</p>
      <div class="cmeta">${ch ? esc(ch.name) : ""}${ch ? tierBadge(ch.tier) : ""}<span>·</span><span>${fmtTotal(secs)}</span>
        ${done ? `<span>·</span><span class="pdone">${done} of ${c.items.length} watched</span>` : ""}</div></div></a>`;
}

function featureCourse(cat) {
  const good = cat.COURSES.filter((c) => c.items.filter(([id]) => cat.BY_ID.get(id)).length >= 10);
  const list = good.length ? good : cat.COURSES;
  const day = Math.floor(Date.now() / 864e5);
  return list[day % Math.max(1, list.length)];
}

export { shelf, grid };
