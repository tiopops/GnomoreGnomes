/* Gnomore Gnomes — mando (Gamepad), referencia: mando Xbox de PC.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Leer el mando (Gamepad API), con zonas muertas y repetición al mantener.
     - Navegar los menús/ventanas con el mando (foco espacial con la cruceta o el
       stick izquierdo; A acepta, B vuelve, LB/RB cambian de pestaña).
     - Jugar en el tablero: cursor de loseta (cruceta/stick), A = clic en esa
       loseta (seleccionar, mover, atacar, capturar...), B = cancelar, X = menú
       de acciones, Y = fin de turno, LB/RB = unidad anterior/siguiente,
       LT/RT = zoom, stick derecho = cámara, L3 = centrar, R3 = ir al Obelisco,
       View = gloria, Menú = ajustes.
     - Mostrar ayudas (botón del mando junto a cada botón y barra inferior) y
       la pestaña "Mando" de Ajustes (probador + reasignar botones).
   Todo se traduce a clics/eventos de ratón normales sobre los mismos elementos,
   así que ninguna otra mecánica necesita saber que existe el mando. */

const GP_STORE_MAP = "gg_pad_map_v1";
const GP_STORE_HINTS = "gg_pad_hints_v1";

// Botones del mando estándar (Gamepad API, "standard mapping" = Xbox).
const GP_BTN = {
  0: { n: "A", kind: "face", color: "#3fa34d" },
  1: { n: "B", kind: "face", color: "#d23b3b" },
  2: { n: "X", kind: "face", color: "#2f7fd6" },
  3: { n: "Y", kind: "face", color: "#f0b429" },
  4: { n: "LB", kind: "bumper" },
  5: { n: "RB", kind: "bumper" },
  6: { n: "LT", kind: "trigger" },
  7: { n: "RT", kind: "trigger" },
  8: { n: "View", kind: "icon", icon: "ph-bold ph-copy" },
  9: { n: "Menú", kind: "icon", icon: "ph-bold ph-list" },
  10: { n: "L3", kind: "stick" },
  11: { n: "R3", kind: "stick" },
  12: { n: "↑", kind: "dpad" },
  13: { n: "↓", kind: "dpad" },
  14: { n: "←", kind: "dpad" },
  15: { n: "→", kind: "dpad" },
};

// Acciones reasignables. `board`/`ui` indican dónde se usan (para las ayudas).
const GP_ACTIONS = [
  { id: "confirm", label: "Aceptar", def: 0 },
  { id: "back", label: "Atrás", def: 1 },
  { id: "backpack", label: "Mochila", def: 2 },
  { id: "actions", label: "Acciones", def: 10 },
  { id: "endTurn", label: "Fin de turno", def: 3 },
  { id: "prevUnit", label: "Anterior", def: 4 },
  { id: "nextUnit", label: "Siguiente", def: 5 },
  { id: "zoomOut", label: "Alejar cámara", def: 6 },
  { id: "zoomIn", label: "Acercar cámara", def: 7 },
  { id: "toObelisk", label: "Mi base (otra vez: centrar)", def: 11 },
  { id: "glory", label: "Gloria", def: 8 },
  { id: "settings", label: "Ajustes", def: 9 },
];

// Ventanas que, si están abiertas, reciben el mando (la de mayor z-index manda).
const GP_LAYERS = [
  ".gp-kb",
  ".gp-actions",
  ".mp-invite--visible",
  ".mp-overlay--visible",
  ".obelisk-gameover-overlay--visible",
  ".settings-overlay--visible",
  ".glory-popup-overlay--visible",
  ".unit-info-overlay--visible",
  ".backpack-overlay--visible",
];

// Qué es "pulsable" aunque no sea un <button>.
const GP_CLICKABLE =
  'button:not([disabled]), [role="button"], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], .menu-btn, [data-act], [tabindex]:not([tabindex="-1"])';

// Acciones que aparecen en el menú de acciones (X) si su botón está en pantalla.
const GP_ACTION_BUTTONS = [
  { sel: ".ability-btn", icon: "ph-fill ph-lightning", label: (el) => (el.getAttribute("aria-label") || "Habilidad").replace(/^Usar habilidad: /, "") },
  { sel: ".gnome-action-btn--hit", icon: "ph-fill ph-hand-fist", label: () => "Golpear gnomo" },
  { sel: ".gnome-action-btn--pass", icon: "ph-fill ph-paper-plane-tilt", label: () => "Pasar gnomo" },
  { sel: ".obelisk__menu-btn", icon: "ph-fill ph-castle-turret", label: (el) => el.getAttribute("aria-label") || "Obelisco" },
  { sel: "#unit-info-btn", icon: "ph-fill ph-info", label: () => "Información de la unidad" },
  { sel: ".backpack-btn", icon: "ph-fill ph-backpack", label: () => "Mochila" },
];

// Ayudas pegadas a botones concretos: [selector, acción, dónde se ve]
const GP_BADGES = [
  [".end-turn-btn--visible", "endTurn", "board"],
  [".settings-gear-btn:not(.settings-gear-btn--account)", "settings", "board"],
  [".glory-hud--player", "glory", "board"],
  [".tut-btn", "confirm", "board"],
  [".backpack-close-btn", "back", "ui"],
  [".back-btn", "back", "ui"],
];

