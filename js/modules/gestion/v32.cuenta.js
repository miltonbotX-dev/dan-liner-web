// modules/gestion/v32.cuenta.js · Mi cuenta (BD v17): etiquetas visibles para el cliente (get_my_tags) y «Mi PIN de cierre» del encargado.
(function () {
  const V = () => window.DL_V15; const X = () => window.DL_V17; const D = () => window.DL;
  const esc = (v) => V().esc(v);
  const T = { data: null, loaded: false }; const P = { data: null, loaded: false, err: "", done: false };
  const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c : "#888888");
  function isManager() {
    const d = D(); const u = d.state.user; if (!u) return false;
    if (d.allow(["SUPERVISOR"])) return true; // admin incluido
    return ((d.state.data || {}).stores || []).some((s) => s.manager_id === u.id || (s.manager_ids || []).includes(u.id));
  }
  window.DL_CUENTA_EXTRA = () => {
    if (!X().on()) return "";
    let out = "";
    if (D().isClient && D().isClient()) {
      if (!T.loaded) setTimeout(() => V().once("v17tags", () => X().call("myTags", {}), T), 0);
      const tags = Array.isArray(T.data) ? T.data : [];
      if (tags.length) out += `<div class="my-tags" aria-label="Tus distinciones"><span class="tiny muted">Tus distinciones</span><div class="tags">${tags.map((t) => `<span class="tag-chip" style="--c:${safeColor(t.color)}">${esc(t.name)}</span>`).join("")}</div></div>`;
    }
    if (isManager()) out += `<a class="btn ghost small" href="#cuenta/pin" style="justify-self:start">Mi PIN de cierre de caja</a>`;
    return out ? `<div class="stack" style="margin:12px 0">${out}</div>` : "";
  };
  function renderPin() {
    if (!X().on()) return `<p class="muted">Disponible con la actualización de la base (v17).</p>`;
    if (!isManager()) return `<p class="muted">Solo el encargado de tienda, supervisor o administrador tiene PIN de cierre.</p>`;
    if (!P.loaded) setTimeout(() => V().once("v17pin", () => X().call("hasMyPin", {}).catch(() => null), P), 0);
    const has = P.data === true || !!(P.data && P.data.has_pin);
    return `<form class="close-auth me-form" data-form="v17-mypin" novalidate autocomplete="off">
      <div class="row" style="gap:12px;justify-content:flex-start"><span class="lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>
        <div><h2 style="margin:0;font-size:20px">Mi PIN de cierre</h2><p class="tiny muted" style="margin:0">${has ? "Ya tienes un PIN. Escribe uno nuevo para cambiarlo." : "Con este PIN autorizas el cierre de caja de tu tienda."} Se guarda cifrado: nadie lo puede ver, ni el administrador. Tras 5 intentos fallidos se bloquea 15 minutos.</p></div></div>
      <label>PIN ${has ? "nuevo " : ""}(4 a 8 números)<span class="pw-wrap"><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" required data-err="El PIN tiene de 4 a 8 números." autocomplete="new-password"></span><span class="field-err"></span></label>
      <label>Repite el PIN<span class="pw-wrap"><input name="pin2" type="password" inputmode="numeric" maxlength="8" required data-err="Repite el PIN." autocomplete="new-password"></span><span class="field-err"></span></label>
      ${P.err ? `<p class="field-err" role="alert">${esc(P.err)}</p>` : ""}${P.done ? `<p class="tiny" role="status">PIN guardado ✓</p>` : ""}
      <button class="btn" type="submit">Guardar PIN</button></form>`;
  }
  window.DL_CUENTA_SUB = Object.assign(window.DL_CUENTA_SUB || {}, { pin: renderPin });
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, {
    "v17-mypin": async (form) => {
      const pin = form.elements.pin.value.trim(); P.err = ""; P.done = false;
      if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) { window.DL_FIELD_ERR(form, "pin", "Elige un PIN menos obvio (no 1111 ni 1234)."); return; }
      if (form.elements.pin2.value.trim() !== pin) { window.DL_FIELD_ERR(form, "pin2", "Los PIN no coinciden."); return; }
      try { await X().call("setMyPin", { p_pin: pin }); P.done = true; P.loaded = false; V().toast("PIN de cierre guardado ✓", "ok"); }
      catch (e) { P.err = e.missing ? e.message : String((e && e.message) || "No se pudo guardar"); setTimeout(() => window.DL_FIELD_ERR(document.querySelector('[data-form="v17-mypin"]'), "pin", P.err), 0); }
      V().rerender();
    },
  });
})();
