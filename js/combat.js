/* Gnomore Gnomes — mecánica de combate.
   Regla de oro: un archivo por mecánica. Este archivo solo sabe qué rivales
   puede atacar la unidad del jugador seleccionada, pintar la mira de
   ataque, acercarse (si hace falta) y resolver el golpe — todo lo demás
   (selección, pintado, desplazamiento paso a paso, marcadores genéricos,
   vida/feedback compartido) vive en js/units.js y se reutiliza desde aquí.

   Se registra como "proveedor de rango" igual que js/movement.js — ninguno
   de los dos archivos sabe que el otro existe, ambos hablan solo con
   Units. Esto es lo que permite, por ejemplo, cambiar el combate a distancia
   para otro tipo de unidad sin arriesgarse a romper el movimiento. */

const Combat = {
  // IDs de rivales que están mostrando su barra de vida "forzada" (por estar
  // dentro del rango de la unidad seleccionada, no por estar ellos mismos
  // seleccionados) — se limpia en onClear() para que Units.clearRangeOverlays
  // pueda deshacer este efecto secundario sin saber que existe.
  targetedIds: [],

  // Esta unidad pega cuerpo a cuerpo: para golpear tiene que terminar a 1
  // casilla del rival (attackRange), sea cual sea su alcance de movimiento.
  // Busca la loseta libre más cercana a `unit` desde la que `target` ya
  // esté dentro de attackRange; si `unit` ya está a esa distancia, devuelve
  // su propia casilla (no hace falta moverse). Devuelve null si ni
  // quedándose quieta ni movi��ndose puede llegar a pegarle.
  findApproachTile(unit, target) {
    const type = UNIT_TYPES[unit.typeId];
    const moveRange = type.movimiento;
    const attackRange = type.attackRange;

    const distToTarget = (row, col) =>
      Math.max(Math.abs(row - target.row), Math.abs(col - target.col));

    if (distToTarget(unit.row, unit.col) <= attackRange) {
      return { row: unit.row, col: unit.col };
    }

    let best = null;
    let bestDist = Infinity;
    for (let row = 0; row < Units.boardSize; row++) {
      for (let col = 0; col < Units.boardSize; col++) {
        if (row === unit.row && col === unit.col) continue;
        if (distToTarget(row, col) > attackRange) continue;
        if (Units.unitAt(row, col)) continue; // ocupada (por el propio rival u otra unidad)
        const moveDist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
        if (moveDist > moveRange) continue;
        if (moveDist < bestDist) {
          bestDist = moveDist;
          best = { row, col };
        }
      }
    }
    return best;
  },

  // Rivales que `unit` puede llegar a atacar este turno (quedándose quieta o
  // moviéndose), junto con la loseta desde la que golpearía cada uno.
  attackableEnemies(unit) {
    const targets = [];
    Units.list.forEach((other) => {
      if (other.team === unit.team) return;
      const approach = this.findApproachTile(unit, other);
      if (approach) targets.push({ target: other, approach });
    });
    return targets;
  },

  // Loseta bajo los pies del rival TAL COMO SE VE EN PANTALLA. Ojo: en esta
  // proyección isométrica (ver getTileTopLeft en mapgen.js) avanzar solo en
  // "row" no baja en línea recta por pantalla, sino en diagonal hacia la
  // izquierda — eso hacía que la mira pareciera aparecer lejos del rival en
  // vez de justo debajo. Para que quede realmente debajo en pantalla (mismo
  // X, Y mayor) hay que avanzar row Y col a la vez, porque es la única
  // combinación que cancela el desplazamiento horizontal de la fórmula:
  // x = (col-row)*halfW ..., y = (col+row)*halfH ... — con fallback hacia
  // arriba (row-1,col-1) si el rival está en el borde inferior, y como
  // último recurso su propia loseta (caso degenerado, no debería darse).
  attackMarkerTile(target) {
    const south = { row: target.row + 1, col: target.col + 1 };
    if (south.row < Units.boardSize && south.col < Units.boardSize) return south;
    const north = { row: target.row - 1, col: target.col - 1 };
    if (north.row >= 0 && north.col >= 0) return north;
    return { row: target.row, col: target.col };
  },

  showFor(unit) {
    this.attackableEnemies(unit).forEach(({ target, approach }, i) => {
      const tile = this.attackMarkerTile(target);
      Units.addMarker({
        className: "attack-marker",
        row: tile.row,
        col: tile.col,
        zOffset: 3,
        delayIndex: i,
        visibleClass: "attack-marker--visible",
        buildContent: (marker) => {
          const icon = document.createElement("i");
          icon.className = "ph ph-crosshair-simple attack-marker__icon";
          marker.appendChild(icon);
        },
        onClick: () => this.approachAndAttack(unit, target),
      });

      target.el.classList.add("unit--targeted");
      this.targetedIds.push(target.id);
    });
  },

  onClear() {
    this.targetedIds.forEach((id) => {
      const unit = Units.list.find((u) => u.id === id);
      if (unit) unit.el.classList.remove("unit--targeted");
    });
    this.targetedIds = [];
  },

  async approachAndAttack(unit, target) {
    Units.clearRangeOverlays();
    const approach = this.findApproachTile(unit, target);
    if (!approach) return; // el rival se movió/murió justo antes del clic
    if (approach.row !== unit.row || approach.col !== unit.col) {
      const path = Units.stepPath(unit.row, unit.col, approach.row, approach.col);
      await Units.walkPath(unit, path);
    }
    await this.attack(unit, target);
  },

  async attack(attacker, target) {
    Units.faceTowardsTile(attacker, target.row, target.col);

    // El daño depende de la FUERZA del atacante (una de sus 4 estadísticas,
    // ver UNIT_TYPES en units.js) en vez de ser siempre 1 — así cada tipo de
    // unidad pega de verdad distinto, no solo se mueve distinto.
    const damage = UNIT_TYPES[attacker.typeId].fuerza;
    target.hp = Math.max(0, target.hp - damage);
    Units.updateHpBar(target);
    Units.spawnFloatingText(target, `-${damage}`, { className: "dmg-popup" });
    Units.playShake(target);
    SFX.hit();

    if (target.hp <= 0) {
      await Units.removeUnit(target);
    }

    Units.refreshRange(attacker);
  },
};

Units.registerRangeProvider(Combat);
