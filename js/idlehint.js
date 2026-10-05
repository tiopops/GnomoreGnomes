/* Gnomore Gnomes — aviso de unidades sin usar.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Medir cuánto lleva abierto el turno del jugador.
     - Pasados IDLE_HINT_MS (10 s), poner una flecha amarilla animada sobre la
       cabeza de cada unidad del jugador que NO está seleccionada y aún puede
       actuar (aunque ya haya gastado una acción, mientras le quede otra), y
       quitarla al instante en cuanto se la selecciona (o al terminar el turno
       / morir / quedarse sin acciones). Si se deselecciona, vuelve a salir. */
const IDLE_HINT_MS = 10000;

const IdleHint = {
  _key: null,
  _since: 0,
  _arrows: {}, // unitId -> elemento
  _timer: null,

  init() {
    this._timer = setInterval(() => this._tick(), 100);
  },

  _active() {
    return (
      typeof Turns !== "undefined" &&
      typeof Units !== "undefined" &&
      Units.container &&
      Units.list.length > 0 &&
      Turns.activeTeam === "player" &&
      !Turns._aiRunning &&
      !(typeof Tutorial !== "undefined" && Tutorial.active) &&
      document.getElementById("screen-board") &&
      document.getElementById("screen-board").classList.contains("screen--active")
    );
  },

  _tick() {
    if (!this._active()) {
      this._clear();
      this._key = null;
      return;
    }
    const key = `${Turns.roundNumber}`;
    if (key !== this._key) {
      this._key = key;
      this._since = Date.now();
      this._clear();
    }
    if (Date.now() - this._since < IDLE_HINT_MS) return;
    const unused = Units.list.filter((u) => u.team === "player" && u.el && u.id !== Units.selectedId && Turns.canAct(u));
    const ids = new Set(unused.map((u) => u.id));
    Object.keys(this._arrows).forEach((id) => {
      if (!ids.has(id)) this._remove(id);
    });
    unused.forEach((u) => this._place(u));
  },

  _place(u) {
    if (u.el.classList.contains("unit--fog-hidden")) return this._remove(u.id);
    let el = this._arrows[u.id];
    if (!el) {
      el = document.createElement("div");
      el.className = "idle-arrow";
      // Flecha irregular y angulosa, con el mismo trazo negro grueso y sombra dura
      // desplazada que los botones del juego (más grande que la anterior).
      el.innerHTML =
        '<svg viewBox="0 0 60 72" width="64" height="77" aria-hidden="true">' +
        '<path d="M17 3 L42 1 L39 27 L56 25 L33 69 L4 28 L19 29 Z" fill="rgba(20,10,30,.55)" transform="translate(4 4)"/>' +
        '<path d="M17 3 L42 1 L39 27 L56 25 L33 69 L4 28 L19 29 Z" fill="#ffcf3d" stroke="#000" stroke-width="4.5" stroke-linejoin="miter" stroke-miterlimit="3"/>' +
        '<path d="M22 8 L36 7 L33 31 L44 30 L33 55 Z" fill="#fff0a0" opacity=".75"/>' +
        '</svg>';
      Units.container.appendChild(el);
      this._arrows[u.id] = el;
    }
    const { x, y } = getTileCenter(u.row, u.col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y - 240}px`;
    el.style.zIndex = String((u.row + u.col) * 10 + 9);
  },

  _remove(id) {
    const el = this._arrows[id];
    if (el) el.remove();
    delete this._arrows[id];
  },

  _clear() {
    Object.keys(this._arrows).forEach((id) => this._remove(id));
  },
};

document.addEventListener("DOMContentLoaded", () => IdleHint.init());
