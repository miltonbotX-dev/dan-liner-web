// modules/gestion/v15.core.js · utilidades comunes para las pantallas de la BD v15 (API_V15.md de Elon).
// Archivos: v15.clientes.js (etiquetas/notas), v15.promos.js (promociones y combos), v15.separados.js (adelantos, Mis separados, mensajes),
// v15.caja.js (cajas de todas las tiendas, tienda del día, ficha técnica, textos legales, bandeja de reclamos).
(function () {
  const D = () => window.DL;
  const S = () => window.Store;
  const esc = (v) => D().esc(v);
  const rpc = (n, p) => S().rpc(n, p || {});
  const remote = () => !!(D() && D().Store && D().Store.mode === "remote");
  const missing = (e) => e && (e.status === 404 || /could not find the function|schema cache|does not exist/i.test(e.message || ""));
  const human = (e) => { const t = String((e && e.message) || e || ""); if (/permission|row-level|42501/i.test(t)) return "Tu cuenta no tiene permiso para esto."; if (/failed to fetch|network/i.test(t)) return "Sin conexión. Intenta de nuevo."; return t || "No se pudo completar."; };
  const money = (n) => D().soles(Math.round(Number(n || 0) * 100));
  const plain = (n) => money(n).replace(/<[^>]+>/g, "");
  const num = (v) => { const n = Number(String(v == null ? "" : v).replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
  const fdate = (t, withTime) => (t ? new Date(String(t).length === 10 ? t + "T12:00:00" : t).toLocaleString("es-PE", Object.assign({ timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric" }, withTime ? { hour: "2-digit", minute: "2-digit" } : {})) : "—");
  const hhmm = (t) => (t ? String(t).slice(0, 5) : "");
  const stores = () => (D().state.data && D().state.data.stores && D().state.data.stores.length ? D().state.data.stores : D().state.pubStores || []);
  const rerender = () => D().render();
  const toast = (m, k) => D().toast(m, k);
  const limaDate = (ms) => new Date(ms - 5 * 3600e3).toISOString().slice(0, 10);
  const busy = {};
  // Carga una sola vez por clave; el resultado queda en box.data y el error (en español) en box.err.
  async function once(key, fn, box) {
    if (busy[key]) return; busy[key] = true;
    try { box.data = await fn(); box.err = ""; } catch (e) { box.err = missing(e) ? "Esta función aún no está disponible." : human(e); }
    busy[key] = false; box.loaded = true; rerender();
  }
  window.DL_V15 = { esc, rpc, money, plain, num, fdate, hhmm, human, missing, stores, rerender, toast, once, busy, limaDate, remote };
})();
