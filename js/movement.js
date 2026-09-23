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
    const range = UNIT_TYPES[unit.typeId].movimiento;
    const tiles = [];
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        const dist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
        if (dist > range) continue;
        if (Units.unitAt(row, col)) continue;
        // El gnomo (js/gnome.js) no vive en Units.list -> Units.unitAt no lo
        // detecta; su propia loseta se excluye a mano para no ofrecer "mover
        // aquí" sobre una casilla que en realidad hay que capturar, no pisar.
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue;
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue; // poblado (js/villages.js)
        if (typeof Shops !== "undefined" && Shops.at(row, col)) continue; // Tienda Goblin (js/shops.js)
        if (typeof Obelisks !== "undefined" && Obelisks.at(row, col)) continue; // Obelisco Ancestral (js/obelisks.js)
        // Niebla de guerra (js/fog.js) — pedido explícito: "un personaje no
        // puede moverse a una zona que esté cubierta por niebla, pero sí a
        // una adyacente a la misma". No hace falta comprobar el CAMINO hacia
        // ahí (de momento el motor no calcula rutas con obstáculos, solo
        // distancia Chebyshev en línea recta, ver comentario de arriba) —
        // basta con excluir del rango cualquier casilla DESTINO que siga sin
        // revelar; una ya revelada justo al lado de niebla sigue siendo un
        // destino válido sin más comprobación.
        if (typeof Fog !== "undefined" && Fog.isFogged(row, col)) continue;
        // Terreno (js/mapgen.js, TerrainMap) — pedido explícito: el agua "los
        // jugadores no pueden pasar de momento por ahi, salvo que alguna
        // raza si pueda nadar o se use un barco" (aún no implementado, así
        // que de momento es intransitable para todos por igual).
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue;
        // Pedido explícito: "bajo ningun concepto un personaje puede
        // moverse a traves de una casilla de agua" — no basta con que el
        // DESTINO sea transitable, el camino recto hasta él (ver
        // Units.pathIsWalkable) tampoco puede pisar agua en ningún punto
        // intermedio (ver ese helper para el detalle del bug que corrige).
        if (!Units.pathIsWalkable(unit.row, unit.col, row, col)) continue;
        tiles.push({ row, col });
      }
    }
    return tiles;
  },

  showFor(unit) {
    // Turnos (js/turns.js) — pedido explícito: "moverse" es una de las 2
    // acciones del turno; si ya no puede actuar no se ofrece ningún círculo
    // de movimiento.
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    const tiles = this.reachableTiles(unit);
    tiles.forEach((tile, i) => {
      Units.addMarker({
        className: "range-marker",
        row: tile.row,
        col: tile.col,
        zOffset: 2,
        // Siempre por encima de cualquier unidad (ver alwaysOnTop en
        // Units.addMarker): un personaje más alto que su loseta (p.ej. el
        // GolemCorteza) no debe poder tapar el círculo de la loseta de
        // detrás solo por ser más grande.
        alwaysOnTop: true,
        delayMs: Units.staggerDelay(i, tiles.length),
        visibleClass: "range-marker--visible",
        onClick: () => this.moveTo(unit, tile.row, tile.col),
      });
    });
  },

  async moveTo(unit, destRow, destCol) {
    // Comprobación defensiva (ver el mismo comentario en Combat.attack) —
    // además de gatear en showFor, la IA rival llama a esto directamente sin
    // pasar por ningún marcador clicado.
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    Units.clearRangeOverlays();
    const path = Units.stepPath(unit.row, unit.col, destRow, destCol);
    await Units.walkPath(unit, path);
    // Moverse cuenta como UNA de las 2 acciones del turno (pedido explícito).
    if (typeof Turns !== "undefined") Turns.useAction(unit);
    // Niebla de guerra (js/fog.js) — pedido explícito: "se revelarán según
    // su percepción al terminar el desplazamiento". Va ANTES de que
    // reaccione el gnomo a propósito: revelar es lo primero que pasa al
    // "terminar de moverse", el gnomo huyendo es una reacción aparte.
    // SOLO para el jugador — "cada jugador tiene su propia niebla": si el
    // rival (la IA, ver js/turns.js) revelara también al moverse, el
    // jugador vería aparecer zonas del mapa cada vez que un enemigo se
    // acerca a algo sin haberlo explorado él mismo, que es justo la fuga de
    // información que se acaba de arreglar en Fog.applyVisibility.
    if (typeof Fog !== "undefined" && unit.team === "player") Fog.revealForUnit(unit);
    // El gnomo (js/gnome.js) reacciona alejándose cada vez que una unidad
    // del jugador se mueve — vive en su propio archivo y se entera de esto
    // igual que combat.js/movement.js se enteran uno del otro: sin que
    // ninguno de los dos necesite saber cómo funciona el otro por dentro.
    // Orden pedido explícitamente: primero se mueve el personaje (ya
    // esperado arriba), LUEGO se mueve el gnomo del todo (por eso se
    // espera aquí, reactToPlayerMove es async precisamente para esto) y
    // solo DESPUÉS se refrescan las casillas de movimiento — nunca en
    // paralelo, para que no se vea el radio actualizándose mientras el
    // gnomo todavía está huyendo.
    // Pedido explícito (bug reportado): "cuando aparece un gnomo por efecto
    // del cebo de la setarcoiris, despues de aparecer se mueve 3 casillas
    // alejandose de los jugadores" — esta llamada faltaba el mismo filtro
    // "unit.team === 'player'" que ya usa Fog.revealForUnit justo arriba:
    // Movement.moveTo también es el que mueve a las unidades RIVALES (ver
    // comentario de moveTo, "la IA rival llama a esto directamente"), así
    // que un gnomo recién nacido (p.ej. justo tras onRoundEnd) huía también
    // de cada movimiento de la IA en su propio turno, no solo del jugador.
    if (typeof Gnome !== "undefined" && unit.team === "player") await Gnome.reactToPlayerMove(unit);
    Units.refreshRange(unit);
  },
};

Units.registerRangeProvider(Movement);
