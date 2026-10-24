// core/http.js · cliente Supabase (REST/RPC), errores en español y datos locales. La sesión está en core/session.js.
// Datos
window.DL_TABLES = [
  "stores", "warehouses", "categories", "brands", "products", "stock_levels", "stock_movements",
  "customers", "staff", "promos", "cash_sessions", "sales", "sale_items", "expenses", "partners",
  "partner_moves", "fabric_suppliers", "fabrics", "fabric_lots", "tailors", "work_orders",
  "work_receipts", "workshop_pieces", "suit_sets", "store_orders", "sizes",
  "colors", "age_groups", "seasons", "cash_registers", "document_series",
  "notifications", "attendance", "layaways", "transfers", "consignments", "production_orders", "fabric_receipts", "production_receipts",
  "store_summary", "store_inventory", "general_report",
];

// Tallas por defecto
window.DL_DEFAULT_SIZES = function () {
  const kids = ["4", "6", "8", "10", "12", "14", "16"].map((label, i) => ({ id: "size-k" + label, label, kind: "NINO", size_group: "NINO", sort_order: 10 + i }));
  const adult = ["XS", "S", "M", "L", "XL", "XXL"].map((label, i) => ({ id: "size-" + label.toLowerCase(), label, kind: "ADULTO", size_group: "ADULTO", sort_order: 30 + i }));
  return kids.concat(adult);
};

(function () {
  const TOKEN_KEY = "danliner.sb.token";

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }

  const Store = {
    mode: "remote",
    cfg: null,
    cache: null,
    user: null,
    token: null,
    lastError: "",

    config() {
      return this.cfg;
    },

    async transaction(work) { return work(); },

    async rest(path, opts) {
      return this.request("/rest/v1/" + path, opts || {}, true);
    },

    async request(path, opts, retried) {
      if (!this.cfg) throw new Error("Sin conexión con el servidor");
      const headers = {
        apikey: this.cfg.key,
        Authorization: "Bearer " + ((this.token && this.token.access_token) || this.cfg.key),
        "Content-Type": "application/json",
      };
      if (opts.prefer) headers.Prefer = opts.prefer;
      const res = await fetch(this.cfg.url + path, {
        method: opts.method || "GET",
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      if (res.status === 401 && !retried && this.token && this.token.refresh_token) {
        const ok = await this.refresh();
        if (ok) return this.request(path, opts, true);
      }
      const text = await res.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
      if (!res.ok) {
        const message = (payload && (payload.message || payload.msg || payload.error_description || payload.error)) || ("Error " + res.status);
        const error = new Error(translate(message));
        error.status = res.status;
        throw error;
      }
      return payload;
    },

    async list(table) {
      try {
        const rows = await this.rest(table + "?select=*");
        return Array.isArray(rows) ? rows : [];
      } catch (err) {
        if (err.status === 401 || err.status === 403) return [];
        this.lastError = err.message;
        throw err;
      }
    },

    async insert(table, row) {
      const rows = await this.rest(table, { method: "POST", body: strip(row), prefer: "return=representation" });
      return (rows && rows[0]) || row;
    },

    async update(table, id, patch) {
      const rows = await this.rest(table + "?id=eq." + encodeURIComponent(id), { method: "PATCH", body: strip(patch), prefer: "return=representation" });
      return (rows && rows[0]) || patch;
    },

    async remove(table, id) {
      await this.rest(table + "?id=eq." + encodeURIComponent(id), { method: "DELETE", prefer: "return=minimal" });
    },

  };
  function publicUser(row) {
    return { id: row.id, email: row.email, full_name: row.full_name, role: row.role, roles: Array.isArray(row.roles) ? row.roles : (row.role ? [row.role] : []), store_id: row.store_id || null, is_active: row.is_active !== false };
  }

  function strip(row) {
    const copy = { ...row };
    delete copy.password_hash;
    delete copy.stock_total;
    return copy;
  }

  function translate(message) {
    const text = String(message || "");
    const serie = text.match(/No hay serie activa de (\w+)/i);
    if (serie) { const t = { BOLETA: "boleta", FACTURA: "factura", TICKET: "nota de venta", NOTA_CREDITO: "nota de crédito" }[serie[1].toUpperCase()] || "ese comprobante"; return `Esta tienda no tiene serie de ${t}. Pídele al administrador que la registre en Administración → Series.`; }
    if (/email rate limit|over_email_send_rate_limit/i.test(text)) return "Se alcanzó el límite de correos de confirmación por ahora. Intenta de nuevo en una hora o pide ayuda a la tienda.";
    if (/rate limit|only request this after|security purposes/i.test(text)) return "Espera un minuto antes de volver a intentarlo.";
    if (/signups not allowed|signup.*disabled/i.test(text)) return "El registro está desactivado por ahora. Pide ayuda a la tienda.";
    if (/database error saving new user/i.test(text)) return "No se pudo crear la cuenta. Revisa tu celular (9 dígitos) y DNI (8 dígitos), o que el usuario no esté en uso.";
    if (/email not confirmed/i.test(text)) return "Aún no confirmas tu correo. Abre el enlace que te enviamos (revisa spam).";
    if (/invalid.*email|email address.*invalid/i.test(text)) return "Ese correo no es válido.";
    if (/same.*password|different from the old/i.test(text)) return "La nueva contraseña debe ser distinta a la anterior.";
    if (/invalid login/i.test(text)) return "Correo o contraseña incorrectos";
    if (/already registered|already been registered/i.test(text)) return "Ese correo ya está registrado";
    if (/password/i.test(text) && /least|short|weak/i.test(text)) return "La contraseña necesita 8 caracteres";
    // v34: no mostrar detalles internos del servidor
    if (/permission denied for (function|table|relation|sequence|schema)/i.test(text)) return "No se pudo completar por un permiso del servidor. Avisa al administrador.";
    if (/jwt expired|invalid jwt|jwt malformed/i.test(text)) return "Tu sesión venció. Vuelve a entrar.";
    if (/row-level security|violates row-level/i.test(text)) return "Tu rol no puede modificar eso. El administrador debe asignarte permiso.";
    if (/foreign key/i.test(text)) return "No se puede borrar: otros registros todavía lo usan. Archívalo.";
    if (/duplicate key|unique/i.test(text)) return "Ya existe un registro con ese código";
    return text;
  }

  Store._h = { TOKEN_KEY, readJson, publicUser, strip, translate };
  window.Store = Store;
})();
