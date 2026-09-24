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

    // Pedido explícito: "haz que se puedan activar/desactivar con un
    // checkbox del estilo que estamos haciendo" — interruptor de las
    // sombras proyectadas (js/shadows.js). Estado inicial leído de
    // Shadows.enabled (ya cargado de localStorage por Shadows.init, que
    // corre en su propio DOMContentLoaded antes de que el jugador pueda
    // llegar a abrir este popup).
    const shadowsBtn = document.createElement("button");
    shadowsBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const shadowsChecked = typeof Shadows !== "undefined" ? Shadows.enabled : true;
    shadowsBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-sun settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">Sombras</span>' +
      "</span>" +
      `<span class="settings-toggle" data-checked="${shadowsChecked}"><i class="ph ph-check settings-toggle__check"></i></span>`;
    shadowsBtn.addEventListener("click", () => {
      // Pedido explícito: "cuando el modo rendimiento esta activado, las
      // sombras y la animacion de niebla deben estar bloqueadas" — con el
      // modo rendimiento encendido este checkbox no hace nada (ver
      // _syncPerfLock más abajo, que además lo pinta visualmente apagado).
      if (typeof PerfMode !== "undefined" && PerfMode.enabled) return;
      SFX.click();
      const next = typeof Shadows !== "undefined" ? !Shadows.enabled : true;
      if (typeof Shadows !== "undefined") Shadows.setEnabled(next);
      shadowsBtn.querySelector(".settings-toggle").dataset.checked = String(next);
    });
    panel.appendChild(shadowsBtn);

    // Pedido explícito: "añade a configuracion otro checkbox que desconecte
    // los efectos de sonido (ojo! en un futuro habra musica, pero eso ira
    // por un lado distinto a los efectos de sonido)" — mismo patrón exacto
    // que el interruptor de Sombras de arriba, pero para SFX (js/sfx.js).
    // Interruptor propio, independiente a propósito: el día que exista
    // música de fondo, será OTRO checkbox aparte con su propia clave de
    // localStorage, nunca compartido con este.
    const sfxBtn = document.createElement("button");
    sfxBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const sfxChecked = typeof SFX !== "undefined" ? SFX.enabled : true;
    sfxBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-speaker-high settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">Efectos de sonido</span>' +
      "</span>" +
      `<span class="settings-toggle" data-checked="${sfxChecked}"><i class="ph ph-check settings-toggle__check"></i></span>`;
    sfxBtn.addEventListener("click", () => {
      const next = typeof SFX !== "undefined" ? !SFX.enabled : true;
      // El propio clic del checkbox solo tiene que sonar si el sonido
      // queda ACTIVADO tras este toque — por eso, a diferencia del resto
      // de botones del panel, aquí el orden importa: activar primero (para
      // que el gain maestro ya esté a 1 cuando suene el clic) y solo
      // silenciar después de reproducirlo; al desactivar, ni se intenta.
      if (next) {
        if (typeof SFX !== "undefined") SFX.setEnabled(next);
        SFX.click();
      } else if (typeof SFX !== "undefined") {
        SFX.setEnabled(next);
      }
      sfxBtn.querySelector(".settings-toggle").dataset.checked = String(next);
    });
    panel.appendChild(sfxBtn);

    // Pedido explícito: "otra opcion en el menu de configuracion, otro
    // chekbox, llamado mostrar equipos. esta opcion por defecto viene
    // desabilitada, si se habilita muestra un circulo azul bajo los
    // aliados y uno rojo bajo los enemigos en la casilla en la que estan"
    // — mismo patrón exacto que Sombras/SFX de arriba, pero para
    // TeamMarkers (js/teammarkers.js), que por defecto empieza en false en
    // vez de true.
    const teamMarkersBtn = document.createElement("button");
    teamMarkersBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const teamMarkersChecked = typeof TeamMarkers !== "undefined" ? TeamMarkers.enabled : false;
    teamMarkersBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-users-three settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">Mostrar equipos</span>' +
      "</span>" +
      `<span class="settings-toggle" data-checked="${teamMarkersChecked}"><i class="ph ph-check settings-toggle__check"></i></span>`;
    teamMarkersBtn.addEventListener("click", () => {
      SFX.click();
      const next = typeof TeamMarkers !== "undefined" ? !TeamMarkers.enabled : false;
      if (typeof TeamMarkers !== "undefined") TeamMarkers.setEnabled(next);
      teamMarkersBtn.querySelector(".settings-toggle").dataset.checked = String(next);
    });
    panel.appendChild(teamMarkersBtn);

    // Pedido explícito: "añade un checkbox para desactivar activar la
    // animacion de la niebla en configuracion. en la interfaz movil por
    // defecto estara desactivada" — mismo patrón exacto que
    // Sombras/SFX/Mostrar equipos de arriba, pero para Fog.animEnabled
    // (js/fog.js), cuyo valor por defecto (si nunca se ha tocado este
    // checkbox) ya depende del ancho de pantalla al cargar la página —
    // aquí solo se lee y se alterna, la lógica del valor inicial vive en
    // Fog.initAnimPref.
    const fogAnimBtn = document.createElement("button");
    fogAnimBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const fogAnimChecked = typeof Fog !== "undefined" ? Fog.animEnabled : true;
    fogAnimBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-cloud-fog settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">Animación de niebla</span>' +
      "</span>" +
      `<span class="settings-toggle" data-checked="${fogAnimChecked}"><i class="ph ph-check settings-toggle__check"></i></span>`;
    fogAnimBtn.addEventListener("click", () => {
      // Ver la nota de shadowsBtn de arriba — mismo bloqueo mientras el
      // modo rendimiento esté activado.
      if (typeof PerfMode !== "undefined" && PerfMode.enabled) return;
      SFX.click();
      const next = typeof Fog !== "undefined" ? !Fog.animEnabled : true;
      if (typeof Fog !== "undefined") Fog.setAnimEnabled(next);
      fogAnimBtn.querySelector(".settings-toggle").dataset.checked = String(next);
    });
    panel.appendChild(fogAnimBtn);

    // Pedido explícito: "tampoco veo la opcion de la configuracion de la
    // resolucion dinamiga paara mejorar el rendimiento" — mismo patrón
    // exacto que Sombras/SFX/Mostrar equipos/Animación de niebla de arriba,
    // pero para PerfMode (js/perfmode.js), que por defecto empieza en
    // false (es un compromiso visual a cambio de rendimiento, así que hay
    // que pedirlo a propósito).
    const perfModeBtn = document.createElement("button");
    perfModeBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const perfModeChecked = typeof PerfMode !== "undefined" ? PerfMode.enabled : false;
    perfModeBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-gauge settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">Modo rendimiento</span>' +
      "</span>" +
      `<span class="settings-toggle" data-checked="${perfModeChecked}"><i class="ph ph-check settings-toggle__check"></i></span>`;
    perfModeBtn.addEventListener("click", () => {
      SFX.click();
      const next = typeof PerfMode !== "undefined" ? !PerfMode.enabled : false;
      if (typeof PerfMode !== "undefined") PerfMode.setEnabled(next);
      perfModeBtn.querySelector(".settings-toggle").dataset.checked = String(next);
      // Pedido explícito: "el modo rendimiento deberia desactivar por
      // defecto las sombras y la niebla animada" — PerfMode.setEnabled ya
      // apaga Shadows/Fog.animEnabled por su cuenta (ver perfmode.js), pero
      // esos dos interruptores son botones APARTE con su propio dibujo en
      // pantalla: si este panel sigue abierto hay que refrescarlos a mano
      // para que no se queden mostrando "activado" cuando en realidad ya
      // se acaban de apagar por debajo.
      if (next) {
        shadowsBtn.querySelector(".settings-toggle").dataset.checked = "false";
        fogAnimBtn.querySelector(".settings-toggle").dataset.checked = "false";
      }
      // Segundo pedido explícito, encima del anterior: "cuando el modo
      // rendimiento esta activado, las sombras y la animacion de niebla
      // deben estar bloqueadas" — no basta con apagarlos una vez, hay que
      // impedir que el jugador los vuelva a encender A MANO mientras el
      // modo rendimiento siga activo (ver _syncPerfLock).
      this._syncPerfLock();
    });
    panel.appendChild(perfModeBtn);
    this._shadowsBtn = shadowsBtn;
    this._fogAnimBtn = fogAnimBtn;
    this._syncPerfLock();

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
    this._syncPerfLock();
    SFX.click();
    this._overlay.classList.add("settings-overlay--visible");
  },

  // Pedido explícito: "cuando el modo rendimiento esta activado, las
  // sombras y la animacion de niebla deben estar bloqueadas" — pinta
  // Sombras/Animación de niebla como "deshabilitados" (opacidad baja,
  // cursor de prohibido) y hace que sus propios listeners de clic no
  // hagan nada mientras dure (ver esos dos listeners más arriba) en vez de
  // ocultarlos o quitarlos del DOM — así el jugador sigue viendo qué
  // opciones existen, solo que no se pueden tocar mientras el modo
  // rendimiento las esté forzando apagadas.
  _syncPerfLock() {
    if (!this._shadowsBtn || !this._fogAnimBtn) return;
    const locked = typeof PerfMode !== "undefined" && PerfMode.enabled;
    [this._shadowsBtn, this._fogAnimBtn].forEach((btn) => {
      btn.classList.toggle("settings-panel__option--locked", locked);
      btn.setAttribute("aria-disabled", String(locked));
    });
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
    if (typeof Backpack !== "undefined") Backpack.hideButton();
    this.hideButton();
  },
};

document.addEventListener("DOMContentLoaded", () => SettingsMenu.init());
