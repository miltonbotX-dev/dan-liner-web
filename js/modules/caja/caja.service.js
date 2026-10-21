// modules/caja/caja.service.js · lógica de datos de caja (sin interfaz). Extiende Store.v2api.
(function () {
  const S = window.Store;
  const { cents, soles, sid, num, PAY_TO_DB, PAY_FROM_DB, SALE_STATUS, ROLE_ORDER, RPC_ONLY, BUCKET_PROOFS, NOT_IN_V2, R, get, SF_KEYS, driveShare, loadStorefront, saveStorefront, loadAll, loadPublicProducts, mapPublic, mapNotif, byKey, group, offerOf, mapAll, guard, codeFrom, docType, toDb, DB_TABLE, saveVariant, dataUrlToBlob, upload, driveUrl, saveImages, uploadProof, savePromo, colorIdByName, saveFabricReceipt, saveProductionOrder, saveStaff, dbPayments, attachProof } = S._r;
  Object.assign(S.v2api, {
    async priceForCustomer(variantId, customerId) { const v = await S.rpc("price_for_customer", { p_variant_id: num(variantId), p_customer_id: num(customerId) }); return v == null ? null : Math.round(Number(v) * 100); },
    async variantByCode(code, storeId) {
      try { return await S.rpc("get_variant_by_barcode", { p_code: String(code), p_store_id: storeId ? num(storeId) : null }); }
      catch (e) { if (e.status === 404) return undefined; throw e; }
    },
    dbPayments, attachProof, uploadProof, saveImages, driveUrl, BUCKET_PROOFS,
    async ensureCustomer({ customerId, name, doc, phone, address }) {
      if (customerId) return num(customerId);
      doc = String(doc || "").trim();
      if (!doc) return null;
      const type = docType(doc);
      const found = await S.rest("customers?select=id&document_type=eq." + type + "&document_number=eq." + encodeURIComponent(doc));
      if (found && found[0]) {
        const patch = {}; if (address) patch.address = address; if (phone) patch.phone = phone;
        if (Object.keys(patch).length) await S.rest("customers?id=eq." + found[0].id, { method: "PATCH", body: patch, prefer: "return=minimal" }).catch(() => {});
        return found[0].id;
      }
      const rows = await S.rest("customers", { method: "POST", prefer: "return=representation", body: { document_type: type, document_number: doc, name: String(name || "").trim() || "Cliente " + doc, phone: phone || null, address: address || null } });
      return rows[0].id;
    },
    createSale(p) { return S.rpc("create_sale", { p_sale: p }); },
    paySaleBalance(saleId, payments, docTypeArg) { return S.rpc("pay_sale_balance", { p_sale_id: num(saleId), p_payments: dbPayments(payments), p_document_type: docTypeArg || null }); },
    cancelSale(saleId, reason, refundMethod) { return S.rpc("cancel_sale", { p_sale_id: num(saleId), p_reason: reason, p_refund_method: refundMethod ? (PAY_TO_DB[refundMethod] || refundMethod) : null }); },
    async openCash(storeId, openingCents, registerId) {
      // v15: abre en la tienda del día (fija, rotación o general); sin fondo usa el que dejó la última caja
      try { const r = await S.rpc("open_cash_session_at_store", { p_store_id: num(storeId), p_opening: openingCents == null ? null : soles(openingCents), p_register_id: registerId ? num(registerId) : null }); return r && r.session_id != null ? r.session_id : r; }
      catch (e) { if (!(e && (e.status === 404 || /could not find the function|schema cache/i.test(e.message || "")))) throw e; }
      const reg = (R.mapped.cash_registers || []).find((r) => r.store_id === String(storeId) && r.is_active !== false);
      if (!reg) throw new Error("Esta tienda no tiene una caja registrada. Pídela al administrador.");
      return S.rpc("open_cash_session", { p_register_id: num(reg.id), p_opening: soles(openingCents) });
    },
    suggestedOpening(registerId) { return S.rpc("suggested_opening", { p_register_id: num(registerId) }); },
    closeCash(sessionId, counted, notes, floatLeftCents) {
      const map = typeof counted === "object" && counted ? counted : { CASH: counted };
      const counts = Object.entries(map).map(([m, c]) => ({ method: PAY_TO_DB[m] || m, counted: soles(c) }));
      return S.rpc("close_cash_session", { p_session_id: num(sessionId), p_counts: counts, p_notes: notes || null, p_float_left: floatLeftCents == null ? null : soles(floatLeftCents) });
    },
    async expectedCash(sessionId) { const rows = await S.rpc("cash_session_expected", { p_session_id: num(sessionId) }); return Object.fromEntries((rows || []).map((r) => [PAY_FROM_DB[r.method] || r.method, cents(r.expected)])); },
    addExpense(sessionId, amountCents, concept, proofUrl) { return S.rpc("add_cash_expense", { p_session_id: num(sessionId), p_amount: soles(amountCents), p_concept: concept, p_proof_url: proofUrl || null }); },
    approveCash(sessionId) { return S.rpc("approve_cash_session", { p_session_id: num(sessionId) }); },
  });
})();

