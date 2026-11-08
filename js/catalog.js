/* Catalog loading and indexing.

   The catalog is one JSON file built by tools/build_catalog.py:
     channels: [{slug, name, url, tier, group, why, n}]
     videos:   rows, see ROW
     notes:    id -> [[text, {k: course|pick|explainer|talk, ...extra}]]
     paths:    courses and learning paths, each with ordered items
     chapters: id -> [[startSeconds, title]]
     topics:   [{slug, label}]
   Everything the site renders was selected by the build; nothing here is a raw
   channel dump. */

import { isVideoId } from "./util.js";

export const ROW = { id: 0, title: 1, dur: 2, views: 3, ch: 4, rank: 5, date: 6, score: 7, noEmbed: 8, topics: 9 };

const SLUG = /^[A-Za-z0-9][\w-]{0,80}$/; // external channels use "ext-<YouTube channel id>"
const TIERS = new Set(["S", "A", "B", "C"]);
const str = (x) => (typeof x === "string" ? x : x == null ? "" : String(x));
const int = (x) => { const n = Math.floor(Number(x)); return Number.isFinite(n) && n > 0 ? n : 0; };
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
const slug = (x, fallback) => (typeof x === "string" && SLUG.test(x) ? x : fallback);
const timed = (list) => (Array.isArray(list) ? list.filter(Array.isArray).map(([s, ...rest]) => [int(s), ...rest.map(str)]) : []);

/* Fields that reach HTML attributes (ids, slugs, tiers, seconds) are checked once here.
   Bad rows are dropped, bad numbers become 0, bad slugs are replaced. Text stays text
   and is escaped at render time. */
function cleanRaw(raw) {
  const objects = (list) => (Array.isArray(list) ? list : []).filter((x) => x && typeof x === "object" && !Array.isArray(x));
  const channels = objects(raw.channels).map((c, i) => ({
    ...c, slug: slug(c.slug, `channel-${i}`), name: str(c.name), why: str(c.why), url: str(c.url),
    tier: TIERS.has(c.tier) ? c.tier : "", group: str(c.group), n: int(c.n),
  }));
  const topics = objects(raw.topics).map((t, i) => ({ ...t, slug: slug(t.slug, `topic-${i}`), label: str(t.label) }));
  const nCh = channels.length, nTp = topics.length;
  const videos = (Array.isArray(raw.videos) ? raw.videos : []).filter((r) => Array.isArray(r) && isVideoId(r[0])
    && Number.isInteger(r[4]) && r[4] >= 0 && r[4] < nCh);
  const paths = objects(raw.paths).map((p, i) => ({
    ...p, slug: slug(p.slug, `path-${i}`), title: str(p.title), blurb: str(p.blurb),
    kind: p.kind === "course" ? "course" : "path",
    items: (Array.isArray(p.items) ? p.items : []).filter((it) => Array.isArray(it) && isVideoId(it[0]))
      .map(([id, s, note]) => [id, int(s), str(note)]),
  }));
  const chapters = {};
  for (const [id, list] of Object.entries(raw.chapters || {})) {
    if (!isVideoId(id)) continue;
    const t = timed(list);
    if (t.length) chapters[id] = t;
  }
  const notes = {};
  for (const [id, list] of Object.entries(raw.notes || {})) {
    if (!isVideoId(id) || !Array.isArray(list)) continue;
    const rows = list.filter((n) => Array.isArray(n) && n[0])
      .map((n) => [str(n[0]), n[1] && typeof n[1] === "object" ? n[1] : {}]);
    if (rows.length) notes[id] = rows;
  }
  const stats = Object.fromEntries(Object.entries(raw.stats || {}).map(([k, x]) => [k, int(x)]));
  const ids = new Set();
  const unique = videos.filter((r) => (ids.has(r[0]) ? false : ids.add(r[0]) && true));
  return {
    ...raw, channels, topics, paths, chapters, notes, stats,
    videos: unique.map((r) => [r[0], str(r[1]), int(r[2]), int(r[3]), r[4], num(r[5]), str(r[6]), num(r[7]),
      r[8] ? 1 : 0, Array.isArray(r[9]) ? r[9].filter((t) => Number.isInteger(t) && t >= 0 && t < nTp) : []]),
    credits: raw.credits || {},
  };
}

/** Build lookup structures from the raw catalog (pure; used by the app and tests). */
export function indexCatalog(input) {
  const raw = cleanRaw(input);
  const CH = raw.channels;
  const V = raw.videos.map((r) => ({
    id: r[0], t: r[1], d: r[2], v: r[3], ch: r[4], r: r[5], date: r[6], s: r[7], ne: !!r[8], tp: r[9],
  }));
  const BY_ID = new Map(V.map((v) => [v.id, v]));
  const BY_CH = CH.map(() => []);
  V.forEach((v) => BY_CH[v.ch].push(v));
  BY_CH.forEach((list) => list.sort((a, b) => a.r - b.r));
  const TOPICS = raw.topics || [];
  const BY_TOPIC = TOPICS.map(() => []);
  V.forEach((v) => v.tp.forEach((t) => BY_TOPIC[t] && BY_TOPIC[t].push(v)));

  const NOTES = raw.notes;
  const kindOf = (v) => (NOTES[v.id] || []).map((n) => n[1].k);
  const PICKS = V.filter((v) => kindOf(v).some((k) => k === "pick" || k === "explainer"));
  const TALKS = V.filter((v) => kindOf(v).includes("talk"));
  const COURSES = (raw.paths || []).filter((p) => p.kind === "course");
  const PATHS = (raw.paths || []).filter((p) => p.kind === "path");
  const CH_BY_SLUG = new Map(CH.map((c, i) => [c.slug, i]));
  const TOPIC_BY_SLUG = new Map(TOPICS.map((t, i) => [t.slug, i]));
  const PATH_BY_SLUG = new Map((raw.paths || []).map((p) => [p.slug, p]));
  const PATHS_OF = new Map();
  (raw.paths || []).forEach((p) => p.items.forEach(([id], i) => {
    if (!PATHS_OF.has(id)) PATHS_OF.set(id, []);
    PATHS_OF.get(id).push([p.slug, i]);
  }));
  return {
    raw, CH, V, BY_ID, BY_CH, BY_TOPIC, TOPICS, NOTES, PICKS, TALKS, COURSES, PATHS,
    CH_BY_SLUG, TOPIC_BY_SLUG, PATH_BY_SLUG, PATHS_OF,
    chapters: raw.chapters, paths: raw.paths || [], stats: raw.stats, generated: raw.generated || "",
    credits: raw.credits,
  };
}

async function getJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export async function loadCatalog(base = "data/") {
  return indexCatalog(await getJSON(base + "catalog.json"));
}
