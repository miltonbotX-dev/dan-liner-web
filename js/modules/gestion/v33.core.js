// modules/gestion/v33.core.js · utilidades comunes BD v18 (API_V18.md): fechas, normalización, compresión y subida de imágenes.
// Subidas: bucket público «avatars», carpeta propia avatars/<uid>/ (≤200 KB, webp/jpeg). Es el único bucket con escritura para cualquier
// usuario con sesión; el admin lo usa también para QR de Yape/Plin, fotos de tela y fotos por vista (o pega un enlace https / Drive).
(function () {
  const D = () => window.DL;
  const S = () => window.Store;
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const todayLima = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  const fday = (d) => (d ? new Date(String(d).slice(0, 10) + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" }).replace(".", "") : "");
  const cssUrl = (u) => `url("${String(u || "").replace(/["\\\n\r]/g, encodeURIComponent)}")`;
  const human = (e) => { const t = String((e && e.message) || e || ""); if (/could not find the function|schema cache/i.test(t)) return "Esta función aún no está activa en la base de datos."; if (/permission denied|row-level|42501/i.test(t)) return "Tu cuenta no tiene permiso para esto."; if (/failed to fetch|network/i.test(t)) return "Sin conexión. Intenta de nuevo."; return t || "No se pudo completar."; };
  // Imagen → Blob webp (o jpeg) que quepa en maxBytes, reduciendo lado y calidad.
  async function compress(file, maxSide, maxBytes) {
    if (!file || !/^image\//.test(file.type || "")) throw new Error("Elige una imagen.");
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("No se pudo leer la imagen.")); i.src = url; });
      const canWebp = document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
      const type = canWebp ? "image/webp" : "image/jpeg";
      let side = maxSide || 800;
      for (let round = 0; round < 6; round += 1) {
        const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const g = c.getContext("2d"); if (type === "image/jpeg") { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); } g.drawImage(img, 0, 0, c.width, c.height);
        for (const q of [0.85, 0.75, 0.65, 0.55]) {
          const blob = await new Promise((ok) => c.toBlob(ok, type, q));
          if (blob && blob.size <= (maxBytes || 200 * 1024)) return blob;
        }
        side = Math.round(side * 0.75);
      }
      throw new Error("La imagen es muy pesada; prueba con otra.");
    } finally { URL.revokeObjectURL(url); }
  }
  // Sube a avatars/<uid>/<name>.<ext>; devuelve { path: "avatars/<uid>/…", url: URL pública }.
  async function uploadOwn(name, blob) {
    const st = S(); if (!st || !st.token || !st.user) throw new Error("Inicia sesión.");
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const file = String(name || "img").replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 60) + "-" + Date.now() + "." + ext;
    const path = st.user.id + "/" + file;
    const res = await fetch(st.cfg.url + "/storage/v1/object/avatars/" + path, { method: "POST", headers: { apikey: st.cfg.key, Authorization: "Bearer " + st.token.access_token, "Content-Type": blob.type, "x-upsert": "false" }, body: blob });
    if (!res.ok) { const t = await res.json().catch(() => ({})); throw new Error("No se pudo subir la imagen: " + (t.message || t.error || res.status)); }
    return { path: "avatars/" + path, url: st.cfg.url + "/storage/v1/object/public/avatars/" + path };
  }
  const publicUrl = (p) => { const v = String(p || ""); if (!v) return ""; if (/^https?:\/\//i.test(v)) return v; const st = S(); return st && st.cfg ? st.cfg.url + "/storage/v1/object/public/" + v.replace(/^\/+/, "") : ""; };
  const rpc = (n, p) => S().rpc(n, p || {});
  const busy = {};
  async function once(key, fn, box, after) {
    if (busy[key]) return; busy[key] = true;
    try { box.data = await fn(); box.err = ""; } catch (e) { box.err = human(e); }
    busy[key] = false; box.loaded = true; if (after) after(); else if (D()) D().render();
  }
  window.DL33 = { norm, todayLima, fday, cssUrl, human, compress, uploadOwn, publicUrl, rpc, once, busy };
})();
