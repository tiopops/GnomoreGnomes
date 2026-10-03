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
    title.textContent = I18N.t("settings_title");
    panel.appendChild(title);

    // Pedido explícito (segunda pasada): "reorganiza los botones de
    // confuguracion para que aparezcan en eset oden de aarriba a abajo:
    // efectos de sonido, musica..., mostrar equipos, sombras, animacion de
    // la niebla, vegeteacion, salir de la partida. si son demasiados para
    // ponerlos en una unica columna puedes mirar de ajustarlo en dos, dando
    // coherencia a las que agrupes en cada columna y debajo del todo el
    // boton salir de la partida centrado" — dos columnas temáticas (audio/
    // interfaz a la izquierda, visual/rendimiento a la derecha) en vez de
    // una única lista vertical larga; Modo rendimiento no estaba en la
    // lista de este pedido pero YA existía de un pedido anterior (ver
    // perfmode.js) y afecta directamente a Sombras/Niebla/Vegetación, así
    // que se queda agrupado junto a esas tres en vez de desaparecer.
    const columnsEl = document.createElement("div");
    columnsEl.className = "settings-panel__columns";
    const colAudio = document.createElement("div");
    colAudio.className = "settings-panel__column";
    const colVisual = document.createElement("div");
    colVisual.className = "settings-panel__column";
    columnsEl.appendChild(colAudio);
    columnsEl.appendChild(colVisual);
    panel.appendChild(columnsEl);

    // Pedido explícito: "añade a configuracion otro checkbox que desconecte
    // los efectos de sonido (ojo! en un futuro habra musica, pero eso ira
    // por un lado distinto a los efectos de sonido)" — mismo patrón exacto
    // que el resto de interruptores, pero para SFX (js/sfx.js). Interruptor
    // propio, independiente a propósito: el día que exista música de
    // fondo, será OTRO checkbox aparte con su propia clave de localStorage,
    // nunca compartido con este (ver el de Música, justo debajo).
    const sfxBtn = document.createElement("button");
    sfxBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const sfxChecked = typeof SFX !== "undefined" ? SFX.enabled : true;
    sfxBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-speaker-high settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">' + I18N.t("settings_sfx") + '</span>' +
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
    colAudio.appendChild(sfxBtn);
    colAudio.appendChild(this._buildSlider(I18N.t("settings_sfx_vol"), typeof SFX !== "undefined" ? SFX.volume : 1, (v) => {
      if (typeof SFX !== "undefined") SFX.setVolume(v);
    }, () => { if (typeof SFX !== "undefined" && SFX.enabled) SFX.click(); }));

    // Pedido explícito: "musica(aun por implementar, de momento no hace
    // ningun efecto)" — fila placeholder, visualmente igual que el resto
    // pero SIEMPRE bloqueada (mismo estilo --locked que ya usan Sombras/
    // Niebla cuando el modo rendimiento las fuerza apagadas) y sin ningún
    // listener: existe para que el jugador vea que la opción está prevista,
    // no hace absolutamente nada todavía (no hay música de fondo en el
    // juego, ver la nota de sfxBtn arriba).
    const musicBtn = document.createElement("button");
    musicBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const musicChecked = typeof Music !== "undefined" ? Music.enabled : true;
    musicBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-music-notes settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">' + I18N.t("settings_music") + '</span>' +
      "</span>" +
      `<span class="settings-toggle" data-checked="${musicChecked}"><i class="ph ph-check settings-toggle__check"></i></span>`;
    musicBtn.addEventListener("click", () => {
      SFX.click();
      const next = typeof Music !== "undefined" ? !Music.enabled : true;
      if (typeof Music !== "undefined") Music.setEnabled(next);
      musicBtn.querySelector(".settings-toggle").dataset.checked = String(next);
    });
    colAudio.appendChild(musicBtn);
    colAudio.appendChild(this._buildSlider(I18N.t("settings_music_vol"), typeof Music !== "undefined" ? Music.volume : 0.5, (v) => {
      if (typeof Music !== "undefined") Music.setVolume(v);
    }));

    // Pedido explícito: "otra opcion en el menu de configuracion, otro
    // chekbox, llamado mostrar equipos. esta opcion por defecto viene
    // desabilitada, si se habilita muestra un circulo azul bajo los
    // aliados y uno rojo bajo los enemigos en la casilla en la que estan"
    // — mismo patrón exacto que el resto, pero para TeamMarkers
    // (js/teammarkers.js), que por defecto empieza en false en vez de true.
    const teamMarkersBtn = document.createElement("button");
    teamMarkersBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const teamMarkersChecked = typeof TeamMarkers !== "undefined" ? TeamMarkers.enabled : false;
    teamMarkersBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-users-three settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">' + I18N.t("settings_teams") + '</span>' +
      "</span>" +
      `<span class="settings-toggle" data-checked="${teamMarkersChecked}"><i class="ph ph-check settings-toggle__check"></i></span>`;
    teamMarkersBtn.addEventListener("click", () => {
      SFX.click();
      const next = typeof TeamMarkers !== "undefined" ? !TeamMarkers.enabled : false;
      if (typeof TeamMarkers !== "undefined") TeamMarkers.setEnabled(next);
      teamMarkersBtn.querySelector(".settings-toggle").dataset.checked = String(next);
    });
    colAudio.appendChild(teamMarkersBtn);

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
      '<span class="p5-banner__label">' + I18N.t("settings_shadows") + '</span>' +
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
    colVisual.appendChild(shadowsBtn);

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
      '<span class="p5-banner__label">' + I18N.t("settings_fog") + '</span>' +
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
    colVisual.appendChild(fogAnimBtn);

    // Pedido explícito: "vegeteacion" en la lista reordenada de opciones —
    // interruptor de Hierbajos.enabled (js/hierbajos.js), mismo patrón
    // exacto que el resto. Bloqueado mientras el modo rendimiento esté
    // activo, igual que Sombras/Animación de niebla (ver _syncPerfLock).
    const vegetationBtn = document.createElement("button");
    vegetationBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const vegetationChecked = typeof Hierbajos !== "undefined" ? Hierbajos.enabled : true;
    vegetationBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-plant settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">' + I18N.t("settings_vegetation") + '</span>' +
      "</span>" +
      `<span class="settings-toggle" data-checked="${vegetationChecked}"><i class="ph ph-check settings-toggle__check"></i></span>`;
    vegetationBtn.addEventListener("click", () => {
      if (typeof PerfMode !== "undefined" && PerfMode.enabled) return;
      SFX.click();
      const next = typeof Hierbajos !== "undefined" ? !Hierbajos.enabled : true;
      if (typeof Hierbajos !== "undefined") Hierbajos.setEnabled(next);
      vegetationBtn.querySelector(".settings-toggle").dataset.checked = String(next);
    });
    colVisual.appendChild(vegetationBtn);

    // Pedido explícito: "a esta opción la llamaremos resolución adaptativa.
    // Se podrá activar/desactivar desde configuración y estará activada por
    // defecto en el modo alto rendimiento" — mismo patrón exacto que
    // Sombras/Animación de niebla/Vegetación de arriba, pero para
    // SpriteQuality.enabled (js/spritequality.js), que a diferencia de esas
    // tres empieza en TRUE por defecto (no es un compromiso visual, ver la
    // cabecera de ese archivo).
    const spriteQualityBtn = document.createElement("button");
    spriteQualityBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle";
    const spriteQualityChecked = typeof SpriteQuality !== "undefined" ? SpriteQuality.enabled : true;
    spriteQualityBtn.innerHTML =
      '<span class="settings-panel__option-main">' +
      '<i class="ph ph-image settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">' + I18N.t("settings_adaptive") + '</span>' +
      "</span>" +
      `<span class="settings-toggle" data-checked="${spriteQualityChecked}"><i class="ph ph-check settings-toggle__check"></i></span>`;
    spriteQualityBtn.addEventListener("click", () => {
      // Mientras el modo rendimiento esté activo la fuerza a activada (ver
      // perfmode.js) — bloqueada en ese sentido igual que Sombras/Niebla/
      // Vegetación lo están en el suyo (ver _syncPerfLock más abajo).
      if (typeof PerfMode !== "undefined" && PerfMode.enabled) return;
      SFX.click();
      const next = typeof SpriteQuality !== "undefined" ? !SpriteQuality.enabled : true;
      if (typeof SpriteQuality !== "undefined") SpriteQuality.setEnabled(next);
      spriteQualityBtn.querySelector(".settings-toggle").dataset.checked = String(next);
    });
    colVisual.appendChild(spriteQualityBtn);

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
      '<span class="p5-banner__label">' + I18N.t("settings_perf") + '</span>' +
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
        // Pedido explícito: "el modo rendimiento los desactiva
        // directamente" (vegetación/hierbajos) — mismo refresco visual
        // inmediato que ya hacían Sombras/Niebla justo arriba.
        vegetationBtn.querySelector(".settings-toggle").dataset.checked = "false";
        // Resolución adaptativa va al REVÉS que las tres de arriba: el modo
        // rendimiento la ENCIENDE (ver perfmode.js), así que aquí se refresca
        // a "true" en vez de a "false".
        spriteQualityBtn.querySelector(".settings-toggle").dataset.checked = "true";
      }
      // Segundo pedido explícito, encima del anterior: "cuando el modo
      // rendimiento esta activado, las sombras y la animacion de niebla
      // deben estar bloqueadas" — no basta con apagarlos una vez, hay que
      // impedir que el jugador los vuelva a encender A MANO mientras el
      // modo rendimiento siga activo (ver _syncPerfLock).
      this._syncPerfLock();
    });
    // Pedido explícito (pasada posterior): "coloca modo rendimiento en la
    // columna de la izquierda, para que ambas columnas tengas los mismos
    // botones" — antes esta columna (visual) tenía 5 filas frente a las 3
    // de la izquierda (audio/interfaz); moviendo Modo rendimiento a la
    // izquierda quedan 4 y 4. Solo cambia en qué <div> vive el botón, toda
    // su lógica (bloqueo de Sombras/Niebla/Vegetación/Resolución
    // adaptativa mientras esté activo) sigue intacta, esos otros botones
    // siguen en colVisual.
    colAudio.appendChild(perfModeBtn);
    this._shadowsBtn = shadowsBtn;
    this._fogAnimBtn = fogAnimBtn;
    this._vegetationBtn = vegetationBtn;
    this._spriteQualityBtn = spriteQualityBtn;
    this._syncPerfLock();

    // Selector de idioma (ES por defecto / EN), con su bandera.
    panel.appendChild(this._buildLanguageRow());

    // Pedido explícito: "debajo del todo el boton salir de la partida
    // centrado" — fuera de las dos columnas, como fila propia del panel
    // (que sigue siendo flex-column), con --centered para que no se
    // estire a todo el ancho como el resto de filas (ver esa clase en
    // style.css).
    const exitBtn = document.createElement("button");
    exitBtn.className = "p5-banner p5-banner--action settings-panel__option settings-panel__option--centered";
    exitBtn.innerHTML =
      '<i class="ph ph-door-open settings-panel__option-icon"></i>' +
      '<span class="p5-banner__label">' + I18N.t("settings_exit") + '</span>';
    exitBtn.addEventListener("click", () => {
      SFX.click();
      this.close();
      this._exitMatch();
    });
    panel.appendChild(exitBtn);
    this._exitBtn = exitBtn;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._overlay = overlay;
    this._panel = panel;
  },

  // Banderas en SVG (los emoji de bandera no se ven en Windows).
  _FLAGS: {
    es: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 4"><rect width="6" height="4" fill="#c60b1e"/><rect y="1" width="6" height="2" fill="#ffc400"/></svg>'),
    en: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><rect width="60" height="40" fill="#012169"/><path d="M0,0 60,40M60,0 0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 60,40M60,0 0,40" stroke="#c8102e" stroke-width="3"/><path d="M30,0V40M0,20H60" stroke="#fff" stroke-width="13"/><path d="M30,0V40M0,20H60" stroke="#c8102e" stroke-width="8"/></svg>'),
  },

  _buildSlider(label, value, onInput, onChange) {
    const row = document.createElement("div");
    row.className = "settings-slider";
    row.innerHTML =
      '<span class="settings-slider__label">' + label + '</span>' +
      '<input type="range" class="settings-slider__input" min="0" max="100" step="1">' +
      '<span class="settings-slider__value"></span>';
    const input = row.querySelector("input");
    const out = row.querySelector(".settings-slider__value");
    const paint = () => {
      out.textContent = input.value + "%";
      input.style.setProperty("--pct", input.value + "%");
    };
    input.value = Math.round(value * 100);
    paint();
    input.addEventListener("input", () => { paint(); onInput(input.value / 100); });
    if (onChange) input.addEventListener("change", onChange);
    return row;
  },

  _buildLanguageRow() {
    const row = document.createElement("div");
    row.className = "settings-lang";
    const label = document.createElement("div");
    label.className = "p5-banner__label settings-lang__label";
    label.textContent = I18N.t("settings_language");
    row.appendChild(label);
    const btns = document.createElement("div");
    btns.className = "settings-lang__btns";
    ["es", "en"].forEach((code) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "p5-banner p5-banner--action settings-lang__btn" + (I18N.currentLang === code ? " settings-lang__btn--active" : "");
      b.innerHTML = `<img class="settings-lang__flag" src="${this._FLAGS[code]}" alt="" draggable="false"><span class="p5-banner__label">${I18N.t("lang_" + code)}</span>`;
      b.addEventListener("click", () => {
        if (I18N.currentLang === code) return;
        if (typeof SFX !== "undefined") SFX.click();
        I18N.setLanguage(code);
      });
      btns.appendChild(b);
    });
    row.appendChild(btns);
    return row;
  },

  // El engranaje también vive en el menú: ahí no hay partida que abandonar.
  _inMatch() {
    const sb = document.getElementById("screen-board");
    return !!sb && sb.classList.contains("screen--active");
  },

  open() {
    this._ensurePopup();
    if (this._exitBtn) this._exitBtn.style.display = this._inMatch() ? "" : "none";
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
    if (!this._shadowsBtn || !this._fogAnimBtn || !this._vegetationBtn || !this._spriteQualityBtn) return;
    const locked = typeof PerfMode !== "undefined" && PerfMode.enabled;
    // Resolución adaptativa se bloquea igual que las otras tres mientras el
    // modo rendimiento esté activo (pintado como "deshabilitado", el jugador
    // no puede tocarla) — solo que a ella el modo rendimiento la deja
    // encendida en vez de apagada (ver perfmode.js/spriteQualityBtn).
    [this._shadowsBtn, this._fogAnimBtn, this._vegetationBtn, this._spriteQualityBtn].forEach((btn) => {
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

  // El engranaje se queda también en el menú (para cambiar el idioma).
  hideButton() {},

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

document.addEventListener("DOMContentLoaded", () => {
  SettingsMenu.init();
  SettingsMenu.showButton();
});
// Al cambiar de idioma se reconstruye el panel con los textos nuevos.
document.addEventListener("gg:langchange", () => {
  const wasOpen = SettingsMenu._overlay && SettingsMenu._overlay.classList.contains("settings-overlay--visible");
  if (SettingsMenu._overlay) SettingsMenu._overlay.remove();
  SettingsMenu._overlay = null;
  SettingsMenu._panel = null;
  SettingsMenu._ensurePopup();
  if (SettingsMenu._exitBtn) SettingsMenu._exitBtn.style.display = SettingsMenu._inMatch() ? "" : "none";
  if (wasOpen) SettingsMenu._overlay.classList.add("settings-overlay--visible");
});
