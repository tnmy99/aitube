/* Search box with YouTube-style suggestions: recent searches when empty, then
   query completions, topics, channels, paths/courses and top videos while typing.
   Keyboard: ↑/↓ to move, Enter to open, Esc to close. */
import { $, esc, debounce, thumb, fmtDur } from "./util.js";

export function installSearchBox(ctx) {
  const form = $("#searchForm"), input = $("#q"), box = $("#suggest");
  let items = [], active = -1;

  const go = (hash) => { close(); input.blur(); location.hash = hash; };
  const runQuery = (q) => {
    const t = q.trim();
    if (!t) return;
    ctx.state.addRecent(t);
    input.value = t;
    go(`#/search?q=${encodeURIComponent(t)}`);
  };

  function close() {
    box.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    items = [];
    active = -1;
  }
  function setActive(i) {
    active = i;
    box.querySelectorAll("[role=option]").forEach((el, k) => el.classList.toggle("on", k === i));
    if (i >= 0) input.setAttribute("aria-activedescendant", `sg-${i}`);
    else input.removeAttribute("aria-activedescendant");
  }

  function render() {
    const q = input.value;
    const groups = [];
    const opt = (kind, value, html) => { items.push({ kind, value }); return `<div role="option" id="sg-${items.length - 1}" class="sg sg-${kind}" data-i="${items.length - 1}">${html}</div>`; };
    items = [];
    if (!q.trim()) {
      const rec = ctx.state.recent;
      if (rec.length) groups.push(`<div class="sg-h">Recent searches</div>` + rec.slice(0, 8).map((r) =>
        opt("query", r, `<span class="sg-ic">↺</span><span class="sg-t">${esc(r)}</span><button type="button" class="sg-x" data-rm="${esc(r)}" aria-label="Remove ${esc(r)} from recent searches">✕</button>`)).join(""));
      groups.push(`<div class="sg-h">Explore topics</div><div class="sg-topics">` + ctx.cat.TOPICS.slice(0, 10).map((t) =>
        opt("topic", t.slug, esc(t.label))).join("") + `</div>`);
    } else {
      const s = ctx.search.suggest(q);
      const queries = [q.trim(), ...s.queries.filter((x) => x !== q.trim().toLowerCase())].slice(0, 6);
      groups.push(queries.map((x) => opt("query", x, `<span class="sg-ic">⌕</span><span class="sg-t">${highlight(x, q)}</span>`)).join(""));
      if (s.topics.length) groups.push(`<div class="sg-h">Topics</div>` + s.topics.map((t) =>
        opt("topic", t.slug, `<span class="sg-ic">#</span><span class="sg-t">${esc(t.label)}</span><span class="sg-n">${t.n.toLocaleString()}</span>`)).join(""));
      if (s.channels.length) groups.push(`<div class="sg-h">Channels</div>` + s.channels.map((c) =>
        opt("channel", c.slug, `<span class="sg-ic">◉</span><span class="sg-t">${esc(c.name)}</span><span class="sg-n">${c.tier} tier</span>`)).join(""));
      if (s.paths.length) groups.push(`<div class="sg-h">Paths &amp; courses</div>` + s.paths.map((p) =>
        opt(p.kind === "course" ? "course" : "path", p.slug, `<span class="sg-ic">≡</span><span class="sg-t">${esc(p.title)}</span><span class="sg-n">${p.items.length} videos</span>`)).join(""));
      if (s.videos.length) groups.push(`<div class="sg-h">Videos</div>` + s.videos.map((v) =>
        opt("video", v.id, `<img src="${thumb(v.id, "default")}" alt="" loading="lazy"><span class="sg-t">${esc(v.t)}<small>${esc(ctx.cat.CH[v.ch].name)}${v.d ? " · " + fmtDur(v.d) : ""}</small></span>`)).join(""));
    }
    box.innerHTML = groups.join("");
    box.hidden = !items.length;
    input.setAttribute("aria-expanded", String(!box.hidden));
    active = -1;
  }

  function choose(i) {
    const it = items[i];
    if (!it) return;
    if (it.kind === "query") runQuery(it.value);
    if (it.kind === "topic") go(`#/t/${it.value}`);
    if (it.kind === "course") go(`#/course/${it.value}`);
    if (it.kind === "channel") go(`#/c/${it.value}`);
    if (it.kind === "path") go(`#/${it.kind === "course" ? "course" : "path"}/${it.value}`);
    if (it.kind === "video") { ctx.state.addRecent(input.value); go(`#/watch/${it.value}`); }
  }

  const update = debounce(render, 70);
  input.addEventListener("input", update);
  input.addEventListener("focus", render);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (box.hidden) render();
      e.preventDefault();
      const n = items.length;
      if (n) setActive(e.key === "ArrowDown" ? (active + 1) % n : (active - 1 + n) % n);
    } else if (e.key === "Escape") {
      if (!box.hidden) { e.stopPropagation(); close(); } else input.blur();
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(active);
    }
  });
  box.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the input
  box.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]");
    if (rm) { ctx.state.removeRecent(rm.dataset.rm); render(); return; }
    const o = e.target.closest("[data-i]");
    if (o) choose(+o.dataset.i);
  });
  input.addEventListener("blur", () => setTimeout(close, 120));
  form.addEventListener("submit", (e) => { e.preventDefault(); runQuery(input.value); });
}

function highlight(text, q) {
  const t = q.trim().toLowerCase();
  const i = text.toLowerCase().indexOf(t);
  if (!t || i !== 0) return esc(text);
  return `${esc(text.slice(0, t.length))}<b>${esc(text.slice(t.length))}</b>`;
}
