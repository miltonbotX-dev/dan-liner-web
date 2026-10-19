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
    cancelMyOrder(id, reason) { return S.rpc("cancel_my_order", { p_order_id: num(id), p_reason: reason || null }); },
    setOrderStatus(id, status, reason) { return S.rpc("set_order_status", { p_order_id: num(id), p_status: status, p_reason: reason || null }); },
  });
})();

