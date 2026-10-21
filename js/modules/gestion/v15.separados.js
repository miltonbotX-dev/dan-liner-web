// modules/gestion/v15.separados.js · Separados (adelantos) con reserva de stock y constancia interna A001; Mi cuenta › Mis separados y Mensajes.
(function () {
  const { esc, rpc, money, plain, num, fdate, human, stores, rerender, toast, once, limaDate } = window.DL_V15;
  const D = () => window.DL;
  const allow = (r) => D().allow(r);
  const ADV = { data: null, loaded: false, err: "", status: "ABIERTO", store: "", sel: null, form: null, cq: "", cres: [], vq: "", receipt: null, ferr: "" };
  const ADV_ST = { ABIERTO: "Separado", COMPLETADO: "Entregado", CANCELADO: "Cancelado", VENCIDO: "Vencido" };
  const METHODS = [["EFECTIVO", "Efectivo"], ["YAPE", "Yape"], ["PLIN", "Plin"], ["TARJETA", "Tarjeta"], ["TRANSFERENCIA", "Transferencia"]];
  const payFields = (pre, amount) => `<div class="two"><label>Monto (S/)<input name="${pre}amount" inputmode="decimal" required value="${esc(amount == null ? "" : Number(amount).toFixed(2))}"></label><label>Medio<select name="${pre}method">${METHODS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label></div>
      <div class="two"><label>N.º de operación (si no es efectivo)<input name="${pre}op" maxlength="40"></label><label>Captura Yape/Plin<input name="${pre}proof" type="file" accept="image/*"></label></div>`;
  async function readPay(form, pre) {
    const g = (n) => form.elements[pre + n]; const amount = num(g("amount").value); const method = g("method").value; const op = g("op").value.trim();
    if (!(amount > 0)) throw new Error("Escribe un monto válido.");
    const file = g("proof").files && g("proof").files[0];
    if ((method === "YAPE" || method === "PLIN") && !file) throw new Error("Sube la captura del " + (method === "YAPE" ? "Yape" : "Plin") + ".");
    if ((method === "TARJETA" || method === "TRANSFERENCIA") && !op) throw new Error("Escribe el número de operación.");
    const pay = { method, amount: Math.round(amount * 100) / 100 }; if (op) pay.operation_code = op;
    if (file) { const data = await window.DL_compressProof(file); pay.proof_url = await D().Store.v2api.uploadProof(data); }
    return pay;
  }
  function receiptHtml(r) {
    const b = (window.DL_CONFIG && window.DL_CONFIG.BUSINESS) || {};
    return `<div class="panel stack adv-receipt" id="adv-receipt"><p class="kicker">Constancia de separado · documento interno</p><h3 class="order-code" style="margin:0">${esc(r.receipt || "")}</h3>
      <p class="tiny">${esc(b.name || "DAN-LINER")}${b.ruc ? " · RUC " + esc(b.ruc) : ""} · ${esc(fdate(new Date().toISOString(), true))}</p>
      <p>Separado <b>${esc(r.public_code || "")}</b> · abono <b>${money(r.amount)}</b> · pagado ${money(r.paid)} · saldo <b>${money(r.balance)}</b>${r.due_date ? " · recoger hasta " + esc(fdate(r.due_date)) : ""}</p>
      <p class="tiny">No es comprobante de pago SUNAT. La boleta o factura se emite por el total al entregar la prenda.</p>
      <div class="row"><button class="btn ghost small" type="button" data-act="adv-print">Imprimir</button><button class="btn ghost small" type="button" data-act="adv-receipt-close">Listo</button></div></div>`;
  }
  function detailHtml(a) {
    const open = a.status === "ABIERTO" || a.status === "VENCIDO";
    return `<div class="stack" style="max-width:760px"><button class="btn ghost small" type="button" data-act="adv-back">← Separados</button>
      <div class="panel stack"><div class="row"><h3 class="grow" style="margin:0"><span class="order-code">${esc(a.public_code)}</span> · ${esc(a.customer_name || "")}</h3><span class="badge ${a.status === "ABIERTO" ? "ok" : ""}">${esc(a.status_label || ADV_ST[a.status] || a.status)}</span></div>
        <p class="tiny">${esc(a.store_name || "")} · ${esc(fdate(a.created_at, true))}${a.seller_name ? " · " + esc(a.seller_name) : ""}${a.customer_phone ? " · " + esc(a.customer_phone) : ""} · recoger hasta <b>${esc(fdate(a.due_date))}</b>${a.days_left != null && open ? ` (${Number(a.days_left)} días)` : ""}</p>
        <ul class="combo-list">${(a.items || []).map((i) => `<li>${esc(i.description)} × ${Number(i.quantity)} · ${money(i.line_total)}</li>`).join("")}</ul>
        <div class="stats"><article class="stat"><span class="tiny">Total</span><b>${money(a.total)}</b></article><article class="stat"><span class="tiny">Pagado</span><b>${money(a.paid)}</b></article><article class="stat"><span class="tiny">Saldo</span><b>${money(a.balance)}</b></article></div>
        <h4 style="margin:0">Abonos</h4><ul class="note-list">${(a.payments || []).map((p) => `<li class="note-item"><b>${esc(p.receipt || "")}</b> · ${esc(p.kind === "DEVOLUCION" ? "Devolución" : "Abono")} ${esc(p.method)} ${money(p.amount)} · <span class="tiny">${esc(fdate(p.paid_at, true))}${p.operation_code ? " · op. " + esc(p.operation_code) : ""}</span></li>`).join("") || `<li class="tiny muted">Sin abonos.</li>`}</ul>
        ${a.cancel_reason ? `<p class="tiny">Motivo: ${esc(a.cancel_reason)}</p>` : ""}${a.notes ? `<p class="tiny">Nota: ${esc(a.notes)}</p>` : ""}</div>
      ${open ? `<form class="panel stack" data-form="adv-pay" data-id="${esc(a.id)}"><h3>Registrar abono</h3>${payFields("p_", a.balance)}<p class="tiny">Se cobra en tu caja abierta de esta tienda.</p><button class="btn" type="submit">Registrar abono</button></form>
        <form class="panel stack" data-form="adv-complete" data-id="${esc(a.id)}"><h3>Entregar y emitir comprobante</h3><label>Comprobante<select name="doc"><option value="BOLETA">Boleta</option><option value="FACTURA">Factura</option><option value="TICKET">Ticket</option></select></label>
          ${Number(a.balance) > 0 ? `<p class="tiny">Saldo a cobrar ahora: <b>${money(a.balance)}</b></p>${payFields("f_", a.balance)}` : `<p class="tiny">Pagado completo.</p>`}<button class="btn" type="submit">Entregar</button></form>
        <div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn ghost small" type="button" data-act="adv-extend" data-id="${esc(a.id)}">Extender plazo</button>${allow(["SUPERVISOR"]) ? `<button class="btn ghost small" type="button" data-act="adv-cancel" data-id="${esc(a.id)}">Cancelar separado</button>` : ""}</div>` : ""}</div>`;
  }
  function formHtml() {
    const f = ADV.form; const vars = (D().state.data.products || []).filter((p) => !p.deleted_at && p.is_active !== false);
    const q = ADV.vq.toLowerCase(); const hits = q.length >= 2 ? vars.filter((v) => `${v.name} ${v.sku || ""} ${v.barcode || ""} ${v.size_label || ""} ${v.color || ""}`.toLowerCase().includes(q)).slice(0, 12) : [];
    const total = f.items.reduce((s, i) => s + i.price * i.qty, 0);
    return `<form class="panel stack" data-form="adv-create" style="max-width:760px"><h3>Nuevo separado</h3>
      <label>Tienda<select name="store_id">${stores().map((s) => `<option value="${esc(s.id)}" ${String(f.store_id) === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
      <div class="stack"><b>Cliente</b>${f.customer ? `<div class="row"><span class="grow">${esc(f.customer.full_name || f.customer.name)} ${f.customer.dni ? `<span class="tiny">DNI ${esc(f.customer.dni)}</span>` : ""}</span><button class="link-btn" type="button" data-act="adv-cust" data-id="">Cambiar</button></div>`
        : `<input id="adv-cq" type="search" placeholder="Buscar cliente por nombre, DNI o celular" value="${esc(ADV.cq)}" autocomplete="off"><div class="stack">${ADV.cres.map((c, i) => `<button type="button" class="cust-row" data-act="adv-cust" data-id="${i}"><b>${esc(c.full_name)}</b> <span class="tiny">${esc([c.dni, c.phone].filter(Boolean).join(" · "))}</span></button>`).join("")}</div><p class="tiny">¿Cliente nuevo? Créalo primero en Clientes o en Caja.</p>`}</div>
      <div class="stack"><b>Prendas</b>${f.items.map((i, k) => `<div class="row"><span class="grow">${esc(i.label)}</span><input type="number" min="1" max="20" value="${i.qty}" data-adv-qty="${k}" style="width:60px" aria-label="Cantidad"><input inputmode="decimal" value="${i.price.toFixed(2)}" data-adv-price="${k}" style="width:90px" aria-label="Precio"><button class="link-btn" type="button" data-act="adv-rm" data-id="${k}">Quitar</button></div>`).join("")}
        <input id="adv-vq" type="search" placeholder="Agregar prenda: nombre, código o talla" value="${esc(ADV.vq)}" autocomplete="off"><div class="row" style="flex-wrap:wrap;justify-content:flex-start">${hits.map((v) => `<button type="button" class="chip" data-act="adv-add" data-id="${esc(v.id)}">${esc(v.name)} · T. ${esc(v.size_label || "")} · ${D().soles(D().priceOf(v).unit)}</button>`).join("")}</div>
        <p class="tiny">Total: <b>${money(total)}</b>. Las prendas quedan reservadas: no se venden a otro cliente hasta la fecha límite.</p></div>
      <h4 style="margin:0">Primer abono</h4>${payFields("p_", null)}
      <div class="two"><label>Recoger hasta (máx. 90 días)<input type="date" name="due" value="${esc(limaDate(Date.now() + 30 * 864e5))}"></label><label>Nota (opcional)<input name="notes" maxlength="200"></label></div>
      ${ADV.ferr ? `<p class="alert-text" role="alert">${esc(ADV.ferr)}</p>` : ""}
      <div class="row"><button class="btn" type="submit">Crear separado</button><button class="btn ghost" type="button" data-act="adv-cancel-form">Cancelar</button></div></form>`;
  }
  function renderAdvances() {
    if (!allow(["SUPERVISOR", "VENDEDOR", "CAJERO"])) return `<p class="muted">Sin permiso.</p>`;
    if (ADV.receipt) return receiptHtml(ADV.receipt);
    if (ADV.sel) return ADV.sel.loading ? `<p class="muted">Cargando…</p>` : detailHtml(ADV.sel);
    if (ADV.form) return formHtml();
    if (!ADV.loaded) setTimeout(() => once("adv", () => rpc("get_advances", { p_store_id: ADV.store ? Number(ADV.store) : null, p_status: ADV.status || null, p_limit: 100, p_offset: 0 }), ADV), 0);
    const rows = (ADV.data && ADV.data.rows) || [];
    return `<div class="stack" style="max-width:860px"><div class="row" style="flex-wrap:wrap"><button class="btn" type="button" data-act="adv-new">+ Nuevo separado</button>
        <select id="adv-store" aria-label="Tienda"><option value="">Todas las tiendas</option>${stores().map((s) => `<option value="${esc(s.id)}" ${ADV.store === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
      <div class="tabs">${[["ABIERTO", "Separados"], ["VENCIDO", "Vencidos"], ["COMPLETADO", "Entregados"], ["CANCELADO", "Cancelados"], ["", "Todos"]].map(([k, l]) => `<button type="button" class="chip ${ADV.status === k ? "on" : ""}" data-act="adv-filter" data-id="${k}">${l}</button>`).join("")}</div>
      ${ADV.err ? `<p class="alert-text">${esc(ADV.err)}</p>` : ""}
      ${!ADV.loaded ? `<p class="muted">Cargando…</p>` : rows.length ? rows.map((a) => `<button type="button" class="panel row adv-row" data-act="adv-open" data-id="${esc(a.id)}" style="text-align:left;width:100%"><span class="grow"><span class="order-code">${esc(a.public_code)}</span> <b>${esc(a.customer_name || "")}</b><br><span class="tiny">${esc(a.store_name || "")} · hasta ${esc(fdate(a.due_date))}${a.days_left != null && a.status === "ABIERTO" ? ` · ${Number(a.days_left)} días` : ""}</span></span><span class="num">${money(a.balance)}<br><span class="tiny">saldo de ${money(a.total)}</span></span></button>`).join("") : `<p class="muted">No hay separados${ADV.status ? " en este estado" : ""}.</p>`}</div>`;
  }
  // ---------- Cliente ----------
  const MY = { adv: { loaded: false }, msg: { loaded: false }, unread: null };
  function renderMySeparados() {
    if (!MY.adv.loaded) setTimeout(() => once("myadv", () => rpc("get_my_advances"), MY.adv), 0);
    const list = MY.adv.data || [];
    return `<p class="kicker">Mi cuenta</p><h1>Mis separados</h1><p class="muted">Prendas que separaste con un adelanto en tienda.</p>
      ${MY.adv.err ? `<p class="alert-text">${esc(MY.adv.err)}</p>` : ""}${!MY.adv.loaded ? `<p class="muted">Cargando…</p>` : list.length ? list.map((a) => `<article class="panel stack my-adv"><div class="row"><span class="grow"><span class="order-code">${esc(a.public_code)}</span> · ${esc(a.store_name || "")}</span><span class="badge ${a.status === "ABIERTO" ? "ok" : ""}">${esc(a.status_label || ADV_ST[a.status] || a.status)}</span></div>
        <ul class="combo-list">${(a.items || []).map((i) => `<li>${esc(i.description)} × ${Number(i.quantity)}</li>`).join("")}</ul>
        <div class="stats"><article class="stat"><span class="tiny">Total</span><b>${money(a.total)}</b></article><article class="stat"><span class="tiny">Pagado</span><b>${money(a.paid)}</b></article><article class="stat"><span class="tiny">Saldo</span><b>${money(a.balance)}</b></article></div>
        ${a.status === "ABIERTO" ? `<p class="tiny">Recógelo hasta el <b>${esc(fdate(a.due_date))}</b>${a.days_left != null ? ` (${Number(a.days_left)} días)` : ""}.</p>` : ""}
        <details><summary class="tiny">Constancias de pago</summary><ul class="note-list">${(a.payments || []).map((p) => `<li class="note-item"><b>${esc(p.receipt || "")}</b> · ${esc(p.method)} ${money(p.amount)} · <span class="tiny">${esc(fdate(p.paid_at, true))}</span></li>`).join("")}</ul></details></article>`).join("") : `<p class="muted">No tienes separados.</p>`}`;
  }
  function renderMyMessages() {
    if (!MY.msg.loaded) setTimeout(() => once("mymsg", async () => { const r = await rpc("get_my_messages", { p_limit: 50, p_offset: 0 }); if ((r || []).some((m) => !m.is_read)) rpc("mark_my_messages_read", { p_ids: null }).then(() => { MY.unread = 0; }).catch(() => {}); return r; }, MY.msg), 0);
    const list = MY.msg.data || [];
    return `<p class="kicker">Mi cuenta</p><h1>Mensajes</h1>${MY.msg.err ? `<p class="alert-text">${esc(MY.msg.err)}</p>` : ""}
      ${!MY.msg.loaded ? `<p class="muted">Cargando…</p>` : list.length ? `<ul class="note-list">${list.map((m) => `<li class="note-item is-msg ${m.is_read ? "" : "unread"}"><p>${esc(m.body)}</p><span class="tiny">DAN-LINER · ${esc(fdate(m.created_at, true))}</span></li>`).join("")}</ul>` : `<p class="muted">No tienes mensajes.</p>`}`;
  }
  window.DL_CUENTA_SUB = Object.assign(window.DL_CUENTA_SUB || {}, { separados: renderMySeparados, mensajes: renderMyMessages });
  window.DL_UNREAD = () => {
    if (MY.unread == null && D().state.user && D().Store.mode === "remote") { MY.unread = 0; rpc("get_my_messages", { p_limit: 50, p_offset: 0 }).then((r) => { MY.unread = (r || []).filter((m) => !m.is_read).length; if (MY.unread && /^#cuenta$|^#entrar$/.test(location.hash)) rerender(); }).catch(() => {}); }
    return MY.unread ? ` <span class="badge ok">${MY.unread}</span>` : "";
  };
  window.addEventListener("hashchange", () => { if (!/^#cuenta\/(separados|mensajes)/.test(location.hash)) { MY.adv = { loaded: false }; MY.msg = { loaded: false }; } });

  // ---------- registro ----------
  const tabs = window.DL_ADMIN_TABS = window.DL_ADMIN_TABS || [];
  const t = tabs.find((x) => x.id === "adelantos");
  if (t) Object.assign(t, { label: "Separados", need: ["SUPERVISOR", "VENDEDOR", "CAJERO"], render: renderAdvances }); else tabs.push({ id: "adelantos", label: "Separados", need: ["SUPERVISOR", "VENDEDOR", "CAJERO"], render: renderAdvances });
  const advOpen = async (id) => { ADV.sel = { loading: true }; rerender(); try { ADV.sel = await rpc("get_advance", { p_advance_id: Number(id) }); } catch (e) { ADV.sel = null; toast(human(e), "error"); } rerender(); };
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, {
    "adv-create": async (form) => {
      const f = ADV.form; ADV.ferr = ""; f.store_id = form.elements.store_id.value;
      try {
        if (!f.customer) throw new Error("Elige el cliente."); if (!f.items.length) throw new Error("Agrega al menos una prenda.");
        const pay = await readPay(form, "p_");
        const r = await rpc("create_advance", { p_store_id: Number(f.store_id), p_customer_id: Number(f.customer.customer_id || f.customer.id), p_items: f.items.map((i) => ({ variant_id: Number(i.variant_id), qty: i.qty, unit_price: i.price })), p_payment: pay, p_due_date: form.elements.due.value || null, p_notes: form.elements.notes.value.trim() || null });
        ADV.form = null; ADV.loaded = false; ADV.receipt = { receipt: r.payment && r.payment.receipt, public_code: r.public_code, amount: pay.amount, paid: r.paid, balance: r.balance, due_date: r.due_date };
        toast("Separado creado ✓ " + (r.public_code || ""), "ok");
      } catch (e) { ADV.ferr = human(e); }
      rerender();
    },
    "adv-pay": async (form) => {
      const pay = await readPay(form, "p_");
      const r = await rpc("add_advance_payment", { p_advance_id: Number(form.dataset.id), p_payment: pay });
      ADV.receipt = { receipt: r.receipt, public_code: ADV.sel && ADV.sel.public_code, amount: r.amount, paid: r.paid, balance: r.balance, due_date: ADV.sel && ADV.sel.due_date };
      ADV.sel = null; ADV.loaded = false; rerender(); toast("Abono registrado ✓", "ok");
    },
    "adv-complete": async (form) => {
      const fin = form.elements.f_amount ? await readPay(form, "f_") : null;
      const r = await rpc("complete_advance", { p_advance_id: Number(form.dataset.id), p_document_type: form.elements.doc.value, p_final_payment: fin });
      ADV.sel = null; ADV.loaded = false; rerender(); toast(`Entregado ✓ ${r.series || ""}-${r.number || ""}`, "ok");
    },
  });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "adv-new": () => { ADV.form = { store_id: D().ui.storeId || (stores()[0] && stores()[0].id), customer: null, items: [] }; ADV.cq = ""; ADV.cres = []; ADV.vq = ""; ADV.ferr = ""; rerender(); },
    "adv-cancel-form": () => { ADV.form = null; rerender(); },
    "adv-filter": (el) => { ADV.status = el.dataset.id; ADV.loaded = false; rerender(); },
    "adv-open": (el) => advOpen(el.dataset.id),
    "adv-back": () => { ADV.sel = null; rerender(); },
    "adv-cust": (el) => { ADV.form.customer = el.dataset.id === "" ? null : ADV.cres[Number(el.dataset.id)]; rerender(); },
    "adv-add": (el) => { const v = (D().state.data.products || []).find((p) => String(p.id) === el.dataset.id); if (!v) return; ADV.form.items.push({ variant_id: v.id, label: `${v.name} · T. ${v.size_label || ""}${v.color ? " · " + v.color : ""}`, qty: 1, price: D().priceOf(v).unit / 100 }); ADV.vq = ""; rerender(); },
    "adv-rm": (el) => { ADV.form.items.splice(Number(el.dataset.id), 1); rerender(); },
    "adv-extend": async (el) => {
      const v = await window.dlgPrompt("Nueva fecha límite (AAAA-MM-DD, máximo 90 días desde hoy)", limaDate(Date.now() + 15 * 864e5), { title: "Extender plazo", ok: "Extender" }); if (!v) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) throw new Error("Usa el formato AAAA-MM-DD.");
      await rpc("extend_advance", { p_advance_id: Number(el.dataset.id), p_due_date: v.trim() }); await advOpen(el.dataset.id); toast("Plazo extendido ✓", "ok");
    },
    "adv-cancel": async (el) => {
      const reason = await window.dlgPrompt("Motivo de la cancelación", "", { title: "Cancelar separado", ok: "Cancelar separado", danger: true }); if (reason == null) return; if (!reason.trim()) throw new Error("Escribe el motivo.");
      const paid = Number((ADV.sel && ADV.sel.paid) || 0); let refund = null;
      if (paid > 0) { const back = await window.dlgPrompt(`Se pagó ${plain(paid)}. ¿Cuánto devuelves en efectivo? (0 si no devuelves)`, paid.toFixed(2), { title: "Devolución", ok: "Confirmar" }); if (back == null) return; const n = num(back); if (!(n >= 0)) throw new Error("Monto inválido."); if (n > 0) refund = { method: "EFECTIVO", amount: n }; }
      await rpc("cancel_advance", { p_advance_id: Number(el.dataset.id), p_reason: reason.trim(), p_refund: refund }); ADV.sel = null; ADV.loaded = false; rerender(); toast("Separado cancelado", "ok");
    },
    "adv-print": () => window.print(),
    "adv-receipt-close": () => { ADV.receipt = null; rerender(); },
  });
  let tq = null; const prevInput = window.DL_INPUT;
  const refocus = (id) => { const i = document.getElementById(id); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
  window.DL_INPUT = function (e) {
    const el = e.target;
    if (el && el.id === "adv-vq") { ADV.vq = el.value; clearTimeout(tq); tq = setTimeout(() => { rerender(); refocus("adv-vq"); }, 250); return true; }
    if (el && el.id === "adv-cq") { ADV.cq = el.value; clearTimeout(tq); tq = setTimeout(async () => { ADV.cres = ADV.cq.trim().length >= 2 ? (await rpc("search_customers_v2", { p_q: ADV.cq.trim(), p_limit: 8, p_offset: 0 }).catch(() => [])) || [] : []; rerender(); refocus("adv-cq"); }, 300); return true; }
    if (el && el.dataset && el.dataset.advQty != null) { const it = ADV.form.items[Number(el.dataset.advQty)]; if (it) it.qty = Math.max(1, Math.min(20, Number(el.value) || 1)); return true; }
    if (el && el.dataset && el.dataset.advPrice != null) { const it = ADV.form.items[Number(el.dataset.advPrice)]; const n = num(el.value); if (it && n >= 0) it.price = n; return true; }
    return prevInput ? prevInput(e) : false;
  };
  document.addEventListener("change", (e) => { const el = e.target; if (el && el.id === "adv-store") { ADV.store = el.value; ADV.loaded = false; rerender(); } });
})();
