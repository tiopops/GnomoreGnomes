/* Gnomore Gnomes — configuración de partida (nº de rivales -> tamaño de escenario).
   Regla de oro: escalabilidad fácil — para permitir más rivales en el futuro,
   basta con añadir el número a OPPONENT_OPTIONS y, si se quiere un tamaño concreto,
   una entrada en BOARD_SIZE_BY_OPPONENTS. Si no hay entrada específica, se calcula
   con una fórmula por defecto. */

const OPPONENT_OPTIONS = [1];

const BOARD_SIZE_BY_OPPONENTS = {
  1: 13, // MVP: partida 1 contra 1 (jugador + 1 IA). Ligeramente más grande que el
         // mínimo de Polytopia (11x11) porque los gnomos necesitan sitio para huir.
};

function getBoardSize(numOpponents) {
  if (BOARD_SIZE_BY_OPPONENTS[numOpponents]) {
    return BOARD_SIZE_BY_OPPONENTS[numOpponents];
  }
  // Fórmula de reserva por si se añaden opciones sin tamaño definido a mano.
  return 13 + (numOpponents - 1) * 3;
}
