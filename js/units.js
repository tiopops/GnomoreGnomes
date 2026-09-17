/* Gnomore Gnomes — unidades sobre el tablero: modelo de datos, pintado,
   selección y las utilidades compartidas (desplazamiento paso a paso, giro,
   marcadores, barra de vida, texto flotante, eliminación) que CUALQUIER
   mecánica puede reutilizar.

   Regla de oro: un archivo por mecánica. Este archivo es el "núcleo" de las
   unidades — sabe cómo crearlas, pintarlas, seleccionarlas y moverlas de una
   loseta a otra, pero NO sabe nada de reglas de movimiento ni de combate:
   eso vive en js/movement.js y js/combat.js, cada uno en su propio archivo,
   y se registran aquí sin que este archivo tenga que conocerlos.

   Por qué está organizado así (para cuando haya que tocarlo más adelante):
   cada mecánica que se pueda usar sobre la unidad del jugador seleccionada
   (moverse, atacar, y lo que se añada después: construir, curar, una
   habilidad especial...) se registra con Units.registerRangeProvider(...)
   como un "proveedor de rango": un objeto con
     showFor(unit)   -> pinta sus propios marcadores/indicadores para `unit`
     onClear()       -> (opcional) limpia cualquier estado propio que no sean
                         marcadores (p.ej. las clases "objetivo" de combate)
   Este archivo se encarga de la selección, de vaciar los marcadores
   compartidos y de pedirle a CADA proveedor registrado que se repinte
   cuando algo cambia (tras moverse, tras atacar...). Así:
     - Se puede reescribir por completo cómo funciona el movimiento sin
       tocar el combate, y viceversa: cada uno vive en su archivo y solo
       habla con Units a través de esta API pública.
     - Añadir una mecánica nueva es crear un archivo, registrar un proveedor
       y usar las utilidades de aquí abajo — nunca hace falta editar este
       archivo ni los de las otras mecánicas.
   La partida en sí (turnos, cómo se gana/pierde) todavía no existe — eso
   irá en su propio archivo (p.ej. js/match.js) el día que se defina, y
   debería poder construirse sobre esta misma API sin reestructurar nada de
   aquí. Lo mismo vale para tableros más complejos (varios tipos de loseta,
   obstáculos): mientras sigan siendo una cuadrícula row/col, esta capa no
   necesita cambios.

   Regla de oro: escalabilidad — UNIT_TYPES sigue el mismo patrón que
   TILE_TYPES/RACES: añadir una unidad nueva es añadir una entrada aquí, sin
   tocar el resto del motor; lo mismo para añadir más equipos/bandos: basta
   con pasar otro "team" al spawnear.
   Regla de oro: nivel Triple A / feedback — seleccionar, ver el radio de
   cualquier mecánica, desplazarse y recibir texto flotante deben sentirse
   satisfactorios: saltos con rebote, giro hacia la dirección real y sonido
   en cada paso — ver también js/movement.js y js/combat.js. */

