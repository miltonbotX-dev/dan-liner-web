// modules/gestion/v32.config.js · Admin → Configuración → Personalización (paletas y adornos de IU: DL_ESTILO).
// Guarda en storefront (ui_palette / ui_season, BD v17) con set_storefront_settings; si la BD aún no acepta esas claves, queda en este equipo (localStorage, lo hace DL_ESTILO.save).
(function () {
  const V = () => window.DL_V15;
  const st = { where: "" };
  function render() {
    if (!window.DL_ESTILO) return `<p class="muted">El módulo de estilo no está cargado.</p>`;
    const sf = (window.Store && window.Store.v2 && window.Store.v2.storefront) || {};
    const shared = !!(sf.ui_palette || sf.ui_season);
    return `${window.DL_ESTILO.adminHtml()}
      <p class="tiny muted" id="st-where" role="status">${st.where || (shared ? "Guardado para todos los clientes." : "Por ahora se guarda en este equipo; se compartirá con todos cuando la base tenga la actualización v17.")}</p>`;
  }
  (window.DL_ADMIN_TABS = window.DL_ADMIN_TABS || []).push({ id: "personalizacion", label: "Personalización", need: ["ADMIN"], render });
  let timer = null; const pending = {};
  const SF = () => (window.Store && window.Store.v2 && window.Store.v2.storefront) || null;
  let before = null;
  window.DL_ESTILO_SAVE = (vals) => {
    const sf0 = SF(); if (sf0 && !before) before = { ui_palette: sf0.ui_palette, ui_season: sf0.ui_season };
    Object.entries(vals || {}).forEach(([k, v]) => { if (v) { pending[k] = v; if (sf0) sf0[k] = v; } });
    if (window.DL_ESTILO && window.DL_ESTILO.apply) window.DL_ESTILO.apply(); // la BD manda sobre el equipo: vista previa inmediata
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const p_values = Object.assign({}, pending); Object.keys(pending).forEach((k) => delete pending[k]);
      if (!Object.keys(p_values).length) return;
      const out = document.getElementById("st-where");
      try {
        await V().rpc("set_storefront_settings", { p_values });
        const sf = window.Store.v2 && window.Store.v2.storefront; if (sf) { Object.assign(sf, p_values); sf._db = Object.assign(sf._db || {}, p_values); }
        before = null; st.where = "Guardado para todos los clientes ✓"; V().toast("Personalización guardada ✓", "ok");
      } catch (e) {
        const sf = SF(); if (sf && before) { if (before.ui_palette) sf.ui_palette = before.ui_palette; else delete sf.ui_palette; if (before.ui_season) sf.ui_season = before.ui_season; else delete sf.ui_season; before = null; if (window.DL_ESTILO) window.DL_ESTILO.apply(); }
        if (!V().missing(e) && !/clave|permitid|not allowed|key/i.test(String(e && e.message))) { st.where = String((e && e.message) || "No se pudo guardar"); V().toast(st.where, "error"); if (out) out.textContent = st.where; return; }
        st.where = "Guardado en este equipo. Se compartirá con todos cuando la base tenga la actualización v17.";
        V().toast("Guardado en este equipo (la base aún no tiene estas opciones)", "info");
      }
      if (out) out.textContent = st.where;
    }, 400);
  };
  // tema público (anon): si el storefront no trajo ui_palette/ui_season, se toma de get_public_theme
  let themeTried = false;
  window.DL_AFTER = (window.DL_AFTER || []).concat([() => {
    const sf = SF(); if (themeTried || !sf || !window.Store || !window.Store.rpc) return; themeTried = true;
    if (sf.ui_palette && sf.ui_season) return;
    window.Store.rpc("get_public_theme", {}).then((t) => { if (!t || !t.palette) return; sf.ui_palette = sf.ui_palette || t.palette; sf.ui_season = sf.ui_season || t.season || "auto"; if (window.DL_ESTILO) window.DL_ESTILO.apply(); }).catch(() => {});
  }]);
})();
