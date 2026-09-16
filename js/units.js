/* Gnomore Gnomes — unidades sobre el tablero: pintado, selección, radio de
   movimiento y desplazamiento animado.
   Regla de oro: un archivo por mecánica — este solo se encarga de las
   unidades del jugador; las losetas viven en mapgen.js y la cámara en
   boardview.js.
   Regla de oro: escalabilidad — UNIT_TYPES sigue el mismo patrón que
   TILE_TYPES/RACES: añadir una unidad nueva es añadir una entrada aquí,
   sin tocar el resto del motor.
   Regla de oro: nivel Triple A / feedback — seleccionar, ver el radio de
   movimiento y desplazarse deben sentirse satisfactorios: saltos con
   rebote, giro hacia la dirección de movimiento y sonido en cada paso. */

const UNIT_TYPES = {
  mushboom_scout: {
    spriteUrl: "assets/equipos/MushboomForest/unidad_01.png",
    movement: 2, // casillas por movimiento — de momento sin coste de terreno, solo distancia
    // La imagen viene dibujada mirando hacia la derecha por defecto.
    defaultFacing: "right",
  },
};

const Units = {
  boardSize: 0,
  container: null,
  list: [], // { id, typeId, row, col, facing, el, flipEl, spriteEl }
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

  spawnTestUnit(row, col) {
    const typeId = "mushboom_scout";
    const type = UNIT_TYPES[typeId];
    const id = `unit-${this._nextId++}`;

    const el = document.createElement("div");
    el.className = "unit";
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
    this.container.appendChild(el);

    const unit = { id, typeId, row, col, facing: type.defaultFacing, el, flipEl, spriteEl };
    this.list.push(unit);

    this._placeInstant(unit);
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      this._onUnitClick(unit);
    });

    return unit;
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
    this._showRange(unit);
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
        if (this._unitAt(row, col)) continue; // ocupada por otra unidad
        tiles.push({ row, col });
      }
    }
    return tiles;
  },

  _unitAt(row, col) {
    return this.list.find((u) => u.row === row && u.col === col);
  },

  _showRange(unit) {
    const tiles = this._reachableTiles(unit);
    tiles.forEach((t, i) => {
      const marker = document.createElement("div");
      marker.className = "range-marker";
      const { x, y } = getTileCenter(t.row, t.col, this.boardSize);
      marker.style.left = `${x}px`;
      marker.style.top = `${y}px`;
      marker.style.zIndex = String((t.row + t.col) * 10 + 2);
      marker.addEventListener("click", (e) => {
        e.stopPropagation();
        this._moveUnitTo(unit, t.row, t.col);
      });
      this.container.appendChild(marker);
      this.markerEls.push(marker);

      // La aparición se dispara con una clase (transition), no con una
      // @keyframes animation: así no compite con el estilo :hover por la
      // misma propiedad "transform" más adelante (ver nota en style.css).
      // El rAF asegura que el navegador registre primero el estado inicial
      // (opacity/scale de partida) antes de pasar al visible, y si no la
      // transición no se dispararía; el setTimeout reproduce el mismo efecto
      // escalonado que antes tenía el animation-delay.
      requestAnimationFrame(() => {
        setTimeout(() => marker.classList.add("range-marker--visible"), i * 18);
      });
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
    // Sigue seleccionada tras moverse (estamos en fase de pruebas): recalcula
    // el radio desde la nueva posición para poder seguir moviéndola.
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
};

// Al hacer clic en cualquier punto del tablero que no sea una unidad ni un
// marcador de movimiento, se deselecciona (comportamiento esperado/cómodo).
document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.getElementById("board-viewport");
  if (!viewport) return;
  viewport.addEventListener("click", (e) => {
    if (e.target.closest(".unit") || e.target.closest(".range-marker")) return;
    Units.deselect();
  });
});
