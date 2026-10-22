(function () {
  const D = () => window.DL;
  const data = () => D().state.data;
  const esc = (v) => D().esc(v);
  const soles = (c) => D().soles(c);
  const money = (v) => Math.round((Number(String(v || "").replace(",", ".")) || 0) * 100);
  const hhmm = (iso) => iso ? new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "—";
  const fecha = (iso) => iso ? new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" }) : "—";
  const OPEN_H = 9, OPEN_M = 10, CLOSE_H = 20;
  const REMOTE = () => D().Store.mode === "remote";
  const PAYMAP = { efectivo: "CASH", yape: "YAPE", plin: "PLIN", tarjeta: "CARD", transferencia: "TRANSFER", transf: "TRANSFER" };
  const op = { attFrom: null, attTo: null, layQ: "", conForm: false, poForm: false, frForm: false, recv: "" };

  // Asistencia
  function renderAsistencia() {
    const today = new Date();
    op.attTo = op.attTo || D().localDay(today);
    op.attFrom = op.attFrom || D().localDay(new Date(today.getTime() - 6 * 864e5));
    const rows = (data().attendance || []).filter((a) => { const d = D().localDay(a.check_in); return d >= op.attFrom && d <= op.attTo; });
    const people = (data().staff || []).filter((p) => rows.some((r) => r.staff_id === p.id) || p.is_active !== false);
    const late = (a) => { const d = new Date(a.check_in); return d.getHours() * 60 + d.getMinutes() > OPEN_H * 60 + OPEN_M; };
    const early = (a) => a.check_out && new Date(a.check_out).getHours() < CLOSE_H && new Date(a.check_out).getHours() * 60 + new Date(a.check_out).getMinutes() < CLOSE_H * 60 - 10;
    const hours = (a) => a.check_out ? (new Date(a.check_out) - new Date(a.check_in)) / 36e5 : 0;
    const sum = people.map((p) => { const r = rows.filter((a) => a.staff_id === p.id); return { p, days: new Set(r.map((a) => D().localDay(a.check_in))).size, h: r.reduce((n, a) => n + hours(a), 0), late: r.filter(late).length, early: r.filter(early).length, open: r.filter((a) => !a.check_out).length }; });
    return `${window.DL_attendanceBar ? window.DL_attendanceBar() : ""}
      <form novalidate class="panel filters" data-form="noop"><label>Desde<input type="date" id="att-from" value="${op.attFrom}"></label><label>Hasta<input type="date" id="att-to" value="${op.attTo}"></label></form>
      <p class="tiny">Horario ${OPEN_H}:00–${CLOSE_H}:00 · tardanza después de ${OPEN_H}:${String(OPEN_M).padStart(2, "0")}.</p>
      <div class="table-wrap"><table class="tnum"><thead><tr><th>Persona</th><th>Días</th><th>Horas</th><th>Tard.</th><th>Sal. temp.</th></tr></thead><tbody>
      ${sum.map((r) => `<tr><td>${esc(r.p.full_name)}${r.open ? ' <span class="badge ok">en turno</span>' : ""}</td><td class="num">${r.days}</td><td class="num">${r.h.toFixed(1)}</td><td class="num ${r.late ? "bad" : ""}">${r.late}</td><td class="num">${r.early}</td></tr>`).join("")}</tbody></table></div>
      <h3 style="margin:16px 0 8px">Marcas</h3>
      <div class="table-wrap"><table class="tnum"><thead><tr><th>Fecha</th><th>Persona</th><th>Entrada</th><th>Salida</th><th>Horas</th></tr></thead><tbody>
      ${rows.slice().sort((a, b) => String(b.check_in).localeCompare(String(a.check_in))).map((a) => `<tr><td>${fecha(a.check_in)}</td><td>${esc(D().nameOf("staff", a.staff_id) === "—" ? (D().byId("staff", a.staff_id) || {}).full_name || "—" : D().byId("staff", a.staff_id).full_name)}<br><span class="tiny">${esc(D().nameOf("stores", a.store_id))}</span></td><td class="num ${late(a) ? "bad" : ""}">${hhmm(a.check_in)}</td><td class="num">${hhmm(a.check_out)}</td><td class="num">${hours(a).toFixed(1)}</td></tr>`).join("") || `<tr><td colspan="5">Sin marcas.</td></tr>`}</tbody></table></div>`;
  }

  function renderCajas() {
    const list = (data().cash_sessions || []).slice().sort((a, b) => String(b.opened_at).localeCompare(String(a.opened_at))).slice(0, 60);
    const PAY = D().PAY;
    return `<p class="tiny">Cada caja es de una persona en una tienda. Abierta = aún vendiendo.</p>
      <div class="stack">${list.map((s) => { const ss = (data().sales || []).filter((x) => x.session_id === s.id && x.status === "COMPLETED"); const exp = s.expected_json || (s.status === "OPEN" && window.DL_expectedCash ? window.DL_expectedCash(s) : null); const cnt = s.counted_json || {}; return `<div class="panel">
        <div class="row" style="justify-content:space-between;gap:6px;flex-wrap:wrap"><b>${esc(D().nameOf("stores", s.store_id))} · ${esc((D().byId("staff", s.user_id) || {}).full_name || "—")}</b><span class="badge ${s.status === "OPEN" ? "ok" : ""}">${s.status === "OPEN" ? "abierto" : "cerrado"}</span></div>
        <span class="tiny">${fecha(s.opened_at)} ${hhmm(s.opened_at)} → ${s.closed_at ? hhmm(s.closed_at) : "…"} · fondo ${soles(s.opening_cents)} · ${ss.length} boletas · ${soles(D().sumCents(ss, "total_cents"))}</span>
        ${exp ? `<div class="table-wrap"><table class="tnum"><thead><tr><th></th>${Object.keys(PAY).map((k) => `<th>${esc(PAY[k])}</th>`).join("")}</tr></thead><tbody>
          <tr><td>Esperado</td>${Object.keys(PAY).map((k) => `<td class="num">${soles(exp[k] || 0)}</td>`).join("")}</tr>
          ${s.counted_json ? `<tr><td>Contado</td>${Object.keys(PAY).map((k) => `<td class="num">${soles(cnt[k] || 0)}</td>`).join("")}</tr>` : ""}</tbody></table></div>` : ""}
        ${s.status === "CLOSED" ? `<span class="tiny">Diferencia <b class="${Number(s.difference_cents) ? "bad" : ""}">${soles(s.difference_cents || 0)}</b> · entregado ${soles(s.delivered_cents || 0)} · fondo dejado ${soles(s.float_left_cents || 0)}${s.note ? " · " + esc(s.note) : ""}</span>` : ""}</div>`; }).join("") || `<p class="muted">Sin cajas.</p>`}</div>`;
  }

  function renderAdelantos() {
    return `<div class="panel stack"><input id="op-layq" placeholder="DNI, nombre, N° adelanto, boleta o fecha" value="${esc(op.layQ)}"><div id="op-laylist">${window.DL_layawaysList(op.layQ, true)}</div></div>`;
  }

  // Consignación
  function conBalance(c) { if (c.balance_cents !== undefined) return Number(c.balance_cents); return (Number(c.sold_qty) || 0) * (Number(c.unit_cost_cents) || 0) - (Number(c.paid_cents) || 0); }
  function renderConsignacion() {
    const list = (data().consignments || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const prods = (data().products || []).filter((p) => !p.deleted_at);
    const owe = list.filter((c) => c.direction === "RECIBIDO" && c.status !== "CERRADA").reduce((n, c) => n + conBalance(c), 0);
    const owed = list.filter((c) => c.direction === "PRESTADO" && c.status !== "CERRADA").reduce((n, c) => n + conBalance(c), 0);
    return `<div class="stats"><article class="stat"><span class="tiny">Debemos a marcas</span><b>${D().moneyHtml(owe)}</b></article><article class="stat"><span class="tiny">Nos deben tiendas</span><b>${D().moneyHtml(owed)}</b></article></div>
      ${op.conForm ? `<form novalidate class="panel stack" data-form="op-con"><h3>Nueva consignación</h3>
        <label>Tipo<select name="direction"><option value="RECIBIDO">Recibida (nos prestan una marca)</option><option value="PRESTADO">Prestada (prestamos a otra tienda)</option></select></label>
        <label>Marca / tienda<input name="counterpart" required placeholder="Nombre del socio"></label>
        <label>Producto<select name="product_id" required>${prods.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · T.${esc(p.size_label || "—")} ${esc(p.color || "")}</option>`).join("")}</select></label>
        <div class="two"><label>Cantidad<input name="qty" type="number" min="1" value="1" required></label><label>Precio acordado c/u (S/)<input name="unit" inputmode="decimal" required></label></div>
        <label>Almacén<select name="warehouse_id">${(data().warehouses || []).map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")}</select></label>
        <label class="checks"><input type="checkbox" name="move" checked> Mover stock (recibida suma, prestada resta)</label>
        <label>Nota<input name="note"></label>
        <div class="row"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-act="op-con-form">Cancelar</button></div></form>`
      : `<button class="btn" type="button" data-act="op-con-form">+ Nueva consignación</button>`}
      <div class="stack" style="margin-top:12px">${list.map((c) => { const p = D().byId("products", c.product_id) || {}; const pending = c.qty - c.sold_qty - c.returned_qty; return `<div class="panel">
        <div class="row" style="justify-content:space-between;gap:6px"><b>${esc(c.number)} · ${esc(c.counterpart)}</b><span class="badge ${c.status === "CERRADA" ? "" : "ok"}">${c.direction === "RECIBIDO" ? "recibida" : "prestada"} · ${esc(String(c.status).toLowerCase())}</span></div>
        <span class="tiny">${esc(p.name || "")} T.${esc(p.size_label || "")} · ${fecha(c.created_at)} · ${soles(c.unit_cost_cents)} c/u${c.note ? " · " + esc(c.note) : ""}</span>
        <div class="row tnum" style="gap:12px;flex-wrap:wrap;margin:6px 0"><span>Total ${c.qty}</span><span>Vendidas ${c.sold_qty}</span><span>Devueltas ${c.returned_qty}</span><span><b>Pendientes ${pending}</b></span><span>Pagado ${soles(c.paid_cents)}</span><span><b>Saldo ${soles(conBalance(c))}</b></span></div>
        ${c.status !== "CERRADA" ? `<div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn small" type="button" data-act="op-con-sold" data-id="${esc(c.id)}">+ Vendidas</button><button class="btn small ghost" type="button" data-act="op-con-ret" data-id="${esc(c.id)}">+ Devueltas</button><button class="btn small ghost" type="button" data-act="op-con-pay" data-id="${esc(c.id)}">Registrar pago</button><button class="btn small ghost" type="button" data-act="op-con-close" data-id="${esc(c.id)}">Cerrar</button></div>` : ""}</div>`; }).join("") || `<p class="muted">Sin consignaciones.</p>`}</div>`;
  }
  async function conSave(form) {
    const el = form.elements;
    const row = { id: D().nid("con"), number: D().nextNumber("consignments", "number", "CS-", 1000), direction: el.direction.value, counterpart: el.counterpart.value.trim(), product_id: el.product_id.value, qty: Number.parseInt(el.qty.value, 10) || 0, sold_qty: 0, returned_qty: 0, unit_cost_cents: money(el.unit.value), paid_cents: 0, status: "ABIERTA", warehouse_id: el.warehouse_id.value, note: el.note.value.trim(), created_at: new Date().toISOString() };
    if (!row.counterpart || row.qty < 1) throw new Error("Completa marca/tienda y cantidad");
    if (REMOTE()) {
      const id = await D().Store.v2api.createConsignment(row);
      op.conForm = false; await D().reload(); D().render(); D().toast("Consignación CS-" + id); return;
    }
    await D().Store.transaction(async () => {
      if (el.move.checked) await D().applyDelta(row.product_id, row.warehouse_id, row.direction === "RECIBIDO" ? row.qty : -row.qty, "CONSIGNACION", row.number);
      await D().Store.insert("consignments", row);
    });
    op.conForm = false; await D().reload(); D().render(); D().toast("Consignación " + row.number);
  }
  async function conBump(id, kind) {
    const c = D().byId("consignments", id);
    const pending = c.qty - c.sold_qty - c.returned_qty;
    if (REMOTE()) {
      const api = D().Store.v2api;
      if (kind === "pay") {
        const bal = Number(c.balance_cents || 0);
        const v = await DL_UI.prompt("Monto pagado (S/)", (bal / 100).toFixed(2)); if (v === null) return;
        const m = PAYMAP[String(await DL_UI.prompt("Medio: efectivo, yape, plin, tarjeta, transferencia", "efectivo") || "").trim().toLowerCase()];
        if (!m) throw new Error("Medio no válido");
        const code = m === "CASH" ? null : (await DL_UI.prompt("Nro. de operación") || "").trim();
        if (m !== "CASH" && !code) throw new Error("Indica el número de operación");
        await api.payConsignment(id, money(v), m, code, null);
      } else if (kind === "close") { if (!await DL_UI.confirm("¿Liquidar y cerrar la consignación?")) return; await api.settleConsignment(id, [], true); }
      else {
        const n = Number.parseInt(await DL_UI.prompt(kind === "sold" ? "¿Cuántas se vendieron?" : "¿Cuántas se devolvieron?", "1"), 10);
        if (!n || n < 1) return; if (n > pending) throw new Error("Solo quedan " + pending + " pendientes");
        await api.settleConsignment(id, [{ product_id: c.product_id, sold: kind === "sold" ? n : 0, returned: kind === "ret" ? n : 0 }], false);
      }
      await D().reload(); D().render(); return;
    }
    if (kind === "pay") { const v = await DL_UI.prompt("Monto pagado (S/)", (conBalance(c) / 100).toFixed(2)); if (v === null) return; await D().Store.update("consignments", id, { paid_cents: Number(c.paid_cents || 0) + money(v) }); }
    else if (kind === "close") { if (!await DL_UI.confirm("¿Cerrar la consignación?")) return; await D().Store.update("consignments", id, { status: "CERRADA" }); }
    else {
      const n = Number.parseInt(await DL_UI.prompt(kind === "sold" ? "¿Cuántas se vendieron?" : "¿Cuántas se devolvieron?", "1"), 10);
      if (!n || n < 1) return; if (n > pending) throw new Error("Solo quedan " + pending + " pendientes");
      await D().Store.transaction(async () => {
        if (kind === "ret" && c.warehouse_id) await D().applyDelta(c.product_id, c.warehouse_id, c.direction === "RECIBIDO" ? -n : n, "CONSIG_DEVOLUCION", c.number);
        await D().Store.update("consignments", id, kind === "sold" ? { sold_qty: c.sold_qty + n } : { returned_qty: c.returned_qty + n });
      });
    }
    await D().reload(); D().render();
  }

  // Producción
  function sizesOf(o) { return Object.entries(o.sizes || {}).filter(([, q]) => Number(q) > 0); }
  function receivedOf(o) {
    const tot = {};
    (data().production_receipts || []).filter((r) => r.order_id === o.id).forEach((r) => Object.entries(r.counts || {}).forEach(([s, q]) => { tot[s] = (tot[s] || 0) + Number(q); }));
    return tot;
  }
  function sizeGrid(prefix, values) {
    const list = window.DL_DEFAULT_SIZES().map((s) => s.label);
    (data().sizes || []).forEach((s) => { if (!list.includes(s.label)) list.push(s.label); });
    return `<div class="size-grid">${list.map((s) => `<label><span>${esc(s)}</span><input type="number" min="0" inputmode="numeric" name="${prefix}${esc(s)}" value="${values && values[s] ? values[s] : ""}"></label>`).join("")}</div>`;
  }
  function renderProduccion() {
    const orders = (data().production_orders || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const fabrics = data().fabrics || []; const tailors = data().tailors || [];
    const ST = { EN_TALLER: "en taller", PARCIAL: "parcial", RECIBIDA: "recibida", CANCELADA: "cancelada" };
    const form = op.poForm ? `<form novalidate class="panel stack" data-form="op-po"><h3>Nueva orden de producción</h3>
      <label>Producto (nombre)<input name="product_name" required list="po-names" placeholder="Nombre de la prenda"></label>
      <datalist id="po-names">${[...new Set((data().products || []).map((p) => p.name))].map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="two">${D().refField("category_id", "Categoría", "categories", null, "", true)}${D().refField("brand_id", "Marca", "brands")}</div>
      <div class="two"><label>Tela<select name="fabric_id"><option value="">—</option>${fabrics.map((f) => `<option value="${esc(f.id)}">${esc(f.name)} · ${esc(f.color || "")}</option>`).join("")}</select></label><label>Color<input name="color" required></label></div>
      <div class="two"><label>Piezas<select name="pieces"><option>SACO+PANTALON</option><option>SACO+PANTALON+CHALECO</option><option>SACO</option><option>PANTALON</option><option>CHALECO</option></select></label><label>Sastre<select name="tailor_id"><option value="">—</option>${tailors.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select></label></div>
      <label>Precio de venta previsto (S/)<input name="price" inputmode="decimal"></label>
      <p class="tiny">Cantidad por talla</p>${sizeGrid("s_")}
      <div class="row"><button class="btn" type="submit">Crear orden</button><button class="btn ghost" type="button" data-act="op-po-form">Cancelar</button></div></form>`
      : `<button class="btn" type="button" data-act="op-po-form">+ Nueva orden</button>`;
    const recvOrder = op.recv && D().byId("production_orders", op.recv);
    const recvForm = recvOrder ? (() => { const got = receivedOf(recvOrder); const pend = {}; sizesOf(recvOrder).forEach(([s, q]) => { pend[s] = Math.max(0, q - (got[s] || 0)); }); return `<form novalidate class="panel stack" data-form="op-recv" data-id="${esc(recvOrder.id)}" id="recv-form"><h3>Recepción de mercadería · ${esc(recvOrder.number)}</h3>
      <p class="tiny">${esc(recvOrder.product_name)} · ${esc(recvOrder.color)} · ${esc((D().byId("fabrics", recvOrder.fabric_id) || {}).name || "")}. Cuenta lo que llegó por talla (prellenado con lo pendiente).</p>
      <div class="two"><label>Color recibido<input name="color" value="${esc(recvOrder.color)}"></label><label>Tela<select name="fabric_id">${fabrics.map((f) => `<option value="${esc(f.id)}" ${f.id === recvOrder.fabric_id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></label></div>
      ${sizeGrid("r_", pend)}
      <label>Ingresar al almacén<select name="warehouse_id">${(data().warehouses || []).map((w) => `<option value="${esc(w.id)}" ${/taller|almac/i.test(w.name) ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select></label>
      <div id="recv-cmp" class="note"></div>
      <div class="row"><button class="btn" type="submit">Confirmar e ingresar stock</button><button class="btn ghost" type="button" data-act="op-recv" data-id="">Cancelar</button></div></form>`; })() : "";
    return `${form}${recvForm}<div class="stack" style="margin-top:12px">${orders.map((o) => { const got = receivedOf(o); const want = sizesOf(o); const tw = want.reduce((n, [, q]) => n + Number(q), 0); const tg = Object.values(got).reduce((n, q) => n + q, 0); return `<div class="panel">
      <div class="row" style="justify-content:space-between;gap:6px"><b>${esc(o.number)} · ${esc(o.product_name)}</b><span class="badge ${o.status === "RECIBIDA" ? "ok" : ""}">${esc(ST[o.status] || o.status)}</span></div>
      <span class="tiny">${esc(o.color)} · ${esc((D().byId("fabrics", o.fabric_id) || {}).name || "—")} · ${esc(o.pieces || "")} · sastre ${esc(D().nameOf("tailors", o.tailor_id))} · ${fecha(o.created_at)}</span>
      <div class="table-wrap"><table class="tnum"><thead><tr><th>Talla</th>${want.map(([s]) => `<th>${esc(s)}</th>`).join("")}<th>Total</th></tr></thead><tbody>
        <tr><td>Pedido</td>${want.map(([, q]) => `<td class="num">${q}</td>`).join("")}<td class="num">${tw}</td></tr>
        <tr><td>Recibido</td>${want.map(([s]) => `<td class="num">${got[s] || 0}</td>`).join("")}<td class="num">${tg}</td></tr>
        <tr><td>Dif.</td>${want.map(([s, q]) => { const d = (got[s] || 0) - q; return `<td class="num ${d ? "bad" : ""}">${d > 0 ? "+" : ""}${d}</td>`; }).join("")}<td class="num">${tg - tw}</td></tr></tbody></table></div>
      ${o.status !== "RECIBIDA" && o.status !== "CANCELADA" ? `<div class="row" style="gap:6px"><button class="btn small" type="button" data-act="op-recv" data-id="${esc(o.id)}">Recibir mercadería</button><button class="btn small ghost" type="button" data-act="op-po-done" data-id="${esc(o.id)}">Dar por terminada</button></div>` : ""}</div>`; }).join("") || `<p class="muted">Sin órdenes.</p>`}</div>`;
  }
  function recvCompare() {
    const f = document.getElementById("recv-form"); const box = document.getElementById("recv-cmp"); if (!f || !box) return;
    const o = D().byId("production_orders", f.dataset.id); const got = receivedOf(o);
    const out = []; let falt = 0, sobr = 0;
    const all = new Set(sizesOf(o).map(([s]) => s));
    [...f.elements].filter((e) => e.name && e.name.startsWith("r_") && Number(e.value) > 0).forEach((e) => all.add(e.name.slice(2)));
    all.forEach((s) => { const el = f.elements["r_" + s]; const now = el ? Number(el.value) || 0 : 0; const want = Number((o.sizes || {})[s] || 0); const d = (got[s] || 0) + now - want; if (d < 0) falt += -d; if (d > 0) sobr += d; out.push(`${s}: ${d === 0 ? "ok" : d > 0 ? "+" + d : d}`); });
    box.innerHTML = `Comparación vs orden (acumulado): ${out.join(" · ")}<br><b>Faltantes ${falt}</b> · <b>Sobrantes ${sobr}</b>`;
  }
  async function poSave(form) {
    const el = form.elements; const sizes = {};
    [...el].forEach((e) => { if (e.name && e.name.startsWith("s_") && Number(e.value) > 0) sizes[e.name.slice(2)] = Number(e.value); });
    if (!Object.keys(sizes).length) throw new Error("Pon cantidades por talla");
    await D().Store.insert("production_orders", { id: D().nid("po"), number: D().nextNumber("production_orders", "number", "OP-", 1000), product_name: el.product_name.value.trim(), category_id: el.category_id.value, brand_id: el.brand_id.value || null, fabric_id: el.fabric_id.value || null, color: el.color.value.trim(), pieces: el.pieces.value, sizes, tailor_id: el.tailor_id.value || null, unit_price_cents: money(el.price.value), status: "EN_TALLER", note: "", created_by: D().state.user.full_name, created_at: new Date().toISOString() });
    op.poForm = false; await D().reload(); D().render(); D().toast("Orden creada");
  }
  async function recvSave(form) {
    const o = D().byId("production_orders", form.dataset.id); const el = form.elements;
    const counts = {};
    [...el].forEach((e) => { if (e.name && e.name.startsWith("r_") && Number(e.value) > 0) counts[e.name.slice(2)] = Number(e.value); });
    if (!Object.keys(counts).length) throw new Error("No contaste nada");
    const color = el.color.value.trim() || o.color; const fabric = el.fabric_id.value || o.fabric_id; const whId = el.warehouse_id.value;
    if (REMOTE()) {
      const first = !(data().products || []).some((p) => p.product_id === o.product_id && !p.deleted_at);
      let price = null;
      if (first) { const v = await DL_UI.prompt("Primer ingreso de " + o.product_name + ": precio de venta (S/)"); if (v === null) return; price = money(v); if (!price) throw new Error("Indica el precio de venta"); }
      await D().Store.v2api.receiveProduction(o.id, counts, color !== o.color ? color : null, fabric !== o.fabric_id ? fabric : null, null, price);
      op.recv = ""; await D().reload(); D().render(); D().toast("Mercadería ingresada al stock"); return;
    }
    const S = D().Store; const prods = data().products || [];
    const base = prods.find((p) => p.name === o.product_name && !p.deleted_at);
    await S.transaction(async () => {
      for (const [size, qty] of Object.entries(counts)) {
        let p = prods.find((x) => !x.deleted_at && x.name === o.product_name && String(x.size_label) === size && (x.color || "") === color);
        if (!p) {
          const sku = (base ? String(base.sku).replace(/-[^-]+$/, "") : "OP-" + o.number.replace(/\D/g, "")) + "-" + size + (base && (base.color || "") !== color ? "-" + color.slice(0, 3).toUpperCase() : "");
          p = { id: D().nid("pro"), sku, name: o.product_name, description: base ? base.description : "", category_id: o.category_id || (base && base.category_id), brand_id: o.brand_id || (base && base.brand_id) || null, sale_price_cents: o.unit_price_cents || (base ? base.sale_price_cents : 0), cost_price_cents: base ? base.cost_price_cents : 0, wholesale_price_cents: base ? base.wholesale_price_cents : 0, min_price_cents: base ? base.min_price_cents || 0 : 0, image_url: base ? base.image_url : "assets/collection/navy.jpg", min_stock: 1, size_label: size, color, fabric_id: fabric, is_active: true, deleted_at: null, is_offer: false, offer_price_cents: 0, season: null };
          await S.insert("products", p);
          if (S.mode === "remote") prods.push(p);
        }
        await D().applyDelta(p.id, whId, qty, "PRODUCCION", o.number);
      }
      await S.insert("production_receipts", { id: D().nid("prc"), order_id: o.id, counts, color, fabric_id: fabric, warehouse_id: whId, received_by: D().state.user.full_name, received_at: new Date().toISOString() });
    });
    await D().reload();
    const got = receivedOf(o); const done = sizesOf(o).every(([s, q]) => (got[s] || 0) >= q);
    await S.update("production_orders", o.id, { status: done ? "RECIBIDA" : "PARCIAL" });
    op.recv = ""; await D().reload(); D().render(); D().toast("Mercadería ingresada al stock");
  }
  function renderTela() {
    const list = (data().fabric_receipts || []).slice().sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)));
    const fabrics = data().fabrics || [];
    return `${op.frForm ? `<form novalidate class="panel stack" data-form="op-fr"><h3>Recepción de tela</h3>
      <div class="two"><label>N° de guía<input name="guia" required placeholder="Nº de guía"></label><label>Fábrica / proveedor<input name="supplier" required list="fr-sup"></label></div>
      <datalist id="fr-sup">${(data().fabric_suppliers || []).map((s) => `<option value="${esc(s.name)}">`).join("")}</datalist>
      <div class="two"><label>Tela<select name="fabric_id" required>${fabrics.map((f) => `<option value="${esc(f.id)}">${esc(f.name)} · ${esc(f.color || "")}</option>`).join("")}</select></label><label>Color<input name="color"></label></div>
      <div class="two"><label>Metros según guía<input name="declared" inputmode="decimal" required></label><label>Metros medidos<input name="measured" inputmode="decimal" required></label></div>
      <label class="checks"><input type="checkbox" name="verified" checked> Verificada (calidad / color)</label>
      <label class="checks"><input type="checkbox" name="lot" checked> Crear lote para enviar a sastres</label>
      <label>Nota<input name="note"></label>
      <div class="row"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-act="op-fr-form">Cancelar</button></div></form>` : `<button class="btn" type="button" data-act="op-fr-form">+ Recibir tela</button>`}
      <div class="table-wrap" style="margin-top:12px"><table class="tnum"><thead><tr><th>Guía</th><th>Tela</th><th>Guía m</th><th>Medido</th><th>Dif.</th></tr></thead><tbody>
      ${list.map((r) => { const d = (r.meters_measured_cm - r.meters_declared_cm) / 100; return `<tr><td><b>${esc(r.guia)}</b><br><span class="tiny">${esc(r.supplier)} · ${fecha(r.received_at)}${r.verified ? " · ✓" : ""}</span></td><td>${esc((D().byId("fabrics", r.fabric_id) || {}).name || "")}<br><span class="tiny">${esc(r.color || "")}</span></td><td class="num">${(r.meters_declared_cm / 100).toFixed(1)}</td><td class="num">${(r.meters_measured_cm / 100).toFixed(1)}</td><td class="num ${d ? "bad" : ""}">${d.toFixed(1)}</td></tr>`; }).join("") || `<tr><td colspan="5">Sin recepciones.</td></tr>`}</tbody></table></div>`;
  }
  async function frSave(form) {
    const el = form.elements; const cm = (v) => Math.round((Number(String(v).replace(",", ".")) || 0) * 100);
    const row = { id: D().nid("fr"), guia: el.guia.value.trim(), supplier: el.supplier.value.trim(), fabric_id: el.fabric_id.value, color: el.color.value.trim(), meters_declared_cm: cm(el.declared.value), meters_measured_cm: cm(el.measured.value), verified: el.verified.checked, note: el.note.value.trim(), received_by: D().state.user.full_name, received_at: new Date().toISOString() };
    await D().Store.insert("fabric_receipts", row);
    op.frForm = false; await D().reload(); D().render(); D().toast("Tela recibida");
  }

  // registro
  window.DL_ADMIN_TABS = (window.DL_ADMIN_TABS || []).concat([
    { id: "asistencia", label: "Asistencia", need: ["SUPERVISOR"], render: renderAsistencia },
    { id: "cajas", label: "Cajas", need: ["SUPERVISOR"], render: renderCajas },
    { id: "traslados", label: "Traslados", need: ["SUPERVISOR", "ALMACENERO"], render: () => `<div class="panel stack"><h3>Todos los traslados</h3>${window.DL_transfersTable("all")}</div>` },
    { id: "adelantos", label: "Adelantos", need: ["SUPERVISOR"], render: renderAdelantos },
    { id: "consignacion", label: "Consignación", need: ["SUPERVISOR"], render: renderConsignacion },
    { id: "produccion", label: "Producción", need: ["SUPERVISOR", "ALMACENERO"], render: renderProduccion },
  ]);
  window.DL_TALLER_TABS = (window.DL_TALLER_TABS || []).concat([
    { id: "recepcion", label: "Recibir tela", render: renderTela },
    { id: "produccion", label: "Producción", render: renderProduccion },
  ]);
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "op-con-form": () => { op.conForm = !op.conForm; D().render(); },
    "op-con-sold": (el) => conBump(el.dataset.id, "sold"),
    "op-con-ret": (el) => conBump(el.dataset.id, "ret"),
    "op-con-pay": (el) => conBump(el.dataset.id, "pay"),
    "op-con-close": (el) => conBump(el.dataset.id, "close"),
    "op-po-form": () => { op.poForm = !op.poForm; D().render(); },
    "op-fr-form": () => { op.frForm = !op.frForm; D().render(); },
    "op-recv": (el) => { op.recv = el.dataset.id; D().render(); const f = document.getElementById("recv-form"); if (f) f.scrollIntoView({ block: "start" }); },
    "op-po-done": async (el) => { if (!await DL_UI.confirm("¿Dar la orden por terminada aunque falten piezas?")) return; await D().Store.update("production_orders", el.dataset.id, { status: "RECIBIDA" }); await D().reload(); D().render(); },
  });
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, { "op-con": conSave, "op-po": poSave, "op-recv": recvSave, "op-fr": frSave });
  const prevInput = window.DL_INPUT;
  window.DL_INPUT = function (e) {
    if (prevInput && prevInput(e)) return true;
    if (e.target.id === "op-layq") { op.layQ = e.target.value; document.getElementById("op-laylist").innerHTML = window.DL_layawaysList(op.layQ, true); return true; }
    if (e.target.closest && e.target.closest("#recv-form")) { recvCompare(); return true; }
    return false;
  };
  const prevChange = window.DL_CHANGE;
  window.DL_CHANGE = function (e) {
    if (prevChange && prevChange(e)) return true;
    if (e.target.id === "att-from") { op.attFrom = e.target.value; D().render(); return true; }
    if (e.target.id === "att-to") { op.attTo = e.target.value; D().render(); return true; }
    return false;
  };
  (window.DL_AFTER = window.DL_AFTER || []).push(recvCompare, () => {
    const view = document.getElementById("view");
    if (location.hash.startsWith("#taller") && D().state.user && window.DL_attendanceBar && !view.querySelector(".att-bar")) view.insertAdjacentHTML("afterbegin", window.DL_attendanceBar());
  });
})();
