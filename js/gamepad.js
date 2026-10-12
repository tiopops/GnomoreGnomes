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
  { id: "actions", label: "Acciones", def: 2 },
  { id: "endTurn", label: "Fin de turno", def: 3 },
  { id: "prevUnit", label: "Anterior", def: 4 },
  { id: "nextUnit", label: "Siguiente", def: 5 },
  { id: "zoomOut", label: "Alejar cámara", def: 6 },
  { id: "zoomIn", label: "Acercar cámara", def: 7 },
  { id: "center", label: "Centrar cámara", def: 10 },
  { id: "toObelisk", label: "Ir a mi Obelisco", def: 11 },
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
  { sel: ".settings-gear-btn--account", icon: "ph-fill ph-user", label: () => "Cuenta" },
  { sel: ".settings-gear-btn:not(.settings-gear-btn--account)", icon: "ph-fill ph-gear", label: () => "Ajustes" },
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
  },

  _loadPrefs() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(GP_STORE_MAP) || "{}") || {}; } catch (e) {}
    this.map = {};
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
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].connected) return list[i];
    return null;
  },
  _onConnect(pad) {
    if (this.connected) return;
    this.connected = true;
    this.padName = (pad && pad.id ? pad.id : "Mando").replace(/\s*\(.*$/, "");
    this._prev = {};
    this._last = performance.now();
    this._toast("Mando conectado", "ph-fill ph-game-controller");
    this._refreshPane();
    if (!this._raf) this._raf = requestAnimationFrame((t) => this._loop(t));
  },
  _onDisconnect() {
    if (this._getPad()) return;
    this.connected = false;
    this._setActive(false);
    this._toast("Mando desconectado", "ph-fill ph-game-controller");
    this._refreshPane();
    this._updateHints(true);
  },
  _setActive(v) {
    if (this.active === v) return;
    this.active = v;
    if (!v) {
      this._ringEl && this._ringEl.classList.remove("gp-focus--on");
      this._cursorEl && this._cursorEl.classList.remove("gp-tile--on");
    }
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
    // Tecla del probador (pestaña Mando).
    this._paintTester(down, pad);
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
    if (!dx && !dy && ls.m > 0.55) {
      const a = Math.atan2(ls.y, ls.x);
      const s = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
      dx = Math.round(Math.cos(s));
      dy = Math.round(Math.sin(s));
      fromStick = true;
    }
    const key = dx + "," + dy;
    if (!dx && !dy) {
      this._rep.key = "";
    } else if (key !== this._rep.key) {
      this._rep.key = key;
      this._rep.next = now + (fromStick ? 300 : 380);
      this._dir(dx, dy);
    } else if (now >= this._rep.next) {
      this._rep.next = now + (fromStick ? 150 : 120);
      this._dir(dx, dy);
    }

    // Analógico: cámara (stick derecho), zoom (gatillos) y scroll en ventanas.
    const mode = this._mode(now);
    if (mode.type === "board") {
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
    if (!this._modeCache || this._modeCache.root !== mode.root) this._focusEl = null;
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
    this._mouse("pointerup", p.el, p.x, p.y);
    this._mouse("mouseup", p.el, p.x, p.y);
    this._mouse("click", p.el, p.x, p.y);
  },
  _clickNow(el) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
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
      else if (act === "actions") this._kbType(" ");
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
    }
  },
  _uiBack(mode) {
    const root = mode.root;
    if (!root) return;
    if (root.classList.contains("gp-actions")) { this._closeActions(); return; }
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
  _uiTab(mode, dir) {
    const root = mode.root;
    if (!root) return;
    const tabs = [...root.querySelectorAll(".skills-tab, .account-tab, .settings-tab")].filter((t) => this._isVisible(t));
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
  _ensureFocus(mode) {
    if (this._focusEl && this._focusEl.isConnected && this._isVisible(this._focusEl) && mode.root.contains(this._focusEl)) return this._focusEl;
    const list = this._candidates(mode);
    if (!list.length) return null;
    const notClose = list.filter((el) => !el.matches(".backpack-close-btn, .back-btn, [data-back]"));
    const pool = notClose.length ? notClose : list;
    pool.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.top - rb.top || ra.left - rb.left;
    });
    // En ventanas con pestañas, empieza en la pestaña activa.
    const act = pool.find((el) => /active/.test(el.className) && /tab/.test(el.className));
    this._focusEl = act || pool[0];
    return this._focusEl;
  },
  _dir(dx, dy) {
    const mode = this._mode(performance.now());
    if (this._listening) return;
    if (mode.type === "ui") this._uiMove(mode, dx, dy);
    else this._boardMove(dx, dy);
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
      if (dx) { main = vx * dx; perp = Math.abs(vy); overlap = b.top < a.bottom && b.bottom > a.top; }
      else { main = vy * dy; perp = Math.abs(vx); overlap = b.left < a.right && b.right > a.left; }
      if (main < 2) return;
      if (perp > main * 3 && !overlap) return;
      const score = main + perp * (overlap ? 0.4 : 2.2);
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      this._focusEl = best;
      best.scrollIntoView({ block: "nearest", inline: "nearest" });
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
    this._cursorEl.style.zIndex = String((this._tile.row + this._tile.col) * 10 + 4000);
  },
  _boardMove(dx, dy) {
    if (!this._ensureCursor()) return;
    const size = this._size();
    const halfW = 94;
    const halfH = 58.5;
    const want = Math.hypot(dx * halfW, dy * halfH) || 1;
    let best = null;
    let bestDot = 0.6;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const sx = (dc - dr) * halfW;
        const sy = (dc + dr) * halfH;
        const dot = (sx * dx * halfW + sy * dy * halfH) / ((Math.hypot(sx, sy) || 1) * want);
        const nr = this._tile.row + dr;
        const nc = this._tile.col + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        if (dot > bestDot) { bestDot = dot; best = { row: nr, col: nc }; }
      }
    }
    if (!best) return;
    this._tile = best;
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
  _boardAction(act) {
    if (act === "confirm") { this._activateTile(); return; }
    if (act === "back") { this._cancel(); return; }
    if (act === "actions") { this._openActions(); return; }
    if (act === "endTurn") {
      const b = document.querySelector(".end-turn-btn--visible");
      if (b && !b.classList.contains("end-turn-btn--thinking")) this._clickNow(b);
      return;
    }
    if (act === "prevUnit") { this._cycleUnit(-1); return; }
    if (act === "nextUnit") { this._cycleUnit(1); return; }
    if (act === "center") { if (this._ensureCursor()) this._follow(true); return; }
    if (act === "toObelisk") {
      const ob = typeof Obelisks !== "undefined" ? Obelisks.byTeam("player") : null;
      if (ob && this._ensureCursor()) { this._tile = { row: ob.row, col: ob.col }; this._placeCursor(); this._follow(true); }
      return;
    }
    if (act === "glory") { if (typeof Glory !== "undefined" && Glory.openPopup) Glory.openPopup(); return; }
    if (act === "settings") { if (typeof SettingsMenu !== "undefined") SettingsMenu.open(); return; }
  },
  _cancel() {
    if (typeof Abilities !== "undefined" && Abilities._cancelTargeting) { try { Abilities._cancelTargeting(); } catch (e) {} }
    if (typeof Units !== "undefined") Units.deselect();
    if (typeof Obelisks !== "undefined") Obelisks.deselect();
    if (typeof Villages !== "undefined") Villages.deselect();
    if (typeof Gnome !== "undefined" && Gnome.hideAllBadges) Gnome.hideAllBadges();
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
  _frame(now, mode) {
    this._ensureVisuals();
    // Anillo de foco en menús/ventanas.
    if (mode.type === "ui" && this.active) {
      const el = this._ensureFocus(mode);
      if (el && this._isVisible(el)) {
        const r = el.getBoundingClientRect();
        const s = this._ringEl.style;
        s.left = r.left - 7 + "px";
        s.top = r.top - 7 + "px";
        s.width = r.width + 14 + "px";
        s.height = r.height + 14 + "px";
        this._ringEl.classList.add("gp-focus--on");
      } else this._ringEl.classList.remove("gp-focus--on");
      this._cursorEl && this._cursorEl.classList.remove("gp-tile--on");
    } else {
      this._ringEl.classList.remove("gp-focus--on");
      if (mode.type === "board" && this.active && this._ensureCursor()) {
        this._placeCursor();
        this._cursorEl.classList.add("gp-tile--on");
      } else this._cursorEl && this._cursorEl.classList.remove("gp-tile--on");
    }
    this._updateHints(false, mode, now);
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
    const show = this.connected && this.hints;
    if (!show) {
      this._barEl.classList.remove("gp-hints--on");
      this._badgeEls.forEach((b) => (b.style.display = "none"));
      return;
    }
    mode = mode || this._mode(performance.now());
    // Barra inferior contextual.
    let items;
    if (mode.type === "ui" && mode.root && mode.root.classList.contains("gp-kb")) {
      items = [["confirm", "Escribir"], ["back", "Cerrar"], ["actions", "Espacio"], ["endTurn", "Borrar"], ["settings", "Aceptar"], ["prevUnit", "◂ Cursor"], ["nextUnit", "Cursor ▸"]];
    } else if (mode.type === "ui") {
      items = [["confirm", "Aceptar"], ["back", "Atrás"]];
      if (mode.root && mode.root.querySelectorAll(".skills-tab, .account-tab, .settings-tab").length > 1) items.push(["prevUnit", "◂ Pestaña"], ["nextUnit", "Pestaña ▸"]);
      items.push(["__dpad", "Mover"]);
    } else {
      const sel = typeof Units !== "undefined" && Units.selectedId;
      items = sel
        ? [["confirm", "Mover / Actuar"], ["back", "Cancelar"], ["actions", "Acciones"], ["endTurn", "Fin de turno"], ["prevUnit", "◂ Unidad"], ["nextUnit", "Unidad ▸"]]
        : [["confirm", "Seleccionar"], ["actions", "Cuenta"], ["prevUnit", "◂ Unidad"], ["nextUnit", "Unidad ▸"], ["endTurn", "Fin de turno"]];
    }
    const key = items.map((x) => x[0] + this.map[x[0]]).join("|") + I18N.currentLang + mode.type;
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
      const tabs = [...mode.root.querySelectorAll(".skills-tab, .account-tab, .settings-tab")].filter((t) => this._isVisible(t));
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
      <button type="button" class="p5-banner p5-banner--action settings-panel__option settings-panel__option--toggle gp-hintsbtn" style="--p5-tone:#2b2733">
        <span class="settings-panel__option-main"><i class="ph ph-question settings-panel__option-icon"></i><span class="p5-banner__label">Ayudas del mando</span></span>
        <span class="settings-toggle" data-checked="${this.hints}"><i class="ph ph-check settings-toggle__check"></i></span>
      </button>
      ${this._testerSvg()}
      <div class="gp-sec">Controles</div>
      <div class="gp-map">${rows}</div>
      <div class="gp-note">Cruceta o stick izquierdo: mover cursor y navegar. Stick derecho: cámara.</div>
      <button type="button" class="p5-banner p5-banner--action gp-reset" style="--p5-tone:#5a1d1d"><span class="p5-banner__label">Restablecer</span></button>`;
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
    return `<svg class="gp-tester" viewBox="0 0 360 214" aria-hidden="true">
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
    </svg>`;
  },
  _paintTester(down, pad) {
    if (!this._pane || !this._pane.isConnected) return;
    const svg = this._pane.querySelector(".gp-tester");
    if (!svg || !svg.isConnected || !this._isVisible(svg)) return;
    svg.querySelectorAll("[data-pad]").forEach((el) => el.classList.toggle("gp-t--on", !!down[+el.dataset.pad]));
  },
};

document.addEventListener("DOMContentLoaded", () => GamepadCtl.init());
