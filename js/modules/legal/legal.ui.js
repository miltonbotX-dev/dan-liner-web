// modules/legal/legal.ui.js · Páginas de ayuda (#ayuda/…), legales (#legal/…) y Libro de Reclamaciones (submit_complaint, v15). El pie lo maqueta IU en index.html.
// TEXTOS PROVISIONALES: marcados con .draft-note para que Amilthon los revise antes de publicar.
(function () {
  const D = () => window.DL;
  const esc = (v) => D().esc(v);
  const sf = () => ((window.Store && window.Store.v2 && window.Store.v2.storefront) || {});
  const waNum = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 9 ? "51" + d : d; };
  const biz0 = () => { const b = (window.DL_CONFIG && window.DL_CONFIG.BUSINESS) || {}; const cfg = (window.Store && window.Store._r && window.Store._r.R && window.Store._r.R.config) || {}; return { name: cfg.company_name || b.legalName || b.name || "DAN-LINER", ruc: cfg.company_ruc || b.ruc || "", address: cfg.company_address || b.address || "" }; };
  const DRAFT = `<p class="draft-note">Texto provisional · pendiente de revisión por DAN-LINER</p>`;
  const year = () => new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima", year: "numeric" });

  const db = () => sf()._db || {};
  const biz = () => { const b = biz0(); const d = db(); return { name: d.razon_social || b.name, ruc: d.ruc || b.ruc, address: d.direccion_legal || b.address }; };
  // Texto plano guardado por el admin (v15) → párrafos y viñetas, siempre escapado.
  const fromDb = (t) => String(t).split(/\n\s*\n/).map((blk) => { const ls = blk.split("\n").map((x) => x.trim()).filter(Boolean); return ls.every((x) => /^[-•*]\s/.test(x)) ? `<ul>${ls.map((x) => `<li>${esc(x.replace(/^[-•*]\s*/, ""))}</li>`).join("")}</ul>` : `<p>${ls.map(esc).join("<br>")}</p>`; }).join("");
  const HELP = [["preguntas", "Preguntas frecuentes"], ["compras", "Guía de compras"], ["envios", "Tiempos y costos de envío"], ["pagos", "Formas de pago"], ["cambios", "Cambios y devoluciones"]];
  const LEGAL = [["terminos", "Términos y condiciones"], ["privacidad", "Política de privacidad"], ["reclamaciones", "Libro de Reclamaciones"]];
  const DBKEY = { compras: "guia_compra", envios: "envios_info", pagos: "formas_pago", cambios: "cambios_devoluciones", terminos: "terminos", privacidad: "privacidad" };

  // ---------- Pie: completa la línea legal con razón social y RUC si la BD los tiene (el pie lo maqueta IU en index.html) ----------
  function mountLegalLine() {
    const el = document.querySelector(".site-footer .ft-legal"); if (!el) return;
    const b = biz(); const d = db(); if (!d.razon_social && !d.ruc) return;
    const extra = ` ${[d.razon_social, d.ruc ? "RUC " + d.ruc : ""].filter(Boolean).join(" · ")}.`;
    if (el.dataset.extra !== extra) { el.dataset.base = el.dataset.base || el.textContent; el.textContent = el.dataset.base + extra; el.dataset.extra = extra; }
    void b;
  }

  // ---------- Páginas de ayuda y legales ----------
  const sizes = () => { const all = (D().visibleProducts() || []).map((p) => p.size_label).filter(Boolean); return [...new Set(all)]; };
  const PAGES = {
    preguntas: ["Preguntas frecuentes", () => `<div class="faq">${[
      ["¿Sus ternos son de fábrica?", "Sí. Todas nuestras prendas son de fábrica, en tallas estándar y listas para llevar."],
      ["¿Cómo sé cuál es mi talla?", `Revisa la <a href="#ayuda/compras">guía de tallas</a> o pruébatelo en cualquiera de nuestras tiendas. También puedes escribirnos por WhatsApp.`],
      ["¿Puedo apartar una prenda?", "Sí. En el pedido web elige Yape o Plin y sube la captura de tu pago: tu pedido queda apartado mientras confirmamos el pago."],
      ["¿Hacen envíos?", `Sí, a todo el Perú. Mira <a href="#ayuda/envios">tiempos y costos de envío</a>.`],
      ["¿Cómo veo el estado de mi pedido?", `En <a href="#mis-pedidos">Mis pedidos</a> verás cada paso: recibido, confirmado, preparando, en camino o listo para recoger.`],
      ["¿Puedo cambiar una prenda?", `Revisa <a href="#ayuda/cambios">cambios y devoluciones</a>.`],
    ].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>`],
    compras: ["Guía de compras", () => `<p><b>Cómo comprar:</b> elige tu prenda y talla en la Colección, agrégala al carrito y en Tu pedido escoge recojo en tienda o envío y la forma de pago. Con Yape o Plin, sube la captura y tu pedido queda apartado mientras confirmamos el pago.</p><h3>Guía de tallas</h3><p>Nuestras prendas son de fábrica, en tallas estándar.${sizes().length ? " Tallas en la colección: <b>" + esc(sizes().join(", ")) + "</b>." : ""}</p>
      <p>Para elegir tu talla, toma estas medidas con una cinta métrica, sin apretar:</p>
      <ul><li><b>Pecho:</b> alrededor de la parte más ancha del pecho, bajo las axilas.</li><li><b>Cintura:</b> a la altura donde usas el pantalón.</li><li><b>Largo de manga:</b> del hombro a la muñeca, con el brazo relajado.</li></ul>
      <p class="tiny">Tabla de medidas por talla: pendiente de DAN-LINER.</p>
      <p>¿Dudas? Pruébatelo en tienda o escríbenos por WhatsApp con tu talla habitual.</p>`],
    envios: ["Tiempos y costos de envío", () => `<ul><li><b>Recojo en tienda:</b> sin costo. Te avisamos por WhatsApp cuando tu pedido esté listo.</li>
      <li><b>Envío a domicilio:</b> a todo el Perú. El costo y el tiempo dependen del distrito y se confirman contigo por WhatsApp antes de despachar.</li></ul>
      <p class="tiny">Tiempos y tarifas exactas por zona: pendientes de DAN-LINER.</p>`],
    pagos: ["Formas de pago", () => `<ul><li><b>Yape y Plin:</b> paga y sube la captura al hacer tu pedido; lo confirmamos y queda apartado.</li><li><b>Efectivo en tienda:</b> pagas al recoger tu pedido.</li><li><b>Contra entrega:</b> para envíos, según disponibilidad en tu zona.</li></ul>`],
    cambios: ["Cambios y devoluciones", () => `<p>Si la talla no te queda, puedes solicitar un cambio presentando tu comprobante y la prenda sin uso, con sus etiquetas.</p>
      <p class="tiny">Plazo y condiciones exactas (días, prendas en oferta, envíos): pendientes de DAN-LINER.</p>
      <p>Si tienes un problema con tu compra también puedes registrarlo en el <a href="#legal/reclamaciones">Libro de Reclamaciones</a>.</p>`],
    terminos: ["Términos y condiciones", () => `<p>Al comprar en esta web aceptas que los precios están en soles e incluyen IGV, que el stock se confirma al revisar tu pedido y que los pedidos con Yape o Plin quedan apartados hasta validar el pago.</p>
      <p>Las fotos son referenciales; colores y texturas pueden variar ligeramente según tu pantalla.</p><p class="tiny">Texto completo: pendiente de DAN-LINER.</p>`],
    privacidad: ["Política de privacidad", () => `<p>Usamos tus datos (nombre, celular, correo, DNI y dirección) solo para atender tus pedidos, emitir comprobantes y comunicarnos contigo, conforme a la Ley N.º 29733 de Protección de Datos Personales.</p>
      <p>No vendemos tus datos. Puedes pedir que los corrijamos o eliminemos desde Mi cuenta o escribiéndonos.</p><p class="tiny">Texto completo y titular del banco de datos: pendientes de DAN-LINER.</p>`],
  };
  function renderInfo(group, slug) {
    const list = group === "legal" ? LEGAL : HELP; const pg = PAGES[slug];
    const nav = `<nav class="info-nav tiny">${HELP.concat(LEGAL).map(([k, l]) => { const g = LEGAL.some(([x]) => x === k) ? "legal" : "ayuda"; const on = k === slug; return `<a href="#${g}/${k}" class="${on ? "on" : ""}" ${on ? 'aria-current="page"' : ""}>${l}</a>`; }).join(" · ")}</nav>`;
    if (!pg) return `<section class="stack info-page" style="padding:28px 0 56px;max-width:720px"><p class="kicker">${group === "legal" ? "Legales" : "Servicio al cliente"}</p><h1>${group === "legal" ? "Legales" : "Ayuda"}</h1><ul>${list.map(([k, l]) => `<li><a href="#${group}/${k}">${l}</a></li>`).join("")}</ul>${nav}</section>`;
    const t = DBKEY[slug] && db()[DBKEY[slug]];
    const body = t && String(t).trim() ? fromDb(t) : DRAFT + pg[1]();
    return `<section class="stack info-page" style="padding:28px 0 56px;max-width:720px"><p class="kicker">${group === "legal" ? "Legales" : "Servicio al cliente"}</p><h1>${pg[0]}</h1>${body}${nav}</section>`;
  }

  // ---------- Libro de Reclamaciones (BD v15: submit_complaint, sin login) ----------
  const lb = { sent: null, err: "", busy: false, st: null, stErr: "" };
  const missing = (e) => e && (e.status === 404 || /could not find|PGRST20[2-5]|does not exist|schema cache/i.test(e.message || ""));
  async function saveReclamo(d) {
    try {
      const r = await window.Store.rpc("submit_complaint", { p_consumer_name: d.nombre, p_document_type: d.doc_tipo, p_document_number: d.doc_numero, p_address: d.domicilio, p_phone: d.telefono || null, p_email: d.email || null,
        p_item_type: d.bien_tipo, p_item_description: d.bien_descripcion, p_kind: d.tipo, p_detail: d.detalle, p_consumer_request: d.pedido, p_amount: d.monto ? Number(d.monto) : null,
        p_is_minor: d.menor_edad, p_guardian_name: d.menor_edad ? d.apoderado : null, p_order_code: d.pedido_codigo || null, p_store_id: d.store_id ? Number(d.store_id) : null });
      return { saved: true, code: (r && r.code) || "", due: r && r.due_on, provider: (r && r.provider) || null, at: r && r.created_at };
    } catch (e) { if (!missing(e)) throw e; }
    return { saved: false };
  }
  function reclamoText(d, code) {
    return [`LIBRO DE RECLAMACIONES · ${d.tipo}${code ? " · " + code : ""}`, `Fecha: ${new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })}`, `Consumidor: ${d.nombre} · ${d.doc_tipo} ${d.doc_numero}`, `Domicilio: ${d.domicilio}`, `Teléfono: ${d.telefono || "-"} · Correo: ${d.email || "-"}`,
      d.menor_edad ? `Padre/madre o apoderado: ${d.apoderado}` : "", `Bien: ${d.bien_tipo} · ${d.bien_descripcion} · Monto S/ ${d.monto || "-"}`, d.store_name ? `Tienda: ${d.store_name}` : "", d.pedido_codigo ? `Pedido/comprobante: ${d.pedido_codigo}` : "", `Detalle: ${d.detalle}`, `Pedido del consumidor: ${d.pedido}`].filter(Boolean).join("\n");
  }
  const fdate = (x) => (x ? new Date(String(x).length === 10 ? x + "T12:00:00" : x).toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "long", year: "numeric" }) : "");
  function renderLibro() {
    const b = biz(); const st = D().state; const stores = st.pubStores || []; const wa = waNum(sf().contact_whatsapp);
    const today = new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima" });
    const head = `<div class="lr-head">${D().icon ? "" : ""}<div><h1>Libro de Reclamaciones</h1><p class="tiny" style="margin:4px 0 0">${esc(b.name)}${b.ruc ? " · RUC " + esc(b.ruc) : ""}${b.address ? " · " + esc(b.address) : ""} · ${esc(today)}</p></div></div>`;
    if (lb.sent) {
      const d = lb.sent.data; const txt = reclamoText(d, lb.sent.code); const p = lb.sent.provider || {};
      return `<section class="lr-form">${head}<div class="lr-done">${lb.sent.saved
        ? `<p class="kicker">Hoja registrada</p><p>Tu ${d.tipo === "QUEJA" ? "queja" : "reclamo"} quedó registrado con el número</p><b class="num">${esc(lb.sent.code || "—")}</b>
          <p class="tiny">Te responderemos ${lb.sent.due ? "a más tardar el <b>" + esc(fdate(lb.sent.due)) + "</b>" : "en un plazo máximo de 15 días hábiles"}${d.email ? " al correo " + esc(d.email) : ""}. Guarda este número junto con tu ${esc(d.doc_tipo)} para consultar el estado.</p>
          ${p.razon_social || p.ruc ? `<p class="tiny">${esc([p.razon_social, p.ruc ? "RUC " + p.ruc : "", p.direccion].filter(Boolean).join(" · "))}</p>` : ""}`
        : `<p class="kicker">Aún no se pudo registrar en línea</p><p>Para que quede constancia, envíanos esta hoja por WhatsApp${sf().contact_email ? " o correo" : ""}, o pide el Libro de Reclamaciones físico en cualquiera de nuestras tiendas.</p>`}
        <pre class="lr-note" style="white-space:pre-wrap;text-align:left">${esc(txt)}</pre>
        <div class="row" style="flex-wrap:wrap;justify-content:center">${!lb.sent.saved && wa ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(txt)}">Enviar por WhatsApp</a>` : ""}${!lb.sent.saved && sf().contact_email ? `<a class="btn ghost" href="mailto:${esc(sf().contact_email)}?subject=${encodeURIComponent("Libro de Reclamaciones")}&body=${encodeURIComponent(txt)}">Enviar por correo</a>` : ""}<button class="btn ghost" type="button" data-act="libro-print">Imprimir / guardar</button><button class="btn ghost" type="button" data-act="libro-new">Nueva hoja</button></div></div></section>`;
    }
    const u = st.user || {}; const sel = (n, opts) => `<select name="${n}">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`;
    const cs = lb.st;
    return `<form class="lr-form" data-form="libro" novalidate>${head}
      <p class="lr-note">Conforme al Código de Protección y Defensa del Consumidor, contamos con un Libro de Reclamaciones virtual. Completa la hoja y recibirás un número de registro.</p>
      <fieldset class="lr-block"><legend>1. Identificación del consumidor</legend><div class="lr-grid">
        <label class="full">Nombre completo<input name="nombre" required maxlength="160" autocomplete="name"></label>
        <label>Documento${sel("doc_tipo", [["DNI", "DNI"], ["CE", "Carné de extranjería"], ["PAS", "Pasaporte"], ["RUC", "RUC"]])}</label>
        <label>Número<input name="doc_numero" required inputmode="numeric" maxlength="12"></label>
        <label class="full">Domicilio<input name="domicilio" required maxlength="200" autocomplete="street-address"></label>
        <label>Teléfono<input name="telefono" type="tel" inputmode="tel" maxlength="15" autocomplete="tel"></label>
        <label>Correo<input name="email" type="email" maxlength="120" autocomplete="email" value="${esc(u.email || "")}"></label>
        <label class="full checks"><input type="checkbox" name="menor_edad" style="width:auto"> Soy menor de edad</label>
        <label class="full">Padre, madre o apoderado (si eres menor)<input name="apoderado" maxlength="160"></label></div></fieldset>
      <fieldset class="lr-block"><legend>2. Identificación del producto o servicio</legend>
        <div class="lr-type"><label><input type="radio" name="bien_tipo" value="PRODUCTO" checked><b>Producto</b><small>Una prenda o artículo.</small></label><label><input type="radio" name="bien_tipo" value="SERVICIO"><b>Servicio</b><small>Atención, envío, arreglo…</small></label></div>
        <div class="lr-grid">
        <label class="full">Descripción<input name="bien_descripcion" required maxlength="300" placeholder="Ej. Terno azul talla 48"></label>
        <label>Monto reclamado (S/)<input name="monto" inputmode="decimal" maxlength="12" placeholder="0.00"></label>
        <label>Tienda<select name="store_id"><option value="">Compra web / no sé</option>${stores.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></label>
        <label class="full">N.º de pedido o comprobante (opcional)<input name="pedido_codigo" maxlength="40" placeholder="DL-XXXXX o B001-000123"></label></div></fieldset>
      <fieldset class="lr-block"><legend>3. Detalle de la reclamación</legend>
        <div class="lr-type"><label><input type="radio" name="tipo" value="RECLAMO" checked><b>Reclamo</b><small>Disconformidad con el producto o servicio.</small></label><label><input type="radio" name="tipo" value="QUEJA"><b>Queja</b><small>Malestar por la atención al público, no relacionado al producto.</small></label></div>
        <div class="lr-grid"><label class="full">Detalle<textarea name="detalle" required maxlength="3000"></textarea></label>
        <label class="full">Pedido del consumidor<textarea name="pedido" required maxlength="2000" placeholder="¿Qué solución esperas?"></textarea></label></div></fieldset>
      <label class="checks"><input type="checkbox" name="acepto" required style="width:auto"> Declaro que los datos son verdaderos y acepto que se usen para atender esta hoja.</label>
      <p class="lr-note">La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI. El proveedor deberá dar respuesta en un plazo no mayor a quince (15) días hábiles.</p>
      ${lb.err ? `<p class="alert-text" role="alert">${esc(lb.err)}</p>` : ""}
      <button class="btn" type="submit" ${lb.busy ? "disabled" : ""}>${lb.busy ? "Enviando…" : "Enviar hoja"}</button>
      <details class="lr-block"><summary>Consultar una hoja ya enviada</summary><div class="lr-grid" style="margin-top:10px"><label>Número<input id="lr-q-code" maxlength="20" placeholder="LR-2026-00001"></label><label>N.º de documento<input id="lr-q-doc" maxlength="12" inputmode="numeric"></label>
        <button class="btn ghost full" type="button" data-act="libro-status">Consultar</button></div>
        ${lb.stErr ? `<p class="alert-text">${esc(lb.stErr)}</p>` : ""}${cs ? `<p><b>${esc(cs.code)}</b> · ${esc(cs.status_label || cs.status)} · responde hasta ${esc(fdate(cs.due_on))}</p>${cs.response ? `<p class="lr-note"><b>Respuesta (${esc(fdate(cs.responded_at))}):</b> ${esc(cs.response)}</p>` : ""}` : ""}</details>
    </form>`;
  }
  async function submitLibro(form) {
    if (lb.busy) return;
    const f = new FormData(form); const g = (k) => String(f.get(k) || "").trim();
    const d = { tipo: g("tipo") || "RECLAMO", nombre: g("nombre"), doc_tipo: g("doc_tipo") || "DNI", doc_numero: g("doc_numero"), domicilio: g("domicilio"), telefono: g("telefono"), email: g("email"),
      menor_edad: f.get("menor_edad") === "on", apoderado: g("apoderado"), bien_tipo: g("bien_tipo") || "PRODUCTO", monto: g("monto").replace(",", "."), bien_descripcion: g("bien_descripcion"),
      store_id: g("store_id") || null, pedido_codigo: g("pedido_codigo"), detalle: g("detalle"), pedido: g("pedido") };
    const store = (D().state.pubStores || []).find((s) => String(s.id) === String(d.store_id)); d.store_name = store ? store.name : "";
    const need = [["nombre", "tu nombre completo"], ["doc_numero", "tu número de documento"], ["domicilio", "tu domicilio"], ["bien_descripcion", "la descripción del producto o servicio"], ["detalle", "el detalle"], ["pedido", "lo que solicitas"]].find(([k]) => !d[k]);
    lb.err = need ? "Completa " + need[1] + "." : d.doc_tipo === "DNI" && !/^\d{8}$/.test(d.doc_numero) ? "El DNI tiene 8 dígitos." : d.doc_tipo === "RUC" && !/^\d{11}$/.test(d.doc_numero) ? "El RUC tiene 11 dígitos." : !d.telefono && !d.email ? "Déjanos un teléfono o un correo para responderte." : d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email) ? "Revisa tu correo." : d.menor_edad && !d.apoderado ? "Indica el nombre de tu padre, madre o apoderado." : d.monto && !/^\d+(\.\d{1,2})?$/.test(d.monto) ? "Monto inválido (ej. 225.00)." : f.get("acepto") !== "on" ? "Marca la declaración para continuar." : "";
    if (lb.err) { D().render(); const fld = need ? need[0] : /^El (DNI|RUC)/.test(lb.err) ? "doc_numero" : /teléfono o un correo/.test(lb.err) ? "telefono" : /correo/.test(lb.err) ? "email" : /apoderado/.test(lb.err) ? "apoderado" : /Monto/.test(lb.err) ? "monto" : /declaración/.test(lb.err) ? "acepto" : null; if (fld && window.DL_FIELD_ERR) window.DL_FIELD_ERR(document.querySelector(".lr-form"), fld, lb.err); return; }
    lb.busy = true; D().render();
    try { const r = await saveReclamo(d); lb.sent = Object.assign({ data: d }, r); lb.err = ""; }
    catch (e) { lb.err = String((e && e.message) || "No se pudo enviar. Intenta de nuevo."); }
    lb.busy = false; D().render(); window.scrollTo(0, 0);
  }
  async function libroStatus() {
    const code = (document.getElementById("lr-q-code") || {}).value || ""; const doc = (document.getElementById("lr-q-doc") || {}).value || "";
    lb.st = null; lb.stErr = "";
    if (!code.trim() || !doc.trim()) lb.stErr = "Escribe el número de hoja y tu documento.";
    else try { const r = await window.Store.rpc("get_complaint_status", { p_code: code.trim().toUpperCase(), p_document_number: doc.trim() }); if (r) lb.st = r; else lb.stErr = "No encontramos esa hoja con ese documento."; }
      catch (e) { lb.stErr = missing(e) ? "La consulta en línea aún no está activa." : String(e.message || e); }
    D().render();
  }

  const screen = (group) => () => { const sub = D().page().sub || ""; return group === "legal" && sub === "reclamaciones" ? renderLibro() : renderInfo(group, sub); };
  // Enlaces antiguos (#info/…, #libro-de-reclamaciones) → nuevas rutas
  const OLD = { "preguntas-frecuentes": "ayuda/preguntas", "guia-de-tallas": "ayuda/compras", envios: "ayuda/envios", "formas-de-pago": "ayuda/pagos", "cambios-y-devoluciones": "ayuda/cambios", terminos: "legal/terminos", privacidad: "legal/privacidad" };
  const redirect = (to) => () => { setTimeout(() => location.replace("#" + to), 0); return `<p class="muted" style="padding:28px 0">Cargando…</p>`; };
  window.DL_SCREENS = Object.assign(window.DL_SCREENS || {}, { ayuda: screen("ayuda"), legal: screen("legal"),
    info: () => redirect(OLD[D().page().sub] || "ayuda/preguntas")(), "libro-de-reclamaciones": redirect("legal/reclamaciones") });
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, { libro: (form) => submitLibro(form) });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, { "libro-new": () => { lb.sent = null; D().render(); }, "libro-print": () => window.print(), "libro-status": libroStatus });
  window.DL_AFTER = (window.DL_AFTER || []).concat([mountLegalLine]);
})();
