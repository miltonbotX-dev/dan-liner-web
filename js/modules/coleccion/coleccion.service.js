// modules/coleccion/coleccion.service.js · lógica de datos de coleccion (sin interfaz). Extiende Store.v2api.
(function () {
  const S = window.Store;
  const { cents, soles, sid, num, PAY_TO_DB, PAY_FROM_DB, SALE_STATUS, ROLE_ORDER, RPC_ONLY, BUCKET_PROOFS, NOT_IN_V2, R, get, SF_KEYS, driveShare, loadStorefront, saveStorefront, loadAll, loadPublicProducts, mapPublic, mapNotif, byKey, group, offerOf, mapAll, guard, codeFrom, docType, toDb, DB_TABLE, saveVariant, dataUrlToBlob, upload, driveUrl, saveImages, uploadProof, savePromo, colorIdByName, saveFabricReceipt, saveProductionOrder, saveStaff, dbPayments, attachProof } = S._r;
  Object.assign(S.v2api, {
    async publicStores() { const r = await S.rest("v_public_stores?select=*&order=is_main.desc,id"); return (r || []).map((x) => ({ id: sid(x.id), name: x.name, address: x.address || "", lat: x.lat == null ? null : Number(x.lat), lng: x.lng == null ? null : Number(x.lng), is_main: !!x.is_main, whatsapp: x.whatsapp || "", maps_url: x.maps_url || "" })); },
    loadStorefront,
    async saveStorefront(map) { await saveStorefront(map); R.storefront = Object.assign({}, R.storefront, map); },
  });
})();

