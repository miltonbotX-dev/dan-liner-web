// core/data.js · carga y mapeo de datos de Supabase (tablas/vistas → modelo de la app). Las operaciones por módulo están en modules/*/…service.js.
(function () {
  const S = window.Store;
  const cents = (n) => Math.round(Number(n || 0) * 100);
  const soles = (c) => Math.round(Number(c || 0)) / 100;
  const sid = (v) => (v === null || v === undefined || v === "" ? null : String(v));
  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  const PAY_TO_DB = { CASH: "EFECTIVO", CARD: "TARJETA", YAPE: "YAPE", PLIN: "PLIN", TRANSFER: "TRANSFERENCIA" };
  const PAY_FROM_DB = { EFECTIVO: "CASH", TARJETA: "CARD", YAPE: "YAPE", PLIN: "PLIN", TRANSFERENCIA: "TRANSFER" };
  const SALE_STATUS = { COMPLETADA: "COMPLETED", ANULADA: "VOID", SEPARADO: "SEPARADO" };
  const ROLE_ORDER = ["ADMIN", "SUPERVISOR", "CAJERO", "VENDEDOR", "ALMACENERO", "CLIENTE"];
  const RPC_ONLY = new Set(["sales", "sale_items", "payments", "invoices", "stock_levels", "stock_movements", "cash_sessions", "transfers", "layaways",
    "consignments", "production_receipts", "expenses"]);
  const BUCKET_PROOFS = "payment-proofs";
  const NOT_IN_V2 = new Set(["partners", "partner_moves", "fabric_suppliers", "fabric_lots", "work_orders",
    "work_receipts", "workshop_pieces", "suit_sets", "store_orders"]);

  const R = { raw: {}, mapped: {}, loading: null, config: {} };
  S.v2 = R;

  async function get(path) {
    try { const rows = await S.rest(path); return Array.isArray(rows) ? rows : []; }
    catch (err) {
      if (err.status === 401 || err.status === 403) return [];
      if (err.status === 404 || /schema cache|does not exist|relation/i.test(err.message)) {
        throw new Error("El servicio no está disponible. Intenta de nuevo más tarde.");
      }
      throw err;
    }
  }
  S.rpc = function (fn, args) { return S.rest("rpc/" + fn, { method: "POST", body: args || {} }); };

  // Colección: ajustes del inicio
  const SF_KEYS = {
    home_hero_image: ["hero_image_url"], home_kicker: ["hero_kicker"], home_title: ["hero_title"], home_shade: ["hero_shade"], home_cols: ["mobile_cols"], home_category_order: ["category_order"],
    home_align: ["hero_align", { left: "izquierda", center: "centro", right: "derecha" }],
    home_theme: ["theme", { dark: "oscuro", light: "claro" }],
    home_hero_style: ["hero_style", { full: "foto_completa", split: "mitad", text: "solo_texto" }],
    // v12 · contacto y redes
    contact_whatsapp: ["whatsapp"], contact_facebook: ["facebook_url"], contact_instagram: ["instagram_url"], contact_tiktok: ["tiktok_url"], contact_email: ["contact_email"], contact_hours: ["opening_hours"],
  };
  function driveShare(url) {
    const v = String(url || "").trim();
    const m = v.match(/\/d\/([\w-]{10,})/) || v.match(/[?&]id=([\w-]{10,})/);
    return v && m ? "https://drive.google.com/file/d/" + m[1] + "/view" : v;
  }
  async function loadStorefront() {
    let rows = [];
    try { rows = await S.rest("storefront_settings?select=key,value"); } catch { return {}; }
    const db = Object.fromEntries((Array.isArray(rows) ? rows : []).map((x) => [x.key, x.value]));
    const out = {};
    Object.entries(SF_KEYS).forEach(([k, [dbKey, map]]) => {
      if (db[dbKey] == null) return;
      out[k] = map ? (Object.keys(map).find((x) => map[x] === db[dbKey]) || "") : db[dbKey];
    });
    if (db.ui_palette) out.ui_palette = db.ui_palette; if (db.ui_season) out.ui_season = db.ui_season; // v32: paleta/adorno (BD v17)
    out._db = db; // v29: claves crudas (v15: razon_social, ruc, terminos, privacidad, envios_info…)
    return out;
  }
  async function saveStorefront(map) {
    for (const [k, v] of Object.entries(map)) {
      const def = SF_KEYS[k]; if (!def) continue;
      const [dbKey, vals] = def;
      let value = vals ? vals[v] : v;
      if (dbKey === "hero_image_url") value = driveShare(value);
      await S.rpc("set_storefront_setting", { p_key: dbKey, p_value: value == null ? "" : String(value) });
    }
  }

  async function loadAll() {
    // Invitados y clientes (rol CLIENTE / sin rol): catálogo público. Las tablas internas (products, categories…) las niega RLS
    // a un cliente y get() convierte esa negación en listas vacías → "No hay piezas". Solo el personal usa la carga completa.
    const staff = !!(S.token && S.user && (S.user.roles || []).some((r) => r && r !== "CLIENTE"));
    if (!staff) {
      const [pub, cfg, notifs] = await Promise.all([loadPublicProducts(), loadStorefront(), S.token ? get("v_my_notifications?select=*&order=created_at.desc&limit=50") : Promise.resolve([])]);
      R.raw = { pub, notifications: notifs }; R.config = {}; R.storefront = cfg; R.mapped = mapPublic(pub);
      R.mapped.notifications = notifs.map((n) => mapNotif(n, () => ""));
      return;
    }
    const q = {
      app_config: "app_config?select=key,value",
      stores: "stores?select=*&order=id", warehouses: "warehouses?select=*&order=id",
      categories: "categories?select=*&order=sort_order", brands: "brands?select=*", seasons: "seasons?select=*",
      age_groups: "age_groups?select=*", sizes: "sizes?select=*&order=sort_order", colors: "colors?select=*", fabrics: "fabrics?select=*",
      products: "products?select=*", product_images: "product_images?select=*&order=sort_order", store_managers: "store_managers?select=*", variants: "product_variants?select=*", catalog: "v_variant_catalog?select=*",
      stock_levels: "stock_levels?select=*", stock_movements: "stock_movements?select=*&order=created_at.desc&limit=1000",
      customers: "customers?select=*&order=name", profiles: "profiles?select=*", user_roles: "user_roles?select=user_id,roles(code)",
      user_store_access: "user_store_access?select=*", cash_registers: "cash_registers?select=*", cash_sessions: "cash_sessions?select=*&order=opened_at.desc&limit=500",
      sales: "sales?select=*&order=sold_at.desc&limit=2000", sale_items: "sale_items?select=*", payments: "payments?select=*", invoices: "invoices?select=*",
      stock_transfers: "stock_transfers?select=*&order=created_at.desc&limit=300", stock_transfer_items: "stock_transfer_items?select=*",
      document_series: "document_series?select=*", store_summary: "v_store_summary?select=*", store_inventory: "v_store_inventory?select=*", general_report: "v_general_report?select=*&order=day.desc",
      notifications: "v_my_notifications?select=*&order=created_at.desc&limit=100", attendance: "attendance?select=*&order=check_in.desc&limit=1000",
      promotions: "promotions?select=*", promotion_targets: "promotion_targets?select=*", promo_price: "v_variant_promo_price?select=*",
      consignments: "consignments?select=*&order=created_at.desc", consignment_items: "consignment_items?select=*", consignment_balance: "v_consignment_balance?select=*",
      tailors: "tailors?select=*&order=name", fabric_receipts: "fabric_receipts?select=*&order=received_at.desc",
      production_orders: "production_orders?select=*&order=created_at.desc", production_order_sizes: "production_order_sizes?select=*",
      production_receipts: "production_receipts?select=*", production_receipt_items: "production_receipt_items?select=*", production_comparison: "v_production_comparison?select=*",
      cash_expenses: "cash_expenses?select=*", cash_session_counts: "cash_session_counts?select=*", sale_refunds: "sale_refunds?select=*",
    };
    const keys = Object.keys(q);
    const rows = await Promise.all(keys.map((k) => get(q[k])));
    keys.forEach((k, i) => { R.raw[k] = rows[i]; });
    R.config = Object.fromEntries(R.raw.app_config.map((r) => [r.key, r.value]));
    R.storefront = await loadStorefront();
    const biz = ((window.DL_CONFIG = window.DL_CONFIG || {}).BUSINESS = window.DL_CONFIG.BUSINESS || {});
    if (R.config.company_name) biz.name = R.config.company_name;
    biz.ruc = R.config.company_ruc || "";
    biz.address = R.config.company_address || "";
    R.expected = {};
    const mine = R.raw.cash_sessions.filter((c) => c.status === "ABIERTA" && c.opened_by === (S.user && S.user.id));
    await Promise.all(mine.map(async (c) => {
      try { const rows = await S.rpc("cash_session_expected", { p_session_id: c.id }); R.expected[c.id] = Object.fromEntries((rows || []).map((r) => [PAY_FROM_DB[r.method] || r.method, cents(r.expected)])); }
      catch (err) { R.expected[c.id] = null; }
    }));
    R.signed = {};
    const paths = [...new Set(R.raw.payments.map((p) => p.proof_url).filter((u) => u && !/^https?:/i.test(u)))].slice(0, 200);
    if (paths.length) {
      try {
        const res = await S.request("/storage/v1/object/sign/" + BUCKET_PROOFS, { method: "POST", body: { expiresIn: 3600, paths: paths.map((x) => x.replace(BUCKET_PROOFS + "/", "")) } }, true);
        (res || []).forEach((r) => { if (r.signedURL) R.signed[BUCKET_PROOFS + "/" + r.path] = S.cfg.url + "/storage/v1" + r.signedURL; });
      } catch (err) { }
    }
    R.mapped = mapAll(R.raw);
  }

  async function loadPublicProducts() {
    let groups;
    try { groups = await S.rest("v_public_catalog_grouped?select=*"); } catch { return get("v_public_catalog?select=*"); }
    return (groups || []).flatMap((g) => (g.sizes || []).map((z, n) => {
      const own = Array.isArray(z.images) ? z.images : []; const gen = Array.isArray(g.images) ? g.images : [];
      return {
        product_id: g.product_id, group_key: g.group_key, product_name: g.product_name, description: g.description, category: g.category, category_code: g.category_code,
        brand: g.brand, model: g.model, fit: g.fit, fit_label: g.fit_label, composition: g.composition, care_instructions: g.care_instructions, season: g.season, promo_status: g.promo_status, color: g.color, color_hex: g.color_hex, fabric: g.fabric,
        variant_id: z.variant_id, sku: z.sku, size: z.size_code || z.size_label, size_order: n, sale_price: z.price, final_price: z.best_price ?? z.price,
        is_clearance: z.is_clearance, in_stock: z.in_stock, image_url: own[0] || g.cover_image || gen[0] || null, images: own.concat(gen.filter((u) => !own.includes(u))),
      };
    }));
  }
  function mapPublic(rows) {
    const cats = new Map();
    rows.forEach((r) => { if (!cats.has(r.category_code)) cats.set(r.category_code, { id: r.category_code, code: r.category_code, slug: String(r.category_code).toLowerCase(), name: r.category, sort_order: cats.size, is_active: true }); });
    return {
      categories: [...cats.values()],
      products: rows.map((r) => ({ id: sid(r.variant_id), variant_id: sid(r.variant_id), product_id: sid(r.product_id), group_key: r.group_key || null, sku: r.sku, name: r.product_name, description: r.description || "",
        category_id: r.category_code, brand_id: null, brand: r.brand, season: r.season || "", size_label: r.size, size_order: r.size_order == null ? null : Number(r.size_order), color: r.color, color_hex: r.color_hex, fabric: r.fabric,
        sale_price_cents: cents(r.sale_price), offer_price_cents: r.final_price < r.sale_price ? cents(r.final_price) : 0, is_offer: Number(r.final_price) < Number(r.sale_price),
        offer_label: r.is_clearance ? "Remate" : "Oferta", is_clearance: r.is_clearance, image_url: r.image_url || null, images: Array.isArray(r.images) ? r.images : [], stock_total: r.in_stock ? 1 : 0,
        promo_status: r.promo_status, is_active: true, deleted_at: null,
        // ficha técnica (v15 de Elon: se muestran solo si la vista las trae)
        marca: r.brand || r.marca || null, modelo: r.model || r.modelo || null, entalle: r.fit_label || r.fit || r.entalle || null, composicion: r.composition || r.composicion || null, cuidados: r.care_instructions || r.cuidados || null, fit: r.fit || null })),
    };
  }

  const mapNotif = (n, pname) => { const m = /^\/traslados\/(\d+)/.exec(n.link || ""); return { id: sid(n.id), store_id: sid(n.store_id), user_id: n.user_id, kind: n.kind, title: n.title, body: n.body || "", link: n.link, ref_table: m ? "transfers" : null, ref_id: m ? m[1] : null, read_by: n.is_read && S.user ? [S.user.id] : [], created_by: pname(n.created_by), created_at: n.created_at }; };
  function byKey(list, key) { const m = new Map(); (list || []).forEach((r) => m.set(String(r[key]), r)); return m; }
  function group(list, key) { const m = new Map(); (list || []).forEach((r) => { const k = String(r[key]); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; }

  function offerOf(v) {
    const row = (R.raw.promo_price || []).find((x) => String(x.variant_id) === String(v.id)) || {};
    const sale = Number(v.sale_price); const best = row.best_price == null ? sale : Number(row.best_price);
    const offer = v.offer_price == null ? null : Number(v.offer_price);
    const promo = row.promo_price == null ? null : Number(row.promo_price);
    const is = best < sale;
    const label = !is ? "" : (promo !== null && promo === best && (offer === null || promo < offer)) ? (row.promotion_name || "Promoción") : (v.is_clearance ? "Remate" : "Oferta");
    return { offer_price_cents: is ? cents(best) : (offer === null ? 0 : cents(offer)), is_offer: is, offer_label: label, is_clearance: Boolean(v.is_clearance), db_offer_price_cents: offer === null ? 0 : cents(offer) };
  }

  function mapAll(raw) {
    const out = {};
    const profiles = byKey(raw.profiles, "id");
    const pname = (id) => (profiles.get(String(id)) || {}).full_name || "";
    const access = group(raw.user_store_access, "user_id");
    const rolesBy = group(raw.user_roles, "user_id");
    out.staff = raw.profiles.map((p) => {
      const roles = (rolesBy.get(String(p.id)) || []).map((r) => r.roles && r.roles.code).filter(Boolean)
        .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
      const stores = (access.get(String(p.id)) || []).map((a) => String(a.store_id));
      return { id: p.id, email: p.email, full_name: p.full_name || p.email, dni: p.dni, phone: p.phone, role: roles.filter((r) => r !== "CLIENTE")[0] || "PENDIENTE", roles, store_id: stores[0] || null, stores, is_active: p.is_active, created_at: p.created_at };
    });
    const mgrs = group(raw.store_managers, "store_id");
    out.stores = raw.stores.map((s) => { const ids = (mgrs.get(String(s.id)) || []).map((m) => m.user_id); return { id: sid(s.id), code: s.code, is_main: Boolean(s.is_main), name: s.name, address: s.address, phone: s.phone, lat: s.lat == null ? "" : String(Number(s.lat)), lng: s.lng == null ? "" : String(Number(s.lng)), is_active: s.is_active, manager_id: ids[0] || null, manager_ids: ids }; });
    out.warehouses = raw.warehouses.map((w) => ({ id: sid(w.id), address: w.address || "", phone: w.phone || "", manager_id: w.manager_id || null, store_id: sid(w.store_id), code: w.code, name: w.name, kind: w.kind, is_default: w.is_default, is_active: w.is_active }))
      .sort((a, b) => Number(b.is_default) - Number(a.is_default));
    out.categories = raw.categories.map((c) => ({ id: sid(c.id), code: c.code, slug: String(c.code || "").toLowerCase(), name: c.name, sort_order: c.sort_order, is_active: c.is_active }));
    out.brands = raw.brands.map((b) => ({ id: sid(b.id), name: b.name, is_active: b.is_active }));
    out.sizes = raw.sizes.map((s) => ({ id: sid(s.id), label: s.code, name: s.code, kind: s.size_group || "OTRO", size_group: s.size_group || "OTRO", sort_order: s.sort_order, is_active: s.is_active }));
    out.colors = raw.colors.map((c) => ({ id: sid(c.id), code: c.code, name: c.name, hex: c.hex, is_active: c.is_active }));
    out.fabrics = raw.fabrics.map((f) => ({ id: sid(f.id), code: f.code, name: f.name, is_active: f.is_active }));
    out.age_groups = raw.age_groups.map((a) => ({ id: sid(a.id), code: a.code, name: a.name }));
    out.seasons = raw.seasons.map((s) => ({ id: sid(s.id), name: s.name, is_active: s.is_active }));

    const cat = byKey(raw.catalog, "variant_id"); const prods = byKey(raw.products, "id");
    const sizes = byKey(raw.sizes, "id"), colors = byKey(raw.colors, "id"), fabrics = byKey(raw.fabrics, "id");
    const imgs = group((raw.product_images || []).slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || Number(a.sort_order || 0) - Number(b.sort_order || 0)), "product_id");
    const varImgs = (v) => { const all = imgs.get(String(v.product_id)) || []; return all.filter((x) => String(x.variant_id) === String(v.id)).concat(all.filter((x) => x.variant_id == null)).map((x) => x.url); };
    out.products = raw.variants.map((v) => {
      const p = prods.get(String(v.product_id)) || {}; const c = cat.get(String(v.id)) || {};
      const size = sizes.get(String(v.size_id)) || {}, color = colors.get(String(v.color_id)) || {}, fabric = fabrics.get(String(v.fabric_id)) || {};
      const active = v.is_active !== false && p.is_active !== false;
      return {
        id: sid(v.id), variant_id: sid(v.id), product_id: sid(v.product_id), group_key: v.product_id + "-" + v.color_id + "-" + v.fabric_id, sku: v.sku, barcode: v.barcode, name: p.name || c.product_name || v.sku, description: p.description || "",
        category_id: sid(p.category_id), brand_id: sid(p.brand_id), season_id: sid(p.season_id), season: c.season || "", age_group_id: sid(p.age_group_id),
        size_id: sid(v.size_id), size_label: size.code || c.size || "", color_id: sid(v.color_id), color: color.name || c.color || "", color_hex: color.hex || null,
        fabric_id: sid(v.fabric_id), fabric: fabric.name || c.fabric || "",
        sale_price_cents: cents(v.sale_price), cost_price_cents: cents(v.cost_price), min_price_cents: cents(v.min_price), wholesale_price_cents: v.wholesale_price == null ? 0 : cents(v.wholesale_price),
        min_stock: Number(v.min_stock || 0), image_url: varImgs(v)[0] || c.image_url || null, images: varImgs(v), own_images: (imgs.get(String(v.product_id)) || []).filter((x) => String(x.variant_id) === String(v.id)).map((x) => x.url), general_images: (imgs.get(String(v.product_id)) || []).filter((x) => x.variant_id == null).map((x) => x.url), hide_below_stock: p.hide_below_stock == null ? null : Number(p.hide_below_stock), promo_status: p.promo_status || "NORMAL", is_offer: p.promo_status === "OFERTA" || p.promo_status === "REMATE",
        show_in_catalog: p.show_in_catalog !== false, is_active: active && p.show_in_catalog !== false, deleted_at: active ? null : (v.updated_at || p.updated_at || "archivado"),
        stock_total: Number(c.total_stock || 0),
        ...offerOf(v),
      };
    });
    out.stock_levels = raw.stock_levels.map((l) => ({ id: l.warehouse_id + ":" + l.variant_id, product_id: sid(l.variant_id), warehouse_id: sid(l.warehouse_id), quantity_on_hand: Number(l.quantity_on_hand), quantity_reserved: Number(l.quantity_reserved || 0) }));
    const NEG = new Set(["SALIDA", "AJUSTE_NEG", "TRASLADO_SALIDA", "VENTA"]);
    out.stock_movements = raw.stock_movements.map((m) => ({ id: sid(m.id), warehouse_id: sid(m.warehouse_id), product_id: sid(m.variant_id), movement_type: m.movement_type, quantity: (NEG.has(m.movement_type) ? -1 : 1) * Number(m.quantity), balance_after: Number(m.balance_after), note: m.notes || (m.reference_type ? m.reference_type + " " + (m.reference_id || "") : ""), created_by: pname(m.created_by), created_at: m.created_at }));
    out.customers = raw.customers.map((c) => ({ id: sid(c.id), name: c.name, document_type: c.document_type, doc: c.document_number, document_number: c.document_number, phone: c.phone, email: c.email, address: c.address, note: [c.document_type, c.document_number].filter(Boolean).join(" "), is_active: true, is_wholesale: !!c.is_wholesale, wholesale_mode: c.wholesale_mode || "mayor" }));

    const regs = byKey(raw.cash_registers, "id");
    const sizesById = byKey(raw.sizes, "id"); const colorsById = byKey(raw.colors, "id");
    out.document_series = (raw.document_series || []).map((d) => ({ id: sid(d.id), store_id: sid(d.store_id), document_type: d.document_type, series: d.series, last_number: d.last_number, is_active: d.is_active }));
    out.cash_registers = raw.cash_registers.map((r) => ({ id: sid(r.id), store_id: sid(r.store_id), name: r.name, is_active: r.is_active }));
    const counts = group(raw.cash_session_counts, "cash_session_id"); const expBy = group(raw.cash_expenses, "cash_session_id");
    out.expenses = raw.cash_expenses.map((e) => ({ id: sid(e.id), session_id: sid(e.cash_session_id), store_id: sid((regs.get(String((raw.cash_sessions.find((c) => c.id === e.cash_session_id) || {}).cash_register_id)) || {}).store_id), category: "Caja", amount_cents: cents(e.amount), note: e.concept, expense_date: String(e.created_at).slice(0, 10), created_by: pname(e.created_by) }));
    out.cash_sessions = raw.cash_sessions.map((s) => {
      const cs = counts.get(String(s.id)) || [];
      const extra = cs.length ? { counted: Object.fromEntries(cs.map((c) => [PAY_FROM_DB[c.method] || c.method, cents(c.counted)])), expected: Object.fromEntries(cs.map((c) => [PAY_FROM_DB[c.method] || c.method, cents(c.expected)])), difference_cents: cs.reduce((n, c) => n + cents(c.difference), 0) } : {};
      if (s.status === "ABIERTA" && R.expected && R.expected[s.id]) extra.expected = R.expected[s.id];
      extra.gastos_cents = (expBy.get(String(s.id)) || []).reduce((n, e) => n + cents(e.amount), 0);
      return { id: sid(s.id), register_id: sid(s.cash_register_id), store_id: sid((regs.get(String(s.cash_register_id)) || {}).store_id), user_id: s.opened_by,
        opening_cents: cents(s.opening_amount), closing_cents: s.counted_cash == null ? null : cents(s.counted_cash), expected_cash_cents: s.expected_cash == null ? null : cents(s.expected_cash),
        difference_cents: extra.difference_cents != null ? extra.difference_cents : (s.difference == null ? null : cents(s.difference)), counted_json: extra.counted || null, expected_json: extra.expected || null,
        float_left_cents: s.float_left == null ? null : cents(s.float_left), gastos_cents: extra.gastos_cents, note: s.notes,
        status: s.status === "ABIERTA" ? "OPEN" : "CLOSED", db_status: s.status, approved_by: s.approved_by, closed_by: s.closed_by, opened_at: s.opened_at, closed_at: s.closed_at };
    });

    const items = group(raw.sale_items, "sale_id"), pays = group(raw.payments, "sale_id"), invs = group(raw.invoices, "sale_id"), refunds = group(raw.sale_refunds, "sale_id");
    const custs = byKey(raw.customers, "id"); const variants = byKey(out.products, "id");
    out.sale_items = raw.sale_items.map((i) => ({ id: sid(i.id), sale_id: sid(i.sale_id), product_id: sid(i.variant_id), description: i.description, quantity: Number(i.quantity), unit_price_cents: cents(i.unit_price), discount_cents: cents(i.discount_amount), line_total_cents: cents(i.line_total), cost_cents: cents(i.cost_at_sale) }));
    out.sales = []; out.layaways = [];
    raw.sales.forEach((s) => {
      const docs = (invs.get(String(s.id)) || []).sort((a, b) => a.id - b.id);
      const inv = docs.find((d) => d.document_type !== "NOTA_CREDITO"); const nc = docs.find((d) => d.document_type === "NOTA_CREDITO");
      const cust = custs.get(String(s.customer_id)) || {};
      const plist = (pays.get(String(s.id)) || []).sort((a, b) => String(a.paid_at).localeCompare(String(b.paid_at)))
        .map((p) => ({ at: p.paid_at, method: PAY_FROM_DB[p.method] || p.method, cents: cents(p.amount), operation_code: p.operation_code, proof: p.proof_url ? (R.signed[p.proof_url] || (/^https?:/i.test(p.proof_url) ? p.proof_url : null)) : null, session_id: sid(p.cash_session_id), by: pname(p.received_by) }));
      const firstAt = plist[0] ? plist[0].at : s.sold_at;
      const wasLayaway = s.status === "SEPARADO" || /^Separado/i.test(s.notes || "") || (Number(s.amount_paid) > 0 && plist.some((p) => p.at !== firstAt) && (!inv || Date.parse(inv.issued_at) - Date.parse(s.sold_at) > 60e3)) || (s.status === "ANULADA" && !inv && Number(s.amount_paid) < Number(s.total));
      const number = inv ? inv.series + "-" + String(inv.number).padStart(8, "0") : "SEP-" + s.id;
      const sale = {
        id: sid(s.id), sale_number: number, doc_type: inv ? inv.document_type : null, invoice_id: inv ? sid(inv.id) : null, sunat_status: inv ? inv.sunat_status : null,
        credit_note: nc ? nc.series + "-" + String(nc.number).padStart(8, "0") : null,
        store_id: sid(s.store_id), warehouse_id: sid(s.warehouse_id), session_id: sid(s.cash_session_id), customer_id: sid(s.customer_id),
        customer_name: (inv && inv.customer_name) || cust.name || "Varios", customer_doc: (inv && inv.customer_doc) || cust.document_number || null, customer_address: cust.address || null,
        seller_user_id: s.seller_id, seller_name: pname(s.seller_id), status: SALE_STATUS[s.status] || s.status, db_status: s.status,
        subtotal_cents: cents(Number(s.total) + Number(s.discount_amount || 0)), discount_cents: cents(s.discount_amount), total_cents: cents(s.total), tax_cents: cents(s.tax_amount),
        paid_cents: cents(s.amount_paid), balance_cents: cents(Number(s.total) - Number(s.amount_paid)),
        payments: plist, payment_method: plist.length > 1 && new Set(plist.map((p) => p.method)).size > 1 ? "MIXTO" : (plist[0] ? plist[0].method : "CASH"),
        pay_proof: (plist.find((p) => p.proof) || {}).proof || null, note: s.notes, cancel_reason: s.cancel_reason, requested_doc_type: s.requested_document_type,
        refunds: (refunds.get(String(s.id)) || []).map((r) => ({ method: PAY_FROM_DB[r.method] || r.method, cents: cents(r.amount), session_id: sid(r.cash_session_id), at: r.refunded_at })),
        sold_at: s.sold_at, layaway_id: wasLayaway ? "lay-" + s.id : null,
      };
      out.sales.push(sale);
      if (wasLayaway) {
        const its = (items.get(String(s.id)) || []).map((i) => { const v = variants.get(String(i.variant_id)) || {}; return { product_id: sid(i.variant_id), name: v.name || i.description, size: v.size_label || "", color: v.color || "", qty: Number(i.quantity), unit_cents: cents(i.unit_price) }; });
        out.layaways.push({ id: "lay-" + s.id, sale_id: sid(s.id), number: "SEP-" + s.id, customer_name: cust.name || "Varios", customer_doc: cust.document_number || "", customer_phone: cust.phone || "",
          store_id: sid(s.store_id), warehouse_id: sid(s.warehouse_id), items: its, total_cents: cents(s.total), payments: plist, doc_type: s.requested_document_type,
          status: s.status === "SEPARADO" ? "ACTIVO" : s.status === "ANULADA" ? "CANCELADO" : "COMPLETADO", boleta_number: inv ? number : null, note: s.notes || "", created_by: pname(s.seller_id), created_at: s.sold_at });
      }
    });

    const tItems = group(raw.stock_transfer_items, "transfer_id");
    const TR = { SOLICITADO: "SOLICITADO", EN_TRANSITO: "ENVIADO", RECIBIDO: "RECIBIDO", RECHAZADO: "CANCELADO", ANULADO: "CANCELADO" };
    out.transfers = raw.stock_transfers.map((t) => { const its = tItems.get(String(t.id)) || []; return {
      id: sid(t.id), number: "TR-" + t.id, product_id: its[0] ? sid(its[0].variant_id) : null, qty: its.reduce((n, i) => n + Number(i.quantity), 0), items: its.map((i) => ({ product_id: sid(i.variant_id), qty: Number(i.quantity) })),
      from_warehouse_id: sid(t.from_warehouse_id), to_warehouse_id: sid(t.to_warehouse_id), status: TR[t.status] || t.status, db_status: t.status, requested_by: pname(t.requested_by || t.sent_by), note: t.request_message || t.notes || "",
      created_at: t.requested_at || t.created_at, sent_at: t.sent_at || (t.status === "SOLICITADO" ? null : t.created_at), received_at: t.received_at,
      is_quick: Boolean(t.is_quick), carried_by_id: t.carried_by || null, carried_by: t.carried_by ? pname(t.carried_by) : "", flagged_at: t.flagged_at || null, flagged_by: t.flagged_by ? pname(t.flagged_by) : "", flag_reason: t.flag_reason || "" }; });

    out.notifications = raw.notifications.map((n) => mapNotif(n, pname));
    // Asistencia
    out.attendance = raw.attendance.map((a) => ({ id: sid(a.id), staff_id: a.user_id, store_id: sid(a.store_id), check_in: a.check_in, check_out: a.check_out, is_late: a.is_late, note: a.note }));
    const tg = group(raw.promotion_targets, "promotion_id");
    out.promos = raw.promotions.map((x) => { const t = (tg.get(String(x.id)) || [])[0] || {}; return { id: sid(x.id), name: x.name, percent: x.discount_type === "PORCENTAJE" ? Number(x.discount_value) : 0, amount_cents: x.discount_type === "MONTO" ? cents(x.discount_value) : 0, discount_type: x.discount_type, category_id: sid(t.category_id), product_id: sid(t.product_id), variant_id: sid(t.variant_id), starts_at: x.starts_at, ends_at: x.ends_at, is_active: x.is_active }; });
    const citems = group(raw.consignment_items, "consignment_id"); const cbal = byKey(raw.consignment_balance, "consignment_id");
    out.consignments = raw.consignments.map((c) => { const its = citems.get(String(c.id)) || []; const i = its[0] || {}; const b = cbal.get(String(c.id)) || {}; return {
      id: sid(c.id), number: "CS-" + c.id, direction: c.direction === "ENTRADA" ? "RECIBIDO" : "PRESTADO", counterpart: c.partner_name, partner_doc: c.partner_doc, product_id: sid(i.variant_id),
      items: its.map((x) => ({ product_id: sid(x.variant_id), qty: Number(x.quantity), sold_qty: Number(x.sold_qty), returned_qty: Number(x.returned_qty), unit_cost_cents: cents(x.agreed_cost) })),
      qty: its.reduce((n, x) => n + Number(x.quantity), 0), sold_qty: its.reduce((n, x) => n + Number(x.sold_qty), 0), returned_qty: its.reduce((n, x) => n + Number(x.returned_qty), 0),
      unit_cost_cents: cents(i.agreed_cost), paid_cents: cents(b.amount_paid), balance_cents: cents(b.balance), status: c.status === "ABIERTA" ? "ABIERTA" : c.status === "LIQUIDADA" ? "CERRADA" : c.status,
      warehouse_id: sid(c.warehouse_id), note: c.notes || "", due_date: c.due_date, created_at: c.created_at }; });
    // Producción
    out.tailors = raw.tailors.map((t) => ({ id: sid(t.id), name: t.name, dni: t.dni, phone: t.phone, specialty: t.specialty, is_active: t.is_active }));
    out.fabric_receipts = raw.fabric_receipts.map((r) => ({ id: sid(r.id), guia: r.guide_number, supplier: r.supplier, fabric_id: sid(r.fabric_id), color_id: sid(r.color_id), color: (colorsById.get(String(r.color_id)) || {}).name || "",
      meters_declared_cm: Math.round(Number(r.meters_guide) * 100), meters_measured_cm: Math.round(Number(r.meters_measured || 0) * 100), verified: r.meters_measured != null, note: r.notes, received_at: r.received_at }));
    const osz = group(raw.production_order_sizes, "order_id"); const prodRows = byKey(raw.products, "id");
    const PST = { PENDIENTE: "EN_TALLER", EN_PROCESO: "EN_TALLER", PARCIAL: "PARCIAL", COMPLETADA: "RECIBIDA", ANULADA: "CANCELADA" };
    out.production_orders = raw.production_orders.map((o) => { const p = prodRows.get(String(o.product_id)) || {}; return {
      id: sid(o.id), number: "OP-" + o.id, product_id: sid(o.product_id), product_name: p.name || "", category_id: sid(p.category_id), brand_id: sid(p.brand_id), fabric_id: sid(o.fabric_id),
      color_id: sid(o.color_id), color: (colorsById.get(String(o.color_id)) || {}).name || "", pieces: "", tailor_id: sid(o.tailor_id), warehouse_id: sid(o.warehouse_id),
      sizes: Object.fromEntries((osz.get(String(o.id)) || []).map((x) => [(sizesById.get(String(x.size_id)) || {}).code, Number(x.qty_ordered)])),
      unit_price_cents: cents(o.labor_cost_per_unit), status: PST[o.status] || o.status, db_status: o.status, note: o.notes || "", created_at: o.created_at }; });
    const rItems = group(raw.production_receipt_items, "receipt_id");
    out.production_receipts = raw.production_receipts.map((r) => { const its = rItems.get(String(r.id)) || []; const counts = {}; its.forEach((x) => { const k = (sizesById.get(String(x.size_id)) || {}).code; counts[k] = (counts[k] || 0) + Number(x.quantity); });
      return { id: sid(r.id), order_id: sid(r.order_id), counts, color: its[0] ? (colorsById.get(String(its[0].color_id)) || {}).name : "", fabric_id: its[0] ? sid(its[0].fabric_id) : null, received_by: pname(r.received_by), received_at: r.received_at, note: r.notes }; });
    out.production_comparison = raw.production_comparison;
    out.store_summary = (raw.store_summary || []).map((r) => ({ store_id: sid(r.store_id), code: r.store_code, name: r.store_name, is_main: Boolean(r.is_main), sales_today_count: Number(r.sales_today_count || 0), sales_today_cents: cents(r.sales_today_total), open_cash_sessions: Number(r.open_cash_sessions || 0), low_stock_count: Number(r.low_stock_count || 0) }));
    out.store_inventory = (raw.store_inventory || []).map((r) => ({ store_id: sid(r.store_id), store_name: r.store_name, warehouse_id: sid(r.warehouse_id), warehouse_name: r.warehouse_name, kind: r.warehouse_kind, product_id: sid(r.variant_id), sku: r.sku, name: r.product_name, size_label: r.size, size_order: r.size_order, color: r.color, quantity: Number(r.quantity || 0) }));
    out.general_report = (raw.general_report || []).map((r) => ({ store_id: sid(r.store_id), store_name: r.store_name, day: r.day, method: PAY_FROM_DB[r.method] || r.method, amount_cents: cents(r.amount), sales_count: Number(r.sales_count || 0) }));
    return out;
  }

  // lectura
  S.list = async function (table) {
    if (!R.loading) { R.loading = loadAll(); R.loading.finally(() => setTimeout(() => { R.loading = null; }, 0)).catch(() => {}); }
    await R.loading;
    return (R.mapped[table] || []).map((r) => ({ ...r }));
  };

  function guard(table) {
    if (RPC_ONLY.has(table)) throw new Error("Esta operación se hace desde Caja o Stock.");
    if (NOT_IN_V2.has(table)) throw new Error("Este módulo todavía no está disponible.");
  }
  function codeFrom(text, len) { return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, len || 3) || "X"; }
  function docType(doc) { doc = String(doc || "").trim(); if (/^\d{8}$/.test(doc)) return "DNI"; if (/^(10|15|17|20)\d{9}$/.test(doc)) return "RUC"; if (/^\d{9,12}$/.test(doc)) return "CE"; return doc ? "PAS" : null; }
  S.docType = docType;
  function toDb(table, row, isNew) {
    const r = { ...row }; const o = {};
    const pick = (k, v) => { if (v !== undefined) o[k] = v; };
    switch (table) {
      case "customers": {
        const doc = r.doc || r.document_number || r.customer_doc;
        if (isNew && !doc) throw new Error("El cliente necesita DNI, RUC, CE o pasaporte");
        pick("name", r.name); pick("phone", r.phone); pick("email", r.email); pick("address", r.address);
        if (doc) { o.document_number = String(doc).trim(); o.document_type = r.document_type || docType(doc); }
        return o;
      }
      case "categories": pick("name", r.name); pick("sort_order", r.sort_order); pick("is_active", r.is_active); if (isNew || r.slug) o.code = codeFrom(r.slug || r.name, 3); return o;
      case "brands": pick("name", r.name); pick("is_active", r.is_active); return o;
      case "stores": pick("name", r.name); pick("address", r.address); pick("phone", r.phone); pick("is_active", r.is_active); if (isNew) o.code = codeFrom(r.name, 6) + "-" + Date.now().toString(36).slice(-3).toUpperCase(); return o;
      case "cash_registers": pick("name", r.name); pick("is_active", r.is_active); if (r.store_id) o.store_id = num(r.store_id); return o;
      case "document_series": if (r.series !== undefined) o.series = String(r.series || "").trim().toUpperCase(); pick("document_type", r.document_type); pick("is_active", r.is_active); if (r.store_id) o.store_id = num(r.store_id); return o;
      case "warehouses": pick("address", r.address); pick("phone", r.phone); if (r.manager_id !== undefined) o.manager_id = r.manager_id || null; pick("name", r.name); pick("is_active", r.is_active); pick("kind", r.kind); pick("is_default", r.is_default); if (r.store_id) o.store_id = num(r.store_id); if (isNew) o.code = codeFrom(r.name, 6); return o;
      case "tailors": pick("name", r.name); pick("phone", r.phone); pick("dni", r.dni); pick("is_active", r.is_active);
        if (r.specialty !== undefined) { const sp = String(r.specialty || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); o.specialty = ["SACO", "PANTALON", "CHALECO", "CAMISA"].find((x) => sp.includes(x)) || "GENERAL"; }
        return o;
      case "sizes": pick("code", r.label || r.code); pick("sort_order", r.sort_order); pick("is_active", r.is_active); { const g = r.size_group || r.kind; if (g !== undefined) o.size_group = ["NINO", "ADULTO"].includes(g) ? g : "OTRO"; } return o;
      case "colors": case "fabrics": pick("name", r.name); pick("is_active", r.is_active); if (table === "colors") pick("hex", r.hex || null); if (isNew) { const used = new Set((R.mapped[table] || []).map((x) => String(x.code || "").toUpperCase())); let c = r.code || codeFrom(r.name, 3), n = 1; while (used.has(c)) c = codeFrom(r.name, 3).slice(0, 2) + (++n); o.code = c; } return o;
      default: return r;
    }
  }
  const DB_TABLE = { sizes: "sizes", colors: "colors", fabrics: "fabrics", customers: "customers", categories: "categories", brands: "brands", stores: "stores", warehouses: "warehouses", tailors: "tailors", promos: "promotions", cash_registers: "cash_registers", document_series: "document_series" };

  S.insert = async function (table, row) {
    guard(table);
    if (table === "attendance") { await S.rpc("check_in", { p_store_id: num(row.store_id || (S.user && S.user.store_id)), p_note: row.note || null }); return row; }
    if (table === "notifications") return row;
    if (table === "promos") return savePromo(null, row);
    if (table === "fabric_receipts") return saveFabricReceipt(row);
    if (table === "production_orders") return saveProductionOrder(row);
    if (table === "products") return saveVariant(null, row);
    if (table === "staff") throw new Error("Crea el usuario desde Personal > Nuevo usuario");
    const t = DB_TABLE[table]; if (!t) throw new Error("Operación no disponible");
    const rows = await this.rest(t, { method: "POST", body: toDb(table, row, true), prefer: "return=representation" });
    const saved = rows && rows[0];
    if (table === "stores" && saved && row.lat != null && row.lat !== "") await S.rpc("set_store_location", { p_store_id: saved.id, p_lat: Number(row.lat), p_lng: Number(row.lng), p_address: null }); return saved ? Object.assign({}, row, { id: sid(saved.id) }) : row;
  };
  S.update = async function (table, id, patch) {
    guard(table);
    if (table === "products") return saveVariant(id, patch);
    if (table === "staff") return saveStaff(id, patch);
    if (table === "stores" && (patch.lat !== undefined || patch.lng !== undefined)) {
      const was = (R.mapped.stores || []).find((x) => x.id === String(id)) || {};
      const same = String(patch.lat == null ? "" : Number(patch.lat)) === String(was.lat || "") && String(patch.lng == null ? "" : Number(patch.lng)) === String(was.lng || "");
      if (same) { patch = Object.assign({}, patch); delete patch.lat; delete patch.lng; }
    }
    if (table === "stores" && (patch.lat !== undefined || patch.lng !== undefined)) {
      await S.rpc("set_store_location", { p_store_id: num(id), p_lat: patch.lat == null || patch.lat === "" ? null : Number(patch.lat), p_lng: patch.lng == null || patch.lng === "" ? null : Number(patch.lng), p_address: null });
      patch = Object.assign({}, patch); delete patch.lat; delete patch.lng;
    }
    if (table === "stores" && patch.is_main !== undefined) {
      const was = (R.mapped.stores || []).find((x) => x.id === String(id)) || {};
      if (patch.is_main && !was.is_main) await S.rpc("set_main_store", { p_store_id: num(id) });
      if (!patch.is_main && was.is_main) throw new Error("Para quitar la tienda principal, marca otra como principal");
      patch = Object.assign({}, patch); delete patch.is_main;
    }
    if (table === "stores" && (patch.manager_ids !== undefined || patch.manager_id !== undefined)) {
      const ids = Array.isArray(patch.manager_ids) ? patch.manager_ids : (patch.manager_id ? [patch.manager_id] : []);
      await S.rpc("set_store_managers", { p_store_id: num(id), p_user_ids: ids.filter(Boolean) });
      patch = Object.assign({}, patch); delete patch.manager_id; delete patch.manager_ids;
    }
    if (table === "notifications") { await S.rpc("mark_notifications_read", { p_ids: [num(id)] }); return patch; }
    if (table === "attendance") { if (patch.check_out) await S.rpc("check_out", { p_note: patch.note || null }); return patch; }
    if (table === "promos") return savePromo(id, patch);
    if (table === "production_orders") {
      const st = { CANCELADA: "ANULADA", EN_TALLER: "EN_PROCESO" }[patch.status];
      if (!st) throw new Error("La orden se completa al recibir todas las prendas; a mano solo se puede anular.");
      await this.rest("production_orders?id=eq." + encodeURIComponent(id), { method: "PATCH", body: { status: st }, prefer: "return=minimal" }); return patch;
    }
    const t = DB_TABLE[table]; if (!t) throw new Error("Operación no disponible");
    const body = toDb(table, patch, false);
    if (!Object.keys(body).length) return patch;
    await this.rest(t + "?id=eq." + encodeURIComponent(id), { method: "PATCH", body, prefer: "return=minimal" });
    return patch;
  };
  S.remove = async function (table, id) {
    guard(table);
    if (table === "products") return this.rest("product_variants?id=eq." + encodeURIComponent(id), { method: "PATCH", body: { is_active: false }, prefer: "return=minimal" });
    const t = DB_TABLE[table]; if (!t) throw new Error("Operación no disponible");
    return this.rest(t + "?id=eq." + encodeURIComponent(id), { method: "DELETE", prefer: "return=minimal" });
  };

  async function saveVariant(id, d) {
    const old = id ? (R.mapped.products || []).find((p) => p.id === String(id)) : null;
    const v = {};
    if (d.sale_price_cents !== undefined) v.sale_price = soles(d.sale_price_cents);
    if (d.cost_price_cents !== undefined) v.cost_price = soles(d.cost_price_cents);
    if (d.wholesale_price_cents !== undefined) v.wholesale_price = d.wholesale_price_cents ? soles(d.wholesale_price_cents) : null;
    if (d.min_price_cents !== undefined) v.min_price = soles(d.min_price_cents);
    if (d.min_stock !== undefined) v.min_stock = Number(d.min_stock) || 0;
    if (d.sku) v.sku = d.sku;
    if (d.is_offer !== undefined) { v.offer_price = d.is_offer && d.offer_price_cents ? soles(d.offer_price_cents) : null; v.is_clearance = Boolean(d.is_offer); }
    if (v.sale_price !== undefined && v.min_price === undefined && old && old.min_price_cents > d.sale_price_cents) v.min_price = v.sale_price;
    const p = {};
    ["name", "description"].forEach((k) => { if (d[k] !== undefined) p[k] = d[k]; });
    if (d.category_id !== undefined) p.category_id = num(d.category_id);
    if (d.hide_below_stock !== undefined) p.hide_below_stock = d.hide_below_stock === "" || d.hide_below_stock == null ? null : Math.max(0, Number(d.hide_below_stock) || 0);
    if (d.brand_id !== undefined) p.brand_id = num(d.brand_id);
    if (d.deleted_at) { v.is_active = false; }
    else if (d.is_active !== undefined) p.show_in_catalog = Boolean(d.is_active);
    const find = (list, key, val) => (R.mapped[list] || []).find((r) => String(r[key]).toLowerCase() === String(val || "").toLowerCase());
    const sizeId = d.size_id || (d.size_label && (find("sizes", "label", d.size_label) || {}).id);
    if (old) {
      if (Object.keys(p).length) await S.rest("products?id=eq." + old.product_id, { method: "PATCH", body: p, prefer: "return=minimal" });
      if (Object.keys(v).length) await S.rest("product_variants?id=eq." + old.id, { method: "PATCH", body: v, prefer: "return=minimal" });
      if (Array.isArray(d.images)) await saveImages(old.product_id, d.images);
      else if (d.image_url && d.image_url !== old.image_url) await saveImages(old.product_id, [d.image_url].concat((old.images || []).filter((u) => u !== d.image_url)));
      return d;
    }
    const colorId = d.color_id || (d.color && (find("colors", "name", d.color) || {}).id);
    const fabricId = d.fabric_id || (d.fabric && (find("fabrics", "name", d.fabric) || {}).id);
    if (!sizeId || !colorId || !fabricId) throw new Error("Para crear la pieza elige talla, color y tela (listas del catálogo)");
    let productId = d.product_id;
    if (!productId) {
      const age = (R.mapped.age_groups || []).find((a) => a.id === String(d.age_group_id)) || (R.mapped.age_groups || []).find((a) => a.code === "ADU");
      if (!age) throw new Error("Falta la lista de edades");
      const rows = await S.rest("products", { method: "POST", prefer: "return=representation", body: Object.assign({ name: d.name, description: d.description || null, category_id: num(d.category_id), brand_id: num(d.brand_id), age_group_id: num(age.id), show_in_catalog: d.is_active !== false, hide_below_stock: d.hide_below_stock == null || d.hide_below_stock === "" ? null : Number(d.hide_below_stock) }) });
      productId = rows[0].id;
      const list = Array.isArray(d.images) && d.images.length ? d.images : (d.image_url ? [d.image_url] : []);
      if (list.length) await saveImages(productId, list);
    }
    const body = Object.assign({ product_id: num(productId), size_id: num(sizeId), color_id: num(colorId), fabric_id: num(fabricId), sale_price: 0, min_price: 0 }, v);
    if (body.sku && /^DL-/.test(body.sku) === false && d.autoSku) delete body.sku;
    const rows = await S.rest("product_variants", { method: "POST", body, prefer: "return=representation" });
    return Object.assign({}, d, { id: sid(rows[0].id) });
  }

  // Storage
  function dataUrlToBlob(dataUrl) {
    const [head, b64] = String(dataUrl).split(","); const mime = (/data:([^;]+)/.exec(head) || [])[1] || "image/jpeg";
    const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
    return { blob: new Blob([arr], { type: mime }), ext: mime.split("/")[1] || "jpg", mime };
  }
  async function upload(bucket, path, dataUrl) {
    const { blob, mime } = dataUrlToBlob(dataUrl);
    const res = await fetch(S.cfg.url + "/storage/v1/object/" + bucket + "/" + path, { method: "POST", headers: { apikey: S.cfg.key, Authorization: "Bearer " + S.token.access_token, "Content-Type": mime, "x-upsert": "false" }, body: blob });
    if (!res.ok) { const t = await res.json().catch(() => ({})); throw new Error("No se pudo subir la foto: " + (t.message || t.error || res.status)); }
    return path;
  }
  function driveUrl(url) {
    const v = String(url || "").trim();
    const m = /drive\.google\.com|docs\.google\.com|googleusercontent\.com/i.test(v) && (v.match(/\/d\/([\w-]{10,})/) || v.match(/[?&]id=([\w-]{10,})/));
    return m ? "https://lh3.googleusercontent.com/d/" + m[1] : v;
  }
  async function saveImages(productId, urls) {
    const list = [...new Set((urls || []).map(driveUrl).filter((u) => /^https?:\/\//i.test(u)))];
    await S.rest("product_images?product_id=eq." + num(productId) + "&variant_id=is.null", { method: "DELETE", prefer: "return=minimal" });
    if (list.length) await S.rest("product_images", { method: "POST", prefer: "return=minimal", body: list.map((url, i) => ({ product_id: num(productId), url, is_primary: i === 0, sort_order: i })) });
  }
  async function uploadProof(dataUrl) {
    if (!dataUrl || !/^data:/i.test(dataUrl)) return null;
    const { ext } = dataUrlToBlob(dataUrl);
    const path = (S.user ? S.user.id : "anon") + "/" + new Date().toISOString().slice(0, 10) + "/" + Date.now() + "." + ext;
    await upload(BUCKET_PROOFS, path, dataUrl);
    return BUCKET_PROOFS + "/" + path;
  }

  async function savePromo(id, d) {
    const body = {};
    if (d.name !== undefined) body.name = d.name;
    if (d.percent !== undefined) { body.discount_type = "PORCENTAJE"; body.discount_value = Math.max(1, Math.min(100, Number(d.percent) || 0)); }
    if (d.is_active !== undefined) body.is_active = Boolean(d.is_active);
    if (!id) {
      body.starts_at = d.starts_at || new Date().toISOString();
      body.ends_at = d.ends_at || new Date(Date.now() + 30 * 864e5).toISOString();
      const rows = await S.rest("promotions", { method: "POST", body, prefer: "return=representation" });
      const pid = rows[0].id;
      if (d.category_id || d.product_id || d.variant_id) await S.rest("promotion_targets", { method: "POST", prefer: "return=minimal", body: { promotion_id: pid, category_id: d.variant_id || d.product_id ? null : num(d.category_id), product_id: d.variant_id ? null : num(d.product_id), variant_id: num(d.variant_id) } });
      return Object.assign({}, d, { id: sid(pid) });
    }
    if (Object.keys(body).length) await S.rest("promotions?id=eq." + encodeURIComponent(id), { method: "PATCH", body, prefer: "return=minimal" });
    if (d.category_id !== undefined) {
      await S.rest("promotion_targets?promotion_id=eq." + encodeURIComponent(id), { method: "DELETE", prefer: "return=minimal" });
      if (d.category_id) await S.rest("promotion_targets", { method: "POST", prefer: "return=minimal", body: { promotion_id: num(id), category_id: num(d.category_id) } });
    }
    return d;
  }

  function colorIdByName(name) { const c = (R.mapped.colors || []).find((x) => x.name.toLowerCase() === String(name || "").trim().toLowerCase()); return c ? num(c.id) : null; }
  async function saveFabricReceipt(r) {
    const color = r.color_id ? num(r.color_id) : colorIdByName(r.color);
    if (!color) throw new Error("Elige un color de la lista del catálogo (" + (R.mapped.colors || []).map((c) => c.name).join(", ") + ")");
    await S.rest("fabric_receipts", { method: "POST", prefer: "return=minimal", body: { guide_number: r.guia, supplier: r.supplier, fabric_id: num(r.fabric_id), color_id: color,
      meters_guide: (r.meters_declared_cm || 0) / 100, meters_measured: r.meters_measured_cm == null ? null : r.meters_measured_cm / 100, notes: [r.note, r.verified ? "verificada" : ""].filter(Boolean).join(" · ") || null } });
    return r;
  }
  async function saveProductionOrder(o) {
    const prod = (R.mapped.products || []).find((p) => p.name.toLowerCase() === String(o.product_name || "").trim().toLowerCase());
    if (!prod) throw new Error("Primero crea el producto «" + o.product_name + "» en Piezas (la orden se liga a un producto existente)");
    const color = o.color_id ? num(o.color_id) : colorIdByName(o.color);
    if (!color) throw new Error("Color no está en la lista del catálogo");
    if (!o.fabric_id) throw new Error("Elige la tela");
    if (!o.tailor_id) throw new Error("Elige el sastre");
    const wh = num(o.warehouse_id || (window.DL && window.DL.ui && window.DL.ui.warehouseId));
    const rows = await S.rest("production_orders", { method: "POST", prefer: "return=representation", body: { product_id: num(prod.product_id), fabric_id: num(o.fabric_id), color_id: color, tailor_id: num(o.tailor_id), warehouse_id: wh,
      labor_cost_per_unit: o.unit_price_cents ? o.unit_price_cents / 100 : null, status: "EN_PROCESO", notes: [o.pieces, o.note].filter(Boolean).join(" · ") || null } });
    const oid = rows[0].id;
    const sizeRows = Object.entries(o.sizes || {}).filter(([, q]) => Number(q) > 0).map(([label, q]) => { const sz = (R.mapped.sizes || []).find((s) => s.label === label); if (!sz) throw new Error("Talla " + label + " no está en la lista"); return { order_id: oid, size_id: num(sz.id), qty_ordered: Number(q) }; });
    if (sizeRows.length) await S.rest("production_order_sizes", { method: "POST", prefer: "return=minimal", body: sizeRows });
    return Object.assign({}, o, { id: sid(oid) });
  }

  async function saveStaff(id, patch) {
    const cur = (R.mapped.staff || []).find((s) => s.id === id) || { roles: [] };
    const prof = {};
    ["full_name", "phone", "dni"].forEach((k) => { if (patch[k] !== undefined) prof[k] = patch[k]; });
    if (Object.keys(prof).length) await S.rest("profiles?id=eq." + id, { method: "PATCH", body: prof, prefer: "return=minimal" });
    if (patch.is_active !== undefined && patch.is_active !== cur.is_active) await S.rpc("set_user_active", { p_user_id: id, p_active: Boolean(patch.is_active) });
    let want = null;
    if (Array.isArray(patch.roles)) want = patch.roles.slice(); else if (patch.role) want = [patch.role];
    if (want) {
      want = want.filter((r) => r && r !== "PENDIENTE" && ROLE_ORDER.includes(r));
      for (const r of want) if (!cur.roles.includes(r)) await S.rpc("assign_role", { p_user_id: id, p_role_code: r });
      const roleIds = Object.fromEntries(((await get("roles?select=id,code")) || []).map((r) => [r.code, r.id]));
      for (const r of cur.roles) if (!want.includes(r)) await S.rest("user_roles?user_id=eq." + id + "&role_id=eq." + roleIds[r], { method: "DELETE", prefer: "return=minimal" });
    }
    if (patch.store_id !== undefined) {
      const target = sid(patch.store_id);
      for (const s of cur.stores || []) if (s !== target) await S.rest("user_store_access?user_id=eq." + id + "&store_id=eq." + s, { method: "DELETE", prefer: "return=minimal" });
      if (target && !(cur.stores || []).includes(target)) await S.rest("user_store_access", { method: "POST", body: { user_id: id, store_id: num(target), can_sell: true, can_manage_stock: want ? want.includes("ALMACENERO") : false }, prefer: "return=minimal" });
    }
    return patch;
  }

  function dbPayments(list) {
    return (list || []).filter((p) => Number(p.cents) > 0).map((p) => {
      const method = PAY_TO_DB[p.method] || p.method;
      const out = { method, amount: soles(p.cents) };
      if (method !== "EFECTIVO") { if (!p.operation_code) throw new Error("Falta el nro. de operación de " + method); out.operation_code = String(p.operation_code); }
      if (p.proof_url) out.proof_url = p.proof_url;
      return out;
    });
  }
  async function attachProof(payments, proofDataUrl) {
    if (!proofDataUrl) return payments;
    const isQr = (p) => p.method === "YAPE" || p.method === "PLIN";
    if (!payments.some(isQr)) return payments;
    const url = await uploadProof(proofDataUrl);
    return payments.map((p) => (isQr(p) ? Object.assign({}, p, { proof_url: url }) : p));
  }
  S._r = { cents, soles, sid, num, PAY_TO_DB, PAY_FROM_DB, SALE_STATUS, ROLE_ORDER, RPC_ONLY, BUCKET_PROOFS, NOT_IN_V2, R, get, SF_KEYS, driveShare, loadStorefront, saveStorefront, loadAll, loadPublicProducts, mapPublic, mapNotif, byKey, group, offerOf, mapAll, guard, codeFrom, docType, toDb, DB_TABLE, saveVariant, dataUrlToBlob, upload, driveUrl, saveImages, uploadProof, savePromo, colorIdByName, saveFabricReceipt, saveProductionOrder, saveStaff, dbPayments, attachProof };
  S.v2api = {};

  S.hydrateRemoteUser = async function () {
    const authUser = this.token && this.token.user;
    if (!authUser) { this.user = null; return; }
    let prof = null, roles = [], stores = [];
    try {
      const uid = encodeURIComponent(authUser.id);
      const [p, r, a] = await Promise.all([this.rest("profiles?select=*&id=eq." + uid), this.rest("user_roles?select=roles(code)&user_id=eq." + uid), this.rest("user_store_access?select=store_id&user_id=eq." + uid)]);
      prof = (p || [])[0] || null;
      roles = (r || []).map((x) => x.roles && x.roles.code).filter(Boolean);
      stores = (a || []).map((x) => String(x.store_id));
    } catch (err) { this.lastError = err.message; }
    if (prof && (!prof.username || !prof.phone) && this.fixPendingProfile) this.fixPendingProfile(authUser).catch(() => {});
    roles.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
    if (prof && prof.is_active === false) roles = [];
    this.user = { id: authUser.id, email: (prof && prof.email) || authUser.email, full_name: (prof && prof.full_name) || (authUser.user_metadata && authUser.user_metadata.full_name) || authUser.email,
      role: roles.filter((r) => r !== "CLIENTE")[0] || "PENDIENTE", roles, store_id: stores[0] || null, stores, is_active: !prof || prof.is_active !== false };
  };

  S.verifyCredentials = async function (email, password) {
    email = String(email || "").trim().toLowerCase();
        const res = await fetch(this.cfg.url + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: this.cfg.key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const tok = await res.json().catch(() => ({}));
    if (!res.ok || !tok.access_token) throw new Error("Usuario o contraseña incorrectos");
    const h = { apikey: this.cfg.key, Authorization: "Bearer " + tok.access_token };
    const prof = (await (await fetch(this.cfg.url + "/rest/v1/profiles?select=*&id=eq." + tok.user.id, { headers: h })).json().catch(() => []))[0];
    const roles = (await (await fetch(this.cfg.url + "/rest/v1/user_roles?select=roles(code)&user_id=eq." + tok.user.id, { headers: h })).json().catch(() => [])).map((r) => r.roles && r.roles.code).filter(Boolean);
    const can = await (await fetch(this.cfg.url + "/rest/v1/rpc/has_permission", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, h), body: JSON.stringify({ p_code: "cash.approve" }) })).json().catch(() => false);
    fetch(this.cfg.url + "/auth/v1/logout", { method: "POST", headers: h }).catch(() => {});
    if (!prof || prof.is_active === false) throw new Error("Cuenta sin acceso");
    roles.sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
    return { id: prof.id, email: prof.email, full_name: prof.full_name || prof.email, role: roles.filter((r) => r !== "CLIENTE")[0] || "PENDIENTE", roles: can === true && !roles.includes("SUPERVISOR") ? roles.concat(["CUADRE"]) : roles, is_active: true };
  };
})();
