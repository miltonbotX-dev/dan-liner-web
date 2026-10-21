(function () {
  const PAY = { CASH: "Efectivo", YAPE: "Yape", PLIN: "Plin", CARD: "Tarjeta", TRANSFER: "Transferencia" };
  const ROLES = ["ADMIN", "SUPERVISOR", "VENDEDOR", "ALMACENERO", "PENDIENTE"];
  const PERMS = ["CUADRE"];
  const ROLE_LABEL = { CUADRE: "Cuadrar caja", ADMIN: "Administrador", SUPERVISOR: "Supervisor", VENDEDOR: "Vendedor", CAJERO: "Cajero", ALMACENERO: "Almacenero", PENDIENTE: "Pendiente" };
  const state = { data: {}, user: null };
  const ui = {
    filter: "todas",
    q: "",
    cajaQ: "",
    cart: [],
    cajaCart: [],
    pay: "CASH",
    discount: 0,
    storeId: "store-mira",
    warehouseId: "wh-mira",
    customerId: "",
    admin: "resumen",
    taller: "hoy",
    edit: null,
    authMode: "up",
  };

  const SPECS = {
    products: spec("Piezas", [
      col("Pieza", (r) => `<span class="row"><img class="thumb" loading="lazy" decoding="async" width="48" height="48" alt="" src="${esc(safeSrc(r.image_url))}"><span>${esc(r.name)}<br><span class="tiny">${esc(r.sku)}</span></span></span>`),
      col("Precio", (r) => soles(r.sale_price_cents)),
      col("Talla", (r) => esc(r.size_label || "—")),
    ], [
      f("sku", "SKU (vacío = automático)"),
      f("name", "Nombre", { required: true }),
      f("description", "Descripción", { type: "textarea" }),
      f("category_id", "Categoría", { type: "ref", ref: "categories", required: true }),
      f("brand_id", "Marca", { type: "ref", ref: "brands" }),
      f("sale_price_cents", "Precio (S/)", { type: "money", required: true }),
      f("cost_price_cents", "Costo (S/)", { type: "money" }),
      f("wholesale_price_cents", "Mayorista (S/)", { type: "money" }),
      f("image_url", "Foto", { type: "image" }),
      f("size_label", "Talla"),
      f("size_id", "Talla (lista)", { type: "ref", ref: "sizes" }),
      f("color_id", "Color (lista)", { type: "ref", ref: "colors" }),
      f("fabric_id", "Tela (lista)", { type: "ref", ref: "fabrics" }),
      f("min_price_cents", "Precio mínimo (S/)", { type: "money" }),
      f("min_stock", "Stock mínimo", { type: "int" }),
      f("hide_below_stock", "Ocultar con stock menor a", { type: "int" }),
      f("is_active", "Visible en la colección", { type: "bool", default: true }),
    ]),
    categories: spec("Categorías", [col("Nombre", (r) => esc(r.name)), col("Orden", (r) => esc(r.sort_order))], [
      f("name", "Nombre", { required: true }),
      f("slug", "Slug"),
      f("sort_order", "Orden", { type: "int" }),
      f("is_active", "Activa", { type: "bool", default: true }),
    ]),
    sizes: spec("Tallas", [col("Talla", (r) => `<b>${esc(r.label)}</b>${r.is_active === false ? ' <span class="tiny">(inactiva)</span>' : ""}`), col("Grupo", (r) => esc(GROUP_LABEL[r.size_group] || "Otro")), col("Orden", (r) => esc(r.sort_order))], [
      f("label", "Talla", { required: true }),
      f("size_group", "Grupo", { type: "select", options: [["NINO", "Niño"], ["ADULTO", "Adulto"], ["OTRO", "Otro (pantalón, zapatos…)"]] }),
      f("sort_order", "Orden", { type: "int" }),
      f("is_active", "Activa", { type: "bool", default: true }),
    ]),
    cash_registers: spec("Cajas", [col("Caja", (r) => `<b>${esc(r.name)}</b>${r.is_active === false ? ' <span class="tiny">(inactiva)</span>' : ""}`), col("Tienda", (r) => esc(nameOf("stores", r.store_id)))], [
      f("name", "Nombre", { required: true }),
      f("store_id", "Tienda", { type: "ref", ref: "stores", required: true }),
      f("is_active", "Activa", { type: "bool", default: true }),
    ]),
    document_series: spec("Series", [col("Serie", (r) => `<b>${esc(r.series)}</b>${r.is_active === false ? ' <span class="tiny">(inactiva)</span>' : ""}`), col("Tipo", (r) => esc(r.document_type)), col("Tienda", (r) => esc(nameOf("stores", r.store_id))), col("Último nº", (r) => esc(r.last_number || 0))], [
      f("series", "Código (4 caracteres)", { required: true }),
      f("document_type", "Tipo", { type: "select", options: [["BOLETA", "Boleta"], ["FACTURA", "Factura"], ["TICKET", "Ticket"], ["NOTA_CREDITO", "Nota de crédito"]] }),
      f("store_id", "Tienda", { type: "ref", ref: "stores", required: true }),
      f("is_active", "Activa", { type: "bool", default: true }),
    ]),
    brands: spec("Marcas", [col("Nombre", (r) => esc(r.name))], [f("name", "Nombre", { required: true })]),
    stores: spec("Tiendas", [
      col("Tienda", (r) => `<b>${esc(r.name)}</b><br><span class="tiny">${esc(r.address || "")}</span>`),
      col("Personal", (r) => `${esc((r.manager_ids || []).length ? r.manager_ids.map(staffName).join(", ") : "Sin encargado")}<br><span class="tiny">${(state.data.staff || []).filter((p) => p.store_id === r.id && p.is_active !== false).length} en equipo</span>`),
      col("Caja", (r) => cashBadge(r.id)),
    ], [
      f("name", "Nombre", { required: true }),
      f("address", "Dirección"),
      f("phone", "Teléfono"),
      f("lat", "Latitud (ej. -12.063720)", { placeholder: "-12.06…" }),
      f("lng", "Longitud (ej. -77.015100)", { placeholder: "-77.01…" }),
      f("manager_ids", "Encargados", { type: "staffmulti" }),
      f("is_main", "Tienda principal", { type: "bool", default: false }),
      f("is_active", "Activa", { type: "bool", default: true }),
    ]),
    warehouses: spec("Almacenes", [col("Almacén", (r) => esc(r.name)), col("Tienda", (r) => esc(nameOf("stores", r.store_id)))], [
      f("name", "Nombre", { required: true }),
      f("store_id", "Tienda", { type: "ref", ref: "stores", required: true }),
      f("kind", "Tipo", { type: "select", options: [["TIENDA", "Tienda (piso de venta)"], ["ALMACEN", "Almacén"], ["CONSIGNACION", "Consignación"], ["PRODUCCION", "Producción / taller"]] }),
      f("is_default", "Almacén principal de la tienda", { type: "bool", default: false }),
      f("address", "Dirección"),
      f("phone", "Teléfono"),
      f("manager_id", "Encargado del almacén", { type: "staff" }),
      f("is_active", "Activo", { type: "bool", default: true }),
    ]),
    customers: spec("Clientes", [col("Cliente", (r) => esc(r.name)), col("Teléfono", (r) => esc(r.phone || "—"))], [
      f("name", "Nombre", { required: true }),
      f("phone", "Teléfono"),
      f("note", "Nota", { type: "textarea" }),
      f("is_active", "Activo", { type: "bool", default: true }),
    ]),
    promos: spec("Promociones", [col("Promo", (r) => esc(r.name)), col("%", (r) => esc(r.percent))], [
      f("name", "Nombre", { required: true }),
      f("percent", "Porcentaje", { type: "int", required: true }),
      f("category_id", "Categoría", { type: "ref", ref: "categories" }),
      f("is_active", "Activa", { type: "bool", default: true }),
    ]),
    expenses: spec("Gastos", [col("Gasto", (r) => esc(r.category)), col("Monto", (r) => soles(r.amount_cents))], [
      f("store_id", "Tienda", { type: "ref", ref: "stores" }),
      f("category", "Categoría", { required: true }),
      f("amount_cents", "Monto (S/)", { type: "money", required: true }),
      f("note", "Nota"),
      f("expense_date", "Fecha", { type: "date" }),
    ]),
    partners: spec("Mayoristas", [col("Casa", (r) => esc(r.name)), col("Teléfono", (r) => esc(r.phone || "—"))], [
      f("name", "Nombre", { required: true }),
      f("phone", "Teléfono"),
      f("notes", "Notas", { type: "textarea" }),
      f("is_active", "Activo", { type: "bool", default: true }),
    ]),
    fabrics: spec("Telas", [col("Tela", (r) => esc(r.name)), col("Código", (r) => esc(r.code || "")), col("Estado", (r) => r.is_active === false ? "Inactiva" : "Activa")], [
      f("name", "Nombre", { required: true }),
      f("is_active", "Activa", { type: "bool", default: true }),
    ]),
    colors: spec("Colores", [col("Color", (r) => `${r.hex ? `<i class="swatch" style="background:${esc(r.hex)}"></i> ` : ""}${esc(r.name)}`), col("Código", (r) => esc(r.code || "")), col("Estado", (r) => r.is_active === false ? "Inactivo" : "Activo")], [
      f("name", "Nombre", { required: true }),
      f("hex", "Color (hex, ej. #1a1a1a)", { placeholder: "#000000" }),
      f("is_active", "Activo", { type: "bool", default: true }),
    ]),
    fabric_suppliers: spec("Proveedores", [col("Proveedor", (r) => esc(r.name))], [
      f("name", "Nombre", { required: true }),
      f("phone", "Teléfono"),
    ]),
    tailors: spec("Sastres", [col("Maestro", (r) => esc(r.name)), col("Especialidad", (r) => esc(r.specialty))], [
      f("name", "Nombre", { required: true }),
      f("specialty", "Especialidad", { required: true }),
      f("phone", "Teléfono"),
    ]),
  };

  const GROUP_LABEL = { NINO: "Niño", ADULTO: "Adulto", OTRO: "Otro" };
  function spec(title, cols, fields) { return { title, cols, fields }; }
  function col(label, html) { return { label, html }; }
  function f(name, label, extra) { return Object.assign({ name, label, type: "text" }, extra || {}); }

  function esc(value) {
    const map = { "&": "\u0026amp;", "<": "\u0026lt;", ">": "\u0026gt;", '"': "\u0026quot;", "'": "\u0026#39;" };
    return String(value ?? "").replace(/[&<>"']/g, (ch) => map[ch]);
  }
  function soles(cents) {
    return "S/ " + (Number(cents || 0) / 100).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function moneyHtml(cents) {
    const v = (Number(cents || 0) / 100).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<span class="cur">S/</span> <span class="num">${v}</span>`;
  }
  function nid(prefix) { return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function localDay(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }
  const PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#e9e6e1"/><path d="M150 170l50-30 50 30-15 25-35-15-35 15z M165 200h70v170h-70z" fill="#cfc9c0"/></svg>');
  function driveDirect(url) {
    const value = String(url || "").trim();
    if (!/drive\.google\.com|docs\.google\.com|googleusercontent\.com/i.test(value)) return value;
    const m = value.match(/\/d\/([\w-]{10,})/) || value.match(/[?&]id=([\w-]{10,})/);
    return m ? "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w800" : value;
  }
  function safeSrc(url) {
    const value = driveDirect(url);
    if (/^https?:\/\//i.test(value) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value) || value.startsWith("assets/")) return value;
    return PLACEHOLDER;
  }
  function byId(table, id) { return (state.data[table] || []).find((row) => row.id === id); }
  function nameOf(table, id) { const row = byId(table, id); return row ? row.name : "—"; }

  // Iconos
  const ICON_PATHS = {
    bag: '<path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    pdf: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 15h5M9.5 18h3"/>',
    wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z"/><path d="M9 9.5c.3 2.4 2.3 4.4 4.8 4.9l1.2-1.2 1.8.8-.5 1.6c-3.8.4-7.4-3.2-7-7l1.6-.5.8 1.8z"/>',
    counter: '<path d="M3 10h18v10H3z"/><path d="M5 10V6h14v4M8 14h3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  };
  function icon(name, size) {
    const s = size || 20;
    return `<svg class="ic ic-${name}" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;
  }
  function homeHash() {
    if (ui.afterLogin) { const h = ui.afterLogin; ui.afterLogin = null; try { localStorage.removeItem("dl-after"); } catch { } return h; }
    if (allow(["SUPERVISOR", "VENDEDOR", "CAJERO"])) return "caja";
    if (allow(["SUPERVISOR", "ALMACENERO"])) return "taller";
    return "coleccion";
  }
  function role() { return state.user && state.user.role; }
  function rolesOf(person) {
    if (!person) return [];
    const list = Array.isArray(person.roles) && person.roles.length ? person.roles.slice() : [];
    if (person.role && !list.includes(person.role)) list.unshift(person.role);
    return list.filter((r) => r && r !== "PENDIENTE");
  }
  function myRoles() {
    if (!state.user) return [];
    const fresh = byId("staff", state.user.id);
    return rolesOf(fresh || state.user);
  }
  function allow(list) {
    const current = myRoles();
    if (!current.length) return false;
    if (current.includes("ADMIN")) return true;
    return list.some((r) => current.includes(r));
  }
  function isAdmin() { return myRoles().includes("ADMIN"); }
  function page() {
    const raw = (location.hash || "#coleccion").replace("#", "");
    const [name, sub] = raw.split("/");
    return { name: name === "cuenta" ? "entrar" : (name || "coleccion"), sub: sub || "" }; // #cuenta = alias de #entrar (vista de cuenta)
  }
  // Mensajes técnicos (tablas, SQL, series…) → texto humano
  function humanError(msg, fallback) {
    const t = String(msg || "");
    if (!t) return fallback;
    if (/document_series|No hay serie activa/i.test(t)) return "Esta tienda aún no tiene serie de comprobantes. Pídele al administrador que la cree en Admin › Tiendas.";
    if (/failed to fetch|networkerror|load failed/i.test(t)) return "Sin conexión. Revisa tu internet e inténtalo otra vez.";
    if (/jwt|token.*expired|invalid claim/i.test(t)) return "Tu sesión venció. Vuelve a entrar.";
    if (/permission denied|row-level security|42501/i.test(t)) return "Tu cuenta no tiene permiso para esto.";
    if (/violates|constraint|relation|column|syntax error|null value|duplicate key|PGRST|schema cache|function .*does not exist|\bpublic\.|_id\b|[a-z]+_[a-z]+\(/i.test(t)) return fallback + ". Si se repite, avisa al administrador.";
    return t;
  }
  function notifyError(err, fallback) { const m = humanError(err && err.message, fallback); if (window.DL_UI) window.DL_UI.notice(m, "error"); else toast(m); }
  function toast(message, kind) {
    if (window.DL_UI && window.DL_UI.toast) return window.DL_UI.toast(message, kind);
    const el = document.getElementById("toast");
    el.hidden = false;
    el.textContent = message;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 3600);
  }
  function stockOf(product) {
    const rows = (state.data.stock_levels || []).filter((row) => row.product_id === product.id);
    if (rows.length) return rows.reduce((sum, row) => sum + Number(row.quantity_on_hand || 0), 0);
    return Number(product.stock_total || 0);
  }
  function stockIn(productId, warehouseId) {
    const row = (state.data.stock_levels || []).find((item) => item.product_id === productId && item.warehouse_id === warehouseId);
    return row ? Number(row.quantity_on_hand) : 0;
  }
  function priceOf(product) {
    if (product.is_offer && Number(product.offer_price_cents) > 0) {
      const list = Number(product.sale_price_cents) || 0, unit = Number(product.offer_price_cents);
      return { unit, percent: list ? Math.round((list - unit) / list * 100) : 0, name: product.offer_label || "Remate", offer: true, list };
    }
    return { unit: Number(product.sale_price_cents) || 0, percent: 0, name: "" };
    const promo = (state.data.promos || []).find((item) => item.is_active !== false && item.category_id === product.category_id);
    const percent = promo ? Number(promo.percent) || 0 : 0;
    return { unit: Math.round(Number(product.sale_price_cents) * (100 - percent) / 100), percent, name: promo ? promo.name : "" };
  }
  function visibleProducts() {
    return (state.data.products || []).filter((product) => !product.deleted_at && product.is_active !== false);
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("dl-theme"); } catch { }
    const def = homeCfg().home_theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", saved === "dark" || saved === "light" ? saved : def);
  }
  function notifyCajaTheme() {
    const frame = document.getElementById("caja-frame");
    if (frame && frame.contentWindow && typeof frame.contentWindow.dlApplyTheme === "function") frame.contentWindow.dlApplyTheme();
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("dl-theme", next); } catch { }
  }

  async function reload() {
    const entries = await Promise.all(window.DL_TABLES.map(async (table) => {
      try { return [table, await Store.list(table)]; }
      catch (err) { if (table === "sizes") return [table, []]; throw err; }
    }));
    state.data = Object.fromEntries(entries);
    state.user = Store.user;
    const api = Store.v2api || {};
    [state.pubStores, state.orders] = await Promise.all([
      api.publicStores ? api.publicStores().catch(() => state.pubStores || []) : [],
      state.user && api.orders ? api.orders().catch(() => []) : [],
    ]);
    if (!byId("stores", ui.storeId) && state.data.stores[0]) ui.storeId = state.data.stores[0].id;
    const houses = (state.data.warehouses || []).filter((row) => row.store_id === ui.storeId && row.is_active !== false)
      .sort((a, b) => (b.kind === "TIENDA") - (a.kind === "TIENDA") || (b.is_default === true) - (a.is_default === true));
    if (!houses.some((row) => row.id === ui.warehouseId) && houses[0]) ui.warehouseId = houses[0].id;
  }

  function syncNav() {
    const here = page().name;
    document.querySelectorAll("[data-link]").forEach((link) => {
      link.classList.toggle("on", link.dataset.link === here);
      if (link.dataset.link === "entrar") link.textContent = state.user ? "Cuenta" : "Entrar";
    });
    const show = {
      user: Boolean(state.user),
      pos: allow(["SUPERVISOR", "VENDEDOR", "CAJERO"]),
      workshop: allow(["SUPERVISOR", "ALMACENERO"]),
      shop: allow(["SUPERVISOR"]),
      admin: allow(["SUPERVISOR", "ALMACENERO"]),
    };
    document.querySelectorAll("[data-need]").forEach((el) => {
      if (el.dataset.link === "entrar") { el.hidden = false; return; }
      el.hidden = !show[el.dataset.need];
    });
  }

  const STORE_ROUTES = ["coleccion", "pieza", "promociones", "mis-pedidos", "tiendas", "contacto"];
  function render() {
    const here = page();
    if (here.name === "admin" && here.sub && here.sub !== ui.admin) { ui.drawer = false; ui.admin = here.sub; ui.staffSel = null; ui.showForm = null; ui.edit = null; }
    if (here.name === "taller" && here.sub) ui.taller = here.sub;
    const view = document.getElementById("view");
    ui.tabScroll = ui.tabScroll || {};
    document.querySelectorAll(".tabs[id]").forEach((el) => { ui.tabScroll[el.id] = el.scrollLeft; });
    document.body.classList.toggle("ui-app", !STORE_ROUTES.includes(here.name) && !(here.name === "entrar" && isClient()));
    const screens = Object.assign({ coleccion: renderCatalog, entrar: renderLogin, taller: renderTaller, admin: renderAdmin, pedido: renderPedido }, window.DL_SCREENS || {});
    view.innerHTML = (screens[here.name] || renderCatalog)();
    syncNav();
    mountHeader();
    afterRender();
  }
  function animateHero() {
    const hero = document.querySelector("#view .hero");
    if (!hero || ui.heroAnimated || !hero.animate) return;
    ui.heroAnimated = true;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const img = hero.querySelector("img"), fig = hero.querySelector("figure"), copy = hero.querySelector(".hero-copy") || hero;
    if (fig) fig.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, easing: "ease-out", fill: "both" });
    if (img) img.animate([{ transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 9000, easing: "cubic-bezier(.2,.6,.2,1)", fill: "both" });
    copy.querySelectorAll(".kicker, h1").forEach((el, i) => el.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 1100, delay: 450 + i * 220, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" }));
  }
  function afterRender() {
    if (window.DL_afterRender) { try { window.DL_afterRender(); } catch (e) { } }
    document.querySelectorAll(".tabs[id]").forEach((tabs) => {
      tabs.scrollLeft = (ui.tabScroll || {})[tabs.id] || 0;
      const on = tabs.querySelector(".chip.on");
      if (on) {
        const l = on.offsetLeft - tabs.offsetLeft, r = l + on.offsetWidth;
        if (l < tabs.scrollLeft) tabs.scrollLeft = l - 12;
        else if (r > tabs.scrollLeft + tabs.clientWidth) tabs.scrollLeft = r - tabs.clientWidth + 12;
      }
      ui.tabScroll[tabs.id] = tabs.scrollLeft;
    });
    drawCharts();
    animateHero();
    const fr = document.getElementById("home-preview");
    if (fr && !fr.dataset.bound) { fr.dataset.bound = "1"; fr.addEventListener("load", () => setTimeout(pushPreview, 400)); }
    (window.DL_AFTER || []).forEach((fn) => { try { fn(); } catch (err) { console.warn(err); } });
  }

  function productKey(p) { return String(p.group_key || p.product_id || p.name || p.id); }
  function productGroups(list) {
    const map = new Map();
    list.forEach((p) => { const k = productKey(p); if (!map.has(k)) map.set(k, []); map.get(k).push(p); });
    return [...map.entries()].map(([key, vars]) => ({ key, vars, first: vars.find((v) => stockOf(v) > 0) || vars[0] }));
  }
  function groupImages(vars) {
    const out = [];
    vars.forEach((v) => (Array.isArray(v.images) && v.images.length ? v.images : [v.image_url]).forEach((u) => { if (u && !out.includes(u)) out.push(u); }));
    return out;
  }
  function sizeOrder(label) { const l = sizeList(); const i = l.indexOf(label); return i < 0 ? 999 : i; }
  function bySize(vars) { return vars.slice().sort((a, b) => (a.size_order ?? sizeOrder(a.size_label)) - (b.size_order ?? sizeOrder(b.size_label)) || String(a.sku).localeCompare(String(b.sku))); }
  function pickVariant(key, vars) {
    const sel = (ui.cardSel || {})[key];
    return vars.find((v) => v.id === sel) || vars.find((v) => stockOf(v) > 0) || vars[0];
  }
  function cardHtml(g) {
    const vars = bySize(g.vars); const v = pickVariant(g.key, vars);
    const priced = priceOf(v); const soldOut = stockOf(v) <= 0;
    const img = (Array.isArray(v.images) && v.images[0]) || v.image_url;
    return `<article class="card product-card" data-key="${esc(g.key)}">
        <button class="card-media" type="button" data-act="open" data-id="${esc(g.key)}" aria-label="Ver ${esc(v.name)}"><img class="photo" loading="lazy" decoding="async" width="600" height="750" alt="${esc(v.name)} talla ${esc(v.size_label || "")}" loading="lazy" src="${esc(safeSrc(img))}"></button>
        <div class="pad stack">
          ${vars.length > 1 || v.size_label ? `<div class="card-sizes" role="group" aria-label="Tallas">${vars.map((x) => { const off = stockOf(x) <= 0; return `<button type="button" class="sz ${x.id === v.id ? "on" : ""} ${off ? "off" : ""}" data-act="card-size" data-key="${esc(g.key)}" data-id="${esc(x.id)}" ${off ? "disabled aria-disabled=\"true\" title=\"Agotado\"" : ""} aria-pressed="${x.id === v.id}">${esc(x.size_label || "Única")}</button>`; }).join("")}</div>` : ""}
          <div>
            <h3>${esc(v.name)}</h3>
            <p class="tiny card-info">${esc([v.fabric, v.color].filter(Boolean).join(" · "))}${v.size_label ? " · Talla " + esc(v.size_label) : ""}</p>
          </div>
          <div class="row">
            <strong class="price">${soles(priced.unit)}</strong>${priced.offer ? `<s class="tiny">${soles(priced.list)}</s>` : ""}
          </div>
          <div class="row">
            <button class="btn small btn-bag" type="button" data-act="cart-add" data-id="${esc(v.id)}" ${soldOut ? "disabled" : ""}>${icon("bag", 16)} ${soldOut ? "Agotado" : "Agregar"}</button>
            <a class="more-btn" href="#pieza/${encodeURIComponent(g.key)}">Ver detalles</a>
          </div>
        </div>
      </article>`;
  }
  function productCards() {
    const query = ui.q.trim().toLowerCase();
    const list = visibleProducts().filter((product) => {
      if (ui.filter !== "todas" && product.category_id !== ui.filter) return false;
      if (!query) return true;
      return (product.name + " " + product.sku).toLowerCase().includes(query);
    });
    if (!list.length) return ui.filter !== "todas" || query ? `<div class="empty-filter"><p class="muted">No hay piezas con ese filtro.</p><button class="link-btn forgot-link" type="button" data-act="clear-search">Limpiar búsqueda</button></div>` : `<p class="muted">Pronto nuevas prendas</p>`;
    return productGroups(list).map(cardHtml).join("");
  }


  const HOME_DEFAULTS = { home_hero_image: "", home_kicker: "Nueva colección", home_title: "Estilo y elegancia para hombres", home_align: "left", home_shade: "60", home_theme: "dark", home_cols: "2", home_hero_style: "full" };
  function homeCfg() {
    const conf = (window.DL_CONFIG && window.DL_CONFIG.BUSINESS) || {};
    const remote = ui.homeDraft || (Store.v2 && Store.v2.storefront) || {};
    const out = {};
    Object.keys(HOME_DEFAULTS).forEach((k) => { out[k] = remote[k] != null && remote[k] !== "" ? remote[k] : HOME_DEFAULTS[k]; });
    if (!out.home_hero_image) out.home_hero_image = conf.heroImage || "";
    return out;
  }
  function heroImage() {
    const src = driveDirect(homeCfg().home_hero_image || "");
    return /^https?:\/\//i.test(src) ? src : "";
  }

  function renderCatalog() {
    const cats = (Array.isArray(state.data.categories) ? state.data.categories : []).filter((row) => row && typeof row === "object" && row.name && row.is_active !== false).sort((a, b) => a.sort_order - b.sort_order);
    const chips = `<button class="chip ${ui.filter === "todas" ? "on" : ""}" type="button" data-act="filter" data-id="todas">Todo</button>`
      + cats.map((cat) => `<button class="chip ${ui.filter === cat.id ? "on" : ""}" type="button" data-act="filter" data-id="${esc(cat.id)}">${esc(cat.name)}</button>`).join("");
    const heroSrc = heroImage();
    const hc = homeCfg();
    const shade = Math.max(0, Math.min(100, Number(hc.home_shade) || 0)) / 100;
    const align = ["left", "center", "right"].includes(hc.home_align) ? hc.home_align : "left";
    const style = ["full", "split", "text"].includes(hc.home_hero_style) ? hc.home_hero_style : "full";
    if (style === "text") return `<section class="hero hero-text" data-cols="${hc.home_cols === "1" ? 1 : 2}" style="text-align:${align}">
        ${hc.home_kicker ? `<p class="kicker">${esc(hc.home_kicker)}</p>` : ""}<h1>${esc(hc.home_title)}</h1></section>` + catalogBody(chips);
    if (style === "split") return `<section class="hero hero-split" data-cols="${hc.home_cols === "1" ? 1 : 2}" style="--hero-shade:${shade}">
        <div class="hero-copy" style="text-align:${align}">${hc.home_kicker ? `<p class="kicker">${esc(hc.home_kicker)}</p>` : ""}<h1>${esc(hc.home_title)}</h1></div>
        <figure${heroSrc ? "" : ' style="background:linear-gradient(160deg,#0b0b0b 0%,#1c1a17 55%,#2a2520 100%)"'}>${heroSrc ? `<img src="${esc(heroSrc)}" alt="Dan Liner">` : ""}</figure></section>` + catalogBody(chips);
    return `<section class="hero" data-cols="${hc.home_cols === "1" ? 1 : 2}" style="--hero-shade:${shade}">
      <div class="hero-copy" style="text-align:${align}">
        ${hc.home_kicker ? `<p class="kicker">${esc(hc.home_kicker)}</p>` : ""}
        <h1>${esc(hc.home_title)}</h1>
      </div>
      <figure${heroSrc ? "" : ' style="background:linear-gradient(160deg,#0b0b0b 0%,#1c1a17 55%,#2a2520 100%);min-height:320px"'}>
        ${heroSrc ? `<img src="${esc(heroSrc)}" alt="Dan Liner">` : ""}
      </figure>
    </section>` + catalogBody(chips);
  }
  function catalogBody(chips) {
    return `<div class="toolbar">
      ${chips}
      <input class="search" id="q" type="search" name="dl-catalogo-busqueda" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" data-lpignore="true" data-1p-ignore value="${esc(ui.q)}" placeholder="Buscar pieza" aria-label="Buscar pieza">
    </div>
    <div class="layout layout-full">
      <div class="grid" id="grid">${productCards()}</div>
    </div>`;
  }

  function cartHtml(lines, kind) {
    if (!lines.length) return `<p class="muted">Todavía vacía.</p>`;
    return lines.map((line) => {
      const product = byId("products", line.productId);
      if (!product) return "";
      const unit = kind === "caja" ? priceOf(product).unit : Number(product.sale_price_cents);
      return `<div class="row">
        <span>${esc(product.name)} <span class="tiny">× ${line.qty}</span></span>
        <span>
          <strong>${soles(unit * line.qty)}</strong>
          <button class="btn ghost small" type="button" data-act="qty" data-cart="${kind}" data-id="${esc(line.productId)}" data-dir="-1">−</button>
          <button class="btn ghost small" type="button" data-act="qty" data-cart="${kind}" data-id="${esc(line.productId)}" data-dir="1">+</button>
        </span>
      </div>`;
    }).join("");
  }

  function checkUsername(input) {
    const v = input.value.toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (v !== input.value) input.value = v;
    const out = document.getElementById("user-check");
    clearTimeout(ui.userT);
    if (!out) return;
    if (v.length < 3) { out.textContent = "De 3 a 30 letras, números, punto o guion bajo"; out.className = "tiny"; return; }
    out.textContent = "Comprobando…"; out.className = "tiny";
    ui.userT = setTimeout(async () => {
      try { const ok = await Store.v2api.usernameAvailable(v); if (input.value !== v) return; out.textContent = ok ? "Disponible" : "Ya está en uso"; out.className = "tiny " + (ok ? "ok" : "bad"); }
      catch { out.textContent = ""; }
    }, 350);
  }
  function isClient() { return Boolean(state.user) && !allow(["SUPERVISOR", "VENDEDOR", "CAJERO", "ALMACENERO"]); }
  function accountMain() {
    if (isAdmin()) return `<a class="btn" href="#admin">Ir a Administración</a>`;
    if (allow(["SUPERVISOR", "VENDEDOR", "CAJERO"])) return `<a class="btn" href="#caja">Ir a Caja</a>`;
    if (allow(["ALMACENERO"])) return `<a class="btn" href="#taller">Ir a Taller</a>`;
    return `<a class="btn" href="#pedido">Mi carrito</a>`;
  }

  async function deleteMe() {
    const ok = await window.dlgConfirm("Se borran tus datos de acceso y se cancelan tus pedidos abiertos. Tus comprobantes se conservan por ley. Esta acción no se puede deshacer.", { title: "¿Eliminar tu cuenta?", danger: true, ok: "Sí, eliminar mi cuenta", cancel: "No, volver" });
    if (!ok) return;
    await Store.v2api.deleteSelf();
    try { localStorage.removeItem("dl-cart"); } catch { }
    ui.cart = []; await Store.signOut(); await reload(); location.hash = "coleccion"; render(); toast("Tu cuenta fue eliminada");
  }
  const ORDER_ST = { pendiente: "Pendiente", confirmado: "Confirmado", listo: "Listo para recoger", entregado: "Entregado", cancelado: "Cancelado" };
  const ORDER_NEXT = { pendiente: "confirmado", confirmado: "listo", listo: "entregado" };
  function orderCard(o, staff) {
    const inv = (state.data.store_inventory || []);
    const stockAt = (vid) => inv.filter((r) => r.store_id === o.store_id && r.product_id === vid).reduce((n, r) => n + r.quantity, 0);
    const shop = (state.pubStores || []).find((x) => x.id === o.store_id) || byId("stores", o.store_id) || {};
    return `<article class="panel stack order-card st-${esc(o.status)}">
      <div class="row order-head"><b class="order-code">${esc(o.code || "")}</b><span class="badge order-st st-${esc(o.status)}">${esc(ORDER_ST[o.status] || o.status)}</span></div>
      <p class="tiny">${esc(new Date(o.created_at).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }))} · ${o.delivery === "delivery" ? "Envío" : "Recojo"} · ${esc(shop.name || "")}${staff && o.phone ? ` · <a href="https://wa.me/${esc(String(o.phone).replace(/\D/g, "").replace(/^(9\d{8})$/, "51$1"))}" target="_blank" rel="noopener">${esc(o.phone)}</a>` : ""}</p>
      <ul class="order-items">${o.items.map((i) => `<li><span>${i.qty} × ${esc(i.name)} <span class="tiny">${esc(i.label)}</span></span>${staff && inv.length ? ` <span class="tiny stock-chk ${stockAt(i.variant_id) < i.qty ? "low" : ""}">stock tienda: ${stockAt(i.variant_id)}</span>` : ""}<b>${moneyHtml(i.line_cents)}</b></li>`).join("")}</ul>
      ${o.notes ? `<p class="tiny order-notes">${esc(o.notes)}</p>` : ""}${o.cancel_reason ? `<p class="tiny">Motivo: ${esc(o.cancel_reason)}</p>` : ""}
      <div class="row order-foot"><b>${moneyHtml(o.total_cents)}</b><span class="row order-acts">
        ${!staff && o.status === "pendiente" ? `<button class="btn ghost small" type="button" data-act="order-cancel" data-id="${esc(o.id)}">Cancelar pedido</button>` : ""}
        ${staff && ORDER_NEXT[o.status] ? `<button class="btn small" type="button" data-act="order-status" data-id="${esc(o.id)}" data-s="${ORDER_NEXT[o.status]}">Marcar ${esc(ORDER_ST[ORDER_NEXT[o.status]].toLowerCase())}</button>` : ""}
        ${staff && ORDER_NEXT[o.status] ? `<button class="btn danger small" type="button" data-act="order-status" data-id="${esc(o.id)}" data-s="cancelado">Cancelar</button>` : ""}
      </span></div></article>`;
  }
  function myOrdersHtml() {
    const mine = (state.orders || []).filter((o) => state.user && o.user_id === state.user.id);
    if (!mine.length) return `<p class="muted">Todavía no tienes pedidos.</p>`;
    return `<div class="stack orders-list">${mine.map((o) => orderCard(o, false)).join("")}</div>`;
  }
  function ordersPanel(storeId) {
    const f = ui.orderFilter || "abiertos";
    let list = (state.orders || []).filter((o) => !storeId || o.store_id === String(storeId));
    if (f === "abiertos") list = list.filter((o) => ORDER_NEXT[o.status]);
    else if (f !== "todos") list = list.filter((o) => o.status === f);
    return `<div class="stack orders-panel">
      <div class="tabs order-filters">${[["abiertos", "Abiertos"], ["pendiente", "Pendientes"], ["listo", "Listos"], ["entregado", "Entregados"], ["cancelado", "Cancelados"], ["todos", "Todos"]].map(([k, l]) => `<button type="button" class="chip ${f === k ? "on" : ""}" data-act="order-filter" data-id="${k}">${l}</button>`).join("")}<button type="button" class="chip" data-act="order-refresh">Actualizar</button></div>
      <p class="tiny order-note">Antes de confirmar revisa que haya stock de cada prenda en la tienda. El pedido no descuenta stock: se descuenta al cobrarlo en Caja.</p>
      ${list.map((o) => orderCard(o, true)).join("") || `<p class="muted">No hay pedidos ${f === "todos" ? "" : "en este estado"}.</p>`}</div>`;
  }
  function normPhone(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("51")) d = d.slice(2);
    return /^9\d{8}$/.test(d) ? d : null;
  }
  async function placeOrder() {
    const c = ui.checkout || {};
    const lines = cartLines(); if (!lines.length) throw new Error("Tu carrito está vacío");
    const extra = [c.name ? "Nombre: " + c.name : "", c.dni ? "DNI: " + c.dni : "", c.mode === "delivery" ? "Dirección: " + c.address : "", c.notes || ""].filter(Boolean).join(" · ").slice(0, 500);
    const phone = normPhone(c.phone);
    if (!phone) { ui.step = "datos"; ui.phoneErr = "Revisa tu celular: 9 dígitos que empiezan con 9 (ej. 931246675)."; render(); throw new Error(ui.phoneErr); }
    if (state.user && !normPhone(state.user.phone) && Store.v2api.saveMyPhone) await Store.v2api.saveMyPhone(phone).catch(() => {});
    const r = await Store.v2api.createOrder({ storeId: c.store, items: lines.map(({ line, p }) => ({ variant_id: p.variant_id || p.id, qty: line.qty })), delivery: c.mode === "delivery" ? "delivery" : "recojo", phone, notes: extra });
    ui.lastOrder = r; ui.cart = []; saveCart(); await reload(); render(); window.scrollTo(0, 0);
  }

  function renderLogin() {
    if (ui.recovery && state.user) {
      return `<section class="login-grid"><div class="stack">
        <p class="kicker">Recuperar acceso</p><h1>Nueva contraseña</h1>
        <p class="muted">${esc(state.user.email || "")}</p>
        <form class="stack md-form" data-form="new-password">
          <label>Nueva contraseña<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
          <label>Repite la contraseña<input name="password2" type="password" minlength="8" autocomplete="new-password" required></label>
          <button class="btn full md-tonal" type="submit">Guardar contraseña</button>
        </form></div></section>`;
    }
    if (state.user) {
      const sub = page().sub;
      const roleTxt = state.user.role === "PENDIENTE" && (state.user.roles || []).includes("CLIENTE") ? "Cliente" : (ROLE_LABEL[state.user.role] || state.user.role);
      const ini = String(state.user.full_name || state.user.email || "?").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
      const perfil = window.DL_PERFIL ? window.DL_PERFIL.view() : "";
      if (sub === "datos") return `<section class="stack account" style="padding:24px 0 48px; max-width:640px"><a class="link-btn" href="#cuenta">← Mi cuenta</a>${perfil}</section>`;
      return `<section class="stack account" style="padding:24px 0 48px; max-width:640px">
        <p class="kicker">Mi cuenta</p>
        <div class="account-card"><span class="avatar" aria-hidden="true">${esc(ini || "?")}</span>
          <div style="min-width:0"><h1 style="margin:0;overflow-wrap:anywhere;font-size:24px;line-height:1.15">${esc(state.user.full_name)}</h1><p class="muted tiny" style="margin:4px 0 0;overflow-wrap:anywhere">${esc(state.user.email)} · ${esc(roleTxt)}</p></div>
          <button class="edit-btn" type="button" data-act="acc-edit" aria-label="Editar mis datos" title="Editar mis datos">${icon("pencil", 18)}</button></div>
        <div class="row" style="justify-content:flex-start">${accountMain()}<button class="btn ghost" type="button" data-act="signout">Cerrar sesión</button></div>
        <nav class="account-menu" aria-label="Mi cuenta">
          <a href="#cuenta/datos">Mis datos</a>
          ${isClient() ? `<a href="#mis-pedidos">Mis pedidos</a>
          <button type="button" data-act="acc-soon" data-id="Mis direcciones"><span>Mis direcciones</span><span class="tiny muted">Próximamente</span></button>
          <button type="button" data-act="acc-soon" data-id="Mis promociones"><span>Mis promociones</span><span class="tiny muted">Próximamente</span></button>` : ""}
        </nav>
        ${isClient() ? `<div class="account-menu" style="margin-top:28px"><button type="button" class="account-danger" data-act="delete-me"><span>Eliminar mi cuenta</span>${icon("trash", 16)}</button></div>
        <p class="tiny muted">Se borran tus datos de acceso. Tus comprobantes se conservan por ley.</p>` : ""}
      </section>`;
    }
    const up = ui.authMode === "up";
    if (ui.authMode === "check-email") {
      return `<section class="login-grid"><div class="stack">
        <p class="kicker">Cuenta creada</p><h1>Revisa tu correo para confirmar tu cuenta</h1>
        <p role="status">Te enviamos un enlace a <b>${esc(ui.pendingEmail || "tu correo")}</b>.</p>
        <p class="muted">Ábrelo para activar tu cuenta y vuelve a esta página para entrar. Si no aparece en unos minutos, revisa la carpeta de spam o promociones.</p>
        <button class="btn full md-tonal" type="button" data-act="auth-mode" data-id="in">Ya confirmé, entrar</button></div></section>`;
    }
    if (ui.authMode === "forgot") {
      return `<section class="login-grid"><div class="stack">
        <p class="kicker">Recuperar acceso</p><h1>Olvidé mi contraseña</h1>
        <p class="muted">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</p>
        <form class="stack md-form" data-form="forgot">
          <label>Correo<input name="email" type="text" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required placeholder="tucorreo@ejemplo.com"></label>
          <p class="tiny">Si entras con usuario o celular, usa el correo con el que te registraste.</p>
          <button class="btn full md-tonal" type="submit">Enviar enlace</button>
          <button class="btn ghost full" type="button" data-act="auth-mode" data-id="in">Volver a entrar</button>
        </form></div></section>`;
    }
    return `<section class="login-grid">
      <div class="stack">
        <p class="kicker">Bienvenido a Dan Liner</p>
        <h1>${up ? "Crear cuenta" : "Entrar"}</h1>
        <p class="muted">Únete para apartar prendas y recibir novedades.</p>
        <div class="two">
          <button class="btn ${up ? "" : "ghost"}" type="button" data-act="auth-mode" data-id="up">Crear cuenta</button>
          <button class="btn ${up ? "ghost" : ""}" type="button" data-act="auth-mode" data-id="in">Ya tengo cuenta</button>
        </div>
        <form class="stack md-form" data-form="auth">
          ${up ? `<label class="md-field">Nombre de usuario<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" pattern="[a-z0-9_.]{3,30}" minlength="3" maxlength="30" required placeholder="ej. juan.perez"><span class="tiny" id="user-check"></span></label><label>Nombre<input name="name" autocomplete="name" required></label><label>Celular o WhatsApp<input name="phone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="15" required placeholder="9 dígitos, ej. 931246675" aria-describedby="su-phone-err"></label><p class="field-error tiny" id="su-phone-err" role="alert" ${ui.suPhoneErr ? "" : "hidden"}>${esc(ui.suPhoneErr || "")}</p><label>DNI (opcional)<input name="dni" inputmode="numeric" maxlength="8" pattern="[0-9]{8}" title="8 dígitos"></label>` : ""}
          ${up ? `<label>Correo<input name="email" type="email" autocomplete="email" required></label>` : `<label>Usuario, correo o celular<input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>`}
          <label>Contraseña<input name="password" type="password" minlength="8" autocomplete="${up ? "new-password" : "current-password"}" required></label>
          <button class="btn full md-tonal" type="submit">${up ? "Crear y entrar" : "Entrar"}</button>
          <button class="link-btn forgot-link" type="button" data-act="auth-mode" data-id="forgot">Olvidé mi contraseña</button>
        </form>
      </div>
    </section>`;
  }

  function openSession() {
    return (state.data.cash_sessions || []).find((session) => session.status === "OPEN" && session.user_id === (state.user && state.user.id) && session.store_id === ui.storeId);
  }

  function denied(list) {
    if (!state.user) return `<section style="padding:28px 0"><h1>Entra primero</h1><p class="muted">Esta sección es del equipo.</p><a class="btn" href="#entrar">Entrar</a></section>`;
    if (!allow(list)) return `<section style="padding:28px 0"><h1>Esta sección no es para tu rol</h1><p class="muted">Tu rol es ${esc(ROLE_LABEL[role()] || role())}. El administrador lo cambia en Equipo.</p></section>`;
    return "";
  }

  function renderTaller() {
    const block = denied(["SUPERVISOR", "ALMACENERO"]);
    if (block) return block;
    const tabs = [["hoy", "Hoy"], ["telas", "Telas"], ["sastres", "Sastres"], ["enviar", "Enviar"], ["recibir", "Recibir"], ["empatar", "Empatar"], ["pedidos", "Pedidos"]];
    (window.DL_TALLER_TABS || []).forEach((t) => tabs.unshift([t.id, t.label]));
    const ext = (window.DL_TALLER_TABS || []).find((t) => t.id === ui.taller);
    const body = ext ? ext.render : ({ hoy: tallerHoy, telas: tallerTelas, sastres: tallerSastres, enviar: tallerEnviar, recibir: tallerRecibir, empatar: tallerEmpatar, pedidos: tallerPedidos }[ui.taller] || tallerHoy);
    return `<section style="padding:22px 0 48px"><p class="kicker">Producción</p><h1>Taller</h1><div class="tabs" id="taller-tabs">${tabs.map(([id, label]) => `<a class="chip ${ui.taller === id ? "on" : ""}" href="#taller/${id}">${label}</a>`).join("")}</div>${body()}</section>`;
  }
  function tallerHoy() {
    const orders = state.data.work_orders || [];
    const pieces = (state.data.workshop_pieces || []).filter((row) => row.status === "LIBRE" && Number(row.quantity) > 0);
    return `<div class="split">
      <div class="stack"><h3>Órdenes</h3>${table(["Orden", "Sastre", "Pieza", "Estado"], orders.map((row) => [row.order_number, nameOf("tailors", row.tailor_id), row.piece_type, row.status + " · " + (row.qty_received || 0) + "/" + row.qty_expected]))}</div>
      <div class="stack"><h3>Piezas libres</h3>${table(["Pieza", "Talla", "Tela", "Cant."], pieces.map((row) => [row.piece_type, row.size_label, nameOf("fabrics", row.fabric_id), row.quantity]))}</div>
    </div>`;
  }
  function tallerTelas() {
    const lots = state.data.fabric_lots || [];
    return renderCrud("fabrics") + renderCrud("fabric_suppliers") + `<div class="panel stack" style="margin-top:16px"><h3>Lote nuevo</h3>
      <form class="stack" data-form="lot">${refField("supplier_id", "Proveedor", "fabric_suppliers")}${refField("fabric_id", "Tela", "fabrics")}
      <div class="two"><label>Metros comprados<input name="meters" type="number" min="0.1" step="0.1" required></label><label>Metros que quedan<input name="left" type="number" min="0" step="0.1" required></label></div>
      <button class="btn" type="submit">Guardar lote</button></form>
      ${table(["Tela", "Proveedor", "Quedan"], lots.map((row) => [nameOf("fabrics", row.fabric_id), nameOf("fabric_suppliers", row.supplier_id), (Number(row.meters_left_cm) / 100).toFixed(2) + " m"]))}</div>`;
  }
  function tallerSastres() { return renderCrud("tailors"); }
  function tallerEnviar() {
    return `<form class="panel stack" data-form="send" style="max-width:640px">
      <h3>Enviar corte</h3>
      ${refField("tailor_id", "Sastre", "tailors")}
      <label>Lote<select name="fabric_lot_id" required>${(state.data.fabric_lots || []).map((row) => `<option value="${esc(row.id)}">${esc(nameOf("fabrics", row.fabric_id))} · ${(Number(row.meters_left_cm) / 100).toFixed(2)} m</option>`).join("")}</select></label>
      <div class="two"><label>Pieza<select name="piece_type"><option>SACO</option><option>PANTALON</option><option>CHALECO</option></select></label>
      <label>Para<select name="audience"><option>ADULTO</option><option>JOVEN</option></select></label></div>
      <div class="two"><label>Metros<input name="meters" type="number" min="0.1" step="0.1" required></label><label>Cantidad<input name="qty" type="number" min="1" value="1" required></label></div>
      <label>Tallas<input name="sizes" placeholder="Ej. 48, 50"></label>
      <button class="btn" type="submit">Enviar al maestro</button>
    </form>`;
  }
  function tallerRecibir() {
    const open = (state.data.work_orders || []).filter((row) => row.status !== "RECIBIDO");
    return `<form class="panel stack" data-form="receive" style="max-width:640px"><h3>Recibir del sastre</h3>
      <label>Orden<select name="work_order_id" required>${open.map((row) => `<option value="${esc(row.id)}">${esc(row.order_number)} · ${esc(row.piece_type)}</option>`).join("")}</select></label>
      <div class="two"><label>Talla<input name="size_label" required></label><label>Cantidad<input name="quantity" type="number" min="1" value="1" required></label></div>
      <button class="btn" type="submit">Entrar piezas al taller</button></form>`;
  }
  function tallerEmpatar() {
    const pieces = (state.data.workshop_pieces || []).filter((row) => row.status === "LIBRE" && Number(row.quantity) > 0);
    const whs = state.data.warehouses || [];
    return `<form class="panel stack" data-form="assemble">
      <h3>Empatar terno</h3>
      <p class="tiny">Marca saco y pantalón de la misma tela y talla. El chaleco es opcional. Sale una pieza nueva a la colección.</p>
      ${pieces.map((row) => `<label class="checks"><input type="checkbox" name="piece" value="${esc(row.id)}"> ${esc(row.piece_type)} ${esc(row.size_label)} · ${esc(nameOf("fabrics", row.fabric_id))} · ${esc(row.quantity)}</label>`).join("") || `<p class="muted">No hay piezas libres.</p>`}
      <div class="two"><label>Nombre del terno<input name="line_name" required placeholder="Nombre del terno"></label><label>Precio (S/)<input name="price" type="number" min="1" step="0.01" required></label></div>
      <div class="two"><label>Talla<input name="size_label" required></label><label>Almacén de destino<select name="warehouse_id">${whs.map((row) => `<option value="${esc(row.id)}">${esc(row.name)}</option>`).join("")}</select></label></div>
      <button class="btn" type="submit">Crear terno y sumar stock</button>
    </form>`;
  }
  function tallerPedidos() {
    const orders = state.data.store_orders || [];
    return `<div class="split"><form class="panel stack" data-form="store-order"><h3>Pedido entre tiendas</h3>
      ${refField("store_id", "Tienda que pide", "stores")}
      <label>Nota<textarea name="notes" required></textarea></label>
      <button class="btn" type="submit">Anotar pedido</button></form>
      <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Tienda</th><th>Estado</th><th></th></tr></thead><tbody>
      ${orders.map((row) => `<tr><td>${esc(row.order_number)}<br><span class="tiny">${esc(row.notes || "")}</span></td><td>${esc(nameOf("stores", row.store_id))}</td><td>${esc(row.status)}</td><td>${row.status !== "DESPACHADO" ? `<button class="btn small" type="button" data-act="dispatch" data-id="${esc(row.id)}">Despachar</button>` : ""}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  }

  window.DL_ADMIN_TABS = (window.DL_ADMIN_TABS || []).concat([{ id: "pedidos", label: "Pedidos web", need: ["SUPERVISOR", "VENDEDOR", "CAJERO"], render: () => ordersPanel(null) }]);
  function renderAdmin() {
    const block = denied(["SUPERVISOR", "ALMACENERO"]);
    if (block) return block;
    let tabs = [["inicio", "Inicio / Colección"], ["resumen", "Resumen"], ["ventas", "Ventas"], ["products", "Piezas"], ["categories", "Categorías"], ["sizes", "Tallas"], ["brands", "Marcas"], ["stores", "Tiendas"], ["warehouses", "Almacenes"], ["cash_registers", "Cajas"], ["document_series", "Series"], ["panel", "Panel de tienda"], ["reporte", "Reporte general"], ["stock", "Stock"], ["customers", "Clientes"], ["promos", "Promociones"], ["expenses", "Gastos"], ["partners", "Mayoristas"], ["staff", "Equipo"], ["fabrics", "Telas"], ["colors", "Colores"]];
    (window.DL_ADMIN_TABS || []).forEach((t) => { if (!t.need || allow(t.need)) tabs.push([t.id, t.label]); });
    if (!isAdmin() && !allow(["SUPERVISOR"]) && allow(["ALMACENERO"])) {
      tabs = tabs.filter(([id]) => id === "products" || id === "stock" || (window.DL_ADMIN_TABS || []).some((t) => t.id === id));
      if (!tabs.some(([id]) => id === ui.admin)) ui.admin = "products";
    }
    let body = "";
    const extTab = (window.DL_ADMIN_TABS || []).find((t) => t.id === ui.admin);
    if (extTab) body = extTab.render();
    else if (ui.admin === "products") body = renderPiezas();
    else if (ui.admin === "resumen") body = renderResumen();
    else if (ui.admin === "ventas") body = renderVentas();
    else if (ui.admin === "stock") body = renderStock();
    else if (ui.admin === "staff") body = renderStaff();
    else if (ui.admin === "customers" && window.DL_renderClientes && Store.mode === "remote") body = window.DL_renderClientes();
    else if (ui.admin === "panel") body = renderStorePanel();
    else if (ui.admin === "inicio") body = renderHomeSettings();
    else if (ui.admin === "reporte") body = renderGeneralReport();
    else if (ui.admin === "partners") body = renderPriceGrid() + (window.DL_wholesaleCustomers ? window.DL_wholesaleCustomers() : "") + renderCrud("partners") + renderMoves();
    else if (SPECS[ui.admin]) body = renderCrud(ui.admin);
    else body = renderResumen();
    const GROUPS = [
      ["Ventas", ["resumen", "ventas", "pedidos", "customers", "promos", "adelantos", "cajas", "consignacion"]],
      ["Productos", ["products", "categories", "sizes", "fabrics", "colors", "brands", "stock", "traslados", "produccion", "recepcion", "partners"]],
      ["Tiendas", ["stores", "warehouses", "cash_registers", "document_series", "panel"]],
      ["Personal", ["staff", "asistencia"]],
      ["Configuración", ["inicio", "expenses"]],
      ["Reportes", ["reporte"]],
    ];
    const label = Object.fromEntries(tabs);
    const used = new Set();
    const groups = GROUPS.map(([g, ids]) => [g, ids.filter((id) => label[id] && !used.has(id) && used.add(id))]).filter(([, ids]) => ids.length);
    const rest = tabs.filter(([id]) => !used.has(id)).map(([id]) => id);
    if (rest.length) groups.push(["Más", rest]);
    const current = label[ui.admin] || "Resumen";
    const drawer = `<div class="admin-drawer ${ui.drawer ? "open" : ""}" ${ui.drawer ? "" : "hidden"}>
      <div class="drawer-scrim" data-act="admin-menu"></div>
      <nav class="drawer-panel" aria-label="Opciones de administración">
        <div class="row drawer-head"><b>Administración</b><button class="icon-btn" type="button" data-act="admin-menu" aria-label="Cerrar">${icon("close", 18)}</button></div>
        ${groups.map(([g, ids]) => `<div class="drawer-group"><p class="kicker">${esc(g)}</p>${ids.map((id) => `<a class="drawer-link ${ui.admin === id ? "on" : ""}" href="#admin/${id}" data-drawer-link>${esc(label[id])}</a>`).join("")}</div>`).join("")}
      </nav></div>`;
    return `<section style="padding:22px 0 48px"><p class="kicker">Casa</p>
      <div class="row admin-title"><button class="icon-btn admin-menu-btn" type="button" data-act="admin-menu" aria-label="Menú">${icon("menu", 20)}</button><h1>Administración</h1><span class="tiny admin-current">${esc(current)}</span></div>
      ${drawer}
      ${body}</section>`;
  }
  // Reportes y estadísticas
  const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const charts = [];
  function sumCents(list, key) { return list.reduce((sum, row) => sum + Number(row[key] || 0), 0); }
  function pct(now, before) {
    if (!before) return now ? `<span class="tiny up">nuevo</span>` : `<span class="tiny">—</span>`;
    const p = Math.round((now - before) / before * 100);
    return `<span class="tiny ${p >= 0 ? "up" : "down"}">${p >= 0 ? "▲" : "▼"} ${Math.abs(p)}% vs anterior</span>`;
  }
  function itemsOf(sales) {
    const ids = new Set(sales.map((s) => s.id));
    return (state.data.sale_items || []).filter((row) => ids.has(row.sale_id));
  }
  function group(list, keyFn, valFn) {
    const map = new Map();
    list.forEach((row) => {
      const key = keyFn(row);
      const cur = map.get(key) || { key, n: 0, cents: 0, units: 0 };
      cur.n += 1; cur.cents += valFn ? valFn(row) : 0; cur.units += Number(row.quantity || 0);
      map.set(key, cur);
    });
    return [...map.values()];
  }
  function fabricName(product) {
    const fab = product && byId("fabrics", product.fabric_id);
    return fab ? fab.name : "—";
  }
  function combos(items) {
    return group(items, (row) => {
      const p = byId("products", row.product_id) || {};
      return [p.name || row.product_id, fabricName(p), p.color || "—", p.size_label || "—"].join("|");
    }, (row) => Number(row.line_total_cents || 0)).sort((a, b) => b.units - a.units || b.cents - a.cents);
  }
  function completedSales() { return (state.data.sales || []).filter((sale) => sale.status === "COMPLETED"); }
  function bars(rows, label, value, fmt) {
    if (!rows.length) return `<p class="muted">Sin datos.</p>`;
    const max = Math.max(...rows.map(value), 1);
    return `<div class="hbars">${rows.map((row) => `<div class="hbar"><span>${esc(label(row))}</span><i style="width:${Math.max(3, Math.round(value(row) / max * 100))}%"></i><b>${esc(fmt(row))}</b></div>`).join("")}</div>`;
  }

  function renderResumen() {
    const today = localDay(new Date());
    const sales = completedSales();
    const todayTotal = sumCents(sales.filter((sale) => localDay(sale.sold_at) === today), "total_cents");
    const now = new Date();
    const month = today.slice(0, 7);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = localDay(prevDate).slice(0, 7);
    const dayOfMonth = now.getDate();
    const monthSales = sales.filter((sale) => localDay(sale.sold_at).slice(0, 7) === month);
    const prevSales = sales.filter((sale) => localDay(sale.sold_at).slice(0, 7) === prevMonth && new Date(sale.sold_at).getDate() <= dayOfMonth);
    const monthTotal = sumCents(monthSales, "total_cents");
    const prevTotal = sumCents(prevSales, "total_cents");
    const ticket = monthSales.length ? Math.round(monthTotal / monthSales.length) : 0;
    const prevTicket = prevSales.length ? Math.round(prevTotal / prevSales.length) : 0;
    const monthItems = itemsOf(monthSales);
    const margin = monthItems.reduce((sum, row) => sum + Number(row.line_total_cents || 0) - Number(row.cost_cents || 0) * Number(row.quantity || 1), 0);
    const expenses = sumCents((state.data.expenses || []).filter((row) => String(row.expense_date).slice(0, 7) === month), "amount_cents");
    const th = Number.isFinite(ui.lowTh) ? ui.lowTh : null;
    const low = (state.data.products || []).filter((p) => !p.deleted_at).filter((product) => stockOf(product) <= (th == null ? Number(product.min_stock || 0) : th))
      .sort((a, b) => stockOf(a) - stockOf(b));
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = localDay(date);
      days.push({ label: key.slice(5), total: sumCents(sales.filter((sale) => localDay(sale.sold_at) === key), "total_cents") });
    }
    const max = Math.max(...days.map((day) => day.total), 1);
    const byStore = group(monthSales, (s) => nameOf("stores", s.store_id), (s) => Number(s.total_cents)).sort((a, b) => b.cents - a.cents);
    const bySeller = group(monthSales, (s) => s.seller_name || "—", (s) => Number(s.total_cents)).sort((a, b) => b.cents - a.cents);
    const top = combos(itemsOf(sales.filter((s) => (now - new Date(s.sold_at)) / 864e5 <= 90))).slice(0, 10);
    return `<div class="stats">
      <article class="stat"><span class="tiny">Hoy</span><b>${moneyHtml(todayTotal)}</b></article>
      <article class="stat"><span class="tiny">Mes</span><b>${moneyHtml(monthTotal)}</b>${pct(monthTotal, prevTotal)}</article>
      <article class="stat"><span class="tiny">Ticket promedio (mes)</span><b>${moneyHtml(ticket)}</b>${pct(ticket, prevTicket)}</article>
      <article class="stat"><span class="tiny">Ventas del mes</span><b><span class="num">${monthSales.length}</span></b>${pct(monthSales.length, prevSales.length)}</article>
      <article class="stat"><span class="tiny">Margen bruto (mes)</span><b>${moneyHtml(margin)}</b></article>
      <article class="stat"><span class="tiny">Gastos del mes</span><b>${moneyHtml(expenses)}</b></article>
      <article class="stat"><span class="tiny">Resultado (margen − gastos)</span><b>${moneyHtml(margin - expenses)}</b></article>
      <article class="stat"><span class="tiny">Piezas en stock bajo</span><b><span class="num">${low.length}</span></b></article>
    </div>
    <div class="panel"><p class="kicker">Siete días</p><div class="chart">${days.map((day) => `<div class="bar"><i style="height:${Math.max(4, Math.round(day.total / max * 100))}%"></i><small>${esc(day.label)}</small></div>`).join("")}</div></div>
    <div class="split" style="margin-top:16px">
      <div class="panel"><p class="kicker">Ventas por tienda · mes</p>${bars(byStore, (r) => r.key, (r) => r.cents, (r) => soles(r.cents) + " · " + r.n)}</div>
      <div class="panel"><p class="kicker">Ventas por vendedor · mes</p>${bars(bySeller, (r) => r.key, (r) => r.cents, (r) => soles(r.cents) + " · " + r.n)}</div>
    </div>
    <div class="panel" style="margin-top:16px"><p class="kicker">Combinaciones más vendidas · 90 días</p><p class="tiny">Terno × tela × color × talla</p>
      ${table(["Pieza", "Tela", "Color", "Talla", "Uds.", "Total"], top.map((r) => { const [a, b, c, d] = r.key.split("|"); return [a, b, c, d, r.units, soles(r.cents)]; }))}</div>
    <div class="split" style="margin-top:16px">
      <div>${table(["Venta", "Total", "Pago"], sales.slice().sort((a, b) => String(b.sold_at).localeCompare(String(a.sold_at))).slice(0, 6).map((sale) => [sale.sale_number, soles(sale.total_cents), PAY[sale.payment_method] || sale.payment_method]))}</div>
      <div class="panel"><div class="row" style="justify-content:space-between;align-items:end;gap:8px;flex-wrap:wrap"><p class="kicker">Stock bajo</p>
        <label class="tiny">Avisar con ≤ <input id="low-th" type="number" min="0" style="width:70px" value="${th == null ? "" : th}" placeholder="mín."></label></div>
        <p class="tiny">${th == null ? "Usando el stock mínimo de cada pieza." : "Umbral fijo: " + th + " unidades."}</p>
        ${low.length ? table(["Pieza", "Talla", "Stock", "Mínimo"], low.map((product) => [product.name, product.size_label || "—", stockOf(product), product.min_stock])) : `<p class="muted">La colección está cubierta.</p>`}</div>
    </div>${renderStoreReport()}`;
  }

  function salesFilter() {
    const vf = ui.vf || (ui.vf = { from: localDay(new Date(Date.now() - 59 * 864e5)), to: localDay(new Date()), store: "", seller: "" });
    return vf;
  }
  function filteredSales(includeVoid) {
    const vf = salesFilter();
    return (state.data.sales || []).filter((s) => {
      const d = localDay(s.sold_at);
      if (!includeVoid && s.status !== "COMPLETED") return false;
      if (vf.from && d < vf.from) return false;
      if (vf.to && d > vf.to) return false;
      if (vf.store && s.store_id !== vf.store) return false;
      if (vf.seller && (s.seller_name || "") !== vf.seller) return false;
      return true;
    });
  }
  function renderVentas() {
    const vf = salesFilter();
    const all = filteredSales(true).sort((a, b) => String(b.sold_at).localeCompare(String(a.sold_at)));
    const sales = all.filter((s) => s.status === "COMPLETED");
    const total = sumCents(sales, "total_cents");
    const items = itemsOf(sales);
    const units = items.reduce((n, r) => n + Number(r.quantity || 0), 0);
    const span = Math.max(1, Math.round((new Date(vf.to) - new Date(vf.from)) / 864e5) + 1);
    const pFrom = localDay(new Date(new Date(vf.from + "T00:00").getTime() - span * 864e5));
    const pTo = localDay(new Date(new Date(vf.from + "T00:00").getTime() - 864e5));
    const prev = completedSales().filter((s) => { const d = localDay(s.sold_at); return d >= pFrom && d <= pTo && (!vf.store || s.store_id === vf.store) && (!vf.seller || s.seller_name === vf.seller); });
    const prevTotal = sumCents(prev, "total_cents");
    const byProduct = group(items, (r) => (byId("products", r.product_id) || {}).name || r.product_id, (r) => Number(r.line_total_cents || 0));
    const names = [...new Set((state.data.products || []).filter((p) => !p.deleted_at).map((p) => p.name))];
    names.forEach((n) => { if (!byProduct.some((r) => r.key === n)) byProduct.push({ key: n, n: 0, cents: 0, units: 0 }); });
    const topP = byProduct.slice().sort((a, b) => b.units - a.units || b.cents - a.cents).slice(0, 8);
    const lowP = byProduct.slice().sort((a, b) => a.units - b.units || a.cents - b.cents).slice(0, 8);
    const byDay = group(sales, (s) => localDay(s.sold_at), (s) => Number(s.total_cents)).sort((a, b) => b.cents - a.cents).slice(0, 7);
    const byCat = group(items, (r) => nameOf("categories", (byId("products", r.product_id) || {}).category_id), (r) => Number(r.line_total_cents || 0)).sort((a, b) => b.cents - a.cents);
    const byPay = group(sales, (s) => PAY[s.payment_method] || s.payment_method, (s) => Number(s.total_cents)).sort((a, b) => b.cents - a.cents);
    const bySize = group(items, (r) => (byId("products", r.product_id) || {}).size_label || "—", () => 0).sort((a, b) => b.units - a.units);
    const sellers = [...new Set((state.data.sales || []).map((s) => s.seller_name).filter(Boolean))].sort();
    const stores = (state.data.stores || []);
    return `<form class="panel filters" data-form="noop">
        <label>Desde<input type="date" data-vf="from" value="${esc(vf.from)}"></label>
        <label>Hasta<input type="date" data-vf="to" value="${esc(vf.to)}"></label>
        <label>Tienda<select data-vf="store"><option value="">Todas</option>${stores.map((s) => `<option value="${esc(s.id)}" ${s.id === vf.store ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
        <label>Vendedor<select data-vf="seller"><option value="">Todos</option>${sellers.map((s) => `<option ${s === vf.seller ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
        <div class="row" style="gap:6px;flex-wrap:wrap">${[[7, "7 días"], [30, "30 días"], [90, "90 días"]].map(([d, l]) => `<button class="chip" type="button" data-act="vf-range" data-id="${d}">${l}</button>`).join("")}</div>
      </form>
      <div class="stats">
        <article class="stat"><span class="tiny">Vendido</span><b>${moneyHtml(total)}</b>${pct(total, prevTotal)}</article>
        <article class="stat"><span class="tiny">Ventas</span><b><span class="num">${sales.length}</span></b>${pct(sales.length, prev.length)}</article>
        <article class="stat"><span class="tiny">Ticket promedio</span><b>${moneyHtml(sales.length ? Math.round(total / sales.length) : 0)}</b></article>
        <article class="stat"><span class="tiny">Unidades · anuladas</span><b><span class="num">${units}</span> · <span class="num">${all.length - sales.length}</span></b></article>
      </div>
      <div class="panel"><p class="kicker">Tendencia diaria</p><div class="chart-box"><canvas id="ch-trend"></canvas></div></div>
      <div class="split" style="margin-top:16px">
        <div class="panel"><p class="kicker">Por día de la semana</p><div class="chart-box"><canvas id="ch-week"></canvas></div></div>
        <div class="panel"><p class="kicker">Por hora</p><div class="chart-box"><canvas id="ch-hour"></canvas></div></div>
      </div>
      <div class="split" style="margin-top:16px">
        <div class="panel"><p class="kicker">Más vendidos</p>${bars(topP, (r) => r.key, (r) => r.units, (r) => r.units + " uds · " + soles(r.cents))}</div>
        <div class="panel"><p class="kicker">Menos vendidos</p>${bars(lowP, (r) => r.key, (r) => r.units + 0.0001, (r) => r.units + " uds")}</div>
      </div>
      <div class="split" style="margin-top:16px">
        <div class="panel"><p class="kicker">Días pico</p>${table(["Fecha", "Día", "Ventas", "Total"], byDay.map((r) => [r.key, DAY_NAMES[new Date(r.key + "T12:00").getDay()], r.n, soles(r.cents)]))}</div>
        <div class="panel"><p class="kicker">Por categoría</p>${bars(byCat, (r) => r.key, (r) => r.cents, (r) => soles(r.cents))}
          <p class="kicker" style="margin-top:14px">Por método de pago</p>${bars(byPay, (r) => r.key, (r) => r.cents, (r) => soles(r.cents) + " · " + r.n)}
          <p class="kicker" style="margin-top:14px">Tallas que más salen</p>${bars(bySize.slice(0, 8), (r) => r.key, (r) => r.units, (r) => r.units + " uds")}</div>
      </div>
      <h3 style="margin:18px 0 8px">Detalle de ventas</h3>
      <div class="table-wrap"><table><thead><tr><th>Venta</th><th>Tienda / vendedor</th><th>Total</th><th>Pago</th><th>Estado</th><th></th></tr></thead><tbody>
      ${all.map((sale) => `<tr><td>${esc(sale.sale_number)}<br><span class="tiny">${esc(localDay(sale.sold_at))}</span></td><td>${esc(nameOf("stores", sale.store_id))}<br><span class="tiny">${esc(sale.seller_name || "—")}</span></td><td>${soles(sale.total_cents)}</td><td>${esc(PAY[sale.payment_method] || sale.payment_method)}</td><td>${sale.status === "VOID" ? "Anulada" : "Cobrada"}</td><td>${sale.status === "COMPLETED" && allow(["SUPERVISOR"]) ? `<button class="btn danger small" type="button" data-act="void" data-id="${esc(sale.id)}">Anular</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6">Sin ventas en el rango.</td></tr>`}
    </tbody></table></div>`;
  }
  function drawCharts() {
    while (charts.length) { try { charts.pop().destroy(); } catch { } }
    const staffCanvas = document.getElementById("ch-staff");
    if (staffCanvas && window.Chart) {
      const person = byId("staff", staffCanvas.dataset.id);
      const ss = person ? sellerSales(person) : [];
      const lb = []; const vv = [];
      for (let i = 59; i >= 0; i -= 1) { const k = localDay(new Date(Date.now() - i * 864e5)); lb.push(k.slice(5)); vv.push(sumCents(ss.filter((s) => localDay(s.sold_at) === k), "total_cents") / 100); }
      const css = getComputedStyle(document.documentElement);
      const gold = css.getPropertyValue("--gold").trim(); const mut = css.getPropertyValue("--muted").trim(); const ln = css.getPropertyValue("--line").trim();
      charts.push(new window.Chart(staffCanvas, { type: "bar", data: { labels: lb, datasets: [{ data: vv, backgroundColor: gold }] }, options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: mut, maxRotation: 0, autoSkip: true }, grid: { color: ln } }, y: { beginAtZero: true, ticks: { color: mut }, grid: { color: ln } } } } }));
    }
    if (!document.getElementById("ch-trend")) return;
    if (!window.Chart) { document.querySelectorAll(".chart-box").forEach((box) => { box.innerHTML = `<p class="muted tiny">Los gráficos necesitan internet (Chart.js).</p>`; }); return; }
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--muted").trim() || "#666";
    const gold = css.getPropertyValue("--gold").trim() || "#8d6840";
    const line = css.getPropertyValue("--line").trim() || "#ddd";
    const vf = salesFilter();
    const sales = filteredSales(false);
    const labels = []; const vals = [];
    for (let d = new Date(vf.from + "T12:00"); localDay(d) <= vf.to; d.setDate(d.getDate() + 1)) {
      const key = localDay(d); labels.push(key.slice(5));
      vals.push(sumCents(sales.filter((s) => localDay(s.sold_at) === key), "total_cents") / 100);
      if (labels.length > 400) break;
    }
    const week = [0, 0, 0, 0, 0, 0, 0]; const hours = new Array(24).fill(0);
    sales.forEach((s) => { const d = new Date(s.sold_at); week[d.getDay()] += Number(s.total_cents) / 100; hours[d.getHours()] += 1; });
    const firstH = Math.max(0, hours.findIndex((n) => n > 0)); const lastH = Math.max(firstH, 23 - hours.slice().reverse().findIndex((n) => n > 0));
    const opts = (yLabel) => ({ responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: ink, maxRotation: 0, autoSkip: true }, grid: { color: line } }, y: { beginAtZero: true, ticks: { color: ink }, grid: { color: line }, title: { display: !!yLabel, text: yLabel, color: ink } } } });
    charts.push(new window.Chart(document.getElementById("ch-trend"), { type: "line", data: { labels, datasets: [{ data: vals, borderColor: gold, backgroundColor: gold + "33", fill: true, tension: 0.3, pointRadius: 0 }] }, options: opts("S/") }));
    const wkOrder = [1, 2, 3, 4, 5, 6, 0];
    charts.push(new window.Chart(document.getElementById("ch-week"), { type: "bar", data: { labels: wkOrder.map((i) => DAY_NAMES[i]), datasets: [{ data: wkOrder.map((i) => week[i]), backgroundColor: gold }] }, options: opts("S/") }));
    const hl = []; const hv = []; for (let h = firstH; h <= lastH; h += 1) { hl.push(h + "h"); hv.push(hours[h]); }
    charts.push(new window.Chart(document.getElementById("ch-hour"), { type: "bar", data: { labels: hl, datasets: [{ data: hv, backgroundColor: gold }] }, options: opts("ventas") }));
  }

  function sizeList() {
    const rows = (state.data.sizes || []).slice();
    const list = rows.length ? rows : window.DL_DEFAULT_SIZES();
    const labels = list.slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).map((r) => r.label);
    (state.data.products || []).forEach((p) => { if (p.size_label && !labels.includes(p.size_label)) labels.push(p.size_label); });
    return labels;
  }
  function canProducts() { return allow(["SUPERVISOR", "ALMACENERO"]); }
  function pformFrom(key) {
    const vars = bySize((state.data.products || []).filter((v) => key && (v.group_key || v.product_id) === String(key)));
    const f = vars[0] || {};
    return {
      key: key || "", product_id: f.product_id || "", name: f.name || "", category_id: f.category_id || "", brand_id: f.brand_id || "",
      fabric_id: f.fabric_id || "", color_id: f.color_id || "", description: f.description || "",
      show_in_catalog: f.show_in_catalog !== false, hide_below_stock: f.hide_below_stock ?? "",
      general: (f.general_images || []).slice(),
      sizes: vars.map((v) => ({ variant_id: v.id, size_id: v.size_id, size_label: v.size_label, sku: v.sku || "", barcode: v.barcode || "", is_active: !v.deleted_at,
        sale_cents: v.sale_price_cents || 0, offer_cents: v.is_offer ? v.offer_price_cents || 0 : 0, min_cents: v.min_price_cents || 0,
        wholesale_cents: v.wholesale_price_cents || 0, cost_cents: v.cost_price_cents || 0, images: (v.own_images || []).slice(), stock: stockOf(v) })),
    };
  }
  function syncPform() {
    const P = ui.pform; const form = document.getElementById("product-form"); if (!P || !form) return P;
    const el = form.elements; const val = (n) => (el[n] ? el[n].value : "");
    Object.assign(P, { name: val("name").trim(), category_id: val("category_id"), brand_id: val("brand_id"), fabric_id: P.key ? P.fabric_id : val("fabric_id"), color_id: P.key ? P.color_id : val("color_id"),
      description: val("description").trim(), hide_below_stock: val("hide_below_stock"), show_in_catalog: el.show_in_catalog ? el.show_in_catalog.checked : true });
    const c = (v) => Math.round((Number(String(v || "").replace(",", ".")) || 0) * 100);
    P.sizes.forEach((z, i) => {
      const g = (f) => form.querySelector(`[name="vr-${i}-${f}"]`);
      if (!g("sku")) return;
      z.sku = g("sku").value.trim(); z.sale_cents = c(g("sale").value); z.is_active = g("active").checked;
      z.barcode = g("barcode").value.trim(); z.offer_cents = c(g("offer").value); z.min_cents = c(g("min").value); z.wholesale_cents = c(g("wholesale").value); z.cost_cents = c(g("cost").value);
    });
    return P;
  }
  function renderPiezas() {
    const all = (state.data.products || []);
    if (!ui.pform) ui.pform = pformFrom("");
    const P = ui.pform;
    const money = (v) => (v ? (Number(v) / 100).toFixed(2) : "");
    const sizes = (state.data.sizes || []).filter((z) => z.is_active !== false).slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    const selected = new Set(P.sizes.map((z) => String(z.size_id)));
    const opts = (list, cur, label) => `<option value="">${label}</option>` + list.map((r) => `<option value="${esc(r.id)}" ${String(cur) === String(r.id) ? "selected" : ""}>${esc(r.name)}</option>`).join("") + (P.key ? "" : `<option value="__new">+ Nueva</option>`);
    const newBox = (t) => P.adding === t ? `<div class="row inline-new"><input id="new-${t}" class="grow" placeholder="${t === "fabrics" ? "Nombre de la tela" : "Nombre del color"}" autocomplete="off">${t === "colors" ? `<input id="new-colors-hex" type="color" value="#000000" aria-label="Tono">` : ""}<button class="btn small" type="button" data-act="cat-new-save" data-id="${t}">Agregar</button><button class="btn ghost small" type="button" data-act="cat-new-cancel" aria-label="Cancelar">×</button></div>` : "";
    const rows = P.sizes.map((z, i) => `<div class="variant-row ${z.is_active ? "" : "off"}">
        <span class="vr-size">${esc(z.size_label)}</span>
        <input name="vr-${i}-sku" value="${esc(z.sku)}" placeholder="Código (vacío = auto)" autocapitalize="characters" aria-label="Código talla ${esc(z.size_label)}">
        <input name="vr-${i}-sale" inputmode="decimal" value="${money(z.sale_cents)}" placeholder="Precio" aria-label="Precio talla ${esc(z.size_label)}">
        <label class="checks" title="Activa"><input type="checkbox" name="vr-${i}-active" ${z.is_active ? "checked" : ""}> Activa</label>
        <details class="vr-more"><summary class="tiny">Más datos${z.variant_id ? " · stock " + Number(z.stock || 0) : ""}</summary>
          <label class="tiny">Código de barras (vacío = automático)<input name="vr-${i}-barcode" value="${esc(z.barcode || "")}" inputmode="text"></label>
          <div class="two"><label class="tiny">Oferta / remate<input name="vr-${i}-offer" inputmode="decimal" value="${money(z.offer_cents)}"></label><label class="tiny">Precio mínimo<input name="vr-${i}-min" inputmode="decimal" value="${money(z.min_cents)}"></label></div>
          <div class="two"><label class="tiny">Por mayor<input name="vr-${i}-wholesale" inputmode="decimal" value="${money(z.wholesale_cents)}"></label><label class="tiny">Costo<input name="vr-${i}-cost" inputmode="decimal" value="${money(z.cost_cents)}"></label></div>
        </details>
        <div class="variant-photos">${z.images.map((u, n) => `<button type="button" class="vr-ph" data-act="vr-ph-del" data-id="${i}" data-n="${n}" aria-label="Quitar foto ${n + 1}"><img alt="" src="${esc(safeSrc(u))}"></button>`).join("")}<button type="button" class="add-ph" data-act="vr-ph-add" data-id="${i}" aria-label="Agregar foto de la talla ${esc(z.size_label)}">+</button></div>
      </div>`).join("");
    const form = `<form class="panel stack" data-form="product" id="product-form">
      <h3>${P.product_id ? "Editar pieza" : "Nueva pieza"}</h3>
      <label>Nombre<input name="name" required value="${esc(P.name)}" placeholder="Nombre de la prenda"></label>
      <div class="two">${refField("category_id", "Categoría", "categories", null, P.category_id, true)}${refField("brand_id", "Marca", "brands", null, P.brand_id)}</div>
      <div class="two"><label>Tela<select name="fabric_id" required ${P.key ? "disabled" : ""}>${opts((state.data.fabrics || []).filter((r) => r.is_active !== false || String(r.id) === String(P.fabric_id)), P.fabric_id, "Elige tela")}</select>${newBox("fabrics")}</label>
        <label>Color<select name="color_id" required ${P.key ? "disabled" : ""}>${opts((state.data.colors || []).filter((c) => c.is_active !== false || String(c.id) === String(P.color_id)), P.color_id, "Elige color")}</select>${newBox("colors")}</label></div>
      ${P.key ? `<p class="tiny">Para otro color o tela crea una pieza nueva con el mismo nombre.</p>` : ""}
      <label>Descripción<textarea name="description">${esc(P.description)}</textarea></label>
      <div class="two"><label class="checks"><input type="checkbox" name="show_in_catalog" ${P.show_in_catalog ? "checked" : ""}> Visible en la Colección</label>
        <label>Ocultar con stock menor a<input name="hide_below_stock" type="number" min="0" placeholder="Vacío = no ocultar" value="${esc(P.hide_below_stock)}"></label></div>
      <fieldset class="photo-box"><legend>Tallas disponibles</legend>
        <div class="size-toggles">${sizes.map((z) => `<button type="button" class="chip ${selected.has(String(z.id)) ? "on" : ""}" data-act="sz-toggle" data-id="${esc(z.id)}" aria-pressed="${selected.has(String(z.id))}">${esc(z.label)}</button>`).join("")}</div>
        <p class="tiny">Cada talla tiene su código, precio, stock y fotos (Drive: Compartir → “Cualquier persona con el enlace”). Si apagas “Activa”, la talla se desactiva (o se elimina si nunca se usó).</p>
        <div class="stack">${rows || `<p class="muted">Elige al menos una talla.</p>`}</div>
      </fieldset>
      <fieldset class="photo-box"><legend>Fotos generales (todas las tallas)</legend>
        <div class="variant-photos">${P.general.map((u, n) => `<button type="button" class="vr-ph" data-act="vr-ph-del" data-id="g" data-n="${n}" aria-label="Quitar foto"><img alt="" src="${esc(safeSrc(u))}"></button>`).join("")}<button type="button" class="add-ph" data-act="vr-ph-add" data-id="g" aria-label="Agregar foto general">+</button></div>
      </fieldset>
      <div class="row"><button class="btn" type="submit">Guardar pieza</button>${P.product_id || P.sizes.length ? `<button class="btn ghost" type="button" data-act="pnew">Nueva / limpiar</button>` : ""}</div>
    </form>`;
    const groups = new Map();
    all.forEach((v) => { const k = v.group_key || v.product_id || v.id; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(v); });
    const q = (ui.pq || "").toLowerCase();
    const list = [...groups.entries()].filter(([, vs]) => vs.some((v) => !v.deleted_at) && (!q || vs.some((v) => `${v.name} ${v.sku} ${v.barcode || ""}`.toLowerCase().includes(q))))
      .sort((a, b) => String(a[1][0].name).localeCompare(String(b[1][0].name), "es"));
    const cards = list.map(([pid, vs]) => {
      vs = bySize(vs); const f = vs[0];
      const cover = safeSrc((vs.find((r) => r.image_url) || {}).image_url);
      const total = vs.filter((v) => !v.deleted_at).reduce((n, r) => n + stockOf(r), 0);
      return `<article class="panel pgroup">
        <div class="row pgroup-head">
          ${cover ? `<img class="thumb" loading="lazy" decoding="async" width="48" height="48" alt="" src="${esc(cover)}">` : `<span class="thumb ph">—</span>`}
          <div class="grow"><b>${esc(f.name)}</b><br><span class="tiny">${esc(nameOf("categories", f.category_id))} · ${esc(fabricName(f))} · ${esc(f.color || "")} · stock ${total}${f.show_in_catalog === false ? " · oculta" : ""}</span></div>
          <button class="btn ghost small" type="button" data-act="pedit" data-id="${esc(pid)}">Editar</button>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Talla</th><th>Código</th><th>Precio</th><th>Stock</th></tr></thead><tbody>
        ${vs.map((r) => `<tr class="${r.deleted_at ? "off" : ""}"><td><b>${esc(r.size_label || "—")}</b>${r.deleted_at ? ` <span class="tiny">inactiva</span>` : ""}</td><td><span class="tiny">${esc(r.sku)}</span></td>
          <td>${r.is_offer ? `<b class="offer">${soles(r.offer_price_cents)}</b> <s class="tiny">${soles(r.sale_price_cents)}</s>` : soles(r.sale_price_cents)}</td><td>${stockOf(r)}</td></tr>`).join("")}
        </tbody></table></div></article>`;
    }).join("") || `<p class="muted">No hay piezas.</p>`;
    return `<div class="split piezas"><div class="stack">${form}</div>
      <div class="stack"><label class="search-box">${icon("search", 16)}<input id="pq" placeholder="Buscar pieza o código" value="${esc(ui.pq || "")}"></label>${cards}</div></div>`;
  }
  async function pformAction(action, el) {
    const P = syncPform() || (ui.pform = pformFrom(""));
    if (action === "pnew") { ui.pform = pformFrom(""); return render(); }
    if (action === "pedit") { ui.pform = pformFrom(el.dataset.id); render(); document.getElementById("product-form")?.scrollIntoView({ block: "start" }); return; }
    if (action === "sz-toggle") {
      const id = String(el.dataset.id); const k = P.sizes.findIndex((z) => String(z.size_id) === id);
      if (k >= 0) {
        const z = P.sizes[k];
        if (z.variant_id && !await DL_UI.confirm(`¿Quitar la talla ${z.size_label}? Si ya tiene ventas o stock se desactiva en vez de borrarse.`)) return;
        P.sizes.splice(k, 1);
      } else {
        const sz = byId("sizes", id); const base = P.sizes[0] || {};
        P.sizes.push({ variant_id: "", size_id: id, size_label: sz ? sz.label : id, sku: "", is_active: true, sale_cents: base.sale_cents || 0, offer_cents: 0, min_cents: base.min_cents || 0, wholesale_cents: base.wholesale_cents || 0, cost_cents: base.cost_cents || 0, images: [] });
        P.sizes.sort((a, b) => Number((byId("sizes", a.size_id) || {}).sort_order || 0) - Number((byId("sizes", b.size_id) || {}).sort_order || 0));
      }
      return render();
    }
    const list = el.dataset.id === "g" ? P.general : (P.sizes[Number(el.dataset.id)] || {}).images;
    if (!list) return;
    if (action === "vr-ph-add") {
      const raw = await DL_UI.prompt("Pega el enlace de Google Drive (o URL) de la foto:");
      if (!raw) return;
      const u = driveDirect(raw.trim());
      if (!/^https?:\/\//i.test(u)) throw new Error("Pega un enlace válido");
      if (!list.includes(u)) list.push(u);
    } else if (action === "vr-ph-del") {
      if (!await DL_UI.confirm("¿Quitar esta foto?")) return;
      list.splice(Number(el.dataset.n), 1);
    }
    return render();
  }
  async function saveProduct() {
    if (!canProducts()) throw new Error("Tu rol no edita piezas");
    const P = syncPform();
    if (!P.name || !P.category_id) throw new Error("Completa nombre y categoría");
    if (!P.fabric_id || !P.color_id) throw new Error("Elige tela y color");
    if (!P.sizes.length) throw new Error("Elige al menos una talla");
    P.sizes.forEach((z) => {
      if (!z.sale_cents) throw new Error(`Falta el precio de la talla ${z.size_label}`);
      if (z.offer_cents && z.offer_cents >= z.sale_cents) throw new Error(`La oferta de la talla ${z.size_label} debe ser menor al precio`);
      if (z.min_cents > z.sale_cents) throw new Error(`El mínimo de la talla ${z.size_label} no puede superar el precio`);
    });
    const live = P.sizes.filter((z) => z.is_active);
    if (!live.length) throw new Error("Deja al menos una talla activa");
    const skus = live.map((z) => z.sku.toUpperCase()).filter(Boolean);
    if (new Set(skus).size !== skus.length) throw new Error("Hay códigos repetidos");
    if (skus.some((k) => !/^[A-Z0-9][A-Z0-9._-]{1,59}$/.test(k))) throw new Error("El código solo admite letras, números, punto y guion");
    const bad = live.concat([{ images: P.general }]).flatMap((z) => z.images || []).map(driveDirect).find((u) => !/^https:\/\/(drive\.google\.com|docs\.google\.com|lh3\.googleusercontent\.com)\//i.test(u));
    if (bad) throw new Error("Las fotos deben ser links de Google Drive");
    const off = P.sizes.filter((z) => !z.is_active && z.variant_id);
    if (off.length && !await DL_UI.confirm(`Se desactivarán las tallas ${off.map((z) => z.size_label).join(", ")} (o se eliminarán si nunca se usaron). ¿Continuar?`)) return;
    const product = { name: P.name, description: P.description, category_id: P.category_id, brand_id: P.brand_id || null, show_in_catalog: P.show_in_catalog, hide_below_stock: P.hide_below_stock };
    const r = await Store.v2api.saveProductVariants(P.product_id, product, P.color_id, P.fabric_id, live, P.general);
    await reload(); ui.pform = pformFrom(r.product_id + "-" + P.color_id + "-" + P.fabric_id); render(); toast("Pieza guardada");
  }
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer la foto"));
      reader.onload = () => {
        const im = new Image();
        im.onerror = () => reject(new Error("Ese archivo no es una imagen"));
        im.onload = () => {
          const scale = Math.min(1, 900 / Math.max(im.width, im.height));
          const c = document.createElement("canvas");
          c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          let out = c.toDataURL("image/webp", 0.78);
          if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", 0.8);
          resolve(out);
        };
        im.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function initPhotos(e) {
    const key = (e && (e.product_id || e.id)) || "new";
    if (ui.photosFor !== key) { ui.photosFor = key; ui.photos = (e && Array.isArray(e.images) && e.images.length ? e.images : (e && e.image_url ? [e.image_url] : [])).slice(); }
    return ui.photos;
  }
  function photoListHtml(list) {
    if (!list.length) return `<p class="tiny">Sin fotos todavía.</p>`;
    return list.map((u, i) => `<div class="row"><img class="thumb" loading="lazy" decoding="async" width="48" height="48" alt="" src="${esc(safeSrc(u))}"><span class="grow tiny">${i === 0 ? "Principal" : "Foto " + (i + 1)}</span>
      <button class="btn ghost small" type="button" data-act="photo-up" data-id="${i}" ${i === 0 ? "disabled" : ""}>↑</button><button class="btn ghost small" type="button" data-act="photo-down" data-id="${i}" ${i === list.length - 1 ? "disabled" : ""}>↓</button><button class="btn danger small" type="button" data-act="photo-del" data-id="${i}">×</button></div>`).join("");
  }
  function photoAction(action, el) {
    const list = ui.photos || (ui.photos = []);
    const i = Number(el.dataset.id);
    if (action === "photo-add") {
      const box = document.getElementById("photo-url");
      const v = driveDirect(box ? box.value : "");
      if (!/^https?:\/\//i.test(v)) throw new Error("Pega un enlace válido");
      if (!list.includes(v)) list.push(v);
      if (box) box.value = "";
    } else if (action === "photo-del") list.splice(i, 1);
    else if (action === "photo-up" && i > 0) list.splice(i - 1, 0, list.splice(i, 1)[0]);
    else if (action === "photo-down" && i < list.length - 1) list.splice(i + 1, 0, list.splice(i, 1)[0]);
    const box = document.getElementById("photo-list"); if (box) box.innerHTML = photoListHtml(list);
  }
  function setPhoto(value) {
    const form = document.getElementById("product-form");
    if (!form) return;
    form.elements.image_url.value = value;
    const prev = document.getElementById("photo-preview");
    const src = safeSrc(value);
    prev.src = src; prev.hidden = !src;
  }
  async function addSize(form) {
    if (!canProducts()) throw new Error("Tu rol no edita tallas");
    const label = form.elements.label.value.trim().toUpperCase();
    if (!label) return;
    if (sizeList().includes(label)) throw new Error("Esa talla ya está");
    await ensureSizesTable();
    const max = Math.max(0, ...(state.data.sizes || []).map((r) => Number(r.sort_order || 0)));
    await Store.insert("sizes", { id: "size-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36), label, kind: /^\d+$/.test(label) ? (Number(label) <= 16 ? "NINO" : "NUMERICA") : "ADULTO", sort_order: max + 1 });
    await reload(); render(); toast("Talla agregada");
  }
  async function ensureSizesTable() {
    if ((state.data.sizes || []).length) return;
    for (const row of window.DL_DEFAULT_SIZES()) await Store.insert("sizes", row);
    await reload();
  }
  async function delSize(label) {
    if (!canProducts()) throw new Error("Tu rol no edita tallas");
    if ((state.data.products || []).some((p) => !p.deleted_at && p.size_label === label)) throw new Error("Hay piezas con esa talla; cámbialas primero");
    if (!await DL_UI.confirm("¿Quitar la talla " + label + "?")) return;
    await ensureSizesTable();
    const row = (state.data.sizes || []).find((r) => r.label === label);
    if (row) await Store.remove("sizes", row.id);
    await reload(); render(); toast("Talla quitada");
  }

  function renderStock() {
    const products = (state.data.products || []).filter((row) => !row.deleted_at);
    const whs = state.data.warehouses || [];
    const rows = [];
    const label = (p) => [p.name, p.fabric, p.color, p.size_label ? "T. " + p.size_label : ""].filter(Boolean).join(" · ") + (p.sku ? " (" + p.sku + ")" : "");
    const sorted = products.slice().sort((a, b) => label(a).localeCompare(label(b), "es"));
    sorted.forEach((product) => {
      whs.forEach((house) => {
        rows.push([label(product), house.name, stockIn(product.id, house.id), product.min_stock]);
      });
    });
    return `<form class="panel stack" data-form="stock">
      <h3>Ajustar stock</h3>
      <div class="two">${refField("product_id", "Pieza", "products", sorted.map((p) => ({ id: p.id, name: label(p) })))}${refField("warehouse_id", "Almacén", "warehouses")}</div>
      <div class="two"><label>Cantidad que debe quedar<input name="quantity" type="number" min="0" required></label><label>Nota<input name="note" placeholder="Motivo"></label></div>
      <button class="btn" type="submit">Guardar cantidad</button>
    </form>${table(["Pieza", "Almacén", "Cantidad", "Mínimo"], rows)}`;
  }
  function renderMoves() {
    const moves = state.data.partner_moves || [];
    return `<div class="split" style="margin-top:16px"><form class="panel stack" data-form="partner-move"><h3>Movimiento</h3>
      ${refField("partner_id", "Mayorista", "partners")}
      <label>Tipo<select name="kind"><option value="ENTREGA">Entrega</option><option value="PAGO">Pago</option><option value="DEVOLUCION">Devolución</option></select></label>
      ${refField("product_id", "Pieza", "products")}
      ${refField("warehouse_id", "Almacén", "warehouses")}
      <div class="two"><label>Cantidad<input name="quantity" type="number" min="0" value="1"></label><label>Monto (S/)<input name="amount" type="number" min="0" step="0.01" required></label></div>
      <label>Nota<input name="note"></label>
      <button class="btn" type="submit">Registrar</button></form>
      <div>${table(["Casa", "Tipo", "Monto"], moves.slice().reverse().map((row) => [nameOf("partners", row.partner_id), row.kind, soles(row.amount_cents)])) || ""}
      ${(state.data.partners || []).map((partner) => `<p class="tiny">${esc(partner.name)}: saldo ${soles(balance(partner.id))}</p>`).join("")}</div></div>`;
  }
  function balance(partnerId) {
    return (state.data.partner_moves || []).filter((row) => row.partner_id === partnerId).reduce((sum, row) => sum + (row.kind === "ENTREGA" ? Number(row.amount_cents) : -Number(row.amount_cents)), 0);
  }
  const SINGULAR = { stores: "tienda", warehouses: "almacén", customers: "cliente", promos: "promoción", expenses: "gasto", sizes: "talla", categories: "categoría", brands: "marca", cash_registers: "caja", document_series: "serie", partners: "mayorista", fabrics: "tela", fabric_suppliers: "proveedor", tailors: "sastre" };
  const MASC = ["warehouses", "customers", "expenses", "partners", "fabric_suppliers", "tailors"];
  const LIST_FIRST = Object.keys(SINGULAR);
  function isUsed(table, id) {
    const any = (t, k) => (state.data[t] || []).some((r) => String(r[k]) === String(id) && !r.deleted_at);
    if (table === "sizes") { const sz = byId("sizes", id); return any("products", "size_id") || (sz && (state.data.products || []).some((p) => p.size_label === sz.label)); }
    if (table === "categories") return any("products", "category_id");
    if (table === "brands") return any("products", "brand_id");
    if (table === "stores") return any("sales", "store_id") || any("cash_registers", "store_id");
    if (table === "warehouses") return any("sales", "warehouse_id") || any("stock_movements", "warehouse_id") || (state.data.stock_levels || []).some((l) => String(l.warehouse_id) === String(id) && Number(l.quantity_on_hand) > 0);
    if (table === "cash_registers") return any("cash_sessions", "register_id");
    if (table === "document_series") { const d = byId("document_series", id); return Boolean(d && Number(d.last_number) > 0); }
    if (table === "customers") return any("sales", "customer_id");
    return false;
  }
  function openCash(storeId) {
    return (state.data.cash_sessions || []).filter((s) => s.status === "OPEN" && s.store_id === storeId);
  }
  function cashBadge(storeId) {
    const open = openCash(storeId);
    return open.length ? `<span class="badge ok">Caja abierta</span>` : `<span class="badge">Caja cerrada</span>`;
  }
  function managedHtml(p) {
    const st = (state.data.stores || []).filter((s) => s.manager_id === p.id);
    const wh = (state.data.warehouses || []).filter((w) => w.manager_id === p.id);
    if (!st.length && !wh.length) return "";
    const link = (t, r) => `<button class="btn ghost small" type="button" data-act="goto-site" data-table="${t}" data-id="${esc(r.id)}">${esc(r.name)}</button>`;
    return `<div class="panel"><p class="kicker">Encargado de</p><div class="row" style="gap:6px;flex-wrap:wrap">${st.map((r) => link("stores", r)).join("")}${wh.map((r) => link("warehouses", r)).join("")}</div></div>`;
  }
  function staffName(id) { const p = byId("staff", id); return p ? p.full_name : "—"; }
  function renderStoreStaff(store) {
    if (!isAdmin()) return `<p class="tiny">Solo el administrador asigna personal.</p>`;
    // Equipo = solo personal (ADMIN, SUPERVISOR, CAJERO, VENDEDOR, ALMACENERO o PENDIENTE sin roles). Las cuentas solo-CLIENTE van a Admin › Clientes.
    const isClientOnly = (p) => { const r = (p.roles || []).filter(Boolean); return r.length > 0 && r.every((x) => x === "CLIENTE"); };
    const people = (state.data.staff || []).filter((p) => !isClientOnly(p)).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), "es"));
    return `<form class="panel stack" data-form="store-staff" data-id="${esc(store.id)}" id="store-staff">
      <h3>Personal de ${esc(store.name)}</h3>
      <p class="tiny">Encargado: <b>${esc(store.manager_id ? staffName(store.manager_id) : "—")}</b> (se elige arriba, en el formulario de la tienda)</p>
      <div class="table-wrap"><table><thead><tr><th>Aquí</th><th>Persona y rol</th></tr></thead><tbody>
      ${people.map((p) => `<tr class="${p.is_active === false ? "off" : ""}"><td><input type="checkbox" name="in_${esc(p.id)}" ${p.store_id === store.id ? "checked" : ""}></td>
        <td>${esc(p.full_name)}<br><span class="tiny">${p.store_id && p.store_id !== store.id ? "Ahora en " + esc(nameOf("stores", p.store_id)) : esc(p.email || "")}</span>
        <select name="role_${esc(p.id)}" style="margin-top:6px;width:100%">${ROLES.map((r) => `<option value="${r}" ${r === p.role ? "selected" : ""}>${esc(ROLE_LABEL[r])}</option>`).join("")}</select></td></tr>`).join("") || `<tr><td colspan="2">Aún no hay usuarios. Créalos en Equipo.</td></tr>`}
      </tbody></table></div>
      <p class="tiny">Marcar a alguien lo mueve a esta tienda (sale de la anterior). El personal rota: cámbialo cuando quieras.</p>
      <button class="btn" type="submit">Guardar personal</button></form>`;
  }
  async function saveStoreStaff(form) {
    if (!isAdmin()) throw new Error("Solo el administrador asigna personal");
    const storeId = form.dataset.id;
    const store = byId("stores", storeId);
    const managerId = store.manager_id || null;
    const people = state.data.staff || [];
    const admins = people.filter((p) => p.role === "ADMIN" && p.is_active !== false);
    for (const p of people) {
      const inEl = form.elements.namedItem("in_" + p.id);
      const roleEl = form.elements.namedItem("role_" + p.id);
      if (!inEl) continue;
      const patch = {};
      const wantIn = inEl.checked || p.id === managerId;
      if (wantIn && p.store_id !== storeId) patch.store_id = storeId;
      if (!wantIn && p.store_id === storeId) patch.store_id = null;
      if (roleEl && roleEl.value !== p.role) {
        if (p.role === "ADMIN" && admins.length <= 1) throw new Error("Tiene que quedar al menos un administrador");
        patch.role = roleEl.value;
      }
      if (Object.keys(patch).length) await Store.update("staff", p.id, patch);
    }
    await reload(); render(); toast("Personal actualizado");
  }

  function renderPriceGrid() {
    const products = (state.data.products || []).filter((p) => !p.deleted_at).sort((a, b) => String(a.name).localeCompare(String(b.name), "es") || String(a.size_label).localeCompare(String(b.size_label), "es", { numeric: true }));
    const q = (ui.mq || "").toLowerCase();
    const money = (v) => (Number(v || 0) / 100).toFixed(2);
    const can = allow(["SUPERVISOR"]);
    return `<form class="panel stack" data-form="prices" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><h3>Precios por mayor</h3>${can ? `<button class="btn small" type="submit">Guardar cambios</button>` : ""}</div>
      <input id="mq" placeholder="Filtrar pieza, talla o SKU" value="${esc(ui.mq || "")}">
      <div class="table-wrap"><table class="grid-edit"><thead><tr><th>Pieza</th><th>Venta</th><th>Mínimo</th><th>Mayor</th></tr></thead><tbody>
      ${products.map((p) => { const hide = q && !(`${p.name} ${p.size_label} ${p.sku}`.toLowerCase().includes(q)); return `<tr ${hide ? "hidden" : ""} data-row="${esc(p.id)}"><td>${esc(p.name)}<br><span class="tiny">T. ${esc(p.size_label || "—")} · ${esc(p.sku)}</span></td>
        ${[["sale", "sale_price_cents"], ["min", "min_price_cents"], ["whole", "wholesale_price_cents"]].map(([k, col]) => `<td><input class="money" inputmode="decimal" name="${k}_${esc(p.id)}" data-orig="${money(p[col])}" value="${money(p[col])}" ${can ? "" : "disabled"}></td>`).join("")}</tr>`; }).join("")}
      </tbody></table></div><p class="tiny">Los cambios se marcan en dorado hasta que guardes.</p></form>`;
  }
  async function savePrices(form) {
    if (!allow(["SUPERVISOR"])) throw new Error("Tu rol no cambia precios");
    let n = 0;
    const cents = (v) => Math.round((Number(String(v).replace(",", ".")) || 0) * 100);
    for (const p of (state.data.products || []).filter((x) => !x.deleted_at)) {
      const patch = {};
      [["sale", "sale_price_cents"], ["min", "min_price_cents"], ["whole", "wholesale_price_cents"]].forEach(([k, col]) => {
        const el = form.elements.namedItem(k + "_" + p.id);
        if (el && el.value !== el.dataset.orig) patch[col] = cents(el.value);
      });
      if (!Object.keys(patch).length) continue;
      const sale = patch.sale_price_cents ?? p.sale_price_cents;
      if (!sale) throw new Error(p.name + ": falta precio de venta");
      if ((patch.min_price_cents ?? p.min_price_cents ?? 0) > sale) throw new Error(p.name + " (" + p.size_label + "): el mínimo supera la venta");
      await Store.update("products", p.id, patch); n += 1;
    }
    await reload(); render(); toast(n ? n + " pieza(s) actualizadas" : "Sin cambios");
  }

  function sellerSales(person) {
    return completedSales().filter((s) => (s.seller_user_id && s.seller_user_id === person.id) || (!s.seller_user_id && s.seller_name === person.full_name));
  }
  function renderStaff() {
    if (!isAdmin() && role() !== "SUPERVISOR" && !managedStores().length) return "";
    const people = (state.data.staff || []).slice().sort((a, b) => (a.is_active === false) - (b.is_active === false) || String(a.full_name).localeCompare(String(b.full_name), "es"));
    const sel = ui.staffSel && byId("staff", ui.staffSel);
    if (sel) return renderStaffDetail(sel);
    const stores = (state.data.stores || []).filter((s) => s.is_active !== false);
    const mine = managedStores();
    const canCreate = isAdmin() || mine.length > 0;
    const roleOpts = isAdmin() ? ROLES : ["VENDEDOR", "ALMACENERO"];
    const storeOpts = isAdmin() ? stores : stores.filter((s) => mine.includes(s.id));
    const form = ui.showForm === "staff" && canCreate ? `<form class="panel stack" data-form="new-user" style="margin-bottom:14px"><h3>Nuevo usuario</h3>
      <div class="two"><label>Nombre<input name="full_name" required></label><label>Celular<input name="phone" type="tel" inputmode="tel" minlength="9" required></label></div>
      <div class="two"><label>Correo o usuario<input name="email" required autocomplete="off" placeholder="correo@ejemplo.com"></label><label>Contraseña<input name="password" type="password" minlength="8" required autocomplete="new-password"></label></div>
      <div class="two"><label>Rol / permisos<select name="role">${roleOpts.map((r) => `<option value="${r}" ${r === "VENDEDOR" ? "selected" : ""}>${esc(ROLE_LABEL[r])}</option>`).join("")}</select></label>
        <label>Tienda<select name="store_id" ${isAdmin() ? "" : "required"}>${isAdmin() ? `<option value="">—</option>` : ""}${storeOpts.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></label></div>
      <div class="row"><button class="btn" type="submit">Crear usuario</button><button class="btn ghost" type="button" data-act="clear-form">Cancelar</button></div></form>`
      : canCreate ? `<button class="btn" type="button" data-act="new" data-table="staff" style="margin-bottom:12px">+ Nuevo usuario</button>` : "";
    return `${form}<div class="stack">${people.map((p) => { const ss = sellerSales(p); return `<button type="button" class="panel person ${p.is_active === false ? "off" : ""}" data-act="staff-open" data-id="${esc(p.id)}">
        <span class="avatar">${esc(String(p.full_name || "?").trim().charAt(0).toUpperCase())}</span>
        <span style="flex:1;min-width:0;text-align:left"><b>${esc(p.full_name)}</b><br><span class="tiny">${esc((rolesOf(p).length ? rolesOf(p) : [p.role]).map((r) => ROLE_LABEL[r] || r).join(" + "))} · ${esc(p.store_id ? nameOf("stores", p.store_id) : "Sin tienda")}${p.is_active === false ? " · Desactivado" : ""}</span></span>
        <span class="tiny" style="text-align:right">${ss.length} ventas<br>${soles(sumCents(ss, "total_cents"))}</span></button>`; }).join("") || `<p class="muted">Nadie en el equipo.</p>`}</div>
      <p class="tiny" style="margin-top:8px">Administrador: todo. Supervisor: opera la casa. Vendedor: caja. Almacenero: taller, piezas y stock. Pendiente: sin acceso.</p>`;
  }
  function renderStaffDetail(p) {
    const ss = sellerSales(p);
    const total = sumCents(ss, "total_cents");
    const month = localDay(new Date()).slice(0, 7);
    const mSales = ss.filter((s) => localDay(s.sold_at).slice(0, 7) === month);
    const top = group(itemsOf(ss), (r) => (byId("products", r.product_id) || {}).name || r.product_id, (r) => Number(r.line_total_cents || 0)).sort((a, b) => b.units - a.units).slice(0, 6);
    const stores = (state.data.stores || []).filter((s) => s.is_active !== false);
    const admin = isAdmin();
    const me = state.user && state.user.id === p.id;
    return `<button class="btn ghost small" type="button" data-act="staff-back">← Equipo</button>
      <div class="panel person" style="margin:12px 0"><span class="avatar">${esc(String(p.full_name || "?").charAt(0).toUpperCase())}</span>
        <span style="flex:1"><b>${esc(p.full_name)}</b><br><span class="tiny">${esc(p.email || "")} · alta ${esc(localDay(p.created_at) || "—")}</span></span>
        ${p.is_active === false ? `<span class="badge">Desactivado</span>` : `<span class="badge ok">Activo</span>`}</div>
      <div class="stats">
        <article class="stat"><span class="tiny">Vendido (total)</span><b>${moneyHtml(total)}</b></article>
        <article class="stat"><span class="tiny">Ventas</span><b><span class="num">${ss.length}</span></b></article>
        <article class="stat"><span class="tiny">Ticket promedio</span><b>${moneyHtml(ss.length ? Math.round(total / ss.length) : 0)}</b></article>
        <article class="stat"><span class="tiny">Este mes</span><b>${moneyHtml(sumCents(mSales, "total_cents"))}</b></article>
      </div>
      <div class="panel"><p class="kicker">Tendencia · 60 días</p><div class="chart-box"><canvas id="ch-staff" data-id="${esc(p.id)}"></canvas></div></div>
      <div class="split" style="margin-top:16px">
        <div class="panel"><p class="kicker">Lo que más vende</p>${bars(top, (r) => r.key, (r) => r.units, (r) => r.units + " uds · " + soles(r.cents))}</div>
        ${admin ? `<div class="stack">
          ${managedHtml(p)}
          <form class="panel stack" data-form="staff-edit" data-id="${esc(p.id)}"><h3>Rol y tienda</h3>
            <div class="two"><label>Rol principal<select name="role">${ROLES.map((r) => `<option value="${r}" ${r === p.role ? "selected" : ""}>${esc(ROLE_LABEL[r])}</option>`).join("")}</select></label>
            <label>Tienda<select name="store_id"><option value="">—</option>${stores.map((s) => `<option value="${esc(s.id)}" ${s.id === p.store_id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label></div>
            <fieldset class="photo-box"><legend>Roles y permisos (se suman)</legend><div class="row" style="flex-wrap:wrap;gap:10px">${ROLES.filter((r) => r !== "PENDIENTE").concat(PERMS).map((r) => `<label class="checks"><input type="checkbox" name="roles_${r}" ${rolesOf(p).includes(r) ? "checked" : ""}> ${esc(ROLE_LABEL[r])}</label>`).join("")}</div></fieldset>
            <label>Nombre<input name="full_name" value="${esc(p.full_name)}" required></label>
            <button class="btn" type="submit">Guardar</button></form>
          <form class="panel stack" data-form="staff-pass" data-id="${esc(p.id)}"><h3>Restablecer contraseña</h3>
            <input name="password" type="password" minlength="8" required placeholder="Nueva contraseña (8+)" autocomplete="new-password">
            <button class="btn ghost" type="submit">Cambiar contraseña</button></form>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            ${p.is_active === false ? `<button class="btn" type="button" data-act="staff-active" data-id="${esc(p.id)}" data-on="1">Reactivar</button>` : `<button class="btn ghost" type="button" data-act="staff-active" data-id="${esc(p.id)}" data-on="0" ${me ? "disabled" : ""}>Desactivar</button>`}
            <button class="btn danger" type="button" data-act="staff-del" data-id="${esc(p.id)}" ${me ? "disabled" : ""}>Eliminar usuario</button></div>
          </div>` : ""}
      </div>`;
  }
  function managedStores() {
    const me = state.user && state.user.id;
    return (state.data.stores || []).filter((s) => me && (s.manager_ids || []).includes(me)).map((s) => s.id);
  }
  async function createUser(form) {
    const el = form.elements;
    if (!isAdmin()) {
      if (!managedStores().includes(el.store_id.value)) throw new Error("Solo puedes agregar personal a tus tiendas");
      if (!(await Store.v2api.canAssignStaff(el.role.value, el.store_id.value))) throw new Error("No puedes asignar ese rol en esa tienda");
    }
    await Store.adminCreateUser({ full_name: el.full_name.value, email: el.email.value, password: el.password.value, role: el.role.value, store_id: el.store_id.value, phone: el.phone ? el.phone.value : "" });
    ui.showForm = null; await reload(); render(); toast("Usuario creado");
  }
  async function deleteUser(id) {
    if (!isAdmin()) throw new Error("Solo el administrador elimina");
    const p = byId("staff", id);
    if (!p) return;
    if (state.user && state.user.id === id) throw new Error("No puedes eliminar tu propia cuenta");
    if (p.role === "ADMIN" && (state.data.staff || []).filter((r) => r.role === "ADMIN" && r.is_active !== false && r.id !== id).length === 0) throw new Error("Tiene que quedar al menos un administrador");
    if (!await DL_UI.confirm("¿Eliminar a " + p.full_name + "? Sus ventas se conservan con su nombre.")) return;
    await Store.adminDeleteUser(id);
    ui.staffSel = null; await reload(); render(); toast("Usuario eliminado");
  }

  function renderStoreReport() {
    const stores = (state.data.stores || []).filter((s) => s.is_active !== false);
    if (!stores.length) return "";
    if (!ui.repStore || !byId("stores", ui.repStore)) ui.repStore = stores[0].id;
    const st = byId("stores", ui.repStore);
    const today = localDay(new Date()); const month = today.slice(0, 7);
    const ss = completedSales().filter((s) => s.store_id === st.id);
    const hoy = ss.filter((s) => localDay(s.sold_at) === today);
    const mes = ss.filter((s) => localDay(s.sold_at).slice(0, 7) === month);
    const open = openCash(st.id);
    const top = group(itemsOf(mes), (r) => (byId("products", r.product_id) || {}).name || r.product_id, (r) => Number(r.line_total_cents || 0)).sort((a, b) => b.units - a.units).slice(0, 6);
    const sellers = group(mes, (s) => s.seller_name || "—", (s) => Number(s.total_cents)).sort((a, b) => b.cents - a.cents);
    const team = (state.data.staff || []).filter((p) => p.store_id === st.id && p.is_active !== false);
    return `<div class="panel" style="margin-top:16px" id="store-report"><p class="kicker">Tiendas</p>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin:8px 0">${stores.map((s) => `<button type="button" class="chip ${s.id === st.id ? "on" : ""}" data-act="rep-store" data-id="${esc(s.id)}">${esc(s.name)} ${openCash(s.id).length ? "●" : "○"}</button>`).join("")}</div>
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px"><h3>${esc(st.name)}</h3>${cashBadge(st.id)}</div>
      <p class="tiny">${open.length ? open.map((o) => "Abierta por " + esc(staffName(o.user_id)) + " desde " + new Date(o.opened_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) + " · apertura " + soles(o.opening_cents)).join("<br>") : "Nadie tiene la caja abierta ahora."}
        · Encargado: ${esc(st.manager_id ? staffName(st.manager_id) : "—")} · Equipo: ${team.length}</p>
      <div class="stats">
        <article class="stat"><span class="tiny">Hoy</span><b>${moneyHtml(sumCents(hoy, "total_cents"))}</b><span class="tiny">${hoy.length} ventas</span></article>
        <article class="stat"><span class="tiny">Mes</span><b>${moneyHtml(sumCents(mes, "total_cents"))}</b><span class="tiny">${mes.length} ventas</span></article>
        <article class="stat"><span class="tiny">Ticket promedio (mes)</span><b>${moneyHtml(mes.length ? Math.round(sumCents(mes, "total_cents") / mes.length) : 0)}</b></article>
        <article class="stat"><span class="tiny">Stock en tienda</span><b><span class="num">${(state.data.warehouses || []).filter((w) => w.store_id === st.id).reduce((n, w) => n + (state.data.stock_levels || []).filter((l) => l.warehouse_id === w.id).reduce((m, l) => m + Number(l.quantity_on_hand || 0), 0), 0)}</span></b></article>
      </div>
      <div class="split"><div><p class="kicker">Top productos · mes</p>${bars(top, (r) => r.key, (r) => r.units, (r) => r.units + " uds")}</div>
        <div><p class="kicker">Vendedores · mes</p>${bars(sellers, (r) => r.key, (r) => r.cents, (r) => soles(r.cents) + " · " + r.n)}</div></div>
    </div>`;
  }

  function renderHomeSettings() {
    if (!isAdmin()) return `<p class="muted">Solo el administrador cambia el inicio.</p>`;
    const h = homeCfg();
    const opt = (name, list) => `<select name="${name}">${list.map(([v, l]) => `<option value="${v}" ${String(h[name]) === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
    return `<div class="split">
      <div class="panel stack"><h3>Vista previa</h3>
        <iframe id="home-preview" title="Vista previa de la colección" src="index.html?preview=1#coleccion" style="width:100%;height:min(72vh,640px);border:0;border-radius:12px;background:#000"></iframe></div>
      <form class="panel stack" data-form="home-settings" id="home-form">
      <h3>Inicio de la colección</h3>
      <label>Estilo del inicio${opt("home_hero_style", [["full", "Foto completa"], ["split", "Mitad y mitad"], ["text", "Solo texto"]])}</label>
      <label>Foto principal (enlace de Drive)<input name="home_hero_image" inputmode="url" placeholder="Enlace de Google Drive" value="${esc(h.home_hero_image)}"></label>
      <label>Texto pequeño<input name="home_kicker" placeholder="Nueva colección" value="${esc(h.home_kicker)}"></label>
      <label>Título<input name="home_title" required placeholder="Título" value="${esc(h.home_title)}"></label>
      <div class="two"><label>Alineación${opt("home_align", [["left", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]])}</label>
        <label>Oscurecer la foto: <span id="shade-val">${esc(h.home_shade)}</span>%<input name="home_shade" type="range" min="0" max="100" step="5" value="${esc(h.home_shade)}"></label></div>
      <div class="two"><label>Tema por defecto${opt("home_theme", [["dark", "Oscuro"], ["light", "Claro"]])}</label>
        <label>Columnas en celular${opt("home_cols", [["2", "2"], ["1", "1"]])}</label></div>
      <div class="row"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-act="home-reset">Descartar cambios</button></div>
    </form></div>`;
  }
  function homeFormMap(form) {
    const el = form.elements; const map = {};
    Object.keys(HOME_DEFAULTS).forEach((k) => { if (el[k]) map[k] = String(el[k].value || "").trim(); });
    map.home_shade = String(Math.max(0, Math.min(100, Number(map.home_shade) || 0)));
    return map;
  }
  function pushPreview() {
    const fr = document.getElementById("home-preview"); const form = document.getElementById("home-form");
    if (!fr || !form) return;
    const map = homeFormMap(form);
    const sv = document.getElementById("shade-val"); if (sv) sv.textContent = map.home_shade;
    try {
      const w = fr.contentWindow;
      if (!w || !w.DL || !w.DL.ui) return;
      w.DL.ui.homeDraft = map;
      w.document.documentElement.setAttribute("data-theme", map.home_theme === "light" ? "light" : "dark");
      w.DL.render();
    } catch { }
  }
  async function saveHomeSettings(form) {
    if (!isAdmin()) throw new Error("Solo el administrador cambia el inicio");
    const map = homeFormMap(form);
    await Store.v2api.saveStorefront(map);
    toast("Inicio guardado");
  }
  function renderStorePanel() {
    const sums = state.data.store_summary || [];
    if (!sums.length) return `<p class="muted">No tienes tiendas asignadas.</p>`;
    if (!sums.some((x) => x.store_id === ui.panelStore)) ui.panelStore = (sums.find((x) => x.store_id === ui.storeId) || sums[0]).store_id;
    const sm = sums.find((x) => x.store_id === ui.panelStore);
    const inv = (state.data.store_inventory || []).filter((r) => r.store_id === ui.panelStore && r.quantity !== 0)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "es") || Number(a.size_order || 0) - Number(b.size_order || 0));
    const total = inv.reduce((n, r) => n + r.quantity, 0);
    return `<div class="tabs">${sums.map((x) => `<button class="chip ${x.store_id === ui.panelStore ? "on" : ""}" type="button" data-act="panel-store" data-id="${esc(x.store_id)}">${esc(x.name)}${x.is_main ? " ★" : ""}</button>`).join("")}</div>
      <div class="stats">
        <article class="stat"><span class="tiny">Ventas de hoy</span><b>${moneyHtml(sm.sales_today_cents)}</b><span class="tiny">${sm.sales_today_count} ventas</span></article>
        <article class="stat"><span class="tiny">Cajas abiertas</span><b><span class="num">${sm.open_cash_sessions}</span></b></article>
        <article class="stat"><span class="tiny">Stock bajo</span><b class="${sm.low_stock_count ? "bad" : ""}"><span class="num">${sm.low_stock_count}</span></b></article>
        <article class="stat"><span class="tiny">Prendas en inventario</span><b><span class="num">${total}</span></b></article>
      </div>
      <div class="toolbar"><input class="search" data-crud-q="inv" placeholder="Buscar en el inventario" aria-label="Buscar"></div>
      <div class="table-wrap"><table><thead><tr><th>Prenda</th><th>Talla</th><th>Color</th><th>Almacén</th><th>Cant.</th></tr></thead><tbody data-crud-list="inv">
      ${inv.map((r) => `<tr class="tap"><td>${esc(r.name)}<br><span class="tiny">${esc(r.sku || "")}</span></td><td>${esc(r.size_label || "—")}</td><td>${esc(r.color || "—")}</td><td>${esc(r.warehouse_name)}</td><td class="num"><b>${r.quantity}</b></td></tr>`).join("") || `<tr><td colspan="5">Sin inventario.</td></tr>`}
      </tbody></table></div>`;
  }
  function renderGeneralReport() {
    const rows = state.data.general_report || [];
    const days = ui.repDays || 30;
    const from = localDay(new Date(Date.now() - (days - 1) * 864e5));
    const list = rows.filter((r) => String(r.day).slice(0, 10) >= from);
    const total = sumCents(list, "amount_cents");
    const count = list.reduce((n, r) => n + r.sales_count, 0);
    const byStore = group(list, (r) => r.store_name, (r) => r.amount_cents).sort((a, b) => b.cents - a.cents);
    const byPay = group(list, (r) => PAY[r.method] || r.method, (r) => r.amount_cents).sort((a, b) => b.cents - a.cents);
    const today = sumCents(rows.filter((r) => String(r.day).slice(0, 10) === localDay(new Date())), "amount_cents");
    return `<div class="tabs">${[7, 30, 90].map((d) => `<button class="chip ${d === days ? "on" : ""}" type="button" data-act="rep-days" data-id="${d}">${d} días</button>`).join("")}</div>
      <div class="stats">
        <article class="stat"><span class="tiny">Cobrado hoy</span><b>${moneyHtml(today)}</b></article>
        <article class="stat"><span class="tiny">Cobrado en ${days} días</span><b>${moneyHtml(total)}</b></article>
        <article class="stat"><span class="tiny">Cobros</span><b><span class="num">${count}</span></b></article>
        <article class="stat"><span class="tiny">Tiendas</span><b><span class="num">${byStore.length}</span></b></article>
      </div>
      <div class="split"><div class="panel stack"><h3>Por tienda</h3>${bars(byStore, (r) => r.key, (r) => r.cents, (r) => soles(r.cents))}</div>
      <div class="panel stack"><h3>Por medio de pago</h3>${bars(byPay, (r) => r.key, (r) => r.cents, (r) => soles(r.cents))}</div></div>`;
  }
  function renderCrud(table) {
    const specRow = SPECS[table];
    if (!specRow) return "";
    const editing = ui.edit && ui.edit.table === table ? byId(table, ui.edit.id) : null;
    let rows = (state.data[table] || []).filter((row) => !row.deleted_at);
    if (table === "sizes") rows = rows.slice().sort((a, b) => ["NINO", "ADULTO", "OTRO"].indexOf(a.size_group || "OTRO") - ["NINO", "ADULTO", "OTRO"].indexOf(b.size_group || "OTRO") || Number(a.sort_order || 0) - Number(b.sort_order || 0));
    const showForm = editing || ui.showForm === table;
    const noun = SINGULAR[table] || specRow.title.toLowerCase();
    const nuevo = MASC.includes(table) ? "Nuevo" : "Nueva";
    const canEdit = isAdmin() || (table === "sizes" && canProducts());
    const used = editing ? isUsed(table, editing.id) : false;
    const hasActive = specRow.fields.some((x) => x.name === "is_active");
    const endBtn = !editing || !canEdit ? "" : (used && hasActive) || table === "stores" || table === "warehouses"
      ? (editing.is_active === false ? `<button class="btn ghost" type="button" data-act="crud-on" data-table="${table}" data-id="${esc(editing.id)}">Activar</button>` : `<button class="btn danger" type="button" data-act="${used ? "crud-off" : "del"}" data-table="${table}" data-id="${esc(editing.id)}">${used ? "Desactivar" : "Eliminar"}</button>`)
      : used ? `<p class="tiny">Ya se usó: no se puede eliminar.</p>` : `<button class="btn danger" type="button" data-act="del" data-table="${table}" data-id="${esc(editing.id)}">Eliminar</button>`;
    const form = showForm ? `<form class="panel stack" data-form="crud" data-table="${table}" id="crud-form">
      <h3>${editing ? "Editar" : nuevo} ${esc(noun)}</h3>
      <input type="hidden" name="id" value="${editing ? esc(editing.id) : ""}">
      ${specRow.fields.map((field) => fieldHtml(field, editing)).join("")}
      ${table === "stores" ? siteExtras(editing) : ""}
      <div class="row"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-act="clear-form">Cancelar</button></div>
      ${endBtn ? `<div class="row" style="justify-content:flex-end">${endBtn}</div>` : ""}
    </form>${table === "stores" && editing ? renderStoreStaff(editing) : ""}` : "";
    let lastGroup = null;
    const body = rows.map((row) => {
      let head = "";
      if (table === "sizes" && (row.size_group || "OTRO") !== lastGroup) { lastGroup = row.size_group || "OTRO"; head = `<tr><th colspan="${specRow.cols.length}">${esc(GROUP_LABEL[lastGroup])}</th></tr>`; }
      return head + `<tr class="tap ${editing && editing.id === row.id ? "sel" : ""}" data-act="edit" data-table="${table}" data-id="${esc(row.id)}">${specRow.cols.map((column) => `<td>${column.html(row)}</td>`).join("")}</tr>`;
    }).join("") || `<tr><td colspan="${specRow.cols.length}">Vacío.</td></tr>`;
    return `<div class="stack" style="margin-bottom:18px">
      <div class="toolbar"><input class="search" data-crud-q="${table}" placeholder="Buscar ${esc(specRow.title.toLowerCase())}" aria-label="Buscar">${canEdit || table === "customers" || table === "expenses" ? `<button class="btn" type="button" data-act="new" data-table="${table}">${nuevo}</button>` : ""}</div>
      ${form}
      <div class="table-wrap"><table><thead><tr>${specRow.cols.map((column) => `<th>${esc(column.label)}</th>`).join("")}</tr></thead><tbody data-crud-list="${table}">${body}</tbody></table></div>
      <p class="tiny">Toca una fila para editarla.</p></div>`;
  }
  function fieldHtml(field, row) {
    const value = row ? row[field.name] : "";
    if (field.type === "textarea") return `<label>${esc(field.label)}<textarea name="${field.name}" ${field.required ? "required" : ""}>${esc(value || "")}</textarea></label>`;
    if (field.type === "bool") {
      const checked = row ? row[field.name] !== false : field.default !== false;
      return `<label class="checks"><input type="checkbox" name="${field.name}" ${checked ? "checked" : ""}> ${esc(field.label)}</label>`;
    }
    if (field.type === "select") return `<label>${esc(field.label)}<select name="${field.name}">${field.options.map(([v, l]) => `<option value="${esc(v)}" ${v === (value || field.options[0][0]) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
    if (field.type === "staffmulti") {
      const sel = (row && (row.manager_ids || (row.manager_id ? [row.manager_id] : []))) || [];
      const people = (state.data.staff || []).filter((p) => p.is_active !== false && p.role !== "PENDIENTE");
      return `<fieldset class="stack"><legend>${esc(field.label)}</legend>${people.map((p) => `<label class="checks"><input type="checkbox" name="${field.name}" value="${esc(p.id)}" ${sel.includes(p.id) ? "checked" : ""}> ${esc(p.full_name)}</label>`).join("") || `<p class="tiny">Primero agrega personal.</p>`}</fieldset>`;
    }
    if (field.type === "staff") return `<label>${esc(field.label)}<select name="${field.name}"><option value="">— Sin encargado —</option>${(state.data.staff || []).filter((p) => p.is_active !== false).map((p) => `<option value="${esc(p.id)}" ${p.id === value ? "selected" : ""}>${esc(p.full_name)}</option>`).join("")}</select></label>`;
    if (field.type === "ref") return refField(field.name, field.label, field.ref, null, value, field.required);
    if (field.type === "image") {
      return `<label>${esc(field.label)}<input name="${field.name}" inputmode="url" placeholder="https://drive.google.com/file/d/…" value="${esc(value || "")}"></label>`;
    }
    if (field.type === "money") {
      const shown = row && row[field.name] != null ? (Number(row[field.name]) / 100).toFixed(2) : "";
      return `<label>${esc(field.label)}<input name="${field.name}" inputmode="decimal" value="${esc(shown)}" ${field.required ? "required" : ""}></label>`;
    }
    if (field.type === "date") return `<label>${esc(field.label)}<input type="date" name="${field.name}" value="${esc(value || localDay(new Date()))}"></label>`;
    const type = field.type === "int" ? "number" : "text";
    const preset = !row && field.name === "min_stock" ? "1" : value ?? "";
    return `<label>${esc(field.label)}<input type="${type}" name="${field.name}" value="${esc(preset)}" ${field.required ? "required" : ""}></label>`;
  }
  function refField(name, label, table, list, selected, required) {
    const rows = list || (state.data[table] || []).filter((row) => !row.deleted_at && row.is_active !== false);
    return `<label>${esc(label)}<select name="${name}" ${required ? "required" : ""}><option value="">—</option>${rows.map((row) => `<option value="${esc(row.id)}" ${row.id === selected ? "selected" : ""}>${esc(row.name)}</option>`).join("")}</select></label>`;
  }
  function table(heads, rows) {
    if (!rows.length) return `<p class="muted">Sin registros.</p>`;
    return `<div class="table-wrap"><table><thead><tr>${heads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function readForm(form, fields) {
    const data = {};
    fields.forEach((field) => {
      const el = form.elements.namedItem(field.name);
      if (field.type === "staffmulti") { data[field.name] = [...form.querySelectorAll(`input[name="${field.name}"]:checked`)].map((x) => x.value); return; }
      if (!el) return;
      if (field.type === "bool") { data[field.name] = Boolean(el.checked); return; }
      if (field.type === "money") {
        data[field.name] = Math.round((Number(String(el.value).replace(",", ".")) || 0) * 100);
        return;
      }
      if (field.type === "int") { data[field.name] = Number.parseInt(el.value, 10) || 0; return; }
      const value = String(el.value || "").trim();
      data[field.name] = value === "" ? null : value;
    });
    return data;
  }

  async function saveCrud(form) {
    const table = form.dataset.table;
    const specRow = SPECS[table];
    const data = readForm(form, specRow.fields);
    specRow.fields.forEach((field) => {
      if (field.required && (data[field.name] === null || data[field.name] === "")) throw new Error("Falta " + field.label);
    });
    if (table === "categories" && !data.slug) {
      data.slug = String(data.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || nid("cat");
    }
    if (table === "sizes") { data.label = String(data.label || "").trim().toUpperCase(); data.kind = data.size_group; if (!data.sort_order) data.sort_order = Math.max(0, ...(state.data.sizes || []).map((r) => Number(r.sort_order || 0))) + 1; if ((state.data.sizes || []).some((r) => r.label === data.label && r.id !== form.elements.id.value)) throw new Error("Esa talla ya existe"); }
    if (table === "document_series") data.series = String(data.series || "").trim().toUpperCase();
    if (table === "stores" && ("lat" in data || "lng" in data)) {
      const n = (v) => { v = String(v == null ? "" : v).trim().replace(",", "."); return v === "" ? null : Number(v); };
      data.lat = n(data.lat); data.lng = n(data.lng);
      if ((data.lat == null) !== (data.lng == null)) throw new Error("Escribe latitud y longitud (o deja ambas vacías)");
      if (data.lat != null && (!Number.isFinite(data.lat) || !Number.isFinite(data.lng) || Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180)) throw new Error("Coordenadas inválidas");
    }
    if (table === "promos") data.percent = Math.max(0, Math.min(90, Number(data.percent) || 0));
    if (table === "products") {
      const clash = (state.data.products || []).find((row) => row.sku === data.sku && row.id !== form.elements.id.value);
      if (clash) throw new Error("Ese SKU ya existe");
      data.image_url = data.image_url ? driveDirect(data.image_url) : null;
    }
    if (table === "expenses") data.created_by = state.user ? state.user.full_name : "Casa";
    if (table === "products" && ui.edit && ui.edit.draft && ui.edit.draft.product_id) data.product_id = ui.edit.draft.product_id;
    const id = form.elements.id.value;
    if (table === "stores" && !id) {
      const regs = String(form.elements.x_registers.value || "").split(",").map((x) => x.trim()).filter(Boolean);
      const series = {}; DOC_TYPES.forEach(([k]) => { const v = String(form.elements["x_ser_" + k].value || "").trim().toUpperCase(); if (v) series[k] = v; });
      const vals = Object.values(series);
      if (new Set(vals).size !== vals.length) throw new Error("Hay series repetidas en el formulario");
      for (const v of vals) if (await Store.v2api.seriesTaken(v)) throw new Error("La serie " + v + " ya existe o fue usada antes (SUNAT no permite repetirla)");
      const r = await Store.v2api.createStore(data, regs, series);
      toast("Tienda creada · series " + (r.series || []).join(", "));
    } else
    if (id) await Store.update(table, id, data);
    else await Store.insert(table, Object.assign({ id: nid(table.slice(0, 3)) }, data));
    ui.edit = null; ui.showForm = null;
    toast("Guardado");
    await reload();
    render();
  }

  const DOC_TYPES = [["BOLETA", "Boleta", "B001", "BOLETA"], ["FACTURA", "Factura", "F001", "FACTURA"], ["TICKET", "Ticket", "T001", "TICKET"], ["NC_BOLETA", "N. crédito boleta", "BC01", "NOTA_CREDITO"], ["NC_FACTURA", "N. crédito factura", "FC01", "NOTA_CREDITO"]];
  function siteExtras(editing) {
    if (editing) return "";
    return `<fieldset class="stack"><legend>Cajas y series de la tienda nueva</legend>
      <label>Cajas (separadas por coma)<input name="x_registers" value="Caja 1"></label>
      <div class="two">${DOC_TYPES.map(([k, l, ex]) => `<label>${esc(l)}<input name="x_ser_${k}" maxlength="4" placeholder="auto (ej. ${ex})"></label>`).join("")}</div>
      <p class="tiny">Vacío = siguiente serie libre. La base valida formato y que no se repita.</p></fieldset>`;
  }
  function siteDocs(store) {
    const regs = (state.data.cash_registers || []).filter((r) => r.store_id === store.id);
    const ser = (state.data.document_series || []).filter((d) => d.store_id === store.id);
    const act = (row, t) => `<button class="btn ghost small" type="button" data-act="site-toggle" data-table="${t}" data-id="${esc(row.id)}">${row.is_active === false ? "Activar" : "Desactivar"}</button><button class="btn danger small" type="button" data-act="site-del" data-table="${t}" data-id="${esc(row.id)}">Eliminar</button>`;
    return `<div class="panel stack"><h3>Cajas y series · ${esc(store.name)}</h3>
      <div class="table-wrap"><table><tbody>
      ${regs.map((r) => `<tr><td>Caja <b>${esc(r.name)}</b> ${r.is_active === false ? "(inactiva)" : ""}</td><td class="acts"><button class="btn ghost small" type="button" data-act="site-ren" data-table="cash_registers" data-id="${esc(r.id)}">Renombrar</button>${act(r, "cash_registers")}</td></tr>`).join("")}
      ${ser.map((d) => `<tr><td>${esc(d.document_type)} <b>${esc(d.series)}</b> · último nº ${d.last_number} ${d.is_active === false ? "(inactiva)" : ""}</td><td class="acts"><button class="btn ghost small" type="button" data-act="site-ren" data-table="document_series" data-id="${esc(d.id)}">Cambiar código</button>${act(d, "document_series")}</td></tr>`).join("") || ""}
      </tbody></table></div>
      <div class="row"><button class="btn small" type="button" data-act="site-add-reg" data-id="${esc(store.id)}">+ Caja</button><button class="btn small" type="button" data-act="site-add-ser" data-id="${esc(store.id)}">+ Serie</button></div></div>`;
  }
  async function siteAction(action, el) {
    if (!isAdmin()) throw new Error("Solo el administrador gestiona tiendas, cajas y series");
    const t = el.dataset.table, id = el.dataset.id;
    if (action === "site-toggle") { const row = byId(t, id); await Store.update(t, id, { is_active: row.is_active === false }); }
    else if (action === "site-del") { if (!await DL_UI.confirm("¿Eliminar? Si ya se usó, solo se desactiva.")) return; const r = await Store.v2api.removeSite(t, id); toast(r === "closed" ? "Ya tiene historial: quedó desactivada" : "Eliminada"); }
    else if (action === "site-ren") { const row = byId(t, id); const v = (await DL_UI.prompt(t === "cash_registers" ? "Nombre de la caja" : "Código de serie (4 caracteres)", t === "cash_registers" ? row.name : row.series) || "").trim(); if (!v) return; await Store.update(t, id, t === "cash_registers" ? { name: v } : { series: v }); }
    else if (action === "site-add-reg") { const v = (await DL_UI.prompt("Nombre de la caja", "Caja " + ((state.data.cash_registers || []).filter((r) => r.store_id === id).length + 1)) || "").trim(); if (!v) return; await Store.insert("cash_registers", { store_id: id, name: v }); }
    else if (action === "site-add-ser") {
      const k = Number(await DL_UI.prompt(DOC_TYPES.map(([, l], i) => i + 1 + " = " + l).join("\n") + "\n¿Qué tipo?", "1")) - 1; const dt = DOC_TYPES[k]; if (!dt) return;
      const v = (await DL_UI.prompt("Código de serie (ej. " + dt[2] + ")") || "").trim(); if (!v) return;
      await Store.insert("document_series", { store_id: id, document_type: dt[3], series: v });
    }
    await reload(); render();
  }

  async function crudToggle(table, id, on) {
    if (!isAdmin() && !(table === "sizes" && canProducts())) throw new Error("Tu rol no puede cambiar esto");
    if (!on && !await DL_UI.confirm("Ya se usó, así que no se borra: quedará desactivado. ¿Continuar?")) return;
    await Store.update(table, id, { is_active: on });
    toast(on ? "Activado" : "Desactivado"); ui.edit = null; await reload(); render();
  }
  async function destroy(table, id) {
    if (!isAdmin() && !(table === "sizes" && canProducts())) throw new Error("Solo el administrador elimina");
    if (table === "cash_registers" || table === "document_series") {
      if (!await DL_UI.confirm("¿Eliminar? Si ya se usó, solo se desactiva.")) return;
      const r = await Store.v2api.removeSite(table, id);
      toast(r === "closed" ? "Ya tiene historial: quedó desactivada" : "Eliminada"); ui.edit = null; await reload(); render(); return;
    }
    if (table === "stores" || table === "warehouses") {
      if (!await DL_UI.confirm(table === "stores" ? "¿Eliminar o cerrar esta tienda? Si tiene ventas/cajas/movimientos se cierra (con sus almacenes, cajas y series)." : "¿Eliminar o cerrar este almacén? Si tiene movimientos se cierra.")) return;
      const r = await Store.v2api.removeSite(table, id);
      toast(r === "closed" ? "Tiene historial: quedó cerrada (inactiva)" : "Eliminada");
      ui.edit = null; await reload(); render(); return;
    }
    if (!await DL_UI.confirm("¿Eliminar este registro?")) return;
    if (table === "products" && (state.data.sale_items || []).some((row) => row.product_id === id)) {
      await Store.update("products", id, { is_active: false, deleted_at: new Date().toISOString() });
      toast("Archivada: ya tiene ventas y se queda en el historial");
    } else {
      if (table === "products") {
        const stocks = (state.data.stock_levels || []).filter((row) => row.product_id === id);
        for (const stock of stocks) await Store.remove("stock_levels", stock.id);
      }
      const blockers = {
        stores: [["warehouses", "store_id"], ["sales", "store_id"]],
        warehouses: [["sales", "warehouse_id"]],
        categories: [["products", "category_id"]],
        brands: [["products", "brand_id"]],
      }[table] || [];
      const used = blockers.some(([foreign, key]) => (state.data[foreign] || []).some((row) => row[key] === id && !row.deleted_at));
      if (used && SPECS[table] && SPECS[table].fields.some((field) => field.name === "is_active")) {
        await Store.update(table, id, { is_active: false });
        toast("Tiene historial. Quedó desactivada en lugar de borrarse.");
      } else if (used) throw new Error("No se puede eliminar porque otros registros lo usan");
      else await Store.remove(table, id);
      if (!used) toast("Eliminado");
    }
    ui.edit = null;
    await reload();
    render();
  }

  async function applyDelta(productId, warehouseId, delta, type, note) {
    if (Store.mode === "remote") {
      if (!Number(delta)) return;
      await Store.v2api.stockMove(warehouseId, productId, Number(delta), [type, note].filter(Boolean).join(" · "));
      return;
    }
    const source = Store.mode === "local" ? Store.cache.tables.stock_levels : state.data.stock_levels;
    const row = source.find((item) => item.product_id === productId && item.warehouse_id === warehouseId);
    const next = (row ? Number(row.quantity_on_hand) : 0) + Number(delta);
    if (next < 0) throw new Error("Sin stock de " + nameOf("products", productId));
    if (!row) {
      const created = { id: nid("sl"), product_id: productId, warehouse_id: warehouseId, quantity_on_hand: next };
      await Store.insert("stock_levels", created);
      if (Store.mode === "remote") source.push(created);
    } else {
      await Store.update("stock_levels", row.id, { quantity_on_hand: next });
      if (Store.mode === "remote") row.quantity_on_hand = next;
    }
    await Store.insert("stock_movements", {
      id: nid("mv"), warehouse_id: warehouseId, product_id: productId, movement_type: type,
      quantity: Number(delta), note: note || "", created_by: state.user ? state.user.full_name : "Casa", created_at: new Date().toISOString(),
    });
  }

  function bump(list, productId, dir) {
    const line = list.find((item) => item.productId === productId);
    if (!line && dir > 0) list.push({ productId, qty: 1 });
    else if (line) {
      line.qty += dir;
      if (line.qty <= 0) list.splice(list.indexOf(line), 1);
    }
  }

  async function act(el) {
    const action = el.dataset.act;
    if (window.DL_ACTIONS && window.DL_ACTIONS[action]) return window.DL_ACTIONS[action](el);
    if (action === "theme") return toggleTheme();
    if (action === "filter") {
      ui.filter = el.dataset.id;
      const grid = document.getElementById("grid");
      if (grid) { grid.innerHTML = productCards(); syncFilter(); return; }
      render(); return;
    }
    if (action === "open") return openProduct(el.dataset.id);
    if (action === "pd-size") { if (el.disabled) return; ui.detail.variant = el.dataset.id; ui.detail.slide = 0; (ui.cardSel = ui.cardSel || {})[ui.detail.key] = el.dataset.id; drawDetail(); return; }
    if (action === "card-size") {
      if (el.disabled) return;
      (ui.cardSel = ui.cardSel || {})[el.dataset.key] = el.dataset.id;
      const card = el.closest(".product-card"); const g = productGroups(visibleProducts()).find((x) => x.key === el.dataset.key);
      if (card && g) { const t = document.createElement("div"); t.innerHTML = cardHtml(g); card.replaceWith(t.firstElementChild); }
      return;
    }
    if (action === "pd-slide") { ui.detail.slide = Number(el.dataset.id); const t = document.getElementById("pd-track"); if (t) t.scrollTo({ left: t.clientWidth * ui.detail.slide, behavior: "smooth" }); return; }
    if (action === "cart-add") { const v = byId("products", el.dataset.id); if (!v || stockOf(v) <= 0) throw new Error("Esa talla está agotada"); bump(ui.cart, el.dataset.id, 1); saveCart(); const sh = document.getElementById("sheet"); if (sh.open) sh.close(); toast("Agregado al carrito ✓ · Talla " + (v.size_label || "")); render(); return; }
    if (action === "step") return goStep(el.dataset.id);
    if (action === "map") return openMap(el.dataset.id, el.dataset.i);
    if (action === "delete-me") return deleteMe();
    if (action === "place-order") return placeOrder();
    if (action === "order-filter") { ui.orderFilter = el.dataset.id; return render(); }
    if (action === "order-refresh") { state.orders = await Store.v2api.orders(); return render(); }
    if (action === "order-cancel") { if (!await DL_UI.confirm("¿Cancelar este pedido?")) return; await Store.v2api.cancelMyOrder(el.dataset.id); state.orders = await Store.v2api.orders(); render(); return toast("Pedido cancelado"); }
    if (action === "order-status") {
      let reason = null;
      if (el.dataset.s === "cancelado") { reason = await DL_UI.prompt("Motivo de la cancelación (el cliente lo verá):"); if (reason == null) return; if (!reason.trim()) throw new Error("Indica el motivo"); }
      else if (el.dataset.s === "confirmado" && !await DL_UI.confirm("¿Revisaste que haya stock de todas las prendas?")) return;
      await Store.v2api.setOrderStatus(el.dataset.id, el.dataset.s, reason); state.orders = await Store.v2api.orders(); render(); return toast("Pedido actualizado");
    }
    if (action === "admin-menu") { ui.drawer = !ui.drawer; render(); return; }
    if (action === "close-sheet") { document.getElementById("sheet").close(); return; }
    if (action === "close-ticket") { document.getElementById("ticket-wrap").hidden = true; return; }
    if (action === "add") { bump(el.dataset.cart === "caja" ? ui.cajaCart : ui.cart, el.dataset.id, 1); saveCart(); render(); return; }
    if (action === "qty") { bump(el.dataset.cart === "caja" ? ui.cajaCart : ui.cart, el.dataset.id, Number(el.dataset.dir)); saveCart(); render(); return; }
    if (action === "pay") { ui.pay = el.dataset.id; render(); return; }
    if (action === "clear-search") { ui.q = ""; ui.filter = "todas"; render(); return; }
    if (action === "auth-mode") { ui.authMode = el.dataset.id; render(); return; }
    if (action === "signout") { ui.q = ""; ui.filter = "todas"; await Store.signOut(); await reload(); location.hash = "coleccion"; return; }
    if (action === "new") { ui.edit = null; ui.showForm = el.dataset.table; render(); document.getElementById("crud-form")?.scrollIntoView({ block: "start" }); return; }
    if (action === "staff-open") { ui.staffSel = el.dataset.id; render(); window.scrollTo(0, 0); return; }
    if (action === "staff-back") { ui.staffSel = null; render(); return; }
    if (action === "staff-active") return setStaff(el.dataset.id, { is_active: el.dataset.on === "1" });
    if (action === "staff-del") return deleteUser(el.dataset.id);
    if (action === "rep-store") { ui.repStore = el.dataset.id; render(); return; }
    if (["pnew", "pedit", "sz-toggle", "vr-ph-add", "vr-ph-del"].includes(action)) return pformAction(action, el);
    if (action === "cat-new-cancel") { syncPform(); ui.pform.adding = null; return render(); }
    if (action === "cat-new-save") {
      const t = el.dataset.id; const name = (document.getElementById("new-" + t) || {}).value || "";
      if (!name.trim()) throw new Error(t === "fabrics" ? "Escribe el nombre de la tela" : "Escribe el nombre del color");
      if ((state.data[t] || []).some((r) => String(r.name).trim().toLowerCase() === name.trim().toLowerCase())) throw new Error("Ya existe con ese nombre");
      syncPform();
      const row = { name: name.trim(), is_active: true };
      if (t === "colors") row.hex = (document.getElementById("new-colors-hex") || {}).value || null;
      const saved = await Store.create(t, row);
      await reload();
      const hit = saved && saved.id ? saved : (state.data[t] || []).find((r) => r.name === row.name);
      if (hit) ui.pform[t === "fabrics" ? "fabric_id" : "color_id"] = String(hit.id);
      ui.pform.adding = null; render(); return toast(t === "fabrics" ? "Tela agregada" : "Color agregado");
    }
    if (action === "variant") { const b = byId("products", el.dataset.id); return pformAction("pedit", { dataset: { id: b ? (b.group_key || b.product_id) : "" } }); }
    if (action === "toggle-vis") {
      if (!canProducts()) throw new Error("Tu rol no edita piezas");
      const r = byId("products", el.dataset.id);
      await Store.update("products", r.id, { is_active: r.is_active === false }); await reload(); render(); return;
    }
    if (action === "size-del") return delSize(el.dataset.id);
    if (action === "vf-range") { const vf = salesFilter(); vf.to = localDay(new Date()); vf.from = localDay(new Date(Date.now() - (Number(el.dataset.id) - 1) * 864e5)); render(); return; }
    if (action === "edit" && el.dataset.table === "products") { const b = byId("products", el.dataset.id); return pformAction("pedit", { dataset: { id: b ? (b.group_key || b.product_id) : "" } }); }
    if (action === "edit") { ui.edit = { table: el.dataset.table, id: el.dataset.id }; ui.showForm = null; render(); if (SPECS[el.dataset.table]) document.getElementById("crud-form")?.scrollIntoView({ block: "start" }); if (el.dataset.table === "products") document.getElementById("product-form")?.scrollIntoView({ block: "start" }); return; }
    if (action === "clear-form") { ui.edit = null; ui.showForm = null; render(); return; }
    if (action === "home-reset") { render(); return; }
    if (action === "panel-store") { ui.panelStore = el.dataset.id; render(); return; }
    if (action === "rep-days") { ui.repDays = Number(el.dataset.id); render(); return; }
    if (action === "del") return destroy(el.dataset.table, el.dataset.id);
    if (action === "crud-off") return crudToggle(el.dataset.table, el.dataset.id, false);
    if (action === "crud-on") return crudToggle(el.dataset.table, el.dataset.id, true);
    if (/^photo-/.test(action)) return photoAction(action, el);
    if (action === "goto-site") { ui.admin = el.dataset.table; ui.staffSel = null; ui.edit = { table: el.dataset.table, id: el.dataset.id }; ui.showForm = null; if (location.hash !== "#admin/" + el.dataset.table) location.hash = "admin/" + el.dataset.table; render(); document.getElementById("crud-form")?.scrollIntoView({ block: "start" }); return; }
    if (/^site-/.test(action)) return siteAction(action, el);
    if (action === "void") return voidSale(el.dataset.id);
    if (action === "dispatch") { await Store.update("store_orders", el.dataset.id, { status: "DESPACHADO" }); await reload(); render(); toast("Pedido despachado"); return; }
    if (action === "deactivate") return setStaff(el.dataset.id, { is_active: false });
  }

  function syncFilter() {
    document.querySelectorAll('[data-act="filter"]').forEach((button) => button.classList.toggle("on", button.dataset.id === ui.filter));
  }

  let lockY = 0;
  function lockScroll(on) {
    const b = document.body;
    if (on) {
      if (b.classList.contains("scroll-locked")) return;
      lockY = window.scrollY;
      b.classList.add("scroll-locked");
      Object.assign(b.style, { position: "fixed", top: -lockY + "px", left: "0", right: "0", width: "100%", overflow: "hidden" });
    } else if (b.classList.contains("scroll-locked")) {
      b.classList.remove("scroll-locked");
      Object.assign(b.style, { position: "", top: "", left: "", right: "", width: "", overflow: "" });
      window.scrollTo(0, lockY);
    }
  }
  function sheetEl() {
    const sh = document.getElementById("sheet");
    if (!sh.dataset.wired) {
      sh.dataset.wired = "1";
      sh.addEventListener("close", () => { sh.classList.remove("product-sheet"); lockScroll(false); ui.detail = null; });
      sh.addEventListener("cancel", () => lockScroll(false));
      sh.addEventListener("click", (e) => { if (e.target === sh) sh.close(); });
      let y0 = null, dy = 0;
      sh.addEventListener("touchstart", (e) => { y0 = sh.scrollTop <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
      sh.addEventListener("touchmove", (e) => {
        if (y0 == null || !sh.classList.contains("product-sheet")) return;
        dy = e.touches[0].clientY - y0;
        if (dy > 0 && sh.scrollTop <= 0) { sh.style.transform = `translateY(${Math.min(dy, 400)}px)`; if (e.cancelable) e.preventDefault(); }
      }, { passive: false });
      sh.addEventListener("touchend", () => {
        if (y0 == null) return;
        sh.style.transform = "";
        if (dy > 90 && sh.open) sh.close();
        y0 = null; dy = 0;
      });
    }
    return sh;
  }
  function openProduct(key) {
    const vars = visibleProducts().filter((p) => productKey(p) === String(key) || p.id === String(key));
    if (!vars.length) return;
    const k = productKey(vars[0]);
    const v0 = pickVariant(k, bySize(vars));
    ui.detail = { key: k, variant: v0.id, slide: 0 };
    const sh = sheetEl();
    sh.classList.add("product-sheet");
    drawDetail();
    lockScroll(true);
    if (!sh.open) sh.showModal();
    sh.scrollTop = 0;
  }
  function detailVariant() {
    const d = ui.detail; if (!d) return null;
    const vars = bySize(visibleProducts().filter((p) => productKey(p) === d.key));
    return vars.find((v) => v.id === d.variant) || vars[0];
  }
  function drawDetail() {
    const d = ui.detail; if (!d) return;
    const vars = bySize(visibleProducts().filter((p) => productKey(p) === d.key));
    const v = detailVariant(); if (!v) return;
    const imgs = groupImages([v]).filter(Boolean);
    const priced = priceOf(v); const soldOut = stockOf(v) <= 0;
    document.getElementById("sheet").innerHTML = `<button class="sheet-close" type="button" data-act="close-sheet" aria-label="Cerrar">${icon("close", 18)}</button><div class="detail product-detail">
      <div class="carousel" id="pd-carousel">
        <div class="carousel-track" id="pd-track">${(imgs.length ? imgs : [""]).map((u, i) => `<img class="carousel-slide" decoding="async" width="800" height="1000" ${i ? 'loading="lazy"' : ""} alt="${esc(v.name)} talla ${esc(v.size_label || "")} ${i + 1}" src="${esc(safeSrc(u))}">`).join("")}</div>
        ${imgs.length > 1 ? `<div class="carousel-dots">${imgs.map((_, i) => `<button type="button" class="dot-btn ${i === d.slide ? "on" : ""}" data-act="pd-slide" data-id="${i}" aria-label="Foto ${i + 1}"></button>`).join("")}</div>` : ""}
      </div>
      <div class="pad stack">
        <p class="kicker">${esc(nameOf("categories", v.category_id))}</p>
        <h2>${esc(v.name)}</h2>
        <p class="tiny">${esc([v.fabric, v.color].filter(Boolean).join(" · "))}</p>
        <div class="row"><strong class="price">${soles(priced.unit)}</strong>${priced.offer ? `<s class="tiny">${soles(priced.list)}</s>` : ""}</div>
        ${vars.length ? `<div class="stack opt-group"><span class="tiny">Talla</span><div class="size-pick" role="group" aria-label="Talla">${vars.map((x) => { const off = stockOf(x) <= 0; return `<button type="button" class="chip opt ${x.id === v.id ? "on" : ""} ${off ? "off" : ""}" data-act="pd-size" data-id="${esc(x.id)}" ${off ? "disabled title=\"Agotado\"" : ""} aria-pressed="${x.id === v.id}">${esc(x.size_label || "Única")}</button>`; }).join("")}</div></div>` : ""}
        ${v.description ? `<p>${esc(v.description)}</p>` : ""}
        <p class="tiny">Código ${esc(v.sku || "")} · ${soldOut ? "Agotado" : "Disponible"}</p>
        <div class="row"><button class="btn btn-bag" type="button" data-act="cart-add" data-id="${esc(v.id)}" ${soldOut ? "disabled" : ""}>${icon("bag", 16)} ${soldOut ? "Agotado" : "Agregar talla " + esc(v.size_label || "")}</button><button class="more-btn" type="button" data-act="pdp-open" data-id="${esc(d.key)}">Ver detalles</button></div>
      </div></div>`;
    const track = document.getElementById("pd-track");
    if (track) {
      track.scrollLeft = track.clientWidth * d.slide;
      track.addEventListener("scroll", () => { const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (ui.detail && i !== ui.detail.slide) { ui.detail.slide = i; document.querySelectorAll(".carousel-dots .dot-btn").forEach((b, k) => b.classList.toggle("on", k === i)); } }, { passive: true });
    }
  }

  // Carrito
  function loadCart() { try { const c = JSON.parse(localStorage.getItem("dl-cart") || "[]"); if (Array.isArray(c)) ui.cart = c.filter((l) => l && l.productId && l.qty > 0); } catch { } }
  function saveCart() { try { localStorage.setItem("dl-cart", JSON.stringify(ui.cart || [])); } catch { } syncBag(); }
  function cartCount() { return (ui.cart || []).reduce((n, l) => n + Number(l.qty || 0), 0); }
  function cartLines() { return (ui.cart || []).map((l) => ({ line: l, p: byId("products", l.productId) })).filter((x) => x.p); }
  function cartSum() { return cartLines().reduce((n, x) => n + priceOf(x.p).unit * x.line.qty, 0); }
  function syncBag() {
    const b = document.getElementById("dl-bag"); if (!b) return;
    const n = cartCount(); const c = b.querySelector(".bag-count");
    if (c) { c.textContent = n; c.hidden = !n; }
  }
  function mountHeader() {
    const row = document.querySelector(".site-header .header-row"); if (!row) return;
    const theme = row.querySelector('[data-act="theme"]');
    if (!document.getElementById("dl-bag")) {
      const a = document.createElement("a");
      a.id = "dl-bag"; a.className = "icon-btn bag-btn"; a.href = "#pedido"; a.setAttribute("aria-label", "Carrito");
      a.innerHTML = icon("bag", 18) + '<b class="bag-count" hidden>0</b>';
      row.insertBefore(a, theme || null);
    }
    if (theme) { theme.classList.add("theme-btn"); row.appendChild(theme); }
    document.querySelectorAll(".site-footer > div:not(.ft-brand)").forEach((col) => {
      if (col.querySelector(".map-btn")) return;
      const name = (col.querySelector("strong") || {}).textContent || "";
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "map-btn"; btn.dataset.act = "map"; btn.dataset.id = name.trim();
      btn.innerHTML = icon("pin", 16) + " <span>Ver ubicación</span>";
      col.appendChild(btn);
    });
    syncBag();
  }
  function storeGeo(group) {
    const key = String(group || "").replace(/^Galería /i, "").toLowerCase();
    return (state.pubStores || []).filter((s) => s.lat != null && s.lng != null && String(s.name).toLowerCase().includes(key.split(" ")[0]));
  }
  function openMap(group, idx) {
    const list = storeGeo(group); if (!list.length) { toast("Ubicación no disponible todavía"); return; }
    const k = Math.min(Number(idx) || 0, list.length - 1); const g = list[k];
    const d = 0.003;
    const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${g.lng - d},${g.lat - d},${g.lng + d},${g.lat + d}&layer=mapnik&marker=${g.lat},${g.lng}`;
    document.getElementById("sheet").innerHTML = `<div class="pad stack map-panel">
      <div class="row"><h3>${icon("pin", 18)} ${esc(group)}</h3><button class="icon-btn" type="button" data-act="close-sheet" aria-label="Cerrar">${icon("close", 18)}</button></div>
      ${list.length > 1 ? `<div class="row opt-row">${list.map((x, i) => `<button type="button" class="chip ${i === k ? "on" : ""}" data-act="map" data-id="${esc(group)}" data-i="${i}">${esc(x.name)}</button>`).join("")}</div>` : ""}
      <p class="tiny">${esc(g.address || "")}</p>
      <iframe class="map-frame" title="Mapa" src="${esc(osm)}" loading="lazy"></iframe>
      <div class="row map-actions">
        <a class="btn" target="_blank" rel="noopener" href="${esc(g.maps_url || `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`)}">Abrir en Google Maps</a>${g.whatsapp ? `<a class="btn ghost wa-btn" target="_blank" rel="noopener" href="https://wa.me/${String(g.whatsapp).replace(/\D/g, "").replace(/^(9\d{8})$/, "51$1")}">WhatsApp de la tienda</a>` : ""}
        <a class="btn ghost" target="_blank" rel="noopener" href="https://waze.com/ul?ll=${g.lat},${g.lng}&navigate=yes">Abrir en Waze</a>
        <a class="btn ghost" href="geo:${g.lat},${g.lng}?q=${g.lat},${g.lng}">App de mapas</a>
      </div></div>`;
    const sh = sheetEl(); sh.classList.remove("product-sheet"); lockScroll(true); if (!sh.open) sh.showModal();
  }
  const STEPS = [["carrito", "Carrito"], ["datos", "Datos"], ["entrega", "Entrega"], ["pago", "Pago"]];
  function renderPedido() {
    const step = ui.step || "carrito";
    const lines = cartLines(); const total = cartSum();
    const idx = STEPS.findIndex(([k]) => k === step);
    const bar = `<ol class="steps">${STEPS.map(([k, l], i) => `<li class="step ${i < idx ? "done" : ""} ${i === idx ? "on" : ""}"><span class="step-n">${i < idx ? icon("check", 14) : i + 1}</span>${l}</li>`).join("")}</ol>`;
    const sum = `<div class="row total-row cart-total"><span>Total</span><b>${moneyHtml(total)}</b></div>`;
    let body = "";
    if (step === "carrito") {
      body = lines.length ? `<div class="stack cart-list">${lines.map(({ line, p }) => `<div class="row cart-line"><img class="thumb" loading="lazy" decoding="async" width="48" height="48" alt="" src="${esc(safeSrc(p.image_url))}"><span class="grow"><b>${esc(p.name)}</b><br><span class="tiny">${esc([p.size_label ? "Talla " + p.size_label : "", p.color || ""].filter(Boolean).join(" · "))}</span></span>
        <span class="qty"><button type="button" data-act="qty" data-cart="public" data-id="${esc(p.id)}" data-dir="-1">−</button><span>${line.qty}</span><button type="button" data-act="qty" data-cart="public" data-id="${esc(p.id)}" data-dir="1">+</button></span><b class="num">${soles(priceOf(p).unit * line.qty)}</b></div>`).join("")}</div>${sum}
        <div class="row"><a class="btn ghost" href="#coleccion">Seguir comprando</a><button class="btn" type="button" data-act="step" data-id="datos">Continuar</button></div>`
        : `<div class="empty-cart stack">${icon("bag", 40)}<p class="muted">Tu carrito está vacío.</p><a class="btn" href="#coleccion">Ver colección</a></div>`;
    } else if (step === "datos") {
      const c = ui.checkout || (ui.checkout = {});
      body = `<form class="stack" data-form="checkout-datos">
        <label>Nombre<input name="name" required value="${esc(c.name || (state.user && state.user.full_name) || "")}"></label>
        <label>Celular o WhatsApp<input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="15" required placeholder="9 dígitos, ej. 931246675" aria-describedby="phone-err" value="${esc(c.phone || (state.user && state.user.phone) || "")}"></label>
        <p class="field-error tiny" id="phone-err" role="alert" ${ui.phoneErr ? "" : "hidden"}>${esc(ui.phoneErr || "")}</p>
        <label>DNI (opcional)<input name="dni" inputmode="numeric" maxlength="8" value="${esc(c.dni || "")}"></label>
        ${sum}<div class="row"><button class="btn ghost" type="button" data-act="step" data-id="carrito">Atrás</button><button class="btn" type="submit">Continuar</button></div></form>`;
    } else if (step === "entrega") {
      const c = ui.checkout || (ui.checkout = {});
      const shops = state.pubStores || [];
      body = `<form class="stack" data-form="checkout-entrega">
        <label class="checks"><input type="radio" name="mode" value="recojo" ${c.mode !== "delivery" ? "checked" : ""}> Recojo en tienda</label>
        <label class="checks"><input type="radio" name="mode" value="delivery" ${c.mode === "delivery" ? "checked" : ""}> Envío a domicilio</label>
        <label>Tienda que atiende tu pedido<select name="store" required>${shops.map((x) => `<option value="${esc(x.id)}" ${String(c.store) === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <label>Dirección (solo envío)<input name="address" value="${esc(c.address || "")}" placeholder="Calle, número, distrito, referencia"></label>
        <label>Nota para la tienda (opcional)<textarea name="notes" maxlength="300" rows="2">${esc(c.notes || "")}</textarea></label>
        ${sum}<div class="row"><button class="btn ghost" type="button" data-act="step" data-id="datos">Atrás</button><button class="btn" type="submit">Continuar</button></div></form>`;
    } else if (ui.lastOrder) {
      const o = ui.lastOrder;
      body = `<div class="stack order-done">${icon("check", 36)}<h3>¡Pedido recibido!</h3>
        <p>Código <b class="order-code">${esc(o.code)}</b> · Total <b>${moneyHtml(Math.round(Number(o.total) * 100))}</b></p>
        <p class="muted">La tienda revisará el stock y te escribirá para confirmar. Puedes ver el estado en Mis pedidos.</p>
        <div class="row"><a class="btn" href="#cuenta">Mis pedidos</a><a class="btn ghost" href="#coleccion">Seguir viendo</a></div></div>`;
    } else {
      const c = ui.checkout || {};
      const shop = (state.pubStores || []).find((x) => x.id === String(c.store));
      body = `<div class="stack pay-soon"><h3>Confirmar pedido</h3>
        <p class="tiny">${c.mode === "delivery" ? "Envío a: " + esc(c.address || "") : "Recojo en: " + esc(shop ? shop.name : "")} · ${esc(c.phone || "")}</p>
        ${sum}<p class="muted">El pago en línea llega pronto. Por ahora pagas en tienda o al recibir.</p>
        <div class="row"><button class="btn ghost" type="button" data-act="step" data-id="entrega">Atrás</button><button class="btn" type="button" data-act="place-order">Confirmar pedido</button></div></div>`;
    }
    return `<section class="checkout stack"><h1>${icon("bag", 22)} Tu pedido</h1>${bar}<div class="panel stack">${body}</div></section>`;
  }
  async function goStep(next) {
    if (next !== "carrito" && !cartLines().length) throw new Error("Tu carrito está vacío");
    if (next !== "carrito" && !state.user) {
      ui.afterLogin = "pedido"; ui.step = next;
      try { localStorage.setItem("dl-after", "pedido"); } catch { }
      ui.authMode = "up"; location.hash = "entrar"; toast("Crea tu cuenta o entra para continuar. Tu carrito se guarda.");
      return;
    }
    ui.step = next; render(); window.scrollTo(0, 0);
  }


  async function submit(form) {
    const kind = form.dataset.form;
    if (window.DL_FORMS && window.DL_FORMS[kind]) return window.DL_FORMS[kind](form);
    if (kind === "forgot") {
      const email = form.elements.email.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Usa tu correo para recuperar la contraseña (no el usuario ni el celular).");
      await Store.recoverPassword(email, location.origin + location.pathname);
      ui.authMode = "in"; render(); return toast("Si el correo está registrado, te llegará un enlace en unos minutos. Revisa también spam.");
    }
    if (kind === "new-password") {
      const a = form.elements.password.value, b = form.elements.password2.value;
      if (a.length < 8) throw new Error("La contraseña necesita 8 caracteres");
      if (a !== b) throw new Error("Las contraseñas no coinciden");
      await Store.updatePassword(a);
      ui.recovery = false; location.hash = homeHash(); render(); return toast("Contraseña actualizada ✓");
    }
    if (kind === "auth") {
      const name = form.elements.name ? form.elements.name.value : "";
      const password = form.elements.password.value;
      if (ui.authMode === "up") {
        const phone = normPhone(form.elements.phone.value); const errEl = document.getElementById("su-phone-err");
        if (!phone) { const msg = "Revisa tu celular: 9 dígitos que empiezan con 9 (ej. 931246675)."; if (errEl) { errEl.textContent = msg; errEl.hidden = false; } form.elements.phone.focus(); return; }
        if (errEl) errEl.hidden = true; form.elements.phone.value = phone;
        const r = await Store.signUp({ name, username: form.elements.username.value, email: form.elements.email.value, password, phone, dni: form.elements.dni ? form.elements.dni.value : "" });
        if (r && r.pending) { ui.authMode = "check-email"; ui.pendingEmail = r.email; render(); window.scrollTo(0, 0); return; }
      } else await Store.signIn({ login: form.elements.login.value, password });
      ui.q = ""; ui.filter = "todas";
      await reload();
      location.hash = homeHash();
      toast(state.user && state.user.role === "ADMIN" ? "Entraste como administrador" : "Sesión abierta");
      return;
    }
    if (kind === "home-settings") return saveHomeSettings(form);
    if (kind === "checkout-datos") {
      const el = form.elements; const phone = normPhone(el.phone.value);
      const err = document.getElementById("phone-err");
      if (!phone) { ui.phoneErr = "Revisa tu celular: 9 dígitos que empiezan con 9 (ej. 931246675)."; if (err) { err.hidden = false; err.textContent = ui.phoneErr; } el.phone.focus(); return; }
      ui.phoneErr = ""; ui.checkout = Object.assign(ui.checkout || {}, { name: el.name.value.trim(), phone, dni: el.dni.value.trim() });
      return goStep("entrega");
    }
    if (kind === "checkout-entrega") { const el = form.elements; const mode = form.querySelector('input[name="mode"]:checked').value; if (!el.store.value) throw new Error("Elige una tienda"); if (mode === "delivery" && el.address.value.trim().length < 5) throw new Error("Escribe la dirección de envío"); ui.checkout = Object.assign(ui.checkout || {}, { mode, store: el.store.value, address: el.address.value.trim(), notes: el.notes.value.trim() }); ui.lastOrder = null; return goStep("pago"); }
    if (kind === "crud") return saveCrud(form);
    if (kind === "product") return saveProduct();
    if (kind === "size") return addSize(form);
    if (kind === "noop") return;
    if (kind === "store-staff") return saveStoreStaff(form);
    if (kind === "prices") return savePrices(form);
    if (kind === "new-user") return createUser(form);
    if (kind === "staff-edit") {
      const el = form.elements;
      const roles = ROLES.filter((r) => r !== "PENDIENTE").concat(PERMS).filter((r) => el["roles_" + r] && el["roles_" + r].checked);
      if (el.role.value !== "PENDIENTE" && !roles.includes(el.role.value)) roles.unshift(el.role.value);
      return setStaff(form.dataset.id, { role: el.role.value, roles, store_id: el.store_id.value || null, full_name: el.full_name.value.trim() });
    }
    if (kind === "staff-pass") { if (!isAdmin()) throw new Error("Solo el administrador"); await Store.adminSetPassword(form.dataset.id, form.elements.password.value); form.reset(); toast("Contraseña cambiada"); return; }
    if (kind === "stock") return adjustStock(form);
    if (kind === "partner-move") return partnerMove(form);
    if (kind === "lot") return saveLot(form);
    if (kind === "send") return sendWork(form);
    if (kind === "receive") return receiveWork(form);
    if (kind === "assemble") return assemble(form);
    if (kind === "store-order") {
      const count = (state.data.store_orders || []).length + 1;
      await Store.insert("store_orders", { id: nid("so"), order_number: "PT-" + String(2400 + count), store_id: form.elements.store_id.value, notes: form.elements.notes.value.trim(), status: "PENDIENTE", created_by: state.user.full_name, created_at: new Date().toISOString() });
      await reload(); render(); toast("Pedido anotado"); return;
    }
  }

  function nextNumber(table, key, prefix, floor) {
    const nums = (state.data[table] || []).filter((row) => String(row[key] || "").startsWith(prefix)).map((row) => Number(String(row[key]).slice(prefix.length).replace(/\D/g, ""))).filter((n) => Number.isFinite(n));
    return prefix + (Math.max(floor, ...nums, floor) + 1);
  }

  async function voidSale(id) {
    if (!allow(["SUPERVISOR"])) throw new Error("Solo administración o supervisión anula");
    if (!await DL_UI.confirm("¿Anular esta venta y devolver el stock?")) return;
    const sale = byId("sales", id);
    if (!sale || sale.status === "VOID") throw new Error("Esa venta ya está anulada");
    if (Store.mode === "remote") {
      const { reason, refund } = await askCancel(sale);
      const r = await Store.v2api.cancelSale(id, reason, refund);
      await reload(); render(); toast("Venta anulada" + (r && r.series ? " · nota de crédito " + r.series + "-" + r.number : "") + " · stock devuelto"); return;
    }
    if (sale.status !== "COMPLETED") throw new Error("Esa venta ya está anulada");
    const items = (state.data.sale_items || []).filter((row) => row.sale_id === id);
    await Store.transaction(async () => {
      for (const item of items) await applyDelta(item.product_id, sale.warehouse_id, Number(item.quantity), "VOID", sale.sale_number);
      await Store.update("sales", id, { status: "VOID" });
    });
    await reload(); render(); toast("Venta anulada y stock devuelto");
  }

  async function adjustStock(form) {
    const productId = form.elements.product_id.value;
    const warehouseId = form.elements.warehouse_id.value;
    const quantity = Number.parseInt(form.elements.quantity.value, 10);
    if (!productId || !warehouseId || !Number.isFinite(quantity) || quantity < 0) throw new Error("Completa pieza, almacén y cantidad");
    const current = stockIn(productId, warehouseId);
    await Store.transaction(async () => {
      await applyDelta(productId, warehouseId, quantity - current, "AJUSTE", form.elements.note.value.trim());
    });
    await reload(); render(); toast("Stock actualizado");
  }

  async function partnerMove(form) {
    const kind = form.elements.kind.value;
    const productId = form.elements.product_id.value || null;
    const warehouseId = form.elements.warehouse_id.value || null;
    const quantity = Number.parseInt(form.elements.quantity.value, 10) || 0;
    const amount = Math.round((Number(form.elements.amount.value) || 0) * 100);
    await Store.transaction(async () => {
      if (kind === "ENTREGA" && productId && warehouseId && quantity > 0) await applyDelta(productId, warehouseId, -quantity, "MAYORISTA", "Entrega");
      if (kind === "DEVOLUCION" && productId && warehouseId && quantity > 0) await applyDelta(productId, warehouseId, quantity, "DEVOLUCION", "Mayorista");
      await Store.insert("partner_moves", {
        id: nid("pm"), partner_id: form.elements.partner_id.value, kind, product_id: productId, warehouse_id: warehouseId,
        quantity, amount_cents: amount, note: form.elements.note.value.trim(), created_by: state.user.full_name, created_at: new Date().toISOString(),
      });
    });
    await reload(); render(); toast("Movimiento registrado");
  }

  async function saveLot(form) {
    const meters = Math.round(Number(form.elements.meters.value) * 100);
    const left = Math.round(Number(form.elements.left.value) * 100);
    if (!form.elements.fabric_id.value || !form.elements.supplier_id.value) throw new Error("Elige tela y proveedor");
    await Store.insert("fabric_lots", { id: nid("lot"), supplier_id: form.elements.supplier_id.value, fabric_id: form.elements.fabric_id.value, meters_cm: meters, meters_left_cm: left, created_at: new Date().toISOString() });
    await reload(); render(); toast("Lote guardado");
  }

  async function sendWork(form) {
    const lot = byId("fabric_lots", form.elements.fabric_lot_id.value);
    const cm = Math.round(Number(form.elements.meters.value) * 100);
    if (!lot || cm > Number(lot.meters_left_cm)) throw new Error("El lote no alcanza");
    await Store.transaction(async () => {
      await Store.update("fabric_lots", lot.id, { meters_left_cm: Number(lot.meters_left_cm) - cm });
      await Store.insert("work_orders", {
        id: nid("wo"), order_number: nextNumber("work_orders", "order_number", "OS-", 2400), tailor_id: form.elements.tailor_id.value,
        fabric_lot_id: lot.id, piece_type: form.elements.piece_type.value, audience: form.elements.audience.value, meters_cm: cm,
        qty_expected: Number(form.elements.qty.value) || 1, qty_received: 0, sizes_note: form.elements.sizes.value.trim(),
        status: "ENVIADO", created_by: state.user.full_name, sent_at: new Date().toISOString(),
      });
    });
    await reload(); render(); toast("Corte enviado");
  }

  async function receiveWork(form) {
    const order = byId("work_orders", form.elements.work_order_id.value);
    if (!order) throw new Error("Elige una orden");
    const lot = byId("fabric_lots", order.fabric_lot_id);
    const qty = Number(form.elements.quantity.value) || 1;
    const size = form.elements.size_label.value.trim();
    const received = Number(order.qty_received || 0) + qty;
    await Store.transaction(async () => {
      await Store.insert("work_receipts", { id: nid("wr"), work_order_id: order.id, size_label: size, quantity: qty, created_by: state.user.full_name, created_at: new Date().toISOString() });
      await Store.insert("workshop_pieces", { id: nid("piece"), work_order_id: order.id, piece_type: order.piece_type, audience: order.audience, fabric_id: lot ? lot.fabric_id : null, size_label: size, quantity: qty, status: "LIBRE" });
      await Store.update("work_orders", order.id, { qty_received: received, status: received >= Number(order.qty_expected) ? "RECIBIDO" : "PARCIAL" });
    });
    await reload(); render(); toast("Piezas recibidas");
  }

  async function assemble(form) {
    const ids = Array.from(form.querySelectorAll('input[name="piece"]:checked')).map((input) => input.value);
    if (ids.length < 2) throw new Error("Marca al menos saco y pantalón");
    const pieces = ids.map((id) => byId("workshop_pieces", id)).filter(Boolean);
    const price = Math.round(Number(form.elements.price.value) * 100);
    const size = form.elements.size_label.value.trim();
    const warehouseId = form.elements.warehouse_id.value;
    const line = form.elements.line_name.value.trim();
    if (!line || !size || !warehouseId || price <= 0) throw new Error("Completa nombre, precio, talla y almacén");
    const product = {
      id: nid("prod"), sku: "DL-SET-" + Math.random().toString(36).slice(2, 6).toUpperCase(), name: line,
      description: "Empatado en taller con piezas " + pieces.map((piece) => piece.piece_type).join(" + "),
      category_id: "cat-ternos", brand_id: "brand-dl", sale_price_cents: price, cost_price_cents: 0, wholesale_price_cents: Math.round(price * 0.8),
      image_url: null, min_stock: 1, size_label: size, is_active: true, deleted_at: null,
    };
    await Store.transaction(async () => {
      for (const piece of pieces) {
        const left = Number(piece.quantity) - 1;
        await Store.update("workshop_pieces", piece.id, { quantity: Math.max(0, left), status: left > 0 ? "LIBRE" : "USADA" });
      }
      await Store.insert("products", product);
      await Store.insert("stock_levels", { id: nid("sl"), product_id: product.id, warehouse_id: warehouseId, quantity_on_hand: 1 });
      await Store.insert("suit_sets", {
        id: nid("set"), set_number: nextNumber("suit_sets", "set_number", "TR-", 100), audience: pieces[0].audience || "ADULTO",
        fabric_id: pieces[0].fabric_id, size_label: size, line_name: line, has_vest: pieces.some((piece) => piece.piece_type === "CHALECO"),
        warehouse_id: warehouseId, product_id: product.id, created_at: new Date().toISOString(),
      });
    });
    await reload(); render(); toast("Terno empatado y publicado en la colección");
  }

  async function setStaff(id, patch) {
    if (!isAdmin()) throw new Error("Solo el administrador cambia al equipo");
    const person = byId("staff", id);
    if (!person) return;
    const admins = (state.data.staff || []).filter((row) => rolesOf(row).includes("ADMIN") && row.is_active !== false && row.id !== id);
    const nextRole = patch.roles ? (patch.roles.includes("ADMIN") ? "ADMIN" : patch.role) : (patch.role || person.role);
    const nextActive = patch.is_active === false ? false : person.is_active !== false;
    if (rolesOf(person).includes("ADMIN") && (nextRole !== "ADMIN" || nextActive === false) && admins.length === 0) {
      throw new Error("Tiene que quedar al menos un administrador");
    }
    await Store.update("staff", id, patch);
    await reload(); render(); toast("Equipo actualizado");
  }

  function bind() {
    document.body.addEventListener("click", (event) => {
      const el = event.target.closest("[data-act]");
      if (!el) return;
      if (el.dataset.busy) return; // evita doble toque
      const spin = ["cj-sell", "cj-layaway", "checkout-pay", "place-order"].includes(el.dataset.act);
      el.dataset.busy = "1"; if (spin) el.classList.add("is-loading");
      act(el).catch((err) => notifyError(err, "No se pudo completar")).finally(() => { delete el.dataset.busy; el.classList.remove("is-loading"); });
    });
    document.body.addEventListener("submit", (event) => {
      const form = event.target;
      if (!form || !form.dataset || !form.dataset.form) return;
      event.preventDefault();
      if (form.dataset.busy) return; // evita doble envío
      form.dataset.busy = "1";
      const btn = event.submitter || form.querySelector('button[type="submit"], button:not([type])');
      if (btn) { btn.classList.add("is-loading"); btn.setAttribute("aria-busy", "true"); }
      const kind = form.dataset.form; let busy = null;
      if (kind === "auth" || kind === "new-password") {
        busy = document.createElement("div"); busy.className = "dl-busy"; busy.setAttribute("role", "status");
        busy.innerHTML = `<img alt=""><i></i><span>${kind === "new-password" ? "Guardando…" : ui.authMode === "up" ? "Creando tu cuenta…" : "Entrando…"}</span>`;
        document.body.appendChild(busy);
      }
      submit(form).catch((err) => notifyError(err, "No se pudo guardar")).finally(() => {
        delete form.dataset.busy; if (busy) busy.remove();
        if (btn && btn.isConnected) { btn.classList.remove("is-loading"); btn.removeAttribute("aria-busy"); }
      });
    });
    document.body.addEventListener("input", (event) => {
      if (window.DL_INPUT && window.DL_INPUT(event)) return;
      if (event.target.form && event.target.form.id === "home-form") { pushPreview(); return; }
      if (event.target.name === "username" && event.target.form && event.target.form.dataset.form === "auth") { checkUsername(event.target); return; }
      if (event.target.dataset && event.target.dataset.crudQ) { const q = event.target.value.toLowerCase(); document.querySelectorAll(`[data-crud-list="${event.target.dataset.crudQ}"] tr.tap`).forEach((tr) => { tr.hidden = q && !tr.textContent.toLowerCase().includes(q); }); return; }
      if (event.target.id === "mq") { ui.mq = event.target.value; const q = ui.mq.toLowerCase(); document.querySelectorAll(".grid-edit tbody tr").forEach((tr) => { tr.hidden = q && !tr.textContent.toLowerCase().includes(q); }); return; }
      if (event.target.classList && event.target.classList.contains("money")) { event.target.classList.toggle("changed", event.target.value !== event.target.dataset.orig); return; }
      if (event.target.id === "pq") { ui.pq = event.target.value; const pos = event.target.selectionStart; render(); const box = document.getElementById("pq"); if (box) { box.focus(); box.setSelectionRange(pos, pos); } return; }
      if (event.target.id === "q") { ui.q = event.target.value; const grid = document.getElementById("grid"); if (grid) grid.innerHTML = productCards(); }
    });
    document.body.addEventListener("change", (event) => {
      if (event.target.form && event.target.form.id === "home-form") { pushPreview(); return; }
      if (window.DL_CHANGE && window.DL_CHANGE(event)) return;
      if (event.target.form && event.target.form.id === "product-form" && ["fabric_id", "color_id"].includes(event.target.name) && event.target.value === "__new") {
        event.target.value = ""; syncPform(); ui.pform.adding = event.target.name === "fabric_id" ? "fabrics" : "colors"; render();
        const box = document.getElementById("new-" + ui.pform.adding); if (box) box.focus(); return;
      }
      if (event.target.dataset && event.target.dataset.vf) { salesFilter()[event.target.dataset.vf] = event.target.value; render(); return; }
      if (event.target.id === "low-th") { const v = event.target.value; ui.lowTh = v === "" ? NaN : Math.max(0, Number(v)); render(); return; }
      if (event.target.id === "photo-url") { event.target.value = driveDirect(event.target.value); return; }
      if (event.target.id === "store") {
        ui.storeId = event.target.value;
        const house = (state.data.warehouses || []).find((row) => row.store_id === ui.storeId);
        if (house) ui.warehouseId = house.id;
        render();
      }
      if (event.target.id === "warehouse") { ui.warehouseId = event.target.value; render(); }
      if (event.target.name === "customer_id") ui.customerId = event.target.value;
      if (event.target.dataset.act === "role") setStaff(event.target.dataset.id, { role: event.target.value }).catch((err) => toast(err.message));
    });
    const sheet = document.getElementById("sheet");
    sheet.addEventListener("click", (event) => { if (event.target === sheet) sheet.close(); });
    window.addEventListener("hashchange", render);

  }

  window.DL = {
    state, ui, Store, PAY, ROLES, PERMS, ROLE_LABEL, render, reload, toast, moneyHtml, esc, soles, nid, localDay, byId, nameOf, allow, isAdmin, myRoles, rolesOf,
    icon, ordersPanel, priceOf, stockIn, stockOf, applyDelta, nextNumber, safeSrc, driveDirect, table, refField, bars, group, sumCents, completedSales, denied, visibleProducts,
    openSession: () => openSession(), detailVariant: () => detailVariant(),
    productKey, productGroups, bySize, groupImages, cardHtml, pickVariant, myOrdersHtml, isClient, page, closeSheet: () => { const sh = document.getElementById("sheet"); if (sh && sh.open) sh.close(); },
    sell: (order) => window.DLCaja.sell(order),
    voidSale: (id) => window.DLCaja.voidSale(id),
  };
  function splash() {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = document.createElement("div");
    el.className = "dl-splash"; el.setAttribute("role", "presentation");
    el.innerHTML = '<img class="splash-logo" src="assets/logo-gold.png" alt=""><span class="splash-name" style="opacity:0">DAN-LINER</span><i class="splash-line" style="width:0"></i>';
    document.body.appendChild(el);
    document.documentElement.classList.add("dl-ready");
    let done = false; const start = Date.now();
    const finish = () => {
      if (done) return; done = true;
      const out = el.animate ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce ? 120 : 300, easing: "ease-in", fill: "forwards" }) : null;
      setTimeout(() => el.remove(), reduce ? 140 : 320);
      if (out) out.onfinish = () => el.remove();
    };
    el.addEventListener("click", finish); window.addEventListener("keydown", finish, { once: true });
    if (!reduce && el.animate) {
      const logo = el.querySelector(".splash-logo"), name = el.querySelector(".splash-name"), line = el.querySelector(".splash-line");
      if (!logo) return;
      name.animate([{ opacity: 0, letterSpacing: ".8em" }, { opacity: 1, letterSpacing: ".45em" }], { duration: 600, delay: 300, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" });
      line.animate([{ width: "0px", backgroundPosition: "-120px 0" }, { width: "120px", backgroundPosition: "120px 0" }], { duration: 650, delay: 450, easing: "ease-out", fill: "forwards" });
    } else { el.querySelector(".splash-name").style.opacity = 1; el.querySelector(".splash-line").style.width = "120px"; }
    return () => { const wait = Math.max(0, (reduce ? 300 : 1150) - (Date.now() - start)); setTimeout(finish, Math.min(wait, 1200)); };
  }
  async function boot() {
    const endSplash = splash();
    loadCart();
    try { if (localStorage.getItem("dl-after")) ui.afterLogin = localStorage.getItem("dl-after"); } catch { }
    initTheme();
    bind();
    try {
      await Store.init();
      await reload();
    } catch (err) {
      document.getElementById("view").innerHTML = `<section style="padding:28px 0"><h1>No se pudo abrir la tienda</h1><p class="bad">${esc(err.message)}</p></section>`;
      endSplash();
      return;
    }
    const back = Store.authReturn;
    if (back && back.error) setTimeout(() => toast("El enlace no es válido o venció. Pide uno nuevo."), 400);
    else if (back && back.type === "recovery") { ui.recovery = true; ui.authMode = "in"; location.hash = "entrar"; }
    else if (back && back.type) { try { localStorage.removeItem("dl-pending-signup"); } catch { } setTimeout(() => toast("Correo confirmado ✓ Bienvenido"), 400); }
    if (!location.hash) location.hash = "coleccion";
    try { if (!localStorage.getItem("dl-theme")) initTheme(); } catch { }
    render();
    mountHeader();
    endSplash();
  }
  const REFUND_FROM = { efectivo: "CASH", yape: "YAPE", plin: "PLIN", tarjeta: "CARD", transferencia: "TRANSFER", transf: "TRANSFER" };
  async function askCancel(sale) {
    const paid = Number(sale.paid_cents || 0);
    const reason = (await DL_UI.prompt("Motivo de la anulación", "", { ok: "Continuar" }) || "").trim();
    if (!reason) throw new Error("Indica el motivo de la anulación");
    let refund = null;
    if (paid > 0) {
      const m = await DL_UI.choose("¿Cómo devuelves " + soles(paid) + "?", [["same", "Mismo medio del pago"], ["CASH", "Efectivo"], ["YAPE", "Yape"], ["PLIN", "Plin"], ["CARD", "Tarjeta"], ["TRANSFER", "Transferencia"]], "same");
      if (m === null) throw new Error("Anulación cancelada");
      if (m !== "same") refund = m;
    }
    return { reason, refund };
  }
  async function sellRemote(order, lines, session) {
    const docType = ["BOLETA", "FACTURA", "TICKET"].includes(order.docType) ? order.docType : "BOLETA";
    const customerId = await Store.v2api.ensureCustomer({ customerId: order.customerId, name: order.customerName, doc: order.customerDoc, phone: order.customerPhone, address: order.customerAddress });
    const total = lines.reduce((n, l) => n + l.lineTotal, 0);
    if (!session || session.user_id !== state.user.id) throw new Error("Para vender necesitas TU propia caja abierta en esta tienda");
    let pays = (order.payments && order.payments.length ? order.payments : [{ method: PAY[order.payment] ? order.payment : (PAY_FROM_CAJA[order.payment] || "CASH"), cents: total }]);
    if (pays.reduce((n, p) => n + Number(p.cents || 0), 0) <= 0) throw new Error("Un separado necesita un adelanto mayor a cero");
    pays = await Store.v2api.attachProof(pays, order.payProof);
    const res = await Store.v2api.createSale({
      store_id: Number(ui.storeId), warehouse_id: Number(ui.warehouseId), cash_session_id: Number(session.id), customer_id: customerId, document_type: docType,
      notes: order.note || null,
      items: lines.map((l) => ({ variant_id: Number(l.productId), quantity: l.qty, unit_price: l.unit / 100, discount: 0 })),
      payments: Store.v2api.dbPayments(pays),
    });
    await reload();
    const sale = byId("sales", String(res.sale_id)) || { id: String(res.sale_id), doc_type: docType, total_cents: total };
    sale.result = res;
    if (res.series) sale.sale_number = res.series + "-" + String(res.number).padStart(8, "0");
    return sale;
  }
  // Caja
  const PAY_FROM_CAJA = { efectivo: "CASH", tarjeta: "CARD", yape: "YAPE", plin: "PLIN", transfer: "TRANSFER" };
  function needCaja() {
    if (!state.user) throw new Error("Entra primero");
    if (!allow(["SUPERVISOR", "VENDEDOR", "CAJERO"])) throw new Error("Tu rol no usa la caja");
  }
  window.DLCaja = {
    snapshot() {
      const store = byId("stores", ui.storeId) || null;
      const warehouse = byId("warehouses", ui.warehouseId) || null;
      const products = visibleProducts().map((product) => {
        const priced = priceOf(product);
        const cat = byId("categories", product.category_id);
        return {
          id: product.id, sku: product.sku, name: product.name, size: product.size_label || "",
          category_id: product.category_id, category_slug: cat ? (cat.slug || cat.name || "").toLowerCase() : "",
          category_name: cat ? cat.name : "", brand: nameOf("brands", product.brand_id),
          list_cents: Number(product.sale_price_cents) || 0, unit_cents: priced.unit, promo: priced.name, promo_percent: priced.percent,
          stock: stockIn(product.id, ui.warehouseId), image_url: product.image_url, cost_cents: Number(product.cost_price_cents || 0),
          min_cents: Number(product.min_price_cents || 0), wholesale_cents: Number(product.wholesale_price_cents || 0), color: product.color || "",
        };
      });
      const categories = (state.data.categories || []).filter((row) => row.is_active !== false).sort((a, b) => a.sort_order - b.sort_order);
      const staff = (state.data.staff || []).filter((row) => row.is_active !== false && ["ADMIN", "SUPERVISOR", "VENDEDOR", "CAJERO"].includes(row.role))
        .map((row) => ({ id: row.id, full_name: row.full_name, role: row.role }));
      if (state.user && !staff.some((row) => row.id === state.user.id)) staff.unshift({ id: state.user.id, full_name: state.user.full_name, role: state.user.role });
      return JSON.parse(JSON.stringify({
        user: state.user, store, warehouse, products, categories, staff,
        customers: (state.data.customers || []).filter((row) => row.is_active !== false),
        session: openSession() || null,
        store_open: (state.data.cash_sessions || []).filter((row) => row.status === "OPEN" && row.store_id === ui.storeId).map((row) => ({ user: nameOf("staff", row.user_id) === "—" ? "" : byId("staff", row.user_id).full_name, opened_at: row.opened_at })),
        sales: (state.data.sales || []).filter((row) => row.store_id === ui.storeId),
        sale_items: state.data.sale_items || [],
        expenses: (state.data.expenses || []).filter((row) => row.store_id === ui.storeId),
        mode: Store.mode,
      }));
    },
    async refresh() { await reload(); return this.snapshot(); },
    toast(message) { toast(message); },
    async openCash(openingCents) {
      needCaja();
      if (openSession()) throw new Error("Ya tienes una caja abierta en esta tienda");
      if (Store.mode === "remote") { const sid = await Store.v2api.openCash(ui.storeId, openingCents); await reload(); return byId("cash_sessions", String(sid)); }
      const row = { id: nid("cash"), store_id: ui.storeId, user_id: state.user.id, opening_cents: Math.round(openingCents) || 0, closing_cents: null, status: "OPEN", opened_at: new Date().toISOString(), closed_at: null };
      await Store.insert("cash_sessions", row);
      await reload();
      return row;
    },
    async closeCash(countedCents) {
      needCaja();
      const session = openSession();
      if (!session) throw new Error("No hay caja abierta");
      if (Store.mode === "remote") { await Store.v2api.closeCash(session.id, countedCents, null); await reload(); return session; }
      await Store.update("cash_sessions", session.id, { status: "CLOSED", closing_cents: Math.round(countedCents) || 0, closed_at: new Date().toISOString() });
      await reload();
      return session;
    },
    async addCustomer(data) {
      needCaja();
      const row = { id: nid("cus"), name: String(data.name || "").trim(), phone: String(data.phone || "").trim() || null, note: String(data.note || "").trim() || null, doc: String(data.doc || data.document_number || "").trim() || null, address: String(data.address || "").trim() || null, is_active: true };
      if (!row.name) throw new Error("Falta el nombre del cliente");
      if (Store.mode === "remote") { const saved = await Store.insert("customers", row); await reload(); return saved; }
      await Store.insert("customers", row);
      await reload();
      return row;
    },
    async sell(order) {
      needCaja();
      const session = openSession();
      if (!session) throw new Error("Abre la caja antes de cobrar");
      const lines = (order.lines || []).map((line) => {
        const product = byId("products", line.productId);
        if (!product) throw new Error("Pieza no encontrada");
        const qty = Math.max(1, Number.parseInt(line.qty, 10) || 1);
        const listUnit = priceOf(product).unit;
        const unit = Number.isFinite(Number(line.unitCents)) && Number(line.unitCents) > 0 ? Math.round(Number(line.unitCents)) : listUnit;
        return { productId: product.id, product, qty, listUnit, unit, lineTotal: unit * qty };
      });
      if (!lines.length) throw new Error("El ticket está vacío");
      if (Store.mode === "remote") return sellRemote(order, lines, session);
      const sub = lines.reduce((sum, line) => sum + line.listUnit * line.qty, 0);
      const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      const customer = order.customerId ? byId("customers", order.customerId) : null;
      const sale = {
        id: nid("sale"),
        sale_number: nextNumber("sales", "sale_number", order.series || "B001-", 1000),
        doc_type: order.docType || "BOLETA",
        customer_address: order.customerAddress || null,
        payments: order.payments || null,
        pay_proof: order.payProof || null,
        store_id: ui.storeId,
        warehouse_id: ui.warehouseId,
        session_id: session.id,
        customer_id: customer ? customer.id : null,
        customer_name: customer ? customer.name : (order.customerName || "Mostrador"),
        seller_user_id: order.sellerId || state.user.id,
        seller_name: order.sellerName || state.user.full_name,
        status: "COMPLETED",
        subtotal_cents: Math.max(sub, total),
        discount_cents: Math.max(0, sub - total),
        total_cents: total,
        payment_method: PAY[order.payment] ? order.payment : (PAY_FROM_CAJA[order.payment] || "CASH"),
        customer_doc: order.customerDoc || null,
        discount_note: sub > total ? "Precio ajustado en caja" : "",
        sold_at: new Date().toISOString(),
      };
      await Store.transaction(async () => {
        for (const line of lines) await applyDelta(line.productId, ui.warehouseId, -line.qty, "SALE", sale.sale_number);
        await Store.insert("sales", sale);
        for (const line of lines) {
          await Store.insert("sale_items", {
            id: nid("si"), sale_id: sale.id, product_id: line.productId, quantity: line.qty,
            unit_price_cents: line.unit, line_total_cents: line.lineTotal, cost_cents: Number(line.product.cost_price_cents || 0),
          });
        }
      });
      await reload();
      return sale;
    },
    async voidSale(id, reason) {
      if (!allow(["SUPERVISOR"])) throw new Error("Solo administración o supervisión anula");
      const sale = byId("sales", id);
      if (Store.mode === "remote") {
        const ask = reason ? { reason, refund: null } : await askCancel(sale);
        await Store.v2api.cancelSale(id, ask.reason, ask.refund); await reload(); return byId("sales", id) || sale;
      }
      if (!sale || sale.status !== "COMPLETED") throw new Error("Esa venta ya está anulada");
      const items = (state.data.sale_items || []).filter((row) => row.sale_id === id);
      await Store.transaction(async () => {
        for (const item of items) await applyDelta(item.product_id, sale.warehouse_id, Number(item.quantity), "VOID", sale.sale_number);
        await Store.update("sales", id, { status: "VOID" });
      });
      await reload();
      return sale;
    },
    async addExpense(concept, amountCents) {
      needCaja();
      if (Store.mode === "remote") { const ses = openSession(); if (!ses) throw new Error("Abre tu caja primero"); await Store.v2api.addExpense(ses.id, Math.round(amountCents) || 0, String(concept || "").trim() || "Gasto de caja"); await reload(); return { amount_cents: amountCents, note: concept }; }
      const row = { id: nid("exp"), store_id: ui.storeId, category: "Caja", amount_cents: Math.round(amountCents) || 0, note: String(concept || "").trim(), expense_date: localDay(new Date()), created_by: state.user.full_name };
      await Store.insert("expenses", row);
      await reload();
      return row;
    },
  };

  boot();
})();
