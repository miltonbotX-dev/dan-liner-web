// core/forms.js · v32: validación propia de formularios (sin globos nativos del navegador).
// Todo <form novalidate> lleva novalidate; al enviar se revisan required/pattern/min/max/type y el error se muestra con .field-err junto al campo.
// API: DL_VALIDATE(form) → true/false · DL_FIELD_ERR(form, name, msg) marca un campo · DL_CLEAR_ERRS(form).
(function () {
  const isField = (el) => el && el.willValidate && !el.disabled && el.type !== "hidden" && el.type !== "submit" && el.type !== "button";
  function message(el) {
    const v = el.validity; const custom = el.dataset && el.dataset.err;
    if (v.valueMissing) return custom || (el.type === "radio" || el.tagName === "SELECT" ? "Elige una opción." : el.type === "checkbox" ? "Marca esta casilla para continuar." : el.type === "file" ? "Sube el archivo." : "Completa este campo.");
    if (v.typeMismatch) return el.type === "email" ? "Escribe un correo válido (ej. nombre@correo.com)." : el.type === "url" ? "Escribe un enlace válido (empieza con https://)." : "Revisa el formato.";
    if (v.patternMismatch) return custom || el.title || "Revisa el formato.";
    if (v.tooShort) return `Escribe al menos ${el.minLength} caracteres.`;
    if (v.tooLong) return `Máximo ${el.maxLength} caracteres.`;
    if (v.rangeUnderflow) return `El mínimo es ${el.min}.`;
    if (v.rangeOverflow) return `El máximo es ${el.max}.`;
    if (v.stepMismatch) return "Revisa el valor (decimales).";
    if (v.badInput) return "Escribe un número válido.";
    return el.validationMessage || "Revisa este campo.";
  }
  // dónde va el mensaje: dentro del <label> del campo, o después del grupo (radios) o del campo
  function slot(el) {
    const host = (el.type === "radio" || el.type === "checkbox") && el.closest("fieldset, [role=radiogroup], .pay-choice, .ship-choice, .season-pick") || el.closest("label") || el;
    let s = host.tagName === "LABEL" || host.tagName === "FIELDSET" || host.getAttribute("role") === "radiogroup" ? host.querySelector(":scope > .field-err") : null;
    if (!s && host.nextElementSibling && host.nextElementSibling.classList.contains("field-err") && host.nextElementSibling.dataset.auto) s = host.nextElementSibling;
    if (!s) { s = document.createElement("span"); s.className = "field-err"; s.dataset.auto = "1"; s.setAttribute("role", "alert");
      if (host === el || host.classList.contains("pay-choice") || host.classList.contains("ship-choice")) host.insertAdjacentElement("afterend", s); else host.appendChild(s); }
    return s;
  }
  function mark(el, msg) {
    const s = slot(el); s.textContent = msg || ""; s.hidden = !msg;
    if (msg) { el.setAttribute("aria-invalid", "true"); if (!s.id) s.id = "fe-" + Math.random().toString(36).slice(2, 8); el.setAttribute("aria-describedby", s.id); }
    else el.removeAttribute("aria-invalid");
  }
  function clear(form) { form.querySelectorAll(".field-err").forEach((s) => { if (s.dataset.auto) s.remove(); else s.textContent = ""; }); form.querySelectorAll("[aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid")); }
  function validate(form) {
    if (!form || form.dataset.validate === "off") return true;
    clear(form); let first = null; const seen = new Set();
    [...form.elements].forEach((el) => {
      if (!isField(el) || (el.type === "radio" && seen.has(el.name))) return; if (el.type === "radio") seen.add(el.name);
      if (!el.checkValidity()) { mark(el, message(el)); if (!first) first = el; }
    });
    if (first) { try { first.focus({ preventScroll: true }); first.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { } }
    return !first;
  }
  function fieldErr(form, name, msg) { if (!form) return; const el = form.elements[name]; const one = el && el.length && !el.tagName ? el[0] : el; if (one) { mark(one, msg); if (msg) try { one.focus({ preventScroll: true }); } catch { } } }
  const setNovalidate = (root) => (root.querySelectorAll ? root.querySelectorAll("form:not([novalidate])") : []).forEach((f) => f.setAttribute("novalidate", ""));
  // sin globos nativos aunque algún formulario se cuele sin novalidate
  document.addEventListener("invalid", (e) => { e.preventDefault(); const el = e.target; if (el && el.form) mark(el, message(el)); }, true);
  // antes que el manejador de envío de la app (fase de captura en document)
  document.addEventListener("submit", (e) => { const f = e.target; if (f && f.tagName === "FORM" && !validate(f)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  const relax = (e) => { const el = e.target; if (!el || !el.form || el.getAttribute("aria-invalid") !== "true") return; if (el.checkValidity()) mark(el, ""); };
  document.addEventListener("input", relax, true); document.addEventListener("change", relax, true);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.tagName === "FORM") n.setAttribute("novalidate", ""); setNovalidate(n); } }))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => setNovalidate(document));
  window.DL_VALIDATE = validate; window.DL_FIELD_ERR = fieldErr; window.DL_CLEAR_ERRS = clear;
})();
