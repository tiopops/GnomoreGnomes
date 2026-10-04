/* Gnomore Gnomes — aviso de unidades sin usar.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - Medir cuánto lleva abierto el turno del jugador.
     - Pasados IDLE_HINT_MS (10 s), poner una flecha amarilla animada sobre la
       cabeza de cada unidad del jugador que aún no ha usado ninguna acción,
       y quitarla en cuanto la usa (o al terminar el turno / morir). */
const IDLE_HINT_MS = 10000;

const IdleHint = {
  _key: null,
  _since: 0,
  _arrows: {}, // unitId -> elemento
  _timer: null,

  init() {
    this._timer = setInterval(() => this._tick(), 250);
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
    const unused = Units.list.filter((u) => u.team === "player" && u.el && !(Turns.actionsUsed[u.id] > 0) && Turns.canAct(u));
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
      el.innerHTML =
        '<svg viewBox="0 0 40 46" width="44" height="50" aria-hidden="true"><path d="M12 2h16v18h9L20 43 3 20h9z" fill="#ffcf3d" stroke="#000" stroke-width="3.5" stroke-linejoin="round"/></svg>';
      Units.container.appendChild(el);
      this._arrows[u.id] = el;
    }
    const { x, y } = getTileCenter(u.row, u.col, Units.boardSize);
    el.style.left = `${x}px`;
    el.style.top = `${y - 150}px`;
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
