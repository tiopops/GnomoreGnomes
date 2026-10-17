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

  // Pulso sutil cada vez que el puntero cambia de color (blanco / amarillo / rojo): como un
  // cursor nativo no se anima, se dibuja una copia exacta encima que se amplía y vuelve.
  const CURSOR_COLORS = [["ffffff", "#ffffff"], ["ffcf3f", "#ffcf3f"], ["ff2d2d", "#ff2d2d"]];
  let lastKind = null, lastX = 0, lastY = 0;
  function cursorKind(el) {
    if (!el || !el.nodeType) return null;
    const c = getComputedStyle(el).cursor || "";
    for (const [k] of CURSOR_COLORS) if (c.indexOf(k) >= 0) return k;
    return null;
  }
  let pulseEl = null, pulseT = null, lastPulse = 0;
  function pulse(kind) {
    const col = (CURSOR_COLORS.find((c) => c[0] === kind) || [])[1];
    if (!col) return;
    const now = performance.now();
    if (now - lastPulse < 260) return; // sin ráfagas al pasar rápido entre zonas
    lastPulse = now;
    if (!pulseEl) {
      pulseEl = document.createElement("div");
      pulseEl.className = "cursor-pulse";
      document.body.appendChild(pulseEl);
    }
    pulseEl.innerHTML = `<svg width="30" height="30" viewBox="0 0 256 256"><polygon points="34,20 34,214 79,172 112,242 148,225 116,155 200,155" fill="${col}" stroke="#000" stroke-width="14" stroke-linejoin="round"/></svg>`;
    placePulse();
    pulseEl.style.display = "block";
    pulseEl.style.animation = "none";
    void pulseEl.offsetWidth;
    pulseEl.style.animation = "";
    clearTimeout(pulseT);
    pulseT = setTimeout(() => { if (pulseEl) pulseEl.style.display = "none"; }, 280);
  }
  function placePulse() {
    if (!pulseEl) return;
    pulseEl.style.left = `${lastX - 4}px`;
    pulseEl.style.top = `${lastY - 2}px`;
  }
  document.addEventListener("mouseover", (e) => {
    const k = cursorKind(e.target);
    if (k && lastKind && k !== lastKind) pulse(k);
    if (k) lastKind = k;
  });
  document.addEventListener("mousemove", (e) => { lastX = e.clientX; lastY = e.clientY; placePulse(); }, true);

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
