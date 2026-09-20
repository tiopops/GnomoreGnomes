/* Gnomore Gnomes — turnos por equipo.
   Regla de oro: un archivo por mecánica. Este archivo NO sabe cómo se mueve,
   se ataca, se coge o se pasa el gnomo — eso sigue viviendo tal cual en
   js/movement.js, js/combat.js y js/gnome.js. Lo único que sabe es:
     - A quién le toca ahora mismo (Turns.activeTeam).
     - Cuántas acciones lleva gastadas cada unidad esta ronda suya
       (Turns.actionsUsed) y si todavía puede actuar (Turns.canAct).
   Cada mecánica llama a Turns.canAct(unit) antes de ofrecer sus marcadores
   (ver el gate al principio de showFor en movement.js/combat.js/gnome.js) y
   a Turns.useAction(unit) justo cuando la acción se confirma de verdad
   (Movement.moveTo, Combat.attack, GnomeInstance.hit/executePass/catchBy) —
   así este archivo no necesita saber CUÁNDO ocurre cada una, solo que se lo
   avisen.

   Pedido explícito: "cada personaje tiene 2 acciones, las acciones son...
   moverse una vez, pegar una vez a un enemigo, pegar al gnomo una vez, pasar
   el gnomo una vez o usar una habilidad una vez cuando las haya, una vez un
   personaje haya usado 2 acciones... perderá un poco de saturación para
   indicar que está inactivo (un jugador inactivo puede recibir un pase)...
   el jugador deberá pulsar el botón PASAR TURNO... entonces será el turno de
   mover del jugador enemigo... el ordenador simulará el turno del enemigo
   moviendo a los personajes, cogiendo gnomos... con el tiempo definiremos
   una IA más compleja." — la IA de aquí es deliberadamente simple (ver
   _runEnemyTurn/_aiActOnce más abajo), a la espera de esa IA más completa
   futura que el propio pedido ya anticipa. */

const TURNS_MAX_ACTIONS = 2;

// Pedido explícito: "de momento para hacer pruebas, que los enemigos no
// ataquen estamos en modo sandbox" — la IA rival (_aiActOnce más abajo)
// sigue moviéndose y cogiendo/golpeando/pasando gnomos con total normalidad,
// solo se le desactiva la prioridad de ATACAR a los personajes del jugador.
// Poner a false el día que se quiera que el rival ataque de verdad.
const TURNS_SANDBOX_NO_ENEMY_ATTACK = true;

