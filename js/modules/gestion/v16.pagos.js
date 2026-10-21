// modules/gestion/v16.pagos.js · Admin → Tiendas: números Yape/Plin y titular por tienda (BD v16, set_store_payment_numbers; solo admin).
(function () {
  const V = () => window.DL_V15;
  const D = () => window.DL;
  const st = { saving: "" };
  function rows() {
    const pub = D().state.pubStores || [];
    const all = (D().state.data && D().state.data.stores) || [];
    const base = all.length ? all.filter((s) => s.is_active !== false) : pub;
    return base.map((s) => Object.assign({}, s, pub.find((p) => String(p.id) === String(s.id)) || {}));
  }
  function html() {
    const esc = V().esc;
    return `<h3 style="margin:0">Yape / Plin por tienda</h3>
      <p class="tiny muted" style="margin:0">El cliente ve el número de la tienda donde recoge; si es envío, el de la tienda principal. Celular de 9 dígitos que empieza con 9. Deja vacío para quitarlo.</p>
      ${rows().map((s) => `<form class="stack pay-numbers-row" data-store="${esc(s.id)}" onsubmit="return false">
        <b>${esc(s.name)}${s.is_main ? ' <span class="tiny">· principal</span>' : ""}</b>
        <div class="two"><label>Yape<input name="yape" type="tel" inputmode="numeric" maxlength="15" placeholder="987654321" value="${esc(s.yape_number || "")}"></label><label>Titular Yape<input name="yape_holder" maxlength="80" value="${esc(s.yape_holder || "")}"></label></div>
        <div class="two"><label>Plin<input name="plin" type="tel" inputmode="numeric" maxlength="15" placeholder="987654321" value="${esc(s.plin_number || "")}"></label><label>Titular Plin<input name="plin_holder" maxlength="80" value="${esc(s.plin_holder || "")}"></label></div>
        <button class="btn small" type="button" data-act="pn-save" data-id="${esc(s.id)}" ${st.saving === String(s.id) ? "disabled" : ""}>${st.saving === String(s.id) ? "Guardando…" : "Guardar números"}</button>
      </form>`).join("") || `<p class="muted tiny">No hay tiendas activas.</p>`}`;
  }
  function mount() {
    const d = D(); if (!d || !d.isAdmin || !d.isAdmin()) return;
    if (!/^#admin\/stores\b/.test(location.hash) && !(d.ui && d.ui.admin === "stores" && /^#admin\b/.test(location.hash))) return;
    const view = document.getElementById("view") || document.querySelector("main"); if (!view) return;
    let box = view.querySelector(".pay-numbers");
    if (!box) { box = document.createElement("section"); box.className = "panel stack pay-numbers"; box.style.marginTop = "16px"; (view.querySelector("section") || view).appendChild(box); }
    box.innerHTML = html();
  }
  window.DL_AFTER = (window.DL_AFTER || []).concat([mount]);
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "pn-save": async (el) => {
      const f = el.closest("form"); const id = el.dataset.id; const g = (n) => f.querySelector(`[name="${n}"]`).value.trim();
      const p = { p_store_id: Number(id), p_yape: g("yape"), p_plin: g("plin"), p_yape_holder: g("yape_holder"), p_plin_holder: g("plin_holder") };
      for (const k of ["p_yape", "p_plin"]) { const v = p[k].replace(/\D/g, "").replace(/^51(?=9\d{8}$)/, ""); if (v && !/^9\d{8}$/.test(v)) { V().toast(`Número de ${k === "p_yape" ? "Yape" : "Plin"} inválido: 9 dígitos que empiecen con 9.`, "error"); return; } }
      st.saving = id; mount();
      try {
        const r = await V().rpc("set_store_payment_numbers", p);
        const pub = D().state.pubStores || []; const s = pub.find((x) => String(x.id) === String(id));
        if (s && r) Object.assign(s, { yape_number: r.yape_number || "", yape_holder: r.yape_holder || "", plin_number: r.plin_number || "", plin_holder: r.plin_holder || "" });
        V().toast("Números guardados");
      } catch (e) { V().toast(V().missing(e) ? "Esta función aún no está activa en la base de datos." : (String(e.message || "").includes("inválido") || String(e.message || "").includes("Solo el administrador") ? e.message : V().human(e)), "error"); }
      st.saving = ""; mount();
    },
  });
})();
