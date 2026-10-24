// modules/v34/v34.v19.js · v34: pantallas de la BD v19 (API_V19.md).
// Dueño y permisos por persona · Pagos por confirmar · Reparto · Avisos push (cola + Edge Function send-push) · Archivos sin uso ·
// Reportes y análisis (exportación por línea, libro mensual, ABC, rotación, pronóstico) · Plantillas de impresión · Variantes desde la tela ·
// Buscador de pedidos web · Stock por color en la ficha. Solo anon key + sesión del usuario; la BD decide los permisos.
(function () {
  const D = () => window.DL;
  const K = () => window.DL33;
  const S = () => window.Store;
  const esc = (v) => D().esc(v);
  const rpc = (n, p) => K().rpc(n, p || {});
  const remote = () => S() && S().mode === "remote";
  const user = () => D() && D().state && D().state.user;
  const soles = (n) => "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n, d) => Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: d == null ? 1 : d });
  const pct = (n) => num(n, 1) + " %";
  const when = (t) => (t ? new Date(t).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" }) : "");
  const human = (e) => K().human(e);
  const A = (window.DL_ACTIONS = window.DL_ACTIONS || {});
  const val = (id) => { const x = document.getElementById(id); return x ? (x.type === "checkbox" ? x.checked : String(x.value || "").trim()) : ""; };
  const checked = (sel) => Array.from(document.querySelectorAll(sel)).filter((x) => x.checked).map((x) => x.value);
  const firstOfMonth = () => K().todayLima().slice(0, 8) + "01";
  const CROWN = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 18h18l-1.6-9.2-4.6 3.7L12 5.5l-2.8 7-4.6-3.7L3 18zm0 1.5h18V21H3z"/></svg>`;
  const load = (key, box, fn) => { if (!box.loaded && !K().busy[key]) setTimeout(() => K().once(key, fn, box), 0); };
  const errBox = (box, act) => (box.err ? `<p class="alert-text" role="alert">${esc(box.err)}</p>${act ? `<button class="btn small ghost" type="button" data-act="${act}">Reintentar</button>` : ""}` : "");

  // ---------- Dueño (get_owner_info) ----------
  const OWN = { loaded: false, data: null, err: "", uid: "" };
  function ownerLoad() {
    const u = user(); if (!remote() || !u) return;
    if (OWN.uid !== u.id) { OWN.uid = u.id; OWN.loaded = false; OWN.data = null; }
    load("v19own", OWN, () => rpc("get_owner_info"));
  }
  window.DL_IS_OWNER_ID = (id) => { ownerLoad(); return !!(id && OWN.data && OWN.data.user_id === id); };
  window.DL_OWNER_BADGE = (id) => {
    if (!window.DL_IS_OWNER_ID(id)) return "";
    const t = OWN.data.tag || {}; const color = /^#[0-9a-f]{3,8}$/i.test(String(t.color || "")) ? t.color : "#B8860B";
    return ` <span class="owner-chip34" style="--owner:${color}" title="Dueño de la tienda">${esc(OWN.data.label || t.name || "Dueño")}</span>`;
  };

  // ---------- Permisos por persona (get_user_effective_permissions / set_user_permissions) ----------
  const UP = { id: "", loaded: false, data: null, err: "", draft: null, open: false, msg: "" };
  window.DL_USER_PERMS_HTML = (p) => {
    if (!remote() || !D().isAdmin()) return "";
    const me = user() && user().id === p.id;
    if (me) return "";
    if (UP.id !== p.id) Object.assign(UP, { id: p.id, loaded: false, data: null, err: "", draft: null, open: false, msg: "" });
    if (!UP.open) return `<div class="panel stack"><h3>Permisos de esta persona</h3><p class="tiny muted">Además de sus roles, puedes darle un permiso extra o quitarle uno en particular.</p><button class="btn ghost small" type="button" data-act="v19-up-open">Ver y ajustar permisos</button></div>`;
    load("v19up" + p.id, UP, () => rpc("get_user_effective_permissions", { p_user_id: p.id }));
    if (UP.err) return `<div class="panel">${errBox(UP, "v19-up-retry")}</div>`;
    if (!UP.loaded) return `<div class="panel"><p class="muted">Cargando permisos…</p></div>`;
    const d = UP.data || {};
    if (d.is_owner) return `<div class="panel"><p class="muted">Es el dueño: tiene todos los permisos y nadie los cambia.</p></div>`;
    if (d.is_admin) return `<div class="panel"><p class="muted">Es administrador: puede todo. ${d.editable ? "" : "Solo el dueño cambia los permisos de un administrador."}</p></div>`;
    const perms = d.permissions || [];
    if (!UP.draft) UP.draft = new Set(perms.filter((x) => x.effective).map((x) => x.code));
    const by = {}; perms.forEach((x) => { (by[x.section] = by[x.section] || []).push(x); });
    const dis = d.editable === false ? " disabled" : "";
    return `<div class="panel stack up34"><h3>Permisos de esta persona</h3>
      <p class="tiny muted">Roles: ${esc((d.roles || []).map((r) => r.name || r.code).join(", ") || "—")}. Marca o desmarca solo lo que quieras cambiar para esta persona; lo demás sigue lo que diga su rol.</p>
      ${d.editable === false ? `<p class="tiny alert-text">No puedes cambiar los permisos de esta cuenta.</p>` : ""}
      ${UP.msg ? `<p class="tiny ok">${esc(UP.msg)}</p>` : ""}
      ${Object.keys(by).map((sec) => `<details class="perm-group"><summary><b>${esc(sec)}</b> <span class="tiny muted">${by[sec].filter((x) => UP.draft.has(x.code)).length}/${by[sec].length}</span></summary><div class="perm-list">${by[sec].map((x) => {
        const on = UP.draft.has(x.code); const tag = on && !x.from_role ? "extra" : !on && x.from_role ? "quitado" : "";
        return `<div class="perm-row34"><label><input type="checkbox" data-up34="${esc(x.code)}"${on ? " checked" : ""}${dis}><span><b>${esc(x.label || x.code)}</b>${tag ? ` <span class="badge ${tag === "extra" ? "ok" : ""}">${tag === "extra" ? "Extra" : "Quitado"}</span>` : ""}<small>${x.from_role ? "Viene de su rol" : "No viene de su rol"}</small></span></label>${x.description_es ? `<details class="perm-q34"><summary aria-label="¿Qué permite?" title="¿Qué permite?">?</summary><p class="tiny">${esc(x.description_es)}</p></details>` : ""}</div>`;
      }).join("")}</div></details>`).join("")}
      ${dis ? "" : `<div class="row" style="justify-content:flex-start"><button class="btn small" type="button" data-act="v19-up-save">Guardar permisos</button><button class="btn ghost small" type="button" data-act="v19-up-reset">Deshacer</button></div>`}</div>`;
  };
  A["v19-up-open"] = () => { UP.open = true; D().render(); };
  A["v19-up-retry"] = () => { UP.loaded = false; UP.err = ""; D().render(); };
  A["v19-up-reset"] = () => { UP.draft = null; UP.msg = ""; D().render(); };
  A["v19-up-save"] = async () => {
    const perms = (UP.data && UP.data.permissions) || [];
    const grants = perms.filter((x) => UP.draft.has(x.code) && !x.from_role).map((x) => x.code);
    const revokes = perms.filter((x) => !UP.draft.has(x.code) && x.from_role).map((x) => x.code);
    const lbl = (c) => (perms.find((x) => x.code === c) || {}).label || c;
    const msg = [grants.length ? "Permisos extra: " + grants.map(lbl).join(", ") + "." : "", revokes.length ? "Le quitas: " + revokes.map(lbl).join(", ") + "." : "", !grants.length && !revokes.length ? "Queda igual que su rol." : ""].filter(Boolean).join("\n");
    if (!(await DL_UI.confirm(msg + "\n\n¿Guardar?"))) return;
    await rpc("set_user_permissions", { p_user_id: UP.id, p_grants: grants, p_revokes: revokes });
    Object.assign(UP, { loaded: false, data: null, draft: null, msg: "Permisos guardados." }); D().render();
  };
  document.addEventListener("change", (e) => {
    const t = e.target; if (!t || !t.matches) return;
    if (t.matches("[data-up34]")) { if (!UP.draft) UP.draft = new Set(); if (t.checked) UP.draft.add(t.dataset.up34); else UP.draft.delete(t.dataset.up34); }
  });

  // ---------- Pagos por confirmar (get_payment_proofs / review_payment_proof) ----------
  const SRC = { PEDIDO: "Pedido web", ABONO: "Abono de separado", VENTA: "Pago de venta" };
  const PST = { PENDIENTE: "Por revisar", APROBADO: "Aprobado", RECHAZADO: "Rechazado", ANULADO: "Anulado", TODOS: "Todos" };
  const PG = { status: "PENDIENTE", source: "", loaded: false, data: null, err: "", key: "", proofs: {} };
  function renderPagos() {
    if (!remote()) return `<p class="muted">Disponible con la base de datos conectada.</p>`;
    const key = PG.status + "|" + PG.source; if (PG.key !== key) { PG.key = key; PG.loaded = false; }
    load("v19pg" + key, PG, () => rpc("get_payment_proofs", { p_status: PG.status, p_source: PG.source || null, p_limit: 100 }));
    const d = PG.data || {}; const rows = d.rows || [];
    return `<section class="stack pagos34">
      <p class="muted">Aquí llegan los Yape, Plin y transferencias de pedidos web, abonos de separados y ventas. <b>Aprobar</b> confirma el pedido, reserva el stock y lo deja como separado; <b>Rechazar</b> pide un motivo y avisa al cliente para que revise su pago.</p>
      <div class="row" style="flex-wrap:wrap;justify-content:flex-start">${Object.entries(PST).map(([k, l]) => `<button type="button" class="chip ${PG.status === k ? "on" : ""}" data-act="v19-pg-st" data-id="${k}">${esc(l)}${k === "PENDIENTE" && d.pending_count ? ` (${num(d.pending_count, 0)})` : ""}</button>`).join("")}</div>
      <div class="row" style="flex-wrap:wrap;justify-content:flex-start"><button type="button" class="chip ${!PG.source ? "on" : ""}" data-act="v19-pg-src" data-id="">Todo</button>${Object.entries(SRC).map(([k, l]) => `<button type="button" class="chip ${PG.source === k ? "on" : ""}" data-act="v19-pg-src" data-id="${k}">${esc(l)}</button>`).join("")}<button class="btn ghost small" type="button" data-act="v19-pg-reload">Actualizar</button></div>
      ${errBox(PG, "v19-pg-reload")}
      ${!PG.loaded ? `<p class="muted">Cargando…</p>` : rows.length ? rows.map((r) => `<article class="panel stack pago34">
        <div class="row"><b>${esc(SRC[r.source] || r.source)} ${esc(r.ref_code || "")}</b><span class="badge ${r.status === "APROBADO" ? "ok" : ""}">${esc(PST[r.status] || r.status)}</span></div>
        <div class="tiny">${esc(r.customer_name || "Cliente")}${r.customer_phone ? ` · <a href="tel:${esc(r.customer_phone)}">${esc(r.customer_phone)}</a>` : ""}${r.customer_doc ? " · Doc. " + esc(r.customer_doc) : ""}${r.store_name ? " · " + esc(r.store_name) : ""}</div>
        <div class="row" style="justify-content:flex-start;gap:14px"><b class="num">${soles(r.amount)}</b><span class="tiny">${esc(r.method || "")}${r.operation_code ? " · Op. " + esc(r.operation_code) : ""} · ${esc(when(r.submitted_at))}</span></div>
        ${r.review_note ? `<p class="tiny">Nota: ${esc(r.review_note)}${r.reviewed_by_name ? " — " + esc(r.reviewed_by_name) : ""}</p>` : ""}
        ${PG.proofs[r.proof_key] ? `<a href="${esc(PG.proofs[r.proof_key])}" target="_blank" rel="noopener"><img class="proof34" src="${esc(PG.proofs[r.proof_key])}" alt="Comprobante de ${esc(r.customer_name || "pago")}"></a>` : ""}
        <div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:8px">
          ${r.proof_path && !PG.proofs[r.proof_key] ? `<button class="btn ghost small" type="button" data-act="v19-pg-proof" data-id="${esc(r.proof_key)}">Ver comprobante</button>` : ""}
          ${r.status === "PENDIENTE" ? `<button class="btn small" type="button" data-act="v19-pg-ok" data-id="${esc(r.proof_key)}">Aprobar</button><button class="btn danger small" type="button" data-act="v19-pg-no" data-id="${esc(r.proof_key)}">Rechazar</button>` : ""}
        </div></article>`).join("") + (d.total_count > rows.length ? `<p class="tiny muted">Mostrando ${rows.length} de ${num(d.total_count, 0)}.</p>` : "") : `<p class="muted">${PG.status === "PENDIENTE" ? "No hay pagos por confirmar. ¡Todo al día!" : "No hay pagos en este filtro."}</p>`}
    </section>`;
  }
  const pgRow = (k) => ((PG.data && PG.data.rows) || []).find((r) => r.proof_key === k) || {};
  A["v19-pg-st"] = (el) => { PG.status = el.dataset.id; D().render(); };
  A["v19-pg-src"] = (el) => { PG.source = el.dataset.id; D().render(); };
  A["v19-pg-reload"] = () => { PG.loaded = false; PG.err = ""; PG.key = ""; D().render(); };
  A["v19-pg-proof"] = async (el) => {
    const r = pgRow(el.dataset.id); let url = null;
    if (/^https?:\/\//i.test(r.proof_path || "")) url = r.proof_path;
    else if (S().v2api && S().v2api.proofUrl) url = await S().v2api.proofUrl(r.proof_path);
    if (!url) throw new Error("No se pudo abrir el comprobante.");
    PG.proofs[r.proof_key] = url; D().render();
  };
  A["v19-pg-ok"] = async (el) => {
    const r = pgRow(el.dataset.id);
    const extra = r.source === "PEDIDO" ? " El pedido queda confirmado, se reserva el stock y pasa a separados." : "";
    if (!(await DL_UI.confirm(`¿Aprobar el pago de ${soles(r.amount)} de ${r.customer_name || "este cliente"}?${extra}`, { ok: "Aprobar", danger: false }))) return;
    await rpc("review_payment_proof", { p_proof_key: r.proof_key, p_approve: true, p_note: null });
    D().toast("Pago aprobado"); A["v19-pg-reload"]();
  };
  A["v19-pg-no"] = async (el) => {
    const r = pgRow(el.dataset.id);
    const why = await DL_UI.prompt("Motivo del rechazo (el cliente lo verá):", "", { placeholder: "Ej.: el monto no coincide", ok: "Rechazar" });
    if (why === null) return;
    if (!String(why).trim()) throw new Error("Escribe el motivo del rechazo.");
    await rpc("review_payment_proof", { p_proof_key: r.proof_key, p_approve: false, p_note: String(why).trim().slice(0, 300) });
    D().toast("Pago rechazado; se avisó al cliente"); A["v19-pg-reload"]();
  };

  // ---------- Reparto (get_delivery_orders / mark_order_delivery) ----------
  const RP = { done: false, loaded: false, data: null, err: "", key: "" };
  const NEXT = { EMPAQUETADO: [["ENVIADO", "Salí a entregar"]], ENVIADO: [["ENTREGADO", "Entregado"], ["NO_ENTREGADO", "No se pudo entregar"]] };
  function renderReparto() {
    if (!remote()) return `<p class="muted">Disponible con la base de datos conectada.</p>`;
    const key = RP.done ? "1" : "0"; if (RP.key !== key) { RP.key = key; RP.loaded = false; }
    load("v19rp" + key, RP, () => rpc("get_delivery_orders", { p_store_id: null, p_include_done: RP.done }));
    const rows = Array.isArray(RP.data) ? RP.data : [];
    return `<section class="stack">
      <p class="muted">Pedidos con envío de tus tiendas. Marca «Salí a entregar» al salir y «Entregado» cuando el cliente lo reciba.</p>
      <div class="row" style="justify-content:flex-start"><button type="button" class="chip ${!RP.done ? "on" : ""}" data-act="v19-rp-done" data-id="0">Por entregar</button><button type="button" class="chip ${RP.done ? "on" : ""}" data-act="v19-rp-done" data-id="1">Incluir entregados</button><button class="btn ghost small" type="button" data-act="v19-rp-reload">Actualizar</button></div>
      ${errBox(RP, "v19-rp-reload")}
      ${!RP.loaded ? `<p class="muted">Cargando…</p>` : rows.length ? rows.map((o) => `<article class="panel stack">
        <div class="row"><b>${esc(o.code || o.id)}</b><span class="badge">${esc(o.status_label || o.status)}</span></div>
        <div class="tiny">${esc(o.customer_name || "")}${o.customer_phone ? ` · <a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a>` : ""}</div>
        <div class="tiny">${esc([o.direccion, o.distrito].filter(Boolean).join(", "))}</div>
        <div class="tiny muted">${esc((o.items || []).map((i) => i.qty + " × " + (i.product || "") + (i.variant ? " " + i.variant : "")).join(" · "))} · <b>${soles(o.total)}</b></div>
        <div class="row" style="justify-content:flex-start;gap:8px">${(NEXT[o.status] || []).map(([s, l]) => `<button class="btn small ${s === "NO_ENTREGADO" ? "ghost" : ""}" type="button" data-act="v19-rp-mark" data-id="${esc(o.id)}" data-st="${s}">${esc(l)}</button>`).join("")}</div></article>`).join("") : `<p class="muted">No hay pedidos por entregar.</p>`}
    </section>`;
  }
  A["v19-rp-done"] = (el) => { RP.done = el.dataset.id === "1"; D().render(); };
  A["v19-rp-reload"] = () => { RP.loaded = false; RP.err = ""; RP.key = ""; D().render(); };
  A["v19-rp-mark"] = async (el) => {
    let note = null;
    if (el.dataset.st === "NO_ENTREGADO") { note = await DL_UI.prompt("¿Qué pasó? (opcional)", ""); if (note === null) return; }
    await rpc("mark_order_delivery", { p_order_id: Number(el.dataset.id), p_status: el.dataset.st, p_note: note || null });
    D().toast("Pedido actualizado"); A["v19-rp-reload"]();
  };

  // ---------- Avisos push (enqueue_push_notification + Edge Function send-push) ----------
  const AV = { loaded: false, data: null, err: "", tags: null, msg: "" };
  async function runSendPush() {
    const st = S(); const cfg = window.DL_CONFIG || {};
    if (!st || !st.token) throw new Error("Inicia sesión.");
    const res = await fetch(st.cfg.url + "/functions/v1/" + (cfg.PUSH_FUNCTION || "send-push"), { method: "POST", headers: { apikey: st.cfg.key, Authorization: "Bearer " + st.token.access_token, "Content-Type": "application/json" }, body: JSON.stringify({ max_batches: 3 }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "No se pudo enviar ahora; queda en cola.");
    return out;
  }
  function renderAvisos() {
    if (!remote()) return `<p class="muted">Disponible con la base de datos conectada.</p>`;
    load("v19av", AV, () => rpc("get_push_outbox", { p_limit: 30, p_offset: 0 }));
    if (!AV.tags && !K().busy.v19tags) { K().busy.v19tags = true; S().rest("customer_tags?select=id,name&is_active=eq.true&order=name").then((t) => { AV.tags = t || []; }).catch(() => { AV.tags = []; }).finally(() => { K().busy.v19tags = false; D().render(); }); }
    const d = AV.data || {}; const rows = d.rows || [];
    const STS = { PENDIENTE: "En cola", ENVIANDO: "Enviando", ENVIADO: "Enviado", CANCELADO: "Cancelado", ERROR: "Con error", FALLIDO: "Con error" };
    return `<section class="stack avisos34">
      <p class="muted">Manda un aviso al celular de quienes activaron las notificaciones (${num(d.subscribers || 0, 0)} ${Number(d.subscribers) === 1 ? "persona" : "personas"} hoy). Llega como notificación del sistema; al tocarla abre la tienda en el enlace que pongas.</p>
      <div class="panel stack"><h3>Nuevo aviso</h3>
        <div class="two"><label>Para<select id="av-target"><option value="TODOS">Todos los que activaron avisos</option><option value="ETIQUETA">Clientes con una etiqueta</option><option value="USUARIO">Solo a mí (prueba)</option></select></label>
          <label>Etiqueta<select id="av-tag"><option value="">—</option>${(AV.tags || []).map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select></label></div>
        <label>Título<input id="av-title" maxlength="80" placeholder="Ej.: Nueva colección"></label>
        <label>Mensaje<textarea id="av-body" maxlength="240" rows="2" placeholder="Hasta 240 letras"></textarea></label>
        <label>Al tocarlo abre<input id="av-url" maxlength="200" value="/coleccion" placeholder="/coleccion o https://…"></label>
        ${AV.msg ? `<p class="tiny ok">${esc(AV.msg)}</p>` : ""}
        <div class="row" style="justify-content:flex-start"><button class="btn" type="button" data-act="v19-av-send">Enviar aviso</button><button class="btn ghost small" type="button" data-act="v19-av-run">Enviar los que están en cola</button></div></div>
      <h3>Últimos avisos</h3>${errBox(AV, "v19-av-reload")}
      ${!AV.loaded ? `<p class="muted">Cargando…</p>` : rows.length ? `<div class="stack">${rows.map((r) => `<article class="panel"><div class="row"><b>${esc(r.title)}</b><span class="badge ${r.status === "ENVIADO" ? "ok" : ""}">${esc(STS[r.status] || r.status)}</span></div>
        <div class="tiny">${esc(r.body || "")}</div><div class="tiny muted">Para: ${esc(r.target || "")} · ${num(r.recipients || 0, 0)} destinatarios · ${num(r.sent_count || 0, 0)} enviados${r.fail_count ? " · " + num(r.fail_count, 0) + " fallidos" : ""} · ${esc(when(r.created_at))}${r.created_by ? " · " + esc(r.created_by) : ""}</div>
        ${r.last_error ? `<p class="tiny alert-text">${esc(r.last_error)}</p>` : ""}${r.status === "PENDIENTE" ? `<button class="btn ghost small" type="button" data-act="v19-av-cancel" data-id="${esc(r.id)}">Cancelar</button>` : ""}</article>`).join("")}</div>` : `<p class="muted">Todavía no se envió ningún aviso.</p>`}
    </section>`;
  }
  A["v19-av-reload"] = () => { AV.loaded = false; AV.err = ""; D().render(); };
  A["v19-av-send"] = async () => {
    const target = val("av-target"); const title = val("av-title"); const body = val("av-body"); let url = val("av-url") || null;
    if (!title) throw new Error("Escribe un título.");
    if (url && !/^\/[A-Za-z0-9/_\-#?=&.]*$/.test(url) && !/^https:\/\//i.test(url)) throw new Error("El enlace debe empezar con / o con https://");
    let ref = null;
    if (target === "ETIQUETA") { ref = val("av-tag"); if (!ref) throw new Error("Elige la etiqueta."); }
    if (target === "USUARIO") ref = user().id;
    if (!(await DL_UI.confirm(`¿Enviar «${title}» ${target === "TODOS" ? "a todos los que activaron avisos" : target === "ETIQUETA" ? "a los clientes con esa etiqueta" : "solo a tu celular"}?`, { ok: "Enviar", danger: false }))) return;
    const q = await rpc("enqueue_push_notification", { p_target: target, p_target_ref: ref, p_title: title, p_body: body || null, p_url: url });
    let sent = "";
    try { const r = await runSendPush(); sent = ` Enviados: ${num(r.sent || 0, 0)}${r.failed ? ", fallidos: " + num(r.failed, 0) : ""}.`; } catch (e) { sent = " " + human(e); }
    const nr = Number((q && q.recipients) || 0);
    AV.msg = `Aviso en cola para ${num(nr, 0)} ${nr === 1 ? "persona" : "personas"}.${sent}`;
    ["av-title", "av-body"].forEach((id) => { const x = document.getElementById(id); if (x) x.value = ""; });
    A["v19-av-reload"]();
  };
  A["v19-av-run"] = async () => { const r = await runSendPush(); AV.msg = `Listo: ${num(r.sent || 0, 0)} enviados${r.failed ? ", " + num(r.failed, 0) + " fallidos" : ""}.`; A["v19-av-reload"](); };
  A["v19-av-cancel"] = async (el) => { if (!(await DL_UI.confirm("¿Cancelar este aviso en cola?"))) return; await rpc("cancel_push_notification", { p_id: Number(el.dataset.id) }); A["v19-av-reload"](); };

  // ---------- Archivos sin uso (list_orphan_files / purge_orphan_files → Storage remove) ----------
  const OR = { loaded: false, data: null, err: "", open: false, msg: "" };
  const BUCKET_LBL = { avatars: "Fotos de perfil", "payment-proofs": "Comprobantes de pago", "payment-qr": "QR de pago" };
  window.DL_SYS_EXTRA = () => {
    if (!remote() || !D().isAdmin()) return "";
    let body = `<button class="btn small ghost" type="button" data-act="v19-or-open">Revisar archivos sin uso</button>`;
    if (OR.open) {
      load("v19or", OR, () => rpc("list_orphan_files", { p_bucket: null, p_limit: 500 }));
      const d = OR.data || {};
      body = OR.err ? errBox(OR, "v19-or-open") : !OR.loaded ? `<p class="muted">Buscando…</p>` : !d.count ? `<p class="muted">No hay archivos sin uso.</p>`
        : `<p>${num(d.count, 0)} ${d.count === 1 ? "archivo" : "archivos"} sin uso · ${esc(d.pretty || "")}</p><ul class="tiny">${Object.entries(d.by_bucket || {}).map(([b, v]) => `<li>${esc(BUCKET_LBL[b] || b)}: ${esc(typeof v === "object" ? (v.count != null ? v.count : JSON.stringify(v)) : v)}</li>`).join("")}</ul>
           <button class="btn small danger" type="button" data-act="v19-or-purge">Borrar ${num(d.count, 0)} archivos</button>`;
    }
    return `<h2>Archivos sin uso</h2><p class="muted">Fotos de perfil cambiadas y archivos que ya nada usa (con más de 1 hora en fotos de perfil o 24 horas en lo demás). Borrarlos libera espacio; lo que sí se usa no se toca.</p>${OR.msg ? `<p class="tiny ok">${esc(OR.msg)}</p>` : ""}${body}`;
  };
  A["v19-or-open"] = () => { OR.open = true; OR.loaded = false; OR.err = ""; D().render(); };
  A["v19-or-purge"] = async () => {
    if (!(await DL_UI.confirm((() => { const n = Number((OR.data || {}).count || 0); return `¿Borrar ${num(n, 0)} ${n === 1 ? "archivo" : "archivos"} sin uso? No se puede deshacer.`; })()))) return;
    const r = await rpc("purge_orphan_files", { p_bucket: null, p_limit: 500 });
    const st = S(); let ok = 0, bad = 0;
    for (const [bucket, paths] of Object.entries((r && r.buckets) || {})) {
      const list = (paths || []).map((p) => String(p).replace(new RegExp("^" + bucket + "/"), ""));
      for (let i = 0; i < list.length; i += 100) {
        const part = list.slice(i, i + 100);
        try { await st.request("/storage/v1/object/" + encodeURIComponent(bucket), { method: "DELETE", body: { prefixes: part } }); ok += part.length; } catch { bad += part.length; }
      }
    }
    OR.msg = `${ok === 1 ? "Borrado 1 archivo" : `Borrados ${num(ok, 0)} archivos`}${bad ? `; ${num(bad, 0)} no se pudieron borrar` : ""}.`;
    OR.loaded = false; OR.open = true; D().render();
  };

  // ---------- Reportes y análisis (accounting.view o admin) ----------
  const AN = { view: "ventas", from: "", to: "", store: "", year: "", box: {}, key: {} };
  const AN_VIEWS = [["ventas", "Ventas detalladas"], ["libro", "Libro mensual"], ["abc", "Lo que más deja (ABC)"], ["rotacion", "Rotación"], ["pronostico", "Pronóstico"]];
  const EXPORT_COLS = [
    { key: "fecha", label: "Fecha", width: 11 }, { key: "hora", label: "Hora", width: 7 }, { key: "venta_id", label: "Venta", width: 8 }, { key: "estado", label: "Estado", width: 11 },
    { key: "tienda", label: "Tienda", width: 16 }, { key: "comprobante", label: "Comprobante", width: 16 }, { key: "doc_cliente", label: "DNI/RUC", width: 12 }, { key: "cliente", label: "Cliente", width: 22 },
    { key: "vendedor", label: "Vendedor", width: 16 }, { key: "sku", label: "SKU", width: 14 }, { key: "pieza", label: "Pieza", width: 22 }, { key: "talla", label: "Talla", width: 6 }, { key: "color", label: "Color", width: 10 },
    { key: "cantidad", label: "Cant.", type: "num", width: 6, sum: true }, { key: "precio_unit", label: "P. unit.", type: "money", width: 10 }, { key: "descuento", label: "Desc.", type: "money", width: 9, sum: true },
    { key: "total_linea", label: "Total", type: "money", width: 11, sum: true }, { key: "costo", label: "Costo", type: "money", width: 10, sum: true }, { key: "margen", label: "Margen", type: "money", width: 10, sum: true }, { key: "forma_pago", label: "Pago", width: 12 },
  ];
  const anStore = () => (AN.store ? Number(AN.store) : null);
  function anLoad(view) {
    const box = (AN.box[view] = AN.box[view] || { loaded: false });
    const key = [AN.from, AN.to, AN.store, AN.year].join("|"); if (AN.key[view] !== key) { AN.key[view] = key; box.loaded = false; }
    const f = {
      ventas: () => rpc("get_sales_export", { p_from: AN.from, p_to: AN.to, p_store: anStore() }),
      libro: () => rpc("get_monthly_ledger", { p_year: Number(AN.year), p_store: anStore() }),
      abc: () => rpc("get_abc_analysis", { p_from: AN.from, p_to: AN.to, p_store: anStore() }),
      rotacion: () => rpc("get_sales_velocity", { p_days: 30, p_store: anStore(), p_limit: 200 }),
      pronostico: () => rpc("get_demand_forecast", { p_store: anStore(), p_limit: 200 }),
    }[view];
    load("v19an" + view + key, box, f);
    return box;
  }
  const tbl = (cols, rows) => `<div class="table-wrap"><table class="table an34"><thead><tr>${cols.map((c) => `<th${c[2] ? ' class="n"' : ""}>${esc(c[1])}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td${c[2] ? ' class="n"' : ""}>${typeof c[0] === "function" ? c[0](r) : esc(r[c[0]] == null ? "" : r[c[0]])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  function renderAnalitica() {
    if (!remote()) return `<p class="muted">Disponible con la base de datos conectada.</p>`;
    if (!AN.from) { AN.from = firstOfMonth(); AN.to = K().todayLima(); AN.year = K().todayLima().slice(0, 4); }
    const stores = ((D().state.data || {}).stores || []).filter((s) => s.is_active !== false);
    const box = anLoad(AN.view); const d = box.data;
    let body = "";
    if (box.err) body = `<p class="alert-text">${esc(box.err)}</p>`;
    else if (!box.loaded) body = `<p class="muted">Calculando…</p>`;
    else if (AN.view === "ventas") {
      const rows = Array.isArray(d) ? d : [];
      const tot = rows.reduce((a, r) => { a.u += Number(r.cantidad || 0); a.t += Number(r.total_linea || 0); a.m += Number(r.margen || 0); return a; }, { u: 0, t: 0, m: 0 });
      body = `<p class="muted">Una fila por cada prenda vendida: fecha, comprobante, cliente, vendedor, pieza, talla, color, precio, costo y margen. Es lo que pide el contador.</p>
        <div class="stats"><article class="stat"><span class="tiny">Líneas</span><b class="num">${num(rows.length, 0)}</b></article><article class="stat"><span class="tiny">Prendas</span><b class="num">${num(tot.u, 0)}</b></article><article class="stat"><span class="tiny">Vendido</span><b class="num">${soles(tot.t)}</b></article><article class="stat"><span class="tiny">Margen</span><b class="num">${soles(tot.m)}</b></article></div>
        <div class="row" style="justify-content:flex-start"><button class="btn small" type="button" data-act="v19-an-xlsx">Descargar Excel</button><button class="btn ghost small" type="button" data-act="v19-an-pdf">PDF</button></div>
        ${rows.length ? tbl([["fecha", "Fecha"], ["comprobante", "Comprobante"], ["cliente", "Cliente"], ["pieza", "Pieza"], ["talla", "Talla"], ["color", "Color"], ["cantidad", "Cant.", 1], [(r) => soles(r.total_linea), "Total", 1]], rows.slice(0, 30)) + (rows.length > 30 ? `<p class="tiny muted">Vista previa de 30 líneas; el Excel trae las ${num(rows.length, 0)}.</p>` : "") : `<p class="muted">No hay ventas en estas fechas.</p>`}`;
    } else if (AN.view === "libro") {
      const months = (d && d.months) || []; const MES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
      const yt = (d && d.year_total) || {};
      body = `<p class="muted">Resumen de comprobantes por mes, como lo pide SUNAT: <b>base</b> (sin IGV), <b>IGV</b> (18 %) y <b>total</b>. Las notas de crédito restan.</p>
        ${tbl([[(r) => esc(MES[Number(String(r.month).slice(-2))] || r.month), "Mes"], [(r) => esc((Array.isArray(r.by_type) ? r.by_type.map((v) => [v.document_type || v.doc_type || "", v]) : Object.entries(r.by_type || {})).map(([k, v]) => String(k).toLowerCase() + ": " + ((v && v.emitidos) || 0) + (v && v.anulados ? " (" + v.anulados + " anul.)" : "")).join(" · ") || "—"), "Comprobantes"], [(r) => soles(r.base), "Base", 1], [(r) => soles(r.igv), "IGV", 1], [(r) => soles(r.total), "Total", 1]], months)}
        <p><b>Año ${esc(d && d.year)}:</b> base ${soles(yt.base)} · IGV ${soles(yt.igv)} · total ${soles(yt.total)}</p>`;
    } else if (AN.view === "abc") {
      const rows = (d && d.rows) || []; const s = (d && d.summary) || {};
      const cnt = (x) => (x && typeof x === "object" ? x.count != null ? x.count : x.items : x) || 0;
      body = `<p class="muted">Ordena las piezas por lo que venden. <b>A</b>: las pocas que dejan el 80 % de la plata (nunca deben faltar). <b>B</b>: el siguiente 15 %. <b>C</b>: el último 5 % (revisa si conviene seguir haciéndolas).</p>
        <div class="stats">${["A", "B", "C"].map((k) => `<article class="stat"><span class="tiny">Clase ${k}</span><b class="num">${num(cnt(s[k]), 0)}</b></article>`).join("")}<article class="stat"><span class="tiny">Vendido</span><b class="num">${soles(d && d.total_revenue)}</b></article></div>
        ${rows.length ? tbl([[(r) => `<b data-abc="${esc(r.class_revenue || "")}">${esc(r.class_revenue || "")}</b>`, "Clase"], ["product", "Pieza"], ["units", "Unid.", 1], [(r) => soles(r.revenue), "Vendido", 1], [(r) => pct(r.share_revenue), "% del total", 1], [(r) => pct(r.cum_revenue), "Acumulado", 1], [(r) => soles(r.margin), "Margen", 1]], rows.slice(0, 100)) : `<p class="muted">Sin ventas en estas fechas.</p>`}`;
    } else if (AN.view === "rotacion") {
      const rows = (d && d.rows) || []; const ST = { CRITICO: "Se acaba en menos de 7 días", BAJO: "Menos de 3 semanas", OK: "Bien", SIN_VENTAS: "No se vende" };
      body = `<p class="muted">Cuánto se vende por día (últimos ${esc((d && d.days) || 30)} días) y para cuántos días alcanza lo que hay. <b>Crítico</b>: haz más ya. <b>Sin ventas</b>: no rota; piensa en una promoción.</p>
        ${rows.length ? tbl([["product", "Pieza"], ["size", "Talla"], ["color", "Color"], ["units", "Vendidas", 1], [(r) => num(r.units_per_day, 2), "Por día", 1], ["available", "Hay", 1], [(r) => (r.days_of_stock == null ? "—" : num(r.days_of_stock, 0)), "Días", 1], [(r) => `<span class="badge ${r.status === "OK" ? "ok" : ""}">${esc(ST[r.status] || r.status)}</span>`, "Estado"]], rows) : `<p class="muted">Sin datos.</p>`}`;
    } else {
      const rows = (d && d.rows) || [];
      body = `<p class="muted">Cuánto se venderá ${esc((d && d.target_month) || "el próximo mes")} y cuánto conviene producir. ${esc((d && d.method) || "")}</p>
        ${rows.length ? tbl([["product", "Pieza"], ["size", "Talla"], ["color", "Color"], [(r) => num(r.moving_average, 1), "Promedio", 1], [(r) => (r.same_month_last_year == null ? "—" : num(r.same_month_last_year, 0)), "Año pasado", 1], [(r) => num(r.forecast, 0), "Se venderá", 1], ["available", "Hay", 1], [(r) => `<b>${num(r.suggested_reorder, 0)}</b>`, "Producir", 1]], rows) : `<p class="muted">Sin datos suficientes.</p>`}`;
    }
    const dates = AN.view === "ventas" || AN.view === "abc";
    return `<section class="stack analitica34">
      <div class="row" style="flex-wrap:wrap;justify-content:flex-start">${AN_VIEWS.map(([k, l]) => `<button type="button" class="chip ${AN.view === k ? "on" : ""}" data-act="v19-an-view" data-id="${k}">${esc(l)}</button>`).join("")}</div>
      <div class="row an-filters" style="flex-wrap:wrap;justify-content:flex-start;align-items:flex-end;gap:8px">
        ${dates ? `<label>Desde<input type="date" id="an-from" value="${esc(AN.from)}"></label><label>Hasta<input type="date" id="an-to" value="${esc(AN.to)}"></label>` : ""}
        ${AN.view === "libro" ? `<label>Año<input type="number" id="an-year" min="2020" max="2100" value="${esc(AN.year)}"></label>` : ""}
        <label>Tienda<select id="an-store"><option value="">Todas</option>${stores.map((s) => `<option value="${esc(s.id)}"${String(s.id) === AN.store ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
        <button class="btn small ghost" type="button" data-act="v19-an-apply">Ver</button></div>
      ${body}</section>`;
  }
  A["v19-an-view"] = (el) => { AN.view = el.dataset.id; D().render(); };
  A["v19-an-apply"] = () => {
    if (document.getElementById("an-from")) { AN.from = val("an-from") || AN.from; AN.to = val("an-to") || AN.to; }
    if (document.getElementById("an-year")) AN.year = val("an-year") || AN.year;
    AN.store = val("an-store"); D().render();
  };
  const exportRows = () => { const b = AN.box.ventas; return b && Array.isArray(b.data) ? b.data : []; };
  A["v19-an-xlsx"] = () => { const rows = exportRows(); if (!rows.length) return D().toast("No hay ventas en este rango."); window.DL_EXPORT.xlsx(`ventas_detalle_${AN.from}_${AN.to}.xlsx`, "Ventas por prenda", EXPORT_COLS, rows); D().toast(`Excel listo: ${rows.length} líneas`); };
  A["v19-an-pdf"] = () => { const rows = exportRows(); if (!rows.length) return D().toast("No hay ventas en este rango."); const cols = EXPORT_COLS.filter((c) => !["venta_id", "hora", "doc_cliente", "sku", "costo"].includes(c.key)); window.DL_EXPORT.pdf("Ventas por prenda", `Del ${AN.from} al ${AN.to}`, cols, rows, window.DL_EXPORT.sumBy(rows, cols)); };
  // Ventas → Excel: con la BD conectada sale una fila por prenda (get_sales_export); si falla o no hay permiso, el resumen por venta de siempre.
  const localXlsx = A["v34-sales-xlsx"];
  A["v34-sales-xlsx"] = async (el) => {
    if (!remote()) return localXlsx(el);
    const f = (D().salesFilterNow && D().salesFilterNow()) || {};
    let rows = null;
    try { rows = await rpc("get_sales_export", { p_from: f.from || null, p_to: f.to || null, p_store: f.store ? Number(f.store) : null }); } catch (e) { rows = null; }
    if (!Array.isArray(rows)) return localXlsx(el);
    if (!rows.length) return D().toast("No hay ventas en este rango.");
    window.DL_EXPORT.xlsx(`ventas_${f.from || "inicio"}_${f.to || "hoy"}.xlsx`, "Ventas por prenda", EXPORT_COLS, f.seller ? rows.filter((r) => !r.vendedor || r.vendedor === ((D().byId("staff", f.seller) || {}).full_name || r.vendedor)) : rows);
    D().toast(`Excel listo: ${rows.length} líneas (una por prenda)`);
  };

  // ---------- Plantillas de impresión (get_receipt_template / set_receipt_template) ----------
  const DOCS = [["BOLETA", "Boleta"], ["FACTURA", "Factura"], ["TICKET", "Ticket"], ["GUIA", "Guía"], ["CONSTANCIA", "Constancia"]];
  const TPL = { doc: "BOLETA", store: "", loaded: false, data: null, err: "", key: "", msg: "" };
  const TPLC = {}; const TPLB = {};
  function tplFetch(doc, store) {
    const k = doc + "|" + (store || ""); if (TPLB[k]) return; TPLB[k] = true;
    rpc("get_receipt_template", { p_doc_type: doc, p_store_id: store ? Number(store) : null }).then((t) => { TPLC[k] = t || {}; }).catch(() => { TPLB[k] = false; });
  }
  window.DL_RECEIPT_TPL = (doc, store) => {
    const d = String(doc || "BOLETA").toUpperCase(); const k = d + "|" + (store || "");
    if (TPLC[k]) return TPLC[k];
    if (remote() && user()) tplFetch(d, store); return TPLC[d + "|"] || null;
  };
  const prefetchTpl = () => {
    if (!remote() || !user() || !/^#(caja|admin)/.test(location.hash)) return;
    const stores = ((D().state.data || {}).stores || []).filter((s) => s.is_active !== false).map((s) => s.id);
    ["BOLETA", "FACTURA", "TICKET"].forEach((d) => { tplFetch(d, ""); stores.slice(0, 6).forEach((s) => tplFetch(d, s)); });
  };
  function tplSample(t) {
    const sale = { doc_type: TPL.doc === "FACTURA" ? "FACTURA" : TPL.doc === "TICKET" ? "TICKET" : "BOLETA", sale_number: "B001-00000123", total_cents: 15990, discount_cents: 0, customer_name: "Cliente de prueba", seller_name: "Vendedor", status: "COMPLETED", store_id: TPL.store || null };
    const cfg = (window.DL_CONFIG || {}).BUSINESS || {};
    const m = { sale, biz: { name: cfg.name || "DAN-LINER", ruc: cfg.ruc, address: cfg.address, footer: cfg.footer }, st: {}, doc: { title: (DOCS.find((x) => x[0] === TPL.doc) || [])[1] || "Boleta" }, when: "24/10/2026 10:30",
      items: [{ quantity: 1, desc: "Saco ejemplo T.M Azul", unit_price_cents: 15990, line_total_cents: 15990 }], pays: [{ label: "Efectivo", cents: 15990 }] };
    const keep = window.DL_RECEIPT_TPL; window.DL_RECEIPT_TPL = () => t;
    try { return window.DL_Print ? window.DL_Print.rawbtText(m, 0) : ""; } finally { window.DL_RECEIPT_TPL = keep; }
  }
  function renderPlantillas() {
    if (!remote()) return `<p class="muted">Disponible con la base de datos conectada.</p>`;
    const key = TPL.doc + "|" + TPL.store; if (TPL.key !== key) { TPL.key = key; TPL.loaded = false; }
    load("v19tpl" + key, TPL, () => rpc("get_receipt_template", { p_doc_type: TPL.doc, p_store_id: TPL.store ? Number(TPL.store) : null }));
    const stores = ((D().state.data || {}).stores || []).filter((s) => s.is_active !== false);
    const t = TPL.data || {};
    const n = (id, l, v, min, max, step) => `<label>${l}<input type="number" id="${id}" min="${min}" max="${max}" step="${step || 0.5}" value="${esc(v == null ? "" : v)}"></label>`;
    return `<section class="stack tpl34">
      <p class="muted">Cómo sale impreso cada comprobante en la ticketera (PDF y RawBT): ancho del papel, márgenes, tamaño de letra y textos de arriba y abajo. Cada tienda puede tener la suya; si no, usa la general.</p>
      <div class="row" style="flex-wrap:wrap;justify-content:flex-start">${DOCS.map(([k, l]) => `<button type="button" class="chip ${TPL.doc === k ? "on" : ""}" data-act="v19-tpl-doc" data-id="${k}">${esc(l)}</button>`).join("")}</div>
      <label>Tienda<select id="tpl-store" data-tpl34>${`<option value="">General (todas)</option>`}${stores.map((s) => `<option value="${esc(s.id)}"${String(s.id) === TPL.store ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
      ${errBox(TPL)}${!TPL.loaded ? `<p class="muted">Cargando…</p>` : `
      ${TPL.store && t.inherited ? `<p class="tiny muted">Esta tienda usa la plantilla general. Si guardas, tendrá la suya.</p>` : ""}
      <div class="two"><label>Ancho del papel<select id="tpl-paper"><option value="58"${Number(t.paper_width_mm) === 58 ? " selected" : ""}>58 mm (32 letras por línea)</option><option value="80"${Number(t.paper_width_mm) !== 58 ? " selected" : ""}>80 mm (48 letras por línea)</option></select></label>
        ${n("tpl-font", "Letra (pt, 6 a 16)", t.font_size_pt, 6, 16, 0.5)}</div>
      <div class="two">${n("tpl-ml", "Margen izquierdo (mm)", t.margin_left_mm, 0, 15)}${n("tpl-mr", "Margen derecho (mm)", t.margin_right_mm, 0, 15)}</div>
      <div class="two">${n("tpl-mt", "Margen de arriba (mm)", t.margin_top_mm, 0, 30)}<span class="tiny muted">Ancho útil: ${esc(t.printable_width_mm != null ? t.printable_width_mm + " mm" : "—")}${" · ticketera: " + (Number(t.paper_width_mm) === 80 ? 48 : 32) + " letras por línea"}</span></div>
      <label>Texto de arriba (opcional)<textarea id="tpl-head" rows="2" maxlength="500">${esc(t.header_text || "")}</textarea></label>
      <label>Texto de abajo (opcional)<textarea id="tpl-foot" rows="2" maxlength="500" placeholder="Si lo dejas vacío, sale el pie de siempre">${esc(t.footer_text || "")}</textarea></label>
      <div class="row" style="justify-content:flex-start;gap:14px"><label class="checks"><input type="checkbox" id="tpl-logo"${t.show_logo ? " checked" : ""}> Mostrar logo</label><label class="checks"><input type="checkbox" id="tpl-qr"${t.show_qr ? " checked" : ""}> Mostrar QR</label></div>
      ${TPL.msg ? `<p class="tiny ok">${esc(TPL.msg)}</p>` : ""}
      <div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:8px"><button class="btn small" type="button" data-act="v19-tpl-save">Guardar plantilla</button>${TPL.store && !t.inherited ? `<button class="btn ghost small" type="button" data-act="v19-tpl-reset">Usar la general</button>` : ""}</div>
      <details class="panel"><summary>Vista previa en ticketera (lo guardado)</summary><pre class="tpl-preview34">${esc(tplSample(t))}</pre></details>`}
    </section>`;
  }
  A["v19-tpl-doc"] = (el) => { TPL.doc = el.dataset.id; TPL.msg = ""; D().render(); };
  A["v19-tpl-save"] = async () => {
    const values = { paper_width_mm: Number(val("tpl-paper")), font_size_pt: Number(val("tpl-font")), margin_left_mm: Number(val("tpl-ml")), margin_right_mm: Number(val("tpl-mr")), margin_top_mm: Number(val("tpl-mt")), header_text: val("tpl-head"), footer_text: val("tpl-foot"), show_logo: val("tpl-logo"), show_qr: val("tpl-qr") };
    if (/[<>]/.test(values.header_text + values.footer_text)) throw new Error("Los textos no pueden llevar < ni >.");
    TPL.data = await rpc("set_receipt_template", { p_doc_type: TPL.doc, p_values: values, p_store_id: TPL.store ? Number(TPL.store) : null });
    Object.keys(TPLC).forEach((k) => delete TPLC[k]); Object.keys(TPLB).forEach((k) => delete TPLB[k]);
    TPL.msg = "Plantilla guardada. Ya se usa al imprimir."; D().render();
  };
  A["v19-tpl-reset"] = async () => {
    if (!(await DL_UI.confirm("¿Quitar la plantilla de esta tienda y usar la general?"))) return;
    TPL.data = await rpc("set_receipt_template", { p_doc_type: TPL.doc, p_values: null, p_store_id: Number(TPL.store) });
    Object.keys(TPLC).forEach((k) => delete TPLC[k]); Object.keys(TPLB).forEach((k) => delete TPLB[k]);
    TPL.msg = "Ahora usa la plantilla general."; D().render();
  };
  document.addEventListener("change", (e) => { const t = e.target; if (t && t.matches && t.matches("[data-tpl34]")) { TPL.store = t.value; TPL.msg = ""; D().render(); } });

  // ---------- Variantes desde la tela (get_fabric_colors / set_fabric_colors / create_variants_from_fabric) ----------
  const FV = { product: "", fabric: "", products: null, loaded: false, data: null, err: "", key: "", msg: "", palette: false };
  function renderTelaVar() {
    if (!remote()) return `<p class="muted">Disponible con la base de datos conectada.</p>`;
    if (!FV.products && !K().busy.v19fvp) { K().busy.v19fvp = true; S().rest("products?select=id,name&is_active=eq.true&order=name&limit=1000").then((r) => { FV.products = r || []; }).catch((e) => { FV.products = []; FV.err = human(e); }).finally(() => { K().busy.v19fvp = false; D().render(); }); }
    const data = D().state.data || {};
    const fabrics = (data.fabrics || []).filter((f) => f.is_active !== false);
    const sizes = (data.sizes || []).filter((z) => z.is_active !== false).slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    if (FV.fabric && FV.key !== FV.fabric) { FV.key = FV.fabric; FV.loaded = false; }
    if (FV.fabric) load("v19fv" + FV.fabric, FV, () => rpc("get_fabric_colors", { p_fabric_id: Number(FV.fabric), p_include_inactive: false }));
    const d = FV.data || {}; const colors = (d.colors || []).filter((c) => c.is_active !== false);
    const hex = (h) => (/^#[0-9a-f]{3,8}$/i.test(String(h || "")) ? h : "#888");
    const inPal = new Set(colors.map((c) => String(c.color_id)));
    return `<section class="stack telavar34">
      <p class="muted">La tela manda: elige la pieza y la tela, marca los colores de esa tela y las tallas, y se crean todas las combinaciones de una vez (máx. 300). Solo puedes usar colores de la paleta de la tela.</p>
      <div class="two"><label>Pieza<select id="fv-product" data-fv34="product"><option value="">Elige…</option>${(FV.products || []).map((p) => `<option value="${esc(p.id)}"${String(p.id) === FV.product ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
        <label>Tela<select id="fv-fabric" data-fv34="fabric"><option value="">Elige…</option>${fabrics.map((f) => `<option value="${esc(f.id)}"${String(f.id) === FV.fabric ? " selected" : ""}>${esc(f.name)}${f.code ? " · " + esc(f.code) : ""}</option>`).join("")}</select></label></div>
      ${FV.err ? `<p class="alert-text">${esc(FV.err)}</p>` : ""}${FV.msg ? `<p class="tiny ok">${esc(FV.msg)}</p>` : ""}
      ${!FV.fabric ? "" : !FV.loaded ? `<p class="muted">Cargando colores de la tela…</p>` : `
      <fieldset class="photo-box"><legend>Colores de ${esc(d.fabric_name || "la tela")}</legend>
        ${colors.length ? `<div class="row" style="flex-wrap:wrap;justify-content:flex-start;gap:10px">${colors.map((c) => `<label class="checks"><input type="checkbox" class="fv-color" value="${esc(c.color_id)}"> <span class="sw34" style="background:${hex(c.hex)}"></span> ${esc(c.name)} <span class="tiny muted">(${num(c.variants || 0, 0)} var.)</span></label>`).join("")}</div>` : `<p class="tiny muted">Esta tela aún no tiene colores. Agrégalos a su paleta.</p>`}
        <button class="btn ghost small" type="button" data-act="v19-fv-pal">${FV.palette ? "Cerrar paleta" : "Editar paleta de la tela"}</button>
        ${FV.palette ? `<div class="stack"><p class="tiny muted">Marca los colores que existen en esta tela. Si quitas uno que ya tiene variantes, solo se desactiva.</p><div class="row" style="flex-wrap:wrap;justify-content:flex-start;gap:10px">${(data.colors || []).filter((c) => c.is_active !== false).map((c) => `<label class="checks"><input type="checkbox" class="fv-pal" value="${esc(c.id)}"${inPal.has(String(c.id)) ? " checked" : ""}> <span class="sw34" style="background:${hex(c.hex)}"></span> ${esc(c.name)}</label>`).join("")}</div><button class="btn small" type="button" data-act="v19-fv-palsave">Guardar paleta</button></div>` : ""}</fieldset>
      <fieldset class="photo-box"><legend>Tallas</legend><div class="row" style="flex-wrap:wrap;justify-content:flex-start;gap:10px">${sizes.map((z) => `<label class="checks"><input type="checkbox" class="fv-size" value="${esc(z.id)}"> ${esc(z.label)}</label>`).join("")}</div></fieldset>
      <div class="two"><label>Precio de venta (S/)<input id="fv-price" type="number" min="0" step="0.1" inputmode="decimal"></label><label>Costo (S/, opcional)<input id="fv-cost" type="number" min="0" step="0.1" inputmode="decimal"></label></div>
      <label>Precio mínimo (S/, opcional)<input id="fv-min" type="number" min="0" step="0.1" inputmode="decimal"></label>
      <button class="btn" type="button" data-act="v19-fv-create">Crear variantes</button>`}
    </section>`;
  }
  document.addEventListener("change", (e) => { const t = e.target; if (t && t.matches && t.matches("[data-fv34]")) { FV[t.dataset.fv34] = t.value; FV.msg = ""; FV.err = ""; D().render(); } });
  A["v19-fv-pal"] = () => { FV.palette = !FV.palette; D().render(); };
  A["v19-fv-palsave"] = async () => {
    await rpc("set_fabric_colors", { p_fabric_id: Number(FV.fabric), p_color_ids: checked(".fv-pal").map(Number) });
    FV.palette = false; FV.loaded = false; FV.msg = "Paleta guardada."; D().render();
  };
  A["v19-fv-create"] = async () => {
    if (!FV.product) throw new Error("Elige la pieza.");
    const cs = checked(".fv-color").map(Number); const zs = checked(".fv-size").map(Number);
    if (!cs.length) throw new Error("Marca al menos un color."); if (!zs.length) throw new Error("Marca al menos una talla.");
    const price = Number(val("fv-price")); if (!(price > 0)) throw new Error("Indica el precio de venta.");
    const cost = val("fv-cost") === "" ? 0 : Number(val("fv-cost")); const min = val("fv-min") === "" ? null : Number(val("fv-min"));
    if (!(await DL_UI.confirm(`Se crearán hasta ${cs.length * zs.length} variantes (${cs.length} colores × ${zs.length} tallas) a ${soles(price)}. Las que ya existen no se repiten.`, { ok: "Crear", danger: false }))) return;
    const r = await rpc("create_variants_from_fabric", { p_product_id: Number(FV.product), p_fabric_id: Number(FV.fabric), p_color_ids: cs, p_size_ids: zs, p_sale_price: price, p_cost_price: cost, p_min_price: min });
    FV.msg = `Listo: ${num((r && (r.created != null ? r.created : r.count)) || 0, 0)} variantes nuevas${r && r.reactivated ? `, ${num(r.reactivated, 0)} reactivadas` : ""}.`;
    FV.loaded = false; await D().reload(); D().render();
  };

  // ---------- Pedidos web: buscador (search_web_orders) ----------
  const OS = { q: "", status: "", from: "", to: "", on: false, loaded: false, data: null, err: "", key: "" };
  const OST = [["", "Todos"], ["RECIBIDO", "Recibido"], ["PAGO_EN_REVISION", "Pago en revisión"], ["CONFIRMADO", "Confirmado"], ["EN_PREPARACION", "En preparación"], ["EMPAQUETADO", "Empaquetado"], ["LISTO_PARA_RECOGER", "Listo para recoger"], ["ENVIADO", "Enviado"], ["ENTREGADO", "Entregado"], ["RECHAZADO", "Rechazado"], ["CANCELADO", "Cancelado"]];
  function searchBox() {
    return `<form class="row order-search34" style="flex-wrap:wrap;justify-content:flex-start;align-items:flex-end;gap:8px" data-form="noop" onsubmit="return false">
      <label style="flex:1;min-width:180px">Buscar pedido<input id="os-q" type="search" value="${esc(OS.q)}" placeholder="Código, nombre, DNI o celular" autocomplete="off"></label>
      <label>Estado<select id="os-status">${OST.map(([k, l]) => `<option value="${k}"${OS.status === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label>Desde<input id="os-from" type="date" value="${esc(OS.from)}"></label><label>Hasta<input id="os-to" type="date" value="${esc(OS.to)}"></label>
      <button class="btn small" type="button" data-act="v19-os-go">Buscar</button>${OS.on ? `<button class="btn ghost small" type="button" data-act="v19-os-clear">Limpiar</button>` : ""}</form>`;
  }
  function searchResults(storeId) {
    const key = [OS.q, OS.status, OS.from, OS.to, storeId || ""].join("|"); if (OS.key !== key) { OS.key = key; OS.loaded = false; }
    load("v19os" + key, OS, () => rpc("search_web_orders", { p_q: OS.q || null, p_status: OS.status || null, p_store_id: storeId ? Number(storeId) : null, p_from: OS.from || null, p_to: OS.to || null, p_limit: 50, p_offset: 0 }));
    if (OS.err) return errBox(OS, "v19-os-go");
    if (!OS.loaded) return `<p class="muted">Buscando…</p>`;
    const d = OS.data || {}; const rows = d.rows || [];
    if (!rows.length) return `<p class="muted">No se encontraron pedidos.</p>`;
    return `<p class="tiny muted">${num(d.total_count || rows.length, 0)} pedidos encontrados${d.total_count > rows.length ? ` (mostrando ${rows.length})` : ""}.</p>${rows.map((o) => `<article class="panel stack">
      <div class="row"><b>${esc(o.code || o.id)}</b><span class="badge">${esc(o.status_label || o.status)}</span></div>
      <div class="tiny">${esc(o.customer_name || "")}${o.customer_phone ? ` · <a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a>` : ""}${o.customer_email ? " · " + esc(o.customer_email) : ""}</div>
      <div class="tiny muted">${esc(when(o.created_at))} · ${esc(o.delivery === "ENVIO" ? "Envío" + (o.distrito ? " a " + o.distrito : "") : "Recojo" + (o.store_name ? " en " + o.store_name : ""))}${o.payment_method ? " · " + esc(o.payment_method) : ""}${o.has_proof ? " · con comprobante" : ""}</div>
      <div class="tiny">${esc((o.items || []).map((i) => i.qty + " × " + (i.product || "") + (i.variant ? " " + i.variant : "")).join(" · "))} · <b>${soles(o.total)}</b></div></article>`).join("")}`;
  }
  const baseOrders = window.DL_ORDERS_PANEL;
  if (baseOrders) {
    window.DL_ORDERS_PANEL = (storeId) => `<div class="stack">${searchBox()}${OS.on ? `<div class="stack orders-search34">${searchResults(storeId)}</div>` : baseOrders(storeId)}</div>`;
  }
  A["v19-os-go"] = () => { OS.q = val("os-q"); OS.status = val("os-status"); OS.from = val("os-from"); OS.to = val("os-to"); OS.on = !!(OS.q || OS.status || OS.from || OS.to); OS.loaded = false; OS.err = ""; OS.key = ""; D().render(); };
  A["v19-os-clear"] = () => { Object.assign(OS, { q: "", status: "", from: "", to: "", on: false, key: "" }); D().render(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.id === "os-q") { e.preventDefault(); A["v19-os-go"](); } });

  // ---------- Ficha: stock por color (get_product_color_stock, público) → {"color_id|fabric_id": unidades} ----------
  const CS = {};
  window.DL_COLOR_STOCK = (productId) => {
    if (!productId || !remote()) return null;
    const k = String(productId);
    if (!CS[k]) {
      CS[k] = { loaded: false };
      rpc("get_product_color_stock", { p_product_id: Number(productId) }).then((r) => { CS[k].map = {}; ((r && r.colors) || []).forEach((c) => { const n = String(c.color_id) + "|" + String(c.fabric_id || ""); CS[k].map[n] = c.available === false ? 0 : c.total_stock != null ? Number(c.total_stock) : (c.sizes || []).reduce((t, z) => t + Math.max(0, Number(z.stock || 0)), 0); }); CS[k].loaded = true; D().render(); }).catch(() => { CS[k].loaded = true; CS[k].map = null; });
    }
    return CS[k].loaded ? CS[k].map : null;
  };

  // ---------- Pestañas y arranque ----------
  window.DL_ADMIN_TABS = (window.DL_ADMIN_TABS || []).concat([
    { id: "pagos", label: "Pagos por confirmar", need: ["SUPERVISOR", "VENDEDOR", "CAJERO"], render: renderPagos },
    { id: "reparto", label: "Reparto", need: ["SUPERVISOR", "REPARTIDOR"], render: renderReparto },
    { id: "avisos", label: "Avisos al celular", need: ["ADMIN", "MARKETING"], render: renderAvisos },
    { id: "analitica", label: "Reportes y análisis", need: ["ADMIN", "CONTADOR"], render: renderAnalitica },
    { id: "plantillas", label: "Plantillas de impresión", need: ["ADMIN"], render: renderPlantillas },
    { id: "telavar", label: "Variantes desde la tela", need: ["SUPERVISOR", "ALMACENERO"], render: renderTelaVar },
  ]);
  window.DL_AFTER = (window.DL_AFTER || []).concat([() => { ownerLoad(); prefetchTpl(); }]);
  const prevExtra = window.DL_CUENTA_EXTRA;
  window.DL_CUENTA_EXTRA = () => {
    const u = user(); const mine = u && window.DL_IS_OWNER_ID(u.id) ? `<p class="owner-me34">${window.DL_OWNER_BADGE(u.id)} <span class="tiny muted">Eres el dueño: nadie más puede quitarte el acceso ni cambiar tus permisos.</span></p>` : "";
    return mine + (prevExtra ? prevExtra() : "");
  };
})();
