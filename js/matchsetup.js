/* Gnomore Gnomes — configuración de partida (nº de rivales -> tamaño de escenario).
   Regla de oro: escalabilidad fácil — para permitir más rivales en el futuro,
   basta con añadir el número a OPPONENT_OPTIONS y, si se quiere un tamaño concreto,
   una entrada en BOARD_SIZE_BY_OPPONENTS. Si no hay entrada específica, se calcula
   con una fórmula por defecto. */

const OPPONENT_OPTIONS = [1, 2, 3];

const BOARD_SIZE_BY_OPPONENTS = {
  // Pedido explícito (segunda pasada): "el escenario contra un jugador debe
  // ser de 25x25 losetas" — de 17x17 a 25x25, ahora que además hay ríos que
  // cruzan el mapa de lado a lado (ver generateRiver en mapgen.js) y 5
  // tótems neutrales (ver VILLAGE_COUNT en villages.js) que necesitan sitio
  // de sobra para repartirse sin quedar todos pegados entre sí.
  1: 23,
  2: 29,
  3: 33,
};

function getBoardSize(numOpponents) {
  if (BOARD_SIZE_BY_OPPONENTS[numOpponents]) {
    return BOARD_SIZE_BY_OPPONENTS[numOpponents];
  }
  // Fórmula de reserva por si se añaden opciones sin tamaño definido a mano.
  return 13 + (numOpponents - 1) * 3;
}


// Centro del mapa RESERVADO para el elemento propio del nivel (Altar en MushBoom, Volcán en Rock'n Troll,
// Huevo en HurryCrane): ningún otro objeto (tienda, oráculo, poblados, bumpers, arbustos, recursos...)
// puede colocarse a `radius` casillas (Chebyshev) del centro, para que ese elemento aparezca SIEMPRE en el centro.
function centerReserved(row, col, radius) {
  const size = (typeof Units !== "undefined" && Units.boardSize) || (typeof TerrainMap !== "undefined" && TerrainMap.size) || 0;
  if (!size) return false;
  const m = Math.floor(size / 2);
  return Math.max(Math.abs(row - m), Math.abs(col - m)) <= (radius == null ? 2 : radius);
}

// Elige la loseta más EQUITATIVA para un punto de interés compartido (tienda, oráculo...):
// la que deja la distancia al "punto útil más cercano" lo más parecida posible para todas las bases.
// `valid(row, col)` filtra las losetas permitidas; `providers` son puntos ya colocados del mismo tipo
// (la distancia de cada base cuenta al más cercano). Entre las mejores se elige una al azar.
function pickFairSpot(boardSize, valid, bases, providers, penalty) {
  const ch = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  const cands = [];
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (!valid(row, col)) continue;
      if (centerReserved(row, col, 2)) continue; // el centro es del elemento del nivel
      const pts = (providers || []).concat([{ row, col }]);
      const d = bases.map((b) => Math.min(...pts.map((p) => ch(b, p))));
      const imb = Math.max(...d) - Math.min(...d);
      const mean = d.reduce((x, y) => x + y, 0) / (d.length || 1);
      cands.push({ row, col, score: imb * 10 + mean * 0.4 + (penalty ? penalty(row, col) : 0) });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.score - b.score);
  const top = cands.filter((c) => c.score <= cands[0].score + 6).slice(0, 6);
  return top[Math.floor(Math.random() * top.length)];
}
