// modules/v34/v34.export.js · Exportar a Excel (.xlsx real, sin librerías) y a PDF (vista de impresión → «Guardar como PDF»).
// Usado por Administración → Ventas y Comprobantes. Solo datos que el usuario ya puede ver.
(function () {
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const xml = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  // ---- ZIP «stored» (sin compresión) ----
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i += 1) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
    const u16 = (n) => [n & 255, (n >>> 8) & 255]; const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    files.forEach(([name, text]) => {
      const nb = enc.encode(name); const data = enc.encode(text); const crc = crc32(data);
      const head = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)];
      parts.push(new Uint8Array(head), nb, data);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
      off += head.length + nb.length + data.length;
    });
    const csize = central.reduce((n, p) => n + p.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), 0, 0]);
    return new Blob(parts.concat(central, [end]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  const colName = (i) => { let s = ""; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  // cols: [{ key, label, type: "text"|"num"|"money", width }]
  function xlsxBlob(sheet, cols, rows, title) {
    const head = title ? 1 : 0; const all = [];
    const cell = (r, c, v, col, bold) => {
      const ref = colName(c) + (r + 1);
      if (!bold && col && (col.type === "num" || col.type === "money") && v !== "" && v != null && Number.isFinite(Number(v))) return `<c r="${ref}" s="${col.type === "money" ? 2 : 0}"><v>${Number(v)}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ""}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    };
    if (title) all.push(`<row r="1">${cell(0, 0, title, null, true)}</row>`);
    all.push(`<row r="${head + 1}">${cols.map((c, i) => cell(head, i, c.label, null, true)).join("")}</row>`);
    rows.forEach((row, k) => { const r = head + 1 + k; all.push(`<row r="${r + 1}">${cols.map((c, i) => cell(r, i, row[c.key], c)).join("")}</row>`); });
    const widths = `<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 16}" customWidth="1"/>`).join("")}</cols>`;
    const ws = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${head + 1}" topLeftCell="A${head + 2}" state="frozen"/></sheetView></sheetViews>${widths}<sheetData>${all.join("")}</sheetData></worksheet>`;
    const name = xml(String(sheet || "Hoja1").replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    return zip([
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;S/&quot; #,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>'],
      ["xl/worksheets/sheet1.xml", ws],
    ]);
  }
  function save(blob, filename) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const fmt = (v, c) => (c.type === "money" ? (v === "" || v == null ? "" : "S/ " + Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : v == null ? "" : String(v));
  // PDF: documento imprimible en un iframe oculto; el usuario elige «Guardar como PDF».
  function pdf(title, subtitle, cols, rows, totals) {
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4 landscape;margin:12mm}body{font:11px/1.35 system-ui,Arial,sans-serif;color:#111}h1{font-size:16px;margin:0 0 2px}p{margin:0 0 10px;color:#555}
      table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f2f2f2}td.n,th.n{text-align:right;white-space:nowrap}tfoot td{font-weight:700;border-top:2px solid #111}
    </style></head><body><h1>DAN-LINER · ${esc(title)}</h1><p>${esc(subtitle || "")} · ${rows.length} filas · generado ${esc(new Date().toLocaleString("es-PE"))}</p>
    <table><thead><tr>${cols.map((c) => `<th class="${c.type === "money" || c.type === "num" ? "n" : ""}">${esc(c.label)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.type === "money" || c.type === "num" ? "n" : ""}">${esc(fmt(r[c.key], c))}</td>`).join("")}</tr>`).join("")}</tbody>
    ${totals ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.type === "money" || c.type === "num" ? "n" : ""}">${i === 0 ? "Total" : esc(totals[c.key] != null ? fmt(totals[c.key], c) : "")}</td>`).join("")}</tr></tfoot>` : ""}</table></body></html>`;
    const fr = document.createElement("iframe"); fr.setAttribute("aria-hidden", "true"); fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(fr);
    const d = fr.contentDocument; d.open(); d.write(html); d.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { } setTimeout(() => fr.remove(), 60000); }, 250);
  }
  const sumBy = (rows, cols) => { const t = {}; cols.forEach((c) => { if (c.type === "money" || c.sum) t[c.key] = Math.round(rows.reduce((n, r) => n + (Number(r[c.key]) || 0), 0) * 100) / 100; }); return t; };
  window.DL_EXPORT = { xlsx: (file, sheet, cols, rows, title) => save(xlsxBlob(sheet, cols, rows, title), file), pdf, sumBy, xlsxBlob };

  // ---------- Ventas (Administración → Ventas) ----------
  const D = () => window.DL;
  const SALE_COLS = [
    { key: "fecha", label: "Fecha", width: 18 }, { key: "numero", label: "Comprobante", width: 18 }, { key: "estado", label: "Estado", width: 11 },
    { key: "tienda", label: "Tienda", width: 18 }, { key: "vendedor", label: "Vendedor", width: 18 }, { key: "cliente", label: "Cliente", width: 24 },
    { key: "doc", label: "DNI/RUC", width: 13 }, { key: "pago", label: "Pago", width: 13 }, { key: "unidades", label: "Unid.", type: "num", width: 7, sum: true },
    { key: "descuento", label: "Descuento", type: "money", width: 12 }, { key: "total", label: "Total", type: "money", width: 12 },
  ];
  function saleRows() {
    const X = D(); const sales = (X.salesForExport ? X.salesForExport() : []).slice().sort((a, b) => String(a.sold_at).localeCompare(String(b.sold_at)));
    const items = X.state.data.sale_items || []; const units = new Map();
    items.forEach((i) => units.set(i.sale_id, (units.get(i.sale_id) || 0) + Number(i.quantity || 0)));
    const st = new Map((X.state.data.stores || []).map((s) => [String(s.id), s.name]));
    return sales.map((s) => ({
      fecha: s.sold_at ? new Date(s.sold_at).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" }) : "",
      numero: s.sale_number || "", estado: s.status === "COMPLETED" ? "Completada" : s.status === "VOID" || s.db_status === "ANULADA" ? "Anulada" : String(s.status || ""),
      tienda: st.get(String(s.store_id)) || "", vendedor: s.seller_name || "", cliente: s.customer_name || "", doc: s.customer_doc || "",
      pago: X.PAY[s.payment_method] || (s.payment_method === "MIXTO" ? "Mixto" : s.payment_method || ""), unidades: units.get(s.id) || 0,
      descuento: Number(s.discount_cents || 0) / 100, total: s.status === "COMPLETED" ? Number(s.total_cents || 0) / 100 : 0,
    }));
  }
  const range = () => { const f = (D().salesFilterNow && D().salesFilterNow()) || {}; return { from: f.from || "inicio", to: f.to || "hoy" }; };
  const A = window.DL_ACTIONS = window.DL_ACTIONS || {};
  A["v34-sales-xlsx"] = () => { const rows = saleRows(); if (!rows.length) return D().toast("No hay ventas en este rango."); const r = range(); window.DL_EXPORT.xlsx(`ventas_${r.from}_${r.to}.xlsx`, "Ventas", SALE_COLS, rows); D().toast(`Excel listo: ${rows.length} ventas.`); };
  A["v34-sales-pdf"] = () => { const rows = saleRows(); if (!rows.length) return D().toast("No hay ventas en este rango."); const r = range(); window.DL_EXPORT.pdf("Ventas", `Del ${r.from} al ${r.to} (las anuladas suman 0)`, SALE_COLS, rows, sumBy(rows, SALE_COLS)); };
})();
