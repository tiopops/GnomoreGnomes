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

// Recorte de la cara dentro del círculo de información, UNO POR TIPO DE
// PERSONAJE (mismo patrón que GNOME_ATTACH_OFFSETS en gnome.js): cada
// sprite tiene la cabeza en un sitio distinto, así que un único recorte
// para todos no encaja bien con ninguno en particular.
//
// Implementado con background-image (no <img>+object-fit/transform como
// antes): con object-fit:cover, un sprite casi tan ancho como alto dentro
// de un círculo también casi cuadrado deja muy poco margen de sobra para
// mover — object-position apenas tenía nada que recorrer y el resultado
// era que arrastrar los sliders de posición no se notaba. Con
// background-position + background-size si que hay margen real que
// recorrer siempre (el "zoom" agranda la imagen de fondo más allá del
// propio círculo a propósito), así que "x"/"y" desplazan la cara de
// verdad. No hace falta un transform-origin aparte: background-position
// ya expresa directamente "qué punto de la imagen se ve en el centro".
//   x/y: background-position (%), 0=borde izq./sup., 100=borde der./inf.
//   zoom: background-size, en % del ancho del círculo (100% = la imagen
//         cubre el círculo justo; más alto = más cerca/recortado).
// "default" se usa para cualquier tipo sin entrada propia. Calibrado con
// debug/calibrar-char.html — pega ahí el bloque que genere esa
// herramienta cuando haga falta reajustar algún personaje.
const FACE_OFFSETS = {
  default: { x: 50, y: 15, zoom: 230 },
  hombre_arbol: { x: 72, y: 14, zoom: 225 },
  surcabosques: { x: 87, y: 23, zoom: 165 },
  seta_artificiero: { x: 72, y: 32, zoom: 180 },
  goblin_lanzador: { x: 70, y: 21, zoom: 190 },
  urgamentes: { x: 75, y: 12, zoom: 160 },
  punoroca: { x: 89, y: 13, zoom: 210 },
};

const UnitInfo = {
  buttonEl: null,
  overlayEl: null,
  currentUnit: null,

  faceEl: null,

  ensureButton() {
    if (this.buttonEl) return this.buttonEl;
    const btn = document.createElement("button");
    btn.id = "unit-info-btn";
    btn.className = "unit-info-btn";
    btn.setAttribute("aria-label", "Mantén pulsado para ver las estadísticas del personaje");
    // La cara del propio personaje seleccionado, recortada en círculo, en
    // vez de un icono genérico de "i" — así el botón identifica de un
    // vistazo A QUIÉN estás consultando (útil sobre todo cuando hay varias
    // unidades parecidas en pantalla). Es un <div> con background-image
    // (no un <img>, ver FACE_OFFSETS arriba) para poder recortar/mover la
    // cara con background-position + background-size.
    btn.innerHTML = '<span class="unit-info-btn__face-wrap"><div class="unit-info-btn__face" role="img"></div></span>';
    this.faceEl = btn.querySelector(".unit-info-btn__face");
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
    const type = UNIT_TYPES[unit.typeId];
    this.faceEl.setAttribute("aria-label", type.name);
    this.faceEl.classList.toggle("unit-info-btn__face--enemy", unit.team === "enemy");
    // Recorte propio de este personaje (ver FACE_OFFSETS arriba) — se
    // aplica inline porque depende del typeId, a diferencia del resto de
    // reglas de .unit-info-btn__face que sí son fijas en el CSS.
    const face = FACE_OFFSETS[unit.typeId] || FACE_OFFSETS.default;
    this.faceEl.style.backgroundImage = `url(${type.spriteUrl})`;
    this.faceEl.style.backgroundPosition = `${face.x}% ${face.y}%`;
    this.faceEl.style.backgroundSize = `${face.zoom}% auto`;
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
    // Si ya hay una abierta, no se recrea — en móvil un mismo toque puede
    // disparar el pointerdown más de una vez (o llegar uno "fantasma" justo
    // después del real); antes esto llamaba a closePopup() y volvía a
    // crear el overlay, lo que cortaba en seco la transición de entrada a
    // mitad de camino y se veía como un parpadeo justo al abrirse.
    if (this.overlayEl) return;
    const unit = this.currentUnit;
    const type = UNIT_TYPES[unit.typeId];
    SFX.click();

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
