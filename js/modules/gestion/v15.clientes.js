// modules/gestion/v15.clientes.js · Clientes: etiquetas (chips con ícono y color, filtro por las más usadas, Mayorista bloqueada para vendedores), notas y mensajes; Admin › Etiquetas.
(function () {
  const { esc, rpc, fdate, human, rerender, toast, once, busy, remote } = window.DL_V15;
  const D = () => window.DL; const S = () => window.Store;
  const isAdmin = () => D().isAdmin(); const allow = (r) => D().allow(r);
  const ICONS = { crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5z", star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z", boxes: "M3 13h8v8H3zM13 13h8v8h-8zM8 3h8v8H8z", heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z", tag: "M3 12V4h8l10 10-8 8z", bolt: "M13 2L4 14h7l-1 8 9-12h-7z", gift: "M4 10h16v10H4zM2 7h20v3H2zM12 7v13", flag: "M5 21V4h11l-2 4 2 4H5", diamond: "M6 3h12l3 6-9 12L3 9zM3 9h18", sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", repeat: "M4 9a6 6 0 0 1 10-4l3 3M20 15a6 6 0 0 1-10 4l-3-3M17 4v4h-4M7 20v-4h4", alert: "M12 3l10 18H2zM12 10v5M12 18v.01", user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-5 4-7 8-7s7 2 8 7", truck: "M2 6h12v10H2zM14 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01" };
  const ICON_NAMES = { crown: "Corona", star: "Estrella", boxes: "Cajas · mayorista", heart: "Corazón", tag: "Etiqueta", bolt: "Rayo", gift: "Regalo", flag: "Bandera", diamond: "Diamante · VIP", sparkle: "Brillo · nuevo", repeat: "Frecuente", alert: "Alerta", user: "Persona", truck: "Envío" };
  const PALETTE = ["#D4AF37", "#8E44AD", "#2E86C1", "#16A085", "#C0392B", "#E67E22", "#2C3E50", "#7F8C8D", "#D35400", "#27AE60"];
  const iconSvg = (n) => (ICONS[n] ? `<svg class="ti" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>` : /[^\x00-\x7F]/.test(n || "") ? `<span class="ti" aria-hidden="true">${esc(n)}</span>` : "");
  const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c : "#888888");
  const chip = (t) => `<span class="tag-chip" style="--c:${safeColor(t.color)}">${iconSvg(t.icon)}${esc(t.name)}</span>`;
  const isMayorista = (t) => !!t && (t.code === "MAYORISTA" || (!t.code && /^mayorista$/i.test(t.name || "")));
  const TG = { list: null, stats: null, err: "", filter: [], edit: null, form: null };
  const NOTES = {};
  function loadTags(force) {
    if (!remote() || busy.tags || (!force && TG.list)) return;
    busy.tags = true;
    Promise.all([S().rest("customer_tags?select=*&order=sort_order,name").catch(() => []), rpc("tag_usage_stats", { p_include_inactive: true }).catch(() => [])])
      .then(([l, st]) => { TG.list = l || []; TG.stats = st || []; TG.err = ""; }).catch((e) => { TG.err = human(e); TG.list = []; }).finally(() => { busy.tags = false; rerender(); });
  }
  const tagById = (id) => (TG.list || []).find((t) => String(t.id) === String(id));
  window.DL_TAGS = { list: () => TG.list || [], load: loadTags, chip, iconSvg };
  window.DL_TAGS_HTML = (tags) => (tags || []).map(chip).join(" ");
  window.DL_CL_FILTER = () => TG.filter;
  window.DL_CL_EXT = {
    filterHtml() {
      loadTags(); if (!TG.list || !TG.list.length) return "";
      // más usadas primero (tag_usage_stats ya viene ordenado así)
      const used = (TG.stats || []).filter((s) => s.is_active !== false).slice().sort((a, b) => Number(b.customers_count || 0) - Number(a.customers_count || 0));
      const btn = (s) => { const on = TG.filter.includes(String(s.tag_id)); return `<button type="button" class="tag-chip ${on ? "on" : ""}" style="--c:${safeColor(s.color)}" data-act="tg-filter" data-id="${esc(s.tag_id)}" aria-pressed="${on}">${iconSvg(s.icon)}${esc(s.name)} <small>${Number(s.customers_count || 0)}</small></button>`; };
      const names = TG.filter.map((id) => (tagById(id) || {}).name).filter(Boolean);
      return `<details class="tag-filter" ${TG.open || TG.filter.length ? "open" : ""}><summary>${names.length ? "Etiquetas: " + esc(names.join(", ")) : "Filtrar por etiqueta"}</summary><div class="tags">${used.map(btn).join("")}${TG.filter.length ? `<button type="button" class="chip" data-act="tg-filter" data-id="">Quitar filtro</button>` : ""}</div></details>`;
    },
    detailHtml(c, row) {
      loadTags();
      const k = "cn" + c.id; const box = NOTES[k] || (NOTES[k] = { loaded: false });
      if (!box.loaded) setTimeout(() => once(k, () => rpc("get_customer_notes", { p_customer_id: Number(c.id) }), box), 0);
      if (!TG.edit || TG.edit.id !== c.id) { const cur = ((row && row.tags) || []).map((t) => String(t.id)); TG.edit = { id: c.id, ids: cur.slice(), orig: cur.slice() }; }
      const can = allow(["SUPERVISOR", "CAJERO", "VENDEDOR"]);
      const tags = (TG.list || []).filter((t) => t.is_active !== false || TG.edit.orig.includes(String(t.id)));
      const tagsHtml = tags.map((t) => { const on = TG.edit.ids.includes(String(t.id)); const lock = isMayorista(t) && !isAdmin();
        return `<button type="button" class="tag-chip ${on ? "on" : ""} ${lock ? "locked" : ""}" style="--c:${safeColor(t.color)}" data-act="tg-toggle" data-id="${esc(t.id)}" aria-pressed="${on}" ${lock || !can ? `disabled title="${lock ? "Solo el administrador marca o quita Mayorista" : "Sin permiso"}"` : ""}>${iconSvg(t.icon)}${esc(t.name)}${lock ? '<span class="sr-only"> (bloqueada)</span>' : ""}</button>`; }).join("");
      const dirty = TG.edit.ids.slice().sort().join() !== TG.edit.orig.slice().sort().join();
      const notes = box.data || [];
      return `<div class="panel stack cust-tags"><div class="row"><h3 class="grow" style="margin:0">Etiquetas</h3>${isAdmin() ? `<a class="tiny" href="#admin/etiquetas">Administrar etiquetas</a>` : ""}</div>
          ${TG.list ? `<div class="tags">${tagsHtml || `<span class="muted tiny">No hay etiquetas creadas.</span>`}</div>` : `<p class="muted tiny">Cargando etiquetas…</p>`}
          <p class="tiny">${isAdmin() ? "Mayorista activa el precio por mayor de este cliente." : "Mayorista cambia el precio por mayor: solo el administrador la pone o la quita."}</p>
          ${can && dirty ? `<button class="btn small" type="button" data-act="tg-save" data-id="${esc(c.id)}">Guardar etiquetas</button>` : ""}</div>
        <div class="panel stack cust-notes"><h3 style="margin:0">Notas y mensajes</h3>${box.err ? `<p class="alert-text">${esc(box.err)}</p>` : ""}
          ${!box.loaded ? `<p class="muted tiny">Cargando…</p>` : notes.length ? `<ul class="note-list">${notes.map((n) => `<li class="note-item ${n.visible_to_customer ? "is-msg" : ""}"><p>${esc(n.body)}</p><span class="tiny">${esc(n.author || "")} · ${esc(fdate(n.created_at, true))}${n.visible_to_customer ? ` · <b>Mensaje al cliente</b>${n.read_at ? " · leído" : " · sin leer"}` : " · nota interna"}</span>${n.can_delete ? ` <button class="link-btn tiny" type="button" data-act="cn-del" data-id="${esc(n.id)}" data-c="${esc(c.id)}">Borrar</button>` : ""}</li>`).join("")}</ul>` : `<p class="muted tiny">Sin notas.</p>`}
          ${can ? `<label>Nueva nota<textarea id="cn-body" maxlength="1000" rows="2" placeholder="Ej. Prefiere entalle slim; avisar cuando llegue talla 50."></textarea></label>
          <label class="checks"><input type="checkbox" id="cn-visible"> Enviar como mensaje al cliente (lo ve en Mi cuenta y le llega aviso)</label>
          <button class="btn small ghost" type="button" data-act="cn-add" data-id="${esc(c.id)}">Guardar nota</button>` : ""}</div>`;
    },
  };
  function renderTagsAdmin() {
    if (!isAdmin()) return `<p class="muted">Solo el administrador crea o cambia etiquetas.</p>`;
    loadTags();
    const e = TG.form || (TG.form = { id: null, name: "", icon: "tag", color: PALETTE[0] });
    const used = Object.fromEntries((TG.stats || []).map((s) => [String(s.tag_id), Number(s.customers_count || 0)]));
    return `<div class="stack" style="max-width:760px">
      <form novalidate class="panel stack" data-form="tag-save"><h3>${e.id ? "Editar etiqueta" : "Nueva etiqueta"}</h3>
        <div class="two"><label>Nombre<input name="name" maxlength="40" required value="${esc(e.name)}" ${e.code ? 'readonly title="Etiqueta del sistema: no se renombra"' : ""}></label>
          </div><fieldset class="icon-pick"><legend>Ícono</legend>${Object.keys(ICONS).map((k) => `<label class="${e.icon === k ? "on" : ""}"><input type="radio" name="icon" value="${k}" ${e.icon === k ? "checked" : ""}>${iconSvg(k)}<span>${ICON_NAMES[k] || k}</span></label>`).join("")}<label class="${!e.icon ? "on" : ""}"><input type="radio" name="icon" value="" ${!e.icon ? "checked" : ""}><span class="ti">∅</span><span>Sin ícono</span></label></fieldset><div></div>
        <div class="row" style="justify-content:flex-start;flex-wrap:wrap"><div class="color-dots" role="group" aria-label="Color">${PALETTE.map((c) => `<button type="button" class="${String(e.color).toUpperCase() === c ? "on" : ""}" style="background:${c}" data-act="tag-color" data-id="${c}" aria-label="Color ${c}" aria-pressed="${String(e.color).toUpperCase() === c}"></button>`).join("")}</div><label class="tiny row" style="gap:6px">Otro <input type="color" name="color_custom" value="${esc(safeColor(e.color))}" style="width:40px;padding:0"></label></div>
        <p class="tiny">Vista previa: ${chip({ name: e.name || "Etiqueta", icon: e.icon, color: e.color })}</p>
        ${window.DL_V17 && window.DL_V17.on() ? `<label class="checks"><input type="checkbox" name="visible" ${e.visible ? "checked" : ""}> Visible para el cliente <span class="tiny muted">(la ve en Mi cuenta)</span></label>` : ""}
        <div class="row"><button class="btn" type="submit">${e.id ? "Guardar" : "Crear etiqueta"}</button>${e.id ? `<button class="btn ghost" type="button" data-act="tag-new">Cancelar</button>` : ""}</div></form>
      <div class="panel stack"><h3>Etiquetas (${(TG.list || []).length})</h3>${TG.err ? `<p class="alert-text">${esc(TG.err)}</p>` : ""}
        ${TG.list ? TG.list.map((t) => `<div class="row tag-row"><span class="grow">${chip(t)} ${t.is_active === false ? `<span class="tiny muted">inactiva</span>` : ""}${t.visible_to_customer ? ` <span class="tiny tag-vis" title="El cliente la ve en Mi cuenta">Visible para el cliente</span>` : ""} ${t.code ? `<span class="tiny muted">del sistema</span>` : ""}</span><span class="tiny">${used[String(t.id)] || 0} clientes</span>
          <button class="btn small ghost" type="button" data-act="tag-edit" data-id="${esc(t.id)}">Editar</button>${t.code ? "" : `<button class="btn small ghost" type="button" data-act="tag-del" data-id="${esc(t.id)}">Quitar</button>`}</div>`).join("") : `<p class="muted">Cargando…</p>`}</div></div>`;
  }
  window.DL_ADMIN_TABS = (window.DL_ADMIN_TABS || []).concat([{ id: "etiquetas", label: "Etiquetas de clientes", need: ["ADMIN"], render: renderTagsAdmin }]);
  window.DL_FORMS = Object.assign(window.DL_FORMS || {}, {
    "tag-save": async (form) => {
      const g = (n) => form.elements[n]; const custom = g("color_custom").value;
      const color = (custom.toUpperCase() !== safeColor(TG.form.color).toUpperCase() ? custom : TG.form.color).toUpperCase();
      const name = g("name").value.trim(); if (name.length < 2) throw new Error("El nombre necesita al menos 2 letras.");
      const saved = await rpc("upsert_customer_tag", { p_id: TG.form.id ? Number(TG.form.id) : null, p_name: name, p_icon: g("icon").value || null, p_color: color });
      // v32 (BD v17): visible para el cliente
      if (g("visible")) { const id = TG.form.id || (saved && typeof saved === "object" ? saved.id : saved); const vis = g("visible").checked; if (id && vis !== !!TG.form.visible0) await window.DL_V17.call("tagVisibility", { p_tag_id: Number(id), p_visible: vis }); }
      TG.form = null; loadTags(true); toast("Etiqueta guardada ✓", "ok");
    },
  });
  document.addEventListener("change", (ev) => { const t = ev.target; if (t && t.name === "visible" && t.form && t.form.dataset.form === "tag-save" && TG.form) TG.form.visible = t.checked; });
  window.DL_ACTIONS = Object.assign(window.DL_ACTIONS || {}, {
    "tg-filter": (el) => { const id = el.dataset.id; TG.filter = !id ? [] : TG.filter.includes(id) ? TG.filter.filter((x) => x !== id) : TG.filter.concat(id); TG.open = true; rerender(); if (window.DL_CL_RELOAD) window.DL_CL_RELOAD(); },
    "tg-toggle": (el) => { const id = String(el.dataset.id); if (isMayorista(tagById(id)) && !isAdmin()) return; const e = TG.edit; e.ids = e.ids.includes(id) ? e.ids.filter((x) => x !== id) : e.ids.concat(id); if (e.ids.length > 10) { e.ids.pop(); toast("Máximo 10 etiquetas por cliente.", "error"); } rerender(); },
    "tg-save": async (el) => {
      // Mayorista: un vendedor reenvía siempre el estado original (la BD rechaza cambiarla si no es admin)
      if (!isAdmin()) { const may = (TG.list || []).find(isMayorista); if (may) { const id = String(may.id); const had = TG.edit.orig.includes(id); TG.edit.ids = TG.edit.ids.filter((x) => x !== id).concat(had ? [id] : []); } }
      const r = await rpc("set_customer_tags", { p_customer_id: Number(el.dataset.id), p_tag_ids: TG.edit.ids.map(Number) });
      TG.edit.orig = (r || []).map((t) => String(t.id)); TG.edit.ids = TG.edit.orig.slice(); loadTags(true); if (window.DL_CL_RELOAD) window.DL_CL_RELOAD();
      toast("Etiquetas guardadas ✓", "ok");
    },
    "cn-add": async (el) => {
      const body = ((document.getElementById("cn-body") || {}).value || "").trim(); const vis = !!(document.getElementById("cn-visible") || {}).checked;
      if (!body) throw new Error("Escribe la nota.");
      await rpc("add_customer_note", { p_customer_id: Number(el.dataset.id), p_body: body, p_visible_to_customer: vis });
      NOTES["cn" + el.dataset.id] = { loaded: false }; rerender(); toast(vis ? "Mensaje enviado al cliente ✓" : "Nota guardada ✓", "ok");
    },
    "cn-del": async (el) => { if (!(await window.dlgConfirm("¿Borrar esta nota?", { ok: "Borrar", danger: true }))) return; await rpc("delete_customer_note", { p_note_id: Number(el.dataset.id) }); NOTES["cn" + el.dataset.c] = { loaded: false }; rerender(); },
    "tag-color": (el) => { const f = el.closest("form"); if (f) { TG.form.name = f.elements.name.value; TG.form.icon = f.elements.icon ? f.elements.icon.value : TG.form.icon; } TG.form.color = el.dataset.id; rerender(); },
    "tag-new": () => { TG.form = null; rerender(); },
    "tag-edit": (el) => { const t = tagById(el.dataset.id); TG.form = { id: t.id, name: t.name, icon: t.icon || "", color: safeColor(t.color), code: t.code, visible: !!t.visible_to_customer, visible0: !!t.visible_to_customer }; rerender(); window.scrollTo(0, 0); },
    "tag-del": async (el) => { const t = tagById(el.dataset.id); if (!(await window.dlgConfirm(`¿Quitar la etiqueta «${t.name}»? Si ya se usó, solo se desactiva.`, { ok: "Quitar", danger: true }))) return; const r = await rpc("delete_customer_tag", { p_id: Number(t.id) }); loadTags(true); toast(r === "DESACTIVADA" ? "Etiqueta desactivada (ya estaba en uso)" : "Etiqueta eliminada", "ok"); },
  });
  document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest('[data-act="cl-back"]')) TG.edit = null; }, true);
})();
