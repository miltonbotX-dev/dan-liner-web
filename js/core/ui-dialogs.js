// core/ui-dialogs.js · avisos y confirmaciones propias (sin alert/confirm/prompt del navegador). Estilos: .dl-confirm y .dl-notice de IU.
(function () {
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RISKY = /anular|eliminar|quitar|borrar|cancelar|cerrar|liquidar|rechaz|desactiv|terminad/i;
  function modal(message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const wrap = document.createElement("div"); wrap.className = "dl-confirm"; wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true");
      const danger = opts.danger != null ? opts.danger : (!opts.input && RISKY.test(message));
      const choices = opts.choices || null;
      wrap.innerHTML = `<div><p class="dl-confirm-msg" style="white-space:pre-line;margin:0">${esc(message)}</p>
        ${choices ? `<div class="row" style="flex-wrap:wrap;justify-content:flex-start">${choices.map(([v, l]) => `<button type="button" class="chip ${String(v) === String(opts.value || "") ? "on" : ""}" data-v="${esc(v)}">${esc(l)}</button>`).join("")}</div>` : ""}
        ${opts.input && !choices ? `<input class="dl-confirm-input" type="${opts.type || "text"}" ${opts.inputmode ? `inputmode="${opts.inputmode}"` : ""} autocomplete="off" value="${esc(opts.value == null ? "" : opts.value)}" placeholder="${esc(opts.placeholder || "")}">` : ""}
        <div class="row"><button type="button" class="btn ghost" data-r="no">${esc(opts.cancel || "Cancelar")}</button>${choices ? "" : `<button type="button" class="btn ${danger ? "danger" : ""}" data-r="ok">${esc(opts.ok || (danger ? "Sí, continuar" : "Aceptar"))}</button>`}</div></div>`;
      const inp = wrap.querySelector("input");
      const done = (v) => { document.removeEventListener("keydown", onKey, true); wrap.remove(); try { prev && prev.focus && prev.focus(); } catch { } resolve(v); };
      const ok = () => done(opts.input ? (inp ? inp.value : "") : true);
      const no = () => done(opts.input ? null : false);
      const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); no(); } else if (e.key === "Enter" && (inp ? document.activeElement === inp : true) && !choices) { e.preventDefault(); ok(); } };
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) return no();
        const c = e.target.closest("[data-v]"); if (c) return done(c.dataset.v);
        const b = e.target.closest("[data-r]"); if (b) return b.dataset.r === "ok" ? ok() : no();
      });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(wrap);
      setTimeout(() => { const f = inp || wrap.querySelector(choices ? "[data-v]" : '[data-r="ok"]'); if (f) { f.focus(); if (inp && inp.select) inp.select(); } }, 30);
    });
  }
  let noticeTimer = null;
  window.DL_UI = {
    confirm: (message, opts) => modal(message, opts),
    prompt: (message, value, opts) => modal(message, Object.assign({ input: true, value }, opts || {})),
    choose: (message, choices, value) => modal(message, { input: true, choices, value }),
    notice(message, kind) {
      let n = document.querySelector(".dl-notice"); if (!n) { n = document.createElement("div"); n.setAttribute("role", "status"); document.body.appendChild(n); }
      n.className = "dl-notice" + (kind ? " " + kind : ""); n.textContent = message;
      clearTimeout(noticeTimer); noticeTimer = setTimeout(() => n.remove(), kind === "error" ? 6000 : 3500);
    },
  };
})();
