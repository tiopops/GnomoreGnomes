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
   sirve para consultar datos, no para actuar. */

const UnitInfo = {
  buttonEl: null,
  overlayEl: null,
  currentUnit: null,

  ensureButton() {
    if (this.buttonEl) return this.buttonEl;
    const btn = document.createElement("button");
    btn.id = "unit-info-btn";
    btn.className = "unit-info-btn";
    btn.setAttribute("aria-label", "Ver estadísticas del personaje");
    btn.innerHTML = '<i class="ph ph-info"></i>';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openPopup();
    });
    document.body.appendChild(btn);
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
    overlay.innerHTML = `
      <div class="unit-info-card">
        <button class="unit-info-close" aria-label="Cerrar"><i class="ph ph-x"></i></button>
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

    // Cerrar al hacer clic fuera de la tarjeta (en el propio fondo).
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.closePopup();
    });
    overlay.querySelector(".unit-info-close").addEventListener("click", () => this.closePopup());

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
