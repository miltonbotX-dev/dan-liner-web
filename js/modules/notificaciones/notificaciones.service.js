// modules/notificaciones/notificaciones.service.js · lógica de datos de notificaciones (sin interfaz). Extiende Store.v2api.
(function () {
  const S = window.Store;
  const { cents, soles, sid, num, PAY_TO_DB, PAY_FROM_DB, SALE_STATUS, ROLE_ORDER, RPC_ONLY, BUCKET_PROOFS, NOT_IN_V2, R, get, SF_KEYS, driveShare, loadStorefront, saveStorefront, loadAll, loadPublicProducts, mapPublic, mapNotif, byKey, group, offerOf, mapAll, guard, codeFrom, docType, toDb, DB_TABLE, saveVariant, dataUrlToBlob, upload, driveUrl, saveImages, uploadProof, savePromo, colorIdByName, saveFabricReceipt, saveProductionOrder, saveStaff, dbPayments, attachProof } = S._r;
  Object.assign(S.v2api, {
    async refreshNotifs() { const rows = await S.rest("v_my_notifications?select=*&order=created_at.desc&limit=100"); R.raw.notifications = rows || []; R.mapped.notifications = (rows || []).map((n) => mapNotif(n, (id) => ((R.mapped.staff || []).find((s) => s.id === String(id)) || {}).full_name || "")); return R.mapped.notifications; },
    markRead(ids) { return S.rpc("mark_notifications_read", { p_ids: ids ? ids.map(num) : null }); },
  });
})();

