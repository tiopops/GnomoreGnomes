/* Gnomore Gnomes — modo de calibración del gnomo cogido, DENTRO de la
   propia interfaz real del juego (no en una página aparte): se activa
   añadiendo ?calibrarGnomo a la URL (p.ej. index.html?calibrarGnomo) y no
   hace nada en absoluto si ese parámetro no está — así el archivo puede
   vivir siempre cargado en index.html sin afectar a una partida normal.

   Por qué en la interfaz real y no en debug/calibrar-gnomo-posicion.html
   (la herramienta anterior): ahí el tamaño/zoom era una aproximación aparte
   del tablero real; aquí se ve y se arrastra el gnomo exactamente con el
   mismo tamaño en pantalla que verá cualquier jugador, sobre el tablero de
   verdad.

   Regla de oro: un archivo por mecánica. Este archivo no toca cómo se coge
   ni se pinta el gnomo — solo observa cuándo pasa (ver los dos avisos
   opcionales GnomeCalib.onAttach/onDetach en Gnome.attachTo/detachFrom,
   gnome.js) y, si está activo, hace que ese elemento ya existente se pueda
   arrastrar (mover) y redimensionar (una esquina), guardando cada ajuste
   por tipo de personaje. */

const GNOME_CALIB_STORAGE_KEY = "gnomore-gnomo-posicion-v1"; // mismo formato que la herramienta anterior
// Misma idea que GNOME_CALIB_STORAGE_KEY pero para la pose "machaca" (ver
// GNOME_ATTACH_OFFSETS_MACHACA, gnome.js) — clave DISTINTA a propósito: así
// los ajustes de la pose "iddle" ya guardados por partidas anteriores no se
// pisan ni se mezclan con los nuevos de "machaca".
const GNOME_CALIB_STORAGE_KEY_MACHACA = "gnomore-gnomo-posicion-machaca-v1";
const GNOME_CALIB_WIDTH_STORAGE_KEY = "gnomore-gnomo-tamano-cogido-v1";
const GNOME_CALIB_DEFAULTS = { right: -14, bottom: 6 };

