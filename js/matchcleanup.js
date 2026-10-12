/* Gnomore Gnomes — limpieza al salir de la partida (sin rastros).
   Regla de oro: un archivo por mecánica — este solo sabe "qué hay que apagar al dejar el
   tablero". Se llama desde showScreen() (js/newgame-flow.js) cada vez que se pasa de
   #screen-board a CUALQUIER otra pantalla: salir desde Ajustes, fin de partida, tutorial,
   online, atrás... Todas las rutas pasan por ahí, así que ninguna deja interfaz, sonidos ni
   música de la partida en el menú. Se ocupa de:
     - Cortar de golpe los sonidos de la partida (los programados a futuro incluidos) y
       silenciar los que aún lleguen de animaciones a medias; los del menú (clics...) siguen.
     - Devolver la música al volumen normal (se acabó el "ducking" de los tambores).
     - Abortar el turno de la IA / animaciones en curso (epoch).
     - Cerrar ventanas, avisos y botones de la partida y vaciar la cola de carteles.
     - Apagar el mando del tablero (cursor, ayudas) y los bucles de miedo.
   Al ENTRAR en una partida (showScreen("screen-board")) se vuelve a permitir el sonido de juego. */

const MATCH_UI_SOUNDS = ["hover", "click", "back", "captureVillage", "gnomeOuch", "buy"];

const MatchCleanup = {
  epoch: 0, // sube en cada salida: los bucles asíncronos de la partida comparan y se abortan
  gameMuted: false,

  init() {
    if (typeof SFX === "undefined" || this._wrapped) return;
    this._wrapped = true;
    // Los sonidos de interfaz (clic...) siempre suenan, aunque el de partida esté silenciado.
    MATCH_UI_SOUNDS.forEach((n) => {
      const f = SFX[n];
      if (typeof f !== "function") return;
      SFX[n] = function (...a) {
        SFX._ui = true;
        try { return f.apply(this, a); } finally { SFX._ui = false; }
      };
    });
    // Todo sonido pasa por ensureCtx(): si la partida ya terminó, no se crea ninguno de juego.
    const ensure = SFX.ensureCtx.bind(SFX);
    SFX.ensureCtx = function () {
      if (MatchCleanup.gameMuted && !SFX._ui) return null;
      return ensure();
    };
  },

  // Al empezar/reanudar una partida o el tutorial.
  enter() {
    this.gameMuted = false;
  },

  // Al salir del tablero hacia cualquier otra pantalla.
  leave() {
    this.epoch++;
    this.gameMuted = true;
    const safe = (fn) => { try { fn(); } catch (e) { console.warn("MatchCleanup:", e); } };
    // ---- Sonido y música ----
    safe(() => {
      if (typeof SFX === "undefined" || !SFX.ctx || !SFX.master || !SFX._comp) return;
      // Master nuevo: todo lo que sonaba o estaba programado cuelga del viejo, ya desconectado.
      const nm = SFX.ctx.createGain();
      nm.gain.value = SFX.master.gain.value;
      SFX.master.disconnect();
      nm.connect(SFX._comp);
      SFX.master = nm;
      Object.values(SFX.voices || {}).forEach((v) => safe(() => { v.gain.disconnect(); v.gain.connect(nm); }));
      SFX._themeUntil = 0;
      SFX._drumVoice = null;
    });
    safe(() => {
      if (typeof Music === "undefined") return;
      if (Music._duckTimer) clearTimeout(Music._duckTimer);
      Music._duckTimer = null;
      Music._duckGoal = 1;
      Music._startLoop && Music._startLoop();
    });
    // ---- Turnos / IA ----
    safe(() => {
      if (typeof Turns === "undefined") return;
      if (Turns._readyChimeTimer) { clearInterval(Turns._readyChimeTimer); Turns._readyChimeTimer = null; }
      Turns._aiRunning = false;
      Turns.hideButton();
    });
    // ---- Carteles ----
    safe(() => { if (typeof Banners !== "undefined") Banners.clear(); });
    document.querySelectorAll(".turn-banner").forEach((e) => e.remove());
    // ---- Ventanas de la partida ----
    safe(() => typeof Backpack !== "undefined" && Backpack._overlayEl && Backpack.closePopup());
    safe(() => typeof Obelisks !== "undefined" && Obelisks.closeRecruitPopup && Obelisks.closeRecruitPopup());
    safe(() => typeof Obelisks !== "undefined" && Obelisks.closeAbilitiesPopup && Obelisks.closeAbilitiesPopup());
    safe(() => typeof Shops !== "undefined" && Shops.closePopup && Shops.closePopup());
    safe(() => typeof Oracle !== "undefined" && Oracle.closePopup && Oracle._overlay && Oracle.closePopup(true));
    safe(() => typeof UnitInfo !== "undefined" && UnitInfo.onDeselect && UnitInfo.onDeselect());
    safe(() => typeof Glory !== "undefined" && Glory.closePopup && Glory.closePopup());
    safe(() => typeof Armory !== "undefined" && Armory.closePopup && Armory.closePopup());
    safe(() => typeof SettingsMenu !== "undefined" && SettingsMenu.close && SettingsMenu.close());
    // Lo que quede de ventanas / efectos sueltos en el <body> (sin esperar a sus fundidos).
    [
      ".backpack-overlay", ".unit-info-overlay", ".obelisk-gameover-overlay", ".glory-popup-overlay",
      ".mp-overlay--confirm", ".gp-actions", ".gp-kb",
      ".oracle-overlay", "#or-flash", "#or-vign", ".or-toast", ".or-fly", ".or-ring", ".shop-restock-msg",
      ".plague-alert", ".torreta-arrow", ".rock-projectile__sprite", ".katapum-projectile__sprite",
      ".glory-lost",
    ].forEach((sel) => document.body.querySelectorAll(sel).forEach((e) => e.remove()));
    // ---- Botones y marcadores de la partida ----
    safe(() => typeof Glory !== "undefined" && Glory.hideHud());
    safe(() => typeof Backpack !== "undefined" && Backpack.hideButton());
    safe(() => typeof Abilities !== "undefined" && Abilities._hideButton && Abilities._hideButton());
    safe(() => typeof Gnome !== "undefined" && Gnome._hideHoldingActions && Gnome._hideHoldingActions());
    safe(() => typeof Gnome !== "undefined" && Gnome.hideAllBadges && Gnome.hideAllBadges());
    safe(() => typeof UIHint !== "undefined" && UIHint.hide && UIHint.hide());
    safe(() => typeof Tooltip !== "undefined" && Tooltip.hide && Tooltip.hide());
    document.body.classList.remove("drums-raining", "tut-on");
    // ---- Mando: sin cursor ni ayudas del tablero ----
    safe(() => {
      if (typeof GamepadCtl === "undefined") return;
      GamepadCtl._closeActions && GamepadCtl._closeActions();
      GamepadCtl._closeKeyboard && GamepadCtl._closeKeyboard();
      GamepadCtl._obIdx = -1;
      GamepadCtl._lastBarKey = "";
    });
    // ---- Bucles de miedo y selección ----
    safe(() => {
      if (typeof Units === "undefined") return;
      (Units.list || []).forEach((u) => Units.stopFearLoop && Units.stopFearLoop(u));
      Units.deselect && Units.deselect();
    });
  },
};

document.addEventListener("DOMContentLoaded", () => MatchCleanup.init());
