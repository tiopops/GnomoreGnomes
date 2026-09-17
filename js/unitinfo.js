/* Gnomore Gnomes — panel de información de la unidad seleccionada.
   Regla de oro: un archivo por mecánica. Este archivo solo gestiona el botón
   de información (esquina inferior izquierda) y la ventana emergente con las
   estadísticas — no toca selección, movimiento ni combate directamente, se
   entera de cada selección a través de la API pública de js/units.js
   (Units.registerSelectionListener), igual que movement.js/combat.js se
   conectan vía registerRangeProvider pero para UI que no vive sobre el
   tablero.

   A diferencia del radio de movimiento/ataque, el panel de información
   funciona para CUALQUIER unidad seleccionada (también un rival) — solo
   sirve para consultar datos, no para actuar.

   Interacción: es un botón de "mantener pulsado" (como un tooltip), no un
   toggle — se abre en pointerdown y se cierra en pointerup/pointercancel,
   sin botón de cerrar ni clic-fuera. El pointerup/cancel se escucha en
   window (no en el propio botón) para que soltar en cualquier punto de la
   pantalla cierre igualmente el popup, incluso si el dedo/ratón se ha
   desplazado fuera del botón antes de soltar. */

const UnitInfo = {
  buttonEl: null,
  overlayEl: null,
  currentUnit: null,

  ensureButton() {
    if (this.buttonEl) return this.buttonEl;
    const btn = document.createElement("button");
    btn.id = "unit-info-btn";
    btn.className = "unit-info-btn";
    btn.setAttribute("aria-label", "Mantén pulsado para ver las estadísticas del personaje");
    btn.innerHTML = '<i class="ph ph-info"></i>';
    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.openPopup();
    });
    // Evita que un long-press dispare además el menú contextual táctil.
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(btn);
    window.addEventListener("pointerup", () => this.closePopup());
    window.addEventListener("pointercancel", () => this.closePopup());
    this.buttonEl = btn;
    return btn;
  },

  onSelect(unit) {
    this.currentUnit = unit;
    const btn = this.ensureButton();
    // Si ya estaba visible (cambio directo de una unidad seleccionada a
    // otra) no hace falta re-disparar la transición de entrada.
    requestAnimationFrame(() => btn.classList.add("unit-info-btn--visible"));
  },

  onDeselect() {
    this.currentUnit = null;
    if (this.buttonEl) this.buttonEl.classList.remove("unit-info-btn--visible");
    this.closePopup();
  },

  // Una fila de estadística como 5 "pips" (puntos) rellenos hasta `value` —
  // más legible de un vistazo que un número, y dejando claro que la escala
  // siempre es sobre 5 para las 4 estadísticas del juego.
  statRow(icon, label, value) {
    const pips = Array.from(
      { length: 5 },
      (_, i) => `<span class="unit-stat-pip${i < value ? " unit-stat-pip--filled" : ""}"></span>`
    ).join("");
    return `
      <div class="unit-stat-row">
        <i class="ph ${icon} unit-stat-icon"></i>
        <span class="unit-stat-label">${label}</span>
        <span class="unit-stat-pips">${pips}</span>
      </div>`;
  },

  openPopup() {
    if (!this.currentUnit) return;
    const unit = this.currentUnit;
    const type = UNIT_TYPES[unit.typeId];
    SFX.click();

    // Por si quedara una abierta de antes (no debería, pero así nunca se
    // duplica el overlay).
    this.closePopup();

    const overlay = document.createElement("div");
    overlay.className = "unit-info-overlay";
    // pointer-events: none en el propio overlay (ver CSS) — es solo un
    // resumen mientras se mantiene pulsado, no debe poder interceptar ni
    // absorber ningún clic/toque de la pantalla que hay debajo.
    overlay.innerHTML = `
      <div class="unit-info-card">
        <div class="unit-info-portrait${unit.team === "enemy" ? " unit-info-portrait--enemy" : ""}">
          <img src="${type.spriteUrl}" alt="">
        </div>
        <h2 class="unit-info-name">${type.name}</h2>
        <div class="unit-info-hp"><i class="ph ph-heart"></i> ${unit.hp} / ${unit.maxHp}</div>
        <div class="unit-info-stats">
          ${this.statRow("ph-shield", "Aguante", type.aguante)}
          ${this.statRow("ph-footprints", "Movimiento", type.movimiento)}
          ${this.statRow("ph-boxing-glove", "Fuerza", type.fuerza)}
          ${this.statRow("ph-wind", "Agilidad", type.agilidad)}
        </div>
      </div>`;

    document.body.appendChild(overlay);
    this.overlayEl = overlay;
    requestAnimationFrame(() => overlay.classList.add("unit-info-overlay--visible"));
  },

  closePopup() {
    if (!this.overlayEl) return;
    const el = this.overlayEl;
    this.overlayEl = null;
    SFX.back();
    el.classList.remove("unit-info-overlay--visible");
    // Espera a que termine la transición de salida (ver css) antes de
    // quitarlo del DOM, para no cortar la animación de golpe.
    setTimeout(() => el.remove(), 220);
  },
};

Units.registerSelectionListener(UnitInfo);
