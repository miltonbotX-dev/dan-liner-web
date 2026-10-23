// modules/estilo/estilo.ui.js · IU · Paletas de la colección, adornos de temporada, ojito de contraseña y probador (#probador).
// Lee storefront.ui_palette y storefront.ui_season (Elon) y, si no existen aún, localStorage "dl-palette"/"dl-season".
(function () {
  const D = () => window.DL;
  const esc = (v) => (D() && D().esc ? D().esc(v) : String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const sf = () => ((window.Store && window.Store.v2 && window.Store.v2.storefront) || {});
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };

  // ---------- Paletas: cada una con versión oscura (d) y clara (l); el botón de tema elige cuál ----------
  // orden de colores: fondo, superficie, texto, apagado, acento, línea
  const PALETTES = [
    { id: "clasico", name: "Clásico DAN-LINER", note: "Negro y dorado", d: ["#0a0a0a", "#121110", "#ece6da", "#8a8478", "#d6b56d", "#262320"], l: ["#f7f4ee", "#ffffff", "#1a1814", "#6f685c", "#9a7a35", "#e4ded3"] },
    { id: "marino", name: "Marino Savile Row", note: "Azul noche y latón", d: ["#0b1220", "#111a2c", "#e8ecf3", "#8b96aa", "#c9a96a", "#1f2a40"], l: ["#f3f5f9", "#ffffff", "#0f1a2e", "#5d6880", "#8a6b2f", "#dde2ec"] },
    { id: "milano", name: "Camel Milano", note: "Crema, camel y café", d: ["#17110b", "#211810", "#f1e7d8", "#a8957d", "#c99a66", "#33271b"], l: ["#f5efe6", "#fffaf2", "#2b2118", "#7a6a58", "#a87b4f", "#e6dccd"] },
    { id: "grafito", name: "Grafito Londres", note: "Gris carbón y plata", d: ["#16181b", "#1e2125", "#eceef0", "#9298a0", "#c4c9cf", "#2c3036"], l: ["#f2f3f4", "#ffffff", "#1c1f23", "#636a73", "#4a5058", "#dfe2e6"] },
    { id: "firenze", name: "Oliva Florencia", note: "Verde oliva y oro viejo", d: ["#11150f", "#181d15", "#ebe8dc", "#8f9480", "#c2a25a", "#262c21"], l: ["#f3f2ea", "#fbfaf4", "#1d2219", "#69705c", "#8a7334", "#e0decf"] },
    { id: "napoli", name: "Borgoña Nápoles", note: "Vino y champán", d: ["#170b0e", "#211015", "#f1e6e3", "#a48c8e", "#d9b88a", "#331a20"], l: ["#f8f1ef", "#ffffff", "#2a1217", "#7a5f63", "#7c2436", "#ead9d7"] },
    { id: "riviera", name: "Marfil Riviera", note: "Blanco roto y azul", d: ["#0d1422", "#141d2e", "#eef1f6", "#8d97aa", "#8fb0e0", "#233049"], l: ["#f8f6f1", "#ffffff", "#141a26", "#6c7385", "#2c4a7a", "#e7e3da"] },
    { id: "roma", name: "Chocolate Roma", note: "Café oscuro y cobre", d: ["#140e0a", "#1d1510", "#efe5da", "#9c8b7b", "#c88a5a", "#2e231b"], l: ["#f6f0ea", "#fffbf7", "#2a1d14", "#7d6a5a", "#9a5e33", "#e8ddd2"] },
    { id: "nordico", name: "Piedra Copenhague", note: "Gris piedra y negro", d: ["#141414", "#1c1c1c", "#eeece8", "#9a9792", "#eeece8", "#2c2c2c"], l: ["#eeece8", "#f8f7f4", "#151515", "#6e6c68", "#151515", "#dcd9d3"] },
    { id: "gala", name: "Gala Blanco y Negro", note: "Contraste puro", d: ["#000000", "#0d0d0d", "#ffffff", "#9a9a9a", "#ffffff", "#222222"], l: ["#ffffff", "#ffffff", "#000000", "#6b6b6b", "#000000", "#e5e5e5"] },
  ];
  PALETTES.forEach((p) => { p.c = p.d; });
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

  const PKEYS = ["--p-bg", "--p-sf", "--p-ink", "--p-mut", "--p-acc", "--p-line"];
  function applyPalette(id) {
    const p = PALETTES.find((x) => x.id === id) || PALETTES[0];
    const r = document.documentElement;
    if (p.id === "clasico") { r.removeAttribute("data-palette"); PKEYS.forEach((k) => r.style.removeProperty(k)); return; }
    const set = r.getAttribute("data-theme") === "light" ? p.l : p.d;
    if (r.getAttribute("data-palette") !== p.id) r.setAttribute("data-palette", p.id);
    PKEYS.forEach((k, i) => r.style.setProperty(k, set[i]));
  }
  // al cambiar claro/oscuro, la paleta cambia a su versión clara u oscura
  new MutationObserver(() => applyPalette(pal())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

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

  // ---------- Probador v2: maniquí con pose, 7 prendas editables y desfile (#probador) ----------
  const SUIT = [["Negro", "#16161b"], ["Azul marino", "#1c2a4a"], ["Azul rey", "#2846a3"], ["Gris oxford", "#3b3e44"], ["Gris claro", "#9a9ca1"], ["Verde salvia", "#8aa088"], ["Verde oliva", "#55583a"], ["Beige", "#cdb896"], ["Camel", "#b08350"], ["Marrón", "#5a3b26"], ["Vino", "#5c1f2b"], ["Blanco", "#ece8df"]];
  const SHIRT = [["Blanco", "#f4f2ec"], ["Celeste", "#bcd3ea"], ["Rosa", "#e9c6c8"], ["Crema", "#efe3c8"], ["Negro", "#18181b"]];
  const TIE = [["Sin corbata", ""], ["Rojo", "#b3122e"], ["Vino", "#6b1f2c"], ["Negro", "#111"], ["Azul", "#1d3a73"], ["Dorado", "#c9a24f"], ["Plateado", "#b7b9bd"], ["Verde", "#2f4a34"]];
  const POCKET = [["Sin pañuelo", ""], ["Blanco", "#f4f2ec"], ["Rojo", "#b3122e"], ["Dorado", "#c9a24f"], ["Azul", "#1d3a73"]];
  const BELT = [["Marrón", "#5b3a22"], ["Negro", "#121212"], ["Camel", "#a3743f"]];
  const SHOES = [["Negro", "#0f0f10"], ["Marrón", "#4a2c18"], ["Cuero claro", "#8a5a30"], ["Vino", "#4d1a22"]];
  const PARTS = [["saco", "Saco", SUIT], ["pantalon", "Pantalón", SUIT], ["camisa", "Camisa", SHIRT], ["corbata", "Corbata", TIE], ["panuelo", "Pañuelo", POCKET], ["correa", "Correa", BELT], ["zapatos", "Zapatos", SHOES]];
  const POSES = [["relajado", "De pie"], ["bolsillo", "Mano en bolsillo"], ["boton", "Mano al botón"]];
  const PB = { saco: "Negro", pantalon: "Negro", camisa: "Blanco", corbata: "Rojo", panuelo: "Rojo", correa: "Marrón", zapatos: "Negro", igual: true, tab: "saco", pose: "relajado", desfile: false };
  const hex = (list, n) => (list.find((x) => x[0] === n) || list[0])[1];
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  function mannequin() {
    const s = hex(SUIT, PB.saco), p = hex(SUIT, PB.igual ? PB.saco : PB.pantalon), c = hex(SHIRT, PB.camisa), t = hex(TIE, PB.corbata), k = hex(POCKET, PB.panuelo), b = hex(BELT, PB.correa), z = hex(SHOES, PB.zapatos);
    const skin = "#e4d8c8", line = 'stroke="#000" stroke-opacity=".28" stroke-width="1.1" fill="none"';
    const arm = (side) => { const L = side === "l"; const sx = L ? 80 : 160, ex = L ? 72 : 168, wx = L ? 70 : 170; const o = L ? -1 : 1;
      return `<g class="pb-arm pb-arm-${side}" style="transform-origin:${sx}px 104px"><path d="M${sx - 10 * o} 100 Q${sx + 14 * o} 98 ${sx + 16 * o} 118 L${ex + 12 * o} 206 L${ex - 12 * o} 206 Z" fill="${s}"/>
        <g class="pb-fore" style="transform-origin:${ex}px 204px"><path d="M${ex - 12 * o} 202 L${ex + 12 * o} 202 L${wx + 10 * o} 300 L${wx - 10 * o} 300 Z" fill="${s}"/><path d="M${wx - 10 * o} 296 L${wx + 10 * o} 296 L${wx + 10 * o} 302 L${wx - 10 * o} 302Z" fill="${c}"/>
        <path class="pb-hand" d="M${wx - 8 * o} 302 q-2 16 2 26 q6 6 12 0 q4 -12 2 -26z" fill="${skin}" transform="${L ? "" : `translate(${2 * wx},0) scale(-1,1)`}"/>
        <path d="M${ex - 4 * o} 206 L${wx - 2 * o} 296" ${line}/></g></g>`; };
    return `<svg class="pb-svg pose-${PB.pose}" viewBox="0 0 240 520" role="img" aria-label="Maniquí con terno ${esc(PB.saco)}">
      <defs><linearGradient id="pbSh" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
      <radialGradient id="pbHead" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#f3eadf"/><stop offset="1" stop-color="#cbbba6"/></radialGradient></defs>
      <ellipse cx="120" cy="500" rx="62" ry="9" fill="#000" opacity=".28"/><ellipse cx="120" cy="494" rx="56" ry="8" fill="#1c1b19" stroke="#3a372f"/>
      <g class="pb-body">
        <ellipse cx="120" cy="44" rx="20" ry="25" fill="url(#pbHead)"/><path d="M110 64 q10 8 20 0 l2 24 h-24z" fill="${skin}"/>
        <g class="pb-legs"><path d="M88 282 L154 282 L152 330 L148 474 L126 474 L121 318 L119 318 L114 474 L92 474 L88 330 Z" fill="${p}"/><path d="M88 282 L154 282 L152 330 L148 474 L126 474 L121 318 L119 318 L114 474 L92 474 L88 330 Z" fill="url(#pbSh)"/>
          <path d="M103 300 L103 470 M137 300 L137 470" stroke="#000" stroke-opacity=".18"/></g>
        <path d="M89 278 h62 v9 h-62z" fill="${b}"/><rect x="114" y="277" width="12" height="11" rx="1.5" fill="none" stroke="#c9a24f" stroke-width="2"/>
        <path d="M90 470 q-10 14 2 18 h26 q4 -6 -2 -18z" fill="${z}"/><path d="M150 470 q10 14 -2 18 h-26 q-4 -6 2 -18z" fill="${z}"/>
        <path d="M104 84 L120 96 L136 84 L140 180 L120 236 L100 180 Z" fill="${c}"/>
        ${t ? `<path d="M115 94 L125 94 L123 104 L130 214 L120 228 L110 214 L117 104 Z" fill="${t}"/><path d="M115 94 L125 94 L123 104 L117 104Z" fill="#000" opacity=".18"/>` : `<path d="M112 88 L120 100 L128 88" stroke="#000" stroke-opacity=".3" fill="none"/>`}
        ${arm("l")}${arm("r")}
        <path d="M106 82 C90 86 74 92 72 108 L76 270 L84 292 L120 286 L120 236 L102 186 L96 146 L104 122 L98 112 L112 88 Z" fill="${s}"/>
        <path d="M134 82 C150 86 166 92 168 108 L164 270 L156 292 L120 286 L120 236 L138 186 L144 146 L136 122 L142 112 L128 88 Z" fill="${s}"/>
        <path d="M72 108 L76 270 L84 292 L120 286 L156 292 L164 270 L168 108 C166 92 150 86 134 82 L106 82 C90 86 74 92 72 108Z" fill="url(#pbSh)"/>
        <path d="M112 88 L98 112 L104 122 L96 146 L102 186 L120 236 M128 88 L142 112 L136 122 L144 146 L138 186 L120 236" ${line}/>
        <path d="M120 236 L112 286 M120 236 L128 286" stroke="${p}" stroke-width="0"/><path d="M118 238 q-8 22 -28 50 M122 238 q8 22 28 50" ${line}/>
        <circle cx="120" cy="214" r="2.6" fill="#000" opacity=".5"/><circle cx="120" cy="250" r="2.6" fill="#000" opacity=".5"/>
        <path d="M84 226 h22 M134 226 h22 M136 140 h18" stroke="#000" stroke-opacity=".3" stroke-width="1.4"/>
        ${k ? `<path d="M138 140 l4 -9 l3 6 l3 -8 l3 7 l3 -5 l1 9 z" fill="${k}"/>` : ""}
      </g></svg>`;
  }
  const sw = (key, list) => `<div class="pb-sw" role="radiogroup" aria-label="${key}">${list.map(([n, h]) => `<button type="button" class="${PB[key] === n ? "on" : ""}" data-act="pb-set" data-k="${key}" data-v="${esc(n)}" aria-pressed="${PB[key] === n}" title="${esc(n)}" style="--sw:${h || "transparent"}"><i></i><span>${esc(n)}</span></button>`).join("")}</div>`;
  function matches() {
    if (!D() || !D().productGroups) return [];
    const want = norm(PB.saco).split(" ")[0];
    return D().productGroups(D().visibleProducts()).filter((g) => norm(g.first.color).includes(want) && D().stockOf(g.first) > 0).slice(0, 6);
  }
  // Fecha aproximada de llegada por color: storefront.color_eta = { "Vino": "Llega a fines de noviembre" } (editable en Admin)
  const eta = () => { const m = sf().color_eta || {}; const key = Object.keys(m).find((k) => norm(k) === norm(PB.saco)); return key ? m[key] : ""; };
  function renderProbador() {
    const m = matches(); const wa = String(sf().contact_whatsapp || "").replace(/\D/g, ""); const e = eta();
    const q = `terno ${PB.saco}${PB.igual ? "" : " saco " + PB.saco + " pantalón " + PB.pantalon} camisa ${PB.camisa} hombre`;
    const parts = PARTS.filter(([k]) => !(k === "pantalon" && PB.igual));
    const tab = parts.find(([k]) => k === PB.tab) || parts[0];
    return `<section class="pb"><div class="pb-head"><p class="kicker">Probador</p><h1>Arma tu terno</h1><p class="muted">Elige los colores y te mostramos lo que tenemos en tienda.</p></div>
      <div class="pb-grid"><figure class="pb-stage ${PB.desfile ? "is-walk" : ""}">${mannequin()}
        <div class="pb-poses" role="group" aria-label="Pose">${POSES.map(([k, l]) => `<button type="button" class="${PB.pose === k && !PB.desfile ? "on" : ""}" data-act="pb-pose" data-v="${k}">${l}</button>`).join("")}<button type="button" class="${PB.desfile ? "on" : ""}" data-act="pb-walk">${PB.desfile ? "Detener" : "Desfile"}</button></div>
        <figcaption>${esc(PB.saco)}${PB.igual ? "" : " · pantalón " + esc(PB.pantalon)} · camisa ${esc(PB.camisa)}${PB.corbata !== "Sin corbata" ? " · corbata " + esc(PB.corbata) : ""}</figcaption></figure>
      <div class="pb-ctrl"><div class="pb-tabs" role="tablist">${parts.map(([k, l]) => `<button type="button" role="tab" class="${tab[0] === k ? "on" : ""}" aria-selected="${tab[0] === k}" data-act="pb-tab" data-v="${k}">${l}</button>`).join("")}</div>
        <div class="pb-row">${sw(tab[0], tab[2])}</div>
        ${tab[0] === "saco" || tab[0] === "pantalon" ? `<label class="pb-same"><input type="checkbox" data-act="pb-same" ${PB.igual ? "checked" : ""}> Pantalón del mismo color que el saco</label>` : ""}</div></div>
      <div class="pb-result"><h2>${m.length ? "Lo tenemos en la colección" : "Aún no tenemos ese color en tienda"}</h2>
      ${m.length ? `<div class="grid">${m.map(D().cardHtml).join("")}</div>` : `<div class="pb-empty">${e ? `<p class="pb-eta"><b>Próxima llegada:</b> ${esc(e)}</p>` : `<p class="muted">Podemos conseguirlo para ti.</p>`}<div class="row">${wa ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${wa.length === 9 ? "51" + wa : wa}?text=${encodeURIComponent("Hola DAN-LINER, busco un " + q + ". ¿Lo pueden conseguir?")}">${e ? "Avísame cuando llegue" : "Pedirlo por WhatsApp"}</a>` : ""}<a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}">Ver ideas en internet</a></div></div>`}</div></section>`;
  }
  let walkT = null;
  function walk(on) { clearInterval(walkT); walkT = null; PB.desfile = on; if (on) { let i = 0; walkT = setInterval(() => { if (!/^#probador/.test(location.hash)) return walk(false); i = (i + 1) % POSES.length; PB.pose = POSES[i][0]; const svg = document.querySelector(".pb-svg"); if (svg) svg.setAttribute("class", "pb-svg pose-" + PB.pose); }, 2600); } }
  window.DL_SCREENS = Object.assign(window.DL_SCREENS || {}, { probador: renderProbador });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "pb-set": (el) => { PB[el.dataset.k] = el.dataset.v; D().render(); },
    "pb-tab": (el) => { PB.tab = el.dataset.v; D().render(); },
    "pb-pose": (el) => { walk(false); PB.pose = el.dataset.v; D().render(); },
    "pb-walk": () => { walk(!PB.desfile); D().render(); },
    "pb-same": () => { PB.igual = !PB.igual; if (PB.igual && PB.tab === "pantalon") PB.tab = "saco"; D().render(); },
  });

  // ---------- Lupa: fotos de la ficha y muestra de tela ----------
  // Cualquier <img> dentro de .pdp-gallery, o un elemento con data-zoom="URL" (p. ej. .fabric-swatch), abre la vista ampliada.
  function openZoom(src, alt) {
    if (!src) return; const o = document.createElement("div"); o.className = "dl-zoom"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Vista ampliada");
    o.innerHTML = `<button class="icon-btn dl-zoom-x" type="button" aria-label="Cerrar">&times;</button><div class="dl-zoom-pan"><img src="${esc(src)}" alt="${esc(alt || "")}"></div><p class="dl-zoom-hint">Toca para acercar · desliza para recorrer</p>`;
    const img = o.querySelector("img"), pan = o.querySelector(".dl-zoom-pan");
    pan.addEventListener("click", (e) => { const r = img.getBoundingClientRect(); const zx = ((e.clientX - r.left) / r.width) * 100, zy = ((e.clientY - r.top) / r.height) * 100; img.style.transformOrigin = zx + "% " + zy + "%"; o.classList.toggle("is-in"); });
    pan.addEventListener("pointermove", (e) => { if (!o.classList.contains("is-in") || e.pointerType === "touch") return; const r = pan.getBoundingClientRect(); img.style.transformOrigin = ((e.clientX - r.left) / r.width) * 100 + "% " + ((e.clientY - r.top) / r.height) * 100 + "%"; });
    let sx = 0, sy = 0; pan.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    pan.addEventListener("touchmove", (e) => { if (!o.classList.contains("is-in")) return; const r = pan.getBoundingClientRect(); const x = Math.min(100, Math.max(0, ((e.touches[0].clientX - r.left) / r.width) * 100)), y = Math.min(100, Math.max(0, ((e.touches[0].clientY - r.top) / r.height) * 100)); img.style.transformOrigin = (100 - x) + "% " + (100 - y) + "%"; }, { passive: true });
    const close = () => { o.classList.add("is-out"); setTimeout(() => o.remove(), 200); document.documentElement.style.overflow = ""; document.removeEventListener("keydown", esc_); };
    const esc_ = (e) => { if (e.key === "Escape") close(); };
    o.querySelector(".dl-zoom-x").addEventListener("click", close); document.addEventListener("keydown", esc_);
    document.body.appendChild(o); document.documentElement.style.overflow = "hidden";
  }
  document.addEventListener("click", (e) => {
    const z = e.target.closest && e.target.closest("[data-zoom]");
    if (z) { e.preventDefault(); return openZoom(z.dataset.zoom, z.getAttribute("aria-label") || "Tela"); }
    const im = e.target.closest && e.target.closest(".pdp-gallery img");
    if (im) openZoom(im.currentSrc || im.src, im.alt);
  });
  window.DL_ZOOM = openZoom;

  // ---------- Selector para Admin → Configuración → Personalización ----------
  // Grok Bot: pinta DL_ESTILO.adminHtml() y guarda con DL_ESTILO.save(palette, season) (o en storefront.ui_palette / ui_season).
  function adminHtml() {
    const cur = pal(), cs = sea();
    return `<section class="panel stack style-admin"><h3>Personalización de la colección</h3>
      <p class="tiny muted">Los colores se aplican a la colección y a la ficha de producto. Caja y Administración no cambian.</p>
      <div class="pal-grid">${PALETTES.map((p) => `<button type="button" class="pal-card ${p.id === cur ? "on" : ""}" data-act="st-pal" data-id="${p.id}" aria-pressed="${p.id === cur}"><span class="pal-sw">${(document.documentElement.getAttribute("data-theme") === "light" ? p.l : p.d).slice(0, 5).map((c) => `<i style="background:${c}"></i>`).join("")}</span><b>${esc(p.name)}</b><small>${esc(p.note)}</small></button>`).join("")}</div>
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
