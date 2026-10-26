/* Gnomore Gnomes — navegación "atrás" en móvil.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Convertir las señales de "volver" del móvil en UNA acción: el botón/gesto atrás de Android
       (que el WebView avisa como retroceso del historial) y el deslizamiento desde el borde
       izquierdo hacia el centro (para móviles con botones de navegación o sin gesto del sistema).
     - Decidir qué cierra esa acción: ventanas abiertas > menús (Volver) > selección/objetivos del
       tablero > Ajustes (pausa). Para ello reutiliza la MISMA lógica de "atrás" del mando
       (js/gamepad.js: GamepadCtl._uiAction("back") / _cancel()), así que móvil, mando y teclado se comportan igual.
     - Menú principal: "pulsa atrás otra vez para salir" (el segundo atrás sale de la app).
   Truco del historial (el estándar para WebViews sin plugin nativo): se deja una entrada "centinela" delante;
   al volver atrás el navegador dispara popstate, se atiende la acción y se vuelve a colocar el centinela.
   Funciona por actualización OTA (solo JS), sin recompilar la APK. */

const BackNav = {
  EDGE_PX: 22, // franja del borde izquierdo donde puede empezar el deslizamiento
  TRIGGER_PX: 70, // recorrido horizontal para que cuente como "atrás"
  QUIT_WINDOW_MS: 2200,
  _quitTimer: null,
  _sw: null,
  _hint: null,

  init() {
    if (this._ready) return;
    this._ready = true;
    this._armSentinel(true);
    window.addEventListener("popstate", () => this._onPop());
    this._bindEdgeSwipe();
  },

  // ---------- Historial centinela ----------
  _armSentinel(first) {
    try {
      if (first) history.replaceState({ gg: 0 }, "");
      history.pushState({ gg: 1 }, "");
    } catch (e) {}
  },
  _onPop() {
    // El jugador ha pulsado atrás (botón, gesto del sistema...): estamos en la entrada 0.
    if (this.back()) {
      this._armSentinel(false);
      return;
    }
    // Menú principal sin nada que cerrar: primer atrás = aviso; el segundo (si llega a tiempo) sale de la app
    // porque ya no hay historial al que volver. Pasado el plazo se vuelve a colocar el centinela.
    this._toast("Pulsa atrás otra vez para salir");
    clearTimeout(this._quitTimer);
    this._quitTimer = setTimeout(() => {
      try {
        if (!history.state || history.state.gg === 0) history.pushState({ gg: 1 }, "");
      } catch (e) {}
    }, this.QUIT_WINDOW_MS);
  },

  // ---------- Qué hace "atrás" ----------
  // true = se ha atendido (cerró algo o abrió la pausa); false = nada que hacer (menú principal).
  back() {
    if (typeof GamepadCtl === "undefined" || !GamepadCtl._mode) return false;
    try {
      GamepadCtl._invalidateMode();
      const mode = GamepadCtl._mode(performance.now());
      if (mode.type === "ui") {
        if (mode.menu && mode.root && mode.root.id === "main-menu") return false;
        GamepadCtl._uiAction("back", mode, true);
        return true;
      }
      // Tablero: primero lo que esté a medias (selección, objetivos, menú del Obelisco...) y, si no hay nada, la pausa.
      if (this._boardBusy()) {
        GamepadCtl._cancel();
      } else if (typeof SettingsMenu !== "undefined" && SettingsMenu.open) {
        SettingsMenu.open();
      }
      if (typeof SFX !== "undefined" && SFX.back) SFX.back();
      return true;
    } catch (e) {
      return false;
    }
  },
  _boardBusy() {
    try {
      if (typeof Units !== "undefined" && Units.selectedId) return true;
      if (typeof Obelisks !== "undefined" && Obelisks._selectedId) return true;
      if (document.querySelector(".board-marker, .gnome-action-btn--visible, .ability-btn--visible")) return true;
    } catch (e) {}
    return false;
  },

  // ---------- Deslizamiento desde el borde izquierdo ----------
  _bindEdgeSwipe() {
    const opt = { passive: true, capture: true };
    document.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) { this._endSwipe(); return; }
      const t = e.touches[0];
      this._sw = t.clientX <= this.EDGE_PX ? { x: t.clientX, y: t.clientY, done: false } : null;
    }, opt);
    document.addEventListener("touchmove", (e) => {
      const s = this._sw;
      if (!s || s.done || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx)) { this._endSwipe(); return; } // es un arrastre vertical
      if (dx > 8) this._showHint(Math.min(1, dx / this.TRIGGER_PX), t.clientY);
      if (dx >= this.TRIGGER_PX) {
        s.done = true;
        this._hideHint(true);
        if (!this.back()) this._toast("Ya estás en el menú principal");
      }
    }, opt);
    const end = () => this._endSwipe();
    document.addEventListener("touchend", end, opt);
    document.addEventListener("touchcancel", end, opt);
  },
  _endSwipe() {
    if (this._sw && !this._sw.done) this._hideHint(false);
    this._sw = null;
  },

  // Indicador del gesto: pestaña oscura con flecha amarilla que asoma del borde según se desliza (sin brillos).
  _showHint(k, y) {
    if (!this._hint) {
      const el = document.createElement("div");
      el.className = "backnav-hint";
      el.innerHTML = '<i class="ph-bold ph-arrow-left"></i>';
      document.body.appendChild(el);
      this._hint = el;
    }
    const el = this._hint;
    el.classList.remove("backnav-hint--go", "backnav-hint--out");
    el.style.top = `${Math.round(y)}px`;
    el.style.transform = `translate(${Math.round(-44 + 56 * k)}px, -50%)`;
    el.style.opacity = String(0.35 + 0.65 * k);
  },
  _hideHint(go) {
    const el = this._hint;
    if (!el) return;
    el.classList.add("backnav-hint--out");
    if (go) el.classList.add("backnav-hint--go");
    el.style.opacity = "0";
    el.style.transform = `translate(${go ? 28 : -44}px, -50%)`;
  },

  _toast(text) {
    const t = typeof I18N !== "undefined" && I18N.tr ? I18N.tr(text) : text;
    if (typeof GamepadCtl !== "undefined" && GamepadCtl._toast) GamepadCtl._toast(t, "ph-fill ph-arrow-u-up-left");
  },
};

BackNav.init();