const GamepadCtl = {
  map: {},
  hints: true,
  connected: false,
  padName: "",
  active: false, // el último que se ha usado es el mando (no el ratón)
  _prev: {},
  _rep: { key: "", next: 0 },
  _focusEl: null,
  _listening: null,
  _last: 0,
  _raf: null,
  _modeCache: null,
  _modeAt: 0,
  _tile: null, // {row, col}
  _cursorEl: null,
  _ringEl: null,
  _barEl: null,
  _badgeEls: [],
  _toastEl: null,
  _pane: null,
  _lastBarKey: "",

  // ---------- Arranque ----------
  init() {
    this._loadPrefs();
    this._ensureVisuals();
    window.addEventListener("gamepadconnected", (e) => this._onConnect(e.gamepad));
    window.addEventListener("gamepaddisconnected", () => this._onDisconnect());
    const pointerOff = (e) => { if (e.isTrusted) this._setActive(false); };
    window.addEventListener("mousemove", pointerOff, { passive: true });
    window.addEventListener("pointerdown", pointerOff, { passive: true });
    window.addEventListener("touchstart", pointerOff, { passive: true });
    window.addEventListener("keydown", (e) => { if (e.isTrusted && this._listening && e.key === "Escape") this._stopListening(); });
    document.addEventListener("gg:langchange", () => this._refreshPane());
    // Si el navegador ya expone un mando (recargar con él conectado).
    if (this._getPad()) this._onConnect(this._getPad());
    // Respaldo: algunos navegadores no lanzan "gamepadconnected" (o lo lanzan
    // antes de cargar el juego); se consulta periódicamente hasta ver un mando.
    setInterval(() => {
      if (this.connected || document.hidden) return;
      const p = this._getPad();
      if (p) this._onConnect(p);
    }, 500);
  },

  _loadPrefs() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(GP_STORE_MAP) || "{}") || {}; } catch (e) {}
    this.map = {};
    // Migración: X pasa a ser la Mochila y las Acciones a L3 (antes X = Acciones, L3 = centrar): se
    // descartan solo las asignaciones viejas de esos tres botones para que tomen los nuevos valores.
    if (saved && saved.backpack === undefined && Object.keys(saved).length) { delete saved.actions; delete saved.center; delete saved.toObelisk; }
    GP_ACTIONS.forEach((a) => { this.map[a.id] = Number.isInteger(saved[a.id]) ? saved[a.id] : a.def; });
    try { this.hints = localStorage.getItem(GP_STORE_HINTS) !== "false"; } catch (e) { this.hints = true; }
  },
  _savePrefs() {
    try { localStorage.setItem(GP_STORE_MAP, JSON.stringify(this.map)); } catch (e) {}
  },
  setHints(v) {
    this.hints = !!v;
    try { localStorage.setItem(GP_STORE_HINTS, String(this.hints)); } catch (e) {}
    this._lastBarKey = "";
    this._updateHints(true);
  },
  resetMap() {
    GP_ACTIONS.forEach((a) => { this.map[a.id] = a.def; });
    this._savePrefs();
    this._refreshPane();
  },

  // ---------- Conexión ----------
  _getPad() {
    const list = (navigator.getGamepads && navigator.getGamepads()) || [];
    // Con varios dispositivos HID (barra de sonido, ratón gamer...) se elige el
    // que parece un mando: mapeo estándar primero, luego el que tenga ejes.
    let best = null, bestScore = -1;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p || !p.connected) continue;
      const score = (p.mapping === "standard" ? 100 : 0) + ((p.axes && p.axes.length >= 2) || (p.buttons && p.buttons.length >= 10) ? 10 : 0) + (p.buttons && p.buttons.length >= 8 ? 1 : 0);
      if (score < 10) continue; // sin ejes ni mapeo estándar: no es un mando (barra de sonido, etc.)
      if (score > bestScore) { best = p; bestScore = score; }
    }
    return best ? this._normalize(best) : null;
  },
  // Mandos que el navegador NO expone con la disposición estándar (p. ej. un
  // Xbox 360 USB con driver genérico/DirectInput): se traducen a la estándar.
  _normalize(pad) {
    if (!pad || pad.mapping === "standard") return pad;
    const B = (i) => pad.buttons[i] || { pressed: false, value: 0 };
    const mk = (on) => ({ pressed: !!on, value: on ? 1 : 0 });
    const ax = (i) => (pad.axes && pad.axes.length > i ? pad.axes[i] : 0);
    const out = [];
    for (let i = 0; i < 16; i++) out[i] = mk(false);
    [0, 1, 2, 3, 4, 5].forEach((i) => (out[i] = B(i)));
    out[8] = B(6); out[9] = B(7); out[10] = B(8); out[11] = B(9);
    // Gatillos: eje 2 combinado (LT +, RT -) o botones 6/7 si el driver los da sueltos.
    if (pad.buttons.length >= 8 && pad.axes.length < 6) { out[6] = B(6); out[7] = B(7); out[8] = B(8); out[9] = B(9); out[10] = B(10); out[11] = B(11); }
    else { out[6] = mk(ax(2) > 0.5); out[7] = mk(ax(2) < -0.5); }
    // Cruceta: botones 12-15 si existen; si no, el "hat" (eje 9).
    if (pad.buttons.length >= 16) { for (let i = 12; i < 16; i++) out[i] = B(i); }
    else if (pad.axes.length >= 10) {
      const h = pad.axes[9];
      const up = h === -1 || Math.abs(h + 0.714) < 0.1 || Math.abs(h - 1) < 0.1;
      const right = Math.abs(h + 0.714) < 0.1 || Math.abs(h + 0.428) < 0.1 || Math.abs(h + 0.143) < 0.1;
      const down = Math.abs(h + 0.143) < 0.1 || Math.abs(h - 0.143) < 0.1 || Math.abs(h - 0.428) < 0.1;
      const left = Math.abs(h - 0.428) < 0.1 || Math.abs(h - 0.714) < 0.1 || Math.abs(h - 1) < 0.1;
      out[12] = mk(up); out[13] = mk(down); out[14] = mk(left); out[15] = mk(right);
    }
    const rx = pad.axes.length >= 5 && Math.abs(ax(2)) <= 1 && pad.axes.length < 6 ? ax(3) : ax(2);
    const ry = pad.axes.length >= 5 && pad.axes.length < 6 ? ax(4) : ax(3);
    return { id: pad.id, connected: pad.connected, buttons: out, axes: [ax(0), ax(1), rx, ry] };
  },
  _onConnect(pad) {
    if (this.connected) return;
    this.connected = true;
    this.padName = (pad && pad.id ? pad.id : "Mando").replace(/\s*\(.*$/, "");
    this._prev = {};
    this._last = performance.now();
    this._toast("Mando conectado", "ph-fill ph-game-controller");
    this._refreshPane();
    if (typeof SettingsMenu !== "undefined" && SettingsMenu.syncAccountTab) SettingsMenu.syncAccountTab();
    if (!this._raf) this._raf = requestAnimationFrame((t) => this._loop(t));
  },
  _onDisconnect() {
    if (this._getPad()) return;
    this.connected = false;
    this._setActive(false);
    this._toast("Mando desconectado", "ph-fill ph-game-controller");
    this._refreshPane();
    if (typeof SettingsMenu !== "undefined" && SettingsMenu.syncAccountTab) SettingsMenu.syncAccountTab();
    this._updateHints(true);
  },
  _setActive(v) {
    if (this.active === v) return;
    this.active = v;
    // Con el mando: se oculta el puntero del ratón; al mover el ratón vuelve y
    // desaparece toda la interfaz del mando (anillo, cursor, ayudas).
    document.body.classList.toggle("gp-active", !!v);
    if (!v) {
      this._ringEl && this._ringEl.classList.remove("gp-focus--on");
      this._markFocus(null);
      this._cursorEl && this._cursorEl.classList.remove("gp-tile--on");
      this._barEl && this._barEl.classList.remove("gp-hints--on");
      this._badgeEls.forEach((b) => (b.style.display = "none"));
    }
    if (typeof SettingsMenu !== "undefined" && SettingsMenu.syncAccountTab) SettingsMenu.syncAccountTab();
  },

  // ---------- Bucle ----------
  _loop(now) {
    this._raf = null;
    const pad = this._getPad();
    if (!pad) {
      if (this.connected) this._onDisconnect();
      return;
    }
    this._raf = requestAnimationFrame((t) => this._loop(t));
    const dt = Math.min(0.05, Math.max(0.001, (now - this._last) / 1000));
    this._last = now;
    this.tickPad(pad, dt, now);
  },

  _axis(pad, i) { return pad.axes && pad.axes.length > i ? pad.axes[i] : 0; },
  _stick(pad, ix, iy) {
    let x = this._axis(pad, ix);
    let y = this._axis(pad, iy);
    const m = Math.hypot(x, y);
    const DZ = 0.28;
    if (m < DZ) return { x: 0, y: 0, m: 0 };
    const k = (Math.min(1, m) - DZ) / (1 - DZ) / m;
    return { x: x * k, y: y * k, m: Math.min(1, m) };
  },

  tickPad(pad, dt, now) {
    if (document.hidden) return;
    const loading = document.querySelector(".match-loading-overlay--visible");
    const down = {};
    for (let i = 0; i < 16; i++) {
      const b = pad.buttons[i];
      down[i] = !!b && (b.pressed || b.value > 0.55);
    }
    // Probador (pestaña Mando): solo funciona con el botón TEST activado.
    if (this._test) {
      this._paintTester(down, pad);
      if (down[8] && down[9]) this._setTest(false);
      this._prev = down;
      this._rep.key = "";
      this._ringEl && this._ringEl.classList.remove("gp-focus--on");
      this._markFocus(null);
      this._cursorEl && this._cursorEl.classList.remove("gp-tile--on");
      this._barEl && this._barEl.classList.remove("gp-hints--on");
      this._badgeEls.forEach((b) => (b.style.display = "none"));
      return;
    }
    const ls = this._stick(pad, 0, 1);
    const rs = this._stick(pad, 2, 3);
    // ¿Hay actividad? -> el mando pasa a ser el "activo".
    let any = ls.m > 0.5 || rs.m > 0.5;
    for (let i = 0; i < 16; i++) if (down[i] && !this._prev[i]) any = true;
    if (any) this._setActive(true);

    // Pulsaciones (flancos).
    for (let i = 0; i < 16; i++) {
      if (down[i] && !this._prev[i]) this._onPress(i, now);
      else if (!down[i] && this._prev[i]) this._onRelease(i);
    }
    this._prev = down;
    if (loading || this._listening) { this._rep.key = ""; return; }

    // Dirección (cruceta con prioridad, si no el stick izquierdo en 8 sentidos).
    let dx = (down[15] ? 1 : 0) - (down[14] ? 1 : 0);
    let dy = (down[13] ? 1 : 0) - (down[12] ? 1 : 0);
    let fromStick = false;
    let ang; // ángulo REAL del stick (sin cuantizar): el tablero lo usa para elegir la loseta más cercana en ángulo
    if (!dx && !dy && ls.m > 0.55) {
      const a = Math.atan2(ls.y, ls.x);
      const s = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
      dx = Math.round(Math.cos(s));
      dy = Math.round(Math.sin(s));
      fromStick = true;
      ang = a;
    }
    // La repetición se reinicia al cambiar de dirección de verdad (sectores de 30° en el stick).
    const key = fromStick ? "s" + Math.round(ang / (Math.PI / 6)) : dx + "," + dy;
    // Cruceta en el tablero: una cruceta física no tiene botón diagonal, hay que pulsar dos a la vez y
    // nadie los pulsa en el mismo milisegundo. Ventana de acorde de 80 ms (como el "perdón" de
    // diagonales de los juegos de lucha): al pulsar un solo botón se espera un instante por si llega
    // el segundo; si llega, se hace UN movimiento diagonal (no dos rectos). Y al soltar solo uno de los
    // dos botones de una diagonal no se hace el movimiento recto sobrante.
    const single = !fromStick && (dx ? !dy : !!dy);
    const wasDiag = !!this._rep.key && /^-?1,-?1$/.test(this._rep.key);
    let hold = false;
    if (single && this._rep.key !== key && this._mode(now).type === "board") {
      if (!this._chord || this._chord.k !== key) this._chord = { k: key, t: now + 80 };
      if (!wasDiag && now < this._chord.t) hold = true;
    } else if (!single && (dx || dy)) this._chord = null;
    if (!dx && !dy) {
      // Toque más corto que la ventana: se suelta antes de que se decida -> el movimiento se hace igualmente.
      const pend = this._chord && !this._chord.fired ? this._chord.k.split(",").map(Number) : null;
      this._rep.key = "";
      this._chord = null;
      if (pend) this._dir(pend[0], pend[1]);
    } else if (hold) {
      // esperando por si llega el segundo botón de la diagonal
    } else if (key !== this._rep.key) {
      const swallow = single && wasDiag; // soltaste un botón de la diagonal: no cuenta como pulsación nueva
      this._rep.key = key;
      this._rep.next = now + (fromStick ? 280 : 380);
      if (this._chord) this._chord.fired = true;
      if (!swallow) this._dir(dx, dy, ang);
    } else if (now >= this._rep.next) {
      this._rep.next = now + (fromStick ? 175 - 65 * ls.m : 120); // más inclinado = más rápido
      this._dir(dx, dy, ang);
    }

    // Analógico: cámara (stick derecho), zoom (gatillos) y scroll en ventanas.
    const mode = this._mode(now);
    if (mode.type === "board") {
      if (this.active) this._obMenu();
      if (rs.m > 0) {
        const dist = (typeof BoardView !== "undefined" ? BoardView.KEY_PAN_SPEED : 700) * dt * 1.15;
        BoardView._panBy(-rs.x * dist, -rs.y * dist);
      }
      const zi = this._analog(pad, "zoomIn");
      const zo = this._analog(pad, "zoomOut");
      if ((zi > 0.08 || zo > 0.08) && typeof BoardView !== "undefined" && BoardView.viewportEl) {
        const r = BoardView.viewportEl.getBoundingClientRect();
        const f = 1 + (zi - zo) * 1.6 * dt;
        BoardView._zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
      }
    } else if (rs.m > 0 && mode.root) {
      const sc = this._scrollParent(this._focusEl && this._focusEl.isConnected ? this._focusEl : mode.root, mode.root);
      if (sc) sc.scrollTop += rs.y * 900 * dt;
    }
    this._frame(now, mode);
  },

  _analog(pad, action) {
    const i = this.map[action];
    const b = pad.buttons[i];
    if (!b) return 0;
    if (b.value > 0) return b.value;
    return b.pressed ? 1 : 0;
  },

  // ---------- Contexto: ¿menú/ventana o tablero? ----------
  _isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  },
  _z(el) {
    const z = parseInt(getComputedStyle(el).zIndex, 10);
    return Number.isFinite(z) ? z : 0;
  },
  _mode(now) {
    if (this._modeCache && now - this._modeAt < 90) return this._modeCache;
    let best = null;
    let bestZ = -1;
    GP_LAYERS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (!this._isVisible(el)) return;
        const z = this._z(el) + (sel === ".gp-actions" ? 100000 : sel === ".gp-kb" ? 200000 : 0);
        if (z >= bestZ) { best = el; bestZ = z; }
      });
    });
    let mode;
    if (best) {
      mode = { type: "ui", root: best, layer: best };
    } else {
      const screen = document.querySelector(".screen--active");
      if (screen && screen.id !== "screen-board") mode = { type: "ui", root: screen, layer: screen, menu: true };
      else mode = { type: "board", root: null };
    }
    if (!this._modeCache || this._modeCache.root !== mode.root) { this._focusEl = null; this._focusMem = null; }
    this._modeCache = mode;
    this._modeAt = now;
    return mode;
  },
  _invalidateMode() { this._modeAt = 0; },

  // ---------- Pulsaciones ----------
  _actionsFor(i) {
    const out = [];
    GP_ACTIONS.forEach((a) => { if (this.map[a.id] === i) out.push(a.id); });
    return out;
  },
  _onPress(i, now) {
    if (this._listening) {
      if (i >= 12 && i <= 15) return; // la cruceta no se reasigna
      this._assign(this._listening.action, i);
      return;
    }
    if (document.querySelector(".match-loading-overlay--visible")) return;
    this._invalidateMode();
    const mode = this._mode(now);
    this._actionsFor(i).forEach((act) => {
      if (mode.type === "ui") this._uiAction(act, mode, true);
      else this._boardAction(act, true);
    });
  },
  _onRelease(i) {
    if (this._listening) return;
    this._actionsFor(i).forEach((act) => {
      if (act === "confirm" && this._pendingClick) this._finishClick();
    });
  },

  // ---------- Eventos de ratón sintéticos ----------
  _mouse(type, el, x, y, extra) {
    const Ev = type.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
    const e = new Ev(type, Object.assign({ bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, buttons: type.endsWith("down") ? 1 : 0, pointerType: "mouse", isPrimary: true }, extra || {}));
    el.dispatchEvent(e);
  },
  _beginClick(el, x, y) {
    this._pendingClick = { el, x, y };
    this._mouse("pointerdown", el, x, y);
    this._mouse("mousedown", el, x, y);
  },
  _finishClick() {
    const p = this._pendingClick;
    this._pendingClick = null;
    if (!p || !p.el.isConnected) return;
    if (this._isHoldBtn(p.el)) return; // la visión de la unidad se queda abierta; se cierra con B
    this._mouse("pointerup", p.el, p.x, p.y);
    this._mouse("mouseup", p.el, p.x, p.y);
    this._mouse("click", p.el, p.x, p.y);
  },
  // Botones "mantener pulsado" del ratón: con mando se abren con A y se cierran con B.
  _isHoldBtn(el) { return !!el && (el.id === "unit-info-btn" || (el.closest && !!el.closest("#unit-info-btn"))); },
  _clickNow(el) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (this._isHoldBtn(el)) {
      this._mouse("pointerdown", el, x, y);
      this._mouse("mousedown", el, x, y);
      return;
    }
    this._mouse("pointerdown", el, x, y);
    this._mouse("mousedown", el, x, y);
    this._mouse("pointerup", el, x, y);
    this._mouse("mouseup", el, x, y);
    this._mouse("click", el, x, y);
  },

  // ---------- Menús y ventanas ----------
  _uiAction(act, mode, press) {
    if (mode.root && mode.root.classList.contains("gp-kb")) {
      if (act === "back") this._kbClose(false);
      else if (act === "backpack") this._kbType(" ");
      else if (act === "endTurn") this._kbBackspace();
      else if (act === "prevUnit") this._kbCaret(-1);
      else if (act === "nextUnit") this._kbCaret(1);
      else if (act === "settings") this._kbClose(true);
      else if (act === "confirm") {
        const el = this._ensureFocus(mode);
        if (el) this._clickNow(el);
      }
      return;
    }
    // Ventanas de elegir-y-comprar (Reclutar, tiendas, Habilidades, Armería): resaltar un elemento
    // ya lo selecciona (se ve su descripción), LB/RB los recorren (si no hay pestañas) y A sobre el
    // elegido compra/recluta/mejora directamente.
    if (mode.root && mode.root.querySelector && (act === "prevUnit" || act === "nextUnit" || act === "confirm")) {
      const root = mode.root;
      const p = this._picker(root);
      if (p) {
        if (act !== "confirm") {
          if (this._tabsIn(root).length < 2 && p.items.length > 1) {
            let i = p.items.findIndex((e) => /selected/.test(e.className));
            if (i < 0) i = 0;
            const n = (i + (act === "nextUnit" ? 1 : -1) + p.items.length) % p.items.length;
            this._pickItem(root, p.items, n);
            return;
          }
        } else {
          const f = this._focusEl;
          const ix = f ? p.items.indexOf(f) : -1;
          if (ix >= 0 || !f || f === p.buy) {
            const it = ix >= 0 ? p.items[ix] : p.items.find((e) => /selected/.test(e.className));
            if (it && !/selected/.test(it.className)) { this._pickItem(root, p.items, p.items.indexOf(it)); return; }
            if (p.buy.disabled) { if (typeof SFX !== "undefined" && SFX.error) { try { SFX.error(); } catch (e) {} } return; }
            this._clickNow(p.buy);
            return;
          }
        }
      }
    }
    if (act === "confirm") {
      const el = this._ensureFocus(mode);
      if (!el) return;
      if (el.matches && el.matches('input:not([type]), input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="number"], textarea')) { this._openKeyboard(el); return; }
      if (el.matches && el.matches('input[type="range"]')) return;
      const r = el.getBoundingClientRect();
      this._beginClick(el, r.left + r.width / 2, r.top + r.height / 2);
    } else if (act === "back") {
      this._uiBack(mode);
    } else if (act === "prevUnit") {
      this._uiTab(mode, -1);
    } else if (act === "nextUnit") {
      this._uiTab(mode, 1);
    } else if (act === "settings") {
      if (mode.layer && mode.layer.classList.contains("settings-overlay--visible")) this._uiBack(mode);
      else if (mode.menu && typeof SettingsMenu !== "undefined") SettingsMenu.open();
    }
  },
  // Ventana "elegir y comprar": elementos elegibles + botón principal (RECLUTAR/COMPRAR/MEJORAR...).
  _PICK_SEL: ".backpack-slot, .skills-node, .armory-node",
  _picker(root) {
    const buy = root.querySelector(".shop-buy-btn");
    if (!buy || !this._isVisible(buy)) return null;
    const items = [...root.querySelectorAll(this._PICK_SEL)].filter((e) => !e.disabled && this._isVisible(e) && !e.classList.contains("backpack-slot--empty"));
    return items.length ? { buy, items } : null;
  },
  _pickItem(root, items, n) {
    const all = [...root.querySelectorAll(this._PICK_SEL)];
    const ix = all.indexOf(items[n]);
    this._clickNow(items[n]);
    const again = [...root.querySelectorAll(this._PICK_SEL)];
    this._focusEl = again[ix] || items[n];
    if (typeof SFX !== "undefined" && SFX.hover) { try { SFX.hover(); } catch (e) {} }
  },
  _uiBack(mode) {
    const root = mode.root;
    if (!root) return;
    if (root.classList.contains("gp-actions")) { this._closeActions(); return; }
    if (root.classList.contains("unit-info-overlay") && typeof UnitInfo !== "undefined") { UnitInfo.closePopup(); this._invalidateMode(); return; }
    if (root.classList.contains("mp-invite--visible") || root.classList.contains("mp-invite")) {
      const no = root.querySelector('[data-act="no"]');
      if (no) this._clickNow(no);
      return;
    }
    const close = root.querySelector(".backpack-close-btn, [data-close], .close-btn, [aria-label='Cerrar'], [data-act='close'], .tut-skip");
    if (close && this._isVisible(close)) { this._clickNow(close); return; }
    const back = root.querySelector(".back-btn, [data-back], [data-act='leave'], [data-act='no'], [data-act='rename-cancel']");
    if (back && this._isVisible(back)) { this._clickNow(back); return; }
    // Fondo de la ventana: es lo que ya cierra con un clic fuera.
    if (root.classList.contains("settings-overlay") || /overlay/.test(root.className)) {
      const r = root.getBoundingClientRect();
      this._mouse("click", root, r.left + 4, r.top + 4);
    }
  },
  // Pestañas de la ventana (las de Ajustes/Habilidades mandan sobre las de entrar/registrarse).
  _tabsIn(root) {
    const vis = (q) => [...root.querySelectorAll(q)].filter((t) => this._isVisible(t));
    const main = vis(".skills-tab");
    return main.length > 1 ? main : vis(".account-tab, .settings-tab");
  },
  _uiTab(mode, dir) {
    const root = mode.root;
    if (!root) return;
    const tabs = this._tabsIn(root);
    if (tabs.length < 2) return;
    let cur = tabs.findIndex((t) => /active/.test(t.className));
    if (cur < 0) cur = 0;
    const next = tabs[(cur + dir + tabs.length) % tabs.length];
    this._clickNow(next);
    this._focusEl = next;
  },

  // Elementos a los que se puede ir con el foco dentro de `root`.
  _candidates(mode) {
    const root = mode.root;
    const set = new Set();
    const scan = (scope) => {
      scope.querySelectorAll(GP_CLICKABLE).forEach((el) => set.add(el));
      // Cualquier cosa con cursor de "mano" (tarjetas, casillas...).
      const all = scope.querySelectorAll("*");
      for (let i = 0; i < all.length && i < 1500; i++) {
        const el = all[i];
        if (set.has(el)) continue;
        const cur = getComputedStyle(el).cursor;
        if (cur && (cur.indexOf("pointer") >= 0 || cur.indexOf("url(") >= 0) && el.parentElement && !/auto|default/.test(cur)) {
          const pc = getComputedStyle(el.parentElement).cursor;
          if (pc !== cur) set.add(el);
        }
      }
    };
    scan(root);
    if (mode.menu) document.querySelectorAll(".settings-gear-btn").forEach((el) => set.add(el));
    let list = [...set];
    // Solo el más exterior de cada grupo.
    list = list.filter((el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (set.has(p)) return false; return true; });
    return list.filter((el) => {
      if (!this._isVisible(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false;
      const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
      const cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      const top = document.elementFromPoint(cx, cy);
      return !!top && (el === top || el.contains(top) || top.contains(el));
    });
  },
  _focusCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },
  // Posición "lógica" del foco: n-ésimo elemento de su misma clase en la ventana.
  _focusSig(el, root) {
    const cls0 = el.classList && el.classList[0];
    let idx = -1;
    if (cls0) {
      const same = [...root.querySelectorAll("." + CSS.escape(cls0))].filter((e) => this._isVisible(e));
      idx = same.indexOf(el);
    }
    return { root, c: this._focusCenter(el), cls: el.className, cls0, idx, tab: /tab/.test(el.className) };
  },
  _ensureFocus(mode) {
    const f = this._focusEl;
    if (f && f.isConnected && this._isVisible(f) && mode.root.contains(f)) {
      this._focusMem = this._focusSig(f, mode.root);
      return f;
    }
    const list = this._candidates(mode);
    if (!list.length) return null;
    const TAB = /tab/;
    const m = this._focusMem;
    // El elemento enfocado se ha vuelto a pintar (p. ej. al invertir puntos en una
    // habilidad o comprar en la Armería): se queda en el MISMO puesto (n-ésimo de
    // su clase) o, si no, en el más cercano; nunca salta a una pestaña.
    if (m && m.root === mode.root) {
      let best = null;
      if (m.cls0 && m.idx >= 0) {
        const same = [...mode.root.querySelectorAll("." + CSS.escape(m.cls0))].filter((e) => this._isVisible(e));
        const cand = same[m.idx];
        if (cand && list.includes(cand)) best = cand;
      }
      if (!best) {
        const pool = list.filter((el) => m.tab || !TAB.test(el.className));
        const base = pool.length ? pool : list;
        let bd = Infinity;
        base.forEach((el) => { const c = this._focusCenter(el); const d = Math.hypot(c.x - m.c.x, c.y - m.c.y); if (d < bd) { bd = d; best = el; } });
      }
      if (best) { this._focusEl = best; return best; }
    }
    // Foco inicial: el botón que invita a avanzar (EMPEZAR...) o, si no, la
    // primera opción. Nunca el perfil/ajustes, las pestañas ni Atrás/Cerrar.
    const PRIMARY = ".mp-overlay--confirm [data-act=\"no\"], .opp-stepper__go, [data-primary]";
    const prim = list.find((el) => el.matches(PRIMARY));
    if (prim) { this._focusEl = prim; return prim; }
    const skip = ".backpack-close-btn, .back-btn, [data-back], .settings-gear-btn, .skills-tab, .account-tab, .settings-tab, .main-logo-hit, .opp-stepper__arrow, .sel-arrow";
    const notSkip = list.filter((el) => !el.matches(skip));
    const pool = notSkip.length ? notSkip : list;
    // Primera fila (la más alta) y, dentro de ella, la opción más a la izquierda.
    const rects = pool.map((el) => ({ el, r: el.getBoundingClientRect() }));
    const top = Math.min(...rects.map((o) => o.r.top));
    const first = rects.filter((o) => o.r.top < top + 0.6 * Math.max(...rects.filter((q) => q.r.top === top).map((q) => q.r.height)));
    first.sort((a, b) => a.r.left - b.r.left || a.r.top - b.r.top);
    this._focusEl = first[0].el;
    return this._focusEl;
  },
  _dir(dx, dy, ang) {
    const mode = this._mode(performance.now());
    if (this._listening) return;
    if (mode.type === "ui") this._uiMove(mode, dx, dy);
    else this._boardMove(dx, dy, ang);
  },
  _uiMove(mode, dx, dy) {
    const cur = this._ensureFocus(mode);
    if (!cur) return;
    if (cur.matches && cur.matches('input[type="range"]') && dx) {
      const step = Math.max(1, Math.round((+cur.max - +cur.min) / 20));
      cur.value = String(Math.min(+cur.max, Math.max(+cur.min, +cur.value + dx * step)));
      cur.dispatchEvent(new Event("input", { bubbles: true }));
      cur.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const list = this._candidates(mode).filter((el) => el !== cur);
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    list.forEach((el) => {
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2;
      const by = b.top + b.height / 2;
      const vx = bx - ax;
      const vy = by - ay;
      let main;
      let perp;
      let overlap;
      let share; // cuánto de la fila/columna comparten (0..1 del elemento más pequeño)
      if (dx) { main = vx * dx; perp = Math.abs(vy); overlap = b.top < a.bottom && b.bottom > a.top; share = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); share /= Math.max(1, Math.min(a.height, b.height)); }
      else { main = vy * dy; perp = Math.abs(vx); overlap = b.left < a.right && b.right > a.left; share = Math.min(a.right, b.right) - Math.max(a.left, b.left); share /= Math.max(1, Math.min(a.width, b.width)); }
      if (main < 2) return;
      if (perp > main * 3 && !overlap) return;
      // Misma fila/columna de verdad (>=50%): siempre gana a un botón ancho de otra fila
      // cuyo centro quede más cerca (antes "Buscar mando" -> derecha saltaba a "Ayudas").
      const score = main + perp * (overlap ? 0.4 : 2.2) + (share >= 0.5 ? 0 : 100000);
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      this._focusEl = best;
      // En ventanas de elegir y comprar, la cruceta sobre un elemento lo selecciona (se ve su descripción).
      const pk = this._picker(mode.root);
      if (pk && pk.items.includes(best) && !/selected/.test(best.className)) this._pickItem(mode.root, pk.items, pk.items.indexOf(best));
      this._focusEl.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (typeof SFX !== "undefined" && SFX.hover) { try { SFX.hover(); } catch (e) {} }
    } else {
      const sc = this._scrollParent(cur, mode.root);
      if (sc) sc.scrollTop += dy * 120;
    }
  },
  _scrollParent(el, root) {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 4) {
        const o = getComputedStyle(p).overflowY;
        if (o === "auto" || o === "scroll") return p;
      }
      if (p === root) break;
    }
    return null;
  },

  // ---------- Tablero ----------
  _size() { return (typeof Units !== "undefined" && Units.boardSize) || 0; },
  _ensureCursor() {
    const size = this._size();
    const host = typeof Units !== "undefined" ? Units.container : null;
    if (!size || !host) return false;
    if (!this._cursorEl || !this._cursorEl.isConnected || this._cursorEl.parentNode !== host) {
      const el = document.createElement("div");
      el.className = "gp-tile";
      el.innerHTML = '<svg viewBox="0 0 188 117" class="gp-tile__svg"><polygon class="gp-tile__shadow" points="94,6 182,58.5 94,111 6,58.5"/><polygon class="gp-tile__ring" points="94,6 182,58.5 94,111 6,58.5"/></svg>';
      host.appendChild(el);
      this._cursorEl = el;
      this._tile = null;
    }
    if (!this._tile || this._tile.row >= size || this._tile.col >= size) this._tile = this._startTile();
    return true;
  },
  _startTile() {
    const size = this._size();
    const sel = typeof Units !== "undefined" && Units.selectedId ? Units.list.find((u) => u.id === Units.selectedId) : null;
    if (sel) return { row: sel.row, col: sel.col };
    const ob = typeof Obelisks !== "undefined" ? Obelisks.byTeam("player") : null;
    if (ob) return { row: ob.row, col: ob.col };
    return { row: Math.floor(size / 2), col: Math.floor(size / 2) };
  },
  _placeCursor() {
    if (!this._cursorEl || !this._tile) return;
    const c = getTileCenter(this._tile.row, this._tile.col, this._size());
    this._cursorEl.style.left = c.x + "px";
    this._cursorEl.style.top = c.y + "px";
    this._cursorEl.style.zIndex = "1"; // sobre las losetas pero POR DEBAJO de cualquier sprite (unidades, árboles, edificios, marcadores)
  },
  // Navegación por losetas (cruceta / stick), como en los juegos de estrategia por casillas:
  //  - Se elige entre las 8 losetas vecinas la de ÁNGULO REAL más cercano a la dirección pulsada en
  //    pantalla (las vecinas isométricas están a 0°, ±32°, ±90°, ±148° y 180°, no cada 45°), sin zona
  //    muerta: una diagonal del stick o de la cruceta (dos botones) siempre da una loseta.
  //  - Deslizamiento por los bordes: si la vecina directa no existe (borde del mapa), se prueba la más
  //    cercana en ángulo hasta ~58°, en vez de quedarse parado.
  //  - Imán suave: entre dos vecinas casi igual de buenas, gana la que tiene algo (unidad, recurso,
  //    edificio, objetivo marcado) — las losetas "difíciles" ya no se escapan.
  _boardMove(dx, dy, ang) {
    if (!this._ensureCursor()) return;
    const size = this._size();
    const halfW = 94;
    const halfH = 58.5;
    const want = ang !== undefined ? ang : Math.atan2(dy, dx);
    const cand = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = this._tile.row + dr;
        const nc = this._tile.col + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        const a = Math.atan2((dc + dr) * halfH, (dc - dr) * halfW);
        let d = Math.abs(a - want);
        if (d > Math.PI) d = 2 * Math.PI - d;
        cand.push({ row: nr, col: nc, d });
      }
    }
    const MAX = (58 * Math.PI) / 180;
    const BONUS = (10 * Math.PI) / 180;
    let best = null;
    let bestScore = Infinity;
    cand.forEach((c) => {
      if (c.d > MAX) return;
      let sc = c.d;
      if (c.d < (30 * Math.PI) / 180) {
        let has = false;
        try { has = this._tileTargets(c.row, c.col).length > 0; } catch (e) {}
        if (has) sc -= BONUS;
      }
      if (sc < bestScore) { bestScore = sc; best = c; }
    });
    if (!best) return;
    this._tile = { row: best.row, col: best.col };
    this._placeCursor();
    this._follow();
    this._hover();
    if (typeof SFX !== "undefined" && SFX.hover) { try { SFX.hover(); } catch (e) {} }
  },
  _tileClient(row, col, useTarget) {
    const vp = BoardView.viewportEl.getBoundingClientRect();
    const c = getTileCenter(row, col, this._size());
    const s = useTarget ? BoardView.targetScale : BoardView.scale;
    const px = useTarget ? BoardView.targetPanX : BoardView.panX;
    const py = useTarget ? BoardView.targetPanY : BoardView.panY;
    return { x: vp.left + px + c.x * s, y: vp.top + py + c.y * s, vp };
  },
  // La cámara acompaña al cursor cuando se acerca a los bordes.
  _follow(force) {
    if (typeof BoardView === "undefined" || !BoardView.viewportEl || !this._tile) return;
    const p = this._tileClient(this._tile.row, this._tile.col, true);
    const mx = p.vp.width * 0.22;
    const myTop = p.vp.height * 0.2;
    const myBot = p.vp.height * 0.3;
    let ox = 0;
    let oy = 0;
    if (force) {
      ox = p.vp.left + p.vp.width / 2 - p.x;
      oy = p.vp.top + p.vp.height / 2 - p.y;
    } else {
      if (p.x < p.vp.left + mx) ox = p.vp.left + mx - p.x;
      else if (p.x > p.vp.right - mx) ox = p.vp.right - mx - p.x;
      if (p.y < p.vp.top + myTop) oy = p.vp.top + myTop - p.y;
      else if (p.y > p.vp.bottom - myBot) oy = p.vp.bottom - myBot - p.y;
    }
    if (ox || oy) BoardView._panBy(ox, oy);
  },
  _hover() {
    if (!this._tile || typeof BoardView === "undefined" || !BoardView.viewportEl) return;
    const p = this._tileClient(this._tile.row, this._tile.col, false);
    const t = document.elementFromPoint(p.x, p.y) || BoardView.viewportEl;
    this._mouse("mousemove", t, p.x, p.y, { buttons: 0 });
  },
  // Elementos clicables que hay sobre una loseta, de más a menos prioritario.
  _tileTargets(row, col) {
    const out = [];
    document.querySelectorAll(`.board-marker[data-row="${row}"][data-col="${col}"]`).forEach((m) => out.push(m));
    out.sort((a, b) => (parseInt(b.style.zIndex, 10) || 0) - (parseInt(a.style.zIndex, 10) || 0));
    const at = (list) => (list || []).find((o) => o && o.row === row && o.col === col && o.el);
    const u = typeof Units !== "undefined" ? Units.unitAt(row, col) : null;
    if (u && u.el) out.push(u.el);
    ["Obelisks", "Villages", "Shops", "Oracle", "Altar", "Drums", "Volcano", "Mushrooms"].forEach((n) => {
      const mod = window[n] || (typeof eval === "function" ? (function () { try { return eval(n); } catch (e) { return null; } })() : null);
      const o = mod && at(mod.list);
      if (o) out.push(o.el);
    });
    return out;
  },
  _activateTile() {
    if (!this._ensureCursor()) return;
    // El tutorial: su botón "Continuar" tiene prioridad si está en pantalla.
    const tut = document.querySelector(".tut-btn");
    if (tut && this._isVisible(tut)) { this._clickNow(tut); return; }
    const { row, col } = this._tile;
    const targets = this._tileTargets(row, col);
    const p = this._tileClient(row, col, false);
    const el = targets[0];
    if (el) {
      const r = el.getBoundingClientRect();
      const x = r.width && r.height ? r.left + r.width / 2 : p.x;
      const y = r.width && r.height ? r.top + r.height / 2 : p.y;
      this._beginClick(el, x, y);
    } else {
      this._beginClick(BoardView.viewportEl, p.x, p.y);
    }
  },
  // Iconos del menú del Obelisco (Reclutar / Habilidades / Armería) visibles ahora mismo.
  _obMenu() {
    const btns = Array.from(document.querySelectorAll(".obelisk--selected .obelisk__menu-btn")).filter((b) => this._isVisible(b) && !b.disabled);
    if (!btns.length) {
      this._obIdx = -1;
      this._obWas = false;
      document.querySelectorAll(".gp-ob-focus").forEach((b) => b.classList.remove("gp-ob-focus"));
    } else if (!this._obWas && this.active) {
      // Al abrirse el menú del Obelisco, la primera opción ya viene remarcada.
      this._obWas = true;
      this._obIdx = 0;
      btns.forEach((b, k) => b.classList.toggle("gp-ob-focus", k === 0));
    }
    return btns;
  },
  _obStep(dir, btns) {
    const n = btns.length;
    let i = typeof this._obIdx === "number" ? this._obIdx : -1;
    i = i < 0 ? (dir > 0 ? 0 : n - 1) : (i + dir + n) % n;
    this._obIdx = i;
    btns.forEach((b, k) => b.classList.toggle("gp-ob-focus", k === i));
    if (typeof SFX !== "undefined" && SFX.click) { try { SFX.click(); } catch (e) {} }
  },
  _boardAction(act) {
    // El tutorial: su botón "Continuar" va antes que cualquier otra cosa de A.
    if (act === "confirm") {
      const tut = document.querySelector(".tut-btn");
      if (tut && this._isVisible(tut)) { this._clickNow(tut); return; }
    }
    // Con el Obelisco propio seleccionado: LB/RB recorren Reclutar · Habilidades · Armería y A abre la elegida.
    const obBtns = this._obMenu();
    if (obBtns.length) {
      if (act === "prevUnit") { this._obStep(-1, obBtns); return; }
      if (act === "nextUnit") { this._obStep(1, obBtns); return; }
      if (act === "confirm" && this._obIdx >= 0 && obBtns[this._obIdx]) {
        const b = obBtns[this._obIdx];
        this._obIdx = -1;
        b.classList.remove("gp-ob-focus");
        this._clickNow(b);
        return;
      }
    }
    if (act === "confirm") { this._activateTile(); return; }
    if (act === "back") { this._cancel(); return; }
    if (act === "backpack") {
      const bb = document.querySelector(".backpack-btn");
      if (bb && this._isVisible(bb)) { this._clickNow(bb); }
      else this._toast("Selecciona una unidad para abrir su mochila", "ph-fill ph-backpack");
      return;
    }
    if (act === "actions") { this._openActions(); return; }
    if (act === "endTurn") {
      const b = document.querySelector(".end-turn-btn--visible");
      if (b && !b.classList.contains("end-turn-btn--thinking")) this._clickNow(b);
      return;
    }
    // Con objetivos a la vista (lanzar al huevo/bumper/grulla, pasar el gnomo, atacar...): LB/RB los recorren
    // y la cámara se centra en cada uno. Sin objetivos, LB/RB cambian de unidad como siempre.
    if ((act === "prevUnit" || act === "nextUnit") && this._cycleTarget(act === "nextUnit" ? 1 : -1)) return;
    if (act === "prevUnit") { this._cycleUnit(-1); return; }
    if (act === "nextUnit") { this._cycleUnit(1); return; }
    if (act === "center") { if (this._ensureCursor()) this._follow(true); return; }
    if (act === "toObelisk") {
      const ob = typeof Obelisks !== "undefined" ? Obelisks.byTeam("player") : null;
      // Pulsarlo estando ya sobre la base: centra la cámara en la unidad seleccionada (o en el cursor).
      if (ob && this._tile && this._tile.row === ob.row && this._tile.col === ob.col && typeof Units !== "undefined" && Units.selectedId) {
        const u = Units.list.find((x) => x.id === Units.selectedId);
        if (u && this._ensureCursor()) { this._tile = { row: u.row, col: u.col }; this._placeCursor(); this._follow(true); return; }
      }
      if (ob && this._ensureCursor()) {
        this._cancelTargets();
        this._tile = { row: ob.row, col: ob.col };
        this._placeCursor();
        this._follow(true);
        // Acceso directo: además de ir, selecciona la base para que salga su menú (Reclutar · Habilidades · Armería).
        if (typeof Units !== "undefined" && Units.deselect) Units.deselect();
        try { this._activateTile(); this._finishClick(); } catch (e) {}
      }
      return;
    }
    if (act === "glory") { if (typeof Glory !== "undefined" && Glory.openPopup) Glory.openPopup(); return; }
    if (act === "settings") { if (typeof SettingsMenu !== "undefined") SettingsMenu.open(); return; }
  },
  // B primero cancela lo que se esté colocando/apuntando (Setarcoiris, TotemVision,
  // BeVida, KataPum!, habilidades con objetivo) sin deseleccionar a la unidad.
  _cancelTargets() {
    let did = false;
    const B = typeof Backpack !== "undefined" ? Backpack : null;
    const A = typeof Abilities !== "undefined" ? Abilities : null;
    try {
      if (B) {
        if (B._placingUid != null) { B._cancelPlacing(); did = true; }
        if (B._givingUid != null) { B._cancelGivingBevida(); did = true; }
        if (B._katapumUid != null) { B._cancelTargetingKatapum(); did = true; }
      }
      if (A) {
        if (A._pickHandler) { A._cancelUnitPicking(); did = true; }
        if (A._targetingUnit) { A._cancelTargeting(); did = true; }
      }
    } catch (e) {}
    return did;
  },
  _cancel() {
    this._obIdx = -1;
    document.querySelectorAll(".gp-ob-focus").forEach((b) => b.classList.remove("gp-ob-focus"));
    if (this._cancelTargets()) return;
    if (typeof Abilities !== "undefined" && Abilities._cancelTargeting) { try { Abilities._cancelTargeting(); } catch (e) {} }
    if (typeof Units !== "undefined") Units.deselect();
    if (typeof Obelisks !== "undefined") Obelisks.deselect();
    if (typeof Villages !== "undefined") Villages.deselect();
    if (typeof Gnome !== "undefined" && Gnome.hideAllBadges) Gnome.hideAllBadges();
  },
  // Marcadores de OBJETIVO visibles (no los de movimiento): flechas del huevo, bumpers, grulla, aliados a los que
  // pasar, enemigos a los que atacar, objetivos de habilidades...
  _targetMarkers() {
    const sel = ".board-marker.pass-marker:not(.egg-preview-marker):not(.egg-throw-marker--center), .board-marker.attack-marker, .board-marker.catch-marker, .board-marker.ability-pick-marker";
    const out = Array.from(document.querySelectorAll(sel)).filter((m) => this._isVisible(m) && m.dataset.row !== undefined);
    // Un solo marcador por loseta (los apilados cuentan una vez).
    const seen = new Set();
    return out.filter((m) => { const k = m.dataset.row + "," + m.dataset.col; if (seen.has(k)) return false; seen.add(k); return true; });
  },
  _cycleTarget(dir) {
    const list = this._targetMarkers();
    if (!list.length || !this._ensureCursor()) return false;
    // Orden estable: por ángulo alrededor de la unidad seleccionada (o del cursor) en pantalla.
    const sel = typeof Units !== "undefined" && Units.selectedId ? Units.list.find((u) => u.id === Units.selectedId) : null;
    const base = this._tileClient(sel ? sel.row : this._tile.row, sel ? sel.col : this._tile.col, false);
    const ang = (m) => { const r = m.getBoundingClientRect(); return Math.atan2(r.top + r.height / 2 - base.y, r.left + r.width / 2 - base.x); };
    list.sort((a, b) => ang(a) - ang(b));
    let i = list.findIndex((m) => +m.dataset.row === this._tile.row && +m.dataset.col === this._tile.col);
    i = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
    const m = list[i];
    if (this._focusMarker && this._focusMarker !== m && this._focusMarker.isConnected) {
      try { this._focusMarker.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse", bubbles: false })); } catch (e) {}
    }
    this._focusMarker = m;
    this._tile = { row: +m.dataset.row, col: +m.dataset.col };
    this._placeCursor();
    this._follow(true);
    // Ver el resultado antes de decidir: el mismo "pasar el ratón" que da el vista previa de la trayectoria del huevo.
    try { m.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse", bubbles: false })); } catch (e) {}
    if (typeof SFX !== "undefined" && SFX.hover) { try { SFX.hover(); } catch (e) {} }
    return true;
  },
  _cycleUnit(dir) {
    if (typeof Units === "undefined") return;
    const mine = Units.list.filter((u) => u.team === "player" && u.el && !u.dead && u.el.isConnected);
    if (!mine.length) {
      // Sin unidades todavía: lleva el cursor a tu Obelisco (para reclutar).
      this._boardAction("toObelisk");
      return;
    }
    mine.sort((a, b) => a.row - b.row || a.col - b.col);
    const fresh = mine.filter((u) => !u.el.classList.contains("unit--exhausted"));
    const pool = fresh.length ? fresh : mine;
    let i = pool.findIndex((u) => u.id === Units.selectedId);
    i = i < 0 ? (dir > 0 ? 0 : pool.length - 1) : (i + dir + pool.length) % pool.length;
    const u = pool[i];
    Units.select(u);
    if (this._ensureCursor()) { this._tile = { row: u.row, col: u.col }; this._placeCursor(); this._follow(true); }
  },

  // ---------- Menú de acciones (X) ----------
  _openActions() {
    this._closeActions();
    const items = [];
    GP_ACTION_BUTTONS.forEach((def) => {
      document.querySelectorAll(def.sel).forEach((el) => {
        if (!this._isVisible(el)) return;
        if (el.disabled) return;
        items.push({ el, icon: def.icon, label: def.label(el) });
      });
    });
    if (!items.length) { this._toast("Sin acciones disponibles", "ph-fill ph-prohibit"); return; }
    const box = document.createElement("div");
    box.className = "gp-actions";
    const panel = document.createElement("div");
    panel.className = "p5-banner gp-actions__panel";
    panel.style.setProperty("--p5-tone", "#372e3d");
    panel.innerHTML = '<div class="p5-banner__label gp-actions__title">Acciones</div>';
    items.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button";
      b._gpEl = it.el; // el tutorial señala la opción que corresponde a su objetivo
      b.className = "p5-banner p5-banner--action gp-actions__item";
      b.style.setProperty("--p5-tone", "#2b2733");
      b.innerHTML = `<i class="${it.icon} gp-actions__icon"></i><span class="p5-banner__label">${(it.label || "").replace(/</g, "&lt;")}</span>`;
      b.addEventListener("click", () => {
        this._closeActions();
        setTimeout(() => this._clickNow(it.el), 30);
      });
      panel.appendChild(b);
    });
    box.appendChild(panel);
    box.addEventListener("click", (e) => { if (e.target === box) this._closeActions(); });
    document.body.appendChild(box);
    this._actionsEl = box;
    this._invalidateMode();
    this._focusEl = null;
  },
  _closeActions() {
    if (this._actionsEl) { this._actionsEl.remove(); this._actionsEl = null; this._invalidateMode(); this._focusEl = null; }
  },


  // ---------- Teclado en pantalla ----------
  _KB_LAYERS: {
    abc: [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
      ["__shift", "z", "x", "c", "v", "b", "n", "m", "__bs"],
      ["@", ".", "-", "_", "__sym", "__space", "__eye", "__ok"],
    ],
    sym: [
      ["!", "#", "$", "%", "&", "/", "(", ")", "=", "?"],
      ["+", "*", "~", ";", ":", ",", "<", ">", "[", "]"],
      ["{", "}", "|", "\\", "'", '"', "^", "`", "´", "¿"],
      ["__shift", "¡", "€", "£", "·", "ª", "º", "§", "__bs"],
      ["@", ".", "-", "_", "__abc", "__space", "__eye", "__ok"],
    ],
  },
  _kb: null,
  _openKeyboard(input) {
    this._closeKeyboard();
    const box = document.createElement("div");
    box.className = "gp-kb";
    box.innerHTML = '<div class="gp-kb__panel"><div class="gp-kb__preview"><span class="gp-kb__label"></span><span class="gp-kb__text"></span></div><div class="gp-kb__keys"></div></div>';
    document.body.appendChild(box);
    this._kb = { input, box, layer: "abc", shift: false, show: input.type !== "password" };
    this._kb.label = (input.closest("label") && input.closest("label").textContent.trim()) || input.getAttribute("aria-label") || input.placeholder || "";
    box.querySelector(".gp-kb__label").textContent = this._kb.label.slice(0, 40);
    this._kbRender();
    this._invalidateMode();
    this._focusEl = [...box.querySelectorAll("button")].find((b) => b.dataset.k === "q") || null;
  },
  _kbRender() {
    const kb = this._kb;
    if (!kb) return;
    const rows = this._KB_LAYERS[kb.layer];
    const keys = kb.box.querySelector(".gp-kb__keys");
    keys.innerHTML = rows
      .map((row) => '<div class="gp-kb__row">' + row.map((k) => this._kbKeyHtml(k)).join("") + "</div>")
      .join("");
    keys.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => this._kbKey(b.dataset.k)));
    this._kbPreview();
  },
  _kbKeyHtml(k) {
    const kb = this._kb;
    const special = {
      __shift: ['<i class="ph-bold ph-arrow-fat-up"></i>', "gp-key--w15" + (kb.shift ? " gp-key--on" : "")],
      __bs: ['<i class="ph-bold ph-backspace"></i>', "gp-key--w15"],
      __sym: ["#+=", "gp-key--w15"],
      __abc: ["ABC", "gp-key--w15"],
      __space: ["espacio", "gp-key--space"],
      __eye: ['<i class="ph-bold ' + (kb.show ? "ph-eye-slash" : "ph-eye") + '"></i>', "gp-key--w15"],
      __ok: ["OK", "gp-key--w2 gp-key--ok"],
    };
    if (special[k]) return '<button type="button" class="gp-key ' + special[k][1] + '" data-k="' + k + '"><span>' + special[k][0] + "</span></button>";
    const ch = kb.shift && kb.layer === "abc" ? k.toUpperCase() : k;
    return '<button type="button" class="gp-key" data-k="' + this._esc(k) + '"><span>' + this._esc(ch) + "</span></button>";
  },
  _kbPreview() {
    const kb = this._kb;
    if (!kb) return;
    const v = kb.input.value || "";
    const shown = kb.input.type === "password" && !kb.show ? "•".repeat(v.length) : v;
    const pos = Math.min(kb.input.selectionStart == null ? v.length : kb.input.selectionStart, v.length);
    const el = kb.box.querySelector(".gp-kb__text");
    el.innerHTML = "";
    el.append(document.createTextNode(shown.slice(0, pos)));
    const caret = document.createElement("span");
    caret.className = "gp-kb__caret";
    el.append(caret, document.createTextNode(shown.slice(pos)));
    if (!v) { const ph = document.createElement("span"); ph.className = "gp-kb__ph"; ph.textContent = kb.input.placeholder || ""; el.append(ph); }
  },
  _kbKey(k) {
    const kb = this._kb;
    if (!kb) return;
    if (k === "__shift") { kb.shift = !kb.shift; this._kbRender(); return; }
    if (k === "__bs") { this._kbBackspace(); return; }
    if (k === "__sym") { kb.layer = "sym"; kb.shift = false; this._kbRender(); return; }
    if (k === "__abc") { kb.layer = "abc"; kb.shift = false; this._kbRender(); return; }
    if (k === "__space") { this._kbType(" "); return; }
    if (k === "__eye") { kb.show = !kb.show; this._kbRender(); return; }
    if (k === "__ok") { this._kbClose(true); return; }
    this._kbType(kb.shift && kb.layer === "abc" ? k.toUpperCase() : k);
    if (kb.shift) { kb.shift = false; this._kbRender(); }
  },
  _kbType(ch) {
    const kb = this._kb;
    if (!kb) return;
    const inp = kb.input;
    const max = inp.maxLength > 0 ? inp.maxLength : 1e9;
    if ((inp.value || "").length >= max) return;
    const a = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
    const b = inp.selectionEnd == null ? a : inp.selectionEnd;
    inp.value = inp.value.slice(0, a) + ch + inp.value.slice(b);
    try { inp.setSelectionRange(a + ch.length, a + ch.length); } catch (e) {}
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    this._kbPreview();
  },
  _kbBackspace() {
    const kb = this._kb;
    if (!kb) return;
    const inp = kb.input;
    let a = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
    const b = inp.selectionEnd == null ? a : inp.selectionEnd;
    if (a === b) { if (a === 0) return; a -= 1; }
    inp.value = inp.value.slice(0, a) + inp.value.slice(b);
    try { inp.setSelectionRange(a, a); } catch (e) {}
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    this._kbPreview();
  },
  _kbCaret(d) {
    const kb = this._kb;
    if (!kb) return;
    const inp = kb.input;
    const a = Math.max(0, Math.min(inp.value.length, (inp.selectionStart == null ? inp.value.length : inp.selectionStart) + d));
    try { inp.setSelectionRange(a, a); } catch (e) {}
    this._kbPreview();
  },
  _kbClose(accept) {
    const kb = this._kb;
    if (!kb) return;
    const inp = kb.input;
    this._closeKeyboard();
    if (inp.isConnected) {
      this._focusEl = inp;
      if (accept) inp.dispatchEvent(new Event("change", { bubbles: true }));
    }
  },
  _closeKeyboard() {
    if (this._kb) { this._kb.box.remove(); this._kb = null; this._invalidateMode(); }
  },

  // ---------- Visuales ----------
  _ensureVisuals() {
    if (!this._ringEl) {
      const r = document.createElement("div");
      r.className = "gp-focus";
      r.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon class="gp-focus__out" points="1.6,0 100,0 98.4,100 0,100"/><polygon class="gp-focus__in" points="1.6,0 100,0 98.4,100 0,100"/></svg>';
      document.body.appendChild(r);
      this._ringEl = r;
    }
    if (!this._barEl) {
      const b = document.createElement("div");
      b.className = "gp-hints";
      document.body.appendChild(b);
      this._barEl = b;
    }
  },
  _markFocus(el) {
    if (this._marked === el) return;
    if (this._marked) this._marked.classList.remove("gp-focused");
    this._marked = el;
    if (el) el.classList.add("gp-focused");
  },
  // Área visible del elemento: pantalla ∩ contenedores con scroll que lo recortan.
  _scrollClip(el) {
    let L = 0, T = 0, R = innerWidth, B = innerHeight;
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (p.scrollHeight <= p.clientHeight + 1 && p.scrollWidth <= p.clientWidth + 1) continue;
      const cs = getComputedStyle(p);
      if (!/(auto|scroll|hidden)/.test(cs.overflowY + cs.overflowX)) continue;
      const pr = p.getBoundingClientRect();
      L = Math.max(L, pr.left); T = Math.max(T, pr.top); R = Math.min(R, pr.right); B = Math.min(B, pr.bottom);
    }
    return { L, T, R, B };
  },
  // El anillo de foco copia la silueta irregular del elemento (su clip-path).
  _ringShape(el) {
    if (this._ringShapeEl === el) return;
    this._ringShapeEl = el;
    let pts = "1.6,0 100,0 98.4,100 0,100";
    const cs = [getComputedStyle(el, "::before").clipPath, getComputedStyle(el, "::after").clipPath, getComputedStyle(el).clipPath];
    for (const c of cs) {
      const m = c && c.match(/^polygon\((.*)\)$/);
      if (!m) continue;
      const parts = m[1].split(",").map((q) => q.trim().split(/\s+/));
      if (parts.length >= 3 && parts.every((q) => q.length === 2 && /%$/.test(q[0]) && /%$/.test(q[1]))) {
        pts = parts.map((q) => parseFloat(q[0]) + "," + parseFloat(q[1])).join(" ");
        break;
      }
    }
    this._ringEl.querySelectorAll("polygon").forEach((pg) => pg.setAttribute("points", pts));
  },
  _frame(now, mode) {
    this._ensureVisuals();
    // Anillo de foco en menús/ventanas.
    if (mode.type === "ui" && this.active) {
      const el = this._ensureFocus(mode);
      this._ringEl.classList.remove("gp-focus--on");
      // El recuadro se dibuja sobre el propio elemento (silueta con sus costes/insignias
      // encima), así sigue su forma irregular y se recorta con el scroll.
      this._markFocus(el && this._isVisible(el) ? el : null);
      this._cursorEl && this._cursorEl.classList.remove("gp-tile--on");
    } else {
      this._ringEl.classList.remove("gp-focus--on");
      this._markFocus(null);
      if (mode.type === "board" && this.active && this._ensureCursor()) {
        this._placeCursor();
        this._cursorEl.classList.add("gp-tile--on");
      } else this._cursorEl && this._cursorEl.classList.remove("gp-tile--on");
    }
    this._actionIcon(mode, now);
    this._updateHints(false, mode, now);
  },

  // Icono de acción del cursor del mando (pico, hacha, mano, bandera, calavera, daga...): con el
  // ratón lo da el puntero del sistema; con el mando se dibuja el MISMO icono sobre la casilla
  // elegida, por encima de todos los sprites.
  _actionIcon(mode, now) {
    let el = this._iconEl;
    const hide = () => { if (el && el.style.display !== "none") el.style.display = "none"; };
    if (!(mode.type === "board" && this.active && this._tile && typeof BoardView !== "undefined" && BoardView.viewportEl)) { hide(); return; }
    if (this._iconAt && now - this._iconAt < 90) return; // no hace falta cada fotograma
    this._iconAt = now;
    let url = null;
    try {
      const { row, col } = this._tile;
      for (const t of this._tileTargets(row, col)) {
        const c = getComputedStyle(t).cursor || "";
        const m = /url\(["']?([^"')]+)["']?\)/.exec(c);
        if (m) { url = m[1]; break; }
      }
    } catch (e) {}
    if (!url) { hide(); return; }
    if (!el) {
      el = document.createElement("img");
      el.className = "gp-actionicon";
      el.alt = "";
      el.draggable = false;
      document.body.appendChild(el);
      this._iconEl = el;
    }
    if (el.getAttribute("src") !== url) el.setAttribute("src", url);
    const p = this._tileClient(this._tile.row, this._tile.col, false);
    el.style.left = Math.round(p.x) + "px";
    el.style.top = Math.round(p.y - 34 * Math.max(0.7, BoardView.scale)) + "px";
    el.style.display = "block";
  },

  glyph(i) {
    const d = GP_BTN[i];
    if (!d) return "";
    if (d.kind === "face") return `<span class="gp-glyph gp-glyph--face" style="--c:${d.color}">${d.n}</span>`;
    if (d.kind === "icon") return `<span class="gp-glyph gp-glyph--icon"><i class="${d.icon}"></i></span>`;
    return `<span class="gp-glyph gp-glyph--${d.kind}">${d.n}</span>`;
  },
  _glyphOf(act) { return this.glyph(this.map[act]); },

  _updateHints(force, mode, now) {
    if (!this._barEl) return;
    const show = this.connected && this.hints && this.active && !this._test;
    if (!show) {
      this._barEl.classList.remove("gp-hints--on");
      this._badgeEls.forEach((b) => (b.style.display = "none"));
      return;
    }
    mode = mode || this._mode(performance.now());
    // Barra inferior contextual.
    let items;
    if (mode.type === "ui" && mode.root && mode.root.classList.contains("gp-kb")) {
      items = [["confirm", "Escribir"], ["back", "Cerrar"], ["backpack", "Espacio"], ["endTurn", "Borrar"], ["settings", "Aceptar"], ["prevUnit", "◂ Cursor"], ["nextUnit", "Cursor ▸"]];
    } else if (mode.type === "ui") {
      const pk = mode.root && mode.root.querySelector ? this._picker(mode.root) : null;
      let lab = "Aceptar";
      if (pk) { const t = (pk.buy.textContent || "").trim().toLowerCase(); if (t && t.length < 18) lab = t.charAt(0).toUpperCase() + t.slice(1); }
      items = [["confirm", lab], ["back", "Atrás"]];
      if (mode.root && this._tabsIn(mode.root).length > 1) items.push(["prevUnit", "◂ Pestaña"], ["nextUnit", "Pestaña ▸"]);
      else if (pk && pk.items.length > 1) items.push(["prevUnit", "◂ Elegir"], ["nextUnit", "Elegir ▸"]);
      items.push(["__dpad", "Mover"]);
    } else {
      const sel = typeof Units !== "undefined" && Units.selectedId;
      const obOpen = this._obMenu().length > 0;
      items = obOpen
        ? [["confirm", "Elegir"], ["back", "Cancelar"], ["prevUnit", "◂ Opción"], ["nextUnit", "Opción ▸"], ["endTurn", "Fin de turno"], ["toObelisk", "Mi base"]]
        : sel
        ? (this._targetMarkers().length
          ? [["confirm", "Mover / Actuar"], ["back", "Cancelar"], ["backpack", "Mochila"], ["actions", "Acciones"], ["endTurn", "Fin de turno"], ["prevUnit", "◂ Objetivo"], ["nextUnit", "Objetivo ▸"], ["toObelisk", "Mi base"]]
          : [["confirm", "Mover / Actuar"], ["back", "Cancelar"], ["backpack", "Mochila"], ["actions", "Acciones"], ["endTurn", "Fin de turno"], ["prevUnit", "◂ Unidad"], ["nextUnit", "Unidad ▸"], ["toObelisk", "Mi base"]])
        : [["confirm", "Seleccionar"], ["prevUnit", "◂ Unidad"], ["nextUnit", "Unidad ▸"], ["toObelisk", "Mi base"], ["endTurn", "Fin de turno"], ["settings", "Ajustes"]];
    }
    const key = items.map((x) => x[0] + this.map[x[0]] + x[1]).join("|") + I18N.currentLang + mode.type;
    if (force || key !== this._lastBarKey) {
      this._lastBarKey = key;
      this._barEl.innerHTML = items
        .map(([a, l]) => `<span class="gp-hint">${a === "__dpad" ? '<span class="gp-glyph gp-glyph--icon"><i class="ph-bold ph-arrows-out-cardinal"></i></span>' : this._glyphOf(a)}<span class="gp-hint__t">${l}</span></span>`)
        .join("");
    }
    this._barEl.classList.add("gp-hints--on");
    // Ayudas pegadas a botones.
    let n = 0;
    const noBadges = !!(mode.root && mode.root.matches && mode.root.matches(".gp-kb, .gp-actions"));
    const place = (el, html, atLeft) => {
      if (noBadges) return;
      let b = this._badgeEls[n];
      if (!b) { b = document.createElement("div"); b.className = "gp-badge"; document.body.appendChild(b); this._badgeEls[n] = b; }
      n++;
      if (b._h !== html) { b.innerHTML = html; b._h = html; }
      const r = el.getBoundingClientRect();
      b.style.display = "";
      // Esquina superior derecha, fuera del botón: así no tapa su icono.
      const left = atLeft === undefined ? r.left + r.width / 2 < innerWidth / 2 : atLeft;
      b.style.left = Math.round(left ? Math.max(2, r.left - 10) : Math.min(innerWidth - 34, r.right - 22)) + "px";
      b.style.top = Math.round(Math.max(2, r.top - 16)) + "px";
    };
    GP_BADGES.forEach(([sel, act, where]) => {
      if (where !== mode.type) return;
      document.querySelectorAll(sel).forEach((el) => { if (this._isVisible(el)) place(el, this._glyphOf(act)); });
    });
    if (mode.type === "ui" && mode.root) {
      const tabs = this._tabsIn(mode.root);
      if (tabs.length > 1 && !noBadges) {
        place(tabs[0], this._glyphOf("prevUnit"), true);
        const last = tabs[tabs.length - 1];
        const lb = this._badgeEls[n] || (this._badgeEls[n] = Object.assign(document.createElement("div"), { className: "gp-badge" }));
        if (!lb.isConnected) document.body.appendChild(lb);
        n++;
        lb.innerHTML = this._glyphOf("nextUnit");
        lb._h = null;
        const r = last.getBoundingClientRect();
        lb.style.display = "";
        lb.style.left = Math.round(r.right - 22) + "px";
        lb.style.top = Math.round(r.top - 10) + "px";
      }
    }
    for (let i = n; i < this._badgeEls.length; i++) this._badgeEls[i].style.display = "none";
  },

  _toast(text, icon) {
    if (this._toastEl) this._toastEl.remove();
    const el = document.createElement("div");
    el.className = "p5-banner gp-toast";
    el.style.setProperty("--p5-tone", "#2b2733");
    el.innerHTML = `<i class="${icon || "ph-fill ph-game-controller"} gp-toast__icon"></i><span class="p5-banner__label">${text}</span>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("gp-toast--on"));
    this._toastEl = el;
    setTimeout(() => { if (this._toastEl === el) { el.classList.remove("gp-toast--on"); setTimeout(() => el.remove(), 300); this._toastEl = null; } }, 2600);
  },

  // ---------- Pestaña "Mando" de Ajustes ----------
  buildPane() {
    const pane = document.createElement("div");
    pane.className = "gp-pane";
    this._pane = pane;
    this._refreshPane();
    return pane;
  },
  _refreshPane() {
    const pane = this._pane;
    if (!pane) return;
    const rows = GP_ACTIONS.map((a) => {
      const on = this._listening && this._listening.action === a.id;
      return `<button type="button" class="p5-banner p5-banner--action gp-map__row${on ? " gp-map__row--listen" : ""}" data-gp="${a.id}" style="--p5-tone:#2b2733">
        <span class="p5-banner__label gp-map__label">${a.label}</span>
        <span class="gp-map__btn">${on ? '<span class="gp-map__wait">Pulsa…</span>' : this.glyph(this.map[a.id])}</span>
      </button>`;
    }).join("");
    pane.innerHTML = `
      <div class="gp-status ${this.connected ? "gp-status--ok" : ""}">
        <i class="ph-fill ph-game-controller"></i>
        <span>${this.connected ? "Mando conectado: " + this._esc(this.padName) : "Sin mando. Conecta uno y pulsa cualquier botón."}</span>
      </div>
      <div class="gp-btnrow">
        <button type="button" class="p5-banner p5-banner--action gp-rescan" style="--p5-tone:#2b3a52"><span class="p5-banner__label"><i class="ph ph-arrows-clockwise"></i> Buscar mando</span></button>
        <button type="button" class="p5-banner p5-banner--action gp-testbtn${this._test ? " gp-testbtn--on" : ""}" style="--p5-tone:${this._test ? "#1f6b34" : "#2b3a52"}"><span class="p5-banner__label"><i class="ph-fill ph-${this._test ? "stop" : "play"}"></i> ${this._test ? "Salir del test" : "Test"}</span></button>
      </div>
      ${this._test ? '<div class="gp-note gp-note--test">Modo test: pulsa los botones del mando para ver cómo se iluminan. Pulsa SELECT y START a la vez para salir.</div>' : ""}
      <button type="button" class="p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle gp-hintsbtn" style="--p5-tone:#2b2733">
        <span class="settings-panel__option-main"><i class="ph ph-question settings-panel__option-icon"></i><span class="p5-banner__label">Ayudas del mando</span></span>
        <span class="settings-toggle" data-checked="${this.hints}"><i class="ph ph-check settings-toggle__check"></i></span>
      </button>
      ${this._testerSvg()}
      <div class="gp-sec">Controles</div>
      <div class="gp-map">${rows}</div>
      <div class="gp-note">Cruceta o stick izquierdo: mover cursor y navegar. Stick derecho: cámara.</div>
      <button type="button" class="p5-banner p5-banner--action gp-reset" style="--p5-tone:#5a1d1d"><span class="p5-banner__label">Restablecer</span></button>`;
    pane.querySelector(".gp-rescan").addEventListener("click", () => { if (typeof SFX !== "undefined") SFX.click(); this.rescan(); });
    pane.querySelector(".gp-testbtn").addEventListener("click", () => {
      if (typeof SFX !== "undefined") SFX.click();
      if (!this._test && !this.connected) { this._toast("Conecta un mando para hacer el test", "ph-fill ph-game-controller"); return; }
      this._setTest(!this._test);
    });
    pane.classList.toggle("gp-pane--test", !!this._test);
    pane.querySelector(".gp-hintsbtn").addEventListener("click", () => {
      if (typeof SFX !== "undefined") SFX.click();
      this.setHints(!this.hints);
      pane.querySelector(".gp-hintsbtn .settings-toggle").dataset.checked = String(this.hints);
    });
    pane.querySelectorAll("[data-gp]").forEach((b) =>
      b.addEventListener("click", () => {
        if (typeof SFX !== "undefined") SFX.click();
        if (this._listening && this._listening.action === b.dataset.gp) this._stopListening();
        else { this._listening = { action: b.dataset.gp }; this._refreshPane(); }
      })
    );
    pane.querySelector(".gp-reset").addEventListener("click", () => { if (typeof SFX !== "undefined") SFX.click(); this._listening = null; this.resetMap(); });
  },
  _setTest(v) {
    this._test = !!v;
    this._prev = {};
    this._lastBarKey = "";
    this._refreshPane();
    if (!v && this._pane) this._pane.querySelectorAll("[data-pad]").forEach((e) => { e.classList.remove("gp-t--on"); e.style.transform = ""; e.style.fill = ""; });
  },
  rescan() {
    const pad = this._getPad();
    if (pad && !this.connected) this._onConnect(pad);
    else if (!pad && this.connected) this._onDisconnect();
    else {
      this._toast(pad ? "Mando conectado" : "No se detecta ningún mando. Pulsa un botón del mando e inténtalo de nuevo.", "ph-fill ph-game-controller");
      this._refreshPane();
    }
  },
  _esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); },
  _stopListening() { this._listening = null; this._refreshPane(); },
  _assign(action, i) {
    const old = this.map[action];
    const other = GP_ACTIONS.find((a) => a.id !== action && this.map[a.id] === i);
    this.map[action] = i;
    if (other) this.map[other.id] = old; // intercambio si el botón ya estaba en uso
    this._savePrefs();
    this._listening = null;
    this._lastBarKey = "";
    this._refreshPane();
  },

  // Dibujo del mando que se ilumina al pulsar (probador).
  _testerSvg() {
    const fb = (id, cx, cy, col, l) => `<g data-pad="${id}" class="gp-t gp-fb" style="--c:${col}"><circle cx="${cx}" cy="${cy}" r="12.5"/><circle class="gp-fb__hi" cx="${cx - 3.5}" cy="${cy - 4}" r="6"/><text x="${cx}" y="${cy + 5}" text-anchor="middle">${l}</text></g>`;
    const stick = (id, cx, cy) => `<circle class="gp-well" cx="${cx}" cy="${cy}" r="28"/><circle class="gp-well__in" cx="${cx}" cy="${cy}" r="24"/><g data-pad="${id}" class="gp-t gp-stk"><circle cx="${cx}" cy="${cy}" r="18"/><circle class="gp-stk__ring" cx="${cx}" cy="${cy}" r="12"/><circle class="gp-stk__ring" cx="${cx}" cy="${cy}" r="6"/></g>`;
    return `<svg class="gp-tester" viewBox="-190 -46 720 262" aria-hidden="true">
      <defs>
        <linearGradient id="gpBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5668"/><stop offset=".45" stop-color="#3a3644"/><stop offset="1" stop-color="#1f1c26"/></linearGradient>
        <linearGradient id="gpShoulder" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a6578"/><stop offset="1" stop-color="#37333f"/></linearGradient>
        <radialGradient id="gpCap" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#7a7487"/><stop offset="1" stop-color="#2c2933"/></radialGradient>
        <radialGradient id="gpHi" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse cx="180" cy="202" rx="110" ry="6" fill="rgba(0,0,0,.35)"/>
      <path data-pad="6" class="gp-t gp-t--r gp-trg" d="M 87 28 L 94 10 L 135 6 L 143 16 L 140 32 Z"/>
      <path data-pad="7" class="gp-t gp-t--r gp-trg" d="M 273 28 L 266 10 L 225 6 L 217 16 L 220 32 Z"/>
      <path data-pad="4" class="gp-t gp-t--r gp-bmp" d="M 79 58 L 86 40 L 111 33 L 146 36 L 150 50 L 116 50 L 98 68 Z"/>
      <path data-pad="5" class="gp-t gp-t--r gp-bmp" d="M 281 58 L 274 40 L 249 33 L 214 36 L 210 50 L 244 50 L 262 68 Z"/>
      <polygon class="gp-tester__body" points="110,56 143,46 182,43 220,47 250,55 290,90 308,167 298,200 268,199 249,177 230,160 130,161 113,180 89,202 62,197 52,169 71,92"/>
      <polyline class="gp-tester__shine" points="116,60 146,51 182,48 218,51 246,59"/>
      <path class="gp-tester__grip" d="M 70 186 L 82 150 L 89 124 M 290 186 L 278 150 L 271 124"/>
      ${stick(10, 122, 98)}
      ${stick(11, 215, 150)}
      <circle class="gp-well" cx="148" cy="146" r="30"/>
      <g class="gp-dp"><rect data-pad="12" class="gp-t gp-t--r" x="140" y="122" width="16" height="19" rx="3"/><rect data-pad="13" class="gp-t gp-t--r" x="140" y="151" width="16" height="19" rx="3"/><rect data-pad="14" class="gp-t gp-t--r" x="124" y="138" width="19" height="16" rx="3"/><rect data-pad="15" class="gp-t gp-t--r" x="153" y="138" width="19" height="16" rx="3"/><circle class="gp-dp__dot" cx="148" cy="146" r="4"/></g>
      <circle class="gp-well" cx="254" cy="94" r="38"/>
      ${fb(3, 254, 70, "#f0b429", "Y")}${fb(0, 254, 118, "#3fa34d", "A")}${fb(2, 230, 94, "#2f7fd6", "X")}${fb(1, 278, 94, "#d23b3b", "B")}
      <circle class="gp-logo" cx="180" cy="74" r="15"/><circle class="gp-logo__in" cx="180" cy="74" r="11"/>
      <circle data-pad="8" class="gp-t gp-t--r gp-mini" cx="159" cy="102" r="6.5"/><circle data-pad="9" class="gp-t gp-t--r gp-mini" cx="201" cy="102" r="6.5"/>
      ${this._labelsSvg()}
    </svg>`;
  },
  // Asignaciones SIEMPRE visibles sobre el dibujo del mando (pedido explícito:
  // "las asignaciones deberían mostrarse siempre, no solo cuando pulso sobre ellas").
  _labelsSvg() {
    const name = (btn) => {
      const a = GP_ACTIONS.find((x) => this.map[x.id] === btn);
      return a ? a.label : "";
    };
    // Todas las etiquetas quedan FUERA del dibujo del mando, unidas por una línea.
    // [botón, lado, y del texto, x destino del conector, y destino]
    const L = [
      [6, "l", 14, 92, 14], [4, "l", 46, 84, 48], [10, "l", 86, 98, 92], ["dp", "l", 146, 122, 146],
      [7, "r", 14, 262, 14], [5, "r", 46, 270, 48], [3, "r", 70, 268, 70], [1, "r", 94, 292, 94], [0, "r", 122, 268, 122], [11, "r", 150, 235, 150],
    ];
    let out = "";
    L.forEach(([btn, side, y, tx, ty]) => {
      const txt = btn === "dp" ? "Mover" : name(btn);
      if (!txt) return;
      const x = side === "l" ? -14 : 344;
      const anchor = side === "l" ? "end" : "start";
      const x1 = side === "l" ? -8 : 338;
      out += `<line class="gp-lbl__ln" x1="${x1}" y1="${y - 5}" x2="${tx}" y2="${ty}"/><text class="gp-lbl" x="${x}" y="${y}" text-anchor="${anchor}">${this._esc(txt)}</text>`;
    });
    // Botones centrales y X: línea vertical hacia arriba, texto sobre el mando.
    const top = (btn, bx, by, ty, tx, anchor) => {
      const t = name(btn);
      return t ? `<line class="gp-lbl__ln" x1="${bx}" y1="${by}" x2="${bx}" y2="${ty + 6}"/><text class="gp-lbl" x="${tx}" y="${ty}" text-anchor="${anchor}">${this._esc(t)}</text>` : "";
    };
    out += top(8, 159, 95, -8, 165, "end");
    out += top(2, 230, 80, -8, 224, "start");
    out += top(9, 201, 95, -34, 201, "middle");
    return out;
  },
  _paintTester(down, pad) {
    if (!this._pane || !this._pane.isConnected) return;
    const svg = this._pane.querySelector(".gp-tester");
    if (!svg || !svg.isConnected || !this._isVisible(svg)) return;
    const mix = (v) => { const a = [74, 70, 85], b = [255, 213, 74]; return "rgb(" + a.map((c, i) => Math.round(c + (b[i] - c) * v)).join(",") + ")"; };
    svg.querySelectorAll("[data-pad]").forEach((el) => {
      const id = +el.dataset.pad;
      let on = !!down[id];
      if (id === 10 || id === 11) {
        // Sticks: la tapa sigue al eje y se ilumina al moverlo o al pulsarlo.
        const x = this._axis(pad, id === 10 ? 0 : 2), y = this._axis(pad, id === 10 ? 1 : 3);
        const m = Math.min(1, Math.hypot(x, y));
        const k = m > 1 ? 1 / m : 1;
        el.style.transform = "translate(" + (x * k * 9).toFixed(1) + "px," + (y * k * 9).toFixed(1) + "px)";
        if (m > 0.2) on = true;
      } else if (id === 6 || id === 7) {
        // Gatillos analógicos: brillo proporcional a lo que se aprieta.
        const b = pad.buttons[id];
        const v = b ? Math.max(b.value || 0, b.pressed ? 1 : 0) : 0;
        el.style.fill = v > 0.04 ? mix(v) : "";
        on = v > 0.55;
      }
      el.classList.toggle("gp-t--on", on);
    });
  },
};

document.addEventListener("DOMContentLoaded", () => GamepadCtl.init());
