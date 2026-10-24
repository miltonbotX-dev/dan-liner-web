// modules/gestion/v33.ficha.js · BD v18 (API_V18.md §1–3): ficha de producto, colección por evento, fecha de reposición,
// guía de tallas y su administración (Ficha web en Piezas, Telas, Cortes y medidas, Ocasiones). Estilos: «v33 · IU» en app.css.
(function () {
  const D = () => window.DL;
  const S = () => window.Store;
  const K = () => window.DL33;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const remote = () => S() && S().mode === "remote";
  const onHash = (re) => re.test(location.hash || "#coleccion");
  const VIEW = { FRENTE: "Frente", ESPALDA: "Espalda", DETALLE: "Detalle", TELA: "Tela", OTRA: "Otra" };
  const PIECE = { SACO: "Saco", PANTALON: "Pantalón", CHALECO: "Chaleco", CAMISA: "Camisa" };
  const CARE = {
    wash: ["Lavado", [["", "—"], ["SECO", "Lavado en seco"], ["MANO", "A mano"], ["MAQUINA_FRIO", "Máquina, agua fría"], ["NO_LAVAR", "No lavar"]]],
    iron: ["Planchado", [["", "—"], ["BAJA", "Temperatura baja"], ["MEDIA", "Temperatura media"], ["ALTA", "Temperatura alta"], ["NO", "No planchar"]]],
    dry: ["Secado", [["", "—"], ["TENDER_SOMBRA", "Tender a la sombra"], ["PLANO", "Secar en plano"], ["SECADORA_BAJA", "Secadora baja"], ["NO_SECADORA", "Sin secadora"]]],
    bleach: ["Blanqueador", [["", "—"], ["NO", "No usar"], ["SIN_CLORO", "Sin cloro"], ["SI", "Permitido"]]],
  };
  const keyLabel = (k) => { const t = String(k || "").replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
  const etaText = (d, note) => { if (!d || String(d).slice(0, 10) < K().todayLima()) return ""; return "Llega aprox. el " + K().fday(d) + (note ? " · " + note : ""); };

  // ---------- Catálogo público (get_catalog) en caché: ocasiones por producto y fechas de reposición ----------
  const CAT = { started: false, loaded: false, items: [], byProduct: {}, occ: [] };
  async function loadCatalog() {
    CAT.started = true;
    try {
      const all = []; let off = 0;
      for (let i = 0; i < 30; i += 1) { const r = await K().rpc("get_catalog", { p_limit: 100, p_offset: off }); const it = (r && r.items) || []; all.push(...it); off += it.length; if (!it.length || off >= Number((r && r.total) || 0)) break; }
      CAT.items = all; CAT.byProduct = {};
      all.forEach((x) => { (CAT.byProduct[String(x.product_id)] = CAT.byProduct[String(x.product_id)] || []).push(x); });
    } catch (e) { CAT.err = K().human(e); }
    try { CAT.occ = (await S().rest("v_public_occasions?select=id,code,name,icon,sort_order&order=sort_order")) || []; } catch { CAT.occ = []; }
    CAT.loaded = true; computeColorEta();
    if (onHash(/^#(coleccion|estilo|probador|pieza)/)) D().render();
  }
  // Probador: si el color existe en un producto → su fecha de reposición (get_catalog); si no hay producto de ese color → color_eta (Admin → Textos).
  const SUIT = ["Negro", "Azul marino", "Azul rey", "Gris oxford", "Gris claro", "Verde salvia", "Verde oliva", "Beige", "Camel", "Marrón", "Vino", "Blanco"];
  function computeColorEta() {
    const sf = S() && S().v2 && S().v2.storefront; if (!sf) return;
    const manual = sf.color_eta_manual || {}; const out = {}; const n = K().norm;
    const names = new Set(SUIT.concat(Object.keys(manual)));
    names.forEach((name) => {
      const full = n(name), first = full.split(" ")[0];
      let hits = CAT.items.filter((x) => n(x.color).includes(full));
      if (!hits.length) hits = CAT.items.filter((x) => n(x.color).includes(first));
      if (hits.length) {
        const dates = [];
        hits.forEach((x) => { if (x.restock_eta) dates.push([x.restock_eta, x.restock_note]); (x.sizes || []).forEach((z) => { if (z.restock_eta) dates.push([z.restock_eta, z.restock_note]); }); });
        const ok = dates.filter(([d]) => String(d).slice(0, 10) >= K().todayLima()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        if (ok.length) out[name] = etaText(ok[0][0], ok[0][1]);
      } else {
        const mk = Object.keys(manual).find((k) => n(k) === full); if (mk && manual[mk]) out[name] = manual[mk];
      }
    });
    sf.color_eta = out;
  }
  window.DL_COLOR_ETA_REFRESH = computeColorEta;

  // ---------- Colección por evento: #coleccion/evento/<código> ----------
  const activeOcc = () => { const m = /^#coleccion\/evento\/([^/?#]+)/.exec(location.hash || ""); return m ? decodeURIComponent(m[1]).toUpperCase() : ""; };
  const occOf = (p) => { const own = Array.isArray(p.occasions) ? p.occasions : []; const c = (CAT.byProduct[String(p.product_id)] || []).flatMap((x) => x.occasions || []); return new Set(own.concat(c).map((x) => String(typeof x === "object" && x ? x.code : x).toUpperCase())); };
  window.DL_OCC_ACTIVE = activeOcc;
  window.DL_OCC_FILTER = (p) => { const a = activeOcc(); return !a || occOf(p).has(a); };
  window.DL_EVENT_RAIL = () => {
    if (!CAT.loaded || !CAT.occ.length || !D().productGroups) return "";
    const groups = D().productGroups(D().visibleProducts()); const a = activeOcc();
    const cards = CAT.occ.map((o) => {
      const gs = groups.filter((g) => g.vars.some((v) => occOf(v).has(String(o.code).toUpperCase())));
      const img = gs.length ? (D().groupImages(gs[0].vars) || []).filter(Boolean)[0] : "";
      return { o, n: gs.length, img: img ? D().safeSrc(img) : "" };
    }).filter((c) => c.n || c.o.code === a);
    if (!cards.length) return "";
    return `<nav class="event-rail" aria-label="Colección por ocasión">${cards.map(({ o, n, img }) => { const on = String(o.code).toUpperCase() === a;
      return `<a class="event-card ${on ? "on" : ""}" href="${on ? "#coleccion" : "#coleccion/evento/" + encodeURIComponent(String(o.code).toLowerCase())}" ${on ? 'aria-current="true"' : ""}${img ? ` style="--img:${esc(K().cssUrl(img))}"` : ""}><b>${esc(o.name)}</b><span>${n} ${n === 1 ? "pieza" : "piezas"}</span></a>`; }).join("")}</nav>`;
  };
  window.addEventListener("hashchange", () => { if (/^#coleccion\/evento\//.test(location.hash)) window.scrollTo(0, 0); });

  // ---------- Ficha de producto (get_product_detail) ----------
  const PD = {}; // product_id → { loaded, data, err }
  const SG = { piece: "" };
  function detail(pid) {
    const box = PD[pid] || (PD[pid] = { loaded: false });
    if (!box.loaded && !K().busy["pd" + pid] && remote()) setTimeout(() => K().once("pd" + pid, () => K().rpc("get_product_detail", { p_product_id: Number(pid) }), box, () => { if (onHash(/^#pieza\//)) D().render(); }), 0);
    return box.data || null;
  }
  function colorOf(d, v) { const cs = (d && d.colors) || []; return cs.find((c) => (c.sizes || []).some((z) => String(z.variant_id) === String(v.id))) || cs.find((c) => K().norm(c.color) === K().norm(v.color)) || null; }
  function etaOf(x) {
    const d = x.product_id && PD[x.product_id] && PD[x.product_id].data;
    const c = d && colorOf(d, x); const z = c && (c.sizes || []).find((s) => String(s.variant_id) === String(x.id));
    if (z && z.restock_eta) return etaText(z.restock_eta, z.restock_note);
    const it = (CAT.byProduct[String(x.product_id)] || []).flatMap((g) => g.sizes || []).find((s) => String(s.variant_id) === String(x.id));
    if (it && it.restock_eta) return etaText(it.restock_eta, it.restock_note);
    return etaText(x.restock_eta, x.restock_note);
  }
  function galleryHtml(v, c) {
    if (!c || !c.images) return "";
    const list = []; ["FRENTE", "ESPALDA", "DETALLE", "TELA", "OTRA"].forEach((k) => (c.images[k] || []).forEach((u) => list.push([k, u])));
    if (!list.length) return "";
    (c.legacy_images || []).forEach((u) => { if (!list.some(([, x]) => x === u)) list.push(["", u]); });
    return list.map(([k, u], i) => `<figure><img decoding="async" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} width="800" height="1000" data-view="${esc(VIEW[k] || "")}" alt="${esc(v.name)}${v.color ? " " + esc(v.color) : ""}${k ? " · " + esc(VIEW[k]) : ""}, foto ${i + 1} de ${list.length}" src="${esc(D().safeSrc(u))}">${k && k !== "OTRA" ? `<figcaption>${esc(VIEW[k])}</figcaption>` : ""}</figure>`).join("");
  }
  function extraHtml(d) {
    const out = [];
    const f = d.fabric || {};
    if (f.swatch_image_url) { const u = D().safeSrc(f.swatch_image_url); out.push(`<p><button type="button" class="fabric-swatch" data-zoom="${esc(u)}" style="--img:${esc(K().cssUrl(u))}" aria-label="Tela ${esc(f.name || "")} ampliada">Tela${f.name ? " " + esc(f.name) : ""} · ver de cerca</button></p>`); }
    const rows = [["Corte", d.cut && d.cut.name], ["Incluye", (d.pieces || []).map((p) => PIECE[p.piece || p] || p.piece || p).join(" + ")], ["Forro", d.lining || f.lining]].filter(([, x]) => x);
    if (rows.length) out.push(`<dl class="pdp-spec">${rows.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join("")}</dl>`);
    const care = d.care || {}; const li = ["wash_label", "iron_label", "dry_label", "bleach_label"].map((k) => care[k]).filter(Boolean);
    if (care.notes) li.push(care.notes);
    if (li.length) out.push(`<div><span class="tiny">Cuidado</span><ul class="care-list">${li.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`);
    if ((d.occasions || []).length) out.push(`<p class="tiny">Ideal para: ${(d.occasions || []).map((o) => `<a class="support-link" href="#coleccion/evento/${esc(encodeURIComponent(String(o.code).toLowerCase()))}">${esc(o.name)}</a>`).join(" · ")}</p>`);
    return out.join("");
  }
  function guideHtml(d, v) {
    const m = d.measurements; const pieces = (m && m.pieces || []).filter((p) => (p.sizes || []).length && (p.keys || []).length);
    if (!pieces.length) return "";
    if (!pieces.some((p) => p.piece === SG.piece)) SG.piece = pieces[0].piece;
    const p = pieces.find((x) => x.piece === SG.piece); const mine = K().norm(v.size_label);
    return `<div class="size-guide">
      ${pieces.length > 1 ? `<div class="sg-tabs" role="tablist">${pieces.map((x) => `<button type="button" role="tab" class="${x.piece === SG.piece ? "on" : ""}" aria-selected="${x.piece === SG.piece}" data-act="sg-tab" data-id="${esc(x.piece)}">${esc(PIECE[x.piece] || x.piece)}</button>`).join("")}</div>` : `<b>${esc(PIECE[p.piece] || p.piece)}</b>`}
      <div class="sg-wrap"><table class="sg-table"><thead><tr><th scope="col">Talla</th>${p.keys.map((k) => `<th scope="col">${esc(keyLabel(k))}</th>`).join("")}</tr></thead>
        <tbody>${p.sizes.map((z) => `<tr class="${K().norm(z.size) === mine ? "is-mine" : ""}"><th scope="row">${esc(z.size)}</th>${p.keys.map((k) => `<td>${z.values && z.values[k] != null ? esc(z.values[k]) : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="sg-cut">${m.cut && m.cut.name ? "Corte " + esc(m.cut.name) + " · " : ""}medidas de la prenda en cm${v.size_label ? " · tu talla elegida está resaltada" : ""}.</p></div>`;
  }
  window.DL_PDP18 = {
    etaOf,
    get(v) {
      if (!v || !v.product_id) return null; const d = detail(String(v.product_id)); if (!d) return null;
      return { gallery: galleryHtml(v, colorOf(d, v)), extra: extraHtml(d), guide: guideHtml(d, v), data: d };
    },
  };

  // ---------- Admin: Ficha web dentro de Piezas (DL_SPEC_FIELDS) ----------
  const FX = {}; // product_id:color_id → { loaded, data, draft, err, msg }
  const ADM = { cuts: null, occ: null, fabrics: null, err: "" };
  async function admLists() {
    const [cuts, occ] = await Promise.all([S().rest("fit_cuts?select=id,code,name,description,sort_order,is_active&order=sort_order,id"), S().rest("occasions?select=id,code,name,icon,sort_order,is_active&order=sort_order,id")]);
    ADM.cuts = cuts || []; ADM.occ = occ || []; ADM.err = "";
  }
  async function loadSheet(pid, cid) {
    if (!ADM.cuts) await admLists();
    const [p, pcs, po, imgs, vars] = await Promise.all([
      S().rest("products?select=id,slug,lining,care_wash,care_iron,care_dry,care_bleach,care_notes,cut_id&id=eq." + Number(pid)),
      S().rest("product_pieces?select=piece,sort_order&product_id=eq." + Number(pid) + "&order=sort_order"),
      S().rest("product_occasions?select=occasion_id&product_id=eq." + Number(pid)),
      cid ? S().rest("product_color_images?select=view,url,sort_order&product_id=eq." + Number(pid) + "&color_id=eq." + Number(cid) + "&order=sort_order") : Promise.resolve([]),
      S().rest("product_variants?select=id,restock_eta,restock_note,size_id,color_id&product_id=eq." + Number(pid) + (cid ? "&color_id=eq." + Number(cid) : "")),
    ]);
    const r = (p || [])[0] || {};
    const by = {}; (imgs || []).forEach((x) => { (by[x.view] = by[x.view] || []).push(x.url); });
    const eta = (vars || []).find((x) => x.restock_eta) || {};
    return { cut_id: r.cut_id ? String(r.cut_id) : "", slug: r.slug || "", lining: r.lining || "", care: { wash: r.care_wash || "", iron: r.care_iron || "", dry: r.care_dry || "", bleach: r.care_bleach || "", notes: r.care_notes || "" },
      pieces: (pcs || []).map((x) => x.piece), occ: (po || []).map((x) => String(x.occasion_id)), views: Object.fromEntries(Object.keys(VIEW).map((k) => [k, (by[k] || []).join("\n")])),
      eta: eta.restock_eta || "", eta_note: eta.restock_note || "", eta_size: "", vars: vars || [] };
  }
  const sel = (id, opts, cur, attrs) => `<select data-f33="${id}" ${attrs || ""}>${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(cur || "") === String(k) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const prevSpec = window.DL_SPEC_FIELDS;
  window.DL_SPEC_FIELDS = (P) => {
    const base = prevSpec ? prevSpec(P) : "";
    if (!remote() || !P || !P.product_id) return base;
    const key = P.product_id + ":" + (P.color_id || ""); const box = FX[key] || (FX[key] = { loaded: false });
    if (!box.loaded && !K().busy["fx" + key]) setTimeout(() => K().once("fx" + key, () => loadSheet(P.product_id, P.color_id), box, () => { if (box.data) box.draft = JSON.parse(JSON.stringify(box.data)); D().render(); }), 0);
    if (!box.draft) return base + `<fieldset class="photo-box f33-box"><legend>Ficha web</legend><p class="tiny">${box.err ? esc(box.err) : "Cargando…"}</p></fieldset>`;
    const d = box.draft; const sizes = (P.sizes || []).filter((z) => z.variant_id);
    return base + `<fieldset class="photo-box f33-box" data-fx="${esc(key)}"><legend>Ficha web: corte, piezas, cuidado y ocasiones</legend>
      ${box.err ? `<p class="alert-text" role="alert">${esc(box.err)}</p>` : ""}${box.msg ? `<p class="tiny ok">${esc(box.msg)}</p>` : ""}
      <div class="two"><label>Corte (guía de tallas)${sel("cut_id", [["", "Sin corte"]].concat((ADM.cuts || []).filter((c) => c.is_active !== false || String(c.id) === d.cut_id).map((c) => [String(c.id), c.name])), d.cut_id)}</label>
        <label>Enlace (slug)<input data-f33="slug" maxlength="80" value="${esc(d.slug)}" placeholder="se crea solo"></label></div>
      <div class="checks-row"><span class="tiny">Piezas que incluye:</span> ${Object.keys(PIECE).map((k) => `<label class="checks"><input type="checkbox" data-f33="piece" value="${k}" ${d.pieces.includes(k) ? "checked" : ""}> ${PIECE[k]}</label>`).join(" ")}</div>
      <label>Forro<input data-f33="lining" maxlength="200" value="${esc(d.lining)}" placeholder="Vacío = el de la tela"></label>
      <div class="two">${Object.entries(CARE).map(([k, [l, o]]) => `<label>${l}${sel("care." + k, o, d.care[k])}</label>`).join("")}</div>
      <label>Nota de cuidado<input data-f33="care.notes" maxlength="200" value="${esc(d.care.notes)}"></label>
      <div class="checks-row"><span class="tiny">Ocasiones:</span> ${(ADM.occ || []).filter((o) => o.is_active !== false).map((o) => `<label class="checks"><input type="checkbox" data-f33="occ" value="${esc(o.id)}" ${d.occ.includes(String(o.id)) ? "checked" : ""}> ${esc(o.name)}</label>`).join(" ") || `<span class="tiny">Crea ocasiones en Productos → Ocasiones.</span>`}</div>
      <button class="btn small" type="button" data-act="fx-save" data-id="${esc(key)}">Guardar ficha web</button>
      ${P.color_id ? `<details class="vr-more"><summary class="tiny">Fotos de este color por vista (enlaces de Drive, uno por línea)</summary>
        ${Object.keys(VIEW).map((k) => `<label class="tiny">${VIEW[k]}<textarea data-f33="view.${k}" rows="2" placeholder="https://drive.google.com/…">${esc(d.views[k])}</textarea></label>`).join("")}
        <button class="btn small ghost" type="button" data-act="fx-photos" data-id="${esc(key)}">Guardar fotos del color</button></details>
      <details class="vr-more"><summary class="tiny">Fecha aproximada de reposición${d.eta ? " · " + esc(K().fday(d.eta)) : ""}</summary>
        <div class="two"><label class="tiny">Talla${sel("eta_size", [["", "Todas las tallas de este color"]].concat(sizes.map((z) => [z.size_label, z.size_label])), d.eta_size)}</label>
          <label class="tiny">Fecha (vacío = quitar)<input type="date" data-f33="eta" min="${K().todayLima()}" value="${esc(String(d.eta || "").slice(0, 10))}"></label></div>
        <label class="tiny">Nota (opcional)<input data-f33="eta_note" maxlength="120" value="${esc(d.eta_note)}" placeholder="Ej. llega de fábrica"></label>
        <button class="btn small ghost" type="button" data-act="fx-eta" data-id="${esc(key)}">Guardar reposición</button></details>` : ""}
    </fieldset>`;
  };
  function readFx(el) {
    const fs = el.closest("[data-fx]"); const box = fs && FX[fs.dataset.fx]; if (!box || !box.draft) return null; const d = box.draft;
    fs.querySelectorAll("[data-f33]").forEach((i) => {
      const k = i.dataset.f33;
      if (k === "piece" || k === "occ") return;
      if (k.startsWith("care.")) d.care[k.slice(5)] = i.value; else if (k.startsWith("view.")) d.views[k.slice(5)] = i.value; else d[k] = i.value;
    });
    d.pieces = [...fs.querySelectorAll('[data-f33="piece"]:checked')].map((i) => i.value);
    d.occ = [...fs.querySelectorAll('[data-f33="occ"]:checked')].map((i) => i.value);
    return box;
  }
  document.addEventListener("input", (e) => { if (e.target && e.target.dataset && e.target.dataset.f33) readFx(e.target); }, true);
  document.addEventListener("change", (e) => { if (e.target && e.target.dataset && e.target.dataset.f33) readFx(e.target); }, true);
  async function fxRun(el, fn, ok) {
    const box = readFx(el); if (!box) return; const [pid, cid] = el.dataset.id.split(":"); box.err = ""; box.msg = "";
    el.disabled = true;
    try { await fn(box.draft, Number(pid), Number(cid)); box.msg = ok; box.data = JSON.parse(JSON.stringify(box.draft)); CAT.started = false; Object.keys(PD).forEach((k) => delete PD[k]); }
    catch (e) { box.err = K().human(e); }
    D().render();
  }

  // ---------- Admin: Telas (fotos de la tela, composición, forro y cuidado) — se agrega debajo de Productos → Telas ----------
  const TL = { loaded: false, data: null, err: "", draft: {}, msg: "" };
  function telasHtml() {
    if (!TL.loaded && !K().busy.tl) setTimeout(() => K().once("tl", () => S().rest("fabrics?select=id,code,name,is_active,composition,description,swatch_image_url,lining,care_wash,care_iron,care_dry,care_bleach,care_notes&order=name"), TL, mountTelas), 0);
    const list = TL.data || [];
    return `<h3 style="margin:0">Ficha de cada tela (se ve en la web)</h3>
      <p class="tiny muted" style="margin:0">Foto “lupa” de la tela: enlace de Google Drive (Compartir → “Cualquier persona con el enlace”). Lo que la pieza no tenga propio (forro, cuidado) lo hereda de su tela.</p>
      ${TL.err ? `<p class="alert-text">${esc(TL.err)}</p>` : ""}${TL.msg ? `<p class="tiny ok">${esc(TL.msg)}</p>` : ""}
      ${!TL.loaded ? `<p class="tiny">Cargando…</p>` : list.length ? list.map((f) => { const d = TL.draft[f.id] || f; const sw = d.swatch_image_url ? D().safeSrc(d.swatch_image_url) : "";
        return `<details class="panel stack fabric-row" data-tl="${esc(f.id)}"><summary><b>${esc(f.name)}</b> <span class="tiny">${esc(f.code || "")}${f.is_active === false ? " · inactiva" : ""}${f.swatch_image_url ? " · con foto" : " · sin foto"}</span></summary>
          <div class="row" style="justify-content:flex-start;gap:10px;align-items:flex-end">${sw ? `<button type="button" class="fabric-swatch" data-zoom="${esc(sw)}" style="--img:${esc(K().cssUrl(sw))}" aria-label="Tela ${esc(f.name)}">Ver</button>` : ""}
            <label class="grow">Foto de la tela (Drive)<input data-tlf="swatch_image_url" type="url" maxlength="500" value="${esc(d.swatch_image_url || "")}" placeholder="https://drive.google.com/…"></label></div>
          <div class="two"><label>Composición<input data-tlf="composition" maxlength="300" value="${esc(d.composition || "")}" placeholder="Ej. 70% lana, 30% poliéster"></label><label>Forro<input data-tlf="lining" maxlength="200" value="${esc(d.lining || "")}"></label></div>
          <label>Descripción<input data-tlf="description" maxlength="500" value="${esc(d.description || "")}"></label>
          <div class="two">${Object.entries(CARE).map(([k, [l, o]]) => `<label>${l}<select data-tlf="care_${k}">${o.map(([c, t]) => `<option value="${c}" ${String(d["care_" + k] || "") === c ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`).join("")}</div>
          <label>Nota de cuidado<input data-tlf="care_notes" maxlength="200" value="${esc(d.care_notes || "")}"></label>
          <button class="btn small" type="button" data-act="tl-save" data-id="${esc(f.id)}">Guardar tela</button></details>`; }).join("") : `<p class="tiny muted">Aún no hay telas.</p>`}`;
  }
  function mountTelas() {
    const d = D(); if (!d || !remote() || !d.allow(["SUPERVISOR", "ALMACENERO"])) return;
    if (!(/^#admin\/fabrics\b/.test(location.hash) || (d.ui && d.ui.admin === "fabrics" && /^#admin\b/.test(location.hash)))) return;
    const view = document.getElementById("view") || document.querySelector("main"); if (!view) return;
    let box = view.querySelector(".tl33"); if (!box) { box = document.createElement("section"); box.className = "panel stack tl33"; box.style.marginTop = "16px"; (view.querySelector("section") || view).appendChild(box); }
    const open = [...box.querySelectorAll("details[open][data-tl]")].map((x) => x.dataset.tl);
    box.innerHTML = telasHtml(); open.forEach((id) => { const x = box.querySelector(`details[data-tl="${id}"]`); if (x) x.open = true; });
  }
  document.addEventListener("input", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.tlf) return; const id = t.closest("[data-tl]").dataset.tl; const f = (TL.data || []).find((x) => String(x.id) === id) || {}; (TL.draft[id] = TL.draft[id] || Object.assign({}, f))[t.dataset.tlf] = t.value; }, true);
  document.addEventListener("change", (e) => { const t = e.target; if (!t || !t.dataset || !t.dataset.tlf) return; const id = t.closest("[data-tl]").dataset.tl; const f = (TL.data || []).find((x) => String(x.id) === id) || {}; (TL.draft[id] = TL.draft[id] || Object.assign({}, f))[t.dataset.tlf] = t.value; }, true);

  // ---------- Admin: Cortes y medidas ----------
  const CM = { cut: "", piece: "SACO", loaded: false, data: null, err: "", msg: "", grid: {}, keys: {}, edit: null };
  const DEF_KEYS = { SACO: ["pecho", "cintura", "hombro", "manga", "largo"], PANTALON: ["cintura", "cadera", "tiro", "largo", "basta"], CHALECO: ["pecho", "cintura", "largo"], CAMISA: ["cuello", "pecho", "manga", "largo"] };
  function cmLoad() {
    CM.loaded = false; CM.grid = {}; CM.keys = {};
    K().once("cm" + CM.cut, () => K().rpc("get_cut_measurements", { p_cut_id: Number(CM.cut) }), CM, () => {
      ((CM.data && CM.data.rows) || []).forEach((r) => { (CM.grid[r.piece] = CM.grid[r.piece] || {})[r.size + "|" + r.measure_key] = String(r.value_cm); const ks = CM.keys[r.piece] = CM.keys[r.piece] || []; if (!ks.includes(r.measure_key)) ks.push(r.measure_key); });
      D().render();
    });
  }
  function renderCortes() {
    if (!remote()) return `<p class="muted">Disponible con la base de datos conectada.</p>`;
    if (!ADM.cuts) { if (ADM.err) return `<p class="alert-text">${esc(ADM.err)}</p><button class="btn small ghost" type="button" data-act="adm33-retry">Reintentar</button>`; if (!K().busy.adm) { K().busy.adm = true; admLists().catch((e) => { ADM.err = K().human(e); }).then(() => { K().busy.adm = false; D().render(); }); } return `<p class="tiny">Cargando…</p>`; }
    const cuts = ADM.cuts; if (!CM.cut && cuts[0]) { CM.cut = String(cuts[0].id); }
    if (CM.cut && !CM.loaded && !K().busy["cm" + CM.cut]) setTimeout(cmLoad, 0);
    const sizes = (D().state.data.sizes || []).filter((z) => z.is_active !== false).slice().sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    const keys = CM.keys[CM.piece] && CM.keys[CM.piece].length ? CM.keys[CM.piece] : (CM.keys[CM.piece] = DEF_KEYS[CM.piece].slice());
    const g = CM.grid[CM.piece] || {}; const e = CM.edit;
    return `<section class="stack">
      <div class="panel stack"><h3 style="margin:0">Cortes</h3><p class="tiny muted" style="margin:0">Cada pieza de la colección usa un corte; la web muestra su guía de tallas.</p>
        ${CM.err ? `<p class="alert-text" role="alert">${esc(CM.err)}</p>` : ""}${CM.msg ? `<p class="tiny ok">${esc(CM.msg)}</p>` : ""}
        <div class="row" style="flex-wrap:wrap;justify-content:flex-start">${cuts.map((c) => `<button type="button" class="chip ${String(c.id) === CM.cut ? "on" : ""}" data-act="cm-cut" data-id="${esc(c.id)}">${esc(c.name)}${c.is_active === false ? " (inactivo)" : ""}</button>`).join("")}<button type="button" class="chip" data-act="cm-new">+ Nuevo corte</button></div>
        ${e ? `<form novalidate class="stack" onsubmit="return false"><div class="two"><label>Nombre<input id="cm-name" maxlength="60" value="${esc(e.name || "")}"></label><label>Código<input id="cm-code" maxlength="30" value="${esc(e.code || "")}" placeholder="Ej. SLIM" autocapitalize="characters"></label></div>
          <label>Descripción<input id="cm-desc" maxlength="300" value="${esc(e.description || "")}"></label>
          <div class="two"><label>Orden<input id="cm-sort" type="number" value="${esc(e.sort_order == null ? "" : e.sort_order)}"></label><label class="checks"><input id="cm-active" type="checkbox" ${e.is_active !== false ? "checked" : ""}> Activo</label></div>
          <div class="row" style="justify-content:flex-start"><button class="btn small" type="button" data-act="cm-save-cut">Guardar corte</button>${e.id ? `<button class="btn ghost small" type="button" data-act="cm-del-cut" data-id="${esc(e.id)}">Eliminar</button>` : ""}<button class="btn ghost small" type="button" data-act="cm-x">Cancelar</button></div></form>`
          : CM.cut ? `<button class="link-btn" type="button" data-act="cm-edit">Editar este corte</button>` : ""}
      </div>
      ${CM.cut ? `<div class="panel stack"><h3 style="margin:0">Medidas en cm · ${esc((cuts.find((c) => String(c.id) === CM.cut) || {}).name || "")}</h3>
        <div class="sg-tabs size-guide" role="tablist" style="display:flex">${Object.keys(PIECE).map((p) => `<button type="button" class="${p === CM.piece ? "on" : ""}" data-act="cm-piece" data-id="${p}">${PIECE[p]}</button>`).join("")}</div>
        ${!CM.loaded ? `<p class="tiny">Cargando…</p>` : `<div class="sg-wrap"><table class="sg-table cm-grid"><thead><tr><th>Talla</th>${keys.map((k) => `<th>${esc(keyLabel(k))} <button type="button" class="link-btn tiny" data-act="cm-key-del" data-id="${esc(k)}" aria-label="Quitar ${esc(k)}">×</button></th>`).join("")}</tr></thead>
          <tbody>${sizes.map((z) => `<tr><th>${esc(z.label || z.code)}</th>${keys.map((k) => `<td><input class="cm-cell" inputmode="decimal" style="width:64px" data-cm="${esc((z.code || z.label) + "|" + k)}" value="${esc(g[(z.code || z.label) + "|" + k] || "")}" aria-label="${esc(keyLabel(k))} talla ${esc(z.label || z.code)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>
          <div class="row" style="justify-content:flex-start;flex-wrap:wrap"><input id="cm-newkey" placeholder="Nueva medida (ej. largo_manga)" maxlength="30" style="max-width:220px"><button class="btn ghost small" type="button" data-act="cm-key-add">Agregar medida</button></div>
          <p class="tiny muted">Vacía una celda para borrar esa medida. Claves en minúscula, sin tildes (a-z y _).</p>
          <button class="btn small" type="button" data-act="cm-save">Guardar medidas de ${esc(PIECE[CM.piece])}</button>`}</div>` : ""}
    </section>`;
  }
  document.addEventListener("input", (e) => { const t = e.target; if (t && t.dataset && t.dataset.cm) (CM.grid[CM.piece] = CM.grid[CM.piece] || {})[t.dataset.cm] = t.value.trim(); }, true);

  // ---------- Admin: Ocasiones ----------
  const OC = { edit: null, err: "", msg: "" };
  function renderOcasiones() {
    if (!remote()) return `<p class="muted">Disponible con la base de datos conectada.</p>`;
    if (!ADM.occ) { if (ADM.err) return `<p class="alert-text">${esc(ADM.err)}</p><button class="btn small ghost" type="button" data-act="adm33-retry">Reintentar</button>`; if (!K().busy.adm) { K().busy.adm = true; admLists().catch((e) => { ADM.err = K().human(e); }).then(() => { K().busy.adm = false; D().render(); }); } return `<p class="tiny">Cargando…</p>`; }
    const e = OC.edit;
    return `<section class="panel stack"><h3 style="margin:0">Ocasiones (colección por evento)</h3><p class="tiny muted" style="margin:0">Aparecen como tarjetas en la Colección (#coleccion/evento/…). Asígnalas a cada pieza en Piezas → Ficha web.</p>
      ${OC.err ? `<p class="alert-text" role="alert">${esc(OC.err)}</p>` : ""}${OC.msg ? `<p class="tiny ok">${esc(OC.msg)}</p>` : ""}
      <div class="stack">${ADM.occ.map((o) => `<div class="row"><span><b>${esc(o.name)}</b> <span class="tiny">${esc(o.code)} · orden ${esc(o.sort_order)}${o.is_active === false ? " · inactiva" : ""}</span></span><button class="link-btn" type="button" data-act="oc-edit" data-id="${esc(o.id)}">Editar</button></div>`).join("")}</div>
      ${e ? `<form novalidate class="stack" onsubmit="return false"><div class="two"><label>Nombre<input id="oc-name" maxlength="60" value="${esc(e.name || "")}"></label><label>Código<input id="oc-code" maxlength="30" value="${esc(e.code || "")}" autocapitalize="characters" placeholder="Ej. BODA"></label></div>
        <div class="two"><label>Ícono (opcional)<input id="oc-icon" maxlength="40" value="${esc(e.icon || "")}"></label><label>Orden<input id="oc-sort" type="number" value="${esc(e.sort_order == null ? "" : e.sort_order)}"></label></div>
        <label class="checks"><input id="oc-active" type="checkbox" ${e.is_active !== false ? "checked" : ""}> Activa</label>
        <div class="row" style="justify-content:flex-start"><button class="btn small" type="button" data-act="oc-save">Guardar</button>${e.id ? `<button class="btn ghost small" type="button" data-act="oc-del" data-id="${esc(e.id)}">Eliminar</button>` : ""}<button class="btn ghost small" type="button" data-act="oc-x">Cancelar</button></div></form>`
        : `<button class="btn small ghost" type="button" data-act="oc-new">+ Nueva ocasión</button>`}</section>`;
  }
  const val = (id) => { const x = document.getElementById(id); return x ? (x.type === "checkbox" ? x.checked : x.value.trim()) : null; };

  window.DL_ADMIN_TABS = (window.DL_ADMIN_TABS || []).concat([
    { id: "cortes", label: "Cortes y medidas", need: ["SUPERVISOR", "ALMACENERO", "SASTRE"], render: renderCortes }, // v34: el sastre carga medidas
    { id: "ocasiones", label: "Ocasiones", need: ["SUPERVISOR", "ALMACENERO"], render: renderOcasiones },
  ]);
  window.DL_AFTER = (window.DL_AFTER || []).concat([() => { if (remote() && !CAT.started) loadCatalog(); }, mountTelas]);

  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "adm33-retry": () => { ADM.err = ""; D().render(); },
    "sg-tab": (el) => { SG.piece = el.dataset.id; D().render(); },
    "fx-save": (el) => fxRun(el, async (d, pid) => {
      if (d.slug && !/^[a-z0-9-]{3,80}$/.test(d.slug)) throw new Error("El enlace solo usa minúsculas, números y guiones (mín. 3).");
      await K().rpc("set_product_sheet", { p_product_id: pid, p_cut_id: d.cut_id ? Number(d.cut_id) : 0, p_pieces: d.pieces, p_lining: d.lining, p_care: d.care, p_slug: d.slug || null });
      await K().rpc("set_product_occasions", { p_product_id: pid, p_occasion_ids: d.occ.map(Number) });
    }, "Ficha web guardada."),
    "fx-photos": (el) => fxRun(el, async (d, pid, cid) => {
      const imgs = []; Object.keys(VIEW).forEach((k) => String(d.views[k] || "").split(/\s+/).filter(Boolean).forEach((url) => imgs.push({ view: k, url, sort: imgs.length })));
      if (imgs.length > 20) throw new Error("Máximo 20 fotos por color.");
      await K().rpc("set_product_color_images", { p_product_id: pid, p_color_id: cid, p_images: imgs });
    }, "Fotos del color guardadas."),
    "fx-eta": (el) => fxRun(el, async (d, pid, cid) => {
      await K().rpc("set_restock_eta", { p_product_id: pid, p_color_id: cid, p_size: d.eta_size || null, p_date: d.eta || null, p_note: d.eta_note || null });
    }, "Reposición guardada."),
    "tl-save": async (el) => {
      const id = el.dataset.id; const f = (TL.data || []).find((x) => String(x.id) === id) || {}; const d = TL.draft[id] || f; TL.err = ""; TL.msg = "";
      const care = {}; ["wash", "iron", "dry", "bleach"].forEach((k) => { if ((d["care_" + k] || "") !== (f["care_" + k] || "")) care[k] = d["care_" + k] || ""; }); if ((d.care_notes || "") !== (f.care_notes || "")) care.notes = d.care_notes || "";
      try {
        await K().rpc("upsert_fabric", { p_id: Number(id), p_swatch_image_url: d.swatch_image_url || "", p_composition: d.composition || "", p_lining: d.lining || "", p_description: d.description || "", p_care: Object.keys(care).length ? care : null });
        TL.msg = "Tela «" + (f.name || "") + "» guardada."; delete TL.draft[id]; TL.loaded = false; CAT.started = false; Object.keys(PD).forEach((k) => delete PD[k]);
      } catch (e) { TL.err = K().human(e); }
      mountTelas();
    },
    "cm-cut": (el) => { CM.cut = el.dataset.id; CM.loaded = false; CM.edit = null; CM.msg = ""; D().render(); },
    "cm-piece": (el) => { CM.piece = el.dataset.id; D().render(); },
    "cm-new": () => { CM.edit = { is_active: true }; D().render(); },
    "cm-edit": () => { CM.edit = Object.assign({}, (ADM.cuts || []).find((c) => String(c.id) === CM.cut)); D().render(); },
    "cm-x": () => { CM.edit = null; D().render(); },
    "cm-save-cut": async () => {
      const e = CM.edit || {}; CM.err = ""; CM.msg = "";
      try {
        const r = await K().rpc("upsert_fit_cut", { p_id: e.id ? Number(e.id) : null, p_name: val("cm-name"), p_description: val("cm-desc"), p_is_active: val("cm-active"), p_code: val("cm-code") || null, p_sort_order: val("cm-sort") === "" ? null : Number(val("cm-sort")) });
        await admLists(); const nid = r && (r.id || r.cut_id || (typeof r === "number" ? r : null)); if (nid) CM.cut = String(nid); CM.edit = null; CM.loaded = false; CM.msg = "Corte guardado.";
      } catch (err) { CM.err = K().human(err); }
      D().render();
    },
    "cm-del-cut": async (el) => {
      if (!(await window.dlgConfirm("¿Eliminar este corte? Si alguna pieza lo usa, solo se desactiva."))) return;
      try { await K().rpc("delete_fit_cut", { p_id: Number(el.dataset.id) }); await admLists(); CM.cut = ""; CM.edit = null; CM.loaded = false; CM.msg = "Corte eliminado o desactivado."; } catch (err) { CM.err = K().human(err); }
      D().render();
    },
    "cm-key-add": () => { const k = String(val("cm-newkey") || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_"); if (!/^[a-z_]{2,30}$/.test(k)) { D().toast("Medida: 2 a 30 letras minúsculas o _.", "error"); return; } const ks = CM.keys[CM.piece] = CM.keys[CM.piece] || []; if (!ks.includes(k)) ks.push(k); D().render(); },
    "cm-key-del": (el) => { const k = el.dataset.id; const g = CM.grid[CM.piece] = CM.grid[CM.piece] || {}; Object.keys(g).forEach((x) => { if (x.endsWith("|" + k)) g[x] = ""; }); CM.keys[CM.piece] = (CM.keys[CM.piece] || []).filter((x) => x !== k); CM.dropped = (CM.dropped || []).concat([[CM.piece, k]]); D().render(); D().toast("Pulsa «Guardar medidas» para borrarla.", "ok"); },
    "cm-save": async () => {
      CM.err = ""; CM.msg = ""; const piece = CM.piece; const g = CM.grid[piece] || {}; const orig = {};
      ((CM.data && CM.data.rows) || []).forEach((r) => { if (r.piece === piece) orig[r.size + "|" + r.measure_key] = String(r.value_cm); });
      const rows = []; const keys = new Set(Object.keys(g).concat(Object.keys(orig)));
      for (const k of keys) {
        const [size, mk] = k.split("|"); const v = String(g[k] == null ? orig[k] : g[k]).replace(",", ".").trim(); const was = orig[k];
        if (v === "" && was == null) continue; if (was != null && v !== "" && Number(v) === Number(was)) continue;
        if (v !== "" && !(Number(v) >= 0 && Number(v) <= 300)) { CM.err = `Talla ${size}, ${keyLabel(mk)}: usa un número de 0 a 300.`; D().render(); return; }
        rows.push({ size, piece, measure_key: mk, value_cm: v === "" ? null : Number(v) });
      }
      if (!rows.length) { CM.msg = "No hay cambios."; D().render(); return; }
      try { const r = await K().rpc("set_cut_measurements", { p_cut_id: Number(CM.cut), p_rows: rows }); CM.msg = `Medidas guardadas (${(r && r.saved) || 0} guardadas, ${(r && r.deleted) || 0} borradas).`; Object.keys(PD).forEach((k) => delete PD[k]); cmLoad(); }
      catch (err) { CM.err = K().human(err); D().render(); }
    },
    "oc-new": () => { OC.edit = { is_active: true }; D().render(); },
    "oc-edit": (el) => { OC.edit = Object.assign({}, (ADM.occ || []).find((o) => String(o.id) === el.dataset.id)); D().render(); },
    "oc-x": () => { OC.edit = null; D().render(); },
    "oc-save": async () => {
      const e = OC.edit || {}; OC.err = ""; OC.msg = "";
      try { await K().rpc("upsert_occasion", { p_id: e.id ? Number(e.id) : null, p_name: val("oc-name"), p_code: val("oc-code") || null, p_icon: val("oc-icon"), p_sort_order: val("oc-sort") === "" ? null : Number(val("oc-sort")), p_is_active: val("oc-active") }); await admLists(); OC.edit = null; OC.msg = "Ocasión guardada."; CAT.started = false; }
      catch (err) { OC.err = K().human(err); }
      D().render();
    },
    "oc-del": async (el) => {
      if (!(await window.dlgConfirm("¿Eliminar esta ocasión?"))) return;
      try { await K().rpc("delete_occasion", { p_id: Number(el.dataset.id) }); await admLists(); OC.edit = null; OC.msg = "Ocasión eliminada."; CAT.started = false; } catch (err) { OC.err = K().human(err); }
      D().render();
    },
  });
})();
