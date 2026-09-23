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
// Pedido explícito (vuelta atrás): "El recorte de la cara debe ser
// individual para cada pesrsonaje en calibrar char" — se prueba una
// versión compartida por todos los personajes (un único objeto) en una
// pasada anterior, pero se pide volver a UNA ENTRADA POR TIPO DE PERSONAJE,
// como al principio. `default` es el respaldo para cualquier typeId sin
// entrada propia todavía. Las 6 ya están calibradas por separado desde
// debug/calibrar-char.html — recalíbralas una a una ahí si hace falta
// ajustar alguna en particular.
// Calibrado con debug/calibrar-char.html.
const FACE_OFFSETS = {
  hombre_arbol: { x: 72, y: 14, zoom: 225 },
  surcabosques: { x: 86, y: 24, zoom: 180 },
  seta_artificiero: { x: 72, y: 29, zoom: 180 },
  goblin_lanzador: { x: 76, y: 25, zoom: 195 },
  urgamentes: { x: 79, y: 10, zoom: 155 },
  punoroca: { x: 92, y: 14, zoom: 200 },
  default: { x: 72, y: 14, zoom: 225 },
};

// Descripción corta de cada personaje, mostrada en el popup justo debajo de
// su sprite (pedido explícito: "vamos a añadirle a los popup una pequeña
// descripcion, debajo de su sprite") — igual que FACE_OFFSETS arriba, una
// entrada por typeId en vez de vivir dentro de UNIT_TYPES (js/units.js) para
// no mezclar datos de calibración/flavor con las estadísticas de juego.
// Editable desde debug/configurar-personajes.html (antes calibrar-tamano.html
// — pedido explícito: "esta descripcion se podra editar tambien desde
// calibrar-tamano que ahora pasa a llamarse configurar-personajes"), que
// genera el bloque completo listo para pegar aquí. Un typeId sin entrada
// simplemente no muestra ningún párrafo de descripción en el popup.
const UNIT_DESCRIPTIONS = {
  hombre_arbol: "Un golem de corteza y musgo que nunca ha tenido prisa por llegar a ningún sitio, pero tampoco por caer.",
  surcabosques: "Se desliza entre los árboles más rápido de lo que nadie puede seguirle la pista.",
  seta_artificiero: "Experimenta con esporas explosivas y, milagrosamente, casi nunca se hace daño a sí mismo.",
  goblin_lanzador: "El mejor brazo de las Colinas Rock'n Troll — nadie lanza un gnomo más lejos ni más certero.",
  urgamentes: "Piensa cada jugada tres veces antes de moverse, lo cual explica por qué siempre llega tarde.",
  punoroca: "Sus puños son más duros que la piedra de la que sacó el nombre.",
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
    // Indicador de acciones restantes (pedido explícito: "2 bolitas que se
    // apaguen...que indique las acciones que les faltan a los personajes...
    // sobre el icono de sus caras" — mockup aprobado: misma silueta
    // irregular --gg-badge-clip/--gg-badge-tilt que el resto de badges del
    // juego, no un rectángulo redondeado, ver settings-gear-btn/backpack-
    // close-btn/option-card__icon en style.css) — arriba-izquierda del
    // círculo de la cara, el único hueco libre: el abanico de botones de
    // acción del gnomo solo aparece a la DERECHA (UI_LAYOUT.actionButtons,
    // -34°/11°) y la mochila vive justo ENCIMA de este círculo, no a su
    // izquierda.
    btn.innerHTML =
      '<span class="unit-info-btn__face-wrap">' +
      '<div class="unit-info-btn__face" role="img"></div>' +
      '<div class="unit-info-action-dots">' +
      '<span class="unit-info-action-dot"></span>' +
      '<span class="unit-info-action-dot"></span>' +
      "</div>" +
      "</span>";
    this.faceEl = btn.querySelector(".unit-info-btn__face");
    this.actionDotsEl = btn.querySelector(".unit-info-action-dots");
    this.actionDotEls = Array.from(btn.querySelectorAll(".unit-info-action-dot"));
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
    // Recorte individual por personaje (ver FACE_OFFSETS arriba) — se
    // aplica inline porque el resto de reglas de .unit-info-btn__face sí
    // son fijas en el CSS.
    const face = FACE_OFFSETS[unit.typeId] || FACE_OFFSETS.default;
    this.faceEl.style.backgroundImage = `url(${type.spriteUrl})`;
    this.faceEl.style.backgroundPosition = `${face.x}% ${face.y}%`;
    this.faceEl.style.backgroundSize = `${face.zoom}% auto`;
    // Si ya estaba visible (cambio directo de una unidad seleccionada a
    // otra) no hace falta re-disparar la transición de entrada.
    requestAnimationFrame(() => btn.classList.add("unit-info-btn--visible"));
    this._renderActionDots(unit);
  },

  onDeselect() {
    this.currentUnit = null;
    if (this.buttonEl) this.buttonEl.classList.remove("unit-info-btn--visible");
    this.closePopup();
  },

  // Pinta las 2 bolitas del indicador de acciones restantes según
  // Turns.actionsUsed — encendida (amarilla) mientras esa acción todavía
  // esté disponible, apagada (gris) en cuanto se gasta. Se llama al
  // seleccionar (onSelect) y cada vez que Turns cambia el conteo de
  // acciones de la unidad seleccionada ahora mismo (ver refreshActionDots).
  _renderActionDots(unit) {
    if (!this.actionDotEls || this.actionDotEls.length === 0) return;
    const used = typeof Turns !== "undefined" ? Turns.actionsUsed[unit.id] || 0 : 0;
    const max = typeof TURNS_MAX_ACTIONS !== "undefined" ? TURNS_MAX_ACTIONS : 2;
    const remaining = Math.max(0, max - used);
    this.actionDotEls.forEach((dot, i) => {
      dot.classList.toggle("unit-info-action-dot--spent", i >= remaining);
    });
  },

  // Versión pública para que js/turns.js avise cuando cambie el conteo de
  // acciones de la unidad que esté seleccionada AHORA MISMO — no hace falta
  // que turns.js sepa nada de cómo se pinta el indicador, solo que existe.
  refreshActionDots() {
    if (this.currentUnit) this._renderActionDots(this.currentUnit);
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
    // Descripción de flavor (ver UNIT_DESCRIPTIONS arriba) — solo se pinta
    // el párrafo si el personaje tiene una definida, para no dejar un hueco
    // vacío mientras se van rellenando desde configurar-personajes.html.
    const desc = UNIT_DESCRIPTIONS[unit.typeId];
    // Habilidad especial de un solo uso (js/abilities.js) — mismo patrón
    // que la descripción de flavor: solo se pinta el bloque si este tipo
    // tiene una definida (LanzaGnomos todavía no la tiene, "falta por
    // definir"). El icono es el mismo que el del botón de activarla, así
    // se reconoce de un vistazo cuál es. Cuando ya se gastó (unit.abilityUsed)
    // se marca como tal en vez de desaparecer del todo, para que se pueda
    // seguir consultando QUÉ hacía aunque ya no quede disponible.
    const ability = ABILITIES[unit.typeId];
    // pointer-events: none en el propio overlay (ver CSS) — es solo un
    // resumen mientras se mantiene pulsado, no debe poder interceptar ni
    // absorber ningún clic/toque de la pantalla que hay debajo.
    overlay.innerHTML = `
      <div class="unit-info-card">
        <div class="unit-info-portrait${unit.team === "enemy" ? " unit-info-portrait--enemy" : ""}">
          <img src="${type.spriteUrl}" alt="">
        </div>
        ${desc ? `<p class="unit-info-desc">${desc}</p>` : ""}
        <h2 class="unit-info-name">${type.name}</h2>
        <div class="unit-info-hp"><i class="ph ph-heart"></i> ${unit.hp} / ${unit.maxHp}</div>
        <div class="unit-info-stats">
          ${this.statRow("ph-shield", "Aguante", type.aguante)}
          ${this.statRow("ph-footprints", "Movimiento", type.movimiento)}
          ${this.statRow("ph-boxing-glove", "Fuerza", type.fuerza)}
          ${this.statRow("ph-wind", "Agilidad", type.agilidad)}
          ${this.statRow("ph-eye", "Percepción", type.percepcion)}
        </div>
        ${
          ability
            ? `<div class="unit-info-ability${unit.abilityUsed ? " unit-info-ability--used" : ""}">
                <div class="unit-info-ability__header">
                  ${
                    ability.iconImg
                      ? `<img class="unit-info-ability__icon-img${unit.typeId === "surcabosques" ? " unit-info-ability__icon-img--surcabosques" : ""}" src="${ability.iconImg}" alt="">`
                      : `<i class="ph ${ability.icon}"></i>`
                  }
                  <span class="unit-info-ability__name">${ability.name}</span>
                  ${unit.abilityUsed ? '<span class="unit-info-ability__tag">Ya usada</span>' : ""}
                </div>
                <p class="unit-info-ability__desc">${ability.description}</p>
              </div>`
            : ""
        }
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
