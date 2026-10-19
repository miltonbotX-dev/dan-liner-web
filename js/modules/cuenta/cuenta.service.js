// modules/cuenta/cuenta.service.js · lógica de datos de cuenta (sin interfaz). Extiende Store.v2api.
(function () {
  const S = window.Store;
  const { cents, soles, sid, num, PAY_TO_DB, PAY_FROM_DB, SALE_STATUS, ROLE_ORDER, RPC_ONLY, BUCKET_PROOFS, NOT_IN_V2, R, get, SF_KEYS, driveShare, loadStorefront, saveStorefront, loadAll, loadPublicProducts, mapPublic, mapNotif, byKey, group, offerOf, mapAll, guard, codeFrom, docType, toDb, DB_TABLE, saveVariant, dataUrlToBlob, upload, driveUrl, saveImages, uploadProof, savePromo, colorIdByName, saveFabricReceipt, saveProductionOrder, saveStaff, dbPayments, attachProof } = S._r;
  Object.assign(S.v2api, {
    saveMyPhone(phone) { if (!S.user) return Promise.resolve(); return S.rest("profiles?id=eq." + encodeURIComponent(S.user.id), { method: "PATCH", body: { phone }, prefer: "return=minimal" }); },
    deleteSelf() { if (!S.token) throw new Error("Inicia sesión"); return S.request("/functions/v1/delete-self", { method: "POST", body: { confirm: "ELIMINAR" } }); },
    async usernameAvailable(u) { return (await S.rpc("username_available", { p_username: String(u || "").trim().toLowerCase() })) === true; },
  });
})();

