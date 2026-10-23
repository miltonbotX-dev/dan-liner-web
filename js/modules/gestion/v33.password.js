// modules/gestion/v33.password.js · Admin cambia la contraseña de un cliente o de alguien del equipo (lápiz en la ficha).
// Dos caminos: «Poner contraseña nueva» (mín. 8, con ojito) o «Enviar enlace para cambiarla» (correo de Supabase Auth).
// Las contraseñas están cifradas: NO existe «ver contraseña» en ningún lado.
// «Poner nueva» va SIEMPRE por la Edge Function admin-set-password (decisión del Admin): ella llama can_reset_user_password y log_password_reset (v18).
// La clave service_role nunca está en el navegador: la usa solo la Edge Function en el servidor.
(function () {
  const D = () => window.DL; const V = () => window.DL_V15;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const FN = { edge: "admin-set-password" };
  const PENCIL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>';
  const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const WEAK = /^(12345678|123456789|password|contraseña|qwerty123|11111111|00000000)$/i;
  const canUse = () => !!(D() && D().isAdmin && D().isAdmin());

  // Botón para las fichas (Clientes y Equipo). Sin cuenta web o sin permiso no aparece.
  window.DL_PW_BTN = (uid, email, name) => {
    if (!uid || !canUse()) return "";
    if (D().state.user && D().state.user.id === uid) return "";
    return `<button type="button" class="edit-btn pw-admin-btn" data-act="pw-admin" data-uid="${esc(uid)}" data-email="${esc(email || "")}" data-name="${esc(name || "")}" aria-label="Cambiar contraseña" title="Cambiar contraseña">${PENCIL}</button>`;
  };

  function fnUrl() { const c = (window.DL_CONFIG || {}); return String(c.SUPABASE_URL || (window.Store && window.Store.cfg && window.Store.cfg.url) || "").replace(/\/$/, "") + "/functions/v1/" + FN.edge; }
  function jwt() { const s = window.Store; return s && s.token && s.token.access_token; }
  async function viaFunction(body) {
    const t = jwt(); if (!t) throw new Error("Tu sesión venció. Inicia sesión otra vez.");
    let res;
    try { res = await fetch(fnUrl(), { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t, apikey: (window.DL_CONFIG || {}).SUPABASE_ANON_KEY || "" }, body: JSON.stringify(body) }); }
    catch { const e = new Error("El cambio de contraseña aún no está activo en el servidor."); e.missing = true; throw e; }
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) { const e = new Error("El cambio de contraseña aún no está activo en el servidor."); e.missing = true; throw e; }
    if (!res.ok) throw new Error(data.error || "No se pudo completar.");
    return data;
  }
  async function setPassword(uid, pw) {
    return viaFunction({ user_id: uid, mode: "set", password: pw });
  }
  async function sendLink(uid, email) {
    // Con función desplegada se hace del lado servidor (y queda auditado); si no, el mismo correo de «Olvidé mi contraseña».
    try { return await viaFunction({ user_id: uid, mode: "link" }); }
    catch (e) {
      if (!e.missing) throw e;
      if (!email) throw new Error("Ese usuario no tiene correo registrado.");
      await window.Store.recoverPassword(email, location.origin + location.pathname);
      return { ok: true, mode: "link" };
    }
  }

  function open(btn) {
    const uid = btn.dataset.uid, email = btn.dataset.email, name = btn.dataset.name || "este usuario";
    const prev = document.activeElement;
    const w = document.createElement("div"); w.className = "dl-confirm dl-dlg-prompt pw-admin"; w.setAttribute("role", "dialog"); w.setAttribute("aria-modal", "true"); w.setAttribute("aria-labelledby", "pw-admin-t");
    let mode = "set";
    const draw = () => {
      w.innerHTML = `<div><h3 class="dl-dlg-title" id="pw-admin-t">Contraseña de ${esc(name)}</h3>
        <p class="tiny muted" style="margin:0">Las contraseñas se guardan cifradas: nadie puede verlas. Puedes poner una nueva o enviarle un enlace para que la cambie.</p>
        <div class="pw-modes" role="radiogroup" aria-label="Cómo cambiarla">
          <button type="button" class="chip ${mode === "set" ? "on" : ""}" role="radio" aria-checked="${mode === "set"}" data-m="set">Poner contraseña nueva</button>
          <button type="button" class="chip ${mode === "link" ? "on" : ""}" role="radio" aria-checked="${mode === "link"}" data-m="link">Enviar enlace para cambiarla</button></div>
        <form novalidate class="stack" data-pw-form autocomplete="off">
          ${mode === "set" ? `<label>Contraseña nueva (mínimo 8)<span class="pw-wrap"><input name="pw" type="password" data-eye="1" minlength="8" maxlength="72" autocomplete="new-password" spellcheck="false" autocapitalize="off"><button type="button" class="pw-eye" data-eye-t aria-label="Mostrar contraseña">${EYE}</button></span><span class="field-err"></span></label>
            <p class="tiny muted" style="margin:0">Dísela en persona o por WhatsApp. Le recomendamos cambiarla al entrar.</p>`
          : `<p style="margin:0">Le llegará un correo a <b>${esc(email || "(sin correo)")}</b> con un enlace para poner su contraseña.</p><span class="field-err" data-gen></span>`}
          <div class="row"><button type="button" class="btn ghost" data-r="no">Cancelar</button><button type="submit" class="btn">${mode === "set" ? "Guardar contraseña" : "Enviar enlace"}</button></div>
        </form></div>`;
      const inp = w.querySelector('input[name="pw"]');
      if (inp) setTimeout(() => inp.focus(), 30);
    };
    const close = () => { document.removeEventListener("keydown", onKey, true); w.remove(); try { prev && prev.focus && prev.focus(); } catch { } };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    const err = (msg) => { const f = w.querySelector(".field-err"); if (f) { f.textContent = msg; f.setAttribute("role", "alert"); } const i = w.querySelector("input"); if (i) i.setAttribute("aria-invalid", "true"); };
    w.addEventListener("click", (e) => {
      if (e.target === w) return close();
      const m = e.target.closest("[data-m]"); if (m) { mode = m.dataset.m; draw(); return; }
      const t = e.target.closest("[data-eye-t]"); if (t) { const i = w.querySelector('input[name="pw"]'); const show = i.type === "password"; i.type = show ? "text" : "password"; t.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña"); return; }
      if (e.target.closest('[data-r="no"]')) close();
    });
    w.addEventListener("submit", async (e) => {
      e.preventDefault();
      const b = w.querySelector('button[type="submit"]');
      try {
        if (mode === "set") {
          const pw = w.querySelector('input[name="pw"]').value;
          if (pw.length < 8) return err("Mínimo 8 caracteres.");
          if (/^\s|\s$/.test(pw)) return err("Sin espacios al inicio ni al final.");
          if (WEAK.test(pw)) return err("Muy fácil de adivinar. Elige otra.");
          b.disabled = true; b.textContent = "Guardando…";
          await setPassword(uid, pw); close(); V().toast("Contraseña cambiada ✓", "ok");
        } else {
          b.disabled = true; b.textContent = "Enviando…";
          await sendLink(uid, email); close(); V().toast("Enlace enviado ✓", "ok");
        }
      } catch (x) { b.disabled = false; b.textContent = mode === "set" ? "Guardar contraseña" : "Enviar enlace"; err(String((x && x.message) || "No se pudo completar.")); }
    });
    document.addEventListener("keydown", onKey, true);
    draw(); document.body.appendChild(w);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest('[data-act="pw-admin"]'); if (b) { e.preventDefault(); e.stopPropagation(); open(b); } }, true);
  window.DL_V33_PW = { FN, setPassword, sendLink, open };
})();
