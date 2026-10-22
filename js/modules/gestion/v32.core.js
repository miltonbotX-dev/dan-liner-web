// modules/gestion/v32.core.js · Adaptador para la BD v17 de Elon (aún no aplicada).
// Todo lo nuevo de v32 se enciende solo si la BD responde: V17.ready() sondea get_my_cash_alerts (sin parámetros, solo lectura).
// Nombres en V17.FN (API_V17.md); si Elon cambia alguno, se ajusta aquí en un solo lugar.
(function () {
  const V = () => window.DL_V15;
  const FN = { // nombres exactos de API_V17.md (Elon)
    myCashAlerts: "get_my_cash_alerts", claimSession: "claim_cash_session", myTags: "get_my_tags", tagVisibility: "set_customer_tag_visibility",
    setMyPin: "set_my_close_pin", hasMyPin: "has_my_close_pin", approvers: "get_close_approvers", closeWithPin: "close_register_with_pin",
    closeSummary: "get_cash_close_summary", schedule: "set_store_schedule", tolerance: "set_cash_tolerance",
    partners: "get_consignment_partners", upsertPartner: "upsert_consignment_partner", openConsignment: "open_consignment",
    scanOut: "consignment_scan_out", scanReturn: "consignment_scan_return", markSold: "consignment_mark_sold", closeConsignment: "close_consignment",
    consignments: "get_consignments", consignment: "get_consignment", consignedStock: "get_consigned_stock", consignStats: "consignment_stats",
    publicTheme: "get_public_theme", setTheme: "set_theme",
  };
  const st = { probe: null, on: null };
  const override = () => { try { return localStorage.getItem("dl-v17"); } catch { return null; } };
  async function ready() {
    if (override() === "off") return false;
    if (st.on !== null) return st.on;
    if (!window.Store || !window.Store.rpc || !(window.DL && window.DL.state && window.DL.state.user)) return false;
    if (!st.probe) st.probe = window.Store.rpc(FN.myCashAlerts, {}).then((r) => { st.alerts = r; return true; }).catch(() => false).then((v) => { st.on = !!v; if (v) V().rerender(); return st.on; });
    return st.probe;
  }
  const on = () => { if (st.on === null) ready(); return st.on === true; };
  async function call(key, params) {
    const name = FN[key] || key;
    try { return await V().rpc(name, params || {}); }
    catch (e) { if (V().missing(e)) { const err = new Error("Esta función llega con la actualización de la base (v17)."); err.missing = true; throw err; } throw e; }
  }
  window.DL_V17 = { FN, ready, on, call, state: st, reset: () => { st.on = null; st.probe = null; } };
})();
