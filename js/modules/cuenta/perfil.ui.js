// modules/cuenta/perfil.ui.js · Cuenta › Mis datos: lápiz para editar nombres, apellidos, celular y DNI (opcional, 8 dígitos).
// Datos en profiles.full_name / phone / dni (no hay columnas separadas de apellidos: se guarda «Nombres Apellidos» en full_name).
(function () {
  const D = () => window.DL;
  const esc = (v) => D().esc(v);
  const me = { loaded: false, loading: false, edit: false, saving: false, data: null, err: "", errs: {}, uid: null };
  const split = (full) => { const w = String(full || "").trim().split(/\s+/).filter(Boolean); if (w.length <= 1) return [w[0] || "", ""]; return [w.slice(0, w.length - (w.length >= 3 ? 2 : 1)).join(" ") || w[0], w.slice(w.length - (w.length >= 3 ? 2 : 1)).join(" ")]; };
  const normPhone = (v) => { let d = String(v || "").replace(/\D/g, ""); if (d.length === 11 && d.startsWith("51")) d = d.slice(2); return /^9\d{8}$/.test(d) ? d : null; };
  const human = (e) => { const t = String((e && e.message) || e || ""); if (/permission|row-level|42501|401|JWT/i.test(t)) return "Tu cuenta no tiene permiso para editar estos datos. Avísanos por WhatsApp y lo corregimos."; if (/failed to fetch|network/i.test(t)) return "Sin conexión. Revisa tu internet e intenta de nuevo."; return t || "No se pudo guardar."; };

  async function load() {
    const S = D().Store; if (!S.user || me.loading) return;
    me.loading = true; me.err = "";
    try { me.data = await S.v2api.getMyProfile(); me.uid = S.user.id; } catch (e) { me.err = human(e); }
    me.loading = false; me.loaded = true; D().render();
  }
  function view() {
    const st = D().state;
    if (!st.user || D().Store.mode !== "remote" || !D().Store.v2api.getMyProfile) return "";
    if (me.uid && me.uid !== st.user.id) { me.loaded = false; me.data = null; me.edit = false; }
    if (!me.loaded) { setTimeout(load, 0); return `<div class="panel stack me-card"><h3>Mis datos</h3><p class="muted">Cargando…</p></div>`; }
    const p = (me.data && me.data.profile) || {}; const c = me.data && me.data.customer;
    if (!me.edit) {
      return `<div class="panel stack me-card"><div class="row me-head"><h3 style="margin:0">Mis datos</h3>
          <button class="icon-btn" type="button" data-act="me-edit" aria-label="Editar mis datos" title="Editar">${D().icon("pencil", 18)}</button></div>
        ${me.err ? `<p class="alert-text">${esc(me.err)}</p>` : ""}
        <dl><dt>Nombre</dt><dd>${esc(p.full_name || "—")}</dd><dt>Celular</dt><dd>${esc(p.phone || "—")}</dd><dt>DNI</dt><dd>${esc(p.dni || "—")}</dd>${p.username ? `<dt>Usuario</dt><dd>@${esc(p.username)}</dd>` : ""}<dt>Correo</dt><dd>${esc(p.email || st.user.email || "")}</dd></dl>
        ${c && c.document_number && p.dni && c.document_number !== p.dni ? `<p class="tiny">Tus comprobantes salen con ${esc(c.document_type)} ${esc(c.document_number)}. Para cambiarlo acércate a tienda.</p>` : ""}</div>`;
    }
    // conserva lo que el usuario ya escribió si la pantalla se vuelve a pintar
    const live = document.querySelector(".me-form");
    if (live) me.draft = { nombres: live.elements.nombres.value, apellidos: live.elements.apellidos.value, phone: live.elements.phone.value, dni: live.elements.dni.value };
    const [n0, a0] = p.first_name || p.last_name ? [p.first_name || "", p.last_name || ""] : split(p.full_name);
    const d = me.draft || { nombres: n0, apellidos: a0, phone: p.phone || "", dni: p.dni || "" };
    const n = d.nombres, a = d.apellidos;
    const e = me.errs;
    return `<form class="panel stack me-card me-form" data-form="me-profile" novalidate><h3 style="margin:0">Editar mis datos</h3>
      <div class="grid2"><label>Nombres<input name="nombres" autocomplete="given-name" required value="${esc(n)}"><span class="field-err">${esc(e.nombres || "")}</span></label>
      <label>Apellidos<input name="apellidos" autocomplete="family-name" value="${esc(a)}"><span class="field-err">${esc(e.apellidos || "")}</span></label></div>
      <label>Celular (WhatsApp)<input name="phone" inputmode="tel" autocomplete="tel" placeholder="9XXXXXXXX" value="${esc(d.phone)}"><span class="field-err">${esc(e.phone || "")}</span></label>
      <label>DNI (opcional)<input name="dni" inputmode="numeric" maxlength="8" placeholder="8 dígitos" value="${esc(d.dni)}"><span class="field-err">${esc(e.dni || "")}</span></label>
      ${me.err ? `<p class="alert-text">${esc(me.err)}</p>` : ""}
      <div class="row"><button class="btn ghost" type="button" data-act="me-cancel" ${me.saving ? "disabled" : ""}>Cancelar</button><button class="btn" type="submit" ${me.saving ? "disabled" : ""}>${me.saving ? "Guardando…" : "Guardar"}</button></div></form>`;
  }
  async function save(form) {
    const f = new FormData(form); const g = (k) => String(f.get(k) || "").trim().replace(/\s+/g, " ");
    const nombres = g("nombres"), apellidos = g("apellidos"), phoneRaw = g("phone"), dni = g("dni").replace(/\D/g, "");
    const errs = {};
    if (nombres.length < 2) errs.nombres = "Escribe tu nombre.";
    if ((nombres + " " + apellidos).length > 120) errs.apellidos = "Demasiado largo.";
    const phone = phoneRaw ? normPhone(phoneRaw) : "";
    if (phoneRaw && !phone) errs.phone = "9 dígitos que empiezan con 9 (ej. 931246675).";
    if (g("dni") && !/^\d{8}$/.test(dni)) errs.dni = "El DNI tiene 8 dígitos.";
    me.errs = errs; me.err = "";
    if (Object.keys(errs).length) { D().render(); return; }
    me.saving = true; D().render();
    try {
      const r = await D().Store.v2api.saveMyProfile({ first_name: nombres, last_name: apellidos, full_name: (nombres + " " + apellidos).trim(), phone, dni, customer_id: me.data && me.data.customer && me.data.customer.id });
      me.data.profile = Object.assign({}, me.data.profile, r.profile); me.edit = false; me.saving = false; me.draft = null;
      if (D().state.user) D().state.user.full_name = r.profile.full_name;
      D().render(); D().toast(r.customerNote ? "Datos guardados. " + r.customerNote : "Datos guardados", "ok");
    } catch (e) { me.saving = false; me.err = human(e); D().render(); }
  }
  window.DL_PERFIL = { view };
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "me-edit": () => { me.edit = true; me.draft = null; me.errs = {}; me.err = ""; D().render(); setTimeout(() => { const i = document.querySelector('.me-form input[name="nombres"]'); if (i) i.focus(); }, 30); },
    "me-cancel": () => { me.edit = false; me.draft = null; me.errs = {}; me.err = ""; D().render(); },
  });
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, { "me-profile": (form) => save(form) });
})();
