// modules/imagenes/imagenes.js · fotos de Drive siempre visibles: formato principal drive.google.com/thumbnail,
// respaldo lh3 → uc?export=view → placeholder (.img-fail), clase .loaded al cargar (quita el shimmer), y caché en el teléfono (sw.js).
(function () {
  const PH = "assets/placeholder.svg";
  const driveId = (u) => { const v = String(u || ""); if (!/drive\.google\.com|docs\.google\.com|googleusercontent\.com/i.test(v)) return null; const m = v.match(/\/d\/([\w-]{10,})/) || v.match(/[?&]id=([\w-]{10,})/); return m ? m[1] : null; };
  const chain = (id) => ["https://drive.google.com/thumbnail?id=" + id + "&sz=w800", "https://lh3.googleusercontent.com/d/" + id + "=w800", "https://drive.google.com/uc?export=view&id=" + id];
  window.DL_IMG = { driveId, primary: (u) => { const id = driveId(u); return id ? chain(id)[0] : u; } };
  window.addEventListener("error", (e) => {
    const img = e.target; if (!img || img.tagName !== "IMG" || img.classList.contains("img-fail")) return;
    const id = driveId(img.dataset.src0 || img.currentSrc || img.src);
    if (!img.dataset.src0) img.dataset.src0 = img.src;
    const list = id ? chain(id) : [];
    const step = Number(img.dataset.fb || 0);
    // salta el formato que ya falló
    let next = step; while (next < list.length && list[next] === img.src) next += 1;
    if (next < list.length) { img.dataset.fb = String(next + 1); img.src = list[next]; return; }
    img.classList.add("img-fail"); img.dataset.fb = "x"; img.src = PH;
  }, true);
  window.addEventListener("load", (e) => { const img = e.target; if (img && img.tagName === "IMG" && !img.classList.contains("img-fail")) img.classList.add("loaded"); }, true);
  // Caché de fotos en el teléfono (solo https o localhost; nunca dentro de la vista previa)
  if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) && !/preview=1/.test(location.search)) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js?v=28r1").catch(() => {}); });
  }
})();
