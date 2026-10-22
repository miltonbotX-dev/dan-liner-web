// modules/gestion/v15.promos.js · Promociones y combos: banner con cuenta regresiva en Colección y Promociones (v_public_promotions, anon),
// insignia .badge-promo en las tarjetas, tarjetas .combo-card; Admin › Promociones y combos (upsert_promotion + set_promotion_items, avisar por etiqueta).
(function () {
  const { esc, rpc, money, plain, num, fdate, human, stores, rerender, toast, once, busy } = window.DL_V15;
  const D = () => window.DL; const S = () => window.Store;
  const allow = (r) => D().allow(r);
  const PP = { list: null, loaded: false };
  function loadPub() {
    if (PP.list || busy.pp) return; busy.pp = true;
    S().rest("v_public_promotions?select=*&order=sort_order,ends_at").then((r) => { PP.list = r || []; }).catch(() => { PP.list = []; }).finally(() => { busy.pp = false; PP.loaded = true; rerender(); });
  }
  const offTxt = (p) => (p.kind === "COMBO" ? "Combo" : p.discount_type === "PORCENTAJE" ? `−${Number(p.discount_value)}%` : `−${plain(p.discount_value)}`);
  function cdText(ends) {
    let s = Math.max(0, Math.floor((new Date(ends).getTime() - Date.now()) / 1000)); if (!s) return "<span>Terminó</span>";
    const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
    const p2 = (n) => String(n).padStart(2, "0");
    return (d ? `<span>${d}<small>DÍAS</small></span>` : "") + `<span>${p2(h)}<small>HRS</small></span><span>${p2(m)}<small>MIN</small></span><span>${p2(s)}<small>SEG</small></span>`;
  }
  const cd = (ends) => `<span class="countdown" data-ends="${esc(ends)}" role="timer" aria-label="Tiempo restante">${cdText(ends)}</span>`;
  setInterval(() => document.querySelectorAll(".countdown[data-ends]").forEach((el) => { el.innerHTML = cdText(el.dataset.ends); }), 1000);
  const bannerHtml = (p) => `<a class="promo-banner" href="#promociones"><span class="promo-tag">${esc(offTxt(p))}</span>
      <span class="grow"><b>${esc(p.name)}</b>${p.description ? `<span class="tiny">${esc(p.description)}</span>` : ""}${p.store_name ? `<span class="tiny">Solo en ${esc(p.store_name)}</span>` : ""}</span>${cd(p.ends_at)}</a>`;
  function comboHtml(p) {
    const items = p.items || [];
    const wa = String((S().v2 && S().v2.storefront && S().v2.storefront.contact_whatsapp) || "").replace(/\D/g, "");
    const text = `Hola DAN-LINER, quiero el combo "${p.name}" (${items.map((i) => `${i.product_name}${i.size ? " talla " + i.size : ""} × ${i.qty || 1}`).join(", ")}) a ${plain(p.combo_price)}.`;
    return `<article class="combo-card"><div class="combo-items">${items.slice(0, 4).map((i) => `<img loading="lazy" alt="${esc(i.product_name)}" src="${esc(D().safeSrc(i.image))}">`).join(`<span class="plus" aria-hidden="true">+</span>`)}</div>
      <div class="stack" style="gap:6px"><span class="promo-tag">Combo</span><h3 style="margin:0">${esc(p.name)}</h3>${p.description ? `<p class="tiny">${esc(p.description)}</p>` : ""}
        <ul class="combo-list">${items.map((i) => `<li>${esc(i.product_name)}${i.size ? " · T. " + esc(i.size) : ""} × ${Number(i.qty || 1)}</li>`).join("")}</ul>
        <p class="combo-price">${p.regular_total ? `<s>${money(p.regular_total)}</s>` : ""}<b>${money(p.combo_price)}</b>${Number(p.savings) > 0 ? ` <span class="tiny">Ahorras ${money(p.savings)}</span>` : ""}</p>
        ${cd(p.ends_at)}${p.store_name ? `<p class="tiny">Solo en ${esc(p.store_name)}</p>` : ""}
        ${wa ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${wa.length === 9 ? "51" + wa : wa}?text=${encodeURIComponent(text)}">Pedir combo por WhatsApp</a>` : ""}</div></article>`;
  }
  function promoKeys() {
    const m = new Map();
    (PP.list || []).filter((p) => p.kind === "DESCUENTO").forEach((p) => (p.items || []).forEach((i) => { if (i.product_id) m.set("p" + i.product_id, p); if (i.variant_id) m.set("v" + i.variant_id, p); }));
    return m;
  }
  function decorate() {
    if (!PP.list) { loadPub(); return; }
    const view = document.getElementById("view"); if (!view) return;
    if (D().page().name === "coleccion" && PP.list.length && !view.querySelector(".promo-strip")) {
      const host = view.querySelector(".grid");
      const html = PP.list.filter((p) => p.kind !== "COMBO").slice(0, 2).map(bannerHtml).join("") + (PP.list.some((p) => p.kind === "COMBO") ? `<a class="promo-banner combo-link" href="#promociones"><span class="promo-tag">Combos</span><span class="grow"><b>Combos con precio especial</b></span></a>` : "");
      if (html && host && host.parentNode) { const div = document.createElement("div"); div.className = "promo-strip"; div.innerHTML = html; host.parentNode.insertBefore(div, host); }
    }
    const keys = promoKeys(); if (!keys.size) return;
    const vis = D().visibleProducts ? D().visibleProducts() : [];
    view.querySelectorAll(".product-card[data-key]").forEach((card) => {
      if (card.querySelector(".badge-promo")) return;
      const v = vis.find((x) => D().productKey(x) === card.dataset.key && (keys.has("p" + x.product_id) || keys.has("v" + x.id)));
      if (!v) return; const p = keys.get("p" + v.product_id) || keys.get("v" + v.id);
      const media = card.querySelector(".card-media"); if (media) media.insertAdjacentHTML("beforeend", `<span class="badge-promo" title="${esc(p.name)}">${esc(offTxt(p))}</span>`);
    });
  }
  const prevPromos = (window.DL_SCREENS || {}).promociones;
  function renderPromociones() {
    loadPub();
    const list = PP.list || []; const desc = list.filter((p) => p.kind !== "COMBO"); const combos = list.filter((p) => p.kind === "COMBO");
    const base = prevPromos ? prevPromos() : "";
    if (!PP.loaded) return `<section class="stack" style="padding:28px 0 56px"><p class="kicker">Promociones</p><h1>Promociones</h1><p class="muted">Cargando promociones…</p></section>`;
    if (!list.length) return base;
    return `<section class="stack" style="padding:28px 0 8px"><p class="kicker">Promociones</p><h1>Promociones vigentes</h1>
      ${desc.length ? `<div class="promo-strip">${desc.map(bannerHtml).join("")}</div>` : ""}
      ${combos.length ? `<h2 style="font-family:var(--display);font-weight:400;margin-top:12px">Combos</h2><div class="combo-grid">${combos.map(comboHtml).join("")}</div>` : ""}
      <p class="tiny">Los descuentos ya están aplicados en el precio de cada prenda. Los combos y las promociones de una tienda se aplican en caja.</p></section>`
      + base.replace(/<p class="kicker">Promociones<\/p><h1>Precios especiales<\/h1>/, `<h2 style="font-family:var(--display);font-weight:400">Prendas con precio especial</h2>`);
  }

  // ---------- Admin ----------
  const PA = { data: null, loaded: false, err: "", form: null, q: "", ferr: "" };
  const localDT = (t) => (t ? new Date(new Date(t).getTime() - 5 * 3600e3).toISOString().slice(0, 16) : ""); // Lima UTC-5
  const fromLocal = (v) => (v ? new Date(v + ":00-05:00").toISOString() : null);
  const STATE = { VIGENTE: "ok", PROGRAMADA: "", VENCIDA: "muted", INACTIVA: "muted" };
  function renderAdmin() {
    if (!allow(["SUPERVISOR"])) return `<p class="muted">Sin permiso.</p>`;
    if (!PA.loaded) setTimeout(() => once("pa", () => rpc("get_promotions", { p_only_live: false }), PA), 0);
    if (window.DL_TAGS) window.DL_TAGS.load();
    const f = PA.form;
    const list = (PA.data || []).map((p) => `<article class="panel stack promo-row"><div class="row" style="flex-wrap:wrap"><span class="grow"><span class="promo-tag">${esc(p.kind === "COMBO" ? "Combo · " + plain(p.combo_price) : offTxt(p))}</span> <b>${esc(p.name)}</b> <span class="badge ${STATE[p.state] || ""}">${esc(p.state || "")}</span></span>
        <span class="tiny">${esc(fdate(p.starts_at, true))} → ${esc(fdate(p.ends_at, true))}${p.store_name ? " · " + esc(p.store_name) : " · todas las tiendas"}</span></div>
        <p class="tiny">${(p.items || []).map((i) => esc(i.label || "")).join(" · ") || "Sin prendas"}</p>
        <div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn small ghost" type="button" data-act="pa-edit" data-id="${esc(p.id)}">Editar</button>${p.state === "VIGENTE" ? `<button class="btn small ghost" type="button" data-act="pa-notify" data-id="${esc(p.id)}">Avisar a clientes</button>` : ""}${p.is_active !== false && p.state !== "INACTIVA" ? `<button class="btn small ghost" type="button" data-act="pa-off" data-id="${esc(p.id)}">Desactivar</button>` : ""}<button class="btn small ghost" type="button" data-act="pa-del" data-id="${esc(p.id)}">Eliminar</button></div></article>`).join("");
    let form = `<button class="btn" type="button" data-act="pa-new">+ Nueva promoción o combo</button>`;
    if (f) {
      const all = (D().state.data.products || []).filter((p) => !p.deleted_at && p.is_active !== false);
      const groups = D().productGroups(all); const q = PA.q.toLowerCase();
      const shown = groups.filter((g) => { const v = g.first || g.vars[0]; return f.items[String(v.product_id)] || !q || `${v.name} ${v.sku || ""} ${v.color || ""}`.toLowerCase().includes(q); }).slice(0, 40);
      form = `<form novalidate class="panel stack" data-form="pa-save"><h3>${f.id ? "Editar" : "Nueva"} promoción</h3>
        <div class="ship-choice"><label><input type="radio" name="kind" value="DESCUENTO" ${f.kind !== "COMBO" ? "checked" : ""}><b>Descuento</b><span class="tiny">Baja el precio de las prendas elegidas.</span></label><label><input type="radio" name="kind" value="COMBO" ${f.kind === "COMBO" ? "checked" : ""}><b>Combo</b><span class="tiny">2 o más prendas a un precio.</span></label></div>
        <label>Nombre<input name="name" required maxlength="80" value="${esc(f.name || "")}" placeholder="Ej. Semana del terno"></label>
        <label>Descripción (opcional)<input name="description" maxlength="200" value="${esc(f.description || "")}"></label>
        <div class="two"><label>Empieza<input type="datetime-local" name="starts" required value="${esc(localDT(f.starts_at || new Date().toISOString()))}"></label><label>Termina<input type="datetime-local" name="ends" required value="${esc(localDT(f.ends_at || new Date(Date.now() + 7 * 864e5).toISOString()))}"></label></div>
        ${f.kind === "COMBO" ? `<label>Precio del combo (S/)<input name="combo_price" inputmode="decimal" required value="${esc(f.combo_price || "")}"></label>`
          : `<div class="two"><label>Tipo<select name="discount_type"><option value="PORCENTAJE" ${f.discount_type !== "MONTO" ? "selected" : ""}>Porcentaje (%)</option><option value="MONTO" ${f.discount_type === "MONTO" ? "selected" : ""}>Monto (S/)</option></select></label><label>Valor<input name="discount_value" inputmode="decimal" required value="${esc(f.discount_value || "")}"></label></div>`}
        <div class="two"><label>Tienda<select name="store_id"><option value="">Todas (web y tiendas)</option>${stores().map((s) => `<option value="${esc(s.id)}" ${String(f.store_id || "") === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label><label>Imagen (enlace de Drive, opcional)<input name="image_url" value="${esc(f.image_url || "")}"></label></div>
        <fieldset class="photo-box"><legend>Prendas (${Object.keys(f.items).length})</legend><input id="pa-q" type="search" placeholder="Buscar prenda, código o color" value="${esc(PA.q)}" autocomplete="off">
          <div class="pa-pick">${shown.map((g) => { const v = g.first || g.vars[0]; const id = String(v.product_id); const it = f.items[id]; return `<label class="row pa-item"><input type="checkbox" data-act="pa-item" data-id="${esc(id)}" ${it ? "checked" : ""} style="width:auto"><span class="grow">${esc(v.name)} <span class="tiny">${esc(v.color || "")}</span></span>${f.kind === "COMBO" && it ? `<input class="pa-qty" data-id="${esc(id)}" type="number" min="1" max="10" value="${it.qty || 1}" style="width:64px" aria-label="Cantidad">` : ""}</label>`; }).join("") || `<p class="muted tiny">Sin resultados.</p>`}</div>
          <p class="tiny">${f.kind === "COMBO" ? "El combo necesita al menos 2 prendas." : "Un descuento sin tienda baja el precio en la web y en Caja."}</p></fieldset>
        ${PA.ferr ? `<p class="alert-text" role="alert">${esc(PA.ferr)}</p>` : ""}
        <div class="row"><button class="btn" type="submit">Guardar</button><button class="btn ghost" type="button" data-act="pa-cancel">Cancelar</button></div></form>`;
    }
    return `<div class="stack" style="max-width:860px">${form}${PA.err ? `<p class="alert-text">${esc(PA.err)}</p>` : ""}${PA.loaded ? list || `<p class="muted">Aún no hay promociones.</p>` : `<p class="muted">Cargando…</p>`}</div>`;
  }
  const keep = (form) => { ["name", "description", "image_url", "combo_price", "discount_value", "discount_type", "store_id"].forEach((k) => { if (form && form.elements[k]) PA.form[k] = form.elements[k].value; }); if (form && form.elements.starts) { PA.form.starts_at = fromLocal(form.elements.starts.value); PA.form.ends_at = fromLocal(form.elements.ends.value); } };
  const tabs = window.DL_ADMIN_TABS = window.DL_ADMIN_TABS || [];
  const t = tabs.find((x) => x.id === "promos");
  if (t) Object.assign(t, { label: "Promociones y combos", need: ["SUPERVISOR"], render: renderAdmin }); else tabs.push({ id: "promos", label: "Promociones y combos", need: ["SUPERVISOR"], render: renderAdmin });
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, {
    "pa-save": async (form) => {
      const f = PA.form; const g = (n) => form.elements[n]; PA.ferr = "";
      const kind = form.querySelector('input[name="kind"]:checked').value;
      const items = Object.entries(f.items).map(([pid, it]) => ({ product_id: Number(pid), qty: kind === "COMBO" ? Number(it.qty || 1) : 1 }));
      const starts = fromLocal(g("starts").value), ends = fromLocal(g("ends").value);
      const p = { p_id: f.id ? Number(f.id) : null, p_name: g("name").value.trim(), p_kind: kind, p_starts_at: starts, p_ends_at: ends, p_description: g("description").value.trim() || null, p_store_id: g("store_id").value ? Number(g("store_id").value) : null, p_image_url: g("image_url").value.trim() || null, p_is_active: true };
      if (kind === "COMBO") p.p_combo_price = num(g("combo_price").value); else { p.p_discount_type = g("discount_type").value; p.p_discount_value = num(g("discount_value").value); }
      PA.ferr = !p.p_name ? "Ponle un nombre." : !starts || !ends || ends <= starts ? "Revisa las fechas: el fin debe ser después del inicio." : !items.length ? "Elige al menos una prenda." : kind === "COMBO" && items.reduce((s, i) => s + i.qty, 0) < 2 ? "El combo necesita al menos 2 prendas." : (kind === "COMBO" ? !(p.p_combo_price > 0) : !(p.p_discount_value > 0)) ? "Escribe un valor mayor a 0." : kind !== "COMBO" && p.p_discount_type === "PORCENTAJE" && p.p_discount_value >= 100 ? "El porcentaje debe ser menor a 100." : "";
      if (PA.ferr) { keep(form); rerender(); return; }
      try { const id = await rpc("upsert_promotion", p); await rpc("set_promotion_items", { p_promotion_id: Number(id || f.id), p_items: items }); }
      catch (e) { PA.ferr = human(e); keep(form); rerender(); return; }
      PA.form = null; PA.loaded = false; PP.list = null; toast("Promoción guardada ✓", "ok"); rerender();
    },
  });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "pa-new": () => { PA.form = { id: null, kind: "DESCUENTO", items: {} }; PA.ferr = ""; rerender(); },
    "pa-cancel": () => { PA.form = null; rerender(); },
    "pa-edit": (el) => { const p = (PA.data || []).find((x) => String(x.id) === el.dataset.id); if (!p) return; const items = {}; (p.items || []).forEach((i) => { if (i.product_id) items[String(i.product_id)] = { qty: i.qty || 1 }; }); PA.form = Object.assign({}, p, { items }); PA.ferr = ""; rerender(); window.scrollTo(0, 0); },
    "pa-item": (el) => { const f = PA.form; const id = el.dataset.id; keep(el.closest("form")); if (f.items[id]) delete f.items[id]; else f.items[id] = { qty: 1 }; rerender(); },
    "pa-off": async (el) => { await rpc("deactivate_promotion", { p_id: Number(el.dataset.id) }); PA.loaded = false; PP.list = null; rerender(); toast("Promoción desactivada", "ok"); },
    "pa-del": async (el) => { if (!(await window.dlgConfirm("¿Eliminar esta promoción? Si ya se usó en ventas, solo se desactiva.", { ok: "Eliminar", danger: true }))) return; const r = await rpc("delete_promotion", { p_id: Number(el.dataset.id) }); PA.loaded = false; PP.list = null; rerender(); toast(r === "DESACTIVADA" ? "Desactivada (ya tenía ventas)" : "Eliminada", "ok"); },
    "pa-notify": async (el) => {
      const tags = window.DL_TAGS ? window.DL_TAGS.list().filter((x) => x.is_active !== false) : [];
      const v = await window.dlgPrompt(`¿A quién avisar? Escribe etiquetas separadas por coma${tags.length ? " (" + tags.map((x) => x.name).join(", ") + ")" : ""} o déjalo vacío para todos los clientes con cuenta. Se avisa como máximo una vez cada 6 horas.`, "", { title: "Avisar promoción", ok: "Enviar aviso" });
      if (v == null) return; const want = String(v).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      const ids = tags.filter((x) => want.includes(String(x.name).toLowerCase())).map((x) => Number(x.id));
      if (want.length && !ids.length) throw new Error("No encontré esas etiquetas.");
      const n = await rpc("notify_promotion", { p_promotion_id: Number(el.dataset.id), p_tag_ids: ids.length ? ids : null }); toast(`Aviso enviado a ${Number(n || 0)} clientes`, "ok");
    },
  });
  let tq = null; const prevInput = window.DL_INPUT;
  window.DL_INPUT = function (e) {
    const el = e.target;
    if (el && el.id === "pa-q") { PA.q = el.value; keep(el.closest("form")); clearTimeout(tq); tq = setTimeout(() => { rerender(); const i = document.getElementById("pa-q"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); return true; }
    if (el && el.classList && el.classList.contains("pa-qty")) { const it = PA.form && PA.form.items[el.dataset.id]; if (it) it.qty = Math.max(1, Math.min(10, Number(el.value) || 1)); return true; }
    return prevInput ? prevInput(e) : false;
  };
  document.addEventListener("change", (e) => { const el = e.target; if (PA.form && el && el.name === "kind" && el.closest('[data-form="pa-save"]')) { keep(el.closest("form")); PA.form.kind = el.value; rerender(); } });
  window.DL_SCREENS = Object.assign(window.DL_SCREENS || {}, { promociones: renderPromociones });
  window.DL_AFTER = (window.DL_AFTER || []).concat([decorate]);
})();
