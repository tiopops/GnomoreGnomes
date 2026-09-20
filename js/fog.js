/* Gnomore Gnomes — niebla de guerra (fog of war).
   Regla de oro: un archivo por mecánica. Este archivo solo sabe QUÉ losetas
   están reveladas y CUÁNDO revelar más — no pinta la niebla en sí (eso lo
   hace js/mapgen.js, que crea SIEMPRE la capa .tile__fog en cada loseta al
   generar el mapa, visible por defecto) ni decide a qué casillas puede
   moverse una unidad (eso lo sigue decidiendo js/movement.js, que consulta
   Fog.isFogged para excluir de su rango las que aún no se han revelado —
   pedido explícito: "un personaje no puede moverse a una zona que esté
   cubierta por niebla, pero sí a una adyacente a la misma").

   Pedido explícito: "el mapa se genera oculto bajo estas losetas hasta que
   se revelan y dejan ver realmente lo que hay debajo" — el mapa (terreno,
   enemigos...) YA existe entero desde el principio (generateMap/
   spawnRandomEnemy no cambian), la niebla solo lo tapa visualmente hasta
   que este archivo decide revelar cada loseta.

   Se apoya en los atributos data-row/data-col que mapgen.js ya deja en cada
   `.tile` (y en su `.tile__fog` hijo) para encontrar qué elemento ocultar
   sin tener que mantener su propio índice DOM aparte. */

// Radio (casillas, distancia Chebyshev) revelado alrededor de cada
// personaje AL EMPEZAR la partida — pedido explícito: FIJO, no depende de
// la PERCEPCION de cada uno (esa estadística solo entra en juego a partir
// del primer movimiento, ver Fog.revealForUnit).
const FOG_INITIAL_RADIUS = 2;

const Fog = {
  size: 0,
  revealedGrid: null, // boolean[row][col], o null si todavía no se ha inicializado esta partida
  _fogEls: null, // Map "row,col" -> elemento .tile__fog de esa loseta

  // Se llama UNA vez al generar/pintar cada mapa nuevo (spawnTestUnits en
  // newgame-flow.js), DESPUÉS de renderMap — necesita que los .tile ya
  // existan en el DOM para poder cachear sus .tile__fog. Todo el mapa
  // arranca oculto; el revelado inicial lo hace quien llama a esto,
  // personaje a personaje, con revealInitial.
  init(size, container) {
    this.size = size;
    this.revealedGrid = Array.from({ length: size }, () => new Array(size).fill(false));
    this._fogEls = new Map();
    container.querySelectorAll(".tile").forEach((tileEl) => {
      const fogEl = tileEl.querySelector(".tile__fog");
      if (fogEl) this._fogEls.set(`${tileEl.dataset.row},${tileEl.dataset.col}`, fogEl);
    });
  },

  // false si no hay niebla activa todavía (p.ej. una herramienta de debug
  // que no llama a Fog.init) — así ningún otro archivo necesita comprobar
  // "typeof Fog" Y "Fog.revealedGrid" a la vez, con esto basta.
  isFogged(row, col) {
    if (!this.revealedGrid) return false;
    if (row < 0 || col < 0 || row >= this.size || col >= this.size) return false;
    return !this.revealedGrid[row][col];
  },

  // Revela todas las losetas dentro de `radius` (incluida la propia). No
  // hace nada con las que ya estaban reveladas — idempotente, se puede
  // llamar tantas veces como haga falta sin animación repetida ni coste
  // extra en las que no cambian.
  revealAround(row, col, radius) {
    if (!this.revealedGrid) return;
    for (let r = Math.max(0, row - radius); r <= Math.min(this.size - 1, row + radius); r++) {
      for (let c = Math.max(0, col - radius); c <= Math.min(this.size - 1, col + radius); c++) {
        if (Math.max(Math.abs(r - row), Math.abs(c - col)) > radius) continue;
        this._reveal(r, c);
      }
    }
  },

  _reveal(row, col) {
    if (this.revealedGrid[row][col]) return;
    this.revealedGrid[row][col] = true;
    const fogEl = this._fogEls.get(`${row},${col}`);
    // Se desvanece (transition en .tile__fog--revealed, ver style.css) en
    // vez de desaparecer de golpe — nivel Triple A / feedback (regla de oro
    // del proyecto): explorar debe sentirse como un descubrimiento.
    if (fogEl) fogEl.classList.add("tile__fog--revealed");
  },

  // Revelado FIJO al empezar la partida — ver FOG_INITIAL_RADIUS arriba.
  revealInitial(row, col) {
    this.revealAround(row, col, FOG_INITIAL_RADIUS);
  },

  // Revelado tras moverse — SÍ según la PERCEPCION de quien se ha movido
  // (pedido explícito: "se revelarán según su percepción al terminar el
  // desplazamiento... para casillas más lejanas..."; ver js/movement.js,
  // que llama a esto justo después de terminar el desplazamiento paso a
  // paso, antes de que el gnomo reaccione).
  revealForUnit(unit) {
    const type = UNIT_TYPES[unit.typeId];
    this.revealAround(unit.row, unit.col, type.percepcion);
  },
};
