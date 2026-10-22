// modules/pedidos/pedidos.ui.js · Ronda 2 (BD v14): checkout web, Mis pedidos con seguimiento y cola de Pedidos web (personal).
// RPC con nombre: create_web_order, attach_order_proof, get_my_orders, get_order_history, cancel_my_order, get_orders, set_order_status.
(function () {
  const D = () => window.DL;
  const esc = (v) => D().esc(v);
  const api = () => D().Store.v2api;
  const sf = () => ((window.Store && window.Store.v2 && window.Store.v2.storefront) || {});
  const waNum = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length === 9 ? "51" + d : d; };
  const money = (soles) => D().soles(Math.round(Number(soles || 0) * 100));
  const fecha = (t) => (t ? new Date(t).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
  const LABEL = { RECIBIDO: "Recibido", PAGO_EN_REVISION: "Pago por confirmar", CONFIRMADO: "Confirmado", EN_PREPARACION: "Preparando", EMPAQUETADO: "Empaquetado", ENVIADO: "En camino", LISTO_PARA_RECOGER: "Listo para recoger", ENTREGADO: "Entregado", CANCELADO: "Cancelado", RECHAZADO: "Rechazado" };
  const PAY = { CONTRA_ENTREGA: "Contra entrega / efectivo", YAPE: "Yape", PLIN: "Plin" };
  const OPEN = ["RECIBIDO", "PAGO_EN_REVISION", "RECHAZADO", "CONFIRMADO", "EN_PREPARACION", "EMPAQUETADO", "ENVIADO", "LISTO_PARA_RECOGER"];
  const isQr = (m) => m === "YAPE" || m === "PLIN";
  const human = (e) => { const t = String((e && e.message) || e || ""); if (/permission|row-level|42501|Sin permiso/i.test(t)) return "Tu cuenta no tiene permiso para esto."; if (/failed to fetch|network/i.test(t)) return "Sin conexión. Revisa tu internet e intenta de nuevo."; return t || "No se pudo completar."; };
  const supportHref = (text) => { const n = waNum(sf().contact_whatsapp); return n ? "https://wa.me/" + n + "?text=" + encodeURIComponent(text || "Hola DAN-LINER, necesito ayuda con mi pedido.") : "#contacto"; };

  // ================= Checkout =================
  const co = () => (D().ui.co = D().ui.co || { delivery: "RECOJO", payment: "CONTRA_ENTREGA" });
  const geo = { rows: null, loading: false, err: "" };
  function loadGeo() {
    if (geo.rows || geo.loading) return; geo.loading = true;
    api().ubigeo().then((r) => { geo.rows = r; }).catch((e) => { geo.err = human(e); }).finally(() => { geo.loading = false; rerender(); });
  }
  // Guarda lo escrito antes de un re-render asíncrono (ubigeo, perfil) para no perder datos.
  function rerender() { const f = document.querySelector("form.co-form"); if (f) readForm(f); D().render(); }
  document.addEventListener("input", (e) => { const f = e.target && e.target.closest && e.target.closest("form.co-form"); const t = e.target; if (f && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && !/^(radio|checkbox|file)$/.test(t.type)))) readForm(f); });
  const uniq = (a) => [...new Set(a)];
  const opts = (list, sel, ph) => `<option value="">${esc(ph)}</option>` + list.map((v) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(v)}</option>`).join("");
  function itemsSummary() {
    const lines = D().cartLines();
    return `<div class="stack co-items">${lines.map(({ line, p }) => `<div class="row co-item"><span class="grow">${esc(p.name)}${p.size_label ? " · T. " + esc(p.size_label) : ""} × ${line.qty}</span><b>${D().soles(D().priceOf(p).unit * line.qty)}</b></div>`).join("")}
      <div class="row total-row cart-total"><span>Total</span><b>${D().moneyHtml(D().cartSum())}</b></div></div>`;
  }
  function waOrderText() {
    const c = co(); const shop = (D().state.pubStores || []).find((s) => s.id === String(c.storeId));
    const lines = D().cartLines().map(({ line, p }) => `• ${p.name}${p.size_label ? " talla " + p.size_label : ""}${p.color ? " " + p.color : ""} × ${line.qty} = ${D().soles(D().priceOf(p).unit * line.qty).replace(/<[^>]+>/g, "")}`);
    return ["Hola DAN-LINER, quiero hacer este pedido:", ...lines, "Total: " + D().soles(D().cartSum()).replace(/<[^>]+>/g, ""),
      c.delivery === "ENVIO" ? `Envío a: ${[c.direccion, c.distrito, c.provincia, c.departamento].filter(Boolean).join(", ")}${c.referencia ? " (ref. " + c.referencia + ")" : ""}` : `Recojo en: ${shop ? shop.name : "tienda por elegir"}`,
      "Pago: " + (PAY[c.payment] || "por definir"), c.nota ? "Nota: " + c.nota : ""].filter(Boolean).join("\n");
  }
  function stepsBar(cur) {
    const S = [["carrito", "Carrito"], ["entrega", "Entrega"], ["pago", "Pago"], ["listo", "Listo"]];
    const idx = S.findIndex(([k]) => k === cur);
    return `<ol class="steps">${S.map(([k, l], i) => `<li class="step ${i < idx ? "done" : ""} ${i === idx ? "on" : ""}"><span class="step-n">${i < idx ? D().icon("check", 14) : i + 1}</span>${l}</li>`).join("")}</ol>`;
  }
  function renderEntrega() {
    const c = co(); const st = D().state; const shops = st.pubStores || [];
    if (!c.phone) c.phone = (st.user && st.user.phone) || "";
    // v29: precarga el celular del perfil una sola vez (no bloquea el formulario)
    if (!c.phone && !c.profTried && st.user && D().Store.mode === "remote" && D().Store.v2api && D().Store.v2api.getMyProfile) {
      c.profTried = true;
      D().Store.v2api.getMyProfile().then((pr) => { const ph = pr && pr.phone; const f = document.querySelector("form.co-form"); if (f) readForm(f); if (ph && !co().phone) { co().phone = String(ph); if (D().ui.step === "entrega") D().render(); } }).catch(() => {});
    }
    if (c.delivery === "RECOJO" && !c.storeId && shops[0]) c.storeId = shops[0].id;
    const shop = shops.find((s) => s.id === String(c.storeId));
    let geoHtml = "";
    if (c.delivery === "ENVIO") {
      loadGeo();
      if (!geo.rows) geoHtml = `<p class="muted">${geo.err ? esc(geo.err) : "Cargando departamentos…"}</p>`;
      else {
        const deps = uniq(geo.rows.map((r) => r.departamento));
        const provs = c.departamento ? uniq(geo.rows.filter((r) => r.departamento === c.departamento).map((r) => r.provincia)) : [];
        const dists = c.provincia ? geo.rows.filter((r) => r.departamento === c.departamento && r.provincia === c.provincia).map((r) => r.distrito) : [];
        geoHtml = `<div class="grid3 co-geo"><label>Departamento<select name="departamento" required>${opts(deps, c.departamento, "Elige…")}</select></label>
          <label>Provincia<select name="provincia" required ${provs.length ? "" : "disabled"}>${opts(provs, c.provincia, "Elige…")}</select></label>
          <label>Distrito<select name="distrito" required ${dists.length ? "" : "disabled"}>${opts(dists, c.distrito, "Elige…")}</select></label></div>
          <label>Dirección exacta<input name="direccion" maxlength="255" autocomplete="street-address" placeholder="Av./Jr./Calle, número, dpto." value="${esc(c.direccion || "")}"></label>
          <label>Referencia<input name="referencia" maxlength="255" placeholder="Frente a…, cerca de…" value="${esc(c.referencia || "")}"></label>
          <p class="tiny">El costo y la fecha de envío se coordinan contigo por WhatsApp antes de despachar.</p>`;
      }
    }
    return `${stepsBar("entrega")}<form class="stack co-form" data-form="co-entrega" novalidate>
      <div class="ship-choice" role="radiogroup" aria-label="Forma de entrega">
        <label><input type="radio" name="delivery" value="RECOJO" ${c.delivery !== "ENVIO" ? "checked" : ""}><b>Recojo en tienda</b><span class="tiny">Sin costo · tú eliges la tienda</span></label>
        <label><input type="radio" name="delivery" value="ENVIO" ${c.delivery === "ENVIO" ? "checked" : ""}><b>Envío a domicilio</b><span class="tiny">A todo el Perú</span></label>
      </div>
      ${c.delivery === "ENVIO" ? geoHtml : `<label>Tienda donde recoges<select name="storeId" required>${shops.map((s) => `<option value="${esc(s.id)}" ${String(c.storeId) === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
        ${shop && shop.address ? `<p class="tiny store-address">${D().icon("pin", 14)} ${esc(shop.address)}</p>` : ""}`}
      <label>Celular de contacto<input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="15" placeholder="9 dígitos, ej. 931246675" value="${esc(c.phone || "")}"></label>
      <label>Nota para la tienda (opcional)<textarea name="nota" maxlength="500" rows="2">${esc(c.nota || "")}</textarea></label>
      ${c.err ? `<p class="alert-text" role="alert">${esc(c.err)}</p>` : ""}
      ${itemsSummary()}
      <div class="row"><button class="btn ghost" type="button" data-act="co-step" data-id="carrito">Atrás</button><button class="btn" type="submit">Continuar al pago</button></div>
    </form>`;
  }
  function renderPago() {
    const c = co(); const qr = isQr(c.payment);
    const shop = (D().state.pubStores || []).find((s) => s.id === String(c.storeId));
    // v16: número Yape/Plin de la tienda (RECOJO: la elegida; ENVÍO: la principal); respaldo: datos generales de la tienda web
    const pubs = D().state.pubStores || [];
    const payStore = (c.delivery === "ENVIO" ? null : shop) || pubs.find((s) => s.is_main) || pubs[0] || {};
    const isPlin = c.payment === "PLIN";
    const num = (isPlin ? payStore.plin_number : payStore.yape_number) || (isPlin ? sf().plin_number : sf().yape_number) || "";
    const holder = (isPlin ? payStore.plin_holder : payStore.yape_holder) || "";
    const numFmt = num.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
    const waOk = Boolean(waNum(sf().contact_whatsapp));
    return `${stepsBar("pago")}<form class="stack co-form" data-form="co-pago" novalidate>
      <p class="tiny">${c.delivery === "ENVIO" ? "Envío a: " + esc([c.direccion, c.distrito, c.provincia, c.departamento].filter(Boolean).join(", ")) : "Recojo en: " + esc(shop ? shop.name : "")} · ${esc(c.phone || "")} · <button class="link-btn" type="button" data-act="co-step" data-id="entrega">Cambiar</button></p>
      <div class="pay-choice" role="radiogroup" aria-label="Forma de pago">
        ${["CONTRA_ENTREGA", "YAPE", "PLIN"].map((m) => `<label class="chip ${c.payment === m ? "on" : ""}"><input type="radio" name="payment" value="${m}" ${c.payment === m ? "checked" : ""}> ${m === "CONTRA_ENTREGA" ? (c.delivery === "ENVIO" ? "Contra entrega" : "Efectivo en tienda") : PAY[m]}</label>`).join("")}
      </div>
      ${qr ? `<div class="panel stack co-proof">${num ? `<div class="pay-number"><span class="tiny">${esc(PAY[c.payment])}${payStore.name ? " · " + esc(payStore.name) : ""}</span><b class="num">${esc(numFmt)}</b>${holder ? `<span class="tiny">Titular: ${esc(holder)}</span>` : ""}<button class="btn ghost small" type="button" data-act="co-copy" data-v="${esc(num)}">Copiar número</button></div>` : ""}
        <p class="tiny">${num ? `Paga el total con ${PAY[c.payment]} a este número y sube la captura.` : `Paga con ${PAY[c.payment]} y sube la captura. Si no tienes el número, pídelo por WhatsApp.`} Tu pedido queda apartado mientras confirmamos el pago.</p>
        ${c.proof ? `<img class="proof-preview" alt="Captura del pago" src="${esc(c.proof)}" width="120" height="160">` : ""}
        <label class="btn ghost">${c.proof ? "Cambiar captura" : "Subir captura del pago"}<input type="file" name="proof" accept="image/*" hidden></label></div>`
        : `<p class="tiny">${c.delivery === "ENVIO" ? "Pagas al recibir tu pedido." : "Pagas en la tienda al recoger."}</p>`}
      ${c.err ? `<p class="alert-text" role="alert">${esc(c.err)}</p>` : ""}
      ${itemsSummary()}
      <div class="row"><button class="btn ghost" type="button" data-act="co-step" data-id="entrega">Atrás</button><button class="btn" type="submit" ${c.placing ? "disabled" : ""}>${c.placing ? "Enviando…" : qr ? "Apartar pedido" : "Confirmar pedido"}</button></div>
      ${waOk ? `<a class="btn ghost full wa-order" target="_blank" rel="noopener" href="${esc(supportHref(waOrderText()))}">Pedir por WhatsApp</a>` : ""}
      <a class="support-link" ${waOk ? 'target="_blank" rel="noopener"' : ""} href="${esc(supportHref())}">¿Dudas con tu pedido? Escríbenos</a>
    </form>`;
  }
  function renderListo() {
    const r = D().ui.coDone || {}; const qr = isQr(r.payment_method);
    return `${stepsBar("listo")}<div class="stack order-done">${D().icon("check", 36)}
      <h3>${qr ? "Apartado, pago por confirmar" : "¡Pedido recibido!"}</h3>
      <p>Código <b class="order-code">${esc(r.public_code || r.code || "")}</b> · Total <b>${money(r.total)}</b></p>
      <p class="muted">${qr ? "Revisaremos tu pago y te avisaremos por WhatsApp." : "La tienda revisará el stock y te escribirá para confirmar."} Sigue el estado en Mis pedidos.</p>
      ${r.warn ? `<p class="alert-text">${esc(r.warn)}</p>` : ""}
      <div class="row"><a class="btn" href="#mis-pedidos">Mis pedidos</a><a class="btn ghost" href="#coleccion">Seguir viendo</a></div>
      <a class="support-link" target="_blank" rel="noopener" href="${esc(supportHref("Hola DAN-LINER, mi pedido es " + (r.public_code || "") + "."))}">¿Algo no salió bien? Escríbenos</a></div>`;
  }
  function renderCheckout() {
    const ui = D().ui; let step = ui.step || "carrito";
    if (step === "datos") step = ui.step = "entrega";
    if (step === "listo" && !ui.coDone) step = ui.step = "carrito";
    if (step !== "carrito" && step !== "listo" && !D().cartLines().length) step = ui.step = "carrito";
    if (step === "carrito" || D().Store.mode !== "remote") return D().renderPedidoBase();
    const body = step === "entrega" ? renderEntrega() : step === "pago" ? renderPago() : renderListo();
    return `<section class="checkout stack"><h1>${D().icon("bag", 22)} Tu pedido</h1><div class="panel stack">${body}</div></section>`;
  }
  function readForm(form) {
    const c = co(); const f = new FormData(form);
    ["delivery", "storeId", "departamento", "provincia", "distrito", "direccion", "referencia", "phone", "nota", "payment"].forEach((k) => { if (f.has(k)) c[k] = String(f.get(k) || "").trim(); });
    return c;
  }
  function validEntrega(c) {
    if (c.delivery === "ENVIO") {
      if (!c.departamento || !c.provincia || !c.distrito) return "Elige departamento, provincia y distrito.";
      if (String(c.direccion || "").length < 5) return "Escribe la dirección exacta.";
    } else if (!c.storeId) return "Elige la tienda donde recogerás.";
    if (!D().normPhone(c.phone)) return "Revisa tu celular: 9 dígitos que empiezan con 9 (ej. 931246675).";
    return "";
  }
  async function place() {
    const c = co(); const lines = D().cartLines();
    if (!lines.length) throw new Error("Tu carrito está vacío");
    const e1 = validEntrega(c); if (e1) { c.err = e1; D().ui.step = "entrega"; D().render(); return; }
    if (!PAY[c.payment]) { c.err = "Elige cómo pagarás."; D().render(); return; }
    if (isQr(c.payment) && !c.proof) { c.err = `Sube la captura de tu ${PAY[c.payment]} para apartar el pedido, o elige otra forma de pago.`; D().render(); return; }
    const geoRow = c.delivery === "ENVIO" && geo.rows ? geo.rows.find((r) => r.departamento === c.departamento && r.provincia === c.provincia && r.distrito === c.distrito) : null;
    c.err = ""; c.placing = true; D().render();
    try {
      const r = await api().createWebOrder({ items: lines.map(({ line, p }) => ({ variant_id: p.variant_id || p.id, qty: line.qty })), delivery: c.delivery, payment: c.payment,
        storeId: c.delivery === "RECOJO" ? c.storeId : null, ubigeo: geoRow ? geoRow.code : null, departamento: c.departamento, provincia: c.provincia, distrito: c.distrito,
        direccion: c.delivery === "ENVIO" ? c.direccion : null, referencia: c.delivery === "ENVIO" ? c.referencia : null, nota: c.nota, phone: D().normPhone(c.phone) });
      const done = Object.assign({ payment_method: c.payment }, r);
      if (isQr(c.payment)) {
        try { const path = await api().uploadOrderProof(c.proof, r.id); const a = await api().attachOrderProof(r.id, path); done.status = a.status; }
        catch (err) { done.warn = "Tu pedido quedó registrado, pero no pudimos subir la captura (" + human(err) + "). Envíala por WhatsApp con tu código " + (r.public_code || "") + "."; }
      }
      D().ui.cart = []; D().saveCart(); D().ui.coDone = done; D().ui.step = "listo"; D().ui.co = { delivery: c.delivery, payment: "CONTRA_ENTREGA", storeId: c.storeId, phone: c.phone };
      my.loaded = false; await D().reload();
    } catch (err) { c.err = human(err); }
    c.placing = false; D().render(); window.scrollTo(0, 0);
  }

  // ================= Mis pedidos =================
  const my = { rows: [], loaded: false, loading: false, err: "", open: {}, hist: {}, uid: null };
  function loadMine() {
    if (my.loading) return; my.loading = true;
    api().myOrders(50, 0).then((r) => { my.rows = r || []; my.err = ""; }).catch((e) => { my.err = human(e); }).finally(() => { my.loading = false; my.loaded = true; D().render(); });
  }
  function seqFor(o, hist) {
    const base = o.delivery === "ENVIO" ? ["RECIBIDO", "CONFIRMADO", "EN_PREPARACION", "EMPAQUETADO", "ENVIADO", "ENTREGADO"] : ["RECIBIDO", "CONFIRMADO", "EN_PREPARACION", "LISTO_PARA_RECOGER", "ENTREGADO"];
    if (isQr(o.payment_method)) base.splice(1, 0, "PAGO_EN_REVISION");
    if (o.status === "CANCELADO" || o.status === "RECHAZADO") { const seen = uniq((hist || []).map((h) => h.status).filter((s) => s !== o.status)); return (seen.length ? seen : ["RECIBIDO"]).concat([o.status]); }
    return base;
  }
  function trackHtml(o) {
    const hist = my.hist[o.id];
    if (!hist) return `<p class="tiny muted">Cargando seguimiento…</p>`;
    if (hist.err) return `<p class="alert-text">${esc(hist.err)}</p>`;
    const seq = seqFor(o, hist.rows); const idx = Math.max(0, seq.indexOf(o.status));
    const last = (s) => hist.rows.filter((h) => h.status === s).slice(-1)[0];
    return `<ol class="track">${seq.map((s, i) => { const h = last(s); const cls = o.status === "ENTREGADO" || i < idx ? "done" : i === idx ? "now" : ""; return `<li class="track-step ${cls}"><div><b>${esc((h && h.label) || LABEL[s] || s)}</b>${h ? `<small>${esc(fecha(h.at))}${h.note && !/migraci/i.test(h.note) ? " · " + esc(h.note) : ""}</small>` : ""}</div></li>`; }).join("")}</ol>`;
  }
  function myCard(o) {
    const canCancel = ["RECIBIDO", "PAGO_EN_REVISION", "RECHAZADO"].includes(o.status);
    const where = o.delivery === "ENVIO" ? "Envío" + (o.distrito ? " a " + o.distrito : "") : "Recojo en " + (o.store_name || "tienda");
    return `<article class="panel stack my-order"><div class="row order-head"><b class="order-code">${esc(o.public_code || "")}</b><span class="badge order-st st-${esc(o.status)}">${esc(o.status_label || LABEL[o.status] || o.status)}</span></div>
      <p class="tiny">${esc(fecha(o.created_at))} · ${esc(where)} · ${esc(PAY[o.payment_method] || "")}${isQr(o.payment_method) && !o.has_proof ? " · falta la captura" : ""}</p>
      <div class="stack">${(o.items || []).map((i) => `<div class="row tiny"><span class="grow">${esc(i.product_name)}${i.variant_label ? " · " + esc(i.variant_label) : ""} × ${esc(i.quantity)}</span><span>${money(i.line_total)}</span></div>`).join("")}</div>
      <div class="row total-row"><span>Total</span><b>${money(o.total)}</b></div>
      ${o.status === "RECHAZADO" && o.cancel_reason ? `<p class="alert-text">Pago observado: ${esc(o.cancel_reason)}</p>` : o.status === "CANCELADO" && o.cancel_reason ? `<p class="tiny muted">Motivo: ${esc(o.cancel_reason)}</p>` : ""}
      ${my.open[o.id] ? trackHtml(o) : ""}
      <div class="row" style="justify-content:flex-start;flex-wrap:wrap">
        <button class="btn ghost small" type="button" data-act="mo-track" data-id="${esc(o.id)}" aria-expanded="${!!my.open[o.id]}">${my.open[o.id] ? "Ocultar seguimiento" : "Ver seguimiento"}</button>
        ${isQr(o.payment_method) && ["RECIBIDO", "RECHAZADO"].includes(o.status) ? `<label class="btn small">Subir captura<input type="file" accept="image/*" hidden data-mo-proof="${esc(o.id)}"></label>` : ""}
        ${canCancel ? `<button class="btn ghost small" type="button" data-act="mo-cancel" data-id="${esc(o.id)}">Cancelar pedido</button>` : ""}
        <a class="support-link" target="_blank" rel="noopener" href="${esc(supportHref("Hola DAN-LINER, consulto por mi pedido " + (o.public_code || "") + "."))}">Ayuda</a>
      </div></article>`;
  }
  function renderMine() {
    const st = D().state;
    if (!st.user) return `<section class="stack" style="padding:28px 0 56px;max-width:640px"><p class="kicker">Mis pedidos</p><h1>Entra para ver tus pedidos</h1><p class="muted">Tus pedidos web aparecen aquí con su estado.</p><a class="btn" href="#entrar" data-act="login-for" data-id="mis-pedidos">Entrar</a></section>`;
    if (my.uid !== st.user.id) { my.uid = st.user.id; my.loaded = false; my.rows = []; my.open = {}; my.hist = {}; }
    if (!my.loaded) loadMine();
    const body = !my.loaded ? `<p class="muted">Cargando tus pedidos…</p>` : my.err ? `<p class="alert-text">${esc(my.err)}</p>` : my.rows.length ? `<div class="stack orders-list">${my.rows.map(myCard).join("")}</div>` : `<p class="muted">Todavía no tienes pedidos.</p><a class="btn" href="#coleccion">Ver la colección</a>`;
    return `<section class="stack" style="padding:28px 0 56px;max-width:680px"><p class="kicker">Mis pedidos</p><h1>Tus pedidos</h1>${body}<a class="link-btn" href="#cuenta">← Mi cuenta</a></section>`;
  }

  // ================= Pedidos web (personal) =================
  const q = { rows: [], loaded: false, loading: false, err: "", store: "", status: "abiertos", proofs: {}, key: "" };
  const NEXT = (o) => {
    const R = o.delivery === "RECOJO", E = o.delivery === "ENVIO", m = {
      RECIBIDO: ["CONFIRMADO", "CANCELADO"], PAGO_EN_REVISION: ["CONFIRMADO", "RECHAZADO", "CANCELADO"], RECHAZADO: ["CANCELADO"],
      CONFIRMADO: ["EN_PREPARACION", R ? "LISTO_PARA_RECOGER" : "EMPAQUETADO", "CANCELADO"], EN_PREPARACION: [R ? "LISTO_PARA_RECOGER" : "EMPAQUETADO", "CANCELADO"],
      EMPAQUETADO: [E ? "ENVIADO" : "LISTO_PARA_RECOGER", "CANCELADO"], ENVIADO: ["ENTREGADO", "CANCELADO"], LISTO_PARA_RECOGER: ["ENTREGADO", "CANCELADO"] }[o.status] || [];
    return m.filter((s) => !(s === "CONFIRMADO" && isQr(o.payment_method) && !o.proof_path));
  };
  const BTN = { CONFIRMADO: "Confirmar", EN_PREPARACION: "Preparando", EMPAQUETADO: "Empaquetado", ENVIADO: "Enviado", LISTO_PARA_RECOGER: "Listo para recoger", ENTREGADO: "Entregado", RECHAZADO: "Observar pago", CANCELADO: "Cancelar" };
  function loadQueue(storeId) {
    if (q.loading) return; q.loading = true;
    api().getOrders({ storeId: storeId || q.store || null, status: q.status === "abiertos" || q.status === "todos" ? null : q.status, limit: 200 })
      .then((r) => { q.rows = r || []; q.err = ""; }).catch((e) => { q.err = human(e); q.rows = []; }).finally(() => { q.loading = false; q.loaded = true; D().render(); });
  }
  function qCard(o) {
    const items = ((D().state.orders || []).find((x) => String(x.id) === String(o.order_id)) || {}).items || [];
    const tel = String(o.contact_phone || "").replace(/\D/g, "");
    const next = NEXT(o);
    const where = o.delivery === "ENVIO" ? `Envío · ${[o.direccion, o.distrito, o.provincia, o.departamento].filter(Boolean).join(", ")}${o.referencia ? " · Ref.: " + o.referencia : ""}` : "Recojo en " + (o.store_name || "");
    return `<article class="panel stack order-card q-order st-${esc(o.status)}"><div class="row order-head"><b class="order-code">${esc(o.public_code)}</b><span class="tiny muted">${esc(o.internal_code || "")}</span><span class="badge order-st st-${esc(o.status)}">${esc(LABEL[o.status] || o.status)}</span></div>
      <p class="tiny">${esc(fecha(o.created_at))} · ${esc(o.store_name || "")}</p>
      <p><b>${esc(o.customer_name || "Cliente")}</b>${o.customer_dni ? ` · DNI ${esc(o.customer_dni)}` : ""}${o.is_wholesale ? ` <span class="tag-mayorista">Mayorista</span>` : ""}${tel ? ` · <a href="https://wa.me/${esc(waNum(tel.replace(/^51/, "")))}" target="_blank" rel="noopener">${esc(o.contact_phone)}</a>` : ""}</p>
      <p class="tiny">${esc(where)}</p>
      ${items.length ? `<div class="stack">${items.map((i) => `<div class="row tiny"><span class="grow">${esc(i.name)}${i.label ? " · " + esc(i.label) : ""} × ${i.qty}</span><span>${D().soles(i.line_cents)}</span></div>`).join("")}</div>` : `<p class="tiny">${esc(o.units)} prenda(s)</p>`}
      ${o.notes ? `<p class="tiny">Nota: ${esc(o.notes)}</p>` : ""}
      <div class="row total-row"><span>${esc(PAY[o.payment_method] || o.payment_method)}</span><b>${money(o.total)}</b></div>
      ${isQr(o.payment_method) ? (o.proof_path ? `<div class="stack">${q.proofs[o.order_id] ? `<a href="${esc(q.proofs[o.order_id])}" target="_blank" rel="noopener"><img class="proof-img" alt="Comprobante de pago" src="${esc(q.proofs[o.order_id])}" width="160" height="220"></a>` : `<button class="btn ghost small" type="button" data-act="q-proof" data-id="${esc(o.order_id)}" data-path="${esc(o.proof_path)}">Ver comprobante</button>`}</div>` : `<p class="tiny bad">Sin comprobante todavía</p>`) : ""}
      ${next.length ? `<div class="row" style="flex-wrap:wrap;justify-content:flex-start">${next.map((s) => `<button class="btn small ${s === "CANCELADO" || s === "RECHAZADO" ? "danger ghost" : ""}" type="button" data-act="q-status" data-id="${esc(o.order_id)}" data-s="${s}">${esc(BTN[s])}</button>`).join("")}</div>` : ""}
    </article>`;
  }
  function renderQueue(storeId) {
    const key = String(storeId || "") + "|" + q.store + "|" + q.status;
    if (q.key !== key) { q.key = key; q.loaded = false; }
    if (!q.loaded) loadQueue(storeId);
    const stores = D().state.pubStores || [];
    const rows = q.status === "abiertos" ? q.rows.filter((o) => OPEN.includes(o.status)) : q.rows;
    const chips = [["abiertos", "Abiertos"], ["RECIBIDO", "Recibidos"], ["PAGO_EN_REVISION", "Pago por confirmar"], ["CONFIRMADO", "Confirmados"], ["LISTO_PARA_RECOGER", "Listos"], ["ENVIADO", "En camino"], ["ENTREGADO", "Entregados"], ["CANCELADO", "Cancelados"], ["todos", "Todos"]];
    return `<div class="stack orders-panel">
      <div class="row" style="flex-wrap:wrap;gap:8px">${!storeId ? `<label class="tiny">Tienda<select id="q-store">${`<option value="">Todas</option>` + stores.map((s) => `<option value="${esc(s.id)}" ${q.store === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>` : ""}
        <button class="chip" type="button" data-act="q-refresh">Actualizar</button></div>
      <div class="tabs order-filters" id="q-tabs">${chips.map(([k, l]) => `<button type="button" class="chip ${q.status === k ? "on" : ""}" data-act="q-filter" data-id="${k}">${l}</button>`).join("")}</div>
      <p class="tiny order-note">Primero los más antiguos. Confirmar aparta el stock; Entregado lo descuenta (o se libera si se cobró en Caja).</p>
      ${!q.loaded ? `<p class="muted">Cargando pedidos…</p>` : q.err ? `<p class="alert-text">${esc(q.err)}</p>` : rows.length ? rows.map(qCard).join("") : `<p class="muted">No hay pedidos en esta vista.</p>`}
    </div>`;
  }
  window.DL_ORDERS_PANEL = renderQueue;

  // ================= Eventos =================
  window.DL_SCREENS = Object.assign(window.DL_SCREENS || {}, { pedido: renderCheckout, "mis-pedidos": renderMine });
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, {
    "co-entrega": async (form) => { const c = readForm(form); c.err = validEntrega(c); if (c.err) { D().render(); return; } D().ui.step = "pago"; D().render(); window.scrollTo(0, 0); },
    "co-pago": async (form) => { readForm(form); await place(); },
  });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "co-copy": async (el) => { const v = el.dataset.v || ""; try { await navigator.clipboard.writeText(v); D().toast("Número copiado: " + v); } catch (e) { await window.dlgPrompt("Mantén presionado el número para copiarlo:", v, { title: "Copiar número", ok: "Listo", cancel: "Cerrar" }); } },
    "co-step": (el) => { const c = co(); c.err = ""; const f = document.querySelector(".co-form"); if (f) readForm(f); if (el.dataset.id === "carrito") { D().ui.step = "carrito"; D().render(); } else { D().ui.step = el.dataset.id; D().render(); } window.scrollTo(0, 0); },
    "mo-track": async (el) => { const id = el.dataset.id; my.open[id] = !my.open[id]; D().render(); if (my.open[id] && !my.hist[id]) { try { my.hist[id] = { rows: (await api().orderHistory(id)) || [] }; } catch (e) { my.hist[id] = { err: human(e) }; } D().render(); } },
    "mo-cancel": async (el) => {
      const reason = await window.dlgPrompt("¿Por qué cancelas? (opcional)", "", { title: "Cancelar pedido", ok: "Sí, cancelar pedido", cancel: "No, volver", danger: true });
      if (reason === null) return;
      await api().cancelMyOrder(el.dataset.id, reason.trim() || null); my.loaded = false; delete my.hist[el.dataset.id]; D().render(); D().toast("Pedido cancelado", "ok");
    },
    "q-filter": (el) => { q.status = el.dataset.id; D().render(); },
    "q-refresh": () => { q.loaded = false; D().render(); },
    "q-proof": async (el) => { const url = await api().proofUrl(el.dataset.path); if (!url) throw new Error("No se pudo abrir el comprobante."); q.proofs[el.dataset.id] = url; D().render(); },
    "q-status": async (el) => {
      const s = el.dataset.s; let reason = null;
      if (s === "CANCELADO" || s === "RECHAZADO") {
        reason = await window.dlgPrompt(s === "RECHAZADO" ? "¿Qué observas en el pago? El cliente lo verá." : "Motivo de la cancelación (el cliente lo verá).", "", { title: s === "RECHAZADO" ? "Observar pago" : "Cancelar pedido", ok: s === "RECHAZADO" ? "Observar pago" : "Cancelar pedido", danger: true });
        if (reason === null) return; reason = reason.trim(); if (!reason) throw new Error("Escribe el motivo.");
      } else if (!await window.dlgConfirm(`¿Marcar el pedido como «${LABEL[s]}»?`, { ok: BTN[s] })) return;
      await api().setOrderStatus(el.dataset.id, s, reason); q.loaded = false; D().state.orders = await api().orders().catch(() => D().state.orders); D().render(); D().toast("Pedido actualizado: " + LABEL[s], "ok");
    },
  });
  document.addEventListener("change", (e) => {
    const t = e.target; if (!t) return;
    if (t.id === "q-store") { q.store = t.value; D().render(); return; }
    if (t.dataset && t.dataset.moProof && t.files && t.files[0]) {
      const id = t.dataset.moProof;
      window.DL_compressProof(t.files[0]).then((u) => api().uploadOrderProof(u, id)).then((path) => api().attachOrderProof(id, path))
        .then(() => { my.loaded = false; D().render(); D().toast("Captura enviada. Revisaremos tu pago.", "ok"); }).catch((err) => D().toast(human(err), "error"));
      return;
    }
    const form = t.closest && t.closest(".co-form"); if (!form) return;
    const c = co();
    if (t.name === "proof" && t.files && t.files[0]) { readForm(form); (window.DL_compressProof ? window.DL_compressProof(t.files[0]) : Promise.reject(new Error("No se pudo leer la imagen"))).then((u) => { c.proof = u; c.err = ""; D().render(); }).catch((err) => { c.err = human(err); D().render(); }); return; }
    const before = [c.delivery, c.departamento, c.provincia, c.storeId, c.payment].join("|");
    readForm(form);
    if (t.name === "departamento") { c.provincia = ""; c.distrito = ""; }
    if (t.name === "provincia") { c.distrito = ""; }
    if (before !== [c.delivery, c.departamento, c.provincia, c.storeId, c.payment].join("|")) { c.err = ""; D().render(); }
  });
})();
