// modules/admin/admin.service.js · lógica de datos de admin (sin interfaz). Extiende Store.v2api.
(function () {
  const S = window.Store;
  const { cents, soles, sid, num, PAY_TO_DB, PAY_FROM_DB, SALE_STATUS, ROLE_ORDER, RPC_ONLY, BUCKET_PROOFS, NOT_IN_V2, R, get, SF_KEYS, driveShare, loadStorefront, saveStorefront, loadAll, loadPublicProducts, mapPublic, mapNotif, byKey, group, offerOf, mapAll, guard, codeFrom, docType, toDb, DB_TABLE, saveVariant, dataUrlToBlob, upload, driveUrl, saveImages, uploadProof, savePromo, colorIdByName, saveFabricReceipt, saveProductionOrder, saveStaff, dbPayments, attachProof } = S._r;
  Object.assign(S.v2api, {
    setStoreContact(storeId, c) { return S.rpc("set_store_contact", { p_store_id: num(storeId), p_whatsapp: c.whatsapp == null ? null : c.whatsapp, p_maps_url: c.maps_url == null ? null : c.maps_url, p_address: null, p_lat: null, p_lng: null }); },
    setStoreLocation(storeId, lat, lng, address) { return S.rpc("set_store_location", { p_store_id: num(storeId), p_lat: lat, p_lng: lng, p_address: address || null }); },
    async saveProductVariants(productId, product, colorId, fabricId, sizes, general) {
      const p = { name: product.name, description: product.description || null, category_id: num(product.category_id), brand_id: num(product.brand_id),
        show_in_catalog: product.show_in_catalog !== false, hide_below_stock: product.hide_below_stock === "" || product.hide_below_stock == null ? null : Number(product.hide_below_stock) };
      let pid = productId;
      if (!pid) {
        const age = (R.mapped.age_groups || []).find((a) => a.code === "ADU") || (R.mapped.age_groups || [])[0];
        if (!age) throw new Error("Falta la lista de edades");
        const rows = await S.rest("products", { method: "POST", prefer: "return=representation", body: Object.assign(p, { age_group_id: num(age.id) }) });
        pid = rows[0].id;
      } else await S.rest("products?id=eq." + num(pid), { method: "PATCH", body: p, prefer: "return=minimal" });
      const s2 = (c) => Math.round(Number(c || 0)) / 100;
      const res = await S.rpc("save_product_variants", {
        p_product_id: num(pid), p_color_id: num(colorId), p_fabric_id: num(fabricId),
        p_variants: sizes.map((z) => Object.assign({ size_id: num(z.size_id), sale_price: s2(z.sale_cents), cost_price: s2(z.cost_cents),
          offer_price: z.offer_cents ? s2(z.offer_cents) : null, wholesale_price: z.wholesale_cents ? s2(z.wholesale_cents) : null,
          images: (z.images || []).map(driveUrl) }, z.sku ? { sku: z.sku.toUpperCase() } : {}, z.barcode ? { barcode: z.barcode } : {}, z.min_cents ? { min_price: s2(z.min_cents) } : {})),
      });
      if (Array.isArray(general)) await saveImages(pid, general);
      return { product_id: String(pid), result: res };
    },
    setCustomerWholesale(customerId, on, mode) { return S.rpc("set_customer_wholesale", { p_customer_id: num(customerId), p_is_wholesale: !!on, p_mode: mode === "normal" ? "normal" : "mayor" }); },
    setCustomerPrice(customerId, variantId, cents) { return S.rpc("set_customer_price", { p_customer_id: num(customerId), p_variant_id: num(variantId), p_price: cents == null ? null : soles(cents) }); },
    async customerPrices(customerId) { const rows = await S.rest("customer_prices?select=variant_id,price&customer_id=eq." + num(customerId)); const out = {}; (rows || []).forEach((x) => { out[sid(x.variant_id)] = Math.round(Number(x.price) * 100); }); return out; },
    async createStore(d, registers, series) {
      const p = { code: d.code || codeFrom(d.name, 6) + "-" + Date.now().toString(36).slice(-3).toUpperCase(), name: d.name, address: d.address || null, phone: d.phone || null,
        is_main: Boolean(d.is_main), manager_ids: (Array.isArray(d.manager_ids) ? d.manager_ids : (d.manager_id ? [d.manager_id] : [])).filter(Boolean), registers: registers && registers.length ? registers : undefined, series: series || {} };
      return S.rpc("create_store", { p });
    },
    async removeSite(table, id) {
      if (table === "stores") return (await S.rpc("delete_or_close_store", { p_store_id: num(id) })) === "ELIMINADA" ? "deleted" : "closed";
      if (table === "warehouses") return (await S.rpc("delete_or_close_warehouse", { p_warehouse_id: num(id) })) === "ELIMINADO" ? "deleted" : "closed";
      if (!["cash_registers", "document_series"].includes(table)) throw new Error("Tabla no soportada");
      try {
        const rows = await S.rest(DB_TABLE[table] + "?id=eq." + num(id), { method: "DELETE", prefer: "return=representation" });
        if (!rows || !rows.length) throw new Error("Sin permiso: solo el administrador");
        return "deleted";
      } catch (e) {
        if (!/otros registros|foreign key|emitió comprobantes/i.test(e.message)) throw e;
        await S.rest(DB_TABLE[table] + "?id=eq." + num(id), { method: "PATCH", body: { is_active: false }, prefer: "return=minimal" });
        return "closed";
      }
    },
    seriesTaken(series) { return S.rpc("series_taken", { p_series: String(series || "").trim().toUpperCase() }); },
    hasPermission(code) { return S.rpc("has_permission", { p_code: code }); },
    isAdmin() { return S.rpc("is_admin", {}); },
    setStoreManagers(storeId, userIds) { return S.rpc("set_store_managers", { p_store_id: num(storeId), p_user_ids: (userIds || []).filter(Boolean) }); },
    assignStaff(userId, roleCodes, storeIds, phone) { return S.rpc("assign_staff", { p_user_id: userId, p_role_codes: roleCodes || [], p_store_ids: (storeIds || []).map(num), p_phone: phone || null }); },
    canAssignStaff(roleCode, storeId) { return S.rpc("can_assign_staff", { p_role_code: roleCode, p_store_id: num(storeId) }); },
  });
})();

