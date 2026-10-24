// core/session.js · sesión y autenticación (Supabase Auth). Extiende window.Store.
(function () {
  const Store = window.Store;
  // eslint-disable-next-line no-unused-vars
  const { TOKEN_KEY, readJson, publicUser, strip, translate } = Store._h;
  Object.assign(Store, {
    async init() {
      const conf = window.DL_CONFIG || {};
      this.cfg = { url: String(conf.SUPABASE_URL || "").trim().replace(/\/$/, ""), key: String(conf.SUPABASE_ANON_KEY || "").trim(), fn: conf.ADMIN_FUNCTION || "admin-users" };
      this.cache = { tables: {} };
      this.authReturn = this.consumeAuthHash();
      this.token = readJson(TOKEN_KEY, null);
      if (this.token && this.token.expires_at && this.token.expires_at < Date.now() / 1000 + 30) await this.refresh();
      if (this.token && !this.token.user && this.authReturn && !this.authReturn.error) {
        try { this.token.user = await this.request("/auth/v1/user", {}, true); this.saveToken(this.token); } catch { this.token = null; }
      }
      if (this.token && this.token.user) await this.hydrateRemoteUser();
    },

    consumeAuthHash() {
      const h = String(location.hash || "");
      if (!/access_token=|error_description=/.test(h)) return null;
      const q = new URLSearchParams(h.replace(/^#/, ""));
      history.replaceState(null, "", location.pathname + location.search + "#entrar");
      if (q.get("error_description")) return { error: q.get("error_description").replace(/\+/g, " ") };
      const type = q.get("type") || "";
      this.saveToken({ access_token: q.get("access_token"), refresh_token: q.get("refresh_token"), expires_in: Number(q.get("expires_in")) || 3600, expires_at: Number(q.get("expires_at")) || 0 });
      return { type };
    },

    async recoverPassword(email, redirectTo) {
      if (!this.cfg) throw new Error("Sin conexión con el servidor");
      await this.request("/auth/v1/recover?redirect_to=" + encodeURIComponent(redirectTo), { method: "POST", body: { email: String(email).trim().toLowerCase() } }, true);
    },

    async updatePassword(password) {
      if (!this.token) throw new Error("El enlace venció. Pide uno nuevo.");
      await this.request("/auth/v1/user", { method: "PUT", body: { password } });
    },

    async refresh() {
      if (!this.token || !this.token.refresh_token) return false;
      try {
        const data = await this.request("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          body: { refresh_token: this.token.refresh_token },
        }, true);
        this.saveToken(data);
        return true;
      } catch {
        this.token = null;
        this.user = null;
        localStorage.removeItem(TOKEN_KEY);
        return false;
      }
    },

    saveToken(data) {
      this.token = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        user: data.user || null,
      };
      localStorage.setItem(TOKEN_KEY, JSON.stringify(this.token));
    },

    async hydrateRemoteUser() {
      const authUser = this.token.user;
      if (!authUser) {
        this.user = null;
        return;
      }
      let rows = [];
      try {
        rows = await this.rest("staff?select=*&id=eq." + encodeURIComponent(authUser.id));
      } catch (err) {
        this.lastError = err.message;
      }
      const row = rows && rows[0];
      this.fixPendingProfile(authUser).catch(() => {});
      if (row) {
        this.user = { id: row.id, email: row.email, full_name: row.full_name, role: row.role, is_active: row.is_active };
      } else {
        this.user = {
          id: authUser.id,
          email: authUser.email,
          full_name: (authUser.user_metadata && authUser.user_metadata.full_name) || authUser.email,
          role: "PENDIENTE",
          is_active: true,
        };
      }
    },

    async fixPendingProfile(authUser) {
      let pend = null; try { pend = JSON.parse(localStorage.getItem("dl-pending-signup") || "null"); } catch { }
      const meta = authUser.user_metadata || {};
      const want = { username: meta.username || (pend && pend.email === String(authUser.email).toLowerCase() ? pend.username : null), phone: meta.phone || (pend && pend.phone) || null };
      if (!want.username && !want.phone) return;
      const rows = await this.rest("profiles?select=username,phone&id=eq." + encodeURIComponent(authUser.id));
      const p = rows && rows[0]; if (!p) return;
      const patch = {}; if (!p.username && want.username) patch.username = want.username; if (!p.phone && want.phone) patch.phone = want.phone;
      if (Object.keys(patch).length) await this.rest("profiles?id=eq." + encodeURIComponent(authUser.id), { method: "PATCH", body: patch, prefer: "return=minimal" });
      try { localStorage.removeItem("dl-pending-signup"); } catch { }
    },

    async signUp({ name, username, email, password, phone, dni }) {
      email = String(email || "").trim().toLowerCase();
      phone = String(phone || "").replace(/\D/g, ""); if (phone.length === 11 && phone.startsWith("51")) phone = phone.slice(2);
      username = String(username || "").trim().toLowerCase();
      if (String(name || "").trim().length < 2) throw new Error("Escribe tu nombre");
      if (!/^[a-z0-9_.]{3,30}$/.test(username)) throw new Error("El usuario debe tener de 3 a 30 letras, números, punto o guion bajo");
      if (!email.includes("@")) throw new Error("Escribe un correo válido");
      if (!/^9\d{8}$/.test(phone)) throw new Error("Escribe tu celular: 9 dígitos que empiezan con 9");
      if (dni && !/^\d{8}$/.test(String(dni).trim())) throw new Error("El DNI debe tener 8 dígitos");
      if (!password || password.length < 8) throw new Error("La contraseña necesita 8 caracteres");
      if (this.v2api && !(await this.v2api.usernameAvailable(username))) throw new Error("Ese nombre de usuario ya está en uso");
      const meta = { full_name: String(name).trim(), phone, username };
      if (dni) meta.dni = String(dni).trim();
      const redirect = location.origin + location.pathname;
      const data = await this.request("/auth/v1/signup?redirect_to=" + encodeURIComponent(redirect), { method: "POST", body: { email, password, data: meta } }, true);
      if (!data.access_token) {
        // Confirmación por correo activa: el perfil (celular, usuario) lo crea la BD con estos datos; al confirmar y entrar se revisa.
        if (data && data.identities && data.identities.length === 0) throw new Error("Ese correo ya está registrado. Entra o usa “Olvidé mi contraseña”.");
        try { localStorage.setItem("dl-pending-signup", JSON.stringify({ email, username, phone, at: Date.now() })); } catch { }
        return { pending: true, email };
      }
      await this.setSession(data);
      // el usuario lo guarda la BD (trigger profile_set_username); fixPendingProfile lo completa si faltara
      await this.hydrateRemoteUser();
      return this.user;
    },

    async setSession(data) {
      this.saveToken(data);
      if (!this.token.user) {
        try { this.token.user = await this.request("/auth/v1/user", {}, true); this.saveToken(Object.assign({}, data, { user: this.token.user })); } catch { }
      }
    },

    async signIn({ login, email, password }) {
      const id = String(login || email || "").trim();
      const fail = "Usuario o contraseña incorrectos.";
      if (!id || !password) throw new Error(fail);
      let data;
      try {
        if (id.includes("@")) data = await this.request("/auth/v1/token?grant_type=password", { method: "POST", body: { email: id.toLowerCase(), password } });
        else data = await this.loginIdentifier(id, password);
      } catch { throw new Error(fail); }
      await this.setSession(data);
      await this.hydrateRemoteUser();
      return this.user;
    },

    async loginIdentifier(identifier, password) {
      const res = await fetch(this.cfg.url + "/functions/v1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.cfg.key, Authorization: "Bearer " + this.cfg.key },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token) throw new Error("Usuario o contraseña incorrectos.");
      return data;
    },

    async adminCall(action, payload) {
      const res = await fetch(this.cfg.url + "/functions/v1/" + (this.cfg.fn || "admin-users"), {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.cfg.key, Authorization: "Bearer " + ((this.token && this.token.access_token) || this.cfg.key) },
        body: JSON.stringify(Object.assign({ action }, payload)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo completar la operación");
      return data;
    },

    async adminCreateUser({ full_name, email, password, role, roles, store_id, store_ids, phone }) {
      email = String(email || "").trim().toLowerCase();
      full_name = String(full_name || "").trim();
      phone = String(phone || "").trim();
      if (full_name.length < 2) throw new Error("Escribe el nombre");
      if (!email) throw new Error("Escribe el correo o usuario");
      if (phone.replace(/\D/g, "").length < 9) throw new Error("Escribe el celular");
      if (!password || password.length < 8) throw new Error("La contraseña necesita 8 caracteres");
      const login = email.includes("@") ? email : email + "@danliner.local";
      const rl = Array.isArray(roles) && roles.length ? roles : (role ? [role] : []);
      const st = Array.isArray(store_ids) && store_ids.length ? store_ids : (store_id ? [store_id] : []);
      return this.adminCall("create", { full_name, email: login, password, role: rl[0] || null, roles: rl, store_id: st[0] || null, store_ids: st.map(Number), phone });
    },

    async adminSetPassword(id, password) {
      if (!password || password.length < 8) throw new Error("La contraseña necesita 8 caracteres");
      return this.adminCall("password", { id, password });
    },

    async adminDeleteUser(id) { return this.adminCall("delete", { id }); },

    async signOut() {
      if (this.token) {
        try { await this.request("/auth/v1/logout", { method: "POST" }, true); } catch { }
        this.token = null;
        localStorage.removeItem(TOKEN_KEY);
      }
      this.user = null;
    },

  });
})();
