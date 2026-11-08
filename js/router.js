/* Hash routing: parse "#/watch/ID?t=30" and pick the view.

   Kept apart from app.js so it can be tested without a DOM. Malformed input
   must never throw: a truncated percent escape falls back to the raw segment,
   and an unknown or inherited name (e.g. "__proto__") resolves to null. */

/** {head, arg, params, path} from location.hash */
export function parseHash(hash) {
  const raw = String(hash || "").replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  return { head: parts[0] || "home", arg: parts[1] || "", params: new URLSearchParams(qs || ""), path };
}

/** the view function for a route name, or null when the route does not exist */
export function resolveView(views, head) {
  return Object.hasOwn(views, head) && typeof views[head] === "function" ? views[head] : null;
}