const UNIT_TYPES = {
  mushboom_scout: {
    spriteUrl: "assets/equipos/MushboomForest/unidad_01.png",
    movement: 2, // casillas por movimiento (lo usa js/movement.js)
    attackRange: 1, // pega cuerpo a cuerpo: el rival tiene que estar a 1 casilla (lo usa js/combat.js)
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
  rangeProviders: [], // mecánicas registradas (movimiento, combate, futuras) — ver cabecera del archivo
  _nextId: 1,

  init(container, boardSize) {
    this.container = container;
    this.boardSize = boardSize;
    this.list = [];
    this.selectedId = null;
    this.markerEls = [];
  },

  // Cualquier mecánica que quiera mostrar marcadores/indicadores cuando el
  // jugador selecciona una de sus unidades llama a esto UNA vez al cargar su
  // archivo (ver el final de movement.js/combat.js). El orden de registro
  // decide el orden en que se pintan (y por tanto el orden de su animación
  // escalonada si comparten índice de aparición).
  registerRangeProvider(provider) {
    this.rangeProviders.push(provider);
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
    this.updateHpBar(unit);

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
        if (!this.unitAt(row, col)) empty.push({ row, col });
      }
    }
    if (empty.length === 0) return null;
    const spot = empty[Math.floor(Math.random() * empty.length)];
    return this.spawnUnit({ typeId: "mushboom_scout", row: spot.row, col: spot.col, team: "enemy" });
  },

  unitAt(row, col) {
    return this.list.find((u) => u.row === row && u.col === col);
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

  // Gira `unit` para encararse hacia una loseta destino según su posición
  // REAL en pantalla (no basta con comparar fila/columna en isométrico) —
  // lo usan tanto los saltos de movimiento como encararse al atacar, así
  // que vive aquí en vez de duplicarse en cada mecánica.
  faceTowardsTile(unit, row, col) {
    const from = getTileCenter(unit.row, unit.col, this.boardSize);
    const to = getTileCenter(row, col, this.boardSize);
    if (to.x > from.x + 0.5) unit.facing = "right";
    else if (to.x < from.x - 0.5) unit.facing = "left";
    this._applyFacing(unit);
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
    // El radio de cualquier mecánica solo se calcula para las unidades del
    // jugador — seleccionar un rival solo sirve para verle la vida, de
    // momento no se puede actuar con él.
    if (unit.team === "player") {
      this.rangeProviders.forEach((p) => p.showFor(unit));
      this._resolveMarkerOverlaps();
    }
  },

  deselect() {
    if (!this.selectedId) return;
    const prev = this.list.find((u) => u.id === this.selectedId);
    if (prev) prev.el.classList.remove("unit--selected");
    this.selectedId = null;
    this.clearRangeOverlays();
  },

  // Vuelve a calcular y pintar el radio de TODAS las mecánicas registradas
  // para `unit` (si sigue siendo la seleccionada) — se llama tras cualquier
  // acción que pueda cambiarlo (moverse, atacar...). Centralizarlo aquí es
  // lo que permite que una mecánica no tenga que saber nada de las demás:
  // movement.js no sabe que combat.js existe, y viceversa.
  refreshRange(unit) {
    if (this.selectedId !== unit.id) return;
    this.clearRangeOverlays();
    this.rangeProviders.forEach((p) => p.showFor(unit));
    this._resolveMarkerOverlaps();
  },

  clearRangeOverlays() {
    this.markerEls.forEach((m) => m.remove());
    this.markerEls = [];
    this.rangeProviders.forEach((p) => {
      if (p.onClear) p.onClear();
    });
  },

  // Crea, posiciona y anima la aparición de un marcador interactivo sobre
  // una loseta (círculo de movimiento, mira de ataque, o cualquier
  // indicador que añada una futura mecánica). Centraliza aquí el patrón de
  // posición/animación/registro para que cada mecánica solo tenga que
  // decidir SU contenido y SU clase CSS, nunca reimplementar esto — y para
  // que el "clic fuera para deseleccionar" de más abajo detecte cualquier
  // marcador presente o futuro sin tener que conocer sus clases concretas
  // (por eso siempre lleva también la clase genérica "board-marker").
  //
  // La aparición se dispara con una clase (transition), no con una
  // @keyframes animation: mezclar una animation con fill:forwards y una
  // transition sobre la misma propiedad "transform" (p.ej. la de :hover)
  // hace que el navegador las siga disputando entre sí en cada hover, lo
  // que se ve como parpadeos (ver nota de rendimiento en style.css). El rAF
  // asegura que el navegador registre primero el estado inicial antes de
  // pasar al visible, y el setTimeout escalona la aparición de varios
  // marcadores seguidos.
  addMarker({ className, row, col, zOffset = 0, delayIndex = 0, visibleClass, onClick, buildContent }) {
    const marker = document.createElement("div");
    marker.className = `board-marker ${className}`;
    if (buildContent) buildContent(marker);

    // Guarda su loseta (no solo la posición en pantalla) para que
    // _resolveMarkerOverlaps pueda detectar cuándo dos marcadores de
    // mecánicas distintas caen en la misma loseta, sin que ninguna mecánica
    // tenga que saber de la existencia de la otra.
    marker.dataset.row = row;
    marker.dataset.col = col;

    const { x, y } = getTileCenter(row, col, this.boardSize);
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.zIndex = String((row + col) * 10 + zOffset);

    if (onClick) {
      marker.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
      });
    }

    this.container.appendChild(marker);
    this.markerEls.push(marker);

    if (visibleClass) {
      requestAnimationFrame(() => {
        setTimeout(() => marker.classList.add(visibleClass), delayIndex * 18);
      });
    }

    return marker;
  },

  // Cuando dos marcadores de mecánicas distintas caen en la misma loseta
  // (p.ej. la mira de ataque coincide con un círculo de movimiento porque el
  // rival está dentro del propio radio de movimiento del jugador), el de
  // ataque es siempre el que manda visualmente: el círculo de debajo no debe
  // verse, para no leerse como "una loseta cualquiera de movimiento" en vez
  // de "aquí se puede atacar". Se resuelve aquí, DESPUÉS de que todas las
  // mecánicas hayan pintado las suyas, precisamente para que ninguna
  // mecánica (movement.js, combat.js) necesite saber de la existencia de
  // las demás — es una regla de composición visual del núcleo, no de una
  // mecánica concreta.
  _resolveMarkerOverlaps() {
    const attackTiles = new Set(
      this.markerEls
        .filter((m) => m.classList.contains("attack-marker"))
        .map((m) => `${m.dataset.row},${m.dataset.col}`)
    );
    if (attackTiles.size === 0) return;
    this.markerEls = this.markerEls.filter((m) => {
      const hidden =
        m.classList.contains("range-marker") && attackTiles.has(`${m.dataset.row},${m.dataset.col}`);
      if (hidden) m.remove();
      return !hidden;
    });
  },

  // ---------- Desplazamiento paso a paso: lo usa cualquier mecánica que
  // necesite mover una unidad de una loseta a otra (movimiento normal,
  // acercarse antes de atacar, y lo que se añada después). Vive aquí y no
  // en movement.js para que combat.js pueda reutilizarlo tal cual, sin
  // duplicar la animación ni arriesgarse a que las dos copias diverjan. ----

  // Camino recto en línea, paso a paso por casilla (como mucho tantos pasos
  // como la distancia Chebyshev al destino) — de momento no hay obstáculos
  // en el tablero, así que un camino recto es siempre válido.
  stepPath(fromRow, fromCol, toRow, toCol) {
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

  // Recorre un camino ya calculado (ver stepPath), salto a salto, con el
  // giro/animación/sonido de cada paso. Encapsula también la limpieza que
  // hay que hacer al terminar: si no se quita a mano la clase del último
  // salto, se queda pegada para siempre y "tapa" la animación de
  // respiración (misma especificidad que unit__sprite pero declarada
  // después en el CSS) — al vivir en un único sitio, ninguna mecánica que
  // reutilice esto puede reintroducir ese bug por accidente.
  async walkPath(unit, path) {
    unit.el.classList.add("unit--moving");
    for (const step of path) {
      await this.hopTo(unit, step.row, step.col);
    }
    unit.el.classList.remove("unit--moving");
    unit.spriteEl.classList.remove("unit__sprite--hop");
  },

  hopTo(unit, row, col) {
    return new Promise((resolve) => {
      this.faceTowardsTile(unit, row, col);

      unit.row = row;
      unit.col = col;
      const { x, y } = getTileCenter(row, col, this.boardSize);
      unit.el.style.left = `${x}px`;
      unit.el.style.top = `${y}px`;
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

  // ---------- Vida / feedback genérico: cualquier mecánica puede tocar la
  // vida de una unidad o darle feedback visual — quién decide CUÁNDO
  // hacerlo (p.ej. combat.js al golpear) no tiene por qué reimplementar
  // CÓMO se ve. ----

  updateHpBar(unit) {
    const pct = Math.max(0, unit.hp / unit.maxHp) * 100;
    unit.hpFillEl.style.width = `${pct}%`;
    unit.hpFillEl.classList.toggle("unit__hpbar-fill--low", unit.hp <= 1);
  },

  // Pequeño temblor de reacción (golpe recibido, y en el futuro cualquier
  // otro impacto/bloqueo) sobre `unit`.
  playShake(unit) {
    unit.el.classList.remove("unit--hit");
    void unit.el.offsetWidth; // fuerza reflow para poder repetir el temblor
    unit.el.classList.add("unit--hit");
  },

  // Texto flotante sobre la cabeza de una unidad (daño, y en el futuro
  // curación u otros mensajes) — se autodestruye solo al acabar su propia
  // animación de subida y desvanecido (ver style.css).
  spawnFloatingText(unit, text, { className = "dmg-popup" } = {}) {
    const { x, y } = getTileCenter(unit.row, unit.col, this.boardSize);
    const popup = document.createElement("div");
    popup.className = className;
    popup.textContent = text;
    popup.style.left = `${x}px`;
    popup.style.top = `${y - 108}px`; // por encima de la cabeza
    popup.style.zIndex = String((unit.row + unit.col) * 10 + 9);
    this.container.appendChild(popup);
    popup.addEventListener("animationend", () => popup.remove());
  },

  // Elimina una unidad del juego (0 de vida, o cualquier otra razón futura)
  // con su propia animación antes de quitarla del DOM y de la lista.
  async removeUnit(unit) {
    if (this.selectedId === unit.id) this.deselect();
    unit.el.classList.add("unit--dying");
    SFX.death();
    await new Promise((resolve) => setTimeout(resolve, 420));
    unit.el.remove();
    this.list = this.list.filter((u) => u.id !== unit.id);
  },
};

// Al hacer clic en cualquier punto del tablero que no sea una unidad ni un
// marcador de cualquier mecánica (clase genérica "board-marker", ver
// addMarker), se deselecciona (comportamiento esperado/cómodo).
document.addEventListener("DOMContentLoaded", () => {
  const viewport = document.getElementById("board-viewport");
  if (!viewport) return;
  viewport.addEventListener("click", (e) => {
    if (e.target.closest(".unit") || e.target.closest(".board-marker")) return;
    Units.deselect();
  });
});
