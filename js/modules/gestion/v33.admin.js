// modules/gestion/v33.admin.js · BD v18 (API_V18.md §4–7): Comprobantes (+ CSV para el contador), Sistema (uso de almacenamiento,
// PIN de cierre en todas las tiendas), Roles y permisos, Textos de la tienda (carrito, cambios, fechas de llegada por color)
// y perfil extra (departamento + foto). Estilos: «v33 · IU» en app.css (.storage-meter, .perm-grid, .user-chip).
(function () {
  const D = () => window.DL;
  const S = () => window.Store;
  const K = () => window.DL33;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const remote = () => S() && S().mode === "remote";
  const soles = (n) => "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const roles = () => (D() && D().myRoles ? D().myRoles() : []) || [];
  const isAdmin = () => roles().includes("ADMIN");
  const canDocs = () => isAdmin() || roles().includes("CONTADOR");
  const TYPE = { BOLETA: "Boleta", FACTURA: "Factura", NOTA_VENTA: "Nota de venta", TICKET: "Ticket" };
  const METHOD = { EFECTIVO: "Efectivo", TARJETA: "Tarjeta", YAPE: "Yape", PLIN: "Plin", TRANSFERENCIA: "Transferencia", MIXTO: "Mixto" };
  const fmtBytes = (b) => { const n = Number(b || 0); if (n >= 1073741824) return (n / 1073741824).toFixed(2) + " GB"; if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB"; if (n >= 1024) return Math.round(n / 1024) + " KB"; return n + " B"; };
  const monthStart = () => K().todayLima().slice(0, 8) + "01";

  // ---------- Comprobantes (get_documents / get_documents_export) ----------
  const DOC = { f: null, page: 0, loaded: false, data: null, err: "", key: "" };
  const PAGE = 50;
  function docFilters() { if (!DOC.f) DOC.f = { from: monthStart(), to: K().todayLima(), type: "", store: "" }; return DOC.f; }
  function docArgs() { const f = docFilters(); return { p_from: f.from || null, p_to: f.to || null, p_type: f.type || null, p_store: f.store ? Number(f.store) : null }; }
  function loadDocs() {
    const key = JSON.stringify([docArgs(), DOC.page]);
    if (DOC.key === key && (DOC.loaded || K().busy.v33docs)) return;
    DOC.key = key; DOC.loaded = false;
    setTimeout(() => K().once("v33docs", () => K().rpc("get_documents", Object.assign(docArgs(), { p_limit: PAGE, p_offset: DOC.page * PAGE })), DOC), 0);
  }
  function storeOpts(f, items) {
    const st = (D().state.data && D().state.data.stores) || [];
    const list = st.length ? st.map((s) => [String(s.id), s.name]) : [];
    (items || []).forEach((x) => { if (x.store_id && !list.some(([id]) => id === String(x.store_id))) list.push([String(x.store_id), x.store_name || "Tienda " + x.store_id]); });
    return `<option value="">Todas</option>` + list.map(([id, n]) => `<option value="${esc(id)}"${f.store === id ? " selected" : ""}>${esc(n)}</option>`).join("");
  }
  function docsPanel() {
    if (!remote()) return `<p class="muted">Conecta la base de datos para ver comprobantes.</p>`;
    if (!canDocs()) return `<p class="muted">Solo el administrador o el contador ven los comprobantes.</p>`;
    const f = docFilters(); loadDocs();
    const d = DOC.data || {}; const sm = d.summary || {}; const items = d.items || []; const total = Number(d.total_count || 0);
    const byType = Object.entries(sm.by_type || {}).map(([t, v]) => `<span class="chip">${esc(TYPE[t] || t)}: ${Number(v.count || 0)} · ${soles(v.total)}</span>`).join("");
    const byMethod = Object.entries(sm.by_method || {}).map(([m, v]) => `<span class="chip">${esc(METHOD[m] || m)}: ${soles(v)}</span>`).join("");
    const rows = items.map((x) => `<tr class="${x.status === "ANULADO" || x.sale_status === "ANULADA" ? "is-void" : ""}">
        <td>${esc(String(x.fecha || x.issued_at || "").slice(0, 10))}</td><td>${esc(TYPE[x.document_type] || x.document_type)}<br><b>${esc(x.series_number)}</b></td>
        <td>${esc(x.customer_name || "Cliente varios")}${x.customer_doc ? `<br><span class="tiny muted">${esc(x.customer_doc_type || "")} ${esc(x.customer_doc)}</span>` : ""}</td>
        <td class="num">${soles(x.subtotal)}</td><td class="num">${soles(x.igv)}</td><td class="num"><b>${soles(x.total)}</b></td>
        <td>${esc(METHOD[x.payment_method] || x.payment_method || "—")}</td><td>${esc(x.store_name || "")}</td><td>${esc(x.status === "ANULADO" || x.sale_status === "ANULADA" ? "Anulado" : (x.status || ""))}</td></tr>`).join("");
    const pages = Math.max(1, Math.ceil(total / PAGE));
    return `<section class="stack docs33">
      <form class="grid3 docs-filters" data-form="v33-docs" novalidate>
        <label>Desde<input type="date" name="from" value="${esc(f.from)}"></label>
        <label>Hasta<input type="date" name="to" value="${esc(f.to)}"></label>
        <label>Tipo<select name="type"><option value="">Todos</option>${Object.entries(TYPE).map(([k, v]) => `<option value="${k}"${f.type === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>Tienda<select name="store">${storeOpts(f, items)}</select></label>
        <div class="row" style="align-items:end"><button class="btn small" type="submit">Ver</button><button class="btn small ghost" type="button" data-act="v33-docs-csv">Descargar CSV</button></div>
      </form>
      ${DOC.err ? `<p class="alert-text">${esc(DOC.err)}</p>` : ""}
      ${!DOC.loaded && !DOC.data ? `<p class="muted">Cargando comprobantes…</p>` : `
      <div class="stats docs-stats">
        <article class="stat"><span class="tiny">Comprobantes</span><b>${Number(sm.count || 0)}</b>${sm.annulled ? `<span class="tiny muted">${Number(sm.annulled)} anulados</span>` : ""}</article>
        <article class="stat"><span class="tiny">Base imponible</span><b>${soles(sm.subtotal)}</b></article>
        <article class="stat"><span class="tiny">IGV</span><b>${soles(sm.igv)}</b></article>
        <article class="stat"><span class="tiny">Total</span><b>${soles(sm.total)}</b></article>
      </div>
      ${byType ? `<div class="chips">${byType}</div>` : ""}${byMethod ? `<div class="chips">${byMethod}</div>` : ""}
      ${items.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Comprobante</th><th>Cliente</th><th>Subtotal</th><th>IGV</th><th>Total</th><th>Pago</th><th>Tienda</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<p class="muted">No hay comprobantes en este rango.</p>`}
      ${pages > 1 ? `<div class="row"><button class="btn small ghost" type="button" data-act="v33-docs-page" data-id="-1"${DOC.page <= 0 ? " disabled" : ""}>Anterior</button><span class="tiny muted">Página ${DOC.page + 1} de ${pages}</span><button class="btn small ghost" type="button" data-act="v33-docs-page" data-id="1"${DOC.page + 1 >= pages ? " disabled" : ""}>Siguiente</button></div>` : ""}`}
    </section>`;
  }
  const csvCell = (v) => { const t = v == null ? "" : String(v); return /[",;\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  async function downloadCsv() {
    const rows = await K().rpc("get_documents_export", docArgs());
    const cols = ["fecha", "tipo", "serie_numero", "doc_cliente", "cliente", "subtotal", "igv", "total", "forma_pago", "tienda", "estado"];
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return D().toast("No hay comprobantes en este rango.");
    const csv = "\ufeff" + [cols.join(",")].concat(list.map((r) => cols.map((c) => csvCell(r[c])).join(","))).join("\r\n");
    const f = docFilters();
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `comprobantes_${f.from || "inicio"}_${f.to || "hoy"}.csv`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    D().toast(`CSV listo: ${list.length} comprobantes.`);
  }

  // ---------- Sistema (get_storage_usage / set_close_requires_pin_all) ----------
  const SYS = { loaded: false, data: null, err: "" };
  function meter(title, used, limit, pct, note) {
    const p = Math.max(0, Math.min(100, Number(pct || 0)));
    return `<div class="storage-meter"><div class="row" style="justify-content:space-between"><b>${esc(title)}</b><span class="tiny">${fmtBytes(used)} de ${fmtBytes(limit)} · ${p.toFixed(1)}%</span></div>
      <div class="bar${p >= 95 ? " full" : p >= 80 ? " warn" : ""}" style="--pct:${Math.max(p, 1)}%" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}" aria-label="${esc(title)}"><i></i></div>${note ? `<p class="tiny muted">${esc(note)}</p>` : ""}</div>`;
  }
  function sistemaPanel() {
    if (!remote()) return `<p class="muted">Conecta la base de datos.</p>`;
    if (!isAdmin()) return `<p class="muted">Solo el administrador.</p>`;
    if (!SYS.loaded) setTimeout(() => K().once("v33sys", () => K().rpc("get_storage_usage", {}), SYS), 0);
    const u = SYS.data || {}; const db = u.database || {}; const st = u.storage || {};
    const stores = (D().state.data && D().state.data.stores) || [];
    const pinOn = stores.filter((s) => s.close_requires_pin).length;
    return `<section class="stack sys33">
      <h2>Espacio usado</h2>
      ${SYS.err ? `<p class="alert-text">${esc(SYS.err)}</p>` : !SYS.loaded ? `<p class="muted">Calculando…</p>` : `
        ${meter("Base de datos", db.used_bytes, db.limit_bytes, db.percent, "Plan gratuito: 500 MB. Las fotos de productos van en Drive y no ocupan este espacio.")}
        ${st.available === false ? `<p class="tiny muted">El uso de archivos (fotos subidas) no está disponible.</p>` : meter("Archivos subidos", st.used_bytes, st.limit_bytes, st.percent, "Fotos de perfil y QR de pago.")}
        ${(st.buckets || []).length ? `<div class="storage-rows">${st.buckets.map((b) => `<div><span class="tiny muted">${esc(b.bucket || b.name || b.id)}</span><b>${fmtBytes(b.bytes || b.used_bytes)}</b>${b.objects != null ? `<span class="tiny">${Number(b.objects)} archivos</span>` : ""}</div>`).join("")}</div>` : ""}
        ${(u.top_tables || []).length ? `<details><summary>Tablas más grandes</summary><div class="storage-rows">${u.top_tables.slice(0, 10).map((t) => `<div><span class="tiny muted">${esc(t.table || t.name)}</span><b>${fmtBytes(t.total_bytes || t.bytes)}</b>${t.rows_estimate != null ? `<span class="tiny">~${Number(t.rows_estimate)} filas</span>` : ""}</div>`).join("")}</div></details>` : ""}
        <button class="btn small ghost" type="button" data-act="v33-sys-reload">Actualizar</button>`}
      <h2>PIN de cierre de caja</h2>
      <p class="muted">Si lo activas, cada cierre de caja de <b>todas</b> las tiendas pedirá el PIN del encargado, supervisor o administrador.
        ${stores.length ? `Hoy: ${pinOn ? `activo en ${pinOn} de ${stores.length} tiendas` : "desactivado en todas las tiendas"}.` : ""}</p>
      <div class="row" style="justify-content:flex-start"><button class="btn small" type="button" data-act="v33-pin-all" data-id="1">Pedir PIN en todas</button><button class="btn small ghost" type="button" data-act="v33-pin-all" data-id="0">No pedir PIN</button></div>
      <p class="tiny muted">Antes de activarlo, cada encargado debe crear su PIN en Mi cuenta → Mi PIN de cierre.</p>
    </section>`;
  }

  // ---------- Roles y permisos (get_permission_catalog / set_role_permissions) ----------
  const PERM = { loaded: false, data: null, err: "", role: "", draft: null };
  function rolesPanel() {
    if (!remote()) return `<p class="muted">Conecta la base de datos.</p>`;
    if (!isAdmin()) return `<p class="muted">Solo el administrador.</p>`;
    if (!PERM.loaded) setTimeout(() => K().once("v33perm", () => K().rpc("get_permission_catalog", {}), PERM), 0);
    if (PERM.err) return `<p class="alert-text">${esc(PERM.err)}</p>`;
    if (!PERM.loaded) return `<p class="muted">Cargando permisos…</p>`;
    const cat = PERM.data || {}; const rs = (cat.roles || []).filter((r) => r.editable !== false && r.code !== "ADMIN");
    if (!rs.length) return `<p class="muted">No hay roles editables.</p>`;
    if (!PERM.role || !rs.some((r) => r.code === PERM.role)) { PERM.role = rs[0].code; PERM.draft = null; }
    const role = rs.find((r) => r.code === PERM.role);
    if (!PERM.draft) PERM.draft = new Set(role.permissions || []);
    const sections = (cat.sections || []).map((s) => {
      const ps = (s.permissions || []).filter((p) => !p.admin_only);
      if (!ps.length) return "";
      const on = ps.filter((p) => PERM.draft.has(p.code)).length;
      return `<details class="perm-group"${on ? " open" : ""}><summary><b>${esc(s.label || s.section)}</b> <span class="tiny muted">${on}/${ps.length}</span></summary>
        ${s.note ? `<p class="tiny muted">${esc(s.note)}</p>` : ""}
        <div class="perm-list">${ps.map((p) => `<label><input type="checkbox" data-perm33="${esc(p.code)}"${PERM.draft.has(p.code) ? " checked" : ""}><span><b>${esc(p.label || p.code)}</b>${p.description ? `<small>${esc(p.description)}</small>` : ""}</span></label>`).join("")}</div></details>`;
    }).join("");
    return `<section class="stack roles33">
      <p class="muted">Elige un rol y marca lo que puede hacer. El administrador siempre puede todo; algunas acciones son solo suyas y no aparecen aquí.</p>
      <label>Rol<select data-role33>${rs.map((r) => `<option value="${esc(r.code)}"${r.code === PERM.role ? " selected" : ""}>${esc(r.name || r.code)}</option>`).join("")}</select></label>
      ${role.description ? `<p class="tiny muted">${esc(role.description)}</p>` : ""}
      <div class="perm-grid">${sections}</div>
      <div class="row" style="justify-content:flex-start"><button class="btn" type="button" data-act="v33-perm-save">Guardar permisos de ${esc(role.name || role.code)}</button><button class="btn ghost" type="button" data-act="v33-perm-reset">Deshacer cambios</button></div>
    </section>`;
  }

  // ---------- Textos de la tienda (set_storefront_settings) ----------
  const TX = { draft: null };
  function sfv() { return (S() && S().v2 && S().v2.storefront) || {}; }
  function etaRows() {
    const m = sfv().color_eta_manual || {};
    return Object.entries(m && typeof m === "object" ? m : {}).map(([color, text]) => ({ color, text: String(text || "") }));
  }
  function textosPanel() {
    if (!remote()) return `<p class="muted">Conecta la base de datos.</p>`;
    if (!isAdmin()) return `<p class="muted">Solo el administrador.</p>`;
    if (!TX.draft) TX.draft = { cart_note: sfv().cart_note || "", returns_note: sfv().returns_note || "", eta: etaRows() };
    const t = TX.draft;
    if (!t.eta.length) t.eta.push({ color: "", text: "" });
    return `<section class="stack textos33">
      <label>Nota del carrito <span class="tiny muted">(se ve al revisar tu pedido · máx. 500)</span><textarea data-tx33="cart_note" maxlength="500" rows="3" placeholder="Ej.: Los envíos a provincia salen en 24–48 h.">${esc(t.cart_note)}</textarea></label>
      <label>Cambios y devoluciones <span class="tiny muted">(inicio y Ayuda · máx. 500)</span><textarea data-tx33="returns_note" maxlength="500" rows="3" placeholder="Ej.: Cambios de talla dentro de los 7 días con boleta.">${esc(t.returns_note)}</textarea></label>
      <fieldset class="stack"><legend>Llegada de colores del probador</legend>
        <p class="tiny muted">Solo para colores del probador que aún no tienen producto. Si el color ya existe en un producto, se usa su fecha de reposición automáticamente.</p>
        ${t.eta.map((r, i) => `<div class="grid2 eta-row"><label>Color<input data-eta33="${i}" data-k="color" maxlength="60" value="${esc(r.color)}" placeholder="Ej.: Azul noche"></label>
          <label>Texto<input data-eta33="${i}" data-k="text" maxlength="200" value="${esc(r.text)}" placeholder="Ej.: Llega en noviembre"></label>
          <button class="btn small ghost" type="button" data-act="v33-eta-del" data-id="${i}" aria-label="Quitar color">Quitar</button></div>`).join("")}
        ${t.eta.length < 50 ? `<button class="btn small ghost" type="button" data-act="v33-eta-add">+ Agregar color</button>` : ""}
      </fieldset>
      <button class="btn" type="button" data-act="v33-tx-save">Guardar textos</button>
    </section>`;
  }

  // ---------- Perfil extra (update_my_profile_extra) ----------
  const DEPS = ["Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Callao", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad", "Lambayeque", "Lima", "Loreto", "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali"];
  const avatarSrc = (u) => { const src = K().publicUrl(u && u.avatar_url); return src && D().safeSrc ? D().safeSrc(src) : src; };
  function userChip() {
    const u = D().state.user; if (!u) return "";
    const src = avatarSrc(u);
    return `<a class="user-chip" href="#cuenta/perfil">${src ? `<img src="${esc(src)}" alt="" width="40" height="40" loading="lazy">` : `<span class="ava" aria-hidden="true">${esc(String(u.full_name || "?").charAt(0).toUpperCase())}</span>`}
      <span><b>Foto y departamento</b><small>${u.departamento ? esc(u.departamento) : "Agrega tu departamento"}${src ? " · con foto" : ""}</small></span><span aria-hidden="true">›</span></a>`;
  }
  function perfilView() {
    const u = D().state.user; if (!u) return `<p class="muted">Inicia sesión.</p>`;
    const src = avatarSrc(u); const cur = K().norm(u.departamento);
    return `<p class="kicker">Mi cuenta</p><h1>Foto y departamento</h1>
      <form class="stack me-form" data-form="v33-perfil" novalidate>
        <div class="row" style="justify-content:flex-start;gap:16px">${src ? `<img class="avatar-lg" src="${esc(src)}" alt="Tu foto" width="72" height="72">` : `<span class="avatar" aria-hidden="true">${esc(String(u.full_name || "?").charAt(0).toUpperCase())}</span>`}
          <label class="btn small ghost">Elegir foto<input type="file" accept="image/*" data-avatar33 hidden></label>${src ? `<button class="btn small ghost" type="button" data-act="v33-avatar-del">Quitar foto</button>` : ""}</div>
        <p class="tiny muted">La foto se reduce automáticamente (máx. 200 KB).</p>
        <label>Departamento<select name="departamento"><option value="">Elige…</option>${DEPS.map((d) => `<option${K().norm(d) === cur ? " selected" : ""}>${d}</option>`).join("")}</select></label>
        <button class="btn" type="submit">Guardar</button>
      </form>`;
  }
  async function saveProfile(args) {
    const r = await K().rpc("update_my_profile_extra", Object.assign({ p_departamento: null, p_avatar_url: null }, args));
    const u = S().user; if (u && r) { u.departamento = r.departamento || ""; u.avatar_url = r.avatar_url || ""; }
    D().state.user = S().user; D().render();
    return r;
  }

  // ---------- Registro de pestañas, pantalla y acciones ----------
  window.DL_ADMIN_TABS = (window.DL_ADMIN_TABS || []).concat([
    { id: "comprobantes", label: "Comprobantes", need: ["ADMIN", "CONTADOR"], render: docsPanel },
    { id: "roles", label: "Roles y permisos", need: ["ADMIN"], render: rolesPanel },
    { id: "textos", label: "Textos de la tienda", need: ["ADMIN"], render: textosPanel },
    { id: "sistema", label: "Sistema", need: ["ADMIN"], render: sistemaPanel },
  ]);
  window.DL_SCREENS = Object.assign(window.DL_SCREENS || {}, {
    comprobantes: () => `<section class="stack" style="padding:24px 0 48px"><p class="kicker">Contabilidad</p><h1>Comprobantes</h1>${D().state.user ? docsPanel() : `<p class="muted">Inicia sesión para ver los comprobantes.</p><a class="btn" href="#entrar">Entrar</a>`}</section>`,
  });
  window.DL_CUENTA_SUB = Object.assign(window.DL_CUENTA_SUB || {}, { perfil: perfilView });
  const prevExtra = window.DL_CUENTA_EXTRA;
  window.DL_CUENTA_EXTRA = () => (remote() && D().state.user ? userChip() : "") + (prevExtra ? prevExtra() : "");

  const A = window.DL_ACTIONS = window.DL_ACTIONS || {};
  A["v33-docs-csv"] = () => downloadCsv();
  A["v33-docs-page"] = (el) => { DOC.page = Math.max(0, DOC.page + Number(el.dataset.id || 0)); D().render(); };
  A["v33-sys-reload"] = () => { SYS.loaded = false; SYS.data = null; D().render(); };
  A["v33-pin-all"] = async (el) => {
    const on = el.dataset.id === "1";
    if (!confirm(on ? "¿Pedir PIN en el cierre de caja de TODAS las tiendas? Asegúrate de que cada encargado ya creó su PIN." : "¿Dejar de pedir PIN en el cierre de caja de todas las tiendas?")) return;
    const r = await K().rpc("set_close_requires_pin_all", { p_on: on });
    ((D().state.data && D().state.data.stores) || []).forEach((s) => { s.close_requires_pin = on; });
    D().toast(on ? "Listo: se pedirá PIN en todas las tiendas." : "Listo: ya no se pide PIN al cerrar caja." + (r && r.updated != null ? "" : ""));
    D().render();
  };
  A["v33-perm-reset"] = () => { PERM.draft = null; D().render(); };
  A["v33-perm-save"] = async () => {
    const r = await K().rpc("set_role_permissions", { p_role: PERM.role, p_perms: Array.from(PERM.draft || []) });
    D().toast("Permisos guardados."); PERM.loaded = false; PERM.data = null; PERM.draft = null; D().render(); return r;
  };
  A["v33-eta-add"] = () => { if (TX.draft && TX.draft.eta.length < 50) TX.draft.eta.push({ color: "", text: "" }); D().render(); };
  A["v33-eta-del"] = (el) => { if (TX.draft) TX.draft.eta.splice(Number(el.dataset.id), 1); D().render(); };
  A["v33-tx-save"] = async () => {
    const t = TX.draft; if (!t) return;
    const eta = {}; let bad = "";
    t.eta.forEach((r) => { const c = r.color.trim(); const x = r.text.trim(); if (!c && !x) return; if (!c || !x) bad = "Completa color y texto en cada fila (o quítala)."; else eta[c] = x.slice(0, 200); });
    if (bad) return D().toast(bad);
    if (t.cart_note.length > 500 || t.returns_note.length > 500) return D().toast("Máximo 500 caracteres por texto.");
    await K().rpc("set_storefront_settings", { p_values: { cart_note: t.cart_note.trim(), returns_note: t.returns_note.trim(), color_eta: eta } });
    const sf = (S().v2 = S().v2 || {}).storefront = Object.assign(sfv(), { cart_note: t.cart_note.trim(), returns_note: t.returns_note.trim(), color_eta_manual: eta });
    if (window.DL_COLOR_ETA_REFRESH) window.DL_COLOR_ETA_REFRESH(); else sf.color_eta = eta;
    TX.draft = null; D().toast("Textos guardados."); D().render();
  };
  A["v33-avatar-del"] = async () => { await saveProfile({ p_avatar_url: "" }); D().toast("Foto quitada."); };

  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (form.dataset.form === "v33-docs") {
      e.preventDefault(); e.stopImmediatePropagation();
      const fd = new FormData(form); DOC.f = { from: fd.get("from") || "", to: fd.get("to") || "", type: fd.get("type") || "", store: fd.get("store") || "" };
      if (DOC.f.from && DOC.f.to && DOC.f.from > DOC.f.to) return D().toast("La fecha «Desde» debe ser anterior a «Hasta».");
      DOC.page = 0; D().render();
    } else if (form.dataset.form === "v33-perfil") {
      e.preventDefault(); e.stopImmediatePropagation();
      try { await saveProfile({ p_departamento: new FormData(form).get("departamento") || "" }); D().toast("Datos guardados."); } catch (err) { D().toast(K().human(err)); }
    }
  }, true);
  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.matches && t.matches("[data-role33]")) { PERM.role = t.value; PERM.draft = null; D().render(); return; }
    if (t.matches && t.matches("[data-perm33]")) { if (!PERM.draft) PERM.draft = new Set(); if (t.checked) PERM.draft.add(t.dataset.perm33); else PERM.draft.delete(t.dataset.perm33); return; }
    if (t.matches && t.matches("[data-avatar33]") && t.files && t.files[0]) {
      try {
        D().toast("Subiendo foto…");
        const blob = await K().compress(t.files[0], 400, 200 * 1024);
        const up = await K().uploadOwn("avatar", blob);
        await saveProfile({ p_avatar_url: up.path }); D().toast("Foto actualizada.");
      } catch (err) { D().toast(K().human(err)); }
    }
  }, true);
  document.addEventListener("input", (e) => {
    const t = e.target; if (!TX.draft || !t.matches) return;
    if (t.matches("[data-tx33]")) TX.draft[t.dataset.tx33] = t.value;
    else if (t.matches("[data-eta33]")) { const r = TX.draft.eta[Number(t.dataset.eta33)]; if (r) r[t.dataset.k] = t.value; }
  }, true);
})();
