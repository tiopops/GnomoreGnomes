/* Gnomore Gnomes — unidades sobre el tablero: pintado, selección, radio de
   movimiento/ataque, combate y desplazamiento animado.
   Regla de oro: un archivo por mecánica — este solo se encarga de las
   unidades (amigas y rivales); las losetas viven en mapgen.js y la cámara en
   boardview.js.
   Regla de oro: escalabilidad — UNIT_TYPES sigue el mismo patrón que
   TILE_TYPES/RACES: añadir una unidad nueva es añadir una entrada aquí, sin
   tocar el resto del motor; lo mismo para añadir más equipos/bandos: basta
   con pasar otro "team" al spawnear.
   Regla de oro: nivel Triple A / feedback — seleccionar, ver el radio de
   movimiento/ataque, desplazarse, golpear y morir deben sentirse
   satisfactorios: saltos con rebote, giro hacia la dirección de movimiento,
   temblor y número de daño al golpear, y sonido en cada acción. */

const UNIT_TYPES = {
  mushboom_scout: {
    spriteUrl: "assets/equipos/MushboomForest/unidad_01.png",
    movement: 2, // casillas por movimiento (y, de momento, también de alcance de ataque)
    maxHp: 3, // de momento todas las unidades tienen la misma vida
    // La imagen viene dibujada mirando hacia la derecha por defecto.
    defaultFacing: "right",
  },
};

