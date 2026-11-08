/* A small, local recommender.

   Signals: liked (strong), watch later, chosen topics, watched (weak), and
   "not interested" (negative, permanent until undone). Everything stays in
   localStorage; there is no server and no profile to leak.

   The profile is built from topics, title words (IDF-weighted, so common words
   like "learning" count for little) and channels — then floored so one big
   channel cannot take over the list. Every recommendation carries the reason
   it was chosen. */
import { tokenize } from "./util.js";

const W = { like: 3, later: 1.5, interest: 2.6, seen: 0.8 };
const MIX = { topic: 0.42, word: 0.3, channel: 0.18, prior: 0.1 };

export function createRecommender(cat) {
  const df = new Map();
  const words = cat.V.map((v) => {
    const set = new Set(tokenize(v.t));
    set.forEach((w) => df.set(w, (df.get(w) || 0) + 1));
    return [v, set];
  });
  const N = Math.max(1, cat.V.length);
  const idf = (w) => Math.log(1 + N / (1 + (df.get(w) || 0)));
  const wordOf = new Map(words.map(([v, set]) => [v.id, set]));

  function profile(state) {
    const tp = new Map(), ch = new Map(), wd = new Map(), liked = [];
    const add = (v, weight) => {
      v.tp.forEach((t) => tp.set(t, (tp.get(t) || 0) + weight));
      ch.set(v.ch, (ch.get(v.ch) || 0) + weight);
      (wordOf.get(v.id) || []).forEach((w) => wd.set(w, (wd.get(w) || 0) + weight * idf(w)));
    };
    state.likes.forEach((id) => {
      const v = cat.BY_ID.get(id);
      if (v) { add(v, W.like); liked.push(v); }
    });
    state.later.forEach((id) => { const v = cat.BY_ID.get(id); if (v) add(v, W.later); });
    state.seen.slice(-40).forEach((id) => { const v = cat.BY_ID.get(id); if (v) add(v, W.seen); });
    state.interests.forEach((slug) => {
      const t = cat.TOPIC_BY_SLUG.get(slug);
      if (t != null) tp.set(t, (tp.get(t) || 0) + W.interest * 2);
    });
    const norm = (m) => {
      const max = Math.max(1e-9, ...m.values());
      return new Map([...m].map(([k, v]) => [k, v / max]));
    };
    return { tp: norm(tp), ch: norm(ch), wd: norm(wd), liked };
  }

  const topicName = (i) => cat.TOPICS[i]?.label || "";

  function score(p, v) {
    let t = 0;
    v.tp.forEach((x) => { t = Math.max(t, p.tp.get(x) || 0); });
    let w = 0;
    (wordOf.get(v.id) || []).forEach((x) => { w += p.wd.get(x) || 0; });
    w = Math.min(1, w / 6);
    const c = p.ch.get(v.ch) || 0;
    return MIX.topic * t + MIX.word * w + MIX.channel * c + MIX.prior * Math.min(1, v.s / 12);
  }

  /** several true explanations per item; the caller rotates through them so a shelf
      does not read like one sentence repeated. */
  function reasonsFor(p, v) {
    const out = [];
    const shared = (l) => [...(wordOf.get(l.id) || [])].filter((w) => (wordOf.get(v.id) || []).has(w));
    const near = p.liked
      .map((l) => [l, shared(l)])
      .filter(([, w]) => w.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)[0];
    if (near) out.push(`Because you liked “${near[0].t}”`);
    const topic = v.tp.map((x) => [x, p.tp.get(x) || 0]).sort((a, b) => b[1] - a[1])[0];
    if (topic && topic[1] > 0) {
      out.push(`Because you're into ${topicName(topic[0])}`);
      out.push(`Popular in ${topicName(topic[0])}`);
    }
    if ((p.ch.get(v.ch) || 0) > 0.3) out.push(`More from ${cat.CH[v.ch].name}`);
    const other = v.tp.find((x) => x !== topic?.[0]);
    if (other != null) out.push(`Also covers ${topicName(other)}`);
    out.push(cat.CH[v.ch].tier ? `A tier-${cat.CH[v.ch].tier} channel for ${topicName(v.tp[0] ?? 0) || "AI"}` : "Highly rated here");
    return out;
  }

  /** up to n recommendations, at most `perChannel` from one channel */
  function forYou(state, n = 12, { exclude = new Set(), filter = () => true, perChannel = 2 } = {}) {
    const p = profile(state);
    if (!p.tp.size && !p.ch.size && !p.wd.size) return [];
    const skip = new Set([...state.hidden, ...state.likes, ...state.seen, ...exclude]);
    const scored = cat.V
      .filter((v) => !skip.has(v.id) && filter(v))
      .map((v) => [v, score(p, v)])
      .filter(([, s]) => s > 0.06)
      .sort((a, b) => b[1] - a[1]);
    const out = [], used = new Map(), said = new Map();
    for (const [v, s] of scored) {
      const k = used.get(v.ch) || 0;
      if (k >= perChannel) continue;
      used.set(v.ch, k + 1);
      const options = reasonsFor(p, v);
      const why = options.reduce((best, x) => ((said.get(x) || 0) < (said.get(best) || 0) ? x : best), options[0]);
      said.set(why, (said.get(why) || 0) + 1);
      out.push({ v, why, s });
      if (out.length >= n) break;
    }
    return out;
  }

  function related(v, n = 8) {
    if (!v) return [];
    const base = new Set(tokenize(v.t));
    return cat.V
      .filter((x) => x.id !== v.id && x.ch === v.ch || (x.id !== v.id && x.tp.some((t) => v.tp.includes(t))))
      .map((x) => {
        let s = 0;
        (wordOf.get(x.id) || []).forEach((w) => { if (base.has(w)) s += idf(w); });
        s += x.tp.filter((t) => v.tp.includes(t)).length * 0.6;
        if (x.ch === v.ch) s += 0.3;
        return [x, s];
      })
      .filter(([, s]) => s > 0.4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([x]) => x);
  }

  return { forYou, related, profile };
}
