// modules/contacto/contacto.ui.js · Contacto y redes: editor en Admin, íconos del pie y botón flotante de WhatsApp.
(function () {
  const D = () => window.DL;
  const esc = (v) => D().esc(v);
  const sf = () => ((window.Store && window.Store.v2 && window.Store.v2.storefront) || {});
  const waNum = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 9 ? "51" + d : d; };
  const SVG = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4a22 22 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.3v2.3H7.4V14h2.7v8h3.4z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    tt: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 5 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.3-1.6z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  };
  function waText() {
    const v = D().ui.detail && document.getElementById("sheet") && document.getElementById("sheet").open ? D().detailVariant() : (window.DL_PDP ? window.DL_PDP() : null);
    return v ? `Hola DAN-LINER, me interesa: ${v.name}${v.size_label ? " talla " + v.size_label : ""}${v.color ? " · " + v.color : ""}. ¿Está disponible?` : "Hola DAN-LINER, quisiera información sobre sus ternos.";
  }
  window.DL_SOCIAL_SVG = SVG;
  function mountFooter() {
    if (window.DL_FOOTER) return; // v29: el pie lo arma legal.ui.js
    const c = sf(); const brand = document.querySelector(".site-footer .ft-brand"); if (!brand) return;
    const links = [
      c.contact_whatsapp && ["wa", "WhatsApp", "https://wa.me/" + waNum(c.contact_whatsapp)],
      c.contact_facebook && ["fb", "Facebook", c.contact_facebook],
      c.contact_instagram && ["ig", "Instagram", c.contact_instagram],
      c.contact_tiktok && ["tt", "TikTok", c.contact_tiktok],
      c.contact_email && ["mail", "Correo", "mailto:" + c.contact_email],
    ].filter(Boolean);
    const html = (c.contact_hours ? `<span class="ft-hours">${esc(c.contact_hours)}</span>` : "")
      + (links.length ? `<nav class="ft-social" aria-label="Contacto y redes">${links.map(([k, l, h]) => `<a href="${esc(h)}" ${k === "mail" ? "" : 'target="_blank" rel="noopener"'} aria-label="${l}" title="${l}">${SVG[k]}</a>`).join("")}</nav>` : "");
    let box = brand.querySelector(".ft-contact");
    if (!html) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.className = "ft-contact"; brand.appendChild(box); }
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  function mountFloat() {
    const num = waNum(sf().contact_whatsapp); let a = document.getElementById("wa-float");
    const hide = !num || /^#(caja|admin|taller)/.test(location.hash) || document.body.classList.contains("ui-app") && !/^#(pedido|entrar)/.test(location.hash);
    if (hide) { if (a) a.remove(); return; }
    if (!a) {
      a = document.createElement("a"); a.id = "wa-float"; a.className = "wa-float"; a.target = "_blank"; a.rel = "noopener"; a.setAttribute("aria-label", "Escríbenos por WhatsApp"); a.innerHTML = SVG.wa;
      a.addEventListener("click", () => { a.href = "https://wa.me/" + waNum(sf().contact_whatsapp) + "?text=" + encodeURIComponent(waText()); });
      document.body.appendChild(a);
    }
    a.href = "https://wa.me/" + num + "?text=" + encodeURIComponent(waText());
  }
  window.DL_afterRender = () => { mountFooter(); mountFloat(); };

  // Admin › Contacto y redes
  const FIELDS = [["contact_whatsapp", "WhatsApp principal", "tel", "9 dígitos"], ["contact_facebook", "Facebook", "url", "https://www.facebook.com/…"], ["contact_instagram", "Instagram", "url", "https://www.instagram.com/…"], ["contact_tiktok", "TikTok", "url", "https://www.tiktok.com/@…"], ["contact_email", "Correo de contacto", "email", "ventas@…"], ["contact_hours", "Horario de atención", "text", "Lun a Sáb 9:00–20:00 · Dom 10:00–14:00"]];
  function renderContacto() {
    if (!D().isAdmin()) return `<p class="muted">Solo el administrador cambia el contacto y las redes.</p>`;
    const c = sf(); const stores = D().state.pubStores || [];
    return `<div class="stack" style="max-width:720px">
      <div class="panel stack"><h3>Contacto y redes</h3><p class="tiny">Se muestran en el pie de página. Si un campo está vacío, su ícono no aparece. Las redes deben ser enlaces https de su propio sitio (facebook.com, instagram.com, tiktok.com).</p>
        ${FIELDS.map(([k, l, t, ph]) => `<label>${l}<input id="ct-${k}" type="${t}" ${t === "tel" ? 'inputmode="tel"' : ""} autocomplete="off" value="${esc(c[k] || "")}" placeholder="${esc(ph)}"></label>`).join("")}
        <button class="btn" type="button" data-act="ct-save">Guardar contacto</button></div>
      <div class="panel stack"><h3>WhatsApp y mapa por tienda</h3><p class="tiny">Enlace de Google Maps (google.com/maps, maps.app.goo.gl o goo.gl/maps).</p>
        ${stores.map((s) => `<div class="ws-row"><b>${esc(s.name)}</b><span class="tiny">${esc(s.address || "")}</span>
          <label class="tiny">WhatsApp<input id="st-wa-${esc(s.id)}" type="tel" inputmode="tel" autocomplete="off" value="${esc(s.whatsapp || "")}" placeholder="9 dígitos"></label>
          <label class="tiny">Google Maps<input id="st-maps-${esc(s.id)}" type="url" autocomplete="off" value="${esc(s.maps_url || "")}" placeholder="https://maps.app.goo.gl/…"></label>
          <button class="btn ghost small" type="button" data-act="ct-store" data-id="${esc(s.id)}" style="align-self:flex-start">Guardar tienda</button></div>`).join("") || `<p class="muted">No hay tiendas.</p>`}</div></div>`;
  }
  window.DL_ADMIN_TABS = (window.DL_ADMIN_TABS || []).concat([{ id: "contacto", label: "Contacto y redes", need: ["ADMIN"], render: renderContacto }]);
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "ct-save": async () => {
      const map = {};
      for (const [k] of FIELDS) { const el = document.getElementById("ct-" + k); if (!el) continue; let v = el.value.trim(); if (k === "contact_whatsapp" && v) { v = v.replace(/\D/g, ""); if (v.length === 11 && v.startsWith("51")) v = v.slice(2); if (!/^9\d{8}$/.test(v)) throw new Error("WhatsApp: 9 dígitos que empiezan con 9"); } map[k] = v; }
      await D().Store.v2api.saveStorefront(map);
      await D().reload(); D().render(); D().toast("Contacto guardado ✓");
    },
    "ct-store": async (el) => {
      const id = el.dataset.id; const wa = document.getElementById("st-wa-" + id).value.trim(); const maps = document.getElementById("st-maps-" + id).value.trim();
      await D().Store.v2api.setStoreContact(id, { whatsapp: wa, maps_url: maps });
      await D().reload(); D().render(); D().toast("Tienda actualizada ✓");
    },
  });
})();
