// modules/inventario/inventario.service.js · lógica de datos de inventario (sin interfaz). Extiende Store.v2api.
(function () {
  const S = window.Store;
  const { cents, soles, sid, num, PAY_TO_DB, PAY_FROM_DB, SALE_STATUS, ROLE_ORDER, RPC_ONLY, BUCKET_PROOFS, NOT_IN_V2, R, get, SF_KEYS, driveShare, loadStorefront, saveStorefront, loadAll, loadPublicProducts, mapPublic, mapNotif, byKey, group, offerOf, mapAll, guard, codeFrom, docType, toDb, DB_TABLE, saveVariant, dataUrlToBlob, upload, driveUrl, saveImages, uploadProof, savePromo, colorIdByName, saveFabricReceipt, saveProductionOrder, saveStaff, dbPayments, attachProof } = S._r;
  Object.assign(S.v2api, {
    stockMove(warehouseId, variantId, delta, note) {
      const type = delta > 0 ? (note ? "AJUSTE_POS" : "ENTRADA") : "AJUSTE_NEG";
      return S.rpc("register_stock_movement", { p_warehouse_id: num(warehouseId), p_variant_id: num(variantId), p_type: type, p_quantity: Math.abs(delta), p_notes: note || (delta < 0 ? "Ajuste" : null), p_unit_cost: null });
    },
    sendTransfer(fromId, toId, items, notes) { return S.rpc("send_transfer", { p_from: num(fromId), p_to: num(toId), p_items: items.map((i) => ({ variant_id: num(i.product_id), quantity: Number(i.qty) })), p_notes: notes || null }); },
    receiveTransfer(id) { return S.rpc("receive_transfer", { p_transfer_id: num(id) }); },
    requestTransfer(fromId, toId, items, message) { return S.rpc("request_transfer", { p_from: num(fromId), p_to: num(toId), p_items: items.map((i) => ({ variant_id: num(i.product_id), quantity: Number(i.qty) })), p_message: message || null }); },
    dispatchTransfer(id, items, notes) { return S.rpc("dispatch_transfer_request", { p_transfer_id: num(id), p_items: items ? items.map((i) => ({ variant_id: num(i.product_id), quantity: Number(i.qty) })) : null, p_notes: notes || null }); },
    rejectTransfer(id, reason) { return S.rpc("reject_transfer_request", { p_transfer_id: num(id), p_reason: reason }); },
    checkIn(storeId, note) { return S.rpc("check_in", { p_store_id: num(storeId), p_note: note || null }); },
    checkOut(note) { return S.rpc("check_out", { p_note: note || null }); },
    createConsignment(d) { return S.rpc("create_consignment", { p_data: { partner_name: d.counterpart, partner_doc: d.partner_doc || null, partner_phone: d.partner_phone || null, direction: d.direction === "RECIBIDO" ? "ENTRADA" : "SALIDA", warehouse_id: num(d.warehouse_id), due_date: d.due_date || null, notes: d.note || null, items: [{ variant_id: num(d.product_id), quantity: Number(d.qty), agreed_cost: soles(d.unit_cost_cents) }] } }); },
    settleConsignment(id, items, close) { return S.rpc("settle_consignment", { p_id: num(id), p_items: (items || []).map((i) => ({ variant_id: num(i.product_id), sold: Number(i.sold || 0), returned: Number(i.returned || 0) })), p_close: Boolean(close) }); },
    payConsignment(id, amountCents, method, operationCode, proofUrl) { return S.rpc("add_consignment_payment", { p_id: num(id), p_amount: soles(amountCents), p_method: PAY_TO_DB[method] || method, p_operation_code: operationCode || null, p_proof_url: proofUrl || null }); },
    receiveProduction(orderId, counts, colorName, fabricId, notes, salePriceCents) {
      const color = colorName ? colorIdByName(colorName) : null;
      if (colorName && !color) throw new Error("Color «" + colorName + "» no está en la lista del catálogo");
      const items = Object.entries(counts).filter(([, q]) => Number(q) > 0).map(([label, q]) => { const sz = (R.mapped.sizes || []).find((s) => s.label === label); if (!sz) throw new Error("Talla " + label + " no está en la lista"); const it = { size_id: num(sz.id), quantity: Number(q) }; if (color) it.color_id = color; if (fabricId) it.fabric_id = num(fabricId); if (salePriceCents) it.sale_price = soles(salePriceCents); return it; });
      return S.rpc("receive_production", { p_order_id: num(orderId), p_items: items, p_notes: notes || null });
    },
    async stockElsewhere(variantId) { return ((await S.rpc("stock_elsewhere", { p_variant_id: num(variantId) })) || []).map((r) => ({ store_id: sid(r.store_id), store_name: r.store_name, warehouse_id: sid(r.warehouse_id), warehouse_name: r.warehouse_name, kind: r.warehouse_kind, qty: Number(r.quantity), is_mine: Boolean(r.is_mine) })); },
    flagQuickTransfer(id, reason) { return S.rpc("flag_quick_transfer", { p_transfer_id: num(id), p_reason: reason }); },
    quickTransfer(fromWh, toWh, items, notes) { return S.rpc("quick_transfer", { p_from_warehouse: num(fromWh), p_to_warehouse: num(toWh), p_items: items.map((i) => ({ variant_id: num(i.product_id), quantity: Number(i.qty) })), p_notes: notes || null }); },
  });
})();