const Units = {
  boardSize: 0,
  container: null,
  list: [], // { id, typeId, team, row, col, facing, hp, maxHp, el, flipEl, spriteEl, hpBarEl, hpFillEl }
  selectedId: null,
  markerEls: [],
  _nextId: 1,

  init(container, boardSize) {
    this.container = container;
    this.boardSize = boardSize;
    this.list = [];
    this.selectedId = null;
    this.markerEls = [];
  },

  // Crea una unidad de cualquier tipo/bando. spawnTestUnit/spawnRandomEnemy
  // (más abajo) son atajos sobre esta para los dos casos que usa el juego
  // ahora mismo, pero cualquier futuro tercer bando (u otro tipo de unidad)
  // solo necesita llamar a esto con otros parámetros.
  spawnUnit({ typeId, row, col, team }) {
    const type = UNIT_TYPES[typeId];
    const id = `unit-${this._nextId++}`;

    const el = document.createElement("div");
    el.className = `unit unit--${team}`;
    el.dataset.unitId = id;

    const flipEl = document.createElement("div");
    flipEl.className = "unit__flip";

    const spriteEl = document.createElement("img");
    spriteEl.className = "unit__sprite";
    spriteEl.src = type.spriteUrl;
    spriteEl.draggable = false;
    spriteEl.alt = "";

    flipEl.appendChild(spriteEl);
    el.appendChild(flipEl);

    const hpBarEl = document.createElement("div");
    hpBarEl.className = "unit__hpbar";
    const hpFillEl = document.createElement("div");
    hpFillEl.className = "unit__hpbar-fill";
    hpBarEl.appendChild(hpFillEl);
    el.appendChild(hpBarEl);

    this.container.appendChild(el);

    const unit = {
      id,
      typeId,
      team,
      row,
      col,
      facing: type.defaultFacing,
      hp: type.maxHp,
      maxHp: type.maxHp,
      el,
      flipEl,
      spriteEl,
      hpBarEl,
      hpFillEl,
    };
    this.list.push(unit);

    this._placeInstant(unit);
    this._updateHpBar(unit);

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this._onUnitClick(unit);
    });

    return unit;
  },

  spawnTestUnit(row, col) {
    return this.spawnUnit({ typeId: "mushboom_scout", row, col, team: "player" });
  },

  // Coloca un rival en una casilla libre al azar del tablero — de momento
  // solo para pruebas (mismo tipo de unidad que el jugador, con tinte rojo
  // vía CSS hasta que haya arte propio para el bando rival).
  spawnRandomEnemy() {
    const empty = [];
    for (let row = 0; row < this.boardSize; row++) {
      for (let col = 0; col < this.boardSize; col++) {
        if (!this._unitAt(row, col)) empty.push({ row, col });
      }
    }
    if (empty.length === 0) return null;
    const spot = empty[Math.floor(Math.random() * empty.length)];
    return this.spawnUnit({ typeId: "mushboom_scout", row: spot.row, col: spot.col, team: "enemy" });
  },

  _placeInstant(unit) {
    const { x, y } = getTileCenter(unit.row, unit.col, this.boardSize);
    unit.el.style.left = `${x}px`;
    unit.el.style.top = `${y}px`;
    unit.el.style.zIndex = String((unit.row + unit.col) * 10 + 5);
    this._applyFacing(unit);
  },

  _applyFacing(unit) {
    // El arte mira a la derecha por defecto: invertir solo cuando toca mirar a la izquierda.
    unit.flipEl.style.transform = unit.facing === "left" ? "scaleX(-1)" : "scaleX(1)";
  },

  _onUnitClick(unit) {
    if (this.selectedId === unit.id) {
      this.deselect();
      return;
    }
    this.select(unit);
  },

  select(unit) {
    this.deselect();
    this.selectedId = unit.id;
    unit.el.classList.add("unit--selected");
    SFX.click();
    // El radio de movimiento/ataque solo se calcula para las unidades del
    // jugador — seleccionar un rival solo sirve para verle la vida, de
    // momento no se puede mover ni actuar con él.
    if (unit.team === "player") {
      this._showRange(unit);
    }
  },

  deselect() {
    if (!this.selectedId) return;
    const prev = this.list.find((u) => u.id === this.selectedId);
    if (prev) prev.el.classList.remove("unit--selected");
    this.selectedId = null;
    this._clearRange();
  },

  _reachableTiles(unit) {
    const type = UNIT_TYPES[unit.typeId];
    const range = type.movement;
    const tiles = [];
    for (let dr = -range; dr <= range; dr++) {
      for (let dc = -range; dc <= range; dc++) {
        if (dr === 0 && dc === 0) continue;
        // Distancia Chebyshev: se puede llegar en `range` pasos en cualquier dirección (8 direcciones).
        if (Math.max(Math.abs(dr), Math.abs(dc)) > range) continue;
        const row = unit.row + dr;
        const col = unit.col + dc;
        if (row < 0 || col < 0 || row >= this.boardSize || col >= this.boardSize) continue;
        if (this._unitAt(row, col)) continue; // ocupada por otra unidad (rival = se ataca, no se pisa)
        tiles.push({ row, col });
      }
    }
    return tiles;
  },

  // Unidades rivales (vivas) al alcance de ataque de `unit`. De momento usa
  // el mismo número que el de movimiento — el día que haya un stat de
  // alcance de ataque independiente, solo cambia esta función.
  _attackableEnemies(unit) {
    const type = UNIT_TYPES[unit.typeId];
    const range = type.movement;
    return this.list.filter((other) => {
      if (other.team === unit.team || other.hp <= 0) return false;
      const dr = other.row - unit.row;
      const dc = other.col - unit.col;
      return Math.max(Math.abs(dr), Math.abs(dc)) <= range;
    });
  },

  _unitAt(row, col) {
    return this.list.find((u) => u.row === row && u.col === col);
  },

  _showRange(unit) {
    const moveTiles = this._reachableTiles(unit);
    moveTiles.forEach((t, i) => this._addMoveMarker(unit, t, i));

    const targets = this._attackableEnemies(unit);
    targets.forEach((target, i) => this._addAttackMarker(unit, target, moveTiles.length + i));
  },

  _addMoveMarker(unit, tile, delayIndex) {
    const marker = document.createElement("div");
    marker.className = "range-marker";
    const { x, y } = getTileCenter(tile.row, tile.col, this.boardSize);
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.zIndex = String((tile.row + tile.col) * 10 + 2);
    marker.addEventListener("click", (e) => {
      e.stopPropagation();
      this._moveUnitTo(unit, tile.row, tile.col);
    });
    this.container.appendChild(marker);
    this.markerEls.push(marker);
    this._revealMarker(marker, "range-marker--visible", delayIndex);
  },

  // Loseta con un rival al alcance: mismo hueco visual que un range-marker
  // (misma casilla, mismo tamaño), pero con la mira roja de ataque en vez
  // del círculo — no se puede mover ahí, así que lo sustituye.
  _addAttackMarker(attacker, target, delayIndex) {
    const marker = document.createElement("div");
    marker.className = "attack-marker";
    const icon = document.createElement("i");
    icon.className = "ph ph-crosshair attack-marker__icon";
    marker.appendChild(icon);
    const { x, y } = getTileCenter(target.row, target.col, this.boardSize);
    marker.style.left = `${x}px`;
    // Desplazada hacia abajo respecto al centro exacto de la loseta: el
    // propio rectángulo (invisible) del sprite del rival ya ocupa esa zona y
    // se dibuja por encima (para poder seguir seleccionándolo con un clic
    // normal), así que centrar la mira ahí la dejaría tapada y no se podría
    // pulsar. Bajarla la saca de debajo del rival y la deja, literalmente,
    // a sus pies.
    marker.style.top = `${y + 28}px`;
    marker.style.zIndex = String((target.row + target.col) * 10 + 3);
    marker.addEventListener("click", (e) => {
      e.stopPropagation();
      this._attackUnit(attacker, target);
    });
    this.container.appendChild(marker);
    this.markerEls.push(marker);
    this._revealMarker(marker, "attack-marker--visible", delayIndex);
  },

  // La aparición se dispara con una clase (transition), no con una
  // @keyframes animation: así no compite con el estilo :hover por la misma
  // propiedad "transform" (ver nota en style.css sobre el parpadeo que
  // causaba mezclar ambas). El rAF asegura que el navegador registre primero
  // el estado inicial antes de pasar al visible, y el setTimeout escalona la
  // aparición igual que antes hacía el animation-delay.
  _revealMarker(marker, visibleClass, delayIndex) {
    requestAnimationFrame(() => {
      setTimeout(() => marker.classList.add(visibleClass), delayIndex * 18);
    });
  },

  _clearRange() {
    this.markerEls.forEach((m) => m.remove());
    this.markerEls = [];
  },

  async _moveUnitTo(unit, destRow, destCol) {
    this._clearRange();
    unit.el.classList.add("unit--moving");

    const path = this._stepPath(unit.row, unit.col, destRow, destCol);
    for (const step of path) {
      await this._hopTo(unit, step.row, step.col);
    }

    unit.el.classList.remove("unit--moving");
    // La clase del salto se queda pegada tras el último paso (no hay más
    // saltos que la vuelvan a reiniciar) y, al tener la misma especificidad
    // que la regla de respiración pero declararse después en el CSS, ganaba
    // para siempre y dejaba al personaje sin animación de espera. Hay que
    // quitarla explícitamente al terminar de moverse.
    unit.spriteEl.classList.remove("unit__sprite--hop");

    // Sigue seleccionada tras moverse (estamos en fase de pruebas): recalcula
    // el radio desde la nueva posición para poder seguir moviéndola o atacar.
    if (this.selectedId === unit.id) {
      this._showRange(unit);
    }
  },

  // Camino recto en línea, paso a paso por casilla (como mucho tantos pasos
  // como la distancia Chebyshev al destino) — de momento no hay obstáculos
  // en el tablero, así que un camino recto es siempre válido.
  _stepPath(fromRow, fromCol, toRow, toCol) {
    const steps = Math.max(Math.abs(toRow - fromRow), Math.abs(toCol - fromCol));
    const path = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      path.push({
        row: Math.round(fromRow + (toRow - fromRow) * t),
        col: Math.round(fromCol + (toCol - fromCol) * t),
      });
    }
    return path;
  },

  _hopTo(unit, row, col) {
    return new Promise((resolve) => {
      const from = getTileCenter(unit.row, unit.col, this.boardSize);
      const to = getTileCenter(row, col, this.boardSize);

      // Girar hacia la dirección real del paso en pantalla (izquierda/derecha).
      if (to.x > from.x + 0.5) unit.facing = "right";
      else if (to.x < from.x - 0.5) unit.facing = "left";
      this._applyFacing(unit);

      unit.row = row;
      unit.col = col;
      unit.el.style.left = `${to.x}px`;
      unit.el.style.top = `${to.y}px`;
      unit.el.style.zIndex = String((row + col) * 10 + 5);

      // Reinicia la animación de salto en cada paso (aunque sea la misma clase).
      unit.spriteEl.classList.remove("unit__sprite--hop");
      void unit.spriteEl.offsetWidth; // fuerza reflow para poder repetir la animación
      unit.spriteEl.classList.add("unit__sprite--hop");

      SFX.hop();

      const HOP_MS = 220;
      setTimeout(resolve, HOP_MS);
    });
  },

  async _attackUnit(attacker, target) {
    this._clearRange();

    // El atacante se encara hacia el objetivo, igual que al moverse.
    const from = getTileCenter(attacker.row, attacker.col, this.boardSize);
    const to = getTileCenter(target.row, target.col, this.boardSize);
    if (to.x > from.x + 0.5) attacker.facing = "right";
    else if (to.x < from.x - 0.5) attacker.facing = "left";
    this._applyFacing(attacker);

    target.hp = Math.max(0, target.hp - 1);
    this._updateHpBar(target);
    this._spawnDamagePopup(target, 1);
    this._playHitReaction(target);
    SFX.hit();

    if (target.hp <= 0) {
      await this._removeUnit(target);
    }

    // Igual que al moverse: sigue seleccionado, recalcula el radio por si ya
    // no quedan más rivales al alcance o alguno ha muerto.
    if (this.selectedId === attacker.id) {
      this._showRange(attacker);
    }
  },

  _playHitReaction(unit) {
    unit.el.classList.remove("unit--hit");
    void unit.el.offsetWidth; // fuerza reflow para poder repetir el temblor
    unit.el.classList.add("unit--hit");
  },

  _updateHpBar(unit) {
    const pct = Math.max(0, unit.hp / unit.maxHp) * 100;
    unit.hpFillEl.style.width = `${pct}%`;
    unit.hpFillEl.classList.toggle("unit__hpbar-fill--low", unit.hp <= 1);
  },

  // Número de daño flotante sobre la cabeza del que recibe el golpe — se
  // autodestruye solo (ver dmg-popup-rise en style.css) al acabar su propia
  // animación de subida y desvanecido.
  _spawnDamagePopup(unit, amount) {
    const { x, y } = getTileCenter(unit.row, unit.col, this.boardSize);
    const popup = document.createElement("div");
    popup.className = "dmg-popup";
    popup.textContent = `-${amount}`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y - 108}px`; // por encima de la cabeza
    popup.style.zIndex = String((unit.row + unit.col) * 10 + 9);
    this.container.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  },

  async _removeUnit(unit) {
    if (this.selectedId === unit.id) this.deselect();
    unit.el.classList.add("unit--dying");
    SFX.death();
    await new Promise((resolve) => setTimeout(resolve, 420));
    unit.el.remove();
    this.list = this.list.filter((u) => u.id !== unit.id);
  },
};

// Al hacer clic en cualquier punto del tablero que no sea una unidad ni un
// marcador de movimiento/ataque, se deselecciona (comportamiento esperado/cómodo).
document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.getElementById("board-viewport");
  if (!viewport) return;
  viewport.addEventListener("click", (e) => {
    if (e.target.closest(".unit") || e.target.closest(".range-marker") || e.target.closest(".attack-marker")) return;
    Units.deselect();
  });
});
