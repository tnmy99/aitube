/* Local state: everything a visitor does stays in this browser (localStorage).
   No accounts, no server, no analytics. Exportable as JSON. */

const PREFIX = "ait.";
const OLD_PREFIX = "aet."; // AIedutube, the project's earlier name
const LIMITS = { seen: 2000, recent: 12 };
const LISTS = ["likes", "later", "seen", "hidden", "interests", "recent"];

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function safeStorage(storage) {
  try {
    const k = PREFIX + "probe";
    storage.setItem(k, "1");
    storage.removeItem(k);
    return storage;
  } catch {
    return memoryStorage(); // private mode / blocked storage: works for the session only
  }
}

/** createState(storage) -> state object. `storage` is localStorage or a stand-in. */
export function createState(storage = globalThis.localStorage) {
  const st = safeStorage(storage || memoryStorage());
  const read = (k, d) => {
    try {
      const raw = st.getItem(PREFIX + k) ?? st.getItem(OLD_PREFIX + k);
      const v = raw == null ? null : JSON.parse(raw);
      return Array.isArray(d) ? (Array.isArray(v) ? v.filter((x) => typeof x === "string") : d) : (v ?? d);
    } catch {
      return d;
    }
  };
  const write = (k, v) => {
    try { st.setItem(PREFIX + k, JSON.stringify(v)); } catch { /* quota or blocked: keep in memory */ }
  };
  const S = Object.fromEntries(LISTS.map((k) => [k, read(k, [])]));
  const listeners = new Set();
  const changed = (k) => { write(k, S[k]); listeners.forEach((fn) => fn(k)); };

  return {
    get likes() { return S.likes; },
    get later() { return S.later; },
    get seen() { return S.seen; },
    get hidden() { return S.hidden; },
    get interests() { return S.interests; },
    get recent() { return S.recent; },
    has: (list, id) => S[list].includes(id),
    /** add/remove an id; returns true when the id is now in the list */
    toggle(list, id) {
      S[list] = S[list].includes(id) ? S[list].filter((x) => x !== id) : S[list].concat(id);
      changed(list);
      return S[list].includes(id);
    },
    markSeen(id) {
      S.seen = S.seen.filter((x) => x !== id).concat(id).slice(-LIMITS.seen);
      changed("seen");
    },
    unsee(id) { S.seen = S.seen.filter((x) => x !== id); changed("seen"); },
    hide(id) { if (!S.hidden.includes(id)) { S.hidden = S.hidden.concat(id); changed("hidden"); } },
    setInterests(slugs) { S.interests = [...new Set(slugs)]; changed("interests"); },
    addRecent(q) {
      const t = String(q).trim().slice(0, 100);
      if (!t) return;
      S.recent = [t].concat(S.recent.filter((x) => x.toLowerCase() !== t.toLowerCase())).slice(0, LIMITS.recent);
      changed("recent");
    },
    removeRecent(q) { S.recent = S.recent.filter((x) => x !== q); changed("recent"); },
    clear(list) { S[list] = []; changed(list); },
    getPref: (k, d) => read("pref." + k, d),
    setPref: (k, v) => write("pref." + k, v),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** JSON snapshot for the "export my data" button */
    exportData() {
      return { app: "AItube", version: 1, exported: new Date().toISOString(), ...Object.fromEntries(LISTS.map((k) => [k, S[k]])) };
    },
    /** merge an exported snapshot; ignores anything that is not a list of strings */
    importData(obj) {
      if (!obj || typeof obj !== "object" || obj.app !== "AItube") throw new Error("Not an AItube export file.");
      let n = 0;
      for (const k of LISTS) {
        if (!Array.isArray(obj[k])) continue;
        const add = obj[k].filter((x) => typeof x === "string" && x.length <= 200);
        S[k] = [...new Set(S[k].concat(add))];
        if (k === "seen") S[k] = S[k].slice(-LIMITS.seen);
        if (k === "recent") S[k] = S[k].slice(0, LIMITS.recent);
        n += add.length;
        changed(k);
      }
      return n;
    },
  };
}
