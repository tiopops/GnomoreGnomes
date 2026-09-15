/* Gnomore Gnomes — cámara del tablero: zoom (rueda del ratón / pellizco táctil)
   y desplazamiento (arrastrar con ratón o con el dedo), con límites para no
   poder alejarse o desplazarse fuera del escenario.
   Regla de oro: un archivo por mecánica — esto solo controla la cámara del
   tablero, no genera ni pinta las losetas (eso vive en mapgen.js).
   Regla de oro: comodidad e intuitividad de controles en cualquier dispositivo
   (ratón, pantalla táctil) y nivel Triple A en la sensación de manejo. */

const BoardView = {
  viewportEl: null,
  cameraEl: null,

  scale: 1,
  minScale: 0.5,
  maxScale: 2.5,
  panX: 0,
  panY: 0,

  contentWidth: 0,
  contentHeight: 0,

  _dragState: null,
  _touchState: null,

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
    this.scale = 1;
    this._centerContent();
  },

  _centerContent() {
    if (!this.viewportEl) return;
    const vw = this.viewportEl.clientWidth;
    const vh = this.viewportEl.clientHeight;
    this.panX = (vw - this.contentWidth * this.scale) / 2;
    this.panY = (vh - this.contentHeight * this.scale) / 2;
    this._clampPan();
    this._apply();
  },

  _clampScale(scale) {
    return Math.min(this.maxScale, Math.max(this.minScale, scale));
  },

  _clampPan() {
    if (!this.viewportEl) return;
    const vw = this.viewportEl.clientWidth;
    const vh = this.viewportEl.clientHeight;
    const scaledW = this.contentWidth * this.scale;
    const scaledH = this.contentHeight * this.scale;

    const minX = Math.min(0, vw - scaledW);
    const maxX = Math.max(0, vw - scaledW);
    const minY = Math.min(0, vh - scaledH);
    const maxY = Math.max(0, vh - scaledH);

    this.panX = Math.min(maxX, Math.max(minX, this.panX));
    this.panY = Math.min(maxY, Math.max(minY, this.panY));
  },

  _apply() {
    this.cameraEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  },

  _zoomAt(cx, cy, factor) {
    const newScale = this._clampScale(this.scale * factor);
    if (newScale === this.scale) return;
    // Mantiene fijo bajo el cursor/dedos el punto de contenido que había ahí antes del zoom.
    const contentX = (cx - this.panX) / this.scale;
    const contentY = (cy - this.panY) / this.scale;
    this.scale = newScale;
    this.panX = cx - contentX * this.scale;
    this.panY = cy - contentY * this.scale;
    this._clampPan();
    this._apply();
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
      this.panX += dx;
      this.panY += dy;
      this._clampPan();
      this._apply();
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
            startScale: this.scale,
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
          this.panX += dx;
          this.panY += dy;
          this._clampPan();
          this._apply();
        } else if (this._touchState.mode === "pinch" && e.touches.length === 2) {
          const [t1, t2] = e.touches;
          const dist = touchDist(t1, t2);
          const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
          const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
          const factor = (dist / this._touchState.startDist) * (this._touchState.startScale / this.scale);
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

    // Si la ventana cambia de tamaño, reajustamos los límites de desplazamiento.
    window.addEventListener("resize", () => this._clampPan());
  },
};

document.addEventListener("DOMContentLoaded", () => BoardView.init());
