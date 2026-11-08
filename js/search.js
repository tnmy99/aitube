/* Search and search suggestions over the catalog (all in the browser).

   Index: title words (strongest), channel name and the written reasons. Every
   query term must match (AND); a term also matches words it prefixes, so
   results update while typing. Common AI shorthand expands to its long form
   ("rl" also finds "reinforcement learning"). */
import { tokenize } from "./util.js";

const SYNONYMS = Object.assign(Object.create(null), {
  rl: ["reinforcement"], llm: ["language"], llms: ["language"], moe: ["mixture", "experts"],
  nn: ["neural"], cnn: ["convolutional"], rnn: ["recurrent"], rag: ["retrieval"],
  sae: ["sparse", "autoencoder"], interp: ["interpretability"], gpt: ["gpt"], ml: ["machine"],
  cv: ["vision"], nlp: ["language"], dl: ["deep"], ai: ["ai"], rlhf: ["rlhf", "feedback"],
  gan: ["adversarial"], vae: ["variational"], ssm: ["state", "space"], kv: ["kv"],
  mech: ["mechanistic"], math: ["maths", "mathematics"], maths: ["math"],
});
const W = { title: 3, channel: 1.5, note: 1 };

export function createSearch(cat) {
  const docs = cat.V.map((v) => {
    const fields = new Map();
    const add = (words, w) => words.forEach((t) => fields.set(t, Math.max(fields.get(t) || 0, w)));
    add(tokenize(v.t), W.title);
    add(tokenize(cat.CH[v.ch].name), W.channel);
    add(tokenize((cat.NOTES[v.id] || []).map((n) => n[0]).join(" ")), W.note);
    return fields;
  });
  const inv = new Map(); // token -> [docIndex...]
  docs.forEach((f, i) => f.forEach((_w, t) => { if (!inv.has(t)) inv.set(t, []); inv.get(t).push(i); }));
  const vocab = [...inv.keys()].sort();

  /** all vocabulary words starting with p (binary search on the sorted vocab) */
  function withPrefix(p, cap = 400) {
    let lo = 0, hi = vocab.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (vocab[m] < p) lo = m + 1; else hi = m; }
    const out = [];
    for (let i = lo; i < vocab.length && vocab[i].startsWith(p) && out.length < cap; i++) out.push(vocab[i]);
    return out;
  }

  /** words a query term can match, with a multiplier (exact 1, prefix 0.7, synonym 0.8) */
  function expand(term, allowPrefix) {
    const alts = new Map([[term, 1]]);
    const syn = Object.hasOwn(SYNONYMS, term) ? SYNONYMS[term] : [];
    syn.forEach((s) => alts.set(s, Math.max(alts.get(s) || 0, 0.8)));
    if (allowPrefix && term.length >= 2) withPrefix(term).forEach((w) => alts.set(w, Math.max(alts.get(w) || 0, 0.7)));
    return alts;
  }

  /** ranked videos for a query; `limit` 0 means all */
  function search(q, limit = 0) {
    const terms = tokenize(q);
    if (!terms.length) return [];
    const phrase = q.trim().toLowerCase();
    let scores = null;
    terms.forEach((term, k) => {
      const alts = expand(term, k === terms.length - 1 || term.length >= 4);
      const termScores = new Map();
      alts.forEach((mult, word) => (inv.get(word) || []).forEach((i) => {
        const s = docs[i].get(word) * mult;
        if (s > (termScores.get(i) || 0)) termScores.set(i, s);
      }));
      if (scores === null) scores = termScores;
      else {
        const next = new Map();
        termScores.forEach((s, i) => { if (scores.has(i)) next.set(i, scores.get(i) + s); });
        scores = next;
      }
    });
    const ranked = [...scores].map(([i, s]) => {
      const v = cat.V[i];
      const bonus = (v.t.toLowerCase().includes(phrase) && terms.length > 1 ? 4 : 0) +
        (cat.NOTES[v.id] ? 2 : 0) + v.s * 0.25 - (v.ne ? 0.5 : 0);
      return [v, s + bonus];
    }).sort((a, b) => b[1] - a[1]);
    const list = ranked.map((x) => x[0]);
    return limit ? list.slice(0, limit) : list;
  }

  /** query completions: previous words + likely endings of the last word, by frequency */
  function completions(q, n = 5) {
    const raw = q.toLowerCase().replace(/\s+/g, " ").trimStart();
    const words = raw.split(" ");
    const last = words.pop();
    const head = words.join(" ");
    if (!last || last.length < 2) return [];
    const base = head ? new Set(search(head).map((v) => v.id)) : null;
    const counts = withPrefix(last, 2000).map((w) => {
      const ids = inv.get(w) || [];
      const c = base ? ids.filter((i) => base.has(cat.V[i].id)).length : ids.length;
      return [w, c];
    }).filter((x) => x[1] > 0 && x[0] !== last).sort((a, b) => b[1] - a[1]).slice(0, n);
    return counts.map(([w]) => (head ? head + " " : "") + w);
  }

  /** grouped suggestions for the dropdown */
  function suggest(q) {
    const t = q.trim().toLowerCase();
    if (!t) return { queries: [], topics: [], channels: [], paths: [], videos: [] };
    const match = (s) => s.toLowerCase().includes(t);
    const startsWord = (s) => s.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.startsWith(t));
    return {
      queries: completions(q),
      topics: cat.TOPICS.map((tp, i) => ({ ...tp, i, n: cat.BY_TOPIC[i].length }))
        .filter((tp) => match(tp.label) || tp.slug.startsWith(t)).slice(0, 3),
      channels: cat.CH.filter((c) => c.tier && (startsWord(c.name) || match(c.name))).slice(0, 3),
      paths: cat.paths.filter((p) => match(p.title)).slice(0, 3),
      videos: search(q, 4),
    };
  }

  return { search, suggest, completions };
}
