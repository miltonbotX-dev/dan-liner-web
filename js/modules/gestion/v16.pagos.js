// modules/gestion/v16.pagos.js · Admin → Tiendas: números Yape/Plin y titular por tienda (BD v16, set_store_payment_numbers; solo admin).
// v33 (BD v18): QR de Yape/Plin por tienda → set_store_payment_qr (enlace https/Drive o imagen subida a avatars/<uid>/; '' = quitar).
(function () {
  const V = () => window.DL_V15;
  const D = () => window.DL;
  const st = { saving: "", qr: {} };
  function rows() {
    const pub = D().state.pubStores || [];
    const all = (D().state.data && D().state.data.stores) || [];
    const base = all.length ? all.filter((s) => s.is_active !== false) : pub;
    return base.map((s) => Object.assign({}, s, pub.find((p) => String(p.id) === String(s.id)) || {}));
  }
  function qrField(s, k) {
    const esc = V().esc; const pend = st.qr[s.id + ":" + k]; const v = pend != null ? pend : s[k + "_qr_url"] || "";
    return `<div class="row qr-row" style="justify-content:flex-start;gap:10px;align-items:flex-end">
      ${v ? `<img class="qr-thumb" alt="QR ${k === "yape" ? "Yape" : "Plin"}" width="64" height="64" style="width:64px;height:64px;object-fit:contain;background:#fff;border-radius:8px" src="${esc(D().safeSrc(v))}">` : ""}
      <label class="grow">QR ${k === "yape" ? "Yape" : "Plin"} (enlace https o Drive)<input name="${k}_qr" type="url" maxlength="500" placeholder="https://…" value="${esc(v)}"></label>
      <label class="btn ghost small">Subir imagen<input type="file" accept="image/*" hidden data-qr-up="${k}"></label></div>`;
  }
  function html() {
    const esc = V().esc;
    return `<h3 style="margin:0">Yape / Plin por tienda</h3>
      <p class="tiny muted" style="margin:0">El cliente ve el número de la tienda donde recoge; si es envío, el de la tienda principal. Celular de 9 dígitos que empieza con 9. Deja vacío para quitarlo.</p>
      ${rows().map((s) => `<form novalidate class="stack pay-numbers-row" data-store="${esc(s.id)}" onsubmit="return false">
        <b>${esc(s.name)}${s.is_main ? ' <span class="tiny">· principal</span>' : ""}</b>
        <div class="two"><label>Yape<input name="yape" type="tel" inputmode="numeric" maxlength="15" placeholder="987654321" value="${esc(s.yape_number || "")}"></label><label>Titular Yape<input name="yape_holder" maxlength="80" value="${esc(s.yape_holder || "")}"></label></div>
        ${qrField(s, "yape")}
        <div class="two"><label>Plin<input name="plin" type="tel" inputmode="numeric" maxlength="15" placeholder="987654321" value="${esc(s.plin_number || "")}"></label><label>Titular Plin<input name="plin_holder" maxlength="80" value="${esc(s.plin_holder || "")}"></label></div>
        ${qrField(s, "plin")}
        <button class="btn small" type="button" data-act="pn-save" data-id="${esc(s.id)}" ${st.saving === String(s.id) ? "disabled" : ""}>${st.saving === String(s.id) ? "Guardando…" : "Guardar números y QR"}</button>
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
  document.addEventListener("change", async (e) => {
    const t = e.target; if (!t || !t.dataset || !t.dataset.qrUp || !t.files || !t.files[0]) return;
    const f = t.closest("form"); const k = t.dataset.qrUp; const inp = f && f.querySelector(`[name="${k}_qr"]`); if (!inp) return;
    try {
      const blob = await window.DL33.compress(t.files[0], 700, 200 * 1024);
      const up = await window.DL33.uploadOwn("qr-" + k + "-tienda" + f.dataset.store, blob);
      inp.value = up.url; st.qr[f.dataset.store + ":" + k] = up.url; mount(); V().toast("Imagen lista. Pulsa «Guardar números y QR» para publicarla.");
    } catch (err) { V().toast(window.DL33.human(err), "error"); }
    t.value = "";
  });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "pn-save": async (el) => {
      const f = el.closest("form"); const id = el.dataset.id; const g = (n) => f.querySelector(`[name="${n}"]`).value.trim();
      const qr = { p_store_id: Number(id), p_yape_qr_url: g("yape_qr"), p_plin_qr_url: g("plin_qr") };
      for (const k of ["p_yape_qr_url", "p_plin_qr_url"]) { if (qr[k] && !/^https:\/\/\S{8,}$/i.test(qr[k])) { V().toast("El QR debe ser un enlace https:// (o sube la imagen).", "error"); return; } }
      const p = { p_store_id: Number(id), p_yape: g("yape"), p_plin: g("plin"), p_yape_holder: g("yape_holder"), p_plin_holder: g("plin_holder") };
      for (const k of ["p_yape", "p_plin"]) { const v = p[k].replace(/\D/g, "").replace(/^51(?=9\d{8}$)/, ""); if (v && !/^9\d{8}$/.test(v)) { V().toast(`Número de ${k === "p_yape" ? "Yape" : "Plin"} inválido: 9 dígitos que empiecen con 9.`, "error"); return; } }
      st.saving = id; mount();
      try {
        const r = await V().rpc("set_store_payment_numbers", p);
        const pub = D().state.pubStores || []; const s = pub.find((x) => String(x.id) === String(id));
        if (s && r) Object.assign(s, { yape_number: r.yape_number || "", yape_holder: r.yape_holder || "", plin_number: r.plin_number || "", plin_holder: r.plin_holder || "" });
        const rq = await V().rpc("set_store_payment_qr", qr);
        if (s && rq) Object.assign(s, { yape_qr_url: rq.yape_qr_url || "", plin_qr_url: rq.plin_qr_url || "" });
        delete st.qr[id + ":yape"]; delete st.qr[id + ":plin"];
        V().toast("Números y QR guardados");
      } catch (e) { V().toast(V().missing(e) ? "Esta función aún no está disponible." : (String(e.message || "").includes("inválido") || String(e.message || "").includes("Solo el administrador") || String(e.message || "").startsWith("QR de") ? e.message : V().human(e)), "error"); }
      st.saving = ""; mount();
    },
  });
})();
