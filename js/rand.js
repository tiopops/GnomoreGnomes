/* Gnomore Gnomes — azar reproducible para el multijugador.
   Regla de oro: un archivo por mecánica. Este archivo SOLO sabe:
     - NR(): el azar "de verdad" del navegador, para lo puramente visual
       (partículas, retardos de animación, sonidos...). Nunca afecta al juego.
     - GGRand: un generador con semilla. Mientras GGRand.on es true,
       Math.random() sale de él (el azar de las reglas del juego). Los dos
       jugadores de una partida online lo siembran igual antes de cada acción
       (GGRand.reseed), así tiradas, huidas de gnomos y reparto del escenario
       salen idénticos en ambos ordenadores.
   Fuera del multijugador GGRand.on es false y todo se comporta como siempre. */

const NR = Math.random.bind(Math);

const GGRand = {
  on: false,
  _s: 1,

  _hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },

  // Siembra con un texto (p. ej. "semilla|accion|17"): mismo texto, misma secuencia.
  reseed(label) {
    this._s = this._hash(String(label)) || 1;
  },

  next() {
    // mulberry32
    this._s = (this._s + 0x6d2b79f5) | 0;
    let t = this._s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },

  // Generador independiente (no toca la secuencia principal): para sorteos que ocurren dentro
  // de animaciones cuyo ritmo cambia de un ordenador a otro (p. ej. fragmentos de roca).
  local(label) {
    let s = this._hash(String(label)) || 1;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  enable(label) {
    this.on = true;
    this.reseed(label);
    Math.random = () => (GGRand.on ? GGRand.next() : NR());
  },

  disable() {
    this.on = false;
    Math.random = NR;
  },
};
