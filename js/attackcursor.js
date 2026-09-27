/* Gnomore Gnomes — halo de ataque pulsante (AttackCursorFx). Pedido
   explícito: "cuando el puntero se pone rojo porque representa un posible
   ataque, este debe palpitar energicamente".

   El cursor rojo en sí (--cursor-enemy, ver style.css :root) es un cursor
   nativo del sistema (una imagen SVG fija vía CSS `cursor:`) — los
   navegadores no animan cursores nativos, y solo repintan el cursor en
   eventos de ratón reales (no basta con cambiar la propiedad CSS estando
   quieto). En vez de pelearse contra esa limitación sustituyendo el cursor
   nativo entero (writeriesgo de romper su posicionamiento/hotspot en cada
   navegador), se añade un halo rojo adicional que sigue al puntero por
   encima con mousemove y palpita con una animation CSS de verdad mientras
   el ratón está sobre un objetivo atacable — el efecto combinado (daga roja
   nativa + halo palpitante alrededor) SÍ se lee como "el cursor palpita". */
(function () {
  const SELECTOR = ".unit--enemy, .village--enemy, .obelisk--enemy";
  let fxEl = null;

  function ensure() {
    if (fxEl) return fxEl;
    fxEl = document.createElement("div");
    fxEl.className = "attack-cursor-fx";
    document.body.appendChild(fxEl);
    return fxEl;
  }

  // Halo turquesa del modo de apuntado "ojo" de Visión Lejana (Surcabosques,
  // js/abilities.js) — pedido explícito: "el puntero de ojo de la habilidad
  // vision lejana...debe palpitar y tener un brillo azul celeste". Mismo
  // motivo exacto que el halo rojo de ataque de arriba (un cursor CSS nativo
  // no se puede animar): un segundo halo que sigue al ratón, esta vez
  // visible SIEMPRE que el modo esté activo (no solo al pasar sobre un
  // objetivo concreto — aquí cualquier loseta del mapa es un objetivo
  // válido, ver Abilities._startEyeTargeting), en vez de reutilizar el
  // mismo fxEl de arriba (evita que dos modos a la vez, aunque no debería
  // pasar, se pisen el uno al otro).
  let eyeFxEl = null;
  function ensureEyeFx() {
    if (eyeFxEl) return eyeFxEl;
    eyeFxEl = document.createElement("div");
    eyeFxEl.className = "eye-cursor-fx";
    document.body.appendChild(eyeFxEl);
    return eyeFxEl;
  }

  document.addEventListener("mousemove", (e) => {
    const el = ensure();
    const over = e.target && e.target.closest && e.target.closest(SELECTOR);
    el.classList.toggle("attack-cursor-fx--visible", !!over);
    if (over) {
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    }

    const eyeEl = ensureEyeFx();
    const eyeActive = document.body.classList.contains("ability-targeting--eye");
    eyeEl.classList.toggle("eye-cursor-fx--visible", eyeActive);
    if (eyeActive) {
      eyeEl.style.left = `${e.clientX}px`;
      eyeEl.style.top = `${e.clientY}px`;
    }
  });
})();
