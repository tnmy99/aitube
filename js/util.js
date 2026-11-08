/* Small helpers shared by every module. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export function fmtDur(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function fmtTotal(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (!s) return "";
  if (s >= 3600) {
    const h = Math.round(s / 360) / 10;
    return `${h % 1 ? h.toFixed(1) : h} hours`;
  }
  return `${Math.max(1, Math.round(s / 60))} min`;
}

export function fmtViews(n) {
  const v = Math.max(0, Number(n) || 0);
  if (v < 1000) return v ? `${v} view${v === 1 ? "" : "s"}` : "";
  const [div, unit] = v >= 1e9 ? [1e9, "B"] : v >= 1e6 ? [1e6, "M"] : [1e3, "K"];
  const x = v / div;
  return `${x >= 10 ? Math.round(x) : x.toFixed(1).replace(/\.0$/, "")}${unit} views`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "20220816" -> "Aug 2022" */
export const fmtDate = (d) => (d && /^\d{8}$/.test(d) ? `${MONTHS[+d.slice(4, 6) - 1] || ""} ${d.slice(0, 4)}`.trim() : "");

/** YouTube video ids are 11 characters of [A-Za-z0-9_-]; anything else is rejected. */
export const isVideoId = (id) => typeof id === "string" && /^[\w-]{11}$/.test(id);
export const thumb = (id, size = "mqdefault") => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${size}.jpg`;
export const ytUrl = (id, start = 0) =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${start ? "&t=" + (parseInt(start, 10) || 0) : ""}`;

/** Only http(s) links from the catalog are rendered; anything else becomes "". */
export function safeUrl(u) {
  try {
    const p = new URL(String(u));
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : "";
  } catch {
    return "";
  }
}

/** deterministic PRNG: rng(seed) -> () => [0,1) */
export function rng(seed) {
  let a = (Math.floor(Math.abs(Number(seed)) * 1e9) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STOP = new Set(("a an the and or but if of for to in on at by with from is are was were be been " +
  "this that these those it its as how what why when where who which do does did can could should " +
  "would will shall may might must not no yes you your we our they their he she his her i me my " +
  "part video course lecture intro introduction").split(" "));

/** lowercase content words, hyphenated compounds kept whole */
export function tokenize(s) {
  return (String(s || "").toLowerCase().match(/[a-z0-9]+(?:[-'][a-z0-9]+)*/g) || [])
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function debounce(fn, ms = 120) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
