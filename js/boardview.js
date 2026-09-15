/* Gnomore Gnomes — cámara del tablero: zoom (rueda del ratón / pellizco táctil)
   y desplazamiento (arrastrar con ratón o con el dedo), con límites para no
   poder alejarse o desplazarse fuera del escenario.
   Regla de oro: un archivo por mecánica — esto solo controla la cámara del
   tablero, no genera ni pinta las losetas (eso vive en mapgen.js).
   Regla de oro: comodidad e intuitividad de controles en cualquier dispositivo
   (ratón, pantalla táctil) y nivel Triple A en la sensación de manejo.

   La cámara funciona con un valor "objetivo" (target) que se actualiza al
   instante con cada gesto, y un valor "mostrado" que persigue a ese objetivo
   con una pequeña suavización (lerp) en cada frame — así el movimiento de la
   cámara se siente suave y ligeramente "lazy" en vez de saltar de golpe. */

const BoardView = {
  viewportEl: null,
  cameraEl: null,

  minScale: 0.5,
  maxScale: 2.5,

  // Valores objetivo: a dónde tiene que llegar la cámara.
  targetScale: 1,
  targetPanX: 0,
  targetPanY: 0,

  // Valores mostrados: lo que realmente se pinta, persiguiendo al objetivo.
  scale: 1,
  panX: 0,
  panY: 0,

  // Cuanto más bajo, más "lazy"/suave; cuanto más alto, más directo/inmediato.
  // El zoom usa un valor más bajo que el desplazamiento porque, al ser un
  // cambio de escala mucho más pequeño en números, con el mismo suavizado
  // que el desplazamiento apenas se notaba el "retraso" — así se percibe
  // igual de lazy que arrastrar.
  PAN_EASE: 0.2,
  SCALE_EASE: 0.1,
  SETTLE_EPSILON: 0.02,
  SETTLE_EPSILON_SCALE: 0.0005,

  contentWidth: 0,
  contentHeight: 0,

  _dragState: null,
  _touchState: null,
  _rafId: null,

  init() {
    this.viewportEl = document.getElementById("board-viewport");
    this.cameraEl = document.getElementById("board-camera");
    if (!this.viewportEl || !this.cameraEl) return;
    this._bindEvents();
  },

  /* Se llama cada vez que se genera/carga un escenario nuevo, con el tamaño
     real (en px) del contenido a mostrar, para poder centrarlo y calcular
     los límites de desplazamiento y zoom. */
  setContent(width, height) {
    this.contentWidth = width;
    this.contentHeight = height;
    this.targetScale = 1;
    this._centerContent();
  },

  // Centra el contenido y, a diferencia de un gesto del jugador, lo hace
  // al instante (sin suavizado) para que la pantalla no empiece "flotando".
  _centerContent() {
    if (!this.viewportEl) return;
    const vw = this.viewportEl.clientWidth;
    const vh = this.viewportEl.clientHeight;
    this.targetPanX = (vw - this.contentWidth * this.targetScale) / 2;
    this.targetPanY = (vh - this.contentHeight * this.targetScale) / 2;
    this._clampTargetPan();
    this.scale = this.targetScale;
    this.panX = this.targetPanX;
    this.panY = this.targetPanY;
    this._apply();
  },

  _clampScale(scale) {
    return Math.min(this.maxScale, Math.max(this.minScale, scale));
  },

  _clampTargetPan() {
    if (!this.viewportEl) return;
    const vw = this.viewportEl.clientWidth;
    const vh = this.viewportEl.clientHeight;
    const scaledW = this.contentWidth * this.targetScale;
    const scaledH = this.contentHeight * this.targetScale;

    const minX = Math.min(0, vw - scaledW);
    const maxX = Math.max(0, vw - scaledW);
    const minY = Math.min(0, vh - scaledH);
    const maxY = Math.max(0, vh - scaledH);

    this.targetPanX = Math.min(maxX, Math.max(minX, this.targetPanX));
    this.targetPanY = Math.min(maxY, Math.max(minY, this.targetPanY));
  },

  _apply() {
    this.cameraEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  },

  _zoomAt(cx, cy, factor) {
    const newScale = this._clampScale(this.targetScale * factor);
    if (newScale === this.targetScale) return;
    // Mantiene fijo bajo el cursor/dedos el punto de contenido que había ahí antes del zoom.
    const contentX = (cx - this.targetPanX) / this.targetScale;
    const contentY = (cy - this.targetPanY) / this.targetScale;
    this.targetScale = newScale;
    this.targetPanX = cx - contentX * this.targetScale;
    this.targetPanY = cy - contentY * this.targetScale;
    this._clampTargetPan();
    this._startLoop();
  },

  _panBy(dx, dy) {
    this.targetPanX += dx;
    this.targetPanY += dy;
    this._clampTargetPan();
    this._startLoop();
  },

  // Bucle de suavizado: en cada frame acerca el valor mostrado al objetivo.
  _startLoop() {
    if (this._rafId) return;
    const step = () => {
      const dx = this.targetPanX - this.panX;
      const dy = this.targetPanY - this.panY;
      const ds = this.targetScale - this.scale;

      if (
        Math.abs(dx) < this.SETTLE_EPSILON &&
        Math.abs(dy) < this.SETTLE_EPSILON &&
        Math.abs(ds) < this.SETTLE_EPSILON_SCALE
      ) {
        this.panX = this.targetPanX;
        this.panY = this.targetPanY;
        this.scale = this.targetScale;
        this._apply();
        this._rafId = null;
        return;
      }

      this.panX += dx * this.PAN_EASE;
      this.panY += dy * this.PAN_EASE;
      this.scale += ds * this.SCALE_EASE;
      this._apply();
      this._rafId = requestAnimationFrame(step);
    };
    this._rafId = requestAnimationFrame(step);
  },

  _bindEvents() {
    const vp = this.viewportEl;
    vp.style.touchAction = "none";

    // ---- Zoom con la rueda del ratón ----
    vp.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = vp.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.0015);
        this._zoomAt(cx, cy, factor);
      },
      { passive: false }
    );

    // ---- Arrastrar con el ratón (clic y arrastrar) ----
    vp.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      this._dragState = { lastX: e.clientX, lastY: e.clientY };
      vp.classList.add("dragging");
    });

    window.addEventListener("mousemove", (e) => {
      if (!this._dragState) return;
      const dx = e.clientX - this._dragState.lastX;
      const dy = e.clientY - this._dragState.lastY;
      this._dragState.lastX = e.clientX;
      this._dragState.lastY = e.clientY;
      this._panBy(dx, dy);
    });

    window.addEventListener("mouseup", () => {
      if (!this._dragState) return;
      this._dragState = null;
      vp.classList.remove("dragging");
    });

    // ---- Táctil: un dedo para desplazar, dos dedos (pellizco) para zoom ----
    const touchDist = (t1, t2) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    vp.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          this._touchState = { mode: "pan", lastX: t.clientX, lastY: t.clientY };
        } else if (e.touches.length === 2) {
          const [t1, t2] = e.touches;
          this._touchState = {
            mode: "pinch",
            startDist: touchDist(t1, t2),
            startScale: this.targetScale,
          };
        }
      },
      { passive: false }
    );

    vp.addEventListener(
      "touchmove",
      (e) => {
        if (!this._touchState) return;
        e.preventDefault();
        const rect = vp.getBoundingClientRect();

        if (this._touchState.mode === "pan" && e.touches.length === 1) {
          const t = e.touches[0];
          const dx = t.clientX - this._touchState.lastX;
          const dy = t.clientY - this._touchState.lastY;
          this._touchState.lastX = t.clientX;
          this._touchState.lastY = t.clientY;
          this._panBy(dx, dy);
        } else if (this._touchState.mode === "pinch" && e.touches.length === 2) {
          const [t1, t2] = e.touches;
          const dist = touchDist(t1, t2);
          const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
          const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
          const factor = (dist / this._touchState.startDist) * (this._touchState.startScale / this.targetScale);
          this._zoomAt(midX, midY, factor);
        }
      },
      { passive: false }
    );

    vp.addEventListener("touchend", (e) => {
      if (e.touches.length === 0) {
        this._touchState = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        this._touchState = { mode: "pan", lastX: t.clientX, lastY: t.clientY };
      }
    });

    // Si la ventana cambia de tamaño, reajustamos los límites de desplazamiento
    // al instante (no es un gesto del jugador, no necesita suavizado).
    window.addEventListener("resize", () => {
      this._clampTargetPan();
      this.panX = this.targetPanX;
      this.panY = this.targetPanY;
      this._apply();
    });
  },
};

document.addEventListener("DOMContentLoaded", () => BoardView.init());
