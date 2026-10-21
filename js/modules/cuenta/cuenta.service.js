// modules/cuenta/cuenta.service.js · lógica de datos de cuenta (sin interfaz). Extiende Store.v2api.
(function () {
  const S = window.Store;
  const { cents, soles, sid, num, PAY_TO_DB, PAY_FROM_DB, SALE_STATUS, ROLE_ORDER, RPC_ONLY, BUCKET_PROOFS, NOT_IN_V2, R, get, SF_KEYS, driveShare, loadStorefront, saveStorefront, loadAll, loadPublicProducts, mapPublic, mapNotif, byKey, group, offerOf, mapAll, guard, codeFrom, docType, toDb, DB_TABLE, saveVariant, dataUrlToBlob, upload, driveUrl, saveImages, uploadProof, savePromo, colorIdByName, saveFabricReceipt, saveProductionOrder, saveStaff, dbPayments, attachProof } = S._r;
  Object.assign(S.v2api, {
    saveMyPhone(phone) { if (!S.user) return Promise.resolve(); return S.rest("profiles?id=eq." + encodeURIComponent(S.user.id), { method: "PATCH", body: { phone }, prefer: "return=minimal" }); },
    // Perfil propio: profiles (RLS prof_upd: id = auth.uid(); columnas editables full_name, dni, phone)
    // + customers enlazado (cust_self_upd: user_id = auth.uid(); el documento solo lo cambia la tienda, trigger guard_customer_self_edit).
    async getMyProfile() {
      if (!S.user) throw new Error("Inicia sesión");
      const uid = encodeURIComponent(S.user.id);
      const [p, c] = await Promise.all([S.rest("profiles?select=*&id=eq." + uid), S.rest("customers?select=id,name,phone,email,document_type,document_number,address&user_id=eq." + uid).catch(() => [])]);
      return { profile: (p || [])[0] || null, customer: (c || [])[0] || null };
    },
    async saveMyProfile(v) {
      if (!S.user) throw new Error("Inicia sesión");
      // v14: update_my_profile (nombres y apellidos separados, valida en la base). Si no existe, cae al PATCH directo.
      try {
        const r = await S.rpc("update_my_profile", { p_first_name: v.first_name || "", p_last_name: v.last_name || "", p_phone: v.phone || "", p_dni: v.dni || "" });
        if (S.user) S.user.full_name = r.full_name || S.user.full_name;
        return { profile: r, customerNote: "" };
      } catch (e) { if (!(e.status === 404 || /could not find the function/i.test(e.message || ""))) throw e; }
      const uid = encodeURIComponent(S.user.id);
      const body = { full_name: v.full_name, phone: v.phone || null, dni: v.dni || null };
      const rows = await S.rest("profiles?id=eq." + uid, { method: "PATCH", body, prefer: "return=representation" });
      if (!rows || !rows.length) throw new Error("No se pudo guardar: tu cuenta no tiene permiso para editar su perfil.");
      let customerNote = "";
      if (v.customer_id) {
        try { await S.rest("customers?id=eq." + encodeURIComponent(v.customer_id) + "&user_id=eq." + uid, { method: "PATCH", body: { name: v.full_name, phone: v.phone || null }, prefer: "return=minimal" }); }
        catch (e) { customerNote = "Tu ficha de comprobantes no se actualizó."; }
      }
      if (S.user) S.user.full_name = v.full_name;
      return { profile: rows[0], customerNote };
    },
    deleteSelf() { if (!S.token) throw new Error("Inicia sesión"); return S.request("/functions/v1/delete-self", { method: "POST", body: { confirm: "ELIMINAR" } }); },
    async usernameAvailable(u) { return (await S.rpc("username_available", { p_username: String(u || "").trim().toLowerCase() })) === true; },
  });
})();

