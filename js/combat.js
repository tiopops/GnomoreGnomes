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

  // IDs de rivales temblando de miedo ahora mismo por estar a punto de
  // morir del golpe de la unidad seleccionada (ver showFor/onClear más
  // abajo) — mismo patrón que targetedIds, una lista aparte porque no todo
  // objetivo válido está además condenado a morir de este golpe concreto.
  doomedIds: [],

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
        if (typeof Gnome !== "undefined" && Gnome.isAt(row, col)) continue; // ocupada por el gnomo (js/gnome.js)
        if (typeof Villages !== "undefined" && Villages.at(row, col)) continue; // poblado (js/villages.js)
        if (typeof TerrainMap !== "undefined" && !TerrainMap.isWalkable(row, col)) continue; // agua (js/mapgen.js)
        const moveDist = Math.max(Math.abs(row - unit.row), Math.abs(col - unit.col));
        if (moveDist > moveRange) continue;
        // Pedido explícito: "bajo ningun concepto un personaje puede
        // moverse a traves de una casilla de agua" — ver Units.pathIsWalkable
        // (units.js): el destino ya se comprueba arriba, pero el camino recto
        // hasta él también tiene que estar libre de agua en cualquier punto
        // intermedio, no solo al llegar.
        if (!Units.pathIsWalkable(unit.row, unit.col, row, col)) continue;
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
      // Niebla de guerra (js/fog.js) — pedido explícito: "el jugador no
      // puede ver lo que hay tras ella... puede que haya un enemigo... pero
      // hasta que no se despeje no se sabrá". Un rival de pie sobre una
      // loseta todavía sin revelar no se puede atacar aunque caiga dentro
      // del alcance — ya está oculto visualmente por la propia niebla
      // (z-index por encima de todo, ver mapgen.js), esto evita además que
      // se pueda "atacar a ciegas" algo que no se ve.
      if (typeof Fog !== "undefined" && Fog.isFogged(other.row, other.col)) return;
      const approach = this.findApproachTile(unit, other);
      if (approach) targets.push({ target: other, approach });
    });
    return targets;
  },

  // La mira de ataque se pinta sobre la PROPIA loseta del rival (como una
  // mira bajo sus pies) — quien se mueve es el atacante: al hacer clic, se
  // coloca en la casilla adyacente al rival más cercana a su posición
  // actual (ver approachAndAttack/findApproachTile) y golpea desde ahí,
  // todo en el mismo clic. zOffset se deja explícitamente por DEBAJO del
  // z-index con el que se pintan las unidades ((row+col)*10 + 5, ver
  // _placeInstant/hopTo en units.js) para que el sprite del rival quede por
  // delante de la mira, no al revés — la mira es más grande que el propio
  // sprite (ver .attack-marker en style.css) precisamente para que sus
  // bordes asomen por detrás del personaje y sigan siendo clicables ahí,
  // aunque la silueta central quede tapada por él.
  attackMarkerTile(target) {
    return { row: target.row, col: target.col };
  },

  showFor(unit) {
    // Turnos (js/turns.js) — pedido explícito: cada personaje tiene 2
    // acciones por turno ("pegar una vez a un enemigo" es una de ellas); si
    // ya no puede actuar (las gastó, o no es su turno) no se ofrece ninguna
    // mira de ataque. typeof por si turns.js todavía no ha cargado (o una
    // herramienta de debug no lo incluye) — igual que el resto de comprobaciones
    // "typeof X !== undefined" de este proyecto.
    if (typeof Turns !== "undefined" && !Turns.canAct(unit)) return;
    // Mientras lleva al gnomo cogido (js/gnome.js) la unidad pierde la
    // capacidad de atacar — puede moverse, golpear al gnomo o pasarlo, pero
    // no repartir daño a la vez que lo lleva encima.
    if (typeof Gnome !== "undefined" && Gnome.isHeldBy(unit.id)) return;
    // Daño que haría ESTE golpe (misma fórmula que attack() más abajo) —
    // hace falta ya aquí, antes de golpear de verdad, para saber qué
    // rivales morirían con él (ver unit--doomed más abajo).
    const damage = UNIT_TYPES[unit.typeId].fuerza;
    this.attackableEnemies(unit).forEach(({ target, approach }, i) => {
      const tile = this.attackMarkerTile(target);
      Units.addMarker({
        className: "attack-marker",
        row: tile.row,
        col: tile.col,
        zOffset: 2,
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

      // Pedido explícito: "si un enemigo está al alcance y ese enemigo
      // moriría por el ataque del personaje seleccionado, dicho enemigo
      // empiece a temblar de miedo y que se gire de un lado a otro como hace
      // el gnomo". target.hp <= damage -> este golpe (sin acumular ningún
      // otro) ya lo mataría del todo.
      if (target.hp <= damage) {
        target.el.classList.add("unit--doomed");
        Units.startFearLoop(target);
        this.doomedIds.push(target.id);
      }
    });
  },

  onClear() {
    this.targetedIds.forEach((id) => {
      const unit = Units.list.find((u) => u.id === id);
      if (unit) unit.el.classList.remove("unit--targeted");
    });
    this.targetedIds = [];

    this.doomedIds.forEach((id) => {
      const unit = Units.list.find((u) => u.id === id);
      if (unit) {
        unit.el.classList.remove("unit--doomed");
        Units.stopFearLoop(unit);
      }
    });
    this.doomedIds = [];
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
    // Turnos (js/turns.js) — comprobación defensiva además del gate en
    // showFor: approachAndAttack puede llegar aquí desde un marcador que ya
    // estaba pintado en pantalla justo cuando se agotó la acción (p.ej. la
    // IA rival encadenando ataques), así que se repite aquí por seguridad.
    if (typeof Turns !== "undefined" && !Turns.canAct(attacker)) return;
    Units.faceTowardsTile(attacker, target.row, target.col);

    // Golpear cuenta como UNA de las 2 acciones del turno (pedido explícito:
    // "pegar una vez a un enemigo") — se gasta aquí, en el golpe en sí, no en
    // approachAndAttack: acercarse antes de golpear no es una acción aparte,
    // es parte de la misma.
    if (typeof Turns !== "undefined") Turns.useAction(attacker);

    // El daño depende de la FUERZA del atacante (una de sus 4 estadísticas,
    // ver UNIT_TYPES en units.js) en vez de ser siempre 1 — así cada tipo de
    // unidad pega de verdad distinto, no solo se mueve distinto.
    const damage = UNIT_TYPES[attacker.typeId].fuerza;
    target.hp = Math.max(0, target.hp - damage);
    Units.updateHpBar(target);
    Units.spawnFloatingText(target, `-${damage}`, { className: "dmg-popup" });
    Units.playShake(target);
    SFX.hit();

    // Retroalimentación en QUIEN GOLPEA, no solo en quien lo recibe (regla
    // de oro del proyecto: todo necesita sonido y/o animación coherente con
    // la acción) — reutiliza el mismo puñetazo corto que Gnome.hit
    // (unit--punching, ver style.css: sustituye a la respiración continua
    // mientras dura, nunca se mezcla con ella), sincronizado con el mismo
    // golpe de sonido y el temblor de quien lo recibe.
    if (attacker.el) {
      attacker.el.classList.remove("unit--punching");
      void attacker.spriteEl.offsetWidth;
      attacker.el.classList.add("unit--punching");
      setTimeout(() => attacker.el.classList.remove("unit--punching"), 320);
    }

    if (target.hp <= 0) {
      // Pedido explícito sobre el ORDEN: "primero, el enemigo muere, luego
      // el gnomo aparece en la casilla en la que murió y luego el gnomo
      // huye. en ese orden" — así que Units.removeUnit (animación de muerte
      // completa) va PRIMERO, y solo cuando termina se llama a
      // Gnome.dropHeldBy (que hace aparecer el gnomo y lo pone a huir).
      // Units.removeUnit NO borra target.row/target.col (solo quita el
      // elemento del DOM y de Units.list), así que dropFromDyingUnit sigue
      // pudiendo leer dónde murió aunque ya no esté en la lista — de ahí que
      // siga recibiendo `target` como parámetro en vez de tener que buscarlo.
      // Gnome.dropHeldBy no hace nada si `target` no llevaba ningún gnomo
      // encima, así que siempre es seguro llamarlo aquí sin comprobar antes.
      // Puntos de Gloria (js/glory.js) — pedido explícito: "matar a 1
      // enemigo genera +1 punto de gloria al comienzo del turno". Se
      // registra aquí, en el instante exacto en que la baja se confirma
      // (equipo de QUIEN ATACA, no de la víctima) — Glory ya se encarga de
      // no sumarlo a los puntos "de verdad" hasta el próximo inicio de
      // turno de ese equipo.
      if (typeof Glory !== "undefined") Glory.queueKillBonus(attacker.team);
      await Units.removeUnit(target);
      if (typeof Gnome !== "undefined") await Gnome.dropHeldBy(target);
    } else {
      await this.pushBack(attacker, target);
    }

    Units.refreshRange(attacker);
  },

  // Empujón: se restan las FUERZAs (atacante - objetivo) y, si sale positivo,
  // el objetivo retrocede esa cantidad de casillas en línea recta en la
  // dirección del golpe (desde el atacante hacia el objetivo, prolongada más
  // allá) — un atacante mucho más fuerte aparta al rival de un golpe, uno
  // más débil o igual de fuerte no consigue moverlo ni un poco (0 o menos =
  // sin efecto). Se para en el primer obstáculo (borde del tablero, otra
  // unidad o el gnomo) en vez de saltárselo.
  async pushBack(attacker, target) {
    const push = UNIT_TYPES[attacker.typeId].fuerza - UNIT_TYPES[target.typeId].fuerza;
    if (push <= 0) return;

    const dRow = Math.sign(target.row - attacker.row);
    const dCol = Math.sign(target.col - attacker.col);
    if (dRow === 0 && dCol === 0) return;

    const path = [];
    let row = target.row;
    let col = target.col;
    for (let i = 0; i < push; i++) {
      const nextRow = row + dRow;
      const nextCol = col + dCol;
      if (nextRow < 0 || nextCol < 0 || nextRow >= Units.boardSize || nextCol >= Units.boardSize) break;
      if (Units.unitAt(nextRow, nextCol)) break;
      if (typeof Gnome !== "undefined" && Gnome.isAt(nextRow, nextCol)) break;
      if (typeof Villages !== "undefined" && Villages.at(nextRow, nextCol)) break; // poblado (js/villages.js)
      path.push({ row: nextRow, col: nextCol });
      row = nextRow;
      col = nextCol;
    }
    if (path.length === 0) return;

    // Empuje propio (no Units.walkPath): un empujón no es una decisión del
    // propio personaje, así que NO se le hace girar para "mirar" hacia donde
    // retrocede (a diferencia de un movimiento normal) — se queda mirando de
    // frente a quien le ha golpeado, solo que unas casillas más atrás. Más
    // rápido que un paso normal (140ms) para que se lea como un golpe seco,
    // no como una decisión pausada.
    target.el.classList.add("unit--moving");
    for (const step of path) {
      await new Promise((resolve) => {
        target.row = step.row;
        target.col = step.col;
        const { x, y } = getTileCenter(step.row, step.col, Units.boardSize);
        target.el.style.left = `${x}px`;
        target.el.style.top = `${y}px`;
        target.el.style.zIndex = String((step.row + step.col) * 10 + 5);
        target.spriteEl.classList.remove("unit__sprite--hop");
        void target.spriteEl.offsetWidth;
        target.spriteEl.classList.add("unit__sprite--hop");
        SFX.hop();
        setTimeout(resolve, 140);
      });
    }
    target.el.classList.remove("unit--moving");
    target.spriteEl.classList.remove("unit__sprite--hop");
  },
};

Units.registerRangeProvider(Combat);
