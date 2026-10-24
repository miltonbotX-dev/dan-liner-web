// modules/estilo/select.ui.js · IU v34: reemplaza todas las listas nativas (<select>) por un selector propio.
// El <select> original sigue en el DOM (oculto) para que formularios, .value y eventos "change" funcionen igual.
// Para dejar uno nativo: <select data-native>. Con más de 7 opciones aparece un buscador.
(() => {
  if (window.DL_SELECT) return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const label = (sel) => { const o = sel.options[sel.selectedIndex]; return o ? o.textContent.trim() : ""; };
  let open = null;

  function enhance(sel) {
    if (sel.dataset.dlSel || sel.multiple || sel.hasAttribute("data-native") || sel.size > 1) return;
    sel.dataset.dlSel = "1";
    sel.classList.add("dl-sel-native");
    sel.tabIndex = -1;
    const b = document.createElement("button");
    b.type = "button"; b.className = "dl-sel"; b.setAttribute("aria-haspopup", "listbox");
    b.innerHTML = `<span class="dl-sel-v"></span>`;
    sel.after(b);
    sel._dlBtn = b; b._dlSel = sel;
    sync(sel);
  }
  function sync(sel) {
    const b = sel._dlBtn; if (!b) return;
    const t = label(sel), ph = sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].value === "";
    const v = b.querySelector(".dl-sel-v"), txt = t || "Elegir…";
    if (v.textContent !== txt) v.textContent = txt;
    if (b.classList.contains("is-ph") !== !!ph) b.classList.toggle("is-ph", !!ph);
    if (b.disabled !== sel.disabled) b.disabled = sel.disabled;
    const name = sel.getAttribute("aria-label") || (sel.closest("label") && sel.closest("label").firstChild && sel.closest("label").firstChild.textContent.trim()) || "";
    const al = name ? name + ": " + (t || "elegir") : null;
    if (al && b.getAttribute("aria-label") !== al) b.setAttribute("aria-label", al);
  }
  function close() {
    if (!open) return;
    const { sheet, btn } = open; open = null;
    sheet.classList.add("is-out"); document.body.classList.remove("dl-sel-lock");
    setTimeout(() => sheet.remove(), 180);
    btn && btn.focus({ preventScroll: true });
  }
  function show(btn) {
    const sel = btn._dlSel; if (!sel || sel.disabled) return;
    close();
    const opts = [...sel.options].filter((o) => !o.hidden);
    const many = opts.length > 7;
    const title = (btn.getAttribute("aria-label") || "").split(":")[0] || "Elige una opción";
    const sheet = document.createElement("div");
    sheet.className = "dl-sel-sheet";
    sheet.innerHTML = `<div class="dl-sel-scrim" data-x></div><div class="dl-sel-panel" role="dialog" aria-label="${esc(title)}">
      <div class="dl-sel-head"><b>${esc(title)}</b><button type="button" class="dl-sel-close" data-x aria-label="Cerrar">×</button></div>
      ${many ? `<input class="dl-sel-q" type="search" placeholder="Buscar…" autocomplete="off" aria-label="Buscar">` : ""}
      <div class="dl-sel-list" role="listbox">${opts.map((o) => {
        const grp = o.parentElement && o.parentElement.tagName === "OPTGROUP" ? o.parentElement.label : "";
        return `<button type="button" role="option" class="dl-sel-opt${o.selected ? " on" : ""}${o.value === "" ? " is-ph" : ""}" data-i="${o.index}" ${o.disabled ? "disabled" : ""} aria-selected="${o.selected}" data-q="${esc(norm(o.textContent + " " + grp))}">${grp ? `<small>${esc(grp)}</small>` : ""}<span>${esc(o.textContent.trim() || "—")}</span></button>`;
      }).join("")}<p class="dl-sel-none" hidden>Sin resultados</p></div></div>`;
    document.body.appendChild(sheet);
    document.body.classList.add("dl-sel-lock");
    // en escritorio, debajo del botón
    if (window.matchMedia("(min-width:721px)").matches) {
      const r = btn.getBoundingClientRect(), p = sheet.querySelector(".dl-sel-panel");
      const below = window.innerHeight - r.bottom;
      p.style.left = Math.min(r.left, window.innerWidth - Math.max(r.width, 260) - 12) + "px";
      p.style.minWidth = Math.max(r.width, 220) + "px";
      if (below > 280 || below > r.top) p.style.top = r.bottom + 6 + "px"; else p.style.bottom = window.innerHeight - r.top + 6 + "px";
    }
    open = { sheet, btn };
    const q = sheet.querySelector(".dl-sel-q");
    const cur = sheet.querySelector(".dl-sel-opt.on");
    cur && cur.scrollIntoView({ block: "center" });
    (q || cur || sheet.querySelector(".dl-sel-opt")) && setTimeout(() => (q || cur || sheet.querySelector(".dl-sel-opt")).focus({ preventScroll: true }), 30);
    if (q) q.addEventListener("input", () => {
      const v = norm(q.value); let n = 0;
      sheet.querySelectorAll(".dl-sel-opt").forEach((b) => { const ok = !v || b.dataset.q.includes(v); b.hidden = !ok; n += ok; });
      sheet.querySelector(".dl-sel-none").hidden = n > 0;
    });
    sheet.addEventListener("click", (e) => {
      if (e.target.closest("[data-x]")) return close();
      const o = e.target.closest(".dl-sel-opt"); if (!o || o.disabled) return;
      const i = Number(o.dataset.i);
      if (sel.selectedIndex !== i) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      sync(sel); close();
    });
    sheet.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = [...sheet.querySelectorAll(".dl-sel-opt:not([hidden]):not([disabled])")];
        const k = list.indexOf(document.activeElement);
        const n = list[e.key === "ArrowDown" ? Math.min(k + 1, list.length - 1) : Math.max(k - 1, 0)];
        n && n.focus();
      }
      if (e.key === "Enter" && e.target.classList.contains("dl-sel-q")) {
        e.preventDefault(); const f = sheet.querySelector(".dl-sel-opt:not([hidden]):not([disabled])"); f && f.click();
      }
    });
  }
  function scan(root) {
    (root || document).querySelectorAll("select:not([data-dl-sel])").forEach(enhance);
    document.querySelectorAll("select[data-dl-sel]").forEach((s) => { if (!s._dlBtn || !s._dlBtn.isConnected) { delete s.dataset.dlSel; enhance(s); } else sync(s); });
  }
  document.addEventListener("click", (e) => { const b = e.target.closest(".dl-sel"); if (b) { e.preventDefault(); show(b); } });
  document.addEventListener("change", (e) => { if (e.target.matches && e.target.matches("select[data-dl-sel]")) sync(e.target); }, true);
  // reset de formularios
  document.addEventListener("reset", (e) => setTimeout(() => e.target.querySelectorAll && e.target.querySelectorAll("select[data-dl-sel]").forEach(sync)), true);
  let t = 0;
  const mine = (n) => n && n.nodeType === 1 ? n.closest(".dl-sel, .dl-sel-sheet") || n.matches(".dl-sel, .dl-sel-sheet") : n && n.parentElement && n.parentElement.closest(".dl-sel, .dl-sel-sheet");
  const mo = new MutationObserver((list) => {
    const ours = (m) => mine(m.target) || (m.type === "childList" && [...m.addedNodes, ...m.removedNodes].every(mine));
    if (list.every(ours)) return; cancelAnimationFrame(t); t = requestAnimationFrame(() => scan()); });
  const start = () => { scan(); mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] }); };
  // cambios por código (sel.value = x) no disparan eventos: los vigilamos
  const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (d && d.set) Object.defineProperty(HTMLSelectElement.prototype, "value", { get: d.get, set(v) { d.set.call(this, v); this._dlBtn && sync(this); }, configurable: true });
  window.addEventListener("hashchange", close);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
  window.DL_SELECT = { scan, sync, close };
})();
