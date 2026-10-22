// modules/gestion/v32.caja.js · Caja (BD v17): aviso de fin de turno (.shift-alert), caja lista para tomar,
// autorización de cierre con PIN del encargado (.close-auth), resumen de cierre (.close-summary / .is-bad) y descuadre (.diff-banner).
(function () {
  const V = () => window.DL_V15; const X = () => window.DL_V17; const D = () => window.DL;
  const esc = (v) => V().esc(v);
  const soles = (c) => String(D().soles(c)).replace(/<[^>]+>/g, "");
  const AL = { data: null, at: 0, busy: false };
  const AUTH = { err: "", locked: false, required: false, pw: false };
  function loadAlerts() {
    if (AL.busy || Date.now() - AL.at < 120e3) return; AL.busy = true;
    X().call("myCashAlerts", {}).then((r) => { AL.data = r || {}; }).catch(() => { AL.data = AL.data || {}; }).finally(() => { AL.busy = false; AL.at = Date.now(); V().rerender(); });
  }
  setInterval(() => { if (X() && X().on() && /^#caja/.test(location.hash)) { AL.at = 0; loadAlerts(); } }, 150e3);
  const hhmm = (t) => String(t || "").slice(0, 5);
  window.DL_CAJA_TOP = (ses) => {
    if (!X().on()) return "";
    loadAlerts(); const a = AL.data || {}; let out = "";
    (a.open_sessions || []).forEach((o) => {
      if (o.overdue) out += `<div class="shift-alert" role="alert"><div><b>Terminó tu turno · ${esc(o.store_name)}</b><span class="tiny">La tienda cierra a las ${esc(hhmm(o.closes_at))}${o.minutes_over ? ` (hace ${o.minutes_over} min)` : ""}. Cuenta el efectivo y cierra «${esc(o.register_name)}».</span></div><button class="btn small" type="button" data-act="cj-tab" data-id="cuadre">Cerrar caja</button></div>`;
    });
    if (!ses) (a.ready_registers || []).slice(0, 2).forEach((r) => {
      out += `<div class="shift-alert"><div><b>Caja lista: ${esc(r.register_name)}</b><span class="tiny">${esc(r.store_name)} · fondo ${soles(Math.round(Number(r.ready_amount || 0) * 100))} (fijo, del cierre anterior)</span></div><button class="btn small" type="button" data-act="v17-claim" data-id="${esc(r.register_id)}">Tomar caja</button></div>`;
    });
    const bad = (a.notifications || []).filter((n) => n.kind === "CAJA_DESCUADRE" && !n.is_read).slice(0, 3);
    bad.forEach((n) => { out += `<div class="diff-banner" role="alert"><span>${esc(n.title)}${n.body ? " — " + esc(n.body) : ""}</span></div>`; });
    return out ? `<div class="stack" style="margin:10px 0">${out}</div>` : "";
  };
  // resumen del cierre (se pinta mientras el encargado escribe lo contado) — no depende de la BD
  window.DL_CLOSE_SUMMARY = ({ diff, cash, float, exp, counted }) => `<div class="close-summary">
      <div><span class="tiny">Esperado</span><b>${soles(exp)}</b></div>
      <div><span class="tiny">Contado</span><b>${soles(counted)}</b></div>
      <div class="${diff ? "is-bad" : ""}"><span class="tiny">${diff < 0 ? "Falta" : diff > 0 ? "Sobra" : "Diferencia"}</span><b>${diff ? soles(Math.abs(diff)) : "Cuadra"}</b></div>
      <div><span class="tiny">Efectivo a entregar</span><b>${soles(cash - float)}</b></div></div>
    ${diff ? `<div class="diff-banner" role="alert"><span>Descuadre de ${soles(Math.abs(diff))} (${diff < 0 ? "falta" : "sobra"}). Al cerrar se avisa al administrador.</span></div>` : ""}`;
  window.DL_CLOSE_DONE = (r, info) => {
    if (info && info.diff) V().toast("Cierre con descuadre: se avisó al administrador", "error");
  };
  // autorización con PIN del encargado (close_register_with_pin; un PIN equivocado devuelve ok:false con attempts_left)
  const AP = {};
  function approvers(storeId) {
    const k = String(storeId || ""); const box = AP[k] || (AP[k] = { loaded: false });
    if (!box.loaded) setTimeout(() => V().once("ap" + k, () => X().call("approvers", { p_store_id: Number(storeId) }), box), 0);
    return box;
  }
  window.DL_CLOSE_AUTH = {
    active: () => X().on() && !AUTH.pw,
    require: () => { AUTH.required = true; },
    wants: (form) => !!(form.elements.approver || form.dataset.noApprover),
    inline: (ses, canClose) => {
      if (canClose && !AUTH.required) return "";
      const box = approvers(ses ? ses.store_id : D().ui.storeId); const list = Array.isArray(box.data) ? box.data : [];
      if (!box.loaded) return `<div class="close-auth"><p class="tiny muted">Cargando encargados…</p></div>`;
      if (!list.length) return `<div class="close-auth"><b>Falta el PIN del encargado</b><p class="tiny muted" style="margin:0">Ningún encargado de esta tienda creó su PIN de cierre todavía (Mi cuenta → Mi PIN de cierre de caja).</p>
        <button class="btn ghost small" type="button" data-act="cl-pw">Autorizar con usuario y clave del encargado</button></div>`;
      return `<div class="close-auth"><div class="row" style="gap:12px;justify-content:flex-start"><span class="lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>
          <div><b>Autoriza el cierre</b><p class="tiny muted" style="margin:0">El encargado elige su nombre y escribe su PIN. Tras 5 intentos fallidos el PIN se bloquea 15 minutos.</p></div></div>
        <label>Encargado<select name="approver" required data-err="Elige al encargado que autoriza.">${list.length > 1 ? `<option value="">Elige…</option>` : ""}${list.map((p) => `<option value="${esc(p.user_id)}">${esc(p.name)}</option>`).join("")}</select></label>
        <label>PIN de cierre<span class="pw-wrap"><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" required data-err="Escribe el PIN (4 a 8 números)." autocomplete="off" ${AUTH.locked ? "disabled" : ""}></span><span class="field-err" role="alert">${esc(AUTH.err)}</span></label></div>`;
    },
    close: async (ses, counted, note, fl, form) => {
      if (!form.elements.approver) return { ok: false };
      try {
        const r = (await X().call("closeWithPin", { p_session_id: Number(ses.id), p_counted: Number(counted.CASH || 0) / 100, p_left_for_next_day: fl / 100, p_note: note, p_supervisor_id: form.elements.approver.value, p_pin: form.elements.pin.value.trim() })) || {};
        if (r.ok === false) {
          AUTH.err = (r.error || "PIN incorrecto.") + (r.locked ? "" : r.attempts_left != null ? ` Te quedan ${r.attempts_left} intento${r.attempts_left === 1 ? "" : "s"}.` : "");
          AUTH.locked = !!r.locked; window.DL_FIELD_ERR(form, "pin", AUTH.err); form.elements.pin.value = ""; if (r.locked) form.elements.pin.disabled = true;
          if (r.locked) V().toast("PIN bloqueado 15 minutos por intentos fallidos", "error");
          return r;
        }
        AUTH.err = ""; AUTH.locked = false; AUTH.required = false; return r;
      } catch (e) {
        const m = String((e && e.message) || "");
        if (/bloquead|PIN|encargado/i.test(m)) { AUTH.err = m; window.DL_FIELD_ERR(form, /encargado/i.test(m) && !/PIN/.test(m) ? "approver" : "pin", m); return { ok: false }; }
        throw e;
      }
    },
  };
  window.DL_CLOSE_DONE = (r) => { if (r && (r.has_discrepancy || Number(r.difference || r.cash_difference || 0))) V().toast("Cierre con descuadre: se avisó al administrador", "error"); };
  // Admin → Cajas: apertura automática y «cierre con PIN» por tienda (set_store_schedule; por defecto apagado)
  window.DL_CASH_STORE_EXTRA = (s) => {
    if (!X().on() || !D().isAdmin()) return "";
    return `<div class="row tiny" style="gap:14px;flex-wrap:wrap;flex-basis:100%">
      <label class="checks"><input type="checkbox" data-act="cx-flag" data-k="auto_open" data-id="${esc(s.store_id)}" ${s.auto_open ? "checked" : ""}> Apertura automática (${esc(hhmm(s.opens_at) || "09:00")})</label>
      <label class="checks"><input type="checkbox" data-act="cx-flag" data-k="close_requires_pin" data-id="${esc(s.store_id)}" ${s.close_requires_pin ? "checked" : ""}> Cierre solo con PIN del encargado</label>
      ${Number(s.discrepancies_7d || 0) ? `<span class="diff-amt neg">${Number(s.discrepancies_7d)} descuadre(s) en 7 días</span>` : ""}</div>`;
  };
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "cl-pw": () => { AUTH.pw = true; V().rerender(); },
    "cx-flag": async (el) => {
      const k = el.dataset.k; const on = el.checked; const list = (window.DL_CASH_OVERVIEW && window.DL_CASH_OVERVIEW()) || []; const s = list.find((x) => String(x.store_id) === String(el.dataset.id)) || {};
      if (k === "close_requires_pin" && on && !(await window.dlgConfirm("Antes de activarlo, cada encargado de " + (s.store_name || "la tienda") + " debe crear su PIN en Mi cuenta → Mi PIN de cierre de caja. Si no, nadie podrá cerrar la caja. ¿Activar?", { ok: "Activar", title: "Cierre con PIN" }))) { el.checked = false; return; }
      try {
        await X().call("schedule", { p_store_id: Number(el.dataset.id), p_opens_at: s.opens_at || (k === "auto_open" && on ? "09:00" : null), p_closes_at: s.closes_at || null, p_auto_close: !!s.auto_close && !!s.closes_at, p_auto_open: k === "auto_open" ? on : null, p_close_requires_pin: k === "close_requires_pin" ? on : null });
        s[k] = on; V().toast("Guardado ✓", "ok");
      } catch (e) { el.checked = !on; throw e; }
    },
    "v17-claim": async (el) => {
      if (!(await window.dlgConfirm("Tomas la caja con el fondo que dejó el último cierre. ¿Continuar?", { ok: "Tomar caja", title: "Abrir caja" }))) return;
      await X().call("claimSession", { p_register_id: Number(el.dataset.id) });
      AL.at = 0; await D().reload(); V().toast("Caja abierta ✓", "ok"); V().rerender();
    },
  });
})();
