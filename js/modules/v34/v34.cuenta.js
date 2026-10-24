// modules/v34/v34.cuenta.js · v34: puntos de enganche para la BD v19, aviso para activar notificaciones y Guía de uso por rol.
(function () {
  const D = () => window.DL;
  const esc = (v) => D().esc(v);

  // ---------- Enganches BD v19 ----------
  // BD v19 (API_V19 §4): nombres reales. cleanupAvatar queda null: el archivo anterior se borra por Storage (deleteOwn) y los huérfanos con purge_orphan_files.
  const V19_RPC = Object.assign({ savePushSubscription: "save_push_subscription", deletePushSubscription: "delete_push_subscription", cleanupAvatar: null }, (window.DL_CONFIG || {}).V19_RPC || {});
  const call = (name, args) => (V19_RPC[name] && window.DL33 ? window.DL33.rpc(V19_RPC[name], args || {}) : Promise.resolve(null));
  window.DL_V19_HOOKS = {
    ready: (name) => !!V19_RPC[name],
    // Guarda la suscripción push (PushSubscription.toJSON()) → {id, active}.
    savePushSubscription: (sub) => call("savePushSubscription", { p_subscription: sub }),
    deletePushSubscription: (endpoint) => call("deletePushSubscription", { p_endpoint: endpoint }),
    // Limpieza del archivo anterior de la foto de perfil. Si no existe la RPC, v33.admin.js borra el archivo propio por Storage.
    cleanupAvatar: V19_RPC.cleanupAvatar ? (path) => call("cleanupAvatar", { p_path: path }) : null,
  };

  // ---------- Notificaciones ----------
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const supported = () => "Notification" in window && "serviceWorker" in navigator;
  const DISMISS = "dl_notif_later";
  async function swReg() { try { return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("sw.js?v=34")); } catch { return null; } }
  async function subscribePush(reg) {
    const key = (window.DL_CONFIG || {}).PUSH_VAPID_PUBLIC; // llave pública VAPID (la privada nunca va en la web)
    if (!reg || !key || !reg.pushManager || !window.DL_V19_HOOKS.ready("savePushSubscription")) return false;
    const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (key.length % 4)) % 4));
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) }));
    await window.DL_V19_HOOKS.savePushSubscription(sub.toJSON());
    return true;
  }
  function notifCard() {
    const st = D().state; if (!st.user) return "";
    let later = false; try { later = localStorage.getItem(DISMISS) === "1"; } catch { }
    if (!supported()) {
      if (isIOS && !standalone()) return `<div class="pin-card notif-card"><span><b>Avisos en tu iPhone</b><small>En iPhone los avisos solo funcionan con la tienda instalada: toca Compartir → «Agregar a inicio» y ábrela desde ese ícono.</small></span></div>`;
      return "";
    }
    const p = Notification.permission;
    if (p === "granted") return `<div class="pin-card notif-card is-ok"><span><b>Avisos activados ✓</b><small>Te avisaremos del estado de tus pedidos${D().isClient() ? "" : " y de tu trabajo"}.</small></span><button type="button" class="btn small ghost" data-act="v34-notif-test">Probar</button></div>`;
    if (p === "denied") return `<div class="pin-card notif-card"><span><b>Avisos bloqueados</b><small>Los bloqueaste en este navegador. Para activarlos, ábrelos desde el candado de la barra de direcciones → Notificaciones → Permitir.</small></span></div>`;
    if (later) return `<button type="button" class="link-btn tiny" data-act="v34-notif-ask">Activar avisos</button>`;
    return `<div class="pin-card notif-card is-todo"><span><b>¿Te avisamos?</b><small>Recibe un aviso cuando tu pedido cambie de estado${isIOS ? " (en iPhone, con la tienda instalada en inicio)" : ""}.</small></span><span class="row" style="gap:6px"><button type="button" class="btn small" data-act="v34-notif-ask">Activar</button><button type="button" class="btn small ghost" data-act="v34-notif-later">Ahora no</button></span></div>`;
  }
  const A = window.DL_ACTIONS = window.DL_ACTIONS || {};
  A["v34-notif-ask"] = async () => {
    if (!supported()) return D().toast(isIOS ? "En iPhone: instala la tienda con Compartir → «Agregar a inicio»." : "Este navegador no permite avisos.");
    const r = await Notification.requestPermission();
    if (r === "granted") {
      const reg = await swReg();
      try { if (reg) await reg.showNotification("DAN-LINER", { body: "Listo: así te llegarán los avisos.", icon: "assets/icon-192.png", badge: "assets/icon-192.png", tag: "dl-welcome" }); } catch { }
      try { await subscribePush(reg); } catch { /* TODO v19: si falla el guardado, se reintenta al volver a entrar */ }
      D().toast("Avisos activados ✓");
    } else D().toast(r === "denied" ? "Avisos bloqueados. Puedes activarlos luego desde el navegador." : "Puedes activarlos cuando quieras.");
    D().render();
  };
  A["v34-notif-later"] = () => { try { localStorage.setItem(DISMISS, "1"); } catch { } D().render(); };
  A["v34-notif-test"] = async () => { const reg = await swReg(); if (reg) await reg.showNotification("DAN-LINER", { body: "Aviso de prueba ✓", icon: "assets/icon-192.png", tag: "dl-test" }); };
  // Con permiso dado y suscripción v19 lista, reintenta guardar la suscripción al entrar (silencioso).
  window.addEventListener("load", () => setTimeout(async () => { try { if (supported() && Notification.permission === "granted" && D().state.user) await subscribePush(await swReg()); } catch { } }, 4000));

  // ---------- Guía de uso por rol ----------
  const G = [
    { need: null, client: true, t: "Comprar en la tienda", s: [
      "En <b>Colección</b> toca una pieza para ver fotos, tallas y precio. Si hay otros colores de la misma tela, toca el color para ver su stock.",
      "Elige tu talla y toca <b>Agregar</b>. Revisa tu bolsa y toca <b>Hacer pedido</b>.",
      "Elige recojo en tienda o envío a domicilio, paga con Yape/Plin o transferencia y sube la captura del pago.",
      "Sigue tus pedidos en <b>Mi cuenta → Mis pedidos</b>." ] },
    { need: null, client: true, t: "Mi cuenta", s: [
      "En <b>Foto y departamento</b> cambias tu foto (se reduce sola) y tu departamento.",
      "Tus <b>distinciones</b> (por ejemplo, VIP) aparecen en Mi cuenta cuando la tienda las hace visibles.",
      "Activa los <b>avisos</b> para saber cuándo tu pedido cambia de estado." ] },
    { need: ["SUPERVISOR", "VENDEDOR", "CAJERO"], t: "Caja y ventas", s: [
      "Abre tu caja en <b>Caja</b> con el monto inicial. Busca la pieza por nombre o código y agrégala.",
      "Elige comprobante (boleta, factura o nota de venta), la forma de pago y cobra. Para Yape/Plin sube la captura.",
      "Al terminar el día, cierra la caja contando el efectivo. Si la tienda lo pide, autoriza con tu PIN de cierre." ] },
    { need: ["SUPERVISOR", "VENDEDOR", "CAJERO"], t: "Pedidos web, separados y clientes", s: [
      "<b>Pedidos web</b>: revisa el pago, confirma y marca listo para recojo o enviado.",
      "<b>Separados</b>: registra el adelanto; el saldo se cobra en caja al entregar.",
      "<b>Clientes</b>: busca por nombre, DNI o celular; puedes dejar notas y etiquetas." ] },
    { need: ["SUPERVISOR", "ALMACENERO"], t: "Taller e inventario", s: [
      "<b>Taller</b>: registra lotes de tela, órdenes de corte y lo que entrega cada sastre.",
      "<b>Administración → Piezas</b>: crea la pieza (tela, color, tallas y precios) y sus fotos.",
      "Traslados y consignaciones mueven stock entre almacenes; revisa siempre la cantidad antes de guardar." ] },
    { need: ["CONTADOR"], t: "Comprobantes", s: [
      "En <b>Comprobantes</b> filtra por fechas, tipo y tienda.",
      "Descarga en <b>Excel</b> o <b>PDF</b> para tu declaración. Los anulados se muestran pero no suman." ] },
    { need: ["ADMIN"], t: "Administración", s: [
      "<b>Ventas</b>: resumen por fechas, tienda y vendedor; descárgalo en Excel o PDF.",
      "<b>Roles y permisos</b>: decide qué puede hacer cada rol. <b>Usuarios</b>: asigna rol y tienda.",
      "<b>Etiquetas de clientes</b>: con «Mostrar al cliente» decides si el cliente ve su etiqueta en Mi cuenta.",
      "<b>Textos de la tienda</b>, portada y pie: cambian lo que ve el cliente sin tocar el diseño.",
      "<b>Sistema</b>: espacio usado y PIN de cierre para todas las tiendas." ] },
  ];
  function renderGuia() {
    const X = D(); const u = X.state.user;
    const roles = u ? X.myRoles() : []; const client = !u || X.isClient();
    const vis = G.filter((g) => (g.need ? (g.need.includes("ADMIN") ? X.isAdmin() : (g.need.includes("CONTADOR") && !X.isAdmin() ? roles.includes("CONTADOR") : X.allow(g.need))) : (g.client ? client || X.isAdmin() : true)));
    const who = !u ? "Visitante" : X.isAdmin() ? "Administrador" : roles.map((r) => X.ROLE_LABEL[r] || r).filter(Boolean).join(" · ") || "Cliente";
    return `<section class="stack guia34" style="padding:28px 0 56px;max-width:760px"><p class="kicker">Guía de uso</p><h1>Cómo usar DAN-LINER</h1>
      <p class="muted">Mostrando lo que corresponde a: <b>${esc(who)}</b>.</p>
      ${vis.map((g, i) => `<details class="panel" ${i === 0 ? "open" : ""}><summary><b>${esc(g.t)}</b></summary><ol class="stack" style="padding-top:8px">${g.s.map((x) => `<li>${x}</li>`).join("")}</ol></details>`).join("")}
      ${u ? `<a class="link-btn" href="#cuenta">← Mi cuenta</a>` : `<a class="btn" href="#entrar">Entrar</a>`}</section>`;
  }
  window.DL_SCREENS = Object.assign(window.DL_SCREENS || {}, { guia: renderGuia });

  const prevExtra = window.DL_CUENTA_EXTRA;
  window.DL_CUENTA_EXTRA = () => {
    const base = prevExtra ? prevExtra() : "";
    if (!D().state.user) return base;
    return base + `<div class="stack" style="margin:12px 0">${notifCard()}<a class="pin-card guia-card" href="#guia"><span><b>Guía de uso</b><small>Paso a paso según tu rol.</small></span><span class="pin-go" aria-hidden="true">›</span></a></div>`;
  };
})();
