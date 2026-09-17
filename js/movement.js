/* Gnomore Gnomes — mecánica de movimiento.
   Regla de oro: un archivo por mecánica. Este archivo solo sabe calcular a
   qué losetas puede desplazarse la unidad del jugador seleccionada, pintar
   sus círculos y ejecutar el desplazamiento — todo lo demás (selección,
   pintado de unidades, salto paso a paso, marcadores genéricos) vive en
   js/units.js y se reutiliza desde aquí a través de su API pública.

   Se registra como "proveedor de rango" (ver cabecera de units.js) al cargar
   este archivo, así que units.js nunca necesita saber que el movimiento
   existe: si algún día se reescribe por completo cómo se mueve una unidad
   (obstáculos, terrenos que cuestan más de 1 punto, etc.), basta con tocar
   este archivo. */

const Movement = {
  // Todas las losetas alcanzables desde la posición actual de `unit` dentro
  // de su alcance de movimiento, excluyendo las ya ocupadas por otra unidad.
  // De momento no hay obstáculos en el tablero, así que basta con distancia
  // Chebyshev (permite diagonales) — el día que haya losetas intransitables
  // o terrenos con coste, este es el único sitio que hay que tocar.
  reachableTiles(unit) {
    const range = UNIT_TYPES[unit.typeId].movement;
    const tiles = [];
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        const dist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
        if (dist > range) continue;
        if (Units.unitAt(row, col)) continue;
        tiles.push({ row, col });
      }
    }
    return tiles;
  },

  showFor(unit) {
    this.reachableTiles(unit).forEach((tile, i) => {
      Units.addMarker({
        className: "range-marker",
        row: tile.row,
        col: tile.col,
        zOffset: 2,
        delayIndex: i,
        visibleClass: "range-marker--visible",
        onClick: () => this.moveTo(unit, tile.row, tile.col),
      });
    });
  },

  async moveTo(unit, destRow, destCol) {
    Units.clearRangeOverlays();
    const path = Units.stepPath(unit.row, unit.col, destRow, destCol);
    await Units.walkPath(unit, path);
    Units.refreshRange(unit);
  },
};

Units.registerRangeProvider(Movement);
