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

   Solo tiene sentido con un ratón real: en móvil/táctil no hay "mouseover
   sin clic" de verdad (mousemove: coarse), así que attach() no hace nada
   ahí — el pedido de "alternativa en móvil" es un ítem aparte del backlog
   (Bloque D), no este tooltip reciclado a la fuerza. */
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
    if (!this._isDesktopHover || !target) return;
    target.addEventListener("mouseenter", (e) => this._onEnter(e, label));
    target.addEventListener("mousemove", (e) => this._onMove(e));
    target.addEventListener("mouseleave", () => this._onLeave());
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
};
