// modules/clientes/clientes.service.js · búsqueda paginada y ficha de clientes (sin interfaz).
// Usa las RPC de la BD v13: search_customers(p_q, p_limit, p_offset), get_customer_detail(p_customer_id), list_staff(p_q, p_limit, p_offset).
// Los nombres se pueden cambiar en DL_CONFIG.CLIENTES_RPC = { list, detail, staff }. Si la RPC no existe, se usan las tablas (RLS).
(function () {
  const S = window.Store;
  const PAGE = 30;
  const rpcNames = () => Object.assign({ list: "search_customers", detail: "get_customer_detail", staff: "list_staff" }, (window.DL_CONFIG || {}).CLIENTES_RPC || {});
  const missing = (e) => e && (e.status === 404 || /could not find the function|does not exist|schema cache/i.test(e.message || ""));
  const enc = encodeURIComponent;
  const clean = (q) => String(q || "").replace(/[,()*%\\:"']/g, " ").trim().slice(0, 60);
  const cents = (n) => Math.round(Number(n || 0) * 100);
  const sid = (v) => (v == null || v === "" ? null : String(v));
  const docKind = (d) => (/^\d{11}$/.test(d || "") ? "RUC" : /^\d{8}$/.test(d || "") ? "DNI" : "");
  const norm = (c) => ({ id: sid(c.id), user_id: c.user_id || null, name: c.name || c.full_name || "Cliente", document_type: c.document_type || docKind(c.document_number || c.dni), document_number: c.document_number || c.dni || "",
    phone: c.phone || "", email: c.email || "", address: c.address || "", username: c.username || "", is_wholesale: !!c.is_wholesale, wholesale_mode: c.wholesale_mode || "mayor",
    purchases: Number(c.purchases || 0), spent_cents: c.spent != null ? cents(c.spent) : Number(c.spent_cents || 0), last_purchase_at: c.last_purchase_at || null, account_only: !c.id });

  async function statsFor(ids) {
    if (!ids.length) return {};
    const rows = await S.rest("sales?select=customer_id,total,sold_at,status&status=neq.ANULADA&customer_id=in.(" + ids.join(",") + ")&order=sold_at.desc&limit=5000").catch(() => []);
    const out = {};
    (rows || []).forEach((r) => { const k = String(r.customer_id); const o = out[k] || (out[k] = { purchases: 0, spent_cents: 0, last_purchase_at: null }); o.purchases += 1; o.spent_cents += cents(r.total); if (!o.last_purchase_at || r.sold_at > o.last_purchase_at) o.last_purchase_at = r.sold_at; });
    return out;
  }
  async function list({ q, offset }) {
    offset = Number(offset) || 0; const term = clean(q);
    const rpc = rpcNames().list;
    if (rpc) {
      try {
        const rows = (await S.rpc(rpc, { p_q: term || null, p_limit: PAGE, p_offset: offset })) || [];
        const total = rows.length ? Number(rows[0].total_count || 0) : 0;
        return { total, rows: rows.map((r) => norm({ id: r.customer_id, user_id: r.user_id, name: r.full_name, username: r.username, dni: r.dni, phone: r.phone, email: r.email, is_wholesale: r.is_wholesale, wholesale_mode: r.wholesale_mode,
          purchases: r.sales_count, spent: r.sales_total, orders_count: r.orders_count, last_purchase_at: r.last_purchase_at })).map((x, i) => Object.assign(x, { orders_count: Number(rows[i].orders_count || 0) })), more: offset + rows.length < total };
      } catch (e) { if (!missing(e)) throw e; }
    }
    const like = (cols) => (term ? "&or=(" + cols.map((c) => c + ".ilike.*" + enc(term) + "*").join(",") + ")" : "");
    const [custs, profs] = await Promise.all([
      S.rest("customers?select=id,user_id,name,document_type,document_number,phone,email,address,is_wholesale,wholesale_mode&order=name&limit=" + (PAGE + 1) + "&offset=" + offset + like(["name", "document_number", "phone", "email"])),
      S.rest("profiles?select=id,full_name,username,phone,dni,email&order=full_name&limit=" + (PAGE + 1) + "&offset=" + offset + like(["full_name", "username", "phone", "dni", "email"])).catch(() => []),
    ]);
    const cs = (custs || []).slice(0, PAGE);
    // cuentas web (rol CLIENTE) que aún no tienen ficha de cliente
    let accounts = [];
    const pids = (profs || []).slice(0, PAGE).map((p) => p.id).filter((id) => !cs.some((c) => c.user_id === id));
    if (pids.length) {
      const roles = await S.rest("user_roles?select=user_id,roles(code)&user_id=in.(" + pids.join(",") + ")").catch(() => []);
      const by = {}; (roles || []).forEach((r) => { (by[r.user_id] = by[r.user_id] || []).push(r.roles && r.roles.code); });
      const linked = new Set(term ? [] : []);
      accounts = (profs || []).filter((p) => pids.includes(p.id) && !linked.has(p.id) && (by[p.id] || []).length && by[p.id].every((c) => c === "CLIENTE"))
        .map((p) => Object.assign(norm(Object.assign({}, p, { id: null })), { user_id: p.id, account_only: true }));
    }
    // fichas cuyo usuario está en la página: agregar el usuario (@)
    const uname = {}; (profs || []).forEach((p) => { uname[p.id] = p.username; });
    const st = await statsFor(cs.map((c) => c.id));
    const rows = cs.map((c) => Object.assign(norm(c), st[String(c.id)] || {}, { username: uname[c.user_id] || "" }));
    return { rows: rows.concat(accounts), more: (custs || []).length > PAGE || (profs || []).length > PAGE };
  }
  async function detail(row) {
    const rpc = rpcNames().detail;
    if (rpc && row.id) {
      try {
        const d = (await S.rpc(rpc, { p_customer_id: Number(row.id) })) || {};
        const c = d.customer || {}; const p = d.profile || {}; const t = d.totals || {};
        const sc = Number(t.sales_count || 0), tot = cents(t.sales_total);
        return {
          customer: Object.assign(norm(c), { username: p.username || row.username || "", email: c.email || p.email || "" }),
          stats: { purchases: sc, spent_cents: tot, last_purchase_at: t.last_purchase_at || null, avg_cents: sc ? Math.round(tot / sc) : 0, orders_count: Number(t.orders_count || 0) },
          special_prices: Number(d.special_prices_count || 0),
          sales: (d.sales || []).map((x) => ({ id: sid(x.sale_id), number: x.receipt || "SEP-" + x.sale_id, status: x.status, sold_at: x.sold_at, total_cents: cents(x.total), store_name: x.store_name || "", by_dni: x.linked_by === "dni" })),
          orders: (d.orders || []).map((o) => ({ id: sid(o.id), code: o.code, status: o.status, total_cents: cents(o.total), created_at: o.created_at, store_name: o.store_name || "" })),
        };
      } catch (e) { if (!missing(e)) throw e; }
    }
    const cid = row.id; const uid = row.user_id;
    const [cust, sales, orders] = await Promise.all([
      cid ? S.rest("customers?select=*&id=eq." + cid).then((r) => (r || [])[0] || null) : Promise.resolve(null),
      cid ? S.rest("sales?select=id,store_id,status,sold_at,total,amount_paid&customer_id=eq." + cid + "&order=sold_at.desc&limit=200").catch(() => []) : Promise.resolve([]),
      S.rest("orders?select=id,code,status,total,created_at,store_id&order=created_at.desc&limit=100&or=(" + [cid ? "customer_id.eq." + cid : "", uid ? "user_id.eq." + uid : ""].filter(Boolean).join(",") + ")").catch(() => []),
    ]);
    const ids = (sales || []).map((s) => s.id);
    const inv = ids.length ? await S.rest("invoices?select=sale_id,series,number,document_type&sale_id=in.(" + ids.join(",") + ")").catch(() => []) : [];
    const invBy = {}; (inv || []).forEach((i) => { invBy[i.sale_id] = i; });
    const ok = (sales || []).filter((s) => s.status !== "ANULADA");
    const spent = ok.reduce((n, s) => n + cents(s.total), 0);
    return {
      customer: cust ? norm(cust) : row,
      stats: { purchases: ok.length, spent_cents: spent, last_purchase_at: ok[0] ? ok[0].sold_at : null, avg_cents: ok.length ? Math.round(spent / ok.length) : 0 },
      sales: (sales || []).map((s) => { const i = invBy[s.id]; return { id: sid(s.id), number: i ? i.series + "-" + String(i.number).padStart(8, "0") : "SEP-" + s.id, doc_type: i ? i.document_type : "SEPARADO", status: s.status, sold_at: s.sold_at, total_cents: cents(s.total), store_id: sid(s.store_id) }; }),
      orders: (orders || []).map((o) => ({ id: sid(o.id), code: o.code, status: o.status, total_cents: cents(o.total), created_at: o.created_at })),
    };
  }
  async function save(id, patch) {
    const body = {}; ["name", "document_type", "document_number", "phone", "email", "address"].forEach((k) => { if (patch[k] !== undefined) body[k] = patch[k] === "" ? null : patch[k]; });
    await S.rest("customers?id=eq." + Number(id), { method: "PATCH", body, prefer: "return=minimal" });
  }
  async function linkAccount(userId, data) {
    // crea (o encuentra) la ficha por DNI/RUC y la enlaza a la cuenta web
    const id = await S.v2api.ensureCustomer({ name: data.name, doc: data.document_number, phone: data.phone });
    await S.rest("customers?id=eq." + Number(id), { method: "PATCH", body: { user_id: userId }, prefer: "return=minimal" });
    return id;
  }
  async function staff(q, offset) {
    const rows = (await S.rpc(rpcNames().staff, { p_q: clean(q) || null, p_limit: 100, p_offset: Number(offset) || 0 })) || [];
    return rows.map((r) => ({ id: r.user_id, full_name: r.full_name || r.email, username: r.username || "", email: r.email || "", phone: r.phone || "", roles: r.roles || [], is_active: r.is_active !== false,
      sales_count: Number(r.sales_count || 0), sales_cents: cents(r.sales_total), stores: (r.stores || []).map(String), created_at: r.created_at, total: Number(r.total_count || 0) }));
  }
  S.v2api.clientes = { PAGE, list, detail, save, linkAccount, staff };
})();
