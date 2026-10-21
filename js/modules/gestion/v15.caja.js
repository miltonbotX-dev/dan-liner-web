// modules/gestion/v15.caja.js · Cajas de todas las tiendas (get_cash_overview, cierre admin, conteo, horario y cierre automático),
// "Tienda de hoy" al abrir caja (get_my_stores_today), ficha técnica en el editor de piezas (set_product_specs),
// Admin › Pie y textos legales (set_storefront_settings) y Admin › Libro de Reclamaciones (get_complaints / respond_complaint).
(function () {
  const { esc, rpc, money, plain, num, fdate, hhmm, rerender, toast, once, remote } = window.DL_V15;
  const D = () => window.DL; const S = () => window.Store;
  const isAdmin = () => D().isAdmin(); const allow = (r) => D().allow(r);

  // ---------- Cajas ----------
  const CX = { data: null, loaded: false, err: "" };
  const RES = { CUADRA: "Cuadra", FALTANTE: "Faltante", SOBRANTE: "Sobrante", SIN_CONTEO: "Sin conteo", ABIERTA: "Abierta" };
  const MODE = { ADMIN: "por admin", AUTO: "automático", AUTOMATICO: "automático" };
  function cashCard(s, r) {
    const o = r.open_session; const l = r.last_closed;
    const dif = l ? Number(l.difference || 0) : 0; const res = o ? "ABIERTA" : l ? l.result : "";
    const exp = o && o.expected ? Object.entries(o.expected).filter(([, v]) => Number(v)).map(([k, v]) => `${esc(k.charAt(0) + k.slice(1).toLowerCase())} ${money(v)}`).join(" · ") : "";
    const mins = Number((o && o.minutes_open) || 0);
    return `<article class="cash-card ${o ? "open" : "closed"} ${!o && (res === "FALTANTE" || res === "SOBRANTE") ? "diff" : ""} ${!o && res === "SIN_CONTEO" ? "nocount" : ""}">
      <div class="row"><b class="grow">${esc(r.name)}</b><span class="badge ${o ? "ok" : ""}">${o ? "Abierta" : "Cerrada"}</span></div>
      ${o ? `<p class="tiny">${esc(o.opened_by_name || "")} · desde ${esc(fdate(o.opened_at, true))} (${Math.floor(mins / 60)} h ${mins % 60} min)</p>
        <p>Fondo <b>${money(o.opening_amount)}</b></p>${exp ? `<p class="tiny">Esperado: ${exp}</p>` : ""}
        ${isAdmin() ? `<button class="btn small" type="button" data-act="cx-close" data-id="${esc(o.session_id)}" data-n="${esc(s.store_name + " · " + r.name)}">Cerrar caja</button>` : ""}`
      : l ? `<p class="tiny">Último cierre ${esc(fdate(l.closed_at, true))}${MODE[l.close_mode] ? " · " + MODE[l.close_mode] : ""}</p>
        <p>Esperado ${money(l.expected_cash)} · contado ${l.counted_cash == null ? "—" : money(l.counted_cash)}</p>
        <p><span class="diff-amt ${dif < 0 ? "neg" : dif > 0 ? "pos" : "neutral"}">${esc(RES[res] || res || "")}${dif ? " " + (dif > 0 ? "+" : "−") + plain(Math.abs(dif)) : ""}</span></p>
        <p class="tiny">Fondo dejado ${money(l.float_left)}</p>${res === "SIN_CONTEO" ? `<button class="btn small ghost" type="button" data-act="cx-count" data-id="${esc(l.session_id)}">Registrar conteo</button>` : ""}`
      : `<p class="tiny muted">Sin movimientos.</p>`}</article>`;
  }
  function renderCashGrid() {
    if (!CX.loaded) setTimeout(() => once("cx", () => rpc("get_cash_overview", { p_store_id: null }), CX), 0);
    const list = CX.data || [];
    return `<div class="stack"><div class="row"><h3 class="grow" style="margin:0">Cajas de todas las tiendas</h3><button class="btn small ghost" type="button" data-act="cx-refresh">Actualizar</button></div>
      ${CX.err ? `<p class="alert-text">${esc(CX.err)}</p>` : ""}${!CX.loaded ? `<p class="muted">Cargando…</p>` : ""}
      ${list.map((s) => `<section class="stack cash-store"><div class="row" style="flex-wrap:wrap"><b class="grow" style="flex-basis:200px">${esc(s.store_name)}</b><span class="tiny">Horario ${esc(hhmm(s.opens_at) || "—")}–${esc(hhmm(s.closes_at) || "—")}${s.auto_close ? " · cierre automático" : ""}</span>${isAdmin() ? `<button class="link-btn tiny" type="button" data-act="cx-sched" data-id="${esc(s.store_id)}" data-o="${esc(hhmm(s.opens_at))}" data-c="${esc(hhmm(s.closes_at))}" data-a="${s.auto_close ? 1 : 0}">Cambiar horario</button>` : ""}</div>
        <div class="cash-grid">${(s.registers || []).filter((r) => r.is_active !== false).map((r) => cashCard(s, r)).join("") || `<p class="tiny muted">Sin cajas registradas.</p>`}</div></section>`).join("")}</div>`;
  }
  const tabs = window.DL_ADMIN_TABS = window.DL_ADMIN_TABS || [];
  const old = tabs.find((x) => x.id === "cajas"); const prevCajas = old && old.render;
  const cajas = () => renderCashGrid() + (prevCajas ? `<details class="panel" style="margin-top:14px"><summary>Historial y aprobación de cierres</summary>${prevCajas()}</details>` : "");
  if (old) Object.assign(old, { label: "Cajas", need: ["SUPERVISOR"], render: cajas }); else tabs.push({ id: "cajas", label: "Cajas", need: ["SUPERVISOR"], render: cajas });

  // ---------- Tienda de hoy (abrir caja) ----------
  const TD = { data: null, loaded: false };
  const VIA = { FIJA: "tu tienda", ROTACION: "rotación de hoy", GENERAL: "acceso general" };
  window.DL_STORES_TODAY = (st) => {
    if (!remote()) return "";
    if (!TD.loaded) { setTimeout(() => once("td", () => rpc("get_my_stores_today"), TD), 0); return ""; }
    const list = TD.data || []; if (!list.length) return "";
    const opts = [];
    list.forEach((s) => { const regs = (s.registers || []).filter((r) => !r.busy); const tag = VIA[s.via] ? " — " + VIA[s.via] : ""; const hours = s.opens_at ? ` (${hhmm(s.opens_at)}–${hhmm(s.closes_at)})` : "";
      if (regs.length > 1) regs.forEach((r) => opts.push([s.store_id + ":" + r.register_id, `${s.name} · ${r.name}${tag}`, s]));
      else opts.push([String(s.store_id) + (regs[0] ? ":" + regs[0].register_id : ""), `${s.name}${hours}${tag}${(s.registers || []).length && !regs.length ? " · caja ocupada" : ""}`, s]); });
    return `<label>Tienda de hoy<select name="store_today">${opts.map(([v, l, s]) => `<option value="${esc(v)}" ${st && String(st.id) === String(s.store_id) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  };

  // ---------- Ficha técnica ----------
  const SPEC = {};
  const FITS = [["", "—"], ["CLASICO", "Clásico"], ["REGULAR", "Regular"], ["SLIM", "Slim"], ["SUPER_SLIM", "Super slim"], ["ENTALLADO", "Entallado"]];
  window.DL_SPEC_FIELDS = (P) => {
    if (!remote() || !P || !P.product_id) return `<p class="tiny">La ficha técnica (modelo, entalle, composición, cuidados) se completa después de guardar la pieza.</p>`;
    const id = String(P.product_id); const box = SPEC[id] || (SPEC[id] = { loaded: false });
    if (!box.loaded) setTimeout(() => once("spec" + id, async () => ((await S().rest("products?select=id,model,fit,composition,care_instructions&id=eq." + Number(id))) || [])[0] || {}, box), 0);
    const v = box.data || {};
    return `<fieldset class="photo-box spec-box"><legend>Ficha técnica (se ve en la web)</legend>${box.err ? `<p class="alert-text">${esc(box.err)}</p>` : ""}
      <div class="two"><label>Modelo<input id="spec-model" maxlength="80" value="${esc(v.model || "")}" placeholder="Ej. Milano 2 botones"></label><label>Entalle<select id="spec-fit">${FITS.map(([k, l]) => `<option value="${k}" ${String(v.fit || "") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <label>Composición<input id="spec-comp" maxlength="200" value="${esc(v.composition || "")}" placeholder="Ej. 70% lana, 30% poliéster"></label>
      <label>Cuidados<input id="spec-care" maxlength="300" value="${esc(v.care_instructions || "")}" placeholder="Ej. Lavado en seco. Planchar a temperatura media."></label>
      <p class="tiny">La marca se toma del campo Marca. Vacío = no se muestra.</p>
      <button class="btn small ghost" type="button" data-act="spec-save" data-id="${esc(id)}">Guardar ficha técnica</button></fieldset>`;
  };

  // ---------- Textos legales ----------
  const LEG = [["razon_social", "Razón social", 0], ["ruc", "RUC", 0], ["direccion_legal", "Dirección legal", 0], ["terms_url", "Enlace externo a términos (https, opcional)", 0], ["guia_compra", "Guía de compras", 1], ["envios_info", "Tiempos y costos de envío", 1], ["formas_pago", "Formas de pago", 1], ["cambios_devoluciones", "Cambios y devoluciones", 1], ["terminos", "Términos y condiciones", 1], ["privacidad", "Política de privacidad", 1]];
  function renderLegal() {
    if (!isAdmin()) return `<p class="muted">Solo el administrador cambia estos textos.</p>`;
    const db = (S().v2 && S().v2.storefront && S().v2.storefront._db) || {};
    return `<form class="panel stack" data-form="leg-save" style="max-width:760px"><h3>Pie de página y textos legales</h3><p class="tiny">Si un texto está vacío, la web muestra el texto provisional. Separa párrafos con una línea en blanco; empieza una línea con «- » para viñetas.</p>
      ${LEG.map(([k, l, area]) => `<label>${l}${area ? `<textarea name="${k}" rows="5" maxlength="20000">${esc(db[k] || "")}</textarea>` : `<input name="${k}" maxlength="200" value="${esc(db[k] || "")}" ${k === "ruc" ? 'inputmode="numeric"' : ""}>`}</label>`).join("")}
      <button class="btn" type="submit">Guardar textos</button></form>`;
  }
  // ---------- Reclamos ----------
  const LR = { data: null, loaded: false, err: "", status: "" };
  function renderComplaints() {
    if (!allow(["SUPERVISOR"])) return `<p class="muted">Sin permiso.</p>`;
    if (!LR.loaded) setTimeout(() => once("lr", () => rpc("get_complaints", { p_status: LR.status || null, p_limit: 100, p_offset: 0 }), LR), 0);
    const rows = (LR.data && LR.data.rows) || [];
    return `<div class="stack" style="max-width:860px"><div class="tabs">${[["", "Todas"], ["PENDIENTE", "Pendientes"], ["EN_PROCESO", "En proceso"], ["RESPONDIDO", "Respondidas"], ["CERRADO", "Cerradas"]].map(([k, l]) => `<button type="button" class="chip ${LR.status === k ? "on" : ""}" data-act="lr-filter" data-id="${k}">${l}</button>`).join("")}</div>
      ${LR.err ? `<p class="alert-text">${esc(LR.err)}</p>` : ""}${!LR.loaded ? `<p class="muted">Cargando…</p>` : rows.length ? rows.map((r) => `<article class="panel stack"><div class="row" style="flex-wrap:wrap"><b class="grow"><span class="order-code">${esc(r.code)}</span> · ${esc(r.kind === "QUEJA" ? "Queja" : "Reclamo")} · ${esc(r.consumer_name || "")}</b><span class="badge ${r.status === "RESPONDIDO" || r.status === "CERRADO" ? "ok" : ""}">${esc(r.status_label || r.status)}</span></div>
        <p class="tiny">${esc(fdate(r.created_at, true))}${r.store_name ? " · " + esc(r.store_name) : ""} · responder hasta <b>${esc(fdate(r.due_on))}</b>${r.days_left != null ? ` (${Number(r.days_left)} días)` : ""} · ${esc([r.document_type, r.document_number].filter(Boolean).join(" "))} · ${esc([r.phone, r.email].filter(Boolean).join(" · "))}</p>
        <p><b>${esc(r.item_type === "SERVICIO" ? "Servicio" : "Producto")}:</b> ${esc(r.item_description || "")}${r.amount ? " · S/ " + esc(r.amount) : ""}${r.order_code ? " · " + esc(r.order_code) : ""}</p><p>${esc(r.detail || "")}</p><p class="tiny"><b>Pide:</b> ${esc(r.consumer_request || "")}</p>
        ${r.response ? `<p class="lr-note"><b>Respuesta:</b> ${esc(r.response)}</p>` : ""}
        ${r.status !== "CERRADO" ? `<button class="btn small ghost" type="button" data-act="lr-respond" data-id="${esc(r.id)}">Responder</button>` : ""}</article>`).join("") : `<p class="muted">No hay hojas.</p>`}</div>`;
  }
  tabs.push({ id: "legal", label: "Pie y textos legales", need: ["ADMIN"], render: renderLegal });
  tabs.push({ id: "reclamos", label: "Libro de Reclamaciones", need: ["SUPERVISOR"], render: renderComplaints });

  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, {
    "leg-save": async (form) => {
      const vals = {}; LEG.forEach(([k]) => { vals[k] = form.elements[k].value.trim(); });
      if (vals.ruc && !/^\d{11}$/.test(vals.ruc)) throw new Error("El RUC tiene 11 dígitos.");
      if (vals.terms_url && !/^https:\/\//i.test(vals.terms_url)) throw new Error("El enlace debe empezar con https://");
      await rpc("set_storefront_settings", { p_values: vals });
      const sf = S().v2 && S().v2.storefront; if (sf) sf._db = Object.assign(sf._db || {}, vals);
      toast("Textos guardados ✓", "ok"); rerender();
    },
  });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "cx-refresh": () => { CX.loaded = false; rerender(); },
    "cx-close": async (el) => {
      const v = await window.dlgPrompt(`Efectivo contado en ${el.dataset.n} (S/). Déjalo vacío si nadie lo contó.`, "", { title: "Cerrar caja (admin)", ok: "Cerrar caja", danger: true }); if (v == null) return;
      const counted = String(v).trim() ? num(v) : null; if (counted != null && !(counted >= 0)) throw new Error("Monto inválido.");
      const fl = await window.dlgPrompt("Fondo que queda en la caja para el siguiente turno (S/). Vacío = lo contado.", "", { title: "Fondo para mañana", ok: "Confirmar" }); if (fl == null) return;
      const r = await rpc("admin_close_register", { p_session_id: Number(el.dataset.id), p_counts: counted == null ? null : [{ method: "EFECTIVO", counted }], p_notes: "Cierre desde el panel de cajas", p_float_left: String(fl).trim() ? num(fl) : null });
      CX.loaded = false; rerender(); toast(`Caja cerrada · ${RES[r && r.result] || (r && r.result) || ""}${r && Number(r.cash_difference) ? " " + plain(r.cash_difference) : ""}`, "ok");
    },
    "cx-count": async (el) => { const v = await window.dlgPrompt("Efectivo contado (S/)", "", { title: "Registrar conteo", ok: "Guardar" }); if (v == null) return; const n = num(v); if (!(n >= 0)) throw new Error("Monto inválido."); await rpc("set_session_count", { p_session_id: Number(el.dataset.id), p_counts: [{ method: "EFECTIVO", counted: n }] }); CX.loaded = false; rerender(); toast("Conteo guardado ✓", "ok"); },
    "cx-sched": async (el) => {
      const v = await window.dlgPrompt("Horario (HH:MM-HH:MM). Agrega « auto» al final para que las cajas se cierren solas a la hora de cierre (quedan «Sin conteo»).", `${el.dataset.o || "09:00"}-${el.dataset.c || "20:00"}${el.dataset.a === "1" ? " auto" : ""}`, { title: "Horario y cierre automático", ok: "Guardar" });
      if (v == null) return; const m = String(v).trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})(\s+auto)?$/i); if (!m) throw new Error("Usa el formato 09:00-20:00 (y « auto» para cierre automático).");
      await rpc("set_store_schedule", { p_store_id: Number(el.dataset.id), p_opens_at: m[1].padStart(5, "0"), p_closes_at: m[2].padStart(5, "0"), p_auto_close: !!m[3] }); CX.loaded = false; rerender(); toast("Horario guardado ✓", "ok");
    },
    "spec-save": async (el) => {
      const g = (id) => String((document.getElementById(id) || {}).value || ""); const id = el.dataset.id;
      const r = await rpc("set_product_specs", { p_product_id: Number(id), p_model: g("spec-model").trim(), p_fit: g("spec-fit"), p_composition: g("spec-comp").trim(), p_care: g("spec-care").trim() });
      SPEC[id] = { loaded: true, data: { model: r.model, fit: r.fit, composition: r.composition, care_instructions: r.care_instructions } }; toast("Ficha técnica guardada ✓", "ok"); rerender();
    },
    "lr-filter": (el) => { LR.status = el.dataset.id; LR.loaded = false; rerender(); },
    "lr-respond": async (el) => {
      const v = await window.dlgPrompt("Respuesta al consumidor (queda en la hoja; avísale por su correo o celular).", "", { title: "Responder reclamo", ok: "Guardar respuesta" }); if (v == null || !String(v).trim()) return;
      const r = await rpc("respond_complaint", { p_id: Number(el.dataset.id), p_response: String(v).trim(), p_status: "RESPONDIDO" }); LR.loaded = false; rerender();
      toast("Respuesta guardada ✓" + (r && (r.notify_email || r.notify_phone) ? " · avisar a " + [r.notify_email, r.notify_phone].filter(Boolean).join(" / ") : ""), "ok");
    },
  });
})();
