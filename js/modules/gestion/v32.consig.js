// modules/gestion/v32.consig.js · Consignación con socios (BD v17, API_V17 §5). Caja → «Consignar»: abrir consignación,
// escanear salida / devolución, marcar vendido con boleta (o factura si el socio tiene RUC) a precio mayorista editable.
// Inventario → «Prestados» (get_consigned_stock) + resumen por socio (consignment_stats). Clases de IU: .consig-*.
(function () {
  const V = () => window.DL_V15; const X = () => window.DL_V17; const D = () => window.DL;
  const esc = (v) => V().esc(v); const money = (n) => V().plain(n);
  const C = { view: "new", partners: null, cur: null, list: null, listKey: "", mode: "out", sold: {}, pay: "EFECTIVO", op: "", proof: "", newP: false, busy: false, err: "" };
  const P = { stock: null, stats: null, key: "" };
  const ST = { ABIERTA: ["out", "Abierta"], CERRADA: ["back", "Cerrada"], PENDIENTE: ["out", "Pendiente"] };
  const sid = () => String(D().ui.storeId || "");
  const reload = () => V().rerender();
  async function safe(fn) { C.err = ""; try { return await fn(); } catch (e) { C.err = e.missing ? e.message : String((e && e.message) || V().human(e)); reload(); return null; } }
  function loadPartners() { if (C.partners !== null || C.lp) return; C.lp = true; X().call("partners", { p_search: null, p_include_inactive: false }).then((r) => { C.partners = r || []; }).catch(() => { C.partners = []; }).finally(() => { C.lp = false; reload(); }); }
  function loadList() { const k = sid(); if ((C.list !== null && C.listKey === k) || C.ll) return; C.ll = true; C.listKey = k; X().call("consignments", { p_status: null, p_partner_id: null, p_store_id: Number(k) || null, p_search: null, p_limit: 50, p_offset: 0 }).then((r) => { C.list = (r && r.items) || []; }).catch((e) => { C.list = []; C.err = e.message; }).finally(() => { C.ll = false; reload(); }); }
  async function openCur(id) { const r = await safe(() => X().call("consignment", { p_id: Number(id) })); if (r) { C.cur = r; C.view = "cur"; C.mode = "out"; C.sold = {}; reload(); } }
  const pending = (i) => Number(i.qty_pending != null ? i.qty_pending : Number(i.qty_out || 0) - Number(i.qty_returned || 0) - Number(i.qty_sold || 0));
  function stCls(c) { const p = Number(c.qty_pending || 0); return c.status === "CERRADA" ? ["back", "Cerrada"] : p ? ["out", p + " en la calle"] : ["sold", "Por cerrar"]; }
  function listCard(c) {
    const [k, l] = stCls(c);
    return `<button type="button" class="consig-card" data-act="cg-open" data-id="${esc(c.id)}" style="text-align:left;font:inherit;color:inherit;cursor:pointer">
      <div class="consig-head"><b>${esc(c.public_code)} · ${esc(c.partner_name)}</b><span class="consig-st ${k}">${esc(l)}</span></div>
      <span class="consig-who">${esc(c.store_name || "")} · ${esc(c.staff_name || "")} · salió ${Number(c.qty_out || 0)} · volvió ${Number(c.qty_returned || 0)} · vendido ${Number(c.qty_sold || 0)}${Number(c.amount_pending || 0) ? " · pendiente " + money(c.amount_pending) : ""}</span></button>`;
  }
  function curHtml() {
    const c = C.cur; const items = c.items || []; const partner = c.partner || {}; const doc = String(partner.document_number || c.partner_document || "");
    const isRuc = /^\d{11}$/.test(doc); const closed = c.status === "CERRADA";
    const lines = items.map((i) => {
      const s = C.sold[i.variant_id] || { qty: 0, price: Number(i.unit_price || 0) };
      return `<div class="consig-line"><span>${esc(i.description || i.product_name || "")}<br><span class="consig-who">salió ${Number(i.qty_out || 0)} · volvió ${Number(i.qty_returned || 0)} · vendido ${Number(i.qty_sold || 0)} · ${money(i.unit_price)}</span></span>
        ${C.mode === "sold" && pending(i) ? `<input type="number" min="0" max="${pending(i)}" step="1" inputmode="numeric" value="${s.qty}" data-sq="${esc(i.variant_id)}" aria-label="Cantidad vendida" style="width:64px"><input inputmode="decimal" value="${Number(s.price).toFixed(2)}" data-sp="${esc(i.variant_id)}" aria-label="Precio (S/)">`
          : `<span class="consig-st ${pending(i) ? "out" : "back"}">${pending(i) ? pending(i) + " fuera" : "ok"}</span><span></span>`}</div>`;
    }).join("") || `<p class="tiny muted">Aún no hay prendas. Escanea la primera.</p>`;
    const total = Object.entries(C.sold).reduce((n, [, s]) => n + Number(s.qty || 0) * Number(s.price || 0), 0);
    return `<div class="consig-card"><div class="consig-head"><b>${esc(c.public_code)} · ${esc(c.partner_name || partner.name || "")}</b><span class="consig-st ${closed ? "back" : "out"}">${closed ? "Cerrada" : "Abierta"}</span></div>
      ${closed ? "" : `<div class="consig-tabs">${[["out", "Salida"], ["return", "Devolución"], ["sold", "Vendido"]].map(([m, l]) => `<button type="button" class="btn small ${C.mode === m ? "" : "ghost"}" data-act="cg-mode" data-id="${m}" aria-pressed="${C.mode === m}">${l}</button>`).join("")}</div>`}
      ${!closed && C.mode !== "sold" ? `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-act="cg-scan">Escanear ${C.mode === "out" ? "salida" : "devolución"}</button><input id="cg-code" class="grow" placeholder="O escribe el código / SKU" autocomplete="off" style="min-width:140px">${C.mode === "out" ? `<input id="cg-price" inputmode="decimal" placeholder="Precio (opcional)" style="width:130px" aria-label="Precio por prenda (S/), vacío = precio mayorista">` : ""}<button class="btn ghost small" type="button" data-act="cg-code">Agregar</button></div>` : ""}
      ${lines}
      ${C.mode === "sold" && !closed ? `<form class="stack" data-form="cg-sold" novalidate>
        <div class="consig-line"><b>Total ${isRuc ? "factura" : "boleta"}</b><span></span><b class="num">${money(total)}</b></div>
        <div class="two"><label>Pago<select name="pay">${["EFECTIVO", "YAPE", "PLIN", "TARJETA", "TRANSFERENCIA"].map((m) => `<option ${C.pay === m ? "selected" : ""}>${m}</option>`).join("")}</select></label>
          ${C.pay !== "EFECTIVO" ? `<label>Nro. de operación<input name="op" required inputmode="numeric" maxlength="20" value="${esc(C.op)}"></label>` : ""}</div>
        ${C.pay === "YAPE" || C.pay === "PLIN" ? `<label class="btn ghost">${C.proof ? "Cambiar foto del pago ✓" : "Subir foto del pago"}<input type="file" name="proof" accept="image/*" hidden></label>` : ""}
        <p class="tiny muted">${isRuc ? "El socio tiene RUC: se emite factura." : "Se emite boleta a nombre del socio."} La venta entra en tu caja abierta de esta tienda.</p>
        <button class="btn" type="submit">Emitir ${isRuc ? "factura" : "boleta"}</button></form>` : ""}
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn ghost small" type="button" data-act="cg-back">← Consignaciones</button>${!closed && items.length && !items.some(pending) ? `<button class="btn small" type="button" data-act="cg-close">Cerrar consignación</button>` : ""}</div></div>`;
  }
  function newHtml() {
    loadPartners(); const ps = C.partners || [];
    return `<form class="consig-card" data-form="cg-new" novalidate><b>Nueva consignación</b>
      ${C.newP ? `<fieldset class="stack" style="border:0;padding:0;margin:0"><div class="two"><label>Nombre del socio<input name="name" required maxlength="120"></label><label>Tipo<select name="kind"><option value="TIENDA">Tienda</option><option value="PERSONA">Persona</option></select></label></div>
        <div class="two"><label>Celular (opcional)<input name="phone" inputmode="tel" maxlength="15"></label><label>DNI / RUC (opcional)<input name="document" inputmode="numeric" maxlength="11" pattern="[0-9]{8}|[0-9]{11}" data-err="DNI de 8 o RUC de 11 dígitos."></label></div></fieldset>`
        : `<label>Socio<select name="partner" required data-err="Elige el socio o crea uno nuevo."><option value="">${C.partners === null ? "Cargando…" : "Elige…"}</option>${ps.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.open_consignments ? ` (${p.open_consignments} abierta${p.open_consignments > 1 ? "s" : ""})` : ""}</option>`).join("")}</select></label>`}
      <button class="link-btn tiny" type="button" data-act="cg-newp" style="justify-self:start">${C.newP ? "Elegir un socio existente" : "+ Nuevo socio"}</button>
      <label>Nota (opcional)<input name="note" maxlength="200" placeholder="Ej. feria del sábado"></label>
      <button class="btn" type="submit">Abrir y escanear prendas</button></form>`;
  }
  function renderConsignar() {
    if (C.view === "list") loadList();
    const tabs = `<div class="consig-tabs" role="tablist">${[["new", "Nueva salida"], ["list", "Consignaciones"]].map(([v, l]) => `<button type="button" role="tab" class="btn small ${C.view === v || (v === "list" && C.view === "cur") ? "" : "ghost"}" data-act="cg-view" data-id="${v}" aria-selected="${C.view === v}">${l}</button>`).join("")}</div>`;
    const body = C.view === "cur" && C.cur ? curHtml() : C.view === "list" ? (C.list === null ? `<p class="muted">Cargando…</p>` : C.list.map(listCard).join("") || `<p class="muted">No hay consignaciones en esta tienda.</p>`) : newHtml();
    return `<div class="stack">${tabs}${C.err ? `<p class="alert-text" role="alert">${esc(C.err)}</p>` : ""}${body}</div>`;
  }
  (window.DL_CAJA_TABS = window.DL_CAJA_TABS || []).push({ id: "consignar", label: "Consignar", show: () => X().on(), render: renderConsignar });

  function renderPrestados() {
    if (!X().on()) return `<div class="panel stack"><h3>Prestados (consignación)</h3><p class="muted">Disponible cuando la base tenga la actualización v17.</p></div>`;
    const k = C.pStore || ""; if (P.key !== k) { P.key = k; P.stock = null; P.stats = null; }
    if (P.stock === null && !P.ls) { P.ls = true; X().call("consignedStock", { p_store_id: Number(k) || null, p_variant_id: null }).then((r) => { P.stock = r || []; }).catch((e) => { P.stock = []; P.err = e.message; }).finally(() => { P.ls = false; reload(); }); }
    if (P.stats === null && !P.lt && D().allow(["SUPERVISOR"])) { P.lt = true; X().call("consignStats", { p_from: null, p_to: null, p_store_id: Number(k) || null }).then((r) => { P.stats = r || []; }).catch(() => { P.stats = []; }).finally(() => { P.lt = false; reload(); }); }
    const stores = ((D().state.data || {}).stores || []).filter((s) => s.is_active !== false);
    const rows = P.stock || []; const total = rows.reduce((n, r) => n + Number(r.qty_lent || 0), 0);
    return `<div class="stack"><div class="row" style="flex-wrap:wrap;gap:8px"><h3 class="grow" style="margin:0">Prestados (en consignación)</h3>
      <select id="cg-pstore" aria-label="Tienda"><option value="">Todas las tiendas</option>${stores.map((s) => `<option value="${esc(s.id)}" ${k === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
      ${P.err ? `<p class="alert-text">${esc(P.err)}</p>` : ""}<p class="tiny muted">${P.stock === null ? "Cargando…" : total + " prenda(s) fuera, con socios."}</p>
      ${rows.length ? `<div class="table-wrap"><table class="tnum"><thead><tr><th>Prenda</th><th>Tienda</th><th>Prestadas</th><th>Con</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.description)}<br><span class="tiny">${esc(r.sku || "")}</span></td><td>${esc(r.store_name)}</td><td class="num">${Number(r.qty_lent || 0)}</td><td class="tiny">${(r.consignments || []).map((c) => esc((c.public_code || "") + (c.partner_name ? " · " + c.partner_name : "") + (c.qty ? " (" + c.qty + ")" : ""))).join("<br>")}</td></tr>`).join("")}</tbody></table></div>` : ""}
      ${P.stats && P.stats.length ? `<div class="panel stack"><h3>Últimos 30 días por socio</h3><div class="table-wrap"><table class="tnum"><thead><tr><th>Socio</th><th>Salió</th><th>Volvió</th><th>Vendido</th><th>Monto</th><th>Pendiente</th></tr></thead><tbody>${P.stats.map((s) => `<tr><td>${esc(s.partner_name)}</td><td class="num">${Number(s.lent || 0)}</td><td class="num">${Number(s.returned || 0)}</td><td class="num">${Number(s.sold || 0)}</td><td class="num">${money(s.amount_sold)}</td><td class="num">${Number(s.pending || 0)}${Number(s.pending_amount || 0) ? " · " + money(s.pending_amount) : ""}</td></tr>`).join("")}</tbody></table></div></div>` : ""}</div>`;
  }
  (window.DL_ADMIN_TABS = window.DL_ADMIN_TABS || []).push({ id: "prestados", label: "Prestados", need: ["SUPERVISOR", "ALMACENERO"], render: renderPrestados });

  function upsertItem(it) { if (!it || !C.cur) return; const items = C.cur.items || (C.cur.items = []); const i = items.findIndex((x) => String(x.variant_id) === String(it.variant_id)); if (i >= 0) items[i] = Object.assign(items[i], it); else items.unshift(it); }
  async function scanCode(code) {
    const price = (document.getElementById("cg-price") || {}).value; const p = price ? Number(String(price).replace(",", ".")) : null;
    const it = await X().call(C.mode === "out" ? "scanOut" : "scanReturn", Object.assign({ p_consignment_id: Number(C.cur.id), p_code: String(code).trim(), p_qty: 1 }, C.mode === "out" ? { p_price: Number.isFinite(p) && p > 0 ? p : null } : {}));
    upsertItem(it); C.list = null; return it;
  }
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "cg-view": (el) => { C.view = el.dataset.id; C.err = ""; if (C.view === "list") C.list = null; reload(); },
    "cg-newp": () => { C.newP = !C.newP; reload(); },
    "cg-open": (el) => openCur(el.dataset.id),
    "cg-back": () => { C.view = "list"; C.cur = null; C.list = null; reload(); },
    "cg-mode": (el) => { C.mode = el.dataset.id; C.sold = {}; reload(); },
    "cg-code": async () => { const i = document.getElementById("cg-code"); if (!i || !i.value.trim()) return; const code = i.value; const it = await safe(() => scanCode(code)); if (it) { if (window.DL_BEEP) window.DL_BEEP(true); V().toast((C.mode === "out" ? "Salió: " : "Volvió: ") + (it.description || code), "ok"); } else if (window.DL_BEEP) window.DL_BEEP(false); reload(); },
    "cg-scan": () => window.DL_openScanner ? window.DL_openScanner((p, r, code) => { scanCode(code).then((it) => V().toast((C.mode === "out" ? "Salió: " : "Volvió: ") + ((it && it.description) || code), "ok")).catch((e) => { if (window.DL_BEEP) window.DL_BEEP(false); V().toast(e.message || "No se pudo registrar", "error"); }); return (C.mode === "out" ? "Registrando salida: " : "Registrando devolución: ") + p.name; }, C.mode === "out" ? "Escanear salida" : "Escanear devolución") : V().toast("El lector no está disponible", "error"),
    "cg-close": async () => { if (!(await window.dlgConfirm("¿Cerrar la consignación " + C.cur.public_code + "? Ya no quedan prendas fuera.", { ok: "Cerrar", title: "Cerrar consignación" }))) return; const r = await safe(() => X().call("closeConsignment", { p_consignment_id: Number(C.cur.id), p_note: null })); if (r) { V().toast("Consignación cerrada ✓", "ok"); C.view = "list"; C.cur = null; C.list = null; reload(); } },
  });
  window.DL_INPUT = ((prev) => (e) => {
    const t = e.target; const d = t && t.dataset;
    if (d && (d.sq || d.sp)) { const id = d.sq || d.sp; const it = (C.cur.items || []).find((x) => String(x.variant_id) === String(id)) || {}; const s = C.sold[id] || (C.sold[id] = { qty: 0, price: Number(it.unit_price || 0) });
      if (d.sq) s.qty = Math.min(pending(it), Math.max(0, Number.parseInt(t.value, 10) || 0)); else s.price = Math.max(0, Number(String(t.value).replace(",", ".")) || 0);
      const tot = document.querySelector('[data-form="cg-sold"] .num'); if (tot) tot.textContent = money(Object.values(C.sold).reduce((n, x) => n + x.qty * x.price, 0)); return true; }
    if (t && t.form && t.form.dataset.form === "cg-sold" && t.name === "op") { C.op = t.value; return true; }
    return prev ? prev(e) : false;
  })(window.DL_INPUT);
  document.addEventListener("change", async (e) => {
    const t = e.target; if (!t) return;
    if (t.id === "cg-pstore") { C.pStore = t.value; reload(); }
    if (t.form && t.form.dataset.form === "cg-sold" && t.name === "pay") { C.pay = t.value; reload(); }
    if (t.form && t.form.dataset.form === "cg-sold" && t.name === "proof" && t.files && t.files[0]) {
      const f = t.files[0]; const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
      C.proof = window.DL_compressProof ? await window.DL_compressProof(url) : url; reload();
    }
  });
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, {
    "cg-new": async (form) => {
      let pid = form.elements.partner ? form.elements.partner.value : "";
      if (C.newP) { const doc = form.elements.document.value.trim(); pid = await X().call("upsertPartner", { p_id: null, p_name: form.elements.name.value.trim(), p_kind: form.elements.kind.value, p_phone: form.elements.phone.value.trim() || null, p_document: doc || null, p_notes: null, p_is_active: true }); pid = pid && typeof pid === "object" ? pid.id : pid; C.partners = null; C.newP = false; }
      const r = await X().call("openConsignment", { p_partner_id: Number(pid), p_store_id: Number(sid()), p_note: form.elements.note.value.trim() || null });
      V().toast("Consignación " + ((r && r.public_code) || "") + " abierta ✓", "ok"); C.list = null; await openCur(r.id);
    },
    "cg-sold": async (form) => {
      const items = Object.entries(C.sold).filter(([, s]) => s.qty > 0).map(([id, s]) => ({ variant_id: Number(id), qty: s.qty, unit_price: Math.round(s.price * 100) / 100 }));
      if (!items.length) throw new Error("Indica cuántas prendas se vendieron.");
      const total = items.reduce((n, x) => n + x.qty * x.unit_price, 0);
      const pay = { method: C.pay, amount: Math.round(total * 100) / 100 };
      if (C.pay !== "EFECTIVO") pay.operation_code = String(form.elements.op.value).trim();
      if (C.pay === "YAPE" || C.pay === "PLIN") { if (!C.proof) { window.DL_FIELD_ERR(form, "proof", "Sube la foto del pago."); return; } pay.proof_url = await D().Store.v2api.uploadProof(C.proof); }
      const doc = String((C.cur.partner || {}).document_number || C.cur.partner_document || "");
      const r = await X().call("markSold", { p_consignment_id: Number(C.cur.id), p_items: items, p_payments: [pay], p_document_type: /^\d{11}$/.test(doc) ? "FACTURA" : "BOLETA" });
      V().toast(`${/^\d{11}$/.test(doc) ? "Factura" : "Boleta"} ${r ? (r.series || "") + "-" + (r.number || "") : ""} · ${money(r ? r.total : total)} ✓`, "ok");
      C.sold = {}; C.proof = ""; C.op = ""; C.mode = "out"; await openCur(C.cur.id); D().reload();
    },
  });
})();
