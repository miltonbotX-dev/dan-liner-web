// modules/impresion/impresion.service.js · comprobante en PDF 80 mm (jsPDF) y texto para RawBT. Sin interfaz:
// recibe un "modelo de comprobante" { biz, st, doc, sale, when, items:[{quantity, desc, unit_price_cents, line_total_cents}], pays:[{label, cents}] }.
(function () {
  let jsPdfP = null;
  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!jsPdfP) jsPdfP = new Promise((ok, ko) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"; sc.async = true; sc.onload = () => (window.jspdf && window.jspdf.jsPDF ? ok(window.jspdf.jsPDF) : ko(new Error("No se cargó el generador de PDF"))); sc.onerror = () => { jsPdfP = null; ko(new Error("Sin internet: no se pudo cargar el generador de PDF")); }; document.head.appendChild(sc); });
    return jsPdfP;
  }
  const money2 = (c) => "S/ " + (Number(c || 0) / 100).toFixed(2);
  // v34 (BD v19): plantilla de impresión (get_receipt_template) que deja en caché v34.v19.js → ancho, márgenes, letra, encabezado y pie.
  const tplOf = (m) => (window.DL_RECEIPT_TPL ? window.DL_RECEIPT_TPL((m.sale && m.sale.doc_type) || "BOLETA", m.sale && m.sale.store_id) : null) || null;
  const lines = (t) => String(t || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  async function ticketPdf(m) {
    const JsPDF = await loadJsPdf();
    const { st, doc, biz, sale } = m;
    const T = tplOf(m) || {};
    const W = Number(T.paper_width_mm) === 58 ? 58 : 80; const ML = T.margin_left_mm != null ? Number(T.margin_left_mm) : 4; const MR = T.margin_right_mm != null ? Number(T.margin_right_mm) : 4;
    const M = ML, CW = W - ML - MR, RX = W - MR, CX = ML + CW / 2, F = T.font_size_pt ? Number(T.font_size_pt) / 8 : 1; const total = Number(sale.total_cents); const base = Math.round(total / 1.18);
    const draw = (pdf) => {
      let y = 2 + (T.margin_top_mm != null ? Number(T.margin_top_mm) : 4); const lh = 3.6 * F;
      const fs = (size) => (size || 8) * F;
      const c = (t, size, bold) => { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(fs(size)); pdf.splitTextToSize(String(t), CW).forEach((ln) => { pdf.text(ln, CX, y, { align: "center" }); y += lh * (size || 8) / 8; }); };
      const l = (t, size, bold) => { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(fs(size)); pdf.splitTextToSize(String(t), CW).forEach((ln) => { pdf.text(ln, M, y); y += lh; }); };
      const lr = (a, b, bold, size) => { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(fs(size)); const left = pdf.splitTextToSize(String(a), CW - 22 * F); left.forEach((ln, k) => { pdf.text(ln, M, y); if (k === 0) pdf.text(String(b), RX, y, { align: "right" }); y += lh * (size || 8) / 8; }); };
      const hr = () => { pdf.setLineDashPattern([0.8, 0.8], 0); pdf.line(M, y - 1.6, RX, y - 1.6); y += 1.6; };
      c(biz.name || "Dan Liner", 12, true); c("RUC " + (biz.ruc || "(pendiente)")); if (biz.address) c(biz.address);
      if (st.name) c(st.name, 8, true); if (st.address) c(st.address); if (st.phone) c("Tel. " + st.phone);
      lines(T.header_text).forEach((t) => c(t, 7));
      y += 1; hr(); c(doc.title, 9, true); c(sale.sale_number, 10, true); hr();
      l("Fecha: " + m.when);
      l((sale.doc_type === "FACTURA" ? "Razón social: " : "Cliente: ") + (sale.customer_name || "Varios"));
      if (sale.customer_doc) l((sale.doc_type === "FACTURA" ? "RUC: " : "Doc.: ") + sale.customer_doc);
      if (sale.customer_address) l("Dirección: " + sale.customer_address);
      if (sale.seller_name) l("Vendedor: " + sale.seller_name);
      hr();
      m.items.forEach((i) => { lr(i.quantity + " x " + i.desc, money2(i.line_total_cents)); if (i.quantity > 1) { pdf.setFontSize(fs(7)); pdf.text("   P.U. " + money2(i.unit_price_cents), M, y); y += 3.2 * F; } });
      hr();
      if (sale.discount_cents) lr("Descuento", "-" + money2(sale.discount_cents));
      if (sale.doc_type !== "TICKET") { lr("Op. gravada", money2(base)); lr("IGV 18%", money2(total - base)); }
      lr("TOTAL", money2(total), true, 11); y += 1;
      m.pays.forEach((p) => lr(p.label, money2(p.cents)));
      if (sale.status === "VOID") { y += 1; c("*** ANULADA ***", 10, true); }
      y += 2; c(sale.doc_type === "TICKET" ? "Documento interno, no válido como comprobante" : "Representación impresa del comprobante", 7);
      if (lines(T.footer_text).length) lines(T.footer_text).forEach((t) => c(t, 7)); else if (biz.footer) c(biz.footer, 7); else c("¡Gracias por tu compra!", 8, true);
      return y + 6;
    };
    const probe = new JsPDF({ unit: "mm", format: [W, 600] }); const H = Math.max(90, Math.ceil(draw(probe)));
    const pdf = new JsPDF({ unit: "mm", format: [W, H] }); draw(pdf);
    pdf.setProperties({ title: doc.title + " " + sale.sale_number });
    return new File([pdf.output("blob")], String(sale.sale_number).replace(/[^\w-]+/g, "_") + ".pdf", { type: "application/pdf" });
  }
  function rawbtText(m, cols) {
    const { st, doc, biz, sale } = m;
    // v34: plantilla → columnas según ancho del papel (58 mm = 32, 80 mm = 48; sin plantilla 32), margen izquierdo en espacios (~1,5 mm c/u), margen superior en líneas en blanco.
    const T = tplOf(m) || {};
    const pad = T.margin_left_mm != null ? Math.max(0, Math.round((Number(T.margin_left_mm) - 3) / 1.5)) : 0;
    const N = Math.max(24, (cols || (Number(T.paper_width_mm) === 80 ? 48 : 32)) - pad); const out = []; // chars_per_line de la BD es para PDF; la ticketera usa fuente fija.
    const line = "-".repeat(N);
    const wrap = (t) => { const words = String(t).split(/\s+/); const rows = []; let cur = ""; words.forEach((w) => { while (w.length > N) { if (cur) { rows.push(cur); cur = ""; } rows.push(w.slice(0, N)); w = w.slice(N); } if ((cur + " " + w).trim().length > N) { rows.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }); if (cur) rows.push(cur); return rows; };
    const center = (t) => wrap(t).forEach((r) => out.push(" ".repeat(Math.max(0, Math.floor((N - r.length) / 2))) + r));
    const lr = (a, b) => { b = String(b); const rows = wrap(a); rows.forEach((r, k) => { if (k === rows.length - 1 && r.length + b.length + 1 <= N) out.push(r + " ".repeat(N - r.length - b.length) + b); else out.push(r); }); if (rows.length && rows[rows.length - 1].length + b.length + 1 > N) out.push(" ".repeat(N - b.length) + b); };
    const total = Number(sale.total_cents); const base = Math.round(total / 1.18);
    center((biz.name || "DAN LINER").toUpperCase()); center("RUC " + (biz.ruc || "(pendiente)")); if (biz.address) center(biz.address); if (st.name) center(st.name); if (st.address) center(st.address); if (st.phone) center("Tel. " + st.phone);
    lines(T.header_text).forEach((t) => center(t));
    out.push(line); center(doc.title); center(sale.sale_number); out.push(line);
    out.push("Fecha: " + m.when);
    wrap((sale.doc_type === "FACTURA" ? "Razon social: " : "Cliente: ") + (sale.customer_name || "Varios")).forEach((r) => out.push(r));
    if (sale.customer_doc) out.push((sale.doc_type === "FACTURA" ? "RUC: " : "Doc.: ") + sale.customer_doc);
    if (sale.customer_address) wrap("Dir.: " + sale.customer_address).forEach((r) => out.push(r));
    out.push(line);
    m.items.forEach((i) => { lr(i.quantity + " x " + i.desc, money2(i.line_total_cents)); if (i.quantity > 1) out.push("  P.U. " + money2(i.unit_price_cents)); });
    out.push(line);
    if (sale.discount_cents) lr("Descuento", "-" + money2(sale.discount_cents));
    if (sale.doc_type !== "TICKET") { lr("Op. gravada", money2(base)); lr("IGV 18%", money2(total - base)); }
    lr("TOTAL", money2(total));
    m.pays.forEach((p) => lr(p.label, money2(p.cents)));
    if (sale.status === "VOID") center("*** ANULADA ***");
    out.push(line); center(sale.doc_type === "TICKET" ? "Documento interno" : "Representacion impresa"); if (lines(T.footer_text).length) lines(T.footer_text).forEach((t) => center(t)); else center(biz.footer || "Gracias por tu compra");
    const top = T.margin_top_mm != null ? Math.round(Number(T.margin_top_mm) / 4) : 0;
    return "\n".repeat(top) + out.map((r) => " ".repeat(pad) + r).join("\n") + "\n\n\n\n";
  }
  function rawbtUrl(text, android) {
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
    // RawBT convierte el texto UTF-8 a la codificación de la impresora (rawbt:data:text/plain;base64,…)
    return android ? "intent:data:text/plain;base64," + b64 + "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;" : "rawbt:data:text/plain;base64," + b64;
  }
  window.DL_Print = { loadJsPdf, ticketPdf, rawbtText, rawbtUrl };
})();
