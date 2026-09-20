/* Gnomore Gnomes — menú de ajustes de la partida.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Pintar el icono de engranaje fijo arriba a la derecha (durante la
       partida, dentro de #screen-board).
     - Abrir/cerrar su popup de opciones.
     - De momento, UNA sola opción: "Salir de la partida" — vuelve al menú
       principal terminando la partida actual.

   Pedido explícito: "el icono de puntos de gloria esta tapando el icono de
   atras, el icono de atras lo eliminamos, creamos un nuevo icono con un
   engranaje que sera el de configuracion arriba a la derecha, al darle, un
   popup dara varias opciones, de momento solo la de salir de la partida
   (que regresa al menu principal terminando la partida actual)" — así que
   el back-btn flotante de #screen-board (ver index.html, ya quitado) queda
   sustituido por este icono + este popup; el resto de pantallas (menú,
   selección de modo/raza/rivales) conservan su back-btn normal, ese no
   tapaba nada y no es al que se refería el pedido.

   Estilo: "todas las interfaces conel estilo que te mostre antes" — la
   captura de referencia (HUD de Persona 5: banderines negros/rojos en
   diagonal, tipografía blanca en bloque, todo inclinado/irregular en vez de
   píldoras redondeadas) — ver las clases .p5-banner* en style.css,
   reutilizadas aquí para el propio icono, el panel y su única opción; el
   resto de HUD de la partida (end-turn-btn) se ha migrado a la misma
   familia visual en esta misma pasada. */

const SettingsMenu = {
  _btn: null,
  _overlay: null,
  _panel: null,

  init() {
    this._ensureButton();
    this._ensurePopup();
  },

  _ensureButton() {
    if (this._btn) return;
    const btn = document.createElement("button");
    btn.className = "settings-gear-btn";
    btn.setAttribute("aria-label", "Ajustes");
    btn.innerHTML = '<i class="ph ph-gear settings-gear-btn__icon"></i>';
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.open();
    });
    document.body.appendChild(btn);
    this._btn = btn;
  },

  _ensurePopup() {
    if (this._overlay) return;

    const overlay = document.createElement("div");
    overlay.className = "settings-overlay";
    // Clic fuera del panel = cerrar, igual que cualquier modal estándar.
    overlay.addEventListener("click", () => this.close());

    const panel = document.createElement("div");
    panel.className = "p5-banner settings-panel";
    // Que el clic DENTRO del panel no burbujee hasta el overlay y lo cierre.
    panel.addEventListener("click", (e) => e.stopPropagation());

    const title = document.createElement("div");
    title.className = "p5-banner__label settings-panel__title";
    title.textContent = "AJUSTES";
    panel.appendChild(title);

    const exitBtn = document.createElement("button");
    exitBtn.className = "p5-banner p5-banner--action settings-panel__option";
    exitBtn.innerHTML =
      '<i class="ph ph-door-open settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">Salir de la partida</span>';
    exitBtn.addEventListener("click", () => {
      SFX.click();
      this.close();
      this._exitMatch();
    });
    panel.appendChild(exitBtn);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlay = overlay;
    this._panel = panel;
  },

  open() {
    this._ensurePopup();
    SFX.click();
    this._overlay.classList.add("settings-overlay--visible");
  },

  close() {
    if (this._overlay) this._overlay.classList.remove("settings-overlay--visible");
  },

  // Mismo patrón que Turns._btn/end-turn-btn--visible: el icono vive fuera
  // de #screen-board (para no desaparecer solo al volver al menú desde el
  // propio tablero) así que su visibilidad se controla a mano — visible
  // mientras hay una partida en curso (llamado desde spawnTestUnits, ver
  // newgame-flow.js), oculto al salir (ver _exitMatch más abajo).
  showButton() {
    this._ensureButton();
    this._btn.classList.add("settings-gear-btn--visible");
  },

  hideButton() {
    if (this._btn) this._btn.classList.remove("settings-gear-btn--visible");
  },

  // Pedido explícito: "que regresa al menu principal teminando la partida
  // actual" — mismo destino que tenía el back-btn flotante de antes (ver
  // newgame-flow.js: startMatch/resumeMatch empujan "main-menu","screen-board"
  // al historial, así que reiniciarlo a solo "main-menu" y enseñar esa
  // pantalla es exactamente "terminar la partida y volver al menú", sin
  // dejar "screen-board" a medias en el historial para un goBack futuro).
  _exitMatch() {
    if (typeof screenHistory !== "undefined") {
      screenHistory.length = 0;
      screenHistory.push("main-menu");
    }
    if (typeof showScreen === "function") showScreen("main-menu");
    // Igual que hacía antes el listener del back-btn eliminado (ver
    // Turns.hideButton, turns.js) — el botón de pasar turno no debe seguir
    // visible la próxima vez que se abra el menú.
    if (typeof Turns !== "undefined") Turns.hideButton();
    if (typeof Glory !== "undefined") Glory.hideHud();
    this.hideButton();
  },
};

document.addEventListener("DOMContentLoaded", () => SettingsMenu.init());
