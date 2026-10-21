// modules/pedidos/pedidos.service.js · lógica de datos de pedidos (sin interfaz). Extiende Store.v2api.
(function () {
  const S = window.Store;
  const { cents, soles, sid, num, PAY_TO_DB, PAY_FROM_DB, SALE_STATUS, ROLE_ORDER, RPC_ONLY, BUCKET_PROOFS, NOT_IN_V2, R, get, SF_KEYS, driveShare, loadStorefront, saveStorefront, loadAll, loadPublicProducts, mapPublic, mapNotif, byKey, group, offerOf, mapAll, guard, codeFrom, docType, toDb, DB_TABLE, saveVariant, dataUrlToBlob, upload, driveUrl, saveImages, uploadProof, savePromo, colorIdByName, saveFabricReceipt, saveProductionOrder, saveStaff, dbPayments, attachProof } = S._r;
  Object.assign(S.v2api, {
    createOrder({ storeId, items, delivery, phone, notes }) { return S.rpc("create_order", { p_store_id: num(storeId), p_items: items.map((i) => ({ variant_id: num(i.variant_id), qty: Number(i.qty) })), p_delivery: delivery, p_phone: phone || null, p_notes: notes || null }); },
    async orders(filter) {
      const os = await S.rest("orders?select=*&order=created_at.desc&limit=200" + (filter || ""));
      if (!os || !os.length) return [];
      const its = await S.rest("order_items?select=*&order_id=in.(" + os.map((o) => o.id).join(",") + ")");
      return os.map((o) => ({ id: sid(o.id), code: o.code, user_id: o.user_id, store_id: sid(o.store_id), status: o.status, delivery: o.delivery, phone: o.contact_phone, notes: o.notes || "", total_cents: cents(o.total), created_at: o.created_at, status_changed_at: o.status_changed_at, cancel_reason: o.cancel_reason,
        items: (its || []).filter((i) => String(i.order_id) === String(o.id)).map((i) => ({ variant_id: sid(i.variant_id), name: i.product_name, label: i.variant_label || "", qty: Number(i.quantity), unit_cents: cents(i.unit_price), line_cents: cents(i.line_total) })) }));
    },
    // ===== v14: pedidos web (parámetros con nombre) =====
    createWebOrder(o) {
      return S.rpc("create_web_order", { p_items: o.items.map((i) => ({ variant_id: num(i.variant_id), qty: Number(i.qty) })), p_delivery: o.delivery, p_payment_method: o.payment,
        p_store_id: o.storeId ? num(o.storeId) : null, p_ubigeo: o.ubigeo || null, p_departamento: o.departamento || null, p_provincia: o.provincia || null, p_distrito: o.distrito || null,
        p_direccion: o.direccion || null, p_referencia: o.referencia || null, p_nota: o.nota || null, p_phone: o.phone || null, p_proof_path: o.proofPath || null });
    },
    // Comprobante Yape/Plin del cliente: payment-proofs/web/<uid>/<pedido>-<hora>.<ext>
    async uploadOrderProof(dataUrl, orderId) {
      if (!S.user) throw new Error("Inicia sesión");
      const { ext } = dataUrlToBlob(dataUrl);
      const path = "web/" + S.user.id + "/" + num(orderId) + "-" + Date.now() + "." + ext;
      await upload(BUCKET_PROOFS, path, dataUrl);
      return BUCKET_PROOFS + "/" + path;
    },
    attachOrderProof(orderId, path) { return S.rpc("attach_order_proof", { p_order_id: num(orderId), p_proof_path: path }); },
    myOrders(limit, offset) { return S.rpc("get_my_orders", { p_limit: limit || 50, p_offset: offset || 0 }); },
    orderHistory(id) { return S.rpc("get_order_history", { p_order_id: num(id) }); },
    getOrders(f) { f = f || {}; return S.rpc("get_orders", { p_store_id: f.storeId ? num(f.storeId) : null, p_status: f.status || null, p_limit: f.limit || 50, p_offset: f.offset || 0 }); },
    async proofUrl(path) {
      const p = String(path || "").replace(/^payment-proofs\//, ""); if (!p) return null;
      const r = await S.request("/storage/v1/object/sign/" + BUCKET_PROOFS + "/" + p.split("/").map(encodeURIComponent).join("/"), { method: "POST", body: { expiresIn: 600 } }, true);
      return r && (r.signedURL || r.signedUrl) ? S.cfg.url + "/storage/v1" + (r.signedURL || r.signedUrl) : null;
    },
    async ubigeo() {
      if (R.ubigeo) return R.ubigeo;
      const q = "ubigeo?select=code,departamento,provincia,distrito&order=departamento,provincia,distrito&limit=1000&offset=";
      const [a, b] = await Promise.all([S.rest(q + "0"), S.rest(q + "1000")]);
      R.ubigeo = (a || []).concat(b || []);
      return R.ubigeo;
    },
    cancelMyOrder(id, reason) { return S.rpc("cancel_my_order", { p_order_id: num(id), p_reason: reason || null }); },
    setOrderStatus(id, status, reason) { return S.rpc("set_order_status", { p_order_id: num(id), p_status: status, p_reason: reason || null }); },
  });
})();

