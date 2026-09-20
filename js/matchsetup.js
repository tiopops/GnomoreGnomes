/* Gnomore Gnomes — configuración de partida (nº de rivales -> tamaño de escenario).
   Regla de oro: escalabilidad fácil — para permitir más rivales en el futuro,
   basta con añadir el número a OPPONENT_OPTIONS y, si se quiere un tamaño concreto,
   una entrada en BOARD_SIZE_BY_OPPONENTS. Si no hay entrada específica, se calcula
   con una fórmula por defecto. */

const OPPONENT_OPTIONS = [1];

const BOARD_SIZE_BY_OPPONENTS = {
  // Pedido explícito, al introducir la loseta de agua: "hicieses más grande
  // el escenario, con más losetas" — de 13x13 a 17x17 para dejar sitio de
  // verdad a un borde de agua rodeando el escenario y algún lago suelto por
  // dentro (ver TODO de agua en mapgen.js) sin comerse el espacio jugable
  // que ya había.
  1: 17,
};

function getBoardSize(numOpponents) {
  if (BOARD_SIZE_BY_OPPONENTS[numOpponents]) {
    return BOARD_SIZE_BY_OPPONENTS[numOpponents];
  }
  // Fórmula de reserva por si se añaden opciones sin tamaño definido a mano.
  return 13 + (numOpponents - 1) * 3;
}
