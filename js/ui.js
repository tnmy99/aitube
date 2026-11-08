/* Shared UI pieces: infinite grids, toasts, the card action menu, modals. */
import { $, esc, ytUrl } from "./util.js";

/** Infinite grid. producer(n) returns n HTML strings (or [] when the list is done). */
export function infiniteGrid(container, producer, opts = {}) {
  let done = false;
  const sentinel = document.createElement("div");
  sentinel.className = "sentinel";
  const more = () => {
    if (done) return;
    const html = producer(opts.batch || 18);
    if (!html.length) {
      done = true;
      sentinel.remove();
      if (!container.children.length && opts.empty) {
        container.insertAdjacentHTML("afterend", `<div class="empty">${opts.empty}</div>`);
      }
      return;
    }
    container.insertAdjacentHTML("beforeend", html.join(""));
    // A tall window can keep the sentinel inside the root margin after a batch, and then no
    // new intersection fires. Keep filling until it is pushed out of view (or the list ends).
    requestAnimationFrame(() => {
      if (done) return;
      const r = sentinel.getBoundingClientRect();
      if (r.top < innerHeight + 800) more();
    });
  };
  container.after(sentinel);
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) more(); },
    { rootMargin: "1000px" });
  io.observe(sentinel);
  more();
  return () => { io.disconnect(); sentinel.remove(); };
}

/* ---------- toasts ---------- */
let toastTimer = 0;
export function toast(msg, action) {
  const el = $("#toast");
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : "");
  el.classList.add("show");
  if (action) el.querySelector("button").onclick = () => { action.run(); el.classList.remove("show"); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), action ? 6000 : 2600);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export const shareUrl = (id, start = 0) =>
  `${location.origin}${location.pathname}#/watch/${id}${start ? "?t=" + start : ""}`;

/* ---------- modal ---------- */
let lastFocus = null;
export function openModal(html, { label = "Dialog", onClose } = {}) {
  const m = $("#modal");
  lastFocus = document.activeElement;
  m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(label)}">
    <button type="button" class="icon-btn modal-x" aria-label="Close">✕</button>${html}</div>`;
  m.hidden = false;
  document.body.classList.add("modal-open");
  const close = () => {
    m.hidden = true;
    m.innerHTML = "";
    document.body.classList.remove("modal-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (onClose) onClose();
  };
  m.onclick = (e) => { if (e.target === m || e.target.closest(".modal-x")) close(); };
  m.onkeydown = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  (m.querySelector("[autofocus]") || m.querySelector(".modal-x")).focus();
  return close;
}
export const modalOpen = () => !$("#modal").hidden;

/* ---------- card action menu (⋮) ---------- */
export function installCardMenu(ctx) {
  const menu = $("#cardmenu");
  let current = null;
  const hide = () => { menu.hidden = true; current = null; };
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-menu]");
    if (!btn) { if (!e.target.closest("#cardmenu")) hide(); return; }
    e.preventDefault();
    const id = btn.dataset.menu;
    if (current === id) return hide();
    current = id;
    const st = ctx.state;
    menu.innerHTML = `
      <button type="button" data-act="later">${st.has("later", id) ? "Remove from Watch later" : "Save to Watch later"}</button>
      <button type="button" data-act="like">${st.has("likes", id) ? "Unlike" : "Like"}</button>
      <button type="button" data-act="seen">${st.has("seen", id) ? "Mark as unwatched" : "Mark as watched"}</button>
      <button type="button" data-act="hide">Not interested</button>
      <button type="button" data-act="copy">Copy link</button>
      <a href="${ytUrl(id)}" target="_blank" rel="noopener" data-act="yt">Open on YouTube ↗</a>`;
    const r = btn.getBoundingClientRect();
    menu.hidden = false;
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
    menu.style.top = (r.bottom + h + 8 > innerHeight ? r.top - h - 4 : r.bottom + 4) + scrollY + "px";
    menu.querySelector("button").focus();
  });
  menu.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act || !current) return;
    const id = current, st = ctx.state;
    hide();
    if (act === "later") toast(st.toggle("later", id) ? "Saved to Watch later" : "Removed from Watch later");
    if (act === "like") toast(st.toggle("likes", id) ? "Liked. Recommendations will use it." : "Like removed");
    if (act === "seen") { if (st.has("seen", id)) st.unsee(id); else st.markSeen(id); toast("Updated"); }
    if (act === "copy") toast((await copyText(shareUrl(id))) ? "Link copied" : "Could not copy");
    if (act === "hide") {
      st.hide(id);
      document.querySelectorAll(`.vcard[data-id="${id}"], .row[data-id="${id}"]`).forEach((c) => c.classList.add("gone"));
      toast("Hidden. You'll see less like this.", { label: "Undo", run: () => {
        st.toggle("hidden", id);
        document.querySelectorAll(`.vcard[data-id="${id}"], .row[data-id="${id}"]`).forEach((c) => c.classList.remove("gone"));
      } });
    }
    if (act === "yt") hide();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) hide(); });
  window.addEventListener("hashchange", hide);
}
