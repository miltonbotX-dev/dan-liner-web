// modules/tienda/tienda.ui.js · Menú lateral del cliente (#site-drawer) y pantallas de tienda:
// #pieza/<clave> (ficha completa .pdp), #promociones, #mis-pedidos, #tiendas, #contacto. Usa solo datos existentes.
(function () {
  const D = () => window.DL;
  const esc = (v) => D().esc(v);
  const sf = () => ((window.Store && window.Store.v2 && window.Store.v2.storefront) || {});
  const waNum = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 9 ? "51" + d : d; };
  const pdp = { key: null, variant: null };

  // ---------- Menú lateral ----------
  const drawer = () => document.getElementById("site-drawer");
  let lastFocus = null;
  function setDrawer(open) {
    const d = drawer(); if (!d) return;
    if (Boolean(open) === !d.hidden) return;
    if (open) {
      lastFocus = document.activeElement; d.hidden = false; document.body.classList.add("drawer-open"); document.documentElement.style.overflow = "hidden";
      markCurrent(); setTimeout(() => { const f = d.querySelector(".sd-link"); if (f) f.focus(); }, 30);
    } else {
      d.hidden = true; document.body.classList.remove("drawer-open"); document.documentElement.style.overflow = "";
      
      try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch { }
    }
    document.querySelectorAll('.menu-btn[data-act="site-menu"]').forEach((b) => b.setAttribute("aria-expanded", String(!!open)));
  }
  function markCurrent() {
    const d = drawer(); if (!d) return;
    const name = (location.hash || "#coleccion").slice(1).split("/")[0] || "coleccion";
    const cur = name === "entrar" ? "cuenta" : name === "pieza" ? "coleccion" : name;
    d.querySelectorAll("a.sd-link").forEach((a) => { const on = a.getAttribute("href") === "#" + cur; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("#site-drawer a.sd-link"); if (a) setDrawer(false);
    const t = e.target.closest && e.target.closest('#site-drawer [data-act="theme"]'); if (t) setTimeout(() => setDrawer(false), 120);
  });
  document.addEventListener("keydown", (e) => { const d = drawer(); if (e.key === "Escape" && d && !d.hidden) { e.preventDefault(); setDrawer(false); } }, true);
  window.addEventListener("hashchange", () => { const d = drawer(); if (d && !d.hidden) setDrawer(false); markCurrent(); });

  // ---------- Ficha completa ----------
  function groupOf(key) { const all = D().visibleProducts(); const vars = D().bySize(all.filter((p) => D().productKey(p) === key)); return vars; }
  function renderPdp() {
    const key = decodeURIComponent(D().page().sub || "");
    const vars = groupOf(key);
    if (!vars.length) return `<section class="stack" style="padding:32px 0 60px"><h1>Pieza no disponible</h1><p class="muted">Puede que ya no esté en la colección.</p><a class="btn" href="#coleccion">Ver la colección</a></section>`;
    if (pdp.key !== key) { pdp.key = key; pdp.variant = D().pickVariant(key, vars).id; }
    const v = vars.find((x) => x.id === pdp.variant) || vars[0];
    const imgs = D().groupImages([v].concat(vars.filter((x) => x !== v))).filter(Boolean);
    const pr = D().priceOf(v); const stock = D().stockOf(v); const soldOut = stock <= 0;
    const cat = D().nameOf("categories", v.category_id);
    const sizes = vars.map((x) => { const off = D().stockOf(x) <= 0; return `<button type="button" class="chip opt ${x.id === v.id ? "on" : ""} ${off ? "off" : ""}" data-act="pdp-size" data-id="${esc(x.id)}" ${off ? 'disabled title="Agotado"' : ""} aria-pressed="${x.id === v.id}">${esc(x.size_label || "Única")}</button>`; }).join("");
    const avail = vars.filter((x) => D().stockOf(x) > 0).map((x) => x.size_label).filter(Boolean);
    const stores = (D().state.pubStores || []);
    const stockTxt = soldOut ? "Agotado en esta talla" : stock <= 3 ? `Disponible · quedan ${stock}` : "Disponible";
    return `<nav class="tiny" style="padding-top:16px"><a class="link-btn" href="#coleccion">← Colección</a>${cat && cat !== "—" ? ` · ${esc(cat)}` : ""}</nav>
      <article class="pdp">
        <div class="pdp-gallery">${(imgs.length ? imgs : [""]).map((u, i) => `<img decoding="async" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} width="800" height="1066" alt="${esc(v.name)} ${i + 1}" src="${esc(D().safeSrc(u))}">`).join("")}</div>
        <div class="pdp-info">
          ${cat && cat !== "—" ? `<p class="kicker">${esc(cat)}</p>` : ""}
          <h1>${esc(v.name)}</h1>
          ${[v.fabric, v.color].filter(Boolean).length ? `<p class="muted">${esc([v.fabric, v.color].filter(Boolean).join(" · "))}</p>` : ""}
          <div class="row" style="justify-content:flex-start"><strong class="price">${D().soles(pr.unit)}</strong>${pr.offer ? `<s class="tiny">${D().soles(pr.list)}</s>` : ""}</div>
          ${vars.length ? `<div class="stack opt-group"><span class="tiny">Talla${v.size_label ? ": <b>" + esc(v.size_label) + "</b>" : ""}</span><div class="size-pick" role="group" aria-label="Talla">${sizes}</div><span class="tiny ${soldOut ? "bad" : ""}">${esc(stockTxt)}</span></div>` : ""}
          <button class="btn btn-bag full" type="button" data-act="cart-add" data-id="${esc(v.id)}" ${soldOut ? "disabled" : ""}>${D().icon("bag", 16)} ${soldOut ? "Agotado" : "Agregar talla " + esc(v.size_label || "")}</button>
          <div class="pdp-acc">
            <details open><summary>Detalles</summary><div class="stack" style="padding-top:10px">${v.description ? `<p>${esc(v.description)}</p>` : ""}<p class="tiny">Terno de fábrica${v.fabric ? " · Tela " + esc(v.fabric) : ""}${v.color ? " · Color " + esc(v.color) : ""}</p><p class="tiny">Código ${esc(v.sku || "—")}</p></div></details>
            <details><summary>Medidas</summary><div class="stack" style="padding-top:10px"><p class="tiny">Tallas de fábrica${vars.length ? ": " + esc(vars.map((x) => x.size_label || "Única").join(", ")) : ""}.${avail.length ? " Con stock ahora: " + esc(avail.join(", ")) + "." : ""}</p><p class="tiny">Si dudas de tu talla, pruébatelo en tienda o escríbenos por WhatsApp con tu talla habitual.</p></div></details>
            <details><summary>Envío</summary><div class="stack" style="padding-top:10px"><p class="tiny">Recojo en tienda${stores.length ? ": " + esc(stores.map((s) => s.name).join(" · ")) : ""}.</p><p class="tiny">Envío a domicilio: elige «Envío a domicilio» al hacer tu pedido y coordinamos contigo la entrega.</p></div></details>
          </div>
        </div>
      </article>
      ${pairsHtml(key, v)}`;
  }
  function pairsHtml(key, v) {
    const groups = D().productGroups(D().visibleProducts()).filter((g) => g.key !== key && D().stockOf(g.first) > 0);
    if (!groups.length) return "";
    const other = groups.filter((g) => g.first.category_id !== v.category_id), same = groups.filter((g) => g.first.category_id === v.category_id);
    const pick = other.concat(same).slice(0, 4);
    return `<section class="stack pdp-pairs" style="padding:8px 0 56px"><h2 style="font-family:var(--display);font-weight:400">Combina con…</h2><div class="grid">${pick.map(D().cardHtml).join("")}</div></section>`;
  }

  // ---------- Otras pantallas ----------
  function renderPromos() {
    const groups = D().productGroups(D().visibleProducts()).filter((g) => g.vars.some((x) => D().priceOf(x).offer));
    return `<section class="stack" style="padding:28px 0 56px"><p class="kicker">Promociones</p><h1>Precios especiales</h1>
      ${groups.length ? `<div class="grid">${groups.map(D().cardHtml).join("")}</div>` : `<p class="muted">Pronto nuevas promociones. Mientras tanto, mira la colección.</p><a class="btn" href="#coleccion">Ver la colección</a>`}</section>`;
  }
  function renderMisPedidos() {
    const st = D().state;
    if (!st.user) return `<section class="stack" style="padding:28px 0 56px;max-width:640px"><p class="kicker">Mis pedidos</p><h1>Entra para ver tus pedidos</h1><p class="muted">Tus pedidos web aparecen aquí con su estado.</p><a class="btn" href="#entrar" data-act="login-for" data-id="mis-pedidos">Entrar</a></section>`;
    return `<section class="stack" style="padding:28px 0 56px;max-width:640px"><p class="kicker">Mis pedidos</p><h1>Tus pedidos</h1>${D().myOrdersHtml()}<a class="link-btn" href="#cuenta">← Mi cuenta</a></section>`;
  }
  function storeCard(s) {
    const wa = waNum(s.whatsapp);
    const maps = s.maps_url || (s.lat != null && s.lng != null ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}` : "");
    return `<div class="panel stack store-card"><h3>${esc(s.name)}</h3>${s.address ? `<p class="tiny">${esc(s.address)}</p>` : ""}
      ${wa || maps ? `<div class="row" style="justify-content:flex-start">${wa ? `<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}">WhatsApp</a>` : ""}${maps ? `<a class="btn ghost small" target="_blank" rel="noopener" href="${esc(maps)}">Cómo llegar</a>` : ""}</div>` : ""}</div>`;
  }
  function renderTiendas() {
    const stores = D().state.pubStores || [];
    return `<section class="stack" style="padding:28px 0 56px;max-width:720px"><p class="kicker">Nuestras tiendas</p><h1>Visítanos</h1>
      ${sf().contact_hours ? `<p class="muted">${esc(sf().contact_hours)}</p>` : ""}
      ${stores.length ? stores.map(storeCard).join("") : `<p class="muted">Galería Rey de Huánuco y Galería Unicachi · La Victoria, Lima.</p>`}</section>`;
  }
  function renderContacto() {
    const c = sf(); const wa = waNum(c.contact_whatsapp);
    const rows = [
      wa && `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}?text=${encodeURIComponent("Hola DAN-LINER, quisiera información sobre sus ternos.")}">Escríbenos por WhatsApp</a>`,
      c.contact_email && `<a class="btn ghost" href="mailto:${esc(c.contact_email)}">${esc(c.contact_email)}</a>`,
      c.contact_facebook && `<a class="btn ghost" target="_blank" rel="noopener" href="${esc(c.contact_facebook)}">Facebook</a>`,
      c.contact_instagram && `<a class="btn ghost" target="_blank" rel="noopener" href="${esc(c.contact_instagram)}">Instagram</a>`,
      c.contact_tiktok && `<a class="btn ghost" target="_blank" rel="noopener" href="${esc(c.contact_tiktok)}">TikTok</a>`,
    ].filter(Boolean);
    return `<section class="stack" style="padding:28px 0 56px;max-width:720px"><p class="kicker">Contacto</p><h1>Hablemos</h1>
      ${c.contact_hours ? `<p class="muted">${esc(c.contact_hours)}</p>` : ""}
      ${rows.length ? `<div class="row" style="justify-content:flex-start;flex-wrap:wrap">${rows.join("")}</div>` : `<p class="muted">Visítanos en cualquiera de nuestras tiendas.</p>`}
      <h2 style="font-family:var(--display);font-weight:400;margin-top:12px">Tiendas</h2>${(D().state.pubStores || []).map(storeCard).join("")}</section>`;
  }
  window.DL_SCREENS = Object.assign(window.DL_SCREENS || {}, { pieza: renderPdp, promociones: renderPromos, "mis-pedidos": renderMisPedidos, tiendas: renderTiendas, contacto: renderContacto });

  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "site-menu": () => { const d = drawer(); setDrawer(d ? d.hidden : false); },
    "pdp-open": (el) => { D().closeSheet(); location.hash = "pieza/" + encodeURIComponent(el.dataset.id); },
    "pdp-size": (el) => { if (el.disabled) return; pdp.variant = el.dataset.id; (D().ui.cardSel = D().ui.cardSel || {})[pdp.key] = el.dataset.id; D().render(); },
    "acc-edit": () => { if (window.DL_ACTIONS["me-edit"]) window.DL_ACTIONS["me-edit"](); location.hash = "cuenta/datos"; },
    "acc-soon": (el) => { D().toast((el.dataset.id || "Esta sección") + ": próximamente", "ok"); },
    "login-for": (el) => { D().ui.afterLogin = el.dataset.id; try { localStorage.setItem("dl-after", el.dataset.id); } catch { } location.hash = "entrar"; },
  });
  // al entrar a una ficha, subir al inicio; recordar de dónde venimos para el botón «← Colección»
  window.addEventListener("hashchange", () => { if (/^#pieza\//.test(location.hash)) window.scrollTo(0, 0); });
  window.DL_AFTER = (window.DL_AFTER || []).concat([markCurrent]);
  window.DL_PDP = () => { if (!/^#pieza\//.test(location.hash) || !pdp.key) return null; const vars = groupOf(pdp.key); return vars.find((x) => x.id === pdp.variant) || vars[0] || null; };
})();
