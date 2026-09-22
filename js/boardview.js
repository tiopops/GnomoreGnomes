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

// Desplazamiento con teclado (pedido explícito: "me gustaria que la camara
// pudiera moverse con las flechas del teclado y WASD") — cada tecla apunta
// a la dirección en la que se mueve la CÁMARA (lo que ve el jugador), no el
// contenido: por eso "derecha"/"flecha derecha" resta a panX (el contenido
// se desplaza a la izquierda para revelar lo que hay a la derecha), mismo
// criterio que cualquier editor/juego 2D con desplazamiento de cámara.
// Minúsculas siempre (e.key.toLowerCase()) para que sea indiferente a Bloq
// Mayús. Flechas y WASD comparten exactamente la misma dirección cada una.
const BOARD_PAN_KEYS = {
  arrowup: [0, 1],
  arrowdown: [0, -1],
  arrowleft: [1, 0],
  arrowright: [-1, 0],
  w: [0, 1],
  s: [0, -1],
  a: [1, 0],
  d: [-1, 0],
};

const BoardView = {
  viewportEl: null,
  cameraEl: null,

  // Rango de zoom acotado para que nunca se pueda alejar hasta perder de
  // vista el tablero. El límite superior está calculado a propósito para no
  // pasarse de la resolución real del arte de las losetas: se renderizan a
  // TILE_WIDTH=188px pero el archivo fuente mide 250px de ancho, así que
  // hasta 250/188 ≈ 1.33x todavía hay margen de sobra en la imagen; pasado
  // eso, el navegador tiene que ampliar la imagen más allá de su resolución
  // real y se ve borrosa. 1.3 se queda justo por debajo de ese límite.
  minScale: 0.6,
  maxScale: 1.3,

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

  // Mientras no sea null, el zoom en curso está "anclado" a un punto fijo del
  // contenido bajo el cursor/dedos (ver _zoomAt): el desplazamiento se deriva
  // de este ancla en cada frame en vez de perseguir su propio objetivo por
  // separado, para que el punto bajo el cursor no se mueva ni un pixel
  // mientras el zoom "alcanza" su valor final (aunque ese alcance sea lazy).
  _zoomAnchor: null,

  _dragState: null,
  _touchState: null,
  _rafId: null,

  // ---------- Desplazamiento con teclado (flechas/WASD) ----------
  // Velocidad en píxeles de PANTALLA por segundo (no de contenido): igual
  // de rápida se mueva la cámara esté como esté el zoom, igual que ya pasa
  // al arrastrar con el ratón (_panBy recibe deltas de pantalla tal cual).
  KEY_PAN_SPEED: 700,
  _keysPressed: null,
  _keyLoopId: null,
  _lastKeyFrameTime: 0,

  init() {
    this.viewportEl = document.getElementById("board-viewport");
    this.cameraEl = document.getElementById("board-camera");
    if (!this.viewportEl || !this.cameraEl) return;
    this._keysPressed = new Set();
    this._bindEvents();
    this._bindKeyboard();
  },

  /* Se llama cada vez que se genera/carga un escenario nuevo, con el tamaño
     real (en px) del contenido a mostrar, para poder centrarlo y calcular
     los límites de desplazamiento y zoom. */
  setContent(width, height) {
    this.contentWidth = width;
    this.contentHeight = height;
    this.targetScale = 1;
    this._zoomAnchor = null;
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

  // Límites de desplazamiento para una escala dada (no necesariamente la
  // mostrada ni la objetivo — el ancla de zoom los necesita para cualquier
  // escala intermedia mientras el zoom "alcanza" su valor final).
  _clampPanFor(x, y, scale) {
    const vw = this.viewportEl.clientWidth;
    const vh = this.viewportEl.clientHeight;
    const scaledW = this.contentWidth * scale;
    const scaledH = this.contentHeight * scale;

    const minX = Math.min(0, vw - scaledW);
    const maxX = Math.max(0, vw - scaledW);
    const minY = Math.min(0, vh - scaledH);
    const maxY = Math.max(0, vh - scaledH);

    return { x: Math.min(maxX, Math.max(minX, x)), y: Math.min(maxY, Math.max(minY, y)) };
  },

  _clampTargetPan() {
    if (!this.viewportEl) return;
    const { x, y } = this._clampPanFor(this.targetPanX, this.targetPanY, this.targetScale);
    this.targetPanX = x;
    this.targetPanY = y;
  },

  _apply() {
    this.cameraEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  },

  // Aplica el ancla de zoom activa (this._zoomAnchor) a una escala concreta:
  // recalcula el desplazamiento necesario para que el punto de contenido
  // anclado se quede exactamente bajo el cursor/dedos para ESA escala.
  // Se llama tanto con la escala mostrada (cada frame, mientras el zoom
  // "alcanza" su objetivo) como con la escala objetivo (para que el límite
  // final quede bien calculado desde el principio) — así el punto anclado
  // nunca se desplaza, solo crece/decrece con el zoom.
  _applyZoomAnchor(scale, isTarget) {
    if (!this._zoomAnchor) return;
    const rawX = this._zoomAnchor.screenX - this._zoomAnchor.contentX * scale;
    const rawY = this._zoomAnchor.screenY - this._zoomAnchor.contentY * scale;
    const { x, y } = this._clampPanFor(rawX, rawY, scale);
    if (isTarget) {
      this.targetPanX = x;
      this.targetPanY = y;
    } else {
      this.panX = x;
      this.panY = y;
    }
  },

  // Convierte un punto en coordenadas del VIEWPORT (relativas a su propia
  // esquina superior-izquierda, ver getBoundingClientRect) al espacio de
  // "contenido" — el mismo sistema de coordenadas que usa getTileCenter/
  // getTileFromPoint (mapgen.js), antes de aplicar el pan/zoom de la
  // cámara. Misma fórmula que ya usaba _zoomAt para anclar el punto bajo el
  // cursor al hacer zoom (contentX/contentY ahí abajo) — expuesta aquí como
  // método público para que cualquier mecánica que necesite saber "a qué
  // punto del mapa corresponde este clic de pantalla" (p.ej. la habilidad
  // Visión Lejana, js/abilities.js) no tenga que duplicar la cuenta ni
  // conocer panX/panY/scale por su cuenta.
  clientToContent(cx, cy) {
    return {
      x: (cx - this.panX) / this.scale,
      y: (cy - this.panY) / this.scale,
    };
  },

  _zoomAt(cx, cy, factor) {
    const newScale = this._clampScale(this.targetScale * factor);
    if (newScale === this.targetScale) return;
    // Ancla usando la escala/posición REALMENTE mostradas (no el objetivo):
    // así el punto de contenido que había bajo el cursor se queda fijo ahí
    // durante todo el "alcance" suavizado del zoom, no solo al final.
    this._zoomAnchor = {
      screenX: cx,
      screenY: cy,
      contentX: (cx - this.panX) / this.scale,
      contentY: (cy - this.panY) / this.scale,
    };
    this.targetScale = newScale;
    this._applyZoomAnchor(this.targetScale, true);
    this._startLoop();
  },

  _panBy(dx, dy) {
    // Un arrastre manual cancela cualquier ancla de zoom en curso: a partir
    // de ahora el desplazamiento lo controla el jugador, no el zoom.
    this._zoomAnchor = null;
    this.targetPanX += dx;
    this.targetPanY += dy;
    this._clampTargetPan();
    this._startLoop();
  },

  // Bucle de suavizado: en cada frame acerca el valor mostrado al objetivo.
  _startLoop() {
    if (this._rafId) return;
    const step = () => {
      const ds = this.targetScale - this.scale;
      const scaleDone = Math.abs(ds) < this.SETTLE_EPSILON_SCALE;
      this.scale = scaleDone ? this.targetScale : this.scale + ds * this.SCALE_EASE;

      if (this._zoomAnchor) {
        // Con un ancla de zoom activa, el desplazamiento no persigue su
        // propio objetivo por separado: se deriva directamente del ancla
        // para la escala mostrada de este frame, así el punto bajo el
        // cursor nunca "se reposiciona", solo acompaña al zoom.
        this._applyZoomAnchor(this.scale, false);
        this._applyZoomAnchor(this.targetScale, true);
        if (scaleDone) this._zoomAnchor = null;
      } else {
        const dx = this.targetPanX - this.panX;
        const dy = this.targetPanY - this.panY;
        this.panX = Math.abs(dx) < this.SETTLE_EPSILON ? this.targetPanX : this.panX + dx * this.PAN_EASE;
        this.panY = Math.abs(dy) < this.SETTLE_EPSILON ? this.targetPanY : this.panY + dy * this.PAN_EASE;
      }

      this._apply();

      const settled =
        scaleDone &&
        !this._zoomAnchor &&
        this.panX === this.targetPanX &&
        this.panY === this.targetPanY;

      if (settled) {
        this._rafId = null;
        return;
      }
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
      // BUG encontrado y corregido: "este error grafico aparece a veces,
      // es como si estuvieran seleccionados como texto" — sin esto, un
      // clic-y-arrastre normal para mover la cámara TAMBIÉN disparaba el
      // gesto nativo del navegador de seleccionar texto arrastrando (no
      // hay ningún texto de verdad bajo el cursor, pero el navegador igual
      // arranca una selección y la pinta como un rectángulo azul
      // translúcido encima de lo que haya debajo — una loseta, un gnomo...
      // ver también el user-select:none en .board-viewport, CSS, como
      // segunda barrera). preventDefault() en el propio mousedown ataja el
      // problema de raíz: nunca llega a iniciarse esa selección.
      e.preventDefault();
      this._dragState = { lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY };
      vp.classList.add("dragging");
    });

    // Bug reportado: "a veces seleccionar un jugador falla...hago clic
    // sobre el sprite y no lo escoge" — antes _dragMoved se marcaba a true
    // con el primer mousemove por mínimo que fuera (incluso 1px), algo que
    // pasa constantemente en un clic real y quieto (temblor natural de la
    // mano, más aún con trackpad); eso bastaba para que el bloqueo de
    // abajo (pensado solo para un arrastre de cámara de verdad) tratara
    // cualquier clic normal como si fuera el final de un arrastre y lo
    // anulara entero, incluso cayendo justo encima de un personaje. Ahora
    // hace falta superar un pequeño margen de tolerancia (en píxeles de
    // pantalla, medido desde el propio mousedown, no paso a paso) antes de
    // considerarlo un arrastre real — un clic con temblor normal nunca lo
    // alcanza, un arrastre de cámara de verdad lo supera enseguida.
    const DRAG_THRESHOLD_PX = 4;

    window.addEventListener("mousemove", (e) => {
      if (!this._dragState) return;
      const dx = e.clientX - this._dragState.lastX;
      const dy = e.clientY - this._dragState.lastY;
      this._dragState.lastX = e.clientX;
      this._dragState.lastY = e.clientY;
      // Bug encontrado y corregido: "arrastrar el escenario para mover la
      // cámara no deselecciona el personaje seleccionado" — el arrastre
      // termina en un mouseup sobre el propio #board-viewport, y ese
      // elemento también escucha "click" (ver units.js, deselecciona al
      // hacer clic en una casilla vacía). Soltar tras arrastrar SIGUE
      // disparando ese "click" nativo (mismo elemento en mousedown y
      // mouseup), así que sin esta marca cualquier arrastre de cámara
      // deseleccionaba al personaje como si hubiera sido un clic en vacío.
      // Solo se marca cuando el desplazamiento TOTAL desde el mousedown
      // (no el de este solo frame) supera el margen de tolerancia de
      // arriba — ver DRAG_THRESHOLD_PX.
      if (!this._dragMoved) {
        const totalDx = e.clientX - this._dragState.startX;
        const totalDy = e.clientY - this._dragState.startY;
        if (Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD_PX) this._dragMoved = true;
      }
      this._panBy(dx, dy);
    });

    window.addEventListener("mouseup", () => {
      if (!this._dragState) return;
      this._dragState = null;
      vp.classList.remove("dragging");
    });

    // Bloquea el "click" de deseleccionar (ver units.js) cuando en realidad
    // es el final de un arrastre de cámara, no un toque real sobre una
    // casilla vacía. capture:true para que se ejecute ANTES que el listener
    // de units.js, que está en fase de burbuja sobre este mismo elemento.
    vp.addEventListener(
      "click",
      (e) => {
        if (this._dragMoved) {
          e.stopImmediatePropagation();
          this._dragMoved = false;
        }
      },
      { capture: true }
    );

    // ---- Táctil: un dedo para desplazar, dos dedos (pellizco) para zoom ----
    const touchDist = (t1, t2) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    vp.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          this._touchState = { mode: "pan", lastX: t.clientX, lastY: t.clientY, startX: t.clientX, startY: t.clientY };
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
          // Mismo margen de tolerancia que el arrastre con ratón (ver
          // DRAG_THRESHOLD_PX más arriba) — un toque quieto con el dedo
          // también tiembla un poco, no cualquier movimiento cuenta como
          // arrastre real.
          if (!this._dragMoved) {
            const totalDx = t.clientX - this._touchState.startX;
            const totalDy = t.clientY - this._touchState.startY;
            if (Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD_PX) this._dragMoved = true;
          }
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

  // ---- Desplazamiento con teclado (flechas/WASD) ----
  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (!(key in BOARD_PAN_KEYS)) return;
      // No robar la tecla si el foco está en un campo de texto de verdad
      // (el juego no tiene ninguno ahora mismo, pero es la comprobación
      // estándar por si algún día lo hay) — así nunca compite con escribir.
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      this._keysPressed.add(key);
      this._startKeyboardLoop();
    });

    window.addEventListener("keyup", (e) => {
      this._keysPressed.delete(e.key.toLowerCase());
    });

    // Si la ventana/pestaña pierde el foco con una tecla a medio pulsar
    // (p.ej. Alt+Tab), sin este "soltar" a la fuerza la cámara se quedaría
    // desplazándose sola para siempre — el keyup real nunca llega a
    // disparase porque la tecla se soltó fuera de esta página.
    window.addEventListener("blur", () => this._keysPressed.clear());

    // Bucle propio (independiente del de suavizado de _startLoop): solo
    // corre mientras haya alguna tecla de desplazamiento pulsada, y en cada
    // fotograma llama a _panBy con la distancia de ESE fotograma (velocidad
    // constante en px/segundo, no en px/fotograma, para no depender de la
    // frecuencia de refresco de cada pantalla).
    this._startKeyboardLoop = () => {
      if (this._keyLoopId) return;
      this._lastKeyFrameTime = performance.now();
      const step = (now) => {
        if (this._keysPressed.size === 0) {
          this._keyLoopId = null;
          return;
        }
        // dt limitado a 100ms: si la pestaña estuvo un rato inactiva entre
        // dos fotogramas (p.ej. cambiando de ventana), evita un salto de
        // cámara enorme de golpe al volver.
        const dt = Math.min(now - this._lastKeyFrameTime, 100) / 1000;
        this._lastKeyFrameTime = now;

        let dx = 0;
        let dy = 0;
        this._keysPressed.forEach((key) => {
          const dir = BOARD_PAN_KEYS[key];
          if (!dir) return;
          dx += dir[0];
          dy += dir[1];
        });
        // Normalizado: dos teclas a la vez (p.ej. W+D, diagonal) no deben
        // moverse más rápido que una sola por ir sumando componentes.
        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy);
          const dist = this.KEY_PAN_SPEED * dt;
          this._panBy((dx / len) * dist, (dy / len) * dist);
        }

        this._keyLoopId = requestAnimationFrame(step);
      };
      this._keyLoopId = requestAnimationFrame(step);
    };
  },
};

document.addEventListener("DOMContentLoaded", () => BoardView.init());
