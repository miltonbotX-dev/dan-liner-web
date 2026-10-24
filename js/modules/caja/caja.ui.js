(function () {
  const D = () => window.DL;
  const PAYS = [["CASH", "Efectivo"], ["YAPE", "Yape"], ["PLIN", "Plin"], ["CARD", "Tarjeta"], ["TRANSFER", "Transf."]];
  const cj = { tab: "vender", q: "", cat: "", cart: [], pay: "CASH", mix: {}, proof: null, doc: "BOLETA", cust: { name: "", doc: "", phone: "", address: "" }, sq: "", aq: "", last: null, init: false, ov: null, regDay: "", authBy: null };
  const IC = (n, z) => window.DL.icon(n, z);
  const DOC_OPTS = [["BOLETA", "Boleta"], ["FACTURA", "Factura"], ["TICKET", "Nota de venta"], ["GUIA", "Guía de remisión (próximamente)"]];
  const DOCS = { BOLETA: { label: "Boleta", series: "B001-", title: "BOLETA DE VENTA" }, FACTURA: { label: "Factura", series: "F001-", title: "FACTURA" }, TICKET: { label: "Nota de venta", series: "NV01-", title: "NOTA DE VENTA" } };
  const PAY_ICON = { CASH: "fa-money-bill-wave", YAPE: "fa-mobile-screen", PLIN: "fa-mobile-screen-button", CARD: "fa-credit-card", TRANSFER: "fa-building-columns", MIXTO: "fa-shuffle" };
  const BIZ = () => Object.assign({ name: "DAN-LINER", ruc: "", address: "", phone: "", footer: "Gracias por su compra · No se aceptan cambios ni devoluciones · Defectos de fábrica según ley" }, (window.DL_CONFIG || {}).BUSINESS || {});
  const REMOTE = () => D().Store.mode === "remote";
  async function withOpCodes(payments) {
    if (!REMOTE()) return payments;
    const out = [];
    for (const p of payments) {
      if (p.method === "CASH" || p.operation_code) { out.push(p); continue; }
      const code = (await DL_UI.prompt("Nro. de operación de " + (D().PAY[p.method] || p.method) + " (" + soles(p.cents) + ")", "", { inputmode: "numeric", ok: "Continuar" }) || "").trim();
      if (!code) throw new Error("Falta el nro. de operación de " + (D().PAY[p.method] || p.method));
      out.push(Object.assign({}, p, { operation_code: code }));
    }
    return out;
  }
  window.DL_CJ = cj;

  // utilidades
  const data = () => D().state.data;
  const me = () => D().state.user;
  const esc = (v) => D().esc(v);
  const soles = (c) => D().soles(c);
  const money = (v) => Math.round((Number(String(v || "").replace(",", ".")) || 0) * 100);
  const hhmm = (iso) => iso ? new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "—";
  const fecha = (iso) => iso ? new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  function store() { return D().byId("stores", D().ui.storeId); }
  function wh() { return D().ui.warehouseId; }
  function whName(id) { const w = D().byId("warehouses", id); if (!w) return "—"; return w.name; }
  function mySession() { return D().openSession(); }
  function lastClosed(storeId) {
    return (data().cash_sessions || []).filter((s) => s.status === "CLOSED" && s.store_id === storeId).sort((a, b) => String(b.closed_at).localeCompare(String(a.closed_at)))[0];
  }
  function sessionSales(sessionId) { return (data().sales || []).filter((s) => s.session_id === sessionId); }
  function variantLabel(p) { return [p.size_label ? "T. " + p.size_label : "", p.color || ""].filter(Boolean).join(" · "); }
  function products() { return (data().products || []).filter((p) => !p.deleted_at); }
  function match(p, q) {
    if (!q) return true;
    const brand = D().nameOf("brands", p.brand_id);
    const hay = `${p.name} ${p.sku} ${p.size_label} ${p.color || ""} ${brand} ${p.season || ""} ${p.is_offer ? "remate oferta" : ""}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  }

  // asistencia
  function openAttendance(staffId) {
    return (data().attendance || []).find((a) => a.staff_id === staffId && !a.check_out && D().localDay(a.check_in) === D().localDay(new Date()));
  }
  window.DL_attendanceBar = function () {
    const u = me(); if (!u) return "";
    const open = openAttendance(u.id);
    const today = (data().attendance || []).filter((a) => a.staff_id === u.id && D().localDay(a.check_in) === D().localDay(new Date()));
    return `<div class="att-bar"><span><b>${esc(u.full_name.split(" ")[0])}</b> · ${open ? "En turno desde " + hhmm(open.check_in) : today.length ? "Salida " + hhmm(today[today.length - 1].check_out) : "Sin marcar entrada"}</span>
      ${open ? `<button class="btn small ghost" type="button" data-act="att-out">Marcar salida</button>` : `<button class="btn small" type="button" data-act="att-in">Marcar entrada</button>`}</div>`;
  };

  // pantalla
  function renderCaja() {
    const block = D().denied(["SUPERVISOR", "VENDEDOR", "CAJERO"]);
    if (block) return block;
    const u = me();
    if (!cj.init) {
      cj.init = true;
      const mine = D().byId("staff", u.id);
      if (mine && mine.store_id && D().byId("stores", mine.store_id)) setStore(mine.store_id);
    }
    const st = store();
    const ses = mySession();
    const tabs = [["vender", "Vender"], ["pedidos", "Pedidos web"], ["reportes", "Reportes"], ["stock", "Stock"], ["traslados", "Traslados"], ["adelantos", "Adelantos"], ["precios", "Precios"], ["cuadre", "Apertura / cierre"]];
    const bodies = { vender: tabVender, pedidos: () => D().ordersPanel(D().ui.storeId), reportes: tabReportes, stock: tabStock, traslados: tabTraslados, adelantos: tabAdelantos, precios: tabPrecios, cuadre: tabCuadre };
    // v32: pestañas extra de módulos (ej. Consignar, BD v17) — window.DL_CAJA_TABS = [{ id, label, show(), render() }]
    (window.DL_CAJA_TABS || []).forEach((t) => { if (!t.show || t.show()) { tabs.splice(tabs.length - 1, 0, [t.id, t.label]); bodies[t.id] = t.render; } });
    const body = bodies[cj.tab] || tabVender;
    const incoming = (data().transfers || []).filter((t) => (t.to_warehouse_id === wh() && t.status === "ENVIADO") || (t.from_warehouse_id === wh() && t.status === "SOLICITADO")).length;
    return `<section class="pos">
      <div class="pos-head counter-card">
        <div class="row counter-row ${counterCollapsed() ? "collapsed" : ""}">
          <button type="button" class="counter-toggle" data-act="cj-counter" aria-label="Mostrar u ocultar datos de caja" aria-expanded="${!counterCollapsed()}"></button>
          <div class="counter-main row">
            <span class="counter-ic">${IC("counter", 26)}</span>
            <div class="stack" style="gap:2px">
              <select id="cj-store" aria-label="Tienda">${(data().stores || []).filter((s) => s.is_active !== false).map((s) => `<option value="${esc(s.id)}" ${st && s.id === st.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
              <span class="tiny counter-sum">${ses ? "Caja abierta" : "Caja cerrada"}</span>
              <span class="tiny counter-state">${ses ? `<span class="badge ok">Caja abierta</span> desde ${hhmm(ses.opened_at)} · fondo ${soles(ses.opening_cents)}` : `<span class="badge">Caja cerrada</span>`} · ${esc(u.full_name.split(" ")[0])}</span>
            </div>
          </div>
          <button type="button" class="icon-btn bell" data-act="cj-ov" data-id="bell" aria-label="Notificaciones${unread().length ? ": " + unread().length + " sin leer" : ""}">${IC("bell", 20)}${unread().length ? `<b class="dot">${unread().length}</b>` : ""}</button>
        </div>
        <div class="counter-att">${window.DL_attendanceBar()}</div>
      </div>
      ${window.DL_CAJA_TOP ? window.DL_CAJA_TOP(ses, st) : ""}
      <div class="tabs" id="caja-tabs">${tabs.map(([id, l]) => `<button type="button" class="chip ${cj.tab === id ? "on" : ""}" data-act="cj-tab" data-id="${id}">${l}${id === "traslados" && incoming ? ` <b class="dot">${incoming}</b>` : ""}</button>`).join("")}</div>
      ${body()}
    </section>${cj.last ? ticketOverlay(cj.last) : ""}${overlayHtml()}`;
  }
  function setStore(id) {
    const ui = D().ui;
    ui.storeId = id;
    const mine = (data().warehouses || []).filter((w) => w.store_id === id && w.is_active !== false);
    const house = mine.find((w) => w.kind === "TIENDA" && w.is_default) || mine.find((w) => w.kind === "TIENDA") || mine.find((w) => !/taller|almac/i.test(w.name)) || mine[0];
    if (house) ui.warehouseId = house.id;
  }

  // vender
  function openForm() {
    const st = store();
    const last = st && lastClosed(st.id);
    const lastSales = last ? sessionSales(last.id).filter((s) => s.status === "COMPLETED") : [];
    return `<form novalidate class="panel stack" data-form="cj-open">
      <h3>Abrir caja · ${esc(st ? st.name : "")}</h3>
      ${last ? `<div class="note"><b>Último cierre:</b> ${fecha(last.closed_at)} ${hhmm(last.closed_at)} por ${esc(D().nameOf("staff", last.user_id))}<br>
        Ventas ${lastSales.length} · ${soles(D().sumCents(lastSales, "total_cents"))} · diferencia ${soles(last.difference_cents || 0)}<br>
        <b>Fondo dejado: ${soles(last.float_left_cents ?? last.closing_cents ?? 0)}</b></div>` : `<p class="tiny">No hay cierres anteriores en esta tienda.</p>`}
      ${window.DL_STORES_TODAY ? window.DL_STORES_TODAY(st) : ""}
      <label>Fondo que recibes en la caja (S/)<input name="opening" inputmode="decimal" value="${last ? ((last.float_left_cents ?? 0) / 100).toFixed(2) : "200.00"}" required></label>
      <button class="btn" type="submit">Abrir caja</button>
      <p class="tiny">El fondo se entrega en la tienda principal. Si cambias de tienda, ciérralo y abre otro.</p></form>`;
  }
  function productRows() {
    const q = cj.q.trim();
    const list = products().filter((p) => p.is_active !== false && (!cj.cat || p.category_id === cj.cat) && match(p, q))
      .sort((a, b) => a.name.localeCompare(b.name, "es") || String(a.size_label).localeCompare(String(b.size_label), "es", { numeric: true })).slice(0, 60);
    if (!list.length) return `<p class="muted">Sin resultados. Prueba en la pestaña Stock.</p>`;
    return list.map((p) => {
      const pr = D().priceOf(p); const here = D().stockIn(p.id, wh()); const cp = cj.cust.id && cj.priceCache ? cj.priceCache[cj.cust.id + ":" + p.id] : null;
      return `<button type="button" class="prow" data-act="cj-add" data-id="${esc(p.id)}">
        <img alt="" loading="lazy" src="${esc(thumb(p.image_url))}">
        <span class="grow"><b>${esc(p.name)}</b><br><span class="tiny">${esc(variantLabel(p))} · ${esc(D().nameOf("brands", p.brand_id))}${p.season ? " · " + esc(p.season) : ""}</span></span>
        <span class="num">${cp != null && cp !== pr.unit ? `<s class="tiny">${soles(pr.unit)}</s><br><b class="offer" title="Precio del cliente">${soles(cp)}</b>` : pr.offer ? `<s class="tiny">${soles(pr.list)}</s><br><b class="offer">${soles(pr.unit)}</b>` : `<b>${soles(pr.unit)}</b>`}<br><span class="tiny ${here ? "" : "bad"}">${here} aquí</span></span></button>`;
    }).join("");
  }
  function thumb(url) {
    const u = String(url || "");
    return D().safeSrc(u);
  }
  function proofBox(forLay) {
    return `<div class="proof stack"><span class="tiny"><b>Foto del Yape/Plin (obligatoria)</b>${forLay ? " · para abonos con Yape/Plin" : ""}</span>
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn ghost small" type="button" data-act="cj-cam"><i class="fas fa-camera"></i> Tomar foto</button><input type="file" accept="image/*" capture="environment" id="cj-proof" hidden>
      <label class="btn ghost small"><i class="fas fa-image"></i> Subir captura<input type="file" accept="image/*" id="cj-proof-g" hidden></label>
      ${cj.proof ? `<img src="${cj.proof}" alt="captura del pago" class="proof-thumb"><button type="button" class="btn ghost small" data-act="cj-proof-del">Quitar</button>` : `<span class="tiny proof-missing" role="alert">Sin foto: no se puede cobrar con Yape/Plin.</span>`}</div></div>`;
  }
  function isQr(m) { return m === "YAPE" || m === "PLIN"; }
  function needsProof() { return cj.pay === "YAPE" || cj.pay === "PLIN" || (cj.pay === "MIXTO" && (cj.mix.YAPE || cj.mix.PLIN)); }
  function mixSum() { return Object.values(cj.mix).reduce((n, v) => n + (Number(v) || 0), 0); }
  function mixLeft(total) { const d = total - mixSum(); return d === 0 ? "✓ Cuadra con el total" : d > 0 ? "Falta asignar " + soles(d) : "Sobra " + soles(-d); }
  function shrink(file, max) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error("No se pudo leer la foto")); r.onload = () => { const im = new Image(); im.onerror = () => rej(new Error("No es una imagen")); im.onload = () => { const sc = Math.min(1, (max || 900) / Math.max(im.width, im.height)); const c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.7)); }; im.src = r.result; }; r.readAsDataURL(file); });
  }
  function cartTotal() { return cj.cart.reduce((n, l) => n + l.unit * l.qty, 0); }
  function tabVender() {
    const ses = mySession();
    if (!ses) return openForm();
    const cats = (data().categories || []).filter((c) => c.is_active !== false && products().some((p) => p.category_id === c.id));
    const today = sessionSales(ses.id).slice().sort((a, b) => String(b.sold_at).localeCompare(String(a.sold_at)));
    return `<div class="pos-grid2">
      <div class="stack">
        <div class="row search-row"><label class="search-box grow">${IC("search", 18)}<input id="cj-q" placeholder="Nombre, talla, color o código" aria-label="Buscar producto" value="${esc(cj.q)}"></label><button class="icon-btn qr-btn" type="button" data-act="cj-qr" aria-label="Escanear QR">${IC("qr", 20)}</button></div>
        <div class="tabs">${[["", "Todo"]].concat(cats.map((c) => [c.id, c.name])).map(([id, l]) => `<button type="button" class="chip ${cj.cat === id ? "on" : ""}" data-act="cj-cat" data-id="${esc(id)}">${esc(l)}</button>`).join("")}</div>
        <div id="cj-list" class="plist">${productRows()}</div>
      </div>
      <div class="stack">
        <div class="panel stack" id="cj-cart">${cartHtml()}</div>
        <div class="panel"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px"><h3>Ventas de esta caja</h3>
          <span class="row" style="gap:6px"><button class="btn ghost small" type="button" data-act="cj-csv">CSV</button><button class="btn ghost small" type="button" data-act="cj-copy">Copiar</button></span></div>
          ${today.length ? `<div class="table-wrap"><table><tbody>${today.map((s) => `<tr class="tap" data-act="cj-ticket" data-id="${esc(s.id)}"><td><b>${esc(s.sale_number)}</b><br><span class="tiny">${hhmm(s.sold_at)} · ${esc(s.customer_name || "")}</span></td><td class="num">${soles(s.total_cents)}<br><span class="tiny">${esc(D().PAY[s.payment_method] || "")}${s.status === "VOID" ? " · ANULADA" : ""}</span></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted tiny">Aún no hay ventas.</p>`}
          <p class="tiny">CSV / Copiar: líneas listas para pasar a la boleta electrónica.</p></div>
      </div></div>`;
  }
  function cartHtml() {
    if (!cj.cart.length) return `<h3>Boleta</h3><p class="muted tiny">Toca un producto para agregarlo.</p>`;
    const total = cartTotal();
    return `<h3>Boleta</h3>
      ${cj.cart.map((l, i) => { const p = D().byId("products", l.id) || {}; const below = p.min_price_cents && l.unit < p.min_price_cents; return `<div class="cline">
        <div class="grow"><b>${esc(p.name)}</b><br><span class="tiny">${esc(variantLabel(p))}</span></div>
        ${REMOTE() && D().stockIn(l.id, wh()) < l.qty ? `<button class="btn ghost small" type="button" data-act="cj-qt" data-id="${esc(l.id)}" title="Solo hay ${D().stockIn(l.id, wh())} en este piso">Traer de otra tienda</button>` : ""}
        <div class="qty"><button type="button" data-act="cj-qty" data-i="${i}" data-d="-1">−</button><span>${l.qty}</span><button type="button" data-act="cj-qty" data-i="${i}" data-d="1">+</button></div>
        <input class="price-in ${below ? "warn" : ""}" inputmode="decimal" data-cj-price="${i}" value="${(l.unit / 100).toFixed(2)}" title="Precio unitario">
      </div>${below ? `<p class="tiny bad">Debajo del mínimo (${soles(p.min_price_cents)})</p>` : ""}`; }).join("")}
      <div class="two doc-pay">
        <label class="tiny">Comprobante<select id="cj-doc-sel">${DOC_OPTS.map(([k, l]) => `<option value="${k}" ${cj.doc === k ? "selected" : ""} ${k === "GUIA" ? "disabled" : ""}>${l}</option>`).join("")}</select></label>
        <label class="tiny">Método de pago<select id="cj-pay-sel">${PAYS.concat([["MIXTO", "Mixto"]]).map(([k, l]) => `<option value="${k}" ${cj.pay === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <div class="cust-box stack">
        <div class="row" style="gap:6px;align-items:flex-end"><label class="tiny grow">${cj.doc === "FACTURA" ? "RUC" : "DNI"}${cj.doc === "BOLETA" && total >= 70000 ? " (oblig. ≥ S/700)" : ""}<input id="cj-cdoc" inputmode="numeric" maxlength="${cj.doc === "FACTURA" ? 11 : 8}" value="${esc(cj.cust.doc)}" placeholder="${cj.doc === "FACTURA" ? "11 dígitos" : "8 dígitos"}"></label>
          <button class="btn ghost small" type="button" data-act="cj-cust-find" aria-label="Buscar cliente">${IC("search", 16)} Buscar</button></div>
        <p class="tiny cust-status" id="cj-cust-status">${custStatus()}</p>
        <label class="tiny">${cj.doc === "FACTURA" ? "Razón social" : "Cliente"}<input id="cj-cname" value="${esc(cj.cust.name)}" placeholder="${cj.doc === "FACTURA" ? "Razón social" : "Varios"}"></label>
        ${cj.doc === "FACTURA" ? `<label class="tiny">Dirección fiscal<input id="cj-caddr" value="${esc(cj.cust.address)}"></label>` : ""}
        <label class="tiny">WhatsApp del cliente (opcional)<input id="cj-cphone" type="tel" inputmode="tel" autocomplete="off" maxlength="15" value="${esc(cj.cust.phone || "")}" placeholder="9 dígitos"></label>
      </div>
      ${cj.pay === "MIXTO" ? `<div class="mix">${PAYS.map(([k, l]) => `<label class="tiny">${l}<input inputmode="decimal" data-mix="${k}" value="${cj.mix[k] ? (cj.mix[k] / 100).toFixed(2) : ""}" placeholder="0.00"></label>`).join("")}<p class="tiny" id="mix-left">${mixLeft(total)}</p></div>` : ""}
      ${needsProof() ? proofBox() : ""}
      <div class="row total-row"><span>Total · ${esc(DOCS[cj.doc].label)}</span><b class="num big">${soles(total)}</b></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn grow" type="button" data-act="cj-sell" ${needsProof() && !cj.proof ? 'disabled aria-disabled="true" title="Adjunta la foto del Yape/Plin"' : ""}>Cobrar</button>
        <button class="btn ghost" type="button" data-act="cj-layaway">Separar (adelanto)</button><button class="btn ghost small" type="button" data-act="cj-clear">Vaciar</button></div>`;
  }
  function findCustomer(doc) { doc = String(doc || "").trim(); return doc ? (data().customers || []).find((c) => String(c.document_number || c.doc || "") === doc) : null; }
  function custStatus() {
    const doc = String(cj.cust.doc || "").trim();
    const need = cj.doc === "FACTURA" ? 11 : 8;
    if (doc.length !== need) return "";
    const c = findCustomer(doc);
    return c ? `<span class="badge ok">Cliente registrado</span> ${c.is_wholesale ? `<span class="badge tag-mayorista">Mayorista${c.wholesale_mode === "normal" ? " · precio normal" : ""}</span> ` : ""}${esc(c.name || "")}${cj.cust.id === c.id && cj.custPriced ? `<br><span class="tiny">Precios del cliente aplicados</span>` : ""}` : `<span class="badge">Cliente nuevo</span> se registrará al cobrar`;
  }
  function custLookup() {
    const c = findCustomer(cj.cust.doc);
    if (c) { cj.cust.name = c.name || cj.cust.name; cj.cust.phone = c.phone || cj.cust.phone; cj.cust.address = c.address || cj.cust.address; }
    setCustomer(c);
    const box = document.getElementById("cj-cart"); if (box) box.innerHTML = cartHtml();
  }
  // v9 · precio por cliente (especial / mayorista / normal) con price_for_customer
  function setCustomer(c) {
    const id = c ? c.id : null; if (id === (cj.cust.id || null)) return;
    cj.cust.id = id; cj.custPriced = false;
    if (!id) { cj.cart.forEach((l) => { if (l.custPrice) { const p = D().byId("products", l.id); if (p) l.unit = D().priceOf(p).unit; l.custPrice = false; } }); return; }
    applyCustPrices();
  }
  async function custUnit(lineOrId) {
    const vid = typeof lineOrId === "string" ? lineOrId : lineOrId.id; const cid = cj.cust.id;
    if (!cid || !REMOTE() || !D().Store.v2api.priceForCustomer) return null;
    cj.priceCache = cj.priceCache || {}; const k = cid + ":" + vid;
    if (!(k in cj.priceCache)) cj.priceCache[k] = await D().Store.v2api.priceForCustomer(vid, cid).catch(() => null);
    return cj.priceCache[k];
  }
  async function applyCustPrices() {
    const cid = cj.cust.id; if (!cid) return;
    for (const l of cj.cart) { const u = await custUnit(l); if (cj.cust.id !== cid) return; if (u != null) { l.unit = u; l.custPrice = true; } }
    cj.custPriced = true;
    const box = document.getElementById("cj-cart"); if (box) box.innerHTML = cartHtml();
    const list = document.getElementById("cj-list"); if (list) list.innerHTML = productRows();
  }
  function addToCart(id) {
    const p = D().byId("products", id); if (!p) return;
    const line = cj.cart.find((l) => l.id === id);
    if (line) line.qty += 1; else { const l = { id, qty: 1, unit: D().priceOf(p).unit }; cj.cart.push(l); if (cj.cust.id) custUnit(l).then((u) => { if (u != null && cj.cart.includes(l)) { l.unit = u; l.custPrice = true; const c = document.getElementById("cj-cart"); if (c) c.innerHTML = cartHtml(); } }); }
  }
  async function sellWithQt(order) {
    try { return await D().sell(order); } catch (e) {
      if (/piso de la tienda|traslado r[aá]pido/i.test(e.message)) {
        const short = cj.cart.find((l) => D().stockIn(l.id, wh()) < l.qty) || cj.cart[0];
        if (short) qtOpen(short.id).catch(() => {});
        throw new Error("Esa prenda no está en el piso de esta tienda. Tráela con «Traer de otra tienda» y vuelve a cobrar.");
      }
      throw e;
    }
  }
  async function sell() {
    if (!cj.cart.length) throw new Error("La boleta está vacía");
    if (needsProof() && !cj.proof) throw new Error("Adjunta la foto del Yape/Plin.");
    for (const l of cj.cart) {
      const p = D().byId("products", l.id);
      if (p.min_price_cents && l.unit < p.min_price_cents && !D().allow(["SUPERVISOR"]) && !await DL_UI.confirm(p.name + " está debajo del precio mínimo. ¿Continuar?")) return;
    }
    const total = cartTotal();
    const docN = cj.cust.doc.trim();
    if (cj.doc === "FACTURA") {
      if (!/^(10|15|17|20)\d{9}$/.test(docN)) throw new Error("Factura: RUC de 11 dígitos válido");
      if (cj.cust.name.trim().length < 3) throw new Error("Factura: falta la razón social");
    }
    if (cj.doc === "BOLETA" && docN && !/^\d{8}$/.test(docN)) throw new Error("DNI de 8 dígitos");
    if (cj.doc === "BOLETA" && total >= 70000 && !docN) throw new Error("Boleta desde S/ 700: pide el DNI");
    let payments, method = cj.pay;
    if (cj.pay === "MIXTO") {
      payments = Object.entries(cj.mix).filter(([, v]) => v > 0).map(([m, cents]) => ({ method: m, cents }));
      if (mixSum() !== total) throw new Error("Pago mixto: " + mixLeft(total));
      if (payments.length < 2) throw new Error("Mixto necesita al menos dos medios");
      method = payments.slice().sort((a, b) => b.cents - a.cents)[0].method;
    } else payments = [{ method, cents: total }];
    payments = await withOpCodes(payments);
    const cart0 = cj.cart.map((l) => String(l.id));
    const sale = await sellWithQt({ customerId: cj.cust.id || null, customerPhone: cj.cust.phone.trim() || null, lines: cj.cart.map((l) => ({ productId: l.id, qty: l.qty, unitCents: l.unit })), payment: method, payments, payProof: cj.proof, docType: cj.doc, series: DOCS[cj.doc].series, customerName: cj.cust.name.trim() || "Varios", customerDoc: docN || null, customerAddress: cj.cust.address.trim() || null });
    cj.salePhone = cj.salePhone || {}; if (cj.cust.phone) cj.salePhone[sale.id] = cj.cust.phone.replace(/\D/g, "");
    // v33 (BD v18): venta que viene de un pedido web → se vincula con set_order_status(p_sale_id); el trigger copia el comprobante del pedido.
    const fo = cj.fromOrder; cj.fromOrder = null;
    if (fo && sale && sale.id && fo.ids.every((id) => cart0.includes(id))) {
      try { await D().Store.v2api.setOrderStatus(fo.id, "ENTREGADO", null, sale.id); D().toast("Pedido " + fo.code + " entregado y vinculado a la venta", "ok"); }
      catch (e) { D().toast("Venta emitida, pero no se pudo vincular el pedido " + fo.code + ": " + (e.message || e) + ". Márcalo en Pedidos web.", "error"); }
    }
    cj.cart = []; cj.cust = { name: "", doc: "", phone: "", address: "" }; cj.pay = "CASH"; cj.mix = {}; cj.proof = null; cj.doc = "BOLETA";
    cj.last = sale.id;
    D().render(); D().toast(DOCS[sale.doc_type || "BOLETA"].label + " " + sale.sale_number + " emitida");
  }

  // boleta / ticket
  function saleItems(sale) { return (data().sale_items || []).filter((i) => i.sale_id === sale.id); }
  function payList(sale) { return Array.isArray(sale.payments) && sale.payments.length ? sale.payments : [{ method: sale.payment_method, cents: sale.total_cents }]; }
  function ticketText(sale) {
    const st = D().byId("stores", sale.store_id) || {}; const doc = DOCS[sale.doc_type || "BOLETA"] || DOCS.BOLETA;
    const lines = saleItems(sale).map((i) => { const p = D().byId("products", i.product_id) || {}; return `${i.quantity} x ${p.name || i.product_id} ${p.size_label ? "T." + p.size_label : ""} ${p.color || ""}  ${soles(i.line_total_cents)}`; });
    return [`*${BIZ().name}* · ${st.name || ""}`, st.address || "", `${doc.title} ${sale.sale_number}`, `${fecha(sale.sold_at)} ${hhmm(sale.sold_at)}`, `Cliente: ${sale.customer_name || "Varios"}${sale.customer_doc ? " · " + sale.customer_doc : ""}`, "------------------------------", ...lines, "------------------------------", `*TOTAL ${soles(sale.total_cents)}*`, "Pago: " + payList(sale).map((p) => (D().PAY[p.method] || p.method) + " " + soles(p.cents)).join(" + "), `Atendió: ${sale.seller_name || ""}`, sale.status === "VOID" ? "*** ANULADA ***" : BIZ().footer].join("\n");
  }
  function ticketHtml(sale) {
    const st = D().byId("stores", sale.store_id) || {}; const doc = DOCS[sale.doc_type || "BOLETA"] || DOCS.BOLETA; const biz = BIZ();
    const total = Number(sale.total_cents); const base = Math.round(total / 1.18); const igv = total - base;
    const items = saleItems(sale).map((i) => { const p = D().byId("products", i.product_id) || {}; return `<tr><td>${i.quantity}</td><td>${esc(p.name || "")}<br><small>${esc([p.size_label ? "T." + p.size_label : "", p.color, p.sku].filter(Boolean).join(" · "))}</small></td><td class="r">${soles(i.unit_price_cents)}</td><td class="r">${soles(i.line_total_cents)}</td></tr>`; }).join("");
    const qrData = encodeURIComponent([biz.ruc, doc.series.replace("-", ""), sale.sale_number, (igv / 100).toFixed(2), (total / 100).toFixed(2), D().localDay(sale.sold_at), sale.customer_doc || "-"].join("|"));
    return `<div class="tk">
      <div class="tk-c"><img src="assets/logo.jpg" alt="" class="tk-logo"><b class="tk-name">${esc(biz.name)}</b><br>RUC ${esc(biz.ruc || "(pendiente)")}${biz.address ? "<br>" + esc(biz.address) : ""}<br>${esc(st.name || "")}<br>${esc(st.address || "")}${st.phone ? "<br>Tel. " + esc(st.phone) : ""}</div>
      <div class="tk-c tk-doc"><b>${esc(doc.title)}</b><br><b>${esc(sale.sale_number)}</b></div>
      <div class="tk-meta">Fecha: ${fecha(sale.sold_at)} ${hhmm(sale.sold_at)}<br>${sale.doc_type === "FACTURA" ? "RUC" : "Doc."}: ${esc(sale.customer_doc || "—")}<br>${sale.doc_type === "FACTURA" ? "Razón social" : "Cliente"}: ${esc(sale.customer_name || "Varios")}${sale.customer_address ? "<br>Dirección: " + esc(sale.customer_address) : ""}<br>Vendedor: ${esc(sale.seller_name || "")}</div>
      <table class="tk-t"><thead><tr><th>Cant</th><th>Descripción</th><th class="r">P.U.</th><th class="r">Importe</th></tr></thead><tbody>${items}</tbody></table>
      <div class="tk-tot">${sale.discount_cents ? `<div><span>Descuento</span><span>-${soles(sale.discount_cents)}</span></div>` : ""}${sale.doc_type !== "TICKET" ? `<div><span>Op. gravada</span><span>${soles(base)}</span></div><div><span>IGV 18%</span><span>${soles(igv)}</span></div>` : ""}<div class="big"><span>TOTAL</span><span>${soles(total)}</span></div></div>
      <div class="tk-pay">${payList(sale).map((p) => `<div><span>${esc(D().PAY[p.method] || p.method)}</span><span>${soles(p.cents)}</span></div>`).join("")}</div>
      ${sale.status === "VOID" ? `<div class="tk-c"><b>*** ANULADA ***</b></div>` : ""}
      <div class="tk-c"><img class="tk-qr" alt="" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}" onerror="this.remove()"><br><small>${sale.doc_type === "TICKET" ? "Documento interno, no válido como comprobante" : "Representación impresa · emitir en el sistema de comprobante electrónico"}</small><br>${esc(biz.footer)}</div>
    </div>`;
  }
  const TK_CSS = `.tk{width:72mm;margin:0 auto;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#000;background:#fff;padding:3mm}.tk-c{text-align:center;margin:4px 0}.tk-logo{width:46px;height:46px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 4px}.tk-name{font-size:14px;letter-spacing:.08em}.tk-doc{border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0}.tk-meta{margin:6px 0}.tk-t{width:100%;border-collapse:collapse}.tk-t th{border-bottom:1px dashed #000;text-align:left;font-weight:700;padding:2px 0}.tk-t td{padding:2px 0;vertical-align:top}.tk-t .r,.tk-t th.r{text-align:right}.tk-t small,.tk small{font-size:9px}.tk-tot,.tk-pay{border-top:1px dashed #000;margin-top:4px;padding-top:4px}.tk-tot div,.tk-pay div{display:flex;justify-content:space-between}.tk-tot .big{font-size:14px;font-weight:700}.tk-qr{width:90px;height:90px;margin-top:4px}`;
  window.DL_TK_CSS = TK_CSS;
  function ticketOverlay(id) {
    const sale = D().byId("sales", id); if (!sale) return "";
    return `<div class="overlay" id="ticket-ov"><div class="sheet-lite"><div class="tk-wrap">${ticketHtml(sale)}</div>
      <div class="row tk-acts" style="gap:6px;flex-wrap:wrap"><button class="btn" type="button" data-act="cj-pdf" data-id="${esc(id)}">${IC("pdf", 16)} PDF / Compartir</button><button class="btn ghost wa-btn" type="button" data-act="cj-wa-receipt" data-id="${esc(id)}">${IC("wa", 16)} WhatsApp</button><button class="btn ghost" type="button" data-act="cj-rawbt" data-id="${esc(id)}"><i class="fas fa-print"></i> Imprimir (RawBT)</button><button class="btn ghost" type="button" data-act="cj-print" data-id="${esc(id)}">Imprimir navegador</button><button class="btn ghost" type="button" data-act="cj-ticket-close">Cerrar</button></div>
      <label class="tiny rawbt-cols">Ancho para RawBT<select id="cj-rawbt-cols">${[[32, "32 columnas (58 mm)"], [48, "48 columnas (80 mm)"]].map(([v, l]) => `<option value="${v}" ${String(v) === (localStorage.getItem("dl-rawbt-cols") || "32") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <p class="tiny">RawBT: app Android para impresoras térmicas Bluetooth. También puedes elegir “RawBT” al compartir el PDF.</p</div></div>`;
  }
  function printTicket(id) {
    const sale = D().byId("sales", id);
    const w = window.open("", "_blank", "width=380,height=640");
    if (!w) throw new Error("El navegador bloqueó la ventana de impresión");
    const baseHref = location.href.replace(/[^/]*$/, "");
    w.document.write(`<html><head><base href="${baseHref}"><title>${esc(sale.sale_number)}</title><style>@page{size:80mm auto;margin:0}body{margin:0}${TK_CSS}</style></head><body>${ticketHtml(sale)}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
    w.document.close();
  }
  async function shareWa(text, file, phone) {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    if (!file && navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    window.open("https://wa.me/" + (phone ? String(phone).replace(/\D/g, "") : "") + "?text=" + encodeURIComponent(text), "_blank");
  }
  function dataUrlFile(url, name) {
    const [head, b64] = String(url).split(","); const mime = (head.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  }
  function exportRows(sales) {
    const head = ["boleta", "fecha", "hora", "cliente", "documento", "codigo", "descripcion", "cantidad", "precio_unit", "total_linea", "metodo", "estado"];
    const rows = [head];
    sales.forEach((s) => (data().sale_items || []).filter((i) => i.sale_id === s.id).forEach((i) => {
      const p = D().byId("products", i.product_id) || {};
      rows.push([s.sale_number, D().localDay(s.sold_at), hhmm(s.sold_at), s.customer_name || "", s.customer_doc || "", p.sku || "", [p.name, p.size_label ? "T." + p.size_label : "", p.color].filter(Boolean).join(" "), i.quantity, (i.unit_price_cents / 100).toFixed(2), (i.line_total_cents / 100).toFixed(2), D().PAY[s.payment_method] || s.payment_method, s.status === "VOID" ? "ANULADA" : "OK"]);
    }));
    return rows;
  }
  function exportSales() { const ses = mySession(); return ses ? sessionSales(ses.id) : []; }
  function downloadCsv(rows, name) {
    const csv = "\ufeff" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  window.DL_exportRows = exportRows; window.DL_downloadCsv = downloadCsv;

  // stock en todas las tiendas
  function tabStock() {
    const q = cj.sq.trim();
    const whs = (data().warehouses || []).filter((w) => w.is_active !== false);
    const list = q ? products().filter((p) => match(p, q)).slice(0, 40) : [];
    return `<div class="panel stack"><input id="cj-sq" placeholder="Buscar prenda" value="${esc(cj.sq)}">
      <p class="tiny">Muestra cuántas unidades hay en cada tienda y almacén. “Pedir” crea un traslado hacia ${esc(whName(wh()))}.</p>
      <div id="cj-slist">${list.length ? list.map((p) => `<div class="stock-card"><b>${esc(p.name)}</b> <span class="tiny">${esc(variantLabel(p))} · ${esc(p.sku)}</span>
        <div class="wh-grid">${whs.map((w) => { const n = D().stockIn(p.id, w.id); return `<div class="wh ${w.id === wh() ? "mine" : ""} ${n ? "" : "zero"}"><span class="tiny">${esc(w.name)}</span><b class="num">${n}</b>${n && w.id !== wh() ? `<button class="btn small ghost" type="button" data-act="cj-req" data-id="${esc(p.id)}" data-from="${esc(w.id)}">Pedir</button>${REMOTE() ? `<button class="btn small" type="button" data-act="cj-qt" data-id="${esc(p.id)}" data-from="${esc(w.id)}">Traer ya</button>` : ""}` : ""}</div>`; }).join("")}</div></div>`).join("") : q ? `<p class="muted">Nada con “${esc(q)}”.</p>` : ""}</div></div>`;
  }

  // traslados
  function transferRow(t, scope) {
    const p = D().byId("products", t.product_id) || {};
    const canSend = t.status === "SOLICITADO" && (scope === "all" || t.from_warehouse_id === wh());
    const canRecv = t.status === "ENVIADO" && (scope === "all" || t.to_warehouse_id === wh());
    return `<tr><td><b>${esc(t.number)}</b> <span class="badge st-${t.status.toLowerCase()}">${esc(t.status.toLowerCase())}</span><br><span class="tiny">${esc(p.name || "")} ${esc(variantLabel(p))} × ${t.qty}</span><br>
      <span class="tiny">${esc(whName(t.from_warehouse_id))} → ${esc(whName(t.to_warehouse_id))} · ${fecha(t.created_at)} · ${esc(t.requested_by || "")}</span>${quickInfo(t)}</td>
      <td class="acts">${canFlag(t) ? `<button class="btn ghost small" type="button" data-act="tr-flag" data-id="${esc(t.id)}">Marcar como observado</button>` : ""}${canSend ? `<button class="btn small" type="button" data-act="tr-send" data-id="${esc(t.id)}">Enviar</button>` : ""}${canRecv ? `<button class="btn small" type="button" data-act="tr-recv" data-id="${esc(t.id)}">Recibido</button>` : ""}${["SOLICITADO"].includes(t.status) ? `<button class="btn small ghost" type="button" data-act="tr-cancel" data-id="${esc(t.id)}">Cancelar</button>` : ""}</td></tr>`;
  }
  window.DL_transfersTable = function (scope) {
    const list = (data().transfers || []).filter((t) => scope === "all" || t.from_warehouse_id === wh() || t.to_warehouse_id === wh())
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return list.length ? `<div class="table-wrap"><table><tbody>${list.map((t) => transferRow(t, scope)).join("")}</tbody></table></div>` : `<p class="muted">Sin traslados.</p>`;
  };
  function tabTraslados() {
    return `<div class="panel stack"><h3>Traslados de ${esc(whName(wh()))}</h3><p class="tiny">Solicitado → enviado (sale del origen) → recibido (entra al destino). Para pedir, busca en la pestaña Stock.</p>${window.DL_transfersTable("mine")}</div>`;
  }
  async function requestTransfer(productId, fromId) {
    const qty = Number.parseInt(await DL_UI.prompt("¿Cuántas unidades pides?", "1"), 10);
    if (!qty || qty < 1) return;
    if (qty > D().stockIn(productId, fromId)) throw new Error("No hay tantas en ese almacén");
    if (REMOTE()) {
      await D().Store.v2api.requestTransfer(fromId, wh(), [{ product_id: productId, qty }], me().full_name + " pide " + qty + " para " + whName(wh()));
      await D().reload(); D().render(); D().toast("Traslado solicitado"); return;
    }
    const trId = D().nid("tr"); const trNum = D().nextNumber("transfers", "number", "TR-", 1000); const pr = D().byId("products", productId) || {};
    await notify(fromId, "Solicitud de traslado " + trNum, `${me().full_name} pide ${qty}× ${pr.name || ""} ${variantLabel(pr)} para ${whName(wh())}`, trId);
    await D().Store.insert("transfers", { id: trId, number: trNum, product_id: productId, qty, from_warehouse_id: fromId, to_warehouse_id: wh(), status: "SOLICITADO", requested_by: me().full_name, note: "", created_at: new Date().toISOString(), sent_at: null, received_at: null });
    await D().reload(); D().render(); D().toast("Traslado solicitado");
  }
  async function moveTransfer(id, next) {
    const t = D().byId("transfers", id); if (!t) return;
    if (REMOTE()) {
      if (next === "ENVIADO") await D().Store.v2api.dispatchTransfer(id, null, "Enviado por " + me().full_name);
      else if (next === "RECIBIDO") await D().Store.v2api.receiveTransfer(id);
      await D().reload(); D().render(); D().toast("Traslado " + next.toLowerCase()); return;
    }
    const S = D().Store;
    await S.transaction(async () => {
      if (next === "ENVIADO") await D().applyDelta(t.product_id, t.from_warehouse_id, -t.qty, "TRASLADO_SALIDA", t.number);
      if (next === "RECIBIDO") await D().applyDelta(t.product_id, t.to_warehouse_id, t.qty, "TRASLADO_ENTRADA", t.number);
      const patch = { status: next };
      if (next === "ENVIADO") patch.sent_at = new Date().toISOString();
      if (next === "RECIBIDO") patch.received_at = new Date().toISOString();
      await S.update("transfers", id, patch);
    });
    const pr = D().byId("products", t.product_id) || {};
    if (next === "ENVIADO") await notify(t.to_warehouse_id, "Traslado " + t.number + " enviado", `${t.qty}× ${pr.name || ""} ${variantLabel(pr)} va en camino desde ${whName(t.from_warehouse_id)}`, t.id);
    await D().reload(); D().render(); D().toast("Traslado " + next.toLowerCase());
  }

  // notificaciones
  async function notify(warehouseId, title, body, refId) {
    if (REMOTE()) return;
    const w = D().byId("warehouses", warehouseId);
    await D().Store.insert("notifications", { id: D().nid("ntf"), store_id: w ? w.store_id : null, warehouse_id: warehouseId, kind: "TRASLADO", title, body, ref_table: "transfers", ref_id: refId, read_by: [], created_by: me() ? me().full_name : "", created_at: new Date().toISOString() });
  }
  function myStores() {
    const u = me(); if (!u) return [];
    const p = D().byId("staff", u.id) || u; const set = new Set([D().ui.storeId]);
    if (p.store_id) set.add(p.store_id);
    (data().stores || []).forEach((s) => { if (s.manager_id === u.id || (s.manager_ids || []).includes(u.id)) set.add(s.id); });
    return [...set];
  }
  function myNotifs() { if (REMOTE()) return (data().notifications || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))); const st = myStores(); return (data().notifications || []).filter((n) => st.includes(n.store_id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))); }
  function syncBell() {
    const b = document.querySelector(".pos-head .bell"); if (!b) return;
    const n = unread().length; let dot = b.querySelector(".dot");
    if (n && !dot) { dot = document.createElement("b"); dot.className = "dot"; b.appendChild(dot); }
    if (dot) { if (n) dot.textContent = n; else dot.remove(); }
    b.setAttribute("aria-label", "Notificaciones" + (n ? ": " + n + " sin leer" : ""));
  }
  setInterval(async () => {
    if (document.hidden || !/^#caja/.test(location.hash) || !REMOTE() || !D().Store.v2api || !D().Store.v2api.refreshNotifs) return;
    try { const before = unread().length; data().notifications = await D().Store.v2api.refreshNotifs(); if (unread().length !== before) syncBell(); } catch { }
  }, 45000);
  function counterCollapsed() { try { return localStorage.getItem("dl-counter-collapsed") === "1"; } catch { return false; } }
  function unread() { const id = me() && me().id; return myNotifs().filter((n) => !(n.read_by || []).includes(id)); }
  window.DL_unreadNotifs = unread;

  // overlays: registro, campana, comprobante
  async function qtOpen(id, from) {
    cj.qt = { id, from: from || "", rows: null }; cj.ov = "qt"; D().render();
    try {
      const rows = REMOTE() ? await D().Store.v2api.stockElsewhere(id)
        : (data().warehouses || []).filter((w) => w.is_active !== false).map((w) => ({ store_id: w.store_id, store_name: D().nameOf("stores", w.store_id), warehouse_id: w.id, warehouse_name: w.name, kind: w.kind || "", qty: D().stockIn(id, w.id), is_mine: true })).filter((r) => r.qty > 0);
      if (cj.qt && cj.qt.id === id) { cj.qt.rows = rows.filter((r) => r.warehouse_id !== wh()); D().render(); }
    } catch (e) { cj.ov = null; cj.qt = null; D().render(); throw e; }
  }
  const KIND = { TIENDA: "piso", ALMACEN: "almacén", CONSIGNACION: "consignación", PRODUCCION: "taller" };
  function qtHtml() {
    const p = D().byId("products", cj.qt.id) || {};
    const line = cj.cart.find((l) => l.id === cj.qt.id);
    const need = Math.max(1, (line ? line.qty : 1) - D().stockIn(p.id, wh()));
    const src = cj.qt.rows;
    const opt = (r) => `<option value="${esc(r.warehouse_id)}" ${r.warehouse_id === cj.qt.from ? "selected" : ""}>${esc(r.store_name)} · ${esc(r.warehouse_name)} (${esc(KIND[r.kind] || r.kind)}) · ${r.qty}</option>`;
    const mine = (src || []).filter((r) => r.is_mine), other = (src || []).filter((r) => !r.is_mine);
    return `<div class="overlay"><div class="sheet-lite"><h3><i class="fas fa-truck-fast"></i> Traer de otra tienda</h3>
      <p><b>${esc(p.name || "")}</b> <span class="tiny">${esc(variantLabel(p))}</span><br><span class="tiny">Llega a: ${esc(whName(wh()))} · aquí hay ${D().stockIn(p.id, wh())}</span></p>
      ${src === null ? `<p class="muted">Buscando stock…</p><button class="btn ghost" type="button" data-act="cj-ov-close">Cancelar</button>`
      : src.length ? `<form novalidate class="stack" data-form="cj-qt"><label>Desde<select name="from">${mine.length ? `<optgroup label="Mis tiendas">${mine.map(opt).join("")}</optgroup>` : ""}${other.length ? `<optgroup label="Otras tiendas">${other.map(opt).join("")}</optgroup>` : ""}</select></label>
        <label>Cantidad<input name="qty" type="number" min="1" value="${need}"></label>
        <p class="tiny">Quedas registrado como quien lleva la prenda; se avisa al encargado del origen.</p>
        <div class="row" style="gap:6px"><button class="btn" type="submit">Traer ahora</button><button class="btn ghost" type="button" data-act="cj-ov-close">Cancelar</button></div></form>`
      : `<p class="note">No hay stock de esta prenda en ningún otro almacén activo.</p><button class="btn ghost" type="button" data-act="cj-ov-close">Cerrar</button>`}</div></div>`;
  }
  async function qtGo(form) {
    const qty = Number.parseInt(form.elements.qty.value, 10);
    if (!qty || qty < 1) throw new Error("Cantidad inválida");
    const r = await D().Store.v2api.quickTransfer(form.elements.from.value, wh(), [{ product_id: cj.qt.id, qty }], "Traslado rápido desde caja");
    if (!cj.cart.some((l) => l.id === cj.qt.id)) addToCart(cj.qt.id);
    cj.ov = null; cj.qt = null; await D().reload(); D().render(); D().toast("Listo: la prenda ya está en este piso" + (r && r.carried_by_name ? " · llevó " + r.carried_by_name : ""));
  }
  function canFlag(t) {
    if (!REMOTE() || !t || !t.is_quick || t.flagged_at) return false;
    const u = me(); if (!u) return false;
    const w = D().byId("warehouses", t.from_warehouse_id) || {}; const st = D().byId("stores", w.store_id) || {};
    return w.manager_id === u.id || st.manager_id === u.id || (st.manager_ids || []).includes(u.id) || D().allow(["ADMIN", "ALMACENERO"]);
  }
  function quickInfo(t) {
    if (!t || !t.is_quick) return "";
    return `<br><span class="tiny"><b>Rápido</b> · llevó ${esc(t.carried_by || "—")}${t.flagged_at ? ` · <b class="bad">Observado</b> por ${esc(t.flagged_by || "—")}: ${esc(t.flag_reason)}` : ""}</span>`;
  }
  async function flagTransfer(id) {
    const why = (await DL_UI.prompt("Motivo de la observación (obligatorio)") || "").trim();
    if (!why) throw new Error("Indica el motivo");
    await D().Store.v2api.flagQuickTransfer(id, why);
    await D().reload(); D().render(); D().toast("Traslado observado: se avisó al administrador");
  }
  function overlayHtml() {
    if (!cj.ov) return "";
    if (cj.ov === "qt" && cj.qt) return qtHtml();
    if (cj.ov === "bell") {
      const list = myNotifs().slice(0, 40); const fresh = new Set(cj.bellNew || []);
      const KIND = { PEDIDO: "Pedido web", TRASLADO: "Traslado", TRANSFER: "Traslado" };
      return `<div class="overlay"><div class="sheet-lite ntf-sheet"><div class="row ntf-head"><h3>${IC("bell", 18)} Notificaciones</h3><button class="icon-btn" type="button" data-act="cj-ov-close" aria-label="Cerrar">${IC("close", 18)}</button></div>
        ${list.map((n) => { const isOrder = String(n.kind || "").toUpperCase() === "PEDIDO" || /pedido/i.test(n.link || ""); const t = n.ref_id ? D().byId("transfers", String(n.ref_id)) : null;
          return `<div class="ntf ${fresh.has(n.id) ? "new" : ""}"><span class="tiny ntf-kind">${esc(KIND[String(n.kind || "").toUpperCase()] || (isOrder ? "Pedido web" : "Aviso"))}</span><br><b>${esc(n.title)}</b>${n.body ? `<br><span>${esc(n.body)}</span>` : ""}<br><span class="tiny">${fecha(n.created_at)} ${hhmm(n.created_at)}${n.store_id ? " · " + esc(D().nameOf("stores", n.store_id)) : ""}</span>
          <div class="row ntf-acts">${isOrder ? `<button type="button" class="btn small" data-act="ntf-order" data-id="${esc(n.id)}">Ver pedidos</button>` : n.ref_id ? `<button type="button" class="btn small" data-act="ntf-go" data-id="${esc(n.id)}">Ver traslado</button>` : ""}${canFlag(t) ? `<button type="button" class="btn ghost small" data-act="tr-flag" data-id="${esc(t.id)}">Marcar</button>` : ""}</div></div>`; }).join("") || `<p class="muted">No tienes notificaciones.</p>`}
        <button type="button" class="btn ghost" data-act="cj-ov-close">Cerrar</button></div></div>`;
    }
    if (cj.ov === "registro") {
      const day = cj.regDay || D().localDay(new Date());
      const list = (data().sales || []).filter((s) => s.store_id === D().ui.storeId && D().localDay(s.sold_at) === day).sort((a, b) => String(b.sold_at).localeCompare(String(a.sold_at)));
      const ok = list.filter((s) => s.status === "COMPLETED");
      return `<div class="overlay"><div class="sheet-lite wide"><div class="row" style="justify-content:space-between;gap:6px"><h3><i class="fas fa-list"></i> Registro de ventas</h3><input type="date" id="cj-regday" value="${day}" style="max-width:150px"></div>
        <p class="tiny">${esc(D().nameOf("stores", D().ui.storeId))} · ${ok.length} ventas · ${soles(D().sumCents(ok, "total_cents"))}</p>
        <div class="table-wrap"><table class="tnum"><tbody>${list.map((s) => `<tr><td><b>${esc(s.sale_number)}</b> <span class="tiny">${esc((DOCS[s.doc_type] || DOCS.BOLETA).label)}</span><br><span class="tiny">${hhmm(s.sold_at)} · ${esc(s.customer_name || "")} · ${esc(s.seller_name || "")}${s.status === "VOID" ? " · ANULADA" : ""}</span></td>
          <td class="num">${soles(s.total_cents)}<br><span class="tiny">${payList(s).map((p) => esc(D().PAY[p.method] || p.method)).join("+")}</span></td>
          <td class="acts">${s.pay_proof ? `<button type="button" class="ibtn" data-act="cj-proof-view" data-id="${esc(s.id)}" title="Comprobante Yape/Plin"><img src="${s.pay_proof}" alt=""></button>` : ""}<button type="button" class="ibtn" data-act="cj-ticket" data-id="${esc(s.id)}" title="Ticket"><i class="fas fa-receipt"></i></button><button type="button" class="ibtn" data-act="cj-share" data-id="${esc(s.id)}" title="WhatsApp"><i class="fab fa-whatsapp"></i></button></td></tr>`).join("") || `<tr><td>Sin ventas ese día.</td></tr>`}</tbody></table></div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn ghost small" type="button" data-act="cj-csv-day"><i class="fas fa-file-csv"></i> CSV del día</button><button class="btn ghost" type="button" data-act="cj-ov-close">Cerrar</button></div></div></div>`;
    }
    if (cj.ov.startsWith("proof:")) {
      const s = D().byId("sales", cj.ov.slice(6)); if (!s) return "";
      return `<div class="overlay"><div class="sheet-lite"><h3>Comprobante de pago · ${esc(s.sale_number)}</h3><img src="${s.pay_proof}" alt="Comprobante" class="proof-big"><p class="tiny">${payList(s).map((p) => esc(D().PAY[p.method]) + " " + soles(p.cents)).join(" + ")} · ${fecha(s.sold_at)} ${hhmm(s.sold_at)}</p>
        <div class="row" style="gap:6px"><button class="btn wa-btn" type="button" data-act="cj-proof-share" data-id="${esc(s.id)}"><i class="fab fa-whatsapp"></i> Compartir</button><button class="btn ghost" type="button" data-act="cj-ov" data-id="registro">Volver</button></div></div></div>`;
    }
    return "";
  }

  // adelantos / separaciones
  function layPaid(l) { return (l.payments || []).reduce((n, p) => n + Number(p.cents || 0), 0); }
  window.DL_layawaysList = function (q, all) {
    q = String(q || "").trim().toLowerCase();
    const list = (data().layaways || []).filter((l) => all || !q ? true : true).filter((l) => {
      if (!q) return all ? true : l.status === "ACTIVO";
      const hay = `${l.number} ${l.customer_name} ${l.customer_doc} ${l.customer_phone} ${l.boleta_number || ""} ${D().localDay(l.created_at)} ${fecha(l.created_at)}`.toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (!list.length) return `<p class="muted">Sin adelantos${q ? " para “" + esc(q) + "”" : " activos"}.</p>`;
    return list.map((l) => { const paid = layPaid(l); return `<div class="stock-card"><div class="row" style="justify-content:space-between;gap:6px"><b>${esc(l.number)} · ${esc(l.customer_name)}</b><span class="badge ${l.status === "ACTIVO" ? "ok" : ""}">${esc(l.status.toLowerCase())}</span></div>
      <span class="tiny">DNI ${esc(l.customer_doc || "—")} · ${esc(l.customer_phone || "")} · ${fecha(l.created_at)} · ${esc(D().nameOf("stores", l.store_id))}${l.boleta_number ? " · boleta " + esc(l.boleta_number) : ""}</span><br>
      <span class="tiny">${(l.items || []).map((i) => `${i.qty}× ${esc(i.name)} ${i.size ? "T." + esc(i.size) : ""}`).join(", ")}</span>
      <div class="row" style="justify-content:space-between;margin-top:6px"><span class="num">Total ${soles(l.total_cents)} · pagado ${soles(paid)} · <b>saldo ${soles(l.total_cents - paid)}</b></span></div>
      <span class="tiny">${(l.payments || []).map((p) => `${fecha(p.at)} ${soles(p.cents)} ${esc(D().PAY[p.method] || p.method)}`).join(" · ")}</span>
      ${l.status === "ACTIVO" && D().allow(["SUPERVISOR", "VENDEDOR", "CAJERO"]) ? `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn small" type="button" data-act="lay-pay" data-id="${esc(l.id)}">Abonar</button><button class="btn small" type="button" data-act="lay-done" data-id="${esc(l.id)}">Completar y entregar</button><button class="btn small ghost" type="button" data-act="lay-cancel" data-id="${esc(l.id)}">Anular</button></div>` : ""}</div>`; }).join("");
  };
  function tabAdelantos() {
    return `<div class="panel stack"><h3>Adelantos y separaciones</h3>
      <input id="cj-aq" placeholder="Buscar por DNI, nombre o boleta" value="${esc(cj.aq)}">
      <p class="tiny">Para separar: arma la boleta en “Vender” y toca “Separar (adelanto)”. La mercadería queda reservada.</p>
      ${REMOTE() ? proofBox(true) : ""}
      <div id="cj-alist">${window.DL_layawaysList(cj.aq, false)}</div></div>`;
  }
  async function askPay(defaultCents) {
    const v = await DL_UI.prompt("Monto que deja el cliente (S/)", (defaultCents / 100).toFixed(2), { inputmode: "decimal", ok: "Continuar" });
    if (v === null) return null;
    const cents = money(v); if (cents <= 0) throw new Error("Monto inválido");
    const m = await DL_UI.choose("¿Cómo paga " + soles(cents) + "?", PAYS, "CASH");
    if (m === null) return null;
    return { cents, method: m };
  }
  async function createLayaway() {
    const ses = mySession(); if (!ses) throw new Error("Abre la caja primero");
    if (!cj.cart.length) throw new Error("Agrega productos a la boleta");
    const name = cj.cust.name.trim() || await DL_UI.prompt("Nombre del cliente") || "";
    const doc = cj.cust.doc.trim() || await DL_UI.prompt("DNI del cliente") || "";
    if (!name || !doc) throw new Error("Nombre y DNI son obligatorios para separar");
    const phone = await DL_UI.prompt("Teléfono (opcional)") || "";
    const total = cartTotal();
    const pay = await askPay(Math.round(total / 2)); if (!pay) return;
    if (pay.cents > total) throw new Error("El adelanto supera el total");
    if (REMOTE()) {
      if (pay.cents >= total) throw new Error("Si paga todo, usa Cobrar");
      if (isQr(pay.method) && !cj.proof) throw new Error("Adjunta la foto del Yape/Plin.");
      const [p1] = await withOpCodes([{ method: pay.method, cents: pay.cents }]);
      const sale = await sellWithQt({ customerId: cj.cust.id || null, payProof: isQr(pay.method) ? cj.proof : null, lines: cj.cart.map((l) => ({ productId: l.id, qty: l.qty, unitCents: l.unit })), payments: [p1], docType: cj.doc, customerName: name, customerDoc: doc, customerPhone: phone, customerAddress: (cj.cust.address || "").trim() || null, note: "Separado" });
      cj.cart = []; cj.cust = { name: "", doc: "", phone: "", address: "" }; cj.proof = null; cj.tab = "adelantos"; cj.aq = "";
      D().render(); D().toast("Separado " + (sale.sale_number || "") + " registrado"); return;
    }
    const S = D().Store;
    const row = { id: D().nid("lay"), number: D().nextNumber("layaways", "number", "AD-", 1000), customer_name: name, customer_doc: doc, customer_phone: phone, store_id: D().ui.storeId, warehouse_id: wh(),
      items: cj.cart.map((l) => { const p = D().byId("products", l.id); return { product_id: l.id, name: p.name, size: p.size_label, color: p.color || "", qty: l.qty, unit_cents: l.unit }; }),
      total_cents: total, payments: [{ at: new Date().toISOString(), cents: pay.cents, method: pay.method, by: me().full_name, session_id: ses.id }], status: "ACTIVO", boleta_number: null, note: "", created_by: me().full_name, created_at: new Date().toISOString() };
    await S.transaction(async () => {
      for (const l of row.items) await D().applyDelta(l.product_id, wh(), -l.qty, "SEPARADO", row.number);
      await S.insert("layaways", row);
    });
    cj.cart = []; cj.cust = { name: "", doc: "", phone: "" }; cj.tab = "adelantos"; cj.aq = row.number;
    await D().reload(); D().render(); D().toast("Adelanto " + row.number + " registrado");
  }
  async function layPays(pay) {
    if (isQr(pay.method) && !cj.proof) throw new Error("Adjunta la foto del Yape/Plin. Usa “Tomar foto” o “Subir captura” arriba de la lista.");
    return D().Store.v2api.attachProof(await withOpCodes([{ method: pay.method, cents: pay.cents }]), isQr(pay.method) ? cj.proof : null);
  }
  async function layPay(id) {
    const ses = mySession(); if (!ses) throw new Error("Abre la caja primero");
    const l = D().byId("layaways", id); const saldo = l.total_cents - layPaid(l);
    const pay = await askPay(saldo); if (!pay) return;
    if (pay.cents > saldo) throw new Error("Supera el saldo");
    if (REMOTE()) { await D().Store.v2api.paySaleBalance(l.sale_id, await layPays(pay), null); cj.proof = null; await D().reload(); D().render(); D().toast("Abono registrado"); return; }
    await D().Store.update("layaways", id, { payments: (l.payments || []).concat([{ at: new Date().toISOString(), cents: pay.cents, method: pay.method, by: me().full_name, session_id: ses.id }]) });
    await D().reload(); D().render(); D().toast("Abono registrado");
  }
  async function layDone(id) {
    const ses = mySession(); if (!ses) throw new Error("Abre la caja primero");
    let l = D().byId("layaways", id); let saldo = l.total_cents - layPaid(l);
    if (REMOTE()) {
      const pay = await askPay(saldo); if (!pay) return;
      if (pay.cents !== saldo) throw new Error("Para completar se paga el saldo exacto: " + soles(saldo));
      const dt = l.doc_type || "BOLETA";
      const r = await D().Store.v2api.paySaleBalance(l.sale_id, await layPays(pay), null); cj.proof = null;
      cj.last = l.sale_id; await D().reload(); D().render(); D().toast("Entregado con " + dt.toLowerCase() + " " + (r.series ? r.series + "-" + r.number : "")); return;
    }
    if (saldo > 0) { const pay = await askPay(saldo); if (!pay) return; if (pay.cents !== saldo) throw new Error("Para completar se paga el saldo exacto: " + soles(saldo)); l = Object.assign({}, l, { payments: (l.payments || []).concat([{ at: new Date().toISOString(), cents: pay.cents, method: pay.method, by: me().full_name, session_id: ses.id }]) }); }
    const S = D().Store;
    const whId = l.warehouse_id || wh();
    let sale;
    await S.transaction(async () => { for (const i of l.items) await D().applyDelta(i.product_id, whId, i.qty, "SEPARADO_ENTREGA", l.number); });
    const ui = D().ui; const prevWh = ui.warehouseId; ui.warehouseId = whId;
    try {
      sale = await D().sell({ lines: l.items.map((i) => ({ productId: i.product_id, qty: i.qty, unitCents: i.unit_cents })), payment: (l.payments[l.payments.length - 1] || {}).method || "CASH", customerName: l.customer_name, customerDoc: l.customer_doc, layawayId: l.id });
    } finally { ui.warehouseId = prevWh; }
    await S.update("sales", sale.id, { layaway_id: l.id });
    await S.update("layaways", id, { status: "COMPLETADO", boleta_number: sale.sale_number, payments: l.payments });
    cj.last = sale.id;
    await D().reload(); D().render(); D().toast("Entregado con boleta " + sale.sale_number);
  }
  async function layCancel(id) {
    const l = D().byId("layaways", id);
    if (!await DL_UI.confirm("¿Anular el adelanto " + l.number + "? La mercadería vuelve al stock. Devuelve " + soles(layPaid(l)) + " si corresponde.")) return;
    if (REMOTE()) { await window.DLCaja.voidSale(l.sale_id); D().render(); D().toast("Separado anulado · adelanto devuelto desde tu caja"); return; }
    const S = D().Store;
    await S.transaction(async () => {
      for (const i of l.items) await D().applyDelta(i.product_id, l.warehouse_id || wh(), i.qty, "SEPARADO_ANULADO", l.number);
      await S.update("layaways", id, { status: "CANCELADO" });
    });
    await D().reload(); D().render(); D().toast("Adelanto anulado");
  }

  // precios
  function tabPrecios() {
    const q = cj.pq || "";
    const list = products().filter((p) => p.is_active !== false && match(p, q)).sort((a, b) => a.name.localeCompare(b.name, "es") || String(a.size_label).localeCompare(String(b.size_label), "es", { numeric: true }));
    return `<div class="panel stack"><input id="cj-pq" placeholder="Buscar precio: nombre, talla, marca" value="${esc(q)}">
      <div class="table-wrap"><table class="tnum"><thead><tr><th>Pieza</th><th>Venta</th><th>Mín.</th><th>Mayor</th></tr></thead><tbody id="cj-plist">
      ${list.map((p) => { const pr = D().priceOf(p); return `<tr><td>${esc(p.name)}<br><span class="tiny">${esc(variantLabel(p))}</span></td><td class="num">${pr.offer ? `<s class="tiny">${soles(pr.list)}</s><br><b class="offer">${soles(pr.unit)}</b>` : soles(pr.unit)}</td><td class="num">${p.min_price_cents ? soles(p.min_price_cents) : "—"}</td><td class="num">${p.wholesale_price_cents ? soles(p.wholesale_price_cents) : "—"}</td></tr>`; }).join("")}
      </tbody></table></div></div>`;
  }

  // cuadre y cierre
  function expected(ses) {
    if (REMOTE()) return Object.assign({ CASH: 0, YAPE: 0, PLIN: 0, CARD: 0, TRANSFER: 0 }, ses.expected_json || {});
    const exp = { CASH: Number(ses.opening_cents || 0), YAPE: 0, PLIN: 0, CARD: 0, TRANSFER: 0 };
    sessionSales(ses.id).filter((s) => s.status === "COMPLETED" && !s.layaway_id).forEach((s) => payList(s).forEach((p) => { exp[p.method] = (exp[p.method] || 0) + Number(p.cents); }));
    (data().layaways || []).forEach((l) => (l.payments || []).filter((p) => p.session_id === ses.id).forEach((p) => { exp[p.method] = (exp[p.method] || 0) + Number(p.cents); }));
    return exp;
  }
  window.DL_expectedCash = expected;
  function canCuadre(person) {
    if (!person) return false;
    const r = D().rolesOf(D().byId("staff", person.id) || person);
    if (r.includes("ADMIN") || r.includes("SUPERVISOR") || r.includes("CUADRE")) return true;
    return (data().stores || []).some((s) => (s.manager_id === person.id || (s.manager_ids || []).includes(person.id)) && s.id === D().ui.storeId);
  }
  window.DL_canCuadre = canCuadre;
  function cuadreLogin() {
    return `<form novalidate class="panel stack auth-box" data-form="cj-auth"><h3><i class="fas fa-user-shield"></i> Autorizar cuadre de caja</h3>
      <p class="tiny">Tu usuario no tiene permiso “Cuadrar caja”. Que el encargado, supervisor o administrador ingrese aquí su usuario y clave. Tu sesión no se cierra.</p>
      <label>Usuario o correo<input name="email" autocomplete="off" required></label>
      <label>Contraseña<input name="password" type="password" required autocomplete="off"></label>
      <button class="btn" type="submit">Autorizar</button></form>`;
  }
  function tabCuadre() {
    const ses = mySession();
    // v32 (BD v17): sin permiso de cierre, el encargado autoriza con su PIN dentro del mismo formulario (close_register_with_pin)
    const pinFlow = !!(window.DL_CLOSE_AUTH && window.DL_CLOSE_AUTH.active());
    const authorized = canCuadre(me()) || (cj.authBy && cj.authBy.at > Date.now() - 15 * 60e3) || pinFlow;
    if (!authorized) return cuadreLogin();
    const hist = (data().cash_sessions || []).filter((s) => s.status === "CLOSED" && (s.store_id === D().ui.storeId || s.user_id === me().id)).sort((a, b) => String(b.closed_at).localeCompare(String(a.closed_at))).slice(0, 15);
    const histHtml = `<div class="panel"><h3>Cuaderno de cierres</h3>${hist.length ? `<div class="table-wrap"><table class="tnum"><thead><tr><th>Fecha</th><th>Ventas</th><th>Dif.</th><th>Fondo</th></tr></thead><tbody>${hist.map((s) => { const ss = sessionSales(s.id).filter((x) => x.status === "COMPLETED"); return `<tr><td>${fecha(s.closed_at)}<br><span class="tiny">${esc(D().nameOf("stores", s.store_id))} · ${esc(D().nameOf("staff", s.user_id))}</span></td><td class="num">${soles(D().sumCents(ss, "total_cents"))}<br><span class="tiny">${ss.length} boletas</span></td><td class="num ${Number(s.difference_cents) ? "bad" : ""}">${soles(s.difference_cents || 0)}</td><td class="num">${soles(s.float_left_cents ?? 0)}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="muted">Sin cierres.</p>`}</div>`;
    if (!ses) return `<p class="muted">No tienes caja abierta.</p>${histHtml}`;
    const exp = expected(ses);
    const ss = sessionSales(ses.id).filter((s) => s.status === "COMPLETED");
    return `${cj.authBy && !canCuadre(me()) ? `<div class="note"><i class="fas fa-user-shield"></i> Autorizado por <b>${esc(cj.authBy.name)}</b> <button type="button" class="btn ghost small" data-act="cj-auth-end">Terminar</button></div>` : ""}<form novalidate class="panel stack" data-form="cj-close"><h3>Cuadre de caja</h3>
      <p class="tiny">${ss.length} boletas · vendido ${soles(D().sumCents(ss, "total_cents"))} · fondo inicial ${soles(ses.opening_cents)}</p>
      <div class="table-wrap"><table class="tnum"><thead><tr><th>Medio</th><th>Esperado</th><th>Contado</th></tr></thead><tbody>
      ${PAYS.map(([k, l]) => `<tr><td>${l}${k === "CASH" ? '<br><span class="tiny">incluye fondo</span>' : ""}</td><td class="num">${soles(exp[k] || 0)}</td><td><input class="money" inputmode="decimal" name="c_${k}" data-exp="${exp[k] || 0}" value="${((exp[k] || 0) / 100).toFixed(2)}"></td></tr>`).join("")}
      </tbody></table></div>
      <div class="two"><label>Gastos pagados con caja (S/)<input name="gastos" inputmode="decimal" value="0.00"></label><label>Fondo que dejas para mañana (S/)<input name="float" inputmode="decimal" value="${((ses.opening_cents || 0) / 100).toFixed(2)}"></label></div>
      <label>Nota<input name="note" placeholder="Nota (opcional)"></label>
      <div id="cj-diff" class="note"></div>
      ${pinFlow ? window.DL_CLOSE_AUTH.inline(ses, canCuadre(me())) : ""}
      <button class="btn" type="submit">Cerrar caja</button></form>${histHtml}`;
  }
  function updateDiff() {
    const f = document.querySelector('[data-form="cj-close"]'); const box = document.getElementById("cj-diff");
    if (!f || !box) return;
    let diff = 0;
    PAYS.forEach(([k]) => { diff += money(f.elements["c_" + k].value) - Number(f.elements["c_" + k].dataset.exp); });
    diff += money(f.elements.gastos.value);
    const cash = money(f.elements.c_CASH.value); const fl = money(f.elements.float.value);
    if (window.DL_CLOSE_SUMMARY) { box.className = "stack"; box.innerHTML = window.DL_CLOSE_SUMMARY({ f, diff, cash, float: fl, exp: PAYS.reduce((n, [k]) => n + Number(f.elements["c_" + k].dataset.exp || 0), 0), counted: PAYS.reduce((n, [k]) => n + money(f.elements["c_" + k].value), 0) }); return; }
    box.innerHTML = `Diferencia total: <b class="${diff ? "bad" : ""}">${soles(diff)}</b> ${diff > 0 ? "(sobra)" : diff < 0 ? "(falta)" : "· cuadra"}<br>Efectivo a entregar en tienda principal: <b>${soles(cash - fl)}</b>`;
  }
  async function closeCaja(form) {
    const ses = mySession(); if (!ses) throw new Error("No hay caja abierta");
    const exp = expected(ses); const counted = {}; let diff = 0;
    PAYS.forEach(([k]) => { counted[k] = money(form.elements["c_" + k].value); diff += counted[k] - (exp[k] || 0); });
    const gastos = money(form.elements.gastos.value); diff += gastos;
    const fl = money(form.elements.float.value);
    if (!await DL_UI.confirm(diff ? "Hay un descuadre de " + soles(diff) + (diff < 0 ? " (falta)" : " (sobra)") + ". Se avisará al administrador. ¿Cerrar caja igual?" : "¿Cerrar caja? Todo cuadra.", { danger: !!diff, title: "Cerrar caja" })) return;
    if (REMOTE()) {
      const api = D().Store.v2api;
      const expKey = ses.id + ":" + gastos; // si el PIN falla y se reintenta, el gasto no se registra dos veces
      if (gastos && cj.expAdded !== expKey) { await api.addExpense(ses.id, gastos, "Gastos de caja (cierre)"); cj.expAdded = expKey; }
      const note = [form.elements.note.value.trim(), cj.authBy ? "Autorizó " + cj.authBy.name : ""].filter(Boolean).join(" · ") || null;
      const AU = window.DL_CLOSE_AUTH; let r;
      if (AU && AU.active() && AU.wants(form)) { r = await AU.close(ses, counted, note, fl, form); if (!r || r.ok === false) return; }
      else {
        try { r = await api.closeCash(ses.id, counted, note, fl); }
        catch (e) { if (AU && AU.active() && /PIN del encargado/i.test(String(e && e.message))) { AU.require(); D().render(); D().toast("Esta tienda pide el PIN del encargado para cerrar.", "error"); return; } throw e; }
      }
      cj.expAdded = null;
      if (window.DL_CLOSE_DONE) window.DL_CLOSE_DONE(r, { diff, counted, float: fl });
      cj.authBy = null; await D().reload(); D().render(); D().toast("Caja cerrada · diferencia efectivo " + soles(Math.round(Number(r && (r.cash_difference != null ? r.cash_difference : r.difference) || 0) * 100))); return;
    }
    if (gastos) await D().Store.insert("expenses", { id: D().nid("exp"), store_id: ses.store_id, category: "Caja", amount_cents: gastos, note: "Gastos de caja", expense_date: D().localDay(new Date()), created_by: me().full_name });
    await D().Store.update("cash_sessions", ses.id, { closed_by: cj.authBy && !canCuadre(me()) ? cj.authBy.id : me().id, status: "CLOSED", closing_cents: counted.CASH, closed_at: new Date().toISOString(), expected_json: exp, counted_json: counted, difference_cents: diff, float_left_cents: fl, delivered_cents: counted.CASH - fl, note: form.elements.note.value.trim() || null });
    cj.authBy = null; await D().reload(); D().render(); D().toast("Caja cerrada");
  }

  // QR
  const SCAN_FORMATS = ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf"];
  function loadZxing() {
    return new Promise((res, rej) => {
      if (window.ZXing) return res(window.ZXing);
      const s = document.createElement("script"); s.src = "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";
      s.onload = () => (window.ZXing ? res(window.ZXing) : rej(new Error("No se pudo iniciar el lector")));
      s.onerror = () => rej(new Error("No se pudo cargar el lector de códigos (revisa tu internet)"));
      document.head.appendChild(s);
    });
  }
  function camError(e) {
    const n = (e && e.name) || "";
    if (n === "NotAllowedError" || n === "SecurityError") return "Permiso de cámara denegado. Toca el candado de la barra de direcciones → Permisos → Cámara → Permitir, y vuelve a intentar.";
    if (n === "NotFoundError" || n === "OverconstrainedError") return "No se encontró una cámara en este equipo.";
    if (n === "NotReadableError" || n === "AbortError") return "La cámara está en uso por otra app. Ciérrala y vuelve a intentar.";
    return "No se pudo abrir la cámara: " + ((e && e.message) || e);
  }
  const scan = { stream: null, timer: null, reader: null, last: "", lastAt: 0, added: [] };
  // «Beep de caja» generado con WebAudio (sin archivos). El contexto se desbloquea al abrir el escáner (toque del usuario).
  let beepCtx = null;
  function audioUnlock() {
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; if (!beepCtx) beepCtx = new AC(); if (beepCtx.state === "suspended") beepCtx.resume().catch(() => {}); return beepCtx; } catch { return null; }
  }
  function beep(ok) {
    const ctx = audioUnlock(); if (!ctx) return;
    try {
      const t = ctx.currentTime + 0.01;
      const tone = (freq, start, dur, vol) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = ok === false ? "sawtooth" : "square"; o.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + 0.008);
        g.gain.setValueAtTime(vol, start + dur - 0.02); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(g); g.connect(ctx.destination); o.start(start); o.stop(start + dur + 0.02);
      };
      if (ok === false) tone(220, t, 0.22, 0.08); // código no encontrado: tono grave corto
      else tone(2730, t, 0.12, 0.12); // beep clásico de lector (~2.7 kHz, 120 ms)
    } catch { }
  }
  window.DL_BEEP = beep;
  window.DL_openScanner = (sink, title) => { scan.sink = sink || null; const pr = openQr(); const h = document.querySelector("#scan-ov .qr-head b"); if (h && title) h.textContent = title; return pr; }; // v32: lector reutilizable
  function scanMsg(text, ok) {
    const m = document.getElementById("scan-msg"); if (!m) return;
    m.hidden = false; m.className = "scan-msg " + (ok ? "ok" : "bad"); m.innerHTML = (ok ? IC("check", 16) + " " : "") + esc(text);
  }
  function onCode(raw) {
    const code = String(raw || "").trim(); const now = Date.now();
    if (!code || (code === scan.last && now - scan.lastAt < 1800)) return;
    scan.last = code; scan.lastAt = now;
    const k = code.toLowerCase();
    const local = () => products().find((x) => String(x.sku || "").toLowerCase() === k || String(x.barcode || "").toLowerCase() === k);
    const api = D().Store.v2api;
    const lookup = api && api.variantByCode ? api.variantByCode(code, D().ui.storeId).catch(() => undefined) : Promise.resolve(undefined);
    lookup.then((r) => {
      if (r === null) { beep(false); scanMsg("Código no encontrado: " + code, false); return; }
      if (r && r.is_active === false) { scanMsg("Esa prenda está desactivada: " + code, false); return; }
      const p = r ? D().byId("products", String(r.variant_id)) : local();
      if (!p) { beep(false); scanMsg("Código no encontrado: " + code, false); return; }
      if (scan.sink) { const m = scan.sink(p, r, code); beep(m !== false); scanMsg(typeof m === "string" ? m : "Listo: " + p.name, m !== false); return; }
      addScanned(p, r);
    });
  }
  function addScanned(p, r) {
    addToCart(p.id);
    beep(true);
    if (navigator.vibrate) navigator.vibrate(60);
    scan.added.unshift(p.name + (p.size_label ? " · T. " + p.size_label : ""));
    scanMsg("Agregado: " + p.name + (p.size_label ? " · T. " + p.size_label : "") + (r && r.stock != null ? " · stock tienda " + r.stock : ""), true);
    const list = document.getElementById("scan-added"); if (list) list.innerHTML = scan.added.slice(0, 8).map((t) => `<div class="row qr-item">${IC("check", 14)} <span>${esc(t)}</span></div>`).join("");
    const c = document.getElementById("cj-cart"); if (c) c.innerHTML = cartHtml();
  }
  async function openQr() {
    audioUnlock();
    closeQr(true);
    const ov = document.createElement("div");
    ov.id = "scan-ov"; ov.className = "overlay qr-overlay";
    ov.innerHTML = `<div class="sheet-lite qr-sheet stack"><div class="row qr-head"><b>Escanear código o QR</b><button class="icon-btn" type="button" data-act="cj-qr-close" aria-label="Cerrar">${IC("close", 18)}</button></div>
      <div class="scan-box"><video id="scan-video" playsinline muted autoplay></video></div>
      <p id="scan-msg" class="scan-msg" hidden></p>
      <p class="tiny">Apunta al código de barras (EAN / Code128) o al QR de la etiqueta.</p>
      <div id="scan-added" class="stack qr-added"></div>
      <div class="row"><input id="scan-manual" class="grow" placeholder="O escribe el código" inputmode="text" autocomplete="off"><button class="btn ghost small" type="button" data-act="cj-scan-manual">Agregar</button></div>
      <button class="btn" type="button" data-act="cj-qr-close">Listo</button></div>`;
    document.body.appendChild(ov);
    scan.added = []; scan.last = "";
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      scanMsg("La cámara solo funciona en https o en localhost. Abre la app con https:// o escribe el código abajo.", false); return;
    }
    const video = document.getElementById("scan-video");
    try {
      scan.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    } catch (e) { scanMsg(camError(e), false); return; }
    if (!document.getElementById("scan-ov")) { closeQr(true); return; }
    video.srcObject = scan.stream;
    try { await video.play(); } catch { }
    let native = null;
    if ("BarcodeDetector" in window) {
      try { const ok = await window.BarcodeDetector.getSupportedFormats(); const f = SCAN_FORMATS.filter((x) => ok.includes(x)); if (f.includes("qr_code") && f.includes("ean_13")) native = new window.BarcodeDetector({ formats: f }); } catch { }
    }
    if (native) {
      const tick = async () => {
        if (!scan.stream) return;
        try { if (video.readyState >= 2) { const r = await native.detect(video); if (r && r[0]) onCode(r[0].rawValue); } } catch { }
        scan.timer = setTimeout(tick, 180);
      };
      tick(); return;
    }
    try {
      const Z = await loadZxing();
      const hints = new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.ITF]);
      hints.set(Z.DecodeHintType.TRY_HARDER, true);
      scan.reader = new Z.BrowserMultiFormatReader(hints, 250);
      scan.reader.decodeFromVideoElementContinuously(video, (res) => { if (res) onCode(res.getText()); });
    } catch (e) { scanMsg((e && e.message) || "No se pudo iniciar el lector", false); }
  }
  // Foto del Yape/Plin con la cámara dentro de la página (getUserMedia); si no hay, input capture=environment
  const cam = { stream: null };
  // Foto de Yape/Plin: WebP ~1200 px y ~100 KB (JPEG si el navegador no hace WebP)
  function compressProof(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No es una imagen")); };
      im.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, 1200 / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        const webp = c.toDataURL("image/webp", 0.7).startsWith("data:image/webp"); const type = webp ? "image/webp" : "image/jpeg";
        let q = 0.72, out = c.toDataURL(type, q);
        while (out.length * 0.75 > 100 * 1024 && q > 0.35) { q -= 0.08; out = c.toDataURL(type, q); }
        res(out);
      };
      im.src = url;
    });
  }
  window.DL_compressProof = compressProof;
  function proofDone(file) { return compressProof(file).then((u) => { cj.proof = u; const c = document.getElementById("cj-cart"); if (c) c.innerHTML = cartHtml(); else D().render(); }); }
  function camFallback() { const i = document.getElementById("cj-proof"); if (i) i.click(); }
  function closeCam() { if (cam.stream) { cam.stream.getTracks().forEach((t) => t.stop()); cam.stream = null; } const ov = document.getElementById("cam-ov"); if (ov) ov.remove(); }
  async function openCam() {
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camFallback(); return; }
    closeCam();
    const ov = document.createElement("div"); ov.id = "cam-ov"; ov.className = "overlay qr-overlay";
    ov.innerHTML = `<div class="sheet-lite qr-sheet stack"><div class="row qr-head"><b>Foto del Yape/Plin</b><button class="icon-btn" type="button" data-act="cj-cam-close" aria-label="Cerrar">${IC("close", 18)}</button></div>
      <div class="scan-box"><video id="cam-video" playsinline muted autoplay></video></div>
      <p id="cam-msg" class="scan-msg" hidden></p>
      <div class="row" style="gap:6px"><button class="btn grow" type="button" data-act="cj-cam-shot"><i class="fas fa-camera"></i> Capturar</button><button class="btn ghost" type="button" data-act="cj-cam-close">Cancelar</button></div></div>`;
    document.body.appendChild(ov);
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    } catch (e) {
      const m = document.getElementById("cam-msg"); if (m) { m.hidden = false; m.innerHTML = esc(camError(e)) + ` <label class="btn ghost small">Usar la cámara del teléfono<input type="file" accept="image/*" capture="environment" id="cj-proof" hidden></label>`; }
      const shot = ov.querySelector('[data-act="cj-cam-shot"]'); if (shot) shot.disabled = true; return;
    }
    if (!document.getElementById("cam-ov")) { closeCam(); return; }
    const v = document.getElementById("cam-video"); v.srcObject = cam.stream; try { await v.play(); } catch { }
  }
  async function camShot() {
    const v = document.getElementById("cam-video"); if (!v || !v.videoWidth) throw new Error("La cámara aún no está lista");
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.88)); if (!blob) throw new Error("No se pudo tomar la foto");
    closeCam(); await proofDone(new File([blob], "yape-plin.jpg", { type: "image/jpeg" })); D().toast("Foto adjuntada ✓");
  }
  function closeQr(silent) {
    clearTimeout(scan.timer); scan.timer = null;
    if (scan.reader) { try { scan.reader.reset(); } catch { } scan.reader = null; }
    if (scan.stream) { scan.stream.getTracks().forEach((t) => t.stop()); scan.stream = null; }
    const ov = document.getElementById("scan-ov"); if (ov) ov.remove();
    if (scan.sink && !silent) { scan.sink = null; D().render(); return; }
    if (!silent && scan.added.length) { scan.added = []; D().render(); }
  }

  // reportes
  const limaHour = (t) => { try { return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Lima" }).format(new Date(t))) % 24; } catch { return new Date(t).getHours(); } };
  function daySvg(sales) {
    const byH = {}; sales.forEach((s) => { const h = limaHour(s.sold_at); if (!Number.isNaN(h)) byH[h] = (byH[h] || 0) + Number(s.total_cents || 0); });
    const hs = Object.keys(byH).map(Number);
    if (!hs.length) return `<p class="muted day-empty">Aún no hay ventas hoy.</p>`;
    const a = Math.min(...hs), b = Math.max(...hs);
    const hours = []; for (let h = a; h <= b; h += 1) hours.push(h);
    const vals = hours.map((h) => byH[h] || 0);
    const max = Math.max(1, ...vals); const W = 300, top = 14, H = 110, bw = W / Math.max(hours.length, 4); const x0 = (W - bw * hours.length) / 2;
    const lbl = (v) => (v >= 100000 ? "S/" + Math.round(v / 100000) + "k" : "S/" + Math.round(v / 100));
    return `<svg class="day-chart" viewBox="0 0 ${W} ${top + H + 16}" width="100%" role="img" aria-label="Ventas por hora">${vals.map((v, i) => { const h = v ? Math.max(3, Math.round((v / max) * H)) : 2; const x = x0 + i * bw; return `<rect x="${x + 2}" y="${top + H - h}" width="${Math.max(2, bw - 4)}" height="${h}" rx="2" fill="currentColor" opacity="${v ? 0.85 : 0.15}"><title>${hours[i]}:00 · ${soles(v)}</title></rect>${v ? `<text x="${x + bw / 2}" y="${top + H - h - 3}" font-size="7.5" text-anchor="middle" fill="currentColor">${lbl(v)}</text>` : ""}<text x="${x + bw / 2}" y="${top + H + 12}" font-size="8" text-anchor="middle" fill="currentColor" opacity=".7">${hours[i]}</text>`; }).join("")}</svg>`;
  }
  function tabReportes() {
    const today = D().localDay(new Date());
    const all = (data().sales || []).filter((s) => s.store_id === D().ui.storeId).sort((a, b) => String(b.sold_at).localeCompare(String(a.sold_at)));
    const day = all.filter((s) => D().localDay(s.sold_at) === today && s.status === "COMPLETED");
    const total = D().sumCents(day, "total_cents");
    const q = (cj.rq || "").toLowerCase();
    const hist = all.filter((s) => !q || `${s.sale_number} ${s.customer_name} ${s.customer_doc || ""}`.toLowerCase().includes(q)).slice(0, 80);
    return `<div class="stack reports">
      <div class="stats"><article class="stat"><span class="tiny">Ventas de hoy</span><b>${D().moneyHtml(total)}</b></article><article class="stat"><span class="tiny">Comprobantes</span><b><span class="num">${day.length}</span></b></article><article class="stat"><span class="tiny">Ticket promedio</span><b>${D().moneyHtml(day.length ? Math.round(total / day.length) : 0)}</b></article></div>
      <div class="panel chart-panel">${daySvg(day)}</div>
      <div class="panel stack"><div class="row" style="justify-content:space-between"><h3>Historial de comprobantes</h3></div>
        <label class="search-box">${IC("search", 16)}<input id="cj-rq" placeholder="Número, cliente o DNI" value="${esc(cj.rq || "")}"></label>
        <div class="stack receipt-list">${hist.map((s) => `<div class="row receipt-row ${s.status === "VOID" ? "void" : ""}">
          <span class="grow"><b>${esc(s.sale_number)}</b>${s.status === "VOID" ? ` <span class="badge">Anulada${s.credit_note ? " · NC " + esc(s.credit_note) : ""}</span>` : ""}<br><span class="tiny">${esc(D().localDay(s.sold_at))} ${hhmm(s.sold_at)} · ${esc(s.customer_name || "Varios")}</span></span>
          <b class="num">${soles(s.total_cents)}</b>
          <span class="row receipt-acts">
            <button class="btn ghost small" type="button" data-act="cj-pdf" data-id="${esc(s.id)}">${IC("pdf", 16)} PDF</button>
            <button class="btn ghost small" type="button" data-act="cj-rawbt" data-id="${esc(s.id)}" title="Imprimir con RawBT"><i class="fas fa-print"></i> RawBT</button>
            <button class="btn ghost small wa-btn" type="button" data-act="cj-wa-receipt" data-id="${esc(s.id)}">${IC("wa", 16)} WhatsApp</button>
            ${s.status === "COMPLETED" && D().allow(["SUPERVISOR"]) ? `<button class="btn danger small" type="button" data-act="cj-void" data-id="${esc(s.id)}">Anular</button>` : ""}
          </span></div>`).join("") || `<p class="muted">Sin comprobantes.</p>`}</div>
        <p class="tiny">Anular no borra el comprobante: SUNAT no permite eliminarlo. Se emite una nota de crédito y se devuelve el stock.</p></div></div>`;
  }
  // PDF 80 mm (jsPDF) · WhatsApp · RawBT
  // comprobante → modelo para modules/impresion
  function itemDesc(i) { const p = D().byId("products", i.product_id) || {}; return [p.name || "Prenda", p.size_label ? "T." + p.size_label : "", p.color || ""].filter(Boolean).join(" "); }
  function receiptModel(sale) {
    return { sale, biz: BIZ(), st: D().byId("stores", sale.store_id) || {}, doc: DOCS[sale.doc_type || "BOLETA"] || DOCS.BOLETA, when: fecha(sale.sold_at) + " " + hhmm(sale.sold_at),
      items: saleItems(sale).map((i) => ({ quantity: i.quantity, desc: itemDesc(i), unit_price_cents: i.unit_price_cents, line_total_cents: i.line_total_cents })),
      pays: payList(sale).map((p) => ({ label: D().PAY[p.method] || p.method, cents: p.cents })) };
  }
  const ticketPdf = (sale) => window.DL_Print.ticketPdf(receiptModel(sale));
  const rawbtText = (sale, cols) => window.DL_Print.rawbtText(receiptModel(sale), cols);
  function salePhone(s) { const cus = s.customer_id && D().byId("customers", s.customer_id); return ((cj.salePhone || {})[s.id] || (cus && cus.phone) || "").replace(/\D/g, ""); }
  function waNum(p) { p = String(p || "").replace(/\D/g, ""); return p.length === 9 ? "51" + p : p; }
  function downloadFile(file) { const u = URL.createObjectURL(file); const a = document.createElement("a"); a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  async function sharePdf(id, withWa) {
    const s = D().byId("sales", id); if (!s) return;
    const file = await ticketPdf(s); const text = ticketText(s);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: s.sale_number, text: withWa ? text : undefined }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    downloadFile(file);
    if (withWa) { const ph = waNum(salePhone(s)); window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(text + "\n\nTe adjunto tu comprobante en PDF."), "_blank"); D().toast("PDF descargado: adjúntalo en el chat de WhatsApp"); }
    else D().toast("PDF descargado");
  }
  async function waReceipt(id) {
    const s = D().byId("sales", id); if (!s) return;
    if (!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] }))) {
      const phone = (await DL_UI.prompt("WhatsApp del cliente (opcional)", salePhone(s)) ?? null); if (phone === null) return;
      const d = phone.replace(/\D/g, ""); if (d && !/^(51)?9\d{8}$/.test(d)) throw new Error("Revisa el número: 9 dígitos que empiezan con 9");
      cj.salePhone = cj.salePhone || {}; cj.salePhone[s.id] = d;
    }
    await sharePdf(id, true);
  }
  function rawbtPrint(id) {
    const s = D().byId("sales", id); if (!s) return;
    let cols = 0; try { cols = Number(localStorage.getItem("dl-rawbt-cols")) || 0; } catch { } // v34: 0 = usa la plantilla de impresión (o 32)
    const txt = rawbtText(s, cols);
    const android = /android/i.test(navigator.userAgent);
    const url = window.DL_Print.rawbtUrl(txt, android);
    location.href = url;
    if (!android) D().toast("Si no se abre RawBT, usa “PDF / Compartir” y elige RawBT");
  }

  // v9 · Admin › Mayoristas: clientes mayoristas y precios especiales
  const ws = { q: "", open: null, prices: null, pq: "" };
  function wholesaleCustomers() {
    const can = D().allow(["SUPERVISOR"]); const q = ws.q.trim().toLowerCase();
    const all = (data().customers || []).filter((c) => !q || `${c.name} ${c.document_number || ""} ${c.phone || ""}`.toLowerCase().includes(q));
    const list = all.sort((a, b) => (b.is_wholesale - a.is_wholesale) || String(a.name).localeCompare(String(b.name), "es")).slice(0, 60);
    const mny = (c) => (c == null ? "" : (c / 100).toFixed(2));
    const pricesHtml = (c) => {
      if (ws.open !== c.id) return "";
      if (!ws.prices) return `<p class="tiny">Cargando precios…</p>`;
      const pq = ws.pq.trim().toLowerCase();
      const vars = (data().products || []).filter((p) => !p.deleted_at && (!pq || `${p.name} ${p.size_label} ${p.sku}`.toLowerCase().includes(pq) || ws.prices[p.id] != null)).slice(0, 80);
      return `<div class="stack ws-prices"><input id="ws-pq" placeholder="Filtrar pieza, talla o SKU" value="${esc(ws.pq)}">
        <div class="table-wrap"><table class="grid-edit"><thead><tr><th>Pieza</th><th>Normal</th><th>Mayor</th><th>Especial</th></tr></thead><tbody>
        ${vars.map((p) => `<tr><td>${esc(p.name)}<br><span class="tiny">T. ${esc(p.size_label || "—")} · ${esc(p.sku || "")}</span></td><td class="num">${soles(D().priceOf(p).unit)}</td><td class="num">${p.wholesale_price_cents ? soles(p.wholesale_price_cents) : "—"}</td>
          <td><input class="money" inputmode="decimal" data-wsp="${esc(p.id)}" data-orig="${mny(ws.prices[p.id])}" value="${mny(ws.prices[p.id])}" placeholder="—" ${can ? "" : "disabled"}></td></tr>`).join("")}
        </tbody></table></div><p class="tiny">Deja vacío para quitar el precio especial. El especial manda sobre el precio mayorista.</p>
        ${can ? `<button class="btn small" type="button" data-act="ws-save" data-id="${esc(c.id)}">Guardar precios especiales</button>` : ""}</div>`;
    };
    return `<div class="panel stack ws-panel"><h3>Clientes mayoristas</h3>
      <input id="ws-q" placeholder="Buscar cliente por nombre, DNI/RUC o celular" value="${esc(ws.q)}">
      <div class="stack">${list.map((c) => `<div class="ws-row ${c.is_wholesale ? "on" : ""}">
        <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><span class="grow"><b>${esc(c.name || "Cliente")}</b> ${c.is_wholesale ? `<span class="badge tag-mayorista">Mayorista</span>` : ""}<br><span class="tiny">${esc([c.document_type, c.document_number].filter(Boolean).join(" ") || "Sin documento")}${c.phone ? " · " + esc(c.phone) : ""}</span></span>
        ${can ? `<button class="btn ${c.is_wholesale ? "ghost" : ""} small" type="button" data-act="ws-toggle" data-id="${esc(c.id)}">${c.is_wholesale ? "Quitar mayorista" : "Marcar mayorista"}</button>` : ""}</div>
        ${c.is_wholesale ? `<div class="row ws-mode" role="group" aria-label="Precio que se le cobra" style="gap:6px;justify-content:flex-start">${[["mayor", "Precio mayorista"], ["normal", "Precio normal"]].map(([m, l]) => `<button type="button" class="chip ${(c.wholesale_mode || "mayor") === m ? "on" : ""}" data-act="ws-mode" data-id="${esc(c.id)}" data-mode="${m}" ${can ? "" : "disabled"}>${l}</button>`).join("")}</div>` : ""}
        <button class="link-btn forgot-link" type="button" data-act="ws-open" data-id="${esc(c.id)}" style="align-self:flex-start">${ws.open === c.id ? "Ocultar precios especiales" : "Precios especiales por prenda"}</button>
        ${pricesHtml(c)}</div>`).join("") || `<p class="muted">No hay clientes${q ? " con ese filtro" : ""}.</p>`}
      ${all.length > list.length ? `<p class="tiny">Mostrando ${list.length} de ${all.length}. Usa el buscador.</p>` : ""}</div></div>`;
  }
  window.DL_rawbtText = (id, cols) => rawbtText(D().byId("sales", id), cols);
  window.DL_wholesaleCustomers = () => (REMOTE() ? wholesaleCustomers() : "");
  async function wsReload() { await D().reload(); D().render(); }

  // registro
  window.DL_SCREENS = Object.assign(window.DL_SCREENS || {}, { caja: renderCaja });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "cj-tab": (el) => { if (cj.tab === "cuadre" && el.dataset.id !== "cuadre") cj.authBy = null; cj.tab = el.dataset.id; cj.ov = null; D().render(); },
    "cj-cat": (el) => { cj.cat = el.dataset.id; const box = document.getElementById("cj-list"); if (box) { box.innerHTML = productRows(); document.querySelectorAll('[data-act="cj-cat"]').forEach((b) => b.classList.toggle("on", b.dataset.id === cj.cat)); } },
    "cj-add": (el) => { addToCart(el.dataset.id); const c = document.getElementById("cj-cart"); if (c) c.innerHTML = cartHtml(); D().toast("Agregado"); },
    "cj-qty": (el) => { const l = cj.cart[Number(el.dataset.i)]; l.qty += Number(el.dataset.d); if (l.qty < 1) cj.cart.splice(Number(el.dataset.i), 1); document.getElementById("cj-cart").innerHTML = cartHtml(); },
    "cj-pay": (el) => { cj.pay = el.dataset.id; if (cj.pay === "MIXTO" && !mixSum()) cj.mix = { CASH: cartTotal() }; document.getElementById("cj-cart").innerHTML = cartHtml(); },
    "cj-clear": () => { cj.cart = []; document.getElementById("cj-cart").innerHTML = cartHtml(); },
    "cj-sell": () => sell(),
    "cj-doc": (el) => { cj.doc = el.dataset.id; document.getElementById("cj-cart").innerHTML = cartHtml(); },
    "cj-proof-del": () => { cj.proof = null; const c = document.getElementById("cj-cart"); if (c) c.innerHTML = cartHtml(); else D().render(); },
    "ntf-order": async (el) => { const n = D().byId("notifications", el.dataset.id); if (n && n.store_id && n.store_id !== D().ui.storeId) setStore(n.store_id); cj.ov = null; cj.tab = "pedidos"; const api = D().Store.v2api; if (api && api.orders) D().state.orders = await api.orders().catch(() => D().state.orders); D().render(); },
    "cj-ov": (el) => {
      if (el.dataset.id === "bell") {
        const ids = unread().map((n) => n.id); cj.bellNew = ids; cj.ov = "bell"; D().render();
        if (ids.length && REMOTE()) D().Store.v2api.markRead(null).then(() => { const id = me().id; (data().notifications || []).forEach((n) => { if (!(n.read_by || []).includes(id)) n.read_by = (n.read_by || []).concat([id]); }); syncBell(); }).catch(() => {});
        return;
      } if (el.dataset.id !== "registro" || !String(cj.ov || "").startsWith("proof:")) cj.regDay = cj.regDay || ""; cj.ov = el.dataset.id; D().render(); },
    "cj-ov-close": () => { cj.ov = null; D().render(); },
    "cj-proof-view": (el) => { cj.ov = "proof:" + el.dataset.id; D().render(); },
    "cj-proof-share": async (el) => { const s = D().byId("sales", el.dataset.id); await shareWa(`Pago ${s.sale_number} · ${soles(s.total_cents)} · ${payList(s).map((p) => D().PAY[p.method]).join("+")}`, dataUrlFile(s.pay_proof, s.sale_number + "-pago.jpg")); },
    "cj-csv-day": () => { const day = cj.regDay || D().localDay(new Date()); const rows = exportRows((data().sales || []).filter((s) => s.store_id === D().ui.storeId && D().localDay(s.sold_at) === day)); if (rows.length < 2) throw new Error("No hay ventas"); downloadCsv(rows, "ventas-" + day + ".csv"); },
    "cj-wa-day": async () => { const ses = mySession(); const list = ses ? sessionSales(ses.id).filter((s) => s.status === "COMPLETED") : []; const exp = ses ? expected(ses) : {}; const txt = [`*${BIZ().name}* · ${D().nameOf("stores", D().ui.storeId)}`, `Resumen de caja ${fecha(new Date().toISOString())} · ${me().full_name}`, `Ventas: ${list.length} · ${soles(D().sumCents(list, "total_cents"))}`, ...PAYS.map(([k, l]) => `${l}: ${soles(exp[k] || 0)}`)].join("\n"); await shareWa(txt); },
    "cj-auth-end": () => { cj.authBy = null; D().render(); },
    "ntf-read": async (el) => { const n = D().byId("notifications", el.dataset.id); await D().Store.update("notifications", n.id, { read_by: (n.read_by || []).concat([me().id]) }); await D().reload(); D().render(); },
    "ntf-all": async () => { if (REMOTE()) { await D().Store.v2api.markRead(null); await D().reload(); D().render(); return; } for (const n of unread()) await D().Store.update("notifications", n.id, { read_by: (n.read_by || []).concat([me().id]) }); await D().reload(); D().render(); },
    "ntf-go": async (el) => { const n = D().byId("notifications", el.dataset.id); if (!(n.read_by || []).includes(me().id)) await D().Store.update("notifications", n.id, { read_by: (n.read_by || []).concat([me().id]) }); if (n.store_id && n.store_id !== D().ui.storeId) setStore(n.store_id); cj.ov = null; cj.tab = "traslados"; await D().reload(); D().render(); },

    "cj-layaway": () => createLayaway(),
    "cj-ticket": (el) => { cj.last = el.dataset.id; D().render(); },
    "cj-ticket-close": () => { cj.last = null; D().render(); },
    "cj-print": (el) => printTicket(el.dataset.id),
    "cj-cam": () => openCam(),
    "cj-cam-shot": () => camShot(),
    "cj-cam-close": () => closeCam(),
    "ws-toggle": async (el) => { const c = D().byId("customers", el.dataset.id); await D().Store.v2api.setCustomerWholesale(c.id, !c.is_wholesale, c.wholesale_mode || "mayor"); cj.priceCache = {}; await wsReload(); D().toast(c.is_wholesale ? "Ya no es mayorista" : "Marcado como mayorista"); },
    "ws-mode": async (el) => { await D().Store.v2api.setCustomerWholesale(el.dataset.id, true, el.dataset.mode); cj.priceCache = {}; await wsReload(); D().toast("Modo actualizado"); },
    "ws-open": async (el) => { if (ws.open === el.dataset.id) { ws.open = null; D().render(); return; } ws.open = el.dataset.id; ws.prices = null; ws.pq = ""; D().render(); ws.prices = await D().Store.v2api.customerPrices(el.dataset.id).catch((e) => { D().toast(e.message); return {}; }); D().render(); },
    "ws-save": async (el) => {
      const cid = el.dataset.id; let n = 0;
      for (const inp of document.querySelectorAll("[data-wsp]")) {
        if (inp.value.trim() === inp.dataset.orig) continue;
        const v = inp.value.trim(); const cents = v === "" ? null : Math.round(Number(v.replace(",", ".")) * 100);
        if (cents != null && !(cents > 0)) throw new Error("Precio inválido: " + v);
        await D().Store.v2api.setCustomerPrice(cid, inp.dataset.wsp, cents); n += 1;
      }
      cj.priceCache = {}; ws.prices = await D().Store.v2api.customerPrices(cid).catch(() => ws.prices); D().render(); D().toast(n ? n + " precio(s) guardado(s)" : "Sin cambios");
    },
    "cj-pdf": (el) => sharePdf(el.dataset.id, false),
    "cj-rawbt": (el) => rawbtPrint(el.dataset.id),
    "cj-share": (el) => waReceipt(el.dataset.id),
    "cj-csv": () => { const rows = exportRows(exportSales()); if (rows.length < 2) throw new Error("No hay ventas"); downloadCsv(rows, "boletas-" + D().localDay(new Date()) + ".csv"); },
    "cj-copy": async () => { const rows = exportRows(exportSales()); if (rows.length < 2) throw new Error("No hay ventas"); await navigator.clipboard.writeText(rows.map((r) => r.join("\t")).join("\n")); D().toast("Copiado (pégalo en la hoja o sistema)"); },
    "cj-req": (el) => requestTransfer(el.dataset.id, el.dataset.from),
    "cj-qt": (el) => qtOpen(el.dataset.id, el.dataset.from),
    "tr-flag": (el) => flagTransfer(el.dataset.id),
    "tr-send": (el) => moveTransfer(el.dataset.id, "ENVIADO"),
    "tr-recv": (el) => moveTransfer(el.dataset.id, "RECIBIDO"),
    "tr-cancel": async (el) => { if (REMOTE()) { const why = (await DL_UI.prompt("Motivo del rechazo") || "").trim(); if (!why) throw new Error("Indica el motivo"); await D().Store.v2api.rejectTransfer(el.dataset.id, why); await D().reload(); D().render(); D().toast("Solicitud rechazada"); return; } await D().Store.update("transfers", el.dataset.id, { status: "CANCELADO" }); await D().reload(); D().render(); },
    "lay-pay": (el) => layPay(el.dataset.id),
    "lay-done": (el) => layDone(el.dataset.id),
    "lay-cancel": (el) => layCancel(el.dataset.id),
    "cj-qr": () => { scan.sink = null; return openQr(); },
    "cj-counter": (el) => { const row = el.closest(".counter-row"); const on = !row.classList.contains("collapsed"); row.classList.toggle("collapsed", on); el.setAttribute("aria-expanded", String(!on)); try { localStorage.setItem("dl-counter-collapsed", on ? "1" : "0"); } catch { } },
    "cj-cust-find": () => custLookup(),
    "cj-wa-receipt": (el) => waReceipt(el.dataset.id),
    "cj-void": async (el) => { if (!await DL_UI.confirm("Al anular se emite una nota de crédito y se devuelve el stock. El comprobante no se borra. ¿Continuar?")) return; await window.DLCaja.voidSale(el.dataset.id); D().render(); },
    "cj-qr-close": () => closeQr(),
    "cj-scan-manual": () => { const i = document.getElementById("scan-manual"); if (i && i.value.trim()) { scan.last = ""; onCode(i.value); i.value = ""; i.focus(); } },
    "att-in": async () => { const u = me(); if (openAttendance(u.id)) return; await D().Store.insert("attendance", { id: D().nid("att"), staff_id: u.id, store_id: D().ui.storeId || null, check_in: new Date().toISOString(), check_out: null }); await D().reload(); D().render(); D().toast("Entrada " + hhmm(new Date().toISOString())); },
    "att-out": async () => { const a = openAttendance(me().id); if (!a) return; if (mySession() && !await DL_UI.confirm("Tu caja sigue abierta. ¿Marcar salida igual?")) return; await D().Store.update("attendance", a.id, { check_out: new Date().toISOString() }); await D().reload(); D().render(); D().toast("Salida registrada"); },
  });
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, {
    "cj-qt": (form) => qtGo(form),
    "cj-open": async (form) => { const sel = form.elements.store_today; if (sel && sel.value) { const [sid, rid] = sel.value.split(":"); D().ui.storeId = sid; D().ui.cashRegister = rid || null; } await window.DLCaja.openCash(money(form.elements.opening.value)); D().render(); D().toast("Caja abierta"); },
    "cj-close": (form) => closeCaja(form),
    "cj-auth": async (form) => { const who = await D().Store.verifyCredentials(form.elements.email.value, form.elements.password.value); if (!canCuadre(who)) throw new Error(who.full_name + " no tiene permiso para cuadrar caja"); cj.authBy = { id: who.id, name: who.full_name, at: Date.now() }; D().render(); D().toast("Autorizado por " + who.full_name); },
  });
  const prevInput = window.DL_INPUT;
  window.DL_INPUT = function (e) {
    if (prevInput && prevInput(e)) return true;
    const id = e.target.id;
    if (id === "cj-q") { cj.q = e.target.value; document.getElementById("cj-list").innerHTML = productRows(); return true; }
    if (id === "cj-sq") { cj.sq = e.target.value; const pos = e.target.selectionStart; D().render(); const b = document.getElementById("cj-sq"); b.focus(); b.setSelectionRange(pos, pos); return true; }
    if (id === "cj-aq") { cj.aq = e.target.value; document.getElementById("cj-alist").innerHTML = window.DL_layawaysList(cj.aq, false); return true; }
    if (id === "cj-pq") { cj.pq = e.target.value; const pos = e.target.selectionStart; D().render(); const b = document.getElementById("cj-pq"); b.focus(); b.setSelectionRange(pos, pos); return true; }
    if (id === "cj-cname") { cj.cust.name = e.target.value; return true; }
    if (id === "cj-cdoc") { cj.cust.doc = e.target.value.replace(/\D/g, ""); const st = document.getElementById("cj-cust-status"); if (st) st.innerHTML = custStatus(); const fc = findCustomer(cj.cust.doc); if (fc && (!cj.cust.name || cj.cust.id !== fc.id)) custLookup(); else if (!fc && cj.cust.id) { setCustomer(null); const c = document.getElementById("cj-cart"); if (c) { const pos = e.target.selectionStart; c.innerHTML = cartHtml(); const n = document.getElementById("cj-cdoc"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } } return true; }
    if (id === "cj-rq") { cj.rq = e.target.value; const pos = e.target.selectionStart; D().render(); const b = document.getElementById("cj-rq"); if (b) { b.focus(); b.setSelectionRange(pos, pos); } return true; }
    if (id === "cj-caddr") { cj.cust.address = e.target.value; return true; }
    if (id === "ws-q" || id === "ws-pq") { ws[id === "ws-q" ? "q" : "pq"] = e.target.value; const pos = e.target.selectionStart; D().render(); const b = document.getElementById(id); if (b) { b.focus(); b.setSelectionRange(pos, pos); } return true; }
    if (id === "cj-rawbt-cols") { try { localStorage.setItem("dl-rawbt-cols", e.target.value); } catch { } return true; }
    if (id === "cj-cphone") { cj.cust.phone = e.target.value; return true; }
    if (e.target.dataset && e.target.dataset.mix) { cj.mix[e.target.dataset.mix] = money(e.target.value); const l = document.getElementById("mix-left"); if (l) l.textContent = mixLeft(cartTotal()); if (!!needsProof() !== !!document.querySelector("#cj-cart .proof")) { const k = e.target.dataset.mix, pos = e.target.selectionStart; document.getElementById("cj-cart").innerHTML = cartHtml(); const n = document.querySelector(`[data-mix="${k}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } } return true; }
    if (e.target.dataset && e.target.dataset.cjPrice !== undefined) { const l = cj.cart[Number(e.target.dataset.cjPrice)]; if (l) { l.unit = money(e.target.value); const tr = document.querySelector("#cj-cart .total-row b"); if (tr) tr.textContent = soles(cartTotal()); } return true; }
    if (e.target.closest && e.target.closest('[data-form="cj-close"]')) { updateDiff(); return true; }
    return false;
  };
  const prevChange = window.DL_CHANGE;
  window.DL_CHANGE = function (e) {
    if (prevChange && prevChange(e)) return true;
    if ((e.target.id === "cj-proof" || e.target.id === "cj-proof-g") && e.target.files[0]) { (closeCam(), proofDone(e.target.files[0])).catch((err) => D().toast(err.message)); return true; }
    if (e.target.id === "cj-doc-sel") { cj.doc = e.target.value; if (cj.doc === "GUIA") cj.doc = "BOLETA"; cj.cust.doc = ""; document.getElementById("cj-cart").innerHTML = cartHtml(); return true; }
    if (e.target.id === "cj-pay-sel") { cj.pay = e.target.value; if (cj.pay === "MIXTO" && !mixSum()) cj.mix = { CASH: cartTotal() }; document.getElementById("cj-cart").innerHTML = cartHtml(); return true; }
    if (e.target.id === "cj-regday") { cj.regDay = e.target.value; D().render(); return true; }
    if (e.target.id === "cj-store") { const v = e.target.value; if (mySession()) { DL_UI.confirm("Tienes una caja abierta en otra tienda. ¿Cambiar de vista?", { ok: "Cambiar", danger: false }).then((ok) => { if (ok) setStore(v); D().render(); }); return true; } setStore(v); D().render(); return true; }
    if (e.target.dataset && e.target.dataset.cjPrice !== undefined) { document.getElementById("cj-cart").innerHTML = cartHtml(); return true; }
    return false;
  };
  (window.DL_AFTER = window.DL_AFTER || []).push(updateDiff);
  window.addEventListener("hashchange", () => closeQr(true));
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.id === "scan-manual") { e.preventDefault(); scan.last = ""; onCode(e.target.value); e.target.value = ""; } });
})();
