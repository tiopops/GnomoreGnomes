/* Gnomore Gnomes — configuración de partida (nº de rivales -> tamaño de escenario).
   Regla de oro: escalabilidad fácil — para permitir más rivales en el futuro,
   basta con añadir el número a OPPONENT_OPTIONS y, si se quiere un tamaño concreto,
   una entrada en BOARD_SIZE_BY_OPPONENTS. Si no hay entrada específica, se calcula
   con una fórmula por defecto. */

const OPPONENT_OPTIONS = [1];

const BOARD_SIZE_BY_OPPONENTS = {
  // Pedido explícito (segunda pasada): "el escenario contra un jugador debe
  // ser de 25x25 losetas" — de 17x17 a 25x25, ahora que además hay ríos que
  // cruzan el mapa de lado a lado (ver generateRiver en mapgen.js) y 5
  // tótems neutrales (ver VILLAGE_COUNT en villages.js) que necesitan sitio
  // de sobra para repartirse sin quedar todos pegados entre sí.
  1: 25,
};

function getBoardSize(numOpponents) {
  if (BOARD_SIZE_BY_OPPONENTS[numOpponents]) {
    return BOARD_SIZE_BY_OPPONENTS[numOpponents];
  }
  // Fórmula de reserva por si se añaden opciones sin tamaño definido a mano.
  return 13 + (numOpponents - 1) * 3;
}
