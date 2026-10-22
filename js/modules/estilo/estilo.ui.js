// modules/estilo/estilo.ui.js · IU · Paletas de la colección, adornos de temporada, ojito de contraseña y probador (#probador).
// Lee storefront.ui_palette y storefront.ui_season (Elon) y, si no existen aún, localStorage "dl-palette"/"dl-season".
(function () {
  const D = () => window.DL;
  const esc = (v) => (D() && D().esc ? D().esc(v) : String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const sf = () => ((window.Store && window.Store.v2 && window.Store.v2.storefront) || {});
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };

  // ---------- Paletas (bg, superficie, texto, apagado, acento, línea) ----------
  const PALETTES = [
    { id: "clasico", name: "Clásico DAN-LINER", note: "Negro y dorado", c: ["#0a0a0a", "#121110", "#ece6da", "#8a8478", "#d6b56d", "#262320"] },
    { id: "marino", name: "Marino Savile Row", note: "Azul noche y latón", c: ["#0b1220", "#111a2c", "#e8ecf3", "#8b96aa", "#c9a96a", "#1f2a40"] },
    { id: "milano", name: "Camel Milano", note: "Crema, camel y café", c: ["#f5efe6", "#fffaf2", "#2b2118", "#7a6a58", "#a87b4f", "#e6dccd"] },
    { id: "grafito", name: "Grafito Londres", note: "Gris carbón y plata", c: ["#16181b", "#1e2125", "#eceef0", "#9298a0", "#c4c9cf", "#2c3036"] },
    { id: "firenze", name: "Oliva Florencia", note: "Verde oliva y oro viejo", c: ["#11150f", "#181d15", "#ebe8dc", "#8f9480", "#c2a25a", "#262c21"] },
    { id: "napoli", name: "Borgoña Nápoles", note: "Vino y champán", c: ["#170b0e", "#211015", "#f1e6e3", "#a48c8e", "#d9b88a", "#331a20"] },
    { id: "riviera", name: "Marfil Riviera", note: "Blanco roto y azul", c: ["#f8f6f1", "#ffffff", "#141a26", "#6c7385", "#2c4a7a", "#e7e3da"] },
    { id: "roma", name: "Chocolate Roma", note: "Café oscuro y cobre", c: ["#140e0a", "#1d1510", "#efe5da", "#9c8b7b", "#c88a5a", "#2e231b"] },
    { id: "nordico", name: "Piedra Copenhague", note: "Gris piedra y negro", c: ["#eeece8", "#f8f7f4", "#151515", "#6e6c68", "#151515", "#dcd9d3"] },
    { id: "gala", name: "Gala Blanco y Negro", note: "Contraste puro", c: ["#000000", "#0d0d0d", "#ffffff", "#9a9a9a", "#ffffff", "#222222"] },
  ];
  // ---------- Temporadas de Perú ----------
  const SEASONS = [
    { id: "off", name: "Sin adorno" },
    { id: "auto", name: "Automático según la fecha" },
    { id: "navidad", name: "Navidad · reno con brillo", from: "12-01", to: "12-26" },
    { id: "anonuevo", name: "Año Nuevo · destellos dorados", from: "12-27", to: "01-06" },
    { id: "sanvalentin", name: "San Valentín · corazones finos", from: "02-07", to: "02-15" },
    { id: "padre", name: "Día del Padre · moños dorados", from: "06-08", to: "06-22" },
    { id: "patrias", name: "Fiestas Patrias · cinta rojo y blanco", from: "07-15", to: "07-31" },
  ];
  const mmdd = (d) => String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function seasonFor(id) {
    if (id !== "auto") return id || "off";
    const t = mmdd(new Date());
    const s = SEASONS.find((x) => x.from && (x.from <= x.to ? t >= x.from && t <= x.to : t >= x.from || t <= x.to));
    return s ? s.id : "off";
  }
  const pal = () => sf().ui_palette || ls("dl-palette") || "clasico";
  const sea = () => sf().ui_season || ls("dl-season") || "auto";

  function applyPalette(id) {
    const p = PALETTES.find((x) => x.id === id) || PALETTES[0];
    const r = document.documentElement;
    if (p.id === "clasico") { r.removeAttribute("data-palette"); ["--p-bg", "--p-sf", "--p-ink", "--p-mut", "--p-acc", "--p-line"].forEach((k) => r.style.removeProperty(k)); return; }
    r.setAttribute("data-palette", p.id);
    ["--p-bg", "--p-sf", "--p-ink", "--p-mut", "--p-acc", "--p-line"].forEach((k, i) => r.style.setProperty(k, p.c[i]));
  }

  // ---------- Adornos de temporada (solo en la colección y la ficha; no en caja/admin) ----------
  const REINDEER = '<svg viewBox="0 0 64 40" aria-hidden="true"><g fill="currentColor"><path d="M14 18c2-1 10-1 18 0 6 1 11 0 14-2l2 2c-2 3-5 4-8 5l1 9h-3l-2-7-10 1-3 6h-3l1-7c-3-1-6-3-7-7z"/><path d="M46 16l3-6 2 1-2 4 4-2 1 2-6 3zM47 12l1-7 2 .5-1 5 3-4 1.6 1.2-4 5z" opacity=".9"/><circle cx="51" cy="18" r="1.4"/></g><g stroke="currentColor" stroke-width="1.2" fill="none" opacity=".55"><path d="M0 26h12"/></g></svg>';
  function mountSeason() {
    let box = document.getElementById("dl-season");
    const id = seasonFor(sea());
    const show = id !== "off" && !document.body.classList.contains("ui-app") && !/^#(caja|admin|taller|gestion)/.test(location.hash);
    if (!show) { if (box) box.remove(); return; }
    if (box && box.dataset.s === id) return;
    if (box) box.remove();
    box = document.createElement("div"); box.id = "dl-season"; box.className = "dl-season s-" + id; box.dataset.s = id; box.setAttribute("aria-hidden", "true");
    const dust = Array.from({ length: 14 }, (_, i) => `<i style="--d:${(i * 0.37).toFixed(2)}s;--x:${(i * 7) % 100}%"></i>`).join("");
    box.innerHTML = id === "navidad" ? `<span class="rd">${REINDEER}</span><span class="rd-dust">${dust}</span>` : `<span class="sz-fx">${dust}</span>`;
    const header = document.querySelector(".site-header"); (header || document.body).appendChild(box);
  }

  // ---------- Ojito en contraseñas ----------
  const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.6-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function eyes(root) {
    (root || document).querySelectorAll('input[type="password"]:not([data-eye])').forEach((inp) => {
      inp.dataset.eye = "1";
      const w = document.createElement("span"); w.className = "pw-wrap";
      inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
      const b = document.createElement("button"); b.type = "button"; b.className = "pw-eye"; b.setAttribute("aria-label", "Mostrar contraseña"); b.innerHTML = EYE;
      b.addEventListener("click", (e) => { e.preventDefault(); const show = inp.type === "password"; inp.type = show ? "text" : "password"; b.innerHTML = show ? EYE_OFF : EYE; b.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña"); inp.focus(); });
      w.appendChild(b);
    });
  }
  new MutationObserver(() => eyes()).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- Probador: maniquí con colores editables (#probador) ----------
  const SUIT = [["Negro", "#15151a"], ["Azul marino", "#1c2a4a"], ["Azul", "#2f4f8f"], ["Gris oxford", "#3b3e44"], ["Gris claro", "#9a9ca1"], ["Beige", "#cdb896"], ["Camel", "#b08350"], ["Marrón", "#5a3b26"], ["Verde oliva", "#55583a"], ["Vino", "#5c1f2b"], ["Blanco", "#ece8df"]];
  const SHIRT = [["Blanco", "#f4f2ec"], ["Celeste", "#bcd3ea"], ["Rosa", "#e9c6c8"], ["Negro", "#18181b"], ["Crema", "#efe3c8"]];
  const TIE = [["Sin corbata", ""], ["Negro", "#111"], ["Vino", "#6b1f2c"], ["Azul", "#1d3a73"], ["Dorado", "#c9a24f"], ["Plateado", "#b7b9bd"], ["Verde", "#2f4a34"]];
  const PB = { saco: "Negro", pantalon: "Negro", camisa: "Blanco", corbata: "Vino", igual: true };
  const hex = (list, n) => (list.find((x) => x[0] === n) || list[0])[1];
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  function mannequin() {
    const s = hex(SUIT, PB.saco), p = hex(SUIT, PB.igual ? PB.saco : PB.pantalon), c = hex(SHIRT, PB.camisa), t = hex(TIE, PB.corbata);
    return `<svg class="pb-svg" viewBox="0 0 200 420" role="img" aria-label="Maniquí con terno ${esc(PB.saco)}">
      <defs><linearGradient id="pbSh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>
      <ellipse cx="100" cy="408" rx="46" ry="6" fill="#000" opacity=".25"/>
      <rect x="97" y="360" width="6" height="44" fill="#8a7a5a"/><rect x="70" y="400" width="60" height="6" rx="3" fill="#8a7a5a"/>
      <ellipse cx="100" cy="30" rx="17" ry="21" fill="#d9cfbf"/><rect x="92" y="46" width="16" height="16" fill="#d9cfbf"/>
      <path d="M72 246 L80 372 L98 372 L100 270 L102 372 L120 372 L128 246 Z" fill="${p}"/><path d="M72 246 L80 372 L98 372 L100 270 L102 372 L120 372 L128 246 Z" fill="url(#pbSh)"/>
      <path d="M86 58 L100 66 L114 58 L118 92 L100 150 L82 92 Z" fill="${c}"/>
      ${t ? `<path d="M96 66 L104 66 L102 74 L106 128 L100 138 L94 128 L98 74 Z" fill="${t}"/>` : ""}
      <path d="M86 58 C66 62 52 68 48 84 L40 200 L52 232 L60 230 L62 150 L70 250 L100 256 L100 150 L82 92 L90 62 Z" fill="${s}"/>
      <path d="M114 58 C134 62 148 68 152 84 L160 200 L148 232 L140 230 L138 150 L130 250 L100 256 L100 150 L118 92 L110 62 Z" fill="${s}"/>
      <path d="M48 84 L40 200 L52 232 L60 230 L62 150 L70 250 L100 256 L130 250 L138 150 L140 230 L148 232 L160 200 L152 84" fill="url(#pbSh)"/>
      <path d="M90 62 L82 92 L92 110 L86 120 L100 150 M110 62 L118 92 L108 110 L114 120 L100 150" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>
      <circle cx="100" cy="196" r="2.4" fill="#000" opacity=".45"/><circle cx="100" cy="214" r="2.4" fill="#000" opacity=".45"/>
      <path d="M118 120 L134 118" stroke="#000" stroke-opacity=".3"/><path d="M64 196 L84 196 M116 196 L136 196" stroke="#000" stroke-opacity=".25"/>
    </svg>`;
  }
  const sw = (key, list) => `<div class="pb-sw" role="radiogroup" aria-label="${key}">${list.map(([n, h]) => `<button type="button" class="${PB[key] === n ? "on" : ""}" data-act="pb-set" data-k="${key}" data-v="${esc(n)}" aria-pressed="${PB[key] === n}" title="${esc(n)}" style="--sw:${h || "transparent"}"><i></i><span>${esc(n)}</span></button>`).join("")}</div>`;
  function matches() {
    if (!D() || !D().productGroups) return [];
    const want = norm(PB.saco).split(" ")[0];
    return D().productGroups(D().visibleProducts()).filter((g) => norm(g.first.color).includes(want) && D().stockOf(g.first) > 0).slice(0, 6);
  }
  function renderProbador() {
    const m = matches(); const wa = String(sf().contact_whatsapp || "").replace(/\D/g, "");
    const q = `terno ${PB.saco}${PB.igual ? "" : " saco " + PB.saco + " pantalón " + PB.pantalon} camisa ${PB.camisa} hombre`;
    return `<section class="pb"><div class="pb-head"><p class="kicker">Probador</p><h1>Arma tu terno</h1><p class="muted">Elige los colores y te mostramos lo que tenemos en tienda.</p></div>
      <div class="pb-grid"><figure class="pb-stage">${mannequin()}<figcaption>${esc(PB.saco)}${PB.igual ? "" : " · pantalón " + esc(PB.pantalon)} · camisa ${esc(PB.camisa)}${PB.corbata !== "Sin corbata" ? " · corbata " + esc(PB.corbata) : ""}</figcaption></figure>
      <div class="pb-ctrl"><div class="pb-row"><b>Saco</b>${sw("saco", SUIT)}</div>
        <label class="pb-same"><input type="checkbox" data-act="pb-same" ${PB.igual ? "checked" : ""}> Pantalón del mismo color</label>
        ${PB.igual ? "" : `<div class="pb-row"><b>Pantalón</b>${sw("pantalon", SUIT)}</div>`}
        <div class="pb-row"><b>Camisa</b>${sw("camisa", SHIRT)}</div><div class="pb-row"><b>Corbata</b>${sw("corbata", TIE)}</div></div></div>
      <div class="pb-result"><h2>${m.length ? "Lo tenemos en la colección" : "Aún no tenemos ese color en tienda"}</h2>
      ${m.length ? `<div class="grid">${m.map(D().cardHtml).join("")}</div>` : `<div class="pb-empty"><p class="muted">Podemos conseguirlo o confeccionarlo para ti.</p><div class="row">${wa ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${wa.length === 9 ? "51" + wa : wa}?text=${encodeURIComponent("Hola DAN-LINER, busco un " + q + ". ¿Lo pueden conseguir?")}">Pedirlo por WhatsApp</a>` : ""}<a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}">Ver ideas en internet</a></div></div>`}</div></section>`;
  }
  window.DL_SCREENS = Object.assign(window.DL_SCREENS || {}, { probador: renderProbador });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "pb-set": (el) => { PB[el.dataset.k] = el.dataset.v; D().render(); },
    "pb-same": (el) => { PB.igual = !PB.igual; D().render(); },
  });

  // ---------- Selector para Admin → Configuración → Personalización ----------
  // Grok Bot: pinta DL_ESTILO.adminHtml() y guarda con DL_ESTILO.save(palette, season) (o en storefront.ui_palette / ui_season).
  function adminHtml() {
    const cur = pal(), cs = sea();
    return `<section class="panel stack style-admin"><h3>Personalización de la colección</h3>
      <p class="tiny muted">Los colores se aplican a la colección y a la ficha de producto. Caja y Administración no cambian.</p>
      <div class="pal-grid">${PALETTES.map((p) => `<button type="button" class="pal-card ${p.id === cur ? "on" : ""}" data-act="st-pal" data-id="${p.id}" aria-pressed="${p.id === cur}"><span class="pal-sw">${p.c.slice(0, 5).map((c) => `<i style="background:${c}"></i>`).join("")}</span><b>${esc(p.name)}</b><small>${esc(p.note)}</small></button>`).join("")}</div>
      <h3>Adorno de temporada</h3><div class="season-pick">${SEASONS.map((s) => `<label class="ship-choice"><input type="radio" name="dl-season" value="${s.id}" data-act="st-season" ${s.id === cs ? "checked" : ""}><span>${esc(s.name)}</span></label>`).join("")}</div>
      <p class="tiny muted">Discreto: solo cruza el encabezado de la colección cada cierto tiempo y respeta a quien prefiere menos movimiento.</p></section>`;
  }
  function save(p, s) { if (p) ls("dl-palette", p); if (s) ls("dl-season", s); applyPalette(pal()); mountSeason(); if (window.DL_ESTILO_SAVE) window.DL_ESTILO_SAVE({ ui_palette: p, ui_season: s }); }
  Object.assign(window.DL_ACTIONS, {
    "st-pal": (el) => { save(el.dataset.id, null); D().render(); },
    "st-season": (el) => { save(null, el.value); },
  });
  window.DL_ESTILO = { PALETTES, SEASONS, adminHtml, save, apply: () => { applyPalette(pal()); mountSeason(); } };

  window.DL_AFTER = (window.DL_AFTER || []).concat([() => { applyPalette(pal()); mountSeason(); eyes(); }]);
  applyPalette(pal());
  document.addEventListener("DOMContentLoaded", () => { applyPalette(pal()); mountSeason(); eyes(); });
  window.addEventListener("hashchange", mountSeason);
})();
