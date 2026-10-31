/* Gnomore Gnomes — atajos de teclado reasignables (Ajustes > Controles).
   Guarda en localStorage solo lo que el jugador cambia (clave -> tecla, en minúsculas;
   el espacio es " "). Las flechas siempre mueven la cámara además de su tecla. */
const KB_STORE = "gg_keybinds";
const KB_ACTIONS = [
  { id: "up", label: "Cámara arriba", def: "w" },
  { id: "down", label: "Cámara abajo", def: "s" },
  { id: "left", label: "Cámara izquierda", def: "a" },
  { id: "right", label: "Cámara derecha", def: "d" },
  { id: "center", label: "Centrar vista", def: " " },
  { id: "hit", label: "Pegar al gnomo", def: "q" },
  { id: "throw", label: "Lanzar al gnomo", def: "e" },
  { id: "ability", label: "Habilidad especial", def: "r" },
];
const KB_PAN = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };
const KB_ARROWS = { arrowup: [0, 1], arrowdown: [0, -1], arrowleft: [1, 0], arrowright: [-1, 0] };
const KB_RESERVED = ["escape", "enter", "tab", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", "control", "alt", "meta", "capslock", "dead", "unidentified"];

const KeyBinds = {
  map: {},
  listening: null, // id de la acción esperando tecla
  init() {
    this.map = {};
    KB_ACTIONS.forEach((a) => (this.map[a.id] = a.def));
    try {
      const s = JSON.parse(localStorage.getItem(KB_STORE) || "{}") || {};
      KB_ACTIONS.forEach((a) => { if (typeof s[a.id] === "string" && s[a.id]) this.map[a.id] = s[a.id]; });
    } catch (e) {}
  },
  _save() { try { localStorage.setItem(KB_STORE, JSON.stringify(this.map)); } catch (e) {} },
  is(e, id) { return e.key.toLowerCase() === this.map[id]; },
  // Dirección de cámara de una tecla (minúsculas): flechas o la tecla asignada.
  panDir(key) {
    if (KB_ARROWS[key]) return KB_ARROWS[key];
    for (const id in KB_PAN) if (this.map[id] === key) return KB_PAN[id];
    return null;
  },
  label(key) {
    if (key === " ") return "ESPACIO";
    return key.length === 1 ? key.toUpperCase() : key.toUpperCase();
  },
  reset() { KB_ACTIONS.forEach((a) => (this.map[a.id] = a.def)); this._save(); },
  assign(id, key) {
    const old = this.map[id];
    const other = KB_ACTIONS.find((a) => a.id !== id && this.map[a.id] === key);
    this.map[id] = key;
    if (other) this.map[other.id] = old; // intercambio si la tecla ya estaba en uso
    this._save();
  },
  // Escucha la siguiente tecla (Escape cancela). onDone se llama al terminar.
  listen(id, onDone) {
    this.listening = id;
    const h = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const k = e.key.toLowerCase();
      if (["shift", "control", "alt", "meta"].includes(k)) return; // esperar a la tecla real
      window.removeEventListener("keydown", h, true);
      this.listening = null;
      if (k !== "escape" && !KB_RESERVED.includes(k)) this.assign(id, k);
      onDone();
    };
    window.addEventListener("keydown", h, true);
    this._cancel = () => { window.removeEventListener("keydown", h, true); this.listening = null; };
  },
};
KeyBinds.init();
