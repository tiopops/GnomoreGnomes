/* Gnomore Gnomes — tooltip de escritorio (Tooltip). Pedido explícito: "en la
   interfaz de navegador de escritorio al colocar el raton y dejarlo quieto
   (mouseover de toda la vida) sobre cualquier habilidad de un personaje,
   debe aparecer al lado del puntero un texto con el nombre de esa
   habilidad (ejemplo: lanzar gnomo)".

   Un único elemento flotante reutilizado (mismo patrón "crear una vez" que
   UiHint/#epic-smash-flash), pegado al cursor mientras el ratón se queda
   quieto sobre un botón con tooltip "enganchado" (ver attach). Un pequeño
   retraso (450ms) evita que aparezca solo con pasar de largo — tiene que
   "dejarse quieto", no solo tocar el icono de refilón.

   En móvil/táctil no hay "mouseover sin clic" de verdad (mousemove:
   coarse), así que la parte de arriba (mouseenter/mousemove/mouseleave)
   no sirve ahí. Pedido explícito: "¿Es posible una alternativa o
   adaptación del mouseover en la interfaz móvil?" — la alternativa es
   "mantener pulsado": un dedo quieto sobre el botón el mismo tiempo que el
   ratón (ver HOLD_MS) muestra la misma pista flotante reciclada, pegada al
   dedo pero por ENCIMA de él (si no, el propio dedo la taparía). Soltar
   después de que la pista ya apareció se trata como "solo quería ver qué
   es" y se cancela el click que el navegador dispara justo después del
   touchend — si no se cancelara, mantener pulsado para leer la pista
   también dispararía la habilidad/acción del botón, que no es lo que pide
   un mantener-pulsado. Un toque normal (más corto que HOLD_MS, o que se
   mueve el dedo) nunca llega a mostrar la pista y el click sigue
   disparándose tal cual, sin ningún cambio de comportamiento. */
const Tooltip = {
  el: null,
  _timer: null,
  _isDesktopHover: window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches,

  _ensure() {
    if (this.el) return;
    const el = document.createElement("div");
    el.className = "gg-tooltip";
    document.body.appendChild(el);
    this.el = el;
  },

  // `label` puede ser un string fijo o una función que se evalúa cada vez
  // (para botones cuyo texto cambia, p.ej. el de habilidad especial, que
  // muestra una habilidad distinta según el personaje seleccionado).
  attach(target, label) {
    if (!target) return;
    if (this._isDesktopHover) {
      target.addEventListener("mouseenter", (e) => this._onEnter(e, label));
      target.addEventListener("mousemove", (e) => this._onMove(e));
      target.addEventListener("mouseleave", () => this._onLeave());
    }
    this._attachTouch(target, label);
  },

  // Bloque D del backlog — ver la nota larga de arriba. HOLD_MS coincide
  // a propósito con el retraso de 450ms del hover de escritorio (misma
  // sensación de "quedarse quieto un momento" en los dos casos).
  _attachTouch(target, label) {
    const HOLD_MS = 450;
    const MOVE_TOLERANCE = 10;
    let timer = null;
    let startX = 0;
    let startY = 0;
    let shown = false;

    const cancelTimer = () => {
      clearTimeout(timer);
      timer = null;
    };
    const hide = () => {
      shown = false;
      this._onLeave();
    };

    target.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        shown = false;
        cancelTimer();
        timer = setTimeout(() => {
          const text = typeof label === "function" ? label() : label;
          if (!text) return;
          this._ensure();
          this.el.textContent = text;
          // Por encima del dedo y centrada (no al lado del cursor como en
          // escritorio, aquí no hay cursor): un dedo real taparía la pista
          // si se colocara debajo o al lado, como sí puede hacerse con el
          // ratón — ver _positionAbove, un cálculo de posición aparte de
          // _position (que está pensado para ir junto a un puntero real).
          this._positionAbove(startX, startY);
          this.el.classList.add("gg-tooltip--visible");
          shown = true;
        }, HOLD_MS);
      },
      { passive: true }
    );

    target.addEventListener(
      "touchmove",
      (e) => {
        if (!e.touches || !e.touches.length) return;
        const t = e.touches[0];
        if (Math.abs(t.clientX - startX) > MOVE_TOLERANCE || Math.abs(t.clientY - startY) > MOVE_TOLERANCE) {
          cancelTimer();
          if (shown) hide();
        }
      },
      { passive: true }
    );

    let suppressClick = false;
    target.addEventListener("touchend", (e) => {
      cancelTimer();
      if (shown) {
        hide();
        // Ver nota de arriba: se cancela el click de toda la vida que el
        // navegador dispara tras este touchend, porque el usuario solo
        // quería leer la pista, no activar el botón.
        suppressClick = true;
        e.preventDefault();
      }
    });
    target.addEventListener("touchcancel", () => {
      cancelTimer();
      if (shown) hide();
    });
    target.addEventListener(
      "click",
      (e) => {
        if (!suppressClick) return;
        suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      },
      true
    );
  },

  _onEnter(e, label) {
    clearTimeout(this._timer);
    const point = { x: e.clientX, y: e.clientY };
    this._timer = setTimeout(() => {
      const text = typeof label === "function" ? label() : label;
      if (!text) return;
      this._ensure();
      this.el.textContent = text;
      this._position(point.x, point.y);
      this.el.classList.add("gg-tooltip--visible");
    }, 450);
  },

  _onMove(e) {
    if (this.el && this.el.classList.contains("gg-tooltip--visible")) this._position(e.clientX, e.clientY);
  },

  _onLeave() {
    clearTimeout(this._timer);
    if (this.el) this.el.classList.remove("gg-tooltip--visible");
  },

  _position(x, y) {
    if (!this.el) return;
    this.el.style.left = `${x + 20}px`;
    this.el.style.top = `${y + 6}px`;
  },

  // Ver _attachTouch: centrada horizontalmente sobre el punto de toque y
  // 54px por encima (el dedo cubre unos 30-40px de pantalla al pulsar, así
  // que se deja margen de sobra para que no tape ni el borde inferior).
  _positionAbove(x, y) {
    if (!this.el) return;
    const width = this.el.offsetWidth;
    const clampedX = Math.max(width / 2 + 8, Math.min(window.innerWidth - width / 2 - 8, x));
    this.el.style.left = `${clampedX - width / 2}px`;
    this.el.style.top = `${y - 54}px`;
  },
};
