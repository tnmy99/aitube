/* The "all videos" sampler: random but tier-weighted, so a huge course channel
   cannot drown a small explainer channel. Nothing repeats; watched and hidden
   videos stay out. */
import { rng } from "./util.js";

export const TIER_W = { S: 10, A: 6, B: 4, C: 2.5, "": 2 }; // untiered channels: hand-picked videos
export const LENGTHS = {
  all: () => true,
  short: (v) => v.d > 0 && v.d < 1200,
  mid: (v) => v.d >= 1200 && v.d < 3600,
  long: (v) => v.d >= 3600,
};

export function makeFilter(cat, { tier = "all", len = "all", topic = null, kind = "all" } = {}) {
  const lenOk = LENGTHS[len] || LENGTHS.all;
  const t = topic == null || topic === "" ? null : cat.TOPIC_BY_SLUG.get(topic);
  const kinds = cat;
  const kindOk = {
    all: () => true,
    talk: (v) => (kinds.NOTES[v.id] || []).some((n) => n[1].k === "talk"),
    pick: (v) => (kinds.NOTES[v.id] || []).some((n) => n[1].k === "pick" || n[1].k === "explainer"),
    course: (v) => (cat.PATHS_OF.get(v.id) || []).some(([s]) => cat.PATH_BY_SLUG.get(s)?.kind === "course"),
  }[kind] || (() => true);
  return (v) => lenOk(v) && kindOk(v) && (tier === "all" || cat.CH[v.ch].tier === tier) && (t == null || v.tp.includes(t));
}

/** makeFeed(cat, state, opts) -> next(count) returning [{v, why?}] */
export function makeFeed(cat, state, opts = {}) {
  const rnd = rng(opts.seed ?? Math.random());
  const pass = makeFilter(cat, opts);
  const ok = (v) => pass(v) && (!opts.playableOnly || !v.ne);
  const used = new Set([...state.seen, ...state.hidden]);
  const pools = cat.CH.map((c, i) => cat.BY_CH[i].filter(ok));
  const weights = cat.CH.map((c, i) => (pools[i].length ? TIER_W[c.tier] ?? 2 : 0));
  let total = weights.reduce((a, b) => a + b, 0);
  const exhaust = (i) => { weights[i] = 0; total = weights.reduce((a, b) => a + b, 0); };
  const value = (v) => v.s + rnd() * 3;

  function fromPool(pool) {
    for (let tries = 0; tries < 12; tries++) {
      const a = pool[Math.floor(rnd() * pool.length)], b = pool[Math.floor(rnd() * pool.length)];
      const win = [a, b].filter((v) => v && !used.has(v.id)).sort((p, q) => value(q) - value(p))[0];
      if (win) return win;
    }
    return pool.find((v) => !used.has(v.id)) || null;
  }
  function weightedChannel() {
    let r = rnd() * total, i = 0;
    while (i < weights.length - 1 && (r >= weights[i] || weights[i] === 0)) { r -= weights[i]; i++; }
    return i;
  }
  function nextOne() {
    while (total > 1e-9) {
      const i = weightedChannel();
      const v = weights[i] > 0 ? fromPool(pools[i]) : null;
      if (v) return v;
      exhaust(i);
    }
    return null;
  }

  return function next(count) {
    const out = [];
    while (out.length < count) {
      const v = nextOne();
      if (!v) break;
      used.add(v.id);
      out.push({ v });
    }
    return out;
  };
}

/** a random playable video for Surprise me */
export function surprise(cat, state) {
  const feed = makeFeed(cat, state, { playableOnly: true });
  const batch = feed(12);
  return batch.length ? batch[Math.floor(Math.random() * batch.length)].v : null;
}