const GnomeCalib = {
  active: false,
  pose: "idle", // "idle" | "machaca" — qué tabla se está editando ahora mismo (ver _togglePose)
  tuned: {}, // posición (right/bottom) pose "idle", UNA por tipo de personaje
  tunedMachaca: {}, // lo mismo para la pose "machaca"
  heldWidth: null, // tamaño cogido, UN SOLO valor compartido por todos los personajes y las dos poses
  currentUnit: null,
  currentGnome: null,
  handleEl: null,
  panelEl: null,
  panelValuesEl: null,
  drag: null, // { mode: 'move'|'resize', startX, startY, startRight, startBottom, startWidth, flipHeight, invertX }

  init() {
    this.active = /(?:^|[?&])calibrarGnomo(?:=|&|$)/.test(location.search);
    if (!this.active) return;
    this.tuned = this._load(GNOME_CALIB_STORAGE_KEY);
    this.tunedMachaca = this._load(GNOME_CALIB_STORAGE_KEY_MACHACA);
    this.heldWidth = this._loadWidth();
    document.addEventListener("DOMContentLoaded", () => this._ensurePanel());
  },

  _load(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch (e) {
      return {};
    }
  },

  _save() {
    try {
      localStorage.setItem(GNOME_CALIB_STORAGE_KEY, JSON.stringify(this.tuned));
      localStorage.setItem(GNOME_CALIB_STORAGE_KEY_MACHACA, JSON.stringify(this.tunedMachaca));
    } catch (e) {
      // no crítico — solo se pierde la persistencia entre recargas
    }
  },

  _loadWidth() {
    try {
      const raw = localStorage.getItem(GNOME_CALIB_WIDTH_STORAGE_KEY);
      return raw ? Number(raw) : null;
    } catch (e) {
      return null;
    }
  },

  _saveWidth() {
    try {
      localStorage.setItem(GNOME_CALIB_WIDTH_STORAGE_KEY, String(this.heldWidth));
    } catch (e) {
      // no crítico — solo se pierde la persistencia entre recargas
    }
  },

  // pose: "idle" (por defecto, comportamiento de siempre) o "machaca" — ver
  // cabecera del archivo y GNOME_ATTACH_OFFSETS_MACHACA en gnome.js.
  getOffset(typeId, pose) {
    const table = pose === "machaca" ? this.tunedMachaca : this.tuned;
    return table[typeId] || null;
  },

  // Tamaño cogido: siempre el mismo, sea cual sea el personaje que lo lleve
  // — si aún no se ha tocado el asa de redimensionar en esta sesión de
  // calibración, usa el tamaño fijo del código (GNOME_SIZES.held, gnome.js).
  getHeldWidth() {
    return this.heldWidth != null ? this.heldWidth : GNOME_SIZES.held;
  },

  _setOffset(typeId, offset, pose) {
    const table = pose === "machaca" ? this.tunedMachaca : this.tuned;
    table[typeId] = offset;
    this._save();
    this._updatePanelValues();
  },

  _setHeldWidth(width) {
    this.heldWidth = width;
    this._saveWidth();
    this._updatePanelValues();
  },

  // ---------- Enganche desde gnome.js ----------

  onAttach(unit, gnomeObj) {
    if (!this.active) return;
    this.currentUnit = unit;
    this.currentGnome = gnomeObj;
    this.pose = "idle"; // cada enganche real empieza siempre en la pose de reposo
    this._ensurePanel();
    this._ensureHandle(gnomeObj.attachEl);
    gnomeObj.attachEl.classList.add("gnome-attach--calibrating");
    this._showPanel();
  },

  onDetach() {
    if (!this.active) return;
    // Si se soltó mientras se previsualizaba la pose "machaca", devuelve al
    // personaje su sprite normal antes de perder la referencia — si no, se
    // quedaría con la pinta de "machacagnomos" para siempre tras soltar.
    if (this.pose === "machaca") this._togglePose();
    this.currentUnit = null;
    this.currentGnome = null;
    if (this.handleEl) {
      this.handleEl.remove();
      this.handleEl = null;
    }
    this._hidePanel();
  },

  // ---------- Alternar pose "iddle" / "machaca" ----------
  // Pedido explícito: la posición del gnomo cogido "tambien debe poder
  // ajustarse desde calibrar gnomo en esta posicion concreta [machaca]
  // ademas de en la de iddle para cada personaje". Cambia el sprite del
  // PERSONAJE (no el del gnomo) a su versión "machacagnomos" (con el mismo
  // relleno automático que en el juego real, ver Units.machacaSpriteFor) y
  // reposiciona el gnomo enganchado con la tabla de offsets de esa pose, así
  // se puede arrastrar/redimensionar exactamente igual que en modo "iddle".
  _togglePose() {
    if (!this.currentUnit || !this.currentGnome) return;
    this.pose = this.pose === "machaca" ? "idle" : "machaca";
    const typeId = this.currentUnit.typeId;
    const def = typeof UNIT_TYPES !== "undefined" ? UNIT_TYPES[typeId] : null;
    if (this.currentUnit.spriteEl && def) {
      this.currentUnit.spriteEl.src =
        this.pose === "machaca"
          ? typeof Units !== "undefined"
            ? Units.machacaSpriteFor(typeId)
            : def.spriteUrl
          : def.spriteUrl;
    }
    this.currentGnome.setAttachPose(this.currentUnit, this.pose);
    this._showPanel();
  },

  // ---------- Arrastrar para mover ----------

  _ensureHandle(attachEl) {
    if (this.handleEl) this.handleEl.remove();

    const handle = document.createElement("div");
    handle.className = "gnome-calib-handle";
    handle.title = "Arrastra para cambiar el tamaño";
    attachEl.appendChild(handle);
    this.handleEl = handle;

    attachEl.addEventListener("pointerdown", (e) => this._startDrag(e, "move"));
    handle.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this._startDrag(e, "resize");
    });
  },

  _startDrag(e, mode) {
    if (!this.currentUnit || !this.currentGnome) return;
    e.preventDefault();
    e.stopPropagation();

    const attachEl = this.currentGnome.attachEl;
    const flipRect = this.currentUnit.flipEl.getBoundingClientRect();
    const startRight = parseFloat(attachEl.style.right) || 0;
    const startBottomPct = parseFloat(attachEl.style.bottom) || 0;
    const startWidth = parseFloat(attachEl.style.width) || this.getHeldWidth();

    this.drag = {
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRight,
      startBottomPct,
      startWidth,
      flipHeight: flipRect.height || 1,
      // El contenedor real (unit__flip) se invierte con scaleX(-1) cuando el
      // personaje mira a la izquierda — arrastrar el ratón hacia la derecha
      // en PANTALLA debe seguir moviendo al gnomo hacia la derecha tal como
      // se ve, así que si está espejado hay que invertir el eje X antes de
      // aplicarlo a `right` (que vive en el espacio SIN espejar).
      invertX: this.currentUnit.facing === "left",
    };
    attachEl.classList.add("gnome-attach--dragging");
    attachEl.setPointerCapture(e.pointerId);

    const onMove = (ev) => this._onDragMove(ev);
    const onUp = (ev) => {
      attachEl.releasePointerCapture(ev.pointerId);
      attachEl.classList.remove("gnome-attach--dragging");
      attachEl.removeEventListener("pointermove", onMove);
      attachEl.removeEventListener("pointerup", onUp);
      attachEl.removeEventListener("pointercancel", onUp);
      this.drag = null;
      this._persistCurrent();
    };
    attachEl.addEventListener("pointermove", onMove);
    attachEl.addEventListener("pointerup", onUp);
    attachEl.addEventListener("pointercancel", onUp);
  },

  _onDragMove(e) {
    if (!this.drag || !this.currentGnome) return;
    const attachEl = this.currentGnome.attachEl;
    const d = this.drag;
    const dxScreen = e.clientX - d.startX;
    const dyScreen = e.clientY - d.startY;

    if (d.mode === "move") {
      const localDx = d.invertX ? -dxScreen : dxScreen;
      const newRight = Math.round(d.startRight - localDx);
      const newBottomPct = Math.round((d.startBottomPct - (dyScreen / d.flipHeight) * 100) * 10) / 10;
      attachEl.style.right = `${newRight}px`;
      attachEl.style.bottom = `${newBottomPct}%`;
    } else {
      // Redimensionar desde la esquina inferior derecha: arrastrar hacia
      // fuera (derecha/abajo, sin espejar — el asa vive dentro del propio
      // elemento ya orientado) agranda; hacia dentro, encoge. Este tamaño es
      // COMPARTIDO por todos los personajes (ver GNOME_SIZES.held en
      // gnome.js) — se puede ajustar mirando a cualquiera de ellos, pero se
      // aplica a todos por igual.
      const localDx = d.invertX ? -dxScreen : dxScreen;
      const newWidth = Math.max(16, Math.round(d.startWidth + localDx));
      attachEl.style.width = `${newWidth}px`;
    }
    this._updateLiveValues();
  },

  _persistCurrent() {
    if (!this.currentUnit || !this.currentGnome) return;
    const attachEl = this.currentGnome.attachEl;
    this._setOffset(
      this.currentUnit.typeId,
      {
        right: Math.round(parseFloat(attachEl.style.right) || 0),
        bottom: Math.round((parseFloat(attachEl.style.bottom) || 0) * 10) / 10,
      },
      this.pose
    );
    this._setHeldWidth(Math.round(parseFloat(attachEl.style.width) || this.getHeldWidth()));
  },

  // ---------- Panel flotante ----------

  _ensurePanel() {
    if (this.panelEl || !this.active) return;
    const panel = document.createElement("div");
    panel.className = "gnome-calib-panel";
    panel.innerHTML = `
      <div class="gnome-calib-panel__title">Calibrando: <span id="gnomeCalibCharName">—</span> <span id="gnomeCalibPoseName"></span></div>
      <div class="gnome-calib-panel__values" id="gnomeCalibValues">right — · bottom — · tamaño (compartido) —</div>
      <div class="gnome-calib-panel__hint">Arrastra el gnomo para moverlo (por personaje y por pose). Arrastra el puntito de su esquina para cambiar su tamaño — este es el MISMO para todos los personajes y las dos poses, se ajusta mirando a cualquiera.</div>
      <button class="gnome-calib-panel__copy" id="gnomeCalibPoseBtn">Ver pose: machacagnomos</button>
      <button class="gnome-calib-panel__copy" id="gnomeCalibCopyBtn">Copiar ajustes (GNOME_SIZES + GNOME_ATTACH_OFFSETS)</button>
      <span class="gnome-calib-panel__copied" id="gnomeCalibCopiedMsg">Copiado ✓</span>
    `;
    document.body.appendChild(panel);
    this.panelEl = panel;
    this.panelValuesEl = panel.querySelector("#gnomeCalibValues");

    panel.querySelector("#gnomeCalibCopyBtn").addEventListener("click", () => this._copy());
    panel.querySelector("#gnomeCalibPoseBtn").addEventListener("click", () => this._togglePose());
  },

  _showPanel() {
    if (!this.panelEl) return;
    this.panelEl.classList.add("gnome-calib-panel--visible");
    this.panelEl.querySelector("#gnomeCalibCharName").textContent =
      (UNIT_TYPES[this.currentUnit.typeId] && UNIT_TYPES[this.currentUnit.typeId].name) || this.currentUnit.typeId;
    this.panelEl.querySelector("#gnomeCalibPoseName").textContent =
      this.pose === "machaca" ? "(pose: machacagnomos)" : "(pose: iddle)";
    const poseBtn = this.panelEl.querySelector("#gnomeCalibPoseBtn");
    if (poseBtn) poseBtn.textContent = this.pose === "machaca" ? "Ver pose: iddle" : "Ver pose: machacagnomos";
    this._updateLiveValues();
  },

  _hidePanel() {
    if (this.panelEl) this.panelEl.classList.remove("gnome-calib-panel--visible");
  },

  _updateLiveValues() {
    if (!this.panelValuesEl || !this.currentGnome) return;
    const attachEl = this.currentGnome.attachEl;
    const right = Math.round(parseFloat(attachEl.style.right) || 0);
    const bottom = Math.round((parseFloat(attachEl.style.bottom) || 0) * 10) / 10;
    const width = Math.round(parseFloat(attachEl.style.width) || 0);
    this.panelValuesEl.textContent = `right ${right} · bottom ${bottom}% · tamaño (compartido) ${width}px`;
  },

  _updatePanelValues() {
    this._updateLiveValues();
  },

  // ---------- Copiar ----------

  _buildOutputText() {
    const lines = [
      "const GNOME_SIZES = {",
      `  ground: ${GNOME_SIZES.ground},`,
      `  flying: ${GNOME_SIZES.flying},`,
      `  held: ${this.getHeldWidth()},`,
      "};",
      "",
      "const GNOME_ATTACH_OFFSETS = {",
      `  default: { right: ${GNOME_CALIB_DEFAULTS.right}, bottom: ${GNOME_CALIB_DEFAULTS.bottom} },`,
    ];
    Object.keys(UNIT_TYPES).forEach((typeId) => {
      const v = this.tuned[typeId] || GNOME_CALIB_DEFAULTS;
      lines.push(`  ${typeId}: { right: ${v.right}, bottom: ${v.bottom} },`);
    });
    lines.push("};");
    lines.push("");
    lines.push("const GNOME_ATTACH_OFFSETS_MACHACA = {");
    lines.push(`  default: { right: ${GNOME_CALIB_DEFAULTS.right}, bottom: ${GNOME_CALIB_DEFAULTS.bottom} },`);
    Object.keys(UNIT_TYPES).forEach((typeId) => {
      const v = this.tunedMachaca[typeId];
      if (v) lines.push(`  ${typeId}: { right: ${v.right}, bottom: ${v.bottom} },`);
    });
    lines.push("};");
    return lines.join("\n");
  },

  async _copy() {
    const text = this._buildOutputText();
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // Sin permiso de portapapeles (frecuente si no es https) — se deja
      // seleccionable en un aviso para copiar a mano en su lugar.
      window.prompt("Copia este texto a mano (Ctrl+C):", text);
      return;
    }
    const msg = this.panelEl.querySelector("#gnomeCalibCopiedMsg");
    msg.classList.add("gnome-calib-panel__copied--visible");
    setTimeout(() => msg.classList.remove("gnome-calib-panel__copied--visible"), 1600);
  },
};

GnomeCalib.init();
