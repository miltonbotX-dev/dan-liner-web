// modules/clientes/clientes.ui.js · Admin › Clientes: buscador en el servidor (30 por página, "Ver más") y ficha con historial.
(function () {
  const D = () => window.DL;
  const esc = (v) => D().esc(v);
  const soles = (c) => D().soles(c);
  const api = () => D().Store.v2api.clientes;
  const cl = { q: "", rows: [], offset: 0, more: false, total: 0, loading: false, sel: null, det: null, err: "", seq: 0, loaded: false };
  const fecha = (t) => (t ? new Date(t).toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric" }) : "—");
  const activity = (t) => { const d = t ? (Date.now() - new Date(t).getTime()) / 864e5 : Infinity; const a = d <= 30 ? 3 : d <= 90 ? 2 : 1; return `<span class="activity a${a}" title="${a === 3 ? "Compró en los últimos 30 días" : a === 2 ? "Compró en los últimos 90 días" : t ? "Sin compras recientes" : "Sin compras"}" aria-label="Actividad ${a} de 3"><i></i><i></i><i></i></span>`; };
  const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
  const STATUS = { COMPLETADA: "Pagada", ANULADA: "Anulada", SEPARADO: "Separado", pendiente: "Pendiente", confirmado: "Confirmado", listo: "Listo", entregado: "Entregado", cancelado: "Cancelado" };

  function rowHtml(r, i) {
    return `<button type="button" class="cust-row" data-act="cl-open" data-i="${i}">
      <span class="avatar" aria-hidden="true">${esc(initials(r.name))}</span>
      <span class="grow" style="min-width:0;text-align:left"><b>${esc(r.name)}</b> ${window.DL_TAGS_HTML && r.tags ? window.DL_TAGS_HTML(r.tags) : r.is_wholesale ? `<span class="tag-mayorista">Mayorista</span>` : ""}
        <span class="meta" style="display:block">${esc([r.username ? "@" + r.username : "", r.document_number ? (r.document_type || "Doc.") + " " + r.document_number : "", r.phone].filter(Boolean).join(" · ") || "Sin datos de contacto")}</span></span>
      <span class="num">${activity(r.last_purchase_at)}<br><b>${soles(r.spent_cents)}</b><br><span class="meta">${r.purchases} compra${r.purchases === 1 ? "" : "s"}</span></span></button>`;
  }
  function listHtml() {
    if (cl.err) return `<p class="alert-text">${esc(cl.err)}</p>`;
    if (!cl.rows.length) return cl.loading || !cl.loaded ? `<p class="muted">Buscando…</p>` : `<p class="muted">${cl.q ? "Ningún cliente coincide con «" + esc(cl.q) + "»." : "Aún no hay clientes."}</p>`;
    return `<p class="tiny">${cl.total ? `Mostrando ${cl.rows.length} de ${cl.total}` : cl.rows.length + " clientes"}</p>` + cl.rows.map(rowHtml).join("")
      + (cl.more ? `<button class="btn ghost" type="button" data-act="cl-more" ${cl.loading ? "disabled" : ""}>${cl.loading ? "Cargando…" : "Ver más"}</button>` : "");
  }
  async function load(reset) {
    const my = ++cl.seq; cl.loading = true; cl.err = "";
    if (reset) { cl.offset = 0; }
    paint();
    try {
      const r = await api().list({ q: cl.q, offset: reset ? 0 : cl.offset, tagIds: window.DL_CL_FILTER ? window.DL_CL_FILTER() : null });
      if (my !== cl.seq) return;
      cl.rows = reset ? r.rows : cl.rows.concat(r.rows); cl.offset = cl.rows.length; cl.more = r.more; cl.total = r.total || 0;
    } catch (e) { if (my === cl.seq) cl.err = e.message || "No se pudo buscar"; }
    if (my === cl.seq) { cl.loading = false; cl.loaded = true; paint(); }
  }
  function paint() { const b = document.getElementById("cust-list"); if (b) b.innerHTML = listHtml(); }

  function detailHtml() {
    const d = cl.det; const r = cl.sel;
    if (!d) return `<button class="btn ghost small" type="button" data-act="cl-back">← Clientes</button><p class="muted">Cargando ficha…</p>`;
    const c = d.customer; const t = d.stats;
    const can = D().allow(["SUPERVISOR", "CAJERO", "VENDEDOR"]);
    return `<button class="btn ghost small" type="button" data-act="cl-back">← Clientes</button>
      <div class="cust-row" style="margin:12px 0"><span class="avatar">${esc(initials(c.name))}</span><span class="grow" style="text-align:left"><b>${esc(c.name)}</b> ${c.is_wholesale ? `<span class="tag-mayorista">Mayorista${c.wholesale_mode === "normal" ? " · precio normal" : ""}</span>` : ""}
        <span class="meta" style="display:block">${esc([c.username ? "@" + c.username : "", c.email].filter(Boolean).join(" · ") || "Sin cuenta web")}</span></span><span class="num">${activity(t.last_purchase_at)}</span>${window.DL_PW_BTN ? window.DL_PW_BTN((r && r.user_id) || c.user_id, c.email, c.name) : ""}</div>
      <div class="stats"><article class="stat"><span class="tiny">Compras</span><b><span class="num">${t.purchases}</span></b></article><article class="stat"><span class="tiny">Total gastado</span><b>${D().moneyHtml(t.spent_cents)}</b></article>
        <article class="stat"><span class="tiny">Ticket promedio</span><b>${D().moneyHtml(t.avg_cents)}</b></article><article class="stat"><span class="tiny">Última compra</span><b style="font-size:16px">${esc(fecha(t.last_purchase_at))}</b></article></div>
      ${c.id ? `<form novalidate class="panel stack" data-form="cl-save" style="margin:12px 0"><h3>Datos del cliente</h3>
        <div class="two"><label>Nombre o razón social<input name="name" value="${esc(c.name)}" required ${can ? "" : "disabled"}></label><label>WhatsApp / celular<input name="phone" type="tel" inputmode="tel" value="${esc(c.phone)}" ${can ? "" : "disabled"}></label></div>
        <div class="two"><label>Documento<select name="document_type" ${can ? "" : "disabled"}>${["DNI", "RUC", "CE"].map((k) => `<option ${c.document_type === k ? "selected" : ""}>${k}</option>`).join("")}</select></label><label>Número<input name="document_number" inputmode="numeric" value="${esc(c.document_number)}" ${can ? "" : "disabled"}></label></div>
        <div class="two"><label>Correo<input name="email" type="email" value="${esc(c.email)}" ${can ? "" : "disabled"}></label><label>Dirección<input name="address" value="${esc(c.address)}" ${can ? "" : "disabled"}></label></div>
        ${can ? `<button class="btn" type="button" data-act="cl-save">Guardar</button>` : ""}${d.special_prices ? `<p class="tiny">${d.special_prices} precio(s) especial(es) en Mayoristas.</p>` : ""}</form>`
      : `<form novalidate class="panel stack" style="margin:12px 0"><h3>Enlazar DNI/RUC</h3><p class="tiny">Esta cuenta web aún no tiene ficha de cliente. Al enlazar su documento, sus compras en tienda aparecen aquí.</p>
        <div class="two"><label>DNI o RUC<input id="cl-link-doc" inputmode="numeric" maxlength="11"></label><label>Nombre<input id="cl-link-name" value="${esc(c.name)}"></label></div>
        <button class="btn" type="button" data-act="cl-link">Enlazar</button></form>`}
      ${window.DL_CL_EXT && c.id ? window.DL_CL_EXT.detailHtml(c, r) : ""}
      <div class="panel stack"><h3>Comprobantes</h3><div class="cust-history">${(d.sales || []).map((s) => `<div class="row"><span><b>${esc(s.number)}</b>${s.by_dni ? ` <span class="tiny">(por DNI)</span>` : ""}<br><span class="tiny">${esc(fecha(s.sold_at))}${s.store_name ? " · " + esc(s.store_name) : ""} · ${esc(STATUS[s.status] || s.status)}</span></span><b class="num">${soles(s.total_cents)}</b></div>`).join("") || `<p class="muted">Sin comprobantes.</p>`}</div></div>
      <div class="panel stack" style="margin-top:12px"><h3>Pedidos web</h3><div class="cust-history">${(d.orders || []).map((o) => `<div class="row"><span><b>${esc(o.code || "#" + o.id)}</b><br><span class="tiny">${esc(fecha(o.created_at))}${o.store_name ? " · " + esc(o.store_name) : ""} · ${esc(STATUS[o.status] || o.status)}</span></span><b class="num">${soles(o.total_cents)}</b></div>`).join("") || `<p class="muted">Sin pedidos web.</p>`}</div></div>`;
  }
  function render() {
    if (!D().allow(["SUPERVISOR", "CAJERO", "VENDEDOR"])) return `<p class="muted">Tu rol no ve clientes.</p>`;
    if (cl.sel) return detailHtml();
    if (!cl.loaded && !cl.loading) setTimeout(() => load(true), 0);
    return `<div class="cust-search"><input id="cl-q" type="search" autocomplete="off" spellcheck="false" placeholder="Buscar por nombre, @usuario, DNI/RUC o celular" value="${esc(cl.q)}" aria-label="Buscar clientes"></div>
      ${window.DL_CL_EXT ? window.DL_CL_EXT.filterHtml() : ""}
      <div class="cust-list" id="cust-list">${listHtml()}</div>`;
  }
  async function openRow(r) {
    cl.sel = r; cl.det = null; D().render(); window.scrollTo(0, 0);
    try {
      cl.det = r.id ? await api().detail(r) : { customer: r, stats: { purchases: 0, spent_cents: 0, avg_cents: 0, last_purchase_at: null }, sales: [], orders: (await D().Store.v2api.orders("&user_id=eq." + r.user_id).catch(() => [])).map((o) => ({ id: o.id, code: o.code, status: o.status, total_cents: o.total_cents, created_at: o.created_at })) };
    } catch (e) { cl.sel = null; D().render(); throw e; }
    D().render();
  }
  window.DL_renderClientes = render;
  window.DL_CL_RELOAD = () => { cl.loaded = false; cl.rows = []; load(true); };
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "cl-open": (el) => openRow(cl.rows[Number(el.dataset.i)]),
    "cl-back": () => { cl.sel = null; cl.det = null; D().render(); },
    "cl-more": () => load(false),
    "cl-save": async (el) => {
      const f = el.closest("form"); const v = (n) => f.elements[n].value.trim();
      const doc = v("document_number").replace(/\D/g, ""); const type = v("document_type");
      if (doc && type === "DNI" && doc.length !== 8) throw new Error("El DNI debe tener 8 dígitos");
      if (doc && type === "RUC" && doc.length !== 11) throw new Error("El RUC debe tener 11 dígitos");
      await api().save(cl.sel.id, { name: v("name"), phone: v("phone").replace(/[^\d+]/g, ""), document_type: doc ? type : "", document_number: doc, email: v("email"), address: v("address") });
      cl.det = await api().detail(cl.sel); cl.loaded = false; D().render(); D().toast("Cliente guardado ✓");
    },
    "cl-link": async () => {
      const doc = document.getElementById("cl-link-doc").value.replace(/\D/g, ""); const name = document.getElementById("cl-link-name").value.trim();
      if (!/^(\d{8}|\d{11})$/.test(doc)) throw new Error("Escribe un DNI (8 dígitos) o RUC (11 dígitos)");
      const id = await api().linkAccount(cl.sel.user_id, { document_number: doc, name: name || cl.sel.name, phone: cl.sel.phone });
      cl.loaded = false; await openRow(Object.assign({}, cl.sel, { id: String(id), account_only: false })); D().toast("Documento enlazado ✓");
    },
  });
  let timer = null;
  const prev = window.DL_INPUT;
  window.DL_INPUT = function (e) {
    if (e.target && e.target.id === "cl-q") { cl.q = e.target.value; clearTimeout(timer); timer = setTimeout(() => load(true), 300); return true; }
    return prev ? prev(e) : false;
  };
  // Equipo › list_staff: índice { user_id: fila } (se carga una vez por sesión; null mientras carga o si falla)
  const st = { by: null, loading: false, uid: null, failed: false };
  window.DL_STAFF_LIST = () => {
    const u = D().state.user; if (!u || D().Store.mode !== "remote") return null;
    if (st.uid !== u.id) { st.by = null; st.uid = u.id; }
    if (!st.by && !st.loading && !st.failed) { st.loading = true; api().staff("", 0).then((rows) => { st.by = Object.fromEntries(rows.map((r) => [String(r.id), r])); }).catch(() => { st.by = null; st.failed = true; }).finally(() => { st.loading = false; if (st.by && D().ui.admin === "staff") D().render(); }); }
    return st.by;
  };
})();