const Turns = {
  activeTeam: "player", // "player" | "enemy"
  actionsUsed: {}, // unitId -> nº de acciones gastadas en SU turno actual
  _btn: null,
  _btnLabelEl: null,
  _aiRunning: false,

  // Se llama al empezar cada partida nueva (spawnTestUnits, ver
  // newgame-flow.js), DESPUÉS de crear todos los personajes y gnomos —
  // deja limpio el contador, siempre empieza el jugador, y (re)crea/muestra
  // el botón de PASAR TURNO.
  reset() {
    this.activeTeam = "player";
    this.actionsUsed = {};
    this._aiRunning = false;
    Units.list.forEach((u) => this._applyExhaustedClass(u));
    this._ensureButton();
    this._updateButtonState();
    // Puntos de Gloria (js/glory.js) — pedido explícito: "al comienzo de
    // cada turno se generan automaticamente 2 puntos de gloria", y el
    // primer turno de la partida (el del jugador) no es una excepción.
    if (typeof Glory !== "undefined") Glory.grantTurnStart("player");
  },

  // true si `unit` puede gastar todavía alguna de sus 2 acciones ESTE turno
  // — falso tanto si ya las gastó como si no es el turno de su equipo. Toda
  // mecánica (Movement/Combat/Gnome) comprueba esto antes de ofrecer nada.
  canAct(unit) {
    if (!unit || !unit.el) return false;
    if (unit.team !== this.activeTeam) return false;
    return (this.actionsUsed[unit.id] || 0) < TURNS_MAX_ACTIONS;
  },

  // Descuenta una acción de `unit` — lo llama cada mecánica justo cuando la
  // acción se confirma de verdad (ver cabecera del archivo). Si con esto
  // llega a las 2 y esa unidad es la seleccionada ahora mismo, se
  // deselecciona sola para que sus marcadores/botones desaparezcan sin que
  // cada mecánica tenga que acordarse de ocultarlos a mano.
  useAction(unit) {
    this.actionsUsed[unit.id] = (this.actionsUsed[unit.id] || 0) + 1;
    this._applyExhaustedClass(unit);
    if (Units.selectedId === unit.id && !this.canAct(unit)) {
      Units.deselect();
    }
    // Pedido explícito: "cuando todos los personajes se hayan movido estaría
    // bien que palpitase para avisar visualmente al jugador" — se comprueba
    // después de CADA acción (no solo al cambiar de turno) para que el botón
    // se ponga a palpitar en el instante exacto en que la ÚLTIMA unidad del
    // jugador se queda sin acciones, no un paso más tarde.
    this._updateButtonState();
  },

  // Saturación reducida (pedido explícito) en cuanto una unidad agota sus 2
  // acciones — puramente visual, "un jugador inactivo puede recibir un
  // pase" así que no bloquea ningún clic aquí, solo lo hacen canAct/showFor.
  _applyExhaustedClass(unit) {
    if (!unit.el) return;
    const exhausted = (this.actionsUsed[unit.id] || 0) >= TURNS_MAX_ACTIONS;
    unit.el.classList.toggle("unit--exhausted", exhausted);
  },

  // Vacía a 0 las acciones gastadas de TODAS las unidades de `team` y les
  // quita la saturación — se llama al EMPEZAR el turno de ese equipo (nunca
  // al terminarlo), así el otro equipo se queda viendo cómo de "gastadas"
  // dejaron a sus unidades hasta que vuelva a tocarles.
  _resetTeamActions(team) {
    Units.list
      .filter((u) => u.team === team)
      .forEach((u) => {
        this.actionsUsed[u.id] = 0;
        this._applyExhaustedClass(u);
      });
  },

  // ---------- Botón "PASAR TURNO" ----------
  // Mismo patrón que UnitInfo/Gnome (botón fijo, position:fixed, añadido a
  // document.body una sola vez) — pero SIEMPRE visible durante la partida
  // (no ligado a ninguna selección): esquina inferior derecha, pedido
  // explícito.

  _ensureButton() {
    if (this._btn) return;
    const btn = document.createElement("button");
    btn.className = "end-turn-btn";
    btn.setAttribute("aria-label", "Pasar turno");
    const icon = document.createElement("i");
    icon.className = "ph ph-flag-checkered end-turn-btn__icon";
    const label = document.createElement("span");
    label.className = "end-turn-btn__label";
    btn.appendChild(icon);
    btn.appendChild(label);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.endTurn();
    });
    document.body.appendChild(btn);
    this._btn = btn;
    this._btnLabelEl = label;
    this._btnIconEl = icon;
  },

  // Se llama desde js/settingsmenu.js al salir de la partida (opción "Salir
  // de la partida" del popup de ajustes, ver ese archivo) — antes esto lo
  // hacía un listener propio sobre el back-btn del tablero, pero ese botón
  // ya no existe (lo tapaba el marcador de Puntos de Gloria, pedido
  // explícito: lo sustituye el icono de ajustes de la esquina superior
  // derecha). Mismo efecto de siempre: el botón deja de estar visible hasta
  // que la próxima partida lo vuelva a mostrar (Turns.reset -> _updateButtonState).
  hideButton() {
    if (this._btn) this._btn.classList.remove("end-turn-btn--visible");
  },

  // true si NINGUNA unidad del jugador puede ya actuar este turno (las 2
  // acciones de todas gastadas) — lo usa _updateButtonState para decidir
  // cuándo palpitar (pedido explícito, ver más abajo). false si el equipo
  // del jugador está vacío (no hay nada que avisar).
  _allPlayerUnitsExhausted() {
    const playerUnits = Units.list.filter((u) => u.team === "player");
    if (playerUnits.length === 0) return false;
    return playerUnits.every((u) => !this.canAct(u));
  },

  _updateButtonState() {
    if (!this._btn) return;
    this._btn.classList.add("end-turn-btn--visible");
    const isPlayerTurn = this.activeTeam === "player" && !this._aiRunning;
    this._btn.disabled = !isPlayerTurn;
    this._btn.classList.toggle("end-turn-btn--thinking", !isPlayerTurn);

    // Pedido explícito: "cuando todos los personajes se hayan movido estaría
    // bien que palpitase para avisar visualmente al jugador" — solo mientras
    // es su turno de verdad (nunca durante el turno rival, aunque
    // técnicamente ya estén todos "agotados" de la ronda anterior).
    const ready = isPlayerTurn && this._allPlayerUnitsExhausted();
    this._btn.classList.toggle("end-turn-btn--ready", ready);

    if (!isPlayerTurn) {
      this._btnLabelEl.textContent = "Turno rival…";
      this._btnIconEl.className = "ph ph-circle-notch end-turn-btn__icon";
    } else if (ready) {
      this._btnLabelEl.textContent = "¡Todos listos!";
      this._btnIconEl.className = "ph ph-check-circle end-turn-btn__icon";
    } else {
      this._btnLabelEl.textContent = "Pasar turno";
      this._btnIconEl.className = "ph ph-hourglass-simple end-turn-btn__icon";
    }
  },

  // ---------- Cambio de turno ----------

  async endTurn() {
    if (this._aiRunning || this.activeTeam !== "player") return;
    Units.deselect();
    // Pedido explícito: "los gnomos que están sueltos... pierden 5 puntos
    // cada vez que alguien pulsa el botón PASAR TURNO" — CADA pulsación
    // cuenta, así que se llama aquí (la del jugador) Y otra vez más abajo,
    // cuando el ordenador "pulsa" el suyo automáticamente al terminar su
    // turno — dos veces por ronda completa, no una.
    if (typeof Gnome !== "undefined") Gnome.applyTurnPassDecay();
    this.activeTeam = "enemy";
    this._resetTeamActions("enemy");
    this._aiRunning = true;
    this._updateButtonState();
    // Puntos de Gloria (js/glory.js) — +2 al empezar el turno del rival
    // también: el marcador en pantalla es solo el del jugador (ver nota de
    // cabecera de glory.js), pero el rival igualmente acumula los suyos por
    // dentro para cuando su IA los pueda gastar más adelante.
    if (typeof Glory !== "undefined") Glory.grantTurnStart("enemy");

    await this._runEnemyTurn();

    if (typeof Gnome !== "undefined") Gnome.applyTurnPassDecay();
    this._aiRunning = false;
    this.activeTeam = "player";
    this._resetTeamActions("player");
    this._updateButtonState();
    if (typeof Glory !== "undefined") Glory.grantTurnStart("player");
  },

  // ---------- IA del bando rival ----------
  // Deliberadamente simple (pedido explícito: "con el tiempo definiremos una
  // IA más compleja") — recorre a cada rival y, mientras le queden acciones,
  // hace lo más "razonable" disponible en este orden de prioridad:
  //   1. Si lleva el gnomo cogido: pasarlo a un aliado cercano (arriesgado
  //      pero da más puntos) o si no golpearlo para sumar puntos.
  //   2. Si puede atacar a algún personaje del jugador: atacarlo.
  //   3. Si hay un gnomo suelto a su alcance: cogerlo.
  //   4. Si no: acercarse al objetivo más interesante que tenga a la vista
  //      (un gnomo suelto o, si no, el personaje del jugador más cercano).
  // Si ninguna de las 4 aplica, esa unidad no hace nada más este turno (no
  // malgasta sus acciones moviéndose sin rumbo).
  async _runEnemyTurn() {
    const enemies = Units.list.filter((u) => u.team === "enemy");
    for (const unit of enemies) {
      for (let i = 0; i < TURNS_MAX_ACTIONS; i++) {
        if (!this.canAct(unit)) break;
        const acted = await this._aiActOnce(unit);
        if (!acted) break;
        // Pequeña pausa entre acciones para que el jugador pueda seguir lo
        // que hace cada rival, en vez de que las 2 acciones de cada uno se
        // resuelvan instantáneamente una detrás de otra.
        await new Promise((resolve) => setTimeout(resolve, 260));
      }
    }
  },

  // Ejecuta UNA acción para `unit` según la prioridad de arriba. Devuelve
  // true si de verdad hizo algo (y por tanto gastó una acción — ya la habrá
  // descontado la propia mecánica llamada, ver cabecera del archivo) o false
  // si no había nada razonable que hacer (para que _runEnemyTurn no siga
  // intentando en vano con la acción que le quedara).
  async _aiActOnce(unit) {
    if (!unit.el) return false; // pudo morir a mitad del propio turno rival

    if (typeof Gnome !== "undefined") {
      const held = Gnome.list.find((g) => g.heldBy === unit.id);
      if (held) {
        const ally = Units.list.find(
          (u) =>
            u.team === "enemy" &&
            u.id !== unit.id &&
            Math.max(Math.abs(u.row - unit.row), Math.abs(u.col - unit.col)) <=
              UNIT_TYPES[unit.typeId].movimiento + 2
        );
        if (ally && Math.random() < 0.5) {
          await held.executePass(unit, ally);
        } else {
          held.hit(unit);
        }
        return true;
      }
    }

    if (!TURNS_SANDBOX_NO_ENEMY_ATTACK && typeof Combat !== "undefined") {
      const targets = Combat.attackableEnemies(unit);
      if (targets.length > 0) {
        await Combat.approachAndAttack(unit, targets[0].target);
        return true;
      }
    }

    if (typeof Gnome !== "undefined") {
      const looseGnome = Gnome.list.find((g) => !g.heldBy && g.findApproachTile(unit));
      if (looseGnome) {
        await looseGnome.catchBy(unit);
        return true;
      }
    }

    const dest = this._aiPickMoveTile(unit);
    if (dest) {
      await Movement.moveTo(unit, dest.row, dest.col);
      return true;
    }

    return false;
  },

  // Elige la loseta alcanzable (dentro del propio movimiento) que más
  // acerque a `unit` a su objetivo más interesante — un gnomo suelto si hay
  // alguno, o si no el personaje del jugador más cercano. Reutiliza
  // Movement.reachableTiles (mismo cálculo que ya usa el jugador) en vez de
  // duplicar la comprobación de casillas ocupadas/con niebla.
  _aiPickMoveTile(unit) {
    if (typeof Movement === "undefined") return null;
    const tiles = Movement.reachableTiles(unit);
    if (tiles.length === 0) return null;

    let target = null;
    if (typeof Gnome !== "undefined" && Gnome.list.some((g) => !g.heldBy)) {
      target = Gnome.list
        .filter((g) => !g.heldBy)
        .reduce((best, g) => {
          const d = Math.max(Math.abs(g.row - unit.row), Math.abs(g.col - unit.col));
          return !best || d < best.d ? { row: g.row, col: g.col, d } : best;
        }, null);
    }
    if (!target) {
      target = Units.list
        .filter((u) => u.team === "player")
        .reduce((best, u) => {
          const d = Math.max(Math.abs(u.row - unit.row), Math.abs(u.col - unit.col));
          return !best || d < best.d ? { row: u.row, col: u.col, d } : best;
        }, null);
    }
    if (!target) return null;

    let best = null;
    let bestDist = Infinity;
    tiles.forEach((t) => {
      const d = Math.max(Math.abs(t.row - target.row), Math.abs(t.col - target.col));
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    });
    // Si ya está tan cerca como puede llegar a estar (ninguna loseta
    // alcanzable mejora la distancia actual), no malgasta la acción
    // moviéndose sin necesidad.
    const currentDist = Math.max(Math.abs(unit.row - target.row), Math.abs(unit.col - target.col));
    if (best && bestDist >= currentDist) return null;
    return best;
  },
};
